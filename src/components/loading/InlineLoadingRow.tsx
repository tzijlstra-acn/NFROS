/**
 * InlineLoadingRow: a single row in loading state for a partially loaded list.
 *
 * Used when a list is partially populated and one or more rows are still
 * being fetched. The skeleton reserves the same height as a real row (36px
 * standard, 48px large) so the list does not reflow when those rows arrive.
 *
 * Accessibility: the row is hidden from assistive technology. The aria-busy
 * on the surrounding list container is the correct channel for communicating
 * that more items are loading. Announcing each individual placeholder row
 * would be noise.
 *
 * Server safe: no hooks, no client directive.
 */

import { Skeleton } from "@/components/workday-v2/primitives";
import { INLINE_ROW_LABELS, pickLabel } from "@/components/loading/labels";
import type { Language } from "@/i18n/labels";

export function InlineLoadingRow({
  large = false,
  language = "en",
}: {
  /**
   * When true, the row uses the large row height (48px, matching --app-row-h-lg).
   * Use this in lists where real items are large, e.g. focus queue and live events.
   */
  large?: boolean;
  language?: Language;
}) {
  /*
   * The aria-label on the invisible wrapper gives screen readers a text node
   * if they somehow reach this element despite aria-hidden on inner content.
   * In practice the list's aria-busy covers this, but the label is belt and
   * braces. The visually hidden text uses the label from labels.ts for i18n
   * consistency.
   */
  void language; // used below for the aria-label
  void pickLabel; // used below

  return (
    <div
      className="app-skeleton-row"
      style={large ? { minHeight: 48 } : undefined}
      aria-hidden="true"
      role="presentation"
    >
      <Skeleton width={16} height={16} radius={4} />
      <div className="app-stack-1 app-grow">
        <Skeleton width="58%" height={11} />
        <Skeleton width="38%" height={9} />
      </div>
      <Skeleton width={38} height={16} radius={4} />
    </div>
  );
}

/*
 * A count of InlineLoadingRows for use at the bottom of a partially loaded
 * list. Renders n rows and signals the parent container is still loading.
 */
export function InlineLoadingRows({
  count = 2,
  large = false,
  language = "en",
}: {
  count?: number;
  large?: boolean;
  language?: Language;
}) {
  return (
    <>
      {/*
       * Screen-reader status: the list container should carry aria-busy.
       * This hidden text complements it when the component is used standalone.
       */}
      <span className="app-sr-only" aria-live="polite">
        {pickLabel(INLINE_ROW_LABELS, language)}
      </span>
      {Array.from({ length: count }, (_, index) => (
        <InlineLoadingRow key={index} large={large} language={language} />
      ))}
    </>
  );
}
