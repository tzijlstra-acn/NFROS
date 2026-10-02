"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  IconMail,
  IconCalendar,
  IconFileText,
  IconShieldCheck,
  IconDatabase,
  IconChecklist,
  IconUser,
  IconArrowRight,
} from "@tabler/icons-react";
import type { CapacityConvergenceData } from "../data/types";

type Props = {
  data: CapacityConvergenceData;
  exportMode?: boolean;
};

const VW = 1920;
const VH = 1080;

// Signal column (HTML nodes, positioned as % of canvas)
const SIG_PX = 80;          // left edge px
const SIG_NODE_W = 180;
const SIG_NODE_H = 72;
const SIG_Y_CENTER_START = 220;
const SIG_Y_CENTER_END = 860;

// SVG coordinates
const SIG_RIGHT_X = SIG_PX + SIG_NODE_W;   // right edge of signal nodes

// Bottleneck
const BN_X = 560;
const BN_Y = 540;
const BN_R = 44;

// OS layer
const OS_X1 = 700;
const OS_X2 = 1100;
const OS_CY = 540;
const OS_H = 170;

// Decision node
const DEC_X = 1200;
const DEC_Y = 540;
const DEC_W = 200;
const DEC_H = 100;

// Judgment zone (right panel, HTML)
const JZ_LEFT_PX = 1380;
const JZ_RIGHT_PX = 1840;
const JZ_TOP_PX = 300;
const JZ_BOTTOM_PX = 780;

const SIG_COUNT = 6;

const SIGNAL_ICONS = [
  IconMail,
  IconCalendar,
  IconFileText,
  IconShieldCheck,
  IconDatabase,
  IconChecklist,
];

function sigCenterY(i: number): number {
  return SIG_Y_CENTER_START + i * ((SIG_Y_CENTER_END - SIG_Y_CENTER_START) / (SIG_COUNT - 1));
}

export function CapacityConvergenceExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const osY1 = OS_CY - OS_H / 2;
  const osCX = (OS_X1 + OS_X2) / 2;
  const jzCX = (JZ_LEFT_PX + JZ_RIGHT_PX) / 2;
  const jzCY = (JZ_TOP_PX + JZ_BOTTOM_PX) / 2;

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--pv24-canvas)", overflow: "hidden", fontFamily: "var(--pv24-font-family)" }}>

      {/* SVG layer: flow lines, bottleneck, OS band, decision box */}
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">

        {/* Flow lines: signal nodes → bottleneck */}
        {Array.from({ length: SIG_COUNT }, (_, i) => {
          const cy = sigCenterY(i);
          const x1 = SIG_RIGHT_X;
          const x2 = BN_X - BN_R;
          const len = Math.hypot(x2 - x1, BN_Y - cy);
          if (skip) {
            return <line key={i} x1={x1} y1={cy} x2={x2} y2={BN_Y} stroke="var(--pv24-border-strong)" strokeWidth={1.5} opacity={0.5} />;
          }
          return (
            <motion.line key={i} x1={x1} y1={cy} x2={x2} y2={BN_Y}
              stroke="var(--pv24-border-strong)" strokeWidth={1.5} opacity={0.5}
              strokeDasharray={len} strokeDashoffset={len}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }} />
          );
        })}

        {/* OS background band */}
        {skip ? (
          <rect x={OS_X1} y={osY1} width={OS_X2 - OS_X1} height={OS_H} fill="var(--pv24-brand-purple-lightest)" stroke="var(--pv24-brand-purple)" strokeWidth={2} />
        ) : (
          <motion.rect x={OS_X1} y={osY1} width={OS_X2 - OS_X1} height={OS_H}
            fill="var(--pv24-brand-purple-lightest)" stroke="var(--pv24-brand-purple)" strokeWidth={2}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.2 }} />
        )}

        {/* OS label */}
        <text x={osCX} y={OS_CY - 30} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={20} fontWeight={700} fill="var(--pv24-brand-purple)">{data.osStageName}</text>

        {/* Arrow: bottleneck → OS → decision */}
        <line x1={BN_X + BN_R} y1={BN_Y} x2={DEC_X - DEC_W / 2 - 8} y2={DEC_Y} stroke="var(--pv24-border-strong)" strokeWidth={2} markerEnd="url(#arrowhead)" />
        {/* Arrow: decision → judgment zone */}
        <line x1={DEC_X + DEC_W / 2} y1={DEC_Y} x2={JZ_LEFT_PX - 8} y2={jzCY} stroke="var(--pv24-border-strong)" strokeWidth={2} />

        {/* Arrowhead marker */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--pv24-border-strong)" />
          </marker>
        </defs>

        {/* Judgment zone right-pointing arrow */}
        <polygon points={`${JZ_LEFT_PX - 8},${jzCY - 10} ${JZ_LEFT_PX + 4},${jzCY} ${JZ_LEFT_PX - 8},${jzCY + 10}`} fill="var(--pv24-brand-purple)" />

        {/* Bottleneck node (circle) */}
        {skip ? (
          <g>
            <circle cx={BN_X} cy={BN_Y} r={BN_R} fill="var(--pv24-surface)" stroke="var(--pv24-border-strong)" strokeWidth={3} />
            <text x={BN_X} y={BN_Y + 6} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={13} fontWeight={600} fill="var(--pv24-text-secondary)">{data.bottleneckLabel}</text>
          </g>
        ) : (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
            <motion.circle cx={BN_X} cy={BN_Y} r={BN_R + 10} fill="none" stroke="var(--pv24-brand-purple)" strokeWidth={1.5}
              animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 2, delay: 1.5, repeat: Infinity }} />
            <circle cx={BN_X} cy={BN_Y} r={BN_R} fill="var(--pv24-surface)" stroke="var(--pv24-border-strong)" strokeWidth={3} />
            <text x={BN_X} y={BN_Y + 6} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={13} fontWeight={600} fill="var(--pv24-text-secondary)">{data.bottleneckLabel}</text>
          </motion.g>
        )}

        {/* Decision node */}
        {skip ? (
          <g>
            <rect x={DEC_X - DEC_W / 2} y={DEC_Y - DEC_H / 2} width={DEC_W} height={DEC_H} fill="var(--pv24-brand-purple)" />
            <text x={DEC_X} y={DEC_Y - 8} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={15} fontWeight={700} fill="#fff">
              <tspan x={DEC_X} dy="0">One prepared</tspan>
              <tspan x={DEC_X} dy="22">decision</tspan>
            </text>
          </g>
        ) : (
          <motion.g initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 1.8 }}>
            <rect x={DEC_X - DEC_W / 2} y={DEC_Y - DEC_H / 2} width={DEC_W} height={DEC_H} fill="var(--pv24-brand-purple)" />
            <text x={DEC_X} y={DEC_Y - 8} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={15} fontWeight={700} fill="#fff">
              <tspan x={DEC_X} dy="0">One prepared</tspan>
              <tspan x={DEC_X} dy="22">decision</tspan>
            </text>
          </motion.g>
        )}
      </svg>

      {/* Signal source nodes (HTML: icon + label) */}
      {Array.from({ length: SIG_COUNT }, (_, i) => {
        const cy = sigCenterY(i);
        const label = data.sources[i] ?? "";
        const Icon = SIGNAL_ICONS[i] ?? IconMail;
        const topPct = ((cy - SIG_NODE_H / 2) / VH) * 100;
        const leftPct = (SIG_PX / VW) * 100;
        const widthPct = (SIG_NODE_W / VW) * 100;
        const heightPct = (SIG_NODE_H / VH) * 100;

        const node = (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              background: "var(--pv24-surface)",
              border: "1.5px solid var(--pv24-border-strong)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 14px",
              boxSizing: "border-box",
            }}
          >
            <Icon size={22} color="var(--pv24-accent)" stroke={1.5} />
            <span style={{ fontSize: 15, color: "var(--pv24-text-secondary)", fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
          </div>
        );

        if (skip) return node;
        return (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              background: "var(--pv24-surface)",
              border: "1.5px solid var(--pv24-border-strong)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 14px",
              boxSizing: "border-box",
            }}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.1 }}
          >
            <Icon size={22} color="var(--pv24-accent)" stroke={1.5} />
            <span style={{ fontSize: 15, color: "var(--pv24-text-secondary)", fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
          </motion.div>
        );
      })}

      {/* Human judgment zone (right panel, HTML) */}
      {(() => {
        const leftPct = (JZ_LEFT_PX / VW) * 100;
        const topPct = (JZ_TOP_PX / VH) * 100;
        const widthPct = ((JZ_RIGHT_PX - JZ_LEFT_PX) / VW) * 100;
        const heightPct = ((JZ_BOTTOM_PX - JZ_TOP_PX) / VH) * 100;

        const content = (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, padding: "36px 40px", boxSizing: "border-box", height: "100%" }}>
            <IconUser size={44} color="var(--pv24-brand-purple)" stroke={1.5} />
            <span style={{ fontSize: 26, fontWeight: 700, color: "var(--pv24-text)", lineHeight: 1.2 }}>{data.judgmentLabel}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {["Interpretation", "Challenge", "Approval"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconArrowRight size={16} color="var(--pv24-accent)" stroke={1.5} />
                  <span style={{ fontSize: 16, color: "var(--pv24-text-secondary)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        );

        if (skip) {
          return (
            <div style={{
              position: "absolute",
              left: `${leftPct}%`, top: `${topPct}%`,
              width: `${widthPct}%`, height: `${heightPct}%`,
              background: "var(--pv24-surface)",
              borderLeft: "6px solid var(--pv24-brand-purple)",
            }}>
              {content}
            </div>
          );
        }
        return (
          <motion.div
            style={{
              position: "absolute",
              left: `${leftPct}%`, top: `${topPct}%`,
              width: `${widthPct}%`, height: `${heightPct}%`,
              background: "var(--pv24-surface)",
              borderLeft: "6px solid var(--pv24-brand-purple)",
              transformOrigin: "left center",
            }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 2.2 }}
          >
            {content}
          </motion.div>
        );
      })()}
    </div>
  );
}
