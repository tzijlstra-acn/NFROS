/**
 * Restores the original seeded day. Run with: npm run demo:reset
 *
 * Reset uses the same code path as the seed, so the restored day is the seeded
 * day by construction rather than by careful maintenance of a second routine.
 */

import { closeDb, isSchemaReady } from "../src/db/client";
import { resetScenarioDay } from "../src/scenario/engine/reset";

function main(): void {
  if (!isSchemaReady()) {
    console.error("The database schema is not present. Run npm run db:migrate first.");
    process.exit(1);
  }

  const summary = resetScenarioDay();
  console.log(
    `Reset complete. The original day was restored: ${summary.rowsWritten} rows across ${summary.tablesWritten} tables.`,
  );
  closeDb();
}

main();
