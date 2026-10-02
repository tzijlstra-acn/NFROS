"use client";

import { motion, useReducedMotion } from "motion/react";
import type { FrictionCausalChainData } from "../data/types";

interface Props {
  data: FrictionCausalChainData;
  exportMode?: boolean;
}

const VW = 1920;

const CHAIN_Y = 260;
const CHAIN_NODE_W = 260;
const CHAIN_NODE_H = 80;
const CHAIN_SPACING = 120;

const BAND_Y_START = 440;
const BAND_H = 68;
const BAND_GAP = 12;
const BAND_X = 80;
const BAND_W = 1480;

const IMP_X = 1600;
const IMP_SPACING = 76;

// Chain node x positions
function chainX(i: number, count: number) {
  const totalW = count * CHAIN_NODE_W + (count - 1) * CHAIN_SPACING;
  const startX = (VW - totalW) / 2;
  return startX + i * (CHAIN_NODE_W + CHAIN_SPACING);
}

export function FrictionCausalChainExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const { chainNodes, frictionBands, implications, feedbackLabel } = data;

  const BAND_SHADES = ["#F5F6F8", "#EAECF0", "#D0D5DD", "#98A2B3"];
  const BAND_TEXT_COLORS = ["var(--pv24-text)", "var(--pv24-text)", "var(--pv24-text)", "var(--pv24-surface)"];

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--pv24-canvas)" }}>
      <svg viewBox={`0 0 ${VW} 1080`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">

        {/* Chain nodes */}
        {chainNodes.map((label, i) => {
          const x = chainX(i, chainNodes.length);
          const cy = CHAIN_Y + CHAIN_NODE_H / 2;
          const node = (
            <g key={i}>
              <rect x={x} y={CHAIN_Y} width={CHAIN_NODE_W} height={CHAIN_NODE_H} fill="var(--pv24-surface)" stroke="var(--pv24-border-strong)" strokeWidth={2} />
              <text x={x + CHAIN_NODE_W / 2} y={cy + 6} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={18} fontWeight={600} fill="var(--pv24-text)">{label}</text>
              {/* Right arrow between nodes */}
              {i < chainNodes.length - 1 && (
                <g>
                  <line x1={x + CHAIN_NODE_W + 4} y1={cy} x2={x + CHAIN_NODE_W + CHAIN_SPACING - 4} y2={cy} stroke="var(--pv24-accent)" strokeWidth={2} />
                  <polygon points={`${x + CHAIN_NODE_W + CHAIN_SPACING - 4},${cy - 8} ${x + CHAIN_NODE_W + CHAIN_SPACING + 12},${cy} ${x + CHAIN_NODE_W + CHAIN_SPACING - 4},${cy + 8}`} fill="var(--pv24-accent)" />
                </g>
              )}
            </g>
          );
          if (skip) return node;
          return (
            <motion.g key={i} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 + i * 0.12 }}>
              {node}
            </motion.g>
          );
        })}

        {/* Friction bands */}
        {frictionBands.map((label, i) => {
          const y = BAND_Y_START + i * (BAND_H + BAND_GAP);
          const fill = BAND_SHADES[i] ?? "#F5F6F8";
          const textColor = BAND_TEXT_COLORS[i] ?? "var(--pv24-text)";
          const band = (
            <g key={i}>
              <rect x={BAND_X} y={y} width={BAND_W} height={BAND_H} fill={fill} stroke="var(--pv24-border)" strokeWidth={1} />
              <text x={BAND_X + 24} y={y + BAND_H / 2 + 6} fontFamily="IBM Plex Mono, monospace" fontSize={16} fontWeight={600} fill={textColor}>{label}</text>
            </g>
          );
          if (skip) return band;
          return (
            <motion.g key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.5 + i * 0.1 }}>
              {band}
            </motion.g>
          );
        })}

        {/* Implication labels on right */}
        {implications.map((label, i) => {
          const y = BAND_Y_START + i * (BAND_H + BAND_GAP) + BAND_H / 2;
          const el = (
            <g key={i}>
              <text x={IMP_X} y={y + 6} fontFamily="Arial, sans-serif" fontSize={16} fill="var(--pv24-accent)" fontStyle="italic">{`+ ${label}`}</text>
            </g>
          );
          if (skip) return el;
          return (
            <motion.g key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.7 + i * 0.1 }}>
              {el}
            </motion.g>
          );
        })}

        {/* Feedback arc at bottom */}
        {(() => {
          const firstX = chainX(0, chainNodes.length) + CHAIN_NODE_W / 2;
          const lastX = chainX(chainNodes.length - 1, chainNodes.length) + CHAIN_NODE_W / 2;
          const arcY = 860;
          const d = `M ${lastX} ${CHAIN_Y + CHAIN_NODE_H} Q ${(firstX + lastX) / 2} ${arcY}, ${firstX} ${CHAIN_Y + CHAIN_NODE_H}`;
          const midLabelX = (firstX + lastX) / 2;
          if (skip) {
            return (
              <g>
                <path d={d} fill="none" stroke="var(--pv24-accent)" strokeWidth={1.5} strokeDasharray="6 4" />
                <text x={midLabelX} y={arcY + 24} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={14} fill="var(--pv24-accent)">{feedbackLabel}</text>
              </g>
            );
          }
          return (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.1 }}>
              <path d={d} fill="none" stroke="var(--pv24-accent)" strokeWidth={1.5} strokeDasharray="6 4" />
              <text x={midLabelX} y={arcY + 24} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={14} fill="var(--pv24-accent)">{feedbackLabel}</text>
            </motion.g>
          );
        })()}
      </svg>
    </div>
  );
}
