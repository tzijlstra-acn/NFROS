/**
 * Seeds the integration layer. Run with: npx tsx scripts/seed-integrations.ts
 *
 * Exists as a separate entry point for two reasons. During development the
 * integration tables change far more often than the scenario does, and
 * reseeding the whole day to add a mapping is slow enough that it discourages
 * changing mappings. And until the one line call is added to
 * `src/db/seed/run.ts`, this is the way to populate the connector registry at
 * all.
 *
 * It requires the scenario to be seeded first, and it says so rather than
 * writing an integration layer with no institution behind it: the source
 * requirements are derived from the seeded decisions, so running this against
 * an empty database would produce connectors that no decision depends on.
 */

import { closeDb, getSqlite, isDatabaseReady, isSchemaReady } from "../src/db/client";
import { seedIntegrations } from "../src/integrations/seed";

function main(): void {
  if (!isSchemaReady()) {
    console.error("The database schema is not present. Run npm run db:migrate first.");
    process.exit(1);
  }

  if (!isDatabaseReady()) {
    console.error(
      "The scenario has not been seeded. Run npm run db:seed first: the source requirements are derived from the seeded decisions.",
    );
    process.exit(1);
  }

  const summary = seedIntegrations();

  console.log(`Integration seed complete. ${summary.rowsWritten} rows written.`);
  for (const [table, count] of Object.entries(summary.counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${table}`);
  }

  if (summary.uncoveredJudgmentKinds.length > 0) {
    console.warn(
      `\nWarning: ${summary.uncoveredJudgmentKinds.length} judgment kind(s) have no declared source requirements. Decisions of that kind are not source checked before a recommendation is published:`,
    );
    for (const kind of summary.uncoveredJudgmentKinds) console.warn(`  ${kind}`);
  }

  /* A short honesty report, because the point of the mode column is that
   * somebody reads it. */
  const modes = getSqlite()
    .prepare("select mode, count(*) as n from connector_instances group by mode order by n desc")
    .all() as Array<{ mode: string; n: number }>;

  console.log("\nConnector instances by readiness mode:");
  for (const row of modes) {
    console.log(`  ${String(row.n).padStart(5)}  ${row.mode}`);
  }

  closeDb();
}

main();
