import { requirePermission } from "../permissions";
import { hashToken, newToken, TOKEN_TTL_MS } from "../tokens";
import type { Action } from "../types";
import { actions } from "../types";
import {
  destination,
  record,
  required,
  type CommandContext,
} from "./context";
import type { CommandResult } from "./schema";

const DEFAULT_AGENT_PERMISSIONS: Action[] = ["read", "write", "create", "comment"];

export async function createProject(ctx: CommandContext): Promise<CommandResult> {
  const { tx, actor, access, c } = ctx;
  requirePermission(access, actor, "manage_members", { workspaceId: actor.workspaceId });
  const name = required(c.name, "Name");
  const [project] = await tx.query<{ id: string }>(
    `insert into projects (workspace_id, name, description, color)
     values ($1, $2, 'A new space for your next idea.', '#8a73d5') returning id`,
    [actor.workspaceId, name],
  );
  await record(ctx, "created", name, { projectId: project.id });
  return { id: project.id };
}

/** Admins edit a project's instructions for agents. */
export async function updateProject(ctx: CommandContext): Promise<CommandResult> {
  const { tx, actor, access, c } = ctx;
  requirePermission(access, actor, "manage_members", { workspaceId: actor.workspaceId });
  const id = required(c.projectId, "Project");
  const [project] = await tx.query<{ name: string }>(
    "update projects set instructions = $3 where id = $1 and workspace_id = $2 returning name",
    [id, actor.workspaceId, (c.instructions ?? "").trim()],
  );
  if (!project) throw new Error("Project not found");
  await record(ctx, "updated the AI instructions of", project.name, { projectId: id });
  return { id };
}

async function createAgent(ctx: CommandContext) {
  const { tx, actor, access, c } = ctx;
  const scopes = c.scope ?? [];
  if (!c.fullAccess && !scopes.length)
    throw new Error("Select at least one project.");
  for (const projectId of scopes) await destination(tx, access, projectId, null);
  const [agent] = await tx.query<{ id: string; name: string }>(
    `insert into principals (workspace_id, type, name, initials, color, provider, status)
     values ($1, 'agent', $2, '✳', '#9a81bc', $3, 'idle') returning id, name`,
    [actor.workspaceId, required(c.name, "Agent name"), c.provider ?? "Custom"],
  );
  if (c.fullAccess)
    await tx.query(
      `insert into grants (workspace_id, principal_id, resource_type, resource_id, allow, full_access)
       values ($1, $2, 'workspace', $1, $3, true)`,
      [actor.workspaceId, agent.id, actions],
    );
  else
    for (const projectId of new Set(scopes))
      await tx.query(
        `insert into grants (workspace_id, principal_id, resource_type, resource_id, allow, full_access)
         values ($1, $2, 'project', $3, $4, false)`,
        [actor.workspaceId, agent.id, projectId, c.permissions ?? DEFAULT_AGENT_PERMISSIONS],
      );
  return agent;
}

/** connect_agent, rotate_token, disconnect_agent: every path revokes live tokens first. */
export async function agentCredentials(ctx: CommandContext): Promise<CommandResult> {
  const { tx, actor, access, c } = ctx;
  requirePermission(access, actor, "manage_members", { workspaceId: actor.workspaceId });
  const agent =
    c.action === "connect_agent"
      ? await createAgent(ctx)
      : (
          await tx.query<{ id: string; name: string }>(
            "select id, name from principals where id = $1 and workspace_id = $2 and type = 'agent'",
            [c.id ?? null, actor.workspaceId],
          )
        )[0];
  if (!agent) throw new Error("Agent not found");
  await tx.query(
    "update agent_tokens set revoked_at = now() where principal_id = $1 and revoked_at is null",
    [agent.id],
  );
  await tx.query(
    "update oauth_refresh_tokens set revoked_at = now() where agent_id = $1 and revoked_at is null",
    [agent.id],
  );
  if (c.action === "disconnect_agent") {
    await tx.query("update principals set status = 'offline' where id = $1", [agent.id]);
    await record(ctx, "disconnected", agent.name);
    return { id: agent.id };
  }
  await tx.query("update principals set status = 'idle' where id = $1", [agent.id]);
  const token = newToken();
  await tx.query(
    `insert into agent_tokens (workspace_id, principal_id, token_hash, expires_at)
     values ($1, $2, $3, $4)`,
    [actor.workspaceId, agent.id, hashToken(token), new Date(Date.now() + TOKEN_TTL_MS).toISOString()],
  );
  await record(
    ctx,
    c.action === "connect_agent" ? "connected" : "rotated credentials for",
    agent.name,
  );
  return { id: agent.id, token };
}

export async function share(ctx: CommandContext): Promise<CommandResult> {
  requirePermission(ctx.access, ctx.actor, "manage_members", {
    workspaceId: ctx.actor.workspaceId,
  });
  throw new Error("Email invitations use the /api/invite endpoint.");
}
