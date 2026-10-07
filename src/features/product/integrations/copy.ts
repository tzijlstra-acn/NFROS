/**
 * Copy for the Integrations section, in English and German (ASCII
 * transliteration).
 */

import type { FreshnessState } from "@/db/schema/integration";
import type { WriteState } from "./model";

type Pair = { en: string; de: string };

export const WRITE_STATE_LABELS: Record<WriteState, Pair & { tone: "neutral" | "success" | "warning" }> = {
  "not-declared": { en: "Read only by design", de: "Nur lesend vorgesehen", tone: "neutral" },
  "not-enabled": { en: "Writes not enabled", de: "Schreiben nicht freigeschaltet", tone: "neutral" },
  paused: { en: "Writes paused", de: "Schreiben angehalten", tone: "warning" },
  enabled: { en: "Writes enabled", de: "Schreiben freigeschaltet", tone: "success" },
};

export const FRESHNESS_STATE_LABELS: Record<FreshnessState, Pair> = {
  live: { en: "Live", de: "Live" },
  fresh: { en: "Fresh", de: "Aktuell" },
  stale: { en: "Stale", de: "Veraltet" },
  unknown: { en: "Never synced", de: "Nie abgeglichen" },
};

export const SUBSCRIPTION_LABELS: Record<string, Pair> = {
  none: { en: "No event subscription", de: "Kein Ereignisabonnement" },
  webhook: { en: "Webhook", de: "Webhook" },
  "delta-sync": { en: "Delta sync", de: "Delta-Abgleich" },
  polling: { en: "Polling", de: "Abfrage in Intervallen" },
  simulated: { en: "Simulated events", de: "Simulierte Ereignisse" },
};

export const CREDENTIAL_LABELS: Record<string, Pair> = {
  "not-required": { en: "Not required", de: "Nicht erforderlich" },
  absent: { en: "Absent", de: "Nicht vorhanden" },
  present: { en: "Present", de: "Vorhanden" },
  invalid: { en: "Invalid", de: "Ungueltig" },
};

export const COMMAND_STATUS_LABELS: Record<string, Pair> = {
  proposed: { en: "Proposed", de: "Vorgeschlagen" },
  "awaiting-approval": { en: "Awaiting approval", de: "Wartet auf Genehmigung" },
  approved: { en: "Approved", de: "Genehmigt" },
  queued: { en: "Queued", de: "In Warteschlange" },
  executing: { en: "Sending", de: "Wird gesendet" },
  acknowledged: { en: "Acknowledged", de: "Bestaetigt" },
  failed: { en: "Failed", de: "Fehlgeschlagen" },
  "dead-letter": { en: "Dead letter", de: "Unzustellbar" },
  cancelled: { en: "Cancelled", de: "Abgebrochen" },
};

export const INTEGRATIONS_COPY = {
  title: { en: "Integrations", de: "Integrationen" },
  lede: {
    en: "Connector status, last sync, source freshness, event subscription, write state, the outbound queue, dead letters and mapping issues. Every connector in this build reads the simulated institution, and every action here is real against the simulated runtime.",
    de: "Konnektorstatus, letzter Abgleich, Aktualitaet der Quellen, Ereignisabonnement, Schreibstatus, ausgehende Warteschlange, unzustellbare Befehle und Zuordnungsprobleme. Jeder Konnektor in diesem Build liest die simulierte Institution, und jede Aktion hier wirkt real auf die simulierte Laufzeit.",
  },
  credentialNote: {
    en: "Credentials are shown as a state only. No credential, or any part of one, is stored here, sent to the browser or included in the diagnostic bundle.",
    de: "Zugangsdaten werden nur als Zustand gezeigt. Keine Zugangsdaten, auch kein Teil davon, werden hier gespeichert, an den Browser gesendet oder in das Diagnosepaket aufgenommen.",
  },
  unavailable: {
    en: "The integration records could not be read. Run npm run db:migrate and npm run demo:reset.",
    de: "Die Integrationsdatensaetze konnten nicht gelesen werden. Fuehren Sie npm run db:migrate und npm run demo:reset aus.",
  },
  connectors: { en: "Connectors", de: "Konnektoren" },
  noConnectors: { en: "No connector instance is configured.", de: "Es ist keine Konnektorinstanz konfiguriert." },
  health: { en: "Health", de: "Zustand" },
  lastSync: { en: "Last sync", de: "Letzter Abgleich" },
  never: { en: "Never synced", de: "Nie abgeglichen" },
  freshness: { en: "Source freshness", de: "Aktualitaet der Quelle" },
  freshnessValue: {
    en: "{state}: {types} object type(s), {stale} stale, {never} never synced",
    de: "{state}: {types} Objekttyp(en), {stale} veraltet, {never} nie abgeglichen",
  },
  subscription: { en: "Event subscription", de: "Ereignisabonnement" },
  writeState: { en: "Write state", de: "Schreibstatus" },
  pausedSince: { en: "Paused by {by} at {at}: {reason}", de: "Angehalten von {by} am {at}: {reason}" },
  commands: { en: "Queued and failed commands", de: "Wartende und fehlgeschlagene Befehle" },
  commandsValue: {
    en: "{queued} queued, {failed} failed, {dead} dead letter(s), {awaiting} awaiting approval",
    de: "{queued} wartend, {failed} fehlgeschlagen, {dead} unzustellbar, {awaiting} warten auf Genehmigung",
  },
  mappingIssues: { en: "Mapping issues", de: "Zuordnungsprobleme" },
  credential: { en: "Credential status", de: "Status der Zugangsdaten" },
  testConnection: { en: "Test connection", de: "Verbindung testen" },
  runSync: { en: "Run sync", de: "Synchronisierung ausfuehren" },
  pauseWrites: { en: "Pause writes", de: "Schreibzugriffe anhalten" },
  resumeWrites: { en: "Resume writes", de: "Schreibzugriffe fortsetzen" },
  queue: { en: "Outbound commands", de: "Ausgehende Befehle" },
  queueNote: {
    en: "A retry goes back through the dispatcher and the authority gate on the command's original idempotency key, so it cannot create a second external object. The approval already given still covers this exact change.",
    de: "Eine Wiederholung laeuft erneut ueber den Dispatcher und die Berechtigungspruefung mit dem urspruenglichen Idempotenzschluessel und kann daher kein zweites externes Objekt erzeugen. Die bereits erteilte Genehmigung gilt weiterhin fuer genau diese Aenderung.",
  },
  queueEmpty: { en: "Empty: no command is waiting", de: "Leer: Kein Befehl wartet" },
  queueEmptyDetail: {
    en: "Every outbound change has been acknowledged, or none was made. A command appears here when a target does not confirm it, or while writes to it are paused.",
    de: "Jede ausgehende Aenderung wurde bestaetigt, oder es gab keine. Ein Befehl erscheint hier, wenn ein Ziel ihn nicht bestaetigt oder solange Schreibzugriffe darauf angehalten sind.",
  },
  attempts: { en: "attempts", de: "Versuche" },
  retry: { en: "Retry command", de: "Befehl wiederholen" },
  pausedRow: { en: "Writes to this target are paused.", de: "Schreibzugriffe auf dieses Ziel sind angehalten." },
  mappingNote: {
    en: "Detected conflicts between sources and rejected inbound events, with any review already recorded. Resolving records the review; it does not change the data or remove the conflict marker the analyst sees.",
    de: "Erkannte Widersprueche zwischen Quellen und abgelehnte eingehende Ereignisse, mit bereits erfassten Pruefungen. Klaeren erfasst die Pruefung; es aendert weder die Daten noch entfernt es die Widerspruchsmarkierung fuer die Analystin.",
  },
  mappingEmpty: { en: "Empty: no mapping issue is detected", de: "Leer: Kein Zuordnungsproblem erkannt" },
  mappingEmptyDetail: {
    en: "Issues appear after a sync finds two sources that disagree, or when an inbound event is rejected.",
    de: "Probleme erscheinen, wenn ein Abgleich zwei widerspruechliche Quellen findet oder ein eingehendes Ereignis abgelehnt wird.",
  },
  resolve: { en: "Resolve mapping", de: "Zuordnung klaeren" },
  outcome: { en: "Outcome", de: "Ergebnis" },
  outcomeResolved: { en: "Resolved", de: "Geklaert" },
  outcomeAccepted: { en: "Accepted as it is", de: "So akzeptiert" },
  detected: { en: "Detected", de: "Erkannt" },
  incidents: { en: "Integration incidents", de: "Integrationsvorfaelle" },
  incidentsEmpty: { en: "Empty: no integration incident is recorded", de: "Leer: Kein Integrationsvorfall erfasst" },
  diagnostics: { en: "Diagnostic bundle", de: "Diagnosepaket" },
  diagnosticsNote: {
    en: "Health, release, connector states, sync state, outbox counts, open dead letters and mapping issues, built on the server for this download. It lists what it excludes and holds no credential.",
    de: "Zustand, Release, Konnektorzustaende, Abgleichstand, Zaehler des Postausgangs, offene unzustellbare Befehle und Zuordnungsprobleme, auf dem Server fuer diesen Download erzeugt. Es nennt, was es ausschliesst, und enthaelt keine Zugangsdaten.",
  },
  download: { en: "Download diagnostic bundle", de: "Diagnosepaket herunterladen" },
  planned: {
    en: "{count} planned adapter(s) declare no capability and are listed in the integration settings.",
    de: "{count} geplante Adapter deklarieren keine Faehigkeit und sind in den Integrationseinstellungen aufgefuehrt.",
  },
  openSettings: { en: "Open the integration settings", de: "Integrationseinstellungen oeffnen" },
} as const;
