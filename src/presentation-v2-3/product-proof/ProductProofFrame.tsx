"use client";

import { getAsset, getAssetPath, type PresentationAssetId } from "./asset-registry";

type CropRegion = { x: number; y: number; w: number; h: number };
type FocusRegion = { label: string; x: number; y: number; w: number; h: number };

type Props = {
  id: PresentationAssetId;
  alt?: string;
  crop?: CropRegion;
  focusRegion?: FocusRegion;
  exportMode?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function ProductProofFrame({ id, alt, crop, focusRegion, exportMode: _exportMode, className, style }: Props) {
  const asset = getAsset(id);
  const src = getAssetPath(id);
  const altText = alt ?? asset.altText;

  const containerStyle: React.CSSProperties = {
    position: "relative",
    aspectRatio: `${asset.width} / ${asset.height}`,
    overflow: "hidden",
    border: "1px solid var(--pv23-border, #E4E7EC)",
    background: "var(--pv23-canvas, #F5F6F8)",
    ...style,
  };

  return (
    <div className={className} style={containerStyle} data-asset-id={id}>
      <img
        src={src}
        alt={altText}
        style={{
          width: "100%",
          height: "100%",
          objectFit: crop ? "none" : "cover",
          objectPosition: crop ? `${-crop.x}px ${-crop.y}px` : "center",
          display: "block",
        }}
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = "none";
          const parent = img.parentElement;
          if (parent && !parent.querySelector(".pv23-asset-fallback")) {
            const fb = document.createElement("div");
            fb.className = "pv23-asset-fallback";
            fb.style.cssText = `
              position:absolute;inset:0;display:flex;flex-direction:column;
              align-items:center;justify-content:center;gap:8px;
              background:#F5F6F8;color:#475467;font-family:Arial,sans-serif;font-size:13px;
            `;
            fb.innerHTML = `
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#A100FF;font-weight:700">
                Development only
              </div>
              <div style="font-size:14px;color:#172033">${asset.description}</div>
              <div style="font-size:11px;color:#475467">Run: npm run presentation:refresh-assets</div>
            `;
            parent.appendChild(fb);
          }
        }}
      />
      {focusRegion && (
        <div
          style={{
            position: "absolute",
            left: `${(focusRegion.x / asset.width) * 100}%`,
            top: `${(focusRegion.y / asset.height) * 100}%`,
            width: `${(focusRegion.w / asset.width) * 100}%`,
            height: `${(focusRegion.h / asset.height) * 100}%`,
            border: "2px solid var(--pv23-brand-purple, #A100FF)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
          aria-label={focusRegion.label}
        >
          <span
            style={{
              position: "absolute",
              bottom: "-24px",
              left: 0,
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--pv23-brand-purple, #A100FF)",
              whiteSpace: "nowrap",
            }}
          >
            {focusRegion.label}
          </span>
        </div>
      )}
    </div>
  );
}
