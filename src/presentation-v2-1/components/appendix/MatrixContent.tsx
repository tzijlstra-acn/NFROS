"use client";

import React from "react";

interface MatrixContentProps {
  rows: { label: string; cols: string[] }[];
}

export function MatrixContent({ rows }: MatrixContentProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--pv21-space-2)" }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: `200px repeat(${row.cols.length}, minmax(0, 1fr))`,
            gap: "var(--pv21-space-4)",
            alignItems: "start",
            padding: "var(--pv21-space-3) var(--pv21-space-4)",
            background:
              i % 2 === 0
                ? "var(--pv21-color-surface)"
                : "var(--pv21-color-muted-bg)",
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
              lineHeight: 1.4,
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
                lineHeight: 1.45,
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
