/**
 * The AI Partner's pure rules in Wave 3: the lifecycle, the needs-you count
 * the header and the dock share, the routine windows, the focus read from the
 * workday's addresses, and the validator every routine output passes.
 */

import { describe, expect, it } from "vitest";
import { AI_FEEDBACK_KINDS } from "@/db/schema/ai-partner";
import { SUGGESTION_DISPOSITIONS } from "@/db/schema/live";
import {
  PARTNER_DISPOSITIONS,
  PARTNER_FEEDBACK_KINDS,
  canTransition,
  countNeedingYou,
  exclusiveWith,
  snoozeUntil,
  suggestionNeedsYou,
} from "@/features/partner/rules";
import { focusFromLocation, focusKey } from "@/features/partner/focus";
import { objectLink, suggestionHref } from "@/features/partner/links";
import { ROUTINE_KIND_BY_OUTPUT } from "@/features/partner/tasks";
import {
  followUpCandidates,
  followUpWindows,
  materialChanges,
  meetingWindows,
  monitoringWindows,
  routineRunKey,
  triageWindows,
} from "@/features/routines/windows";
import { ROUTINE_OUTPUT_SCHEMA_VERSION, validateRoutineOutput, type RoutineOutput } from "@/features/routines/schema";
import { prepareMaterialChanges, prepareReminders, prepareTriage } from "@/features/routines/prepare";
import { AI_PART_KINDS, AI_PART_LABELS, DISPOSITION_LABELS, FEEDBACK_LABELS, selectSuggestionActions } from "@/components/ai-partner/labels";

describe("the vocabularies", () => {
  it("mirror the schema", () => {
    expect([...PARTNER_DISPOSITIONS]).toEqual([...SUGGESTION_DISPOSITIONS]);
    expect([...PARTNER_FEEDBACK_KINDS]).toEqual([...AI_FEEDBACK_KINDS]);
    for (const kind of PARTNER_FEEDBACK_KINDS) expect(FEEDBACK_LABELS[kind].de).toMatch(/^[\x20-\x7e]+$/);
    for (const disposition of PARTNER_DISPOSITIONS) expect(DISPOSITION_LABELS[disposition].en.length).toBeGreaterThan(0);
  });

  it("names the plan's nine typed outputs", () => {
    const labels = AI_PART_KINDS.map((kind) => AI_PART_LABELS[kind].en);
    for (const name of ["Answer", "Evidence", "Uncertainty", "Recommendation", "Approval request", "Execution receipt", "Blocked action", "Follow-up question"]) {
      expect(labels).toContain(name);
    }
    expect(labels.some((label) => label.startsWith("Proposed action"))).toBe(true);
  });

  it("maps every runnable output kind to a routine kind", () => {
    expect(Object.values(ROUTINE_KIND_BY_OUTPUT).sort()).toEqual(
      ["action-follow-up", "event-monitoring", "event-monitoring", "inbox-triage", "meeting-preparation"].sort(),
    );
  });
});

describe("the lifecycle rules", () => {
  it("lets a person answer only while the suggestion is open", () => {
    expect(canTransition("new", "accepted", "human").allowed).toBe(true);
    expect(canTransition("reviewed", "rejected", "human").allowed).toBe(true);
    expect(canTransition("accepted", "rejected", "human").allowed).toBe(false);
    expect(canTransition("new", "executed", "human").allowed).toBe(false);
    expect(canTransition("rejected", "accepted", "human").allowed).toBe(false);
  });

  it("lets only the system record what came of an answer", () => {
    expect(canTransition("accepted", "executed", "system").allowed).toBe(true);
    expect(canTransition("modified", "executed", "system").allowed).toBe(true);
    expect(canTransition("new", "executed", "system").allowed).toBe(false);
    expect(canTransition("new", "expired", "system").allowed).toBe(true);
    expect(canTransition("executed", "expired", "system").allowed).toBe(false);
  });

  it("counts what needs the person the same way for the header and the dock", () => {
    const rows = [
      { status: "needs-user" as const, decisionRequired: true, disposition: "new" as const },
      { status: "needs-user" as const, decisionRequired: true, disposition: "accepted" as const },
      { status: "ready" as const, decisionRequired: false, disposition: "new" as const },
      { status: "ready" as const, decisionRequired: true, disposition: "reviewed" as const },
      { status: "checking" as const, decisionRequired: true, disposition: "new" as const },
    ];
    expect(countNeedingYou(rows)).toBe(2);
    expect(suggestionNeedsYou({ status: "needs-user", decisionRequired: false })).toBe(true);
  });

  it("makes Useful and Not useful exclusive, and snoozes on the scenario clock", () => {
    expect(exclusiveWith("useful")).toBe("not-useful");
    expect(exclusiveWith("wrong-source")).toBeNull();
    expect(snoozeUntil("10:30")).toBe("11:30");
    expect(snoozeUntil("23:30")).toBe("23:59");
  });

  it("offers Accept on an open draft, Approve only where a human gates the change", () => {
    const draft = selectSuggestionActions({ status: "ready", authorityClass: "DRAFT", constrained: false, decisionRequired: false, hasRecommendation: true });
    expect(draft.primary).toBe("accept");
    const gated = selectSuggestionActions({ status: "needs-user", authorityClass: "APPROVAL_REQUIRED", constrained: false, decisionRequired: true, hasRecommendation: true });
    expect(gated.primary).toBe("approve");
    const constrained = selectSuggestionActions({ status: "ready", authorityClass: "DRAFT", constrained: true, decisionRequired: false, hasRecommendation: true });
    expect(constrained.primary).not.toBe("accept");
  });
});

describe("the routine windows", () => {
  const calendar = [
    { meetingId: "MTG-1", kind: "meeting", startsAt: "2026-10-06T10:30:00.000Z" },
    { meetingId: null, kind: "focus-time", startsAt: "2026-10-06T10:15:00.000Z" },
    { meetingId: "MTG-2", kind: "workshop", startsAt: "2026-10-06T09:30:00.000Z" },
  ];
  const base = { scenarioDate: "2026-10-06", offsetMinutes: -30, concluded: new Set<string>(), prepared: new Set<string>() };

  it("prepares a meeting from start minus the offset until it starts, never after", () => {
    expect(meetingWindows(calendar, { ...base, now: "09:59" })).toEqual([]);
    expect(meetingWindows(calendar, { ...base, now: "10:00" }).map((window) => window.targets[0])).toEqual(["MTG-1"]);
    expect(meetingWindows(calendar, { ...base, now: "10:30" })).toEqual([]);
    expect(meetingWindows(calendar, { ...base, now: "10:10", prepared: new Set(["MTG-1"]) })).toEqual([]);
  });

  it("drafts follow-ups only for actions owned by others, overdue or due within two days", () => {
    const actions = [
      { id: "A1", status: "overdue", dueOn: "2026-09-30", ownerUserId: "P-007", ownerLabel: "", priority: "high" },
      { id: "A2", status: "in-progress", dueOn: "2026-10-08", ownerUserId: "P-003", ownerLabel: "", priority: "high" },
      { id: "A3", status: "open", dueOn: "2026-10-20", ownerUserId: "P-007", ownerLabel: "", priority: "medium" },
      { id: "A4", status: "completed", dueOn: "2026-10-01", ownerUserId: "P-007", ownerLabel: "", priority: "medium" },
    ];
    const candidates = followUpCandidates(actions, { holderUserId: "P-003", scenarioDate: "2026-10-06" });
    expect(candidates.map((action) => action.id)).toEqual(["A1"]);
    expect(followUpWindows(candidates, { now: "08:59", time: "09:00", drafted: new Set() })).toEqual([]);
    expect(followUpWindows(candidates, { now: "09:00", time: "09:00", drafted: new Set() })[0]?.windowKey).toBe("day");
    expect(followUpWindows(candidates, { now: "11:00", time: "09:00", drafted: new Set(["A1"]) })).toEqual([]);
  });

  it("proposes triage once per arrival batch, for messages no one classified", () => {
    const messages = [
      { id: "M1", revealedAtMoment: "07:45", confirmedTriage: null, conversionKind: null, linkedActionId: null, linkedDecisionId: null },
      { id: "M2", revealedAtMoment: "08:10", confirmedTriage: "action", conversionKind: null, linkedActionId: null, linkedDecisionId: null },
      { id: "M3", revealedAtMoment: "08:45", confirmedTriage: null, conversionKind: null, linkedActionId: null, linkedDecisionId: null },
    ];
    expect(triageWindows(messages, { now: "08:50", proposed: new Set(["M1"]) })).toEqual([
      { windowKey: "arrivals:08:45", triggerKind: "event", triggerRef: "M3", targets: ["M3"] },
    ]);
    expect(triageWindows(messages, { now: "08:50", proposed: new Set(["M1", "M3"]) })).toEqual([]);
  });

  it("raises material changes only, and watches hourly whether or not one arrived", () => {
    const events = [
      { id: "E1", atMoment: "14:05", origin: "live-event" as const, type: "work-arrived", liveEventType: "shared-event", severity: "critical", derivedFrom: "timeline" },
      { id: "E2", atMoment: "14:05", origin: "live-event" as const, type: "work-arrived", liveEventType: "message", severity: "high", derivedFrom: "inbox" },
      { id: "E3", atMoment: "07:45", origin: "live-event" as const, type: "work-arrived", liveEventType: "decision-required", severity: "high", derivedFrom: "decision" },
      { id: "E4", atMoment: "15:00", origin: "live-event" as const, type: "work-arrived", liveEventType: "signal", severity: "informational", derivedFrom: "timeline" },
    ];
    expect(materialChanges(events, "14:30").map((event) => event.id)).toEqual(["E1"]);
    expect(monitoringWindows([], { now: "09:20", raised: new Set() })).toEqual([{ windowKey: "hour:09", triggerKind: "schedule", triggerRef: null, targets: [] }]);
    expect(routineRunKey("kri-control-watch", "2026-10-06", "hour:09")).toBe("routine:kri-control-watch:2026-10-06:hour:09");
  });
});

describe("the focus read from the workday's addresses", () => {
  it("reads Home, Work, Processes and Decisions", () => {
    expect(focusFromLocation("rcsa", { pathname: "/workday/rcsa", search: "?select=control:CTL-PAY-014", hash: "" }, null, null).selection).toEqual({
      objectType: "control",
      objectId: "CTL-PAY-014",
    });
    expect(
      focusFromLocation("rcsa", { pathname: "/workday/rcsa/work", search: "?view=meetings&item=MTG-2026-0005", hash: "" }, { kind: "meeting", itemId: "MTG-2026-0005", selection: null }, null).workItem,
    ).toEqual({ kind: "meeting", id: "MTG-2026-0005" });
    expect(focusFromLocation("rcsa", { pathname: "/workday/rcsa/processes/rcsa-cycle", search: "?stage=evidence-refresh", hash: "" }, null, null).process).toEqual({
      slug: "rcsa-cycle",
      stageId: "evidence-refresh",
    });
    expect(focusFromLocation("rcsa", { pathname: "/workday/rcsa/decisions", search: "", hash: "#DEC-2026-0771" }, null, null).decisionId).toBe("DEC-2026-0771");
    const a = focusFromLocation("rcsa", { pathname: "/workday/rcsa/decisions", search: "", hash: "#DEC-2026-0771" }, null, null);
    const b = focusFromLocation("rcsa", { pathname: "/workday/rcsa/decisions", search: "", hash: "#DEC-2026-0772" }, null, null);
    expect(focusKey(a)).not.toBe(focusKey(b));
  });

  it("refuses an identifier that is not one", () => {
    expect(focusFromLocation("rcsa", { pathname: "/workday/rcsa/decisions", search: "", hash: "#<script>" }, null, null).decisionId).toBeNull();
  });

  it("links each kind of output where its work is done", () => {
    expect(objectLink("rcsa", "meeting-preparation", "MTG-2026-0005")).toContain("view=meetings");
    expect(objectLink("rcsa", "action-reminder-draft", "MSN-2026-0166")).toContain("MSN-2026-0166");
    expect(suggestionHref("rcsa", { decisionId: "DEC-2026-0771", objectType: "risk", objectId: "RSK-0211" })).toBe("/workday/rcsa/decisions#DEC-2026-0771");
  });
});

describe("routine outputs", () => {
  const valid: RoutineOutput = {
    schemaVersion: ROUTINE_OUTPUT_SCHEMA_VERSION,
    objectType: "meeting",
    objectId: "MTG-1",
    priority: "medium",
    headline: "Brief prepared",
    changeSummary: "Three questions are ready.",
    whyItMatters: "The meeting starts at 10:30.",
    checksCompleted: ["Read the pack"],
    actionsCompleted: [],
    recommendedAction: "Read the questions before 10:30.",
    alternatives: [],
    evidenceIds: ["EVD-1"],
    uncertainty: [],
    confidence: 60,
    decisionId: null,
    decisionRequired: false,
  };
  const context = { knownEvidenceIds: new Set(["EVD-1"]), knownDecisionIds: new Set<string>(), language: "en" as const };

  it("accepts a grounded output and refuses one that claims a change or cites nothing real", () => {
    expect(validateRoutineOutput(valid, context).ok).toBe(true);
    expect(validateRoutineOutput({ ...valid, actionsCompleted: ["Updated the record"] }, context).ok).toBe(false);
    expect(validateRoutineOutput({ ...valid, decisionRequired: true }, context).ok).toBe(false);
    expect(validateRoutineOutput({ ...valid, evidenceIds: ["EVD-404"] }, context).ok).toBe(false);
    expect(validateRoutineOutput({ ...valid, headline: `Brief ${String.fromCharCode(0x2014)} prepared` }, context).ok).toBe(false);
    expect(validateRoutineOutput({ ...valid, recommendedAction: "Ask the LLM" }, context).ok).toBe(false);
  });

  it("composes outputs that pass the validator in both languages", () => {
    for (const language of ["en", "de"] as const) {
      const reminders = prepareReminders(
        [
          {
            action: { id: "MSN-1", reference: "MSN-1", title: "Close the gap", titleDe: "Luecke schliessen", dueOn: "2026-09-30", ownerName: "Jonas Keller" },
            overdue: true,
            draft: { subject: "Reminder: MSN-1", body: "Please update the action." },
          },
        ],
        language,
      );
      const triage = prepareTriage(
        [{ messageId: "IMSG-1", subject: "s", subjectDe: "s", revealedAtMoment: "08:10", classification: "evidence", rationale: { en: "It carries a document.", de: null }, mode: "safe" }],
        { language, now: "08:15", live: false },
      );
      const changes = prepareMaterialChanges(
        [
          {
            eventId: "WLE-TL-M08",
            atMoment: "14:05",
            title: "Shared supplier and payments event",
            titleDe: "Gemeinsames Lieferanten- und Zahlungsereignis",
            objectKind: "timeline",
            objectId: "M08",
            roleView: { headline: "One afternoon of overrides", workObjectKind: "risk", workObjectId: "RSK-0211", evidenceIds: ["EVD-1"], decisionIds: [], uncertainty: "Not yet confirmed." },
            openDecisions: [],
            laterMeetings: [{ meetingId: "MTG-1", title: "t", titleDe: "t", at: "16:30" }],
            stage: null,
          },
        ],
        language,
      );
      for (const prepared of [reminders, triage, changes]) {
        expect(prepared.outputs.length).toBe(1);
        for (const output of prepared.outputs) {
          const result = validateRoutineOutput(output.candidate, { ...context, language });
          expect(result.ok, JSON.stringify(result)).toBe(true);
        }
        expect(prepared.summary.de).toMatch(/^[\x20-\x7e]+$/);
      }
    }
  });
});
