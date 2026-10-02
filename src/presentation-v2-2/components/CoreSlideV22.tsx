"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { CoreSlide22, Outcome, ServiceLayer, ProcessRow, RolloutStep } from "../data/types";
import { MotionPath } from "../motion/MotionPath";
import { RevealSequence } from "../motion/RevealSequence";
import { AppendixRefBar } from "./AppendixRefBar";

export interface CoreSlideV22Props {
  slide: CoreSlide22;
  slideIndex: number;
  totalCoreSlides: number;
  exportMode?: boolean;
  showNotes?: boolean;
  onGoToAppendix: (appendixId: string, fromCoreIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Slide 1: Hero
// ---------------------------------------------------------------------------

function HeroContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const lines = slide.heroLines ?? [];
  return (
    <div className="pv22-layout-hero">
      <h1 className="pv22-title" style={{ textAlign: "center" }}>{slide.title}</h1>
      {slide.subtitle != null && <p className="pv22-subtitle">{slide.subtitle}</p>}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--pv22-space-4)", marginTop: "var(--pv22-space-4)" }}>
        {lines.map((line, i) => (
          <MotionPath key={i} variant="hero-line" index={i} exportMode={exportMode}>
            <p className="pv22-emphasis" style={{ textAlign: "center", color: "var(--pv22-color-accent)", margin: 0 }}>{line}</p>
          </MotionPath>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 2: Agenda list
// ---------------------------------------------------------------------------

function ListContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const items = slide.agendaItems ?? [];
  if (items.length === 0) return <ContentSlide slide={slide} exportMode={exportMode} />;
  return (
    <div className="pv22-layout-list">
      <h1 className="pv22-title">{slide.title}</h1>
      {slide.subtitle != null && <p className="pv22-subtitle">{slide.subtitle}</p>}
      <RevealSequence exportMode={exportMode}>
        {items.map((item, i) => (
          <div key={i} className="pv22-agenda-item">
            <span className="pv22-agenda-item__number">{String(i + 1).padStart(2, "0")}</span>
            <span className="pv22-agenda-item__label">{item.text}</span>
          </div>
        ))}
      </RevealSequence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic content slide (split, flow, three-layer, two-column fallback)
// Large title, staggered bullets, emphasis in purple accent bar
// ---------------------------------------------------------------------------

function ContentSlide({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const bullets = slide.bullets ?? [];
  const emphasisLines = slide.emphasis ?? [];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: "80px 120px",
        gap: 40,
      }}
    >
      {/* Title + subtitle */}
      {skip ? (
        <div>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle != null && <p className="pv22-subtitle" style={{ marginTop: 16 }}>{slide.subtitle}</p>}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0, 0, 0.2, 1] }}>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle != null && <p className="pv22-subtitle" style={{ marginTop: 16 }}>{slide.subtitle}</p>}
        </motion.div>
      )}

      {/* Bullets */}
      {bullets.length > 0 && (
        <ul className="pv22-bullets" style={{ flex: bullets.length > 3 ? 1 : "none" }}>
          {bullets.map((bullet, i) =>
            skip ? (
              <li key={i} className="pv22-bullet">{bullet}</li>
            ) : (
              <motion.li
                key={i}
                className="pv22-bullet"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay: 0.2 + i * 0.12 }}
              >
                {bullet}
              </motion.li>
            )
          )}
        </ul>
      )}

      {/* Emphasis lines — purple accent bar */}
      {emphasisLines.length > 0 && (
        <div
          style={{
            borderLeft: "4px solid var(--pv22-color-accent)",
            paddingLeft: 32,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {emphasisLines.map((line, i) =>
            skip ? (
              <p key={i} className="pv22-emphasis" style={{ color: "var(--pv22-color-accent)", margin: 0 }}>{line}</p>
            ) : (
              <motion.p
                key={i}
                className="pv22-emphasis"
                style={{ color: "var(--pv22-color-accent)", margin: 0 }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay: 0.35 + bullets.length * 0.12 + i * 0.15 }}
              >
                {line}
              </motion.p>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 6: Two-column (role comparison)
// ---------------------------------------------------------------------------

function TwoColumnContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const cols = slide.roleColumns ?? [];

  if (cols.length === 0) return <ContentSlide slide={slide} exportMode={exportMode} />;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "72px 80px", gap: 40 }}>
      {skip ? (
        <div>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </motion.div>
      )}

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${Math.min(cols.length, 3)}, 1fr)`, gap: 24 }}>
        {cols.map((col, i) =>
          skip ? (
            <div key={i} style={{ background: "var(--pv22-color-surface)", border: "1px solid var(--pv22-color-border)", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ borderBottom: "3px solid var(--pv22-color-accent)", paddingBottom: 12 }}>
                <p style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-xl)", fontWeight: 700, color: "var(--pv22-color-text)", margin: 0 }}>{col.role}</p>
              </div>
              <RoleDetail label="Daily focus" value={col.dailyFocus} />
              <RoleDetail label="Installed app" value={col.installedApp} />
              <RoleDetail label="Human judgment" value={col.humanJudgment} />
            </div>
          ) : (
            <motion.div
              key={i}
              style={{ background: "var(--pv22-color-surface)", border: "1px solid var(--pv22-color-border)", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 20 }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0, 0, 0.2, 1], delay: 0.15 + i * 0.1 }}
            >
              <div style={{ borderBottom: "3px solid var(--pv22-color-accent)", paddingBottom: 12 }}>
                <p style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-xl)", fontWeight: 700, color: "var(--pv22-color-text)", margin: 0 }}>{col.role}</p>
              </div>
              <RoleDetail label="Daily focus" value={col.dailyFocus} />
              <RoleDetail label="Installed app" value={col.installedApp} />
              <RoleDetail label="Human judgment" value={col.humanJudgment} />
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}

function RoleDetail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: "var(--pv22-font-mono)", fontSize: "var(--pv22-text-xs)", color: "var(--pv22-color-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-base)", color: "var(--pv22-color-text)", lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 7: Process rows
// ---------------------------------------------------------------------------

function ProcessRowsContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const rows = slide.processRows ?? [];

  if (rows.length === 0) return <ContentSlide slide={slide} exportMode={exportMode} />;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "72px 80px", gap: 48 }}>
      {skip ? (
        <div>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </motion.div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 48 }}>
        {rows.map((row, ri) =>
          skip ? (
            <ProcessRail key={ri} row={row} />
          ) : (
            <motion.div key={ri} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0, 0, 0.2, 1], delay: 0.2 + ri * 0.15 }}>
              <ProcessRail row={row} />
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}

function ProcessRail({ row }: { row: ProcessRow }) {
  const { label, stages, currentStageIndex } = row;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-lg)", fontWeight: 600, color: "var(--pv22-color-text)" }}>{label}</span>
      <div className="pv22-process-row">
        {stages.map((stageName, i) => (
          <span
            key={i}
            className="pv22-stage-chip"
            data-active={i === currentStageIndex ? "true" : undefined}
            style={{ opacity: i > currentStageIndex ? 0.45 : 1 }}
          >
            {stageName}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 9: Outcome grid (before → after)
// ---------------------------------------------------------------------------

const BEFORE_LABELS: Record<number, string> = { 0: "Assembly", 1: "Coordination", 2: "Waiting", 3: "Reconstruction" };
const AFTER_LABELS: Record<number, string> = { 0: "Preparation", 1: "Judgment", 2: "Continuous process", 3: "Traceability" };

function OutcomeGridContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const outcomes = slide.outcomes ?? [];

  if (outcomes.length === 0) return <ContentSlide slide={slide} exportMode={exportMode} />;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "72px 100px", gap: 40 }}>
      {skip ? (
        <div>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </motion.div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, justifyContent: "center" }}>
        {outcomes.slice(0, 4).map((outcome, i) => {
          const beforeLabel = BEFORE_LABELS[i] ?? outcome.title;
          const afterLabel = AFTER_LABELS[i] ?? outcome.support;
          const delay = 0.25 + i * 0.15;
          const row = (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 1fr", alignItems: "center", minHeight: 80 }}>
              <div style={{ padding: "20px 28px", background: "var(--pv22-color-muted-bg)", border: "1px solid var(--pv22-color-border)" }}>
                <span style={{ fontFamily: "var(--pv22-font-mono)", fontSize: "var(--pv22-text-xs)", color: "var(--pv22-color-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Before</span>
                <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-md)", fontWeight: 600, color: "var(--pv22-color-text)" }}>{beforeLabel}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
                <svg viewBox="0 0 32 20" width={32} height={20} fill="none">
                  <path d="M0 10 H24 M18 3 L24 10 L18 17" stroke="var(--pv22-color-accent)" strokeWidth={2} strokeLinecap="square" />
                </svg>
              </div>
              <div style={{ padding: "20px 28px", background: "var(--pv22-brand-purple-lightest)", border: "1px solid var(--pv22-brand-purple-light)", borderLeft: "4px solid var(--pv22-color-accent)" }}>
                <span style={{ fontFamily: "var(--pv22-font-mono)", fontSize: "var(--pv22-text-xs)", color: "var(--pv22-brand-purple)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>With NFR OS</span>
                <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-md)", fontWeight: 600, color: "var(--pv22-brand-purple-dark)" }}>{afterLabel}</span>
              </div>
            </div>
          );

          return skip ? <div key={i}>{row}</div> : (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay }}>
              {row}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 11: Service stack (layered architecture)
// ---------------------------------------------------------------------------

const LAYER_STYLES: Record<ServiceLayer["semanticType"], { bg: string; border: string; color: string }> = {
  "managed-service": { bg: "var(--pv22-brand-purple-lightest)", border: "var(--pv22-color-accent)", color: "var(--pv22-brand-purple-dark)" },
  "role-app":        { bg: "var(--pv22-color-surface)", border: "var(--pv22-color-accent)", color: "var(--pv22-color-text)" },
  "function":        { bg: "var(--pv22-color-surface)", border: "var(--pv22-color-border)", color: "var(--pv22-color-text)" },
  "platform":        { bg: "var(--pv22-color-muted-bg)", border: "var(--pv22-color-border)", color: "var(--pv22-color-secondary)" },
};

function ServiceStackContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const layers = slide.serviceLayers ?? [];

  if (layers.length === 0) return <ContentSlide slide={slide} exportMode={exportMode} />;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "72px 100px", gap: 40 }}>
      {skip ? (
        <div>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </motion.div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
        {layers.map((layer, i) => {
          const s = LAYER_STYLES[layer.semanticType];
          const delay = 0.2 + i * 0.12;
          const band = (
            <div style={{ padding: "20px 32px", background: s.bg, border: `1px solid ${s.border}`, borderLeft: layer.semanticType === "managed-service" ? `4px solid ${s.border}` : `1px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-lg)", fontWeight: 600, color: s.color, display: "block" }}>{layer.name}</span>
                <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-sm)", color: "var(--pv22-color-secondary)", marginTop: 4, display: "block" }}>{layer.detail}</span>
              </div>
              <span style={{ fontFamily: "var(--pv22-font-mono)", fontSize: "var(--pv22-text-xs)", color: "var(--pv22-color-secondary)", whiteSpace: "nowrap" }}>{layer.cadence}</span>
            </div>
          );

          return skip ? <div key={i}>{band}</div> : (
            <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1], delay }}>
              {band}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 12: Rollout steps
// ---------------------------------------------------------------------------

function RolloutStepsContent({ slide, exportMode }: { slide: CoreSlide22; exportMode?: boolean }) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const steps = slide.rolloutSteps ?? [];

  if (steps.length === 0) return <ContentSlide slide={slide} exportMode={exportMode} />;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "72px 100px", gap: 48 }}>
      {skip ? (
        <div>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}>
          <h1 className="pv22-title">{slide.title}</h1>
          {slide.subtitle && <p className="pv22-subtitle" style={{ marginTop: 12 }}>{slide.subtitle}</p>}
        </motion.div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "row", gap: 32, alignItems: "stretch" }}>
        {steps.map((step, i) => {
          const delay = 0.2 + i * 0.15;
          const card = (
            <div style={{ flex: 1, background: "var(--pv22-color-surface)", border: "1px solid var(--pv22-color-border)", display: "flex", flexDirection: "column" }}>
              {/* Badge header */}
              <div style={{ background: "var(--pv22-color-accent)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "var(--pv22-font-mono)", fontSize: "var(--pv22-text-lg)", fontWeight: 700, color: "#fff" }}>{String(step.number).padStart(2, "0")}</span>
                <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-base)", fontWeight: 600, color: "#fff" }}>{step.title}</span>
              </div>
              {/* Actions */}
              <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                {step.actions.map((action, ai) => (
                  <div key={ai} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--pv22-color-accent)", fontFamily: "var(--pv22-font-mono)", fontSize: "var(--pv22-text-xs)", marginTop: 2, flexShrink: 0 }}>+</span>
                    <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-sm)", color: "var(--pv22-color-text)", lineHeight: 1.45 }}>{action}</span>
                  </div>
                ))}
              </div>
              {/* Exit proof */}
              <div style={{ padding: "12px 24px", background: "var(--pv22-color-muted-bg)", borderTop: "1px solid var(--pv22-color-border)" }}>
                <span style={{ fontFamily: "var(--pv22-font-mono)", fontSize: "var(--pv22-text-xs)", color: "var(--pv22-color-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Exit: </span>
                <span style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-xs)", color: "var(--pv22-color-text)" }}>{step.exitProof}</span>
              </div>
            </div>
          );

          return skip ? <div key={i} style={{ flex: 1 }}>{card}</div> : (
            <motion.div key={i} style={{ flex: 1 }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0, 0, 0.2, 1], delay }}>
              {card}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide 13: Next step
// ---------------------------------------------------------------------------

function NextStepContent({ slide }: { slide: CoreSlide22 }) {
  const bullets = slide.nextStepBullets ?? [];
  const outcome = slide.nextStepOutcome;
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "var(--pv22-space-8)", padding: "var(--pv22-space-12) var(--pv22-space-16)", height: "100%" }}>
      <h1 className="pv22-title">{slide.title}</h1>
      {slide.subtitle != null && <p className="pv22-subtitle">{slide.subtitle}</p>}
      <ul className="pv22-bullets">
        {bullets.map((bullet, i) => <li key={i} className="pv22-bullet">{bullet}</li>)}
      </ul>
      {outcome != null && (
        <div style={{ marginTop: "var(--pv22-space-6)", padding: "var(--pv22-space-6) var(--pv22-space-8)", background: "var(--pv22-brand-purple-lightest)", borderLeft: "4px solid var(--pv22-color-accent)" }}>
          <p className="pv22-emphasis" style={{ color: "var(--pv22-brand-purple-darkest)", margin: 0 }}>{outcome}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout dispatcher
// ---------------------------------------------------------------------------

function renderLayout(slide: CoreSlide22, exportMode?: boolean): React.ReactNode {
  switch (slide.layout) {
    case "hero":
      return <HeroContent slide={slide} exportMode={exportMode} />;
    case "list":
      return <ListContent slide={slide} exportMode={exportMode} />;
    case "next-step":
      return <NextStepContent slide={slide} />;
    case "two-column":
      return <TwoColumnContent slide={slide} exportMode={exportMode} />;
    case "process-rows":
      return <ProcessRowsContent slide={slide} exportMode={exportMode} />;
    case "outcome-grid":
      return <OutcomeGridContent slide={slide} exportMode={exportMode} />;
    case "service-stack":
      return <ServiceStackContent slide={slide} exportMode={exportMode} />;
    case "rollout-steps":
      return <RolloutStepsContent slide={slide} exportMode={exportMode} />;
    case "split":
    case "three-layer":
    case "flow":
      return <ContentSlide slide={slide} exportMode={exportMode} />;
    default: {
      const _unknown = slide.layout;
      void _unknown;
      return <ContentSlide slide={slide} exportMode={exportMode} />;
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoreSlideV22({
  slide,
  slideIndex,
  totalCoreSlides,
  exportMode = false,
  showNotes = false,
  onGoToAppendix,
}: CoreSlideV22Props) {
  const notesHeightPx = showNotes ? 180 : 0;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      {slide.section.length > 0 && (
        <span className="pv22-section-label" aria-hidden="true">{slide.section}</span>
      )}

      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", height: showNotes ? `calc(100% - ${notesHeightPx}px)` : "100%" }}>
        {renderLayout(slide, exportMode)}
      </div>

      <AppendixRefBar appendixRefs={slide.appendixRefs} coreIndex={slideIndex - 1} onGoToAppendix={onGoToAppendix} />

      {showNotes && (
        <div aria-label="Speaker notes" style={{ height: notesHeightPx, flexShrink: 0, background: "rgba(23, 32, 51, 0.94)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "var(--pv22-space-4) var(--pv22-space-8)", overflow: "hidden" }}>
          <p style={{ fontFamily: "var(--pv22-font-mono)", fontSize: "var(--pv22-text-xs)", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, marginBottom: "var(--pv22-space-2)" }}>Notes</p>
          <p style={{ fontFamily: "var(--pv22-font-family)", fontSize: "var(--pv22-text-sm)", color: "rgba(255,255,255,0.82)", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {slide.speakerNotes}
          </p>
        </div>
      )}

      {slide.footer != null && slide.footer.length > 0 && (
        <div className="pv22-footer" aria-hidden="true">{slide.footer}</div>
      )}

      <span className="pv22-slide-number" aria-label={`Slide ${slideIndex} of ${totalCoreSlides}`}>
        {slideIndex} / {totalCoreSlides}
      </span>
    </div>
  );
}
