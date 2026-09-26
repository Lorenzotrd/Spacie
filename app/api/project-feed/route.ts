import { z } from "zod";
import { failure } from "@/lib/http";
import { authenticate } from "@/lib/auth";
import { projectFeed } from "@/lib/project-feed";
import { db } from "@/lib/db/client";
export const runtime = "nodejs";
const params = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(["comments", "versions"]),
});
/** `?projectId=&kind=comments|versions`: the project's latest comments or versions, newest first. */
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    const url = new URL(request.url);
    const input = params.parse({
      projectId: url.searchParams.get("projectId"),
      kind: url.searchParams.get("kind"),
    });
    return Response.json(await projectFeed(await db(), actor, input.projectId, input.kind), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
