import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, ids } from "../lib/seed";
import { can } from "../lib/permissions";

test("agent is denied outside its project even with a guessed ID", () => {
  const s = seed(),
    actor = s.principals.find((p) => p.id === ids.claude)!;
  assert.equal(
    can(s, actor, "read", { workspaceId: ids.workspace, projectId: s.projects[1].id }),
    false,
  );
  assert.equal(
    can(s, actor, "read", { workspaceId: "other", projectId: ids.rebond }),
    false,
  );
});

test("specific folder grant overrides project permissions", () => {
  const s = seed(),
    actor = s.principals.find((p) => p.id === ids.claude)!;
  const grants = [
    ...s.grants,
    {
      id: crypto.randomUUID(),
      principalId: actor.id,
      resourceType: "folder" as const,
      resourceId: s.folders[0].id,
      allow: ["read" as const],
      fullAccess: false,
    },
  ];
  const ctx = { ...s, grants };
  const inFolder = { workspaceId: ids.workspace, projectId: ids.rebond, folderId: s.folders[0].id };
  assert.equal(can(ctx, actor, "write", inFolder), false);
  assert.equal(can(ctx, actor, "read", inFolder), true);
});

test("folder cycles and cross-project folders are denied", () => {
  const s = seed(),
    actor = s.principals.find((p) => p.id === ids.claude)!;
  const [a, b] = s.folders;
  const folders = [{ ...a, parentId: b.id }, { ...b, parentId: a.id }];
  assert.equal(
    can({ ...s, folders }, actor, "read", { workspaceId: ids.workspace, projectId: ids.rebond, folderId: a.id }),
    false,
  );
  assert.equal(
    can(s, actor, "read", { workspaceId: ids.workspace, projectId: s.projects[1].id, folderId: a.id }),
    false,
  );
});

test("human members write, viewers only read, owners administer", () => {
  const s = seed();
  const member = s.principals.find((p) => p.id === ids.sarah)!;
  const viewer = { ...member, role: "viewer" as const };
  const owner = s.principals.find((p) => p.id === ids.lorenzo)!;
  const where = { workspaceId: ids.workspace, projectId: ids.rebond };
  assert.equal(can(s, member, "write", where), true);
  assert.equal(can(s, member, "manage_members", { workspaceId: ids.workspace }), false);
  assert.equal(can(s, viewer, "read", where), true);
  assert.equal(can(s, viewer, "write", where), false);
  assert.equal(can(s, owner, "manage_members", { workspaceId: ids.workspace }), true);
});
