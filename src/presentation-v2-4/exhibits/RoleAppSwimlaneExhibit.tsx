"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { SwimlaneData, SwimlaneStage } from "@/presentation-v2-4/data/types";

export interface RoleAppSwimlaneExhibitProps {
  data: SwimlaneData;
  exportMode?: boolean;
}

const CANVAS_W = 1920;
const CANVAS_H = 1080;

const STAGE_COUNT = 8;
const STAGE_START_X = 280;
const STAGE_END_X = CANVAS_W - 80;
const STAGE_SPACING = (STAGE_END_X - STAGE_START_X) / (STAGE_COUNT - 1);
const STAGE_SIZE = 48;

const LANE_1_TOP = 200;
const LANE_1_BOT = 480;
const LANE_2_TOP = 560;
const LANE_2_BOT = 840;

const TRACK_LABELS: readonly string[] = ["AI prepares", "Human decides", "System executes"];

const LABEL_X = 20;

function laneRailY(top: number, bot: number): number {
  return top + (bot - top) * 0.55;
}

interface GateIconProps {
  cx: number;
  cy: number;
}

function GateIcon({ cx, cy }: GateIconProps) {
  return (
    <g>
      <line x1={cx} y1={cy - 20} x2={cx} y2={cy + 20} stroke="var(--pv24-accent)" strokeWidth={2} />
      <polygon
        points={`${cx},${cy - 10} ${cx + 7},${cy} ${cx},${cy + 10} ${cx - 7},${cy}`}
        fill="var(--pv24-accent)"
      />
    </g>
  );
}

interface StageMarkerProps {
  stage: SwimlaneStage;
  cx: number;
  cy: number;
  skip: boolean;
  delay: number;
}

function StageMarker({ stage, cx, cy, skip, delay }: StageMarkerProps) {
  const isCurrent = !!stage.isCurrentStage;
  const isGate = !!stage.isHumanGate;
  const half = STAGE_SIZE / 2;

  return (
    <motion.g
      initial={skip ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
    >
      {isGate && !isCurrent && <GateIcon cx={cx} cy={cy - half - 14} />}

      <rect
        x={cx - half}
        y={cy - half}
        width={STAGE_SIZE}
        height={STAGE_SIZE}
        rx={4}
        ry={4}
        fill={isCurrent ? "var(--pv24-accent)" : "var(--pv24-surface)"}
        stroke={isGate ? "var(--pv24-accent)" : "var(--pv24-border-strong)"}
        strokeWidth={isGate ? 2 : 1.5}
      />

      <text
        x={cx}
        y={cy + half + 20}
        textAnchor="middle"
        fill={isCurrent ? "var(--pv24-accent)" : "var(--pv24-text-secondary)"}
        fontSize={11}
        fontWeight={isCurrent ? 700 : 400}
        fontFamily="var(--pv24-font-family)"
      >
        {stage.label}
      </text>

      {isGate && (
        <motion.rect
          x={cx - half - 4}
          y={cy - half - 4}
          width={STAGE_SIZE + 8}
          height={STAGE_SIZE + 8}
          rx={6}
          ry={6}
          fill="none"
          stroke="var(--pv24-accent)"
          strokeWidth={2}
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: 0.9,
            ease: "easeInOut",
            delay: skip ? 0 : delay + 0.3,
            times: [0, 0.5, 1],
          }}
        />
      )}
    </motion.g>
  );
}

interface LaneRenderProps {
  title: string;
  stages: SwimlaneStage[];
  top: number;
  bot: number;
  skip: boolean;
  laneDelay: number;
}

function LaneRender({ title, stages, top, bot, skip, laneDelay }: LaneRenderProps) {
  const railY = laneRailY(top, bot);
  const laneH = bot - top;
  const trackLabelSpacing = laneH / (TRACK_LABELS.length + 1);

  return (
    <g>
      {/* Lane title and track labels */}
      <motion.g
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: skip ? 0 : laneDelay }}
      >
        <text
          x={LABEL_X + 60}
          y={top + laneH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--pv24-text)"
          fontSize={15}
          fontWeight={700}
          fontFamily="var(--pv24-font-family)"
          transform={`rotate(-90, ${LABEL_X + 60}, ${top + laneH / 2})`}
        >
          {title}
        </text>

        {TRACK_LABELS.map((label, i) => (
          <text
            key={label}
            x={LABEL_X + 100}
            y={top + trackLabelSpacing * (i + 1)}
            dominantBaseline="middle"
            fill="var(--pv24-text-secondary)"
            fontSize={11}
            fontFamily="var(--pv24-font-family)"
          >
            {label}
          </text>
        ))}
      </motion.g>

      {/* Rail line */}
      <motion.line
        x1={STAGE_START_X}
        y1={railY}
        x2={STAGE_END_X}
        y2={railY}
        stroke="var(--pv24-border-strong)"
        strokeWidth={2}
        initial={skip ? false : { scaleX: 0, originX: STAGE_START_X }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.55, ease: "easeInOut", delay: skip ? 0 : laneDelay + 0.2 }}
      />

      {/* Stage markers */}
      {stages.slice(0, STAGE_COUNT).map((stage, i) => {
        const cx = STAGE_START_X + i * STAGE_SPACING;
        return (
          <StageMarker
            key={stage.label}
            stage={stage}
            cx={cx}
            cy={railY}
            skip={skip}
            delay={skip ? 0 : laneDelay + 0.45 + i * 0.07}
          />
        );
      })}
    </g>
  );
}

export function RoleAppSwimlaneExhibit({ data, exportMode = false }: RoleAppSwimlaneExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const lanes = data.lanes.slice(0, 2);
  const laneTops = [LANE_1_TOP, LANE_2_TOP] as const;
  const laneBots = [LANE_1_BOT, LANE_2_BOT] as const;

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
      aria-label="Role app swimlane exhibit"
    >
      <svg
        aria-hidden="true"
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ position: "absolute", inset: 0 }}
      >
        {lanes.map((lane, li) => {
          const top = laneTops[li] ?? LANE_1_TOP;
          const bot = laneBots[li] ?? LANE_1_BOT;
          return (
            <LaneRender
              key={lane.title}
              title={lane.title}
              stages={lane.stages}
              top={top}
              bot={bot}
              skip={skip}
              laneDelay={li * 0.3}
            />
          );
        })}

        {/* Divider between lanes */}
        <line
          x1={0}
          y1={(LANE_1_BOT + LANE_2_TOP) / 2}
          x2={CANVAS_W}
          y2={(LANE_1_BOT + LANE_2_TOP) / 2}
          stroke="var(--pv24-border)"
          strokeWidth={1}
          strokeDasharray="8 6"
        />
      </svg>
    </div>
  );
}
