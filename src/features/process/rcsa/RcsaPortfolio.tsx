/**
 * RcsaPortfolio: the RCSA Cycle Assistant's assessment runs, above the stage
 * map.
 *
 * Rendered by the RCSA route through `ProcessRunPage`'s header slot. Each row
 * is one run read from the database (see `src/role-apps/rcsa/portfolio.ts`):
 * the assessment, its trigger, the stage it is at, the residual position of
 * its key risk and the actions it raised that are still open. The row on
 * screen is marked; every other row opens its run, so a completed cycle stays
 * reachable after an event-driven reassessment has started. It decides
 * nothing.
 *
 * Server component. No em dashes. No umlauts. No Tailwind.
 */

import type { CSSProperties } from "react";
import type { Language } from "@/i18n/labels";
import { buildRcsaPortfolio } from "@/role-apps/rcsa/portfolio";

export interface RcsaPortfolioProps {
  processRunId: string;
  language: Language;
  basePath: string;
}

const cell: CSSProperties = {
  padding: "var(--wd-2) var(--wd-3)",
  fontSize: "var(--wd-text-sm)",
  color: "var(--wd-text-secondary)",
  textAlign: "left",
  verticalAlign: "top",
  overflowWrap: "anywhere",
  borderTop: "1px solid var(--wd-border)",
};

/* A status wraps between words; its column is wide enough for the longest single word in either language. */
const words: CSSProperties = { ...cell, overflowWrap: "break-word", wordBreak: "normal" };

const head: CSSProperties = {
  ...cell,
  borderTop: "none",
  fontSize: "var(--wd-text-xs)",
  fontWeight: 500,
  color: "var(--wd-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  /* Headers wrap between words, never inside one. */
  overflowWrap: "normal",
  wordBreak: "normal",
};

export function RcsaPortfolio({ processRunId, language, basePath }: RcsaPortfolioProps) {
  const view = buildRcsaPortfolio({ language, selectedRunId: processRunId, basePath });
  if (view.rows.length === 0) return null;

  return (
    <section
      data-testid="rcsa-portfolio"
      aria-label={view.title}
      style={{
        marginTop: "var(--wd-5)",
        padding: "var(--wd-3) var(--wd-4)",
        background: "var(--wd-surface)",
        border: "1px solid var(--wd-border)",
        borderRadius: "var(--wd-radius)",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--wd-3)", flexWrap: "wrap", marginBottom: "var(--wd-2)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--wd-text-base)", fontWeight: 600, color: "var(--wd-text)" }}>{view.title}</h2>
        <span style={{ fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)" }}>{view.summary}</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "24%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "17%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={head}>{view.headers.assessment}</th>
            <th scope="col" style={head}>{view.headers.trigger}</th>
            <th scope="col" style={head}>{view.headers.stage}</th>
            <th scope="col" style={head}>{view.headers.position}</th>
            <th scope="col" style={head}>{view.headers.actions}</th>
            <th scope="col" style={head}>{view.headers.status}</th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.processRunId} data-run={row.processRunId} aria-current={row.selected ? "page" : undefined} style={row.selected ? { background: "var(--wd-accent-soft)" } : undefined}>
              <td style={{ ...cell, color: "var(--wd-text)" }}>
                {row.selected ? (
                  <span style={{ fontWeight: 600 }}>{row.assessmentTitle}</span>
                ) : (
                  <a href={row.href} style={{ color: "var(--wd-accent)", fontWeight: 500 }}>
                    {row.assessmentTitle}
                  </a>
                )}
                <span style={{ display: "block", fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)", fontFamily: "var(--wd-font-mono)" }}>{row.currentVersionId}</span>
              </td>
              <td style={cell}>{row.trigger}</td>
              <td style={cell}>{row.stage}</td>
              <td style={cell}>{row.position}</td>
              <td style={cell}>{row.openActions}</td>
              <td style={words}>{row.statusLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
