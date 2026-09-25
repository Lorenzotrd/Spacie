import { admin, demo } from "./repository";
export type PresenceEntry = {
  principalId: string;
  resourceId: string | null;
  state: "viewing" | "editing" | "working" | "idle";
  lastSeenAt: string;
};
const entries = new Map<string, PresenceEntry>();
export async function touchPresence(workspaceId: string, entry: PresenceEntry) {
  if (demo()) {
    entries.set(workspaceId + entry.principalId, entry);
    return;
  }
  const { error } = await admin().from("presence").upsert(
    {
      workspace_id: workspaceId,
      principal_id: entry.principalId,
      resource_id: entry.resourceId,
      state: entry.state,
      last_seen_at: entry.lastSeenAt,
    },
    { onConflict: "workspace_id,principal_id" },
  );
  if (error) throw error;
}
export async function readPresence(
  workspaceId: string,
): Promise<PresenceEntry[]> {
  const cutoff = new Date(Date.now() - 30000).toISOString();
  if (demo())
    return [...entries.entries()]
      .filter(
        ([key, e]) => key.startsWith(workspaceId) && e.lastSeenAt > cutoff,
      )
      .map(([, e]) => e);
  const { data, error } = await admin()
    .from("presence")
    .select("principal_id,resource_id,state,last_seen_at")
    .eq("workspace_id", workspaceId)
    .gt("last_seen_at", cutoff);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    principalId: e.principal_id,
    resourceId: e.resource_id,
    state: e.state,
    lastSeenAt: e.last_seen_at,
  }));
}
