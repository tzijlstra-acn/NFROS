/**
 * Export evidence (plan 7.5): one evaluation run as a document an auditor
 * can keep.
 *
 * The run as recorded (configuration values, mode, counts, mandatory
 * failures), every case with its grader verdicts and graded output, the
 * release decisions taken on the configuration, and the gate verdict as it
 * stands now. Built from the records only; it carries no credential, no
 * prompt text and no model output beyond what the run graded, which in the
 * console's modes is synthetic or reviewed content.
 *
 * Server only.
 */

import { PRODUCT_IDENTITY, PRODUCT_RELEASE } from "@/product/release";
import { getEvaluationCaseResults, getEvaluationRun, listConfigurationReleases } from "@/db/repositories/ai-evaluations";
import { latestEvaluationStatus } from "./api";

export interface EvaluationEvidenceDocument {
  kind: "ai-evaluation-evidence";
  product: string;
  release: string;
  exportedAt: string;
  exportedBy: string;
  disclosures: string[];
  run: NonNullable<ReturnType<typeof getEvaluationRun>>;
  cases: ReturnType<typeof getEvaluationCaseResults>;
  decisions: ReturnType<typeof listConfigurationReleases>;
  gate: { blocked: boolean; reasons: string[] };
}

export function buildEvaluationEvidence(runId: string, exportedBy: string): EvaluationEvidenceDocument | null {
  const run = getEvaluationRun(runId);
  if (!run) return null;
  const status = latestEvaluationStatus(run.configurationId);
  return {
    kind: "ai-evaluation-evidence",
    product: PRODUCT_IDENTITY.name,
    release: PRODUCT_RELEASE.version,
    exportedAt: new Date().toISOString(),
    exportedBy,
    disclosures: [
      "Synthetic institution and data.",
      "Illustrative regulatory context, not legal advice.",
      run.mode === "structural"
        ? "Structural run: synthetic test envelopes built from each case were graded. No model output was graded."
        : "Safe-mode run: the product's reviewed responses and authority gate decisions were graded. No model was called; cases no reviewed response covers are recorded as not run.",
    ],
    run,
    cases: getEvaluationCaseResults(run.id),
    decisions: listConfigurationReleases({ roleId: run.roleId, taskKind: run.taskKind }).filter(
      (decision) => decision.configurationId === run.configurationId,
    ),
    gate: { blocked: status.verdict.blocked, reasons: status.verdict.reasons.map((reason) => reason.en) },
  };
}
