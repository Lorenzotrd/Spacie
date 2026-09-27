import type { Db } from "./db/client";
import { columns, fromRows } from "./db/rows";
import { loadAccess, loadProjects, readableScope, visibleFiles } from "./access";
import type { Comment, Principal, VersionMeta } from "./types";

const FEED_LIMIT = 100;

export type FeedKind = "comments" | "versions";
export type ProjectComment = Comment & { fileName: string };
export type ProjectVersion = VersionMeta & { fileName: string };

type Feed<K extends FeedKind> = K extends "comments" ? ProjectComment[] : ProjectVersion[];

/**
 * A project's latest comments or versions across the files the actor can read,
 * newest first. Trashed files are left out. Unknown or unreadable projects throw.
 */
export async function projectFeed<K extends FeedKind>(
  db: Db,
  actor: Principal,
  projectId: string,
  kind: K,
): Promise<Feed<K>> {
  const ctx = await loadAccess(db, actor);
  const scope = readableScope(ctx, actor, await loadProjects(db, actor.workspaceId));
  if (!scope.projects.some((p) => p.id === projectId)) throw new Error("Project not found");
  const params = [actor.workspaceId, scope.projectIds, scope.folderIds, projectId];
  const where = `f.workspace_id = $1 and f.project_id = $4 and not f.deleted and ${visibleFiles(2, 3)}`;
  if (kind === "comments")
    return fromRows<ProjectComment>(
      await db.query(
        `select ${columns.comment}, f.name as "fileName"
         from comments c join files f on f.id = c.file_id
         where ${where} order by c.created_at desc limit ${FEED_LIMIT}`,
        params,
      ),
    ) as Feed<K>;
  return fromRows<ProjectVersion>(
    await db.query(
      `select ${prefixed("v", columns.versionMeta)}, f.name as "fileName"
       from file_versions v join files f on f.id = v.file_id
       where ${where} order by v.created_at desc, v.number desc limit ${FEED_LIMIT}`,
      params,
    ),
  ) as Feed<K>;
}

/** Qualifies each column of a plain column list with a table alias. */
function prefixed(alias: string, list: string) {
  return list
    .split(",")
    .map((c) => `${alias}.${c.trim()}`)
    .join(", ");
}
