import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDownloadLink, openDownloadLink } from "../lib/download-links";
import { execute } from "../lib/service";
import { storeAsset } from "../lib/storage";
import { ids } from "../lib/seed";
import type { Db } from "../lib/db/client";
import { principal, seededDb } from "./helpers";

const origin = "https://spacie.test";
const strategy = "40000000-0000-4000-8000-000000000020";
const owlagent = "30000000-0000-4000-8000-000000000002";
const tokenOf = (url: string) => new URL(url).searchParams.get("token")!;

async function uploadText(db: Db, text: string, projectId = ids.rebond, name = "Notes.txt") {
  const lorenzo = await principal(db, ids.lorenzo);
  const storageKey = await storeAsset(new File([text], name, { type: "text/plain" }), lorenzo.workspaceId);
  return execute(db, lorenzo, {
    action: "upload_asset", projectId, folderId: null, name, mime: "text/plain", size: text.length, storageKey,
  });
}

test("an agent gets a short-lived link to fetch a stored file, including older versions", async () => {
  process.env.SPACIE_DATA_DIR = await mkdtemp(path.join(tmpdir(), "spacie-"));
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  const { id } = await uploadText(db, "first draft");
  await uploadText(db, "second draft");
  const link = await createDownloadLink(db, claude, { fileId: id }, origin);
  assert.match(link.url, /^https:\/\/spacie\.test\/api\/download-links\?token=/);
  assert.match(link.howTo, /curl --fail -o/);
  assert.deepEqual([link.name, link.mime, link.version, link.text], ["Notes.txt", "text/plain", 2, "second draft"]);
  const current = await openDownloadLink(db, tokenOf(link.url));
  assert.equal(current.bytes.toString(), "second draft");
  assert.equal(current.name, "Notes.txt");
  assert.equal((await openDownloadLink(db, tokenOf(link.url))).bytes.toString(), "second draft", "reusable until it expires");
  const old = await createDownloadLink(db, claude, { fileId: id, version: 1 }, origin);
  assert.equal((await openDownloadLink(db, tokenOf(old.url))).bytes.toString(), "first draft");
});

test("download links respect read access, documents, expiry, trash, and disconnection", async () => {
  process.env.SPACIE_DATA_DIR = await mkdtemp(path.join(tmpdir(), "spacie-"));
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  const hidden = await uploadText(db, "secret", owlagent, "Secret.txt");
  await assert.rejects(createDownloadLink(db, claude, { fileId: hidden.id }, origin), /not found/i);
  await assert.rejects(createDownloadLink(db, claude, { fileId: strategy }, origin), /read_document/);
  const { id } = await uploadText(db, "hello");
  await assert.rejects(createDownloadLink(db, claude, { fileId: id, version: 9 }, origin), /Version not found/);

  const late = await createDownloadLink(db, claude, { fileId: id }, origin);
  await db.query("update download_links set expires_at = now() - interval '1 second'");
  await assert.rejects(openDownloadLink(db, tokenOf(late.url)), /expired/);

  const trashed = await createDownloadLink(db, claude, { fileId: id }, origin);
  await execute(db, await principal(db, ids.lorenzo), { action: "delete_file", id });
  await assert.rejects(openDownloadLink(db, tokenOf(trashed.url)), /expired|not found/i);
  await execute(db, await principal(db, ids.lorenzo), { action: "restore_file", id });

  const revoked = await createDownloadLink(db, claude, { fileId: id }, origin);
  await execute(db, await principal(db, ids.lorenzo), { action: "disconnect_agent", id: ids.claude });
  await assert.rejects(openDownloadLink(db, tokenOf(revoked.url)), /expired|not found/i);
});
