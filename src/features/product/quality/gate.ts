/**
 * The evaluation release gate (plan 7.5: "A configuration cannot release
 * while mandatory evaluation fails").
 *
 * Pure over a configuration and its recorded runs, so the rule is tested
 * without a database and the console, the Role App lifecycle and the release
 * view all apply the same one. A configuration is blocked when:
 *
 *   1. no completed evaluation run is recorded for it;
 *   2. the latest completed run of any mode has a failed mandatory case. Each
 *      mode counts on its own, so a passing structural run cannot mask a
 *      mandatory failure the safe-mode run found;
 *   3. the latest completed run evaluated other identifying values (prompt
 *      version, model profile, output schema, suite) than the configuration
 *      now has: the evidence is for something else.
 *
 * A mandatory case that was not run is not a failure, and is reported beside
 * the verdict rather than hidden.
 */

import type { AIConfigurationVersion } from "@/ai/prompt-registry";
import type { AIEvaluationRun } from "@/db/repositories/ai-evaluations";
import type { Bilingual } from "@/features/product/permissions";

export interface EvaluationGateVerdict {
  configurationId: string;
  blocked: boolean;
  reasons: Bilingual[];
  /** The latest completed run of each mode, newest first. */
  latestByMode: AIEvaluationRun[];
}

type Identifying = Pick<
  AIConfigurationVersion,
  "id" | "promptVersion" | "modelProfileId" | "outputSchemaVersion" | "evaluationSuiteId"
>;

/** The latest completed run of each mode, newest first. Runs may come in any order. */
export function latestCompletedByMode(runs: readonly AIEvaluationRun[]): AIEvaluationRun[] {
  const sorted = runs
    .filter((run) => run.status === "completed")
    .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt) || b.id.localeCompare(a.id));
  const byMode = new Map<string, AIEvaluationRun>();
  for (const run of sorted) if (!byMode.has(run.mode)) byMode.set(run.mode, run);
  return [...byMode.values()];
}

export function evaluationGate(configuration: Identifying, runs: readonly AIEvaluationRun[]): EvaluationGateVerdict {
  const own = runs.filter((run) => run.configurationId === configuration.id);
  const latestByMode = latestCompletedByMode(own);
  const reasons: Bilingual[] = [];

  if (latestByMode.length === 0) {
    reasons.push({
      en: `No completed evaluation run is recorded for ${configuration.id}. Run an evaluation before it can be released.`,
      de: `Fuer ${configuration.id} ist kein abgeschlossener Evaluationslauf erfasst. Fuehren Sie eine Evaluation aus, bevor sie freigegeben werden kann.`,
    });
  }

  for (const run of latestByMode) {
    if (run.mandatoryFailed > 0) {
      reasons.push({
        en: `${run.mandatoryFailed} mandatory case(s) failed in the latest ${run.mode} run (${run.id}). A configuration cannot be released while a mandatory evaluation fails.`,
        de: `${run.mandatoryFailed} Pflichtfall bzw. Pflichtfaelle sind im letzten Lauf ${run.mode} (${run.id}) fehlgeschlagen. Eine Konfiguration kann nicht freigegeben werden, solange eine Pflichtevaluation fehlschlaegt.`,
      });
    }
  }

  const latest = latestByMode[0];
  if (latest) {
    const differs =
      latest.promptVersion !== configuration.promptVersion ||
      latest.modelProfileId !== configuration.modelProfileId ||
      latest.outputSchemaVersion !== configuration.outputSchemaVersion ||
      latest.evaluationSuiteId !== configuration.evaluationSuiteId;
    if (differs) {
      reasons.push({
        en: `The latest run (${latest.id}) evaluated different configuration values than ${configuration.id} now has. Run the evaluation again.`,
        de: `Der letzte Lauf (${latest.id}) hat andere Konfigurationswerte bewertet, als ${configuration.id} jetzt hat. Fuehren Sie die Evaluation erneut aus.`,
      });
    }
  }

  return { configurationId: configuration.id, blocked: reasons.length > 0, reasons, latestByMode };
}
