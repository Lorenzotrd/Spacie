import { z } from "zod";
import { boundedRequest, failure } from "@/lib/http";
import { assertSameOrigin, authenticate } from "@/lib/auth";
import { readCookie, SESSION_COOKIE } from "@/lib/accounts";
import { createWorkspace, listWorkspaces, renameWorkspace, switchWorkspace } from "@/lib/workspaces";
import { agentDefaults, setAgentDefaults } from "@/lib/agent-defaults";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";

/** The workspaces the signed-in person belongs to, with the open one marked. */
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    return Response.json(await listWorkspaces(await db(), actor), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("switch"), id: z.string().uuid() }),
  z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("rename"), name: z.string().trim().min(1).max(80) }),
  agentDefaults.extend({ action: z.literal("agent_defaults") }),
]);

/** Switches, creates or renames a workspace, or sets its defaults for new agents. People only. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    const session = readCookie(request, SESSION_COOKIE);
    if (!session || request.headers.get("authorization"))
      throw new Error("FORBIDDEN: Sign in with your account to change workspaces.");
    await rateLimit(actor.id);
    const body = command.parse(await (await boundedRequest(request, 10_000)).json());
    const database = await db();
    switch (body.action) {
      case "switch":
        return Response.json(await switchWorkspace(database, actor, session, body.id));
      case "create":
        return Response.json(await createWorkspace(database, actor, session, body.name));
      case "rename":
        return Response.json(await renameWorkspace(database, actor, body.name));
      case "agent_defaults":
        return Response.json(await setAgentDefaults(database, actor, agentDefaults.parse(body)));
    }
  } catch (e) {
    return failure(e);
  }
}
