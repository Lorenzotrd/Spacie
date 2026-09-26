import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Db } from "./db/client";

const caches = new WeakMap<Db, Map<string, string>>();

/** A random secret created once per database, so signatures survive restarts. */
export async function appSecret(db: Db, name: string): Promise<string> {
  const cache = caches.get(db) ?? new Map<string, string>();
  caches.set(db, cache);
  const cached = cache.get(name);
  if (cached) return cached;
  await db.query(
    "insert into app_secrets (name, value) values ($1, $2) on conflict (name) do nothing",
    [name, randomBytes(32).toString("base64url")],
  );
  const [row] = await db.query<{ value: string }>("select value from app_secrets where name = $1", [name]);
  cache.set(name, row.value);
  return row.value;
}

export const sign = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function verifySignature(secret: string, payload: string, signature: string) {
  const expected = Buffer.from(sign(secret, payload));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
