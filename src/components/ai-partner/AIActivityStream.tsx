"use client";

/**
 * The activity stream.
 *
 * A chronological record of what the partner actually did, grouped by
 * scenario moment. Every row corresponds to something that happened: a read,
 * a reconciliation, a draft, an escalation, a write.
 *
 * The compact row is the time and the label. Nothing else. The tool name, the
 * duration, the object, the authority class and the audit reference are all
 * real and all available, one keystroke away behind `ExpandRow`, and none of
 * them belongs in the default view. The previous layer put that metadata
 * inline and the result read as a debug console, which taught users to skip
 * the panel that holds the product's only honest account of itself.
 *
 * Auto scroll is off under reduced motion. A stream that yanks itself
 * downwards while someone is reading an expanded row is hostile, and for a
 * user with a vestibular sensitivity it is worse than hostile.
 */

import { useEffect, useRef } from "react";
import { IconArrowUpRight } from "@tabler/icons-react";
import type { AuthorityClass } from "@/db/schema/decisions";
import type { Language } from "@/i18n/labels";
import type { AIActivityEntryView } from "@/workday/contracts";
import {
  AuthorityChip,
  Data,
  Empty,
  ObjectRef,
} from "@/components/workday-v2/primitives";
import { ExpandRow } from "@/components/workday-v2/interactive";
import { groupByMoment, partnerLabel } from "./labels";

type Tone = "ai" | "info" | "success" | "warning" | "danger" | "neutral";

/** Tone per activity kind. Carried by a dot with a screen reader name. */
const KIND_TONE: Record<AIActivityEntryView["kind"], Tone> = {
  observed: "neutral",
  retrieved: "info",
  reconciled: "info",
  analysed: "ai",
  drafted: "ai",
  completed: "success",
  escalated: "warning",
  blocked: "danger",
  executed: "success",
  waiting: "warning",
};

/**
 * Durations read as data, so they are formatted as data.
 *
 * Sub second work is shown in milliseconds because that is the honest
 * resolution of a connector read, and rounding it to "0s" would make a real
 * operation look like no operation.
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The empty string is how the schema records "no authority applied".
 *
 * Narrowing it away here rather than rendering a chip for it keeps the
 * authority chip meaning what it says: this step carried an authority class.
 */
function hasAuthority(value: AuthorityClass | ""): value is AuthorityClass {
  return value !== "";
}

export interface AIActivityStreamProps {
  entries: AIActivityEntryView[];
  language: Language;
  /** Brings the newest row into view. Ignored under reduced motion. */
  autoScroll?: boolean;
  onOpenEvidence?: (evidenceId: string) => void;
  onOpenAudit?: (auditEventId: string) => void;
}

export function AIActivityStream({
  entries,
  language,
  autoScroll = true,
  onOpenEvidence,
  onOpenAudit,
}: AIActivityStreamProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll || entries.length === 0) return;
    if (prefersReducedMotion()) return;
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [autoScroll, entries.length]);

  if (entries.length === 0) {
    return (
      <Empty
        title={partnerLabel("activityEmptyTitle", language)}
        detail={partnerLabel("activityEmptyDetail", language)}
      />
    );
  }

  const groups = groupByMoment(entries);

  return (
    <div>
      {groups.map((group) => (
        <section key={group.moment}>
          <div
            className="app-eyebrow"
            style={{ padding: "var(--app-2) var(--app-3) var(--app-1)" }}
          >
            <Data>{group.moment}</Data>
            <span className="app-faint">{group.entries.length}</span>
          </div>

          <ul className="app-activity" aria-label={partnerLabel("activityLabel", language)}>
            {group.entries.map((entry) => {
              const duration = formatDuration(entry.durationMs);
              return (
                <li key={entry.id}>
                  <ExpandRow
                    label={`${entry.atMoment} ${entry.label}. ${partnerLabel("expandRow", language)}`}
                    summary={
                      <>
                        <span className="app-activity-time">{entry.atMoment}</span>
                        <span>
                          <span
                            className="app-dot"
                            data-tone={KIND_TONE[entry.kind]}
                            aria-hidden="true"
                          />
                        </span>
                        <span className="app-activity-label">{entry.label}</span>
                      </>
                    }
                  >
                    {/* Everything technical lives here and nowhere above. */}
                    {entry.detail ? <span>{entry.detail}</span> : null}

                    {entry.objectId ? (
                      <span>
                        <span className="app-faint">
                          {partnerLabel("detailObject", language)}{" "}
                        </span>
                        {entry.objectType ? `${entry.objectType} ` : ""}
                        <ObjectRef id={entry.objectId} label={entry.objectType} />
                      </span>
                    ) : null}

                    {entry.evidenceIds.length > 0 ? (
                      <span className="app-row-wrap" style={{ gap: "var(--app-1)" }}>
                        <span className="app-faint">
                          {partnerLabel("detailEvidence", language)}
                        </span>
                        {entry.evidenceIds.map((id) =>
                          onOpenEvidence ? (
                            <button
                              key={id}
                              type="button"
                              className="app-prompt-chip"
                              onClick={() => onOpenEvidence(id)}
                            >
                              <Data>{id}</Data>
                              <IconArrowUpRight size={11} stroke={2} aria-hidden="true" />
                            </button>
                          ) : (
                            <Data key={id}>{id}</Data>
                          ),
                        )}
                      </span>
                    ) : null}

                    {entry.toolName ? (
                      <span>
                        <span className="app-faint">{partnerLabel("detailStep", language)} </span>
                        <Data>{entry.toolName}</Data>
                      </span>
                    ) : null}

                    {duration ? (
                      <span>
                        <span className="app-faint">
                          {partnerLabel("detailDuration", language)}{" "}
                        </span>
                        <Data>{duration}</Data>
                      </span>
                    ) : null}

                    {entry.outcome ? (
                      <span>
                        <span className="app-faint">
                          {partnerLabel("detailOutcome", language)}{" "}
                        </span>
                        {entry.outcome}
                      </span>
                    ) : null}

                    {entry.connectorLabel ? (
                      <span>
                        <span className="app-faint">
                          {partnerLabel("detailSource", language)}{" "}
                        </span>
                        {entry.connectorLabel}
                      </span>
                    ) : null}

                    {hasAuthority(entry.authorityClass) ? (
                      <span className="app-row">
                        <span className="app-faint">
                          {partnerLabel("detailAuthority", language)}
                        </span>
                        <AuthorityChip
                          authorityClass={entry.authorityClass}
                          language={language}
                        />
                      </span>
                    ) : null}

                    {entry.auditEventId ? (
                      <span>
                        <span className="app-faint">{partnerLabel("detailAudit", language)} </span>
                        {onOpenAudit ? (
                          <button
                            type="button"
                            className="app-prompt-chip"
                            onClick={() => onOpenAudit(entry.auditEventId ?? "")}
                          >
                            <Data>{entry.auditEventId}</Data>
                          </button>
                        ) : (
                          <Data>{entry.auditEventId}</Data>
                        )}
                      </span>
                    ) : null}
                  </ExpandRow>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
