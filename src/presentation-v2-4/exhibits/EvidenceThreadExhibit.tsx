"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconBan, IconHistory, IconUserCheck } from "@tabler/icons-react";
import type { EvidenceThreadData, EvidenceThreadStep } from "../data/types";
import { ProductCapture, measureProductCapture, type ProductCaptureFocus } from "../product-proof/ProductCapture";
import { getAssetV24, isAssetIdV24 } from "../product-proof/asset-registry";
import { getCaptureV24 } from "../product-proof/manifest";
import type { PresentationAssetIdV24 } from "../product-proof/types";

export type EvidenceThreadExhibitProps = {
  data: EvidenceThreadData;
  exportMode?: boolean;
};

// Drawn on the 1920 x 780 exhibit stage.
// Row 1: the leading steps that have a real product capture, one capture per run of steps.
// Row 2: the later steps, which leave the last capture from its hand-off control (Confirm and execute).
// A later step that gains a registered capture renders it in its own row 2 slot.
const W = 1920;
const M = 40;
const GAP = 32;
const NODE_R = 18;
const RAIL1_Y = 22;
const DESC1_TOP = RAIL1_Y + NODE_R + 10;
const CAP_TOP = 88;
const CONNECTOR = 36;
const ROW2_H = 160;
const FACTS_TOP = 664;
const FACTS_H = 56;
const FACT_GAP = 20;
const NOTE_TOP = 740;
const SLOT_MAX_H = 64;
const LAST_DESC_MIN = 380;

type CaptureView = {
  crop?: string;
  /** The frame is cut just below this sub-region, so no row is cut through. */
  cutAfter?: string;
  focus: ProductCaptureFocus[];
  /** Focus labels sit inside the top right corner of their box, where this screen has white space. */
  labelsInside?: boolean;
  /** Sub-region the thread leaves from, towards the later steps. */
  handoff?: string;
};

// How each real screen is framed on this slide. Regions are manifest sub-region names.
const CAPTURE_VIEWS: Partial<Record<PresentationAssetIdV24, CaptureView>> = {
  "evidence-review": {
    focus: [
      { region: "condition-item", label: "Condition flagged" },
      { region: "missing-penetration-test", label: "Missing item flagged" },
    ],
  },
  "decision-approval": {
    crop: "active-decision",
    cutAfter: "confirm-action",
    labelsInside: true,
    handoff: "confirm-action",
    focus: [
      { region: "authority", label: "Approval and approver" },
      { region: "confirm", label: "Rationale owned by the user" },
    ],
  },
};

const NO_VIEW: CaptureView = { focus: [] };

// Each fact matches appendix app-25 and app-26
const PROOF_FACTS = [
  { icon: IconUserCheck, text: "Every governed action names the acting user and role" },
  { icon: IconHistory, text: "Audit events have no update or delete path in the app" },
  { icon: IconBan, text: "Refused actions are recorded with a denial code" },
];

const LABELS_INSIDE_CSS =
  "[data-pv24-focus-labels=\"inside\"] [data-focus-region] > span { left: auto !important; right: -2px !important; top: -2px !important; }";

type Box = { x: number; y: number; w: number; h: number };

/** The part of the capture this slide shows, in capture pixels; null when not captured. */
function viewBoxFor(assetId: PresentationAssetIdV24, view: CaptureView): Box | null {
  const capture = getCaptureV24(assetId);
  if (!capture) return null;
  const base = view.crop ? capture.subRegions[view.crop] : { x: 0, y: 0, width: capture.width, height: capture.height };
  if (!base) return null;
  const pad = (getAssetV24(assetId).framePadding ?? 0) * capture.deviceScaleFactor;
  const top = base.y - pad;
  let bottom = base.y + base.height + pad;
  const cut = view.cutAfter ? capture.subRegions[view.cutAfter] : undefined;
  if (cut) bottom = Math.min(bottom, cut.y + cut.height + 8 * capture.deviceScaleFactor);
  return { x: base.x - pad, y: top, w: base.width + 2 * pad, h: bottom - top };
}

/** Frame chrome as ProductCapture draws it: title bar plus borders, and borders alone. */
function chromeFor(assetId: PresentationAssetIdV24, crop?: string): { titled: number; border2: number } {
  const titled = measureProductCapture({ assetId, width: 400, crop, frame: "browser", maxHeight: 0 })?.height ?? 30;
  const border2 = measureProductCapture({ assetId, width: 400, crop, frame: "plain", maxHeight: 0 })?.height ?? 2;
  return { titled, border2 };
}

function proofAsset(step: EvidenceThreadStep): PresentationAssetIdV24 | null {
  if (step.hasProductProof !== true || step.assetId === undefined) return null;
  return isAssetIdV24(step.assetId) ? step.assetId : null;
}

type Group = {
  assetId: PresentationAssetIdV24;
  view: CaptureView;
  steps: number[];
  left: number;
  width: number;
  height: number;
  handoffX: number | null;
};

type Layout = {
  groups: Group[];
  row1Nodes: number[];
  row2Steps: number[];
  row2Nodes: number[];
  row2Col: number;
  rail2Y: number;
  handoffTop: number;
};

function layoutFor(steps: EvidenceThreadStep[]): Layout {
  // Leading run of steps with captures, grouped by capture
  const runs: Array<{ assetId: PresentationAssetIdV24; steps: number[] }> = [];
  let i = 0;
  for (; i < steps.length; i++) {
    const step = steps[i];
    const assetId = step ? proofAsset(step) : null;
    if (assetId === null) break;
    const last = runs[runs.length - 1];
    if (last && last.assetId === assetId) last.steps.push(i);
    else runs.push({ assetId, steps: [i] });
  }
  const row2Steps = Array.from({ length: steps.length - i }, (_, k) => i + k);

  const sized = runs.map((run, g) => {
    const view = CAPTURE_VIEWS[run.assetId] ?? NO_VIEW;
    const box = viewBoxFor(run.assetId, view) ?? { x: 0, y: 0, w: 1600, h: 900 };
    const chrome = chromeFor(run.assetId, view.crop);
    const reserve = g === runs.length - 1 && row2Steps.length > 0 ? ROW2_H : 0;
    const availH = FACTS_TOP - FACT_GAP - CAP_TOP - reserve;
    return { ...run, view, box, chrome, maxScale: (availH - chrome.titled) / box.h };
  });

  const usable = W - 2 * M - GAP * Math.max(0, sized.length - 1);
  const totalBorders = sized.reduce((sum, s) => sum + s.chrome.border2, 0);
  const totalViewW = sized.reduce((sum, s) => sum + s.box.w, 0);
  const scale = Math.min(totalViewW > 0 ? (usable - totalBorders) / totalViewW : 1, ...sized.map((s) => s.maxScale));
  const blockW = sized.reduce((sum, s) => sum + s.box.w * scale + s.chrome.border2, 0) + GAP * Math.max(0, sized.length - 1);

  let x = (W - blockW) / 2;
  const groups: Group[] = sized.map((s) => {
    const width = s.box.w * scale + s.chrome.border2;
    const height = s.box.h * scale + s.chrome.titled;
    const capture = getCaptureV24(s.assetId);
    const hand = s.view.handoff && capture ? capture.subRegions[s.view.handoff] : undefined;
    const handoffX = hand ? x + s.chrome.border2 / 2 + (hand.x + hand.width / 2 - s.box.x) * scale : null;
    const group: Group = { assetId: s.assetId, view: s.view, steps: s.steps, left: x, width, height, handoffX };
    x += width + GAP;
    return group;
  });

  // One even pitch along the top rail: each capture starts under its first step
  let pitch = Infinity;
  groups.forEach((g, gi) => {
    const next = groups[gi + 1];
    if (next) pitch = Math.min(pitch, (next.left - g.left) / g.steps.length);
    else if (g.steps.length > 1) pitch = Math.min(pitch, (g.width - LAST_DESC_MIN) / (g.steps.length - 1));
  });
  if (!Number.isFinite(pitch)) pitch = 0;
  const row1Nodes: number[] = [];
  for (const g of groups) {
    g.steps.forEach((_, j) => row1Nodes.push(g.left + NODE_R + j * pitch));
  }

  const lastGroup = groups[groups.length - 1];
  const handoffTop = lastGroup ? CAP_TOP + lastGroup.height : CAP_TOP;
  const start = lastGroup?.handoffX ?? (lastGroup ? lastGroup.left + NODE_R : M + NODE_R);
  const right = lastGroup ? lastGroup.left + lastGroup.width : W - M;
  const row2Col = row2Steps.length > 0 ? (right - (start - NODE_R)) / row2Steps.length : 0;
  const row2Nodes = row2Steps.map((_, k) => start + k * row2Col);

  return { groups, row1Nodes, row2Steps, row2Nodes, row2Col, rail2Y: handoffTop + CONNECTOR + NODE_R, handoffTop };
}

// Reveal timeline, in seconds; complete by about 3.3 s
const row1At = (k: number) => 0.1 + k * 0.42;
const CONNECTOR_AT = 1.6;
const row2At = (k: number) => 1.9 + k * 0.35;
const FACTS_AT = 2.85;

function Node({ x, y, n, filled, delay, skip }: { x: number; y: number; n: number; filled: boolean; delay: number; skip: boolean }) {
  return (
    <motion.div
      initial={skip ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={skip ? undefined : { duration: 0.3, delay, ease: "backOut" }}
      style={{
        position: "absolute",
        left: x - NODE_R,
        top: y - NODE_R,
        width: NODE_R * 2,
        height: NODE_R * 2,
        borderRadius: "50%",
        border: "3px solid var(--pv24-accent)",
        background: filled ? "var(--pv24-accent)" : "var(--pv24-surface)",
        color: filled ? "#FFFFFF" : "var(--pv24-accent-dark)",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 17,
        fontWeight: 700,
      }}
    >
      {n}
    </motion.div>
  );
}

function StepText({
  x,
  y,
  label,
  description,
  descWidth,
  delay,
  skip,
}: {
  x: number;
  y: number;
  label: string;
  description: string | undefined;
  descWidth: number;
  delay: number;
  skip: boolean;
}) {
  return (
    <>
      <motion.div
        initial={skip ? false : { opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={skip ? undefined : { duration: 0.3, delay }}
        style={{
          position: "absolute",
          left: x + NODE_R,
          top: y - 15,
          height: 30,
          boxSizing: "border-box",
          padding: "2px 12px 2px 10px",
          background: "var(--pv24-canvas)",
          fontSize: 20,
          lineHeight: "26px",
          fontWeight: 700,
          color: "var(--pv24-text)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </motion.div>
      {description !== undefined && (
        <motion.div
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skip ? undefined : { duration: 0.3, delay: delay + 0.1 }}
          style={{
            position: "absolute",
            left: x - NODE_R,
            top: y + NODE_R + 10,
            width: descWidth,
            fontSize: 16,
            lineHeight: 1.3,
            color: "var(--pv24-text-secondary)",
          }}
        >
          {description}
        </motion.div>
      )}
    </>
  );
}

export function EvidenceThreadExhibit({ data, exportMode }: EvidenceThreadExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || prefersReduced === true;

  const { steps } = data;
  const layout = React.useMemo(() => layoutFor(steps), [steps]);
  const { groups, row1Nodes, row2Steps, row2Nodes, row2Col, rail2Y, handoffTop } = layout;
  const descriptionFor = (i: number) => data.proofAnnotations.find((a) => a.stepIndex === i)?.label;

  const row1Count = row1Nodes.length;
  const lastGroup = groups[groups.length - 1];
  const connectorX = row2Nodes[0];

  const segment = (key: string, x1: number, x2: number, y: number, delay: number) => (
    <motion.line
      key={key}
      x1={x1}
      y1={y}
      x2={x2}
      y2={y}
      stroke="var(--pv24-accent)"
      strokeWidth={3}
      initial={skip ? false : { pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={skip ? undefined : { duration: 0.3, delay, ease: "easeInOut" }}
    />
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
      role="group"
      aria-label="Evidence thread exhibit"
    >
      <style>{LABELS_INSIDE_CSS}</style>

      <svg aria-hidden="true" width={W} height={780} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {row1Nodes.map((x, k) =>
          k === 0 ? null : segment(`r1-${k}`, row1Nodes[k - 1]! + NODE_R, x - NODE_R, RAIL1_Y, row1At(k) - 0.32),
        )}

        {connectorX !== undefined && lastGroup !== undefined && (
          <motion.line
            x1={connectorX}
            y1={handoffTop}
            x2={connectorX}
            y2={rail2Y - NODE_R}
            stroke="var(--pv24-accent)"
            strokeWidth={3}
            initial={skip ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={skip ? undefined : { duration: 0.25, delay: CONNECTOR_AT, ease: "easeIn" }}
          />
        )}
        {row2Nodes.map((x, k) =>
          k === 0 ? null : segment(`r2-${k}`, row2Nodes[k - 1]! + NODE_R, x - NODE_R, rail2Y, row2At(k) - 0.32),
        )}
      </svg>

      {/* Row 1: steps shown in real product screens */}
      {groups.map((g) => {
        const firstStep = g.steps[0] ?? 0;
        return (
          <motion.div
            key={`cap-${g.assetId}-${firstStep}`}
            data-pv24-focus-labels={g.view.labelsInside ? "inside" : undefined}
            initial={skip ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={skip ? undefined : { duration: 0.45, delay: row1At(firstStep) + 0.15, ease: "easeOut" }}
            style={{ position: "absolute", left: g.left, top: CAP_TOP, width: g.width }}
          >
            <ProductCapture
              assetId={g.assetId}
              width={g.width}
              maxHeight={Math.ceil(g.height)}
              crop={g.view.crop}
              focus={g.view.focus}
            />
          </motion.div>
        );
      })}

      {groups.flatMap((g) =>
        g.steps.map((stepIndex, j) => {
          const step = steps[stepIndex];
          const x = row1Nodes[stepIndex];
          if (!step || x === undefined) return null;
          const nextX = j < g.steps.length - 1 ? row1Nodes[stepIndex + 1] : undefined;
          const descWidth = (nextX !== undefined ? nextX - NODE_R - 24 : g.left + g.width) - (x - NODE_R);
          return (
            <React.Fragment key={`s1-${step.label}`}>
              <Node x={x} y={RAIL1_Y} n={stepIndex + 1} filled delay={row1At(stepIndex)} skip={skip} />
              <StepText
                x={x}
                y={RAIL1_Y}
                label={step.label}
                description={descriptionFor(stepIndex)}
                descWidth={descWidth}
                delay={row1At(stepIndex)}
                skip={skip}
              />
            </React.Fragment>
          );
        }),
      )}

      {/* Hand-off: the later steps run after Confirm and execute */}
      {connectorX !== undefined && row2Steps.length > 0 && (
        <motion.div
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skip ? undefined : { duration: 0.3, delay: CONNECTOR_AT + 0.1 }}
          style={{
            position: "absolute",
            left: connectorX + 14,
            top: handoffTop + 8,
            fontSize: 14,
            lineHeight: "18px",
            fontStyle: "italic",
            color: "var(--pv24-text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          Runs after Confirm and execute; shown live in the demo
        </motion.div>
      )}

      {/* Row 2: later steps, described in words until a real capture exists */}
      {row2Steps.map((stepIndex, k) => {
        const step = steps[stepIndex];
        const x = row2Nodes[k];
        if (!step || x === undefined) return null;
        const slotAsset = proofAsset(step);
        const descTop = rail2Y + NODE_R + 10;
        return (
          <React.Fragment key={`s2-${step.label}`}>
            <Node x={x} y={rail2Y} n={stepIndex + 1} filled={false} delay={row2At(k)} skip={skip} />
            <StepText
              x={x}
              y={rail2Y}
              label={step.label}
              description={slotAsset === null ? descriptionFor(stepIndex) : undefined}
              descWidth={row2Col - 16}
              delay={row2At(k)}
              skip={skip}
            />
            {slotAsset !== null && (
              <motion.div
                initial={skip ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={skip ? undefined : { duration: 0.3, delay: row2At(k) + 0.1 }}
                style={{ position: "absolute", left: x - NODE_R, top: descTop }}
              >
                <ProductCapture
                  assetId={slotAsset}
                  width={row2Col - 16}
                  maxHeight={SLOT_MAX_H}
                  crop={CAPTURE_VIEWS[slotAsset]?.crop}
                  frame="plain"
                  focus={CAPTURE_VIEWS[slotAsset]?.focus}
                />
              </motion.div>
            )}
          </React.Fragment>
        );
      })}

      <motion.div
        initial={skip ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={skip ? undefined : { duration: 0.4, delay: FACTS_AT }}
        style={{
          position: "absolute",
          left: M,
          top: FACTS_TOP,
          width: W - 2 * M,
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
                height: FACTS_H,
                boxSizing: "border-box",
                padding: "0 20px",
                background: "var(--pv24-surface)",
                borderLeft: "4px solid var(--pv24-brand-purple-dark)",
              }}
            >
              <FactIcon size={26} color="var(--pv24-brand-purple-dark)" stroke={1.6} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 18, fontWeight: 600, color: "var(--pv24-text)", lineHeight: 1.3 }}>{fact.text}</span>
            </div>
          );
        })}
      </motion.div>

      <div
        style={{
          position: "absolute",
          right: M,
          top: NOTE_TOP,
          fontSize: 14,
          fontStyle: "italic",
          color: "var(--pv24-text-secondary)",
        }}
      >
        Real product screens from the synthetic demo day, captured read only
      </div>
    </div>
  );
}
