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
    if (!objectStorage()) {
      if (url.searchParams.has("raw")) {
        const bytes = await localAsset(file.storageKey);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": file.mime,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "private, no-store",
          },
        });
      }
      return Response.json({ url: `/api/assets?id=${file.id}&raw=1` });
    }
    return Response.json({ url: await assetUrl(file.storageKey) });
  } catch (e) {
    return failure(e);
  }
}
