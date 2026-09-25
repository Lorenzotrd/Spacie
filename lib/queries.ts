import type { Db } from "./db/client";
import { columns, fromRow, fromRows } from "./db/rows";
import {
  loadAccess,
  loadProjects,
  readableScope,
  visibleFiles,
  type ReadableScope,
} from "./access";
import { can, type AccessContext } from "./permissions";
import { demo, objectStorage } from "./config";
import type {
  Activity,
  Comment,
  FileDetail,
  FileMeta,
  FileRecord,
  Grant,
  Principal,
  PublicState,
  VersionMeta,
} from "./types";

const ACTIVITY_LIMIT = 100;
const VERSION_LIMIT = 200;
const SEARCH_LIMIT = 50;

async function scopeFor(db: Db, actor: Principal) {
  const ctx = await loadAccess(db, actor);
  const scope = readableScope(ctx, actor, await loadProjects(db, actor.workspaceId));
  return { ctx, scope };
}

export async function workspaceRevision(db: Db, workspaceId: string) {
  const [row] = await db.query<{ revision: number }>(
    "select revision from workspaces where id = $1",
    [workspaceId],
  );
  if (!row) throw new Error("Workspace not found");
  return Number(row.revision);
}

async function visibleActivity(
  db: Db,
  actor: Principal,
  ctx: AccessContext,
  scope: ReadableScope,
  projectId?: string,
) {
  const admin = can(ctx, actor, "manage_members", { workspaceId: actor.workspaceId });
  return fromRows<Activity>(
    await db.query(
      `select ${columns.activity} from activity_events a
       where a.workspace_id = $1
         and ($5::uuid is null or a.project_id = $5)
         and ((a.file_id is not null and exists (
                 select 1 from files f where f.id = a.file_id and ${visibleFiles(2, 3)}))
           or (a.file_id is null and a.project_id = any($2::uuid[]))
           or (a.file_id is null and a.project_id is null and $4::boolean))
       order by a.created_at desc limit ${ACTIVITY_LIMIT}`,
      [actor.workspaceId, scope.projectIds, scope.folderIds, admin, projectId ?? null],
    ),
  );
}

/** Everything the workspace UI lists, without document bodies, versions, or comments. */
export async function snapshot(db: Db, actor: Principal): Promise<PublicState> {
  const wid = actor.workspaceId;
  const [workspace] = await db.query<{ id: string; name: string; slug: string; revision: number }>(
    "select id, name, slug, revision from workspaces where id = $1",
    [wid],
  );
  if (!workspace) throw new Error("Workspace not found");
  const { ctx, scope } = await scopeFor(db, actor);
  const principals = fromRows<Principal>(
    await db.query(
      `select ${columns.principal} from principals where workspace_id = $1
       order by type = 'agent', created_at, name`,
      [wid],
    ),
  );
  const files = fromRows<FileMeta>(
    await db.query(
      `select ${columns.fileMeta} from files f
       where f.workspace_id = $1 and ${visibleFiles(2, 3)} order by f.updated_at desc`,
      [wid, scope.projectIds, scope.folderIds],
    ),
  );
  const admin = can(ctx, actor, "manage_members", { workspaceId: wid });
  const grants = admin
    ? fromRows<Grant>(
        await db.query(`select ${columns.grant} from grants where workspace_id = $1`, [wid]),
      )
    : ctx.grants;
  return {
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    revision: Number(workspace.revision),
    currentPrincipalId: actor.id,
    demo: demo(),
    directUploads: objectStorage(),
    principals,
    projects: scope.projects,
    folders: scope.folders,
    files,
    activity: await visibleActivity(db, actor, ctx, scope),
    grants,
  };
}

/** A file the actor can read, or null. Deleted files are returned: callers decide. */
export async function findReadableFile(
  db: Db,
  actor: Principal,
  id: string,
): Promise<FileRecord | null> {
  const [row] = await db.query(
    `select ${columns.fileMeta}, content from files where id = $1 and workspace_id = $2`,
    [id, actor.workspaceId],
  );
  if (!row) return null;
  const file = fromRow<FileRecord>(row);
  return can(await loadAccess(db, actor), actor, "read", file) ? file : null;
}

export async function fileDetail(
  db: Db,
  actor: Principal,
  id: string,
): Promise<FileDetail | null> {
  const file = await findReadableFile(db, actor, id);
  if (!file) return null;
  const comments = fromRows<Comment>(
    await db.query(
      `select ${columns.comment} from comments c where c.file_id = $1 order by c.created_at`,
      [id],
    ),
  );
  const versions = fromRows<VersionMeta>(
    await db.query(
      `select ${columns.versionMeta} from file_versions where file_id = $1
       order by number desc limit ${VERSION_LIMIT}`,
      [id],
    ),
  );
  return { file, comments, versions };
}

export async function versionContent(
  db: Db,
  actor: Principal,
  fileId: string,
  number: number,
) {
  if (!(await findReadableFile(db, actor, fileId))) return null;
  const [row] = await db.query<{ content: string }>(
    "select content from file_versions where file_id = $1 and number = $2",
    [fileId, number],
  );
  return row ? row.content : null;
}

export async function listFiles(
  db: Db,
  actor: Principal,
  filter: { projectId?: string; folderId?: string | null } = {},
) {
  const { scope } = await scopeFor(db, actor);
  return fromRows<FileMeta>(
    await db.query(
      `select ${columns.fileMeta} from files f
       where f.workspace_id = $1 and not f.deleted and ${visibleFiles(2, 3)}
         and ($4::uuid is null or f.project_id = $4)
         and ($5::boolean or f.folder_id is not distinct from $6::uuid)
       order by f.name`,
      [actor.workspaceId, scope.projectIds, scope.folderIds, filter.projectId ?? null,
        filter.folderId === undefined, filter.folderId ?? null],
    ),
  );
}

/** Prefix-matching full-text query built from word characters only. */
export function toPrefixQuery(text: string) {
  const words = text.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.slice(0, 8).map((w) => `${w.toLowerCase()}:*`).join(" & ");
}

/** Matches file names, document text, and comment text within the actor's scope. */
export async function searchFiles(
  db: Db,
  actor: Principal,
  text: string,
  projectId?: string,
) {
  const query = toPrefixQuery(text);
  if (!query) return [];
  const { scope } = await scopeFor(db, actor);
  const like = `%${text.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return fromRows<FileMeta>(
    await db.query(
      `select ${columns.fileMeta} from files f
       where f.workspace_id = $1 and not f.deleted and ${visibleFiles(2, 3)}
         and ($4::uuid is null or f.project_id = $4)
         and (f.search @@ to_tsquery('simple', $5)
           or f.name ilike $6
           or exists (select 1 from comments c where c.file_id = f.id
                      and to_tsvector('simple', c.content) @@ to_tsquery('simple', $5)))
       order by f.updated_at desc limit ${SEARCH_LIMIT}`,
      [actor.workspaceId, scope.projectIds, scope.folderIds, projectId ?? null, query, like],
    ),
  );
}

export async function activityFeed(db: Db, actor: Principal, projectId?: string) {
  const { ctx, scope } = await scopeFor(db, actor);
  return visibleActivity(db, actor, ctx, scope, projectId);
}
