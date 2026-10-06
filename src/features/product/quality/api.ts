/**
 * The AI quality evaluation API (plan 7.5), for the Quality page and for the
 * other console workstreams.
 *
 * Three functions other workstreams call; the handoff
 * (`docs/handoffs/os-excellence-os-console-quality.md`) documents them:
 *
 *   runEvaluation(input)                 grades one configuration in the
 *                                        structural (Offline) or grounding
 *                                        (Safe) mode and records the run and
 *                                        every case result. Never calls a model.
 *   latestEvaluationStatus(id)           the latest completed run of each mode,
 *                                        a status reading, and the gate verdict.
 *   releaseBlockedByEvaluation(ids)      whether any of the configurations is
 *                                        blocked from release, and why.
 *
 * Permission is the caller's: the Quality page's server actions go through
 * `governConsoleAction` with the AI Quality Owner's scopes, and the Role App
 * lifecycle calls these inside its own governed action. Nothing here checks a
 * persona, so nothing here can be reached from a browser except through one.
 *
 * Also here, because the release decision needs them: which configuration is
 * in force for a role and task, and which candidates are open.
 *
 * Server only.
 */

import { randomUUID } from "node:crypto";
import { AI_CONFIGURATION_REGISTRY, type AIConfigurationVersion } from "@/ai/prompt-registry";
import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type AutonomyLevel } from "@/db/schema/core";
import {
  completeEvaluationRun,
  createEvaluationRun,
  getApprovedConfigurationInForce,
  getEvaluationRun,
  listConfigurationReleases,
  listEvaluationRuns,
  recordEvaluationCaseResults,
  type AIConfigurationRelease,
  type AIEvaluationRun,
} from "@/db/repositories/ai-evaluations";
import { getScenarioState } from "@/scenario/engine/state";
import { reading, type StatusReading } from "@/product/status/vocabulary";
import type { Bilingual } from "@/features/product/permissions";
import { evaluationGate, latestCompletedByMode, type EvaluationGateVerdict } from "./gate";
import { gradeConfiguration, type ConsoleEvaluationMode, type HarnessOptions } from "./harness";

/* ==========================================================================
   Configurations
   ========================================================================== */

/** Every configuration in the code registry that can be evaluated: released and candidate. */
export function listEvaluableConfigurations(): AIConfigurationVersion[] {
  return AI_CONFIGURATION_REGISTRY.filter((entry) => entry.status === "released" || entry.status === "candidate");
}

export function getConfiguration(configurationId: string): AIConfigurationVersion | undefined {
  return AI_CONFIGURATION_REGISTRY.find((entry) => entry.id === configurationId);
}

export interface ConfigurationInForce {
  configuration: AIConfigurationVersion | undefined;
  /** The console approval that put it in force; null when the code registry's released entry is in force. */
  approval: AIConfigurationRelease | null;
}

/**
 * The configuration in force for a role and task: the latest console
 * approval not rolled back, or the code registry's released entry.
 */
export function configurationInForce(roleId: string, taskKind: string): ConfigurationInForce {
  const approval = getApprovedConfigurationInForce(roleId, taskKind) ?? null;
  if (approval) return { configuration: getConfiguration(approval.configurationId), approval };
  return {
    configuration: AI_CONFIGURATION_REGISTRY.find(
      (entry) => entry.roleId === roleId && entry.taskKind === taskKind && entry.status === "released",
    ),
    approval: null,
  };
}

/** The candidate configurations for a role and task that are not in force, with their latest decision. */
export function openCandidates(roleId: string, taskKind: string): Array<{
  configuration: AIConfigurationVersion;
  latestDecision: AIConfigurationRelease | null;
}> {
  const inForce = configurationInForce(roleId, taskKind).configuration?.id;
  const decisions = listConfigurationReleases({ roleId, taskKind });
  return AI_CONFIGURATION_REGISTRY.filter(
    (entry) => entry.roleId === roleId && entry.taskKind === taskKind && entry.status === "candidate" && entry.id !== inForce,
  ).map((configuration) => ({
    configuration,
    latestDecision: decisions.find((decision) => decision.configurationId === configuration.id) ?? null,
  }));
}

/* ==========================================================================
   Running an evaluation
   ========================================================================== */

export interface RunEvaluationInput {
  configurationId: string;
  mode: ConsoleEvaluationMode;
  triggeredBy: { label: string; userId: string | null };
  /** The Role App version the run belongs to, when the Role App lifecycle runs it. */
  roleAppVersionId?: string | null;
  /** For tests: see `HarnessOptions.outputOverride`. */
  outputOverride?: HarnessOptions["outputOverride"];
  at?: string;
}

export type RunEvaluationResult =
  | { ok: true; run: AIEvaluationRun }
  | { ok: false; reason: Bilingual };

function autonomyLevelNow(): AutonomyLevel {
  try {
    return getScenarioState()?.autonomyLevel ?? "act-with-approval";
  } catch {
    return "act-with-approval";
  }
}

/**
 * Grades one configuration and records the run with every case result, in
 * one transaction. The run's counts and `mandatory_failed` are recomputed
 * from the stored cases by the repository, so the summary cannot disagree
 * with the cases behind it.
 */
export function runEvaluation(input: RunEvaluationInput): RunEvaluationResult {
  const configuration = getConfiguration(input.configurationId);
  if (!configuration || (configuration.status !== "released" && configuration.status !== "candidate")) {
    return {
      ok: false,
      reason: {
        en: `There is no released or candidate configuration ${input.configurationId}.`,
        de: `Es gibt keine freigegebene oder Kandidatenkonfiguration ${input.configurationId}.`,
      },
    };
  }

  const state = (() => {
    try {
      return getScenarioState();
    } catch {
      return null;
    }
  })();
  const runId = state?.runId ?? DEFAULT_RUN_ID;
  const startedAt = input.at ?? new Date().toISOString();
  const evaluationRunId = `AER-${startedAt.slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

  const results = gradeConfiguration(configuration, {
    mode: input.mode,
    autonomyLevel: autonomyLevelNow(),
    runId,
    ...(input.outputOverride ? { outputOverride: input.outputOverride } : {}),
  });

  const write = getSqlite().transaction((): AIEvaluationRun | undefined => {
    createEvaluationRun({
      id: evaluationRunId,
      configurationId: configuration.id,
      configurationStatus: configuration.status === "candidate" ? "candidate" : "released",
      roleId: configuration.roleId,
      taskKind: configuration.taskKind,
      promptVersion: configuration.promptVersion,
      modelProfileId: configuration.modelProfileId,
      outputSchemaVersion: configuration.outputSchemaVersion,
      evaluationSuiteId: configuration.evaluationSuiteId,
      roleAppVersionId: input.roleAppVersionId ?? null,
      mode: input.mode,
      status: "running",
      triggeredByLabel: input.triggeredBy.label,
      triggeredByUserId: input.triggeredBy.userId,
      startedAt,
    });
    recordEvaluationCaseResults(
      evaluationRunId,
      results.map((result) => ({ ...result, id: `${evaluationRunId}-${result.caseId}` })),
    );
    return completeEvaluationRun(evaluationRunId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      resultsPath: null,
    });
  });

  const run = write();
  if (!run) {
    return { ok: false, reason: { en: "The evaluation run was not recorded.", de: "Der Evaluationslauf wurde nicht erfasst." } };
  }
  return { ok: true, run };
}

/* ==========================================================================
   Reading the status and the gate
   ========================================================================== */

export interface EvaluationStatus {
  configurationId: string;
  /** The latest completed run of each mode, newest first. */
  latestByMode: AIEvaluationRun[];
  latest: AIEvaluationRun | null;
  reading: StatusReading;
  verdict: EvaluationGateVerdict;
}

/** What one run proves, in the product status vocabulary. */
export function readingForRun(run: AIEvaluationRun | null): StatusReading {
  if (!run) {
    return reading(
      "not-verified",
      "No evaluation run is recorded for this configuration.",
      "Fuer diese Konfiguration ist kein Evaluationslauf erfasst.",
    );
  }
  const graded = run.passed + run.failed;
  if (run.failed > 0) {
    return reading(
      "not-verified",
      `${run.failed} of ${graded} graded cases failed in the ${run.mode} run, ${run.mandatoryFailed} of them mandatory.`,
      `${run.failed} von ${graded} bewerteten Faellen sind im Lauf ${run.mode} fehlgeschlagen, davon ${run.mandatoryFailed} Pflichtfaelle.`,
    );
  }
  if (run.mode === "structural") {
    return reading(
      "simulated",
      `${run.passed} of ${run.totalCases} cases passed against synthetic test envelopes. No model output was graded.`,
      `${run.passed} von ${run.totalCases} Faellen gegen synthetische Testhuellen bestanden. Es wurden keine Modellausgaben bewertet.`,
    );
  }
  return reading(
    "safe",
    `${graded} of ${run.totalCases} cases were graded against reviewed safe-mode responses and passed; ${run.notRun} need a model call and were not run.`,
    `${graded} von ${run.totalCases} Faellen wurden gegen gepruefte Antworten im sicheren Modus bewertet und bestanden; ${run.notRun} brauchen einen Modellaufruf und liefen nicht.`,
  );
}

export function latestEvaluationStatus(configurationId: string): EvaluationStatus {
  const configuration = getConfiguration(configurationId);
  const runs = listEvaluationRuns({ configurationId });
  const latestByMode = latestCompletedByMode(runs);
  const latest = latestByMode[0] ?? null;
  const verdict = configuration
    ? evaluationGate(configuration, runs)
    : {
        configurationId,
        blocked: true,
        reasons: [{ en: `There is no configuration ${configurationId}.`, de: `Es gibt keine Konfiguration ${configurationId}.` }],
        latestByMode,
      };
  return { configurationId, latestByMode, latest, reading: readingForRun(latest), verdict };
}

/**
 * Whether a release is blocked by evaluation. One configuration or several
 * (a Role App version depends on every configuration its stages use): the
 * release is blocked when any of them is.
 */
export function releaseBlockedByEvaluation(configurationIds: string | readonly string[]): {
  blocked: boolean;
  reasons: Bilingual[];
  verdicts: EvaluationGateVerdict[];
} {
  const ids = typeof configurationIds === "string" ? [configurationIds] : [...configurationIds];
  const verdicts = ids.map((id) => latestEvaluationStatus(id).verdict);
  return {
    blocked: verdicts.some((verdict) => verdict.blocked),
    reasons: verdicts.flatMap((verdict) => verdict.reasons),
    verdicts,
  };
}

export { getEvaluationRun };
