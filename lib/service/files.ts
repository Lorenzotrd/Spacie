import { can, requirePermission } from "../permissions";
import type { Action, FileRecord } from "../types";
import { needsPreview } from "../previews";
import {
  destination,
  loadFile,
  record,
  required,
  saveVersion,
  type CommandContext,
} from "./context";
import type { Command, CommandResult } from "./schema";

export const DOCUMENT_MIME = "application/x-spacie-doc";

/** create_folder, create_document, upload_asset. */
export async function createEntry(ctx: CommandContext): Promise<CommandResult> {
  const { tx, actor, access, c } = ctx;
  const projectId = required(c.projectId, "Project");
  const folderId = c.folderId ?? null;
  const target = await destination(tx, access, projectId, folderId);
  const permission: Action =
    c.action === "create_folder" ? "create_folder" : c.action === "upload_asset" ? "upload" : "create";
  requirePermission(access, actor, permission, target);
  const name = required(c.name, "Name");
  if (c.action === "create_folder") {
    const [folder] = await tx.query<{ id: string }>(
      `insert into folders (workspace_id, project_id, parent_id, name) values ($1, $2, $3, $4) returning id`,
      [actor.workspaceId, projectId, folderId, name],
    );
    await record(ctx, "created folder", name, { projectId });
    return { id: folder.id };
  }
  const upload = c.action === "upload_asset";
  if (upload && !c.storageKey)
    throw new Error("Upload must finish before creating the file.");
  const mime = upload ? required(c.mime, "File type") : DOCUMENT_MIME;
  if (upload) {
    const replaced = await uploadNewVersion(ctx, { projectId, folderId, name, mime });
    if (replaced) return replaced;
  }
  const [row] = await tx.query<{ id: string }>(
    `insert into files (workspace_id, project_id, folder_id, name, mime, size, content, storage_key, updated_by, preview_status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [actor.workspaceId, projectId, folderId, name, mime,
      c.size ?? 0, c.content ?? "", c.storageKey ?? null, actor.id,
      upload && needsPreview(mime) ? "pending" : "none"],
  );
  const file = (await loadFile(tx, actor.workspaceId, row.id))!;
  await saveVersion(ctx, file, upload ? "Uploaded asset" : "Created document");
  await record(ctx, upload ? "uploaded" : "created", name, { projectId, fileId: file.id });
  return { id: file.id };
}

/**
 * Re-uploading a file under the same name (case-insensitive) in the same folder adds a
 * version to it rather than a duplicate, when the uploader may edit that file.
 */
async function uploadNewVersion(
  ctx: CommandContext,
  place: { projectId: string; folderId: string | null; name: string; mime: string },
): Promise<CommandResult | null> {
  const { tx, actor, access, c } = ctx;
  const [row] = await tx.query<{ id: string }>(
    `select id from files
     where workspace_id = $1 and project_id = $2 and folder_id is not distinct from $3
       and lower(name) = lower($4) and not deleted and storage_key is not null and mime <> $5
     order by updated_at desc limit 1 for update`,
    [actor.workspaceId, place.projectId, place.folderId, place.name, DOCUMENT_MIME],
  );
  const existing = row && (await loadFile(tx, actor.workspaceId, row.id));
  if (!existing || !can(access, actor, "write", existing)) return null;
  await tx.query(
    `update files set storage_key = $3, size = $4, mime = $5, version = version + 1,
       preview_key = null, preview_status = $6, updated_by = $2, updated_at = now()
     where id = $1`,
    [existing.id, actor.id, c.storageKey, c.size ?? 0, place.mime, needsPreview(place.mime) ? "pending" : "none"],
  );
  const next = (await loadFile(tx, actor.workspaceId, existing.id))!;
  await saveVersion(ctx, next, "Uploaded a new version");
  await record(ctx, "uploaded a new version of", next.name, { projectId: next.projectId, fileId: next.id });
  return { id: next.id, version: next.version };
}

const permissionFor: Partial<Record<Command["action"], Action>> = {
  update_document: "write",
  rename_file: "rename",
  move_file: "move",
  delete_file: "delete",
  restore_file: "restore",
  restore_version: "restore",
};

const activityLabel: Partial<Record<Command["action"], string>> = {
  update_document: "edited",
  rename_file: "renamed",
  move_file: "moved",
  delete_file: "deleted",
  restore_file: "restored",
  restore_version: "restored a version of",
};

/** Applies the change and returns the file's new state. */
async function apply(ctx: CommandContext, f: FileRecord): Promise<FileRecord> {
  const { tx, actor, access, c } = ctx;
  const update = async (sql: string, params: unknown[]) => {
    await tx.query(
      `update files set ${sql}, updated_by = $2, updated_at = now() where id = $1`,
      [f.id, actor.id, ...params],
    );
    return (await loadFile(tx, actor.workspaceId, f.id))!;
  };
  switch (c.action) {
    case "update_document": {
      if (f.mime !== DOCUMENT_MIME)
        throw new Error("Only native documents can be edited.");
      if (c.baseVersion !== f.version)
        throw new Error("CONFLICT: This document changed. Reload before saving.");
      const next = await update("content = $3, version = version + 1", [
        required(c.content, "Content"),
      ]);
      await saveVersion(ctx, next, "Updated document");
      return next;
    }
    case "rename_file":
      return update("name = $3", [required(c.name, "Name")]);
    case "move_file": {
      const target = await destination(tx, access, required(c.projectId, "Project"), c.folderId ?? null);
      requirePermission(access, actor, "move", target);
      requirePermission(access, actor, "create", target);
      return update("project_id = $3, folder_id = $4", [target.projectId, target.folderId]);
    }
    case "delete_file":
      return update("deleted = true", []);
    case "restore_file":
      return update("deleted = false", []);
    case "restore_version": {
      const [version] = await tx.query<{
        number: number; content: string; storage_key: string | null; size: number | null; mime: string | null;
      }>(
        "select number, content, storage_key, size, mime from file_versions where file_id = $1 and number = $2",
        [f.id, c.version ?? null],
      );
      if (!version) throw new Error("Version not found");
      const mime = version.mime ?? f.mime;
      const next = await update(
        `content = $3, storage_key = $4, size = $5, mime = $6, version = version + 1,
         preview_key = null, preview_status = $7`,
        [version.content, version.storage_key, version.size ?? f.size, mime,
          version.storage_key && needsPreview(mime) ? "pending" : "none"],
      );
      await saveVersion(ctx, next, `Restored version ${version.number}`);
      return next;
    }
    default:
      throw new Error("Unsupported action");
  }
}

/** Commands that act on an existing file. */
export async function fileCommand(ctx: CommandContext): Promise<CommandResult> {
  const { tx, actor, access, c } = ctx;
  const f = await loadFile(tx, actor.workspaceId, required(c.id, "File"));
  if (!f) throw new Error("File not found");
  if (f.deleted && c.action !== "restore_file") throw new Error("File is in trash");
  const permission = permissionFor[c.action];
  if (!permission) throw new Error("Unsupported action");
  requirePermission(access, actor, permission, f);
  const next = await apply(ctx, f);
  await record(ctx, activityLabel[c.action] ?? c.action, next.name, {
    projectId: next.projectId,
    fileId: next.id,
  });
  return { id: next.id, version: next.version };
}
