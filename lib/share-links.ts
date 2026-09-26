import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Db } from "./db/client";
import { loadAccess } from "./access";
import { hashPassword, verifyPassword } from "./accounts";
import { columns, fromRow, fromRows } from "./db/rows";
import { can, requirePermission, type Resource } from "./permissions";
import { appSecret, sign, verifySignature } from "./secrets";
import type { FileMeta, FileRecord, Principal } from "./types";

const ACCESS_TTL_MS = 2 * 3600_000;
const MIN_SHARE_PASSWORD = 8;
const MAX_FAILED_ATTEMPTS = 10;
const LOCK_MINUTES = 15;

export const shareTarget = z.object({
  type: z.enum(["file", "folder", "project"]),
  id: z.string().uuid(),
});
export type ShareTarget = z.infer<typeof shareTarget>;

export const shareOptions = z.object({
  target: shareTarget,
  /** Days until the link stops working; null means it never expires. */
  expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]).default(30),
  allowDownload: z.boolean().default(true),
  password: z.string().max(200).optional(),
});
export type ShareOptions = z.input<typeof shareOptions>;

type Located = { projectId: string; folderId: string | null; fileId: string | null; name: string; resource: Resource };

/** Resolves what a link points at, inside the actor's workspace. */
async function locate(db: Db, workspaceId: string, target: ShareTarget): Promise<Located> {
  if (target.type === "file") {
    const [f] = await db.query<{ project_id: string; folder_id: string | null; name: string; deleted: boolean }>(
      "select project_id, folder_id, name, deleted from files where id = $1 and workspace_id = $2",
      [target.id, workspaceId],
    );
    if (!f || f.deleted) throw new Error("File not found");
    return { projectId: f.project_id, folderId: f.folder_id, fileId: target.id, name: f.name,
      resource: { workspaceId, projectId: f.project_id, folderId: f.folder_id } };
  }
  if (target.type === "folder") {
    const [f] = await db.query<{ project_id: string; name: string }>(
      "select project_id, name from folders where id = $1 and workspace_id = $2",
      [target.id, workspaceId],
    );
    if (!f) throw new Error("Folder not found");
    return { projectId: f.project_id, folderId: target.id, fileId: null, name: f.name,
      resource: { workspaceId, projectId: f.project_id, folderId: target.id } };
  }
  const [p] = await db.query<{ name: string }>(
    "select name from projects where id = $1 and workspace_id = $2",
    [target.id, workspaceId],
  );
  if (!p) throw new Error("Project not found");
  return { projectId: target.id, folderId: null, fileId: null, name: p.name, resource: { workspaceId, projectId: target.id } };
}

type LinkRow = {
  id: string; workspace_id: string; token: string; resource_type: ShareTarget["type"]; project_id: string;
  folder_id: string | null; file_id: string | null; created_by: string; allow_download: boolean;
  password_hash: string | null; expires_at: Date | string | null; revoked_at: Date | string | null;
  view_count: number; last_viewed_at: Date | string | null; created_at: Date | string;
  locked_until: Date | string | null;
};

const iso = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());

export type ShareLink = {
  id: string;
  url: string;
  allowDownload: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  createdBy: string;
};

const present = (row: LinkRow, origin: string): ShareLink => ({
  id: row.id,
  url: `${origin}/s/${row.token}`,
  allowDownload: row.allow_download,
  hasPassword: !!row.password_hash,
  expiresAt: iso(row.expires_at),
  viewCount: row.view_count,
  lastViewedAt: iso(row.last_viewed_at),
  createdAt: iso(row.created_at)!,
  createdBy: row.created_by,
});

async function touchWorkspace(tx: Db, actor: Principal, action: string, name: string, place: Located) {
  await tx.query("update workspaces set revision = revision + 1 where id = $1", [actor.workspaceId]);
  await tx.query(
    `insert into activity_events (workspace_id, actor_id, project_id, file_id, action, name) values ($1, $2, $3, $4, $5, $6)`,
    [actor.workspaceId, actor.id, place.projectId, place.fileId, action, name],
  );
}

/** Creates a public link. Requires `publish` (and therefore read) on the shared resource. */
export async function createShareLink(db: Db, actor: Principal, input: ShareOptions, origin: string) {
  const options = shareOptions.parse(input);
  const place = await locate(db, actor.workspaceId, options.target);
  const access = await loadAccess(db, actor);
  requirePermission(access, actor, "read", place.resource);
  requirePermission(access, actor, "publish", place.resource);
  const password = options.password?.trim()
    ? await hashPassword(options.password.trim(), MIN_SHARE_PASSWORD)
    : null;
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 86_400_000).toISOString()
    : null;
  return db.transaction(async (tx) => {
    const [row] = await tx.query<LinkRow>(
      `insert into share_links (workspace_id, token, resource_type, project_id, folder_id, file_id, created_by,
         allow_download, password_hash, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
      [actor.workspaceId, randomBytes(24).toString("base64url"), options.target.type, place.projectId,
        options.target.type === "project" ? null : place.folderId, place.fileId, actor.id,
        options.allowDownload, password, expiresAt],
    );
    await touchWorkspace(tx, actor, "shared publicly", place.name, place);
    return present(row, origin);
  });
}

/** Live links for exactly this resource, visible to anyone who can read it. */
export async function listShareLinks(db: Db, actor: Principal, target: ShareTarget, origin: string) {
  const place = await locate(db, actor.workspaceId, target);
  // Seeing a link is as good as holding it, so listing needs the right to publish.
  requirePermission(await loadAccess(db, actor), actor, "publish", place.resource);
  const rows = await db.query<LinkRow>(
    `select * from share_links
     where workspace_id = $1 and resource_type = $2 and revoked_at is null
       and (expires_at is null or expires_at > now())
       and ((resource_type = 'file' and file_id = $3) or (resource_type = 'folder' and folder_id = $3)
         or (resource_type = 'project' and project_id = $3))
     order by created_at desc`,
    [actor.workspaceId, target.type, target.id],
  );
  return rows.map((r) => present(r, origin));
}

export async function revokeShareLink(db: Db, actor: Principal, id: string) {
  const [row] = await db.query<LinkRow>(
    "select * from share_links where id = $1 and workspace_id = $2 and revoked_at is null",
    [id, actor.workspaceId],
  );
  if (!row) throw new Error("Share link not found");
  const target: ShareTarget = {
    type: row.resource_type,
    id: row.file_id ?? row.folder_id ?? row.project_id,
  };
  const place = await locate(db, actor.workspaceId, target).catch(() => null);
  const resource = place?.resource ?? { workspaceId: actor.workspaceId, projectId: row.project_id };
  requirePermission(await loadAccess(db, actor), actor, "publish", resource);
  await db.transaction(async (tx) => {
    await tx.query("update share_links set revoked_at = now() where id = $1", [id]);
    if (place) await touchWorkspace(tx, actor, "revoked a public link to", place.name, place);
  });
  return { id };
}

// ---- Public side: everything below is reachable without an account. ----

export class ShareAccessError extends Error {
  constructor(readonly reason: "not_found" | "password_required" | "wrong_password" | "locked") {
    super({
      not_found: "This link is not available",
      password_required: "PASSWORD_REQUIRED",
      wrong_password: "UNAUTHORIZED: Wrong password.",
      locked: "Too many wrong passwords. Try again in 15 minutes.",
    }[reason]);
  }
}

const accessPayload = (row: LinkRow, expires: number) => `${row.id}.${row.password_hash}.${expires}`;

/** A signed, expiring pass for a password-protected link (used in asset URLs). */
async function issueAccess(db: Db, row: LinkRow) {
  const expires = Date.now() + ACCESS_TTL_MS;
  return `${expires}.${sign(await appSecret(db, "share-access"), accessPayload(row, expires))}`;
}

async function hasAccess(db: Db, row: LinkRow, access: string | null) {
  if (!access) return false;
  const [expires, signature] = access.split(".");
  const at = Number(expires);
  if (!signature || !Number.isFinite(at) || at < Date.now()) return false;
  return verifySignature(await appSecret(db, "share-access"), accessPayload(row, at), signature);
}

/**
 * Opens a link for a visitor. It is dead if revoked, expired, or if its creator can
 * no longer read the resource (left the project, or an agent was disconnected).
 */
async function open(db: Db, token: string, credentials: { password?: string | null; access?: string | null }) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new ShareAccessError("not_found");
  const [row] = await db.query<LinkRow>(
    `select * from share_links where token = $1 and revoked_at is null and (expires_at is null or expires_at > now())`,
    [token],
  );
  if (!row) throw new ShareAccessError("not_found");
  const [creatorRow] = await db.query(
    `select ${columns.principal} from principals where id = $1 and workspace_id = $2`,
    [row.created_by, row.workspace_id],
  );
  const creator = creatorRow ? fromRow<Principal>(creatorRow) : null;
  const target: ShareTarget = { type: row.resource_type, id: row.file_id ?? row.folder_id ?? row.project_id };
  const place = creator && (creator.type === "human" || creator.status !== "offline")
    ? await locate(db, row.workspace_id, target).catch(() => null)
    : null;
  if (!creator || !place || !can(await loadAccess(db, creator), creator, "read", place.resource))
    throw new ShareAccessError("not_found");
  let access: string | null = null;
  if (row.password_hash) {
    if (credentials.access && (await hasAccess(db, row, credentials.access))) access = credentials.access;
    else if (!credentials.password) throw new ShareAccessError("password_required");
    else if (row.locked_until && new Date(row.locked_until).getTime() > Date.now())
      throw new ShareAccessError("locked");
    else if (!(await verifyPassword(credentials.password, row.password_hash))) {
      await db.query(
        `update share_links set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= $2 then now() + make_interval(mins => $3) else locked_until end
         where id = $1`,
        [row.id, MAX_FAILED_ATTEMPTS, LOCK_MINUTES],
      );
      throw new ShareAccessError("wrong_password");
    } else {
      await db.query("update share_links set failed_attempts = 0, locked_until = null where id = $1", [row.id]);
      access = await issueAccess(db, row);
    }
  }
  return { row, creator, place, access };
}

/** Files a link exposes: one file, a folder and its subfolders, or a whole project. */
function scopeFilter(row: LinkRow) {
  if (row.resource_type === "file") return { sql: "f.id = $2", param: row.file_id };
  if (row.resource_type === "project") return { sql: "f.project_id = $2", param: row.project_id };
  return {
    sql: `f.folder_id in (with recursive tree(id) as (
            select $2::uuid union all select c.id from folders c join tree on c.parent_id = tree.id)
          select id from tree)`,
    param: row.folder_id,
  };
}

async function scopedFiles(db: Db, row: LinkRow) {
  const scope = scopeFilter(row);
  return fromRows<FileMeta>(
    await db.query(
      `select ${columns.fileMeta} from files f
       where f.workspace_id = $1 and not f.deleted and ${scope.sql} order by f.name`,
      [row.workspace_id, scope.param],
    ),
  );
}

export type PublicFile = Pick<FileMeta, "id" | "name" | "mime" | "size" | "updatedAt" | "previewStatus"> & {
  hasBinary: boolean;
};
const publicFile = (f: FileMeta): PublicFile => ({
  id: f.id, name: f.name, mime: f.mime, size: f.size, updatedAt: f.updatedAt,
  previewStatus: f.previewStatus, hasBinary: !!f.storageKey,
});

/** The landing view of a link. Counts a view. */
export async function publicView(db: Db, token: string, credentials: { password?: string | null; access?: string | null }) {
  const { row, creator, place, access } = await open(db, token, credentials);
  await db.query(
    "update share_links set view_count = view_count + 1, last_viewed_at = now() where id = $1",
    [row.id],
  );
  const [workspace] = await db.query<{ name: string }>("select name from workspaces where id = $1", [row.workspace_id]);
  return {
    kind: row.resource_type,
    name: place.name,
    workspace: workspace.name,
    sharedBy: creator.name,
    allowDownload: row.allow_download,
    expiresAt: iso(row.expires_at),
    access,
    files: (await scopedFiles(db, row)).map(publicFile),
  };
}

/** One file inside a link's scope, with its body for native documents. */
export async function publicFileDetail(
  db: Db, token: string, fileId: string, credentials: { password?: string | null; access?: string | null },
) {
  const { row } = await open(db, token, credentials);
  const scope = scopeFilter(row);
  const [file] = await db.query(
    `select ${columns.fileMeta}, content, preview_key as "previewKey" from files f
     where f.workspace_id = $1 and not f.deleted and ${scope.sql} and f.id = $3`,
    [row.workspace_id, scope.param, fileId],
  );
  if (!file) throw new ShareAccessError("not_found");
  const record = fromRow<FileRecord & { previewKey: string | null }>(file);
  return { file: record, allowDownload: row.allow_download };
}
