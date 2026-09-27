import { z } from "zod";
import { boundedRequest, failure } from "@/lib/http";
import { assertSameOrigin } from "@/lib/auth";
import { sessionCookie, signIn } from "@/lib/accounts";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
const input = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(500),
});
/** Ten attempts per email per minute. */
const LOGIN_ATTEMPTS = 10;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { email, password } = input.parse(
      await (await boundedRequest(request, 10000)).json(),
    );
    await rateLimit(`login:${email.toLowerCase()}`, LOGIN_ATTEMPTS);
    const token = await signIn(await db(), email, password, request.headers.get("user-agent"));
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token) } });
  } catch (e) {
    return failure(e);
  }
}
