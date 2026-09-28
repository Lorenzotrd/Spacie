import { googleConfigured, startGoogle } from "@/lib/google-auth";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";

/** `?next=` returns there after sign-in; `?invite=` redeems an invitation link with Google. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const invite = params.get("invite");
  const back = invite ? `/join?token=${encodeURIComponent(invite)}&error=` : "/login?error=";
  if (!googleConfigured()) return redirect(`${back}failed`);
  try {
    await rateLimit(`google:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}`, 20);
  } catch {
    return redirect(`${back}failed`);
  }
  const { url, cookie } = startGoogle(request, { next: params.get("next"), invite });
  return redirect(url, cookie);
}

function redirect(location: string, cookie?: string) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
