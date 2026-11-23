"use client";

/**
 * The pieces every insight chart shares.
 *
 *   colours   status tones map to the status tokens, series slots to the
 *             series tokens; the two families are never mixed;
 *   width     charts draw at their real pixel width, measured, so text stays
 *             at its real size on every screen instead of scaling with a
 *             viewBox;
 *   tooltip   one positioned readout per chart, value first, filled with
 *             text nodes only (labels come from records, which are data);
 *   legend    present for two or more series, mirroring the mark shape;
 *   table     every visual converts to rows, so no value is reachable only
 *             through hover or colour.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { InsightVisualisation, Tone } from "@/features/insights/schema";

export const TONE_VAR: Record<Tone, string> = {
  good: "var(--chart-good)",
  neutral: "var(--chart-neutral)",
  watch: "var(--chart-watch)",
  warning: "var(--chart-warning)",
  critical: "var(--chart-critical)",
  accent: "var(--chart-accent)",
};

/** Series identity, in fixed order. A series marked neutral is a comparator and draws grey. */
export const SERIES_VAR = ["var(--chart-s1)", "var(--chart-s2)", "var(--chart-s3)"];

export function seriesColour(index: number, tone: Tone): string {
  if (tone === "neutral") return "var(--chart-neutral)";
  return SERIES_VAR[index % SERIES_VAR.length] ?? SERIES_VAR[0]!;
}

/** Measures the element's width; starts at a sensible default so the first paint is not empty. */
export function useWidth<T extends HTMLElement>(initial = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.max(280, Math.floor(element.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  value?: string;
  rows?: Array<{ label: string; value: string; colour?: string }>;
}

export function Tooltip({ state, width }: { state: TooltipState | null; width: number }) {
  if (!state) return null;
  const left = Math.min(Math.max(8, state.x + 12), Math.max(8, width - 290));
  return (
    <div className="ins-tooltip" style={{ left, top: Math.max(0, state.y - 8) }} role="status" aria-live="polite">
      {state.value ? <div className="ins-tooltip-value">{state.value}</div> : null}
      <div>{state.title}</div>
      {state.rows?.map((row) => (
        <div key={row.label} className="ins-tooltip-row">
          {row.colour ? <span className="ins-legend-line" style={{ background: row.colour }} aria-hidden="true" /> : null}
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items, shape }: { items: Array<{ label: string; colour: string }>; shape: "swatch" | "line" }) {
  if (items.length < 2) return null;
  return (
    <div className="ins-legend" aria-label="Legend">
      {items.map((item) => (
        <span key={item.label} className="ins-legend-item">
          <span className={shape === "line" ? "ins-legend-line" : "ins-legend-swatch"} style={{ background: item.colour }} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** A rounded data end, square at the baseline: a horizontal bar from x0 to x1. */
export function barPath(x0: number, x1: number, y: number, height: number, radius = 4): string {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const r = Math.min(radius, (right - left) / 2, height / 2);
  if (right - left < 0.5) return "";
  if (x1 >= x0) {
    return `M${left},${y}H${right - r}Q${right},${y} ${right},${y + r}V${y + height - r}Q${right},${y + height} ${right - r},${y + height}H${left}Z`;
  }
  return `M${right},${y}H${left + r}Q${left},${y} ${left},${y + r}V${y + height - r}Q${left},${y + height} ${left + r},${y + height}H${right}Z`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 10_000) return `${Math.round(value / 1000)}K`;
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { maximumFractionDigits: abs < 10 ? 2 : 1 });
}

export interface TableModel {
  columns: Array<{ id: string; label: string; align: "start" | "end" }>;
  rows: Array<{ id: string; cells: Record<string, string | number | null>; tone: Tone; href?: string }>;
}

/** Every visual as a table: the alternative to the drawing, never a lesser one. */
export function tableFor(viz: InsightVisualisation, labels: { item: string; value: string }): TableModel {
  switch (viz.type) {
    case "table":
      return { columns: viz.columns.map((column) => ({ ...column, align: column.align ?? "start" })), rows: viz.rows.map((row) => ({ ...row, tone: row.tone ?? "neutral" })) };
    case "bar":
      return {
        columns: [{ id: "label", label: labels.item, align: "start" }, { id: "value", label: `${labels.value} (${viz.unit})`, align: "end" }, { id: "note", label: "", align: "start" }],
        rows: viz.data.map((datum) => ({ id: datum.id, cells: { label: datum.label, value: datum.value, note: datum.note ?? "" }, tone: datum.tone ?? "neutral", href: datum.href })),
      };
    case "stacked-bar":
      return {
        columns: [{ id: "label", label: labels.item, align: "start" }, ...viz.series.map((series) => ({ id: series.id, label: series.label, align: "end" as const }))],
        rows: viz.data.map((datum) => ({ id: datum.id, cells: { label: datum.label, ...datum.values }, tone: "neutral" as Tone, href: datum.href })),
      };
    case "line":
    case "area":
      return {
        columns: [{ id: "period", label: labels.item, align: "start" }, ...viz.series.map((series) => ({ id: series.id, label: series.label, align: "end" as const }))],
        rows: viz.periods.map((period, index) => ({
          id: period,
          cells: { period, ...Object.fromEntries(viz.series.map((series) => [series.id, series.values[index] ?? null])) },
          tone: "neutral" as Tone,
        })),
      };
    case "heatmap":
      return {
        columns: [{ id: "row", label: labels.item, align: "start" }, ...viz.columns.map((column) => ({ id: column, label: column, align: "end" as const }))],
        rows: viz.rows.map((row) => ({
          id: row.id,
          cells: { row: row.label, ...Object.fromEntries(viz.cells.filter((cell) => cell.row === row.id).map((cell) => [cell.column, cell.text || "n/t"])) },
          tone: "neutral" as Tone,
          href: row.href,
        })),
      };
    case "treemap":
      return {
        columns: [{ id: "group", label: labels.item, align: "start" }, { id: "label", label: "", align: "start" }, { id: "value", label: `${labels.value} (${viz.unit})`, align: "end" }],
        rows: viz.groups.flatMap((group) => group.children.map((child) => ({ id: child.id, cells: { group: group.label, label: child.label, value: child.value }, tone: child.tone ?? "neutral", href: child.href }))),
      };
    case "network": {
      const byId = new Map(viz.nodes.map((node) => [node.id, node]));
      return {
        columns: [{ id: "from", label: viz.layers[0]?.label ?? "", align: "start" }, { id: "to", label: viz.layers[1]?.label ?? "", align: "start" }, { id: "declared", label: "", align: "start" }],
        rows: viz.links.map((link, index) => ({
          id: `${link.source}-${link.target}-${index}`,
          cells: { from: byId.get(link.source)?.label ?? link.source, to: byId.get(link.target)?.label ?? link.target, declared: link.dashed ? "not declared" : "" },
          tone: link.tone ?? "neutral",
        })),
      };
    }
    case "timeline":
      return {
        columns: [{ id: "date", label: "Date", align: "start" }, { id: "lane", label: "", align: "start" }, { id: "label", label: labels.item, align: "start" }],
        rows: [...viz.events].sort((a, b) => a.date.localeCompare(b.date)).map((event) => ({
          id: event.id,
          cells: { date: event.date.split("-").reverse().join("."), lane: viz.lanes.find((lane) => lane.id === event.lane)?.label ?? event.lane, label: event.label },
          tone: event.tone ?? "neutral",
          href: event.href,
        })),
      };
    case "bullet":
      return {
        columns: [{ id: "label", label: labels.item, align: "start" }, { id: "actual", label: `${labels.value} (${viz.unit})`, align: "end" }, { id: "target", label: "", align: "end" }],
        rows: viz.data.map((datum) => ({ id: datum.id, cells: { label: datum.label, actual: datum.actual, target: datum.targetLabel }, tone: datum.tone ?? "neutral", href: datum.href })),
      };
    case "waterfall":
      return {
        columns: [{ id: "label", label: labels.item, align: "start" }, { id: "value", label: `${labels.value} (${viz.unit})`, align: "end" }],
        rows: viz.steps.map((step) => ({ id: step.id, cells: { label: step.label, value: step.kind === "delta" && step.value > 0 ? `+${step.value}` : step.value }, tone: step.tone ?? "neutral" })),
      };
    default:
      return { columns: [], rows: [] };
  }
}

/** A link inside an SVG that the router can follow, keyboard reachable. */
export function MarkLink({ href, label, children }: { href?: string; label: string; children: ReactNode }) {
  if (!href) return <g aria-label={label}>{children}</g>;
  return (
    <a href={href} aria-label={label}>
      {children}
    </a>
  );
}
