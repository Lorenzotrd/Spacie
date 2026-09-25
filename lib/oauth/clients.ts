import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db/client";
import { hashToken } from "../tokens";
import { OAuthError } from "./errors";

export type OAuthClient = {
  id: string;
  name: string;
  redirectUris: string[];
  secretHash: string | null;
};

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** HTTPS, or plain HTTP on loopback for local clients; never fragments or credentials. */
export function isAllowedRedirect(value: string) {
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    return url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname));
  } catch {
    return false;
  }
}

const registration = z.object({
  redirect_uris: z
    .array(z.string().max(2000).refine(isAllowedRedirect, "Redirect URIs must use https (or http on localhost)."))
    .min(1)
    .max(10),
  client_name: z.string().trim().max(100).optional(),
  token_endpoint_auth_method: z
    .enum(["none", "client_secret_post", "client_secret_basic"])
    .default("none"),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

/** RFC 7591 dynamic client registration. Public clients (PKCE only) get no secret. */
export async function registerClient(db: Db, body: unknown) {
  const parsed = registration.safeParse(body);
  if (!parsed.success)
    throw new OAuthError("invalid_client_metadata", parsed.error.issues[0]?.message ?? "Invalid client metadata.");
  const input = parsed.data;
  const unsupported = (input.grant_types ?? []).filter(
    (g) => g !== "authorization_code" && g !== "refresh_token",
  );
  if (unsupported.length)
    throw new OAuthError("invalid_client_metadata", `Unsupported grant type: ${unsupported[0]}.`);
  const id = `spc_client_${randomBytes(16).toString("base64url")}`;
  const secret =
    input.token_endpoint_auth_method === "none" ? null : randomBytes(32).toString("base64url");
  const name = input.client_name || new URL(input.redirect_uris[0]).hostname;
  await db.query(
    "insert into oauth_clients (id, name, redirect_uris, secret_hash) values ($1, $2, $3, $4)",
    [id, name, input.redirect_uris, secret ? hashToken(secret) : null],
  );
  return {
    client_id: id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: name,
    redirect_uris: input.redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: input.token_endpoint_auth_method,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
  };
}

export async function findClient(db: Db, id: string | null | undefined): Promise<OAuthClient | null> {
  if (!id || id.length > 200) return null;
  const [row] = await db.query<{ id: string; name: string; redirect_uris: string[]; secret_hash: string | null }>(
    "select id, name, redirect_uris, secret_hash from oauth_clients where id = $1",
    [id],
  );
  return row
    ? { id: row.id, name: row.name, redirectUris: row.redirect_uris, secretHash: row.secret_hash }
    : null;
}

/** Confidential clients prove their secret via HTTP Basic or the form body. */
export function authenticateClient(
  client: OAuthClient,
  form: URLSearchParams,
  authorization: string | null,
) {
  if (!client.secretHash) return;
  let secret = form.get("client_secret");
  if (authorization?.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString();
    const [id, value] = decoded.split(":").map(decodeURIComponent);
    if (id === client.id) secret = value ?? null;
  }
  const expected = Buffer.from(client.secretHash);
  const provided = Buffer.from(secret ? hashToken(secret) : "");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
    throw new OAuthError("invalid_client", "Client authentication failed.", 401);
}
