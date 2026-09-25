import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { boundedRequest, failure } from "@/lib/http";
import { audit } from "@/lib/audit";
import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { buildServer } from "@/lib/mcp/tools";
import { touchPresence } from "@/lib/presence";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
/** Base64 uploads are capped at 5 MB of bytes, about 7 MB encoded. */
const MAX_BODY = 7_500_000;
export async function POST(request: Request) {
  try {
    if (!request.headers.get("authorization")?.startsWith("Bearer "))
      return Response.json({ error: "Agent token required" }, { status: 401 });
    const { actor } = await authenticate(request);
    if (actor.type !== "agent") throw new Error("UNAUTHORIZED");
    await rateLimit(actor.id);
    await audit(actor.workspaceId, actor.id, "mcp_request");
    await touchPresence(actor.workspaceId, {
      principalId: actor.id,
      resourceId: null,
      state: "working",
      lastSeenAt: new Date().toISOString(),
    });
    const server = buildServer(await db(), actor);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return await transport.handleRequest(await boundedRequest(request, MAX_BODY));
  } catch (e) {
    return failure(e);
  }
}
export async function GET() {
  return Response.json(
    { error: "Use MCP Streamable HTTP POST with a bearer token." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
