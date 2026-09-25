import { boundedRequest } from "@/lib/http";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { admin, demo } from "@/lib/repository";
import { z } from "zod";
import { failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { state, actor } = await authenticate(request);
    requirePermission(state, actor, "manage_members", {
      workspaceId: state.workspace.id,
    });
    if (demo()) throw new Error("Connect Supabase to send invitations.");
    const input = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "member", "viewer"]),
      })
      .parse(await (await boundedRequest(request, 10000)).json());
    const { error } = await admin().from("invitations").upsert(
      {
        workspace_id: state.workspace.id,
        email: input.email.toLowerCase(),
        role: input.role,
        invited_by: actor.id,
      },
      { onConflict: "workspace_id,email" },
    );
    if (error) throw error;
    const { error: inviteError } = await admin().auth.admin.inviteUserByEmail(
      input.email,
      { redirectTo: `${process.env.SPACIE_ORIGIN}/api/auth/callback` },
    );
    if (inviteError) throw inviteError;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
