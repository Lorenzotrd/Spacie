import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { admin, demo } from "./repository";
export async function audit(
  workspaceId: string,
  principalId: string,
  action: string,
) {
  const event = {
    workspace_id: workspaceId,
    principal_id: principalId,
    action,
    created_at: new Date().toISOString(),
  };
  if (demo()) {
    await mkdir(path.join(process.cwd(), "data"), { recursive: true });
    await appendFile(
      path.join(process.cwd(), "data", "audit.ndjson"),
      JSON.stringify(event) + "\n",
    );
    return;
  }
  const { error } = await admin().from("audit_logs").insert(event);
  if (error) throw error;
}
