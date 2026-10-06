/**
 * The words of Updates, in both languages. German uses ASCII transliteration.
 */

import type { Language } from "@/i18n/labels";
import type { UpdateCategory } from "./types";

export interface Pair {
  en: string;
  de: string;
}

export function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export const CATEGORY_LABELS: Record<UpdateCategory, Pair> = {
  "execution-failed": { en: "Execution failed", de: "Ausfuehrung fehlgeschlagen" },
  "process-blocked": { en: "Process blocked", de: "Prozess blockiert" },
  "human-input-required": { en: "Your input is needed", de: "Ihre Eingabe ist erforderlich" },
  "deadline-approaching": { en: "Deadline", de: "Frist" },
  "material-change": { en: "Material change", de: "Wesentliche Aenderung" },
  "routine-created-work": { en: "New work from a routine", de: "Neue Arbeit aus einer Routine" },
};

/** The title of each kind of update. `{stage}`, `{title}` and `{date}` are filled from the data. */
export const UPDATE_TITLES = {
  taskNeeded: { en: "Input needed in {stage}", de: "Eingabe erforderlich in {stage}" },
  decisionNeeded: { en: "Decision needed: {title}", de: "Entscheidung erforderlich: {title}" },
  stageDecisionNeeded: { en: "Decision needed in {stage}", de: "Entscheidung erforderlich in {stage}" },
  approvalNeeded: { en: "Approval needed in {stage}", de: "Genehmigung erforderlich in {stage}" },
  preparationWaitsForYou: {
    en: "Preparation of {stage} waits for you to start it",
    de: "Die Vorbereitung von {stage} wartet auf Ihren Start",
  },
  preparationWaitsForSource: {
    en: "Preparation of {stage} is waiting for a required source",
    de: "Die Vorbereitung von {stage} wartet auf eine erforderliche Quelle",
  },
  stageNotExecutable: {
    en: "{stage} is open but cannot be completed in this release",
    de: "{stage} ist geoeffnet, kann in diesem Release aber nicht abgeschlossen werden",
  },
  preparationFailed: { en: "Preparation of {stage} failed", de: "Die Vorbereitung von {stage} ist fehlgeschlagen" },
  toolFailed: { en: "A change in {stage} was not executed", de: "Eine Aenderung in {stage} wurde nicht ausgefuehrt" },
  sourceChanged: { en: "A source of {stage} changed", de: "Eine Quelle von {stage} hat sich geaendert" },
  dueToday: { en: "Due today: {title}", de: "Heute faellig: {title}" },
  dueTomorrow: { en: "Due tomorrow: {title}", de: "Morgen faellig: {title}" },
  overdue: { en: "Overdue since {date}: {title}", de: "Ueberfaellig seit {date}: {title}" },
  routineWork: { en: "Prepared for you: {title}", de: "Fuer Sie vorbereitet: {title}" },
} as const satisfies Record<string, Pair>;

export const UPDATES_COPY = {
  title: { en: "Updates", de: "Aktualisierungen" },
  close: { en: "Close", de: "Schliessen" },
  open: { en: "Open", de: "Oeffnen" },
  markRead: { en: "Mark as read", de: "Als gelesen markieren" },
  emptyTitle: { en: "Nothing material needs you", de: "Nichts Wesentliches erfordert Sie" },
  emptyBody: {
    en: "Updates lists failed executions, blocked processes, input you are asked for, deadlines, material changes and new work from routines. None is open now.",
    de: "Aktualisierungen zeigt fehlgeschlagene Ausfuehrungen, blockierte Prozesse, angeforderte Eingaben, Fristen, wesentliche Aenderungen und neue Arbeit aus Routinen. Derzeit ist nichts offen.",
  },
  unavailable: {
    en: "Updates are unavailable: the event history could not be read. The rest of the workspace is unaffected.",
    de: "Aktualisierungen sind nicht verfuegbar: der Ereignisverlauf konnte nicht gelesen werden. Der uebrige Arbeitsbereich ist nicht betroffen.",
  },
  loading: { en: "Reading updates", de: "Aktualisierungen werden gelesen" },
  retry: { en: "Try again", de: "Erneut versuchen" },
  heldBack: {
    en: "{count} more held back by the notification budget",
    de: "{count} weitere durch das Benachrichtigungsbudget zurueckgehalten",
  },
  budgetNote: {
    en: "At most {total} updates are raised at once, {perCategory} per kind. The rest wait here, in priority order.",
    de: "Hoechstens {total} Aktualisierungen werden gleichzeitig angezeigt, {perCategory} je Art. Die uebrigen warten hier, nach Prioritaet geordnet.",
  },
  stateNote: {
    en: "Input, decisions, approvals and deadlines stay listed until the work is done.",
    de: "Eingaben, Entscheidungen, Genehmigungen und Fristen bleiben gelistet, bis die Arbeit erledigt ist.",
  },
  count: { en: "{count} updates", de: "{count} Aktualisierungen" },
  countOne: { en: "1 update", de: "1 Aktualisierung" },
  none: { en: "No updates need you", de: "Keine Aktualisierung erfordert Sie" },
  review: { en: "Review {count} updates", de: "{count} Aktualisierungen pruefen" },
  reviewOne: { en: "Review 1 update", de: "1 Aktualisierung pruefen" },
} as const satisfies Record<string, Pair>;

/** "3 updates", "1 update". */
export function countLabel(count: number, language: Language): string {
  return count === 1 ? say(UPDATES_COPY.countOne, language) : fill(say(UPDATES_COPY.count, language), { count });
}
