"use client";

import type { CoreSlide23 } from "../../data/types";
import type { RolloutStep } from "../../data/types";
import {
  PresentationTitle,
  PresentationSubtitle,
  PresentationLabel,
  PresentationMeta,
} from "../../typography";
import "./slides-8-13.css";

// ---------------------------------------------------------------------------
// Footprint widths per step (percentage of bar)
// ---------------------------------------------------------------------------

const STEP_WIDTHS: Record<number, string> = {
  1: "20%",
  2: "50%",
  3: "80%",
};

// ---------------------------------------------------------------------------
// Fallback steps
// ---------------------------------------------------------------------------

const FALLBACK_STEPS: RolloutStep[] = [
  {
    number: 1,
    title: "Connect and baseline",
    actions: ["Infrastructure connected"],
    exitProof: "Infrastructure connected",
  },
  {
    number: 2,
    title: "Prove two Role Operating Systems",
    actions: ["First decisions evidenced"],
    exitProof: "First decisions evidenced",
  },
  {
    number: 3,
    title: "Scale by Role App",
    actions: ["Each Role App adds a process"],
    exitProof: "Each Role App adds a process",
  },
];

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function StepRow({ step }: { step: RolloutStep }) {
  const barWidth = STEP_WIDTHS[step.number] ?? "40%";

  return (
    <div className="rp-step">
      {/* Number badge */}
      <div className="rp-step-badge">
        <span
          style={{
            color: "#FFFFFF",
            fontFamily: "var(--pv23-font-mono)",
            fontSize: "var(--pv23-t-core-meta)",
            lineHeight: "var(--pv23-t-core-meta-lh)",
            fontWeight: "var(--pv23-fw-bold)",
          }}
        >
          {step.number}
        </span>
      </div>

      {/* Step content */}
      <div className="rp-step-content">
        <PresentationLabel as="span" color="var(--pv23-text)">
          {step.title}
        </PresentationLabel>

        {/* Footprint bar */}
        <div className="rp-step-bar-wrap" role="img" aria-label={`Platform footprint: ${barWidth}`}>
          <div
            className="rp-step-bar-fill"
            style={{ width: barWidth }}
            aria-hidden="true"
          />
        </div>

        {/* Exit proof */}
        <PresentationMeta as="span" color="var(--pv23-text-secondary)">
          Exit proof: {step.exitProof}
        </PresentationMeta>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

export function RolloutPathSlide({ slide, exportMode: _exportMode }: Props) {
  const steps =
    slide.rolloutSteps && slide.rolloutSteps.length > 0
      ? slide.rolloutSteps
      : FALLBACK_STEPS;

  return (
    <div className="rp-slide">
      {/* Header */}
      <div className="rp-header">
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

      {/* Human control line */}
      <div className="rp-control-line-wrap">
        <div className="rp-control-line" aria-hidden="true" />
        <div className="rp-control-label">
          <PresentationMeta as="span" color="var(--pv23-gate)">
            Human control stays fixed
          </PresentationMeta>
        </div>
      </div>

      {/* Steps */}
      <div className="rp-steps">
        {steps.map((step) => (
          <StepRow key={step.number} step={step} />
        ))}
      </div>
    </div>
  );
}
