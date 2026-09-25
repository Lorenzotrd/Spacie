/**
 * An RFC 6749 error. `redirectUri` is set only once the client and its redirect URI
 * are verified; only then may the error be sent back to the client.
 */
export class OAuthError extends Error {
  constructor(
    readonly code: string,
    readonly description: string,
    readonly status = 400,
    readonly redirectUri: string | null = null,
  ) {
    super(description);
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
};

/** OAuth metadata, registration and token responses are public, cookie-less, and uncached. */
export function oauthJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...cors, "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export function oauthFailure(error: unknown) {
  if (error instanceof OAuthError)
    return oauthJson({ error: error.code, error_description: error.description }, error.status);
  console.error("[oauth]", error);
  return oauthJson({ error: "server_error", error_description: "Something went wrong." }, 500);
}

export const preflight = () => new Response(null, { status: 204, headers: cors });
