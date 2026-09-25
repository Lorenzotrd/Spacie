import { requirePermission } from "../permissions";
import { loadFile, record, required, type CommandContext } from "./context";
import type { CommandResult } from "./schema";

const MAX_COMMENT = 10_000;

export async function createComment(ctx: CommandContext): Promise<CommandResult> {
  const { tx, actor, access, c } = ctx;
  const file = await loadFile(tx, actor.workspaceId, required(c.id, "File"));
  if (!file) throw new Error("File not found");
  if (file.deleted) throw new Error("File is in trash");
  requirePermission(access, actor, "comment", file);
  const content = required(c.content?.trim(), "Comment");
  if (content.length > MAX_COMMENT) throw new Error("Comment is too long");
  if (c.parentId) {
    const [parent] = await tx.query(
      "select 1 from comments where id = $1 and file_id = $2",
      [c.parentId, file.id],
    );
    if (!parent) throw new Error("Reply does not belong to this file.");
  }
  const [comment] = await tx.query<{ id: string }>(
    `insert into comments (workspace_id, file_id, parent_id, actor_id, content)
     values ($1, $2, $3, $4, $5) returning id`,
    [actor.workspaceId, file.id, c.parentId ?? null, actor.id, content],
  );
  await record(ctx, "commented on", file.name, { projectId: file.projectId, fileId: file.id });
  return { id: comment.id };
}

/** resolve_comment toggles resolution; react_comment toggles the actor's reaction. */
export async function toggleComment(ctx: CommandContext): Promise<CommandResult> {
  const { tx, actor, access, c } = ctx;
  const [comment] = await tx.query<{ id: string; file_id: string }>(
    "select id, file_id from comments where id = $1 and workspace_id = $2",
    [required(c.id, "Comment"), actor.workspaceId],
  );
  if (!comment) throw new Error("Comment not found");
  const file = (await loadFile(tx, actor.workspaceId, comment.file_id))!;
  if (file.deleted) throw new Error("File is in trash");
  requirePermission(access, actor, "comment", file);
  if (c.action === "resolve_comment")
    await tx.query("update comments set resolved = not resolved where id = $1", [comment.id]);
  else {
    const removed = await tx.query(
      "delete from comment_reactions where comment_id = $1 and principal_id = $2 returning 1",
      [comment.id, actor.id],
    );
    if (!removed.length)
      await tx.query(
        "insert into comment_reactions (comment_id, principal_id) values ($1, $2)",
        [comment.id, actor.id],
      );
  }
  await record(
    ctx,
    c.action === "resolve_comment" ? "resolved comment on" : "reacted to",
    file.name,
    { projectId: file.projectId, fileId: file.id },
  );
  return { id: comment.id };
}
