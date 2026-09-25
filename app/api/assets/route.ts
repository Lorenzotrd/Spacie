import { boundedRequest } from "@/lib/http";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { assetUrl, localAsset, storeAsset } from "@/lib/storage";
import { demo, transaction } from "@/lib/repository";
import { execute } from "@/lib/service";
import { rateLimit } from "@/lib/rate-limit";
import { failure } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { state, actor } = await authenticate(request);
    await rateLimit(actor.id);
    const form = await (await boundedRequest(request, 105000000)).formData();
    const file = form.get("file"),
      projectId = String(form.get("projectId") ?? ""),
      folderId = form.get("folderId") ? String(form.get("folderId")) : null;
    if (!(file instanceof File)) throw new Error("Choose a file.");
    if (
      !state.projects.some((p) => p.id === projectId) ||
      (folderId &&
        !state.folders.some(
          (f) => f.id === folderId && f.projectId === projectId,
        ))
    )
      throw new Error("Invalid destination");
    requirePermission(state, actor, "upload", {
      workspaceId: state.workspace.id,
      projectId,
      folderId,
    });
    const key = await storeAsset(file, state.workspace.id);
    const result = await transaction(state.workspace.id, (s) =>
      execute(s, actor, {
        action: "upload_asset",
        projectId,
        folderId,
        name: file.name,
        mime: file.type,
        size: file.size,
        storageKey: key,
      }),
    );
    return Response.json(result);
  } catch (e) {
    return failure(e);
  }
}
export async function GET(request: Request) {
  try {
    const { state, actor } = await authenticate(request);
    const url = new URL(request.url),
      file = state.files.find(
        (f) => f.id === url.searchParams.get("id") && !f.deleted,
      );
    if (!file?.storageKey) throw new Error("Asset not found");
    requirePermission(state, actor, "read", file);
    if (demo()) {
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
