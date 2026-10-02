/**
 * Sync, freshness and source attribution.
 *
 * Three jobs that belong together because they all read `connector_sync_state`.
 *
 * The first is running a delta sync: ask a connector for everything that
 * changed since the stored cursor, map it, keep the external identity and
 * record what was seen, changed and conflicted.
 *
 * The second is answering "where did this come from and how fresh is it",
 * which is the quiet source row the workday renders under every work object.
 *
 * The third is answering "are all required sources available", which the AI
 * generation layer calls before it publishes a final recommendation. That one
 * is the most consequential function in this file. A confident recommendation
 * built while the supplier evidence was still loading is worse than no
 * recommendation, because the user cannot see the gap and the confidence
 * number does not know about it.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  connectorInstances,
  connectorSyncState,
  externalReferences,
  sourceRequirements,
} from "@/db/schema/integration";
import { decisions } from "@/db/schema/decisions";
import type { DataLoadState, SourceAttribution } from "@/workday/contracts";
import { systemClock, type IntegrationClock } from "@/integrations/core/ConnectorContext";
import { createConnectorContext } from "@/integrations/core/ConnectorContext";
import {
  isOperableMode,
  requireConnectorInstance,
  resolveConnector,
  listConnectorInstances,
} from "@/integrations/core/ConnectorRegistry";
import { declaresCapability } from "@/integrations/core/Connector";
import { capabilityRefusal, toConnectorError } from "@/integrations/core/errors";
import {
  buildDeepLink,
  computeFreshness,
  findSourceMapping,
  mapExternalRecord,
  upsertExternalReference,
} from "@/integrations/mappings/CanonicalMapper";
import { runAttempt, SYNC_RETRY_POLICY } from "./RetryPolicy";

export type SyncStateRow = typeof connectorSyncState.$inferSelect;

/* ==========================================================================
   Sync state
   ========================================================================== */

let syncStateSequence = 0;

/** The sync state row for one connector and object type, creating it if absent. */
export function ensureSyncState(params: {
  runId: string;
  connectorInstanceId: string;
  objectType: string;
  stalenessThresholdMinutes?: number;
}): SyncStateRow {
  const existing = getDb()
    .select()
    .from(connectorSyncState)
    .where(
      and(
        eq(connectorSyncState.connectorInstanceId, params.connectorInstanceId),
        eq(connectorSyncState.objectType, params.objectType),
      ),
    )
    .get();
  if (existing) return existing;

  syncStateSequence += 1;
  const id = `CSS-${params.connectorInstanceId}-${params.objectType}-${syncStateSequence}`;

  getDb()
    .insert(connectorSyncState)
    .values({
      id,
      runId: params.runId,
      connectorInstanceId: params.connectorInstanceId,
      objectType: params.objectType,
      lastCursor: null,
      lastSyncAt: null,
      lastSyncStatus: "never-run",
      recordsSeen: 0,
      recordsChanged: 0,
      recordsConflicted: 0,
      stalenessThresholdMinutes: params.stalenessThresholdMinutes ?? 120,
    })
    .onConflictDoNothing({
      target: [connectorSyncState.connectorInstanceId, connectorSyncState.objectType],
    })
    .run();

  const row = getDb()
    .select()
    .from(connectorSyncState)
    .where(
      and(
        eq(connectorSyncState.connectorInstanceId, params.connectorInstanceId),
        eq(connectorSyncState.objectType, params.objectType),
      ),
    )
    .get();
  if (!row) {
    throw new Error(
      `The sync state for ${params.connectorInstanceId}:${params.objectType} could not be read back.`,
    );
  }
  return row;
}

export function listSyncState(runId: string): SyncStateRow[] {
  return getDb()
    .select()
    .from(connectorSyncState)
    .where(eq(connectorSyncState.runId, runId))
    .orderBy(asc(connectorSyncState.connectorInstanceId), asc(connectorSyncState.objectType))
    .all();
}

export function syncStateForConnector(runId: string, connectorInstanceId: string): SyncStateRow[] {
  return getDb()
    .select()
    .from(connectorSyncState)
    .where(
      and(
        eq(connectorSyncState.runId, runId),
        eq(connectorSyncState.connectorInstanceId, connectorInstanceId),
      ),
    )
    .orderBy(asc(connectorSyncState.objectType))
    .all();
}

/* ==========================================================================
   Running a sync
   ========================================================================== */

export interface SyncOutcome {
  connectorInstanceId: string;
  objectType: string;
  status: "ok" | "refused" | "failed";
  recordsSeen: number;
  recordsMapped: number;
  recordsChanged: number;
  recordsConflicted: number;
  cursor: string | null;
  hasMore: boolean;
  durationMs: number;
  /** Set when the sync did not complete. Plain language, no payload content. */
  error: string;
}

/**
 * Runs one delta sync.
 *
 * The capability check happens here, in the runtime, before the connector is
 * touched. A connector that does not declare `deltaSync` plus the object type
 * is refused with `capability-not-declared`, and the refusal is recorded as
 * the sync status so the integration centre shows why nothing arrived.
 */
export async function runSync(params: {
  runId: string;
  connectorInstanceId: string;
  objectType: string;
  limit?: number;
  clock?: IntegrationClock;
  atMoment?: string;
  signal?: AbortSignal;
}): Promise<SyncOutcome> {
  const clock = params.clock ?? systemClock;
  const instance = requireConnectorInstance(params.connectorInstanceId);
  const state = ensureSyncState({
    runId: params.runId,
    connectorInstanceId: params.connectorInstanceId,
    objectType: params.objectType,
  });

  const base: SyncOutcome = {
    connectorInstanceId: instance.id,
    objectType: params.objectType,
    status: "refused",
    recordsSeen: 0,
    recordsMapped: 0,
    recordsChanged: 0,
    recordsConflicted: 0,
    cursor: state.lastCursor,
    hasMore: false,
    durationMs: 0,
    error: "",
  };

  if (!isOperableMode(instance.mode)) {
    const error = `${instance.displayName} is a planned adapter. There is nothing to sync.`;
    recordSyncResult(instance.id, params.objectType, { status: "not-implemented", clock });
    return { ...base, error };
  }

  if (!declaresCapability(instance.capabilities, "sync", params.objectType)) {
    const refusal = capabilityRefusal({
      connectorInstanceId: instance.id,
      operation: "sync",
      objectType: params.objectType,
    });
    recordSyncResult(instance.id, params.objectType, { status: "refused", clock });
    return { ...base, error: refusal.message };
  }

  const context = createConnectorContext({
    runId: params.runId,
    connectorInstanceId: instance.id,
    atMoment: params.atMoment ?? "00:00",
    clock,
    ...(params.signal ? { signal: params.signal } : {}),
  });

  const { connector } = resolveConnector(instance.id);
  const startedMs = clock.nowMs();

  try {
    const result = await runAttempt(
      (signal) =>
        connector.sync(
          { objectType: params.objectType, cursor: state.lastCursor, limit: params.limit ?? 200 },
          { ...context, signal },
        ),
      SYNC_RETRY_POLICY,
      { connectorInstanceId: instance.id },
    );

    let changed = 0;
    let conflicted = 0;
    let mapped = 0;

    for (const record of result.records) {
      const mapping = findSourceMapping(instance.id, record.externalType);
      const canonical = mapExternalRecord(record, mapping);
      const upsert = upsertExternalReference({
        runId: params.runId,
        connectorInstanceId: instance.id,
        sourceSystem: instance.sourceSystem,
        record,
        canonical,
        deepLinkTemplate: instance.deepLinkTemplate,
        stalenessThresholdMinutes: state.stalenessThresholdMinutes,
        pushBased: instance.capabilities.webhooks,
        clock,
      });
      mapped += 1;
      if (upsert.changed) changed += 1;
      if (upsert.conflicted) conflicted += 1;
    }

    recordSyncResult(instance.id, params.objectType, {
      status: "ok",
      cursor: result.cursor,
      recordsSeen: result.recordsSeen,
      recordsChanged: changed,
      recordsConflicted: conflicted,
      clock,
    });

    return {
      ...base,
      status: "ok",
      recordsSeen: result.recordsSeen,
      recordsMapped: mapped,
      recordsChanged: changed,
      recordsConflicted: conflicted,
      cursor: result.cursor,
      hasMore: result.hasMore,
      durationMs: clock.nowMs() - startedMs,
    };
  } catch (error) {
    const connectorError = toConnectorError(error, { connectorInstanceId: instance.id });
    recordSyncResult(instance.id, params.objectType, {
      status: connectorError.code,
      clock,
    });
    return {
      ...base,
      status: "failed",
      durationMs: clock.nowMs() - startedMs,
      error: connectorError.message,
    };
  }
}

/** Updates the sync state row and the instance summary columns together. */
function recordSyncResult(
  connectorInstanceId: string,
  objectType: string,
  params: {
    status: string;
    cursor?: string | null;
    recordsSeen?: number;
    recordsChanged?: number;
    recordsConflicted?: number;
    clock: IntegrationClock;
  },
): void {
  const now = params.clock.nowIso();
  const succeeded = params.status === "ok";

  getDb()
    .update(connectorSyncState)
    .set({
      /*
       * `lastSyncAt` advances only on success. A failed attempt that moved it
       * forward would make stale data look fresh, which is the single most
       * misleading thing this table could do.
       */
      ...(succeeded ? { lastSyncAt: now } : {}),
      ...(params.cursor !== undefined && succeeded ? { lastCursor: params.cursor } : {}),
      lastSyncStatus: params.status,
      ...(params.recordsSeen !== undefined ? { recordsSeen: params.recordsSeen } : {}),
      ...(params.recordsChanged !== undefined ? { recordsChanged: params.recordsChanged } : {}),
      ...(params.recordsConflicted !== undefined
        ? { recordsConflicted: params.recordsConflicted }
        : {}),
    })
    .where(
      and(
        eq(connectorSyncState.connectorInstanceId, connectorInstanceId),
        eq(connectorSyncState.objectType, objectType),
      ),
    )
    .run();

  getDb()
    .update(connectorInstances)
    .set({
      ...(succeeded ? { lastSyncAt: now } : {}),
      lastSyncStatus: params.status,
    })
    .where(eq(connectorInstances.id, connectorInstanceId))
    .run();
}

/**
 * Syncs every object type every operable connector declares.
 *
 * Sequential rather than concurrent. The targets here are simulators reading
 * the same SQLite file, and concurrency would buy nothing while making the
 * transcript in the proof script non deterministic.
 */
export async function runAllSyncs(params: {
  runId: string;
  clock?: IntegrationClock;
  atMoment?: string;
}): Promise<SyncOutcome[]> {
  const outcomes: SyncOutcome[] = [];
  for (const instance of listConnectorInstances({ operableOnly: true })) {
    if (!instance.capabilities.deltaSync) continue;
    for (const objectType of instance.capabilities.read) {
      outcomes.push(
        await runSync({
          runId: params.runId,
          connectorInstanceId: instance.id,
          objectType,
          ...(params.clock ? { clock: params.clock } : {}),
          ...(params.atMoment ? { atMoment: params.atMoment } : {}),
        }),
      );
    }
  }
  return outcomes;
}

/* ==========================================================================
   Source attribution
   ========================================================================== */

/** Maps a connector and sync state onto the load state the interface shows. */
function loadStateFor(params: {
  mode: string;
  healthState: string;
  lastSyncStatus: string;
  freshness: string;
  recordCount: number;
}): DataLoadState {
  if (params.mode === "planned") return "idle";
  if (params.healthState === "unavailable" || params.healthState === "unconfigured") return "error";
  if (params.lastSyncStatus === "never-run") return "idle";
  if (params.lastSyncStatus !== "ok") return "error";
  if (params.freshness === "stale") return "stale";
  if (params.recordCount === 0) return "partial";
  return "ready";
}

export interface SourceAttributionQuery {
  runId: string;
  canonicalType: string;
  canonicalId: string;
  /** When given, necessity is read from `source_requirements` for this context. */
  contextType?: string;
  contextId?: string;
  clock?: IntegrationClock;
}

/**
 * The sources behind one canonical object.
 *
 * This is the function the workday calls to render the quiet source row. It
 * returns the shape in `src/workday/contracts.ts` and nothing else: no
 * endpoint, no credential state, no payload. There is nothing in the returned
 * object that could leak one, which is the reason the view model is defined
 * where it is rather than being the database row.
 *
 * Freshness is computed from `connector_sync_state.staleness_threshold_minutes`
 * per connector and object type, because two sources do not age at the same
 * rate: a GRC assessment four hours old is fine and a payment volume reading
 * four hours old is not.
 */
export function getSourceAttribution(query: SourceAttributionQuery): SourceAttribution[] {
  const clock = query.clock ?? systemClock;

  const references = getDb()
    .select()
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.runId, query.runId),
        eq(externalReferences.canonicalType, query.canonicalType),
        eq(externalReferences.canonicalId, query.canonicalId),
      ),
    )
    .all();

  const requirements =
    query.contextType && query.contextId
      ? getDb()
          .select()
          .from(sourceRequirements)
          .where(
            and(
              eq(sourceRequirements.runId, query.runId),
              eq(sourceRequirements.contextType, query.contextType),
              eq(sourceRequirements.contextId, query.contextId),
            ),
          )
          .all()
      : [];

  /*
   * Requirements are keyed by connector and object type, and a requirement may
   * name a connector that has not produced a reference yet. Both directions
   * matter: a required source with no data is exactly the case the AI layer
   * must not publish through, so the union is built from both lists rather
   * than from the references alone.
   */
  const instanceIds = new Set<string>([
    ...references.map((reference) => reference.connectorInstanceId),
    ...requirements.map((requirement) => requirement.connectorInstanceId),
  ]);

  const attributions: SourceAttribution[] = [];

  for (const instanceId of instanceIds) {
    const instance = getDb()
      .select()
      .from(connectorInstances)
      .where(eq(connectorInstances.id, instanceId))
      .get();
    if (!instance) continue;

    const own = references.filter((reference) => reference.connectorInstanceId === instanceId);
    const requirement = requirements.find(
      (entry) => entry.connectorInstanceId === instanceId,
    );

    const states = syncStateForConnector(query.runId, instanceId);
    const relevant =
      states.find((state) => own.some((reference) => reference.externalType === state.objectType)) ??
      states.find((state) => state.objectType === requirement?.objectType) ??
      states[0] ??
      null;

    const threshold = relevant?.stalenessThresholdMinutes ?? 120;
    const lastSyncAt =
      own.reduce<string | null>(
        (latest, reference) =>
          latest === null || reference.syncedAt > latest ? reference.syncedAt : latest,
        null,
      ) ?? relevant?.lastSyncAt ?? instance.lastSyncAt;

    const freshness =
      instance.mode === "planned"
        ? "unknown"
        : computeFreshness({
            lastSyncAt,
            stalenessThresholdMinutes: threshold,
            pushBased: instance.capabilities.webhooks,
            clock,
          });

    const deepLinkSource = own[0];
    const deepLink =
      instance.capabilities.deepLinks && deepLinkSource
        ? (deepLinkSource.externalUrl ??
          buildDeepLink(instance.deepLinkTemplate, deepLinkSource.externalId))
        : null;

    attributions.push({
      connectorInstanceId: instance.id,
      sourceSystem: instance.sourceSystem,
      mode: instance.mode,
      freshness,
      lastUpdated: lastSyncAt,
      recordCount: own.length,
      conflicted: own.some((reference) => reference.conflicted),
      necessity: requirement?.necessity ?? "helpful",
      deepLink,
      loadState: loadStateFor({
        mode: instance.mode,
        healthState: instance.healthState,
        lastSyncStatus: relevant?.lastSyncStatus ?? instance.lastSyncStatus ?? "never-run",
        freshness,
        recordCount: own.length,
      }),
    });
  }

  /* Required sources first, then conflicted, then by name. A user scanning the
   * row should meet the thing that could invalidate the work first. */
  const necessityRank = { required: 0, helpful: 1, optional: 2 } as const;
  return attributions.sort(
    (a, b) =>
      necessityRank[a.necessity] - necessityRank[b.necessity] ||
      Number(b.conflicted) - Number(a.conflicted) ||
      a.sourceSystem.localeCompare(b.sourceSystem),
  );
}

/**
 * The sources behind a decision.
 *
 * Resolves the decision's related object and then attributes that, with the
 * decision itself as the requirement context. A decision with no related
 * object still returns its declared requirements, which is what lets the
 * interface say "the GRC platform is required for this decision and has not
 * answered" before any data has arrived at all.
 */
export function getDecisionSourceAttribution(
  runId: string,
  decisionId: string,
  clock: IntegrationClock = systemClock,
): SourceAttribution[] {
  const decision = getDb()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.id, decisionId)))
    .get();

  return getSourceAttribution({
    runId,
    canonicalType: canonicalTypeForObjectKind(decision?.relatedObjectKind ?? ""),
    canonicalId: decision?.relatedObjectId ?? decisionId,
    contextType: "decision",
    contextId: decisionId,
    clock,
  });
}

/**
 * Translates the scenario's object kind vocabulary into a canonical type.
 *
 * The decision rows use the practitioner's words, "control", "supplier",
 * "test-case". The canonical types are the integration vocabulary. Mapping
 * here rather than changing either one keeps the two vocabularies independent,
 * which matters because the first is domain language shown to users and the
 * second is a wire format.
 */
export function canonicalTypeForObjectKind(objectKind: string): string {
  switch (objectKind) {
    case "control":
      return "Control";
    case "risk":
      return "Risk";
    case "supplier":
      return "Supplier";
    case "service":
      return "Service";
    case "process":
      return "Process";
    case "assessment":
      return "Assessment";
    case "test-case":
    case "control-test":
      return "Test";
    case "incident":
      return "Incident";
    case "obligation":
      return "Obligation";
    case "evidence":
    case "evidence-document":
      return "Evidence";
    case "action":
      return "Action";
    case "decision":
      return "Decision";
    default:
      return "ExternalRecord";
  }
}

/* ==========================================================================
   Required source availability
   ========================================================================== */

export interface MissingSource {
  connectorInstanceId: string;
  sourceSystem: string;
  objectType: string;
  mode: string;
  /** One clause the suggestion card can show verbatim. */
  reason: string;
}

export interface RequiredSourceCheck {
  /** True when every required source has usable, fresh data. */
  satisfied: boolean;
  missing: MissingSource[];
  /** Sources present but stale. The output is constrained, not blocked. */
  stale: MissingSource[];
  attributions: SourceAttribution[];
  /** The sentence the suggestion card shows when `satisfied` is false. */
  statement: string;
}

/**
 * Answers "are all required sources available for this context".
 *
 * The AI generation layer calls this before publishing a final recommendation.
 * It returns the missing sources by name so the card can say which one is
 * absent rather than offering a generic apology, and it keeps `stale` separate
 * from `missing` because those warrant different copy: a stale source
 * constrains a recommendation, an absent required source prevents one.
 */
export function checkRequiredSources(params: {
  runId: string;
  contextType: string;
  contextId: string;
  canonicalType?: string;
  canonicalId?: string;
  clock?: IntegrationClock;
}): RequiredSourceCheck {
  const clock = params.clock ?? systemClock;

  const requirements = getDb()
    .select()
    .from(sourceRequirements)
    .where(
      and(
        eq(sourceRequirements.runId, params.runId),
        eq(sourceRequirements.contextType, params.contextType),
        eq(sourceRequirements.contextId, params.contextId),
      ),
    )
    .all();

  const attributions =
    params.canonicalType && params.canonicalId
      ? getSourceAttribution({
          runId: params.runId,
          canonicalType: params.canonicalType,
          canonicalId: params.canonicalId,
          contextType: params.contextType,
          contextId: params.contextId,
          clock,
        })
      : [];

  const missing: MissingSource[] = [];
  const stale: MissingSource[] = [];

  for (const requirement of requirements) {
    if (requirement.necessity !== "required") continue;

    const instance = getDb()
      .select()
      .from(connectorInstances)
      .where(eq(connectorInstances.id, requirement.connectorInstanceId))
      .get();
    if (!instance) {
      missing.push({
        connectorInstanceId: requirement.connectorInstanceId,
        sourceSystem: requirement.connectorInstanceId,
        objectType: requirement.objectType,
        mode: "planned",
        reason: "The required connector instance is not configured.",
      });
      continue;
    }

    const entry: MissingSource = {
      connectorInstanceId: instance.id,
      sourceSystem: instance.sourceSystem,
      objectType: requirement.objectType,
      mode: instance.mode,
      reason: "",
    };

    if (instance.mode === "planned") {
      missing.push({ ...entry, reason: `${instance.sourceSystem} is a planned adapter and has no data.` });
      continue;
    }

    if (instance.healthState === "unavailable") {
      missing.push({ ...entry, reason: `${instance.sourceSystem} is unavailable.` });
      continue;
    }

    if (instance.healthState === "unconfigured") {
      missing.push({ ...entry, reason: `${instance.sourceSystem} is not configured.` });
      continue;
    }

    const state = getDb()
      .select()
      .from(connectorSyncState)
      .where(
        and(
          eq(connectorSyncState.connectorInstanceId, instance.id),
          eq(connectorSyncState.objectType, requirement.objectType),
        ),
      )
      .get();

    if (!state || state.lastSyncAt === null) {
      missing.push({
        ...entry,
        reason: `${instance.sourceSystem} has not yet returned ${requirement.objectType} data.`,
      });
      continue;
    }

    const freshness = computeFreshness({
      lastSyncAt: state.lastSyncAt,
      stalenessThresholdMinutes: state.stalenessThresholdMinutes,
      pushBased: instance.capabilities.webhooks,
      clock,
    });

    if (freshness === "stale" || freshness === "unknown") {
      stale.push({
        ...entry,
        reason: `${instance.sourceSystem} last answered more than ${state.stalenessThresholdMinutes} minutes ago.`,
      });
    }
  }

  const satisfied = missing.length === 0;
  const statement = satisfied
    ? stale.length === 0
      ? "Every required source answered and is current."
      : `Every required source answered, but ${stale.length} is not current. The recommendation is constrained.`
    : `A final recommendation is withheld because ${missing.length} required source(s) did not answer: ${missing
        .map((entry) => entry.sourceSystem)
        .join(", ")}.`;

  return { satisfied, missing, stale, attributions, statement };
}

/** Every requirement for a context, for the integration centre. */
export function listSourceRequirements(
  runId: string,
  contextType?: string,
  contextId?: string,
): Array<typeof sourceRequirements.$inferSelect> {
  if (contextType && contextId) {
    return getDb()
      .select()
      .from(sourceRequirements)
      .where(
        and(
          eq(sourceRequirements.runId, runId),
          eq(sourceRequirements.contextType, contextType),
          eq(sourceRequirements.contextId, contextId),
        ),
      )
      .all();
  }
  return getDb()
    .select()
    .from(sourceRequirements)
    .where(eq(sourceRequirements.runId, runId))
    .all();
}
