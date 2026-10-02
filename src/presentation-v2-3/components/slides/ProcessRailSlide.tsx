"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import { ProductProofFrame } from "../../product-proof/ProductProofFrame";
import { PresentationLabel, PresentationMeta } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

const RCSA_STAGES_DEFAULT = [
  "Scope",
  "Evidence",
  "Risk change",
  "First line",
  "Challenge",
  "Rating",
  "Actions",
  "Monitoring",
] as const;

const TPRM_STAGES_DEFAULT = [
  "Request",
  "Classify",
  "Due diligence",
  "Evidence",
  "Specialist",
  "Contract",
  "Decision",
  "Handover",
] as const;

// Human gate is between stage index 4 and 5
const HUMAN_GATE_AFTER = 4;

type RailProps = {
  label: string;
  stages: readonly string[];
  currentStageIndex: number;
  assetId: "rcsa-process-stage" | "tprm-process-stage";
  exportMode: boolean;
};

function ProcessRail({ label, stages, currentStageIndex, assetId, exportMode }: RailProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--pv23-4)" }}>
      <PresentationLabel color="var(--pv23-text)">{label}</PresentationLabel>

      <div style={{ display: "flex", flexDirection: "row", gap: "var(--pv23-8)", alignItems: "flex-start" }}>
        {/* Rail with nodes */}
        <div style={{ flex: 1, position: "relative" }}>
          {/* Horizontal track line */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              right: 10,
              height: 1,
              background: "var(--pv23-border-strong)",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
            {stages.map((stageName, i) => {
              const isActive = i === currentStageIndex;
              const isCompleted = i < currentStageIndex;
              const isFuture = i > currentStageIndex;
              const nodeSize = isActive ? 24 : 20;
              const showGate = i === HUMAN_GATE_AFTER + 1;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    position: "relative",
                    flex: 1,
                  }}
                >
                  {showGate && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: -4,
                          top: -4,
                          width: 2,
                          height: nodeSize + 8,
                          background: "var(--pv23-gate)",
                          zIndex: 2,
                        }}
                      />
                      <div style={{ position: "absolute", left: -40, top: nodeSize + 10, whiteSpace: "nowrap" }}>
                        <PresentationMeta color="var(--pv23-gate)">Human gate</PresentationMeta>
                      </div>
                    </>
                  )}

                  <div
                    style={{
                      width: nodeSize,
                      height: nodeSize,
                      background: isActive
                        ? "var(--pv23-brand-purple)"
                        : isCompleted
                        ? "var(--pv23-neutral-dark)"
                        : "transparent",
                      border: isFuture ? "1px solid var(--pv23-border)" : "none",
                      flexShrink: 0,
                    }}
                  />

                  <PresentationMeta
                    color={
                      isActive
                        ? "var(--pv23-brand-purple)"
                        : isCompleted
                        ? "var(--pv23-text)"
                        : "var(--pv23-text-secondary)"
                    }
                    style={{ textAlign: "center", maxWidth: 80 }}
                  >
                    {stageName}
                  </PresentationMeta>
                </div>
              );
            })}
          </div>
        </div>

        {/* Product proof thumbnail */}
        <div style={{ flexShrink: 0 }}>
          <ProductProofFrame
            id={assetId}
            exportMode={exportMode}
            style={{ width: 240, height: 160, borderRadius: "var(--pv23-radius-product)" }}
          />
        </div>
      </div>
    </div>
  );
}

export function ProcessRailSlide({ slide, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const processRows = slide.processRows;

  const rcsaRow = processRows?.[0];
  const tprmRow = processRows?.[1];

  const rcsaStages = (rcsaRow?.stages?.length ? rcsaRow.stages : RCSA_STAGES_DEFAULT) as readonly string[];
  const tprmStages = (tprmRow?.stages?.length ? tprmRow.stages : TPRM_STAGES_DEFAULT) as readonly string[];

  const rcsaCurrentIndex = rcsaRow?.currentStageIndex ?? 1;
  const tprmCurrentIndex = tprmRow?.currentStageIndex ?? 3;
  const rcsaLabel = rcsaRow?.label ?? "RCSA Cycle Assistant";
  const tprmLabel = tprmRow?.label ?? "Third-Party Onboarding";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv23-canvas)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "var(--pv23-12)",
        padding: "60px 80px",
      }}
    >
      {skipAnim ? (
        <>
          <ProcessRail
            label={rcsaLabel}
            stages={rcsaStages}
            currentStageIndex={rcsaCurrentIndex}
            assetId="rcsa-process-stage"
            exportMode={exportMode}
          />
          <div style={{ height: 1, background: "var(--pv23-border)" }} />
          <ProcessRail
            label={tprmLabel}
            stages={tprmStages}
            currentStageIndex={tprmCurrentIndex}
            assetId="tprm-process-stage"
            exportMode={exportMode}
          />
        </>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0, 0, 0.2, 1] }}
          >
            <ProcessRail
              label={rcsaLabel}
              stages={rcsaStages}
              currentStageIndex={rcsaCurrentIndex}
              assetId="rcsa-process-stage"
              exportMode={exportMode}
            />
          </motion.div>
          <div style={{ height: 1, background: "var(--pv23-border)" }} />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0, 0, 0.2, 1], delay: 0.2 }}
          >
            <ProcessRail
              label={tprmLabel}
              stages={tprmStages}
              currentStageIndex={tprmCurrentIndex}
              assetId="tprm-process-stage"
              exportMode={exportMode}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}
