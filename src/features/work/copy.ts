/**
 * Copy for the Work Hub shell and its shared modules.
 *
 * Every string has an English and a German form, in the `{ en, de }` pattern
 * the V3 surface uses, and the German is ASCII transliteration only: `ae`,
 * `oe`, `ue`, `ss`. That is the repository's rule for interface copy, seed
 * data and fixtures alike.
 *
 * What is NOT here is anything a role calls its work. Meeting types, agenda
 * labels, action kinds, inbox classifications, related object types and the
 * professional verbs live in `roles/`, because the acceptance criterion is
 * that role copy is not embedded in the shared renderer. This file holds the
 * words every role shares: tab names, empty states, field labels.
 */

import type { Language } from "@/i18n/labels";

export interface Pair {
  en: string;
  de: string;
}

export function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/** Fills `{name}` placeholders. Unknown placeholders are left visible rather than blanked. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    values[key] === undefined ? match : String(values[key]),
  );
}

export const TAB_LABELS = {
  agenda: { en: "Agenda", de: "Agenda" },
  meetings: { en: "Meetings", de: "Besprechungen" },
  actions: { en: "Actions", de: "Massnahmen" },
  inbox: { en: "Inbox", de: "Posteingang" },
} as const satisfies Record<string, Pair>;

export const KIND_LABELS = {
  event: { en: "Agenda entry", de: "Agendaeintrag" },
  meeting: { en: "Meeting", de: "Besprechung" },
  action: { en: "Action", de: "Massnahme" },
  message: { en: "Message", de: "Nachricht" },
} as const satisfies Record<string, Pair>;

export const COPY = {
  pageTitle: { en: "Work", de: "Arbeit" },
  tabsLabel: { en: "Work views", de: "Arbeitsbereiche" },
  queueLabel: { en: "Queue", de: "Liste" },
  savedViews: { en: "Saved views", de: "Gespeicherte Ansichten" },
  filters: { en: "Filter", de: "Filter" },
  allKinds: { en: "All", de: "Alle" },
  objectFilter: { en: "Showing work linked to {object}", de: "Arbeit zu {object}" },
  clearFilter: { en: "Show all", de: "Alle anzeigen" },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  regulatory: {
    en: "Illustrative regulatory context, not legal advice",
    de: "Illustrativer regulatorischer Kontext, keine Rechtsberatung",
  },

  /* Detail pane */
  detailLabel: { en: "Selected item", de: "Ausgewaehlter Eintrag" },
  nothingSelectedTitle: { en: "Select an item from the list", de: "Waehlen Sie einen Eintrag aus der Liste" },
  nothingSelectedBody: {
    en: "Its context, evidence, related work and history open here, and the AI Partner follows the selection.",
    de: "Kontext, Nachweise, verbundene Arbeit und Verlauf erscheinen hier, und der KI Partner folgt der Auswahl.",
  },
  selectedElsewhere: { en: "Selected in {tab}", de: "Ausgewaehlt in {tab}" },
  openInTab: { en: "Open in {tab}", de: "In {tab} oeffnen" },
  close: { en: "Close", de: "Schliessen" },
  clearSelection: { en: "Clear selection", de: "Auswahl aufheben" },
  context: { en: "Context", de: "Kontext" },
  evidence: { en: "Evidence", de: "Nachweise" },
  relatedWork: { en: "Related work", de: "Verbundene Arbeit" },
  activity: { en: "Activity", de: "Verlauf" },
  audit: { en: "Audit", de: "Revision" },
  noEvidence: { en: "No evidence is linked to this item.", de: "Mit diesem Eintrag sind keine Nachweise verknuepft." },
  noRelated: {
    en: "Nothing else in the product is linked to this item yet.",
    de: "Mit diesem Eintrag ist noch nichts anderes verknuepft.",
  },
  noActivity: { en: "No activity is recorded for this item.", de: "Fuer diesen Eintrag ist kein Verlauf erfasst." },
  noAudit: {
    en: "No audit events are recorded against this item yet.",
    de: "Fuer diesen Eintrag sind noch keine Revisionsereignisse erfasst.",
  },
  openEvidence: { en: "Open evidence", de: "Nachweise oeffnen" },
  openAudit: { en: "Open audit", de: "Revision oeffnen" },
  stale: { en: "Stale", de: "Veraltet" },
  refused: { en: "Refused by the gate", de: "Von der Befugnispruefung verweigert" },
  selectedInWork: { en: "Selected in Work", de: "In Arbeit ausgewaehlt" },
  openInWork: { en: "Open in Work", de: "In Arbeit oeffnen" },
  aiContext: { en: "AI Partner context", de: "Kontext des KI Partners" },

  /* Related link labels */
  relatedProcess: { en: "Related process", de: "Verbundener Prozess" },
  relatedDecision: { en: "Related decision", de: "Verbundene Entscheidung" },
  relatedMeeting: { en: "Related meeting", de: "Verbundene Besprechung" },
  relatedAction: { en: "Related action", de: "Verbundene Massnahme" },
  sourceMessage: { en: "Source message", de: "Ausgangsnachricht" },
  relatedObject: { en: "Linked object", de: "Verknuepftes Objekt" },
  allWorkOnObject: { en: "All work on {object}", de: "Alle Arbeit zu {object}" },

  /* Source freshness */
  freshnessSimulated: { en: "Simulated", de: "Simuliert" },
  freshnessDetail: {
    en: "{count} source records from {systems}, synthetic data",
    de: "{count} Quelldatensaetze aus {systems}, synthetische Daten",
  },
  freshnessStale: {
    en: "{count} source records from {systems}, {stale} stale",
    de: "{count} Quelldatensaetze aus {systems}, {stale} veraltet",
  },
  freshnessNone: { en: "Recorded in the work layer", de: "In der Arbeitsebene erfasst" },
  freshnessNoneDetail: {
    en: "No source document is attached, synthetic data",
    de: "Kein Quelldokument angehaengt, synthetische Daten",
  },

  /* Shared status words */
  statusOpen: { en: "Open", de: "Offen" },
  statusInProgress: { en: "In progress", de: "In Bearbeitung" },
  statusCompleted: { en: "Completed", de: "Abgeschlossen" },
  statusOverdue: { en: "Overdue", de: "Ueberfaellig" },
  statusBlocked: { en: "Blocked", de: "Blockiert" },
  statusCancelled: { en: "Cancelled", de: "Storniert" },

  /* Shared facts */
  factReference: { en: "Reference", de: "Referenz" },
  factOwner: { en: "Accountable owner", de: "Verantwortlich" },
  factDue: { en: "Due", de: "Faellig" },
  factWhen: { en: "When", de: "Wann" },
  factWhere: { en: "Where", de: "Wo" },
  factParticipants: { en: "Participants", de: "Teilnehmende" },
  factSource: { en: "Source", de: "Quelle" },
  factFrom: { en: "From", de: "Von" },
  factReceived: { en: "Received", de: "Eingegangen" },
  factRespondBy: { en: "Respond by", de: "Antwort bis" },
  factEntity: { en: "Entity", de: "Gesellschaft" },

  /* AI attribution */
  aiProposal: { en: "AI proposal", de: "KI-Vorschlag" },
  aiPrepared: { en: "What AI prepared", de: "Was die KI vorbereitet hat" },
  personDecides: { en: "What you decide", de: "Was Sie entscheiden" },
  willChange: { en: "What will change", de: "Was sich aendert" },
  approvalRequired: { en: "What approval is required", de: "Welche Genehmigung erforderlich ist" },
  proposalOnly: { en: "Proposal only. Nothing has changed.", de: "Nur ein Vorschlag. Nichts wurde geaendert." },
} as const satisfies Record<string, Pair>;

/** Day names for the week view, Monday first. */
export const WEEKDAYS: readonly Pair[] = [
  { en: "Monday", de: "Montag" },
  { en: "Tuesday", de: "Dienstag" },
  { en: "Wednesday", de: "Mittwoch" },
  { en: "Thursday", de: "Donnerstag" },
  { en: "Friday", de: "Freitag" },
  { en: "Saturday", de: "Samstag" },
  { en: "Sunday", de: "Sonntag" },
];
