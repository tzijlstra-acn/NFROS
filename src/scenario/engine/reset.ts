/**
 * Scenario reset.
 *
 * Restores the entire original day, including removing the decisions,
 * approvals, mutations and audit events created during a demonstration.
 *
 * This is a thin wrapper over the seed rather than a separate teardown, for
 * the reason stated in the seed module: two code paths would drift.
 */

import { seedScenario, type SeedSummary } from "@/db/seed/run";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { recordAuditEvent } from "@/server/security/audit";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("reset");

export function resetScenarioDay(runId: string = DEFAULT_RUN_ID): SeedSummary {
  log.info("Resetting the scenario day.", { runId });
  const summary = seedScenario(runId);

  // The reset itself is the first event on the new day's record.
  recordAuditEvent({
    runId,
    atMoment: "07:45",
    category: "system",
    action: "resetScenario",
    objectKind: "scenario-run",
    objectId: runId,
    summary:
      "The scenario was reset. All decisions, approvals, mutations and session audit events from the previous run were removed and the original seeded day was restored.",
    actorKind: "human",
    reversible: false,
    detail: { rowsWritten: summary.rowsWritten, tablesWritten: summary.tablesWritten },
  });

  return summary;
}
