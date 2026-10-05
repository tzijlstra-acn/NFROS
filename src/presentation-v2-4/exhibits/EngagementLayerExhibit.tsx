"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  IconApps,
  IconBuildingStore,
  IconCalendarEvent,
  IconChecks,
  IconClipboardCheck,
  IconCpu,
  IconDatabase,
  IconFiles,
  IconFingerprint,
  IconGauge,
  IconGavel,
  IconHistory,
  IconMessages,
  IconPlug,
  IconPlugConnected,
  IconRoute,
  IconScale,
  IconShieldCheck,
  IconShieldHalfFilled,
  IconTerminal2,
} from "@tabler/icons-react";
import type { EngagementLayerData } from "../data/types";
import { useDeckMotion } from "../motion/DeckMotion";

interface Props {
  data: EngagementLayerData;
  exportMode?: boolean;
}

type TablerIcon = typeof IconCpu;
type Pt = readonly [number, number];
type Rect = { x: number; y: number; w: number; h: number };

// Native exhibit stage: 1920 x 780
const FRAME = { x: 24, y: 8, w: 1370, h: 576 };
const FRAME_BOTTOM = FRAME.y + FRAME.h;
const TITLE_H = 50;
const STATUS_Y = 534;
const STATUS_H = FRAME_BOTTOM - STATUS_Y;
const BAND_X = 36;
const BAND_W = 1346;
const LABEL_X = 48;
const LABEL_W = 204;
const COL5_W = 208;
const COL3_W = 356;
const col5 = (i: number) => 268 + i * 222;
const col3 = (i: number) => 268 + i * 370;
const CHIP_H = 56;
const ROW = {
  ws: { band: 70, bandH: 152, y: 78, h: 136 },
  svc: { band: 250, bandH: 72, y: 258 },
  kern: { band: 350, bandH: 72, y: 358 },
  conn: { band: 450, bandH: 72, y: 458 },
} as const;
const SYS_Y = 640;
const SYS_H = 98;
const CONSOLE = { x: 1422, y: 8, w: 474, h: 730 };

const ACCENT = "#A100FF";
const ACCENT_DARK = "#7600BC";
const ACCENT_LIGHT = "#CC66FF";
const ACCENT_LIGHTEST = "#F3E5FF";
const BORDER = "#D8DAE0";
const BORDER_STRONG = "#9DA1AE";
const MUTED = "#F0F1F4";
const TEXT = "#111214";
const TEXT_2 = "#5A5E6B";
const CON_TEXT = "#F5F6F8";
const CON_DIM = "#9DA1AE";
const GLOW_ON = "0 0 0 3px rgba(161, 0, 255, 0.22), 0 0 22px rgba(161, 0, 255, 0.35)";
const GLOW_OFF = "0 0 0 0px rgba(161, 0, 255, 0), 0 0 0px rgba(161, 0, 255, 0)";
const MONO = 'Consolas, Menlo, "Courier New", monospace';

// Boot and steady state timing
// Ten boot phases finish by 2.77 s and the first trace step settles by about 3.9 s,
// inside the 4 s reveal budget; later steps are the steady loop
const BOOT_START = 250;
const BOOT_STEP = 280;
const STEADY_START = 2900;
const STEP_MS = 2600;
const TRAVEL_S = 1.0;

const DEFAULT_SYSTEMS = ["GRC", "Collaboration", "Documents", "Process intelligence", "Data"] as const;
const DEFAULT_WORK = ["Daily work", "Role Apps", "Decisions"] as const;
const DEFAULT_CONTROLS = ["Identity", "Authority", "Approval", "Audit", "Evaluation"] as const;
const DEFAULT_PATH = ["Source signal", "Prepared work", "Human decision", "Approved execution", "External receipt"] as const;

const SYSTEM_ICONS: readonly TablerIcon[] = [IconShieldCheck, IconMessages, IconFiles, IconRoute, IconDatabase];
const SYSTEM_HOLDS = ["Controls, issues", "Mail, meetings", "Policies, evidence", "Event logs", "Risk data, KRIs"] as const;
const SERVICE_ICONS: readonly TablerIcon[] = [IconCalendarEvent, IconApps, IconScale];
const CONTROL_ICONS: readonly TablerIcon[] = [IconFingerprint, IconGavel, IconChecks, IconHistory, IconGauge];

// Role workspaces from the role release data: two available roles and one demo role
const WORKSPACES = [
  { name: "Operational Risk", icon: IconShieldHalfFilled, status: "3 decisions ready", detail: "Next: KRI breach, payments" },
  { name: "TPRM", icon: IconBuildingStore, status: "Onboarding at stage 4", detail: "Next: Veridian evidence review" },
  { name: "Control Assurance", icon: IconClipboardCheck, status: "Demo role", detail: "Same core, no Role App yet" },
] as const;
const DEMO_WORKSPACE = 2;

// Work item route through the stack: dwell points per step
const P0: Pt = [372, 612];
const P1: Pt = [372, 336];
const P2: Pt = [372, 236];
const P3: Pt = [594, 436];
const ROUTES: readonly (readonly Pt[])[] = [
  [P0],
  [P0, P1],
  [P1, P2],
  [P2, [594, 236], P3],
  [P3, [372, 436], P0],
];
const ACTIVE_BY_STEP = ["sys0", "svc0", "ws0", "kern1", "sys0"] as const;
const PASSES_BY_STEP: Record<number, string[]> = { 1: ["conn0", "kern0"], 4: ["conn0"] };
const SKIP_STEP = 2;

const pick = (arr: readonly string[], fallback: readonly string[]): string[] => fallback.map((f, i) => arr[i] ?? f);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function rectOf(id: string): Rect {
  const i = Number(id.replace(/\D/g, ""));
  if (id.startsWith("conn")) return { x: col5(i), y: ROW.conn.y, w: COL5_W, h: CHIP_H };
  if (id.startsWith("kern")) return { x: col5(i), y: ROW.kern.y, w: COL5_W, h: CHIP_H };
  if (id.startsWith("svc")) return { x: col3(i), y: ROW.svc.y, w: COL3_W, h: CHIP_H };
  if (id.startsWith("ws")) return { x: col3(i), y: ROW.ws.y, w: COL3_W, h: ROW.ws.h };
  return { x: col5(i), y: SYS_Y, w: COL5_W, h: SYS_H };
}

function routeLengths(route: readonly Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const prev = out[i - 1] ?? 0;
    out.push(a && b ? prev + Math.hypot(b[0] - a[0], b[1] - a[1]) : prev);
  }
  return out;
}

function fractionAt(route: readonly Pt[], p: Pt): number {
  const L = routeLengths(route);
  const total = L[L.length - 1] ?? 0;
  if (!total) return 0;
  let best = 0;
  let bestD = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    if (!a || !b) continue;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    if (d < bestD) {
      bestD = d;
      best = (L[i - 1] ?? 0) + t * Math.sqrt(len2);
    }
  }
  return best / total;
}

function tokenFrames(step: number) {
  const route = ROUTES[step] ?? [P0];
  const L = routeLengths(route);
  const total = L[L.length - 1] ?? 0;
  const travel = TRAVEL_S / (STEP_MS / 1000);
  const xs = route.map((p) => p[0]);
  const ys = route.map((p) => p[1]);
  const times = L.map((l) => (total ? (l / total) * travel : 0));
  const last = route[route.length - 1] ?? P0;
  xs.push(last[0]);
  ys.push(last[1]);
  times.push(1);
  const opacity = step === 0 ? [0, 1, 1] : step === 4 ? [1, 1, 0] : [1, 1];
  const opacityTimes = step === 0 ? [0, 0.12, 1] : step === 4 ? [0, 0.9, 1] : [0, 1];
  return { xs, ys, times, opacity, opacityTimes };
}

function Led({ on, blink, skip, size = 10 }: { on: boolean; blink?: boolean; skip: boolean; size?: number }) {
  const blinking = !!blink && !skip;
  return (
    <motion.span
      initial={false}
      animate={
        blinking
          ? { opacity: [0.3, 1, 0.3], backgroundColor: ACCENT_LIGHT }
          : {
              opacity: 1,
              backgroundColor: on ? ACCENT : BORDER_STRONG,
              boxShadow: on ? "0 0 0 3px rgba(161, 0, 255, 0.18)" : "0 0 0 0px rgba(161, 0, 255, 0)",
            }
      }
      transition={blinking ? { duration: 0.7, repeat: Infinity } : { duration: skip ? 0 : 0.3 }}
      style={{ display: "inline-block", width: size, height: size, borderRadius: size / 2, flex: "none" }}
    />
  );
}

function Dots({ size, color }: { size: number; color: string }) {
  return (
    <span style={{ display: "flex", gap: size * 0.6, flex: "none" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ display: "inline-block", width: size, height: size, borderRadius: size / 2, background: color }} />
      ))}
    </span>
  );
}

function LayerLabel({ y, h, title, sub, accent }: { y: number; h: number; title: string; sub: string; accent?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: LABEL_X,
        top: y,
        width: LABEL_W,
        height: h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: accent ? ACCENT_DARK : TEXT }}>{title}</span>
      <span style={{ fontSize: 16, lineHeight: 1.25, color: TEXT_2 }}>{sub}</span>
    </div>
  );
}

function chipStyle(r: Rect, on: boolean, radius = 10): CSSProperties {
  return {
    position: "absolute",
    left: r.x,
    top: r.y,
    width: r.w,
    height: r.h,
    boxSizing: "border-box",
    borderRadius: radius,
    borderWidth: 1.5,
    borderStyle: on ? "solid" : "dashed",
    background: "var(--pv24-surface)",
  };
}

function Chip({
  r,
  on,
  starting,
  active,
  skip,
  children,
}: {
  r: Rect;
  on: boolean;
  starting: boolean;
  active: boolean;
  skip: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={false}
      animate={{
        opacity: on || starting ? 1 : 0.55,
        borderColor: active ? ACCENT : on ? BORDER_STRONG : BORDER,
        boxShadow: active ? GLOW_ON : GLOW_OFF,
      }}
      transition={{ duration: skip ? 0 : 0.35 }}
      style={{ ...chipStyle(r, on), display: "flex", alignItems: "center", gap: 10, padding: "0 14px" }}
    >
      {children}
    </motion.div>
  );
}

function Flash({ r, delay }: { r: Rect; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ delay, duration: 0.8, times: [0, 0.3, 1] }}
      style={{
        position: "absolute",
        left: r.x - 4,
        top: r.y - 4,
        width: r.w + 8,
        height: r.h + 8,
        boxSizing: "border-box",
        borderRadius: 14,
        border: `2px solid ${ACCENT}`,
        boxShadow: "0 0 18px rgba(161, 0, 255, 0.45)",
        pointerEvents: "none",
      }}
    />
  );
}

export function EngagementLayerExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const [bootPhase, setBootPhase] = useState(0);
  const [tick, setTick] = useState(-1);
  const { paused } = useDeckMotion();
  // Running time already spent on the boot and the steady loop, so a pause resumes in place
  const clockRef = useRef(0);

  useEffect(() => {
    if (skip || paused) return;
    const base = clockRef.current;
    const resumedAt = performance.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let interval: ReturnType<typeof setInterval> | undefined;
    const at = (ms: number, fn: () => void) => {
      if (ms >= base) timers.push(setTimeout(fn, ms - base));
    };
    for (let k = 1; k <= 10; k++) {
      at(BOOT_START + (k - 1) * BOOT_STEP, () => setBootPhase(k));
    }
    // Steady loop: tick n fires at STEADY_START + n * STEP_MS
    let n = base <= STEADY_START ? 0 : Math.ceil((base - STEADY_START) / STEP_MS);
    timers.push(
      setTimeout(() => {
        setTick(n);
        interval = setInterval(() => {
          n += 1;
          setTick(n);
        }, STEP_MS);
      }, STEADY_START + n * STEP_MS - base),
    );
    return () => {
      clockRef.current = base + (performance.now() - resumedAt);
      timers.forEach(clearTimeout);
      if (interval) clearInterval(interval);
    };
  }, [skip, paused]);

  const [arrivedTick, setArrivedTick] = useState(-1);
  const travelRef = useRef({ tick: -1, spent: 0 });
  useEffect(() => {
    if (skip || tick < 0 || paused) return;
    if (travelRef.current.tick !== tick) travelRef.current = { tick, spent: 0 };
    const travel = travelRef.current;
    const startedAt = performance.now();
    const t = setTimeout(() => setArrivedTick(tick), Math.max(0, TRAVEL_S * 1000 - travel.spent));
    return () => {
      travel.spent += performance.now() - startedAt;
      clearTimeout(t);
    };
  }, [tick, skip, paused]);

  const systems = pick(data.systemsOfRecord, DEFAULT_SYSTEMS);
  const work = pick(data.workItems, DEFAULT_WORK);
  const controls = pick(data.controlItems, DEFAULT_CONTROLS);
  const path = pick(data.activeItemPath, DEFAULT_PATH);
  const sys = (i: number) => systems[i] ?? "";
  const ctl = (i: number) => controls[i] ?? "";
  const wsName = (i: number) => WORKSPACES[i]?.name ?? "";

  const boot: { text: string; status: string; lights: string[] }[] = [
    { text: `Connecting ${sys(0)}, ${sys(1)}`, status: "ok", lights: ["conn0", "conn1"] },
    { text: `Connecting ${sys(2)}`, status: "ok", lights: ["conn2"] },
    { text: `Connecting ${sys(3)}, ${sys(4)}`, status: "ok", lights: ["conn3", "conn4"] },
    { text: `Starting ${ctl(0)}, ${ctl(1)}`, status: "ok", lights: ["kern0", "kern1"] },
    { text: `Starting ${ctl(2)}, ${ctl(3)}, ${ctl(4)}`, status: "ok", lights: ["kern2", "kern3", "kern4"] },
    { text: "Starting work services", status: "ok", lights: ["svc0", "svc1", "svc2"] },
    { text: `Launching ${wsName(0)} workspace`, status: "ready", lights: ["ws0"] },
    { text: `Launching ${wsName(1)} workspace`, status: "ready", lights: ["ws1"] },
    { text: `Loading ${wsName(DEMO_WORKSPACE)} demo`, status: "demo", lights: ["ws2"] },
  ];

  const phase = skip ? 10 : bootPhase;
  const linesDone = Math.max(0, phase - 1);
  const inProgress = phase >= 1 && phase <= boot.length ? phase - 1 : -1;
  const booted = linesDone >= boot.length;
  const step = skip ? SKIP_STEP : tick >= 0 ? tick % 5 : -1;
  const steady = step >= 0;
  const wi = `WI-${2041 + (skip ? 0 : Math.max(0, Math.floor(tick / 5)))}`;

  const lit = new Set<string>();
  boot.slice(0, linesDone).forEach((l) => l.lights.forEach((id) => lit.add(id)));
  const starting = new Set<string>(inProgress >= 0 ? boot[inProgress]?.lights ?? [] : []);
  const arrived = skip || step === 0 || arrivedTick === tick;
  const activeId = steady && arrived ? ACTIVE_BY_STEP[step] : undefined;
  const isActive = (id: string) => activeId === id;
  const count = (prefix: string) => [...lit].filter((id) => id.startsWith(prefix)).length;
  const grcHot = steady && (step === 0 || step === 1 || step === 4);

  const locations = [sys(0), work[0] ?? "", wsName(0), ctl(1), sys(0)];
  const captions = [
    `${sys(0)} raises a control exception and passes it in through its connector.`,
    `The ${work[0] ?? ""} service prepares the case and evidence for the owner.`,
    `The ${wsName(0)} owner takes the decision in their own workspace.`,
    `${ctl(1)} confirms the mandate before anything executes.`,
    `${sys(0)} receives the outcome, with a receipt in the audit trail.`,
  ];

  const flashes =
    !skip && steady
      ? [
          ...(PASSES_BY_STEP[step] ?? []).map((id) => {
            const r = rectOf(id);
            return { id, delay: TRAVEL_S * fractionAt(ROUTES[step] ?? [P0], [r.x + r.w / 2, r.y + r.h / 2]) };
          }),
          { id: "kern3", delay: step === 0 ? 0.35 : TRAVEL_S },
        ]
      : [];

  const frames = steady ? tokenFrames(step) : null;
  const tokenAt = P2;

  const bands: { key: string; y: number; h: number; fill: string }[] = [
    { key: "ws", y: ROW.ws.band, h: ROW.ws.bandH, fill: MUTED },
    { key: "svc", y: ROW.svc.band, h: ROW.svc.bandH, fill: MUTED },
    { key: "kern", y: ROW.kern.band, h: ROW.kern.bandH, fill: ACCENT_LIGHTEST },
    { key: "conn", y: ROW.conn.band, h: ROW.conn.bandH, fill: MUTED },
  ];

  const consoleLine = (top: number): CSSProperties => ({
    position: "absolute",
    left: 20,
    right: 20,
    top,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontFamily: MONO,
    fontSize: 17,
    lineHeight: "30px",
    whiteSpace: "nowrap",
  });

  return (
    <div
      style={{ position: "absolute", inset: 0, background: "var(--pv24-canvas)", overflow: "hidden", fontFamily: "var(--pv24-font-family)" }}
      role="group"
      aria-label="NFR Operating System: role workspaces, OS services, control kernel and connectors on top of existing systems of record"
    >
      {/* OS window body */}
      <div
        style={{
          position: "absolute",
          left: FRAME.x,
          top: FRAME.y,
          width: FRAME.w,
          height: FRAME.h,
          boxSizing: "border-box",
          borderRadius: 14,
          border: `1.5px solid ${BORDER_STRONG}`,
          background: "var(--pv24-surface)",
          boxShadow: "0 10px 30px rgba(17, 18, 20, 0.08)",
        }}
      />

      <svg width={1920} height={780} viewBox="0 0 1920 780" style={{ position: "absolute", left: 0, top: 0 }} aria-hidden="true">
        {bands.map((b) => (
          <rect key={b.key} x={BAND_X} y={b.y} width={BAND_W} height={b.h} rx={10} fill={b.fill} />
        ))}

        {systems.map((_, i) => {
          const cx = col5(i) + COL5_W / 2;
          const on = lit.has(`conn${i}`);
          const hot = i === 0 && grcHot;
          const metal = hot ? ACCENT : on ? BORDER_STRONG : BORDER;
          return (
            <g key={`cable-${i}`}>
              <line
                x1={cx}
                y1={ROW.conn.y + CHIP_H}
                x2={cx}
                y2={SYS_Y - 7}
                stroke={metal}
                strokeWidth={hot ? 3 : 2}
                strokeDasharray={on ? undefined : "5 5"}
              />
              <rect x={cx - 11} y={FRAME_BOTTOM} width={22} height={7} rx={2} fill={metal} />
              <rect x={cx - 11} y={SYS_Y - 7} width={22} height={7} rx={2} fill={metal} />
            </g>
          );
        })}

        {frames && !skip && (
          <motion.g
            key={`token-${tick}`}
            data-pv24-loop=""
            initial={{ x: frames.xs[0] ?? P0[0], y: frames.ys[0] ?? P0[1], opacity: frames.opacity[0] ?? 1 }}
            animate={{ x: frames.xs, y: frames.ys, opacity: frames.opacity }}
            transition={{
              x: { duration: STEP_MS / 1000, times: frames.times, ease: "linear" },
              y: { duration: STEP_MS / 1000, times: frames.times, ease: "linear" },
              opacity: { duration: STEP_MS / 1000, times: frames.opacityTimes, ease: "linear" },
            }}
          >
            <motion.circle
              cx={0}
              cy={0}
              fill="none"
              stroke={ACCENT}
              strokeWidth={2}
              initial={{ r: 10, opacity: 0.6 }}
              animate={{ r: [10, 22], opacity: [0.6, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
            />
            <circle cx={0} cy={0} r={4.5} fill="none" stroke={ACCENT} strokeWidth={9} />
          </motion.g>
        )}
        {skip && (
          <g transform={`translate(${tokenAt[0]} ${tokenAt[1]})`}>
            <circle cx={0} cy={0} r={15} fill="none" stroke={ACCENT} strokeWidth={2} strokeOpacity={0.35} />
            <circle cx={0} cy={0} r={4.5} fill="none" stroke={ACCENT} strokeWidth={9} />
          </g>
        )}
      </svg>

      {/* Title bar */}
      <div
        style={{
          position: "absolute",
          left: FRAME.x,
          top: FRAME.y,
          width: FRAME.w,
          height: TITLE_H,
          boxSizing: "border-box",
          borderRadius: "14px 14px 0 0",
          border: `1.5px solid ${BORDER_STRONG}`,
          borderBottom: `1px solid ${BORDER}`,
          background: MUTED,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 20px",
        }}
      >
        <Dots size={12} color={BORDER_STRONG} />
        <IconCpu size={24} stroke={1.8} color={ACCENT} style={{ flex: "none", marginLeft: 6 }} />
        <span style={{ fontSize: 22, fontWeight: 600, color: TEXT, lineHeight: 1.2 }}>NFR Operating System</span>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 14px",
            borderRadius: 999,
            background: booted ? ACCENT_LIGHTEST : "var(--pv24-surface)",
            border: `1px solid ${booted ? ACCENT_LIGHT : BORDER}`,
            fontSize: 17,
            fontWeight: 600,
            color: booted ? ACCENT_DARK : TEXT_2,
            lineHeight: 1.2,
          }}
        >
          <Led on={booted} blink={!booted} skip={skip} />
          {booted ? "Running" : "Booting"}
        </span>
      </div>

      {/* Layer labels */}
      <LayerLabel y={ROW.ws.band} h={ROW.ws.bandH} title="Role workspaces" sub="Apps running on the OS" />
      <LayerLabel y={ROW.svc.band} h={ROW.svc.bandH} title="OS services" sub="Coordinate the work" />
      <LayerLabel y={ROW.kern.band} h={ROW.kern.bandH} title="Control kernel" sub="Checks every AI action" accent />
      <LayerLabel y={ROW.conn.band} h={ROW.conn.bandH} title="Connectors" sub="Device drivers" />
      <LayerLabel y={SYS_Y} h={SYS_H} title="Systems of record" sub="Existing platforms, plugged in, unchanged" />

      {/* Role workspaces */}
      {WORKSPACES.map((ws, i) => {
        const id = `ws${i}`;
        const on = lit.has(id);
        const isStarting = starting.has(id);
        const active = isActive(id);
        const r = rectOf(id);
        let status: string = on ? ws.status : isStarting ? "Starting" : "Not started";
        let detail: string = on ? ws.detail : "Waiting for boot";
        let statusColor = on && i !== DEMO_WORKSPACE ? TEXT : TEXT_2;
        if (on && i === 0 && active) {
          status = `Decision on ${wi}`;
          detail = "Approved by role owner";
          statusColor = ACCENT_DARK;
        }
        return (
          <motion.div
            key={id}
            initial={false}
            animate={{
              opacity: on ? 1 : isStarting ? 0.85 : 0.5,
              scale: on ? 1 : 0.96,
              borderColor: active ? ACCENT : on ? BORDER_STRONG : BORDER,
              boxShadow: active ? GLOW_ON : GLOW_OFF,
            }}
            transition={{ duration: skip ? 0 : 0.4, ease: "easeOut" }}
            style={{ ...chipStyle(r, on, 12), display: "flex", flexDirection: "column" }}
          >
            <div
              style={{
                height: 42,
                flex: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                borderRadius: "10px 10px 0 0",
                borderBottom: `1px solid ${on ? ACCENT_LIGHT : BORDER}`,
                background: on ? ACCENT_LIGHTEST : MUTED,
              }}
            >
              <ws.icon size={22} stroke={1.8} color={on ? ACCENT : BORDER_STRONG} style={{ flex: "none" }} />
              <span style={{ fontSize: 18, fontWeight: 600, color: on ? TEXT : TEXT_2, lineHeight: 1.2 }}>{ws.name}</span>
              <span style={{ marginLeft: "auto", display: "flex" }}>
                <Dots size={8} color={on ? ACCENT_LIGHT : BORDER} />
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, padding: "0 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Led on={on} blink={isStarting} skip={skip} />
                <span style={{ fontSize: 18, fontWeight: 600, color: statusColor, lineHeight: 1.25 }}>{status}</span>
              </div>
              <span style={{ fontSize: 16, color: TEXT_2, lineHeight: 1.25, paddingLeft: 20 }}>{detail}</span>
            </div>
          </motion.div>
        );
      })}

      {/* OS services */}
      {work.map((label, i) => {
        const id = `svc${i}`;
        const on = lit.has(id);
        const isStarting = starting.has(id);
        const active = isActive(id);
        const Icon = SERVICE_ICONS[i] ?? IconApps;
        const right = active ? `Preparing ${wi}` : on ? "running" : isStarting ? "starting" : "stopped";
        return (
          <Chip key={id} r={rectOf(id)} on={on} starting={isStarting} active={active} skip={skip}>
            <Led on={on} blink={isStarting} skip={skip} />
            <Icon size={22} stroke={1.8} color={on ? ACCENT : BORDER_STRONG} style={{ flex: "none" }} />
            <span style={{ fontSize: 18, fontWeight: 600, color: on ? TEXT : TEXT_2, lineHeight: 1.2 }}>{label}</span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 16,
                fontWeight: active ? 600 : 400,
                color: active ? ACCENT_DARK : TEXT_2,
                lineHeight: 1.2,
              }}
            >
              {right}
            </span>
          </Chip>
        );
      })}

      {/* Control kernel */}
      {controls.map((label, i) => {
        const id = `kern${i}`;
        const on = lit.has(id);
        const isStarting = starting.has(id);
        const Icon = CONTROL_ICONS[i] ?? IconCpu;
        return (
          <Chip key={id} r={rectOf(id)} on={on} starting={isStarting} active={isActive(id)} skip={skip}>
            <Led on={on} blink={isStarting} skip={skip} />
            <Icon size={22} stroke={1.8} color={on ? ACCENT : BORDER_STRONG} style={{ flex: "none" }} />
            <span style={{ fontSize: 18, fontWeight: 600, color: on ? TEXT : TEXT_2, lineHeight: 1.2 }}>{label}</span>
          </Chip>
        );
      })}

      {/* Connectors */}
      {systems.map((label, i) => {
        const id = `conn${i}`;
        const on = lit.has(id);
        const isStarting = starting.has(id);
        const PlugIcon = on ? IconPlugConnected : IconPlug;
        return (
          <Chip key={id} r={rectOf(id)} on={on} starting={isStarting} active={false} skip={skip}>
            <PlugIcon size={22} stroke={1.8} color={on ? ACCENT : isStarting ? ACCENT_LIGHT : BORDER_STRONG} style={{ flex: "none" }} />
            <span style={{ fontSize: 17, fontWeight: 600, color: on ? TEXT : TEXT_2, lineHeight: 1.15 }}>{label}</span>
          </Chip>
        );
      })}

      {/* Status bar */}
      <div
        style={{
          position: "absolute",
          left: FRAME.x,
          top: STATUS_Y,
          width: FRAME.w,
          height: STATUS_H,
          boxSizing: "border-box",
          borderRadius: "0 0 14px 14px",
          border: `1.5px solid ${BORDER_STRONG}`,
          borderTop: `1px solid ${BORDER}`,
          background: MUTED,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 22px",
          fontSize: 17,
          lineHeight: 1.2,
        }}
      >
        <Led on={booted} skip={skip} />
        <span style={{ color: TEXT }}>
          {plural(count("conn"), "system", "systems")} connected, {plural(count("kern"), "control service", "control services")} running,{" "}
          {plural(Math.min(count("ws"), DEMO_WORKSPACE), "role workspace", "role workspaces")} open
          {lit.has(`ws${DEMO_WORKSPACE}`) ? ", 1 demo" : ""}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontWeight: 600, color: steady ? ACCENT_DARK : TEXT_2 }}>
          {steady ? (
            <>
              <IconRoute size={20} stroke={1.8} color={ACCENT} style={{ flex: "none" }} />
              {`${wi}: ${path[step] ?? ""}`}
            </>
          ) : (
            `Booting, ${linesDone} of ${boot.length} steps done`
          )}
        </span>
      </div>

      {/* Systems of record */}
      {systems.map((label, i) => {
        const id = `sys${i}`;
        const active = isActive(id);
        const Icon = SYSTEM_ICONS[i] ?? IconDatabase;
        const note = active ? (step === 0 ? "Signal raised" : "Receipt logged") : SYSTEM_HOLDS[i] ?? "";
        return (
          <motion.div
            key={id}
            initial={false}
            animate={{ borderColor: active ? ACCENT : BORDER_STRONG, boxShadow: active ? GLOW_ON : GLOW_OFF }}
            transition={{ duration: skip ? 0 : 0.35 }}
            style={{
              ...chipStyle(rectOf(id), true, 8),
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 12px",
            }}
          >
            <Icon size={26} stroke={1.6} color={TEXT_2} style={{ flex: "none" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: TEXT, lineHeight: 1.15 }}>{label}</span>
              <span style={{ fontSize: 16, lineHeight: 1.2, fontWeight: active ? 600 : 400, color: active ? ACCENT_DARK : TEXT_2 }}>{note}</span>
            </div>
          </motion.div>
        );
      })}

      {flashes.map((f) => (
        <Flash key={`flash-${tick}-${f.id}`} r={rectOf(f.id)} delay={f.delay} />
      ))}

      {/* Boot console */}
      <div
        style={{
          position: "absolute",
          left: CONSOLE.x,
          top: CONSOLE.y,
          width: CONSOLE.w,
          height: CONSOLE.h,
          borderRadius: 14,
          background: "var(--pv24-text)",
          boxShadow: "0 10px 30px rgba(17, 18, 20, 0.18)",
          color: CON_TEXT,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: CONSOLE.w,
            height: 44,
            borderRadius: "14px 14px 0 0",
            background: "#24262B",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 18px",
            boxSizing: "border-box",
          }}
        >
          <Dots size={10} color="#5A5E6B" />
          <IconTerminal2 size={20} stroke={1.8} color={CON_DIM} style={{ flex: "none", marginLeft: 4 }} />
          <span style={{ fontSize: 17, fontWeight: 600, color: CON_TEXT, lineHeight: 1.2 }}>System console</span>
        </div>

        <div style={consoleLine(56)}>
          <span>
            <span style={{ color: ACCENT_LIGHT }}>$</span> nfros start
          </span>
        </div>

        {boot.map((line, i) => {
          const visible = i <= linesDone && (i < linesDone || i === inProgress);
          if (!visible) return null;
          const done = i < linesDone;
          return (
            <motion.div
              key={`boot-${i}`}
              initial={skip ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              style={consoleLine(88 + i * 32)}
            >
              <span style={{ color: done ? CON_TEXT : CON_DIM }}>{line.text}</span>
              {done ? (
                <span style={{ color: ACCENT_LIGHT, fontWeight: 700, flex: "none" }}>{line.status}</span>
              ) : (
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{ color: CON_DIM, flex: "none" }}
                >
                  ...
                </motion.span>
              )}
            </motion.div>
          );
        })}

        {booted && (
          <motion.div initial={skip ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <div style={consoleLine(88 + boot.length * 32)}>
              <span style={{ color: CON_TEXT, fontWeight: 700 }}>System ready</span>
              <span style={{ color: ACCENT_LIGHT, fontWeight: 700 }}>ok</span>
            </div>
            <div
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                top: 424,
                height: 0,
                borderTop: "1px solid rgba(245, 246, 248, 0.18)",
              }}
            />
          </motion.div>
        )}

        {steady && (
          <motion.div initial={skip ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <div style={consoleLine(436)}>
              <span>
                <span style={{ color: ACCENT_LIGHT }}>$</span> nfros trace {wi}
              </span>
            </div>
            {path.map((label, k) => {
              const current = k === step;
              return (
                <motion.div
                  key={`trace-${k}`}
                  initial={false}
                  animate={{ backgroundColor: current ? "rgba(161, 0, 255, 0.45)" : "rgba(161, 0, 255, 0)" }}
                  transition={{ duration: skip ? 0 : 0.3 }}
                  style={{
                    ...consoleLine(472 + k * 34),
                    left: 12,
                    right: 12,
                    height: 32,
                    lineHeight: "32px",
                    padding: "0 8px",
                    borderRadius: 6,
                    color: current ? CON_TEXT : CON_DIM,
                    fontWeight: current ? 700 : 400,
                  }}
                >
                  <span>
                    <span style={{ color: current ? ACCENT_LIGHT : CON_DIM }}>{current ? "■" : k < step ? "+" : " "}</span>
                    {` ${k + 1} ${label}`}
                  </span>
                  <span style={{ flex: "none" }}>{locations[k]}</span>
                </motion.div>
              );
            })}
            <motion.div
              key={`caption-${skip ? "static" : tick}`}
              initial={skip ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                top: 652,
                fontSize: 18,
                lineHeight: 1.4,
                color: CON_TEXT,
              }}
            >
              {captions[step] ?? ""}
            </motion.div>
          </motion.div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          right: 24,
          top: 748,
          fontSize: 16,
          lineHeight: 1.3,
          color: TEXT_2,
          fontStyle: "italic",
        }}
      >
        Illustrative: synthetic institution and data
      </div>
    </div>
  );
}
