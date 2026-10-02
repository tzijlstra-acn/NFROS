"use client";

import React from "react";

interface StatusTableContentProps {
  rows: { label: string; status: string; note?: string }[];
}

function resolveStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "implemented" || s === "verified locally") return "pv21-status--implemented";
  if (s.startsWith("demonstration") || s === "demo only") return "pv21-status--demo-only";
  if (s === "planned") return "pv21-status--planned";
  if (
    s.startsWith("configured") ||
    s.startsWith("designed") ||
    s.startsWith("architecture")
  ) {
    return "pv21-status--configured";
  }
  return "";
}

export function StatusTableContent({ rows }: StatusTableContentProps) {
  return (
    <table className="pv21-matrix" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th style={{ width: "36%" }}>Item</th>
          <th style={{ width: "24%" }}>Status</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.label}
            style={{ borderBottom: "1px solid var(--pv21-color-border)" }}
          >
            <td
              style={{
                padding: "var(--pv21-space-3) var(--pv21-space-4)",
                fontWeight: 500,
                fontSize: "var(--pv21-text-sm)",
                verticalAlign: "middle",
                color: "var(--pv21-color-text)",
              }}
            >
              {row.label}
            </td>
            <td
              style={{
                padding: "var(--pv21-space-3) var(--pv21-space-4)",
                verticalAlign: "middle",
              }}
            >
              <span
                className={
                  "pv21-status" +
                  (resolveStatusClass(row.status)
                    ? " " + resolveStatusClass(row.status)
                    : "")
                }
              >
                {row.status}
              </span>
            </td>
            <td
              style={{
                padding: "var(--pv21-space-3) var(--pv21-space-4)",
                color: "var(--pv21-color-secondary)",
                fontSize: "var(--pv21-text-sm)",
                verticalAlign: "middle",
                lineHeight: 1.45,
              }}
            >
              {row.note ?? ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
