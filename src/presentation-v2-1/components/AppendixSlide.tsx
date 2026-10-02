"use client";

import React from "react";
import { type AppendixSlide as AppendixSlideData } from "@/presentation-v2-1/data/appendix";
import { StatusTableContent } from "./appendix/StatusTableContent";
import { CapabilityMapContent } from "./appendix/CapabilityMapContent";
import { ServiceStackContent } from "./appendix/ServiceStackContent";
import { TextColumnsContent } from "./appendix/TextColumnsContent";
import { ProcessFlowContent } from "./appendix/ProcessFlowContent";
import { MatrixContent } from "./appendix/MatrixContent";
import { ThreeColumnContent } from "./appendix/ThreeColumnContent";
import { SimpleListContent } from "./appendix/SimpleListContent";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppendixSlideProps {
  slide: AppendixSlideData;
  /** 1-based index within the appendix */
  slideIndex: number;
  totalAppendixSlides: number;
  onOpenIndex: () => void;
  exportMode?: boolean;
  showNotes?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppendixSlide({
  slide,
  slideIndex,
  totalAppendixSlides,
  onOpenIndex,
  exportMode,
  showNotes,
}: AppendixSlideProps) {
  const slideLabel = `A.${String(slideIndex).padStart(2, "0")}`;

  // -------------------------------------------------------------------------
  // Content dispatcher
  // -------------------------------------------------------------------------

  function renderContent() {
    const { content } = slide;
    switch (content.kind) {
      case "status-table":
        return <StatusTableContent rows={content.rows} />;
      case "capability-map":
        return <CapabilityMapContent groups={content.groups} />;
      case "service-stack":
        return <ServiceStackContent tiers={content.tiers} />;
      case "text-columns":
        return <TextColumnsContent columns={content.columns} />;
      case "process-flow":
        return <ProcessFlowContent steps={content.steps} />;
      case "matrix":
        return <MatrixContent rows={content.rows} />;
      case "three-column":
        return <ThreeColumnContent columns={content.columns} />;
      case "simple-list":
        return <SimpleListContent groups={content.groups} />;
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="pv21-appendix-slide"
      role="region"
      aria-label={`Appendix slide ${slideLabel}: ${slide.title}`}
    >
      {/* Top chrome: section label (left) and Index link (right) */}
      <div
        style={{
          position: "absolute",
          top: "var(--pv21-space-6)",
          left: "var(--pv21-space-8)",
          right: "var(--pv21-space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontFamily: "var(--pv21-font-mono)",
            fontSize: "var(--pv21-text-xs)",
            color: "var(--pv21-color-secondary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Appendix
        </span>
        {!exportMode && (
          <button
            type="button"
            onClick={onOpenIndex}
            aria-label="Open appendix index"
            style={{
              background: "var(--pv21-color-surface)",
              border: "1px solid var(--pv21-color-border)",
              borderRadius: "var(--pv21-radius-md)",
              padding: "2px var(--pv21-space-3)",
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-secondary)",
              cursor: "pointer",
            }}
          >
            Index
          </button>
        )}
      </div>

      {/* Slide body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: "var(--pv21-space-16)",
          paddingLeft: "var(--pv21-space-16)",
          paddingRight: "var(--pv21-space-16)",
          paddingBottom: "var(--pv21-space-12)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "var(--pv21-space-6)",
          overflowY: "auto",
        }}
      >
        {/* Slide identifier and title */}
        <div>
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
              marginBottom: "var(--pv21-space-2)",
            }}
          >
            {slideLabel} of A.{String(totalAppendixSlides).padStart(2, "0")}
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
            {slide.title}
          </h2>
        </div>

        {/* Content renderer */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {renderContent()}
        </div>
      </div>

      {/* Speaker notes overlay (bottom strip, shown when showNotes is true) */}
      {showNotes === true && slide.speakerNotes != null && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(23, 32, 51, 0.93)",
            color: "#fff",
            padding: "var(--pv21-space-4) var(--pv21-space-8)",
            fontSize: "var(--pv21-text-sm)",
            lineHeight: 1.55,
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 5,
          }}
        >
          {slide.speakerNotes}
        </div>
      )}
    </div>
  );
}
