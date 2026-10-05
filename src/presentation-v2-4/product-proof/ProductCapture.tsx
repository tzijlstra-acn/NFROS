import type { CSSProperties } from "react";
import { assetSrcV24, getAssetV24 } from "./asset-registry";
import { getCaptureV24, notCapturedReasonV24 } from "./manifest";
import type { CapturedAssetV24, PresentationAssetIdV24, SubRegionBoxV24 } from "./types";

export type ProductCaptureFocus = { region: string; label: string };

export type ProductCaptureProps = {
  assetId: PresentationAssetIdV24;
  /** Outer width of the frame on the slide stage, in px. */
  width: number;
  /** Cap on the outer height in px. The capture is clipped from the bottom. */
  maxHeight?: number;
  /** Sub-region name from the manifest to crop to. */
  crop?: string;
  frame?: "browser" | "plain";
  focus?: ProductCaptureFocus[];
  /** Title bar label. Defaults to the registry frameLabel. */
  label?: string;
};

const BORDER = 1;
const TITLE_H = 28;
const CHIP_H = 22;
const FOCUS_OFFSET = 4;
const ACCENT = "var(--pv24-accent, #A100FF)";
const LINE = "var(--pv24-border, #D8DAE0)";
const FONT = "var(--pv24-font-family, Arial, sans-serif)";

type Layout = {
  capture: CapturedAssetV24;
  view: SubRegionBoxV24;
  scale: number;
  innerWidth: number;
  imageHeight: number;
  titleHeight: number;
  outerHeight: number;
};

function layoutFor(
  props: Pick<ProductCaptureProps, "assetId" | "width" | "maxHeight" | "crop" | "frame">,
): Layout | null {
  const capture = getCaptureV24(props.assetId);
  if (!capture) return null;
  const base: SubRegionBoxV24 | undefined = props.crop
    ? capture.subRegions[props.crop]
    : { x: 0, y: 0, width: capture.width, height: capture.height };
  if (!base) return null;
  const pad = (getAssetV24(props.assetId).framePadding ?? 0) * capture.deviceScaleFactor;
  const view = { x: base.x - pad, y: base.y - pad, width: base.width + 2 * pad, height: base.height + 2 * pad };
  const innerWidth = Math.max(0, props.width - 2 * BORDER);
  const scale = innerWidth / view.width;
  const titleHeight = (props.frame ?? "browser") === "browser" ? TITLE_H : 0;
  const natural = view.height * scale;
  const cap = props.maxHeight !== undefined ? Math.max(0, props.maxHeight - 2 * BORDER - titleHeight) : natural;
  const imageHeight = Math.min(natural, cap);
  return {
    capture,
    view,
    scale,
    innerWidth,
    imageHeight,
    titleHeight,
    outerHeight: imageHeight + titleHeight + 2 * BORDER,
  };
}

/** Outer size the component will occupy, for exhibit layout. */
export function measureProductCapture(
  props: Pick<ProductCaptureProps, "assetId" | "width" | "maxHeight" | "crop" | "frame">,
): { width: number; height: number } | null {
  const layout = layoutFor(props);
  return layout ? { width: props.width, height: layout.outerHeight } : null;
}

function TitleBar({ label }: { label: string }) {
  const dot: CSSProperties = { width: 7, height: 7, background: "#C9CCD4", flexShrink: 0 };
  return (
    <div
      style={{
        height: TITLE_H,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 10px",
        background: "var(--pv24-muted-bg, #F0F1F4)",
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <span aria-hidden="true" style={dot} />
      <span aria-hidden="true" style={dot} />
      <span aria-hidden="true" style={dot} />
      <span
        style={{
          marginLeft: 8,
          fontFamily: FONT,
          fontSize: 13,
          lineHeight: "16px",
          color: "var(--pv24-text-secondary, #5A5E6B)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Missing({ assetId, width, maxHeight, reason }: { assetId: string; width: number; maxHeight?: number; reason: string }) {
  return (
    <figure
      data-product-capture={assetId}
      data-capture-missing="true"
      style={{
        margin: 0,
        width,
        height: maxHeight ?? Math.round((width * 9) / 16),
        boxSizing: "border-box",
        border: `1px dashed ${LINE}`,
        background: "var(--pv24-canvas, #F5F6F8)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
        padding: 16,
        fontFamily: FONT,
        color: "var(--pv24-text-secondary, #5A5E6B)",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600 }}>Product capture not available: {assetId}</span>
      <span style={{ fontSize: 12, lineHeight: 1.4 }}>{reason}</span>
    </figure>
  );
}

export function ProductCapture({
  assetId,
  width,
  maxHeight,
  crop,
  frame = "browser",
  focus = [],
  label,
}: ProductCaptureProps) {
  const asset = getAssetV24(assetId);
  const layout = layoutFor({ assetId, width, maxHeight, crop, frame });
  if (!layout) {
    const reason = crop && getCaptureV24(assetId)
      ? `Unknown crop sub-region "${crop}".`
      : (asset.blockedReason ?? notCapturedReasonV24(assetId) ?? "Not captured.");
    return <Missing assetId={assetId} width={width} maxHeight={maxHeight} reason={reason} />;
  }

  const { capture, view, scale, innerWidth, imageHeight } = layout;
  const missingFocus = focus.filter((item) => !capture.subRegions[item.region]).map((item) => item.region);

  return (
    <figure
      data-product-capture={assetId}
      data-capture-crop={crop}
      data-focus-missing={missingFocus.length > 0 ? missingFocus.join(" ") : undefined}
      style={{
        margin: 0,
        width,
        boxSizing: "border-box",
        border: `${BORDER}px solid ${LINE}`,
        borderRadius: 0,
        background: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      {frame === "browser" ? <TitleBar label={label ?? asset.frameLabel} /> : null}
      <div
        style={{
          position: "relative",
          width: innerWidth,
          height: imageHeight,
          overflow: "hidden",
          background: capture.background,
        }}
      >
        <img
          src={assetSrcV24(assetId)}
          alt={asset.altText}
          width={capture.width}
          height={capture.height}
          draggable={false}
          decoding="async"
          style={{
            position: "absolute",
            left: -view.x * scale,
            top: -view.y * scale,
            width: capture.width * scale,
            height: capture.height * scale,
            maxWidth: "none",
            display: "block",
          }}
        />
        {focus.map((item) => {
          const box = capture.subRegions[item.region];
          if (!box) return null;
          const left = (box.x - view.x) * scale - FOCUS_OFFSET;
          const top = (box.y - view.y) * scale - FOCUS_OFFSET;
          const chipAbove = top >= CHIP_H;
          return (
            <div
              key={`${item.region}-${item.label}`}
              data-focus-region={item.region}
              style={{
                position: "absolute",
                left,
                top,
                width: box.width * scale + 2 * FOCUS_OFFSET,
                height: box.height * scale + 2 * FOCUS_OFFSET,
                boxSizing: "border-box",
                border: `2px solid ${ACCENT}`,
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: -2,
                  top: chipAbove ? -CHIP_H : 0,
                  height: CHIP_H,
                  boxSizing: "border-box",
                  padding: "0 8px",
                  background: ACCENT,
                  color: "#FFFFFF",
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: `${CHIP_H}px`,
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
