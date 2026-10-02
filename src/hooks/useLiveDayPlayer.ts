"use client";

/**
 * Owns play state, speed, the advance timer and the auto-pause handling.
 *
 * The transitions themselves are not here. They live in the pure reducer in
 * `src/scenario/engine/live-player.ts` and run on the server, because the
 * server owns live time and the audit trail and a client that decided when the
 * day advanced would be a client that could skip the 14:05 audit event. This
 * hook is the timer and the optimistic view, nothing more.
 *
 * Three failure modes it exists to prevent.
 *
 * A timer that outlives the component. The interval is cleared on unmount and
 * whenever play stops, so navigating away mid-playback does not leave a
 * server action firing every three seconds against a page nobody is looking at.
 *
 * A day that runs on in a hidden tab. Advancing while the tab is in the
 * background means the presenter comes back to a day that has silently reached
 * the evening. Playback suspends on `visibilitychange` and resumes when the tab
 * does, without losing the play intent.
 *
 * Overlapping steps. A step is a server round trip. Without the in-flight
 * guard a slow action at double speed would queue steps and the day would lurch
 * forward several moments at once, skipping the auto-pause that should have
 * stopped it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isPlayerSpeed,
  stepIntervalMs,
  type LivePlayerView,
  type PlayerSpeed,
} from "@/scenario/engine/live-player";
import type { WorkdayStreamEvent } from "@/workday/contracts";

/** What the hook needs from the server action module. */
export interface LiveDayPlayerActions {
  advance: () => Promise<LiveDayPlayerResult>;
  play: () => Promise<LiveDayPlayerResult>;
  pause: () => Promise<LiveDayPlayerResult>;
  previous: () => Promise<LiveDayPlayerResult>;
  next: () => Promise<LiveDayPlayerResult>;
  jumpToLive: () => Promise<LiveDayPlayerResult>;
  setSpeed: (speed: number) => Promise<LiveDayPlayerResult>;
  scrubTo: (moment: string) => Promise<LiveDayPlayerResult>;
}

export interface LiveDayPlayerResult {
  player: LivePlayerView;
  unreadCount: number;
  stream: WorkdayStreamEvent[];
  pausedAtEventId: string | null;
}

export interface UseLiveDayPlayerOptions {
  initial: LivePlayerView;
  actions: LiveDayPlayerActions;
  /** Receives the payloads every action produced, for the local transport. */
  onResult?: (result: LiveDayPlayerResult) => void;
  /** Called once each time the player stops itself at a material decision. */
  onAutoPause?: (eventId: string, decisionId: string | null) => void;
  /** Set false while a guided catch-up walk is open. */
  enabled?: boolean;
}

export interface LiveDayPlayer {
  player: LivePlayerView;
  /** True while a step is in flight, for disabling the controls. */
  busy: boolean;
  /** True when playback is suspended because the tab is hidden. */
  suspended: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  previous: () => void;
  next: () => void;
  jumpToLive: () => void;
  setSpeed: (speed: PlayerSpeed) => void;
  scrubTo: (moment: string) => void;
  /** Replaces the view after an out-of-band change, such as a role switch. */
  adopt: (player: LivePlayerView) => void;
}

export function useLiveDayPlayer(options: UseLiveDayPlayerOptions): LiveDayPlayer {
  const enabled = options.enabled ?? true;
  const [player, setPlayer] = useState<LivePlayerView>(options.initial);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsRef = useRef(options.actions);
  actionsRef.current = options.actions;
  const onResultRef = useRef(options.onResult);
  onResultRef.current = options.onResult;
  const onAutoPauseRef = useRef(options.onAutoPause);
  onAutoPauseRef.current = options.onAutoPause;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dispatch = useCallback(
    async (run: () => Promise<LiveDayPlayerResult>): Promise<void> => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const result = await run();
        setPlayer(result.player);
        onResultRef.current?.(result);
        if (result.pausedAtEventId !== null) {
          onAutoPauseRef.current?.(result.pausedAtEventId, result.player.pausedByDecisionId);
        }
      } catch {
        /*
         * A failed step stops playback rather than retrying. A player that
         * retried against a database mid-reseed would hammer it, and a
         * presenter would rather press play again than watch the day stutter.
         */
        setPlayer((current) => ({ ...current, playing: false }));
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [],
  );

  /* ---- the advance timer ---- */

  useEffect(() => {
    clearTimer();
    if (!enabled || !player.playing || player.atDayEnd || hidden) return;

    const delay = stepIntervalMs(player.speed);
    /*
     * setTimeout re-armed after each completed step rather than setInterval.
     * An interval would keep firing while a step was still in flight and the
     * in-flight guard would quietly swallow those ticks, so the real cadence
     * would drift below the chosen speed.
     */
    timer.current = setTimeout(() => {
      void dispatch(() => actionsRef.current.advance());
    }, delay);

    return clearTimer;
  }, [
    enabled,
    player.playing,
    player.speed,
    player.atDayEnd,
    player.viewedMoment,
    hidden,
    dispatch,
    clearTimer,
  ]);

  /* ---- tab visibility ---- */

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setHidden(document.visibilityState === "hidden");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  /* ---- unmount ---- */

  useEffect(() => clearTimer, [clearTimer]);

  const play = useCallback(() => void dispatch(() => actionsRef.current.play()), [dispatch]);
  const pause = useCallback(() => void dispatch(() => actionsRef.current.pause()), [dispatch]);
  const toggle = useCallback(() => {
    if (player.playing) pause();
    else play();
  }, [player.playing, play, pause]);

  const previous = useCallback(
    () => void dispatch(() => actionsRef.current.previous()),
    [dispatch],
  );
  const next = useCallback(() => void dispatch(() => actionsRef.current.next()), [dispatch]);
  const jumpToLive = useCallback(
    () => void dispatch(() => actionsRef.current.jumpToLive()),
    [dispatch],
  );

  const setSpeed = useCallback(
    (speed: PlayerSpeed) => {
      // Guarded here as well as on the server. The server is authoritative, but
      // an unsupported speed from a stale client should not leave the browser.
      if (!isPlayerSpeed(speed)) return;
      void dispatch(() => actionsRef.current.setSpeed(speed));
    },
    [dispatch],
  );

  const scrubTo = useCallback(
    (moment: string) => void dispatch(() => actionsRef.current.scrubTo(moment)),
    [dispatch],
  );

  const adopt = useCallback((next_: LivePlayerView) => setPlayer(next_), []);

  return {
    player,
    busy,
    suspended: hidden && player.playing,
    toggle,
    play,
    pause,
    previous,
    next,
    jumpToLive,
    setSpeed,
    scrubTo,
    adopt,
  };
}
