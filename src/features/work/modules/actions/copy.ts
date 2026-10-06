/**
 * Copy for the Actions module.
 *
 * Shared by both roles. What a role calls its action kinds, what a reminder
 * says and where an escalation goes are in `roles/`, not here.
 */

import type { Pair } from "../../copy";

export const ACTION_VIEW_LABELS = {
  "needs-me": { en: "Needs me", de: "Benoetigt mich" },
  "waiting-others": { en: "Waiting on others", de: "Warte auf andere" },
  overdue: { en: "Overdue", de: "Ueberfaellig" },
  completed: { en: "Completed", de: "Abgeschlossen" },
} as const satisfies Record<string, Pair>;

export const ACTION_EMPTY = {
  "needs-me": {
    title: { en: "Nothing needs you", de: "Nichts benoetigt Sie" },
    body: {
      en: "No open action is owned by you or waiting for you to assign it.",
      de: "Keine offene Massnahme liegt bei Ihnen oder wartet auf Ihre Zuweisung.",
    },
  },
  "waiting-others": {
    title: { en: "Nothing is waiting on others", de: "Nichts wartet auf andere" },
    body: {
      en: "No open action you follow up is with another owner or a supplier contact.",
      de: "Keine offene Massnahme, die Sie verfolgen, liegt bei einer anderen Person oder einem Lieferanten.",
    },
  },
  overdue: {
    title: { en: "Nothing is overdue", de: "Nichts ist ueberfaellig" },
    body: {
      en: "Every open action is within its due date.",
      de: "Jede offene Massnahme liegt innerhalb ihres Faelligkeitsdatums.",
    },
  },
  completed: {
    title: { en: "Nothing completed yet", de: "Noch nichts abgeschlossen" },
    body: {
      en: "Completed actions stay here with their evidence and history.",
      de: "Abgeschlossene Massnahmen bleiben hier mit Nachweisen und Verlauf.",
    },
  },
  none: {
    title: { en: "No actions", de: "Keine Massnahmen" },
    body: {
      en: "No action is raised by this role or owned by its holder in this scenario.",
      de: "In diesem Szenario hat diese Rolle keine Massnahme erstellt und keine liegt bei der Rolleninhaberin oder dem Rolleninhaber.",
    },
  },
} as const;

export const ACTIONS_COPY = {
  summary: {
    en: "Open: {open}. Needing you: {needsMe}. Overdue: {overdue}. Blocked: {blocked}.",
    de: "Offen: {open}. Fuer Sie: {needsMe}. Ueberfaellig: {overdue}. Blockiert: {blocked}.",
  },
  noDate: { en: "No date", de: "Kein Datum" },
  dueIn: { en: "in {days} days", de: "in {days} Tagen" },
  dueTomorrow: { en: "tomorrow", de: "morgen" },
  dueToday: { en: "today", de: "heute" },
  overdueBy: { en: "{days} days overdue", de: "{days} Tage ueberfaellig" },
  overdueByOne: { en: "1 day overdue", de: "1 Tag ueberfaellig" },
  completedOn: { en: "completed {date}", de: "abgeschlossen am {date}" },
  statusCompletedFallback: { en: "Completed", de: "Abgeschlossen" },
  unowned: { en: "No owner", de: "Ohne Verantwortliche" },
  material: { en: "Material", de: "Wesentlich" },
  blockedChip: { en: "Blocked", de: "Blockiert" },

  /* Detail */
  completionCondition: { en: "Completion condition", de: "Abschlussbedingung" },
  conditionNotRecorded: {
    en: "No completion condition is recorded for this action.",
    de: "Fuer diese Massnahme ist keine Abschlussbedingung erfasst.",
  },
  conditionAgreedBy: { en: "Agreed by {person} on {date}", de: "Vereinbart von {person} am {date}" },
  proposedCondition: { en: "Proposed measurable condition", de: "Vorgeschlagene messbare Bedingung" },
  useCondition: { en: "Record this condition", de: "Diese Bedingung erfassen" },
  owner: { en: "Accountable owner", de: "Verantwortlich" },
  noOwner: {
    en: "No accountable owner. An action without an owner is a finding in its own right.",
    de: "Keine verantwortliche Person. Eine Massnahme ohne Verantwortliche ist selbst eine Feststellung.",
  },
  deliveredBy: { en: "Delivered by {who}", de: "Geliefert durch {who}" },
  due: { en: "Due date", de: "Faelligkeit" },
  sources: { en: "Where it came from", de: "Herkunft" },
  sourceDecision: { en: "Source decision", de: "Ausgangsentscheidung" },
  sourceMeeting: { en: "Source meeting", de: "Ausgangsbesprechung" },
  sourceProcess: { en: "Process stage", de: "Prozessstufe" },
  sourceNoneRecorded: {
    en: "No source decision, meeting or process stage is recorded for this action.",
    de: "Fuer diese Massnahme ist keine Ausgangsentscheidung, Besprechung oder Prozessstufe erfasst.",
  },
  processInScope: {
    en: "{object} is in the scope of this process; the current stage is shown",
    de: "{object} liegt im Umfang dieses Prozesses; die aktuelle Stufe ist angegeben",
  },
  processRecorded: {
    en: "Raised from this process stage, as recorded on the action",
    de: "Aus dieser Prozessstufe erfasst, wie an der Massnahme vermerkt",
  },
  blocker: { en: "Blocker", de: "Hindernis" },
  noBlocker: { en: "No blocker is recorded.", de: "Kein Hindernis erfasst." },
  latestFollowUp: { en: "Latest follow-up", de: "Letzte Nachverfolgung" },
  noFollowUp: { en: "No follow-up has been sent for this action.", de: "Zu dieser Massnahme wurde keine Nachverfolgung gesendet." },
  simulatedSent: { en: "Simulated, not delivered to a real recipient", de: "Simuliert, an keinen echten Empfaenger zugestellt" },
  history: { en: "Progress history", de: "Fortschrittsverlauf" },
  historyNote: {
    en: "Append only. Entries are never edited or removed.",
    de: "Nur Anfuegen. Eintraege werden nie bearbeitet oder entfernt.",
  },
  recordedBefore: { en: "Recorded before today", de: "Vor heute erfasst" },
  onRecord: { en: "On the action record", de: "Im Massnahmendatensatz" },
  evidenceRequired: {
    en: "Completion requires cited evidence for this kind of action.",
    de: "Der Abschluss erfordert fuer diese Art von Massnahme einen zitierten Nachweis.",
  },
  evidenceNotRequired: {
    en: "Completion does not require evidence for this kind of action.",
    de: "Der Abschluss erfordert fuer diese Art von Massnahme keinen Nachweis.",
  },
  materialBecause: { en: "Material because {reasons}.", de: "Wesentlich, weil {reasons}." },
  reasonHighPriority: { en: "it is high priority", de: "sie hohe Prioritaet hat" },
  reasonIssue: { en: "it remediates issue {issue}", de: "sie das Thema {issue} behebt" },
  reasonKind: { en: "it is a {kind}", de: "sie eine {kind} ist" },
  notMaterial: {
    en: "Not material: routine follow-up, still recorded in your name.",
    de: "Nicht wesentlich: Routinenachverfolgung, dennoch in Ihrem Namen erfasst.",
  },

  /* AI checks */
  aiChecks: { en: "AI checks", de: "KI-Pruefungen" },
  aiChecksNote: {
    en: "Prepared offline from the action record. Proposals only; nothing is changed until you act.",
    de: "Offline aus dem Massnahmendatensatz vorbereitet. Nur Vorschlaege; nichts aendert sich, bevor Sie handeln.",
  },
  vagueWording: { en: "Vague wording", de: "Unscharfe Formulierung" },
  noVagueWording: { en: "The wording names a checkable result.", de: "Die Formulierung nennt ein pruefbares Ergebnis." },
  duplicates: { en: "Possible duplicates", de: "Moegliche Dubletten" },
  noDuplicates: { en: "No similar open action found.", de: "Keine aehnliche offene Massnahme gefunden." },
  duplicateSameObject: { en: "same object and kind", de: "gleiches Objekt und gleiche Art" },
  duplicateSimilarTitle: { en: "similar wording", de: "aehnliche Formulierung" },
  aiLimits: {
    en: "The AI Partner may draft and propose here. It cannot close a material action, move a material due date without your approval, or remove accountability.",
    de: "Der KI Partner darf hier entwerfen und vorschlagen. Er kann keine wesentliche Massnahme schliessen, kein wesentliches Faelligkeitsdatum ohne Ihre Genehmigung verschieben und keine Verantwortung entfernen.",
  },

  /* Operations */
  operations: { en: "Operations", de: "Vorgaenge" },
  opAssign: { en: "Assign", de: "Zuweisen" },
  opChangeDate: { en: "Change date", de: "Datum aendern" },
  opRequestEvidence: { en: "Request evidence", de: "Nachweis anfordern" },
  opAddUpdate: { en: "Add update", de: "Update hinzufuegen" },
  opDraftReminder: { en: "Draft reminder", de: "Erinnerung entwerfen" },
  opSendReminder: { en: "Send reminder", de: "Erinnerung senden" },
  opComplete: { en: "Complete with evidence", de: "Mit Nachweis abschliessen" },
  opCompleteNoEvidence: { en: "Complete", de: "Abschliessen" },
  opReopen: { en: "Reopen", de: "Wieder oeffnen" },
  opEscalate: { en: "Escalate", de: "Eskalieren" },
  approvalYours: {
    en: "Recorded as your approval, bound to exactly this change.",
    de: "Als Ihre Genehmigung erfasst, gebunden an genau diese Aenderung.",
  },
  approvalNone: {
    en: "No approval needed at this autonomy level; the change is audited.",
    de: "Auf dieser Autonomiestufe keine Genehmigung erforderlich; die Aenderung wird protokolliert.",
  },
  approvalDraft: { en: "Nothing is written. A draft is prepared for you to edit.", de: "Nichts wird geschrieben. Ein Entwurf wird zur Bearbeitung vorbereitet." },
  notOpen: { en: "Only an open action can be changed. Reopen it first.", de: "Nur eine offene Massnahme kann geaendert werden. Oeffnen Sie sie zuerst wieder." },
  notCompleted: { en: "Only a completed action can be reopened.", de: "Nur eine abgeschlossene Massnahme kann wieder geoeffnet werden." },
  noRecipient: { en: "The action has no owner to remind. Assign one first.", de: "Die Massnahme hat niemanden, der erinnert werden kann. Weisen Sie zuerst jemanden zu." },
  alreadyEscalated: { en: "Already escalated to {committee}.", de: "Bereits an {committee} eskaliert." },
  notRegistered: {
    en: "This operation is not registered with the authority gate.",
    de: "Dieser Vorgang ist bei der Befugnispruefung nicht registriert.",
  },
  willAssign: {
    en: "The accountable owner changes and the transfer is added to the history. Accountability can be transferred, never removed.",
    de: "Die verantwortliche Person aendert sich und die Uebertragung wird im Verlauf erfasst. Verantwortung kann uebertragen, nie entfernt werden.",
  },
  willChangeDate: {
    en: "The due date changes and the old date, the new date and your reason are added to the history.",
    de: "Das Faelligkeitsdatum aendert sich; altes Datum, neues Datum und Ihre Begruendung werden im Verlauf erfasst.",
  },
  willRequestEvidence: {
    en: "An evidence request is created and tracked as its own action, linked to this one.",
    de: "Eine Nachweisanforderung wird erstellt und als eigene, verknuepfte Massnahme verfolgt.",
  },
  willAddUpdate: { en: "One entry is added to the history.", de: "Ein Eintrag wird dem Verlauf hinzugefuegt." },
  willDraft: { en: "A reminder is drafted. Nothing is sent.", de: "Eine Erinnerung wird entworfen. Nichts wird gesendet." },
  willSend: {
    en: "A simulated message is recorded against the action and the history notes it. Nothing leaves this machine.",
    de: "Eine simulierte Nachricht wird zur Massnahme erfasst und im Verlauf vermerkt. Nichts verlaesst diesen Rechner.",
  },
  willComplete: {
    en: "The action closes, the cited evidence is attached to the closing entry, and Home and the related process update.",
    de: "Die Massnahme wird geschlossen, der zitierte Nachweis wird dem Abschlusseintrag beigefuegt, und Startseite und Prozess werden aktualisiert.",
  },
  willReopen: {
    en: "The action returns to open work and your reason is added to the history.",
    de: "Die Massnahme wird wieder offen und Ihre Begruendung wird im Verlauf erfasst.",
  },
  willEscalate: {
    en: "An escalation item is added to {committee} and the history notes it.",
    de: "Ein Eskalationspunkt wird {committee} hinzugefuegt und im Verlauf vermerkt.",
  },

  /* Forms */
  fieldOwner: { en: "New accountable owner", de: "Neue verantwortliche Person" },
  fieldReason: { en: "Reason", de: "Begruendung" },
  fieldNewDate: { en: "New due date", de: "Neues Faelligkeitsdatum" },
  fieldWhat: { en: "What evidence is needed", de: "Welcher Nachweis benoetigt wird" },
  fieldFrom: { en: "Requested from", de: "Angefordert bei" },
  fieldFromOwner: { en: "The action owner", de: "Die verantwortliche Person" },
  fieldNote: { en: "Update", de: "Update" },
  fieldBlocker: { en: "This update records a blocker", de: "Dieses Update erfasst ein Hindernis" },
  fieldClearBlocker: { en: "This update clears the blocker", de: "Dieses Update beseitigt das Hindernis" },
  fieldMessage: { en: "Reminder", de: "Erinnerung" },
  fieldEvidence: { en: "Evidence that supports closure", de: "Nachweis, der den Abschluss stuetzt" },
  fieldOtherEvidence: { en: "Other evidence reference", de: "Weitere Nachweisreferenz" },
  fieldCompletionNote: { en: "How the completion condition is met", de: "Wie die Abschlussbedingung erfuellt ist" },
  fieldEscalation: { en: "Why this needs the committee", de: "Warum dies den Ausschuss braucht" },
  confirmMaterial: {
    en: "I confirm this is my judgment, the completion condition is met and the evidence supports it.",
    de: "Ich bestaetige, dass dies meine Beurteilung ist, die Abschlussbedingung erfuellt ist und der Nachweis sie stuetzt.",
  },
  confirmChange: {
    en: "I confirm this change and that the reason is my own.",
    de: "Ich bestaetige diese Aenderung und dass die Begruendung meine eigene ist.",
  },
  submit: { en: "Record", de: "Erfassen" },
  submitSend: { en: "Send simulated reminder", de: "Simulierte Erinnerung senden" },
  cancel: { en: "Cancel", de: "Abbrechen" },
  working: { en: "Recording", de: "Wird erfasst" },
  drafting: { en: "Drafting", de: "Wird entworfen" },
  draftReady: {
    en: "Drafted by the AI Partner from the action record. Edit it before you send.",
    de: "Vom KI Partner aus dem Massnahmendatensatz entworfen. Bearbeiten Sie den Text vor dem Senden.",
  },
  receipt: { en: "What changed", de: "Was sich geaendert hat" },
  notExecuted: { en: "Not executed", de: "Nicht ausgefuehrt" },
} as const satisfies Record<string, Pair>;

/** The labels of history entries, by entry kind. */
export const ENTRY_LABELS = {
  UPD: { en: "Update", de: "Update" },
  CC: { en: "Completion condition agreed", de: "Abschlussbedingung vereinbart" },
  BLK: { en: "Blocker recorded", de: "Hindernis erfasst" },
  UNB: { en: "Blocker cleared", de: "Hindernis beseitigt" },
  ASN: { en: "Accountability transferred", de: "Verantwortung uebertragen" },
  DUE: { en: "Due date changed", de: "Faelligkeit geaendert" },
  CMP: { en: "Completed", de: "Abgeschlossen" },
  REO: { en: "Reopened", de: "Wieder geoeffnet" },
  ESC: { en: "Escalated", de: "Eskaliert" },
  RMD: { en: "Reminder sent", de: "Erinnerung gesendet" },
  REQ: { en: "Evidence requested", de: "Nachweis angefordert" },
  MTG: { en: "Meeting held", de: "Besprechung abgehalten" },
  CRT: { en: "Raised", de: "Erfasst" },
} as const satisfies Record<string, Pair>;
