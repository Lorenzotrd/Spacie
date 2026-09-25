import { db } from "./db/client";

const LIMIT_PER_MINUTE = 120;

/** Fixed one-minute window per principal, shared by every server instance. */
export async function rateLimit(principalId: string) {
  const [row] = await (await db()).query<{ hits: number }>(
    `insert into rate_limits (principal_id, window_start, hits) values ($1, now(), 1)
     on conflict (principal_id) do update set
       hits = case when rate_limits.window_start < now() - interval '1 minute' then 1 else rate_limits.hits + 1 end,
       window_start = case when rate_limits.window_start < now() - interval '1 minute' then now() else rate_limits.window_start end
     returning hits`,
    [principalId],
  );
  if (!row || row.hits > LIMIT_PER_MINUTE)
    throw new Error("Too many requests. Try again in a minute.");
}
