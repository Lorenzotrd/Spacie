import { boundedRequest } from "@/lib/http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { authenticate, assertSameOrigin } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prepareDirectUpload, verifyDirectUpload } from "@/lib/storage";
import { objectStorage } from "@/lib/config";
import { db } from "@/lib/db/client";
import { loadAccess } from "@/lib/access";
import { destination } from "@/lib/service/context";
import { execute } from "@/lib/service";
import { rateLimit } from "@/lib/rate-limit";
import { failure } from "@/lib/http";
const metadata = z.object({
  projectId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  name: z.string().min(1).max(180),
  mime: z.string().max(120),
  size: z.number().int().min(0).max(104857600),
});
const ticketSchema = metadata.extend({
  key: z.string(),
  actorId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  expires: z.number(),
});
function sign(payload: string) {
  const secret = process.env.SPACIE_UPLOAD_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Uploads are not configured: set SPACIE_UPLOAD_SECRET.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { actor } = await authenticate(request);
    await rateLimit(actor.id);
    if (!objectStorage()) throw new Error("Direct uploads need object storage; use /api/assets.");
    const database = await db();
    const access = await loadAccess(database, actor);
    const body = await (await boundedRequest(request, 10000)).json();
    if (body.ticket) {
      const [payload, signature] = z
        .string()
        .max(5000)
        .parse(body.ticket)
        .split(".");
      const expected = sign(payload),
        provided = Buffer.from(signature ?? "");
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, Buffer.from(expected))
      )
        throw new Error("Invalid upload ticket");
      const data = ticketSchema.parse(
        JSON.parse(Buffer.from(payload, "base64url").toString()),
      );
      if (
        data.actorId !== actor.id ||
        data.workspaceId !== actor.workspaceId ||
        data.expires < Date.now()
      )
        throw new Error("Upload ticket expired or does not belong to you");
      requirePermission(
        access,
        actor,
        "upload",
        await destination(database, access, data.projectId, data.folderId),
      );
      const finalKey = await verifyDirectUpload(data.key, data.mime, data.size);
      const result = await execute(database, actor, {
        action: "upload_asset",
        projectId: data.projectId,
        folderId: data.folderId,
        name: data.name,
        mime: data.mime,
        size: data.size,
        storageKey: finalKey,
      });
      return Response.json(result);
    }
    const input = metadata.parse(body);
    requirePermission(
      access,
      actor,
      "upload",
      await destination(database, access, input.projectId, input.folderId),
    );
    const key = `${actor.workspaceId}/staging/${randomUUID()}`;
    const url = await prepareDirectUpload(key, input.mime, input.size);
    const payload = Buffer.from(
      JSON.stringify({
        ...input,
        key,
        actorId: actor.id,
        workspaceId: actor.workspaceId,
        expires: Date.now() + 600000,
      }),
    ).toString("base64url");
    return Response.json({ url, ticket: `${payload}.${sign(payload)}` });
  } catch (e) {
    return failure(e);
  }
}
