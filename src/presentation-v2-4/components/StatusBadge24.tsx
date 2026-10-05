"use client";

import type { ComponentType } from "react";
import {
  IconBook,
  IconCalendarEvent,
  IconCheck,
  IconPlayerPlay,
  IconProgress,
  type IconProps,
} from "@tabler/icons-react";
import type { ImplementationStatus } from "../data/types";

export type StatusLevel = ImplementationStatus["level"];

const LABEL: Record<StatusLevel, string> = {
  implemented: "Implemented",
  partial: "Partial",
  demo: "Demo",
  planned: "Planned",
  reference: "Reference",
};

const ICON: Record<StatusLevel, ComponentType<IconProps>> = {
  implemented: IconCheck,
  partial: IconProgress,
  demo: IconPlayerPlay,
  planned: IconCalendarEvent,
  reference: IconBook,
};

/** Reads a free-text status cell ("Implemented", "Demo only", "Planned") as a status level. */
export function levelFromText(text: string): StatusLevel {
  const t = text.toLowerCase();
  const done = /(implemented|installed|available|running|enforced|\blive\b|\byes\b|\bbuilt\b)/.test(t);
  const shown = /(demo|simulat|preview|seeded)/.test(t);
  if (/(partial|in progress|not wired)/.test(t)) return "partial";
  if (/(planned|roadmap|not started|not yet|not built|not enforced|defined only|proposal|proposed)/.test(t)) return "planned";
  if (done && shown) return "partial";
  if (shown) return "demo";
  if (done) return "implemented";
  return "reference";
}

type StatusBadgeProps = {
  level: StatusLevel;
  /** Overrides the level name, for example the exact wording of a table cell */
  text?: string;
  size?: "sm" | "md";
};

export function StatusBadge({ level, text, size = "md" }: StatusBadgeProps) {
  const Icon = ICON[level];
  return (
    <span className={`pv24-status pv24-status--${level} pv24-status--${size}`}>
      <Icon size={size === "sm" ? 14 : 16} stroke={2} aria-hidden="true" />
      {text ?? LABEL[level]}
    </span>
  );
}

export function statusLabel(level: StatusLevel): string {
  return LABEL[level];
}
