/**
 * StageWorkspace -- rich stage workspace for role-app process pages.
 *
 * Server-rendered. Shows the full working context for a single process stage:
 * AI preparation output, the human task that must be done, any artifacts
 * already produced, recent audit events, and the action slot (form or status).
 *
 * Status badge colour tokens:
 *   completed       -- wd-success
 *   in-progress     -- wd-accent
 *   waiting-for-input -- wd-warning (amber)
 *   locked          -- wd-text-disabled
 *   ready           -- wd-text-muted
 *
 * No em dashes. No umlauts. No Tailwind. Server component.
 */

import type { RoleProcessStage } from "@/role-apps/contracts";
import type { Language } from "@/i18n/labels";

export type StageStatusKind =
  | "completed"
  | "in-progress"
  | "waiting-for-input"
  | "locked"
  | "ready";

export interface StageArtifact {
  label: string;
  content: string;
}

export interface StageEvent {
  eventKind: string;
  at: string;
  actorKind: string;
}

export interface StageWorkspaceProps {
  stage: RoleProcessStage;
  stageStatus: StageStatusKind;
  aiPreparation: string;
  humanTask: string;
  artifacts: StageArtifact[];
  recentEvents: StageEvent[];
  actionForm?: React.ReactNode;
  language: Language;
}

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: "var(--wd-text-xs)",
    fontWeight: "var(--wd-weight-medium)" as unknown as number,
    color: "var(--wd-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "var(--wd-2)",
  };
}

function formatTimestamp(iso: string): string {
  // Deterministic short format: "2026-10-01 08:00"
  if (iso.length >= 16) {
    return iso.slice(0, 10) + " " + iso.slice(11, 16);
  }
  return iso;
}

function formatEventKind(kind: string): string {
  return kind.replace(/-/g, " ");
}

interface BadgeStyle {
  background: string;
  color: string;
  border: string;
}

function statusBadgeStyle(status: StageStatusKind): BadgeStyle {
  switch (status) {
    case "completed":
      return {
        background: "var(--wd-success-soft)",
        color: "var(--wd-success)",
        border: "1px solid var(--wd-success-soft)",
      };
    case "in-progress":
      return {
        background: "var(--wd-accent-soft)",
        color: "var(--wd-accent)",
        border: "1px solid var(--wd-accent-border)",
      };
    case "waiting-for-input":
      return {
        background: "var(--wd-warning-soft, color-mix(in srgb, var(--wd-accent-soft) 60%, transparent))",
        color: "var(--wd-warning, var(--wd-accent))",
        border: "1px solid var(--wd-warning-border, var(--wd-accent-border))",
      };
    case "ready":
      return {
        background: "var(--wd-surface-subtle)",
        color: "var(--wd-text-muted)",
        border: "1px solid var(--wd-border)",
      };
    case "locked":
    default:
      return {
        background: "var(--wd-surface-subtle)",
        color: "var(--wd-text-disabled)",
        border: "1px solid var(--wd-border)",
      };
  }
}

function statusLabel(status: StageStatusKind, language: Language): string {
  const labels: Record<StageStatusKind, { en: string; de: string }> = {
    completed: { en: "Completed", de: "Abgeschlossen" },
    "in-progress": { en: "In Progress", de: "In Bearbeitung" },
    "waiting-for-input": { en: "Waiting for input", de: "Eingabe erforderlich" },
    ready: { en: "Ready", de: "Bereit" },
    locked: { en: "Locked", de: "Gesperrt" },
  };
  const pair = labels[status] ?? labels.locked;
  return pick(pair, language);
}

const COPY = {
  aiPrepared: { en: "AI prepared", de: "KI vorbereitet" },
  yourTask: { en: "Your task", de: "Ihre Aufgabe" },
  artifacts: { en: "Artifacts", de: "Artefakte" },
  recentEvents: { en: "Recent events", de: "Letzte Ereignisse" },
  noEvents: { en: "No events recorded yet.", de: "Noch keine Ereignisse erfasst." },
  stageCompleted: {
    en: "This stage has been completed.",
    de: "Dieser Schritt wurde abgeschlossen.",
  },
  stageLocked: {
    en: "This stage is locked. Complete the preceding stage to unlock it.",
    de: "Dieser Schritt ist gesperrt. Schliessen Sie den vorherigen Schritt ab, um ihn freizuschalten.",
  },
  actorAi: { en: "AI", de: "KI" },
  actorHuman: { en: "Human", de: "Manuell" },
  actorSystem: { en: "System", de: "System" },
} as const;

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

export function StageWorkspace({
  stage,
  stageStatus,
  aiPreparation,
  humanTask,
  artifacts,
  recentEvents,
  actionForm,
  language,
}: StageWorkspaceProps) {
  const stageName = language === "de" ? stage.nameDe : stage.name;
  const badge = statusBadgeStyle(stageStatus);
  const isLocked = stageStatus === "locked";
  const isCompleted = stageStatus === "completed";
  const isActive = stageStatus === "in-progress" || stageStatus === "waiting-for-input";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--wd-6)",
      }}
    >
      {/* Stage heading + status badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--wd-4)",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            fontSize: "var(--wd-text-xl)",
            fontWeight: "var(--wd-weight-strong)" as unknown as number,
            color: isLocked ? "var(--wd-text-disabled)" : "var(--wd-text)",
            lineHeight: "var(--wd-leading-tight)",
            margin: 0,
          }}
        >
          {stageName}
        </h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px var(--wd-3)",
            borderRadius: "var(--wd-radius-pill)",
            fontSize: "var(--wd-text-xs)",
            fontWeight: "var(--wd-weight-medium)" as unknown as number,
            whiteSpace: "nowrap",
            flexShrink: 0,
            ...badge,
          }}
        >
          {statusLabel(stageStatus, language)}
        </span>
      </div>

      {/* Locked state -- short message only */}
      {isLocked ? (
        <p
          style={{
            fontSize: "var(--wd-text-sm)",
            color: "var(--wd-text-disabled)",
            margin: 0,
          }}
        >
          {pick(COPY.stageLocked, language)}
        </p>
      ) : (
        <>
          {/* AI preparation section */}
          <div>
            <span style={labelStyle()}>{pick(COPY.aiPrepared, language)}</span>
            <div
              style={{
                padding: "var(--wd-4)",
                background: "var(--wd-accent-soft)",
                border: "1px solid var(--wd-accent-border)",
                borderRadius: "var(--wd-radius)",
                fontSize: "var(--wd-text-sm)",
                color: "var(--wd-text-secondary)",
                lineHeight: "var(--wd-leading-normal)",
              }}
            >
              {aiPreparation}
            </div>
          </div>

          {/* Human task section -- hidden for completed stages */}
          {!isCompleted && humanTask.length > 0 ? (
            <div>
              <span style={labelStyle()}>{pick(COPY.yourTask, language)}</span>
              <div
                style={{
                  padding: "var(--wd-4)",
                  background: isActive ? "var(--wd-surface)" : "var(--wd-surface-subtle)",
                  border: isActive
                    ? "1.5px solid var(--wd-accent-border)"
                    : "1px solid var(--wd-border)",
                  borderRadius: "var(--wd-radius)",
                  fontSize: "var(--wd-text-base)",
                  fontWeight: isActive
                    ? ("var(--wd-weight-medium)" as unknown as number)
                    : undefined,
                  color: "var(--wd-text)",
                  lineHeight: "var(--wd-leading-snug)",
                }}
              >
                {humanTask}
              </div>
            </div>
          ) : null}

          {/* Completed notice */}
          {isCompleted ? (
            <p
              style={{
                fontSize: "var(--wd-text-sm)",
                color: "var(--wd-success)",
                margin: 0,
              }}
            >
              {pick(COPY.stageCompleted, language)}
            </p>
          ) : null}

          {/* Artifacts section */}
          {artifacts.length > 0 ? (
            <div>
              <span style={labelStyle()}>{pick(COPY.artifacts, language)}</span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--wd-2)",
                }}
              >
                {artifacts.map((artifact, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "var(--wd-3) var(--wd-4)",
                      background: "var(--wd-surface-subtle)",
                      border: "1px solid var(--wd-border)",
                      borderRadius: "var(--wd-radius)",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--wd-text-xs)",
                        fontWeight: "var(--wd-weight-medium)" as unknown as number,
                        color: "var(--wd-text-muted)",
                        marginBottom: "var(--wd-1)",
                      }}
                    >
                      {artifact.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--wd-text-sm)",
                        color: "var(--wd-text-secondary)",
                        lineHeight: "var(--wd-leading-normal)",
                      }}
                    >
                      {artifact.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Action slot */}
          {actionForm != null ? actionForm : null}
        </>
      )}

      {/* Recent events -- always shown (compact, collapsible via details) */}
      <details
        style={{
          borderTop: "1px solid var(--wd-border)",
          paddingTop: "var(--wd-4)",
        }}
      >
        <summary
          style={{
            fontSize: "var(--wd-text-xs)",
            fontWeight: "var(--wd-weight-medium)" as unknown as number,
            color: "var(--wd-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            cursor: "pointer",
            userSelect: "none",
            listStyle: "none",
          }}
        >
          {pick(COPY.recentEvents, language)}
          {recentEvents.length > 0 ? ` (${recentEvents.length})` : ""}
        </summary>
        <div style={{ marginTop: "var(--wd-3)" }}>
          {recentEvents.length === 0 ? (
            <p
              style={{
                fontSize: "var(--wd-text-sm)",
                color: "var(--wd-text-disabled)",
                margin: 0,
              }}
            >
              {pick(COPY.noEvents, language)}
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--wd-2)",
              }}
            >
              {recentEvents.map((ev, i) => {
                const actorLabel =
                  ev.actorKind === "ai"
                    ? pick(COPY.actorAi, language)
                    : ev.actorKind === "human"
                    ? pick(COPY.actorHuman, language)
                    : pick(COPY.actorSystem, language);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "var(--wd-4)",
                      fontSize: "var(--wd-text-xs)",
                      color: "var(--wd-text-secondary)",
                      padding: "var(--wd-2) var(--wd-3)",
                      background: "var(--wd-surface-subtle)",
                      borderRadius: "var(--wd-radius)",
                    }}
                  >
                    <span>
                      <span
                        style={{
                          fontWeight: "var(--wd-weight-medium)" as unknown as number,
                          color: "var(--wd-text)",
                          marginRight: "var(--wd-2)",
                        }}
                      >
                        {formatEventKind(ev.eventKind)}
                      </span>
                      <span style={{ color: "var(--wd-text-muted)" }}>
                        {actorLabel}
                      </span>
                    </span>
                    <span
                      style={{
                        color: "var(--wd-text-disabled)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {formatTimestamp(ev.at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
