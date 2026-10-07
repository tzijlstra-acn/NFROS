/**
 * The AI Partner in Wave 3: real routines, the suggestion lifecycle, feedback
 * and the durable context, against a seeded scenario in a temporary database.
 *
 * What is asserted is rows and the mechanism behind them:
 *
 *   a routine runs once per routine, window and object, whoever asks;
 *   every run is recorded with its outputs (lineage), publishes
 *   `routine-completed`, and appears on Home and in Updates;
 *   the authority gate decides every routine step, and a refused step creates
 *   nothing and leaves a blocked tool call behind;
 *   an answer is stored with its history, accepting a material suggestion
 *   records only the acceptance, and the decision's governed path is what
 *   makes it executed;
 *   regenerating a suggestion keeps the person's answer;
 *   feedback is stored with its links and readable by the console;
 *   the context is kept outside the transcript and follows the selection.
 *
 * See `support/harness.ts` for the isolation guarantee.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { requireScenarioState, setAutonomyLevel, setMoment } from "@/scenario/engine/state";
import { setResolvedDemoMode } from "@/server/config/runtime";
import "@/agents/tools/mutations";
import "@/agents/tools/reads";
import { seedAiPartner } from "@/agents/suggestions/seed";
import { persistSuggestion } from "@/agents/suggestions/generate";
import type { SuggestionDraft } from "@/agents/suggestions/validate";
import { resetSingleFlight } from "@/agents/suggestions/digest";
import { postChatTurn } from "@/agents/chat/service";
import { listRoutineRuns, getRoutineRunOutputs } from "@/db/repositories/ai-routine-runs";
import { getSuggestionDispositionHistory } from "@/db/repositories/suggestion-dispositions";
import { listAIFeedback } from "@/db/repositories/ai-feedback";
import { getPartnerContext } from "@/db/repositories/partner-context";
import { getActiveSuggestions } from "@/db/repositories/partner";
import { countSuggestionsNeedingYou } from "@/db/repositories/header";
import { listNotifications } from "@/db/repositories/notifications";
import { listOsEvents } from "@/features/events/backbone";
import { readHomeView } from "@/features/home/read";
import { readUpdates } from "@/features/updates/read";
import { runDueRoutines, scheduleDueRoutines } from "@/features/routines/runner";
import { answerSuggestion, settleSuggestionLifecycle } from "@/features/partner/lifecycle";
import { togglePartnerFeedback } from "@/features/partner/feedback";
import { syncPartnerContext } from "@/features/partner/context";
import { EMPTY_FOCUS } from "@/features/partner/focus";
import { markRoutineNotificationRead } from "@/features/partner/notifications";
import { countNeedingYou } from "@/features/partner/rules";
import { recordDecisionAndExecute } from "@/scenario/engine/decide";

const sqlite = () => getSqlite();
const count = (sql: string, ...args: unknown[]) => (sqlite().prepare(sql).get(...args) as { n: number }).n;

beforeAll(() => {
  createTemporaryDatabase("ai-partner-routines");
  seedScenario(DEFAULT_RUN_ID);
  seedAiPartner(DEFAULT_RUN_ID);
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  resetSingleFlight();
  setResolvedDemoMode("safe");
});

/* ==========================================================================
   Routines
   ========================================================================== */

describe("the routine runner", () => {
  it("records no run before the clock reaches a trigger the seed does not fake", () => {
    expect(count("select count(*) as n from ai_routine_runs")).toBe(0);
    expect(count("select count(*) as n from ai_routines where last_run_at is not null")).toBe(0);
  });

  it("runs each due routine once per window and object, however often it is asked", async () => {
    setMoment("10:05", { runId: DEFAULT_RUN_ID });
    const first = await runDueRoutines();
    expect(first.length).toBeGreaterThan(0);
    const runs = count("select count(*) as n from ai_routine_runs");
    const jobs = count("select count(*) as n from background_jobs where job_kind = 'ai-routine'");
    const suggestions = count("select count(*) as n from ai_suggestions where id like 'SUG-RTN-%'");

    const second = await runDueRoutines();
    expect(second).toEqual([]);
    expect(scheduleDueRoutines().filter((job) => job.status === "pending")).toEqual([]);
    expect(count("select count(*) as n from ai_routine_runs")).toBe(runs);
    expect(count("select count(*) as n from background_jobs where job_kind = 'ai-routine'")).toBe(jobs);
    expect(count("select count(*) as n from ai_suggestions where id like 'SUG-RTN-%'")).toBe(suggestions);
  });

  it("prepares the workshop brief before it starts, with lineage and a backbone event", () => {
    const run = listRoutineRuns({ routineId: "pre-meeting-prep-rcsa" })[0];
    expect(run?.status).toBe("completed");
    expect(run?.outcome).toBe("created-work");
    expect(run?.osEventId).toBeTruthy();
    const outputs = getRoutineRunOutputs(run?.id ?? "");
    expect(outputs.map((output) => `${output.objectKind}:${output.objectId}`)).toContain("meeting-preparation:MTG-2026-0005");
    const suggestionId = outputs.find((output) => output.objectKind === "suggestion")?.objectId ?? "";
    const row = sqlite().prepare("select * from ai_suggestions where id = ?").get(suggestionId) as Record<string, unknown>;
    expect(row["validated_at"]).toBeTruthy();
    expect(JSON.parse(String(row["actions_completed"]))).toEqual([]);
    expect(row["authority_class"]).toBe("DRAFT");

    const event = listOsEvents({ types: ["routine-completed"] }).find((entry) => entry.id === run?.osEventId);
    expect(event?.payload["createdCount"]).toBe(1);
    expect(event?.subjectKind).toBe("meeting");
    expect(event?.subjectId).toBe("MTG-2026-0005");
    expect(count("select count(*) as n from ai_routines where id = 'pre-meeting-prep-rcsa' and last_run_at = '2026-10-06T10:05:00.000Z'")).toBe(1);
  });

  it("drafts reminders only, and proposes triage without classifying anything", () => {
    const followUp = listRoutineRuns({ routineId: "action-follow-up-rcsa" })[0];
    expect(followUp?.outcome).toBe("created-work");
    expect(getRoutineRunOutputs(followUp?.id ?? "").map((output) => output.objectId)).toContain("MSN-2026-0166");
    // Nothing was sent or written to the action's history: a draft is not a step.
    expect(count("select count(*) as n from action_updates")).toBe(0);

    const triage = listRoutineRuns({ routineId: "inbox-triage-rcsa" })[0];
    expect(triage?.outcome).toBe("created-work");
    expect(count("select count(*) as n from inbox_messages where role_id = 'rcsa' and confirmed_triage is not null")).toBe(0);
  });

  it("states the run on Home with its outputs, and raises it in Updates within the ledger", () => {
    const state = requireScenarioState();
    const home = readHomeView("rcsa", state);
    const statements = [...home.partner.statements, ...home.partner.more];
    const routine = statements.find((statement) => statement.source === "routine" && statement.lineage.some((ref) => ref.id === "MTG-2026-0005"));
    expect(routine).toBeTruthy();
    expect(routine?.lineage.find((ref) => ref.id === "MTG-2026-0005")?.href).toContain("/work");

    const updates = readUpdates("rcsa", state);
    const routineUpdates = [...updates.raised, ...updates.heldBack].filter((item) => item.key.startsWith("routine:"));
    expect(routineUpdates.length).toBeGreaterThan(0);
    const ledger = listNotifications({ roleId: "rcsa" });
    expect(ledger.every((row) => row.category === "routine-created-work")).toBe(true);
    expect(ledger.filter((row) => row.budgetOutcome === "raised").length).toBeLessThanOrEqual(5);

    const raised = updates.raised.find((item) => item.key.startsWith("routine:"));
    if (raised?.readableEventId) {
      expect(markRoutineNotificationRead("rcsa", raised.readableEventId)).toBe(true);
      expect(readUpdates("rcsa", state).raised.some((item) => item.key === raised.key)).toBe(false);
    }
  });

  it("raises the 14:05 shared event as a material change bearing on the open work", async () => {
    setMoment("14:10", { runId: DEFAULT_RUN_ID });
    await runDueRoutines();
    const watch = listRoutineRuns({ routineId: "kri-control-watch" }).find((run) => run.outcome === "created-work");
    expect(watch).toBeTruthy();
    expect(getRoutineRunOutputs(watch?.id ?? "").map((output) => output.objectId)).toContain("WLE-TL-M08");

    // Every message the first triage covered is lineage; the later batch proposes only new arrivals.
    const triage = listRoutineRuns({ routineId: "inbox-triage-rcsa" });
    expect(triage.length).toBe(2);
    const covered = (run: (typeof triage)[number] | undefined) =>
      getRoutineRunOutputs(run?.id ?? "").filter((output) => output.objectKind === "inbox-triage-proposal").map((output) => output.objectId);
    const [later, earlier] = triage;
    expect(covered(earlier)).toContain("IMSG-2026-0029");
    expect(covered(later)).not.toContain("IMSG-2026-0020");
    expect(covered(later)).toContain("IMSG-2026-0032");
  });

  it("lets the authority gate refuse a draft at the Assist level, creating nothing", async () => {
    setAutonomyLevel("assist", { runId: DEFAULT_RUN_ID });
    setMoment("16:05", { runId: DEFAULT_RUN_ID });
    const before = count("select count(*) as n from ai_suggestions where id like 'SUG-RTN-%'");
    await runDueRoutines();
    const refused = listRoutineRuns({ routineId: "pre-meeting-prep-rcsa" }).find((run) => run.triggerRef === "MTG-2026-0007");
    expect(refused?.outcome).toBe("needs-human");
    expect(getRoutineRunOutputs(refused?.id ?? "")).toEqual([]);
    expect(count("select count(*) as n from tool_calls where tool_name = 'prepareChallengeQuestions' and outcome = 'blocked'")).toBeGreaterThan(0);
    const created = count("select count(*) as n from ai_suggestions where id like 'SUG-RTN-%'") - before;
    // Only the READ watch may still have prepared something; no draft or proposal was created.
    expect(count("select count(*) as n from ai_suggestions where id like 'SUG-RTN-%' and authority_class in ('DRAFT','PROPOSE') and at_moment = '16:05'")).toBe(0);
    expect(created).toBeGreaterThanOrEqual(0);
    setAutonomyLevel("act-with-approval", { runId: DEFAULT_RUN_ID });
  });
});

/* ==========================================================================
   The lifecycle
   ========================================================================== */

describe("the suggestion lifecycle", () => {
  it("accepting a material suggestion records the answer only; the decision's governed path executes it", async () => {
    setMoment("07:45", { runId: DEFAULT_RUN_ID });
    const state = requireScenarioState();
    const needsBefore = countSuggestionsNeedingYou("rcsa", state.currentMoment);
    expect(needsBefore).toBe(countNeedingYou(getActiveSuggestions("rcsa", state.currentMoment)));

    const approvalsBefore = count("select count(*) as n from approvals");
    const result = answerSuggestion({ roleId: "rcsa", suggestionId: "SUG-SEED-rcsa-morning", answer: "accept" }, state);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next?.href).toBe("/workday/rcsa/decisions#DEC-2026-0771");
    expect(count("select count(*) as n from approvals")).toBe(approvalsBefore);
    expect(count("select count(*) as n from decisions where id = 'DEC-2026-0771' and status = 'open'")).toBe(1);
    expect(countSuggestionsNeedingYou("rcsa", state.currentMoment)).toBe(needsBefore - 1);

    const option = sqlite().prepare("select id from decision_options where decision_id = 'DEC-2026-0771' order by id limit 1").get() as { id: string };
    await recordDecisionAndExecute({ decisionId: "DEC-2026-0771", optionId: option.id, rationale: "My own judgment on the evidence.", rationaleConfirmed: true, actingRoleId: "rcsa" });
    expect(settleSuggestionLifecycle("rcsa", requireScenarioState())).toBeGreaterThan(0);
    const history = getSuggestionDispositionHistory("SUG-SEED-rcsa-morning").map((step) => step.toDisposition);
    expect(history).toEqual(["accepted", "executed"]);
    expect(settleSuggestionLifecycle("rcsa", requireScenarioState())).toBe(0);
  });

  it("refuses a rejection without a reason, and stores one with it", () => {
    const state = requireScenarioState();
    const target = getActiveSuggestions("tprm", state.currentMoment)[0];
    expect(target).toBeTruthy();
    const refused = answerSuggestion({ roleId: "tprm", suggestionId: target?.id ?? "", answer: "reject" }, state);
    expect(refused.ok).toBe(false);
    const rejected = answerSuggestion({ roleId: "tprm", suggestionId: target?.id ?? "", answer: "reject", reason: "The supplier already sent it." }, state);
    expect(rejected.ok).toBe(true);
    const last = getSuggestionDispositionHistory(target?.id ?? "").at(-1);
    expect(last?.toDisposition).toBe("rejected");
    expect(last?.reason).toBe("The supplier already sent it.");
    expect(getActiveSuggestions("tprm", state.currentMoment).some((entry) => entry.id === target?.id)).toBe(false);
    // Closed: a second answer changes nothing.
    expect(answerSuggestion({ roleId: "tprm", suggestionId: target?.id ?? "", answer: "accept" }, state).ok).toBe(false);
  });

  it("keeps the person's answer when an unchanged suggestion is regenerated, and records a changed one", () => {
    const row = sqlite().prepare("select * from ai_suggestions where id = 'SUG-SEED-rcsa-morning'").get() as Record<string, string>;
    const draft = {
      headline: row["headline"],
      changeSummary: row["change_summary"],
      whyItMatters: row["why_it_matters"],
      checksCompleted: JSON.parse(row["checks_completed"] ?? "[]"),
      actionsCompleted: JSON.parse(row["actions_completed"] ?? "[]"),
      recommendedAction: row["recommended_action"],
      alternatives: JSON.parse(row["alternatives"] ?? "[]"),
      evidenceIds: JSON.parse(row["evidence_ids"] ?? "[]"),
      confidence: Number(row["confidence"]),
      uncertainty: JSON.parse(row["uncertainty"] ?? "[]"),
      decisionRequired: Boolean(row["decision_required"]),
      recommendedToolName: null,
      grounding: { verifiedFacts: [], approvedRecords: [], stakeholderStatements: [], modelInference: [], conflictingEvidence: [] },
    } as unknown as SuggestionDraft;
    const base = {
      id: "SUG-SEED-rcsa-morning",
      runId: DEFAULT_RUN_ID,
      roleId: "rcsa" as const,
      eventId: null,
      objectType: row["object_type"] ?? "risk",
      objectId: row["object_id"] ?? "RSK-0211",
      atMoment: "07:45",
      priority: "high" as const,
      decisionId: row["decision_id"] ?? null,
      authorityClass: row["authority_class"] as never,
      source: "seeded" as const,
      constrained: false,
      missingRequiredSources: [],
      sourceConnectorIds: [],
      stages: [],
      stateDigest: row["state_digest"] ?? "",
      model: "",
      durationMs: 0,
      validatedAt: new Date().toISOString(),
    };
    const kept = persistSuggestion({ ...base, draft });
    expect(kept.disposition).toBe("executed");

    const changed = persistSuggestion({ ...base, draft: { ...draft, headline: `${draft.headline} Revised.` } });
    expect(changed.disposition).toBe("new");
    expect(getSuggestionDispositionHistory("SUG-SEED-rcsa-morning").map((step) => step.toDisposition)).toEqual([
      "accepted",
      "executed",
      "expired",
      "new",
    ]);
  });
});

/* ==========================================================================
   Feedback and context
   ========================================================================== */

describe("feedback and the durable context", () => {
  it("stores structured feedback with its links, readable by the console", () => {
    const state = requireScenarioState();
    const run = listRoutineRuns({ roleId: "rcsa", statuses: ["completed"] }).find((entry) => entry.outcome === "created-work");
    const given = togglePartnerFeedback({ roleId: "rcsa", targetKind: "routine-run", targetId: run?.id ?? "", kind: "useful" }, state);
    expect(given.ok && given.given).toBe(true);
    const flipped = togglePartnerFeedback({ roleId: "rcsa", targetKind: "routine-run", targetId: run?.id ?? "", kind: "not-useful" }, state);
    expect(flipped.ok && flipped.kinds).toEqual(["not-useful"]);
    togglePartnerFeedback({ roleId: "rcsa", targetKind: "routine-run", targetId: run?.id ?? "", kind: "missing-context" }, state);

    const rows = listAIFeedback({ roleId: "rcsa" });
    expect(rows.map((row) => row.kind).sort()).toEqual(["missing-context", "not-useful"]);
    for (const row of rows) {
      expect(row.targetKind).toBe("routine-run");
      expect(row.taskKind).not.toBe("");
      expect(row.promptVersion).toMatch(/^routine-/);
      expect(row.userId).toBe("P-003");
      expect(Array.isArray(row.sourceRefs)).toBe(true);
    }
    // Feedback on another role's output is refused.
    expect(togglePartnerFeedback({ roleId: "tprm", targetKind: "routine-run", targetId: run?.id ?? "", kind: "useful" }, state).ok).toBe(false);
  });

  it("keeps the context outside the transcript, and a selection updates it", async () => {
    const state = requireScenarioState();
    const first = syncPartnerContext("rcsa", { ...EMPTY_FOCUS, surface: "work", workItem: { kind: "meeting", id: "MTG-2026-0005" } }, state);
    expect(first?.meetingId).toBe("MTG-2026-0005");
    expect(first?.processRunId).toBe("RUN-RCSA-PAYOPS-Q4-2026");
    expect(first?.stageId).toBe("challenge-workshop");
    expect(first?.selectedObjectId).toBe("CTL-PAY-014");
    expect(first?.legalEntityId).toBeTruthy();

    const same = syncPartnerContext("rcsa", { ...EMPTY_FOCUS, surface: "work", workItem: { kind: "meeting", id: "MTG-2026-0005" } }, state);
    expect(same?.version).toBe(first?.version);

    const next = syncPartnerContext("rcsa", { ...EMPTY_FOCUS, surface: "decisions", decisionId: "DEC-2026-0771", selection: { objectType: "decision", objectId: "DEC-2026-0771" } }, state);
    expect(next?.decisionId).toBe("DEC-2026-0771");
    expect(next?.meetingId).toBeNull();
    expect((next?.version ?? 0)).toBeGreaterThan(first?.version ?? 0);
    expect(next?.priorDecisionIds).toContain("DEC-2026-0771");

    setResolvedDemoMode("offline");
    syncPartnerContext("rcsa", { ...EMPTY_FOCUS, surface: "home", selection: { objectType: "control", objectId: "CTL-PAY-014" } }, state);
    const answer = await postChatTurn({ roleId: "rcsa", input: "what changed", runId: DEFAULT_RUN_ID });
    const turn = sqlite().prepare("select context_object_id as id from chat_turns where thread_id = ? and author = 'user' order by sequence desc").get(answer.threadId) as { id: string };
    expect(turn.id).toBe("CTL-PAY-014");
    expect(getPartnerContext("P-003", "rcsa")?.chatThreadId).toBe(answer.threadId);
  });
});
