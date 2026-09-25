import { db } from "./db/client";

export async function audit(
  workspaceId: string,
  principalId: string,
  action: string,
) {
  await (await db()).query(
    "insert into audit_logs (workspace_id, principal_id, action) values ($1, $2, $3)",
    [workspaceId, principalId, action],
  );
}
