import { z } from "zod";
import { assertSameOrigin, authenticate } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { boundedRequest, failure } from "@/lib/http";
import {
  approveAuthorization,
  clientRedirect,
  consentChoice,
  grantableActions,
  shareableProjects,
  validateAuthorization,
} from "@/lib/oauth/authorize";
import { publicOrigin } from "@/lib/oauth/metadata";
import { getAgentDefaults } from "@/lib/agent-defaults";
export const runtime = "nodejs";

async function signedInHuman(request: Request) {
  const { actor } = await authenticate(request);
  if (actor.type !== "human") throw new Error("FORBIDDEN: Sign in as a person to connect an app.");
  return actor;
}

/** Describes a pending authorization request for the consent screen. */
export async function GET(request: Request) {
  try {
    const human = await signedInHuman(request);
    const database = await db();
    const auth = await validateAuthorization(database, new URL(request.url).searchParams, publicOrigin(request));
    const [workspace] = await database.query<{ name: string }>(
      "select name from workspaces where id = $1",
      [human.workspaceId],
    );
    return Response.json(
      {
        client: { name: auth.client.name, redirectHost: new URL(auth.redirectUri).host },
        user: human.name,
        workspace: workspace.name,
        projects: (await shareableProjects(database, human)).map((p) => ({ id: p.id, name: p.name })),
        canShareAll: human.role === "owner" || human.role === "admin",
        canWrite: grantableActions(human).includes("write"),
        defaults: await getAgentDefaults(database, human.workspaceId),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

const decision = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("deny"), request: z.string().max(8000) }),
  z.object({ decision: z.literal("approve"), request: z.string().max(8000), choice: consentChoice }),
]);

/** Records the person's decision and returns where to send the browser. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const human = await signedInHuman(request);
    const body = decision.parse(await (await boundedRequest(request, 20_000)).json());
    const origin = publicOrigin(request);
    const database = await db();
    const auth = await validateAuthorization(database, new URLSearchParams(body.request), origin);
    if (body.decision === "deny")
      return Response.json({
        redirect: clientRedirect(auth, origin, {
          error: "access_denied",
          error_description: "The request was declined in Atelio.",
        }),
      });
    const code = await approveAuthorization(database, human, auth, body.choice);
    return Response.json({ redirect: clientRedirect(auth, origin, { code }) });
  } catch (e) {
    return failure(e);
  }
}
