"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  IconCalendarEvent,
  IconClock,
  IconDatabase,
  IconFileText,
  IconGitCompare,
  IconKeyboard,
  IconListCheck,
  IconMail,
  IconMessages,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconUser,
  IconUserCheck,
} from "@tabler/icons-react";
import type { FragmentationSankeyData } from "../data/types";

interface Props {
  data: FragmentationSankeyData;
  exportMode?: boolean;
}

type TablerIcon = typeof IconMail;
type Pt = readonly [number, number];
type Cubic = readonly [Pt, Pt, Pt, Pt];
type Flow = { src: number; act: number; curve: Cubic };

const W = 1920;
const H = 780;

const FLOW_TOP = 92;
const FLOW_BOTTOM = 596;

const SRC_X = 60;
const SRC_W = 280;
const SRC_H = 64;
const SRC_R = SRC_X + SRC_W;

const ACT_X = 760;
const ACT_W = 340;
const ACT_H = 96;
const ACT_R = ACT_X + ACT_W;
const ACT_CX = ACT_X + ACT_W / 2;
const TRACK_W = 300;
const SEG_W = [72, 84, 96, 108] as const;
const SEG_REST = [0.15, 0.7, 0.4, 0.9] as const;

const DEC_X = 1520;
const DEC_W = 320;
const DEC_H = 360;
const DEC_CY = (FLOW_TOP + FLOW_BOTTOM) / 2;
const DEC_Y = DEC_CY - DEC_H / 2;

const BAR_X = 60;
const BAR_W = 1780;
const BAR_Y = 676;
const BAR_H = 60;
const JUDGMENT_W = 170;

const MID_X = (SRC_R + ACT_X) / 2;

const TINTS = ["#4F5D75", "#5E7C8A", "#7C7F8C", "#8A7A63", "#5F6B5A", "#6E6A86"] as const;
const ROUTES: ReadonlyArray<readonly [number, number]> = [[0, 2], [2, 3], [0, 1], [1, 3], [1, 0], [3, 2]];
const FROZEN_T = [0.66, 0.18, 0.74, 0.82, 0.82, 0.66, 0.42, 0.58, 0.82, 0.26, 0.34, 0.18] as const;

const PARTICLES_START = 1.6;
const TRICKLE_BEGIN = 3.4;
const TRICKLE_CYCLE = 5.2;
const TRICKLE_TRAVEL = 0.35;

const SOURCE_ICONS: Record<string, TablerIcon> = {
  mail: IconMail,
  meetings: IconCalendarEvent,
  documents: IconFileText,
  grc: IconShieldCheck,
  data: IconDatabase,
  actions: IconListCheck,
};
const SOURCE_FALLBACK = [IconMail, IconCalendarEvent, IconFileText, IconShieldCheck, IconDatabase, IconListCheck] as const;

const ACTIVITY_ICONS: Record<string, TablerIcon> = {
  find: IconSearch,
  reconcile: IconGitCompare,
  coordinate: IconMessages,
  "re-enter": IconKeyboard,
};
const ACTIVITY_FALLBACK = [IconSearch, IconGitCompare, IconMessages, IconKeyboard] as const;

const HEADERS = [
  { title: "Fragmented information", sub: "Scattered across disconnected systems", x: SRC_X, w: 440, accent: false },
  { title: "Manual processing", sub: "People's time is consumed here", x: ACT_X, w: 520, accent: false },
  { title: "Decision", sub: "Where judgment happens", x: DEC_X, w: DEC_W, accent: true },
] as const;

const tintOf = (i: number) => TINTS[i % TINTS.length] ?? "#7C7F8C";
const srcTop = (i: number, n: number) => FLOW_TOP + i * ((FLOW_BOTTOM - FLOW_TOP - SRC_H) / Math.max(n - 1, 1));
const actTop = (i: number, n: number) => FLOW_TOP + i * ((FLOW_BOTTOM - FLOW_TOP - ACT_H) / Math.max(n - 1, 1));

function iconFor(label: string, i: number, map: Record<string, TablerIcon>, fallback: readonly TablerIcon[]): TablerIcon {
  return map[label.trim().toLowerCase()] ?? fallback[i % fallback.length] ?? IconFileText;
}

function cubicD([a, b, c, d]: Cubic): string {
  return `M ${a[0]} ${a[1]} C ${b[0]} ${b[1]}, ${c[0]} ${c[1]}, ${d[0]} ${d[1]}`;
}

function cubicAt([a, b, c, d]: Cubic, t: number): Pt {
  const u = 1 - t;
  const k0 = u * u * u;
  const k1 = 3 * u * u * t;
  const k2 = 3 * u * t * t;
  const k3 = t * t * t;
  return [a[0] * k0 + b[0] * k1 + c[0] * k2 + d[0] * k3, a[1] * k0 + b[1] * k1 + c[1] * k2 + d[1] * k3];
}

function arrow([x, y]: Pt, dir: "left" | "right" | "down", s = 6): string {
  if (dir === "left") return `${x},${y} ${x + 2 * s},${y - s} ${x + 2 * s},${y + s}`;
  if (dir === "right") return `${x},${y} ${x - 2 * s},${y - s} ${x - 2 * s},${y + s}`;
  return `${x},${y} ${x - s},${y - 2 * s} ${x + s},${y - 2 * s}`;
}

function routeFor(i: number, nAct: number): number[] {
  const r = nAct === 4 ? ROUTES[i] : undefined;
  if (r) return [r[0], r[1]];
  if (nAct < 2) return [0];
  const a = i % nAct;
  const b = (i + 2) % nAct;
  return [a, b === a ? (a + 1) % nAct : b];
}

function buildFlows(nSrc: number, nAct: number): Flow[] {
  if (nAct === 0) return [];
  const pairs: Array<{ src: number; act: number }> = [];
  for (let s = 0; s < nSrc; s++) for (const a of routeFor(s, nAct)) pairs.push({ src: s, act: a });
  return pairs.map(({ src, act }) => {
    const exits = pairs.filter((p) => p.src === src).map((p) => p.act).sort((x, y) => x - y);
    const exitOff = exits.length > 1 ? (exits.indexOf(act) === 0 ? -10 : 10) : 0;
    const incoming = pairs.filter((p) => p.act === act).map((p) => p.src).sort((x, y) => x - y);
    const slot = incoming.indexOf(src) - (incoming.length - 1) / 2;
    const sy = srcTop(src, nSrc) + SRC_H / 2 + exitOff;
    const ey = actTop(act, nAct) + ACT_H / 2 + slot * 24;
    const cx = MID_X + (((src + act) % 3) - 1) * 28;
    const curve: Cubic = [[SRC_R, sy], [cx, sy], [cx, ey], [ACT_X, ey]];
    return { src, act, curve };
  });
}

function buildArcs(nAct: number): Cubic[] {
  const arcs: Cubic[] = [];
  const cy = (i: number) => actTop(i, nAct) + ACT_H / 2;
  if (nAct >= 2) {
    const y0 = cy(nAct - 1) - 18;
    const y1 = cy(0) + 18;
    arcs.push([[ACT_R, y0], [ACT_R + 260, y0], [ACT_R + 260, y1], [ACT_R, y1]]);
  }
  if (nAct >= 4) {
    const y0 = cy(nAct - 2);
    const y1 = cy(1);
    arcs.push([[ACT_R, y0], [ACT_R + 140, y0], [ACT_R + 140, y1], [ACT_R, y1]]);
  }
  return arcs;
}

// Zero-length round-capped strokes render as dots that can ride an animateMotion path
function Dot({ color, size }: { color: string; size: number }) {
  return (
    <>
      <path d="M0 0h0.01" fill="none" stroke="var(--pv24-surface)" strokeWidth={size + 4} strokeLinecap="round" />
      <path d="M0 0h0.01" fill="none" stroke={color} strokeWidth={size} strokeLinecap="round" />
    </>
  );
}

function Mover({ d, color, size, dur, begin, travel }: { d: string; color: string; size: number; dur: number; begin: number; travel?: number }) {
  const t = { dur: `${dur.toFixed(2)}s`, begin: `${begin.toFixed(2)}s`, repeatCount: "indefinite" };
  if (travel === undefined) {
    return (
      <g opacity={0}>
        <Dot color={color} size={size} />
        <animateMotion {...t} path={d} />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.94;1" {...t} />
      </g>
    );
  }
  return (
    <g opacity={0}>
      <Dot color={color} size={size} />
      <animateMotion {...t} path={d} keyPoints="0;1;1" keyTimes={`0;${travel};1`} calcMode="linear" />
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes={`0;0.02;${(travel - 0.01).toFixed(3)};${(travel + 0.01).toFixed(3)};1`} {...t} />
    </g>
  );
}

function Frozen({ at, color, size }: { at: Pt; color: string; size: number }) {
  return (
    <g transform={`translate(${at[0].toFixed(1)} ${at[1].toFixed(1)})`}>
      <Dot color={color} size={size} />
    </g>
  );
}

const PULSES = [
  { grow: 20, peak: 0.7, keys: [0.34, 0.35, 0.6] },
  { grow: 30, peak: 0.35, keys: [0.36, 0.37, 0.75] },
] as const;

export function FragmentationSankeyExhibit({ data, exportMode = false }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;

  const { sources, activities, outcomeLabel } = data;
  const nSrc = sources.length;
  const nAct = activities.length;

  const flows = buildFlows(nSrc, nAct);
  const arcs = buildArcs(nAct);
  const trickleY = nAct > 0 ? actTop(nAct - 1, nAct) + ACT_H / 2 + 18 : DEC_CY;
  const trickle: Cubic = [[ACT_R, trickleY], [ACT_R + 220, trickleY], [ACT_R + 260, DEC_CY], [DEC_X, DEC_CY]];
  const trickleD = cubicD(trickle);

  const enter = (delay: number, from: { x?: number; y?: number; scale?: number } = {}) => ({
    initial: skip ? (false as const) : { opacity: 0, ...from },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    transition: skip ? undefined : { duration: 0.45, delay, ease: "easeOut" as const },
  });
  const fadeIn = (delay: number, duration = 0.4) => ({
    initial: skip ? (false as const) : { opacity: 0 },
    animate: { opacity: 1 },
    transition: skip ? undefined : { duration, delay },
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--pv24-canvas)",
        overflow: "hidden",
        fontFamily: "var(--pv24-font-family)",
        color: "var(--pv24-text)",
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden="true">
        {flows.map((f, p) => (
          <motion.path
            key={`flow-${p}`}
            d={cubicD(f.curve)}
            fill="none"
            stroke={tintOf(f.src)}
            strokeOpacity={0.5}
            strokeWidth={3}
            initial={skip ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={skip ? undefined : { duration: 0.55, delay: 1.0 + p * 0.004, ease: "easeInOut" }}
          />
        ))}

        {activities.slice(0, -1).map((_, i) => {
          const y0 = actTop(i, nAct) + ACT_H;
          const y1 = actTop(i + 1, nAct);
          return (
            <motion.g key={`step-${i}`} {...fadeIn(0.9 + i * 0.08, 0.3)}>
              <line x1={ACT_CX} y1={y0} x2={ACT_CX} y2={y1 - 10} stroke="var(--pv24-border-strong)" strokeWidth={2} />
              <polygon points={arrow([ACT_CX, y1], "down")} fill="var(--pv24-border-strong)" />
            </motion.g>
          );
        })}

        {arcs.map((c, i) => (
          <motion.g key={`arc-${i}`} {...fadeIn(1.2 + i * 0.12)}>
            <path d={cubicD(c)} fill="none" stroke="var(--pv24-text-secondary)" strokeWidth={2} strokeDasharray="7 6">
              {!skip && <animate attributeName="stroke-dashoffset" from="0" to="-26" dur="1.1s" begin="1.8s" repeatCount="indefinite" />}
            </path>
            <polygon points={arrow(c[3], "left")} fill="var(--pv24-text-secondary)" />
          </motion.g>
        ))}

        {nAct > 0 && (
          <>
            <motion.path
              d={trickleD}
              fill="none"
              stroke="var(--pv24-accent)"
              strokeWidth={2}
              initial={skip ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={skip ? undefined : { duration: 0.4, delay: 1.2, ease: "easeInOut" }}
            />
            <motion.polygon points={arrow([DEC_X, DEC_CY], "right")} fill="var(--pv24-accent)" {...fadeIn(1.5, 0.2)} />
          </>
        )}

        {skip ? (
          <g>
            {flows.map((f, p) => (
              <Frozen key={`fz-${p}`} at={cubicAt(f.curve, FROZEN_T[p % FROZEN_T.length] ?? 0.5)} color={tintOf(f.src)} size={11} />
            ))}
            {arcs.map((c, i) => (
              <Frozen key={`az-${i}`} at={cubicAt(c, 0.5)} color={tintOf(i + 2)} size={11} />
            ))}
            {arcs[0] && <Frozen at={cubicAt(arcs[0], 0.18)} color={tintOf(4)} size={11} />}
            {nAct > 0 && <Frozen at={cubicAt(trickle, 0.62)} color="var(--pv24-accent)" size={15} />}
          </g>
        ) : (
          <g>
            {flows.flatMap((f, p) => {
              const dur = 2.4 + (p % 4) * 0.35;
              const phase = ((p * 0.381) % 1) * (dur / 3);
              const d = cubicD(f.curve);
              return [0, 1, 2].map((k) => (
                <Mover key={`fm-${p}-${k}`} d={d} color={tintOf(f.src)} size={11} dur={dur} begin={PARTICLES_START + phase + (k * dur) / 3} />
              ));
            })}
            {arcs.flatMap((c, i) => {
              const count = i === 0 ? 3 : 2;
              const dur = i === 0 ? 3.6 : 2.2;
              const d = cubicD(c);
              return Array.from({ length: count }, (_, k) => (
                <Mover key={`am-${i}-${k}`} d={d} color={tintOf(i * 3 + k)} size={11} dur={dur} begin={2.3 + i * 0.4 + (k * dur) / count} />
              ));
            })}
            {nAct > 0 && (
              <Mover d={trickleD} color="var(--pv24-accent)" size={15} dur={TRICKLE_CYCLE} begin={TRICKLE_BEGIN} travel={TRICKLE_TRAVEL} />
            )}
            {PULSES.map((r, i) => {
              const t = {
                dur: `${TRICKLE_CYCLE}s`,
                begin: `${TRICKLE_BEGIN}s`,
                repeatCount: "indefinite",
                keyTimes: `0;${r.keys[0]};${r.keys[1]};${r.keys[2]};1`,
              };
              const v = (base: number, delta: number) => `${base};${base};${base};${base + delta};${base + delta}`;
              return (
                <rect key={`pulse-${i}`} x={DEC_X} y={DEC_Y} width={DEC_W} height={DEC_H} rx={16} fill="none" stroke="var(--pv24-accent)" strokeWidth={2} strokeOpacity={0}>
                  <animate attributeName="x" values={v(DEC_X, -r.grow)} {...t} />
                  <animate attributeName="y" values={v(DEC_Y, -r.grow)} {...t} />
                  <animate attributeName="width" values={v(DEC_W, 2 * r.grow)} {...t} />
                  <animate attributeName="height" values={v(DEC_H, 2 * r.grow)} {...t} />
                  <animate attributeName="rx" values={v(16, r.grow)} {...t} />
                  <animate attributeName="stroke-opacity" values={`0;0;${r.peak};0;0`} {...t} />
                </rect>
              );
            })}
          </g>
        )}
      </svg>

      {HEADERS.map((h, i) => (
        <motion.div key={`hdr-${i}`} {...enter(i * 0.12, { y: -6 })} style={{ position: "absolute", left: h.x, top: 10, width: h.w }}>
          <div
            style={{
              fontSize: 22,
              lineHeight: "28px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: h.accent ? "var(--pv24-accent-dark)" : "var(--pv24-text)",
            }}
          >
            {h.title}
          </div>
          <div style={{ marginTop: 2, fontSize: 17, lineHeight: "22px", color: "var(--pv24-text-secondary)" }}>{h.sub}</div>
        </motion.div>
      ))}

      {sources.map((label, i) => {
        const Icon = iconFor(label, i, SOURCE_ICONS, SOURCE_FALLBACK);
        const tint = tintOf(i);
        return (
          <motion.div
            key={`src-${i}`}
            {...enter(0.1 + i * 0.07, { x: -16 })}
            style={{
              position: "absolute",
              left: SRC_X,
              top: srcTop(i, nSrc),
              width: SRC_W,
              height: SRC_H,
              boxSizing: "border-box",
              background: "var(--pv24-surface)",
              border: "1px solid var(--pv24-border)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "0 18px 0 12px",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: 8,
                background: "var(--pv24-muted-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={24} stroke={1.8} color={tint} />
            </div>
            <span style={{ fontSize: 20, lineHeight: "24px", fontWeight: 600 }}>{label}</span>
            <span style={{ marginLeft: "auto", width: 10, height: 10, flexShrink: 0, borderRadius: 5, background: tint }} />
          </motion.div>
        );
      })}

      {activities.map((label, i) => {
        const Icon = iconFor(label, i, ACTIVITY_ICONS, ACTIVITY_FALLBACK);
        const segW = SEG_W[i % SEG_W.length] ?? 84;
        const travel = TRACK_W - segW;
        const rest = (SEG_REST[i % SEG_REST.length] ?? 0.5) * travel;
        return (
          <motion.div
            key={`act-${i}`}
            {...enter(0.35 + i * 0.1, { y: 10 })}
            style={{
              position: "absolute",
              left: ACT_X,
              top: actTop(i, nAct),
              width: ACT_W,
              height: ACT_H,
              boxSizing: "border-box",
              background: "var(--pv24-surface)",
              border: "1.5px solid var(--pv24-border-strong)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 18,
                top: 12,
                width: 48,
                height: 48,
                borderRadius: 10,
                background: "var(--pv24-muted-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={28} stroke={1.8} color="var(--pv24-text)" />
            </div>
            <div style={{ position: "absolute", left: 80, top: 12, height: 48, display: "flex", alignItems: "center", fontSize: 22, fontWeight: 700 }}>
              {label}
            </div>
            <div
              style={{
                position: "absolute",
                right: 18,
                top: 20,
                width: 32,
                height: 32,
                borderRadius: 16,
                background: "var(--pv24-muted-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconUser size={20} stroke={1.8} color="var(--pv24-text-secondary)" />
            </div>
            <div
              style={{
                position: "absolute",
                left: 18,
                top: 72,
                width: TRACK_W,
                height: 6,
                borderRadius: 3,
                background: "var(--pv24-border)",
                overflow: "hidden",
              }}
            >
              <motion.div
                initial={skip ? false : { x: 0 }}
                animate={skip ? { x: rest } : { x: [0, travel] }}
                transition={
                  skip
                    ? undefined
                    : { duration: 1.3 + (i % 4) * 0.3, delay: 1.0 + i * 0.12, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
                }
                style={{ position: "absolute", left: 0, top: 0, width: segW, height: 6, borderRadius: 3, background: "var(--pv24-text-secondary)" }}
              />
            </div>
          </motion.div>
        );
      })}

      {arcs.length > 0 && (
        <motion.div
          {...fadeIn(1.6)}
          style={{ position: "absolute", left: 1262, top: 178, height: 28, display: "flex", alignItems: "center", gap: 8, color: "var(--pv24-text-secondary)" }}
        >
          <IconRefresh size={22} stroke={1.8} />
          <span style={{ fontSize: 18, fontStyle: "italic" }}>Rework loops</span>
        </motion.div>
      )}

      {nAct > 0 && (
        <motion.div
          {...fadeIn(1.7)}
          style={{ position: "absolute", left: 1250, top: 540, fontSize: 18, lineHeight: "24px", fontStyle: "italic", color: "var(--pv24-accent-dark)" }}
        >
          Only a trickle gets through
        </motion.div>
      )}

      <motion.div
        {...enter(0.6, { scale: 0.94 })}
        style={{
          position: "absolute",
          left: DEC_X,
          top: DEC_Y,
          width: DEC_W,
          height: DEC_H,
          boxSizing: "border-box",
          background: "var(--pv24-surface)",
          border: "2px solid var(--pv24-accent)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 32px",
        }}
      >
        <motion.div
          initial={skip ? false : { boxShadow: "0 0 0 0px rgba(161, 0, 255, 0)" }}
          animate={
            skip
              ? { boxShadow: "0 0 0 0px rgba(161, 0, 255, 0)" }
              : { boxShadow: ["0 0 0 0px rgba(161, 0, 255, 0)", "0 0 0 12px rgba(161, 0, 255, 0.2)", "0 0 0 20px rgba(161, 0, 255, 0)"] }
          }
          transition={
            skip
              ? undefined
              : {
                  duration: 1.2,
                  delay: TRICKLE_BEGIN + TRICKLE_CYCLE * TRICKLE_TRAVEL,
                  repeat: Infinity,
                  repeatDelay: TRICKLE_CYCLE - 1.2,
                  ease: "easeOut",
                }
          }
          style={{
            width: 108,
            height: 108,
            borderRadius: 54,
            background: "var(--pv24-accent-lightest)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconUserCheck size={58} stroke={1.6} color="var(--pv24-accent-dark)" />
        </motion.div>
        <div style={{ marginTop: 22, fontSize: 32, lineHeight: "38px", fontWeight: 700, color: "var(--pv24-accent-dark)" }}>{outcomeLabel}</div>
        <div style={{ marginTop: 8, fontSize: 18, lineHeight: "24px", color: "var(--pv24-text-secondary)", textAlign: "center" }}>
          Reached late,
          <br />
          with little time left
        </div>
      </motion.div>

      <motion.div
        {...fadeIn(1.9)}
        style={{ position: "absolute", left: BAR_X, top: 636, width: BAR_W, height: 28, display: "flex", alignItems: "center", gap: 10 }}
      >
        <IconClock size={24} stroke={1.8} color="var(--pv24-text-secondary)" />
        <span style={{ fontSize: 20, fontWeight: 700 }}>Where the team&apos;s capacity goes</span>
        <span style={{ marginLeft: "auto", fontSize: 17, fontStyle: "italic", color: "var(--pv24-text-secondary)" }}>Illustrative</span>
      </motion.div>

      <motion.div
        initial={skip ? false : { clipPath: "inset(0px 100% 0px 0px)" }}
        animate={{ clipPath: "inset(0px 0% 0px 0px)" }}
        transition={skip ? undefined : { duration: 0.8, delay: 2.0, ease: "easeInOut" }}
        style={{
          position: "absolute",
          left: BAR_X,
          top: BAR_Y,
          width: BAR_W - JUDGMENT_W - 4,
          height: BAR_H,
          boxSizing: "border-box",
          background: "var(--pv24-border)",
          borderRadius: "10px 0 0 10px",
          display: "flex",
          alignItems: "center",
          paddingLeft: 24,
        }}
      >
        <span style={{ fontSize: 19, fontWeight: 600 }}>Finding, reconciling, coordinating, re-entering</span>
      </motion.div>

      <motion.div
        {...enter(2.8, { x: 16 })}
        style={{
          position: "absolute",
          left: BAR_X + BAR_W - JUDGMENT_W,
          top: BAR_Y,
          width: JUDGMENT_W,
          height: BAR_H,
          background: "var(--pv24-accent)",
          borderRadius: "0 10px 10px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 19, fontWeight: 700, color: "var(--pv24-surface)" }}>Judgment</span>
      </motion.div>
    </div>
  );
}
