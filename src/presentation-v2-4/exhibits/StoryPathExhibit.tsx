"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  IconAlertTriangle,
  IconLayoutDashboard,
  IconActivity,
  IconShieldCheck,
  IconRocket,
} from "@tabler/icons-react";
import type { StoryPathData } from "../data/types";

type Props = {
  data: StoryPathData;
  exportMode?: boolean;
};

const VW = 1920;
const VH = 1080;

const CHAPTER_ICONS = [
  IconAlertTriangle,
  IconLayoutDashboard,
  IconActivity,
  IconShieldCheck,
  IconRocket,
];

// Vertical agenda layout
// Left: large "AGENDA" label + vertical connector line
// Right: 5 rows, stacked evenly

const ROW_COUNT = 5;
const ROW_AREA_TOP = 80;
const ROW_AREA_BOTTOM = 920;
const ROW_H = (ROW_AREA_BOTTOM - ROW_AREA_TOP) / ROW_COUNT;

// Column positions (px in 1920-wide canvas)
const BADGE_CX = 180;
const CONTENT_LEFT = 280;
const CONTENT_RIGHT = 1760;

export function StoryPathExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const chapters = data.chapters;

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
      {/* SVG: vertical connector line and number badges */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* AGENDA label (left side, vertical) */}
        <text
          x={60}
          y={VH / 2}
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize={17}
          fontWeight={700}
          letterSpacing={4}
          fill="var(--pv24-accent)"
          transform={`rotate(-90, 60, ${VH / 2})`}
        >
          AGENDA
        </text>

        {/* Vertical connecting line */}
        {skip ? (
          <line
            x1={BADGE_CX}
            y1={ROW_AREA_TOP + ROW_H * 0.5}
            x2={BADGE_CX}
            y2={ROW_AREA_TOP + ROW_H * (ROW_COUNT - 0.5)}
            stroke="var(--pv24-border)"
            strokeWidth={2}
          />
        ) : (
          <motion.line
            x1={BADGE_CX}
            y1={ROW_AREA_TOP + ROW_H * 0.5}
            x2={BADGE_CX}
            y2={ROW_AREA_TOP + ROW_H * (ROW_COUNT - 0.5)}
            stroke="var(--pv24-border)"
            strokeWidth={2}
            strokeDasharray={ROW_H * (ROW_COUNT - 1)}
            strokeDashoffset={ROW_H * (ROW_COUNT - 1)}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />
        )}

        {/* Number badge circles */}
        {chapters.map((ch, i) => {
          const cy = ROW_AREA_TOP + ROW_H * (i + 0.5);
          const isActive = ch.number === data.activeChapterNumber;
          const delay = 0.3 + i * 0.1;

          const badge = (
            <g key={ch.number}>
              <circle
                cx={BADGE_CX}
                cy={cy}
                r={30}
                fill={isActive ? "var(--pv24-brand-purple)" : "var(--pv24-surface)"}
                stroke={isActive ? "var(--pv24-brand-purple)" : "var(--pv24-border-strong)"}
                strokeWidth={2}
              />
              <text
                x={BADGE_CX}
                y={cy + 9}
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontSize={20}
                fontWeight={700}
                fill={isActive ? "#fff" : "var(--pv24-text-secondary)"}
              >
                {ch.number}
              </text>
            </g>
          );

          if (skip) return badge;
          return (
            <motion.g
              key={ch.number}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay }}
            >
              {badge.props.children}
            </motion.g>
          );
        })}
      </svg>

      {/* HTML chapter rows */}
      {chapters.map((ch, i) => {
        const topPct = ((ROW_AREA_TOP + ROW_H * i) / VH) * 100;
        const heightPct = (ROW_H / VH) * 100;
        const leftPct = (CONTENT_LEFT / VW) * 100;
        const widthPct = ((CONTENT_RIGHT - CONTENT_LEFT) / VW) * 100;
        const isActive = ch.number === data.activeChapterNumber;
        const Icon = CHAPTER_ICONS[i] ?? IconActivity;
        const delay = 0.35 + i * 0.1;

        const row = (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              gap: 28,
              paddingLeft: 28,
              paddingRight: 48,
              borderLeft: isActive ? "4px solid var(--pv24-accent)" : "4px solid transparent",
              background: isActive ? "var(--pv24-surface)" : "transparent",
              boxSizing: "border-box",
            }}
          >
            <Icon
              size={36}
              color={isActive ? "var(--pv24-accent)" : "var(--pv24-border-strong)"}
              stroke={1.5}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? "var(--pv24-text)" : "var(--pv24-text-secondary)",
                  lineHeight: 1.1,
                }}
              >
                {ch.sectionLabel}
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontStyle: "italic",
                  color: "var(--pv24-text-secondary)",
                  lineHeight: 1.3,
                }}
              >
                {ch.audienceQuestion}
              </span>
            </div>
          </div>
        );

        if (skip) {
          return (
            <div
              key={ch.number}
              style={{
                position: "absolute",
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
              }}
            >
              {row}
            </div>
          );
        }

        return (
          <motion.div
            key={ch.number}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
            }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay }}
          >
            {row}
          </motion.div>
        );
      })}
    </div>
  );
}
