/**
 * Bilingual copy for the role signals.
 *
 * Two kinds of string live here, and they are kept together on purpose. The
 * row labels ("Current focus", "Active process", "Next meeting") are the
 * interface. The empty and unavailable sentences are part of the signal
 * itself: a signal with no data says so in words, and those words are a
 * product decision rather than a rendering detail, so the read model returns
 * them and every surface that shows a signal shows the same sentence.
 *
 * German is ASCII transliterated, as everywhere else in the codebase.
 */

import type { Language } from "@/i18n/labels";

export interface Pair {
  en: string;
  de: string;
}

export function pick(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export const ROLE_SIGNAL_LABELS = {
  currentFocus: { en: "Current focus", de: "Aktueller Fokus" },
  activeProcess: { en: "Active process", de: "Aktiver Prozess" },
  nextMeeting: { en: "Next meeting", de: "Naechste Besprechung" },

  /* Honest empty values. Never a fallback, never an invented item. */
  focusEmpty: { en: "Nothing needs your judgment now", de: "Derzeit benoetigt nichts Ihr Urteil" },
  processEmpty: { en: "No active process", de: "Kein aktiver Prozess" },
  meetingNoneScheduled: { en: "No meeting scheduled today", de: "Heute keine Besprechung geplant" },
  meetingNoneRemaining: { en: "No further meeting today", de: "Heute keine weitere Besprechung" },

  /* The database cannot answer at all. Distinct from empty, which is an answer. */
  unavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
  unavailableNotSeeded: {
    en: "Unavailable: the scenario has not been seeded",
    de: "Nicht verfuegbar: das Szenario wurde nicht geladen",
  },
  unavailableReadFailed: {
    en: "Unavailable: the scenario could not be read",
    de: "Nicht verfuegbar: das Szenario konnte nicht gelesen werden",
  },

  /* Process wording. */
  stageOf: { en: "Stage {n} of {total}", de: "Stufe {n} von {total}" },
  runCompleted: { en: "completed", de: "abgeschlossen" },
  runNotStarted: { en: "not started", de: "nicht begonnen" },
  runBlocked: { en: "blocked", de: "blockiert" },
  stageNotRecognised: {
    en: "the recorded stage is not part of the process definition",
    de: "die erfasste Stufe gehoert nicht zur Prozessdefinition",
  },
} as const satisfies Record<string, Pair>;

/**
 * The state of the current stage, in plain words.
 *
 * Mirrors the stage statuses the schema records. A status the map does not
 * know is shown as recorded rather than translated into something it is not.
 */
export const STAGE_STATUS_LABELS: Record<string, Pair> = {
  locked: { en: "Not yet open", de: "Noch nicht geoeffnet" },
  ready: { en: "Ready to start", de: "Bereit zum Start" },
  "ai-preparing": { en: "Being prepared", de: "Wird vorbereitet" },
  "ready-for-review": { en: "Ready for your review", de: "Bereit zu Ihrer Pruefung" },
  "waiting-for-input": { en: "Waiting for your input", de: "Wartet auf Ihre Eingabe" },
  "waiting-for-decision": { en: "Waiting for your decision", de: "Wartet auf Ihre Entscheidung" },
  completed: { en: "Completed", de: "Abgeschlossen" },
  blocked: { en: "Blocked", de: "Blockiert" },
};

/** Replaces `{name}` placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
