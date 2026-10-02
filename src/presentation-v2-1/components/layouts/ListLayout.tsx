"use client";

/**
 * ListLayout
 *
 * Generic numbered list layout. For slide 2 (Agenda) delegates to AgendaSlide.
 * For other list slides, renders a clean numbered or bulleted list.
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";
import { AgendaSlide } from "../AgendaSlide";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListLayoutProps {
  slide: CoreSlide;
  activeSection?: string;
  exportMode?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ListLayout({ slide, activeSection = "", exportMode = false }: ListLayoutProps) {
  // slide-02 is the agenda -- delegate to the dedicated AgendaSlide component.
  if (slide.id === "slide-02") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "var(--pv21-space-10) var(--pv21-space-16)",
          justifyContent: "center",
          gap: "var(--pv21-space-8)",
        }}
      >
        {/* Title row */}
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
        </div>

        {/* Agenda list */}
        {slide.bullets != null && (
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {slide.bullets.map((bullet, i) => {
              const num = i + 1;
              const isActive = activeSection !== "" && false; // no active highlighting in full-slide mode
              return (
                <li
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px minmax(0, 1fr)",
                    gap: "var(--pv21-space-6)",
                    alignItems: "baseline",
                    padding: "var(--pv21-space-4) 0",
                    borderBottom: i < (slide.bullets?.length ?? 0) - 1
                      ? "1px solid var(--pv21-color-border)"
                      : "none",
                    color: "var(--pv21-color-secondary)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--pv21-font-mono)",
                      fontSize: "var(--pv21-text-xl)",
                      color: "var(--pv21-color-accent)",
                      lineHeight: 1,
                    }}
                  >
                    {String(num).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--pv21-text-lg)",
                      fontWeight: 500,
                      lineHeight: 1.3,
                    }}
                  >
                    {bullet}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Download PDF link */}
        {!exportMode && (
          <div style={{ paddingTop: "var(--pv21-space-4)" }}>
            <a
              href="/downloads/NFROS_Risk_Audience_Core.pdf"
              download="NFROS_Risk_Audience_Core.pdf"
              style={{
                fontFamily: "var(--pv21-font-mono)",
                fontSize: "var(--pv21-text-xs)",
                color: "var(--pv21-color-accent)",
                textDecoration: "underline",
                letterSpacing: "0.04em",
              }}
            >
              Download PDF
            </a>
          </div>
        )}
      </div>
    );
  }

  // Generic list slide.
  return (
    <div className="pv21-layout-list">
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

      {slide.bullets != null && (
        <ul className="pv21-bullets">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="pv21-bullet">
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
