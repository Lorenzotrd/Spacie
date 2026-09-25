import { z } from "zod";
import { failure } from "@/lib/http";
import { authenticate } from "@/lib/auth";
import { fileDetail, versionContent } from "@/lib/queries";
import { db } from "@/lib/db/client";
export const runtime = "nodejs";
const params = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive().optional(),
});
/** `?id=` returns the file body, comments and version list; `&version=N` one snapshot's body. */
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    const url = new URL(request.url);
    const input = params.parse({
      id: url.searchParams.get("id"),
      version: url.searchParams.get("version") ?? undefined,
    });
    const database = await db();
    const body =
      input.version === undefined
        ? await fileDetail(database, actor, input.id)
        : await versionContent(database, actor, input.id, input.version).then(
            (content) => (content === null ? null : { content }),
          );
    if (!body) throw new Error("File not found");
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
