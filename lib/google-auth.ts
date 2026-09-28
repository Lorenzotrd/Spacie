import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db/client";
import { addMember, claimInvitation, createSession } from "./accounts";
import { hashToken } from "./tokens";

/**
 * Sign in with Google (OpenID Connect, authorization code + PKCE). Spacie stays
 * invite-only: Google signs in an existing account with the same verified email,
 * or redeems an invitation link; it never creates an account on its own.
 */

export const GOOGLE_COOKIE = "spacie_google";
const FLOW_TTL_S = 600;
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Why a Google sign-in failed; the login and join pages turn these into sentences. */
export type GoogleError = "cancelled" | "failed" | "no_account" | "unverified" | "invite";

export class GoogleSignInError extends Error {
  constructor(readonly code: GoogleError) {
    super(`Google sign-in failed: ${code}`);
  }
}

export const googleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

/** Must match an "Authorized redirect URI" of the Google OAuth client exactly. */
export function googleRedirectUri(request: Request) {
  const origin = process.env.SPACIE_ORIGIN || new URL(request.url).origin;
  return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
}

/** What the browser carries between the redirect to Google and the callback. */
export type GoogleFlow = { state: string; verifier: string; nonce: string; next: string; invite: string | null };

const secret = () => randomBytes(32).toString("base64url");

/** Only same-site paths: `next` must never send someone to another origin. */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/workspace";

export function startGoogle(request: Request, options: { next?: string | null; invite?: string | null }) {
  const flow: GoogleFlow = {
    state: secret(),
    verifier: secret(),
    nonce: secret(),
    next: safeNext(options.next),
    invite: options.invite || null,
  };
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: flowCookie(Buffer.from(JSON.stringify(flow)).toString("base64url"), FLOW_TTL_S) };
}

/** Lax so it rides along on Google's top-level redirect back; scoped to the callback path. */
export function flowCookie(value: string, maxAgeS: number) {
  const secure = process.env.SPACIE_ORIGIN?.startsWith("https://") ? "; Secure" : "";
  return `${GOOGLE_COOKIE}=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure}`;
}

export function readFlow(value: string | null): GoogleFlow | null {
  if (!value) return null;
  try {
    const flow = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as GoogleFlow;
    return typeof flow.state === "string" && typeof flow.verifier === "string" && typeof flow.nonce === "string"
      ? { ...flow, next: safeNext(flow.next), invite: typeof flow.invite === "string" ? flow.invite : null }
      : null;
  } catch {
    return null;
  }
}

export type GoogleIdentity = { sub: string; email: string; name: string };

/**
 * Reads the ID token Google returned from its token endpoint. It arrives over TLS straight
 * from Google, so per OpenID Connect Core 3.1.3.7 the signature check may be skipped; the
 * issuer, audience, expiry and nonce are still verified.
 */
export function identityFromIdToken(idToken: string, expected: { clientId: string; nonce: string }, now = Date.now()) {
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"));
  } catch {
    throw new GoogleSignInError("failed");
  }
  const valid =
    ISSUERS.includes(String(claims.iss)) &&
    claims.aud === expected.clientId &&
    typeof claims.exp === "number" &&
    claims.exp * 1000 > now &&
    claims.nonce === expected.nonce &&
    typeof claims.sub === "string" &&
    typeof claims.email === "string";
  if (!valid) throw new GoogleSignInError("failed");
  if (claims.email_verified !== true) throw new GoogleSignInError("unverified");
  const email = (claims.email as string).trim().toLowerCase();
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : email.split("@")[0];
  return { sub: claims.sub as string, email, name: name.slice(0, 80) } satisfies GoogleIdentity;
}

export async function exchangeCode(request: Request, code: string, flow: GoogleFlow) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
  if (!response.ok || typeof body.id_token !== "string") {
    console.error("[google] token exchange failed", response.status, body.error);
    throw new GoogleSignInError("failed");
  }
  return identityFromIdToken(body.id_token, { clientId: process.env.GOOGLE_CLIENT_ID!, nonce: flow.nonce });
}

/** The account this Google identity belongs to: linked by `sub`, else first use by verified email. */
async function findUser(tx: Db, identity: GoogleIdentity) {
  const [bySub] = await tx.query<{ id: string; name: string }>("select id, name from users where google_sub = $1", [
    identity.sub,
  ]);
  if (bySub) return bySub;
  const [byEmail] = await tx.query<{ id: string; name: string }>(
    "update users set google_sub = $2 where lower(email) = $1 and google_sub is null returning id, name",
    [identity.email, identity.sub],
  );
  return byEmail ?? null;
}

/** Signs in an existing account; returns a new session token. */
export async function signInWithGoogle(db: Db, identity: GoogleIdentity, device?: string | null) {
  return db.transaction(async (tx) => {
    const user = await findUser(tx, identity);
    if (!user) throw new GoogleSignInError("no_account");
    return createSession(tx, user.id, device);
  });
}

/**
 * Redeems an invitation with a Google identity: joins the existing account, or creates a
 * password-less one. Already being a member just signs in. The session opens the workspace.
 */
export async function joinWithGoogle(db: Db, inviteToken: string, identity: GoogleIdentity, device?: string | null) {
  return db.transaction(async (tx) => {
    const invite = await claimInvitation(tx, inviteToken, identity.email).catch(() => {
      throw new GoogleSignInError("invite");
    });
    const user =
      (await findUser(tx, identity)) ??
      (
        await tx.query<{ id: string; name: string }>(
          "insert into users (id, email, name, google_sub) values (gen_random_uuid(), $1, $2, $3) returning id, name",
          [identity.email, identity.name, identity.sub],
        )
      )[0];
    const [member] = await tx.query(
      "select 1 from principals where user_id = $1 and workspace_id = $2 and type = 'human'",
      [user.id, invite.workspace_id],
    );
    if (!member) await addMember(tx, invite, user);
    const token = await createSession(tx, user.id, device);
    await tx.query("update sessions set workspace_id = $2 where token_hash = $1", [hashToken(token), invite.workspace_id]);
    return token;
  });
}
