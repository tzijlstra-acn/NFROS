"use client";

/**
 * Service dependency map with a live event pulse, plus impact tolerance pressure.
 *
 * What it shows: the layered dependency chain behind each important business
 * service, the edges the 14:05 event actually travels along, and how much of
 * each board approved impact tolerance has been consumed.
 *
 * Two design decisions that matter.
 *
 * First, the pulse is a claim, not decoration. Only nodes and edges carrying
 * `affectedByEvent` animate, so the animation itself is the propagation path.
 * Everything else is still. If the data says nothing is affected, nothing
 * moves.
 *
 * Second, tolerance pressure is a HORIZONTAL bar with an independent threshold
 * marker, never a radial gauge, and the track extends past the threshold so a
 * breach visibly overshoots the marker rather than pinning at a full circle.
 * Where a tolerance has more than one measure, every measure gets its own bar
 * and an explicit "no precedence set" annotation sits between them, because
 * picking one measure would be quietly wrong.
 */

import { useMemo, useState } from "react";
import { Chip, ObjectId } from "@/components/evidence/primitives";

/* ==========================================================================
   Props
   ========================================================================== */

export type DependencyKind = "service" | "system" | "supplier" | "subprocessor";

export type ToleranceState = "within" | "approaching" | "at-threshold" | "breached";

export interface DependencyNodeView {
  id: string;
  kind: DependencyKind;
  label: string;
  detail?: string;
  /** "normal", "degraded", "fallback" or "impaired". */
  operationalStatus?: string;
  isImportantBusinessService?: boolean;
  /** Entity scope. Never blurred across jurisdictions. */
  entityLabel?: string;
  /** Per-entity framework badge. A Swiss lane never carries an EU label. */
  frameworkLabel?: string;
  /** True only where the event genuinely reaches. Drives the pulse. */
  affectedByEvent?: boolean;
  /** Scenario moment at which this node failed, for example "13:31". */
  failedAtMoment?: string;
}

export interface DependencyEdgeView {
  id: string;
  from: string;
  to: string;
  strength?: "critical" | "important" | "supporting";
  singlePointOfFailure?: boolean;
  affectedByEvent?: boolean;
  note?: string;
}

export interface ToleranceMeasureView {
  id: string;
  serviceId: string;
  serviceLabel?: string;
  entityLabel?: string;
  frameworkLabel?: string;
  metric: string;
  unit: string;
  thresholdValue: number;
  consumedValue: number;
  state: ToleranceState;
  statement?: string;
  approvedBy?: string;
  note?: string;
}

export interface ServiceDependencyMapProps {
  nodes: DependencyNodeView[];
  edges: DependencyEdgeView[];
  tolerances: ToleranceMeasureView[];
  eventMoment?: string;
  /** Rendered between two measures of the same tolerance. */
  precedenceNote?: string;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  heading?: string;
  /**
   * Nodes a recent monitoring change reached.
   *
   * Drawn as a 2px edge marker, the same device the application uses on a list
   * row. Omitted by default, which leaves the previous rendering untouched.
   */
  changedNodeIds?: readonly string[];
  /** The marker's accessible name. Passed in so it can be German. */
  changedLabel?: string;
  /**
   * Renders the impact tolerance pressure bars below the drawing. True by
   * default, which is the report surface behaviour: a document is read in one
   * pass and the drawing and its tolerance table belong together.
   *
   * Set false where the surface already states the tolerance position in its
   * own composition. The presentation's scene 12 does, one lane per entity on
   * a pane of its own, and carrying the same four measures a second time
   * inside this figure made it 2310px tall in a 467px stage box: too tall for
   * the stage to scale, so the tail was clipped. The measures stay in the
   * figure's accessible description either way, so nothing is lost to a
   * screen reader.
   */
  showTolerancePressure?: boolean;
}

/* ==========================================================================
   Geometry
   ========================================================================== */

const VIEW_W = 1000;
const TOP = 56;
const NODE_W = 196;
/*
 * 68 rather than 56.
 *
 * The label wraps to two lines at `y + 33` and `y + 46`, and the metadata line
 * sat at `y + NODE_H - 6`, which was `y + 50`. Four pixels below a 12px line
 * is an overlap, so a two line service name had its entity scope drawn
 * through it: "Client Onboarding and Static Data Maintenance" carried
 * "Arcadia Bank AG, Arcadia Bank Oesterreich AG" across its second line. The
 * card is twelve pixels taller and the metadata sits clear of the title.
 */
const NODE_H = 68;
const NODE_GAP = 22;
const BOTTOM_PAD = 24;

/** Lane order: what the bank runs, then what it runs on, then who it buys from. */
const LANE_ORDER: DependencyKind[] = ["service", "system", "supplier", "subprocessor"];

const LANE_LABELS: Record<DependencyKind, string> = {
  service: "1. Business service",
  system: "2. System",
  supplier: "3. Supplier",
  subprocessor: "4. Subprocessor",
};

function laneX(kind: DependencyKind): number {
  const index = LANE_ORDER.indexOf(kind);
  return 16 + Math.max(0, index) * 248;
}

const TOLERANCE_GLYPH: Record<ToleranceState, string> = {
  within: "=",
  approaching: "!",
  "at-threshold": "!!",
  breached: "x",
};

const TOLERANCE_WORD: Record<ToleranceState, string> = {
  within: "Within tolerance",
  approaching: "Approaching threshold",
  "at-threshold": "At threshold",
  breached: "Threshold passed",
};

const TOLERANCE_TONE: Record<ToleranceState, string> = {
  within: "var(--green)",
  approaching: "var(--amber)",
  "at-threshold": "var(--amber)",
  breached: "var(--red)",
};

/** Texture, so the four states are separable without colour. */
function toleranceFill(state: ToleranceState): string {
  if (state === "within") return "var(--green)";
  if (state === "approaching") {
    return "repeating-linear-gradient(45deg, var(--amber) 0 4px, rgb(243 179 76 / 45%) 4px 8px)";
  }
  if (state === "at-threshold") {
    return "repeating-linear-gradient(45deg, var(--amber) 0 2px, rgb(243 179 76 / 35%) 2px 4px)";
  }
  return "repeating-linear-gradient(135deg, var(--red) 0 2px, rgb(226 112 122 / 35%) 2px 4px)";
}

function edgeWidth(edge: DependencyEdgeView): number {
  if (edge.affectedByEvent) return 3.2;
  if (edge.strength === "critical") return 2.4;
  if (edge.strength === "important") return 1.7;
  return 1.1;
}

function statusTone(node: DependencyNodeView): string {
  if (node.affectedByEvent) return "var(--red)";
  if (node.operationalStatus === "impaired") return "var(--red)";
  if (node.operationalStatus === "degraded" || node.operationalStatus === "fallback") {
    return "var(--amber)";
  }
  if (node.kind === "service") return "var(--cyan)";
  return "var(--border-strong)";
}

/** Non-colour cue for operational status. */
function statusGlyph(node: DependencyNodeView): string {
  if (node.operationalStatus === "impaired") return "x";
  if (node.operationalStatus === "fallback") return ">";
  if (node.operationalStatus === "degraded") return "!";
  return "=";
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

/* ==========================================================================
   Scoped motion. The pulse and the flow are the propagation path.
   ========================================================================== */

const DEPENDENCY_CSS = `
.nfr-dep-pulse {
  animation: nfr-dep-ping 2.4s cubic-bezier(0.55, 0.06, 0.32, 0.96) infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes nfr-dep-ping {
  0% { transform: scale(0.96); opacity: 0.9; }
  70% { transform: scale(1.1); opacity: 0; }
  100% { transform: scale(1.1); opacity: 0; }
}
.nfr-dep-flow {
  stroke-dasharray: 10 8;
  animation: nfr-dep-march 1.6s linear infinite;
}
@keyframes nfr-dep-march {
  to { stroke-dashoffset: -18; }
}
@media (prefers-reduced-motion: reduce) {
  .nfr-dep-pulse { animation: none; opacity: 0.9; transform: scale(1.06); }
  .nfr-dep-flow { animation: none; stroke-dasharray: 10 8; }
}
`;

/* ==========================================================================
   Component
   ========================================================================== */

export function ServiceDependencyMap({
  nodes,
  edges,
  tolerances,
  eventMoment = "14:05",
  precedenceNote = "No precedence is set between these measures. The question is open and is owned by a human.",
  selectedNodeId = null,
  onSelectNode,
  heading = "Service dependency and impact tolerance",
  showTolerancePressure = true,
  changedNodeIds,
  changedLabel = "Changed recently",
}: ServiceDependencyMapProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  /* Keyed on the joined string rather than the array: a caller that rebuilds
     the array every render would otherwise rebuild this set every render. */
  const changedNodesKey = (changedNodeIds ?? []).join("|");
  const changedNodes = useMemo(
    () => new Set(changedNodesKey.length === 0 ? [] : changedNodesKey.split("|")),
    [changedNodesKey],
  );


  const layout = useMemo(() => {
    const columns = LANE_ORDER.map((kind) => ({
      kind,
      items: nodes.filter((node) => node.kind === kind).sort((a, b) => a.id.localeCompare(b.id)),
    }));

    const tallest = columns.reduce((max, column) => Math.max(max, column.items.length), 0);
    const contentH = Math.max(1, tallest) * (NODE_H + NODE_GAP) - NODE_GAP;

    const positioned = new Map<string, { x: number; y: number; node: DependencyNodeView }>();
    for (const column of columns) {
      const colH = Math.max(0, column.items.length * (NODE_H + NODE_GAP) - NODE_GAP);
      // Centre each lane against the tallest lane so the edge bundle stays flat.
      const offset = TOP + Math.max(0, (contentH - colH) / 2);
      column.items.forEach((node, index) => {
        positioned.set(node.id, {
          x: laneX(column.kind),
          y: offset + index * (NODE_H + NODE_GAP),
          node,
        });
      });
    }

    return { positioned, viewH: TOP + contentH + BOTTOM_PAD };
  }, [nodes]);

  const focusTarget = activeId ?? selectedNodeId;

  const connected = useMemo(() => {
    if (focusTarget === null) return null;
    const ids = new Set<string>([focusTarget]);
    for (const edge of edges) {
      if (edge.from === focusTarget) ids.add(edge.to);
      if (edge.to === focusTarget) ids.add(edge.from);
    }
    return ids;
  }, [edges, focusTarget]);

  const toleranceByService = useMemo(() => {
    const map = new Map<string, ToleranceMeasureView[]>();
    for (const measure of [...tolerances].sort((a, b) => a.id.localeCompare(b.id))) {
      const list = map.get(measure.serviceId) ?? [];
      list.push(measure);
      map.set(measure.serviceId, list);
    }
    return map;
  }, [tolerances]);

  const affectedNodes = nodes.filter((node) => node.affectedByEvent);
  const affectedEdges = edges.filter((edge) => edge.affectedByEvent);
  const spofEdges = edges.filter((edge) => edge.singlePointOfFailure);
  const breached = tolerances.filter(
    (measure) => measure.state === "breached" || measure.state === "at-threshold",
  );

  const ariaLabel = [
    `Layered service dependency map across ${LANE_ORDER.length} tiers with ${nodes.length} nodes and ${edges.length} dependencies.`,
    `${affectedNodes.length} nodes and ${affectedEdges.length} dependency edges are affected by the ${eventMoment} event.`,
    `${spofEdges.length} dependencies are single points of failure with no substitute available.`,
    `${tolerances.length} impact tolerance measures are tracked. ${breached.length} are at or past their threshold.`,
  ].join(" ");

  return (
    <figure className="stack stack-5" style={{ margin: 0 }}>
      <style>{DEPENDENCY_CSS}</style>

      <figcaption className="row row-3 row-wrap row-between">
        <span className="panel-title">{heading}</span>
        <div className="row row-2 row-wrap">
          {affectedNodes.length > 0 ? (
            <Chip tone="red">
              {affectedNodes.length} nodes touched at {eventMoment}
            </Chip>
          ) : null}
          {spofEdges.length > 0 ? <Chip tone="amber">{spofEdges.length} single points of failure</Chip> : null}
          {breached.length > 0 ? <Chip tone="red">{breached.length} tolerance measures at or past threshold</Chip> : null}
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
          <marker id="sdm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0L8,4L0,8Z" fill="var(--border-strong)" />
          </marker>
          <marker id="sdm-arrow-event" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0L8,4L0,8Z" fill="var(--red)" />
          </marker>
        </defs>

        {/* Lane headers */}
        {LANE_ORDER.map((kind) => (
          <g key={kind} aria-hidden="true">
            <text
              x={laneX(kind)}
              y={26}
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill="var(--text-4)"
              letterSpacing="0.09em"
            >
              {LANE_LABELS[kind].toUpperCase()}
            </text>
            <line
              x1={laneX(kind)}
              y1={36}
              x2={laneX(kind) + NODE_W}
              y2={36}
              stroke="var(--border-1)"
              strokeWidth="1"
            />
          </g>
        ))}

        {/* Edges */}
        <g>
          {edges.map((edge) => {
            const from = layout.positioned.get(edge.from);
            const to = layout.positioned.get(edge.to);
            if (!from || !to) return null;
            const dim = connected !== null && !(connected.has(edge.from) && connected.has(edge.to));
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            // Control points always push out of the source and into the target, so
            // a dependency that runs back to an earlier lane draws a readable
            // reverse curve rather than a straight line through the cards.
            const dx = Math.max(52, Math.abs(x2 - x1) * 0.45);
            const c1x = x1 + dx;
            const c2x = x2 - dx;
            const path = `M${x1},${y1} C${c1x},${y1} ${c2x},${y2} ${x2},${y2}`;
            const midX = (x1 + 3 * c1x + 3 * c2x + x2) / 8;
            const midY = (y1 + 3 * y1 + 3 * y2 + y2) / 8;
            return (
              <g key={edge.id} opacity={dim ? 0.12 : 1} aria-hidden="true">
                {/* A single point of failure edge is doubled: no alternative route exists. */}
                {edge.singlePointOfFailure ? (
                  <path d={path} fill="none" stroke="var(--amber)" strokeWidth={edgeWidth(edge) + 4} strokeOpacity="0.26" />
                ) : null}
                <path
                  className={edge.affectedByEvent ? "nfr-dep-flow" : undefined}
                  d={path}
                  fill="none"
                  stroke={
                    edge.affectedByEvent
                      ? "var(--red)"
                      : edge.strength === "critical"
                        ? "var(--cyan)"
                        : "var(--border-2)"
                  }
                  strokeWidth={edgeWidth(edge)}
                  strokeDasharray={
                    edge.affectedByEvent ? undefined : edge.strength === "supporting" ? "5 4" : "none"
                  }
                  markerEnd={edge.affectedByEvent ? "url(#sdm-arrow-event)" : "url(#sdm-arrow)"}
                />
                {edge.singlePointOfFailure ? (
                  <>
                    <rect
                      x={midX - 20}
                      y={midY - 8}
                      width="40"
                      height="15"
                      rx="3"
                      fill="var(--bg)"
                      stroke="var(--amber)"
                      strokeWidth="0.9"
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      textAnchor="middle"
                      fontSize="11"
                      fontFamily="var(--font-mono)"
                      fill="var(--amber)"
                    >
                      spof
                    </text>
                  </>
                ) : edge.affectedByEvent ? (
                  <>
                    <rect
                      x={midX - 26}
                      y={midY - 8}
                      width="52"
                      height="15"
                      rx="3"
                      fill="var(--bg)"
                      stroke="var(--red)"
                      strokeWidth="0.9"
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      textAnchor="middle"
                      fontSize="11"
                      fontFamily="var(--font-mono)"
                      fill="var(--red)"
                    >
                      {eventMoment}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {Array.from(layout.positioned.values()).map(({ node, x, y }) => {
            const dim = connected !== null && !connected.has(node.id);
            const isFocused = focusTarget === node.id;
            const tone = statusTone(node);
            const measures = toleranceByService.get(node.id) ?? [];
            const worst = worstState(measures);
            const hasChanged = changedNodes.has(node.id);
            const nodeLabel = describeNode(node, measures, eventMoment);
            return (
              <g
                key={node.id}
                tabIndex={0}
                role="button"
                aria-label={hasChanged ? `${nodeLabel} ${changedLabel}.` : nodeLabel}
                data-changed={hasChanged ? true : undefined}
                opacity={dim ? 0.16 : 1}
                style={{ cursor: onSelectNode ? "pointer" : "default", outline: "none" }}
                onMouseEnter={() => setActiveId(node.id)}
                onMouseLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(node.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => onSelectNode?.(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectNode?.(node.id);
                  }
                }}
              >
                {isFocused ? (
                  <rect
                    x={x - 4}
                    y={y - 4}
                    width={NODE_W + 8}
                    height={NODE_H + 8}
                    rx="8"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                  />
                ) : null}

                {/* A 2px edge. The pulse belongs to the event path, so recency
                    is given a separate, still mark. */}
                {hasChanged ? (
                  <rect
                    x={x - 7}
                    y={y + 2}
                    width="2"
                    height={NODE_H - 4}
                    rx="1"
                    fill="var(--accent)"
                  />
                ) : null}

                {/* The event pulse. Only genuinely affected nodes carry it. */}
                {node.affectedByEvent ? (
                  <rect
                    className="nfr-dep-pulse"
                    x={x - 2}
                    y={y - 2}
                    width={NODE_W + 4}
                    height={NODE_H + 4}
                    rx="7"
                    fill="none"
                    stroke="var(--red)"
                    strokeWidth="2"
                  />
                ) : null}

                <rect
                  x={x}
                  y={y}
                  width={NODE_W}
                  height={NODE_H}
                  rx="6"
                  fill="var(--surface-1)"
                  stroke={tone}
                  strokeWidth={node.affectedByEvent ? 1.8 : 1.2}
                />
                <rect x={x} y={y} width="3" height={NODE_H} fill={tone} />

                <text x={x + 12} y={y + 17} fontSize="11" fontFamily="var(--font-mono)" fill={tone}>
                  {statusGlyph(node)} {node.id}
                </text>
                {node.isImportantBusinessService ? (
                  <text
                    x={x + NODE_W - 10}
                    y={y + 17}
                    textAnchor="end"
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    fill="var(--cyan)"
                  >
                    IBS
                  </text>
                ) : null}
                {wrapText(node.label, 28, 2).map((line, index) => (
                  <text key={index} x={x + 12} y={y + 33 + index * 13} fontSize="12" fill="var(--text-1)">
                    {line}
                  </text>
                ))}
                {/*
                  * Truncated to the card, with the full text on the title.
                  *
                  * SVG text neither wraps nor clips, so an entity scope naming
                  * two legal entities simply drew past the card edge and over
                  * whatever was beside it. The budget is the card width less
                  * the left inset and a right margin, at roughly 5.4px per
                  * character for this font and size.
                  */}
                {(() => {
                  const meta = [
                    node.entityLabel,
                    node.frameworkLabel,
                    node.failedAtMoment ? `failed ${node.failedAtMoment}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ");
                  if (meta.length === 0) return null;
                  const budget = Math.floor((NODE_W - 24) / 5.4);
                  const shown =
                    meta.length > budget ? `${meta.slice(0, budget - 3).trimEnd()}...` : meta;
                  return (
                    <text x={x + 12} y={y + NODE_H - 8} fontSize="11" fill="var(--text-4)">
                      {shown}
                      <title>{meta}</title>
                    </text>
                  );
                })()}

                {/* A service carries the worst state of its own tolerance measures, so
                    the map and the bars below are linked by a shared glyph. */}
                {worst !== null ? (
                  <>
                    <rect
                      x={x + NODE_W - 30}
                      y={y + NODE_H - 20}
                      width="24"
                      height="15"
                      rx="3"
                      fill="var(--surface-0)"
                      stroke={TOLERANCE_TONE[worst]}
                      strokeWidth="1"
                    />
                    <text
                      x={x + NODE_W - 18}
                      y={y + NODE_H - 9}
                      textAnchor="middle"
                      fontSize="11"
                      fontFamily="var(--font-mono)"
                      fill={TOLERANCE_TONE[worst]}
                    >
                      {TOLERANCE_GLYPH[worst]}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="row row-4 row-wrap" aria-hidden="true" style={{ fontSize: "var(--text-xs)" }}>
        <span className="row row-2">
          <svg viewBox="0 0 32 8" style={{ width: "32px", height: "8px" }}>
            <line x1="0" y1="4" x2="30" y2="4" stroke="var(--cyan)" strokeWidth="2.4" />
          </svg>
          <span className="muted">critical dependency</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 32 8" style={{ width: "32px", height: "8px" }}>
            <line x1="0" y1="4" x2="30" y2="4" stroke="var(--border-2)" strokeWidth="1.1" strokeDasharray="5 4" />
          </svg>
          <span className="muted">supporting dependency</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 32 10" style={{ width: "32px", height: "10px" }}>
            <line x1="0" y1="5" x2="30" y2="5" stroke="var(--amber)" strokeWidth="7" strokeOpacity="0.26" />
            <line x1="0" y1="5" x2="30" y2="5" stroke="var(--amber)" strokeWidth="2.4" />
          </svg>
          <span className="muted">single point of failure, doubled stroke</span>
        </span>
        <span className="row row-2">
          <svg viewBox="0 0 32 8" style={{ width: "32px", height: "8px" }}>
            <line x1="0" y1="4" x2="30" y2="4" stroke="var(--red)" strokeWidth="3.2" strokeDasharray="10 8" />
          </svg>
          <span className="muted">affected at {eventMoment}, marching dashes</span>
        </span>
        <span className="muted">Status glyphs: = normal, ! degraded, &gt; on fallback, x impaired</span>
      </div>

      {/* Impact tolerance pressure. Horizontal bars with an independent threshold
          marker, one bar per measure, never one bar per service. */}
      {!showTolerancePressure ? null : (
      <div className="stack stack-4">
        <div className="row row-3 row-wrap row-between">
          <span className="label">Impact tolerance pressure</span>
          <span className="meta">Consumed against the board approved threshold</span>
        </div>

        {Array.from(toleranceByService.entries()).map(([serviceId, measures]) => {
          const service = layout.positioned.get(serviceId)?.node;
          const serviceLabel = service?.label ?? measures[0]?.serviceLabel ?? serviceId;
          return (
            <div key={serviceId} className="panel-flush">
              <div className="panel-head">
                <div className="row row-2 row-wrap">
                  <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                    {serviceLabel}
                  </span>
                  <ObjectId id={serviceId} />
                </div>
                <div className="row row-2 row-wrap">
                  {measures[0]?.entityLabel ? <Chip tone="neutral">{measures[0].entityLabel}</Chip> : null}
                  {measures[0]?.frameworkLabel ? <Chip tone="cyan">{measures[0].frameworkLabel}</Chip> : null}
                </div>
              </div>
              <div className="panel-body stack stack-4">
                {measures.map((measure, index) => (
                  <div key={measure.id} className="stack stack-3">
                    {index > 0 ? (
                      <div
                        className="row row-2"
                        style={{
                          padding: "var(--space-2) var(--space-3)",
                          border: "1px dashed var(--amber)",
                          background: "var(--amber-tint)",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        <span className="chip-glyph" aria-hidden="true" style={{ color: "var(--amber)" }}>
                          !
                        </span>
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--amber)" }}>
                          {precedenceNote}
                        </span>
                      </div>
                    ) : null}
                    <ToleranceBar measure={measure} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}

      <div className="sr-only">
        <h4>Dependency map, described</h4>
        <h5>Nodes</h5>
        <ul>
          {nodes.map((node) => (
            <li key={`sr-${node.id}`}>
              {describeNode(node, toleranceByService.get(node.id) ?? [], eventMoment)}
            </li>
          ))}
        </ul>
        <h5>Dependencies</h5>
        <ul>
          {edges.map((edge) => (
            <li key={`sr-${edge.id}`}>
              {edge.from} depends on {edge.to}.
              {edge.strength ? ` Strength ${edge.strength}.` : ""}
              {edge.singlePointOfFailure ? " Single point of failure, no substitute available." : ""}
              {edge.affectedByEvent ? ` Affected by the ${eventMoment} event.` : ""}
              {edge.note ? ` ${edge.note}` : ""}
            </li>
          ))}
        </ul>
        <h5>Impact tolerance measures</h5>
        <ul>
          {tolerances.map((measure) => (
            <li key={`sr-${measure.id}`}>{describeMeasure(measure)}</li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

/* ==========================================================================
   Internals
   ========================================================================== */

const STATE_SEVERITY: Record<ToleranceState, number> = {
  within: 0,
  approaching: 1,
  "at-threshold": 2,
  breached: 3,
};

function worstState(measures: ToleranceMeasureView[]): ToleranceState | null {
  let worst: ToleranceState | null = null;
  for (const measure of measures) {
    if (worst === null || STATE_SEVERITY[measure.state] > STATE_SEVERITY[worst]) {
      worst = measure.state;
    }
  }
  return worst;
}

function describeNode(
  node: DependencyNodeView,
  measures: ToleranceMeasureView[],
  eventMoment: string,
): string {
  const parts: string[] = [`${node.kind} ${node.id}, ${node.label}.`];
  if (node.detail) parts.push(`${node.detail}.`);
  if (node.entityLabel) parts.push(`Entity scope ${node.entityLabel}.`);
  if (node.frameworkLabel) parts.push(`Framework ${node.frameworkLabel}.`);
  if (node.isImportantBusinessService) parts.push("Designated an important business service.");
  if (node.operationalStatus) parts.push(`Operational status ${node.operationalStatus}.`);
  if (node.failedAtMoment) parts.push(`Failed at ${node.failedAtMoment}.`);
  if (node.affectedByEvent) parts.push(`Affected by the ${eventMoment} event.`);
  for (const measure of measures) parts.push(describeMeasure(measure));
  return parts.join(" ");
}

function describeMeasure(measure: ToleranceMeasureView): string {
  const remaining = measure.thresholdValue - measure.consumedValue;
  return [
    `${measure.metric}:`,
    `${measure.consumedValue} ${measure.unit} consumed of a ${measure.thresholdValue} ${measure.unit} threshold,`,
    remaining >= 0
      ? `${remaining} ${measure.unit} remaining.`
      : `${Math.abs(remaining)} ${measure.unit} past the threshold.`,
    `State: ${TOLERANCE_WORD[measure.state]}.`,
    measure.entityLabel ? `Entity ${measure.entityLabel}.` : "",
    measure.statement ?? "",
    measure.approvedBy ? `Approved by ${measure.approvedBy}.` : "",
    measure.note ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * One tolerance measure as a horizontal bar.
 *
 * The track deliberately extends past the threshold, so consumption that has
 * passed the threshold overshoots the marker instead of sitting silently at
 * one hundred percent.
 */
function ToleranceBar({ measure }: { measure: ToleranceMeasureView }) {
  const threshold = Math.max(1, measure.thresholdValue);
  const consumed = Math.max(0, measure.consumedValue);
  const scaleMax = Math.max(threshold * 1.25, consumed * 1.08);
  const thresholdPct = (threshold / scaleMax) * 100;
  const consumedPct = Math.min(100, (consumed / scaleMax) * 100);
  const remaining = threshold - consumed;
  const tone = TOLERANCE_TONE[measure.state];

  return (
    <div className="stack stack-2">
      <div className="row row-3 row-wrap row-between">
        <span className="row row-2">
          <span className="mono" style={{ color: tone, fontSize: "var(--text-xs)" }} aria-hidden="true">
            {TOLERANCE_GLYPH[measure.state]}
          </span>
          <span style={{ fontSize: "var(--text-sm)" }}>{measure.metric}</span>
        </span>
        <span className="row row-2 row-wrap meta">
          <span style={{ color: tone }}>{TOLERANCE_WORD[measure.state]}</span>
          <span>
            {consumed} of {threshold} {measure.unit}
          </span>
          <span>
            {remaining >= 0
              ? `${remaining} ${measure.unit} remaining`
              : `${Math.abs(remaining)} ${measure.unit} past threshold`}
          </span>
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={consumed}
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-label={describeMeasure(measure)}
        style={{
          position: "relative",
          height: "18px",
          background: "var(--surface-2)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${consumedPct}%`,
            height: "100%",
            background: toleranceFill(measure.state),
          }}
        />
        {/* The threshold marker is independent of the fill: a separate, drawn line. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${thresholdPct}%`,
            top: 0,
            bottom: 0,
            width: "0",
            borderLeft: "2px solid var(--text-1)",
          }}
        />
        <span
          aria-hidden="true"
          className="mono"
          style={{
            position: "absolute",
            left: `calc(${thresholdPct}% + 5px)`,
            top: "2px",
            fontSize: "var(--text-xs)",
            color: "var(--text-1)",
          }}
        >
          threshold
        </span>
      </div>

      {measure.statement ? (
        <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
          {measure.statement}
          {measure.approvedBy ? ` Approved by ${measure.approvedBy}.` : ""}
        </p>
      ) : null}
    </div>
  );
}

export default ServiceDependencyMap;
