"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Every exhibit is designed on a fixed 1920 x 780 stage that is scaled to the space
// left between the (variable height) header and the slide footer band.
export const SLIDE_W = 1920;
export const SLIDE_H = 1080;
export const STAGE_W = 1920;
export const STAGE_H = 780;
export const HEADER_GAP = 12;
export const AREA_BOTTOM = 112;

type SlideStageProps = {
  /** Changes when the header content changes, so the stage is measured again */
  measureKey: string;
  children: ReactNode;
};

export function SlideStage({ measureKey, children }: SlideStageProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState<number>(240);

  useLayoutEffect(() => {
    const header = areaRef.current?.parentElement?.querySelector<HTMLElement>(".pv24-slide-header");
    if (!header) return;
    const measure = () => setHeaderH(header.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [measureKey]);

  const areaTop = headerH + HEADER_GAP;
  const areaH = SLIDE_H - areaTop - AREA_BOTTOM;
  const scale = Math.min(1, areaH / STAGE_H);
  const offsetX = (SLIDE_W - STAGE_W * scale) / 2;
  const offsetY = Math.max(0, (areaH - STAGE_H * scale) / 2);

  return (
    <div
      ref={areaRef}
      className="pv24-exhibit-area"
      style={{ top: areaTop, bottom: AREA_BOTTOM, background: "var(--pv24-canvas)" }}
    >
      <div
        className="pv24-exhibit"
        style={{
          inset: "auto",
          left: offsetX,
          top: offsetY,
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
