"use client";

/**
 * useSlideNavigation
 *
 * URL-synced navigation hook for the V2.2 presentation engine.
 *
 * URL scheme:
 *   /story?deck=v2.2&core=5          -> core slide 5 (1-based)
 *   /story?deck=v2.2&appendix=app-08 -> appendix slide by ID
 *   /story?deck=v2.2&appendix=app-08&from=slide-05 -> appendix with return target
 *
 * State is kept in React; URL is kept in sync via router.replace (no history
 * entries per navigation -- press Back takes the presenter to the previous page).
 */

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NavigationMode = "core" | "appendix";

export type SlideState = {
  mode: NavigationMode;
  coreIndex: number;         // 0-based
  appendixId: string | null;
  returnToCore: number | null; // 0-based core index to return to after appendix
  direction: number;           // +1 = forward, -1 = backward (for transitions)
};

export type Navigation = {
  state: SlideState;
  goToCore: (index: number, direction?: number) => void;
  goToAppendix: (appendixId: string, fromCoreIndex?: number) => void;
  returnToOrigin: () => void;
  goBack: () => void;
  goForward: () => void;
  goToFirst: () => void;
  goToLast: () => void;
  totalCoreSlides: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert "slide-05" -> 4 (0-based).  Returns null on invalid input. */
function parseSlideId(id: string): number | null {
  const m = id.match(/^slide-(\d+)$/);
  if (!m) return null;
  const part = m[1];
  if (part === undefined) return null;
  const n = parseInt(part, 10);
  return isNaN(n) ? null : n - 1;
}

/** Convert 0-based index -> "slide-05" */
function indexToSlideId(index: number): string {
  return `slide-${String(index + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSlideNavigation(
  totalCoreSlides: number,
  appendixIds: string[],
  initialCoreSlide: number = 1,            // 1-based
  initialAppendixId: string | null = null,
  initialFrom: string | null = null,
): Navigation {
  const router = useRouter();
  const pathname = usePathname();

  // Derive initial state from props (which come from server-parsed URL params).
  const initialCoreIndex = Math.max(
    0,
    Math.min(initialCoreSlide - 1, totalCoreSlides - 1),
  );
  const initialReturnToCore = initialFrom ? parseSlideId(initialFrom) : null;
  const initialMode: NavigationMode = initialAppendixId ? "appendix" : "core";

  const [state, setState] = useState<SlideState>({
    mode: initialMode,
    coreIndex: initialCoreIndex,
    appendixId: initialAppendixId,
    returnToCore: initialReturnToCore,
    direction: 1,
  });

  // -------------------------------------------------------------------------
  // URL sync: update on every state change, skip the very first render so we
  // don't push a redundant replace when the URL already matches.
  // -------------------------------------------------------------------------

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const params = new URLSearchParams();
    params.set("deck", "v2.2");

    if (state.mode === "core") {
      params.set("core", String(state.coreIndex + 1));
    } else if (state.mode === "appendix" && state.appendixId) {
      params.set("appendix", state.appendixId);
      if (state.returnToCore !== null) {
        params.set("from", indexToSlideId(state.returnToCore));
      }
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [
    state.mode,
    state.coreIndex,
    state.appendixId,
    state.returnToCore,
    pathname,
    router,
  ]);

  // -------------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------------

  const goToCore = useCallback(
    (index: number, direction = 1) => {
      const clamped = Math.max(0, Math.min(index, totalCoreSlides - 1));
      setState({
        mode: "core",
        coreIndex: clamped,
        appendixId: null,
        returnToCore: null,
        direction,
      });
    },
    [totalCoreSlides],
  );

  const goToAppendix = useCallback(
    (appendixId: string, fromCoreIndex?: number) => {
      setState((prev) => ({
        ...prev,
        mode: "appendix",
        appendixId,
        returnToCore: fromCoreIndex ?? null,
        direction: 1,
      }));
    },
    [],
  );

  const returnToOrigin = useCallback(() => {
    setState((prev) => {
      const target = prev.returnToCore ?? 0;
      return {
        mode: "core",
        coreIndex: Math.max(0, Math.min(target, totalCoreSlides - 1)),
        appendixId: null,
        returnToCore: null,
        direction: -1,
      };
    });
  }, [totalCoreSlides]);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.mode === "appendix") {
        const currentIdx = prev.appendixId
          ? appendixIds.indexOf(prev.appendixId)
          : -1;
        if (currentIdx > 0) {
          // Go to previous appendix slide
          const prevId = appendixIds[currentIdx - 1];
          if (prevId !== undefined) {
            return {
              ...prev,
              appendixId: prevId,
              direction: -1,
            };
          }
        }
        // At start of appendix -- return to origin
        const target = prev.returnToCore ?? 0;
        return {
          mode: "core",
          coreIndex: Math.max(0, Math.min(target, totalCoreSlides - 1)),
          appendixId: null,
          returnToCore: null,
          direction: -1,
        };
      }
      // In core
      if (prev.coreIndex <= 0) return prev;
      return { ...prev, coreIndex: prev.coreIndex - 1, direction: -1 };
    });
  }, [appendixIds, totalCoreSlides]);

  const goForward = useCallback(() => {
    setState((prev) => {
      if (prev.mode === "appendix") {
        const currentIdx = prev.appendixId
          ? appendixIds.indexOf(prev.appendixId)
          : -1;
        const nextIdx = currentIdx + 1;
        if (nextIdx < appendixIds.length) {
          const nextId = appendixIds[nextIdx];
          if (nextId !== undefined) {
            return {
              ...prev,
              appendixId: nextId,
              direction: 1,
            };
          }
        }
        return prev; // at end of appendix
      }
      // In core
      if (prev.coreIndex >= totalCoreSlides - 1) return prev;
      return { ...prev, coreIndex: prev.coreIndex + 1, direction: 1 };
    });
  }, [appendixIds, totalCoreSlides]);

  const goToFirst = useCallback(() => {
    setState({
      mode: "core",
      coreIndex: 0,
      appendixId: null,
      returnToCore: null,
      direction: -1,
    });
  }, []);

  const goToLast = useCallback(() => {
    setState((prev) => {
      if (prev.mode === "appendix") {
        return {
          ...prev,
          appendixId: appendixIds[appendixIds.length - 1] ?? prev.appendixId,
          direction: 1,
        };
      }
      return { ...prev, coreIndex: totalCoreSlides - 1, direction: 1 };
    });
  }, [appendixIds, totalCoreSlides]);

  return {
    state,
    goToCore,
    goToAppendix,
    returnToOrigin,
    goBack,
    goForward,
    goToFirst,
    goToLast,
    totalCoreSlides,
  };
}
