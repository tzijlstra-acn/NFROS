"use client";

/**
 * PresentationV21
 *
 * Root component for the NFROS Risk Audience Presentation V2.1 deck.
 * Designed to be rendered by app/story/page.tsx when ?deck=v2.1 is present.
 * It takes full control of the viewport and manages all its own state.
 *
 * Data sources:
 *   CORE_SLIDES    -- 13 slides from src/presentation-v2-1/data/core-story.ts
 *   APPENDIX_SLIDES -- 23 slides from src/presentation-v2-1/data/appendix.ts
 *
 * Keyboard shortcuts:
 *   ArrowRight / ArrowDown / Space  advance one slide
 *   ArrowLeft / ArrowUp             go back one slide
 *   Home                            first slide
 *   End                             last slide
 *   A                               toggle agenda overlay
 *   C                               return to core slide 1
 *   F                               toggle fullscreen
 *   P                               toggle speaker notes
 *   M                               pause / resume motion
 *   D                               toggle download menu
 *   ?                               toggle help overlay
 *   Escape                          close any open overlay
 *
 * End-of-core: after slide 13 the end-of-core prompt is shown. It is NOT
 * auto-advanced -- the presenter must choose to continue, open the appendix,
 * or download.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import "@/styles/presentation-v2-1.css";

import { CORE_SLIDES, type CoreSlide } from "@/presentation-v2-1/data/core-story";
import { APPENDIX_SLIDES, type AppendixSlide } from "@/presentation-v2-1/data/appendix";

import { AgendaSlide } from "./AgendaSlide";
import { DownloadMenu } from "./DownloadMenu";
import { CoreSlide as CoreSlideComponent } from "./CoreSlide";
import { AppendixSlideRenderer } from "./AppendixSlideRenderer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORE_SLIDE_COUNT = CORE_SLIDES.length; // 13

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationV21Props {
  initialSlide?: number;
  exportMode?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationV21({
  initialSlide = 1,
  exportMode = false,
}: PresentationV21Props) {
  const [currentSlide, setCurrentSlide] = useState<number>(
    Math.max(1, Math.min(initialSlide, CORE_SLIDE_COUNT))
  );
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [showAgenda, setShowAgenda] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showDownload, setShowDownload] = useState<boolean>(false);
  const [motionPaused, setMotionPaused] = useState<boolean>(false);
  const [showEndPrompt, setShowEndPrompt] = useState<boolean>(false);
  const [inAppendix, setInAppendix] = useState<boolean>(false);

  const deckRef = useRef<HTMLDivElement>(null);

  // Resolve the currently visible slide data.
  const coreSlide: CoreSlide | undefined = CORE_SLIDES[currentSlide - 1];
  const appendixSlide: AppendixSlide | undefined = APPENDIX_SLIDES[currentSlide - 1];

  // Section key for the agenda overlay active highlight.
  const activeAgendaSection = (!inAppendix && coreSlide?.agendaSection) ? coreSlide.agendaSection : "";

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  const closeAllOverlays = useCallback(() => {
    setShowNotes(false);
    setShowAgenda(false);
    setShowHelp(false);
    setShowDownload(false);
  }, []);

  const goNext = useCallback(() => {
    if (showAgenda || showHelp) return;

    if (!inAppendix) {
      if (currentSlide >= CORE_SLIDE_COUNT) {
        setShowEndPrompt(true);
        return;
      }
      setCurrentSlide((s) => s + 1);
    } else {
      setCurrentSlide((s) => Math.min(s + 1, APPENDIX_SLIDES.length));
    }
  }, [currentSlide, inAppendix, showAgenda, showHelp]);

  const goPrev = useCallback(() => {
    if (showAgenda || showHelp) return;
    setShowEndPrompt(false);
    setCurrentSlide((s) => Math.max(s - 1, 1));
  }, [showAgenda, showHelp]);

  const goFirst = useCallback(() => {
    setCurrentSlide(1);
    setInAppendix(false);
    setShowEndPrompt(false);
  }, []);

  const goLast = useCallback(() => {
    if (inAppendix) {
      setCurrentSlide(APPENDIX_SLIDES.length);
    } else {
      setCurrentSlide(CORE_SLIDE_COUNT);
    }
  }, [inAppendix]);

  const openAppendix = useCallback(() => {
    setInAppendix(true);
    setCurrentSlide(1);
    setShowEndPrompt(false);
    setShowAgenda(false);
  }, []);

  const returnToCore = useCallback(() => {
    setInAppendix(false);
    setCurrentSlide(1);
    setShowEndPrompt(false);
    setShowAgenda(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard handler
  // ---------------------------------------------------------------------------

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
        returnToCore();
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

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        goNext();
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        goFirst();
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        goLast();
        return;
      }
    },
    [
      closeAllOverlays,
      goFirst,
      goLast,
      goNext,
      goPrev,
      returnToCore,
      showAgenda,
      showDownload,
      showEndPrompt,
      showHelp,
      showNotes,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // ---------------------------------------------------------------------------
  // Scale the 1920x1080 slide to fill the viewport letterbox-style.
  // ---------------------------------------------------------------------------

  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const updateScale = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scaleW = vw / 1920;
      const scaleH = vh / 1080;
      setScale(Math.min(scaleW, scaleH));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={deckRef}
      className={[
        "pv21-deck",
        exportMode ? "pv21-export-mode" : "",
        motionPaused ? "pv21-motion-paused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="main"
      aria-label="NFROS Risk Audience Presentation V2.1"
    >
      {/* Letterbox wrapper: centres the 1920x1080 canvas in the viewport. */}
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
          className="pv21-slide"
          style={{ transform: `scale(${scale})` }}
          aria-live="polite"
        >
          {/* Slide content */}
          {!inAppendix && coreSlide != null ? (
            <CoreSlideComponent
              slide={coreSlide}
              slideIndex={currentSlide}
              totalCoreSlides={CORE_SLIDE_COUNT}
              exportMode={exportMode}
              showNotes={showNotes}
            />
          ) : inAppendix && appendixSlide != null ? (
            <AppendixSlideRenderer slide={appendixSlide} />
          ) : (
            <div className="pv21-layout-hero">
              <p className="pv21-body" style={{ color: "var(--pv21-color-secondary)" }}>
                Core slide {currentSlide} not found.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* End-of-core prompt -- shown after slide 13, not auto-advanced. */}
      {showEndPrompt && !inAppendix && (
        <div
          className="pv21-end-prompt"
          role="dialog"
          aria-label="End of core presentation"
        >
          <p className="pv21-end-prompt__title">Core story complete.</p>
          <div className="pv21-end-prompt__actions">
            <button
              className="pv21-end-prompt__btn pv21-end-prompt__btn--primary"
              onClick={() => setShowEndPrompt(false)}
              type="button"
            >
              Continue discussion
            </button>
            <button
              className="pv21-end-prompt__btn"
              onClick={openAppendix}
              type="button"
            >
              Open appendix
            </button>
            <a
              className="pv21-end-prompt__btn"
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
        <div
          className="pv21-agenda-overlay"
          role="dialog"
          aria-label="Agenda"
          onClick={() => setShowAgenda(false)}
        >
          <AgendaSlide
            activeSection={activeAgendaSection}
            onClose={() => setShowAgenda(false)}
            onOpenAppendix={openAppendix}
          />
        </div>
      )}

      {/* Speaker notes are rendered inside the slide canvas by CoreSlide when showNotes is true. */}

      {/* Help overlay */}
      {showHelp && (
        <div
          className="pv21-help-overlay"
          role="dialog"
          aria-label="Keyboard shortcuts"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHelp(false);
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "var(--pv21-text-xl)",
                fontWeight: 600,
                color: "var(--pv21-color-text)",
                margin: 0,
              }}
            >
              Keyboard shortcuts
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--pv21-text-sm)",
                marginTop: "var(--pv21-space-4)",
              }}
            >
              <tbody>
                {(
                  [
                    ["ArrowRight / ArrowDown / Space", "Next slide"],
                    ["ArrowLeft / ArrowUp", "Previous slide"],
                    ["Home", "First slide"],
                    ["End", "Last slide"],
                    ["A", "Toggle agenda overlay"],
                    ["C", "Return to core (slide 1)"],
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
                    style={{ borderBottom: "1px solid var(--pv21-color-border)" }}
                  >
                    <td
                      style={{
                        padding: "var(--pv21-space-2) var(--pv21-space-3) var(--pv21-space-2) 0",
                        width: "220px",
                      }}
                    >
                      <kbd
                        style={{
                          fontFamily: "var(--pv21-font-mono)",
                          fontSize: "var(--pv21-text-xs)",
                          background: "var(--pv21-color-muted-bg)",
                          border: "1px solid var(--pv21-color-border)",
                          borderRadius: "var(--pv21-radius-sm)",
                          padding: "1px 6px",
                          color: "var(--pv21-color-text)",
                        }}
                      >
                        {key}
                      </kbd>
                    </td>
                    <td
                      style={{
                        padding: "var(--pv21-space-2) 0",
                        color: "var(--pv21-color-text)",
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
                marginTop: "var(--pv21-space-5)",
                padding: "var(--pv21-space-2) var(--pv21-space-6)",
                background: "var(--pv21-color-accent)",
                border: "none",
                borderRadius: "var(--pv21-radius-md)",
                color: "#fff",
                fontFamily: "var(--pv21-font-sans)",
                fontSize: "var(--pv21-text-sm)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Download menu */}
      {!exportMode && showDownload && (
        <DownloadMenu
          exportMode={exportMode}
          onClose={() => setShowDownload(false)}
        />
      )}

      {/* Download trigger button */}
      {!exportMode && (
        <button
          type="button"
          className="pv21-download-btn"
          onClick={() => setShowDownload((v) => !v)}
          aria-label="Open download menu"
        >
          Download
        </button>
      )}
    </div>
  );
}
