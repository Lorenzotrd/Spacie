import type { Db } from "./db/client";
import { hashPassword, initials, verifyPassword } from "./accounts";
import { hashToken } from "./tokens";
import type { Principal } from "./types";
import { requireHuman, userOf } from "./workspaces";

export const NAME_MAX = 80;

export type Profile = { name: string; email: string; hasPassword: boolean };
export type SessionSummary = {
  id: string;
  device: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  current: boolean;
};

const iso = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());

export async function getProfile(db: Db, actor: Principal): Promise<Profile> {
  requireHuman(actor);
  const user = await userOf(db, actor);
  const [row] = await db.query<{ has_password: boolean }>(
    "select password_hash is not null as has_password from users where id = $1",
    [user.id],
  );
  return { name: user.name, email: user.email, hasPassword: !!row?.has_password };
}

/** Renames the person everywhere: the account and each workspace membership. */
export async function updateProfile(db: Db, actor: Principal, name: string) {
  requireHuman(actor);
  const clean = name.trim().slice(0, NAME_MAX);
  if (!clean) throw new Error("Name is required");
  const user = await userOf(db, actor);
  return db.transaction(async (tx) => {
    await tx.query("update users set name = $2 where id = $1", [user.id, clean]);
    const touched = await tx.query<{ workspace_id: string }>(
      `update principals set name = $2, initials = $3 where user_id = $1 and type = 'human' returning workspace_id`,
      [user.id, clean, initials(clean)],
    );
    for (const { workspace_id } of touched)
      await tx.query("update workspaces set revision = revision + 1 where id = $1", [workspace_id]);
    return { name: clean };
  });
}

/** Checks the current password, stores the new one and signs out every other session. */
export async function changePassword(db: Db, actor: Principal, sessionToken: string, current: string, next: string) {
  requireHuman(actor);
  const user = await userOf(db, actor);
  const [row] = await db.query<{ password_hash: string | null }>("select password_hash from users where id = $1", [
    user.id,
  ]);
  if (!row?.password_hash || !(await verifyPassword(current, row.password_hash)))
    throw new Error("Your current password is not right.");
  const hash = await hashPassword(next);
  await db.transaction(async (tx) => {
    await tx.query("update users set password_hash = $2 where id = $1", [user.id, hash]);
    await tx.query("delete from sessions where user_id = $1 and token_hash <> $2", [user.id, hashToken(sessionToken)]);
  });
  return { ok: true };
}

export async function listSessions(db: Db, actor: Principal, sessionToken: string): Promise<SessionSummary[]> {
  requireHuman(actor);
  const user = await userOf(db, actor);
  const rows = await db.query<{
    id: string; user_agent: string | null; created_at: Date | string; last_seen_at: Date | string | null; current: boolean;
  }>(
    `select id, user_agent, created_at, last_seen_at, token_hash = $2 as current from sessions
     where user_id = $1 and expires_at > now()
     order by token_hash = $2 desc, coalesce(last_seen_at, created_at) desc`,
    [user.id, hashToken(sessionToken)],
  );
  return rows.map((r) => ({
    id: r.id,
    device: r.user_agent,
    createdAt: iso(r.created_at)!,
    lastSeenAt: iso(r.last_seen_at),
    current: r.current,
  }));
}

/** Ends one of the person's other sessions, or all of them when `id` is omitted. */
export async function endOtherSessions(db: Db, actor: Principal, sessionToken: string, id?: string) {
  requireHuman(actor);
  const user = await userOf(db, actor);
  const ended = await db.query(
    `delete from sessions where user_id = $1 and token_hash <> $2 and ($3::uuid is null or id = $3) returning 1`,
    [user.id, hashToken(sessionToken), id ?? null],
  );
  if (id && !ended.length) throw new Error("Session not found");
  return { ended: ended.length };
}
