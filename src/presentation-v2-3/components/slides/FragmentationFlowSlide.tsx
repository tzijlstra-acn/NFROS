"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import { PresentationTitle, PresentationSubtitle, PresentationStatement, PresentationLabel, PresentationMeta } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

const VW = 1920;
const VH = 1080;

const SOURCE_LABELS = ["Mail", "Meetings", "Documents", "GRC", "Data", "Actions"] as const;

// Layout: sources column left, person center-left, decision right
const SRC_X = 160;
const SRC_W = 200;
const SRC_H = 64;
const PERSON_X = 800;
const PERSON_Y = 460;
const PERSON_W = 240;
const PERSON_H = 160;
const DEC_X = 1440;
const DEC_Y = 480;
const DEC_W = 220;
const DEC_H = 120;

function srcY(i: number) {
  const total = SOURCE_LABELS.length;
  const span = 700;
  const startY = (VH - span) / 2;
  return startY + i * (span / (total - 1));
}

// Animate packets traveling from source midpoint to person midpoint
// Uses CSS animation via keyframes: 3 packets per line at staggered phases
function TravelingPacket({
  x1, y1, x2, y2,
  delay,
  skip,
}: {
  x1: number; y1: number; x2: number; y2: number;
  delay: number;
  skip: boolean;
}) {
  if (skip) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return <rect x={cx - 5} y={cy - 5} width={10} height={10} fill="var(--pv23-brand-purple)" opacity={0.6} />;
  }

  // Animate from start to end
  return (
    <motion.rect
      x={x1 - 5}
      y={y1 - 5}
      width={10}
      height={10}
      fill="var(--pv23-brand-purple)"
      initial={{ opacity: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 0.8, 0.8, 0],
        x: [0, x2 - x1],
        y: [0, y2 - y1],
      }}
      transition={{
        duration: 1.6,
        delay,
        repeat: Infinity,
        repeatDelay: 0.4,
        ease: "linear",
      }}
    />
  );
}

export function FragmentationFlowSlide({ slide, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const sourceLabels = (slide.bullets as string[] | undefined) ?? [...SOURCE_LABELS];
  const emphasis = slide.emphasis ?? [
    "The first task is often assembly.",
    "Not risk judgment.",
  ];

  const personCentreX = PERSON_X + PERSON_W / 2;
  const personCentreY = PERSON_Y + PERSON_H / 2;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv23-canvas)",
        overflow: "hidden",
      }}
    >
      {/* Slide title */}
      <div style={{ position: "absolute", top: 72, left: 120, right: "20%" }}>
        {skipAnim ? (
          <>
            <PresentationTitle as="h2" color="var(--pv23-text)">{slide.title}</PresentationTitle>
            {slide.subtitle && (
              <PresentationSubtitle as="p" color="var(--pv23-text-secondary)" style={{ marginTop: 12 }}>
                {slide.subtitle}
              </PresentationSubtitle>
            )}
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}>
            <PresentationTitle as="h2" color="var(--pv23-text)">{slide.title}</PresentationTitle>
            {slide.subtitle && (
              <PresentationSubtitle as="p" color="var(--pv23-text-secondary)" style={{ marginTop: 12 }}>
                {slide.subtitle}
              </PresentationSubtitle>
            )}
          </motion.div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* Lines from each source to person */}
        {SOURCE_LABELS.map((_, i) => {
          const sy = srcY(i);
          const ex = PERSON_X;
          const ey = personCentreY;
          return (
            <line
              key={i}
              x1={SRC_X + SRC_W}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke="var(--pv23-border-strong)"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Traveling packets: two per source at different phases */}
        {SOURCE_LABELS.map((_, i) => {
          const sy = srcY(i);
          return [0, 0.5].map((phaseOffset, pi) => (
            <TravelingPacket
              key={`${i}-${pi}`}
              x1={SRC_X + SRC_W}
              y1={sy}
              x2={PERSON_X - 10}
              y2={personCentreY}
              delay={i * 0.18 + phaseOffset * 0.9}
              skip={skipAnim}
            />
          ));
        })}

        {/* Source nodes */}
        {SOURCE_LABELS.map((label, i) => {
          const ny = srcY(i) - SRC_H / 2;
          if (skipAnim) {
            return (
              <g key={label}>
                <rect x={SRC_X} y={ny} width={SRC_W} height={SRC_H} fill="var(--pv23-surface)" stroke="var(--pv23-border)" strokeWidth={1} />
                <foreignObject x={SRC_X} y={ny} width={SRC_W} height={SRC_H}>
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <PresentationMeta color="var(--pv23-text-secondary)">{sourceLabels[i] ?? label}</PresentationMeta>
                  </div>
                </foreignObject>
              </g>
            );
          }
          return (
            <motion.g key={label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: [0, 0, 0.2, 1], delay: 0.2 + i * 0.08 }}>
              <rect x={SRC_X} y={ny} width={SRC_W} height={SRC_H} fill="var(--pv23-surface)" stroke="var(--pv23-border)" strokeWidth={1} />
              <foreignObject x={SRC_X} y={ny} width={SRC_W} height={SRC_H}>
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PresentationMeta color="var(--pv23-text-secondary)">{sourceLabels[i] ?? label}</PresentationMeta>
                </div>
              </foreignObject>
            </motion.g>
          );
        })}

        {/* Person node: centre */}
        <rect x={PERSON_X} y={PERSON_Y} width={PERSON_W} height={PERSON_H} fill="var(--pv23-surface)" stroke="var(--pv23-border-strong)" strokeWidth={2} />
        <foreignObject x={PERSON_X} y={PERSON_Y} width={PERSON_W} height={PERSON_H}>
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <PresentationLabel color="var(--pv23-text)">Risk</PresentationLabel>
            <PresentationLabel color="var(--pv23-text)">professional</PresentationLabel>
          </div>
        </foreignObject>

        {/* Arrow from person to decision */}
        <line
          x1={PERSON_X + PERSON_W}
          y1={personCentreY}
          x2={DEC_X}
          y2={DEC_Y + DEC_H / 2}
          stroke="var(--pv23-border-strong)"
          strokeWidth={2}
        />

        {/* Decision node */}
        <rect x={DEC_X} y={DEC_Y} width={DEC_W} height={DEC_H} fill="var(--pv23-brand-purple-lightest)" stroke="var(--pv23-brand-purple)" strokeWidth={2} />
        <foreignObject x={DEC_X} y={DEC_Y} width={DEC_W} height={DEC_H}>
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PresentationLabel color="var(--pv23-brand-purple)">Decision</PresentationLabel>
          </div>
        </foreignObject>
      </svg>

      {/* Emphasis text below person node */}
      <div
        style={{
          position: "absolute",
          left: `${(PERSON_X / VW) * 100}%`,
          top: `${((PERSON_Y + PERSON_H + 48) / VH) * 100}%`,
          width: `${(PERSON_W / VW) * 100}%`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          textAlign: "center",
        }}
      >
        {emphasis.map((line, i) =>
          skipAnim ? (
            <div key={i}>
              <PresentationStatement color={i === 0 ? "var(--pv23-text)" : "var(--pv23-text-secondary)"}>
                {line}
              </PresentationStatement>
            </div>
          ) : (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay: 0.8 + i * 0.2 }}
            >
              <PresentationStatement color={i === 0 ? "var(--pv23-text)" : "var(--pv23-text-secondary)"}>
                {line}
              </PresentationStatement>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}
