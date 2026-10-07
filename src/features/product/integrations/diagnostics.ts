/**
 * The diagnostic bundle (plan 7.6: Download diagnostic bundle).
 *
 * The same three parts as `scripts/support-bundle.ts`: a health snapshot,
 * the release metadata from the release registry, and an explicit list of
 * what is excluded. Built server side, in memory, for one download, with the
 * integration state an Integration Owner needs added: each connector's mode,
 * health, write state, credential state (a word, never a value), sync state
 * and freshness inputs, the outbox counts, the open dead letters with their
 * error codes, and the mapping issues.
 *
 * What it never holds: a credential or any part of one, a session secret, a
 * command payload (its digest only), evidence text, message bodies, prompts,
 * or personal data. The connector view it reads has no column that could
 * carry a credential, and the unit test scans the bundle for one.
 *
 * Server only.
 */

import { getHealthSummary } from "@/health/service";
import { PRODUCT_IDENTITY, PRODUCT_RELEASE } from "@/product/release";
import { listDeadLetters, listSyncState, summariseOutbox } from "@/integrations/runtime/IntegrationRuntime";
import { readIntegrationsView } from "./model";

export const DIAGNOSTIC_EXCLUSIONS = [
  "API keys, tokens and credentials of any kind",
  "Session secrets",
  "Command payloads (digests only)",
  "Database contents beyond the operational fields listed",
  "Evidence document text",
  "Message bodies and meeting transcripts",
  "AI prompts",
  "Personal data",
] as const;

export async function buildDiagnosticBundle(requestedBy: string): Promise<Record<string, unknown>> {
  const view = readIntegrationsView();
  const health = await getHealthSummary(false);
  const createdAt = new Date().toISOString();
  return {
    bundleId: `DIAG-${createdAt.replace(/[:.]/g, "-")}`,
    createdAt,
    requestedBy,
    sanitized: true,
    disclosures: ["Synthetic institution and data.", "Every connector in this build is simulated or not yet built."],
    release: {
      product: PRODUCT_IDENTITY.name,
      version: PRODUCT_RELEASE.version,
      stage: PRODUCT_RELEASE.stage,
      nodeVersion: process.version,
      platform: process.platform,
    },
    health,
    connectors: view.connectors.map((connector) => ({
      id: connector.id,
      sourceSystem: connector.sourceSystem,
      mode: connector.mode,
      status: connector.status,
      healthState: connector.healthState,
      writeState: connector.writeState,
      pausedAt: connector.pause?.paused ? connector.pause.changedAt : null,
      credentialState: connector.credential,
      subscription: connector.subscription,
      lastSyncAt: connector.lastSyncAt,
      lastSyncStatus: connector.lastSyncStatus,
      freshness: connector.freshness,
      commands: connector.commands,
      openMappingIssues: connector.mappingIssues,
    })),
    plannedAdapters: view.planned.map((instance) => instance.id),
    syncState: listSyncState(view.runId).map((row) => ({
      connectorInstanceId: row.connectorInstanceId,
      objectType: row.objectType,
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      stalenessThresholdMinutes: row.stalenessThresholdMinutes,
      recordsSeen: row.recordsSeen,
      recordsConflicted: row.recordsConflicted,
    })),
    outbox: summariseOutbox(view.runId),
    openDeadLetters: listDeadLetters(view.runId)
      .filter((row) => row.resolvedAt === null)
      .map((row) => ({
        commandId: row.commandId,
        connectorInstanceId: row.connectorInstanceId,
        errorCode: row.lastError.split(":")[0] ?? "",
        attempts: row.attempts,
        payloadDigest: row.payloadDigest,
        enteredAt: row.enteredAt,
        retryable: row.retryable,
      })),
    mappingIssues: view.mappingIssues.map((issue) => ({
      key: issue.key,
      kind: issue.kind,
      connectorInstanceId: issue.connectorInstanceId,
      status: issue.status,
      detectedAt: issue.detectedAt,
    })),
    excluded: [...DIAGNOSTIC_EXCLUSIONS],
  };
}
