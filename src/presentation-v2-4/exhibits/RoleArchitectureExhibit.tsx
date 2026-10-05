"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconScale, IconStack2, IconUsers, IconUsersPlus } from "@tabler/icons-react";
import type { RoleArchData } from "@/presentation-v2-4/data/types";
import { STAGE_W, STAGE_H } from "../components/SlideStage";
import { ProductCapture, measureProductCapture } from "../product-proof/ProductCapture";
import { getAssetV24, isAssetIdV24 } from "../product-proof/asset-registry";
import type { PresentationAssetIdV24 } from "../product-proof/types";

export interface RoleArchitectureExhibitProps {
  data: RoleArchData;
  exportMode?: boolean;
}

// ---------------------------------------------------------------------------
// Layout, in native 1920 x 780 stage pixels.
//
//   [ role text ]  [ Operational Risk Partner home, "now" crop ]
//                    | | | | | | |
//   [ Shared core   Decisions  Evidence ...  Audit ] - - [ +4 more roles ]
//                    | | | | | | |
//   [ role text ]  [ Third-Party Risk Manager home, "now" crop ]
//
// Capture heights come from the manifest through measureProductCapture, so a
// recapture that moves the crop by a few pixels only shifts the rows.
// ---------------------------------------------------------------------------
const MX = 16;
const ICON_X = MX + 28;
const TEXT_X = ICON_X + 44;
const COL_GAP = 40;
const CAP_W_MAX = 1080;
const CAP_W_MIN = 860;
const MIN_PAD = 20;
const BAND_H = 104;
const BAND_PAD = 12;
const LINK_H = 30;
const TILE_GAP = 8;
const MORE_W = 220;
const MORE_GAP = 20;
const CROP = "now";
const FALLBACK_RATIO = 0.27;

// Shared services that the capability map (appendix app-23) labels Partial today
const PARTIAL_SERVICES: ReadonlySet<string> = new Set(["Evidence", "Meetings"]);

const ACCENT = "var(--pv24-accent)";
const ACCENT_DARK = "var(--pv24-accent-dark)";
const ACCENT_LIGHT = "var(--pv24-brand-purple-light)";
const ACCENT_LIGHTEST = "var(--pv24-accent-lightest)";
const TEXT = "var(--pv24-text)";
const TEXT_2 = "var(--pv24-text-secondary)";
const BORDER_STRONG = "var(--pv24-border-strong)";
const FONT = "var(--pv24-font-family)";

type CaptureId = PresentationAssetIdV24 | null;

function captureHeight(id: CaptureId, width: number): number {
  const measured = id ? measureProductCapture({ assetId: id, width, crop: CROP, frame: "plain" }) : null;
  return measured ? measured.height : Math.round(width * FALLBACK_RATIO);
}

type Layout = { capW: number; capX: number; topH: number; bottomH: number; topY: number; bandY: number; bottomY: number };

function fitLayout(topId: CaptureId, bottomId: CaptureId): Layout {
  const fixed = BAND_H + 2 * LINK_H + 2 * MIN_PAD;
  let capW = CAP_W_MAX;
  while (capW > CAP_W_MIN && captureHeight(topId, capW) + captureHeight(bottomId, capW) + fixed > STAGE_H) capW -= 10;
  const topH = captureHeight(topId, capW);
  const bottomH = captureHeight(bottomId, capW);
  const topY = Math.max(0, (STAGE_H - (topH + bottomH + BAND_H + 2 * LINK_H)) / 2);
  const bandY = topY + topH + LINK_H;
  return { capW, capX: STAGE_W - MX - capW, topH, bottomH, topY, bandY, bottomY: bandY + BAND_H + LINK_H };
}

function asCaptureId(value: string): CaptureId {
  return isAssetIdV24(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Role row: role text on the left, the real Role Home capture on the right
// ---------------------------------------------------------------------------
type TablerIcon = React.ComponentType<{ size?: number | string; stroke?: number; style?: React.CSSProperties }>;

interface RoleRowProps {
  role: RoleArchData["leftRole"];
  captureId: CaptureId;
  Icon: TablerIcon;
  layout: Layout;
  y: number;
  height: number;
  /** Starting vertical offset, always towards the core band so nothing leaves the stage */
  fromY: number;
  delay: number;
  chipDelay: number;
  skip: boolean;
}

function RoleRow({ role, captureId, Icon, layout, y, height, fromY, delay, chipDelay, skip }: RoleRowProps) {
  const textW = layout.capX - COL_GAP - TEXT_X;
  const route = captureId ? getAssetV24(captureId).frameLabel : null;
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, y: fromY }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      style={{ position: "absolute", left: 0, top: y, width: STAGE_W, height }}
    >
      {/* Role identity */}
      <div style={{ position: "absolute", left: ICON_X, top: 2, width: 32, height: 32, color: ACCENT }}>
        <Icon size={32} stroke={1.75} style={{ display: "block" }} />
      </div>
      <div style={{ position: "absolute", left: TEXT_X, top: 0, width: textW }}>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, color: TEXT }}>{role.title}</div>
        <div style={{ marginTop: 6, fontSize: 20, lineHeight: 1.25, color: TEXT_2 }}>{role.subtitle}</div>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" style={{ width: 9, height: 9, background: ACCENT, flex: "none" }} />
          <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25, color: ACCENT_DARK }}>Runs today on synthetic data</span>
        </div>
        {route ? (
          <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.25, color: TEXT_2 }}>Product capture: {route}</div>
        ) : null}
      </div>

      {/* Role-specific method, anchored to the bottom of the row */}
      <div style={{ position: "absolute", left: TEXT_X, bottom: 0, width: textW }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          Role-specific method
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          {role.judgments.map((label, i) => (
            <motion.div
              key={label}
              initial={skip ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: chipDelay + i * 0.08 }}
              style={{
                padding: "9px 14px",
                background: ACCENT_LIGHTEST,
                borderLeft: `3px solid ${ACCENT}`,
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.2,
                color: ACCENT_DARK,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Real product capture */}
      <div style={{ position: "absolute", left: layout.capX, top: 0 }}>
        {captureId ? (
          <ProductCapture assetId={captureId} width={layout.capW} maxHeight={height} crop={CROP} frame="plain" />
        ) : (
          <div
            data-capture-missing="true"
            style={{
              width: layout.capW,
              height,
              boxSizing: "border-box",
              border: `1px dashed ${BORDER_STRONG}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              color: TEXT_2,
            }}
          >
            Product capture not available: {role.assetId}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main exhibit
// ---------------------------------------------------------------------------
export function RoleArchitectureExhibit({ data, exportMode = false }: RoleArchitectureExhibitProps) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || !!prefersReduced;
  const d = (t: number) => (skip ? 0 : t);

  const topId = asCaptureId(data.leftRole.assetId);
  const bottomId = asCaptureId(data.rightRole.assetId);
  const layout = React.useMemo(() => fitLayout(topId, bottomId), [topId, bottomId]);

  const services = data.sharedCore;
  const bandRight = STAGE_W - MX - MORE_W - MORE_GAP;
  const tilesX = layout.capX;
  const tileW = (bandRight - BAND_PAD - tilesX - (services.length - 1) * TILE_GAP) / Math.max(1, services.length);
  const tileCx = services.map((_, i) => tilesX + i * (tileW + TILE_GAP) + tileW / 2);
  const bandBottom = layout.bandY + BAND_H;
  const moreX = STAGE_W - MX - MORE_W;

  return (
    <div
      style={{ position: "absolute", inset: 0, background: "var(--pv24-canvas)", fontFamily: FONT, overflow: "hidden" }}
      role="group"
      aria-label="Role architecture: one shared core serves the Operational Risk Partner and Third-Party Risk Manager homes"
    >
      {/* Connectors: every shared service reaches both role homes */}
      <svg
        width={STAGE_W}
        height={STAGE_H}
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        aria-hidden="true"
      >
        {tileCx.map((x, i) => (
          <React.Fragment key={i}>
            <motion.line
              x1={x}
              y1={layout.bandY}
              x2={x}
              y2={layout.bandY - LINK_H}
              stroke={ACCENT}
              strokeWidth={2}
              strokeOpacity={0.55}
              initial={skip ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: d(0.6 + i * 0.03) }}
            />
            <motion.line
              x1={x}
              y1={bandBottom}
              x2={x}
              y2={bandBottom + LINK_H}
              stroke={ACCENT}
              strokeWidth={2}
              strokeOpacity={0.55}
              initial={skip ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: d(0.6 + i * 0.03) }}
            />
          </React.Fragment>
        ))}
        <motion.line
          x1={bandRight}
          y1={layout.bandY + BAND_H / 2}
          x2={moreX}
          y2={layout.bandY + BAND_H / 2}
          stroke={BORDER_STRONG}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          initial={skip ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: d(1.95) }}
        />
      </svg>

      {/* Shared core band */}
      <motion.div
        initial={skip ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0 }}
        style={{
          position: "absolute",
          left: MX,
          top: layout.bandY,
          width: bandRight - MX,
          height: BAND_H,
          boxSizing: "border-box",
          background: ACCENT_LIGHTEST,
          border: `1.5px solid ${ACCENT}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: ICON_X - MX,
            top: 0,
            width: tilesX - COL_GAP - ICON_X,
            height: BAND_H - 3,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <IconStack2 size={32} stroke={1.75} style={{ color: ACCENT, flex: "none" }} />
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: ACCENT_DARK }}>Shared core</div>
            <div style={{ marginTop: 4, fontSize: 18, lineHeight: 1.25, color: TEXT_2 }}>The same services in both role homes</div>
          </div>
        </div>
      </motion.div>

      {/* Shared services, aligned under the captures */}
      {services.map((label, i) => {
        const partial = PARTIAL_SERVICES.has(label);
        return (
          <motion.div
            key={label}
            initial={skip ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: d(0.15 + i * 0.05) }}
            style={{
              position: "absolute",
              left: tilesX + i * (tileW + TILE_GAP),
              top: layout.bandY + BAND_PAD,
              width: tileW,
              height: BAND_H - 2 * BAND_PAD,
              boxSizing: "border-box",
              background: "var(--pv24-surface)",
              border: `1px solid ${ACCENT_LIGHT}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 600, lineHeight: "22px", color: TEXT, whiteSpace: "nowrap" }}>{label}</span>
            {partial ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 6,
                  textAlign: "center",
                  fontSize: 14,
                  lineHeight: "17px",
                  color: TEXT_2,
                }}
              >
                Partial
              </span>
            ) : null}
          </motion.div>
        );
      })}

      {/* Four further roles exist only as a demo or planned page */}
      <motion.div
        initial={skip ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: d(1.95) }}
        style={{
          position: "absolute",
          left: moreX,
          top: layout.bandY,
          width: MORE_W,
          height: BAND_H,
          boxSizing: "border-box",
          border: `1.5px dashed ${BORDER_STRONG}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          padding: "0 10px",
          textAlign: "center",
        }}
      >
        <IconUsersPlus size={22} stroke={1.75} style={{ color: TEXT_2, marginBottom: 2 }} />
        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: TEXT }}>+4 more roles</span>
        <span style={{ fontSize: 15, lineHeight: 1.2, color: TEXT_2, whiteSpace: "nowrap" }}>Demo or planned page only</span>
      </motion.div>

      <RoleRow
        role={data.leftRole}
        captureId={topId}
        Icon={IconScale}
        layout={layout}
        y={layout.topY}
        height={layout.topH}
        fromY={14}
        delay={d(0.85)}
        chipDelay={d(1.4)}
        skip={skip}
      />
      <RoleRow
        role={data.rightRole}
        captureId={bottomId}
        Icon={IconUsers}
        layout={layout}
        y={layout.bottomY}
        height={layout.bottomH}
        fromY={-14}
        delay={d(1.0)}
        chipDelay={d(1.55)}
        skip={skip}
      />
    </div>
  );
}
