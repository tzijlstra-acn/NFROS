"use client";

/**
 * AppendixSlideV22
 *
 * Renders a single appendix slide. Dispatches on content.kind to render the
 * appropriate table, list, or flow layout. Shows a "Return to slide N" button
 * when returnToCore is set (e.g., arrived here via an AppendixRefBar chip).
 *
 * Slide counter format: "A.08 of A.23"
 */

import React from "react";
import { APPENDIX_SLIDES, type AppendixSlide, type AppendixContent } from "../data/appendix";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppendixSlideV22Props {
  appendixId: string;
  returnToCore: number | null; // 0-based core index, null if not set
  onReturn: () => void;
}

// ---------------------------------------------------------------------------
// Content renderers
// ---------------------------------------------------------------------------

function renderStatusTable(content: Extract<AppendixContent, { kind: "status-table" }>) {
  return (
    <table className="pv22-status-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Status</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {content.rows.map((row, i) => (
          <tr key={i}>
            <td>{row.label}</td>
            <td>
              <span className={`pv22-status ${statusClass(row.status)}`}>
                {row.status}
              </span>
            </td>
            <td style={{ color: "var(--pv22-color-secondary)", fontSize: "var(--pv22-text-xs)" }}>
              {row.note ?? ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "implemented") return "pv22-status--implemented";
  if (s.startsWith("demo")) return "pv22-status--demo-only";
  if (s === "planned") return "pv22-status--planned";
  if (s.startsWith("configured") || s.startsWith("designed")) return "pv22-status--configured";
  return "";
}

function renderCapabilityMap(content: Extract<AppendixContent, { kind: "capability-map" }>) {
  return (
    <div>
      {content.groups.map((group, i) => (
        <div key={i} className="pv22-capability-group">
          <div className="pv22-capability-group__name">{group.name}</div>
          <ul className="pv22-capability-group__items">
            {group.items.map((item, j) => (
              <li key={j} className="pv22-capability-group__item">{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function renderServiceStack(content: Extract<AppendixContent, { kind: "service-stack" }>) {
  return (
    <div className="pv22-service-stack-table">
      {content.tiers.map((tier, i) => (
        <div key={i} className="pv22-service-stack-tier">
          <div className="pv22-service-stack-tier__name">{tier.name}</div>
          <div className="pv22-service-stack-tier__cadence">{tier.cadence}</div>
          <ul className="pv22-service-stack-tier__includes">
            {tier.includes.map((item, j) => (
              <li key={j} className="pv22-service-stack-tier__item">{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function renderTextColumns(content: Extract<AppendixContent, { kind: "text-columns" }>) {
  return (
    <div
      className="pv22-text-columns"
      style={{
        gridTemplateColumns: `repeat(${content.columns.length}, minmax(0, 1fr))`,
      }}
    >
      {content.columns.map((col, i) => (
        <div key={i}>
          <div className="pv22-text-column__heading">{col.heading}</div>
          <ul className="pv22-text-column__items">
            {col.items.map((item, j) => (
              <li key={j} className="pv22-text-column__item">{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function renderProcessFlow(content: Extract<AppendixContent, { kind: "process-flow" }>) {
  return (
    <div className="pv22-process-flow">
      {content.steps.map((step, i) => (
        <div key={i} className="pv22-process-flow__step">
          <div className="pv22-process-flow__name">{step.name}</div>
          <div className="pv22-process-flow__output">{step.output}</div>
        </div>
      ))}
    </div>
  );
}

function renderMatrix(content: Extract<AppendixContent, { kind: "matrix" }>) {
  return (
    <table className="pv22-matrix-table">
      <thead>
        <tr>
          <th>Item</th>
          {content.rows[0]?.cols.map((_, i) => (
            <th key={i}>{String.fromCharCode(65 + i)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {content.rows.map((row, i) => (
          <tr key={i}>
            <td style={{ fontWeight: 500 }}>{row.label}</td>
            {row.cols.map((col, j) => (
              <td key={j}>{col}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderThreeColumn(content: Extract<AppendixContent, { kind: "three-column" }>) {
  return (
    <div
      className="pv22-text-columns"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
    >
      {content.columns.map((col, i) => (
        <div key={i}>
          <div className="pv22-text-column__heading">{col.heading}</div>
          <ul className="pv22-text-column__items">
            {col.items.map((item, j) => (
              <li key={j} className="pv22-text-column__item">{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function renderSimpleList(content: Extract<AppendixContent, { kind: "simple-list" }>) {
  return (
    <div className="pv22-simple-list">
      {content.groups.map((group, i) => (
        <div key={i}>
          <div className="pv22-simple-list__heading">{group.heading}</div>
          <ul className="pv22-simple-list__items">
            {group.items.map((item, j) => (
              <li key={j} className="pv22-simple-list__item">
                <span>{item.text}</span>
                {item.status != null && (
                  <span className={`pv22-status ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function renderContent(content: AppendixContent): React.ReactNode {
  switch (content.kind) {
    case "status-table":
      return renderStatusTable(content);
    case "capability-map":
      return renderCapabilityMap(content);
    case "service-stack":
      return renderServiceStack(content);
    case "text-columns":
      return renderTextColumns(content);
    case "process-flow":
      return renderProcessFlow(content);
    case "matrix":
      return renderMatrix(content);
    case "three-column":
      return renderThreeColumn(content);
    case "simple-list":
      return renderSimpleList(content);
    default: {
      // exhaustiveness check
      const _exhaustive: never = content;
      void _exhaustive;
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppendixSlideV22({
  appendixId,
  returnToCore,
  onReturn,
}: AppendixSlideV22Props) {
  const slide: AppendixSlide | undefined = APPENDIX_SLIDES.find(
    (s) => s.id === appendixId,
  );

  const slideIndex = APPENDIX_SLIDES.findIndex((s) => s.id === appendixId);
  const totalAppendix = APPENDIX_SLIDES.length;

  const counterLabel =
    slideIndex >= 0
      ? `A.${String(slideIndex + 1).padStart(2, "0")} of A.${String(totalAppendix).padStart(2, "0")}`
      : "A.-- of A.--";

  // 0-based returnToCore -> 1-based display
  const returnSlideNumber =
    returnToCore !== null ? returnToCore + 1 : null;

  if (!slide) {
    return (
      <div className="pv22-appendix-slide">
        <div className="pv22-appendix-header">
          <span className="pv22-appendix-counter">{counterLabel}</span>
          <h2 className="pv22-appendix-title">Appendix slide not found: {appendixId}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="pv22-appendix-slide">
      {/* Header */}
      <div className="pv22-appendix-header">
        <span className="pv22-appendix-counter">{counterLabel}</span>
        <h2 className="pv22-appendix-title">{slide.title}</h2>
      </div>

      {/* Content */}
      <div className="pv22-appendix-content">
        {renderContent(slide.content)}
      </div>

      {/* Footer with optional return button */}
      <div className="pv22-appendix-footer">
        {returnSlideNumber !== null && (
          <button
            type="button"
            className="pv22-return-btn"
            onClick={onReturn}
            aria-label={`Return to slide ${returnSlideNumber}`}
          >
            Return to slide {returnSlideNumber}
          </button>
        )}
        <span
          className="pv22-appendix-counter"
          style={{ marginLeft: returnSlideNumber !== null ? "auto" : undefined }}
        >
          C to return
        </span>
      </div>
    </div>
  );
}
