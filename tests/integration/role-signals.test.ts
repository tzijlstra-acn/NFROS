/**
 * The role signals read model, against the seeded day.
 *
 * The unit tests prove the rules. These prove the signals are the database:
 * every value the selector and the landing preview show is traced back to a
 * row, and changing or removing the row changes or empties the signal, with
 * no second list anywhere that could keep describing work that is gone.
 *
 * Runs against a temporary database. See `support/harness.ts` for how the
 * developer's own scenario file is kept out of reach.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { buildFocusQueueView } from "@/db/repositories/focus";
import { getCalendar } from "@/db/repositories/workday";
import { setMoment } from "@/scenario/engine/state";
import { readRoleSignalOverview, readRoleSignals } from "@/features/role-signals";
import { ROLE_RELEASE_DEFINITIONS } from "@/product/release";

const OPENING_MOMENT = "07:45";

beforeAll(() => {
  createTemporaryDatabase("role-signals");
});

afterAll(() => {
  destroyTemporaryDatabase();
});

/* ==========================================================================
   Before seeding
   ========================================================================== */

describe("before the scenario is seeded", () => {
  it("reports every signal as unavailable and says why", () => {
    const signals = readRoleSignals("rcsa");
    for (const signal of [signals.focus, signals.process, signals.meeting]) {
      expect(signal.state).toBe("unavailable");
      expect(signal.value).toContain("has not been seeded");
    }
  });

  it("still lists the registry's roles, because the registry is code", () => {
    const overview = readRoleSignalOverview();
    expect(overview.scenario).toBeNull();
    expect(overview.available.map((role) => role.release.roleId)).toEqual(["rcsa", "tprm"]);
    expect(overview.available.every((role) => role.signals.focus.state === "unavailable")).toBe(true);
  });
});

/* ==========================================================================
   The seeded day
   ========================================================================== */

describe("against the seeded day", () => {
  beforeAll(() => {
    seedScenario();
  });

  beforeEach(() => {
    // Each test starts from the seeded morning, because several of them
    // change rows on purpose.
    seedScenario();
  });

  it("takes the current focus from the queue's Now item, without re-ranking", () => {
    for (const roleId of ["rcsa", "tprm"] as const) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });
      const signals = readRoleSignals(roleId);
      expect(queue.now, `${roleId} has no Now item at ${OPENING_MOMENT}`).not.toBeNull();
      expect(signals.focus.state).toBe("present");
      expect(signals.focus.value).toBe(queue.now?.title);
      expect(signals.focus.href).toBe(queue.now?.href);
    }
  });

  it("reads the active process and stage from the persisted runs", () => {
    const rcsa = readRoleSignals("rcsa");
    expect(rcsa.process.value).toBe("RCSA Cycle Assistant, Stage 2 of 8");
    expect(rcsa.process.stageName).toBe("Evidence Refresh");
    expect(rcsa.process.stages.filter((stage) => stage.progress === "completed")).toHaveLength(1);

    const tprm = readRoleSignals("tprm");
    expect(tprm.process.value).toBe("Third-Party Onboarding, Stage 4 of 8");
    expect(tprm.process.stageName).toBe("Evidence Review");
    expect(tprm.process.stages.filter((stage) => stage.progress === "completed")).toHaveLength(3);
  });

  it("moves when the run's stage moves", () => {
    getSqlite()
      .prepare("update role_app_runs set current_stage_id = ? where role_id = ? and role_app_id = ?")
      .run("risk-control-change", "rcsa", "rcsa-cycle-assistant");
    expect(readRoleSignals("rcsa").process.value).toBe("RCSA Cycle Assistant, Stage 3 of 8");
  });

  it("says there is no active process when the run is gone", () => {
    getSqlite().prepare("delete from role_app_runs where role_id = ?").run("tprm");
    const signals = readRoleSignals("tprm");
    expect(signals.process.state).toBe("empty");
    expect(signals.process.value).toBe("No active process");
  });

  it("takes the next meeting from the calendar, with its time, skipping focus time", () => {
    for (const roleId of ["rcsa", "tprm"] as const) {
      const signals = readRoleSignals(roleId);
      const expected = getCalendar(roleId)
        .filter((row) => row.kind !== "focus-time")
        .filter((row) => row.startsAt.slice(11, 16) >= OPENING_MOMENT)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      expect(expected, `${roleId} has no meeting after ${OPENING_MOMENT} in the seed`).toBeDefined();
      expect(signals.meeting.state).toBe("present");
      expect(signals.meeting.value).toBe(expected?.title);
      expect(signals.meeting.time).toBe(expected?.startsAt.slice(11, 16));
    }
  });

  it("follows the scenario clock", () => {
    const before = readRoleSignals("rcsa").meeting;
    setMoment("16:30");
    const after = readRoleSignals("rcsa");
    expect(after.atMoment).toBe("16:30");
    expect(after.meeting.time).toBe("16:30");
    expect(after.meeting.value).not.toBe(before.value);
  });

  it("says no further meeting once the last one has started", () => {
    setMoment("16:30");
    const tprm = readRoleSignals("tprm");
    expect(tprm.meeting.state).toBe("empty");
    expect(tprm.meeting.value).toBe("No further meeting today");
  });

  it("says no meeting is scheduled when the calendar is empty, never a fallback", () => {
    getSqlite().prepare("delete from calendar_events where role_id = ?").run("rcsa");
    const signals = readRoleSignals("rcsa");
    expect(signals.meeting).toEqual({
      state: "empty",
      value: "No meeting scheduled today",
      time: null,
      href: null,
    });
  });

  it("renders in German when asked", () => {
    const signals = readRoleSignals("rcsa", { language: "de" });
    expect(signals.process.value).toBe("RCSA-Zyklus-Assistent, Stufe 2 von 8");
    const queue = buildFocusQueueView({ roleId: "rcsa", atMoment: OPENING_MOMENT, language: "de" });
    expect(signals.focus.value).toBe(queue.now?.title);
  });

  it("takes role status from the release registry and reads signals only for Available roles", () => {
    const overview = readRoleSignalOverview();
    const byStatus = (status: string) =>
      ROLE_RELEASE_DEFINITIONS.filter((role) => role.status === status).map((role) => role.roleId);

    expect(overview.scenario).toEqual({ date: "2026-10-06", moment: OPENING_MOMENT });
    expect(overview.available.map((role) => role.release.roleId)).toEqual(byStatus("available"));
    expect(overview.demo.map((role) => role.roleId)).toEqual(byStatus("demo"));
    expect(overview.planned.map((role) => role.roleId)).toEqual(byStatus("planned"));
    expect(overview.available.every((role) => role.signals.atMoment === OPENING_MOMENT)).toBe(true);
  });

  it("reads without writing", () => {
    const sqlite = getSqlite();
    const changesBefore = (sqlite.prepare("select total_changes() as n").get() as { n: number }).n;
    readRoleSignalOverview();
    readRoleSignalOverview({ language: "de" });
    const changesAfter = (sqlite.prepare("select total_changes() as n").get() as { n: number }).n;
    expect(changesAfter).toBe(changesBefore);
  });
});
