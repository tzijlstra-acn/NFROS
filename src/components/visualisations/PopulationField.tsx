"use client";

/**
 * The full-population control test field.
 *
 * What it shows: every case in the population, not a sample of it. Each case is
 * one small cell, grouped so the distribution is readable, and every cell is
 * clickable down to the individual transaction.
 *
 * The design decision that matters: the four things a tester needs to see about
 * a case are encoded at four different POSITIONS on the cell rather than as
 * four colours. The centre glyph is the outcome, the bottom edge bar is missing
 * secondary review evidence, the outer ring is sample membership, and the top
 * left corner notch is a fallback-route case. A reader can therefore answer
 * "which cases the test did not look at" and "which cases have no review
 * evidence" independently, in the same glance, in greyscale. Colour repeats
 * each of those signals but never carries one alone.
 *
 * The unsampled remainder is drawn at full strength, because the thing a test
 * did not look at is a property of the test.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Chip, ObjectId } from "@/components/evidence/primitives";

/* ==========================================================================
   Props
   ========================================================================== */

export type CaseOutcome = "conforming" | "anomaly" | "exception";

export interface PopulationCase {
  id: string;
  transactionRef: string;
  /** ISO date or date-time. The date part drives the date grouping. */
  occurredAt: string;
  repairReason: string;
  repairedByLabel?: string;
  reviewerLabel?: string | null;
  secondaryReviewEvidenced: boolean;
  inSample: boolean;
  outcome: CaseOutcome | string;
  anomalyKind?: string | null;
  /** Null until a human classifies the exception. Counted as unclassified. */
  exceptionClassification?: string | null;
  exceptionScope?: string | null;
  fromFallbackRoute: boolean;
  /** Preformatted amount, for example "48'250.00 CHF". */
  amountLabel?: string;
  note?: string;
}

export interface PopulationFieldTest {
  reference: string;
  title?: string;
  populationSize: number;
  sampleSize: number;
  samplingMethod?: string;
  samplingRationale?: string;
  periodFrom?: string;
  periodTo?: string;
  /** Tolerable deviation rate as a fraction, for example 0.05. */
  tolerableDeviationRate?: number;
}

export type PopulationGrouping = "date" | "repair-reason" | "reviewer";

export interface PopulationFieldProps {
  test: PopulationFieldTest;
  cases: PopulationCase[];
  /** Initial grouping. The control is interactive from there. */
  groupBy?: PopulationGrouping;
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  heading?: string;
}

/* ==========================================================================
   Geometry
   ========================================================================== */

const VIEW_W = 1000;
const TOP = 56;
const LABEL_W = 186;
const PLOT_X = LABEL_W + 10;
const CELL = 16;
const PITCH = 20;
const ROW_GAP = 18;

const GROUPING_LABELS: Record<PopulationGrouping, string> = {
  date: "By date",
  "repair-reason": "By repair reason",
  reviewer: "By reviewer",
};

const OUTCOME_ORDER: CaseOutcome[] = ["conforming", "anomaly", "exception"];

const OUTCOME_LABELS: Record<string, string> = {
  conforming: "Conforming",
  anomaly: "Anomaly",
  exception: "Exception",
};

function outcomeFill(outcome: string): string {
  if (outcome === "exception") return "var(--red-tint)";
  if (outcome === "anomaly") return "var(--amber-tint)";
  return "var(--surface-3)";
}

function outcomeStroke(outcome: string): string {
  if (outcome === "exception") return "var(--red)";
  if (outcome === "anomaly") return "var(--amber)";
  return "var(--border-2)";
}

function dateOf(occurredAt: string): string {
  return occurredAt.slice(0, 10);
}

interface CellGroup {
  key: string;
  label: string;
  cases: PopulationCase[];
  y: number;
  subRows: number;
}

interface PlacedCell {
  item: PopulationCase;
  x: number;
  y: number;
  /** Position in the flattened display order, which is the keyboard order. */
  index: number;
}

/* ==========================================================================
   Component
   ========================================================================== */

export function PopulationField({
  test,
  cases,
  groupBy = "date",
  selectedCaseId = null,
  onSelectCase,
  heading = "Full population, control test",
}: PopulationFieldProps) {
  const patternId = useId().replace(/:/g, "");
  const [grouping, setGrouping] = useState<PopulationGrouping>(groupBy);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cellRefs = useRef<Array<SVGGElement | null>>([]);
  const shouldFocus = useRef(false);

  const perRow = useMemo(() => {
    const plotW = VIEW_W - PLOT_X - 16;
    return Math.max(1, Math.floor(plotW / PITCH));
  }, []);

  const { groups, cells, longestGroup, viewH } = useMemo(() => {
    // Grouping is deterministic: cases are bucketed, buckets are ordered by the
    // rule that makes that particular grouping readable, and cases inside a
    // bucket are ordered by time then identifier.
    const buckets = new Map<string, PopulationCase[]>();
    for (const item of cases) {
      const key =
        grouping === "date"
          ? dateOf(item.occurredAt)
          : grouping === "repair-reason"
            ? item.repairReason
            : (item.reviewerLabel ?? "No reviewer recorded");
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    }

    const entries = Array.from(buckets.entries()).map(([key, list]) => ({
      key,
      list: [...list].sort(
        (a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
      ),
    }));

    if (grouping === "date") {
      entries.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      entries.sort((a, b) => b.list.length - a.list.length || a.key.localeCompare(b.key));
    }

    const placedGroups: CellGroup[] = [];
    const placedCells: PlacedCell[] = [];
    let cursorY = TOP;
    let flatIndex = 0;

    for (const entry of entries) {
      const subRows = Math.max(1, Math.ceil(entry.list.length / perRow));
      placedGroups.push({
        key: entry.key,
        label: entry.key,
        cases: entry.list,
        y: cursorY,
        subRows,
      });
      entry.list.forEach((item, index) => {
        const column = index % perRow;
        const row = Math.floor(index / perRow);
        placedCells.push({
          item,
          x: PLOT_X + column * PITCH,
          y: cursorY + row * PITCH,
          index: flatIndex,
        });
        flatIndex += 1;
      });
      cursorY += subRows * PITCH + ROW_GAP;
    }

    const longestGroup = placedGroups.reduce(
      (max, group) => Math.max(max, Math.min(group.cases.length, perRow)),
      0,
    );

    return { groups: placedGroups, cells: placedCells, longestGroup, viewH: cursorY + 14 };
  }, [cases, grouping, perRow]);

  const summary = useMemo(() => computeSummary(cases), [cases]);

  const byId = useMemo(() => new Map(cases.map((item) => [item.id, item])), [cases]);
  const inspected = (hoverId !== null ? byId.get(hoverId) : undefined) ??
    (selectedCaseId !== null ? byId.get(selectedCaseId) : undefined);

  const hovered = hoverId !== null ? cells.find((cell) => cell.item.id === hoverId) : undefined;

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    cellRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  /** Roving tabindex: one tab stop for the field, arrow keys inside it. */
  const onFieldKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      const total = cells.length;
      if (total === 0) return;
      let next = activeIndex;
      if (event.key === "ArrowRight") next = Math.min(total - 1, activeIndex + 1);
      else if (event.key === "ArrowLeft") next = Math.max(0, activeIndex - 1);
      else if (event.key === "ArrowDown") next = Math.min(total - 1, activeIndex + perRow);
      else if (event.key === "ArrowUp") next = Math.max(0, activeIndex - perRow);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = total - 1;
      else return;
      event.preventDefault();
      shouldFocus.current = true;
      setActiveIndex(next);
    },
    [activeIndex, cells.length, perRow],
  );

  const deviationLow = summary.total > 0 ? summary.exceptions / summary.total : 0;
  const deviationHigh =
    summary.total > 0 ? (summary.exceptions + summary.anomalies) / summary.total : 0;

  const ariaLabel = [
    `Full population field for control test ${test.reference}.`,
    `${summary.total} cases rendered individually.`,
    `${summary.conforming} conforming, ${summary.anomalies} anomalies, ${summary.exceptions} exceptions.`,
    `${summary.sampled} cases were drawn into the sample and ${summary.total - summary.sampled} were not.`,
    `${summary.missingReviewEvidence} cases have no evidenced secondary review.`,
    `${summary.fromFallbackRoute} cases arose from the fallback route.`,
    summary.topReviewer
      ? `Reviewer concentration: ${summary.topReviewer.label} reviewed ${summary.topReviewer.count} of ${summary.reviewedTotal} reviewed cases.`
      : "",
    `Grouped ${GROUPING_LABELS[grouping].toLowerCase()}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className="stack stack-4" style={{ margin: 0 }}>
      <figcaption className="row row-3 row-wrap row-between">
        <div className="stack stack-1">
          <span className="panel-title">{heading}</span>
          <div className="row row-2 row-wrap">
            <ObjectId id={test.reference} />
            {test.periodFrom && test.periodTo ? (
              <span className="meta">
                {test.periodFrom} to {test.periodTo}
              </span>
            ) : null}
          </div>
        </div>
        <div className="row row-2 row-wrap">
          <span className="label">Group</span>
          <div className="segmented" role="group" aria-label="Group the population field">
            {(Object.keys(GROUPING_LABELS) as PopulationGrouping[]).map((option) => (
              <button
                key={option}
                type="button"
                className="segmented-option"
                aria-pressed={grouping === option}
                onClick={() => {
                  setGrouping(option);
                  setActiveIndex(0);
                }}
              >
                {GROUPING_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
      </figcaption>

      {/* Sample framing, stated before the field so nobody reads the field as a sample. */}
      <div className="row row-3 row-wrap">
        <Chip tone="cyan">
          {summary.total} in population
        </Chip>
        <Chip tone="accent">{summary.sampled} in sample</Chip>
        <Chip tone="neutral">{summary.total - summary.sampled} not sampled</Chip>
        {test.samplingMethod ? <Chip tone="neutral">{test.samplingMethod}</Chip> : null}
        {test.tolerableDeviationRate !== undefined ? (
          <Chip tone="amber">
            tolerable deviation {(test.tolerableDeviationRate * 100).toFixed(1)} percent
          </Chip>
        ) : null}
      </div>

      <div style={{ position: "relative", width: "100%" }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${viewH}`}
          preserveAspectRatio="xMidYMin meet"
          role="img"
          aria-label={ariaLabel}
          style={{ width: "100%", height: "auto" }}
          onKeyDown={onFieldKeyDown}
        >
          <defs>
            <pattern id={`${patternId}-noreview`} width="3" height="3" patternUnits="userSpaceOnUse">
              <rect width="3" height="3" fill="var(--surface-0)" />
              <circle cx="1.5" cy="1.5" r="0.8" fill="var(--pink)" />
            </pattern>
          </defs>

          {/* Column ruler. Ten-cell ticks make a row length countable, capped at the
              longest group so the ruler never implies capacity no row uses. */}
          <g aria-hidden="true">
            {Array.from({ length: Math.floor(longestGroup / 10) }, (_, i) => (i + 1) * 10).map((tick) => (
              <g key={tick}>
                <line
                  x1={PLOT_X + (tick - 1) * PITCH + CELL / 2}
                  y1={TOP - 12}
                  x2={PLOT_X + (tick - 1) * PITCH + CELL / 2}
                  y2={TOP - 6}
                  stroke="var(--border-2)"
                  strokeWidth="1"
                />
                <text
                  x={PLOT_X + (tick - 1) * PITCH + CELL / 2}
                  y={TOP - 16}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill="var(--text-4)"
                >
                  {tick}
                </text>
              </g>
            ))}
            <text x={16} y={TOP - 16} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-4)" letterSpacing="0.09em">
              {GROUPING_LABELS[grouping].toUpperCase()}
            </text>
          </g>

          {/* Group labels with a real count, so a long row is also a number. */}
          {groups.map((group) => (
            <g key={group.key} aria-hidden="true">
              <text x={16} y={group.y + 12} fontSize="12" fill="var(--text-2)">
                {group.label.length > 26 ? `${group.label.slice(0, 25)}...` : group.label}
              </text>
              <text x={16} y={group.y + 27} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-4)">
                {group.cases.length} cases
              </text>
              <line
                x1={PLOT_X - 6}
                y1={group.y - 4}
                x2={PLOT_X - 6}
                y2={group.y + group.subRows * PITCH - 4}
                stroke="var(--border-1)"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* The field */}
          {cells.map((cell) => {
            const item = cell.item;
            const isSelected = selectedCaseId === item.id;
            const isHovered = hoverId === item.id;
            return (
              <g
                key={item.id}
                ref={(element) => {
                  cellRefs.current[cell.index] = element;
                }}
                role="button"
                tabIndex={cell.index === activeIndex ? 0 : -1}
                aria-label={describeCase(item)}
                aria-pressed={isSelected}
                style={{ cursor: onSelectCase ? "pointer" : "default", outline: "none" }}
                onMouseEnter={() => setHoverId(item.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => {
                  setHoverId(item.id);
                  setActiveIndex(cell.index);
                }}
                onBlur={() => setHoverId(null)}
                onClick={() => onSelectCase?.(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectCase?.(item.id);
                  }
                }}
              >
                {/* Drawn focus and selection rings: CSS focus styling does not paint here. */}
                {isHovered || isSelected ? (
                  <rect
                    x={cell.x - 4}
                    y={cell.y - 4}
                    width={CELL + 8}
                    height={CELL + 8}
                    rx="3"
                    fill="none"
                    stroke={isSelected ? "var(--pink)" : "var(--accent)"}
                    strokeWidth="2"
                  />
                ) : null}

                <rect
                  x={cell.x}
                  y={cell.y}
                  width={CELL}
                  height={CELL}
                  rx="2"
                  fill={outcomeFill(item.outcome)}
                  stroke={outcomeStroke(item.outcome)}
                  strokeWidth={item.outcome === "conforming" ? 0.9 : 1.5}
                />

                {/* Centre glyph: the outcome. */}
                {item.outcome === "anomaly" ? (
                  <line
                    x1={cell.x + 3.5}
                    y1={cell.y + CELL - 3.5}
                    x2={cell.x + CELL - 3.5}
                    y2={cell.y + 3.5}
                    stroke="var(--amber)"
                    strokeWidth="1.6"
                  />
                ) : null}
                {item.outcome === "exception" ? (
                  <>
                    <line
                      x1={cell.x + 3.5}
                      y1={cell.y + 3.5}
                      x2={cell.x + CELL - 3.5}
                      y2={cell.y + CELL - 3.5}
                      stroke="var(--red)"
                      strokeWidth="1.6"
                    />
                    <line
                      x1={cell.x + CELL - 3.5}
                      y1={cell.y + 3.5}
                      x2={cell.x + 3.5}
                      y2={cell.y + CELL - 3.5}
                      stroke="var(--red)"
                      strokeWidth="1.6"
                    />
                  </>
                ) : null}

                {/* Bottom edge bar: no evidenced secondary review. */}
                {!item.secondaryReviewEvidenced ? (
                  <rect
                    x={cell.x}
                    y={cell.y + CELL - 3.5}
                    width={CELL}
                    height="3.5"
                    fill={`url(#${patternId}-noreview)`}
                    stroke="var(--pink)"
                    strokeWidth="0.6"
                  />
                ) : null}

                {/* Outer ring: drawn into the sample. */}
                {item.inSample ? (
                  <rect
                    x={cell.x - 2.5}
                    y={cell.y - 2.5}
                    width={CELL + 5}
                    height={CELL + 5}
                    rx="3"
                    fill="none"
                    stroke="var(--cyan)"
                    strokeWidth="1.2"
                  />
                ) : null}

                {/* Top left corner notch: the case came from the fallback route. */}
                {item.fromFallbackRoute ? (
                  <path
                    d={`M${cell.x},${cell.y}L${cell.x + 6},${cell.y}L${cell.x},${cell.y + 6}Z`}
                    fill="var(--accent)"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        {hovered ? (
          <div
            role="presentation"
            style={{
              position: "absolute",
              left: `${((hovered.x + CELL / 2) / VIEW_W) * 100}%`,
              top: `${(hovered.y / viewH) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
              pointerEvents: "none",
              zIndex: 2,
              maxWidth: "300px",
              padding: "var(--space-3)",
              background: "var(--surface-raised)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-3)",
            }}
          >
            <div className="stack stack-1">
              <span className="strong-text mono" style={{ fontSize: "var(--text-sm)" }}>
                {hovered.item.transactionRef}
              </span>
              <span className="meta">{hovered.item.occurredAt}</span>
              <span style={{ fontSize: "var(--text-sm)" }}>
                {OUTCOME_LABELS[hovered.item.outcome] ?? hovered.item.outcome}
                {hovered.item.anomalyKind ? `: ${hovered.item.anomalyKind}` : ""}
              </span>
              <span className="meta">{hovered.item.repairReason}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Legend. Each encoding is named by its position on the cell. */}
      <div className="row row-4 row-wrap" aria-hidden="true" style={{ fontSize: "var(--text-xs)" }}>
        <CellLegend label="Conforming">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--surface-3)" stroke="var(--border-2)" strokeWidth="0.9" />
        </CellLegend>
        <CellLegend label="Anomaly, centre slash">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--amber-tint)" stroke="var(--amber)" strokeWidth="1.5" />
          <line x1="7.5" y1="16.5" x2="16.5" y2="7.5" stroke="var(--amber)" strokeWidth="1.6" />
        </CellLegend>
        <CellLegend label="Exception, centre cross">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--red-tint)" stroke="var(--red)" strokeWidth="1.5" />
          <line x1="7.5" y1="7.5" x2="16.5" y2="16.5" stroke="var(--red)" strokeWidth="1.6" />
          <line x1="16.5" y1="7.5" x2="7.5" y2="16.5" stroke="var(--red)" strokeWidth="1.6" />
        </CellLegend>
        <CellLegend label="No evidenced secondary review, bottom bar">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--surface-3)" stroke="var(--border-2)" strokeWidth="0.9" />
          <rect x="4" y="16.5" width="16" height="3.5" fill="var(--pink)" />
        </CellLegend>
        <CellLegend label="In sample, outer ring">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--surface-3)" stroke="var(--border-2)" strokeWidth="0.9" />
          <rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="none" stroke="var(--cyan)" strokeWidth="1.2" />
        </CellLegend>
        <CellLegend label="Fallback route, corner notch">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="var(--surface-3)" stroke="var(--border-2)" strokeWidth="0.9" />
          <path d="M4,4L10,4L4,10Z" fill="var(--accent)" />
        </CellLegend>
        <span className="muted">Arrow keys move inside the field. Enter opens a case.</span>
      </div>

      {/* The inspected case, persistent, so the tooltip is never the only source. */}
      <div className="card card-edge" data-tone={inspected ? toneForOutcome(inspected.outcome) : "neutral"}>
        {inspected ? (
          <div className="stack stack-2">
            <div className="row row-3 row-wrap row-between">
              <span className="strong-text mono">{inspected.transactionRef}</span>
              <div className="row row-2 row-wrap">
                <Chip tone={toneForOutcome(inspected.outcome)}>
                  {OUTCOME_LABELS[inspected.outcome] ?? inspected.outcome}
                </Chip>
                <Chip tone={inspected.inSample ? "cyan" : "neutral"}>
                  {inspected.inSample ? "in sample" : "not sampled"}
                </Chip>
                {!inspected.secondaryReviewEvidenced ? (
                  <Chip tone="pink">no review evidence</Chip>
                ) : null}
                {inspected.fromFallbackRoute ? <Chip tone="accent">fallback route</Chip> : null}
              </div>
            </div>
            <div className="row row-4 row-wrap meta">
              <span>{inspected.occurredAt}</span>
              {inspected.amountLabel ? <span>{inspected.amountLabel}</span> : null}
              <span>{inspected.repairReason}</span>
              {inspected.repairedByLabel ? <span>repaired by {inspected.repairedByLabel}</span> : null}
              <span>{inspected.reviewerLabel ? `reviewed by ${inspected.reviewerLabel}` : "no reviewer recorded"}</span>
            </div>
            {inspected.anomalyKind ? (
              <p style={{ fontSize: "var(--text-sm)" }}>Anomaly: {inspected.anomalyKind}</p>
            ) : null}
            {inspected.outcome === "exception" ? (
              <p style={{ fontSize: "var(--text-sm)" }}>
                Classification:{" "}
                {inspected.exceptionClassification ?? "not yet classified, this is a human decision"}
                {inspected.exceptionScope ? `, scope ${inspected.exceptionScope}` : ""}
              </p>
            ) : null}
            {inspected.note ? (
              <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                {inspected.note}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
            Hover, focus or click a cell to inspect the individual case.
          </p>
        )}
      </div>

      {/* Real distribution, computed from the cases rather than stated. */}
      <div className="grid grid-3">
        <div className="stack stack-3">
          <span className="label">Outcome</span>
          {OUTCOME_ORDER.map((outcome) => (
            <DistributionBar
              key={outcome}
              label={OUTCOME_LABELS[outcome] ?? outcome}
              count={
                outcome === "conforming"
                  ? summary.conforming
                  : outcome === "anomaly"
                    ? summary.anomalies
                    : summary.exceptions
              }
              total={summary.total}
              tone={outcome === "exception" ? "var(--red)" : outcome === "anomaly" ? "var(--amber)" : "var(--text-3)"}
            />
          ))}
          <DistributionBar
            label="No evidenced secondary review"
            count={summary.missingReviewEvidence}
            total={summary.total}
            tone="var(--pink)"
          />
          <DistributionBar
            label="From the fallback route"
            count={summary.fromFallbackRoute}
            total={summary.total}
            tone="var(--accent)"
          />
          <DistributionBar
            label="Not drawn into the sample"
            count={summary.total - summary.sampled}
            total={summary.total}
            tone="var(--border-strong)"
          />
          {summary.unclassifiedExceptions > 0 ? (
            <p className="meta" style={{ color: "var(--amber)" }}>
              {summary.unclassifiedExceptions} exceptions are not yet classified. Classification is a
              human decision.
            </p>
          ) : null}
        </div>

        <div className="stack stack-3">
          <span className="label">Repair reason</span>
          {summary.byRepairReason.map((entry) => (
            <DistributionBar
              key={entry.key}
              label={entry.key}
              count={entry.count}
              total={summary.total}
              tone="var(--cyan)"
            />
          ))}
        </div>

        <div className="stack stack-3">
          <span className="label">Reviewer</span>
          {summary.byReviewer.map((entry) => (
            <DistributionBar
              key={entry.key}
              label={entry.key}
              count={entry.count}
              total={summary.total}
              tone={
                summary.topReviewer && entry.key === summary.topReviewer.label
                  ? "var(--amber)"
                  : "var(--text-3)"
              }
            />
          ))}
          {summary.topReviewer && summary.reviewedTotal > 0 ? (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--amber)" }}>
              Reviewer concentration: {summary.topReviewer.label} reviewed{" "}
              {summary.topReviewer.count} of {summary.reviewedTotal} reviewed cases (
              {Math.round((summary.topReviewer.count / summary.reviewedTotal) * 100)} percent).
            </p>
          ) : null}
        </div>
      </div>

      {/* Two deviation rates, never one, because the anomalies are unresolved. */}
      <div className="card">
        <div className="stack stack-2">
          <span className="label">Deviation rate, stated as a range</span>
          <p style={{ fontSize: "var(--text-sm)" }}>
            Treating the {summary.anomalies} anomalies as conforming gives{" "}
            <span className="mono">{(deviationLow * 100).toFixed(2)} percent</span>. Treating them as
            deviations gives <span className="mono">{(deviationHigh * 100).toFixed(2)} percent</span>.
            {test.tolerableDeviationRate !== undefined ? (
              <>
                {" "}
                The tolerable rate is{" "}
                <span className="mono">{(test.tolerableDeviationRate * 100).toFixed(2)} percent</span>
                {deviationLow <= test.tolerableDeviationRate &&
                deviationHigh > test.tolerableDeviationRate
                  ? ", and the range straddles it, so the test cannot conclude on the rate alone."
                  : "."}
              </>
            ) : null}
          </p>
          {test.samplingRationale ? (
            <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
              {test.samplingRationale}
            </p>
          ) : null}
        </div>
      </div>

      <div className="sr-only">
        <h4>Population, described</h4>
        <p>
          {summary.total} cases. {summary.conforming} conforming, {summary.anomalies} anomalies,{" "}
          {summary.exceptions} exceptions. {summary.sampled} drawn into the sample,{" "}
          {summary.total - summary.sampled} not sampled. {summary.missingReviewEvidence} without
          evidenced secondary review. {summary.fromFallbackRoute} from the fallback route.
        </p>
        <h5>Cases</h5>
        <ul>
          {cases.map((item) => (
            <li key={`sr-${item.id}`}>{describeCase(item)}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

/* ==========================================================================
   Internals
   ========================================================================== */

interface SummaryEntry {
  key: string;
  count: number;
}

function computeSummary(cases: PopulationCase[]) {
  const reasons = new Map<string, number>();
  const reviewers = new Map<string, number>();
  let conforming = 0;
  let anomalies = 0;
  let exceptions = 0;
  let sampled = 0;
  let missingReviewEvidence = 0;
  let fromFallbackRoute = 0;
  let unclassifiedExceptions = 0;
  let reviewedTotal = 0;

  for (const item of cases) {
    if (item.outcome === "exception") {
      exceptions += 1;
      if (!item.exceptionClassification) unclassifiedExceptions += 1;
    } else if (item.outcome === "anomaly") anomalies += 1;
    else conforming += 1;

    if (item.inSample) sampled += 1;
    if (!item.secondaryReviewEvidenced) missingReviewEvidence += 1;
    if (item.fromFallbackRoute) fromFallbackRoute += 1;

    reasons.set(item.repairReason, (reasons.get(item.repairReason) ?? 0) + 1);
    const reviewer = item.reviewerLabel;
    if (reviewer) {
      reviewers.set(reviewer, (reviewers.get(reviewer) ?? 0) + 1);
      reviewedTotal += 1;
    } else {
      reviewers.set("No reviewer recorded", (reviewers.get("No reviewer recorded") ?? 0) + 1);
    }
  }

  const toSorted = (map: Map<string, number>): SummaryEntry[] =>
    Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const byReviewer = toSorted(reviewers);
  const namedTop = byReviewer.find((entry) => entry.key !== "No reviewer recorded");

  return {
    total: cases.length,
    conforming,
    anomalies,
    exceptions,
    sampled,
    missingReviewEvidence,
    fromFallbackRoute,
    unclassifiedExceptions,
    reviewedTotal,
    byRepairReason: toSorted(reasons),
    byReviewer,
    topReviewer: namedTop ? { label: namedTop.key, count: namedTop.count } : null,
  };
}

function toneForOutcome(outcome: string): "red" | "amber" | "neutral" {
  if (outcome === "exception") return "red";
  if (outcome === "anomaly") return "amber";
  return "neutral";
}

function describeCase(item: PopulationCase): string {
  const parts: string[] = [
    `Case ${item.transactionRef}, ${item.occurredAt}.`,
    `Outcome ${OUTCOME_LABELS[item.outcome] ?? item.outcome}.`,
    `Repair reason ${item.repairReason}.`,
    item.inSample ? "Drawn into the sample." : "Not sampled.",
    item.secondaryReviewEvidenced
      ? "Secondary review is evidenced."
      : "No secondary review evidence.",
  ];
  if (item.reviewerLabel) parts.push(`Reviewer ${item.reviewerLabel}.`);
  else parts.push("No reviewer recorded.");
  if (item.repairedByLabel) parts.push(`Repaired by ${item.repairedByLabel}.`);
  if (item.amountLabel) parts.push(`${item.amountLabel}.`);
  if (item.anomalyKind) parts.push(`Anomaly kind ${item.anomalyKind}.`);
  if (item.outcome === "exception") {
    parts.push(
      item.exceptionClassification
        ? `Classified as ${item.exceptionClassification}.`
        : "Not yet classified.",
    );
  }
  if (item.fromFallbackRoute) parts.push("Arose from the fallback route.");
  if (item.note) parts.push(item.note);
  return parts.join(" ");
}

function CellLegend({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="row row-2">
      <svg viewBox="0 0 24 24" style={{ width: "20px", height: "20px", flexShrink: 0 }} aria-hidden="true">
        {children}
      </svg>
      <span className="muted">{label}</span>
    </span>
  );
}

/** A horizontal count bar. Deliberately not a pie: proportions here are compared. */
function DistributionBar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: string;
}) {
  const fraction = total > 0 ? count / total : 0;
  return (
    <div className="stack stack-1">
      <div className="row row-2 row-between" style={{ fontSize: "var(--text-xs)" }}>
        <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span className="mono muted">
          {count} / {total}
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${label}: ${count} of ${total}`}
        style={{
          height: "8px",
          background: "var(--surface-3)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${fraction * 100}%`, height: "100%", background: tone }} />
      </div>
    </div>
  );
}

export default PopulationField;
