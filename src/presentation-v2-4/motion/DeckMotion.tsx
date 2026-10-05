"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode, type RefObject } from "react";
import { MotionGlobalConfig, frameData } from "motion";

type DeckMotionValue = { paused: boolean };

const DeckMotionContext = createContext<DeckMotionValue>({ paused: false });

/** Exhibits with their own timers read this to hold them while the presenter has paused motion. */
export function useDeckMotion(): DeckMotionValue {
  return useContext(DeckMotionContext);
}

// With useManualTiming on, motion reads the frozen frameData.timestamp, so JS animations hold.
// Resume returns to the real clock (motion syncs new WAAPI start times to its clock, so an
// offset clock is not an option); JS animations catch up, WAAPI and SMIL resume in place.
function freezeClock(): void {
  frameData.timestamp = performance.now();
  MotionGlobalConfig.useManualTiming = true;
}

function thawClock(): void {
  MotionGlobalConfig.useManualTiming = false;
}

function animationTarget(a: Animation): Element | null {
  const effect = a.effect;
  return effect instanceof KeyframeEffect ? effect.target : null;
}

// Holds WAAPI, CSS keyframe and SMIL animations inside the root. CSS transitions are left alone
// so hover feedback never sticks half way. New animations are caught by a frame-throttled
// mutation observer plus a slow sweep while paused.
function freezeDom(root: HTMLElement): () => void {
  const held = new Set<Animation>();

  const sweep = (): void => {
    for (const a of document.getAnimations()) {
      if (typeof CSSTransition !== "undefined" && a instanceof CSSTransition) continue;
      const target = animationTarget(a);
      if (!target || !root.contains(target)) continue;
      if (a.playState === "running") {
        a.pause();
        held.add(a);
      }
    }
    root.querySelectorAll("svg").forEach((svg) => {
      if (!svg.animationsPaused()) svg.pauseAnimations();
    });
  };

  let scheduled = 0;
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      sweep();
    });
  };

  sweep();
  const observer = new MutationObserver(schedule);
  observer.observe(root, { subtree: true, childList: true, attributes: true });
  const interval = window.setInterval(sweep, 250);

  return () => {
    observer.disconnect();
    window.clearInterval(interval);
    if (scheduled) cancelAnimationFrame(scheduled);
    for (const a of held) {
      const target = animationTarget(a);
      if (a.playState === "paused" && target?.isConnected) a.play();
    }
    held.clear();
    root.querySelectorAll("svg").forEach((svg) => {
      if (svg.animationsPaused()) svg.unpauseAnimations();
    });
  };
}

type DeckMotionProviderProps = {
  paused: boolean;
  rootRef: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export function DeckMotionProvider({ paused, rootRef, children }: DeckMotionProviderProps) {
  useEffect(() => {
    const root = rootRef.current;
    if (!paused || !root) return;
    freezeClock();
    const releaseDom = freezeDom(root);
    return () => {
      releaseDom();
      thawClock();
    };
  }, [paused, rootRef]);

  const value = useMemo<DeckMotionValue>(() => ({ paused }), [paused]);
  return <DeckMotionContext.Provider value={value}>{children}</DeckMotionContext.Provider>;
}
