"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoreSlide23 } from "../../data/types";
import { PresentationLabel, PresentationMeta } from "../../typography";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
};

const SYSTEM_LABELS = ["GRC", "Finance", "HR", "Comms"] as const;
const SPINE_CAPABILITIES = ["Governed execution", "End-to-end process"] as const;

const BAND_BOTTOM_H = 180;
const BAND_MIDDLE_H = 300;
const BAND_TOP_H = 180;

const ITEM_BOTTOM_Y = BAND_TOP_H + BAND_MIDDLE_H + BAND_BOTTOM_H / 2 - 12;
const ITEM_MID_Y   = BAND_TOP_H + BAND_MIDDLE_H / 2 - 12;
const ITEM_TOP_Y   = BAND_TOP_H / 2 - 12;

export function OperatingSystemSpineSlide({ slide, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skipAnim = exportMode || !!prefersReduced;

  const emphasis = slide.emphasis ?? [...SPINE_CAPABILITIES];
  const totalH = BAND_BOTTOM_H + BAND_MIDDLE_H + BAND_TOP_H;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv23-canvas)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: totalH,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top band: Risk professional */}
        <div
          style={{
            height: BAND_TOP_H,
            background: "var(--pv23-surface)",
            border: "1px solid var(--pv23-border)",
            borderBottom: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "0 var(--pv23-8)",
            gap: "var(--pv23-2)",
          }}
        >
          <PresentationLabel color="var(--pv23-text-secondary)">
            Risk professional
          </PresentationLabel>
          <PresentationMeta color="var(--pv23-neutral-mid)">
            Role Operating System
          </PresentationMeta>
        </div>

        {/* Middle band: OS spine */}
        <div
          style={{
            height: BAND_MIDDLE_H,
            background: "var(--pv23-brand-purple-lightest)",
            borderTop: "2px solid var(--pv23-brand-purple)",
            borderBottom: "2px solid var(--pv23-brand-purple)",
            borderLeft: "1px solid var(--pv23-brand-purple)",
            borderRight: "1px solid var(--pv23-brand-purple)",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "0 var(--pv23-8)",
            gap: "var(--pv23-4)",
          }}
        >
          <PresentationLabel color="var(--pv23-brand-purple)">
            NFR Role Operating System
          </PresentationLabel>
          {emphasis.map((cap, i) => (
            <PresentationMeta key={i} color="var(--pv23-brand-purple-dark)">
              {cap}
            </PresentationMeta>
          ))}
        </div>

        {/* Bottom band: Existing systems */}
        <div
          style={{
            height: BAND_BOTTOM_H,
            background: "var(--pv23-canvas)",
            border: "1px solid var(--pv23-border)",
            borderTop: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "0 var(--pv23-8)",
            gap: "var(--pv23-3)",
          }}
        >
          <PresentationLabel color="var(--pv23-neutral-mid)">
            Existing systems
          </PresentationLabel>
          <div style={{ display: "flex", gap: "var(--pv23-4)" }}>
            {SYSTEM_LABELS.map((sys) => (
              <PresentationMeta key={sys} color="var(--pv23-neutral-mid)">
                {sys}
              </PresentationMeta>
            ))}
          </div>
        </div>

        {/* Work item travelling bottom to top */}
        {skipAnim ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: ITEM_TOP_Y,
              transform: "translateX(-50%)",
              width: 24,
              height: 24,
              background: "var(--pv23-brand-purple)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
              <polyline
                points="3,8 7,12 13,4"
                stroke="#fff"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : (
          <motion.div
            style={{
              position: "absolute",
              left: "50%",
              width: 24,
              height: 24,
              x: "-50%",
              background: "var(--pv23-brand-purple)",
            }}
            initial={{ top: ITEM_BOTTOM_Y }}
            animate={{ top: [ITEM_BOTTOM_Y, ITEM_MID_Y, ITEM_TOP_Y] }}
            transition={{ duration: 2.2, times: [0, 0.5, 1], ease: "easeInOut", delay: 0.4 }}
          />
        )}
      </div>
    </div>
  );
}
