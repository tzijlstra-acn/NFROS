"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconUser } from "@tabler/icons-react";
import type { CoverData } from "../data/types";

type Props = {
  data: CoverData;
  title: string;
  subtitle: string;
  insight?: string;
  exportMode?: boolean;
};

// Full-bleed, drawn in slide pixels (1920 x 1080)
const W = 1920;
const H = 1080;
const CORE = { x: 1430, y: 470 };
const CORE_R = 92;
const PERSON = { x: 1430, y: 820 };
const PERSON_R = 44;

const BG = "linear-gradient(135deg, #1E0033 0%, #3A0063 42%, #6A00AD 100%)";
const LIGHT = "#CC66FF";

// Signals enter from the top and right edges, clear of the captions below the core
const SIGNAL_STARTS: Array<[number, number]> = [
  [1920, 60], [1920, 170], [1920, 280], [1920, 390], [1920, 500], [1920, 610], [1920, 700],
  [1080, 0], [1250, 0], [1450, 0], [1650, 0], [1820, 0],
];

function signalPath([sx, sy]: [number, number]): string {
  const dx = CORE.x - sx;
  const dy = CORE.y - sy;
  const len = Math.hypot(dx, dy);
  const ex = CORE.x - (dx / len) * (CORE_R + 6);
  const ey = CORE.y - (dy / len) * (CORE_R + 6);
  const c1x = sx + dx * 0.35;
  const c1y = sy + dy * 0.05;
  const c2x = ex - dx * 0.25;
  const c2y = ey - dy * 0.35;
  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;
}

export function CoverExhibit({ data, title, subtitle, insight, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const beamTop = CORE.y + CORE_R + 4;
  const beamBottom = PERSON.y - PERSON_R - 4;

  return (
    <div
      style={{ position: "absolute", inset: 0, background: BG, overflow: "hidden", fontFamily: "var(--pv24-font-family)" }}
      role="group"
      aria-label="Cover"
    >
      <svg aria-hidden="true" width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        <defs>
          <radialGradient id="pv24-cover-core" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#9C1FF2" />
            <stop offset="60%" stopColor="#7A00C8" />
            <stop offset="100%" stopColor="#4E0088" />
          </radialGradient>
          <filter id="pv24-cover-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
        </defs>

        {/* Orbits */}
        {[170, 250, 340].map((r, i) => (
          <circle key={r} cx={CORE.x} cy={CORE.y} r={r} fill="none" stroke="#FFFFFF" strokeOpacity={0.1 - i * 0.02} strokeWidth={1.5} strokeDasharray={i === 1 ? "4 10" : undefined} />
        ))}

        {/* Signals */}
        {SIGNAL_STARTS.map((start, i) => {
          const d = signalPath(start);
          return (
            <g key={i}>
              <motion.path
                d={d}
                fill="none"
                stroke={LIGHT}
                strokeOpacity={0.42}
                strokeWidth={1.6}
                initial={skip ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={skip ? undefined : { duration: 1.1, delay: 0.3 + i * 0.06, ease: "easeOut" }}
              />
              {!skip && (
                <circle r={4} fill="#FFFFFF" opacity={0}>
                  <animateMotion dur={`${2.6 + (i % 5) * 0.35}s`} begin={`${1.4 + (i % 7) * 0.33}s`} repeatCount="indefinite" path={d} />
                  <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.15;0.85;1" dur={`${2.6 + (i % 5) * 0.35}s`} begin={`${1.4 + (i % 7) * 0.33}s`} repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* Core */}
        <circle cx={CORE.x} cy={CORE.y} r={CORE_R + 30} fill="#A100FF" opacity={0.45} filter="url(#pv24-cover-glow)" />
        <motion.g
          initial={skip ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ transformOrigin: `${CORE.x}px ${CORE.y}px` }}
          transition={skip ? undefined : { duration: 0.7, delay: 0.9, ease: "backOut" }}
        >
          <circle cx={CORE.x} cy={CORE.y} r={CORE_R} fill="url(#pv24-cover-core)" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} />
          <text x={CORE.x} y={CORE.y - 4} textAnchor="middle" fontFamily="var(--pv24-font-family)" fontSize={30} fontWeight={700} fill="#FFFFFF">NFR OS</text>
          <text x={CORE.x} y={CORE.y + 28} textAnchor="middle" fontFamily="var(--pv24-font-family)" fontSize={16} letterSpacing={2} fill="#FFFFFF" fillOpacity={0.85}>ONE LAYER</text>
        </motion.g>
        {!skip && (
          <circle cx={CORE.x} cy={CORE.y} r={CORE_R} fill="none" stroke="#FFFFFF" strokeWidth={2}>
            <animate attributeName="r" values={`${CORE_R};${CORE_R + 46}`} dur="2.4s" begin="1.8s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.5;0" dur="2.4s" begin="1.8s" repeatCount="indefinite" />
          </circle>
        )}

        {/* One prepared decision travels to a person */}
        <motion.line
          x1={CORE.x}
          y1={beamTop}
          x2={CORE.x}
          y2={beamBottom}
          stroke="#FFFFFF"
          strokeWidth={4}
          strokeLinecap="round"
          initial={skip ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={skip ? undefined : { duration: 0.6, delay: 1.5 }}
        />
        {!skip && (
          <circle cx={CORE.x} r={8} fill={LIGHT}>
            <animate attributeName="cy" values={`${beamTop};${beamBottom}`} dur="1.6s" begin="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="1.6s" begin="2.2s" repeatCount="indefinite" />
          </circle>
        )}
        <motion.circle
          cx={PERSON.x}
          cy={PERSON.y}
          r={PERSON_R}
          fill="#FFFFFF"
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skip ? undefined : { duration: 0.4, delay: 2.0 }}
        />
      </svg>

      <motion.div
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.4, delay: 2.0 }}
        style={{ position: "absolute", left: PERSON.x - 22, top: PERSON.y - 22, width: 44, height: 44 }}
      >
        <IconUser size={44} color="#6A00AD" stroke={1.8} />
      </motion.div>
      <motion.div
        initial={skip ? false : { opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={skip ? undefined : { duration: 0.4, delay: 2.2 }}
        style={{ position: "absolute", left: PERSON.x + PERSON_R + 24, top: PERSON.y - 28, color: "#FFFFFF" }}
      >
        <div style={{ fontSize: 24, fontWeight: 700 }}>One prepared decision</div>
        <div style={{ fontSize: 20, opacity: 0.8 }}>Human judgment stays in charge</div>
      </motion.div>

      {/* Title block */}
      <motion.div
        initial={skip ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={skip ? undefined : { duration: 0.7, delay: 0.2, ease: "easeOut" }}
        style={{ position: "absolute", left: 120, top: 150, width: 900, color: "#FFFFFF" }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: LIGHT }}>
          {data.kicker}
        </div>
        <div style={{ width: 96, height: 6, background: LIGHT, margin: "28px 0 40px" }} />
        <h1 style={{ margin: 0, fontSize: 96, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.02em" }}>{title}</h1>
        <p style={{ margin: "36px 0 0", fontSize: 32, lineHeight: 1.35, color: "rgba(255,255,255,0.85)", maxWidth: 820 }}>{subtitle}</p>
        {insight && (
          <p style={{ margin: "28px 0 0", paddingLeft: 20, borderLeft: `4px solid ${LIGHT}`, fontSize: 24, lineHeight: 1.4, fontStyle: "italic", color: "#FFFFFF", maxWidth: 820 }}>
            {insight}
          </p>
        )}
      </motion.div>

      <motion.div
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.6, delay: 0.8 }}
        style={{ position: "absolute", left: 120, bottom: 110, display: "flex", alignItems: "stretch", gap: 28, color: "#FFFFFF" }}
      >
        <div style={{ width: 4, background: LIGHT }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.75 }}>Prepared by</div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{data.preparedBy}</div>
          <div style={{ fontSize: 24, opacity: 0.85 }}>{data.dateLabel}</div>
        </div>
      </motion.div>

      <div style={{ position: "absolute", right: 64, bottom: 44, fontSize: 16, color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>
        Synthetic institution and data
      </div>
    </div>
  );
}
