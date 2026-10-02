"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconClock, IconAward, IconShieldCheck, IconRefresh } from "@tabler/icons-react";
import type { ValueTreeData, ValueBranch } from "../data/types";

export type ValueTreeExhibitProps = {
  data: ValueTreeData;
  exportMode?: boolean;
};

// Drawn on the 1920 x 780 exhibit stage
const W = 1920;
const H = 780;
const CARD_W = 440;
const CARD_H = 262;
const CENTRE = { x: 960, y: 360 };
const CENTRE_R = 108;
const STEP = 0.9;

type Corner = {
  x: number;
  y: number;
  icon: typeof IconClock;
  kpiValue: number;
  kpiPrefix: string;
  kpiSuffix: string;
  kpiLabel: string;
  inner: { x: number; y: number };
};

// Clockwise flywheel: Capacity (TL), Quality (TR), Control (BR), Continuity (BL)
const CORNERS: Corner[] = [
  { x: 120, y: 16, icon: IconClock, kpiValue: 30, kpiPrefix: "", kpiSuffix: "%", kpiLabel: "less meeting preparation time", inner: { x: 560, y: 278 } },
  { x: 1360, y: 16, icon: IconAward, kpiValue: 85, kpiPrefix: "", kpiSuffix: "%", kpiLabel: "evidence complete at first review", inner: { x: 1360, y: 278 } },
  { x: 1360, y: 496, icon: IconShieldCheck, kpiValue: 100, kpiPrefix: "", kpiSuffix: "%", kpiLabel: "of executed actions carry a named approval", inner: { x: 1360, y: 496 } },
  { x: 120, y: 496, icon: IconRefresh, kpiValue: 0, kpiPrefix: "", kpiSuffix: " restarts", kpiLabel: "when work changes hands", inner: { x: 560, y: 496 } },
];

type Handover = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  head: "right" | "down" | "left" | "up";
  label: string;
  labelStyle: React.CSSProperties;
};

const HANDOVERS: Handover[] = [
  {
    from: { x: 580, y: 120 },
    to: { x: 1336, y: 120 },
    head: "right",
    label: "Freed time goes into better evidence",
    labelStyle: { left: 660, top: 72, width: 600, textAlign: "center" },
  },
  {
    from: { x: 1580, y: 298 },
    to: { x: 1580, y: 472 },
    head: "down",
    label: "Complete evidence makes approval defensible",
    labelStyle: { left: 1180, top: 352, width: 380, textAlign: "right" },
  },
  {
    from: { x: 1340, y: 640 },
    to: { x: 584, y: 640 },
    head: "left",
    label: "Recorded decisions carry forward",
    labelStyle: { left: 660, top: 592, width: 600, textAlign: "center" },
  },
  {
    from: { x: 340, y: 476 },
    to: { x: 340, y: 302 },
    head: "up",
    label: "Nothing restarts, so saved time compounds",
    labelStyle: { left: 360, top: 352, width: 380, textAlign: "left" },
  },
];

function arrowHead(p: { x: number; y: number }, dir: Handover["head"]): string {
  const s = 12;
  switch (dir) {
    case "right":
      return `${p.x},${p.y} ${p.x - s},${p.y - s * 0.7} ${p.x - s},${p.y + s * 0.7}`;
    case "left":
      return `${p.x},${p.y} ${p.x + s},${p.y - s * 0.7} ${p.x + s},${p.y + s * 0.7}`;
    case "down":
      return `${p.x},${p.y} ${p.x - s * 0.7},${p.y - s} ${p.x + s * 0.7},${p.y - s}`;
    case "up":
      return `${p.x},${p.y} ${p.x - s * 0.7},${p.y + s} ${p.x + s * 0.7},${p.y + s}`;
  }
}

function edgePoint(target: { x: number; y: number }): { x: number; y: number } {
  const dx = target.x - CENTRE.x;
  const dy = target.y - CENTRE.y;
  const len = Math.hypot(dx, dy);
  return { x: CENTRE.x + (dx / len) * (CENTRE_R + 10), y: CENTRE.y + (dy / len) * (CENTRE_R + 10) };
}

function CountUp({ to, prefix, suffix, skip, delay }: { to: number; prefix: string; suffix: string; skip: boolean; delay: number }) {
  const [value, setValue] = React.useState<number>(skip ? to : 0);

  React.useEffect(() => {
    if (skip || to === 0) {
      setValue(to);
      return;
    }
    let frame = 0;
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 800);
        setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay * 1000);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [to, skip, delay]);

  return (
    <>
      {prefix}
      {value}
      {suffix}
    </>
  );
}

function BranchCard({ branch, corner, skip, delay, pulseDelay }: { branch: ValueBranch; corner: Corner; skip: boolean; delay: number; pulseDelay: number | null }) {
  const Icon = corner.icon;
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={skip ? undefined : { duration: 0.4, delay, ease: "backOut" }}
      style={{
        position: "absolute",
        left: corner.x,
        top: corner.y,
        width: CARD_W,
        height: CARD_H,
        background: "var(--pv24-surface)",
        border: "2px solid var(--pv24-accent)",
        boxShadow: "0 8px 26px rgba(17, 18, 20, 0.08)",
        padding: "18px 22px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {pulseDelay !== null && !skip && (
        <motion.div
          aria-hidden="true"
          style={{ position: "absolute", inset: -8, border: "2px solid var(--pv24-accent)", pointerEvents: "none" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 1.2, delay: pulseDelay }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Icon size={30} color="var(--pv24-accent)" stroke={1.7} />
        <span style={{ fontSize: 26, fontWeight: 700, color: "var(--pv24-text)" }}>{branch.label}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 12 }}>
        {branch.items.map((item) => (
          <span key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, color: "var(--pv24-text-secondary)" }}>
            <span style={{ width: 7, height: 7, background: "var(--pv24-accent)", flexShrink: 0 }} />
            {item}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid var(--pv24-border)",
          display: "flex",
          alignItems: "baseline",
          gap: 14,
        }}
      >
        <span style={{ fontSize: 52, fontWeight: 700, color: "var(--pv24-accent)", lineHeight: 1, whiteSpace: "nowrap" }}>
          <CountUp to={corner.kpiValue} prefix={corner.kpiPrefix} suffix={corner.kpiSuffix} skip={skip} delay={delay + 0.3} />
        </span>
        <span style={{ fontSize: 16, color: "var(--pv24-text)", lineHeight: 1.3 }}>{corner.kpiLabel}</span>
      </div>
    </motion.div>
  );
}

export function ValueTreeExhibit({ data, exportMode }: ValueTreeExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  const branches = data.branches.slice(0, CORNERS.length);
  const cardDelay = (i: number) => 0.4 + i * STEP;
  const handoverDelay = (i: number) => cardDelay(i) + 0.45;
  const loopClosed = handoverDelay(branches.length - 1) + 0.5;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
      aria-label="Value tree exhibit"
    >
      <svg aria-hidden="true" width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {/* Spokes: every branch feeds the centre */}
        {CORNERS.slice(0, branches.length).map((corner, i) => {
          const end = edgePoint(corner.inner);
          return (
            <motion.line
              key={`spoke-${i}`}
              x1={corner.inner.x}
              y1={corner.inner.y}
              x2={end.x}
              y2={end.y}
              stroke="var(--pv24-brand-purple-light)"
              strokeWidth={2}
              strokeDasharray="5 6"
              initial={skip ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={skip ? undefined : { duration: 0.4, delay: loopClosed + i * 0.08 }}
            />
          );
        })}

        {/* Handovers between branches */}
        {HANDOVERS.slice(0, branches.length).map((h, i) => (
          <React.Fragment key={`handover-${i}`}>
            <motion.line
              x1={h.from.x}
              y1={h.from.y}
              x2={h.to.x}
              y2={h.to.y}
              stroke="var(--pv24-accent)"
              strokeWidth={4}
              initial={skip ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={skip ? undefined : { duration: 0.45, delay: handoverDelay(i), ease: "easeInOut" }}
            />
            <motion.polygon
              points={arrowHead(h.to, h.head)}
              fill="var(--pv24-accent)"
              initial={skip ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={skip ? undefined : { duration: 0.1, delay: handoverDelay(i) + 0.42 }}
            />
          </React.Fragment>
        ))}
      </svg>

      {/* Centre */}
      <motion.div
        initial={skip ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={skip ? undefined : { duration: 0.45, delay: 0.1, ease: "backOut" }}
        style={{
          position: "absolute",
          left: CENTRE.x - CENTRE_R,
          top: CENTRE.y - CENTRE_R,
          width: CENTRE_R * 2,
          height: CENTRE_R * 2,
          borderRadius: "50%",
          background: "var(--pv24-brand-purple)",
          boxShadow: "0 0 0 10px var(--pv24-accent-lightest)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 24,
          boxSizing: "border-box",
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {data.centreLabel}
      </motion.div>
      {!skip && (
        <motion.div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: CENTRE.x - CENTRE_R - 22,
            top: CENTRE.y - CENTRE_R - 22,
            width: (CENTRE_R + 22) * 2,
            height: (CENTRE_R + 22) * 2,
            borderRadius: "50%",
            border: "2px solid var(--pv24-accent)",
            pointerEvents: "none",
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 0.6, 0], scale: [0.9, 1.08, 1.15] }}
          transition={{ duration: 1.6, delay: loopClosed + 0.4, repeat: Infinity, repeatDelay: 1.4 }}
        />
      )}

      {/* Handover labels */}
      {HANDOVERS.slice(0, branches.length).map((h, i) => (
        <motion.div
          key={`label-${i}`}
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skip ? undefined : { duration: 0.3, delay: handoverDelay(i) + 0.25 }}
          style={{
            position: "absolute",
            ...h.labelStyle,
            fontSize: 19,
            fontWeight: 600,
            fontStyle: "italic",
            color: "var(--pv24-accent-dark)",
            lineHeight: 1.3,
          }}
        >
          {h.label}
        </motion.div>
      ))}

      {branches.map((branch, i) => {
        const corner = CORNERS[i];
        if (corner === undefined) return null;
        return (
          <BranchCard
            key={branch.label}
            branch={branch}
            corner={corner}
            skip={skip}
            delay={cardDelay(i)}
            pulseDelay={i === 0 ? loopClosed : null}
          />
        );
      })}

      {/* Measurement rail */}
      <motion.div
        initial={skip ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={skip ? undefined : { duration: 0.4, delay: loopClosed + 0.6 }}
        style={{
          position: "absolute",
          left: 620,
          top: 680,
          width: 680,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--pv24-text-secondary)" }}>
            Measured
          </span>
          {data.measurementRail.map((stage, i) => (
            <React.Fragment key={stage}>
              {i > 0 && <span style={{ width: 28, height: 2, background: "var(--pv24-border-strong)" }} />}
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "4px 12px",
                  background: i === data.measurementRail.length - 1 ? "var(--pv24-brand-purple-dark)" : "var(--pv24-surface)",
                  color: i === data.measurementRail.length - 1 ? "#FFFFFF" : "var(--pv24-text)",
                  border: "1px solid var(--pv24-border)",
                }}
              >
                {stage}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontSize: 13, fontStyle: "italic", color: "var(--pv24-text-secondary)", textAlign: "center" }}>
          {["Illustrative targets", data.chartNote, "Synthetic institution and data"].filter(Boolean).join(". ")}.
        </div>
      </motion.div>
    </div>
  );
}
