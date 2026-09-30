"use client";

/**
 * Shell controls.
 *
 * These are the controls that change real state. Each one calls a server
 * action and then lets the framework revalidate, rather than keeping a local
 * copy of the truth. That is slightly slower than optimistic local state and
 * much easier to trust: what the control shows is what the database says.
 *
 * The autonomy selector in particular must never be optimistic. Showing a
 * higher autonomy level than the gate is actually enforcing would be the worst
 * possible lie for this product to tell.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionResetScenario,
  actionSetAutonomy,
  actionSetLanguage,
  actionSetMoment,
  actionSetWorldView,
  actionSwitchRole,
} from "@app/actions";
import { AUTONOMY_LEVELS, type AutonomyLevel, type RoleId } from "@/db/schema/core";
import {
  ACTION_LABELS,
  AUTONOMY_LABELS,
  PRODUCT_COPY,
  t,
  type Language,
} from "@/i18n/labels";

/* ==========================================================================
   Today versus the AI enabled future
   ========================================================================== */

export function WorldViewToggle({
  current,
  language,
}: {
  current: "today" | "future";
  language: Language;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (view: "today" | "future") => {
    if (view === current) return;
    start(async () => {
      await actionSetWorldView(view);
      router.refresh();
    });
  };

  return (
    <div
      className="segmented"
      role="group"
      aria-label="Switch between the current reality and the AI enabled future"
      data-pending={pending}
    >
      <button
        type="button"
        className="segmented-option"
        aria-pressed={current === "today"}
        onClick={() => set("today")}
      >
        {t(PRODUCT_COPY, "todayView", language)}
      </button>
      <button
        type="button"
        className="segmented-option"
        aria-pressed={current === "future"}
        onClick={() => set("future")}
      >
        {t(PRODUCT_COPY, "futureView", language)}
      </button>
    </div>
  );
}

/* ==========================================================================
   Autonomy
   ========================================================================== */

export function AutonomySelector({
  current,
  language,
  withheldCount,
}: {
  current: AutonomyLevel;
  language: Language;
  withheldCount: number;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const set = (level: AutonomyLevel) => {
    start(async () => {
      await actionSetAutonomy(level);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-sm btn-quiet"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        disabled={pending}
        title="The autonomy level changes which tool actions are permitted."
      >
        <span className="label" style={{ color: "var(--text-4)" }}>
          Autonomy
        </span>
        <span style={{ color: "var(--amber)" }}>{t(AUTONOMY_LABELS, current, language)}</span>
      </button>

      {open ? (
        <div
          className="panel"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 60,
            width: 380,
            boxShadow: "var(--shadow-3)",
            padding: "var(--space-2)",
          }}
        >
          <div className="stack stack-1">
            {AUTONOMY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                aria-checked={level === current}
                className="card card-interactive"
                data-selected={level === current}
                onClick={() => set(level)}
                style={{ padding: "var(--space-3)" }}
              >
                <div className="stack stack-1">
                  <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                    {t(AUTONOMY_LABELS, level, language)}
                  </span>
                  <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                    {AUTONOMY_DETAIL[level]}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className="meta" style={{ padding: "var(--space-3)", borderTop: "1px solid var(--border-1)", marginTop: "var(--space-2)" }}>
            {withheldCount} tool action(s) are currently withheld at this level. The authority gate
            enforces this, not the interface.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const AUTONOMY_DETAIL: Record<AutonomyLevel, string> = {
  assist: "Retrieve evidence and answer questions. No official drafting.",
  prepare: "Draft records and prepare challenge questions. No changes to records.",
  recommend: "Recommend decisions with alternatives and uncertainty. No changes to records.",
  "act-with-approval": "Prepare changes, pause for approval, execute only after a person approves.",
  "act-within-policy": "Execute low risk, reversible, routine actions. Material actions still require approval.",
};

/* ==========================================================================
   Role switching
   ========================================================================== */

export interface RoleOption {
  id: RoleId;
  title: string;
  titleDe: string;
  holderName: string;
  entityShortName: string;
  deeplyInteractive: boolean;
}

/**
 * Switching role navigates to that role's route and changes the acting role on
 * the run. Scenario state, earlier decisions and the audit history are
 * retained, which is the behaviour the product is making a point about.
 */
export function RoleSwitcher({
  current,
  options,
  language,
}: {
  current: RoleId;
  options: RoleOption[];
  language: Language;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const currentRole = options.find((option) => option.id === current);

  const set = (roleId: RoleId) => {
    start(async () => {
      await actionSwitchRole(roleId);
      setOpen(false);
      router.push(`/workday/${roleId}`);
      router.refresh();
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-sm btn-quiet"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        disabled={pending}
      >
        <span className="strong-text">
          {currentRole
            ? language === "de"
              ? currentRole.titleDe
              : currentRole.title
            : current}
        </span>
        <span aria-hidden="true" className="muted">
          v
        </span>
      </button>

      {open ? (
        <div
          className="panel"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 60,
            width: 420,
            boxShadow: "var(--shadow-3)",
            padding: "var(--space-2)",
          }}
        >
          <p className="meta" style={{ padding: "var(--space-2) var(--space-3)" }}>
            Switching role keeps the shared event, the scenario state, earlier decisions and the
            audit history. The brief, the work object, the evidence priorities and the decision
            rights change.
          </p>
          <div className="stack stack-1">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={option.id === current}
                className="card card-interactive"
                data-selected={option.id === current}
                onClick={() => set(option.id)}
                style={{ padding: "var(--space-3)" }}
              >
                <div className="row row-3 row-between">
                  <div className="stack stack-1">
                    <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                      {language === "de" ? option.titleDe : option.title}
                    </span>
                    <span className="meta">
                      {option.holderName} &middot; {option.entityShortName}
                    </span>
                  </div>
                  {!option.deeplyInteractive ? (
                    <span className="chip" data-tone="neutral">
                      complete journey
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Language
   ========================================================================== */

export function LanguageToggle({ current }: { current: Language }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (language: Language) => {
    if (language === current) return;
    start(async () => {
      await actionSetLanguage(language);
      router.refresh();
    });
  };

  return (
    <div className="segmented" role="group" aria-label="Interface language" data-pending={pending}>
      <button
        type="button"
        className="segmented-option"
        aria-pressed={current === "en"}
        onClick={() => set("en")}
      >
        EN
      </button>
      <button
        type="button"
        className="segmented-option"
        aria-pressed={current === "de"}
        onClick={() => set("de")}
      >
        DE
      </button>
    </div>
  );
}

/* ==========================================================================
   Timeline scrubber
   ========================================================================== */

export interface TimelineMoment {
  id: string;
  moment: string;
  title: string;
  titleDe: string;
  dominantLane: string;
  isSharedEvent: boolean;
}

/**
 * The bottom timeline.
 *
 * Scrubbing genuinely changes what is visible, because the read queries filter
 * on the scenario clock. Moving back in time does not un-record a decision,
 * which is why a decided moment keeps its marker.
 */
export function TimelineScrubber({
  moments,
  current,
  language,
  decidedMoments,
}: {
  moments: TimelineMoment[];
  current: string;
  language: Language;
  decidedMoments: string[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const go = (moment: string) => {
    start(async () => {
      await actionSetMoment(moment);
      router.refresh();
    });
  };

  const currentIndex = moments.findIndex((m) => m.moment === current);

  return (
    <nav
      aria-label="Workday timeline"
      style={{
        height: "var(--timeline-height)",
        /* The border and background are owned by the shell's bottom bar now,
           because the synthetic data disclosure sits alongside this. */
        background: "transparent",
        display: "flex",
        alignItems: "center",
        padding: "0 var(--space-4)",
        gap: "var(--space-2)",
      }}
      data-pending={pending}
    >
      <div className="row row-2 shrink-0" style={{ marginRight: "var(--space-2)" }}>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            const previous = moments[Math.max(0, currentIndex - 1)];
            if (previous) go(previous.moment);
          }}
          disabled={currentIndex <= 0 || pending}
          aria-label="Previous moment"
        >
          &#8592;
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            const next = moments[Math.min(moments.length - 1, currentIndex + 1)];
            if (next) go(next.moment);
          }}
          disabled={currentIndex >= moments.length - 1 || pending}
          aria-label="Next moment"
        >
          &#8594;
        </button>
      </div>

      <ol className="row grow" style={{ gap: 0, position: "relative" }}>
        {/* The connecting rail, drawn behind the markers. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: 15,
            height: 1,
            background: "var(--border-1)",
          }}
        />
        {moments.map((moment, index) => {
          const isCurrent = moment.moment === current;
          const isPast = index < currentIndex;
          const isDecided = decidedMoments.includes(moment.moment);
          return (
            <li key={moment.id} style={{ flex: 1, minWidth: 0, position: "relative" }}>
              <button
                type="button"
                onClick={() => go(moment.moment)}
                disabled={pending}
                aria-current={isCurrent ? "step" : undefined}
                className={moment.isSharedEvent && isCurrent ? "event-pulse" : undefined}
                title={language === "de" ? moment.titleDe : moment.title}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  width: "100%",
                  padding: "var(--space-1) 2px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: isCurrent ? 12 : 8,
                    height: isCurrent ? 12 : 8,
                    borderRadius: "50%",
                    background: moment.isSharedEvent
                      ? "var(--red)"
                      : isCurrent
                        ? "var(--accent)"
                        : isPast
                          ? "var(--cyan)"
                          : "var(--surface-3)",
                    border: `1px solid ${
                      moment.isSharedEvent
                        ? "var(--red)"
                        : isCurrent
                          ? "var(--accent)"
                          : "var(--border-2)"
                    }`,
                    outline: isDecided ? "2px solid var(--amber)" : "none",
                    outlineOffset: 2,
                  }}
                />
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: isCurrent ? "var(--text-1)" : "var(--text-4)",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {moment.moment}
                </span>
                <span
                  className="truncate"
                  style={{
                    fontSize: "var(--text-xs)",
                    color: isCurrent ? "var(--text-2)" : "var(--text-4)",
                    maxWidth: "100%",
                  }}
                >
                  {language === "de" ? moment.titleDe : moment.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ==========================================================================
   Background work reveal
   ========================================================================== */

export interface BackgroundWorkCounts {
  systemsChecked: number;
  recordsReconciled: number;
  documentsClassified: number;
  itemsRequested: number;
  contradictionsIdentified: number;
  routineUpdates: number;
  escalatedToHuman: number;
  actions: Array<{ id: string; kind: string; targetLabel: string; description: string; performedAtMoment: string }>;
}

/**
 * The background work reveal.
 *
 * Every number here is a row count over seeded actions, and each count expands
 * to the individual actions with the object each one touched. That is the
 * difference between this and a dashboard counter.
 */
export function BackgroundWorkReveal({
  counts,
  language,
}: {
  counts: BackgroundWorkCounts;
  language: Language;
}) {
  const [open, setOpen] = useState(false);
  const [expandedKind, setExpandedKind] = useState<string | null>(null);

  const rows: Array<{ kind: string; count: number; label: string }> = [
    { kind: "system-checked", count: counts.systemsChecked, label: "systems checked" },
    { kind: "record-reconciled", count: counts.recordsReconciled, label: "records reconciled" },
    { kind: "document-classified", count: counts.documentsClassified, label: "documents classified" },
    { kind: "item-requested", count: counts.itemsRequested, label: "missing items requested" },
    { kind: "contradiction-identified", count: counts.contradictionsIdentified, label: "contradictions identified" },
    { kind: "routine-update", count: counts.routineUpdates, label: "routine updates completed" },
    { kind: "escalated-to-human", count: counts.escalatedToHuman, label: "decision escalated to you" },
  ].filter((row) => row.count > 0);

  return (
    <>
      <button type="button" className="btn btn-sm btn-quiet" onClick={() => setOpen(true)}>
        {t(ACTION_LABELS, "backgroundWork", language)}
      </button>

      {open ? (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t(ACTION_LABELS, "backgroundWork", language)}
          onClick={(clickEvent) => {
            if (clickEvent.target === clickEvent.currentTarget) setOpen(false);
          }}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Escape") setOpen(false);
          }}
        >
          <div className="dialog">
            <div className="dialog-head">
              <div className="stack stack-1">
                <h2 style={{ fontSize: "var(--text-lg)" }}>
                  {t(ACTION_LABELS, "backgroundWork", language)}
                </h2>
                <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                  Every figure below is a count of recorded actions, and each one expands to the
                  individual objects that were touched.
                </p>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(false)} aria-label="Close">
                &#10005;
              </button>
            </div>

            <div className="dialog-body">
              <ul className="stack stack-2">
                {rows.map((row) => {
                  const expanded = expandedKind === row.kind;
                  const matching = counts.actions.filter((action) => action.kind === row.kind);
                  return (
                    <li key={row.kind} className="panel-flush">
                      <button
                        type="button"
                        className="row row-3 row-between"
                        style={{ width: "100%", padding: "var(--space-3) var(--space-4)", textAlign: "left" }}
                        aria-expanded={expanded}
                        onClick={() => setExpandedKind(expanded ? null : row.kind)}
                      >
                        <span className="row row-3">
                          <span
                            className="mono strong-text"
                            style={{ fontSize: "var(--text-md)", minWidth: 36, textAlign: "right" }}
                          >
                            {row.count}
                          </span>
                          <span>{row.label}</span>
                        </span>
                        <span aria-hidden="true" className="muted">
                          {expanded ? "-" : "+"}
                        </span>
                      </button>
                      {expanded ? (
                        <ul
                          className="stack stack-2"
                          style={{
                            padding: "var(--space-3) var(--space-4)",
                            borderTop: "1px solid var(--border-1)",
                          }}
                        >
                          {matching.map((action) => (
                            <li key={action.id} className="stack stack-1">
                              <div className="row row-2 row-wrap">
                                <span className="mono meta">{action.performedAtMoment}</span>
                                <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                                  {action.targetLabel}
                                </span>
                              </div>
                              <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                                {action.description}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="dialog-foot">
              <span className="meta grow">
                {counts.actions.length} recorded actions in total for this role at this point in the
                day.
              </span>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ==========================================================================
   Reset
   ========================================================================== */

export function ResetButton({ language }: { language: Language }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const reset = () => {
    start(async () => {
      const result = await actionResetScenario();
      setMessage(result.message);
      setConfirming(false);
      router.refresh();
    });
  };

  if (confirming) {
    return (
      <span className="row row-2">
        <span className="meta">Discard all decisions from this run?</span>
        <button type="button" className="btn btn-sm btn-danger" onClick={reset} disabled={pending}>
          {pending ? "Resetting" : "Yes, reset"}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="row row-2">
      {message ? <span className="meta">{message}</span> : null}
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(true)}>
        {t(ACTION_LABELS, "reset", language)}
      </button>
    </span>
  );
}
