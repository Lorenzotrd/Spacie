import { createEmbeddedDb, type Db } from "../lib/db/client";
import { importSnapshot } from "../lib/db/import";
import { columns, fromRow } from "../lib/db/rows";
import { seed } from "../lib/seed";
import type { Principal } from "../lib/types";

/** A fresh in-memory Postgres with the schema migrated and the demo workspace seeded. */
export async function seededDb(): Promise<Db> {
  const db = await createEmbeddedDb();
  await importSnapshot(db, seed());
  return db;
}

export async function principal(db: Db, id: string): Promise<Principal> {
  const [row] = await db.query(`select ${columns.principal} from principals where id = $1`, [id]);
  if (!row) throw new Error(`No principal ${id}`);
  return fromRow<Principal>(row);
}

export async function one<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await db.query<T>(sql, params);
  return row;
}
