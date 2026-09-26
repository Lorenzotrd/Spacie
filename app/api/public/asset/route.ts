import { objectStorage } from "@/lib/config";
import { db } from "@/lib/db/client";
import { publicFailure, shareCredentials } from "@/lib/public-http";
import { rateLimit } from "@/lib/rate-limit";
import { publicFileDetail, ShareAccessError } from "@/lib/share-links";
import { assetUrl, localAsset } from "@/lib/storage";
export const runtime = "nodejs";
const ASSET_REQUESTS = 300;

/**
 * Bytes of a shared file (`preview=1`: its PDF rendition). `download=1` asks for an
 * attachment and is refused when the link forbids downloads.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    await rateLimit(`share-asset:${token.slice(0, 32)}`, ASSET_REQUESTS);
    const fileId = url.searchParams.get("file") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw new ShareAccessError("not_found");
    const { file, allowDownload } = await publicFileDetail(await db(), token, fileId, shareCredentials(request));
    const preview = url.searchParams.has("preview");
    const download = url.searchParams.has("download");
    if (download && !allowDownload) throw new Error("FORBIDDEN: Downloads are turned off for this link.");
    const key = preview ? file.previewKey : file.storageKey;
    if (!key) throw new ShareAccessError("not_found");
    const mime = preview ? "application/pdf" : file.mime;
    const filename = encodeURIComponent(preview ? `${file.name}.pdf` : file.name);
    const disposition = `${download ? "attachment" : "inline"}; filename*=UTF-8''${filename}`;
    if (objectStorage()) return Response.redirect(await assetUrl(key, disposition), 302);
    return new Response(new Uint8Array(await localAsset(key)), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    return publicFailure(e);
  }
}
