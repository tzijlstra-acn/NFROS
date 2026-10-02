"use client";

/**
 * CoreSlideV22
 *
 * Dispatcher component for the V2.2 core deck. Receives a CoreSlide22 record
 * and dispatches to the appropriate layout. Renders the section label (top-
 * left), footer (bottom-centre), slide counter (bottom-right), speaker notes
 * strip, and the AppendixRefBar above the footer.
 *
 * Layout map:
 *   "hero"          -> HeroContent (heroLines with MotionPath stagger)
 *   "list"          -> ListContent (agendaItems via RevealSequence)
 *   "next-step"     -> NextStepContent (nextStepBullets + nextStepOutcome)
 *   all others      -> BasicFallback (title + subtitle + bullets/emphasis)
 *                      // layout not yet specialised
 */

import React from "react";
import type { CoreSlide22 } from "../data/types";
import { MotionPath } from "../motion/MotionPath";
import { RevealSequence } from "../motion/RevealSequence";
import { AppendixRefBar } from "./AppendixRefBar";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CoreSlideV22Props {
  slide: CoreSlide22;
  /** 1-based slide index within the core deck. */
  slideIndex: number;
  totalCoreSlides: number;
  exportMode?: boolean;
  showNotes?: boolean;
  onGoToAppendix: (appendixId: string, fromCoreIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Layout components
// ---------------------------------------------------------------------------

function HeroContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const lines = slide.heroLines ?? [];

  return (
    <div className="pv22-layout-hero">
      <h1 className="pv22-title" style={{ textAlign: "center" }}>
        {slide.title}
      </h1>
      {slide.subtitle != null && (
        <p className="pv22-subtitle">{slide.subtitle}</p>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--pv22-space-4)",
          marginTop: "var(--pv22-space-4)",
        }}
      >
        {lines.map((line, i) => (
          <MotionPath
            key={i}
            variant="hero-line"
            index={i}
            exportMode={exportMode}
          >
            <p
              className="pv22-emphasis"
              style={{
                textAlign: "center",
                color: "var(--pv22-color-accent)",
                margin: 0,
              }}
            >
              {line}
            </p>
          </MotionPath>
        ))}
      </div>
    </div>
  );
}

function ListContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const items = slide.agendaItems ?? [];

  if (items.length === 0) {
    return <BasicFallback slide={slide} exportMode={exportMode} />;
  }

  const children = items.map((item, i) => (
    <div key={i} className="pv22-agenda-item">
      <span className="pv22-agenda-item__number">{String(i + 1).padStart(2, "0")}</span>
      <span className="pv22-agenda-item__label">{item.text}</span>
    </div>
  ));

  return (
    <div className="pv22-layout-list">
      <h1 className="pv22-title">{slide.title}</h1>
      {slide.subtitle != null && (
        <p className="pv22-subtitle">{slide.subtitle}</p>
      )}
      <RevealSequence exportMode={exportMode}>
        {children}
      </RevealSequence>
    </div>
  );
}

function NextStepContent({ slide }: { slide: CoreSlide22 }) {
  const bullets = slide.nextStepBullets ?? [];
  const outcome = slide.nextStepOutcome;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "var(--pv22-space-8)",
        padding: "var(--pv22-space-12) var(--pv22-space-16)",
        height: "100%",
      }}
    >
      <h1 className="pv22-title">{slide.title}</h1>
      {slide.subtitle != null && (
        <p className="pv22-subtitle">{slide.subtitle}</p>
      )}
      <ul className="pv22-bullets">
        {bullets.map((bullet, i) => (
          <li key={i} className="pv22-bullet">
            {bullet}
          </li>
        ))}
      </ul>
      {outcome != null && (
        <div
          style={{
            marginTop: "var(--pv22-space-6)",
            padding: "var(--pv22-space-6) var(--pv22-space-8)",
            background: "var(--pv22-brand-purple-lightest)",
            borderLeft: "4px solid var(--pv22-color-accent)",
          }}
        >
          <p
            className="pv22-emphasis"
            style={{ color: "var(--pv22-brand-purple-darkest)", margin: 0 }}
          >
            {outcome}
          </p>
        </div>
      )}
    </div>
  );
}

function BasicFallback({ slide }: { slide: CoreSlide22; exportMode?: boolean }) {
  const bullets = slide.bullets ?? [];
  const emphasisLines = slide.emphasis ?? [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "var(--pv22-space-6)",
        padding: "var(--pv22-space-12) var(--pv22-space-16)",
        height: "100%",
      }}
    >
      <h1 className="pv22-title">{slide.title}</h1>
      {slide.subtitle != null && (
        <p className="pv22-subtitle">{slide.subtitle}</p>
      )}
      {bullets.length > 0 && (
        <ul className="pv22-bullets">
          {bullets.map((bullet, i) => (
            <li key={i} className="pv22-bullet">
              {bullet}
            </li>
          ))}
        </ul>
      )}
      {emphasisLines.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--pv22-space-4)",
            marginTop: bullets.length > 0 ? "var(--pv22-space-4)" : 0,
          }}
        >
          {emphasisLines.map((line, i) => (
            <p
              key={i}
              className="pv22-emphasis"
              style={{ color: "var(--pv22-color-accent)", margin: 0 }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout dispatcher
// ---------------------------------------------------------------------------

function renderLayout(slide: CoreSlide22, exportMode?: boolean): React.ReactNode {
  switch (slide.layout) {
    case "hero":
      return <HeroContent slide={slide} exportMode={exportMode} />;
    case "list":
      return <ListContent slide={slide} exportMode={exportMode} />;
    case "next-step":
      return <NextStepContent slide={slide} />;
    case "split":
    case "three-layer":
    case "two-column":
    case "flow":
    case "outcome-grid":
    case "service-stack":
    case "process-rows":
    case "rollout-steps":
      // layout not yet specialised
      return <BasicFallback slide={slide} exportMode={exportMode} />;
    default: {
      // TypeScript exhaustiveness safety net: if a new layout is added to the
      // union without a case above, this branch becomes reachable and the
      // compile-time cast below would flag it (only if strict narrowing applies).
      // For runtime safety we return the fallback.
      const _unknown = slide.layout;
      void _unknown;
      return <BasicFallback slide={slide} exportMode={exportMode} />;
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoreSlideV22({
  slide,
  slideIndex,
  totalCoreSlides,
  exportMode = false,
  showNotes = false,
  onGoToAppendix,
}: CoreSlideV22Props) {
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
        <span className="pv22-section-label" aria-hidden="true">
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
        {renderLayout(slide, exportMode)}
      </div>

      {/* Appendix ref bar -- above footer */}
      <AppendixRefBar
        appendixRefs={slide.appendixRefs}
        coreIndex={slideIndex - 1}
        onGoToAppendix={onGoToAppendix}
      />

      {/* Speaker notes strip */}
      {showNotes && (
        <div
          aria-label="Speaker notes"
          style={{
            height: notesHeightPx,
            flexShrink: 0,
            background: "rgba(23, 32, 51, 0.94)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "var(--pv22-space-4) var(--pv22-space-8)",
            overflow: "hidden",
          }}
        >
          <p
            style={{
              fontFamily: "var(--pv22-font-mono)",
              fontSize: "var(--pv22-text-xs)",
              color: "rgba(255,255,255,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
              marginBottom: "var(--pv22-space-2)",
            }}
          >
            Notes
          </p>
          <p
            style={{
              fontFamily: "var(--pv22-font-family)",
              fontSize: "var(--pv22-text-sm)",
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

      {/* Footer -- bottom-centre */}
      {slide.footer != null && slide.footer.length > 0 && (
        <div className="pv22-footer" aria-hidden="true">
          {slide.footer}
        </div>
      )}

      {/* Slide counter -- bottom-right */}
      <span
        className="pv22-slide-number"
        aria-label={`Slide ${slideIndex} of ${totalCoreSlides}`}
      >
        {slideIndex} / {totalCoreSlides}
      </span>
    </div>
  );
}
