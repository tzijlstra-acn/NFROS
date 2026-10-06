/**
 * Process workspace copy, English and German.
 *
 * Status words follow the product vocabulary (Empty, Unavailable, Simulated,
 * Safe, Offline, Live, Verified, Not verified) and the durable work states of
 * plan section 8.2 (Queued, Running, Waiting for source, Waiting for
 * approval, Retrying, Completed, Failed). German is ASCII only.
 */

import type { Language } from "@/i18n/labels";
import type { PreparationState, SourceStatus, ToolTaskState } from "./types";

type Pair = { en: string; de: string };

export function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export const PROCESS_COPY = {
  stage: { en: "Stage", de: "Stufe" },
  of: { en: "of", de: "von" },
  sources: { en: "Sources", de: "Quellen" },
  evidenceStatus: { en: "Evidence status", de: "Nachweisstand" },
  required: { en: "Required", de: "Erforderlich" },
  helpful: { en: "Helpful", de: "Hilfreich" },
  records: { en: "records", de: "Datensaetze" },
  recordSingular: { en: "record", de: "Datensatz" },
  stageInputs: { en: "Attached to this stage", de: "Dieser Stufe zugeordnet" },
  stageInputKinds: {
    message: { en: "Inbox message", de: "Posteingangsnachricht" },
    minutes: { en: "Confirmed minutes", de: "Bestaetigtes Protokoll" },
    document: { en: "Document", de: "Dokument" },
  },
  stageInputFrom: { en: "from {from}", de: "von {from}" },
  stageInputAdded: { en: "Attached by {person} at {when}", de: "Zugeordnet von {person} um {when}" },
  stageInputMissing: { en: "The attached record is no longer found.", de: "Der zugeordnete Datensatz ist nicht mehr auffindbar." },
  unknownPerson: { en: "a person not on record", de: "eine nicht erfasste Person" },
  aiPrepared: { en: "AI prepared", de: "KI vorbereitet" },
  whatAiPrepares: { en: "What AI prepares", de: "Was die KI vorbereitet" },
  findings: { en: "Findings", de: "Feststellungen" },
  inference: { en: "AI inference, not an approved record", de: "KI-Schlussfolgerung, kein genehmigter Datensatz" },
  uncertainty: { en: "Uncertainty", de: "Unsicherheit" },
  contradictions: { en: "Contradictions", de: "Widersprueche" },
  gaps: { en: "Gaps", de: "Luecken" },
  limitations: { en: "Limitations", de: "Grenzen" },
  yourTask: { en: "Your task", de: "Ihre Aufgabe" },
  yourResponsibility: { en: "Your responsibility", de: "Ihre Verantwortung" },
  recorded: { en: "Recorded", de: "Erfasst" },
  record: { en: "Record", de: "Erfassen" },
  recordAgain: { en: "Record a revision", de: "Fassung erfassen" },
  decision: { en: "Decision", de: "Entscheidung" },
  preparedPosition: { en: "Prepared position", de: "Vorbereitete Position" },
  aiRecommends: { en: "AI recommends", de: "KI empfiehlt" },
  whatChanges: { en: "What will change", de: "Was sich aendert" },
  rationale: { en: "Your rationale", de: "Ihre Begruendung" },
  rationalePlaceholder: { en: "In your own words: why this option.", de: "In Ihren Worten: warum diese Option." },
  confirmOwn: { en: "I confirm this rationale is my own", de: "Ich bestaetige, dass diese Begruendung meine eigene ist" },
  recordDecision: { en: "Record decision", de: "Entscheidung erfassen" },
  reviseDecision: { en: "Revise decision", de: "Entscheidung ueberarbeiten" },
  openInDecisions: { en: "Open in Decisions", de: "In Entscheidungen oeffnen" },
  decidedBy: { en: "Decided by", de: "Entschieden von" },
  governedChanges: { en: "Governed changes", de: "Gesteuerte Aenderungen" },
  approvalRequired: { en: "Requires your approval", de: "Erfordert Ihre Genehmigung" },
  localRecord: { en: "Product record", de: "Datensatz im Produkt" },
  externalSystem: { en: "External system, through the outbox", de: "Externes System, ueber den Postausgang" },
  approveAndExecute: { en: "Approve and execute", de: "Genehmigen und ausfuehren" },
  nothingProposed: { en: "No change is proposed yet. Changes appear once the decision they depend on is recorded.", de: "Noch keine Aenderung vorgeschlagen. Aenderungen erscheinen, sobald die zugrunde liegende Entscheidung erfasst ist." },
  artifacts: { en: "Artifacts", de: "Artefakte" },
  noArtifacts: { en: "Nothing is stored for this stage yet.", de: "Fuer diese Stufe ist noch nichts gespeichert." },
  version: { en: "version", de: "Version" },
  criteria: { en: "Completion criteria", de: "Abschlusskriterien" },
  blocking: { en: "Blocking", de: "Blockiert" },
  completeAndContinue: { en: "Complete stage and continue", de: "Stufe abschliessen und fortfahren" },
  continueDisabled: { en: "Continue is not available yet:", de: "Fortfahren ist noch nicht moeglich:" },
  completionNote: {
    en: "Completing the stage records its outcome under your approval and opens the next stage.",
    de: "Der Abschluss erfasst das Ergebnis der Stufe mit Ihrer Genehmigung und oeffnet die naechste Stufe.",
  },
  completed: { en: "Completed", de: "Abgeschlossen" },
  completedBy: { en: "Completed by", de: "Abgeschlossen von" },
  recentEvents: { en: "Recent events", de: "Letzte Ereignisse" },
  noEvents: { en: "No events recorded for this stage yet.", de: "Fuer diese Stufe sind noch keine Ereignisse erfasst." },
  startPreparation: { en: "Start preparation", de: "Vorbereitung starten" },
  tryAgain: { en: "Try again", de: "Erneut versuchen" },
  stillRunning: { en: "Still running. Refresh to check again.", de: "Laeuft noch. Aktualisieren Sie, um erneut zu pruefen." },
  working: { en: "Working", de: "In Arbeit" },
  locked: {
    en: "This stage opens when the previous stage is completed.",
    de: "Diese Stufe oeffnet sich, wenn die vorherige Stufe abgeschlossen ist.",
  },
  notExecutable: { en: "Not executable in this build", de: "In diesem Build nicht ausfuehrbar" },
  noRun: {
    en: "No active run is recorded for this process. Seed the scenario to load the demonstration day.",
    de: "Fuer diesen Prozess ist kein aktiver Durchlauf erfasst. Laden Sie das Szenario, um den Demonstrationstag zu sehen.",
  },
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },
  regulatoryNote: {
    en: "Illustrative regulatory context, not legal advice.",
    de: "Nur illustrativer regulatorischer Kontext, keine Rechtsberatung.",
  },
} as const;

export const STAGE_STATUS_LABELS: Record<string, Pair> = {
  completed: { en: "Completed", de: "Abgeschlossen" },
  "in-progress": { en: "In Progress", de: "In Bearbeitung" },
  "waiting-for-input": { en: "Waiting for input", de: "Eingabe erforderlich" },
  blocked: { en: "Blocked", de: "Blockiert" },
  ready: { en: "Ready", de: "Bereit" },
  locked: { en: "Locked", de: "Gesperrt" },
};

export const PREPARATION_STATE_LABELS: Record<PreparationState, Pair> = {
  "not-started": { en: "Not started", de: "Nicht gestartet" },
  queued: { en: "Queued", de: "Eingeplant" },
  running: { en: "Running", de: "Laeuft" },
  "waiting-for-source": { en: "Waiting for source", de: "Wartet auf Quelle" },
  "waiting-for-approval": { en: "Waiting for approval", de: "Wartet auf Genehmigung" },
  retrying: { en: "Retrying", de: "Wird wiederholt" },
  completed: { en: "Completed", de: "Abgeschlossen" },
  failed: { en: "Failed", de: "Fehlgeschlagen" },
  unavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
};

export const MODE_LABELS: Record<string, Pair> = {
  live: { en: "Live", de: "Live" },
  safe: { en: "Safe", de: "Sicher" },
  offline: { en: "Offline", de: "Offline" },
};

export const PREPARATION_SOURCE_NOTES: Record<string, Pair> = {
  live: { en: "Prepared by the live model and validated against the loaded sources.", de: "Vom Live-Modell vorbereitet und gegen die geladenen Quellen geprueft." },
  cache: { en: "Served from the validated preparation captured for this seeded day.", de: "Aus der fuer diesen Tag erfassten, geprueften Vorbereitung bereitgestellt." },
  composed: { en: "Composed from the loaded sources without a model, and validated.", de: "Ohne Modell aus den geladenen Quellen zusammengestellt und geprueft." },
};

/** Source badges in the product status vocabulary. */
export function sourceBadge(status: SourceStatus, connectorMode: string | null): Pair {
  switch (status) {
    case "unavailable":
      return { en: "Unavailable", de: "Nicht verfuegbar" };
    case "empty":
      return { en: "Empty", de: "Leer" };
    case "stale":
      return { en: "Not verified", de: "Nicht verifiziert" };
    case "loaded":
      return connectorMode === "live" ? { en: "Live", de: "Live" } : { en: "Simulated", de: "Simuliert" };
  }
}

export const TOOL_STATE_LABELS: Record<ToolTaskState, Pair> = {
  "not-applicable": { en: "Not applicable", de: "Nicht zutreffend" },
  proposed: { en: "Proposed", de: "Vorgeschlagen" },
  executed: { en: "Executed", de: "Ausgefuehrt" },
  queued: { en: "In the outbox", de: "Im Postausgang" },
  acknowledged: { en: "Confirmed by the target system", de: "Vom Zielsystem bestaetigt" },
  failed: { en: "Failed", de: "Fehlgeschlagen" },
  blocked: { en: "Refused by the authority gate", de: "Vom Berechtigungstor abgelehnt" },
};

export const EVENT_TYPE_LABELS: Record<string, Pair> = {
  "work-arrived": { en: "Work arrived", de: "Arbeit eingegangen" },
  "source-changed": { en: "Source changed", de: "Quelle geaendert" },
  "ai-preparation-started": { en: "AI preparation started", de: "KI-Vorbereitung gestartet" },
  "ai-preparation-completed": { en: "AI preparation completed", de: "KI-Vorbereitung abgeschlossen" },
  "human-task-created": { en: "Task created", de: "Aufgabe angelegt" },
  "decision-requested": { en: "Decision requested", de: "Entscheidung angefordert" },
  "approval-requested": { en: "Approval requested", de: "Genehmigung angefordert" },
  "tool-executed": { en: "Change executed", de: "Aenderung ausgefuehrt" },
  "external-command-acknowledged": { en: "External system confirmed", de: "Externes System bestaetigt" },
  "stage-completed": { en: "Stage completed", de: "Stufe abgeschlossen" },
  "process-completed": { en: "Process completed", de: "Prozess abgeschlossen" },
  "routine-completed": { en: "Routine completed", de: "Routine abgeschlossen" },
  "meeting-completed": { en: "Meeting completed", de: "Sitzung abgeschlossen" },
  "action-updated": { en: "Action updated", de: "Massnahme aktualisiert" },
  "stage-opened": { en: "Stage opened", de: "Stufe geoeffnet" },
  "ai-preparation-held": { en: "AI preparation held", de: "KI-Vorbereitung angehalten" },
  "ai-preparation-failed": { en: "AI preparation failed", de: "KI-Vorbereitung fehlgeschlagen" },
  "human-task-completed": { en: "Task recorded", de: "Aufgabe erfasst" },
  "decision-recorded": { en: "Decision recorded", de: "Entscheidung erfasst" },
  "approval-granted": { en: "Approval granted", de: "Genehmigung erteilt" },
};
