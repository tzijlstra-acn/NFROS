"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { WorkdayProductData } from "@/presentation-v2-4/data/types";

export interface WorkdayProductExhibitProps {
  data: WorkdayProductData;
  exportMode?: boolean;
}

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const FRAME_X = 100;
const FRAME_Y = 80;
const FRAME_W = 1200;
const FRAME_H = 820;

const ANNOT_X = 1340;
const ANNOT_W = 480;

const ZONES: Array<{ label: string; description: string; flex: number }> = [
  { label: "Now", flex: 3, description: "Active decisions and immediate focus" },
  { label: "Next", flex: 2, description: "Queued and prepared items" },
  { label: "Done", flex: 1, description: "Completed and archived" },
];

const DAYLINE_Y = 940;
const DAYLINE_X_START = 100;
const DAYLINE_X_END = 1820;

export function WorkdayProductExhibit({ data, exportMode = false }: WorkdayProductExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const timelineEventCount = data.daylineEvents.length;
  const timelineSpacing =
    timelineEventCount > 1 ? (DAYLINE_X_END - DAYLINE_X_START) / (timelineEventCount - 1) : 0;

  const annotCardH = 120;
  const annotGap = 20;
  const annotStartY = 120;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: CANVAS_W,
        height: CANVAS_H,
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
          borderRadius: 4,
          boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Purple top accent bar */}
        <div style={{ height: 8, background: "var(--pv24-accent)", flexShrink: 0 }} />

        {/* Zones */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 16 }}>
          {ZONES.map((zone) => (
            <div
              key={zone.label}
              style={{
                flex: zone.flex,
                border: "1.5px solid var(--pv24-border)",
                borderRadius: 6,
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                background: "var(--pv24-surface)",
              }}
            >
              <div
                style={{
                  color: "var(--pv24-accent)",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontSize: "var(--pv24-label-size, 13px)",
                  marginBottom: 6,
                }}
              >
                {zone.label}
              </div>
              <div
                style={{
                  color: "var(--pv24-text-secondary)",
                  fontSize: "var(--pv24-body-size, 15px)",
                }}
              >
                {zone.description}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Focus annotation cards */}
      {data.focusAnnotations.map((ann, i) => (
        <motion.div
          key={ann.label}
          initial={skip ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: skip ? 0 : 0.5 + i * 0.18 }}
          style={{
            position: "absolute",
            left: ANNOT_X,
            top: annotStartY + i * (annotCardH + annotGap),
            width: ANNOT_W,
            background: "var(--pv24-surface)",
            border: "1.5px solid var(--pv24-border)",
            borderRadius: 6,
            padding: "18px 22px",
            boxShadow: "0 1px 8px rgba(0,0,0,0.07)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: "var(--pv24-accent)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontWeight: 700,
                color: "var(--pv24-text)",
                fontSize: "var(--pv24-label-size, 14px)",
              }}
            >
              {ann.label}
            </span>
          </div>
          <div
            style={{
              color: "var(--pv24-text-secondary)",
              fontSize: "var(--pv24-body-size, 14px)",
              lineHeight: 1.5,
            }}
          >
            {ann.meaning}
          </div>
        </motion.div>
      ))}

      {/* Day timeline SVG layer */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: CANVAS_W,
          height: CANVAS_H,
          pointerEvents: "none",
        }}
      >
        {/* Static rail */}
        <line
          x1={DAYLINE_X_START}
          y1={DAYLINE_Y}
          x2={DAYLINE_X_END}
          y2={DAYLINE_Y}
          stroke="var(--pv24-border-strong)"
          strokeWidth={2}
        />
        {/* Ticks and static labels */}
        {data.daylineEvents.map((evt, i) => {
          const x = DAYLINE_X_START + i * timelineSpacing;
          return (
            <g key={evt.time}>
              <line
                x1={x}
                y1={DAYLINE_Y - 8}
                x2={x}
                y2={DAYLINE_Y + 8}
                stroke="var(--pv24-accent)"
                strokeWidth={2}
              />
              <text
                x={x}
                y={DAYLINE_Y + 28}
                textAnchor="middle"
                fill="var(--pv24-text-secondary)"
                fontSize={13}
                fontFamily="var(--pv24-font-family)"
              >
                {evt.time}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Animated day line overlay (draws left to right) */}
      <motion.div
        initial={skip ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut", delay: skip ? 0 : 1.1 }}
        style={{
          position: "absolute",
          left: DAYLINE_X_START,
          top: DAYLINE_Y - 1,
          width: DAYLINE_X_END - DAYLINE_X_START,
          height: 2,
          background: "var(--pv24-accent)",
          transformOrigin: "left center",
        }}
      />

      {/* Animated event label overlays */}
      {data.daylineEvents.map((evt, i) => {
        const x = DAYLINE_X_START + i * timelineSpacing;
        return (
          <motion.div
            key={`label-${i}`}
            initial={skip ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: skip ? 0 : 1.2 + i * 0.15 }}
            style={{
              position: "absolute",
              left: x - 60,
              top: DAYLINE_Y - 50,
              width: 120,
              textAlign: "center",
              color: "var(--pv24-text)",
              fontSize: "var(--pv24-caption-size, 12px)",
              fontWeight: 600,
              fontFamily: "var(--pv24-font-family)",
              pointerEvents: "none",
            }}
          >
            {evt.label}
          </motion.div>
        );
      })}
    </div>
  );
}
