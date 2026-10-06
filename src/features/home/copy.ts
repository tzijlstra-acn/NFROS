/**
 * Bilingual copy for Home.
 *
 * Two kinds of string live here, as in the role signals. The region labels
 * are the interface. The empty sentences and the statement templates are part
 * of the read model: a region with nothing to report says so in words, and
 * those words are a product decision, so the read model returns them and the
 * component renders whatever it is given.
 *
 * Statement templates take counts and recorded labels only. There is no
 * template here that could produce a sentence about work the database does
 * not contain, because every placeholder is filled from a row.
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

/** Fills `{name}` placeholders. A missing value leaves the placeholder visible, which a test catches. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Picks the singular or the plural template by count. */
export function plural(count: number, one: Pair, many: Pair, language: Language): string {
  return fill(pick(count === 1 ? one : many, language), { n: count });
}

export const HOME_COPY = {
  /* ---- Now ---------------------------------------------------------- */
  whatChanged: { en: "What changed", de: "Was sich geaendert hat" },
  whyItMatters: { en: "Why it matters", de: "Warum es wichtig ist" },
  due: { en: "Due", de: "Faellig" },
  noDueRecorded: { en: "No due time recorded", de: "Keine Frist erfasst" },
  arrived: { en: "arrived {age} ago", de: "eingegangen vor {age}" },
  arrivedJustNow: { en: "just arrived", de: "gerade eingegangen" },

  /* ---- Your day ----------------------------------------------------- */
  yourDay: { en: "Your day", de: "Ihr Tag" },
  openWorkHub: { en: "Open Work Hub", de: "Work Hub oeffnen" },
  nextMeeting: { en: "Next meeting", de: "Naechste Besprechung" },
  openActions: { en: "Open actions", de: "Offene Massnahmen" },
  inbox: { en: "Inbox", de: "Posteingang" },
  meetingNoneScheduled: { en: "No meeting scheduled today", de: "Heute keine Besprechung geplant" },
  meetingNoneRemaining: { en: "No further meeting today", de: "Heute keine weitere Besprechung" },
  noOpenActions: { en: "No open actions", de: "Keine offenen Massnahmen" },
  openCount: { en: "{n} open", de: "{n} offen" },
  overdueCount: { en: "{n} overdue", de: "{n} ueberfaellig" },
  blockedCount: { en: "{n} blocked", de: "{n} blockiert" },
  inboxNoneNeeded: { en: "Nothing needs attention", de: "Nichts benoetigt Aufmerksamkeit" },
  inboxNeedsOne: { en: "1 needs attention", de: "1 benoetigt Aufmerksamkeit" },
  inboxNeedsMany: { en: "{n} need attention", de: "{n} benoetigen Aufmerksamkeit" },
  unavailable: { en: "Unavailable", de: "Nicht verfuegbar" },

  /* ---- Partner update ----------------------------------------------- */
  partnerUpdate: { en: "Partner update", de: "Update vom KI-Partner" },
  partnerEmptyTitle: { en: "Nothing to report yet", de: "Noch nichts zu berichten" },
  partnerEmptyBody: {
    en: "When the AI Partner prepares work, follows something up or turns a message into work, it is listed here with a link to what it created.",
    de: "Wenn der KI-Partner Arbeit vorbereitet, etwas nachverfolgt oder eine Nachricht in Arbeit umwandelt, steht es hier mit einem Link auf das Ergebnis.",
  },
  partnerUnavailable: {
    en: "The partner's activity could not be read.",
    de: "Die Aktivitaet des KI-Partners konnte nicht gelesen werden.",
  },
  partnerMore: { en: "{n} more", de: "{n} weitere" },
  partnerAsk: { en: "Ask", de: "Fragen" },

  /* Statement templates. Every placeholder is filled from a row. */
  statementPrepared: { en: "Prepared for your review: {title}", de: "Zur Pruefung vorbereitet: {title}" },
  statementPreparation: { en: "Prepared {title}", de: "Vorbereitet: {title}" },
  statementRoutine: { en: "{title}", de: "{title}" },
  statementExecutedOne: {
    en: "Recorded 1 change after your decision on {title}",
    de: "1 Aenderung nach Ihrer Entscheidung zu {title} erfasst",
  },
  statementExecutedMany: {
    en: "Recorded {n} changes after your decision on {title}",
    de: "{n} Aenderungen nach Ihrer Entscheidung zu {title} erfasst",
  },
  statementConversionOne: { en: "1 message converted into work", de: "1 Nachricht in Arbeit umgewandelt" },
  statementConversionMany: { en: "{n} messages converted into work", de: "{n} Nachrichten in Arbeit umgewandelt" },
  statementConversionYouOne: { en: "You converted 1 message into work", de: "Sie haben 1 Nachricht in Arbeit umgewandelt" },
  statementConversionYouMany: { en: "You converted {n} messages into work", de: "Sie haben {n} Nachrichten in Arbeit umgewandelt" },
  statementConversionByOne: { en: "{person} converted 1 message into work", de: "{person} hat 1 Nachricht in Arbeit umgewandelt" },
  statementConversionByMany: { en: "{person} converted {n} messages into work", de: "{person} hat {n} Nachrichten in Arbeit umgewandelt" },
  statementFollowUpOne: { en: "Requested 1 missing item", de: "1 fehlende Unterlage angefordert" },
  statementFollowUpMany: { en: "Requested {n} missing items", de: "{n} fehlende Unterlagen angefordert" },
  statementEscalationOne: {
    en: "Escalated 1 item to you for a decision",
    de: "1 Punkt zur Entscheidung an Sie eskaliert",
  },
  statementEscalationMany: {
    en: "Escalated {n} items to you for a decision",
    de: "{n} Punkte zur Entscheidung an Sie eskaliert",
  },
  statementContradictionOne: {
    en: "Found 1 record that does not agree",
    de: "1 Datensatz gefunden, der nicht uebereinstimmt",
  },
  statementContradictionMany: {
    en: "Found {n} records that do not agree",
    de: "{n} Datensaetze gefunden, die nicht uebereinstimmen",
  },
  activityDrafted: { en: "Drafted: {title}", de: "Entworfen: {title}" },
  activityCompleted: { en: "Completed: {title}", de: "Abgeschlossen: {title}" },
  activityExecuted: { en: "Carried out: {title}", de: "Ausgefuehrt: {title}" },
  activityEscalated: { en: "Escalated: {title}", de: "Eskaliert: {title}" },
  activityBlocked: { en: "Held for approval: {title}", de: "Zur Genehmigung angehalten: {title}" },
  activityWaiting: { en: "Waiting on a source: {title}", de: "Wartet auf eine Quelle: {title}" },

  /* ---- Done --------------------------------------------------------- */
  doneToday: { en: "Done today", de: "Heute erledigt" },
  doneNothingYet: { en: "Done today: nothing completed yet", de: "Heute erledigt: noch nichts abgeschlossen" },
  doneAutomaticOne: { en: "1 handled automatically", de: "1 automatisch bearbeitet" },
  doneAutomaticMany: { en: "{n} handled automatically", de: "{n} automatisch bearbeitet" },
  doneByYouOne: { en: "1 completed by you", de: "1 von Ihnen erledigt" },
  doneByYouMany: { en: "{n} completed by you", de: "{n} von Ihnen erledigt" },
  /* When only one category has work, the count is already beside the label. */
  doneAllAutomatic: { en: "all handled automatically", de: "alle automatisch bearbeitet" },
  doneAllByYou: { en: "all completed by you", de: "alle von Ihnen erledigt" },
  doneHandledHeading: { en: "Handled automatically", de: "Automatisch bearbeitet" },
  doneByYouHeading: { en: "Completed by you", de: "Von Ihnen erledigt" },
  doneDecisionRecorded: { en: "Decision recorded", de: "Entscheidung erfasst" },
  doneStageCompleted: { en: "Stage completed", de: "Stufe abgeschlossen" },
  doneActionCompleted: { en: "Action completed", de: "Massnahme abgeschlossen" },
  doneMeetingConcluded: { en: "Meeting concluded", de: "Besprechung abgeschlossen" },
} as const satisfies Record<string, Pair>;
