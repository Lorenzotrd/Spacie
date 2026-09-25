import { randomBytes } from "node:crypto";
import type { Db } from "./db/client";
import { loadAccess } from "./access";
import { columns, fromRow } from "./db/rows";
import { requirePermission } from "./permissions";
import { execute } from "./service";
import { destination } from "./service/context";
import { isAllowedType, MAX_ASSET_BYTES, storeAsset } from "./storage";
import { hashToken } from "./tokens";
import type { Principal } from "./types";

const LINK_TTL_MS = 30 * 60_000;

export type UploadLinkInput = {
  projectId: string;
  folderId: string | null;
  name: string;
  mime: string;
};

/** Issues a single-use link that accepts one file for a destination the agent can upload to. */
export async function createUploadLink(db: Db, actor: Principal, input: UploadLinkInput, origin: string) {
  if (!isAllowedType(input.mime))
    throw new Error(`Unsupported file type ${input.mime}. Use a PDF, image, video, audio, text, CSV, ZIP, or Office file.`);
  const access = await loadAccess(db, actor);
  requirePermission(access, actor, "upload", await destination(db, access, input.projectId, input.folderId));
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();
  await db.query(
    `insert into upload_links (token_hash, workspace_id, agent_id, project_id, folder_id, name, mime, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [hashToken(token), actor.workspaceId, actor.id, input.projectId, input.folderId, input.name, input.mime, expiresAt],
  );
  const url = `${origin}/api/upload-links?token=${token}`;
  return {
    url,
    method: "PUT",
    expiresAt,
    maxBytes: MAX_ASSET_BYTES,
    howTo: `Send the raw file bytes once, before it expires: curl --fail -T "<path to file>" "${url}"`,
  };
}

/**
 * Stores the bytes and records the file as the agent that requested the link.
 * The link is claimed first, so a concurrent second upload cannot reuse it.
 */
export async function consumeUploadLink(db: Db, token: string, bytes: Uint8Array<ArrayBuffer>) {
  if (!bytes.byteLength) throw new Error("The upload was empty. Send the file bytes with curl -T.");
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error("Files must be smaller than 100 MB.");
  const [link] = await db.query<{
    workspace_id: string; agent_id: string; project_id: string; folder_id: string | null; name: string; mime: string;
  }>(
    `update upload_links set used_at = now()
     where token_hash = $1 and used_at is null and expires_at > now()
     returning workspace_id, agent_id, project_id, folder_id, name, mime`,
    [hashToken(token)],
  );
  if (!link) throw new Error("This upload link is invalid, expired, or already used. Ask for a new one.");
  const [row] = await db.query(
    `select ${columns.principal} from principals where id = $1 and workspace_id = $2 and type = 'agent'`,
    [link.agent_id, link.workspace_id],
  );
  if (!row) throw new Error("UNAUTHORIZED");
  const agent = fromRow<Principal>(row);
  const storageKey = await storeAsset(new File([bytes], link.name, { type: link.mime }), link.workspace_id);
  // execute() re-checks that the agent is still connected and still allowed to upload here.
  const result = await execute(db, agent, {
    action: "upload_asset",
    projectId: link.project_id,
    folderId: link.folder_id,
    name: link.name,
    mime: link.mime,
    size: bytes.byteLength,
    storageKey,
  });
  await db.query("update upload_links set file_id = $2 where token_hash = $1", [hashToken(token), result.id]);
  return { id: result.id, name: link.name, size: bytes.byteLength };
}
