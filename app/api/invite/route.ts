import { z } from "zod";
import { boundedRequest, failure } from "@/lib/http";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { loadAccess } from "@/lib/access";
import { createInvitation } from "@/lib/accounts";
import { db } from "@/lib/db/client";
export const runtime = "nodejs";
const input = z.object({
  email: z.string().email().max(320).optional().or(z.literal("").transform(() => undefined)),
  role: z.enum(["admin", "member", "viewer"]),
});
/** Returns a single-use join link to share by hand; nothing is emailed. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    if (actor.type !== "human") throw new Error("FORBIDDEN: Only people can invite people.");
    const database = await db();
    requirePermission(await loadAccess(database, actor), actor, "manage_members", {
      workspaceId: actor.workspaceId,
    });
    const body = input.parse(await (await boundedRequest(request, 10000)).json());
    const { token, expiresAt } = await createInvitation(database, {
      workspaceId: actor.workspaceId,
      role: body.role,
      invitedBy: actor.id,
      email: body.email,
    });
    const origin = process.env.SPACIE_ORIGIN ?? new URL(request.url).origin;
    return Response.json({ link: `${origin}/join?token=${token}`, expiresAt });
  } catch (e) {
    return failure(e);
  }
}
