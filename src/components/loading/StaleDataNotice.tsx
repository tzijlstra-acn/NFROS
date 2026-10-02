/**
 * StaleDataNotice: stale-data acknowledgment component.
 *
 * Shown when a region is in the "stale" DataLoadState. Distinguishes stale
 * data from live data in text and tone (colour is never the only signal).
 * Lets the user continue with an explicit acknowledgment rather than silently
 * proceeding on data of unknown age.
 *
 * Two visual modes:
 *
 * 1. UNACKNOWLEDGED: shows the stale warning, the last-updated time and a
 *    "continue with this data" button. Use this when you want the user to
 *    actively confirm they understand the data may be out of date.
 *
 * 2. ACKNOWLEDGED: shows a compact stale indicator at xs size. Use this once
 *    the user has confirmed, so the warning does not persist in the primary
 *    reading area.
 *
 * The FRESHNESS_LABELS from contracts are used for the stale/live distinction
 * so labels match the source attribution row in SourceRow.
 *
 * Server safe: no internal state. The caller supplies acknowledged and
 * onContinue. This keeps the acknowledgment state in the route so it persists
 * across re-renders and is not lost on a parent unmount.
 */

import { IconAlertTriangle } from "@tabler/icons-react";
import { FRESHNESS_LABELS, pick } from "@/workday/contracts";
import {
  STALE_LABELS,
  pickLabel,
} from "@/components/loading/labels";
import type { Language } from "@/i18n/labels";

export function StaleDataNotice({
  lastUpdated,
  acknowledged = false,
  onContinue,
  language = "en",
}: {
  /**
   * ISO timestamp of the last successful data load.
   * Shown to help the user decide whether to continue.
   */
  lastUpdated: string | null;
  /**
   * Whether the user has acknowledged the stale data and chosen to continue.
   * When true, the full notice is replaced by a compact inline indicator.
   */
  acknowledged?: boolean;
  /**
   * Called when the user activates the "continue" button.
   * Required when acknowledged is false.
   */
  onContinue?: () => void;
  language?: Language;
}) {
  if (acknowledged) {
    /*
     * Compact stale indicator. Shows that the region is using last-known data
     * without dominating the reading area. Uses the same freshness label as
     * the source attribution row for consistency.
     */
    return (
      <div className="app-notice">
        <span>
          {pick(FRESHNESS_LABELS.stale, language)}
          {lastUpdated !== null ? `: ${lastUpdated}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="app-stack-3">
      {/* Primary stale warning notice. */}
      <div className="app-notice" data-tone="warning">
        <IconAlertTriangle
          size={13}
          stroke={2}
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: 1 }}
        />
        <div className="app-stack-1">
          <span className="app-strong" style={{ fontSize: "var(--app-text-xs)" }}>
            {pickLabel(STALE_LABELS.showing, language)}
          </span>
          {lastUpdated !== null ? (
            <span className="app-meta">
              {lastUpdated}
            </span>
          ) : null}
          <span style={{ fontSize: "var(--app-text-xs)" }}>
            {pickLabel(STALE_LABELS.staleWarning, language)}
          </span>
        </div>
      </div>

      {/*
       * Explicit continuation button. The user must click to continue, which
       * records that they have seen and understood the stale-data warning.
       * Without this step the interface would silently proceed on possibly
       * outdated information, which is especially risky for the decisions lane.
       */}
      {onContinue !== undefined ? (
        <button
          type="button"
          className="app-btn app-btn-secondary app-btn-sm"
          onClick={onContinue}
        >
          {pickLabel(STALE_LABELS.continueWithStale, language)}
        </button>
      ) : null}
    </div>
  );
}
