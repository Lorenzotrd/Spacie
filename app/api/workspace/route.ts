import { boundedRequest, failure } from "@/lib/http";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { publicState, execute, commandSchema } from "@/lib/service";
import { transaction } from "@/lib/repository";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { state, actor } = await authenticate(request);
    return Response.json(publicState(state, actor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { state, actor } = await authenticate(request);
    await rateLimit(actor.id);
    const command = commandSchema.parse(
      await (await boundedRequest(request, 2100000)).json(),
    );
    if (command.action === "upload_asset")
      throw new Error("Use the authenticated asset upload endpoint.");
    const result = await transaction(state.workspace.id, (s) =>
      execute(s, actor, command),
    );
    return Response.json(result);
  } catch (e) {
    return failure(e);
  }
}
