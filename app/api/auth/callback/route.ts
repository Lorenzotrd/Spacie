import { authClient } from "@/lib/auth";
import { admin } from "@/lib/repository";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const kind = url.searchParams.get("type");
  if (
    code ||
    (tokenHash && ["invite", "magiclink", "email"].includes(kind ?? ""))
  ) {
    const client = await authClient();
    const { data, error } = code
      ? await client.auth.exchangeCodeForSession(code)
      : await client.auth.verifyOtp({
          token_hash: tokenHash!,
          type: kind as "invite" | "magiclink" | "email",
        });
    if (!error && data.user) {
      const { error: setup } = await admin().rpc("spacie_bootstrap", {
        uid: data.user.id,
        email_address: data.user.email ?? "",
        display_name:
          data.user.user_metadata.full_name ??
          data.user.email?.split("@")[0] ??
          "Teammate",
      });
      if (!setup)
        return Response.redirect(
          new URL("/workspace", process.env.SPACIE_ORIGIN ?? url.origin),
        );
    }
  }
  return Response.redirect(
    new URL(
      "/login?error=Could%20not%20complete%20sign-in",
      process.env.SPACIE_ORIGIN ?? url.origin,
    ),
  );
}
