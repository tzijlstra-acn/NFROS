"use client";

import { motion, useReducedMotion } from "motion/react";
import type { EngagementLayerData } from "../data/types";

interface Props {
  data: EngagementLayerData;
  exportMode?: boolean;
}

const VW = 1920;
const VH = 1080;

const LAYER_X = 80;
const LAYER_W = VW - 160;
const LAYER_X_END = LAYER_X + LAYER_W;

const LAYERS = [
  { key: "role", label: "Role Operating Systems", y: 100, h: 120, bg: "var(--pv24-brand-purple)", textColor: "#fff", borderLeft: "none" },
  { key: "work", label: "Daily work | Role Apps | Decisions", y: 240, h: 140, bg: "var(--pv24-surface)", textColor: "var(--pv24-text)", borderLeft: "4px solid var(--pv24-accent)" },
  { key: "control", label: "Identity | Authority | Approval | Audit | Evaluation", y: 400, h: 120, bg: "var(--pv24-brand-purple-lightest)", textColor: "var(--pv24-brand-purple)", borderLeft: "none" },
  { key: "integration", label: "Systems of record", y: 540, h: 120, bg: "var(--pv24-muted-bg)", textColor: "var(--pv24-text-secondary)", borderLeft: "none" },
];

// Item path: packet travels upward through layers
const PACKET_X = 200;
const PATH_STEPS = [
  { x: PACKET_X, y: 600 },   // start inside integration layer
  { x: PACKET_X, y: 460 },   // through control layer
  { x: PACKET_X, y: 300 },   // through work layer
  { x: PACKET_X, y: 150 },   // reach role layer
  { x: 800, y: 150 },         // move right in role layer
];

export function EngagementLayerExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const { topLayer: _topLayer, systemsOfRecord, activeItemPath: _activeItemPath } = data;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--pv24-canvas)" }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">

        {/* Architecture layers */}
        {LAYERS.map((layer, i) => {
          const delay = i * 0.12;
          const content = (
            <g key={layer.key}>
              <rect
                x={LAYER_X}
                y={layer.y}
                width={LAYER_W}
                height={layer.h}
                fill={layer.bg}
                stroke="var(--pv24-border)"
                strokeWidth={1}
              />
              {layer.borderLeft !== "none" && (
                <rect x={LAYER_X} y={layer.y} width={4} height={layer.h} fill="var(--pv24-accent)" />
              )}
              <text
                x={LAYER_X + LAYER_W / 2}
                y={layer.y + layer.h / 2 + 8}
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontSize={22}
                fontWeight={layer.key === "role" ? 700 : 500}
                fill={layer.textColor}
              >
                {layer.label}
              </text>
            </g>
          );

          if (skip) return content;

          return (
            <motion.g
              key={layer.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay }}
            >
              {content}
            </motion.g>
          );
        })}

        {/* Systems of record labels below the integration layer */}
        {systemsOfRecord.map((label, i) => {
          const totalW = LAYER_W;
          const itemW = totalW / systemsOfRecord.length;
          const x = LAYER_X + i * itemW + itemW / 2;
          const y = 700;
          if (skip) {
            return (
              <text key={i} x={x} y={y} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={15} fill="var(--pv24-text-secondary)">{label}</text>
            );
          }
          return (
            <motion.text key={i} x={x} y={y} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={15} fill="var(--pv24-text-secondary)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.6 + i * 0.06 }}>
              {label}
            </motion.text>
          );
        })}

        {/* Path line showing work item journey */}
        {(() => {
          if (PATH_STEPS.length < 2) return null;
          const pathD = PATH_STEPS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          if (skip) {
            return (
              <g>
                <path d={pathD} fill="none" stroke="var(--pv24-accent)" strokeWidth={2} strokeDasharray="8 4" opacity={0.6} />
                <circle cx={PATH_STEPS[PATH_STEPS.length - 1]!.x} cy={PATH_STEPS[PATH_STEPS.length - 1]!.y} r={10} fill="var(--pv24-accent)" />
              </g>
            );
          }
          // Animate the packet traveling the path
          const len = PATH_STEPS.reduce((acc, p, i) => {
            if (i === 0) return 0;
            const prev = PATH_STEPS[i - 1]!;
            return acc + Math.hypot(p.x - prev.x, p.y - prev.y);
          }, 0);

          return (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.3 }}>
              <path d={pathD} fill="none" stroke="var(--pv24-accent)" strokeWidth={2} strokeDasharray={len} strokeDashoffset={len}
                style={{ animation: "none" }} />
              <motion.path
                d={pathD}
                fill="none"
                stroke="var(--pv24-accent)"
                strokeWidth={2}
                strokeDasharray={`${len}`}
                initial={{ strokeDashoffset: len }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1.2, delay: 0.9, ease: "linear" }}
              />
              <motion.circle
                cx={PATH_STEPS[0]!.x}
                cy={PATH_STEPS[0]!.y}
                r={10}
                fill="var(--pv24-accent)"
                animate={{
                  cx: PATH_STEPS.map((p) => p.x),
                  cy: PATH_STEPS.map((p) => p.y),
                }}
                transition={{ duration: 1.2, delay: 0.9, ease: "linear" }}
              />
            </motion.g>
          );
        })()}

        {/* Path step labels */}
        {_activeItemPath.map((label, i) => {
          // Position labels at each path step
          const step = PATH_STEPS[i];
          if (!step) return null;
          const labelX = step.x + 20;
          const labelY = step.y - 16;
          if (skip) {
            return <text key={i} x={labelX} y={labelY} fontFamily="IBM Plex Mono, monospace" fontSize={13} fill="var(--pv24-accent)">{label}</text>;
          }
          return (
            <motion.text key={i} x={labelX} y={labelY} fontFamily="IBM Plex Mono, monospace" fontSize={13} fill="var(--pv24-accent)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 + i * 0.15, duration: 0.3 }}>
              {label}
            </motion.text>
          );
        })}
      </svg>
    </div>
  );
}
