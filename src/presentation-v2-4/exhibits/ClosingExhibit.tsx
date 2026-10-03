"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconMessageCircleQuestion, IconArrowRight } from "@tabler/icons-react";
import type { ClosingData } from "../data/types";

type Props = {
  data: ClosingData;
  title: string;
  subtitle: string;
  exportMode?: boolean;
};

const BG = "linear-gradient(135deg, #1E0033 0%, #3A0063 42%, #6A00AD 100%)";
const LIGHT = "#CC66FF";

export function ClosingExhibit({ data, title, subtitle, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  return (
    <div
      style={{ position: "absolute", inset: 0, background: BG, overflow: "hidden", fontFamily: "var(--pv24-font-family)", color: "#FFFFFF" }}
      aria-label="Questions and discussion"
    >
      {/* Echo of the cover orbits, bottom right */}
      <svg aria-hidden="true" width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {[200, 300, 420].map((r, i) => (
          <circle key={r} cx={1760} cy={980} r={r} fill="none" stroke="#FFFFFF" strokeOpacity={0.09 - i * 0.02} strokeWidth={1.5} strokeDasharray={i === 1 ? "4 10" : undefined} />
        ))}
      </svg>

      <motion.div
        initial={skip ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={skip ? undefined : { duration: 0.7, ease: "easeOut" }}
        style={{ position: "absolute", left: 120, top: 150, width: 720 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <IconMessageCircleQuestion size={64} color={LIGHT} stroke={1.5} />
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: LIGHT }}>Close</div>
        </div>
        <div style={{ fontSize: 200, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em", margin: "28px 0 52px" }}>Q&amp;A</div>
        <h1 style={{ margin: 0, fontSize: 52, fontWeight: 700, lineHeight: 1.1 }}>{title}</h1>
        <p style={{ margin: "20px 0 0", fontSize: 28, lineHeight: 1.35, color: "rgba(255,255,255,0.85)" }}>{subtitle}</p>
      </motion.div>

      <div style={{ position: "absolute", left: 960, top: 170, width: 840, display: "flex", flexDirection: "column", gap: 24 }}>
        {data.prompts.map((prompt, i) => (
          <motion.div
            key={prompt}
            initial={skip ? false : { opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={skip ? undefined : { duration: 0.5, delay: 0.5 + i * 0.25, ease: "easeOut" }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "30px 36px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderLeft: `6px solid ${LIGHT}`,
            }}
          >
            <span style={{ fontSize: 44, fontWeight: 700, color: LIGHT, minWidth: 64 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.25 }}>{prompt}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={skip ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={skip ? undefined : { duration: 0.5, delay: 1.4 }}
        style={{
          position: "absolute",
          left: 960,
          top: 760,
          width: 840,
          padding: "26px 36px",
          background: "#FFFFFF",
          color: "#1E0033",
          display: "flex",
          alignItems: "center",
          gap: 24,
          boxSizing: "border-box",
        }}
      >
        <IconArrowRight size={36} color="#A100FF" stroke={2.2} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7600BC" }}>The decision we ask for</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>{data.decision}</div>
        </div>
      </motion.div>

      <motion.div
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: 0.6, delay: 1.0 }}
        style={{ position: "absolute", left: 120, bottom: 110, display: "flex", alignItems: "stretch", gap: 28 }}
      >
        <div style={{ width: 4, background: LIGHT }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.75 }}>Presented by</div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{data.presenter}</div>
        </div>
      </motion.div>

      <div style={{ position: "absolute", right: 64, bottom: 44, fontSize: 16, color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>
        Synthetic institution and data
      </div>
    </div>
  );
}
