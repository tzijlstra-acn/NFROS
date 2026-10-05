"use client";

/**
 * ThreeLayerLayout
 *
 * For slide 4 (Operating System). Three stacked layer cards, each with a
 * name and sub-items. Bottom note "Existing bank systems remain in place."
 * Uses .pv21-layer-card. Accent bar on left of each card.
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreeLayerLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Layer tier metadata keyed by index
// ---------------------------------------------------------------------------

const TIER_ATTRS = ["intelligence", "human", "evidence"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreeLayerLayout({ slide }: ThreeLayerLayoutProps) {
  // Use the heading/detail cards as the three layers; fall back to emphasis
  // lines, then bullets, rendered as headings only.
  const layers: { heading: string; detail?: string }[] =
    slide.cards ?? (slide.emphasis ?? slide.bullets ?? []).map((heading) => ({ heading }));

  return (
    <div className="pv21-layout-three-layer">
      {/* Header */}
      <div style={{ marginBottom: "var(--pv21-space-4)" }}>
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

      {/* Layer cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--pv21-space-4)",
          flex: 1,
          justifyContent: "center",
        }}
      >
        {layers.map((layer, i) => {
          const tier = TIER_ATTRS[i] ?? "intelligence";
          const label = layer.heading;
          const detail = layer.detail;

          return (
            <div key={i} className="pv21-layer-card" data-tier={tier}>
              <span
                style={{
                  fontFamily: "var(--pv21-font-sans)",
                  fontSize: "var(--pv21-text-md)",
                  fontWeight: 600,
                  color: "var(--pv21-color-text)",
                }}
              >
                {label}
              </span>
              {detail != null && (
                <span
                  style={{
                    fontSize: "var(--pv21-text-base)",
                    color: "var(--pv21-color-secondary)",
                    lineHeight: 1.4,
                  }}
                >
                  {detail}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      <p
        style={{
          fontFamily: "var(--pv21-font-mono)",
          fontSize: "var(--pv21-text-xs)",
          color: "var(--pv21-color-secondary)",
          marginTop: "var(--pv21-space-4)",
          letterSpacing: "0.02em",
        }}
      >
        Existing bank systems remain in place.
      </p>
    </div>
  );
}
