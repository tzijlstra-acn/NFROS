/**
 * The suggestion lifecycle: what a person did with a suggestion, and what the
 * system recorded came of it (plan 4.11).
 *
 * Server only. Every write goes through `recordSuggestionDisposition`, the
 * one writer of the current disposition and its history (os-data-model
 * handoff, section 6). The rules of which step may follow which are the pure
 * ones in `./rules`.
 *
 * What an answer does, and what it never does:
 *
 *   review    records that the person read it. Nothing else changes.
 *   snooze    records a review and holds the suggestion back for an hour on
 *             the scenario clock (`snoozed_until_moment`).
 *   accept    records the acceptance and returns where the person goes next.
 *   modify    records the acceptance with the person's own wording of the
 *             recommendation, kept as the modification.
 *   reject    records the rejection and the person's reason.
 *
 * None of them executes anything. Accepting a material suggestion returns the
 * decision record as the next step, where the rationale, the confirmation and
 * the payload bound approval are captured and the authority gate decides.
 * Only when that governed path has recorded the decision does `settle`
 * record the suggestion as executed. A suggestion whose decision was recorded
 * without it being accepted here is recorded as expired: it no longer
 * applies, and saying it was executed would credit it with a judgment it did
 * not make.
 */

import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { aiSuggestions, type SuggestionDisposition } from "@/db/schema/live";
import { getDecisions, getRole } from "@/db/repositories/workday";
import { recordSuggestionDisposition } from "@/db/repositories/suggestion-dispositions";
import type { ScenarioState } from "@/scenario/engine/state";
import { ANSWER_DISPOSITION, canTransition, snoozeUntil, type PartnerAnswer } from "./rules";
import { suggestionHref } from "./links";

const db = () => getDb();

let sequence = 0;
function entryId(suggestionId: string): string {
  sequence += 1;
  return `DSP-${suggestionId}-${Date.now().toString(36).toUpperCase()}-${String(sequence).padStart(4, "0")}`;
}

export interface AnswerInput {
  roleId: RoleId;
  suggestionId: string;
  answer: PartnerAnswer;
  /** For `modify`: the person's wording of the recommendation. */
  recommendation?: string;
  /** Required for `reject` and `modify`, optional otherwise. */
  reason?: string;
}

export type AnswerResult =
  | {
      ok: true;
      disposition: SuggestionDisposition;
      /** Where the person goes next. For a material suggestion, the decision record. */
      next: { href: string; material: boolean } | null;
    }
  | { ok: false; code: "unknown" | "other-role" | "closed" | "reason-required" | "text-required"; message: { en: string; de: string } };

const REFUSAL: Record<Exclude<AnswerResult, { ok: true }>["code"], { en: string; de: string }> = {
  unknown: { en: "This suggestion does not exist.", de: "Dieser Vorschlag existiert nicht." },
  "other-role": { en: "This suggestion belongs to another role.", de: "Dieser Vorschlag gehoert zu einer anderen Rolle." },
  closed: {
    en: "This suggestion has already been answered, so nothing was changed.",
    de: "Dieser Vorschlag wurde bereits beantwortet, daher wurde nichts geaendert.",
  },
  "reason-required": { en: "Give a short reason first.", de: "Geben Sie zuerst eine kurze Begruendung an." },
  "text-required": {
    en: "Write your version of the recommendation first.",
    de: "Schreiben Sie zuerst Ihre Fassung der Empfehlung.",
  },
};

function refuse(code: Exclude<AnswerResult, { ok: true }>["code"]): AnswerResult {
  return { ok: false, code, message: REFUSAL[code] };
}

/** True when accepting needs the decision record: the suggestion carries a material change. */
export function isMaterialSuggestion(row: { authorityClass: string; decisionRequired: boolean; decisionId: string | null }): boolean {
  return row.authorityClass === "APPROVAL_REQUIRED" || row.decisionRequired || row.decisionId !== null;
}

/**
 * Records a person's answer.
 *
 * The acting person is the role's holder, as everywhere in this build (the
 * workday has no per-person session yet). A repeat of the current
 * disposition writes nothing.
 */
export function answerSuggestion(input: AnswerInput, state: ScenarioState): AnswerResult {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const row = db()
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.runId, runId), eq(aiSuggestions.id, input.suggestionId)))
    .get();
  if (!row) return refuse("unknown");
  if (row.roleId !== input.roleId) return refuse("other-role");

  const to = ANSWER_DISPOSITION[input.answer];
  const reason = (input.reason ?? "").trim().slice(0, 600);
  const recommendation = (input.recommendation ?? "").trim().slice(0, 1600);
  if (input.answer === "reject" && reason.length === 0) return refuse("reason-required");
  if (input.answer === "modify" && recommendation.length === 0) return refuse("text-required");
  if (input.answer === "modify" && reason.length === 0) return refuse("reason-required");

  const verdict = canTransition(row.disposition, to, "human");
  if (!verdict.allowed && !(row.disposition === to && input.answer !== "modify")) return refuse("closed");

  const holder = getRole(input.roleId, runId)?.holderUserId ?? null;
  const at = new Date().toISOString();
  const material = isMaterialSuggestion(row);

  const write = getSqlite().transaction(() => {
    if (input.answer === "snooze") {
      db()
        .update(aiSuggestions)
        .set({ snoozedUntilMoment: snoozeUntil(state.currentMoment) })
        .where(eq(aiSuggestions.id, row.id))
        .run();
    }
    if (row.disposition !== to || input.answer === "modify") {
      recordSuggestionDisposition({
        id: entryId(row.id),
        suggestionId: row.id,
        to,
        actorKind: "human",
        actorUserId: holder,
        at,
        atMoment: state.currentMoment,
        reason: input.answer === "snooze" ? `Snoozed until ${snoozeUntil(state.currentMoment)}.` : reason,
        runId,
        ...(input.answer === "modify"
          ? {
              modification: {
                summary: reason,
                fields: [{ field: "recommendedAction", prepared: row.recommendedAction ?? "", recorded: recommendation }],
              },
            }
          : {}),
        ...((input.answer === "accept" || input.answer === "modify") && row.decisionId
          ? { resultKind: "decision", resultId: row.decisionId }
          : {}),
      });
    }
  });
  write();

  const next =
    input.answer === "accept" || input.answer === "modify" || input.answer === "review"
      ? { href: suggestionHref(input.roleId, row), material }
      : null;
  return { ok: true, disposition: to, next };
}

/**
 * Records what came of earlier answers, from the records that settle them.
 *
 * Today one record settles a suggestion: the decision it prepared. Recorded
 * after an acceptance or a modification, the suggestion is executed; recorded
 * while the suggestion was still open, it is expired. Idempotent: a settled
 * suggestion is not open and not accepted, so a second pass finds nothing.
 * Returns how many suggestions changed.
 */
export function settleSuggestionLifecycle(roleId: RoleId, state: ScenarioState): number {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const decided = new Map(
    getDecisions(roleId, state.currentMoment, runId)
      .filter((entry) => entry.decision.status !== "open")
      .map((entry) => [entry.decision.id, entry.decision]),
  );
  if (decided.size === 0) return 0;

  const rows = db()
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.runId, runId), eq(aiSuggestions.roleId, roleId)))
    .all()
    .filter((row) => row.decisionId !== null && decided.has(row.decisionId));

  let changed = 0;
  const at = new Date().toISOString();
  for (const row of rows) {
    const to: SuggestionDisposition =
      row.disposition === "accepted" || row.disposition === "modified" ? "executed" : "expired";
    if (!canTransition(row.disposition, to, "system").allowed) continue;
    const result = recordSuggestionDisposition({
      id: entryId(row.id),
      suggestionId: row.id,
      to,
      actorKind: "system",
      actorUserId: null,
      at,
      atMoment: state.currentMoment,
      reason:
        to === "executed"
          ? "The decision it prepared was recorded through the authority gate."
          : "Its decision was recorded on Decisions, so it no longer applies.",
      resultKind: "decision",
      resultId: row.decisionId,
      runId,
    });
    if (result.recorded) changed += 1;
  }
  return changed;
}
