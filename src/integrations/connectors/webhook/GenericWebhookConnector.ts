/**
 * The generic webhook connector.
 *
 * The one connector that is inbound only. It has no read, no search, no sync
 * and no write, because a webhook endpoint is not a system you can ask
 * questions of: something pushes to it and that is the whole relationship.
 *
 * Written out rather than built from the simulated base, because the base
 * exists to share projection and write behaviour and this connector has
 * neither. What it does have is the honest refusal of five of the eight
 * members of the interface, which reads more clearly as explicit methods than
 * as an empty configuration object.
 *
 * It is the connector a bank would point an arbitrary internal system at on
 * day one of an engagement, before any vendor adapter exists, and that is why
 * it is in the five. Note what it does not do: it does not verify a
 * signature. Signature verification needs a shared secret, and this build
 * stores no credential of any kind. That gap is recorded in
 * docs/PRODUCTIZATION_GAPS.md and it is the first thing to close.
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

export const GENERIC_WEBHOOK_KEY = "webhook.generic";

/** The three event shapes the endpoint accepts from an arbitrary system. */
export const GENERIC_WEBHOOK_EVENTS = [
  "webhook.record.created",
  "webhook.record.updated",
  "webhook.signal.raised",
] as const;

export const GENERIC_WEBHOOK_CAPABILITIES: ConnectorCapabilities = {
  read: [],
  search: [],
  events: [...GENERIC_WEBHOOK_EVENTS],
  draft: [],
  write: [],
  attachments: false,
  /*
   * No deep links. A generic endpoint does not know the URL scheme of
   * whatever pushed to it, and a template guessed from the payload would
   * produce links that go nowhere. The interface omits the link instead.
   */
  deepLinks: false,
  deltaSync: false,
  webhooks: true,
};

/** The refusal every outbound member of this connector returns. */
function inboundOnly(instance: ConnectorInstanceView, operation: string): ConnectorError {
  return new ConnectorError(
    "capability-not-declared",
    `${instance.displayName} is inbound only and cannot ${operation}. It receives deliveries and declares no read or write capability.`,
    { connectorInstanceId: instance.id, detail: `inbound only, ${operation} refused` },
  );
}

export function genericWebhookFactory(instance: ConnectorInstanceView): Connector {
  const metadata = (): ConnectorMetadata => ({
    key: GENERIC_WEBHOOK_KEY,
    packId: "generic-rest-webhook",
    displayName: instance.displayName,
    sourceSystem: instance.sourceSystem,
    vendorLabel: "Generic inbound webhook",
    mode: instance.mode,
    endpointLabel:
      instance.endpointLabel.length > 0
        ? instance.endpointLabel
        : "POST /api/integrations/webhook/webhook.generic",
    deepLinkTemplate: null,
    requiresCredential: false,
    readinessNote:
      "Simulated. Accepts an inbound event from any system and runs the full inbound pipeline. No signature is verified in this build.",
  });

  return {
    metadata,
    capabilities: () => GENERIC_WEBHOOK_CAPABILITIES,

    async health(context: ConnectorContext): Promise<ConnectorHealth> {
      const available = instance.healthState !== "unavailable";
      return {
        state: available ? "healthy" : "unavailable",
        message: available
          ? "The endpoint is accepting deliveries. Deduplication is by connector and event key."
          : "The endpoint is marked unavailable and is rejecting deliveries.",
        checkedAt: context.clock.nowIso(),
        lastSuccessfulSyncAt: instance.lastSyncAt,
        secretStatus: "not-required",
      };
    },

    async read(objectType: string): Promise<ConnectorReadResult> {
      throw inboundOnly(instance, `read "${objectType}"`);
    },

    async search(_query: string, options: { objectType: string }): Promise<ConnectorSearchResult> {
      throw inboundOnly(instance, `search "${options.objectType}"`);
    },

    async sync(): Promise<ConnectorSyncResult> {
      throw inboundOnly(instance, "run a delta sync");
    },

    async execute(): Promise<ConnectorAcknowledgement> {
      throw inboundOnly(instance, "execute an outbound command");
    },

    async subscribe(context: ConnectorContext): Promise<ConnectorSubscription> {
      return {
        mechanism: "webhook",
        eventTypes: [...GENERIC_WEBHOOK_EVENTS],
        endpointLabel: metadata().endpointLabel,
        active: instance.healthState !== "unavailable",
        note: `No signature verification in this build. Checked at ${context.clock.nowIso()}.`,
      };
    },
  };
}
