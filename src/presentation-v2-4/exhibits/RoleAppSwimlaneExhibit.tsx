"use client";

import * as React from "react";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import { IconCheck, IconCircleCheck, IconCircleDashed, IconLock } from "@tabler/icons-react";
import type { SwimlaneData, SwimlaneStage } from "@/presentation-v2-4/data/types";
import { ProductCapture, measureProductCapture } from "@/presentation-v2-4/product-proof/ProductCapture";
import { getAssetV24, isAssetIdV24 } from "@/presentation-v2-4/product-proof/asset-registry";
import { getCaptureV24 } from "@/presentation-v2-4/product-proof/manifest";
import type { PresentationAssetIdV24 } from "@/presentation-v2-4/product-proof/types";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";

export interface RoleAppSwimlaneExhibitProps {
  data: SwimlaneData;
  exportMode?: boolean;
}

// ---------------------------------------------------------------------------
// Geometry, drawn on the 1920 x 780 exhibit stage.
// Left: the stage rail with its lanes. Right: the captured stage page, given the
// full height so that product text stays legible.
// ---------------------------------------------------------------------------

const STAGE_H = 780;
const PAD_X = 24;
const STAGE_RIGHT = 1896;
const COL_GAP = 40;
const CAP_W = 1058;
const CAP_X = STAGE_RIGHT - CAP_W;
const LEFT_W = CAP_X - COL_GAP - PAD_X;
const LEFT_RIGHT = PAD_X + LEFT_W;

const HEAD_H = 28;
const COLHEAD_TOP = 40;
const COLHEAD_H = 24;
const ROW_TOP = 72;
const ROW_H = 46;
const ROW_GAP = 4;
const STAGE_COL_W = 226;
const CELL_GAP = 6;
const LANE_COL_W = (LEFT_W - STAGE_COL_W - 3 * CELL_GAP) / 3;
const BAND_INSET = 3;
const LEGEND_GAP = 12;
const LIBRARY_GAP = 26;

const CAPTION_H = 24;
const CAPTURE_BOTTOM = STAGE_H - 6;

// ProductCapture draws its chrome (title bar, focus chips) at 12 px. The frames are laid out
// at 1 / CHROME and scaled up, so that chrome reads at 15 px like the rest of the slide.
const CHROME = 1.25;

const TPRM_STAGE_ASSET: PresentationAssetIdV24 = "tprm-onboarding-stage";

const ACCENT = "var(--pv24-accent)";
const ACCENT_DARK = "var(--pv24-accent-dark)";
const ACCENT_LIGHT = "var(--pv24-accent-lightest)";
const TEXT = "var(--pv24-text)";
const TEXT_2 = "var(--pv24-text-secondary)";
const SURFACE = "var(--pv24-surface)";
const BORDER = "var(--pv24-border)";
const BORDER_STRONG = "var(--pv24-border-strong)";
const MUTED = "var(--pv24-muted-bg)";

const rowY = (i: number): number => ROW_TOP + i * (ROW_H + ROW_GAP);
const laneX = (lane: number): number => STAGE_COL_W + CELL_GAP + lane * (LANE_COL_W + CELL_GAP);

// ---------------------------------------------------------------------------
// Motion timeline in seconds. The reveal settles by about 2.9 s.
// ---------------------------------------------------------------------------

const T = {
  head: 0,
  colHeads: 0.1,
  rows: 0.15,
  rowStep: 0.06,
  band: 0.85,
  legend: 0.9,
  connector: 1.0,
  frameA: 1.1,
  frameB: 1.4,
  focus: [1.85, 2.2, 2.55] as const,
  library: 2.0,
};

// ---------------------------------------------------------------------------
// Lanes: what each stage of the onboarding definition asks of the AI and of the person.
// Keyed by the stage names in src/role-apps/tprm/definition.ts.
// ---------------------------------------------------------------------------

type LaneKey = "ai" | "human" | "recorded";

const LANES: ReadonlyArray<{ key: LaneKey; label: string; focusRegion: string }> = [
  { key: "ai", label: "AI prepares", focusRegion: "ai-prepared" },
  { key: "human", label: "You decide", focusRegion: "responsibility" },
  { key: "recorded", label: "Decision recorded", focusRegion: "decision-form" },
];

const LANE_COPY: Record<string, Record<LaneKey, string>> = {
  "Request and Intake": {
    ai: "Request retrieved, duplicates checked",
    human: "Confirm intake and reference",
    recorded: "Supplier registered with owner",
  },
  "Classification and Criticality": {
    ai: "Classification and criticality proposed",
    human: "Decide the classification",
    recorded: "Classification with rationale",
  },
  "Tailored Due Diligence": {
    ai: "Questionnaire and requests drafted",
    human: "Approve the questionnaire",
    recorded: "Requests sent, replies checked",
  },
  "Evidence Review": {
    ai: "Evidence assessed, gaps flagged",
    human: "Pass the gate or hold the file",
    recorded: "Sufficiency decision and note",
  },
  "Specialist Reviews": {
    ai: "Review requests drafted",
    human: "Agree or challenge conditions",
    recorded: "Specialist opinions on file",
  },
  "Contract and Conditions": {
    ai: "Open conditions surfaced",
    human: "Each condition in contract or waived",
    recorded: "Contract approved",
  },
  "Decision and Onboarding": {
    ai: "Governance paper drafted",
    human: "Record the committee approval",
    recorded: "Supplier set to active",
  },
  "Handover to Monitoring": {
    ai: "Monitoring routine defined, not running",
    human: "Set frequency and next date",
    recorded: "Monitoring plan, case closed",
  },
};

type StageState = "done" | "current" | "locked";

// ---------------------------------------------------------------------------
// Capture geometry, derived from the manifest through the ProductCapture measure
// ---------------------------------------------------------------------------

/** Outer height of an uncropped capture that ends half way between two sub-regions. */
function heightThrough(
  assetId: PresentationAssetIdV24,
  width: number,
  region: string,
  nextRegion: string,
): number | null {
  const capture = getCaptureV24(assetId);
  const box = capture?.subRegions[region];
  const next = capture?.subRegions[nextRegion];
  const natural = measureProductCapture({ assetId, width });
  const chrome = measureProductCapture({ assetId, width, maxHeight: 0 });
  if (!capture || !box || !natural || !chrome) return null;
  const pad = (getAssetV24(assetId).framePadding ?? 0) * capture.deviceScaleFactor;
  const end = next ? (box.y + box.height + next.y) / 2 : box.y + box.height + pad;
  const image = ((natural.height - chrome.height) * (end + pad)) / (capture.height + 2 * pad);
  return Math.round(chrome.height + image);
}

type FrameGeometry = { width: number; maxHeight?: number; height: number };
type CaptureLayout = { a: FrameGeometry; b: FrameGeometry; chromeA: number };

/**
 * Frame A shows the stage page from its heading through Your responsibility; frame B the
 * decision form further down. Both share one width, shrunk only if the pair would not fit
 * the column height.
 */
function captureLayout(assetId: PresentationAssetIdV24 | null): CaptureLayout {
  const budget = (CAPTURE_BOTTOM - CAPTION_H) / CHROME;
  const fallback = (width: number): CaptureLayout => ({
    a: { width, maxHeight: budget * 0.55, height: budget * 0.55 },
    b: { width, maxHeight: budget * 0.45, height: budget * 0.45 },
    chromeA: 30,
  });
  const measure = (width: number): CaptureLayout | null => {
    if (!assetId) return null;
    const aMax = heightThrough(assetId, width, "responsibility", "evidence-status");
    const b = measureProductCapture({ assetId, width, crop: "decision-form", frame: "plain" });
    const chrome = measureProductCapture({ assetId, width, maxHeight: 0 });
    if (aMax === null || !b || !chrome) return null;
    const aHeight = measureProductCapture({ assetId, width, maxHeight: aMax })?.height ?? aMax;
    return {
      a: { width, maxHeight: aMax, height: aHeight },
      b: { width, height: b.height },
      chromeA: chrome.height,
    };
  };
  let width = CAP_W / CHROME;
  const first = measure(width);
  if (!first) return fallback(width);
  const total = first.a.height + first.b.height;
  if (total <= budget) return first;
  width = Math.floor((width * budget) / total);
  return measure(width) ?? fallback(width);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function StateSquare({ state, number, size = 26 }: { state: StageState; number: number; size?: number }) {
  const common: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (state === "done") {
    return (
      <span aria-hidden="true" style={{ ...common, background: ACCENT_DARK }}>
        <IconCheck size={size * 0.62} color="#FFFFFF" stroke={2.6} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        aria-hidden="true"
        style={{ ...common, background: SURFACE, color: ACCENT_DARK, fontSize: size * 0.6, fontWeight: 700, lineHeight: 1 }}
      >
        {number}
      </span>
    );
  }
  return (
    <span aria-hidden="true" style={{ ...common, background: MUTED, border: `1px solid ${BORDER}` }}>
      <IconLock size={size * 0.6} color="var(--pv24-text-secondary)" stroke={2} />
    </span>
  );
}

function NumberSquare({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        background: ACCENT,
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {n}
    </span>
  );
}

function StageCell({ stage, index, state }: { stage: SwimlaneStage; index: number; state: StageState }) {
  const current = state === "current";
  const locked = state === "locked";
  return (
    <div
      data-stage-state={state}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: STAGE_COL_W,
        height: ROW_H,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 10px",
        background: current ? ACCENT : locked ? "transparent" : SURFACE,
        border: current ? `2px solid ${ACCENT}` : locked ? `1.5px dashed ${BORDER_STRONG}` : `1.5px solid ${BORDER_STRONG}`,
      }}
    >
      <StateSquare state={state} number={index + 1} />
      <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.18, color: current ? "#FFFFFF" : locked ? TEXT_2 : TEXT }}>
        {stage.label}
      </span>
    </div>
  );
}

function LaneCell({ text, state, lane }: { text: string; state: StageState; lane: number }) {
  const current = state === "current";
  const locked = state === "locked";
  return (
    <div
      style={{
        position: "absolute",
        left: laneX(lane),
        top: 0,
        width: LANE_COL_W,
        height: ROW_H,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        background: current ? ACCENT_LIGHT : locked ? "transparent" : SURFACE,
        border: current ? `1px solid ${ACCENT}` : locked ? `1px dashed ${BORDER_STRONG}` : `1px solid ${BORDER}`,
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1.2, color: locked ? TEXT_2 : TEXT, fontWeight: current ? 600 : 400 }}>
        {text}
      </span>
    </div>
  );
}

function LegendItem({ state, label }: { state: StageState; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 15, color: TEXT_2, whiteSpace: "nowrap" }}>
      {state === "current" ? (
        <span aria-hidden="true" style={{ width: 18, height: 18, background: ACCENT, flexShrink: 0 }} />
      ) : (
        <StateSquare state={state} number={0} size={18} />
      )}
      {label}
    </span>
  );
}

function ScaledCapture({
  assetId,
  geometry,
  crop,
  frame,
  focus,
}: {
  assetId: PresentationAssetIdV24;
  geometry: FrameGeometry;
  crop?: string;
  frame: "browser" | "plain";
  focus?: Array<{ region: string; label: string }>;
}) {
  return (
    <div style={{ width: geometry.width, transform: `scale(${CHROME})`, transformOrigin: "top left" }}>
      <ProductCapture
        assetId={assetId}
        width={geometry.width}
        maxHeight={geometry.maxHeight}
        crop={crop}
        frame={frame}
        focus={focus}
      />
    </div>
  );
}

function AppChip({ name, installed }: { name: string; installed: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 38,
        boxSizing: "border-box",
        padding: "0 13px 0 10px",
        background: installed ? SURFACE : "transparent",
        border: installed ? `2px solid ${ACCENT}` : `1.5px dashed ${BORDER_STRONG}`,
        fontSize: 16,
        fontWeight: installed ? 700 : 600,
        color: installed ? TEXT : TEXT_2,
        whiteSpace: "nowrap",
      }}
    >
      {installed ? (
        <IconCircleCheck size={19} color="var(--pv24-accent)" stroke={2} style={{ flexShrink: 0 }} />
      ) : (
        <IconCircleDashed size={19} color="var(--pv24-text-secondary)" stroke={2} style={{ flexShrink: 0 }} />
      )}
      {name}
    </span>
  );
}

const groupLabelStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: "18px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: TEXT_2,
  marginBottom: 7,
  whiteSpace: "nowrap",
};

const captionStyle: React.CSSProperties = {
  position: "absolute",
  left: CAP_X,
  height: CAPTION_H,
  display: "flex",
  alignItems: "center",
  fontSize: 15,
  whiteSpace: "nowrap",
};

// ---------------------------------------------------------------------------
// Exhibit
// ---------------------------------------------------------------------------

export function RoleAppSwimlaneExhibit({ data, exportMode = false }: RoleAppSwimlaneExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const [scope, animate] = useAnimate<HTMLDivElement>();

  // The rail shows the app whose stage page is captured (Third-Party Onboarding)
  const lane = data.lanes.find((l) => l.assetId === TPRM_STAGE_ASSET) ?? data.lanes[1] ?? data.lanes[0];
  const stages = lane?.stages ?? [];
  const appTitle = lane?.title ?? "Third-Party Onboarding";
  const assetId: PresentationAssetIdV24 =
    lane?.assetId && isAssetIdV24(lane.assetId) ? lane.assetId : TPRM_STAGE_ASSET;

  const currentIndex = stages.findIndex((s) => s.isCurrentStage);
  const stateOf = (i: number): StageState =>
    currentIndex < 0 ? "done" : i < currentIndex ? "done" : i === currentIndex ? "current" : "locked";
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : undefined;
  const stageNo = currentIndex + 1;

  // Capture column
  const caps = captureLayout(assetId);
  const titleBand = caps.chromeA * CHROME;
  const frameATop = 0;
  const frameAH = caps.a.height * CHROME;
  const captionBTop = frameATop + frameAH;
  const frameBTop = captionBTop + CAPTION_H;
  const frameW = caps.a.width * CHROME;

  // Stage link: band around the current stage row, elbow connector into the top of the page
  const rows = stages.length;
  const legendTop = rowY(rows) - ROW_GAP + LEGEND_GAP;
  const libraryTop = legendTop + 20 + LIBRARY_GAP;
  const connX0 = LEFT_RIGHT + BAND_INSET;
  const connY0 = currentIndex >= 0 ? rowY(currentIndex) + ROW_H / 2 : 0;
  const connXMid = LEFT_RIGHT + COL_GAP / 2;
  const connY1 = frameATop + titleBand / 2;
  const connectorPath = `M ${connX0} ${connY0} H ${connXMid} V ${connY1} H ${CAP_X - 10}`;

  // Library, straight from the Role App registry
  const installed = ROLE_APP_REGISTRY.filter((app) => app.status === "installed");
  const preview = ROLE_APP_REGISTRY.filter((app) => app.status === "preview");

  // Focus overlays follow the lanes: AI prepared, then the responsibility, then the decision form
  React.useLayoutEffect(() => {
    if (skip || !scope.current) return;
    scope.current.querySelectorAll<HTMLElement>("[data-focus-region]").forEach((el) => {
      el.style.opacity = "0";
    });
  }, [skip, scope]);

  React.useEffect(() => {
    if (skip || !scope.current) return;
    LANES.forEach((laneDef, i) => {
      const selector = `[data-focus-region="${laneDef.focusRegion}"]`;
      if (!scope.current?.querySelector(selector)) return;
      animate(selector, { opacity: 1 }, { duration: 0.3, delay: T.focus[i] ?? 2.5, ease: "easeOut" });
    });
  }, [skip, scope, animate]);

  const fade = (delay: number, offset: { x?: number; y?: number } = {}) =>
    skip
      ? { initial: false as const, animate: { opacity: 1, x: 0, y: 0 } }
      : {
          initial: { opacity: 0, x: offset.x ?? 0, y: offset.y ?? 0 },
          animate: { opacity: 1, x: 0, y: 0 },
          transition: { duration: 0.35, ease: "easeOut" as const, delay },
        };

  return (
    <div
      ref={scope}
      role="group"
      aria-label={`Role App ${appTitle}: ${rows} stages, with the stage ${stageNo} ${currentStage?.label ?? ""} page captured from the product`}
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        fontFamily: "var(--pv24-font-family)",
        overflow: "hidden",
      }}
    >
      {/* ------------------------------------------------------------ left: rail and lanes */}
      <motion.div
        style={{
          position: "absolute",
          left: PAD_X,
          top: 0,
          height: HEAD_H,
          boxSizing: "border-box",
          borderLeft: `4px solid ${ACCENT}`,
          paddingLeft: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
          whiteSpace: "nowrap",
        }}
        {...fade(T.head)}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: ACCENT_DARK }}>Role App</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{appTitle}</span>
        <span style={{ fontSize: 15, color: TEXT_2 }}>{`${rows} stages, as defined in the product`}</span>
      </motion.div>

      <motion.div
        style={{ position: "absolute", left: PAD_X, top: COLHEAD_TOP, width: LEFT_W, height: COLHEAD_H }}
        {...fade(T.colHeads)}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: COLHEAD_H,
            display: "flex",
            alignItems: "center",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: TEXT_2,
          }}
        >
          Stage
        </span>
        {LANES.map((laneDef, i) => (
          <span
            key={laneDef.key}
            style={{
              position: "absolute",
              left: laneX(i),
              top: 0,
              height: COLHEAD_H,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 16,
              fontWeight: 700,
              color: TEXT,
              whiteSpace: "nowrap",
            }}
          >
            <NumberSquare n={i + 1} />
            {laneDef.label}
          </span>
        ))}
      </motion.div>

      {/* Highlight band behind the current stage row */}
      {currentIndex >= 0 ? (
        <motion.div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: PAD_X - BAND_INSET,
            top: rowY(currentIndex) - BAND_INSET,
            width: LEFT_W + 2 * BAND_INSET,
            height: ROW_H + 2 * BAND_INSET,
            boxSizing: "border-box",
            background: ACCENT_LIGHT,
          }}
          {...fade(T.band)}
        />
      ) : null}

      {stages.map((stage, i) => (
        <motion.div
          key={stage.label}
          style={{ position: "absolute", left: PAD_X, top: rowY(i), width: LEFT_W, height: ROW_H }}
          {...fade(T.rows + i * T.rowStep, { x: -12 })}
        >
          <StageCell stage={stage} index={i} state={stateOf(i)} />
          {LANES.map((laneDef, l) => {
            const text = LANE_COPY[stage.label]?.[laneDef.key];
            return text ? <LaneCell key={laneDef.key} text={text} state={stateOf(i)} lane={l} /> : null;
          })}
        </motion.div>
      ))}

      {/* Outline of the current stage row, drawn over the cells */}
      {currentIndex >= 0 ? (
        <motion.div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: PAD_X - BAND_INSET,
            top: rowY(currentIndex) - BAND_INSET,
            width: LEFT_W + 2 * BAND_INSET,
            height: ROW_H + 2 * BAND_INSET,
            boxSizing: "border-box",
            border: `2px solid ${ACCENT}`,
            pointerEvents: "none",
          }}
          {...fade(T.band)}
        />
      ) : null}

      {currentIndex >= 0 ? (
        <motion.div
          style={{ position: "absolute", left: PAD_X, top: legendTop, height: 20, display: "flex", alignItems: "center", gap: 22 }}
          {...fade(T.legend)}
        >
          <LegendItem state="done" label="Completed" />
          <LegendItem state="current" label="In progress" />
          <LegendItem state="locked" label={`Locked until stage ${stageNo} is complete`} />
        </motion.div>
      ) : null}

      {/* Role App library, from src/role-apps/registry.ts */}
      <div style={{ position: "absolute", left: PAD_X, top: libraryTop, width: LEFT_W }}>
        <motion.div
          style={{
            boxSizing: "border-box",
            borderLeft: `4px solid ${ACCENT}`,
            paddingLeft: 10,
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginBottom: 10,
            whiteSpace: "nowrap",
          }}
          {...fade(T.library)}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: TEXT, lineHeight: "24px" }}>Role App library</span>
          <span style={{ fontSize: 15, color: TEXT_2 }}>{`${ROLE_APP_REGISTRY.length} apps in the registry`}</span>
        </motion.div>
        <motion.div style={{ marginBottom: 12 }} {...fade(T.library + 0.1, { y: 8 })}>
          <div style={groupLabelStyle}>Installed: can be started today</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {installed.map((app) => (
              <AppChip key={app.id} name={app.name} installed />
            ))}
          </div>
        </motion.div>
        <motion.div {...fade(T.library + 0.25, { y: 8 })}>
          <div style={groupLabelStyle}>Preview: defined in the registry, cannot be started yet</div>
          <div style={{ display: "flex", gap: 10, rowGap: 8, flexWrap: "wrap" }}>
            {preview.map((app) => (
              <AppChip key={app.id} name={app.name} installed={false} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* ------------------------------------------------------------ link */}
      {currentIndex >= 0 ? (
        <svg
          aria-hidden="true"
          width={CAP_X}
          height={STAGE_H}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}
        >
          <motion.path
            d={connectorPath}
            fill="none"
            stroke={ACCENT}
            strokeWidth={3}
            initial={skip ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={skip ? undefined : { duration: 0.35, ease: "easeOut", delay: T.connector }}
          />
          <motion.polygon
            points={`${CAP_X - 11},${connY1 - 8} ${CAP_X - 1},${connY1} ${CAP_X - 11},${connY1 + 8}`}
            fill={ACCENT}
            initial={skip ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={skip ? undefined : { duration: 0.15, delay: T.connector + 0.3 }}
          />
        </svg>
      ) : null}

      {/* ------------------------------------------------------------ right: the stage page */}
      {/* Focus chips carry the lane numbers only, so chip 3 never covers the form heading */}
      <motion.div
        data-proof-frame="stage-page"
        style={{ position: "absolute", left: CAP_X, top: frameATop, width: frameW, height: frameAH }}
        {...fade(T.frameA, { y: 12 })}
      >
        <ScaledCapture
          assetId={assetId}
          geometry={caps.a}
          frame="browser"
          focus={[
            { region: LANES[0]!.focusRegion, label: "1" },
            { region: LANES[1]!.focusRegion, label: "2" },
          ]}
        />
      </motion.div>

      <motion.div style={{ ...captionStyle, top: captionBTop, color: TEXT_2 }} {...fade(T.frameB)}>
        Further down the same page, after the evidence status list
      </motion.div>
      <motion.div
        data-proof-frame="decision-form"
        style={{ position: "absolute", left: CAP_X, top: frameBTop, width: frameW, height: caps.b.height * CHROME }}
        {...fade(T.frameB, { y: 12 })}
      >
        <ScaledCapture
          assetId={assetId}
          geometry={caps.b}
          crop="decision-form"
          frame="plain"
          focus={[{ region: LANES[2]!.focusRegion, label: "3" }]}
        />
      </motion.div>
    </div>
  );
}
