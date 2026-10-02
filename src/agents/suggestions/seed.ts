/**
 * Seeds the AI Partner.
 *
 * Three things are written here and they are different in kind, which is the
 * reason this module exists rather than the content being inlined somewhere.
 *
 *   1. `cached_ai_outputs`. One validated beat per role, per beat, per
 *      language, with a recorded stage shape and a recorded latency. This is
 *      what presenter safe mode serves, and it is what makes safe mode
 *      genuinely different from offline mode rather than the same path with a
 *      different label.
 *
 *   2. `ai_suggestions`. The morning card per role, written as a validated row
 *      so the Partner panel has content at 07:45 before anything is clicked.
 *
 *   3. `ai_activity_entries`. The opening activity stream per role, projected
 *      from the `background_actions` rows that already exist. Projected, not
 *      authored: every entry corresponds to work the scenario says was done,
 *      which is the rule the activity stream lives or dies by.
 *
 * Every beat is validated before it is written. A card with an invented
 * evidence identifier, an em dash, a provider name, a compliance claim or the
 * Swiss entity attached to a European Union instrument fails the seed rather
 * than the demonstration. That is the right place for it to fail: a seed error
 * is a five minute fix and a demonstration error is not.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { aiSuggestions, chatThreads, chatTurns } from "@/db/schema/live";
import { cachedAiOutputs, backgroundActions } from "@/db/schema/decisions";
import { getEvidenceDocuments, getRole } from "@/db/repositories/workday";
import { getScenarioState } from "@/scenario/engine/state";
import { createLogger } from "@/server/logging/redact";
import { clearActivityForRun, recordActivityBatch, type ActivityInput } from "@/agents/activity/record";
import {
  SEEDED_SUGGESTIONS,
  beatKeyFor,
  type SeededSuggestion,
  type SuggestionBeat,
} from "./seeded";
import { seededStageShape } from "./stages";
import { computeStateDigest } from "./digest";
import { describeFailures, validateSuggestionDraft, type SuggestionDraft } from "./validate";
import { persistSuggestion, resolveEvidenceSet } from "./generate";

const log = createLogger("seed-ai-partner");
const db = () => getDb();

const LANGUAGES: Array<"en" | "de"> = ["en", "de"];

export interface AiPartnerSeedSummary {
  cachedBeats: number;
  suggestions: number;
  activityEntries: number;
  rowsWritten: number;
}

/**
 * Removes the rows this module owns.
 *
 * Needed because `src/db/seed/run.ts` does not list these four tables in its
 * own clear list, so without this a reseed would accumulate a second set of
 * suggestions and a doubled activity stream. Written as its own function so
 * the behaviour is visible rather than buried in the writer.
 */
function clearAiPartner(runId: string): void {
  const threads = db()
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(eq(chatThreads.runId, runId))
    .all()
    .map((row) => row.id);

  if (threads.length > 0) {
    db().delete(chatTurns).where(inArray(chatTurns.threadId, threads)).run();
  }
  db().delete(chatTurns).where(eq(chatTurns.runId, runId)).run();
  db().delete(chatThreads).where(eq(chatThreads.runId, runId)).run();
  db().delete(aiSuggestions).where(eq(aiSuggestions.runId, runId)).run();
  clearActivityForRun(runId);

  // Only the beats this module owns. Another agent's cached beats for the
  // decision brief or the meeting scripts live in the same table.
  const owned = db()
    .select()
    .from(cachedAiOutputs)
    .where(eq(cachedAiOutputs.runId, runId))
    .all()
    .filter((row) => row.beatKey.startsWith("suggestion:"))
    .map((row) => row.id);

  if (owned.length > 0) {
    db().delete(cachedAiOutputs).where(inArray(cachedAiOutputs.id, owned)).run();
  }
}

/** Validates one authored draft, throwing with a usable message on failure. */
function validateSeeded(
  entry: SeededSuggestion,
  language: "en" | "de",
  draft: SuggestionDraft,
  runId: string,
): void {
  const cited = new Set<string>([
    ...draft.evidenceIds,
    ...draft.grounding.verifiedFacts.flatMap((statement) => statement.sourceIds),
    ...draft.grounding.approvedRecords.flatMap((statement) => statement.sourceIds),
    ...draft.grounding.stakeholderStatements.flatMap((statement) => statement.sourceIds),
    ...draft.grounding.modelInference.flatMap((statement) => statement.sourceIds),
    ...draft.grounding.conflictingEvidence.flatMap((statement) => statement.sourceIds),
  ]);

  const known = new Set(getEvidenceDocuments([...cited], runId).map((document) => document.id));

  const role = getRole(entry.roleId, runId);
  const validation = validateSuggestionDraft(draft, {
    knownEvidenceIds: known,
    constrained: false,
    entityId: role?.entityId ?? "",
    language,
  });

  if (!validation.ok) {
    throw new Error(
      `The seeded suggestion ${entry.roleId}/${entry.beat}/${language} failed validation: ${describeFailures(validation.failures)}`,
    );
  }
}

/* ==========================================================================
   The opening activity stream
   ========================================================================== */

/**
 * The activity kind a background action projects onto.
 *
 * `system-checked` becomes `retrieved` and `record-reconciled` becomes
 * `reconciled`, because those are what the rows actually describe. Anything
 * unrecognised becomes `observed`, which is the weakest claim available: it
 * says the partner looked at something and asserts nothing about what it did.
 */
function kindForBackgroundAction(kind: string): ActivityInput["kind"] {
  switch (kind) {
    case "system-checked":
      return "retrieved";
    case "record-reconciled":
      return "reconciled";
    case "analysis-completed":
    case "pattern-detected":
      return "analysed";
    case "draft-prepared":
      return "drafted";
    case "escalated":
      return "escalated";
    case "action-executed":
      return "executed";
    default:
      return "observed";
  }
}

/**
 * Projects the background actions for one role into activity entries.
 *
 * Durations are derived from the recorded authority class and target kind
 * rather than invented per row: a read of one system is quick, a
 * reconciliation across two registers is not. This is the one place the module
 * supplies a number the scenario does not hold, and it is a bounded,
 * deterministic function of recorded fields rather than a random value, so two
 * seeds produce the same stream and nobody can mistake it for a measurement
 * of this machine.
 */
function projectedDurationMs(kind: string, evidenceCount: number): number {
  const base =
    kind === "record-reconciled" ? 1_450 : kind === "system-checked" ? 620 : kind === "escalated" ? 240 : 880;
  return base + evidenceCount * 180;
}

function buildOpeningActivity(roleId: RoleId, runId: string): ActivityInput[] {
  const rows = db()
    .select()
    .from(backgroundActions)
    .where(and(eq(backgroundActions.runId, runId), eq(backgroundActions.roleId, roleId)))
    .orderBy(asc(backgroundActions.performedAtMoment), asc(backgroundActions.id))
    .all();

  return rows.map((row) => ({
    runId,
    roleId,
    atMoment: row.performedAtMoment,
    kind: kindForBackgroundAction(row.kind),
    label: row.targetLabel.length > 0 ? row.targetLabel : row.targetId,
    /*
     * The German label falls back to the English one rather than to a machine
     * translation. A wrong German label in a risk product is worse than an
     * English one, and the background action rows carry no German text.
     */
    labelDe: row.targetLabel.length > 0 ? row.targetLabel : row.targetId,
    detail: row.description,
    objectType: row.targetKind,
    objectId: row.targetId,
    toolName: "",
    durationMs: projectedDurationMs(row.kind, row.evidenceIds.length),
    outcome: row.autonomous ? "autonomous" : "assisted",
    authorityClass: row.authorityClass,
    evidenceIds: row.evidenceIds,
  }));
}

/* ==========================================================================
   The seed
   ========================================================================== */

/**
 * Writes the cached beats, the morning suggestions and the opening activity.
 *
 * Idempotent: the rows it owns are cleared first, so calling it twice leaves
 * the same database. Safe to call standalone as well as from the main seed.
 */
export function seedAiPartner(runId: string = DEFAULT_RUN_ID): AiPartnerSeedSummary {
  const state = getScenarioState(runId);
  if (!state) {
    throw new Error(
      "The AI Partner seed requires a scenario run. Call it after the run row has been written.",
    );
  }

  clearAiPartner(runId);

  const summary: AiPartnerSeedSummary = {
    cachedBeats: 0,
    suggestions: 0,
    activityEntries: 0,
    rowsWritten: 0,
  };

  const capturedAt = new Date().toISOString();
  const stageShape = seededStageShape();

  /* ---- 1. Cached beats, one per role, beat and language ---- */
  const beatRows: Array<typeof cachedAiOutputs.$inferInsert> = [];

  for (const entry of SEEDED_SUGGESTIONS) {
    for (const language of LANGUAGES) {
      const draft = language === "de" ? entry.de : entry.en;
      validateSeeded(entry, language, draft, runId);

      beatRows.push({
        id: `CAI-${entry.roleId}-${entry.beat}-${language}`,
        runId,
        beatKey: beatKeyFor(entry.roleId, entry.beat, language),
        roleId: entry.roleId,
        /*
         * Not one of the names in `SCHEMA_REGISTRY`, because a suggestion card
         * is not one of those twelve outputs. The column is a label for the
         * reader of the cache, and `getCachedBeat` does not dispatch on it.
         */
        schemaName: "AISuggestionDraft",
        payload: { draft, stages: stageShape, beat: entry.beat, language },
        capturedFromModel: null,
        capturedAt,
        seeded: true,
        simulatedLatencyMs: entry.simulatedLatencyMs,
      });
    }
  }

  for (let i = 0; i < beatRows.length; i += 25) {
    db().insert(cachedAiOutputs).values(beatRows.slice(i, i + 25)).run();
  }
  summary.cachedBeats = beatRows.length;

  /* ---- 2. The morning card per role, as a validated row ---- */
  for (const entry of SEEDED_SUGGESTIONS) {
    if (entry.beat !== "morning") continue;

    const draft = state.language === "de" ? entry.de : entry.en;
    const role = getRole(entry.roleId, runId);

    const evidenceIds = resolveEvidenceSet({
      roleId: entry.roleId,
      runId,
      viewedMoment: entry.atMoment,
      objectType: entry.objectType,
      objectId: entry.objectId,
    });

    /*
     * The digest is computed exactly as a request would compute it, so the
     * first request of the day finds this row instead of generating. If the
     * two ever drift, the symptom is a duplicate generation at 07:45 rather
     * than an error, which is why there is a test that computes both.
     */
    const digest = computeStateDigest({
      roleId: entry.roleId,
      objectType: entry.objectType,
      objectId: entry.objectId,
      eventId: null,
      viewedMoment: entry.atMoment,
      autonomyLevel: state.autonomyLevel,
      worldView: state.worldView,
      language: state.language,
      evidenceIds,
    });

    const cited = new Set<string>([
      ...draft.evidenceIds,
      ...draft.grounding.verifiedFacts.flatMap((statement) => statement.sourceIds),
      ...draft.grounding.approvedRecords.flatMap((statement) => statement.sourceIds),
      ...draft.grounding.stakeholderStatements.flatMap((statement) => statement.sourceIds),
      ...draft.grounding.modelInference.flatMap((statement) => statement.sourceIds),
      ...draft.grounding.conflictingEvidence.flatMap((statement) => statement.sourceIds),
    ]);
    const known = new Set(getEvidenceDocuments([...cited], runId).map((document) => document.id));

    const validation = validateSuggestionDraft(draft, {
      knownEvidenceIds: known,
      constrained: false,
      entityId: role?.entityId ?? "",
      language: state.language,
    });

    if (!validation.ok) {
      throw new Error(
        `The seeded morning card for ${entry.roleId} failed validation: ${describeFailures(validation.failures)}`,
      );
    }

    persistSuggestion({
      id: `SUG-SEED-${entry.roleId}-morning`,
      runId,
      roleId: entry.roleId,
      eventId: null,
      objectType: entry.objectType,
      objectId: entry.objectId,
      atMoment: entry.atMoment,
      priority: entry.priority,
      decisionId: entry.decisionId,
      draft,
      authorityClass: validation.authorityClass,
      source: "seeded",
      constrained: false,
      missingRequiredSources: [],
      sourceConnectorIds: [],
      stages: stageShape,
      stateDigest: digest,
      model: "",
      durationMs: entry.simulatedLatencyMs,
      validatedAt: capturedAt,
    });

    summary.suggestions += 1;
  }

  /* ---- 3. The opening activity stream, projected from real rows ---- */
  const roleIds: RoleId[] = [
    "tprm",
    "rcsa",
    "control-assurance",
    "incident-resilience",
    "regulatory-change",
    "nfr-governance",
  ];

  for (const roleId of roleIds) {
    const entries = buildOpeningActivity(roleId, runId);
    if (entries.length === 0) {
      log.warn("A role has no background actions, so its activity stream opens empty.", { roleId });
      continue;
    }
    recordActivityBatch(entries);
    summary.activityEntries += entries.length;
  }

  summary.rowsWritten = summary.cachedBeats + summary.suggestions + summary.activityEntries;

  log.info("The AI Partner was seeded.", {
    cachedBeats: summary.cachedBeats,
    suggestions: summary.suggestions,
    activityEntries: summary.activityEntries,
  });

  return summary;
}

/** Coverage report, used by the verification script and the handoff document. */
export function seededCoverage(): Array<{
  roleId: RoleId;
  beats: SuggestionBeat[];
  languages: Array<"en" | "de">;
}> {
  const byRole = new Map<RoleId, SuggestionBeat[]>();
  for (const entry of SEEDED_SUGGESTIONS) {
    const list = byRole.get(entry.roleId) ?? [];
    list.push(entry.beat);
    byRole.set(entry.roleId, list);
  }
  return [...byRole.entries()].map(([roleId, beats]) => ({
    roleId,
    beats,
    languages: LANGUAGES,
  }));
}
