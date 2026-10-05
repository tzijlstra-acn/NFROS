"use client";

import type { CoreSlide24, CoreExhibit } from "../data/types";
import SlideHeader from "./SlideHeader";
import SlideSource from "./SlideSource";
import { SlideFooter } from "./SlideFooter";
import { SlideStage, SLIDE_W, SLIDE_H, STAGE_W, STAGE_H } from "./SlideStage";
import { SlideDownloadButton } from "./DownloadMenu24";
import { CORE_COUNT, coreNumberOf } from "./deckModel";
import { CoverExhibit } from "../exhibits/CoverExhibit";
import { ClosingExhibit } from "../exhibits/ClosingExhibit";
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
  /** Play position, 1 to 14 */
  position: number;
  /** Hides presenter chrome such as the download button */
  exportMode?: boolean;
  /** Renders every exhibit in its final state (export, safe mode, or entered while paused) */
  staticMotion?: boolean;
}

// Exhibits drawn in 1920 x 1080 coordinates (SVG viewBox plus percentage overlays) need a
// 16:9 box so both layers share one coordinate space. The [top, bottom] crop window, in
// 1080 coordinates, is the band that holds content; it is fitted to the stage height.
const RATIO_169_CROP: Partial<Record<CoreExhibit["type"], readonly [number, number]>> = {
  "friction-causal-chain": [56, 800],
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

function renderExhibit(slide: CoreSlide24, staticMotion: boolean): React.ReactNode {
  const exhibit = slide.exhibit;
  const exportMode = staticMotion;
  switch (exhibit.type) {
    case "cover":
      return <CoverExhibit data={exhibit.data} title={slide.title} subtitle={slide.subtitle} insight={slide.insight} exportMode={exportMode} />;
    case "closing":
      return <ClosingExhibit data={exhibit.data} title={slide.title} subtitle={slide.subtitle} exportMode={exportMode} />;
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
  position,
  exportMode = false,
  staticMotion = false,
}: CoreSlide24DispatcherProps) {
  const exhibit = renderExhibit(slide, staticMotion || exportMode);

  if (slide.kind === "cover" || slide.kind === "closing") {
    return <div style={{ position: "absolute", inset: 0 }}>{exhibit}</div>;
  }

  const crop = RATIO_169_CROP[slide.exhibit.type];
  const coreNumber = coreNumberOf(position);
  const showDownload = !exportMode && (slide.kind === "agenda" || coreNumber === CORE_COUNT);
  const firstEvidence = slide.evidenceBasis[0];

  return (
    <>
      <SlideHeader
        section={slide.section}
        title={slide.title}
        subtitle={slide.subtitle}
        exportMode={staticMotion || exportMode}
      />
      {showDownload ? <SlideDownloadButton /> : null}
      <SlideStage measureKey={slide.id}>
        {crop !== undefined ? <div style={ratioBoxStyle(crop)}>{exhibit}</div> : exhibit}
      </SlideStage>
      <SlideFooter
        links={slide.appendixRefs.length > 0 ? <SlideSource appendixRefs={slide.appendixRefs} fromPosition={position} /> : undefined}
        sourceNote={firstEvidence?.label}
        insight={slide.insight}
        counter={coreNumber !== null ? `${coreNumber} / ${CORE_COUNT}` : undefined}
        counterLabel={coreNumber !== null ? `Slide ${coreNumber} of ${CORE_COUNT}` : undefined}
      />
    </>
  );
}
