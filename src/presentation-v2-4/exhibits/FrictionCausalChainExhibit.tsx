"use client";

import { motion, useReducedMotion } from "motion/react";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import type { FrictionCausalChainData } from "../data/types";

interface Props {
  data: FrictionCausalChainData;
  exportMode?: boolean;
}

const VW = 1920;
const VH = 1080;

// Illustrative KPIs for each stage (labeled as illustrative on source note)
const STAGE_KPIS = ["6+ platforms", "2-3 hrs / case", "3-5 day lag", "40% rework"];
const STAGE_KPIS_DESC = ["systems searched", "manual prep time", "decision cycle", "per cycle"];

// 4 stages evenly spread; handoff arrows between them
const STAGE_COUNT = 4;
const STAGE_CX = [260, 700, 1140, 1580];
const STAGE_TOP = 160;
const STAGE_LABEL_Y = 290;
const ARROW_Y = 400;
const FRICTION_Y = 360;
// One card per stage holds its figure, descriptor and consequence
const CARD_TOP = 466;
const CARD_W = 316;
const CARD_H = 176;
const STAGE_COLORS = ["var(--pv24-text-secondary)", "var(--pv24-text-secondary)", "var(--pv24-accent)", "var(--pv24-brand-purple-dark)"];
// The feedback loop runs beneath the cards; its label sits under the curve
const ARC_START_Y = CARD_TOP + CARD_H + 10;
const ARC_CTRL_Y = 772;
const ARC_LABEL_Y = 752;

// Phase labels above the stages (3 phases across 4 stages)
// "Collection" → stages 1-2, "Interpretation" → stage 3, "Action" → stage 4
const PHASE_BANDS = [
  { label: "Collection", x1: 80, x2: 880 },
  { label: "Interpretation", x1: 880, x2: 1340 },
  { label: "Action", x1: 1340, x2: 1840 },
];

export function FrictionCausalChainExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const { chainNodes, frictionBands, implications, feedbackLabel } = data;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--pv24-canvas)", fontFamily: "var(--pv24-font-family)" }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">

        {/* Phase band headers */}
        {PHASE_BANDS.map((phase, i) => {
          const cx = (phase.x1 + phase.x2) / 2;
          return (
            <g key={i}>
              <rect x={phase.x1 + 4} y={70} width={phase.x2 - phase.x1 - 8} height={34} fill={i === 0 ? "var(--pv24-muted-bg)" : i === 1 ? "var(--pv24-accent-lightest)" : "var(--pv24-brand-purple-lightest)"} />
              <text x={cx} y={93} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={16} fontWeight={700} letterSpacing={2} fill={i === 2 ? "var(--pv24-brand-purple-dark)" : "var(--pv24-text-secondary)"}>
                {phase.label.toUpperCase()}
              </text>
              {/* Vertical divider between phases, kept inside the visible band */}
              {i > 0 && <line x1={phase.x1} y1={66} x2={phase.x1} y2={770} stroke="var(--pv24-border)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />}
            </g>
          );
        })}

        {/* Stage step numbers: solid badges coloured by phase */}
        {chainNodes.map((_, i) => {
          const cx = STAGE_CX[i] ?? 260;
          const cy = STAGE_TOP + 40;
          const fill = i < 2 ? "var(--pv24-text-secondary)" : i === 2 ? "var(--pv24-accent)" : "var(--pv24-brand-purple-dark)";
          const badge = (
            <>
              <circle cx={cx} cy={cy} r={36} fill={fill} />
              <text x={cx} y={cy + 13} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={36} fontWeight={700} fill="#FFFFFF">
                {i + 1}
              </text>
            </>
          );
          if (skip) return <g key={i}>{badge}</g>;
          return (
            <motion.g key={i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              transition={{ delay: 0.1 + i * 0.12, duration: 0.35 }}>
              {badge}
            </motion.g>
          );
        })}

        {/* Horizontal flow baseline */}
        {skip ? (
          <line x1={120} y1={ARROW_Y} x2={1800} y2={ARROW_Y} stroke="var(--pv24-border-strong)" strokeWidth={2} />
        ) : (
          <motion.line x1={120} y1={ARROW_Y} x2={1800} y2={ARROW_Y}
            stroke="var(--pv24-border-strong)" strokeWidth={2}
            strokeDasharray={1680} strokeDashoffset={1680}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }} />
        )}

        {/* Handoff arrows between stages */}
        {[0, 1, 2].map((i) => {
          const x1 = (STAGE_CX[i] ?? 260) + 120;
          const x2 = (STAGE_CX[i + 1] ?? 700) - 120;
          const midX = (x1 + x2) / 2;
          const badge = (
            <>
              <polygon points={`${x2 - 10},${ARROW_Y - 8} ${x2 + 8},${ARROW_Y} ${x2 - 10},${ARROW_Y + 8}`} fill="var(--pv24-text-secondary)" />
              <rect x={midX - 72} y={FRICTION_Y - 24} width={144} height={36} rx={18} fill="var(--pv24-surface)" stroke="var(--pv24-accent)" strokeWidth={1.5} />
              <text x={midX} y={FRICTION_Y} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={17} fontWeight={600} fill="var(--pv24-accent-dark)">
                {frictionBands[i] ?? ""}
              </text>
            </>
          );
          if (skip) return <g key={i}>{badge}</g>;
          return (
            <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.15 }}>
              {badge}
            </motion.g>
          );
        })}

        {/* Stage cards: figure, descriptor and consequence */}
        {STAGE_KPIS.map((kpi, i) => {
          const cx = STAGE_CX[i] ?? 260;
          const x = cx - CARD_W / 2;
          const card = (
            <>
              <rect x={x} y={CARD_TOP} width={CARD_W} height={CARD_H} fill="var(--pv24-surface)" stroke="var(--pv24-border)" strokeWidth={1.5} />
              <rect x={x} y={CARD_TOP} width={CARD_W} height={5} fill={STAGE_COLORS[i]} />
              <text x={cx} y={CARD_TOP + 58} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={38} fontWeight={700} fill="var(--pv24-text)">{kpi}</text>
              <text x={cx} y={CARD_TOP + 90} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={18} fill="var(--pv24-text-secondary)">{STAGE_KPIS_DESC[i] ?? ""}</text>
              <line x1={x + 28} y1={CARD_TOP + 114} x2={x + CARD_W - 28} y2={CARD_TOP + 114} stroke="var(--pv24-border)" strokeWidth={1} />
              <text x={cx} y={CARD_TOP + 150} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={19} fontWeight={600} fontStyle="italic" fill="var(--pv24-accent-dark)">{implications[i] ?? ""}</text>
            </>
          );
          if (skip) return <g key={i}>{card}</g>;
          return (
            <motion.g key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.15, duration: 0.4 }}>
              {card}
            </motion.g>
          );
        })}

        {/* Feedback arc from last to first */}
        {(() => {
          const x1 = STAGE_CX[STAGE_COUNT - 1] ?? 1580;
          const x0 = STAGE_CX[0] ?? 260;
          const d = `M ${x1} ${ARC_START_Y} Q ${(x1 + x0) / 2} ${ARC_CTRL_Y}, ${x0} ${ARC_START_Y}`;
          const arc = (
            <>
              <path d={d} fill="none" stroke="var(--pv24-accent)" strokeWidth={2} strokeDasharray="6 4" />
              <polygon points={`${x0 - 9},${ARC_START_Y + 4} ${x0},${ARC_START_Y - 8} ${x0 + 9},${ARC_START_Y + 4}`} fill="var(--pv24-accent)" />
              <text x={(x1 + x0) / 2 + 40} y={ARC_LABEL_Y} textAnchor="start" fontFamily="Arial, sans-serif" fontSize={17} fontStyle="italic" fill="var(--pv24-accent)">{feedbackLabel}</text>
            </>
          );
          if (skip) return <g>{arc}</g>;
          return (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.5 }}>
              {arc}
            </motion.g>
          );
        })()}

        {/* Illustrative disclaimer */}
        <text x={1840} y={786} textAnchor="end" fontFamily="Arial, sans-serif" fontSize={16} fontStyle="italic" fill="var(--pv24-text-secondary)">Illustrative indicative figures</text>
      </svg>

      {/* Stage labels (HTML for line-wrap) */}
      {chainNodes.map((label, i) => {
        const cx = STAGE_CX[i] ?? 260;
        const leftPct = ((cx - 140) / VW) * 100;
        const topPct = (STAGE_LABEL_Y / VH) * 100;
        const widthPct = (280 / VW) * 100;

        const el = (
          <div key={i} style={{
            position: "absolute",
            left: `${leftPct}%`,
            top: `${topPct}%`,
            width: `${widthPct}%`,
            textAlign: "center",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--pv24-text)",
            lineHeight: 1.25,
          }}>
            {label}
          </div>
        );

        if (skip) return el;
        return (
          <motion.div key={i} style={{
            position: "absolute",
            left: `${leftPct}%`,
            top: `${topPct}%`,
            width: `${widthPct}%`,
            textAlign: "center",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--pv24-text)",
            lineHeight: 1.25,
          }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.12, duration: 0.35 }}>
            {label}
          </motion.div>
        );
      })}

      {/* Warning icons at handoff points */}
      {!skip && [0, 1, 2].map((i) => {
        const midX = ((STAGE_CX[i] ?? 260) + (STAGE_CX[i + 1] ?? 700)) / 2;
        const leftPct = ((midX - 14) / VW) * 100;
        const topPct = ((FRICTION_Y - 62) / VH) * 100;
        return (
          <motion.div key={i} style={{ position: "absolute", left: `${leftPct}%`, top: `${topPct}%` }}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 + i * 0.15 }}>
            <IconAlertTriangle size={28} color="var(--pv24-accent)" stroke={1.5} />
          </motion.div>
        );
      })}

      {/* Cycle repeats icon at feedback */}
      {!skip && (
        <motion.div style={{ position: "absolute", left: `${((((STAGE_CX[0] ?? 260) + (STAGE_CX[STAGE_COUNT - 1] ?? 1580)) / 2 + 8) / VW) * 100}%`, top: `${((ARC_LABEL_Y - 20) / VH) * 100}%` }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
          <IconRefresh size={24} color="var(--pv24-accent)" stroke={1.5} />
        </motion.div>
      )}
    </div>
  );
}
