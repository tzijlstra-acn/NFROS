/**
 * The Quality page's read model (plan 7.5).
 *
 * Everything the page shows, computed from records: the configuration in
 * force and the open candidates per role and task (code registry plus the
 * console's release decisions), the latest run of each mode with the failure
 * counts read from the graders that failed, and the people's signals (what
 * they did with suggestions, the 0006 lifecycle, and the structured AI
 * feedback they gave). A figure that was not measured is `measured: false`,
 * never a zero.
 *
 * Server only.
 */

import type { AIConfigurationVersion } from "@/ai/prompt-registry";
import type { RoleId } from "@/db/schema/core";
import { AI_FEEDBACK_KINDS, type AIFeedbackKind } from "@/db/schema/ai-partner";
import { SUGGESTION_DISPOSITIONS, type SuggestionDisposition } from "@/db/schema/live";
import {
  getEvaluationCaseResults,
  listConfigurationReleases,
  listEvaluationRuns,
  type AIConfigurationRelease,
  type AIEvaluationCaseResult,
  type AIEvaluationRun,
} from "@/db/repositories/ai-evaluations";
import { countSuggestionDispositions } from "@/db/repositories/suggestion-dispositions";
import { countAIFeedbackByKind } from "@/db/repositories/ai-feedback";
import { configurationInForce, latestEvaluationStatus, listEvaluableConfigurations, openCandidates, type EvaluationStatus } from "./api";
import { GRADERS_BY_MODE, type StoredCaseOutput } from "./harness";

/* ==========================================================================
   Signals from one run
   ========================================================================== */

export type Measured = { measured: false } | { measured: true; graded: number; failed: number };

export interface RunSignals {
  run: AIEvaluationRun;
  /** Cases graded (passed or failed) of the cases in the suite. */
  coverage: { graded: number; total: number; notRun: number };
  mandatory: { total: number; failed: number; notRun: number };
  grounding: Measured;
  citations: Measured;
  requiredSources: Measured;
  /** Outputs the authority gate refused, and authority grader failures. */
  authority: { refusedByGate: number; failures: number; graded: number };
  german: { cases: number; graded: number; failed: number; languageGraded: Measured };
  /** No model is called in the console's modes, so these are measured only when a case recorded them. */
  latency: { measured: false } | { measured: true; medianMs: number };
  cost: { measured: false } | { measured: true; totalUsd: number };
}

function graderSignal(cases: readonly AIEvaluationCaseResult[], grader: string, mode: string): Measured {
  if (!(GRADERS_BY_MODE as Record<string, readonly string[]>)[mode]?.includes(grader)) return { measured: false };
  const graded = cases.filter((entry) => entry.graderResults.some((result) => result.grader === grader));
  return {
    measured: true,
    graded: graded.length,
    failed: graded.filter((entry) => entry.graderResults.some((result) => result.grader === grader && !result.passed)).length,
  };
}

export function outputOf(entry: AIEvaluationCaseResult): StoredCaseOutput | null {
  const output = entry.output as unknown as StoredCaseOutput | null;
  return output && Array.isArray(output.parts) ? output : null;
}

export function signalsForRun(run: AIEvaluationRun, cases: readonly AIEvaluationCaseResult[]): RunSignals {
  const graded = cases.filter((entry) => entry.status !== "not-run");
  const german = cases.filter((entry) => entry.language === "de");
  const latencies = cases.map((entry) => entry.latencyMs).filter((value): value is number => typeof value === "number").sort((a, b) => a - b);
  const costs = cases.map((entry) => entry.costUsd).filter((value): value is number => typeof value === "number");
  const authorityCases = cases.filter((entry) => entry.graderResults.some((result) => result.grader === "authority"));

  return {
    run,
    coverage: { graded: graded.length, total: cases.length, notRun: cases.length - graded.length },
    mandatory: {
      total: cases.filter((entry) => entry.mandatory).length,
      failed: cases.filter((entry) => entry.mandatory && entry.status === "failed").length,
      notRun: cases.filter((entry) => entry.mandatory && entry.status === "not-run").length,
    },
    grounding: graderSignal(cases, "grounding", run.mode),
    citations: graderSignal(cases, "citations", run.mode),
    requiredSources: graderSignal(cases, "source-coverage", run.mode),
    authority: {
      refusedByGate: cases.filter((entry) => {
        const output = outputOf(entry);
        return output !== null && output.parts.some((part) => part.kind === "blocked" && part.meta?.["refusedBy"] === "authority-gate");
      }).length,
      failures: authorityCases.filter((entry) => entry.graderResults.some((result) => result.grader === "authority" && !result.passed)).length,
      graded: authorityCases.length,
    },
    german: {
      cases: german.length,
      graded: german.filter((entry) => entry.status !== "not-run").length,
      failed: german.filter((entry) => entry.status === "failed").length,
      languageGraded: graderSignal(german, "language", run.mode),
    },
    latency: latencies.length > 0 ? { measured: true, medianMs: latencies[Math.floor(latencies.length / 2)] ?? 0 } : { measured: false },
    cost: costs.length > 0 ? { measured: true, totalUsd: costs.reduce((sum, value) => sum + value, 0) } : { measured: false },
  };
}

/* ==========================================================================
   The page
   ========================================================================== */

export interface ConfigurationView {
  configuration: AIConfigurationVersion;
  role: "in-force" | "candidate";
  status: EvaluationStatus;
  signals: RunSignals[];
  latestDecision: AIConfigurationRelease | null;
  feedback: Record<AIFeedbackKind, number>;
}

export interface QualityGroup {
  roleId: string;
  taskKind: string;
  inForce: ConfigurationView | null;
  /** The console approval in force, when one is. */
  approval: AIConfigurationRelease | null;
  candidates: ConfigurationView[];
  decisions: AIConfigurationRelease[];
  recentRuns: AIEvaluationRun[];
}

export interface PeopleSignals {
  roleId: string;
  dispositions: Record<SuggestionDisposition, number>;
  feedback: Record<AIFeedbackKind, number>;
}

function viewFor(configuration: AIConfigurationVersion, role: ConfigurationView["role"], latestDecision: AIConfigurationRelease | null): ConfigurationView {
  const status = latestEvaluationStatus(configuration.id);
  return {
    configuration,
    role,
    status,
    signals: status.latestByMode.map((run) => signalsForRun(run, getEvaluationCaseResults(run.id))),
    latestDecision,
    feedback: countAIFeedbackByKind({ configurationId: configuration.id }),
  };
}

export function readQualityGroups(): QualityGroup[] {
  const keys = new Map<string, { roleId: string; taskKind: string }>();
  for (const configuration of listEvaluableConfigurations()) {
    keys.set(`${configuration.roleId}:${configuration.taskKind}`, { roleId: configuration.roleId, taskKind: configuration.taskKind });
  }
  return [...keys.values()].map(({ roleId, taskKind }) => {
    const inForce = configurationInForce(roleId, taskKind);
    const decisions = listConfigurationReleases({ roleId, taskKind });
    const ids = new Set(
      listEvaluableConfigurations()
        .filter((entry) => entry.roleId === roleId && entry.taskKind === taskKind)
        .map((entry) => entry.id),
    );
    return {
      roleId,
      taskKind,
      inForce: inForce.configuration ? viewFor(inForce.configuration, "in-force", inForce.approval) : null,
      approval: inForce.approval,
      candidates: openCandidates(roleId, taskKind).map((entry) => viewFor(entry.configuration, "candidate", entry.latestDecision)),
      decisions,
      recentRuns: listEvaluationRuns({ roleId, taskKind, limit: 12 }).filter((run) => ids.has(run.configurationId)),
    };
  });
}

/** What people did with the AI's suggestions and said about its output, per role. Aggregates only. */
export function readPeopleSignals(roleIds: readonly string[]): PeopleSignals[] {
  return roleIds.map((roleId) => ({
    roleId,
    dispositions: countSuggestionDispositions({ roleId: roleId as RoleId }),
    feedback: countAIFeedbackByKind({ roleId: roleId as RoleId }),
  }));
}

export { AI_FEEDBACK_KINDS, SUGGESTION_DISPOSITIONS };
