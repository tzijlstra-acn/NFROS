"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconActivity,
  IconAlertTriangle,
  IconCategory,
  IconClipboardCheck,
  IconFileSearch,
  IconHeadset,
  IconInfoCircle,
  IconPackages,
  IconPlus,
  IconRecycle,
  IconRoute,
  IconServer,
  IconUserSearch,
  IconWriting,
} from "@tabler/icons-react";
import type { ServiceFactoryData } from "../data/types";

export type ServiceFactoryExhibitProps = {
  data: ServiceFactoryData;
  exportMode?: boolean;
};

type TablerIcon = React.ComponentType<{ size?: number; stroke?: number; color?: string }>;

// Native stage: 1920 x 780. Library and app cards share one column grid so blocks line up.
const COL_W = 424;
const COL_GAP = 48;
const BLOCK_INSET = 16;
const BLOCK_W = COL_W - BLOCK_INSET * 2;
const BLOCK_H = 64;
const PITCH = 74;

const LIB_X = 40;
const LIB_Y = 10;
const LIB_W = COL_W;
const LIB_BLOCK_X = LIB_X + BLOCK_INSET;
const LIB_BLOCK_Y0 = 94;

const CARD_X0 = LIB_X + COL_W + COL_GAP;
const CARD_W = COL_W;
const CARD_GAP = COL_GAP;
const CARD_Y = 80;
const CARD_H = 524;
const APP_BLOCK_Y0 = CARD_Y + 88;
const FOOTER_Y = CARD_Y + 388;
const FOOTER_H = CARD_Y + CARD_H - FOOTER_Y;
const LIB_H = CARD_Y + CARD_H - LIB_Y;

const BAND_X = CARD_X0;
const BAND_Y = 10;
const BAND_W = 1880 - CARD_X0;
const BAND_H = 54;

const BASE_X = 40;
const BASE_Y = 620;
const BASE_W = 1840;
const BASE_H = 74;

const LEGEND_Y = 712;
const LEGEND_H = 56;

const cardX = (k: number) => CARD_X0 + k * (CARD_W + CARD_GAP);
const appBlockX = (k: number) => cardX(k) + BLOCK_INSET;
const appBlockY = (j: number) => APP_BLOCK_Y0 + j * PITCH;
const libBlockY = (p: number) => LIB_BLOCK_Y0 + p * PITCH;

// Timeline in seconds
const CARD_TIMES = [0.7, 2.45, 3.9] as const;
const cardT = (k: number) => CARD_TIMES[k] ?? 0;
const blockStart = (k: number, j: number) => cardT(k) + 0.25 + j * 0.2;
const BUILD_DUR = 0.4;
const FLY_DUR = 0.55;
const BAND_T = 5.2;
const LEGEND_T = 5.4;
const EASE = [0.22, 1, 0.36, 1] as const;

type PackId = "evidence" | "drafting" | "routing" | "monitoring" | "classification";

type Pack = {
  id: PackId;
  label: string;
  Icon: TablerIcon;
  body: string;
  chip: string;
};

const PACKS: Pack[] = [
  { id: "evidence", label: "Evidence collection", Icon: IconFileSearch, body: "#F3E5FF", chip: "#7600BC" },
  { id: "drafting", label: "Assessment drafting", Icon: IconWriting, body: "#EBDCFB", chip: "#A100FF" },
  { id: "routing", label: "Approval routing", Icon: IconRoute, body: "#EEF0F3", chip: "#5A5E6B" },
  { id: "monitoring", label: "Monitoring", Icon: IconActivity, body: "#E4E6EB", chip: "#2B2D33" },
  { id: "classification", label: "Risk classification", Icon: IconCategory, body: "#F8EAFC", chip: "#B13FE6" },
];

type Use = { pack: PackId; isNew: boolean };

type RoleApp = {
  name: string;
  Icon: TablerIcon;
  uses: Use[];
  caption: string;
};

const APPS: RoleApp[] = [
  {
    name: "TPRM Reviewer",
    Icon: IconUserSearch,
    uses: [
      { pack: "evidence", isNew: true },
      { pack: "drafting", isNew: true },
      { pack: "routing", isNew: true },
      { pack: "monitoring", isNew: true },
    ],
    caption: "All 4 packs built for the first time",
  },
  {
    name: "RCSA Assistant",
    Icon: IconClipboardCheck,
    uses: [
      { pack: "evidence", isNew: false },
      { pack: "classification", isNew: true },
      { pack: "drafting", isNew: false },
      { pack: "routing", isNew: false },
    ],
    caption: "3 packs reused, 1 built new",
  },
  {
    name: "Incident Triage",
    Icon: IconAlertTriangle,
    uses: [
      { pack: "evidence", isNew: false },
      { pack: "classification", isNew: false },
      { pack: "routing", isNew: false },
      { pack: "monitoring", isNew: false },
    ],
    caption: "All 4 packs reused",
  },
];

const packIndex = (id: PackId) => PACKS.findIndex((p) => p.id === id);
const packById = (id: PackId): Pack => PACKS[packIndex(id)] ?? (PACKS[0] as Pack);

// Where each pack was first built: app index and slot index
function originOf(id: PackId): { k: number; j: number } {
  for (let k = 0; k < APPS.length; k++) {
    const app = APPS[k];
    if (!app) continue;
    const j = app.uses.findIndex((u) => u.pack === id && u.isNew);
    if (j >= 0) return { k, j };
  }
  return { k: 0, j: 0 };
}

const libFillTime = (id: PackId) => {
  const o = originOf(id);
  return blockStart(o.k, o.j) + BUILD_DUR;
};

// ---------------------------------------------------------------------------

function PackChip({ pack, size, iconSize }: { pack: Pack; size: number; iconSize: number }) {
  const Icon = pack.Icon;
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 6,
        background: pack.chip,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={iconSize} stroke={1.9} color="#FFFFFF" />
    </div>
  );
}

function Tag({ isNew }: { isNew: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
        padding: "4px 10px 4px 8px",
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
        <IconPlus size={16} stroke={2.6} color="#FFFFFF" />
      ) : (
        <IconRecycle size={16} stroke={2.2} color="var(--pv24-text-secondary)" />
      )}
      {isNew ? "New" : "Reused"}
    </span>
  );
}

function LibraryBlock({ pack, p, skip }: { pack: Pack; p: number; skip: boolean }) {
  const o = originOf(pack.id);
  const dx = appBlockX(o.k) - LIB_BLOCK_X;
  const dy = appBlockY(o.j) - libBlockY(p);
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
        background: pack.body,
        border: "1px solid var(--pv24-border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 12px 0 14px",
        zIndex: 3,
      }}
      initial={skip ? false : { x: dx, y: dy, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={
        skip
          ? undefined
          : {
              x: { duration: FLY_DUR, delay: libFillTime(pack.id), ease: EASE },
              y: { duration: FLY_DUR, delay: libFillTime(pack.id), ease: EASE },
              opacity: { duration: 0.2, delay: libFillTime(pack.id) },
            }
      }
    >
      <PackChip pack={pack} size={40} iconSize={22} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 19, fontWeight: 600, lineHeight: "24px", color: "var(--pv24-text)", whiteSpace: "nowrap" }}>
          {pack.label}
        </span>
        <span style={{ fontSize: 16, lineHeight: "20px", color: "var(--pv24-text-secondary)", whiteSpace: "nowrap" }}>
          Built once in Role App {o.k + 1}
        </span>
      </div>
    </motion.div>
  );
}

function AppBlock({ k, j, use, skip }: { k: number; j: number; use: Use; skip: boolean }) {
  const pack = packById(use.pack);
  const p = packIndex(use.pack);
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
        background: pack.body,
        border: use.isNew ? "2px solid var(--pv24-accent)" : "1px solid var(--pv24-border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: use.isNew ? "0 11px 0 13px" : "0 12px 0 14px",
        zIndex: 2,
      }}
      initial={initial}
      animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      transition={transition}
    >
      <PackChip pack={pack} size={34} iconSize={20} />
      <span
        style={{
          flex: 1,
          fontSize: 19,
          fontWeight: 600,
          lineHeight: "24px",
          color: "var(--pv24-text)",
          whiteSpace: "nowrap",
        }}
      >
        {pack.label}
      </span>
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

  React.useEffect(() => {
    if (skip) return;
    const floor = newCountOf(k);
    const timers: number[] = [];
    usesOf(k).forEach((u, j) => {
      if (u.isNew) return;
      const t = blockStart(k, j) + FLY_DUR;
      timers.push(window.setTimeout(() => setCount((c) => Math.max(floor, c - 1)), t * 1000));
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [skip, k]);

  const value = skip ? newCountOf(k) : count;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
      <motion.span
        key={value}
        initial={skip ? false : { y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={skip ? undefined : { duration: 0.25 }}
        style={{
          display: "inline-block",
          fontSize: 40,
          fontWeight: 700,
          lineHeight: "46px",
          color: "var(--pv24-accent-dark)",
          minWidth: 26,
          textAlign: "right",
        }}
      >
        {value}
      </motion.span>
      <span style={{ fontSize: 26, fontWeight: 700, lineHeight: "32px", color: "var(--pv24-accent-dark)" }}>
        {value === 1 ? "block" : "blocks"}
      </span>
    </span>
  );
}

function AppCard({ k, app, skip }: { k: number; app: RoleApp; skip: boolean }) {
  const Icon = app.Icon;
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
        border: "1px solid var(--pv24-border)",
        zIndex: 1,
      }}
      initial={skip ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={skip ? undefined : { duration: 0.4, delay: cardT(k), ease: EASE }}
    >
      <div style={{ position: "absolute", left: 18, top: 18, display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 8,
            background: "var(--pv24-accent-lightest)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={28} stroke={1.8} color="var(--pv24-accent-dark)" />
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
            Role App {k + 1}
          </span>
          <span style={{ fontSize: 24, fontWeight: 700, lineHeight: "30px", color: "var(--pv24-text)" }}>{app.name}</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: FOOTER_Y - CARD_Y - 1,
          height: FOOTER_H - 2,
          boxSizing: "border-box",
          borderTop: "1px solid var(--pv24-border)",
          padding: "0 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 600, lineHeight: "26px", color: "var(--pv24-text-secondary)" }}>
            New build:
          </span>
          <NewBuildCounter k={k} skip={skip} />
        </div>
        <motion.span
          style={{ fontSize: 17, lineHeight: "22px", color: "var(--pv24-text-secondary)" }}
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
      d={`M${x1} ${y} L${x2} ${y} M${x2 - 9} ${y - 8} L${x2} ${y} L${x2 - 9} ${y + 8}`}
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

function LegendItem({ swatch, term, text }: { swatch: React.CSSProperties; term: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap" }}>
      <span style={{ display: "block", width: 30, height: 20, borderRadius: 4, flexShrink: 0, boxSizing: "border-box", ...swatch }} />
      <span style={{ fontSize: 18, lineHeight: "24px", color: "var(--pv24-text)" }}>
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
          padding: "0 28px",
        }}
        {...fade(0, 16)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IconServer size={28} stroke={1.8} color="#FFFFFF" />
          <span style={{ fontSize: 24, fontWeight: 700, lineHeight: "30px", color: "#FFFFFF", whiteSpace: "nowrap" }}>
            {platform?.label ?? "NFR Operating System"}
          </span>
          <span style={{ fontSize: 20, lineHeight: "26px", color: "var(--pv24-border)", whiteSpace: "nowrap" }}>
            {platform?.sublabel ?? "Platform, identity, AI, connectors"}
          </span>
        </div>
        <span style={{ fontSize: 19, fontWeight: 600, lineHeight: "24px", color: "#FFFFFF", whiteSpace: "nowrap" }}>
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

      {/* Function Pack library */}
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
        {...fade(0.15, 12)}
      >
        <div style={{ position: "absolute", left: 18, top: 13, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <IconPackages size={30} stroke={1.8} color="var(--pv24-accent-dark)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 24, fontWeight: 700, lineHeight: "30px", color: "var(--pv24-text)" }}>
              Function Pack library
            </span>
            <span style={{ fontSize: 17, lineHeight: "22px", color: "var(--pv24-text-secondary)" }}>
              Capabilities any Role App can use
            </span>
          </div>
        </div>
        <motion.div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: FOOTER_Y - LIB_Y - 1,
            height: FOOTER_H - 2,
            boxSizing: "border-box",
            borderTop: "1px solid var(--pv24-border)",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
          {...fade(cardT(1), 8)}
        >
          <div
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: 8,
              background: "var(--pv24-accent-lightest)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconRecycle size={28} stroke={1.8} color="var(--pv24-accent-dark)" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, lineHeight: "28px", color: "var(--pv24-accent-dark)" }}>
              Built once, then reused
            </span>
            <span style={{ fontSize: 17, lineHeight: "22px", color: "var(--pv24-text-secondary)" }}>
              The App Factory adds a pack only when no existing pack fits
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Empty library slots that fill as packs are built */}
      {!skip &&
        PACKS.map((pack, p) => (
          <motion.div
            key={`slot-${pack.id}`}
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
            transition={{
              duration: libFillTime(pack.id) + FLY_DUR,
              times: [0, 0.3 / (libFillTime(pack.id) + FLY_DUR), 0.95, 1],
              delay: 0,
            }}
          />
        ))}

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
        <IconHeadset size={26} stroke={1.8} color="var(--pv24-accent-dark)" />
        <span style={{ fontSize: 21, lineHeight: "26px", color: "var(--pv24-accent-dark)", whiteSpace: "nowrap" }}>
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

      {PACKS.map((pack, p) => (
        <LibraryBlock key={pack.id} pack={pack} p={p} skip={skip} />
      ))}

      {APPS.map((app, k) =>
        app.uses.map((use, j) => <AppBlock key={`${k}-${use.pack}`} k={k} j={j} use={use} skip={skip} />),
      )}

      {/* Legend */}
      <motion.div
        style={{
          position: "absolute",
          left: 40,
          top: LEGEND_Y,
          height: LEGEND_H,
          display: "flex",
          alignItems: "center",
          gap: 40,
        }}
        {...fade(LEGEND_T, 8)}
      >
        <LegendItem swatch={{ background: "var(--pv24-text)" }} term="Platform" text="the shared operating layer" />
        <LegendItem
          swatch={{ background: "#EBDCFB", border: "1px solid var(--pv24-border-strong)" }}
          term="Function Pack"
          text="a reusable capability, built once"
        />
        <LegendItem
          swatch={{ background: "var(--pv24-surface)", border: "2px solid var(--pv24-accent)" }}
          term="Role App"
          text="a complete process for one role, assembled from packs"
        />
      </motion.div>

      <motion.div
        style={{
          position: "absolute",
          right: 40,
          top: LEGEND_Y,
          height: LEGEND_H,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 4,
        }}
        {...fade(LEGEND_T, 8)}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "1px 10px 1px 8px",
            borderRadius: 4,
            background: "var(--pv24-accent-lightest)",
            fontSize: 16,
            fontWeight: 700,
            lineHeight: "22px",
            color: "var(--pv24-accent-dark)",
          }}
        >
          <IconInfoCircle size={16} stroke={2.2} color="var(--pv24-accent-dark)" />
          Illustrative
        </span>
        <span style={{ fontSize: 16, lineHeight: "20px", fontStyle: "italic", color: "var(--pv24-text-secondary)" }}>
          Synthetic institution and data
        </span>
      </motion.div>
    </div>
  );
}
