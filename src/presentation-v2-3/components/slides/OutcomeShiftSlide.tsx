"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CoreSlide23 } from "../../data/types";
import type { Outcome } from "../../data/types";
import { PresentationTitle, PresentationSubtitle, PresentationLabel, PresentationMeta } from "../../typography";

const FALLBACK_OUTCOMES: Outcome[] = [
  { title: "Assembly", support: "Preparation", semanticType: "capacity" },
  { title: "Coordination", support: "Judgment", semanticType: "quality" },
  { title: "Waiting", support: "Continuous process", semanticType: "continuity" },
  { title: "Reconstruction", support: "Traceability", semanticType: "control" },
];

const BEFORE_LABELS: Record<number, string> = {
  0: "Assembly",
  1: "Coordination",
  2: "Waiting",
  3: "Reconstruction",
};

const AFTER_LABELS: Record<number, string> = {
  0: "Preparation",
  1: "Judgment",
  2: "Continuous process",
  3: "Traceability",
};

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

function OutcomeRow({
  outcome,
  index,
  skip,
}: {
  outcome: Outcome;
  index: number;
  skip: boolean;
}) {
  const beforeLabel = BEFORE_LABELS[index] ?? outcome.title;
  const afterLabel = AFTER_LABELS[index] ?? outcome.support;
  const delay = 0.3 + index * 0.18;

  const inner = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 64px 1fr",
        alignItems: "center",
        gap: 0,
        minHeight: 100,
      }}
    >
      {/* Before */}
      <div
        style={{
          padding: "24px 32px",
          background: "var(--pv23-surface)",
          border: "1px solid var(--pv23-border)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <PresentationMeta color="var(--pv23-text-secondary)" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Before
        </PresentationMeta>
        <PresentationLabel color="var(--pv23-text)">{beforeLabel}</PresentationLabel>
      </div>

      {/* Arrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--pv23-canvas)",
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 40 24" width={40} height={24} fill="none">
          <path d="M0 12 H32 M24 4 L32 12 L24 20" stroke="var(--pv23-brand-purple)" strokeWidth={2.5} strokeLinecap="square" />
        </svg>
      </div>

      {/* After */}
      <div
        style={{
          padding: "24px 32px",
          background: "var(--pv23-brand-purple-lightest)",
          border: "1px solid var(--pv23-brand-purple-light)",
          borderLeft: "4px solid var(--pv23-brand-purple)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <PresentationMeta color="var(--pv23-brand-purple)" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
          With NFR OS
        </PresentationMeta>
        <PresentationLabel color="var(--pv23-brand-purple-dark)">{afterLabel}</PresentationLabel>
      </div>
    </div>
  );

  if (skip) {
    return <div>{inner}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: [0, 0, 0.2, 1], delay }}
    >
      {inner}
    </motion.div>
  );
}

export function OutcomeShiftSlide({ slide, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const outcomes = slide.outcomes && slide.outcomes.length > 0
    ? slide.outcomes
    : FALLBACK_OUTCOMES;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv23-canvas)",
        display: "flex",
        flexDirection: "column",
        padding: "80px 120px",
        gap: 48,
      }}
    >
      {/* Header */}
      <div>
        {skipAnim ? (
          <>
            <PresentationTitle as="h2" color="var(--pv23-text)">{slide.title}</PresentationTitle>
            {slide.subtitle && (
              <PresentationSubtitle as="p" color="var(--pv23-text-secondary)" style={{ marginTop: 12 }}>
                {slide.subtitle}
              </PresentationSubtitle>
            )}
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}>
            <PresentationTitle as="h2" color="var(--pv23-text)">{slide.title}</PresentationTitle>
            {slide.subtitle && (
              <PresentationSubtitle as="p" color="var(--pv23-text-secondary)" style={{ marginTop: 12 }}>
                {slide.subtitle}
              </PresentationSubtitle>
            )}
          </motion.div>
        )}
      </div>

      {/* Outcome rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        {outcomes.slice(0, 4).map((outcome, i) => (
          <OutcomeRow key={i} outcome={outcome} index={i} skip={skipAnim} />
        ))}
      </div>
    </div>
  );
}
