import { failure } from "@/lib/http";
import { authenticate } from "@/lib/auth";
import { storageUsage } from "@/lib/storage-usage";
import { db } from "@/lib/db/client";
export const runtime = "nodejs";

/** Storage used by the open workspace, by type and project, plus server backups. Owners and admins. */
export async function GET(request: Request) {
  try {
    const { actor } = await authenticate(request);
    return Response.json(await storageUsage(await db(), actor), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
