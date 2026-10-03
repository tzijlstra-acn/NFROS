"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconShieldCheck,
  IconScale,
  IconUsers,
  IconBriefcase,
} from "@tabler/icons-react";
import type { RoleArchData } from "@/presentation-v2-4/data/types";

export interface RoleArchitectureExhibitProps {
  data: RoleArchData;
  exportMode?: boolean;
}

// ---------------------------------------------------------------------------
// Virtual canvas constants
// ---------------------------------------------------------------------------
const VW = 1920;
const VH = 1080;

// Hub
const CX = 960;
const CY = 540;
const HUB_R = 120;

// Capability ring
const CAP_R = 52;
const CAP_DIST = 240;

// Role pod geometry (virtual px)
const POD_W = 360;
const POD_H = 268;
const GHOST_W = 312;
const GHOST_H = 96;

// Distance from canvas centre to pod near edge
const POD_EDGE_DIST = 450;

// Pods sit above the hub's horizontal so their connectors clear the capability ring
const POD_LIFT = 70;

// Left pod: right edge at CX - POD_EDGE_DIST = 510
const L_LEFT = CX - POD_EDGE_DIST - POD_W; // 150
const L_TOP = CY - POD_H / 2 - POD_LIFT;   // 336

// Right pod: left edge at CX + POD_EDGE_DIST = 1410
const R_LEFT = CX + POD_EDGE_DIST;         // 1410
const R_TOP = CY - POD_H / 2 - POD_LIFT;   // 336

// Ghost pod: centred below hub
const G_LEFT = CX - GHOST_W / 2;          // 804
const G_TOP = CY + 360;                   // 900

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function pct(v: number, total: number): string {
  return `${((v / total) * 100).toFixed(3)}%`;
}

function capPos(i: number, n: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return {
    x: CX + CAP_DIST * Math.cos(angle),
    y: CY + CAP_DIST * Math.sin(angle),
  };
}

// ---------------------------------------------------------------------------
// SVG line components
// ---------------------------------------------------------------------------
interface SolidLineProps {
  x2: number;
  y2: number;
  delay: number;
  skip: boolean;
}

function SolidLine({ x2, y2, delay, skip }: SolidLineProps) {
  const len = Math.hypot(x2 - CX, y2 - CY);
  return (
    <motion.line
      x1={CX}
      y1={CY}
      x2={x2}
      y2={y2}
      stroke="var(--pv24-brand-purple)"
      strokeWidth={2}
      strokeOpacity={0.45}
      strokeDasharray={len}
      initial={skip ? false : { strokeDashoffset: len }}
      animate={{ strokeDashoffset: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
    />
  );
}

interface DashedLineProps {
  x2: number;
  y2: number;
  delay: number;
  skip: boolean;
}

function DashedLine({ x2, y2, delay, skip }: DashedLineProps) {
  const len = Math.hypot(x2 - CX, y2 - CY);
  // Round to nearest 14 (8+6 period) so dashes reveal cleanly
  const offset = Math.ceil(len / 14) * 14 + 14;
  return (
    <motion.line
      x1={CX}
      y1={CY}
      x2={x2}
      y2={y2}
      stroke="var(--pv24-accent)"
      strokeWidth={1.5}
      strokeDasharray="8 6"
      initial={skip ? false : { strokeDashoffset: offset }}
      animate={{ strokeDashoffset: 0 }}
      transition={{ duration: 0.75, ease: "easeOut", delay }}
    />
  );
}

// ---------------------------------------------------------------------------
// Capability node (SVG group)
// ---------------------------------------------------------------------------
interface CapNodeProps {
  label: string;
  x: number;
  y: number;
  delay: number;
  skip: boolean;
}

function CapNode({ label, x, y, delay, skip }: CapNodeProps) {
  const words = label.split(" ");
  const lineH = 18;
  const baseY = y - ((words.length - 1) * lineH) / 2;

  return (
    <motion.g
      style={{ transformOrigin: `${x}px ${y}px` }}
      initial={skip ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35, ease: "backOut", delay }}
    >
      <circle
        cx={x}
        cy={y}
        r={CAP_R}
        fill="var(--pv24-surface)"
        stroke="var(--pv24-brand-purple)"
        strokeWidth={2}
      />
      {words.map((word, wi) => (
        <text
          key={wi}
          x={x}
          y={baseY + wi * lineH}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={15}
          fontWeight={600}
          style={{ fill: "var(--pv24-text)", fontFamily: "var(--pv24-font-family)" }}
        >
          {word}
        </text>
      ))}
    </motion.g>
  );
}

// ---------------------------------------------------------------------------
// Role pod (HTML overlay)
// ---------------------------------------------------------------------------
type TablerIcon = React.ComponentType<{
  style?: React.CSSProperties;
  size?: number | string;
}>;

interface RolePodProps {
  title: string;
  subtitle: string;
  judgments: string[];
  Icon: TablerIcon;
  left: number;
  top: number;
  width: number;
  height: number;
  originX: string;
  expandDelay: number;
  itemDelay: number;
  slideDir: number; // -1 = from right, +1 = from left (for bullet slide-in)
  skip: boolean;
}

function RolePod({
  title,
  subtitle,
  judgments,
  Icon,
  left,
  top,
  width,
  height,
  originX,
  expandDelay,
  itemDelay,
  slideDir,
  skip,
}: RolePodProps) {
  return (
    <motion.div
      initial={skip ? false : { scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: expandDelay }}
      style={{
        position: "absolute",
        left: pct(left, VW),
        top: pct(top, VH),
        width: pct(width, VW),
        height: pct(height, VH),
        background: "var(--pv24-surface)",
        border: "1.5px solid var(--pv24-brand-purple)",
        borderRadius: 6,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        transformOrigin: originX,
        overflow: "hidden",
        fontFamily: "var(--pv24-font-family)",
        boxSizing: "border-box",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <Icon
          style={{
            width: "7%",
            height: "auto",
            aspectRatio: "1",
            flexShrink: 0,
            color: "var(--pv24-brand-purple)",
            marginTop: 2,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 20,
              color: "var(--pv24-text)",
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 15,
              color: "var(--pv24-text-secondary)",
              marginTop: 3,
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--pv24-border)", marginBottom: 10 }} />

      {/* Section label */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--pv24-accent)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 8,
        }}
      >
        Role judgments
      </div>

      {/* Judgments */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {judgments.map((j, i) => (
          <motion.div
            key={j}
            initial={skip ? false : { opacity: 0, x: slideDir * -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: "easeOut", delay: itemDelay + i * 0.08 }}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 1,
                background: "var(--pv24-accent)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 17,
                color: "var(--pv24-text)",
                lineHeight: 1.3,
              }}
            >
              {j}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Ghost pod
// ---------------------------------------------------------------------------
interface GhostPodProps {
  left: number;
  top: number;
  width: number;
  height: number;
  delay: number;
  skip: boolean;
}

function GhostPod({ left, top, width, height, delay, skip }: GhostPodProps) {
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      style={{
        position: "absolute",
        left: pct(left, VW),
        top: pct(top, VH),
        width: pct(width, VW),
        height: pct(height, VH),
        background: "transparent",
        border: "1.5px dashed var(--pv24-border-strong)",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        transformOrigin: "center top",
        fontFamily: "var(--pv24-font-family)",
        boxSizing: "border-box",
      }}
    >
      <IconBriefcase
        style={{ width: 18, height: 18, flexShrink: 0, color: "var(--pv24-text-secondary)" }}
      />
      <span
        style={{
          fontSize: 17,
          color: "var(--pv24-text-secondary)",
          fontStyle: "italic",
        }}
      >
        +3 more roles
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main exhibit
// ---------------------------------------------------------------------------
export function RoleArchitectureExhibit({
  data,
  exportMode = false,
}: RoleArchitectureExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const items = data.sharedCore;
  const n = items.length;
  const capPositions = items.map((_, i) => capPos(i, n));

  // Dashed line endpoints: pod near-side midpoints
  const lLineEnd = { x: CX - POD_EDGE_DIST, y: CY - POD_LIFT }; // (510, 470)
  const rLineEnd = { x: CX + POD_EDGE_DIST, y: CY - POD_LIFT }; // (1410, 470)
  const gLineEnd = { x: CX, y: G_TOP };                        // (960, 900)

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
      aria-label="Role architecture exhibit: shared core adapts to each risk role"
    >
      {/* ------------------------------------------------------------------ */}
      {/* SVG layer                                                           */}
      {/* ------------------------------------------------------------------ */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* Dashed lines to role pods (drawn first, behind circles) */}
        <DashedLine
          x2={lLineEnd.x}
          y2={lLineEnd.y}
          delay={skip ? 0 : 1.4}
          skip={skip}
        />
        <DashedLine
          x2={rLineEnd.x}
          y2={rLineEnd.y}
          delay={skip ? 0 : 1.42}
          skip={skip}
        />
        <DashedLine
          x2={gLineEnd.x}
          y2={gLineEnd.y}
          delay={skip ? 0 : 1.48}
          skip={skip}
        />

        {/* Solid lines to capability nodes */}
        {capPositions.map((pos, i) => (
          <SolidLine
            key={i}
            x2={pos.x}
            y2={pos.y}
            delay={skip ? 0 : 0.6 + i * 0.09}
            skip={skip}
          />
        ))}

        {/* Hub: drawn after lines so it occludes line centres */}
        <motion.g
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          initial={skip ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "backOut", delay: 0 }}
        >
          {/* Outer halo ring */}
          <circle
            cx={CX}
            cy={CY}
            r={HUB_R + 10}
            fill="none"
            stroke="var(--pv24-brand-purple)"
            strokeWidth={1.5}
            strokeOpacity={0.25}
          />
          {/* Main hub fill */}
          <circle
            cx={CX}
            cy={CY}
            r={HUB_R}
            fill="var(--pv24-brand-purple)"
          />
        </motion.g>

        {/* Hub text labels */}
        <motion.text
          x={CX}
          y={CY + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={20}
          fontWeight={700}
          letterSpacing={2}
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: skip ? 0 : 0.38 }}
          style={{ fill: "white", fontFamily: "var(--pv24-font-family)" }}
        >
          NFROS
        </motion.text>
        <motion.text
          x={CX}
          y={CY + 36}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={15}
          fontWeight={400}
          letterSpacing={3}
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: skip ? 0 : 0.44 }}
          style={{ fill: "rgba(255,255,255,0.8)", fontFamily: "var(--pv24-font-family)" }}
        >
          CORE
        </motion.text>

        {/* Capability nodes: drawn after hub so they occlude solid line ends */}
        {capPositions.map((pos, i) => (
          <CapNode
            key={items[i] ?? i}
            label={items[i] ?? ""}
            x={pos.x}
            y={pos.y}
            delay={skip ? 0 : 0.72 + i * 0.09}
            skip={skip}
          />
        ))}
      </svg>

      {/* ------------------------------------------------------------------ */}
      {/* Hub icon overlay (HTML, scales with container)                     */}
      {/* ------------------------------------------------------------------ */}
      <motion.div
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: skip ? 0 : 0.25 }}
        style={{
          position: "absolute",
          left: pct(CX - 28, VW),
          top: pct(CY - 58, VH),
          width: pct(56, VW),
          height: pct(44, VH),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <IconShieldCheck
          style={{ width: "100%", height: "100%", color: "white", display: "block" }}
        />
      </motion.div>

      {/* ------------------------------------------------------------------ */}
      {/* Left role pod                                                       */}
      {/* ------------------------------------------------------------------ */}
      <RolePod
        title={data.leftRole.title}
        subtitle={data.leftRole.subtitle}
        judgments={data.leftRole.judgments}
        Icon={IconScale}
        left={L_LEFT}
        top={L_TOP}
        width={POD_W}
        height={POD_H}
        originX="right center"
        expandDelay={skip ? 0 : 1.75}
        itemDelay={skip ? 0 : 2.05}
        slideDir={1}
        skip={skip}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Right role pod                                                      */}
      {/* ------------------------------------------------------------------ */}
      <RolePod
        title={data.rightRole.title}
        subtitle={data.rightRole.subtitle}
        judgments={data.rightRole.judgments}
        Icon={IconUsers}
        left={R_LEFT}
        top={R_TOP}
        width={POD_W}
        height={POD_H}
        originX="left center"
        expandDelay={skip ? 0 : 1.78}
        itemDelay={skip ? 0 : 2.08}
        slideDir={-1}
        skip={skip}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Ghost pod                                                           */}
      {/* ------------------------------------------------------------------ */}
      <GhostPod
        left={G_LEFT}
        top={G_TOP}
        width={GHOST_W}
        height={GHOST_H}
        delay={skip ? 0 : 2.0}
        skip={skip}
      />
    </div>
  );
}
