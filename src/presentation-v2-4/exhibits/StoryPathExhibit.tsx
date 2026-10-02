"use client";

import { motion, useReducedMotion } from "motion/react";
import type { StoryPathData } from "../data/types";

type Props = {
  data: StoryPathData;
  exportMode?: boolean;
};

const VW = 1920;
const VH = 1080;
const RAIL_Y = 560;
const NODE_LEFT = 240;
const NODE_RIGHT = 1680;
const NODE_SIZE = 80;

function nodeX(i: number, count: number): number {
  return NODE_LEFT + i * ((NODE_RIGHT - NODE_LEFT) / Math.max(count - 1, 1));
}

const QUESTION_TOP_PCT = ((RAIL_Y - NODE_SIZE / 2 - 100) / VH) * 100;
const SECTION_TOP_PCT = ((RAIL_Y + NODE_SIZE / 2 + 32) / VH) * 100;

export function StoryPathExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const chapters = data.chapters;
  const count = chapters.length;
  const railLen = NODE_RIGHT - NODE_LEFT;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        overflow: "hidden",
        fontFamily: "var(--pv24-font-family)",
      }}
    >
      {/* SVG: rail line and node squares */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        role="presentation"
        aria-hidden="true"
      >
        {/* Horizontal rail */}
        {skip ? (
          <line
            x1={NODE_LEFT}
            y1={RAIL_Y}
            x2={NODE_RIGHT}
            y2={RAIL_Y}
            stroke="var(--pv24-border-strong)"
            strokeWidth={3}
          />
        ) : (
          <motion.line
            x1={NODE_LEFT}
            y1={RAIL_Y}
            x2={NODE_RIGHT}
            y2={RAIL_Y}
            stroke="var(--pv24-border-strong)"
            strokeWidth={3}
            strokeDasharray={railLen}
            strokeDashoffset={railLen}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
          />
        )}

        {/* Chapter nodes */}
        {chapters.map((ch, i) => {
          const cx = nodeX(i, count);
          const half = NODE_SIZE / 2;
          const isActive = ch.number === data.activeChapterNumber;
          const fill = isActive ? "var(--pv24-brand-purple)" : "var(--pv24-surface)";
          const textFill = isActive ? "#ffffff" : "var(--pv24-text)";
          const stroke = isActive ? "var(--pv24-brand-purple)" : "var(--pv24-border-strong)";
          const delay = 0.55 + i * 0.1;

          if (skip) {
            return (
              <g key={ch.number}>
                <rect
                  x={cx - half}
                  y={RAIL_Y - half}
                  width={NODE_SIZE}
                  height={NODE_SIZE}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={RAIL_Y + 10}
                  textAnchor="middle"
                  fontFamily="Arial, sans-serif"
                  fontSize={28}
                  fontWeight={700}
                  fill={textFill}
                >
                  {ch.number}
                </text>
              </g>
            );
          }

          return (
            <motion.g
              key={ch.number}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0, 0, 0.2, 1], delay }}
            >
              <rect
                x={cx - half}
                y={RAIL_Y - half}
                width={NODE_SIZE}
                height={NODE_SIZE}
                fill={fill}
                stroke={stroke}
                strokeWidth={2}
              />
              <text
                x={cx}
                y={RAIL_Y + 10}
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontSize={28}
                fontWeight={700}
                fill={textFill}
              >
                {ch.number}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {/* HTML text labels — positioned absolutely */}
      {chapters.map((ch, i) => {
        const cx = nodeX(i, count);
        const leftPct = `${(cx / VW) * 100}%`;
        const delay = 0.65 + i * 0.1;

        const questionEl = (
          <div
            style={{
              position: "absolute",
              left: leftPct,
              top: `${QUESTION_TOP_PCT}%`,
              transform: "translateX(-50%)",
              width: 300,
              textAlign: "center",
              color: "var(--pv24-text-secondary)",
              fontSize: "var(--pv24-annotation-size)",
              fontStyle: "italic",
            }}
          >
            {ch.audienceQuestion}
          </div>
        );

        const sectionEl = (
          <div
            style={{
              position: "absolute",
              left: leftPct,
              top: `${SECTION_TOP_PCT}%`,
              transform: "translateX(-50%)",
              width: 300,
              textAlign: "center",
              color: "var(--pv24-text)",
              fontSize: "var(--pv24-exhibit-label-size)",
              fontWeight: 600,
            }}
          >
            {ch.sectionLabel}
          </div>
        );

        if (skip) {
          return (
            <div key={ch.number}>
              {questionEl}
              {sectionEl}
            </div>
          );
        }

        return (
          <motion.div
            key={ch.number}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay }}
          >
            {questionEl}
            {sectionEl}
          </motion.div>
        );
      })}
    </div>
  );
}
