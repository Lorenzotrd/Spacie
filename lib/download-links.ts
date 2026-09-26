import { randomBytes } from "node:crypto";
import type { Db } from "./db/client";
import { columns, fromRow } from "./db/rows";
import { findReadableFile } from "./queries";
import { DOCUMENT_MIME } from "./service/files";
import { readAsset } from "./storage";
import { hashToken } from "./tokens";
import type { Principal } from "./types";

const LINK_TTL_MS = 15 * 60_000;
/** Text files up to this size are also returned inline, so the agent needs no download. */
const INLINE_TEXT_BYTES = 256 * 1024;
const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);

export type DownloadLinkInput = { fileId: string; version?: number; preview?: boolean };

type Resolved = { name: string; mime: string; storageKey: string; version: number };

/** Finds the bytes an actor may read: the current file, one of its versions, or its PDF preview. */
async function resolve(db: Db, actor: Principal, input: DownloadLinkInput): Promise<Resolved> {
  const file = await findReadableFile(db, actor, input.fileId);
  if (!file || file.deleted) throw new Error("File not found or access denied");
  if (file.mime === DOCUMENT_MIME)
    throw new Error("This is a Spacie document: use read_document to get its HTML.");
  if (input.preview) {
    const [row] = await db.query<{ preview_key: string | null }>(
      "select preview_key from files where id = $1 and preview_status = 'ready'",
      [file.id],
    );
    if (!row?.preview_key) throw new Error("No PDF preview is ready for this file.");
    return { name: file.name.replace(/\.[^.]+$/, "") + ".pdf", mime: "application/pdf", storageKey: row.preview_key, version: file.version };
  }
  if (input.version && input.version !== file.version) {
    const [row] = await db.query<{ storage_key: string | null; mime: string | null }>(
      "select storage_key, mime from file_versions where file_id = $1 and number = $2",
      [file.id, input.version],
    );
    if (!row?.storage_key) throw new Error("Version not found");
    return { name: file.name, mime: row.mime ?? file.mime, storageKey: row.storage_key, version: input.version };
  }
  if (!file.storageKey) throw new Error("This file has no stored bytes.");
  return { name: file.name, mime: file.mime, storageKey: file.storageKey, version: file.version };
}

/** Issues a 15-minute link to fetch a stored file the agent can read, plus inline text for small text files. */
export async function createDownloadLink(db: Db, actor: Principal, input: DownloadLinkInput, origin: string) {
  const target = await resolve(db, actor, input);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();
  await db.query(
    `insert into download_links (token_hash, workspace_id, agent_id, file_id, version, preview, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [hashToken(token), actor.workspaceId, actor.id, input.fileId, input.version ?? null, !!input.preview, expiresAt],
  );
  await db.query("delete from download_links where expires_at < now() - interval '1 day'");
  const url = `${origin}/api/download-links?token=${token}`;
  const inline = TEXT_TYPES.has(target.mime) ? await readAsset(target.storageKey) : null;
  return {
    url,
    expiresAt,
    name: target.name,
    mime: target.mime,
    version: target.version,
    howTo: `Fetch it before it expires: curl --fail -o "${target.name.replace(/"/g, "")}" "${url}"`,
    text: inline && inline.byteLength <= INLINE_TEXT_BYTES ? inline.toString("utf8") : undefined,
  };
}

/** Serves the bytes behind a link, re-checking that its agent is still connected and can still read the file. */
export async function openDownloadLink(db: Db, token: string) {
  const [link] = await db.query<{
    workspace_id: string; agent_id: string; file_id: string; version: number | null; preview: boolean;
  }>(
    `select workspace_id, agent_id, file_id, version, preview from download_links
     where token_hash = $1 and expires_at > now()`,
    [hashToken(token)],
  );
  if (!link) throw new Error("This download link is invalid or expired. Ask for a new one.");
  const [row] = await db.query(
    `select ${columns.principal} from principals where id = $1 and workspace_id = $2 and type = 'agent' and status <> 'offline'`,
    [link.agent_id, link.workspace_id],
  );
  if (!row) throw new Error("This download link is invalid or expired. Ask for a new one.");
  const target = await resolve(db, fromRow<Principal>(row), {
    fileId: link.file_id, version: link.version ?? undefined, preview: link.preview,
  }).catch(() => {
    throw new Error("File not found or access denied");
  });
  return { name: target.name, mime: target.mime, bytes: await readAsset(target.storageKey) };
}
