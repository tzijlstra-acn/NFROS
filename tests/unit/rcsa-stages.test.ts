/**
 * RCSA Cycle Assistant stages: the contract of all eight and the pure rules
 * behind them.
 *
 * The integration suite (`tests/integration/rcsa-stages.test.ts`) drives the
 * eight stages against a real database. These tests hold the parts that need
 * none: that every stage is executable with every key it names registered,
 * that every material judgment is a human task or a decision, that the rating
 * consequences are arithmetic on the group matrix, and the small date and
 * text rules the stages rely on.
 */

import { describe, expect, it } from "vitest";
import "@/features/process/implementations";
import { RCSA_CYCLE_PROCESS } from "@/role-apps/rcsa/definition";
import {
  getArtifactBuilder,
  getCompletionCheck,
  getCompletionHook,
  getDecisionRules,
  getPreparer,
  getTaskForm,
  missingImplementations,
} from "@/features/process/registry";
import { APPETITE_CEILING, consequenceFor, governanceEffect, GROUP_OUTSIDE_FROM_SCORE, isControlEffectiveness, outsideFromScore, positionText } from "@/role-apps/rcsa/matrix";
import { offCyclePeriod, periodForCycle } from "@/role-apps/rcsa/stages/scope-trigger";
import { capturedActions } from "@/role-apps/rcsa/stages/challenge-workshop";
import { actionsInternals } from "@/role-apps/rcsa/stages/actions-approval";
import { RUN_DECISION_HOOK_STAGES, runDecisionId } from "@/role-apps/rcsa/stages/run-decisions";
import { chosenPosition, clip, RCSA_PROCESS_ID } from "@/role-apps/rcsa/stages/shared";
import type { Bilingual } from "@/role-apps/contracts";

/* Built from code points, so this file itself carries none of the characters it forbids. */
const UMLAUT = new RegExp(`[${[0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf].map((code) => String.fromCharCode(code)).join("")}]`);
const DASHES = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`);

const STAGE_IDS = [
  "scope-trigger",
  "evidence-refresh",
  "risk-control-change",
  "first-line-input",
  "challenge-workshop",
  "rating-appetite",
  "actions-approval",
  "monitoring-reassessment",
];

function stage(id: string) {
  const found = RCSA_CYCLE_PROCESS.stages.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
}

/** Every bilingual string of a value, found by walking it. */
function bilinguals(value: unknown, into: Bilingual[] = []): Bilingual[] {
  if (Array.isArray(value)) {
    for (const item of value) bilinguals(item, into);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.en === "string" && typeof record.de === "string") into.push({ en: record.en, de: record.de });
    for (const item of Object.values(record)) bilinguals(item, into);
  }
  return into;
}

describe("the RCSA stage contracts", () => {
  it("implements all eight stages, in order, with every key they name registered", () => {
    expect(RCSA_CYCLE_PROCESS.stages.map((item) => item.id)).toEqual(STAGE_IDS);
    for (const item of RCSA_CYCLE_PROCESS.stages) {
      expect(item.implementation.implemented, item.id).toBe(true);
      expect(missingImplementations(item), item.id).toEqual([]);
    }
  });

  it("gives every stage a human task, a decision, a preparation and a stage record", () => {
    for (const item of RCSA_CYCLE_PROCESS.stages) {
      expect(item.humanTasks.length, `${item.id} has a human task`).toBeGreaterThan(0);
      expect(item.decisions.length, `${item.id} has a decision`).toBeGreaterThan(0);
      expect(item.aiJobs.length, `${item.id} has an AI job`).toBeGreaterThan(0);
      for (const job of item.aiJobs) expect(getPreparer(job.preparer), `${item.id} preparer ${job.preparer}`).toBeDefined();
      for (const task of item.humanTasks) expect(getTaskForm(task.form), `${item.id} form ${task.form}`).toBeDefined();
      const records = item.artifacts.filter((artifact) => artifact.producedBy === "stage-completion");
      expect(records.length, `${item.id} writes a stage record`).toBeGreaterThan(0);
      for (const artifact of records) expect(getArtifactBuilder(artifact.builder), `${item.id} builder ${artifact.builder}`).toBeDefined();
    }
  });

  it("makes every material judgment a recorded human input or decision, and every task required", () => {
    for (const item of RCSA_CYCLE_PROCESS.stages) {
      for (const task of item.humanTasks) {
        expect(task.required, `${item.id}/${task.key} is required`).toBe(true);
        expect(item.completionCriteria).toContainEqual(expect.objectContaining({ kind: "human-task-completed", taskKey: task.key }));
      }
      for (const decision of item.decisions) {
        expect(item.completionCriteria.some((criterion) => criterion.kind === "decision-recorded" && criterion.decisionKey === decision.key)).toBe(true);
      }
      expect(item.approvalRequirements.some((approval) => approval.covers.kind === "stage-completion")).toBe(true);
    }
    /* The judgments plan section 5.1 names as material. Workshop sequencing is not one of them. */
    const material: Array<[string, string]> = [
      ["scope-trigger", "scope-and-trigger"],
      ["risk-control-change", "likelihood-inference"],
      ["challenge-workshop", "challenge-conclusion"],
      ["rating-appetite", "residual-and-appetite"],
      ["actions-approval", "action-plan"],
      ["monitoring-reassessment", "monitoring-plan"],
    ];
    for (const [stageId, key] of material) {
      expect(stage(stageId).decisions.find((decision) => decision.key === key)?.material, `${stageId}/${key}`).toBe(true);
    }
  });

  it("registers decision rules on every stage that owns a stage decision", () => {
    for (const item of RCSA_CYCLE_PROCESS.stages) {
      const owned = item.decisions.filter((decision) => decision.binding.kind === "stage-decision");
      if (owned.length > 0) expect(getDecisionRules(RCSA_PROCESS_ID, item.id), item.id).toBeDefined();
    }
  });

  it("gives every stage decision an option that holds the stage, so a person can always stop it", () => {
    for (const item of RCSA_CYCLE_PROCESS.stages) {
      for (const decision of item.decisions) {
        if (decision.binding.kind !== "stage-decision") continue;
        expect(decision.binding.options.some((option) => option.outcome === "hold"), `${item.id}/${decision.key}`).toBe(true);
        expect(item.blockingConditions).toContainEqual(expect.objectContaining({ kind: "decision-held", decisionKey: decision.key }));
      }
    }
  });

  it("routes every external change through the outbox and waits for the target system", () => {
    const external = RCSA_CYCLE_PROCESS.stages.flatMap((item) => item.tools.filter((tool) => tool.channel === "outbox").map((tool) => ({ item, tool })));
    expect(external.length).toBeGreaterThan(0);
    for (const { item, tool } of external) {
      expect(tool.connectorInstanceId, `${item.id}/${tool.key}`).not.toBeNull();
      expect(tool.deliveredWhen, `${item.id}/${tool.key}`).toBe("acknowledged");
      expect(item.blockingConditions).toContainEqual(expect.objectContaining({ kind: "external-command-failed", toolKey: tool.key }));
    }
  });

  it("waits for the workshop minutes through a registered check, and starts the reassessment through a completion hook", () => {
    const workshop = stage("challenge-workshop");
    expect(workshop.completionCriteria).toContainEqual(expect.objectContaining({ kind: "check", checkKey: "rcsa.workshop-minutes-confirmed" }));
    expect(getCompletionCheck("rcsa.workshop-minutes-confirmed")).toBeDefined();
    expect(getCompletionHook(RCSA_PROCESS_ID, "monitoring-reassessment")).toBeDefined();
    /* The other hooks present a later run's own decision for the stage that opens next. */
    for (const id of STAGE_IDS.filter((value) => value !== "monitoring-reassessment")) {
      expect(getCompletionHook(RCSA_PROCESS_ID, id) !== undefined, id).toBe(RUN_DECISION_HOOK_STAGES.includes(id));
    }
  });

  it("binds the five Q4 decisions, and presents a later run's own decision before each stage that binds one", () => {
    const seeded = RCSA_CYCLE_PROCESS.stages.flatMap((item) => item.decisions.flatMap((decision) => (decision.binding.kind === "seeded-decision" ? [decision.binding.decisionId] : [])));
    expect(seeded).toEqual(["DEC-2026-0771", "DEC-2026-0744", "DEC-2026-0745", "DEC-2026-0772", "DEC-2026-0782"]);
    /* Stages 1, 2, 3, 4 and 6 are followed by a stage that binds one. */
    expect(RUN_DECISION_HOOK_STAGES).toEqual(["scope-trigger", "evidence-refresh", "risk-control-change", "first-line-input", "rating-appetite"]);
    /* No stage refuses a later run any more: the entry check that stopped the reassessment is gone. */
    for (const item of RCSA_CYCLE_PROCESS.stages) {
      expect([...item.entryCriteria, ...item.completionCriteria].some((criterion) => criterion.kind === "check" && criterion.checkKey === "rcsa.cycle-decisions"), item.id).toBe(false);
    }
    expect(getCompletionCheck("rcsa.cycle-decisions")).toBeUndefined();
    expect(runDecisionId("RUN-RCSA-OFFCYCLE-X-001", stage("evidence-refresh"))).toBe("DEC-RCSA-OFFCYCLE-X-001-S2");
  });

  it("reads a chosen option by its position, which a run's own copy of the decision keeps", () => {
    const options = [{ id: "DEC-A-O01" }, { id: "DEC-A-O02" }, { id: "DEC-A-O03" }];
    expect(chosenPosition({ chosenOptionId: "DEC-A-O02", options })).toBe(2);
    expect(chosenPosition({ chosenOptionId: "DEC-2026-0771-O3", options: [{ id: "DEC-2026-0771-O1" }, { id: "DEC-2026-0771-O2" }, { id: "DEC-2026-0771-O3" }] })).toBe(3);
    expect(chosenPosition({ chosenOptionId: null, options })).toBeNull();
    expect(chosenPosition(undefined)).toBeNull();
  });

  it("states every stage's responsibility and outcome in German too", () => {
    for (const item of RCSA_CYCLE_PROCESS.stages) {
      expect(item.humanResponsibilityDe, `${item.id} responsibility`).toBeTruthy();
      expect(item.outcomeDe, `${item.id} outcome`).toBeTruthy();
      expect(`${item.humanResponsibilityDe} ${item.outcomeDe} ${item.nameDe}`).not.toMatch(UMLAUT);
    }
  });

  it("writes the stage contracts to the copy rules: ASCII German, no dashes as punctuation", () => {
    const strings = bilinguals(RCSA_CYCLE_PROCESS.stages);
    expect(strings.length).toBeGreaterThan(100);
    for (const text of strings) {
      expect(text.de, text.en).not.toMatch(UMLAUT);
      expect(`${text.en} ${text.de}`).not.toMatch(DASHES);
      expect(`${text.en} ${text.de}`).not.toMatch(/ -- /);
    }
  });
});

describe("the rating consequences", () => {
  it("reads the appetite boundary from the statement, defaulting to the group boundary", () => {
    expect(outsideFromScore("A residual score of 10 or above is outside appetite.")).toBe(10);
    expect(outsideFromScore("Tolerance: a residual score ceiling of 9 applies.")).toBe(10);
    expect(outsideFromScore("A residual score of 15 or above is outside appetite.")).toBe(15);
    expect(outsideFromScore("No boundary stated.")).toBe(GROUP_OUTSIDE_FROM_SCORE);
    expect(APPETITE_CEILING).toBe("medium");
  });

  it("computes the residual from the inherent position and the effectiveness on the group matrix", () => {
    const partially = consequenceFor({ inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: "partially-effective" });
    expect(partially).toMatchObject({ residualLikelihood: 3, residualImpact: 4, score: 12, rating: "high", appetite: "outside", departsFromMethodology: false, boundaryMismatch: false });
    const largely = consequenceFor({ inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: "largely-effective" });
    expect(largely).toMatchObject({ residualLikelihood: 2, residualImpact: 4, score: 8, rating: "medium", appetite: "at-limit" });
    const fully = consequenceFor({ inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: "fully-effective" });
    expect(fully).toMatchObject({ residualLikelihood: 1, residualImpact: 3, score: 3, rating: "low", appetite: "within" });
  });

  it("marks a residual judgment that departs from the methodology, and clamps it to the scale", () => {
    const departed = consequenceFor({ inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: "partially-effective", residualLikelihood: 2 });
    expect(departed).toMatchObject({ residualLikelihood: 2, residualImpact: 4, score: 8, rating: "medium", departsFromMethodology: true });
    const clamped = consequenceFor({ inherentLikelihood: 5, inherentImpact: 5, controlEffectiveness: "not-effective", residualLikelihood: 9, residualImpact: 0 });
    expect(clamped.residualLikelihood).toBe(5);
    expect(clamped.residualImpact).toBe(1);
  });

  it("says when a statement's boundary and the matrix ceiling disagree", () => {
    const agrees = consequenceFor({ inherentLikelihood: 3, inherentImpact: 3, controlEffectiveness: "not-effective", outsideFrom: 10 });
    expect(agrees).toMatchObject({ score: 9, rating: "medium", appetite: "at-limit", boundaryMismatch: false });
    const disagrees = consequenceFor({ inherentLikelihood: 3, inherentImpact: 3, controlEffectiveness: "not-effective", outsideFrom: 8 });
    expect(disagrees.boundaryMismatch).toBe(true);
  });

  it("states the governance effect as policy text, and writes the position in both languages", () => {
    expect(governanceEffect("outside").en).toContain("Monitoring alone does not discharge it");
    expect(governanceEffect("within").de).not.toMatch(UMLAUT);
    const position = consequenceFor({ inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: "partially-effective" });
    expect(positionText(position, "en")).toBe("3 x 4 = 12 of 25, High");
    expect(positionText(position, "de")).toBe("3 x 4 = 12 von 25, Hoch");
  });

  it("accepts only assessed effectiveness values", () => {
    expect(isControlEffectiveness("partially-effective")).toBe(true);
    expect(isControlEffectiveness("not-assessed")).toBe(false);
    expect(isControlEffectiveness("effective")).toBe(false);
  });
});

describe("the stage rules that need no database", () => {
  it("assesses the quarter before the cycle", () => {
    expect(periodForCycle("Q4 2026")).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(periodForCycle("Q1 2027")).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(periodForCycle("Q2 2024")).toEqual({ from: "2024-01-01", to: "2024-03-31" });
    expect(periodForCycle("Off-cycle")).toBeNull();
  });

  it("assesses an event-driven reassessment from the end of the period it reassesses to the scenario day", () => {
    expect(offCyclePeriod("Q4 2026", "2026-10-06", "2026-10-06")).toEqual({ from: "2026-10-01", to: "2026-10-06" });
    expect(offCyclePeriod("", "2026-09-15", "2026-10-06")).toEqual({ from: "2026-09-15", to: "2026-10-06" });
    expect(offCyclePeriod("", "", "2026-10-06")).toEqual({ from: "2026-10-06", to: "2026-10-06" });
  });

  it("captures the actions a workshop record requests, and nothing else", () => {
    const record =
      "Session closed 11:58. RSK-0211 Q4 residual rating: not agreed. Ten remaining risk lines reviewed; comment text requested from line owners by 13.10.2026. Action requested of P-002: obtain the RepairDesk tenant configuration.";
    expect(capturedActions(record)).toEqual([
      "Ten remaining risk lines reviewed; comment text requested from line owners by 13.10.2026.",
      "Action requested of P-002: obtain the RepairDesk tenant configuration.",
    ]);
    expect(capturedActions("Session closed. Nothing was agreed.")).toEqual([]);
  });

  it("shortens a source text at a sentence end, never inside a word", () => {
    const text = "The first sentence is short. The second sentence is a good deal longer than the first one is.";
    expect(clip(text, 200)).toBe(text);
    expect(clip(text, 60)).toBe("The first sentence is short.");
    expect(clip("one two three four five six seven eight nine ten", 20)).toBe("one two three four.");
  });

  it("proposes due dates at a month end", () => {
    expect(actionsInternals.monthEndAfter("2026-10-06", 84)).toBe("2026-12-31");
    expect(actionsInternals.monthEndAfter("2026-01-31", 1)).toBe("2026-02-28");
  });
});
