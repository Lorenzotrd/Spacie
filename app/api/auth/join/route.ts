import { z } from "zod";
import { boundedRequest, failure } from "@/lib/http";
import { assertSameOrigin } from "@/lib/auth";
import { acceptInvitation, inspectInvitation, MIN_PASSWORD, sessionCookie } from "@/lib/accounts";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
const token = z.string().min(20).max(200);
/** `?token=` describes a pending invitation so the join page can greet the invitee. */
export async function GET(request: Request) {
  try {
    const invite = await inspectInvitation(
      await db(),
      token.parse(new URL(request.url).searchParams.get("token")),
    );
    if (!invite) throw new Error("Invitation not found or expired");
    return Response.json(invite, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
const input = z.object({
  token,
  name: z.string().trim().min(1).max(80),
  email: z.string().email().max(320),
  password: z.string().min(MIN_PASSWORD).max(500),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = input.parse(await (await boundedRequest(request, 10000)).json());
    await rateLimit(`join:${body.token.slice(0, 16)}`, 10);
    const session = await acceptInvitation(await db(), body.token, body);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(session) } });
  } catch (e) {
    return failure(e);
  }
}
