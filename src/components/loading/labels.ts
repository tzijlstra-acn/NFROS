/**
 * Bilingual label dictionary for the loading and progressive population layer.
 *
 * Every string here describes an observable processing step only. Nothing
 * names a vendor, a provider or a model. The test suite asserts this against
 * every entry in this file.
 *
 * German: ASCII transliteration only (ae, oe, ue, ss). No umlaut characters.
 * The same encoding constraint applies here as in src/i18n/labels.ts.
 */

import type { Language } from "@/i18n/labels";

export type Bilingual = { en: string; de: string };

/** Picks the correct side of a bilingual pair. Mirrors pick() in contracts. */
export function pickLabel(pair: Bilingual, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/**
 * The six data-source loading stages named in the brief.
 *
 * Ordered to match the natural sequence of a risk view load: assessment first,
 * then evidence, then actions and reconciliation, then the derived view. The
 * text describes what the application is doing with known systems, not what an
 * inference engine is doing internally.
 */
export const DATA_SOURCE_STAGE_LABELS: Bilingual[] = [
  { en: "Loading current assessment", de: "Laedt aktuelle Bewertung" },
  { en: "Refreshing control evidence", de: "Aktualisiert Kontrollnachweise" },
  { en: "Checking process telemetry", de: "Prueft Prozesstelemetrie" },
  { en: "Retrieving open actions", de: "Ruft offene Massnahmen ab" },
  { en: "Reconciling source records", de: "Gleicht Quelldatensaetze ab" },
  { en: "Preparing the risk view", de: "Bereitet Risikoansicht vor" },
];

/**
 * Named region variants for DataSkeleton.
 *
 * Each variant maps to a skeleton that reserves the exact dimensions of the
 * real content it stands in for, preventing layout shift on population.
 */
export type SkeletonVariant =
  | "focus-queue"
  | "inbox"
  | "calendar"
  | "work-object"
  | "evidence"
  | "live-events"
  | "ai-activity"
  | "decisions"
  | "execution-receipts";

/** Labels used by ConnectionState. */
export const CONNECTION_LABELS = {
  sourceUnavailable: {
    en: "Source unavailable",
    de: "Quelle nicht verfuegbar",
  },
  mandatorySourceUnavailable: {
    en: "A required source is unavailable. Showing last known state.",
    de: "Eine erforderliche Quelle ist nicht verfuegbar. Zeigt letzten bekannten Stand.",
  },
  retry: { en: "Retry", de: "Erneut versuchen" },
  readOnlyFallback: {
    en: "Read-only view. Changes are queued until the source reconnects.",
    de: "Schreibgeschuetzte Ansicht. Aenderungen werden bis zur Wiederverbindung gespeichert.",
  },
  lastUpdated: { en: "Last updated", de: "Zuletzt aktualisiert" },
  queuedForExecution: {
    en: "Action queued. Will run when the source is available.",
    de: "Aktion gespeichert. Wird ausgefuehrt, wenn die Quelle erreichbar ist.",
  },
  constrainedView: {
    en: "Showing a constrained view based on available sources.",
    de: "Zeigt eingeschraenkte Ansicht basierend auf verfuegbaren Quellen.",
  },
} as const satisfies Record<string, Bilingual>;

/** Labels used by StaleDataNotice. */
export const STALE_LABELS = {
  showing: {
    en: "Showing last known state",
    de: "Zeigt letzten bekannten Stand",
  },
  continueWithStale: {
    en: "Continue with this data",
    de: "Mit diesen Daten fortfahren",
  },
  staleWarning: {
    en: "This data may not reflect current state. Verify before acting.",
    de: "Diese Daten spiegeln moeglicherweise nicht den aktuellen Stand wider. Vor Handlung pruefen.",
  },
} as const satisfies Record<string, Bilingual>;

/** Labels used by AIGenerationCard. */
export const AI_CARD_LABELS = {
  /**
   * The card header. Named "AI Partner" to match the partner pane identity,
   * never a model or vendor name.
   */
  header: { en: "AI Partner", de: "KI-Partner" },
  /**
   * Shown with a check once the queued stage completes, confirming role
   * and object context were resolved from deterministic sources.
   */
  contextLoaded: { en: "Role and work object loaded", de: "Rolle und Arbeitsobjekt geladen" },
  /**
   * Shown when a required source is not yet available. The card operates in
   * a constrained mode: it shows which source is outstanding and does not
   * imply a recommendation is imminent.
   */
  constrained: {
    en: "Operating with limited sources",
    de: "Arbeitet mit eingeschraenkten Quellen",
  },
  /** Precedes the name of an outstanding source in the constrained notice. */
  waitingFor: { en: "Waiting for", de: "Wartet auf" },
  /** Announced when processing reaches the ready state. */
  processingComplete: {
    en: "Processing complete",
    de: "Verarbeitung abgeschlossen",
  },
} as const satisfies Record<string, Bilingual>;

/**
 * Builds the "N relevant records identified" label from a real count.
 *
 * Accepts a count parameter rather than fabricating a number, matching the
 * brief requirement that the card shows real counts.
 */
export function recordsIdentifiedLabel(count: number, language: Language): string {
  return language === "de"
    ? `${count} relevante Datensaetze gefunden`
    : `${count} relevant records identified`;
}

/**
 * Builds the polite announcement text for a stage change.
 *
 * The text describes what the application is doing, not what an inference
 * engine is thinking. Screen readers read this politely on change.
 */
export function stageAnnouncementText(stageLabel: string, language: Language): string {
  return language === "de"
    ? `Verarbeitung: ${stageLabel}`
    : `Processing: ${stageLabel}`;
}

/** Labels used by ProgressiveContent. */
export const PROGRESSIVE_LABELS = {
  loadingRegion: { en: "Content loading", de: "Inhalt wird geladen" },
} as const satisfies Record<string, Bilingual>;

/** Labels used by InlineLoadingRow. */
export const INLINE_ROW_LABELS: Bilingual = {
  en: "Loading",
  de: "Laedt",
};

/** Labels used by LoadingStageList. */
export const STAGE_LIST_LABELS = {
  showSources: { en: "Show connected sources", de: "Verbundene Quellen anzeigen" },
  loadingStages: { en: "Loading stages", de: "Ladevorgang" },
} as const satisfies Record<string, Bilingual>;
