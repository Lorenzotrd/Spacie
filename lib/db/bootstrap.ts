import type { Db } from "./client";

export type Identity = { id: string; email: string; name: string };

/**
 * First sign-in: joins the workspace the email was invited to, or creates a new
 * workspace owned by this user. Idempotent; returns the user's workspace id.
 */
export async function bootstrapUser(db: Db, user: Identity): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [user.id]);
    const [member] = await tx.query<{ workspace_id: string }>(
      "select workspace_id from principals where user_id = $1 limit 1",
      [user.id],
    );
    if (member) return member.workspace_id;
    await tx.query(
      "insert into users (id, email, name) values ($1, $2, $3) on conflict (id) do nothing",
      [user.id, user.email, user.name],
    );
    const [invited] = await tx.query<{ id: string; workspace_id: string; role: string }>(
      `select id, workspace_id, role from invitations
       where lower(email) = lower($1) and expires_at > now() order by created_at desc limit 1`,
      [user.email],
    );
    let workspaceId = invited?.workspace_id;
    if (!workspaceId) {
      const [created] = await tx.query<{ id: string }>(
        `insert into workspaces (name, slug) values ($1, 'workspace-' || substr(md5(random()::text), 1, 10))
         returning id`,
        [`${user.name}’s workspace`],
      );
      workspaceId = created.id;
    }
    await tx.query(
      `insert into principals (workspace_id, type, user_id, name, initials, color, status, role)
       values ($1, 'human', $2, $3, $4, '#8a73d5', 'online', $5)`,
      [workspaceId, user.id, user.name, user.name.slice(0, 2).toUpperCase(), invited?.role ?? "owner"],
    );
    if (invited) await tx.query("delete from invitations where id = $1", [invited.id]);
    return workspaceId;
  });
}
