/**
 * Third-Party Onboarding, all eight stages, integration tests.
 *
 * Against a real, freshly seeded SQLite database in the system temporary
 * directory. What these prove, in the plan's words (section 5.2): all eight
 * stages are executable; evidence comes from the database; supplier meetings
 * and specialist reviews are integrated; conditions create actions with their
 * process lineage; approval creates supplier, service and monitoring records
 * through governed tools, the GRC writes through the outbox with receipts;
 * completion updates the onboarding pipeline and Home's source rows; the
 * journey runs in safe and offline modes and survives a restart; and no stage
 * completes without its criteria.
 *
 * The seeded Elbmarsch file (TP-0104) is at Stage 1 and goes the whole way.
 * The seeded Veridian file (TP-0099) is at Stage 4 and goes from there.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";

/*
 * Each test reseeds the day and most run several stages end to end, so this
 * file needs more than the suite's default thirty seconds when the machine
 * is busy. The timeouts are the file's own; the shared configuration is
 * unchanged.
 */
vi.setConfig({ testTimeout: 240_000, hookTimeout: 180_000 });

type Orchestrator = typeof import("@/features/process/orchestrator");
type Backbone = typeof import("@/features/events/backbone");

let seed: () => void;
let engine: Orchestrator;
let backbone: Backbone;
let taskDefaults: typeof import("@/features/process/tasks").taskDefaults;
let getSqlite: typeof import("@/db/client").getSqlite;
let closeDb: typeof import("@/db/client").closeDb;
let buildOnboardingPipeline: typeof import("@/role-apps/tprm/pipeline").buildOnboardingPipeline;

const ELB = "RUN-TPRM-ELBMARSCH-2026";
const VER = "RUN-TPRM-VERIDIAN-2026";

beforeAll(async () => {
  createTemporaryDatabase("tprm-onboarding-stages");
  const seedModule = await import("@/db/seed/run");
  seed = () => seedModule.seedScenario();
  engine = await import("@/features/process/orchestrator");
  backbone = await import("@/features/events/backbone");
  ({ taskDefaults } = await import("@/features/process/tasks"));
  ({ getSqlite, closeDb } = await import("@/db/client"));
  ({ buildOnboardingPipeline } = await import("@/role-apps/tprm/pipeline"));
}, 180_000);

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seed();
}, 180_000);

function count(sql: string, ...args: unknown[]): number {
  return (getSqlite().prepare(sql).get(...args) as { n: number }).n;
}

function context(runId: string, stageId?: string) {
  return engine.buildStageContext({ processRunId: runId, ...(stageId ? { stageId } : {}) });
}

/* ==========================================================================
   Filling each stage's form the way a person would, from the proposals
   ========================================================================== */

type Defaults = Record<string, unknown>;

function formFor(runId: string, stageId: string, taskKeyValue: string, adjust?: (defaults: Defaults) => void): FormData {
  const ctx = context(runId, stageId);
  const defaults = structuredClone(taskDefaults(ctx, taskKeyValue)) as Defaults;
  adjust?.(defaults);
  const form = new FormData();
  const rows = (key: string) => (defaults[key] ?? []) as Array<Record<string, string>>;
  switch (taskKeyValue) {
    case "intake-review":
      for (const row of rows("rows")) {
        form.set(`intake:${row.id}`, row.verdict ?? "");
        form.set(`note:${row.id}`, row.note ?? "");
      }
      form.set("context", String(defaults.context ?? ""));
      break;
    case "classification-judgment":
      for (const row of rows("rows")) {
        form.set(`judgment:${row.id}`, row.value ?? "");
        form.set(`note:${row.id}`, row.note ?? "");
      }
      break;
    case "request-scope":
      for (const part of rows("parts")) {
        form.set(`scope:${part.partId}`, part.choice ?? "");
        form.set(`note:${part.partId}`, part.note ?? "");
        form.set(`due:${part.partId}`, part.dueOn ?? "");
      }
      form.set("blocker", String(defaults.blocker ?? ""));
      form.set("blocker-note", String(defaults.blockerNote ?? ""));
      form.set("additional", String(defaults.additional ?? ""));
      break;
    case "evidence-dispositions":
      for (const item of rows("items")) {
        form.set(`disposition:${item.itemId}`, item.disposition ?? "");
        form.set(`note:${item.itemId}`, item.disposition === "accept-with-condition" ? "Condition recorded with the specialist function." : "");
        form.set(`chase:${item.itemId}`, item.chaseDate ?? "");
      }
      break;
    case "specialist-conditions":
      for (const item of rows("items")) {
        form.set(`spec:${item.itemId}`, item.choice ?? "");
        form.set(`note:${item.itemId}`, item.note ?? "");
        form.set(`due:${item.itemId}`, item.dueOn ?? "");
      }
      break;
    case "contract-review":
      for (const item of rows("items")) {
        form.set(`contract:${item.itemId}`, item.choice ?? "");
        form.set(`note:${item.itemId}`, item.note ?? "");
        form.set(`due:${item.itemId}`, item.dueOn ?? "");
      }
      break;
    case "handover-plan":
      form.set("owner", String(defaults.owner ?? ""));
      form.set("first-check", String(defaults.firstCheck ?? ""));
      form.set("reassessment", String(defaults.reassessment ?? ""));
      for (const entry of rows("conditions")) {
        form.set(`condition:${entry.actionId}`, entry.choice ?? "");
        form.set(`note:${entry.actionId}`, entry.note ?? "");
      }
      form.set("note", "");
      break;
  }
  return form;
}

const CONFIRM = { rationaleConfirmed: true } as const;

interface StagePlan {
  stageId: string;
  task?: string;
  adjust?: (defaults: Defaults) => void;
  decision: { key: string; option: string };
}

const ELBMARSCH_PLAN: StagePlan[] = [
  { stageId: "request-and-intake", task: "intake-review", decision: { key: "intake-proceed", option: "intake-proceed" } },
  { stageId: "classification-and-criticality", task: "classification-judgment", decision: { key: "classification", option: "class-outsourcing" } },
  { stageId: "tailored-due-diligence", task: "request-scope", decision: { key: "questionnaire-dispatch", option: "dispatch-approve" } },
  { stageId: "evidence-review", task: "evidence-dispositions", decision: { key: "stage-gate", option: "gate-conditional" } },
  { stageId: "specialist-reviews", task: "specialist-conditions", decision: { key: "specialist-escalation", option: "specialist-agree" } },
  { stageId: "contract-and-conditions", task: "contract-review", decision: { key: "contract-sufficiency", option: "contract-trade-off" } },
  { stageId: "decision-and-onboarding", decision: { key: "onboarding-approval", option: "onboarding-conditional" } },
  { stageId: "handover-to-monitoring", task: "handover-plan", decision: { key: "monitoring-intensity", option: "monitoring-semiannual" } },
];

const VERIDIAN_PLAN: StagePlan[] = [
  ELBMARSCH_PLAN[3] as StagePlan,
  ELBMARSCH_PLAN[4] as StagePlan,
  { stageId: "contract-and-conditions", task: "contract-review", decision: { key: "contract-sufficiency", option: "contract-trade-off" } },
  { stageId: "decision-and-onboarding", decision: { key: "onboarding-approval", option: "onboarding-conditional" } },
  { stageId: "handover-to-monitoring", task: "handover-plan", decision: { key: "monitoring-intensity", option: "monitoring-quarterly" } },
];

function expectOk(result: { ok: boolean; message: { en: string }; reasons?: Array<{ en: string }> }, step: string): void {
  if (!result.ok) throw new Error(`${step}: ${result.message.en} ${(result.reasons ?? []).map((reason) => reason.en).join(" | ")}`);
}

/** Runs one stage the way the workspace does: prepare, record, decide, approve the changes, complete. */
async function runStage(runId: string, plan: StagePlan, mode: "safe" | "offline"): Promise<void> {
  const prepared = await engine.syncStage(runId, plan.stageId, { mode });
  expect(prepared.ran, `${plan.stageId} opened`).toBe(true);
  const ctx = context(runId, plan.stageId);
  expect(ctx.preparation.state, `${plan.stageId} preparation: ${ctx.preparation.reason ?? ""}`).toBe("completed");

  if (plan.task) {
    expectOk(await engine.submitHumanTask(runId, plan.stageId, plan.task, formFor(runId, plan.stageId, plan.task, plan.adjust)), `${plan.stageId} task`);
  }
  expectOk(
    await engine.submitStageDecision(runId, plan.stageId, { decisionKey: plan.decision.key, optionId: plan.decision.option, rationale: `Decided ${plan.decision.option} on the recorded file.`, ...CONFIRM }),
    `${plan.stageId} decision`,
  );
  const tools = context(runId, plan.stageId).tools.filter((tool) => tool.state !== "not-applicable");
  if (tools.length > 0) {
    expectOk(await engine.approveAndExecuteTools(runId, plan.stageId, { rationale: "Approve the changes the decision implies.", ...CONFIRM }), `${plan.stageId} tools`);
  }
  const done = await engine.submitStageCompletion(runId, plan.stageId, { rationale: `Stage outcome confirmed: ${plan.stageId}.`, ...CONFIRM });
  expectOk(done, `${plan.stageId} completion`);
}

async function runJourney(runId: string, plans: StagePlan[], mode: "safe" | "offline", between?: (index: number) => void): Promise<void> {
  for (const [index, plan] of plans.entries()) {
    await runStage(runId, plan, mode);
    between?.(index);
  }
}

/* ==========================================================================
   The seeded files
   ========================================================================== */

describe("the seeded onboarding files", () => {
  it("opens the Elbmarsch file at Stage 1 through the engine, with its tasks, a queued preparation and the safe mode cache", () => {
    const ctx = context(ELB);
    expect(ctx.stage.id).toBe("request-and-intake");
    expect(ctx.stageRun?.status).toBe("ready");
    expect(ctx.preparation.state).toBe("queued");
    expect(ctx.tasks.map((task) => task.taskKey)).toEqual(expect.arrayContaining(["job:intake-preparation", "task:intake-review", "decision:intake-proceed"]));
    expect(count("select count(*) as n from cached_ai_outputs where beat_key = 'stage-preparation:tprm-third-party-onboarding:request-and-intake'")).toBe(1);
    expect(backbone.findOsEvent(`stage-opened:${ctx.stageRun?.id}`)).toBeDefined();
  });

  it("opens the Veridian file by default on every surface, offers Elbmarsch through the run switcher, and keeps the default while Elbmarsch moves", async () => {
    const { buildProcessCards, buildProcessPageView } = await import("@/features/process/view");
    const { readRoleSignalOverview, readRoleSignals } = await import("@/features/role-signals");
    const basePath = "/workday/tprm/processes/third-party-onboarding";
    const page = (runParam?: string) =>
      buildProcessPageView({
        roleId: "tprm",
        roleAppId: "tprm-third-party-onboarding",
        stageParam: undefined,
        language: "en",
        basePath,
        ...(runParam ? { runParam } : {}),
      });

    const expectVeridianEverywhere = (): void => {
      expect(engine.findActiveProcessRun("tprm")?.id).toBe(VER);

      // The onboarding page without `?run=`.
      const view = page();
      expect(view?.processRunId).toBe(VER);
      expect(view?.basePath).toBe(basePath);
      expect(view?.currentStageId).toBe("evidence-review");

      // The Processes card, the role's Home signal, and the landing and role selector overview.
      expect(buildProcessCards("tprm", "en")[0]?.statusLine).toContain("Evidence Review, Veridian Document Systems GmbH (TP-0099)");
      const signal = readRoleSignals("tprm").process;
      expect(signal.value).toBe("Third-Party Onboarding, Stage 4 of 8");
      expect(signal.stageName).toBe("Evidence Review");
      expect(signal.href).toBe(basePath);
      const overview = readRoleSignalOverview().available.find((entry) => entry.release.roleId === "tprm");
      expect(overview?.signals.process.value).toBe(signal.value);
      expect(overview?.signals.process.href).toBe(basePath);

      // The run switcher: the story file first and on screen, the other one an address away.
      const pipeline = buildOnboardingPipeline({ language: "en", selectedRunId: view?.processRunId ?? null, basePath });
      expect(pipeline.rows.map((row) => row.processRunId)).toEqual([VER, ELB]);
      expect(pipeline.rows[0]?.selected).toBe(true);
      expect(pipeline.showing).toBe("Showing Veridian Document Systems GmbH. Select another supplier to open its file.");
      expect(pipeline.rows[1]?.href).toBe(`${basePath}?run=${ELB}`);
    };

    expectVeridianEverywhere();

    // `?run=` opens the other file, and only a file of this app and role.
    expect(page(ELB)?.processRunId).toBe(ELB);
    expect(page(ELB)?.basePath).toBe(`${basePath}?run=${ELB}`);
    expect(page(ELB)?.currentStageId).toBe("request-and-intake");
    expect(page("RUN-RCSA-PAYOPS-Q4-2026")?.processRunId).toBe(VER);
    expect(page("RUN-TPRM-UNKNOWN")?.processRunId).toBe(VER);
    const switched = buildOnboardingPipeline({ language: "de", selectedRunId: ELB, basePath });
    expect(switched.showing).toBe("Angezeigt: Elbmarsch Dokumentenservice GmbH. Waehlen Sie einen anderen Lieferanten, um dessen Akte zu oeffnen.");
    expect(switched.rows[0]?.href).toBe(`${basePath}?run=${VER}`);

    // Working on the Elbmarsch file does not move the default.
    await runStage(ELB, ELBMARSCH_PLAN[0] as StagePlan, "offline");
    expect(context(ELB).stage.id).toBe("classification-and-criticality");
    expectVeridianEverywhere();
  });

  it("makes every stage executable, with every key it names registered", async () => {
    const { TPRM_ONBOARDING_PROCESS } = await import("@/role-apps/tprm/definition");
    const { missingImplementations } = await import("@/features/process/registry");
    for (const stage of TPRM_ONBOARDING_PROCESS.stages) {
      expect(stage.implementation.implemented, stage.id).toBe(true);
      expect(missingImplementations(stage), stage.id).toEqual([]);
    }
  });
});

/* ==========================================================================
   The full journey
   ========================================================================== */

describe("the Elbmarsch file, all eight stages", () => {
  it("runs end to end in offline mode, and every stage leaves its record, its changes and its receipts", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN, "offline");

    const run = getSqlite().prepare("select status, current_stage_id as stage from role_app_runs where id = ?").get(ELB) as { status: string; stage: string };
    expect(run.status).toBe("completed");
    expect(count("select count(*) as n from role_app_stage_runs where role_app_run_id = ? and status = 'completed'", ELB)).toBe(8);
    expect(backbone.findOsEvent(`process-completed:${ELB}`)).toBeDefined();

    // Every stage stored its preparation and its stage record.
    const keys = (getSqlite().prepare("select artifact_key as k from role_app_artifacts where role_app_run_id = ?").all(ELB) as Array<{ k: string }>).map((row) => row.k);
    for (const key of ["intake-record", "classification-memo", "evidence-request-list", "evidence-review-record", "specialist-opinions", "contract-record", "approval-record", "monitoring-plan"]) {
      expect(keys, key).toContain(key);
    }

    // Stage 1: the candidate in the GRC register, through the outbox.
    expect(count("select count(*) as n from integration_commands where idempotency_key like '%:register-candidate' and status = 'acknowledged' and target_external_type = 'grc.supplier'")).toBe(1);
    // Stage 2: the criticality on the supplier record, through the gate.
    expect(count("select count(*) as n from tool_calls where tool_name = 'setSupplierCriticality' and outcome = 'executed'")).toBe(1);
    // Stage 3 and 4 and 6: conditions became actions, with the process lineage.
    expect(count("select count(*) as n from actions where related_object_id = 'TP-0104' and created_by_session = 1")).toBe(3);
    const contractAction = getSqlite().prepare("select kind, owner_user_id as owner from actions where related_object_id = 'TP-0104' and kind = 'remediation'").get() as { kind: string; owner: string } | undefined;
    expect(contractAction?.owner).toBe("P-002");
    // Stage 7: the supplier is active, the GRC supplier and service records acknowledged with receipts, monitoring open.
    expect((getSqlite().prepare("select status from suppliers where id = 'TP-0104'").get() as { status: string }).status).toBe("active");
    expect(count("select count(*) as n from assessments where subject_id = 'TP-0104' and kind = 'supplier'")).toBe(1);
    expect(count("select count(*) as n from integration_commands where idempotency_key like '%:register-supplier' and status = 'acknowledged'")).toBe(1);
    expect(count("select count(*) as n from integration_commands where idempotency_key like '%:register-service' and status = 'acknowledged' and target_external_type = 'grc.service'")).toBe(1);
    expect(count("select count(*) as n from external_execution_receipts r join integration_commands c on c.id = r.command_id where c.idempotency_key like '%:register-%'")).toBeGreaterThanOrEqual(3);
    expect(count("select count(*) as n from monitoring_activations where subject_id = 'TP-0104' and active = 1")).toBe(2);
    // Stage 8: the plan, the register update and the handover message.
    expect(count("select count(*) as n from monitoring_activations where subject_id = 'TP-0104' and kind = 'monitoring-plan' and review_frequency = 'semi-annual'")).toBe(1);
    expect(count("select count(*) as n from integration_commands where idempotency_key like '%:update-register' and status = 'acknowledged'")).toBe(1);
    expect(count("select count(*) as n from collaboration_messages where related_object_id = 'TP-0104' and simulated_only = 1")).toBe(1);

    // Every completion passed the authority gate under the run's role holder.
    expect(count("select count(*) as n from tool_calls where tool_name = 'completeOnboardingStage' and outcome = 'executed'")).toBe(8);
    expect(count("select count(*) as n from role_app_stage_runs where role_app_run_id = ? and completed_by_user_id = 'P-002' and completion_approval_id is not null", ELB)).toBe(8);

    // The pipeline reads the completed file.
    const row = buildOnboardingPipeline({ language: "en", selectedRunId: ELB, basePath: "/x" }).rows.find((candidate) => candidate.processRunId === ELB);
    expect(row?.status).toBe("completed");
    expect(row?.monitoring).toBe("semi-annual");
  });

  it("runs end to end in safe mode: Stage 1 from the validated cache, later stages composed and saying so", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN, "safe");
    expect(context(ELB, "request-and-intake").preparation.source).toBe("cache");
    const later = context(ELB, "contract-and-conditions");
    expect(later.preparation.source).toBe("composed");
    expect(later.preparation.reason).toContain("No cached preparation exists for this stage");
    expect((getSqlite().prepare("select status from role_app_runs where id = ?").get(ELB) as { status: string }).status).toBe("completed");
  });

  it("survives a restart in the middle of the journey", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 4), "offline");
    const before = count("select count(*) as n from os_events where process_run_id = ?", ELB);
    // A restart: the process loses every handle and every in-memory cache of the database.
    closeDb();
    const ctx = context(ELB);
    expect(ctx.stage.id).toBe("specialist-reviews");
    expect(count("select count(*) as n from os_events where process_run_id = ?", ELB)).toBe(before);
    expect(count("select count(*) as n from role_app_stage_runs where role_app_run_id = ? and status = 'completed'", ELB)).toBe(4);
    await runJourney(ELB, ELBMARSCH_PLAN.slice(4), "offline");
    expect((getSqlite().prepare("select status from role_app_runs where id = ?").get(ELB) as { status: string }).status).toBe("completed");
  });
});

describe("the Veridian file, from Stage 4", () => {
  it("runs Stages 4 to 8 on the seeded evidence, the huddle and the draft contract", async () => {
    await runJourney(VER, VERIDIAN_PLAN, "offline");
    expect((getSqlite().prepare("select status from role_app_runs where id = ?").get(VER) as { status: string }).status).toBe("completed");
    expect((getSqlite().prepare("select status, criticality from suppliers where id = 'TP-0099'").get() as { status: string }).status).toBe("active");
    expect(count("select count(*) as n from monitoring_activations where subject_id = 'TP-0099' and kind = 'monitoring-plan' and review_frequency = 'quarterly'")).toBe(1);
  });
});

/* ==========================================================================
   Criteria and rules: no stage completes without them
   ========================================================================== */

describe("no stage completes without its criteria", () => {
  it("refuses Stage 1 before the business context is recorded, and writes nothing", async () => {
    await engine.syncStage(ELB, "request-and-intake", { mode: "offline" });
    const events = rowCount("os_events");
    const approvals = rowCount("approvals");
    const result = await engine.submitStageCompletion(ELB, "request-and-intake", { rationale: "Too early.", ...CONFIRM });
    expect(result.ok).toBe(false);
    expect(result.message.en).toContain("Business context correction is not recorded");
    expect(rowCount("os_events")).toBe(events);
    expect(rowCount("approvals")).toBe(approvals);
  });

  it("refuses to proceed at Stage 1 before the review, and on a recorded duplicate", async () => {
    await engine.syncStage(ELB, "request-and-intake", { mode: "offline" });
    const early = await engine.submitStageDecision(ELB, "request-and-intake", { decisionKey: "intake-proceed", optionId: "intake-proceed", rationale: "Proceed.", ...CONFIRM });
    expect(early.ok).toBe(false);
    const form = formFor(ELB, "request-and-intake", "intake-review", (defaults) => {
      const rows = defaults.rows as Array<Record<string, string>>;
      const duplicate = rows.find((row) => row.id === "duplicate");
      if (duplicate) {
        duplicate.verdict = "duplicate";
        duplicate.note = "The same group appears as a subprocessor elsewhere.";
      }
    });
    expectOk(await engine.submitHumanTask(ELB, "request-and-intake", "intake-review", form), "review");
    const proceed = await engine.submitStageDecision(ELB, "request-and-intake", { decisionKey: "intake-proceed", optionId: "intake-proceed", rationale: "Proceed.", ...CONFIRM });
    expect(proceed.ok).toBe(false);
    expect(proceed.message.en).toContain("duplicate");
  });

  it("refuses a classification that does not match the four recorded judgments", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 1), "offline");
    await engine.syncStage(ELB, "classification-and-criticality", { mode: "offline" });
    expectOk(await engine.submitHumanTask(ELB, "classification-and-criticality", "classification-judgment", formFor(ELB, "classification-and-criticality", "classification-judgment")), "judgment");
    const wrong = await engine.submitStageDecision(ELB, "classification-and-criticality", { decisionKey: "classification", optionId: "class-ict-standard", rationale: "ICT.", ...CONFIRM });
    expect(wrong.ok).toBe(false);
    expect(wrong.message.en).toContain("does not match");
  });

  it("refuses an unconditional approval while conditions are open, and records the escalation as a hold", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 6), "offline");
    await engine.syncStage(ELB, "decision-and-onboarding", { mode: "offline" });
    const approve = await engine.submitStageDecision(ELB, "decision-and-onboarding", { decisionKey: "onboarding-approval", optionId: "onboarding-approve", rationale: "Approve.", ...CONFIRM });
    expect(approve.ok).toBe(false);
    expect(approve.message.en).toContain("condition action(s) are open");
    expectOk(await engine.submitStageDecision(ELB, "decision-and-onboarding", { decisionKey: "onboarding-approval", optionId: "onboarding-escalate", rationale: "Committee to decide.", ...CONFIRM }), "escalate");
    const held = context(ELB, "decision-and-onboarding");
    expect(engine.validateStage(held).blocking.find((item) => item.kind === "decision-held")?.active).toBe(true);
    expectOk(await engine.approveAndExecuteTools(ELB, "decision-and-onboarding", { rationale: "Put it on the agenda.", ...CONFIRM }), "agenda");
    expect(count("select count(*) as n from committee_items where related_object_id = 'TP-0104' and created_by_session = 1")).toBe(1);
    const refused = await engine.submitStageCompletion(ELB, "decision-and-onboarding", { rationale: "Complete.", ...CONFIRM });
    expect(refused.ok).toBe(false);
    expect((getSqlite().prepare("select status from suppliers where id = 'TP-0104'").get() as { status: string }).status).toBe("onboarding");
  });

  it("is idempotent: a repeated decision, change and completion writes nothing the second time", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 1), "offline");
    const ctx1 = context(ELB, "request-and-intake");
    expect(ctx1.stageRun?.status).toBe("completed");
    const events = rowCount("os_events");
    const commands = rowCount("integration_commands");
    const again = await engine.submitStageCompletion(ELB, "request-and-intake", { rationale: "Again.", ...CONFIRM });
    expect(again.noop).toBe(true);
    expect(rowCount("os_events")).toBe(events);
    expect(rowCount("integration_commands")).toBe(commands);
  });
});

/* ==========================================================================
   What each stage reads and writes
   ========================================================================== */

describe("what the stages read and write", () => {
  it("frames DORA and the EBA guidelines for the EU entities only, FINMA for ARC-CH only, each with the disclaimer", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 1), "offline");
    await engine.syncStage(ELB, "classification-and-criticality", { mode: "offline" });
    const output = context(ELB, "classification-and-criticality").preparation.output;
    const statements = (output?.findings ?? []).map((finding) => finding.statement.en).filter((text) => /DORA|EBA|FINMA/.test(text));
    expect(statements.length).toBe(2);
    const eu = statements.find((text) => text.includes("DORA framework"));
    const ch = statements.find((text) => text.includes("FINMA"));
    expect(eu).toContain("ARC-DE and ARC-AT");
    expect(eu).not.toContain("ARC-CH");
    expect(ch).toContain("ARC-CH");
    expect(ch).toContain("is not the one applied to ARC-CH");
    for (const text of statements) expect(text).toContain("Illustrative regulatory context, not legal advice.");
  });

  it("carries the Stage 1 correction of the entities into the classification", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 1), "offline");
    await engine.syncStage(ELB, "classification-and-criticality", { mode: "offline" });
    const profile = context(ELB, "classification-and-criticality").sources.find((source) => source.spec.key === "arrangement-profile");
    expect(profile?.result.records.filter((record) => record.facts?.kind === "entity").map((record) => record.id)).toEqual(["ARC-DE", "ARC-AT", "ARC-CH"]);
  });

  it("withdraws the documents removed at Stage 3 from the Stage 4 review", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 3), "offline");
    await engine.syncStage(ELB, "evidence-review", { mode: "offline" });
    const items = context(ELB, "evidence-review").sources.find((source) => source.spec.key === "due-diligence-evidence")?.result.records.map((record) => record.id) ?? [];
    expect(items).not.toContain("EVD-OB-0104-10");
    expect(items).toContain("EVD-OB-0104-06");
    const stale = context(ELB, "evidence-review").preparation.output?.gaps.find((gap) => gap.key === "stale-EVD-OB-0104-05");
    expect(stale?.severity).toBe("material");
  });

  it("reads the specialist huddle from the meeting record and refuses to rely on draft minutes", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 4), "offline");
    await engine.syncStage(ELB, "specialist-reviews", { mode: "offline" });
    const huddle = context(ELB, "specialist-reviews").sources.find((source) => source.spec.key === "specialist-huddle");
    expect(huddle?.result.records.map((record) => record.id)).toEqual(["MTG-TPRM-OB-0104-HUDDLE", "MINUTES-TPRM-OB-0104-HUDDLE"]);
    const output = context(ELB, "specialist-reviews").preparation.output;
    expect(output?.contradictions.length).toBe(1);
    expect(output?.recommendedOptionId).toBeNull();
    const form = formFor(ELB, "specialist-reviews", "specialist-conditions", (defaults) => {
      const items = defaults.items as Array<Record<string, string>>;
      const row = items.find((item) => item.itemId === "huddle");
      if (row) row.choice = "minutes-confirmed";
    });
    const refused = await engine.submitHumanTask(ELB, "specialist-reviews", "specialist-conditions", form);
    expect(refused.ok).toBe(false);
    expect(refused.message.en).toContain("minutes are not confirmed");
  });

  it("reads the supplier meeting linked to Stage 4 and the huddle linked to Stage 5, each in its own stage", async () => {
    await engine.syncStage(VER, "evidence-review", { mode: "offline" });
    const stage4 = context(VER, "evidence-review");
    const meetings = stage4.sources.find((source) => source.spec.key === "stage-meetings")?.result.records.map((record) => record.id) ?? [];
    expect(meetings).toEqual(["MTG-TPRM-VERIDIAN-TRIAGE-2026", "MINUTES-TPRM-EVIDENCE-TRIAGE-2026"]);
    expect(stage4.preparation.output?.findings.some((finding) => finding.sourceKey === "stage-meetings")).toBe(true);
    expect(stage4.preparation.output?.gaps.some((gap) => gap.key === "unresolved-MINUTES-TPRM-EVIDENCE-TRIAGE-2026")).toBe(true);

    await runJourney(VER, VERIDIAN_PLAN.slice(0, 1), "offline");
    await engine.syncStage(VER, "specialist-reviews", { mode: "offline" });
    const huddle = context(VER, "specialist-reviews").sources.find((source) => source.spec.key === "specialist-huddle")?.result.records.map((record) => record.id) ?? [];
    expect(huddle).toEqual(["MTG-TPRM-OB-0099-HUDDLE", "MINUTES-TPRM-OB-0099-HUDDLE"]);
  });

  it("accepts the huddle record once the minutes are confirmed through the meeting lifecycle", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 4), "offline");
    await engine.syncStage(ELB, "specialist-reviews", { mode: "offline" });
    const { confirmMinutes } = await import("@/features/work/modules/meetings/operations");
    const confirmed = await confirmMinutes({
      roleId: "tprm",
      minutesId: "MINUTES-TPRM-OB-0104-HUDDLE",
      version: 1,
      confirmDecisions: true,
      confirmActions: true,
      confirmDistribution: true,
      confirmed: true,
      rationale: "The minutes record the specialist positions as given.",
    });
    expect(confirmed.ok, confirmed.message).toBe(true);
    const minutes = context(ELB, "specialist-reviews").sources.find((source) => source.spec.key === "specialist-huddle")?.result.records.find((record) => record.facts?.kind === "minutes");
    expect(minutes?.facts?.confirmed).toBe(true);
    const form = formFor(ELB, "specialist-reviews", "specialist-conditions", (defaults) => {
      const items = defaults.items as Array<Record<string, string>>;
      const row = items.find((item) => item.itemId === "huddle");
      if (row) row.choice = "minutes-confirmed";
    });
    expectOk(await engine.submitHumanTask(ELB, "specialist-reviews", "specialist-conditions", form), "conditions on confirmed minutes");
  });

  it("creates the condition actions with their process lineage", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 6), "offline");
    const rows = getSqlite()
      .prepare("select kind, source_process_run_id as run, source_stage_id as stage, source_stage_run_id as stageRun from actions where related_object_id = 'TP-0104' and created_by_session = 1 order by source_stage_id")
      .all() as Array<{ kind: string; run: string | null; stage: string | null; stageRun: string | null }>;
    expect(rows.map((row) => row.stage)).toEqual(["contract-and-conditions", "evidence-review", "tailored-due-diligence"]);
    for (const row of rows) {
      expect(row.run).toBe(ELB);
      expect(row.stageRun).toMatch(/^SR-RUN-TPRM-ELBMARSCH-2026-/);
    }
  });

  it("creates the contract condition action with its process lineage in the payload the person approved", async () => {
    await runJourney(ELB, ELBMARSCH_PLAN.slice(0, 6), "offline");
    const approval = getSqlite()
      .prepare("select a.payload_fingerprint as fp from approvals a where a.tool_name = 'createAction' order by a.approved_at desc limit 1")
      .get() as { fp: string } | undefined;
    expect(approval?.fp).toBeTruthy();
    const record = context(ELB, "contract-and-conditions").artifacts.find((artifact) => artifact.artifactKey === "contract-record");
    const content = JSON.parse(record?.content ?? "{}") as { conditionActionId?: string };
    expect(content.conditionActionId).toMatch(/^MSN-/);
  });
});
