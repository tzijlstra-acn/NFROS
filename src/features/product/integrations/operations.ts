/**
 * The governed integration actions (plan 7.6): Test connection, Run sync,
 * Pause writes, Resume writes, Retry command and Resolve mapping.
 *
 * Every connector is simulated in this build, and every action is real
 * against the simulated runtime: Test connection asks the connector for its
 * health, Run sync runs the delta sync through the capability gate, Pause
 * writes records the hold the dispatcher enforces on every attempt, Retry
 * hands the command back to the dispatcher (which calls the authority gate
 * again and keeps the idempotency key), and Resolve mapping records the
 * review in `data_quality_issues`.
 *
 * Each goes through `governConsoleAction`: the Integration Owner's scopes are
 * checked on the server, the material ones (pause, resume, resolve) need an
 * approval bound to the change as it is now, and the audit record is written
 * with the change. Nothing here accepts or returns a credential or an
 * endpoint; the browser sends identifiers, validated against what exists.
 *
 * Server only.
 */

import { randomUUID } from "node:crypto";
import { requireScenarioState } from "@/scenario/engine/state";
import { getDataQualityIssue, recordDataQualityIssue, updateDataQualityIssue } from "@/db/repositories/integration-operations";
import {
  checkConnectorHealth,
  drainOutbox,
  findCommandById,
  getConnector,
  getWritePause,
  isWritePaused,
  listQueue,
  recordWritePause,
  retryCommand,
  runSync,
  type ConnectorHealth,
  type DispatchResult,
} from "@/integrations/runtime/IntegrationRuntime";
import {
  fingerprintConsoleChange,
  governConsoleAction,
  type ConsoleActionResult,
  type ConsoleApprovalInput,
} from "@/features/product/governance";
import type { Bilingual } from "@/features/product/permissions";
import { readMappingIssues, writeStateFor, type MappingIssueView } from "./model";

export interface IntegrationProposal {
  payload: Record<string, unknown>;
  fingerprint: string;
  lines: Bilingual[];
}

const noConnector = (id: string): Bilingual => ({ en: `There is no connector instance ${id}.`, de: `Es gibt keine Konnektorinstanz ${id}.` });

function queuedFor(runId: string, connectorInstanceId: string): number {
  return listQueue(runId).filter(
    (command) =>
      command.connectorInstanceId === connectorInstanceId &&
      (command.status === "queued" || command.status === "approved" || command.status === "failed"),
  ).length;
}

/* ==========================================================================
   Test connection
   ========================================================================== */

export async function testConnection(connectorInstanceId: string): Promise<ConsoleActionResult<ConnectorHealth>> {
  const instance = getConnector(connectorInstanceId);
  return governConsoleAction<ConnectorHealth, ConnectorHealth>({
    actionId: "integration.test-connection",
    target: { kind: "connector-instance", id: connectorInstanceId },
    payload: { connectorInstanceId },
    summary: { en: `Tested the connection to ${connectorInstanceId}.`, de: `Verbindung zu ${connectorInstanceId} getestet.` },
    rule: () => (instance ? null : noConnector(connectorInstanceId)),
    prepare: async () => {
      const state = requireScenarioState();
      return checkConnectorHealth(connectorInstanceId, { runId: state.runId, atMoment: state.currentMoment });
    },
    execute: (_context, health) => health,
    success: (health) => ({
      en: `${instance?.displayName ?? connectorInstanceId}: ${health.state}. ${health.message}`,
      de: `${instance?.displayName ?? connectorInstanceId}: ${health.state}. ${health.message}`,
    }),
  });
}

/* ==========================================================================
   Run sync
   ========================================================================== */

export async function runConnectorSync(
  connectorInstanceId: string,
): Promise<ConsoleActionResult<{ mapped: number; changed: number; conflicted: number; failures: number; types: number }>> {
  const instance = getConnector(connectorInstanceId);
  return governConsoleAction({
    actionId: "integration.run-sync",
    target: { kind: "connector-instance", id: connectorInstanceId },
    payload: { connectorInstanceId },
    summary: { en: `Ran a sync of ${connectorInstanceId}.`, de: `Synchronisierung von ${connectorInstanceId} ausgefuehrt.` },
    rule: () => {
      if (!instance) return noConnector(connectorInstanceId);
      if (!instance.capabilities.deltaSync || instance.capabilities.read.length === 0) {
        return {
          en: `${instance.displayName} declares no delta sync, so there is nothing to sync.`,
          de: `${instance.displayName} deklariert keinen Delta-Abgleich, es gibt daher nichts zu synchronisieren.`,
        };
      }
      return null;
    },
    prepare: async () => {
      const state = requireScenarioState();
      const totals = { mapped: 0, changed: 0, conflicted: 0, failures: 0, types: 0 };
      for (const objectType of instance?.capabilities.read ?? []) {
        const outcome = await runSync({ runId: state.runId, connectorInstanceId, objectType, atMoment: state.currentMoment });
        totals.types += 1;
        totals.mapped += outcome.recordsMapped;
        totals.changed += outcome.recordsChanged;
        totals.conflicted += outcome.recordsConflicted;
        if (outcome.status !== "ok") totals.failures += 1;
      }
      return totals;
    },
    execute: (_context, totals) => totals,
    success: (totals) => ({
      en: `${instance?.displayName ?? connectorInstanceId} synced ${totals.mapped} record(s) across ${totals.types} object type(s): ${totals.changed} changed, ${totals.conflicted} conflicted, ${totals.failures} type(s) did not complete.`,
      de: `${instance?.displayName ?? connectorInstanceId} hat ${totals.mapped} Datensaetze ueber ${totals.types} Objekttypen abgeglichen: ${totals.changed} geaendert, ${totals.conflicted} widerspruechlich, ${totals.failures} Typen nicht abgeschlossen.`,
    }),
  });
}

/* ==========================================================================
   Pause and resume writes
   ========================================================================== */

export function proposeWriteState(connectorInstanceId: string, paused: boolean): IntegrationProposal | null {
  const instance = getConnector(connectorInstanceId);
  if (!instance) return null;
  const state = requireScenarioState();
  const queued = queuedFor(state.runId, connectorInstanceId);
  const payload = { connectorInstanceId, writeState: paused ? "paused" : "resumed", queued };
  return {
    payload,
    fingerprint: fingerprintConsoleChange(paused ? "integration.pause-writes" : "integration.resume-writes", payload),
    lines: paused
      ? [
          {
            en: `The dispatcher stops sending changes to ${instance.sourceSystem}. Nothing is refused: approved changes enter the outbox and wait.`,
            de: `Der Dispatcher sendet keine Aenderungen mehr an ${instance.sourceSystem}. Nichts wird abgelehnt: genehmigte Aenderungen kommen in den Postausgang und warten.`,
          },
          {
            en: `${queued} command(s) now waiting for ${instance.sourceSystem} stay queued until writes resume. Decisions and approvals are untouched.`,
            de: `${queued} Befehl(e), die jetzt auf ${instance.sourceSystem} warten, bleiben bis zur Fortsetzung eingereiht. Entscheidungen und Genehmigungen bleiben unberuehrt.`,
          },
        ]
      : [
          {
            en: `The dispatcher sends changes to ${instance.sourceSystem} again.`,
            de: `Der Dispatcher sendet wieder Aenderungen an ${instance.sourceSystem}.`,
          },
          {
            en: `${queued} queued command(s) are attempted now, on their original idempotency keys.`,
            de: `${queued} eingereihte Befehl(e) werden jetzt versucht, mit ihren urspruenglichen Idempotenzschluesseln.`,
          },
        ],
  };
}

export async function setConnectorWritesPaused(
  connectorInstanceId: string,
  paused: boolean,
  approval: ConsoleApprovalInput,
): Promise<ConsoleActionResult<{ changed: boolean; delivered: number }>> {
  const instance = getConnector(connectorInstanceId);
  const proposal = proposeWriteState(connectorInstanceId, paused);
  const result = await governConsoleAction({
    actionId: paused ? "integration.pause-writes" : "integration.resume-writes",
    target: { kind: "connector-instance", id: connectorInstanceId },
    payload: proposal?.payload ?? { connectorInstanceId },
    approval,
    summary: paused
      ? { en: `Paused writes to ${connectorInstanceId}.`, de: `Schreibzugriffe auf ${connectorInstanceId} angehalten.` }
      : { en: `Resumed writes to ${connectorInstanceId}.`, de: `Schreibzugriffe auf ${connectorInstanceId} fortgesetzt.` },
    rule: () => {
      if (!instance || !proposal) return noConnector(connectorInstanceId);
      const writeState = writeStateFor(instance, getWritePause(connectorInstanceId));
      if (writeState === "not-declared" || writeState === "not-enabled") {
        return {
          en: `${instance.displayName} does not write, so there are no writes to pause or resume.`,
          de: `${instance.displayName} schreibt nicht, es gibt daher keine Schreibzugriffe anzuhalten oder fortzusetzen.`,
        };
      }
      if (isWritePaused(connectorInstanceId) === paused) {
        return paused
          ? { en: "Writes are already paused.", de: "Schreibzugriffe sind bereits angehalten." }
          : { en: "Writes are not paused.", de: "Schreibzugriffe sind nicht angehalten." };
      }
      return null;
    },
    execute: ({ actor, at, rationale }) => ({
      changed: recordWritePause({ connectorInstanceId, paused, reason: rationale, changedBy: actor.label, at }),
      delivered: 0,
    }),
    success: () =>
      paused
        ? {
            en: `Writes to ${instance?.sourceSystem ?? connectorInstanceId} are paused. Approved changes are queued and preserved.`,
            de: `Schreibzugriffe auf ${instance?.sourceSystem ?? connectorInstanceId} sind angehalten. Genehmigte Aenderungen werden eingereiht und bleiben erhalten.`,
          }
        : {
            en: `Writes to ${instance?.sourceSystem ?? connectorInstanceId} are resumed.`,
            de: `Schreibzugriffe auf ${instance?.sourceSystem ?? connectorInstanceId} sind fortgesetzt.`,
          },
  });

  /*
   * Resuming delivers what waited, through the dispatcher's own drain, after
   * the resume is recorded. One attempt each; a target that still fails
   * leaves its command scheduled or dead lettered, as any attempt would.
   */
  if (!result.ok || paused) return result;
  const state = requireScenarioState();
  const outcomes: DispatchResult[] = await drainOutbox(state.runId, { connectorInstanceId, attemptPolicy: "single" });
  const delivered = outcomes.filter((outcome) => outcome.acknowledged).length;
  return {
    ...result,
    value: { ...result.value, delivered },
    message: {
      en: `${result.message.en} ${delivered} of ${outcomes.length} queued command(s) were delivered.`,
      de: `${result.message.de} ${delivered} von ${outcomes.length} eingereihten Befehlen wurden zugestellt.`,
    },
  };
}

/* ==========================================================================
   Retry command
   ========================================================================== */

export async function retryIntegrationCommand(commandId: string): Promise<ConsoleActionResult<DispatchResult>> {
  const command = findCommandById(commandId);
  return governConsoleAction<DispatchResult, DispatchResult>({
    actionId: "integration.retry-command",
    target: { kind: "integration-command", id: commandId },
    payload: { commandId },
    summary: { en: `Retried command ${commandId} through the dispatcher.`, de: `Befehl ${commandId} ueber den Dispatcher wiederholt.` },
    rule: () => {
      if (!command) return { en: `There is no integration command ${commandId}.`, de: `Es gibt keinen Integrationsbefehl ${commandId}.` };
      if (command.status === "acknowledged") {
        return { en: `${commandId} is already acknowledged.`, de: `${commandId} ist bereits bestaetigt.` };
      }
      if (command.status === "awaiting-approval" || command.status === "proposed" || command.status === "cancelled") {
        return {
          en: `${commandId} has no approved change to deliver, so it cannot be retried.`,
          de: `${commandId} hat keine genehmigte Aenderung zum Zustellen und kann nicht wiederholt werden.`,
        };
      }
      if (isWritePaused(command.connectorInstanceId)) {
        return {
          en: "Writes to this connector are paused. Resume writes first; the command stays queued.",
          de: "Schreibzugriffe auf diesen Konnektor sind angehalten. Setzen Sie sie zuerst fort; der Befehl bleibt eingereiht.",
        };
      }
      return null;
    },
    prepare: async () => {
      const state = requireScenarioState();
      return retryCommand(commandId, { autonomyLevel: state.autonomyLevel });
    },
    execute: (_context, outcome) => outcome,
    success: (outcome) => ({ en: outcome.message, de: outcome.message }),
  });
}

/* ==========================================================================
   Resolve mapping
   ========================================================================== */

export function findMappingIssue(key: string): MappingIssueView | undefined {
  const state = requireScenarioState();
  return readMappingIssues(state.runId).find((issue) => issue.key === key);
}

export function proposeResolveMapping(issue: MappingIssueView): IntegrationProposal {
  const payload = { key: issue.key, status: issue.status, connectorInstanceId: issue.connectorInstanceId };
  return {
    payload,
    fingerprint: fingerprintConsoleChange("integration.resolve-mapping", payload),
    lines: [
      {
        en: `The issue "${issue.title}" is recorded as reviewed, with your rationale as the resolution.`,
        de: `Das Problem "${issue.title}" wird als geprueft erfasst, mit Ihrer Begruendung als Klaerung.`,
      },
      {
        en: "The data is not changed and the conflict marker the analyst sees stays: a disagreement between sources can be the finding. A mapping change is a configuration change.",
        de: "Die Daten werden nicht geaendert, und die Widerspruchsmarkierung fuer die Analystin bleibt: ein Widerspruch zwischen Quellen kann der Befund sein. Eine Zuordnungsaenderung ist eine Konfigurationsaenderung.",
      },
    ],
  };
}

export async function resolveMappingIssue(
  key: string,
  outcome: "resolved" | "accepted",
  approval: ConsoleApprovalInput,
): Promise<ConsoleActionResult<{ issueId: string }>> {
  const issue = findMappingIssue(key);
  const proposal = issue ? proposeResolveMapping(issue) : null;
  return governConsoleAction({
    actionId: "integration.resolve-mapping",
    target: { kind: "data-quality-issue", id: key },
    payload: proposal?.payload ?? { key },
    approval,
    summary: {
      en: `Recorded the review of mapping issue ${key} as ${outcome}.`,
      de: `Pruefung des Zuordnungsproblems ${key} als ${outcome === "resolved" ? "geklaert" : "akzeptiert"} erfasst.`,
    },
    rule: () => {
      if (!issue) return { en: "That mapping issue no longer exists.", de: "Dieses Zuordnungsproblem besteht nicht mehr." };
      if (issue.status === "resolved" || issue.status === "accepted") {
        return { en: "That issue is already resolved.", de: "Dieses Problem ist bereits geklaert." };
      }
      return null;
    },
    execute: ({ actor, at, rationale }) => {
      if (!issue) throw new Error(`Mapping issue ${key} disappeared.`);
      if (issue.recordedIssueId && getDataQualityIssue(issue.recordedIssueId)) {
        updateDataQualityIssue(issue.recordedIssueId, { status: outcome, resolvedAt: at, resolvedByLabel: actor.label, resolution: rationale });
        return { issueId: issue.recordedIssueId };
      }
      const state = requireScenarioState();
      const recorded = recordDataQualityIssue({
        id: `DQI-${randomUUID().slice(0, 12).toUpperCase()}`,
        runId: state.runId,
        kind: issue.kind === "rejected-event" ? "rejected-event" : issue.kind === "conflict" ? "conflict" : "mapping",
        connectorInstanceId: issue.connectorInstanceId,
        externalReferenceId: issue.externalReferenceId,
        integrationEventId: issue.integrationEventId,
        title: issue.title,
        detail: issue.detail,
        severity: "medium",
        status: outcome,
        detectedAt: issue.detectedAt,
        detectedAtMoment: state.currentMoment,
        detectedBy: "connector",
        resolvedAt: at,
        resolvedByLabel: actor.label,
        resolution: rationale,
      });
      return { issueId: recorded.id };
    },
    success: (value) => ({
      en: `The review is recorded as ${value.issueId}.`,
      de: `Die Pruefung ist als ${value.issueId} erfasst.`,
    }),
  });
}
