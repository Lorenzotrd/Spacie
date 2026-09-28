import { test } from "node:test";
import assert from "node:assert/strict";
import type { Activity, FileMeta, Grant, Principal } from "../lib/types";
import {
  DOCUMENT_MIME,
  folderFiles,
  formatBytes,
  latestAgentAction,
  fileHistory,
  projectFiles,
  projectMembers,
  relativeTime,
  shortAction,
  storageUsed,
  tabCounts,
  typeLabel,
  versionLabel,
} from "../features/workspace/derive";

const person = (id: string, type: "human" | "agent", status: Principal["status"] = "idle"): Principal => ({
  id, workspaceId: "w", type, name: id, initials: id[0], color: "#000", status, ...(type === "human" ? { role: "member" as const } : {}),
});
const file = (id: string, over: Partial<FileMeta> = {}): FileMeta => ({
  id, workspaceId: "w", projectId: "p", folderId: null, name: `${id}.pptx`, mime: "application/vnd.ms-powerpoint",
  size: 1000, updatedBy: "lorenzo", updatedAt: "2026-01-01T10:00:00Z", version: 1, deleted: false, storageKey: "k", ...over,
});
const event = (id: string, actorId: string, createdAt: string, over: Partial<Activity> = {}): Activity => ({
  id, actorId, projectId: "p", fileId: null, action: "edited", name: "x", createdAt, ...over,
});

const principals = [person("lorenzo", "human"), person("claude", "agent"), person("gone", "agent", "offline")];
const files = [
  file("deck", { version: 2, updatedAt: "2026-01-01T12:00:00Z" }),
  file("brief", { mime: DOCUMENT_MIME, name: "Brief", updatedAt: "2026-01-01T11:00:00Z" }),
  file("old", { deleted: true }),
  file("nested", { folderId: "f1" }),
  file("elsewhere", { projectId: "q" }),
];

test("folderFiles filters by place, tab and trash, then sorts", () => {
  const place = { projectId: "p", folderId: null };
  assert.deepEqual(folderFiles(files, place, "all", "recent").map((f) => f.id), ["deck", "brief"]);
  assert.deepEqual(folderFiles(files, place, "docs", "recent").map((f) => f.id), ["brief"]);
  assert.deepEqual(folderFiles(files, place, "assets", "recent").map((f) => f.id), ["deck"]);
  assert.deepEqual(folderFiles(files, place, "all", "name").map((f) => f.id), ["brief", "deck"]);
  assert.deepEqual(tabCounts(files, place, 2), { all: 4, docs: 1, assets: 1 });
});

test("typeLabel prefers DOC, then the extension, then the MIME subtype", () => {
  assert.equal(typeLabel({ mime: DOCUMENT_MIME, name: "Notes" }), "DOC");
  assert.equal(typeLabel({ mime: "image/jpeg", name: "photo.jpeg" }), "JPEG");
  assert.equal(typeLabel({ mime: "application/pdf", name: "report" }), "PDF");
  assert.equal(typeLabel({ mime: "", name: "blob" }), "FILE");
});

test("projectFiles lists every live file in the project, folders included", () => {
  assert.deepEqual(projectFiles(files, "p", "recent").map((f) => f.id), ["deck", "brief", "nested"]);
  assert.deepEqual(projectFiles(files, "p", "name").map((f) => f.id), ["brief", "deck", "nested"]);
});

test("fileHistory lists who touched a file and its latest change", () => {
  const deck = files[0];
  const activity = [
    event("a1", "lorenzo", "2026-01-01T09:00:00Z", { fileId: "deck", action: "uploaded" }),
    event("a2", "claude", "2026-01-01T12:00:00Z", { fileId: "deck", action: "uploaded a new version of" }),
    event("a3", "claude", "2026-01-01T13:00:00Z", { fileId: "brief" }),
  ];
  const h = fileHistory({ activity, principals }, deck);
  assert.deepEqual(h.people.map((p) => p.id), ["claude", "lorenzo"]);
  assert.equal(h.last.who?.id, "claude");
  assert.equal(h.last.what, "uploaded a new version");
  // No activity loaded for the file: fall back to its metadata.
  const bare = fileHistory({ activity: [], principals }, deck);
  assert.deepEqual(bare.people.map((p) => p.id), ["lorenzo"]);
  assert.equal(bare.last.what, "saved v2");
  assert.equal(bare.last.at, deck.updatedAt);
  assert.equal(shortAction("commented on"), "commented");
  assert.equal(shortAction("uploaded"), "uploaded");
});

test("latestAgentAction returns the newest agent event in the project", () => {
  const activity = [
    event("old", "claude", "2026-01-01T09:00:00Z"),
    event("new", "claude", "2026-01-01T12:00:00Z", { fileId: "deck" }),
    event("human", "lorenzo", "2026-01-01T13:00:00Z"),
  ];
  const latest = latestAgentAction({ activity, principals, files }, "p");
  assert.equal(latest?.event.id, "new");
  assert.equal(latest?.agent.id, "claude");
  assert.equal(latest?.file?.id, "deck");
  assert.equal(latestAgentAction({ activity: [], principals, files }, "p"), null);
});

test("projectMembers keeps people and connected agents with access", () => {
  const grants: Grant[] = [
    { id: "g", principalId: "claude", resourceType: "project", resourceId: "p", allow: ["read"], fullAccess: false },
    { id: "h", principalId: "gone", resourceType: "project", resourceId: "p", allow: ["read"], fullAccess: false },
  ];
  assert.deepEqual(projectMembers({ principals, grants }, "p").map((p) => p.id), ["lorenzo", "claude"]);
  assert.deepEqual(projectMembers({ principals, grants }, "q").map((p) => p.id), ["lorenzo"]);
});

test("formatting helpers", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(3.3 * 1024 * 1024), "3.3 MB");
  assert.equal(formatBytes(250 * 1024), "250 KB");
  assert.equal(storageUsed(files), 5000);
  const now = Date.parse("2026-01-02T00:00:00Z");
  assert.equal(relativeTime("2026-01-01T23:59:40Z", now), "Just now");
  assert.equal(relativeTime("2026-01-01T23:15:00Z", now), "45 min ago");
  assert.equal(relativeTime("2026-01-01T12:00:00Z", now), "12 h ago");
  assert.equal(relativeTime("2025-12-30T00:00:00Z", now), "3 d ago");
  assert.equal(versionLabel(1), "1 version");
  assert.equal(versionLabel(2), "2 versions");
});
