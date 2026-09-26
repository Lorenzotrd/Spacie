import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { Db } from "./db/client";
import { columns, fromRow } from "./db/rows";
import { hashToken } from "./tokens";
import type { Principal } from "./types";

export const SESSION_COOKIE = "spacie_session";
export const SESSION_TTL_MS = 30 * 86_400_000;
const INVITE_TTL_MS = 7 * 86_400_000;
export const MIN_PASSWORD = 10;

export type Role = "owner" | "admin" | "member" | "viewer";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

function derive(password: string, salt: Buffer, o: ScryptOptions & { keylen: number }) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, o.keylen, { N: o.N, r: o.r, p: o.p, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key))),
  );
}

/** `scrypt$N$r$p$salt$hash`, parameters stored so they can be raised later. */
export async function hashPassword(password: string, minLength = MIN_PASSWORD) {
  if (password.length < minLength)
    throw new Error(`Use at least ${minLength} characters for your password.`);
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(N), r: Number(r), p: Number(p), keylen: expected.length,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Verified against when the email is unknown, so timing does not reveal accounts. */
let decoy: Promise<string> | undefined;

const newSecret = () => randomBytes(32).toString("base64url");

export async function createSession(db: Db, userId: string) {
  const token = newSecret();
  await db.query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)",
    [hashToken(token), userId, new Date(Date.now() + SESSION_TTL_MS).toISOString()],
  );
  return token;
}

/** The human principal behind a live session token, or null. */
export async function sessionPrincipal(db: Db, token: string): Promise<Principal | null> {
  const [row] = await db.query(
    `select ${columns.principal} from principals
     where type = 'human' and user_id = (
       select user_id from sessions where token_hash = $1 and expires_at > now())
     limit 1`,
    [hashToken(token)],
  );
  return row ? fromRow<Principal>(row) : null;
}

export async function endSession(db: Db, token: string) {
  await db.query("delete from sessions where token_hash = $1", [hashToken(token)]);
}

/** Returns a new session token, or throws one message for every failure. */
export async function signIn(db: Db, email: string, password: string) {
  const [user] = await db.query<{ id: string; password_hash: string | null }>(
    "select id, password_hash from users where lower(email) = lower($1)",
    [email.trim()],
  );
  decoy ??= hashPassword("decoy-password-never-matches");
  const ok = await verifyPassword(password, user?.password_hash ?? (await decoy));
  if (!user?.password_hash || !ok) throw new Error("UNAUTHORIZED: Wrong email or password.");
  return createSession(db, user.id);
}

export async function createInvitation(
  db: Db,
  input: { workspaceId: string; role: Role; invitedBy: string | null; email?: string },
) {
  const token = newSecret();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  await db.query(
    `insert into invitations (workspace_id, token_hash, email, role, invited_by, expires_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [input.workspaceId, hashToken(token), input.email?.toLowerCase() ?? null, input.role, input.invitedBy, expiresAt],
  );
  return { token, expiresAt };
}

export async function inspectInvitation(db: Db, token: string) {
  const [row] = await db.query<{ workspace: string; role: Role; email: string | null }>(
    `select w.name as workspace, i.role, i.email from invitations i join workspaces w on w.id = i.workspace_id
     where i.token_hash = $1 and i.accepted_at is null and i.expires_at > now()`,
    [hashToken(token)],
  );
  return row ?? null;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/** Creates the account and its workspace membership from a single-use link, then signs in. */
export async function acceptInvitation(
  db: Db,
  token: string,
  input: { name: string; email: string; password: string },
) {
  const passwordHash = await hashPassword(input.password);
  const email = input.email.trim().toLowerCase();
  return db.transaction(async (tx) => {
    const [invite] = await tx.query<{ id: string; workspace_id: string; role: Role; email: string | null }>(
      `select id, workspace_id, role, email from invitations
       where token_hash = $1 and accepted_at is null and expires_at > now() for update`,
      [hashToken(token)],
    );
    if (!invite) throw new Error("This invitation link is invalid or has expired.");
    if (invite.email && invite.email !== email)
      throw new Error("This invitation was sent to a different email address.");
    const [existing] = await tx.query("select 1 from users where lower(email) = $1", [email]);
    if (existing) throw new Error("An account already exists for this email. Sign in instead.");
    const [user] = await tx.query<{ id: string }>(
      "insert into users (id, email, name, password_hash) values (gen_random_uuid(), $1, $2, $3) returning id",
      [email, input.name.trim(), passwordHash],
    );
    const [member] = await tx.query<{ id: string }>(
      `insert into principals (workspace_id, type, user_id, name, initials, color, status, role)
       values ($1, 'human', $2, $3, $4, '#4568f5', 'online', $5) returning id`,
      [invite.workspace_id, user.id, input.name.trim(), initials(input.name), invite.role],
    );
    await tx.query("update invitations set accepted_at = now() where id = $1", [invite.id]);
    await tx.query(
      `insert into activity_events (workspace_id, actor_id, action, name) values ($1, $2, 'joined', $3)`,
      [invite.workspace_id, member.id, input.name.trim()],
    );
    await tx.query("update workspaces set revision = revision + 1 where id = $1", [invite.workspace_id]);
    return createSession(tx, user.id);
  });
}

/** Creates an empty workspace and the one-time link its owner uses to create their account. */
export async function createWorkspaceWithOwnerInvite(db: Db, name: string) {
  return db.transaction(async (tx) => {
    const [workspace] = await tx.query<{ id: string }>(
      `insert into workspaces (name, slug) values ($1, 'workspace-' || substr(md5(random()::text), 1, 10)) returning id`,
      [name],
    );
    return { workspaceId: workspace.id, ...(await createInvitation(tx, { workspaceId: workspace.id, role: "owner", invitedBy: null })) };
  });
}

export function sessionCookie(token: string, maxAgeMs = SESSION_TTL_MS) {
  const secure = process.env.SPACIE_ORIGIN?.startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`;
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}
