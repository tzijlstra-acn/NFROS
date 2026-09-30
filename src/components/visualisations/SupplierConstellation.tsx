"use client";

/**
 * Supplier and fourth-party exposure constellation.
 *
 * What it shows: one supplier at the centre, the services it delivers on the
 * first ring, its declared subprocessors on the second, and fourth parties on
 * the outer ring, with the contractual obligation evidence position, single
 * points of failure and the reach of the 14:05 event drawn onto the same
 * picture.
 *
 * The design decision that matters: the appendix-versus-submission discrepancy
 * is not a colour or a badge. A divergent node is drawn as a genuinely SPLIT
 * shape, left half for the binding contract appendix and right half for the
 * supplier's current register, with the absent half rendered as a dashed hatch
 * rather than a fill. A half-missing node reads as wrong from across a room,
 * which is the reaction the finding deserves, and it stays legible without
 * colour because the cue is geometry.
 *
 * Every divergent node also carries a leader line to a named callout, so the
 * finding survives a screenshot with no hover state.
 */

import { useId, useMemo, useState } from "react";
import { Chip, ObjectId } from "@/components/evidence/primitives";

/* ==========================================================================
   Props
   ========================================================================== */

export type ConstellationRing = "supplier" | "service" | "subprocessor" | "fourth-party";

export type ConstellationCriticality = "critical" | "important" | "standard" | "supporting";

/** How a chain participant is declared. Divergence between the two is the finding. */
export type DeclarationSource = "contract-appendix" | "supplier-submission" | "both";

export interface ObligationEvidenceCounts {
  met: number;
  partiallyMet: number;
  notEvidenced: number;
  breached: number;
}

export interface ConstellationNode {
  id: string;
  ring: ConstellationRing;
  label: string;
  /** Jurisdiction, function provided, or service domain. Shown in the tooltip. */
  detail?: string;
  criticality?: ConstellationCriticality;
  /** Present for subprocessors and fourth parties. Drives the split rendering. */
  declaredIn?: DeclarationSource;
  isDiscrepancy?: boolean;
  discrepancyNote?: string;
  /** For example "Frankfurt, inside the EEA" or "Pune, outside the EEA". */
  dataLocation?: string;
  supportsCriticalFunction?: boolean;
  singlePointOfFailure?: boolean;
  /** True only for nodes the 14:05 event genuinely reaches. Drives the pulse. */
  affectedByEvent?: boolean;
  /** Obligation evidence position attributable to this node. */
  evidence?: ObligationEvidenceCounts;
}

export interface ConstellationEdge {
  id: string;
  from: string;
  to: string;
  strength?: "critical" | "important" | "supporting";
  singlePointOfFailure?: boolean;
  affectedByEvent?: boolean;
  note?: string;
}

export interface SupplierConstellationProps {
  supplier: {
    id: string;
    name: string;
    criticality: string;
    domicile: string;
    isOutsourcing?: boolean;
    concentrationNote?: string;
  };
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  /** Obligation evidence position across the whole arrangement. */
  obligationSummary?: ObligationEvidenceCounts;
  /** The scenario moment of the shared event. Used in labels only. */
  eventMoment?: string;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  heading?: string;
}

/* ==========================================================================
   Geometry
   ========================================================================== */

const VIEW_W = 1000;
const VIEW_H = 660;
const CX = 470;
const CY = 330;

/** Ring radii. Fourth parties sit furthest out because they sit furthest from the contract. */
const RING_RADIUS: Record<ConstellationRing, number> = {
  supplier: 0,
  service: 118,
  subprocessor: 216,
  "fourth-party": 292,
};

const RING_ORDER: ConstellationRing[] = ["supplier", "service", "subprocessor", "fourth-party"];

const RING_LABELS: Record<ConstellationRing, string> = {
  supplier: "Supplier",
  service: "Service",
  subprocessor: "Subprocessor",
  "fourth-party": "Fourth party",
};

/** Node half-extent by recorded criticality. Size encodes criticality, nothing else. */
function nodeSize(criticality: ConstellationCriticality | undefined): number {
  if (criticality === "critical") return 16;
  if (criticality === "important") return 13;
  return 10;
}

function polar(radius: number, angleDeg: number): { x: number; y: number } {
  // Angles start at twelve o'clock and run clockwise, so a reader traces a ring
  // in the direction they read a clock face.
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

interface PlacedNode extends ConstellationNode {
  x: number;
  y: number;
  angle: number;
  size: number;
}

/**
 * Deterministic placement: nodes are grouped by ring, sorted by id so output
 * never depends on input order, and distributed evenly around the circle. Each
 * ring carries a fixed rotation offset so an outer label never sits on the
 * radial line of an inner one.
 */
function placeNodes(nodes: ConstellationNode[]): PlacedNode[] {
  const placed: PlacedNode[] = [];
  const ringOffsets: Record<ConstellationRing, number> = {
    supplier: 0,
    service: 0,
    subprocessor: 24,
    "fourth-party": 48,
  };

  for (const ring of RING_ORDER) {
    const inRing = nodes.filter((n) => n.ring === ring).sort((a, b) => a.id.localeCompare(b.id));
    const count = inRing.length;
    inRing.forEach((node, index) => {
      if (ring === "supplier") {
        placed.push({ ...node, x: CX, y: CY, angle: 0, size: 34 });
        return;
      }
      const step = count > 0 ? 360 / count : 0;
      const angle = ringOffsets[ring] + index * step;
      const point = polar(RING_RADIUS[ring], angle);
      placed.push({ ...node, x: point.x, y: point.y, angle, size: nodeSize(node.criticality) });
    });
  }
  return placed;
}

/* ==========================================================================
   Shape helpers
   ========================================================================== */

/** A hexagon, used only for the supplier so the centre is unmistakable. */
function hexPath(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const rad = ((60 * i - 90) * Math.PI) / 180;
    points.push(`${(cx + r * Math.cos(rad)).toFixed(2)},${(cy + r * Math.sin(rad)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

/** A diamond, used for fourth parties: a shape the contract does not contain. */
function diamondPath(cx: number, cy: number, r: number): string {
  return `M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`;
}

/** Half of a shape, so a divergent node can be drawn as two independent halves. */
function halfPath(
  cx: number,
  cy: number,
  r: number,
  side: "left" | "right",
  ring: ConstellationRing,
): string {
  const sweep = side === "left" ? 0 : 1;
  if (ring === "fourth-party") {
    return side === "left"
      ? `M${cx},${cy - r}L${cx - r},${cy}L${cx},${cy + r}Z`
      : `M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}Z`;
  }
  if (ring === "service") {
    return side === "left"
      ? `M${cx},${cy - r}L${cx - r},${cy - r}L${cx - r},${cy + r}L${cx},${cy + r}Z`
      : `M${cx},${cy - r}L${cx + r},${cy - r}L${cx + r},${cy + r}L${cx},${cy + r}Z`;
  }
  // Semicircle for subprocessors: the arc sweep flag picks the hemisphere.
  return `M${cx},${cy - r}A${r},${r} 0 0 ${sweep} ${cx},${cy + r}Z`;
}

function edgeWidth(strength: ConstellationEdge["strength"]): number {
  if (strength === "critical") return 3;
  if (strength === "important") return 2;
  return 1.25;
}

/* ==========================================================================
   Scoped motion. Only genuinely affected nodes carry it.
   ========================================================================== */

const CONSTELLATION_CSS = `
.nfr-constellation-pulse {
  animation: nfr-constellation-ping 2.6s cubic-bezier(0.55, 0.06, 0.32, 0.96) infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes nfr-constellation-ping {
  0% { transform: scale(0.82); opacity: 0.85; }
  70% { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1.5); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .nfr-constellation-pulse { animation: none; opacity: 0.85; transform: scale(1.18); }
}
`;

/* ==========================================================================
   Component
   ========================================================================== */

export function SupplierConstellation({
  supplier,
  nodes,
  edges,
  obligationSummary,
  eventMoment = "14:05",
  selectedNodeId = null,
  onSelectNode,
  heading = "Supplier dependency and chain",
}: SupplierConstellationProps) {
  const patternId = useId().replace(/:/g, "");
  const [activeId, setActiveId] = useState<string | null>(null);

  const placed = useMemo(() => placeNodes(nodes), [nodes]);
  const byId = useMemo(() => new Map(placed.map((n) => [n.id, n])), [placed]);

  const divergent = placed.filter((n) => n.isDiscrepancy);
  const spofNodes = placed.filter((n) => n.singlePointOfFailure);
  const eventNodes = placed.filter((n) => n.affectedByEvent);
  const chainCount = placed.filter(
    (n) => n.ring === "subprocessor" || n.ring === "fourth-party",
  ).length;

  const active = activeId !== null ? byId.get(activeId) : undefined;
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

  const ariaLabel = [
    `Constellation of ${supplier.name}, recorded criticality ${supplier.criticality}, domiciled ${supplier.domicile}.`,
    `${placed.filter((n) => n.ring === "service").length} services,`,
    `${placed.filter((n) => n.ring === "subprocessor").length} subprocessors and`,
    `${placed.filter((n) => n.ring === "fourth-party").length} fourth parties.`,
    `${divergent.length} chain participants do not reconcile between the binding contract appendix and the supplier's current register.`,
    `${spofNodes.length} nodes are single points of failure.`,
    `${eventNodes.length} nodes are touched by the ${eventMoment} event.`,
  ].join(" ");

  return (
    <figure className="stack stack-4" style={{ margin: 0 }}>
      <style>{CONSTELLATION_CSS}</style>

      <figcaption className="row row-3 row-wrap row-between">
        <div className="stack stack-1">
          <span className="panel-title">{heading}</span>
          <ObjectId id={supplier.id} label={supplier.name} />
        </div>
        <div className="row row-2 row-wrap">
          <Chip tone={supplier.criticality === "critical" ? "red" : "cyan"}>
            {supplier.criticality}
          </Chip>
          {supplier.isOutsourcing ? <Chip tone="amber">regulated outsourcing</Chip> : null}
          {divergent.length > 0 ? <Chip tone="pink">{divergent.length} chain divergence</Chip> : null}
        </div>
      </figcaption>

      <div style={{ position: "relative", width: "100%" }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={ariaLabel}
          style={{ width: "100%", height: "auto" }}
        >
          <defs>
            {/* Absent-from-appendix hatch. The non-colour cue for a missing half. */}
            <pattern
              id={`${patternId}-absent`}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--surface-0)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--pink)" strokeWidth="1.4" />
            </pattern>
            {/* Evidence bar textures, so the obligation position survives greyscale. */}
            <pattern
              id={`${patternId}-partial`}
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="4" height="4" fill="var(--amber-tint)" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="var(--amber)" strokeWidth="1.2" />
            </pattern>
            <pattern id={`${patternId}-absent-ev`} width="3" height="3" patternUnits="userSpaceOnUse">
              <rect width="3" height="3" fill="var(--surface-2)" />
              <circle cx="1.5" cy="1.5" r="0.7" fill="var(--red)" />
            </pattern>
          </defs>

          {/* Ring guides, faint and labelled, so the rings read as tiers. */}
          {RING_ORDER.filter((ring) => ring !== "supplier").map((ring) => (
            <g key={ring} aria-hidden="true">
              <circle
                cx={CX}
                cy={CY}
                r={RING_RADIUS[ring]}
                fill="none"
                stroke="var(--border-1)"
                strokeWidth="1"
                strokeDasharray={ring === "fourth-party" ? "3 5" : "none"}
              />
              <text
                x={CX}
                y={CY - RING_RADIUS[ring] - 7}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--text-4)"
                letterSpacing="0.09em"
              >
                {RING_LABELS[ring].toUpperCase()}
              </text>
            </g>
          ))}

          {/* Edges first, so nodes always sit above them. */}
          <g>
            {edges.map((edge) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);
              if (!from || !to) return null;
              const dim =
                connected !== null && !(connected.has(edge.from) && connected.has(edge.to));
              const width = edgeWidth(edge.strength);
              const stroke = edge.affectedByEvent
                ? "var(--red)"
                : edge.strength === "critical"
                  ? "var(--cyan)"
                  : "var(--border-2)";
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              return (
                <g key={edge.id} opacity={dim ? 0.18 : 1} aria-hidden="true">
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={stroke}
                    strokeWidth={width}
                    strokeDasharray={edge.strength === "supporting" ? "5 4" : "none"}
                    strokeLinecap="round"
                  />
                  {/* A single point of failure edge is doubled and ticked with its
                      substitutability count: one route, no alternative. */}
                  {edge.singlePointOfFailure ? (
                    <>
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="var(--amber)"
                        strokeWidth={width + 3}
                        strokeOpacity="0.28"
                      />
                      <circle
                        cx={midX}
                        cy={midY}
                        r="5"
                        fill="var(--bg)"
                        stroke="var(--amber)"
                        strokeWidth="1.5"
                      />
                      <text
                        x={midX}
                        y={midY + 3.6}
                        textAnchor="middle"
                        fontSize="11"
                        fontFamily="var(--font-mono)"
                        fill="var(--amber)"
                      >
                        1
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {placed.map((node) => {
              const dim = connected !== null && !connected.has(node.id);
              const isFocused = focusTarget === node.id;
              return (
                <g
                  key={node.id}
                  tabIndex={0}
                  role="button"
                  aria-label={describeNode(node)}
                  opacity={dim ? 0.24 : 1}
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
                  {/* Focus ring drawn rather than inherited: a CSS box-shadow does
                      not paint on an SVG shape. */}
                  {isFocused ? (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size + 11}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2"
                    />
                  ) : null}

                  {/* The 14:05 pulse, only where the event genuinely reaches. */}
                  {node.affectedByEvent ? (
                    <circle
                      className="nfr-constellation-pulse"
                      cx={node.x}
                      cy={node.y}
                      r={node.size + 7}
                      fill="none"
                      stroke="var(--red)"
                      strokeWidth="2"
                    />
                  ) : null}

                  <NodeShape node={node} patternId={patternId} />

                  {/* Divergence ring: a second, redundant cue on top of the split shape. */}
                  {node.isDiscrepancy ? (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.size + 6}
                      fill="none"
                      stroke="var(--pink)"
                      strokeWidth="1.6"
                      strokeDasharray="4 3"
                    />
                  ) : null}

                  {/* Obligation evidence position, as a textured stacked bar. */}
                  {node.evidence ? (
                    <EvidenceBar
                      counts={node.evidence}
                      x={node.x - 18}
                      y={node.y + node.size + 5}
                      patternId={patternId}
                    />
                  ) : null}

                  <NodeLabel node={node} />
                </g>
              );
            })}
          </g>

          {/* Divergence callouts. Leader lines mean the finding survives a screenshot. */}
          {divergent.map((node, index) => {
            const anchorY = 96 + index * 46;
            const anchorX = 806;
            return (
              <g key={`callout-${node.id}`} aria-hidden="true">
                <path
                  d={`M${node.x + node.size + 8},${node.y} C${(node.x + anchorX) / 2},${node.y} ${(node.x + anchorX) / 2},${anchorY} ${anchorX - 4},${anchorY}`}
                  fill="none"
                  stroke="var(--pink)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <rect
                  x={anchorX}
                  y={anchorY - 17}
                  width="182"
                  height="34"
                  rx="4"
                  fill="var(--pink-tint)"
                  stroke="var(--pink)"
                  strokeWidth="1"
                />
                <text
                  x={anchorX + 8}
                  y={anchorY - 3}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fill="var(--pink)"
                >
                  {node.id}
                </text>
                <text x={anchorX + 8} y={anchorY + 11} fontSize="11" fill="var(--text-2)">
                  {declarationShort(node.declaredIn)}
                </text>
              </g>
            );
          })}

          {/* The finding, stated inside the picture rather than beside it. */}
          {divergent.length > 0 ? (
            <g aria-hidden="true">
              <rect
                x="20"
                y="20"
                width="356"
                height="54"
                rx="6"
                fill="var(--pink-tint)"
                stroke="var(--pink)"
                strokeWidth="1.5"
              />
              <text
                x="34"
                y="42"
                fontSize="12"
                fontFamily="var(--font-mono)"
                fill="var(--pink)"
                letterSpacing="0.09em"
              >
                CHAIN DOES NOT RECONCILE
              </text>
              <text x="34" y="60" fontSize="11" fill="var(--text-2)">
                {divergent.length} of {chainCount} chain participants differ between appendix and
                register
              </text>
            </g>
          ) : null}
        </svg>

        {/* Tooltip, positioned from viewBox coordinates. The mapping is linear
            because the SVG preserves its aspect ratio and fills the container. */}
        {active ? (
          <div
            role="presentation"
            style={{
              position: "absolute",
              left: `${(active.x / VIEW_W) * 100}%`,
              top: `${(active.y / VIEW_H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 16px))",
              pointerEvents: "none",
              zIndex: 2,
              maxWidth: "280px",
              padding: "var(--space-3)",
              background: "var(--surface-raised)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-3)",
            }}
          >
            <div className="stack stack-1">
              <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                {active.label}
              </span>
              <span className="meta">
                {RING_LABELS[active.ring]} &middot; {active.id}
              </span>
              {active.detail ? (
                <span className="dim" style={{ fontSize: "var(--text-sm)" }}>
                  {active.detail}
                </span>
              ) : null}
              {active.dataLocation ? <span className="meta">Data: {active.dataLocation}</span> : null}
              {active.declaredIn ? (
                <span className="meta">Declared in: {active.declaredIn.replace(/-/g, " ")}</span>
              ) : null}
              {active.isDiscrepancy ? (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--pink)" }}>
                  {active.discrepancyNote || "Appendix and register do not agree."}
                </span>
              ) : null}
              {active.singlePointOfFailure ? (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--amber)" }}>
                  Single point of failure: no substitute is available.
                </span>
              ) : null}
              {active.affectedByEvent ? (
                <span style={{ fontSize: "var(--text-sm)", color: "var(--red)" }}>
                  Touched by the {eventMoment} event.
                </span>
              ) : null}
              {active.evidence ? (
                <span className="meta">
                  Obligations: {active.evidence.met} met, {active.evidence.partiallyMet} partial,{" "}
                  {active.evidence.notEvidenced} not evidenced, {active.evidence.breached} breached
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Legend. Shapes and textures first, colour second. */}
      <div className="row row-4 row-wrap" aria-hidden="true" style={{ fontSize: "var(--text-xs)" }}>
        <LegendSwatch label="Supplier">
          <path d={hexPath(11, 11, 9)} fill="var(--accent-tint)" stroke="var(--accent)" strokeWidth="1.5" />
        </LegendSwatch>
        <LegendSwatch label="Service">
          <rect x="3" y="3" width="16" height="16" fill="var(--cyan-tint)" stroke="var(--cyan)" strokeWidth="1.5" />
        </LegendSwatch>
        <LegendSwatch label="Subprocessor">
          <circle cx="11" cy="11" r="8" fill="var(--surface-3)" stroke="var(--text-3)" strokeWidth="1.5" />
        </LegendSwatch>
        <LegendSwatch label="Fourth party">
          <path
            d={diamondPath(11, 11, 9)}
            fill="none"
            stroke="var(--text-3)"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        </LegendSwatch>
        <LegendSwatch label="Half missing: not in appendix, or not in register">
          <path d="M11,2L2,11L11,20Z" fill="var(--surface-3)" stroke="var(--text-3)" strokeWidth="1.2" />
          <path d="M11,2L20,11L11,20Z" fill="none" stroke="var(--pink)" strokeWidth="1.4" strokeDasharray="3 2" />
        </LegendSwatch>
        <LegendSwatch label="Single point of failure">
          <line x1="2" y1="11" x2="20" y2="11" stroke="var(--amber)" strokeWidth="5" strokeOpacity="0.3" />
          <line x1="2" y1="11" x2="20" y2="11" stroke="var(--amber)" strokeWidth="2" />
        </LegendSwatch>
        <LegendSwatch label={`Touched by ${eventMoment}`}>
          <circle cx="11" cy="11" r="6" fill="var(--red-tint)" stroke="var(--red)" strokeWidth="1.4" />
          <circle cx="11" cy="11" r="9.5" fill="none" stroke="var(--red)" strokeWidth="1.2" strokeDasharray="2 2" />
        </LegendSwatch>
        <span className="row row-2">
          <span style={{ display: "inline-block", width: "22px", height: "6px", background: "var(--green)" }} />
          <span className="muted">Obligation met</span>
        </span>
        <span className="row row-2">
          <span
            style={{
              display: "inline-block",
              width: "22px",
              height: "6px",
              background:
                "repeating-linear-gradient(45deg, var(--amber) 0 1.5px, var(--amber-tint) 1.5px 4px)",
            }}
          />
          <span className="muted">Partially met</span>
        </span>
        <span className="row row-2">
          <span
            style={{
              display: "inline-block",
              width: "22px",
              height: "6px",
              background: "repeating-linear-gradient(90deg, var(--red) 0 1px, var(--surface-2) 1px 3px)",
            }}
          />
          <span className="muted">Not evidenced</span>
        </span>
      </div>

      {obligationSummary ? (
        <div className="row row-3 row-wrap">
          <span className="label">Obligation evidence across the arrangement</span>
          <Chip tone="green">{obligationSummary.met} met</Chip>
          <Chip tone="amber">{obligationSummary.partiallyMet} partially met</Chip>
          <Chip tone="red">{obligationSummary.notEvidenced} not evidenced</Chip>
          <Chip tone="red">{obligationSummary.breached} breached</Chip>
        </div>
      ) : null}

      {supplier.concentrationNote ? (
        <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
          {supplier.concentrationNote}
        </p>
      ) : null}

      {/* The same content in words. Not a summary of the chart: the chart's data. */}
      <div className="sr-only">
        <h4>Supplier chain, described</h4>
        <ul>
          {placed.map((node) => (
            <li key={`sr-${node.id}`}>{describeNode(node)}</li>
          ))}
        </ul>
        <h4>Dependency edges</h4>
        <ul>
          {edges.map((edge) => {
            const from = byId.get(edge.from);
            const to = byId.get(edge.to);
            return (
              <li key={`sr-${edge.id}`}>
                {from?.label ?? edge.from} depends on {to?.label ?? edge.to}.
                {edge.strength ? ` Dependency strength ${edge.strength}.` : ""}
                {edge.singlePointOfFailure ? " Single point of failure." : ""}
                {edge.affectedByEvent ? ` Affected by the ${eventMoment} event.` : ""}
                {edge.note ? ` ${edge.note}` : ""}
              </li>
            );
          })}
        </ul>
      </div>
    </figure>
  );
}

/* ==========================================================================
   Internals
   ========================================================================== */

function declarationShort(declaredIn: DeclarationSource | undefined): string {
  if (declaredIn === "supplier-submission") return "In register, not in appendix";
  if (declaredIn === "contract-appendix") return "In appendix, not in register";
  return "In both, recorded details differ";
}

function describeNode(node: ConstellationNode): string {
  const parts: string[] = [`${RING_LABELS[node.ring]} ${node.id}, ${node.label}.`];
  if (node.detail) parts.push(`${node.detail}.`);
  if (node.criticality) parts.push(`Criticality ${node.criticality}.`);
  if (node.dataLocation) parts.push(`Data location ${node.dataLocation}.`);
  if (node.declaredIn) parts.push(`Declared in ${node.declaredIn.replace(/-/g, " ")}.`);
  if (node.isDiscrepancy) {
    parts.push(`Divergence: ${declarationShort(node.declaredIn).toLowerCase()}.`);
    if (node.discrepancyNote) parts.push(node.discrepancyNote);
  }
  if (node.supportsCriticalFunction) parts.push("Supports a critical function.");
  if (node.singlePointOfFailure) parts.push("Single point of failure.");
  if (node.affectedByEvent) parts.push("Touched by the shared event.");
  if (node.evidence) {
    parts.push(
      `Obligations: ${node.evidence.met} met, ${node.evidence.partiallyMet} partially met, ${node.evidence.notEvidenced} not evidenced, ${node.evidence.breached} breached.`,
    );
  }
  return parts.join(" ");
}

function NodeShape({ node, patternId }: { node: PlacedNode; patternId: string }) {
  const absentFill = `url(#${patternId}-absent)`;
  const baseFill =
    node.ring === "supplier"
      ? "var(--accent-tint)"
      : node.ring === "service"
        ? "var(--cyan-tint)"
        : node.affectedByEvent
          ? "var(--red-tint)"
          : "var(--surface-2)";
  const baseStroke =
    node.ring === "supplier"
      ? "var(--accent)"
      : node.ring === "service"
        ? "var(--cyan)"
        : node.affectedByEvent
          ? "var(--red)"
          : node.supportsCriticalFunction
            ? "var(--amber)"
            : "var(--border-strong)";

  if (node.ring === "supplier") {
    return (
      <>
        <path d={hexPath(node.x, node.y, node.size)} fill={baseFill} stroke={baseStroke} strokeWidth="2" />
        <text
          x={node.x}
          y={node.y + 4}
          textAnchor="middle"
          fontSize="12"
          fontFamily="var(--font-mono)"
          fill="var(--accent)"
          fontWeight="600"
        >
          TP
        </text>
      </>
    );
  }

  // A divergent node is two halves: left for the appendix, right for the register.
  if (node.isDiscrepancy && node.declaredIn !== "both") {
    const appendixPresent = node.declaredIn === "contract-appendix";
    return (
      <>
        <path
          d={halfPath(node.x, node.y, node.size, "left", node.ring)}
          fill={appendixPresent ? baseFill : absentFill}
          stroke={appendixPresent ? baseStroke : "var(--pink)"}
          strokeWidth="1.6"
          strokeDasharray={appendixPresent ? "none" : "3 2"}
        />
        <path
          d={halfPath(node.x, node.y, node.size, "right", node.ring)}
          fill={appendixPresent ? absentFill : baseFill}
          stroke={appendixPresent ? "var(--pink)" : baseStroke}
          strokeWidth="1.6"
          strokeDasharray={appendixPresent ? "3 2" : "none"}
        />
        <line
          x1={node.x}
          y1={node.y - node.size}
          x2={node.x}
          y2={node.y + node.size}
          stroke="var(--pink)"
          strokeWidth="1.6"
        />
      </>
    );
  }

  if (node.ring === "service") {
    return (
      <rect
        x={node.x - node.size}
        y={node.y - node.size}
        width={node.size * 2}
        height={node.size * 2}
        rx="2"
        fill={baseFill}
        stroke={baseStroke}
        strokeWidth="1.8"
      />
    );
  }

  if (node.ring === "fourth-party") {
    return (
      <path
        d={diamondPath(node.x, node.y, node.size)}
        fill={baseFill}
        stroke={baseStroke}
        strokeWidth="1.6"
        // A fourth party the contract does not name is drawn with a broken outline.
        strokeDasharray={node.declaredIn === "contract-appendix" ? "none" : "4 2"}
      />
    );
  }

  return <circle cx={node.x} cy={node.y} r={node.size} fill={baseFill} stroke={baseStroke} strokeWidth="1.8" />;
}

function NodeLabel({ node }: { node: PlacedNode }) {
  if (node.ring === "supplier") {
    return (
      <text
        x={node.x}
        y={node.y + node.size + 30}
        textAnchor="middle"
        fontSize="12"
        fontFamily="var(--font-display)"
        fill="var(--text-1)"
        fontWeight="600"
      >
        {node.label}
      </text>
    );
  }
  // Labels sit radially outward of their own ring and are anchored by hemisphere,
  // so no label ever runs back across the ring it belongs to.
  const outward = polar(RING_RADIUS[node.ring] + node.size + 12, node.angle);
  const onRight = Math.cos(((node.angle - 90) * Math.PI) / 180) >= -0.05;
  return (
    <text
      x={outward.x}
      y={outward.y + 4}
      textAnchor={onRight ? "start" : "end"}
      fontSize="11"
      fill="var(--text-2)"
    >
      {node.label}
      {node.singlePointOfFailure ? (
        <tspan fill="var(--amber)" fontFamily="var(--font-mono)">
          {" "}
          spof
        </tspan>
      ) : null}
    </text>
  );
}

function EvidenceBar({
  counts,
  x,
  y,
  patternId,
}: {
  counts: ObligationEvidenceCounts;
  x: number;
  y: number;
  patternId: string;
}) {
  const total = counts.met + counts.partiallyMet + counts.notEvidenced + counts.breached;
  if (total === 0) return null;
  const width = 36;
  const segments: Array<{ key: string; value: number; fill: string }> = [
    { key: "met", value: counts.met, fill: "var(--green)" },
    { key: "partial", value: counts.partiallyMet, fill: `url(#${patternId}-partial)` },
    { key: "absent", value: counts.notEvidenced, fill: `url(#${patternId}-absent-ev)` },
    { key: "breached", value: counts.breached, fill: "var(--red)" },
  ];
  let cursor = x;
  return (
    <g aria-hidden="true">
      {segments.map((segment) => {
        const segmentWidth = (segment.value / total) * width;
        const rect = (
          <rect
            key={segment.key}
            x={cursor}
            y={y}
            width={segmentWidth}
            height="6"
            fill={segment.fill}
            stroke="var(--bg)"
            strokeWidth="0.5"
          />
        );
        cursor += segmentWidth;
        return rect;
      })}
      <rect x={x} y={y} width={width} height="6" fill="none" stroke="var(--border-2)" strokeWidth="0.75" />
    </g>
  );
}

function LegendSwatch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="row row-2">
      <svg viewBox="0 0 22 22" style={{ width: "18px", height: "18px", flexShrink: 0 }} aria-hidden="true">
        {children}
      </svg>
      <span className="muted">{label}</span>
    </span>
  );
}

export default SupplierConstellation;
