"use client";

/**
 * Quantitative charts: bar, stacked bar, line and area, waterfall, bullet.
 *
 * Drawn as SVG at their measured width with d3 scales. Bars are at most 18px
 * thick with a rounded data end and a square baseline; lines are 2px; grids
 * are hairlines; the value sits at the bar tip or the line end. Every mark is
 * a hover and focus target with a tooltip, and every value is also in the
 * table view.
 */

import { useMemo, useState } from "react";
import { scaleLinear, scalePoint, scaleBand, line as d3line, area as d3area, curveMonotoneX } from "d3";
import type { InsightVisualisation, Tone } from "@/features/insights/schema";
import { barPath, formatNumber, Legend, MarkLink, seriesColour, Tooltip, TONE_VAR, useWidth, type TooltipState } from "./chart-kit";

type Of<T extends InsightVisualisation["type"]> = Extract<InsightVisualisation, { type: T }>;

const ROW = 34;
const BAR = 16;

function labelWidth(width: number): number {
  return Math.min(190, Math.max(110, Math.round(width * 0.24)));
}

/* ==========================================================================
   Horizontal bar
   ========================================================================== */

export function BarChart({ viz }: { viz: Of<"bar"> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const left = labelWidth(width);
  const hasNotes = viz.data.some((datum) => datum.note);
  const right = hasNotes ? 120 : 56;
  const top = viz.reference ? 22 : 6;
  const height = top + viz.data.length * ROW + 24;
  const values = viz.data.map((datum) => datum.value);
  const min = Math.min(0, ...values, viz.reference?.value ?? 0);
  const max = Math.max(0, ...values, viz.reference?.value ?? 0);
  const x = scaleLinear().domain([min, max === min ? min + 1 : max]).nice(5).range([left, width - right]);
  const ticks = x.ticks(5);

  return (
    <div className="ins-chart" ref={ref} data-hovering={active ? "true" : undefined}>
      <svg width={width} height={height} role="img" aria-label={viz.title}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="ins-grid-line" x1={x(tick)} x2={x(tick)} y1={top} y2={height - 20} />
            <text className="ins-axis-text" x={x(tick)} y={height - 6} textAnchor="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        <line className="ins-baseline" x1={x(0)} x2={x(0)} y1={top - 4} y2={height - 20} />
        {viz.reference ? (
          <g>
            <line x1={x(viz.reference.value)} x2={x(viz.reference.value)} y1={top - 4} y2={height - 20} stroke="var(--wd-text-secondary)" strokeWidth={1} />
            <text className="ins-value-text" x={x(viz.reference.value) + 4} y={top - 8}>
              {viz.reference.label} {formatNumber(viz.reference.value)}
            </text>
          </g>
        ) : null}
        {viz.data.map((datum, index) => {
          const y = top + index * ROW + (ROW - BAR) / 2;
          const tone = (datum.tone ?? "neutral") as Tone;
          const text = `${datum.label}: ${datum.value > 0 ? "+" : ""}${formatNumber(datum.value)} ${viz.unit}${datum.note ? `, ${datum.note}` : ""}`;
          const tipX = datum.value >= 0 ? x(datum.value) + 6 : x(0) + 6;
          return (
            <MarkLink key={datum.id} href={datum.href} label={text}>
              <g
                className="ins-mark"
                data-active={active === datum.id ? "true" : undefined}
                onPointerMove={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setActive(datum.id);
                  setTip({ x: event.clientX - box.left, y: event.clientY - box.top, title: datum.label, value: `${datum.value > 0 ? "+" : ""}${formatNumber(datum.value)} ${viz.unit}`, rows: datum.note ? [{ label: "", value: datum.note }] : [] });
                }}
                onPointerLeave={() => {
                  setActive(null);
                  setTip(null);
                }}
                onFocus={() => {
                  setActive(datum.id);
                  setTip({ x: x(datum.value), y, title: datum.label, value: `${formatNumber(datum.value)} ${viz.unit}` });
                }}
                onBlur={() => {
                  setActive(null);
                  setTip(null);
                }}
              >
                <rect className="ins-hit" x={0} y={top + index * ROW} width={width} height={ROW} />
                <text className="ins-label-text" x={left - 10} y={y + BAR / 2 + 4} textAnchor="end">
                  {datum.label}
                </text>
                <path d={barPath(x(0), x(datum.value), y, BAR)} fill={TONE_VAR[tone]} />
                <text className="ins-strong-text" x={tipX} y={y + BAR / 2 + 4}>
                  {datum.value > 0 ? "+" : ""}
                  {formatNumber(datum.value)}
                </text>
                {datum.note ? (
                  <text className="ins-value-text" x={width - 4} y={y + BAR / 2 + 4} textAnchor="end">
                    {datum.note}
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
   Horizontal stacked bar
   ========================================================================== */

export function StackedBarChart({ viz }: { viz: Of<"stacked-bar"> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const left = labelWidth(width);
  const right = 50;
  const height = 6 + viz.data.length * ROW + 24;
  const totals = viz.data.map((datum) => viz.series.reduce((sum, series) => sum + (datum.values[series.id] ?? 0), 0));
  const x = scaleLinear().domain([0, Math.max(1, ...totals)]).nice(5).range([left, width - right]);
  const ticks = x.ticks(5).filter((tick) => Number.isInteger(tick));
  const colour = (tone: Tone) => TONE_VAR[tone];

  return (
    <div className="ins-chart" ref={ref} data-hovering={active ? "true" : undefined}>
      <svg width={width} height={height} role="img" aria-label={viz.title}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="ins-grid-line" x1={x(tick)} x2={x(tick)} y1={6} y2={height - 20} />
            <text className="ins-axis-text" x={x(tick)} y={height - 6} textAnchor="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        <line className="ins-baseline" x1={x(0)} x2={x(0)} y1={2} y2={height - 20} />
        {viz.data.map((datum, index) => {
          const y = 6 + index * ROW + (ROW - BAR) / 2;
          let cursor = 0;
          const total = totals[index] ?? 0;
          const segments = viz.series.filter((series) => (datum.values[series.id] ?? 0) > 0);
          return (
            <MarkLink key={datum.id} href={datum.href} label={`${datum.label}: ${viz.series.map((series) => `${datum.values[series.id] ?? 0} ${series.label}`).join(", ")}`}>
              <g
                className="ins-mark"
                data-active={active === datum.id ? "true" : undefined}
                onPointerMove={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setActive(datum.id);
                  setTip({
                    x: event.clientX - box.left,
                    y: event.clientY - box.top,
                    title: datum.label,
                    value: `${formatNumber(total)} ${viz.unit}`,
                    rows: viz.series.map((series) => ({ label: series.label, value: formatNumber(datum.values[series.id] ?? 0), colour: colour(series.tone ?? "neutral") })),
                  });
                }}
                onPointerLeave={() => {
                  setActive(null);
                  setTip(null);
                }}
              >
                <rect className="ins-hit" x={0} y={6 + index * ROW} width={width} height={ROW} />
                <text className="ins-label-text" x={left - 10} y={y + BAR / 2 + 4} textAnchor="end">
                  {datum.label}
                </text>
                {segments.map((series, segmentIndex) => {
                  const value = datum.values[series.id] ?? 0;
                  const x0 = x(cursor) + (segmentIndex === 0 ? 0 : 1);
                  cursor += value;
                  const x1 = x(cursor) - (segmentIndex === segments.length - 1 ? 0 : 1);
                  const last = segmentIndex === segments.length - 1;
                  return last ? (
                    <path key={series.id} d={barPath(x0, x1, y, BAR)} fill={colour(series.tone ?? "neutral")} />
                  ) : (
                    <rect key={series.id} x={x0} y={y} width={Math.max(0, x1 - x0)} height={BAR} fill={colour(series.tone ?? "neutral")} />
                  );
                })}
                <text className="ins-strong-text" x={x(total) + 6} y={y + BAR / 2 + 4}>
                  {formatNumber(total)}
                </text>
              </g>
            </MarkLink>
          );
        })}
      </svg>
      <Legend items={viz.series.map((series) => ({ label: series.label, colour: colour(series.tone ?? "neutral") }))} shape="swatch" />
      <Tooltip state={tip} width={width} />
    </div>
  );
}

/* ==========================================================================
   Line and area
   ========================================================================== */

export function LineChart({ viz }: { viz: Of<"line" | "area"> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 260;
  const margin = { top: 14, right: 130, bottom: 28, left: 40 };
  const all = viz.series.flatMap((series) => series.values.filter((value): value is number => value !== null));
  const thresholdValues = (viz.thresholds ?? []).map((threshold) => threshold.value);
  const yMin = viz.yMin ?? Math.min(0, ...all, ...thresholdValues);
  const yMax = viz.yMax ?? Math.max(...all, ...thresholdValues);
  const x = scalePoint<number>().domain(viz.periods.map((_, index) => index)).range([margin.left, width - margin.right]);
  const y = scaleLinear().domain([yMin, yMax === yMin ? yMin + 1 : yMax]).nice(4).range([height - margin.bottom, margin.top]);
  const step = Math.max(1, Math.ceil(viz.periods.length / Math.max(2, Math.floor((width - margin.left - margin.right) / 64))));
  const colours = useMemo(() => {
    let slot = 0;
    return viz.series.map((series) => {
      const tone = (series.tone ?? "neutral") as Tone;
      if (tone === "neutral") return seriesColour(0, "neutral");
      const colour = seriesColour(slot, tone);
      slot += 1;
      return colour;
    });
  }, [viz.series]);

  const path = (values: Array<number | null>) =>
    d3line<number | null>()
      .defined((value) => value !== null)
      .x((_, index) => x(index) ?? 0)
      .y((value) => y(value ?? 0))
      .curve(curveMonotoneX)(values) ?? "";
  const areaPath = (values: Array<number | null>) =>
    d3area<number | null>()
      .defined((value) => value !== null)
      .x((_, index) => x(index) ?? 0)
      .y0(y(yMin))
      .y1((value) => y(value ?? 0))
      .curve(curveMonotoneX)(values) ?? "";

  const lastIndex = viz.periods.length - 1;
  const endLabels = viz.series
    .map((series, index) => ({ series, index, value: series.values[lastIndex] ?? null }))
    .filter((entry) => entry.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const placed: number[] = [];
  const endY = new Map<number, number>();
  for (const entry of endLabels) {
    const target = y(entry.value ?? 0);
    if (placed.every((other) => Math.abs(other - target) >= 14)) {
      placed.push(target);
      endY.set(entry.index, target);
    }
  }

  const tip: TooltipState | null =
    hover === null
      ? null
      : {
          x: x(hover) ?? 0,
          y: margin.top,
          title: viz.periods[hover] ?? "",
          rows: viz.series.map((series, index) => ({ label: series.label, value: series.values[hover] === null || series.values[hover] === undefined ? "n/a" : formatNumber(series.values[hover] ?? 0), colour: colours[index] })),
        };

  return (
    <div className="ins-chart" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={viz.title}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = event.clientX - box.left;
          let nearest = 0;
          let distance = Number.POSITIVE_INFINITY;
          viz.periods.forEach((_, index) => {
            const d = Math.abs((x(index) ?? 0) - px);
            if (d < distance) {
              distance = d;
              nearest = index;
            }
          });
          setHover(nearest);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line className="ins-grid-line" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text className="ins-axis-text" x={margin.left - 8} y={y(tick) + 4} textAnchor="end">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        {viz.periods.map((period, index) =>
          index % step === 0 || index === lastIndex ? (
            <text key={period} className="ins-axis-text" x={x(index)} y={height - 8} textAnchor="middle">
              {period}
            </text>
          ) : null,
        )}
        {(viz.thresholds ?? []).map((threshold) => (
          <g key={threshold.label}>
            <line x1={margin.left} x2={width - margin.right} y1={y(threshold.value)} y2={y(threshold.value)} stroke={TONE_VAR[(threshold.tone ?? "critical") as Tone]} strokeWidth={1} opacity={0.8} />
            <text className="ins-value-text" x={margin.left + 4} y={y(threshold.value) - 5}>
              {threshold.label} {formatNumber(threshold.value)}
            </text>
          </g>
        ))}
        {viz.type === "area"
          ? viz.series.map((series, index) => <path key={`a-${series.id}`} d={areaPath(series.values)} fill={colours[index]} opacity={0.1} />)
          : null}
        {viz.series.map((series, index) => (
          <path
            key={series.id}
            d={path(series.values)}
            fill="none"
            stroke={colours[index]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={series.emphasis || viz.series.length < 3 ? 1 : 0.85}
          />
        ))}
        {viz.series.map((series, index) => {
          const value = series.values[lastIndex];
          if (value === null || value === undefined) return null;
          const labelY = endY.get(index);
          return (
            <g key={`end-${series.id}`}>
              <circle cx={x(lastIndex)} cy={y(value)} r={4} fill={colours[index]} stroke="var(--wd-surface)" strokeWidth={2} />
              {labelY !== undefined ? (
                <text className="ins-label-text" x={(x(lastIndex) ?? 0) + 10} y={labelY + 4}>
                  <tspan className="ins-strong-text">{formatNumber(value)}</tspan> {series.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={margin.top} y2={height - margin.bottom} stroke="var(--wd-text-muted)" strokeWidth={1} />
            {viz.series.map((series, index) => {
              const value = series.values[hover];
              return value === null || value === undefined ? null : (
                <circle key={series.id} cx={x(hover)} cy={y(value)} r={4} fill={colours[index]} stroke="var(--wd-surface)" strokeWidth={2} />
              );
            })}
          </g>
        ) : null}
      </svg>
      <Legend items={viz.series.map((series, index) => ({ label: series.label, colour: colours[index] ?? "var(--chart-neutral)" }))} shape="line" />
      <Tooltip state={tip} width={width} />
    </div>
  );
}

/* ==========================================================================
   Waterfall
   ========================================================================== */

export function WaterfallChart({ viz }: { viz: Of<"waterfall"> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const height = 270;
  const margin = { top: 22, right: 16, bottom: 46, left: 40 };
  let running = 0;
  const bars = viz.steps.map((step) => {
    if (step.kind === "start") {
      running = step.value;
      return { step, from: 0, to: step.value };
    }
    if (step.kind === "end") return { step, from: 0, to: step.value };
    const from = running;
    running += step.value;
    return { step, from, to: running };
  });
  const extent = bars.flatMap((bar) => [bar.from, bar.to]);
  const y = scaleLinear().domain([Math.min(0, ...extent), Math.max(...extent)]).nice(4).range([height - margin.bottom, margin.top]);
  const x = scaleBand<string>().domain(viz.steps.map((step) => step.id)).range([margin.left, width - margin.right]).padding(0.35);
  const thickness = Math.min(28, x.bandwidth());

  return (
    <div className="ins-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={viz.title}>
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line className="ins-grid-line" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text className="ins-axis-text" x={margin.left - 8} y={y(tick) + 4} textAnchor="end">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        <line className="ins-baseline" x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} />
        {bars.map((bar, index) => {
          const cx = (x(bar.step.id) ?? 0) + x.bandwidth() / 2;
          const top = y(Math.max(bar.from, bar.to));
          const bottom = y(Math.min(bar.from, bar.to));
          const tone = (bar.step.tone ?? "neutral") as Tone;
          const fill = bar.step.kind === "delta" ? TONE_VAR[tone] : bar.step.kind === "end" ? TONE_VAR[tone] : "var(--chart-neutral)";
          const label = bar.step.kind === "delta" ? `${bar.step.value > 0 ? "+" : ""}${formatNumber(bar.step.value)}` : formatNumber(bar.step.value);
          const next = bars[index + 1];
          const maxChars = Math.max(6, Math.floor(x.step() / 6.4));
          const lines: string[] = [];
          for (const word of bar.step.label.split(" ")) {
            const last = lines[lines.length - 1];
            if (last !== undefined && (last + " " + word).length <= maxChars) lines[lines.length - 1] = last + " " + word;
            else lines.push(word);
          }
          if (lines.length > 2) {
            const rest = lines.slice(1).join(" ");
            lines.splice(1, lines.length - 1, rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}.` : rest);
          }
          return (
            <g
              key={bar.step.id}
              tabIndex={0}
              aria-label={`${bar.step.label}: ${label} ${viz.unit}`}
              onPointerMove={(event) => {
                const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: event.clientX - box.left, y: event.clientY - box.top, title: bar.step.label, value: `${label} ${viz.unit}` });
              }}
              onPointerLeave={() => setTip(null)}
            >
              <rect className="ins-hit" x={x(bar.step.id)} y={margin.top} width={x.bandwidth()} height={height - margin.top - margin.bottom} />
              <rect x={cx - thickness / 2} y={top} width={thickness} height={Math.max(1, bottom - top)} rx={3} fill={fill} />
              <text className="ins-strong-text" x={cx} y={top - 6} textAnchor="middle">
                {label}
              </text>
              {next && bar.step.kind !== "end" ? (
                <line x1={cx + thickness / 2} x2={(x(next.step.id) ?? 0) + x.bandwidth() / 2 - thickness / 2} y1={y(bar.to)} y2={y(bar.to)} stroke="var(--chart-baseline)" strokeWidth={1} />
              ) : null}
              {lines.map((text, lineIndex) => (
                <text key={text} className="ins-axis-text" x={cx} y={height - margin.bottom + 16 + lineIndex * 13} textAnchor="middle">
                  {text}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      <Tooltip state={tip} width={width} />
    </div>
  );
}

/* ==========================================================================
   Bullet: actual against a target
   ========================================================================== */

export interface BulletLabels {
  target: string;
  beyond: string;
  inside: string;
}

export function BulletChart({ viz, labels }: { viz: Of<"bullet">; labels: BulletLabels }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const left = Math.min(230, Math.max(130, Math.round(width * 0.3)));
  const right = 70;
  const rowHeight = 44;
  const height = 8 + viz.data.length * rowHeight + 22;
  const max = Math.max(...viz.data.flatMap((datum) => [datum.actual, datum.target])) * 1.08;
  const x = scaleLinear().domain([0, max]).nice(5).range([left, width - right]);

  return (
    <div className="ins-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={viz.title}>
        {x.ticks(5).map((tick) => (
          <g key={tick}>
            <line className="ins-grid-line" x1={x(tick)} x2={x(tick)} y1={4} y2={height - 20} />
            <text className="ins-axis-text" x={x(tick)} y={height - 6} textAnchor="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        {viz.data.map((datum, index) => {
          const rowTop = 8 + index * rowHeight;
          const barY = rowTop + 14;
          const tone = (datum.tone ?? "neutral") as Tone;
          const over = datum.actual > datum.target;
          return (
            <MarkLink key={datum.id} href={datum.href} label={`${datum.label}: ${datum.actual} ${viz.unit} against ${datum.targetLabel}`}>
              <g
                onPointerMove={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTip({
                    x: event.clientX - box.left,
                    y: event.clientY - box.top,
                    title: datum.label,
                    value: `${formatNumber(datum.actual)} ${viz.unit}`,
                    rows: [{ label: datum.targetLabel, value: over ? `+${formatNumber(datum.actual - datum.target)}` : `${formatNumber(datum.target - datum.actual)} left` }],
                  });
                }}
                onPointerLeave={() => setTip(null)}
              >
                <rect className="ins-hit" x={0} y={rowTop} width={width} height={rowHeight} />
                <text className="ins-label-text" x={left - 12} y={barY + 4} textAnchor="end">
                  {datum.label.length > 30 ? `${datum.label.slice(0, 29)}...` : datum.label}
                </text>
                {datum.sublabel ? (
                  <text className="ins-axis-text" x={left - 12} y={barY + 18} textAnchor="end">
                    {datum.sublabel.length > 38 ? `${datum.sublabel.slice(0, 37)}...` : datum.sublabel}
                  </text>
                ) : null}
                <rect x={x(0)} y={barY - 1} width={Math.max(0, x(datum.target) - x(0))} height={14} rx={3} fill="var(--chart-neutral-soft)" />
                <path d={barPath(x(0), x(datum.actual), barY + 2, 8)} fill={TONE_VAR[tone]} />
                <line x1={x(datum.target)} x2={x(datum.target)} y1={barY - 5} y2={barY + 17} stroke="var(--wd-text)" strokeWidth={2} />
                <text className="ins-strong-text" x={Math.max(x(datum.actual), x(datum.target)) + 8} y={barY + 10}>
                  {formatNumber(datum.actual)}
                </text>
              </g>
            </MarkLink>
          );
        })}
      </svg>
      <div className="ins-legend">
        <span className="ins-legend-item">
          <span className="ins-legend-swatch" style={{ background: "var(--chart-neutral-soft)", border: "1px solid var(--wd-border)" }} aria-hidden="true" />
          {labels.target}
        </span>
        <span className="ins-legend-item">
          <span className="ins-legend-swatch" style={{ background: "var(--chart-critical)" }} aria-hidden="true" />
          {labels.beyond}
        </span>
        <span className="ins-legend-item">
          <span className="ins-legend-swatch" style={{ background: "var(--chart-good)" }} aria-hidden="true" />
          {labels.inside}
        </span>
      </div>
      <Tooltip state={tip} width={width} />
    </div>
  );
}
