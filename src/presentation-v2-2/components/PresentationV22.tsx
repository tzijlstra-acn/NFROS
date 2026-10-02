"use client";

/**
 * PresentationV22
 *
 * Root component for the NFROS V2.2 presentation engine. Manages keyboard
 * navigation, URL-synced state, animated slide transitions, and all overlay
 * UI (help, agenda, end-of-core, download).
 *
 * Rendered by app/story/page.tsx when ?deck=v2.2 or ?deck=current is set.
 *
 * Keyboard shortcuts:
 *   ArrowRight / ArrowDown / Space   advance one slide
 *   ArrowLeft / ArrowUp              go back one slide
 *   Home                             first slide
 *   End                              last slide
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
import "@/presentation-v2-2/styles/presentation-v2-2.css";

import { CORE_SLIDES_V22 } from "../data/core-story";
import { APPENDIX_SLIDES } from "../data/appendix";
import { useSlideNavigation } from "../hooks/useSlideNavigation";
import { SharedSlideTransition } from "../motion/SharedSlideTransition";
import { CoreSlideV22 } from "./CoreSlideV22";
import { AppendixSlideV22 } from "./AppendixSlideV22";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORE_SLIDE_COUNT = CORE_SLIDES_V22.length; // 13
const APPENDIX_IDS = APPENDIX_SLIDES.map((s) => s.id);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationV22Props {
  initialCoreSlide?: number;       // 1-based; defaults to 1
  initialAppendixId?: string | null;
  initialFrom?: string | null;
  exportMode?: boolean;
}

// ---------------------------------------------------------------------------
// Download menu (V2.2 inline, using pv22- tokens)
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

function DownloadMenuV22({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div className="pv22-download-menu" role="dialog" aria-label="Download options">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--pv22-space-4)",
            paddingBottom: "var(--pv22-space-2)",
            borderBottom: "1px solid var(--pv22-color-border)",
            marginBottom: "var(--pv22-space-1)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--pv22-font-mono)",
              fontSize: "var(--pv22-text-xs)",
              color: "var(--pv22-color-secondary)",
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
              fontFamily: "var(--pv22-font-mono)",
              fontSize: "var(--pv22-text-xs)",
              color: "var(--pv22-color-secondary)",
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
              gap: "2px",
              padding: "var(--pv22-space-3) var(--pv22-space-4)",
              background: "var(--pv22-color-muted-bg)",
              border: "1px solid var(--pv22-color-border)",
              textDecoration: "none",
              color: "var(--pv22-color-text)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontFamily: "var(--pv22-font-family)",
                fontSize: "var(--pv22-text-sm)",
                fontWeight: 500,
              }}
            >
              {dl.label}
            </span>
            <span
              style={{
                fontFamily: "var(--pv22-font-mono)",
                fontSize: "var(--pv22-text-xs)",
                color: "var(--pv22-color-secondary)",
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

const AGENDA_ITEMS = CORE_SLIDES_V22[1]?.agendaItems ?? [];

function AgendaOverlayV22({
  activeCoreIndex,
  onClose,
  onOpenAppendix,
}: {
  activeCoreIndex: number;
  onClose: () => void;
  onOpenAppendix: () => void;
}) {
  const activeSection = CORE_SLIDES_V22[activeCoreIndex]?.section ?? "";

  return (
    <div
      className="pv22-agenda-overlay"
      role="dialog"
      aria-label="Agenda"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--pv22-color-surface)",
          border: "1px solid var(--pv22-color-border)",
          padding: "var(--pv22-space-10)",
          width: "min(860px, 90vw)",
          maxHeight: "80dvh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--pv22-space-6)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--pv22-font-family)",
            fontSize: "var(--pv22-text-xl)",
            fontWeight: 600,
            margin: 0,
            color: "var(--pv22-color-text)",
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
                className={`pv22-agenda-item${isActive ? " pv22-agenda-item--active" : ""}`}
              >
                <span className="pv22-agenda-item__number">{String(i + 1).padStart(2, "0")}</span>
                <span className="pv22-agenda-item__label">{item.text}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "var(--pv22-space-3)" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "var(--pv22-space-2) var(--pv22-space-6)",
              background: "var(--pv22-color-accent)",
              border: "none",
              color: "#fff",
              fontFamily: "var(--pv22-font-family)",
              fontSize: "var(--pv22-text-sm)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onOpenAppendix}
            style={{
              padding: "var(--pv22-space-2) var(--pv22-space-6)",
              background: "var(--pv22-color-surface)",
              border: "1px solid var(--pv22-color-border)",
              color: "var(--pv22-color-text)",
              fontFamily: "var(--pv22-font-family)",
              fontSize: "var(--pv22-text-sm)",
              cursor: "pointer",
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
// Component
// ---------------------------------------------------------------------------

export function PresentationV22({
  initialCoreSlide = 1,
  initialAppendixId = null,
  initialFrom = null,
  exportMode = false,
}: PresentationV22Props) {
  const nav = useSlideNavigation(
    CORE_SLIDE_COUNT,
    APPENDIX_IDS,
    initialCoreSlide,
    initialAppendixId,
    initialFrom,
  );

  const { state, goToCore, goToAppendix, returnToOrigin, goBack, goForward, goToFirst, goToLast } = nav;

  // Local UI state
  const [showNotes, setShowNotes] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [showEndPrompt, setShowEndPrompt] = useState(false);

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
    goForward();
  }, [goForward, showAgenda, showHelp, state.mode, state.coreIndex]);

  const handleGoBack = useCallback(() => {
    if (showAgenda || showHelp) return;
    setShowEndPrompt(false);
    goBack();
  }, [goBack, showAgenda, showHelp]);

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
          // Return to origin core slide
          returnToOrigin();
          setShowEndPrompt(false);
        } else {
          // In core: toggle agenda (same shortcut register as A)
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
  // Derived values
  // -------------------------------------------------------------------------

  const currentCoreSlide = CORE_SLIDES_V22[state.coreIndex];

  // Unique key for SharedSlideTransition: changes on every slide change
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
        "pv22-deck",
        exportMode ? "pv22-export-mode" : "",
        motionPaused ? "pv22-motion-paused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="main"
      aria-label="NFROS Presentation V2.2"
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
          className="pv22-slide"
          style={{ transform: `scale(${scale})` }}
          aria-live="polite"
        >
          <SharedSlideTransition
            slideKey={slideKey}
            direction={state.direction}
            exportMode={exportMode}
          >
            {state.mode === "core" && currentCoreSlide != null ? (
              <CoreSlideV22
                slide={currentCoreSlide}
                slideIndex={state.coreIndex + 1}
                totalCoreSlides={CORE_SLIDE_COUNT}
                exportMode={exportMode}
                showNotes={showNotes}
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
                  color: "var(--pv22-color-secondary)",
                  fontFamily: "var(--pv22-font-family)",
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
          className="pv22-end-prompt"
          role="dialog"
          aria-label="End of core presentation"
        >
          <p className="pv22-end-prompt__title">Core story complete.</p>
          <div className="pv22-end-prompt__actions">
            <button
              className="pv22-end-prompt__btn pv22-end-prompt__btn--primary"
              onClick={() => setShowEndPrompt(false)}
              type="button"
            >
              Continue discussion
            </button>
            <button
              className="pv22-end-prompt__btn"
              onClick={openAppendixFirst}
              type="button"
            >
              Open appendix
            </button>
            <a
              className="pv22-end-prompt__btn"
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
        <AgendaOverlayV22
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
          className="pv22-help-overlay"
          role="dialog"
          aria-label="Keyboard shortcuts"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHelp(false);
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "var(--pv22-text-xl)",
                fontWeight: 600,
                color: "var(--pv22-color-text)",
                margin: 0,
                fontFamily: "var(--pv22-font-family)",
              }}
            >
              Keyboard shortcuts
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--pv22-text-sm)",
                marginTop: "var(--pv22-space-4)",
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
                    style={{ borderBottom: "1px solid var(--pv22-color-border)" }}
                  >
                    <td
                      style={{
                        padding: "var(--pv22-space-2) var(--pv22-space-3) var(--pv22-space-2) 0",
                        width: "260px",
                      }}
                    >
                      <kbd
                        style={{
                          fontFamily: "var(--pv22-font-mono)",
                          fontSize: "var(--pv22-text-xs)",
                          background: "var(--pv22-color-muted-bg)",
                          border: "1px solid var(--pv22-color-border)",
                          padding: "1px 6px",
                          color: "var(--pv22-color-text)",
                        }}
                      >
                        {key}
                      </kbd>
                    </td>
                    <td
                      style={{
                        padding: "var(--pv22-space-2) 0",
                        color: "var(--pv22-color-text)",
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
                marginTop: "var(--pv22-space-5)",
                padding: "var(--pv22-space-2) var(--pv22-space-6)",
                background: "var(--pv22-color-accent)",
                border: "none",
                color: "#fff",
                fontFamily: "var(--pv22-font-family)",
                fontSize: "var(--pv22-text-sm)",
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
        <DownloadMenuV22 onClose={() => setShowDownload(false)} />
      )}

      {/* Download trigger button */}
      {!exportMode && (
        <button
          type="button"
          className="pv22-download-btn"
          onClick={() => setShowDownload((v) => !v)}
          aria-label="Open download menu"
        >
          Download
        </button>
      )}
    </div>
  );
}
