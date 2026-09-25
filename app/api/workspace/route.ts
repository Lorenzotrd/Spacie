import { boundedRequest, failure } from "@/lib/http";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { execute, commandSchema } from "@/lib/service";
import { snapshot, workspaceRevision } from "@/lib/queries";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
/** `?since=<revision>` answers `{ unchanged: true }` cheaply when nothing moved. */
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    const database = await db();
    const since = new URL(request.url).searchParams.get("since");
    if (since !== null) {
      const revision = await workspaceRevision(database, actor.workspaceId);
      if (String(revision) === since)
        return Response.json({ unchanged: true, revision }, { headers: noStore });
    }
    return Response.json(await snapshot(database, actor), { headers: noStore });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    await rateLimit(actor.id);
    const command = commandSchema.parse(
      await (await boundedRequest(request, 2100000)).json(),
    );
    if (command.action === "upload_asset")
      throw new Error("Use the authenticated asset upload endpoint.");
    return Response.json(await execute(await db(), actor, command));
  } catch (e) {
    return failure(e);
  }
}
