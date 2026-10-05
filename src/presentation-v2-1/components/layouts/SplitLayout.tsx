"use client";

/**
 * SplitLayout
 *
 * Two-panel left/right layout.
 *
 * slide-03 (Problem / Fragmented Work): left = text content, right = SVG
 * connection diagram showing scattered labels converging on "Risk professional"
 * with "Decision" at the far right. Emphasis text below: "The first task is
 * often assembly. Not risk judgment."
 *
 * All other split slides: left = text content, right = callout card or
 * visual placeholder.
 */

import React from "react";
import { type CoreSlide } from "@/presentation-v2-1/data/core-story";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SplitLayoutProps {
  slide: CoreSlide;
}

// ---------------------------------------------------------------------------
// Fragmented work diagram (SVG)
// ---------------------------------------------------------------------------

function FragmentedDiagram() {
  const centerX = 500;
  const centerY = 360;

  const nodes: { label: string; x: number; y: number }[] = [
    { label: "Mail", x: 80, y: 80 },
    { label: "Meetings", x: 200, y: 220 },
    { label: "Documents", x: 100, y: 380 },
    { label: "GRC", x: 240, y: 520 },
    { label: "Data", x: 400, y: 600 },
    { label: "Actions", x: 480, y: 160 },
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        viewBox="0 0 760 720"
        style={{ width: "100%", height: "100%" }}
        aria-hidden="true"
      >
        {/* Faint connecting lines from scattered nodes to center */}
        {nodes.map((n, i) => (
          <line
            key={i}
            x1={n.x}
            y1={n.y}
            x2={centerX}
            y2={centerY}
            stroke="var(--pv21-color-border)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ))}

        {/* Arrow from center to "Decision" */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="var(--pv21-color-accent)" />
          </marker>
        </defs>
        <line
          x1={centerX + 72}
          y1={centerY}
          x2={680}
          y2={centerY}
          stroke="var(--pv21-color-accent)"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />

        {/* Scattered input labels */}
        {nodes.map((n, i) => (
          <g key={i}>
            <rect
              x={n.x - 42}
              y={n.y - 14}
              width={84}
              height={28}
              rx="6"
              fill="var(--pv21-color-surface)"
              stroke="var(--pv21-color-border)"
            />
            <text
              x={n.x}
              y={n.y + 5}
              textAnchor="middle"
              fontSize="12"
              fontFamily="var(--pv21-font-sans)"
              fill="var(--pv21-color-secondary)"
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* Center node: "Risk professional" */}
        <circle
          cx={centerX}
          cy={centerY}
          r={70}
          fill="var(--pv21-color-muted-bg)"
          stroke="var(--pv21-color-border)"
          strokeWidth="2"
        />
        <text
          x={centerX}
          y={centerY - 6}
          textAnchor="middle"
          fontSize="11"
          fontFamily="var(--pv21-font-sans)"
          fontWeight="600"
          fill="var(--pv21-color-text)"
        >
          Risk
        </text>
        <text
          x={centerX}
          y={centerY + 9}
          textAnchor="middle"
          fontSize="11"
          fontFamily="var(--pv21-font-sans)"
          fontWeight="600"
          fill="var(--pv21-color-text)"
        >
          professional
        </text>

        {/* "Decision" label at right */}
        <rect
          x={688}
          y={centerY - 18}
          width={68}
          height={36}
          rx="8"
          fill="var(--pv21-color-accent)"
        />
        <text
          x={722}
          y={centerY + 5}
          textAnchor="middle"
          fontSize="12"
          fontFamily="var(--pv21-font-sans)"
          fontWeight="600"
          fill="#fff"
        >
          Decision
        </text>
      </svg>

      {/* Emphasis text below diagram */}
      <p
        style={{
          position: "absolute",
          bottom: "var(--pv21-space-8)",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "var(--pv21-font-sans)",
          fontSize: "var(--pv21-text-base)",
          fontStyle: "italic",
          color: "var(--pv21-color-secondary)",
          margin: 0,
        }}
      >
        The first task is often assembly. Not risk judgment.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic right panel (work hub callout placeholder)
// ---------------------------------------------------------------------------

function GenericRightPanel({ slide }: { slide: CoreSlide }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--pv21-space-4)",
        width: "100%",
        maxWidth: 640,
      }}
    >
      {/* Callout card */}
      {slide.callouts != null && slide.callouts.length > 0 && (
        <div
          style={{
            background: "var(--pv21-color-muted-bg)",
            border: "1px solid var(--pv21-color-border)",
            borderRadius: "var(--pv21-radius-lg)",
            padding: "var(--pv21-space-6) var(--pv21-space-8)",
          }}
        >
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
            Reference
          </p>
          {slide.callouts.map((c, i) => (
            <p
              key={i}
              style={{
                fontSize: "var(--pv21-text-base)",
                color: "var(--pv21-color-secondary)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {c}
            </p>
          ))}
        </div>
      )}

      {/* Visual placeholder: simulated work hub */}
      <div
        style={{
          background: "var(--pv21-color-surface)",
          border: "1px solid var(--pv21-color-border)",
          borderRadius: "var(--pv21-radius-lg)",
          padding: "var(--pv21-space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--pv21-space-3)",
        }}
      >
        {/* Simulated rows */}
        {[
          { label: "RCSA Q3: OR Partner review", stage: "Review" },
          { label: "Third-party onboarding: Vendor A", stage: "Decision" },
          { label: "Control assurance: Q4 cycle", stage: "Evidence" },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--pv21-space-3) var(--pv21-space-4)",
              background: "var(--pv21-color-muted-bg)",
              borderRadius: "var(--pv21-radius-md)",
              gap: "var(--pv21-space-4)",
            }}
          >
            <span
              style={{
                fontSize: "var(--pv21-text-sm)",
                color: "var(--pv21-color-text)",
                fontWeight: 500,
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                fontFamily: "var(--pv21-font-mono)",
                fontSize: "var(--pv21-text-xs)",
                color: "var(--pv21-color-accent)",
                background: "#EDE9FE",
                borderRadius: "var(--pv21-radius-pill)",
                padding: "2px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {row.stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SplitLayout({ slide }: SplitLayoutProps) {
  const isFragmented = slide.id === "slide-03";

  return (
    <div className="pv21-layout-split">
      {/* Left: text content */}
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

        {slide.bodyCopy != null && (
          <p className="pv21-body" style={{ marginTop: "var(--pv21-space-5)" }}>
            {slide.bodyCopy}
          </p>
        )}

        {slide.bullets != null && (
          <ul className="pv21-bullets" style={{ marginTop: "var(--pv21-space-6)" }}>
            {slide.bullets.map((bullet, i) => (
              <li key={i} className="pv21-bullet">
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Callout */}
        {slide.callouts != null && slide.callouts.length > 0 && !isFragmented && (
          <div
            style={{
              marginTop: "var(--pv21-space-6)",
              borderLeft: "3px solid var(--pv21-color-accent)",
              paddingLeft: "var(--pv21-space-4)",
            }}
          >
            {slide.callouts.map((c, i) => (
              <p
                key={i}
                style={{
                  fontSize: "var(--pv21-text-base)",
                  fontWeight: 500,
                  color: "var(--pv21-color-text)",
                  margin: 0,
                }}
              >
                {c}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Right: diagram or callout panel */}
      {isFragmented ? (
        <FragmentedDiagram />
      ) : (
        <GenericRightPanel slide={slide} />
      )}
    </div>
  );
}
