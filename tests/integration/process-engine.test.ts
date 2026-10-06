/**
 * Process engine integration tests.
 *
 * Against a real, freshly seeded SQLite database in the system temporary
 * directory. What these prove, in the plan's words (section 4.9 and the Wave
 * 2 exit criteria): the seeded day opens its current stages through the
 * engine; AI preparation is a durable job with the plan's states, and runs in
 * live, safe and offline modes through one validator; Continue does not
 * bypass the criteria; completion is transactional, gated by the authority
 * gate, and idempotent; external commands go through the outbox; state
 * survives a restart; and the event backbone records each event once.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";

type Orchestrator = typeof import("@/features/process/orchestrator");
type Backbone = typeof import("@/features/events/backbone");
type PreparationModel = import("@/features/process/preparation").PreparationModel;

let seed: () => void;
let engine: Orchestrator;
let backbone: Backbone;
let taskDefaults: typeof import("@/features/process/tasks").taskDefaults;
let getSqlite: typeof import("@/db/client").getSqlite;
let closeDb: typeof import("@/db/client").closeDb;
let executeTool: typeof import("@/agents/tools/runtime").executeTool;
let toolContextFor: typeof import("@/features/process/common").toolContextFor;
let leaseJobById: typeof import("@/db/repositories/background-jobs").leaseJobById;
let setAutonomyLevel: typeof import("@/scenario/engine/state").setAutonomyLevel;
let switchRole: typeof import("@/scenario/engine/state").switchRole;

const TPRM_RUN = "RUN-TPRM-VERIDIAN-2026";
const TPRM_STAGE = "evidence-review";
const RCSA_RUN = "RUN-RCSA-PAYOPS-Q4-2026";
const RCSA_STAGE = "evidence-refresh";

beforeAll(async () => {
  createTemporaryDatabase("process-engine");
  const seedModule = await import("@/db/seed/run");
  seed = () => seedModule.seedScenario();
  engine = await import("@/features/process/orchestrator");
  backbone = await import("@/features/events/backbone");
  ({ taskDefaults } = await import("@/features/process/tasks"));
  ({ getSqlite, closeDb } = await import("@/db/client"));
  ({ executeTool } = await import("@/agents/tools/runtime"));
  ({ toolContextFor } = await import("@/features/process/common"));
  ({ leaseJobById } = await import("@/db/repositories/background-jobs"));
  ({ setAutonomyLevel, switchRole } = await import("@/scenario/engine/state"));
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seed();
});

function count(sql: string, ...args: unknown[]): number {
  return (getSqlite().prepare(sql).get(...args) as { n: number }).n;
}

function tprmDispositions(): FormData {
  const context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
  const defaults = taskDefaults(context, "evidence-dispositions") as {
    items: Array<{ itemId: string; disposition: string; chaseDate: string }>;
  };
  const form = new FormData();
  for (const item of defaults.items) {
    form.set(`disposition:${item.itemId}`, item.disposition);
    form.set(`note:${item.itemId}`, item.disposition === "accept-with-condition" ? "Full penetration test report before contract signature." : "");
    form.set(`chase:${item.itemId}`, item.chaseDate);
  }
  return form;
}

function rcsaSufficiency(): FormData {
  const context = engine.buildStageContext({ processRunId: RCSA_RUN, stageId: RCSA_STAGE });
  const form = new FormData();
  for (const source of context.stage.requiredSources) {
    const limited = source.key === "control-tests";
    form.set(`sufficiency:${source.key}`, limited ? "limited" : "sufficient");
    form.set(`note:${source.key}`, limited ? "Two test evidence items are still outstanding." : "");
  }
  return form;
}

async function prepare(runId: string, stageId: string, mode?: "live" | "safe" | "offline", model?: PreparationModel) {
  return engine.syncStage(runId, stageId, { ...(mode ? { mode } : {}), ...(model ? { model } : {}) });
}

async function runTprmToCompletion() {
  await prepare(TPRM_RUN, TPRM_STAGE);
  await engine.submitHumanTask(TPRM_RUN, TPRM_STAGE, "evidence-dispositions", tprmDispositions());
  await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, {
    decisionKey: "stage-gate",
    optionId: "gate-conditional",
    rationale: "Two items outstanding; pass with dated conditions.",
    rationaleConfirmed: true,
  });
  await engine.approveAndExecuteTools(TPRM_RUN, TPRM_STAGE, { rationale: "Record the gate conditions.", rationaleConfirmed: true });
  return engine.submitStageCompletion(TPRM_RUN, TPRM_STAGE, { rationale: "Stage 4 outcome confirmed.", rationaleConfirmed: true });
}

/* ==========================================================================
   The seeded day
   ========================================================================== */

describe("the seeded day", () => {
  it("opens both current stages through the engine, with tasks, a queued preparation and the safe mode cache", () => {
    for (const [runId, stageId] of [[TPRM_RUN, TPRM_STAGE], [RCSA_RUN, RCSA_STAGE]] as const) {
      const context = engine.buildStageContext({ processRunId: runId, stageId });
      expect(context.stageRun?.status).toBe("ready");
      expect(context.preparation.state).toBe("queued");
      expect(context.tasks.some((task) => task.taskKind === "ai-job")).toBe(true);
      expect(context.tasks.some((task) => task.taskKind === "human-review")).toBe(true);
      expect(backbone.findOsEvent(`stage-opened:${context.stageRun?.id}`)).toBeDefined();
    }
    // One cache per seeded current stage: these two, and the second onboarding file's Stage 1.
    expect(count("select count(*) as n from cached_ai_outputs where beat_key like 'stage-preparation:%'")).toBeGreaterThanOrEqual(3);
    expect(count("select count(*) as n from cached_ai_outputs where beat_key = 'stage-preparation:tprm-third-party-onboarding:evidence-review'")).toBe(1);
  });

  it("records the stages completed before the day as history on the backbone", () => {
    const history = backbone.listOsEvents({ processRunId: TPRM_RUN, types: ["stage-completed"] });
    expect(history.map((event) => event.stageId)).toEqual(["request-and-intake", "classification-and-criticality", "tailored-due-diligence"]);
  });

  it("is rebuilt identically by a reseed", () => {
    const before = count("select count(*) as n from os_events");
    seed();
    expect(count("select count(*) as n from os_events")).toBe(before);
  });
});

/* ==========================================================================
   AI preparation: modes, durable states
   ========================================================================== */

describe("AI preparation", () => {
  it("serves the validated cache in safe mode", async () => {
    const result = await prepare(TPRM_RUN, TPRM_STAGE, "safe");
    expect(result.preparation).toBe("completed");
    const context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    expect(context.preparation).toMatchObject({ state: "completed", mode: "safe", source: "cache" });
    expect(context.preparation.output?.recommendedOptionId).toBe("gate-conditional");
  });

  it("composes from the loaded sources in offline mode, through the same validator", async () => {
    await prepare(RCSA_RUN, RCSA_STAGE, "offline");
    const context = engine.buildStageContext({ processRunId: RCSA_RUN, stageId: RCSA_STAGE });
    expect(context.preparation).toMatchObject({ state: "completed", mode: "offline", source: "composed" });
    expect(context.preparation.output?.findings.length).toBeGreaterThan(5);
  });

  it("follows the same path in live mode and accepts a valid model output", async () => {
    const offline = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    // The cached output is valid against these sources, so the fake model returns it.
    const cached = getSqlite().prepare("select payload from cached_ai_outputs where beat_key = ?").get(`stage-preparation:${offline.process.id}:${TPRM_STAGE}`) as { payload: string };
    const output = (JSON.parse(cached.payload) as { output: unknown }).output;
    let called = 0;
    await prepare(TPRM_RUN, TPRM_STAGE, "live", async (request) => {
      called += 1;
      expect(request.schemaName).toBe("nfr_stage_preparation");
      expect(request.input).toContain("EVD-OB-0099-05");
      return { output, model: "test-model" };
    });
    expect(called).toBe(1);
    expect(engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).preparation).toMatchObject({ mode: "live", source: "live" });
  });

  it("falls back from an invalid live output and records why", async () => {
    await prepare(TPRM_RUN, TPRM_STAGE, "live", async () => ({ output: { schemaVersion: "stage-preparation-v1", summary: { en: "x", de: "x" } }, model: "test-model" }));
    const context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    expect(context.preparation.state).toBe("completed");
    expect(context.preparation.source).toBe("cache");
    expect(context.preparation.reason).toContain("Live output did not validate");
  });

  it("parks as Waiting for source when a required source is unavailable, and resumes when it returns", async () => {
    getSqlite().prepare("update connector_instances set health_state = 'unavailable' where id = 'CI-GRC-SIM'").run();
    const held = await prepare(TPRM_RUN, TPRM_STAGE);
    expect(held.preparation).toBe("waiting-for-source");
    let context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    expect(context.preparation.state).toBe("waiting-for-source");
    expect(context.preparation.reason).toContain("Supplier and service record");
    expect(engine.validateStage(context).blocking.find((item) => item.kind === "required-source-unavailable")?.active).toBe(true);

    getSqlite().prepare("update connector_instances set health_state = 'healthy' where id = 'CI-GRC-SIM'").run();
    await prepare(TPRM_RUN, TPRM_STAGE);
    context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    expect(context.preparation.state).toBe("completed");
    expect(backbone.listOsEvents({ processRunId: TPRM_RUN, types: ["source-changed"] })).toHaveLength(1);
  });

  it("parks as Waiting for approval at the Assist autonomy level until a person starts it", async () => {
    setAutonomyLevel("assist");
    expect((await prepare(TPRM_RUN, TPRM_STAGE)).preparation).toBe("waiting-for-approval");
    expect(engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).preparation.state).toBe("waiting-for-approval");

    const started = await engine.requestPreparation(TPRM_RUN, TPRM_STAGE);
    expect(started.ok).toBe(true);
    await prepare(TPRM_RUN, TPRM_STAGE);
    expect(engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).preparation.state).toBe("completed");
  });

  it("survives a restart: an interrupted lease shows as Retrying and the next resume completes it", async () => {
    const context = engine.buildStageContext({ processRunId: RCSA_RUN, stageId: RCSA_STAGE });
    const jobId = context.job?.id ?? "";
    expect(leaseJobById(jobId, "process-that-dies", 60)).toBeDefined();
    getSqlite().prepare("update background_jobs set lease_expires_at = '2000-01-01T00:00:00.000Z' where id = ?").run(jobId);

    // The process dies: the connection goes, and a new one reads the same file.
    closeDb();
    const reopened = engine.buildStageContext({ processRunId: RCSA_RUN, stageId: RCSA_STAGE });
    expect(reopened.preparation.state).toBe("retrying");

    await prepare(RCSA_RUN, RCSA_STAGE);
    expect(engine.buildStageContext({ processRunId: RCSA_RUN, stageId: RCSA_STAGE }).preparation.state).toBe("completed");
  });
});

/* ==========================================================================
   Continue does not bypass the criteria
   ========================================================================== */

describe("Continue", () => {
  it("refuses to complete a stage whose criteria are not met, and writes nothing", async () => {
    await prepare(TPRM_RUN, TPRM_STAGE);
    const approvalsBefore = rowCount("approvals");
    const result = await engine.submitStageCompletion(TPRM_RUN, TPRM_STAGE, { rationale: "Skip ahead.", rationaleConfirmed: true });
    expect(result.ok).toBe(false);
    expect(result.message.en).toContain("not recorded");
    expect(rowCount("approvals")).toBe(approvalsBefore);
    expect(engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).stageRun?.status).not.toBe("completed");
  });

  it("refuses a completion whose rationale is not confirmed", async () => {
    await engine.syncStage(TPRM_RUN, TPRM_STAGE);
    await engine.submitHumanTask(TPRM_RUN, TPRM_STAGE, "evidence-dispositions", tprmDispositions());
    await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, { decisionKey: "stage-gate", optionId: "gate-conditional", rationale: "Conditional.", rationaleConfirmed: true });
    await engine.approveAndExecuteTools(TPRM_RUN, TPRM_STAGE, { rationale: "Record.", rationaleConfirmed: true });
    const result = await engine.submitStageCompletion(TPRM_RUN, TPRM_STAGE, { rationale: "Done.", rationaleConfirmed: false });
    expect(result.ok).toBe(false);
    expect(engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).stageRun?.status).not.toBe("completed");
  });

  it("records the acting user and role on every completion record", async () => {
    expect((await runTprmToCompletion()).ok).toBe(true);
    const stageRun = getSqlite()
      .prepare("select status, completed_by_user_id as userId, completion_approval_id as approvalId, completion_rationale as rationale from role_app_stage_runs where role_app_run_id = ? and stage_id = ?")
      .get(TPRM_RUN, TPRM_STAGE) as { status: string; userId: string | null; approvalId: string | null; rationale: string | null };
    expect(stageRun).toMatchObject({ status: "completed", userId: "P-002", rationale: "Stage 4 outcome confirmed." });

    const approval = getSqlite()
      .prepare("select approved_by_user_id as userId, role_id as roleId, tool_name as toolName from approvals where id = ?")
      .get(stageRun.approvalId) as { userId: string; roleId: string; toolName: string };
    expect(approval).toEqual({ userId: "P-002", roleId: "tprm", toolName: "completeOnboardingStage" });

    expect(count("select count(*) as n from audit_events where action = 'completeOnboardingStage' and category = 'mutation' and actor_user_id = 'P-002' and role_id = 'tprm'")).toBe(1);
    expect(count("select count(*) as n from os_events where type = 'stage-completed' and correlation_id = (select id from role_app_stage_runs where role_app_run_id = ? and stage_id = ?) and actor_user_id = 'P-002' and role_id = 'tprm'", TPRM_RUN, TPRM_STAGE)).toBe(1);
  });

  it("refuses a request whose workday role does not own the run", () => {
    expect(engine.routeRoleRefusal(TPRM_RUN, "rcsa")?.ok).toBe(false);
    expect(engine.routeRoleRefusal(RCSA_RUN, "tprm")?.ok).toBe(false);
    expect(engine.routeRoleRefusal(TPRM_RUN, "tprm")).toBeNull();
    expect(engine.routeRoleRefusal(RCSA_RUN, "rcsa")).toBeNull();
  });

  it("refuses a material completion the autonomy level cannot reach", async () => {
    await prepare(TPRM_RUN, TPRM_STAGE);
    await engine.submitHumanTask(TPRM_RUN, TPRM_STAGE, "evidence-dispositions", tprmDispositions());
    await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, { decisionKey: "stage-gate", optionId: "gate-conditional", rationale: "Conditional.", rationaleConfirmed: true });
    await engine.approveAndExecuteTools(TPRM_RUN, TPRM_STAGE, { rationale: "Record.", rationaleConfirmed: true });
    setAutonomyLevel("recommend");
    const result = await engine.submitStageCompletion(TPRM_RUN, TPRM_STAGE, { rationale: "Done.", rationaleConfirmed: true });
    expect(result.ok).toBe(false);
    expect(result.message.en).toContain("cannot reach");
  });
});

/* ==========================================================================
   The TPRM reference stage, end to end
   ========================================================================== */

describe("TPRM Stage 4 Evidence Review", () => {
  it("runs end to end: dispositions, decision, governed tools through the outbox, gated completion, next stage", async () => {
    const result = await runTprmToCompletion();
    expect(result.ok).toBe(true);

    const completed = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    expect(completed.stageRun?.status).toBe("completed");
    expect(completed.stageRun?.completionApprovalId).toBeTruthy();
    expect(completed.artifacts.map((artifact) => artifact.artifactKey)).toEqual(expect.arrayContaining(["evidence-assessment", "evidence-review-record"]));

    // The condition action exists locally, and the GRC platform acknowledged its record.
    expect(count("select count(*) as n from actions where related_object_id = 'TP-0099' and kind = 'evidence-request' and created_by_session = 1")).toBe(1);
    expect(count("select count(*) as n from integration_commands where idempotency_key = ? and status = 'acknowledged'", `stage-tool:${completed.stageRun?.id}:register-conditions`)).toBe(1);
    expect(count("select count(*) as n from external_execution_receipts")).toBeGreaterThan(0);

    // The completion passed the authority gate: one executed tool call, one audit mutation.
    expect(count("select count(*) as n from tool_calls where tool_name = 'completeOnboardingStage' and outcome = 'executed'")).toBe(1);
    expect(count("select count(*) as n from audit_events where action = 'completeOnboardingStage' and category = 'mutation'")).toBe(1);

    const next = engine.buildStageContext({ processRunId: TPRM_RUN });
    expect(next.stage.id).toBe("specialist-reviews");
    expect(next.stageRun?.status).toBe("ready");
    expect(engine.validateStage(next).canComplete).toBe(false);
  });

  it("is idempotent: every repeated submission writes nothing the second time", async () => {
    await prepare(TPRM_RUN, TPRM_STAGE);
    const form = tprmDispositions();
    expect((await engine.submitHumanTask(TPRM_RUN, TPRM_STAGE, "evidence-dispositions", form)).noop).toBe(false);
    expect((await engine.submitHumanTask(TPRM_RUN, TPRM_STAGE, "evidence-dispositions", form)).noop).toBe(true);

    const decision = { decisionKey: "stage-gate", optionId: "gate-conditional", rationale: "Conditional pass.", rationaleConfirmed: true };
    expect((await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, decision)).noop).toBe(false);
    expect((await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, decision)).noop).toBe(true);

    await engine.approveAndExecuteTools(TPRM_RUN, TPRM_STAGE, { rationale: "Record.", rationaleConfirmed: true });
    const commands = rowCount("integration_commands");
    const actions = rowCount("actions");
    expect((await engine.approveAndExecuteTools(TPRM_RUN, TPRM_STAGE, { rationale: "Record.", rationaleConfirmed: true })).noop).toBe(true);
    expect(rowCount("integration_commands")).toBe(commands);
    expect(rowCount("actions")).toBe(actions);

    const first = await engine.submitStageCompletion(TPRM_RUN, TPRM_STAGE, { rationale: "Done.", rationaleConfirmed: true });
    expect(first.ok).toBe(true);
    const events = rowCount("os_events");
    const approvals = rowCount("approvals");
    const second = await engine.submitStageCompletion(TPRM_RUN, TPRM_STAGE, { rationale: "Done.", rationaleConfirmed: true });
    expect(second.ok).toBe(true);
    expect(second.noop).toBe(true);
    expect(rowCount("os_events")).toBe(events);
    expect(rowCount("approvals")).toBe(approvals);
    expect(count("select count(*) as n from role_app_stage_runs where role_app_run_id = ? and stage_id = 'specialist-reviews'", TPRM_RUN)).toBe(1);
  });

  it("applies the decision rules: no pass with outstanding items, no conditional pass without them", async () => {
    await prepare(TPRM_RUN, TPRM_STAGE);
    const early = await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, { decisionKey: "stage-gate", optionId: "gate-conditional", rationale: "Too early.", rationaleConfirmed: true });
    expect(early.ok).toBe(false);
    expect(early.message.en).toContain("dispositions");

    await engine.submitHumanTask(TPRM_RUN, TPRM_STAGE, "evidence-dispositions", tprmDispositions());
    const pass = await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, { decisionKey: "stage-gate", optionId: "gate-pass", rationale: "Pass.", rationaleConfirmed: true });
    expect(pass.ok).toBe(false);
  });

  it("holds the file on a hold decision, and lets the hold be revised", async () => {
    await prepare(TPRM_RUN, TPRM_STAGE);
    await engine.submitHumanTask(TPRM_RUN, TPRM_STAGE, "evidence-dispositions", tprmDispositions());
    await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, { decisionKey: "stage-gate", optionId: "gate-hold", rationale: "Wait for the reports.", rationaleConfirmed: true });
    let context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    expect(engine.validateStage(context).blocking.find((item) => item.kind === "decision-held")?.active).toBe(true);
    expect(engine.validateStage(context).canComplete).toBe(false);

    const revised = await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, { decisionKey: "stage-gate", optionId: "gate-conditional", rationale: "Reports dated; conditional pass.", rationaleConfirmed: true });
    expect(revised.ok).toBe(true);
    context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    expect(context.decisions[0]?.chosenOptionId).toBe("gate-conditional");

    const final = await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, { decisionKey: "stage-gate", optionId: "gate-hold", rationale: "Changed my mind.", rationaleConfirmed: true });
    expect(final.ok).toBe(false);
  });

  it("commits completion atomically: a payload that no longer matches is refused and nothing is written", async () => {
    await prepare(TPRM_RUN, TPRM_STAGE);
    await engine.submitHumanTask(TPRM_RUN, TPRM_STAGE, "evidence-dispositions", tprmDispositions());
    await engine.submitStageDecision(TPRM_RUN, TPRM_STAGE, { decisionKey: "stage-gate", optionId: "gate-conditional", rationale: "Conditional.", rationaleConfirmed: true });
    await engine.approveAndExecuteTools(TPRM_RUN, TPRM_STAGE, { rationale: "Record.", rationaleConfirmed: true });

    const context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    const { grantStageApproval } = await import("@/features/process/approvals");
    const payload = { processRunId: TPRM_RUN, stageId: TPRM_STAGE, stageRunId: context.stageRun?.id ?? "", completionDigest: "stale-digest" };
    const { approvalId } = grantStageApproval({ context, toolName: "completeOnboardingStage", payload, rationale: "Approve.", rationaleConfirmed: true, decisionId: null, subject: { en: "complete", de: "abschliessen" } });

    const events = rowCount("os_events");
    const stageRuns = rowCount("role_app_stage_runs");
    const result = await executeTool("completeOnboardingStage", payload, toolContextFor(context), approvalId);
    expect(result.outcome).toBe("failed");
    expect(result.summary).toContain("changed after it was approved");
    expect(rowCount("os_events")).toBe(events);
    expect(rowCount("role_app_stage_runs")).toBe(stageRuns);
    expect(engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).stageRun?.status).not.toBe("completed");
  });

  it("refuses a completion without an approval at the authority gate", async () => {
    const context = engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE });
    const result = await executeTool(
      "completeOnboardingStage",
      { processRunId: TPRM_RUN, stageId: TPRM_STAGE, stageRunId: context.stageRun?.id ?? "", completionDigest: "x" },
      toolContextFor(context),
      null,
    );
    expect(result.outcome).toBe("proposed");
    expect(result.denialCode).toBe("approval-missing");
  });
});

/* ==========================================================================
   The RCSA reference stage, end to end
   ========================================================================== */

describe("RCSA Stage 2 Evidence Refresh", () => {
  it("runs end to end on the seeded decision, the outbox and gated completion", async () => {
    await prepare(RCSA_RUN, RCSA_STAGE);
    expect((await engine.submitHumanTask(RCSA_RUN, RCSA_STAGE, "evidence-sufficiency", rcsaSufficiency())).ok).toBe(true);

    const decided = await engine.submitStageDecision(RCSA_RUN, RCSA_STAGE, {
      decisionKey: "investigation-strategy",
      optionId: "DEC-2026-0771-O1",
      rationale: "One causal investigation; the indicators share a mechanism.",
      rationaleConfirmed: true,
    });
    expect(decided.ok).toBe(true);
    expect(count("select count(*) as n from decisions where id = 'DEC-2026-0771' and status = 'decided'")).toBe(1);

    const recorded = backbone.findOsEvent("decision-recorded:DEC-2026-0771");
    expect(recorded?.auditEventId).toBeTruthy();

    await engine.approveAndExecuteTools(RCSA_RUN, RCSA_STAGE, { rationale: "Register the investigation.", rationaleConfirmed: true });
    const result = await engine.submitStageCompletion(RCSA_RUN, RCSA_STAGE, { rationale: "Evidence corpus accepted with stated limits.", rationaleConfirmed: true });
    expect(result.ok).toBe(true);

    const completedRun = engine.buildStageContext({ processRunId: RCSA_RUN, stageId: RCSA_STAGE });
    expect(completedRun.stageRun?.completedByUserId).toBe("P-003");
    expect(count("select count(*) as n from approvals where id = ? and approved_by_user_id = 'P-003' and role_id = 'rcsa'", completedRun.stageRun?.completionApprovalId)).toBe(1);
    expect(count("select count(*) as n from audit_events where action = 'completeRcsaStage' and category = 'mutation' and actor_user_id = 'P-003' and role_id = 'rcsa'")).toBe(1);

    const pack = completedRun.artifacts.find((artifact) => artifact.artifactKey === "evidence-pack");
    expect(pack?.content).toContain("DEC-2026-0771");
    expect(engine.buildStageContext({ processRunId: RCSA_RUN }).stage.id).toBe("risk-control-change");
  });

  it("records a seeded decision while the shell acts as another role, approved by the run role's holder", async () => {
    /*
     * This was a refusal while the decision engine granted approvals under the
     * active role (J20). The engine now executes as the decision's own role,
     * so the stage records it in the name of the RCSA holder whatever the
     * shell last pointed at.
     */
    await prepare(RCSA_RUN, RCSA_STAGE);
    switchRole("tprm");
    const result = await engine.submitStageDecision(RCSA_RUN, RCSA_STAGE, {
      decisionKey: "investigation-strategy",
      optionId: "DEC-2026-0771-O1",
      rationale: "One investigation.",
      rationaleConfirmed: true,
    });
    expect(result.ok).toBe(true);
    expect(count("select count(*) as n from decisions where id = 'DEC-2026-0771' and status = 'decided'")).toBe(1);
    expect(count("select count(*) as n from approvals where decision_id = 'DEC-2026-0771' and (approved_by_user_id <> 'P-003' or role_id <> 'rcsa')")).toBe(0);
    expect(count("select count(*) as n from tool_calls where approval_id in (select id from approvals where decision_id = 'DEC-2026-0771') and outcome <> 'executed'")).toBe(0);
  });
});

/* ==========================================================================
   Both modes complete both reference stages
   ========================================================================== */

describe("safe and offline modes", () => {
  for (const mode of ["safe", "offline"] as const) {
    it(`complete both reference stages in ${mode} mode`, async () => {
      await prepare(TPRM_RUN, TPRM_STAGE, mode);
      expect(engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).preparation.mode).toBe(mode);
      expect((await runTprmToCompletion()).ok).toBe(true);

      await prepare(RCSA_RUN, RCSA_STAGE, mode);
      expect(engine.buildStageContext({ processRunId: RCSA_RUN, stageId: RCSA_STAGE }).preparation.mode).toBe(mode);
      await engine.submitHumanTask(RCSA_RUN, RCSA_STAGE, "evidence-sufficiency", rcsaSufficiency());
      await engine.submitStageDecision(RCSA_RUN, RCSA_STAGE, {
        decisionKey: "investigation-strategy",
        optionId: "DEC-2026-0771-O1",
        rationale: "One causal investigation.",
        rationaleConfirmed: true,
      });
      await engine.approveAndExecuteTools(RCSA_RUN, RCSA_STAGE, { rationale: "Register it.", rationaleConfirmed: true });
      expect((await engine.submitStageCompletion(RCSA_RUN, RCSA_STAGE, { rationale: "Accepted.", rationaleConfirmed: true })).ok).toBe(true);
    });
  }
});

/* ==========================================================================
   The event backbone
   ========================================================================== */

describe("the event backbone", () => {
  const base = {
    type: "work-arrived" as const,
    roleId: "tprm" as const,
    atMoment: "08:00",
    actorKind: "system" as const,
    summary: { en: "Something arrived.", de: "Etwas ist eingegangen." },
    idempotencyKey: "test:once",
  };

  it("records an event once: a second publish with the same key writes nothing, not even its audit row", () => {
    const audits = rowCount("audit_events");
    const first = backbone.publishOsEvent({ ...base, audit: { category: "system", action: "test", objectKind: "test", objectId: "x" } });
    const second = backbone.publishOsEvent({ ...base, audit: { category: "system", action: "test", objectKind: "test", objectId: "x" } });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.event.id).toBe(first.event.id);
    expect(rowCount("audit_events")).toBe(audits + 1);
    expect(first.event.auditEventId).toBeTruthy();
  });

  it("writes the activity projection for AI events and links it", () => {
    const published = backbone.publishOsEvent({
      ...base,
      type: "ai-preparation-completed",
      actorKind: "ai",
      idempotencyKey: "test:activity",
      activity: { kind: "drafted", label: { en: "Prepared", de: "Vorbereitet" }, durationMs: 5 },
    });
    expect(published.event.activityEntryId).toBeTruthy();
    expect(count("select count(*) as n from ai_activity_entries where id = ?", published.event.activityEntryId)).toBe(1);
  });

  it("allocates a monotonic sequence and reads incrementally", () => {
    const start = backbone.latestOsEventSequence();
    backbone.publishOsEvent({ ...base, idempotencyKey: "test:a" });
    backbone.publishOsEvent({ ...base, idempotencyKey: "test:b" });
    const since = backbone.listOsEvents({ sinceSequence: start });
    expect(since.map((event) => event.sequence)).toEqual([start + 1, start + 2]);
  });

  it("reads seeded arrivals as work-arrived events without copying them", () => {
    const before = rowCount("os_events");
    const arrivals = backbone.listOsEvents({ roleId: "tprm", types: ["work-arrived"], includeArrivals: { upToMoment: "07:45" } });
    expect(arrivals.length).toBeGreaterThan(0);
    expect(arrivals.every((event) => event.origin === "live-event")).toBe(true);
    expect(rowCount("os_events")).toBe(before);
  });

  it("gives the process its full lifecycle on the backbone after a completed stage", async () => {
    await runTprmToCompletion();
    const types = new Set(backbone.listOsEvents({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).map((event) => event.type));
    for (const type of [
      "stage-opened",
      "human-task-created",
      "ai-preparation-started",
      "ai-preparation-completed",
      "decision-requested",
      "human-task-completed",
      "decision-recorded",
      "approval-requested",
      "approval-granted",
      "tool-executed",
      "external-command-acknowledged",
      "stage-completed",
    ]) {
      expect(types.has(type as never), type).toBe(true);
    }
    const completed = backbone.findOsEvent(`stage-completed:${engine.buildStageContext({ processRunId: TPRM_RUN, stageId: TPRM_STAGE }).stageRun?.id}`);
    expect(completed?.auditEventId).toBeTruthy();
  });
});
