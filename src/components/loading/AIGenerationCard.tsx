"use client";

/**
 * AIGenerationCard: generation-in-progress visualization.
 *
 * Shown while the partner is working through its source checks and analysis,
 * before AI content is ready to populate. Driven by AIGenerationState and
 * AI_STAGE_ORDER from contracts.
 *
 * The card never names a model, a provider or a chain-of-thought step. It
 * shows observable processing steps: what sources were loaded, how many
 * records were found, and which stage the work is at. These are factual
 * statements about observable application state.
 *
 * CONSTRAINED case: when missingRequiredSources is non-empty, the card names
 * the outstanding source, holds the stage and does not imply a recommendation
 * is imminent. The normal stage sequence halts at the constraint notice.
 *
 * Announcement behaviour: the Announcer emits stage label text on each state
 * change. Because the Announcer only triggers screen reader announcement when
 * its message prop changes, re-renders with the same state do not re-announce.
 */

import { IconCheck, IconCircle, IconCircleDot } from "@tabler/icons-react";
import {
  AI_STAGE_LABELS,
  AI_STAGE_ORDER,
  isPublishableState,
  pick,
  type AIGenerationState,
  type SourceAttribution,
} from "@/workday/contracts";
import { Announcer } from "@/components/workday-v2/interactive";
import {
  AI_CARD_LABELS,
  STAGE_LIST_LABELS,
  pickLabel,
  recordsIdentifiedLabel,
  stageAnnouncementText,
} from "@/components/loading/labels";
import type { Language } from "@/i18n/labels";

export function AIGenerationCard({
  state,
  completedStages,
  recordCount,
  missingRequiredSources = [],
  language = "en",
}: {
  /** The current generation state from contracts.AIGenerationState. */
  state: AIGenerationState;
  /**
   * Stages that have completed, as published by agent.stage.changed events.
   * The card uses this list rather than inferring completion from the current
   * state alone, so it correctly shows past ticks during any state.
   */
  completedStages: AIGenerationState[];
  /**
   * The count of relevant records found during the retrieving stage.
   * Pass 0 before the count is known. The row is omitted at 0.
   */
  recordCount: number;
  /**
   * Names of required sources that are not yet available.
   * When non-empty the card enters constrained mode: it shows this list,
   * holds the stage and does not imply a recommendation is coming.
   */
  missingRequiredSources?: string[];
  language?: Language;
}) {
  const isConstrained = missingRequiredSources.length > 0;

  /*
   * isPastQueued: the context-loading step has completed. Show the "Role and
   * work object loaded" confirmation row with a check mark.
   */
  const isPastQueued = isAfterStage(state, completedStages, "queued");

  /*
   * isPastRetrieving: source records have been retrieved. Show the record
   * count row. Only shown when recordCount > 0 so we never show "0 records".
   */
  const isPastRetrieving = isAfterStage(state, completedStages, "retrieving");

  /*
   * Determine the announcement text for screen readers.
   * Ready state gets a completion message. Other active states get
   * "Processing: [stage label]". Idle/error/blocked states announce nothing
   * because they are not loading states.
   */
  const currentLabel =
    state !== "idle" && state !== "error" && state !== "blocked"
      ? pick(AI_STAGE_LABELS[state], language)
      : "";

  const announcement = isPublishableState(state)
    ? pickLabel(AI_CARD_LABELS.processingComplete, language)
    : currentLabel
      ? stageAnnouncementText(currentLabel, language)
      : "";

  return (
    <div className="app-stack-3">
      {/*
       * Polite live region. Screen readers read this when the text changes,
       * which is when the stage changes. The same stage label is never
       * re-announced because aria-live polite only fires on content change.
       */}
      <Announcer message={announcement} />

      {/* Card header */}
      <div className="app-row app-between">
        <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
          {pickLabel(AI_CARD_LABELS.header, language)}
        </span>
        {isConstrained ? (
          <span className="app-faint" style={{ fontSize: "var(--app-text-xs)" }}>
            {pickLabel(AI_CARD_LABELS.constrained, language)}
          </span>
        ) : null}
      </div>

      {/*
       * Fixed pre-stage rows. These are confirmed facts, shown with a check
       * once the corresponding stage has passed. They do not appear as stage
       * items in the list below because they are not processing stages: they
       * are confirmations that the required inputs were found.
       */}
      {isPastQueued || isPastRetrieving ? (
        <ul className="app-did-list">
          {isPastQueued ? (
            <li className="app-did-item">
              <IconCheck
                size={11}
                stroke={2.4}
                color="var(--app-success)"
                aria-hidden="true"
              />
              <span>{pickLabel(AI_CARD_LABELS.contextLoaded, language)}</span>
            </li>
          ) : null}
          {isPastRetrieving && recordCount > 0 ? (
            <li className="app-did-item">
              <IconCheck
                size={11}
                stroke={2.4}
                color="var(--app-success)"
                aria-hidden="true"
              />
              <span>{recordsIdentifiedLabel(recordCount, language)}</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {/*
       * Stage list. Drives state from AI_STAGE_ORDER rather than from a
       * hardcoded list so additions to the order in contracts.ts are
       * automatically reflected here without a code change in this component.
       */}
      <ul
        className="app-stages"
        aria-label={pickLabel(STAGE_LIST_LABELS.loadingStages, language)}
      >
        {AI_STAGE_ORDER.map((stageName) => {
          const isDone = completedStages.includes(stageName);
          const isActive = stageName === state && !isDone;
          const stageState = isDone ? "done" : isActive ? "active" : "pending";
          const label = pick(AI_STAGE_LABELS[stageName], language);

          return (
            <li key={stageName} className="app-stage" data-state={stageState}>
              <span className="app-stage-glyph" aria-hidden="true">
                {isDone ? (
                  <IconCheck size={12} stroke={2.4} />
                ) : isActive ? (
                  <IconCircleDot size={12} stroke={2.2} />
                ) : (
                  <IconCircle size={11} stroke={1.8} />
                )}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>

      {/*
       * Constrained-mode notice. Names the specific missing source rather
       * than giving a generic message, because the presenter needs to know
       * which integration to resolve. The notice uses warning tone because the
       * situation is not an error: work continues on available sources.
       */}
      {isConstrained ? (
        <div className="app-notice" data-tone="warning">
          <span>
            {pickLabel(AI_CARD_LABELS.waitingFor, language)}
            {": "}
            {missingRequiredSources.join(", ")}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/*
 * Returns true when the application is past a given reference stage. Uses
 * completedStages list first (the authoritative signal from the event channel)
 * and falls back to index comparison on AI_STAGE_ORDER for cases where the
 * event arrived but the list was not yet updated.
 *
 * States outside AI_STAGE_ORDER ("idle", "blocked", "error") return false
 * because they do not represent forward progress.
 */
function isAfterStage(
  current: AIGenerationState,
  completedStages: AIGenerationState[],
  reference: AIGenerationState,
): boolean {
  if (completedStages.includes(reference)) return true;
  const referenceIndex = AI_STAGE_ORDER.indexOf(reference);
  const currentIndex = AI_STAGE_ORDER.indexOf(current);
  return currentIndex !== -1 && currentIndex > referenceIndex;
}
