import type { Db } from "./db/client";
import { columns, fromRows } from "./db/rows";
import { can, type AccessContext } from "./permissions";
import type { Folder, Grant, Principal, Project } from "./types";

/** Loads the folder tree and the actor's grants: enough to decide any permission. */
export async function loadAccess(
  db: Db,
  actor: Principal,
): Promise<AccessContext> {
  const folders = fromRows<Folder>(
    await db.query(
      `select ${columns.folder} from folders where workspace_id = $1 order by created_at, name`,
      [actor.workspaceId],
    ),
  );
  const grants = fromRows<Grant>(
    await db.query(
      `select ${columns.grant} from grants where principal_id = $1 and workspace_id = $2`,
      [actor.id, actor.workspaceId],
    ),
  );
  return { workspace: { id: actor.workspaceId }, folders, grants };
}

export async function loadProjects(db: Db, workspaceId: string) {
  return fromRows<Project>(
    await db.query(
      `select ${columns.project} from projects where workspace_id = $1 order by created_at, name`,
      [workspaceId],
    ),
  );
}

/**
 * Readability depends only on a file's location, so a principal's view is fully
 * described by the projects whose root it can read and the folders it can read.
 */
export type ReadableScope = {
  projects: Project[];
  folders: Folder[];
  projectIds: string[];
  folderIds: string[];
};

export function readableScope(
  ctx: AccessContext,
  actor: Principal,
  projects: Project[],
): ReadableScope {
  const workspaceId = ctx.workspace.id;
  const readableProjects = projects.filter((p) =>
    can(ctx, actor, "read", { workspaceId, projectId: p.id }),
  );
  const readableFolders = ctx.folders.filter((f) =>
    can(ctx, actor, "read", { workspaceId, projectId: f.projectId, folderId: f.id }),
  );
  return {
    projects: readableProjects,
    folders: readableFolders,
    projectIds: readableProjects.map((p) => p.id),
    folderIds: readableFolders.map((f) => f.id),
  };
}

/** SQL predicate over `files f`; binds the scope's ids at the given parameter positions. */
export const visibleFiles = (projectParam: number, folderParam: number) =>
  `((f.folder_id is null and f.project_id = any($${projectParam}::uuid[])) or f.folder_id = any($${folderParam}::uuid[]))`;
