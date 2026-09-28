import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db/client";
import { loadAccess, loadProjects } from "../access";
import { can } from "../permissions";
import { hashToken } from "../tokens";
import type { Action, Principal } from "../types";
import { findClient, type OAuthClient } from "./clients";
import { OAuthError } from "./errors";
import { SCOPE } from "./metadata";
import { ACCESS_LEVELS } from "../access-levels";

const CODE_TTL_MS = 10 * 60_000;

export { ACCESS_LEVELS, type AccessLevel } from "../access-levels";

export type AuthorizationRequest = {
  client: OAuthClient;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string;
};

/**
 * Validates an authorization request (RFC 6749 §4.1.1 with PKCE). Problems with the
 * client or redirect URI are shown to the user; anything else is sent back to the client.
 */
export async function validateAuthorization(
  db: Db,
  params: URLSearchParams,
  origin: string,
): Promise<AuthorizationRequest> {
  const client = await findClient(db, params.get("client_id"));
  if (!client) throw new OAuthError("invalid_client", "Unknown application. Try connecting again.");
  const requested = params.get("redirect_uri");
  const redirectUri =
    requested ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : null);
  if (!redirectUri || !client.redirectUris.includes(redirectUri))
    throw new OAuthError("invalid_request", "This application's return address is not registered.");
  const reject = (code: string, description: string) =>
    new OAuthError(code, description, 400, redirectUri);
  if (params.get("response_type") !== "code")
    throw reject("unsupported_response_type", "Only the authorization code flow is supported.");
  const codeChallenge = params.get("code_challenge") ?? "";
  if (params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge))
    throw reject("invalid_request", "PKCE with S256 is required.");
  const resource = params.get("resource");
  if (resource) {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(resource).origin === origin;
    } catch {}
    if (!sameOrigin) throw reject("invalid_target", "Tokens can only be issued for this Atelio server.");
  }
  const state = params.get("state");
  if (state && state.length > 1000) throw reject("invalid_request", "State is too long.");
  return { client, redirectUri, state, codeChallenge, scope: SCOPE };
}

/** Where the browser goes after approval or denial (RFC 6749 §4.1.2, RFC 9207 `iss`). */
export function clientRedirect(
  request: Pick<AuthorizationRequest, "redirectUri" | "state">,
  origin: string,
  params: Record<string, string>,
) {
  const url = new URL(request.redirectUri);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (request.state) url.searchParams.set("state", request.state);
  url.searchParams.set("iss", origin);
  return url.toString();
}

/** What the signed-in person may hand to an agent: never member management. */
export function grantableActions(human: Principal): Action[] {
  return human.role === "viewer" ? ["read"] : ACCESS_LEVELS.write;
}

export const consentChoice = z.object({
  name: z.string().trim().min(1).max(80),
  access: z.enum(["read", "comment", "write"]),
  allProjects: z.boolean(),
  projectIds: z.array(z.string().uuid()).max(100),
  /** Lets the agent create public share links (the `publish` permission). */
  allowPublish: z.boolean().default(false),
});
export type ConsentChoice = z.input<typeof consentChoice>;

/** Projects the person can read: the only ones they may share with an agent. */
export async function shareableProjects(db: Db, human: Principal) {
  const access = await loadAccess(db, human);
  return (await loadProjects(db, human.workspaceId)).filter((p) =>
    can(access, human, "read", { workspaceId: human.workspaceId, projectId: p.id }),
  );
}

/**
 * Records consent: creates (or re-scopes) this person's agent for this client and
 * issues a single-use authorization code bound to the redirect URI and PKCE challenge.
 */
export async function approveAuthorization(
  db: Db,
  human: Principal,
  request: AuthorizationRequest,
  choice: ConsentChoice,
) {
  if (human.type !== "human") throw new Error("FORBIDDEN: Only people can authorize agents.");
  const allowed = new Set(grantableActions(human));
  const requested: Action[] = [
    ...ACCESS_LEVELS[choice.access].filter((a) => allowed.has(a)),
    ...(choice.allowPublish && human.role !== "viewer" ? (["publish"] as Action[]) : []),
  ];
  // An agent never gets more than its human has on that exact scope (no confused deputy).
  const access = await loadAccess(db, human);
  const permitted = (projectId?: string) =>
    requested.filter((a) => can(access, human, a, { workspaceId: human.workspaceId, projectId }));
  const shareable = new Set((await shareableProjects(db, human)).map((p) => p.id));
  const projectIds = [...new Set(choice.projectIds)];
  if (!choice.allProjects && !projectIds.length) throw new Error("Choose at least one project.");
  if (projectIds.some((id) => !shareable.has(id))) throw new Error("FORBIDDEN: You cannot share that project.");
  if (choice.allProjects && human.role !== "owner" && human.role !== "admin")
    throw new Error("FORBIDDEN: Only owners and admins can share every project.");
  const code = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.query("update workspaces set revision = revision + 1 where id = $1", [human.workspaceId]);
    // Reconnecting registers a new client each time, so match the same app by name too.
    const [existing] = await tx.query<{ id: string }>(
      `select id from principals where workspace_id = $1 and type = 'agent' and created_by = $3
         and (oauth_client_id = $2 or (oauth_client_id is not null and provider = $4))
       order by oauth_client_id = $2 desc, created_at limit 1`,
      [human.workspaceId, request.client.id, human.id, request.client.name.slice(0, 50)],
    );
    const agentId = existing
      ? (await tx.query<{ id: string }>(
          "update principals set name = $2, status = 'idle', oauth_client_id = $3 where id = $1 returning id",
          [existing.id, choice.name, request.client.id],
        ))[0].id
      : (await tx.query<{ id: string }>(
          `insert into principals (workspace_id, type, name, initials, color, provider, status, created_by, oauth_client_id)
           values ($1, 'agent', $2, '✳', '#c58264', $3, 'idle', $4, $5) returning id`,
          [human.workspaceId, choice.name, request.client.name.slice(0, 50), human.id, request.client.id],
        ))[0].id;
    await tx.query("delete from grants where principal_id = $1", [agentId]);
    const scopes = choice.allProjects
      ? [{ type: "workspace", id: human.workspaceId, allow: permitted() }]
      : projectIds.map((id) => ({ type: "project", id, allow: permitted(id) }));
    for (const scope of scopes)
      await tx.query(
        `insert into grants (workspace_id, principal_id, resource_type, resource_id, allow, full_access)
         values ($1, $2, $3, $4, $5, false)`,
        [human.workspaceId, agentId, scope.type, scope.id, scope.allow],
      );
    await tx.query(
      `insert into oauth_codes (code_hash, client_id, agent_id, redirect_uri, code_challenge, scope, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [hashToken(code), request.client.id, agentId, request.redirectUri, request.codeChallenge,
        request.scope, new Date(Date.now() + CODE_TTL_MS).toISOString()],
    );
    await tx.query(
      `insert into activity_events (workspace_id, actor_id, action, name) values ($1, $2, 'connected', $3)`,
      [human.workspaceId, human.id, choice.name],
    );
  });
  return code;
}
