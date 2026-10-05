"use client";

/**
 * OutcomeGridLayout
 *
 * For slide 9 (Improvement). 2x2 grid of outcome cards.
 * Each card: heading (large) + support text (small, secondary).
 * Headings and support text come from the structured slide.cards pairs.
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OutcomeGridLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutcomeGridLayout({ slide }: OutcomeGridLayoutProps) {
  // Heading/support pairs; plain bullets fall back to headings only.
  const cards =
    slide.cards?.map((card) => ({ heading: card.heading, support: card.detail })) ??
    (slide.bullets ?? []).map((bullet) => ({ heading: bullet, support: "" }));

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

      {/* 2x2 outcome grid */}
      <div className="pv21-outcome-grid">
        {cards.map((card, i) => (
          <div key={i} className="pv21-outcome-card">
            <p
              style={{
                fontSize: "var(--pv21-text-xl)",
                fontWeight: 600,
                color: "var(--pv21-color-text)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {card.heading}
            </p>
            {card.support.length > 0 && (
              <p
                style={{
                  fontSize: "var(--pv21-text-sm)",
                  color: "var(--pv21-color-secondary)",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {card.support}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
