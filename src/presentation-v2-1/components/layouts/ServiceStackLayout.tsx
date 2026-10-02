"use client";

/**
 * ServiceStackLayout
 *
 * For slide 11 (Service model). Four stacked tiers rendered top-to-bottom as
 * managed -> role apps -> function packs -> platform (user-facing layer on top,
 * infrastructure at bottom). Each tier comes from slide.bullets.
 *
 * Bottom connector line: "Connector and deployment packs" spans full width.
 * Footer note: "Configure once. Add processes without rebuilding the platform."
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ServiceStackLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Tier accent colours (top-to-bottom: managed, roles, functions, platform)
// ---------------------------------------------------------------------------

const TIER_COLORS = [
  "var(--pv21-color-accent)",
  "var(--pv21-color-info)",
  "var(--pv21-color-evidence)",
  "var(--pv21-color-secondary)",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServiceStackLayout({ slide }: ServiceStackLayoutProps) {
  const bullets = slide.bullets ?? [];

  // Reverse so managed ops (last in data) appears at top visually.
  const reversed = [...bullets].reverse();

  // Parse "Label: detail" from each bullet.
  function parseTier(line: string): { label: string; detail: string } {
    const colonIdx = line.indexOf(": ");
    if (colonIdx < 0) return { label: line, detail: "" };
    return {
      label: line.slice(0, colonIdx),
      detail: line.slice(colonIdx + 2),
    };
  }

  const tiers = reversed.map(parseTier);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--pv21-space-10) var(--pv21-space-16)",
        gap: "var(--pv21-space-6)",
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
      </div>

      {/* Service stack */}
      <div className="pv21-service-stack">
        {tiers.map((tier, i) => {
          const color = TIER_COLORS[i] ?? "var(--pv21-color-secondary)";
          const isTop = i === 0;

          return (
            <div
              key={i}
              className="pv21-service-tier"
              style={{
                borderLeft: `4px solid ${color}`,
                background: isTop ? `color-mix(in srgb, ${color} 8%, var(--pv21-color-surface))` : "var(--pv21-color-surface)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--pv21-text-md)",
                  fontWeight: 600,
                  color: isTop ? color : "var(--pv21-color-text)",
                  minWidth: 180,
                }}
              >
                {tier.label}
              </span>
              {tier.detail.length > 0 && (
                <span
                  style={{
                    fontSize: "var(--pv21-text-sm)",
                    color: "var(--pv21-color-secondary)",
                    lineHeight: 1.4,
                  }}
                >
                  {tier.detail}
                </span>
              )}
            </div>
          );
        })}

        {/* Connector and deployment packs row */}
        <div
          style={{
            background: "var(--pv21-color-muted-bg)",
            border: "1px dashed var(--pv21-color-border)",
            borderRadius: "var(--pv21-radius-md)",
            padding: "var(--pv21-space-3) var(--pv21-space-6)",
            textAlign: "center",
            fontSize: "var(--pv21-text-sm)",
            color: "var(--pv21-color-secondary)",
            fontWeight: 500,
          }}
        >
          Connector and deployment packs
        </div>
      </div>

      {/* Footer note */}
      <p
        style={{
          fontFamily: "var(--pv21-font-mono)",
          fontSize: "var(--pv21-text-xs)",
          color: "var(--pv21-color-secondary)",
          marginTop: "var(--pv21-space-2)",
          letterSpacing: "0.02em",
        }}
      >
        Configure once. Add processes without rebuilding the platform.
      </p>
    </div>
  );
}
