/**
 * Links the seeded decisions a stage contract binds to their process run (migration 0007).
 *
 * The RCSA stage contract binds five of the seeded decisions by id (stages 2,
 * 3, 4, 5 and 7). They are the judgments of the Q4 cycle, the app's seeded
 * run, so each one is recorded with that run and the stage that waits for it.
 * Derived from the contracts in `src/role-apps/` and the seeded runs, never
 * listed by hand, so a binding added to a contract is linked by the next seed.
 * Migration 0007 applies the same links to an existing database; a test holds
 * the two equal.
 *
 * Synthetic institution and data.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { decisions } from "@/db/schema/decisions";
import { roleAppRunsData } from "@/db/seed/role-app-runtime";
import { getProcessDefinition, ROLE_APP_REGISTRY } from "@/role-apps/registry";

export interface DecisionProcessLink {
  decisionId: string;
  processRunId: string;
  processStageId: string;
}

/** Every seeded-decision binding of an installed app, with the app's seeded run. */
export function decisionProcessLinks(): DecisionProcessLink[] {
  const links: DecisionProcessLink[] = [];
  for (const app of ROLE_APP_REGISTRY.filter((entry) => entry.status === "installed")) {
    const process = getProcessDefinition(app.processId);
    const run = roleAppRunsData.find((entry) => entry.roleAppId === app.id);
    if (!process || !run) continue;
    for (const stage of process.stages) {
      for (const decision of stage.decisions) {
        if (decision.binding.kind !== "seeded-decision") continue;
        links.push({ decisionId: decision.binding.decisionId, processRunId: run.id, processStageId: stage.id });
      }
    }
  }
  return links;
}

/** Writes the links onto the seeded decisions. Returns how many decisions were linked. */
export function seedDecisionProcessLinks(runId: string): number {
  let linked = 0;
  for (const link of decisionProcessLinks()) {
    linked += getDb()
      .update(decisions)
      .set({ processRunId: link.processRunId, processStageId: link.processStageId })
      .where(and(eq(decisions.runId, runId), eq(decisions.id, link.decisionId)))
      .run().changes;
  }
  return linked;
}
