/**
 * Connects the layers that were built independently.
 *
 * Three layers deliberately do not import each other: the integration runtime
 * knows nothing about AI preparation, the AI preparation layer knows nothing
 * about connectors, and the live day knows nothing about either. That
 * separation is correct and it is why they could be built in parallel, but it
 * leaves two seams that something has to close, and this is that something.
 *
 * Seam one, the required source gate. The AI layer must not publish a final
 * recommendation while a required source is unavailable, and it defines a
 * narrow resolver interface for the answer. The integration runtime is the
 * thing that actually knows, through `checkRequiredSources`. This file hands
 * the second to the first.
 *
 * Seam two, inbound events. When a connector event arrives, the runtime
 * publishes a hook payload of identifiers. Automatic AI preparation should
 * start from it, subject to policy. The runtime cannot call the AI layer
 * without depending on it, so the subscription lives here.
 *
 * Idempotent and side effect ordered. Calling it twice does nothing the second
 * time, because a module that can be imported from eight routes and three
 * route handlers must not register eight hooks.
 */

import {
  defaultRequiredSourceResolver,
  onLiveEventArrived,
  setRequiredSourceResolver,
  type RequiredSourceQuery,
  type RequiredSourceStatus,
} from "@/agents/suggestions/generate";
import { checkRequiredSources } from "@/integrations/runtime/SyncCoordinator";
import { registerInboundHook } from "@/integrations/runtime/EventIngestion";
import { createLogger } from "@/server/logging/redact";
import { eventVisibleToRole } from "@/workday/contracts";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";

const log = createLogger("bootstrap");

let wired = false;

/**
 * Translates the integration answer into the AI layer's shape.
 *
 * The two describe the same thing with different words, which is what happens
 * when two layers are specified separately, and the translation is better here
 * than as a compromise in either of them.
 *
 * One judgment is encoded in the mapping and is worth stating. A STALE source
 * is not outstanding: the data arrived, it is just old. A stale source
 * constrains the output rather than blocking it, so it is reported through the
 * attributions, where the freshness is visible, and not through `outstanding`,
 * which holds the suggestion at `retrieving`. Blocking on staleness would stop
 * the product producing anything the moment a simulator went quiet.
 */
function integrationBackedResolver(query: RequiredSourceQuery): RequiredSourceStatus {
  try {
    const check = checkRequiredSources({
      runId: query.runId,
      contextType: query.contextType,
      contextId: query.contextId,
    });

    return {
      allRequiredAvailable: check.satisfied,
      outstanding: check.missing.map((missing) => ({
        connectorInstanceId: missing.connectorInstanceId,
        sourceSystem: missing.sourceSystem,
        objectType: missing.objectType,
        /*
         * A planned or unconfigured adapter has not failed, it has not been
         * built, so it reads as unknown rather than as an outage. A reader
         * seeing "failed" would reasonably go looking for an incident.
         */
        state:
          missing.mode === "planned" || missing.mode === "configured-unavailable"
            ? ("unknown" as const)
            : ("failed" as const),
        detail: missing.reason,
      })),
      attributions: check.attributions,
    };
  } catch (error) {
    /*
     * Fall back to the AI layer's own resolver rather than blocking.
     *
     * The rule is that a required source must not be MISSING. A fault in the
     * thing that answers the question is not evidence that a source is
     * missing, and treating it as such would stop the whole product on an
     * unrelated failure.
     */
    log.warn("The integration backed source resolver failed. Falling back.", { error });
    return defaultRequiredSourceResolver(query);
  }
}

/** Which roles an inbound event should start preparation for. */
function rolesForEvent(roleIds: RoleId[]): RoleId[] {
  // An empty list means every role, which is how the shared event reaches all
  // six functions from one record.
  return roleIds.length === 0
    ? [...ROLE_IDS]
    : ROLE_IDS.filter((roleId) => eventVisibleToRole({ roleIds }, roleId));
}

export function bootstrapServer(): void {
  if (wired) return;
  wired = true;

  setRequiredSourceResolver(integrationBackedResolver);

  registerInboundHook((payload) => {
    if (payload.liveEventId === null) return;

    /*
     * Policy first. The runtime has already decided whether preparation is
     * permitted for this object, and a hook that prepared anyway would be a
     * second policy decision disagreeing with the first.
     */
    if (!payload.aiPreparationAllowed) {
      log.info("Automatic preparation was not started.", {
        liveEventId: payload.liveEventId,
        reason: payload.aiPreparationBlockedReason,
      });
      return;
    }

    const eventId = payload.liveEventId;

    for (const roleId of rolesForEvent(payload.roleIds)) {
      /*
       * Fire and forget, with the rejection handled. Ingestion must not wait
       * for a model: the brief is explicit that event arrival is never blocked
       * on generation, and the suggestion appears when it is ready.
       *
       * Deduplication is the generation layer's job, not this one's. It keys
       * on a digest of the whole input state and holds a single flight map, so
       * two events touching the same object produce one run.
       */
      void onLiveEventArrived({
        roleId,
        eventId,
        objectType: payload.canonicalType,
        objectId: payload.canonicalId,
        runId: payload.runId,
      }).catch((error: unknown) => {
        log.warn("Automatic preparation failed after an inbound event.", {
          roleId,
          liveEventId: eventId,
          error,
        });
      });
    }
  });

  log.info("Server seams wired.", {
    requiredSourceResolver: "integration-backed",
    inboundHook: "automatic-preparation",
  });
}
