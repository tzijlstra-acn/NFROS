"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconBolt, IconCalendarEvent, IconCircleCheck, IconClock, IconSparkles } from "@tabler/icons-react";
import type { WorkdayProductData } from "@/presentation-v2-4/data/types";
import { STAGE_H, STAGE_W } from "@/presentation-v2-4/components/SlideStage";
import { ProductCapture, type ProductCaptureFocus } from "@/presentation-v2-4/product-proof/ProductCapture";
import { isAssetIdV24 } from "@/presentation-v2-4/product-proof/asset-registry";
import { getCaptureV24 } from "@/presentation-v2-4/product-proof/manifest";
import type { PresentationAssetIdV24 } from "@/presentation-v2-4/product-proof/types";

export interface WorkdayProductExhibitProps {
  data: WorkdayProductData;
  exportMode?: boolean;
}

// Layout on the 1920 x 780 exhibit stage. The whole captured home is shown at full stage
// height; callouts sit to its right, each centred on the focus box it explains where the
// column allows, so every link can run straight across.
const EDGE = 4;
const CAP_MAX_W = 900;
const LINK_GAP = 110;
const CALLOUT_W = 640;
const CALLOUT_H = 84;
const CALLOUT_GAP = 12;
const LINK_INSET = 20;
const MARKER = 10;
const ICON_BOX = 48;

// ProductCapture chrome for frame="plain", mirrored so the links meet its focus boxes
const CAP_BORDER = 1;
const FOCUS_PAD = 4;
// The state frame is drawn this far outside each focus box, so product text never touches it.
// Vertically the role home sections sit about 15 px apart, which leaves room for 1 px only.
const FRAME_EXT_X = 6;
const FRAME_EXT_Y = 1;
const CALLOUT_PAD = 26;

const SCOPE = "pv24-s06-capture";
const DONE_GREEN = "#1F7A45";

// Reveal, in seconds: the capture, then each state from top to bottom. Five states end at 3.5 s.
const CAPTURE_IN = 0.5;
const STATE_START = 0.4;
const STATE_STEP = 0.6;
const LINK_DELAY = 0.15;
const CALLOUT_DELAY = 0.3;
const STEP_DUR = 0.4;
const stateStart = (i: number) => STATE_START + i * STATE_STEP;

// State keys double as the manifest sub-region names of a role home capture
type StateKey = "now" | "ai-partner" | "next" | "meetings-actions" | "done";

type StateStyle = {
  icon: typeof IconBolt;
  /** Frame on the capture, link and marker */
  stroke: string;
  strokeWidth: number;
  dashed: boolean;
  ink: string;
  text: string;
  fill: string;
  iconFill: string;
  iconInk: string;
  shadow?: string;
  live?: boolean;
};

const STATES: Record<StateKey, StateStyle> = {
  // Needs attention this second: heaviest frame, solid accent, a live marker
  now: {
    icon: IconBolt,
    stroke: "var(--pv24-accent)",
    strokeWidth: 3,
    dashed: false,
    ink: "var(--pv24-accent)",
    text: "var(--pv24-text)",
    fill: "var(--pv24-surface)",
    iconFill: "var(--pv24-accent)",
    iconInk: "#FFFFFF",
    shadow: "0 6px 22px rgba(161, 0, 255, 0.14)",
    live: true,
  },
  // Prepared by the AI Partner: light purple, as the product marks AI work
  "ai-partner": {
    icon: IconSparkles,
    stroke: "var(--pv24-brand-purple-light)",
    strokeWidth: 2,
    dashed: false,
    ink: "var(--pv24-accent-dark)",
    text: "var(--pv24-text)",
    fill: "#F9F2FF",
    iconFill: "var(--pv24-surface)",
    iconInk: "var(--pv24-accent)",
  },
  // Comes later: dashed, not yet active
  next: {
    icon: IconClock,
    stroke: "var(--pv24-accent-dark)",
    strokeWidth: 2,
    dashed: true,
    ink: "var(--pv24-accent-dark)",
    text: "var(--pv24-text)",
    fill: "var(--pv24-surface)",
    iconFill: "var(--pv24-accent-lightest)",
    iconInk: "var(--pv24-accent-dark)",
  },
  // The day around the decision: solid dark purple, steady rather than urgent
  "meetings-actions": {
    icon: IconCalendarEvent,
    stroke: "var(--pv24-accent-dark)",
    strokeWidth: 2,
    dashed: false,
    ink: "var(--pv24-accent-dark)",
    text: "var(--pv24-text)",
    fill: "var(--pv24-surface)",
    iconFill: "var(--pv24-muted-bg)",
    iconInk: "var(--pv24-accent-dark)",
  },
  // Already done: quiet and receded, with a check
  done: {
    icon: IconCircleCheck,
    stroke: DONE_GREEN,
    strokeWidth: 2,
    dashed: false,
    ink: DONE_GREEN,
    text: "var(--pv24-text-secondary)",
    fill: "var(--pv24-muted-bg)",
    iconFill: "#E3F2E9",
    iconInk: DONE_GREEN,
  },
};

const STATE_BY_LABEL: Record<string, StateKey> = {
  now: "now",
  "ai partner": "ai-partner",
  next: "next",
  "your day": "meetings-actions",
  done: "done",
};

type Box = { x: number; y: number; w: number; h: number };

/** Capture size and position, and the stage box of each drawn state frame, from the manifest. */
function captureLayout(assetId: PresentationAssetIdV24) {
  const capture = getCaptureV24(assetId);
  const maxHeight = STAGE_H - 2 * EDGE;
  const innerH = maxHeight - 2 * CAP_BORDER;
  const width = capture
    ? Math.min(CAP_MAX_W, Math.round((capture.width * innerH) / capture.height) + 2 * CAP_BORDER)
    : Math.round(maxHeight * 1.08);
  const scale = capture ? (width - 2 * CAP_BORDER) / capture.width : 0;
  const height = capture ? Math.min(maxHeight, Math.round(capture.height * scale) + 2 * CAP_BORDER) : maxHeight;
  const x = Math.round((STAGE_W - (width + LINK_GAP + CALLOUT_W)) / 2);
  const y = Math.round((STAGE_H - height) / 2);
  const focusBox = (region: string): Box | null => {
    const r = capture?.subRegions[region];
    if (!r) return null;
    const padX = FOCUS_PAD + FRAME_EXT_X;
    const padY = FOCUS_PAD + FRAME_EXT_Y;
    return {
      x: x + CAP_BORDER + r.x * scale - padX,
      y: y + CAP_BORDER + r.y * scale - padY,
      w: r.width * scale + 2 * padX,
      h: r.height * scale + 2 * padY,
    };
  };
  return { x, y, width, maxHeight, calloutX: x + width + LINK_GAP, focusBox };
}

// Callout tops for targets sorted top to bottom. Each callout is centred on its target where
// it can be; callouts that would overlap move as one group, centred on the mean of their
// targets and kept inside the stage, so the offset is shared rather than pushed onto one.
function placeTops(targets: readonly number[]): number[] {
  const pitch = CALLOUT_H + CALLOUT_GAP;
  const lo = EDGE;
  const hi = STAGE_H - EDGE - CALLOUT_H;
  // sum: the group top each member asks for, added up
  type Group = { count: number; sum: number; top: number };
  const settle = (count: number, sum: number): Group => ({
    count,
    sum,
    top: Math.min(Math.max(sum / count, lo), hi - (count - 1) * pitch),
  });
  const groups: Group[] = [];
  for (const t of targets) {
    let group = settle(1, t - CALLOUT_H / 2);
    let prev = groups[groups.length - 1];
    while (prev && prev.top + prev.count * pitch > group.top) {
      groups.pop();
      group = settle(prev.count + group.count, prev.sum + group.sum - prev.count * group.count * pitch);
      prev = groups[groups.length - 1];
    }
    groups.push(group);
  }
  return groups.flatMap((g) => Array.from({ length: g.count }, (_, k) => Math.round(g.top + k * pitch)));
}

// Restyles the capture's focus boxes per state: the plain box border gives way to a state
// frame drawn slightly wider than the box. Its chip label is hidden; the callouts carry it.
function captureCss(order: readonly StateKey[], animate: boolean): string {
  const sel = (key: StateKey) => `.${SCOPE} [data-focus-region=${key}]`;
  const rules = [
    `.${SCOPE} [data-focus-region] { border: none !important; }`,
    `.${SCOPE} [data-focus-region] span { display: none; }`,
    `.${SCOPE} [data-focus-region]::before { content: ""; position: absolute; inset: -${FRAME_EXT_Y}px -${FRAME_EXT_X}px; box-sizing: border-box; pointer-events: none; }`,
  ];
  for (const key of order) {
    const st = STATES[key];
    rules.push(`${sel(key)}::before { border: ${st.strokeWidth}px ${st.dashed ? "dashed" : "solid"} ${st.stroke}; }`);
  }
  if (animate) {
    rules.push(`@keyframes ${SCOPE}-in { from { opacity: 0; transform: scale(1.03); } to { opacity: 1; transform: none; } }`);
    order.forEach((key, i) => {
      rules.push(`${sel(key)} { animation: ${SCOPE}-in ${STEP_DUR}s ease-out ${stateStart(i)}s both; }`);
    });
  }
  return rules.join("\n");
}

type LinkProps = { from: Box; toX: number; top: number; st: StateStyle; delay: number; skip: boolean };

// Square marker on the focus box edge, then a line to the callout's left edge
function Link({ from, toX, top, st, delay, skip }: LinkProps) {
  const x0 = from.x + from.w;
  const y0 = from.y + from.h / 2;
  const y1 = Math.min(Math.max(y0, top + LINK_INSET), top + CALLOUT_H - LINK_INSET);
  const left = x0 - MARKER;
  const minY = Math.min(y0, y1) - MARKER;
  const w = toX - left;
  const h = Math.abs(y1 - y0) + 2 * MARKER;
  const lx = (x: number) => x - left;
  const ly = (y: number) => y - minY;
  const xm = toX - LINK_GAP / 2;
  const d =
    Math.abs(y1 - y0) < 0.5
      ? `M ${lx(x0)} ${ly(y0)} H ${lx(toX)}`
      : `M ${lx(x0)} ${ly(y0)} H ${lx(xm)} V ${ly(y1)} H ${lx(toX)}`;
  return (
    <motion.svg
      aria-hidden="true"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      initial={skip ? false : { clipPath: "inset(0% 100% 0% 0%)" }}
      animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
      transition={skip ? undefined : { delay, duration: STEP_DUR, ease: "easeOut" }}
      style={{ position: "absolute", left, top: minY, pointerEvents: "none" }}
    >
      <path
        d={d}
        fill="none"
        strokeDasharray={st.dashed ? "7 5" : undefined}
        style={{ stroke: st.stroke, strokeWidth: st.strokeWidth }}
      />
      <rect x={lx(x0) - MARKER / 2} y={ly(y0) - MARKER / 2} width={MARKER} height={MARKER} style={{ fill: st.stroke }} />
    </motion.svg>
  );
}

type CalloutProps = {
  stateKey: StateKey;
  label: string;
  meaning: string;
  x: number;
  top: number;
  delay: number;
  pulseDelay: number;
  skip: boolean;
};

function Callout({ stateKey, label, meaning, x, top, delay, pulseDelay, skip }: CalloutProps) {
  const st = STATES[stateKey];
  const Icon = st.icon;
  return (
    <motion.div
      data-workday-state={stateKey}
      initial={skip ? false : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={skip ? undefined : { delay, duration: STEP_DUR, ease: "easeOut" }}
      style={{
        position: "absolute",
        left: x,
        top,
        width: CALLOUT_W,
        height: CALLOUT_H,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 20,
        // Same content position whatever the border weight
        padding: `0 ${CALLOUT_PAD - st.strokeWidth}px`,
        background: st.fill,
        border: `${st.strokeWidth}px ${st.dashed ? "dashed" : "solid"} ${st.stroke}`,
        boxShadow: st.shadow,
      }}
    >
      <div
        style={{
          width: ICON_BOX,
          height: ICON_BOX,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: st.iconFill,
        }}
      >
        <Icon size={28} stroke={2} color={st.iconInk} aria-hidden="true" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 16,
            lineHeight: "20px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: st.ink,
          }}
        >
          {label}
          {st.live ? (
            <motion.span
              aria-hidden="true"
              style={{ width: 10, height: 10, borderRadius: "50%", background: st.stroke, display: "inline-block" }}
              animate={skip ? undefined : { opacity: [1, 0.25, 1] }}
              transition={skip ? undefined : { duration: 1.6, repeat: Infinity, delay: pulseDelay }}
            />
          ) : null}
        </div>
        <div style={{ fontSize: 24, lineHeight: "30px", fontWeight: 600, color: st.text, whiteSpace: "nowrap" }}>{meaning}</div>
      </div>
    </motion.div>
  );
}

export function WorkdayProductExhibit({ data, exportMode = false }: WorkdayProductExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const assetId: PresentationAssetIdV24 = isAssetIdV24(data.assetId) ? data.assetId : "or-home";
  const cap = captureLayout(assetId);

  const known = data.focusAnnotations.flatMap((a) => {
    const key = STATE_BY_LABEL[a.label.trim().toLowerCase()];
    return key ? [{ key, label: a.label, meaning: a.meaning, focus: cap.focusBox(key) }] : [];
  });
  const states = known
    .map((s, i) => ({ ...s, target: s.focus ? s.focus.y + s.focus.h / 2 : ((i + 1) * STAGE_H) / (known.length + 1) }))
    .sort((a, b) => a.target - b.target);
  const tops = placeTops(states.map((s) => s.target));
  const focus: ProductCaptureFocus[] = states.filter((s) => s.focus).map((s) => ({ region: s.key, label: s.label }));
  const revealEnd = stateStart(Math.max(0, states.length - 1)) + CALLOUT_DELAY + STEP_DUR;

  return (
    <div
      role="group"
      aria-label="Operational Risk Partner home with Now, AI Partner, Next, Your day and Done marked"
      style={{ position: "absolute", inset: 0, background: "var(--pv24-canvas)", fontFamily: "var(--pv24-font-family)", overflow: "hidden" }}
    >
      <style dangerouslySetInnerHTML={{ __html: captureCss(states.map((s) => s.key), !skip) }} />
      <motion.div
        className={SCOPE}
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={skip ? undefined : { duration: CAPTURE_IN, ease: "easeOut" }}
        style={{ position: "absolute", left: cap.x, top: cap.y, width: cap.width, boxShadow: "0 2px 24px rgba(0, 0, 0, 0.08)" }}
      >
        <ProductCapture assetId={assetId} width={cap.width} maxHeight={cap.maxHeight} frame="plain" focus={focus} />
      </motion.div>

      {states.map((s, i) =>
        s.focus ? (
          <Link
            key={`link-${s.key}`}
            from={s.focus}
            toX={cap.calloutX}
            top={tops[i] ?? 0}
            st={STATES[s.key]}
            delay={stateStart(i) + LINK_DELAY}
            skip={skip}
          />
        ) : null,
      )}

      {states.map((s, i) => (
        <Callout
          key={s.key}
          stateKey={s.key}
          label={s.label}
          meaning={s.meaning}
          x={cap.calloutX}
          top={tops[i] ?? 0}
          delay={stateStart(i) + CALLOUT_DELAY}
          pulseDelay={revealEnd}
          skip={skip}
        />
      ))}
    </div>
  );
}
