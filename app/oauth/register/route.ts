import { db } from "@/lib/db/client";
import { boundedRequest } from "@/lib/http";
import { registerClient } from "@/lib/oauth/clients";
import { OAuthError, oauthFailure, oauthJson, preflight } from "@/lib/oauth/errors";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
/** Registrations per source address per minute. */
const REGISTRATIONS = 20;
export async function POST(request: Request) {
  try {
    const source = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await rateLimit(`register:${source}`, REGISTRATIONS).catch(() => {
      throw new OAuthError("temporarily_unavailable", "Too many registrations. Try again in a minute.", 429);
    });
    let body: unknown;
    try {
      body = await (await boundedRequest(request, 20_000)).json();
    } catch {
      throw new OAuthError("invalid_client_metadata", "Body must be JSON.");
    }
    return oauthJson(await registerClient(await db(), body), 201);
  } catch (e) {
    return oauthFailure(e);
  }
}
export const OPTIONS = preflight;
