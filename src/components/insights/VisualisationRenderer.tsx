"use client";

/**
 * Draws one visual from an insight, inside its frame.
 *
 * The frame carries the conclusion title, the subtitle, an "Explain this
 * chart" control and a "Show as table" control. The table view is the same
 * data as rows, never a lesser version, so a reader who cannot use the chart
 * (or the colour, or the hover) loses nothing. A type the renderer does not
 * know cannot arrive here: the schema refuses it first.
 */

import { useState } from "react";
import { IconChartBar, IconInfoCircle, IconTable } from "@tabler/icons-react";
import type { InsightVisualisation } from "@/features/insights/schema";
import { tableFor } from "./chart-kit";
import { BarChart, BulletChart, LineChart, StackedBarChart, WaterfallChart } from "./charts-basic";
import { Heatmap, NetworkView, TimelineView, TreemapChart } from "./charts-structure";

type Language = "en" | "de";

const COPY = {
  explain: { en: "Explain this chart", de: "Diagramm erklaeren" },
  hideExplain: { en: "Hide explanation", de: "Erklaerung ausblenden" },
  table: { en: "Show as table", de: "Als Tabelle" },
  chart: { en: "Show as chart", de: "Als Diagramm" },
  item: { en: "Item", de: "Eintrag" },
  value: { en: "Value", de: "Wert" },
  concentration: { en: "Most concentrated provider", de: "Am staerksten konzentrierter Anbieter" },
  undeclared: { en: "Not declared by the supplier", de: "Vom Dienstleister nicht gemeldet" },
  deteriorating: { en: "Deteriorating", de: "Verschlechtert" },
  target: { en: "Tolerance or objective", de: "Toleranz oder Ziel" },
  beyond: { en: "Beyond it", de: "Ueberschritten" },
  inside: { en: "Inside it", de: "Eingehalten" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export function DataTable({ viz, language }: { viz: InsightVisualisation; language: Language }) {
  const model = tableFor(viz, { item: pick(COPY.item, language), value: pick(COPY.value, language) });
  return (
    <div className="ins-table-wrap">
      <table className="ins-table">
        <caption className="wd-sr-only">{viz.title}</caption>
        <thead>
          <tr>
            {model.columns.map((column) => (
              <th key={column.id} data-align={column.align} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={row.id} data-href={row.href ? "true" : undefined}>
              {model.columns.map((column, index) => {
                const value = row.cells[column.id];
                const text = value === null || value === undefined ? "" : String(value);
                return (
                  <td key={column.id} data-align={column.align}>
                    {index === 0 ? (
                      <span className="ins-row-tone">
                        {row.tone !== "neutral" ? <span className="ins-status-dot" data-tone={row.tone} aria-hidden="true" /> : null}
                        {row.href ? <a href={row.href}>{text}</a> : text}
                      </span>
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VisualisationBody({ viz, language }: { viz: InsightVisualisation; language: Language }) {
  switch (viz.type) {
    case "bar":
      return <BarChart viz={viz} />;
    case "stacked-bar":
      return <StackedBarChart viz={viz} />;
    case "line":
    case "area":
      return <LineChart viz={viz} />;
    case "waterfall":
      return <WaterfallChart viz={viz} />;
    case "bullet":
      return <BulletChart viz={viz} labels={{ target: pick(COPY.target, language), beyond: pick(COPY.beyond, language), inside: pick(COPY.inside, language) }} />;
    case "heatmap":
      return <Heatmap viz={viz} />;
    case "treemap":
      return <TreemapChart viz={viz} />;
    case "network":
      return <NetworkView viz={viz} labels={{ concentration: pick(COPY.concentration, language), undeclared: pick(COPY.undeclared, language), deteriorating: pick(COPY.deteriorating, language) }} />;
    case "timeline":
      return <TimelineView viz={viz} />;
    case "table":
      return <DataTable viz={viz} language={language} />;
    default:
      return null;
  }
}

export function VisualisationFrame({
  viz,
  language,
  primary = false,
}: {
  viz: InsightVisualisation;
  language: Language;
  primary?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  const [explain, setExplain] = useState(false);
  const isTable = viz.type === "table";
  const Heading = primary ? "h2" : "h3";
  return (
    <section className="ins-card" aria-label={viz.title} data-testid={`viz-${viz.type}`}>
      <div className="ins-card-head">
        <Heading className="ins-section-title">{viz.title}</Heading>
        {viz.subtitle ? <p className="ins-section-sub">{viz.subtitle}</p> : null}
        {!isTable ? (
          <div className="ins-chart-tools ins-no-print">
            {viz.explanation ? (
              <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" aria-expanded={explain} onClick={() => setExplain((open) => !open)}>
                <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" />
                {pick(explain ? COPY.hideExplain : COPY.explain, language)}
              </button>
            ) : null}
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" aria-pressed={asTable} onClick={() => setAsTable((table) => !table)}>
              {asTable ? <IconChartBar size={14} stroke={1.8} aria-hidden="true" /> : <IconTable size={14} stroke={1.8} aria-hidden="true" />}
              {pick(asTable ? COPY.chart : COPY.table, language)}
            </button>
          </div>
        ) : null}
        {explain && viz.explanation ? <p className="ins-explain">{viz.explanation}</p> : null}
      </div>
      <div className="ins-card-body ins-reveal">
        {asTable && !isTable ? <DataTable viz={viz} language={language} /> : <VisualisationBody viz={viz} language={language} />}
      </div>
    </section>
  );
}
