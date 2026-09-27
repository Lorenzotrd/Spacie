import type { Db } from "../db/client";
import { loadAccess } from "../access";
import type { Principal } from "../types";
import type { CommandContext } from "./context";
import { createComment, toggleComment } from "./comments";
import { createEntry, fileCommand } from "./files";
import { agentCredentials, createProject, share } from "./members";
import { updateAgent } from "./agents";
import type { Command, CommandResult } from "./schema";

export { commandSchema } from "./schema";
export type { Command, CommandResult } from "./schema";
export { DOCUMENT_MIME } from "./files";

const handlers: Record<Command["action"], (ctx: CommandContext) => Promise<CommandResult>> = {
  create_project: createProject,
  connect_agent: agentCredentials,
  rotate_token: agentCredentials,
  disconnect_agent: agentCredentials,
  update_agent: updateAgent,
  share,
  create_folder: createEntry,
  create_document: createEntry,
  upload_asset: createEntry,
  create_comment: createComment,
  resolve_comment: toggleComment,
  react_comment: toggleComment,
  update_document: fileCommand,
  rename_file: fileCommand,
  move_file: fileCommand,
  delete_file: fileCommand,
  restore_file: fileCommand,
  restore_version: fileCommand,
};

/**
 * Runs one validated command for a human or an agent, in a single transaction.
 * Bumping the workspace revision first locks that row, so commands on the same
 * workspace are serialized across server instances and every check below reads
 * committed state. A failed command rolls back, revision included.
 */
export async function execute(
  db: Db,
  actor: Principal,
  command: Command,
): Promise<CommandResult> {
  return db.transaction(async (tx) => {
    const [workspace] = await tx.query(
      "update workspaces set revision = revision + 1 where id = $1 returning id",
      [actor.workspaceId],
    );
    if (!workspace) throw new Error("UNAUTHORIZED");
    const [current] = await tx.query<{ status: string }>(
      "select status from principals where id = $1 and workspace_id = $2",
      [actor.id, actor.workspaceId],
    );
    if (!current || (actor.type === "agent" && current.status === "offline"))
      throw new Error("UNAUTHORIZED");
    const access = await loadAccess(tx, actor);
    return handlers[command.action]({ tx, actor, access, c: command });
  });
}
