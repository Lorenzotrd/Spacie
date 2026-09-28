import type { Db } from "./db/client";
import { hashToken } from "./tokens";
import { initials, type Role } from "./accounts";
import type { Principal } from "./types";

export type WorkspaceSummary = { id: string; name: string; role: Role; current: boolean };

const WORKSPACE_NAME_MAX = 80;

/** People only: agents belong to exactly one workspace and never switch. */
export function requireHuman(actor: Principal) {
  if (actor.type !== "human") throw new Error("FORBIDDEN: Only people can manage workspaces.");
}

export async function userOf(db: Db, actor: Principal): Promise<{ id: string; name: string; email: string }> {
  const [row] = await db.query<{ id: string; name: string; email: string }>(
    `select u.id, u.name, u.email from principals p join users u on u.id = p.user_id
     where p.id = $1 and p.workspace_id = $2 and p.type = 'human'`,
    [actor.id, actor.workspaceId],
  );
  if (!row) throw new Error("UNAUTHORIZED");
  return row;
}

async function openInSession(db: Db, sessionToken: string, userId: string, workspaceId: string) {
  const updated = await db.query(
    "update sessions set workspace_id = $3 where token_hash = $1 and user_id = $2 returning 1",
    [hashToken(sessionToken), userId, workspaceId],
  );
  if (!updated.length) throw new Error("UNAUTHORIZED");
}

/** Every workspace the actor's person belongs to, oldest membership first. */
export async function listWorkspaces(db: Db, actor: Principal): Promise<WorkspaceSummary[]> {
  const only = async (): Promise<WorkspaceSummary[]> => {
    const [w] = await db.query<{ id: string; name: string }>("select id, name from workspaces where id = $1", [
      actor.workspaceId,
    ]);
    return w ? [{ ...w, role: actor.role ?? "member", current: true }] : [];
  };
  // Agents, and people without an account (the local demo), only ever see their own.
  if (actor.type !== "human") return only();
  const rows = await db.query<{ id: string; name: string; role: Role }>(
    `select w.id, w.name, p.role from principals p
     join principals me on me.user_id = p.user_id and me.id = $1
     join workspaces w on w.id = p.workspace_id
     where p.type = 'human' order by p.created_at, p.id`,
    [actor.id],
  );
  if (!rows.length) return only();
  return rows.map((r) => ({ ...r, current: r.id === actor.workspaceId }));
}

/** Opens another of the person's workspaces in this session. */
export async function switchWorkspace(db: Db, actor: Principal, sessionToken: string, workspaceId: string) {
  requireHuman(actor);
  const user = await userOf(db, actor);
  const [member] = await db.query(
    "select 1 from principals where user_id = $1 and workspace_id = $2 and type = 'human'",
    [user.id, workspaceId],
  );
  if (!member) throw new Error("FORBIDDEN: You are not a member of that workspace.");
  await openInSession(db, sessionToken, user.id, workspaceId);
  return { id: workspaceId };
}

/** Creates a workspace owned by the actor's person and opens it. */
export async function createWorkspace(db: Db, actor: Principal, sessionToken: string, name: string) {
  requireHuman(actor);
  const clean = name.trim().slice(0, WORKSPACE_NAME_MAX);
  if (!clean) throw new Error("Name is required");
  const user = await userOf(db, actor);
  return db.transaction(async (tx) => {
    const [workspace] = await tx.query<{ id: string }>(
      `insert into workspaces (name, slug) values ($1, 'workspace-' || substr(md5(random()::text), 1, 10)) returning id`,
      [clean],
    );
    const [owner] = await tx.query<{ id: string }>(
      `insert into principals (workspace_id, type, user_id, name, initials, color, status, role)
       values ($1, 'human', $2, $3, $4, '#17181c', 'online', 'owner') returning id`,
      [workspace.id, user.id, actor.name, initials(actor.name)],
    );
    await tx.query(
      "insert into activity_events (workspace_id, actor_id, action, name) values ($1, $2, 'created workspace', $3)",
      [workspace.id, owner.id, clean],
    );
    await openInSession(tx, sessionToken, user.id, workspace.id);
    return { id: workspace.id };
  });
}

/** Accepts an invitation with the account already signed in, and opens that workspace. */
export async function joinWithSession(db: Db, actor: Principal, sessionToken: string, token: string) {
  requireHuman(actor);
  const user = await userOf(db, actor);
  return db.transaction(async (tx) => {
    const [invite] = await tx.query<{ id: string; workspace_id: string; role: Role; email: string | null }>(
      `select id, workspace_id, role, email from invitations
       where token_hash = $1 and accepted_at is null and expires_at > now() for update`,
      [hashToken(token)],
    );
    if (!invite) throw new Error("This invitation link is invalid or has expired.");
    if (invite.email && invite.email !== user.email.toLowerCase())
      throw new Error("This invitation was sent to a different email address.");
    const [already] = await tx.query(
      "select 1 from principals where user_id = $1 and workspace_id = $2 and type = 'human'",
      [user.id, invite.workspace_id],
    );
    if (already) throw new Error("You are already a member of this workspace.");
    const [member] = await tx.query<{ id: string }>(
      `insert into principals (workspace_id, type, user_id, name, initials, color, status, role)
       values ($1, 'human', $2, $3, $4, '#17181c', 'online', $5) returning id`,
      [invite.workspace_id, user.id, user.name, initials(user.name), invite.role],
    );
    await tx.query("update invitations set accepted_at = now() where id = $1", [invite.id]);
    await tx.query("insert into activity_events (workspace_id, actor_id, action, name) values ($1, $2, 'joined', $3)", [
      invite.workspace_id,
      member.id,
      user.name,
    ]);
    await tx.query("update workspaces set revision = revision + 1 where id = $1", [invite.workspace_id]);
    await openInSession(tx, sessionToken, user.id, invite.workspace_id);
    return { id: invite.workspace_id };
  });
}

/** Owners and admins rename the open workspace. */
export async function renameWorkspace(db: Db, actor: Principal, name: string) {
  requireHuman(actor);
  if (actor.role !== "owner" && actor.role !== "admin")
    throw new Error("FORBIDDEN: Only owners and admins can rename the workspace.");
  const clean = name.trim().slice(0, WORKSPACE_NAME_MAX);
  if (!clean) throw new Error("Name is required");
  await db.query("update workspaces set name = $2, revision = revision + 1 where id = $1", [actor.workspaceId, clean]);
  return { name: clean };
}
