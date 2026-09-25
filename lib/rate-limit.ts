import { admin, demo } from "./repository";
const buckets = new Map<string, { count: number; reset: number }>();
export async function rateLimit(principalId: string) {
  if (!demo()) {
    const { data, error } = await admin().rpc("spacie_rate_limit", {
      actor_id: principalId,
    });
    if (error || !data)
      throw new Error("Too many requests. Try again in a minute.");
    return;
  }
  const now = Date.now(),
    bucket = buckets.get(principalId);
  if (!bucket || bucket.reset < now) {
    buckets.set(principalId, { count: 1, reset: now + 60000 });
    return;
  }
  if (++bucket.count > 120)
    throw new Error("Too many requests. Try again in a minute.");
  if (buckets.size > 10000)
    for (const [key, v] of buckets) if (v.reset < now) buckets.delete(key);
}
