/**
 * The generic REST connector.
 *
 * This is the adapter an engagement would point at an arbitrary internal HTTP
 * API before a vendor specific connector exists. It is seeded in
 * `configured-unavailable` mode, and that mode is the honest one for a
 * specific reason worth stating.
 *
 * The connector is implemented. It knows its object types, it maps its records
 * and it would queue, retry and dead letter correctly. What it does not have
 * is a reachable endpoint, because this build makes no outbound network calls
 * at all: no credential is stored anywhere, and an adapter that quietly
 * attempted a request to a configured host would be making a network call
 * from a prototype that claims not to.
 *
 * So every operation refuses with `connector-unavailable`, which is retryable,
 * which means an approved change routed here produces a visible queued command
 * and then a dead letter an operator can act on. That is a far more useful
 * demonstration than a connector that pretends to work, and it is exactly the
 * state a real engagement sees on the morning before the first endpoint is
 * whitelisted.
 */

import type {
  Connector,
  ConnectorAcknowledgement,
  ConnectorCapabilities,
  ConnectorHealth,
  ConnectorInstanceView,
  ConnectorMetadata,
  ConnectorReadResult,
  ConnectorSearchResult,
  ConnectorSubscription,
  ConnectorSyncResult,
} from "@/integrations/core/Connector";
import type { ConnectorContext } from "@/integrations/core/ConnectorContext";
import { ConnectorError } from "@/integrations/core/errors";

export const GENERIC_REST_KEY = "generic-rest";

export const GENERIC_REST_CAPABILITIES: ConnectorCapabilities = {
  read: ["rest.record"],
  search: ["rest.record"],
  events: ["rest.record.changed"],
  draft: [],
  write: ["rest.record"],
  attachments: false,
  deepLinks: true,
  deltaSync: true,
  webhooks: true,
};

/**
 * The single refusal.
 *
 * `connector-unavailable` rather than `connector-not-implemented`, because the
 * difference matters to the operator reading the queue: not implemented means
 * wait for a release, unavailable means fix the configuration or the network.
 */
function unreachable(instance: ConnectorInstanceView, operation: string): ConnectorError {
  return new ConnectorError(
    "connector-unavailable",
    `${instance.displayName} has no reachable endpoint in this build, so it could not ${operation}. This build makes no outbound network calls and stores no credential.`,
    { connectorInstanceId: instance.id, detail: `no reachable endpoint for ${operation}` },
  );
}

export function genericRestFactory(instance: ConnectorInstanceView): Connector {
  const metadata = (): ConnectorMetadata => ({
    key: GENERIC_REST_KEY,
    packId: "generic-rest-webhook",
    displayName: instance.displayName,
    sourceSystem: instance.sourceSystem,
    vendorLabel: "Generic REST adapter",
    mode: instance.mode,
    endpointLabel:
      instance.endpointLabel.length > 0 ? instance.endpointLabel : "No endpoint configured",
    deepLinkTemplate: instance.deepLinkTemplate,
    requiresCredential: true,
    readinessNote:
      "Configured but unavailable. The adapter and its mappings exist; no endpoint is reachable and no credential is stored, so every operation refuses with a retryable unavailability.",
  });

  return {
    metadata,
    capabilities: () => GENERIC_REST_CAPABILITIES,

    async health(context: ConnectorContext): Promise<ConnectorHealth> {
      return {
        state: instance.secretStatus === "absent" ? "unconfigured" : "unavailable",
        message:
          instance.secretStatus === "absent"
            ? "No credential is configured, and this build deliberately stores none. The adapter cannot reach an endpoint."
            : "No endpoint is reachable. Changes routed here are queued and then dead lettered for a retry.",
        checkedAt: context.clock.nowIso(),
        lastSuccessfulSyncAt: instance.lastSyncAt,
        secretStatus: instance.secretStatus,
      };
    },

    async read(objectType: string): Promise<ConnectorReadResult> {
      throw unreachable(instance, `read "${objectType}"`);
    },

    async search(_query: string, options: { objectType: string }): Promise<ConnectorSearchResult> {
      throw unreachable(instance, `search "${options.objectType}"`);
    },

    async sync(): Promise<ConnectorSyncResult> {
      throw unreachable(instance, "run a delta sync");
    },

    async execute(): Promise<ConnectorAcknowledgement> {
      throw unreachable(instance, "execute an outbound command");
    },

    async subscribe(context: ConnectorContext): Promise<ConnectorSubscription> {
      return {
        mechanism: "none",
        eventTypes: [],
        endpointLabel: metadata().endpointLabel,
        active: false,
        note: `No subscription is registered because no endpoint is reachable. Checked at ${context.clock.nowIso()}.`,
      };
    },
  };
}
