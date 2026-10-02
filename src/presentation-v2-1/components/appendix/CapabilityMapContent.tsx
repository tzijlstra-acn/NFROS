"use client";

import React from "react";

interface CapabilityMapContentProps {
  groups: { name: string; items: string[] }[];
}

export function CapabilityMapContent({ groups }: CapabilityMapContentProps) {
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
        <div
          key={group.name}
          className="pv21-col-card"
          style={{ gap: "var(--pv21-space-4)" }}
        >
          <p
            style={{
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--pv21-color-accent)",
              margin: 0,
              fontWeight: 500,
            }}
          >
            {group.name}
          </p>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--pv21-space-2)",
            }}
          >
            {group.items.map((item) => (
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
