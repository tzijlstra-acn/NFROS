"use client";

import React from "react";

interface ServiceStackContentProps {
  tiers: { name: string; cadence: string; includes: string[] }[];
}

export function ServiceStackContent({ tiers }: ServiceStackContentProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--pv21-space-3)",
      }}
    >
      {tiers.map((tier) => (
        <div
          key={tier.name}
          style={{
            background: "var(--pv21-color-surface)",
            border: "1px solid var(--pv21-color-border)",
            borderLeft: "4px solid var(--pv21-color-accent)",
            borderRadius: "var(--pv21-radius-md)",
            padding: "var(--pv21-space-4) var(--pv21-space-6)",
            display: "grid",
            gridTemplateColumns: "200px 160px 1fr",
            gap: "var(--pv21-space-6)",
            alignItems: "start",
          }}
        >
          <p
            style={{
              fontWeight: 600,
              fontSize: "var(--pv21-text-base)",
              margin: 0,
              color: "var(--pv21-color-text)",
              lineHeight: 1.3,
            }}
          >
            {tier.name}
          </p>
          <span
            style={{
              display: "inline-block",
              background: "var(--pv21-color-muted-bg)",
              border: "1px solid var(--pv21-color-border)",
              borderRadius: "var(--pv21-radius-pill)",
              padding: "2px var(--pv21-space-3)",
              fontFamily: "var(--pv21-font-mono)",
              fontSize: "var(--pv21-text-xs)",
              color: "var(--pv21-color-secondary)",
              alignSelf: "center",
            }}
          >
            {tier.cadence}
          </span>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--pv21-space-2)",
            }}
          >
            {tier.includes.map((item) => (
              <li
                key={item}
                style={{
                  fontSize: "var(--pv21-text-sm)",
                  color: "var(--pv21-color-secondary)",
                  background: "var(--pv21-color-muted-bg)",
                  border: "1px solid var(--pv21-color-border)",
                  borderRadius: "var(--pv21-radius-sm)",
                  padding: "2px var(--pv21-space-3)",
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
