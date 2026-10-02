"use client";

import { CoreSlide23 } from "../../data/types";
import { ProductProofFrame } from "../../product-proof/ProductProofFrame";
import { PresentationLabel, PresentationMeta } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

const SPINE_CAPABILITIES = [
  "Agenda",
  "Meetings",
  "Actions",
  "Inbox",
  "Evidence",
  "Approval",
] as const;

export function RoleMirrorSlide({ slide, exportMode = false }: Props) {
  const roleColumns = slide.roleColumns;

  const leftRole = roleColumns?.[0]?.role ?? "Operational Risk Partner";
  const rightRole = roleColumns?.[1]?.role ?? "Third-Party Risk Manager";
  const leftJudgment = roleColumns?.[0]?.humanJudgment ?? "RCSA judgment";
  const rightJudgment = roleColumns?.[1]?.humanJudgment ?? "TPRM judgment";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv23-canvas)",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* Left 35%: RCSA role */}
      <div
        style={{
          width: "35%",
          display: "flex",
          flexDirection: "column",
          padding: "48px 24px 48px 80px",
          gap: "var(--pv23-4)",
        }}
      >
        <PresentationLabel color="var(--pv23-text)">{leftRole}</PresentationLabel>
        <ProductProofFrame
          id="rcsa-home"
          exportMode={exportMode}
          style={{ flex: 1, borderRadius: "var(--pv23-radius-product)" }}
        />
        <PresentationMeta color="var(--pv23-brand-purple)">{leftJudgment}</PresentationMeta>
      </div>

      {/* Centre 30%: OS spine */}
      <div
        style={{
          width: "30%",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 1,
            background: "var(--pv23-border-strong)",
          }}
        />

        {/* Capability labels */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            bottom: "10%",
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-around",
            alignItems: "center",
          }}
        >
          {SPINE_CAPABILITIES.map((cap) => (
            <div
              key={cap}
              style={{ display: "flex", alignItems: "center", gap: "var(--pv23-3)" }}
            >
              <div
                style={{ width: 8, height: 8, background: "var(--pv23-border-strong)", flexShrink: 0 }}
              />
              <div
                style={{
                  background: "var(--pv23-surface)",
                  border: "1px solid var(--pv23-border)",
                  padding: "2px var(--pv23-3)",
                  whiteSpace: "nowrap",
                }}
              >
                <PresentationLabel color="var(--pv23-text)">{cap}</PresentationLabel>
              </div>
              <div
                style={{ width: 8, height: 8, background: "var(--pv23-border-strong)", flexShrink: 0 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right 35%: TPRM role */}
      <div
        style={{
          width: "35%",
          display: "flex",
          flexDirection: "column",
          padding: "48px 80px 48px 24px",
          gap: "var(--pv23-4)",
        }}
      >
        <PresentationLabel color="var(--pv23-text)">{rightRole}</PresentationLabel>
        <ProductProofFrame
          id="tprm-home"
          exportMode={exportMode}
          style={{ flex: 1, borderRadius: "var(--pv23-radius-product)" }}
        />
        <PresentationMeta color="var(--pv23-brand-purple)">{rightJudgment}</PresentationMeta>
      </div>
    </div>
  );
}
