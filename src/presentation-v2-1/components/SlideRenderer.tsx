"use client";

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideRendererProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Layout class mapping
// ---------------------------------------------------------------------------

function layoutClass(layout: CoreSlide["layout"]): string {
  switch (layout) {
    case "hero":
      return "pv21-layout-hero";
    case "split":
      return "pv21-layout-split";
    case "three-layer":
      return "pv21-layout-three-layer";
    case "two-column":
      return "pv21-layout-two-col";
    case "flow":
      return "pv21-layout-flow";
    case "list":
      return "pv21-layout-list";
    case "next-step":
      return "pv21-layout-hero";
    case "outcome-grid":
      return "pv21-layout-three-layer";
    case "service-stack":
      return "pv21-layout-three-layer";
    case "process-rows":
      return "pv21-layout-flow";
    case "rollout-steps":
      return "pv21-layout-flow";
    default: {
      const _exhaustive: never = layout;
      return "pv21-layout-hero";
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideRenderer({ slide }: SlideRendererProps) {
  return (
    <div className={layoutClass(slide.layout)}>
      {/* Section label */}
      {slide.section.length > 0 && (
        <p
          style={{
            fontFamily: "var(--pv21-font-mono)",
            fontSize: "var(--pv21-text-xs)",
            color: "var(--pv21-color-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            margin: 0,
          }}
        >
          {slide.section}
        </p>
      )}

      {/* Title */}
      <h1 className="pv21-title">{slide.title}</h1>

      {/* Subtitle */}
      {slide.subtitle != null && (
        <p className="pv21-subtitle">{slide.subtitle}</p>
      )}

      {/* Body copy */}
      {slide.bodyCopy != null && (
        <p className="pv21-body">{slide.bodyCopy}</p>
      )}

      {/* Emphasis statements */}
      {slide.emphasis != null && slide.emphasis.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--pv21-space-4)",
          }}
        >
          {slide.emphasis.map((statement) => (
            <p key={statement} className="pv21-emphasis">
              {statement}
            </p>
          ))}
        </div>
      )}

      {/* Bullet list */}
      {slide.bullets != null && slide.bullets.length > 0 && (
        <ul className="pv21-bullets">
          {slide.bullets.map((bullet) => (
            <li key={bullet} className="pv21-bullet">
              {bullet}
            </li>
          ))}
        </ul>
      )}

      {/* Callouts */}
      {slide.callouts != null && slide.callouts.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--pv21-space-3)",
            marginTop: "var(--pv21-space-4)",
          }}
        >
          {slide.callouts.map((callout) => (
            <p
              key={callout}
              style={{
                fontFamily: "var(--pv21-font-mono)",
                fontSize: "var(--pv21-text-xs)",
                color: "var(--pv21-color-secondary)",
                margin: 0,
                background: "var(--pv21-color-muted-bg)",
                border: "1px solid var(--pv21-color-border)",
                borderRadius: "var(--pv21-radius-md)",
                padding: "var(--pv21-space-2) var(--pv21-space-4)",
              }}
            >
              {callout}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
