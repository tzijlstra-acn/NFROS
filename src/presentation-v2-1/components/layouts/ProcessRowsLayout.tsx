"use client";

/**
 * ProcessRowsLayout
 *
 * For slide 7 (Role Apps). Two horizontal process rows:
 *   Row 1: RCSA -- six stage chips parsed from slide.bullets[0]
 *   Row 2: TPRM -- six stage chips parsed from slide.bullets[1]
 *
 * Each row has a label on the left and 6 stage chips to the right.
 * Below both rows:
 *   "AI prepares each stage."
 *   "The professional owns the material gates."
 *
 * These caption lines come from slide.bullets[2] and slide.bullets[3].
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProcessRowsLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Helper: parse "Label: Stage1, Stage2, ..." -> { label, stages }
// ---------------------------------------------------------------------------

function parseRow(line: string | undefined): { label: string; stages: string[] } {
  if (line == null) return { label: "", stages: [] };
  const colonIdx = line.indexOf(": ");
  if (colonIdx < 0) return { label: line, stages: [] };
  const label = line.slice(0, colonIdx).trim();
  const stages = line
    .slice(colonIdx + 2)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { label, stages };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessRowsLayout({ slide }: ProcessRowsLayoutProps) {
  const bullets = slide.bullets ?? [];
  const row1 = parseRow(bullets[0]);
  const row2 = parseRow(bullets[1]);
  const captionA = bullets[2] ?? "AI prepares each stage.";
  const captionB = bullets[3] ?? "The professional owns the material gates.";

  function renderRow(
    row: { label: string; stages: string[] },
    key: string
  ) {
    return (
      <div
        key={key}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "var(--pv21-space-4)",
        }}
      >
        {/* Row label */}
        <div
          style={{
            minWidth: 200,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {row.label}
          </span>
        </div>

        {/* Stage chips */}
        <div className="pv21-process-row">
          {row.stages.map((stage, i) => (
            <React.Fragment key={i}>
              <div className="pv21-stage-chip">{stage}</div>
              {i < row.stages.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    color: "var(--pv21-color-secondary)",
                    fontFamily: "var(--pv21-font-mono)",
                    fontSize: "var(--pv21-text-xs)",
                    flexShrink: 0,
                  }}
                >
                  {">"}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--pv21-space-10) var(--pv21-space-16)",
        gap: "var(--pv21-space-8)",
        justifyContent: "center",
      }}
    >
      {/* Header */}
      <div>
        <p
          style={{
            fontFamily: "var(--pv21-font-mono)",
            fontSize: "var(--pv21-text-xs)",
            color: "var(--pv21-color-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.10em",
            margin: 0,
            marginBottom: "var(--pv21-space-3)",
          }}
        >
          {slide.section}
        </p>
        <h1 className="pv21-title">{slide.title}</h1>
        {slide.subtitle != null && (
          <p className="pv21-subtitle" style={{ marginTop: "var(--pv21-space-3)" }}>
            {slide.subtitle}
          </p>
        )}
        {slide.bodyCopy != null && (
          <p className="pv21-body" style={{ marginTop: "var(--pv21-space-4)" }}>
            {slide.bodyCopy}
          </p>
        )}
      </div>

      {/* Process rows */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--pv21-space-6)",
          background: "var(--pv21-color-surface)",
          border: "1px solid var(--pv21-color-border)",
          borderRadius: "var(--pv21-radius-lg)",
          padding: "var(--pv21-space-8)",
        }}
      >
        {renderRow(row1, "row1")}
        <div
          style={{
            height: "1px",
            background: "var(--pv21-color-border)",
          }}
          aria-hidden="true"
        />
        {renderRow(row2, "row2")}
      </div>

      {/* Caption lines */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--pv21-space-2)",
        }}
      >
        <p
          style={{
            fontSize: "var(--pv21-text-base)",
            fontWeight: 500,
            color: "var(--pv21-color-text)",
            margin: 0,
          }}
        >
          {captionA}
        </p>
        <p
          style={{
            fontSize: "var(--pv21-text-base)",
            color: "var(--pv21-color-secondary)",
            margin: 0,
          }}
        >
          {captionB}
        </p>
      </div>
    </div>
  );
}
