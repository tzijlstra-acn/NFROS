/**
 * The meeting lifecycle (plan section 4.6), against a real database.
 *
 * Tried through the same operation functions the server actions call, on the
 * seeded day:
 *
 *   the seeded minutes are referentially intact (audit T20), and the
 *   recorded links of migration 0005 are in place;
 *   before the meeting the preparation is validated and served in safe mode;
 *   nothing can be captured or drafted before the meeting starts;
 *   during the meeting statements are captured into a versioned draft, and
 *   a stale or invalid capture writes nothing;
 *   after the meeting the draft is prepared in safe or offline mode, keeps
 *   the person's captures, and is editable;
 *   confirmation is one governed, transactional, idempotent operation: the
 *   minutes become evidence with lineage, actions are raised with meeting
 *   lineage, the meeting is held, the backbone hears it, the process stage is
 *   brought up to date through the engine's public API, the decisions are
 *   recorded as discussed, the approval is bound and consumed, and the
 *   distribution is a simulated, audited message;
 *   search finds the confirmed minutes;
 *   the gate, the role boundary and a failing write all leave nothing behind.
 *
 * Runs against a temporary database. See `support/harness.ts`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { requireScenarioState, setAutonomyLevel, setMoment } from "@/scenario/engine/state";
import { setResolvedDemoMode } from "@/server/config/runtime";
import {
  captureMeetingItem,
  confirmMinutes,
  prepareMinutes,
  saveMinutes,
  type CaptureInput,
} from "@/features/work/modules/meetings/operations";
import { getMinutesById } from "@/db/repositories/meetings";
import { buildWorkHub } from "@/features/work/hub";
import { listOsEvents } from "@/features/events/backbone";
import { readSearchPayload } from "@/features/search/read";
import type { MinutesDraft } from "@/features/work/modules/meetings/ai-schema";

const WORKSHOP = "MTG-2026-0005";
const WORKSHOP_MINUTES = "MIN-2026-0005";
const CHALLENGE = "MTG-2026-0002";
const CHALLENGE_MINUTES = "MIN-2026-0002";
const TRIAGE_MINUTES = "MINUTES-TPRM-EVIDENCE-TRIAGE-2026";

function count(sql: string, ...args: unknown[]): number {
  return (getSqlite().prepare(sql).get(...args) as { n: number }).n;
}

function row<T>(sql: string, ...args: unknown[]): T {
  return getSqlite().prepare(sql).get(...args) as T;
}

function capture(overrides: Partial<CaptureInput> = {}) {
  return captureMeetingItem({
    roleId: "rcsa",
    meetingId: WORKSHOP,
    kind: "fact",
    turnId: "MTM-2026-0005-06",
    text: "Population 1,204 overrides; sample of 60; four exceptions and two items not concluded.",
    decisionId: null,
    outcome: "referred",
    existingActionId: null,
    ownerUserId: null,
    ownerLabel: "",
    dueOn: null,
    actionKind: "evidence-request",
    completionCondition: "",
    evidenceIds: ["EVD-2026-41850"],
    ...overrides,
  });
}

function confirm(minutesId: string, version: number, roleId: "rcsa" | "tprm" = "rcsa") {
  return confirmMinutes({
    roleId,
    minutesId,
    version,
    confirmDecisions: true,
    confirmActions: true,
    confirmDistribution: true,
    confirmed: true,
    rationale: "These are my minutes of the meeting, checked against the record.",
  });
}

function draftOf(minutesId: string): MinutesDraft {
  const minutes = getMinutesById(minutesId);
  if (!minutes?.draft) throw new Error(`${minutesId} has no draft.`);
  return minutes.draft as unknown as MinutesDraft;
}

beforeAll(() => {
  createTemporaryDatabase("meeting-lifecycle");
  setResolvedDemoMode("safe");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  setResolvedDemoMode("safe");
  seedScenario();
});

describe("the seeded day", () => {
  it("resolves every reference the seeded minutes make (audit T20)", () => {
    const minutes = getSqlite().prepare("select * from meeting_minutes").all() as Array<Record<string, string>>;
    expect(minutes.length).toBeGreaterThanOrEqual(2);
    for (const entry of minutes) {
      expect(count("select count(*) as n from meetings where id = ?", entry.meeting_id), `${entry.id} meeting`).toBe(1);
      for (const id of JSON.parse(entry.decision_ids ?? "[]") as string[]) {
        expect(count("select count(*) as n from decisions where id = ?", id), `${entry.id} decision ${id}`).toBe(1);
      }
      for (const id of JSON.parse(entry.action_ids ?? "[]") as string[]) {
        expect(count("select count(*) as n from actions where id = ?", id), `${entry.id} action ${id}`).toBe(1);
      }
      for (const id of JSON.parse(entry.evidence_ids ?? "[]") as string[]) {
        expect(count("select count(*) as n from evidence_documents where id = ?", id), `${entry.id} evidence ${id}`).toBe(1);
      }
      if (entry.status === "confirmed") {
        expect(count("select count(*) as n from evidence_documents where id = ? and source_minutes_id = ?", entry.evidence_document_id, entry.id)).toBe(1);
      }
    }
  });

  it("records the process stage a meeting serves, and the lineage of the action its minutes raised", () => {
    expect(row("select process_run_id as run, stage_id as stage from meetings where id = ?", WORKSHOP)).toStrictEqual({
      run: "RUN-RCSA-PAYOPS-Q4-2026",
      stage: "challenge-workshop",
    });
    /* The supplier challenge is about a supplier no running process covers. */
    expect(row("select process_run_id as run from meetings where id = ?", CHALLENGE)).toStrictEqual({ run: null });
    expect(
      row(
        "select source_meeting_id as meeting, source_minutes_id as minutes, source_process_run_id as run, source_stage_id as stage, source_stage_run_id as stageRun from actions where id = 'MSN-2026-0197'",
      ),
    ).toStrictEqual({
      meeting: "MTG-RCSA-PAYOPS-Q4-2026-SCOPE",
      minutes: "MINUTES-RCSA-SCOPE-WORKSHOP-2026",
      run: "RUN-RCSA-PAYOPS-Q4-2026",
      stage: "scope-trigger",
      stageRun: "STAGERUN-RCSA-1",
    });
  });
});

describe("before the meeting", () => {
  it("opens on the before phase with a validated preparation served in safe mode", () => {
    const hub = buildWorkHub("rcsa", { view: "meetings", item: WORKSHOP });
    expect(hub?.detail?.kind).toBe("meeting");
    if (hub?.detail?.kind !== "meeting") return;
    const lifecycle = hub.detail.lifecycle;
    expect(lifecycle?.phase).toBe("before");
    expect(lifecycle?.before.preparation.label).toBe("Safe");
    expect(lifecycle?.before.questions.length).toBe(7);
    expect(lifecycle?.before.questions.some((question) => question.evidence.length > 0)).toBe(true);
    expect(lifecycle?.before.contradictions.length).toBeGreaterThan(0);
    expect(lifecycle?.before.stage?.state).toBe("Not open yet");
    expect(lifecycle?.before.expectedOutcomes).toContain("Minutes in which every action has an accountable owner and a due date");
    expect(lifecycle?.during.started).toBe(false);
    expect(lifecycle?.after.canPrepare).toBe(false);
  });

  it("refuses to capture or draft before the meeting starts, and writes nothing", async () => {
    expect((await capture()).ok).toBe(false);
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(false);
    expect(count("select count(*) as n from meeting_minutes where meeting_id = ?", WORKSHOP)).toBe(0);
    expect(count("select count(*) as n from approvals where tool_name in ('captureMeetingItem', 'prepareMeetingMinutes')")).toBe(0);
  });
});

describe("during the meeting", () => {
  it("shows the conversation as far as it has been spoken and captures statements into a versioned draft", async () => {
    setMoment("11:45");
    const hub = buildWorkHub("rcsa", { view: "meetings", item: WORKSHOP });
    if (hub?.detail?.kind !== "meeting") throw new Error("No meeting detail.");
    expect(hub.detail.lifecycle?.phase).toBe("during");
    expect(hub.detail.lifecycle?.during.turns).toHaveLength(22);
    expect(hub.detail.lifecycle?.during.pending).toBe(1);
    expect(hub.detail.lifecycle?.during.turns.filter((turn) => turn.flag !== null).length).toBeGreaterThan(0);
    expect(hub.detail.status.label).toBe("In progress");

    const fact = await capture();
    expect(fact.ok, fact.message).toBe(true);
    let minutes = getMinutesById(WORKSHOP_MINUTES);
    expect(minutes).toMatchObject({ meetingId: WORKSHOP, status: "draft", version: 1, preparedBy: "human", preparedMode: null });
    expect(draftOf(WORKSHOP_MINUTES).facts[0]).toMatchObject({ origin: "person", turnIds: ["MTM-2026-0005-06"], evidenceIds: ["EVD-2026-41850"] });

    const action = await capture({
      kind: "action",
      turnId: "MTM-2026-0005-12",
      text: "Request the tenant configuration and the waiver rule",
      ownerUserId: "P-002",
      dueOn: "2026-10-07",
      completionCondition: "Closed when the configuration is filed.",
    });
    expect(action.ok, action.message).toBe(true);
    minutes = getMinutesById(WORKSHOP_MINUTES);
    expect(minutes?.version).toBe(2);

    /* The approval names its object: the minutes, not a decision. */
    const approval = row<{ target: string; kind: string; decision: string | null; consumed: string | null; by: string }>(
      "select target_id as target, target_kind as kind, decision_id as decision, consumed_at as consumed, approved_by_user_id as by from approvals where tool_name = 'captureMeetingItem' order by approved_at limit 1",
    );
    expect(approval).toMatchObject({ target: WORKSHOP_MINUTES, kind: "minutes", decision: null, by: "P-003" });
    expect(approval.consumed).not.toBeNull();
    expect(count("select count(*) as n from audit_events where object_kind = 'minutes' and object_id = ? and category = 'mutation'", WORKSHOP_MINUTES)).toBe(2);
  });

  it("refuses a capture that cites a document the corpus does not hold, and leaves the draft as it was", async () => {
    setMoment("11:45");
    expect((await capture()).ok).toBe(true);
    const refused = await capture({ evidenceIds: ["EVD-0000-NOPE"] });
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain("EVD-0000-NOPE");
    expect(getMinutesById(WORKSHOP_MINUTES)?.version).toBe(1);
  });
});

describe("after the meeting", () => {
  it("prepares the draft in safe mode, keeps what the person captured, and drafts only once", async () => {
    setMoment("11:45");
    expect((await capture()).ok).toBe(true);
    setMoment("13:30");
    const prepared = await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP });
    expect(prepared.ok, prepared.message).toBe(true);
    const minutes = getMinutesById(WORKSHOP_MINUTES);
    expect(minutes).toMatchObject({ preparedBy: "ai", preparedMode: "safe", version: 2 });
    const draft = draftOf(WORKSHOP_MINUTES);
    expect(draft.facts[0]?.origin).toBe("person");
    expect(draft.facts.filter((fact) => fact.origin === "ai").length).toBeGreaterThan(0);
    expect(draft.decisions.find((decision) => decision.decisionId === "DEC-2026-0772")?.outcome).toBe("not-agreed");
    expect(draft.actions.some((action) => action.existingActionId === "MSN-2026-0166")).toBe(true);

    const again = await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP });
    expect(again.ok).toBe(false);
    expect(getMinutesById(WORKSHOP_MINUTES)?.version).toBe(2);
  });

  it("composes the draft offline from the turns heard, every citation resolving", async () => {
    setResolvedDemoMode("offline");
    setMoment("13:30");
    const prepared = await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP });
    expect(prepared.ok, prepared.message).toBe(true);
    expect(getMinutesById(WORKSHOP_MINUTES)?.preparedMode).toBe("offline");
    const draft = draftOf(WORKSHOP_MINUTES);
    expect(draft.facts.length).toBeGreaterThan(0);
    expect(draft.facts.every((fact) => fact.turnIds.length === 1)).toBe(true);
    expect(draft.unresolved.length).toBeGreaterThan(0);
    for (const id of draft.evidenceIds) expect(count("select count(*) as n from evidence_documents where id = ?", id)).toBe(1);
  });

  it("saves a person's edits as a new version, marks them as the person's, and refuses a stale version", async () => {
    setMoment("13:30");
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(true);
    const draft = draftOf(WORKSHOP_MINUTES);
    const first = draft.facts[0];
    if (!first) throw new Error("No fact to edit.");
    const edited: MinutesDraft = { ...draft, facts: [{ ...first, text: `${first.text} Confirmed in the room.` }, ...draft.facts.slice(1)] };

    const saved = await saveMinutes({ roleId: "rcsa", meetingId: WORKSHOP, minutesId: WORKSHOP_MINUTES, version: 1, draft: edited });
    expect(saved.ok, saved.message).toBe(true);
    const after = draftOf(WORKSHOP_MINUTES);
    expect(after.facts[0]?.origin).toBe("person");
    expect(after.facts[1]?.origin).toBe("ai");
    expect(getMinutesById(WORKSHOP_MINUTES)).toMatchObject({ version: 2, editedByUserId: "P-003" });

    const stale = await saveMinutes({ roleId: "rcsa", meetingId: WORKSHOP, minutesId: WORKSHOP_MINUTES, version: 1, draft: edited });
    expect(stale.ok).toBe(false);
    expect(getMinutesById(WORKSHOP_MINUTES)?.version).toBe(2);
  });

  it("refuses confirmation without each confirmation, or while an action has no due date, and writes nothing", async () => {
    setMoment("13:30");
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(true);
    const unconfirmed = await confirmMinutes({
      roleId: "rcsa",
      minutesId: WORKSHOP_MINUTES,
      version: 1,
      confirmDecisions: true,
      confirmActions: false,
      confirmDistribution: true,
      confirmed: true,
      rationale: "Mine.",
    });
    expect(unconfirmed.ok).toBe(false);

    const draft = draftOf(WORKSHOP_MINUTES);
    const undated: MinutesDraft = { ...draft, actions: draft.actions.map((action) => (action.existingActionId === null ? { ...action, dueOn: null } : action)) };
    expect((await saveMinutes({ roleId: "rcsa", meetingId: WORKSHOP, minutesId: WORKSHOP_MINUTES, version: 1, draft: undated })).ok).toBe(true);
    const refused = await confirm(WORKSHOP_MINUTES, 2);
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain("no due date");

    expect(getMinutesById(WORKSHOP_MINUTES)?.status).toBe("draft");
    expect(count("select count(*) as n from approvals where tool_name = 'confirmMeetingMinutes'")).toBe(0);
    expect(count("select count(*) as n from evidence_documents where source_minutes_id = ?", WORKSHOP_MINUTES)).toBe(0);
  });
});

describe("confirmation", () => {
  it("is one governed transaction: evidence, actions with lineage, the meeting held, the backbone, the stage, the decisions, the distribution", async () => {
    setMoment("13:30");
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(true);
    const outcome = await confirm(WORKSHOP_MINUTES, 1);
    expect(outcome.ok, outcome.message).toBe(true);

    /* The minutes became evidence, with lineage, retrievable. */
    const evidence = row<{ source: string; type: string; related: string; moment: string }>(
      "select source_minutes_id as source, source_type as type, related_object_ids as related, revealed_at_moment as moment from evidence_documents where id = 'EVD-MIN-2026-0005'",
    );
    expect(evidence).toMatchObject({ source: WORKSHOP_MINUTES, type: "meeting-minutes", moment: "13:30" });
    const related = JSON.parse(evidence.related) as string[];
    expect(related).toEqual(expect.arrayContaining([WORKSHOP, WORKSHOP_MINUTES, "CTL-PAY-014", "DEC-2026-0772", "MSN-2026-0005-A01", "MSN-2026-0005-A02"]));
    expect(count("select count(*) as n from evidence_chunks_fts where document_id = 'EVD-MIN-2026-0005' and evidence_chunks_fts match 'tenant'")).toBeGreaterThan(0);

    /* New actions, with meeting, minutes and process lineage, and a history that says where they came from. */
    const raised = getSqlite()
      .prepare("select id, owner_user_id as owner, due_on as due, source_meeting_id as meeting, source_minutes_id as minutes, source_process_run_id as run, source_stage_id as stage, completion_condition as condition from actions where source_minutes_id = ? order by id")
      .all(WORKSHOP_MINUTES) as Array<Record<string, string | null>>;
    expect(raised.map((entry) => entry.id)).toStrictEqual(["MSN-2026-0005-A01", "MSN-2026-0005-A02"]);
    for (const entry of raised) {
      expect(entry).toMatchObject({ meeting: WORKSHOP, minutes: WORKSHOP_MINUTES, run: "RUN-RCSA-PAYOPS-Q4-2026", stage: "challenge-workshop" });
      expect(entry.condition).not.toBeNull();
      expect(count("select count(*) as n from action_updates where action_id = ? and kind = 'CRT'", entry.id)).toBe(1);
    }
    expect(raised[0]).toMatchObject({ owner: "P-002", due: "2026-10-07" });
    expect(count("select count(*) as n from action_updates where action_id = 'MSN-2026-0166' and kind = 'MTG'")).toBe(1);

    /* The meeting is held, in the scenario's time, by the role holder. */
    expect(row("select status, held_by_user_id as by, held_at as at from meetings where id = ?", WORKSHOP)).toStrictEqual({
      status: "concluded",
      by: "P-003",
      at: "2026-10-06T13:30:00.000Z",
    });

    /* The minutes are the record, and were distributed as a simulated message. */
    const minutes = getMinutesById(WORKSHOP_MINUTES);
    expect(minutes).toMatchObject({ status: "distributed", confirmedByUserId: "P-003", evidenceDocumentId: "EVD-MIN-2026-0005" });
    expect(minutes?.actionIds).toEqual(expect.arrayContaining(["MSN-2026-0005-A01", "MSN-2026-0005-A02", "MSN-2026-0166"]));
    const message = row<{ recipients: string; simulated: number; kind: string }>(
      "select to_user_ids as recipients, simulated_only as simulated, kind from collaboration_messages where related_object_kind = 'minutes' and related_object_id = ?",
      WORKSHOP_MINUTES,
    );
    expect(message.simulated).toBe(1);
    expect(message.kind).toBe("minutes-distribution");
    expect(JSON.parse(message.recipients)).toStrictEqual(["P-003", "P-007", "P-008", "P-004"]);
    expect(count("select count(*) as n from audit_events where action = 'distributeMeetingMinutes' and category = 'mutation'")).toBe(1);

    /* One approval, in the holder's name, bound to the minutes, consumed. */
    const approval = row<{ target: string; kind: string; decision: string | null; consumed: string | null; by: string }>(
      "select target_id as target, target_kind as kind, decision_id as decision, consumed_at as consumed, approved_by_user_id as by from approvals where tool_name = 'confirmMeetingMinutes'",
    );
    expect(approval).toMatchObject({ target: WORKSHOP_MINUTES, kind: "minutes", decision: null, by: "P-003" });
    expect(approval.consumed).not.toBeNull();
    const audit = row<{ id: string }>("select id from audit_events where action = 'confirmMeetingMinutes' and category = 'mutation'");

    /* The backbone heard it once, linked to the audit row; the stage and the decision too. */
    const completed = listOsEvents({ types: ["meeting-completed"], subject: { kind: "meeting", id: WORKSHOP } });
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ processRunId: "RUN-RCSA-PAYOPS-Q4-2026", stageId: "challenge-workshop", auditEventId: audit.id });
    expect(listOsEvents({ types: ["source-changed"], processRunId: "RUN-RCSA-PAYOPS-Q4-2026", stageId: "challenge-workshop" })).toHaveLength(1);
    expect(listOsEvents({ types: ["action-updated"] }).filter((event) => event.correlationId === WORKSHOP_MINUTES)).toHaveLength(3);
    expect(listOsEvents({ types: ["decision-requested"], subject: { kind: "decision", id: "DEC-2026-0772" } })).toHaveLength(1);
    /* The decision itself is still open: its judgment stays with its owner. */
    expect(row("select status from decisions where id = 'DEC-2026-0772'")).toStrictEqual({ status: "open" });

    /* The stage is not open yet, and the receipt says so rather than claiming an update. */
    expect(outcome.receipt.some((line) => line.includes("not open yet"))).toBe(true);
  });

  it("is idempotent: confirming confirmed minutes writes nothing", async () => {
    setMoment("13:30");
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(true);
    expect((await confirm(WORKSHOP_MINUTES, 1)).ok).toBe(true);
    const before = {
      approvals: count("select count(*) as n from approvals"),
      events: count("select count(*) as n from os_events"),
      evidence: count("select count(*) as n from evidence_documents"),
      actions: count("select count(*) as n from actions"),
      audit: count("select count(*) as n from audit_events"),
    };
    const again = await confirm(WORKSHOP_MINUTES, 1);
    expect(again.ok).toBe(true);
    expect(again.receipt).toStrictEqual([]);
    expect({
      approvals: count("select count(*) as n from approvals"),
      events: count("select count(*) as n from os_events"),
      evidence: count("select count(*) as n from evidence_documents"),
      actions: count("select count(*) as n from actions"),
      audit: count("select count(*) as n from audit_events"),
    }).toStrictEqual(before);
  });

  it("is findable by search, and the actions it raised show their source meeting and stage", async () => {
    setMoment("13:30");
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(true);
    expect((await confirm(WORKSHOP_MINUTES, 1)).ok).toBe(true);

    const payload = readSearchPayload("rcsa", requireScenarioState());
    expect(payload.entries.some((entry) => entry.kind === "minutes" && entry.id === WORKSHOP_MINUTES)).toBe(true);
    const doc = payload.entries.find((entry) => entry.kind === "evidence" && entry.id === "EVD-MIN-2026-0005");
    expect(doc).toBeDefined();

    const hub = buildWorkHub("rcsa", { view: "actions", item: "MSN-2026-0005-A02" });
    if (hub?.detail?.kind !== "action") throw new Error("No action detail.");
    expect(hub.detail.sources.meeting?.id).toBe(WORKSHOP);
    expect(hub.detail.sources.process?.href).toContain("stage=challenge-workshop");
    expect(hub.detail.completion.agreed).not.toBeNull();
    expect(hub.detail.activity.some((entry) => entry.label === "Raised")).toBe(true);

    /* Search opens a minutes record on its meeting. */
    const opened = buildWorkHub("rcsa", { view: "meetings", mview: "archive", item: WORKSHOP_MINUTES });
    expect(opened?.detail?.id).toBe(WORKSHOP);
  });

  it("updates an open process stage through the process engine for TPRM", async () => {
    const before = getMinutesById(TRIAGE_MINUTES);
    expect(before?.status).toBe("draft");
    const outcome = await confirm(TRIAGE_MINUTES, before?.version ?? 1, "tprm");
    expect(outcome.ok, outcome.message).toBe(true);
    expect(outcome.receipt.some((line) => line.includes("brought up to date through the process engine"))).toBe(true);

    const raised = getSqlite()
      .prepare("select id, source_stage_run_id as stageRun, source_stage_id as stage, owner_label as label from actions where source_minutes_id = ? order by id")
      .all(TRIAGE_MINUTES) as Array<Record<string, string>>;
    expect(raised.map((entry) => entry.id)).toStrictEqual(["MSN-TPRM-EVIDENCE-TRIAGE-2026-A01", "MSN-TPRM-EVIDENCE-TRIAGE-2026-A02"]);
    for (const entry of raised) expect(entry).toMatchObject({ stageRun: "STAGERUN-TPRM-4", stage: "evidence-review" });

    /* The process page reads the stage's events: the meeting record is on the stage. */
    const onStage = listOsEvents({ processRunId: "RUN-TPRM-VERIDIAN-2026", stageId: "evidence-review" }).map((event) => event.type);
    expect(onStage).toContain("meeting-completed");
    expect(onStage).toContain("source-changed");
  });

  it("confirms the TPRM supplier challenge, where no process stage depends on the meeting", async () => {
    setMoment("11:45");
    const prepared = await prepareMinutes({ roleId: "tprm", meetingId: CHALLENGE });
    expect(prepared.ok, prepared.message).toBe(true);
    expect(getMinutesById(CHALLENGE_MINUTES)?.preparedMode).toBe("safe");
    const outcome = await confirm(CHALLENGE_MINUTES, 1, "tprm");
    expect(outcome.ok, outcome.message).toBe(true);
    expect(outcome.receipt.some((line) => line.toLowerCase().includes("process stage"))).toBe(false);

    const completed = listOsEvents({ types: ["meeting-completed"], subject: { kind: "meeting", id: CHALLENGE } });
    expect(completed[0]?.processRunId).toBeNull();
    for (const id of ["MSN-2026-0188", "MSN-2026-0184", "MSN-2026-0191"]) {
      expect(count("select count(*) as n from action_updates where action_id = ? and kind = 'MTG'", id), id).toBe(1);
    }
    expect(count("select count(*) as n from actions where source_minutes_id = ?", CHALLENGE_MINUTES)).toBe(3);
    /* A supplier contact delivers, a named person stays accountable. */
    expect(row("select owner_user_id as owner, owner_label as label from actions where id = 'MSN-2026-0002-A01'")).toStrictEqual({
      owner: "P-002",
      label: "Novalink client service, M. Falk",
    });
  });
});

describe("governance", () => {
  it("refuses at an autonomy level that cannot reach a material change, and records the refusal", async () => {
    setMoment("13:30");
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(true);
    setAutonomyLevel("recommend");
    const refused = await confirm(WORKSHOP_MINUTES, 1);
    expect(refused.ok).toBe(false);
    expect(getMinutesById(WORKSHOP_MINUTES)?.status).toBe("draft");
    expect(count("select count(*) as n from audit_events where action = 'confirmMeetingMinutes' and blocked = 1")).toBe(1);
    expect(count("select count(*) as n from evidence_documents where source_minutes_id = ?", WORKSHOP_MINUTES)).toBe(0);
  });

  it("refuses minutes of another role's meeting", async () => {
    setMoment("13:30");
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(true);
    const refused = await confirm(WORKSHOP_MINUTES, 1, "tprm");
    expect(refused.ok).toBe(false);
    expect(getMinutesById(WORKSHOP_MINUTES)?.status).toBe("draft");
  });

  it("writes nothing when any part of the confirmation fails", async () => {
    setMoment("13:30");
    expect((await prepareMinutes({ roleId: "rcsa", meetingId: WORKSHOP })).ok).toBe(true);
    /* A row already holding the identifier the first new action would take. */
    getSqlite()
      .prepare(
        "insert into actions (id, run_id, reference, title, description, kind, entity_id, created_on, status) values ('MSN-2026-0005-A01', 'run-001', 'X', 'Blocking row', 'x', 'remediation', 'ARC-DE', '2026-10-06', 'open')",
      )
      .run();
    const failed = await confirm(WORKSHOP_MINUTES, 1);
    expect(failed.ok).toBe(false);
    expect(getMinutesById(WORKSHOP_MINUTES)?.status).toBe("draft");
    expect(count("select count(*) as n from evidence_documents where source_minutes_id = ?", WORKSHOP_MINUTES)).toBe(0);
    expect(count("select count(*) as n from actions where source_minutes_id = ?", WORKSHOP_MINUTES)).toBe(0);
    expect(count("select count(*) as n from os_events where correlation_id = ?", WORKSHOP_MINUTES)).toBe(0);
    expect(row("select status from meetings where id = ?", WORKSHOP)).toStrictEqual({ status: "not-started" });
    /* The approval was recorded and refused nothing; it was not consumed, and it binds only that version. */
    expect(row<{ consumed: string | null }>("select consumed_at as consumed from approvals where tool_name = 'confirmMeetingMinutes'").consumed).toBeNull();
  });
});
