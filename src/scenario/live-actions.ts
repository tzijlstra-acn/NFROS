"use server";

/**
 * Server actions for the live day player.
 *
 * Every action here follows the same three steps: read the authoritative state
 * from the database, run the pure reducer in
 * `src/scenario/engine/live-player.ts`, then apply the result. The browser
 * never asserts the acting role, the live moment or the autonomy level, for
 * the same reason the agent route does not let the model assert them: a client
 * that claimed a different role must not be able to read another function's
 * unread events or move the day on its behalf.
 *
 * Each action returns a `LiveDayActionResult` carrying the new player view, the
 * new unread count and a list of `WorkdayStreamEvent` payloads. That list is
 * the reason presenter safe and offline mode can share the live mode contract:
 * the client feeds these into exactly the same reducer it feeds the server sent
 * events into, so only the origin of the payload differs.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import {
  getLiveEventsForRole,
  getLiveEventMoments,
  getPlayerSnapshot,
  getUnreadEvents,
  markAllEventsRead,
  markEventAcknowledged,
  markEventRead,
  markReviewedInCatchUp,
  savePlayerSnapshot,
  countUnread,
} from "@/scenario/engine/live-events";
import {
  buildMomentStops,
  reducePlayer,
  toPlayerView,
  type LivePlayerView,
  type PlayerAction,
  type PlayerTransition,
} from "@/scenario/engine/live-player";
import { requireScenarioState, setMoment } from "@/scenario/engine/state";
import { createLogger } from "@/server/logging/redact";
import type { Language } from "@/i18n/labels";
import type { WorkdayLiveEvent, WorkdayStreamEvent } from "@/workday/contracts";

const log = createLogger("live-day");

const momentSchema = z.string().regex(/^\d{2}:\d{2}$/, "A moment must be a 24 hour time label.");
const eventIdSchema = z.string().min(1).max(120);
const speedSchema = z.number().int();

export interface LiveDayActionResult {
  player: LivePlayerView;
  unreadCount: number;
  /** The same payloads the event channel publishes, for the offline transport. */
  stream: WorkdayStreamEvent[];
  /** The event the player stopped itself at, when it did. */
  pausedAtEventId: string | null;
}

/** Everything one action needs, read once so the reducer sees a single state. */
interface ActionContext {
  runId: string;
  roleId: RoleId;
  language: Language;
  liveMoment: string;
  events: WorkdayLiveEvent[];
  stops: ReturnType<typeof buildMomentStops>;
}

function loadContext(runId = DEFAULT_RUN_ID): ActionContext {
  const state = requireScenarioState(runId);
  const events = getLiveEventsForRole(state.activeRoleId, {
    runId,
    language: state.language,
  });
  /*
   * The ten seeded timeline moments are added as stops even where the acting
   * role has no event at one, so the Right arrow walks the structure of the
   * day rather than hopping over the quiet parts of it.
   */
  const stops = buildMomentStops(events, state.activeRoleId, getLiveEventMoments(runId));

  return {
    runId,
    roleId: state.activeRoleId,
    language: state.language,
    liveMoment: state.currentMoment,
    events,
    stops,
  };
}

/**
 * Applies a transition.
 *
 * Live time moves through `setMoment` and never through a direct write to
 * `scenario_runs`, because `setMoment` is what records the audit event when the
 * day crosses 14:05 and what sets `eventTriggered`. Writing the column here
 * would leave the shared event untriggered and the audit trail silent about the
 * most important moment of the day.
 */
function apply(context: ActionContext, transition: PlayerTransition): LiveDayActionResult {
  const stream: WorkdayStreamEvent[] = [];
  let liveMoment = context.liveMoment;

  if (transition.advanceLiveTo !== null) {
    const state = setMoment(transition.advanceLiveTo, {
      runId: context.runId,
      roleId: context.roleId,
    });
    liveMoment = state.currentMoment;
    stream.push({ kind: "scenario.time.changed", moment: liveMoment, live: true });
  }

  const snapshot = { ...transition.next, liveMoment };
  savePlayerSnapshot(snapshot, context.runId);

  if (transition.arrivedEventIds.length > 0) {
    const byId = new Map(context.events.map((event) => [event.id, event]));
    for (const id of transition.arrivedEventIds) {
      const event = byId.get(id);
      // Arriving events are unread by definition, whatever the stale read row
      // the projection was seeded with said.
      if (event) stream.push({ kind: "scenario.event.arrived", event: { ...event, readAt: null } });
    }
  }

  if (transition.pausedAtEventId !== null) {
    const event = context.events.find((candidate) => candidate.id === transition.pausedAtEventId);
    if (event?.decisionId) {
      stream.push({
        kind: "approval.required",
        roleId: context.roleId,
        decisionId: event.decisionId,
        suggestionId: null,
      });
    }
    log.info("The player stopped at a material decision.", {
      eventId: transition.pausedAtEventId,
      moment: snapshot.viewedMoment,
    });
  }

  // Re-read so the count reflects the write above rather than the state before.
  const events = getLiveEventsForRole(context.roleId, {
    runId: context.runId,
    language: context.language,
  });

  return {
    player: toPlayerView(snapshot, context.stops),
    unreadCount: countUnread(events, liveMoment),
    stream,
    pausedAtEventId: transition.pausedAtEventId,
  };
}

/**
 * Revalidates the server rendered workday.
 *
 * Only called when live time moved. The viewed moment and the read state are
 * rendered from the action result on the client, so revalidating on every step
 * would re-render the whole server tree several times per second during
 * playback for no visible gain.
 */
function revalidateForLiveTime(): void {
  revalidatePath("/workday", "layout");
  revalidatePath("/control-room");
}

function run(action: PlayerAction, runId = DEFAULT_RUN_ID): LiveDayActionResult {
  const context = loadContext(runId);
  const transition = reducePlayer(
    getPlayerSnapshot(context.liveMoment, runId),
    action,
    context.stops,
  );
  const result = apply(context, transition);
  if (transition.advanceLiveTo !== null) revalidateForLiveTime();
  return result;
}

/* ==========================================================================
   Player actions
   ========================================================================== */

/** The current state, with nothing changed. Used for the initial client render. */
export async function actionReadPlayer(): Promise<LiveDayActionResult> {
  const context = loadContext();
  const snapshot = getPlayerSnapshot(context.liveMoment);
  return {
    player: toPlayerView(snapshot, context.stops),
    unreadCount: countUnread(context.events, context.liveMoment),
    stream: [],
    pausedAtEventId: null,
  };
}

export async function actionPlay(): Promise<LiveDayActionResult> {
  return run({ kind: "play" });
}

export async function actionPause(reason?: string): Promise<LiveDayActionResult> {
  return run({ kind: "pause", reason: typeof reason === "string" ? reason.slice(0, 200) : "" });
}

export async function actionStepPrevious(): Promise<LiveDayActionResult> {
  return run({ kind: "previous" });
}

export async function actionStepNext(): Promise<LiveDayActionResult> {
  return run({ kind: "next" });
}

/**
 * One timer driven step.
 *
 * This is the only action that may stop itself at a material decision, which is
 * why the client calls it rather than `actionStepNext` while playing.
 */
export async function actionAdvance(): Promise<LiveDayActionResult> {
  return run({ kind: "advance" });
}

export async function actionJumpToLive(): Promise<LiveDayActionResult> {
  return run({ kind: "jump-to-live" });
}

export async function actionScrubToMoment(moment: string): Promise<LiveDayActionResult> {
  return run({ kind: "scrub", moment: momentSchema.parse(moment) });
}

/** Accepts 1 and 2 only. Any other value leaves the speed where it was. */
export async function actionSetSpeed(speed: number): Promise<LiveDayActionResult> {
  return run({ kind: "set-speed", speed: speedSchema.parse(speed) });
}

/* ==========================================================================
   Catch up
   ========================================================================== */

export interface CatchUpState {
  active: boolean;
  index: number;
  total: number;
  /** The unread events in chronological order. */
  queue: WorkdayLiveEvent[];
  /** True when the walk has reached a material human decision. */
  blocked: boolean;
  player: LivePlayerView;
}

function catchUpState(context: ActionContext, player: LivePlayerView): CatchUpState {
  const queue = getUnreadEvents(context.roleId, context.liveMoment, {
    runId: context.runId,
    language: context.language,
  });
  const current = queue[player.catchUpIndex] ?? null;
  return {
    active: player.catchUpActive,
    index: player.catchUpIndex,
    total: queue.length,
    queue,
    blocked: current?.autoPause === true,
    player,
  };
}

export async function actionStartCatchUp(): Promise<CatchUpState> {
  const context = loadContext();
  const transition = reducePlayer(
    getPlayerSnapshot(context.liveMoment),
    { kind: "catch-up-start" },
    context.stops,
  );
  const result = apply(context, transition);
  return catchUpState(context, result.player);
}

/**
 * Advances the walk by one, recording the event just reviewed as read.
 *
 * The read mark happens before the index moves, so a walk abandoned half way
 * through leaves the events the user actually saw marked read and the rest
 * unread. The alternative, marking the whole queue read on completion, loses
 * the work of a partial catch-up.
 */
export async function actionCatchUpNext(reviewedEventId?: string): Promise<CatchUpState> {
  const context = loadContext();
  if (typeof reviewedEventId === "string" && reviewedEventId.length > 0) {
    markReviewedInCatchUp(eventIdSchema.parse(reviewedEventId), context.roleId, context.runId);
  }

  const queue = getUnreadEvents(context.roleId, context.liveMoment, {
    runId: context.runId,
    language: context.language,
  });

  const transition = reducePlayer(
    getPlayerSnapshot(context.liveMoment),
    // The total is recomputed after the read mark, so the walk ends when the
    // queue empties rather than when a stale count says it should.
    { kind: "catch-up-next", total: Math.max(queue.length, 1) },
    context.stops,
  );
  const result = apply(context, transition);
  return catchUpState(context, result.player);
}

export async function actionEndCatchUp(): Promise<CatchUpState> {
  const context = loadContext();
  const transition = reducePlayer(
    getPlayerSnapshot(context.liveMoment),
    { kind: "catch-up-end" },
    context.stops,
  );
  const result = apply(context, transition);
  return catchUpState(context, result.player);
}

/* ==========================================================================
   Read state
   ========================================================================== */

export async function actionMarkEventRead(eventId: string): Promise<LiveDayActionResult> {
  const context = loadContext();
  markEventRead(eventIdSchema.parse(eventId), context.roleId, context.runId);
  return actionReadPlayer();
}

/** A stronger signal than read: the user has seen it and accepted it. */
export async function actionAcknowledgeEvent(eventId: string): Promise<LiveDayActionResult> {
  const context = loadContext();
  markEventAcknowledged(eventIdSchema.parse(eventId), context.roleId, context.runId);
  return actionReadPlayer();
}

export async function actionMarkAllEventsRead(): Promise<LiveDayActionResult> {
  const context = loadContext();
  const marked = markAllEventsRead(context.roleId, context.liveMoment, context.runId);
  log.info("Marked arrived events read.", { roleId: context.roleId, marked });
  return actionReadPlayer();
}

/* ==========================================================================
   Initial payload for the shell
   ========================================================================== */

export interface LiveDaySnapshot {
  roleId: RoleId;
  language: Language;
  player: LivePlayerView;
  events: WorkdayLiveEvent[];
  /** Every moment the track draws a marker for, in order. */
  dayMoments: string[];
  unreadCount: number;
}

/**
 * Everything the bar needs for its first render.
 *
 * Called from the server component that renders the shell, so the bar arrives
 * populated rather than empty with a skeleton over it. The event channel takes
 * over from there.
 */
export async function actionLiveDaySnapshot(): Promise<LiveDaySnapshot> {
  const context = loadContext();
  const snapshot = getPlayerSnapshot(context.liveMoment);
  return {
    roleId: context.roleId,
    language: context.language,
    player: toPlayerView(snapshot, context.stops),
    events: context.events,
    dayMoments: context.stops.map((stop) => stop.moment),
    unreadCount: countUnread(context.events, context.liveMoment),
  };
}
