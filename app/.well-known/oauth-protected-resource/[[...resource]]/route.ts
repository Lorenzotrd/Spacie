import { oauthJson, preflight } from "@/lib/oauth/errors";
import { protectedResource, publicOrigin } from "@/lib/oauth/metadata";
export const dynamic = "force-dynamic";
/** Served at the root and at the MCP path suffix (RFC 9728 §3.1). */
export function GET(request: Request) {
  return oauthJson(protectedResource(publicOrigin(request)));
}
export const OPTIONS = preflight;
