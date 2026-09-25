import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import type { Db } from "./client";

const directory = path.join(process.cwd(), "db", "migrations");
/** Arbitrary constant: serializes migrations across app instances. */
const lockId = 7_260_924;

/** Applies pending `db/migrations/*.sql` files in name order, once each. */
export async function migrate(db: Db) {
  await db.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock($1)", [lockId]);
    await tx.exec(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const applied = new Set(
      (await tx.query<{ name: string }>("select name from schema_migrations")).map(
        (r) => r.name,
      ),
    );
    const files = (await readdir(directory))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      await tx.exec(await readFile(path.join(directory, file), "utf8"));
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    }
  });
}
