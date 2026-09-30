/**
 * Integration test harness.
 *
 * Isolation is the whole point of this module. The integration tests seed,
 * mutate and reset a real SQLite database, and the developer's own scenario
 * database at `data/nfr-workos.db` must never be touched by a test run. A
 * suite that quietly wipes the database someone is about to present from is
 * worse than no suite.
 *
 * The mechanism: `src/db/client.ts` resolves its path from `NFR_DB_PATH` on
 * the first call to `getDb()`, and caches the handle. So the sequence is
 *
 *   closeDb()  ->  set NFR_DB_PATH to a fresh temp file  ->  getDb()
 *
 * and a guard refuses to proceed if the resolved path is anywhere near the
 * repository. Schema creation replicates `scripts/migrate.ts` exactly: the
 * generated Drizzle migrations, then the `evidence_chunks_fts` virtual table
 * and its three triggers, because Drizzle does not model virtual tables and
 * lexical retrieval is dead without them.
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { closeDb, getDb, getSqlite, resolveDbPath } from "@/db/client";

let temporaryDirectory: string | null = null;

/**
 * Creates the full text index over evidence chunks.
 *
 * Copied deliberately rather than imported, because `scripts/migrate.ts` is a
 * script with a top level `main()` call and importing it would run it against
 * whatever `NFR_DB_PATH` happened to be at import time.
 */
function createFullTextIndex(): void {
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS evidence_chunks_fts USING fts5(
      chunk_id UNINDEXED,
      document_id UNINDEXED,
      run_id UNINDEXED,
      locator,
      content,
      tokenize = 'porter unicode61'
    );
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS evidence_chunks_fts_insert
    AFTER INSERT ON evidence_chunks BEGIN
      INSERT INTO evidence_chunks_fts (chunk_id, document_id, run_id, locator, content)
      VALUES (new.id, new.document_id, new.run_id, new.locator, new.content);
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS evidence_chunks_fts_delete
    AFTER DELETE ON evidence_chunks BEGIN
      DELETE FROM evidence_chunks_fts WHERE chunk_id = old.id;
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS evidence_chunks_fts_update
    AFTER UPDATE ON evidence_chunks BEGIN
      DELETE FROM evidence_chunks_fts WHERE chunk_id = old.id;
      INSERT INTO evidence_chunks_fts (chunk_id, document_id, run_id, locator, content)
      VALUES (new.id, new.document_id, new.run_id, new.locator, new.content);
    END;
  `);
}

/**
 * Refuses any path inside the repository.
 *
 * This is a real guard, not a formality: the default path is `data/...`
 * relative to the working directory, so a single missing assignment would
 * point the whole suite at the developer's database.
 */
function assertPathIsDisposable(dbPath: string): void {
  const repositoryRoot = resolve(process.cwd());
  if (dbPath.startsWith(repositoryRoot + sep) || dbPath === repositoryRoot) {
    throw new Error(
      `Refusing to run integration tests against ${dbPath}, which is inside the repository.`,
    );
  }
  if (!dbPath.startsWith(resolve(tmpdir()))) {
    throw new Error(`Refusing to run integration tests against ${dbPath}, which is not temporary.`);
  }
}

export interface TemporaryDatabase {
  dbPath: string;
  directory: string;
}

/**
 * Opens a fresh migrated database in the system temporary directory.
 *
 * `label` only makes the directory recognisable if a run leaves one behind.
 */
export function createTemporaryDatabase(label: string): TemporaryDatabase {
  // Anything already open, including a handle on the developer database that
  // a transitively imported module may have opened, is released first.
  closeDb();

  const directory = mkdtempSync(join(tmpdir(), `nfr-workos-${label}-`));
  const dbPath = join(directory, "scenario.db");
  assertPathIsDisposable(dbPath);

  process.env.NFR_DB_PATH = dbPath;

  const resolved = resolveDbPath();
  if (resolved !== dbPath) {
    throw new Error(
      `The client resolved ${resolved} instead of the temporary path ${dbPath}. Isolation is not in force.`,
    );
  }

  migrate(getDb(), { migrationsFolder: "src/db/migrations" });
  createFullTextIndex();

  temporaryDirectory = directory;
  return { dbPath, directory };
}

/** Closes the handle and removes the temporary directory. */
export function destroyTemporaryDatabase(): void {
  closeDb();
  delete process.env.NFR_DB_PATH;

  if (temporaryDirectory !== null) {
    try {
      // The write ahead log leaves sidecar files next to the database.
      rmSync(temporaryDirectory, { recursive: true, force: true });
    } catch {
      // A locked file on Windows is not worth failing a test run over. The
      // directory is under the system temporary path and will be reclaimed.
    }
    temporaryDirectory = null;
  }
}

/** Every user table in the open database, sorted. */
export function tableNames(): string[] {
  return (
    getSqlite()
      .prepare(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

/** Row count for one table. Throws when the table does not exist. */
export function rowCount(table: string): number {
  const row = getSqlite().prepare(`select count(*) as n from "${table}"`).get() as
    | { n: number }
    | undefined;
  return row?.n ?? 0;
}

/** Row counts for a set of tables, as a plain object for easy comparison. */
export function rowCounts(tables: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of tables) counts[table] = rowCount(table);
  return counts;
}

/** Every value of one column in one table, sorted, for content comparison. */
export function columnValues(table: string, column: string): string[] {
  const rows = getSqlite()
    .prepare(`select "${column}" as value from "${table}" order by "${column}"`)
    .all() as Array<{ value: unknown }>;
  return rows.map((row) => String(row.value));
}
