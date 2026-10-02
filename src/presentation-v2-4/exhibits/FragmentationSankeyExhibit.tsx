"use client";

import { motion, useReducedMotion } from "motion/react";
import type { FragmentationSankeyData } from "../data/types";

interface Props {
  data: FragmentationSankeyData;
  exportMode?: boolean;
}

const VW = 1920;
const VH = 1080;

const SRC_X = 120;
const SRC_NODE_W = 220;
const SRC_NODE_H = 72;

const ACT_X = 900;
const ACT_NODE_W = 200;
const ACT_NODE_H = 64;

const OUT_X = 1680;
const OUT_NODE_W = 180;
const OUT_NODE_H = 100;

function srcY(i: number, count: number) {
  const span = 640;
  const startY = (VH - span) / 2;
  return startY + i * (span / Math.max(count - 1, 1));
}

function actY(i: number, count: number) {
  const span = 480;
  const startY = (VH - span) / 2;
  return startY + i * (span / Math.max(count - 1, 1));
}

export function FragmentationSankeyExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const { sources, activities, outcomeLabel, evidenceNote } = data;

  const outCY = VH / 2;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--pv24-canvas)" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* Flow paths: each source fans to each activity */}
        {sources.map((_, si) => {
          const sy = srcY(si, sources.length);
          return activities.map((_, ai) => {
            const ay = actY(ai, activities.length);
            const sx1 = SRC_X + SRC_NODE_W;
            const sx2 = ACT_X;
            const midX = (sx1 + sx2) / 2;
            const d = `M ${sx1} ${sy} C ${midX} ${sy}, ${midX} ${ay}, ${sx2} ${ay}`;
            if (skip) {
              return <path key={`src-${si}-act-${ai}`} d={d} stroke="var(--pv24-border-strong)" strokeWidth={1.5} fill="none" opacity={0.35} />;
            }
            return (
              <motion.path
                key={`src-${si}-act-${ai}`}
                d={d}
                stroke="var(--pv24-border-strong)"
                strokeWidth={1.5}
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                transition={{ duration: 0.4, delay: 0.3 + si * 0.07 + ai * 0.03 }}
              />
            );
          });
        })}

        {/* Activity to outcome paths */}
        {activities.map((_, ai) => {
          const ay = actY(ai, activities.length);
          const ax1 = ACT_X + ACT_NODE_W;
          const ox = OUT_X;
          const midX = (ax1 + ox) / 2;
          const d = `M ${ax1} ${ay} C ${midX} ${ay}, ${midX} ${outCY}, ${ox} ${outCY}`;
          if (skip) {
            return <path key={`act-${ai}-out`} d={d} stroke="var(--pv24-brand-purple)" strokeWidth={2.5} fill="none" opacity={0.45} />;
          }
          return (
            <motion.path
              key={`act-${ai}-out`}
              d={d}
              stroke="var(--pv24-brand-purple)"
              strokeWidth={2.5}
              fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              transition={{ duration: 0.5, delay: 0.7 + ai * 0.08 }}
            />
          );
        })}

        {/* Source nodes */}
        {sources.map((label, i) => {
          const cy = srcY(i, sources.length);
          const ny = cy - SRC_NODE_H / 2;
          const content = (
            <g key={i}>
              <rect x={SRC_X} y={ny} width={SRC_NODE_W} height={SRC_NODE_H} fill="var(--pv24-surface)" stroke="var(--pv24-border)" strokeWidth={1} />
              <text x={SRC_X + SRC_NODE_W / 2} y={cy + 6} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={18} fill="var(--pv24-text-secondary)">{label}</text>
            </g>
          );
          if (skip) return content;
          return (
            <motion.g key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}>
              <rect x={SRC_X} y={ny} width={SRC_NODE_W} height={SRC_NODE_H} fill="var(--pv24-surface)" stroke="var(--pv24-border)" strokeWidth={1} />
              <text x={SRC_X + SRC_NODE_W / 2} y={cy + 6} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={18} fill="var(--pv24-text-secondary)">{label}</text>
            </motion.g>
          );
        })}

        {/* Activity nodes */}
        {activities.map((label, i) => {
          const cy = actY(i, activities.length);
          const ny = cy - ACT_NODE_H / 2;
          const content = (
            <g key={i}>
              <rect x={ACT_X} y={ny} width={ACT_NODE_W} height={ACT_NODE_H} fill="var(--pv24-muted-bg)" stroke="var(--pv24-border-strong)" strokeWidth={1.5} />
              <text x={ACT_X + ACT_NODE_W / 2} y={cy + 6} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={18} fontWeight={600} fill="var(--pv24-text)">{label}</text>
            </g>
          );
          if (skip) return content;
          return (
            <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.5 + i * 0.1 }}>
              <rect x={ACT_X} y={ny} width={ACT_NODE_W} height={ACT_NODE_H} fill="var(--pv24-muted-bg)" stroke="var(--pv24-border-strong)" strokeWidth={1.5} />
              <text x={ACT_X + ACT_NODE_W / 2} y={cy + 6} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={18} fontWeight={600} fill="var(--pv24-text)">{label}</text>
            </motion.g>
          );
        })}

        {/* Outcome node */}
        {skip ? (
          <g>
            <rect x={OUT_X} y={outCY - OUT_NODE_H / 2} width={OUT_NODE_W} height={OUT_NODE_H} fill="var(--pv24-brand-purple-lightest)" stroke="var(--pv24-brand-purple)" strokeWidth={2} />
            <text x={OUT_X + OUT_NODE_W / 2} y={outCY + 8} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={22} fontWeight={700} fill="var(--pv24-brand-purple)">{outcomeLabel}</text>
          </g>
        ) : (
          <motion.g initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 1.1 }}>
            <rect x={OUT_X} y={outCY - OUT_NODE_H / 2} width={OUT_NODE_W} height={OUT_NODE_H} fill="var(--pv24-brand-purple-lightest)" stroke="var(--pv24-brand-purple)" strokeWidth={2} />
            <text x={OUT_X + OUT_NODE_W / 2} y={outCY + 8} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={22} fontWeight={700} fill="var(--pv24-brand-purple)">{outcomeLabel}</text>
          </motion.g>
        )}

        {/* Evidence note */}
        <text x={OUT_X + OUT_NODE_W} y={VH - 40} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize={14} fill="var(--pv24-text-secondary)">{evidenceNote}</text>
      </svg>
    </div>
  );
}
