import { db } from "@/lib/db/client";
import { boundedRequest } from "@/lib/http";
import { OAuthError, oauthFailure, oauthJson, preflight } from "@/lib/oauth/errors";
import { tokenRequest } from "@/lib/oauth/tokens";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
/** Token requests per client and per source address, per minute. */
const TOKEN_REQUESTS = 60;
export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") ?? "";
    if (!type.includes("application/x-www-form-urlencoded"))
      throw new OAuthError("invalid_request", "Use application/x-www-form-urlencoded.");
    const form = new URLSearchParams(await (await boundedRequest(request, 20_000)).text());
    const source = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const client = (form.get("client_id") ?? "basic").slice(0, 100);
    for (const key of [`token-ip:${source}`, `token-client:${client}`])
      await rateLimit(key, TOKEN_REQUESTS).catch(() => {
        throw new OAuthError("slow_down", "Too many token requests. Try again in a minute.", 429);
      });
    return oauthJson(await tokenRequest(await db(), form, request.headers.get("authorization")));
  } catch (e) {
    return oauthFailure(e);
  }
}
export const OPTIONS = preflight;
