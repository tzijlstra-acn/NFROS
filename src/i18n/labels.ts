/**
 * Interface labels, English and German.
 *
 * The primary interface language is English. German covers core navigation,
 * the five work-lane labels, decision buttons, high-value story copy and
 * common status labels, which is the scope the product brief sets.
 *
 * German orthography note: display strings use correct German spelling with
 * "ss" in place of the eszett, because the product renders these in a browser
 * where the eszett is fine, but the codebase is kept ASCII safe so that
 * encoding problems cannot silently corrupt seeded content. Umlauts are
 * written as "ae", "oe" and "ue" for the same reason. This is a deliberate
 * trade of typographic perfection for encoding safety, recorded in
 * docs/ASSUMPTIONS.md.
 */

import { PRODUCT_IDENTITY } from "@/product/release/identity";

export type Language = "en" | "de";

export const LANGUAGES: Language[] = ["en", "de"];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  de: "Deutsch",
};

type Dict = Record<string, { en: string; de: string }>;

/** The five work lanes. Used identically in the application and the deck. */
export const LANE_LABELS = {
  organise: {
    en: "Organise",
    de: "Organisieren",
    fullEn: "Personal Work Orchestration",
    fullDe: "Persoenliche Arbeitsorchestrierung",
  },
  understand: {
    en: "Understand",
    de: "Verstehen",
    fullEn: "Evidence and Risk Intelligence",
    fullDe: "Nachweise und Risikointelligenz",
  },
  assess: {
    en: "Assess",
    de: "Beurteilen",
    fullEn: "Core Risk Practice",
    fullDe: "Fachliche Risikoarbeit",
  },
  decide: {
    en: "Decide",
    de: "Entscheiden",
    fullEn: "Human Judgment and Challenge",
    fullDe: "Menschliches Urteil und kritische Wuerdigung",
  },
  execute: {
    en: "Execute",
    de: "Umsetzen",
    fullEn: "Controlled Execution and Assurance",
    fullDe: "Kontrollierte Umsetzung und Sicherung",
  },
} as const;

export type LaneId = keyof typeof LANE_LABELS;

export const LANE_ORDER: LaneId[] = ["organise", "understand", "assess", "decide", "execute"];

/** Left rail navigation. */
export const NAV_LABELS: Dict = {
  today: { en: "Today", de: "Heute" },
  collaboration: { en: "Collaboration", de: "Zusammenarbeit" },
  mail: { en: "Mail", de: "Post" },
  calendar: { en: "Calendar", de: "Kalender" },
  decisions: { en: "Decisions", de: "Entscheidungen" },
  workbench: { en: "Workbench", de: "Arbeitsbereich" },
  meetings: { en: "Meetings", de: "Sitzungen" },
  assistant: { en: "Assistant", de: "Assistent" },
  trustAndAudit: { en: "Trust and Audit", de: "Vertrauen und Revision" },
};

/** Right intelligence rail tabs. */
export const RAIL_TABS: Dict = {
  evidence: { en: "Evidence", de: "Nachweise" },
  whyThisMatters: { en: "Why this matters", de: "Warum das wichtig ist" },
  uncertainty: { en: "Uncertainty", de: "Unsicherheit" },
  applicablePolicy: { en: "Applicable policy", de: "Geltende Richtlinie" },
  humanApprovals: { en: "Human approvals", de: "Menschliche Genehmigungen" },
  aiActivity: { en: "AI activity", de: "KI-Aktivitaet" },
  auditTrail: { en: "Audit trail", de: "Revisionsprotokoll" },
};

/** Decision and action buttons. */
export const ACTION_LABELS: Dict = {
  decide: { en: "Record decision", de: "Entscheidung erfassen" },
  approve: { en: "Approve", de: "Genehmigen" },
  approveAndExecute: { en: "Approve and execute", de: "Genehmigen und ausfuehren" },
  reject: { en: "Reject", de: "Ablehnen" },
  defer: { en: "Defer", de: "Zurueckstellen" },
  escalate: { en: "Escalate", de: "Eskalieren" },
  openEvidence: { en: "Open evidence", de: "Nachweis oeffnen" },
  viewAlternatives: { en: "View alternatives", de: "Alternativen ansehen" },
  confirmRationale: { en: "I confirm this rationale is mine", de: "Ich bestaetige diese Begruendung als meine" },
  challenge: { en: "Challenge", de: "Hinterfragen" },
  requestValidation: { en: "Request factual validation", de: "Sachverhaltsklaerung anfordern" },
  activateMonitoring: { en: "Activate enhanced monitoring", de: "Verstaerkte Ueberwachung aktivieren" },
  createAction: { en: "Create remediation action", de: "Massnahme anlegen" },
  addToAgenda: { en: "Add to committee agenda", de: "Auf die Agenda setzen" },
  backgroundWork: { en: "What happened in the background?", de: "Was ist im Hintergrund passiert?" },
  reset: { en: "Reset the day", de: "Tag zuruecksetzen" },
  switchRole: { en: "Switch role", de: "Rolle wechseln" },
  dismissFlag: { en: "Dismiss flag", de: "Hinweis verwerfen" },
  recordCorrection: { en: "Record factual correction", de: "Sachliche Korrektur erfassen" },
};

/** Status labels used across the product. */
export const STATUS_LABELS: Dict = {
  open: { en: "Open", de: "Offen" },
  decided: { en: "Decided", de: "Entschieden" },
  deferred: { en: "Deferred", de: "Zurueckgestellt" },
  escalated: { en: "Escalated", de: "Eskaliert" },
  overdue: { en: "Overdue", de: "Ueberfaellig" },
  inProgress: { en: "In progress", de: "In Bearbeitung" },
  completed: { en: "Completed", de: "Abgeschlossen" },
  current: { en: "Current", de: "Aktuell" },
  superseded: { en: "Superseded", de: "Ersetzt" },
  requested: { en: "Requested", de: "Angefordert" },
  missing: { en: "Missing", de: "Fehlt" },
  stale: { en: "Stale", de: "Veraltet" },
  draft: { en: "Draft", de: "Entwurf" },
  approved: { en: "Approved", de: "Genehmigt" },
  blocked: { en: "Blocked", de: "Gesperrt" },
  proposed: { en: "Proposed", de: "Vorgeschlagen" },
  executed: { en: "Executed", de: "Ausgefuehrt" },
  within: { en: "Within appetite", de: "Innerhalb der Risikoneigung" },
  atLimit: { en: "At limit", de: "An der Grenze" },
  outside: { en: "Outside appetite", de: "Ausserhalb der Risikoneigung" },
  critical: { en: "Critical", de: "Kritisch" },
  important: { en: "Important", de: "Wichtig" },
  standard: { en: "Standard", de: "Standard" },
};

/** Provenance labels. The fact and inference distinction, in both languages. */
export const PROVENANCE_LABELS: Dict = {
  "verified-fact": { en: "Verified fact", de: "Gesicherte Tatsache" },
  "approved-record": { en: "Approved record", de: "Genehmigter Eintrag" },
  "stakeholder-statement": { en: "Stakeholder statement", de: "Aussage eines Beteiligten" },
  "model-inference": { en: "Model inference", de: "Modellschlussfolgerung" },
  "conflicting-evidence": { en: "Conflicting evidence", de: "Widerspruechlicher Nachweis" },
  telemetry: { en: "Telemetry", de: "Telemetrie" },
};

/**
 * Non-colour cues for provenance. Accessibility requires that the fact versus
 * inference distinction never depends on colour alone.
 */
export const PROVENANCE_GLYPHS: Record<string, string> = {
  "verified-fact": "=",
  "approved-record": "*",
  "stakeholder-statement": "?",
  "model-inference": "~",
  "conflicting-evidence": "!",
  telemetry: "+",
};

/** Key product copy that appears in both the application and the deck. */
export const PRODUCT_COPY: Dict = {
  /* Read from the release registry, so the report shell names the same product. */
  productName: { en: PRODUCT_IDENTITY.name, de: PRODUCT_IDENTITY.name },
  experienceName: { en: "Live the NFR Day", de: "Den NFR-Tag erleben" },
  syntheticLabel: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  regulatoryNote: {
    en: "Illustrative regulatory context, not legal advice.",
    de: "Illustrativer regulatorischer Kontext, keine Rechtsberatung.",
  },
  propositionLine1: { en: "One work environment for NFR.", de: "Eine Arbeitsumgebung fuer NFR." },
  propositionLine2: {
    en: "Specialist intelligence for every function.",
    de: "Fachliche Intelligenz fuer jede Funktion.",
  },
  propositionLine3: {
    en: "Human accountability at every material decision.",
    de: "Menschliche Verantwortung bei jeder wesentlichen Entscheidung.",
  },
  todayView: { en: "Today", de: "Heute" },
  futureView: { en: "AI-enabled future", de: "KI-gestuetzte Zukunft" },
  sharedEvent: { en: "Shared event", de: "Gemeinsames Ereignis" },
  humanDecides: { en: "The human owns this decision", de: "Diese Entscheidung liegt beim Menschen" },
  noEvidence: {
    en: "No evidence has been cited for this statement.",
    de: "Fuer diese Aussage wurde kein Nachweis angegeben.",
  },
};

/** Autonomy level labels. */
export const AUTONOMY_LABELS: Dict = {
  assist: { en: "Assist", de: "Unterstuetzen" },
  prepare: { en: "Prepare", de: "Vorbereiten" },
  recommend: { en: "Recommend", de: "Empfehlen" },
  "act-with-approval": { en: "Act with approval", de: "Handeln nach Genehmigung" },
  "act-within-policy": { en: "Act within policy", de: "Handeln im Rahmen der Richtlinie" },
};

/** Demo mode labels. */
export const MODE_LABELS: Dict = {
  live: { en: "Live AI", de: "Live-KI" },
  safe: { en: "Presenter Safe", de: "Praesentationssicher" },
  offline: { en: "Offline", de: "Offline" },
};

/** Resolves a dictionary entry for a language, falling back to English. */
export function t(dict: Dict, key: string, language: Language): string {
  const entry = dict[key];
  if (!entry) return key;
  return language === "de" ? entry.de : entry.en;
}

/** Lane label in the requested language. */
export function laneLabel(lane: LaneId, language: Language, full = false): string {
  const entry = LANE_LABELS[lane];
  if (full) return language === "de" ? entry.fullDe : entry.fullEn;
  return language === "de" ? entry.de : entry.en;
}
