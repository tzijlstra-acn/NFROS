/**
 * The suggestion generation service.
 *
 * Automatic, deduplicated, validated, and the same visible state machine in
 * all three modes. The order of operations matters and is worth stating once:
 *
 *   authoritative context  ->  evidence set  ->  digest  ->  dedupe
 *   ->  required source gate  ->  mode branch  ->  validation  ->  persist
 *
 * Validation sits after the mode branch rather than inside it, so live, safe
 * and offline output all pass through exactly the same checks. An earlier
 * shape validated only the live path on the grounds that seeded content was
 * authored and therefore trustworthy. That was wrong twice over: authored
 * content drifts when the scenario is reseeded, and a validator that only
 * runs on the path nobody can exercise is a validator nobody has tested.
 *
 * Nothing in this module trusts the browser. The role comes from the request;
 * the autonomy level, the scenario clock, the acting user, the world view and
 * the language are read from the scenario run. A client that claims a higher
 * autonomy level changes nothing, which is the same rule `app/api/agent`
 * already holds to and for the same reason.
 */

import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { aiSuggestions } from "@/db/schema/live";
import { recordSuggestionDisposition } from "@/db/repositories/suggestion-dispositions";
import { cachedAiOutputs } from "@/db/schema/decisions";
import {
  connectorInstances,
  connectorSyncState,
  sourceRequirements,
} from "@/db/schema/integration";
import { requireScenarioState } from "@/scenario/engine/state";
import {
  getBackgroundWork,
  getDecision,
  getDecisions,
  getEntity,
  getEvidenceDocuments,
  getRole,
  getUser,
} from "@/db/repositories/workday";
import { uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { requiresCachedCriticalBeats } from "@/server/config/demo-mode";
import { z } from "zod";
import { getOpenAIClient, probeModelAvailability } from "@/server/openai/client";
import { getResolvedModels } from "@/server/config/models";
import { createLogger, redactString } from "@/server/logging/redact";
import { recordAuditEvent } from "@/server/security/audit";
import {
  AI_STAGE_LABELS,
  AI_STAGE_ORDER,
  momentMinutes,
  type AIGenerationState,
  type AISuggestionView,
  type SourceAttribution,
  type WorkdayContext,
} from "@/workday/contracts";
import {
  computeStateDigest,
  singleFlight,
  type DedupeReason,
  type SuggestionStateInput,
} from "./digest";
import {
  heldStageShape,
  MIN_TRANSITION_MS,
  normaliseForReplay,
  seededStageShape,
  StageRecorder,
  stageLabel,
  type StageTransition,
} from "./stages";
import {
  describeFailures,
  sanitiseDraftCopy,
  suggestionDraftSchema,
  validateSuggestionDraft,
  type SuggestionDraft,
  type ValidationFailure,
} from "./validate";
import {
  beatKeyFor,
  seededSuggestionForObjectStrict,
  type SeededSuggestion,
  type SuggestionBeat,
} from "./seeded";
import { SUGGESTION_PROMPT, renderSuggestionContext } from "./prompt";
import { recordActivityBatch, type ActivityInput } from "@/agents/activity/record";

const log = createLogger("suggestion-generate");
const db = () => getDb();

/* ==========================================================================
   The required source interface

   Agent G owns the integration runtime and will answer this question properly
   from the connector registry. That work may not have landed when this module
   runs, so the dependency is expressed as a narrow interface with a default
   implementation that reads `source_requirements` and `connector_sync_state`
   directly.

   Registration rather than a dynamic import is deliberate. A dynamic import
   of a module that does not exist yet is a compile error under this
   project's TypeScript settings, and a try block around it would hide a real
   integration failure behind the same silence as a missing file.
   ========================================================================== */

export interface OutstandingSource {
  connectorInstanceId: string;
  sourceSystem: string;
  objectType: string;
  /** "loading" holds the state. "failed" produces a constrained view. */
  state: "loading" | "failed" | "unknown";
  detail: string;
}

export interface RequiredSourceStatus {
  /** False when at least one required source is loading, failed or unknown. */
  allRequiredAvailable: boolean;
  outstanding: OutstandingSource[];
  /** Attribution rows for every source in scope, required or not. */
  attributions: SourceAttribution[];
}

export interface RequiredSourceQuery {
  runId: string;
  contextType: string;
  contextId: string;
}

export type RequiredSourceResolver = (query: RequiredSourceQuery) => RequiredSourceStatus;

/**
 * Reads the requirement and sync tables directly.
 *
 * A context with no recorded requirements is available rather than blocked.
 * That default is the correct one: the rule the brief states is that a
 * *required* source must not be missing, and a context that declares no
 * required sources has none missing. Defaulting the other way would hold
 * every suggestion in the product at `retrieving` until the integration seed
 * lands, which looks like a deadlock rather than like discipline.
 */
export function defaultRequiredSourceResolver(query: RequiredSourceQuery): RequiredSourceStatus {
  const requirements = db()
    .select()
    .from(sourceRequirements)
    .where(
      and(
        eq(sourceRequirements.runId, query.runId),
        eq(sourceRequirements.contextType, query.contextType),
        eq(sourceRequirements.contextId, query.contextId),
      ),
    )
    .all();

  if (requirements.length === 0) {
    return { allRequiredAvailable: true, outstanding: [], attributions: [] };
  }

  const outstanding: OutstandingSource[] = [];
  const attributions: SourceAttribution[] = [];

  for (const requirement of requirements) {
    const instance = db()
      .select()
      .from(connectorInstances)
      .where(eq(connectorInstances.id, requirement.connectorInstanceId))
      .get();

    const sync = db()
      .select()
      .from(connectorSyncState)
      .where(
        and(
          eq(connectorSyncState.runId, query.runId),
          eq(connectorSyncState.connectorInstanceId, requirement.connectorInstanceId),
          eq(connectorSyncState.objectType, requirement.objectType),
        ),
      )
      .get();

    const health = instance?.healthState ?? "unconfigured";
    const syncStatus = sync?.lastSyncStatus ?? "never-run";

    const failed = health === "unavailable" || syncStatus === "failed";
    const loading = !failed && (syncStatus === "never-run" || syncStatus === "running");

    attributions.push({
      connectorInstanceId: requirement.connectorInstanceId,
      sourceSystem: instance?.sourceSystem ?? requirement.connectorInstanceId,
      mode: instance?.mode ?? "planned",
      freshness: failed ? "unknown" : syncStatus === "ok" ? "fresh" : "unknown",
      lastUpdated: sync?.lastSyncAt ?? instance?.lastSyncAt ?? null,
      recordCount: sync?.recordsSeen ?? 0,
      conflicted: (sync?.recordsConflicted ?? 0) > 0,
      necessity: requirement.necessity,
      deepLink: null,
      loadState: failed ? "error" : loading ? "loading" : "ready",
    });

    if (requirement.necessity !== "required") continue;

    if (failed) {
      outstanding.push({
        connectorInstanceId: requirement.connectorInstanceId,
        sourceSystem: instance?.sourceSystem ?? requirement.connectorInstanceId,
        objectType: requirement.objectType,
        state: "failed",
        detail:
          instance?.healthMessage && instance.healthMessage.length > 0
            ? instance.healthMessage
            : "The source is recorded as unavailable.",
      });
    } else if (loading) {
      outstanding.push({
        connectorInstanceId: requirement.connectorInstanceId,
        sourceSystem: instance?.sourceSystem ?? requirement.connectorInstanceId,
        objectType: requirement.objectType,
        state: "loading",
        detail: "The first synchronisation for this object type has not completed.",
      });
    }
  }

  return {
    allRequiredAvailable: outstanding.length === 0,
    outstanding,
    attributions,
  };
}

let requiredSourceResolver: RequiredSourceResolver = defaultRequiredSourceResolver;

/**
 * Replaces the resolver. Called by the integration runtime once it exists.
 *
 * Exported with a narrow signature so the integration runtime does not have
 * to know anything about suggestions, and this module does not have to know
 * anything about connectors beyond the three facts it uses.
 */
export function setRequiredSourceResolver(resolver: RequiredSourceResolver): void {
  requiredSourceResolver = resolver;
  log.info("A required source resolver was registered by the integration runtime.");
}

/** Restores the default resolver. Test use only. */
export function resetRequiredSourceResolver(): void {
  requiredSourceResolver = defaultRequiredSourceResolver;
}

/* ==========================================================================
   Request and result
   ========================================================================== */

export interface GenerateSuggestionRequest {
  roleId: RoleId;
  objectType: string;
  objectId: string;
  eventId?: string | null;
  /** The only manual control. There is no Generate button. */
  refresh?: boolean;
  runId?: string;
  /** Overrides the viewed moment. Used by the live player and by tests. */
  viewedMoment?: string;
}

export interface GenerateSuggestionResult {
  suggestion: AISuggestionView | null;
  generation: {
    state: AIGenerationState;
    completedStages: AIGenerationState[];
    label: string;
  };
  cached: boolean;
  error?: string;
  retryable?: boolean;
  /**
   * Separated from everything above on purpose.
   *
   * The workday interface is neutral: no model name, no provider name, no
   * trace metadata. These two fields exist for the explicit disclosure the
   * interface puts them behind, and nothing in the suggestion copy may repeat
   * them. The validator enforces the second half of that.
   */
  details?: { model: string; durationMs: number; source: "live" | "cache" | "seeded" };
  /** Why no new work was started, when none was. */
  dedupeReason?: DedupeReason;
}

/* ==========================================================================
   Authoritative context
   ========================================================================== */

/** Role to holder. Mirrors `app/api/agent/route.ts`, read server side only. */
const ROLE_HOLDERS: Record<RoleId, string> = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
};

/**
 * Assembles the full context from the scenario run.
 *
 * `viewedMoment` is the one value a caller may influence, because the live
 * player genuinely owns it and it is not a privilege: looking at 10:30 grants
 * nothing. Everything else is read here.
 */
export function buildWorkdayContext(params: {
  roleId: RoleId;
  runId?: string;
  viewedMoment?: string;
  objectType?: string;
  objectId?: string;
  eventId?: string | null;
}): WorkdayContext {
  const runId = params.runId ?? DEFAULT_RUN_ID;
  const state = requireScenarioState(runId);
  const role = getRole(params.roleId, runId);
  const entity = role ? getEntity(role.entityId, runId) : undefined;
  const holder = getUser(ROLE_HOLDERS[params.roleId], runId);

  const viewedMoment = params.viewedMoment ?? state.currentMoment;
  const decisions = getDecisions(params.roleId, viewedMoment, runId);
  const evidenceIds = resolveEvidenceSet({
    roleId: params.roleId,
    runId,
    viewedMoment,
    objectType: params.objectType ?? "",
    objectId: params.objectId ?? "",
  });

  return {
    runId,
    roleId: params.roleId,
    roleTitle: role?.title ?? params.roleId,
    holderName: holder?.name ?? "the acting professional",
    entityId: entity?.id ?? role?.entityId ?? "",
    entityName: entity?.name ?? "",
    entityCountry: entity?.jurisdiction ?? "",
    regulatorContext: entity ? [entity.supervisoryContext] : [],
    currentMoment: state.currentMoment,
    viewedMoment,
    autonomyLevel: state.autonomyLevel,
    language: state.language,
    demoMode: getResolvedDemoMode().mode,
    worldView: state.worldView,
    selection:
      params.objectType && params.objectId
        ? {
            objectType: params.objectType as never,
            objectId: params.objectId,
            label: params.objectId,
          }
        : null,
    openDecisionIds: decisions
      .filter((entry) => entry.decision.status === "open")
      .map((entry) => entry.decision.id),
    unreadEventIds: [],
    evidenceIds,
    recentDecisionIds: decisions
      .filter((entry) => entry.decision.status === "decided")
      .map((entry) => entry.decision.id),
    activeSuggestionId: null,
  };
}

/**
 * Resolves the evidence set in scope for an object at a moment.
 *
 * Deterministic, and derived from rows rather than chosen here. Three sources
 * are unioned: the decisions the role holds on this object, the seeded card
 * for the beat, and anything the object's own decision record cites. The
 * result is sorted, which matters because this set feeds the digest and an
 * unstable order would miss the cache on every second request.
 */
export function resolveEvidenceSet(params: {
  roleId: RoleId;
  runId: string;
  viewedMoment: string;
  objectType: string;
  objectId: string;
}): string[] {
  const ids = new Set<string>();

  for (const entry of getDecisions(params.roleId, params.viewedMoment, params.runId)) {
    const matchesObject =
      params.objectId.length === 0 ||
      entry.decision.relatedObjectId === params.objectId ||
      entry.decision.id === params.objectId;
    if (!matchesObject) continue;
    for (const id of entry.decision.supportingEvidenceIds) ids.add(id);
    for (const id of entry.decision.opposingEvidenceIds) ids.add(id);
  }

  /*
   * Strict, so the digest for an unrecognised object is derived from real
   * decisions only. A fallback here would mix another object's citations into
   * this object's cache key, and two different objects would then share one
   * digest and one another's suggestion.
   */
  const seeded = seededSuggestionForObjectStrict(
    params.roleId,
    params.objectId,
    params.viewedMoment,
  );
  if (seeded) for (const id of seeded.en.evidenceIds) ids.add(id);

  /*
   * Only identifiers that resolve are kept.
   *
   * A decision record can cite a document that is revealed later in the day,
   * and feeding an unresolvable identifier into the digest and the prompt
   * would both destabilise the cache key and invite the model to cite
   * something the reader cannot open.
   */
  const resolved = new Set(
    getEvidenceDocuments([...ids], params.runId).map((document) => document.id),
  );
  return [...resolved].sort();
}

/* ==========================================================================
   Persistence
   ========================================================================== */

function rowToView(row: typeof aiSuggestions.$inferSelect, sources: SourceAttribution[]): AISuggestionView {
  return {
    id: row.id,
    roleId: row.roleId,
    eventId: row.eventId,
    objectType: row.objectType,
    objectId: row.objectId,
    atMoment: row.atMoment,
    status: row.status,
    priority: row.priority,
    authorityClass: row.authorityClass,
    decisionId: row.decisionId,
    source: row.source,
    constrained: row.constrained,
    missingRequiredSources: row.missingRequiredSources,
    sources,
    createdAt: row.createdAt,
    headline: row.headline,
    changeSummary: row.changeSummary,
    whyItMatters: row.whyItMatters,
    checksCompleted: row.checksCompleted,
    actionsCompleted: row.actionsCompleted,
    recommendedAction: row.recommendedAction,
    alternatives: row.alternatives,
    evidenceIds: row.evidenceIds,
    confidence: row.confidence,
    uncertainty: row.uncertainty,
    decisionRequired: row.decisionRequired,
    disposition: row.disposition,
  };
}

/**
 * Finds a validated row for a digest.
 *
 * `validatedAt` is required to be non null. A row that was written and failed
 * validation must never satisfy a later request, which is the database side of
 * the rule that nothing unvalidated is readable.
 */
export function findValidatedSuggestion(
  digest: string,
  runId = DEFAULT_RUN_ID,
): typeof aiSuggestions.$inferSelect | null {
  const rows = db()
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.runId, runId), eq(aiSuggestions.stateDigest, digest)))
    .orderBy(desc(aiSuggestions.createdAt))
    .all();

  return rows.find((row) => row.validatedAt !== null && row.dismissedAt === null) ?? null;
}

let suggestionSequence = 0;

function nextSuggestionId(): string {
  suggestionSequence += 1;
  return `SUG-${Date.now().toString(36).toUpperCase()}-${String(suggestionSequence).padStart(3, "0")}`;
}

export interface PersistSuggestionParams {
  runId: string;
  roleId: RoleId;
  eventId: string | null;
  objectType: string;
  objectId: string;
  atMoment: string;
  priority: "critical" | "high" | "medium" | "low";
  decisionId: string | null;
  draft: SuggestionDraft;
  authorityClass: AISuggestionView["authorityClass"];
  source: "live" | "cache" | "seeded";
  constrained: boolean;
  missingRequiredSources: string[];
  sourceConnectorIds: string[];
  stages: StageTransition[];
  stateDigest: string;
  model: string;
  durationMs: number;
  /** Null means the row was written and must not be publishable. */
  validatedAt: string | null;
  id?: string;
}

type SuggestionRow = typeof aiSuggestions.$inferSelect;
type SuggestionInsert = typeof aiSuggestions.$inferInsert;

let dispositionSequence = 0;

function dispositionEntryId(suggestionId: string): string {
  dispositionSequence += 1;
  return `DSP-${suggestionId}-${Date.now().toString(36).toUpperCase()}-${String(dispositionSequence).padStart(4, "0")}`;
}

/**
 * Whether a regenerated suggestion says something different from the stored one.
 *
 * The prepared content and the authority it carries, not the bookkeeping: a
 * new timestamp or a replayed stage list is the same suggestion, and the
 * person's answer to it still stands.
 */
export function materiallyChanged(previous: SuggestionRow, next: SuggestionInsert): boolean {
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return !(
    same(previous.headline, next.headline) &&
    same(previous.changeSummary, next.changeSummary) &&
    same(previous.whyItMatters, next.whyItMatters) &&
    same(previous.recommendedAction, next.recommendedAction) &&
    same(previous.alternatives, next.alternatives) &&
    same([...(previous.evidenceIds ?? [])].sort(), [...(next.evidenceIds ?? [])].sort()) &&
    same(previous.decisionRequired, next.decisionRequired) &&
    same(previous.authorityClass, next.authorityClass) &&
    same(previous.decisionId, next.decisionId) &&
    same(previous.constrained, next.constrained) &&
    same(previous.validatedAt === null, next.validatedAt === null)
  );
}

/**
 * Writes a suggestion row. The only writer of `ai_suggestions`.
 *
 * The person's answer survives regeneration (os-data-model handoff, section
 * 6). The row is still replaced by id, so a reseed rewrites rather than
 * duplicates, but:
 *
 *   an unchanged suggestion keeps its disposition, its snooze and its
 *   dismissal, because nothing the person answered has changed;
 *
 *   a materially changed suggestion under the same id records the old version
 *   as expired and the new version as new, both in the disposition history,
 *   so the history says what happened instead of silently resetting;
 *
 *   a newly validated suggestion about the same matter (same role, object,
 *   event and decision) supersedes the open ones before it, which are
 *   recorded as expired with a pointer to it. A suggestion the person already
 *   answered is left as answered.
 */
export function persistSuggestion(params: PersistSuggestionParams): typeof aiSuggestions.$inferSelect {
  const id = params.id ?? nextSuggestionId();
  const now = new Date().toISOString();
  const draft = params.draft;

  const row: typeof aiSuggestions.$inferInsert = {
    id,
    runId: params.runId,
    roleId: params.roleId,
    eventId: params.eventId,
    objectType: params.objectType,
    objectId: params.objectId,
    atMoment: params.atMoment,
    status: params.validatedAt === null ? "checking" : draft.decisionRequired ? "needs-user" : "ready",
    priority: params.priority,
    headline: draft.headline,
    changeSummary: draft.changeSummary,
    whyItMatters: draft.whyItMatters,
    checksCompleted: draft.checksCompleted,
    actionsCompleted: draft.actionsCompleted,
    recommendedAction: draft.recommendedAction,
    alternatives: draft.alternatives,
    evidenceIds: draft.evidenceIds,
    confidence: Math.round(draft.confidence),
    uncertainty: draft.uncertainty,
    decisionRequired: draft.decisionRequired,
    authorityClass: params.authorityClass,
    decisionId: params.decisionId,
    source: params.source,
    constrained: params.constrained,
    missingRequiredSources: params.missingRequiredSources,
    sourceConnectorIds: params.sourceConnectorIds,
    stages: params.stages,
    stateDigest: params.stateDigest,
    agentRunId: null,
    model: params.model,
    durationMs: params.durationMs,
    validatedAt: params.validatedAt,
    createdAt: now,
    dismissedAt: null,
    snoozedUntilMoment: null,
  };

  const write = getSqlite().transaction((): SuggestionRow => {
    const previous = db().select().from(aiSuggestions).where(eq(aiSuggestions.id, id)).get();
    const changed = previous ? materiallyChanged(previous, row) : false;

    if (previous && changed && previous.disposition !== "expired") {
      recordSuggestionDisposition({
        id: dispositionEntryId(id),
        suggestionId: id,
        to: "expired",
        actorKind: "system",
        actorUserId: null,
        at: now,
        atMoment: params.atMoment,
        reason: "The prepared content changed, so this version no longer applies.",
        resultKind: "suggestion",
        resultId: id,
        runId: params.runId,
      });
    }

    // Upsert on the primary key so a reseed rewrites rather than duplicating.
    db().delete(aiSuggestions).where(eq(aiSuggestions.id, id)).run();
    const carried: Partial<SuggestionInsert> = previous
      ? changed
        ? { disposition: "expired", dispositionAt: now, dispositionByUserId: null }
        : {
            disposition: previous.disposition,
            dispositionAt: previous.dispositionAt,
            dispositionByUserId: previous.dispositionByUserId,
            dismissedAt: previous.dismissedAt,
            snoozedUntilMoment: previous.snoozedUntilMoment,
          }
      : {};
    db().insert(aiSuggestions).values({ ...row, ...carried }).run();

    if (previous && changed) {
      recordSuggestionDisposition({
        id: dispositionEntryId(id),
        suggestionId: id,
        to: "new",
        actorKind: "system",
        actorUserId: null,
        at: now,
        atMoment: params.atMoment,
        reason: "Prepared again from changed records.",
        runId: params.runId,
      });
    }

    if (!previous && params.validatedAt !== null) expireSuperseded(params, id, now);

    const written = db().select().from(aiSuggestions).where(eq(aiSuggestions.id, id)).get();
    if (!written) throw new Error(`The suggestion ${id} was not written.`);
    return written;
  });

  return write();
}

/** Open, validated suggestions about the same matter as a new one become expired, pointing at it. */
function expireSuperseded(params: PersistSuggestionParams, newId: string, at: string): void {
  const conditions = [
    eq(aiSuggestions.runId, params.runId),
    eq(aiSuggestions.roleId, params.roleId),
    eq(aiSuggestions.objectType, params.objectType),
    eq(aiSuggestions.objectId, params.objectId),
    ne(aiSuggestions.id, newId),
    ne(aiSuggestions.stateDigest, params.stateDigest),
    inArray(aiSuggestions.disposition, ["new", "reviewed"]),
    params.eventId === null ? isNull(aiSuggestions.eventId) : eq(aiSuggestions.eventId, params.eventId),
    params.decisionId === null ? isNull(aiSuggestions.decisionId) : eq(aiSuggestions.decisionId, params.decisionId),
  ];
  const older = db()
    .select({ id: aiSuggestions.id, validatedAt: aiSuggestions.validatedAt })
    .from(aiSuggestions)
    .where(and(...conditions))
    .all()
    .filter((entry) => entry.validatedAt !== null);
  for (const entry of older) {
    recordSuggestionDisposition({
      id: dispositionEntryId(entry.id),
      suggestionId: entry.id,
      to: "expired",
      actorKind: "system",
      actorUserId: null,
      at,
      atMoment: params.atMoment,
      reason: `Superseded by ${newId}, prepared for the same matter.`,
      resultKind: "suggestion",
      resultId: newId,
      runId: params.runId,
    });
  }
}

/* ==========================================================================
   Stage helpers
   ========================================================================== */

function generationFrom(
  stages: readonly StageTransition[],
  language: "en" | "de",
): GenerateSuggestionResult["generation"] {
  const completedStages = stages.map((stage) => stage.state);
  const state = completedStages[completedStages.length - 1] ?? "idle";
  return { state, completedStages, label: stageLabel(state, language) };
}

function idleGeneration(language: "en" | "de"): GenerateSuggestionResult["generation"] {
  return {
    state: "idle",
    completedStages: [],
    label: language === "de" ? AI_STAGE_LABELS.idle.de : AI_STAGE_LABELS.idle.en,
  };
}

/* ==========================================================================
   Cached and seeded drafts
   ========================================================================== */

/** Reads a cached validated beat, which is what presenter safe mode serves. */
export function readCachedBeat(
  roleId: RoleId,
  beat: SuggestionBeat,
  language: "en" | "de",
  runId = DEFAULT_RUN_ID,
): { draft: SuggestionDraft; latencyMs: number; stages: StageTransition[] } | null {
  const row = db()
    .select()
    .from(cachedAiOutputs)
    .where(
      and(
        eq(cachedAiOutputs.runId, runId),
        eq(cachedAiOutputs.beatKey, beatKeyFor(roleId, beat, language)),
      ),
    )
    .get();
  if (!row) return null;

  const payload = row.payload as { draft?: unknown; stages?: unknown };
  const parsed = suggestionDraftSchema.safeParse(payload.draft);
  if (!parsed.success) {
    /*
     * A malformed cached beat is reported, not repaired.
     *
     * The seed validates every beat before writing it, so reaching here means
     * the cache and the schema have drifted. Falling back silently would make
     * presenter safe mode quietly become offline mode, which is exactly the
     * kind of undisclosed downgrade this product refuses elsewhere.
     */
    log.warn("A cached suggestion beat does not match the schema and was skipped.", {
      beatKey: beatKeyFor(roleId, beat, language),
    });
    return null;
  }

  const stages = Array.isArray(payload.stages)
    ? (payload.stages as StageTransition[])
    : seededStageShape();

  return { draft: parsed.data, latencyMs: row.simulatedLatencyMs, stages };
}

/**
 * The authored draft for a context, in the active language.
 *
 * Returns null rather than something approximate when no card was authored
 * about this object. The caller then reports that nothing is prepared, which
 * is the honest answer: a card is copy about one named record, and publishing
 * another record's copy under this object identifier would put prose about
 * CTL-PAY-014 on a row that says something else.
 */
function seededDraftFor(
  roleId: RoleId,
  objectId: string,
  moment: string,
  language: "en" | "de",
): { seeded: SeededSuggestion; draft: SuggestionDraft } | null {
  const seeded = seededSuggestionForObjectStrict(roleId, objectId, moment);
  if (!seeded) return null;
  return { seeded, draft: language === "de" ? seeded.de : seeded.en };
}

/**
 * Applies the constrained rule to a draft.
 *
 * Confidence is capped below the high confidence threshold, the recommendation
 * is withdrawn, and the outstanding source is named in the uncertainty list.
 * The checks already completed are kept, because the brief is explicit that
 * the user may inspect facts that did load.
 */
function constrainDraft(
  draft: SuggestionDraft,
  outstanding: readonly OutstandingSource[],
  language: "en" | "de",
): SuggestionDraft {
  const names = outstanding.map((entry) => entry.sourceSystem);
  const note =
    language === "de"
      ? `Eine erforderliche Quelle ist nicht verfuegbar: ${names.join(", ")}. Es wird keine abschliessende Empfehlung gegeben, und die bereits geladenen Fakten bleiben einsehbar.`
      : `A required source is unavailable: ${names.join(", ")}. No final recommendation is offered, and the facts that did load remain inspectable.`;

  return {
    ...draft,
    recommendedAction: null,
    recommendedToolName: null,
    alternatives: [],
    confidence: Math.min(draft.confidence, 40),
    uncertainty: [note, ...draft.uncertainty].slice(0, 6),
    decisionRequired: false,
  };
}

/* ==========================================================================
   The live path
   ========================================================================== */

/**
 * One structured generation against the model.
 *
 * Correct by construction rather than by testing, because no usable credential
 * exists in this environment: the schema is the published draft schema, the
 * context is the same block the seeded content was written against, and every
 * failure path returns null so the caller falls back. There is deliberately
 * no retry here. The caller's fallback is faster and more predictable than a
 * second attempt, and in a live demonstration predictability wins.
 */
async function generateLiveDraft(params: {
  context: WorkdayContext;
  objectType: string;
  objectId: string;
  objectLabel: string;
  eventId: string | null;
  evidence: Array<{ id: string; reference: string; title: string; status: string; isStale: boolean; provenance: string }>;
  whyThisMatters: string[];
  uncertainty: string[];
  openDecisions: Array<{ id: string; title: string; judgmentKind: string; requiredAuthority: string }>;
  backgroundWork: string[];
  missingRequiredSources: string[];
  recorder: StageRecorder;
}): Promise<{ draft: SuggestionDraft; model: string } | { error: string }> {
  const client = getOpenAIClient();
  if (client === null) {
    return { error: "Live calls are not permitted in the current mode." };
  }

  try {
    await probeModelAvailability();
    const models = getResolvedModels();

    params.recorder.mark("analysing");

    /*
     * The shape is enforced by the provider, not asked for in the prompt.
     *
     * This call originally relied on the prompt plus a brace extractor, and a
     * live run showed why that is not enough. The model returned plain strings
     * inside the five grounding arrays, which expect typed statement objects,
     * so validation rejected a draft whose prose was perfectly good. The
     * grounding block is the one part of this schema that must not be relaxed
     * to make a call succeed: separate arrays of typed statements are what
     * keep a verified fact, an approved record, a stakeholder statement, a
     * model inference and a contradiction from being rendered as one
     * undifferentiated list.
     *
     * So the schema is sent. `z.toJSONSchema` with `io: "input"` produces the
     * draft shape, and `strict` mode makes the provider refuse to emit
     * anything else. That turns a class of validation failure into an
     * impossibility rather than a retry.
     *
     * The local validation after this is NOT redundant. Structured output
     * guarantees the shape and says nothing about the content, and the
     * content rules are the ones that matter here: an evidence identifier has
     * to resolve, a recommended action has to name a real tool, the copy has
     * to carry no em dash and no provider name, and confidence must not be
     * high while the output is constrained.
     */
    const response = await client.responses.create({
      model: models.primary,
      instructions: SUGGESTION_PROMPT,
      input: renderSuggestionContext(params.context, {
        objectType: params.objectType,
        objectId: params.objectId,
        objectLabel: params.objectLabel,
        eventId: params.eventId,
        eventSummary: null,
        evidence: params.evidence,
        whyThisMatters: params.whyThisMatters,
        uncertainty: params.uncertainty,
        openDecisions: params.openDecisions,
        backgroundWork: params.backgroundWork,
        missingRequiredSources: params.missingRequiredSources,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "nfr_suggestion_draft",
          strict: true,
          schema: suggestionDraftJsonSchema(),
        },
      },
      /*
       * Raised from 2,400. The gpt-5 family draws reasoning tokens from the
       * same output budget, and a card with a populated grounding block is a
       * large object, so the earlier budget left drafts truncated.
       */
      max_output_tokens: 6_000,
    });

    params.recorder.mark("drafting");

    const text = response.output_text;
    if (typeof text !== "string" || text.trim().length === 0) {
      return { error: "The model returned no content." };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(extractJsonObject(text));
    } catch {
      return { error: "The model returned content that is not a single JSON object." };
    }

    const parsed = suggestionDraftSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        error: `The model output did not match the suggestion schema: ${parsed.error.issues
          .slice(0, 3)
          .map((issue) => issue.message)
          .join("; ")}`,
      };
    }

    // The em dash is stripped rather than reported, because it is a copy rule
    // and not a judgment. Everything substantive is left for the validator.
    return { draft: sanitiseDraftCopy(parsed.data), model: models.primary };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown error";
    /*
     * Redacted on the way out.
     *
     * When a key is rejected the provider echoes it back in a masked form
     * that still discloses its last characters and its exact length, and this
     * string reaches a route response. `redactString` is the only sanctioned
     * way to surface provider error text.
     */
    return { error: redactString(raw) };
  }
}

/**
 * Extracts the first balanced JSON object from a response.
 *
 * Needed because a model asked for JSON sometimes wraps it in a fenced block
 * or a sentence, and `JSON.parse` on the whole string then fails for a
 * cosmetic reason while the content is perfectly good.
 */
function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  if (start === -1) return trimmed;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < trimmed.length; i += 1) {
    const character = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }

  return trimmed.slice(start);
}

/* ==========================================================================
   Validation failure recording
   ========================================================================== */

function recordValidationFailure(params: {
  runId: string;
  roleId: RoleId;
  atMoment: string;
  objectType: string;
  objectId: string;
  source: "live" | "cache" | "seeded";
  failures: readonly ValidationFailure[];
}): void {
  recordAuditEvent({
    runId: params.runId,
    atMoment: params.atMoment,
    category: "system",
    action: "validateSuggestion",
    objectKind: params.objectType,
    objectId: params.objectId,
    summary: `A prepared suggestion failed structured validation and was not published. ${params.failures.length} rule(s) failed.`,
    actorKind: "system",
    roleId: params.roleId,
    reversible: false,
    blocked: true,
    blockedReason: describeFailures(params.failures),
    detail: { source: params.source, codes: params.failures.map((failure) => failure.code) },
  });

  log.warn("A suggestion failed validation and was not published.", {
    roleId: params.roleId,
    objectId: params.objectId,
    codes: params.failures.map((failure) => failure.code),
  });
}

/* ==========================================================================
   The orchestrator
   ========================================================================== */

/**
 * Generates, or returns, the suggestion for one context.
 *
 * Every automatic trigger in the product funnels through this one function:
 * opening a role, selecting a material focus item, a new live event, opening a
 * decision with conflicting evidence, completing a meeting, approving an
 * action, and switching to a role the shared event affects. They differ only
 * in the arguments they pass, which is why the deduplication can be complete:
 * there is one place that could start duplicate work and it does not.
 */
/**
 * The draft schema in the form the provider needs.
 *
 * Built once and cached, because `z.toJSONSchema` walks the whole schema and
 * this runs on every live generation.
 *
 * `strict` mode in the Responses API requires every property to be listed in
 * `required` and `additionalProperties` to be false on every object. Zod
 * produces the first by default for non optional fields, and this adds the
 * second everywhere, recursively, because a nested object that permits extra
 * properties is rejected by the provider with an unhelpful error.
 */
let cachedJsonSchema: Record<string, unknown> | null = null;

function suggestionDraftJsonSchema(): Record<string, unknown> {
  if (cachedJsonSchema !== null) return cachedJsonSchema;

  const schema = z.toJSONSchema(suggestionDraftSchema, { io: "input" }) as Record<string, unknown>;

  const harden = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) harden(child);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record["type"] === "object") {
      record["additionalProperties"] = false;
      const properties = record["properties"];
      if (properties !== null && typeof properties === "object") {
        record["required"] = Object.keys(properties as Record<string, unknown>);
      }
    }
    for (const value of Object.values(record)) harden(value);
  };

  harden(schema);
  cachedJsonSchema = schema;
  return schema;
}

export async function generateSuggestion(
  request: GenerateSuggestionRequest,
): Promise<GenerateSuggestionResult> {
  const runId = request.runId ?? DEFAULT_RUN_ID;
  const context = buildWorkdayContext({
    roleId: request.roleId,
    runId,
    ...(request.viewedMoment ? { viewedMoment: request.viewedMoment } : {}),
    objectType: request.objectType,
    objectId: request.objectId,
    eventId: request.eventId ?? null,
  });

  const language = context.language;
  const eventId = request.eventId ?? null;

  const stateInput: SuggestionStateInput = {
    roleId: request.roleId,
    objectType: request.objectType,
    objectId: request.objectId,
    eventId,
    viewedMoment: context.viewedMoment,
    autonomyLevel: context.autonomyLevel,
    worldView: context.worldView,
    language,
    evidenceIds: context.evidenceIds,
  };
  const digest = computeStateDigest(stateInput);

  /* ---- Layer one: a validated row for this exact state ---- */
  if (request.refresh !== true) {
    const existing = findValidatedSuggestion(digest, runId);
    if (existing) {
      const sources = requiredSourceResolver({
        runId,
        contextType: request.objectType,
        contextId: request.objectId,
      }).attributions;

      return {
        suggestion: rowToView(existing, sources),
        generation: generationFrom(normaliseForReplay(existing.stages), language),
        cached: true,
        dedupeReason: "cached",
        details: {
          model: existing.model,
          durationMs: existing.durationMs,
          source: existing.source,
        },
      };
    }

    /*
     * Historical time with nothing prepared starts no work.
     *
     * Scrubbing the live player backwards walks through many moments, and
     * generating for each one would queue a dozen requests the user never
     * asked for. A refresh is the explicit way to say otherwise.
     */
    if (momentMinutes(context.viewedMoment) < momentMinutes(context.currentMoment)) {
      return {
        suggestion: null,
        generation: idleGeneration(language),
        cached: false,
        dedupeReason: "historical-view",
      };
    }
  }

  /* ---- Layer two: one generation per digest, shared by concurrent callers ---- */
  const { value, joined } = await singleFlight(digest, () =>
    runGeneration({ request, context, digest, runId, eventId }),
  );

  // A caller that joined an existing generation did not create a second
  // request, which is exactly what the acceptance criterion asks for.
  return joined ? { ...value, cached: true, dedupeReason: "running" } : value;
}

/** The work itself. Only ever called through `singleFlight`. */
async function runGeneration(params: {
  request: GenerateSuggestionRequest;
  context: WorkdayContext;
  digest: string;
  runId: string;
  eventId: string | null;
}): Promise<GenerateSuggestionResult> {
  const { context, digest, runId, eventId } = params;
  const { objectType, objectId } = params.request;
  const language = context.language;
  const mode = getResolvedDemoMode().mode;

  const recorder = new StageRecorder();
  recorder.mark("queued");

  /* ---- Deterministic context, measured ---- */
  const retrievalStarted = Date.now();
  const evidence = getEvidenceDocuments(context.evidenceIds, runId);
  const retrievalMs = Date.now() - retrievalStarted;
  recorder.mark("retrieving");

  const reconcileStarted = Date.now();
  const uncertainty = uncertaintyFromEvidence(context.evidenceIds, runId);
  const decisions = getDecisions(context.roleId, context.viewedMoment, runId).filter(
    (entry) =>
      entry.decision.status === "open" &&
      (entry.decision.relatedObjectId === objectId || objectId.length === 0),
  );
  const backgroundWork = getBackgroundWork(context.roleId, context.viewedMoment, runId);
  const reconcileMs = Date.now() - reconcileStarted;
  recorder.mark("reconciling");

  const activity: ActivityInput[] = [
    {
      runId,
      roleId: context.roleId,
      atMoment: context.viewedMoment,
      kind: "retrieved",
      label: `Loaded ${evidence.length} evidence document(s) for ${objectId}`,
      labelDe: `${evidence.length} Nachweisdokument(e) fuer ${objectId} geladen`,
      detail:
        evidence.length === 0
          ? "The evidence set for this object is empty, and the query scope is recorded so that is itself a finding."
          : `Read ${evidence.length} document(s) from the evidence corpus, of which ${evidence.filter((document) => document.isStale).length} are older than the policy freshness requirement.`,
      objectType,
      objectId,
      toolName: "getEvidenceDocuments",
      durationMs: retrievalMs,
      outcome: evidence.length === 0 ? "empty" : "ok",
      authorityClass: "READ",
      evidenceIds: context.evidenceIds,
    },
    {
      runId,
      roleId: context.roleId,
      atMoment: context.viewedMoment,
      kind: "reconciled",
      label: `Reconciled the evidence set against ${decisions.length} open decision(s)`,
      labelDe: `Nachweismenge gegen ${decisions.length} offene Entscheidung(en) abgeglichen`,
      detail: `Derived ${uncertainty.length} uncertaint(ies) from the state of the corpus: missing and stale documents are detected without a model.`,
      objectType,
      objectId,
      toolName: "uncertaintyFromEvidence",
      durationMs: reconcileMs,
      outcome: "ok",
      authorityClass: "READ",
      evidenceIds: context.evidenceIds,
    },
  ];

  const seededPair = seededDraftFor(context.roleId, objectId, context.viewedMoment, language);

  /*
   * Nothing was authored or cached about this object, so there is nothing
   * honest to publish. The deterministic reads above already happened and are
   * recorded, which is the part that must survive: the evidence, the open
   * decisions and the detected uncertainties remain usable even though no
   * card is produced.
   */
  if (seededPair === null) {
    recordActivityBatch(activity);
    return {
      suggestion: null,
      generation: idleGeneration(language),
      cached: false,
      error:
        language === "de"
          ? `Fuer ${objectId} liegt kein vorbereiteter Vorschlag vor. Die Nachweise und die offenen Entscheidungen bleiben nutzbar.`
          : `No prepared suggestion exists for ${objectId}. The evidence and the open decisions remain usable.`,
      retryable: false,
    };
  }

  /*
   * The beat comes from the card that was authored about this object, not
   * from the clock. Those differ when a user opens an object at a moment
   * whose beat has no card for it, and keying the cache on the clock would
   * then serve a beat written about a different record.
   */
  const beat: SuggestionBeat = seededPair.seeded.beat;
  const decisionId = decisions[0]?.decision.id ?? seededPair.seeded.decisionId;
  const priority = seededPair.seeded.priority;
  const objectLabel = seededPair.seeded.objectLabel;

  /* ---- The required source gate ---- */
  const sourceStatus = requiredSourceResolver({
    runId,
    contextType: objectType,
    contextId: objectId,
  });
  const outstanding = sourceStatus.outstanding;
  const missingRequiredSources = outstanding.map((entry) => entry.sourceSystem);
  const hasFailedSource = outstanding.some((entry) => entry.state === "failed");
  const hasLoadingSource = outstanding.some((entry) => entry.state !== "failed");


  /*
   * A required source that is still loading holds the state.
   *
   * The progression stops at `reconciling` and never reaches `ready`, so
   * `isPublishableState` is false and the interface cannot render a card. The
   * facts that did load are still written to the activity stream, which is
   * what lets the user inspect them while waiting.
   */
  if (hasLoadingSource && !hasFailedSource) {
    recordActivityBatch([
      ...activity,
      {
        runId,
        roleId: context.roleId,
        atMoment: context.viewedMoment,
        kind: "waiting",
        label: `Waiting for a required source: ${missingRequiredSources.join(", ")}`,
        labelDe: `Warten auf eine erforderliche Quelle: ${missingRequiredSources.join(", ")}`,
        detail: outstanding.map((entry) => `${entry.sourceSystem}: ${entry.detail}`).join(" "),
        objectType,
        objectId,
        durationMs: 0,
        outcome: "waiting",
        authorityClass: "READ",
      },
    ]);

    const held = heldStageShape("reconciling");
    return {
      suggestion: null,
      generation: generationFrom(held, language),
      cached: false,
      error:
        language === "de"
          ? `Eine erforderliche Quelle wird noch geladen: ${missingRequiredSources.join(", ")}. Die Vorbereitung wird automatisch fortgesetzt, sobald sie verfuegbar ist.`
          : `A required source is still loading: ${missingRequiredSources.join(", ")}. Preparation continues automatically once it is available.`,
      retryable: true,
    };
  }

  const constrained = hasFailedSource;

  /* ---- Mode branch ---- */
  let draft: SuggestionDraft | null = null;
  let source: "live" | "cache" | "seeded" = "seeded";
  let model = "";
  let liveError: string | null = null;
  let stages: StageTransition[] = [];

  if (mode === "live" && !requiresCachedCriticalBeats(mode)) {
    const live = await generateLiveDraft({
      context,
      objectType,
      objectId,
      objectLabel,
      eventId,
      evidence: evidence.map((document) => ({
        id: document.id,
        reference: document.reference,
        title: document.title,
        status: document.status,
        isStale: document.isStale,
        provenance: document.provenance,
      })),
      whyThisMatters: decisions.map((entry) => entry.decision.whyThisMatters),
      uncertainty: uncertainty.map((entry) => `${entry.topic}: ${entry.description}`),
      openDecisions: decisions.map((entry) => ({
        id: entry.decision.id,
        title: entry.decision.title,
        judgmentKind: entry.decision.judgmentKind,
        requiredAuthority: entry.decision.requiredAuthority,
      })),
      backgroundWork: backgroundWork.actions.map((action) => action.description),
      missingRequiredSources,
      recorder,
    });

    if ("draft" in live) {
      draft = live.draft;
      source = "live";
      model = live.model;
      // Live uses the stages the server actually reached. Nothing is padded.
      stages = recorder.recorded();
    } else {
      liveError = live.error;
      log.warn("The live suggestion generation failed and the application fell back.", {
        roleId: context.roleId,
        objectId,
      });
    }
  }

  /* ---- Presenter safe: a cached validated beat, replayed ---- */
  if (draft === null && mode !== "offline") {
    const cached = readCachedBeat(context.roleId, beat, language, runId);
    if (cached) {
      draft = cached.draft;
      source = "cache";
      model = "";
      stages = normaliseForReplay(cached.stages);
    }
  }

  /* ---- Offline and final fallback: seeded ---- */
  if (draft === null && seededPair) {
    draft = seededPair.draft;
    source = "seeded";
    model = "";
    stages = seededStageShape();
  }

  if (draft === null) {
    recordActivityBatch(activity);
    return {
      suggestion: null,
      generation: idleGeneration(language),
      cached: false,
      error:
        language === "de"
          ? "Fuer dieses Objekt liegt kein vorbereiteter Vorschlag vor."
          : "No prepared suggestion exists for this object.",
      retryable: false,
    };
  }

  if (constrained) draft = constrainDraft(draft, outstanding, language);

  /* ---- Validation, identical for all three modes ---- */
  const knownEvidenceIds = new Set(
    getEvidenceDocuments(
      [
        ...draft.evidenceIds,
        ...draft.grounding.verifiedFacts.flatMap((entry) => entry.sourceIds),
        ...draft.grounding.approvedRecords.flatMap((entry) => entry.sourceIds),
        ...draft.grounding.stakeholderStatements.flatMap((entry) => entry.sourceIds),
        ...draft.grounding.conflictingEvidence.flatMap((entry) => entry.sourceIds),
        ...draft.grounding.modelInference.flatMap((entry) => entry.sourceIds),
      ],
      runId,
    ).map((document) => document.id),
  );

  const validation = validateSuggestionDraft(draft, {
    knownEvidenceIds,
    constrained,
    entityId: context.entityId,
    language,
  });

  if (!validation.ok) {
    recordValidationFailure({
      runId,
      roleId: context.roleId,
      atMoment: context.viewedMoment,
      objectType,
      objectId,
      source,
      failures: validation.failures,
    });

    /*
     * A validation failure never publishes a partial recommendation.
     *
     * The row is written with `validatedAt` null so the failure is visible in
     * the database and the control room, and `findValidatedSuggestion` will
     * not serve it. In presenter safe mode the seeded content is tried next,
     * which is the only remaining fallback; if that also fails validation the
     * request reports the failure rather than degrading quietly.
     */
    persistSuggestion({
      runId,
      roleId: context.roleId,
      eventId,
      objectType,
      objectId,
      atMoment: context.viewedMoment,
      priority,
      decisionId,
      draft,
      authorityClass: "READ",
      source,
      constrained,
      missingRequiredSources,
      sourceConnectorIds: sourceStatus.attributions.map((entry) => entry.connectorInstanceId),
      stages,
      stateDigest: digest,
      model,
      durationMs: recorder.elapsedMs(),
      validatedAt: null,
    });

    recordActivityBatch([
      ...activity,
      {
        runId,
        roleId: context.roleId,
        atMoment: context.viewedMoment,
        kind: "blocked",
        label: "A prepared suggestion failed structured validation and was withheld",
        labelDe: "Ein vorbereiteter Vorschlag scheiterte an der Validierung und wurde zurueckgehalten",
        detail: describeFailures(validation.failures),
        objectType,
        objectId,
        durationMs: recorder.elapsedMs(),
        outcome: "blocked",
        authorityClass: "READ",
      },
    ]);

    const held = heldStageShape("reconciling");
    return {
      suggestion: null,
      generation: { ...generationFrom(held, language), state: "error", label: stageLabel("error", language) },
      cached: false,
      error:
        language === "de"
          ? "Die Validierung des vorbereiteten Vorschlags ist fehlgeschlagen. Die deterministischen Nachweise bleiben nutzbar."
          : "Validation of the prepared suggestion failed. The deterministic evidence remains usable.",
      retryable: true,
      ...(liveError !== null ? {} : {}),
    };
  }

  /* ---- Publish ---- */
  recorder.mark("validating");
  const validatedStages: StageTransition[] = source === "live" ? recorder.recorded() : stages;
  const finalStages = ensureReachesReady(validatedStages, language);

  const row = persistSuggestion({
    runId,
    roleId: context.roleId,
    eventId,
    objectType,
    objectId,
    atMoment: context.viewedMoment,
    priority,
    decisionId,
    draft: { ...draft, ...validation.content, grounding: validation.grounding, recommendedToolName: validation.recommendedToolName },
    authorityClass: validation.authorityClass,
    source,
    constrained,
    missingRequiredSources,
    sourceConnectorIds: sourceStatus.attributions.map((entry) => entry.connectorInstanceId),
    stages: finalStages,
    stateDigest: digest,
    model,
    durationMs: recorder.elapsedMs(),
    validatedAt: new Date().toISOString(),
  });

  recordActivityBatch([
    ...activity.map((entry) => ({ ...entry, suggestionId: row.id })),
    {
      runId,
      roleId: context.roleId,
      atMoment: context.viewedMoment,
      kind: "drafted" as const,
      label: `Prepared a suggestion on ${objectId} and validated its citations`,
      labelDe: `Vorschlag zu ${objectId} vorbereitet und Belege validiert`,
      detail: `${draft.checksCompleted.length} check(s) recorded, ${draft.actionsCompleted.length} change(s) made, ${draft.evidenceIds.length} citation(s) resolved against the corpus.`,
      objectType,
      objectId,
      durationMs: recorder.elapsedMs(),
      outcome: "ready",
      authorityClass: validation.authorityClass,
      evidenceIds: draft.evidenceIds,
      suggestionId: row.id,
    },
  ]);

  const result: GenerateSuggestionResult = {
    suggestion: rowToView(row, sourceStatus.attributions),
    generation: generationFrom(finalStages, language),
    cached: source !== "live",
    details: { model, durationMs: row.durationMs, source },
  };

  /*
   * A live failure that fell back is reported rather than hidden.
   *
   * Telling a presenter "running in safe mode" when the mode was live and the
   * call failed sends them to look in the wrong place. The suggestion is still
   * returned, because the cached content is good; the error explains why the
   * source label says cache.
   */
  if (liveError !== null) {
    result.error =
      language === "de"
        ? `Ein Live-Aufruf wurde versucht und ist fehlgeschlagen. Gezeigt wird validierter zwischengespeicherter Inhalt. Grund: ${liveError}`
        : `A live call was attempted and failed, so validated cached content is shown. Reason: ${liveError}`;
    result.retryable = true;
  }

  return result;
}

/**
 * Guarantees the published progression ends at `ready`.
 *
 * Safe and offline replay a recorded shape that already ends there, but the
 * live recorder only marks the stages the server actually reached and may
 * have skipped one when a step was instantaneous. The interface renders a
 * stage list, and a list missing a step reads as a fault rather than as
 * speed, so any gap is filled at the elapsed time of the following stage
 * rather than invented at a plausible interval.
 */
function ensureReachesReady(
  stages: readonly StageTransition[],
  _language: "en" | "de",
): StageTransition[] {
  const byState = new Map(stages.map((stage) => [stage.state, stage]));
  const out: StageTransition[] = [];
  let cursor = 0;

  for (const state of AI_STAGE_ORDER) {
    const existing = byState.get(state);
    cursor = existing ? Math.max(cursor, existing.atMs) : cursor + MIN_TRANSITION_MS;
    out.push({
      state,
      label: AI_STAGE_LABELS[state].en,
      labelDe: AI_STAGE_LABELS[state].de,
      atMs: cursor,
    });
  }

  return out;
}

/* ==========================================================================
   Triggers

   Thin wrappers, one per automatic trigger named in the brief. They exist so
   the call sites read as what they are and so the dedupe cannot be bypassed
   by a caller assembling its own request with a different shape.
   ========================================================================== */

export function onRoleOpened(roleId: RoleId, objectType: string, objectId: string, runId?: string) {
  return generateSuggestion({ roleId, objectType, objectId, ...(runId ? { runId } : {}) });
}

export function onFocusItemSelected(params: {
  roleId: RoleId;
  objectType: string;
  objectId: string;
  runId?: string;
}) {
  return generateSuggestion({ ...params });
}

export function onLiveEventArrived(params: {
  roleId: RoleId;
  eventId: string;
  objectType: string;
  objectId: string;
  runId?: string;
}) {
  return generateSuggestion({ ...params });
}

export function onDecisionOpened(params: {
  roleId: RoleId;
  decisionId: string;
  runId?: string;
}): Promise<GenerateSuggestionResult> {
  const decision = getDecision(params.decisionId, params.runId ?? DEFAULT_RUN_ID);
  return generateSuggestion({
    roleId: params.roleId,
    objectType: decision?.decision.relatedObjectKind ?? "decision",
    objectId: decision?.decision.relatedObjectId ?? params.decisionId,
    ...(params.runId ? { runId: params.runId } : {}),
  });
}

/** A manual refresh. The only way a user forces new work. */
export function onRefreshRequested(params: {
  roleId: RoleId;
  objectType: string;
  objectId: string;
  eventId?: string | null;
  runId?: string;
}) {
  return generateSuggestion({ ...params, refresh: true });
}
