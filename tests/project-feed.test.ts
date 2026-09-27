import { test } from "node:test";
import assert from "node:assert/strict";
import { ids } from "../lib/seed";
import { execute } from "../lib/service";
import { projectFeed } from "../lib/project-feed";
import { one, principal, seededDb } from "./helpers";

const owlagent = "30000000-0000-4000-8000-000000000002";
const strategy = "40000000-0000-4000-8000-000000000020";

test("project comments come newest first with their file name", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const comments = await projectFeed(db, owner, ids.rebond, "comments");
  const { n } = await one<{ n: number }>(db, "select count(*)::int as n from comments");
  assert.equal(comments.length, n);
  assert.ok(comments.every((c) => typeof c.fileName === "string" && c.fileName.length > 0));
  const times = comments.map((c) => Date.parse(c.createdAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

test("project versions cover every live file and skip trashed ones", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const before = await projectFeed(db, owner, ids.rebond, "versions");
  const { n } = await one<{ n: number }>(db, "select count(*)::int as n from file_versions");
  assert.equal(before.length, n);
  await execute(db, owner, { action: "delete_file", id: strategy });
  const after = await projectFeed(db, owner, ids.rebond, "versions");
  assert.ok(after.every((v) => v.fileId !== strategy));
  assert.ok(after.length < before.length);
});

test("an agent only sees feeds of projects it can read", async () => {
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  assert.ok((await projectFeed(db, claude, ids.rebond, "versions")).length > 0);
  await assert.rejects(projectFeed(db, claude, owlagent, "comments"), /Project not found/);
});
