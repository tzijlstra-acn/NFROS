"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CapacityConvergenceData } from "../data/types";

type Props = {
  data: CapacityConvergenceData;
  exportMode?: boolean;
};

const VW = 1920;
const VH = 1080;

// Signal column
const SIG_X = 200;
const SIG_SIZE = 60;
const SIG_Y_START = 280;
const SIG_Y_END = 800;
const SIG_COUNT = 6;

// Bottleneck
const BN_X = 700;
const BN_Y = 540;
const BN_SIZE = 80;

// OS layer
const OS_X1 = 680;
const OS_X2 = 1120;
const OS_CY = 540;
const OS_H = 160;

// Decision node
const DEC_X = 1200;
const DEC_Y = 540;
const DEC_W = 120;
const DEC_H = 80;

// Judgment zone (HTML overlay)
const JZ_X1 = 1400;
const JZ_X2 = 1760;
const JZ_Y1 = 380;
const JZ_Y2 = 700;

// Packet
const PKT = 14;

function sigY(i: number): number {
  return SIG_Y_START + i * ((SIG_Y_END - SIG_Y_START) / (SIG_COUNT - 1));
}

type PacketProps = {
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  delay: number;
};

function AnimatedPacket({ sx, sy, dx, dy, delay }: PacketProps) {
  return (
    <motion.rect
      role="presentation"
      x={sx - PKT / 2}
      y={sy - PKT / 2}
      width={PKT}
      height={PKT}
      fill="var(--pv24-brand-purple)"
      initial={{ opacity: 0, x: 0, y: 0 }}
      animate={{ opacity: [0, 0.9, 0.9, 0], x: [0, dx - sx], y: [0, dy - sy] }}
      transition={{ duration: 1.6, delay, repeat: Infinity, repeatDelay: 0.6, ease: "linear" }}
    />
  );
}

export function CapacityConvergenceExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const bnHalf = BN_SIZE / 2;
  const osY1 = OS_CY - OS_H / 2;
  const osCX = (OS_X1 + OS_X2) / 2;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        overflow: "hidden",
        fontFamily: "var(--pv24-font-family)",
      }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        role="presentation"
        aria-hidden="true"
      >
        {/* OS layer — rendered first, sits behind other nodes */}
        {skip ? (
          <rect
            x={OS_X1}
            y={osY1}
            width={OS_X2 - OS_X1}
            height={OS_H}
            fill="var(--pv24-brand-purple-lightest)"
            stroke="var(--pv24-brand-purple)"
            strokeWidth={2}
          />
        ) : (
          <motion.rect
            x={OS_X1}
            y={osY1}
            width={OS_X2 - OS_X1}
            height={OS_H}
            fill="var(--pv24-brand-purple-lightest)"
            stroke="var(--pv24-brand-purple)"
            strokeWidth={2}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
          />
        )}

        {/* OS stage label */}
        {skip ? (
          <text
            x={osCX}
            y={OS_CY + 38}
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontSize={18}
            fontWeight={700}
            fill="var(--pv24-brand-purple)"
          >
            {data.osStageName}
          </text>
        ) : (
          <motion.text
            x={osCX}
            y={OS_CY + 38}
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontSize={18}
            fontWeight={700}
            fill="var(--pv24-brand-purple)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.4 }}
          >
            {data.osStageName}
          </motion.text>
        )}

        {/* Flow lines: signal → bottleneck */}
        {Array.from({ length: SIG_COUNT }, (_, i) => {
          const sy = sigY(i);
          const x1 = SIG_X + SIG_SIZE / 2;
          const x2 = BN_X - bnHalf;
          const len = Math.sqrt((x2 - x1) ** 2 + (BN_Y - sy) ** 2);
          const delay = 0.5 + i * 0.08;

          if (skip) {
            return (
              <line
                key={`fl-${i}`}
                x1={x1} y1={sy} x2={x2} y2={BN_Y}
                stroke="var(--pv24-border)"
                strokeWidth={1.5}
              />
            );
          }
          return (
            <motion.line
              key={`fl-${i}`}
              x1={x1} y1={sy} x2={x2} y2={BN_Y}
              stroke="var(--pv24-border)"
              strokeWidth={1.5}
              strokeDasharray={len}
              strokeDashoffset={len}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay }}
            />
          );
        })}

        {/* Arrow: bottleneck → decision */}
        <line
          x1={BN_X + bnHalf}
          y1={BN_Y}
          x2={DEC_X - DEC_W / 2}
          y2={DEC_Y}
          stroke="var(--pv24-border-strong)"
          strokeWidth={2}
        />

        {/* Arrow: decision → judgment zone */}
        <line
          x1={DEC_X + DEC_W / 2}
          y1={DEC_Y}
          x2={JZ_X1}
          y2={(JZ_Y1 + JZ_Y2) / 2}
          stroke="var(--pv24-border-strong)"
          strokeWidth={2}
        />

        {/* Packet animations */}
        {!skip &&
          Array.from({ length: SIG_COUNT }, (_, i) => (
            <AnimatedPacket
              key={`pkt-${i}`}
              sx={SIG_X + SIG_SIZE / 2}
              sy={sigY(i)}
              dx={BN_X - bnHalf}
              dy={BN_Y}
              delay={1.6 + i * 0.28}
            />
          ))}

        {/* Signal nodes */}
        {Array.from({ length: SIG_COUNT }, (_, i) => {
          const sy = sigY(i);
          const half = SIG_SIZE / 2;
          const label = data.sources[i] ?? "";
          const delay = i * 0.1;

          if (skip) {
            return (
              <g key={`sn-${i}`}>
                <rect
                  x={SIG_X - half}
                  y={sy - half}
                  width={SIG_SIZE}
                  height={SIG_SIZE}
                  fill="var(--pv24-surface)"
                  stroke="var(--pv24-border-strong)"
                  strokeWidth={2}
                />
                <text
                  x={SIG_X}
                  y={sy - half - 10}
                  textAnchor="middle"
                  fontFamily="Arial, sans-serif"
                  fontSize={15}
                  fill="var(--pv24-text-secondary)"
                >
                  {label}
                </text>
              </g>
            );
          }
          return (
            <motion.g
              key={`sn-${i}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: [0, 0, 0.2, 1], delay }}
            >
              <rect
                x={SIG_X - half}
                y={sy - half}
                width={SIG_SIZE}
                height={SIG_SIZE}
                fill="var(--pv24-surface)"
                stroke="var(--pv24-border-strong)"
                strokeWidth={2}
              />
              <text
                x={SIG_X}
                y={sy - half - 10}
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontSize={15}
                fill="var(--pv24-text-secondary)"
              >
                {label}
              </text>
            </motion.g>
          );
        })}

        {/* Bottleneck node */}
        {skip ? (
          <g>
            <rect
              x={BN_X - bnHalf}
              y={BN_Y - bnHalf}
              width={BN_SIZE}
              height={BN_SIZE}
              fill="var(--pv24-surface)"
              stroke="var(--pv24-border-strong)"
              strokeWidth={3}
            />
            <text
              x={BN_X}
              y={BN_Y + 6}
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize={13}
              fill="var(--pv24-text-secondary)"
            >
              {data.bottleneckLabel}
            </text>
          </g>
        ) : (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.0 }}
          >
            {/* Pulse ring */}
            <motion.rect
              x={BN_X - bnHalf - 8}
              y={BN_Y - bnHalf - 8}
              width={BN_SIZE + 16}
              height={BN_SIZE + 16}
              fill="none"
              stroke="var(--pv24-brand-purple)"
              strokeWidth={2}
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 1.8, delay: 1.5, repeat: Infinity }}
            />
            <rect
              x={BN_X - bnHalf}
              y={BN_Y - bnHalf}
              width={BN_SIZE}
              height={BN_SIZE}
              fill="var(--pv24-surface)"
              stroke="var(--pv24-border-strong)"
              strokeWidth={3}
            />
            <text
              x={BN_X}
              y={BN_Y + 6}
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize={13}
              fill="var(--pv24-text-secondary)"
            >
              {data.bottleneckLabel}
            </text>
          </motion.g>
        )}

        {/* Decision node */}
        {skip ? (
          <g>
            <rect
              x={DEC_X - DEC_W / 2}
              y={DEC_Y - DEC_H / 2}
              width={DEC_W}
              height={DEC_H}
              fill="var(--pv24-brand-purple)"
            />
            <text
              x={DEC_X}
              y={DEC_Y + 6}
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize={14}
              fontWeight={600}
              fill="#ffffff"
            >
              {data.decisionLabel}
            </text>
          </g>
        ) : (
          <motion.g
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay: 1.8 }}
          >
            <rect
              x={DEC_X - DEC_W / 2}
              y={DEC_Y - DEC_H / 2}
              width={DEC_W}
              height={DEC_H}
              fill="var(--pv24-brand-purple)"
            />
            <text
              x={DEC_X}
              y={DEC_Y + 6}
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              fontSize={14}
              fontWeight={600}
              fill="#ffffff"
            >
              {data.decisionLabel}
            </text>
          </motion.g>
        )}
      </svg>

      {/* Human judgment zone — HTML for flexible text layout */}
      {skip ? (
        <div
          aria-label={data.judgmentLabel}
          style={{
            position: "absolute",
            left: `${(JZ_X1 / VW) * 100}%`,
            top: `${(JZ_Y1 / VH) * 100}%`,
            width: `${((JZ_X2 - JZ_X1) / VW) * 100}%`,
            height: `${((JZ_Y2 - JZ_Y1) / VH) * 100}%`,
            background: "var(--pv24-surface)",
            borderLeft: "6px solid var(--pv24-brand-purple)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "0 40px",
            boxSizing: "border-box",
          }}
        >
          <span
            style={{
              fontSize: "var(--pv24-exhibit-title-size)",
              fontWeight: 700,
              color: "var(--pv24-text)",
            }}
          >
            {data.judgmentLabel}
          </span>
        </div>
      ) : (
        <motion.div
          aria-label={data.judgmentLabel}
          style={{
            position: "absolute",
            left: `${(JZ_X1 / VW) * 100}%`,
            top: `${(JZ_Y1 / VH) * 100}%`,
            width: `${((JZ_X2 - JZ_X1) / VW) * 100}%`,
            height: `${((JZ_Y2 - JZ_Y1) / VH) * 100}%`,
            background: "var(--pv24-surface)",
            borderLeft: "6px solid var(--pv24-brand-purple)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "0 40px",
            boxSizing: "border-box",
            transformOrigin: "left center",
          }}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5, ease: [0, 0, 0.2, 1], delay: 2.2 }}
        >
          <span
            style={{
              fontSize: "var(--pv24-exhibit-title-size)",
              fontWeight: 700,
              color: "var(--pv24-text)",
            }}
          >
            {data.judgmentLabel}
          </span>
        </motion.div>
      )}
    </div>
  );
}
