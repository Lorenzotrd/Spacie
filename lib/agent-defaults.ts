import { z } from "zod";
import type { Db } from "./db/client";
import { loadAccess } from "./access";
import { requirePermission } from "./permissions";
import type { AgentDefaults, Principal } from "./types";

/** What a newly connected agent starts with. A default, never a rule: each agent can be changed later. */
export const agentDefaults = z.object({
  access: z.enum(["read", "comment", "write"]).default("write"),
  allowPublish: z.boolean().default(false),
  /** Agents get each project's instructions over MCP. */
  readInstructions: z.boolean().default(true),
}) satisfies z.ZodType<AgentDefaults, z.ZodTypeDef, unknown>;

export async function getAgentDefaults(db: Db, workspaceId: string): Promise<AgentDefaults> {
  const [row] = await db.query<{ agent_defaults: unknown }>("select agent_defaults from workspaces where id = $1", [
    workspaceId,
  ]);
  const parsed = agentDefaults.safeParse(row?.agent_defaults ?? {});
  return parsed.success ? parsed.data : agentDefaults.parse({});
}

export async function setAgentDefaults(db: Db, actor: Principal, input: unknown) {
  requirePermission(await loadAccess(db, actor), actor, "manage_members", { workspaceId: actor.workspaceId });
  const next = agentDefaults.parse(input);
  await db.query("update workspaces set agent_defaults = $2::jsonb, revision = revision + 1 where id = $1", [
    actor.workspaceId,
    JSON.stringify(next),
  ]);
  return next;
}
