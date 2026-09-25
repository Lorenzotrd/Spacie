import path from "node:path";
import { readFile } from "node:fs/promises";
import { dataDir, demo } from "../config";
import { migrate } from "./migrate";
import { importSnapshot } from "./import";
import { seed } from "../seed";
import type { WorkspaceState } from "../types";

export type Row = Record<string, unknown>;

/** The minimal SQL surface the app needs, shared by node-postgres and PGlite. */
export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs several statements without parameters (migrations only). */
  exec(text: string): Promise<void>;
  /** Nested calls reuse the surrounding transaction. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

type PGliteLike = {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
};

function wrapPglite(
  pg: PGliteLike & {
    transaction?<T>(fn: (tx: PGliteLike) => Promise<T>): Promise<T>;
  },
  inTransaction = false,
): Db {
  const db: Db = {
    query: async <T>(text: string, params?: unknown[]) =>
      (await pg.query<T>(text, params)).rows,
    exec: async (text) => {
      await pg.exec(text);
    },
    transaction: (fn) =>
      inTransaction || !pg.transaction
        ? fn(db)
        : pg.transaction((tx) => fn(wrapPglite(tx, true))),
  };
  return db;
}

/** In-memory or file-backed embedded Postgres, used for the local demo and tests. */
export async function createEmbeddedDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  await pg.exec("create schema if not exists spacie; set search_path to spacie;");
  const db = wrapPglite(pg);
  await migrate(db);
  return db;
}

async function createServerDb(connectionString: string): Promise<Db> {
  const { default: pg } = await import("pg");
  // int8 columns (revision, size) fit safely in a JS number for this app.
  pg.types.setTypeParser(20, (value) => Number(value));
  const pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    // Requires a session (not transaction-mode) pooler: search_path is per connection.
    options: "-c search_path=spacie",
  });
  pool.on("error", (error) => console.error("[db] idle client error", error));
  const wrap = (client: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  }): Omit<Db, "transaction"> => ({
    query: async <T>(text: string, params?: unknown[]) =>
      (await client.query(text, params)).rows as T[],
    exec: async (text) => {
      await client.query(text);
    },
  });
  const db: Db = {
    ...wrap(pool),
    transaction: async (fn) => {
      const client = await pool.connect();
      const tx: Db = { ...wrap(client), transaction: (inner) => inner(tx) };
      try {
        await client.query("begin");
        const result = await fn(tx);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
  await db.exec("create schema if not exists spacie");
  await migrate(db);
  return db;
}

/** First demo boot: import the previous JSON demo store if present, else seed. */
async function prepareDemo(db: Db) {
  const [{ count }] = await db.query<{ count: number }>(
    "select count(*)::int as count from workspaces",
  );
  if (count) return;
  let snapshot: WorkspaceState = seed();
  try {
    snapshot = JSON.parse(
      await readFile(path.join(dataDir(), "workspace.json"), "utf8"),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await importSnapshot(db, snapshot);
}

const key = Symbol.for("spacie.db");
type Holder = { [key]?: Promise<Db> };

/** Process-wide connection, kept on globalThis so dev hot reloads reuse it. */
export function db(): Promise<Db> {
  const holder = globalThis as Holder;
  holder[key] ??= (async () => {
    if (demo()) {
      const database = await createEmbeddedDb(path.join(dataDir(), "pglite"));
      await prepareDemo(database);
      return database;
    }
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Backend is not configured: set DATABASE_URL.");
    return createServerDb(url);
  })().catch((error) => {
    delete holder[key];
    throw error;
  });
  return holder[key];
}
