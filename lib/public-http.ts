import { failure } from "./http";
import { ShareAccessError } from "./share-links";

/** Visitors may send a password (first unlock) or the signed access pass it returns. */
export function shareCredentials(request: Request) {
  const url = new URL(request.url);
  return {
    password: request.headers.get("x-share-password"),
    access: request.headers.get("x-share-access") ?? url.searchParams.get("access"),
  };
}

const PUBLIC_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export function publicJson(body: unknown) {
  return Response.json(body, { headers: PUBLIC_HEADERS });
}

/** Share errors never reveal whether a link existed, expired, or was revoked. */
export function publicFailure(error: unknown) {
  if (error instanceof ShareAccessError) {
    const status = { not_found: 404, password_required: 401, wrong_password: 401, locked: 429 }[error.reason];
    return Response.json(
      { error: error.reason === "not_found" ? "This link is not available." : error.message, reason: error.reason },
      { status, headers: PUBLIC_HEADERS },
    );
  }
  return failure(error);
}
