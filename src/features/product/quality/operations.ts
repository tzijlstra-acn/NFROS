/**
 * The governed AI quality actions (plan 7.5): Run evaluation, Approve
 * candidate, Reject candidate and Roll back.
 *
 * Each goes through `governConsoleAction`, so the acting persona's scope is
 * checked on the server (the AI Quality Owner holds them), a material action
 * needs an approval bound to the change as it is now, the action's own rule
 * is evaluated against the current state, and the change is written with its
 * audit record in one transaction.
 *
 * The rule that matters: Approve candidate is refused while
 * `releaseBlockedByEvaluation` says the candidate is blocked, whatever the
 * form showed. The approval also binds to the evaluation runs it rests on, so
 * a run recorded between review and submission changes the fingerprint and
 * the approval is refused as stale.
 *
 * Approval records the release decision (`ai_configuration_releases`). The
 * workday's Role App definitions still name their configuration in code, so
 * the decision is the record of which configuration is in force; switching
 * the runtime to read it is outstanding and the Quality page says so.
 *
 * Server only.
 */

import { recordConfigurationRelease, recordConfigurationRollback } from "@/db/repositories/ai-evaluations";
import {
  MIN_RATIONALE_LENGTH,
  fingerprintConsoleChange,
  governConsoleAction,
  type ConsoleActionResult,
  type ConsoleApprovalInput,
} from "@/features/product/governance";
import type { Bilingual } from "@/features/product/permissions";
import {
  configurationInForce,
  getConfiguration,
  latestEvaluationStatus,
  releaseBlockedByEvaluation,
  runEvaluation,
} from "./api";
import { CONSOLE_EVALUATION_MODES, type ConsoleEvaluationMode } from "./harness";

export interface QualityProposal {
  payload: Record<string, unknown>;
  fingerprint: string;
  lines: Bilingual[];
}

const unknownConfiguration = (id: string): Bilingual => ({
  en: `There is no configuration ${id}.`,
  de: `Es gibt keine Konfiguration ${id}.`,
});

/* ==========================================================================
   Run evaluation
   ========================================================================== */

export async function governedRunEvaluation(
  configurationId: string,
  mode: ConsoleEvaluationMode,
): Promise<ConsoleActionResult<{ runId: string; failed: number; mandatoryFailed: number; notRun: number }>> {
  return governConsoleAction({
    actionId: "quality.run-evaluation",
    target: { kind: "ai-configuration", id: configurationId },
    payload: { configurationId, mode },
    summary: {
      en: `Ran the ${mode} evaluation of ${configurationId}. No model was called.`,
      de: `Evaluation ${mode} von ${configurationId} ausgefuehrt. Es wurde kein Modell aufgerufen.`,
    },
    rule: () => {
      if (!(CONSOLE_EVALUATION_MODES as readonly string[]).includes(mode)) {
        return { en: "The console runs the Offline and Safe modes only.", de: "Die Konsole fuehrt nur die Modi Offline und Sicher aus." };
      }
      return getConfiguration(configurationId) ? null : unknownConfiguration(configurationId);
    },
    execute: ({ actor }) => {
      const result = runEvaluation({
        configurationId,
        mode,
        triggeredBy: { label: actor.label, userId: actor.userId },
      });
      if (!result.ok) throw new Error(result.reason.en);
      return {
        runId: result.run.id,
        failed: result.run.failed,
        mandatoryFailed: result.run.mandatoryFailed,
        notRun: result.run.notRun,
      };
    },
    success: (value) => ({
      en: `Evaluation ${value.runId} recorded: ${value.failed} failed (${value.mandatoryFailed} mandatory), ${value.notRun} not run.`,
      de: `Evaluation ${value.runId} erfasst: ${value.failed} fehlgeschlagen (${value.mandatoryFailed} Pflicht), ${value.notRun} nicht ausgefuehrt.`,
    }),
  });
}

/* ==========================================================================
   Approve candidate
   ========================================================================== */

/** The change an approval binds to, recomputed from the current state. */
export function proposeApproveCandidate(configurationId: string): QualityProposal | null {
  const configuration = getConfiguration(configurationId);
  if (!configuration) return null;
  const inForce = configurationInForce(configuration.roleId, configuration.taskKind).configuration;
  const status = latestEvaluationStatus(configurationId);
  const payload = {
    configurationId,
    roleId: configuration.roleId,
    taskKind: configuration.taskKind,
    supersedes: inForce?.id ?? null,
    evaluationRunIds: status.latestByMode.map((run) => run.id),
  };
  return {
    payload,
    fingerprint: fingerprintConsoleChange("quality.approve-candidate", payload),
    lines: [
      {
        en: `${configuration.id} (${configuration.name}) becomes the configuration in force for ${configuration.roleId} ${configuration.taskKind}.`,
        de: `${configuration.id} (${configuration.name}) wird die geltende Konfiguration fuer ${configuration.roleId} ${configuration.taskKind}.`,
      },
      {
        en: inForce ? `It supersedes ${inForce.id}, which can be restored by Roll back.` : "No configuration is superseded.",
        de: inForce ? `Sie ersetzt ${inForce.id}, das mit Zuruecksetzen wiederhergestellt werden kann.` : "Es wird keine Konfiguration ersetzt.",
      },
      {
        en: `The approval rests on evaluation run(s) ${payload.evaluationRunIds.join(", ") || "none"}.`,
        de: `Die Genehmigung stuetzt sich auf Evaluationslauf bzw. -laeufe ${payload.evaluationRunIds.join(", ") || "keine"}.`,
      },
    ],
  };
}

export async function approveCandidate(
  configurationId: string,
  approval: ConsoleApprovalInput,
): Promise<ConsoleActionResult<{ releaseId: string }>> {
  const proposal = proposeApproveCandidate(configurationId);
  const configuration = getConfiguration(configurationId);
  return governConsoleAction({
    actionId: "quality.approve-candidate",
    target: { kind: "ai-configuration", id: configurationId },
    payload: proposal?.payload ?? { configurationId },
    approval,
    summary: {
      en: `Approved ${configurationId} for release.`,
      de: `${configurationId} zur Freigabe genehmigt.`,
    },
    rule: () => {
      if (!configuration || !proposal) return unknownConfiguration(configurationId);
      if (configuration.status !== "candidate") {
        return { en: `${configurationId} is not a candidate.`, de: `${configurationId} ist kein Kandidat.` };
      }
      if (configurationInForce(configuration.roleId, configuration.taskKind).configuration?.id === configurationId) {
        return { en: `${configurationId} is already in force.`, de: `${configurationId} gilt bereits.` };
      }
      const gate = releaseBlockedByEvaluation(configurationId);
      if (gate.blocked) {
        const first = gate.reasons[0];
        return first ?? { en: "The evaluation gate refuses the release.", de: "Die Evaluationspruefung verweigert die Freigabe." };
      }
      return null;
    },
    execute: ({ actor, approvalId, at, rationale }) => {
      const status = latestEvaluationStatus(configurationId);
      const release = recordConfigurationRelease({
        id: `ACR-${at.replace(/[-:.TZ]/g, "").slice(0, 14)}-${configurationId}`,
        configurationId,
        roleId: configuration?.roleId ?? "",
        taskKind: configuration?.taskKind ?? "",
        decision: "approved",
        evaluationRunId: status.latest?.id ?? null,
        supersedesConfigurationId: (proposal?.payload.supersedes as string | null) ?? null,
        rationale,
        decidedAt: at,
        decidedByLabel: actor.label,
        decidedByUserId: actor.userId,
        approvalId,
      });
      return { releaseId: release.id };
    },
    success: () => ({
      en: `${configurationId} is approved and recorded as the configuration in force.`,
      de: `${configurationId} ist genehmigt und als geltende Konfiguration erfasst.`,
    }),
  });
}

/* ==========================================================================
   Reject candidate
   ========================================================================== */

export async function rejectCandidate(configurationId: string, reason: string): Promise<ConsoleActionResult<{ releaseId: string }>> {
  const configuration = getConfiguration(configurationId);
  const trimmed = reason.trim();
  return governConsoleAction({
    actionId: "quality.reject-candidate",
    target: { kind: "ai-configuration", id: configurationId },
    payload: { configurationId, reason: trimmed },
    summary: { en: `Rejected candidate ${configurationId}.`, de: `Kandidat ${configurationId} abgelehnt.` },
    rule: () => {
      if (!configuration) return unknownConfiguration(configurationId);
      if (configuration.status !== "candidate") {
        return { en: `${configurationId} is not a candidate.`, de: `${configurationId} ist kein Kandidat.` };
      }
      if (trimmed.length < MIN_RATIONALE_LENGTH) {
        return {
          en: `State why the candidate is rejected (at least ${MIN_RATIONALE_LENGTH} characters).`,
          de: `Begruenden Sie die Ablehnung (mindestens ${MIN_RATIONALE_LENGTH} Zeichen).`,
        };
      }
      return null;
    },
    execute: ({ actor, at }) => {
      const status = latestEvaluationStatus(configurationId);
      const release = recordConfigurationRelease({
        id: `ACR-${at.replace(/[-:.TZ]/g, "").slice(0, 14)}-${configurationId}-R`,
        configurationId,
        roleId: configuration?.roleId ?? "",
        taskKind: configuration?.taskKind ?? "",
        decision: "rejected",
        evaluationRunId: status.latest?.id ?? null,
        supersedesConfigurationId: null,
        rationale: trimmed,
        decidedAt: at,
        decidedByLabel: actor.label,
        decidedByUserId: actor.userId,
        approvalId: null,
      });
      return { releaseId: release.id };
    },
    success: () => ({ en: `${configurationId} is rejected. The reason is recorded.`, de: `${configurationId} ist abgelehnt. Die Begruendung ist erfasst.` }),
  });
}

/* ==========================================================================
   Roll back
   ========================================================================== */

export function proposeRollBack(roleId: string, taskKind: string): QualityProposal | null {
  const inForce = configurationInForce(roleId, taskKind);
  if (!inForce.approval) return null;
  const payload = {
    releaseId: inForce.approval.id,
    configurationId: inForce.approval.configurationId,
    restores: inForce.approval.supersedesConfigurationId,
  };
  return {
    payload,
    fingerprint: fingerprintConsoleChange("quality.roll-back", payload),
    lines: [
      {
        en: `The approval ${payload.releaseId} of ${payload.configurationId} is rolled back.`,
        de: `Die Genehmigung ${payload.releaseId} von ${payload.configurationId} wird zurueckgesetzt.`,
      },
      {
        en: `${payload.restores ?? "The code registry's released configuration"} is in force again.`,
        de: `${payload.restores ?? "Die freigegebene Konfiguration des Code-Verzeichnisses"} gilt wieder.`,
      },
    ],
  };
}

export async function rollBackConfiguration(
  roleId: string,
  taskKind: string,
  approval: ConsoleApprovalInput,
): Promise<ConsoleActionResult<{ restored: string | null }>> {
  const proposal = proposeRollBack(roleId, taskKind);
  return governConsoleAction({
    actionId: "quality.roll-back",
    target: { kind: "ai-configuration-release", id: String(proposal?.payload.releaseId ?? `${roleId}:${taskKind}`) },
    payload: proposal?.payload ?? { roleId, taskKind },
    approval,
    summary: {
      en: `Rolled back the configuration approval for ${roleId} ${taskKind}.`,
      de: `Konfigurationsgenehmigung fuer ${roleId} ${taskKind} zurueckgesetzt.`,
    },
    rule: () =>
      proposal
        ? null
        : {
            en: "No console approval is in force for this role and task, so there is nothing to roll back.",
            de: "Fuer diese Rolle und Aufgabe gilt keine Genehmigung aus der Konsole, es gibt daher nichts zurueckzusetzen.",
          },
    execute: ({ actor, at, rationale }) => {
      const releaseId = String(proposal?.payload.releaseId ?? "");
      const restored = (proposal?.payload.restores as string | null) ?? null;
      const rolledBack = recordConfigurationRollback(releaseId, { at, byLabel: actor.label, reason: rationale, restoredConfigurationId: restored });
      if (!rolledBack) throw new Error(`The approval ${releaseId} could not be rolled back.`);
      return { restored };
    },
    success: (value) => ({
      en: `Rolled back. ${value.restored ?? "The code registry's released configuration"} is in force again.`,
      de: `Zurueckgesetzt. ${value.restored ?? "Die freigegebene Konfiguration des Code-Verzeichnisses"} gilt wieder.`,
    }),
  });
}
