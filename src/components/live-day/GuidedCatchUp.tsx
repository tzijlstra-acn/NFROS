"use client";

/**
 * The guided catch-up walk.
 *
 * For each unread event, in the order the day produced them: what happened,
 * what was already completed automatically, and what decision if any is the
 * user's. Next moves on. At a material human decision the walk stops offering
 * Next and offers Open instead, because the point of the stop is that the
 * product will not carry the user past a judgment they have to make.
 *
 * Chronological, never by severity. The 15:00 decision only makes sense after
 * the 14:05 event that caused it, and a walk that led with the worst item would
 * describe a day that did not happen.
 *
 * Built on the `Drawer` primitive for the focus behaviour, not for the look.
 * Drawer traps Tab, closes on Escape and returns focus to whatever opened it,
 * which is what makes "completable with the keyboard alone" true rather than
 * aspirational. This is the one surface in the live day that is allowed to be
 * modal: the user asked to be walked through a backlog, and a walkthrough that
 * let the background keep moving would be a walkthrough of a moving target.
 * The heads-up cards, which arrive uninvited, are never modal.
 *
 * `onFocusArea` is how the affected part of the interface comes forward. The
 * shell owns navigation, so the walk asks rather than does.
 */

import { useEffect, useRef } from "react";
import { IconArrowRight, IconCheck } from "@tabler/icons-react";
import { Drawer } from "@/components/workday-v2/interactive";
import { Chip, Data, Empty, ObjectRef } from "@/components/workday-v2/primitives";
import { LIVE_DAY_LABELS } from "@/scenario/engine/live-player";
import {
  LIVE_EVENT_TYPE_LABELS,
  SEVERITY_TONE,
  pick,
  type WorkdayLiveEvent,
} from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export interface GuidedCatchUpProps {
  open: boolean;
  /** The unread events, in chronological order. */
  queue: WorkdayLiveEvent[];
  index: number;
  language: Language;
  busy?: boolean;
  onNext: (reviewedEventId: string) => void;
  onClose: () => void;
  /** Brings the affected area of the interface forward. */
  onFocusArea: (event: WorkdayLiveEvent) => void;
}

export function GuidedCatchUp({
  open,
  queue,
  index,
  language,
  busy = false,
  onNext,
  onClose,
  onFocusArea,
}: GuidedCatchUpProps) {
  const current = queue[index];
  const focusedRef = useRef<string | null>(null);

  /*
   * Focusing the affected area is a side effect of arriving at an item, not of
   * rendering it. Without the guard a parent re-render would re-navigate and
   * the workspace would jump under a user who was reading.
   */
  useEffect(() => {
    if (!open || !current) return;
    if (focusedRef.current === current.id) return;
    focusedRef.current = current.id;
    onFocusArea(current);
  }, [open, current, onFocusArea]);

  useEffect(() => {
    if (!open) focusedRef.current = null;
  }, [open]);

  const total = queue.length;
  const done = total === 0 || !current;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={pick(LIVE_DAY_LABELS.guidedCatchUp, language)}
      subtitle={
        done
          ? undefined
          : `${index + 1} ${pick(LIVE_DAY_LABELS.reviewOf, language)} ${total}`
      }
      footer={
        done ? (
          <button type="button" className="app-btn app-btn-primary app-btn-block" onClick={onClose}>
            <IconCheck size={14} stroke={2} aria-hidden="true" />
            {pick(LIVE_DAY_LABELS.finish, language)}
          </button>
        ) : (
          <div className="app-row">
            {current.autoPause ? (
              /*
               * At a material decision the primary action opens the decision
               * rather than skipping it. Next is still available, so the walk is
               * never a trap, but it is no longer the obvious thing to press.
               */
              <>
                <button
                  type="button"
                  className="app-btn app-btn-decide app-grow"
                  onClick={() => onFocusArea(current)}
                >
                  {pick(LIVE_DAY_LABELS.openItem, language)}
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-quiet"
                  onClick={() => onNext(current.id)}
                  disabled={busy}
                >
                  {pick(LIVE_DAY_LABELS.next, language)}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="app-btn app-btn-primary app-btn-block"
                onClick={() => onNext(current.id)}
                disabled={busy}
              >
                {pick(LIVE_DAY_LABELS.next, language)}
                <IconArrowRight size={14} stroke={2} aria-hidden="true" />
              </button>
            )}
          </div>
        )
      }
    >
      {done ? (
        <Empty
          title={pick(LIVE_DAY_LABELS.caughtUp, language)}
          detail={pick(LIVE_DAY_LABELS.caughtUpDetail, language)}
        />
      ) : (
        <div className="app-stack-4">
          <div className="app-row">
            <Data title={current.atMoment}>{current.atMoment}</Data>
            <Chip tone="neutral">{pick(LIVE_EVENT_TYPE_LABELS[current.type], language)}</Chip>
            <Chip tone={SEVERITY_TONE[current.severity]}>{current.severity}</Chip>
          </div>

          <div className="app-stack-1">
            <span className="app-object-title">{current.title}</span>
            <span className="app-eyebrow">{pick(LIVE_DAY_LABELS.whatHappened, language)}</span>
            <p className="app-body">{current.summary}</p>
          </div>

          {current.evidenceIds.length > 0 ? (
            <div className="app-stack-1">
              <span className="app-eyebrow">{pick(LIVE_DAY_LABELS.alreadyDone, language)}</span>
              <span className="app-meta">
                {current.evidenceIds.length} {language === "de" ? "Nachweise" : "evidence documents"}
              </span>
              <div className="app-row-wrap">
                {current.evidenceIds.slice(0, 6).map((id) => (
                  <ObjectRef key={id} id={id} />
                ))}
              </div>
            </div>
          ) : null}

          {current.requiresDecision ? (
            <div className="app-notice app-tone-warning">
              <span className="app-strong">
                {pick(LIVE_DAY_LABELS.decisionRequired, language)}
              </span>
              {current.decisionId ? <ObjectRef id={current.decisionId} /> : null}
            </div>
          ) : null}

          {current.autoPause ? (
            <span className="app-faint">
              {pick(LIVE_DAY_LABELS.stoppedAtDecision, language)}
            </span>
          ) : null}

          <div className="app-row">
            <span className="app-faint">{current.objectType}</span>
            <ObjectRef id={current.objectId} />
          </div>
        </div>
      )}
    </Drawer>
  );
}
