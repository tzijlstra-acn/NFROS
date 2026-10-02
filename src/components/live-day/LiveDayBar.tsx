"use client";

/**
 * The live day bar: the bottom row of the shell, 50px, the signature control.
 *
 * It owns the event channel, the player timer and the catch-up walk, and it
 * calls the server actions directly. The shell gives it one server rendered
 * snapshot and renders it in the third grid row; everything after that happens
 * here. That split exists so the shell does not have to carry the player's
 * state, and so a role switch is nothing more than a new snapshot.
 *
 * The clock is the part worth reading carefully. When viewed time equals live
 * time there is one number and the word Live. When the user has scrubbed back
 * there are two, "Viewing 10:30" leading and "Live at 14:05" following, with
 * `data-behind` on the clock so the stylesheet can colour the lead. Two
 * separate facts, shown as two numbers, because a single number that silently
 * meant different things at different times would be the dishonest option.
 *
 * Keyboard: Space, Left, Right, C, L. Bound on the document and guarded by
 * `isTypingTarget`, which is exported from the interactive primitives for
 * exactly this reason and must not be reimplemented here. A presenter typing a
 * question into the chat composer must not pause the day with every word.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPlayerTrackNext } from "@tabler/icons-react";
import { Announcer, isTypingTarget } from "@/components/workday-v2/interactive";
import { Data } from "@/components/workday-v2/primitives";
import { CatchUpButton } from "./CatchUpButton";
import { EventTrack } from "./EventTrack";
import { GuidedCatchUp } from "./GuidedCatchUp";
import { NewEventToast } from "./NewEventToast";
import { PlayPauseButton } from "./PlayPauseButton";
import { useLiveDayPlayer, type LiveDayPlayerResult } from "@/hooks/useLiveDayPlayer";
import {
  useScenarioEventStream,
  type EventTransport,
} from "@/hooks/useScenarioEventStream";
import {
  LIVE_DAY_LABELS,
  isPlayerSpeed,
  type LivePlayerView,
} from "@/scenario/engine/live-player";
import {
  actionAdvance,
  actionCatchUpNext,
  actionEndCatchUp,
  actionJumpToLive,
  actionMarkEventRead,
  actionPause,
  actionPlay,
  actionScrubToMoment,
  actionSetSpeed,
  actionStartCatchUp,
  actionStepNext,
  actionStepPrevious,
  type CatchUpState,
} from "@/scenario/live-actions";
import {
  LIVE_EVENT_TYPE_LABELS,
  momentMinutes,
  pick,
  type WorkdayLiveEvent,
  type WorkdayStreamEvent,
} from "@/workday/contracts";
import type { RoleId } from "@/db/schema/core";
import type { Language } from "@/i18n/labels";

export interface LiveDayBarProps {
  roleId: RoleId;
  language: Language;
  /** Server rendered starting state, from `actionLiveDaySnapshot`. */
  player: LivePlayerView;
  events: WorkdayLiveEvent[];
  /** Every moment the track draws a marker for, in order. */
  dayMoments: string[];
  unreadCount: number;
  /** "local" for presenter safe and offline mode. Default "stream". */
  transport?: EventTransport;
  /** Brings the affected area of the workspace forward. Owned by the shell. */
  onOpenEvent?: (event: WorkdayLiveEvent) => void;
  /** Forwards payloads the live day does not consume, for the other agents. */
  onStreamEvent?: (payload: WorkdayStreamEvent) => void;
}

export function LiveDayBar({
  roleId,
  language,
  player: initialPlayer,
  events: initialEvents,
  dayMoments,
  unreadCount: initialUnread,
  transport = "stream",
  onOpenEvent,
  onStreamEvent,
}: LiveDayBarProps) {
  const [announcement, setAnnouncement] = useState("");
  const [assertive, setAssertive] = useState(false);
  const [catchUp, setCatchUp] = useState<CatchUpState | null>(null);
  const [catchUpBusy, setCatchUpBusy] = useState(false);

  const stream = useScenarioEventStream({
    roleId,
    language,
    transport,
    initialEvents,
    initialLiveMoment: initialPlayer.liveMoment,
    initialUnreadCount: initialUnread,
    onStreamEvent: (payload) => {
      onStreamEvent?.(payload);
      if (payload.kind !== "scenario.event.arrived") return;

      const event = payload.event;
      const typeLabel = pick(LIVE_EVENT_TYPE_LABELS[event.type], language);
      setAnnouncement(
        `${event.atMoment}. ${typeLabel} ${pick(LIVE_DAY_LABELS.arrived, language)}. ${event.title}`,
      );
      /*
       * Assertive only for a critical arrival that needs a decision, which in
       * this day is the 14:05 event and the decisions that follow it. Focus is
       * never moved either way: interrupting a reader is a cost, and for a
       * routine message it buys nothing.
       */
      setAssertive(event.severity === "critical" && event.requiresDecision);
    },
  });

  const onResult = useCallback(
    (result: LiveDayPlayerResult) => {
      // The same payloads the channel would have sent. In "local" transport
      // this is the only source, which is how presenter safe and offline mode
      // share the live mode contract rather than imitating it.
      if (transport === "local") stream.publishAll(result.stream);
    },
    [transport, stream],
  );

  const onAutoPause = useCallback(
    (eventId: string) => {
      const event = stream.events.find((candidate) => candidate.id === eventId);
      setAnnouncement(
        event
          ? `${pick(LIVE_DAY_LABELS.paused, language)}. ${event.title}`
          : pick(LIVE_DAY_LABELS.stoppedAtDecision, language),
      );
      setAssertive(true);
    },
    [stream.events, language],
  );

  const control = useLiveDayPlayer({
    initial: initialPlayer,
    enabled: catchUp?.active !== true,
    onResult,
    onAutoPause,
    actions: useMemo(
      () => ({
        advance: actionAdvance,
        play: actionPlay,
        pause: () => actionPause(""),
        previous: actionStepPrevious,
        next: actionStepNext,
        jumpToLive: actionJumpToLive,
        setSpeed: actionSetSpeed,
        scrubTo: actionScrubToMoment,
      }),
      [],
    ),
  });

  /* ---- a role switch replaces the snapshot ---- */

  /*
   * Keyed on the snapshot's content, not on the role alone.
   *
   * Keying on the role meant a snapshot arriving from the server after a
   * `router.refresh()` was ignored, and the control a presenter uses most
   * produces exactly that: jumping the day from the demo menu moved the run's
   * live moment, re-rendered the server tree and handed this component a new
   * snapshot, which it discarded. The top bar read "07:45 live 14:05" while
   * this bar still read "07:45 Live" with one reachable marker of ten, and
   * only a full page load reconciled them. Two clocks disagreeing on one
   * screen, in the default mode.
   *
   * The signature is the live moment, the viewed moment and the unread count,
   * which is every field a clock change alters. Read state is still not reset:
   * it lives in the database keyed by event and role and arrives with the new
   * snapshot.
   */
  const snapshotSignature = `${roleId}|${initialPlayer.liveMoment}|${initialPlayer.viewedMoment}|${initialUnread}|${initialEvents.length}`;

  useEffect(() => {
    control.adopt(initialPlayer);
    stream.replaceEvents(initialEvents, initialUnread);
    setCatchUp(null);
    // The signature stands in for the snapshot, which is a new object on every
    // server render and would otherwise re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotSignature]);

  /* ---- catch up ---- */

  const openCatchUp = useCallback(async () => {
    setCatchUpBusy(true);
    try {
      const state = await actionStartCatchUp();
      setCatchUp(state);
      control.adopt(state.player);
    } finally {
      setCatchUpBusy(false);
    }
  }, [control]);

  const advanceCatchUp = useCallback(
    async (reviewedEventId: string) => {
      setCatchUpBusy(true);
      try {
        stream.markReadLocally(reviewedEventId);
        const state = await actionCatchUpNext(reviewedEventId);
        setCatchUp(state);
        control.adopt(state.player);
        if (!state.active || state.total === 0) {
          setAnnouncement(pick(LIVE_DAY_LABELS.caughtUp, language));
          setAssertive(false);
        }
      } finally {
        setCatchUpBusy(false);
      }
    },
    [control, stream, language],
  );

  const closeCatchUp = useCallback(async () => {
    const state = await actionEndCatchUp();
    setCatchUp(state);
    control.adopt(state.player);
  }, [control]);

  /* ---- opening an event ---- */

  const openEvent = useCallback(
    (event: WorkdayLiveEvent) => {
      stream.markReadLocally(event.id);
      void actionMarkEventRead(event.id);
      onOpenEvent?.(event);
    },
    [stream, onOpenEvent],
  );

  /* ---- keyboard ---- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // The guard first, and from the shared helper. Reimplementing it here is
      // how the chat composer ends up pausing the day on every space.
      if (isTypingTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      let handled = true;
      switch (event.key) {
        case " ":
        case "Spacebar":
          control.toggle();
          break;
        case "ArrowLeft":
          control.previous();
          break;
        case "ArrowRight":
          control.next();
          break;
        case "c":
        case "C":
          if (stream.unreadCount > 0) void openCatchUp();
          break;
        case "l":
        case "L":
          control.jumpToLive();
          break;
        default:
          handled = false;
      }

      if (handled) event.preventDefault();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [control, openCatchUp, stream.unreadCount]);

  /* ---- render ---- */

  const view = control.player;
  const behind = momentMinutes(view.viewedMoment) < momentMinutes(stream.liveMoment);
  const speedLabel = pick(
    view.speed === 2 ? LIVE_DAY_LABELS.speedDouble : LIVE_DAY_LABELS.speedNormal,
    language,
  );
  const speedToken = view.speed === 2 ? "2x" : "1x"; // copy-check-ignore: a playback speed multiplier, not a measured figure

  return (
    <>
      <div className="app-liveday">
        <PlayPauseButton
          playing={view.playing}
          disabled={control.busy || view.atDayEnd}
          language={language}
          onToggle={control.toggle}
        />

        <button
          type="button"
          className="app-icon-btn"
          onClick={control.previous}
          disabled={control.busy}
          aria-label={pick(LIVE_DAY_LABELS.previousEvent, language)}
          title={`${pick(LIVE_DAY_LABELS.previousEvent, language)} (Left)`}
        >
          <IconChevronLeft size={15} stroke={2} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="app-icon-btn"
          onClick={control.next}
          disabled={control.busy || view.atDayEnd}
          aria-label={pick(LIVE_DAY_LABELS.nextEvent, language)}
          title={`${pick(LIVE_DAY_LABELS.nextEvent, language)} (Right)`}
        >
          <IconChevronRight size={15} stroke={2} aria-hidden="true" />
        </button>

        <div className="app-liveday-clock" data-behind={behind ? "true" : "false"}>
          {behind ? (
            <>
              <span className="app-liveday-now">
                {pick(LIVE_DAY_LABELS.viewing, language)} {view.viewedMoment}
              </span>
              <span className="app-liveday-live">
                {pick(LIVE_DAY_LABELS.liveAt, language)} {stream.liveMoment}
              </span>
            </>
          ) : (
            <>
              <span className="app-liveday-now">{view.viewedMoment}</span>
              <span className="app-liveday-live">{pick(LIVE_DAY_LABELS.live, language)}</span>
            </>
          )}
        </div>

        <EventTrack
          moments={dayMoments}
          events={stream.events}
          viewedMoment={view.viewedMoment}
          liveMoment={stream.liveMoment}
          language={language}
          disabled={control.busy}
          onSelectMoment={control.scrubTo}
        />

        <button
          type="button"
          className="app-btn app-btn-quiet app-btn-sm"
          onClick={() => control.setSpeed(view.speed === 1 ? 2 : 1)}
          disabled={control.busy || !isPlayerSpeed(view.speed)}
          aria-label={`${pick(LIVE_DAY_LABELS.speed, language)}: ${speedLabel}`}
          title={speedLabel}
        >
          <Data>{speedToken}</Data>
        </button>

        <span className="app-faint app-shrink-0">
          {stream.unreadCount > 0
            ? `${stream.unreadCount} ${pick(LIVE_DAY_LABELS.unread, language)}`
            : pick(LIVE_DAY_LABELS.noUnread, language)}
        </span>

        <CatchUpButton
          unreadCount={stream.unreadCount}
          language={language}
          disabled={catchUpBusy}
          onCatchUp={() => void openCatchUp()}
        />

        {behind ? (
          <button
            type="button"
            className="app-btn app-btn-secondary app-btn-sm"
            onClick={control.jumpToLive}
            disabled={control.busy}
            title={`${pick(LIVE_DAY_LABELS.jumpToLive, language)} (L)`}
          >
            <IconPlayerTrackNext size={13} stroke={2} aria-hidden="true" />
            {pick(LIVE_DAY_LABELS.jumpToLive, language)}
          </button>
        ) : null}
      </div>

      <NewEventToast
        arrivals={stream.arrivals}
        liveMoment={stream.liveMoment}
        language={language}
        onOpen={openEvent}
        onDismiss={stream.dismissArrival}
        onReviewRest={() => void openCatchUp()}
      />

      <GuidedCatchUp
        open={catchUp?.active === true}
        queue={catchUp?.queue ?? []}
        index={catchUp?.index ?? 0}
        language={language}
        busy={catchUpBusy}
        onNext={(eventId) => void advanceCatchUp(eventId)}
        onClose={() => void closeCatchUp()}
        onFocusArea={openEvent}
      />

      <Announcer message={announcement} assertive={assertive} />
    </>
  );
}
