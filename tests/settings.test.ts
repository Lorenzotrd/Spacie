import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptInvitation,
  createInvitation,
  createWorkspaceWithOwnerInvite,
  sessionPrincipal,
  signIn,
} from "../lib/accounts";
import { createEmbeddedDb } from "../lib/db/client";
import { changePassword, endOtherSessions, getProfile, listSessions, updateProfile } from "../lib/profile";
import { changeRole, listTeam, removeMember, renewInvitation, revokeInvitation } from "../lib/team";
import {
  createShareLink,
  getLinkDefaults,
  listWorkspaceShareLinks,
  publicView,
  restoreShareLink,
  revokeShareLink,
  setLinkDefaults,
} from "../lib/share-links";
import { kindOf, listBackups, storageUsage } from "../lib/storage-usage";
import { execute } from "../lib/service";
import { ids } from "../lib/seed";
import { principal, seededDb } from "./helpers";

const password = "correct horse battery";
const origin = "https://spacie.test";
const strategy = "40000000-0000-4000-8000-000000000020";
const rejects = (p: Promise<unknown>, pattern: RegExp) => assert.rejects(p, pattern);

/** "Studio", owned by Lorenzo, with Ada as admin and Ben as member. */
async function studio() {
  const db = await createEmbeddedDb();
  const { workspaceId, token } = await createWorkspaceWithOwnerInvite(db, "Studio");
  const ownerSession = await acceptInvitation(db, token, { name: "Lorenzo", email: "lo@example.com", password, device: "Mac Chrome" });
  const join = async (name: string, role: "admin" | "member" | "viewer") => {
    const invite = await createInvitation(db, { workspaceId, role, invitedBy: null, email: `${name.toLowerCase()}@example.com` });
    const session = await acceptInvitation(db, invite.token, { name, email: `${name.toLowerCase()}@example.com`, password });
    return { session, actor: (await sessionPrincipal(db, session))! };
  };
  const owner = (await sessionPrincipal(db, ownerSession))!;
  const ada = await join("Ada", "admin");
  const ben = await join("Ben", "member");
  return { db, workspaceId, owner, ownerSession, ada, ben };
}

test("a person renames themself in every workspace they belong to", async () => {
  const { db, owner } = await studio();
  assert.deepEqual(await getProfile(db, owner), { name: "Lorenzo", email: "lo@example.com", hasPassword: true });
  await updateProfile(db, owner, "  Lorenzo Trichard ");
  const after = await principal(db, owner.id);
  assert.equal(after.name, "Lorenzo Trichard");
  assert.equal(after.initials, "LT");
  assert.equal((await getProfile(db, after)).name, "Lorenzo Trichard");
  await rejects(updateProfile(db, after, "   "), /Name is required/);
});

test("changing the password needs the current one and signs out other sessions", async () => {
  const { db, owner, ownerSession } = await studio();
  const phone = await signIn(db, "lo@example.com", password, "iPhone Safari");
  const sessions = await listSessions(db, owner, ownerSession);
  assert.deepEqual(sessions.map((s) => [s.device, s.current]), [["Mac Chrome", true], ["iPhone Safari", false]]);
  await rejects(changePassword(db, owner, ownerSession, "wrong password", "a brand new passphrase"), /current password/);
  await changePassword(db, owner, ownerSession, password, "a brand new passphrase");
  assert.equal(await sessionPrincipal(db, phone), null, "other sessions end");
  assert.ok(await sessionPrincipal(db, ownerSession), "this one stays");
  await rejects(signIn(db, "lo@example.com", password), /Wrong email or password/);
  assert.ok(await signIn(db, "lo@example.com", "a brand new passphrase"));
});

test("a person ends one other session, or all of them, never the current one", async () => {
  const { db, owner, ownerSession } = await studio();
  const a = await signIn(db, "lo@example.com", password);
  const b = await signIn(db, "lo@example.com", password);
  const [, first] = await listSessions(db, owner, ownerSession);
  await endOtherSessions(db, owner, ownerSession, first.id);
  assert.equal((await listSessions(db, owner, ownerSession)).length, 2);
  await endOtherSessions(db, owner, ownerSession);
  assert.equal(await sessionPrincipal(db, a), null);
  assert.equal(await sessionPrincipal(db, b), null);
  assert.ok(await sessionPrincipal(db, ownerSession));
  const current = (await listSessions(db, owner, ownerSession))[0];
  await rejects(endOtherSessions(db, owner, ownerSession, current.id), /not found/);
});

test("the team lists people then agents; emails and invitations are for managers", async () => {
  const { db, owner, workspaceId, ben } = await studio();
  await createInvitation(db, { workspaceId, role: "viewer", invitedBy: owner.id, email: "guest@example.com" });
  const team = await listTeam(db, owner);
  assert.deepEqual(team.members.map((m) => [m.name, m.role, m.you]), [
    ["Lorenzo", "owner", true], ["Ada", "admin", false], ["Ben", "member", false],
  ]);
  assert.ok(team.members.every((m) => m.email && m.lastActiveAt));
  assert.deepEqual(team.invitations.map((i) => [i.email, i.role]), [["guest@example.com", "viewer"]]);
  const seen = await listTeam(db, ben.actor);
  assert.equal(seen.canManage, false);
  assert.deepEqual(seen.invitations, []);
  assert.deepEqual(seen.members.map((m) => m.email), [null, null, "ben@example.com"]);
});

test("roles: admins manage members, only the owner manages admins, nobody changes the owner", async () => {
  const { db, owner, ada, ben } = await studio();
  await changeRole(db, ada.actor, ben.actor.id, "viewer");
  assert.equal((await principal(db, ben.actor.id)).role, "viewer");
  await rejects(changeRole(db, ada.actor, ben.actor.id, "admin"), /Only the owner/);
  await rejects(changeRole(db, ada.actor, owner.id, "member"), /owner's role/);
  await rejects(changeRole(db, ada.actor, ada.actor.id, "member"), /your own role/);
  await rejects(changeRole(db, ben.actor, ada.actor.id, "member"), /FORBIDDEN/);
  await changeRole(db, owner, ada.actor.id, "member");
  assert.equal((await principal(db, ada.actor.id)).role, "member");
});

test("a removed person loses the workspace, keeps their name in history, and their links stop", async () => {
  const { db, owner, ada, ben } = await studio();
  const { id: project } = await execute(db, owner, { action: "create_project", name: "Launch" });
  const { id: file } = await execute(db, ben.actor, {
    action: "create_document", projectId: project, folderId: null, name: "Plan", content: "<p>Plan</p>",
  });
  const link = await createShareLink(db, ben.actor, { target: { type: "file", id: file } }, origin);
  await rejects(removeMember(db, ben.actor, ada.actor.id), /FORBIDDEN/);
  await removeMember(db, ada.actor, ben.actor.id);
  assert.equal(await sessionPrincipal(db, ben.session), null, "no other workspace, so signed out");
  assert.deepEqual((await listTeam(db, owner)).members.map((m) => m.name), ["Lorenzo", "Ada"]);
  assert.equal((await principal(db, ben.actor.id)).name, "Ben");
  await rejects(publicView(db, link.url.split("/s/")[1], {}), /not available/);
});

test("pending invitations can be cancelled, or renewed with a new link", async () => {
  const { db, owner, workspaceId, ben } = await studio();
  const old = await createInvitation(db, { workspaceId, role: "member", invitedBy: owner.id, email: "new@example.com" });
  const [invite] = (await listTeam(db, owner)).invitations;
  await rejects(renewInvitation(db, ben.actor, invite.id), /FORBIDDEN/);
  const renewed = await renewInvitation(db, owner, invite.id);
  assert.notEqual(renewed.token, old.token);
  await rejects(acceptInvitation(db, old.token, { name: "New", email: "new@example.com", password }), /invalid or has expired/);
  const [fresh] = (await listTeam(db, owner)).invitations;
  await revokeInvitation(db, owner, fresh.id);
  assert.deepEqual((await listTeam(db, owner)).invitations, []);
  await rejects(acceptInvitation(db, renewed.token, { name: "New", email: "new@example.com", password }), /invalid or has expired/);
});

test("the workspace link list shows every link to managers, and a link turns off and back on", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const link = await createShareLink(db, owner, { target: { type: "file", id: strategy }, password: "open sesame" }, origin);
  const [listed] = await listWorkspaceShareLinks(db, owner, origin);
  assert.deepEqual(
    [listed.status, listed.target.name, listed.target.type, listed.hasPassword, listed.canManage],
    ["active", "Strategy.md", "file", true, true],
  );
  await revokeShareLink(db, owner, link.id);
  assert.equal((await listWorkspaceShareLinks(db, owner, origin))[0].status, "off");
  await restoreShareLink(db, owner, link.id);
  assert.equal((await listWorkspaceShareLinks(db, owner, origin))[0].status, "active");
  await db.query("update share_links set revoked_at = now(), expires_at = now() - interval '1 day' where id = $1", [link.id]);
  assert.equal((await listWorkspaceShareLinks(db, owner, origin))[0].status, "off");
  await rejects(restoreShareLink(db, owner, link.id), /expired/);
});

test("link defaults start at 30 days with downloads, and only managers change them", async () => {
  const { db, owner, ben, workspaceId } = await studio();
  assert.deepEqual(await getLinkDefaults(db, workspaceId), { expiresInDays: 30, allowDownload: true, askPassword: false });
  await setLinkDefaults(db, owner, { expiresInDays: 7, allowDownload: false, askPassword: true });
  assert.deepEqual(await getLinkDefaults(db, workspaceId), { expiresInDays: 7, allowDownload: false, askPassword: true });
  await rejects(setLinkDefaults(db, ben.actor, { expiresInDays: null }), /FORBIDDEN/);
});

test("storage counts files, older versions and the trash, by type and project", async () => {
  const { db, owner, ben } = await studio();
  const { id: project } = await execute(db, owner, { action: "create_project", name: "Launch" });
  const doc = await execute(db, owner, {
    action: "create_document", projectId: project, folderId: null, name: "Plan.md", content: "x".repeat(1000),
  });
  await execute(db, owner, { action: "update_document", id: doc.id, content: "y".repeat(400), baseVersion: 1 });
  const gone = await execute(db, owner, {
    action: "create_document", projectId: project, folderId: null, name: "Old.md", content: "z".repeat(100),
  });
  await execute(db, owner, { action: "delete_file", id: gone.id });
  const usage = await storageUsage(db, owner);
  assert.equal(usage.trashCount, 1);
  assert.equal(usage.trashBytes, 100);
  assert.equal(usage.versionBytes, 1000);
  assert.equal(usage.usedBytes, 1500);
  assert.deepEqual(usage.byKind, [{ kind: "Documents", bytes: 1500 }]);
  assert.deepEqual(usage.byProject.map((p) => [p.name, p.bytes, p.files, p.versions]), [["Launch", 1500, 1, 1]]);
  await rejects(storageUsage(db, ben.actor), /FORBIDDEN/);
});

test("file kinds and backups", async () => {
  assert.equal(kindOf("application/vnd.openxmlformats-officedocument.presentationml.presentation"), "Presentations");
  assert.equal(kindOf("application/octet-stream", "deck.KEY"), "Presentations");
  assert.equal(kindOf("image/png"), "Images");
  assert.equal(kindOf("text/html"), "Documents");
  assert.equal(await listBackups(undefined), null);
  assert.equal(await listBackups("/definitely/not/here"), null);
});
