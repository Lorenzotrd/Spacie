import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Db } from "../db/client";
import { hashToken, newToken } from "../tokens";
import { authenticateClient, findClient } from "./clients";
import { OAuthError } from "./errors";
import { SCOPE } from "./metadata";

const ACCESS_TTL_S = 3600;
const REFRESH_TTL_MS = 90 * 86_400_000;

const invalidGrant = (why: string) => new OAuthError("invalid_grant", why);

type Tokens = Awaited<ReturnType<typeof issue>>;
/** Replay responses must commit their revocations, so they are returned, not thrown. */
type Outcome = { tokens: Tokens } | { rejected: OAuthError };
const settle = (outcome: Outcome) => {
  if ("rejected" in outcome) throw outcome.rejected;
  return outcome.tokens;
};

/** RFC 7636: BASE64URL(SHA256(verifier)) must equal the stored challenge. */
export function verifyPkce(verifier: string | null, challenge: string) {
  if (!verifier || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

/** Revokes every credential of an agent: used on refresh-token or code replay. */
async function revokeAgent(tx: Db, agentId: string) {
  await tx.query("update agent_tokens set revoked_at = now() where principal_id = $1 and revoked_at is null", [agentId]);
  await tx.query("update oauth_refresh_tokens set revoked_at = now() where agent_id = $1 and revoked_at is null", [agentId]);
}

async function assertAgentActive(tx: Db, agentId: string) {
  const [agent] = await tx.query<{ status: string }>(
    "select status from principals where id = $1 and type = 'agent'",
    [agentId],
  );
  if (!agent || agent.status === "offline") throw invalidGrant("This connection was revoked in Spacie.");
}

/** A short-lived access token (an agent token row) plus a rotating refresh token. */
async function issue(tx: Db, agentId: string, clientId: string, scope: string) {
  const access = newToken();
  const refresh = `spc_refresh_${randomBytes(32).toString("base64url")}`;
  await tx.query(
    `insert into agent_tokens (workspace_id, principal_id, token_hash, expires_at)
     select workspace_id, id, $2, $3 from principals where id = $1`,
    [agentId, hashToken(access), new Date(Date.now() + ACCESS_TTL_S * 1000).toISOString()],
  );
  await tx.query(
    `insert into oauth_refresh_tokens (token_hash, client_id, agent_id, scope, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [hashToken(refresh), clientId, agentId, scope, new Date(Date.now() + REFRESH_TTL_MS).toISOString()],
  );
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: refresh,
    scope,
  };
}

async function exchangeCode(db: Db, form: URLSearchParams, clientId: string) {
  const code = form.get("code");
  if (!code) throw new OAuthError("invalid_request", "Missing code.");
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const [row] = await tx.query<{
      client_id: string; agent_id: string; redirect_uri: string; code_challenge: string;
      scope: string | null; expires_at: Date | string; used_at: Date | string | null;
    }>("select * from oauth_codes where code_hash = $1 for update", [hashToken(code)]);
    if (!row || row.client_id !== clientId) throw invalidGrant("Invalid authorization code.");
    if (row.used_at) {
      // A replayed code means it leaked: kill everything issued from it.
      await revokeAgent(tx, row.agent_id);
      return { rejected: invalidGrant("Authorization code already used.") };
    }
    await tx.query("update oauth_codes set used_at = now() where code_hash = $1", [hashToken(code)]);
    if (new Date(row.expires_at).getTime() < Date.now()) throw invalidGrant("Authorization code expired.");
    const redirect = form.get("redirect_uri");
    if (redirect && redirect !== row.redirect_uri) throw invalidGrant("redirect_uri does not match.");
    if (!verifyPkce(form.get("code_verifier"), row.code_challenge)) throw invalidGrant("PKCE verification failed.");
    await assertAgentActive(tx, row.agent_id);
    return { tokens: await issue(tx, row.agent_id, clientId, row.scope ?? SCOPE) };
  });
  return settle(outcome);
}

async function refresh(db: Db, form: URLSearchParams, clientId: string) {
  const token = form.get("refresh_token");
  if (!token) throw new OAuthError("invalid_request", "Missing refresh_token.");
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const [row] = await tx.query<{
      client_id: string; agent_id: string; scope: string | null;
      expires_at: Date | string; revoked_at: Date | string | null;
    }>("select * from oauth_refresh_tokens where token_hash = $1 for update", [hashToken(token)]);
    if (!row || row.client_id !== clientId) throw invalidGrant("Invalid refresh token.");
    if (row.revoked_at) {
      // Rotation means an old refresh token is only presented by someone who copied it.
      await revokeAgent(tx, row.agent_id);
      return { rejected: invalidGrant("Refresh token was already used.") };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) throw invalidGrant("Refresh token expired.");
    await tx.query("update oauth_refresh_tokens set revoked_at = now() where token_hash = $1", [hashToken(token)]);
    await assertAgentActive(tx, row.agent_id);
    return { tokens: await issue(tx, row.agent_id, clientId, row.scope ?? SCOPE) };
  });
  return settle(outcome);
}

/** The token endpoint (RFC 6749 §3.2). */
export async function tokenRequest(db: Db, form: URLSearchParams, authorization: string | null) {
  let clientId = form.get("client_id");
  if (!clientId && authorization?.startsWith("Basic "))
    clientId = decodeURIComponent(Buffer.from(authorization.slice(6), "base64").toString().split(":")[0]);
  const client = await findClient(db, clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown client.", 401);
  authenticateClient(client, form, authorization);
  const grant = form.get("grant_type");
  if (grant === "authorization_code") return exchangeCode(db, form, client.id);
  if (grant === "refresh_token") return refresh(db, form, client.id);
  throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}
