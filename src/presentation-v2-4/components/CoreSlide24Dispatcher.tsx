"use client";

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
  return (
    <>
      <SlideHeader
        section={slide.section}
        title={slide.title}
        subtitle={slide.subtitle}
        exportMode={exportMode}
      />
      <div className="pv24-exhibit-area">
        <div className="pv24-exhibit">{renderExhibit(slide.exhibit, exportMode)}</div>
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
