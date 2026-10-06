/**
 * Copy for the Agenda module. Shared by both roles; what a role calls its
 * agenda entries and meetings is in `roles/`.
 */

import type { Pair } from "../../copy";

export const AGENDA_COPY = {
  day: { en: "Day", de: "Tag" },
  week: { en: "Week", de: "Woche" },
  today: { en: "Today, {day} {date}", de: "Heute, {day} {date}" },
  dayLabel: { en: "{day} {date}", de: "{day} {date}" },
  noEntriesDay: { en: "No agenda entries on this day.", de: "An diesem Tag keine Agendaeintraege." },
  emptyTitle: { en: "No agenda entries", de: "Keine Agendaeintraege" },
  emptyBody: {
    en: "The calendar for this role has no entries in the scenario. Nothing is shown in their place.",
    de: "Der Kalender dieser Rolle hat im Szenario keine Eintraege. An ihrer Stelle wird nichts angezeigt.",
  },
  summary: {
    en: "Entries today: {today}. In conflict: {conflicts}. Meetings not prepared: {unprepared}.",
    de: "Eintraege heute: {today}. Im Konflikt: {conflicts}. Nicht vorbereitete Besprechungen: {unprepared}.",
  },
  dueNote: { en: "Due: {title}", de: "Faellig: {title}" },

  /* Preparation */
  prepNotStarted: { en: "Not prepared", de: "Nicht vorbereitet" },
  prepStarted: { en: "Preparation started", de: "Vorbereitung begonnen" },
  prepReady: { en: "Prepared", de: "Vorbereitet" },
  prepCompleted: { en: "Held", de: "Abgehalten" },
  prepNotNeeded: { en: "Focus time", de: "Fokuszeit" },
  packReady: { en: "Pack current: {current} of {total} sources", de: "Paket aktuell: {current} von {total} Quellen" },
  packIssues: { en: "Pack: {issues} of {total} sources need attention", de: "Paket: {issues} von {total} Quellen brauchen Aufmerksamkeit" },
  packNone: { en: "No meeting pack", de: "Kein Besprechungspaket" },
  recordedPrep: { en: "Recorded preparation", de: "Erfasste Vorbereitung" },
  pack: { en: "Meeting pack", de: "Besprechungspaket" },
  requiredPreparation: { en: "Required preparation", de: "Erforderliche Vorbereitung" },
  reqReadPack: { en: "Read the pack ({count} in total)", de: "Paket lesen ({count} insgesamt)" },
  reqQuestions: { en: "Review the prepared challenge questions ({count})", de: "Vorbereitete Challenge-Fragen pruefen ({count})" },
  reqStale: { en: "Resolve {id}: {status}", de: "{id} klaeren: {status}" },
  reqConflict: { en: "Decide which of the two overlapping entries moves", de: "Entscheiden, welcher der beiden ueberlappenden Eintraege verschoben wird" },
  reqNone: { en: "Nothing to prepare. The entry has no meeting pack.", de: "Nichts vorzubereiten. Der Eintrag hat kein Besprechungspaket." },
  reqDone: { en: "Nothing left to prepare. The meeting is recorded as held.", de: "Nichts mehr vorzubereiten. Die Besprechung ist als abgehalten erfasst." },

  /* Status */
  upcoming: { en: "Upcoming", de: "Anstehend" },
  inProgress: { en: "In progress", de: "Laeuft" },
  ended: { en: "Ended, not recorded", de: "Beendet, nicht erfasst" },
  completed: { en: "Held", de: "Abgehalten" },

  /* Conflict */
  conflict: { en: "Conflict", de: "Konflikt" },
  conflictWith: { en: "Overlaps {title} by {minutes} minutes", de: "Ueberschneidet sich mit {title} um {minutes} Minuten" },
  noConflict: { en: "No overlap with another entry.", de: "Keine Ueberschneidung mit einem anderen Eintrag." },

  /* Links and dependencies */
  linkedProcess: { en: "Linked process", de: "Verknuepfter Prozess" },
  servesStage: { en: "Serves stage: {stage}", de: "Dient der Stufe: {stage}" },
  inScope: {
    en: "{object} is in the scope of this process",
    de: "{object} liegt im Umfang dieses Prozesses",
  },
  linkedObject: { en: "Linked object", de: "Verknuepftes Objekt" },
  noProcess: {
    en: "Not in the scope of a running process.",
    de: "Liegt nicht im Umfang eines laufenden Prozesses.",
  },
  noLinkedObject: { en: "Not linked to a work object.", de: "Mit keinem Arbeitsobjekt verknuepft." },
  dependsTitle: { en: "Work due that depends on this meeting", de: "Faellige Arbeit, die von dieser Besprechung abhaengt" },
  dependsNote: {
    en: "Open actions on {object}. Their deadlines rest on what this meeting establishes.",
    de: "Offene Massnahmen zu {object}. Ihre Fristen haengen davon ab, was diese Besprechung klaert.",
  },
  dependsNone: { en: "No open work with a deadline depends on this meeting.", de: "Keine offene Arbeit mit Frist haengt von dieser Besprechung ab." },
  earliestDeadline: { en: "Earliest deadline {date}: {title}", de: "Frueheste Frist {date}: {title}" },
  nextAction: { en: "Next action", de: "Naechster Schritt" },
  nextResolveConflict: { en: "Resolve the overlap with {title}", de: "Ueberschneidung mit {title} klaeren" },
  nextPrepare: { en: "Prepare: read the pack before {time}", de: "Vorbereiten: Paket vor {time} lesen" },
  nextJoin: { en: "Open the meeting", de: "Besprechung oeffnen" },
  nextRecord: { en: "Record the meeting as held", de: "Besprechung als abgehalten erfassen" },
  nextFollowUp: { en: "Follow up the dependent actions ({count})", de: "Abhaengige Massnahmen nachverfolgen ({count})" },
  nextReviewOutcome: { en: "Review the recorded outcome", de: "Erfasstes Ergebnis pruefen" },
  nextFocus: { en: "Use the block for: {agenda}", de: "Den Block nutzen fuer: {agenda}" },
  outcome: { en: "Recorded outcome", de: "Erfasstes Ergebnis" },
  minutes: { en: "Minutes", de: "Protokoll" },

  /* Record as held */
  recordHeld: { en: "Record as held", de: "Als abgehalten erfassen" },
  recordHeldIntro: {
    en: "Records the outcome on the meeting, marks this entry held, and adds a follow-up entry to each dependent action.",
    de: "Erfasst das Ergebnis an der Besprechung, markiert den Eintrag als abgehalten und fuegt jeder abhaengigen Massnahme einen Folgeeintrag hinzu.",
  },
  recordHeldNotYet: {
    en: "The meeting starts at {time}. It can be recorded as held once it has started.",
    de: "Die Besprechung beginnt um {time}. Sie kann erfasst werden, sobald sie begonnen hat.",
  },
  recordHeldDone: { en: "Already recorded as held.", de: "Bereits als abgehalten erfasst." },
  recordHeldNoMeeting: { en: "Only an entry with a meeting record can be recorded as held.", de: "Nur ein Eintrag mit Besprechungsdatensatz kann als abgehalten erfasst werden." },
  fieldOutcome: { en: "What the meeting established", de: "Was die Besprechung geklaert hat" },
  confirmHeld: {
    en: "I confirm the meeting took place and this outcome is my record of it.",
    de: "Ich bestaetige, dass die Besprechung stattgefunden hat und dieses Ergebnis meine Aufzeichnung ist.",
  },
  willFollowUp: { en: "Follow-up entries on: {ids}", de: "Folgeeintraege an: {ids}" },

  /* Proposals */
  proposePrepareTitle: { en: "Prepare {title} at {time}", de: "{title} um {time} vorbereiten" },
  proposePrepareBody: {
    en: "Documents in the pack: {docs}. Prepared questions: {questions}{stale}. Preparation is recorded as {prep}.",
    de: "Dokumente im Paket: {docs}. Vorbereitete Fragen: {questions}{stale}. Die Vorbereitung ist als {prep} erfasst.",
  },
  proposeStale: { en: ". Sources needing attention: {count}", de: ". Quellen mit Handlungsbedarf: {count}" },
  proposePrepareDecide: {
    en: "Whether the pack is enough to go into the meeting with.",
    de: "Ob das Paket ausreicht, um in die Besprechung zu gehen.",
  },
  proposeFocusTitle: { en: "Reserve {start} to {end}", de: "{start} bis {end} reservieren" },
  proposeFocusBody: {
    en: "{reason}. The slot is free on the agenda and ends before the meeting starts at {time}.",
    de: "{reason}. Das Zeitfenster ist in der Agenda frei und endet vor Beginn der Besprechung um {time}.",
  },
  proposeFocusDecide: { en: "Whether to protect this time.", de: "Ob diese Zeit geschuetzt werden soll." },
  proposeFocusUnavailable: {
    en: "Calendar booking is not connected in this release. Book the time in your own calendar.",
    de: "Die Kalenderbuchung ist in diesem Release nicht angebunden. Buchen Sie die Zeit im eigenen Kalender.",
  },
  openPreparation: { en: "Open the preparation", de: "Vorbereitung oeffnen" },
  notConnected: { en: "Not connected", de: "Nicht angebunden" },
} as const satisfies Record<string, Pair>;
