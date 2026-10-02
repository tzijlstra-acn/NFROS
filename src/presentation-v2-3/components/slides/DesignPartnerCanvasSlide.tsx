"use client";

import { motion } from "motion/react";
import type { CoreSlide23 } from "../../data/types";
import {
  PresentationTitle,
  PresentationSubtitle,
  PresentationLabel,
  PresentationMeta,
  PresentationStatement,
} from "../../typography";
import "./slides-8-13.css";

// ---------------------------------------------------------------------------
// Fallback input labels
// ---------------------------------------------------------------------------

const FALLBACK_INPUTS: string[] = [
  "Business area",
  "Role owners",
  "RCSA journey",
  "TPRM journey",
  "Success and stop criteria",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InputNode({
  label,
  index,
  exportMode,
}: {
  label: string;
  index: number;
  exportMode?: boolean;
}) {
  return (
    <motion.div
      className="dp-input-node"
      initial={exportMode ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: exportMode ? 0 : 0.1 + index * 0.12,
        duration: 0.35,
        ease: [0, 0, 0.2, 1],
      }}
    >
      <div className="dp-input-box">
        <PresentationMeta as="span" color="var(--pv23-text)">
          {label}
        </PresentationMeta>
      </div>
      <div className="dp-connector-line" aria-hidden="true" />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

export function DesignPartnerCanvasSlide({ slide, exportMode }: Props) {
  const inputLabels =
    slide.nextStepBullets && slide.nextStepBullets.length >= 3
      ? [
          "Business area",
          "Role owners",
          "RCSA journey",
          "TPRM journey",
          "Success and stop criteria",
        ]
      : FALLBACK_INPUTS;

  return (
    <div className="dp-slide">
      {/* Header */}
      <div className="dp-header">
        <PresentationTitle as="h2">{slide.title}</PresentationTitle>
        {slide.subtitle != null && (
          <PresentationSubtitle
            as="p"
            color="var(--pv23-text-secondary)"
            style={{ marginTop: "var(--pv23-3)" }}
          >
            {slide.subtitle}
          </PresentationSubtitle>
        )}
      </div>

      {/* Canvas: inputs -> centre -> output */}
      <div className="dp-canvas">
        {/* Input nodes (left arc) */}
        <div className="dp-inputs">
          {inputLabels.map((label, i) => (
            <InputNode
              key={i}
              label={label}
              index={i}
              exportMode={exportMode}
            />
          ))}
        </div>

        {/* Centre node */}
        <motion.div
          className="dp-center-node"
          initial={exportMode ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: exportMode ? 0 : 0.75,
            duration: 0.4,
            ease: [0, 0, 0.2, 1],
          }}
        >
          <PresentationLabel as="span" color="var(--pv23-brand-purple)" style={{ textAlign: "center" }}>
            Design-partner case
          </PresentationLabel>
        </motion.div>

        {/* Output arrow */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 0 }}
          aria-hidden="true"
        >
          <div className="dp-output-line" />
          <span
            style={{
              color: "var(--pv23-brand-purple)",
              fontFamily: "var(--pv23-font-mono)",
              fontSize: "var(--pv23-t-core-label)",
              lineHeight: "1",
            }}
          >
            {"▶"}
          </span>
        </div>

        {/* Output node */}
        <motion.div
          className="dp-output-node"
          initial={exportMode ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: exportMode ? 0 : 1.1,
            duration: 0.4,
            ease: [0, 0, 0.2, 1],
          }}
        >
          <PresentationLabel
            as="span"
            color="var(--pv23-brand-purple-dark)"
            style={{ textAlign: "center" }}
          >
            Configured pilot and evidence-based decision
          </PresentationLabel>
        </motion.div>
      </div>

      {/* Footer statements */}
      <div className="dp-footer">
        <PresentationStatement color="var(--pv23-text)">
          Which working day should we prove first?
        </PresentationStatement>
        <PresentationMeta as="p" color="var(--pv23-text-secondary)">
          Synthetic institution and data
        </PresentationMeta>
      </div>
    </div>
  );
}
