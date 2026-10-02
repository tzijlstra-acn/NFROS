"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ReactNode } from "react";
import { slideVariants } from "./variants";

type Props = {
  slideKey: string | number;
  direction: number;        // +1 = forward, -1 = backward
  children: ReactNode;
  exportMode?: boolean;
};

// Wraps the current slide canvas and animates transitions between slides.
// Place this at the root of PresentationV22 and pass the active slide ID/index.
export function SharedSlideTransition({ slideKey, direction, children, exportMode }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || prefersReduced;

  if (skip) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" custom={direction} initial={false}>
      <motion.div
        key={slideKey}
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        style={{ width: "100%", height: "100%" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
