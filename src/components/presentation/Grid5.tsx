"use client";

/**
 * The group risk matrix, five by five, shared by scenes 9 and 11.
 *
 * Three properties are build rules rather than styling choices, and each of
 * them is a refusal the storyboard records for these two scenes.
 *
 * 1. A node never moves. Evidence arriving during the day changes the
 *    argument; a human changes the rating. So there is no transition on a
 *    node's position, and no code path that recomputes one.
 * 2. Two positions are never averaged, and a range is never drawn as though
 *    it were a position. A disagreement renders as two nodes joined by a
 *    bracket, which most tools cannot draw, which is why disagreements get
 *    resolved by dilution.
 * 3. The appetite boundary is a line with its policy sentence attached, not a
 *    colour band. A band says "this region is bad". A line with a sentence
 *    says "this is the threshold, this is the rule, and this is who owns it".
 *
 * The boundary is derived rather than drawn by eye: the group scale is impact
 * multiplied by likelihood, so the threshold traces the cell edges where the
 * product first reaches the threshold value. That is why it steps.
 */

import type { MatrixPosition } from "@/scenario/data/story";

const CELL_W = 74;
const CELL_H = 62;
const ORIGIN_X = 104;
const ORIGIN_Y = 26;
const VIEW_W = ORIGIN_X + CELL_W * 5 + 116;
const VIEW_H = ORIGIN_Y + CELL_H * 5 + 52;

function cellX(likelihood: number): number {
  return ORIGIN_X + (likelihood - 1) * CELL_W + CELL_W / 2;
}

function cellY(impact: number): number {
  return ORIGIN_Y + (5 - impact) * CELL_H + CELL_H / 2;
}

/** The stepped appetite boundary for a threshold on an impact times likelihood scale. */
function appetitePoints(threshold: number): string {
  const segments: Array<{ likelihood: number; y: number }> = [];
  for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
    const minImpact = Math.ceil(threshold / likelihood);
    if (minImpact <= 5) {
      segments.push({
        likelihood,
        y: ORIGIN_Y + (5 - minImpact + 1) * CELL_H,
      });
    }
  }
  if (segments.length === 0) return "";
  const points: string[] = [];
  const first = segments[0];
  if (first === undefined) return "";
  points.push(`${ORIGIN_X + (first.likelihood - 1) * CELL_W},${first.y}`);
  segments.forEach((segment, index) => {
    points.push(`${ORIGIN_X + segment.likelihood * CELL_W},${segment.y}`);
    const next = segments[index + 1];
    if (next !== undefined) {
      points.push(`${ORIGIN_X + segment.likelihood * CELL_W},${next.y}`);
    }
  });
  return points.join(" ");
}

export interface Grid5Props {
  inherent: { impact: number; likelihood: number; score: number; band: string };
  positions: readonly MatrixPosition[];
  appetiteThreshold: number;
  /** Reveal gates, so the caller drives every element from its step counter. */
  showGrid: boolean;
  showAppetite: boolean;
  /** Number of trail segments drawn, 0 to positions.length - 1. */
  trailSegments: number;
  showVectors: boolean;
  /** Indices of the two positions the bracket joins, where one is drawn. */
  bracket?: readonly [number, number];
  showBracket?: boolean;
  /** A position added later in the day. Added to the trail, never replacing it. */
  supersededBy?: { label: string; impact: number; likelihood: number } | undefined;
  showSuperseded?: boolean;
}

export function Grid5({
  inherent,
  positions,
  appetiteThreshold,
  showGrid,
  showAppetite,
  trailSegments,
  showVectors,
  bracket,
  showBracket = false,
  supersededBy,
  showSuperseded = false,
}: Grid5Props) {
  const alt = [
    `Group risk matrix, five by five. Inherent position impact ${inherent.impact}, likelihood ${inherent.likelihood}, score ${inherent.score}, band ${inherent.band}.`,
    `Appetite boundary at a residual score of ${appetiteThreshold}.`,
    ...positions.map(
      (position) =>
        `${position.label}: impact ${position.impact}, likelihood ${position.likelihood}, score ${position.score}, ${position.band}, ${position.appetitePosition === "outside-appetite" ? "outside appetite" : "within appetite"}, held by ${position.holder}.`,
    ),
  ].join(" ");

  return (
    <svg
      className="grid5"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={alt}
    >
      {/* Cells */}
      {Array.from({ length: 5 }).map((_, impactIndex) =>
        Array.from({ length: 5 }).map((__, likelihoodIndex) => (
          <rect
            key={`${impactIndex}-${likelihoodIndex}`}
            className="grid5-cell rv rv-flat"
            data-shown={showGrid ? "true" : "false"}
            x={ORIGIN_X + likelihoodIndex * CELL_W}
            y={ORIGIN_Y + impactIndex * CELL_H}
            width={CELL_W}
            height={CELL_H}
            style={{ ["--rv-delay" as string]: `${(impactIndex + likelihoodIndex) * 24}ms` }}
          />
        )),
      )}

      {/* Axes. Impact rises, likelihood runs right. */}
      {[5, 4, 3, 2, 1].map((impact, index) => (
        <text
          key={`i-${impact}`}
          x={ORIGIN_X - 12}
          y={ORIGIN_Y + index * CELL_H + CELL_H / 2 + 5}
          textAnchor="end"
          fontSize="15"
          fill="var(--text-4)"
          fontFamily="var(--font-mono)"
        >
          {impact}
        </text>
      ))}
      {[1, 2, 3, 4, 5].map((likelihood) => (
        <text
          key={`l-${likelihood}`}
          x={cellX(likelihood)}
          y={ORIGIN_Y + CELL_H * 5 + 20}
          textAnchor="middle"
          fontSize="15"
          fill="var(--text-4)"
          fontFamily="var(--font-mono)"
        >
          {likelihood}
        </text>
      ))}
      <text
        x={ORIGIN_X - 12}
        y={ORIGIN_Y - 8}
        textAnchor="end"
        fontSize="14"
        fill="var(--text-4)"
        fontFamily="var(--font-mono)"
      >
        Impact
      </text>
      <text
        x={ORIGIN_X + (CELL_W * 5) / 2}
        y={ORIGIN_Y + CELL_H * 5 + 40}
        textAnchor="middle"
        fontSize="14"
        fill="var(--text-4)"
        fontFamily="var(--font-mono)"
      >
        Likelihood
      </text>

      {/* The appetite boundary. A line, with its threshold stated on it. */}
      <polyline
        className="grid5-appetite rv-draw"
        data-shown={showAppetite ? "true" : "false"}
        points={appetitePoints(appetiteThreshold)}
        pathLength={1}
      />
      <text
        className="rv rv-flat"
        data-shown={showAppetite ? "true" : "false"}
        x="4"
        y={ORIGIN_Y + CELL_H * 5 + 40}
        fontSize="14"
        fill="var(--amber)"
        fontFamily="var(--font-mono)"
      >
        {`Appetite at ${appetiteThreshold}`}
      </text>

      {/* Inherent to residual vectors. The length is the claimed control
          effect, drawn rather than asserted. */}
      {showVectors
        ? positions.map((position, index) => (
            <line
              key={`v-${position.label}`}
              x1={cellX(inherent.likelihood)}
              y1={cellY(inherent.impact)}
              x2={cellX(position.likelihood)}
              y2={cellY(position.impact)}
              stroke="var(--border-strong)"
              strokeWidth="1"
              strokeDasharray="2 4"
              className="rv-draw"
              data-shown="true"
              pathLength={1}
              style={{ ["--rv-delay" as string]: `${index * 120}ms` }}
            />
          ))
        : null}

      {/* The movement trail. Each segment is drawn, and the segment that
          crosses the boundary is given a longer delay so the crossing reads
          as the consequence of the cycle rather than as a step in a chart. */}
      {positions.map((position, index) => {
        const previous = positions[index - 1];
        if (previous === undefined) return null;
        const crossing =
          previous.appetitePosition !== position.appetitePosition ||
          (previous.score < appetiteThreshold && position.score >= appetiteThreshold);
        return (
          <line
            key={`t-${position.label}`}
            x1={cellX(previous.likelihood)}
            y1={cellY(previous.impact)}
            x2={cellX(position.likelihood)}
            y2={cellY(position.impact)}
            stroke="var(--accent)"
            strokeWidth="2.5"
            className="rv-draw"
            data-shown={trailSegments >= index ? "true" : "false"}
            pathLength={1}
            style={{ ["--rv-delay" as string]: `${(index - 1) * 700 + (crossing ? 260 : 0)}ms` }}
          />
        );
      })}

      {/* Inherent marker */}
      <g className="rv rv-flat" data-shown={showGrid ? "true" : "false"}>
        <rect
          x={cellX(inherent.likelihood) - 13}
          y={cellY(inherent.impact) - 13}
          width="26"
          height="26"
          fill="none"
          stroke="var(--border-strong)"
          strokeDasharray="3 3"
        />
        <text
          x={cellX(inherent.likelihood)}
          y={cellY(inherent.impact) + 5}
          textAnchor="middle"
          fontSize="14"
          fill="var(--text-3)"
          fontFamily="var(--font-mono)"
        >
          {inherent.score}
        </text>
      </g>

      {/* Positions. No transition on the coordinates, by design. */}
      {positions.map((position, index) => {
        const outside = position.appetitePosition === "outside-appetite";
        return (
          <g
            key={position.label}
            className="grid5-node rv rv-flat"
            data-shown={trailSegments >= index - 1 || index === 0 ? "true" : "false"}
          >
            <circle
              cx={cellX(position.likelihood)}
              cy={cellY(position.impact)}
              r="15"
              fill={outside ? "var(--red-tint)" : "var(--green-tint)"}
              stroke={outside ? "var(--red)" : "var(--green)"}
              strokeWidth="2"
            />
            <text
              x={cellX(position.likelihood)}
              y={cellY(position.impact) + 5}
              textAnchor="middle"
              fontSize="15"
              fill="var(--text-1)"
              fontFamily="var(--font-mono)"
            >
              {position.score}
            </text>
          </g>
        );
      })}

      {/* The bracket. Two positions, both owners, no adjudication. */}
      {bracket !== undefined
        ? (() => {
            const a = positions[bracket[0]];
            const b = positions[bracket[1]];
            if (a === undefined || b === undefined) return null;
            const ax = cellX(a.likelihood);
            const ay = cellY(a.impact);
            const bx = cellX(b.likelihood);
            const by = cellY(b.impact);
            const outX = Math.max(ax, bx) + 40;
            return (
              <g>
                <path
                  className="grid5-bracket rv-draw"
                  data-shown={showBracket ? "true" : "false"}
                  d={`M ${ax + 18} ${ay} H ${outX} V ${by} H ${bx + 18}`}
                  pathLength={1}
                />
                <text
                  className="rv rv-flat"
                  data-shown={showBracket ? "true" : "false"}
                  x={outX + 6}
                  y={(ay + by) / 2}
                  fontSize="14"
                  fill="var(--text-2)"
                  fontFamily="var(--font-mono)"
                >
                  Unagreed
                </text>
              </g>
            );
          })()
        : null}

      {/* A later position is added to the history, never substituted for it. */}
      {supersededBy !== undefined ? (
        <g className="rv rv-scale" data-shown={showSuperseded ? "true" : "false"}>
          <circle
            cx={cellX(supersededBy.likelihood)}
            cy={cellY(supersededBy.impact)}
            r="20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <text
            x={cellX(supersededBy.likelihood) + 26}
            y={cellY(supersededBy.impact) - 22}
            textAnchor="start"
            fontSize="14"
            fill="var(--accent)"
            fontFamily="var(--font-mono)"
          >
            {supersededBy.label}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
