import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptInvitation,
  createInvitation,
  createWorkspaceWithOwnerInvite,
  sessionPrincipal,
} from "../lib/accounts";
import { createEmbeddedDb } from "../lib/db/client";
import {
  GoogleSignInError,
  identityFromIdToken,
  joinWithGoogle,
  readFlow,
  safeNext,
  signInWithGoogle,
} from "../lib/google-auth";

const clientId = "client.apps.googleusercontent.com";
const nonce = "nonce-123";

const idToken = (claims: Record<string, unknown>) =>
  ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");

const valid = {
  iss: "https://accounts.google.com",
  aud: clientId,
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce,
  sub: "google-1",
  email: "Lo@Example.com",
  email_verified: true,
  name: "Lorenzo T",
};

const code = async (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (e) => (e instanceof GoogleSignInError ? e.code : String(e)),
  );

async function ownerWorkspace() {
  const db = await createEmbeddedDb();
  const { workspaceId, token } = await createWorkspaceWithOwnerInvite(db, "Studio");
  await acceptInvitation(db, token, { name: "Lorenzo T", email: "lo@example.com", password: "correct horse battery" });
  return { db, workspaceId };
}

test("the ID token must come from Google, for this client and this flow", () => {
  const identity = identityFromIdToken(idToken(valid), { clientId, nonce });
  assert.deepEqual(identity, { sub: "google-1", email: "lo@example.com", name: "Lorenzo T" });
  for (const bad of [{ iss: "https://evil.example" }, { aud: "other" }, { nonce: "replayed" }, { exp: 1 }, { sub: undefined }])
    assert.throws(() => identityFromIdToken(idToken({ ...valid, ...bad }), { clientId, nonce }), /failed/);
  assert.throws(() => identityFromIdToken(idToken({ ...valid, email_verified: false }), { clientId, nonce }), /unverified/);
  assert.throws(() => identityFromIdToken("garbage", { clientId, nonce }), /failed/);
  assert.equal(identityFromIdToken(idToken({ ...valid, name: undefined }), { clientId, nonce }).name, "lo");
});

test("the return path stays on this site and a tampered flow cookie is ignored", () => {
  assert.equal(safeNext("/settings/profile"), "/settings/profile");
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", null]) assert.equal(safeNext(next), "/workspace");
  assert.equal(readFlow("not-json"), null);
  const flow = Buffer.from(JSON.stringify({ state: "s", verifier: "v", nonce: "n", next: "//evil", invite: 3 })).toString("base64url");
  assert.deepEqual(readFlow(flow), { state: "s", verifier: "v", nonce: "n", next: "/workspace", invite: null });
});

test("Google signs in the account with the same email, then by its Google id", async () => {
  const { db } = await ownerWorkspace();
  const identity = { sub: "google-1", email: "lo@example.com", name: "Lorenzo T" };
  const first = await signInWithGoogle(db, identity);
  assert.equal((await sessionPrincipal(db, first))?.name, "Lorenzo T");
  // Linked: a later change of Google email still reaches the same account.
  const again = await signInWithGoogle(db, { ...identity, email: "renamed@example.com" });
  assert.equal((await sessionPrincipal(db, again))?.name, "Lorenzo T");
  // Another Google account cannot take over an email already linked to a different one.
  assert.equal(await code(signInWithGoogle(db, { ...identity, sub: "google-2" })), "no_account");
});

test("Google never creates an account without an invitation", async () => {
  const { db } = await ownerWorkspace();
  assert.equal(await code(signInWithGoogle(db, { sub: "g", email: "new@example.com", name: "New" })), "no_account");
});

test("an invitation redeemed with Google creates a password-less member in that workspace", async () => {
  const { db, workspaceId } = await ownerWorkspace();
  const { token } = await createInvitation(db, { workspaceId, role: "member", invitedBy: null });
  const session = await joinWithGoogle(db, token, { sub: "g-emma", email: "emma@example.com", name: "Emma R" });
  const emma = await sessionPrincipal(db, session);
  assert.equal(emma?.workspaceId, workspaceId);
  assert.equal(emma?.role, "member");
  const [user] = await db.query<{ password_hash: string | null }>("select password_hash from users where email = 'emma@example.com'");
  assert.equal(user.password_hash, null);
  // Single use.
  assert.equal(await code(joinWithGoogle(db, token, { sub: "g-x", email: "x@example.com", name: "X" })), "invite");
  // And Emma can now sign in with Google directly.
  assert.ok(await signInWithGoogle(db, { sub: "g-emma", email: "emma@example.com", name: "Emma R" }));
});

test("an existing account joins another workspace with Google, and email-locked invitations hold", async () => {
  const { db } = await ownerWorkspace();
  const other = await createWorkspaceWithOwnerInvite(db, "Client");
  const locked = await createInvitation(db, { workspaceId: other.workspaceId, role: "viewer", invitedBy: null, email: "tom@example.com" });
  const lorenzo = { sub: "google-1", email: "lo@example.com", name: "Lorenzo T" };
  assert.equal(await code(joinWithGoogle(db, locked.token, lorenzo)), "invite");
  const session = await joinWithGoogle(db, other.token, lorenzo);
  const member = await sessionPrincipal(db, session);
  assert.equal(member?.workspaceId, other.workspaceId);
  assert.equal(member?.role, "owner");
  const [{ count }] = await db.query<{ count: number }>("select count(*)::int as count from users");
  assert.equal(count, 1);
});
