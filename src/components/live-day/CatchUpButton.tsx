"use client";

/**
 * The catch-up call to action.
 *
 * Attention once, not continuously. The stylesheet puts a single
 * `app-attention-once` animation on `.app-catchup` and there is deliberately no
 * loop: a pill that pulses forever in the bottom bar is the kind of thing a
 * presenter ends up apologising for, and after ninety seconds it stops reading
 * as information and starts reading as a defect.
 *
 * Re-triggering is done by keying the element on the count. React unmounts the
 * old pill and mounts a new one, the animation plays once on the new element,
 * and the CSS stays a one-shot. Adding `animation-iteration-count` here would
 * have meant editing a stylesheet this agent does not own, to get a behaviour
 * the design does not want.
 */

import { IconBellRinging } from "@tabler/icons-react";
import { LIVE_DAY_LABELS, reviewNewLabel } from "@/scenario/engine/live-player";
import { pick } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export interface CatchUpButtonProps {
  unreadCount: number;
  language: Language;
  disabled?: boolean;
  onCatchUp: () => void;
}

export function CatchUpButton({
  unreadCount,
  language,
  disabled = false,
  onCatchUp,
}: CatchUpButtonProps) {
  if (unreadCount <= 0) return null;

  const label = reviewNewLabel(unreadCount, language);

  return (
    <button
      key={unreadCount}
      type="button"
      className="app-catchup"
      onClick={onCatchUp}
      disabled={disabled}
      title={`${pick(LIVE_DAY_LABELS.catchUp, language)} (C)`}
      data-live-day-control="catch-up"
    >
      <IconBellRinging size={13} stroke={2} aria-hidden="true" />
      {label}
    </button>
  );
}
