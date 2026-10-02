"use client";

import React from "react";

interface SimpleListContentProps {
  groups: { heading: string; items: { text: string; status?: string }[] }[];
}

function resolveStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "implemented") return "pv21-status--implemented";
  if (s === "demo" || s.startsWith("demo")) return "pv21-status--demo-only";
  if (s === "planned") return "pv21-status--planned";
  return "pv21-status--configured";
}

export function SimpleListContent({ groups }: SimpleListContentProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "var(--pv21-space-5)",
        alignItems: "start",
      }}
    >
      {groups.map((group) => (
        <div key={group.heading} className="pv21-col-card">
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
            {group.heading}
          </h3>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--pv21-space-1)",
            }}
          >
            {group.items.map((item) => (
              <li
                key={item.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--pv21-space-3)",
                  fontSize: "var(--pv21-text-sm)",
                  color: "var(--pv21-color-text)",
                  padding: "var(--pv21-space-2) 0",
                  borderBottom: "1px solid var(--pv21-color-border)",
                  lineHeight: 1.4,
                }}
              >
                <span>{item.text}</span>
                {item.status != null && (
                  <span
                    className={`pv21-status ${resolveStatusClass(item.status)}`}
                    style={{ flexShrink: 0 }}
                  >
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
