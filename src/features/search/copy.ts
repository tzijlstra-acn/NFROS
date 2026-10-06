/**
 * The words of global search and the command palette, in both languages.
 *
 * Professional object names, not table names: an analyst searches for
 * "Controls" and "Minutes", never for `controls` or `meeting_minutes`. German
 * uses ASCII transliteration only.
 */

import type { Language } from "@/i18n/labels";
import type { PaletteCommandId, SearchKind } from "./types";

export interface Pair {
  en: string;
  de: string;
}

export function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/** Replaces `{name}` placeholders. A missing value leaves the braces, so a gap is visible. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** The group heading of each object type. */
export const KIND_LABELS: Record<SearchKind, Pair> = {
  risk: { en: "Risks", de: "Risiken" },
  control: { en: "Controls", de: "Kontrollen" },
  assessment: { en: "Assessments", de: "Bewertungen" },
  supplier: { en: "Suppliers", de: "Dienstleister" },
  service: { en: "Services", de: "Dienste" },
  contract: { en: "Contracts", de: "Vertraege" },
  evidence: { en: "Evidence", de: "Nachweise" },
  meeting: { en: "Meetings", de: "Besprechungen" },
  minutes: { en: "Minutes", de: "Protokolle" },
  action: { en: "Actions", de: "Massnahmen" },
  decision: { en: "Decisions", de: "Entscheidungen" },
  "process-run": { en: "Processes", de: "Prozesse" },
  message: { en: "Messages", de: "Nachrichten" },
};

/** The singular, for the kind filter chip and a result's accessible name. */
export const KIND_SINGULAR: Record<SearchKind, Pair> = {
  risk: { en: "Risk", de: "Risiko" },
  control: { en: "Control", de: "Kontrolle" },
  assessment: { en: "Assessment", de: "Bewertung" },
  supplier: { en: "Supplier", de: "Dienstleister" },
  service: { en: "Service", de: "Dienst" },
  contract: { en: "Contract", de: "Vertrag" },
  evidence: { en: "Evidence", de: "Nachweis" },
  meeting: { en: "Meeting", de: "Besprechung" },
  minutes: { en: "Minutes", de: "Protokoll" },
  action: { en: "Action", de: "Massnahme" },
  decision: { en: "Decision", de: "Entscheidung" },
  "process-run": { en: "Process", de: "Prozess" },
  message: { en: "Message", de: "Nachricht" },
};

export const COMMAND_LABELS: Record<PaletteCommandId, Pair> = {
  "open-current-work": { en: "Open current work", de: "Aktuelle Arbeit oeffnen" },
  "open-next-meeting": { en: "Open next meeting", de: "Naechste Besprechung oeffnen" },
  "find-supplier": { en: "Find supplier", de: "Dienstleister finden" },
  "find-control": { en: "Find control", de: "Kontrolle finden" },
  "open-current-process": { en: "Open current process", de: "Aktuellen Prozess oeffnen" },
  "review-decisions": { en: "Review decisions", de: "Entscheidungen pruefen" },
  "ask-ai": { en: "Ask AI", de: "KI fragen" },
  "open-evidence": { en: "Open evidence", de: "Nachweise oeffnen" },
};

/** Words that find a command without being shown, in both languages. */
export const COMMAND_KEYWORDS: Record<PaletteCommandId, string> = {
  "open-current-work": "work arbeit agenda actions massnahmen inbox posteingang",
  "open-next-meeting": "meeting besprechung calendar kalender next naechste",
  "find-supplier": "supplier dienstleister third party drittanbieter vendor",
  "find-control": "control kontrolle",
  "open-current-process": "process prozess stage stufe",
  "review-decisions": "decision entscheidung queue",
  "ask-ai": "ai ki partner chat question frage",
  "open-evidence": "evidence nachweis document dokument",
};

export const SEARCH_COPY = {
  dialog: { en: "Search and commands", de: "Suche und Befehle" },
  placeholder: {
    en: "Search work, records, evidence, meetings and actions",
    de: "Arbeit, Datensaetze, Nachweise, Besprechungen und Massnahmen suchen",
  },
  placeholderKind: { en: "Search {kind}", de: "{kind} suchen" },
  commands: { en: "Commands", de: "Befehle" },
  recent: { en: "Recent", de: "Zuletzt geoeffnet" },
  pinned: { en: "Pinned", de: "Angeheftet" },
  storedNote: {
    en: "Recent and pinned items are kept in this browser only.",
    de: "Zuletzt geoeffnete und angeheftete Eintraege werden nur in diesem Browser gespeichert.",
  },
  scope: {
    en: "Searching {role} work and records for {entity}.",
    de: "Suche in Arbeit und Datensaetzen von {role} fuer {entity}.",
  },
  scopeNoEntity: { en: "Searching {role} work and records.", de: "Suche in Arbeit und Datensaetzen von {role}." },
  noMatch: { en: "Nothing in scope matches {query}.", de: "Nichts im Suchbereich passt zu {query}." },
  noneOfKind: { en: "No {kind} in scope.", de: "Keine Eintraege vom Typ {kind} im Suchbereich." },
  more: { en: "{count} more", de: "{count} weitere" },
  loading: { en: "Reading the search scope", de: "Suchbereich wird gelesen" },
  unavailable: {
    en: "Search is unavailable. The rest of the workspace is unaffected.",
    de: "Die Suche ist nicht verfuegbar. Der uebrige Arbeitsbereich ist nicht betroffen.",
  },
  retry: { en: "Try again", de: "Erneut versuchen" },
  clearKind: { en: "Search everything", de: "Alles durchsuchen" },
  pin: { en: "Pin {label}", de: "{label} anheften" },
  unpin: { en: "Unpin {label}", de: "{label} loesen" },
  hint: {
    en: "Arrow keys to move, Enter to open, Escape to close",
    de: "Pfeiltasten zum Bewegen, Eingabe zum Oeffnen, Escape zum Schliessen",
  },
  results: { en: "{count} results", de: "{count} Treffer" },
  close: { en: "Close search", de: "Suche schliessen" },
  evidenceFor: { en: "Evidence for {title}", de: "Nachweise zu {title}" },
} as const satisfies Record<string, Pair>;

/** Why a command has nothing to open. */
export const COMMAND_UNAVAILABLE = {
  noMeeting: { en: "No meeting scheduled today", de: "Heute ist keine Besprechung geplant" },
  noFurtherMeeting: { en: "No further meeting today", de: "Heute keine weitere Besprechung" },
  noProcess: { en: "No active process", de: "Kein aktiver Prozess" },
} as const satisfies Record<string, Pair>;

export const COMMAND_DETAIL = {
  work: { en: "Agenda, meetings, actions and inbox", de: "Agenda, Besprechungen, Massnahmen und Posteingang" },
  decisionsOpen: { en: "{count} open", de: "{count} offen" },
  decisionsNone: { en: "Nothing open", de: "Nichts offen" },
  ask: { en: "Opens the AI Partner conversation", de: "Oeffnet das Gespraech mit dem KI Partner" },
  evidence: {
    en: "Evidence for the selected item, or search the documents in scope",
    de: "Nachweise zum gewaehlten Eintrag, oder die Dokumente im Suchbereich durchsuchen",
  },
  findSupplier: { en: "Search the suppliers in scope", de: "Dienstleister im Suchbereich suchen" },
  findControl: { en: "Search the controls in scope", de: "Kontrollen im Suchbereich suchen" },
} as const satisfies Record<string, Pair>;
