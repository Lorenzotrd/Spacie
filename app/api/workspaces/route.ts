import { z } from "zod";
import { boundedRequest, failure } from "@/lib/http";
import { assertSameOrigin, authenticate } from "@/lib/auth";
import { readCookie, SESSION_COOKIE } from "@/lib/accounts";
import { createWorkspace, listWorkspaces, switchWorkspace } from "@/lib/workspaces";
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
]);

/** Switches or creates a workspace for this browser session. People only. */
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
    return Response.json(
      body.action === "switch"
        ? await switchWorkspace(database, actor, session, body.id)
        : await createWorkspace(database, actor, session, body.name),
    );
  } catch (e) {
    return failure(e);
  }
}
