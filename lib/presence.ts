import { db } from "./db/client";
import { fromRows } from "./db/rows";

export type PresenceEntry = {
  principalId: string;
  resourceId: string | null;
  state: "viewing" | "editing" | "working" | "idle";
  lastSeenAt: string;
};

/** Heartbeats older than this are considered gone. */
const PRESENCE_TTL_SECONDS = 30;

export async function touchPresence(workspaceId: string, entry: PresenceEntry) {
  await (await db()).query(
    `insert into presence (workspace_id, principal_id, resource_id, state, last_seen_at)
     values ($1, $2, $3, $4, $5)
     on conflict (workspace_id, principal_id) do update set
       resource_id = excluded.resource_id, state = excluded.state, last_seen_at = excluded.last_seen_at`,
    [workspaceId, entry.principalId, entry.resourceId, entry.state, entry.lastSeenAt],
  );
}

export async function readPresence(workspaceId: string): Promise<PresenceEntry[]> {
  return fromRows<PresenceEntry>(
    await (await db()).query(
      `select principal_id as "principalId", resource_id as "resourceId", state, last_seen_at as "lastSeenAt"
       from presence
       where workspace_id = $1 and last_seen_at > now() - make_interval(secs => $2)`,
      [workspaceId, PRESENCE_TTL_SECONDS],
    ),
  );
}
