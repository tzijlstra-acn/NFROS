/**
 * Applies schema migrations and creates the retrieval indexes.
 *
 * Run with: npm run db:migrate
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { closeDb, getDb, getSqlite, resolveDbPath } from "../src/db/client";

/**
 * Creates the SQLite full text index over evidence chunks.
 *
 * Drizzle does not model virtual tables, so this runs as raw SQL after the
 * generated migrations. It is idempotent.
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

  // Keep the index in step with the source table. Triggers are simpler and
  // more reliable here than remembering to reindex in every write path.
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

function main(): void {
  const path = resolveDbPath();
  const db = getDb();

  migrate(db, { migrationsFolder: "src/db/migrations" });
  createFullTextIndex();

  const tableCount = (
    getSqlite()
      .prepare("select count(*) as n from sqlite_master where type = 'table'")
      .get() as { n: number }
  ).n;

  closeDb();
  console.log(`Migration complete. ${tableCount} tables at ${path}`);
}

main();
