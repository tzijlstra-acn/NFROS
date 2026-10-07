/**
 * Product Owner Console: Quality, Integrations and Feedback (plan 7.5, 7.6,
 * 7.8), against a real migrated and seeded temporary database.
 *
 * What these tests hold:
 *   - an evaluation run is recorded with a result per case, and the stored
 *     counts agree with the cases;
 *   - the safe-mode run grades the product's own reviewed responses and
 *     records the rest as not run, never as passes;
 *   - a configuration cannot be released while a mandatory evaluation fails,
 *     enforced on the server whatever the form showed, and approval and roll
 *     back move the configuration in force;
 *   - Pause writes really stops outbox dispatch for that connector (no
 *     attempt reaches the target, the command stays queued, a retry and the
 *     drain send nothing), and Resume delivers on the original key;
 *   - Retry re-dispatches a dead letter through the dispatcher and closes it;
 *   - the diagnostic bundle holds no credential;
 *   - feedback is submitted from the workday and triaged and linked, with the
 *     owner assignment needing its own authority;
 *   - every console action checks the acting persona's scope.
 *
 * The acting persona is mocked: there is no request, so no session cookie.
 * The checks themselves are the real ones (`governConsoleAction`).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";

/* The imports below pull in most of the product; a loaded machine needs longer than the default. */
vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 });

const acting = vi.hoisted(() => ({ personaId: null as string | null }));

vi.mock("@/features/product/persona/acting", async () => {
  const permissions = await import("@/features/product/permissions");
  const identityFor = (personaId: string | null) => {
    const persona = personaId && permissions.isProductPersonaId(personaId) ? permissions.PRODUCT_PERSONAS[personaId] : null;
    return {
      source: persona ? "demonstration-persona" : "none",
      persona,
      userId: persona?.demoUserId ?? null,
      displayName: persona?.label.en ?? null,
      scopes: persona ? persona.scopes : null,
      productMode: "demonstration",
      switchingAllowed: true,
    };
  };
  return {
    readActingConsoleIdentity: async () => identityFor(acting.personaId),
    actingIdentityFromSession: () => identityFor(acting.personaId),
    actingLabel: (identity: { persona: { label: { en: string } } | null }) =>
      identity.persona ? `${identity.persona.label.en} (demonstration persona)` : "nobody",
  };
});

const CANDIDATE = "AICFG-RCSA-STAGE-PREP-002";
const RELEASED = "AICFG-RCSA-STAGE-PREP-001";
const DECISION_ID = "DEC-2026-0772";

let seedScenario: typeof import("@/db/seed/run").seedScenario;
let ids: typeof import("@/integrations/seed");
let runtime: typeof import("@/integrations/runtime/IntegrationRuntime");
let simulated: typeof import("@/integrations/connectors/simulated");
let state: typeof import("@/scenario/engine/state");
let grantApproval: typeof import("@/scenario/engine/decide").grantApproval;
let fingerprintPayload: typeof import("@/server/security/authority").fingerprintPayload;
let quality: typeof import("@/features/product/quality/api");
let qualityOps: typeof import("@/features/product/quality/operations");
let harness: typeof import("@/features/product/quality/harness");
let evaluations: typeof import("@/db/repositories/ai-evaluations");
let integrationOps: typeof import("@/features/product/integrations/operations");
let diagnostics: typeof import("@/features/product/integrations/diagnostics");
let feedback: typeof import("@/features/product/feedback/operations");
let productFeedback: typeof import("@/db/repositories/product-feedback");

beforeAll(async () => {
  createTemporaryDatabase("os-console-quality");
  ({ seedScenario } = await import("@/db/seed/run"));
  ids = await import("@/integrations/seed");
  runtime = await import("@/integrations/runtime/IntegrationRuntime");
  simulated = await import("@/integrations/connectors/simulated");
  state = await import("@/scenario/engine/state");
  ({ grantApproval } = await import("@/scenario/engine/decide"));
  ({ fingerprintPayload } = await import("@/server/security/authority"));
  quality = await import("@/features/product/quality/api");
  qualityOps = await import("@/features/product/quality/operations");
  harness = await import("@/features/product/quality/harness");
  evaluations = await import("@/db/repositories/ai-evaluations");
  integrationOps = await import("@/features/product/integrations/operations");
  diagnostics = await import("@/features/product/integrations/diagnostics");
  feedback = await import("@/features/product/feedback/operations");
  productFeedback = await import("@/db/repositories/product-feedback");
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
  ids.seedIntegrations();
  simulated.resetExternalStore();
  simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, true);
  state.switchRole("rcsa");
  acting.personaId = null;
});

const approval = (fingerprint: string) => ({
  reviewedFingerprint: fingerprint,
  rationale: "Reviewed the evaluation evidence myself.",
  rationaleConfirmed: true,
});

/* ==========================================================================
   Quality
   ========================================================================== */

describe("running an evaluation", () => {
  it("records a structural run with one result per case and counts that agree", () => {
    const result = quality.runEvaluation({ configurationId: RELEASED, mode: "structural", triggeredBy: { label: "test", userId: null } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cases = evaluations.getEvaluationCaseResults(result.run.id);
    const expected = harness.casesForConfiguration({ roleId: "rcsa" }, harness.loadEvaluationCases());
    expect(cases).toHaveLength(expected.length);
    expect(result.run.totalCases).toBe(expected.length);
    expect(result.run.passed + result.run.failed + result.run.notRun).toBe(expected.length);
    expect(result.run.status).toBe("completed");
    expect(cases.every((entry) => entry.latencyMs === null && entry.costUsd === null)).toBe(true);
    expect(cases.some((entry) => entry.mandatory)).toBe(true);
    /* The structural graders only. */
    expect(new Set(cases.flatMap((entry) => entry.graderResults.map((grader) => grader.grader)))).toEqual(
      new Set(["schema", "authority", "jurisdiction"]),
    );
  });

  it("grades the product's own safe-mode answers and records uncovered cases as not run", () => {
    const result = quality.runEvaluation({ configurationId: RELEASED, mode: "grounding", triggeredBy: { label: "test", userId: null } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cases = evaluations.getEvaluationCaseResults(result.run.id);
    const graded = cases.filter((entry) => entry.status !== "not-run");
    expect(graded.length).toBeGreaterThan(0);
    expect(result.run.notRun).toBeGreaterThan(0);
    for (const entry of cases.filter((row) => row.status === "not-run")) {
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.output).toBeNull();
    }
    for (const entry of graded) {
      expect(entry.graderResults.map((grader) => grader.grader)).toContain("grounding");
      expect((entry.output as { source?: string } | null)?.source).toMatch(/authority-gate|reviewed-answer/);
    }
    /* A failed case is inspectable: its reason names the grader. */
    const failed = cases.find((entry) => entry.status === "failed");
    if (failed) expect(failed.reason).toMatch(/^[a-z-]+: /);
  });
});

describe("the evaluation release gate", () => {
  it("blocks a candidate with no evaluation, and passes it after a clean run", () => {
    expect(quality.releaseBlockedByEvaluation(CANDIDATE).blocked).toBe(true);
    quality.runEvaluation({ configurationId: CANDIDATE, mode: "structural", triggeredBy: { label: "test", userId: null } });
    expect(quality.releaseBlockedByEvaluation(CANDIDATE).blocked).toBe(false);
  });

  it("blocks release while a mandatory case fails, and the server refuses the approval", async () => {
    /* Make the authority cases fail: an output that proposes the prohibited action. */
    quality.runEvaluation({
      configurationId: CANDIDATE,
      mode: "structural",
      triggeredBy: { label: "test", userId: null },
      outputOverride: (testCase) =>
        testCase.expectedAuthorityBehavior?.mustReturnBlockedPart
          ? { parts: [{ kind: "proposed-action", text: "Recorded the rating.", meta: { toolName: "record-risk-rating" } }] }
          : null,
    });
    const gate = quality.releaseBlockedByEvaluation(CANDIDATE);
    expect(gate.blocked).toBe(true);
    expect(gate.reasons[0]?.en).toMatch(/mandatory case\(s\) failed/);

    acting.personaId = "ai-quality-owner";
    const proposal = qualityOps.proposeApproveCandidate(CANDIDATE);
    expect(proposal).not.toBeNull();
    const result = await qualityOps.approveCandidate(CANDIDATE, approval(proposal?.fingerprint ?? ""));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("rule");
    expect(evaluations.listConfigurationReleases({ roleId: "rcsa" })).toHaveLength(0);
    expect(quality.configurationInForce("rcsa", "stage-preparation").configuration?.id).toBe(RELEASED);

    /* A later passing run of the same mode clears it; a structural pass cannot mask a safe-mode failure. */
    quality.runEvaluation({ configurationId: CANDIDATE, mode: "structural", triggeredBy: { label: "test", userId: null } });
    expect(quality.releaseBlockedByEvaluation(CANDIDATE).blocked).toBe(false);
    quality.runEvaluation({
      configurationId: CANDIDATE,
      mode: "grounding",
      triggeredBy: { label: "test", userId: null },
      outputOverride: (testCase) =>
        testCase.expectedAuthorityBehavior?.mustReturnBlockedPart
          ? { parts: [{ kind: "execution-receipt", text: "The rating was recorded.", meta: { toolName: "record-risk-rating" } }] }
          : null,
    });
    expect(quality.releaseBlockedByEvaluation(CANDIDATE).blocked).toBe(true);
  });

  it("fails a TPRM mandatory case that applies DORA to the Swiss entity", () => {
    const result = quality.runEvaluation({
      configurationId: "AICFG-TPRM-STAGE-PREP-001",
      mode: "structural",
      triggeredBy: { label: "test", userId: null },
      outputOverride: (testCase) =>
        testCase.jurisdictionConstraints
          ? { parts: [{ kind: "answer", text: "DORA applies to ARC-CH, the Swiss entity, under DORA article 28." }] }
          : null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.run.mandatoryFailed).toBeGreaterThan(0);
    expect(quality.releaseBlockedByEvaluation("AICFG-TPRM-STAGE-PREP-001").blocked).toBe(true);
  });

  it("approves a candidate that passed, puts it in force, and rolls it back", async () => {
    quality.runEvaluation({ configurationId: CANDIDATE, mode: "structural", triggeredBy: { label: "test", userId: null } });
    acting.personaId = "ai-quality-owner";
    const proposal = qualityOps.proposeApproveCandidate(CANDIDATE);
    const approved = await qualityOps.approveCandidate(CANDIDATE, approval(proposal?.fingerprint ?? ""));
    expect(approved.ok).toBe(true);
    expect(quality.configurationInForce("rcsa", "stage-preparation").configuration?.id).toBe(CANDIDATE);

    const rollback = qualityOps.proposeRollBack("rcsa", "stage-preparation");
    const rolled = await qualityOps.rollBackConfiguration("rcsa", "stage-preparation", approval(rollback?.fingerprint ?? ""));
    expect(rolled.ok).toBe(true);
    expect(quality.configurationInForce("rcsa", "stage-preparation").configuration?.id).toBe(RELEASED);
  });

  it("refuses an approval whose evidence moved after review", async () => {
    quality.runEvaluation({ configurationId: CANDIDATE, mode: "structural", triggeredBy: { label: "test", userId: null } });
    acting.personaId = "ai-quality-owner";
    const stale = qualityOps.proposeApproveCandidate(CANDIDATE);
    quality.runEvaluation({ configurationId: CANDIDATE, mode: "grounding", triggeredBy: { label: "test", userId: null } });
    const result = await qualityOps.approveCandidate(CANDIDATE, approval(stale?.fingerprint ?? ""));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("approval-payload-mismatch");
  });

  it("checks the persona: an Integration Owner cannot run, approve or reject", async () => {
    acting.personaId = "integration-owner";
    const run = await qualityOps.governedRunEvaluation(RELEASED, "structural");
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.code).toBe("missing-scope");
    const reject = await qualityOps.rejectCandidate(CANDIDATE, "Not good enough for release yet.");
    expect(reject.ok).toBe(false);
    acting.personaId = null;
    const nobody = await qualityOps.governedRunEvaluation(RELEASED, "structural");
    expect(nobody.ok).toBe(false);
    if (!nobody.ok) expect(nobody.code).toBe("no-persona");
    expect(evaluations.listEvaluationRuns({})).toHaveLength(0);
  });
});

/* ==========================================================================
   Integrations
   ========================================================================== */

function assessmentPayload(): Record<string, unknown> {
  return {
    decisionId: DECISION_ID,
    assessmentId: "ASM-PAY-2026-Q3",
    residualRisk: "high",
    conclusion: "The payment repair control is partially effective.",
  };
}

async function dispatchToGrc() {
  const scenario = state.requireScenarioState();
  const payload = assessmentPayload();
  const approvalId = grantApproval({
    decisionId: DECISION_ID,
    toolName: "updateAssessment",
    payloadFingerprint: fingerprintPayload("updateAssessment", payload),
    rationale: "I own this conclusion.",
    rationaleConfirmed: true,
  });
  return runtime.dispatchCommand(
    {
      runId: scenario.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "updateAssessment",
      toolName: "updateAssessment",
      actingUserId: "P-003",
      roleId: "rcsa",
      actorKind: "human",
      autonomyLevel: scenario.autonomyLevel,
      approvalId,
      decisionId: DECISION_ID,
      sourceCanonicalType: "Assessment",
      sourceCanonicalId: "ASM-PAY-2026-Q3",
      targetExternalType: "grc.assessment",
      payload,
      intentStatement: "Create an assessment version",
      atMoment: scenario.currentMoment,
    },
    { jitter: runtime.noJitter },
  );
}

describe("pausing writes", () => {
  it("really stops outbox dispatch for the connector, and resuming delivers on the original key", async () => {
    acting.personaId = "integration-owner";
    const pause = integrationOps.proposeWriteState(ids.CI_GRC, true);
    const paused = await integrationOps.setConnectorWritesPaused(ids.CI_GRC, true, approval(pause?.fingerprint ?? ""));
    expect(paused.ok).toBe(true);
    expect(runtime.isWritePaused(ids.CI_GRC)).toBe(true);

    const result = await dispatchToGrc();
    expect(result.acknowledged).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.deadLettered).toBe(false);
    expect(runtime.findCommandById(result.commandId ?? "")?.status).toBe("queued");
    expect(simulated.countWriteAttempts(simulated.GRC_SYSTEM_KEY)).toBe(0);
    expect(rowCount("external_execution_receipts")).toBe(0);

    /* Neither the drain nor a retry sends anything while paused. */
    await runtime.drainOutbox(state.requireScenarioState().runId);
    const retry = await runtime.retryCommand(result.commandId ?? "");
    expect(retry.denialCode).toBe("writes-paused");
    const governedRetry = await integrationOps.retryIntegrationCommand(result.commandId ?? "");
    expect(governedRetry.ok).toBe(false);
    expect(simulated.countWriteAttempts(simulated.GRC_SYSTEM_KEY)).toBe(0);
    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(0);

    const key = runtime.findCommandById(result.commandId ?? "")?.idempotencyKey;
    const resume = integrationOps.proposeWriteState(ids.CI_GRC, false);
    const resumed = await integrationOps.setConnectorWritesPaused(ids.CI_GRC, false, approval(resume?.fingerprint ?? ""));
    expect(resumed.ok).toBe(true);
    if (resumed.ok) expect(resumed.value.delivered).toBe(1);
    const command = runtime.findCommandById(result.commandId ?? "");
    expect(command?.status).toBe("acknowledged");
    expect(command?.idempotencyKey).toBe(key);
    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(1);
  });

  it("needs the authority and an approval", async () => {
    acting.personaId = "ai-quality-owner";
    const pause = integrationOps.proposeWriteState(ids.CI_GRC, true);
    const refused = await integrationOps.setConnectorWritesPaused(ids.CI_GRC, true, approval(pause?.fingerprint ?? ""));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe("missing-scope");
    acting.personaId = "integration-owner";
    const unapproved = await integrationOps.setConnectorWritesPaused(ids.CI_GRC, true, { reviewedFingerprint: "", rationale: "", rationaleConfirmed: false });
    expect(unapproved.ok).toBe(false);
    if (!unapproved.ok) expect(unapproved.code).toBe("approval-missing");
    expect(runtime.isWritePaused(ids.CI_GRC)).toBe(false);
  });
});

describe("retrying a command", () => {
  it("re-dispatches a dead letter through the dispatcher and closes it", async () => {
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, false);
    const failed = await dispatchToGrc();
    expect(failed.deadLettered).toBe(true);
    const runId = state.requireScenarioState().runId;
    expect(runtime.partitionDeadLetters(runId).open).toHaveLength(1);

    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, true);
    acting.personaId = "integration-owner";
    const retried = await integrationOps.retryIntegrationCommand(failed.commandId ?? "");
    expect(retried.ok).toBe(true);
    if (retried.ok) expect(retried.value.acknowledged).toBe(true);
    expect(runtime.partitionDeadLetters(runId).open).toHaveLength(0);
    expect(simulated.countExternalObjects(simulated.GRC_SYSTEM_KEY)).toBe(1);
    expect(rowCount("integration_commands")).toBe(1);
  });

  it("is refused for a persona without the integration authority", async () => {
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, false);
    const failed = await dispatchToGrc();
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, true);
    acting.personaId = "pilot-lead";
    const refused = await integrationOps.retryIntegrationCommand(failed.commandId ?? "");
    expect(refused.ok).toBe(false);
    expect(runtime.findCommandById(failed.commandId ?? "")?.status).toBe("dead-letter");
  });
});

describe("the diagnostic bundle", () => {
  it("carries connector states and no credential", async () => {
    const bundle = await diagnostics.buildDiagnosticBundle("test");
    const text = JSON.stringify(bundle);
    expect(text).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(text).not.toMatch(/OPENAI|api[_-]?key|password|bearer\s|secret_value/i);
    expect(Array.isArray(bundle.connectors)).toBe(true);
    expect((bundle.excluded as string[]).length).toBeGreaterThan(0);
  });
});

/* ==========================================================================
   Feedback
   ========================================================================== */

describe("the feedback inbox", () => {
  it("takes a submission from the workday and lets the product owner triage and link it", async () => {
    const submitted = feedback.submitWorkdayFeedback({
      kind: "workflow-friction",
      summary: "The evidence list jumps when a document is opened.",
      roleId: "rcsa",
      route: "/workday/rcsa/work",
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.item.submittedByUserId).toBe("P-003");

    acting.personaId = "platform-product-owner";
    const triaged = await feedback.triageFeedback(submitted.item.id, {
      status: "planned",
      severity: "medium",
      ownerLabel: "Role App Owner",
      featureKey: "evidence-list",
      roleAppId: "rcsa-cycle-assistant",
      stageId: "evidence-refresh",
      releaseVersion: "4.2.0",
      resolution: "",
    });
    expect(triaged.ok).toBe(true);
    const item = productFeedback.getProductFeedback(submitted.item.id);
    expect(item?.status).toBe("planned");
    expect(item?.stageId).toBe("evidence-refresh");
    expect(item?.ownerLabel).toBe("Role App Owner");
    expect(item?.releaseVersion).toBe("4.2.0");
  });

  it("refuses an owner change without the assign authority, and a stage of another app", async () => {
    const submitted = feedback.submitWorkdayFeedback({ kind: "data-issue", summary: "The supplier register shows an old date.", roleId: "tprm", route: null });
    if (!submitted.ok) throw new Error("submission failed");
    acting.personaId = "ai-quality-owner";
    const base = { status: "triaged", severity: null, featureKey: null, roleAppId: null, stageId: null, releaseVersion: null, resolution: "" };
    const owner = await feedback.triageFeedback(submitted.item.id, { ...base, ownerLabel: "Integration Owner" });
    expect(owner.ok).toBe(false);
    if (!owner.ok) expect(owner.code).toBe("missing-scope");
    const wrongStage = await feedback.triageFeedback(submitted.item.id, {
      ...base,
      ownerLabel: null,
      roleAppId: "tprm-third-party-onboarding",
      stageId: "evidence-refresh",
    });
    expect(wrongStage.ok).toBe(false);
    if (!wrongStage.ok) expect(wrongStage.code).toBe("rule");
  });

  it("rejects an unstructured submission", () => {
    const result = feedback.submitWorkdayFeedback({ kind: "chat-transcript", summary: "x", roleId: "rcsa" });
    expect(result.ok).toBe(false);
    expect(rowCount("product_feedback")).toBe(0);
  });
});
