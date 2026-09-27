import { z } from "zod";
import { boundedRequest, failure } from "@/lib/http";
import { assertSameOrigin } from "@/lib/auth";
import { MIN_PASSWORD, readCookie, SESSION_COOKIE, sessionPrincipal } from "@/lib/accounts";
import { changePassword, endOtherSessions, getProfile, listSessions, NAME_MAX, updateProfile } from "@/lib/profile";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";

/**
 * Account settings only make sense for a signed-in person: the actor comes from the
 * session cookie itself, never from an agent token or the demo fallback.
 */
async function signedIn(request: Request) {
  const session = readCookie(request, SESSION_COOKIE);
  if (!session || request.headers.get("authorization"))
    throw new Error("FORBIDDEN: Sign in with your account to change it.");
  const actor = await sessionPrincipal(await db(), session);
  if (!actor) throw new Error("UNAUTHORIZED");
  return { session, actor };
}

/** The signed-in person's profile and open sessions. */
export async function GET(request: Request) {
  try {
    const { session, actor } = await signedIn(request);
    const database = await db();
    const [profile, sessions] = await Promise.all([getProfile(database, actor), listSessions(database, actor, session)]);
    return Response.json({ profile, sessions }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update_profile"), name: z.string().trim().min(1).max(NAME_MAX) }),
  z.object({
    action: z.literal("change_password"),
    current: z.string().min(1).max(500),
    next: z.string().min(MIN_PASSWORD).max(500),
  }),
  z.object({ action: z.literal("end_session"), id: z.string().uuid() }),
  z.object({ action: z.literal("end_other_sessions") }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { session, actor } = await signedIn(request);
    const body = command.parse(await (await boundedRequest(request, 10_000)).json());
    // Password checks get the sign-in limit; everything else the usual one.
    await rateLimit(body.action === "change_password" ? `password:${actor.id}` : actor.id, body.action === "change_password" ? 10 : undefined);
    const database = await db();
    switch (body.action) {
      case "update_profile":
        return Response.json(await updateProfile(database, actor, body.name));
      case "change_password":
        return Response.json(await changePassword(database, actor, session, body.current, body.next));
      case "end_session":
        return Response.json(await endOtherSessions(database, actor, session, body.id));
      case "end_other_sessions":
        return Response.json(await endOtherSessions(database, actor, session));
    }
  } catch (e) {
    return failure(e);
  }
}
