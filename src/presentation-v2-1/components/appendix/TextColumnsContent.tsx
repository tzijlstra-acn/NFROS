"use client";

import React from "react";

interface TextColumnsContentProps {
  columns: { heading: string; items: string[] }[];
}

export function TextColumnsContent({ columns }: TextColumnsContentProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        gap: "var(--pv21-space-6)",
        alignItems: "start",
      }}
    >
      {columns.map((col) => (
        <div key={col.heading} className="pv21-col-card">
          <h3
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--pv21-color-accent)",
              fontWeight: 500,
              margin: 0,
            }}
          >
            {col.heading}
          </h3>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--pv21-space-3)",
            }}
          >
            {col.items.map((item) => (
              <li
                key={item}
                className="pv21-bullet"
                style={{ fontSize: "var(--pv21-text-sm)" }}
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
