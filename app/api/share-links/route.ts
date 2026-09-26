import { z } from "zod";
import { assertSameOrigin, authenticate } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { boundedRequest, failure } from "@/lib/http";
import { publicOrigin } from "@/lib/oauth/metadata";
import { rateLimit } from "@/lib/rate-limit";
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
  shareOptions,
  shareTarget,
} from "@/lib/share-links";
export const runtime = "nodejs";

/** `?type=file|folder|project&id=` lists that resource's live public links. */
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    const url = new URL(request.url);
    const target = shareTarget.parse({ type: url.searchParams.get("type"), id: url.searchParams.get("id") });
    return Response.json(await listShareLinks(await db(), actor, target, publicOrigin(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}

const command = z.discriminatedUnion("action", [
  shareOptions.extend({ action: z.literal("create") }),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    await rateLimit(actor.id);
    const body = command.parse(await (await boundedRequest(request, 10_000)).json());
    const database = await db();
    return Response.json(
      body.action === "revoke"
        ? await revokeShareLink(database, actor, body.id)
        : await createShareLink(database, actor, body, publicOrigin(request)),
    );
  } catch (e) {
    return failure(e);
  }
}
