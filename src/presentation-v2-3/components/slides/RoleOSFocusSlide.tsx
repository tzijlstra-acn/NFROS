"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import { ProductProofFrame } from "../../product-proof/ProductProofFrame";
import { PresentationStatement, PresentationLabel } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
  focusStep?: number;
};

const RCSA_FOCUS_REGIONS = [
  { step: 1, label: "What needs you",          region: { x: 40, y: 100, w: 420, h: 280 } },
  { step: 2, label: "What is prepared",        region: { x: 40, y: 400, w: 420, h: 200 } },
  { step: 3, label: "What is already handled", region: { x: 40, y: 640, w: 420, h: 200 } },
] as const;

const CALLOUTS: Record<number, string> = {
  1: "What needs you",
  2: "What is prepared",
  3: "What is already handled",
};

export function RoleOSFocusSlide({ slide, exportMode = false, focusStep = 1 }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const activeStep = exportMode ? 3 : focusStep;
  const focusDef = RCSA_FOCUS_REGIONS.find((r) => r.step === activeStep) ?? RCSA_FOCUS_REGIONS[0];
  const calloutText = CALLOUTS[activeStep] ?? CALLOUTS[1];

  const slideFocusRegion = slide.focusRegions?.find((r) => r.step === activeStep);
  const focusRegion = slideFocusRegion
    ? { label: slideFocusRegion.label, ...slideFocusRegion.region }
    : { label: focusDef.label, ...focusDef.region };

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
      {/* Left: Product proof frame 65% */}
      <div
        style={{
          width: "65%",
          padding: "60px 0 60px 80px",
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <ProductProofFrame
          id="rcsa-home"
          focusRegion={focusRegion}
          exportMode={exportMode}
          style={{ flex: 1, borderRadius: "var(--pv23-radius-product)" }}
        />
      </div>

      {/* Right: Callout text 35% */}
      <div
        style={{
          width: "35%",
          padding: "0 80px 0 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "var(--pv23-6)",
        }}
      >
        <PresentationLabel color="var(--pv23-text-secondary)">
          Focus {activeStep} of 3
        </PresentationLabel>

        {skipAnim ? (
          <PresentationStatement color="var(--pv23-text)">
            {calloutText}
          </PresentationStatement>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
            >
              <PresentationStatement color="var(--pv23-text)">
                {calloutText}
              </PresentationStatement>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Step indicators */}
        <div style={{ display: "flex", gap: "var(--pv23-2)", marginTop: "var(--pv23-4)" }}>
          {RCSA_FOCUS_REGIONS.map((r) => (
            <div
              key={r.step}
              style={{
                width: 8,
                height: 8,
                background:
                  r.step === activeStep
                    ? "var(--pv23-brand-purple)"
                    : "var(--pv23-border-strong)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
