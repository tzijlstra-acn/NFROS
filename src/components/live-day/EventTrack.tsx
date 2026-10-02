"use client";

/**
 * The compact event track.
 *
 * A row of markers positioned by scenario time, one marker per moment, not a
 * slider. The distinction matters: a slider implies a continuous value the user
 * can land anywhere on, and the day is ten discrete moments plus whatever the
 * integration runtime adds. A marker per moment says what the day actually is.
 *
 * Every marker is a button. That is what makes the track keyboard reachable
 * without inventing a custom widget role, and it is why each one carries an
 * accessible name that reads the moment, the count and the leading event:
 * "14:05, 4 events, 3 unread. Shared supplier and payments event." A row of
 * unlabelled dots is a row of nothing to a screen reader.
 *
 * One state per marker, not several. The stylesheet orders its marker rules
 * unread, decision, shared, current, past, so later rules win, which is the
 * reverse of the priority the interface wants. Rather than fight the cascade,
 * each marker resolves to exactly one state and sets exactly one attribute.
 */

import { useMemo } from "react";
import { LIVE_DAY_LABELS } from "@/scenario/engine/live-player";
import {
  LIVE_EVENT_TYPE_LABELS,
  momentMinutes,
  pick,
  type WorkdayLiveEvent,
} from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export interface EventTrackProps {
  /** Every moment the day stops at, in order. */
  moments: string[];
  events: WorkdayLiveEvent[];
  viewedMoment: string;
  liveMoment: string;
  language: Language;
  /** Scrubs the player to this moment. Moments after live time are disabled. */
  onSelectMoment: (moment: string) => void;
  disabled?: boolean;
}

type MarkerState = "current" | "shared" | "decision" | "unread" | "past" | "future";

interface Marker {
  moment: string;
  /** Zero to one across the day, for the left offset. */
  position: number;
  state: MarkerState;
  label: string;
  reachable: boolean;
}

function resolveState(params: {
  moment: string;
  viewedMoment: string;
  liveMoment: string;
  events: WorkdayLiveEvent[];
}): MarkerState {
  const minutes = momentMinutes(params.moment);
  if (params.moment === params.viewedMoment) return "current";

  const arrived = minutes <= momentMinutes(params.liveMoment);
  if (!arrived) return "future";

  const unread = params.events.filter((event) => event.readAt === null);
  if (unread.some((event) => event.type === "shared-event")) return "shared";
  if (unread.some((event) => event.requiresDecision)) return "decision";
  if (unread.length > 0) return "unread";
  return "past";
}

export function EventTrack({
  moments,
  events,
  viewedMoment,
  liveMoment,
  language,
  onSelectMoment,
  disabled = false,
}: EventTrackProps) {
  const markers = useMemo<Marker[]>(() => {
    if (moments.length === 0) return [];

    const firstMoment = moments[0] ?? viewedMoment;
    const lastMoment = moments[moments.length - 1] ?? viewedMoment;
    const start = momentMinutes(firstMoment);
    const span = Math.max(momentMinutes(lastMoment) - start, 1);

    const byMoment = new Map<string, WorkdayLiveEvent[]>();
    for (const event of events) {
      const list = byMoment.get(event.atMoment);
      if (list) list.push(event);
      else byMoment.set(event.atMoment, [event]);
    }

    return moments.map((moment) => {
      const atMoment = byMoment.get(moment) ?? [];
      const unread = atMoment.filter((event) => event.readAt === null).length;
      const leading = [...atMoment].sort((a, b) => a.sortOrder - b.sortOrder)[0];

      const countWord =
        atMoment.length === 1
          ? pick(LIVE_DAY_LABELS.oneEvent, language)
          : pick(LIVE_DAY_LABELS.events, language);
      const unreadPart =
        unread > 0 ? `, ${unread} ${pick(LIVE_DAY_LABELS.unread, language)}` : "";
      const typePart = leading
        ? `. ${pick(LIVE_EVENT_TYPE_LABELS[leading.type], language)}: ${leading.title}`
        : "";

      return {
        moment,
        position: (momentMinutes(moment) - start) / span,
        state: resolveState({ moment, viewedMoment, liveMoment, events: atMoment }),
        label: `${moment}, ${atMoment.length} ${countWord}${unreadPart}${typePart}`,
        // Moments the day has not reached are present on the track so the shape
        // of the day is legible, but they are not selectable: scrubbing forward
        // past live time would show a moment that has not happened.
        reachable: momentMinutes(moment) <= momentMinutes(liveMoment),
      };
    });
  }, [moments, events, viewedMoment, liveMoment, language]);

  const progress = useMemo(() => {
    const current = markers.find((marker) => marker.moment === viewedMoment);
    return current ? current.position : 0;
  }, [markers, viewedMoment]);

  return (
    <div
      className="app-track"
      role="group"
      aria-label={pick(LIVE_DAY_LABELS.eventTrack, language)}
    >
      <div className="app-track-line" aria-hidden="true" />
      <div
        className="app-track-progress"
        style={{ width: `${(progress * 100).toFixed(2)}%` }}
        aria-hidden="true"
      />

      {markers.map((marker) => (
        <button
          key={marker.moment}
          type="button"
          className="app-track-marker"
          style={{ left: `${(marker.position * 100).toFixed(2)}%` }}
          aria-label={marker.label}
          aria-current={marker.state === "current" ? "true" : undefined}
          title={marker.label}
          disabled={disabled || !marker.reachable}
          onClick={() => onSelectMoment(marker.moment)}
          {...(marker.state === "current" ? { "data-current": "true" } : {})}
          {...(marker.state === "shared" ? { "data-shared": "true" } : {})}
          {...(marker.state === "decision" ? { "data-decision": "true" } : {})}
          {...(marker.state === "unread" ? { "data-unread": "true" } : {})}
          {...(marker.state === "past" ? { "data-past": "true" } : {})}
        />
      ))}
    </div>
  );
}
