"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconApps, IconComponents, IconServer, IconDatabase, IconCheck } from "@tabler/icons-react";
import type { ServiceFactoryData } from "../data/types";

export type ServiceFactoryExhibitProps = {
  data: ServiceFactoryData;
  exportMode?: boolean;
};

// ---------------------------------------------------------------------------
// Layout constants: all vertical values stay under 760px
// ---------------------------------------------------------------------------
const STACK_LEFT = 60;
const STACK_W = 780;
const LAYER_H = 163;
const LAYER_GAP = 9;
const STACK_TOP = 20;
// Layer bottoms: 20, 193, 366, 539 -> last bottom = 539+163 = 702 < 760 ✓

const RIGHT_X = 920;
const STEPS_TOP = 76;
const STEP_H = 134;
// Step bottoms: 76, 210, 344, 478 -> last bottom = 478+90 = 568 < 760 ✓

// ---------------------------------------------------------------------------
// Static content (illustrative: not derived from data)
// ---------------------------------------------------------------------------
const ROLE_APP_CHIPS = ["TPRM Reviewer", "OpRisk Monitor", "Audit Assistant"];
const FUNCTION_PACK_CHIPS = ["Evidence Collector", "Alert Triager", "Pack Generator"];

const FACTORY_STEPS: Array<{ num: number; label: string; detail: string }> = [
  { num: 1, label: "Define scope", detail: "Role, risk type, regulatory context" },
  { num: 2, label: "Configure functions", detail: "Select from existing Function Packs" },
  { num: 3, label: "Validate with role", detail: "Pilot with real or synthetic cases" },
  { num: 4, label: "Deploy and monitor", detail: "Live with audit trail and versioning" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ArchLayerConfig {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; stroke?: number; color?: string }>;
  bg: string;
  color: string;
  borderTop?: string;
  chips?: string[];
  chipBg: string;
  chipColor: string;
  inlineText?: string;
  /** Animation delay index: 0 = enters first (bottom layer), 3 = enters last (top layer) */
  delayIndex: number;
}

function Chip({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 14px",
        borderRadius: 20,
        background: bg,
        color,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ArchLayer({
  cfg,
  index,
  skip,
}: {
  cfg: ArchLayerConfig;
  index: number;
  skip: boolean;
}) {
  const top = STACK_TOP + index * (LAYER_H + LAYER_GAP);
  const delay = 0.05 + cfg.delayIndex * 0.13;
  const Icon = cfg.icon;

  return (
    <motion.div
      style={{
        position: "absolute",
        left: STACK_LEFT,
        top,
        width: STACK_W,
        height: LAYER_H,
        background: cfg.bg,
        borderTop: cfg.borderTop,
        color: cfg.color,
        boxSizing: "border-box",
        padding: "14px 22px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
      }}
      initial={skip ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skip ? undefined : { duration: 0.38, delay, ease: "easeOut" }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={20} stroke={1.6} color={cfg.color} />
        <span style={{ fontWeight: 700, fontSize: 17, color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      {/* Chips */}
      {cfg.chips != null && cfg.chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cfg.chips.map((chip) => (
            <Chip key={chip} label={chip} bg={cfg.chipBg} color={cfg.chipColor} />
          ))}
        </div>
      )}

      {/* Inline text (for layers without chips) */}
      {cfg.inlineText != null && (
        <div style={{ fontSize: 14, opacity: 0.75, color: cfg.color }}>
          {cfg.inlineText}
        </div>
      )}
    </motion.div>
  );
}

function ConnectorArrows({ skip }: { skip: boolean }) {
  const arrowCount = 3;
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {Array.from({ length: arrowCount }, (_, i) => {
        const cx = STACK_LEFT + STACK_W / 2;
        // Arrow sits in the gap between layer i and layer i+1
        const gapTop = STACK_TOP + (i + 1) * (LAYER_H + LAYER_GAP) - LAYER_GAP;
        const cy = gapTop + LAYER_GAP / 2;
        return (
          <motion.path
            key={i}
            d={`M${cx - 7} ${cy - 3} L${cx} ${cy + 4} L${cx + 7} ${cy - 3}`}
            fill="none"
            stroke="var(--pv24-border-strong)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={skip ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={skip ? undefined : { duration: 0.2, delay: 0.55 + i * 0.08 }}
          />
        );
      })}
    </svg>
  );
}

function FactoryStep({
  step,
  index,
  skip,
  isLast,
}: {
  step: (typeof FACTORY_STEPS)[number];
  index: number;
  skip: boolean;
  isLast: boolean;
}) {
  const top = STEPS_TOP + index * STEP_H;
  const delay = 0.78 + index * 0.13;

  return (
    <motion.div
      style={{
        position: "absolute",
        left: RIGHT_X,
        top,
        display: "flex",
        alignItems: "flex-start",
        gap: 18,
      }}
      initial={skip ? false : { opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={skip ? undefined : { duration: 0.32, delay, ease: "easeOut" }}
    >
      {/* Circle + connector line */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "var(--pv24-accent)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {step.num}
        </div>
        {!isLast && (
          <div
            style={{
              width: 2,
              height: STEP_H - 38 - 6,
              marginTop: 4,
              background: "var(--pv24-border)",
            }}
          />
        )}
      </div>

      {/* Text */}
      <div style={{ paddingTop: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: "var(--pv24-text)" }}>
          {step.label}
        </div>
        <div style={{ fontSize: 14, color: "var(--pv24-text-secondary)", marginTop: 6, lineHeight: 1.4 }}>
          {step.detail}
        </div>
      </div>
    </motion.div>
  );
}

function InBuildCard({ skip }: { skip: boolean }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        right: 72,
        top: 24,
        background: "var(--pv24-brand-purple-dark, #3B1D8A)",
        color: "#FFFFFF",
        borderRadius: 8,
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 0 22px 5px var(--pv24-brand-purple-light, rgba(109,40,217,0.28))",
      }}
      initial={skip ? false : { opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={skip ? undefined : { duration: 0.4, delay: 1.35, ease: "backOut" }}
    >
      {/* Pulsing status dot */}
      <motion.div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#34D399",
          flexShrink: 0,
        }}
        animate={skip ? undefined : { opacity: [1, 0.25, 1] }}
        transition={skip ? undefined : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.01em" }}>
          TPRM Reviewer v1
        </div>
        <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>In review</div>
      </div>
      <IconCheck size={16} stroke={2.5} color="#34D399" />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main exhibit
// ---------------------------------------------------------------------------

export function ServiceFactoryExhibit({ data, exportMode }: ServiceFactoryExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  // Pull labels from data where available
  const appsLayer = data.architectureLayers.find((l) => l.level === "apps");
  const functionsLayer = data.architectureLayers.find((l) => l.level === "functions");
  const platformLayer = data.architectureLayers.find((l) => l.level === "platform");

  // 4 visual layers: ordered top to bottom visually
  // Animation: bottom enters first (delayIndex 0) so stack appears to rise up
  const layers: ArchLayerConfig[] = [
    {
      key: "apps",
      label: appsLayer?.label ?? "Role Apps",
      icon: IconApps,
      bg: "var(--pv24-accent)",
      color: "#FFFFFF",
      chips: ROLE_APP_CHIPS,
      chipBg: "rgba(255,255,255,0.22)",
      chipColor: "#FFFFFF",
      delayIndex: 3,
    },
    {
      key: "functions",
      label: functionsLayer?.label ?? "Function Packs",
      icon: IconComponents,
      bg: "var(--pv24-surface)",
      color: "var(--pv24-text)",
      borderTop: "1px solid var(--pv24-border)",
      chips: FUNCTION_PACK_CHIPS,
      chipBg: "var(--pv24-accent)",
      chipColor: "#FFFFFF",
      delayIndex: 2,
    },
    {
      key: "platform",
      label: platformLayer?.label ?? "NFROS Platform",
      icon: IconServer,
      bg: "var(--pv24-surface)",
      color: "var(--pv24-text)",
      borderTop: "1px solid var(--pv24-border)",
      chipBg: "transparent",
      chipColor: "var(--pv24-text-secondary)",
      inlineText: "Workflow / Routing / Audit",
      delayIndex: 1,
    },
    {
      key: "existing",
      label: "Existing Systems",
      icon: IconDatabase,
      bg: "var(--pv24-canvas)",
      color: "var(--pv24-text-secondary)",
      borderTop: "1px solid var(--pv24-border)",
      chipBg: "transparent",
      chipColor: "var(--pv24-text-secondary)",
      inlineText: "GRC / Mail / Data Warehouse",
      delayIndex: 0,
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
    >
      {/* Architecture stack: left side */}
      {layers.map((cfg, i) => (
        <ArchLayer key={cfg.key} cfg={cfg} index={i} skip={skip} />
      ))}

      {/* Connector arrows between layers */}
      <ConnectorArrows skip={skip} />

      {/* Right panel title */}
      <motion.div
        style={{
          position: "absolute",
          left: RIGHT_X,
          top: 20,
          fontWeight: 700,
          fontSize: 20,
          color: "var(--pv24-text)",
          letterSpacing: "-0.01em",
        }}
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.3, delay: 0.65 }}
      >
        New App in 4 Steps
      </motion.div>

      {/* Factory steps */}
      {FACTORY_STEPS.map((step, i) => (
        <FactoryStep
          key={step.num}
          step={step}
          index={i}
          skip={skip}
          isLast={i === FACTORY_STEPS.length - 1}
        />
      ))}

      {/* In-build floating card */}
      <InBuildCard skip={skip} />

      {/* Disclaimer */}
      <div
        style={{
          position: "absolute",
          right: 72,
          bottom: 18,
          fontSize: 11,
          color: "var(--pv24-text-secondary)",
          opacity: 0.55,
          fontFamily: "var(--pv24-font-family)",
        }}
      >
        Synthetic institution and data
      </div>
    </div>
  );
}
