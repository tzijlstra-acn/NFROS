"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ValueTreeData, ValueBranch } from "../data/types";

export type ValueTreeExhibitProps = {
  data: ValueTreeData;
  exportMode?: boolean;
};

const CSS = {
  root: {
    position: "absolute" as const,
    inset: 0,
    background: "var(--pv24-canvas)",
    fontFamily: "var(--pv24-font-family)",
    overflow: "hidden",
  } as React.CSSProperties,
  centreNode: {
    position: "absolute" as const,
    left: 760,
    top: 380,
    width: 400,
    height: 120,
    background: "var(--pv24-surface)",
    border: "2px solid var(--pv24-accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 24px",
  } as React.CSSProperties,
  centreLabel: {
    color: "var(--pv24-text)",
    fontWeight: 700,
    fontSize: "var(--pv24-fs-body, 22px)",
    textAlign: "center" as const,
  } as React.CSSProperties,
  branchNode: {
    position: "absolute" as const,
    width: 220,
    background: "var(--pv24-surface)",
    border: "2px solid var(--pv24-accent)",
    padding: "14px 16px",
  } as React.CSSProperties,
  branchLabel: {
    fontWeight: 700,
    fontSize: "var(--pv24-fs-label, 16px)",
    color: "var(--pv24-text)",
    marginBottom: 8,
  } as React.CSSProperties,
  bulletRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  } as React.CSSProperties,
  bulletSquare: {
    width: 7,
    height: 7,
    background: "var(--pv24-accent)",
    flexShrink: 0,
    marginTop: 5,
  } as React.CSSProperties,
  bulletText: {
    fontSize: "var(--pv24-fs-small, 13px)",
    color: "var(--pv24-text-secondary)",
    lineHeight: 1.4,
  } as React.CSSProperties,
  metricText: {
    fontFamily: "var(--pv24-font-mono)",
    fontSize: "var(--pv24-fs-mono, 11px)",
    color: "var(--pv24-accent)",
    marginTop: 10,
    borderTop: "1px solid var(--pv24-border)",
    paddingTop: 8,
  } as React.CSSProperties,
  railContainer: {
    position: "absolute" as const,
    left: 120,
    top: 850,
    width: 1680,
    height: 100,
  } as React.CSSProperties,
  railLabel: {
    fontSize: "var(--pv24-fs-small, 13px)",
    color: "var(--pv24-text-secondary)",
    fontWeight: 600,
    textAlign: "center" as const,
  } as React.CSSProperties,
  railSquare: {
    width: 12,
    height: 12,
    background: "var(--pv24-accent)",
    margin: "0 auto 4px",
  } as React.CSSProperties,
  chartNote: {
    position: "absolute" as const,
    left: 120,
    top: 970,
    fontFamily: "var(--pv24-font-mono)",
    fontSize: "var(--pv24-fs-mono, 11px)",
    color: "var(--pv24-text-secondary)",
  } as React.CSSProperties,
};

// Branch positions: [nodeX, nodeY, anchorX (center of node), anchorY (center of node)]
const BRANCH_POSITIONS: Array<{ x: number; y: number; label: string }> = [
  { x: 130, y: 200, label: "top-left" },
  { x: 1570, y: 200, label: "top-right" },
  { x: 130, y: 560, label: "bottom-left" },
  { x: 1570, y: 560, label: "bottom-right" },
];

// Centre node anchor points for SVG lines
const CENTRE = { x: 960, y: 440 }; // center of centre node (760+400/2, 380+120/2)

function BranchNode({
  branch,
  posIndex,
  skip,
  delay,
}: {
  branch: ValueBranch;
  posIndex: number;
  skip: boolean;
  delay: number;
}) {
  const pos = BRANCH_POSITIONS[posIndex];
  if (!pos) return null;

  return (
    <motion.div
      style={{ ...CSS.branchNode, left: pos.x, top: pos.y }}
      initial={skip ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={skip ? undefined : { duration: 0.35, delay }}
    >
      <div style={CSS.branchLabel}>{branch.label}</div>
      {branch.items.map((item, i) => (
        <motion.div
          key={i}
          style={CSS.bulletRow}
          initial={skip ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={skip ? undefined : { duration: 0.25, delay: delay + 0.1 + i * 0.07 }}
        >
          <div style={CSS.bulletSquare} />
          <span style={CSS.bulletText}>{item}</span>
        </motion.div>
      ))}
      <div style={CSS.metricText}>Metric: {branch.metricExample}</div>
    </motion.div>
  );
}

function ConnectingLines({
  skip,
  delay,
}: {
  skip: boolean;
  delay: number;
}) {
  // Lines from centre to each branch node centre
  const nodeCentres = BRANCH_POSITIONS.map((p) => ({ x: p.x + 110, y: p.y + 60 }));

  return (
    <svg
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {nodeCentres.map((nc, i) => {
        const lineLen = Math.hypot(nc.x - CENTRE.x, nc.y - CENTRE.y);
        return (
          <motion.line
            key={i}
            x1={CENTRE.x}
            y1={CENTRE.y}
            x2={nc.x}
            y2={nc.y}
            stroke="var(--pv24-accent)"
            strokeWidth={1.5}
            strokeOpacity={0.5}
            strokeDasharray={lineLen}
            initial={skip ? false : { strokeDashoffset: lineLen }}
            animate={{ strokeDashoffset: 0 }}
            transition={skip ? undefined : { duration: 0.5, delay: delay + i * 0.1 }}
          />
        );
      })}
    </svg>
  );
}

function MeasurementRail({
  nodes,
  skip,
  delay,
}: {
  nodes: string[];
  skip: boolean;
  delay: number;
}) {
  const count = nodes.length;
  const railWidth = 1680;
  const nodePositions = nodes.map((_, i) =>
    count <= 1 ? railWidth / 2 : (i / (count - 1)) * railWidth
  );

  return (
    <motion.div
      style={CSS.railContainer}
      initial={skip ? false : { clipPath: "inset(0 100% 0 0)" }}
      animate={{ clipPath: "inset(0 0% 0 0)" }}
      transition={skip ? undefined : { duration: 0.6, delay, ease: "easeInOut" }}
    >
      <svg
        aria-hidden="true"
        style={{ position: "absolute", top: 30, left: 0, width: "100%", height: 4 }}
      >
        {/* Solid baseline to full */}
        <line x1={0} y1={2} x2={railWidth} y2={2} stroke="var(--pv24-border-strong)" strokeWidth={2} />
        {/* Dashed segment: first to second node */}
        {count >= 2 && (
          <line
            x1={nodePositions[0] ?? 0}
            y1={2}
            x2={nodePositions[1] ?? 0}
            y2={2}
            stroke="var(--pv24-accent)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
        {/* Solid segment: second to third */}
        {count >= 3 && (
          <line
            x1={nodePositions[1] ?? 0}
            y1={2}
            x2={nodePositions[2] ?? 0}
            y2={2}
            stroke="var(--pv24-accent)"
            strokeWidth={2}
          />
        )}
      </svg>
      {nodes.map((label, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: nodePositions[i] ?? 0,
            top: 0,
            transform: "translateX(-50%)",
            textAlign: "center",
            width: 140,
          }}
        >
          <div style={CSS.railSquare} />
          <div style={CSS.railLabel}>{label}</div>
        </div>
      ))}
    </motion.div>
  );
}

export function ValueTreeExhibit({ data, exportMode }: ValueTreeExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  return (
    <div style={CSS.root}>
      {/* SVG connecting lines */}
      <ConnectingLines skip={skip} delay={0.4} />

      {/* Centre node */}
      <motion.div
        style={CSS.centreNode}
        initial={skip ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={skip ? undefined : { duration: 0.4, delay: 0.1 }}
      >
        <span style={CSS.centreLabel}>{data.centreLabel}</span>
      </motion.div>

      {/* Branch nodes */}
      {data.branches.slice(0, 4).map((branch, i) => (
        <BranchNode
          key={i}
          branch={branch}
          posIndex={i}
          skip={skip}
          delay={0.9 + i * 0.12}
        />
      ))}

      {/* Measurement rail */}
      {data.measurementRail.length > 0 && (
        <MeasurementRail nodes={data.measurementRail} skip={skip} delay={1.5} />
      )}

      {/* Chart note */}
      {data.chartNote != null && (
        <motion.div
          style={CSS.chartNote}
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skip ? undefined : { duration: 0.3, delay: 2.0 }}
        >
          {data.chartNote}
        </motion.div>
      )}
    </div>
  );
}
