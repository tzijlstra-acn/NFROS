"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconRobot,
  IconSparkles,
  IconUserCheck,
  IconCircleCheck,
  IconLock,
  IconScale,
} from "@tabler/icons-react";
import type { AuthorityMatrixData, AuthorityZone } from "@/presentation-v2-4/data/types";

export interface AuthorityMatrixExhibitProps {
  data: AuthorityMatrixData;
  exportMode?: boolean;
}

// Drawn on the 1920 x 780 exhibit stage
const W = 1920;
const H = 780;

const AXIS_X = 130;
const AXIS_TOP = 20;
const AXIS_BOTTOM = 712;
const AXIS_RIGHT = 1850;

const CARD_W = 520;
const CARD_H = 326;
const AUTHORITY_LINE_X = 1280;

type ZoneStyle = {
  x: number;
  y: number;
  icon: typeof IconRobot;
  owner: string;
  headerBg: string;
  headerText: string;
  border: string;
  tick: string;
  statuses: string[];
  control: string;
  delay: number;
};

// Index order follows data.zones: AI executes, AI prepares, Human decides
const ZONE_STYLES: ZoneStyle[] = [
  {
    x: 1300,
    y: 380,
    icon: IconRobot,
    owner: "AI",
    headerBg: "var(--pv24-muted-bg)",
    headerText: "var(--pv24-text)",
    border: "var(--pv24-border-strong)",
    tick: "var(--pv24-text-secondary)",
    statuses: ["14 sent today, all logged", "212 items checked, 9 stale flagged", "Synced to GRC at 08:00"],
    control: "Pre-approved policy. Low risk, reversible and logged.",
    delay: 0.4,
  },
  {
    x: 740,
    y: 202,
    icon: IconSparkles,
    owner: "AI + Human",
    headerBg: "var(--pv24-accent-lightest)",
    headerText: "var(--pv24-accent-dark)",
    border: "var(--pv24-accent)",
    tick: "var(--pv24-accent)",
    statuses: ["Draft ready, 3 open points flagged", "6 questions proposed, reviewer edits", "Clause drafted, awaiting review"],
    control: "AI drafts. A professional edits, challenges and approves.",
    delay: 1.1,
  },
  {
    x: 180,
    y: 24,
    icon: IconUserCheck,
    owner: "Human",
    headerBg: "var(--pv24-brand-purple-dark)",
    headerText: "#FFFFFF",
    border: "var(--pv24-brand-purple-dark)",
    tick: "var(--pv24-brand-purple-dark)",
    statuses: [
      "Head of OpRisk signs the rating",
      "TPRM lead approves Tier 1 vendor",
      "Risk owner accepts, expiry in 90 days",
      "CRO informed, decision recorded",
    ],
    control: "Named approver. Rationale and timestamp recorded.",
    delay: 1.8,
  },
];

const CONTROL_FACTS = [
  { icon: IconLock, text: "Every material decision carries a named approver" },
  { icon: IconScale, text: "Policy limits are set by the risk function, not the AI" },
  { icon: IconCircleCheck, text: "Every AI action is logged and reviewable" },
];

function ZoneCard({
  zone,
  style,
  isHuman,
  skip,
}: {
  zone: AuthorityZone;
  style: ZoneStyle;
  isHuman: boolean;
  skip: boolean;
}) {
  const Icon = style.icon;
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={skip ? undefined : { duration: 0.45, ease: "easeOut", delay: style.delay }}
      style={{
        position: "absolute",
        left: style.x,
        top: style.y,
        width: CARD_W,
        height: CARD_H,
        background: "var(--pv24-surface)",
        border: `2px solid ${style.border}`,
        boxShadow: "0 8px 28px rgba(17, 18, 20, 0.09)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {isHuman && !skip && (
        <motion.div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -8,
            border: "2px solid var(--pv24-brand-purple)",
            pointerEvents: "none",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.55, 0] }}
          transition={{ duration: 2.2, delay: style.delay + 1.2, repeat: Infinity, repeatDelay: 0.8 }}
        />
      )}

      <div
        style={{
          background: style.headerBg,
          color: style.headerText,
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <Icon size={28} stroke={1.6} />
        <div style={{ flex: 1, fontSize: 21, fontWeight: 700, lineHeight: 1.15 }}>{zone.label}</div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "4px 10px",
            border: "1.5px solid currentColor",
            whiteSpace: "nowrap",
          }}
        >
          {style.owner}
        </div>
      </div>

      <div style={{ padding: "8px 18px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {zone.examples.map((example, i) => (
          <motion.div
            key={example}
            initial={skip ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={skip ? undefined : { duration: 0.3, delay: style.delay + 0.3 + i * 0.12 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "4px 0",
              borderBottom: i < zone.examples.length - 1 ? "1px solid var(--pv24-border)" : "none",
            }}
          >
            <IconCircleCheck size={20} color={style.tick} stroke={1.8} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pv24-text)", lineHeight: 1.25 }}>{example}</div>
              <div style={{ fontSize: 15, color: "var(--pv24-text-secondary)", lineHeight: 1.25 }}>
                {style.statuses[i] ?? ""}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div
        style={{
          padding: "8px 18px",
          borderTop: "1px solid var(--pv24-border)",
          background: "var(--pv24-canvas)",
          fontSize: 15,
          color: "var(--pv24-text-secondary)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <IconLock size={16} stroke={1.8} color={style.tick} style={{ flexShrink: 0 }} />
        {style.control}
      </div>
    </motion.div>
  );
}

export function AuthorityMatrixExhibit({ data, exportMode = false }: AuthorityMatrixExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const yMid = (AXIS_TOP + AXIS_BOTTOM) / 2;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
      role="group"
      aria-label="Authority matrix exhibit"
    >
      <svg
        aria-hidden="true"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <defs>
          <marker id="pv24-am-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
            <path d="M0,0 L12,6 L0,12 z" fill="var(--pv24-text)" />
          </marker>
        </defs>

        <motion.g
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skip ? undefined : { duration: 0.4 }}
        >
          <line x1={AXIS_X} y1={AXIS_BOTTOM} x2={AXIS_X} y2={AXIS_TOP + 6} stroke="var(--pv24-text)" strokeWidth={2} markerEnd="url(#pv24-am-arrow)" />
          <line x1={AXIS_X} y1={AXIS_BOTTOM} x2={AXIS_RIGHT} y2={AXIS_BOTTOM} stroke="var(--pv24-text)" strokeWidth={2} markerEnd="url(#pv24-am-arrow)" />

          <text
            x={70}
            y={yMid}
            textAnchor="middle"
            fontSize={18}
            fontWeight={700}
            fill="var(--pv24-text)"
            fontFamily="var(--pv24-font-family)"
            transform={`rotate(-90, 70, ${yMid})`}
          >
            {data.yLabel}
          </text>
          <text x={AXIS_X - 14} y={AXIS_TOP + 40} textAnchor="end" fontSize={16} fill="var(--pv24-text-secondary)" fontFamily="var(--pv24-font-family)">Higher</text>
          <text x={AXIS_X - 14} y={AXIS_BOTTOM - 6} textAnchor="end" fontSize={16} fill="var(--pv24-text-secondary)" fontFamily="var(--pv24-font-family)">Lower</text>

          <text x={(AXIS_X + AXIS_RIGHT) / 2} y={AXIS_BOTTOM + 40} textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--pv24-text)" fontFamily="var(--pv24-font-family)">
            {data.xLabel}
          </text>
          <text x={AXIS_X + 10} y={AXIS_BOTTOM + 28} fontSize={16} fill="var(--pv24-text-secondary)" fontFamily="var(--pv24-font-family)">Lower</text>
          <text x={AXIS_RIGHT - 16} y={AXIS_BOTTOM + 28} textAnchor="end" fontSize={16} fill="var(--pv24-text-secondary)" fontFamily="var(--pv24-font-family)">Higher</text>
        </motion.g>

        {/* Authority line: left of it a named professional approves */}
        <motion.line
          x1={AUTHORITY_LINE_X}
          y1={AXIS_TOP}
          x2={AUTHORITY_LINE_X}
          y2={AXIS_BOTTOM}
          stroke="var(--pv24-accent)"
          strokeWidth={3}
          initial={skip ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={skip ? undefined : { duration: 0.7, ease: "easeInOut", delay: 2.6 }}
        />
      </svg>

      {/* Authority line explainer, top right */}
      <motion.div
        initial={skip ? false : { opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={skip ? undefined : { duration: 0.4, delay: 2.9 }}
        style={{
          position: "absolute",
          left: AUTHORITY_LINE_X + 28,
          top: 30,
          width: 500,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--pv24-accent)" }}>
          {data.matrixNote}: the authority line
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--pv24-text)", lineHeight: 1.25 }}>
          Left of the line, a named professional decides. Right of the line, AI acts inside policy.
        </div>
        <div style={{ fontSize: 15, color: "var(--pv24-text-secondary)", fontStyle: "italic" }}>
          Illustrative: synthetic institution and data
        </div>
      </motion.div>

      {/* Control facts, bottom left */}
      <motion.div
        initial={skip ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={skip ? undefined : { duration: 0.4, delay: 3.1 }}
        style={{
          position: "absolute",
          left: 180,
          top: 420,
          width: 520,
          padding: "20px 24px",
          background: "var(--pv24-surface)",
          borderLeft: "4px solid var(--pv24-brand-purple-dark)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--pv24-brand-purple-dark)" }}>
          Accountability does not move
        </div>
        {CONTROL_FACTS.map((fact) => {
          const Icon = fact.icon;
          return (
            <div key={fact.text} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Icon size={26} stroke={1.6} color="var(--pv24-brand-purple-dark)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 17, color: "var(--pv24-text)", lineHeight: 1.3 }}>{fact.text}</span>
            </div>
          );
        })}
      </motion.div>

      {data.zones.map((zone, i) => {
        const style = ZONE_STYLES[i];
        if (style === undefined) return null;
        return <ZoneCard key={zone.label} zone={zone} style={style} isHuman={i === 2} skip={skip} />;
      })}
    </div>
  );
}
