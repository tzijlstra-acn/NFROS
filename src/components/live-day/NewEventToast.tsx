"use client";

/**
 * Heads-up cards for new arrivals. Never a modal.
 *
 * This is the component the brief is most specific about, and the specificity
 * is earned: a modal on every arrival would make the product unusable in the
 * exact situation it claims to improve, which is a professional working while
 * the day happens around them. So these cards add themselves to the track,
 * increment the unread count, and let the user carry on. Nothing here takes
 * focus and nothing here blocks a click behind it; the stack has
 * `pointer-events: none` and only the cards inside it are interactive.
 *
 * At most three are shown. A fourth would start to cover the work, so the rest
 * collapse into a count that the catch-up walk picks up. Critical arrivals get
 * a stronger left edge from the stylesheet and a word in the eyebrow, and that
 * is the whole of the escalation: still a quiet card, still dismissible, still
 * out of the way.
 *
 * Announcement is the Announcer primitive's job, driven from the bar, because
 * one live region per region of the interface is correct and six cards each
 * announcing themselves is not.
 */

import { IconX } from "@tabler/icons-react";
import { LIVE_DAY_LABELS } from "@/scenario/engine/live-player";
import {
  LIVE_EVENT_TYPE_LABELS,
  SEVERITY_TONE,
  momentAge,
  pick,
  type WorkdayLiveEvent,
} from "@/workday/contracts";
import { Chip, Data } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";

/** Three cards, then a count. More than three starts to cover the work. */
const VISIBLE_LIMIT = 3;

export interface NewEventToastProps {
  arrivals: WorkdayLiveEvent[];
  liveMoment: string;
  language: Language;
  /** Opens the event. The shell decides what that means for each object type. */
  onOpen: (event: WorkdayLiveEvent) => void;
  onDismiss: (eventId: string) => void;
  onReviewRest: () => void;
}

export function NewEventToast({
  arrivals,
  liveMoment,
  language,
  onOpen,
  onDismiss,
  onReviewRest,
}: NewEventToastProps) {
  if (arrivals.length === 0) return null;

  const shown = arrivals.slice(0, VISIBLE_LIMIT);
  const hidden = arrivals.length - shown.length;

  return (
    <div className="app-headsup-stack">
      {shown.map((event) => (
        <div key={event.id} className="app-headsup" data-severity={event.severity}>
          <div className="app-row app-between">
            <span className="app-eyebrow">
              {pick(LIVE_EVENT_TYPE_LABELS[event.type], language)}
              {event.severity === "critical" || event.severity === "high" ? (
                <>
                  {" "}
                  <Chip tone={SEVERITY_TONE[event.severity]}>{event.severity}</Chip>
                </>
              ) : null}
            </span>
            <span className="app-row">
              <Data title={event.atMoment}>
                {momentAge(event.atMoment, liveMoment, language)}
              </Data>
              <button
                type="button"
                className="app-icon-btn"
                onClick={() => onDismiss(event.id)}
                aria-label={`${pick(LIVE_DAY_LABELS.dismiss, language)}: ${event.title}`}
              >
                <IconX size={13} stroke={2} aria-hidden="true" />
              </button>
            </span>
          </div>

          <button
            type="button"
            className="app-item-title app-truncate"
            style={{
              border: 0,
              background: "transparent",
              font: "inherit",
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              color: "inherit",
            }}
            onClick={() => onOpen(event)}
          >
            {event.title}
          </button>

          <span className="app-meta app-clamp-2">{event.summary}</span>

          {event.type === "shared-event" ? (
            <span className="app-faint">{pick(LIVE_DAY_LABELS.sharedEvent, language)}</span>
          ) : null}

          {event.requiresDecision ? (
            <span className="app-tone-warning">
              {pick(LIVE_DAY_LABELS.decisionRequired, language)}
            </span>
          ) : null}
        </div>
      ))}

      {hidden > 0 ? (
        <button type="button" className="app-headsup" onClick={onReviewRest}>
          <span className="app-meta">
            {hidden} {pick(LIVE_DAY_LABELS.moreEvents, language)}
          </span>
        </button>
      ) : null}
    </div>
  );
}
