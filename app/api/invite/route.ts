import { boundedRequest } from "@/lib/http";
import { authAdmin, authenticate, assertSameOrigin } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { loadAccess } from "@/lib/access";
import { demo } from "@/lib/config";
import { db } from "@/lib/db/client";
import { z } from "zod";
import { failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    const database = await db();
    requirePermission(await loadAccess(database, actor), actor, "manage_members", {
      workspaceId: actor.workspaceId,
    });
    if (demo()) throw new Error("Configure sign-in to send invitations.");
    const input = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "member", "viewer"]),
      })
      .parse(await (await boundedRequest(request, 10000)).json());
    await database.query(
      `insert into invitations (workspace_id, email, role, invited_by) values ($1, $2, $3, $4)
       on conflict (workspace_id, email) do update set
         role = excluded.role, invited_by = excluded.invited_by,
         created_at = now(), expires_at = now() + interval '7 days'`,
      [actor.workspaceId, input.email.toLowerCase(), input.role, actor.id],
    );
    const { error: inviteError } = await authAdmin().auth.admin.inviteUserByEmail(
      input.email,
      { redirectTo: `${process.env.SPACIE_ORIGIN}/api/auth/callback` },
    );
    if (inviteError) throw inviteError;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
