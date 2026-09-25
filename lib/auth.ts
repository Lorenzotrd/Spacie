import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { demo } from "./config";
import { db } from "./db/client";
import { columns, fromRow } from "./db/rows";
import { ids } from "./seed";
import { hashToken } from "./tokens";
import type { Principal } from "./types";

export { hashToken, newToken } from "./tokens";

/** Supabase is used for human sign-in (magic links, invitations) only. */
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

export function authAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Sign-in is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function principalBy(where: string, value: string) {
  const [row] = await (await db()).query(
    `select ${columns.principal} from principals where ${where} limit 1`,
    [value],
  );
  return row ? fromRow<Principal>(row) : null;
}

async function agentFromToken(token: string) {
  const [row] = await (await db()).query(
    `select ${columns.principal} from principals
     where type = 'agent' and status <> 'offline' and (id, workspace_id) = (
       select principal_id, workspace_id from agent_tokens
       where token_hash = $1 and revoked_at is null and expires_at > now())`,
    [hashToken(token)],
  );
  return row ? fromRow<Principal>(row) : null;
}

/** Resolves the calling principal: a bearer agent token, the demo owner, or a signed-in human. */
export async function authenticate(request: Request): Promise<{ actor: Principal }> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (token) {
    const actor = await agentFromToken(token);
    if (!actor) throw new Error("UNAUTHORIZED");
    return { actor };
  }
  if (demo()) {
    const host = new URL(request.url).hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
      throw new Error("Demo mode only accepts loopback requests.");
    const actor = await principalBy("id = $1", ids.lorenzo);
    if (!actor) throw new Error("UNAUTHORIZED");
    return { actor };
  }
  const {
    data: { user },
  } = await (await authClient()).auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");
  const actor = await principalBy("user_id = $1 and type = 'human'", user.id);
  if (!actor) throw new Error("UNAUTHORIZED: No workspace membership.");
  return { actor };
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
