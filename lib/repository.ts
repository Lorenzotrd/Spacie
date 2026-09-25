import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { seed } from "./seed";
import type { WorkspaceState } from "./types";
export const demo = () =>
  process.env.SPACIE_DEMO_MODE === "true" &&
  process.env.NODE_ENV !== "production";
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Backend is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const location = path.join(process.cwd(), "data", "workspace.json");
export async function load(workspaceId?: string): Promise<WorkspaceState> {
  if (demo()) {
    try {
      return JSON.parse(await readFile(location, "utf8")) as WorkspaceState;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      return seed();
    }
  }
  if (!workspaceId) throw new Error("Workspace is required.");
  const { data, error } = await admin().rpc("spacie_load", {
    wid: workspaceId,
  });
  if (error) throw error;
  return data as WorkspaceState;
}
async function save(state: WorkspaceState, revision: number) {
  state.revision = revision + 1;
  if (demo()) {
    await mkdir(path.dirname(location), { recursive: true });
    await writeFile(location + ".tmp", JSON.stringify(state), "utf8");
    await rename(location + ".tmp", location);
    return;
  }
  const { error } = await admin().rpc("spacie_commit", {
    wid: state.workspace.id,
    expected_revision: revision,
    document: state,
  });
  if (error) throw error;
}
let queue: Promise<unknown> = Promise.resolve();
export function transaction<T>(
  workspaceId: string | undefined,
  fn: (state: WorkspaceState) => T | Promise<T>,
): Promise<T> {
  const task = queue.then(async () => {
    const state = await load(workspaceId);
    const revision = state.revision;
    const result = await fn(state);
    await save(state, revision);
    return result;
  });
  queue = task.catch(() => undefined);
  return task;
}
