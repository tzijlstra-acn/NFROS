"use client";

/**
 * Structural charts: heatmap, treemap, layered network, timeline.
 *
 * The heatmap is an HTML grid rather than SVG: its cells are text-bearing
 * marks that must stay readable and focusable at any width. The network is
 * laid out in three fixed columns (provider, third party, service), sorted
 * so links cross as little as a simple ordering allows, because the reader's
 * question is "what rests on what", not "what does the graph look like".
 */

import { useMemo, useState } from "react";
import { hierarchy, scaleTime, treemap, treemapSquarify } from "d3";
import type { InsightVisualisation, Tone } from "@/features/insights/schema";
import { formatNumber, MarkLink, Tooltip, TONE_VAR, useWidth, type TooltipState } from "./chart-kit";

type Of<T extends InsightVisualisation["type"]> = Extract<InsightVisualisation, { type: T }>;

/* ==========================================================================
   Heatmap
   ========================================================================== */

export function Heatmap({ viz }: { viz: Of<"heatmap"> }) {
  const [focus, setFocus] = useState<string | null>(null);
  const cellAt = useMemo(() => {
    const map = new Map<string, (typeof viz.cells)[number]>();
    for (const cell of viz.cells) map.set(`${cell.row}|${cell.column}`, cell);
    return map;
  }, [viz.cells]);
  const legendLabel = (tone: Tone) => viz.legend.find((entry) => entry.tone === tone)?.label ?? "";
  return (
    <div className="ins-chart">
      <div
        className="ins-heat"
        role="grid"
        aria-label={viz.title}
        style={{ gridTemplateColumns: `minmax(150px, 1.4fr) repeat(${viz.columns.length}, minmax(38px, 1fr))` }}
      >
        <div role="columnheader" />
        {viz.columns.map((column) => (
          <div key={column} className="ins-heat-head" role="columnheader">
            {column}
          </div>
        ))}
        {viz.rows.map((row) => (
          <div key={row.id} role="row" style={{ display: "contents" }}>
            <div className="ins-heat-row-label" role="rowheader">
              {row.href ? <a href={row.href}>{row.label}</a> : <strong>{row.label}</strong>}
              {row.sublabel ? <span title={row.sublabel}>{row.sublabel}</span> : null}
            </div>
            {viz.columns.map((column) => {
              const cell = cellAt.get(`${row.id}|${column}`);
              const tone = (cell?.tone ?? "neutral") as Tone;
              const key = `${row.id}|${column}`;
              return (
                <div
                  key={key}
                  className="ins-heat-cell"
                  role="gridcell"
                  tabIndex={0}
                  data-tone={tone}
                  aria-label={`${row.label}, ${column}: ${legendLabel(tone)}${cell?.text ? `, ${cell.text}` : ""}`}
                  title={`${row.label}, ${column}: ${legendLabel(tone)}${cell?.text ? ` (${cell.text})` : ""}`}
                  onFocus={() => setFocus(key)}
                  onBlur={() => setFocus(null)}
                  data-focused={focus === key ? "true" : undefined}
                >
                  {cell?.text ?? ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="ins-legend" aria-label="Legend">
        {viz.legend.map((entry) => (
          <span key={entry.label} className="ins-legend-item">
            <span className="ins-legend-swatch" style={{ background: entry.tone === "neutral" ? "var(--chart-neutral-soft)" : entry.tone === "good" ? "var(--chart-good-soft)" : TONE_VAR[entry.tone as Tone], border: entry.tone === "neutral" || entry.tone === "good" ? "1px solid var(--wd-border)" : undefined }} aria-hidden="true" />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Treemap
   ========================================================================== */

export function TreemapChart({ viz }: { viz: Of<"treemap"> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const height = 300;
  const layout = useMemo(() => {
    const root = hierarchy<{ id: string; label: string; value?: number; tone?: Tone; href?: string; children?: unknown[] }>({
      id: "root",
      label: "root",
      children: viz.groups.map((group) => ({ id: group.id, label: group.label, tone: group.tone, children: group.children })),
    } as never)
      .sum((node) => (node as { value?: number }).value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    type Datum = { id: string; label: string; value?: number; tone?: Tone; href?: string };
    return treemap<Datum>().tile(treemapSquarify).size([width, height]).paddingOuter(2).paddingTop(20).paddingInner(2).round(true)(root as unknown as Parameters<ReturnType<typeof treemap<Datum>>>[0]);
  }, [viz.groups, width]);

  return (
    <div className="ins-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={viz.title}>
        {layout.descendants().filter((node) => node.depth === 1).map((node) => {
          const data = node.data as unknown as { id: string; label: string };
          return (
            <g key={data.id}>
              <rect x={node.x0} y={node.y0} width={node.x1 - node.x0} height={node.y1 - node.y0} rx={6} fill="var(--wd-surface-subtle)" stroke="var(--wd-border)" />
              <text className="ins-label-text" x={node.x0 + 8} y={node.y0 + 14}>
                {data.label} <tspan className="ins-value-text">{formatNumber(node.value ?? 0)}</tspan>
              </text>
            </g>
          );
        })}
        {layout.leaves().map((leaf) => {
          const data = leaf.data as unknown as { id: string; label: string; value: number; tone?: Tone; href?: string };
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          const tone = (data.tone ?? "neutral") as Tone;
          return (
            <MarkLink key={data.id} href={data.href} label={`${data.label}: ${data.value} ${viz.unit}`}>
              <g
                onPointerMove={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({ x: event.clientX - box.left, y: event.clientY - box.top, title: data.label, value: `${formatNumber(data.value)} ${viz.unit}` });
                }}
                onPointerLeave={() => setTip(null)}
              >
                <rect x={leaf.x0} y={leaf.y0} width={w} height={h} rx={4} fill={TONE_VAR[tone]} opacity={tone === "neutral" ? 0.55 : 0.9} />
                {w > 60 && h > 26 ? (
                  <text x={leaf.x0 + 6} y={leaf.y0 + 16} fill={tone === "watch" ? "var(--chart-on-watch)" : "var(--chart-on-fill)"} fontSize={11}>
                    {data.label.length * 6.2 > w - 10 ? `${data.label.slice(0, Math.max(3, Math.floor((w - 16) / 6.2)))}...` : data.label}
                  </text>
                ) : null}
              </g>
            </MarkLink>
          );
        })}
      </svg>
      <Tooltip state={tip} width={width} />
    </div>
  );
}

/* ==========================================================================
   Network, three layers
   ========================================================================== */

export interface NetworkLabels {
  concentration: string;
  undeclared: string;
  deteriorating: string;
}

export function NetworkView({ viz, labels }: { viz: Of<"network">; labels: NetworkLabels }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const nodeHeight = 30;
  const gap = 10;
  const layerIds = viz.layers.map((layer) => layer.id);
  const columns = layerIds.map((id) => viz.nodes.filter((node) => node.layer === id));

  /* Order the middle and right layers by the position of what they connect to on their left. */
  const ordered = useMemo(() => {
    const positions = new Map<string, number>();
    const result: Array<typeof viz.nodes> = [];
    columns.forEach((nodes, layerIndex) => {
      const sorted =
        layerIndex === 0
          ? nodes
          : [...nodes].sort((a, b) => {
              const mean = (id: string) => {
                const sources = viz.links.filter((link) => link.target === id).map((link) => positions.get(link.source) ?? 0);
                return sources.length ? sources.reduce((sum, value) => sum + value, 0) / sources.length : 0;
              };
              return mean(a.id) - mean(b.id);
            });
      sorted.forEach((node, index) => positions.set(node.id, index));
      result.push(sorted);
    });
    return result;
  }, [columns, viz.links]);

  const tallest = Math.max(...ordered.map((nodes) => nodes.length));
  const height = 34 + tallest * (nodeHeight + gap);
  const colWidth = Math.min(220, (width - 80) / 3);
  const xFor = (layer: number) => (layer === 0 ? 0 : layer === 1 ? (width - colWidth) / 2 : width - colWidth);
  const place = new Map<string, { x: number; y: number }>();
  ordered.forEach((nodes, layer) => {
    const offset = 30 + ((tallest - nodes.length) * (nodeHeight + gap)) / 2;
    nodes.forEach((node, index) => place.set(node.id, { x: xFor(layer), y: offset + index * (nodeHeight + gap) }));
  });
  const related = (id: string) => viz.links.some((link) => (link.source === active && link.target === id) || (link.target === active && link.source === id)) || id === active;

  return (
    <div className="ins-chart" ref={ref} data-hovering={active ? "true" : undefined}>
      <svg width={width} height={height} role="img" aria-label={viz.title}>
        {viz.layers.map((layer, index) => (
          <text key={layer.id} className="ins-axis-text" x={xFor(index) + (index === 2 ? colWidth : 0)} y={14} textAnchor={index === 2 ? "end" : "start"}>
            {layer.label}
          </text>
        ))}
        {viz.links.map((link, index) => {
          const from = place.get(link.source);
          const to = place.get(link.target);
          if (!from || !to) return null;
          const x1 = from.x + colWidth;
          const y1 = from.y + nodeHeight / 2;
          const x2 = to.x;
          const y2 = to.y + nodeHeight / 2;
          const mid = (x1 + x2) / 2;
          const on = !active || link.source === active || link.target === active;
          return (
            <path
              key={`${link.source}-${link.target}-${index}`}
              className="ins-link"
              data-tone={link.tone}
              data-dashed={link.dashed ? "true" : undefined}
              d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
              opacity={on ? 1 : 0.15}
            />
          );
        })}
        {ordered.flat().map((node) => {
          const point = place.get(node.id);
          if (!point) return null;
          const on = !active || related(node.id);
          const noteWidth = node.note && colWidth > 170 ? node.note.length * 6 + 14 : 8;
          const room = Math.floor((colWidth - 22 - noteWidth) / 6.6);
          const label = node.label.length > room ? `${node.label.slice(0, Math.max(4, room - 3))}...` : node.label;
          return (
            <g key={node.id} className="ins-node" data-tone={node.tone} opacity={on ? 1 : 0.3} onPointerEnter={() => setActive(node.id)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(node.id)} onBlur={() => setActive(null)}>
              <MarkLink href={node.href} label={`${node.label}${node.note ? `, ${node.note}` : ""}`}>
                <rect x={point.x} y={point.y} width={colWidth} height={nodeHeight} rx={6} />
                <circle cx={point.x + 12} cy={point.y + nodeHeight / 2} r={4} fill={TONE_VAR[(node.tone ?? "neutral") as Tone]} />
                <text className="ins-label-text" x={point.x + 22} y={point.y + nodeHeight / 2 + 4}>
                  {label}
                </text>
                {node.note && colWidth > 170 ? (
                  <text className="ins-axis-text" x={point.x + colWidth - 8} y={point.y + nodeHeight / 2 + 4} textAnchor="end">
                    {node.note}
                  </text>
                ) : null}
              </MarkLink>
            </g>
          );
        })}
      </svg>
      <div className="ins-legend" aria-label="Legend">
        <span className="ins-legend-item"><span className="ins-legend-line" style={{ background: "var(--chart-critical)" }} aria-hidden="true" />{labels.concentration}</span>
        {viz.links.some((link) => link.dashed) ? (
          <span className="ins-legend-item"><span className="ins-legend-line" style={{ background: "repeating-linear-gradient(90deg, var(--chart-baseline) 0 4px, transparent 4px 7px)" }} aria-hidden="true" />{labels.undeclared}</span>
        ) : null}
        {viz.nodes.some((node) => node.tone === "warning") ? (
          <span className="ins-legend-item"><span className="ins-status-dot" data-tone="warning" aria-hidden="true" />{labels.deteriorating}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ==========================================================================
   Timeline with lanes
   ========================================================================== */

const LABEL_CHARS = 16;
const CHAR_WIDTH = 5.9;

function shortLabel(label: string): string {
  return label.length > LABEL_CHARS ? `${label.slice(0, LABEL_CHARS - 1)}...` : label;
}

/**
 * Places event labels so they never overlap: per lane, left to right, a
 * label goes above its mark when there is room, else below, else nowhere
 * (the tooltip and the table carry it).
 */
function placeLabels<E extends { lane: string; label: string; date: string }>(events: readonly E[], xOf: (event: E) => number, width: number) {
  const ends = new Map<string, { up: number; down: number }>();
  return [...events]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => {
      const cx = xOf(event);
      const half = (shortLabel(event.label).length * CHAR_WIDTH) / 2;
      const lane = ends.get(event.lane) ?? { up: -Infinity, down: -Infinity };
      let row: "up" | "down" | "none" = "none";
      if (cx - half > lane.up + 6 && cx + half < width) {
        row = "up";
        lane.up = cx + half;
      } else if (cx - half > lane.down + 6 && cx + half < width) {
        row = "down";
        lane.down = cx + half;
      }
      ends.set(event.lane, lane);
      return { event, row };
    });
}

export function TimelineView({ viz }: { viz: Of<"timeline"> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const laneHeight = 46;
  const left = Math.min(170, Math.max(110, Math.round(width * 0.2)));
  const height = 24 + viz.lanes.length * laneHeight + 24;
  const x = scaleTime()
    .domain([new Date(`${viz.start}T00:00:00Z`), new Date(`${viz.end}T00:00:00Z`)])
    .range([left + 10, width - 16]);
  const ticks = x.ticks(Math.max(3, Math.floor((width - left) / 110)));
  const today = x(new Date(`${viz.today}T00:00:00Z`));
  const format = (date: Date) => `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.`;

  return (
    <div className="ins-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={viz.title}>
        {ticks.map((tick) => (
          <g key={tick.toISOString()}>
            <line className="ins-grid-line" x1={x(tick)} x2={x(tick)} y1={18} y2={height - 22} />
            <text className="ins-axis-text" x={x(tick)} y={height - 6} textAnchor="middle">
              {format(tick)}
              {tick.getUTCMonth() === 0 ? tick.getUTCFullYear() : ""}
            </text>
          </g>
        ))}
        {viz.lanes.map((lane, index) => (
          <g key={lane.id}>
            <line className="ins-baseline" x1={left} x2={width - 8} y1={24 + index * laneHeight + laneHeight / 2} y2={24 + index * laneHeight + laneHeight / 2} />
            <text className="ins-label-text" x={left - 10} y={24 + index * laneHeight + laneHeight / 2 + 4} textAnchor="end">
              {lane.label}
            </text>
          </g>
        ))}
        {today >= left && today <= width ? (
          <g>
            <line x1={today} x2={today} y1={14} y2={height - 22} stroke="var(--wd-accent)" strokeWidth={1.5} />
            <text className="ins-value-text" x={today + 4} y={12}>
              {format(new Date(`${viz.today}T00:00:00Z`))}
            </text>
          </g>
        ) : null}
        {placeLabels(viz.events, (event) => x(new Date(`${event.date}T00:00:00Z`)), width).map(({ event, row }) => {
          const laneIndex = Math.max(0, viz.lanes.findIndex((lane) => lane.id === event.lane));
          const cx = x(new Date(`${event.date}T00:00:00Z`));
          const cy = 24 + laneIndex * laneHeight + laneHeight / 2;
          const labelUp = row === "up";
          return (
            <MarkLink key={event.id} href={event.href} label={`${event.label}, ${event.date.split("-").reverse().join(".")}`}>
              <g
                onPointerMove={(pointer) => {
                  const box = (pointer.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({ x: pointer.clientX - box.left, y: pointer.clientY - box.top, title: viz.lanes[laneIndex]?.label ?? "", value: `${event.label}, ${event.date.split("-").reverse().join(".")}` });
                }}
                onPointerLeave={() => setTip(null)}
              >
                <circle className="ins-hit" cx={cx} cy={cy} r={12} />
                <circle cx={cx} cy={cy} r={5} fill={TONE_VAR[(event.tone ?? "neutral") as Tone]} stroke="var(--wd-surface)" strokeWidth={2} />
                {row !== "none" ? (
                  <text className="ins-value-text" x={cx} y={labelUp ? cy - 10 : cy + 18} textAnchor="middle">
                    {shortLabel(event.label)}
                  </text>
                ) : null}
              </g>
            </MarkLink>
          );
        })}
      </svg>
      <Tooltip state={tip} width={width} />
    </div>
  );
}
