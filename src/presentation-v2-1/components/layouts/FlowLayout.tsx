"use client";

/**
 * FlowLayout
 *
 * For slide 10 (Control). Horizontal arrow flow:
 * Evidence -> AI preparation -> Human decision -> Approval -> Execution -> Audit.
 * Each step is a box. Arrow between them.
 * Below the flow: safeguard bullets from slide.bullets.
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlowLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Flow steps (fixed for the Control slide; generic fallback uses bullets)
// ---------------------------------------------------------------------------

const CONTROL_FLOW_STEPS = [
  "Evidence",
  "AI preparation",
  "Human decision",
  "Approval",
  "Execution",
  "Audit",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FlowLayout({ slide }: FlowLayoutProps) {
  const isControl = slide.section === "Control";
  const flowSteps = isControl ? CONTROL_FLOW_STEPS : (slide.bullets ?? []);
  const safeguardBullets = isControl ? (slide.bullets ?? []) : [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "var(--pv21-space-10)",
        padding: "var(--pv21-space-10) var(--pv21-space-16)",
        height: "100%",
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

      {/* Horizontal flow */}
      {flowSteps.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 0,
          }}
        >
          {flowSteps.map((step, i) => (
            <React.Fragment key={i}>
              <div
                style={{
                  flex: "1 1 0",
                  background: "var(--pv21-color-surface)",
                  border: "1px solid var(--pv21-color-border)",
                  borderRadius: "var(--pv21-radius-md)",
                  padding: "var(--pv21-space-4) var(--pv21-space-3)",
                  textAlign: "center",
                  fontSize: "var(--pv21-text-sm)",
                  fontWeight: 500,
                  color: "var(--pv21-color-text)",
                  lineHeight: 1.3,
                  minWidth: 0,
                }}
              >
                {step}
              </div>
              {i < flowSteps.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: "var(--pv21-space-8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--pv21-color-secondary)",
                    fontSize: "var(--pv21-text-lg)",
                    fontFamily: "var(--pv21-font-mono)",
                  }}
                >
                  {">"}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Safeguard bullets (below flow, for Control slide) */}
      {safeguardBullets.length > 0 && (
        <ul className="pv21-bullets">
          {safeguardBullets.map((bullet, i) => (
            <li key={i} className="pv21-bullet">
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
