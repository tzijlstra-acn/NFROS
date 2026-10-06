/**
 * SourceFreshness: the quiet line saying where the item's data came from.
 * The view is derived in `src/features/work/freshness.ts`; this only renders it.
 */

import type { SourceFreshnessView } from "@/features/work/model";

export function SourceFreshness({ freshness }: { freshness: SourceFreshnessView }) {
  return (
    <span className="wd-row" data-testid="source-freshness">
      <span className="wd-dot" data-tone={freshness.tone} aria-hidden="true" />
      <span className="wd-strong">{freshness.label}</span>
      <span>{freshness.detail}</span>
    </span>
  );
}
