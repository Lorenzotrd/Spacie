import { db } from "./db/client";

const LIMIT_PER_MINUTE = 120;

/** Fixed one-minute window per key (a principal id, or e.g. `login:<email>`), shared by every instance. */
export async function rateLimit(key: string, limit = LIMIT_PER_MINUTE) {
  const [row] = await (await db()).query<{ hits: number }>(
    `insert into rate_limits (key, window_start, hits) values ($1, now(), 1)
     on conflict (key) do update set
       hits = case when rate_limits.window_start < now() - interval '1 minute' then 1 else rate_limits.hits + 1 end,
       window_start = case when rate_limits.window_start < now() - interval '1 minute' then now() else rate_limits.window_start end
     returning hits`,
    [key],
  );
  if (!row || row.hits > limit)
    throw new Error("Too many requests. Try again in a minute.");
}
