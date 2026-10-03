"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconRocket, IconChartLine, IconStack2 } from "@tabler/icons-react";
import type { DesignPartnerPathData, DesignPartnerStep } from "../data/types";

export type DesignPartnerPathExhibitProps = {
  data: DesignPartnerPathData;
  exportMode?: boolean;
};

// ---------------------------------------------------------------------------
// Layout constants (1920x1080 coordinate space, scaled by PresentationV24)
// ---------------------------------------------------------------------------

const CARD_BOUNDS: ReadonlyArray<{ x1: number; x2: number }> = [
  { x1: 80, x2: 580 },
  { x1: 680, x2: 1180 },
  { x1: 1280, x2: 1780 },
];

const CARD_Y1 = 52;
const CARD_Y2 = 558;
const CARD_HEIGHT = CARD_Y2 - CARD_Y1; // 506

const ARROW_Y = Math.round((CARD_Y1 + CARD_Y2) / 2); // 305

const TIMELINE_Y = 578;
const TIMELINE_CONTAINER_W = 1700; // 1780 - 80
const TIMELINE_CONTAINER_LEFT = 80;

const CTA_Y = 680;
const CTA_HEIGHT = 58;

const CONTROL_LINE_Y = 760;

// ---------------------------------------------------------------------------
// Phase static configuration
// ---------------------------------------------------------------------------

type SubBullet = { text: string };
type Outcome = { main: string; subs: SubBullet[] };

type PhaseConfig = {
  verb: string;
  Icon: React.ComponentType<{ size?: number; stroke?: number; color?: string }>;
  borderColor: string;
  headerBg: string;
  badgeColor: string;
  outcomes: Outcome[];
};

const PHASE_CONFIGS: PhaseConfig[] = [
  {
    verb: "DEPLOY",
    Icon: IconRocket,
    borderColor: "var(--pv24-accent)",
    headerBg: "var(--pv24-accent-lightest)",
    badgeColor: "var(--pv24-accent)",
    outcomes: [
      {
        main: "Deploy TPRM Reviewer to 2 risk managers",
        subs: [
          { text: "Wk 1-2: map data sources, configure authority model" },
          { text: "Wk 3-4: dry run with 10 live TPRM cases, human gates on" },
          { text: "Wk 5-6: go live with approval-gated execution" },
        ],
      },
      {
        main: "Complete one full RCSA cycle with OR Partner OS",
        subs: [],
      },
      {
        main: "All decisions human-approved; AI prepares, human signs",
        subs: [],
      },
    ],
  },
  {
    verb: "MEASURE",
    Icon: IconChartLine,
    borderColor: "#9DA1AE",
    headerBg: "#F0F1F4",
    badgeColor: "#5A5E6B",
    outcomes: [
      {
        main: "Track: decision time, evidence completeness, rework rate",
        subs: [],
      },
      {
        main: "Baseline versus system-assisted comparison",
        subs: [
          { text: "Baseline captured in week 1, before go-live" },
          { text: "Mid-pilot read at week 4, final report at week 6" },
        ],
      },
      {
        main: "Stakeholder sign-off on observed outcomes",
        subs: [],
      },
      {
        main: "Outcome report produced and reviewed",
        subs: [],
      },
    ],
  },
  {
    verb: "SCALE",
    Icon: IconStack2,
    borderColor: "var(--pv24-accent-dark)",
    headerBg: "#EDE0F7",
    badgeColor: "var(--pv24-accent-dark)",
    outcomes: [
      {
        main: "Onboard 3 additional roles in Q2",
        subs: [
          { text: "Control Assurance, Incident Response, Regulatory Change" },
        ],
      },
      {
        main: "Activate Function Pack sharing across risk disciplines",
        subs: [],
      },
      {
        main: "Increase autonomy only where pilot proved it safe",
        subs: [],
      },
      {
        main: "Roadmap governance presented to steering committee",
        subs: [],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Timeline month markers (relative x inside 1700-wide container)
// ---------------------------------------------------------------------------

const TIMELINE_MONTHS = [
  { label: "Jan", x: 0 },
  { label: "Mar", x: 600 },
  { label: "May", x: 1200 },
  { label: "Jul", x: 1700 },
];

// Phase bars aligned with cards (relative x inside container)
const TIMELINE_SPANS = [
  { x: 0, w: 500, color: "var(--pv24-accent)" },
  { x: 600, w: 500, color: "#7A7F8C" },
  { x: 1200, w: 500, color: "var(--pv24-accent-dark)" },
];

// ---------------------------------------------------------------------------
// PhaseCard
// ---------------------------------------------------------------------------

const CARD_HEADER_H = 168;
const CARD_GATE_H = 54;
const CARD_BODY_H = CARD_HEIGHT - CARD_HEADER_H - CARD_GATE_H; // 284

function PhaseCard({
  step,
  phaseConfig,
  cardIndex,
  skip,
  delay,
}: {
  step: DesignPartnerStep;
  phaseConfig: PhaseConfig;
  cardIndex: number;
  skip: boolean;
  delay: number;
}) {
  const bounds = CARD_BOUNDS[cardIndex];
  if (!bounds) return null;
  const width = bounds.x2 - bounds.x1;
  const badgeStr = step.number < 10 ? `0${step.number}` : String(step.number);
  const { Icon, verb, borderColor, headerBg, badgeColor, outcomes } = phaseConfig;

  return (
    <motion.div
      style={{
        position: "absolute",
        left: bounds.x1,
        top: CARD_Y1,
        width,
        height: CARD_HEIGHT,
        background: "var(--pv24-surface)",
        borderTop: "1px solid var(--pv24-border)",
        borderRight: "1px solid var(--pv24-border)",
        borderBottom: "1px solid var(--pv24-border)",
        borderLeft: `8px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      initial={skip ? false : { opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skip ? undefined : { duration: 0.45, delay, ease: "easeOut" }}
    >
      {/* Header */}
      <div
        style={{
          height: CARD_HEADER_H,
          background: headerBg,
          padding: "16px 20px 12px 20px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Badge row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <span
            style={{
              fontFamily: "var(--pv24-font-mono)",
              fontSize: 74,
              fontWeight: 700,
              lineHeight: 1,
              color: badgeColor,
              letterSpacing: "-3px",
            }}
          >
            {badgeStr}
          </span>
          <Icon size={38} stroke={1.4} color={badgeColor} />
        </div>
        {/* Verb + title */}
        <div>
          <span
            style={{
              display: "block",
              fontFamily: "var(--pv24-font-mono)",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: badgeColor,
              marginBottom: 5,
            }}
          >
            {verb}
          </span>
          <span
            style={{
              display: "block",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--pv24-text)",
              lineHeight: 1.25,
            }}
          >
            {step.title}
          </span>
        </div>
      </div>

      {/* Body: outcome bullets */}
      <div
        style={{
          height: CARD_BODY_H,
          flex: 1,
          padding: "14px 18px 10px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 9,
          overflow: "hidden",
        }}
      >
        {outcomes.map((outcome, i) => (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  background: borderColor,
                  flexShrink: 0,
                  marginTop: 5,
                }}
              />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--pv24-text)",
                  lineHeight: 1.35,
                }}
              >
                {outcome.main}
              </span>
            </div>
            {outcome.subs.map((sub, j) => (
              <div
                key={j}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  marginTop: 3,
                  paddingLeft: 14,
                }}
              >
                <span
                  style={{
                    color: "var(--pv24-text-secondary)",
                    fontSize: 14,
                    marginTop: 2,
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {"›"}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--pv24-text-secondary)",
                    lineHeight: 1.3,
                  }}
                >
                  {sub.text}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Gate footer */}
      <div
        style={{
          height: CARD_GATE_H,
          borderTop: "1px solid var(--pv24-border)",
          background: "var(--pv24-muted-bg)",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--pv24-font-mono)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: badgeColor,
            flexShrink: 0,
          }}
        >
          Gate:
        </span>
        <span
          style={{
            fontFamily: "var(--pv24-font-mono)",
            fontSize: 14,
            color: "var(--pv24-text-secondary)",
            lineHeight: 1.3,
            fontStyle: "italic",
          }}
        >
          {step.gateQuestion}
        </span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Large Arrow
// ---------------------------------------------------------------------------

function LargeArrow({
  gapIndex,
  skip,
  delay,
}: {
  gapIndex: number;
  skip: boolean;
  delay: number;
}) {
  const leftBounds = CARD_BOUNDS[gapIndex];
  const rightBounds = CARD_BOUNDS[gapIndex + 1];
  if (!leftBounds || !rightBounds) return null;

  const gapCx = (leftBounds.x2 + rightBounds.x1) / 2;
  const arrowW = 68;
  const arrowH = 44;

  return (
    <motion.div
      style={{
        position: "absolute",
        left: gapCx - arrowW / 2,
        top: ARROW_Y - arrowH / 2,
        width: arrowW,
        height: arrowH,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
      initial={skip ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={skip ? undefined : { duration: 0.3, delay }}
    >
      <svg aria-hidden="true" width={arrowW} height={arrowH} viewBox={`0 0 ${arrowW} ${arrowH}`}>
        <line
          x1={4}
          y1={arrowH / 2}
          x2={arrowW - 14}
          y2={arrowH / 2}
          stroke="var(--pv24-accent)"
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        <polyline
          points={`${arrowW - 24},${arrowH / 2 - 12} ${arrowW - 4},${arrowH / 2} ${arrowW - 24},${arrowH / 2 + 12}`}
          fill="none"
          stroke="var(--pv24-accent)"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Timeline bar
// ---------------------------------------------------------------------------

function TimelineBar({ skip, delay }: { skip: boolean; delay: number }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: TIMELINE_CONTAINER_LEFT,
        top: TIMELINE_Y,
        width: TIMELINE_CONTAINER_W,
        height: 62,
      }}
      initial={skip ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={skip ? undefined : { duration: 0.4, delay }}
    >
      {/* Base connecting line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 5,
          height: 1,
          background: "var(--pv24-border)",
        }}
      />

      {/* Phase colored spans */}
      {TIMELINE_SPANS.map((span, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: span.x,
            width: span.w,
            top: 0,
            height: 11,
            background: span.color,
            opacity: 0.25,
          }}
        />
      ))}

      {/* Month tick marks and labels */}
      {TIMELINE_MONTHS.map((month, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: month.x,
            top: 0,
            transform: "translateX(-50%)",
          }}
        >
          <div
            style={{
              width: 1,
              height: 16,
              background: "var(--pv24-border-strong)",
              margin: "0 auto",
            }}
          />
          <div
            style={{
              fontFamily: "var(--pv24-font-mono)",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--pv24-text-secondary)",
              marginTop: 5,
              textAlign: "center",
              letterSpacing: "0.06em",
            }}
          >
            {month.label}
          </div>
        </div>
      ))}

      {/* Phase verb labels below the spans */}
      {TIMELINE_SPANS.map((span, i) => {
        const cfg = PHASE_CONFIGS[i];
        if (!cfg) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: span.x,
              width: span.w,
              textAlign: "center",
              top: 22,
              fontFamily: "var(--pv24-font-mono)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: span.color,
              opacity: 1,
            }}
          >
            {cfg.verb}
          </div>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main exhibit
// ---------------------------------------------------------------------------

export function DesignPartnerPathExhibit({ data, exportMode }: DesignPartnerPathExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  const { steps, callToAction } = data;
  const cardSteps = steps.slice(0, 3);

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
      {/* Phase cards: slide up one by one */}
      {cardSteps.map((step, i) => {
        const phaseConfig = PHASE_CONFIGS[i];
        if (!phaseConfig) return null;
        return (
          <PhaseCard
            key={i}
            step={step}
            phaseConfig={phaseConfig}
            cardIndex={i}
            skip={skip}
            delay={0.08 + i * 0.2}
          />
        );
      })}

      {/* Large directional arrows */}
      {cardSteps.length > 1 && (
        <LargeArrow gapIndex={0} skip={skip} delay={0.56} />
      )}
      {cardSteps.length > 2 && (
        <LargeArrow gapIndex={1} skip={skip} delay={0.68} />
      )}

      {/* Timeline bar */}
      <TimelineBar skip={skip} delay={0.88} />

      {/* CTA band */}
      <motion.div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: CTA_Y,
          height: CTA_HEIGHT,
          background: "var(--pv24-surface)",
          borderLeft: "6px solid var(--pv24-accent)",
          borderTop: "1px solid var(--pv24-border)",
          borderRight: "1px solid var(--pv24-border)",
          borderBottom: "1px solid var(--pv24-border)",
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          gap: 20,
        }}
        initial={skip ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={skip ? undefined : { duration: 0.4, delay: 1.15 }}
      >
        <span
          style={{
            fontFamily: "var(--pv24-font-mono)",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--pv24-accent)",
            flexShrink: 0,
          }}
        >
          The decision:
        </span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 22,
            color: "var(--pv24-text)",
            lineHeight: 1.2,
          }}
        >
          {callToAction}
        </span>
      </motion.div>

      {/* Subtle dashed control line at y=760 */}
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
        <line
          x1={80}
          y1={CONTROL_LINE_Y}
          x2={1780}
          y2={CONTROL_LINE_Y}
          stroke="var(--pv24-border)"
          strokeWidth={1}
          strokeDasharray="6 5"
        />
      </svg>
    </div>
  );
}
