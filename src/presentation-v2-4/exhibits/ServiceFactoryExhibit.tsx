"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ServiceFactoryData, ServiceArchLayer, AppFactoryStage } from "../data/types";

export type ServiceFactoryExhibitProps = {
  data: ServiceFactoryData;
  exportMode?: boolean;
};

// Left side dimensions
const LEFT_X1 = 80;
const LEFT_X2 = 900;
const LEFT_WIDTH = LEFT_X2 - LEFT_X1;
const LAYER_HEIGHT = 160;
const LAYERS_TOP = 140;

// Right side track dimensions
const TRACK_X1 = 1020;
const TRACK_Y1 = 200;
const TRACK_X2 = 1800;
const TRACK_Y2 = 860;
const TRACK_W = TRACK_X2 - TRACK_X1;
const TRACK_H = TRACK_Y2 - TRACK_Y1;

const LEVEL_ORDER: ServiceArchLayer["level"][] = ["platform", "functions", "apps", "managed"];

const LAYER_STYLES: Record<ServiceArchLayer["level"], React.CSSProperties> = {
  platform: {
    background: "var(--pv24-canvas)",
    borderTop: "1px solid var(--pv24-border)",
    color: "var(--pv24-text-secondary)",
  },
  functions: {
    background: "var(--pv24-surface)",
    borderTop: "1px solid var(--pv24-border)",
    color: "var(--pv24-text)",
  },
  apps: {
    background: "var(--pv24-surface)",
    borderTop: "1px solid var(--pv24-border)",
    borderLeft: "4px solid var(--pv24-accent)",
    color: "var(--pv24-text)",
  },
  managed: {
    background: "var(--pv24-accent)",
    color: "#FFFFFF",
  },
};

// Compute stage node positions around the rectangular track perimeter
// Stages in order: Discover (top-left), Design (top-mid), Build (top-right),
// Validate (right-upper), Release (right-lower), Operate (bottom-right), Improve (bottom-left)
function stagePositions(count: number): Array<{ x: number; y: number }> {
  // Fixed 7 positions around the rectangle
  return [
    { x: TRACK_X1 + TRACK_W * 0.1, y: TRACK_Y1 }, // Discover - top left area
    { x: TRACK_X1 + TRACK_W * 0.5, y: TRACK_Y1 }, // Design   - top mid
    { x: TRACK_X2, y: TRACK_Y1 },                  // Build    - top right corner
    { x: TRACK_X2, y: TRACK_Y1 + TRACK_H * 0.35 }, // Validate - right upper
    { x: TRACK_X2, y: TRACK_Y1 + TRACK_H * 0.65 }, // Release  - right lower
    { x: TRACK_X1 + TRACK_W * 0.7, y: TRACK_Y2 },  // Operate  - bottom right
    { x: TRACK_X1 + TRACK_W * 0.2, y: TRACK_Y2 },  // Improve  - bottom left
  ];
}

const STAGE_POSITIONS = stagePositions(7);
const NODE_SIZE = 36;

const CSS = {
  root: {
    position: "absolute" as const,
    inset: 0,
    background: "var(--pv24-canvas)",
    fontFamily: "var(--pv24-font-family)",
    overflow: "hidden",
  } as React.CSSProperties,
  layerBase: {
    position: "absolute" as const,
    left: LEFT_X1,
    width: LEFT_WIDTH,
    height: LAYER_HEIGHT,
    padding: "16px 20px",
    boxSizing: "border-box" as const,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
  } as React.CSSProperties,
  layerTitle: {
    fontWeight: 700,
    fontSize: "var(--pv24-fs-body, 18px)",
    marginBottom: 4,
  } as React.CSSProperties,
  layerSublabel: {
    fontSize: "var(--pv24-fs-small, 13px)",
    opacity: 0.8,
  } as React.CSSProperties,
  appFactoryLabel: {
    position: "absolute" as const,
    left: TRACK_X1,
    top: TRACK_Y1 - 48,
    fontWeight: 700,
    fontSize: "var(--pv24-fs-label, 18px)",
    color: "var(--pv24-text)",
  } as React.CSSProperties,
  stageLabel: {
    fontSize: "var(--pv24-fs-small, 11px)",
    color: "var(--pv24-text-secondary)",
    textAlign: "center" as const,
    marginTop: 4,
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  newAppLabel: {
    fontFamily: "var(--pv24-font-mono)",
    fontSize: "var(--pv24-fs-mono, 10px)",
    color: "#FFFFFF",
    textAlign: "center" as const,
    lineHeight: 1.2,
  } as React.CSSProperties,
};

// Map from level to vertical position (bottom-to-top: platform at bottom)
function layerTop(level: ServiceArchLayer["level"]): number {
  const levelIndex = LEVEL_ORDER.indexOf(level);
  // platform = index 0 = bottom (y=620), managed = index 3 = top (y=140)
  return LAYERS_TOP + (3 - levelIndex) * LAYER_HEIGHT;
}

function ArchLayer({
  layer,
  skip,
  delay,
}: {
  layer: ServiceArchLayer;
  skip: boolean;
  delay: number;
}) {
  const top = layerTop(layer.level);
  const style: React.CSSProperties = {
    ...CSS.layerBase,
    ...LAYER_STYLES[layer.level],
    top,
  };

  return (
    <motion.div
      style={style}
      initial={skip ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skip ? undefined : { duration: 0.35, delay }}
    >
      <div style={CSS.layerTitle}>{layer.label}</div>
      {layer.sublabel != null && (
        <div style={CSS.layerSublabel}>{layer.sublabel}</div>
      )}
    </motion.div>
  );
}

function StageNode({
  stage,
  index,
  skip,
  delay,
}: {
  stage: AppFactoryStage;
  index: number;
  skip: boolean;
  delay: number;
}) {
  const pos = STAGE_POSITIONS[index];
  if (pos == null) return null;
  const isActive = stage.isActive === true;

  return (
    <motion.div
      style={{
        position: "absolute",
        left: pos.x - NODE_SIZE / 2,
        top: pos.y - NODE_SIZE / 2,
        width: NODE_SIZE,
        height: NODE_SIZE,
        background: isActive ? "var(--pv24-accent)" : "var(--pv24-surface)",
        border: isActive ? "none" : "2px solid var(--pv24-border-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      initial={skip ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={skip ? undefined : { duration: 0.3, delay }}
    >
      {/* Label placed below node via separate div */}
      <div
        style={{
          ...CSS.stageLabel,
          position: "absolute",
          top: NODE_SIZE + 4,
          left: "50%",
          transform: "translateX(-50%)",
          color: isActive ? "var(--pv24-accent)" : "var(--pv24-text-secondary)",
          fontWeight: isActive ? 700 : 400,
        }}
      >
        {stage.label}
      </div>
    </motion.div>
  );
}

// Find the active stage position for the new app packet
function activeStagePos(stages: AppFactoryStage[]): { x: number; y: number } | null {
  const idx = stages.findIndex((s) => s.isActive === true);
  if (idx < 0 || idx >= STAGE_POSITIONS.length) return null;
  return STAGE_POSITIONS[idx] ?? null;
}

function NewAppPacket({
  label,
  stages,
  skip,
  delay,
}: {
  label: string;
  stages: AppFactoryStage[];
  skip: boolean;
  delay: number;
}) {
  const pos = activeStagePos(stages);
  if (pos == null) return null;

  return (
    <motion.div
      style={{
        position: "absolute",
        left: pos.x - 36,
        top: pos.y + NODE_SIZE / 2 + 36,
        width: 72,
        height: 40,
        background: "var(--pv24-brand-purple-dark)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 6px",
        boxSizing: "border-box",
        boxShadow: "0 0 16px 4px var(--pv24-brand-purple-light)",
      }}
      initial={skip ? false : { opacity: 0, scale: 0.7 }}
      animate={skip ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 0.85, 1], scale: [0.7, 1.05, 1] }}
      transition={skip ? undefined : { duration: 0.5, delay }}
    >
      <div style={CSS.newAppLabel}>{label}</div>
    </motion.div>
  );
}

export function ServiceFactoryExhibit({ data, exportMode }: ServiceFactoryExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  // Sort layers: bottom to top for stagger (platform first in delay)
  const orderedLayers = [...data.architectureLayers].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
  );

  // Track perimeter path length for dash animation
  const trackPerimeter = 2 * (TRACK_W + TRACK_H);

  return (
    <div style={CSS.root}>
      {/* Arch layers */}
      {orderedLayers.map((layer, i) => (
        <ArchLayer key={layer.level} layer={layer} skip={skip} delay={0.1 + i * 0.12} />
      ))}

      {/* App Factory label */}
      <motion.div
        style={CSS.appFactoryLabel}
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.3, delay: 0.6 }}
      >
        App Factory
      </motion.div>

      {/* Track border */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <motion.rect
          x={TRACK_X1}
          y={TRACK_Y1}
          width={TRACK_W}
          height={TRACK_H}
          fill="none"
          stroke="var(--pv24-border-strong)"
          strokeWidth={2}
          strokeDasharray={trackPerimeter}
          initial={skip ? false : { strokeDashoffset: trackPerimeter }}
          animate={{ strokeDashoffset: 0 }}
          transition={skip ? undefined : { duration: 0.8, delay: 0.7, ease: "easeInOut" }}
        />
      </svg>

      {/* Stage nodes */}
      {data.appFactoryStages.slice(0, STAGE_POSITIONS.length).map((stage, i) => (
        <StageNode key={i} stage={stage} index={i} skip={skip} delay={1.1 + i * 0.07} />
      ))}

      {/* New app packet */}
      <NewAppPacket
        label={data.newAppLabel}
        stages={data.appFactoryStages}
        skip={skip}
        delay={1.7}
      />
    </div>
  );
}
