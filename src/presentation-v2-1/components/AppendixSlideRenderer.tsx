"use client";

/**
 * AppendixSlideRenderer
 *
 * Renders a single AppendixSlide using the content variant declared in its
 * `content.kind` field. The renderer is intentionally simple: appendix slides
 * are reference material, not set-piece presentations, so layout fidelity
 * matters less than legibility.
 *
 * Content kinds handled:
 *   status-table     -- label / status / note rows
 *   capability-map   -- named groups of capability items
 *   service-stack    -- tiers with cadence and includes
 *   text-columns     -- two headed columns of bullet items
 *   process-flow     -- named steps with outputs
 *   matrix           -- row label plus multiple column values
 *   three-column     -- three equal headed columns
 *   simple-list      -- grouped items with optional status chips
 */

import React from "react";
import type { AppendixSlide, AppendixContent } from "@/presentation-v2-1/data/appendix";

interface AppendixSlideRendererProps {
  slide: AppendixSlide;
}

export function AppendixSlideRenderer({ slide }: AppendixSlideRendererProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--pv21-space-8)",
        padding: "var(--pv21-space-10) var(--pv21-space-16)",
        height: "100%",
        overflowY: "auto",
      }}
    >
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
          Appendix
        </p>
        <h2
          style={{
            fontSize: "var(--pv21-text-3xl)",
            fontWeight: 600,
            color: "var(--pv21-color-text)",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {slide.title}
        </h2>
      </div>

      <AppendixContentRenderer content={slide.content} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content variant dispatcher
// ---------------------------------------------------------------------------

function AppendixContentRenderer({ content }: { content: AppendixContent }) {
  switch (content.kind) {
    case "status-table":
      return <StatusTable rows={content.rows} />;
    case "capability-map":
      return <CapabilityMap groups={content.groups} />;
    case "service-stack":
      return <ServiceStack tiers={content.tiers} />;
    case "text-columns":
      return <TextColumns columns={content.columns} />;
    case "process-flow":
      return <ProcessFlow steps={content.steps} />;
    case "matrix":
      return <Matrix rows={content.rows} />;
    case "three-column":
      return <ThreeColumn columns={content.columns} />;
    case "simple-list":
      return <SimpleList groups={content.groups} />;
    default: {
      const _exhaustive: never = content;
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Status table
// ---------------------------------------------------------------------------

function StatusTable({
  rows,
}: {
  rows: { label: string; status: string; note?: string }[];
}) {
  const statusClass = (status: string): string => {
    const s = status.toLowerCase();
    if (s === "implemented") return "pv21-status pv21-status--implemented";
    if (s.startsWith("demo")) return "pv21-status pv21-status--demo-only";
    if (s === "planned") return "pv21-status pv21-status--planned";
    return "pv21-status pv21-status--configured";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--pv21-space-1)" }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) 200px minmax(0, 1fr)",
            gap: "var(--pv21-space-4)",
            alignItems: "center",
            padding: "var(--pv21-space-3) var(--pv21-space-4)",
            background: i % 2 === 0 ? "var(--pv21-color-surface)" : "var(--pv21-color-muted-bg)",
            borderRadius: "var(--pv21-radius-md)",
            border: "1px solid var(--pv21-color-border)",
          }}
        >
          <span
            style={{
              fontSize: "var(--pv21-text-sm)",
              fontWeight: 500,
              color: "var(--pv21-color-text)",
            }}
          >
            {row.label}
          </span>
          <span className={statusClass(row.status)}>{row.status}</span>
          {row.note != null && (
            <span
              style={{
                fontSize: "var(--pv21-text-xs)",
                color: "var(--pv21-color-secondary)",
                lineHeight: 1.4,
              }}
            >
              {row.note}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Capability map
// ---------------------------------------------------------------------------

function CapabilityMap({ groups }: { groups: { name: string; items: string[] }[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "var(--pv21-space-4)",
      }}
    >
      {groups.map((group, i) => (
        <div key={i} className="pv21-col-card">
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: 0,
              marginBottom: "var(--pv21-space-3)",
            }}
          >
            {group.name}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--pv21-space-2)" }}>
            {group.items.map((item, j) => (
              <li
                key={j}
                style={{
                  fontSize: "var(--pv21-text-sm)",
                  color: "var(--pv21-color-text)",
                  lineHeight: 1.45,
                  paddingLeft: "var(--pv21-space-3)",
                  borderLeft: "2px solid var(--pv21-color-border)",
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service stack
// ---------------------------------------------------------------------------

function ServiceStack({
  tiers,
}: {
  tiers: { name: string; cadence: string; includes: string[] }[];
}) {
  return (
    <div className="pv21-service-stack">
      {tiers.map((tier, i) => (
        <div key={i} className="pv21-service-tier">
          <div style={{ flex: "0 0 200px" }}>
            <p
              style={{
                fontSize: "var(--pv21-text-sm)",
                fontWeight: 600,
                color: "var(--pv21-color-text)",
                margin: 0,
              }}
            >
              {tier.name}
            </p>
            <p
              style={{
                fontFamily: "var(--pv21-font-mono)",
                fontSize: "var(--pv21-text-xs)",
                color: "var(--pv21-color-secondary)",
                margin: 0,
                marginTop: "2px",
              }}
            >
              {tier.cadence}
            </p>
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--pv21-space-2)",
              minWidth: 0,
            }}
          >
            {tier.includes.map((item, j) => (
              <li
                key={j}
                style={{
                  fontSize: "var(--pv21-text-xs)",
                  color: "var(--pv21-color-text)",
                  background: "var(--pv21-color-muted-bg)",
                  border: "1px solid var(--pv21-color-border)",
                  borderRadius: "var(--pv21-radius-sm)",
                  padding: "2px var(--pv21-space-3)",
                  whiteSpace: "nowrap",
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text columns
// ---------------------------------------------------------------------------

function TextColumns({
  columns,
}: {
  columns: { heading: string; items: string[] }[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        gap: "var(--pv21-space-6)",
      }}
    >
      {columns.map((col, i) => (
        <div key={i} className="pv21-col-card">
          <p
            style={{
              fontSize: "var(--pv21-text-md)",
              fontWeight: 600,
              color: "var(--pv21-color-text)",
              margin: 0,
              marginBottom: "var(--pv21-space-4)",
              borderBottom: "2px solid var(--pv21-color-accent)",
              paddingBottom: "var(--pv21-space-3)",
            }}
          >
            {col.heading}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--pv21-space-3)" }}>
            {col.items.map((item, j) => (
              <li
                key={j}
                style={{
                  fontSize: "var(--pv21-text-sm)",
                  color: "var(--pv21-color-text)",
                  lineHeight: 1.45,
                  paddingLeft: "var(--pv21-space-3)",
                  borderLeft: "2px solid var(--pv21-color-border)",
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Process flow
// ---------------------------------------------------------------------------

function ProcessFlow({
  steps,
}: {
  steps: { name: string; output: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--pv21-space-3)" }}>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "180px minmax(0, 1fr)",
            gap: "var(--pv21-space-4)",
            alignItems: "start",
            padding: "var(--pv21-space-3) var(--pv21-space-4)",
            background: "var(--pv21-color-surface)",
            border: "1px solid var(--pv21-color-border)",
            borderRadius: "var(--pv21-radius-md)",
            borderLeft: "4px solid var(--pv21-color-accent)",
          }}
        >
          <p
            style={{
              fontSize: "var(--pv21-text-sm)",
              fontWeight: 600,
              color: "var(--pv21-color-accent)",
              margin: 0,
            }}
          >
            {step.name}
          </p>
          <p
            style={{
              fontSize: "var(--pv21-text-sm)",
              color: "var(--pv21-color-text)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {step.output}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------

function Matrix({ rows }: { rows: { label: string; cols: string[] }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--pv21-space-2)" }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: `180px repeat(${row.cols.length}, minmax(0, 1fr))`,
            gap: "var(--pv21-space-4)",
            alignItems: "start",
            padding: "var(--pv21-space-3) var(--pv21-space-4)",
            background: i % 2 === 0 ? "var(--pv21-color-surface)" : "var(--pv21-color-muted-bg)",
            border: "1px solid var(--pv21-color-border)",
            borderRadius: "var(--pv21-radius-md)",
          }}
        >
          <p
            style={{
              fontSize: "var(--pv21-text-sm)",
              fontWeight: 600,
              color: "var(--pv21-color-text)",
              margin: 0,
            }}
          >
            {row.label}
          </p>
          {row.cols.map((col, j) => (
            <p
              key={j}
              style={{
                fontSize: "var(--pv21-text-xs)",
                color: "var(--pv21-color-secondary)",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {col}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Three-column
// ---------------------------------------------------------------------------

function ThreeColumn({
  columns,
}: {
  columns: [
    { heading: string; items: string[] },
    { heading: string; items: string[] },
    { heading: string; items: string[] },
  ];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "var(--pv21-space-5)",
      }}
    >
      {columns.map((col, i) => (
        <div key={i} className="pv21-col-card">
          <p
            style={{
              fontSize: "var(--pv21-text-md)",
              fontWeight: 600,
              color: "var(--pv21-color-text)",
              margin: 0,
              marginBottom: "var(--pv21-space-4)",
              borderBottom: "2px solid var(--pv21-color-accent)",
              paddingBottom: "var(--pv21-space-3)",
            }}
          >
            {col.heading}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--pv21-space-2)" }}>
            {col.items.map((item, j) => (
              <li
                key={j}
                style={{
                  fontSize: "var(--pv21-text-xs)",
                  color: "var(--pv21-color-text)",
                  lineHeight: 1.45,
                  paddingLeft: "var(--pv21-space-3)",
                  borderLeft: "2px solid var(--pv21-color-border)",
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple list with optional status chips
// ---------------------------------------------------------------------------

function SimpleList({
  groups,
}: {
  groups: { heading: string; items: { text: string; status?: string }[] }[];
}) {
  const statusClass = (status: string | undefined): string => {
    if (status == null) return "";
    const s = status.toLowerCase();
    if (s === "implemented" || s === "installed") return "pv21-status pv21-status--implemented";
    if (s === "demo" || s.startsWith("demo")) return "pv21-status pv21-status--demo-only";
    if (s === "planned") return "pv21-status pv21-status--planned";
    return "pv21-status pv21-status--configured";
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "var(--pv21-space-5)",
      }}
    >
      {groups.map((group, i) => (
        <div key={i} className="pv21-col-card">
          <p
            style={{
              fontSize: "var(--pv21-text-md)",
              fontWeight: 600,
              color: "var(--pv21-color-text)",
              margin: 0,
              marginBottom: "var(--pv21-space-4)",
              borderBottom: "2px solid var(--pv21-color-accent)",
              paddingBottom: "var(--pv21-space-3)",
            }}
          >
            {group.heading}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--pv21-space-2)" }}>
            {group.items.map((item, j) => (
              <li
                key={j}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--pv21-space-3)",
                  fontSize: "var(--pv21-text-sm)",
                  color: "var(--pv21-color-text)",
                  lineHeight: 1.4,
                  padding: "var(--pv21-space-2) 0",
                  borderBottom: "1px solid var(--pv21-color-border)",
                }}
              >
                <span>{item.text}</span>
                {item.status != null && (
                  <span className={statusClass(item.status)} style={{ flexShrink: 0 }}>
                    {item.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
