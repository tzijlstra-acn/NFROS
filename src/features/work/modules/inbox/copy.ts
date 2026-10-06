/**
 * Copy for the Inbox module. Shared by both roles; the classifications and
 * the primary action each implies are in `roles/`, and the six source labels
 * are in `sources.ts`.
 *
 * Every operation states, before the person acts, what the AI prepared, what
 * the person decides, what will change and what approval is required, which
 * is the plan's rule that human authority is visible (section 9.5).
 */

import type { Pair } from "../../copy";

export const INBOX_COPY = {
  /* Views and groups */
  needsMe: { en: "Needs me", de: "Fuer mich" },
  converted: { en: "Converted to work", de: "In Arbeit ueberfuehrt" },
  handled: { en: "Handled", de: "Erledigt" },
  all: { en: "All", de: "Alle" },
  likelyNoise: { en: "Proposed as noise", de: "Als ohne Relevanz vorgeschlagen" },
  emptyTitle: { en: "No messages", de: "Keine Nachrichten" },
  emptyBody: {
    en: "No message has reached this role by the current moment of the day. Nothing is shown in its place.",
    de: "Bis zum aktuellen Zeitpunkt des Tages hat diese Rolle keine Nachricht erreicht. An ihrer Stelle wird nichts angezeigt.",
  },
  noneNeedsMe: { en: "Nothing in the inbox needs you.", de: "Im Posteingang wartet nichts auf Sie." },
  noneConverted: {
    en: "No message has been turned into work yet. A message that becomes an action, evidence, a process input or a delegation moves here.",
    de: "Noch keine Nachricht wurde in Arbeit ueberfuehrt. Eine Nachricht, die zu einer Massnahme, einem Nachweis, einem Prozesseingang oder einer Delegation wird, erscheint hier.",
  },
  noneHandled: {
    en: "No message has been filed, dismissed or answered without further work yet.",
    de: "Noch keine Nachricht wurde ohne weitere Arbeit abgelegt, verworfen oder beantwortet.",
  },
  summary: {
    en: "Needs you: {needsMe}. With a response deadline: {respond}. Converted to work: {converted}. Sources simulated.",
    de: "Fuer Sie: {needsMe}. Mit Antwortfrist: {respond}. In Arbeit ueberfuehrt: {converted}. Quellen simuliert.",
  },
  simulatedSource: {
    en: "{source} from the synthetic scenario. No connector delivered it.",
    de: "{source} aus dem synthetischen Szenario. Kein Konnektor hat sie zugestellt.",
  },
  simulated: { en: "Simulated", de: "Simuliert" },
  viaChannel: { en: "{source}, by {channel}", de: "{source}, per {channel}" },

  /* Chips */
  aiClass: { en: "AI: {label}", de: "KI: {label}" },
  confirmedClass: { en: "Confirmed: {label}", de: "Bestaetigt: {label}" },
  notClassified: { en: "Not classified", de: "Nicht eingeordnet" },
  duplicate: { en: "Duplicate", de: "Dublette" },
  respondBy: { en: "Respond by {when}", de: "Antwort bis {when}" },
  unread: { en: "Unread", de: "Ungelesen" },
  becameAction: { en: "Action {id}", de: "Massnahme {id}" },
  becameDecision: { en: "Decision {id}", de: "Entscheidung {id}" },
  becameEvidence: { en: "Evidence {id}", de: "Nachweis {id}" },
  becameStage: { en: "Stage: {stage}", de: "Stufe: {stage}" },
  becameDelegated: { en: "Delegated to {name}", de: "Delegiert an {name}" },
  more: { en: "+{count}", de: "+{count}" },
  closedFiled: { en: "Filed", de: "Abgelegt" },
  closedDismissed: { en: "Dismissed", de: "Verworfen" },
  closedReplied: { en: "Replied", de: "Beantwortet" },

  /* Classification block */
  classification: { en: "Proposed classification", de: "Vorgeschlagene Einordnung" },
  yourClassification: { en: "Your classification", de: "Ihre Einordnung" },
  rationale: { en: "Why", de: "Begruendung" },
  rationaleEnglish: { en: "Recorded in English with the message.", de: "Mit der Nachricht auf Englisch erfasst." },
  confidence: { en: "Confidence {value} percent", de: "Sicherheit {value} Prozent" },
  confidenceNone: { en: "Confidence not estimated", de: "Sicherheit nicht geschaetzt" },
  modeSafe: { en: "Safe", de: "Sicher" },
  modeOffline: { en: "Offline", de: "Offline" },
  modeUnavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
  confirmedBy: { en: "Recorded by {person} at {when}.", de: "Erfasst von {person} um {when}." },
  changedFrom: { en: "Changed from {from}. Reason: {reason}", de: "Geaendert von {from}. Begruendung: {reason}" },
  confirmedWithConversion: {
    en: "Recorded with the conversion, by {person} at {when}.",
    de: "Mit der Ueberfuehrung erfasst, von {person} um {when}.",
  },
  confirmedUnattributed: {
    en: "Recorded on the message, with no record of who recorded it.",
    de: "An der Nachricht erfasst, ohne Angabe, wer es erfasst hat.",
  },
  proposalStays: {
    en: "The AI's proposal and its rationale stay on record beside your classification.",
    de: "Der KI-Vorschlag und seine Begruendung bleiben neben Ihrer Einordnung erhalten.",
  },

  /* Lineage */
  became: { en: "What it became", de: "Was daraus wurde" },
  raisedFrom: { en: "Raised from this message", de: "Aus dieser Nachricht erfasst" },
  linkedFrom: { en: "Linked from this message", de: "Mit dieser Nachricht verknuepft" },
  routedTo: { en: "Routed to the decision", de: "An die Entscheidung weitergeleitet" },
  filedFrom: { en: "Filed from this message", de: "Aus dieser Nachricht abgelegt" },
  filedAgainst: { en: "Filed against {objects}", de: "Abgelegt zu {objects}" },
  attachedTo: { en: "Attached to {stage}", de: "Zugeordnet zu {stage}" },
  delegatedTo: { en: "Delegated with a simulated message", de: "Mit einer simulierten Nachricht delegiert" },
  repliedTo: { en: "Simulated reply to {name}", de: "Simulierte Antwort an {name}" },
  byWhen: { en: "{person}, {when}", de: "{person}, {when}" },
  nextStep: { en: "Next step", de: "Naechster Schritt" },
  otherWays: { en: "Other ways to handle it", de: "Weitere Moeglichkeiten" },
  nothingNext: {
    en: "Nothing else is needed from the inbox. The work continues where it went.",
    de: "Im Posteingang ist nichts weiter noetig. Die Arbeit geht dort weiter, wohin sie gegangen ist.",
  },
  deadlinePassed: { en: "Response deadline passed: {when}", de: "Antwortfrist abgelaufen: {when}" },
  body: { en: "Message", de: "Nachricht" },
  duplicateOf: { en: "Duplicate of an earlier message", de: "Dublette einer frueheren Nachricht" },
  linkedObject: { en: "Linked object", de: "Verknuepftes Objekt" },
  aiLimits: {
    en: "The AI proposes a classification and drafts replies. It does not convert, file, delegate or send anything: each of those is your step, through the authority gate.",
    de: "Die KI schlaegt eine Einordnung vor und entwirft Antworten. Sie ueberfuehrt, legt ab, delegiert oder sendet nichts: Jeder dieser Schritte ist Ihrer, ueber die Befugnispruefung.",
  },

  /* Operations */
  opConfirm: { en: "Confirm triage", de: "Einordnung bestaetigen" },
  opChange: { en: "Change triage", de: "Einordnung aendern" },
  opCreateAction: { en: "Create action", de: "Massnahme anlegen" },
  opLinkEvidence: { en: "Link as evidence", de: "Als Nachweis verknuepfen" },
  opAddToProcess: { en: "Add to process", de: "Zum Prozess hinzufuegen" },
  opDelegate: { en: "Delegate", de: "Delegieren" },
  opDraftReply: { en: "Draft reply", de: "Antwort entwerfen" },
  opSendReply: { en: "Send simulated reply", de: "Simulierte Antwort senden" },
  opDismiss: { en: "Dismiss", de: "Verwerfen" },

  aiPreparedTriage: { en: "The classification above and its rationale.", de: "Die Einordnung oben und ihre Begruendung." },
  aiPreparedNone: { en: "Nothing. This step is yours alone.", de: "Nichts. Dieser Schritt ist allein Ihrer." },
  aiPreparedReply: { en: "The reply draft below. Nothing has been sent.", de: "Der Antwortentwurf unten. Nichts wurde gesendet." },
  aiPreparedDelegate: { en: "The colleague the rationale names, as a suggestion.", de: "Die in der Begruendung genannte Person, als Vorschlag." },
  youDecideConfirm: { en: "Whether the classification is right.", de: "Ob die Einordnung zutrifft." },
  youDecideChange: { en: "The classification, and why.", de: "Die Einordnung und warum." },
  youDecideAction: { en: "What the action is, who owns it and by when.", de: "Was die Massnahme ist, wer sie verantwortet und bis wann." },
  youDecideEvidence: { en: "What the message is evidence of, and for which objects.", de: "Wofuer die Nachricht ein Nachweis ist, und zu welchen Objekten." },
  youDecideProcess: { en: "Which running process and stage the message belongs to.", de: "Zu welchem laufenden Prozess und welcher Stufe die Nachricht gehoert." },
  youDecideDelegate: { en: "Who takes it on, and what they need to know.", de: "Wer sie uebernimmt und was die Person wissen muss." },
  youDecideReply: { en: "What the reply says, and whether to send it.", de: "Was die Antwort sagt und ob sie gesendet wird." },
  youDecideDismiss: { en: "That the message needs nothing, and why.", de: "Dass die Nachricht nichts erfordert, und warum." },

  willConfirm: {
    en: "The classification is recorded as yours. The message stays in Needs me until it is turned into work, filed or dismissed.",
    de: "Die Einordnung wird als Ihre erfasst. Die Nachricht bleibt unter Fuer mich, bis sie in Arbeit ueberfuehrt, abgelegt oder verworfen ist.",
  },
  willFile: {
    en: "The message is filed as information and leaves Needs me. It stays searchable.",
    de: "Die Nachricht wird als Information abgelegt und verlaesst Fuer mich. Sie bleibt auffindbar.",
  },
  willRoute: {
    en: "The message is linked to decision {id} and moves to Converted to work. The judgment stays on Decisions.",
    de: "Die Nachricht wird mit der Entscheidung {id} verknuepft und erscheint unter In Arbeit ueberfuehrt. Die Beurteilung bleibt unter Entscheidungen.",
  },
  willChange: {
    en: "Your classification replaces the proposal as the message's triage, with your reason.",
    de: "Ihre Einordnung ersetzt den Vorschlag als Einordnung der Nachricht, mit Ihrer Begruendung.",
  },
  willCreateAction: {
    en: "A new action is created with an owner and a due date, with this message as its source. The message moves to Converted to work and the action's history records where it came from.",
    de: "Eine neue Massnahme wird mit verantwortlicher Person und Faelligkeit angelegt, mit dieser Nachricht als Quelle. Die Nachricht erscheint unter In Arbeit ueberfuehrt, und der Verlauf der Massnahme haelt fest, woher sie kam.",
  },
  willLinkAction: {
    en: "The message is linked to action {id}, an entry is added to the action's history, and the message moves to Converted to work.",
    de: "Die Nachricht wird mit der Massnahme {id} verknuepft, im Verlauf der Massnahme wird ein Eintrag ergaenzt, und die Nachricht erscheint unter In Arbeit ueberfuehrt.",
  },
  willLinkEvidence: {
    en: "The message is filed as an evidence document against the objects you choose, with this message as its source, and moves to Converted to work.",
    de: "Die Nachricht wird als Nachweisdokument zu den gewaehlten Objekten abgelegt, mit dieser Nachricht als Quelle, und erscheint unter In Arbeit ueberfuehrt.",
  },
  willAddToProcess: {
    en: "The message is attached to the stage you choose. The stage's activity shows it, and the message moves to Converted to work.",
    de: "Die Nachricht wird der gewaehlten Stufe zugeordnet. Der Verlauf der Stufe zeigt sie, und die Nachricht erscheint unter In Arbeit ueberfuehrt.",
  },
  willDelegate: {
    en: "A simulated internal message passes it to the person you choose. Nothing leaves this machine. The message moves to Converted to work.",
    de: "Eine simulierte interne Nachricht gibt sie an die gewaehlte Person weiter. Nichts verlaesst diesen Rechner. Die Nachricht erscheint unter In Arbeit ueberfuehrt.",
  },
  willDraft: {
    en: "Nothing is written. A reply is drafted from the message and what was done with it, for you to edit.",
    de: "Nichts wird geschrieben. Eine Antwort wird aus der Nachricht und dem bisher Erledigten entworfen, zur Bearbeitung durch Sie.",
  },
  willSend: {
    en: "A simulated reply is recorded against the message. Nothing leaves this machine.",
    de: "Eine simulierte Antwort wird zur Nachricht erfasst. Nichts verlaesst diesen Rechner.",
  },
  willDismiss: {
    en: "The message is recorded as noise, with your reason, and leaves Needs me. It stays searchable.",
    de: "Die Nachricht wird mit Ihrer Begruendung als ohne Relevanz erfasst und verlaesst Fuer mich. Sie bleibt auffindbar.",
  },

  /* Fields */
  fieldClassification: { en: "Classification", de: "Einordnung" },
  fieldReason: { en: "Reason", de: "Begruendung" },
  fieldTitle: { en: "Action title", de: "Titel der Massnahme" },
  fieldKind: { en: "Kind", de: "Art" },
  fieldOwner: { en: "Accountable owner", de: "Verantwortlich" },
  fieldDue: { en: "Due", de: "Faellig" },
  fieldExisting: { en: "Link to the existing action {id} instead", de: "Stattdessen mit der bestehenden Massnahme {id} verknuepfen" },
  fieldObjects: { en: "File against", de: "Ablegen zu" },
  fieldEvidenceTitle: { en: "Document title", de: "Dokumenttitel" },
  fieldProcess: { en: "Process and stage", de: "Prozess und Stufe" },
  fieldDelegateTo: { en: "Delegate to", de: "Delegieren an" },
  fieldNote: { en: "Note", de: "Notiz" },
  fieldSubject: { en: "Subject", de: "Betreff" },
  fieldBody: { en: "Message", de: "Nachricht" },
  suggested: { en: "named in the rationale", de: "in der Begruendung genannt" },
  currentStage: { en: "current stage", de: "aktuelle Stufe" },
  coversObject: { en: "covers {object}", de: "umfasst {object}" },
  notInScope: {
    en: "{object} is not in the scope of this process. Attach the message only if it belongs there.",
    de: "{object} liegt nicht im Umfang dieses Prozesses. Ordnen Sie die Nachricht nur zu, wenn sie dorthin gehoert.",
  },
  noOpenStage: {
    en: "No running process of this role has an open stage, so there is nothing to attach the message to.",
    de: "Kein laufender Prozess dieser Rolle hat eine offene Stufe, daher gibt es nichts, dem die Nachricht zugeordnet werden kann.",
  },
  replyTo: { en: "To {name}. Simulated: nothing leaves this machine.", de: "An {name}. Simuliert: Nichts verlaesst diesen Rechner." },
  draftReady: {
    en: "Drafted from the message and what has been done with it. Nothing has been sent. Edit it before sending.",
    de: "Aus der Nachricht und dem bisher Erledigten entworfen. Nichts wurde gesendet. Bearbeiten Sie den Entwurf vor dem Senden.",
  },
  confirmMaterial: {
    en: "I confirm the action, its owner, its due date and the reason are my own judgment.",
    de: "Ich bestaetige, dass Massnahme, verantwortliche Person, Faelligkeit und Begruendung meine eigene Beurteilung sind.",
  },
  approvalMaterial: {
    en: "Material: recorded as your approval, bound to exactly this action, and consumed once.",
    de: "Wesentlich: als Ihre Genehmigung erfasst, an genau diese Massnahme gebunden und einmal verbraucht.",
  },
  approvalYours: {
    en: "Recorded as your approval, bound to exactly this change.",
    de: "Als Ihre Genehmigung erfasst, gebunden an genau diese Aenderung.",
  },
  approvalNone: {
    en: "No approval needed at this autonomy level; the change is audited.",
    de: "Auf dieser Autonomiestufe keine Genehmigung erforderlich; die Aenderung wird protokolliert.",
  },
  approvalDraft: { en: "The draft writes nothing.", de: "Der Entwurf schreibt nichts." },
  approvalSendYours: {
    en: "Sending it is recorded as your approval, bound to exactly that reply.",
    de: "Das Senden wird als Ihre Genehmigung erfasst, gebunden an genau diese Antwort.",
  },
  unavailableToConfirm: {
    en: "No classification is proposed, so there is nothing to confirm. Use Change triage to classify it.",
    de: "Es wird keine Einordnung vorgeschlagen, daher gibt es nichts zu bestaetigen. Ordnen Sie sie mit Einordnung aendern ein.",
  },
  alreadyConfirmed: { en: "Already confirmed.", de: "Bereits bestaetigt." },
  submit: { en: "Record", de: "Erfassen" },
  working: { en: "Recording", de: "Wird erfasst" },
  cancel: { en: "Cancel", de: "Abbrechen" },
  receipt: { en: "Receipt", de: "Beleg" },
  notRegistered: {
    en: "This operation is not registered with the authority gate.",
    de: "Dieser Vorgang ist bei der Befugnispruefung nicht registriert.",
  },

  /* Why an operation is not offered */
  noReplyAddress: {
    en: "The sender has no person record in the scenario, so a reply cannot be addressed.",
    de: "Fuer den Absender gibt es im Szenario keinen Personeneintrag, daher kann keine Antwort adressiert werden.",
  },
  alreadyActionShort: { en: "Already became action {id}.", de: "Bereits zur Massnahme {id} geworden." },
  alreadyFiledShort: { en: "Already filed as evidence {id}.", de: "Bereits als Nachweis {id} abgelegt." },
  alreadyDismissedShort: { en: "Already dismissed.", de: "Bereits verworfen." },
  alreadyDelegatedShort: { en: "Already delegated to {name}.", de: "Bereits an {name} delegiert." },

  /* History */
  historyTriage: { en: "Triage", de: "Einordnung" },
  historyConverted: { en: "Converted", de: "Ueberfuehrt" },
  historyDelegated: { en: "Delegated", de: "Delegiert" },
  historyReply: { en: "Reply", de: "Antwort" },
} as const satisfies Record<string, Pair>;
