"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import { PresentationTitle, PresentationSubtitle, PresentationLabel, PresentationMeta } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

const DEFAULT_QUESTIONS = [
  "Why change?",
  "What is it?",
  "How does work change?",
  "How is it controlled?",
  "How do we start?",
] as const;

const DEFAULT_SECTIONS = ["Problem", "Product", "Daily work", "Service", "Next step"] as const;

const VW = 1920;
const VH = 1080;
const LINE_Y = 600;
const NODE_LEFT = 240;
const NODE_RIGHT = 1680;
const NODE_SIZE = 72;
const COUNT = 5;

function nodeX(i: number) {
  return NODE_LEFT + i * ((NODE_RIGHT - NODE_LEFT) / (COUNT - 1));
}

export function AgendaMapSlide({ slide, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const agendaItems = slide.agendaItems ?? [];
  const questions = DEFAULT_QUESTIONS;
  const sectionNames = agendaItems.length >= 5
    ? agendaItems.map((a) => a.section)
    : [...DEFAULT_SECTIONS];

  const lineLen = NODE_RIGHT - NODE_LEFT;

  // Question labels sit above the rail; section labels sit below
  const questionTopPct = ((LINE_Y - NODE_SIZE / 2 - 80) / VH) * 100;
  const sectionTopPct  = ((LINE_Y + NODE_SIZE / 2 + 24) / VH) * 100;

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--pv23-canvas)", overflow: "hidden" }}>

      {/* Slide title */}
      <div style={{ position: "absolute", top: 80, left: 120, right: "40%" }}>
        {skipAnim ? (
          <>
            <PresentationTitle as="h2" color="var(--pv23-text)">{slide.title}</PresentationTitle>
            {slide.subtitle && (
              <PresentationSubtitle as="p" color="var(--pv23-text-secondary)" style={{ marginTop: 16 }}>
                {slide.subtitle}
              </PresentationSubtitle>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0, 0, 0.2, 1] }}
          >
            <PresentationTitle as="h2" color="var(--pv23-text)">{slide.title}</PresentationTitle>
            {slide.subtitle && (
              <PresentationSubtitle as="p" color="var(--pv23-text-secondary)" style={{ marginTop: 16 }}>
                {slide.subtitle}
              </PresentationSubtitle>
            )}
          </motion.div>
        )}
      </div>

      {/* SVG: rail + nodes */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* Horizontal rail */}
        {skipAnim ? (
          <line x1={NODE_LEFT} y1={LINE_Y} x2={NODE_RIGHT} y2={LINE_Y} stroke="var(--pv23-border-strong)" strokeWidth={3} />
        ) : (
          <motion.line
            x1={NODE_LEFT} y1={LINE_Y} x2={NODE_RIGHT} y2={LINE_Y}
            stroke="var(--pv23-border-strong)"
            strokeWidth={3}
            strokeDasharray={lineLen}
            strokeDashoffset={lineLen}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
          />
        )}

        {/* Nodes */}
        {Array.from({ length: COUNT }, (_, i) => {
          const cx = nodeX(i);
          const half = NODE_SIZE / 2;
          const delay = 0.55 + i * 0.1;

          if (skipAnim) {
            return (
              <g key={i}>
                <rect x={cx - half} y={LINE_Y - half} width={NODE_SIZE} height={NODE_SIZE}
                  fill="var(--pv23-surface)" stroke="var(--pv23-border-strong)" strokeWidth={2} />
                <text x={cx} y={LINE_Y + 10} textAnchor="middle"
                  fontFamily="Arial, sans-serif" fontSize={26} fontWeight={700} fill="var(--pv23-text)">
                  {i + 1}
                </text>
              </g>
            );
          }

          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0, 0, 0.2, 1], delay }}
            >
              <rect x={cx - half} y={LINE_Y - half} width={NODE_SIZE} height={NODE_SIZE}
                fill="var(--pv23-surface)" stroke="var(--pv23-border-strong)" strokeWidth={2} />
              <text x={cx} y={LINE_Y + 10} textAnchor="middle"
                fontFamily="Arial, sans-serif" fontSize={26} fontWeight={700} fill="var(--pv23-text)">
                {i + 1}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {/* HTML text labels: positioned absolutely relative to slide root */}
      {Array.from({ length: COUNT }, (_, i) => {
        const cx = nodeX(i);
        const leftPct = `${(cx / VW) * 100}%`;
        const delay = 0.65 + i * 0.1;

        const questionEl = (
          <div
            style={{
              position: "absolute",
              left: leftPct,
              top: `${questionTopPct}%`,
              transform: "translateX(-50%)",
              width: 280,
              textAlign: "center",
            }}
          >
            <PresentationMeta color="var(--pv23-text-secondary)">{questions[i]}</PresentationMeta>
          </div>
        );

        const sectionEl = (
          <div
            style={{
              position: "absolute",
              left: leftPct,
              top: `${sectionTopPct}%`,
              transform: "translateX(-50%)",
              width: 280,
              textAlign: "center",
            }}
          >
            <PresentationLabel color="var(--pv23-text)">{sectionNames[i]}</PresentationLabel>
          </div>
        );

        if (skipAnim) {
          return (
            <div key={i}>
              {questionEl}
              {sectionEl}
            </div>
          );
        }

        return (
          <motion.div
            key={i}
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
