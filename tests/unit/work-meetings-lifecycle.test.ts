/**
 * The meeting lifecycle's pure parts: the clock, the validators, the
 * composers, the merge, the view, and the Work Hub readings that migration
 * 0005 turned into recorded columns.
 *
 * Every claim is made with plain objects, so it reads as "given this record,
 * the product says this".
 */

import { describe, expect, it } from "vitest";
import { ACTION_UPDATE_KINDS } from "@/db/schema/role-app-runtime";
import type { MeetingTurnRow, RecordedContradiction } from "@/db/repositories/meetings";
import {
  emptyMinutesDraft,
  MEETING_PREPARATION_SCHEMA_VERSION,
  validateMeetingPreparation,
  validateMinutesDraft,
  type MinutesDraft,
  type MinutesValidationContext,
} from "@/features/work/modules/meetings/ai-schema";
import { composeMeetingPreparation, composeMinutesDraft, mergeIntoDraft, mentionedIds } from "@/features/work/modules/meetings/compose";
import {
  actionIdForMinutes,
  draftOfMinutes,
  evidenceIdForMinutes,
  heardTurns,
  meetingClock,
  meetingEnd,
  minutesIdForMeeting,
  type MeetingLifecycleData,
} from "@/features/work/modules/meetings/lifecycle";
import { buildMeetingsView, EMPTY_MEETINGS_EXTRAS, resolveMeetingDetail } from "@/features/work/modules/meetings/read-model";
import { dependentActions, deriveMeetingProcessLink, meetingProcess } from "@/features/work/modules/meeting-facts";
import { classifyAction, ENTRY_KINDS, kindOfEntry } from "@/features/work/modules/actions/policy";
import { actionRow, at, calendarRow, evidenceRow, meetingRow, minutesRow, processScope, query, shared } from "./support/work-fixtures";

const EM_DASH = String.fromCharCode(0x2014);
const UMLAUT = String.fromCharCode(0xfc);

function turn(n: number, overrides: Partial<MeetingTurnRow> = {}): MeetingTurnRow {
  return {
    id: `T-${String(n).padStart(2, "0")}`,
    runId: "run-001",
    meetingId: "MTG-1",
    sortOrder: n,
    speakerUserId: "P-007",
    speakerLabel: "Jonas Keller",
    speakerKind: "participant",
    atMoment: `10:${String(30 + n).padStart(2, "0")}`,
    content: `Statement ${n}.`,
    provenance: "stakeholder-statement",
    contradictsEvidenceId: null,
    contradictionNote: "",
    isScriptedAnchor: true,
    flagDismissed: false,
    correctionRecorded: false,
    correctionText: "",
    ...overrides,
  };
}

const MEETING = meetingRow({
  id: "MTG-1",
  scheduledFor: at("10:30"),
  subjectKind: "control",
  subjectId: "CTL-1",
  participantUserIds: ["P-003", "P-007", "P-099"],
  evidenceDocumentIds: ["EVD-1", "EVD-2"],
  preparedQuestions: ["Which exception did CTL-9 detect?"],
  preparationSummary: "The gap is one band.",
});

function context(overrides: Partial<MinutesValidationContext> = {}): MinutesValidationContext {
  return {
    knownEvidenceIds: new Set(["EVD-1", "EVD-2"]),
    knownTurnIds: new Set(["T-01", "T-02"]),
    knownDecisionIds: new Set(["DEC-1"]),
    openActionIds: new Set(["A-1"]),
    internalPeople: new Set(["P-003", "P-007"]),
    actionKinds: new Set(["evidence-request", "remediation"]),
    scenarioDate: "2026-10-06",
    author: "person",
    ...overrides,
  };
}

function draft(overrides: Partial<MinutesDraft> = {}): MinutesDraft {
  return { ...emptyMinutesDraft("en"), summary: "Held.", ...overrides };
}

function newAction(overrides: Partial<MinutesDraft["actions"][number]> = {}): MinutesDraft["actions"][number] {
  return {
    key: "A-01",
    title: "Obtain the configuration",
    existingActionId: null,
    ownerUserId: "P-007",
    ownerLabel: "",
    dueOn: "2026-10-10",
    kind: "evidence-request",
    completionCondition: "",
    evidenceIds: [],
    turnIds: ["T-01"],
    origin: "person",
    ...overrides,
  };
}

describe("the clock", () => {
  it("places a meeting before, during and after by the scenario moment and its agenda end", () => {
    const end = meetingEnd(MEETING, at("12:00"), []);
    expect(end).toBe("12:00");
    expect(meetingClock(MEETING, "2026-10-06", "07:45", end).phase).toBe("before");
    expect(meetingClock(MEETING, "2026-10-06", "11:45", end).phase).toBe("during");
    expect(meetingClock(MEETING, "2026-10-06", "13:30", end).phase).toBe("after");
    expect(meetingClock({ ...MEETING, status: "concluded" }, "2026-10-06", "07:45", end).phase).toBe("after");
    expect(meetingClock({ ...MEETING, scheduledFor: "2026-10-01T10:30:00.000Z" }, "2026-10-06", "07:45", end).phase).toBe("after");
  });

  it("falls back to the last recorded turn, then an hour, for the end", () => {
    expect(meetingEnd(MEETING, null, [turn(1), turn(9)])).toBe("10:39");
    expect(meetingEnd(MEETING, null, [])).toBe("11:30");
  });

  it("shows only the turns spoken by the current moment", () => {
    const turns = [turn(1), turn(5), turn(20)];
    expect(heardTurns(MEETING, turns, "2026-10-06", "10:35").map((entry) => entry.id)).toStrictEqual(["T-01", "T-05"]);
    expect(heardTurns(MEETING, turns, "2026-10-06", "07:45")).toStrictEqual([]);
    expect(heardTurns({ ...MEETING, status: "concluded" }, turns, "2026-10-06", "07:45")).toHaveLength(3);
  });
});

describe("the minutes validator", () => {
  it("accepts a draft whose every reference resolves", () => {
    const result = validateMinutesDraft(
      draft({ facts: [{ key: "F-01", text: "Fact.", evidenceIds: ["EVD-1"], turnIds: ["T-01"], origin: "ai" }], actions: [newAction()] }),
      context({ forConfirmation: true }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects, rather than drops, an unknown document, turn, decision, owner or existing action", () => {
    const result = validateMinutesDraft(
      draft({
        facts: [{ key: "F-01", text: "Fact.", evidenceIds: ["EVD-NOPE"], turnIds: ["T-99"], origin: "ai" }],
        decisions: [{ key: "D-01", text: "Decided.", decisionId: "DEC-9", outcome: "agreed", turnIds: [], origin: "person" }],
        actions: [newAction({ ownerUserId: "P-099" }), newAction({ key: "A-02", existingActionId: "A-9" })],
        distribution: ["P-099"],
      }),
      context(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.failures.map((failure) => failure.path);
      expect(paths).toEqual(
        expect.arrayContaining(["facts[0].evidenceIds", "facts[0].turnIds", "decisions[0].decisionId", "actions[0].ownerUserId", "actions[1].existingActionId", "distribution"]),
      );
    }
  });

  it("refuses a due date before the scenario day, and on confirmation an action without owner or date", () => {
    const past = validateMinutesDraft(draft({ actions: [newAction({ dueOn: "2026-10-01" })] }), context());
    expect(past.ok).toBe(false);
    expect(validateMinutesDraft(draft({ actions: [newAction({ ownerUserId: null, dueOn: null })] }), context()).ok).toBe(true);
    const confirm = validateMinutesDraft(draft({ actions: [newAction({ ownerUserId: null, dueOn: null })] }), context({ forConfirmation: true }));
    expect(confirm.ok).toBe(false);
    if (!confirm.ok) expect(confirm.failures.map((failure) => failure.message.en).join(" ")).toContain("no accountable owner");
  });

  it("holds the AI's text to the copy rules, and a person's words to their references only", () => {
    const withDash = draft({ facts: [{ key: "F-01", text: `One ${EM_DASH} two.`, evidenceIds: [], turnIds: [], origin: "ai" }] });
    expect(validateMinutesDraft(withDash, context({ author: "ai" })).ok).toBe(false);
    expect(validateMinutesDraft(withDash, context({ author: "person" })).ok).toBe(true);
    const german = { ...emptyMinutesDraft("de"), summary: `Gepr${UMLAUT}ft.` };
    expect(validateMinutesDraft(german, context({ author: "ai" })).ok).toBe(false);
  });

  it("refuses duplicate item keys and an empty record for confirmation", () => {
    const twice = draft({ unresolved: [{ key: "U-01", text: "A", turnIds: [], origin: "person" }, { key: "U-01", text: "B", turnIds: [], origin: "person" }] });
    expect(validateMinutesDraft(twice, context()).ok).toBe(false);
    expect(validateMinutesDraft({ ...emptyMinutesDraft("en") }, context({ forConfirmation: true })).ok).toBe(false);
  });
});

describe("the preparation", () => {
  const contradictions: RecordedContradiction[] = [
    { id: "C-1", targetKind: "control", targetId: "CTL-1", description: "Partially Effective against Fully Effective.", evidenceIds: ["EVD-1", "EVD-3"] },
    { id: "C-2", targetKind: "supplier", targetId: "TP-9", description: "Elsewhere.", evidenceIds: ["EVD-8"] },
  ];

  it("composes outcomes, questions with their documents and the contradictions that bear on the meeting", () => {
    const output = composeMeetingPreparation({
      meeting: MEETING,
      typeLabel: { en: "Workshop", de: "Workshop" },
      pack: new Map([
        ["EVD-1", evidenceRow({ id: "EVD-1", relatedObjectIds: ["CTL-9"] })],
        ["EVD-2", evidenceRow({ id: "EVD-2", isStale: true })],
      ]),
      openDecisions: [{ id: "DEC-1", reference: "DEC-1", title: "Rate the control", titleDe: "", status: "open", roleId: "rcsa", relatedObjectId: "CTL-1" }],
      stageCriteria: [{ en: "The minutes are confirmed", de: "Das Protokoll ist bestaetigt" }],
      contradictions,
      dueBefore: [actionRow({ id: "A-1", dueOn: "2026-10-01" })],
      scenarioDate: "2026-10-06",
    });
    expect(output.schemaVersion).toBe(MEETING_PREPARATION_SCHEMA_VERSION);
    expect(output.contradictions.map((item) => item.objectId)).toStrictEqual(["CTL-1"]);
    expect(output.questions[0]?.evidenceIds).toStrictEqual(["EVD-1"]);
    expect(output.expectedOutcomes.map((item) => item.basis)).toStrictEqual(["decision", "stage", "minutes"]);
    expect(output.watch).toHaveLength(2);
    expect(validateMeetingPreparation(output, { knownEvidenceIds: new Set(["EVD-1", "EVD-2", "EVD-3"]) }).ok).toBe(true);
    expect(validateMeetingPreparation(output, { knownEvidenceIds: new Set(["EVD-1"]) }).ok).toBe(false);
  });
});

describe("the offline minutes composer", () => {
  const turns = [
    turn(1, { speakerKind: "system", speakerLabel: "Record", speakerUserId: null, provenance: "approved-record", content: "Session opened. Present: four." }),
    turn(2, { provenance: "verified-fact", speakerKind: "assistant", content: "The trace at EVD-1 shows the waiver. A second sentence. A third." }),
    turn(3, { contradictsEvidenceId: "EVD-2", contradictionNote: "The log shows the review after release. More.", content: "Every override was reviewed first." }),
    turn(4, { content: "MSN-2026-0001 is still open and DEC-1 needs a position." }),
    turn(5, { speakerKind: "system", speakerLabel: "Record", speakerUserId: null, provenance: "approved-record", content: "Session closed. Action requested of P-007: obtain the tenant configuration under clause 2.1." }),
  ];

  const composed = composeMinutesDraft({
    meeting: MEETING,
    typeLabel: "Workshop",
    turns,
    complete: true,
    language: "en",
    internalPeople: new Set(["P-003", "P-007"]),
    decisions: [{ id: "DEC-1", reference: "DEC-1", title: "Rate it", titleDe: "", status: "open", roleId: "rcsa", relatedObjectId: "CTL-1" }],
    openActions: [actionRow({ id: "MSN-2026-0001", title: "Existing work", ownerUserId: "P-007" })],
    knownEvidenceIds: new Set(["EVD-1", "EVD-2"]),
    actionKinds: ["evidence-request"],
    holderUserId: "P-003",
  });

  it("writes facts only from verified facts and records, citing what the turn cites", () => {
    expect(composed.facts.map((fact) => fact.turnIds[0])).toStrictEqual(["T-01", "T-02"]);
    expect(composed.facts[1]?.evidenceIds).toStrictEqual(["EVD-1"]);
    expect(composed.facts[1]?.text).toBe("The trace at EVD-1 shows the waiver. A second sentence.");
  });

  it("leaves the judgment to the person: decisions referred, new actions undated", () => {
    expect(composed.decisions).toHaveLength(1);
    expect(composed.decisions[0]).toMatchObject({ decisionId: "DEC-1", outcome: "referred" });
    const follow = composed.actions.find((action) => action.existingActionId === "MSN-2026-0001");
    expect(follow).toBeDefined();
    const raised = composed.actions.find((action) => action.existingActionId === null);
    expect(raised).toMatchObject({ ownerUserId: "P-007", dueOn: null, title: "Obtain the tenant configuration under clause 2.1" });
  });

  it("records a flagged statement as unresolved, and addresses only internal participants", () => {
    expect(composed.unresolved[0]?.turnIds).toStrictEqual(["T-03"]);
    expect(composed.unresolved[0]?.text).toContain("Flagged against the evidence");
    expect(composed.distribution).toStrictEqual(["P-003", "P-007"]);
    expect(composed.summary).toContain("Session closed.");
    expect(
      validateMinutesDraft(composed, context({ author: "ai", openActionIds: new Set(["MSN-2026-0001"]), knownTurnIds: new Set(turns.map((entry) => entry.id)) })).ok,
    ).toBe(true);
  });

  it("keeps the person's captures first and drops the AI's item for a turn the person already captured", () => {
    const mine = draft({ facts: [{ key: "FP-01", text: "My reading of turn 2.", evidenceIds: [], turnIds: ["T-02"], origin: "person" }] });
    const merged = mergeIntoDraft(composed, mine);
    expect(merged.facts[0]?.key).toBe("FP-01");
    expect(merged.facts.filter((fact) => fact.turnIds.includes("T-02"))).toHaveLength(1);
    expect(merged.facts.some((fact) => fact.turnIds.includes("T-01"))).toBe(true);
    expect(merged.summary).toBe("Held.");
  });

  it("reads identifiers out of text", () => {
    expect(mentionedIds("See EVD-2026-00001, CTL-ABC-001 and TP-0001.1; not P-002.")).toStrictEqual(["EVD-2026-00001", "CTL-ABC-001", "TP-0001.1"]);
  });
});

describe("identifiers the confirmation writes", () => {
  it("derives every row from the minutes identifier, so a retry writes the same rows", () => {
    expect(minutesIdForMeeting("MTG-2026-0005")).toBe("MIN-2026-0005");
    expect(evidenceIdForMinutes("MIN-2026-0005")).toBe("EVD-MIN-2026-0005");
    expect(actionIdForMinutes("MIN-2026-0005", 2)).toBe("MSN-2026-0005-A02");
    expect(actionIdForMinutes("MINUTES-X-1", 1)).toBe("MSN-X-1-A01");
  });

  it("reads a minutes record written before drafts were structured from its flat columns", () => {
    const legacy = draftOfMinutes(minutesRow({ id: "MIN-1", meetingId: "MTG-1", factItems: ["Scope confirmed."], unresolvedItems: ["Open."], decisionIds: ["DEC-1"] }), "en");
    expect(legacy.facts[0]?.text).toBe("Scope confirmed.");
    expect(legacy.unresolved[0]?.text).toBe("Open.");
    expect(legacy.decisions[0]).toMatchObject({ decisionId: "DEC-1", outcome: "referred" });
  });
});

describe("the lifecycle view", () => {
  function lifecycleData(overrides: Partial<MeetingLifecycleData> = {}): MeetingLifecycleData {
    return {
      meetingId: "MTG-1",
      turns: [turn(1), turn(2, { contradictsEvidenceId: "EVD-1", contradictionNote: "Contradicted." })],
      evidence: new Map([["EVD-1", evidenceRow({ id: "EVD-1", summary: "The log." })]]),
      contradictions: [],
      preparation: { output: null, mode: "offline", note: { en: "Composed.", de: "Zusammengestellt." } },
      minutes: null,
      distribution: null,
      stage: null,
      endsAt: at("12:00"),
      ...overrides,
    };
  }

  const data = (moment: string, minutes = null as ReturnType<typeof minutesRow> | null) =>
    shared({
      currentMoment: moment,
      meetings: [MEETING],
      calendar: [calendarRow({ id: "CAL-1", meetingId: "MTG-1", startsAt: at("10:30"), endsAt: at("12:00") })],
      minutes: minutes ? [minutes] : [],
    });

  it("opens before the meeting with capture and drafting withheld, and says why", () => {
    const detail = resolveMeetingDetail("MTG-1", data("07:45"), { ...EMPTY_MEETINGS_EXTRAS, lifecycle: lifecycleData() }, query({ tab: "meetings" }));
    expect(detail?.lifecycle?.phase).toBe("before");
    expect(detail?.lifecycle?.during.capture.enabled).toBe(false);
    expect(detail?.lifecycle?.after.canPrepare).toBe(false);
    expect(detail?.status.label).toBe("Not started");
  });

  it("during the meeting shows the turns heard, their flags and the documents behind them", () => {
    const detail = resolveMeetingDetail("MTG-1", data("10:31"), { ...EMPTY_MEETINGS_EXTRAS, lifecycle: lifecycleData() }, query({ tab: "meetings" }));
    expect(detail?.lifecycle?.phase).toBe("during");
    expect(detail?.status.label).toBe("In progress");
    expect(detail?.lifecycle?.during.turns.map((entry) => entry.id)).toStrictEqual(["T-01"]);
    expect(detail?.lifecycle?.during.pending).toBe(1);
    const later = resolveMeetingDetail("MTG-1", data("10:45"), { ...EMPTY_MEETINGS_EXTRAS, lifecycle: lifecycleData() }, query({ tab: "meetings" }));
    const flagged = later?.lifecycle?.during.turns[1];
    expect(flagged?.flag?.note).toBe("Contradicted.");
    expect(flagged?.evidence[0]?.id).toBe("EVD-1");
    expect(later?.lifecycle?.during.capture.enabled).toBe(true);
  });

  it("after the meeting lists what is missing before confirmation, and what confirmation will change", () => {
    const minutes = minutesRow({
      id: "MIN-1",
      meetingId: "MTG-1",
      version: 3,
      draft: draft({ actions: [newAction({ dueOn: null })], distribution: ["P-003"] }) as unknown as Record<string, unknown>,
    });
    const detail = resolveMeetingDetail(
      "MTG-1",
      data("13:30", minutes),
      { ...EMPTY_MEETINGS_EXTRAS, lifecycle: lifecycleData({ minutes }) },
      query({ tab: "meetings" }),
    );
    const panel = detail?.lifecycle?.after.minutes;
    expect(panel?.readiness.ready).toBe(false);
    expect(panel?.readiness.missing.join(" ")).toContain("no due date");
    expect(panel?.actions[0]?.due).toBe("Date needed");
    expect(panel?.confirmation.willChange.join(" ")).toContain("EVD-MIN-1");
    expect(panel?.confirmation.approval).toContain("version 3");
  });
});

describe("the archive", () => {
  it("shows a meeting's own minutes on the meeting's row, and only orphaned minutes on their own", () => {
    const view = buildMeetingsView(
      shared({
        meetings: [meetingRow({ id: "MTG-1", status: "concluded" })],
        minutes: [minutesRow({ id: "MIN-1", meetingId: "MTG-1", status: "draft" }), minutesRow({ id: "MIN-2", meetingId: "MTG-OLD", status: "confirmed" })],
      }),
      EMPTY_MEETINGS_EXTRAS,
      query({ tab: "meetings", meetingsView: "archive" }),
    );
    const rows = view.groups[0]?.rows ?? [];
    expect(rows.map((entry) => entry.id)).toStrictEqual(["MTG-1", "MIN-2"]);
    expect(rows[0]?.chips.map((chip) => chip.label)).toContain("Minutes draft");
  });
});

describe("recorded columns (migration 0005)", () => {
  it("keeps the schema's entry kinds and the policy's in step, and reads the kind column first", () => {
    expect([...ENTRY_KINDS]).toStrictEqual([...ACTION_UPDATE_KINDS]);
    expect(kindOfEntry({ id: "seeded-note", kind: "MTG" })).toBe("MTG");
    expect(kindOfEntry({ id: "AUP-CMP-1-0001", kind: "UPD" })).toBe("CMP");
    expect(kindOfEntry({ id: "AUP-BLK-1-0001" })).toBe("BLK");
  });

  it("reads the recorded process link, and the rule only for a meeting that records none", () => {
    const scopes = [processScope({ scopeIds: ["SOMETHING-ELSE"] })];
    const recorded = meetingProcess(meetingRow({ id: "M", subjectId: "CTL-1", processRunId: "RUN-1", stageId: "challenge-workshop" }), shared({ processScopes: scopes }));
    expect(recorded?.stageId).toBe("challenge-workshop");
    expect(meetingProcess(meetingRow({ id: "M", subjectId: "CTL-1" }), shared({ processScopes: scopes }))).toBeNull();
    expect(deriveMeetingProcessLink(meetingRow({ id: "M", subjectId: "CTL-1", kind: "rcsa-workshop" }), [processScope()], shared().config)).toStrictEqual({
      processRunId: "RUN-1",
      stageId: "challenge-workshop",
    });
  });

  it("counts an action raised in the meeting as dependent work, whatever its subject", () => {
    const dependents = dependentActions(MEETING, shared({ actions: [actionRow({ id: "A-1", relatedObjectId: "OTHER", sourceMeetingId: "MTG-1" })] }));
    expect(dependents.map((action) => action.id)).toStrictEqual(["A-1"]);
  });

  it("reads a blocker from the action's recorded state", () => {
    const state = classifyAction(actionRow({ id: "A-1", blockedReason: "Environment frozen." }), [], "P-003", "2026-10-06", null);
    expect(state.blocked).toBe(true);
    expect(state.blockerNote).toBe("Environment frozen.");
  });
});
