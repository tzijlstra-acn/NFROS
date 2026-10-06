/**
 * Process engine unit tests: the completion validator and the preparation
 * output validator.
 *
 * Both are pure functions, which is the point of them. The validator decides
 * whether Continue is enabled, whether the completion action proceeds and
 * whether the completion handler commits, so these tests are the proof that
 * Continue cannot bypass the criteria without needing a database or a
 * browser. The preparation validator is what every mode's output passes
 * through, so its refusals are tested on content, not only on shape.
 */

import { describe, expect, it } from "vitest";
import "@/features/process/implementations";
import { RCSA_CYCLE_PROCESS, RCSA_CYCLE_ASSISTANT } from "@/role-apps/rcsa/definition";
import { TPRM_ONBOARDING_PROCESS, THIRD_PARTY_ONBOARDING_APP } from "@/role-apps/tprm/definition";
import { evaluateBlocking, validateStage } from "@/features/process/validator";
import { missingImplementations } from "@/features/process/registry";
import { validatePreparation, stagePreparationJsonSchema } from "@/features/process/preparation-schema";
import type { DecisionState, LoadedSource, StageContext, ToolState } from "@/features/process/types";
import type { RoleProcessStage } from "@/role-apps/contracts";

function stage(process: typeof RCSA_CYCLE_PROCESS, id: string): RoleProcessStage {
  const found = process.stages.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
}

function source(spec: RoleProcessStage["requiredSources"][number], necessity: "required" | "helpful", status: LoadedSource["status"] = "loaded"): LoadedSource {
  return {
    spec,
    necessity,
    status,
    result: { status, records: [], evidenceIds: [], asOf: null, note: null },
    connectorMode: "simulated",
    connectorName: null,
    unavailableReason: status === "unavailable" ? { en: "down", de: "ausgefallen" } : null,
  };
}

/** A context for TPRM Stage 4 with everything done unless overridden. */
function tprmContext(overrides: Partial<StageContext> = {}): StageContext {
  const evidenceReview = stage(TPRM_ONBOARDING_PROCESS, "evidence-review");
  const decisions: DecisionState[] = [
    {
      spec: evidenceReview.decisions[0]!,
      recordId: "TASK-1",
      status: "recorded",
      chosenOptionId: "gate-conditional",
      outcome: "advance",
      rationale: "Conditional pass.",
      decidedByUserId: "P-002",
      decidedAt: "2026-10-06T08:00:00.000Z",
      options: [],
      preparedPosition: null,
      uncertainty: null,
      revisable: false,
    },
  ];
  const tools: ToolState[] = evidenceReview.tools.map((tool) => ({
    key: tool.key,
    state: tool.channel === "local" ? "executed" : "acknowledged",
    satisfied: true,
    summary: null,
    commandId: null,
    receiptId: null,
    externalId: null,
    approvalId: null,
    auditEventId: null,
  }));
  return {
    runId: "run-001",
    state: {
      runId: "run-001",
      label: "",
      scenarioDate: "2026-10-06",
      currentMoment: "07:45",
      activeRoleId: "tprm",
      autonomyLevel: "act-with-approval",
      worldView: "future",
      language: "en",
      eventTriggered: false,
      seededAt: "",
    },
    mode: "safe",
    app: THIRD_PARTY_ONBOARDING_APP,
    process: TPRM_ONBOARDING_PROCESS,
    stage: evidenceReview,
    run: {
      id: "RUN-TPRM-VERIDIAN-2026",
      runId: "run-001",
      roleAppId: THIRD_PARTY_ONBOARDING_APP.id,
      roleId: "tprm",
      subjectKind: "supplier",
      subjectId: "TP-0099",
      currentStageId: "evidence-review",
      status: "in-progress",
      mode: "offline",
      startedAt: "",
      updatedAt: "",
      completedAt: null,
      blockedReason: null,
    },
    roleId: "tprm",
    actingUserId: "P-002",
    stageRun: {
      id: "STAGERUN-TPRM-4",
      runId: "run-001",
      roleAppRunId: "RUN-TPRM-VERIDIAN-2026",
      stageId: "evidence-review",
      status: "waiting-for-input",
      openedAt: "",
      completedAt: null,
      completedByUserId: null,
      aiOutputId: "ART-1",
      preparationJobId: "JOB-1",
      completionApprovalId: null,
      completionRationale: null,
    },
    completedStageIds: ["request-and-intake", "classification-and-criticality", "tailored-due-diligence"],
    tasks: [
      {
        id: "TASK-D",
        runId: "run-001",
        stageRunId: "STAGERUN-TPRM-4",
        taskKey: "task:evidence-dispositions",
        taskKind: "human-review",
        label: "Evidence dispositions",
        status: "completed",
        requiredForCompletion: true,
        createdAt: "",
        completedAt: "",
        completedByUserId: "P-002",
        approvalId: null,
        statusReason: null,
        output: "{}",
      },
    ],
    artifacts: [],
    job: null,
    sources: [
      ...evidenceReview.requiredSources.map((spec) => source(spec, "required")),
      ...evidenceReview.helpfulSources.map((spec) => source(spec, "helpful")),
    ],
    inputs: [],
    preparation: {
      state: "completed",
      jobId: "JOB-1",
      attempts: 1,
      reason: null,
      mode: "safe",
      source: "cache",
      output: null,
      artifactId: "ART-1",
      completedAt: "",
    },
    decisions,
    tools,
    ...overrides,
  };
}

describe("the stage contracts", () => {
  it("declares every element of the contract on all sixteen stages", () => {
    for (const process of [RCSA_CYCLE_PROCESS, TPRM_ONBOARDING_PROCESS]) {
      expect(process.stages).toHaveLength(8);
      for (const item of process.stages) {
        expect(item.completionCriteria.length, `${item.id} has completion criteria`).toBeGreaterThan(0);
        expect(item.aiJobs.length, `${item.id} has an AI job`).toBeGreaterThan(0);
        expect(item.blockingConditions.some((condition) => condition.kind === "stage-not-implemented")).toBe(true);
        expect(item.approvalRequirements.some((approval) => approval.covers.kind === "stage-completion")).toBe(true);
        if (!item.implementation.implemented) {
          expect(item.implementation.reason, `${item.id} states why it is not implemented`).not.toBeNull();
        }
      }
    }
  });

  it("chains every stage to the next by nextStageId and entry criteria", () => {
    for (const process of [RCSA_CYCLE_PROCESS, TPRM_ONBOARDING_PROCESS]) {
      process.stages.forEach((item, index) => {
        const next = process.stages[index + 1];
        expect(item.nextStageId).toBe(next?.id ?? null);
        if (next) {
          expect(next.entryCriteria).toContainEqual(expect.objectContaining({ kind: "stage-completed", stageId: item.id }));
        }
      });
    }
  });

  it("implements the reference stages and every stage it claims, with every key they name registered", () => {
    const implemented = [...RCSA_CYCLE_PROCESS.stages, ...TPRM_ONBOARDING_PROCESS.stages].filter((item) => item.implementation.implemented);
    expect(implemented.map((item) => item.id)).toEqual(expect.arrayContaining(["evidence-refresh", "evidence-review"]));
    for (const item of implemented) expect(missingImplementations(item), item.id).toEqual([]);
  });

  it("implements all eight Third-Party Onboarding stages", () => {
    expect(TPRM_ONBOARDING_PROCESS.stages.filter((item) => !item.implementation.implemented).map((item) => item.id)).toEqual([]);
  });

  it("names a completion tool on both installed apps", () => {
    expect(RCSA_CYCLE_ASSISTANT.stageCompletionToolName).toBe("completeRcsaStage");
    expect(THIRD_PARTY_ONBOARDING_APP.stageCompletionToolName).toBe("completeOnboardingStage");
  });
});

describe("the completion validator", () => {
  it("allows completion only when every applicable criterion is met", () => {
    const result = validateStage(tprmContext());
    expect(result.canComplete).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("refuses when the human task is not recorded, and says why", () => {
    const result = validateStage(tprmContext({ tasks: [] }));
    expect(result.canComplete).toBe(false);
    expect(result.reasons.map((reason) => reason.en).join(" ")).toContain("Evidence dispositions is not recorded");
  });

  it("refuses while the AI preparation is not completed", () => {
    const base = tprmContext();
    const result = validateStage({ ...base, preparation: { ...base.preparation, state: "running", artifactId: null } });
    expect(result.canComplete).toBe(false);
  });

  it("refuses when the entry criterion (the previous stage) is not met", () => {
    const result = validateStage(tprmContext({ completedStageIds: [] }));
    expect(result.entryMet).toBe(false);
    expect(result.canComplete).toBe(false);
  });

  it("requires the conditional tools only when the conditional option was chosen", () => {
    const base = tprmContext();
    const pass: DecisionState = { ...base.decisions[0]!, chosenOptionId: "gate-pass" };
    const unsatisfied = base.tools.map((tool) => ({ ...tool, state: "proposed" as const, satisfied: false }));

    const conditional = validateStage({ ...base, tools: unsatisfied });
    expect(conditional.canComplete).toBe(false);

    const passed = validateStage({ ...base, decisions: [pass], tools: unsatisfied.map((tool) => ({ ...tool, state: "not-applicable" as const })) });
    expect(passed.canComplete).toBe(true);
    expect(passed.completion.filter((result) => result.kind === "tool-executed").every((result) => !result.applies)).toBe(true);
  });

  it("treats a queued outbox command as not yet delivered", () => {
    const base = tprmContext();
    const tools = base.tools.map((tool) => (tool.key === "register-conditions" ? { ...tool, state: "queued" as const, satisfied: false } : tool));
    const result = validateStage({ ...base, tools });
    expect(result.canComplete).toBe(false);
    expect(result.reasons.map((reason) => reason.en).join(" ")).toContain("in the outbox");
  });

  it("blocks a held decision even when every criterion is met", () => {
    const base = tprmContext();
    const hold: DecisionState = { ...base.decisions[0]!, chosenOptionId: "gate-hold", outcome: "hold", revisable: true };
    const result = validateStage({ ...base, decisions: [hold] });
    expect(evaluateBlocking({ ...base, decisions: [hold] }).find((item) => item.kind === "decision-held")?.active).toBe(true);
    expect(result.canComplete).toBe(false);
  });

  it("blocks when a required source is unavailable", () => {
    const base = tprmContext();
    const sources = base.sources.map((item, index) => (index === 0 ? { ...item, status: "unavailable" as const } : item));
    const result = validateStage({ ...base, sources });
    expect(result.canComplete).toBe(false);
    expect(result.blocking.find((item) => item.kind === "required-source-unavailable")?.active).toBe(true);
  });

  it("refuses a stage that is already completed", () => {
    const base = tprmContext();
    const result = validateStage({ ...base, stageRun: { ...base.stageRun!, status: "completed" } });
    expect(result.canComplete).toBe(false);
  });

  it("refuses a stage that is not executable in this build", () => {
    const base = tprmContext();
    // Every onboarding stage is executable now, so the refusal is shown on a stage whose contract says it is not.
    const specialist: RoleProcessStage = {
      ...stage(TPRM_ONBOARDING_PROCESS, "specialist-reviews"),
      implementation: { implemented: false, reason: { en: "Not in this build.", de: "Nicht in diesem Build." }, owner: null },
    };
    const result = validateStage({ ...base, stage: specialist, completedStageIds: [...base.completedStageIds, "evidence-review"] });
    expect(result.canComplete).toBe(false);
    expect(result.blocking.find((item) => item.kind === "stage-not-implemented")?.active).toBe(true);
  });
});

describe("the preparation output validator", () => {
  const evidenceReview = stage(TPRM_ONBOARDING_PROCESS, "evidence-review");
  const known = new Set(["EVD-OB-0099-01", "EVD-OB-0099-04"]);
  const items = new Set(["EVD-OB-0099-01"]);

  function candidate(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: "stage-preparation-v1",
      summary: { en: "Summary.", de: "Zusammenfassung." },
      findings: [{ sourceKey: "due-diligence-evidence", statement: { en: "A fact.", de: "Ein Fakt." }, evidenceIds: ["EVD-OB-0099-01"], basis: "verified-fact" }],
      inferences: [],
      contradictions: [],
      gaps: [],
      itemAssessments: [{ itemId: "EVD-OB-0099-01", proposedDisposition: "accept", note: { en: "Accept.", de: "Akzeptieren." } }],
      proposals: [],
      recommendedOptionId: "gate-pass",
      limitations: [],
      ...overrides,
    };
  }

  it("accepts a well formed, grounded output", () => {
    expect(validatePreparation(candidate(), { stage: evidenceReview, knownEvidenceIds: known, knownItemIds: items }).ok).toBe(true);
  });

  it("rejects an evidence identifier no loaded source returned", () => {
    const result = validatePreparation(
      candidate({ findings: [{ sourceKey: "due-diligence-evidence", statement: { en: "A fact.", de: "Ein Fakt." }, evidenceIds: ["EVD-INVENTED"], basis: "verified-fact" }] }),
      { stage: evidenceReview, knownEvidenceIds: known, knownItemIds: items },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a source, tool, option or item the stage does not have", () => {
    const context = { stage: evidenceReview, knownEvidenceIds: known, knownItemIds: items };
    expect(validatePreparation(candidate({ recommendedOptionId: "gate-wave-through" }), context).ok).toBe(false);
    expect(validatePreparation(candidate({ proposals: [{ toolKey: "send-email", rationale: { en: "x", de: "x" } }] }), context).ok).toBe(false);
    expect(validatePreparation(candidate({ itemAssessments: [{ itemId: "EVD-OTHER", proposedDisposition: "accept", note: { en: "x", de: "x" } }] }), context).ok).toBe(false);
  });

  it("enforces the copy rules on every string, in both languages", () => {
    const context = { stage: evidenceReview, knownEvidenceIds: known, knownItemIds: items };
    expect(validatePreparation(candidate({ summary: { en: `A ${String.fromCharCode(0x2014)} B.`, de: "A B." } }), context).ok).toBe(false);
    expect(validatePreparation(candidate({ summary: { en: "Fine.", de: `Pr${String.fromCharCode(0xfc)}fung.` } }), context).ok).toBe(false);
    expect(validatePreparation(candidate({ summary: { en: "The LLM said so.", de: "Gut." } }), context).ok).toBe(false);
  });

  it("rejects the wrong shape before reading content", () => {
    const result = validatePreparation({ schemaVersion: "v0" }, { stage: evidenceReview, knownEvidenceIds: known, knownItemIds: items });
    expect(result.ok).toBe(false);
  });

  it("publishes a strict JSON schema for live mode", () => {
    const schema = stagePreparationJsonSchema();
    expect(schema["additionalProperties"]).toBe(false);
    expect(schema["required"]).toEqual(expect.arrayContaining(["summary", "findings", "gaps", "recommendedOptionId"]));
  });
});
