/**
 * Third-Party Onboarding stages: unit tests.
 *
 * The contract of every stage is checked for internal consistency (a
 * criterion names a task, decision or tool the stage declares; a tool's
 * proposal condition names a real option; every approval covers a real
 * tool), every key is registered, and the regulatory framing rule is held:
 * DORA and the EBA guidelines for the EU entities only, FINMA for ARC-CH
 * only, every statement with the disclaimer, and DORA never said to apply to
 * the Swiss entity.
 */

import { describe, expect, it } from "vitest";
import "@/features/process/implementations";
import { TPRM_ONBOARDING_PROCESS } from "@/role-apps/tprm/definition";
import { missingImplementations } from "@/features/process/registry";
import { ILLUSTRATIVE, regulatoryContext, withRegulatoryNote, orderEntities, type EntityRef } from "@/role-apps/tprm/stages/shared";
import { validatePreparation } from "@/features/process/preparation-schema";

const EU: EntityRef[] = [
  { id: "ARC-DE", name: "Arcadia Bank AG", bloc: "eu" },
  { id: "ARC-AT", name: "Arcadia Bank Oesterreich AG", bloc: "eu" },
];
const CH: EntityRef = { id: "ARC-CH", name: "Arcadia Bank Schweiz AG", bloc: "ch" };

describe.each(TPRM_ONBOARDING_PROCESS.stages.map((stage) => [stage.sequence, stage.id, stage] as const))("Stage %i %s", (_sequence, _id, stage) => {
  it("is implemented, with every key it names registered", () => {
    expect(stage.implementation.implemented).toBe(true);
    expect(missingImplementations(stage)).toEqual([]);
  });

  it("names only tasks, decisions and tools it declares in its criteria and blocking conditions", () => {
    const tasks = new Set(stage.humanTasks.map((task) => task.key));
    const decisions = new Map(stage.decisions.map((decision) => [decision.key, decision]));
    const tools = new Set(stage.tools.map((tool) => tool.key));
    for (const criterion of stage.completionCriteria) {
      if (criterion.kind === "human-task-completed") expect(tasks.has(criterion.taskKey), criterion.taskKey).toBe(true);
      if (criterion.kind === "decision-recorded") expect(decisions.has(criterion.decisionKey), criterion.decisionKey).toBe(true);
      if (criterion.kind === "tool-executed") expect(tools.has(criterion.toolKey), criterion.toolKey).toBe(true);
      if (criterion.when) {
        const decision = decisions.get(criterion.when.decisionKey);
        expect(decision, criterion.when.decisionKey).toBeDefined();
        const options = decision?.binding.kind === "stage-decision" ? decision.binding.options.map((option) => option.id) : [];
        for (const optionId of criterion.when.optionIds) expect(options).toContain(optionId);
      }
    }
    for (const condition of stage.blockingConditions) {
      if (condition.kind === "decision-held") expect(decisions.has(condition.decisionKey)).toBe(true);
      if (condition.kind === "external-command-failed") expect(tools.has(condition.toolKey)).toBe(true);
    }
    // Every human task and every decision is a completion criterion.
    for (const key of tasks) expect(stage.completionCriteria.some((criterion) => criterion.kind === "human-task-completed" && criterion.taskKey === key)).toBe(true);
    for (const key of decisions.keys()) expect(stage.completionCriteria.some((criterion) => criterion.kind === "decision-recorded" && criterion.decisionKey === key)).toBe(true);
  });

  it("proposes each tool on a real option, and every approval covers a real tool", () => {
    const tools = new Set(stage.tools.map((tool) => tool.key));
    for (const tool of stage.tools) {
      if (tool.proposeWhen === "always") continue;
      const decision = stage.decisions.find((candidate) => candidate.key === (tool.proposeWhen as { decisionKey: string }).decisionKey);
      expect(decision, tool.key).toBeDefined();
      const options = decision?.binding.kind === "stage-decision" ? decision.binding.options.map((option) => option.id) : [];
      for (const optionId of tool.proposeWhen.optionIds) expect(options, tool.key).toContain(optionId);
      if (tool.channel === "outbox") {
        expect(tool.connectorInstanceId).toBe("CI-GRC-SIM");
        expect(tool.targetExternalType).toMatch(/^grc\./);
      }
    }
    for (const approval of stage.approvalRequirements) {
      if (approval.covers.kind === "tool") expect(tools.has(approval.covers.toolKey), approval.key).toBe(true);
    }
    expect(stage.approvalRequirements.some((approval) => approval.covers.kind === "stage-completion")).toBe(true);
  });

  it("has one AI job validated against the shared schema, and one stage record", () => {
    expect(stage.aiJobs).toHaveLength(1);
    expect(stage.aiJobs[0]?.outputSchema).toBe("stage-preparation-v1");
    expect(stage.artifacts.filter((artifact) => artifact.producedBy === "stage-completion")).toHaveLength(1);
  });
});

describe("the regulatory framing", () => {
  it("names DORA and the EBA guidelines for the EU entities only, with the disclaimer", () => {
    for (const topic of ["classification", "contract", "monitoring"] as const) {
      const [eu] = regulatoryContext(EU, topic);
      expect(eu?.en).toMatch(/DORA/);
      expect(eu?.en).toContain("ARC-DE and ARC-AT");
      expect(eu?.en).not.toContain("ARC-CH");
      expect(eu?.en).toContain(ILLUSTRATIVE.en);
      expect(eu?.de).toContain(ILLUSTRATIVE.de);
      expect(eu?.en).not.toMatch(/FINMA/);
    }
  });

  it("names FINMA for ARC-CH only and never says DORA applies to it", () => {
    for (const topic of ["classification", "contract", "monitoring"] as const) {
      const statements = regulatoryContext([CH], topic);
      expect(statements).toHaveLength(1);
      const [ch] = statements;
      expect(ch?.en).toMatch(/FINMA/);
      expect(ch?.en).toContain(ILLUSTRATIVE.en);
      expect(ch?.en).not.toMatch(/DORA (applies|is applied|framework applies)/);
      if (ch?.en.includes("DORA")) expect(ch.en).toContain("is not the one applied to ARC-CH");
    }
  });

  it("frames a mixed scope once per bloc, in the group's entity order", () => {
    const statements = regulatoryContext([CH, ...EU], "classification");
    expect(statements).toHaveLength(2);
    expect(statements[0]?.en).toContain("ARC-DE and ARC-AT");
    expect(statements[1]?.en).toContain("ARC-CH");
    expect(orderEntities(["ARC-CH", "ARC-AT", "ARC-DE", "ARC-AT"])).toEqual(["ARC-DE", "ARC-AT", "ARC-CH"]);
  });

  it("adds the disclaimer to a quoted condition that names a framework, once", () => {
    const quoted = "Before ARC-CH joins, the arrangement is assessed under the FINMA outsourcing framework.";
    expect(withRegulatoryNote(quoted, "en")).toBe(`${quoted} ${ILLUSTRATIVE.en}`);
    expect(withRegulatoryNote(`${quoted} ${ILLUSTRATIVE.en}`, "en")).toBe(`${quoted} ${ILLUSTRATIVE.en}`);
    expect(withRegulatoryNote("Print files by SFTP with PGP only.", "en")).toBe("Print files by SFTP with PGP only.");
  });

  it("passes the preparation validator's copy rules (no dashes as punctuation, no umlauts)", () => {
    const statements = [...regulatoryContext([...EU, CH], "classification"), ...regulatoryContext([...EU, CH], "contract"), ...regulatoryContext([...EU, CH], "monitoring")];
    const stage = TPRM_ONBOARDING_PROCESS.stages[1];
    if (!stage) throw new Error("stage 2 missing");
    const output = {
      schemaVersion: "stage-preparation-v1" as const,
      summary: { en: "Summary.", de: "Zusammenfassung." },
      findings: statements.map((statement) => ({ sourceKey: "arrangement-profile", statement, evidenceIds: [], basis: "approved-record" as const })),
      inferences: [],
      contradictions: [],
      gaps: [],
      itemAssessments: [],
      proposals: [],
      recommendedOptionId: null,
      limitations: [],
    };
    const result = validatePreparation(output, { stage, knownEvidenceIds: new Set(), knownItemIds: new Set() });
    expect(result.ok, result.ok ? "" : JSON.stringify(result.failures)).toBe(true);
  });
});
