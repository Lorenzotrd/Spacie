import { failure } from "@/lib/http";
import { boundedRequest } from "@/lib/http";
import { db } from "@/lib/db/client";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_ASSET_BYTES } from "@/lib/storage";
import { consumeUploadLink } from "@/lib/upload-links";
export const runtime = "nodejs";
/** Headroom over the file limit for multipart framing if a client sends a form. */
const MAX_BODY = MAX_ASSET_BYTES + 1_000_000;

/** The link token authorizes exactly one upload; no cookie or bearer token is involved. */
async function upload(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Upload link not found");
    await rateLimit(`upload-link:${token.slice(0, 12)}`, 10);
    const body = await boundedRequest(request, MAX_BODY);
    let bytes: Uint8Array<ArrayBuffer>;
    if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const file = (await body.formData()).get("file");
      if (!(file instanceof File)) throw new Error("Send the file in a form field named file, or as the raw body.");
      bytes = new Uint8Array(await file.arrayBuffer());
    } else bytes = new Uint8Array(await body.arrayBuffer());
    return Response.json(await consumeUploadLink(await db(), token, bytes), { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
export const PUT = upload;
export const POST = upload;
