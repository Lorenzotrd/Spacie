import type { Db } from "./client";
import type { WorkspaceState } from "../types";

/**
 * Inserts a full workspace snapshot (the seed or the legacy JSON demo store).
 * Rows are ordered so parents always exist before children.
 */
export async function importSnapshot(db: Db, s: WorkspaceState) {
  const wid = s.workspace.id;
  // Listings sort by creation time: one millisecond apart keeps the snapshot's order.
  const base = Date.now() - 60_000;
  const at = (i: number) => new Date(base + i).toISOString();
  await db.transaction(async (tx) => {
    await tx.query(
      "insert into workspaces (id, name, slug, revision) values ($1, $2, $3, $4)",
      [wid, s.workspace.name, s.workspace.slug, s.revision || 1],
    );
    for (const [i, p] of s.principals.entries())
      await tx.query(
        `insert into principals (id, workspace_id, type, name, initials, color, provider, status, role, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [p.id, wid, p.type, p.name, p.initials, p.color, p.provider ?? null, p.status,
          p.type === "human" ? (p.role ?? "member") : null, at(i)],
      );
    for (const [i, p] of s.projects.entries())
      await tx.query(
        `insert into projects (id, workspace_id, name, description, instructions, color, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, wid, p.name, p.description, p.instructions ?? "", p.color, at(i)],
      );
    const pending = [...s.folders];
    const inserted = new Set<string>();
    while (pending.length) {
      const index = pending.findIndex((f) => !f.parentId || inserted.has(f.parentId));
      if (index < 0) throw new Error("Folder tree contains an orphan or a cycle.");
      const [f] = pending.splice(index, 1);
      await tx.query(
        `insert into folders (id, workspace_id, project_id, parent_id, name, created_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [f.id, wid, f.projectId, f.parentId, f.name, at(s.folders.indexOf(f))],
      );
      inserted.add(f.id);
    }
    for (const f of s.files)
      await tx.query(
        `insert into files (id, workspace_id, project_id, folder_id, name, mime, size, content, storage_key,
           version, deleted, updated_by, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [f.id, wid, f.projectId, f.folderId, f.name, f.mime, f.size, f.content, f.storageKey ?? null,
          f.version, f.deleted, f.updatedBy, f.updatedAt],
      );
    for (const v of s.versions)
      await tx.query(
        `insert into file_versions (id, workspace_id, file_id, number, content, storage_key, actor_id, message, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [v.id, wid, v.fileId, v.number, v.content, v.storageKey ?? null, v.actorId, v.message, v.createdAt],
      );
    const comments = [...s.comments].sort(
      (a, b) => Number(!!a.parentId) - Number(!!b.parentId),
    );
    for (const c of comments) {
      await tx.query(
        `insert into comments (id, workspace_id, file_id, parent_id, actor_id, content, resolved, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [c.id, wid, c.fileId, c.parentId, c.actorId, c.content, c.resolved, c.createdAt],
      );
      for (const principalId of c.reactions)
        await tx.query(
          "insert into comment_reactions (comment_id, principal_id) values ($1, $2) on conflict do nothing",
          [c.id, principalId],
        );
    }
    for (const a of s.activity)
      await tx.query(
        `insert into activity_events (id, workspace_id, actor_id, project_id, file_id, action, name, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [a.id, wid, a.actorId, a.projectId, a.fileId, a.action, a.name, a.createdAt],
      );
    for (const g of s.grants)
      await tx.query(
        `insert into grants (id, workspace_id, principal_id, resource_type, resource_id, allow, full_access)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [g.id, wid, g.principalId, g.resourceType, g.resourceId, g.allow, g.fullAccess],
      );
    for (const t of s.tokens)
      await tx.query(
        `insert into agent_tokens (id, workspace_id, principal_id, token_hash, expires_at, revoked_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [t.id, wid, t.principalId, t.hash, t.expiresAt, t.revokedAt],
      );
  });
}
