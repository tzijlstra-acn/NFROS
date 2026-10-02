"use client";

/**
 * HeroLayout
 *
 * Used for slide 1 (Imagine). Centered vertically and horizontally.
 * Three emphasis lines. Footer "NFR Operating System" bottom-center.
 * Three subtle signal elements (CSS dots resolving to one work item).
 * Light, nearly empty canvas feel.
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HeroLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HeroLayout({ slide }: HeroLayoutProps) {
  return (
    <div className="pv21-layout-hero" style={{ position: "relative" }}>
      {/* Signal elements -- three faint dots that resolve toward center */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {/* Top-left signal */}
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "14%",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--pv21-color-accent)",
            opacity: 0.15,
          }}
        />
        {/* Top-right signal */}
        <div
          style={{
            position: "absolute",
            top: "22%",
            right: "16%",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--pv21-color-accent)",
            opacity: 0.10,
          }}
        />
        {/* Bottom-left signal */}
        <div
          style={{
            position: "absolute",
            bottom: "24%",
            left: "18%",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--pv21-color-accent)",
            opacity: 0.08,
          }}
        />
        {/* Faint connecting lines (SVG) */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.05,
          }}
          viewBox="0 0 1920 1080"
          preserveAspectRatio="none"
        >
          <line x1="269" y1="194" x2="960" y2="540" stroke="var(--pv21-color-accent)" strokeWidth="1" />
          <line x1="1613" y1="238" x2="960" y2="540" stroke="var(--pv21-color-accent)" strokeWidth="1" />
          <line x1="346" y1="820" x2="960" y2="540" stroke="var(--pv21-color-accent)" strokeWidth="1" />
        </svg>
      </div>

      {/* Section eyebrow */}
      <p
        style={{
          fontFamily: "var(--pv21-font-mono)",
          fontSize: "var(--pv21-text-xs)",
          color: "var(--pv21-color-accent)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          margin: 0,
        }}
      >
        {slide.section}
      </p>

      {/* Title */}
      <h1
        className="pv21-title"
        style={{
          fontSize: "var(--pv21-text-5xl)",
          letterSpacing: "-0.03em",
          maxWidth: "18ch",
        }}
      >
        {slide.title}
      </h1>

      {/* Subtitle */}
      {slide.subtitle != null && (
        <p
          className="pv21-subtitle"
          style={{ fontSize: "var(--pv21-text-xl)" }}
        >
          {slide.subtitle}
        </p>
      )}

      {/* Emphasis lines */}
      {slide.emphasis != null && slide.emphasis.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--pv21-space-4)",
            marginTop: "var(--pv21-space-4)",
          }}
        >
          {slide.emphasis.map((line, i) => (
            <p
              key={i}
              className="pv21-emphasis"
              style={{ fontSize: "var(--pv21-text-2xl)" }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
