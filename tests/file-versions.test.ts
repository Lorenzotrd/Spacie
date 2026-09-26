import { test } from "node:test";
import assert from "node:assert/strict";
import { fileDetail } from "../lib/queries";
import { execute } from "../lib/service";
import { ids } from "../lib/seed";
import type { Db } from "../lib/db/client";
import type { Principal } from "../lib/types";
import { one, principal, seededDb } from "./helpers";

const pptx = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const briefs = "40000000-0000-4000-8000-000000000001";

function upload(db: Db, actor: Principal, name: string, storageKey: string, size: number, folderId: string | null = null) {
  return execute(db, actor, {
    action: "upload_asset", projectId: ids.rebond, folderId, name, mime: pptx, size, storageKey,
  });
}

test("uploading a file with the same name in the same place adds a version instead of a duplicate", async () => {
  const db = await seededDb();
  const lorenzo = await principal(db, ids.lorenzo);
  const claude = await principal(db, ids.claude);
  const first = await upload(db, lorenzo, "Audit.pptx", "ws/a", 100);
  const second = await upload(db, claude, "audit.PPTX", "ws/b", 250);
  assert.equal(second.id, first.id);
  assert.equal(second.version, 2);
  const detail = (await fileDetail(db, lorenzo, first.id))!;
  assert.deepEqual(
    [detail.file.name, detail.file.storageKey, detail.file.size, detail.file.updatedBy, detail.file.previewStatus],
    ["Audit.pptx", "ws/b", 250, ids.claude, "pending"],
  );
  assert.deepEqual(detail.versions.map((v) => [v.number, v.message, v.size]), [
    [2, "Uploaded a new version", 250],
    [1, "Uploaded asset", 100],
  ]);
  const count = await one<{ n: number }>(db, "select count(*)::int as n from files where lower(name) = 'audit.pptx'");
  assert.equal(count.n, 1);
  const activity = await one<{ action: string }>(db, "select action from activity_events order by created_at desc, id desc limit 1");
  assert.equal(activity.action, "uploaded a new version of");
});

test("restoring an older upload brings back its bytes and size", async () => {
  const db = await seededDb();
  const lorenzo = await principal(db, ids.lorenzo);
  const { id } = await upload(db, lorenzo, "Deck.pptx", "ws/v1", 100);
  await upload(db, lorenzo, "Deck.pptx", "ws/v2", 900);
  await execute(db, lorenzo, { action: "restore_version", id, version: 1 });
  const file = (await fileDetail(db, lorenzo, id))!.file;
  assert.deepEqual([file.version, file.storageKey, file.size], [3, "ws/v1", 100]);
});

test("same name elsewhere, trashed files, and documents still create a separate file", async () => {
  const db = await seededDb();
  const lorenzo = await principal(db, ids.lorenzo);
  const root = await upload(db, lorenzo, "Plan.pptx", "ws/1", 1);
  const inFolder = await upload(db, lorenzo, "Plan.pptx", "ws/2", 1, briefs);
  assert.notEqual(inFolder.id, root.id);
  await execute(db, lorenzo, { action: "delete_file", id: root.id });
  const afterTrash = await upload(db, lorenzo, "Plan.pptx", "ws/3", 1);
  assert.notEqual(afterTrash.id, root.id);
  const doc = await execute(db, lorenzo, { action: "create_document", projectId: ids.rebond, folderId: null, name: "Notes" });
  const asset = await execute(db, lorenzo, {
    action: "upload_asset", projectId: ids.rebond, folderId: null, name: "Notes", mime: "text/plain", size: 3, storageKey: "ws/n",
  });
  assert.notEqual(asset.id, doc.id);
});

test("someone who can upload but not edit the existing file gets a separate copy", async () => {
  const db = await seededDb();
  const lorenzo = await principal(db, ids.lorenzo);
  const { id } = await upload(db, lorenzo, "Brief.pptx", "ws/1", 1);
  await db.query(
    "update grants set allow = array_remove(allow, 'write'), full_access = false where principal_id = $1",
    [ids.claude],
  );
  const copy = await upload(db, await principal(db, ids.claude), "Brief.pptx", "ws/2", 1);
  assert.notEqual(copy.id, id);
});
