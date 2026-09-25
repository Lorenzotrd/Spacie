import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { processNextPreview } from "../lib/previews";
import { workspaceRevision } from "../lib/queries";
import { execute } from "../lib/service";
import { ids } from "../lib/seed";
import { storeDerived } from "../lib/storage";
import { one, principal, seededDb } from "./helpers";

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** A stand-in for LibreOffice: writes a PDF next to the input, or fails on demand. */
async function fakeSoffice(fail = false) {
  const dir = await mkdtemp(path.join(tmpdir(), "soffice-"));
  const script = path.join(dir, "soffice");
  await writeFile(script, fail ? "#!/bin/sh\nexit 1\n" : `#!/bin/sh
out=""; prev=""
for a in "$@"; do [ "$prev" = "--outdir" ] && out="$a"; prev="$a"; done
printf '%%PDF-1.7 rendered' > "$out/source.pdf"
`);
  await chmod(script, 0o755);
  return script;
}

async function uploadDeck() {
  process.env.SPACIE_DATA_DIR = await mkdtemp(path.join(tmpdir(), "spacie-"));
  const db = await seededDb();
  const claude = await principal(db, ids.claude);
  const storageKey = await storeDerived(Buffer.from("PK fake pptx"), PPTX, ids.workspace);
  const { id } = await execute(db, claude, {
    action: "upload_asset", projectId: ids.rebond, name: "Deck.pptx", mime: PPTX, size: 12, storageKey,
  });
  return { db, id };
}

test("office uploads queue a PDF preview that the worker renders", async () => {
  process.env.SPACIE_SOFFICE = await fakeSoffice();
  const { db, id } = await uploadDeck();
  assert.equal((await one<{ s: string }>(db, "select preview_status as s from files where id = $1", [id])).s, "pending");
  const before = await workspaceRevision(db, ids.workspace);
  assert.equal(await processNextPreview(db), true);
  const row = await one<{ s: string; k: string }>(db, "select preview_status as s, preview_key as k from files where id = $1", [id]);
  assert.equal(row.s, "ready");
  assert.equal((await readFile(path.join(process.env.SPACIE_DATA_DIR!, "assets", row.k))).toString(), "%PDF-1.7 rendered");
  assert.equal(await workspaceRevision(db, ids.workspace), before + 1, "clients refresh when a preview lands");
  assert.equal(await processNextPreview(db), false, "queue is empty");
});

test("a failed conversion is marked failed, and non-office files are never queued", async () => {
  process.env.SPACIE_SOFFICE = await fakeSoffice(true);
  const { db, id } = await uploadDeck();
  assert.equal(await processNextPreview(db), true);
  assert.equal((await one<{ s: string }>(db, "select preview_status as s from files where id = $1", [id])).s, "failed");
  const pdfKey = await storeDerived(Buffer.from("%PDF"), "application/pdf", ids.workspace);
  const pdf = await execute(db, await principal(db, ids.claude), {
    action: "upload_asset", projectId: ids.rebond, name: "a.pdf", mime: "application/pdf", size: 4, storageKey: pdfKey,
  });
  assert.equal((await one<{ s: string }>(db, "select preview_status as s from files where id = $1", [pdf.id])).s, "none");
});
