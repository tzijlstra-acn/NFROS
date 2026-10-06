/**
 * Connector health and readiness display.
 *
 * Server safe: no hooks, no handlers, no client directive. These render inside
 * a server component reading the integration tables directly.
 *
 * One editorial rule governs every component in this file. The mode is never
 * omitted and never softened. A connector in `planned` mode shows the word
 * "Planned" at the same size as its vendor name, because the failure this
 * whole layer exists to prevent is a screen of vendor names that a reviewer
 * reads as working integrations. The chip is not decoration; it is the claim.
 *
 * The second rule: nothing here renders a credential, and nothing here could.
 * `SecretState` receives a four valued string and has no access to anything
 * else. There is no prop on any of these components that a credential could
 * travel in.
 */

import {
  IconAlertTriangle,
  IconCheck,
  IconCircleOff,
  IconClock,
  IconLink,
  IconPlugConnectedX,
  IconRefresh,
} from "@tabler/icons-react";
import type { ConnectorHealthState, ConnectorMode } from "@/db/schema/integration";
import { CONNECTOR_MODE_LABELS, pick } from "@/workday/contracts";
import { Chip, Data, Item, type Tone } from "@/components/workday-v2/primitives";
import type { ConnectorCapabilities } from "@/integrations/core/Connector";
import { capabilityCount } from "@/integrations/core/Connector";
import type { Language } from "@/i18n/labels";

/* ==========================================================================
   Mode
   ========================================================================== */

/**
 * Tone per mode.
 *
 * `simulated` is info rather than warning, and `planned` is neutral rather
 * than danger. A simulated connector is working correctly and a planned one is
 * a roadmap entry; neither is a fault, and colouring them as faults would
 * train an administrator to ignore the colour. Only
 * `configured-unavailable` is a warning, because it is the one state where
 * somebody has to do something.
 */
const MODE_TONE: Record<ConnectorMode, Tone> = {
  live: "success",
  "sandbox-ready": "ai",
  simulated: "info",
  "configured-unavailable": "warning",
  planned: "neutral",
};

export function ConnectorModeChip({
  mode,
  language,
}: {
  mode: ConnectorMode;
  language: Language;
}) {
  return (
    <Chip tone={MODE_TONE[mode]} title={mode}>
      {mode === "planned" ? <IconCircleOff size={11} stroke={2} aria-hidden="true" /> : null}
      {mode === "configured-unavailable" ? (
        <IconPlugConnectedX size={11} stroke={2} aria-hidden="true" />
      ) : null}
      {pick(CONNECTOR_MODE_LABELS[mode], language)}
    </Chip>
  );
}

/** What each mode means, in one sentence, for the group heading. */
export const MODE_EXPLANATIONS: Record<ConnectorMode, { en: string; de: string }> = {
  live: {
    en: "Connected to a real endpoint and reading real data.",
    de: "Mit einem echten Endpunkt verbunden und liest echte Daten.",
  },
  "sandbox-ready": {
    en: "The adapter is built and will run against a sandbox or live tenant when one is supplied. With no credential it reads the seeded institution and says so.",
    de: "Der Adapter ist gebaut und laeuft gegen eine Sandbox oder einen Live Mandanten, sobald einer bereitsteht. Ohne Anmeldeinformation liest er die eingespielte Institution und sagt das auch.",
  },
  simulated: {
    en: "Projects the seeded institution through the real connector contract. No vendor adapter is implemented and no credential is required.",
    de: "Projiziert die eingespielte Institution ueber den echten Konnektorvertrag. Kein Herstelleradapter ist umgesetzt und keine Anmeldeinformation erforderlich.",
  },
  "configured-unavailable": {
    en: "The adapter and its mappings exist and no endpoint is reachable. Changes routed here are queued and then need a retry.",
    de: "Der Adapter und seine Zuordnungen bestehen, es ist kein Endpunkt erreichbar. Aenderungen hierher werden eingereiht und benoetigen dann eine Wiederholung.",
  },
  planned: {
    en: "Named on the roadmap and not built. Every operation against it is refused rather than returning an empty result.",
    de: "Auf der Roadmap benannt und nicht gebaut. Jeder Vorgang wird abgelehnt, statt ein leeres Ergebnis zu liefern.",
  },
};

/* ==========================================================================
   Health
   ========================================================================== */

const HEALTH_TONE: Record<ConnectorHealthState, Tone> = {
  healthy: "success",
  degraded: "warning",
  unavailable: "danger",
  unconfigured: "warning",
  "not-implemented": "neutral",
};

const HEALTH_LABELS: Record<ConnectorHealthState, { en: string; de: string }> = {
  healthy: { en: "Responding", de: "Antwortet" },
  degraded: { en: "Degraded", de: "Eingeschraenkt" },
  unavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
  unconfigured: { en: "Not configured", de: "Nicht konfiguriert" },
  "not-implemented": { en: "Not built", de: "Nicht gebaut" },
};

export function ConnectorHealthChip({
  state,
  language,
}: {
  state: ConnectorHealthState;
  language: Language;
}) {
  return (
    <Chip tone={HEALTH_TONE[state]} title={state}>
      {state === "healthy" ? <IconCheck size={11} stroke={2.2} aria-hidden="true" /> : null}
      {state === "unavailable" || state === "degraded" ? (
        <IconAlertTriangle size={11} stroke={2} aria-hidden="true" />
      ) : null}
      {pick(HEALTH_LABELS[state], language)}
    </Chip>
  );
}

/* ==========================================================================
   Credential state
   ========================================================================== */

const SECRET_LABELS: Record<string, { en: string; de: string; tone: Tone }> = {
  "not-required": { en: "No credential required", de: "Keine Anmeldeinformation erforderlich", tone: "success" },
  absent: { en: "No credential configured", de: "Keine Anmeldeinformation konfiguriert", tone: "neutral" },
  present: { en: "Credential configured", de: "Anmeldeinformation konfiguriert", tone: "info" },
  invalid: { en: "Credential rejected", de: "Anmeldeinformation abgelehnt", tone: "danger" },
};

/**
 * The credential state, as a state.
 *
 * Four words and nothing else. There is no prop here for a value, a masked
 * value, a prefix, a suffix or a length, because every one of those is a way
 * for part of a credential to reach a browser. The schema stores only this
 * state for the same reason.
 */
export function SecretState({
  status,
  language,
}: {
  status: "not-required" | "absent" | "present" | "invalid";
  language: Language;
}) {
  const entry = SECRET_LABELS[status] ?? SECRET_LABELS.absent;
  if (!entry) return null;
  return (
    <Chip tone={entry.tone} title="Credential state only. No credential value is stored or displayed.">
      {pick({ en: entry.en, de: entry.de }, language)}
    </Chip>
  );
}

/* ==========================================================================
   Capabilities
   ========================================================================== */

const CAPABILITY_GROUP_LABELS = {
  read: { en: "Read", de: "Lesen" },
  search: { en: "Search", de: "Suchen" },
  events: { en: "Events", de: "Ereignisse" },
  draft: { en: "Draft", de: "Entwurf" },
  write: { en: "Write", de: "Schreiben" },
} as const;

/**
 * The declared capability surface.
 *
 * An empty group is rendered as "none" rather than omitted. Omitting it would
 * make a read only connector look the same as one whose write capability was
 * simply not displayed, and the difference between those two is the difference
 * between a connector that cannot change the bank's records and one that can.
 */
export function CapabilityList({
  capabilities,
  language,
}: {
  capabilities: ConnectorCapabilities;
  language: Language;
}) {
  const groups: Array<{ key: keyof typeof CAPABILITY_GROUP_LABELS; values: string[] }> = [
    { key: "read", values: capabilities.read },
    { key: "search", values: capabilities.search },
    { key: "events", values: capabilities.events },
    { key: "draft", values: capabilities.draft },
    { key: "write", values: capabilities.write },
  ];

  const flags: Array<{ label: { en: string; de: string }; on: boolean }> = [
    { label: { en: "Attachments", de: "Anhaenge" }, on: capabilities.attachments },
    { label: { en: "Deep links", de: "Direktlinks" }, on: capabilities.deepLinks },
    { label: { en: "Delta sync", de: "Delta Abgleich" }, on: capabilities.deltaSync },
    { label: { en: "Webhooks", de: "Webhooks" }, on: capabilities.webhooks },
  ];

  return (
    <div className="app-stack app-stack-1">
      {groups.map((group) => (
        <div key={group.key} className="app-row app-row-wrap">
          <span className="app-faint" style={{ minWidth: 62 }}>
            {pick(CAPABILITY_GROUP_LABELS[group.key], language)}
          </span>
          {group.values.length === 0 ? (
            <span className="app-faint">{language === "de" ? "keine" : "none"}</span>
          ) : (
            group.values.map((value) => (
              <span key={value} className="app-oid">
                {value}
              </span>
            ))
          )}
        </div>
      ))}
      <div className="app-row app-row-wrap">
        {flags.map((flag) => (
          <Chip key={flag.label.en} tone={flag.on ? "info" : "neutral"}>
            {pick(flag.label, language)}
            {flag.on ? "" : language === "de" ? ": nein" : ": no"}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Count summary for a collapsed row. */
export function CapabilitySummary({
  capabilities,
  language,
}: {
  capabilities: ConnectorCapabilities;
  language: Language;
}) {
  const total = capabilityCount(capabilities);
  if (total === 0) {
    return (
      <span className="app-faint">
        {language === "de" ? "Keine Faehigkeiten deklariert" : "No capabilities declared"}
      </span>
    );
  }
  return (
    <span className="app-row">
      <Data>{capabilities.read.length}</Data>
      <span className="app-faint">{language === "de" ? "lesbar" : "readable"}</span>
      <Data>{capabilities.write.length}</Data>
      <span className="app-faint">{language === "de" ? "schreibbar" : "writable"}</span>
      <Data>{capabilities.events.length}</Data>
      <span className="app-faint">{language === "de" ? "Ereignisse" : "events"}</span>
    </span>
  );
}

/* ==========================================================================
   Subscription and sync
   ========================================================================== */

const SUBSCRIPTION_LABELS: Record<string, { en: string; de: string }> = {
  none: { en: "No subscription", de: "Kein Abonnement" },
  webhook: { en: "Webhook", de: "Webhook" },
  "delta-sync": { en: "Delta sync", de: "Delta Abgleich" },
  polling: { en: "Polled", de: "Abgefragt" },
  simulated: { en: "Simulated deliveries", de: "Simulierte Zustellungen" },
};

export function SubscriptionChip({
  status,
  language,
}: {
  status: string;
  language: Language;
}) {
  const label = SUBSCRIPTION_LABELS[status] ?? { en: status, de: status };
  return (
    <Chip tone={status === "none" ? "neutral" : "info"} title={status}>
      {pick(label, language)}
    </Chip>
  );
}

/**
 * Last successful sync.
 *
 * "Never" is a distinct state from "a long time ago" and is shown as such. An
 * administrator diagnosing a missing source needs to know whether the
 * connector has ever worked.
 */
export function LastSyncLine({
  lastSyncAt,
  lastSyncStatus,
  language,
}: {
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  language: Language;
}) {
  if (!lastSyncAt) {
    return (
      <span className="app-row">
        <IconClock size={12} stroke={1.8} aria-hidden="true" />
        <span className="app-faint">
          {language === "de" ? "Noch nie erfolgreich abgeglichen" : "Never synced successfully"}
        </span>
        {lastSyncStatus && lastSyncStatus !== "never-run" ? (
          <span className="app-faint">
            {language === "de" ? "letzter Versuch" : "last attempt"} <Data>{lastSyncStatus}</Data>
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="app-row">
      <IconRefresh size={12} stroke={1.8} aria-hidden="true" />
      <span className="app-faint">{language === "de" ? "Zuletzt" : "Last successful"}</span>
      <Data title={lastSyncAt}>{lastSyncAt.slice(11, 19)}</Data>
      {lastSyncStatus ? <Data>{lastSyncStatus}</Data> : null}
    </span>
  );
}

/* ==========================================================================
   The instance row
   ========================================================================== */

export interface ConnectorRowModel {
  id: string;
  displayName: string;
  sourceSystem: string;
  vendorLabel: string;
  mode: ConnectorMode;
  healthState: ConnectorHealthState;
  healthMessage: string;
  capabilities: ConnectorCapabilities;
  endpointLabel: string;
  secretStatus: "not-required" | "absent" | "present" | "invalid";
  writeEnabled: boolean;
  eventSubscriptionStatus: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  deepLinkTemplate: string | null;
  readinessNote: string;
  referenceCount: number;
}

/**
 * One connector instance, fully described.
 *
 * Deliberately a row and not a card. The integration centre lists twenty
 * instances, and twenty cards is the pattern the V2 redesign exists to
 * remove: when everything is in a panel, nothing stands out and the one
 * unavailable connector reads the same as the eighteen healthy ones.
 */
export function ConnectorRow({
  model,
  language,
}: {
  model: ConnectorRowModel;
  language: Language;
}) {
  return (
    <Item
      large
      title={
        <span className="app-row app-row-wrap">
          <span className="app-strong">{model.displayName}</span>
          <ConnectorModeChip mode={model.mode} language={language} />
          <ConnectorHealthChip state={model.healthState} language={language} />
          {model.writeEnabled ? (
            <Chip tone="warning" title="This instance may change records in the target system.">
              {language === "de" ? "Schreiben aktiviert" : "Write enabled"}
            </Chip>
          ) : (
            <Chip tone="neutral">{language === "de" ? "Nur lesend" : "Read only"}</Chip>
          )}
          <SecretState status={model.secretStatus} language={language} />
        </span>
      }
      subtitle={
        <span className="app-stack app-stack-1">
          {/* Wraps: the readiness note is the claim, and a claim cut off at 1366 is not made. */}
          <span style={{ whiteSpace: "normal" }}>{model.readinessNote}</span>
          <span className="app-row app-row-wrap">
            <span className="app-faint">{language === "de" ? "Quelle" : "Source"}</span>
            <span>{model.sourceSystem}</span>
            <span className="app-context-sep" aria-hidden="true">
              /
            </span>
            <span className="app-faint">{model.vendorLabel}</span>
          </span>
        </span>
      }
      trailing={
        <span className="app-stack app-stack-1" style={{ alignItems: "flex-end" }}>
          <SubscriptionChip status={model.eventSubscriptionStatus} language={language} />
          <LastSyncLine
            lastSyncAt={model.lastSyncAt}
            lastSyncStatus={model.lastSyncStatus}
            language={language}
          />
        </span>
      }
    >
      <div className="app-stack app-stack-3" style={{ marginTop: "var(--app-2)" }}>
        <CapabilityList capabilities={model.capabilities} language={language} />
        <div className="app-row app-row-wrap">
          <span className="app-faint">{language === "de" ? "Endpunkt" : "Endpoint"}</span>
          <span className="app-meta">{model.endpointLabel}</span>
          {model.deepLinkTemplate ? (
            <>
              <IconLink size={12} stroke={1.8} aria-hidden="true" />
              <span className="app-oid">{model.deepLinkTemplate}</span>
            </>
          ) : (
            <span className="app-faint">
              {language === "de" ? "kein Direktlink moeglich" : "no deep link possible"}
            </span>
          )}
          <span className="app-faint">
            {language === "de" ? "projizierte Datensaetze" : "projected records"}
          </span>
          <Data>{model.referenceCount}</Data>
        </div>
        {model.healthState !== "healthy" ? (
          <span className="app-meta">{model.healthMessage}</span>
        ) : null}
      </div>
    </Item>
  );
}
