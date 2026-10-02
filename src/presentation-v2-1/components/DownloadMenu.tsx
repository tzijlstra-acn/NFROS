"use client";

/**
 * DownloadMenu
 *
 * A small overlay panel with download links for the V2.1 deck.
 * Completely hidden when `exportMode` is true (CSS class pv21-export-mode
 * handles the CSS side; the component also guards at render time).
 *
 * Two links are offered:
 *   1. Full deck (core + appendix) -- PDF
 *   2. Core story only -- PDF
 */

import React from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DownloadMenuProps {
  /**
   * When true the component renders nothing. Export captures must not carry
   * download affordances in the captured frame.
   */
  exportMode?: boolean;
  /**
   * Called when the user clicks outside the menu or presses the close button.
   */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Download targets
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
    description: "Slides 1 -- 13 only",
    href: "/downloads/NFROS_Risk_Audience_Core.pdf",
    filename: "NFROS_Risk_Audience_Core.pdf",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DownloadMenu({ exportMode = false, onClose }: DownloadMenuProps) {
  // Guard: render nothing in export mode.
  if (exportMode) {
    return null;
  }

  return (
    <>
      {/* Backdrop: click to close */}
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 59,
        }}
      />

      <div
        className="pv21-download-menu"
        role="dialog"
        aria-label="Download options"
        style={{ zIndex: 60 }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--pv21-space-4)",
            paddingBottom: "var(--pv21-space-2)",
            borderBottom: "1px solid var(--pv21-color-border)",
            marginBottom: "var(--pv21-space-1)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Downloads
          </span>
          {onClose != null && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close download menu"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--pv21-font-mono)",
                fontSize: "var(--pv21-text-xs)",
                color: "var(--pv21-color-secondary)",
                padding: 0,
              }}
            >
              x
            </button>
          )}
        </div>

        {/* Download links */}
        {DOWNLOADS.map((dl) => (
          <a
            key={dl.href}
            href={dl.href}
            download={dl.filename}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              padding: "var(--pv21-space-3) var(--pv21-space-4)",
              background: "var(--pv21-color-muted-bg)",
              border: "1px solid var(--pv21-color-border)",
              borderRadius: "var(--pv21-radius-md)",
              textDecoration: "none",
              color: "var(--pv21-color-text)",
              cursor: "pointer",
              transition: "background 120ms ease-out",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "var(--pv21-color-border)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "var(--pv21-color-muted-bg)";
            }}
          >
            <span
              style={{
                fontFamily: "var(--pv21-font-sans)",
                fontSize: "var(--pv21-text-sm)",
                fontWeight: 500,
                color: "var(--pv21-color-text)",
              }}
            >
              {dl.label}
            </span>
            <span
              style={{
                fontFamily: "var(--pv21-font-mono)",
                fontSize: "var(--pv21-text-xs)",
                color: "var(--pv21-color-secondary)",
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
