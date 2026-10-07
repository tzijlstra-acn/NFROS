// Exits 0 when the database exists and every migration in the journal is applied, 1 otherwise.
// Plain Node with better-sqlite3, so the launcher can skip the slow TypeScript migration step
// on an up-to-date database. Usage: node scripts/launcher/db-current.cjs <dbPath>
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const dbPath = process.argv[2];
const root = join(__dirname, "..", "..");
if (!dbPath || !existsSync(dbPath)) process.exit(1);
try {
  const journal = JSON.parse(readFileSync(join(root, "src", "db", "migrations", "meta", "_journal.json"), "utf8"));
  const Database = require(join(root, "node_modules", "better-sqlite3"));
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const applied = db.prepare("select count(*) as n from __drizzle_migrations").get().n;
  db.close();
  process.exit(applied >= journal.entries.length ? 0 : 1);
} catch {
  process.exit(1);
}
