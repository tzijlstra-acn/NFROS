/**
 * Live day integration tests: the projection, read state and live time.
 *
 * Against a real SQLite file in the system temporary directory, never the
 * developer's database. See `tests/integration/support/harness.ts` for how that
 * isolation is enforced.
 *
 * The question these tests answer is the one the brief puts hardest: is
 * `workday_live_events` genuinely a projection over the seeded day, or has a
 * second scenario grown up beside the first. So every row's claimed source is
 * resolved against the table it names, and a row whose source does not exist
 * fails the suite. The rest covers the three behaviours that are easy to get
 * wrong and invisible in a demonstration: the 14:05 event reaching all six
 * functions, a role switch preserving unread state, and crossing 14:05 writing
 * the audit event.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { buildLiveEventRows, seedLiveEvents, type LiveEventSeedSummary } from "@/scenario/live-event-seed";
import {
  countUnread,
  getAllLiveEventRows,
  getLiveEventMoments,
  getLiveEventsForRole,
  getPlayerSnapshot,
  getUnreadCountsByRole,
  getUnreadEvents,
  markAllEventsRead,
  markEventRead,
  markReviewedInCatchUp,
  savePlayerSnapshot,
} from "@/scenario/engine/live-events";
import { buildMomentStops, reducePlayer } from "@/scenario/engine/live-player";
import {
  requireScenarioState,
  setMoment,
  SHARED_EVENT_MOMENT,
  switchRole,
} from "@/scenario/engine/state";
import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "@/db/schema/core";
import { eventVisibleToRole } from "@/workday/contracts";
import { momentToMinutes } from "@/domain/nfr/calculators";

let summary: LiveEventSeedSummary;

/** The last moment of the day, which is where every event has arrived. */
let endOfDay: string;

beforeAll(() => {
  createTemporaryDatabase("live-day");
  seedScenario(DEFAULT_RUN_ID);
  summary = seedLiveEvents(DEFAULT_RUN_ID);
  endOfDay = getLiveEventMoments(DEFAULT_RUN_ID).slice(-1)[0] ?? "16:30";
});

afterAll(() => {
  destroyTemporaryDatabase();
});

/* ==========================================================================
   The projection
   ========================================================================== */

describe("the projection derives only from seeded sources", () => {
  it("writes a day of events", () => {
    expect(summary.events).toBeGreaterThanOrEqual(40);
    expect(summary.events).toBeLessThanOrEqual(90);
    expect(rowCount("workday_live_events")).toBe(summary.events);
  });

  it("derives from every source the brief names", () => {
    expect(Object.keys(summary.byDerivedFrom).sort()).toEqual([
      "background-action",
      "decision",
      "inbox",
      "meeting",
      "timeline",
    ]);
  });

  it("resolves every derivedFromId against the table it names", () => {
    const sqlite = getSqlite();
    const resolvers: Record<string, string[]> = {
      timeline: ["timeline_events", "timeline_role_moments"],
      "background-action": ["background_actions"],
      inbox: ["inbox_messages"],
      meeting: ["meetings"],
      decision: ["decisions"],
      integration: ["integration_events"],
    };

    const dangling: string[] = [];
    for (const row of getAllLiveEventRows()) {
      const tables = resolvers[row.derivedFrom];
      expect(tables, `${row.id} claims an unknown source ${row.derivedFrom}`).toBeDefined();
      if (!tables) continue;

      const resolved = tables.some((table) => {
        const result = sqlite
          .prepare(`select count(*) as n from "${table}" where id = ? and run_id = ?`)
          .get(row.derivedFromId, row.runId) as { n: number } | undefined;
        return (result?.n ?? 0) > 0;
      });
      if (!resolved) dangling.push(`${row.id} points at ${row.derivedFrom} ${row.derivedFromId}`);
    }

    expect(dangling).toEqual([]);
  });

  it("never leaves derivedFromId empty", () => {
    expect(getAllLiveEventRows().filter((row) => row.derivedFromId.length === 0)).toEqual([]);
  });

  it("links every decision event to a decision that exists and is open", () => {
    const sqlite = getSqlite();
    const decisionRows = getAllLiveEventRows().filter((row) => row.type === "decision-required");
    expect(decisionRows.length).toBeGreaterThan(0);

    for (const row of decisionRows) {
      expect(row.decisionId).not.toBeNull();
      expect(row.requiresDecision).toBe(true);
      const decision = sqlite
        .prepare("select status, role_id, presented_at_moment from decisions where id = ?")
        .get(row.decisionId) as
        | { status: string; role_id: string; presented_at_moment: string }
        | undefined;
      expect(decision, `${row.decisionId} does not exist`).toBeDefined();
      expect(decision?.status).toBe("open");
      // The event must be scoped to the function that owns the decision.
      expect(row.roleIds).toEqual([decision?.role_id]);
      expect(row.atMoment).toBe(decision?.presented_at_moment);
    }
  });

  it("places every event at a moment its source agrees with", () => {
    const sqlite = getSqlite();
    const mismatches: string[] = [];

    for (const row of getAllLiveEventRows()) {
      const expected = (() => {
        switch (row.derivedFrom) {
          case "inbox":
            return (
              sqlite
                .prepare("select revealed_at_moment as m from inbox_messages where id = ?")
                .get(row.derivedFromId) as { m: string } | undefined
            )?.m;
          case "meeting":
            return (
              sqlite
                .prepare("select moment_label as m from meetings where id = ?")
                .get(row.derivedFromId) as { m: string } | undefined
            )?.m;
          case "decision":
            return (
              sqlite
                .prepare("select presented_at_moment as m from decisions where id = ?")
                .get(row.derivedFromId) as { m: string } | undefined
            )?.m;
          case "background-action":
            return (
              sqlite
                .prepare("select performed_at_moment as m from background_actions where id = ?")
                .get(row.derivedFromId) as { m: string } | undefined
            )?.m;
          default:
            return row.atMoment;
        }
      })();

      if (expected !== undefined && expected !== row.atMoment) {
        mismatches.push(`${row.id} at ${row.atMoment}, source says ${expected}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("only pauses the player on a material decision or the shared event", () => {
    const pausing = getAllLiveEventRows().filter((row) => row.autoPause);
    expect(pausing.length).toBeGreaterThan(0);
    for (const row of pausing) {
      expect(["decision-required", "shared-event"]).toContain(row.type);
    }
    // Routine arrivals exist and do not pause, which is the other half of the
    // rule: a projection that paused on everything satisfies the first half.
    const routine = getAllLiveEventRows().filter((row) => row.type === "message");
    expect(routine.length).toBeGreaterThan(0);
    expect(routine.every((row) => !row.autoPause)).toBe(true);
  });

  it("is deterministic across two builds", () => {
    const first = getAllLiveEventRows().map((row) => `${row.id}:${row.sortOrder}`);
    const second = buildLiveEventRows().rows.map((row) => `${row.id}:${row.sortOrder}`);
    expect(second).toEqual(first);
  });

  it("is idempotent: a reseed leaves the same rows", () => {
    const before = getAllLiveEventRows().map((row) => row.id).sort();
    const again = seedLiveEvents(DEFAULT_RUN_ID);
    const after = getAllLiveEventRows().map((row) => row.id).sort();
    expect(after).toEqual(before);
    expect(again.events).toBe(summary.events);
    expect(rowCount("workday_live_event_reads")).toBe(again.readRows);
  });

  it("carries an English and a German form on every row", () => {
    for (const row of getAllLiveEventRows()) {
      expect(row.title.length, `${row.id} title`).toBeGreaterThan(0);
      expect(row.titleDe.length, `${row.id} titleDe`).toBeGreaterThan(0);
      expect(row.summary.length, `${row.id} summary`).toBeGreaterThan(0);
      expect(row.summaryDe.length, `${row.id} summaryDe`).toBeGreaterThan(0);
    }
  });

  it("carries no em dash in any projected string", () => {
    // Built from its code point: the copy gate scans this file and cannot tell
    // an assertion about the character from a use of it.
    const emDash = String.fromCharCode(0x2014);
    const offenders = getAllLiveEventRows().filter((row) =>
      [row.title, row.titleDe, row.summary, row.summaryDe].some((text) => text.includes(emDash)),
    );
    expect(offenders.map((row) => row.id)).toEqual([]);
  });

  it("resolves language at the boundary", () => {
    const english = getLiveEventsForRole("tprm", { language: "en" });
    const german = getLiveEventsForRole("tprm", { language: "de" });
    expect(english.length).toBe(german.length);
    const differing = english.filter((event, index) => event.title !== german[index]?.title);
    expect(differing.length).toBeGreaterThan(0);
  });
});

/* ==========================================================================
   The shared event
   ========================================================================== */

describe("the 14:05 event is visible to all six roles", () => {
  it("exists exactly once, at 14:05, critical, scoped to no role", () => {
    const shared = getAllLiveEventRows().filter((row) => row.type === "shared-event");
    expect(shared).toHaveLength(1);
    expect(shared[0]?.atMoment).toBe(SHARED_EVENT_MOMENT);
    expect(shared[0]?.severity).toBe("critical");
    expect(shared[0]?.roleIds).toEqual([]);
    expect(shared[0]?.autoPause).toBe(true);
  });

  it("is served to every one of the six roles", () => {
    const shared = getAllLiveEventRows().find((row) => row.type === "shared-event");
    expect(shared).toBeDefined();
    if (!shared) return;

    for (const roleId of ROLE_IDS) {
      expect(eventVisibleToRole(shared, roleId), `${roleId} cannot see it`).toBe(true);
      const served = getLiveEventsForRole(roleId).some((event) => event.id === shared.id);
      expect(served, `${roleId} was not served it`).toBe(true);
    }
  });

  it("has a read row for every role, so it is unread per function", () => {
    const shared = getAllLiveEventRows().find((row) => row.type === "shared-event");
    const reads = getSqlite()
      .prepare("select role_id from workday_live_event_reads where event_id = ? order by role_id")
      .all(shared?.id) as Array<{ role_id: string }>;
    expect(reads.map((read) => read.role_id).sort()).toEqual([...ROLE_IDS].sort());
  });

  it("stops the player for every role", () => {
    for (const roleId of ROLE_IDS) {
      const stops = buildMomentStops(
        getLiveEventsForRole(roleId),
        roleId,
        getLiveEventMoments(),
      );
      const stop = stops.find((candidate) => candidate.moment === SHARED_EVENT_MOMENT);
      expect(stop?.autoPause, `${roleId} would roll past 14:05`).not.toBeNull();
    }
  });
});

/* ==========================================================================
   Read state
   ========================================================================== */

describe("read state", () => {
  it("opens the day with nothing unread", () => {
    // The failure this guards: the day opening with sixty unread items, nearly
    // all of which have not happened yet.
    for (const roleId of ROLE_IDS) {
      expect(countUnread(getLiveEventsForRole(roleId), summary.openMoment)).toBe(0);
    }
  });

  it("has unread events for every role by the end of the day", () => {
    const counts = getUnreadCountsByRole(endOfDay);
    for (const roleId of ROLE_IDS) {
      expect(counts[roleId], `${roleId} has nothing unread`).toBeGreaterThan(0);
    }
  });

  it("keys read state per role, so one function reading does not read for another", () => {
    const shared = getAllLiveEventRows().find((row) => row.type === "shared-event");
    expect(shared).toBeDefined();
    if (!shared) return;

    markEventRead(shared.id, "tprm");

    const stillUnread = ROLE_IDS.filter((roleId) => roleId !== "tprm").filter((roleId) =>
      getLiveEventsForRole(roleId).some((event) => event.id === shared.id && event.readAt === null),
    );
    expect(stillUnread).toHaveLength(5);
    expect(
      getLiveEventsForRole("tprm").find((event) => event.id === shared.id)?.readAt,
    ).not.toBeNull();
  });

  it("is idempotent: marking read twice does not change the timestamp", () => {
    const first = getUnreadEvents("rcsa", endOfDay)[0];
    expect(first).toBeDefined();
    if (!first) return;

    markEventRead(first.id, "rcsa");
    const once = getLiveEventsForRole("rcsa").find((event) => event.id === first.id)?.readAt;
    markEventRead(first.id, "rcsa");
    const twice = getLiveEventsForRole("rcsa").find((event) => event.id === first.id)?.readAt;
    expect(twice).toBe(once);
  });

  it("records a catch-up review without losing it on a later read", () => {
    const next = getUnreadEvents("control-assurance", endOfDay)[0];
    expect(next).toBeDefined();
    if (!next) return;

    markReviewedInCatchUp(next.id, "control-assurance");
    markEventRead(next.id, "control-assurance");

    const row = getSqlite()
      .prepare(
        "select reviewed_in_catch_up as reviewed from workday_live_event_reads where event_id = ? and role_id = ?",
      )
      .get(next.id, "control-assurance") as { reviewed: number } | undefined;
    expect(row?.reviewed).toBe(1);
  });

  it("marks all arrived events read and leaves later events alone", () => {
    const midday = "11:45";
    const role: RoleId = "nfr-governance";

    const marked = markAllEventsRead(role, midday);
    expect(marked).toBeGreaterThan(0);
    expect(countUnread(getLiveEventsForRole(role), midday)).toBe(0);

    // Events after the moment marked must stay unread, or they would arrive
    // already read and the count would disagree with the track all afternoon.
    const later = getLiveEventsForRole(role).filter(
      (event) => momentToMinutes(event.atMoment) > momentToMinutes(midday),
    );
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((event) => event.readAt === null)).toBe(true);
  });

  it("orders the catch-up queue chronologically", () => {
    const queue = getUnreadEvents("incident-resilience", endOfDay);
    expect(queue.length).toBeGreaterThan(0);
    for (let i = 1; i < queue.length; i += 1) {
      const previous = queue[i - 1];
      const current = queue[i];
      if (!previous || !current) continue;
      expect(momentToMinutes(current.atMoment)).toBeGreaterThanOrEqual(
        momentToMinutes(previous.atMoment),
      );
    }
  });
});

/* ==========================================================================
   Role switch
   ========================================================================== */

describe("a role switch preserves unread state and the shared event", () => {
  it("leaves every role's unread count exactly where it was", () => {
    const before = getUnreadCountsByRole(endOfDay);

    switchRole("incident-resilience");
    switchRole("regulatory-change");
    switchRole("control-assurance");
    switchRole("tprm");

    const after = getUnreadCountsByRole(endOfDay);
    expect(after).toEqual(before);
  });

  it("keeps the shared event in every role's set after the switches", () => {
    for (const roleId of ROLE_IDS) {
      const served = getLiveEventsForRole(roleId).filter((event) => event.type === "shared-event");
      expect(served, `${roleId} lost the shared event`).toHaveLength(1);
    }
  });

  it("does not touch the read table when the role changes", () => {
    const before = rowCount("workday_live_event_reads");
    switchRole("rcsa");
    switchRole("tprm");
    expect(rowCount("workday_live_event_reads")).toBe(before);
  });

  it("preserves the player position across a switch", () => {
    const state = requireScenarioState();
    const before = getPlayerSnapshot(state.currentMoment);
    switchRole("nfr-governance");
    const after = getPlayerSnapshot(requireScenarioState().currentMoment);
    expect(after.viewedMoment).toBe(before.viewedMoment);
    expect(after.speed).toBe(before.speed);
    switchRole("tprm");
  });
});

/* ==========================================================================
   Live time
   ========================================================================== */

describe("advancing live time through 14:05", () => {
  it("sets eventTriggered and writes the audit event exactly once", () => {
    const sqlite = getSqlite();
    sqlite
      .prepare("update scenario_runs set current_moment = ?, event_triggered = 0 where id = ?")
      .run("13:30", DEFAULT_RUN_ID);
    sqlite.prepare("delete from audit_events where action = 'sharedEventReached'").run();

    expect(requireScenarioState().eventTriggered).toBe(false);

    const advanced = setMoment(SHARED_EVENT_MOMENT, { runId: DEFAULT_RUN_ID, roleId: "tprm" });
    expect(advanced.eventTriggered).toBe(true);
    expect(advanced.currentMoment).toBe(SHARED_EVENT_MOMENT);

    const audit = sqlite
      .prepare("select count(*) as n from audit_events where action = 'sharedEventReached'")
      .get() as { n: number };
    expect(audit.n).toBe(1);

    // A second crossing must not write a second audit event.
    setMoment("15:00", { runId: DEFAULT_RUN_ID, roleId: "tprm" });
    const again = sqlite
      .prepare("select count(*) as n from audit_events where action = 'sharedEventReached'")
      .get() as { n: number };
    expect(again.n).toBe(1);
  });

  it("makes the shared event unread for every function once it lands", () => {
    const sqlite = getSqlite();
    /*
     * The clock is wound back first and the read state reseeded second. The
     * order matters: the seed anchors read state to the run's current moment,
     * so reseeding while the run still said 15:00 would mark the 14:05 events
     * read and the arrival would be invisible.
     */
    sqlite
      .prepare("update scenario_runs set current_moment = ?, event_triggered = 0 where id = ?")
      .run("13:30", DEFAULT_RUN_ID);
    seedLiveEvents(DEFAULT_RUN_ID);

    const before = getUnreadCountsByRole("13:30");
    for (const roleId of ROLE_IDS) expect(before[roleId]).toBe(0);

    setMoment(SHARED_EVENT_MOMENT, { runId: DEFAULT_RUN_ID, roleId: "tprm" });

    const after = getUnreadCountsByRole(SHARED_EVENT_MOMENT);
    for (const roleId of ROLE_IDS) {
      expect(after[roleId], `${roleId} did not see 14:05 arrive`).toBeGreaterThan(0);
    }
  });

  it("does not rewind live time when the player steps back", () => {
    const state = requireScenarioState();
    const events = getLiveEventsForRole(state.activeRoleId);
    const stops = buildMomentStops(events, state.activeRoleId, getLiveEventMoments());

    const snapshot = getPlayerSnapshot(state.currentMoment);
    savePlayerSnapshot({ ...snapshot, viewedMoment: state.currentMoment });

    const back = reducePlayer(
      { ...snapshot, viewedMoment: state.currentMoment },
      { kind: "previous" },
      stops,
    );
    expect(back.advanceLiveTo).toBeNull();

    savePlayerSnapshot(back.next);
    // The action layer never writes the run row for a backwards step, so live
    // time is unchanged. Re-reading proves the run row was not touched.
    expect(requireScenarioState().currentMoment).toBe(state.currentMoment);
    expect(getPlayerSnapshot(state.currentMoment).viewedMoment).toBe(back.next.viewedMoment);
  });

  it("does not un-record a decision when time moves backwards", () => {
    const sqlite = getSqlite();
    const before = sqlite.prepare("select count(*) as n from audit_events").get() as { n: number };
    setMoment("08:10", { runId: DEFAULT_RUN_ID, roleId: "tprm" });
    const after = sqlite.prepare("select count(*) as n from audit_events").get() as { n: number };
    // Time is a view; decisions and audit events are facts. Nothing is removed.
    expect(after.n).toBeGreaterThanOrEqual(before.n);
    expect(requireScenarioState().eventTriggered).toBe(true);
  });
});

/* ==========================================================================
   The player singleton
   ========================================================================== */

describe("the persisted player", () => {
  it("is created by the seed, paused, at the run's current moment", () => {
    const sqlite = getSqlite();
    sqlite
      .prepare("update scenario_runs set current_moment = ? where id = ?")
      .run("10:30", DEFAULT_RUN_ID);
    seedLiveEvents(DEFAULT_RUN_ID);

    expect(rowCount("live_player_state")).toBe(1);
    const snapshot = getPlayerSnapshot("10:30");
    expect(snapshot.playing).toBe(false);
    expect(snapshot.viewedMoment).toBe("10:30");
    expect(snapshot.speed).toBe(1);
  });

  it("clamps a viewed moment that is ahead of live time", () => {
    const snapshot = getPlayerSnapshot("10:30");
    savePlayerSnapshot({ ...snapshot, viewedMoment: "16:30" });
    // A row left behind by an earlier run must not make the interface show a
    // moment the day has not reached.
    expect(getPlayerSnapshot("10:30").viewedMoment).toBe("10:30");
  });

  it("round trips speed, pause reason and the catch-up position", () => {
    const snapshot = getPlayerSnapshot("10:30");
    savePlayerSnapshot({
      ...snapshot,
      speed: 2,
      playing: true,
      pausedByDecisionId: "DEC-2026-0759",
      pausedReason: "A decision is yours to take.",
      catchUpActive: true,
      catchUpIndex: 4,
    });

    const reread = getPlayerSnapshot("10:30");
    expect(reread.speed).toBe(2);
    expect(reread.playing).toBe(true);
    expect(reread.pausedByDecisionId).toBe("DEC-2026-0759");
    expect(reread.pausedReason).toBe("A decision is yours to take.");
    expect(reread.catchUpActive).toBe(true);
    expect(reread.catchUpIndex).toBe(4);
  });
});
