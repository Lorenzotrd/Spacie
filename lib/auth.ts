import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { admin, demo, load } from "./repository";
import { ids } from "./seed";
import type { Principal, WorkspaceState } from "./types";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () =>
  `spc_agent_${randomBytes(32).toString("base64url")}`;
export async function authClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        },
      },
    },
  );
}
export async function authenticate(
  request: Request,
): Promise<{ state: WorkspaceState; actor: Principal }> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (token) {
    let workspaceId: string | undefined;
    if (!demo()) {
      const { data } = await admin()
        .from("agent_tokens")
        .select("workspace_id")
        .eq("token_hash", hashToken(token))
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!data) throw new Error("UNAUTHORIZED");
      workspaceId = data.workspace_id;
    }
    const state = await load(workspaceId);
    const record = state.tokens.find(
      (t) =>
        t.hash === hashToken(token) &&
        !t.revokedAt &&
        new Date(t.expiresAt) > new Date(),
    );
    const actor = state.principals.find(
      (p) => p.id === record?.principalId && p.type === "agent",
    );
    if (!record || !actor || actor.status === "offline")
      throw new Error("UNAUTHORIZED");
    return { state, actor };
  }
  if (demo()) {
    const host = new URL(request.url).hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
      throw new Error("Demo mode only accepts loopback requests.");
    const state = await load();
    return {
      state,
      actor: state.principals.find((p) => p.id === ids.lorenzo)!,
    };
  }
  const {
    data: { user },
  } = await (await authClient()).auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");
  const { data: membership, error } = await admin()
    .from("workspace_members")
    .select("workspace_id,principal_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error || !membership) throw new Error("No workspace membership.");
  const state = await load(membership.workspace_id);
  const actor = state.principals.find((p) => p.id === membership.principal_id);
  if (!actor) throw new Error("UNAUTHORIZED");
  return { state, actor };
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.SPACIE_ORIGIN;
  const valid =
    origin === configured ||
    origin === new URL(request.url).origin ||
    (demo() &&
      !!origin &&
      ["http://127.0.0.1:3000", "http://localhost:3000"].includes(origin));
  if (origin && !valid) throw new Error("FORBIDDEN: Origin mismatch.");
  if (!origin && !request.headers.get("authorization"))
    throw new Error("FORBIDDEN: Origin required.");
}
