/**
 * The role signals rules, against hand built rows.
 *
 * The integration suite proves the signals meet the seeded day. These prove
 * the rules themselves: which calendar entry is the next meeting, how a run
 * and its stage rows become "Stage 2 of 8", that stage progress is read from
 * rows rather than inferred from position, and that an absent row produces an
 * honest sentence rather than a plausible one.
 */

import { describe, expect, it } from "vitest";
import {
  focusSignalFrom,
  meetingSignalFrom,
  processSignalFrom,
  selectNextMeeting,
  startTimeOf,
  unavailableSignals,
  type CalendarEntryInput,
  type ProcessDefinitionInput,
  type RoleAppInput,
} from "@/features/role-signals/assemble";
import type { FocusItemView } from "@/workday/contracts";

/* ==========================================================================
   Fixtures
   ========================================================================== */

const APP: RoleAppInput = {
  name: "RCSA Cycle Assistant",
  nameDe: "RCSA-Zyklus-Assistent",
  entryRoute: "/workday/rcsa/processes/rcsa-cycle",
};

const PROCESS: ProcessDefinitionInput = {
  stages: [
    { id: "scope-trigger", sequence: 1, name: "Scope and Trigger", nameDe: "Umfang und Ausloesungsgrund" },
    { id: "evidence-refresh", sequence: 2, name: "Evidence Refresh", nameDe: "Nachweisauffrischung" },
    { id: "risk-control-change", sequence: 3, name: "Risk and Control Change", nameDe: "Risiko- und Kontrollaenderung" },
    { id: "first-line-input", sequence: 4, name: "First-line Input", nameDe: "Erstlinien-Eingabe" },
    { id: "challenge-workshop", sequence: 5, name: "Challenge Workshop", nameDe: "Herausforderungs-Workshop" },
    { id: "rating-appetite", sequence: 6, name: "Rating and Appetite", nameDe: "Bewertung und Risikobereitschaft" },
    { id: "actions-approval", sequence: 7, name: "Actions and Approval", nameDe: "Massnahmen und Genehmigung" },
    { id: "monitoring-reassessment", sequence: 8, name: "Monitoring and Reassessment", nameDe: "Ueberwachung und Neubewertung" },
  ],
};

function focusItem(overrides: Partial<FocusItemView> = {}): FocusItemView {
  return {
    id: "focus-decision-DEC-1",
    section: "needs-you",
    title: "Three indicator explanations or one causal investigation",
    objectType: "decision",
    objectId: "DEC-1",
    reason: "an escalation is waiting on your authority",
    arrivedAtMoment: "07:45",
    sourceCount: 3,
    aiStatus: "ready",
    humanAction: "Record the decision",
    dueMoment: null,
    decisionId: "DEC-1",
    suggestionId: null,
    eventId: null,
    severity: "high",
    authorityClass: "PROPOSE",
    href: "/workday/rcsa/decisions#DEC-1",
    ...overrides,
  };
}

function entry(overrides: Partial<CalendarEntryInput> & { startsAt: string }): CalendarEntryInput {
  return {
    id: `CAL-${overrides.startsAt}`,
    title: "Meeting",
    titleDe: "",
    kind: "meeting",
    ...overrides,
  };
}

const DAY = "2026-10-06";

/* ==========================================================================
   Current focus
   ========================================================================== */

describe("the current focus signal", () => {
  it("is the Now item's title and link, unchanged", () => {
    const signal = focusSignalFrom(focusItem(), "en");
    expect(signal).toEqual({
      state: "present",
      value: "Three indicator explanations or one causal investigation",
      href: "/workday/rcsa/decisions#DEC-1",
      needsJudgment: true,
    });
  });

  it("marks prepared work as not waiting on the person", () => {
    expect(focusSignalFrom(focusItem({ section: "prepared" }), "en").needsJudgment).toBe(false);
  });

  it("says so in words when nothing needs the person, in both languages", () => {
    expect(focusSignalFrom(null, "en")).toMatchObject({
      state: "empty",
      value: "Nothing needs your judgment now",
      href: null,
    });
    expect(focusSignalFrom(null, "de").value).toBe("Derzeit benoetigt nichts Ihr Urteil");
  });
});

/* ==========================================================================
   Active process
   ========================================================================== */

describe("the active process signal", () => {
  const run = { id: "RUN-1", currentStageId: "evidence-refresh", status: "in-progress" };
  const stageRuns = [
    { stageId: "scope-trigger", status: "completed" },
    { stageId: "evidence-refresh", status: "waiting-for-input" },
  ];

  it("states the app, the stage position and the stage count", () => {
    const signal = processSignalFrom({ app: APP, process: PROCESS, run, stageRuns, language: "en" });
    expect(signal.state).toBe("present");
    expect(signal.value).toBe("RCSA Cycle Assistant, Stage 2 of 8");
    expect(signal.stageName).toBe("Evidence Refresh");
    expect(signal.stageSequence).toBe(2);
    expect(signal.stageCount).toBe(8);
    expect(signal.stageStatus).toBe("Waiting for your input");
    expect(signal.href).toBe("/workday/rcsa/processes/rcsa-cycle");
  });

  it("reads in German from the German definition names", () => {
    const signal = processSignalFrom({ app: APP, process: PROCESS, run, stageRuns, language: "de" });
    expect(signal.value).toBe("RCSA-Zyklus-Assistent, Stufe 2 von 8");
    expect(signal.stageName).toBe("Nachweisauffrischung");
    expect(signal.stageStatus).toBe("Wartet auf Ihre Eingabe");
  });

  it("fills the stage track from stage run rows", () => {
    const signal = processSignalFrom({ app: APP, process: PROCESS, run, stageRuns, language: "en" });
    expect(signal.stages.map((stage) => stage.progress)).toEqual([
      "completed",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("does not call an earlier stage completed when no row says so", () => {
    const signal = processSignalFrom({
      app: APP,
      process: PROCESS,
      run: { ...run, currentStageId: "risk-control-change" },
      stageRuns: [{ stageId: "scope-trigger", status: "completed" }],
      language: "en",
    });
    expect(signal.value).toBe("RCSA Cycle Assistant, Stage 3 of 8");
    expect(signal.stages[1]?.progress).toBe("upcoming");
    expect(signal.stages[2]?.progress).toBe("current");
  });

  it("orders stages by their sequence, not by the order they were declared", () => {
    const shuffled: ProcessDefinitionInput = { stages: [...PROCESS.stages].reverse() };
    const signal = processSignalFrom({ app: APP, process: shuffled, run, stageRuns, language: "en" });
    expect(signal.stages.map((stage) => stage.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(signal.value).toBe("RCSA Cycle Assistant, Stage 2 of 8");
  });

  it("states a completed run as completed rather than as its last stage", () => {
    const signal = processSignalFrom({
      app: APP,
      process: PROCESS,
      run: { ...run, currentStageId: "monitoring-reassessment", status: "completed" },
      stageRuns: [],
      language: "en",
    });
    expect(signal.value).toBe("RCSA Cycle Assistant, completed");
    expect(signal.stageSequence).toBeNull();
    expect(signal.stages.every((stage) => stage.progress === "completed")).toBe(true);
  });

  it("states a blocked run as blocked", () => {
    const signal = processSignalFrom({
      app: APP,
      process: PROCESS,
      run: { ...run, status: "blocked" },
      stageRuns,
      language: "en",
    });
    expect(signal.value).toBe("RCSA Cycle Assistant, Stage 2 of 8, blocked");
    expect(signal.stageStatus).toBe("Blocked");
  });

  it("reports a stage the definition does not contain as unavailable, not as a position", () => {
    const signal = processSignalFrom({
      app: APP,
      process: PROCESS,
      run: { ...run, currentStageId: "no-such-stage" },
      stageRuns,
      language: "en",
    });
    expect(signal.state).toBe("unavailable");
    expect(signal.stageSequence).toBeNull();
    expect(signal.value).toContain("not part of the process definition");
  });

  it("says there is no active process when there is no run, no app or no definition", () => {
    for (const input of [
      { app: APP, process: PROCESS, run: null },
      { app: null, process: PROCESS, run },
      { app: APP, process: null, run },
    ]) {
      const signal = processSignalFrom({ ...input, stageRuns, language: "en" });
      expect(signal.state).toBe("empty");
      expect(signal.value).toBe("No active process");
      expect(signal.stages).toEqual([]);
    }
    expect(
      processSignalFrom({ app: null, process: null, run: null, stageRuns: [], language: "de" }).value,
    ).toBe("Kein aktiver Prozess");
  });
});

/* ==========================================================================
   Next meeting
   ========================================================================== */

describe("the next meeting selection", () => {
  const calendar = [
    entry({ startsAt: `${DAY}T07:45:00.000Z`, kind: "focus-time", title: "Morning decision brief" }),
    entry({ startsAt: `${DAY}T10:30:00.000Z`, kind: "workshop", title: "RCSA challenge workshop" }),
    entry({ startsAt: `${DAY}T09:30:00.000Z`, title: "Indicator framing" }),
    entry({ startsAt: `${DAY}T16:30:00.000Z`, kind: "workshop", title: "Sign-off planning" }),
  ];

  it("takes the first meeting at or after the clock, whatever the input order", () => {
    const selection = selectNextMeeting(calendar, "07:45", DAY);
    expect(selection.outcome).toBe("next");
    expect(selection.outcome === "next" && selection.entry.title).toBe("Indicator framing");
  });

  it("counts a meeting that starts exactly now as the next one", () => {
    const selection = selectNextMeeting(calendar, "10:30", DAY);
    expect(selection.outcome === "next" && selection.entry.title).toBe("RCSA challenge workshop");
  });

  it("never treats focus time as a meeting", () => {
    const selection = selectNextMeeting(calendar, "07:00", DAY);
    expect(selection.outcome === "next" && selection.entry.kind).not.toBe("focus-time");
  });

  it("ignores entries on another day", () => {
    const selection = selectNextMeeting(
      [entry({ startsAt: "2026-10-07T09:00:00.000Z", title: "Tomorrow" })],
      "07:45",
      DAY,
    );
    expect(selection.outcome).toBe("none-scheduled");
  });

  it("distinguishes no meetings at all from no meetings left", () => {
    expect(selectNextMeeting([], "07:45", DAY).outcome).toBe("none-scheduled");
    expect(selectNextMeeting(calendar.slice(0, 1), "07:45", DAY).outcome).toBe("none-scheduled");
    expect(selectNextMeeting(calendar, "17:00", DAY).outcome).toBe("none-remaining");
  });

  it("reads the start time with the same slice as the agenda", () => {
    expect(startTimeOf(`${DAY}T09:30:00.000Z`)).toBe("09:30");
    expect(startTimeOf("09:30")).toBe("09:30");
  });
});

describe("the next meeting signal", () => {
  it("carries the title and the start time", () => {
    const signal = meetingSignalFrom(
      { outcome: "next", entry: entry({ startsAt: `${DAY}T09:30:00.000Z`, title: "Indicator framing" }) },
      "en",
      "/workday/rcsa/work?view=agenda",
    );
    expect(signal).toEqual({
      state: "present",
      value: "Indicator framing",
      time: "09:30",
      href: "/workday/rcsa/work?view=agenda",
    });
  });

  it("uses the German title when one exists and the English one otherwise", () => {
    const withGerman = entry({ startsAt: `${DAY}T09:30:00.000Z`, title: "Workshop", titleDe: "Werkstatt" });
    const withoutGerman = entry({ startsAt: `${DAY}T09:30:00.000Z`, title: "Workshop", titleDe: "" });
    expect(meetingSignalFrom({ outcome: "next", entry: withGerman }, "de", null).value).toBe("Werkstatt");
    expect(meetingSignalFrom({ outcome: "next", entry: withoutGerman }, "de", null).value).toBe("Workshop");
  });

  it("states the empty cases honestly, in both languages", () => {
    expect(meetingSignalFrom({ outcome: "none-scheduled" }, "en", null)).toEqual({
      state: "empty",
      value: "No meeting scheduled today",
      time: null,
      href: null,
    });
    expect(meetingSignalFrom({ outcome: "none-remaining" }, "en", null).value).toBe("No further meeting today");
    expect(meetingSignalFrom({ outcome: "none-scheduled" }, "de", null).value).toBe(
      "Heute keine Besprechung geplant",
    );
  });
});

/* ==========================================================================
   Unavailable
   ========================================================================== */

describe("unavailable signals", () => {
  it("mark all three signals unavailable and say why", () => {
    const signals = unavailableSignals("rcsa", "en", "not-seeded");
    for (const signal of [signals.focus, signals.process, signals.meeting]) {
      expect(signal.state).toBe("unavailable");
      expect(signal.value).toBe("Unavailable: the scenario has not been seeded");
    }
    expect(signals.atMoment).toBeNull();
    expect(unavailableSignals("tprm", "de", "read-failed").focus.value).toBe(
      "Nicht verfuegbar: das Szenario konnte nicht gelesen werden",
    );
  });
});

/* ==========================================================================
   Copy rules
   ========================================================================== */

describe("role signal copy", () => {
  it("contains no em dash, no en dash and no umlaut in either language", async () => {
    const { ROLE_SIGNAL_LABELS, STAGE_STATUS_LABELS } = await import("@/features/role-signals/labels");
    const strings = [...Object.values(ROLE_SIGNAL_LABELS), ...Object.values(STAGE_STATUS_LABELS)].flatMap(
      (pair) => [pair.en, pair.de],
    );
    /*
     * Built from code points so this file itself stays ASCII: en dash, em
     * dash, the six umlauts and the eszett.
     */
    const banned = [0x2013, 0x2014, 0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf].map((code) =>
      String.fromCharCode(code),
    );
    for (const text of strings) {
      for (const character of banned) {
        expect(text.includes(character), `"${text}" contains U+${character.charCodeAt(0).toString(16)}`).toBe(false);
      }
    }
  });
});
