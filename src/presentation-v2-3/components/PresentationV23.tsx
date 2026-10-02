"use client";

/**
 * PresentationV23
 *
 * Root component for the NFROS V2.3 presentation engine. Manages keyboard
 * navigation, URL-synced state, animated slide transitions, focusStep for
 * product-proof focus regions, and all overlay UI.
 *
 * Keyboard shortcuts:
 *   ArrowRight / ArrowDown / Space   advance one slide
 *   ArrowLeft / ArrowUp              go back one slide
 *   Home                             first slide
 *   End                              last slide
 *   1 / 2 / 3                        set focusStep when slide has focusRegions
 *   A                                toggle agenda overlay
 *   C (in appendix)                  return to origin core slide
 *   C (in core)                      toggle agenda overlay
 *   F                                toggle fullscreen
 *   P                                toggle speaker notes
 *   M                                pause / resume motion
 *   D                                toggle download menu
 *   ?                                toggle help overlay
 *   Escape                           close any open overlay
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import "@/presentation-v2-3/styles/presentation-v2-3.css";
import "@/presentation-v2-2/styles/presentation-v2-2.css";

import { CORE_SLIDES_V23 } from "../data/core-story";
import { APPENDIX_SLIDES } from "@/presentation-v2-2/data/appendix";
import { useSlideNavigation } from "@/presentation-v2-2/hooks/useSlideNavigation";
import { SharedSlideTransition } from "@/presentation-v2-2/motion/SharedSlideTransition";
import { AppendixSlideV22 } from "@/presentation-v2-2/components/AppendixSlideV22";
import { CoreSlide23Dispatcher } from "./CoreSlide23Dispatcher";
import type { CoreSlide23 } from "../data/types";
import type { AppendixReference } from "@/presentation-v2-2/data/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORE_SLIDE_COUNT = CORE_SLIDES_V23.length; // 13
const APPENDIX_IDS = APPENDIX_SLIDES.map((s) => s.id);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  initialCoreSlide?: number;
  initialAppendixId?: string | null;
  initialFrom?: string | null;
  exportMode?: boolean;
};

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

const DOWNLOADS = [
  {
    label: "Download full deck (PDF)",
    description: "Core story and appendix",
    href: "/downloads/NFROS_Risk_Audience_Core_and_Appendix.pdf",
    filename: "NFROS_Risk_Audience_Core_and_Appendix.pdf",
  },
  {
    label: "Download core story (PDF)",
    description: "Slides 1 to 13 only",
    href: "/downloads/NFROS_Risk_Audience_Core.pdf",
    filename: "NFROS_Risk_Audience_Core.pdf",
  },
] as const;

function DownloadMenu({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div className="pv23-download-menu" role="dialog" aria-label="Download options">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--pv23-4)",
            paddingBottom: "var(--pv23-2)",
            borderBottom: "1px solid var(--pv23-border)",
            marginBottom: "var(--pv23-1)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--pv23-font-mono)",
              fontSize: "var(--pv23-t-footnote)",
              lineHeight: "var(--pv23-t-footnote-lh)",
              color: "var(--pv23-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Downloads
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close download menu"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--pv23-font-mono)",
              fontSize: "var(--pv23-t-footnote)",
              lineHeight: "var(--pv23-t-footnote-lh)",
              color: "var(--pv23-text-secondary)",
              padding: 0,
            }}
          >
            x
          </button>
        </div>
        {DOWNLOADS.map((dl) => (
          <a
            key={dl.href}
            href={dl.href}
            download={dl.filename}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "var(--pv23-3) var(--pv23-4)",
              background: "var(--pv23-canvas)",
              border: "1px solid var(--pv23-border)",
              textDecoration: "none",
              color: "var(--pv23-text)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontFamily: "var(--pv23-font-body)",
                fontSize: "var(--pv23-t-core-meta)",
                lineHeight: "var(--pv23-t-core-meta-lh)",
                fontWeight: "var(--pv23-fw-semibold)",
              }}
            >
              {dl.label}
            </span>
            <span
              style={{
                fontFamily: "var(--pv23-font-mono)",
                fontSize: "var(--pv23-t-footnote)",
                lineHeight: "var(--pv23-t-footnote-lh)",
                color: "var(--pv23-text-secondary)",
              }}
            >
              {dl.description}
            </span>
          </a>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Agenda overlay
// ---------------------------------------------------------------------------

const AGENDA_ITEMS = CORE_SLIDES_V23[1]?.agendaItems ?? [];

function AgendaOverlay({
  activeCoreIndex,
  onClose,
  onOpenAppendix,
}: {
  activeCoreIndex: number;
  onClose: () => void;
  onOpenAppendix: () => void;
}) {
  const activeSection = CORE_SLIDES_V23[activeCoreIndex]?.section ?? "";
  return (
    <div
      className="pv23-agenda-overlay"
      role="dialog"
      aria-label="Agenda"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--pv23-surface)",
          border: "1px solid var(--pv23-border)",
          padding: "var(--pv23-10)",
          width: "min(860px, 90vw)",
          maxHeight: "80dvh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--pv23-6)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--pv23-font-heading)",
            fontSize: "var(--pv23-t-core-title)",
            lineHeight: "var(--pv23-t-core-title-lh)",
            fontWeight: "var(--pv23-fw-bold)",
            margin: 0,
            color: "var(--pv23-text)",
          }}
        >
          Agenda
        </h2>
        <div>
          {AGENDA_ITEMS.map((item, i) => {
            const isActive = item.section === activeSection;
            return (
              <div
                key={i}
                className={`pv23-agenda-item${isActive ? " pv23-agenda-item--active" : ""}`}
              >
                <span className="pv23-agenda-item__number">{String(i + 1).padStart(2, "0")}</span>
                <span className="pv23-agenda-item__label">{item.text}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "var(--pv23-3)" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "var(--pv23-2) var(--pv23-6)",
              background: "var(--pv23-brand-purple)",
              border: "none",
              color: "#fff",
              fontFamily: "var(--pv23-font-body)",
              fontSize: "var(--pv23-t-core-meta)",
              lineHeight: "var(--pv23-t-core-meta-lh)",
              cursor: "pointer",
              borderRadius: 0,
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onOpenAppendix}
            style={{
              padding: "var(--pv23-2) var(--pv23-6)",
              background: "var(--pv23-surface)",
              border: "1px solid var(--pv23-border)",
              color: "var(--pv23-text)",
              fontFamily: "var(--pv23-font-body)",
              fontSize: "var(--pv23-t-core-meta)",
              lineHeight: "var(--pv23-t-core-meta-lh)",
              cursor: "pointer",
              borderRadius: 0,
            }}
          >
            Open appendix
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline appendix ref bar (pv23- classes)
// ---------------------------------------------------------------------------

function RefBar({
  appendixRefs,
  coreIndex,
  onGoToAppendix,
}: {
  appendixRefs: AppendixReference[];
  coreIndex: number;
  onGoToAppendix: (appendixId: string, fromCoreIndex: number) => void;
}) {
  if (appendixRefs.length === 0) return null;
  return (
    <div className="pv23-ref-bar" aria-label="Appendix references for this slide">
      <span className="pv23-ref-bar__label">More detail</span>
      {appendixRefs.map((ref) => (
        <button
          key={ref.appendixId}
          type="button"
          className="pv23-ref-chip"
          title={ref.reason}
          aria-label={`Open appendix: ${ref.label}`}
          onClick={() => onGoToAppendix(ref.appendixId, coreIndex)}
        >
          {ref.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Core slide shell (section label, counter, notes, ref bar, dispatcher)
// ---------------------------------------------------------------------------

function CoreSlideV23Shell({
  slide,
  slideIndex,
  totalCoreSlides,
  exportMode,
  showNotes,
  focusStep,
  onGoToAppendix,
}: {
  slide: CoreSlide23;
  slideIndex: number;
  totalCoreSlides: number;
  exportMode?: boolean;
  showNotes?: boolean;
  focusStep?: number;
  onGoToAppendix: (appendixId: string, fromCoreIndex: number) => void;
}) {
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
        <span className="pv23-section-label" aria-hidden="true">
          {slide.section}
        </span>
      )}

      {/* Content area (flexible, fills remaining height) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          height: showNotes ? `calc(100% - ${notesHeightPx}px)` : "100%",
        }}
      >
        <CoreSlide23Dispatcher
          slide={slide}
          exportMode={exportMode}
          focusStep={focusStep}
        />
      </div>

      {/* Appendix ref bar */}
      <RefBar
        appendixRefs={slide.appendixRefs}
        coreIndex={slideIndex - 1}
        onGoToAppendix={onGoToAppendix}
      />

      {/* Speaker notes strip */}
      {showNotes && (
        <div
          aria-label="Speaker notes"
          className="pv23-speaker-notes"
          style={{ height: notesHeightPx, flexShrink: 0 }}
        >
          <p className="pv23-speaker-notes__label">Notes</p>
          <p className="pv23-speaker-notes__text">{slide.speakerNotes}</p>
        </div>
      )}

      {/* Footer -- bottom-centre */}
      {slide.footer != null && slide.footer.length > 0 && (
        <div className="pv23-footer" aria-hidden="true">
          {slide.footer}
        </div>
      )}

      {/* Slide counter -- bottom-right */}
      <span
        className="pv23-slide-number"
        aria-label={`Slide ${slideIndex} of ${totalCoreSlides}`}
      >
        {slideIndex} / {totalCoreSlides}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationV23({
  initialCoreSlide = 1,
  initialAppendixId = null,
  initialFrom = null,
  exportMode = false,
}: Props) {
  const nav = useSlideNavigation(
    CORE_SLIDE_COUNT,
    APPENDIX_IDS,
    initialCoreSlide,
    initialAppendixId,
    initialFrom,
  );

  const { state, goToAppendix, returnToOrigin, goBack, goForward, goToFirst, goToLast } = nav;

  // Local UI state
  const [showNotes, setShowNotes] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [focusStep, setFocusStep] = useState<number | undefined>(undefined);

  const deckRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const closeAllOverlays = useCallback(() => {
    setShowNotes(false);
    setShowAgenda(false);
    setShowHelp(false);
    setShowDownload(false);
  }, []);

  const openAppendixFirst = useCallback(() => {
    const firstId = APPENDIX_IDS[0];
    if (firstId) {
      goToAppendix(firstId, state.coreIndex);
    }
    setShowEndPrompt(false);
    setShowAgenda(false);
  }, [goToAppendix, state.coreIndex]);

  const handleGoForward = useCallback(() => {
    if (showAgenda || showHelp) return;
    if (state.mode === "core" && state.coreIndex >= CORE_SLIDE_COUNT - 1) {
      setShowEndPrompt(true);
      return;
    }
    setFocusStep(undefined);
    goForward();
  }, [goForward, showAgenda, showHelp, state.mode, state.coreIndex]);

  const handleGoBack = useCallback(() => {
    if (showAgenda || showHelp) return;
    setShowEndPrompt(false);
    setFocusStep(undefined);
    goBack();
  }, [goBack, showAgenda, showHelp]);

  // -------------------------------------------------------------------------
  // Current slide -- used to check for focusRegions
  // -------------------------------------------------------------------------

  const currentCoreSlide = CORE_SLIDES_V23[state.coreIndex];
  const currentHasFocusRegions =
    currentCoreSlide != null &&
    currentCoreSlide.focusRegions != null &&
    currentCoreSlide.focusRegions.length > 0;

  // -------------------------------------------------------------------------
  // Keyboard handler
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showHelp || showAgenda || showNotes || showDownload) {
          closeAllOverlays();
          return;
        }
        if (showEndPrompt) {
          setShowEndPrompt(false);
          return;
        }
        return;
      }

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setShowAgenda((v) => !v);
        return;
      }

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (state.mode === "appendix") {
          returnToOrigin();
          setShowEndPrompt(false);
        } else {
          setShowAgenda((v) => !v);
        }
        return;
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => void 0);
        } else {
          deckRef.current?.requestFullscreen().catch(() => void 0);
        }
        return;
      }

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setShowNotes((v) => !v);
        return;
      }

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setMotionPaused((v) => !v);
        return;
      }

      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        setShowDownload((v) => !v);
        return;
      }

      // 1 / 2 / 3 keys: set focusStep when current slide has focus regions
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        if (currentHasFocusRegions && state.mode === "core") {
          e.preventDefault();
          setFocusStep(Number(e.key));
          return;
        }
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        handleGoForward();
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        handleGoBack();
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        setShowEndPrompt(false);
        setFocusStep(undefined);
        goToFirst();
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        goToLast();
        return;
      }
    },
    [
      closeAllOverlays,
      currentHasFocusRegions,
      goToFirst,
      goToLast,
      handleGoForward,
      handleGoBack,
      returnToOrigin,
      showAgenda,
      showDownload,
      showEndPrompt,
      showHelp,
      showNotes,
      state.mode,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // -------------------------------------------------------------------------
  // Viewport scale: letterbox 1920x1080 into the viewport
  // -------------------------------------------------------------------------

  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const scaleW = window.innerWidth / 1920;
      const scaleH = window.innerHeight / 1080;
      setScale(Math.min(scaleW, scaleH));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Slide manifest (consumed by the export pipeline via data-presentation-slides)
  // -------------------------------------------------------------------------

  const slideManifest = [
    ...CORE_SLIDES_V23.map((slide, i) => ({
      index: i + 1,
      type: "core" as const,
      id: slide.id,
      title: slide.title,
    })),
    ...APPENDIX_SLIDES.map((slide, i) => ({
      index: i + 1,
      type: "appendix" as const,
      id: slide.id,
      title: slide.title,
    })),
  ];

  // Unique key for SharedSlideTransition
  const slideKey =
    state.mode === "core"
      ? `core-${state.coreIndex}`
      : `appendix-${state.appendixId ?? "none"}`;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      ref={deckRef}
      className={[
        "pv23-deck",
        exportMode ? "pv23-export-mode" : "",
        motionPaused ? "pv23-motion-paused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-presentation-slides={JSON.stringify(slideManifest)}
      role="main"
      aria-label="NFROS Presentation V2.3"
    >
      {/* Letterbox wrapper */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "#E4E7EC",
        }}
      >
        <div
          className="pv23-slide"
          style={{ transform: `scale(${scale})` }}
          aria-live="polite"
        >
          <SharedSlideTransition
            slideKey={slideKey}
            direction={state.direction}
            exportMode={exportMode}
          >
            {state.mode === "core" && currentCoreSlide != null ? (
              <CoreSlideV23Shell
                slide={currentCoreSlide}
                slideIndex={state.coreIndex + 1}
                totalCoreSlides={CORE_SLIDE_COUNT}
                exportMode={exportMode}
                showNotes={showNotes}
                focusStep={focusStep}
                onGoToAppendix={goToAppendix}
              />
            ) : state.mode === "appendix" && state.appendixId != null ? (
              <AppendixSlideV22
                appendixId={state.appendixId}
                returnToCore={state.returnToCore}
                onReturn={returnToOrigin}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--pv23-text-secondary)",
                  fontFamily: "var(--pv23-font-body)",
                  fontSize: "var(--pv23-t-core-body)",
                  lineHeight: "var(--pv23-t-core-body-lh)",
                }}
              >
                Slide not found.
              </div>
            )}
          </SharedSlideTransition>
        </div>
      </div>

      {/* End-of-core prompt */}
      {showEndPrompt && state.mode === "core" && (
        <div
          className="pv23-end-prompt"
          role="dialog"
          aria-label="End of core presentation"
        >
          <p className="pv23-end-prompt__title">Core story complete.</p>
          <div className="pv23-end-prompt__actions">
            <button
              className="pv23-end-prompt__btn pv23-end-prompt__btn--primary"
              onClick={() => setShowEndPrompt(false)}
              type="button"
            >
              Continue discussion
            </button>
            <button
              className="pv23-end-prompt__btn"
              onClick={openAppendixFirst}
              type="button"
            >
              Open appendix
            </button>
            <a
              className="pv23-end-prompt__btn"
              href="/downloads/NFROS_Risk_Audience_Core_and_Appendix.pdf"
              download
            >
              Download PDF
            </a>
          </div>
        </div>
      )}

      {/* Agenda overlay */}
      {showAgenda && (
        <AgendaOverlay
          activeCoreIndex={state.coreIndex}
          onClose={() => setShowAgenda(false)}
          onOpenAppendix={() => {
            openAppendixFirst();
            setShowAgenda(false);
          }}
        />
      )}

      {/* Help overlay */}
      {showHelp && (
        <div
          className="pv23-help-overlay"
          role="dialog"
          aria-label="Keyboard shortcuts"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHelp(false);
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "var(--pv23-t-core-subtitle)",
                lineHeight: "var(--pv23-t-core-subtitle-lh)",
                fontWeight: "var(--pv23-fw-semibold)",
                color: "var(--pv23-text)",
                margin: 0,
                fontFamily: "var(--pv23-font-heading)",
              }}
            >
              Keyboard shortcuts
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--pv23-t-core-meta)",
                lineHeight: "var(--pv23-t-core-meta-lh)",
                marginTop: "var(--pv23-4)",
              }}
            >
              <tbody>
                {(
                  [
                    ["ArrowRight / ArrowDown / Space", "Next slide"],
                    ["ArrowLeft / ArrowUp", "Previous slide"],
                    ["Home", "First slide"],
                    ["End", "Last slide"],
                    ["1 / 2 / 3", "Set focus region (slides with product proof)"],
                    ["A", "Toggle agenda overlay"],
                    ["C (in appendix)", "Return to origin core slide"],
                    ["C (in core)", "Toggle agenda overlay"],
                    ["F", "Toggle fullscreen"],
                    ["P", "Toggle speaker notes"],
                    ["M", "Pause / resume motion"],
                    ["D", "Toggle download menu"],
                    ["?", "This help screen"],
                    ["Escape", "Close overlay"],
                  ] as [string, string][]
                ).map(([key, action]) => (
                  <tr
                    key={key}
                    style={{ borderBottom: "1px solid var(--pv23-border)" }}
                  >
                    <td
                      style={{
                        padding: "var(--pv23-2) var(--pv23-3) var(--pv23-2) 0",
                        width: 280,
                      }}
                    >
                      <kbd
                        style={{
                          fontFamily: "var(--pv23-font-mono)",
                          fontSize: "var(--pv23-t-footnote)",
                          lineHeight: "var(--pv23-t-footnote-lh)",
                          background: "var(--pv23-canvas)",
                          border: "1px solid var(--pv23-border)",
                          padding: "1px 6px",
                          color: "var(--pv23-text)",
                          borderRadius: 0,
                        }}
                      >
                        {key}
                      </kbd>
                    </td>
                    <td
                      style={{
                        padding: "var(--pv23-2) 0",
                        color: "var(--pv23-text)",
                      }}
                    >
                      {action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              style={{
                marginTop: "var(--pv23-5)",
                padding: "var(--pv23-2) var(--pv23-6)",
                background: "var(--pv23-brand-purple)",
                border: "none",
                color: "#fff",
                fontFamily: "var(--pv23-font-body)",
                fontSize: "var(--pv23-t-core-meta)",
                lineHeight: "var(--pv23-t-core-meta-lh)",
                cursor: "pointer",
                borderRadius: 0,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Download menu */}
      {!exportMode && showDownload && (
        <DownloadMenu onClose={() => setShowDownload(false)} />
      )}

      {/* Download trigger button */}
      {!exportMode && (
        <button
          type="button"
          className="pv23-download-btn"
          onClick={() => setShowDownload((v) => !v)}
          aria-label="Open download menu"
        >
          Download
        </button>
      )}
    </div>
  );
}
