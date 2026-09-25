import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Db } from "./db/client";
import { dataDir } from "./config";
import { readAsset, storeDerived } from "./storage";

const run = promisify(execFile);

/** Office formats rendered to PDF for preview. */
const CONVERTIBLE: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
export const needsPreview = (mime: string) => mime in CONVERTIBLE;

const CONVERT_TIMEOUT_MS = 120_000;
const IDLE_POLL_MS = 5_000;
const soffice = () => process.env.SPACIE_SOFFICE ?? "soffice";

/** Renders one office file to PDF with headless LibreOffice, in an isolated temp dir and profile. */
export async function convertToPdf(bytes: Buffer, extension: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "spacie-preview-"));
  try {
    const input = path.join(dir, `source.${extension}`);
    await writeFile(input, bytes);
    await run(
      soffice(),
      [`-env:UserInstallation=file://${path.join(dataDir(), "libreoffice-profile")}`,
        "--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, input],
      { timeout: CONVERT_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 },
    );
    return await readFile(path.join(dir, "source.pdf"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type Job = { id: string; workspace_id: string; storage_key: string; mime: string };

/** Claims the oldest pending file; `skip locked` lets several instances share the queue. */
async function claim(db: Db): Promise<Job | null> {
  const [job] = await db.query<Job>(
    `update files set preview_status = 'processing'
     where id = (select id from files where preview_status = 'pending' and storage_key is not null
                 order by updated_at limit 1 for update skip locked)
     returning id, workspace_id, storage_key, mime`,
  );
  return job ?? null;
}

/** Converts one pending file. Returns false when the queue is empty. */
export async function processNextPreview(db: Db): Promise<boolean> {
  const job = await claim(db);
  if (!job) return false;
  let previewKey: string | null = null;
  try {
    const pdf = await convertToPdf(await readAsset(job.storage_key), CONVERTIBLE[job.mime]);
    previewKey = await storeDerived(pdf, "application/pdf", job.workspace_id);
  } catch (error) {
    console.error("[previews] conversion failed", job.id, error);
  }
  // Only apply if the file was not replaced meanwhile (restore_version resets it to pending).
  await db.transaction(async (tx) => {
    const updated = await tx.query(
      `update files set preview_status = $2, preview_key = $3
       where id = $1 and storage_key = $4 and preview_status = 'processing' returning 1`,
      [job.id, previewKey ? "ready" : "failed", previewKey, job.storage_key],
    );
    if (updated.length)
      await tx.query("update workspaces set revision = revision + 1 where id = $1", [job.workspace_id]);
  });
  return true;
}

/** Processes previews forever, one at a time, so LibreOffice never runs in parallel. */
export function startPreviewWorker(db: Db) {
  const loop = async () => {
    // Anything left mid-conversion by a previous process goes back to the queue.
    await db.query("update files set preview_status = 'pending' where preview_status = 'processing'");
    for (;;) {
      const worked = await processNextPreview(db).catch((error) => {
        console.error("[previews] worker error", error);
        return false;
      });
      if (!worked) await new Promise((resolve) => setTimeout(resolve, IDLE_POLL_MS));
    }
  };
  void loop();
}
