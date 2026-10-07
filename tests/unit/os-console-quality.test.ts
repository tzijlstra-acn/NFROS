/**
 * The pure parts of the AI quality console: the evaluation release gate and
 * the structural harness. No database.
 */

import { describe, expect, it } from "vitest";
import { evaluationGate, latestCompletedByMode } from "@/features/product/quality/gate";
import { isMandatoryCase, loadEvaluationCases, structuralEnvelope } from "@/features/product/quality/harness";
import { grade as gradeSchema } from "../../evals/graders/schema";
import { grade as gradeAuthority } from "../../evals/graders/authority";
import { grade as gradeJurisdiction } from "../../evals/graders/jurisdiction";
import type { AIEvaluationRun } from "@/db/repositories/ai-evaluations";

const CONFIG = {
  id: "AICFG-X",
  promptVersion: "v1.0",
  modelProfileId: "profile-a",
  outputSchemaVersion: "envelope-v1",
  evaluationSuiteId: "EVAL-X",
};

function run(partial: Partial<AIEvaluationRun>): AIEvaluationRun {
  return {
    id: "AER-1",
    configurationId: CONFIG.id,
    configurationStatus: "candidate",
    roleId: "rcsa",
    taskKind: "stage-preparation",
    promptVersion: CONFIG.promptVersion,
    modelProfileId: CONFIG.modelProfileId,
    outputSchemaVersion: CONFIG.outputSchemaVersion,
    evaluationSuiteId: CONFIG.evaluationSuiteId,
    roleAppVersionId: null,
    mode: "structural",
    status: "completed",
    totalCases: 10,
    passed: 10,
    failed: 0,
    notRun: 0,
    mandatoryFailed: 0,
    jobId: null,
    resultsPath: null,
    triggeredByLabel: "test",
    triggeredByUserId: null,
    startedAt: "2026-10-06T10:00:00.000Z",
    completedAt: "2026-10-06T10:00:01.000Z",
    errorRedacted: null,
    ...partial,
  };
}

describe("the evaluation release gate", () => {
  it("blocks with no completed run", () => {
    expect(evaluationGate(CONFIG, []).blocked).toBe(true);
    expect(evaluationGate(CONFIG, [run({ status: "running" })]).blocked).toBe(true);
  });

  it("passes a clean run of the configuration's own values", () => {
    expect(evaluationGate(CONFIG, [run({})]).blocked).toBe(false);
  });

  it("blocks while the latest run of any mode has a mandatory failure", () => {
    const structuralPass = run({ id: "AER-2", completedAt: "2026-10-06T11:00:00.000Z" });
    const safeFail = run({ id: "AER-1", mode: "grounding", mandatoryFailed: 1, failed: 1 });
    const verdict = evaluationGate(CONFIG, [structuralPass, safeFail]);
    expect(verdict.blocked).toBe(true);
    expect(verdict.reasons.some((reason) => reason.en.includes("mandatory"))).toBe(true);
    expect(latestCompletedByMode([structuralPass, safeFail]).map((entry) => entry.id)).toEqual(["AER-2", "AER-1"]);
  });

  it("blocks when the evidence is for other configuration values", () => {
    expect(evaluationGate(CONFIG, [run({ modelProfileId: "profile-b" })]).blocked).toBe(true);
  });

  it("ignores runs of other configurations", () => {
    expect(evaluationGate(CONFIG, [run({ configurationId: "AICFG-Y" })]).blocked).toBe(true);
  });
});

describe("the structural harness", () => {
  const cases = loadEvaluationCases();

  it("loads every case file", () => {
    expect(cases.length).toBeGreaterThanOrEqual(60);
  });

  it("grades every case as npm run eval:structural does: all pass", () => {
    for (const testCase of cases) {
      const envelope = structuralEnvelope(testCase);
      for (const result of [gradeSchema(testCase, envelope), gradeAuthority(testCase, envelope), gradeJurisdiction(testCase, envelope)]) {
        expect(result.passed, `${testCase.id} ${result.grader}: ${result.details}`).toBe(true);
      }
    }
  });

  it("marks authority and jurisdiction cases as mandatory", () => {
    const mandatory = cases.filter(isMandatoryCase);
    expect(mandatory.some((testCase) => testCase.task === "authority-check")).toBe(true);
    expect(mandatory.some((testCase) => testCase.jurisdictionConstraints !== undefined)).toBe(true);
    expect(mandatory.length).toBeLessThan(cases.length);
  });
});
