/**
 * ConnectionState: source failure display with fallback and retry affordance.
 *
 * Handles two distinct cases:
 *
 * 1. OPTIONAL SOURCE FAILURE: a helpful or optional source is unavailable.
 *    The deterministic work continues normally. A notice explains the gap.
 *    The user can retry the failed connection.
 *
 * 2. MANDATORY SOURCE UNAVAILABLE: a required source cannot be reached.
 *    Work continues in constrained mode on available sources. Nothing is
 *    fabricated. A read-only fallback notice is shown. Any action the user
 *    tries to take is queued for execution when the source reconnects.
 *
 * In both cases: deterministic content already loaded is shown. No content
 * is hidden because a source is down. The user is given the last-updated
 * timestamp when available, so they can judge staleness themselves.
 *
 * Server safe: no internal state. The caller supplies onRetry and
 * onQueueAction callbacks, which come from client-side state management.
 */

import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import {
  CONNECTION_LABELS,
  STALE_LABELS,
  pickLabel,
} from "@/components/loading/labels";
import type { Language } from "@/i18n/labels";

export function ConnectionState({
  sourceSystem,
  mandatory,
  lastUpdated,
  queuedActionCount = 0,
  onRetry,
  language = "en",
}: {
  /** The name of the source system that is unavailable. */
  sourceSystem: string;
  /** True when this source is required for the current work object. */
  mandatory: boolean;
  /**
   * ISO timestamp of the last successful data load, or null if never loaded.
   * Shown to help the user judge staleness.
   */
  lastUpdated: string | null;
  /**
   * Number of actions currently queued for this source.
   * When > 0, the queued-execution notice is shown.
   */
  queuedActionCount?: number;
  /**
   * Called when the user activates the retry control.
   * If undefined, the retry button is omitted (e.g. for an automatic retry).
   */
  onRetry?: () => void;
  language?: Language;
}) {
  const tone = mandatory ? "danger" : "warning";

  return (
    <div className="app-stack-3">
      {/*
       * Primary notice. Tone is danger for mandatory (the work cannot proceed
       * fully) and warning for optional (the work continues with a gap).
       * Colour is never the only signal: the text names the source explicitly.
       */}
      <div className="app-notice" data-tone={tone}>
        <IconAlertTriangle
          size={13}
          stroke={2}
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: 1 }}
        />
        <span>
          {sourceSystem}
          {": "}
          {mandatory
            ? pickLabel(CONNECTION_LABELS.mandatorySourceUnavailable, language)
            : pickLabel(CONNECTION_LABELS.sourceUnavailable, language)}
        </span>
      </div>

      {/* Last-updated timestamp when available. */}
      {lastUpdated !== null ? (
        <span className="app-meta">
          {pickLabel(CONNECTION_LABELS.lastUpdated, language)}
          {": "}
          {lastUpdated}
        </span>
      ) : null}

      {/*
       * Mandatory-source-specific notices. Shown only when a required source
       * is down so the user understands what constrained mode means.
       */}
      {mandatory ? (
        <>
          <div className="app-notice">
            <span>{pickLabel(CONNECTION_LABELS.constrainedView, language)}</span>
          </div>
          <div className="app-notice">
            <span>{pickLabel(CONNECTION_LABELS.readOnlyFallback, language)}</span>
          </div>
        </>
      ) : null}

      {/* Queued-action notice when the user has already triggered actions. */}
      {queuedActionCount > 0 ? (
        <div className="app-notice" data-tone="info">
          <span>
            {queuedActionCount}{" "}
            {pickLabel(CONNECTION_LABELS.queuedForExecution, language)}
          </span>
        </div>
      ) : null}

      {/* Stale data continuation warning for mandatory-down case. */}
      {mandatory ? (
        <div className="app-notice" data-tone="warning">
          <span>{pickLabel(STALE_LABELS.staleWarning, language)}</span>
        </div>
      ) : null}

      {/* Retry affordance. Omitted when the caller handles retry automatically. */}
      {onRetry !== undefined ? (
        <button
          type="button"
          className="app-btn app-btn-secondary app-btn-sm"
          onClick={onRetry}
        >
          <IconRefresh size={13} stroke={2} aria-hidden="true" />
          {pickLabel(CONNECTION_LABELS.retry, language)}
        </button>
      ) : null}
    </div>
  );
}
