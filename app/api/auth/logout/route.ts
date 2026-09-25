import { failure } from "@/lib/http";
import { assertSameOrigin } from "@/lib/auth";
import { endSession, readCookie, SESSION_COOKIE, sessionCookie } from "@/lib/accounts";
import { db } from "@/lib/db/client";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = readCookie(request, SESSION_COOKIE);
    if (token) await endSession(await db(), token);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie("", 0) } });
  } catch (e) {
    return failure(e);
  }
}
