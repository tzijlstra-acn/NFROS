/**
 * The database migrations: what the code ships and what this database has
 * applied (plan 7.9, "database migration").
 *
 * Two sources, compared rather than trusted:
 *
 *   - the migration journal, `src/db/migrations/meta/_journal.json`, written
 *     by drizzle-kit: every migration the code carries, with its tag and the
 *     time it was generated;
 *   - the database's own `__drizzle_migrations` table, written by the
 *     migrator: every migration this database applied, keyed by the same
 *     generation time.
 *
 * A migration in the journal and not in the database is pending, which is
 * the state the shared database is in until the user runs `npm run
 * db:migrate`. The release gate's migration check reads this.
 *
 * Server only (reads a file and the database).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getSqlite } from "@/db/client";

export interface JournalEntry {
  idx: number;
  tag: string;
  /** Generation time, ms since epoch; the migrator stores it as `created_at`. */
  when: number;
}

export interface MigrationState {
  /** False when the journal could not be read. */
  journalReadable: boolean;
  /** False when the database's migration table could not be read. */
  databaseReadable: boolean;
  entries: Array<JournalEntry & { applied: boolean }>;
  appliedCount: number;
  pending: JournalEntry[];
  latestTag: string | null;
}

export function readMigrationJournal(root: string = process.cwd()): JournalEntry[] | null {
  try {
    const path = join(root, "src", "db", "migrations", "meta", "_journal.json");
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { entries?: unknown };
    if (!Array.isArray(parsed.entries)) return null;
    return parsed.entries
      .filter(
        (entry): entry is JournalEntry =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as JournalEntry).tag === "string" &&
          typeof (entry as JournalEntry).when === "number" &&
          typeof (entry as JournalEntry).idx === "number",
      )
      .map((entry) => ({ idx: entry.idx, tag: entry.tag, when: entry.when }))
      .sort((a, b) => a.idx - b.idx);
  } catch {
    return null;
  }
}

function appliedTimes(): Set<number> | null {
  try {
    const rows = getSqlite().prepare("SELECT created_at AS createdAt FROM __drizzle_migrations").all() as Array<{
      createdAt: number | string | null;
    }>;
    return new Set(rows.map((row) => Number(row.createdAt)).filter((value) => Number.isFinite(value)));
  } catch {
    return null;
  }
}

/** The journal against the database. Pure once its two inputs are read. */
export function compareMigrations(journal: JournalEntry[] | null, applied: Set<number> | null): MigrationState {
  const entries = (journal ?? []).map((entry) => ({ ...entry, applied: applied?.has(entry.when) ?? false }));
  return {
    journalReadable: journal !== null,
    databaseReadable: applied !== null,
    entries,
    appliedCount: entries.filter((entry) => entry.applied).length,
    pending: entries.filter((entry) => !entry.applied).map(({ idx, tag, when }) => ({ idx, tag, when })),
    latestTag: entries.at(-1)?.tag ?? null,
  };
}

export function readMigrationState(root?: string): MigrationState {
  return compareMigrations(readMigrationJournal(root), appliedTimes());
}
