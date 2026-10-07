/**
 * What the dock reads beyond the suggestions themselves.
 *
 * Server only, reads only. Everything here is plain data, because the dock's
 * payload is served as JSON by `/api/workday/partner`:
 *
 *   the answered suggestions (the Handled list) and each suggestion's
 *   disposition history, so the lifecycle is visible where it is answered;
 *   where each suggestion opens, and which routine prepared it;
 *   the feedback the person already gave, so the controls show their state;
 *   today's routine runs with their outputs, the lineage the Activity tab
 *   lists;
 *   the durable working context.
 */

import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import type { AIFeedbackKind } from "@/db/schema/ai-partner";
import type { SuggestionDisposition } from "@/db/schema/live";
import { getActiveSuggestions, getAnsweredSuggestions } from "@/db/repositories/partner";
import { getSuggestionDispositionHistory } from "@/db/repositories/suggestion-dispositions";
import { getOutputsForRoutineRuns, listRoutineRuns } from "@/db/repositories/ai-routine-runs";
import { getRoutines } from "@/db/repositories/role-app-runtime";
import { getRole } from "@/db/repositories/workday";
import type { ScenarioState } from "@/scenario/engine/state";
import type { AISuggestionView } from "@/workday/contracts";
import { feedbackGivenBy } from "./feedback";
import { readPartnerContextView, type PartnerContextView } from "./context";
import { objectLink, suggestionHref } from "./links";

export interface DispositionStep {
  to: SuggestionDisposition;
  atMoment: string;
  actor: "person" | "system";
  reason: string;
}

export interface RoutineRunView {
  id: string;
  routineName: string;
  atMoment: string;
  status: string;
  outcome: string | null;
  summary: string;
  mode: string;
  outputs: Array<{ kind: string; id: string; href: string }>;
}

export interface PartnerExtras {
  answered: AISuggestionView[];
  history: Record<string, DispositionStep[]>;
  hrefs: Record<string, string>;
  /** Suggestion id to the routine that prepared it. */
  preparedBy: Record<string, string>;
  feedback: Record<string, AIFeedbackKind[]>;
  routineRuns: RoutineRunView[];
  context: PartnerContextView | null;
}

export function emptyPartnerExtras(): PartnerExtras {
  return { answered: [], history: {}, hrefs: {}, preparedBy: {}, feedback: {}, routineRuns: [], context: null };
}

export function buildPartnerExtras(roleId: RoleId, state: ScenarioState): PartnerExtras {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const language = state.language;
  const answered = getAnsweredSuggestions(roleId, state.currentMoment, { runId });
  const open = getActiveSuggestions(roleId, state.currentMoment, { runId, language });

  const history: Record<string, DispositionStep[]> = {};
  const hrefs: Record<string, string> = {};
  for (const suggestion of [...open, ...answered]) {
    hrefs[suggestion.id] = suggestionHref(roleId, suggestion);
    const steps = getSuggestionDispositionHistory(suggestion.id);
    if (steps.length > 0) {
      history[suggestion.id] = steps.map((step) => ({
        to: step.toDisposition,
        atMoment: step.atMoment,
        actor: step.actorKind === "human" ? "person" : "system",
        reason: step.reason,
      }));
    }
  }

  const names = new Map(getRoutines(roleId, runId).map((row) => [row.id, row.name]));
  const runs = listRoutineRuns({ roleId, runId, limit: 20 });
  const outputs = getOutputsForRoutineRuns(runs.map((run) => run.id));
  const preparedBy: Record<string, string> = {};
  const routineRuns: RoutineRunView[] = runs.map((run) => {
    const list = outputs.get(run.id) ?? [];
    for (const output of list) if (output.objectKind === "suggestion") preparedBy[output.objectId] = names.get(run.routineId) ?? run.routineId;
    return {
      id: run.id,
      routineName: names.get(run.routineId) ?? run.routineId,
      atMoment: run.atMoment,
      status: run.status,
      outcome: run.outcome,
      summary: language === "de" && run.summaryDe.length > 0 ? run.summaryDe : run.summary,
      mode: run.mode,
      outputs: list
        .filter((output) => output.objectKind !== "suggestion")
        .map((output) => ({ kind: output.objectKind, id: output.objectId, href: objectLink(roleId, output.objectKind, output.objectId) })),
    };
  });

  const holder = getRole(roleId, runId)?.holderUserId;
  return {
    answered,
    history,
    hrefs,
    preparedBy,
    feedback: holder ? feedbackGivenBy(holder, roleId, runId) : {},
    routineRuns,
    context: readPartnerContextView(roleId, state),
  };
}
