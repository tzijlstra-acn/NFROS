"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { DesignPartnerPathData, DesignPartnerStep } from "../data/types";

export type DesignPartnerPathExhibitProps = {
  data: DesignPartnerPathData;
  exportMode?: boolean;
};

const CARD_TOPS = [
  { x1: 80, x2: 580 },
  { x1: 680, x2: 1180 },
  { x1: 1280, x2: 1780 },
];

const CARD_Y1 = 80;
const CARD_Y2 = 620;
const CARD_HEIGHT = CARD_Y2 - CARD_Y1;
const GATE_Y1 = 640;
const GATE_Y2 = 760;
const CONTROL_LINE_Y = 810;
const CTA_Y = 880;
const ARROW_Y = 350;

const CSS = {
  root: {
    position: "absolute" as const,
    inset: 0,
    background: "var(--pv24-canvas)",
    fontFamily: "var(--pv24-font-family)",
    overflow: "hidden",
  } as React.CSSProperties,
  card: {
    position: "absolute" as const,
    top: CARD_Y1,
    height: CARD_HEIGHT,
    background: "var(--pv24-surface)",
    border: "1px solid var(--pv24-border)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  } as React.CSSProperties,
  cardAccentBar: {
    height: 8,
    background: "var(--pv24-accent)",
    flexShrink: 0,
  } as React.CSSProperties,
  cardBody: {
    padding: "20px 24px",
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
  } as React.CSSProperties,
  stepBadge: {
    fontFamily: "var(--pv24-font-mono)",
    fontSize: "var(--pv24-fs-badge, 48px)",
    color: "var(--pv24-accent)",
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: 8,
  } as React.CSSProperties,
  stepTitle: {
    fontWeight: 700,
    fontSize: "var(--pv24-fs-body, 18px)",
    color: "var(--pv24-text)",
    marginBottom: 16,
    lineHeight: 1.3,
  } as React.CSSProperties,
  inputRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  } as React.CSSProperties,
  inputBullet: {
    width: 7,
    height: 7,
    background: "var(--pv24-accent)",
    flexShrink: 0,
    marginTop: 5,
  } as React.CSSProperties,
  inputText: {
    fontSize: "var(--pv24-fs-small, 13px)",
    color: "var(--pv24-text-secondary)",
    lineHeight: 1.4,
  } as React.CSSProperties,
  gateContainer: {
    position: "absolute" as const,
    top: GATE_Y1,
    height: GATE_Y2 - GATE_Y1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  } as React.CSSProperties,
  gateQuestion: {
    fontFamily: "var(--pv24-font-mono)",
    fontSize: "var(--pv24-fs-mono, 11px)",
    color: "var(--pv24-text-secondary)",
    fontStyle: "italic",
    textAlign: "center" as const,
    maxWidth: 460,
    lineHeight: 1.4,
  } as React.CSSProperties,
  controlLineLabel: {
    position: "absolute" as const,
    left: 80,
    top: CONTROL_LINE_Y - 22,
    fontFamily: "var(--pv24-font-mono)",
    fontSize: "var(--pv24-fs-mono, 11px)",
    color: "var(--pv24-accent)",
  } as React.CSSProperties,
  ctaBand: {
    position: "absolute" as const,
    left: 320,
    right: 320,
    top: CTA_Y,
    height: 60,
    background: "var(--pv24-surface)",
    borderLeft: "4px solid var(--pv24-accent)",
    display: "flex",
    alignItems: "center",
    padding: "0 24px",
  } as React.CSSProperties,
  ctaText: {
    fontWeight: 700,
    fontSize: "var(--pv24-fs-body, 18px)",
    color: "var(--pv24-text)",
  } as React.CSSProperties,
};

function cardCentreX(cardIndex: number): number {
  const bounds = CARD_TOPS[cardIndex];
  if (bounds == null) return 0;
  return (bounds.x1 + bounds.x2) / 2;
}

function StepCard({
  step,
  cardIndex,
  skip,
  delay,
}: {
  step: DesignPartnerStep;
  cardIndex: number;
  skip: boolean;
  delay: number;
}) {
  const bounds = CARD_TOPS[cardIndex];
  if (bounds == null) return null;
  const width = bounds.x2 - bounds.x1;

  return (
    <motion.div
      style={{ ...CSS.card, left: bounds.x1, width }}
      initial={skip ? false : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skip ? undefined : { duration: 0.4, delay }}
    >
      <div style={CSS.cardAccentBar} />
      <div style={CSS.cardBody}>
        <div style={CSS.stepBadge}>{step.number < 10 ? `0${step.number}` : String(step.number)}</div>
        <div style={CSS.stepTitle}>{step.title}</div>
        {step.inputs.map((input, i) => (
          <div key={i} style={CSS.inputRow}>
            <div style={CSS.inputBullet} />
            <span style={CSS.inputText}>{input}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function GateCheckpoint({
  step,
  cardIndex,
  skip,
  delay,
}: {
  step: DesignPartnerStep;
  cardIndex: number;
  skip: boolean;
  delay: number;
}) {
  const cx = cardCentreX(cardIndex);
  const diamondSize = 20;

  return (
    <motion.div
      style={{ ...CSS.gateContainer, left: cx - 240, width: 480 }}
      initial={skip ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={skip ? undefined : { duration: 0.3, delay }}
    >
      <svg
        aria-hidden="true"
        width={diamondSize * 2}
        height={diamondSize * 2}
        viewBox={`0 0 ${diamondSize * 2} ${diamondSize * 2}`}
      >
        <polygon
          points={`${diamondSize},0 ${diamondSize * 2},${diamondSize} ${diamondSize},${diamondSize * 2} 0,${diamondSize}`}
          fill="none"
          stroke="var(--pv24-accent)"
          strokeWidth={2}
        />
      </svg>
      <div style={CSS.gateQuestion}>{step.gateQuestion}</div>
    </motion.div>
  );
}

function ArrowBetween({
  gapIndex,
  skip,
  delay,
}: {
  gapIndex: number;
  skip: boolean;
  delay: number;
}) {
  const leftBounds = CARD_TOPS[gapIndex];
  const rightBounds = CARD_TOPS[gapIndex + 1];
  if (leftBounds == null || rightBounds == null) return null;
  const arrowCx = (leftBounds.x2 + rightBounds.x1) / 2;

  return (
    <motion.div
      style={{
        position: "absolute",
        left: arrowCx - 20,
        top: ARROW_Y - 14,
        width: 40,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      initial={skip ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={skip ? undefined : { duration: 0.2, delay }}
    >
      <svg aria-hidden="true" width={32} height={20} viewBox="0 0 32 20">
        <polyline
          points="0,10 24,10 16,2 24,10 16,18"
          fill="none"
          stroke="var(--pv24-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

const CONTROL_LINE_LEN = 1780 - 80;

export function DesignPartnerPathExhibit({ data, exportMode }: DesignPartnerPathExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  const { steps, callToAction } = data;
  const cardSteps = steps.slice(0, 3);

  return (
    <div style={CSS.root}>
      {/* Step cards */}
      {cardSteps.map((step, i) => (
        <StepCard key={i} step={step} cardIndex={i} skip={skip} delay={0.1 + i * 0.2} />
      ))}

      {/* Arrows between cards */}
      {cardSteps.length > 1 && (
        <ArrowBetween gapIndex={0} skip={skip} delay={0.55} />
      )}
      {cardSteps.length > 2 && (
        <ArrowBetween gapIndex={1} skip={skip} delay={0.65} />
      )}

      {/* Gate checkpoints */}
      {cardSteps.map((step, i) => (
        <GateCheckpoint key={i} step={step} cardIndex={i} skip={skip} delay={0.75 + i * 0.1} />
      ))}

      {/* Control line label */}
      <div style={CSS.controlLineLabel}>Control gate at each step</div>

      {/* Control line SVG */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <motion.line
          x1={80}
          y1={CONTROL_LINE_Y}
          x2={1780}
          y2={CONTROL_LINE_Y}
          stroke="var(--pv24-accent)"
          strokeWidth={2}
          strokeDasharray={CONTROL_LINE_LEN}
          initial={skip ? false : { strokeDashoffset: CONTROL_LINE_LEN }}
          animate={{ strokeDashoffset: 0 }}
          transition={skip ? undefined : { duration: 0.6, delay: 1.1, ease: "easeInOut" }}
        />
      </svg>

      {/* Call to action */}
      <motion.div
        style={CSS.ctaBand}
        initial={skip ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={skip ? undefined : { duration: 0.4, delay: 1.5 }}
      >
        <span style={CSS.ctaText}>{callToAction}</span>
      </motion.div>
    </div>
  );
}
