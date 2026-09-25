import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { registerClient } from "../lib/oauth/clients";
import { approveAuthorization, validateAuthorization, type ConsentChoice } from "../lib/oauth/authorize";
import { OAuthError } from "../lib/oauth/errors";
import { tokenRequest } from "../lib/oauth/tokens";
import { snapshot } from "../lib/queries";
import { execute } from "../lib/service";
import { ids } from "../lib/seed";
import { hashToken } from "../lib/tokens";
import type { Db } from "../lib/db/client";
import { one, principal, seededDb } from "./helpers";

const origin = "https://spacie.test";
const redirect = "https://claude.ai/api/mcp/auth_callback";
const owlagent = "30000000-0000-4000-8000-000000000002";

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function authorize(db: Db, clientId: string, humanId: string, choice: Partial<ConsentChoice> = {}) {
  const { verifier, challenge } = pkce();
  const params = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: redirect,
    code_challenge: challenge, code_challenge_method: "S256", state: "xyz", resource: `${origin}/api/mcp`,
  });
  const request = await validateAuthorization(db, params, origin);
  const code = await approveAuthorization(db, await principal(db, humanId), request, {
    name: "Claude (Lorenzo)", access: "read", allProjects: false, projectIds: [ids.rebond], ...choice,
  });
  return { code, verifier };
}

const exchange = (db: Db, clientId: string, code: string, verifier: string) =>
  tokenRequest(db, new URLSearchParams({
    grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirect,
  }), null);

const refreshWith = (db: Db, clientId: string, token: string) =>
  tokenRequest(db, new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: token }), null);

async function agentFor(db: Db, accessToken: string) {
  const row = await one<{ principal_id: string; revoked_at: Date | null }>(
    db, "select principal_id, revoked_at from agent_tokens where token_hash = $1", [hashToken(accessToken)],
  );
  return { agent: await principal(db, row.principal_id), revoked: !!row.revoked_at };
}

async function setup() {
  const db = await seededDb();
  const client = await registerClient(db, { client_name: "Claude", redirect_uris: [redirect] });
  return { db, clientId: client.client_id };
}

test("registration accepts https callbacks and rejects unsafe ones", async () => {
  const db = await seededDb();
  const ok = await registerClient(db, { redirect_uris: [redirect, "http://localhost:6274/cb"] });
  assert.match(ok.client_id, /^spc_client_/);
  assert.equal("client_secret" in ok, false);
  await assert.rejects(registerClient(db, { redirect_uris: ["http://evil.example/cb"] }), /https/);
  await assert.rejects(registerClient(db, { redirect_uris: ["javascript:alert(1)"] }), OAuthError);
  await assert.rejects(registerClient(db, { redirect_uris: [redirect], grant_types: ["password"] }), /Unsupported grant/);
});

test("full flow: consent creates a scoped agent whose token works like any agent token", async () => {
  const { db, clientId } = await setup();
  const { code, verifier } = await authorize(db, clientId, ids.lorenzo);
  const tokens = await exchange(db, clientId, code, verifier);
  assert.equal(tokens.token_type, "Bearer");
  assert.equal(tokens.expires_in, 3600);
  const { agent } = await agentFor(db, tokens.access_token);
  assert.equal(agent.type, "agent");
  assert.equal(agent.name, "Claude (Lorenzo)");
  const view = await snapshot(db, agent);
  assert.deepEqual(view.projects.map((p) => p.id), [ids.rebond]);
  await assert.rejects(
    execute(db, agent, { action: "create_document", projectId: ids.rebond, name: "x" }),
    /FORBIDDEN/,
  );
});

test("the authorization code is bound to PKCE and single-use; replay revokes everything", async () => {
  const { db, clientId } = await setup();
  const { code, verifier } = await authorize(db, clientId, ids.lorenzo);
  await assert.rejects(exchange(db, clientId, code, pkce().verifier), /PKCE/);
  const tokens = await exchange(db, clientId, code, verifier);
  await assert.rejects(exchange(db, clientId, code, verifier), /already used/);
  assert.equal((await agentFor(db, tokens.access_token)).revoked, true);
  await assert.rejects(refreshWith(db, clientId, tokens.refresh_token), /already used|Invalid/);
});

test("refresh tokens rotate, and reusing an old one revokes the connection", async () => {
  const { db, clientId } = await setup();
  const { code, verifier } = await authorize(db, clientId, ids.lorenzo);
  const first = await exchange(db, clientId, code, verifier);
  const second = await refreshWith(db, clientId, first.refresh_token);
  assert.notEqual(second.access_token, first.access_token);
  assert.notEqual(second.refresh_token, first.refresh_token);
  await assert.rejects(refreshWith(db, clientId, first.refresh_token), /already used/);
  assert.equal((await agentFor(db, second.access_token)).revoked, true);
  await assert.rejects(refreshWith(db, clientId, second.refresh_token), /already used/);
});

test("disconnecting the agent in Spacie stops refresh", async () => {
  const { db, clientId } = await setup();
  const { code, verifier } = await authorize(db, clientId, ids.lorenzo);
  const tokens = await exchange(db, clientId, code, verifier);
  const { agent } = await agentFor(db, tokens.access_token);
  await execute(db, await principal(db, ids.lorenzo), { action: "disconnect_agent", id: agent.id });
  await assert.rejects(refreshWith(db, clientId, tokens.refresh_token), /invalid_grant|already used|revoked/);
});

test("re-authorizing the same app reuses its agent and replaces its grants", async () => {
  const { db, clientId } = await setup();
  const a = await authorize(db, clientId, ids.lorenzo);
  const first = await agentFor(db, (await exchange(db, clientId, a.code, a.verifier)).access_token);
  const b = await authorize(db, clientId, ids.lorenzo, { projectIds: [owlagent], access: "write" });
  const second = await agentFor(db, (await exchange(db, clientId, b.code, b.verifier)).access_token);
  assert.equal(second.agent.id, first.agent.id);
  assert.deepEqual((await snapshot(db, second.agent)).projects.map((p) => p.id), [owlagent]);
});

test("people can only hand agents what they are allowed to share", async () => {
  const { db, clientId } = await setup();
  await assert.rejects(authorize(db, clientId, ids.sarah, { allProjects: true }), /owners and admins/);
  await db.query("update principals set role = 'viewer' where id = $1", [ids.sofia]);
  const { code, verifier } = await authorize(db, clientId, ids.sofia, { access: "write" });
  const { agent } = await agentFor(db, (await exchange(db, clientId, code, verifier)).access_token);
  const grant = await one<{ allow: string[] }>(db, "select allow from grants where principal_id = $1", [agent.id]);
  assert.deepEqual(grant.allow, ["read"]);
  await assert.rejects(authorize(db, clientId, ids.claude), /FORBIDDEN/);
});

test("an agent never gets more than its human has on that project", async () => {
  const { db, clientId } = await setup();
  // An admin limits Sarah (a member) to read-only on Rebond.
  await db.query(
    `insert into grants (workspace_id, principal_id, resource_type, resource_id, allow) values ($1, $2, 'project', $3, '{read}')`,
    [ids.workspace, ids.sarah, ids.rebond],
  );
  const { code, verifier } = await authorize(db, clientId, ids.sarah, { access: "write", projectIds: [ids.rebond, owlagent] });
  const { agent } = await agentFor(db, (await exchange(db, clientId, code, verifier)).access_token);
  const grants = await db.query<{ resource_id: string; allow: string[] }>(
    "select resource_id, allow from grants where principal_id = $1", [agent.id],
  );
  assert.deepEqual(grants.find((g) => g.resource_id === ids.rebond)?.allow, ["read"]);
  assert.ok(grants.find((g) => g.resource_id === owlagent)?.allow.includes("write"));
});

test("request validation: untrusted clients are never redirected to", async () => {
  const { db, clientId } = await setup();
  const base = { response_type: "code", code_challenge: pkce().challenge, code_challenge_method: "S256" };
  const unknown = await validateAuthorization(db, new URLSearchParams({ ...base, client_id: "nope", redirect_uri: redirect }), origin).catch((e) => e);
  assert.equal(unknown.redirectUri, null);
  const foreign = await validateAuthorization(db, new URLSearchParams({ ...base, client_id: clientId, redirect_uri: "https://evil.example/cb" }), origin).catch((e) => e);
  assert.equal(foreign.redirectUri, null);
  const noPkce = await validateAuthorization(db, new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirect }), origin).catch((e) => e);
  assert.equal(noPkce.code, "invalid_request");
  assert.equal(noPkce.redirectUri, redirect);
  const otherServer = await validateAuthorization(db, new URLSearchParams({ ...base, client_id: clientId, resource: "https://other.example/mcp" }), origin).catch((e) => e);
  assert.equal(otherServer.code, "invalid_target");
});

test("confidential clients must present their secret", async () => {
  const db = await seededDb();
  const client = await registerClient(db, { redirect_uris: [redirect], token_endpoint_auth_method: "client_secret_post" });
  const { code, verifier } = await authorize(db, client.client_id, ids.lorenzo);
  const form = { grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier };
  await assert.rejects(tokenRequest(db, new URLSearchParams(form), null), /Client authentication failed/);
  const basic = "Basic " + Buffer.from(`${client.client_id}:${client.client_secret}`).toString("base64");
  const tokens = await tokenRequest(db, new URLSearchParams(form), basic);
  assert.ok(tokens.access_token);
});
