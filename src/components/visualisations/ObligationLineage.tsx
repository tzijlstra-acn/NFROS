"use client";

/**
 * Source to obligation to control lineage, dual lane.
 *
 * What it shows: a left-to-right flow from a regulatory publication, to the
 * paragraph it comes from, to the candidate obligation, to the internal
 * policy, process or control that carries it, and finally to the evidence that
 * proves it.
 *
 * Two design decisions that matter.
 *
 * First, the terminal state is carried by the GEOMETRY of the flow, not by a
 * colour on a node. An evidenced obligation's ribbon reaches the evidence
 * marker. An unevidenced one stops short with a blunt dashed cap, because the
 * flow genuinely stops at the control. An unowned obligation gets no outbound
 * ribbon at all: it terminates in a visible dead end immediately after the
 * obligation node. The dead end is the finding this role exists to produce, so
 * it is drawn as an ending rather than as an absence.
 *
 * Second, the EU and Swiss lanes are separated by a hard rule and no ribbon
 * ever crosses it. Where one internal control serves obligations in both
 * lanes, the control is drawn once inside each lane and badged as shared, with
 * the evidence requirement stated separately per lane. Drawing it once in a
 * shared band would require a flow across the separator, which would blur the
 * two jurisdictions, and that is the one thing this view must never do.
 */

import { useId, useMemo, useState } from "react";
import { Chip, ObjectId } from "@/components/evidence/primitives";

/* ==========================================================================
   Props
   ========================================================================== */

export type LineageLane = "eu" | "ch";

export type LineageTerminalState = "evidenced" | "stale" | "unevidenced" | "unmapped";

export interface LineagePublication {
  id: string;
  reference: string;
  title: string;
  issuer?: string;
  /** "eu", "de", "at" or "ch". Reported at the node. */
  jurisdiction: string;
  lane: LineageLane;
  instrumentType?: string;
  publishedOn?: string;
}

export interface LineageTarget {
  id: string;
  kind: "policy" | "process" | "control" | string;
  label: string;
  detail?: string;
  /** True when the same internal object also serves the other lane. */
  servesBothLanes?: boolean;
}

export interface LineageObligation {
  id: string;
  publicationId: string;
  paragraphReference: string;
  /** Model extracted summary, kept separate from the quoted obligation text. */
  summary: string;
  theme?: string;
  /** Entity scope. No node in this view is scopeless. */
  entityScopeLabel: string;
  extractionConfidence?: number;
  applicabilityDecision?: string | null;
  ownerLabel?: string | null;
  isUnownedGap: boolean;
  gapNote?: string;
  targets: LineageTarget[];
  terminalState: LineageTerminalState;
  evidenceRef?: string;
  /** For a stale terminal state, for example "412 days old". */
  evidenceAgeLabel?: string;
  /** Scenario moment at which this obligation's state last changed. */
  stateChangedAtMoment?: string;
}

export interface ObligationLineageProps {
  publications: LineagePublication[];
  obligations: LineageObligation[];
  laneLabels?: Record<LineageLane, string>;
  selectedObligationId?: string | null;
  onSelectObligation?: (obligationId: string) => void;
  heading?: string;
}

/** The label that must accompany every regulatory reference in this product. */
const REGULATORY_LABEL = "Illustrative regulatory context, not legal advice.";

/* ==========================================================================
   Geometry
   ========================================================================== */

const VIEW_W = 1000;
const LANE_HEADER_H = 44;
const ROW_GAP = 16;
const OBLIGATION_H = 94;
const TARGET_H = 22;
const SEPARATOR_BAND = 34;
const TOP = 34;

const COLS = {
  publication: { x: 14, w: 152 },
  paragraph: { x: 208, w: 134 },
  obligation: { x: 386, w: 258 },
  target: { x: 690, w: 196 },
  terminal: { x: 928, w: 58 },
};

const LANE_TONE: Record<LineageLane, string> = {
  eu: "var(--cyan)",
  ch: "var(--accent)",
};

const LANE_TINT: Record<LineageLane, string> = {
  eu: "var(--cyan-tint)",
  ch: "var(--accent-tint)",
};

const TERMINAL_GLYPH: Record<LineageTerminalState, string> = {
  evidenced: "v",
  stale: "~",
  unevidenced: "-",
  unmapped: "x",
};

const TERMINAL_WORD: Record<LineageTerminalState, string> = {
  evidenced: "Mapped and evidenced",
  stale: "Mapped, evidence is stale",
  unevidenced: "Mapped, not evidenced",
  unmapped: "Unmapped, no owner",
};

const TERMINAL_TONE: Record<LineageTerminalState, string> = {
  evidenced: "var(--green)",
  stale: "var(--amber)",
  unevidenced: "var(--red)",
  unmapped: "var(--pink)",
};

/**
 * A Sankey style band between two vertical spans.
 *
 * The control points sit on the horizontal midline, which produces the flat
 * shoulder a reader expects from a flow diagram without needing a layout
 * library to compute it.
 */
function ribbon(x0: number, y0a: number, y0b: number, x1: number, y1a: number, y1b: number): string {
  const mx = (x0 + x1) / 2;
  return [
    `M${x0.toFixed(1)},${y0a.toFixed(1)}`,
    `C${mx.toFixed(1)},${y0a.toFixed(1)} ${mx.toFixed(1)},${y1a.toFixed(1)} ${x1.toFixed(1)},${y1a.toFixed(1)}`,
    `L${x1.toFixed(1)},${y1b.toFixed(1)}`,
    `C${mx.toFixed(1)},${y1b.toFixed(1)} ${mx.toFixed(1)},${y0b.toFixed(1)} ${x0.toFixed(1)},${y0b.toFixed(1)}`,
    "Z",
  ].join(" ");
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) current = candidate;
    else {
      if (current.length > 0) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current.length > 0) lines.push(current);
  return lines;
}

interface RowLayout {
  obligation: LineageObligation;
  top: number;
  height: number;
}

interface BandLayout {
  key: string;
  label: string;
  sublabel: string;
  top: number;
  bottom: number;
}

interface LaneLayout {
  lane: LineageLane;
  label: string;
  top: number;
  bottom: number;
  publications: BandLayout[];
  paragraphs: BandLayout[];
  rows: RowLayout[];
}

/* ==========================================================================
   Component
   ========================================================================== */

export function ObligationLineage({
  publications,
  obligations,
  laneLabels = {
    eu: "EU lane",
    ch: "Swiss lane",
  },
  selectedObligationId = null,
  onSelectObligation,
  heading = "Obligation to control lineage",
}: ObligationLineageProps) {
  // Instance scoped, so two lineage views on one page cannot share a pattern id.
  const patternId = useId().replace(/:/g, "");
  const [activeId, setActiveId] = useState<string | null>(null);

  const publicationById = useMemo(
    () => new Map(publications.map((publication) => [publication.id, publication])),
    [publications],
  );

  const layout = useMemo(() => {
    const lanes: LaneLayout[] = [];
    let cursor = TOP;
    let separatorY: number | null = null;

    const laneOrder: LineageLane[] = ["eu", "ch"];

    laneOrder.forEach((lane, laneIndex) => {
      const laneObligations = obligations
        .filter((item) => publicationById.get(item.publicationId)?.lane === lane)
        .sort((a, b) => {
          const pubCompare = a.publicationId.localeCompare(b.publicationId);
          if (pubCompare !== 0) return pubCompare;
          return a.paragraphReference.localeCompare(b.paragraphReference) || a.id.localeCompare(b.id);
        });

      if (laneObligations.length === 0) return;

      if (laneIndex > 0 && lanes.length > 0) {
        // The hard rule between jurisdictions. Nothing is drawn across it.
        separatorY = cursor + SEPARATOR_BAND / 2;
        cursor += SEPARATOR_BAND;
      }

      const laneTop = cursor;
      let rowCursor = laneTop + LANE_HEADER_H;
      const rows: RowLayout[] = laneObligations.map((obligation) => {
        const height = Math.max(
          OBLIGATION_H,
          obligation.targets.length * (TARGET_H + 6) + 14,
        );
        const row = { obligation, top: rowCursor, height };
        rowCursor += height + ROW_GAP;
        return row;
      });

      // Publication and paragraph bands span the rows they feed, which is what
      // gives the view its Sankey read without any external layout step.
      const bandFor = (keyOf: (row: RowLayout) => string) => {
        const map = new Map<string, { top: number; bottom: number }>();
        for (const row of rows) {
          const key = keyOf(row);
          const existing = map.get(key);
          const top = row.top;
          const bottom = row.top + row.height;
          if (existing) {
            map.set(key, { top: Math.min(existing.top, top), bottom: Math.max(existing.bottom, bottom) });
          } else {
            map.set(key, { top, bottom });
          }
        }
        return map;
      };

      const pubBands = bandFor((row) => row.obligation.publicationId);
      const paraBands = bandFor((row) => `${row.obligation.publicationId}|${row.obligation.paragraphReference}`);

      const publicationLayout: BandLayout[] = Array.from(pubBands.entries()).map(([key, band]) => {
        const publication = publicationById.get(key);
        return {
          key,
          label: publication?.reference ?? key,
          sublabel: [publication?.issuer, publication?.instrumentType, publication?.jurisdiction.toUpperCase()]
            .filter(Boolean)
            .join(" / "),
          top: band.top,
          bottom: band.bottom,
        };
      });

      const paragraphLayout: BandLayout[] = Array.from(paraBands.entries()).map(([key, band]) => {
        const parts = key.split("|");
        return {
          key,
          label: parts[1] ?? key,
          sublabel: parts[0] ?? "",
          top: band.top,
          bottom: band.bottom,
        };
      });

      const laneBottom = rowCursor - ROW_GAP + 10;
      lanes.push({
        lane,
        label: laneLabels[lane],
        top: laneTop,
        bottom: laneBottom,
        publications: publicationLayout,
        paragraphs: paragraphLayout,
        rows,
      });
      cursor = laneBottom + 8;
    });

    return { lanes, separatorY, viewH: cursor + 18 };
  }, [obligations, publicationById, laneLabels]);

  const counter = useMemo(() => {
    const counts: Record<LineageTerminalState, number> = {
      evidenced: 0,
      stale: 0,
      unevidenced: 0,
      unmapped: 0,
    };
    for (const obligation of obligations) counts[obligation.terminalState] += 1;
    return counts;
  }, [obligations]);

  const sharedTargets = useMemo(() => {
    const byTargetLanes = new Map<string, { target: LineageTarget; lanes: Set<LineageLane> }>();
    for (const obligation of obligations) {
      const lane = publicationById.get(obligation.publicationId)?.lane;
      if (!lane) continue;
      for (const target of obligation.targets) {
        const entry = byTargetLanes.get(target.id) ?? { target, lanes: new Set<LineageLane>() };
        entry.lanes.add(lane);
        byTargetLanes.set(target.id, entry);
      }
    }
    return Array.from(byTargetLanes.values()).filter((entry) => entry.lanes.size > 1);
  }, [obligations, publicationById]);

  const focusTarget = activeId ?? selectedObligationId;

  const ariaLabel = [
    `Dual lane obligation lineage. Publications flow to paragraphs, to obligations, to internal policies, processes and controls, and then to evidence.`,
    `The EU lane and the Swiss lane are separated by a hard rule and no flow crosses it.`,
    `${obligations.length} obligations: ${counter.evidenced} mapped and evidenced, ${counter.unevidenced} mapped and not evidenced, ${counter.stale} mapped with stale evidence, ${counter.unmapped} unmapped with no owner.`,
    `Unmapped obligations terminate in a visible dead end.`,
    REGULATORY_LABEL,
  ].join(" ");

  return (
    <figure className="stack stack-4" style={{ margin: 0 }}>
      <figcaption className="row row-3 row-wrap row-between">
        <span className="panel-title">{heading}</span>
        <div className="row row-2 row-wrap">
          <Chip tone="green">{counter.evidenced} evidenced</Chip>
          <Chip tone="red">{counter.unevidenced} unevidenced</Chip>
          <Chip tone="amber">{counter.stale} stale</Chip>
          <Chip tone="pink">{counter.unmapped} unmapped</Chip>
        </div>
      </figcaption>

      <p className="meta">
        Four states, counted separately. A single coverage percentage would hide which of the four
        is the problem.
      </p>

      <svg
        viewBox={`0 0 ${VIEW_W} ${layout.viewH}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={ariaLabel}
        style={{ width: "100%", height: "auto" }}
      >
        <defs>
          <pattern id={`${patternId}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="var(--surface-0)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--border-2)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Column headers */}
        <g aria-hidden="true">
          {(
            [
              ["Publication", COLS.publication],
              ["Paragraph", COLS.paragraph],
              ["Obligation", COLS.obligation],
              ["Policy, process, control", COLS.target],
              ["Evidence", COLS.terminal],
            ] as const
          ).map(([label, col]) => (
            <text
              key={label}
              x={col.x}
              y={18}
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="var(--text-4)"
              letterSpacing="0.09em"
            >
              {label.toUpperCase()}
            </text>
          ))}
        </g>

        {/* The hard rule. A hatched band plus a doubled line, so it cannot be read
            as just another divider. */}
        {layout.separatorY !== null ? (
          <g aria-hidden="true">
            <rect x="0" y={layout.separatorY - 12} width={VIEW_W} height="24" fill={`url(#${patternId}-hatch)`} />
            <line x1="0" y1={layout.separatorY - 12} x2={VIEW_W} y2={layout.separatorY - 12} stroke="var(--border-strong)" strokeWidth="2" />
            <line x1="0" y1={layout.separatorY + 12} x2={VIEW_W} y2={layout.separatorY + 12} stroke="var(--border-strong)" strokeWidth="2" />
            <rect x="336" y={layout.separatorY - 9} width="330" height="18" rx="3" fill="var(--bg)" stroke="var(--border-strong)" strokeWidth="1" />
            <text
              x="501"
              y={layout.separatorY + 4}
              textAnchor="middle"
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="var(--text-2)"
              letterSpacing="0.06em"
            >
              JURISDICTION SEPARATOR: NO FLOW CROSSES THIS RULE
            </text>
          </g>
        ) : null}

        {layout.lanes.map((lane) => (
          <g key={lane.lane}>
            {/* Lane header carries the lane, the entities in it, and the mandatory label. */}
            <g aria-hidden="true">
              <rect
                x="0"
                y={lane.top}
                width={VIEW_W}
                height={LANE_HEADER_H - 8}
                fill={LANE_TINT[lane.lane]}
              />
              <rect x="0" y={lane.top} width="4" height={lane.bottom - lane.top} fill={LANE_TONE[lane.lane]} />
              <text
                x={14}
                y={lane.top + 17}
                fontSize="12"
                fontFamily="var(--font-display)"
                fontWeight="600"
                fill={LANE_TONE[lane.lane]}
                letterSpacing="0.06em"
              >
                {lane.label.toUpperCase()}
              </text>
              <text x={14} y={lane.top + 31} fontSize="11" fill="var(--text-3)">
                {laneEntityScope(lane)}
              </text>
              <text x={VIEW_W - 14} y={lane.top + 31} textAnchor="end" fontSize="11" fill="var(--text-4)">
                {REGULATORY_LABEL}
              </text>
            </g>

            {/* Publication bands */}
            {lane.publications.map((band) => (
              <g key={band.key} aria-hidden="true">
                <rect
                  x={COLS.publication.x}
                  y={band.top}
                  width={COLS.publication.w}
                  height={band.bottom - band.top}
                  rx="5"
                  fill="var(--surface-1)"
                  stroke={LANE_TONE[lane.lane]}
                  strokeWidth="1.2"
                />
                <text
                  x={COLS.publication.x + 10}
                  y={band.top + 18}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill={LANE_TONE[lane.lane]}
                >
                  {band.label}
                </text>
                {wrapText(publicationById.get(band.key)?.title ?? "", 22, 3).map((line, index) => (
                  <text
                    key={index}
                    x={COLS.publication.x + 10}
                    y={band.top + 34 + index * 13}
                    fontSize="11"
                    fill="var(--text-2)"
                  >
                    {line}
                  </text>
                ))}
                <text
                  x={COLS.publication.x + 10}
                  y={band.bottom - 8}
                  fontSize="11"
                  fill="var(--text-4)"
                >
                  {band.sublabel}
                </text>
              </g>
            ))}

            {/* Publication to paragraph ribbons */}
            {lane.paragraphs.map((band) => {
              const pubKey = band.sublabel;
              const pubBand = lane.publications.find((item) => item.key === pubKey);
              if (!pubBand) return null;
              return (
                <path
                  key={`pub-para-${band.key}`}
                  aria-hidden="true"
                  d={ribbon(
                    COLS.publication.x + COLS.publication.w,
                    band.top + 4,
                    band.bottom - 4,
                    COLS.paragraph.x,
                    band.top + 4,
                    band.bottom - 4,
                  )}
                  fill={LANE_TONE[lane.lane]}
                  fillOpacity="0.13"
                  stroke={LANE_TONE[lane.lane]}
                  strokeOpacity="0.32"
                  strokeWidth="0.75"
                />
              );
            })}

            {/* Paragraph bands */}
            {lane.paragraphs.map((band) => (
              <g key={`para-${band.key}`} aria-hidden="true">
                <rect
                  x={COLS.paragraph.x}
                  y={band.top}
                  width={COLS.paragraph.w}
                  height={band.bottom - band.top}
                  rx="5"
                  fill="var(--surface-0)"
                  stroke="var(--border-2)"
                  strokeWidth="1"
                />
                <text
                  x={COLS.paragraph.x + 10}
                  y={band.top + 18}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill="var(--text-2)"
                >
                  {band.label}
                </text>
                <text x={COLS.paragraph.x + 10} y={band.top + 32} fontSize="11" fill="var(--text-4)">
                  quoted paragraph
                </text>
              </g>
            ))}

            {/* Rows: paragraph to obligation, obligation node, targets, terminals */}
            {lane.rows.map((row) => {
              const obligation = row.obligation;
              const dim = focusTarget !== null && focusTarget !== obligation.id;
              const isFocused = focusTarget === obligation.id;
              const oblTop = row.top;
              const oblBottom = row.top + row.height;
              const targetsTop = oblTop + 7;

              return (
                <g key={obligation.id} opacity={dim ? 0.28 : 1}>
                  {/* Paragraph to obligation */}
                  <path
                    aria-hidden="true"
                    d={ribbon(
                      COLS.paragraph.x + COLS.paragraph.w,
                      oblTop + 6,
                      oblBottom - 6,
                      COLS.obligation.x,
                      oblTop + 6,
                      oblBottom - 6,
                    )}
                    fill={LANE_TONE[lane.lane]}
                    fillOpacity="0.13"
                    stroke={LANE_TONE[lane.lane]}
                    strokeOpacity="0.32"
                    strokeWidth="0.75"
                  />

                  {/* Obligation to each target */}
                  {obligation.targets.map((target, index) => {
                    const chipTop = targetsTop + index * (TARGET_H + 6);
                    const sourceCentre =
                      oblTop + (row.height / (obligation.targets.length + 1)) * (index + 1);
                    return (
                      <path
                        key={`flow-${obligation.id}-${target.id}`}
                        aria-hidden="true"
                        d={ribbon(
                          COLS.obligation.x + COLS.obligation.w,
                          sourceCentre - TARGET_H / 2 + 2,
                          sourceCentre + TARGET_H / 2 - 2,
                          COLS.target.x,
                          chipTop,
                          chipTop + TARGET_H,
                        )}
                        fill={LANE_TONE[lane.lane]}
                        fillOpacity="0.15"
                        stroke={LANE_TONE[lane.lane]}
                        strokeOpacity="0.34"
                        strokeWidth="0.75"
                      />
                    );
                  })}

                  {/* Target to evidence, or the flow that stops at the control */}
                  {obligation.targets.length > 0 ? (
                    <TerminalFlow
                      state={obligation.terminalState}
                      top={targetsTop}
                      bottom={targetsTop + obligation.targets.length * (TARGET_H + 6) - 6}
                    />
                  ) : null}

                  {/* The dead end. An unowned obligation has no outbound flow at all. */}
                  {obligation.isUnownedGap || obligation.targets.length === 0 ? (
                    <DeadEnd top={oblTop} height={row.height} />
                  ) : null}

                  {/* The obligation node itself */}
                  <g
                    tabIndex={0}
                    role="button"
                    aria-label={describeObligation(obligation, publicationById.get(obligation.publicationId))}
                    style={{ cursor: onSelectObligation ? "pointer" : "default", outline: "none" }}
                    onMouseEnter={() => setActiveId(obligation.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(obligation.id)}
                    onBlur={() => setActiveId(null)}
                    onClick={() => onSelectObligation?.(obligation.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectObligation?.(obligation.id);
                      }
                    }}
                  >
                    {isFocused ? (
                      <rect
                        x={COLS.obligation.x - 4}
                        y={oblTop - 4}
                        width={COLS.obligation.w + 8}
                        height={row.height + 8}
                        rx="8"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2"
                      />
                    ) : null}
                    <rect
                      x={COLS.obligation.x}
                      y={oblTop}
                      width={COLS.obligation.w}
                      height={row.height}
                      rx="6"
                      fill="var(--surface-1)"
                      stroke={
                        obligation.isUnownedGap ? "var(--pink)" : TERMINAL_TONE[obligation.terminalState]
                      }
                      strokeWidth={obligation.isUnownedGap ? "1.8" : "1.2"}
                    />
                    <text
                      x={COLS.obligation.x + 10}
                      y={oblTop + 17}
                      fontSize="11"
                      fontFamily="var(--font-mono)"
                      fill="var(--text-3)"
                    >
                      {obligation.id} {obligation.paragraphReference}
                    </text>
                    <text
                      x={COLS.obligation.x + COLS.obligation.w - 10}
                      y={oblTop + 17}
                      textAnchor="end"
                      fontSize="11"
                      fontFamily="var(--font-mono)"
                      fill={LANE_TONE[lane.lane]}
                    >
                      {obligation.entityScopeLabel}
                    </text>
                    {wrapText(obligation.summary, 44, 3).map((line, index) => (
                      <text
                        key={index}
                        x={COLS.obligation.x + 10}
                        y={oblTop + 34 + index * 14}
                        fontSize="12"
                        fill="var(--text-1)"
                      >
                        {line}
                      </text>
                    ))}
                    {/* The mandatory label sits at the node, not in a page footer. */}
                    {wrapText(REGULATORY_LABEL, 46, 2).map((line, index) => (
                      <text
                        key={`label-${index}`}
                        x={COLS.obligation.x + 10}
                        y={oblBottom - 20 + index * 12}
                        fontSize="11"
                        fill="var(--text-4)"
                      >
                        {line}
                      </text>
                    ))}
                  </g>

                  {/* Target chips */}
                  {obligation.targets.map((target, index) => {
                    const chipTop = targetsTop + index * (TARGET_H + 6);
                    return (
                      <g key={`chip-${obligation.id}-${target.id}`} aria-hidden="true">
                        <rect
                          x={COLS.target.x}
                          y={chipTop}
                          width={COLS.target.w}
                          height={TARGET_H}
                          rx="3"
                          fill="var(--surface-0)"
                          stroke={target.servesBothLanes ? "var(--accent)" : "var(--border-2)"}
                          strokeWidth={target.servesBothLanes ? "1.4" : "1"}
                        />
                        <text
                          x={COLS.target.x + 8}
                          y={chipTop + 15}
                          fontSize="11"
                          fontFamily="var(--font-mono)"
                          fill="var(--text-3)"
                        >
                          {target.kind.slice(0, 4)}
                        </text>
                        <text x={COLS.target.x + 44} y={chipTop + 15} fontSize="11" fill="var(--text-2)">
                          {target.label.length > 20 ? `${target.label.slice(0, 19)}...` : target.label}
                        </text>
                        {target.servesBothLanes ? (
                          <text
                            x={COLS.target.x + COLS.target.w - 8}
                            y={chipTop + 15}
                            textAnchor="end"
                            fontSize="11"
                            fontFamily="var(--font-mono)"
                            fill="var(--accent)"
                          >
                            shared
                          </text>
                        ) : null}
                      </g>
                    );
                  })}

                  {/* Evidence terminal marker */}
                  {obligation.terminalState === "evidenced" || obligation.terminalState === "stale" ? (
                    <g aria-hidden="true">
                      <rect
                        x={COLS.terminal.x}
                        y={oblTop + row.height / 2 - 15}
                        width={COLS.terminal.w}
                        height="30"
                        rx="4"
                        fill="var(--surface-0)"
                        stroke={TERMINAL_TONE[obligation.terminalState]}
                        strokeWidth="1.4"
                      />
                      <text
                        x={COLS.terminal.x + COLS.terminal.w / 2}
                        y={oblTop + row.height / 2 - 2}
                        textAnchor="middle"
                        fontSize="11"
                        fontFamily="var(--font-mono)"
                        fill={TERMINAL_TONE[obligation.terminalState]}
                      >
                        {TERMINAL_GLYPH[obligation.terminalState]} {obligation.evidenceRef ?? "evidence"}
                      </text>
                      <text
                        x={COLS.terminal.x + COLS.terminal.w / 2}
                        y={oblTop + row.height / 2 + 11}
                        textAnchor="middle"
                        fontSize="11"
                        fill="var(--text-4)"
                      >
                        {obligation.terminalState === "stale"
                          ? (obligation.evidenceAgeLabel ?? "stale")
                          : "current"}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="row row-4 row-wrap" aria-hidden="true" style={{ fontSize: "var(--text-xs)" }}>
        <span className="row row-2">
          <svg viewBox="0 0 40 16" style={{ width: "40px", height: "16px" }}>
            <path d="M0,3 C20,3 20,3 40,3 L40,13 C20,13 20,13 0,13 Z" fill="var(--cyan)" fillOpacity="0.15" stroke="var(--cyan)" strokeOpacity="0.34" strokeWidth="0.75" />
          </svg>
          <span className="muted">flow reaches evidence</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 40 16" style={{ width: "40px", height: "16px" }}>
            <path d="M0,3 C14,3 14,3 26,3 L26,13 C14,13 14,13 0,13 Z" fill="none" stroke="var(--red)" strokeWidth="1.2" strokeDasharray="3 2" />
            <line x1="26" y1="1" x2="26" y2="15" stroke="var(--red)" strokeWidth="2" />
          </svg>
          <span className="muted">flow stops at the control, no evidence</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 40 16" style={{ width: "40px", height: "16px" }}>
            <path d="M0,5 L18,7 L18,9 L0,11 Z" fill="var(--pink)" fillOpacity="0.2" stroke="var(--pink)" strokeWidth="1" strokeDasharray="3 2" />
            <rect x="20" y="3" width="12" height="10" fill="none" stroke="var(--pink)" strokeWidth="1.2" />
            <line x1="21" y1="4" x2="31" y2="12" stroke="var(--pink)" strokeWidth="1.2" />
            <line x1="31" y1="4" x2="21" y2="12" stroke="var(--pink)" strokeWidth="1.2" />
          </svg>
          <span className="muted">dead end, unowned gap</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 40 16" style={{ width: "40px", height: "16px" }}>
            {[0, 8, 16, 24, 32].map((offset) => (
              <line key={offset} x1={offset} y1="16" x2={offset + 12} y2="4" stroke="var(--border-2)" strokeWidth="1" />
            ))}
            <line x1="0" y1="1" x2="40" y2="1" stroke="var(--border-strong)" strokeWidth="2" />
            <line x1="0" y1="15" x2="40" y2="15" stroke="var(--border-strong)" strokeWidth="2" />
          </svg>
          <span className="muted">jurisdiction separator</span>
        </span>
      </div>

      {sharedTargets.length > 0 ? (
        <div className="card card-edge" data-tone="accent">
          <div className="stack stack-2">
            <span className="label" style={{ color: "var(--accent)" }}>
              Internal objects serving both lanes
            </span>
            <p style={{ fontSize: "var(--text-sm)" }}>
              Each of these is one internal object carrying obligations in both jurisdictions. It is
              drawn inside each lane rather than once across the separator, and its evidence must
              satisfy each lane separately.
            </p>
            <ul className="row row-2 row-wrap">
              {sharedTargets.map((entry) => (
                <li key={entry.target.id}>
                  <Chip tone="accent" title={entry.target.detail}>
                    {entry.target.id} {entry.target.label}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* The four-part coverage counter. Never one percentage. */}
      <div className="grid grid-4">
        {(Object.keys(TERMINAL_WORD) as LineageTerminalState[]).map((state) => (
          <div key={state} className="card card-edge" data-tone={toneForTerminal(state)}>
            <div className="stack stack-1">
              <span className="row row-2">
                <span className="mono" aria-hidden="true" style={{ color: TERMINAL_TONE[state] }}>
                  {TERMINAL_GLYPH[state]}
                </span>
                <span className="label">{TERMINAL_WORD[state]}</span>
              </span>
              <span className="display" style={{ fontSize: "var(--text-lg)", color: "var(--text-1)" }}>
                {counter[state]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <span className="regulatory-note">{REGULATORY_LABEL}</span>

      <div className="sr-only">
        <h4>Lineage, described</h4>
        <p>{REGULATORY_LABEL}</p>
        {layout.lanes.map((lane) => (
          <div key={`sr-lane-${lane.lane}`}>
            <h5>{lane.label}</h5>
            <p>
              {laneEntityScope(lane)}. No flow in this lane terminates in the other jurisdiction.
            </p>
            <ul>
              {lane.rows.map((row) => (
                <li key={`sr-${row.obligation.id}`}>
                  {describeObligation(row.obligation, publicationById.get(row.obligation.publicationId))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </figure>
  );
}

/* ==========================================================================
   Internals
   ========================================================================== */

function laneEntityScope(lane: LaneLayout): string {
  const scopes = new Set<string>();
  for (const row of lane.rows) scopes.add(row.obligation.entityScopeLabel);
  return `Entity scope in this lane: ${Array.from(scopes).sort().join(", ")}`;
}

function toneForTerminal(state: LineageTerminalState): "green" | "amber" | "red" | "pink" {
  if (state === "evidenced") return "green";
  if (state === "stale") return "amber";
  if (state === "unevidenced") return "red";
  return "pink";
}

function describeObligation(
  obligation: LineageObligation,
  publication: LineagePublication | undefined,
): string {
  const parts: string[] = [
    `Obligation ${obligation.id}, paragraph ${obligation.paragraphReference} of ${publication?.reference ?? obligation.publicationId}${publication ? ` (${publication.jurisdiction.toUpperCase()}, ${publication.issuer ?? "issuer not recorded"})` : ""}.`,
    `Entity scope ${obligation.entityScopeLabel}.`,
    obligation.summary,
  ];
  if (obligation.theme) parts.push(`Theme ${obligation.theme}.`);
  if (obligation.extractionConfidence !== undefined) {
    parts.push(`Extraction confidence ${Math.round(obligation.extractionConfidence * 100)} of 100.`);
  }
  parts.push(
    obligation.applicabilityDecision
      ? `Applicability decided: ${obligation.applicabilityDecision}.`
      : "Applicability has not been decided. That decision belongs to a human.",
  );
  if (obligation.targets.length === 0) {
    parts.push("No internal policy, process or control is mapped to this obligation.");
  } else {
    parts.push(
      `Mapped to ${obligation.targets.map((target) => `${target.kind} ${target.id} ${target.label}`).join(", ")}.`,
    );
  }
  parts.push(`Terminal state: ${TERMINAL_WORD[obligation.terminalState]}.`);
  if (obligation.terminalState === "stale" && obligation.evidenceAgeLabel) {
    parts.push(`Evidence age ${obligation.evidenceAgeLabel}.`);
  }
  if (obligation.isUnownedGap) {
    parts.push(`Unowned gap, terminating in a dead end. ${obligation.gapNote ?? ""}`);
  }
  if (obligation.ownerLabel) parts.push(`Owner ${obligation.ownerLabel}.`);
  if (obligation.stateChangedAtMoment) {
    parts.push(`State last changed at ${obligation.stateChangedAtMoment}.`);
  }
  parts.push(REGULATORY_LABEL);
  return parts.join(" ");
}

/**
 * The flow between the control column and the evidence column.
 *
 * An unevidenced obligation's ribbon is drawn as an outline that stops short of
 * the evidence column with a blunt cap. The reader sees the flow end, which is
 * the truthful picture: the mapping exists and the proof does not.
 */
function TerminalFlow({
  state,
  top,
  bottom,
}: {
  state: LineageTerminalState;
  top: number;
  bottom: number;
}) {
  const x0 = COLS.target.x + COLS.target.w;
  const x1 = COLS.terminal.x;
  if (state === "evidenced" || state === "stale") {
    return (
      <path
        aria-hidden="true"
        d={ribbon(x0, top + 4, bottom - 4, x1, (top + bottom) / 2 - 12, (top + bottom) / 2 + 12)}
        fill={TERMINAL_TONE[state]}
        fillOpacity="0.16"
        stroke={TERMINAL_TONE[state]}
        strokeOpacity="0.4"
        strokeWidth="0.9"
        strokeDasharray={state === "stale" ? "5 3" : "none"}
      />
    );
  }
  if (state === "unevidenced") {
    const stop = x0 + (x1 - x0) * 0.6;
    return (
      <g aria-hidden="true">
        <path
          d={ribbon(x0, top + 4, bottom - 4, stop, (top + bottom) / 2 - 8, (top + bottom) / 2 + 8)}
          fill="none"
          stroke="var(--red)"
          strokeWidth="1.1"
          strokeDasharray="3 2"
        />
        <line x1={stop} y1={(top + bottom) / 2 - 12} x2={stop} y2={(top + bottom) / 2 + 12} stroke="var(--red)" strokeWidth="2.4" />
        <text x={stop + 5} y={(top + bottom) / 2 + 4} fontSize="11" fontFamily="var(--font-mono)" fill="var(--red)">
          no evidence
        </text>
      </g>
    );
  }
  return null;
}

/**
 * A dead end: the terminal state an unowned obligation deserves.
 *
 * It tapers rather than fading, and it ends in a closed square with a cross,
 * so a reader cannot mistake it for a flow that continues off screen.
 */
function DeadEnd({ top, height }: { top: number; height: number }) {
  const x0 = COLS.obligation.x + COLS.obligation.w;
  const centre = top + height / 2;
  const tipX = x0 + 74;
  return (
    <g aria-hidden="true">
      <path
        d={`M${x0},${centre - 11} L${tipX - 16},${centre - 4} L${tipX - 16},${centre + 4} L${x0},${centre + 11} Z`}
        fill="var(--pink)"
        fillOpacity="0.2"
        stroke="var(--pink)"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      <rect x={tipX - 16} y={centre - 9} width="18" height="18" fill="var(--bg)" stroke="var(--pink)" strokeWidth="1.5" />
      <line x1={tipX - 13} y1={centre - 6} x2={tipX - 1} y2={centre + 6} stroke="var(--pink)" strokeWidth="1.5" />
      <line x1={tipX - 1} y1={centre - 6} x2={tipX - 13} y2={centre + 6} stroke="var(--pink)" strokeWidth="1.5" />
      <text x={tipX + 8} y={centre - 1} fontSize="11" fontFamily="var(--font-mono)" fill="var(--pink)" letterSpacing="0.06em">
        DEAD END
      </text>
      <text x={tipX + 8} y={centre + 12} fontSize="11" fill="var(--text-3)">
        no owner, no control
      </text>
    </g>
  );
}

export default ObligationLineage;
