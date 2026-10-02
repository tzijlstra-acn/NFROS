/**
 * The live day player state machine.
 *
 * Pure. No database handle, no React, no server import. Every transition is a
 * function of the current snapshot, the action and the ordered list of stops
 * on the day, which is what makes the auto-pause rule testable without a
 * seeded database behind it.
 *
 * Two distinctions carry most of the weight here.
 *
 * Viewed time versus live time. `liveMoment` is the scenario's own clock, held
 * on the run row. `viewedMoment` is the moment the user is looking at, held on
 * `live_player_state`. They are separate columns because the interface has to
 * be able to say "Viewing 10:30, live at 14:05" truthfully, and because
 * scrubbing back must not rewind the day or un-record a decision. So a
 * backwards step moves `viewedMoment` only and never reports a live advance,
 * and a forward step reports one only when it crosses past live time. The
 * failure mode this prevents is the one where a presenter scrubs back to show
 * how the morning looked and the 14:05 event un-happens.
 *
 * Arrival versus replay. Stepping forward through moments the day has already
 * passed is replay: nothing arrives, nothing should raise a heads-up card,
 * nothing becomes unread. Only a step that pushes live time forward publishes
 * arrivals. Without that split, catching up would re-announce every event the
 * user has just finished reading.
 */

import type { RoleId } from "@/db/schema/core";
import { eventVisibleToRole, momentMinutes, type WorkdayLiveEvent } from "@/workday/contracts";

/* ==========================================================================
   Speed
   ========================================================================== */

/**
 * The only two speeds.
 *
 * The brief rules out further speeds, and there is a behavioural reason as
 * well as a copy one: any faster and the heads-up cards overlap their own
 * dismissal and the day stops being readable, which defeats a player whose
 * purpose is to make the day feel alive.
 */
export const PLAYER_SPEEDS = [1, 2] as const;
export type PlayerSpeed = (typeof PLAYER_SPEEDS)[number];

export function isPlayerSpeed(value: unknown): value is PlayerSpeed {
  return value === 1 || value === 2;
}

/** Milliseconds of wall clock per scenario moment at normal speed. */
export const PLAYER_STEP_MS = 3400;

/** Wall clock interval for one step at the given speed. */
export function stepIntervalMs(speed: PlayerSpeed): number {
  return Math.round(PLAYER_STEP_MS / speed);
}

/* ==========================================================================
   The snapshot
   ========================================================================== */

export interface PlayerSnapshot {
  playing: boolean;
  speed: PlayerSpeed;
  /** The moment the user is looking at. */
  viewedMoment: string;
  /** The scenario's own clock, owned by the run row. */
  liveMoment: string;
  pausedByDecisionId: string | null;
  pausedReason: string;
  catchUpActive: boolean;
  catchUpIndex: number;
}

/** What the player can stop at, in order, for one acting role. */
export interface MomentStop {
  moment: string;
  /** Event identifiers at this moment, visible to the acting role, in order. */
  eventIds: string[];
  /**
   * The first event at this moment the player must not roll past. Null when
   * the moment carries only routine arrivals.
   */
  autoPause: { eventId: string; decisionId: string | null; reason: string } | null;
}

export type PlayerAction =
  | { kind: "play" }
  | { kind: "pause"; reason?: string }
  | { kind: "previous" }
  | { kind: "next" }
  /** The timer driven step. This is the only action that can pause itself. */
  | { kind: "advance" }
  | { kind: "jump-to-live" }
  | { kind: "scrub"; moment: string }
  | { kind: "set-speed"; speed: number }
  | { kind: "catch-up-start" }
  | { kind: "catch-up-next"; total: number }
  | { kind: "catch-up-end" };

export interface PlayerTransition {
  next: PlayerSnapshot;
  /** The new live moment when live time must move, otherwise null. */
  advanceLiveTo: string | null;
  /** Events that genuinely arrived, in order. Empty during replay. */
  arrivedEventIds: string[];
  /** The event the player stopped itself at, when it did. */
  pausedAtEventId: string | null;
  changed: boolean;
}

/* ==========================================================================
   Stops
   ========================================================================== */

/**
 * Builds the ordered stops for one role.
 *
 * `extraMoments` carries the ten seeded timeline moments, so a moment the role
 * happens to have no event at is still a stop. Dropping those would make the
 * Right arrow skip the structure of the day and would leave a gap in the track
 * that the progress bar could not account for.
 */
export function buildMomentStops(
  events: readonly WorkdayLiveEvent[],
  roleId: RoleId,
  extraMoments: readonly string[] = [],
): MomentStop[] {
  const visible = events.filter((event) => eventVisibleToRole(event, roleId));
  const byMoment = new Map<string, WorkdayLiveEvent[]>();

  for (const moment of extraMoments) {
    if (!byMoment.has(moment)) byMoment.set(moment, []);
  }
  for (const event of visible) {
    const list = byMoment.get(event.atMoment);
    if (list) list.push(event);
    else byMoment.set(event.atMoment, [event]);
  }

  return [...byMoment.entries()]
    .sort((a, b) => momentMinutes(a[0]) - momentMinutes(b[0]))
    .map(([moment, list]) => {
      const ordered = [...list].sort(compareWithinMoment);
      const pausing = ordered.find((event) => event.autoPause) ?? null;
      return {
        moment,
        eventIds: ordered.map((event) => event.id),
        autoPause: pausing
          ? { eventId: pausing.id, decisionId: pausing.decisionId, reason: pausing.title }
          : null,
      };
    });
}

/** Ordering inside one moment. `sortOrder` is assigned by the projection. */
function compareWithinMoment(a: WorkdayLiveEvent, b: WorkdayLiveEvent): number {
  return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

/**
 * The index of the stop a moment sits at or inside.
 *
 * A moment that is not itself a stop resolves to the last stop at or before
 * it, so an integration event another agent writes at 14:12 does not push the
 * player off the end of the list.
 */
export function stopIndexFor(stops: readonly MomentStop[], moment: string): number {
  const minutes = momentMinutes(moment);
  let index = -1;
  for (let i = 0; i < stops.length; i += 1) {
    const stop = stops[i];
    if (stop && momentMinutes(stop.moment) <= minutes) index = i;
    else break;
  }
  return index;
}

/* ==========================================================================
   The reducer
   ========================================================================== */

function unchanged(snapshot: PlayerSnapshot): PlayerTransition {
  return {
    next: snapshot,
    advanceLiveTo: null,
    arrivedEventIds: [],
    pausedAtEventId: null,
    changed: false,
  };
}

function settled(
  snapshot: PlayerSnapshot,
  patch: Partial<PlayerSnapshot>,
  extra: Partial<Omit<PlayerTransition, "next" | "changed">> = {},
): PlayerTransition {
  return {
    next: { ...snapshot, ...patch },
    advanceLiveTo: extra.advanceLiveTo ?? null,
    arrivedEventIds: extra.arrivedEventIds ?? [],
    pausedAtEventId: extra.pausedAtEventId ?? null,
    changed: true,
  };
}

/**
 * Steps forward one stop.
 *
 * `auto` is true for the timer driven step and false for a deliberate press of
 * Next. Only the automatic step stops itself at a material decision: a person
 * pressing Next has already seen the decision and asked to move on, and a
 * player that refused would read as broken rather than careful.
 */
function stepForward(
  snapshot: PlayerSnapshot,
  stops: readonly MomentStop[],
  auto: boolean,
): PlayerTransition {
  const fromIndex = stopIndexFor(stops, snapshot.viewedMoment);
  const target = stops[fromIndex + 1];
  if (!target) {
    // The end of the day. Stop playing rather than leaving a timer spinning
    // against a list it cannot move through.
    return snapshot.playing
      ? settled(snapshot, { playing: false, pausedReason: "" })
      : unchanged(snapshot);
  }

  const liveIndex = stopIndexFor(stops, snapshot.liveMoment);
  const crossesLive = fromIndex + 1 > liveIndex;

  const pause = target.autoPause;
  const shouldPause = auto && pause !== null;

  return settled(
    snapshot,
    {
      viewedMoment: target.moment,
      playing: shouldPause ? false : snapshot.playing,
      pausedByDecisionId: shouldPause ? (pause?.decisionId ?? null) : null,
      pausedReason: shouldPause ? (pause?.reason ?? "") : "",
    },
    {
      advanceLiveTo: crossesLive ? target.moment : null,
      arrivedEventIds: crossesLive ? target.eventIds : [],
      pausedAtEventId: shouldPause ? (pause?.eventId ?? null) : null,
    },
  );
}

/**
 * Applies one action.
 *
 * Returns the next snapshot plus what the caller must do about it: whether to
 * move live time through `setMoment`, which events arrived, and which event the
 * player stopped at. The caller performs the writes; this function performs no
 * effect at all, which is why the auto-pause rule can be tested exhaustively.
 */
export function reducePlayer(
  snapshot: PlayerSnapshot,
  action: PlayerAction,
  stops: readonly MomentStop[],
): PlayerTransition {
  switch (action.kind) {
    case "play": {
      // Playing clears a recorded pause. That is the "resume" half of "after
      // the user decides, dismisses or resumes, it continues": the next step
      // examines the following moment, so resuming cannot re-pause in place.
      if (snapshot.playing && snapshot.pausedByDecisionId === null && snapshot.pausedReason === "") {
        return unchanged(snapshot);
      }
      return settled(snapshot, { playing: true, pausedByDecisionId: null, pausedReason: "" });
    }

    case "pause": {
      if (!snapshot.playing && snapshot.pausedReason === (action.reason ?? "")) {
        return unchanged(snapshot);
      }
      return settled(snapshot, { playing: false, pausedReason: action.reason ?? "" });
    }

    case "previous": {
      const index = stopIndexFor(stops, snapshot.viewedMoment);
      const target = stops[index - 1];
      if (!target) return unchanged(snapshot);
      // Live time is deliberately untouched. Time is a view; the day is a fact.
      return settled(snapshot, {
        viewedMoment: target.moment,
        playing: false,
        pausedByDecisionId: null,
        pausedReason: "",
      });
    }

    case "next":
      return stepForward(snapshot, stops, false);

    case "advance":
      return stepForward(snapshot, stops, true);

    case "jump-to-live": {
      if (snapshot.viewedMoment === snapshot.liveMoment && !snapshot.catchUpActive) {
        return unchanged(snapshot);
      }
      return settled(snapshot, {
        viewedMoment: snapshot.liveMoment,
        pausedByDecisionId: null,
        pausedReason: "",
        catchUpActive: false,
        catchUpIndex: 0,
      });
    }

    case "scrub": {
      const index = stopIndexFor(stops, action.moment);
      const target = stops[index];
      if (!target || target.moment === snapshot.viewedMoment) return unchanged(snapshot);
      const liveIndex = stopIndexFor(stops, snapshot.liveMoment);
      // Scrubbing forward past live time is refused rather than clamped, so the
      // interface can never show a moment the day has not reached.
      if (index > liveIndex) return unchanged(snapshot);
      return settled(snapshot, {
        viewedMoment: target.moment,
        playing: false,
        pausedByDecisionId: null,
        pausedReason: "",
      });
    }

    case "set-speed": {
      if (!isPlayerSpeed(action.speed)) return unchanged(snapshot);
      if (action.speed === snapshot.speed) return unchanged(snapshot);
      return settled(snapshot, { speed: action.speed });
    }

    case "catch-up-start": {
      // Catching up pauses the day. Reviewing a backlog while more arrives
      // behind it is the exact confusion the catch-up walk exists to remove.
      return settled(snapshot, {
        catchUpActive: true,
        catchUpIndex: 0,
        playing: false,
        pausedReason: "",
      });
    }

    case "catch-up-next": {
      const nextIndex = snapshot.catchUpIndex + 1;
      if (nextIndex >= action.total) {
        return settled(snapshot, { catchUpActive: false, catchUpIndex: 0 });
      }
      return settled(snapshot, { catchUpIndex: nextIndex });
    }

    case "catch-up-end": {
      if (!snapshot.catchUpActive && snapshot.catchUpIndex === 0) return unchanged(snapshot);
      return settled(snapshot, { catchUpActive: false, catchUpIndex: 0 });
    }
  }
}

/* ==========================================================================
   Derived view
   ========================================================================== */

export interface LivePlayerView extends PlayerSnapshot {
  /** True when the user is looking at an earlier moment than the day has. */
  behind: boolean;
  /** True when there is no later stop to advance to. */
  atDayEnd: boolean;
  /** Zero to one, for the track progress bar. */
  progress: number;
}

export function toPlayerView(
  snapshot: PlayerSnapshot,
  stops: readonly MomentStop[],
): LivePlayerView {
  const index = stopIndexFor(stops, snapshot.viewedMoment);
  const span = Math.max(stops.length - 1, 1);
  return {
    ...snapshot,
    behind: momentMinutes(snapshot.viewedMoment) < momentMinutes(snapshot.liveMoment),
    atDayEnd: index >= stops.length - 1,
    progress: Math.min(1, Math.max(0, index / span)),
  };
}

/* ==========================================================================
   Keyboard
   ========================================================================== */

export type LiveDayShortcut = "play-pause" | "previous" | "next" | "catch-up" | "jump-to-live";

/**
 * The keyboard map, resolved without touching the DOM.
 *
 * `typing` is passed in rather than inspected here, because the authoritative
 * test for a text entry lives in the interactive primitives as `isTypingTarget`
 * and must not be duplicated. The guard itself is the point: Space is bound to
 * play and pause, and a presenter typing a question into the chat composer must
 * not pause the day with every word.
 */
export function resolveLiveDayShortcut(input: {
  key: string;
  typing: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): LiveDayShortcut | null {
  if (input.typing) return null;
  if (input.ctrlKey || input.metaKey || input.altKey) return null;

  switch (input.key) {
    case " ":
    case "Spacebar":
      return "play-pause";
    case "ArrowLeft":
      return "previous";
    case "ArrowRight":
      return "next";
    case "c":
    case "C":
      return "catch-up";
    case "l":
    case "L":
      return "jump-to-live";
    default:
      return null;
  }
}

/* ==========================================================================
   Copy
   ========================================================================== */

/**
 * Every user visible string the live day owns, in English and German.
 *
 * German is ASCII transliterated to match the rest of the codebase: "ae",
 * "oe", "ue" and "ss". See docs/ASSUMPTIONS.md for why.
 */
/*
 * Declared `as const` rather than as a Record, so every lookup is checked at
 * compile time. With `noUncheckedIndexedAccess` a Record index would be
 * possibly undefined at every call site and the components would be littered
 * with assertions that prove nothing.
 */
export const LIVE_DAY_LABELS = {
  play: { en: "Play", de: "Abspielen" },
  pause: { en: "Pause", de: "Anhalten" },
  playing: { en: "Playing", de: "Laeuft" },
  paused: { en: "Paused", de: "Angehalten" },
  previousEvent: { en: "Previous event", de: "Vorheriges Ereignis" },
  nextEvent: { en: "Next event", de: "Naechstes Ereignis" },
  viewing: { en: "Viewing", de: "Ansicht" },
  liveAt: { en: "Live at", de: "Live um" },
  live: { en: "Live", de: "Live" },
  jumpToLive: { en: "Jump to live", de: "Zu live springen" },
  eventTrack: { en: "Event track", de: "Ereignisleiste" },
  dayProgress: { en: "Day progress", de: "Tagesfortschritt" },
  unread: { en: "unread", de: "ungelesen" },
  noUnread: { en: "Nothing new", de: "Nichts Neues" },
  catchUp: { en: "Catch up", de: "Aufholen" },
  caughtUp: { en: "You are caught up", de: "Sie sind auf dem aktuellen Stand" },
  caughtUpDetail: {
    en: "Every event up to the live moment has been reviewed.",
    de: "Alle Ereignisse bis zum aktuellen Zeitpunkt wurden geprueft.",
  },
  guidedCatchUp: { en: "Guided catch up", de: "Gefuehrtes Aufholen" },
  whatHappened: { en: "What happened", de: "Was geschehen ist" },
  alreadyDone: { en: "Already completed automatically", de: "Automatisch bereits erledigt" },
  decisionRequired: { en: "Your decision is required", de: "Ihre Entscheidung ist erforderlich" },
  openItem: { en: "Open", de: "Oeffnen" },
  next: { en: "Next", de: "Weiter" },
  finish: { en: "Finish", de: "Beenden" },
  dismiss: { en: "Dismiss", de: "Ausblenden" },
  markRead: { en: "Mark as read", de: "Als gelesen markieren" },
  markAllRead: { en: "Mark all as read", de: "Alle als gelesen markieren" },
  stoppedAtDecision: {
    en: "Stopped here. A decision is yours to take.",
    de: "Hier angehalten. Eine Entscheidung liegt bei Ihnen.",
  },
  newEvents: { en: "New events", de: "Neue Ereignisse" },
  moreEvents: { en: "more", de: "weitere" },
  speed: { en: "Speed", de: "Geschwindigkeit" },
  speedNormal: { en: "Normal speed", de: "Normale Geschwindigkeit" },
  speedDouble: { en: "Double speed", de: "Doppelte Geschwindigkeit" },
  connecting: { en: "Connecting to the day", de: "Verbindung zum Tag" },
  connectionLost: { en: "Reconnecting", de: "Neuverbindung" },
  endOfDay: { en: "End of the day", de: "Ende des Tages" },
  events: { en: "events", de: "Ereignisse" },
  oneEvent: { en: "event", de: "Ereignis" },
  sharedEvent: { en: "Shared across every function", de: "Von jeder Funktion geteilt" },
  reviewOf: { en: "of", de: "von" },
  arrived: { en: "arrived", de: "eingegangen" },
} as const satisfies Record<string, { en: string; de: string }>;

/** "Review 3 new" and its German form, built from a count. */
export function reviewNewLabel(count: number, language: "en" | "de"): string {
  return language === "de" ? `${count} neue pruefen` : `Review ${count} new`;
}
