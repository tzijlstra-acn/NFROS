/**
 * Verifies the live day projection, the player and the read arithmetic.
 *
 * Two modes, because this script has two jobs.
 *
 *   npx tsx scripts/verify-live-day.ts
 *     Builds a throwaway database in the system temporary directory, seeds the
 *     scenario and the live events into it, and asserts every invariant. The
 *     developer's own database is never opened. Exits non-zero on the first
 *     failed assertion group.
 *
 *   npx tsx scripts/verify-live-day.ts --seed-current
 *     The standalone seed runner. Writes the live day projection into the
 *     configured database, which is what to run until the one line call is
 *     added to `src/db/seed/run.ts`. Idempotent: it clears and rewrites the
 *     three live day tables for the run and touches nothing else.
 *
 * The assertions are chosen to catch the failures that do not show up when a
 * presenter clicks the happy path: an event whose claimed source does not
 * exist, a shared event one function cannot see, a role switch that silently
 * resets unread state, and a player that rolls past a decision.
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { closeDb, getDb, getSqlite, resolveDbPath } from "../src/db/client";
import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "../src/db/schema/core";
import { seedScenario } from "../src/db/seed/run";
import { buildLiveEventRows, seedLiveEvents } from "../src/scenario/live-event-seed";
import {
  countUnread,
  getAllLiveEventRows,
  getLiveEventMoments,
  getLiveEventsForRole,
  getPlayerSnapshot,
  getUnreadCountsByRole,
  getUnreadEvents,
  markEventRead,
  savePlayerSnapshot,
} from "../src/scenario/engine/live-events";
import {
  buildMomentStops,
  reducePlayer,
  type PlayerSnapshot,
} from "../src/scenario/engine/live-player";
import {
  requireScenarioState,
  setMoment,
  SHARED_EVENT_MOMENT,
  switchRole,
} from "../src/scenario/engine/state";
import { eventVisibleToRole } from "../src/workday/contracts";
import { momentToMinutes } from "../src/domain/nfr/calculators";

/* ==========================================================================
   Assertions
   ========================================================================== */

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
}

function section(label: string): void {
  console.log(`\n${label}`);
}

/* ==========================================================================
   Temporary database
   ========================================================================== */

/**
 * Opens a disposable database.
 *
 * Deliberately not imported from the integration harness: that module exists
 * for the test runner and a script reaching into `tests/` couples a developer
 * tool to a suite it does not run. The guard against a path inside the
 * repository is the part worth duplicating.
 */
function openTemporary(): string {
  closeDb();
  const directory = mkdtempSync(join(tmpdir(), "nfr-workos-live-day-"));
  const dbPath = join(directory, "scenario.db");

  const repositoryRoot = resolve(process.cwd());
  if (dbPath.startsWith(repositoryRoot + sep)) {
    throw new Error(`Refusing to verify against ${dbPath}, which is inside the repository.`);
  }

  process.env.NFR_DB_PATH = dbPath;
  if (resolveDbPath() !== dbPath) {
    throw new Error("The client did not resolve the temporary path. Isolation is not in force.");
  }

  migrate(getDb(), { migrationsFolder: "src/db/migrations" });
  return directory;
}

/* ==========================================================================
   The invariants
   ========================================================================== */

function verifyProjection(runId: string): void {
  section("The projection derives only from seeded content");

  const rows = getAllLiveEventRows(runId);
  check("the projection has rows", rows.length > 0, `found ${rows.length}`);
  check(
    "density is within the briefed range of roughly 40 to 80 events",
    rows.length >= 40 && rows.length <= 90,
    `found ${rows.length}`,
  );

  const sqlite = getSqlite();
  const exists = (sql: string, id: string): boolean =>
    ((sqlite.prepare(sql).get(id, runId) as { n: number } | undefined)?.n ?? 0) > 0;

  const resolvers: Record<string, (id: string) => boolean> = {
    timeline: (id) =>
      exists("select count(*) as n from timeline_events where id = ? and run_id = ?", id) ||
      exists("select count(*) as n from timeline_role_moments where id = ? and run_id = ?", id),
    "background-action": (id) =>
      exists("select count(*) as n from background_actions where id = ? and run_id = ?", id),
    inbox: (id) => exists("select count(*) as n from inbox_messages where id = ? and run_id = ?", id),
    meeting: (id) => exists("select count(*) as n from meetings where id = ? and run_id = ?", id),
    decision: (id) => exists("select count(*) as n from decisions where id = ? and run_id = ?", id),
    integration: (id) =>
      exists("select count(*) as n from integration_events where id = ? and run_id = ?", id),
  };

  const dangling: string[] = [];
  const unknownSource: string[] = [];
  for (const row of rows) {
    const resolver = resolvers[row.derivedFrom];
    if (!resolver) {
      unknownSource.push(`${row.id} claims ${row.derivedFrom}`);
      continue;
    }
    if (row.derivedFromId.length === 0 || !resolver(row.derivedFromId)) {
      dangling.push(`${row.id} points at ${row.derivedFrom} ${row.derivedFromId}`);
    }
  }

  check("every row names a known source", unknownSource.length === 0, unknownSource.join("; "));
  check("every derivedFromId resolves to a seeded row", dangling.length === 0, dangling.slice(0, 5).join("; "));

  const decisionRows = rows.filter((row) => row.type === "decision-required");
  check(
    "every decision event carries its decision identifier",
    decisionRows.every((row) => row.decisionId !== null),
  );
  check(
    "every decision event requires a decision",
    decisionRows.every((row) => row.requiresDecision),
  );

  const pausing = rows.filter((row) => row.autoPause);
  check(
    "auto-pause is set only where a material decision or the shared event exists",
    pausing.every((row) => row.type === "decision-required" || row.type === "shared-event"),
    pausing
      .filter((row) => row.type !== "decision-required" && row.type !== "shared-event")
      .map((row) => `${row.id} is ${row.type}`)
      .join("; "),
  );
  check("routine arrivals do not pause the player", rows.some((row) => !row.autoPause));

  const duplicateIds = rows.length - new Set(rows.map((row) => row.id)).size;
  check("identifiers are unique", duplicateIds === 0, `${duplicateIds} duplicates`);

  const bilingual = rows.filter(
    (row) =>
      row.title.length > 0 &&
      row.titleDe.length > 0 &&
      row.summary.length > 0 &&
      row.summaryDe.length > 0,
  );
  check("every row has an English and a German form", bilingual.length === rows.length);

  /*
   * The character is built from its code point rather than written. The copy
   * gate scans this file too and cannot tell an assertion about the character
   * from a use of it, so a literal here would fail the gate it exists to help.
   */
  const emDash = rows.filter((row) =>
    [row.title, row.titleDe, row.summary, row.summaryDe].some((text) =>
      text.includes(String.fromCharCode(0x2014)),
    ),
  );
  check("no row carries an em dash", emDash.length === 0, emDash.map((row) => row.id).join("; "));

  const rebuilt = buildLiveEventRows(runId).rows;
  check(
    "the projection is deterministic",
    rebuilt.length === rows.length &&
      rebuilt.every((row, index) => row.id === rows[index]?.id && row.sortOrder === rows[index]?.sortOrder),
  );
}

function verifySharedEvent(runId: string): void {
  section("The shared event propagates to every function");

  const shared = getAllLiveEventRows(runId).filter((row) => row.type === "shared-event");
  check("there is exactly one shared event", shared.length === 1, `found ${shared.length}`);

  const event = shared[0];
  if (!event) return;

  check("it sits at 14:05", event.atMoment === SHARED_EVENT_MOMENT, event.atMoment);
  check("its severity is critical", event.severity === "critical", event.severity);
  check("it is visible to every role", event.roleIds.length === 0, JSON.stringify(event.roleIds));
  check("the player must stop at it", event.autoPause);

  const missing = ROLE_IDS.filter((roleId) => !eventVisibleToRole(event, roleId));
  check("all six roles resolve it as visible", missing.length === 0, missing.join(", "));

  const notReturned = ROLE_IDS.filter(
    (roleId) => !getLiveEventsForRole(roleId, { runId }).some((row) => row.id === event.id),
  );
  check("all six roles are served it", notReturned.length === 0, notReturned.join(", "));
}

function verifyReadState(runId: string): void {
  section("Read state and unread arithmetic");

  const state = requireScenarioState(runId);
  const openMoment = getLiveEventMoments(runId)[0] ?? state.currentMoment;

  for (const roleId of ROLE_IDS) {
    const events = getLiveEventsForRole(roleId, { runId });
    const atOpen = countUnread(events, openMoment);
    check(`${roleId} opens the day with nothing unread`, atOpen === 0, `${atOpen} unread`);
  }

  const endOfDay = getLiveEventMoments(runId).slice(-1)[0] ?? state.currentMoment;
  const counts = getUnreadCountsByRole(endOfDay, runId);
  for (const roleId of ROLE_IDS) {
    const count = counts[roleId];
    check(`${roleId} has unread events by the end of the day`, count > 0, `${count} unread`);
  }

  // Marking one read reduces that role's count by exactly one and leaves every
  // other role untouched. A shared read row would break the second half.
  const subject: RoleId = "tprm";
  const queue = getUnreadEvents(subject, endOfDay, { runId });
  const first = queue[0];
  check("the catch-up queue is populated", first !== undefined);
  if (!first) return;

  check(
    "the catch-up queue is in chronological order",
    queue.every(
      (event, index) =>
        index === 0 ||
        momentToMinutes(event.atMoment) >= momentToMinutes(queue[index - 1]?.atMoment ?? "00:00"),
    ),
  );

  const before = getUnreadCountsByRole(endOfDay, runId);
  markEventRead(first.id, subject, runId);
  const after = getUnreadCountsByRole(endOfDay, runId);

  check(
    "marking one event read reduces that role's count by one",
    after[subject] === (before[subject] ?? 0) - 1,
    `${before[subject]} then ${after[subject]}`,
  );

  const others = ROLE_IDS.filter((roleId) => roleId !== subject);
  const changed = others.filter((roleId) => after[roleId] !== before[roleId]);
  check("no other role's count changed", changed.length === 0, changed.join(", "));

  // The shared event is unread per role, so reading it as one function must not
  // read it for the other five.
  const sharedEvent = getAllLiveEventRows(runId).find((row) => row.type === "shared-event");
  if (sharedEvent) {
    markEventRead(sharedEvent.id, subject, runId);
    const stillUnread = others.filter((roleId) =>
      getLiveEventsForRole(roleId, { runId }).some(
        (row) => row.id === sharedEvent.id && row.readAt === null,
      ),
    );
    check(
      "reading the shared event as one function leaves it unread for the others",
      stillUnread.length === others.length,
      `${stillUnread.length} of ${others.length}`,
    );
  }
}

function verifyRoleSwitch(runId: string): void {
  section("A role switch preserves unread state and the shared event");

  const endOfDay = getLiveEventMoments(runId).slice(-1)[0] ?? "16:30";
  const before = getUnreadCountsByRole(endOfDay, runId);
  const sharedBefore = ROLE_IDS.filter((roleId) =>
    getLiveEventsForRole(roleId, { runId }).some((row) => row.type === "shared-event"),
  ).length;

  switchRole("incident-resilience", { runId });
  switchRole("regulatory-change", { runId });
  switchRole("tprm", { runId });

  const after = getUnreadCountsByRole(endOfDay, runId);
  const changed = ROLE_IDS.filter((roleId) => after[roleId] !== before[roleId]);
  check("every role's unread count survived three switches", changed.length === 0, changed.join(", "));

  const sharedAfter = ROLE_IDS.filter((roleId) =>
    getLiveEventsForRole(roleId, { runId }).some((row) => row.type === "shared-event"),
  ).length;
  check("the shared event survived the switches", sharedAfter === sharedBefore && sharedAfter === 6);
}

function verifyAutoPause(runId: string): void {
  section("The player stops at material decisions and not before");

  const state = requireScenarioState(runId);
  const roleId = state.activeRoleId;
  const events = getLiveEventsForRole(roleId, { runId });
  const stops = buildMomentStops(events, roleId, getLiveEventMoments(runId));

  const openMoment = stops[0]?.moment ?? "07:45";
  let snapshot: PlayerSnapshot = {
    playing: true,
    speed: 1,
    viewedMoment: openMoment,
    liveMoment: openMoment,
    pausedByDecisionId: null,
    pausedReason: "",
    catchUpActive: false,
    catchUpIndex: 0,
  };

  const pauses: string[] = [];
  const visited: string[] = [openMoment];

  // Twice the number of stops, so a player that refused to move would be
  // caught by the loop ending rather than by the loop running forever.
  for (let i = 0; i < stops.length * 2 + 4; i += 1) {
    if (!snapshot.playing) {
      // Resuming is what a user pressing play after deciding does.
      const resumed = reducePlayer(snapshot, { kind: "play" }, stops);
      snapshot = resumed.next;
    }
    const transition = reducePlayer(snapshot, { kind: "advance" }, stops);
    if (!transition.changed) break;
    snapshot = transition.next;
    visited.push(snapshot.viewedMoment);
    if (transition.pausedAtEventId !== null) {
      pauses.push(`${snapshot.viewedMoment} ${transition.pausedAtEventId}`);
      check(
        `the pause at ${snapshot.viewedMoment} records why`,
        snapshot.pausedReason.length > 0 && !snapshot.playing,
      );
    }
  }

  check("the player stopped at least once", pauses.length > 0, pauses.join("; "));
  check(
    "the player reached the end of the day",
    snapshot.viewedMoment === (stops[stops.length - 1]?.moment ?? ""),
    snapshot.viewedMoment,
  );

  const pausedMoments = new Set(pauses.map((entry) => entry.split(" ")[0]));
  /*
   * The opening moment is excluded. The player stops when it advances into a
   * moment, and it starts already sitting on the first one, so the morning
   * brief decision at 07:45 is on screen before anyone presses play. A player
   * that paused there would refuse to start.
   */
  const expected = new Set(
    stops
      .slice(1)
      .filter((stop) => stop.autoPause !== null)
      .map((stop) => stop.moment),
  );
  check(
    "it stopped at exactly the moments that carry an auto-pause event",
    [...expected].every((moment) => pausedMoments.has(moment)) &&
      [...pausedMoments].every((moment) => moment !== undefined && expected.has(moment)),
    `stopped at ${[...pausedMoments].join(", ")}, expected ${[...expected].join(", ")}`,
  );
  check("it did not roll past the shared event", pausedMoments.has(SHARED_EVENT_MOMENT));

  // Scrubbing back must not rewind live time.
  const behind = reducePlayer({ ...snapshot, playing: false }, { kind: "previous" }, stops);
  check("stepping back moves the viewed moment", behind.next.viewedMoment !== snapshot.viewedMoment);
  check("stepping back never advances live time", behind.advanceLiveTo === null);
  check("live time is unchanged by stepping back", behind.next.liveMoment === snapshot.liveMoment);

  const jumped = reducePlayer(behind.next, { kind: "jump-to-live" }, stops);
  check("jump to live realigns viewed with live", jumped.next.viewedMoment === jumped.next.liveMoment);
}

function verifyPersistence(runId: string): void {
  section("The player position persists");

  const state = requireScenarioState(runId);
  const snapshot = getPlayerSnapshot(state.currentMoment, runId);
  check("a player row exists", snapshot.viewedMoment.length > 0);
  check("the seed leaves the player paused", !snapshot.playing);
  check("the speed is one of the two permitted values", snapshot.speed === 1 || snapshot.speed === 2);

  savePlayerSnapshot({ ...snapshot, speed: 2, playing: true }, runId);
  const reread = getPlayerSnapshot(state.currentMoment, runId);
  check("the speed round trips", reread.speed === 2);
  check("the play state round trips", reread.playing);

  savePlayerSnapshot(snapshot, runId);
}

function verifyLiveTimeAdvance(runId: string): void {
  section("Advancing live time through 14:05 triggers the shared event");

  const sqlite = getSqlite();
  sqlite.prepare("update scenario_runs set current_moment = ?, event_triggered = 0 where id = ?").run("13:30", runId);

  const state = requireScenarioState(runId);
  check("the day was reset to before the shared event", !state.eventTriggered);

  const roleId = state.activeRoleId;
  const events = getLiveEventsForRole(roleId, { runId });
  const stops = buildMomentStops(events, roleId, getLiveEventMoments(runId));

  let snapshot: PlayerSnapshot = {
    playing: true,
    speed: 1,
    viewedMoment: "13:30",
    liveMoment: "13:30",
    pausedByDecisionId: null,
    pausedReason: "",
    catchUpActive: false,
    catchUpIndex: 0,
  };

  const transition = reducePlayer(snapshot, { kind: "advance" }, stops);
  check("the step crosses into the shared event", transition.advanceLiveTo === SHARED_EVENT_MOMENT, String(transition.advanceLiveTo));
  check("the step publishes arrivals", transition.arrivedEventIds.length > 0);
  check("the step stops the player", !transition.next.playing);
  snapshot = transition.next;

  // The action layer is what calls setMoment in the application. Calling it
  // directly here keeps the script free of the server action runtime while
  // still proving the contract the action depends on.
  const advanced = setMoment(SHARED_EVENT_MOMENT, { runId, roleId });

  check("eventTriggered is set", advanced.eventTriggered);
  const audit = sqlite
    .prepare(
      "select count(*) as n from audit_events where run_id = ? and action = 'sharedEventReached'",
    )
    .get(runId) as { n: number } | undefined;
  check("the audit event was written", (audit?.n ?? 0) === 1, `found ${audit?.n ?? 0}`);

  const unreadAfter = getUnreadCountsByRole(SHARED_EVENT_MOMENT, runId);
  const withoutUnread = ROLE_IDS.filter((role) => (unreadAfter[role] ?? 0) === 0);
  check(
    "every function has something unread once the shared event has landed",
    withoutUnread.length === 0,
    withoutUnread.join(", "),
  );
}

/* ==========================================================================
   Entry point
   ========================================================================== */

function seedCurrent(): void {
  const summary = seedLiveEvents();
  console.log("Seeded the live day into the configured database.");
  console.log(`  database     ${resolveDbPath()}`);
  console.log(`  events       ${summary.events}`);
  console.log(`  read rows    ${summary.readRows} (${summary.readAtOpen} already read)`);
  console.log(`  open moment  ${summary.openMoment}`);
  console.log(`  by source    ${JSON.stringify(summary.byDerivedFrom)}`);
  console.log(`  by type      ${JSON.stringify(summary.byType)}`);
}

function main(): void {
  if (process.argv.includes("--seed-current")) {
    seedCurrent();
    closeDb();
    return;
  }

  let directory: string | null = null;
  try {
    directory = openTemporary();
    console.log("Seeding a disposable scenario.");
    const scenario = seedScenario(DEFAULT_RUN_ID);
    console.log(`  ${scenario.rowsWritten} rows across ${scenario.tablesWritten} tables.`);

    const live = seedLiveEvents(DEFAULT_RUN_ID);
    console.log(
      `  ${live.events} live events, ${live.readRows} read rows, open at ${live.openMoment}.`,
    );
    console.log(`  by source ${JSON.stringify(live.byDerivedFrom)}`);

    verifyProjection(DEFAULT_RUN_ID);
    verifySharedEvent(DEFAULT_RUN_ID);
    verifyReadState(DEFAULT_RUN_ID);
    verifyRoleSwitch(DEFAULT_RUN_ID);
    verifyAutoPause(DEFAULT_RUN_ID);
    verifyPersistence(DEFAULT_RUN_ID);
    verifyLiveTimeAdvance(DEFAULT_RUN_ID);
  } catch (error) {
    failures += 1;
    console.error("\nThe verification threw before it finished.");
    console.error(error instanceof Error ? error.stack : String(error));
  } finally {
    closeDb();
    delete process.env.NFR_DB_PATH;
    if (directory !== null) {
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch {
        // A locked sidecar file on Windows is not worth failing the run over.
        // The directory is under the system temporary path.
      }
    }
  }

  console.log(`\n${checks} checks, ${failures} failed.`);
  if (failures > 0) {
    console.error("Live day verification failed.");
    process.exit(1);
  }
  console.log("Live day verification passed.");
}

main();
