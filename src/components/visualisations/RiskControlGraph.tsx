"use client";

/**
 * The living process, risk and control graph.
 *
 * What it shows: a layered left-to-right read of the control environment.
 * Processes expose risks, controls mitigate them, indicators indicate them.
 * Every edge is labelled by kind, because "connected" is not a relationship.
 *
 * The design decision that matters: the first line and second line disagree
 * about this control environment, and that disagreement is the whole story of
 * the day. So divergence is not a footnote on a card. A divergent control is
 * drawn as TWO stacked assessment bands inside one node, each with its own
 * segmented effectiveness meter and its own named owner, and it emits TWO
 * mitigates edges to the same risk at different stroke widths. The width of a
 * mitigates edge IS the claimed reduction, so a fork of one thick edge and one
 * thin edge into the same risk is the argument, drawn. The same treatment
 * appears on the risk card, where the two residual positions sit on one
 * appetite scale joined by a bracket.
 *
 * Nothing is averaged. Averaging a divergence is how disagreements get
 * resolved by dilution, and this component exists to make that impossible.
 */

import { useMemo, useState } from "react";
import { Chip, ObjectId } from "@/components/evidence/primitives";
import {
  CONTROL_EFFECTIVENESS_LABELS,
  type ControlEffectiveness,
} from "@/domain/nfr/calculators";

/* ==========================================================================
   Props
   ========================================================================== */

export type GraphEdgeKind = "exposes" | "mitigates" | "indicates";

export interface ProcessNodeView {
  id: string;
  label: string;
  code?: string;
  /** Monthly volume and manual touch rate, shown as context in the tooltip. */
  detail?: string;
  riskIds: string[];
}

export interface LineAssessment {
  /** For example "1LoD" or "2LoD". */
  lineLabel: string;
  /** Residual position on the group 1 to 25 scale. */
  score: number;
  ownerLabel?: string;
  rationale?: string;
  assessedOn?: string;
}

export interface RiskNodeView {
  id: string;
  label: string;
  taxonomyL2?: string;
  ownerLabel?: string;
  /** Inherent position on the group 1 to 25 scale. */
  inherentScore?: number;
  /** The appetite ceiling drawn as a line across the scale, not a colour band. */
  appetiteCeilingScore?: number;
  appetiteStatement?: string;
  appetitePosition?: "within" | "at-limit" | "outside";
  /** Single agreed residual position. Used when the two lines agree. */
  residualScore?: number;
  /** The two lines' positions. When they differ the card renders both. */
  firstLine?: LineAssessment;
  secondLine?: LineAssessment;
  /** Set when the risk has actually occurred. Deliberately a small marker. */
  materialisationNote?: string;
}

export interface ControlNodeView {
  id: string;
  reference: string;
  title: string;
  riskIds: string[];
  ownerLabel?: string;
  isKeyControl?: boolean;
  nature?: string;
  automation?: string;
  /** The recorded, second line owned effectiveness. */
  currentEffectiveness: ControlEffectiveness | string;
  /** The first line owner's own assessment. Divergence is computed from these two. */
  firstLineEffectiveness?: ControlEffectiveness | string;
  firstLineOwnerLabel?: string;
  secondLineOwnerLabel?: string;
  lastTestedOn?: string;
  /** Evidence reference behind the second line position, shown in the tooltip. */
  evidenceRef?: string;
}

export interface IndicatorNodeView {
  id: string;
  reference: string;
  name: string;
  riskIds: string[];
  status: "green" | "amber" | "red" | string;
  currentValue?: number;
  unit?: string;
  amberThreshold?: number;
  redThreshold?: number;
}

export interface RiskControlGraphProps {
  processes: ProcessNodeView[];
  risks: RiskNodeView[];
  controls: ControlNodeView[];
  indicators?: IndicatorNodeView[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  heading?: string;
  /**
   * Nodes a recent signal reached.
   *
   * Drawn as a 2px edge marker, the same device the application uses on a list
   * row, so "this is what moved" means one thing in both places. Omitted by
   * default, which is the previous behaviour exactly: no marker is drawn and
   * nothing about the layout changes.
   */
  changedNodeIds?: readonly string[];
  /** Suppresses the subject heading when the caller already renders it. */
  hideHeading?: boolean;
  /** The marker's accessible name. Passed in so it can be German. */
  changedLabel?: string;
}

/* ==========================================================================
   Layout constants. A simple layered algorithm, computed here rather than
   delegated, so the output is deterministic and reviewable.
   ========================================================================== */

const VIEW_W = 1020;
const TOP = 58;
const BOTTOM_PAD = 26;

const LANES = {
  process: { x: 20, w: 178 },
  risk: { x: 352, w: 256 },
  control: { x: 742, w: 258 },
};

const PROCESS_H = 58;
const PROCESS_GAP = 26;
/*
 * 130 rather than 118.
 *
 * The inherent score label and the residual position label were both drawn at
 * `barY + 22`, each centred on its own marker. That is fine while the two
 * scores are far apart and unreadable when they are close, which is the
 * interesting case: RSK-0211 is inherent 16 against residual 12 and the two
 * labels merged into "residual 12nh 16". The labels now sit on two baselines
 * and the card is twelve pixels taller to hold them.
 */
const RISK_H = 130;
const RISK_GAP = 34;
const INDICATOR_H = 24;
const INDICATOR_GAP = 5;
const CONTROL_H = 66;
const CONTROL_H_DIVERGENT = 100;
const CONTROL_GAP = 20;

const MAX_SCORE = 25;

/** Effectiveness band index, which drives the segmented meter and edge width. */
const EFFECTIVENESS_BAND: Record<string, number> = {
  "not-effective": 0,
  "partially-effective": 1,
  "largely-effective": 2,
  "fully-effective": 3,
};

function bandOf(effectiveness: string): number {
  return EFFECTIVENESS_BAND[effectiveness] ?? -1;
}

function effectivenessLabel(effectiveness: string): string {
  const entry = CONTROL_EFFECTIVENESS_LABELS[effectiveness as ControlEffectiveness];
  return entry ? entry.en : effectiveness.replace(/-/g, " ");
}

/** Stroke width IS the claimed reduction. An unassessed control claims nothing. */
function mitigationWidth(effectiveness: string): number {
  const band = bandOf(effectiveness);
  if (band < 0) return 1;
  return 1.2 + band * 1.15;
}

function effectivenessTone(effectiveness: string): string {
  const band = bandOf(effectiveness);
  if (band < 0) return "var(--text-4)";
  if (band >= 3) return "var(--green)";
  if (band === 2) return "var(--cyan)";
  if (band === 1) return "var(--amber)";
  return "var(--red)";
}

/** Deterministic text wrapping by character budget. No measurement, no layout thrash. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current.length > 0) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current.length > 0) lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    const consumed = lines.join(" ").split(/\s+/).length;
    if (last !== undefined && consumed < words.length) {
      lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 3))}...`;
    }
  }
  return lines;
}

/* ==========================================================================
   Placement
   ========================================================================== */

interface Placed<T> {
  node: T;
  y: number;
  h: number;
}

function stackColumn<T>(items: T[], heightOf: (item: T) => number, gap: number): Array<Placed<T>> {
  let cursor = 0;
  return items.map((item) => {
    const h = heightOf(item);
    const placed = { node: item, y: cursor, h };
    cursor += h + gap;
    return placed;
  });
}

function columnHeight<T>(placed: Array<Placed<T>>, gap: number): number {
  if (placed.length === 0) return 0;
  const total = placed.reduce((sum, item) => sum + item.h + gap, 0);
  return total - gap;
}

/* ==========================================================================
   Component
   ========================================================================== */

export function RiskControlGraph({
  processes,
  risks,
  controls,
  indicators = [],
  selectedNodeId = null,
  onSelectNode,
  heading = "Process, risk and control",
  changedNodeIds,
  changedLabel = "Changed recently",
  hideHeading = false,
}: RiskControlGraphProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  /* Keyed on the joined string rather than the array, because a caller that
     rebuilds the array on every render would otherwise rebuild this set on
     every render and defeat the memo. */
  const changedKey = (changedNodeIds ?? []).join("|");
  const changedNodes = useMemo(
    () => new Set(changedKey.length === 0 ? [] : changedKey.split("|")),
    [changedKey],
  );

  const layout = useMemo(() => {
    const sortedProcesses = [...processes].sort((a, b) => a.id.localeCompare(b.id));
    const sortedRisks = [...risks].sort((a, b) => a.id.localeCompare(b.id));
    const sortedControls = [...controls].sort((a, b) => a.reference.localeCompare(b.reference));

    const indicatorsByRisk = new Map<string, IndicatorNodeView[]>();
    for (const indicator of [...indicators].sort((a, b) => a.reference.localeCompare(b.reference))) {
      for (const riskId of indicator.riskIds) {
        const list = indicatorsByRisk.get(riskId) ?? [];
        list.push(indicator);
        indicatorsByRisk.set(riskId, list);
      }
    }

    // A risk block owns its indicators, so indicators stay attached to the risk
    // they indicate rather than forming a fourth column nobody can read.
    const riskPlaced = stackColumn(
      sortedRisks,
      (risk) => {
        const count = (indicatorsByRisk.get(risk.id) ?? []).length;
        return RISK_H + (count > 0 ? 8 + count * (INDICATOR_H + INDICATOR_GAP) : 0);
      },
      RISK_GAP,
    );
    const processPlaced = stackColumn(sortedProcesses, () => PROCESS_H, PROCESS_GAP);
    const controlPlaced = stackColumn(
      sortedControls,
      (control) => (isDivergent(control) ? CONTROL_H_DIVERGENT : CONTROL_H),
      CONTROL_GAP,
    );

    const riskColH = columnHeight(riskPlaced, RISK_GAP);
    const processColH = columnHeight(processPlaced, PROCESS_GAP);
    const controlColH = columnHeight(controlPlaced, CONTROL_GAP);
    const contentH = Math.max(riskColH, processColH, controlColH, 200);

    /*
     * Each short column is pulled towards the vertical centre of the tallest
     * one, which keeps the edge bundle roughly horizontal and avoids long
     * diagonal sweeps. The offset is CAPPED, and the cap is the fix for a real
     * defect rather than a tuning preference.
     *
     * Uncapped centring is correct when the columns are a similar height and
     * wrong when they are not. This graph routinely has 24 controls against 8
     * processes and 9 risks, which makes the canvas roughly two thousand
     * pixels tall and places the two short columns at its midpoint. The first
     * screenful then shows the processes and risks headers with nothing under
     * them, and a reader reasonably concludes the graph failed to load. It
     * looked that way in both interfaces, at every viewport.
     *
     * 160px keeps the short columns inside the first screen while retaining
     * most of the benefit: the edges to the upper controls stay near
     * horizontal, and the edges to the lower ones fan out, which reads as a
     * fan rather than as a tangle.
     */
    const MAX_CENTRING_OFFSET = 160;
    const offset = (colH: number) =>
      TOP + Math.min(MAX_CENTRING_OFFSET, Math.max(0, (contentH - colH) / 2));
    const riskOffset = offset(riskColH);
    const processOffset = offset(processColH);
    const controlOffset = offset(controlColH);

    return {
      viewH: TOP + contentH + BOTTOM_PAD,
      indicatorsByRisk,
      processes: processPlaced.map((p) => ({ ...p, y: p.y + processOffset })),
      risks: riskPlaced.map((p) => ({ ...p, y: p.y + riskOffset })),
      controls: controlPlaced.map((p) => ({ ...p, y: p.y + controlOffset })),
    };
  }, [processes, risks, controls, indicators]);

  const riskY = useMemo(
    () => new Map(layout.risks.map((item) => [item.node.id, item.y])),
    [layout.risks],
  );

  /* Edges are derived, not supplied, so a node can never claim a relationship
     the underlying records do not contain. */
  const edges = useMemo(() => {
    const list: Array<{
      id: string;
      kind: GraphEdgeKind;
      fromId: string;
      toId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      stroke: string;
      dash: string;
      lineLabel?: string;
    }> = [];

    for (const placed of layout.processes) {
      for (const riskId of placed.node.riskIds) {
        const targetY = riskY.get(riskId);
        if (targetY === undefined) continue;
        list.push({
          id: `exposes-${placed.node.id}-${riskId}`,
          kind: "exposes",
          fromId: placed.node.id,
          toId: riskId,
          x1: LANES.process.x + LANES.process.w,
          y1: placed.y + PROCESS_H / 2,
          x2: LANES.risk.x,
          y2: targetY + 52,
          width: 1.5,
          stroke: "var(--cyan)",
          dash: "none",
        });
      }
    }

    for (const placed of layout.controls) {
      const control = placed.node;
      const divergent = isDivergent(control);
      for (const riskId of control.riskIds) {
        const targetY = riskY.get(riskId);
        if (targetY === undefined) continue;
        if (divergent && control.firstLineEffectiveness) {
          // Two claims, two edges. The fork is the finding.
          list.push({
            id: `mitigates-1lod-${control.id}-${riskId}`,
            kind: "mitigates",
            fromId: control.id,
            toId: riskId,
            x1: LANES.control.x,
            y1: placed.y + 44,
            x2: LANES.risk.x + LANES.risk.w,
            y2: targetY + 44,
            width: mitigationWidth(control.firstLineEffectiveness),
            stroke: effectivenessTone(control.firstLineEffectiveness),
            dash: "none",
            lineLabel: "1LoD",
          });
          list.push({
            id: `mitigates-2lod-${control.id}-${riskId}`,
            kind: "mitigates",
            fromId: control.id,
            toId: riskId,
            x1: LANES.control.x,
            y1: placed.y + 78,
            x2: LANES.risk.x + LANES.risk.w,
            y2: targetY + 64,
            width: mitigationWidth(control.currentEffectiveness),
            stroke: effectivenessTone(control.currentEffectiveness),
            dash: "6 4",
            lineLabel: "2LoD",
          });
        } else {
          list.push({
            id: `mitigates-${control.id}-${riskId}`,
            kind: "mitigates",
            fromId: control.id,
            toId: riskId,
            x1: LANES.control.x,
            y1: placed.y + placed.h / 2,
            x2: LANES.risk.x + LANES.risk.w,
            y2: targetY + 54,
            width: mitigationWidth(control.currentEffectiveness),
            stroke: effectivenessTone(control.currentEffectiveness),
            dash: bandOf(control.currentEffectiveness) < 0 ? "3 3" : "none",
          });
        }
      }
    }

    return list;
  }, [layout.processes, layout.controls, riskY]);

  const connected = useMemo(() => {
    const target = activeId ?? selectedNodeId;
    if (target === null) return null;
    const ids = new Set<string>([target]);
    for (const edge of edges) {
      if (edge.fromId === target) ids.add(edge.toId);
      if (edge.toId === target) ids.add(edge.fromId);
    }
    for (const [riskId, list] of layout.indicatorsByRisk) {
      if (riskId === target) list.forEach((item) => ids.add(item.id));
      if (list.some((item) => item.id === target)) ids.add(riskId);
    }
    return ids;
  }, [activeId, selectedNodeId, edges, layout.indicatorsByRisk]);

  const divergentControls = controls.filter(isDivergent);
  const divergentRisks = risks.filter(hasLineDivergence);
  const outsideAppetite = risks.filter((risk) => risk.appetitePosition === "outside");

  const ariaLabel = [
    `Layered process, risk and control graph.`,
    `${processes.length} processes expose ${risks.length} risks, mitigated by ${controls.length} controls, with ${indicators.length} indicators attached.`,
    divergentControls.length > 0
      ? `${divergentControls.length} controls carry a first line and second line divergence on effectiveness.`
      : `No control effectiveness divergence is recorded.`,
    divergentRisks.length > 0
      ? `${divergentRisks.length} risks carry two different residual positions.`
      : "",
    `${outsideAppetite.length} risks are recorded outside appetite.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <figure className="stack stack-4" style={{ margin: 0 }}>
      <figcaption className="row row-3 row-wrap row-between">
        {/*
          * The heading is suppressed when the caller already shows it.
          *
          * A V2 role workspace renders the subject as its object title
          * immediately above this figure, so repeating it here produced the
          * same line twice, eighty pixels apart. The chips are never
          * suppressed: they are the figure's own summary of what it contains
          * and they have no equivalent above it.
          */}
        {hideHeading ? <span /> : <span className="panel-title">{heading}</span>}
        <div className="row row-2 row-wrap">
          {divergentControls.length > 0 ? (
            <Chip tone="pink">{divergentControls.length} control divergence</Chip>
          ) : null}
          {divergentRisks.length > 0 ? (
            <Chip tone="pink">{divergentRisks.length} residual divergence</Chip>
          ) : null}
          {outsideAppetite.length > 0 ? (
            <Chip tone="red">{outsideAppetite.length} outside appetite</Chip>
          ) : null}
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW_W} ${layout.viewH}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={ariaLabel}
        style={{ width: "100%", height: "auto" }}
      >
        <defs>
          {/* One marker serves both directions: orient="auto" rotates it onto the
              path tangent, so an arrow drawn towards positive x always points at
              the path's end, including on the right-to-left mitigates edges. */}
          <marker id="rcg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0L8,4L0,8Z" fill="var(--border-strong)" />
          </marker>
        </defs>

        {/* Lane headers, so the layering is named rather than inferred. */}
        {(
          [
            ["process", "1. Processes", LANES.process],
            ["risk", "2. Risks", LANES.risk],
            ["control", "3. Controls", LANES.control],
          ] as const
        ).map(([key, label, lane]) => (
          <g key={key} aria-hidden="true">
            <text
              x={lane.x}
              y={26}
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="var(--text-4)"
              letterSpacing="0.09em"
            >
              {label.toUpperCase()}
            </text>
            <line x1={lane.x} y1={36} x2={lane.x + lane.w} y2={36} stroke="var(--border-1)" strokeWidth="1" />
          </g>
        ))}

        {/* Edges */}
        <g>
          {edges.map((edge) => {
            const dim = connected !== null && !(connected.has(edge.fromId) && connected.has(edge.toId));
            const dx = Math.max(60, Math.abs(edge.x2 - edge.x1) * 0.42);
            const forward = edge.x2 > edge.x1;
            const c1x = forward ? edge.x1 + dx : edge.x1 - dx;
            const c2x = forward ? edge.x2 - dx : edge.x2 + dx;
            const path = `M${edge.x1},${edge.y1} C${c1x},${edge.y1} ${c2x},${edge.y2} ${edge.x2},${edge.y2}`;
            // Cubic Bezier midpoint at t = 0.5 reduces to (p0 + 3c1 + 3c2 + p3) / 8.
            const midX = (edge.x1 + 3 * c1x + 3 * c2x + edge.x2) / 8;
            const midY = (edge.y1 + 3 * edge.y1 + 3 * edge.y2 + edge.y2) / 8;
            const label = edge.lineLabel ? `${edge.kind} (${edge.lineLabel})` : edge.kind;
            const labelWidth = label.length * 6.2 + 10;
            return (
              <g key={edge.id} opacity={dim ? 0.12 : 1} aria-hidden="true">
                <path
                  d={path}
                  fill="none"
                  stroke={edge.stroke}
                  strokeWidth={edge.width}
                  strokeDasharray={edge.dash}
                  markerEnd="url(#rcg-arrow)"
                />
                <rect
                  x={midX - labelWidth / 2}
                  y={midY - 8}
                  width={labelWidth}
                  height="15"
                  rx="3"
                  fill="var(--bg)"
                  stroke="var(--border-1)"
                  strokeWidth="0.75"
                />
                <text
                  x={midX}
                  y={midY + 3}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill="var(--text-4)"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Processes */}
        {layout.processes.map(({ node, y }) => (
          <GraphNode
            key={node.id}
            id={node.id}
            ariaLabel={`Process ${node.code ?? node.id}, ${node.label}. ${node.detail ?? ""}`}
            dim={connected !== null && !connected.has(node.id)}
            focused={(activeId ?? selectedNodeId) === node.id}
            x={LANES.process.x}
            y={y}
            w={LANES.process.w}
            h={PROCESS_H}
            onSelectNode={onSelectNode}
            setActive={setActiveId}
            changed={changedNodes.has(node.id)}
            changedLabel={changedLabel}
          >
            <rect
              x={LANES.process.x}
              y={y}
              width={LANES.process.w}
              height={PROCESS_H}
              rx="6"
              fill="var(--surface-1)"
              stroke="var(--cyan-edge)"
              strokeWidth="1.5"
            />
            <rect x={LANES.process.x} y={y} width="3" height={PROCESS_H} fill="var(--cyan)" />
            <text
              x={LANES.process.x + 12}
              y={y + 20}
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="var(--cyan)"
            >
              {node.code ?? node.id}
            </text>
            {wrapText(node.label, 24, 2).map((line, index) => (
              <text
                key={index}
                x={LANES.process.x + 12}
                y={y + 36 + index * 14}
                fontSize="12"
                fill="var(--text-2)"
              >
                {line}
              </text>
            ))}
          </GraphNode>
        ))}

        {/* Risks, each with its indicators attached beneath it */}
        {layout.risks.map(({ node, y }) => {
          const attached = layout.indicatorsByRisk.get(node.id) ?? [];
          const dim = connected !== null && !connected.has(node.id);
          return (
            <g key={node.id}>
              <GraphNode
                id={node.id}
                ariaLabel={describeRisk(node)}
                dim={dim}
                focused={(activeId ?? selectedNodeId) === node.id}
                x={LANES.risk.x}
                y={y}
                w={LANES.risk.w}
                h={RISK_H}
                onSelectNode={onSelectNode}
                setActive={setActiveId}
                changed={changedNodes.has(node.id)}
                changedLabel={changedLabel}
              >
                <RiskCard node={node} y={y} />
              </GraphNode>

              {/* Indicator attachment: a short dotted stem labelled by kind. */}
              {attached.map((indicator, index) => {
                const chipY = y + RISK_H + 8 + index * (INDICATOR_H + INDICATOR_GAP);
                const indicatorDim = connected !== null && !connected.has(indicator.id);
                return (
                  <g key={indicator.id} opacity={indicatorDim ? 0.2 : 1}>
                    <path
                      d={`M${LANES.risk.x + 18},${y + RISK_H} V${chipY + INDICATOR_H / 2} H${LANES.risk.x + 26}`}
                      fill="none"
                      stroke="var(--border-2)"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                    />
                    {index === 0 ? (
                      <text
                        x={LANES.risk.x + 22}
                        y={y + RISK_H + 4}
                        fontSize="11"
                        fontFamily="var(--font-mono)"
                        fill="var(--text-4)"
                      >
                        indicates
                      </text>
                    ) : null}
                    <GraphNode
                      id={indicator.id}
                      ariaLabel={describeIndicator(indicator)}
                      dim={indicatorDim}
                      focused={(activeId ?? selectedNodeId) === indicator.id}
                      x={LANES.risk.x + 26}
                      y={chipY}
                      w={LANES.risk.w - 26}
                      h={INDICATOR_H}
                      onSelectNode={onSelectNode}
                      setActive={setActiveId}
                      changed={changedNodes.has(indicator.id)}
                      changedLabel={changedLabel}
                    >
                      <IndicatorChip indicator={indicator} x={LANES.risk.x + 26} y={chipY} w={LANES.risk.w - 26} />
                    </GraphNode>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Controls */}
        {layout.controls.map(({ node, y, h }) => (
          <GraphNode
            key={node.id}
            id={node.id}
            ariaLabel={describeControl(node)}
            dim={connected !== null && !connected.has(node.id)}
            focused={(activeId ?? selectedNodeId) === node.id}
            x={LANES.control.x}
            y={y}
            w={LANES.control.w}
            h={h}
            onSelectNode={onSelectNode}
            setActive={setActiveId}
            changed={changedNodes.has(node.id)}
            changedLabel={changedLabel}
          >
            <ControlCard node={node} y={y} h={h} />
          </GraphNode>
        ))}
      </svg>

      {/* Legend: edge kinds by dash pattern and meter by segment count, not by hue. */}
      <div className="row row-4 row-wrap" aria-hidden="true" style={{ fontSize: "var(--text-xs)" }}>
        <span className="row row-2">
          <svg viewBox="0 0 30 8" style={{ width: "30px", height: "8px" }}>
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--cyan)" strokeWidth="1.5" />
          </svg>
          <span className="muted">exposes</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 30 8" style={{ width: "30px", height: "8px" }}>
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--green)" strokeWidth="3.5" />
          </svg>
          <span className="muted">mitigates, width is the claimed reduction</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 30 8" style={{ width: "30px", height: "8px" }}>
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--amber)" strokeWidth="2" strokeDasharray="6 4" />
          </svg>
          <span className="muted">mitigates, second line position</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 30 8" style={{ width: "30px", height: "8px" }}>
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--border-2)" strokeWidth="1" strokeDasharray="2 3" />
          </svg>
          <span className="muted">indicates</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 34 10" style={{ width: "34px", height: "10px" }}>
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={i * 8.5}
                y="2"
                width="7"
                height="6"
                fill={i < 2 ? "var(--text-2)" : "none"}
                stroke="var(--border-2)"
                strokeWidth="0.75"
              />
            ))}
          </svg>
          <span className="muted">effectiveness, 0 to 4 segments filled</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 22 16" style={{ width: "22px", height: "16px" }}>
            <line x1="2" y1="8" x2="20" y2="8" stroke="var(--border-2)" strokeWidth="4" />
            <line x1="12" y1="2" x2="12" y2="14" stroke="var(--text-1)" strokeWidth="1.5" />
          </svg>
          <span className="muted">appetite line on the residual scale</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 22 16" style={{ width: "22px", height: "16px" }}>
            <rect x="2" y="5" width="6" height="6" fill="var(--text-1)" />
            <circle cx="17" cy="8" r="3.4" fill="var(--pink)" />
            <path d="M5,3 H17" stroke="var(--pink)" strokeWidth="1" />
          </svg>
          <span className="muted">1LoD square, 2LoD circle, bracket means they disagree</span>
        </span>
      </div>

      {divergentControls.length > 0 ? (
        <div className="card card-edge" data-tone="red">
          <div className="stack stack-2">
            <span className="label" style={{ color: "var(--pink)" }}>
              Where the two lines do not agree
            </span>
            <ul className="stack stack-2">
              {divergentControls.map((control) => (
                <li key={control.id} className="row row-2 row-wrap" style={{ fontSize: "var(--text-sm)" }}>
                  <ObjectId id={control.reference} />
                  <span>{control.title}</span>
                  <Chip tone="cyan">
                    1LoD {effectivenessLabel(control.firstLineEffectiveness ?? "not-assessed")}
                    {control.firstLineOwnerLabel ? ` (${control.firstLineOwnerLabel})` : ""}
                  </Chip>
                  <Chip tone="amber">
                    2LoD {effectivenessLabel(String(control.currentEffectiveness))}
                    {control.secondLineOwnerLabel ? ` (${control.secondLineOwnerLabel})` : ""}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="sr-only">
        <h4>Graph content, described</h4>
        <h5>Processes</h5>
        <ul>
          {processes.map((process) => (
            <li key={`sr-${process.id}`}>
              Process {process.code ?? process.id}, {process.label}. Exposes{" "}
              {process.riskIds.length} risks. {process.detail ?? ""}
            </li>
          ))}
        </ul>
        <h5>Risks</h5>
        <ul>
          {risks.map((risk) => (
            <li key={`sr-${risk.id}`}>{describeRisk(risk)}</li>
          ))}
        </ul>
        <h5>Controls</h5>
        <ul>
          {controls.map((control) => (
            <li key={`sr-${control.id}`}>{describeControl(control)}</li>
          ))}
        </ul>
        <h5>Indicators</h5>
        <ul>
          {indicators.map((indicator) => (
            <li key={`sr-${indicator.id}`}>{describeIndicator(indicator)}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

/* ==========================================================================
   Internals
   ========================================================================== */

function isDivergent(control: ControlNodeView): boolean {
  return (
    typeof control.firstLineEffectiveness === "string" &&
    control.firstLineEffectiveness.length > 0 &&
    control.firstLineEffectiveness !== control.currentEffectiveness
  );
}

function hasLineDivergence(risk: RiskNodeView): boolean {
  return (
    risk.firstLine !== undefined &&
    risk.secondLine !== undefined &&
    risk.firstLine.score !== risk.secondLine.score
  );
}

function describeRisk(risk: RiskNodeView): string {
  const parts: string[] = [`Risk ${risk.id}, ${risk.label}.`];
  if (risk.taxonomyL2) parts.push(`Taxonomy ${risk.taxonomyL2}.`);
  if (risk.ownerLabel) parts.push(`Owner ${risk.ownerLabel}.`);
  if (risk.inherentScore !== undefined) parts.push(`Inherent position ${risk.inherentScore} of 25.`);
  if (hasLineDivergence(risk) && risk.firstLine && risk.secondLine) {
    parts.push(
      `Two residual positions are recorded and they are not reconciled: ${risk.firstLine.lineLabel} ${risk.firstLine.score}${risk.firstLine.ownerLabel ? ` by ${risk.firstLine.ownerLabel}` : ""}, and ${risk.secondLine.lineLabel} ${risk.secondLine.score}${risk.secondLine.ownerLabel ? ` by ${risk.secondLine.ownerLabel}` : ""}.`,
    );
  } else if (risk.residualScore !== undefined) {
    parts.push(`Residual position ${risk.residualScore} of 25.`);
  }
  if (risk.appetiteCeilingScore !== undefined) {
    parts.push(`Appetite ceiling ${risk.appetiteCeilingScore} of 25.`);
  }
  if (risk.appetitePosition) parts.push(`Recorded appetite position: ${risk.appetitePosition}.`);
  if (risk.appetiteStatement) parts.push(risk.appetiteStatement);
  if (risk.materialisationNote) parts.push(`Materialised: ${risk.materialisationNote}`);
  return parts.join(" ");
}

function describeControl(control: ControlNodeView): string {
  const parts: string[] = [`Control ${control.reference}, ${control.title}.`];
  if (control.isKeyControl) parts.push("Designated a key control.");
  if (control.nature) parts.push(`${control.nature}.`);
  if (control.automation) parts.push(`${control.automation.replace(/-/g, " ")}.`);
  if (isDivergent(control)) {
    parts.push(
      `Effectiveness is disputed. First line records ${effectivenessLabel(control.firstLineEffectiveness ?? "")}${control.firstLineOwnerLabel ? ` (${control.firstLineOwnerLabel})` : ""}. Second line records ${effectivenessLabel(String(control.currentEffectiveness))}${control.secondLineOwnerLabel ? ` (${control.secondLineOwnerLabel})` : ""}. The two positions are shown separately and are not averaged.`,
    );
  } else {
    parts.push(`Effectiveness ${effectivenessLabel(String(control.currentEffectiveness))}.`);
  }
  if (control.lastTestedOn) parts.push(`Last tested ${control.lastTestedOn}.`);
  if (control.evidenceRef) parts.push(`Evidence ${control.evidenceRef}.`);
  parts.push(`Mitigates ${control.riskIds.length} risks.`);
  return parts.join(" ");
}

function describeIndicator(indicator: IndicatorNodeView): string {
  const value =
    indicator.currentValue !== undefined
      ? ` Current value ${indicator.currentValue}${indicator.unit ? ` ${indicator.unit}` : ""}.`
      : "";
  return `Indicator ${indicator.reference}, ${indicator.name}. Status ${indicator.status}.${value}`;
}

/**
 * A focusable graph node. Focus is drawn, not inherited, because a CSS
 * box-shadow does not paint on SVG geometry.
 */
function GraphNode({
  id,
  ariaLabel,
  dim,
  focused,
  x,
  y,
  w,
  h,
  onSelectNode,
  setActive,
  changed = false,
  changedLabel = "Changed recently",
  children,
}: {
  id: string;
  ariaLabel: string;
  dim: boolean;
  focused: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  onSelectNode?: (nodeId: string) => void;
  setActive: (nodeId: string | null) => void;
  changed?: boolean;
  changedLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <g
      tabIndex={0}
      role="button"
      /* The marker is geometry, so without this a screen reader user would
         never learn that the node moved. */
      aria-label={changed ? `${ariaLabel} ${changedLabel}.` : ariaLabel}
      data-changed={changed ? true : undefined}
      opacity={dim ? 0.16 : 1}
      style={{ cursor: onSelectNode ? "pointer" : "default", outline: "none" }}
      onMouseEnter={() => setActive(id)}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive(id)}
      onBlur={() => setActive(null)}
      onClick={() => onSelectNode?.(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectNode?.(id);
        }
      }}
    >
      {focused ? (
        <rect
          x={x - 4}
          y={y - 4}
          width={w + 8}
          height={h + 8}
          rx="8"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
      ) : null}
      {/* A 2px edge, never a fill. The node already carries effectiveness or
          appetite in its own tone, and recency must not compete with it. */}
      {changed ? (
        <rect
          x={x - 7}
          y={y + 2}
          width="2"
          height={Math.max(8, h - 4)}
          rx="1"
          fill="var(--accent)"
        />
      ) : null}
      {children}
    </g>
  );
}

function RiskCard({ node, y }: { node: RiskNodeView; y: number }) {
  const x = LANES.risk.x;
  const w = LANES.risk.w;
  const divergent = hasLineDivergence(node);
  const outside = node.appetitePosition === "outside";

  const barX = x + 14;
  const barW = w - 28;
  const barY = y + 86;
  const scoreToX = (score: number) => barX + (Math.min(MAX_SCORE, Math.max(0, score)) / MAX_SCORE) * barW;

  const firstX = node.firstLine ? scoreToX(node.firstLine.score) : null;
  const secondX = node.secondLine ? scoreToX(node.secondLine.score) : null;
  const singleX = node.residualScore !== undefined ? scoreToX(node.residualScore) : null;

  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={RISK_H}
        rx="6"
        fill="var(--surface-1)"
        stroke={divergent ? "var(--pink)" : outside ? "var(--red)" : "var(--border-1)"}
        strokeWidth={divergent || outside ? "1.75" : "1"}
      />
      <rect x={x} y={y} width="3" height={RISK_H} fill={outside ? "var(--red)" : "var(--border-2)"} />

      <text x={x + 14} y={y + 19} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-4)">
        {node.id}
      </text>
      {divergent ? (
        <>
          <rect x={x + w - 92} y={y + 8} width="78" height="15" rx="3" fill="var(--pink-tint)" stroke="var(--pink)" strokeWidth="1" />
          <text
            x={x + w - 53}
            y={y + 19}
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill="var(--pink)"
          >
            2 POSITIONS
          </text>
        </>
      ) : outside ? (
        <>
          {/*
            * 118 wide, not 92. "OUTSIDE APPETITE" is sixteen monospaced
            * characters at 11px, which is about 106px, so the text drew
            * through both ends of a 92px pill.
            */}
          <rect x={x + w - 126} y={y + 8} width="118" height="15" rx="3" fill="var(--red-tint)" stroke="var(--red)" strokeWidth="1" />
          <text
            x={x + w - 67}
            y={y + 19}
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill="var(--red)"
          >
            OUTSIDE APPETITE
          </text>
        </>
      ) : null}

      {wrapText(node.label, 34, 2).map((line, index) => (
        <text key={index} x={x + 14} y={y + 38 + index * 15} fontSize="12" fill="var(--text-1)" fontWeight="600">
          {line}
        </text>
      ))}
      <text x={x + 14} y={y + 70} fontSize="11" fill="var(--text-4)">
        {[node.taxonomyL2, node.ownerLabel].filter(Boolean).join("  ")}
      </text>

      {/* Residual position on a horizontal appetite scale. Never a gauge. */}
      <g aria-hidden="true">
        <rect x={barX} y={barY} width={barW} height="6" rx="3" fill="var(--surface-3)" />
        {node.inherentScore !== undefined ? (
          <>
            <line
              x1={scoreToX(node.inherentScore)}
              y1={barY - 3}
              x2={scoreToX(node.inherentScore)}
              y2={barY + 9}
              stroke="var(--text-4)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <text x={scoreToX(node.inherentScore)} y={barY + 22} textAnchor="middle" fontSize="11" fill="var(--text-4)">
              inh {node.inherentScore}
            </text>
          </>
        ) : null}
        {node.appetiteCeilingScore !== undefined ? (
          <>
            <line
              x1={scoreToX(node.appetiteCeilingScore)}
              y1={barY - 8}
              x2={scoreToX(node.appetiteCeilingScore)}
              y2={barY + 14}
              stroke="var(--text-1)"
              strokeWidth="1.75"
            />
            <path
              d={`M${scoreToX(node.appetiteCeilingScore) - 4},${barY - 8}L${scoreToX(node.appetiteCeilingScore) + 4},${barY - 8}L${scoreToX(node.appetiteCeilingScore)},${barY - 2}Z`}
              fill="var(--text-1)"
            />
          </>
        ) : null}

        {/* Divergent positions: two markers of different shape, joined by a bracket. */}
        {divergent && firstX !== null && secondX !== null ? (
          <>
            <path
              d={`M${firstX},${barY - 14} V${barY - 20} H${secondX} V${barY - 14}`}
              fill="none"
              stroke="var(--pink)"
              strokeWidth="1.25"
            />
            <rect x={firstX - 4} y={barY - 1} width="8" height="8" fill="var(--text-1)" stroke="var(--bg)" strokeWidth="1" />
            <circle cx={secondX} cy={barY + 3} r="5" fill="var(--pink)" stroke="var(--bg)" strokeWidth="1" />
            <text x={firstX} y={barY + 34} textAnchor="middle" fontSize="11" fill="var(--text-2)">
              {node.firstLine?.lineLabel} {node.firstLine?.score}
            </text>
            <text x={secondX} y={barY + 34} textAnchor="middle" fontSize="11" fill="var(--pink)">
              {node.secondLine?.lineLabel} {node.secondLine?.score}
            </text>
          </>
        ) : singleX !== null ? (
          <>
            <circle cx={singleX} cy={barY + 3} r="5" fill="var(--text-1)" stroke="var(--bg)" strokeWidth="1" />
            <text x={singleX} y={barY + 34} textAnchor="middle" fontSize="11" fill="var(--text-2)">
              residual {node.residualScore}
            </text>
          </>
        ) : null}

        {/* Materialisation marker, deliberately small: one occurrence is not a re-rating. */}
        {node.materialisationNote ? (
          <>
            <circle cx={x + w - 16} cy={y + RISK_H - 14} r="6" fill="var(--red-tint)" stroke="var(--red)" strokeWidth="1.25" />
            <text
              x={x + w - 16}
              y={y + RISK_H - 10}
              textAnchor="middle"
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="var(--red)"
            >
              1
            </text>
          </>
        ) : null}
      </g>
    </>
  );
}

function ControlCard({ node, y, h }: { node: ControlNodeView; y: number; h: number }) {
  const x = LANES.control.x;
  const w = LANES.control.w;
  const divergent = isDivergent(node);

  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        fill="var(--surface-1)"
        stroke={divergent ? "var(--pink)" : "var(--border-1)"}
        strokeWidth={divergent ? "1.75" : "1"}
      />
      <rect
        x={x}
        y={y}
        width="3"
        height={h}
        fill={divergent ? "var(--pink)" : effectivenessTone(String(node.currentEffectiveness))}
      />

      <text x={x + 14} y={y + 19} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-3)">
        {node.reference}
        {node.isKeyControl ? " [key]" : ""}
      </text>
      {divergent ? (
        <>
          <rect x={x + w - 84} y={y + 8} width="70" height="15" rx="3" fill="var(--pink-tint)" stroke="var(--pink)" strokeWidth="1" />
          <text
            x={x + w - 49}
            y={y + 19}
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill="var(--pink)"
          >
            DIVERGENT
          </text>
        </>
      ) : null}

      {wrapText(node.title, divergent ? 30 : 34, 1).map((line, index) => (
        <text key={index} x={x + 14} y={y + 35} fontSize="12" fill="var(--text-1)">
          {line}
        </text>
      ))}

      {divergent ? (
        <>
          {/* Two bands, one node. The bracket on the left says they belong to the
              same control and have not been reconciled. */}
          <line x1={x + 10} y1={y + 44} x2={x + w - 10} y2={y + 44} stroke="var(--border-1)" strokeWidth="1" />
          <path
            d={`M${x + 8},${y + 52} H${x + 4} V${y + 86} H${x + 8}`}
            fill="none"
            stroke="var(--pink)"
            strokeWidth="1.25"
          />
          <AssessmentBand
            x={x + 14}
            y={y + 52}
            lineLabel="1LoD"
            effectiveness={String(node.firstLineEffectiveness)}
            ownerLabel={node.firstLineOwnerLabel ?? node.ownerLabel}
          />
          <AssessmentBand
            x={x + 14}
            y={y + 78}
            lineLabel="2LoD"
            effectiveness={String(node.currentEffectiveness)}
            ownerLabel={node.secondLineOwnerLabel}
          />
        </>
      ) : (
        <AssessmentBand
          x={x + 14}
          y={y + 52}
          lineLabel=""
          effectiveness={String(node.currentEffectiveness)}
          ownerLabel={node.ownerLabel}
        />
      )}
    </>
  );
}

/** One line's claim: a segmented meter, the words, and the accountable name. */
function AssessmentBand({
  x,
  y,
  lineLabel,
  effectiveness,
  ownerLabel,
}: {
  x: number;
  y: number;
  lineLabel: string;
  effectiveness: string;
  ownerLabel?: string;
}) {
  const band = bandOf(effectiveness);
  const filled = band < 0 ? 0 : band + 1;
  const tone = effectivenessTone(effectiveness);
  const meterX = lineLabel.length > 0 ? x + 34 : x;
  return (
    <g aria-hidden="true">
      {lineLabel.length > 0 ? (
        <text x={x} y={y + 9} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-4)">
          {lineLabel}
        </text>
      ) : null}
      {[0, 1, 2, 3].map((index) => (
        <rect
          key={index}
          x={meterX + index * 9}
          y={y + 1}
          width="7"
          height="8"
          rx="1"
          fill={index < filled ? tone : "none"}
          stroke={band < 0 ? "var(--border-2)" : tone}
          strokeWidth="0.9"
          strokeDasharray={band < 0 ? "2 1" : "none"}
        />
      ))}
      <text x={meterX + 44} y={y + 9} fontSize="11" fill={tone}>
        {effectivenessLabel(effectiveness)}
      </text>
      {ownerLabel ? (
        <text x={meterX + 44} y={y + 21} fontSize="11" fill="var(--text-4)">
          {ownerLabel}
        </text>
      ) : null}
    </g>
  );
}

function IndicatorChip({
  indicator,
  x,
  y,
  w,
}: {
  indicator: IndicatorNodeView;
  x: number;
  y: number;
  w: number;
}) {
  const tone =
    indicator.status === "red"
      ? "var(--red)"
      : indicator.status === "amber"
        ? "var(--amber)"
        : "var(--green)";
  // Non-colour cue: every status also carries a glyph.
  const glyph = indicator.status === "red" ? "x" : indicator.status === "amber" ? "!" : "=";

  /*
   * The value is truncated to the width that is actually left over.
   *
   * SVG text does not wrap and does not clip, so a label simply draws over
   * whatever is beside it. The reference is left anchored and the value is
   * right anchored, which is correct until a unit is a phrase rather than a
   * symbol. Several seeded indicators have exactly that: one reads
   * "2.7 percent of instructions entering the repair queue" and another
   * "3.84 overrides per 10,000 instructions released". Those drew straight
   * through the reference and produced an unreadable overlap, visible in both
   * interfaces at every viewport.
   *
   * The budget is computed rather than guessed: the reference is monospaced at
   * 11px, which is reliably 6.6px per character, and the value is set in the
   * interface font at 11px, which averages close to 5.6px. The full text stays
   * available through the title element, so nothing is lost.
   */
  const valueText =
    indicator.currentValue !== undefined
      ? `${indicator.currentValue}${indicator.unit ? ` ${indicator.unit}` : ""}`
      : indicator.status;

  const referenceWidth = indicator.reference.length * 6.6;
  const availableWidth = w - 22 - referenceWidth - 16 - 9;
  const valueBudget = Math.max(4, Math.floor(availableWidth / 5.6));
  const valueLabel =
    valueText.length > valueBudget ? `${valueText.slice(0, valueBudget - 3).trimEnd()}...` : valueText;

  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={INDICATOR_H}
        rx="3"
        fill="var(--surface-0)"
        stroke={tone}
        strokeWidth="1"
      />
      <text x={x + 9} y={y + 16} fontSize="11" fontFamily="var(--font-mono)" fill={tone}>
        {glyph}
      </text>
      <text x={x + 22} y={y + 16} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-3)">
        {indicator.reference}
      </text>
      <text x={x + w - 9} y={y + 16} textAnchor="end" fontSize="11" fill="var(--text-2)">
        {valueLabel}
        <title>{`${indicator.reference}: ${valueText}`}</title>
      </text>
    </>
  );
}

export default RiskControlGraph;
