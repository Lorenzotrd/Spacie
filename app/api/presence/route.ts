import { boundedRequest } from "@/lib/http";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { touchPresence, readPresence } from "@/lib/presence";
import { can, requirePermission } from "@/lib/permissions";
import { loadAccess } from "@/lib/access";
import { db } from "@/lib/db/client";
import { z } from "zod";
import { failure } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    const input = z
      .object({
        resourceId: z.string().uuid().nullable(),
        state: z.enum(["viewing", "editing", "working", "idle"]),
      })
      .parse(await (await boundedRequest(request, 10000)).json());
    const database = await db();
    const access = await loadAccess(database, actor);
    const locate = (ids: string[]) =>
      database.query<{ id: string; projectId: string; folderId: string | null }>(
        `select id, project_id as "projectId", folder_id as "folderId" from files
         where workspace_id = $1 and not deleted and id = any($2::uuid[])`,
        [actor.workspaceId, ids],
      );
    if (input.resourceId) {
      const [file] = await locate([input.resourceId]);
      if (!file) throw new Error("File not found");
      requirePermission(access, actor, input.state === "editing" ? "write" : "read", {
        workspaceId: actor.workspaceId,
        ...file,
      });
    }
    await touchPresence(actor.workspaceId, {
      principalId: actor.id,
      ...input,
      lastSeenAt: new Date().toISOString(),
    });
    const entries = await readPresence(actor.workspaceId);
    const files = await locate(
      entries.flatMap((e) => (e.resourceId ? [e.resourceId] : [])),
    );
    const readable = new Set(
      files
        .filter((f) => can(access, actor, "read", { workspaceId: actor.workspaceId, ...f }))
        .map((f) => f.id),
    );
    return Response.json(
      entries.filter((e) => !e.resourceId || readable.has(e.resourceId)),
    );
  } catch (e) {
    return failure(e);
  }
}
