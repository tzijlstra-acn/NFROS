"use client";

/**
 * RolloutStepsLayout
 *
 * For slide 12 (Rollout). Three numbered step cards parsed from slide.bullets.
 * Each bullet is "Step N: Label -- detail". Cards use .pv21-col-card with a
 * step number badge. bodyCopy goes above the cards as context.
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RolloutStepsLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Helper: parse "Step N: Label -- detail"
// ---------------------------------------------------------------------------

interface Step {
  number: string;
  label: string;
  detail: string;
}

function parseStep(line: string): Step {
  // "Step 1: Pilot -- one role, one process, 8-12 weeks"
  const stepMatch = /^Step\s+(\d+):\s+(.+)$/.exec(line.trim());
  if (stepMatch == null) {
    return { number: "?", label: line, detail: "" };
  }
  const num = stepMatch[1] ?? "?";
  const rest = stepMatch[2];
  if (rest == null) {
    return { number: num, label: line, detail: "" };
  }
  const dashIdx = rest.indexOf(" -- ");
  if (dashIdx < 0) {
    return { number: num, label: rest, detail: "" };
  }
  return {
    number: num,
    label: rest.slice(0, dashIdx).trim(),
    detail: rest.slice(dashIdx + 4).trim(),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RolloutStepsLayout({ slide }: RolloutStepsLayoutProps) {
  const bullets = slide.bullets ?? [];
  const steps = bullets.map(parseStep);

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

      {/* Step cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(1, steps.length)}, minmax(0, 1fr))`,
          gap: "var(--pv21-space-6)",
          alignItems: "start",
        }}
      >
        {steps.map((step, i) => (
          <div
            key={i}
            className="pv21-col-card"
            style={{
              position: "relative",
              paddingTop: "var(--pv21-space-10)",
            }}
          >
            {/* Step number badge */}
            <div
              style={{
                position: "absolute",
                top: "var(--pv21-space-4)",
                left: "var(--pv21-space-4)",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--pv21-color-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--pv21-font-mono)",
                fontSize: "var(--pv21-text-sm)",
                fontWeight: 600,
                color: "#fff",
              }}
              aria-hidden="true"
            >
              {step.number}
            </div>

            {/* Step label */}
            <p
              style={{
                fontSize: "var(--pv21-text-lg)",
                fontWeight: 600,
                color: "var(--pv21-color-text)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {step.label}
            </p>

            {/* Step detail */}
            {step.detail.length > 0 && (
              <p
                style={{
                  fontSize: "var(--pv21-text-base)",
                  color: "var(--pv21-color-secondary)",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {step.detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
