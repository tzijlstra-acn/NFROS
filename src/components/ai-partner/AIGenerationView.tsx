"use client";

/**
 * The generation view.
 *
 * Shown in the place a suggestion will occupy, before there is a suggestion.
 * The stages are the real observable steps from `AI_STAGE_ORDER` with the
 * labels from `AI_STAGE_LABELS`: checking context, loading evidence,
 * comparing records, analysing, drafting, validating. They describe what the
 * application is doing to data. None of them pretends to narrate reasoning,
 * which is the line the brief draws and the one an AI progress display
 * usually crosses.
 *
 * The failure path is the important part. On error the card says "Suggestion
 * unavailable" in plain words, keeps any evidence that was already loaded on
 * screen, and offers a retry when the server said the failure was retryable.
 * The thing it never does is leave a spinner running forever, and the thing
 * it never does is reveal a suggestion that did not finish validation: the
 * caller gates that with `canRevealSuggestion`, and this view is what the
 * user sees until it passes.
 */

import { IconRefresh } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import {
  AI_STAGE_LABELS,
  AI_STAGE_ORDER,
  pick,
  type AIGenerationState,
  type SourceAttribution,
} from "@/workday/contracts";
import { Card, Notice, SectionHead, SourceRow, StageList } from "@/components/workday-v2/primitives";
import { partnerLabel } from "./labels";

/**
 * Progress as the suggestion route and the event channel both report it.
 *
 * `completedStages` is carried separately from `state` because a reconnecting
 * client may learn the current stage without having seen the ones before it,
 * and the stage list has to be able to draw those as done rather than
 * pending.
 */
export interface AIGenerationProgress {
  state: AIGenerationState;
  completedStages?: AIGenerationState[];
  /** The server supplied stage label, preferred over the local one. */
  label?: string;
  /** The suggestion this run will produce, when the server has named it. */
  suggestionId?: string | null;
  /** Why it failed, in the words the server used. */
  error?: string | null;
  retryable?: boolean;
}

export const IDLE_GENERATION: AIGenerationProgress = { state: "idle", completedStages: [] };

/**
 * Where the stage list should put its marker.
 *
 * A state outside the ordered pipeline, `idle`, `blocked` or `error`, has no
 * position of its own, so the count of completed stages is used and clamped.
 * Without the clamp a blocked run reports an index past the end of the list
 * and every stage draws as pending, which looks like nothing has happened.
 */
export function generationStageIndex(generation: AIGenerationProgress): number {
  const direct = AI_STAGE_ORDER.indexOf(generation.state);
  if (direct >= 0) return direct;
  const completed = generation.completedStages?.length ?? 0;
  return Math.min(Math.max(completed, 0), AI_STAGE_ORDER.length - 1);
}

export interface AIGenerationViewProps {
  generation: AIGenerationProgress;
  language: Language;
  /** Sources loaded so far. Deliberately kept on screen through a failure. */
  sources?: SourceAttribution[];
  onRetry?: () => void;
  /** True while the run is genuinely in flight. Drives the only motion here. */
  running?: boolean;
}

export function AIGenerationView({
  generation,
  language,
  sources = [],
  onRetry,
  running = true,
}: AIGenerationViewProps) {
  const failed = generation.state === "error";
  const stageIndex = generationStageIndex(generation);
  const stageLabel = generation.label ?? pick(AI_STAGE_LABELS[generation.state], language);

  if (failed) {
    return (
      <Card accent="warning" label={partnerLabel("generationUnavailable", language)}>
        <SectionHead title={partnerLabel("generationUnavailable", language)} />
        <div className="app-stack">
          {generation.error ? <Notice tone="warning">{generation.error}</Notice> : null}

          {/*
           * Evidence survives the failure.
           *
           * The retrieval step usually succeeded, so throwing the loaded
           * sources away with the draft would cost the user the one part of
           * the run that worked.
           */}
          {sources.length > 0 ? (
            <>
              <SourceRow sources={sources} language={language} showNecessity />
              <span className="app-meta">
                {partnerLabel("generationEvidenceKept", language)}
              </span>
            </>
          ) : null}

          {generation.retryable && onRetry ? (
            <div className="app-row">
              <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={onRetry}>
                <IconRefresh size={13} stroke={2} aria-hidden="true" />
                {partnerLabel("generationRetry", language)}
              </button>
            </div>
          ) : (
            <span className="app-meta">{partnerLabel("generationNotRetryable", language)}</span>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card accent="ai" label={partnerLabel("generationTitle", language)}>
      <div className="app-sheen app-stack" data-running={running}>
        <SectionHead title={partnerLabel("generationTitle", language)} />
        <span className="app-meta" role="status">
          {stageLabel}
        </span>
        <StageList
          stages={AI_STAGE_ORDER.map((stage) => pick(AI_STAGE_LABELS[stage], language))}
          activeIndex={stageIndex}
          label={partnerLabel("generationStages", language)}
        />
        {sources.length > 0 ? (
          <SourceRow sources={sources} language={language} showNecessity />
        ) : null}
      </div>
    </Card>
  );
}
