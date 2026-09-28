import type { Activity, FileMeta, Principal, PublicState } from "@/lib/types";
import { withZone } from "./time-zone";

/** Native Spacie documents; everything else in a project is an uploaded asset. */
export const DOCUMENT_MIME = "application/x-spacie-doc";

export type FileTab = "all" | "docs" | "assets";
export type FileSort = "recent" | "name";

export const isDocument = (f: Pick<FileMeta, "mime">) => f.mime === DOCUMENT_MIME;

export const matchesTab = (f: Pick<FileMeta, "mime">, tab: FileTab) =>
  tab === "all" || (tab === "docs") === isDocument(f);

/** Live files directly inside a project folder (or its root), for one tab, sorted. */
export function folderFiles(
  files: readonly FileMeta[],
  place: { projectId: string; folderId: string | null },
  tab: FileTab,
  sort: FileSort,
): FileMeta[] {
  const list = files.filter(
    (f) => f.projectId === place.projectId && f.folderId === place.folderId && !f.deleted && matchesTab(f, tab),
  );
  return sortFiles(list, sort);
}

/** Tab counts for a folder: folders count toward "all" only. */
export function tabCounts(
  files: readonly FileMeta[],
  place: { projectId: string; folderId: string | null },
  folderCount: number,
): Record<FileTab, number> {
  const here = files.filter((f) => f.projectId === place.projectId && f.folderId === place.folderId && !f.deleted);
  const docs = here.filter(isDocument).length;
  return { all: here.length + folderCount, docs, assets: here.length - docs };
}

/** Short type tag: DOC for documents, else the extension (PPTX, JPEG) or the MIME subtype. */
export function typeLabel(f: Pick<FileMeta, "mime" | "name">): string {
  if (isDocument(f)) return "DOC";
  const ext = /\.([a-z0-9]{1,5})$/i.exec(f.name)?.[1];
  if (ext) return ext.toUpperCase();
  return (f.mime.split("/")[1] ?? "FILE").split(/[.+-]/)[0].slice(0, 5).toUpperCase() || "FILE";
}

export const isAgent = (state: Pick<PublicState, "principals">, id: string) =>
  state.principals.some((p) => p.id === id && p.type === "agent");

export const principalById = (state: Pick<PublicState, "principals">, id: string | undefined): Principal | undefined =>
  id ? state.principals.find((p) => p.id === id) : undefined;

/** Every live file in a project, wherever it sits, sorted. */
export function projectFiles(files: readonly FileMeta[], projectId: string, sort: FileSort): FileMeta[] {
  return sortFiles(files.filter((f) => f.projectId === projectId && !f.deleted), sort);
}

export function sortFiles(list: readonly FileMeta[], sort: FileSort): FileMeta[] {
  return sort === "name"
    ? [...list].sort((a, b) => a.name.localeCompare(b.name))
    : [...list].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** "commented on" reads "commented" next to the file it is about. */
export const shortAction = (action: string) => action.replace(/\s+(of|on|to|in|for)$/, "");

export type FileHistory = {
  /** Distinct people and agents who touched the file, most recent first. */
  people: Principal[];
  last: { who: Principal | undefined; what: string; at: string };
};

/** Who worked on a file and its latest change, from the loaded activity (newest 100). */
export function fileHistory(state: Pick<PublicState, "activity" | "principals">, file: FileMeta, max = 3): FileHistory {
  const events = state.activity
    .filter((a) => a.fileId === file.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const ids = [...new Set([...events.map((e) => e.actorId), file.updatedBy])];
  const people = ids.map((id) => principalById(state, id)).filter((p): p is Principal => !!p).slice(0, max);
  const latest = events[0];
  const last = latest && Date.parse(latest.createdAt) >= Date.parse(file.updatedAt) - 1000
    ? { who: principalById(state, latest.actorId), what: shortAction(latest.action), at: latest.createdAt }
    : { who: principalById(state, file.updatedBy), what: file.version > 1 ? `saved v${file.version}` : "added it", at: file.updatedAt };
  return { people, last };
}

/** The most recent thing an agent did in a project, with the agent and file it touched. */
export function latestAgentAction(
  state: Pick<PublicState, "activity" | "principals" | "files">,
  projectId: string,
): { event: Activity; agent: Principal; file: FileMeta | undefined } | null {
  const event = [...state.activity]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .find((a) => a.projectId === projectId && isAgent(state, a.actorId));
  if (!event) return null;
  const agent = principalById(state, event.actorId)!;
  return { event, agent, file: state.files.find((f) => f.id === event.fileId) };
}

/** People and connected agents who can work in a project. */
export function projectMembers(state: Pick<PublicState, "principals" | "grants">, projectId: string): Principal[] {
  return state.principals.filter(
    (p) =>
      p.type === "human" ||
      (p.status !== "offline" &&
        state.grants.some(
          (g) => g.principalId === p.id && (g.resourceType === "workspace" || g.resourceId === projectId),
        )),
  );
}

/** Bytes stored for current versions of uploaded files, trash included. */
export const storageUsed = (files: readonly FileMeta[]) =>
  files.filter((f) => f.storageKey).reduce((n, f) => n + f.size, 0);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function relativeTime(date: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
  if (minutes < 7 * 1440) return `${Math.floor(minutes / 1440)} d ago`;
  return new Date(date).toLocaleDateString("en", withZone({ month: "short", day: "numeric" }));
}

export const versionLabel = (n: number) => `${n} version${n === 1 ? "" : "s"}`;

/** "1 file", "6 files": live files in a project. */
export function fileCount(files: readonly FileMeta[], projectId: string): string {
  const n = files.filter((f) => f.projectId === projectId && !f.deleted).length;
  return `${n} file${n === 1 ? "" : "s"}`;
}
