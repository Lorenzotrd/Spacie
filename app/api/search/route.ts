import { z } from "zod";
import { failure } from "@/lib/http";
import { authenticate } from "@/lib/auth";
import { searchFiles } from "@/lib/queries";
import { db } from "@/lib/db/client";
export const runtime = "nodejs";
const params = z.object({
  q: z.string().max(500),
  projectId: z.string().uuid().optional(),
});
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    const url = new URL(request.url);
    const input = params.parse({
      q: url.searchParams.get("q") ?? "",
      projectId: url.searchParams.get("projectId") ?? undefined,
    });
    return Response.json(
      await searchFiles(await db(), actor, input.q, input.projectId),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
