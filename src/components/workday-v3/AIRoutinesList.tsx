/**
 * AI Routines list for the Processes page sub-view.
 *
 * Renders the full set of AI routines configured for a role. Each row shows
 * name, trigger type, status, last run time and output kind. The active routine
 * ID is highlighted so the Processes page can link from a morning brief query
 * param to the expanded detail above the list.
 *
 * Server component -- no client state.
 * Synthetic institution and data.
 */

import type { Language } from "@/i18n/labels";

interface RoutineRow {
  id: string;
  name: string;
  triggerType: string;
  status: string;
  lastRunAt: string | null;
  outputKind: string;
}

interface AIRoutinesListProps {
  routines: RoutineRow[];
  language: Language;
  /** Highlight and scroll-target this routine (from the ?routine= query param). */
  activeRoutineId?: string | null;
  /** The role -- used to build the link href for each routine row. */
  roleId: string;
}

const TRIGGER_LABELS: Record<string, { en: string; de: string }> = {
  schedule: { en: "Schedule", de: "Zeitplan" },
  "before-meeting": { en: "Before meeting", de: "Vor Besprechung" },
  "after-meeting": { en: "After meeting", de: "Nach Besprechung" },
  event: { en: "Event", de: "Ereignis" },
};

const STATUS_LABELS: Record<string, { en: string; de: string }> = {
  active: { en: "Active", de: "Aktiv" },
  paused: { en: "Paused", de: "Pausiert" },
  blocked: { en: "Blocked", de: "Blockiert" },
  completed: { en: "Completed", de: "Abgeschlossen" },
};

const STATUS_COLORS: Record<string, string> = {
  active: "var(--wd-success)",
  paused: "var(--wd-warning)",
  blocked: "var(--wd-danger, var(--wd-error, #c0392b))",
  completed: "var(--wd-text-muted)",
};

const OUTPUT_LABELS: Record<string, { en: string; de: string }> = {
  "morning-brief": { en: "Morning brief", de: "Morgenbriefing" },
  "calendar-digest": { en: "Calendar digest", de: "Kalender-Digest" },
  "meeting-preparation": { en: "Meeting preparation", de: "Besprechungsvorbereitung" },
  "alert-digest": { en: "Alert digest", de: "Warnungs-Digest" },
  "freshness-report": { en: "Freshness report", de: "Aktualitaetsbericht" },
  "supplier-alert-digest": { en: "Supplier alert digest", de: "Lieferanten-Warnungs-Digest" },
  "follow-up-digest": { en: "Follow-up digest", de: "Nachverfolgungs-Digest" },
};

const LABELS = {
  name: { en: "Routine", de: "Routine" },
  trigger: { en: "Trigger", de: "Ausloser" },
  status: { en: "Status", de: "Status" },
  lastRun: { en: "Last run", de: "Zuletzt ausgefuhrt" },
  output: { en: "Output", de: "Ausgabe" },
  never: { en: "Never", de: "Nie" },
  view: { en: "View", de: "Ansehen" },
  none: { en: "No routines configured", de: "Keine Routinen konfiguriert" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function formatLastRun(iso: string | null, language: Language): string {
  if (!iso) return pick(LABELS.never, language);
  // Show date and time portion from the ISO string -- static server render.
  const date = iso.slice(0, 10);
  const time = iso.length >= 16 ? iso.slice(11, 16) : "";
  return time ? `${date} ${time}` : date;
}

export function AIRoutinesList({
  routines,
  language,
  activeRoutineId,
  roleId,
}: AIRoutinesListProps) {
  if (routines.length === 0) {
    return (
      <p style={{ fontSize: "var(--wd-text-sm)", color: "var(--wd-text-muted)" }}>
        {pick(LABELS.none, language)}
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--wd-2)",
      }}
    >
      {/* Column header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 90px 140px 160px 72px",
          gap: "var(--wd-3)",
          padding: "var(--wd-1) var(--wd-4)",
          fontSize: "var(--wd-text-xs)",
          fontWeight: 600,
          color: "var(--wd-text-muted)",
          borderBottom: "1px solid var(--wd-border)",
        }}
      >
        <span>{pick(LABELS.name, language)}</span>
        <span>{pick(LABELS.trigger, language)}</span>
        <span>{pick(LABELS.status, language)}</span>
        <span>{pick(LABELS.lastRun, language)}</span>
        <span>{pick(LABELS.output, language)}</span>
        <span />
      </div>

      {routines.map((routine) => {
        const isActive = routine.id === activeRoutineId;
        const triggerLabel =
          TRIGGER_LABELS[routine.triggerType]
            ? pick(TRIGGER_LABELS[routine.triggerType]!, language)
            : routine.triggerType;
        const statusLabel =
          STATUS_LABELS[routine.status]
            ? pick(STATUS_LABELS[routine.status]!, language)
            : routine.status;
        const statusColor = STATUS_COLORS[routine.status] ?? "var(--wd-text-muted)";
        const outputLabel =
          OUTPUT_LABELS[routine.outputKind]
            ? pick(OUTPUT_LABELS[routine.outputKind]!, language)
            : routine.outputKind;

        return (
          <div
            key={routine.id}
            id={`routine-${routine.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 90px 140px 160px 72px",
              gap: "var(--wd-3)",
              alignItems: "center",
              padding: "var(--wd-3) var(--wd-4)",
              background: isActive ? "var(--wd-accent-subtle, var(--wd-surface))" : "var(--wd-surface)",
              border: isActive
                ? "1px solid var(--wd-accent)"
                : "1px solid var(--wd-border)",
              borderRadius: "var(--wd-radius)",
            }}
          >
            <span
              style={{
                fontSize: "var(--wd-text-sm)",
                fontWeight: 500,
                color: "var(--wd-text)",
              }}
            >
              {routine.name}
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: "var(--wd-text-xs)",
                fontWeight: 500,
                color: "var(--wd-text-secondary)",
                padding: "2px var(--wd-2)",
                background: "var(--wd-surface-raised, var(--wd-bg))",
                border: "1px solid var(--wd-border)",
                borderRadius: "var(--wd-radius-sm, 4px)",
              }}
            >
              {triggerLabel}
            </span>

            <span
              style={{
                fontSize: "var(--wd-text-xs)",
                fontWeight: 600,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>

            <span
              style={{
                fontSize: "var(--wd-text-xs)",
                color: "var(--wd-text-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatLastRun(routine.lastRunAt, language)}
            </span>

            <span
              style={{
                fontSize: "var(--wd-text-xs)",
                color: "var(--wd-text-secondary)",
              }}
            >
              {outputLabel}
            </span>

            <a
              href={`/workday/${roleId}/processes?view=routines&routine=${routine.id}`}
              style={{
                fontSize: "var(--wd-text-xs)",
                fontWeight: 500,
                color: "var(--wd-accent)",
                textDecoration: "none",
              }}
            >
              {pick(LABELS.view, language)}
            </a>
          </div>
        );
      })}
    </div>
  );
}
