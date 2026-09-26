import { agentAccess, permissionsFor } from "../access-levels";
import { fromRows, columns } from "../db/rows";
import { requirePermission } from "../permissions";
import type { Grant } from "../types";
import { destination, record, required, type CommandContext } from "./context";
import type { CommandResult } from "./schema";

/**
 * update_agent: changes a connected agent's level, projects and public-link right.
 * Omitted fields keep their current value. Grants are rewritten as a whole, and
 * permissions are re-read on every request, so the change applies immediately.
 */
export async function updateAgent(ctx: CommandContext): Promise<CommandResult> {
  const { tx, actor, access, c } = ctx;
  if (actor.type !== "human") throw new Error("FORBIDDEN: Only people can change an agent's access.");
  requirePermission(access, actor, "manage_members", { workspaceId: actor.workspaceId });
  const [agent] = await tx.query<{ id: string; name: string; status: string }>(
    "select id, name, status from principals where id = $1 and workspace_id = $2 and type = 'agent'",
    [required(c.id, "Agent"), actor.workspaceId],
  );
  if (!agent) throw new Error("Agent not found");
  if (agent.status === "offline") throw new Error("This agent is disconnected. Connect it again first.");

  const current = agentAccess(
    fromRows<Grant>(
      await tx.query(`select ${columns.grant} from grants where principal_id = $1 and workspace_id = $2`, [
        agent.id,
        actor.workspaceId,
      ]),
    ),
    agent.id,
  );
  const allProjects = c.fullAccess ?? (c.scope ? false : current.allProjects);
  const projectIds = [...new Set(c.scope ?? current.projectIds)];
  if (!allProjects && !projectIds.length) throw new Error("Select at least one project.");
  for (const projectId of projectIds) await destination(tx, access, projectId, null);
  const allow = permissionsFor(c.access ?? current.level, c.allowPublish ?? current.publish);

  await tx.query("delete from grants where principal_id = $1", [agent.id]);
  if (allProjects)
    await tx.query(
      `insert into grants (workspace_id, principal_id, resource_type, resource_id, allow, full_access)
       values ($1, $2, 'workspace', $1, $3, false)`,
      [actor.workspaceId, agent.id, allow],
    );
  else
    for (const projectId of projectIds)
      await tx.query(
        `insert into grants (workspace_id, principal_id, resource_type, resource_id, allow, full_access)
         values ($1, $2, 'project', $3, $4, false)`,
        [actor.workspaceId, agent.id, projectId, allow],
      );
  await record(ctx, "updated access for", agent.name);
  return { id: agent.id };
}
