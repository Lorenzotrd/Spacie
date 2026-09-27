import { z } from "zod";
import { assertSameOrigin, authenticate } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { boundedRequest, failure } from "@/lib/http";
import { publicOrigin } from "@/lib/oauth/metadata";
import { rateLimit } from "@/lib/rate-limit";
import {
  createShareLink,
  getLinkDefaults,
  linkDefaults,
  listShareLinks,
  listWorkspaceShareLinks,
  restoreShareLink,
  revokeShareLink,
  setLinkDefaults,
  shareOptions,
  shareTarget,
} from "@/lib/share-links";
export const runtime = "nodejs";

/**
 * `?type=file|folder|project&id=` lists that resource's live public links.
 * `?scope=workspace` lists every link in the workspace, with the defaults for new ones.
 */
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    const url = new URL(request.url);
    if (url.searchParams.get("scope") === "workspace") {
      const database = await db();
      const [links, defaults] = await Promise.all([
        listWorkspaceShareLinks(database, actor, publicOrigin(request)),
        getLinkDefaults(database, actor.workspaceId),
      ]);
      return Response.json({ links, defaults }, { headers: { "Cache-Control": "no-store" } });
    }
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
  z.object({ action: z.literal("restore"), id: z.string().uuid() }),
  linkDefaults.extend({ action: z.literal("defaults") }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    await rateLimit(actor.id);
    const body = command.parse(await (await boundedRequest(request, 10_000)).json());
    const database = await db();
    switch (body.action) {
      case "revoke":
        return Response.json(await revokeShareLink(database, actor, body.id));
      case "restore":
        return Response.json(await restoreShareLink(database, actor, body.id));
      case "defaults": {
        const { action: _, ...defaults } = body;
        return Response.json(await setLinkDefaults(database, actor, defaults));
      }
      case "create":
        return Response.json(await createShareLink(database, actor, body, publicOrigin(request)));
    }
  } catch (e) {
    return failure(e);
  }
}
