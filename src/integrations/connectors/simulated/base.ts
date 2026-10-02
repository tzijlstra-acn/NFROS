/**
 * The shared body of a simulated connector.
 *
 * All five simulators do the same four things: project a slice of the seeded
 * scenario under an external type, page it with a cursor, filter it for
 * search, and apply writes to the in process simulated system. Writing that
 * five times would guarantee that the fifth copy eventually disagreed with the
 * first about cursor semantics or about what an unavailable target does.
 *
 * What each connector file then holds is only what is genuinely specific: its
 * identity, its honest readiness note, which projections it offers, and the
 * plain language statement its writes produce. That last one matters, because
 * a receipt line reading "Assessment updated in the GRC platform" has to be
 * written by somebody who knows what a GRC platform calls that.
 *
 * Capabilities are declared here as a constant per connector and the
 * integration seed writes the same constant into `connector_instances`. One
 * source of truth, because the runtime gates on the row and the connector
 * reports the constant, and a drift between the two would make the capability
 * refusal untestable.
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
  OutboundCommandEnvelope,
} from "@/integrations/core/Connector";
import type { ConnectorContext } from "@/integrations/core/ConnectorContext";
import type { ConnectorPackId } from "@/db/schema/integration";
import { ConnectorError } from "@/integrations/core/errors";
import { applyExternalWrite, isSystemAvailable } from "./external-store";
import { applyCursor, filterRecords, findRecord } from "./scenario-source";

/** Everything that differs between one simulator and the next. */
export interface SimulatedConnectorSpec {
  key: string;
  packId: ConnectorPackId;
  displayName: string;
  sourceSystem: string;
  vendorLabel: string;
  endpointLabel: string;
  deepLinkTemplate: string | null;
  readinessNote: string;
  capabilities: ConnectorCapabilities;
  /** Prefix for identifiers the simulated system generates. */
  idPrefix: string;
  /** The simulated system this connector writes to. */
  systemKey: string;
  /** External type to projection. The keys are the readable object types. */
  projections: Record<string, (runId: string) => ExternalRecord[]>;
  /** The receipt line a successful write produces. */
  statement: (
    envelope: OutboundCommandEnvelope,
    externalId: string,
  ) => { en: string; de: string };
  subscription?: ConnectorSubscription;
}

/**
 * Builds a connector from a specification.
 *
 * Returned as a factory because the registry hands each instance its own row,
 * and a connector reads its mode, health and deep link template from that row
 * rather than from a module constant. Two instances of the same key can then
 * sit in different modes, which is what a per entity deployment looks like.
 */
export function simulatedConnector(spec: SimulatedConnectorSpec) {
  return (instance: ConnectorInstanceView): Connector => {
    const metadata = (): ConnectorMetadata => ({
      key: spec.key,
      packId: spec.packId,
      displayName: instance.displayName,
      sourceSystem: instance.sourceSystem,
      vendorLabel: spec.vendorLabel,
      mode: instance.mode,
      endpointLabel: instance.endpointLabel.length > 0 ? instance.endpointLabel : spec.endpointLabel,
      deepLinkTemplate: instance.deepLinkTemplate ?? spec.deepLinkTemplate,
      /* Simulated connectors require no credential. The complete local
       * experience must work with no key configured anywhere, which is why
       * this is false and `secretStatus` is "not-required". */
      requiresCredential: false,
      readinessNote: spec.readinessNote,
    });

    const projectionFor = (objectType: string): ((runId: string) => ExternalRecord[]) => {
      const projection = spec.projections[objectType];
      if (!projection) {
        throw new ConnectorError(
          "capability-not-declared",
          `${instance.displayName} has no projection for "${objectType}".`,
          { connectorInstanceId: instance.id, detail: `no projection for ${objectType}` },
        );
      }
      return projection;
    };

    const assertAvailable = (): void => {
      /*
       * Availability is read at call time from the simulated system rather
       * than from the instance row loaded at construction. The failure proof
       * switches a target off between two attempts of the same command, and a
       * connector holding a stale copy of its own health would keep
       * succeeding against a system that is down.
       */
      if (!isSystemAvailable(spec.systemKey) || instance.healthState === "unavailable") {
        throw new ConnectorError(
          "connector-unavailable",
          `${instance.displayName} is currently unavailable.`,
          { connectorInstanceId: instance.id, detail: `${spec.systemKey} unavailable` },
        );
      }
    };

    return {
      metadata,
      capabilities: () => spec.capabilities,

      async health(context: ConnectorContext): Promise<ConnectorHealth> {
        const available = isSystemAvailable(spec.systemKey) && instance.healthState !== "unavailable";
        return {
          state: available ? "healthy" : "unavailable",
          message: available
            ? `${instance.displayName} is responding. Simulated source projecting the seeded institution.`
            : `${instance.displayName} is not responding. Changes to it are queued, not lost.`,
          checkedAt: context.clock.nowIso(),
          lastSuccessfulSyncAt: instance.lastSyncAt,
          secretStatus: "not-required",
        };
      },

      async read(
        objectType: string,
        externalId: string,
        context: ConnectorContext,
      ): Promise<ConnectorReadResult> {
        assertAvailable();
        const startedMs = context.clock.nowMs();
        const record = findRecord(projectionFor(objectType)(context.runId), externalId);
        return { record, durationMs: context.clock.nowMs() - startedMs };
      },

      async search(
        query: string,
        options: { objectType: string; limit: number },
        context: ConnectorContext,
      ): Promise<ConnectorSearchResult> {
        assertAvailable();
        const startedMs = context.clock.nowMs();
        const all = projectionFor(options.objectType)(context.runId);
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
        assertAvailable();
        const startedMs = context.clock.nowMs();
        const all = projectionFor(request.objectType)(context.runId);
        const { page, nextCursor, hasMore } = applyCursor(all, request.cursor, request.limit);
        return {
          records: page,
          cursor: nextCursor,
          hasMore,
          recordsSeen: all.length,
          durationMs: context.clock.nowMs() - startedMs,
        };
      },

      async execute(
        envelope: OutboundCommandEnvelope,
        context: ConnectorContext,
      ): Promise<ConnectorAcknowledgement> {
        const startedMs = context.clock.nowMs();

        if (!spec.capabilities.write.includes(envelope.targetExternalType)) {
          /*
           * Unreachable through the runtime, which refuses an undeclared write
           * before the connector is called. Kept as a second line because a
           * future caller that bypassed the runtime would otherwise get a
           * silent write, and because a connector refusing an operation it
           * never declared is correct behaviour on its own terms.
           */
          throw new ConnectorError(
            "capability-not-declared",
            `${instance.displayName} does not write "${envelope.targetExternalType}".`,
            { connectorInstanceId: instance.id },
          );
        }

        const result = applyExternalWrite({
          systemKey: spec.systemKey,
          externalType: envelope.targetExternalType,
          targetExternalId: envelope.targetExternalId,
          idempotencyKey: envelope.idempotencyKey,
          commandKind: envelope.commandKind,
          payloadDigest: envelope.payloadFingerprint,
          expectedVersion: envelope.expectedVersion,
          now: context.clock.nowIso(),
          idPrefix: spec.idPrefix,
        });

        const statement = spec.statement(envelope, result.object.externalId);

        return {
          externalType: result.object.externalType,
          externalId: result.object.externalId,
          externalUrl: buildUrl(metadata().deepLinkTemplate, result.object.externalId),
          externalVersion: result.object.externalVersion,
          statement: statement.en,
          statementDe: statement.de,
          outcome: "acknowledged",
          notApplied: [],
          acknowledgedAt: context.clock.nowIso(),
          durationMs: context.clock.nowMs() - startedMs,
        };
      },

      ...(spec.subscription
        ? {
            async subscribe(context: ConnectorContext): Promise<ConnectorSubscription> {
              const subscription = spec.subscription as ConnectorSubscription;
              return {
                ...subscription,
                active: isSystemAvailable(spec.systemKey),
                note: `${subscription.note} Checked at ${context.clock.nowIso()}.`,
              };
            },
          }
        : {}),
    };
  };
}

function buildUrl(template: string | null, externalId: string): string | null {
  if (!template) return null;
  return template.replace("{externalId}", encodeURIComponent(externalId));
}
