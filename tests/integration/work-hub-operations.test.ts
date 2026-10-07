/**
 * The Work Hub's governed operations, against a real database.
 *
 * Every claim the plan makes about actions and the agenda's downstream work
 * is tried here against the seeded day, through the same operation functions
 * the server actions call:
 *
 *   completion requires evidence where the role configures it, and the
 *   evidence must exist;
 *   material closure and a material due date change require the person's
 *   confirmation, and nothing changes without it;
 *   every change records an approval in the person's name, bound to the
 *   payload, consumed once, with no decision attached;
 *   updates are append only;
 *   accountability can be transferred, never removed;
 *   the gate refuses below the autonomy level that can reach the change;
 *   an action not on the role's desk cannot be changed from that role;
 *   a meeting cannot be recorded as held before it starts, and once it is,
 *   the work that depended on it gets a follow-up entry;
 *   the hub keeps the selection across tabs.
 *
 * Runs against a temporary database. See `support/harness.ts`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { setAutonomyLevel, setMoment } from "@/scenario/engine/state";
import {
  addUpdate,
  assignAction,
  changeDueDate,
  completeWithEvidence,
  draftReminder,
  escalateAction,
  reopenAction,
  sendReminder,
} from "@/features/work/modules/actions/operations";
import { recordMeetingHeld } from "@/features/work/modules/agenda/operations";
import { buildWorkHub } from "@/features/work/hub";
import { classifyAction } from "@/features/work/modules/actions/policy";

const NON_MATERIAL = "MSN-2026-0209"; // TPRM monitoring, medium, no issue
const MATERIAL = "MSN-2026-0195"; // TPRM reassessment, high
const WITH_SUPPLIER = "MSN-2026-0184"; // TPRM evidence request, issue, supplier delivering
const EVIDENCE = "EVD-2026-41810";

interface ActionRecord {
  status: string;
  owner: string | null;
  due: string | null;
  completed: string | null;
}

function action(id: string): ActionRecord {
  return getSqlite()
    .prepare("select status, owner_user_id as owner, due_on as due, completed_on as completed from actions where id = ?")
    .get(id) as ActionRecord;
}

function entries(id: string): Array<{ id: string; note: string; status_after: string; evidence_ids: string; author_kind: string }> {
  return getSqlite()
    .prepare("select id, note, status_after, evidence_ids, author_kind from action_updates where action_id = ? order by at, id")
    .all(id) as Array<{ id: string; note: string; status_after: string; evidence_ids: string; author_kind: string }>;
}

function count(sql: string, ...args: unknown[]): number {
  return (getSqlite().prepare(sql).get(...args) as { n: number }).n;
}

beforeAll(() => {
  createTemporaryDatabase("work-hub-operations");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
});

describe("completion", () => {
  it("refuses to close an action of a kind that needs evidence when none is cited", async () => {
    const outcome = await completeWithEvidence({ roleId: "tprm", actionId: NON_MATERIAL, note: "Reviewed.", evidenceIds: [], confirmed: true });
    expect(outcome.ok).toBe(false);
    expect(action(NON_MATERIAL).status).toBe("in-progress");
    expect(entries(NON_MATERIAL)).toHaveLength(0);
  });

  it("refuses a citation to a document that does not exist, and writes nothing", async () => {
    const outcome = await completeWithEvidence({ roleId: "tprm", actionId: NON_MATERIAL, note: "Reviewed.", evidenceIds: ["EVD-0000-NOPE"], confirmed: true });
    expect(outcome.ok).toBe(false);
    expect(action(NON_MATERIAL).status).toBe("in-progress");
    expect(entries(NON_MATERIAL)).toHaveLength(0);
  });

  it("closes with evidence, through an approval in the holder's name that is consumed and attached to no decision", async () => {
    const outcome = await completeWithEvidence({ roleId: "tprm", actionId: NON_MATERIAL, note: "September availability reviewed.", evidenceIds: [EVIDENCE], confirmed: true });
    expect(outcome.ok, outcome.message).toBe(true);
    expect(action(NON_MATERIAL)).toMatchObject({ status: "completed", completed: "2026-10-06" });

    const history = entries(NON_MATERIAL);
    expect(history).toHaveLength(1);
    expect(history[0]?.id.startsWith("AUP-CMP-")).toBe(true);
    expect(JSON.parse(history[0]?.evidence_ids ?? "[]")).toStrictEqual([EVIDENCE]);

    const approval = getSqlite()
      .prepare("select approved_by_user_id as by, role_id as role, decision_id as decision, consumed_at as consumed from approvals where tool_name = 'completeAction'")
      .get() as { by: string; role: string; decision: string | null; consumed: string | null };
    expect(approval).toMatchObject({ by: "P-002", role: "tprm", decision: null });
    expect(approval.consumed).not.toBeNull();
    expect(count("select count(*) as n from audit_events where object_kind = 'action' and object_id = ? and category = 'mutation'", NON_MATERIAL)).toBe(1);
  });

  it("keeps a material action open without the person's confirmation", async () => {
    const refused = await completeWithEvidence({ roleId: "tprm", actionId: MATERIAL, note: "Done.", evidenceIds: [EVIDENCE], confirmed: false });
    expect(refused.ok).toBe(false);
    expect(action(MATERIAL).status).toBe("in-progress");
    expect(count("select count(*) as n from approvals where tool_name = 'completeAction'")).toBe(0);

    const confirmed = await completeWithEvidence({ roleId: "tprm", actionId: MATERIAL, note: "Every open question answered or conditioned.", evidenceIds: [EVIDENCE], confirmed: true });
    expect(confirmed.ok, confirmed.message).toBe(true);
    expect(action(MATERIAL).status).toBe("completed");
  });

  it("is refused by the gate below the autonomy level that reaches a material change", async () => {
    setAutonomyLevel("recommend", { actorUserId: "P-002" });
    const outcome = await completeWithEvidence({ roleId: "tprm", actionId: NON_MATERIAL, note: "Reviewed.", evidenceIds: [EVIDENCE], confirmed: true });
    expect(outcome.ok).toBe(false);
    expect(action(NON_MATERIAL).status).toBe("in-progress");
    expect(count("select count(*) as n from audit_events where blocked = 1 and action = 'completeAction'")).toBeGreaterThan(0);
  });

  it("reopens a completed action with the reason in the history", async () => {
    const outcome = await reopenAction({ roleId: "rcsa", actionId: "MSN-2026-0197", reason: "The pre read missed two risks.", confirmed: true });
    expect(outcome.ok, outcome.message).toBe(true);
    expect(action("MSN-2026-0197")).toMatchObject({ status: "overdue", completed: null });
    expect(entries("MSN-2026-0197")[0]?.note).toContain("The pre read missed two risks.");
  });
});

describe("due dates and accountability", () => {
  it("moves a material due date only with confirmation, and records the old and new dates", async () => {
    const refused = await changeDueDate({ roleId: "tprm", actionId: WITH_SUPPLIER, dueOn: "2026-10-23", reason: "Supplier escalation.", confirmed: false });
    expect(refused.ok).toBe(false);
    expect(action(WITH_SUPPLIER).due).toBe("2026-10-16");

    const moved = await changeDueDate({ roleId: "tprm", actionId: WITH_SUPPLIER, dueOn: "2026-10-23", reason: "Supplier escalation.", confirmed: true });
    expect(moved.ok, moved.message).toBe(true);
    expect(action(WITH_SUPPLIER).due).toBe("2026-10-23");
    expect(entries(WITH_SUPPLIER)[0]?.note).toContain("16.10.2026 to 23.10.2026");
  });

  it("refuses a due date before the scenario day", async () => {
    const outcome = await changeDueDate({ roleId: "tprm", actionId: WITH_SUPPLIER, dueOn: "2026-09-01", reason: "Typo.", confirmed: true });
    expect(outcome.ok).toBe(false);
    expect(action(WITH_SUPPLIER).due).toBe("2026-10-16");
  });

  it("transfers accountability to a named person and never removes it", async () => {
    const removed = await assignAction({ roleId: "tprm", actionId: MATERIAL, ownerUserId: "", reason: "No longer mine.", confirmed: true });
    expect(removed.ok).toBe(false);
    expect(action(MATERIAL).owner).toBe("P-002");

    const moved = await assignAction({ roleId: "tprm", actionId: MATERIAL, ownerUserId: "P-010", reason: "Procurement leads the commercial close.", confirmed: true });
    expect(moved.ok, moved.message).toBe(true);
    expect(action(MATERIAL).owner).toBe("P-010");
  });

  it("refuses to change an action that is not on the role's desk", async () => {
    const outcome = await assignAction({ roleId: "rcsa", actionId: MATERIAL, ownerUserId: "P-003", reason: "Taking it.", confirmed: true });
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toContain("not on this role's desk");
    expect(action(MATERIAL).owner).toBe("P-002");
  });
});

describe("append-only progress", () => {
  it("adds entries without changing earlier ones, and records a blocker as a state of the history", async () => {
    const first = await addUpdate({ roleId: "tprm", actionId: WITH_SUPPLIER, note: "Chased by phone.", evidenceIds: [], blocker: null, entryKind: "UPD" });
    expect(first.ok, first.message).toBe(true);
    const before = entries(WITH_SUPPLIER);

    const second = await addUpdate({ roleId: "tprm", actionId: WITH_SUPPLIER, note: "Supplier will not release the scope statement.", evidenceIds: [], blocker: "set", entryKind: "UPD" });
    expect(second.ok, second.message).toBe(true);
    const after = entries(WITH_SUPPLIER);

    expect(after).toHaveLength(2);
    expect(after[0]).toStrictEqual(before[0]);
    expect(after[1]?.status_after).toBe("blocked");
    /* The row's own status is untouched, so every other reader of it is unaffected. */
    expect(action(WITH_SUPPLIER).status).toBe("in-progress");

    const state = classifyAction(
      { status: "in-progress", dueOn: "2026-10-16", ownerUserId: "P-002", ownerLabel: "x", isUnowned: false },
      after.map((entry) => ({ id: entry.id, note: entry.note, statusAfter: entry.status_after, at: "" })),
      "P-002",
      "2026-10-06",
      null,
    );
    expect(state.blocked).toBe(true);
  });
});

describe("reminders and escalation", () => {
  it("drafts without writing, then sends a simulated message recorded against the action", async () => {
    const draft = await draftReminder({ roleId: "tprm", actionId: WITH_SUPPLIER });
    expect(draft.ok).toBe(true);
    expect(draft.draft?.body).toContain("Novalink client service, M. Falk");
    expect(draft.draft?.body).toContain("verbal assurance");
    expect(entries(WITH_SUPPLIER)).toHaveLength(0);

    const sent = await sendReminder({ roleId: "tprm", actionId: WITH_SUPPLIER, subject: draft.draft?.subject ?? "", body: draft.draft?.body ?? "" });
    expect(sent.ok, sent.message).toBe(true);
    expect(count("select count(*) as n from collaboration_messages where related_object_kind = 'action' and related_object_id = ? and simulated_only = 1 and kind = 'follow-up'", WITH_SUPPLIER)).toBe(1);
    expect(entries(WITH_SUPPLIER)[0]?.id.startsWith("AUP-RMD-")).toBe(true);
  });

  it("escalates to the committee only with confirmation", async () => {
    const refused = await escalateAction({ roleId: "tprm", actionId: WITH_SUPPLIER, reason: "Rejected twice.", confirmed: false });
    expect(refused.ok).toBe(false);

    const escalated = await escalateAction({ roleId: "tprm", actionId: WITH_SUPPLIER, reason: "Rejected twice at working level.", confirmed: true });
    expect(escalated.ok, escalated.message).toBe(true);
    expect(count("select count(*) as n from committee_items where related_object_kind = 'action' and related_object_id = ? and item_type = 'escalation'", WITH_SUPPLIER)).toBe(1);
    expect(entries(WITH_SUPPLIER)[0]?.id.startsWith("AUP-ESC-")).toBe(true);
  });
});

describe("a completed meeting changes its downstream work", () => {
  it("cannot be recorded as held before it starts", async () => {
    const outcome = await recordMeetingHeld({ roleId: "tprm", meetingId: "MTG-2026-0002", outcome: "Answered.", confirmed: true });
    expect(outcome.ok).toBe(false);
    expect(count("select count(*) as n from meetings where id = 'MTG-2026-0002' and status = 'concluded'")).toBe(0);
  });

  it("records the outcome, marks the agenda entry held and writes a follow-up to each dependent action", async () => {
    setMoment("11:45");
    const outcome = await recordMeetingHeld({
      roleId: "tprm",
      meetingId: "MTG-2026-0002",
      outcome: "Novalink will provide the Swiss recovery report by 20.10.2026 and the scope statement by 16.10.2026.",
      confirmed: true,
    });
    expect(outcome.ok, outcome.message).toBe(true);
    expect(count("select count(*) as n from meetings where id = 'MTG-2026-0002' and status = 'concluded'")).toBe(1);
    expect(count("select count(*) as n from calendar_events where meeting_id = 'MTG-2026-0002' and preparation_status = 'completed'")).toBe(1);
    for (const id of ["MSN-2026-0188", "MSN-2026-0184", "MSN-2026-0195"]) {
      const followUp = entries(id).find((entry) => entry.id.startsWith("AUP-MTG-"));
      expect(followUp, id).toBeDefined();
      expect(followUp?.author_kind).toBe("system");
    }

    const hub = buildWorkHub("tprm", { view: "agenda", item: "CAL-2026-0003" });
    expect(hub?.detail?.kind).toBe("event");
    if (hub?.detail?.kind === "event") {
      expect(hub.detail.eventStatus.label).toBe("Held");
      expect(hub.detail.nextAction.label).toContain("Follow up");
    }
  });
});

describe("the hub", () => {
  it("has no static content: every action row is a seeded action of the role", () => {
    const hub = buildWorkHub("rcsa", { view: "actions", filter: "waiting-others" });
    const ids = hub?.queue.groups.flatMap((group) => group.rows.map((row) => row.id)) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(count("select count(*) as n from actions where id = ?", id)).toBe(1);
  });

  it("keeps the selected action across a tab change and says where it belongs", () => {
    const onActions = buildWorkHub("tprm", { view: "actions", item: "MSN-2026-0188" });
    const onAgenda = buildWorkHub("tprm", { view: "agenda", item: "MSN-2026-0188" });
    expect(onActions?.detail?.id).toBe("MSN-2026-0188");
    expect(onActions?.selectedElsewhere).toBeNull();
    expect(onAgenda?.detail?.id).toBe("MSN-2026-0188");
    expect(onAgenda?.selectedElsewhere?.tabLabel).toBe("Actions");
    expect(onAgenda?.bound?.ai.selection).toMatchObject({ objectType: "action", objectId: "MSN-2026-0188" });
    expect(onAgenda?.tabs.find((tab) => tab.tab === "actions")?.href).toContain("item=MSN-2026-0188");
  });

  it("resolves an identifier another role owns to no selection", () => {
    const hub = buildWorkHub("rcsa", { view: "actions", item: "MSN-2026-0188" });
    expect(hub?.detail).toBeNull();
    expect(hub?.bound).toBeNull();
  });
});
