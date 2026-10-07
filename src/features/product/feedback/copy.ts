/**
 * Copy for the feedback inbox and the workday feedback control, in English
 * and German (ASCII transliteration). Client safe: plain data.
 */

type Pair = { en: string; de: string };

export const FEEDBACK_KIND_LABELS: Record<string, Pair> = {
  "wrong-source": { en: "Wrong source", de: "Falsche Quelle" },
  "missing-context": { en: "Missing context", de: "Fehlender Kontext" },
  "incorrect-interpretation": { en: "Incorrect interpretation", de: "Falsche Auslegung" },
  "unhelpful-suggestion": { en: "Unhelpful suggestion", de: "Wenig hilfreicher Vorschlag" },
  "workflow-friction": { en: "Workflow friction", de: "Hindernis im Ablauf" },
  "feature-request": { en: "Feature request", de: "Funktionswunsch" },
  "data-issue": { en: "Data issue", de: "Datenproblem" },
  "performance-issue": { en: "Performance issue", de: "Leistungsproblem" },
};

/** The eight kinds in the plan's order, for the submission control. */
export const FEEDBACK_KIND_ORDER = [
  "wrong-source",
  "missing-context",
  "incorrect-interpretation",
  "unhelpful-suggestion",
  "workflow-friction",
  "feature-request",
  "data-issue",
  "performance-issue",
] as const;

export const FEEDBACK_STATUS_LABELS: Record<string, Pair> = {
  new: { en: "New", de: "Neu" },
  triaged: { en: "Triaged", de: "Gesichtet" },
  planned: { en: "Planned", de: "Geplant" },
  "in-release": { en: "In a release", de: "In einem Release" },
  closed: { en: "Closed", de: "Abgeschlossen" },
  declined: { en: "Declined", de: "Abgelehnt" },
};

export const SEVERITY_LABELS: Record<string, Pair> = {
  critical: { en: "Critical", de: "Kritisch" },
  high: { en: "High", de: "Hoch" },
  medium: { en: "Medium", de: "Mittel" },
  low: { en: "Low", de: "Niedrig" },
};

export const FEEDBACK_COPY = {
  title: { en: "Feedback", de: "Rueckmeldungen" },
  lede: {
    en: "The structured feedback inbox: what people reported from the workday and the AI feedback forwarded to it, each triaged, linked to a feature, Role App, stage or release, given a severity and an owner, and tracked to the release that addresses it. Chat transcripts are not product research and are not read here.",
    de: "Der strukturierte Eingang fuer Rueckmeldungen: was Menschen aus dem Arbeitstag gemeldet haben und welche KI-Rueckmeldungen uebernommen wurden, jeweils gesichtet, mit Funktion, Rollen-App, Stufe oder Release verknuepft, mit Schweregrad und Verantwortung versehen und bis zum behebenden Release verfolgt. Chatverlaeufe sind keine Produktforschung und werden hier nicht gelesen.",
  },
  unavailable: {
    en: "The feedback records could not be read. Run npm run db:migrate and npm run demo:reset.",
    de: "Die Rueckmeldungen konnten nicht gelesen werden. Fuehren Sie npm run db:migrate und npm run demo:reset aus.",
  },
  inbox: { en: "Inbox", de: "Eingang" },
  empty: { en: "Empty: no product feedback is recorded", de: "Leer: Keine Produktrueckmeldung erfasst" },
  emptyDetail: {
    en: "An analyst sends feedback from the account menu in the workday. AI feedback can be forwarded below.",
    de: "Eine Analystin sendet Rueckmeldungen aus dem Kontomenue im Arbeitstag. KI-Rueckmeldungen koennen unten uebernommen werden.",
  },
  all: { en: "All", de: "Alle" },
  open: { en: "Open", de: "Offen" },
  submitted: { en: "Submitted", de: "Eingereicht" },
  where: { en: "Raised in", de: "Gemeldet in" },
  links: { en: "Links", de: "Verknuepfungen" },
  triage: { en: "Save triage", de: "Sichtung speichern" },
  status: { en: "Status", de: "Status" },
  severity: { en: "Severity", de: "Schweregrad" },
  notSet: { en: "Not set", de: "Nicht gesetzt" },
  owner: { en: "Owner", de: "Verantwortung" },
  feature: { en: "Feature", de: "Funktion" },
  roleApp: { en: "Role App", de: "Rollen-App" },
  stage: { en: "Stage", de: "Stufe" },
  release: { en: "Release", de: "Release" },
  resolution: { en: "Note", de: "Notiz" },
  aiFeedback: { en: "AI feedback not yet in the inbox", de: "KI-Rueckmeldungen, noch nicht im Eingang" },
  aiFeedbackNote: {
    en: "Structured feedback people gave on an AI output, with the configuration it was about. Useful is a signal and stays in the quality figures; the other kinds can be forwarded.",
    de: "Strukturierte Rueckmeldungen zu einer KI-Ausgabe, mit der betroffenen Konfiguration. Hilfreich ist ein Signal und bleibt in den Qualitaetszahlen; die anderen Arten koennen uebernommen werden.",
  },
  aiEmpty: { en: "Empty: no AI feedback is waiting", de: "Leer: Keine KI-Rueckmeldung wartet" },
  forward: { en: "Forward to inbox", de: "In den Eingang uebernehmen" },
  counts: { en: "{new} new, {open} open in total", de: "{new} neu, {open} insgesamt offen" },
  /* ---- workday control ---- */
  menuItem: { en: "Send product feedback", de: "Produktrueckmeldung senden" },
  dialogTitle: { en: "Product feedback", de: "Produktrueckmeldung" },
  dialogNote: {
    en: "Tell the product team what got in your way. It goes to the product owner's inbox with where you were; nothing from your work or your chats is attached.",
    de: "Sagen Sie dem Produktteam, was Sie behindert hat. Es geht mit dem Ort, an dem Sie waren, in den Eingang des Product Owners; nichts aus Ihrer Arbeit oder Ihren Chats wird angehaengt.",
  },
  kind: { en: "Kind", de: "Art" },
  summary: { en: "What happened", de: "Was ist passiert" },
  detail: { en: "Detail (optional)", de: "Details (optional)" },
  send: { en: "Send", de: "Senden" },
  sending: { en: "Sending", de: "Wird gesendet" },
  cancel: { en: "Cancel", de: "Abbrechen" },
  close: { en: "Close", de: "Schliessen" },
  sent: { en: "Thank you. Your feedback is in the product owner's inbox.", de: "Danke. Ihre Rueckmeldung liegt im Eingang des Product Owners." },
} as const;
