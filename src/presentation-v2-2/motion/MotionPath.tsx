"use client";

import { motion, useReducedMotion } from "motion/react";
import { ReactNode } from "react";
import { itemRevealVariants, heroLineVariants, dataRevealVariants } from "./variants";

type MotionVariant = "item" | "hero-line" | "data" | "bar";

type Props = {
  variant: MotionVariant;
  exportMode?: boolean;
  index?: number;        // used for hero-line stagger index
  children: ReactNode;
  className?: string;
};

const VARIANT_MAP = {
  "item":       itemRevealVariants,
  "hero-line":  heroLineVariants,
  "data":       dataRevealVariants,
  "bar":        undefined,  // handled inline
} as const;

// A single animated element. Use inside a RevealSequence OR standalone.
// For hero text: variant="hero-line" index={lineIndex}
// For data cells: variant="data"
// For list items: variant="item"
export function MotionPath({ variant, exportMode, index = 0, children, className }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || prefersReduced;

  if (skip) {
    return <div className={className}>{children}</div>;
  }

  const variants = VARIANT_MAP[variant] ?? itemRevealVariants;

  return (
    <motion.div
      className={className}
      custom={index}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
