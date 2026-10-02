"use client";

/**
 * The partner header.
 *
 * Three things live here and each is here for a reason.
 *
 * The state. Derived from what the application is doing, shown as a mark plus
 * a word plus a line of detail.
 *
 * The autonomy level. The redesign moves it out of the top bar and puts it
 * where it is contextually relevant, which is next to the thing whose
 * behaviour it governs. In the old bar it read as a global setting nobody
 * connected to the suggestion they were looking at.
 *
 * The demo mode. Shown discreetly, because a reviewer needs to know whether
 * an answer was generated now, replayed from a cache or taken from seeded
 * content. It names the mode and nothing else: no provider, no engine, no
 * version string. That metadata lives in Control Room and Trust, and reaches
 * the workday only through the optional "View details" disclosure below,
 * which the shell fills in or leaves empty.
 */

import type { ReactNode } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import type { AutonomyLevel } from "@/db/schema/core";
import { AUTONOMY_LABELS, t, type Language } from "@/i18n/labels";
import { Chip, Dot } from "@/components/workday-v2/primitives";
import { Disclosure } from "@/components/workday-v2/interactive";
import { AIStatus } from "./AIStatus";
import { partnerLabel } from "./labels";
import type { AIPartnerState } from "@/workday/contracts";

export type DemoMode = "live" | "safe" | "offline";

const MODE_KEYS: Record<DemoMode, string> = {
  live: "modeLive",
  safe: "modeSafe",
  offline: "modeOffline",
};

const MODE_TONE: Record<DemoMode, "success" | "info" | "neutral"> = {
  live: "success",
  safe: "info",
  offline: "neutral",
};

export interface AIPartnerHeaderProps {
  state: AIPartnerState;
  language: Language;
  autonomyLevel: AutonomyLevel;
  demoMode: DemoMode;
  /** True only while an operation is actually in flight. Drives the sheen. */
  running?: boolean;
  /** Overrides the state detail line, for example with a server stage label. */
  detail?: string;
  /** How many items are waiting on this user. Omitted when zero. */
  needsYouCount?: number;
  /** Collapses the dock to the presence rail. Omitted when not collapsible. */
  onCollapse?: () => void;
  /**
   * Trace metadata. Rendered only inside the "View details" disclosure, never
   * on the face of the header, which is what keeps the normal workday free of
   * engine and run identifiers.
   */
  details?: ReactNode;
  /**
   * Whether to show the autonomy level and the AI mode on the face of the
   * dock.
   *
   * True, as it has always been, for V2. V3.1 passes false, because its brief
   * moves the mode and authority explanations to the Trust surface: a reader
   * opening the partner to ask a question should land in the conversation,
   * not read a posture table first. The information is not removed from the
   * product, it is moved to the page whose job is to answer what the system
   * is allowed to do.
   */
  showPosture?: boolean;
}

export function AIPartnerHeader({
  state,
  language,
  autonomyLevel,
  demoMode,
  running = false,
  detail,
  needsYouCount = 0,
  onCollapse,
  details,
  showPosture = true,
}: AIPartnerHeaderProps) {
  const modeKey = MODE_KEYS[demoMode];

  return (
    <div className="app-partner-head">
      <div className="app-row">
        <div className="app-grow">
          <AIStatus
            state={state}
            language={language}
            running={running}
            {...(detail ? { detail } : {})}
          />
        </div>
        {onCollapse ? (
          <button
            type="button"
            className="app-icon-btn app-shrink-0"
            onClick={onCollapse}
            aria-label={partnerLabel("collapsePartner", language)}
            title={partnerLabel("collapsePartner", language)}
          >
            <IconChevronRight size={15} stroke={2} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="app-eyebrow app-row-wrap">
        {showPosture ? (
          <>
        <span className="app-faint">{partnerLabel("autonomyLabel", language)}</span>
        <Chip tone="ai" title={partnerLabel("autonomyLabel", language)}>
          {t(AUTONOMY_LABELS, autonomyLevel, language)}
        </Chip>
        <span className="app-faint">{partnerLabel("modeLabel", language)}</span>
        <span className="app-row" style={{ gap: "var(--app-1)" }}>
          {/*
         * No label on the dot here, because the visible span beside it
         * already names the mode. With both, the accessible text read
         * "Mode Presenter safe Presenter safe", and in offline mode
         * "Mode Offline Offline". The dot carries colour only, so it is
         * hidden, and the span is the accessible name.
         */}
        <Dot tone={MODE_TONE[demoMode]} label="" />
          <span className="app-muted">{partnerLabel(modeKey, language)}</span>
        </span>
          </>
        ) : null}
        {needsYouCount > 0 ? (
          <Chip tone="warning" count title={partnerLabel("needsYouCount", language)}>
            {needsYouCount}
          </Chip>
        ) : null}
      </div>

      {details ? (
        <Disclosure label={partnerLabel("viewDetails", language)}>{details}</Disclosure>
      ) : null}
    </div>
  );
}
