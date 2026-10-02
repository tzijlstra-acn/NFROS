/**
 * DataSkeleton: region-aware loading skeleton component.
 *
 * Each variant reserves the exact dimensions of the real content it stands in
 * for. The stated requirement is that layout must not shift under a cursor
 * that is about to click when content populates. Skeletons achieve this by
 * matching the row heights and spacing of the live content they replace.
 *
 * Hidden entirely from assistive technology (aria-hidden="true" on all
 * skeleton blocks). Readiness is communicated through aria-busy on the
 * surrounding container and a text status elsewhere. Announcing empty rows
 * to a screen reader is noise; the readiness state is already described.
 *
 * Server safe: no hooks, no client directive. Can render in a server component
 * alongside the layout shell that wraps the busy containers.
 */

import { Skeleton, SkeletonRows } from "@/components/workday-v2/primitives";
import type { SkeletonVariant } from "@/components/loading/labels";

export type { SkeletonVariant };

export function DataSkeleton({
  variant,
  rows,
}: {
  variant: SkeletonVariant;
  /**
   * Override the default row count for this variant.
   * Useful when the caller knows the exact item count from a cached total.
   */
  rows?: number;
}) {
  switch (variant) {
    case "focus-queue":
      return <FocusQueueSkeleton rows={rows ?? 4} />;
    case "inbox":
      return <InboxSkeleton rows={rows ?? 5} />;
    case "calendar":
      return <CalendarSkeleton rows={rows ?? 4} />;
    case "work-object":
      return <WorkObjectSkeleton />;
    case "evidence":
      return <EvidenceSkeleton rows={rows ?? 4} />;
    case "live-events":
      return <LiveEventsSkeleton rows={rows ?? 4} />;
    case "ai-activity":
      return <AIActivitySkeleton rows={rows ?? 5} />;
    case "decisions":
      return <DecisionsSkeleton rows={rows ?? 2} />;
    case "execution-receipts":
      return <ExecutionReceiptsSkeleton rows={rows ?? 3} />;
  }
}

/*
 * Focus queue rows are large (48px, the --app-row-h-lg value) because each
 * item carries a leading severity indicator, a title, a reason clause and
 * a trailing AI status chip. The smaller row height would cause a visible
 * shift when real items populate, because the actual items are taller.
 */
function FocusQueueSkeleton({ rows }: { rows: number }) {
  return <SkeletonRows rows={rows} large />;
}

/*
 * Inbox rows sit at the standard 36px height. The trailing element is a
 * time string (narrower than a status chip), reflected in the 28px wide
 * trailing skeleton.
 */
function InboxSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="app-skeleton-row">
          <Skeleton width={16} height={16} radius={4} />
          <div className="app-stack-1 app-grow">
            <Skeleton width={`${68 - index * 5}%`} height={11} />
            <Skeleton width={`${42 - index * 3}%`} height={9} />
          </div>
          <Skeleton width={28} height={9} />
        </div>
      ))}
    </div>
  );
}

/*
 * Calendar slots reserve a 52px height per row, matching a compact time-slot
 * entry with a time label on the left and a title plus subtitle on the right.
 * Three or four slots cover the visible panel height without scroll.
 */
function CalendarSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--app-3)",
            minHeight: 52,
            padding: "var(--app-2) var(--app-3)",
          }}
        >
          <Skeleton width={32} height={9} />
          <div className="app-stack-1 app-grow" style={{ paddingTop: 2 }}>
            <Skeleton width={`${72 - index * 8}%`} height={11} radius={4} />
            <Skeleton width={`${48 - index * 5}%`} height={9} />
          </div>
        </div>
      ))}
    </div>
  );
}

/*
 * A work object skeleton has three visual zones: the workspace header
 * (eyebrow at 9px, title at 20px matching --app-text-2xl, and an object ref
 * at 9px), a properties grid at three columns, and a body text block.
 *
 * The title reserves 20px exactly: if it reserved less the heading would
 * shift when the real 20px title line appears.
 */
function WorkObjectSkeleton() {
  return (
    <div aria-hidden="true" className="app-stack-3">
      <div className="app-stack-1">
        <Skeleton width={90} height={9} />
        <Skeleton width="62%" height={20} />
        <Skeleton width={60} height={9} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "var(--app-3)",
        }}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="app-stack-1">
            <Skeleton width={50} height={9} />
            <Skeleton width="80%" height={11} />
          </div>
        ))}
      </div>
      <div className="app-stack-1">
        <Skeleton width="88%" height={11} />
        <Skeleton width="72%" height={11} />
        <Skeleton width="56%" height={11} />
      </div>
    </div>
  );
}

/*
 * Evidence rows reserve space for an evidence identifier chip (wider than a
 * status chip, because identifiers like EVD-2026-41905 are monospaced).
 */
function EvidenceSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="app-skeleton-row">
          <Skeleton width={16} height={16} radius={4} />
          <div className="app-stack-1 app-grow">
            <Skeleton width={`${66 - index * 6}%`} height={11} />
            <Skeleton width={`${38 - index * 3}%`} height={9} />
          </div>
          <Skeleton width={52} height={16} radius={4} />
        </div>
      ))}
    </div>
  );
}

/*
 * Live events are large rows (48px) because they carry a severity indicator,
 * a type chip, a title and a summary. The SkeletonRows large variant matches.
 */
function LiveEventsSkeleton({ rows }: { rows: number }) {
  return <SkeletonRows rows={rows} large />;
}

/*
 * Activity stream rows follow the .app-activity-row grid: 42px time column,
 * 14px glyph column, then the label. Minimum height is 24px to match.
 */
function AIActivitySkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            display: "grid",
            gridTemplateColumns: "42px 14px 1fr",
            gap: "var(--app-2)",
            alignItems: "baseline",
            padding: "var(--app-1) var(--app-3)",
            minHeight: 24,
          }}
        >
          <Skeleton width={28} height={9} />
          <Skeleton width={10} height={10} radius={5} />
          <Skeleton width={`${60 - index * 5}%`} height={9} />
        </div>
      ))}
    </div>
  );
}

/*
 * Decision skeletons reserve space for the action buttons at the bottom of
 * each card. Without this reservation the approve and reject buttons would
 * shift into view as the card populates, breaking the guarantee that primary
 * actions do not move after the user has positioned their cursor.
 *
 * Inline styles replicate the visual weight of .app-card without adding a
 * CSS class: the skeleton is not real content and must not compete with it.
 */
function DecisionsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true" className="app-stack-3">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderLeft: "2px solid var(--app-border-strong)",
            borderRadius: "var(--app-radius-lg)",
            padding: "var(--app-4)",
          }}
        >
          <div className="app-stack-3">
            <div className="app-stack-1">
              <Skeleton width={60} height={9} />
              <Skeleton width={`${72 - index * 8}%`} height={15} />
            </div>
            <Skeleton width="88%" height={9} />
            <Skeleton width="64%" height={9} />
            {/* Reserve button row: 30px matches .app-btn height. */}
            <div
              style={{ display: "flex", gap: "var(--app-2)", marginTop: "var(--app-1)" }}
            >
              <Skeleton width={80} height={30} radius={6} />
              <Skeleton width={64} height={30} radius={6} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/*
 * Execution receipt rows. A trailing status chip distinguishes acknowledged
 * from queued from failed, which is why the trailing skeleton is wider (58px)
 * than a simple time string.
 */
function ExecutionReceiptsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="app-skeleton-row">
          <Skeleton width={16} height={16} radius={4} />
          <div className="app-stack-1 app-grow">
            <Skeleton width={`${70 - index * 7}%`} height={11} />
            <Skeleton width={`${44 - index * 3}%`} height={9} />
          </div>
          <Skeleton width={58} height={16} radius={4} />
        </div>
      ))}
    </div>
  );
}
