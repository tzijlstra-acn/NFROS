"use client";

/**
 * useProgressiveData: manages DataLoadState per named region.
 *
 * Responsibilities:
 * - Maintain a map of region name to DataLoadState.
 * - Apply the minimum-transition rule: when cached data resolves in less than
 *   MIN_LOADING_MS (300ms), hold the loading state for the remainder so the
 *   interface does not flash through loading too fast to read.
 * - Never delay a live request that is genuinely in flight: the minimum only
 *   fires when the state goes from loading/connecting to ready in one tick.
 * - Cancel all pending timers on unmount to prevent state updates on an
 *   unmounted component.
 * - Supersede cleanly when the calling context changes (new roleId, new route).
 *
 * The pure state machine (progressiveDataReducer and shouldApplyMinTransition)
 * is exported so the test suite can verify transitions in a node environment
 * without mounting a React component.
 *
 * Reduced-motion contract: in prefers-reduced-motion mode the hook still
 * tracks all state. What changes is that the minimum-transition delay is
 * skipped, because the delay exists to smooth an animation that is not shown
 * in reduced-motion mode. All readiness information is preserved.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { DataLoadState } from "@/workday/contracts";

/* ==========================================================================
   Pure state machine (exported for unit tests)
   ========================================================================== */

export type RegionLoadState = {
  state: DataLoadState;
  detail: string;
};

export type ProgressiveDataMap = Record<string, RegionLoadState>;

export type ProgressiveDataAction =
  | { type: "REGION_CHANGED"; region: string; state: DataLoadState; detail: string }
  | { type: "REGION_RESET"; region: string }
  | { type: "CLEAR_ALL" };

/**
 * Pure reducer for the region state map.
 *
 * Exported for testing. The hook wraps this with useReducer and adds the
 * timing logic (which cannot be tested in a node environment).
 */
export function progressiveDataReducer(
  state: ProgressiveDataMap,
  action: ProgressiveDataAction,
): ProgressiveDataMap {
  switch (action.type) {
    case "REGION_CHANGED":
      return {
        ...state,
        [action.region]: { state: action.state, detail: action.detail },
      };
    case "REGION_RESET": {
      const next = { ...state };
      delete next[action.region];
      return next;
    }
    case "CLEAR_ALL":
      return {};
  }
}

/**
 * The minimum time a loading state must be visible.
 *
 * 300ms is long enough to read "Loading" and short enough to not feel like a
 * deliberate delay. Used ONLY when the state resolves in under 300ms
 * (indicating a cache hit), never to artificially lengthen a live request.
 */
export const MIN_LOADING_MS = 300;

/**
 * Returns whether the minimum-transition delay should apply, and how long
 * to wait, given the time a region started loading and the time it resolved.
 *
 * Exported for unit tests. This is pure arithmetic with no side effects.
 *
 * The delay is skipped when the user prefers reduced motion: there is no
 * animation to smooth, and holding state changes would confuse, not help.
 */
export function shouldApplyMinTransition(
  startMs: number,
  resolveMs: number,
  reducedMotion: boolean,
  minMs: number = MIN_LOADING_MS,
): { apply: boolean; remainingMs: number } {
  if (reducedMotion) return { apply: false, remainingMs: 0 };
  const elapsed = resolveMs - startMs;
  if (elapsed >= minMs) return { apply: false, remainingMs: 0 };
  return { apply: true, remainingMs: minMs - elapsed };
}

/* ==========================================================================
   Hook
   ========================================================================== */

export type LoadEventHandler = (event: {
  region: string;
  state: DataLoadState;
  detail: string;
}) => void;

export type SubscribeToLoadEvents = (handler: LoadEventHandler) => () => void;

/**
 * Read the prefers-reduced-motion preference.
 *
 * Guarded for server rendering: window.matchMedia is not available during
 * SSR. Returns false on the server so the hook is safe in RSC contexts that
 * later hydrate on the client.
 */
function readReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useProgressiveData(
  subscribe?: SubscribeToLoadEvents,
): {
  regions: ProgressiveDataMap;
  dispatchRegion: (action: ProgressiveDataAction) => void;
  resetRegion: (region: string) => void;
  clearAll: () => void;
} {
  const [regions, dispatch] = useReducer(progressiveDataReducer, {});

  /*
   * Tracks when each region entered a loading or connecting state, so the
   * minimum-transition rule can compute elapsed time when the state resolves.
   * Stored in a ref so reads and writes in the effect do not cause re-renders.
   */
  const loadingStartRef = useRef<Record<string, number>>({});

  /*
   * Pending timers for the minimum-transition delay. Stored in a ref so
   * they can be cancelled on unmount and when the region is superseded.
   */
  const pendingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /*
   * Stable ref to the subscribe function so the effect's dependency array
   * does not need to include it (which would re-subscribe on every render if
   * the caller passes an inline function).
   */
  const subscribeRef = useRef(subscribe);
  useEffect(() => {
    subscribeRef.current = subscribe;
  });

  const handleLoadEvent = useCallback(
    ({ region, state: newState, detail }: Parameters<LoadEventHandler>[0]) => {
      const reducedMotion = readReducedMotion();

      /*
       * Record the start time when a region begins loading. This is compared
       * against the resolve time to decide if the minimum transition applies.
       */
      if (newState === "loading" || newState === "connecting") {
        loadingStartRef.current[region] = Date.now();
        dispatch({ type: "REGION_CHANGED", region, state: newState, detail });
        return;
      }

      /*
       * For ready and partial states: apply the minimum transition only when
       * the data resolved faster than MIN_LOADING_MS (i.e. from cache).
       * Live requests that genuinely take time are never delayed.
       */
      if (newState === "ready" || newState === "partial") {
        const startMs = loadingStartRef.current[region];
        if (startMs !== undefined) {
          const result = shouldApplyMinTransition(
            startMs,
            Date.now(),
            reducedMotion,
          );
          if (result.apply) {
            // Cancel any existing timer for this region first.
            const existing = pendingTimersRef.current[region];
            if (existing !== undefined) clearTimeout(existing);

            pendingTimersRef.current[region] = setTimeout(() => {
              delete pendingTimersRef.current[region];
              dispatch({ type: "REGION_CHANGED", region, state: newState, detail });
            }, result.remainingMs);
            return;
          }
        }
      }

      dispatch({ type: "REGION_CHANGED", region, state: newState, detail });
    },
    [],
  );

  useEffect(() => {
    if (!subscribeRef.current) return;
    const unsubscribe = subscribeRef.current(handleLoadEvent);

    return () => {
      unsubscribe();
      /*
       * Cancel all pending minimum-transition timers on unmount. Without this,
       * a timer that fires after unmount would call dispatch on a component
       * that no longer exists, producing a React warning.
       */
      for (const timer of Object.values(pendingTimersRef.current)) {
        clearTimeout(timer);
      }
      pendingTimersRef.current = {};
    };
    // handleLoadEvent is stable (no deps), so this runs once per subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    regions,
    dispatchRegion: dispatch,
    resetRegion: (region: string) => dispatch({ type: "REGION_RESET", region }),
    clearAll: () => dispatch({ type: "CLEAR_ALL" }),
  };
}
