/**
 * Copy for the Meetings module. Shared by both roles; meeting types are in
 * `roles/`.
 *
 * Three groups: the queue and detail the module always had, the meeting
 * lifecycle (before, during and after the meeting, the minutes and their
 * confirmation), and the composer's own sentences, which become part of a
 * draft and are therefore written in the language the person works in.
 */

import type { Pair } from "../../copy";

export const MEETINGS_COPY = {
  upcoming: { en: "Upcoming", de: "Anstehend" },
  archive: { en: "Minutes archive", de: "Protokollarchiv" },
  noUpcoming: {
    en: "No upcoming meetings for this role in the scenario.",
    de: "Fuer diese Rolle stehen im Szenario keine Besprechungen an.",
  },
  noArchive: {
    en: "No meeting has been recorded as held and no minutes exist yet.",
    de: "Keine Besprechung ist als abgehalten erfasst und es gibt noch kein Protokoll.",
  },
  emptyTitle: { en: "No meetings", de: "Keine Besprechungen" },
  emptyBody: {
    en: "This role has no meetings and no minutes in the scenario. Nothing is shown in their place.",
    de: "Diese Rolle hat im Szenario weder Besprechungen noch Protokolle. An ihrer Stelle wird nichts angezeigt.",
  },
  summary: {
    en: "Upcoming: {upcoming}. Held: {held}. Minutes records: {minutes}.",
    de: "Anstehend: {upcoming}. Abgehalten: {held}. Protokolle: {minutes}.",
  },
  participants: { en: "Participants: {count}", de: "Teilnehmende: {count}" },
  held: { en: "Held", de: "Abgehalten" },
  notStarted: { en: "Not started", de: "Nicht begonnen" },
  inProgress: { en: "In progress", de: "Laeuft" },
  awaitingRecord: { en: "Ended, not yet recorded", de: "Beendet, noch nicht erfasst" },
  minutesConfirmed: { en: "Minutes confirmed", de: "Protokoll bestaetigt" },
  minutesDraft: { en: "Minutes draft", de: "Protokollentwurf" },
  minutesAwaiting: { en: "Minutes awaiting confirmation", de: "Protokoll wartet auf Bestaetigung" },
  minutesDistributed: { en: "Minutes distributed", de: "Protokoll verteilt" },
  minutesKind: { en: "Minutes", de: "Protokoll" },

  /* Detail */
  objective: { en: "Objective", de: "Ziel" },
  preparation: { en: "Preparation pack", de: "Vorbereitungspaket" },
  noPreparation: { en: "No preparation pack has been assembled for this meeting.", de: "Fuer diese Besprechung wurde kein Vorbereitungspaket erstellt." },
  questions: { en: "Prepared questions", de: "Vorbereitete Fragen" },
  questionsNote: {
    en: "Drafted by the AI Partner from the pack. Yours to edit, use or drop.",
    de: "Vom KI Partner aus dem Paket entworfen. Zum Bearbeiten, Verwenden oder Verwerfen.",
  },
  outcome: { en: "Recorded outcome", de: "Erfasstes Ergebnis" },
  facts: { en: "Facts", de: "Fakten" },
  unresolved: { en: "Unresolved", de: "Offen" },
  minutesNoMeeting: {
    en: "The meeting these minutes record is not in the role's meeting list.",
    de: "Die Besprechung zu diesem Protokoll steht nicht in der Besprechungsliste der Rolle.",
  },
} as const satisfies Record<string, Pair>;

/* ==========================================================================
   The lifecycle
   ========================================================================== */

export const LIFECYCLE_COPY = {
  lifecycleLabel: { en: "Meeting lifecycle", de: "Ablauf der Besprechung" },
  before: { en: "Before", de: "Vorher" },
  during: { en: "During", de: "Waehrend" },
  after: { en: "After", de: "Danach" },
  phaseNow: { en: "Now", de: "Jetzt" },
  phaseDone: { en: "Done", de: "Erledigt" },
  phaseLater: { en: "Later", de: "Spaeter" },
  clock: {
    en: "Scenario time {now}. Scheduled {date}, {start} to {end}.",
    de: "Szenariozeit {now}. Geplant am {date}, {start} bis {end}.",
  },

  /* Before */
  purpose: { en: "Purpose", de: "Zweck" },
  participants: { en: "Participants", de: "Teilnehmende" },
  external: { en: "outside the bank", de: "ausserhalb der Bank" },
  stage: { en: "Process stage", de: "Prozessstufe" },
  stageOpen: { en: "Open", de: "Offen" },
  stageNotOpen: { en: "Not open yet", de: "Noch nicht geoeffnet" },
  stageCompleted: { en: "Completed", de: "Abgeschlossen" },
  stageNotOpenNote: {
    en: "The run is at {current}. This stage opens when the stages before it are complete, and the confirmed minutes of this meeting are its record when it does.",
    de: "Der Lauf steht bei {current}. Diese Stufe oeffnet, wenn die Stufen davor abgeschlossen sind, und das bestaetigte Protokoll dieser Besprechung ist dann ihre Aufzeichnung.",
  },
  stageOpenNote: {
    en: "The stage is open. Confirming the minutes publishes the meeting record to it.",
    de: "Die Stufe ist offen. Mit der Bestaetigung des Protokolls wird die Besprechungsaufzeichnung an sie uebergeben.",
  },
  stageCompletedNote: {
    en: "The stage is already complete. The minutes are still filed as evidence.",
    de: "Die Stufe ist bereits abgeschlossen. Das Protokoll wird dennoch als Nachweis abgelegt.",
  },
  noStage: {
    en: "No running process depends on this meeting.",
    de: "Kein laufender Prozess haengt von dieser Besprechung ab.",
  },
  openDecisions: { en: "Open decisions", de: "Offene Entscheidungen" },
  noDecisions: {
    en: "No open decision on the subject is visible at this time.",
    de: "Zum Gegenstand ist derzeit keine offene Entscheidung sichtbar.",
  },
  pack: { en: "Evidence pack", de: "Nachweispaket" },
  contradictions: { en: "Contradictions on record", de: "Erfasste Widersprueche" },
  noContradictions: {
    en: "No contradiction bearing on this meeting is on record.",
    de: "Zu dieser Besprechung ist kein Widerspruch erfasst.",
  },
  questions: { en: "AI-prepared questions", de: "Von der KI vorbereitete Fragen" },
  dueBefore: { en: "Actions due before the meeting", de: "Vor der Besprechung faellige Massnahmen" },
  noDueBefore: {
    en: "No open action on the subject falls due before the meeting.",
    de: "Keine offene Massnahme zum Gegenstand ist vor der Besprechung faellig.",
  },
  expected: { en: "Expected outcomes", de: "Erwartete Ergebnisse" },
  watch: { en: "Watch", de: "Beachten" },
  prepSafe: { en: "Safe", de: "Sicher" },
  prepOffline: { en: "Offline", de: "Offline" },
  prepUnavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
  prepSafeNote: {
    en: "Prepared before the day from the seeded records, and checked against the records as they are now.",
    de: "Vor dem Tag aus den hinterlegten Aufzeichnungen vorbereitet und gegen den aktuellen Stand geprueft.",
  },
  prepOfflineNote: { en: "Composed now from the current records.", de: "Jetzt aus den aktuellen Aufzeichnungen zusammengestellt." },
  prepChanged: {
    en: "The records changed since the safe preparation was captured, so it was composed from them as they are now.",
    de: "Die Aufzeichnungen haben sich seit der sicheren Vorbereitung geaendert, daher wurde sie aus dem aktuellen Stand zusammengestellt.",
  },
  prepNoCache: {
    en: "No safe preparation was captured for this meeting, so it was composed from the current records.",
    de: "Fuer diese Besprechung wurde keine sichere Vorbereitung erfasst, daher wurde sie aus den aktuellen Aufzeichnungen zusammengestellt.",
  },
  prepLive: {
    en: "Live drafting is not connected for meetings, so the safe preparation is used.",
    de: "Live-Entwuerfe sind fuer Besprechungen nicht angebunden, daher wird die sichere Vorbereitung verwendet.",
  },
  prepFailed: {
    en: "The preparation did not pass its checks against the records, so none is shown.",
    de: "Die Vorbereitung hat die Pruefung gegen die Aufzeichnungen nicht bestanden, daher wird keine angezeigt.",
  },

  /* During */
  transcript: { en: "Conversation record", de: "Gespraechsverlauf" },
  notStartedYet: {
    en: "The meeting starts at {time}. The conversation appears here as it happens.",
    de: "Die Besprechung beginnt um {time}. Der Verlauf erscheint hier, sobald gesprochen wird.",
  },
  noRecord: {
    en: "No conversation was recorded for this meeting.",
    de: "Fuer diese Besprechung wurde kein Gespraechsverlauf aufgezeichnet.",
  },
  pending: {
    en: "{count} further statements are recorded later in the meeting.",
    de: "{count} weitere Aussagen folgen spaeter in der Besprechung.",
  },
  basisStatement: { en: "Statement", de: "Aussage" },
  basisFact: { en: "Verified fact", de: "Gepruefter Fakt" },
  basisRecord: { en: "Record", de: "Aufzeichnung" },
  basisInference: { en: "AI inference", de: "KI-Schlussfolgerung" },
  aiPartner: { en: "AI Partner", de: "KI Partner" },
  flag: { en: "Contradicted by the evidence", de: "Widerspricht den Nachweisen" },
  retrieved: { en: "Evidence for this statement", de: "Nachweise zu dieser Aussage" },
  capture: { en: "Capture", de: "Erfassen" },
  captureFact: { en: "Fact", de: "Fakt" },
  captureDecision: { en: "Decision", de: "Entscheidung" },
  captureAction: { en: "Action", de: "Massnahme" },
  captureUnresolved: { en: "Unresolved", de: "Offene Frage" },
  captured: { en: "Captured: {kinds}", de: "Erfasst: {kinds}" },
  captureNotStarted: {
    en: "Statements can be captured once the meeting has started.",
    de: "Aussagen koennen erfasst werden, sobald die Besprechung begonnen hat.",
  },
  captureConfirmed: {
    en: "The minutes are confirmed, so nothing more is captured into them.",
    de: "Das Protokoll ist bestaetigt, daher wird nichts mehr darin erfasst.",
  },
  captureWill: {
    en: "Adds the item to the minutes draft. A draft is not a record until you confirm it.",
    de: "Fuegt den Eintrag dem Protokollentwurf hinzu. Ein Entwurf ist erst nach Ihrer Bestaetigung eine Aufzeichnung.",
  },
  fieldText: { en: "Text", de: "Text" },
  fieldDecision: { en: "Decision", de: "Entscheidung" },
  fieldNoDecision: { en: "None, recorded in the minutes only", de: "Keine, nur im Protokoll" },
  fieldOutcome: { en: "Outcome", de: "Ergebnis" },
  fieldTitle: { en: "Action", de: "Massnahme" },
  fieldOwner: { en: "Accountable owner", de: "Verantwortliche Person" },
  fieldDeliveredBy: { en: "Delivered by, outside the bank", de: "Geliefert durch, ausserhalb der Bank" },
  fieldDue: { en: "Due", de: "Faellig" },
  fieldKind: { en: "Kind", de: "Art" },
  fieldCondition: { en: "Completion condition", de: "Abschlussbedingung" },
  fieldExisting: { en: "Follow up an existing action", de: "Bestehende Massnahme nachverfolgen" },
  fieldFollowUpNote: { en: "What the minutes record about this action", de: "Was das Protokoll zu dieser Massnahme festhaelt" },
  followUpKeeps: {
    en: "The action keeps its own owner and due date. Confirming the minutes adds this note to its history.",
    de: "Die Massnahme behaelt Verantwortung und Frist. Mit der Bestaetigung wird dieser Vermerk ihrem Verlauf hinzugefuegt.",
  },
  fieldNewAction: { en: "A new action", de: "Eine neue Massnahme" },
  fieldEvidence: { en: "Evidence", de: "Nachweise" },
  fieldOtherEvidence: { en: "Other evidence references", de: "Weitere Nachweisreferenzen" },
  ownerNeeded: { en: "Owner needed", de: "Verantwortung fehlt" },
  dateNeeded: { en: "Date needed", de: "Datum fehlt" },
  outcomeAgreed: { en: "Agreed", de: "Vereinbart" },
  outcomeNotAgreed: { en: "Not agreed", de: "Nicht vereinbart" },
  outcomeDeferred: { en: "Deferred", de: "Vertagt" },
  outcomeReferred: { en: "Referred to its owner", de: "An die verantwortliche Person verwiesen" },
  followUpOf: { en: "Follow-up of {id}", de: "Nachverfolgung von {id}" },
  newAction: { en: "New action", de: "Neue Massnahme" },

  /* After */
  minutes: { en: "Minutes", de: "Protokoll" },
  prepare: { en: "Draft the minutes", de: "Protokoll entwerfen" },
  prepareNote: {
    en: "The AI Partner drafts the minutes from the conversation record and the pack. What you captured is kept as you wrote it.",
    de: "Der KI Partner entwirft das Protokoll aus dem Gespraechsverlauf und dem Paket. Was Sie erfasst haben, bleibt wie geschrieben.",
  },
  prepareNotStarted: {
    en: "Minutes can be drafted once the meeting has started.",
    de: "Ein Protokoll kann entworfen werden, sobald die Besprechung begonnen hat.",
  },
  prepareDone: {
    en: "The AI draft exists. Edit it below; the record is yours.",
    de: "Der KI-Entwurf liegt vor. Bearbeiten Sie ihn unten; die Aufzeichnung ist Ihre.",
  },
  noMinutes: { en: "No minutes exist for this meeting yet.", de: "Fuer diese Besprechung gibt es noch kein Protokoll." },
  draftByAi: {
    en: "Drafted by the AI Partner ({mode}). Not a record until you confirm it.",
    de: "Vom KI Partner entworfen ({mode}). Erst nach Ihrer Bestaetigung eine Aufzeichnung.",
  },
  draftByPerson: {
    en: "Written by {person}. Not a record until it is confirmed.",
    de: "Verfasst von {person}. Erst nach Bestaetigung eine Aufzeichnung.",
  },
  editedBy: { en: "Last edited by {person}, version {version}.", de: "Zuletzt bearbeitet von {person}, Version {version}." },
  originPerson: { en: "Captured by you", de: "Von Ihnen erfasst" },
  originAi: { en: "AI draft", de: "KI-Entwurf" },
  summaryLabel: { en: "Summary", de: "Zusammenfassung" },
  factsLabel: { en: "Facts", de: "Fakten" },
  decisionsLabel: { en: "Decisions", de: "Entscheidungen" },
  actionsLabel: { en: "Actions, owners and due dates", de: "Massnahmen, Verantwortliche und Fristen" },
  unresolvedLabel: { en: "Unresolved questions", de: "Offene Fragen" },
  evidenceLabel: { en: "Evidence references", de: "Nachweisreferenzen" },
  distributionLabel: { en: "Distribution", de: "Verteiler" },
  nothingYet: { en: "None.", de: "Keine." },
  edit: { en: "Edit the draft", de: "Entwurf bearbeiten" },
  save: { en: "Save the draft", de: "Entwurf speichern" },
  cancel: { en: "Cancel", de: "Abbrechen" },
  add: { en: "Add", de: "Hinzufuegen" },
  remove: { en: "Remove", de: "Entfernen" },
  saveWill: {
    en: "Saves a new version of the draft in your name. Nothing outside the draft changes.",
    de: "Speichert eine neue Version des Entwurfs in Ihrem Namen. Ausserhalb des Entwurfs aendert sich nichts.",
  },
  ready: { en: "Ready to confirm", de: "Bereit zur Bestaetigung" },
  missing: { en: "Before the minutes can be confirmed:", de: "Bevor das Protokoll bestaetigt werden kann:" },
  confirmTitle: { en: "Confirm the minutes", de: "Protokoll bestaetigen" },
  confirmDecisions: {
    en: "I confirm the decisions as recorded. Each stays with its owner, who records it on Decisions.",
    de: "Ich bestaetige die Entscheidungen wie erfasst. Jede bleibt bei ihrer verantwortlichen Person, die sie unter Entscheidungen erfasst.",
  },
  confirmActions: {
    en: "I confirm the actions, their accountable owners and their due dates.",
    de: "Ich bestaetige die Massnahmen, ihre verantwortlichen Personen und ihre Fristen.",
  },
  confirmDistribution: { en: "I confirm the distribution list.", de: "Ich bestaetige den Verteiler." },
  confirmOwn: {
    en: "These minutes are my record of the meeting, and the reason below is my own.",
    de: "Dieses Protokoll ist meine Aufzeichnung der Besprechung, und die Begruendung unten ist meine eigene.",
  },
  reason: { en: "Reason for confirming", de: "Begruendung der Bestaetigung" },
  willEvidence: { en: "The minutes become evidence document {id}.", de: "Das Protokoll wird zum Nachweisdokument {id}." },
  willActions: {
    en: "{count} new actions are raised, each with this meeting and these minutes as its source.",
    de: "{count} neue Massnahmen werden erfasst, jede mit dieser Besprechung und diesem Protokoll als Herkunft.",
  },
  willFollowUps: {
    en: "{count} existing actions get a follow-up entry in their history.",
    de: "{count} bestehende Massnahmen erhalten einen Nachverfolgungseintrag.",
  },
  willHeld: { en: "{reference} is recorded as held.", de: "{reference} wird als abgehalten erfasst." },
  willStage: {
    en: "The process stage {stage} receives the meeting record.",
    de: "Die Prozessstufe {stage} erhaelt die Besprechungsaufzeichnung.",
  },
  willDecisions: {
    en: "{count} decisions are recorded as discussed. Each stays open with its owner.",
    de: "{count} Entscheidungen werden als eroertert erfasst. Jede bleibt bei ihrer verantwortlichen Person offen.",
  },
  willDistribute: {
    en: "The minutes go to {count} people as a simulated message. Nothing leaves this machine.",
    de: "Das Protokoll geht als simulierte Nachricht an {count} Personen. Nichts verlaesst diesen Rechner.",
  },
  approval: {
    en: "Material. Your approval is recorded in your name and bound to version {version} of this draft.",
    de: "Wesentlich. Ihre Genehmigung wird in Ihrem Namen erfasst und an Version {version} dieses Entwurfs gebunden.",
  },
  confirmSubmit: { en: "Confirm the minutes", de: "Protokoll bestaetigen" },
  working: { en: "Working", de: "Wird ausgefuehrt" },
  confirmedBy: { en: "Confirmed by {person}, {when}.", de: "Bestaetigt von {person}, {when}." },
  filedAs: { en: "Filed as evidence", de: "Als Nachweis abgelegt" },
  raised: { en: "Raised from these minutes", de: "Aus diesem Protokoll erfasst" },
  distributedTo: {
    en: "Distributed as a simulated message to {names}, {when}. Nothing left this machine.",
    de: "Als simulierte Nachricht verteilt an {names}, {when}. Nichts hat diesen Rechner verlassen.",
  },
  notDistributed: {
    en: "Not distributed. The distribution list was empty when the minutes were confirmed.",
    de: "Nicht verteilt. Der Verteiler war bei der Bestaetigung leer.",
  },
  receipt: { en: "What changed", de: "Was sich geaendert hat" },
} as const satisfies Record<string, Pair>;

/* ==========================================================================
   The composer's sentences
   ========================================================================== */

export const COMPOSE_COPY = {
  prepSummary: {
    en: "{type} on {date} at {time}. Pack: {current} of {total} documents current. {questions} prepared questions, {contradictions} contradictions on record and {decisions} open decisions on the subject.",
    de: "{type} am {date} um {time}. Paket: {current} von {total} Dokumenten aktuell. {questions} vorbereitete Fragen, {contradictions} erfasste Widersprueche und {decisions} offene Entscheidungen zum Gegenstand.",
  },
  outcomeDecision: {
    en: "A position on \"{title}\", ready for its owner to record on Decisions",
    de: "Eine Position zu \"{title}\", bereit zur Erfassung unter Entscheidungen",
  },
  outcomeMinutes: {
    en: "Minutes in which every action has an accountable owner and a due date",
    de: "Ein Protokoll, in dem jede Massnahme eine verantwortliche Person und eine Frist hat",
  },
  watchPack: {
    en: "{count} pack documents need attention: {ids}",
    de: "{count} Dokumente im Paket brauchen Aufmerksamkeit: {ids}",
  },
  watchOverdue: {
    en: "{count} actions on the subject are already overdue: {ids}",
    de: "{count} Massnahmen zum Gegenstand sind bereits ueberfaellig: {ids}",
  },
  prepLimitation: {
    en: "Prepared from the records of the scenario day. Live drafting is not connected for meetings.",
    de: "Aus den Aufzeichnungen des Szenariotags vorbereitet. Live-Entwuerfe sind fuer Besprechungen nicht angebunden.",
  },
  minutesSummary: {
    en: "{type} held on {date} with {participants} participants. Drafted from {turns} recorded statements, {flags} of them flagged against the evidence.",
    de: "{type} am {date} mit {participants} Teilnehmenden. Entworfen aus {turns} erfassten Aussagen, davon {flags} gegen die Nachweise markiert.",
  },
  minutesInProgress: {
    en: "The meeting was still in progress when this draft was prepared.",
    de: "Die Besprechung lief noch, als dieser Entwurf vorbereitet wurde.",
  },
  decisionReferred: {
    en: "Discussed in the meeting. The decision stays with its owner, who records it on Decisions with a rationale of their own.",
    de: "In der Besprechung eroertert. Die Entscheidung bleibt bei ihrer verantwortlichen Person, die sie unter Entscheidungen mit eigener Begruendung erfasst.",
  },
  contradictedBy: { en: "Flagged against the evidence: {note}", de: "Gegen die Nachweise markiert: {note}" },
  recordParticipants: { en: "Participants", de: "Teilnehmende" },
  recordSummary: { en: "Summary", de: "Zusammenfassung" },
  recordFacts: { en: "Facts", de: "Fakten" },
  recordDecisions: { en: "Decisions", de: "Entscheidungen" },
  recordActions: { en: "Actions", de: "Massnahmen" },
  recordUnresolved: { en: "Unresolved questions", de: "Offene Fragen" },
  recordEvidence: { en: "Evidence references", de: "Nachweisreferenzen" },
  recordOwner: { en: "Owner", de: "Verantwortlich" },
  recordDeliveredBy: { en: "delivered by", de: "geliefert durch" },
  recordDue: { en: "Due", de: "Faellig" },
  recordCondition: { en: "Closes when", de: "Abgeschlossen, wenn" },
} as const satisfies Record<string, Pair>;
