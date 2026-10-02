"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { EvidenceThreadData, EvidenceThreadStep } from "../data/types";

export type EvidenceThreadExhibitProps = {
  data: EvidenceThreadData;
  exportMode?: boolean;
};

const THREAD_Y = 400;
const LABEL_Y = 460;
const PROOF_Y = 540;
const ANNOTATION_Y = 340;
const NODE_SIZE = 40;

const CSS = {
  root: {
    position: "absolute" as const,
    inset: 0,
    background: "var(--pv24-canvas)",
    fontFamily: "var(--pv24-font-family)",
    overflow: "hidden",
  } as React.CSSProperties,
  proofPanel: {
    position: "absolute" as const,
    width: 220,
    height: 240,
    background: "var(--pv24-surface)",
    borderTop: "4px solid var(--pv24-accent)",
    padding: "12px 14px",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  proofLabel: {
    fontFamily: "var(--pv24-font-mono)",
    fontSize: "var(--pv24-fs-mono, 11px)",
    color: "var(--pv24-accent)",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,
  proofAsset: {
    fontFamily: "var(--pv24-font-mono)",
    fontSize: "var(--pv24-fs-mono, 11px)",
    color: "var(--pv24-text-secondary)",
  } as React.CSSProperties,
  stepLabel: {
    position: "absolute" as const,
    width: 120,
    textAlign: "center" as const,
    fontSize: "var(--pv24-fs-small, 13px)",
    color: "var(--pv24-text)",
    fontWeight: 500,
    lineHeight: 1.3,
  } as React.CSSProperties,
  annotationRow: {
    position: "absolute" as const,
    display: "flex",
    alignItems: "center",
    gap: 6,
  } as React.CSSProperties,
  annotationSquare: {
    width: 7,
    height: 7,
    background: "var(--pv24-accent)",
    flexShrink: 0,
  } as React.CSSProperties,
  annotationText: {
    fontSize: "var(--pv24-fs-small, 13px)",
    color: "var(--pv24-text-secondary)",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
};

function nodeX(index: number, total: number): number {
  const minX = 120;
  const maxX = 1800;
  if (total <= 1) return (minX + maxX) / 2;
  return minX + (index / (total - 1)) * (maxX - minX);
}

function StepNode({
  step,
  index,
  total,
  skip,
  delay,
}: {
  step: EvidenceThreadStep;
  index: number;
  total: number;
  skip: boolean;
  delay: number;
}) {
  const cx = nodeX(index, total);
  const hasProof = step.hasProductProof === true;

  return (
    <>
      {/* Step node */}
      <motion.div
        style={{
          position: "absolute",
          left: cx - NODE_SIZE / 2,
          top: THREAD_Y - NODE_SIZE / 2,
          width: NODE_SIZE,
          height: NODE_SIZE,
          background: "var(--pv24-surface)",
          border: hasProof ? "3px solid var(--pv24-accent)" : "2px solid var(--pv24-border-strong)",
          boxSizing: "border-box",
        }}
        initial={skip ? false : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={skip ? undefined : { duration: 0.3, delay }}
      />

      {/* Label */}
      <motion.div
        style={{
          ...CSS.stepLabel,
          left: cx - 60,
          top: LABEL_Y,
        }}
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.25, delay: delay + 0.15 }}
      >
        {step.label}
      </motion.div>

      {/* Product proof panel */}
      {hasProof && (
        <motion.div
          style={{
            ...CSS.proofPanel,
            left: cx - 110,
            top: PROOF_Y,
          }}
          initial={skip ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={skip ? undefined : { duration: 0.35, delay: delay + 0.3 }}
        >
          <div style={CSS.proofLabel}>Product capture</div>
          {step.assetId != null && (
            <div style={CSS.proofAsset}>{step.assetId}</div>
          )}
        </motion.div>
      )}
    </>
  );
}

export function EvidenceThreadExhibit({ data, exportMode }: EvidenceThreadExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  const { steps, proofAnnotations } = data;
  const total = steps.length;
  const firstX = nodeX(0, total);
  const lastX = nodeX(total - 1, total);
  const threadLen = lastX - firstX;

  return (
    <div style={CSS.root}>
      {/* Thread line */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <motion.line
          x1={firstX}
          y1={THREAD_Y + 20}
          x2={lastX}
          y2={THREAD_Y + 20}
          stroke="var(--pv24-border-strong)"
          strokeWidth={2}
          strokeDasharray={threadLen}
          initial={skip ? false : { strokeDashoffset: threadLen }}
          animate={{ strokeDashoffset: 0 }}
          transition={skip ? undefined : { duration: 0.7, delay: 0.1, ease: "easeInOut" }}
        />
      </svg>

      {/* Step nodes */}
      {steps.map((step, i) => (
        <StepNode
          key={i}
          step={step}
          index={i}
          total={total}
          skip={skip}
          delay={0.5 + i * 0.1}
        />
      ))}

      {/* Proof annotations */}
      {proofAnnotations.map((ann, i) => {
        const cx = nodeX(ann.stepIndex, total);
        return (
          <motion.div
            key={i}
            style={{
              ...CSS.annotationRow,
              left: cx - 80,
              top: ANNOTATION_Y,
            }}
            initial={skip ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={skip ? undefined : { duration: 0.25, delay: 1.2 + i * 0.1 }}
          >
            <div style={CSS.annotationSquare} />
            <span style={CSS.annotationText}>{ann.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
