"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import { PresentationStatement, PresentationLabel, PresentationMeta } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

const SOURCE_NODES = [
  "Mail",
  "Meetings",
  "Documents",
  "GRC",
  "Data",
  "Actions",
] as const;

const VB_W = 1920;
const VB_H = 1080;
const SRC_X = 200;
const SRC_NODE_W = 160;
const SRC_NODE_H = 52;
const PERSON_X = 760;
const PERSON_Y = 490;
const PERSON_W = 120;
const PERSON_H = 100;
const DEC_X = 1300;
const DEC_Y = 500;
const DEC_W = 160;
const DEC_H = 80;

function srcNodeY(i: number) {
  const total = SOURCE_NODES.length;
  const span = 720;
  const startY = (VB_H - span) / 2;
  return startY + i * (span / (total - 1));
}

function PacketOnLine({
  x1,
  y1,
  x2,
  y2,
  delay,
  exportMode,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
  exportMode: boolean;
}) {
  const t = 0.5;
  const px = x1 + (x2 - x1) * t;
  const py = y1 + (y2 - y1) * t;

  if (exportMode) {
    return (
      <rect
        x={px - 4}
        y={py - 4}
        width={8}
        height={8}
        fill="var(--pv23-brand-purple)"
        opacity={0.7}
      />
    );
  }

  return (
    <motion.rect
      x={px - 4}
      y={py - 4}
      width={8}
      height={8}
      fill="var(--pv23-brand-purple)"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.8, 0] }}
      transition={{ duration: 1.4, delay, repeat: Infinity, repeatDelay: 1 }}
    />
  );
}

export function FragmentationFlowSlide({ slide, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const sourceLabels = (slide.bullets as string[] | undefined) ?? [...SOURCE_NODES];
  const emphasis = slide.emphasis ?? [
    "The first task is often assembly.",
    "Not risk judgment.",
  ];

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
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {SOURCE_NODES.map((_, i) => {
          const sy = srcNodeY(i) + SRC_NODE_H / 2;
          const sx = SRC_X + SRC_NODE_W;
          const ex = PERSON_X;
          const ey = PERSON_Y + PERSON_H / 2;
          return (
            <line
              key={i}
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke="var(--pv23-border-strong)"
              strokeWidth={1}
            />
          );
        })}

        <line
          x1={PERSON_X + PERSON_W}
          y1={PERSON_Y + PERSON_H / 2}
          x2={DEC_X}
          y2={DEC_Y + DEC_H / 2}
          stroke="var(--pv23-border-strong)"
          strokeWidth={1.5}
        />

        {SOURCE_NODES.map((_, i) => {
          const sy = srcNodeY(i) + SRC_NODE_H / 2;
          const sx = SRC_X + SRC_NODE_W;
          const ex = PERSON_X;
          const ey = PERSON_Y + PERSON_H / 2;
          return (
            <PacketOnLine
              key={i}
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              delay={i * 0.22}
              exportMode={skipAnim}
            />
          );
        })}

        {SOURCE_NODES.map((label, i) => {
          const ny = srcNodeY(i) - SRC_NODE_H / 2;
          return (
            <g key={label}>
              <rect
                x={SRC_X}
                y={ny}
                width={SRC_NODE_W}
                height={SRC_NODE_H}
                fill="var(--pv23-surface)"
                stroke="var(--pv23-border)"
                strokeWidth={1}
              />
              <foreignObject x={SRC_X} y={ny} width={SRC_NODE_W} height={SRC_NODE_H}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PresentationMeta color="var(--pv23-text-secondary)">
                    {sourceLabels[i] ?? label}
                  </PresentationMeta>
                </div>
              </foreignObject>
            </g>
          );
        })}

        <rect
          x={PERSON_X}
          y={PERSON_Y}
          width={PERSON_W}
          height={PERSON_H}
          fill="var(--pv23-surface)"
          stroke="var(--pv23-border-strong)"
          strokeWidth={1.5}
        />
        <foreignObject x={PERSON_X} y={PERSON_Y} width={PERSON_W} height={PERSON_H}>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <PresentationLabel color="var(--pv23-text)">Risk</PresentationLabel>
            <PresentationLabel color="var(--pv23-text)">professional</PresentationLabel>
          </div>
        </foreignObject>

        <rect
          x={DEC_X}
          y={DEC_Y}
          width={DEC_W}
          height={DEC_H}
          fill="var(--pv23-brand-purple-lightest)"
          stroke="var(--pv23-brand-purple)"
          strokeWidth={1.5}
        />
        <foreignObject x={DEC_X} y={DEC_Y} width={DEC_W} height={DEC_H}>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PresentationLabel color="var(--pv23-brand-purple)">Decision</PresentationLabel>
          </div>
        </foreignObject>

        <foreignObject
          x={PERSON_X - 100}
          y={PERSON_Y + PERSON_H + 40}
          width={PERSON_W + 200}
          height={160}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              textAlign: "center",
            }}
          >
            {emphasis.map((line, i) => (
              <PresentationStatement
                key={i}
                color={i === 1 ? "var(--pv23-neutral-mid)" : "var(--pv23-text)"}
              >
                {line}
              </PresentationStatement>
            ))}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}
