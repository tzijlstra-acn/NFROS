"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import { PresentationStatement, PresentationLabel, PresentationMeta } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

const VW = 1920;
const VH = 1080;

// Three signal streams converge from the left edge to the focal card at center-left
const STREAMS = [
  { id: "top", x1: 0, y1: 160, x2: 800, y2: 540 },
  { id: "mid", x1: 0, y1: 540, x2: 800, y2: 540 },
  { id: "bot", x1: 0, y1: 920, x2: 800, y2: 540 },
] as const;

// Packet phases along each stream: 3 packets per stream at different offsets
const PACKET_PHASES = [0.15, 0.45, 0.75] as const;

function streamLength(s: (typeof STREAMS)[number]) {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function Packet({
  stream,
  phase,
  streamIdx,
  phaseIdx,
  skip,
}: {
  stream: (typeof STREAMS)[number];
  phase: number;
  streamIdx: number;
  phaseIdx: number;
  skip: boolean;
}) {
  const cx = lerp(stream.x1, stream.x2, phase);
  const cy = lerp(stream.y1, stream.y2, phase);
  const isPurple = phaseIdx === PACKET_PHASES.length - 1;
  const fill = isPurple ? "var(--pv23-brand-purple)" : "var(--pv23-border-strong)";
  const size = isPurple ? 12 : 8;

  if (skip) {
    return <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} fill={fill} opacity={isPurple ? 1 : 0.5} />;
  }

  return (
    <motion.rect
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      fill={fill}
      initial={{ opacity: 0 }}
      animate={{ opacity: isPurple ? 1 : 0.6 }}
      transition={{ duration: 0.3, delay: 0.2 + streamIdx * 0.15 + phaseIdx * 0.1 }}
    />
  );
}

export function HeroSignalSlide({ slide, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const lines = slide.heroLines ?? [
    "The right work finds you.",
    "Evidence is already prepared.",
    "Every material decision remains yours.",
  ];

  const cardX = 720;
  const cardY = 410;
  const cardW = 340;
  const cardH = 260;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv23-canvas)",
        overflow: "hidden",
      }}
    >
      {/* Full-canvas SVG signal diagram */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* Stream lines */}
        {STREAMS.map((s, si) => {
          const len = streamLength(s);
          if (skipAnim) {
            return (
              <line
                key={s.id}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke="var(--pv23-border-strong)"
                strokeWidth={si === 1 ? 3 : 2}
              />
            );
          }
          return (
            <motion.line
              key={s.id}
              x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke="var(--pv23-border-strong)"
              strokeWidth={si === 1 ? 3 : 2}
              strokeDasharray={len}
              strokeDashoffset={len}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.1 + si * 0.08 }}
            />
          );
        })}

        {/* Travelling packets */}
        {STREAMS.map((s, si) =>
          PACKET_PHASES.map((phase, pi) => (
            <Packet key={`${s.id}-${pi}`} stream={s} phase={phase} streamIdx={si} phaseIdx={pi} skip={skipAnim} />
          ))
        )}

        {/* Focal card: white surface with purple top bar */}
        <rect x={cardX} y={cardY} width={cardW} height={cardH} fill="var(--pv23-surface)" />
        <rect x={cardX} y={cardY} width={cardW} height={6} fill="var(--pv23-brand-purple)" />

        {/* Purple connector line: card → right text area */}
        <line
          x1={cardX + cardW}
          y1={cardY + cardH / 2}
          x2={1100}
          y2={VH / 2}
          stroke="var(--pv23-brand-purple)"
          strokeWidth={2}
          opacity={0.3}
        />
      </svg>

      {/* Card HTML content: layered over the SVG card rect */}
      {skipAnim ? (
        <div
          style={{
            position: "absolute",
            left: `${(cardX / VW) * 100}%`,
            top: `${(cardY / VH) * 100}%`,
            width: `${(cardW / VW) * 100}%`,
            height: `${(cardH / VH) * 100}%`,
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            justifyContent: "center",
          }}
        >
          <PresentationLabel color="var(--pv23-brand-purple)">NOW</PresentationLabel>
          <PresentationMeta color="var(--pv23-neutral-mid)">Quarterly RCSA review</PresentationMeta>
          <PresentationMeta color="var(--pv23-neutral-mid)">ready for your input</PresentationMeta>
          <div style={{ borderTop: "1px solid var(--pv23-border)", paddingTop: 12, marginTop: 4 }}>
            <PresentationMeta color="var(--pv23-text-secondary)">2 supporting documents attached</PresentationMeta>
          </div>
        </div>
      ) : (
        <motion.div
          style={{
            position: "absolute",
            left: `${(cardX / VW) * 100}%`,
            top: `${(cardY / VH) * 100}%`,
            width: `${(cardW / VW) * 100}%`,
            height: `${(cardH / VH) * 100}%`,
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            justifyContent: "center",
          }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay: 0.6 }}
        >
          <PresentationLabel color="var(--pv23-brand-purple)">NOW</PresentationLabel>
          <PresentationMeta color="var(--pv23-neutral-mid)">Quarterly RCSA review</PresentationMeta>
          <PresentationMeta color="var(--pv23-neutral-mid)">ready for your input</PresentationMeta>
          <div style={{ borderTop: "1px solid var(--pv23-border)", paddingTop: 12, marginTop: 4 }}>
            <PresentationMeta color="var(--pv23-text-secondary)">2 supporting documents attached</PresentationMeta>
          </div>
        </motion.div>
      )}

      {/* Right-side statement lines */}
      <div
        style={{
          position: "absolute",
          right: "6%",
          top: "50%",
          transform: "translateY(-50%)",
          width: "36%",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        {lines.map((line, i) =>
          skipAnim ? (
            <div key={i}>
              <PresentationStatement color="var(--pv23-text)">{line}</PresentationStatement>
            </div>
          ) : (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: [0, 0, 0.2, 1], delay: 0.9 + i * 0.35 }}
            >
              <PresentationStatement color="var(--pv23-text)">{line}</PresentationStatement>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}
