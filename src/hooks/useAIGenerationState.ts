"use client";

/**
 * useAIGenerationState: tracks the AIGenerationState machine.
 *
 * Responsibilities:
 * - Accept stage updates from the event channel (agent.stage.changed events).
 * - Maintain the current state, the list of completed stages and whether the
 *   suggestion is publishable.
 * - Refuse to report publishable before the validating stage completes.
 * - Handle errors with retry and clear the stuck running flag when superseded.
 * - Supersede cleanly when the context changes (new object, new role, new run).
 * - Respect prefers-reduced-motion: in reduced motion, state updates arrive
 *   immediately with no animation hints. All state information is preserved.
 *
 * The pure state machine (aiGenReducer and helpers) is exported so the test
 * suite can verify transitions in a node environment without React.
 *
 * The hook subscribes to agent.stage.changed events through an injectable
 * subscribe function. The default subscription uses DOM CustomEvents so the
 * hook compiles without a specific event bus dependency. Tests pass their own
 * subscribe function that calls the handler directly.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  AI_STAGE_ORDER,
  isPublishableState,
  type AIGenerationState,
} from "@/workday/contracts";

/* ==========================================================================
   Pure state machine (exported for unit tests)
   ========================================================================== */

export type AIGenMachineState = {
  /** The current generation state from the AI_STAGE_ORDER or a terminal state. */
  current: AIGenerationState;
  /** Stages that have been reported as completed by the event channel. */
  completedStages: AIGenerationState[];
  /** Error message when current === "error". Null otherwise. */
  error: string | null;
  /** True when the error may be resolved by retrying (network, timeout). */
  retryable: boolean;
  /**
   * True when this instance has been superseded by a newer request.
   *
   * A superseded instance ignores further stage updates so a slow previous
   * request cannot overwrite the state of the new one. The superseded flag
   * is cleared by a RETRY action, which re-activates the instance.
   */
  superseded: boolean;
};

export const initialAIGenState: AIGenMachineState = {
  current: "idle",
  completedStages: [],
  error: null,
  retryable: false,
  superseded: false,
};

export type AIGenAction =
  | {
      type: "STAGE_CHANGED";
      state: AIGenerationState;
      completedStages: AIGenerationState[];
    }
  | { type: "ERROR"; reason: string; retryable: boolean }
  | { type: "RETRY" }
  | { type: "SUPERSEDE" };

/**
 * Pure reducer for the AI generation state machine.
 *
 * Exported for unit tests. The invariants:
 *
 * 1. STAGE_CHANGED does not go backwards in AI_STAGE_ORDER. A late delivery
 *    of an earlier stage event cannot regress the state to an earlier step.
 *    States outside AI_STAGE_ORDER (idle, blocked, error) are not compared.
 *
 * 2. A superseded instance ignores STAGE_CHANGED and ERROR. Only RETRY
 *    un-supersedes the instance and resets it to queued.
 *
 * 3. Publishable is derived, not stored: the caller uses isPublishableFromMachine
 *    so publishability is always computed from the current state.
 */
export function aiGenReducer(
  state: AIGenMachineState,
  action: AIGenAction,
): AIGenMachineState {
  switch (action.type) {
    case "STAGE_CHANGED": {
      /*
       * A superseded instance ignores stage updates. The running flag that
       * might be set in the UI is therefore never stuck: the superseded
       * instance stops accepting state that could make it look busy.
       */
      if (state.superseded) return state;

      /*
       * Guard against backward movement. Only applies when both the incoming
       * and current state are part of the ordered progression. Terminal states
       * (idle, blocked, error) are not in AI_STAGE_ORDER, so we skip the
       * comparison for those.
       */
      const incomingIndex = AI_STAGE_ORDER.indexOf(action.state);
      const currentIndex = AI_STAGE_ORDER.indexOf(state.current);
      if (
        incomingIndex !== -1 &&
        currentIndex !== -1 &&
        incomingIndex < currentIndex
      ) {
        return state;
      }

      return {
        ...state,
        current: action.state,
        completedStages: action.completedStages,
        error: null,
        retryable: false,
      };
    }

    case "ERROR":
      if (state.superseded) return state;
      return {
        ...state,
        current: "error",
        error: action.reason,
        retryable: action.retryable,
      };

    case "RETRY":
      /*
       * RETRY resets the state and clears the superseded flag so the instance
       * is active again. The caller re-triggers the generation request.
       */
      return {
        current: "queued",
        completedStages: [],
        error: null,
        retryable: false,
        superseded: false,
      };

    case "SUPERSEDE":
      return { ...state, superseded: true };
  }
}

/**
 * Returns true only when a suggestion is publishable.
 *
 * The brief requires that the interface refuses to show a suggestion before
 * the validating stage completes. This function enforces that rule: it
 * delegates to isPublishableState from contracts, plus the superseded guard.
 */
export function isPublishableFromMachine(machine: AIGenMachineState): boolean {
  return !machine.superseded && isPublishableState(machine.current);
}

/* ==========================================================================
   Hook
   ========================================================================== */

export type StageChangedEvent = {
  state: AIGenerationState;
  completedStages: AIGenerationState[];
};

export type StageChangedHandler = (event: StageChangedEvent) => void;

export type SubscribeToStageEvents = (handler: StageChangedHandler) => () => void;

/**
 * Default event channel subscription using DOM CustomEvents.
 *
 * The stream publishes agent.stage.changed events as CustomEvents on window.
 * This default is replaced in tests, which pass their own subscribe function
 * via the hook's parameter.
 *
 * Guarded for server rendering: window is not available during SSR.
 */
function defaultSubscribe(handler: StageChangedHandler): () => void {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as StageChangedEvent | undefined;
    if (detail === undefined) return;
    handler({ state: detail.state, completedStages: detail.completedStages });
  };

  window.addEventListener("agent.stage.changed", listener);
  return () => window.removeEventListener("agent.stage.changed", listener);
}

export function useAIGenerationState(
  subscribe?: SubscribeToStageEvents,
): {
  machine: AIGenMachineState;
  isPublishable: boolean;
  retry: () => void;
  supersede: () => void;
} {
  const [machine, dispatch] = useReducer(aiGenReducer, initialAIGenState);

  /*
   * Stable ref to the subscribe function so the effect runs once per mount
   * rather than every time the caller's inline function is recreated.
   */
  const subscribeRef = useRef(subscribe);
  useEffect(() => {
    subscribeRef.current = subscribe;
  });

  const handleStageChanged = useCallback((event: StageChangedEvent) => {
    dispatch({ type: "STAGE_CHANGED", ...event });
  }, []);

  useEffect(() => {
    const effectiveSubscribe = subscribeRef.current ?? defaultSubscribe;
    const unsubscribe = effectiveSubscribe(handleStageChanged);

    return () => {
      unsubscribe();
      /*
       * Supersede on unmount so that any timer or async operation that
       * resolves after unmount cannot update state on a gone component.
       * This is belt-and-braces: the unsubscribe above stops the event
       * delivery, but an in-flight operation may already have called dispatch.
       */
      dispatch({ type: "SUPERSEDE" });
    };
    // handleStageChanged is stable. The dep array is intentionally empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = useCallback(() => dispatch({ type: "RETRY" }), []);
  const supersede = useCallback(() => dispatch({ type: "SUPERSEDE" }), []);

  return {
    machine,
    isPublishable: isPublishableFromMachine(machine),
    retry,
    supersede,
  };
}
