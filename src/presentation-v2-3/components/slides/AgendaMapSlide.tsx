"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import { PresentationLabel, PresentationMeta } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
  currentSection?: number;
};

const DEFAULT_QUESTIONS = [
  "Why change?",
  "What is it?",
  "How does work change?",
  "How is it controlled and offered?",
  "How do we start?",
] as const;

const DEFAULT_SECTIONS = ["Problem", "Product", "Daily", "Service", "NextStep"] as const;

export function AgendaMapSlide({ slide, exportMode = false, currentSection = 1 }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const agendaItems = slide.agendaItems ?? [];

  const questions = DEFAULT_QUESTIONS;
  const sectionNames = agendaItems.length >= 5
    ? agendaItems.map((a) => a.section)
    : DEFAULT_SECTIONS;

  const count = 5;
  const lineLeft = 192;
  const lineRight = 1728;
  const lineY = 540;
  const nodeSpacing = (lineRight - lineLeft) / (count - 1);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv23-canvas)",
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 1920 1080"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {skipAnim ? (
          <line
            x1={lineLeft}
            y1={lineY}
            x2={lineRight}
            y2={lineY}
            stroke="var(--pv23-border-strong)"
            strokeWidth={1}
          />
        ) : (
          <motion.line
            x1={lineLeft}
            y1={lineY}
            x2={lineRight}
            y2={lineY}
            stroke="var(--pv23-border-strong)"
            strokeWidth={1}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0, 0, 0.2, 1] }}
          />
        )}

        {Array.from({ length: count }, (_, i) => {
          const cx = lineLeft + i * nodeSpacing;
          const isActive = i + 1 === currentSection;
          const size = isActive ? 28 : 24;
          const fill = isActive ? "var(--pv23-brand-purple)" : "var(--pv23-neutral-mid)";

          return (
            <g key={i}>
              <rect
                x={cx - size / 2}
                y={lineY - size / 2}
                width={size}
                height={size}
                fill={fill}
              />
              <foreignObject x={cx - 120} y={lineY - 110} width={240} height={80}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    height: "100%",
                    textAlign: "center",
                  }}
                >
                  <PresentationMeta
                    color={isActive ? "var(--pv23-text)" : "var(--pv23-text-secondary)"}
                  >
                    {questions[i]}
                  </PresentationMeta>
                </div>
              </foreignObject>
              <foreignObject x={cx - 120} y={lineY + 30} width={240} height={60}>
                <div style={{ display: "flex", justifyContent: "center", textAlign: "center" }}>
                  <PresentationLabel
                    color={isActive ? "var(--pv23-brand-purple)" : "var(--pv23-text-secondary)"}
                  >
                    {sectionNames[i]}
                  </PresentationLabel>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
