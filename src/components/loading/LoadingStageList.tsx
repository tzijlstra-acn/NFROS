"use client";

/**
 * LoadingStageList: data-source loading stages with optional source detail.
 *
 * Wraps the StageList primitive from primitives.tsx with the six data-source
 * stages named in the brief. The stage list itself stays concise by default:
 * the expandable detail shows connected system attributions and is hidden
 * until the presenter or user opens it.
 *
 * The Disclosure from interactive.tsx is the only interactive element here.
 * Source rows use the existing SourceRow primitive, which already handles
 * freshness and conflict colouring. This component does not duplicate any of
 * that logic.
 */

import { StageList, SourceRow } from "@/components/workday-v2/primitives";
import { Disclosure } from "@/components/workday-v2/interactive";
import {
  DATA_SOURCE_STAGE_LABELS,
  STAGE_LIST_LABELS,
  pickLabel,
} from "@/components/loading/labels";
import type { SourceAttribution } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export function LoadingStageList({
  activeIndex,
  sources = [],
  language = "en",
}: {
  /**
   * The index of the currently active stage in DATA_SOURCE_STAGE_LABELS
   * (0-indexed). A value of -1 means no stage is active yet.
   * A value equal to the array length means all stages are complete.
   */
  activeIndex: number;
  /**
   * Source attributions to show in the expandable detail section.
   * When empty, the disclosure control is omitted entirely.
   */
  sources?: SourceAttribution[];
  language?: Language;
}) {
  const stageLabels = DATA_SOURCE_STAGE_LABELS.map((pair) =>
    pickLabel(pair, language),
  );

  return (
    <div className="app-stack-3">
      <StageList
        stages={stageLabels}
        activeIndex={activeIndex}
        label={pickLabel(STAGE_LIST_LABELS.loadingStages, language)}
      />
      {sources.length > 0 ? (
        <Disclosure
          label={pickLabel(STAGE_LIST_LABELS.showSources, language)}
          count={sources.length}
        >
          <SourceRow sources={sources} language={language} showNecessity />
        </Disclosure>
      ) : null}
    </div>
  );
}
