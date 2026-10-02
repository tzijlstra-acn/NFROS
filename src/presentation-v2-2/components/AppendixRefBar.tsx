"use client";

/**
 * AppendixRefBar
 *
 * A narrow bar shown at the bottom of core slides (above the footer) when the
 * current slide has appendixRefs. Renders one chip per ref; clicking a chip
 * opens the corresponding appendix slide.
 *
 * Hidden when the refs array is empty (cover and agenda slides have none).
 */

import React from "react";
import type { AppendixReference } from "../data/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppendixRefBarProps {
  appendixRefs: AppendixReference[];
  coreIndex: number; // 0-based, passed to goToAppendix as fromCoreIndex
  onGoToAppendix: (appendixId: string, fromCoreIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppendixRefBar({
  appendixRefs,
  coreIndex,
  onGoToAppendix,
}: AppendixRefBarProps) {
  if (appendixRefs.length === 0) {
    return null;
  }

  return (
    <div className="pv22-ref-bar" aria-label="Appendix references for this slide">
      <span className="pv22-ref-bar__label">More detail</span>
      {appendixRefs.map((ref) => (
        <button
          key={ref.appendixId}
          type="button"
          className="pv22-ref-chip"
          title={ref.reason}
          aria-label={`Open appendix: ${ref.label}`}
          onClick={() => onGoToAppendix(ref.appendixId, coreIndex)}
        >
          {ref.label}
        </button>
      ))}
    </div>
  );
}
