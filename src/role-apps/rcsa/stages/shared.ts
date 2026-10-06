/**
 * What the RCSA stages share.
 *
 * Every RCSA stage reads the same scope: the assessment the run is about, the
 * risks and controls on its lines, and the prior version it is compared
 * against. Three facts about the data make that less obvious than it looks,
 * so the rules live here once rather than in eight stage modules:
 *
 *   An assessment is versioned, never overwritten. A decision in the cycle
 *   (DEC-2026-0772, DEC-2026-0782) creates a new version and supersedes the
 *   one the run started on, so the current version is found by following
 *   `supersededBy` from the run's subject.
 *
 *   An off-cycle assessment, created by an event-driven reassessment, starts
 *   with no lines of its own. Its scope is the lines of the version it
 *   reassesses (the baseline), until the cycle records lines of its own.
 *
 *   The prior version is the previous cycle, not the previous row: the Q4
 *   draft and its later versions are one cycle, and Q3 is the comparison.
 *
 * The decisions a stage binds belong to the run (migration 0007): the Q4
 * cycle's seeded judgments to its run, and a later run's own copies to that
 * run (`./run-decisions.ts`). A stage reads its decision through the context,
 * never by the seeded identifier.
 *
 * Read only. Synthetic institution and data.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema/core";
import { assessmentLines, assessments } from "@/db/schema/practice";
import type { Bilingual } from "@/role-apps/contracts";
import { unique } from "@/role-apps/stage-support";
import type { LoadedSource, SourceLoadResult, SourceRecord, StageContext } from "@/features/process/types";
import { CONTROL_EFFECTIVENESS_LABELS, type ControlEffectiveness } from "@/domain/nfr/calculators";

export const RCSA_PROCESS_ID = "rcsa-cycle";

type AssessmentRow = typeof assessments.$inferSelect;
type LineRow = typeof assessmentLines.$inferSelect;

export interface RcsaScope {
  /** The run's subject, which stays the series identifier for the life of the run. */
  subjectAssessmentId: string;
  /** The current version, following `supersededBy` from the subject. */
  assessmentId: string;
  version: number;
  cycle: string;
  status: string;
  processId: string;
  entityId: string;
  /** The version whose lines the scope uses: the current one, or the baseline of an off-cycle assessment. */
  linesFromId: string;
  lines: LineRow[];
  riskIds: string[];
  controlIds: string[];
  /** Every version in the subject's chain, oldest first. */
  chainIds: string[];
  offCycle: boolean;
}

function assessmentRow(runId: string, id: string): AssessmentRow | undefined {
  return getDb()
    .select()
    .from(assessments)
    .where(and(eq(assessments.runId, runId), eq(assessments.id, id)))
    .get();
}

function linesOf(runId: string, assessmentId: string): LineRow[] {
  return getDb()
    .select()
    .from(assessmentLines)
    .where(and(eq(assessmentLines.runId, runId), eq(assessmentLines.assessmentId, assessmentId)))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Every RCSA version for one process and entity, newest first. */
function versionsFor(runId: string, processId: string, entityId: string): AssessmentRow[] {
  return getDb()
    .select()
    .from(assessments)
    .where(and(eq(assessments.runId, runId), eq(assessments.subjectId, processId)))
    .all()
    .filter((row) => row.kind === "rcsa" && row.entityId === entityId)
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn) || b.version - a.version);
}

/** The scope of the assessment a run is about. Throws when the assessment is missing. */
export function assessmentScope(runId: string, subjectAssessmentId: string): RcsaScope {
  const subject = assessmentRow(runId, subjectAssessmentId);
  if (!subject) throw new Error(`The assessment ${subjectAssessmentId} is not seeded.`);

  const chain: AssessmentRow[] = [subject];
  let current = subject;
  for (let hop = 0; hop < 12 && current.supersededBy; hop += 1) {
    const next = assessmentRow(runId, current.supersededBy);
    if (!next) break;
    chain.push(next);
    current = next;
  }
  const chainIds = chain.map((row) => row.id);

  let linesFromId = current.id;
  let lines = linesOf(runId, current.id);
  if (lines.length === 0) {
    const baseline = versionsFor(runId, current.subjectId, current.entityId).find(
      (row) => !chainIds.includes(row.id) && linesOf(runId, row.id).length > 0,
    );
    if (baseline) {
      linesFromId = baseline.id;
      lines = linesOf(runId, baseline.id);
    }
  }

  return {
    subjectAssessmentId: subject.id,
    assessmentId: current.id,
    version: current.version,
    cycle: current.cycle,
    status: current.status,
    processId: current.subjectId,
    entityId: current.entityId,
    linesFromId,
    lines,
    riskIds: unique(lines.map((line) => line.riskId)),
    controlIds: unique(lines.flatMap((line) => line.controlIds)),
    chainIds,
    offCycle: subject.status === "off-cycle",
  };
}

/** The scope of the run a loader or a stage context is about. */
export function scopeOf(context: { runId: string; run: { subjectId: string } }): RcsaScope {
  return assessmentScope(context.runId, context.run.subjectId);
}

/**
 * The version the scope is compared against.
 *
 * For a cycle version, the newest version of an earlier cycle. For an
 * off-cycle assessment, the version it reassesses, because that is the
 * position the event may have changed.
 */
export function priorAssessmentOf(runId: string, scope: RcsaScope): { assessment: AssessmentRow; lines: LineRow[] } | null {
  if (scope.offCycle && scope.linesFromId !== scope.assessmentId) {
    const baseline = assessmentRow(runId, scope.linesFromId);
    return baseline ? { assessment: baseline, lines: scope.lines } : null;
  }
  const prior = versionsFor(runId, scope.processId, scope.entityId).find(
    (row) => !scope.chainIds.includes(row.id) && row.cycle !== scope.cycle && linesOf(runId, row.id).length > 0,
  );
  return prior ? { assessment: prior, lines: linesOf(runId, prior.id) } : null;
}

/* ==========================================================================
   Loader and preparer helpers
   ========================================================================== */

export function result(records: SourceRecord[], extra: Partial<SourceLoadResult> = {}): SourceLoadResult {
  return {
    status: records.length === 0 ? "empty" : "loaded",
    records,
    evidenceIds: unique(records.flatMap((record) => record.evidenceIds)),
    asOf: null,
    note: null,
    ...extra,
  };
}

export function recordsOf(sources: readonly LoadedSource[], key: string): SourceRecord[] {
  return sources.find((source) => source.spec.key === key)?.result.records ?? [];
}

export function sourceOf(sources: readonly LoadedSource[], key: string): LoadedSource | undefined {
  return sources.find((source) => source.spec.key === key);
}

/**
 * Shortens a source text for a record, at the end of a sentence where one is
 * near enough, so a statement is never cut in the middle of a word.
 */
export function clip(text: string, max = 600): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("; "));
  if (stop > max * 0.4) return `${head.slice(0, stop).trimEnd()}.`;
  const space = head.lastIndexOf(" ");
  return `${head.slice(0, space > 0 ? space : max).replace(/[,;:]$/, "").trimEnd()}.`;
}

/** "a, b and c", in the reader's language. */
export function list(items: readonly string[], language: "en" | "de"): string {
  if (items.length <= 1) return items.join("");
  const last = items[items.length - 1];
  return `${items.slice(0, -1).join(", ")} ${language === "de" ? "und" : "and"} ${last}`;
}

export function both(en: string, de: string): Bilingual {
  return { en, de };
}

/** A fact as a string, for facts the loaders wrote. */
export function fact(record: SourceRecord | undefined, key: string): string {
  const value = record?.facts?.[key];
  return value === null || value === undefined ? "" : String(value);
}

export function factNumber(record: SourceRecord | undefined, key: string): number {
  const value = Number(record?.facts?.[key] ?? Number.NaN);
  return Number.isFinite(value) ? value : 0;
}

/** A person's name and identifier, read from the user register. */
export function personLabel(runId: string, userId: string | null | undefined): string {
  if (!userId) return "";
  const row = getDb().select().from(users).where(and(eq(users.runId, runId), eq(users.id, userId))).get();
  return row ? `${row.name} (${userId})` : userId;
}

export function effectivenessLabel(value: string, language: "en" | "de"): string {
  const label = CONTROL_EFFECTIVENESS_LABELS[value as ControlEffectiveness];
  return label ? (language === "de" ? label.de : label.en) : value;
}

/** Plain-language labels for the residual ratings and appetite positions the stages show. */
export const RATING_LABELS: Record<string, Bilingual> = {
  low: { en: "Low", de: "Niedrig" },
  medium: { en: "Medium", de: "Mittel" },
  high: { en: "High", de: "Hoch" },
  critical: { en: "Critical", de: "Kritisch" },
};

export const APPETITE_LABELS: Record<string, Bilingual> = {
  within: { en: "within appetite", de: "innerhalb der Risikobereitschaft" },
  "at-limit": { en: "at the limit of appetite", de: "an der Grenze der Risikobereitschaft" },
  outside: { en: "outside appetite", de: "ausserhalb der Risikobereitschaft" },
};

export function ratingLabel(value: string, language: "en" | "de"): string {
  const label = RATING_LABELS[value];
  return label ? (language === "de" ? label.de : label.en) : value;
}

export function appetiteLabel(value: string, language: "en" | "de"): string {
  const label = APPETITE_LABELS[value];
  return label ? (language === "de" ? label.de : label.en) : value;
}

/** The stage context's seeded decision state for a contract decision key. */
export function decisionOf(context: StageContext, key: string) {
  return context.decisions.find((state) => state.spec.key === key);
}

/**
 * The decision a contract key is bound to on this run: the run's own decision
 * (the engine binds it in `buildStageContext`), which for the Q4 cycle is the
 * seeded one. The contract's identifier is named only while the run has no
 * decision for the key, which a recorded stage never is.
 */
export function boundDecisionId(context: StageContext, key: string, contractId: string): string {
  return decisionOf(context, key)?.recordId ?? contractId;
}

/**
 * The 1-based position of the chosen option among the decision's options, in
 * their declared order. A run's own decision copies the options of the
 * decision it was made from in the same order under its own identifiers, so
 * the position, not the identifier, says which choice was made.
 */
export function chosenPosition(state: { chosenOptionId: string | null; options: ReadonlyArray<{ id: string }> } | undefined): number | null {
  if (!state?.chosenOptionId) return null;
  const index = state.options.findIndex((option) => option.id === state.chosenOptionId);
  return index >= 0 ? index + 1 : null;
}
