"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { AuthorityMatrixData, AuthorityZone } from "@/presentation-v2-4/data/types";

export interface AuthorityMatrixExhibitProps {
  data: AuthorityMatrixData;
  exportMode?: boolean;
}

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const MAT_X = 200;
const MAT_Y = 100;
const MAT_W = 1520;
const MAT_H = 820;

const AXIS_MARGIN = 80;
const AXIS_X = MAT_X + AXIS_MARGIN;
const AXIS_Y_TOP = MAT_Y + 20;
const AXIS_Y_BOT = MAT_Y + MAT_H - 20;
const AXIS_X_RIGHT = MAT_X + MAT_W - 20;

const DRAW_X1 = AXIS_X;
const DRAW_X2 = AXIS_X_RIGHT;
const DRAW_Y1 = AXIS_Y_TOP;
const DRAW_Y2 = AXIS_Y_BOT;
const DRAW_W = DRAW_X2 - DRAW_X1;
const DRAW_H = DRAW_Y2 - DRAW_Y1;

// Zone fill colors
const ZONE_FILL_COLORS: readonly string[] = [
  "rgba(230, 220, 255, 0.5)",
  "rgba(255, 255, 255, 0.0)",
  "rgba(245, 246, 248, 1.0)",
] as const;

// Zone polygons (stepped diagonal layout)
function buildZonePolygons(): readonly string[] {
  const z1 = [
    [DRAW_X1, DRAW_Y1],
    [DRAW_X1 + DRAW_W * 0.65, DRAW_Y1],
    [DRAW_X1 + DRAW_W * 0.65, DRAW_Y1 + DRAW_H * 0.35],
    [DRAW_X1 + DRAW_W * 0.35, DRAW_Y1 + DRAW_H * 0.35],
    [DRAW_X1 + DRAW_W * 0.35, DRAW_Y1 + DRAW_H * 0.65],
    [DRAW_X1, DRAW_Y1 + DRAW_H * 0.65],
  ];
  const z2 = [
    [DRAW_X1 + DRAW_W * 0.65, DRAW_Y1],
    [DRAW_X2, DRAW_Y1],
    [DRAW_X2, DRAW_Y1 + DRAW_H * 0.35],
    [DRAW_X1 + DRAW_W * 0.65, DRAW_Y1 + DRAW_H * 0.35],
  ];
  const z3 = [
    [DRAW_X1 + DRAW_W * 0.35, DRAW_Y1 + DRAW_H * 0.35],
    [DRAW_X2, DRAW_Y1 + DRAW_H * 0.35],
    [DRAW_X2, DRAW_Y2],
    [DRAW_X1 + DRAW_W * 0.65, DRAW_Y2],
    [DRAW_X1 + DRAW_W * 0.65, DRAW_Y1 + DRAW_H * 0.65],
    [DRAW_X1 + DRAW_W * 0.35, DRAW_Y1 + DRAW_H * 0.65],
  ];
  return [z1, z2, z3].map((poly) => poly.map((p) => p.join(",")).join(" "));
}

const ZONE_POLYGONS = buildZonePolygons();

function buildBoundaryPath(): string {
  const steps: Array<{ x: number; y: number }> = [
    { x: DRAW_X1, y: DRAW_Y1 + DRAW_H * 0.35 },
    { x: DRAW_X1 + DRAW_W * 0.35, y: DRAW_Y1 + DRAW_H * 0.35 },
    { x: DRAW_X1 + DRAW_W * 0.35, y: DRAW_Y1 + DRAW_H * 0.65 },
    { x: DRAW_X1 + DRAW_W * 0.65, y: DRAW_Y1 + DRAW_H * 0.65 },
    { x: DRAW_X1 + DRAW_W * 0.65, y: DRAW_Y2 },
  ];
  return steps.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
}

const BOUNDARY_PATH = buildBoundaryPath();

const ZONE_CENTERS: readonly { x: number; y: number }[] = [
  { x: DRAW_X1 + DRAW_W * 0.25, y: DRAW_Y1 + DRAW_H * 0.28 },
  { x: DRAW_X1 + DRAW_W * 0.78, y: DRAW_Y1 + DRAW_H * 0.18 },
  { x: DRAW_X1 + DRAW_W * 0.72, y: DRAW_Y1 + DRAW_H * 0.72 },
] as const;

const PACKET_START_X = DRAW_X1 + DRAW_W * 0.45;
const PACKET_END_X = DRAW_X1 + DRAW_W * 0.82;
const PACKET_Y = DRAW_Y1 + DRAW_H * 0.72;

interface ZoneLabelGroupProps {
  zone: AuthorityZone;
  center: { x: number; y: number };
  skip: boolean;
  delay: number;
}

function ZoneLabelGroup({ zone, center, skip, delay }: ZoneLabelGroupProps) {
  return (
    <motion.g
      initial={skip ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay }}
    >
      <text
        x={center.x}
        y={center.y - 20}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--pv24-text)"
        fontSize={16}
        fontWeight={700}
        fontFamily="var(--pv24-font-family)"
      >
        {zone.label}
      </text>
      {zone.examples.map((ex, i) => (
        <text
          key={ex}
          x={center.x}
          y={center.y + 12 + i * 18}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--pv24-text-secondary)"
          fontSize={12}
          fontFamily="var(--pv24-font-family)"
        >
          {ex}
        </text>
      ))}
    </motion.g>
  );
}

export function AuthorityMatrixExhibit({ data, exportMode = false }: AuthorityMatrixExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const zones: readonly AuthorityZone[] = data.zones;

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
      aria-label="Authority matrix exhibit"
    >
      <svg
        aria-hidden="true"
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ position: "absolute", inset: 0 }}
      >
        {/* Zone fills */}
        {ZONE_POLYGONS.map((pts, i) => (
          <motion.polygon
            key={i}
            points={pts}
            fill={ZONE_FILL_COLORS[i] ?? "transparent"}
            initial={skip ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: skip ? 0 : 0.4 + i * 0.1 }}
          />
        ))}

        {/* Axes */}
        <motion.g
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Y-axis */}
          <line
            x1={AXIS_X}
            y1={AXIS_Y_TOP}
            x2={AXIS_X}
            y2={AXIS_Y_BOT}
            stroke="var(--pv24-text)"
            strokeWidth={2}
          />
          {/* X-axis */}
          <line
            x1={AXIS_X}
            y1={AXIS_Y_BOT}
            x2={AXIS_X_RIGHT}
            y2={AXIS_Y_BOT}
            stroke="var(--pv24-text)"
            strokeWidth={2}
          />
          {/* X-axis label */}
          <text
            x={(AXIS_X + AXIS_X_RIGHT) / 2}
            y={AXIS_Y_BOT + 50}
            textAnchor="middle"
            fill="var(--pv24-text)"
            fontSize={14}
            fontWeight={600}
            fontFamily="var(--pv24-font-family)"
          >
            {data.xLabel}
          </text>
          {/* X Low / High */}
          <text
            x={AXIS_X + 8}
            y={AXIS_Y_BOT + 30}
            fill="var(--pv24-text-secondary)"
            fontSize={12}
            fontFamily="var(--pv24-font-family)"
          >
            Low
          </text>
          <text
            x={AXIS_X_RIGHT - 8}
            y={AXIS_Y_BOT + 30}
            textAnchor="end"
            fill="var(--pv24-text-secondary)"
            fontSize={12}
            fontFamily="var(--pv24-font-family)"
          >
            High
          </text>
          {/* Y-axis label (rotated) */}
          <text
            x={AXIS_X - 50}
            y={(AXIS_Y_TOP + AXIS_Y_BOT) / 2}
            textAnchor="middle"
            fill="var(--pv24-text)"
            fontSize={14}
            fontWeight={600}
            fontFamily="var(--pv24-font-family)"
            transform={`rotate(-90, ${AXIS_X - 50}, ${(AXIS_Y_TOP + AXIS_Y_BOT) / 2})`}
          >
            {data.yLabel}
          </text>
          {/* Y Low / High */}
          <text
            x={AXIS_X - 10}
            y={AXIS_Y_BOT - 4}
            textAnchor="end"
            fill="var(--pv24-text-secondary)"
            fontSize={12}
            fontFamily="var(--pv24-font-family)"
          >
            Low
          </text>
          <text
            x={AXIS_X - 10}
            y={AXIS_Y_TOP + 14}
            textAnchor="end"
            fill="var(--pv24-text-secondary)"
            fontSize={12}
            fontFamily="var(--pv24-font-family)"
          >
            High
          </text>
        </motion.g>

        {/* Boundary line - animated draw */}
        <motion.path
          d={BOUNDARY_PATH}
          stroke="var(--pv24-accent)"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={skip ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeInOut", delay: skip ? 0 : 0.75 }}
        />

        {/* Zone labels */}
        {zones.map((zone, i) => {
          const center = ZONE_CENTERS[i];
          if (center === undefined) return null;
          return (
            <ZoneLabelGroup
              key={zone.label}
              zone={zone}
              center={center}
              skip={skip}
              delay={skip ? 0 : 1.0 + i * 0.15}
            />
          );
        })}

        {/* Packet path crossing into zone 3 */}
        <motion.circle
          r={7}
          cy={PACKET_Y}
          fill="var(--pv24-accent)"
          initial={skip ? false : { opacity: 0, cx: PACKET_START_X }}
          animate={{ opacity: [0, 1, 1, 0], cx: [PACKET_START_X, PACKET_END_X, PACKET_END_X] }}
          transition={{
            duration: 1.1,
            ease: "easeInOut",
            delay: skip ? 0 : 1.5,
            times: [0, 0.35, 0.8, 1],
          }}
        />

        {/* Matrix note */}
        <motion.text
          x={AXIS_X_RIGHT - 8}
          y={AXIS_Y_BOT - 10}
          textAnchor="end"
          fill="var(--pv24-text-secondary)"
          fontSize={11}
          fontFamily="var(--pv24-font-mono)"
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: skip ? 0 : 1.8 }}
        >
          {data.matrixNote}
        </motion.text>
      </svg>
    </div>
  );
}
