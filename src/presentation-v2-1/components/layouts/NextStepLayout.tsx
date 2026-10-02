"use client";

/**
 * NextStepLayout
 *
 * For slide 13 (NextStep). Title + subtitle. Five bullet points.
 * Outcome statement box (accent border) from slide.emphasis[0].
 * "Proposed next step" badge top-right. Clean, confident, call-to-action.
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NextStepLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NextStepLayout({ slide }: NextStepLayoutProps) {
  const outcomeStatement = slide.emphasis?.[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--pv21-space-12) var(--pv21-space-16)",
        justifyContent: "center",
        gap: "var(--pv21-space-8)",
        position: "relative",
      }}
    >
      {/* "Proposed next step" badge top-right */}
      <div
        style={{
          position: "absolute",
          top: "var(--pv21-space-10)",
          right: "var(--pv21-space-16)",
        }}
        aria-hidden="true"
      >
        <span
          style={{
            fontFamily: "var(--pv21-font-mono)",
            fontSize: "var(--pv21-text-xs)",
            color: "var(--pv21-color-accent)",
            background: "#EDE9FE",
            border: "1px solid var(--pv21-color-accent)",
            borderRadius: "var(--pv21-radius-pill)",
            padding: "var(--pv21-space-2) var(--pv21-space-5)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Proposed next step
        </span>
      </div>

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

      {/* Bullet points */}
      {slide.bullets != null && slide.bullets.length > 0 && (
        <ul className="pv21-bullets">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="pv21-bullet">
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Outcome statement box */}
      {outcomeStatement != null && (
        <div
          style={{
            borderLeft: "4px solid var(--pv21-color-accent)",
            background: "#EDE9FE",
            borderRadius: "var(--pv21-radius-md)",
            padding: "var(--pv21-space-5) var(--pv21-space-8)",
          }}
        >
          <p
            style={{
              fontSize: "var(--pv21-text-xl)",
              fontWeight: 600,
              color: "var(--pv21-color-accent)",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {outcomeStatement}
          </p>
        </div>
      )}
    </div>
  );
}
