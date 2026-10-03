"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  IconShieldCheck,
  IconMail,
  IconDatabase,
  IconFileAnalytics,
  IconActivity,
  IconUser,
  IconUsers,
  IconEye,
} from "@tabler/icons-react";
import type { EngagementLayerData } from "../data/types";

interface Props {
  data: EngagementLayerData;
  exportMode?: boolean;
}

const VW = 1920;

// Engagement band geometry
const BAND_X = 60;
const BAND_Y = 430;
const BAND_W = VW - 120; // 1800
const BAND_H = 220;
const BAND_BOTTOM = BAND_Y + BAND_H; // 650
const BAND_RADIUS = 14;
const BAND_CX = VW / 2; // 960

// System of record cards (below the band)
// 5 cards, centers spread from x=200 to x=1720
const SYS_CXS = [200, 580, 960, 1340, 1720] as const;
const SYS_CARD_TOP = 765; // top edge: connection line starts here (spec: top center y=765)
const SYS_CARD_W = 220;
const SYS_CARD_H = 130;

// Role experience cards (above the band)
// 3 cards, centers spread from x=480 to x=1440
const ROLE_CXS = [480, 960, 1440] as const;
const ROLE_CARD_BOTTOM = 240; // bottom edge: connection line ends here (spec: bottom center y=240)
const ROLE_CARD_W = 240;
const ROLE_CARD_H = 90;
const ROLE_CARD_TOP = ROLE_CARD_BOTTOM - ROLE_CARD_H; // 150

// Capability chips inside the band
const CHIP_LABELS = ["Daily work", "Process execution", "Control fabric"] as const;
const CHIP_CXS = [480, 960, 1440] as const;
const CHIP_W = 230;
const CHIP_H = 44;
const CHIP_RX = 22;
const CHIP_TOP = 540;

// Color constants (SVG presentation attributes cannot reference CSS custom properties)
const PURPLE = "#A100FF";
const PURPLE_LIGHTEST = "#F3E5FF";
const BORDER_COLOR = "#D8DAE0";
const BORDER_STRONG = "#9DA1AE";
const WHITE = "#FFFFFF";
const TEXT_COLOR = "#111214";
const TEXT_SECONDARY = "#5A5E6B";

const FONT = "Graphik, Arial, sans-serif";

// System icon components ordered to match data.systemsOfRecord positions
const SYS_ICONS = [
  IconShieldCheck,
  IconMail,
  IconDatabase,
  IconFileAnalytics,
  IconActivity,
] as const;

// Role card icon and label configs
const ROLE_CONFIGS = [
  { Icon: IconUser, label: "Operational Risk" },
  { Icon: IconUsers, label: "TPRM" },
  { Icon: IconEye, label: "Audit" },
] as const;

export function EngagementLayerExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const bandLabel = data.topLayer || "NFR Operating System";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--pv24-canvas)",
      }}
    >
      <svg
        viewBox={`0 0 ${VW} 1080`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        {/* Section label: above role cards */}
        <text
          x={BAND_CX}
          y={116}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={17}
          fontWeight={400}
          fill={TEXT_SECONDARY}
          letterSpacing={2}
        >
          ROLE EXPERIENCES
        </text>

        {/* Section label: below system cards */}
        <text
          x={BAND_CX}
          y={924}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={17}
          fontWeight={400}
          fill={TEXT_SECONDARY}
          letterSpacing={2}
        >
          SYSTEMS OF RECORD
        </text>

        {/* Connection lines: system card tops to band bottom (dashed, border-strong) */}
        {SYS_CXS.map((cx, i) => (
          <line
            key={`sys-line-${i}`}
            x1={cx}
            y1={SYS_CARD_TOP}
            x2={cx}
            y2={BAND_BOTTOM}
            stroke={BORDER_STRONG}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        ))}

        {/* Connection lines: band top to role card bottoms (solid, brand-purple) */}
        {ROLE_CXS.map((cx, i) => (
          <line
            key={`role-line-${i}`}
            x1={cx}
            y1={BAND_Y}
            x2={cx}
            y2={ROLE_CARD_BOTTOM}
            stroke={PURPLE}
            strokeWidth={2}
          />
        ))}

        {/* Engagement band */}
        <rect
          x={BAND_X}
          y={BAND_Y}
          width={BAND_W}
          height={BAND_H}
          rx={BAND_RADIUS}
          fill={PURPLE_LIGHTEST}
          stroke={PURPLE}
          strokeWidth={3}
        />

        {/* Band center label */}
        <text
          x={BAND_CX}
          y={492}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={24}
          fontWeight={700}
          fill={PURPLE}
        >
          {bandLabel}
        </text>

        {/* Capability chips inside the band */}
        {CHIP_LABELS.map((label, i) => {
          const chipCx = CHIP_CXS[i] ?? BAND_CX;
          return (
            <g key={`chip-${i}`}>
              <rect
                x={chipCx - CHIP_W / 2}
                y={CHIP_TOP}
                width={CHIP_W}
                height={CHIP_H}
                rx={CHIP_RX}
                fill={WHITE}
                stroke={BORDER_COLOR}
                strokeWidth={1.5}
              />
              <text
                x={chipCx}
                y={CHIP_TOP + 29}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize={18}
                fontWeight={500}
                fill={PURPLE}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* System of record cards */}
        {SYS_CXS.map((cx, i) => {
          const SysIcon = SYS_ICONS[i];
          const sysLabel = data.systemsOfRecord[i] ?? "";
          return (
            <g key={`sys-card-${i}`}>
              <rect
                x={cx - SYS_CARD_W / 2}
                y={SYS_CARD_TOP}
                width={SYS_CARD_W}
                height={SYS_CARD_H}
                rx={8}
                fill={WHITE}
                stroke={BORDER_COLOR}
                strokeWidth={1.5}
              />
              {SysIcon && (
                <foreignObject
                  x={cx - 20}
                  y={SYS_CARD_TOP + 20}
                  width={40}
                  height={40}
                >
                  <div style={{ width: 40, height: 40 }}>
                    <SysIcon size={40} color={PURPLE} />
                  </div>
                </foreignObject>
              )}
              <text
                x={cx}
                y={SYS_CARD_TOP + SYS_CARD_H - 16}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize={18}
                fontWeight={500}
                fill={TEXT_SECONDARY}
              >
                {sysLabel}
              </text>
            </g>
          );
        })}

        {/* Role experience cards */}
        {ROLE_CXS.map((cx, i) => {
          const config = ROLE_CONFIGS[i];
          if (!config) return null;
          const { Icon: RoleIcon, label } = config;
          return (
            <g key={`role-card-${i}`}>
              <rect
                x={cx - ROLE_CARD_W / 2}
                y={ROLE_CARD_TOP}
                width={ROLE_CARD_W}
                height={ROLE_CARD_H}
                rx={8}
                fill={WHITE}
                stroke={BORDER_COLOR}
                strokeWidth={1.5}
              />
              <foreignObject
                x={cx - 20}
                y={ROLE_CARD_TOP + 10}
                width={40}
                height={40}
              >
                <div style={{ width: 40, height: 40 }}>
                  <RoleIcon size={40} color={PURPLE} />
                </div>
              </foreignObject>
              <text
                x={cx}
                y={ROLE_CARD_BOTTOM - 14}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize={18}
                fontWeight={600}
                fill={TEXT_COLOR}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Animated pulses: systems to band, traveling upward (cy decreases) */}
        {!skip &&
          SYS_CXS.map((cx, i) => (
            <motion.circle
              key={`pulse-sys-${i}`}
              cx={cx}
              r={6}
              fill={PURPLE}
              initial={{ cy: SYS_CARD_TOP, opacity: 0 }}
              animate={{
                cy: [SYS_CARD_TOP, BAND_BOTTOM],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 1.4,
                delay: i * 0.25,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}

        {/* Animated pulses: band to role cards, traveling upward (cy decreases) */}
        {!skip &&
          ROLE_CXS.map((cx, i) => (
            <motion.circle
              key={`pulse-role-${i}`}
              cx={cx}
              r={6}
              fill={PURPLE}
              initial={{ cy: BAND_Y, opacity: 0 }}
              animate={{
                cy: [BAND_Y, ROLE_CARD_BOTTOM],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 1.4,
                delay: 0.7 + i * 0.3,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
      </svg>
    </div>
  );
}
