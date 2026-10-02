"use client";

/**
 * CoreSlide
 *
 * Main dispatcher component for the V2.1 core deck. Receives a CoreSlide
 * data record and dispatches to the appropriate layout component based on
 * slide.layout. Renders section label (top-left), footer (bottom-center),
 * slide number (bottom-right), and an optional speaker-notes strip at the
 * bottom of the slide canvas when showNotes is true.
 *
 * Layout map:
 *   "hero"          -> HeroLayout
 *   "list"          -> ListLayout
 *   "three-layer"   -> ThreeLayerLayout
 *   "split"         -> SplitLayout
 *   "two-column"    -> TwoColumnLayout
 *   "flow"          -> FlowLayout
 *   "outcome-grid"  -> OutcomeGridLayout
 *   "service-stack" -> ServiceStackLayout
 *   "process-rows"  -> ProcessRowsLayout
 *   "rollout-steps" -> RolloutStepsLayout
 *   "next-step"     -> NextStepLayout
 */

import React from "react";
import { type CoreSlide as CoreSlideData } from "@/presentation-v2-1/data/core-story";
import { HeroLayout } from "./layouts/HeroLayout";
import { ListLayout } from "./layouts/ListLayout";
import { ThreeLayerLayout } from "./layouts/ThreeLayerLayout";
import { SplitLayout } from "./layouts/SplitLayout";
import { TwoColumnLayout } from "./layouts/TwoColumnLayout";
import { FlowLayout } from "./layouts/FlowLayout";
import { OutcomeGridLayout } from "./layouts/OutcomeGridLayout";
import { ServiceStackLayout } from "./layouts/ServiceStackLayout";
import { ProcessRowsLayout } from "./layouts/ProcessRowsLayout";
import { RolloutStepsLayout } from "./layouts/RolloutStepsLayout";
import { NextStepLayout } from "./layouts/NextStepLayout";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CoreSlideProps {
  slide: CoreSlideData;
  /** 1-based slide index within the core deck. */
  slideIndex: number;
  /** Total number of core slides (used for the slide number display). */
  totalCoreSlides: number;
  /** When true, hides UI chrome that must not appear in static export captures. */
  exportMode?: boolean;
  /** When true, renders a speaker-notes strip at the bottom of the slide canvas. */
  showNotes?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoreSlide({
  slide,
  slideIndex,
  totalCoreSlides,
  exportMode = false,
  showNotes = false,
}: CoreSlideProps) {
  // ---------------------------------------------------------------------------
  // Dispatch to layout component
  // ---------------------------------------------------------------------------

  function renderLayout() {
    switch (slide.layout) {
      case "hero":
        return <HeroLayout slide={slide} />;
      case "list":
        return <ListLayout slide={slide} exportMode={exportMode} />;
      case "three-layer":
        return <ThreeLayerLayout slide={slide} />;
      case "split":
        return <SplitLayout slide={slide} />;
      case "two-column":
        return <TwoColumnLayout slide={slide} />;
      case "flow":
        return <FlowLayout slide={slide} />;
      case "outcome-grid":
        return <OutcomeGridLayout slide={slide} />;
      case "service-stack":
        return <ServiceStackLayout slide={slide} />;
      case "process-rows":
        return <ProcessRowsLayout slide={slide} />;
      case "rollout-steps":
        return <RolloutStepsLayout slide={slide} />;
      case "next-step":
        return <NextStepLayout slide={slide} />;
      default: {
        // TypeScript exhaustive check.
        const _exhaustive: never = slide.layout;
        void _exhaustive;
        return <HeroLayout slide={slide} />;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const notesHeightPx = showNotes ? 180 : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Section label -- top-left */}
      {slide.section.length > 0 && (
        <span className="pv21-section-label" aria-hidden="true">
          {slide.section}
        </span>
      )}

      {/* Layout content area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          height: showNotes ? `calc(100% - ${notesHeightPx}px)` : "100%",
        }}
      >
        {renderLayout()}
      </div>

      {/* Speaker notes strip -- only when showNotes is true */}
      {showNotes && (
        <div
          aria-label="Speaker notes"
          style={{
            height: notesHeightPx,
            flexShrink: 0,
            background: "rgba(23, 32, 51, 0.94)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "var(--pv21-space-4) var(--pv21-space-8)",
            overflow: "hidden",
          }}
        >
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
              marginBottom: "var(--pv21-space-2)",
            }}
          >
            Notes
          </p>
          <p
            style={{
              fontFamily: "var(--pv21-font-sans)",
              fontSize: "var(--pv21-text-sm)",
              color: "rgba(255,255,255,0.82)",
              lineHeight: 1.5,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {slide.speakerNotes}
          </p>
        </div>
      )}

      {/* Footer -- bottom-center */}
      {slide.footer != null && slide.footer.length > 0 && (
        <div className="pv21-footer" aria-hidden="true">
          {slide.footer}
        </div>
      )}

      {/* Slide number -- bottom-right */}
      <span
        className="pv21-slide-number"
        aria-label={`Slide ${slideIndex} of ${totalCoreSlides}`}
      >
        {slideIndex} / {totalCoreSlides}
      </span>
    </div>
  );
}
