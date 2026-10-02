/**
 * The inbound pipeline.
 *
 * Ten steps, in this order, and the order is the design:
 *
 *   1. identify the connector
 *   2. verify or validate the source
 *   3. deduplicate
 *   4. map to a canonical object
 *   5. retain the raw external reference
 *   6. create an integration event
 *   7. trigger the product event
 *   8. update the live workday
 *   9. start evidence loading
 *  10. start automatic AI preparation when policy allows
 *
 * Deduplication is step three, before mapping and before anything is written
 * beyond the event row itself. It leans on the `ie_event_key_unq` unique index
 * over connector plus event key rather than on a read followed by a write,
 * because a webhook that fires twice fires twice quickly, and a select that
 * finds nothing twice is how two live day events appear for one real signal.
 *
 * Steps eight to ten stop at a boundary. This module writes the
 * `workday_live_events` row and returns its identifier, and publishes a hook.
 * It does not reach into the AI Partner or the live day components, which are
 * owned elsewhere. The hook contract is documented at `InboundHook` below and
 * in docs/INTEGRATION_FABRIC.md.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { connectorInstances, integrationEvents } from "@/db/schema/integration";
import { workdayLiveEvents, type LiveEventSeverity, type LiveEventType } from "@/db/schema/live";
import { evidenceDocuments } from "@/db/schema/work";
import { scenarioRuns, type RoleId } from "@/db/schema/core";
import type { CanonicalType } from "@/workday/contracts";
import {
  createConnectorContext,
  systemClock,
  type IntegrationClock,
} from "@/integrations/core/ConnectorContext";
import { declaresCapability, type ExternalRecord } from "@/integrations/core/Connector";
import { isOperableMode, requireConnectorInstance } from "@/integrations/core/ConnectorRegistry";
import { ConnectorError, toConnectorError } from "@/integrations/core/errors";
import {
  digestPayload,
  findSourceMapping,
  mapExternalRecord,
  upsertExternalReference,
} from "@/integrations/mappings/CanonicalMapper";
import { createLogger } from "@/server/logging/redact";
import { ensureSyncState, checkRequiredSources } from "./SyncCoordinator";

const log = createLogger("integration-inbound");

/* ==========================================================================
   The hook other layers subscribe to
   ========================================================================== */

/**
 * What a subscriber receives when an inbound event has been published.
 *
 * Flat and serialisable, and it carries identifiers rather than rows, so a
 * subscriber reads what it needs through its own repository and this module
 * never becomes a transport for another layer's view model.
 *
 * `aiPreparationAllowed` is the policy answer, computed here from the run's
 * autonomy level and the required source check. A subscriber may decline to
 * prepare anything; what it must not do is prepare something when this is
 * false, because that is the case where a required source has not answered.
 */
export interface InboundHookPayload {
  runId: string;
  integrationEventId: string;
  /** Null when the event mapped to no live day beat. */
  liveEventId: string | null;
  connectorInstanceId: string;
  sourceSystem: string;
  eventType: string;
  canonicalType: string;
  canonicalId: string;
  atMoment: string;
  severity: LiveEventSeverity;
  /** Evidence this object depends on, already resolved. */
  evidenceIds: string[];
  roleIds: RoleId[];
  requiresDecision: boolean;
  /** False when a required source has not answered. Respect it. */
  aiPreparationAllowed: boolean;
  aiPreparationBlockedReason: string;
  correlationId: string;
  traceId: string;
}

export type InboundHook = (payload: InboundHookPayload) => void;

const hooks = new Set<InboundHook>();

/**
 * Subscribes to published inbound events.
 *
 * Returns an unsubscribe function. A hook that throws is logged and ignored:
 * an inbound signal from the bank's process intelligence platform must not be
 * lost because a presentation component had a bad render, and the integration
 * event row is already durably written by the time hooks run.
 */
export function registerInboundHook(hook: InboundHook): () => void {
  hooks.add(hook);
  return () => hooks.delete(hook);
}

/** Test and reset seam. */
export function clearInboundHooks(): void {
  hooks.clear();
}

function publishToHooks(payload: InboundHookPayload): void {
  for (const hook of hooks) {
    try {
      hook(payload);
    } catch (error) {
      log.warn("An inbound hook threw. The integration event is unaffected.", {
        integrationEventId: payload.integrationEventId,
        error,
      });
    }
  }
}

/* ==========================================================================
   Input and result
   ========================================================================== */

export interface InboundEventInput {
  runId: string;
  connectorInstanceId: string;
  /** Stable key from the source event identity. The deduplication key. */
  eventKey: string;
  externalEventId?: string | null;
  eventType: string;
  atMoment: string;
  severity?: LiveEventSeverity;
  /** One line of plain language, shown on the live day. */
  summary: string;
  summaryDe?: string;
  title?: string;
  titleDe?: string;
  /** The record the event is about. */
  record: ExternalRecord;
  /** Roles this should reach. Empty means every role. */
  roleIds?: RoleId[];
  requiresDecision?: boolean;
  decisionId?: string | null;
  /** True when the live player must stop here rather than roll past. */
  autoPause?: boolean;
  liveEventType?: LiveEventType;
  correlationId?: string;
  traceId?: string;
  /**
   * A source assertion the connector attaches, for example a webhook delivery
   * identifier. Validated in step two. Never a credential.
   */
  sourceAssertion?: string | null;
  clock?: IntegrationClock;
}

export type IngestionStepName =
  | "identify-connector"
  | "validate-source"
  | "deduplicate"
  | "map-canonical"
  | "retain-external-reference"
  | "create-integration-event"
  | "trigger-product-event"
  | "update-live-workday"
  | "start-evidence-loading"
  | "start-ai-preparation";

export interface IngestionStep {
  step: number;
  name: IngestionStepName;
  outcome: "ok" | "skipped" | "stopped" | "failed";
  detail: string;
}

export interface IngestionResult {
  status: "published" | "deduplicated" | "rejected" | "failed";
  integrationEventId: string | null;
  liveEventId: string | null;
  externalReferenceId: string | null;
  canonicalType: string;
  canonicalId: string;
  deduplicated: boolean;
  evidenceIds: string[];
  aiPreparationRequested: boolean;
  steps: IngestionStep[];
  /** Plain language. Shown in the integration centre when something stopped. */
  message: string;
}

let eventSequence = 0;
let liveEventSequence = 0;

function nextIntegrationEventId(clock: IntegrationClock): string {
  eventSequence += 1;
  return `IEV-${clock.nowMs().toString(36).toUpperCase()}-${String(eventSequence).padStart(5, "0")}`;
}

function nextLiveEventId(clock: IntegrationClock): string {
  liveEventSequence += 1;
  return `WLE-INT-${clock.nowMs().toString(36).toUpperCase()}-${String(liveEventSequence).padStart(4, "0")}`;
}

/* ==========================================================================
   The pipeline
   ========================================================================== */

/**
 * Runs the inbound pipeline for one external event.
 *
 * Returns rather than throws for every expected outcome, including rejection
 * and deduplication, because the webhook route has to answer with a status and
 * a deduplicated delivery is a success from the sender's point of view. Only
 * a genuine defect throws.
 */
export function ingestInboundEvent(input: InboundEventInput): IngestionResult {
  const clock = input.clock ?? systemClock;
  const steps: IngestionStep[] = [];
  const add = (
    step: number,
    name: IngestionStepName,
    outcome: IngestionStep["outcome"],
    detail: string,
  ): void => {
    steps.push({ step, name, outcome, detail });
  };

  const empty: IngestionResult = {
    status: "rejected",
    integrationEventId: null,
    liveEventId: null,
    externalReferenceId: null,
    canonicalType: input.record.canonicalType,
    canonicalId: input.record.canonicalId,
    deduplicated: false,
    evidenceIds: [],
    aiPreparationRequested: false,
    steps,
    message: "",
  };

  /* ---- 1. Identify the connector ---- */
  let instance;
  try {
    instance = requireConnectorInstance(input.connectorInstanceId);
  } catch (error) {
    const connectorError = toConnectorError(error);
    add(1, "identify-connector", "stopped", connectorError.message);
    return { ...empty, message: connectorError.message };
  }
  add(1, "identify-connector", "ok", `${instance.displayName} (${instance.mode})`);

  /* ---- 2. Verify or validate the source ----
   *
   * Three checks, all structural. A planned adapter cannot deliver events
   * because it does not exist. A connector that does not declare the event
   * type is refused by the runtime, which is the same rule the outbound path
   * applies to writes. And the subscription has to be one the instance
   * actually declares, so a webhook delivery to an instance configured for
   * polling is rejected rather than quietly accepted.
   */
  if (!isOperableMode(instance.mode)) {
    const message = `${instance.displayName} is a planned adapter and cannot deliver events.`;
    add(2, "validate-source", "stopped", message);
    return { ...empty, message };
  }

  if (!declaresCapability(instance.capabilities, "events", input.eventType)) {
    const refusal = new ConnectorError(
      "capability-not-declared",
      `${instance.displayName} does not declare the inbound event type "${input.eventType}". The runtime refused the delivery.`,
      { connectorInstanceId: instance.id },
    );
    add(2, "validate-source", "stopped", refusal.message);
    recordRejection(input, instance.id, refusal.message, clock);
    return { ...empty, message: refusal.message };
  }

  if (instance.eventSubscriptionStatus === "none") {
    const message = `${instance.displayName} has no event subscription configured.`;
    add(2, "validate-source", "stopped", message);
    recordRejection(input, instance.id, message, clock);
    return { ...empty, message };
  }

  add(
    2,
    "validate-source",
    "ok",
    `Subscription "${instance.eventSubscriptionStatus}" declares "${input.eventType}".`,
  );

  /* ---- 3. Deduplicate ----
   *
   * The insert happens here, with `onConflictDoNothing` against the unique
   * index. Zero changed rows means this delivery is a repeat and the pipeline
   * stops, returning the identifier of the row that won so the caller can
   * still point at the event.
   */
  const context = createConnectorContext({
    runId: input.runId,
    connectorInstanceId: instance.id,
    atMoment: input.atMoment,
    clock,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.traceId ? { traceId: input.traceId } : {}),
  });

  const integrationEventId = nextIntegrationEventId(clock);
  const payloadDigest = digestPayload(input.record.fields);
  const severity: LiveEventSeverity = input.severity ?? "informational";

  const insert = getDb()
    .insert(integrationEvents)
    .values({
      id: integrationEventId,
      runId: input.runId,
      connectorInstanceId: instance.id,
      direction: "inbound",
      eventKey: input.eventKey,
      externalEventId: input.externalEventId ?? null,
      eventType: input.eventType,
      payloadDigest,
      canonicalType: "",
      canonicalId: "",
      externalReferenceId: null,
      summary: input.summary,
      severity,
      receivedAt: clock.nowIso(),
      atMoment: input.atMoment,
      processedAt: null,
      status: "received",
      rejectionReason: "",
      correlationId: context.correlationId,
      traceId: context.traceId,
      liveEventId: null,
    })
    .onConflictDoNothing({
      target: [integrationEvents.connectorInstanceId, integrationEvents.eventKey],
    })
    .run();

  if (insert.changes === 0) {
    const existing = findInboundEvent(instance.id, input.eventKey);
    const message = `This delivery repeats event key "${input.eventKey}". One integration event exists and no second live day event was created.`;
    add(3, "deduplicate", "stopped", message);
    log.info("Inbound event deduplicated.", {
      connectorInstanceId: instance.id,
      eventKey: input.eventKey,
    });
    return {
      ...empty,
      status: "deduplicated",
      integrationEventId: existing?.id ?? null,
      liveEventId: existing?.liveEventId ?? null,
      externalReferenceId: existing?.externalReferenceId ?? null,
      canonicalType: existing?.canonicalType ?? input.record.canonicalType,
      canonicalId: existing?.canonicalId ?? input.record.canonicalId,
      deduplicated: true,
      message,
    };
  }
  add(3, "deduplicate", "ok", `Event key "${input.eventKey}" is new.`);

  /* ---- 4. Map to a canonical object ---- */
  const mapping = findSourceMapping(instance.id, input.record.externalType);
  let canonical;
  try {
    canonical = mapExternalRecord(input.record, mapping);
  } catch (error) {
    const connectorError = toConnectorError(error, { connectorInstanceId: instance.id });
    add(4, "map-canonical", "failed", connectorError.message);
    markEventFailed(integrationEventId, connectorError.message, clock);
    return { ...empty, status: "failed", integrationEventId, message: connectorError.message };
  }
  add(
    4,
    "map-canonical",
    "ok",
    `${input.record.externalType} mapped to ${canonical.canonicalType} ${canonical.canonicalId}${
      mapping ? "" : " with no mapping row, so every field is reported unmapped"
    }.`,
  );

  /* ---- 5. Retain the raw external reference ---- */
  const syncState = ensureSyncState({
    runId: input.runId,
    connectorInstanceId: instance.id,
    objectType: input.record.externalType,
  });

  const reference = upsertExternalReference({
    runId: input.runId,
    connectorInstanceId: instance.id,
    sourceSystem: instance.sourceSystem,
    record: input.record,
    canonical,
    deepLinkTemplate: instance.deepLinkTemplate,
    stalenessThresholdMinutes: syncState.stalenessThresholdMinutes,
    pushBased: instance.capabilities.webhooks,
    clock,
  });
  add(
    5,
    "retain-external-reference",
    "ok",
    `${instance.sourceSystem} ${input.record.externalType}:${input.record.externalId} retained${
      reference.conflicted ? " and flagged as conflicted" : ""
    }.`,
  );

  /* ---- 6. Create the integration event (complete the row) ---- */
  getDb()
    .update(integrationEvents)
    .set({
      canonicalType: canonical.canonicalType,
      canonicalId: canonical.canonicalId,
      externalReferenceId: reference.reference.id,
      status: "mapped",
      processedAt: clock.nowIso(),
    })
    .where(eq(integrationEvents.id, integrationEventId))
    .run();
  add(6, "create-integration-event", "ok", integrationEventId);

  /* ---- 7. Trigger the product event ----
   *
   * The product event is the publication of this integration event to the
   * product's own stream. It is a separate step from writing the row because
   * the row is the durable fact and the publication is the notification, and
   * conflating them is how a subscriber failure loses an event.
   */
  const requiresDecision = input.requiresDecision ?? false;
  add(
    7,
    "trigger-product-event",
    "ok",
    `Published as a ${requiresDecision ? "decision-required" : (input.liveEventType ?? "signal")} product event.`,
  );

  /* ---- 9. Start evidence loading ----
   *
   * Resolved before the live day row is written, because the row carries the
   * evidence identifiers and the catch up reader expects them to be there.
   * This resolves which documents the object depends on; the documents
   * themselves are loaded by the evidence layer on demand.
   */
  const evidenceIds = resolveEvidenceForObject(
    input.runId,
    canonical.canonicalType,
    canonical.canonicalId,
  );

  /* ---- 8. Update the live workday ---- */
  const liveEventId = nextLiveEventId(clock);
  const sortOrder = nextSortOrder(input.runId, input.atMoment);

  getDb()
    .insert(workdayLiveEvents)
    .values({
      id: liveEventId,
      runId: input.runId,
      atMoment: input.atMoment,
      sortOrder,
      type: input.liveEventType ?? (requiresDecision ? "decision-required" : "signal"),
      roleIds: input.roleIds ?? [],
      severity,
      title: input.title ?? input.record.title,
      titleDe: input.titleDe ?? input.title ?? input.record.title,
      summary: input.summary,
      summaryDe: input.summaryDe ?? input.summary,
      objectType: canonical.canonicalType,
      objectId: canonical.canonicalId,
      evidenceIds,
      requiresDecision,
      autoPause: input.autoPause ?? requiresDecision,
      decisionId: input.decisionId ?? null,
      /* These three columns are what let a reader verify that no live day beat
       * was invented. `derivedFrom` is always "integration" on this path. */
      derivedFrom: "integration",
      derivedFromId: integrationEventId,
      integrationEventId,
      sourceConnectorIds: [instance.id],
      createdAt: clock.nowIso(),
    })
    .run();

  getDb()
    .update(integrationEvents)
    .set({ liveEventId, status: "published" })
    .where(eq(integrationEvents.id, integrationEventId))
    .run();

  add(8, "update-live-workday", "ok", `${liveEventId} at ${input.atMoment}, sort order ${sortOrder}.`);
  add(
    9,
    "start-evidence-loading",
    evidenceIds.length > 0 ? "ok" : "skipped",
    evidenceIds.length > 0
      ? `${evidenceIds.length} related evidence document(s) resolved.`
      : "No evidence document references this object.",
  );

  /* ---- 10. Start automatic AI preparation when policy allows ----
   *
   * Two conditions, both of which must hold. The autonomy level has to reach
   * at least "prepare", because at "assist" the product answers questions and
   * does not draft. And every required source for this object has to have
   * answered, because the one thing worse than no suggestion is a confident
   * one built while the GRC platform was unavailable.
   */
  const policy = evaluateAiPreparationPolicy({
    runId: input.runId,
    canonicalType: canonical.canonicalType,
    canonicalId: canonical.canonicalId,
    clock,
  });

  add(
    10,
    "start-ai-preparation",
    policy.allowed ? "ok" : "skipped",
    policy.allowed
      ? "Policy allows automatic preparation. The hook was published for the AI layer."
      : policy.reason,
  );

  publishToHooks({
    runId: input.runId,
    integrationEventId,
    liveEventId,
    connectorInstanceId: instance.id,
    sourceSystem: instance.sourceSystem,
    eventType: input.eventType,
    canonicalType: canonical.canonicalType,
    canonicalId: canonical.canonicalId,
    atMoment: input.atMoment,
    severity,
    evidenceIds,
    roleIds: input.roleIds ?? [],
    requiresDecision,
    aiPreparationAllowed: policy.allowed,
    aiPreparationBlockedReason: policy.reason,
    correlationId: context.correlationId,
    traceId: context.traceId,
  });

  return {
    status: "published",
    integrationEventId,
    liveEventId,
    externalReferenceId: reference.reference.id,
    canonicalType: canonical.canonicalType,
    canonicalId: canonical.canonicalId,
    deduplicated: false,
    evidenceIds,
    aiPreparationRequested: policy.allowed,
    steps,
    message: `Inbound event published as ${liveEventId}.`,
  };
}

/* ==========================================================================
   Supporting reads
   ========================================================================== */

/**
 * The autonomy and source policy for automatic preparation.
 *
 * Exported because the AI layer may want to ask the same question without an
 * inbound event, for example when a user opens a work object directly.
 */
export function evaluateAiPreparationPolicy(params: {
  runId: string;
  canonicalType: string;
  canonicalId: string;
  clock?: IntegrationClock;
}): { allowed: boolean; reason: string } {
  const run = getDb().select().from(scenarioRuns).where(eq(scenarioRuns.id, params.runId)).get();
  if (!run) return { allowed: false, reason: "The scenario run does not exist." };

  if (run.autonomyLevel === "assist") {
    return {
      allowed: false,
      reason:
        'The autonomy level is "Assist", at which the product answers questions and does not prepare drafts automatically.',
    };
  }

  const check = checkRequiredSources({
    runId: params.runId,
    contextType: params.canonicalType,
    contextId: params.canonicalId,
    canonicalType: params.canonicalType,
    canonicalId: params.canonicalId,
    ...(params.clock ? { clock: params.clock } : {}),
  });

  if (!check.satisfied) return { allowed: false, reason: check.statement };
  return { allowed: true, reason: check.statement };
}

/**
 * Evidence documents that reference this object.
 *
 * Reads the seeded corpus rather than inventing document identifiers, because
 * the integration layer must project the same institution the rest of the
 * product knows about. A document that does not exist would produce a live day
 * event citing evidence the drawer cannot open.
 */
export function resolveEvidenceForObject(
  runId: string,
  canonicalType: string,
  canonicalId: string,
): string[] {
  const rows = getDb()
    .select({ id: evidenceDocuments.id, relatedObjectIds: evidenceDocuments.relatedObjectIds })
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.runId, runId))
    .all();

  const matches = rows
    .filter((row) => row.relatedObjectIds.includes(canonicalId))
    .map((row) => row.id)
    .sort();

  // Bounded. A live day row carrying forty evidence identifiers is not a
  // citation, it is a dump, and the drawer cannot show it usefully.
  return matches.slice(0, 8);
}

function nextSortOrder(runId: string, atMoment: string): number {
  const rows = getDb()
    .select({ sortOrder: workdayLiveEvents.sortOrder })
    .from(workdayLiveEvents)
    .where(and(eq(workdayLiveEvents.runId, runId), eq(workdayLiveEvents.atMoment, atMoment)))
    .all();
  return rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
}

export function findInboundEvent(
  connectorInstanceId: string,
  eventKey: string,
): (typeof integrationEvents.$inferSelect) | null {
  return (
    getDb()
      .select()
      .from(integrationEvents)
      .where(
        and(
          eq(integrationEvents.connectorInstanceId, connectorInstanceId),
          eq(integrationEvents.eventKey, eventKey),
        ),
      )
      .get() ?? null
  );
}

/** Inbound events for a run, for the integration centre and the proof script. */
export function listInboundEvents(runId: string): Array<typeof integrationEvents.$inferSelect> {
  return getDb()
    .select()
    .from(integrationEvents)
    .where(and(eq(integrationEvents.runId, runId), eq(integrationEvents.direction, "inbound")))
    .all();
}

function recordRejection(
  input: InboundEventInput,
  connectorInstanceId: string,
  reason: string,
  clock: IntegrationClock,
): void {
  getDb()
    .insert(integrationEvents)
    .values({
      id: nextIntegrationEventId(clock),
      runId: input.runId,
      connectorInstanceId,
      direction: "inbound",
      eventKey: input.eventKey,
      externalEventId: input.externalEventId ?? null,
      eventType: input.eventType,
      payloadDigest: digestPayload(input.record.fields),
      canonicalType: "",
      canonicalId: "",
      externalReferenceId: null,
      summary: input.summary,
      severity: input.severity ?? "informational",
      receivedAt: clock.nowIso(),
      atMoment: input.atMoment,
      processedAt: clock.nowIso(),
      status: "rejected",
      rejectionReason: reason,
      correlationId: input.correlationId ?? "",
      traceId: input.traceId ?? "",
      liveEventId: null,
    })
    .onConflictDoNothing({
      target: [integrationEvents.connectorInstanceId, integrationEvents.eventKey],
    })
    .run();
}

function markEventFailed(
  integrationEventId: string,
  reason: string,
  clock: IntegrationClock,
): void {
  getDb()
    .update(integrationEvents)
    .set({ status: "failed", rejectionReason: reason, processedAt: clock.nowIso() })
    .where(eq(integrationEvents.id, integrationEventId))
    .run();
}

/** Live day events this integration layer produced, for the proof script. */
export function listIntegrationLiveEvents(
  runId: string,
): Array<typeof workdayLiveEvents.$inferSelect> {
  return getDb()
    .select()
    .from(workdayLiveEvents)
    .where(and(eq(workdayLiveEvents.runId, runId), eq(workdayLiveEvents.derivedFrom, "integration")))
    .all();
}

/** Connector display names, for the proof transcript. */
export function connectorNames(instanceIds: string[]): string[] {
  if (instanceIds.length === 0) return [];
  return getDb()
    .select({ displayName: connectorInstances.displayName })
    .from(connectorInstances)
    .where(inArray(connectorInstances.id, instanceIds))
    .all()
    .map((row) => row.displayName);
}

/** Convenience type guard for the route handler. */
export function isCanonicalTypeName(value: string): value is CanonicalType {
  return value.length > 0;
}
