"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconAlertTriangle,
  IconClipboardCheck,
  IconUserCheck,
  IconClock,
  IconCircleCheck,
  IconCircleCheckFilled,
  IconBolt,
  IconChecklist,
} from "@tabler/icons-react";
import type { WorkdayProductData } from "@/presentation-v2-4/data/types";

export interface WorkdayProductExhibitProps {
  data: WorkdayProductData;
  exportMode?: boolean;
}

// Drawn on the 1920 x 780 exhibit stage
const FRAME_X = 60;
const FRAME_Y = 16;
const FRAME_W = 1260;
const FRAME_H = 664;
const ANNOT_X = 1360;
const ANNOT_W = 500;
const DAYLINE_Y = 716;
const DONE_GREEN = "#1F7A45";

type ZoneKey = "now" | "next" | "done";
type ZoneItem = { icon: typeof IconClock; title: string; meta: string; chip: string };
type Zone = { key: ZoneKey; label: string; tagline: string; icon: typeof IconClock; items: ZoneItem[] };

// Illustrative work items for a synthetic Operational Risk Partner
const ZONES: Zone[] = [
  {
    key: "now",
    label: "Now",
    tagline: "Needs your judgment",
    icon: IconBolt,
    items: [
      {
        icon: IconAlertTriangle,
        title: "KRI breach: payments outage time above appetite",
        meta: "AI Partner: evidence pack ready, 2 comparable incidents attached",
        chip: "Open pack",
      },
      {
        icon: IconClipboardCheck,
        title: "OpRisk Committee pack: sign-off required by 17:00",
        meta: "5 open items, 1 awaiting your approval",
        chip: "Sign off",
      },
    ],
  },
  {
    key: "next",
    label: "Next",
    tagline: "Prepared for later today and this week",
    icon: IconClock,
    items: [
      { icon: IconUserCheck, title: "Q3 TPRM review: Fintech Vendor X", meta: "Contract scan complete, 3 open findings prepared", chip: "Due 15 Oct" },
      { icon: IconChecklist, title: "Annual control assessment: Payment Services", meta: "Evidence collection 80% complete", chip: "Due 28 Oct" },
    ],
  },
  {
    key: "done",
    label: "Done",
    tagline: "Handled, audit trail kept",
    icon: IconCircleCheck,
    items: [
      { icon: IconCircleCheckFilled, title: "TPRM sign-off: Tier 1 supplier renewal", meta: "Approved by you, decision record linked", chip: "Done 09:42" },
    ],
  },
];

const ZONE_STYLE: Record<ZoneKey, { box: React.CSSProperties; accent: string; title: string; itemBg: string; chipBg: string; chipText: string; delay: number }> = {
  now: {
    box: { border: "2px solid var(--pv24-accent)", background: "#FBF5FF", boxShadow: "0 6px 22px rgba(161, 0, 255, 0.12)" },
    accent: "var(--pv24-accent)",
    title: "var(--pv24-text)",
    itemBg: "var(--pv24-surface)",
    chipBg: "var(--pv24-accent)",
    chipText: "#FFFFFF",
    delay: 0.45,
  },
  next: {
    box: { border: "1.5px dashed var(--pv24-border-strong)", background: "var(--pv24-surface)" },
    accent: "var(--pv24-text-secondary)",
    title: "var(--pv24-text)",
    itemBg: "var(--pv24-surface)",
    chipBg: "var(--pv24-muted-bg)",
    chipText: "var(--pv24-text)",
    delay: 1.0,
  },
  done: {
    box: { border: "1px solid var(--pv24-border)", background: "var(--pv24-muted-bg)" },
    accent: DONE_GREEN,
    title: "var(--pv24-text-secondary)",
    itemBg: "transparent",
    chipBg: "#E3F2E9",
    chipText: DONE_GREEN,
    delay: 1.4,
  },
};

const STATS = [
  { label: "Signals monitored", value: "12 active" },
  { label: "Evidence packs prepared", value: "3 today" },
  { label: "Routine tasks handled", value: "8 complete" },
  { label: "Decisions awaiting you", value: "2 now" },
];

// Day from 08:00 to 18:00 mapped onto the frame width
const timeX = (h: number, m = 0) => FRAME_X + ((h + m / 60 - 8) / 10) * FRAME_W;

export function WorkdayProductExhibit({ data: _data, exportMode = false }: WorkdayProductExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const nowX = timeX(10, 30);

  return (
    <div
      style={{ position: "absolute", inset: 0, background: "var(--pv24-canvas)", fontFamily: "var(--pv24-font-family)", overflow: "hidden" }}
      aria-label="Workday product exhibit"
    >
      <motion.div
        initial={skip ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={skip ? undefined : { duration: 0.4, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: FRAME_X,
          top: FRAME_Y,
          width: FRAME_W,
          height: FRAME_H,
          background: "var(--pv24-surface)",
          boxShadow: "0 2px 24px rgba(0,0,0,0.10)",
          padding: "18px 22px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {ZONES.map((zone) => {
          const st = ZONE_STYLE[zone.key];
          const ZoneIcon = zone.icon;
          return (
            <motion.div
              key={zone.key}
              initial={skip ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={skip ? undefined : { duration: 0.4, delay: st.delay }}
              style={{ position: "relative", padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 10, ...st.box }}
            >
              {zone.key === "now" && !skip && (
                <motion.div
                  aria-hidden="true"
                  style={{ position: "absolute", inset: -7, border: "2px solid var(--pv24-accent)", pointerEvents: "none" }}
                  animate={{ opacity: [0, 0.5, 0] }}
                  transition={{ duration: 2.2, delay: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
                />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ZoneIcon size={24} color={st.accent} stroke={2} />
                <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: st.accent }}>{zone.label}</span>
                <span style={{ fontSize: 16, color: "var(--pv24-text-secondary)" }}>{zone.tagline}</span>
                {zone.key === "now" && (
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "var(--pv24-accent-dark)" }}>
                    <motion.span
                      style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--pv24-accent)", display: "inline-block" }}
                      animate={skip ? undefined : { opacity: [1, 0.25, 1] }}
                      transition={skip ? undefined : { duration: 1.4, repeat: Infinity }}
                    />
                    {zone.items.length} need you
                  </span>
                )}
              </div>
              {zone.items.map((item, ii) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={skip ? false : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={skip ? undefined : { duration: 0.3, delay: st.delay + 0.2 + ii * 0.12 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: zone.key === "done" ? "4px 4px" : "10px 14px",
                      background: st.itemBg,
                      border: zone.key === "now" ? "1px solid var(--pv24-border)" : "none",
                      borderLeft: zone.key === "now" ? "4px solid var(--pv24-accent)" : undefined,
                    }}
                  >
                    <Icon size={24} color={zone.key === "now" && ii === 0 ? "#B0510C" : st.accent} stroke={1.7} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: st.title, lineHeight: 1.3 }}>{item.title}</div>
                      <div style={{ fontSize: 16, color: "var(--pv24-text-secondary)", marginTop: 2, lineHeight: 1.3 }}>{item.meta}</div>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 16,
                        fontWeight: 700,
                        padding: "6px 14px",
                        background: st.chipBg,
                        color: st.chipText,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.chip}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Right: what the AI Partner already did */}
      <div style={{ position: "absolute", left: ANNOT_X, top: FRAME_Y, width: ANNOT_W, height: FRAME_H, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.12em", color: "var(--pv24-accent)", textTransform: "uppercase", paddingTop: 6 }}>
          AI Partner activity
        </div>
        {STATS.map((item, i) => (
          <motion.div
            key={item.label}
            initial={skip ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={skip ? undefined : { delay: 0.5 + i * 0.15, duration: 0.35 }}
            style={{
              background: "var(--pv24-surface)",
              border: i === 3 ? "2px solid var(--pv24-accent)" : "1px solid var(--pv24-border)",
              padding: "14px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 17, color: "var(--pv24-text-secondary)" }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: i === 3 ? "var(--pv24-accent)" : "var(--pv24-text)" }}>{item.value}</div>
          </motion.div>
        ))}
        <div style={{ marginTop: "auto", fontSize: 16, color: "var(--pv24-text-secondary)", fontStyle: "italic", lineHeight: 1.4 }}>
          Illustrative: synthetic institution and data
        </div>
      </div>

      {/* Day rail: done before now, the next items after it */}
      <svg aria-hidden="true" width={1920} height={780} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={FRAME_X} y1={DAYLINE_Y} x2={FRAME_X + FRAME_W} y2={DAYLINE_Y} stroke="var(--pv24-border-strong)" strokeWidth={2} />
        <line x1={FRAME_X} y1={DAYLINE_Y} x2={nowX} y2={DAYLINE_Y} stroke={DONE_GREEN} strokeWidth={4} />
        {[8, 10, 12, 14, 16, 18].map((h, i, arr) => {
          const x = timeX(h);
          return (
            <g key={h}>
              <line x1={x} y1={DAYLINE_Y - 6} x2={x} y2={DAYLINE_Y + 6} stroke="var(--pv24-border-strong)" strokeWidth={1.5} />
              {h !== 16 && (
                <text x={x} y={DAYLINE_Y + 30} textAnchor={i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle"} fontSize={16} fill="var(--pv24-text-secondary)" fontFamily="var(--pv24-font-family)">
                  {String(h).padStart(2, "0")}:00
                </text>
              )}
            </g>
          );
        })}
        <circle cx={timeX(9, 42)} cy={DAYLINE_Y} r={7} fill={DONE_GREEN} />
        <circle cx={timeX(17)} cy={DAYLINE_Y} r={7} fill="var(--pv24-surface)" stroke="var(--pv24-accent)" strokeWidth={3} />
        <circle cx={nowX} cy={DAYLINE_Y} r={11} fill="var(--pv24-accent)" />
        {!skip && (
          <circle cx={nowX} cy={DAYLINE_Y} r={11} fill="none" stroke="var(--pv24-accent)" strokeWidth={2}>
            <animate attributeName="r" values="11;24" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      <div style={{ position: "absolute", left: nowX + 18, top: DAYLINE_Y + 14, fontSize: 16, fontWeight: 700, color: "var(--pv24-accent-dark)" }}>
        Now 10:30
      </div>
      <div style={{ position: "absolute", left: timeX(17) - 120, top: DAYLINE_Y + 14, width: 112, textAlign: "right", fontSize: 16, fontWeight: 700, color: "var(--pv24-accent-dark)" }}>
        Sign-off due
      </div>
    </div>
  );
}
