"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

interface SlideHeaderProps {
  section: string;
  title: string;
  subtitle: string;
  exportMode?: boolean;
  /** Rendered on the section label row, for example an implementation status badge */
  aside?: ReactNode;
}

const EASE_OUT_CUBIC: [number, number, number, number] = [0, 0, 0.2, 1];

export default function SlideHeader({
  section,
  title,
  subtitle,
  exportMode = false,
  aside,
}: SlideHeaderProps) {
  const prefersReduced = useReducedMotion();
  const isStatic = exportMode || prefersReduced;

  const label = <span className="pv24-section-label">{section}</span>;
  const labelRow = aside ? (
    <div className="pv24-section-row">
      {label}
      {aside}
    </div>
  ) : (
    label
  );

  if (isStatic) {
    return (
      <div className="pv24-slide-header">
        {labelRow}
        <h1 className="pv24-title">{title}</h1>
        <p className="pv24-subtitle">{subtitle}</p>
      </div>
    );
  }

  return (
    <div className="pv24-slide-header">
      <motion.div
        style={{ display: "flex" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT_CUBIC, delay: 0 }}
      >
        {labelRow}
      </motion.div>
      <motion.h1
        className="pv24-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT_CUBIC, delay: 0.1 }}
      >
        {title}
      </motion.h1>
      <motion.p
        className="pv24-subtitle"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT_CUBIC, delay: 0.2 }}
      >
        {subtitle}
      </motion.p>
    </div>
  );
}
