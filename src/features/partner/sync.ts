/**
 * The workday frame's one call to the Partner: keep the context, settle the
 * lifecycle, run what is due.
 *
 * Server only. The frame calls it on every navigation and selection change,
 * and once a minute while the page is visible, through
 * `/api/workday/partner/sync`. It does three things, each idempotent:
 *
 *   keeps the durable context the focus describes (`./context`);
 *   records what came of earlier answers (`settleSuggestionLifecycle`);
 *   schedules and runs the routines the scenario clock has made due, when no
 *   worker has already run them (`runDueRoutines`). The worker and this call
 *   lease jobs by id, so a routine runs once whoever asks first.
 *
 * It returns whether anything changed, so the client refreshes the route
 * (and with it Home, the header and Updates) only when there is something new.
 */

import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { getScenarioState } from "@/scenario/engine/state";
import { runDueRoutines } from "@/features/routines/runner";
import { createLogger } from "@/server/logging/redact";
import { settleSuggestionLifecycle } from "./lifecycle";
import { syncPartnerContext, type PartnerFocusInput } from "./context";

const log = createLogger("partner-sync");

export interface PartnerSyncResult {
  changed: boolean;
  routinesRan: number;
  created: number;
  settled: number;
  contextVersion: number | null;
}

export async function syncPartner(roleId: RoleId, focus: PartnerFocusInput, options: { runId?: string } = {}): Promise<PartnerSyncResult> {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const state = getScenarioState(runId);
  if (!state) return { changed: false, routinesRan: 0, created: 0, settled: 0, contextVersion: null };

  const settled = settleSuggestionLifecycle(roleId, state);
  const context = syncPartnerContext(roleId, focus, state);

  let ran = 0;
  let created = 0;
  try {
    for (const result of await runDueRoutines({ runId, limit: 8 })) {
      if (result.outcome === "skipped") continue;
      ran += 1;
      created += result.created;
    }
  } catch (error) {
    // A routine that cannot run must not take the frame with it; the job keeps its own record.
    log.warn("Due routines could not be run from the frame.", { roleId, error });
  }

  return { changed: settled > 0 || ran > 0, routinesRan: ran, created, settled, contextVersion: context?.version ?? null };
}
