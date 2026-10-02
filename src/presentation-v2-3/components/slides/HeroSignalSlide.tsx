"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import {
  PresentationStatement,
  PresentationLabel,
  PresentationMeta,
} from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

// Signal line definitions: each has start/end in viewBox coords (0 0 960 540)
const SIGNAL_LINES = [
  { id: "top",    x1: 60,  y1: 80,  x2: 480, y2: 270 },
  { id: "mid",    x1: 20,  y1: 270, x2: 480, y2: 270 },
  { id: "bot",    x1: 60,  y1: 460, x2: 480, y2: 270 },
] as const;

// Packet positions along each line (0=start, 1=end), last one is purple
const PACKET_OFFSETS = [0.2, 0.45, 0.70, 1.0] as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function PacketDot({
  x1,
  y1,
  x2,
  y2,
  t,
  purple,
  exportMode,
  delay,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  purple: boolean;
  exportMode: boolean;
  delay: number;
}) {
  const cx = lerp(x1, x2, t);
  const cy = lerp(y1, y2, t);

  if (exportMode) {
    return (
      <rect
        x={cx - 4}
        y={cy - 4}
        width={8}
        height={8}
        fill={purple ? "var(--pv23-brand-purple)" : "var(--pv23-border-strong)"}
      />
    );
  }

  return (
    <motion.rect
      x={cx - 4}
      y={cy - 4}
      width={8}
      height={8}
      fill={purple ? "var(--pv23-brand-purple)" : "var(--pv23-border-strong)"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay }}
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

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv23-canvas)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* SVG signal streams -- left 50% */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <svg
          viewBox="0 0 960 540"
          width="50%"
          height="100%"
          style={{ position: "absolute", left: 0, top: 0 }}
          aria-hidden="true"
        >
          {/* Lines */}
          {SIGNAL_LINES.map((ln) => (
            <line
              key={ln.id}
              x1={ln.x1}
              y1={ln.y1}
              x2={ln.x2}
              y2={ln.y2}
              stroke="var(--pv23-border-strong)"
              strokeWidth={1}
            />
          ))}

          {/* Packets */}
          {SIGNAL_LINES.map((ln, li) =>
            PACKET_OFFSETS.map((t, pi) => (
              <PacketDot
                key={`${ln.id}-${pi}`}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                t={t}
                purple={pi === PACKET_OFFSETS.length - 1}
                exportMode={skipAnim}
                delay={li * 0.15 + pi * 0.1}
              />
            ))
          )}

          {/* "Now" card in centre (around 480,270) */}
          <rect
            x={390}
            y={210}
            width={180}
            height={120}
            fill="var(--pv23-surface)"
            stroke="var(--pv23-border)"
            strokeWidth={1}
          />
          {/* Purple top border on card */}
          <rect
            x={390}
            y={210}
            width={180}
            height={3}
            fill="var(--pv23-brand-purple)"
          />
          {/* "Now" label text */}
          <text
            x={480}
            y={236}
            textAnchor="middle"
            fill="var(--pv23-brand-purple)"
            fontFamily="Arial, sans-serif"
            fontSize={11}
            fontWeight={700}
            letterSpacing="0.06em"
          >
            NOW
          </text>
          {/* Work item text */}
          <text
            x={400}
            y={260}
            fill="var(--pv23-neutral-mid)"
            fontFamily="Arial, sans-serif"
            fontSize={9}
          >
            Quarterly RCSA review
          </text>
          <text
            x={400}
            y={274}
            fill="var(--pv23-neutral-mid)"
            fontFamily="Arial, sans-serif"
            fontSize={9}
          >
            ready for input
          </text>
        </svg>
      </div>

      {/* Now card overlay -- centred between SVG and text */}
      <div
        style={{
          position: "absolute",
          left: "46%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 180,
          background: "var(--pv23-surface)",
          border: "1px solid var(--pv23-border)",
          borderRadius: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ height: 3, background: "var(--pv23-brand-purple)" }} />
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <PresentationLabel color="var(--pv23-brand-purple)">Now</PresentationLabel>
          <PresentationMeta color="var(--pv23-neutral-mid)">
            Quarterly RCSA review ready for input
          </PresentationMeta>
        </div>
      </div>

      {/* Right side text */}
      <div
        style={{
          position: "absolute",
          right: "var(--pv23-20)",
          top: "50%",
          transform: "translateY(-50%)",
          width: "40%",
          display: "flex",
          flexDirection: "column",
          gap: "var(--pv23-8)",
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
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0, 0, 0.2, 1], delay: 0.3 + i * 0.35 }}
            >
              <PresentationStatement color="var(--pv23-text)">{line}</PresentationStatement>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}
