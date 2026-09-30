/**
 * Database client.
 *
 * SQLite, opened once per process. The model never touches this handle: every
 * mutation passes through a typed tool function which passes through the
 * authority gate first. See `src/agents/tools` and `src/server/security`.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import * as schema from "./schema";

export const DEFAULT_DB_PATH = "data/nfr-workos.db";

export function resolveDbPath(): string {
  const configured = process.env.NFR_DB_PATH;
  const raw = configured && configured.trim().length > 0 ? configured.trim() : DEFAULT_DB_PATH;
  /*
   * Resolved against the working directory at runtime so a test or a script
   * can point at a temporary database through NFR_DB_PATH. The bundler cannot
   * scope this statically; the annotation keeps it from tracing the whole
   * project into the server output.
   */
  return isAbsolute(raw) ? raw : resolve(/* turbopackIgnore: true */ process.cwd(), raw);
}

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

let sqliteHandle: Database.Database | null = null;
let dbHandle: AppDatabase | null = null;

function openSqlite(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  // Write ahead logging keeps reads fast while the scenario engine mutates.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Busy timeout matters because the dev server and a seed script can overlap.
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

/** Returns the shared Drizzle handle, opening the database on first use. */
export function getDb(): AppDatabase {
  if (dbHandle === null) {
    sqliteHandle = openSqlite(resolveDbPath());
    dbHandle = drizzle(sqliteHandle, { schema });
  }
  return dbHandle;
}

/** Returns the raw driver, needed for full text search and transactions. */
export function getSqlite(): Database.Database {
  if (sqliteHandle === null) getDb();
  if (sqliteHandle === null) throw new Error("SQLite handle was not initialised.");
  return sqliteHandle;
}

/** True when the schema is present. Says nothing about whether it has content. */
export function isSchemaReady(): boolean {
  const path = resolveDbPath();
  if (!existsSync(path)) return false;
  try {
    const row = getSqlite()
      .prepare(
        "select count(*) as n from sqlite_master where type = 'table' and name in ('scenario_runs','decisions','evidence_documents','audit_events')",
      )
      .get() as { n: number } | undefined;
    return (row?.n ?? 0) === 4;
  } catch {
    return false;
  }
}

/**
 * True when the database is migrated AND seeded.
 *
 * Checking the tables alone is not enough: after `db:migrate` the schema
 * exists and the application has nothing to render, which would show an
 * empty interface rather than the instruction to run the seed. So this also
 * requires a scenario run and at least one decision to be present.
 */
export function isDatabaseReady(): boolean {
  if (!isSchemaReady()) return false;
  try {
    const row = getSqlite()
      .prepare(
        "select (select count(*) from scenario_runs) as runs, (select count(*) from decisions) as decisions",
      )
      .get() as { runs: number; decisions: number } | undefined;
    return (row?.runs ?? 0) > 0 && (row?.decisions ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Opens an independent connection. Used by scripts and tests. */
export function openIndependentDb(path: string): { db: AppDatabase; sqlite: Database.Database } {
  const sqlite = openSqlite(path);
  return { db: drizzle(sqlite, { schema }), sqlite };
}

/** Closes the shared handle. Used by scripts and tests. */
export function closeDb(): void {
  if (sqliteHandle !== null) {
    sqliteHandle.close();
    sqliteHandle = null;
    dbHandle = null;
  }
}

export { schema };
