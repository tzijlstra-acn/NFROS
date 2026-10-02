"use client";

import React from "react";

interface ProcessFlowContentProps {
  steps: { name: string; output: string }[];
}

export function ProcessFlowContent({ steps }: ProcessFlowContentProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {steps.map((step, i) => (
        <React.Fragment key={step.name}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: "var(--pv21-space-6)",
              alignItems: "center",
              background: "var(--pv21-color-surface)",
              border: "1px solid var(--pv21-color-border)",
              borderRadius: "var(--pv21-radius-md)",
              padding: "var(--pv21-space-4) var(--pv21-space-6)",
            }}
          >
            <p
              style={{
                fontWeight: 600,
                fontSize: "var(--pv21-text-base)",
                margin: 0,
                color: "var(--pv21-color-accent)",
                lineHeight: 1.3,
              }}
            >
              {step.name}
            </p>
            <p
              style={{
                fontSize: "var(--pv21-text-sm)",
                margin: 0,
                color: "var(--pv21-color-secondary)",
                lineHeight: 1.5,
              }}
            >
              {step.output}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                paddingLeft: "var(--pv21-space-10)",
                height: "var(--pv21-space-5)",
                color: "var(--pv21-color-secondary)",
                fontSize: "var(--pv21-text-sm)",
                fontFamily: "var(--pv21-font-mono)",
                userSelect: "none",
              }}
            >
              |
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
