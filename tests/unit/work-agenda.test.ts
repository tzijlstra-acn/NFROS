/**
 * The Agenda module read model.
 *
 * Pure tests over plain fixtures, one per claim in plan section 4.5:
 *
 *   every entry comes from the calendar, or the view is an explicit empty
 *   state; there is no static list behind an empty calendar;
 *   conflicts are computed from the times, symmetrically;
 *   preparation reads each pack document's current status;
 *   the process and object links come from structured fields;
 *   work whose deadline depends on the meeting is listed, earliest first;
 *   a completed meeting changes the entry's next action to its follow-up;
 *   the AI behaviours are proposals, with the gate's verdict attached.
 */

import { describe, expect, it } from "vitest";
import {
  buildAgendaView,
  countAgenda,
  detectConflicts,
  EMPTY_AGENDA_EXTRAS,
  freeSlotBefore,
  resolveAgendaDetail,
  type AgendaExtras,
} from "@/features/work/modules/agenda/read-model";
import {
  actionRow,
  at,
  calendarRow,
  evidenceRow,
  meetingRow,
  openGate,
  processScope,
  query,
  shared,
} from "./support/work-fixtures";

function extras(overrides: Partial<AgendaExtras> = {}): AgendaExtras {
  return { ...EMPTY_AGENDA_EXTRAS, ...overrides };
}

const WORKSHOP = meetingRow({
  id: "MTG-1",
  kind: "rcsa-workshop",
  scheduledFor: at("10:30"),
  subjectKind: "control",
  subjectId: "CTL-1",
  preparationSummary: "The gap is one band.",
  evidenceDocumentIds: ["EVD-1", "EVD-2"],
  preparedQuestions: ["Which exception did the detective control find?"],
});

function day() {
  return shared({
    calendar: [
      calendarRow({ id: "CAL-1", kind: "focus-time", startsAt: at("07:45"), endsAt: at("08:10") }),
      calendarRow({ id: "CAL-2", startsAt: at("10:30"), endsAt: at("12:00"), meetingId: "MTG-1", kind: "workshop" }),
      calendarRow({ id: "CAL-3", startsAt: at("11:45"), endsAt: at("12:15") }),
    ],
    meetings: [WORKSHOP],
    actions: [
      actionRow({ id: "A-LATE", relatedObjectId: "CTL-1", dueOn: "2026-10-30" }),
      actionRow({ id: "A-SOON", relatedObjectId: "CTL-1", dueOn: "2026-10-08" }),
      actionRow({ id: "A-OTHER", relatedObjectId: "CTL-9", dueOn: "2026-10-07" }),
      actionRow({ id: "A-DONE", relatedObjectId: "CTL-1", status: "completed" }),
    ],
    processScopes: [processScope()],
  });
}

const PACK = extras({
  packEvidence: new Map([
    ["EVD-1", evidenceRow({ id: "EVD-1" })],
    ["EVD-2", evidenceRow({ id: "EVD-2", isStale: true })],
  ]),
});

describe("no static fallback", () => {
  it("shows an explicit empty state for an empty calendar", () => {
    const view = buildAgendaView(shared(), extras(), query());
    expect(view.groups).toStrictEqual([]);
    expect(view.empty?.title).toBe("No agenda entries");
    expect(view.proposals).toStrictEqual([]);
  });

  it("renders exactly the calendar's rows on the day view", () => {
    const view = buildAgendaView(day(), PACK, query());
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0]?.rows.map((row) => row.id)).toStrictEqual(["CAL-1", "CAL-2", "CAL-3"]);
  });

  it("renders seven days on the week view, with empty days saying so and deadlines placed on their day", () => {
    const view = buildAgendaView(day(), PACK, query({ scope: "week" }));
    expect(view.groups.map((group) => group.id)).toStrictEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(view.groups[0]?.rows).toStrictEqual([]);
    expect(view.groups[0]?.emptyText).toBe("No agenda entries on this day.");
    expect(view.groups[3]?.notes?.map((note) => note.id)).toStrictEqual(["A-SOON"]);
  });
});

describe("conflicts", () => {
  it("finds overlaps symmetrically and ignores touching entries", () => {
    const found = detectConflicts([
      { id: "a", date: "d", start: "10:30", end: "12:00", completed: false },
      { id: "b", date: "d", start: "11:45", end: "12:15", completed: false },
      { id: "c", date: "d", start: "12:15", end: "13:00", completed: false },
    ]);
    expect(found.get("a")).toStrictEqual([{ withId: "b", minutes: 15 }]);
    expect(found.get("b")).toStrictEqual([{ withId: "a", minutes: 15 }]);
    expect(found.has("c")).toBe(false);
  });

  it("drops the conflict once one side is held", () => {
    const found = detectConflicts([
      { id: "a", date: "d", start: "10:30", end: "12:00", completed: true },
      { id: "b", date: "d", start: "11:45", end: "12:15", completed: false },
    ]);
    expect(found.size).toBe(0);
  });

  it("marks the row and counts it", () => {
    const view = buildAgendaView(day(), PACK, query());
    const row = view.groups[0]?.rows.find((candidate) => candidate.id === "CAL-2");
    expect(row?.flag).toBe("danger");
    expect(row?.chips.some((chip) => chip.label === "Conflict")).toBe(true);
    expect(countAgenda(day(), PACK).conflicts).toBe(2);
  });
});

describe("preparation is current", () => {
  it("reads the pack's documents and names the stale one as required preparation", () => {
    const detail = resolveAgendaDetail("CAL-2", day(), PACK, query({ item: "CAL-2" }));
    expect(detail?.prep.pack.state).toBe("issues");
    expect(detail?.prep.pack.total).toBe(2);
    expect(detail?.prep.packLabel).toBe("Pack: 1 of 2 sources need attention");
    expect(detail?.required.some((line) => line.includes("EVD-2"))).toBe(true);
    expect(detail?.prep.recorded.label).toBe("Not prepared");
  });

  it("names a document the pack lists but the corpus lacks as missing", () => {
    const detail = resolveAgendaDetail("CAL-2", day(), extras(), query());
    expect(detail?.prep.pack.issues.map((issue) => issue.status)).toStrictEqual(["Missing", "Missing"]);
  });
});

describe("links", () => {
  it("links the process whose scope holds the subject, at the stage the meeting type serves", () => {
    const detail = resolveAgendaDetail("CAL-2", day(), PACK, query());
    expect(detail?.process?.link.href).toBe("/workday/rcsa/processes/rcsa-cycle?stage=challenge-workshop");
    expect(detail?.process?.stage).toBe("Challenge workshop");
    expect(detail?.related.some((link) => link.kind === "object" && link.id === "CTL-1")).toBe(true);
    expect(detail?.related.some((link) => link.kind === "meeting" && link.id === "MTG-1")).toBe(true);
  });

  it("does not link a process when the subject is outside its scope", () => {
    const data = { ...day(), processScopes: [processScope({ scopeIds: ["SOMETHING-ELSE"] })] };
    expect(resolveAgendaDetail("CAL-2", data, PACK, query())?.process).toBeNull();
  });

  it("lists the open work that depends on the meeting, earliest deadline first", () => {
    const detail = resolveAgendaDetail("CAL-2", day(), PACK, query());
    expect(detail?.dependents.map((action) => action.id)).toStrictEqual(["A-SOON", "A-LATE"]);
  });

  it("binds the AI Partner to the meeting's subject, labelled with the entry's title", () => {
    const detail = resolveAgendaDetail("CAL-2", day(), PACK, query());
    expect(detail?.ai.selection).toStrictEqual({ objectType: "control", objectId: "CTL-1", label: "CAL-2" });
    const focus = resolveAgendaDetail("CAL-1", day(), PACK, query());
    expect(focus?.ai.selection).toBeNull();
    expect(focus?.ai.note).toContain("keeps the role context");
  });
});

describe("next action and the meeting outcome", () => {
  it("leads with the conflict before the meeting starts", () => {
    const detail = resolveAgendaDetail("CAL-2", day(), PACK, query());
    expect(detail?.nextAction.label).toContain("Resolve the overlap");
    expect(detail?.recordHeld.enabled).toBe(false);
    expect(detail?.recordHeld.reason).toContain("10:30");
  });

  it("offers Record as held once the meeting has started, naming the dependent actions", () => {
    const detail = resolveAgendaDetail("CAL-2", shared({ ...day(), currentMoment: "11:00" }), PACK, query());
    expect(detail?.eventStatus.label).toBe("In progress");
    expect(detail?.recordHeld.enabled).toBe(true);
    expect(detail?.recordHeld.dependentIds).toStrictEqual(["A-SOON", "A-LATE"]);
  });

  it("turns the next action into the follow-up once the meeting is held", () => {
    const held = { ...WORKSHOP, status: "concluded", outcome: "Medium-High agreed.", concludedAt: at("12:05") };
    const data = shared({ ...day(), meetings: [held], currentMoment: "12:30" });
    const detail = resolveAgendaDetail("CAL-2", data, PACK, query());
    expect(detail?.eventStatus.label).toBe("Held");
    expect(detail?.nextAction.label).toBe("Follow up the dependent actions (2)");
    expect(detail?.outcome).toBe("Medium-High agreed.");
    expect(detail?.conflicts).toStrictEqual([]);
    expect(detail?.recordHeld.enabled).toBe(false);
  });
});

describe("AI proposals", () => {
  it("proposes preparing the next unprepared meeting and reserving free time before it", () => {
    const view = buildAgendaView(day(), PACK, query());
    expect(view.proposals.map((proposal) => proposal.id)).toStrictEqual(["prepare-CAL-2", "focus-CAL-2"]);
    const [prepare, focus] = view.proposals;
    expect(prepare?.available).toBe(true);
    expect(prepare?.authorityLabel).toBe("Draft");
    expect(prepare?.href).toContain("item=MTG-1");
    /* There is no calendar write, so the focus proposal says so instead of offering a button. */
    expect(focus?.available).toBe(false);
    expect(focus?.href).toBeNull();
    expect(focus?.title).toBe("Reserve 10:00 to 10:30");
  });

  it("carries the gate's refusal when the drafting tool is not reachable", () => {
    const gate = { ...openGate() };
    gate.prepareChallengeQuestions = { ...gate.prepareChallengeQuestions!, reachable: false, reason: "Assist cannot reach a DRAFT action." };
    const view = buildAgendaView(shared({ ...day(), gate }), PACK, query());
    expect(view.proposals[0]?.available).toBe(false);
    expect(view.proposals[0]?.unavailableReason).toBe("Assist cannot reach a DRAFT action.");
  });

  it("finds the latest free half hour before a meeting, stepping past busy entries", () => {
    const entries = [
      { start: "09:00", end: "10:15", row: { id: "busy" } },
      { start: "10:30", end: "11:00", row: { id: "target" } },
    ] as never;
    expect(freeSlotBefore(entries, { start: "10:30", row: { id: "target" } } as never, "07:45")).toStrictEqual({ start: "08:30", end: "09:00" });
    expect(freeSlotBefore(entries, { start: "10:30", row: { id: "target" } } as never, "08:45")).toBeNull();
  });
});
