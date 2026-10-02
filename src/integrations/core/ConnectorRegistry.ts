/**
 * The connector registry.
 *
 * Two lookups live here and they are deliberately separate.
 *
 * The first is key to implementation: a `connector_key` string resolves to a
 * factory. The second is instance to connector: a row in
 * `connector_instances` names a key, and resolving the row produces a
 * connector bound to that row's mode, health, capabilities and deep link
 * template.
 *
 * Keeping them apart is what lets one implementation serve several instances.
 * The Microsoft 365 simulator and the Microsoft Graph adapter are different
 * keys, but the Graph adapter without credentials degrades to the simulator's
 * reads, and it does so by resolving the simulator's factory rather than by
 * duplicating it.
 *
 * A key with no registered factory is a hard failure, never a silent empty
 * result. The failure mode that motivated this: an instance row seeded with a
 * misspelled key produced a connector that returned no records, which looked
 * exactly like a healthy source with nothing to say.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { connectorInstances, type ConnectorMode } from "@/db/schema/integration";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import type {
  Connector,
  ConnectorCapabilities,
  ConnectorFactory,
  ConnectorInstanceView,
} from "./Connector";
import { ConnectorError } from "./errors";

/* ==========================================================================
   Key to implementation
   ========================================================================== */

const factories = new Map<string, ConnectorFactory>();

/**
 * Registers a factory for a connector key.
 *
 * Re-registration throws rather than overwriting. Two modules claiming the
 * same key is a mistake every time, and discovering it at import is far
 * cheaper than discovering that half the application got one implementation
 * and half got the other.
 */
export function registerConnector(key: string, factory: ConnectorFactory): void {
  if (factories.has(key)) {
    throw new Error(`A connector factory for "${key}" is already registered.`);
  }
  factories.set(key, factory);
}

/** Replaces a factory. Tests only, and it is explicit about being a test seam. */
export function replaceConnectorForTest(key: string, factory: ConnectorFactory): void {
  factories.set(key, factory);
}

export function hasConnector(key: string): boolean {
  return factories.has(key);
}

export function registeredConnectorKeys(): string[] {
  return [...factories.keys()].sort();
}

/** Resolves a key to a factory, or throws with the key named. */
export function resolveConnectorFactory(key: string): ConnectorFactory {
  const factory = factories.get(key);
  if (!factory) {
    throw new ConnectorError(
      "connector-not-registered",
      `No connector implementation is registered for the key "${key}". Registered keys: ${registeredConnectorKeys().join(", ") || "none"}.`,
      { detail: `unregistered connector key ${key}` },
    );
  }
  return factory;
}

/* ==========================================================================
   Instance lookup
   ========================================================================== */

/** Converts a database row into the narrowed view a connector may see. */
function toInstanceView(row: typeof connectorInstances.$inferSelect): ConnectorInstanceView {
  return {
    id: row.id,
    packId: row.packId,
    connectorKey: row.connectorKey,
    displayName: row.displayName,
    sourceSystem: row.sourceSystem,
    mode: row.mode,
    healthState: row.healthState,
    healthMessage: row.healthMessage,
    capabilities: row.capabilities as ConnectorCapabilities,
    endpointLabel: row.endpointLabel,
    secretStatus: row.secretStatus,
    writeEnabled: row.writeEnabled,
    eventSubscriptionStatus: row.eventSubscriptionStatus,
    lastSyncAt: row.lastSyncAt,
    lastSyncStatus: row.lastSyncStatus,
    deepLinkTemplate: row.deepLinkTemplate,
    requiredByPacks: row.requiredByPacks,
  };
}

/** One instance by identifier, or null. */
export function getConnectorInstance(instanceId: string): ConnectorInstanceView | null {
  const row = getDb()
    .select()
    .from(connectorInstances)
    .where(eq(connectorInstances.id, instanceId))
    .get();
  return row ? toInstanceView(row) : null;
}

/** One instance by identifier, throwing when absent. */
export function requireConnectorInstance(instanceId: string): ConnectorInstanceView {
  const instance = getConnectorInstance(instanceId);
  if (!instance) {
    throw new ConnectorError(
      "connector-not-registered",
      `No connector instance "${instanceId}" exists. Run the integration seed.`,
      { connectorInstanceId: instanceId, detail: `unknown connector instance ${instanceId}` },
    );
  }
  return instance;
}

/**
 * Instances by connector key.
 *
 * Returns an array because one key may be instantiated more than once, for
 * example one GRC instance per legal entity in a real engagement.
 */
export function getConnectorInstancesByKey(connectorKey: string): ConnectorInstanceView[] {
  return getDb()
    .select()
    .from(connectorInstances)
    .where(eq(connectorInstances.connectorKey, connectorKey))
    .all()
    .map(toInstanceView);
}

export interface ConnectorInstanceFilter {
  packId?: string;
  mode?: ConnectorMode;
  /** Only instances that can actually be called in this build. */
  operableOnly?: boolean;
}

/**
 * Lists instances, newest configuration first within a mode.
 *
 * `operableOnly` filters to the modes that resolve to a working
 * implementation. A planned adapter is a roadmap entry, not something the
 * runtime should be handed when a caller asks for "every connector that can
 * read a control".
 */
export function listConnectorInstances(
  filter: ConnectorInstanceFilter = {},
): ConnectorInstanceView[] {
  const conditions = [];
  if (filter.packId) conditions.push(eq(connectorInstances.packId, filter.packId));
  if (filter.mode) conditions.push(eq(connectorInstances.mode, filter.mode));

  const rows =
    conditions.length > 0
      ? getDb()
          .select()
          .from(connectorInstances)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .all()
      : getDb().select().from(connectorInstances).all();

  const views = rows.map(toInstanceView);
  const operable = filter.operableOnly
    ? views.filter((instance) => isOperableMode(instance.mode))
    : views;

  return operable.sort(
    (a, b) => MODE_ORDER[a.mode] - MODE_ORDER[b.mode] || a.displayName.localeCompare(b.displayName),
  );
}

/** Display order for the integration centre: most real first. */
export const MODE_ORDER: Record<ConnectorMode, number> = {
  live: 0,
  "sandbox-ready": 1,
  simulated: 2,
  "configured-unavailable": 3,
  planned: 4,
};

/**
 * True when an instance in this mode resolves to something callable.
 *
 * `configured-unavailable` is operable on purpose. The instance has an
 * implementation and a configuration; what it does not have is a reachable
 * target. The runtime must still be able to call it, because the honest
 * result of that call is a retryable `connector-unavailable` error that
 * produces a visible queued command, not a silently skipped one.
 */
export function isOperableMode(mode: ConnectorMode): boolean {
  return mode !== "planned";
}

/** An instance plus its resolved implementation. */
export interface ResolvedConnector {
  instance: ConnectorInstanceView;
  connector: Connector;
}

/**
 * Resolves an instance identifier to a usable connector.
 *
 * A `planned` instance resolves successfully and its connector refuses every
 * operation with `connector-not-implemented`. That is the correct behaviour:
 * the roadmap entry exists, the honesty is in the refusal, and the refusal is
 * a real code path rather than a comment in a document.
 */
export function resolveConnector(instanceId: string): ResolvedConnector {
  const instance = requireConnectorInstance(instanceId);
  const factory = resolveConnectorFactory(instance.connectorKey);
  return { instance, connector: factory(instance) };
}

/** Every instance that declares the given inbound event type. */
export function instancesForEventType(eventType: string): ConnectorInstanceView[] {
  return listConnectorInstances({ operableOnly: true }).filter((instance) =>
    instance.capabilities.events.includes(eventType),
  );
}

/** The run the registry defaults to when a caller does not name one. */
export const REGISTRY_DEFAULT_RUN_ID = DEFAULT_RUN_ID;
