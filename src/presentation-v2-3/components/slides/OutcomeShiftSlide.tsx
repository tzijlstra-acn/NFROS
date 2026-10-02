"use client";

import type { CoreSlide23 } from "../../data/types";
import type { Outcome } from "../../data/types";
import {
  PresentationTitle,
  PresentationSubtitle,
  PresentationLabel,
  PresentationMeta,
} from "../../typography";
import "./slides-8-13.css";

// ---------------------------------------------------------------------------
// Fallback outcome data (used if slide.outcomes is missing)
// ---------------------------------------------------------------------------

const FALLBACK_OUTCOMES: Outcome[] = [
  { title: "Assembly", support: "Coordination", semanticType: "capacity" },
  { title: "Coordination", support: "Judgment", semanticType: "quality" },
  { title: "Waiting", support: "Continuous process", semanticType: "continuity" },
  { title: "Reconstruction", support: "Traceability", semanticType: "control" },
];

// ---------------------------------------------------------------------------
// Before / after label mapping
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OutcomeRow({ outcome, index }: { outcome: Outcome; index: number }) {
  const beforeLabel = BEFORE_LABELS[index] ?? outcome.support;
  const afterLabel = AFTER_LABELS[index] ?? outcome.title;

  return (
    <div className="os-row">
      {/* Before band */}
      <div className="os-band os-band--before">
        <PresentationLabel
          as="span"
          color="var(--pv23-text-secondary)"
        >
          {beforeLabel}
        </PresentationLabel>
        <PresentationMeta
          as="span"
          color="var(--pv23-text-secondary)"
          style={{ marginTop: "var(--pv23-1)" }}
        >
          Before
        </PresentationMeta>
      </div>

      {/* Arrow */}
      <div className="os-band os-band--arrow" aria-hidden="true">
        {"→"}
      </div>

      {/* After band */}
      <div className="os-band os-band--after">
        <PresentationLabel
          as="span"
          color="var(--pv23-brand-purple-dark)"
        >
          {afterLabel}
        </PresentationLabel>
        <PresentationMeta
          as="span"
          color="var(--pv23-brand-purple-dark)"
          style={{ marginTop: "var(--pv23-1)" }}
        >
          {outcome.title}
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

export function OutcomeShiftSlide({ slide, exportMode: _exportMode }: Props) {
  const outcomes = slide.outcomes && slide.outcomes.length > 0
    ? slide.outcomes
    : FALLBACK_OUTCOMES;

  return (
    <div className="os-slide">
      {/* Header */}
      <div className="os-header">
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

      {/* Outcome rows */}
      <div className="os-rows">
        {outcomes.slice(0, 4).map((outcome, i) => (
          <OutcomeRow key={i} outcome={outcome} index={i} />
        ))}
      </div>
    </div>
  );
}
