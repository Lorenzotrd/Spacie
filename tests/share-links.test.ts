import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShareLink,
  listShareLinks,
  publicFileDetail,
  publicView,
  revokeShareLink,
  ShareAccessError,
} from "../lib/share-links";
import { execute } from "../lib/service";
import { ids } from "../lib/seed";
import type { Db } from "../lib/db/client";
import { principal, seededDb } from "./helpers";

const origin = "https://spacie.test";
const strategy = "40000000-0000-4000-8000-000000000020";
const briefs = "40000000-0000-4000-8000-000000000001";
const owlagent = "30000000-0000-4000-8000-000000000002";
const tokenOf = (url: string) => url.split("/s/")[1];
const reason = (e: unknown) => (e as ShareAccessError).reason;
const none = {};

async function docIn(db: Db, folderId: string | null, name: string, projectId = ids.rebond) {
  return (await execute(db, await principal(db, ids.lorenzo), {
    action: "create_document", projectId, folderId, name, content: `<p>${name}</p>`,
  })).id;
}

test("a file link shows that file to anyone, and only that file", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const link = await createShareLink(db, owner, { target: { type: "file", id: strategy } }, origin);
  assert.match(link.url, /^https:\/\/spacie\.test\/s\/[A-Za-z0-9_-]{32}$/);
  assert.equal(link.allowDownload, true);
  assert.ok(link.expiresAt && new Date(link.expiresAt).getTime() > Date.now() + 29 * 86_400_000, "30 days by default");
  const view = await publicView(db, tokenOf(link.url), none);
  assert.deepEqual([view.kind, view.name, view.sharedBy, view.files.length], ["file", "Strategy.md", "Lorenzo", 1]);
  const detail = await publicFileDetail(db, tokenOf(link.url), strategy, none);
  assert.match(detail.file.content, /A new chapter for Rebond/);
  const other = "40000000-0000-4000-8000-000000000021";
  assert.equal(reason(await publicFileDetail(db, tokenOf(link.url), other, none).catch((e) => e)), "not_found");
  assert.equal((await listShareLinks(db, owner, { type: "file", id: strategy }, origin))[0].viewCount, 1);
});

test("a folder link includes subfolders; a project link includes everything in it", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const sub = (await execute(db, owner, { action: "create_folder", projectId: ids.rebond, folderId: briefs, name: "Client" })).id;
  const inFolder = await docIn(db, briefs, "Brief A");
  const inSub = await docIn(db, sub, "Brief B");
  const outside = await docIn(db, null, "Root note");
  const folder = await createShareLink(db, owner, { target: { type: "folder", id: briefs } }, origin);
  const names = (await publicView(db, tokenOf(folder.url), none)).files.map((f) => f.id);
  assert.deepEqual(new Set(names), new Set([inFolder, inSub]));
  assert.equal(reason(await publicFileDetail(db, tokenOf(folder.url), outside, none).catch((e) => e)), "not_found");
  const project = await createShareLink(db, owner, { target: { type: "project", id: ids.rebond } }, origin);
  const all = (await publicView(db, tokenOf(project.url), none)).files.map((f) => f.id);
  assert.ok([inFolder, inSub, outside, strategy].every((id) => all.includes(id)));
  const elsewhere = await docIn(db, null, "Other project", owlagent);
  assert.equal(all.includes(elsewhere), false);
});

test("revoked, expired, deleted, and unknown links all look the same: not found", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const revoked = await createShareLink(db, owner, { target: { type: "file", id: strategy } }, origin);
  await revokeShareLink(db, owner, revoked.id);
  const expired = await createShareLink(db, owner, { target: { type: "project", id: ids.rebond }, expiresInDays: 7 }, origin);
  await db.query("update share_links set expires_at = now() - interval '1 second' where id = $1", [expired.id]);
  const trashed = await createShareLink(db, owner, { target: { type: "file", id: strategy } }, origin);
  await execute(db, owner, { action: "delete_file", id: strategy });
  for (const url of [revoked.url, expired.url, trashed.url, `${origin}/s/${"x".repeat(32)}`])
    assert.equal(reason(await publicView(db, tokenOf(url), none).catch((e) => e)), "not_found");
  assert.deepEqual(await listShareLinks(db, owner, { type: "project", id: ids.rebond }, origin), []);
});

test("password links need the password once, then a signed pass that works for files", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const link = await createShareLink(db, owner, { target: { type: "file", id: strategy }, password: "client-2026" }, origin);
  const token = tokenOf(link.url);
  assert.equal(reason(await publicView(db, token, none).catch((e) => e)), "password_required");
  assert.equal(reason(await publicView(db, token, { password: "nope" }).catch((e) => e)), "wrong_password");
  const view = await publicView(db, token, { password: "client-2026" });
  assert.match(view.access!, /^\d+\./);
  assert.ok(await publicFileDetail(db, token, strategy, { access: view.access }));
  const forged = view.access!.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  assert.equal(reason(await publicFileDetail(db, token, strategy, { access: forged }).catch((e) => e)), "password_required");
});

test("ten wrong passwords lock the link, even with the right one, until the lock ends", async () => {
  const db = await seededDb();
  const owner = await principal(db, ids.lorenzo);
  const link = await createShareLink(db, owner, { target: { type: "file", id: strategy }, password: "client-2026" }, origin);
  const token = tokenOf(link.url);
  for (let i = 0; i < 10; i++)
    assert.equal(reason(await publicView(db, token, { password: `guess-${i}xx` }).catch((e) => e)), "wrong_password");
  assert.equal(reason(await publicView(db, token, { password: "client-2026" }).catch((e) => e)), "locked");
  await db.query("update share_links set locked_until = now() - interval '1 second'");
  assert.ok(await publicView(db, token, { password: "client-2026" }));
  await assert.rejects(
    createShareLink(db, owner, { target: { type: "file", id: strategy }, password: "short" }, origin),
    /at least 8/,
  );
});

test("seeing existing links requires publish, not just read", async () => {
  const db = await seededDb();
  await createShareLink(db, await principal(db, ids.lorenzo), { target: { type: "file", id: strategy } }, origin);
  await assert.rejects(listShareLinks(db, await principal(db, ids.claude), { type: "file", id: strategy }, origin), /FORBIDDEN/);
});

test("only people and agents with publish can create links; viewers and plain agents cannot", async () => {
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  await assert.rejects(createShareLink(db, claude, { target: { type: "file", id: strategy } }, origin), /FORBIDDEN/);
  await db.query("update principals set role = 'viewer' where id = $1", [ids.sofia]);
  await assert.rejects(
    createShareLink(db, await principal(db, ids.sofia), { target: { type: "file", id: strategy } }, origin),
    /FORBIDDEN/,
  );
  const sarah = await principal(db, ids.sarah);
  assert.ok(await createShareLink(db, sarah, { target: { type: "file", id: strategy } }, origin));
  await db.query("update grants set allow = array_append(allow, 'publish') where principal_id = $1", [ids.claude]);
  assert.ok(await createShareLink(db, claude, { target: { type: "file", id: strategy } }, origin));
  await assert.rejects(
    createShareLink(db, claude, { target: { type: "project", id: owlagent } }, origin),
    /FORBIDDEN/,
  );
});

test("a link dies when its creator loses access", async () => {
  const db = await seededDb();
  await db.query("update grants set allow = array_append(allow, 'publish') where principal_id = $1", [ids.claude]);
  const link = await createShareLink(db, await principal(db, ids.claude), { target: { type: "file", id: strategy } }, origin);
  assert.ok(await publicView(db, tokenOf(link.url), none));
  await execute(db, await principal(db, ids.lorenzo), { action: "disconnect_agent", id: ids.claude });
  assert.equal(reason(await publicView(db, tokenOf(link.url), none).catch((e) => e)), "not_found");
});
