"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CoreSlide24, CoreExhibit } from "../data/types";
import SlideHeader from "./SlideHeader";
import SlideSource from "./SlideSource";
import { CapacityConvergenceExhibit } from "../exhibits/CapacityConvergenceExhibit";
import { StoryPathExhibit } from "../exhibits/StoryPathExhibit";
import { FragmentationSankeyExhibit } from "../exhibits/FragmentationSankeyExhibit";
import { FrictionCausalChainExhibit } from "../exhibits/FrictionCausalChainExhibit";
import { EngagementLayerExhibit } from "../exhibits/EngagementLayerExhibit";
import { WorkdayProductExhibit } from "../exhibits/WorkdayProductExhibit";
import { RoleArchitectureExhibit } from "../exhibits/RoleArchitectureExhibit";
import { RoleAppSwimlaneExhibit } from "../exhibits/RoleAppSwimlaneExhibit";
import { AuthorityMatrixExhibit } from "../exhibits/AuthorityMatrixExhibit";
import { ValueTreeExhibit } from "../exhibits/ValueTreeExhibit";
import { EvidenceThreadExhibit } from "../exhibits/EvidenceThreadExhibit";
import { ServiceFactoryExhibit } from "../exhibits/ServiceFactoryExhibit";
import { DesignPartnerPathExhibit } from "../exhibits/DesignPartnerPathExhibit";

interface CoreSlide24DispatcherProps {
  slide: CoreSlide24;
  exportMode?: boolean;
  slideIndex: number;
  totalSlides: number;
  onGoToAppendix: (appendixId: string, fromCoreIndex: number) => void;
}

// Every exhibit is designed on a fixed 1920 x 780 stage that is scaled to the space
// left between the (variable height) header and the ref bar.
const SLIDE_W = 1920;
const SLIDE_H = 1080;
const STAGE_W = 1920;
const STAGE_H = 780;
const HEADER_GAP = 12;
const AREA_BOTTOM = 112;

// Exhibits drawn in 1920 x 1080 coordinates (SVG viewBox plus percentage overlays) need a
// 16:9 box so both layers share one coordinate space. The [top, bottom] crop window, in
// 1080 coordinates, is the band that holds content; it is fitted to the stage height.
const RATIO_169_CROP: Partial<Record<CoreExhibit["type"], readonly [number, number]>> = {
  "capacity-convergence": [160, 920],
  "story-path": [60, 940],
  "fragmentation-sankey": [96, 1056],
  "friction-causal-chain": [56, 800],
  "engagement-layer": [96, 940],
  "role-architecture": [236, 1006],
};

function ratioBoxStyle([cropTop, cropBottom]: readonly [number, number]): React.CSSProperties {
  const s = Math.min(1, STAGE_H / (cropBottom - cropTop));
  return {
    position: "absolute",
    width: SLIDE_W * s,
    height: SLIDE_H * s,
    left: (STAGE_W - SLIDE_W * s) / 2,
    top: (STAGE_H - (cropBottom - cropTop) * s) / 2 - cropTop * s,
  };
}

function renderExhibit(exhibit: CoreExhibit, exportMode: boolean): React.ReactNode {
  switch (exhibit.type) {
    case "capacity-convergence":
      return <CapacityConvergenceExhibit data={exhibit.data} exportMode={exportMode} />;
    case "story-path":
      return <StoryPathExhibit data={exhibit.data} exportMode={exportMode} />;
    case "fragmentation-sankey":
      return <FragmentationSankeyExhibit data={exhibit.data} exportMode={exportMode} />;
    case "friction-causal-chain":
      return <FrictionCausalChainExhibit data={exhibit.data} exportMode={exportMode} />;
    case "engagement-layer":
      return <EngagementLayerExhibit data={exhibit.data} exportMode={exportMode} />;
    case "workday-product":
      return <WorkdayProductExhibit data={exhibit.data} exportMode={exportMode} />;
    case "role-architecture":
      return <RoleArchitectureExhibit data={exhibit.data} exportMode={exportMode} />;
    case "role-app-swimlane":
      return <RoleAppSwimlaneExhibit data={exhibit.data} exportMode={exportMode} />;
    case "authority-matrix":
      return <AuthorityMatrixExhibit data={exhibit.data} exportMode={exportMode} />;
    case "value-tree":
      return <ValueTreeExhibit data={exhibit.data} exportMode={exportMode} />;
    case "evidence-thread":
      return <EvidenceThreadExhibit data={exhibit.data} exportMode={exportMode} />;
    case "service-factory":
      return <ServiceFactoryExhibit data={exhibit.data} exportMode={exportMode} />;
    case "design-partner-path":
      return <DesignPartnerPathExhibit data={exhibit.data} exportMode={exportMode} />;
    default: {
      const _: never = exhibit;
      return null;
    }
  }
}

export default function CoreSlide24Dispatcher({
  slide,
  exportMode = false,
  slideIndex,
  totalSlides,
  onGoToAppendix,
}: CoreSlide24DispatcherProps) {
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
  }, [slide.id]);

  const areaTop = headerH + HEADER_GAP;
  const areaH = SLIDE_H - areaTop - AREA_BOTTOM;
  const scale = Math.min(1, areaH / STAGE_H);
  const offsetX = (SLIDE_W - STAGE_W * scale) / 2;
  const offsetY = Math.max(0, (areaH - STAGE_H * scale) / 2);
  const exhibit = renderExhibit(slide.exhibit, exportMode);
  const crop = RATIO_169_CROP[slide.exhibit.type];

  return (
    <>
      <SlideHeader
        section={slide.section}
        title={slide.title}
        subtitle={slide.subtitle}
        exportMode={exportMode}
      />
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
          {crop !== undefined ? <div style={ratioBoxStyle(crop)}>{exhibit}</div> : exhibit}
        </div>
      </div>
      <SlideSource
        evidenceBasis={slide.evidenceBasis}
        appendixRefs={slide.appendixRefs}
        coreIndex={slideIndex - 1}
        onGoToAppendix={onGoToAppendix}
      />
      <div className="pv24-slide-number">
        {slideIndex}
        {" / "}
        {totalSlides}
      </div>
    </>
  );
}
