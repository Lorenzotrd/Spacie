import type { Db } from "./db/client";
import { createInvitation, type Role } from "./accounts";
import { loadAccess } from "./access";
import { can, requirePermission } from "./permissions";
import type { Principal } from "./types";

export type TeamMember = {
  id: string;
  type: "human" | "agent";
  name: string;
  initials: string;
  role: Role | null;
  provider: string | null;
  /** Only shown to owners and admins, and to the person themself. */
  email: string | null;
  lastActiveAt: string | null;
  you: boolean;
};
export type PendingInvite = { id: string; email: string | null; role: Role; createdAt: string; expiresAt: string };
export type Team = { members: TeamMember[]; invitations: PendingInvite[]; canManage: boolean };

type Editable = Exclude<Role, "owner">;

const iso = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());

async function canManage(db: Db, actor: Principal) {
  return can(await loadAccess(db, actor), actor, "manage_members", { workspaceId: actor.workspaceId });
}

async function requireManager(db: Db, actor: Principal) {
  requirePermission(await loadAccess(db, actor), actor, "manage_members", { workspaceId: actor.workspaceId });
}

async function touch(tx: Db, actor: Principal, action: string, name: string) {
  await tx.query("update workspaces set revision = revision + 1 where id = $1", [actor.workspaceId]);
  await tx.query("insert into activity_events (workspace_id, actor_id, action, name) values ($1, $2, $3, $4)", [
    actor.workspaceId,
    actor.id,
    action,
    name,
  ]);
}

/** People and connected agents, with when each last did something, plus pending invitations. */
export async function listTeam(db: Db, actor: Principal): Promise<Team> {
  const manager = await canManage(db, actor);
  const rows = await db.query<{
    id: string; type: "human" | "agent"; name: string; initials: string; role: Role | null; provider: string | null;
    email: string | null; last_active: Date | string | null;
  }>(
    `select p.id, p.type, p.name, p.initials, p.role, p.provider, u.email,
       greatest(
         (select max(a.created_at) from activity_events a where a.actor_id = p.id),
         (select max(s.last_seen_at) from sessions s where s.user_id = p.user_id)
       ) as last_active
     from principals p left join users u on u.id = p.user_id
     where p.workspace_id = $1
       and ((p.type = 'human' and p.removed_at is null) or (p.type = 'agent' and p.status <> 'offline'))
     order by p.type = 'agent', case p.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end,
       p.created_at, p.id`,
    [actor.workspaceId],
  );
  const invitations = manager
    ? await db.query<{ id: string; email: string | null; role: Role; created_at: Date | string; expires_at: Date | string }>(
        `select id, email, role, created_at, expires_at from invitations
         where workspace_id = $1 and accepted_at is null and expires_at > now() and role <> 'owner'
         order by created_at desc`,
        [actor.workspaceId],
      )
    : [];
  return {
    canManage: manager,
    members: rows.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      initials: r.initials,
      role: r.role,
      provider: r.provider,
      email: manager || r.id === actor.id ? r.email : null,
      lastActiveAt: iso(r.last_active),
      you: r.id === actor.id,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: iso(i.created_at)!,
      expiresAt: iso(i.expires_at)!,
    })),
  };
}

/** The person being changed: never yourself, never the owner; admins are the owner's to change. */
async function editablePerson(tx: Db, actor: Principal, id: string, nextRole?: Editable) {
  const [person] = await tx.query<{ id: string; name: string; role: Role }>(
    `select id, name, role from principals
     where id = $1 and workspace_id = $2 and type = 'human' and removed_at is null`,
    [id, actor.workspaceId],
  );
  if (!person) throw new Error("Member not found");
  if (person.id === actor.id) throw new Error("FORBIDDEN: You cannot change your own role.");
  if (person.role === "owner") throw new Error("FORBIDDEN: The owner's role cannot be changed.");
  if ((person.role === "admin" || nextRole === "admin") && actor.role !== "owner")
    throw new Error("FORBIDDEN: Only the owner can add or change admins.");
  return person;
}

export async function changeRole(db: Db, actor: Principal, id: string, role: Editable) {
  await requireManager(db, actor);
  return db.transaction(async (tx) => {
    const person = await editablePerson(tx, actor, id, role);
    if (person.role === role) return { id };
    await tx.query("update principals set role = $2 where id = $1", [id, role]);
    await touch(tx, actor, `made ${role}`, person.name);
    return { id };
  });
}

/**
 * Removes a person from this workspace. Their principal stays so history keeps their
 * name, but it no longer links to the account, so none of their sessions can open it.
 */
export async function removeMember(db: Db, actor: Principal, id: string) {
  await requireManager(db, actor);
  return db.transaction(async (tx) => {
    const person = await editablePerson(tx, actor, id);
    await tx.query("delete from grants where principal_id = $1", [id]);
    await tx.query("update share_links set revoked_at = now() where created_by = $1 and revoked_at is null", [id]);
    await tx.query("update principals set user_id = null, role = 'viewer', status = 'offline', removed_at = now() where id = $1", [id]);
    await touch(tx, actor, "removed", person.name);
    return { id };
  });
}

async function pendingInvite(tx: Db, actor: Principal, id: string) {
  const [invite] = await tx.query<{ id: string; email: string | null; role: Role }>(
    `select id, email, role from invitations
     where id = $1 and workspace_id = $2 and accepted_at is null and role <> 'owner'`,
    [id, actor.workspaceId],
  );
  if (!invite) throw new Error("Invitation not found");
  return invite;
}

export async function revokeInvitation(db: Db, actor: Principal, id: string) {
  await requireManager(db, actor);
  return db.transaction(async (tx) => {
    const invite = await pendingInvite(tx, actor, id);
    await tx.query("delete from invitations where id = $1", [id]);
    await touch(tx, actor, "cancelled the invitation of", invite.email ?? "a guest");
    return { id };
  });
}

/** Replaces an invitation with a fresh single-use link (the old one stops working). */
export async function renewInvitation(db: Db, actor: Principal, id: string) {
  await requireManager(db, actor);
  return db.transaction(async (tx) => {
    const invite = await pendingInvite(tx, actor, id);
    await tx.query("delete from invitations where id = $1", [id]);
    return createInvitation(tx, {
      workspaceId: actor.workspaceId,
      role: invite.role,
      invitedBy: actor.id,
      email: invite.email ?? undefined,
    });
  });
}
