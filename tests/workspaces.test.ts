import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptInvitation,
  createInvitation,
  createWorkspaceWithOwnerInvite,
  sessionPrincipal,
} from "../lib/accounts";
import { createEmbeddedDb } from "../lib/db/client";
import { execute } from "../lib/service";
import { snapshot } from "../lib/queries";
import {
  createWorkspace,
  joinWithSession,
  listWorkspaces,
  switchWorkspace,
} from "../lib/workspaces";

const password = "correct horse battery";

/** Lorenzo owns "Studio"; Sarah owns "Agency" with one project. */
async function twoWorkspaces() {
  const db = await createEmbeddedDb();
  const studio = await createWorkspaceWithOwnerInvite(db, "Studio");
  const lorenzoSession = await acceptInvitation(db, studio.token, { name: "Lorenzo", email: "lo@example.com", password });
  const agency = await createWorkspaceWithOwnerInvite(db, "Agency");
  const sarahSession = await acceptInvitation(db, agency.token, { name: "Sarah", email: "sarah@example.com", password });
  const sarah = (await sessionPrincipal(db, sarahSession))!;
  const { id: secretProject } = await execute(db, sarah, { action: "create_project", name: "Secret" });
  return { db, studio, agency, lorenzoSession, sarahSession, sarah, secretProject };
}

test("a signed-in person creates a workspace, owns it and lands in it", async () => {
  const { db, studio, lorenzoSession } = await twoWorkspaces();
  const before = (await sessionPrincipal(db, lorenzoSession))!;
  const { id } = await createWorkspace(db, before, lorenzoSession, "Side project");
  const after = (await sessionPrincipal(db, lorenzoSession))!;
  assert.equal(after.workspaceId, id);
  assert.equal(after.role, "owner");
  assert.equal(after.name, "Lorenzo");
  assert.deepEqual(
    (await listWorkspaces(db, after)).map((w) => [w.name, w.role, w.current]),
    [["Studio", "owner", false], ["Side project", "owner", true]],
  );
  await switchWorkspace(db, after, lorenzoSession, studio.workspaceId);
  assert.equal((await sessionPrincipal(db, lorenzoSession))!.workspaceId, studio.workspaceId);
});

test("nobody can switch into, or read, a workspace they do not belong to", async () => {
  const { db, agency, lorenzoSession, secretProject } = await twoWorkspaces();
  const lorenzo = (await sessionPrincipal(db, lorenzoSession))!;
  await assert.rejects(switchWorkspace(db, lorenzo, lorenzoSession, agency.workspaceId), /FORBIDDEN/);
  const view = await snapshot(db, (await sessionPrincipal(db, lorenzoSession))!);
  assert.ok(view.projects.every((p) => p.id !== secretProject));
  assert.equal((await listWorkspaces(db, lorenzo)).length, 1);
});

test("an existing account joins another workspace from an invitation", async () => {
  const { db, agency, lorenzoSession, sarah, secretProject } = await twoWorkspaces();
  const invite = await createInvitation(db, { workspaceId: agency.workspaceId, role: "member", invitedBy: sarah.id });
  const lorenzo = (await sessionPrincipal(db, lorenzoSession))!;
  await joinWithSession(db, lorenzo, lorenzoSession, invite.token);
  const member = (await sessionPrincipal(db, lorenzoSession))!;
  assert.equal(member.workspaceId, agency.workspaceId);
  assert.equal(member.role, "member");
  assert.ok((await snapshot(db, member)).projects.some((p) => p.id === secretProject));
  assert.equal((await listWorkspaces(db, member)).length, 2);
  await assert.rejects(joinWithSession(db, member, lorenzoSession, invite.token), /invalid or has expired/);
  const again = await createInvitation(db, { workspaceId: agency.workspaceId, role: "viewer", invitedBy: sarah.id });
  await assert.rejects(joinWithSession(db, member, lorenzoSession, again.token), /already a member/);
});

test("invitations addressed to someone else, and agents, are refused", async () => {
  const { db, agency, lorenzoSession, sarah } = await twoWorkspaces();
  const lorenzo = (await sessionPrincipal(db, lorenzoSession))!;
  const forEve = await createInvitation(db, {
    workspaceId: agency.workspaceId, role: "member", invitedBy: sarah.id, email: "eve@example.com",
  });
  await assert.rejects(joinWithSession(db, lorenzo, lorenzoSession, forEve.token), /different email/);
  const agent = { ...sarah, type: "agent" as const, role: undefined };
  await assert.rejects(createWorkspace(db, agent, lorenzoSession, "Nope"), /FORBIDDEN/);
});

test("a session pointing at a workspace without membership falls back to one's own", async () => {
  const { db, studio, agency, lorenzoSession } = await twoWorkspaces();
  await db.query("update sessions set workspace_id = $1", [agency.workspaceId]);
  const lorenzo = (await sessionPrincipal(db, lorenzoSession))!;
  assert.equal(lorenzo.workspaceId, studio.workspaceId);
  assert.equal(lorenzo.name, "Lorenzo");
});
