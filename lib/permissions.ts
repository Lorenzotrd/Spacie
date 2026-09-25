import type { Action, Folder, Grant, Principal } from "./types";
/** What an authorization decision needs: the folder tree and the actor's grants. */
export type AccessContext = {
  workspace: { id: string };
  folders: Folder[];
  grants: Grant[];
};
export type Resource = {
  workspaceId: string;
  projectId?: string;
  folderId?: string | null;
};
export function can(
  state: AccessContext,
  actor: Principal,
  action: Action,
  resource: Resource,
): boolean {
  if (
    actor.workspaceId !== resource.workspaceId ||
    resource.workspaceId !== state.workspace.id
  )
    return false;
  if (
    actor.type === "human" &&
    (actor.role === "owner" || actor.role === "admin")
  )
    return true;
  const scopes: { type: "workspace" | "project" | "folder"; id: string }[] = [
    { type: "workspace", id: resource.workspaceId },
  ];
  if (resource.projectId)
    scopes.push({ type: "project", id: resource.projectId });
  const ancestors: Folder[] = [];
  let id = resource.folderId;
  const seen = new Set<string>();
  while (id) {
    if (seen.has(id)) return false;
    seen.add(id);
    const f = state.folders.find(
      (f) =>
        f.id === id &&
        f.workspaceId === resource.workspaceId &&
        f.projectId === resource.projectId,
    );
    if (!f) return false;
    ancestors.unshift(f);
    id = f.parentId;
  }
  scopes.push(...ancestors.map((f) => ({ type: "folder" as const, id: f.id })));
  for (const scope of scopes.reverse()) {
    const grant = state.grants.find(
      (g) =>
        g.principalId === actor.id &&
        g.resourceType === scope.type &&
        g.resourceId === scope.id,
    );
    if (grant) return grant.fullAccess || grant.allow.includes(action);
  }
  return (
    actor.type === "human" &&
    (actor.role === "member" ? action !== "manage_members" : action === "read")
  );
}
export function requirePermission(
  state: AccessContext,
  actor: Principal,
  action: Action,
  resource: Resource,
) {
  if (!can(state, actor, action, resource))
    throw new Error("FORBIDDEN: You do not have permission for this action.");
}
