/**
 * Seeds the scenario. Run with: npm run db:seed
 */

import { closeDb, isSchemaReady } from "../src/db/client";
import { seedScenario } from "../src/db/seed/run";

function main(): void {
  if (!isSchemaReady()) {
    console.error("The database schema is not present. Run npm run db:migrate first.");
    process.exit(1);
  }

  const summary = seedScenario();

  console.log(`Seed complete. ${summary.rowsWritten} rows across ${summary.tablesWritten} tables.`);
  const entries = Object.entries(summary.counts).sort((a, b) => b[1] - a[1]);
  for (const [table, count] of entries) {
    console.log(`  ${String(count).padStart(5)}  ${table}`);
  }

  closeDb();
}

main();
