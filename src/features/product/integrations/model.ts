/**
 * The Integrations page's read model (plan 7.6).
 *
 * Per connector instance: its readiness mode as a status (a simulated
 * connector is labelled Simulated), health, last sync, source freshness
 * computed from each object type's staleness threshold, event subscription,
 * write state (not declared, not enabled, paused or enabled), its queued and
 * failed commands and dead letters, its mapping issues, and the state of its
 * credential as one of four words. There is no field here that could carry a
 * credential, an endpoint with a token or a payload: the view is built from
 * columns that cannot hold one.
 *
 * Mapping issues combine what the runtime already detects (a conflicted
 * external reference, a rejected inbound event) with the review records in
 * `data_quality_issues`, so a detected conflict that nobody has reviewed is
 * shown, and one that was resolved is shown as resolved.
 *
 * Server only.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { externalReferences, integrationEvents, type ConnectorMode, type FreshnessState } from "@/db/schema/integration";
import { listDataQualityIssues, listIntegrationIncidents, type DataQualityIssue, type IntegrationIncident } from "@/db/repositories/integration-operations";
import { getScenarioState } from "@/scenario/engine/state";
import {
  computeFreshness,
  listConnectors,
  listDeadLetters,
  listQueue,
  listSyncState,
  listWritePauses,
  type CommandRow,
  type ConnectorInstanceView,
  type WritePauseState,
} from "@/integrations/runtime/IntegrationRuntime";
import { statusForConnectorMode, type ProductStatus } from "@/product/status";

export type WriteState = "not-declared" | "not-enabled" | "paused" | "enabled";

export interface ConnectorView {
  id: string;
  displayName: string;
  sourceSystem: string;
  mode: ConnectorMode;
  status: ProductStatus;
  healthState: ConnectorInstanceView["healthState"];
  healthMessage: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  freshness: { state: FreshnessState; types: number; stale: number; neverSynced: number };
  subscription: ConnectorInstanceView["eventSubscriptionStatus"];
  writeState: WriteState;
  pause: WritePauseState | null;
  commands: { queued: number; failed: number; deadLetters: number; awaitingApproval: number };
  mappingIssues: number;
  /** A state only: not-required, absent, present or invalid. Never the credential. */
  credential: ConnectorInstanceView["secretStatus"];
  canSync: boolean;
}

export interface QueueRow {
  command: CommandRow;
  targetSystem: string;
  deadLetterReason: string;
  retryable: boolean;
  paused: boolean;
}

export interface MappingIssueView {
  /** `issue:<id>`, `ref:<id>` or `event:<id>`: what Resolve mapping acts on. */
  key: string;
  kind: "mapping" | "conflict" | "rejected-event" | DataQualityIssue["kind"];
  connectorInstanceId: string;
  title: string;
  detail: string;
  detectedAt: string;
  status: "detected" | DataQualityIssue["status"];
  resolution: string;
  recordedIssueId: string | null;
  externalReferenceId: string | null;
  integrationEventId: string | null;
}

export interface IntegrationsView {
  runId: string;
  connectors: ConnectorView[];
  planned: ConnectorInstanceView[];
  queue: QueueRow[];
  mappingIssues: MappingIssueView[];
  incidents: IntegrationIncident[];
}

/** The write state, from what the connector declares, its configuration and any pause. */
export function writeStateFor(instance: Pick<ConnectorInstanceView, "capabilities" | "writeEnabled">, pause: WritePauseState | null): WriteState {
  if (instance.capabilities.write.length === 0) return "not-declared";
  if (!instance.writeEnabled) return "not-enabled";
  return pause?.paused ? "paused" : "enabled";
}

function worstFreshness(states: readonly FreshnessState[]): FreshnessState {
  if (states.length === 0 || states.includes("unknown")) return "unknown";
  if (states.includes("stale")) return "stale";
  if (states.every((state) => state === "live")) return "live";
  return "fresh";
}

/** Mapping issues: recorded reviews first, then detections nobody has reviewed. */
export function readMappingIssues(runId: string): MappingIssueView[] {
  const recorded = listDataQualityIssues({ runId });
  const reviewedRefs = new Set(recorded.map((issue) => issue.externalReferenceId).filter((id): id is string => id !== null));
  const reviewedEvents = new Set(recorded.map((issue) => issue.integrationEventId).filter((id): id is string => id !== null));

  const conflicts = getDb()
    .select()
    .from(externalReferences)
    .where(and(eq(externalReferences.runId, runId), eq(externalReferences.conflicted, true)))
    .all()
    .filter((row) => !reviewedRefs.has(row.id));
  const rejected = getDb()
    .select()
    .from(integrationEvents)
    .where(and(eq(integrationEvents.runId, runId), eq(integrationEvents.status, "rejected")))
    .all()
    .filter((row) => !reviewedEvents.has(row.id));

  return [
    ...recorded.map(
      (issue): MappingIssueView => ({
        key: `issue:${issue.id}`,
        kind: issue.kind,
        connectorInstanceId: issue.connectorInstanceId,
        title: issue.title,
        detail: issue.detail,
        detectedAt: issue.detectedAt,
        status: issue.status,
        resolution: issue.resolution,
        recordedIssueId: issue.id,
        externalReferenceId: issue.externalReferenceId,
        integrationEventId: issue.integrationEventId,
      }),
    ),
    ...conflicts.map(
      (row): MappingIssueView => ({
        key: `ref:${row.id}`,
        kind: "conflict",
        connectorInstanceId: row.connectorInstanceId,
        title: `${row.externalType} ${row.externalId} disagrees with another source about ${row.canonicalType} ${row.canonicalId}`,
        detail: row.conflictNote,
        detectedAt: row.syncedAt,
        status: "detected",
        resolution: "",
        recordedIssueId: null,
        externalReferenceId: row.id,
        integrationEventId: null,
      }),
    ),
    ...rejected.map(
      (row): MappingIssueView => ({
        key: `event:${row.id}`,
        kind: "rejected-event",
        connectorInstanceId: row.connectorInstanceId,
        title: `Inbound ${row.eventType} was rejected`,
        detail: row.rejectionReason,
        detectedAt: row.receivedAt,
        status: "detected",
        resolution: "",
        recordedIssueId: null,
        externalReferenceId: null,
        integrationEventId: row.id,
      }),
    ),
  ];
}

export function readIntegrationsView(): IntegrationsView {
  const runId = (() => {
    try {
      return getScenarioState()?.runId ?? DEFAULT_RUN_ID;
    } catch {
      return DEFAULT_RUN_ID;
    }
  })();
  const instances = listConnectors();
  const pauses = listWritePauses();
  const syncState = listSyncState(runId);
  const queue = listQueue(runId);
  const deadLetters = new Map(listDeadLetters(runId).map((row) => [row.commandId, row]));
  const mappingIssues = readMappingIssues(runId);
  const openIssues = mappingIssues.filter((issue) => issue.status === "detected" || issue.status === "open" || issue.status === "in-review");

  const connectors = instances
    .filter((instance) => instance.mode !== "planned")
    .map((instance): ConnectorView => {
      const pause = pauses.get(instance.id) ?? null;
      const types = syncState.filter((row) => row.connectorInstanceId === instance.id);
      const states = types.map((row) =>
        computeFreshness({
          lastSyncAt: row.lastSyncAt,
          stalenessThresholdMinutes: row.stalenessThresholdMinutes,
          pushBased: instance.capabilities.webhooks,
        }),
      );
      const commands = queue.filter((command) => command.connectorInstanceId === instance.id);
      return {
        id: instance.id,
        displayName: instance.displayName,
        sourceSystem: instance.sourceSystem,
        mode: instance.mode,
        status: statusForConnectorMode(instance.mode),
        healthState: instance.healthState,
        healthMessage: instance.healthMessage,
        lastSyncAt: instance.lastSyncAt,
        lastSyncStatus: instance.lastSyncStatus,
        freshness: {
          state: worstFreshness(states),
          types: types.length,
          stale: states.filter((state) => state === "stale").length,
          neverSynced: types.filter((row) => row.lastSyncAt === null).length,
        },
        subscription: instance.eventSubscriptionStatus,
        writeState: writeStateFor(instance, pause),
        pause,
        commands: {
          queued: commands.filter((command) => command.status === "queued" || command.status === "approved" || command.status === "executing").length,
          failed: commands.filter((command) => command.status === "failed").length,
          deadLetters: commands.filter((command) => command.status === "dead-letter").length,
          awaitingApproval: commands.filter((command) => command.status === "awaiting-approval").length,
        },
        mappingIssues: openIssues.filter((issue) => issue.connectorInstanceId === instance.id).length,
        credential: instance.secretStatus,
        canSync: instance.capabilities.deltaSync && instance.capabilities.read.length > 0,
      };
    });

  const byId = new Map(instances.map((instance) => [instance.id, instance]));
  return {
    runId,
    connectors,
    planned: instances.filter((instance) => instance.mode === "planned"),
    queue: queue.map((command) => {
      const deadLetter = deadLetters.get(command.id);
      return {
        command,
        targetSystem: byId.get(command.connectorInstanceId)?.sourceSystem ?? command.connectorInstanceId,
        deadLetterReason: deadLetter && deadLetter.resolvedAt === null ? deadLetter.reason : "",
        retryable: command.status !== "awaiting-approval" && (deadLetter ? deadLetter.retryable : true),
        paused: pauses.get(command.connectorInstanceId)?.paused ?? false,
      };
    }),
    mappingIssues,
    incidents: listIntegrationIncidents({ runId }),
  };
}
