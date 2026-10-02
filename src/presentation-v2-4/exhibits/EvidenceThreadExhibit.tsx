"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconDatabase,
  IconSparkles,
  IconUserCheck,
  IconClipboardCheck,
  IconSend,
  IconReceipt,
  IconLock,
  IconCheck,
  IconLink,
} from "@tabler/icons-react";
import type { EvidenceThreadData } from "../data/types";

export type EvidenceThreadExhibitProps = {
  data: EvidenceThreadData;
  exportMode?: boolean;
};

// Drawn on the 1920 x 780 exhibit stage
const W = 1920;
const H = 780;
const LEFT = 60;
const COL_W = (1860 - LEFT) / 7;
const CARD_W = 236;
const CARD_TOP = 172;
const CARD_H = 272;
const LABEL_Y = 44;
const THREAD_Y = 116;
const NODE_R = 26;
const AUDIT_Y = 484;
const STEP_GAP = 0.65;

type StepContent = {
  icon: typeof IconDatabase;
  done: string;
  lines: [string, string];
};

// Illustrative content for one synthetic case, step by step
const STEP_CONTENT: StepContent[] = [
  { icon: IconDatabase, done: "Sources captured", lines: ["SOC 2 report, contract and 3 incident logs pulled", "All sources dated within 30 days"] },
  { icon: IconSparkles, done: "AI prepared", lines: ["Risk assessment drafted", "2 control gaps flagged, each linked to evidence"] },
  { icon: IconUserCheck, done: "Decision taken", lines: ["TPRM lead rates residual risk Medium", "Rationale captured in own words"] },
  { icon: IconClipboardCheck, done: "Approved", lines: ["Head of TPRM approves with 1 condition", "Approval bound to this exact version"] },
  { icon: IconSend, done: "Executed", lines: ["Contract condition sent to vendor portal", "Remediation owner assigned in GRC"] },
  { icon: IconReceipt, done: "Receipt returned", lines: ["Vendor portal acknowledged at 15:02", "Receipt linked to the approval record"] },
  { icon: IconLock, done: "Audit sealed", lines: ["Immutable record AUD-117 written", "Who, what, when and why, all linked"] },
];

const PROOF_FACTS = [
  { icon: IconLink, text: "Every step is linked to one audit record" },
  { icon: IconUserCheck, text: "Every action names the acting user and role" },
  { icon: IconReceipt, text: "Receipts come from the target system, not from the AI" },
];

function colX(i: number): number {
  return LEFT + COL_W * (i + 0.5);
}

export function EvidenceThreadExhibit({ data, exportMode }: EvidenceThreadExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  const steps = data.steps.slice(0, STEP_CONTENT.length);
  const lastBase = 0.3 + (steps.length - 1) * STEP_GAP;
  const annotationFor = (i: number) => data.proofAnnotations.find((a) => a.stepIndex === i)?.label;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
      aria-label="Evidence thread exhibit"
    >
      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: 0,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--pv24-accent)",
        }}
      >
        Synthetic case TPRM-2291: Tier 1 cloud provider renewal
      </div>

      <svg aria-hidden="true" width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <line x1={colX(0)} y1={THREAD_Y} x2={colX(steps.length - 1)} y2={THREAD_Y} stroke="var(--pv24-border)" strokeWidth={4} />

        {steps.map((_, i) => {
          if (i === 0) return null;
          const base = 0.3 + i * STEP_GAP;
          return (
            <motion.line
              key={`seg-${i}`}
              x1={colX(i - 1) + NODE_R}
              y1={THREAD_Y}
              x2={colX(i) - NODE_R}
              y2={THREAD_Y}
              stroke="var(--pv24-accent)"
              strokeWidth={4}
              initial={skip ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={skip ? undefined : { duration: 0.32, delay: base - 0.34, ease: "easeInOut" }}
            />
          );
        })}

        {steps.map((_, i) => (
          <line
            key={`stem-${i}`}
            x1={colX(i)}
            y1={THREAD_Y + NODE_R}
            x2={colX(i)}
            y2={CARD_TOP}
            stroke="var(--pv24-border-strong)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        ))}

        <rect x={LEFT} y={AUDIT_Y + 30} width={1800} height={12} fill="var(--pv24-border)" />
      </svg>

      {steps.map((step, i) => {
        const content = STEP_CONTENT[i];
        if (content === undefined) return null;
        const Icon = content.icon;
        const base = 0.3 + i * STEP_GAP;
        const cx = colX(i);
        const annotation = annotationFor(i);

        return (
          <React.Fragment key={step.label}>
            <motion.div
              initial={skip ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={skip ? undefined : { duration: 0.25, delay: base }}
              style={{
                position: "absolute",
                left: cx - COL_W / 2,
                top: LABEL_Y,
                width: COL_W,
                textAlign: "center",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--pv24-text)",
              }}
            >
              {step.label}
            </motion.div>

            {/* Node: outlined while working, filled with a tick once linked */}
            <motion.div
              initial={skip ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={skip ? undefined : { duration: 0.3, delay: base, ease: "backOut" }}
              style={{
                position: "absolute",
                left: cx - NODE_R,
                top: THREAD_Y - NODE_R,
                width: NODE_R * 2,
                height: NODE_R * 2,
                borderRadius: "50%",
                background: "var(--pv24-surface)",
                border: "3px solid var(--pv24-accent)",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--pv24-accent)",
              }}
            >
              {i + 1}
            </motion.div>
            <motion.div
              initial={skip ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={skip ? undefined : { duration: 0.25, delay: base + 0.62 }}
              style={{
                position: "absolute",
                left: cx - NODE_R,
                top: THREAD_Y - NODE_R,
                width: NODE_R * 2,
                height: NODE_R * 2,
                borderRadius: "50%",
                background: "var(--pv24-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCheck size={28} color="#FFFFFF" stroke={2.5} />
            </motion.div>

            {/* Evidence card: loads, then shows what was done */}
            <motion.div
              initial={skip ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={skip ? undefined : { duration: 0.3, delay: base + 0.08 }}
              style={{
                position: "absolute",
                left: cx - CARD_W / 2,
                top: CARD_TOP,
                width: CARD_W,
                height: CARD_H,
                background: "var(--pv24-surface)",
                borderTop: "4px solid var(--pv24-accent)",
                boxShadow: "0 6px 20px rgba(17, 18, 20, 0.08)",
                padding: "14px 16px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={22} color="var(--pv24-accent)" stroke={1.7} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--pv24-accent-dark)",
                  }}
                >
                  {content.done}
                </span>
              </div>

              <div style={{ position: "relative", flex: 1 }}>
                {!skip && (
                  <motion.div
                    aria-hidden="true"
                    style={{ position: "absolute", left: 0, right: 0, top: 4, height: 6, background: "var(--pv24-muted-bg)" }}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.15, delay: base + 0.6 }}
                  >
                    <motion.div
                      style={{ height: "100%", background: "var(--pv24-accent-lightest)", borderRight: "2px solid var(--pv24-accent)" }}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 0.45, delay: base + 0.14, ease: "easeInOut" }}
                    />
                  </motion.div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {content.lines.map((line, j) => (
                    <motion.div
                      key={line}
                      initial={skip ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={skip ? undefined : { duration: 0.25, delay: base + 0.62 + j * 0.08 }}
                      style={{
                        fontSize: 16,
                        lineHeight: 1.3,
                        color: j === 0 ? "var(--pv24-text)" : "var(--pv24-text-secondary)",
                        fontWeight: j === 0 ? 600 : 400,
                      }}
                    >
                      {line}
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.div
                initial={skip ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={skip ? undefined : { duration: 0.25, delay: base + 0.8 }}
                style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
              >
                {annotation !== undefined && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 8px",
                      background: "var(--pv24-accent-lightest)",
                      color: "var(--pv24-accent-dark)",
                    }}
                  >
                    {annotation}
                  </span>
                )}
                {step.hasProductProof === true && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 8px",
                      border: "1px solid var(--pv24-border-strong)",
                      color: "var(--pv24-text-secondary)",
                    }}
                  >
                    Product capture
                  </span>
                )}
              </motion.div>
            </motion.div>

            {/* This step's link in the audit thread */}
            <motion.div
              initial={skip ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={skip ? undefined : { duration: 0.3, delay: base + 0.85 }}
              style={{
                position: "absolute",
                left: cx - COL_W / 2 + 3,
                top: AUDIT_Y + 30,
                width: COL_W - 6,
                height: 12,
                background: "var(--pv24-accent)",
                transformOrigin: "left center",
              }}
            />
          </React.Fragment>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: AUDIT_Y,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--pv24-text-secondary)",
        }}
      >
        Audit thread: one record grows with every step
      </div>

      <motion.div
        initial={skip ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={skip ? undefined : { duration: 0.4, delay: lastBase + 1.0 }}
        style={{
          position: "absolute",
          left: LEFT,
          top: 584,
          width: 1800,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 24,
        }}
      >
        {PROOF_FACTS.map((fact) => {
          const FactIcon = fact.icon;
          return (
            <div
              key={fact.text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "18px 22px",
                background: "var(--pv24-surface)",
                borderLeft: "4px solid var(--pv24-brand-purple-dark)",
              }}
            >
              <FactIcon size={30} color="var(--pv24-brand-purple-dark)" stroke={1.6} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 19, fontWeight: 600, color: "var(--pv24-text)", lineHeight: 1.3 }}>{fact.text}</span>
            </div>
          );
        })}
      </motion.div>

      <div
        style={{
          position: "absolute",
          right: 60,
          top: 728,
          fontSize: 13,
          fontStyle: "italic",
          color: "var(--pv24-text-secondary)",
        }}
      >
        Illustrative: synthetic institution and data
      </div>
    </div>
  );
}
