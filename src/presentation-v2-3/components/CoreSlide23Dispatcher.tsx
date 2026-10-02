"use client";

import type { CoreSlide23 } from "../data/types";
import { HeroSignalSlide } from "./slides/HeroSignalSlide";
import { AgendaMapSlide } from "./slides/AgendaMapSlide";
import { FragmentationFlowSlide } from "./slides/FragmentationFlowSlide";
import { OperatingSystemSpineSlide } from "./slides/OperatingSystemSpineSlide";
import { RoleOSFocusSlide } from "./slides/RoleOSFocusSlide";
import { RoleMirrorSlide } from "./slides/RoleMirrorSlide";
import { ProcessRailSlide } from "./slides/ProcessRailSlide";
import { AuthorityBoundarySlide } from "./slides/AuthorityBoundarySlide";
import { OutcomeShiftSlide } from "./slides/OutcomeShiftSlide";
import { EvidenceControlSlide } from "./slides/EvidenceControlSlide";
import { ServiceShelfSlide } from "./slides/ServiceShelfSlide";
import { RolloutPathSlide } from "./slides/RolloutPathSlide";
import { DesignPartnerCanvasSlide } from "./slides/DesignPartnerCanvasSlide";

type Props = {
  slide: CoreSlide23;
  exportMode?: boolean;
  focusStep?: number;
};

export function CoreSlide23Dispatcher({ slide, exportMode, focusStep }: Props) {
  switch (slide.visualType) {
    case "hero-signal":
      return <HeroSignalSlide slide={slide} exportMode={exportMode} />;
    case "agenda-map":
      return <AgendaMapSlide slide={slide} exportMode={exportMode} />;
    case "fragmentation-flow":
      return <FragmentationFlowSlide slide={slide} exportMode={exportMode} />;
    case "operating-system-spine":
      return <OperatingSystemSpineSlide slide={slide} exportMode={exportMode} />;
    case "role-os-focus":
      return <RoleOSFocusSlide slide={slide} exportMode={exportMode} focusStep={focusStep} />;
    case "role-mirror":
      return <RoleMirrorSlide slide={slide} exportMode={exportMode} />;
    case "process-rail":
      return <ProcessRailSlide slide={slide} exportMode={exportMode} />;
    case "authority-boundary":
      return <AuthorityBoundarySlide slide={slide} exportMode={exportMode} />;
    case "outcome-shift":
      return <OutcomeShiftSlide slide={slide} exportMode={exportMode} />;
    case "evidence-thread":
      return <EvidenceControlSlide slide={slide} exportMode={exportMode} />;
    case "service-shelf":
      return <ServiceShelfSlide slide={slide} exportMode={exportMode} />;
    case "rollout-path":
      return <RolloutPathSlide slide={slide} exportMode={exportMode} />;
    case "design-partner-canvas":
      return <DesignPartnerCanvasSlide slide={slide} exportMode={exportMode} />;
    default: {
      // TypeScript will flag this if a new visualType is added without a renderer
      const exhaustive: never = slide.visualType;
      throw new Error(`No renderer for visualType: ${String(exhaustive)}`);
    }
  }
}
