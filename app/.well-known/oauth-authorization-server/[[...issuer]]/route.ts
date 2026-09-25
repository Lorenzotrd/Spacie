import { oauthJson, preflight } from "@/lib/oauth/errors";
import { authorizationServer, publicOrigin } from "@/lib/oauth/metadata";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return oauthJson(authorizationServer(publicOrigin(request)));
}
export const OPTIONS = preflight;
