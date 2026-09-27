import { z } from "zod";
import { boundedRequest, failure } from "@/lib/http";
import { assertSameOrigin, authenticate } from "@/lib/auth";
import { changeRole, listTeam, removeMember, renewInvitation, revokeInvitation } from "@/lib/team";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";

/** People, connected agents and pending invitations of the open workspace. */
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    return Response.json(await listTeam(await db(), actor), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("change_role"), id: z.string().uuid(), role: z.enum(["admin", "member", "viewer"]) }),
  z.object({ action: z.literal("remove"), id: z.string().uuid() }),
  z.object({ action: z.literal("revoke_invite"), id: z.string().uuid() }),
  z.object({ action: z.literal("renew_invite"), id: z.string().uuid() }),
]);

/** Owners and admins manage people. Invitations are created by POST /api/invite. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    if (actor.type !== "human") throw new Error("FORBIDDEN: Only people can manage members.");
    await rateLimit(actor.id);
    const body = command.parse(await (await boundedRequest(request, 10_000)).json());
    const database = await db();
    switch (body.action) {
      case "change_role":
        return Response.json(await changeRole(database, actor, body.id, body.role));
      case "remove":
        return Response.json(await removeMember(database, actor, body.id));
      case "revoke_invite":
        return Response.json(await revokeInvitation(database, actor, body.id));
      case "renew_invite": {
        const { token, expiresAt } = await renewInvitation(database, actor, body.id);
        const origin = process.env.SPACIE_ORIGIN ?? new URL(request.url).origin;
        return Response.json({ link: `${origin}/join?token=${token}`, expiresAt });
      }
    }
  } catch (e) {
    return failure(e);
  }
}
