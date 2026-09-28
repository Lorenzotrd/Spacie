import { readCookie, sessionCookie } from "@/lib/accounts";
import { db } from "@/lib/db/client";
import {
  exchangeCode,
  flowCookie,
  GOOGLE_COOKIE,
  GoogleSignInError,
  joinWithGoogle,
  readFlow,
  signInWithGoogle,
} from "@/lib/google-auth";
export const runtime = "nodejs";

/** Google sends the browser back here with `code` and `state`, or with `error` when cancelled. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const flow = readFlow(readCookie(request, GOOGLE_COOKIE));
  const back = flow?.invite ? `/join?token=${encodeURIComponent(flow.invite)}&error=` : "/login?error=";
  const clear = flowCookie("", 0);
  if (!flow || params.get("state") !== flow.state) return redirect(`${back}failed`, [clear]);
  const code = params.get("code");
  if (!code) return redirect(`${back}${params.get("error") === "access_denied" ? "cancelled" : "failed"}`, [clear]);
  try {
    const identity = await exchangeCode(request, code, flow);
    const device = request.headers.get("user-agent");
    const token = flow.invite
      ? await joinWithGoogle(await db(), flow.invite, identity, device)
      : await signInWithGoogle(await db(), identity, device);
    return redirect(flow.invite ? "/workspace" : flow.next, [clear, sessionCookie(token)]);
  } catch (e) {
    if (!(e instanceof GoogleSignInError)) console.error("[google] sign-in failed", e);
    return redirect(`${back}${e instanceof GoogleSignInError ? e.code : "failed"}`, [clear]);
  }
}

function redirect(location: string, cookies: string[]) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
