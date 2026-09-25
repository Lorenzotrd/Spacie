import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createUploadLink, consumeUploadLink } from "../lib/upload-links";
import { fileDetail } from "../lib/queries";
import { execute } from "../lib/service";
import { ids } from "../lib/seed";
import { one, principal, seededDb } from "./helpers";

const origin = "https://spacie.test";
const pdf = "application/pdf";
const owlagent = "30000000-0000-4000-8000-000000000002";
const bytes = () => new Uint8Array(Buffer.from("%PDF-1.7 audit deck"));
const tokenOf = (url: string) => new URL(url).searchParams.get("token")!;

test("an agent uploads a sandbox file through a single-use link", async () => {
  process.env.SPACIE_DATA_DIR = await mkdtemp(path.join(tmpdir(), "spacie-"));
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  const link = await createUploadLink(db, claude, { projectId: ids.rebond, folderId: null, name: "Audit.pdf", mime: pdf }, origin);
  assert.match(link.url, /^https:\/\/spacie\.test\/api\/upload-links\?token=/);
  assert.match(link.howTo, /curl --fail -T/);
  const saved = await consumeUploadLink(db, tokenOf(link.url), bytes());
  const detail = await fileDetail(db, claude, saved.id);
  assert.equal(detail?.file.name, "Audit.pdf");
  assert.equal(detail?.file.updatedBy, ids.claude);
  assert.equal(detail?.file.size, bytes().byteLength);
  const stored = await readFile(path.join(process.env.SPACIE_DATA_DIR, "assets", detail!.file.storageKey!));
  assert.equal(stored.toString(), "%PDF-1.7 audit deck");
  await assert.rejects(consumeUploadLink(db, tokenOf(link.url), bytes()), /already used/);
});

test("links respect upload permissions, types, expiry, and disconnection", async () => {
  process.env.SPACIE_DATA_DIR = await mkdtemp(path.join(tmpdir(), "spacie-"));
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  await assert.rejects(
    createUploadLink(db, claude, { projectId: owlagent, folderId: null, name: "x.pdf", mime: pdf }, origin),
    /FORBIDDEN/,
  );
  await assert.rejects(
    createUploadLink(db, claude, { projectId: ids.rebond, folderId: null, name: "x.exe", mime: "application/x-msdownload" }, origin),
    /Unsupported file type/,
  );
  const empty = await createUploadLink(db, claude, { projectId: ids.rebond, folderId: null, name: "a.pdf", mime: pdf }, origin);
  await assert.rejects(consumeUploadLink(db, tokenOf(empty.url), new Uint8Array()), /empty/);
  assert.ok(await consumeUploadLink(db, tokenOf(empty.url), bytes()), "an empty attempt must not burn the link");

  const late = await createUploadLink(db, claude, { projectId: ids.rebond, folderId: null, name: "b.pdf", mime: pdf }, origin);
  await db.query("update upload_links set expires_at = now() - interval '1 second' where used_at is null");
  await assert.rejects(consumeUploadLink(db, tokenOf(late.url), bytes()), /expired/);

  const revoked = await createUploadLink(db, claude, { projectId: ids.rebond, folderId: null, name: "c.pdf", mime: pdf }, origin);
  await execute(db, await principal(db, ids.lorenzo), { action: "disconnect_agent", id: ids.claude });
  await assert.rejects(consumeUploadLink(db, tokenOf(revoked.url), bytes()), /UNAUTHORIZED/);
  const files = await one<{ n: number }>(db, "select count(*)::int as n from files where name = 'c.pdf'");
  assert.equal(files.n, 0);
});
