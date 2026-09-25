import { boundedRequest } from "@/lib/http";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { touchPresence, readPresence } from "@/lib/presence";
import { requirePermission, can } from "@/lib/permissions";
import { z } from "zod";
import { failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { state, actor } = await authenticate(request);
    const input = z
      .object({
        resourceId: z.string().uuid().nullable(),
        state: z.enum(["viewing", "editing", "working", "idle"]),
      })
      .parse(await (await boundedRequest(request, 10000)).json());
    if (input.resourceId) {
      const file = state.files.find(
        (f) => f.id === input.resourceId && !f.deleted,
      );
      if (!file) throw new Error("File not found");
      requirePermission(
        state,
        actor,
        input.state === "editing" ? "write" : "read",
        file,
      );
    }
    await touchPresence(state.workspace.id, {
      principalId: actor.id,
      ...input,
      lastSeenAt: new Date().toISOString(),
    });
    const entries = await readPresence(state.workspace.id);
    return Response.json(
      entries.filter(
        (e) =>
          !e.resourceId ||
          state.files.some(
            (f) => f.id === e.resourceId && can(state, actor, "read", f),
          ),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
