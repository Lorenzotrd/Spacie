import { authenticate } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { clientRedirect, validateAuthorization } from "@/lib/oauth/authorize";
import { OAuthError } from "@/lib/oauth/errors";
import { publicOrigin } from "@/lib/oauth/metadata";
export const runtime = "nodejs";
/**
 * The authorization endpoint. Bad client or redirect URI: explained on /connect.
 * Other request errors: returned to the client. Otherwise: sign in, then consent on /connect.
 */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  try {
    await validateAuthorization(await db(), url.searchParams, origin);
  } catch (e) {
    if (e instanceof OAuthError && e.redirectUri) {
      const state = url.searchParams.get("state");
      return Response.redirect(
        clientRedirect({ redirectUri: e.redirectUri, state: state && state.length <= 1000 ? state : null }, origin, {
          error: e.code,
          error_description: e.description,
        }),
        302,
      );
    }
    const message = e instanceof Error ? e.message : "This connection request is invalid.";
    return Response.redirect(`${origin}/connect?error=${encodeURIComponent(message)}`, 302);
  }
  const signedIn = await authenticate(request).then(() => true, () => false);
  const consent = `/connect?${query}`;
  return Response.redirect(
    signedIn ? `${origin}${consent}` : `${origin}/login?next=${encodeURIComponent(consent)}`,
    302,
  );
}
