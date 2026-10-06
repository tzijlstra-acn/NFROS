/**
 * OnboardingPipeline: the Third-Party Risk Manager's onboarding files, above
 * the stage map.
 *
 * Rendered by the onboarding route through `ProcessRunPage`'s header slot.
 * Each row is one onboarding file read from the database (see
 * `src/role-apps/tprm/pipeline.ts`): the supplier, the stage it is at, the
 * conditions open on it and its monitoring. It is the page's run switcher:
 * the row on screen is marked and named, every other row opens its file with
 * `?run=` in the address. It decides nothing.
 *
 * Server component. No em dashes. No umlauts. No Tailwind.
 */

import type { CSSProperties } from "react";
import type { Language } from "@/i18n/labels";
import { buildOnboardingPipeline } from "@/role-apps/tprm/pipeline";

export interface OnboardingPipelineProps {
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

export function OnboardingPipeline({ processRunId, language, basePath }: OnboardingPipelineProps) {
  const view = buildOnboardingPipeline({ language, selectedRunId: processRunId, basePath });
  if (view.rows.length < 2) return null;

  return (
    <section
      data-testid="onboarding-pipeline"
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
      {view.showing ? (
        <p data-testid="onboarding-pipeline-showing" style={{ margin: "0 0 var(--wd-2)", fontSize: "var(--wd-text-sm)", color: "var(--wd-text-secondary)" }}>
          {view.showing}
        </p>
      ) : null}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "31%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={head}>{view.headers.supplier}</th>
            <th scope="col" style={head}>{view.headers.stage}</th>
            <th scope="col" style={head}>{view.headers.conditions}</th>
            <th scope="col" style={head}>{view.headers.monitoring}</th>
            <th scope="col" style={head}>{view.headers.status}</th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.processRunId} data-run={row.processRunId} aria-current={row.selected ? "page" : undefined} style={row.selected ? { background: "var(--wd-accent-soft)" } : undefined}>
              <td style={{ ...cell, color: "var(--wd-text)" }}>
                {row.selected ? (
                  <span style={{ fontWeight: 600 }}>{row.supplierName}</span>
                ) : (
                  <a href={row.href} style={{ color: "var(--wd-accent)", fontWeight: 500 }}>
                    {row.supplierName}
                  </a>
                )}
                <span style={{ display: "block", fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)", fontFamily: "var(--wd-font-mono)" }}>{row.supplierId}</span>
              </td>
              <td style={cell}>{row.stage}</td>
              <td style={cell}>{row.openConditions}</td>
              <td style={cell}>{row.monitoring}</td>
              <td style={cell}>{row.statusLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
