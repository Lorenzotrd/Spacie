import { test } from "node:test";
import assert from "node:assert/strict";
import { ids } from "../lib/seed";
import { execute } from "../lib/service";
import { snapshot } from "../lib/queries";
import { agentAccess, levelOf, permissionsFor } from "../lib/access-levels";
import type { Grant } from "../lib/types";
import { principal, seededDb } from "./helpers";

const owlagent = "30000000-0000-4000-8000-000000000002";
const strategy = "40000000-0000-4000-8000-000000000020";

test("levelOf and agentAccess summarize grants", () => {
  assert.equal(levelOf(["read"]), "read");
  assert.equal(levelOf(["read", "comment"]), "comment");
  assert.equal(levelOf(["read", "write"]), "write");
  assert.equal(levelOf([], true), "write");
  const grants: Grant[] = [
    { id: "g1", principalId: "a", resourceType: "project", resourceId: "p1", allow: ["read", "comment", "publish"], fullAccess: false },
    { id: "g2", principalId: "b", resourceType: "workspace", resourceId: "w", allow: ["read"], fullAccess: false },
  ];
  assert.deepEqual(agentAccess(grants, "a"), {
    level: "comment", allProjects: false, projectIds: ["p1"], publish: true, fullAccess: false,
  });
  assert.equal(agentAccess(grants, "b").allProjects, true);
  assert.deepEqual(permissionsFor("comment", true), ["read", "comment", "publish"]);
});

test("owner changes an agent's level, projects and public-link right", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  await execute(db, owner, {
    action: "update_agent",
    id: ids.claude,
    access: "read",
    scope: [ids.rebond, owlagent],
    allowPublish: true,
  });
  const access = agentAccess((await snapshot(db, owner)).grants, ids.claude);
  assert.equal(access.level, "read");
  assert.deepEqual(access.projectIds.sort(), [ids.rebond, owlagent].sort());
  assert.equal(access.publish, true);
  const claude = await principal(db, ids.claude);
  await assert.rejects(
    execute(db, claude, { action: "update_document", id: strategy, content: "<p>x</p>", baseVersion: 4 }),
    /FORBIDDEN/,
  );
  const [event] = (await snapshot(db, owner)).activity;
  assert.equal(event.action, "updated access for");
});

test("omitted fields keep their current value", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  await execute(db, owner, { action: "update_agent", id: ids.claude, allowPublish: true });
  const access = agentAccess((await snapshot(db, owner)).grants, ids.claude);
  assert.equal(access.level, "write");
  assert.deepEqual(access.projectIds, [ids.rebond]);
  assert.equal(access.publish, true);
});

test("all projects becomes one workspace-wide grant", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  await execute(db, owner, { action: "update_agent", id: ids.claude, fullAccess: true, access: "comment" });
  const access = agentAccess((await snapshot(db, owner)).grants, ids.claude);
  assert.equal(access.allProjects, true);
  assert.equal(access.fullAccess, false);
  assert.equal(access.level, "comment");
});

test("members, agents and bad input cannot update an agent", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const member = await principal(db, ids.sarah);
  const claude = await principal(db, ids.claude);
  await assert.rejects(execute(db, member, { action: "update_agent", id: ids.claude, access: "write" }), /FORBIDDEN/);
  await assert.rejects(execute(db, claude, { action: "update_agent", id: ids.codex, access: "write" }), /FORBIDDEN/);
  await assert.rejects(execute(db, owner, { action: "update_agent", id: ids.sarah, access: "read" }), /Agent not found/);
  await assert.rejects(execute(db, owner, { action: "update_agent", id: ids.claude, scope: [] }), /at least one project/);
  await assert.rejects(execute(db, owner, { action: "update_agent", id: ids.claw, access: "read" }), /disconnected/);
});
