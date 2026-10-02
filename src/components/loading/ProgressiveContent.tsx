/**
 * ProgressiveContent: enforces the brief's population order.
 *
 * Routes pass an ordered array of ContentStage objects. Each stage has a
 * skeleton (shown while loading) and content (shown when ready). The
 * component reveals content in declared order: a stage's content is not shown
 * until all blocking stages before it are ready.
 *
 * PRIMARY-ACTION GUARANTEE
 * Action buttons must not move after the user has positioned their cursor.
 * This component guarantees it by two means:
 *
 * 1. Stable space. A stage's slot always occupies space from the first render,
 *    either filled by the skeleton or the real content. The two must match in
 *    height (see DataSkeleton for the mechanism). If the skeleton and the real
 *    content are the same height, switching between them causes no layout shift.
 *
 * 2. Ordering discipline. Action buttons are placed in a later stage than the
 *    content above them. Because all stages render from the first paint (as
 *    skeletons), the button row's position is established at initial paint and
 *    does not shift when earlier stages populate.
 *
 * A route that places buttons in an early stage, or that uses a later-stage
 * skeleton with different height than the real content, breaks this contract.
 * Neither can be enforced at the type level: the handoff documents the rule.
 *
 * SERVER SAFE
 * No hooks, no client directive. The caller provides the ready flags from
 * whatever state management they use (typically useProgressiveData).
 */

import type { ReactNode } from "react";
import type { Language } from "@/i18n/labels";
import { PROGRESSIVE_LABELS, pickLabel } from "@/components/loading/labels";

export interface ContentStage {
  /** Unique key for the stage, used as the React key. */
  id: string;
  /**
   * The skeleton shown while this stage is loading.
   * Must match the height of `content` to prevent layout shift.
   */
  skeleton: ReactNode;
  /** The real content, shown when ready and all blocking predecessors are ready. */
  content: ReactNode;
  /** Whether this stage is ready to show its content. */
  ready: boolean;
  /**
   * Whether a not-ready state blocks all subsequent stages from showing content.
   * Defaults to true. Set to false for a supplementary stage that should not
   * hold back independent later stages.
   */
  blocks?: boolean;
}

/**
 * Resolves which stages show their content.
 *
 * Exported as a pure function so it can be tested without rendering.
 * The rule is linear: once a blocking stage is not ready, all subsequent
 * stages show their skeleton regardless of their own ready flag.
 */
export function resolveStageVisibility(
  stages: ReadonlyArray<Pick<ContentStage, "ready" | "blocks">>,
): boolean[] {
  const result: boolean[] = [];
  let blocked = false;

  for (const stage of stages) {
    if (blocked) {
      result.push(false);
    } else {
      result.push(stage.ready);
      if (!stage.ready && (stage.blocks !== false)) {
        blocked = true;
      }
    }
  }

  return result;
}

export function ProgressiveContent({
  stages,
  language = "en",
  label,
}: {
  stages: ContentStage[];
  language?: Language;
  /** Accessible label for the container, if it represents a named region. */
  label?: string;
}) {
  const visibility = resolveStageVisibility(stages);
  const isBusy = stages.some((s) => !s.ready);

  return (
    <div
      {...(label ? { "aria-label": label } : {})}
      {...(isBusy ? { "aria-busy": true } : {})}
    >
      {/*
       * When busy, the loading region label is surfaced for screen readers via
       * a visually hidden status element. The aria-busy on the container tells
       * assistive technology the region is incomplete; this text explains why.
       */}
      {isBusy ? (
        <span className="app-sr-only" role="status" aria-live="polite">
          {pickLabel(PROGRESSIVE_LABELS.loadingRegion, language)}
        </span>
      ) : null}

      {stages.map((stage, index) => {
        const showContent = visibility[index] === true;
        return (
          <div key={stage.id}>
            {showContent ? stage.content : stage.skeleton}
          </div>
        );
      })}
    </div>
  );
}
