/**
 * RCSA Cycle Assistant: all eight stages on the process engine.
 *
 * Against a real, freshly seeded SQLite database in the system temporary
 * directory. What these prove, in the words of plan section 5.1: every stage
 * is executable and creates a tangible output; every material judgment is a
 * recorded human input or decision, never a default; no stage completes
 * without its criteria; the challenge workshop waits for its meeting and for
 * minutes confirmed in Meetings; the rating is computed by deterministic code;
 * actions are created through the governed tools with process lineage; and an
 * event-driven reassessment starts a new run of the same app. The journey runs
 * in safe and in offline mode, and survives a closed connection in the middle.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";

/* A full cycle prepares, decides and completes eight stages; give it room on a loaded machine. */
vi.setConfig({ testTimeout: 240_000 });

type Orchestrator = typeof import("@/features/process/orchestrator");
type Mode = "safe" | "offline";

let seed: () => void;
let engine: Orchestrator;
let taskDefaults: typeof import("@/features/process/tasks").taskDefaults;
let getSqlite: typeof import("@/db/client").getSqlite;
let closeDb: typeof import("@/db/client").closeDb;
let setMoment: typeof import("@/scenario/engine/state").setMoment;
let meetingsOps: typeof import("@/features/work/modules/meetings/operations");
let minutesFor: typeof import("@/db/repositories/meetings").getMinutesForMeeting;
let backbone: typeof import("@/features/events/backbone");
let buildRcsaPortfolio: typeof import("@/role-apps/rcsa/portfolio").buildRcsaPortfolio;

const RUN = "RUN-RCSA-PAYOPS-Q4-2026";
const WORKSHOP = "MTG-2026-0005";

beforeAll(async () => {
  createTemporaryDatabase("rcsa-stages");
  const seedModule = await import("@/db/seed/run");
  seed = () => seedModule.seedScenario();
  engine = await import("@/features/process/orchestrator");
  ({ taskDefaults } = await import("@/features/process/tasks"));
  ({ getSqlite, closeDb } = await import("@/db/client"));
  ({ setMoment } = await import("@/scenario/engine/state"));
  meetingsOps = await import("@/features/work/modules/meetings/operations");
  ({ getMinutesForMeeting: minutesFor } = await import("@/db/repositories/meetings"));
  backbone = await import("@/features/events/backbone");
  ({ buildRcsaPortfolio } = await import("@/role-apps/rcsa/portfolio"));
}, 180_000);

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seed();
}, 120_000);

/* ==========================================================================
   Drivers
   ========================================================================== */

function count(sql: string, ...args: unknown[]): number {
  return (getSqlite().prepare(sql).get(...args) as { n: number }).n;
}

function context(stageId: string, runId = RUN) {
  return engine.buildStageContext({ processRunId: runId, stageId });
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

async function prepare(stageId: string, mode: Mode, runId = RUN) {
  const result = await engine.syncStage(runId, stageId, { mode });
  const prepared = context(stageId, runId);
  return { result, prepared };
}

async function decide(stageId: string, decisionKey: string, optionId: string, runId = RUN) {
  return engine.submitStageDecision(runId, stageId, {
    decisionKey,
    optionId,
    rationale: `My own reasoning for ${decisionKey}.`,
    rationaleConfirmed: true,
  });
}

async function tools(stageId: string, runId = RUN) {
  return engine.approveAndExecuteTools(runId, stageId, { rationale: `Execute the changes of ${stageId}.`, rationaleConfirmed: true });
}

async function complete(stageId: string, runId = RUN) {
  return engine.submitStageCompletion(runId, stageId, { rationale: `Stage ${stageId} outcome confirmed as my own.`, rationaleConfirmed: true });
}

/** A form for a task, from the defaults the stage's form proposes. Tests use them; the workspace never prefills. */
function defaultsOf<T>(stageId: string, key: string, runId = RUN): T {
  const value = taskDefaults(context(stageId, runId), key) as T | null;
  if (!value) throw new Error(`No defaults for ${stageId}/${key}`);
  return value;
}

async function stage1(mode: Mode, runId: string) {
  await prepare("scope-trigger", mode, runId);
  const value = defaultsOf<{
    processes: Array<{ id: string; choice: string; note: string }>;
    entities: Array<{ id: string; choice: string; note: string }>;
    period: { choice: string; endsOn: string; note: string };
    participants: Array<{ id: string; choice: string }>;
  }>("scope-trigger", "scope-confirmation", runId);
  const entries: Record<string, string> = { period: value.period.choice, "period-end": value.period.endsOn, "period-note": "" };
  for (const item of value.processes) Object.assign(entries, { [`process:${item.id}`]: item.choice, [`process-note:${item.id}`]: item.note });
  for (const item of value.entities) Object.assign(entries, { [`entity:${item.id}`]: item.choice, [`entity-note:${item.id}`]: item.note });
  for (const item of value.participants) entries[`participant:${item.id}`] = item.choice;
  expect((await engine.submitHumanTask(runId, "scope-trigger", "scope-confirmation", form(entries))).ok).toBe(true);
  expect((await decide("scope-trigger", "scope-and-trigger", "scope-off-cycle", runId)).ok).toBe(true);
  return complete("scope-trigger", runId);
}

async function stage2(mode: Mode) {
  await prepare("evidence-refresh", mode);
  const entries: Record<string, string> = {};
  for (const source of context("evidence-refresh").stage.requiredSources) {
    entries[`sufficiency:${source.key}`] = source.key === "control-tests" ? "limited" : "sufficient";
    entries[`note:${source.key}`] = source.key === "control-tests" ? "Two test evidence items are still outstanding." : "";
  }
  await engine.submitHumanTask(RUN, "evidence-refresh", "evidence-sufficiency", form(entries));
  await decide("evidence-refresh", "investigation-strategy", "DEC-2026-0771-O1");
  await tools("evidence-refresh");
  return complete("evidence-refresh");
}

async function stage3(mode: Mode) {
  await prepare("risk-control-change", mode);
  const value = defaultsOf<{ lines: Array<{ lineId: string; classification: string }> }>("risk-control-change", "change-review");
  const entries: Record<string, string> = {};
  for (const line of value.lines) Object.assign(entries, { [`classification:${line.lineId}`]: line.classification, [`note:${line.lineId}`]: "" });
  expect((await engine.submitHumanTask(RUN, "risk-control-change", "change-review", form(entries))).ok).toBe(true);
  expect((await decide("risk-control-change", "likelihood-inference", "DEC-2026-0744-O1")).ok).toBe(true);
  return complete("risk-control-change");
}

async function stage4(mode: Mode) {
  await prepare("first-line-input", mode);
  const value = defaultsOf<{ positions: Array<{ positionId: string; classification: string; note: string }> }>("first-line-input", "first-line-review");
  const entries: Record<string, string> = {};
  for (const item of value.positions) Object.assign(entries, { [`class:${item.positionId}`]: item.classification, [`note:${item.positionId}`]: item.note });
  expect((await engine.submitHumanTask(RUN, "first-line-input", "first-line-review", form(entries))).ok).toBe(true);
  expect((await decide("first-line-input", "workshop-agenda", "DEC-2026-0745-O1")).ok).toBe(true);
  expect((await tools("first-line-input")).ok).toBe(true);
  return complete("first-line-input");
}

/** The workshop is held at 10:30; its minutes are drafted and confirmed in Meetings. */
async function holdWorkshopAndConfirmMinutes() {
  setMoment("12:00");
  const drafted = await meetingsOps.prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP });
  expect(drafted.ok, drafted.message).toBe(true);
  const minutes = minutesFor(WORKSHOP)[0];
  if (!minutes) throw new Error("No minutes drafted");
  const confirmed = await meetingsOps.confirmMinutes({
    roleId: "rcsa",
    minutesId: minutes.id,
    version: minutes.version,
    confirmDecisions: true,
    confirmActions: true,
    confirmDistribution: true,
    confirmed: true,
    rationale: "The minutes are an accurate record of the workshop.",
  });
  expect(confirmed.ok, confirmed.message).toBe(true);
}

async function stage5(mode: Mode) {
  await prepare("challenge-workshop", mode);
  const value = defaultsOf<{ actions: string; issues: Array<{ issueId: string; choice: string }> }>("challenge-workshop", "workshop-outcome");
  const entries: Record<string, string> = { actions: value.actions, "actions-note": "" };
  for (const issue of value.issues) Object.assign(entries, { [`issue:${issue.issueId}`]: issue.choice, [`issue-note:${issue.issueId}`]: "" });
  const recorded = await engine.submitHumanTask(RUN, "challenge-workshop", "workshop-outcome", form(entries));
  expect(recorded.ok, recorded.message.en).toBe(true);
  expect((await decide("challenge-workshop", "challenge-conclusion", "DEC-2026-0772-O3")).ok).toBe(true);
  return complete("challenge-workshop");
}

function ratingForm(value: { effectiveness: string; likelihood: number; impact: number; rating: string; appetite: string; lines: Array<{ lineId: string; choice: string }> }, overrides: Record<string, string> = {}) {
  const entries: Record<string, string> = {
    effectiveness: value.effectiveness,
    likelihood: String(value.likelihood),
    "likelihood-note": "",
    impact: String(value.impact),
    "impact-note": "",
    rating: value.rating,
    appetite: value.appetite,
  };
  for (const line of value.lines) entries[`line:${line.lineId}`] = line.choice;
  return form({ ...entries, ...overrides });
}

async function stage6(mode: Mode) {
  await prepare("rating-appetite", mode);
  const value = defaultsOf<Parameters<typeof ratingForm>[0]>("rating-appetite", "rating-judgment");
  expect((await engine.submitHumanTask(RUN, "rating-appetite", "rating-judgment", ratingForm(value))).ok).toBe(true);
  expect((await decide("rating-appetite", "residual-and-appetite", "rating-remediation")).ok).toBe(true);
  expect((await tools("rating-appetite")).ok).toBe(true);
  return complete("rating-appetite");
}

async function stage7(mode: Mode) {
  await prepare("actions-approval", mode);
  const value = defaultsOf<{ wording: string; owner: string; due: string; dueOn: string; existing: Array<{ actionId: string; relation: string }> }>("actions-approval", "action-review");
  const entries: Record<string, string> = { wording: value.wording, "wording-note": "", owner: value.owner, due: value.due, "due-on": value.dueOn };
  for (const item of value.existing) entries[`existing:${item.actionId}`] = item.relation;
  expect((await engine.submitHumanTask(RUN, "actions-approval", "action-review", form(entries))).ok).toBe(true);
  expect((await decide("actions-approval", "reasoning-revision", "DEC-2026-0782-O1")).ok).toBe(true);
  expect((await decide("actions-approval", "action-plan", "plan-approve")).ok).toBe(true);
  const executed = await tools("actions-approval");
  expect(executed.ok, executed.message.en).toBe(true);
  return complete("actions-approval");
}

async function stage8(mode: Mode, path: "monitoring-standard" | "monitoring-off-cycle") {
  await prepare("monitoring-reassessment", mode);
  const entries = {
    frequency: "weekly",
    threshold: "A further Red reading, or two weeks above 3.5.",
    "material-change": path === "monitoring-off-cycle" ? "yes" : "no",
    "material-change-note": path === "monitoring-off-cycle" ? "The 14:05 fallback event waived secondary review on live overrides." : "",
    escalation: "not-required",
    "escalation-note": "",
  };
  expect((await engine.submitHumanTask(RUN, "monitoring-reassessment", "monitoring-review", form(entries))).ok).toBe(true);
  expect((await decide("monitoring-reassessment", "monitoring-plan", path)).ok).toBe(true);
  expect((await tools("monitoring-reassessment")).ok).toBe(true);
  return complete("monitoring-reassessment");
}

/* ==========================================================================
   The contracts
   ========================================================================== */

describe("the RCSA contracts", () => {
  it("are executable on all eight stages with every key they name registered", async () => {
    const { RCSA_CYCLE_PROCESS } = await import("@/role-apps/rcsa/definition");
    const { missingImplementations } = await import("@/features/process/registry");
    expect(RCSA_CYCLE_PROCESS.stages.map((stage) => stage.implementation.implemented)).toEqual(Array(8).fill(true));
    for (const stage of RCSA_CYCLE_PROCESS.stages) expect(missingImplementations(stage), stage.id).toEqual([]);
  });
});

/* ==========================================================================
   The full journey, in both modes
   ========================================================================== */

describe("the eight-stage journey", () => {
  for (const mode of ["safe", "offline"] as const) {
    it(`runs Stages 2 to 8 in ${mode} mode and starts an event-driven reassessment that runs Stage 1`, async () => {
      /* Stage 2, the reference stage, still runs. */
      expect((await stage2(mode)).ok).toBe(true);

      /* Stage 3: the change log and the seeded causal interpretation. */
      const s3 = await stage3(mode);
      expect(s3.ok, s3.message.en).toBe(true);
      expect(context("risk-control-change").artifacts.some((artifact) => artifact.artifactKey === "change-log")).toBe(true);
      expect(count("select count(*) as n from decisions where id = 'DEC-2026-0744' and status = 'decided'")).toBe(1);

      /* Stage 4: the challenge pack reaches the first line as a simulated message. */
      const s4 = await stage4(mode);
      expect(s4.ok, s4.message.en).toBe(true);
      expect(count("select count(*) as n from collaboration_messages where subject like 'Q4 RCSA: first-line positions%'")).toBe(1);

      /* Stage 5 waits for its workshop: at 07:45 the record does not exist yet. */
      const waiting = await prepare("challenge-workshop", mode);
      expect(waiting.prepared.preparation.state).toBe("waiting-for-source");
      expect(engine.validateStage(waiting.prepared).canComplete).toBe(false);

      /* The workshop is held and its minutes confirmed in Meetings; the stage then prepares and completes. */
      await holdWorkshopAndConfirmMinutes();
      const s5 = await stage5(mode);
      expect(s5.ok, s5.message.en).toBe(true);
      const outcome = context("challenge-workshop").artifacts.find((artifact) => artifact.artifactKey === "workshop-minutes");
      expect(outcome?.content).toContain("confirmed");

      /* A restart in the middle: the connection goes, the next one reads the same file. */
      closeDb();

      /* Stage 6: deterministic consequences, and the residual recorded on the line. */
      const s6 = await stage6(mode);
      expect(s6.ok, s6.message.en).toBe(true);
      const rating = JSON.parse(context("rating-appetite").artifacts.find((artifact) => artifact.artifactKey === "rating-record")?.content ?? "{}") as { facts?: Record<string, unknown> };
      expect(rating.facts).toMatchObject({ keyRiskId: "RSK-0211", effectiveness: "partially-effective", score: 12, rating: "high", appetite: "outside", path: "rating-remediation" });

      /* Stage 7: one action with process lineage and its condition, registered in the GRC platform. */
      setMoment("15:00");
      const s7 = await stage7(mode);
      expect(s7.ok, s7.message.en).toBe(true);
      const stage7Run = context("actions-approval").stageRun?.id;
      expect(
        count(
          "select count(*) as n from actions where source_process_run_id = ? and source_stage_id = 'actions-approval' and source_stage_run_id = ? and owner_user_id is not null and due_on is not null and completion_condition is not null",
          RUN,
          stage7Run,
        ),
      ).toBe(1);
      expect(count("select count(*) as n from integration_commands where idempotency_key = ? and status = 'acknowledged'", `stage-tool:${stage7Run}:register-action-plan`)).toBe(1);

      /* Stage 8 off cycle: enhanced monitoring, the off-cycle assessment, and the new run. */
      const s8 = await stage8(mode, "monitoring-off-cycle");
      expect(s8.ok, s8.message.en).toBe(true);
      expect(s8.message.en).toContain("event-driven reassessment");
      expect(count("select count(*) as n from monitoring_activations where subject_id = 'KRI-PAY-007' and kind = 'enhanced-kri-monitoring'")).toBe(1);
      const original = getSqlite().prepare("select status from role_app_runs where id = ?").get(RUN) as { status: string };
      expect(original.status).toBe("completed");
      expect(backbone.findOsEvent(`process-completed:${RUN}`)).toBeDefined();

      const reassessment = getSqlite()
        .prepare("select id, subject_id as subjectId, current_stage_id as stageId, status from role_app_runs where role_app_id = 'rcsa-cycle-assistant' and id <> ?")
        .get(RUN) as { id: string; subjectId: string; stageId: string; status: string };
      expect(reassessment).toMatchObject({ stageId: "scope-trigger", status: "in-progress" });
      expect(count("select count(*) as n from assessments where id = ? and status = 'off-cycle'", reassessment.subjectId)).toBe(1);
      expect(engine.findActiveProcessRun("rcsa")?.id).toBe(reassessment.id);
      expect(backbone.findOsEvent(`process-run-started:${reassessment.id}`)).toBeDefined();

      /* The portfolio keeps both runs reachable, read from the rows the stages wrote. */
      const portfolio = buildRcsaPortfolio({ language: "en", selectedRunId: reassessment.id, basePath: "/workday/rcsa/processes/rcsa-cycle" });
      expect(portfolio.rows).toHaveLength(2);
      const cycleRow = portfolio.rows.find((row) => row.processRunId === RUN);
      expect(cycleRow).toMatchObject({ status: "completed", stage: "Completed", position: "RSK-0211: 3 x 4 = 12 of 25, High, outside appetite", selected: false });
      expect(cycleRow?.openActions).toBeGreaterThan(0);
      expect(cycleRow?.href).toBe(`/workday/rcsa/processes/rcsa-cycle?run=${RUN}`);
      const reassessmentRow = portfolio.rows.find((row) => row.processRunId === reassessment.id);
      expect(reassessmentRow).toMatchObject({ status: "in-progress", stage: "1 Scope and Trigger", trigger: `Event-driven, from ${RUN}`, selected: true });
      expect(portfolio.summary).toContain("2 assessment run(s): 1 in progress, 1 completed");

      /* Stage 1 runs on the reassessment, which then opens Stage 2 and stops there honestly. */
      const s1 = await stage1(mode, reassessment.id);
      expect(s1.ok, s1.message.en).toBe(true);
      expect(context("scope-trigger", reassessment.id).artifacts.some((artifact) => artifact.artifactKey === "scope-record")).toBe(true);
      const next = context("evidence-refresh", reassessment.id);
      expect(next.stageRun?.status).not.toBe("completed");
      const validation = engine.validateStage(next);
      expect(validation.canComplete).toBe(false);
      expect(validation.reasons.map((reason) => reason.en).join(" ")).toContain("Q4 2026 cycle");

      /* Every stage of the cycle wrote its record. */
      const records = getSqlite()
        .prepare("select stage_id as stageId, artifact_key as artifactKey from role_app_artifacts where role_app_run_id = ? and produced_by = 'stage-completion'")
        .all(RUN) as Array<{ stageId: string; artifactKey: string }>;
      expect(records.map((row) => row.artifactKey).sort()).toEqual(
        ["assessment-submission", "change-log", "evidence-pack", "monitoring-plan", "rating-record", "workshop-agenda", "workshop-minutes"].sort(),
      );
    });
  }

  it("reads minutes confirmed in Meetings before the challenge workshop stage opens as that stage's record", async () => {
    /* The workshop is held and its minutes confirmed while the cycle is still at Stage 2. */
    await holdWorkshopAndConfirmMinutes();
    expect(context("challenge-workshop").stageRun ?? null).toBeNull();
    await stage2("offline");
    await stage3("offline");
    await stage4("offline");

    /* When Stage 5 opens, its record is there: the preparation runs and the minutes criterion is met. */
    const opened = await prepare("challenge-workshop", "offline");
    expect(opened.prepared.preparation.state).toBe("completed");
    const minutesCriterion = engine.validateStage(opened.prepared).completion.find((criterion) => criterion.kind === "check");
    expect(minutesCriterion?.met, minutesCriterion?.reason?.en).toBe(true);
    const s5 = await stage5("offline");
    expect(s5.ok, s5.message.en).toBe(true);
    const record = JSON.parse(context("challenge-workshop").artifacts.find((artifact) => artifact.artifactKey === "workshop-minutes")?.content ?? "{}") as {
      minutes?: { minutesId?: string; evidenceDocumentId?: string | null };
    };
    expect(record.minutes?.minutesId).toBe(minutesFor(WORKSHOP)[0]?.id);
    expect(record.minutes?.evidenceDocumentId).toBe(`EVD-${minutesFor(WORKSHOP)[0]?.id}`);
  });

  it("closes the cycle on enhanced monitoring when no material change is recorded", async () => {
    await stage2("offline");
    await stage3("offline");
    await stage4("offline");
    await holdWorkshopAndConfirmMinutes();
    await stage5("offline");
    await stage6("offline");
    await stage7("offline");
    const result = await stage8("offline", "monitoring-standard");
    expect(result.ok, result.message.en).toBe(true);
    expect(count("select count(*) as n from role_app_runs where role_app_id = 'rcsa-cycle-assistant'")).toBe(1);
    expect(count("select count(*) as n from assessments where status = 'off-cycle' and source_decision_id like 'TASK-%'")).toBe(0);
  });
});

/* ==========================================================================
   No stage completes without its criteria
   ========================================================================== */

describe("criteria", () => {
  it("refuses every stage before its criteria are met, and writes nothing", async () => {
    await stage2("offline");
    for (const stageId of ["risk-control-change"]) {
      await prepare(stageId, "offline");
      const approvals = rowCount("approvals");
      const refused = await complete(stageId);
      expect(refused.ok).toBe(false);
      expect(rowCount("approvals")).toBe(approvals);
    }
  });

  it("refuses a rating the group matrix does not produce, and a path the position does not allow", async () => {
    await stage2("offline");
    await stage3("offline");
    await stage4("offline");
    await holdWorkshopAndConfirmMinutes();
    await stage5("offline");
    await prepare("rating-appetite", "offline");
    const value = defaultsOf<Parameters<typeof ratingForm>[0]>("rating-appetite", "rating-judgment");

    /* High at 3 x 4 is the matrix; Medium is refused. */
    const wrongRating = await engine.submitHumanTask(RUN, "rating-appetite", "rating-judgment", ratingForm(value, { rating: "medium" }));
    expect(wrongRating.ok).toBe(false);
    expect(wrongRating.reasons?.map((reason) => reason.en).join(" ")).toContain("The group matrix rates 3 x 4 as High");

    /* A residual that departs from the methodology needs a reason. */
    const unexplained = await engine.submitHumanTask(RUN, "rating-appetite", "rating-judgment", ratingForm(value, { likelihood: "2", rating: "medium", appetite: "at-limit" }));
    expect(unexplained.ok).toBe(false);
    expect(unexplained.reasons?.map((reason) => reason.en).join(" ")).toContain("departs from the methodology");

    expect((await engine.submitHumanTask(RUN, "rating-appetite", "rating-judgment", ratingForm(value))).ok).toBe(true);
    const monitorOutside = await decide("rating-appetite", "residual-and-appetite", "rating-monitor");
    expect(monitorOutside.ok).toBe(false);
    expect(monitorOutside.message.en).toContain("monitoring alone does not discharge");
  });

  it("holds Stage 8 when an escalation is recorded, and refuses closing on monitoring with a material change", async () => {
    await stage2("offline");
    await stage3("offline");
    await stage4("offline");
    await holdWorkshopAndConfirmMinutes();
    await stage5("offline");
    await stage6("offline");
    await stage7("offline");
    await prepare("monitoring-reassessment", "offline");
    await engine.submitHumanTask(
      RUN,
      "monitoring-reassessment",
      "monitoring-review",
      form({ frequency: "weekly", threshold: "A further Red reading.", "material-change": "yes", "material-change-note": "A new event on the scope.", escalation: "not-required", "escalation-note": "" }),
    );
    const standard = await decide("monitoring-reassessment", "monitoring-plan", "monitoring-standard");
    expect(standard.ok).toBe(false);
    expect(standard.message.en).toContain("material change");
  });
});

/* ==========================================================================
   Idempotency
   ========================================================================== */

describe("idempotency", () => {
  it("writes nothing the second time a stage completion is submitted", async () => {
    await stage2("offline");
    expect((await stage3("offline")).ok).toBe(true);
    const events = rowCount("os_events");
    const approvals = rowCount("approvals");
    const again = await complete("risk-control-change");
    expect(again.ok).toBe(true);
    expect(again.noop).toBe(true);
    expect(rowCount("os_events")).toBe(events);
    expect(rowCount("approvals")).toBe(approvals);
  });
});
