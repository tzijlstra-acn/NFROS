import { Variants } from "motion/react";
import { MOTION_TOKENS as M } from "./tokens";

// Slide-level transitions (the whole slide canvas)
export const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? M.offset.slideX : -M.offset.slideX,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x:       { duration: M.duration.standard, ease: M.ease.enter },
      opacity: { duration: M.duration.fast },
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? M.offset.slideX : -M.offset.slideX,
    opacity: 0,
    transition: {
      x:       { duration: M.duration.fast, ease: M.ease.exit },
      opacity: { duration: M.duration.fast },
    },
  }),
};

// Container: reveals children in sequence
export const containerRevealVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: M.stagger.standard,
      delayChildren:   0.05,
    },
  },
};

// Single item reveal (used as child inside containerReveal)
export const itemRevealVariants: Variants = {
  hidden:  { opacity: 0, y: M.offset.revealY },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: M.duration.standard,
      ease:     M.ease.enter,
    },
  },
};

// Subtle emphasis pulse (for key metrics, not distracting)
export const emphasisVariants: Variants = {
  rest:      { scale: 1 },
  emphasise: {
    scale: 1.02,
    transition: { duration: M.duration.emphasis, ease: M.ease.emphasis },
  },
};

// Hero text: large title lines reveal word by word
export const heroLineVariants: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: M.duration.emphasis,
      ease:     M.ease.enter,
      delay:    i * M.stagger.loose,
    },
  }),
};

// Data element: fade in after its row container
export const dataRevealVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: M.duration.standard, ease: M.ease.enter },
  },
};

// Horizontal bar/progress reveal (for process rows)
export const barRevealVariants: Variants = {
  hidden:  { scaleX: 0, originX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: M.duration.complex, ease: M.ease.enter },
  },
};
