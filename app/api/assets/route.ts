import { z } from "zod";
import { boundedRequest } from "@/lib/http";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { assetUrl, localAsset, storeAsset } from "@/lib/storage";
import { objectStorage } from "@/lib/config";
import { db } from "@/lib/db/client";
import { loadAccess } from "@/lib/access";
import { findReadableFile } from "@/lib/queries";
import { destination } from "@/lib/service/context";
import { execute } from "@/lib/service";
import { rateLimit } from "@/lib/rate-limit";
import { failure } from "@/lib/http";
export const runtime = "nodejs";
const location = z.object({
  projectId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    await rateLimit(actor.id);
    const form = await (await boundedRequest(request, 105000000)).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file.");
    const { projectId, folderId } = location.parse({
      projectId: form.get("projectId"),
      folderId: form.get("folderId") || null,
    });
    const database = await db();
    const access = await loadAccess(database, actor);
    requirePermission(
      access,
      actor,
      "upload",
      await destination(database, access, projectId, folderId),
    );
    const key = await storeAsset(file, actor.workspaceId);
    const result = await execute(database, actor, {
      action: "upload_asset",
      projectId,
      folderId,
      name: file.name,
      mime: file.type,
      size: file.size,
      storageKey: key,
    });
    return Response.json(result);
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "";
    const file = /^[0-9a-f-]{36}$/i.test(id)
      ? await findReadableFile(await db(), actor, id)
      : null;
    if (!file?.storageKey || file.deleted) throw new Error("Asset not found");
    // `preview=1` serves the PDF rendition of an office file; `version=N` an older upload.
    const preview = url.searchParams.has("preview");
    const version = Number(url.searchParams.get("version") ?? "") || null;
    const download = url.searchParams.has("download");
    const { key, mime } = await storedBytes(file, { preview, version });
    const params = `${preview ? "&preview=1" : ""}${version ? `&version=${version}` : ""}${download ? "&download=1" : ""}`;
    if (!objectStorage()) {
      if (url.searchParams.has("raw")) {
        const bytes = await localAsset(key);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": mime,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "private, no-store",
            ...(download
              ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}` }
              : {}),
          },
        });
      }
      return Response.json({ url: `/api/assets?id=${file.id}&raw=1${params}` });
    }
    return Response.json({ url: await assetUrl(key, download ? "attachment" : "inline") });
  } catch (e) {
    return failure(e);
  }
}

/** The storage key and type to serve: the current bytes, the PDF preview, or an older version. */
async function storedBytes(
  file: { id: string; storageKey?: string; mime: string },
  options: { preview: boolean; version: number | null },
): Promise<{ key: string; mime: string }> {
  const database = await db();
  if (options.preview) {
    const [row] = await database.query<{ preview_key: string | null }>(
      "select preview_key from files where id = $1 and preview_status = 'ready'",
      [file.id],
    );
    if (!row?.preview_key) throw new Error("Preview not found");
    return { key: row.preview_key, mime: "application/pdf" };
  }
  if (options.version) {
    const [row] = await database.query<{ storage_key: string | null; mime: string | null }>(
      "select storage_key, mime from file_versions where file_id = $1 and number = $2",
      [file.id, options.version],
    );
    if (!row?.storage_key) throw new Error("Version not found");
    return { key: row.storage_key, mime: row.mime ?? file.mime };
  }
  return { key: file.storageKey!, mime: file.mime };
}
