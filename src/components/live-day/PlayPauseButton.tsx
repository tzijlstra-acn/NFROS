"use client";

/**
 * The play and pause control.
 *
 * `aria-pressed` plus a label that changes between Play and Pause, which is
 * the pair the acceptance criterion asks for. One without the other is not
 * enough: a toggle with a fixed label leaves a screen reader user guessing
 * which way the switch is set, and a label that changes without `aria-pressed`
 * loses the fact that it is a toggle at all.
 *
 * The icon is hidden from assistive technology because the accessible name
 * comes from the label. Announcing "play triangle, Pause" is worse than silence.
 */

import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { LIVE_DAY_LABELS } from "@/scenario/engine/live-player";
import { pick } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export interface PlayPauseButtonProps {
  playing: boolean;
  disabled?: boolean;
  language: Language;
  onToggle: () => void;
}

export function PlayPauseButton({
  playing,
  disabled = false,
  language,
  onToggle,
}: PlayPauseButtonProps) {
  const label = pick(playing ? LIVE_DAY_LABELS.pause : LIVE_DAY_LABELS.play, language);

  return (
    <button
      type="button"
      className="app-icon-btn"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={playing}
      aria-label={label}
      title={`${label} (Space)`}
      data-live-day-control="play-pause"
    >
      {playing ? (
        <IconPlayerPause size={15} stroke={2} aria-hidden="true" />
      ) : (
        <IconPlayerPlay size={15} stroke={2} aria-hidden="true" />
      )}
    </button>
  );
}
