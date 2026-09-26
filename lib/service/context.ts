import type { Db } from "../db/client";
import { columns, fromRow } from "../db/rows";
import type { AccessContext } from "../permissions";
import type { FileRecord, Principal } from "../types";
import type { Command } from "./schema";

/** Everything a command handler runs with, inside one database transaction. */
export type CommandContext = {
  tx: Db;
  actor: Principal;
  access: AccessContext;
  c: Command;
};

export function required<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === "")
    throw new Error(`${label} is required`);
  return value;
}

export async function record(
  { tx, actor }: CommandContext,
  action: string,
  name: string,
  target: { projectId?: string | null; fileId?: string | null } = {},
) {
  await tx.query(
    `insert into activity_events (workspace_id, actor_id, project_id, file_id, action, name)
     values ($1, $2, $3, $4, $5, $6)`,
    [actor.workspaceId, actor.id, target.projectId ?? null, target.fileId ?? null, action, name],
  );
}

/** Appends an immutable snapshot of the file's current state. */
export async function saveVersion(
  { tx, actor }: CommandContext,
  file: FileRecord,
  message: string,
) {
  await tx.query(
    `insert into file_versions (workspace_id, file_id, number, content, storage_key, size, mime, actor_id, message)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [actor.workspaceId, file.id, file.version, file.content, file.storageKey ?? null, file.size, file.mime, actor.id, message],
  );
}

export async function loadFile(tx: Db, workspaceId: string, id: string) {
  const [row] = await tx.query(
    `select ${columns.fileMeta}, content from files where id = $1 and workspace_id = $2`,
    [id, workspaceId],
  );
  return row ? fromRow<FileRecord>(row) : null;
}

/** Validates that a project (and optional folder in it) exists in the workspace. */
export async function destination(
  tx: Db,
  access: AccessContext,
  projectId: string,
  folderId: string | null,
) {
  const workspaceId = access.workspace.id;
  const [project] = await tx.query(
    "select 1 from projects where id = $1 and workspace_id = $2",
    [projectId, workspaceId],
  );
  if (!project) throw new Error("Project not found");
  if (
    folderId &&
    !access.folders.some((f) => f.id === folderId && f.projectId === projectId)
  )
    throw new Error("Folder not found");
  return { workspaceId, projectId, folderId };
}
