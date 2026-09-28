import { z } from "zod";
import type { Db } from "./db/client";
import type { Principal, UserPreferences } from "./types";
import { requireHuman, userOf } from "./workspaces";

const timeZone = z
  .string()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone");

/** A person's display preferences. Missing keys fall back to the defaults. */
export const userPreferences = z.object({
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  sort: z.enum(["recent", "name"]).default("recent"),
  /** Open the side panel (activity, comments, versions) when opening a file. */
  openPanel: z.boolean().default(true),
  /** IANA zone for dates; null follows the device. */
  timeZone: timeZone.nullable().default(null),
}) satisfies z.ZodType<UserPreferences, z.ZodTypeDef, unknown>;

export const DEFAULT_PREFERENCES: UserPreferences = userPreferences.parse({});

const parse = (raw: unknown): UserPreferences => {
  const parsed = userPreferences.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
};

/** The preferences of the person behind `actor`; defaults for agents and account-less demo people. */
export async function getPreferences(db: Db, actor: Principal): Promise<UserPreferences> {
  if (actor.type !== "human") return DEFAULT_PREFERENCES;
  const [row] = await db.query<{ preferences: unknown }>(
    `select u.preferences from principals p join users u on u.id = p.user_id
     where p.id = $1 and p.workspace_id = $2`,
    [actor.id, actor.workspaceId],
  );
  return parse(row?.preferences);
}

/** Merges `input` into the person's preferences and returns the result. */
export async function setPreferences(db: Db, actor: Principal, input: Partial<UserPreferences>) {
  requireHuman(actor);
  const user = await userOf(db, actor);
  const next = userPreferences.parse({ ...(await getPreferences(db, actor)), ...input });
  await db.query("update users set preferences = $2::jsonb where id = $1", [user.id, JSON.stringify(next)]);
  // Bump every workspace the person is in so open tabs pick the change up.
  await db.query(
    `update workspaces set revision = revision + 1
     where id in (select workspace_id from principals where user_id = $1 and type = 'human')`,
    [user.id],
  );
  return next;
}
