"use client";

import React from "react";
import {
  APPENDIX_SLIDES,
  type AppendixContent,
} from "@/presentation-v2-1/data/appendix";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppendixIndexProps {
  onNavigate: (appendixIndex: number) => void;
  onReturnToCore: () => void;
  exportMode?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDescription(content: AppendixContent): string {
  switch (content.kind) {
    case "status-table":
      return `Status overview: ${content.rows.length} items`;
    case "capability-map":
      return `Capability map: ${content.groups.length} groups`;
    case "service-stack":
      return `Service model: ${content.tiers.length} tiers`;
    case "text-columns":
      return `${content.columns.length}-column detail`;
    case "process-flow":
      return `${content.steps.length}-stage process flow`;
    case "matrix":
      return `Reference matrix: ${content.rows.length} rows`;
    case "three-column":
      return "Three-column reference";
    case "simple-list":
      return `Catalogue: ${content.groups.length} groups`;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppendixIndex({
  onNavigate,
  onReturnToCore,
  exportMode,
}: AppendixIndexProps) {
  return (
    <div
      className="pv21-appendix-index"
      style={{ paddingTop: "var(--pv21-space-16)", height: "100%", boxSizing: "border-box", overflowY: "auto" }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "var(--pv21-space-8)",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
              marginBottom: "var(--pv21-space-1)",
            }}
          >
            Appendix
          </p>
          <h2
            style={{
              fontSize: "var(--pv21-text-2xl)",
              fontWeight: 600,
              color: "var(--pv21-color-text)",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Reference slides
          </h2>
        </div>
        {!exportMode && (
          <button
            type="button"
            onClick={onReturnToCore}
            style={{
              background: "var(--pv21-color-surface)",
              border: "1px solid var(--pv21-color-border)",
              borderRadius: "var(--pv21-radius-md)",
              padding: "var(--pv21-space-2) var(--pv21-space-5)",
              fontFamily: "var(--pv21-font-sans)",
              fontSize: "var(--pv21-text-sm)",
              color: "var(--pv21-color-text)",
              cursor: "pointer",
            }}
          >
            Return to core
          </button>
        )}
      </div>

      {/* Slide list */}
      <div>
        {APPENDIX_SLIDES.map((slide, index) => {
          const slideNum = index + 1;
          const label = `A.${String(slideNum).padStart(2, "0")}`;
          return (
            <button
              key={slide.id}
              type="button"
              className="pv21-appendix-item"
              onClick={() => onNavigate(slideNum)}
              style={{
                background: "none",
                border: "none",
                font: "inherit",
                textAlign: "left",
                cursor: "pointer",
                width: "100%",
                gridTemplateColumns: "40px minmax(0, 1fr) auto",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--pv21-font-mono)",
                  fontSize: "var(--pv21-text-xs)",
                  color: "var(--pv21-color-accent)",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: "var(--pv21-text-sm)",
                  fontWeight: 500,
                  color: "var(--pv21-color-text)",
                  lineHeight: 1.3,
                }}
              >
                {slide.title}
              </span>
              <span
                style={{
                  fontSize: "var(--pv21-text-xs)",
                  color: "var(--pv21-color-secondary)",
                  fontFamily: "var(--pv21-font-mono)",
                  textAlign: "right",
                }}
              >
                {getDescription(slide.content)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
