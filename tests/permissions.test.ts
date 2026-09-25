import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, ids } from "../lib/seed";
import { can } from "../lib/permissions";
import { execute, publicState } from "../lib/service";
import { hashToken } from "../lib/auth";
test("agent is denied outside its project even with a guessed ID", () => {
  const s = seed(),
    actor = s.principals.find((p) => p.id === ids.claude)!;
  assert.equal(
    can(s, actor, "read", {
      workspaceId: ids.workspace,
      projectId: s.projects[1].id,
    }),
    false,
  );
  assert.equal(
    can(s, actor, "read", { workspaceId: "other", projectId: ids.rebond }),
    false,
  );
  assert.throws(
    () =>
      execute(s, actor, {
        action: "create_document",
        projectId: s.projects[1].id,
        name: "intrusion",
      }),
    /FORBIDDEN/,
  );
});
test("specific folder grant overrides project permissions", () => {
  const s = seed(),
    actor = s.principals.find((p) => p.id === ids.claude)!;
  s.grants.push({
    id: crypto.randomUUID(),
    principalId: actor.id,
    resourceType: "folder",
    resourceId: s.folders[0].id,
    allow: ["read"],
    fullAccess: false,
  });
  assert.equal(
    can(s, actor, "write", {
      workspaceId: ids.workspace,
      projectId: ids.rebond,
      folderId: s.folders[0].id,
    }),
    false,
  );
  assert.equal(
    can(s, actor, "read", {
      workspaceId: ids.workspace,
      projectId: ids.rebond,
      folderId: s.folders[0].id,
    }),
    true,
  );
});
test("document edits and restores append attributed immutable snapshots", () => {
  const s = seed(),
    actor = s.principals.find((p) => p.id === ids.claude)!,
    file = s.files[0],
    old = s.versions.filter((v) => v.fileId === file.id);
  execute(s, actor, {
    action: "update_document",
    id: file.id,
    content: "<p>New direction</p>",
    baseVersion: 4,
  });
  assert.equal(file.version, 5);
  assert.equal(s.versions.at(-1)?.actorId, actor.id);
  assert.equal(s.activity[0].action, "edited");
  assert.deepEqual(
    s.versions.filter((v) => v.fileId === file.id && v.number <= 4),
    old,
  );
  assert.throws(
    () =>
      execute(s, actor, {
        action: "update_document",
        id: file.id,
        content: "stale",
        baseVersion: 4,
      }),
    /CONFLICT/,
  );
  const owner = s.principals[0];
  execute(s, owner, { action: "restore_version", id: file.id, version: 2 });
  assert.equal(file.version, 6);
  assert.equal(file.content, old[1].content);
});
test("credentials are hashed, rotated, revoked and never included in public state", () => {
  const s = seed(),
    owner = s.principals[0];
  const created = execute(s, owner, {
    action: "connect_agent",
    name: "Test agent",
    scope: [ids.rebond],
    permissions: ["read"],
  });
  assert.match(created.token as string, /^spc_agent_/);
  assert.equal(s.tokens.at(-1)?.hash, hashToken(created.token as string));
  assert.equal(
    JSON.stringify(publicState(s, owner)).includes(created.token as string),
    false,
  );
  execute(s, owner, { action: "rotate_token", id: created.id as string });
  assert.ok(s.tokens.at(-2)?.revokedAt);
  execute(s, owner, { action: "disconnect_agent", id: created.id as string });
  assert.ok(s.tokens.every((t) => t.revokedAt));
});
test("agents cannot grant themselves full access or move across unauthorized scope", () => {
  const s = seed(),
    actor = s.principals.find((p) => p.id === ids.claude)!;
  assert.throws(
    () =>
      execute(s, actor, {
        action: "connect_agent",
        name: "backdoor",
        fullAccess: true,
      }),
    /FORBIDDEN/,
  );
  assert.throws(
    () =>
      execute(s, actor, {
        action: "move_file",
        id: s.files[0].id,
        projectId: s.projects[1].id,
      }),
    /FORBIDDEN/,
  );
});
test("comments cannot reply into another file", () => {
  const s = seed();
  assert.throws(
    () =>
      execute(s, s.principals[0], {
        action: "create_comment",
        id: s.files[1].id,
        parentId: s.comments[0].id,
        content: "wrong thread",
      }),
    /does not belong/,
  );
});
test("read-only agent cannot mutate files and has filtered context", () => {
  const s = seed(),
    owner = s.principals[0];
  const result = execute(s, owner, {
    action: "connect_agent",
    name: "Reader",
    scope: [ids.rebond],
    permissions: ["read"],
  });
  const reader = s.principals.find((p) => p.id === result.id)!;
  assert.throws(
    () => execute(s, reader, { action: "delete_file", id: s.files[0].id }),
    /FORBIDDEN/,
  );
  assert.equal(publicState(s, reader).projects.length, 1);
  assert.equal("tokens" in publicState(s, reader), false);
});
