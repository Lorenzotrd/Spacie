import { db } from "@/lib/db/client";
import { publicFailure, publicJson, shareCredentials } from "@/lib/public-http";
import { rateLimit } from "@/lib/rate-limit";
import { publicFileDetail, publicView } from "@/lib/share-links";
export const runtime = "nodejs";
/** Views per link per minute, which also bounds password guessing. */
const LINK_REQUESTS = 60;

/** `?token=` opens a share link; `&file=` returns one file inside it. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    await rateLimit(`share:${token.slice(0, 32)}`, LINK_REQUESTS);
    const credentials = shareCredentials(request);
    const database = await db();
    const fileId = url.searchParams.get("file");
    if (!fileId) return publicJson(await publicView(database, token, credentials));
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw new Error("File not found");
    const { file, allowDownload } = await publicFileDetail(database, token, fileId, credentials);
    return publicJson({
      id: file.id,
      name: file.name,
      mime: file.mime,
      size: file.size,
      updatedAt: file.updatedAt,
      content: file.mime === "application/x-spacie-doc" ? file.content : "",
      hasBinary: !!file.storageKey,
      previewReady: file.previewStatus === "ready" && !!file.previewKey,
      previewStatus: file.previewStatus,
      allowDownload,
    });
  } catch (e) {
    return publicFailure(e);
  }
}
