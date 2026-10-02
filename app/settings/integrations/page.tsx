/**
 * The integration centre.
 *
 * Connector instances grouped by mode, each with its health, its declared
 * capabilities, its last successful sync, its event subscription, whether it
 * may write, and the state of its credential. Then the outbox: every command
 * that has not been acknowledged, with a retry that works.
 *
 * The grouping is the editorial decision this screen turns on. Sorting
 * alphabetically would put ServiceNow IRM, which does not exist, two rows
 * above the GRC simulator, which is what the whole product is reading from. By
 * mode, the reader meets what is real first and reaches the roadmap last, and
 * every group carries a sentence saying what its mode means. Nobody can leave
 * this screen believing there are twenty working integrations.
 *
 * Nothing on this page can display a credential. The only credential related
 * value that reaches it is a four valued state column.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { connectorPacks, deadLetterEntries, externalReferences } from "@/db/schema/integration";
import { CONNECTOR_MODES, type ConnectorMode } from "@/db/schema/integration";
import { getScenarioState } from "@/scenario/engine/state";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  listConnectors,
  listQueue,
  summariseOutbox,
  resolveConnector,
  listInboundEvents,
  listSyncState,
} from "@/integrations/runtime/IntegrationRuntime";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import {
  Chip,
  Data,
  Empty,
  Item,
  List,
  Notice,
  RegulatoryNote,
} from "@/components/workday-v2/primitives";
import {
  ConnectorControls,
  ConnectorRow,
  MODE_EXPLANATIONS,
  RetryQueue,
  type ConnectorRowModel,
  type QueueRowModel,
} from "@/components/integrations";
import { CONNECTOR_MODE_LABELS, pick } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

/** Connectors whose simulated system can be switched off from this screen. */
const CONTROLLABLE_KEYS = new Set([
  "simulated.grc",
  "simulated.microsoft-365",
  "simulated.process-intelligence",
  "simulated.document-repository",
  "webhook.generic",
  "generic-rest",
  "microsoft-graph",
]);

export default function IntegrationsSettingsPage() {
  const language: Language = "en";
  const state = getScenarioState();
  const runId = state?.runId ?? DEFAULT_RUN_ID;

  const instances = listConnectors();
  const packs = getDb().select().from(connectorPacks).all();
  const queue = listQueue(runId);
  const summary = summariseOutbox(runId);
  const syncState = listSyncState(runId);
  const inbound = listInboundEvents(runId);

  const references = getDb()
    .select()
    .from(externalReferences)
    .where(eq(externalReferences.runId, runId))
    .all();

  const deadLetters = getDb()
    .select()
    .from(deadLetterEntries)
    .where(eq(deadLetterEntries.runId, runId))
    .all();

  if (instances.length === 0) {
    return (
      <div className="app-stack app-stack-6">
        <SettingsHead
          eyebrow="Administrator area"
          title="Integrations"
          lede="Connector instances, their declared capabilities, their health and the outbound command queue."
        />
        <Notice tone="warning">
          No connector instances are configured. Run the migration and the seed, then call the
          integration seed, to populate the connector registry.
        </Notice>
      </div>
    );
  }

  /*
   * The readiness note and the record count come from two places and are
   * assembled here rather than in the component, so the row component stays a
   * pure function of its view model and can be rendered in a test.
   */
  const models: Record<ConnectorMode, ConnectorRowModel[]> = {
    live: [],
    "sandbox-ready": [],
    simulated: [],
    "configured-unavailable": [],
    planned: [],
  };

  for (const instance of instances) {
    let readinessNote = instance.healthMessage;
    let vendorLabel = instance.sourceSystem;
    try {
      const metadata = resolveConnector(instance.id).connector.metadata();
      readinessNote = metadata.readinessNote;
      vendorLabel = metadata.vendorLabel;
    } catch {
      /*
       * A connector key with no registered factory. The row still renders,
       * carrying the instance's own health message, because an administrator
       * diagnosing a misconfigured key needs to see the row rather than have
       * it silently disappear from the list.
       */
      readinessNote = `No implementation is registered for the connector key "${instance.connectorKey}". The instance row exists and cannot be used.`;
    }

    models[instance.mode].push({
      id: instance.id,
      displayName: instance.displayName,
      sourceSystem: instance.sourceSystem,
      vendorLabel,
      mode: instance.mode,
      healthState: instance.healthState,
      healthMessage: instance.healthMessage,
      capabilities: instance.capabilities,
      endpointLabel: instance.endpointLabel,
      secretStatus: instance.secretStatus,
      writeEnabled: instance.writeEnabled,
      eventSubscriptionStatus: instance.eventSubscriptionStatus,
      lastSyncAt: instance.lastSyncAt,
      lastSyncStatus: instance.lastSyncStatus,
      deepLinkTemplate: instance.deepLinkTemplate,
      readinessNote,
      referenceCount: references.filter((row) => row.connectorInstanceId === instance.id).length,
    });
  }

  const deadLetterByCommand = new Map(deadLetters.map((row) => [row.commandId, row]));

  const queueRows: QueueRowModel[] = queue.map((command) => {
    const instance = instances.find((entry) => entry.id === command.connectorInstanceId);
    const deadLetter = deadLetterByCommand.get(command.id);
    return {
      commandId: command.id,
      status: command.status,
      targetSystem: instance?.sourceSystem ?? command.connectorInstanceId,
      connectorInstanceId: command.connectorInstanceId,
      commandKind: command.commandKind,
      intentStatement: command.intentStatement,
      attempts: command.attempts,
      maxAttempts: command.maxAttempts,
      nextAttemptAt: command.nextAttemptAt,
      lastError: command.lastError,
      atMoment: command.atMoment,
      decisionId: command.decisionId,
      approvalId: command.approvalId,
      authorityClass: command.authorityClass,
      /*
       * A command awaiting approval is not retryable. Retrying it would be
       * asking the dispatcher to send a change nobody has approved, and the
       * gate would refuse, so offering the button would be offering an action
       * that cannot work.
       */
      retryable:
        command.status !== "awaiting-approval" && (deadLetter ? deadLetter.retryable : true),
      deadLetterReason: deadLetter?.reason ?? "",
    };
  });

  const controls = instances
    .filter((instance) => CONTROLLABLE_KEYS.has(instance.connectorKey))
    .map((instance) => ({
      id: instance.id,
      displayName: instance.displayName,
      available: instance.healthState === "healthy",
      canSimulateEvent:
        instance.connectorKey === "simulated.process-intelligence" ||
        instance.connectorKey === "webhook.generic",
      canSync: instance.capabilities.deltaSync && instance.capabilities.read.length > 0,
    }));

  const conflictedCount = references.filter((row) => row.conflicted).length;
  const syncedTypes = syncState.filter((row) => row.lastSyncStatus === "ok").length;

  return (
    <div className="app-stack app-stack-6">
      <SettingsHead
        eyebrow="Administrator area"
        title="Integrations"
        lede="The product is a system of engagement. The bank's GRC platform, document repository, process intelligence tool and collaboration suite remain systems of record. Every connector instance below declares exactly one readiness mode, and the mode is the claim: a simulated source says so, and an adapter that is only on the roadmap refuses every operation rather than returning an empty result."
      />

      <SettingsSection title="State of the fabric">
        <div className="app-grid-3">
          <Item
            title={<Data size="sm">{instances.length}</Data>}
            subtitle="Connector instances configured"
          />
          <Item
            title={<Data size="sm">{references.length}</Data>}
            subtitle={`External references retained, ${conflictedCount} flagged as conflicted`}
          />
          <Item
            title={<Data size="sm">{inbound.length}</Data>}
            subtitle="Inbound events received, deduplicated on connector and event key"
          />
          <Item
            title={<Data size="sm">{syncedTypes}</Data>}
            subtitle={`Object types synced at least once, of ${syncState.length} configured`}
          />
          <Item
            title={<Data size="sm">{summary.acknowledged}</Data>}
            subtitle="Outbound commands acknowledged by a target system"
          />
          <Item
            title={<Data size="sm">{summary.queued + summary.failed + summary.deadLettered}</Data>}
            subtitle="Outbound commands not yet confirmed"
          />
        </div>
      </SettingsSection>

      {CONNECTOR_MODES.map((mode) => {
        const group = models[mode];
        if (group.length === 0) return null;
        return (
          <SettingsSection
            key={mode}
            title={pick(CONNECTOR_MODE_LABELS[mode], language)}
            count={group.length}
            trailing={<Chip tone="neutral">{mode}</Chip>}
          >
            <div className="app-stack app-stack-3">
              <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
                {pick(MODE_EXPLANATIONS[mode], language)}
              </p>
              <List label={`${mode} connector instances`}>
                {group.map((model) => (
                  <ConnectorRow key={model.id} model={model} language={language} />
                ))}
              </List>
            </div>
          </SettingsSection>
        );
      })}

      <SettingsSection title="Connector controls">
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            Setting a connector unavailable is how the failure path is demonstrated. An approved
            decision routed to an unavailable target is queued and then dead lettered. The decision,
            its rationale and its approval are untouched: what failed is the delivery of its
            consequence to one external system, and recovering the connector lets the same command
            complete on its original idempotency key.
          </p>
          <ConnectorControls instances={controls} language={language} />
        </div>
      </SettingsSection>

      <SettingsSection title="Outbound command queue" count={queueRows.length}>
        <RetryQueue rows={queueRows} language={language} />
      </SettingsSection>

      <SettingsSection title="Connector packs" count={packs.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            A pack is a connector family. The named adapters listed against each family are the
            scope a real engagement would discuss. None of them is a claim: the mode on each
            instance above is what says whether anything is built.
          </p>
          <List label="Connector packs">
            {packs.map((pack) => (
              <Item
                key={pack.id}
                title={
                  <span className="app-row app-row-wrap">
                    <span className="app-strong">{pack.name}</span>
                    <Chip tone="neutral">{pack.family}</Chip>
                    {pack.id === "regulatory-content" ? (
                      <Chip tone="info" title="Jurisdiction aware">
                        Jurisdiction aware
                      </Chip>
                    ) : null}
                  </span>
                }
                subtitle={
                  <span className="app-stack app-stack-1">
                    <span>{pack.description}</span>
                    {pack.id === "regulatory-content" ? <RegulatoryNote language={language} /> : null}
                  </span>
                }
                trailing={
                  <span className="app-row app-row-wrap" style={{ justifyContent: "flex-end" }}>
                    {pack.namedAdapters.map((adapter) => (
                      <span key={adapter} className="app-faint">
                        {adapter}
                      </span>
                    ))}
                  </span>
                }
              />
            ))}
          </List>
        </div>
      </SettingsSection>

      <SettingsSection title="Sync state and freshness thresholds" count={syncState.length}>
        <div className="app-stack app-stack-3">
          <p className="app-secondary" style={{ maxWidth: "76ch", margin: 0 }}>
            The staleness threshold is per connector and object type, because two sources do not age
            at the same rate. An assessment four hours old is current. A payment volume four hours
            old is not. The threshold is what turns a sync timestamp into the word the interface
            shows beside the data.
          </p>
          {syncState.length === 0 ? (
            <Empty
              title="No sync state configured"
              detail="A row appears here for every object type a connector declares as readable."
            />
          ) : (
            <List label="Sync state">
              {syncState.map((row) => {
                const instance = instances.find((entry) => entry.id === row.connectorInstanceId);
                return (
                  <Item
                    key={row.id}
                    title={
                      <span className="app-row app-row-wrap">
                        <span>{instance?.sourceSystem ?? row.connectorInstanceId}</span>
                        <span className="app-oid">{row.objectType}</span>
                      </span>
                    }
                    subtitle={
                      <span className="app-row app-row-wrap">
                        <span className="app-faint">Stale after</span>
                        <Data>{row.stalenessThresholdMinutes}</Data>
                        <span className="app-faint">minutes</span>
                        <span className="app-context-sep" aria-hidden="true">
                          /
                        </span>
                        <span className="app-faint">status</span>
                        <span className="app-oid">{row.lastSyncStatus}</span>
                      </span>
                    }
                    trailing={
                      <span className="app-row">
                        <Data>{row.recordsSeen}</Data>
                        <span className="app-faint">seen</span>
                        <Data>{row.recordsChanged}</Data>
                        <span className="app-faint">changed</span>
                        <Data>{row.recordsConflicted}</Data>
                        <span className="app-faint">conflicted</span>
                      </span>
                    }
                  />
                );
              })}
            </List>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
