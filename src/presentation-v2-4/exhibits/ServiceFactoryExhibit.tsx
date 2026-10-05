"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconActivity,
  IconBellRinging,
  IconBolt,
  IconChecklist,
  IconCircleCheck,
  IconCircleDashed,
  IconClipboardCheck,
  IconFileSearch,
  IconGauge,
  IconHeadset,
  IconInfoCircle,
  IconListCheck,
  IconMessages,
  IconPackage,
  IconPackages,
  IconPlus,
  IconRecycle,
  IconServer,
  IconStopwatch,
  IconSwitchHorizontal,
  IconTarget,
  IconUsers,
} from "@tabler/icons-react";
import type { ServiceFactoryData } from "../data/types";
import { useDeckMotion } from "../motion/DeckMotion";

export type ServiceFactoryExhibitProps = {
  data: ServiceFactoryData;
  exportMode?: boolean;
};

type TablerIcon = React.ComponentType<{ size?: number; stroke?: number; color?: string }>;

// Native stage: 1920 x 780. The pack shelf and app cards share one column grid so blocks line up.
const COL_W = 433;
const COL_GAP = 36;
const BLOCK_INSET = 12;
const BLOCK_W = COL_W - BLOCK_INSET * 2;
const BLOCK_H = 40;
const PITCH = 46;

const LIB_X = 40;
const LIB_Y = 8;
const LIB_W = COL_W;
const LIB_BLOCK_X = LIB_X + BLOCK_INSET;

const CARD_X0 = LIB_X + COL_W + COL_GAP;
const CARD_W = COL_W;
const CARD_GAP = COL_GAP;
const CARD_Y = 64;
const CARD_H = 520;
const APP_BLOCK_Y0 = CARD_Y + 76;
const LIB_BLOCK_Y0 = APP_BLOCK_Y0;
const FOOTER_Y = 512;
const FOOTER_H = CARD_Y + CARD_H - FOOTER_Y;
const LIB_H = CARD_Y + CARD_H - LIB_Y;

const BAND_X = CARD_X0;
const BAND_Y = LIB_Y;
const BAND_W = 1880 - CARD_X0;
const BAND_H = 46;

const BASE_X = 40;
const BASE_Y = 596;
const BASE_W = 1840;
const BASE_H = 58;

const PACKS_Y = 666;
const PACKS_H = 36;

const LEGEND_Y = 714;
const LEGEND_H = 46;

const cardX = (k: number) => CARD_X0 + k * (CARD_W + CARD_GAP);
const appBlockX = (k: number) => cardX(k) + BLOCK_INSET;
const appBlockY = (j: number) => APP_BLOCK_Y0 + j * PITCH;
const libBlockY = (p: number) => LIB_BLOCK_Y0 + p * PITCH;

// Timeline in seconds; the full reveal settles by about 3.3 s
const CARD_TIMES = [0.3, 1.35, 2.1] as const;
const BLOCK_STEP = [0.08, 0.15, 0.12] as const;
const cardT = (k: number) => CARD_TIMES[k] ?? 0;
const blockStart = (k: number, j: number) => cardT(k) + 0.15 + j * (BLOCK_STEP[k] ?? 0.12);
const BUILD_DUR = 0.3;
const FLY_DUR = 0.45;
const BAND_T = 2.6;
const PACKS_T = 2.75;
const LEGEND_T = 2.9;
const EASE = [0.22, 1, 0.36, 1] as const;

type StageId =
  | "scope"
  | "evidence"
  | "riskControl"
  | "firstLine"
  | "challenge"
  | "rating"
  | "actions"
  | "monitoring"
  | "trigger"
  | "confirm";

type Stage = {
  id: StageId;
  label: string;
  Icon: TablerIcon;
  body: string;
  chip: string;
};

// The eight installed stages of the RCSA and Operational Risk pack, in cycle order
const PACK_STAGES: Stage[] = [
  { id: "scope", label: "Scope and Trigger", Icon: IconTarget, body: "#F3E5FF", chip: "#7600BC" },
  { id: "evidence", label: "Evidence Refresh", Icon: IconFileSearch, body: "#EBDCFB", chip: "#A100FF" },
  { id: "riskControl", label: "Risk and Control Change", Icon: IconSwitchHorizontal, body: "#EEF0F3", chip: "#5A5E6B" },
  { id: "firstLine", label: "First-line Input", Icon: IconUsers, body: "#E4E6EB", chip: "#2B2D33" },
  { id: "challenge", label: "Challenge Workshop", Icon: IconMessages, body: "#F8EAFC", chip: "#B13FE6" },
  { id: "rating", label: "Rating and Appetite", Icon: IconGauge, body: "#EFE3F8", chip: "#460073" },
  { id: "actions", label: "Actions and Approval", Icon: IconChecklist, body: "#F1F2F4", chip: "#6B6F7B" },
  { id: "monitoring", label: "Monitoring and Reassessment", Icon: IconActivity, body: "#F4E8FD", chip: "#8A1FD6" },
];

// Stages that only a preview app needs; they are not on the installed shelf
const EXTRA_STAGES: Stage[] = [
  { id: "trigger", label: "Trigger Assessment", Icon: IconBellRinging, body: "#ECEDF1", chip: "#3D3F46" },
  { id: "confirm", label: "Scope Confirmation", Icon: IconListCheck, body: "#F5EBFC", chip: "#9B4DCA" },
];

const ALL_STAGES = [...PACK_STAGES, ...EXTRA_STAGES];

type Use = { stage: StageId; isNew: boolean };
type AppStatus = "installed" | "preview";

type RoleApp = {
  name: string;
  status: AppStatus;
  Icon: TablerIcon;
  uses: Use[];
  caption: string;
  note?: string;
};

const APPS: RoleApp[] = [
  {
    name: "RCSA Cycle Assistant",
    status: "installed",
    Icon: IconClipboardCheck,
    uses: PACK_STAGES.map((s) => ({ stage: s.id, isNew: true })),
    caption: "All 8 stages built for the first time",
  },
  {
    name: "Event-Driven Reassessment",
    status: "preview",
    Icon: IconBolt,
    uses: [
      { stage: "trigger", isNew: true },
      { stage: "confirm", isNew: true },
      { stage: "monitoring", isNew: false },
    ],
    caption: "3 stages: 2 new, 1 reused",
    note: "Prototype, not yet open to users",
  },
  {
    name: "Rapid Assessment",
    status: "preview",
    Icon: IconStopwatch,
    uses: [
      { stage: "scope", isNew: false },
      { stage: "evidence", isNew: false },
      { stage: "rating", isNew: false },
      { stage: "actions", isNew: false },
    ],
    caption: "4 stages, all reused",
    note: "Concept, not yet open to users",
  },
];

const PREVIEW_PACKS = [
  "Control Assurance",
  "Incident and Operational Resilience",
  "Regulatory Change",
  "NFR Governance and Portfolio",
];

const shelfIndex = (id: StageId) => PACK_STAGES.findIndex((s) => s.id === id);
const stageById = (id: StageId): Stage => ALL_STAGES.find((s) => s.id === id) ?? (PACK_STAGES[0] as Stage);

// Every shelf stage was first built in Role App 1 at the same row
const libFillTime = (id: StageId) => blockStart(0, Math.max(0, shelfIndex(id))) + BUILD_DUR;

// ---------------------------------------------------------------------------

function StageChip({ stage }: { stage: Stage }) {
  const Icon = stage.Icon;
  return (
    <div
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 5,
        background: stage.chip,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={17} stroke={2} color="#FFFFFF" />
    </div>
  );
}

function StageName({ label }: { label: string }) {
  return (
    <span
      style={{
        flex: 1,
        minWidth: 0,
        fontSize: 17,
        fontWeight: 600,
        lineHeight: "22px",
        color: "var(--pv24-text)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Tag({ isNew }: { isNew: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        flexShrink: 0,
        padding: "1px 7px 1px 5px",
        borderRadius: 4,
        fontSize: 16,
        fontWeight: 700,
        lineHeight: "20px",
        background: isNew ? "var(--pv24-accent)" : "var(--pv24-surface)",
        color: isNew ? "#FFFFFF" : "var(--pv24-text-secondary)",
        border: isNew ? "1px solid var(--pv24-accent)" : "1px solid var(--pv24-border-strong)",
      }}
    >
      {isNew ? (
        <IconPlus size={14} stroke={2.6} color="#FFFFFF" />
      ) : (
        <IconRecycle size={14} stroke={2.2} color="var(--pv24-text-secondary)" />
      )}
      {isNew ? "New" : "Reused"}
    </span>
  );
}

function StatusChip({ status }: { status: AppStatus }) {
  const installed = status === "installed";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
        padding: "0 8px 0 6px",
        borderRadius: 11,
        fontSize: 16,
        fontWeight: 700,
        lineHeight: "20px",
        background: installed ? "var(--pv24-accent-dark)" : "var(--pv24-surface)",
        color: installed ? "#FFFFFF" : "var(--pv24-text-secondary)",
        border: installed ? "1px solid var(--pv24-accent-dark)" : "1px dashed var(--pv24-text-secondary)",
      }}
    >
      {installed ? (
        <IconCircleCheck size={15} stroke={2.2} color="#FFFFFF" />
      ) : (
        <IconCircleDashed size={15} stroke={2.2} color="var(--pv24-text-secondary)" />
      )}
      {installed ? "Installed" : "Preview"}
    </span>
  );
}

function LibraryBlock({ stage, p, skip }: { stage: Stage; p: number; skip: boolean }) {
  const dx = appBlockX(0) - LIB_BLOCK_X;
  const dy = appBlockY(p) - libBlockY(p);
  const t = libFillTime(stage.id);
  return (
    <motion.div
      style={{
        position: "absolute",
        left: LIB_BLOCK_X,
        top: libBlockY(p),
        width: BLOCK_W,
        height: BLOCK_H,
        boxSizing: "border-box",
        borderRadius: 6,
        background: stage.body,
        border: "1px solid var(--pv24-border)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 12px 0 10px",
        zIndex: 3,
      }}
      initial={skip ? false : { x: dx, y: dy, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={
        skip
          ? undefined
          : {
              x: { duration: FLY_DUR, delay: t, ease: EASE },
              y: { duration: FLY_DUR, delay: t, ease: EASE },
              opacity: { duration: 0.2, delay: t },
            }
      }
    >
      <StageChip stage={stage} />
      <StageName label={stage.label} />
    </motion.div>
  );
}

function AppBlock({ k, j, use, skip }: { k: number; j: number; use: Use; skip: boolean }) {
  const stage = stageById(use.stage);
  const p = Math.max(0, shelfIndex(use.stage));
  const start = blockStart(k, j);
  const fromLib = { x: LIB_BLOCK_X - appBlockX(k), y: libBlockY(p) - appBlockY(j) };
  const initial = skip ? false : use.isNew ? { scale: 0.6, opacity: 0 } : { ...fromLib, opacity: 0 };
  const transition = skip
    ? undefined
    : use.isNew
      ? { duration: BUILD_DUR, delay: start, ease: EASE }
      : {
          x: { duration: FLY_DUR, delay: start, ease: EASE },
          y: { duration: FLY_DUR, delay: start, ease: EASE },
          opacity: { duration: 0.15, delay: start },
        };
  return (
    <motion.div
      style={{
        position: "absolute",
        left: appBlockX(k),
        top: appBlockY(j),
        width: BLOCK_W,
        height: BLOCK_H,
        boxSizing: "border-box",
        borderRadius: 6,
        background: stage.body,
        border: use.isNew ? "2px solid var(--pv24-accent)" : "1px solid var(--pv24-border)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: use.isNew ? "0 7px 0 9px" : "0 8px 0 10px",
        zIndex: 2,
      }}
      initial={initial}
      animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      transition={transition}
    >
      <StageChip stage={stage} />
      <StageName label={stage.label} />
      <Tag isNew={use.isNew} />
    </motion.div>
  );
}

const usesOf = (k: number): Use[] => APPS[k]?.uses ?? [];
const newCountOf = (k: number) => usesOf(k).filter((u) => u.isNew).length;
const assembledT = (k: number) =>
  Math.max(0, ...usesOf(k).map((u, j) => blockStart(k, j) + (u.isNew ? BUILD_DUR : FLY_DUR)));

function NewBuildCounter({ k, skip }: { k: number; skip: boolean }) {
  const [count, setCount] = React.useState(() => usesOf(k).length);
  const { paused } = useDeckMotion();
  // Running time already spent, in ms, so a pause resumes the countdown in place
  const clockRef = React.useRef(0);

  React.useEffect(() => {
    if (skip || paused) return;
    const base = clockRef.current;
    const resumedAt = performance.now();
    const floor = newCountOf(k);
    const timers: number[] = [];
    usesOf(k).forEach((u, j) => {
      if (u.isNew) return;
      const ms = (blockStart(k, j) + FLY_DUR) * 1000;
      if (ms >= base) timers.push(window.setTimeout(() => setCount((c) => Math.max(floor, c - 1)), ms - base));
    });
    return () => {
      clockRef.current = base + (performance.now() - resumedAt);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [skip, paused, k]);

  const value = skip ? newCountOf(k) : count;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
      <motion.span
        key={value}
        initial={skip ? false : { y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={skip ? undefined : { duration: 0.25 }}
        style={{
          display: "inline-block",
          fontSize: 34,
          fontWeight: 700,
          lineHeight: "40px",
          color: "var(--pv24-accent-dark)",
          minWidth: 22,
          textAlign: "right",
        }}
      >
        {value}
      </motion.span>
      <span style={{ fontSize: 22, fontWeight: 700, lineHeight: "28px", color: "var(--pv24-accent-dark)" }}>
        {value === 1 ? "stage" : "stages"}
      </span>
    </span>
  );
}

function AppCard({ k, app, skip }: { k: number; app: RoleApp; skip: boolean }) {
  const Icon = app.Icon;
  const preview = app.status === "preview";
  return (
    <motion.div
      style={{
        position: "absolute",
        left: cardX(k),
        top: CARD_Y,
        width: CARD_W,
        height: CARD_H,
        boxSizing: "border-box",
        borderRadius: 8,
        background: "var(--pv24-surface)",
        border: preview ? "1.5px dashed var(--pv24-border-strong)" : "1px solid var(--pv24-border)",
        zIndex: 1,
      }}
      initial={skip ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skip ? undefined : { duration: 0.4, delay: cardT(k), ease: EASE }}
    >
      <div style={{ position: "absolute", left: 16, top: 11, display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 46,
            height: 46,
            flexShrink: 0,
            borderRadius: 8,
            background: "var(--pv24-accent-lightest)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={26} stroke={1.8} color="var(--pv24-accent-dark)" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                lineHeight: "20px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--pv24-text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              Role App {k + 1}
            </span>
            <StatusChip status={app.status} />
          </div>
          <span
            style={{ fontSize: 22, fontWeight: 700, lineHeight: "28px", color: "var(--pv24-text)", whiteSpace: "nowrap" }}
          >
            {app.name}
          </span>
        </div>
      </div>

      {app.note && (
        <motion.span
          style={{
            position: "absolute",
            left: 18,
            top: FOOTER_Y - CARD_Y - 34,
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 16,
            lineHeight: "20px",
            fontStyle: "italic",
            color: "var(--pv24-text-secondary)",
            whiteSpace: "nowrap",
          }}
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skip ? undefined : { duration: 0.3, delay: cardT(k) + 0.3 }}
        >
          <IconCircleDashed size={16} stroke={2} color="var(--pv24-text-secondary)" />
          {app.note}
        </motion.span>
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: FOOTER_Y - CARD_Y - 1,
          height: FOOTER_H - 2,
          boxSizing: "border-box",
          borderTop: "1px solid var(--pv24-border)",
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, lineHeight: "24px", color: "var(--pv24-text-secondary)" }}>
            New build:
          </span>
          <NewBuildCounter k={k} skip={skip} />
        </div>
        <motion.span
          style={{ fontSize: 16, lineHeight: "20px", color: "var(--pv24-text-secondary)", whiteSpace: "nowrap" }}
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={skip ? undefined : { duration: 0.3, delay: assembledT(k) }}
        >
          {app.caption}
        </motion.span>
      </div>
    </motion.div>
  );
}

function SequenceArrow({ k, skip }: { k: number; skip: boolean }) {
  const x1 = cardX(k) + CARD_W + 4;
  const x2 = cardX(k + 1) - 4;
  const y = FOOTER_Y + FOOTER_H / 2;
  return (
    <motion.path
      d={`M${x1} ${y} L${x2} ${y} M${x2 - 8} ${y - 7} L${x2} ${y} L${x2 - 8} ${y + 7}`}
      fill="none"
      stroke="var(--pv24-border-strong)"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={skip ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={skip ? undefined : { duration: 0.3, delay: cardT(k + 1) }}
    />
  );
}

function Peg({ x, delay, skip }: { x: number; delay: number; skip: boolean }) {
  return (
    <motion.span
      style={{
        position: "absolute",
        display: "block",
        left: x,
        top: CARD_Y + CARD_H,
        width: 34,
        height: BASE_Y - (CARD_Y + CARD_H),
        background: "var(--pv24-border-strong)",
      }}
      initial={skip ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={skip ? undefined : { duration: 0.3, delay }}
    />
  );
}

function PackChip({ children, preview }: { children: React.ReactNode; preview: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        flexShrink: 0,
        height: 32,
        boxSizing: "border-box",
        padding: "0 11px 0 9px",
        borderRadius: 6,
        background: preview ? "var(--pv24-canvas)" : "var(--pv24-surface)",
        border: preview ? "1.5px dashed var(--pv24-border-strong)" : "1px solid var(--pv24-border-strong)",
        fontSize: 16,
        lineHeight: "20px",
        color: "var(--pv24-text)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function LegendItem({ swatch, term, text }: { swatch: React.CSSProperties; term: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
      <span
        style={{
          display: "block",
          width: 30,
          height: 20,
          marginTop: 1,
          borderRadius: 4,
          flexShrink: 0,
          boxSizing: "border-box",
          ...swatch,
        }}
      />
      <span style={{ fontSize: 16, lineHeight: "22px", color: "var(--pv24-text)" }}>
        <span style={{ fontWeight: 700 }}>{term}:</span>{" "}
        <span style={{ color: "var(--pv24-text-secondary)" }}>{text}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ServiceFactoryExhibit({ data, exportMode }: ServiceFactoryExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode === true || !!prefersReduced;

  const managed = data.architectureLayers.find((l) => l.level === "managed");
  const platform = data.architectureLayers.find((l) => l.level === "platform");

  const fade = (delay: number, y = 0) => ({
    initial: skip ? (false as const) : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: skip ? undefined : { duration: 0.4, delay, ease: EASE },
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        overflow: "hidden",
        fontFamily: "var(--pv24-font-family)",
      }}
    >
      {/* Baseplate */}
      <motion.div
        style={{
          position: "absolute",
          left: BASE_X,
          top: BASE_Y,
          width: BASE_W,
          height: BASE_H,
          boxSizing: "border-box",
          borderRadius: 8,
          background: "var(--pv24-text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 26px",
        }}
        {...fade(0, 16)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IconServer size={26} stroke={1.8} color="#FFFFFF" />
          <span style={{ fontSize: 23, fontWeight: 700, lineHeight: "28px", color: "#FFFFFF", whiteSpace: "nowrap" }}>
            {platform?.label ?? "NFR Operating System"}
          </span>
          <span style={{ fontSize: 19, lineHeight: "24px", color: "var(--pv24-border)", whiteSpace: "nowrap" }}>
            Identity, authority, audit, connectors and AI
          </span>
        </div>
        <span style={{ fontSize: 18, fontWeight: 600, lineHeight: "24px", color: "#FFFFFF", whiteSpace: "nowrap" }}>
          Shared by every Function Pack and Role App
        </span>
      </motion.div>

      {/* Pegs: everything stands on the baseplate */}
      <Peg x={LIB_X + 80} delay={0.2} skip={skip} />
      <Peg x={LIB_X + LIB_W - 114} delay={0.2} skip={skip} />
      {APPS.map((_, k) => (
        <React.Fragment key={k}>
          <Peg x={cardX(k) + 80} delay={cardT(k)} skip={skip} />
          <Peg x={cardX(k) + CARD_W - 114} delay={cardT(k)} skip={skip} />
        </React.Fragment>
      ))}

      {/* Function Pack shelf: RCSA and Operational Risk */}
      <motion.div
        style={{
          position: "absolute",
          left: LIB_X,
          top: LIB_Y,
          width: LIB_W,
          height: LIB_H,
          boxSizing: "border-box",
          borderRadius: 8,
          background: "var(--pv24-surface)",
          border: "1px solid var(--pv24-border)",
        }}
        {...fade(0.1, 12)}
      >
        <div style={{ position: "absolute", left: 18, top: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 46,
              height: 46,
              flexShrink: 0,
              borderRadius: 8,
              background: "var(--pv24-accent-dark)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconPackages size={26} stroke={1.8} color="#FFFFFF" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                lineHeight: "20px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--pv24-text-secondary)",
              }}
            >
              Function Pack
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, lineHeight: "28px", color: "var(--pv24-text)", whiteSpace: "nowrap" }}>
              RCSA and Operational Risk
            </span>
          </div>
        </div>
        <span
          style={{
            position: "absolute",
            left: 18,
            top: 84,
            fontSize: 16,
            lineHeight: "20px",
            color: "var(--pv24-text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          8 installed stages, each built once
        </span>
        <motion.div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: FOOTER_Y - LIB_Y - 1,
            height: FOOTER_H - 2,
            boxSizing: "border-box",
            borderTop: "1px solid var(--pv24-border)",
            padding: "0 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
          {...fade(cardT(1), 8)}
        >
          <div
            style={{
              width: 46,
              height: 46,
              flexShrink: 0,
              borderRadius: 8,
              background: "var(--pv24-accent-lightest)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconRecycle size={26} stroke={1.8} color="var(--pv24-accent-dark)" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 700, lineHeight: "26px", color: "var(--pv24-accent-dark)" }}>
              Built once, then reused
            </span>
            <span style={{ fontSize: 16, lineHeight: "20px", color: "var(--pv24-text-secondary)", whiteSpace: "nowrap" }}>
              New stages only when none fits
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Empty shelf slots that fill as stages are built */}
      {!skip &&
        PACK_STAGES.map((stage, p) => {
          const dur = libFillTime(stage.id) + FLY_DUR;
          return (
            <motion.div
              key={`slot-${stage.id}`}
              style={{
                position: "absolute",
                left: LIB_BLOCK_X,
                top: libBlockY(p),
                width: BLOCK_W,
                height: BLOCK_H,
                boxSizing: "border-box",
                borderRadius: 6,
                border: "2px dashed var(--pv24-border-strong)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: dur, times: [0, 0.3 / dur, 0.95, 1], delay: 0 }}
            />
          );
        })}

      {/* Managed service band */}
      <motion.div
        style={{
          position: "absolute",
          left: BAND_X,
          top: BAND_Y,
          width: BAND_W,
          height: BAND_H,
          boxSizing: "border-box",
          borderRadius: 8,
          background: "var(--pv24-accent-lightest)",
          border: "1px solid var(--pv24-brand-purple-light)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 22px",
        }}
        {...fade(BAND_T, -10)}
      >
        <IconHeadset size={24} stroke={1.8} color="var(--pv24-accent-dark)" />
        <span style={{ fontSize: 20, lineHeight: "26px", color: "var(--pv24-accent-dark)", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 700 }}>{managed?.label ?? "Managed service"}:</span> we run, monitor and improve
          every app
        </span>
      </motion.div>

      {/* Role Apps */}
      {APPS.map((app, k) => (
        <AppCard key={app.name} k={k} app={app} skip={skip} />
      ))}

      <svg
        aria-hidden="true"
        width={1920}
        height={780}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 1 }}
      >
        {APPS.slice(1).map((_, i) => (
          <SequenceArrow key={i} k={i} skip={skip} />
        ))}
      </svg>

      {PACK_STAGES.map((stage, p) => (
        <LibraryBlock key={stage.id} stage={stage} p={p} skip={skip} />
      ))}

      {APPS.map((app, k) =>
        app.uses.map((use, j) => <AppBlock key={`${k}-${use.stage}`} k={k} j={j} use={use} skip={skip} />),
      )}

      {/* The other Function Packs on the same platform */}
      <motion.div
        style={{
          position: "absolute",
          left: 40,
          top: PACKS_Y,
          height: PACKS_H,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
        {...fade(PACKS_T, 8)}
      >
        <PackChip preview={false}>
          <IconPackage size={18} stroke={1.9} color="var(--pv24-accent-dark)" />
          <span style={{ fontWeight: 700 }}>Third-Party Risk</span>
          <span style={{ color: "var(--pv24-text-secondary)" }}>Third-Party Onboarding installed, 3 apps in preview</span>
        </PackChip>
        <span
          style={{
            marginLeft: 14,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: "20px",
            color: "var(--pv24-text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          Packs in preview:
        </span>
        {PREVIEW_PACKS.map((name) => (
          <PackChip key={name} preview>
            <IconPackage size={18} stroke={1.9} color="var(--pv24-text-secondary)" />
            {name}
          </PackChip>
        ))}
      </motion.div>

      {/* Legend */}
      <motion.div
        style={{
          position: "absolute",
          left: 40,
          top: LEGEND_Y,
          width: 1840,
          height: LEGEND_H,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 250px",
          alignItems: "start",
          columnGap: 36,
        }}
        {...fade(LEGEND_T, 8)}
      >
        <LegendItem
          swatch={{ background: "var(--pv24-text)" }}
          term="Platform"
          text="the shared operating layer for identity, authority, audit, connectors and AI."
        />
        <LegendItem
          swatch={{ background: "#EBDCFB", border: "1px solid var(--pv24-border-strong)" }}
          term="Function Pack"
          text="one risk discipline, with its stages, tools, evaluations and connectors."
        />
        <LegendItem
          swatch={{ background: "var(--pv24-surface)", border: "2px solid var(--pv24-accent)" }}
          term="Role App"
          text="a complete process for one role, assembled from its pack's stages."
        />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifySelf: "end" }}>
          <IconInfoCircle size={18} stroke={2.2} color="var(--pv24-accent-dark)" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 600, lineHeight: "22px", color: "var(--pv24-accent-dark)" }}>
            Preview apps reuse installed stages by design
          </span>
        </div>
      </motion.div>
    </div>
  );
}
