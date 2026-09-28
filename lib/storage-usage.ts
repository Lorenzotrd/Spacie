import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./db/client";
import { loadAccess } from "./access";
import { requirePermission } from "./permissions";
import type { Principal } from "./types";
import { storageQuotaBytes } from "./config";

export type StorageKind = "Presentations" | "Documents" | "Spreadsheets" | "PDFs" | "Images" | "Videos" | "Other";
export type Backup = { name: string; at: string; bytes: number };
export type StorageUsage = {
  /** Everything stored: current files, older versions and the trash. */
  usedBytes: number;
  versionBytes: number;
  trashBytes: number;
  trashCount: number;
  /** SPACIE_STORAGE_QUOTA_GB, or the default allowance. */
  quotaBytes: number | null;
  byKind: { kind: StorageKind; bytes: number }[];
  byProject: { id: string; name: string; bytes: number; files: number; versions: number }[];
  /** Null when the server does not expose its backups (SPACIE_BACKUP_DIR). */
  backups: Backup[] | null;
};

export function kindOf(mime: string, name = ""): StorageKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (/presentation|powerpoint|keynote/.test(mime) || ["ppt", "pptx", "key"].includes(ext)) return "Presentations";
  if (/spreadsheet|excel|csv/.test(mime) || ["xls", "xlsx", "csv"].includes(ext)) return "Spreadsheets";
  if (mime === "application/pdf") return "PDFs";
  if (mime.startsWith("image/")) return "Images";
  if (mime.startsWith("video/")) return "Videos";
  if (/^text\/|wordprocessing|msword|rtf|markdown|json/.test(mime) || ["doc", "docx", "md", "txt"].includes(ext))
    return "Documents";
  return "Other";
}

const KIND_ORDER: StorageKind[] = ["Presentations", "Documents", "Spreadsheets", "PDFs", "Images", "Videos", "Other"];
const BACKUP_LIMIT = 30;

async function sizeOf(entry: string): Promise<number> {
  const info = await stat(entry);
  if (!info.isDirectory()) return info.size;
  const children = await readdir(entry);
  const sizes = await Promise.all(children.map((c) => stat(path.join(entry, c)).then((s) => (s.isFile() ? s.size : 0), () => 0)));
  return sizes.reduce((a, b) => a + b, 0);
}

/**
 * The newest backups in SPACIE_BACKUP_DIR, or null when it is not set or not readable.
 * A nightly run writes several files (e.g. db-2026-09-27.dump and assets-2026-09-27.tar.gz):
 * files whose names carry the same date count as one backup.
 */
export async function listBackups(dir = process.env.SPACIE_BACKUP_DIR): Promise<Backup[] | null> {
  if (!dir) return null;
  try {
    const names = (await readdir(dir)).filter((n) => !n.startsWith("."));
    const entries = await Promise.all(
      names.map(async (name) => {
        const full = path.join(dir, name);
        const info = await stat(full);
        return { name, at: info.mtime.toISOString(), bytes: await sizeOf(full) };
      }),
    );
    const runs = new Map<string, Backup>();
    for (const e of entries) {
      const key = /\d{4}-\d{2}-\d{2}/.exec(e.name)?.[0] ?? e.name;
      const run = runs.get(key);
      runs.set(
        key,
        run ? { name: key, at: run.at > e.at ? run.at : e.at, bytes: run.bytes + e.bytes } : { ...e, name: key },
      );
    }
    return [...runs.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, BACKUP_LIMIT);
  } catch {
    return null;
  }
}

/** Storage used by the actor's workspace. Owners and admins only. */
export async function storageUsage(db: Db, actor: Principal): Promise<StorageUsage> {
  requirePermission(await loadAccess(db, actor), actor, "manage_members", { workspaceId: actor.workspaceId });
  const files = await db.query<{ project_id: string; name: string; mime: string; bytes: string; deleted: boolean }>(
    `select project_id, name, mime, greatest(size, octet_length(content))::text as bytes, deleted
     from files where workspace_id = $1`,
    [actor.workspaceId],
  );
  const versions = await db.query<{ project_id: string; name: string; mime: string; bytes: string; count: string }>(
    `select f.project_id, f.name, coalesce(v.mime, f.mime) as mime,
       sum(greatest(coalesce(v.size, 0), octet_length(v.content)))::text as bytes, count(*)::text as count
     from file_versions v join files f on f.id = v.file_id
     where v.workspace_id = $1 and v.number < f.version
     group by f.project_id, f.name, coalesce(v.mime, f.mime)`,
    [actor.workspaceId],
  );
  const projects = await db.query<{ id: string; name: string }>(
    "select id, name from projects where workspace_id = $1 order by created_at, id",
    [actor.workspaceId],
  );

  const kinds = new Map<StorageKind, number>();
  const perProject = new Map(projects.map((p) => [p.id, { ...p, bytes: 0, files: 0, versions: 0 }]));
  let used = 0;
  let versionBytes = 0;
  let trashBytes = 0;
  let trashCount = 0;
  for (const f of files) {
    const bytes = Number(f.bytes);
    used += bytes;
    kinds.set(kindOf(f.mime, f.name), (kinds.get(kindOf(f.mime, f.name)) ?? 0) + bytes);
    const project = perProject.get(f.project_id);
    if (project) project.bytes += bytes;
    if (f.deleted) {
      trashBytes += bytes;
      trashCount += 1;
    } else if (project) project.files += 1;
  }
  for (const v of versions) {
    const bytes = Number(v.bytes);
    used += bytes;
    versionBytes += bytes;
    kinds.set(kindOf(v.mime, v.name), (kinds.get(kindOf(v.mime, v.name)) ?? 0) + bytes);
    const project = perProject.get(v.project_id);
    if (project) {
      project.bytes += bytes;
      project.versions += Number(v.count);
    }
  }
  return {
    usedBytes: used,
    versionBytes,
    trashBytes,
    trashCount,
    quotaBytes: storageQuotaBytes(),
    byKind: KIND_ORDER.filter((k) => kinds.get(k)).map((kind) => ({ kind, bytes: kinds.get(kind)! })),
    byProject: [...perProject.values()].sort((a, b) => b.bytes - a.bytes),
    backups: await listBackups(),
  };
}
