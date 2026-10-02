/**
 * Live day unit tests: the player state machine and the event model.
 *
 * No database. Every function under test here is pure, and keeping it that way
 * is the reason the auto-pause rule can be checked exhaustively rather than
 * sampled through the interface. The framing is adversarial about the three
 * things that would look fine in a demonstration and be wrong: a step that
 * rewinds live time, a player that rolls past a decision, and a keyboard
 * shortcut that fires while someone is typing.
 */

import { describe, expect, it } from "vitest";
import {
  LIVE_DAY_LABELS,
  PLAYER_SPEEDS,
  buildMomentStops,
  isPlayerSpeed,
  reducePlayer,
  resolveLiveDayShortcut,
  reviewNewLabel,
  stepIntervalMs,
  stopIndexFor,
  toPlayerView,
  type MomentStop,
  type PlayerSnapshot,
} from "@/scenario/engine/live-player";
import {
  arrivedBy,
  compareLiveEvents,
  countUnread,
  firstBlockingIndex,
  orderForCatchUp,
  sortLiveEvents,
  unreadEvents,
} from "@/scenario/engine/live-events";
import { eventVisibleToRole, type WorkdayLiveEvent } from "@/workday/contracts";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";

/* ==========================================================================
   Fixtures
   ========================================================================== */

const MOMENTS = ["07:45", "08:10", "10:30", "11:45", "14:05", "15:00", "16:30"];

function event(partial: Partial<WorkdayLiveEvent> & { id: string; atMoment: string }): WorkdayLiveEvent {
  return {
    sortOrder: 0,
    type: "signal",
    roleIds: [],
    severity: "informational",
    title: `Event ${partial.id}`,
    summary: "A seeded beat of the day.",
    objectType: "timeline",
    objectId: "M01",
    evidenceIds: [],
    requiresDecision: false,
    autoPause: false,
    decisionId: null,
    derivedFrom: "timeline",
    sourceConnectorIds: [],
    createdAt: "2026-10-06T06:45:00.000Z",
    readAt: null,
    acknowledgedAt: null,
    ...partial,
  };
}

/** A day with a decision at 11:45, the shared event at 14:05 and one at 15:00. */
function seededDay(): WorkdayLiveEvent[] {
  return [
    event({ id: "E-0745", atMoment: "07:45", sortOrder: 0, readAt: "2026-10-06T06:45:00.000Z" }),
    event({
      id: "E-0810-msg",
      atMoment: "08:10",
      sortOrder: 200,
      type: "message",
      roleIds: ["tprm"],
      severity: "low",
    }),
    event({ id: "E-1030", atMoment: "10:30", sortOrder: 0 }),
    event({
      id: "E-1145-dec",
      atMoment: "11:45",
      sortOrder: 600,
      type: "decision-required",
      roleIds: ["tprm"],
      severity: "high",
      requiresDecision: true,
      autoPause: true,
      decisionId: "DEC-2026-0759",
      derivedFrom: "decision",
    }),
    event({
      id: "E-1405-shared",
      atMoment: "14:05",
      sortOrder: 0,
      type: "shared-event",
      severity: "critical",
      autoPause: true,
      roleIds: [],
    }),
    event({ id: "E-1500-sig", atMoment: "15:00", sortOrder: 0 }),
    event({
      id: "E-1500-dec",
      atMoment: "15:00",
      sortOrder: 600,
      type: "decision-required",
      roleIds: ["tprm"],
      severity: "high",
      requiresDecision: true,
      autoPause: true,
      decisionId: "DEC-2026-0779",
      derivedFrom: "decision",
    }),
    event({ id: "E-1630", atMoment: "16:30", sortOrder: 0 }),
  ];
}

function stopsFor(roleId: RoleId = "tprm"): MomentStop[] {
  return buildMomentStops(seededDay(), roleId, MOMENTS);
}

function snapshot(partial: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    playing: false,
    speed: 1,
    viewedMoment: "07:45",
    liveMoment: "07:45",
    pausedByDecisionId: null,
    pausedReason: "",
    catchUpActive: false,
    catchUpIndex: 0,
    ...partial,
  };
}

/* ==========================================================================
   Event ordering
   ========================================================================== */

describe("event ordering", () => {
  it("orders by scenario time, then sort order, then identifier", () => {
    const shuffled = [
      event({ id: "B", atMoment: "14:05", sortOrder: 600 }),
      event({ id: "A", atMoment: "14:05", sortOrder: 0 }),
      event({ id: "C", atMoment: "08:10", sortOrder: 900 }),
    ];
    expect(sortLiveEvents(shuffled).map((e) => e.id)).toEqual(["C", "A", "B"]);
  });

  it("is a total order, so two runs of the same day agree", () => {
    const a = event({ id: "A1", atMoment: "10:30", sortOrder: 100 });
    const b = event({ id: "A2", atMoment: "10:30", sortOrder: 100 });
    expect(compareLiveEvents(a, b)).toBeLessThan(0);
    expect(compareLiveEvents(b, a)).toBeGreaterThan(0);
    expect(compareLiveEvents(a, a)).toBe(0);
  });

  it("puts the moment's own signal before the decision it leads to", () => {
    const atMoment = sortLiveEvents(seededDay()).filter((e) => e.atMoment === "15:00");
    expect(atMoment.map((e) => e.type)).toEqual(["signal", "decision-required"]);
  });

  it("only returns events the day has reached", () => {
    expect(arrivedBy(seededDay(), "10:30").map((e) => e.id)).toEqual([
      "E-0745",
      "E-0810-msg",
      "E-1030",
    ]);
  });
});

/* ==========================================================================
   Unread
   ========================================================================== */

describe("unread computation", () => {
  it("counts only events that have arrived and are not read", () => {
    const day = seededDay();
    expect(countUnread(day, "07:45")).toBe(0);
    expect(countUnread(day, "08:10")).toBe(1);
    expect(countUnread(day, "16:30")).toBe(7);
  });

  it("never counts an event the day has not reached", () => {
    // The failure this guards is the day opening with sixty unread items, most
    // of which have not happened yet.
    const day = seededDay();
    const all = day.length;
    expect(countUnread(day, "07:45")).toBeLessThan(all);
    expect(unreadEvents(day, "07:45")).toHaveLength(0);
  });

  it("treats a missing read timestamp as unread", () => {
    const day = [event({ id: "X", atMoment: "08:10", readAt: null })];
    expect(countUnread(day, "08:10")).toBe(1);
  });

  it("does not count an event once it is read", () => {
    const day = [event({ id: "X", atMoment: "08:10", readAt: "2026-10-06T08:10:00.000Z" })];
    expect(countUnread(day, "08:10")).toBe(0);
  });

  it("resolves the shared event as visible to every role", () => {
    const shared = seededDay().find((e) => e.type === "shared-event");
    expect(shared).toBeDefined();
    for (const roleId of ROLE_IDS) {
      expect(eventVisibleToRole(shared!, roleId)).toBe(true);
    }
  });

  it("keeps a role scoped event out of another role's set", () => {
    const decision = seededDay().find((e) => e.id === "E-1145-dec");
    expect(eventVisibleToRole(decision!, "tprm")).toBe(true);
    expect(eventVisibleToRole(decision!, "rcsa")).toBe(false);
  });
});

/* ==========================================================================
   Catch up ordering
   ========================================================================== */

describe("catch-up ordering", () => {
  it("is chronological, not by severity", () => {
    const queue = orderForCatchUp(seededDay(), "16:30");
    expect(queue.map((e) => e.id)).toEqual([
      "E-0810-msg",
      "E-1030",
      "E-1145-dec",
      "E-1405-shared",
      "E-1500-sig",
      "E-1500-dec",
      "E-1630",
    ]);
    // The critical item is fourth, not first. A walk that led with it would
    // explain the 15:00 decision before the event that caused it.
    expect(queue[0]?.severity).toBe("low");
  });

  it("stops at the first material decision", () => {
    const queue = orderForCatchUp(seededDay(), "16:30");
    expect(firstBlockingIndex(queue)).toBe(2);
    expect(queue[2]?.id).toBe("E-1145-dec");
  });

  it("returns an empty queue once everything is read", () => {
    const read = seededDay().map((e) => ({ ...e, readAt: "2026-10-06T16:30:00.000Z" }));
    expect(orderForCatchUp(read, "16:30")).toHaveLength(0);
    expect(firstBlockingIndex([])).toBe(-1);
  });
});

/* ==========================================================================
   Stops
   ========================================================================== */

describe("the stops of the day", () => {
  it("includes seeded moments the acting role has no event at", () => {
    const stops = buildMomentStops(seededDay(), "rcsa", MOMENTS);
    expect(stops.map((s) => s.moment)).toEqual(MOMENTS);
    expect(stops.find((s) => s.moment === "08:10")?.eventIds).toEqual([]);
  });

  it("records the auto-pause event for the acting role only", () => {
    expect(stopsFor("tprm").find((s) => s.moment === "11:45")?.autoPause?.decisionId).toBe(
      "DEC-2026-0759",
    );
    expect(stopsFor("rcsa").find((s) => s.moment === "11:45")?.autoPause).toBeNull();
  });

  it("gives every role the 14:05 stop", () => {
    for (const roleId of ROLE_IDS) {
      expect(stopsFor(roleId).find((s) => s.moment === "14:05")?.autoPause).not.toBeNull();
    }
  });

  it("resolves a moment between two stops to the earlier one", () => {
    const stops = stopsFor();
    // An integration event at 14:12 must not push the player off the list.
    expect(stops[stopIndexFor(stops, "14:12")]?.moment).toBe("14:05");
    expect(stopIndexFor(stops, "06:00")).toBe(-1);
  });
});

/* ==========================================================================
   Play and pause
   ========================================================================== */

describe("play and pause transitions", () => {
  const stops = stopsFor();

  it("play sets playing and clears a recorded pause", () => {
    const paused = snapshot({
      playing: false,
      pausedByDecisionId: "DEC-2026-0759",
      pausedReason: "A decision is yours.",
    });
    const next = reducePlayer(paused, { kind: "play" }, stops).next;
    expect(next.playing).toBe(true);
    expect(next.pausedByDecisionId).toBeNull();
    expect(next.pausedReason).toBe("");
  });

  it("pause stops playing and records the reason", () => {
    const next = reducePlayer(snapshot({ playing: true }), { kind: "pause", reason: "Catch up" }, stops)
      .next;
    expect(next.playing).toBe(false);
    expect(next.pausedReason).toBe("Catch up");
  });

  it("reports no change when play is pressed twice", () => {
    const playing = snapshot({ playing: true });
    expect(reducePlayer(playing, { kind: "play" }, stops).changed).toBe(false);
  });

  it("stops playing at the end of the day rather than spinning", () => {
    const atEnd = snapshot({ playing: true, viewedMoment: "16:30", liveMoment: "16:30" });
    const transition = reducePlayer(atEnd, { kind: "advance" }, stops);
    expect(transition.next.playing).toBe(false);
    expect(transition.advanceLiveTo).toBeNull();
    expect(toPlayerView(atEnd, stops).atDayEnd).toBe(true);
  });
});

/* ==========================================================================
   Auto pause
   ========================================================================== */

describe("automatic pause at a human decision", () => {
  const stops = stopsFor();

  it("stops the player at the decision and does not roll past", () => {
    const before = snapshot({ playing: true, viewedMoment: "10:30", liveMoment: "10:30" });
    const transition = reducePlayer(before, { kind: "advance" }, stops);

    expect(transition.next.viewedMoment).toBe("11:45");
    expect(transition.next.playing).toBe(false);
    expect(transition.next.pausedByDecisionId).toBe("DEC-2026-0759");
    expect(transition.next.pausedReason.length).toBeGreaterThan(0);
    expect(transition.pausedAtEventId).toBe("E-1145-dec");
  });

  it("continues past the decision once the user resumes", () => {
    const paused = snapshot({
      playing: false,
      viewedMoment: "11:45",
      liveMoment: "11:45",
      pausedByDecisionId: "DEC-2026-0759",
      pausedReason: "A decision is yours.",
    });
    const resumed = reducePlayer(paused, { kind: "play" }, stops).next;
    const stepped = reducePlayer(resumed, { kind: "advance" }, stops);

    // Resuming must not re-pause in place, or the day would never move again.
    expect(stepped.next.viewedMoment).toBe("14:05");
    expect(stepped.pausedAtEventId).toBe("E-1405-shared");
  });

  it("does not stop for a routine arrival", () => {
    const before = snapshot({ playing: true, viewedMoment: "07:45", liveMoment: "07:45" });
    const transition = reducePlayer(before, { kind: "advance" }, stops);
    expect(transition.next.viewedMoment).toBe("08:10");
    expect(transition.next.playing).toBe(true);
    expect(transition.pausedAtEventId).toBeNull();
  });

  it("does not stop a deliberate press of Next", () => {
    // A person pressing Next has seen the decision and asked to move on.
    const before = snapshot({ playing: false, viewedMoment: "10:30", liveMoment: "10:30" });
    const transition = reducePlayer(before, { kind: "next" }, stops);
    expect(transition.next.viewedMoment).toBe("11:45");
    expect(transition.pausedAtEventId).toBeNull();
  });

  it("stops at every auto-pause moment when played from the start", () => {
    let current = snapshot({ playing: true });
    const stopped: string[] = [];

    for (let i = 0; i < stops.length * 2; i += 1) {
      if (!current.playing) current = reducePlayer(current, { kind: "play" }, stops).next;
      const transition = reducePlayer(current, { kind: "advance" }, stops);
      if (!transition.changed) break;
      current = transition.next;
      if (transition.pausedAtEventId !== null) stopped.push(current.viewedMoment);
    }

    expect(stopped).toEqual(["11:45", "14:05", "15:00"]);
    expect(current.viewedMoment).toBe("16:30");
  });
});

/* ==========================================================================
   Viewed versus live time
   ========================================================================== */

describe("viewed time versus live time", () => {
  const stops = stopsFor();

  it("stepping back never rewinds live time", () => {
    const at1405 = snapshot({ viewedMoment: "14:05", liveMoment: "14:05" });
    const back = reducePlayer(at1405, { kind: "previous" }, stops);

    expect(back.next.viewedMoment).toBe("11:45");
    expect(back.next.liveMoment).toBe("14:05");
    expect(back.advanceLiveTo).toBeNull();
  });

  it("stepping forward while behind catches up without moving live time", () => {
    const behind = snapshot({ viewedMoment: "10:30", liveMoment: "14:05" });
    const forward = reducePlayer(behind, { kind: "next" }, stops);

    expect(forward.next.viewedMoment).toBe("11:45");
    expect(forward.advanceLiveTo).toBeNull();
    // Replay, not arrival: these events have already happened and must not
    // re-announce themselves or become unread again.
    expect(forward.arrivedEventIds).toEqual([]);
  });

  it("stepping forward from live time advances live time and publishes arrivals", () => {
    const atLive = snapshot({ viewedMoment: "11:45", liveMoment: "11:45" });
    const forward = reducePlayer(atLive, { kind: "next" }, stops);

    expect(forward.advanceLiveTo).toBe("14:05");
    expect(forward.arrivedEventIds).toContain("E-1405-shared");
  });

  it("reports behind only when the viewed moment is earlier", () => {
    expect(toPlayerView(snapshot({ viewedMoment: "10:30", liveMoment: "14:05" }), stops).behind).toBe(
      true,
    );
    expect(toPlayerView(snapshot({ viewedMoment: "14:05", liveMoment: "14:05" }), stops).behind).toBe(
      false,
    );
  });

  it("jump to live realigns the viewed moment and clears the pause", () => {
    const behind = snapshot({
      viewedMoment: "08:10",
      liveMoment: "15:00",
      pausedByDecisionId: "DEC-2026-0759",
      catchUpActive: true,
      catchUpIndex: 3,
    });
    const jumped = reducePlayer(behind, { kind: "jump-to-live" }, stops).next;

    expect(jumped.viewedMoment).toBe("15:00");
    expect(jumped.liveMoment).toBe("15:00");
    expect(jumped.pausedByDecisionId).toBeNull();
    expect(jumped.catchUpActive).toBe(false);
  });

  it("refuses to scrub forward past live time", () => {
    const behind = snapshot({ viewedMoment: "08:10", liveMoment: "10:30" });
    expect(reducePlayer(behind, { kind: "scrub", moment: "15:00" }, stops).changed).toBe(false);
    expect(reducePlayer(behind, { kind: "scrub", moment: "07:45" }, stops).next.viewedMoment).toBe(
      "07:45",
    );
  });
});

/* ==========================================================================
   Catch up transitions
   ========================================================================== */

describe("catch-up transitions", () => {
  const stops = stopsFor();

  it("starting a walk pauses the day", () => {
    const playing = snapshot({ playing: true });
    const next = reducePlayer(playing, { kind: "catch-up-start" }, stops).next;
    expect(next.catchUpActive).toBe(true);
    expect(next.catchUpIndex).toBe(0);
    expect(next.playing).toBe(false);
  });

  it("walks forward one item at a time", () => {
    const walking = snapshot({ catchUpActive: true, catchUpIndex: 0 });
    const next = reducePlayer(walking, { kind: "catch-up-next", total: 3 }, stops).next;
    expect(next.catchUpIndex).toBe(1);
    expect(next.catchUpActive).toBe(true);
  });

  it("closes itself on the last item", () => {
    const last = snapshot({ catchUpActive: true, catchUpIndex: 2 });
    const next = reducePlayer(last, { kind: "catch-up-next", total: 3 }, stops).next;
    expect(next.catchUpActive).toBe(false);
    expect(next.catchUpIndex).toBe(0);
  });
});

/* ==========================================================================
   Speed
   ========================================================================== */

describe("speed", () => {
  const stops = stopsFor();

  it("offers exactly 1x and 2x", () => {
    expect([...PLAYER_SPEEDS]).toEqual([1, 2]);
  });

  it("accepts 1 and 2 and nothing else", () => {
    expect(isPlayerSpeed(1)).toBe(true);
    expect(isPlayerSpeed(2)).toBe(true);
    for (const rejected of [0, 3, 4, 8, -1, 1.5, "2", null, undefined]) {
      expect(isPlayerSpeed(rejected)).toBe(false);
    }
  });

  it("ignores an unsupported speed rather than clamping it", () => {
    const at1x = snapshot({ speed: 1 });
    const transition = reducePlayer(at1x, { kind: "set-speed", speed: 4 }, stops);
    expect(transition.changed).toBe(false);
    expect(transition.next.speed).toBe(1);
  });

  it("halves the step interval at 2x", () => {
    expect(stepIntervalMs(2)).toBe(Math.round(stepIntervalMs(1) / 2));
  });
});

/* ==========================================================================
   Keyboard
   ========================================================================== */

describe("the keyboard map", () => {
  it("binds Space, Left, Right, C and L", () => {
    expect(resolveLiveDayShortcut({ key: " ", typing: false })).toBe("play-pause");
    expect(resolveLiveDayShortcut({ key: "ArrowLeft", typing: false })).toBe("previous");
    expect(resolveLiveDayShortcut({ key: "ArrowRight", typing: false })).toBe("next");
    expect(resolveLiveDayShortcut({ key: "c", typing: false })).toBe("catch-up");
    expect(resolveLiveDayShortcut({ key: "C", typing: false })).toBe("catch-up");
    expect(resolveLiveDayShortcut({ key: "l", typing: false })).toBe("jump-to-live");
    expect(resolveLiveDayShortcut({ key: "L", typing: false })).toBe("jump-to-live");
  });

  it("fires nothing while the user is typing", () => {
    // The failure this prevents: a presenter typing a question into the chat
    // composer pausing the day with every word.
    for (const key of [" ", "ArrowLeft", "ArrowRight", "c", "l"]) {
      expect(resolveLiveDayShortcut({ key, typing: true })).toBeNull();
    }
  });

  it("leaves modified keys to the browser", () => {
    expect(resolveLiveDayShortcut({ key: "l", typing: false, metaKey: true })).toBeNull();
    expect(resolveLiveDayShortcut({ key: "c", typing: false, ctrlKey: true })).toBeNull();
    expect(resolveLiveDayShortcut({ key: "ArrowRight", typing: false, altKey: true })).toBeNull();
  });

  it("ignores keys it does not own", () => {
    for (const key of ["a", "Enter", "Escape", "ArrowUp", "k"]) {
      expect(resolveLiveDayShortcut({ key, typing: false })).toBeNull();
    }
  });
});

/* ==========================================================================
   Copy
   ========================================================================== */

describe("the live day copy", () => {
  const strings = Object.values(LIVE_DAY_LABELS).flatMap((pair) => [pair.en, pair.de]);

  /*
   * Both characters are built from their code points. The copy gate scans this
   * file and cannot tell an assertion about a character from a use of it, so a
   * literal here would fail the gate these tests exist to reinforce.
   */
  const EM_DASH = String.fromCharCode(0x2014);
  const EN_DASH = String.fromCharCode(0x2013);

  it("carries no em dash", () => {
    const offenders = strings.filter((text) => text.includes(EM_DASH));
    expect(offenders).toEqual([]);
  });

  it("carries no en dash either", () => {
    expect(strings.filter((text) => text.includes(EN_DASH))).toEqual([]);
  });

  it("has an English and a German form for every label", () => {
    for (const [key, pair] of Object.entries(LIVE_DAY_LABELS)) {
      expect(pair.en.length, `${key} is missing English`).toBeGreaterThan(0);
      expect(pair.de.length, `${key} is missing German`).toBeGreaterThan(0);
    }
  });

  it("keeps German ASCII safe, with ae, oe, ue and ss", () => {
    const german = Object.values(LIVE_DAY_LABELS).map((pair) => pair.de);
    const offenders = german.filter((text) => /[^\u0000-\u007F]/.test(text));
    expect(offenders).toEqual([]);
  });

  it("builds the review count copy in both languages", () => {
    expect(reviewNewLabel(3, "en")).toBe("Review 3 new");
    expect(reviewNewLabel(3, "de")).toBe("3 neue pruefen");
    for (const language of ["en", "de"] as const) {
      expect(reviewNewLabel(1, language)).not.toContain(EM_DASH);
    }
  });
});
