import { failure } from "@/lib/http";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { openDownloadLink } from "@/lib/download-links";
export const runtime = "nodejs";

/** The link token alone authorizes the download; no cookie or bearer token is involved. */
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Download link not found");
    await rateLimit(`download-link:${token.slice(0, 12)}`, 20);
    const file = await openDownloadLink(await db(), token);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.bytes.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
