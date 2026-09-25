import { test } from "node:test";
import assert from "node:assert/strict";
import { ids } from "../lib/seed";
import { execute } from "../lib/service";
import { fileDetail, searchFiles, snapshot, versionContent, workspaceRevision } from "../lib/queries";
import { hashToken } from "../lib/tokens";
import { one, principal, seededDb } from "./helpers";

const strategy = "40000000-0000-4000-8000-000000000020";
const campaign = "40000000-0000-4000-8000-000000000022";
const owlagent = "30000000-0000-4000-8000-000000000002";
const briefs = "40000000-0000-4000-8000-000000000001";
const rootComment = "40000000-0000-4000-8000-000000000200";

test("agent cannot create outside its project", async () => {
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  await assert.rejects(
    execute(db, claude, { action: "create_document", projectId: owlagent, name: "intrusion" }),
    /FORBIDDEN/,
  );
});

test("document edits append attributed versions, reject stale writes, and restore", async () => {
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  const owner = await principal(db, ids.lorenzo);
  const v2 = await versionContent(db, owner, strategy, 2);
  const result = await execute(db, claude, {
    action: "update_document",
    id: strategy,
    content: "<p>New direction</p>",
    baseVersion: 4,
  });
  assert.equal(result.version, 5);
  const latest = await one<{ actor_id: string; content: string }>(
    db,
    "select actor_id, content from file_versions where file_id = $1 and number = 5",
    [strategy],
  );
  assert.deepEqual(latest, { actor_id: ids.claude, content: "<p>New direction</p>" });
  const [event] = (await snapshot(db, owner)).activity;
  assert.equal(event.action, "edited");
  assert.equal(event.actorId, ids.claude);
  await assert.rejects(
    execute(db, claude, { action: "update_document", id: strategy, content: "stale", baseVersion: 4 }),
    /CONFLICT/,
  );
  await execute(db, owner, { action: "restore_version", id: strategy, version: 2 });
  const detail = await fileDetail(db, owner, strategy);
  assert.equal(detail?.file.version, 6);
  assert.equal(detail?.file.content, v2);
  assert.equal(detail?.versions[0].message, "Restored version 2");
});

test("concurrent writers on the same base version: exactly one wins", async () => {
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  const sarah = await principal(db, ids.sarah);
  const outcomes = await Promise.allSettled([
    execute(db, claude, { action: "update_document", id: strategy, content: "<p>A</p>", baseVersion: 4 }),
    execute(db, sarah, { action: "update_document", id: strategy, content: "<p>B</p>", baseVersion: 4 }),
  ]);
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  assert.match(String((outcomes.find((o) => o.status === "rejected") as PromiseRejectedResult).reason), /CONFLICT/);
});

test("a failed command rolls back entirely, revision included", async () => {
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  const before = await workspaceRevision(db, ids.workspace);
  const events = await one<{ n: number }>(db, "select count(*)::int as n from activity_events");
  // The seeded agents have no "delete" permission.
  await assert.rejects(execute(db, claude, { action: "delete_file", id: strategy }), /FORBIDDEN/);
  assert.equal(await workspaceRevision(db, ids.workspace), before);
  assert.deepEqual(await one(db, "select count(*)::int as n from activity_events"), events);
  const owner = await principal(db, ids.lorenzo);
  await execute(db, owner, { action: "rename_file", id: strategy, name: "Strategy v2.md" });
  assert.equal(await workspaceRevision(db, ids.workspace), before + 1);
});

test("credentials are hashed, rotated, revoked, and never exposed", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const created = await execute(db, owner, {
    action: "connect_agent",
    name: "Test agent",
    scope: [ids.rebond],
    permissions: ["read"],
  });
  assert.match(created.token!, /^spc_agent_/);
  const stored = await one<{ token_hash: string }>(
    db,
    "select token_hash from agent_tokens where principal_id = $1",
    [created.id],
  );
  assert.equal(stored.token_hash, hashToken(created.token!));
  assert.equal(JSON.stringify(await snapshot(db, owner)).includes(created.token!), false);
  const rotated = await execute(db, owner, { action: "rotate_token", id: created.id });
  assert.notEqual(rotated.token, created.token);
  const live = await db.query("select 1 from agent_tokens where principal_id = $1 and revoked_at is null", [created.id]);
  assert.equal(live.length, 1);
  await execute(db, owner, { action: "disconnect_agent", id: created.id });
  const remaining = await db.query("select 1 from agent_tokens where principal_id = $1 and revoked_at is null", [created.id]);
  assert.equal(remaining.length, 0);
  const agent = await principal(db, created.id);
  assert.equal(agent.status, "offline");
  await assert.rejects(execute(db, agent, { action: "create_comment", id: strategy, content: "hi" }), /UNAUTHORIZED/);
});

test("agents cannot grant themselves access or move files out of scope", async () => {
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  await assert.rejects(
    execute(db, claude, { action: "connect_agent", name: "backdoor", fullAccess: true }),
    /FORBIDDEN/,
  );
  await assert.rejects(
    execute(db, claude, { action: "move_file", id: strategy, projectId: owlagent }),
    /FORBIDDEN/,
  );
});

test("replies cannot point into another file's thread", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  await assert.rejects(
    execute(db, owner, { action: "create_comment", id: campaign, parentId: rootComment, content: "wrong thread" }),
    /does not belong/,
  );
});

test("reactions and resolution toggle", async () => {
  const db = await seededDb();
  const sarah = await principal(db, ids.sarah);
  await execute(db, sarah, { action: "react_comment", id: rootComment });
  let [comment] = (await fileDetail(db, sarah, strategy))!.comments;
  assert.deepEqual(comment.reactions, [ids.sarah]);
  await execute(db, sarah, { action: "react_comment", id: rootComment });
  await execute(db, sarah, { action: "resolve_comment", id: rootComment });
  [comment] = (await fileDetail(db, sarah, strategy))!.comments;
  assert.deepEqual(comment.reactions, []);
  assert.equal(comment.resolved, true);
});

test("read-only agent sees only its scope and cannot mutate", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const created = await execute(db, owner, { action: "connect_agent", name: "Reader", scope: [ids.rebond], permissions: ["read"] });
  const secret = await execute(db, owner, { action: "create_document", projectId: owlagent, name: "Secret plan", content: "<p>rebrand</p>" });
  const reader = await principal(db, created.id);
  await assert.rejects(execute(db, reader, { action: "delete_file", id: strategy }), /FORBIDDEN/);
  const view = await snapshot(db, reader);
  assert.deepEqual(view.projects.map((p) => p.id), [ids.rebond]);
  assert.equal(view.files.some((f) => f.id === secret.id), false);
  assert.equal(view.activity.some((a) => a.fileId === secret.id), false);
  assert.equal(await fileDetail(db, reader, secret.id), null);
  assert.equal(await versionContent(db, reader, secret.id, 1), null);
  assert.deepEqual(await searchFiles(db, reader, "rebrand"), []);
  assert.equal("tokens" in view, false);
});

test("a folder grant without read hides that folder's files", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const claude = await principal(db, ids.claude);
  const hidden = await execute(db, owner, { action: "create_document", projectId: ids.rebond, folderId: briefs, name: "Board notes" });
  await db.query(
    `insert into grants (workspace_id, principal_id, resource_type, resource_id, allow) values ($1, $2, 'folder', $3, '{}')`,
    [ids.workspace, ids.claude, briefs],
  );
  const view = await snapshot(db, claude);
  assert.equal(view.folders.some((f) => f.id === briefs), false);
  assert.equal(view.files.some((f) => f.id === hidden.id), false);
  assert.equal(view.files.some((f) => f.id === strategy), true);
});

test("snapshot carries no document bodies; detail does", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const view = await snapshot(db, owner);
  assert.equal(view.files.every((f) => !("content" in f)), true);
  assert.equal("versions" in view || "comments" in view, false);
  const detail = await fileDetail(db, owner, strategy);
  assert.match(detail!.file.content, /A new chapter for Rebond/);
  assert.equal(detail!.versions.length, 4);
  assert.equal(detail!.versions.every((v) => !("content" in v)), true);
  assert.equal(detail!.comments.length, 2);
});

test("search matches word prefixes in bodies, names, and comments", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const names = async (q: string) => (await searchFiles(db, owner, q)).map((f) => f.name);
  assert.deepEqual(await names("chapt"), ["Strategy.md"]);
  assert.ok((await names("brand-guide")).includes("Brand-guide.pdf"));
  assert.deepEqual(await names("audience section specific"), ["Strategy.md"]);
  assert.deepEqual(await names("%"), []);
});

test("history tables are append-only", async () => {
  const db = await seededDb();
  await assert.rejects(db.query("update file_versions set content = 'tampered'"), /immutable/);
  await assert.rejects(db.query("delete from activity_events"), /immutable/);
});

test("the database rejects records that cross workspaces or projects", async () => {
  const db = await seededDb();
  await db.query("insert into workspaces (id, name, slug) values ($1, 'Other', 'other')", [
    "10000000-0000-4000-8000-000000000099",
  ]);
  await assert.rejects(
    db.query(
      `insert into files (workspace_id, project_id, name, mime, updated_by) values ($1, $2, 'x', 'text/plain', $3)`,
      ["10000000-0000-4000-8000-000000000099", ids.rebond, ids.lorenzo],
    ),
    /foreign key/,
  );
  await assert.rejects(
    db.query(
      `insert into files (workspace_id, project_id, folder_id, name, mime, updated_by) values ($1, $2, $3, 'x', 'text/plain', $4)`,
      [ids.workspace, owlagent, briefs, ids.lorenzo],
    ),
    /foreign key/,
  );
});
