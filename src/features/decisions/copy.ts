/**
 * Copy for the V3.1 decision queue.
 *
 * Every user visible string in this feature has an English and a German form,
 * which is the `{ en, de }` pattern the rest of the V3.1 surface uses. German
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

/* ==========================================================================
   Stages
   ========================================================================== */

export const STAGE_LABELS: Record<DecisionStage, Pair> = {
  understand: { en: "Understand", de: "Verstehen" },
  compare: { en: "Compare", de: "Vergleichen" },
  explain: { en: "Explain", de: "Begruenden" },
  confirm: { en: "Confirm", de: "Bestaetigen" },
};

/** One line saying what the stage is for. Read once, then ignored. */
export const STAGE_HINTS: Record<DecisionStage, Pair> = {
  understand: {
    en: "What happened, and why it needs a person.",
    de: "Was geschehen ist und warum eine Person erforderlich ist.",
  },
  /*
   * The compare hint carries the doctrine as well as the orientation.
   *
   * "Nothing is pre-selected" was a separate label above the option grid, and
   * it cost the stage 24px that the four option case needed. It belongs with
   * the stage brief anyway: it describes the stage, not the grid.
   */
  compare: {
    en: "The options, and what each one implies. Nothing is pre-selected.",
    de: "Die Optionen und was jede bedeutet. Nichts ist vorausgewaehlt.",
  },
  explain: {
    en: "Your reasoning, and what the AI prepared.",
    de: "Ihre Begruendung und was die KI vorbereitet hat.",
  },
  confirm: {
    en: "The authority, the approver, and one action.",
    de: "Die Befugnis, die genehmigende Person und eine Aktion.",
  },
};

/* ==========================================================================
   Authority
   ========================================================================== */

/**
 * The authority class labels.
 *
 * The same six classes and the same wording the V2 surface uses, so a reviewer
 * comparing the two versions reads one vocabulary. The classes themselves are
 * `AUTHORITY_CLASSES` in the decision schema; this is only their presentation.
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

/**
 * The kind of judgment, as a short noun phrase.
 *
 * A noun rather than a sentence, because this sits on a one line row next to
 * a headline that is already doing the explaining. The sentence forms live in
 * the focus queue and are used there.
 */
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

/* ==========================================================================
   Interface copy
   ========================================================================== */

export const COPY = {
  queueLabel: { en: "Decision queue", de: "Entscheidungsliste" },
  openCount: { en: "open", de: "offen" },
  oneAtATime: {
    en: "One decision is open at a time.",
    de: "Es ist jeweils eine Entscheidung geoeffnet.",
  },
  recordedToday: { en: "Recorded today", de: "Heute erfasst" },
  nothingOpen: { en: "No decision needs you at this point", de: "Keine Entscheidung offen" },
  nothingOpenDetail: {
    en: "Move the day forward to reach the next point where this role's judgment is required.",
    de: "Bewegen Sie den Tag vorwaerts, bis das Urteil dieser Rolle gefragt ist.",
  },
  stageOf: { en: "Stage", de: "Schritt" },
  back: { en: "Back", de: "Zurueck" },
  forward: { en: "Next", de: "Weiter" },
  openRow: { en: "Open this decision", de: "Diese Entscheidung oeffnen" },
  active: { en: "Open", de: "Geoeffnet" },

  /* Understand */
  theQuestion: { en: "The question", de: "Die Frage" },

  /* Compare */
  optionsLabel: { en: "Options. Nothing is pre-selected.", de: "Optionen. Nichts ist vorausgewaehlt." },
  implies: { en: "What this implies", de: "Was dies bedeutet" },
  recommended: { en: "Specialist recommendation", de: "Fachliche Empfehlung" },
  basis: { en: "Basis", de: "Grundlage" },
  chooseFirst: {
    en: "Choose an option to continue.",
    de: "Waehlen Sie eine Option, um fortzufahren.",
  },
  willChange: { en: "What would change", de: "Was sich aendern wuerde" },

  /* Explain */
  yourReasoning: { en: "Your reasoning", de: "Ihre Begruendung" },
  yourReasoningHelp: {
    en: "Written by you, recorded against your name, and not generated for you.",
    de: "Von Ihnen geschrieben, unter Ihrem Namen erfasst und nicht fuer Sie erzeugt.",
  },
  rationalePlaceholder: {
    en: "State the basis for your conclusion, including how you treated the evidence that points the other way.",
    de: "Nennen Sie die Grundlage Ihres Schlusses, einschliesslich des Umgangs mit gegenlaeufigen Nachweisen.",
  },
  charactersOf: { en: "characters of", de: "Zeichen von" },
  minimumRequired: { en: "required", de: "erforderlich" },
  preparedByAi: { en: "Prepared by AI, not your words", de: "Von der KI vorbereitet, nicht Ihre Worte" },
  statedUncertainty: { en: "Uncertainty the preparation states", de: "Angegebene Unsicherheit der Vorbereitung" },
  separableNote: {
    en: "The preparation is shown beside your reasoning and is never copied into it.",
    de: "Die Vorbereitung steht neben Ihrer Begruendung und wird nie in sie uebernommen.",
  },
  writeMore: {
    en: "Write your reasoning to continue.",
    de: "Schreiben Sie Ihre Begruendung, um fortzufahren.",
  },

  /* Confirm */
  authorityLabel: { en: "Authority", de: "Befugnis" },
  approverLabel: { en: "Approved by", de: "Genehmigt durch" },
  autonomyLabel: { en: "Autonomy level", de: "Autonomiestufe" },
  noApprovalNeeded: {
    en: "No separate approval is required for this class.",
    de: "Fuer diese Klasse ist keine gesonderte Genehmigung erforderlich.",
  },
  approvalPerChange: {
    en: "One approval per change, bound to that change.",
    de: "Eine Genehmigung je Aenderung, nur dafuer gueltig.",
  },
  chosenOption: { en: "Your choice", de: "Ihre Wahl" },
  confirmAction: { en: "Confirm and execute", de: "Bestaetigen und ausfuehren" },
  confirming: { en: "Executing", de: "Fuehrt aus" },
  blockedByGate: {
    en: "The authority gate refuses this class at the current autonomy level.",
    de: "Die Befugnispruefung verweigert diese Klasse auf der aktuellen Autonomiestufe.",
  },
  auditNote: {
    en: "Confirming records one approval per change and writes the existing audit trail and receipt.",
    de: "Die Bestaetigung erfasst je Aenderung eine Genehmigung und schreibt Revisionsprotokoll und Beleg.",
  },

  /* Result */
  receiptLabel: { en: "Execution receipt", de: "Ausfuehrungsbeleg" },
  receiptNote: {
    en: "Each line is a change that completed and wrote an audit event.",
    de: "Jede Zeile ist eine abgeschlossene Aenderung mit einem Revisionseintrag.",
  },
  notExecuted: { en: "Not executed", de: "Nicht ausgefuehrt" },
  recordedRationaleLabel: { en: "Rationale, owned by you", de: "Begruendung, von Ihnen verantwortet" },
  evidenceFor: { en: "Evidence behind this decision", de: "Nachweise zu dieser Entscheidung" },
} as const satisfies Record<string, Pair>;
