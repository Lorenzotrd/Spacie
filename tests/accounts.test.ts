import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptInvitation,
  createInvitation,
  createWorkspaceWithOwnerInvite,
  endSession,
  hashPassword,
  inspectInvitation,
  readCookie,
  sessionPrincipal,
  signIn,
  verifyPassword,
} from "../lib/accounts";
import { createEmbeddedDb } from "../lib/db/client";
import { execute } from "../lib/service";
import { snapshot } from "../lib/queries";

const password = "correct horse battery";

async function ownerWorkspace() {
  const db = await createEmbeddedDb();
  const { workspaceId, token } = await createWorkspaceWithOwnerInvite(db, "Studio");
  const session = await acceptInvitation(db, token, { name: "Lorenzo T", email: "Lo@Example.com", password });
  const owner = (await sessionPrincipal(db, session))!;
  return { db, workspaceId, owner, session };
}

test("passwords are salted scrypt hashes and short ones are refused", async () => {
  const a = await hashPassword(password);
  const b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.match(a, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong password!", a), false);
  await assert.rejects(hashPassword("short"), /at least 10/);
});

test("the owner link creates the owner, who can then create projects", async () => {
  const { db, workspaceId, owner } = await ownerWorkspace();
  assert.equal(owner.role, "owner");
  assert.equal(owner.workspaceId, workspaceId);
  assert.equal(owner.initials, "LT");
  const project = await execute(db, owner, { action: "create_project", name: "Rebond" });
  const view = await snapshot(db, owner);
  assert.deepEqual(view.projects.map((p) => p.id), [project.id]);
  assert.equal(view.activity.at(-1)?.action, "joined");
});

test("sign-in works with any email casing and fails uniformly otherwise", async () => {
  const { db, owner } = await ownerWorkspace();
  const session = await signIn(db, "lo@example.COM", password);
  assert.equal((await sessionPrincipal(db, session))?.id, owner.id);
  await assert.rejects(signIn(db, "lo@example.com", "not the password"), /Wrong email or password/);
  await assert.rejects(signIn(db, "nobody@example.com", password), /Wrong email or password/);
  await endSession(db, session);
  assert.equal(await sessionPrincipal(db, session), null);
});

test("invitation links are single-use, expiring, and optionally locked to an email", async () => {
  const { db, workspaceId, owner } = await ownerWorkspace();
  const open = await createInvitation(db, { workspaceId, role: "member", invitedBy: owner.id });
  assert.deepEqual(await inspectInvitation(db, open.token), { workspace: "Studio", role: "member", email: null });
  const session = await acceptInvitation(db, open.token, { name: "Sarah", email: "sarah@example.com", password });
  const sarah = (await sessionPrincipal(db, session))!;
  assert.equal(sarah.role, "member");
  assert.equal(sarah.workspaceId, workspaceId);
  await assert.rejects(
    acceptInvitation(db, open.token, { name: "Again", email: "again@example.com", password }),
    /invalid or has expired/,
  );
  assert.equal(await inspectInvitation(db, open.token), null);

  const locked = await createInvitation(db, { workspaceId, role: "viewer", invitedBy: owner.id, email: "Sofia@example.com" });
  await assert.rejects(
    acceptInvitation(db, locked.token, { name: "Eve", email: "eve@example.com", password }),
    /different email/,
  );
  const duplicate = await createInvitation(db, { workspaceId, role: "member", invitedBy: owner.id });
  await assert.rejects(
    acceptInvitation(db, duplicate.token, { name: "Sarah 2", email: "SARAH@example.com", password }),
    /already exists/,
  );
  const expired = await createInvitation(db, { workspaceId, role: "member", invitedBy: owner.id });
  await db.query("update invitations set expires_at = now() - interval '1 second'");
  await assert.rejects(
    acceptInvitation(db, expired.token, { name: "Late", email: "late@example.com", password }),
    /invalid or has expired/,
  );
});

test("expired sessions resolve to nobody", async () => {
  const { db, session } = await ownerWorkspace();
  await db.query("update sessions set expires_at = now() - interval '1 second'");
  assert.equal(await sessionPrincipal(db, session), null);
});

test("cookies are parsed by exact name", () => {
  const request = new Request("http://x", { headers: { cookie: "a=1; spacie_session=abc=; spacie_session_x=no" } });
  assert.equal(readCookie(request, "spacie_session"), "abc=");
  assert.equal(readCookie(request, "missing"), null);
});
