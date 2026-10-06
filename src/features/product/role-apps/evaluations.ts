/**
 * A Role App version's evaluations (plan 7.2 "Run evaluations"; plan 7.5).
 *
 * A Role App version depends on the AI configurations its stages prepare
 * with (`evaluations.configurationIds` in its manifest). Evaluating the
 * version means one evaluation run per configuration, recorded in
 * `ai_evaluation_runs` with the version's id, and "no release while
 * mandatory evaluation fails" reads `mandatory_failed` on those runs.
 *
 * Running an evaluation belongs to the AI quality workstream
 * (os-console-quality), which builds the evaluation service on the Quality
 * page. This module only asks whether that service is connected, and reads
 * what it recorded. Until it is connected, "Run evaluations" is Unavailable
 * and says so; nothing here fabricates a run, a pass or a score.
 *
 * Server only.
 */

import { listEvaluationRuns, type AIEvaluationRun } from "@/db/repositories/ai-evaluations";
import type { RoleAppVersion } from "@/db/repositories/role-app-release";
import type { Bilingual } from "../permissions";

export interface EvaluationCapability {
  available: boolean;
  reason: Bilingual;
}

/**
 * Whether the evaluation service can run a Role App version's evaluations.
 *
 * The seam the quality workstream connects: when its service exists, this
 * returns available and `startVersionEvaluations` calls it. See the
 * os-console-core handoff for the expected signature.
 */
export function roleAppEvaluationCapability(): EvaluationCapability {
  return {
    available: false,
    reason: {
      en: "Unavailable: the AI quality evaluation service is not connected to Role App versions yet. Evaluations recorded on the Quality page for this version appear here.",
      de: "Nicht verfuegbar: Der Evaluationsdienst der KI-Qualitaet ist noch nicht mit Rollen-App-Versionen verbunden. Auf der Seite Qualitaet fuer diese Version erfasste Evaluationen erscheinen hier.",
    },
  };
}

export type EvaluationVerdict =
  | { kind: "no-configurations"; runs: AIEvaluationRun[] }
  | { kind: "not-evaluated"; missing: string[]; runs: AIEvaluationRun[] }
  | { kind: "running"; runs: AIEvaluationRun[] }
  | { kind: "failed"; mandatoryFailed: number; runs: AIEvaluationRun[] }
  | { kind: "passed"; runs: AIEvaluationRun[] };

/** The evaluation runs recorded for a version, newest first. */
export function evaluationRunsForVersion(versionId: string): AIEvaluationRun[] {
  try {
    return listEvaluationRuns({}).filter((run) => run.roleAppVersionId === versionId);
  } catch {
    return [];
  }
}

/**
 * What a version's evaluations say. Pure over the runs, so the rule is
 * testable: every configuration the version depends on needs a completed run
 * for this version, and no completed run may have a failed mandatory case.
 */
export function evaluationVerdict(version: Pick<RoleAppVersion, "evaluations">, runs: AIEvaluationRun[]): EvaluationVerdict {
  const configurations = version.evaluations.configurationIds;
  if (configurations.length === 0) return { kind: "no-configurations", runs };
  const latest = new Map<string, AIEvaluationRun>();
  for (const run of runs) {
    if (!latest.has(run.configurationId)) latest.set(run.configurationId, run);
  }
  const mandatoryFailed = [...latest.values()]
    .filter((run) => run.status === "completed")
    .reduce((sum, run) => sum + run.mandatoryFailed, 0);
  if (mandatoryFailed > 0) return { kind: "failed", mandatoryFailed, runs };
  if ([...latest.values()].some((run) => run.status === "queued" || run.status === "running")) return { kind: "running", runs };
  const missing = configurations.filter((id) => latest.get(id)?.status !== "completed");
  if (missing.length > 0) return { kind: "not-evaluated", missing, runs };
  return { kind: "passed", runs };
}

export function versionEvaluationVerdict(version: RoleAppVersion): EvaluationVerdict {
  return evaluationVerdict(version, evaluationRunsForVersion(version.id));
}

/** The verdict in words, for the Role Apps page and for a refused approval. */
export function verdictReason(verdict: EvaluationVerdict): Bilingual {
  switch (verdict.kind) {
    case "no-configurations":
      return {
        en: "This version depends on no AI configuration, so there is nothing to evaluate.",
        de: "Diese Version haengt von keiner KI-Konfiguration ab, es gibt daher nichts zu evaluieren.",
      };
    case "not-evaluated":
      return {
        en: `No completed evaluation is recorded for this version (${verdict.missing.join(", ")}). A release needs one with no mandatory failure.`,
        de: `Fuer diese Version ist keine abgeschlossene Evaluation erfasst (${verdict.missing.join(", ")}). Ein Release braucht eine ohne Pflichtfehler.`,
      };
    case "running":
      return { en: "An evaluation of this version is still running.", de: "Eine Evaluation dieser Version laeuft noch." };
    case "failed":
      return {
        en: `${verdict.mandatoryFailed} mandatory evaluation case(s) failed for this version. It cannot be released while a mandatory evaluation fails.`,
        de: `${verdict.mandatoryFailed} Pflichtfall bzw. Pflichtfaelle der Evaluation sind fuer diese Version fehlgeschlagen. Sie kann nicht freigegeben werden, solange eine Pflichtevaluation fehlschlaegt.`,
      };
    case "passed":
      return {
        en: "Every AI configuration of this version has a completed evaluation with no mandatory failure.",
        de: "Jede KI-Konfiguration dieser Version hat eine abgeschlossene Evaluation ohne Pflichtfehler.",
      };
  }
}
