/**
 * Copy for the V3.3 decision workspace.
 *
 * Every user visible string in this feature has an English and a German form,
 * which is the `{ en, de }` pattern the rest of the V3.3 surface uses. German
 * is written in ASCII transliteration: `ae`, `oe`, `ue`, `ss`. That is not a
 * preference about typography, it is the repository's rule, and it holds for
 * seeded data and test fixtures as well as for interface copy.
 *
 * Labels that already exist elsewhere are imported rather than restated. The
 * regulatory disclosure and the rationale confirmation in particular come from
 * `src/i18n/labels.ts`, because a second wording of either would eventually
 * disagree with the first.
 */

import type { AuthorityClass } from "@/db/schema/decisions";
import type { Language } from "@/i18n/labels";
import type { DecisionStage } from "./model";

export interface Pair {
  en: string;
  de: string;
}

/** Picks the right side of a bilingual pair. */
export function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

/** Fills `{name}` placeholders. Unknown names are left as written, so a gap is visible. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/* ==========================================================================
   The five parts
   ========================================================================== */

export const STAGE_LABELS: Record<DecisionStage, Pair> = {
  question: { en: "Question", de: "Frage" },
  context: { en: "Context", de: "Kontext" },
  evidence: { en: "Evidence", de: "Nachweise" },
  options: { en: "Options", de: "Optionen" },
  confirm: { en: "Confirm and execute", de: "Bestaetigen und ausfuehren" },
};

/** One line saying what the part is for. Read once, then ignored. */
/*
 * Short on purpose. The hint shares a row with a five step indicator, and at
 * 1366 a longer hint wraps under it and costs the part a line.
 */
export const STAGE_HINTS: Record<DecisionStage, Pair> = {
  question: {
    en: "The judgment that is yours.",
    de: "Das Urteil, das bei Ihnen liegt.",
  },
  context: {
    en: "Why, what waits on it, by when.",
    de: "Warum, was davon abhaengt, bis wann.",
  },
  evidence: {
    en: "The strongest case each way.",
    de: "Der staerkste Nachweis je Seite.",
  },
  /*
   * The options hint carries the doctrine rather than an orientation: the
   * part is a choice, and nothing in it is chosen for the reader.
   */
  options: {
    en: "Nothing is pre-selected.",
    de: "Nichts ist vorausgewaehlt.",
  },
  confirm: {
    en: "Approve each exact change.",
    de: "Jede genaue Aenderung genehmigen.",
  },
};

/* ==========================================================================
   Authority
   ========================================================================== */

/**
 * The authority class labels.
 *
 * The same six classes and the same wording the V2 surface uses, so a reviewer
 * comparing the two versions reads one vocabulary. Imported by the Work Hub as
 * well, so the wording is shared rather than copied.
 */
export const AUTHORITY_LABELS: Record<AuthorityClass, Pair> = {
  READ: { en: "Read", de: "Lesen" },
  DRAFT: { en: "Draft", de: "Entwurf" },
  PROPOSE: { en: "Proposal", de: "Vorschlag" },
  APPROVAL_REQUIRED: { en: "Approval required", de: "Genehmigung erforderlich" },
  POLICY_BOUND_AUTONOMOUS: { en: "Within policy", de: "Innerhalb der Richtlinie" },
  PROHIBITED: { en: "Not permitted", de: "Nicht zulaessig" },
};

export const AUTHORITY_TONES: Record<AuthorityClass, string> = {
  READ: "neutral",
  DRAFT: "neutral",
  PROPOSE: "info",
  APPROVAL_REQUIRED: "warning",
  POLICY_BOUND_AUTONOMOUS: "accent",
  PROHIBITED: "danger",
};

/* ==========================================================================
   Judgment kinds
   ========================================================================== */

export const JUDGMENT_LABELS: Record<string, Pair> = {
  materiality: { en: "Materiality", de: "Wesentlichkeit" },
  "control-effectiveness": { en: "Control effectiveness", de: "Kontrollwirksamkeit" },
  "residual-risk": { en: "Residual risk", de: "Restrisiko" },
  severity: { en: "Severity", de: "Schweregrad" },
  criticality: { en: "Criticality", de: "Kritikalitaet" },
  applicability: { en: "Applicability", de: "Anwendbarkeit" },
  "assurance-conclusion": { en: "Assurance conclusion", de: "Pruefungsaussage" },
  "conditional-approval": { en: "Conditional approval", de: "Bedingte Genehmigung" },
  escalation: { en: "Escalation", de: "Eskalation" },
  agenda: { en: "Agenda", de: "Agenda" },
  "risk-acceptance": { en: "Risk acceptance", de: "Risikoakzeptanz" },
  "evidence-adequacy": { en: "Evidence adequacy", de: "Angemessenheit der Nachweise" },
};

export const JUDGMENT_FALLBACK: Pair = { en: "Judgment", de: "Urteil" };

/* ==========================================================================
   Consequences
   ========================================================================== */

/**
 * What a declared consequence would change, in plain language.
 *
 * These describe the seeded consequence kinds, which the scenario engine maps
 * onto typed tools. An unlisted kind falls back to its own identifier rather
 * than being hidden, because a reader about to approve a change is owed the
 * truth that one line of it is unlabelled.
 */
export const CONSEQUENCE_LABELS: Record<string, Pair> = {
  "set-control-effectiveness": {
    en: "Change the recorded control effectiveness",
    de: "Erfasste Kontrollwirksamkeit aendern",
  },
  "version-assessment": {
    en: "Create a new assessment version",
    de: "Neue Version der Bewertung erstellen",
  },
  "set-residual-risk": {
    en: "Record a residual risk position",
    de: "Restrisikoposition erfassen",
  },
  "create-reassessment": {
    en: "Initiate an off cycle reassessment",
    de: "Neubewertung ausserhalb des Zyklus anstossen",
  },
  "create-action": {
    en: "Create a remediation action with an owner and a due date",
    de: "Massnahme mit Verantwortlichem und Termin anlegen",
  },
  "create-issue": { en: "Raise an issue", de: "Sachverhalt eroeffnen" },
  "add-committee-item": {
    en: "Add an item to the committee agenda",
    de: "Punkt auf die Agenda des Gremiums setzen",
  },
  "activate-monitoring": {
    en: "Activate enhanced monitoring",
    de: "Verstaerkte Ueberwachung aktivieren",
  },
  "send-collaboration-message": {
    en: "Post a simulated internal message",
    de: "Simulierte interne Nachricht veroeffentlichen",
  },
  "request-factual-validation": {
    en: "Ask the first line to validate a factual point",
    de: "Sachverhaltsklaerung bei der ersten Linie anfordern",
  },
  "set-supplier-criticality": {
    en: "Change the recorded supplier criticality",
    de: "Erfasste Kritikalitaet des Lieferanten aendern",
  },
  "record-supplier-assessment": {
    en: "Record a supplier assessment conclusion",
    de: "Ergebnis der Lieferantenbewertung erfassen",
  },
  "apply-supplier-restriction": {
    en: "Apply a restriction to the arrangement",
    de: "Einschraenkung der Vereinbarung anwenden",
  },
  "record-test-conclusion": {
    en: "Record the assurance conclusion",
    de: "Pruefungsaussage erfassen",
  },
  "classify-test-exception": {
    en: "Classify an exception and its scope",
    de: "Abweichung und ihren Umfang einordnen",
  },
  "record-finding": { en: "Record a finding", de: "Feststellung erfassen" },
  "classify-incident": {
    en: "Record the incident severity and classification",
    de: "Schweregrad und Einordnung des Vorfalls erfassen",
  },
  "escalate-incident": { en: "Escalate the incident", de: "Vorfall eskalieren" },
  "record-notification-recommendation": {
    en: "Record a recommendation on supervisory notification",
    de: "Empfehlung zur aufsichtlichen Meldung erfassen",
  },
  "select-recovery-option": {
    en: "Record the selected recovery option",
    de: "Gewaehlte Wiederherstellungsoption erfassen",
  },
  "capture-lessons-learned": { en: "Record lessons learned", de: "Erkenntnisse erfassen" },
  "record-obligation-interpretation": {
    en: "Record the obligation interpretation and applicability",
    de: "Auslegung und Anwendbarkeit der Pflicht erfassen",
  },
  "set-portfolio-materiality": {
    en: "Record portfolio materiality",
    de: "Wesentlichkeit im Portfolio erfassen",
  },
  "request-evidence": {
    en: "Record a request for a missing evidence document",
    de: "Anforderung eines fehlenden Nachweises erfassen",
  },
};

/**
 * What a change that executed did, in the past tense.
 *
 * The receipt statements the tool handlers write are English. In German the
 * receipt line is composed from this label and the record it changed, so a
 * German reader is not handed an English sentence as the proof of a change.
 */
export const RECEIPT_LABELS: Record<string, Pair> = {
  "set-control-effectiveness": { en: "Control effectiveness changed", de: "Kontrollwirksamkeit geaendert" },
  "version-assessment": { en: "Assessment version created", de: "Neue Bewertungsversion erstellt" },
  "set-residual-risk": { en: "Residual risk recorded", de: "Restrisiko erfasst" },
  "create-reassessment": { en: "Off cycle reassessment created", de: "Neubewertung ausserhalb des Zyklus angelegt" },
  "create-action": { en: "Action created", de: "Massnahme angelegt" },
  "create-issue": { en: "Issue raised", de: "Sachverhalt eroeffnet" },
  "add-committee-item": { en: "Committee agenda updated", de: "Agenda des Gremiums ergaenzt" },
  "activate-monitoring": { en: "Monitoring activated", de: "Ueberwachung aktiviert" },
  "send-collaboration-message": { en: "Simulated message posted", de: "Simulierte Nachricht veroeffentlicht" },
  "request-factual-validation": { en: "Factual validation requested", de: "Sachverhaltsklaerung angefordert" },
  "set-supplier-criticality": { en: "Supplier criticality changed", de: "Kritikalitaet des Lieferanten geaendert" },
  "record-supplier-assessment": { en: "Supplier assessment recorded", de: "Lieferantenbewertung erfasst" },
  "apply-supplier-restriction": { en: "Restriction applied", de: "Einschraenkung angewendet" },
  "record-test-conclusion": { en: "Assurance conclusion recorded", de: "Pruefungsaussage erfasst" },
  "classify-test-exception": { en: "Exception classified", de: "Abweichung eingeordnet" },
  "record-finding": { en: "Finding recorded", de: "Feststellung erfasst" },
  "classify-incident": { en: "Incident classification recorded", de: "Einordnung des Vorfalls erfasst" },
  "escalate-incident": { en: "Escalation recorded", de: "Eskalation erfasst" },
  "record-notification-recommendation": { en: "Notification recommendation recorded", de: "Meldeempfehlung erfasst" },
  "select-recovery-option": { en: "Recovery option recorded", de: "Wiederherstellungsoption erfasst" },
  "capture-lessons-learned": { en: "Lessons learned recorded", de: "Erkenntnisse erfasst" },
  "record-obligation-interpretation": { en: "Obligation interpretation recorded", de: "Auslegung der Pflicht erfasst" },
  "set-portfolio-materiality": { en: "Portfolio materiality recorded", de: "Wesentlichkeit im Portfolio erfasst" },
  "request-evidence": { en: "Evidence requested", de: "Nachweis angefordert" },
};

/**
 * The register each governed tool writes.
 *
 * Every consequence of a decision executes locally through `executeTool`, so
 * the system is this workspace for all of them. The register is named so the
 * reader approving a change knows exactly which record set it touches.
 */
export const TOOL_REGISTERS: Record<string, Pair> = {
  updateControlRating: { en: "Control register", de: "Kontrollregister" },
  updateAssessment: { en: "RCSA assessments", de: "RCSA-Bewertungen" },
  proposeAndRecordResidualRisk: { en: "RCSA assessment lines", de: "RCSA-Bewertungszeilen" },
  initiateReassessment: { en: "RCSA assessments", de: "RCSA-Bewertungen" },
  createAction: { en: "Action tracker", de: "Massnahmenverfolgung" },
  createIssue: { en: "Issue log", de: "Sachverhaltsregister" },
  addCommitteeAgendaItem: { en: "Committee agenda", de: "Agenda des Gremiums" },
  activateMonitoring: { en: "Monitoring plan", de: "Ueberwachungsplan" },
  sendSimulatedCollaborationMessage: { en: "Collaboration channel, simulated", de: "Kollaborationskanal, simuliert" },
  requestFactualValidation: { en: "First line requests, simulated", de: "Anfragen an die erste Linie, simuliert" },
  setSupplierCriticality: { en: "Third-party register", de: "Drittparteienregister" },
  recordSupplierAssessment: { en: "Third-party register", de: "Drittparteienregister" },
  applySupplierRestriction: { en: "Third-party register", de: "Drittparteienregister" },
  recordTestConclusion: { en: "Control testing record", de: "Kontrolltest-Akte" },
  classifyTestException: { en: "Control testing record", de: "Kontrolltest-Akte" },
  recordFinding: { en: "Findings register", de: "Feststellungsregister" },
  classifyIncident: { en: "Incident record", de: "Vorfallakte" },
  escalateIncident: { en: "Incident record", de: "Vorfallakte" },
  recordNotificationRecommendation: { en: "Incident record", de: "Vorfallakte" },
  selectRecoveryOption: { en: "Incident record", de: "Vorfallakte" },
  captureLessonsLearned: { en: "Incident record", de: "Vorfallakte" },
  recordObligationInterpretation: { en: "Obligation register", de: "Pflichtenregister" },
  setPortfolioMateriality: { en: "Portfolio themes", de: "Portfoliothemen" },
  requestEvidenceDocument: { en: "Evidence requests", de: "Nachweisanforderungen" },
};

export const REGISTER_FALLBACK: Pair = { en: "Workspace record", de: "Datensatz im Arbeitsbereich" };

/** Where every register here lives. Stated, because "which system" is the question. */
export const LOCAL_SYSTEM: Pair = {
  en: "This workspace, local record. No external system is written.",
  de: "Dieser Arbeitsbereich, lokaler Datensatz. Kein externes System wird beschrieben.",
};

/** Labels for the fields of an exact payload. An unlisted field shows its own name. */
export const PAYLOAD_FIELD_LABELS: Record<string, Pair> = {
  decisionId: { en: "Decision", de: "Entscheidung" },
  entityId: { en: "Legal entity", de: "Gesellschaft" },
  controlId: { en: "Control", de: "Kontrolle" },
  effectiveness: { en: "Effectiveness", de: "Wirksamkeit" },
  assessmentId: { en: "Assessment", de: "Bewertung" },
  assessmentLineId: { en: "Assessment line", de: "Bewertungszeile" },
  residualRisk: { en: "Residual risk", de: "Restrisiko" },
  residualLikelihood: { en: "Residual likelihood", de: "Restwahrscheinlichkeit" },
  residualImpact: { en: "Residual impact", de: "Restauswirkung" },
  conclusion: { en: "Conclusion", de: "Schlussfolgerung" },
  rationale: { en: "Recorded basis", de: "Erfasste Grundlage" },
  commentary: { en: "Commentary", de: "Kommentar" },
  subjectId: { en: "Subject", de: "Gegenstand" },
  subjectKind: { en: "Subject type", de: "Art des Gegenstands" },
  scope: { en: "Scope", de: "Umfang" },
  title: { en: "Title", de: "Titel" },
  description: { en: "Description", de: "Beschreibung" },
  summary: { en: "Summary", de: "Zusammenfassung" },
  relatedObjectId: { en: "Related record", de: "Bezogener Datensatz" },
  relatedObjectKind: { en: "Related record type", de: "Art des bezogenen Datensatzes" },
  kind: { en: "Kind", de: "Art" },
  dueOn: { en: "Due on", de: "Faellig am" },
  reviewFrequency: { en: "Review frequency", de: "Pruefrhythmus" },
  nextReviewOn: { en: "Next review", de: "Naechste Pruefung" },
  subject: { en: "Subject line", de: "Betreff" },
  body: { en: "Message", de: "Nachricht" },
  toUserIds: { en: "Recipients", de: "Empfaenger" },
  question: { en: "Question", de: "Frage" },
  topic: { en: "Topic", de: "Thema" },
  supplierId: { en: "Supplier", de: "Lieferant" },
  criticality: { en: "Criticality", de: "Kritikalitaet" },
  restriction: { en: "Restriction", de: "Einschraenkung" },
  documentDescription: { en: "Document requested", de: "Angeforderter Nachweis" },
  controlTestId: { en: "Control test", de: "Kontrolltest" },
  testCaseId: { en: "Test case", de: "Testfall" },
  classification: { en: "Classification", de: "Einordnung" },
  severity: { en: "Severity", de: "Schweregrad" },
  incidentId: { en: "Incident", de: "Vorfall" },
  regulatoryClassification: { en: "Regulatory classification", de: "Regulatorische Einordnung" },
  escalateTo: { en: "Escalate to", de: "Eskalieren an" },
  recommended: { en: "Recommended", de: "Empfohlen" },
  recoveryOptionId: { en: "Recovery option", de: "Wiederherstellungsoption" },
  lessonsLearned: { en: "Lessons learned", de: "Erkenntnisse" },
  obligationId: { en: "Obligation", de: "Pflicht" },
  applicabilityDecision: { en: "Applicability", de: "Anwendbarkeit" },
  ownerUserId: { en: "Owner", de: "Verantwortlich" },
  implementationPriority: { en: "Implementation priority", de: "Umsetzungsprioritaet" },
  themeId: { en: "Portfolio theme", de: "Portfoliothema" },
  materiality: { en: "Materiality", de: "Wesentlichkeit" },
};

/* ==========================================================================
   Recorded values
   ========================================================================== */

/**
 * The enumerated values the registers hold, as words.
 *
 * Used for the current position and for payload values. A value that is not
 * listed is shown with its hyphens replaced, which is readable in English and
 * marked as a gap in German review rather than translated by guesswork.
 */
export const VALUE_LABELS: Record<string, Pair> = {
  "fully-effective": { en: "Fully effective", de: "Voll wirksam" },
  "largely-effective": { en: "Largely effective", de: "Weitgehend wirksam" },
  "partially-effective": { en: "Partially effective", de: "Teilweise wirksam" },
  "not-effective": { en: "Not effective", de: "Nicht wirksam" },
  ineffective: { en: "Ineffective", de: "Unwirksam" },
  green: { en: "Green", de: "Gruen" },
  amber: { en: "Amber", de: "Gelb" },
  red: { en: "Red", de: "Rot" },
  within: { en: "Within appetite", de: "Innerhalb der Risikoneigung" },
  "at-limit": { en: "At the appetite limit", de: "An der Grenze der Risikoneigung" },
  outside: { en: "Outside appetite", de: "Ausserhalb der Risikoneigung" },
  critical: { en: "Critical", de: "Kritisch" },
  important: { en: "Important", de: "Wichtig" },
  standard: { en: "Standard", de: "Standard" },
  active: { en: "Active", de: "Aktiv" },
  "under-reassessment": { en: "Under reassessment", de: "In Neubewertung" },
  "exit-planned": { en: "Exit planned", de: "Ausstieg geplant" },
  draft: { en: "Draft", de: "Entwurf" },
  approved: { en: "Approved", de: "Genehmigt" },
  superseded: { en: "Superseded", de: "Ersetzt" },
  "off-cycle": { en: "Off cycle", de: "Ausserhalb des Zyklus" },
  unagreed: { en: "Not agreed", de: "Nicht abgestimmt" },
  low: { en: "Low", de: "Niedrig" },
  medium: { en: "Medium", de: "Mittel" },
  "medium-high": { en: "Medium-High", de: "Mittel bis hoch" },
  high: { en: "High", de: "Hoch" },
  weekly: { en: "Weekly", de: "Woechentlich" },
  supplier: { en: "Supplier", de: "Lieferant" },
  control: { en: "Control", de: "Kontrolle" },
  kri: { en: "Indicator", de: "Indikator" },
  process: { en: "Process", de: "Prozess" },
  decision: { en: "Decision", de: "Entscheidung" },
  remediation: { en: "Remediation", de: "Behebung" },
  current: { en: "Current", de: "Aktuell" },
  requested: { en: "Requested, not received", de: "Angefordert, nicht eingegangen" },
  missing: { en: "Missing", de: "Fehlt" },
  true: { en: "Yes", de: "Ja" },
  false: { en: "No", de: "Nein" },
};

/** What the affected object is, as a noun. */
export const SUBJECT_KIND_LABELS: Record<string, Pair> = {
  control: { en: "Control", de: "Kontrolle" },
  kri: { en: "Key risk indicator", de: "Risikoindikator" },
  risk: { en: "Risk", de: "Risiko" },
  supplier: { en: "Supplier", de: "Lieferant" },
  contract: { en: "Contract", de: "Vertrag" },
  assessment: { en: "Assessment", de: "Bewertung" },
  process: { en: "Process", de: "Prozess" },
  decision: { en: "Decision", de: "Entscheidung" },
};

/* ==========================================================================
   Interface copy
   ========================================================================== */

export const COPY = {
  queueLabel: { en: "Decision queue", de: "Entscheidungsliste" },
  oneAtATime: {
    en: "One decision is open at a time.",
    de: "Es ist jeweils eine Entscheidung geoeffnet.",
  },
  contextOpen: { en: "{count} open", de: "{count} offen" },
  contextInStage: { en: "{count} in a process stage", de: "{count} in einer Prozessstufe" },
  contextRecorded: { en: "{count} recorded today", de: "{count} heute erfasst" },
  recordedToday: { en: "Recorded today", de: "Heute erfasst" },
  nothingOpen: { en: "No decision needs you at this point", de: "Keine Entscheidung offen" },
  nothingOpenDetail: {
    en: "Move the day forward to reach the next point where this role's judgment is required.",
    de: "Bewegen Sie den Tag vorwaerts, bis das Urteil dieser Rolle gefragt ist.",
  },
  stageOf: { en: "Decision workspace", de: "Entscheidungsarbeitsbereich" },
  back: { en: "Back", de: "Zurueck" },
  forward: { en: "Next", de: "Weiter" },
  openRow: { en: "Open this decision", de: "Diese Entscheidung oeffnen" },
  openReceipt: { en: "Open the receipt", de: "Beleg oeffnen" },
  active: { en: "Open", de: "Geoeffnet" },
  /*
   * Shown in German only. The seeded question, context, evidence summaries
   * and option implications have no German form in the seed, and a German
   * reader is told so rather than handed English text without a word.
   */
  englishProse: {
    en: "The decision text is shown as recorded.",
    de: "Die Fachtexte dieser Entscheidung liegen nur auf Englisch vor.",
  },

  /* 1. Question */
  theQuestion: { en: "The question", de: "Die Frage" },
  aiPrepared: { en: "What the AI prepared", de: "Was die KI vorbereitet hat" },
  youDecide: { en: "What you decide", de: "Was Sie entscheiden" },
  willChangeSummary: { en: "What will change", de: "Was sich aendert" },
  approvalRequiredSummary: { en: "What approval is required", de: "Welche Genehmigung noetig ist" },
  preparedSummary: {
    en: "A position with {count} cited documents and its stated uncertainty.",
    de: "Eine Position mit {count} zitierten Nachweisen und ihrer angegebenen Unsicherheit.",
  },
  decidesSummary: {
    en: "One of {count} options, with your own rationale.",
    de: "Eine von {count} Optionen, mit Ihrer eigenen Begruendung.",
  },
  changesSummary: {
    en: "Between {min} and {max} records, depending on the option.",
    de: "Zwischen {min} und {max} Datensaetzen, je nach Option.",
  },
  changesSummaryExact: {
    en: "{count} records with any option.",
    de: "{count} Datensaetze bei jeder Option.",
  },
  approvalSummary: {
    en: "{name} approves each change separately.",
    de: "{name} genehmigt jede Aenderung einzeln.",
  },
  approvalSummaryNone: {
    en: "No approval is needed at the current autonomy level.",
    de: "Auf der aktuellen Autonomiestufe ist keine Genehmigung noetig.",
  },

  /* 2. Context */
  trigger: { en: "Why this decision exists", de: "Warum diese Entscheidung ansteht" },
  presentedAt: { en: "Presented at {moment}", de: "Vorgelegt um {moment}" },
  sharedEvent: { en: "Arrived with the 14:05 event", de: "Mit dem Ereignis um 14:05 eingegangen" },
  processStage: { en: "Process stage", de: "Prozessstufe" },
  noProcess: {
    en: "Not part of a running process. No stage is waiting on it.",
    de: "Nicht Teil eines laufenden Prozesses. Keine Stufe wartet darauf.",
  },
  stageCurrent: { en: "The process is at this stage", de: "Der Prozess steht in dieser Stufe" },
  stageOpenNotCurrent: { en: "Stage opened, the process is elsewhere", de: "Stufe geoeffnet, der Prozess steht anderswo" },
  stageCompleted: { en: "Stage completed", de: "Stufe abgeschlossen" },
  stageNotOpened: { en: "Stage not opened yet", de: "Stufe noch nicht geoeffnet" },
  noRun: { en: "No run of this process is seeded", de: "Kein Lauf dieses Prozesses vorhanden" },
  meeting: { en: "Meeting", de: "Besprechung" },
  noMeeting: { en: "No meeting is held on this subject today.", de: "Heute findet keine Besprechung zu diesem Gegenstand statt." },
  meetingBasis: { en: "{time}, same subject", de: "{time}, gleicher Gegenstand" },
  meetingBasisEvidence: { en: "{time}, shares {count} cited documents", de: "{time}, teilt {count} zitierte Nachweise" },
  meetingHeld: { en: "held", de: "stattgefunden" },
  affected: { en: "Affected object", de: "Betroffener Gegenstand" },
  noAffected: { en: "No object is named on this decision.", de: "Diese Entscheidung nennt keinen Gegenstand." },
  deadline: { en: "Deadline", de: "Frist" },
  noDeadline: { en: "No deadline is recorded for this subject.", de: "Fuer diesen Gegenstand ist keine Frist erfasst." },
  deadlineDue: { en: "Response due {when}", de: "Antwort faellig {when}" },
  deadlinePassed: { en: "Response was due {when}", de: "Antwort war faellig {when}" },
  deadlineBasis: { en: "From the message: {subject}", de: "Aus der Nachricht: {subject}" },
  today: { en: "today at {time}", de: "heute um {time}" },
  onDate: { en: "{date} at {time}", de: "{date} um {time}" },
  currentPosition: { en: "Current position on record", de: "Aktuell erfasste Position" },
  noPosition: {
    en: "The register does not hold a position for this object.",
    de: "Das Register fuehrt fuer diesen Gegenstand keine Position.",
  },
  positionControl: {
    en: "Recorded as {effectiveness}. The first line assesses it as {firstLine}.",
    de: "Erfasst als {effectiveness}. Die erste Linie bewertet sie als {firstLine}.",
  },
  positionKri: { en: "{status} at {value} {unit}.", de: "{status} bei {value} {unit}." },
  positionRisk: { en: "{appetite}.", de: "{appetite}." },
  positionSupplier: { en: "Criticality {criticality}, status {status}.", de: "Kritikalitaet {criticality}, Status {status}." },
  positionAssessment: {
    en: "Version {version}, {status}, residual risk {residual}.",
    de: "Version {version}, {status}, Restrisiko {residual}.",
  },
  positionContract: { en: "In force since {effectiveFrom}.", de: "In Kraft seit {effectiveFrom}." },

  /* 3. Evidence */
  strongestFor: { en: "Strongest supporting", de: "Staerkster Nachweis dafuer" },
  strongestAgainst: { en: "Strongest opposing", de: "Staerkster Nachweis dagegen" },
  noneFor: { en: "No supporting evidence is cited.", de: "Kein unterstuetzender Nachweis ist zitiert." },
  noneAgainst: { en: "No opposing evidence is cited.", de: "Kein gegenlaeufiger Nachweis ist zitiert." },
  conflicting: {
    en: "Conflicting: {for} documents support the prepared position and {against} argue against it.",
    de: "Widerspruechlich: {for} Nachweise stuetzen die vorbereitete Position, {against} sprechen dagegen.",
  },
  oneSided: {
    en: "One-sided: only {count} supporting documents are cited.",
    de: "Einseitig: nur {count} unterstuetzende Nachweise sind zitiert.",
  },
  uncontested: { en: "No evidence is cited either way.", de: "Es ist kein Nachweis zitiert." },
  conflictLabel: { en: "Conflict", de: "Widerspruch" },
  staleLabel: { en: "Stale source", de: "Veraltete Quelle" },
  noStale: { en: "No cited source is marked stale.", de: "Keine zitierte Quelle ist als veraltet markiert." },
  missingLabel: { en: "Missing evidence", de: "Fehlende Nachweise" },
  unresolved: {
    en: "{count} cited identifiers have no document in the evidence corpus.",
    de: "{count} zitierte Kennungen haben keinen Nachweis im Bestand.",
  },
  uncertaintyLabel: { en: "Uncertainty", de: "Unsicherheit" },
  allEvidence: { en: "All cited evidence", de: "Alle zitierten Nachweise" },
  forHeading: { en: "Supporting", de: "Dafuer" },
  againstHeading: { en: "Opposing", de: "Dagegen" },

  /* 4. Options */
  optionsLabel: { en: "Options. Nothing is pre-selected.", de: "Optionen. Nichts ist vorausgewaehlt." },
  implies: { en: "What this implies", de: "Was dies bedeutet" },
  recommended: { en: "Specialist recommendation", de: "Fachliche Empfehlung" },
  chooseFirst: {
    en: "Choose an option to continue.",
    de: "Waehlen Sie eine Option, um fortzufahren.",
  },
  changesIn: { en: "{count} changes in {systems}", de: "{count} Aenderungen in {systems}" },
  changesInOne: { en: "1 change in {systems}", de: "1 Aenderung in {systems}" },
  noChanges: { en: "Changes no record", de: "Aendert keinen Datensatz" },
  optionApprovals: { en: "{count} approvals by {name}", de: "{count} Genehmigungen durch {name}" },
  optionApprovalsOne: { en: "1 approval by {name}", de: "1 Genehmigung durch {name}" },
  optionNoApproval: { en: "No approval needed, runs within policy", de: "Keine Genehmigung noetig, im Rahmen der Richtlinie" },
  optionRefused: {
    en: "The authority gate would refuse {count} of these changes.",
    de: "Die Befugnispruefung wuerde {count} dieser Aenderungen ablehnen.",
  },

  /* 5. Confirm and execute */
  chosenOption: { en: "Your choice", de: "Ihre Wahl" },
  yourReasoning: { en: "Your rationale", de: "Ihre Begruendung" },
  yourReasoningHelp: {
    en: "Written by you and recorded against your name. Nothing is pre-written.",
    de: "Von Ihnen geschrieben und unter Ihrem Namen erfasst. Nichts ist vorformuliert.",
  },
  rationalePlaceholder: {
    en: "State the basis for your conclusion, including how you treated the evidence that points the other way.",
    de: "Nennen Sie die Grundlage Ihres Schlusses, einschliesslich des Umgangs mit gegenlaeufigen Nachweisen.",
  },
  charactersOf: {
    en: "{written} characters, at least {minimum} required",
    de: "{written} Zeichen, mindestens {minimum} erforderlich",
  },
  ownership: {
    en: "Recorded as the rationale of {name}, {title}.",
    de: "Erfasst als Begruendung von {name}, {title}.",
  },
  changesToApprove: { en: "Changes to approve", de: "Zu genehmigende Aenderungen" },
  approveChange: { en: "Approve this change", de: "Diese Aenderung genehmigen" },
  noApprovalChange: { en: "Runs within policy, no approval needed", de: "Im Rahmen der Richtlinie, keine Genehmigung noetig" },
  exactChange: { en: "Exact change", de: "Genaue Aenderung" },
  bindingNote: {
    en: "Your approval is bound to this exact change, reference {reference}. A change that differs when it runs is refused.",
    de: "Ihre Genehmigung gilt nur fuer genau diese Aenderung, Referenz {reference}. Weicht die Aenderung bei der Ausfuehrung ab, wird sie abgelehnt.",
  },
  target: { en: "Target", de: "Ziel" },
  approverLine: {
    en: "Approved by {name}, {title}. One approval per change.",
    de: "Genehmigt durch {name}, {title}. Eine Genehmigung je Aenderung.",
  },
  approvedCount: { en: "{approved} of {required} approved", de: "{approved} von {required} genehmigt" },
  autonomyLabel: { en: "Autonomy level", de: "Autonomiestufe" },
  confirmAction: { en: "Confirm and execute", de: "Bestaetigen und ausfuehren" },
  confirming: { en: "Executing", de: "Fuehrt aus" },
  confirmBlockedRationale: {
    en: "Write at least {minimum} characters of rationale.",
    de: "Schreiben Sie mindestens {minimum} Zeichen Begruendung.",
  },
  confirmBlockedOwnership: { en: "Confirm the rationale is yours.", de: "Bestaetigen Sie, dass die Begruendung Ihre ist." },
  confirmBlockedApprovals: { en: "Approve each change.", de: "Genehmigen Sie jede Aenderung." },
  confirmBlockedRefused: {
    en: "The authority gate would refuse a change in this option. Choose another option.",
    de: "Die Befugnispruefung wuerde eine Aenderung dieser Option ablehnen. Waehlen Sie eine andere Option.",
  },
  blockedByGate: {
    en: "The authority gate refuses this class at the current autonomy level.",
    de: "Die Befugnispruefung verweigert diese Klasse auf der aktuellen Autonomiestufe.",
  },
  auditNote: {
    en: "Confirming records one approval per change, executes the changes and writes the audit trail and receipt.",
    de: "Die Bestaetigung erfasst je Aenderung eine Genehmigung, fuehrt die Aenderungen aus und schreibt Revisionsprotokoll und Beleg.",
  },

  /* The receipt */
  receiptLabel: { en: "Execution receipt", de: "Ausfuehrungsbeleg" },
  recordedAt: { en: "Recorded at {moment} by {name}", de: "Erfasst um {moment} durch {name}" },
  executedHeading: { en: "Executed", de: "Ausgefuehrt" },
  notExecutedHeading: { en: "Not executed", de: "Nicht ausgefuehrt" },
  nothingFailed: { en: "Every change executed.", de: "Jede Aenderung wurde ausgefuehrt." },
  nothingExecuted: { en: "No change executed.", de: "Keine Aenderung wurde ausgefuehrt." },
  outcomeComplete: {
    en: "Decision recorded. {executed} of {total} changes executed.",
    de: "Entscheidung erfasst. {executed} von {total} Aenderungen ausgefuehrt.",
  },
  outcomePartial: {
    en: "Decision recorded. {executed} of {total} changes executed, {failed} did not execute.",
    de: "Entscheidung erfasst. {executed} von {total} Aenderungen ausgefuehrt, {failed} nicht ausgefuehrt.",
  },
  outcomeNoChanges: {
    en: "Decision recorded. This option changes no record.",
    de: "Entscheidung erfasst. Diese Option aendert keinen Datensatz.",
  },
  receiptNote: {
    en: "Each executed line is a change that completed and wrote an audit event.",
    de: "Jede ausgefuehrte Zeile ist eine abgeschlossene Aenderung mit einem Revisionseintrag.",
  },
  rationaleOwned: { en: "Rationale, owned by {name}", de: "Begruendung, verantwortet von {name}" },
  approverLabelReceipt: { en: "Approvals", de: "Genehmigungen" },
  approvalsGranted: { en: "{count} approvals granted by {name}", de: "{count} Genehmigungen erteilt durch {name}" },
  approvalsGrantedNone: { en: "No approval was needed", de: "Es war keine Genehmigung noetig" },
  outcomeRefusedByGate: { en: "Refused by the authority gate", de: "Von der Befugnispruefung abgelehnt" },
  outcomeFailed: { en: "Failed while executing", de: "Bei der Ausfuehrung fehlgeschlagen" },
  outcomeNotAttempted: { en: "Not attempted", de: "Nicht versucht" },
  auditRef: { en: "Audit {id}", de: "Revision {id}" },

  /* Result of a confirm that was refused before anything was written */
  refusedTitle: { en: "Nothing was recorded", de: "Es wurde nichts erfasst" },

  /* Process stage decisions */
  stageDecisions: { en: "Waiting in a process stage", de: "Wartet in einer Prozessstufe" },
  stageDecisionsNote: {
    en: "Decided in the stage itself, where the evidence it depends on is recorded.",
    de: "Wird in der Stufe selbst entschieden, wo die zugrunde liegenden Nachweise erfasst sind.",
  },
  openStage: { en: "Open the stage", de: "Stufe oeffnen" },
  stageReady: { en: "Ready to decide", de: "Bereit zur Entscheidung" },
  stageWaitingPreparation: {
    en: "Waiting for the stage preparation to complete",
    de: "Wartet auf den Abschluss der Stufenvorbereitung",
  },
  stageRowsUnavailable: {
    en: "Process stage decisions are unavailable at the moment.",
    de: "Entscheidungen aus Prozessstufen sind derzeit nicht verfuegbar.",
  },
  stagePosition: { en: "{process}, Stage {sequence}: {stage}", de: "{process}, Stufe {sequence}: {stage}" },
} as const satisfies Record<string, Pair>;

/**
 * The gate's refusal reasons in German, by denial code.
 *
 * In English the gate's own sentence is shown, because a second wording would
 * drift from the rule that refused the change. In German that sentence would
 * be English, so the code is translated instead. An unknown code falls back
 * to the gate's sentence.
 */
export const DENIAL_REASONS_DE: Record<string, string> = {
  "unknown-tool": "Das Werkzeug ist nicht im Berechtigungsregister.",
  prohibited: "Diese Handlung ist grundsaetzlich nicht zulaessig.",
  "autonomy-too-low": "Die aktuelle Autonomiestufe erreicht diese Handlung nicht.",
  "missing-scope": "Die Rolle haelt die fuer diese Handlung erforderliche Befugnis nicht.",
  "approval-missing": "Fuer diese Aenderung fehlt die Genehmigung einer Person.",
  "approval-not-confirmed": "Die genehmigende Person hat die Begruendung nicht als eigene bestaetigt.",
  "approval-role-mismatch": "Die Genehmigung wurde unter einer anderen Rolle erteilt als der handelnden.",
  "approval-decision-mismatch": "Die Genehmigung gehoert zu einer anderen Entscheidung.",
  "approval-payload-mismatch": "Die genehmigte und die ausgefuehrte Aenderung stimmen nicht ueberein.",
  "approval-already-consumed": "Die Genehmigung wurde bereits verwendet.",
  "approval-scope-insufficient": "Die genehmigende Person haelt die erforderliche Befugnis nicht.",
  "self-approval": "Eine Genehmigung erfordert eine benannte Person.",
  "not-implemented": "Diese Folge ist in diesem Stand nicht umgesetzt.",
  failed: "Die Aenderung ist bei der Ausfuehrung fehlgeschlagen.",
};

/** Bilingual refusal messages for a confirm the engine refused before writing. */
export const REFUSAL_MESSAGES: Record<string, Pair> = {
  "approval-not-confirmed": {
    en: "Nothing was recorded. Confirm that the rationale is your own.",
    de: "Es wurde nichts erfasst. Bestaetigen Sie, dass die Begruendung Ihre eigene ist.",
  },
  "rationale-missing": {
    en: "Nothing was recorded. A rationale is required.",
    de: "Es wurde nichts erfasst. Eine Begruendung ist erforderlich.",
  },
  "rationale-short": {
    en: "Nothing was recorded. Write at least {minimum} characters of rationale.",
    de: "Es wurde nichts erfasst. Schreiben Sie mindestens {minimum} Zeichen Begruendung.",
  },
  "not-found": { en: "Nothing was recorded. The decision does not exist.", de: "Es wurde nichts erfasst. Die Entscheidung existiert nicht." },
  "option-mismatch": {
    en: "Nothing was recorded. The option does not belong to this decision.",
    de: "Es wurde nichts erfasst. Die Option gehoert nicht zu dieser Entscheidung.",
  },
  "already-recorded": {
    en: "Nothing was recorded. This decision is already on the record.",
    de: "Es wurde nichts erfasst. Diese Entscheidung ist bereits erfasst.",
  },
  "role-mismatch": {
    en: "Nothing was recorded. This decision belongs to another role and can only be recorded from that role's workday.",
    de: "Es wurde nichts erfasst. Diese Entscheidung gehoert zu einer anderen Rolle und kann nur in deren Arbeitstag erfasst werden.",
  },
  "payload-changed": {
    en: "Nothing was recorded. The changes you approved are not the changes that would now execute. Review them again.",
    de: "Es wurde nichts erfasst. Die genehmigten Aenderungen entsprechen nicht mehr den auszufuehrenden. Pruefen Sie sie erneut.",
  },
  "consequence-refused": {
    en: "Nothing was recorded. The authority gate would refuse {count} of the changes.",
    de: "Es wurde nichts erfasst. Die Befugnispruefung wuerde {count} der Aenderungen ablehnen.",
  },
  invalid: { en: "Nothing was recorded. The request is incomplete.", de: "Es wurde nichts erfasst. Die Anfrage ist unvollstaendig." },
  error: {
    en: "Nothing was confirmed. The error is recorded in the server log; reload to see what is on the record.",
    de: "Nichts wurde bestaetigt. Der Fehler ist im Serverprotokoll erfasst; laden Sie neu, um den erfassten Stand zu sehen.",
  },
};
