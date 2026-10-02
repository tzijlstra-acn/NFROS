/**
 * The integration runtime.
 *
 * The one module the rest of the application imports. Everything behind it,
 * the registry, the two pipelines, the retry policy, the mapper, the receipt
 * writer, is reachable only through this surface, which keeps three
 * invariants in one place rather than in every caller.
 *
 * The first and most important: a connector that does not declare a
 * capability is refused that operation here, before the connector is called.
 * `assertCapability` is the only gate and it is a runtime gate, not a
 * convention each adapter is trusted to honour. A new connector written next
 * year cannot grant itself a write by forgetting to refuse one.
 *
 * The second: importing this module registers the connectors. A caller that
 * resolved an instance without the registry being populated would get
 * `connector-not-registered` for a connector that exists, which is a confusing
 * failure to debug and an avoidable one.
 *
 * The third: authority. There is no function here that writes to an external
 * system without going through `dispatchCommand`, and `dispatchCommand` calls
 * `evaluateAuthority`. There is no integration specific authority path.
 */

import type { SourceAttribution } from "@/workday/contracts";
import {
  createConnectorContext,
  systemClock,
  type IntegrationClock,
} from "@/integrations/core/ConnectorContext";
import {
  declaresCapability,
  type ConnectorHealth,
  type ConnectorInstanceView,
  type ConnectorOperation,
  type ConnectorSearchResult,
  type ExternalRecord,
} from "@/integrations/core/Connector";
import {
  getConnectorInstance,
  listConnectorInstances,
  requireConnectorInstance,
  resolveConnector,
  registeredConnectorKeys,
  isOperableMode,
  MODE_ORDER,
  type ConnectorInstanceFilter,
} from "@/integrations/core/ConnectorRegistry";
import { capabilityRefusal, ConnectorError, toConnectorError } from "@/integrations/core/errors";
import { registerConnectorsOnce } from "@/integrations/connectors/simulated";
import { DEFAULT_RETRY_POLICY, runAttempt } from "./RetryPolicy";
import {
  canonicalTypeForObjectKind as toCanonicalType,
  getSourceAttribution as attribute,
} from "./SyncCoordinator";

/* The side effect that makes every other function in this module work. */
registerConnectorsOnce();

/* ==========================================================================
   The capability gate
   ========================================================================== */

/**
 * Refuses an operation the connector never declared.
 *
 * Exported so the tests can assert the refusal directly, and so a caller that
 * wants to check before it asks can use the same function the runtime uses
 * rather than reimplementing the lookup.
 */
export function assertCapability(
  instance: ConnectorInstanceView,
  operation: ConnectorOperation,
  objectType: string,
): void {
  if (!isOperableMode(instance.mode)) {
    throw new ConnectorError(
      "connector-not-implemented",
      `${instance.displayName} is a planned adapter. It declares no capabilities and cannot ${operation} "${objectType}".`,
      { connectorInstanceId: instance.id, detail: `planned adapter refused ${operation}` },
    );
  }
  if (!declaresCapability(instance.capabilities, operation, objectType)) {
    throw capabilityRefusal({
      connectorInstanceId: instance.id,
      operation,
      objectType,
    });
  }
}

/** True when the operation would be permitted. Drives the interface. */
export function canPerform(
  connectorInstanceId: string,
  operation: ConnectorOperation,
  objectType: string,
): boolean {
  const instance = getConnectorInstance(connectorInstanceId);
  if (!instance) return false;
  if (!isOperableMode(instance.mode)) return false;
  return declaresCapability(instance.capabilities, operation, objectType);
}

/* ==========================================================================
   Connector inventory and health
   ========================================================================== */

export function listConnectors(filter: ConnectorInstanceFilter = {}): ConnectorInstanceView[] {
  return listConnectorInstances(filter);
}

export function getConnector(connectorInstanceId: string): ConnectorInstanceView | null {
  return getConnectorInstance(connectorInstanceId);
}

export function connectorKeys(): string[] {
  return registeredConnectorKeys();
}

/**
 * Asks a connector how it is.
 *
 * Returns the health object rather than writing it, because a health check is
 * a read and a caller that wanted to persist the answer would also want to
 * decide when. `actionSetConnectorHealth` in the server actions is where
 * persistence happens, deliberately behind a human action.
 */
export async function checkConnectorHealth(
  connectorInstanceId: string,
  options: { runId: string; atMoment?: string; clock?: IntegrationClock } = { runId: "" },
): Promise<ConnectorHealth> {
  const clock = options.clock ?? systemClock;
  const instance = requireConnectorInstance(connectorInstanceId);
  const { connector } = resolveConnector(instance.id);
  const context = createConnectorContext({
    runId: options.runId,
    connectorInstanceId: instance.id,
    atMoment: options.atMoment ?? "00:00",
    clock,
  });
  try {
    return await connector.health(context);
  } catch (error) {
    const connectorError = toConnectorError(error, { connectorInstanceId: instance.id });
    return {
      state: "unavailable",
      message: connectorError.message,
      checkedAt: clock.nowIso(),
      lastSuccessfulSyncAt: instance.lastSyncAt,
      secretStatus: instance.secretStatus,
    };
  }
}

/** Health for every instance, for the integration centre. */
export async function checkAllConnectorHealth(params: {
  runId: string;
  atMoment?: string;
  clock?: IntegrationClock;
}): Promise<Array<{ instance: ConnectorInstanceView; health: ConnectorHealth }>> {
  const results: Array<{ instance: ConnectorInstanceView; health: ConnectorHealth }> = [];
  for (const instance of listConnectorInstances()) {
    results.push({
      instance,
      health: await checkConnectorHealth(instance.id, {
        runId: params.runId,
        ...(params.atMoment ? { atMoment: params.atMoment } : {}),
        ...(params.clock ? { clock: params.clock } : {}),
      }),
    });
  }
  return results.sort(
    (a, b) =>
      MODE_ORDER[a.instance.mode] - MODE_ORDER[b.instance.mode] ||
      a.instance.displayName.localeCompare(b.instance.displayName),
  );
}

/* ==========================================================================
   Reading through the gate
   ========================================================================== */

export async function readRecord(params: {
  runId: string;
  connectorInstanceId: string;
  objectType: string;
  externalId: string;
  atMoment?: string;
  clock?: IntegrationClock;
  signal?: AbortSignal;
}): Promise<ExternalRecord | null> {
  const instance = requireConnectorInstance(params.connectorInstanceId);
  assertCapability(instance, "read", params.objectType);

  const clock = params.clock ?? systemClock;
  const { connector } = resolveConnector(instance.id);
  const context = createConnectorContext({
    runId: params.runId,
    connectorInstanceId: instance.id,
    atMoment: params.atMoment ?? "00:00",
    clock,
    ...(params.signal ? { signal: params.signal } : {}),
  });

  const result = await runAttempt(
    (signal) => connector.read(params.objectType, params.externalId, { ...context, signal }),
    DEFAULT_RETRY_POLICY,
    { connectorInstanceId: instance.id },
  );
  return result.record;
}

export async function searchRecords(params: {
  runId: string;
  connectorInstanceId: string;
  objectType: string;
  query: string;
  limit?: number;
  atMoment?: string;
  clock?: IntegrationClock;
  signal?: AbortSignal;
}): Promise<ConnectorSearchResult> {
  const instance = requireConnectorInstance(params.connectorInstanceId);
  assertCapability(instance, "search", params.objectType);

  const clock = params.clock ?? systemClock;
  const { connector } = resolveConnector(instance.id);
  const context = createConnectorContext({
    runId: params.runId,
    connectorInstanceId: instance.id,
    atMoment: params.atMoment ?? "00:00",
    clock,
    ...(params.signal ? { signal: params.signal } : {}),
  });

  return runAttempt(
    (signal) =>
      connector.search(
        params.query,
        { objectType: params.objectType, limit: params.limit ?? 25 },
        { ...context, signal },
      ),
    DEFAULT_RETRY_POLICY,
    { connectorInstanceId: instance.id },
  );
}

/**
 * Subscription state for one instance.
 *
 * Returns a disabled subscription rather than throwing when the connector has
 * no `subscribe` member, because "this connector has no event subscription" is
 * a legitimate answer the integration centre has to display and not an error.
 */
export async function describeSubscription(params: {
  runId: string;
  connectorInstanceId: string;
  atMoment?: string;
  clock?: IntegrationClock;
}) {
  const instance = requireConnectorInstance(params.connectorInstanceId);
  const clock = params.clock ?? systemClock;
  const { connector } = resolveConnector(instance.id);

  if (!connector.subscribe) {
    return {
      mechanism: "none" as const,
      eventTypes: [],
      endpointLabel: instance.endpointLabel,
      active: false,
      note: "This connector declares no event subscription.",
    };
  }

  const context = createConnectorContext({
    runId: params.runId,
    connectorInstanceId: instance.id,
    atMoment: params.atMoment ?? "00:00",
    clock,
  });
  return connector.subscribe(context);
}

/* ==========================================================================
   The public surface other layers call
   ========================================================================== */

export {
  /* Inbound. The ten step pipeline and the hook contract. */
  ingestInboundEvent,
  registerInboundHook,
  clearInboundHooks,
  evaluateAiPreparationPolicy,
  resolveEvidenceForObject,
  listInboundEvents,
  listIntegrationLiveEvents,
  findInboundEvent,
  type InboundEventInput,
  type InboundHook,
  type InboundHookPayload,
  type IngestionResult,
  type IngestionStep,
} from "./EventIngestion";

export {
  /* Outbound. The ten step pipeline, manual retry and the drain. */
  dispatchCommand,
  retryCommand,
  drainOutbox,
  cancelCommand,
  type DispatchCommandInput,
  type DispatchOptions,
  type DispatchResult,
  type DispatchStep,
} from "./CommandDispatcher";

export {
  /* Sync, freshness and the two functions the workday and the AI layer call. */
  runSync,
  runAllSyncs,
  getSourceAttribution,
  getDecisionSourceAttribution,
  checkRequiredSources,
  canonicalTypeForObjectKind,
  ensureSyncState,
  listSyncState,
  syncStateForConnector,
  listSourceRequirements,
  type RequiredSourceCheck,
  type MissingSource,
  type SyncOutcome,
} from "./SyncCoordinator";

export {
  /* Receipts. Written only from an acknowledgement. */
  receiptLinesForDecision,
  receiptLinesForCommand,
  receiptsForCommand,
  receiptsForDecision,
  hasNoAcknowledgedReceipt,
} from "@/integrations/receipts/ExternalExecutionReceipt";

export {
  /* The outbox and the retry queue. */
  listQueue,
  listAllCommands,
  listCommandsForDecision,
  summariseOutbox,
  claimDue,
  type OutboxSummary,
} from "./Outbox";

export {
  listDeadLetters,
  listOpenDeadLetters,
  partitionDeadLetters,
  resolveDeadLetter,
} from "./DeadLetterStore";

export {
  buildIdempotencyKey,
  findCommandById,
  findCommandByIdempotencyKey,
  type CommandRow,
} from "./IdempotencyStore";

export {
  computeFreshness,
  buildDeepLink,
  ageInMinutes,
  mapExternalRecord,
  findSourceMapping,
  referencesForCanonicalObject,
  referencesForConnector,
  digestPayload,
} from "@/integrations/mappings/CanonicalMapper";

export {
  selectConflictPolicy,
  resolveConflict,
  listSourceMappings,
  CONFLICT_POLICY_LABELS,
  CONFLICT_POLICY_DESCRIPTIONS,
} from "@/integrations/mappings/ConflictPolicy";

export {
  DEFAULT_RETRY_POLICY,
  SYNC_RETRY_POLICY,
  computeBackoffDelay,
  backoffSchedule,
  nextAttemptAt,
  shouldRetry,
  type RetryPolicy,
} from "./RetryPolicy";

export {
  declaresCapability,
  capabilityCount,
  NO_CAPABILITIES,
  CONNECTOR_OPERATIONS,
  type Connector,
  type ConnectorCapabilities,
  type ConnectorHealth,
  type ConnectorInstanceView,
  type ConnectorMetadata,
  type ConnectorOperation,
  type ExternalRecord,
  type OutboundCommandEnvelope,
  type ConnectorAcknowledgement,
} from "@/integrations/core/Connector";

export {
  ConnectorError,
  INTEGRATION_ERROR_CODES,
  INTEGRATION_ERROR_LABELS,
  isRetryableCode,
  toConnectorError,
  type IntegrationErrorCode,
} from "@/integrations/core/errors";

export {
  systemClock,
  fixedClock,
  manualClock,
  noJitter,
  randomJitter,
  seededJitter,
  createConnectorContext,
  type IntegrationClock,
  type JitterSource,
} from "@/integrations/core/ConnectorContext";

export {
  listConnectorInstances,
  requireConnectorInstance,
  resolveConnector,
  isOperableMode,
  MODE_ORDER,
} from "@/integrations/core/ConnectorRegistry";

/**
 * Source attribution for a selection in the workday.
 *
 * A thin convenience over `getSourceAttribution` that takes the workday's own
 * object vocabulary, so the centre workspace does not have to know about
 * canonical type names. This is the function to call from a work object view.
 */
export function sourcesForWorkObject(params: {
  runId: string;
  objectKind: string;
  objectId: string;
  decisionId?: string | null;
  clock?: IntegrationClock;
}): SourceAttribution[] {
  return attribute({
    runId: params.runId,
    canonicalType: toCanonicalType(params.objectKind),
    canonicalId: params.objectId,
    ...(params.decisionId ? { contextType: "decision", contextId: params.decisionId } : {}),
    ...(params.clock ? { clock: params.clock } : {}),
  });
}
