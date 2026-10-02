"use client";

import { motion, useReducedMotion } from "motion/react";
import { ReactNode } from "react";
import { containerRevealVariants, itemRevealVariants } from "./variants";

type Props = {
  children: ReactNode[];
  stagger?: "tight" | "standard" | "loose";
  exportMode?: boolean;
  className?: string;
};

// Wraps a list of children and reveals them one by one.
// Used inside slide layouts -- each bullet, row, or column is a child.
export function RevealSequence({ children, exportMode, className }: Props) {
  const prefersReduced = useReducedMotion();
  const skip = exportMode || prefersReduced;

  if (skip) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={containerRevealVariants}
      initial="hidden"
      animate="visible"
    >
      {children.map((child, i) => (
        <motion.div key={i} variants={itemRevealVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
