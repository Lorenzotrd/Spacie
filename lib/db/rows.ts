import type { Row } from "./client";

/** Column lists aliased to the domain types in lib/types.ts. */
export const columns = {
  principal: `id, workspace_id as "workspaceId", type, name, initials, color, provider, status, role`,
  project: `id, workspace_id as "workspaceId", name, description, color`,
  folder: `id, workspace_id as "workspaceId", project_id as "projectId", parent_id as "parentId", name`,
  fileMeta: `id, workspace_id as "workspaceId", project_id as "projectId", folder_id as "folderId", name, mime, size,
    updated_by as "updatedBy", updated_at as "updatedAt", version, deleted, storage_key as "storageKey",
    preview_status as "previewStatus"`,
  versionMeta: `id, file_id as "fileId", number, storage_key as "storageKey", size, mime,
    actor_id as "actorId", created_at as "createdAt", message`,
  comment: `c.id, c.file_id as "fileId", c.parent_id as "parentId", c.actor_id as "actorId", c.content,
    c.created_at as "createdAt", c.resolved,
    coalesce((select array_agg(r.principal_id order by r.created_at) from comment_reactions r where r.comment_id = c.id), '{}') as reactions`,
  activity: `id, actor_id as "actorId", project_id as "projectId", file_id as "fileId", action, name,
    created_at as "createdAt"`,
  grant: `id, principal_id as "principalId", resource_type as "resourceType", resource_id as "resourceId",
    allow, full_access as "fullAccess"`,
} as const;

/** Qualifies each column of a column list with a table alias: `p.id, p.workspace_id as "workspaceId"`. */
export function prefixed(alias: string, list: string) {
  return list
    .split(",")
    .map((c) => `${alias}.${c.trim()}`)
    .join(", ");
}

/** Optional domain fields are omitted rather than serialized as null. */
const optional = new Set(["provider", "role", "storageKey"]);

/** Converts driver values (Date, null optionals) into plain JSON-safe domain objects. */
export function fromRow<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null && optional.has(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out as T;
}

export const fromRows = <T>(rows: Row[]) => rows.map((r) => fromRow<T>(r));
