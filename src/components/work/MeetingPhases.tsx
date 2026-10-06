"use client";

/**
 * The three phases of a meeting, as tabs: before, during and after.
 *
 * Opens on the phase the scenario clock puts the meeting in, and the reader
 * can look at the others: preparing at 07:45, it helps to see what the after
 * phase will ask for. The panes are rendered on the server and handed in, so
 * this component holds nothing but which one is showing.
 */

import { useState, type ReactNode } from "react";
import type { MeetingPhase } from "@/features/work/modules/meetings/lifecycle";

export function MeetingPhases({
  label,
  current,
  phases,
  panes,
}: {
  label: string;
  current: MeetingPhase;
  phases: ReadonlyArray<{ id: MeetingPhase; label: string; state: string }>;
  panes: Record<MeetingPhase, ReactNode>;
}) {
  const [open, setOpen] = useState<MeetingPhase>(current);

  return (
    <div className="wd-meet" data-testid="meeting-lifecycle" data-phase={current}>
      <div className="wd-meet-phases" role="tablist" aria-label={label}>
        {phases.map((phase) => (
          <button
            key={phase.id}
            type="button"
            role="tab"
            id={`meeting-phase-${phase.id}`}
            aria-controls={`meeting-pane-${phase.id}`}
            aria-selected={open === phase.id}
            data-current={phase.id === current ? "true" : "false"}
            data-testid={`phase-tab-${phase.id}`}
            className="wd-meet-phase"
            onClick={() => setOpen(phase.id)}
          >
            {phase.label}
            <span className="wd-meet-phase-state">{phase.state}</span>
          </button>
        ))}
      </div>
      {phases.map((phase) => (
        <div
          key={phase.id}
          id={`meeting-pane-${phase.id}`}
          role="tabpanel"
          aria-labelledby={`meeting-phase-${phase.id}`}
          className="wd-meet-pane"
          data-testid={`${phase.id}-pane`}
          hidden={open !== phase.id}
        >
          {panes[phase.id]}
        </div>
      ))}
    </div>
  );
}
