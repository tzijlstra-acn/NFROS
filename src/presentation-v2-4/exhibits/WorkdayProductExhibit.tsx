"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconAlertTriangle,
  IconClipboardCheck,
  IconUserCheck,
  IconClock,
  IconCircleCheck,
} from "@tabler/icons-react";
import type { WorkdayProductData } from "@/presentation-v2-4/data/types";

export interface WorkdayProductExhibitProps {
  data: WorkdayProductData;
  exportMode?: boolean;
}

const FRAME_X = 60;
const FRAME_Y = 20;
const FRAME_W = 1260;
const FRAME_H = 676;

const ANNOT_X = 1360;
const ANNOT_W = 500;

// Illustrative work items per zone
const ZONE_ITEMS = [
  {
    label: "NOW",
    color: "var(--pv24-accent)",
    flex: 2.5,
    items: [
      {
        icon: IconAlertTriangle,
        urgent: true,
        title: "Basel III CAR threshold breach: Deutsche Bank entity",
        meta: "AI Partner: evidence pack ready, 2 comparable precedents attached",
      },
      {
        icon: IconClipboardCheck,
        urgent: false,
        title: "OpRisk Committee pack: sign-off required by 17:00",
        meta: "5 open items, 1 awaiting your approval",
      },
    ],
  },
  {
    label: "NEXT",
    color: "var(--pv24-text-secondary)",
    flex: 2,
    items: [
      {
        icon: IconUserCheck,
        urgent: false,
        title: "Q3 TPRM review: Fintech Vendor X",
        meta: "Due 15 Oct. Contract scan complete, 3 open findings prepared",
      },
      {
        icon: IconClock,
        urgent: false,
        title: "Annual control assessment: Payment Services",
        meta: "Due 28 Oct. Evidence collection 80% complete",
      },
    ],
  },
  {
    label: "DONE",
    color: "var(--pv24-border-strong)",
    labelColor: "var(--pv24-text-secondary)",
    flex: 1.5,
    items: [
      {
        icon: IconCircleCheck,
        urgent: false,
        title: "TPRM sign-off: Tier 1 supplier renewal",
        meta: "Audit trail complete. Approved 09:42 this morning.",
      },
    ],
  },
];

const DAYLINE_Y = 724;

export function WorkdayProductExhibit({ data: _data, exportMode = false }: WorkdayProductExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
      aria-label="Workday product exhibit"
    >
      {/* Product frame */}
      <motion.div
        initial={skip ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: FRAME_X,
          top: FRAME_Y,
          width: FRAME_W,
          height: FRAME_H,
          background: "var(--pv24-surface)",
          boxShadow: "0 2px 24px rgba(0,0,0,0.10)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Purple top accent bar */}
        <div style={{ height: 6, background: "var(--pv24-accent)", flexShrink: 0 }} />

        {/* Zone columns */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 24px", gap: 12 }}>
          {ZONE_ITEMS.map((zone, zi) => (
            <div
              key={zone.label}
              style={{
                flex: zone.flex,
                borderLeft: `3px solid ${zone.color}`,
                paddingLeft: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 0,
              }}
            >
              {/* Zone header */}
              <div style={{
                fontWeight: 700,
                letterSpacing: "0.08em",
                fontSize: 15,
                color: "labelColor" in zone ? zone.labelColor : zone.color,
                textTransform: "uppercase",
                flexShrink: 0,
              }}>
                {zone.label}
              </div>
              {/* Work items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
                {zone.items.map((item, ii) => {
                  const Icon = item.icon;
                  const el = (
                    <div
                      key={ii}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "10px 14px",
                        background: item.urgent ? "#fff8f0" : "var(--pv24-surface)",
                        border: `1px solid ${item.urgent ? "#FFB347" : "var(--pv24-border)"}`,
                        borderRadius: 3,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={21} color={item.urgent ? "#C0620F" : "var(--pv24-text-secondary)"} stroke={1.6} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pv24-text)", lineHeight: 1.3 }}>{item.title}</div>
                        {item.meta && <div style={{ fontSize: 15, color: "var(--pv24-text-secondary)", marginTop: 3, lineHeight: 1.3 }}>{item.meta}</div>}
                      </div>
                    </div>
                  );
                  if (skip) return el;
                  return (
                    <motion.div key={ii}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + zi * 0.2 + ii * 0.1, duration: 0.3 }}>
                      {el}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Right: Focus annotation panel */}
      <div style={{
        position: "absolute",
        left: ANNOT_X,
        top: FRAME_Y,
        width: ANNOT_W,
        height: FRAME_H,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        paddingTop: 16,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, color: "var(--pv24-accent)", textTransform: "uppercase" }}>
          AI Partner activity
        </div>
        {[
          { label: "Signals monitored", value: "12 active" },
          { label: "Evidence packs prepared", value: "3 today" },
          { label: "Routine tasks handled", value: "8 complete" },
          { label: "Decisions awaiting you", value: "2 NOW" },
        ].map((item, i) => {
          const el = (
            <div key={i} style={{
              background: "var(--pv24-surface)",
              border: "1px solid var(--pv24-border)",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}>
              <div style={{ fontSize: 16, color: "var(--pv24-text-secondary)" }}>{item.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: i === 3 ? "var(--pv24-accent)" : "var(--pv24-text)" }}>{item.value}</div>
            </div>
          );
          if (skip) return el;
          return (
            <motion.div key={i}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.15, duration: 0.35 }}>
              {el}
            </motion.div>
          );
        })}
        <div style={{ marginTop: "auto", fontSize: 15, color: "var(--pv24-text-secondary)", fontStyle: "italic", lineHeight: 1.4 }}>
          Illustrative: synthetic institution and data
        </div>
      </div>

      {/* Bottom: day timeline rail */}
      <svg aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <line x1={FRAME_X} y1={DAYLINE_Y} x2={FRAME_X + FRAME_W} y2={DAYLINE_Y} stroke="var(--pv24-border)" strokeWidth={1} />
        {["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"].map((t, i, arr) => {
          const x = FRAME_X + (i / (arr.length - 1)) * FRAME_W;
          return (
            <g key={t}>
              <line x1={x} y1={DAYLINE_Y - 6} x2={x} y2={DAYLINE_Y + 6} stroke="var(--pv24-accent)" strokeWidth={1.5} />
              <text x={x} y={DAYLINE_Y + 28} textAnchor={i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle"} fontSize={16} fill="var(--pv24-text-secondary)" fontFamily="var(--pv24-font-family)">{t}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
