/**
 * The Microsoft Graph adapter.
 *
 * The one connector in this build with a sandbox or live profile, and the one
 * place where the question "what happens when there is no credential" has a
 * visible answer.
 *
 * With no credential configured it reports mode `sandbox-ready` and degrades
 * to the Microsoft 365 simulator's projections. Degrade means exactly that:
 * the reads work, they return the seeded institution, and the source
 * attribution row says "sandbox ready" rather than "live". It does not mean
 * the adapter pretends to have called Graph.
 *
 * Three rules govern this file and they are the reason it is written the way
 * it is.
 *
 * First, the complete local experience requires no external credential. So the
 * default path is the degraded one and it is fully functional. Nothing in the
 * product is unreachable because a key is absent.
 *
 * Second, no credential value is ever read, printed, logged or stored here.
 * `resolveProfile` asks only whether a credential is present, through the
 * instance row's `secretStatus` column, which holds a state and not a value.
 * There is no environment read in this module and no place a secret could
 * enter it.
 *
 * Third, when a credential is present the adapter reports `live` and refuses
 * every operation with `authentication-missing` rather than attempting a
 * request. That looks backwards and it is deliberate: the Graph client is not
 * implemented in this build, and an adapter that claimed `live` and then
 * silently served simulator data would be the single most dishonest thing in
 * the product. Refusing names the gap. docs/PRODUCTIZATION_GAPS.md records it
 * as the next piece of work on this connector.
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
  ConnectorSyncRequest,
  ConnectorSyncResult,
  ExternalRecord,
} from "@/integrations/core/Connector";
import type { ConnectorContext } from "@/integrations/core/ConnectorContext";
import { ConnectorError } from "@/integrations/core/errors";
import { MICROSOFT_365_PROJECTIONS } from "../simulated/microsoft365";
import { applyCursor, filterRecords, findRecord } from "../simulated/scenario-source";

export const MICROSOFT_GRAPH_KEY = "microsoft-graph";

/**
 * Graph object types, named as Graph names them.
 *
 * Kept as the Graph vocabulary rather than the simulator's, because the whole
 * point of the sandbox profile is that the mapping from Graph types to
 * canonical types is exercised locally and does not have to be invented on the
 * day a tenant appears.
 */
export const MICROSOFT_GRAPH_CAPABILITIES: ConnectorCapabilities = {
  read: ["graph.message", "graph.event", "graph.chatMessage", "graph.user"],
  search: ["graph.message", "graph.chatMessage"],
  events: ["graph.message.received", "graph.event.updated"],
  draft: ["graph.message", "graph.chatMessage"],
  /*
   * No write capability, in any profile. Writing to a real mailbox or calendar
   * is outside what this product is for, and `sendExternalEmail` is a
   * registered PROHIBITED tool. A capability here would contradict that.
   */
  write: [],
  attachments: true,
  deepLinks: true,
  deltaSync: true,
  webhooks: true,
};

export type GraphProfile = "sandbox" | "live";

/**
 * Which profile the adapter is running in.
 *
 * Reads the credential state only, never a credential. `present` means a
 * person has configured something; what they configured is not this module's
 * business and there is no code path here that could look.
 */
export function resolveProfile(instance: ConnectorInstanceView): {
  profile: GraphProfile;
  reason: string;
} {
  if (instance.secretStatus === "present") {
    return {
      profile: "live",
      reason:
        "A credential is configured for this instance. The Graph client is not implemented in this build, so operations refuse rather than silently serving simulator data.",
    };
  }
  return {
    profile: "sandbox",
    reason:
      "No credential is configured. The adapter runs its sandbox profile and reads the seeded institution through the Microsoft 365 simulator.",
  };
}

/** Graph type to the simulator projection that stands in for it. */
function sandboxProjection(objectType: string): (runId: string) => ExternalRecord[] {
  switch (objectType) {
    case "graph.message":
      return MICROSOFT_365_PROJECTIONS["m365.message"];
    case "graph.event":
      return MICROSOFT_365_PROJECTIONS["m365.event"];
    case "graph.chatMessage":
      return MICROSOFT_365_PROJECTIONS["m365.chatMessage"];
    case "graph.user":
      return MICROSOFT_365_PROJECTIONS["m365.user"];
    default:
      throw new ConnectorError(
        "capability-not-declared",
        `The Graph adapter has no sandbox projection for "${objectType}".`,
        { detail: `no sandbox projection for ${objectType}` },
      );
  }
}

/**
 * Re-stamps a simulator record under its Graph external type.
 *
 * Without this, a record read through the Graph adapter would carry the
 * simulator's external type, and the two instances would compete for the same
 * row in `external_references` through the identity unique index. Keeping the
 * external types distinct is what lets both instances project the same
 * canonical object while remaining separately attributable, which is the whole
 * reason the source row can say "two sources agree".
 */
function asGraphRecord(record: ExternalRecord, graphType: string): ExternalRecord {
  return { ...record, externalType: graphType };
}

export function microsoftGraphFactory(instance: ConnectorInstanceView): Connector {
  const { profile, reason } = resolveProfile(instance);

  const liveRefusal = (operation: string): ConnectorError =>
    new ConnectorError(
      "authentication-missing",
      `The Microsoft Graph adapter is configured for a live profile but the Graph client is not implemented in this build, so it cannot ${operation}. Remove the credential to run the sandbox profile against the seeded institution.`,
      { connectorInstanceId: instance.id, detail: `graph live profile not implemented` },
    );

  const assertUsable = (operation: string): void => {
    if (profile === "live") throw liveRefusal(operation);
    if (instance.healthState === "unavailable") {
      throw new ConnectorError(
        "connector-unavailable",
        `${instance.displayName} is marked unavailable.`,
        { connectorInstanceId: instance.id, detail: "graph instance unavailable" },
      );
    }
  };

  const metadata = (): ConnectorMetadata => ({
    key: MICROSOFT_GRAPH_KEY,
    packId: "microsoft-365",
    displayName: instance.displayName,
    sourceSystem: instance.sourceSystem,
    vendorLabel: "Microsoft Graph",
    /*
     * The instance row's mode is authoritative for display, but the adapter
     * reports what its profile actually is, so a row seeded "sandbox-ready"
     * that later acquires a credential does not keep claiming sandbox.
     */
    mode: profile === "live" ? "live" : "sandbox-ready",
    endpointLabel:
      profile === "live"
        ? "Microsoft Graph v1.0, tenant configured"
        : "Sandbox profile. No endpoint is contacted.",
    deepLinkTemplate: instance.deepLinkTemplate,
    requiresCredential: false,
    readinessNote:
      profile === "live"
        ? "A credential is configured. The Graph client is not implemented in this build and every operation refuses rather than serving simulator data under a live label."
        : "Sandbox ready. Reads the seeded institution through the Microsoft 365 simulator. No credential is required and none is stored.",
  });

  return {
    metadata,
    capabilities: () => MICROSOFT_GRAPH_CAPABILITIES,

    async health(context: ConnectorContext): Promise<ConnectorHealth> {
      return {
        state:
          profile === "live"
            ? "not-implemented"
            : instance.healthState === "unavailable"
              ? "unavailable"
              : "healthy",
        message: reason,
        checkedAt: context.clock.nowIso(),
        lastSuccessfulSyncAt: instance.lastSyncAt,
        /* A state, never a value. There is nothing here to leak. */
        secretStatus: instance.secretStatus,
      };
    },

    async read(
      objectType: string,
      externalId: string,
      context: ConnectorContext,
    ): Promise<ConnectorReadResult> {
      assertUsable(`read "${objectType}"`);
      const startedMs = context.clock.nowMs();
      const records = sandboxProjection(objectType)(context.runId).map((record) =>
        asGraphRecord(record, objectType),
      );
      return { record: findRecord(records, externalId), durationMs: context.clock.nowMs() - startedMs };
    },

    async search(
      query: string,
      options: { objectType: string; limit: number },
      context: ConnectorContext,
    ): Promise<ConnectorSearchResult> {
      assertUsable(`search "${options.objectType}"`);
      const startedMs = context.clock.nowMs();
      const all = sandboxProjection(options.objectType)(context.runId).map((record) =>
        asGraphRecord(record, options.objectType),
      );
      const records = filterRecords(all, query, options.limit);
      return {
        records,
        hasMore: records.length === options.limit && all.length > options.limit,
        durationMs: context.clock.nowMs() - startedMs,
      };
    },

    async sync(
      request: ConnectorSyncRequest,
      context: ConnectorContext,
    ): Promise<ConnectorSyncResult> {
      assertUsable(`sync "${request.objectType}"`);
      const startedMs = context.clock.nowMs();
      const all = sandboxProjection(request.objectType)(context.runId).map((record) =>
        asGraphRecord(record, request.objectType),
      );
      const { page, nextCursor, hasMore } = applyCursor(all, request.cursor, request.limit);
      return {
        records: page,
        cursor: nextCursor,
        hasMore,
        recordsSeen: all.length,
        durationMs: context.clock.nowMs() - startedMs,
      };
    },

    async execute(): Promise<ConnectorAcknowledgement> {
      /* No write capability in any profile. The runtime refuses first; this is
       * the second line, and it refuses in both profiles identically. */
      throw new ConnectorError(
        "capability-not-declared",
        "The Microsoft Graph adapter declares no write capability. Writing to a real mailbox or calendar is outside what this product does, and sending mail outside this machine is a refused action by design.",
        { connectorInstanceId: instance.id, detail: "graph writes are not offered" },
      );
    },

    async subscribe(context: ConnectorContext): Promise<ConnectorSubscription> {
      return {
        mechanism: profile === "live" ? "none" : "simulated",
        eventTypes: profile === "live" ? [] : MICROSOFT_GRAPH_CAPABILITIES.events,
        endpointLabel: metadata().endpointLabel,
        active: profile === "sandbox" && instance.healthState !== "unavailable",
        note:
          profile === "live"
            ? "A Graph change notification subscription would be created here. It is not implemented in this build."
            : `Sandbox deliveries only. Checked at ${context.clock.nowIso()}.`,
      };
    },
  };
}
