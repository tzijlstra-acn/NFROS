"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconAlertTriangle,
  IconLayoutDashboard,
  IconActivity,
  IconShieldCheck,
  IconRocket,
  IconArrowRight,
} from "@tabler/icons-react";
import type { StoryPathData } from "../data/types";

type Props = {
  data: StoryPathData;
  exportMode?: boolean;
};

// Drawn on the 1920 x 780 exhibit stage: five chapters climb from case for change to scale
const W = 1920;
const H = 780;
const LEFT = 80;
const CARD_W = 320;
const GAP = 40;
const CARD_H = 290;
const STEP = 70;
const FIRST_TOP = 384;
const BASELINE = 728;
const BADGE_R = 28;

const ICONS = [IconAlertTriangle, IconLayoutDashboard, IconActivity, IconShieldCheck, IconRocket];
const SLIDE_RANGES = ["Slides 3 and 4", "Slides 5 and 6", "Slides 7 and 8", "Slides 9 to 11", "Slides 12 and 13"];
const STEP_FILL = ["#EBD6FF", "#D9B3FF", "#B84DFF", "#A100FF", "#7600BC"];
const STEP_TEXT = ["#5C0099", "#5C0099", "#FFFFFF", "#FFFFFF", "#FFFFFF"];

const cardLeft = (i: number) => LEFT + i * (CARD_W + GAP);
const cardTop = (i: number) => FIRST_TOP - i * STEP;

export function StoryPathExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const chapters = data.chapters.slice(0, ICONS.length);
  const badgePoints = chapters.map((_, i) => [cardLeft(i) + CARD_W / 2, cardTop(i)] as const);
  // Stair-rail: rise above each card, then run across to the next badge
  const pathD = badgePoints
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `V ${y} H ${x}`))
    .join(" ");
  const delayFor = (i: number) => 0.25 + i * 0.28;

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--pv24-canvas)", overflow: "hidden", fontFamily: "var(--pv24-font-family)" }}>
      <svg aria-hidden="true" width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={LEFT} y1={BASELINE} x2={cardLeft(chapters.length - 1) + CARD_W} y2={BASELINE} stroke="var(--pv24-border-strong)" strokeWidth={2} />
        <motion.path
          d={pathD}
          fill="none"
          stroke="var(--pv24-accent)"
          strokeWidth={3}
          initial={skip ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={skip ? undefined : { duration: 0.28 * (chapters.length - 1), delay: delayFor(0) + 0.2, ease: "linear" }}
        />
      </svg>

      {chapters.map((ch, i) => {
        const Icon = ICONS[i] ?? IconActivity;
        const isActive = ch.number === data.activeChapterNumber;
        const top = cardTop(i);
        const left = cardLeft(i);
        const stepTop = top + CARD_H;
        return (
          <React.Fragment key={ch.number}>
            {/* Step riser under the card, deepening in colour as the story moves to scale */}
            <motion.div
              initial={skip ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={skip ? undefined : { duration: 0.4, delay: delayFor(i), ease: "easeOut" }}
              style={{
                position: "absolute",
                left,
                top: stepTop,
                width: CARD_W,
                height: BASELINE - stepTop,
                background: STEP_FILL[i],
                transformOrigin: "bottom center",
                display: "flex",
                alignItems: "flex-end",
                padding: "0 20px 12px",
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.04em", color: STEP_TEXT[i] }}>{SLIDE_RANGES[i]}</span>
            </motion.div>

            <motion.div
              initial={skip ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={skip ? undefined : { duration: 0.45, delay: delayFor(i) + 0.1, ease: "easeOut" }}
              style={{
                position: "absolute",
                left,
                top,
                width: CARD_W,
                height: CARD_H,
                background: "var(--pv24-surface)",
                border: isActive ? "2px solid var(--pv24-accent)" : "1px solid var(--pv24-border)",
                boxShadow: "0 8px 26px rgba(17, 18, 20, 0.08)",
                padding: "44px 24px 20px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Icon size={30} color="var(--pv24-accent)" stroke={1.6} style={{ position: "absolute", top: 16, right: 18 }} />
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--pv24-text)", lineHeight: 1.15 }}>{ch.sectionLabel}</div>
              <div style={{ fontSize: 19, fontStyle: "italic", color: "var(--pv24-text-secondary)", lineHeight: 1.3, marginTop: 8 }}>
                {ch.audienceQuestion}
              </div>
              <div style={{ height: 1, background: "var(--pv24-border)", margin: "16px 0 12px" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ch.topics.map((topic) => (
                  <div key={topic} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 18, lineHeight: 1.3, color: "var(--pv24-text)" }}>
                    <span style={{ width: 7, height: 7, background: "var(--pv24-accent)", flexShrink: 0, marginTop: 8 }} />
                    {topic}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Number badge on the card's top edge, threaded by the path */}
            <motion.div
              initial={skip ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={skip ? undefined : { duration: 0.3, delay: delayFor(i) + 0.3, ease: "backOut" }}
              style={{
                position: "absolute",
                left: left + CARD_W / 2 - BADGE_R,
                top: top - BADGE_R,
                width: BADGE_R * 2,
                height: BADGE_R * 2,
                borderRadius: "50%",
                background: isActive ? "var(--pv24-accent)" : "var(--pv24-surface)",
                border: "3px solid var(--pv24-accent)",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 700,
                color: isActive ? "#FFFFFF" : "var(--pv24-accent)",
              }}
            >
              {ch.number}
            </motion.div>

            {isActive && (
              <motion.div
                initial={skip ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={skip ? undefined : { duration: 0.3, delay: delayFor(i) + 0.5 }}
                style={{
                  position: "absolute",
                  left,
                  width: CARD_W / 2 - BADGE_R - 10,
                  textAlign: "right",
                  top: top - BADGE_R - 16,
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--pv24-accent-dark)",
                  whiteSpace: "nowrap",
                }}
              >
                We start here
              </motion.div>
            )}
          </React.Fragment>
        );
      })}

      <motion.div
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.4, delay: delayFor(chapters.length) }}
        style={{
          position: "absolute",
          left: LEFT,
          top: BASELINE + 14,
          width: cardLeft(chapters.length - 1) + CARD_W - LEFT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--pv24-text-secondary)",
        }}
      >
        <span>Case for change</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--pv24-accent-dark)" }}>
          Path to scale <IconArrowRight size={20} stroke={2} />
        </span>
      </motion.div>
    </div>
  );
}
