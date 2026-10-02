/**
 * Seeds the product configuration layer on its own.
 *
 * Run with: npx tsx scripts/seed-product.ts
 *
 * This exists because the product tables are independent of the scenario run.
 * Re-seeding a brand, a terminology profile or a deployment profile should not
 * require rewriting the whole synthetic day, and during configuration work it
 * is run many times. The full seed calls the same function, so the two cannot
 * drift.
 */

import { closeDb, isSchemaReady } from "../src/db/client";
import { seedProductConfiguration } from "../src/product/seed";

function main(): void {
  if (!isSchemaReady()) {
    console.error("The database schema is not present. Run npm run db:migrate first.");
    process.exit(1);
  }

  const summary = seedProductConfiguration();

  console.log(
    `Product configuration seeded. ${summary.rowsWritten} rows across ${summary.tablesWritten} tables.`,
  );
  for (const [table, count] of Object.entries(summary.counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${table}`);
  }

  closeDb();
}

main();
