"use server";

/**
 * Integration server actions.
 *
 * Four actions, and what they have in common is that none of them is a
 * privileged route. The retry action does not re-execute a decision or grant
 * an approval; it hands an existing command back to the dispatcher, which
 * calls `evaluateAuthority` exactly as it did the first time. The availability
 * action changes a connector's health, which is an operational state, not an
 * authority.
 *
 * Nothing here takes a credential, returns a credential or accepts an endpoint
 * from the browser. The one thing a client sends is an identifier, validated
 * against the connector instances that exist, so a crafted request cannot
 * point the runtime at an arbitrary host.
 *
 * Every action returns a result object rather than throwing. These run behind
 * buttons in an administrator screen and an unhandled rejection there shows the
 * user a framework error page instead of the sentence that tells them what
 * happened.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireScenarioState } from "@/scenario/engine/state";
import { createLogger } from "@/server/logging/redact";
import {
  requireConnectorInstance,
  listConnectorInstances,
} from "@/integrations/core/ConnectorRegistry";
import { setSystemAvailability } from "@/integrations/connectors/simulated";
import { simulatedEventFor } from "@/integrations/connectors/simulated/events";
import { ingestInboundEvent } from "@/integrations/runtime/EventIngestion";
import { retryCommand } from "@/integrations/runtime/CommandDispatcher";
import { runSync } from "@/integrations/runtime/SyncCoordinator";
import { getDb } from "@/db/client";
import { connectorInstances } from "@/db/schema/integration";
import { eq } from "drizzle-orm";
import { recordAuditEvent } from "@/server/security/audit";

const log = createLogger("integration-actions");

export interface IntegrationActionResult {
  ok: boolean;
  /** One sentence, shown to the administrator. */
  message: string;
  /** Step by step detail, for the expandable panel under the button. */
  detail: string[];
}

/**
 * Identifier validation.
 *
 * A bounded character set rather than a free string. The identifier reaches a
 * SQL comparison through Drizzle's parameter binding so injection is not the
 * exposure, but a validated shape means a malformed request fails here with a
 * clear message rather than three calls later with a null dereference.
 */
const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9._:-]+$/, "An identifier may contain letters, digits, dot, underscore, colon and hyphen only.");

function revalidateIntegrationSurfaces(): void {
  revalidatePath("/settings/integrations");
  revalidatePath("/settings/mappings");
  revalidatePath("/workday", "layout");
  revalidatePath("/control-room");
}

/** Confirms the identifier names a connector instance that exists. */
function resolveInstanceOrFail(raw: string) {
  const parsed = identifierSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      instance: null,
      failure: {
        ok: false,
        message: parsed.error.issues.map((issue) => issue.message).join(" "),
        detail: [],
      } satisfies IntegrationActionResult,
    };
  }
  const known = listConnectorInstances().some((instance) => instance.id === parsed.data);
  if (!known) {
    return {
      instance: null,
      failure: {
        ok: false,
        message: `There is no connector instance "${parsed.data}".`,
        detail: [],
      } satisfies IntegrationActionResult,
    };
  }
  return { instance: requireConnectorInstance(parsed.data), failure: null };
}

/* ==========================================================================
   Retry a command
   ========================================================================== */

/**
 * Retries one outbound command.
 *
 * The approval the human already granted covers this exact payload, so no
 * second approval is asked for. That is the correct behaviour and it is worth
 * saying why: a transport failure does not invalidate a professional
 * judgment, and asking the approver to confirm again would teach them that
 * their decision is provisional until the network cooperates.
 *
 * The command identifier and its idempotency key do not change, which is what
 * stops the retry creating a second external object.
 */
export async function actionRetryIntegrationCommand(
  commandId: string,
): Promise<IntegrationActionResult> {
  const parsed = identifierSchema.safeParse(commandId);
  if (!parsed.success) {
    return { ok: false, message: "That command identifier is not valid.", detail: [] };
  }

  try {
    const state = requireScenarioState();
    const result = await retryCommand(parsed.data, { autonomyLevel: state.autonomyLevel });
    revalidateIntegrationSurfaces();

    log.info("An integration command was retried by an operator.", {
      commandId: parsed.data,
      status: result.status,
      attempts: result.attempts,
    });

    return {
      ok: result.acknowledged,
      message: result.message,
      detail: result.steps.map((step) => `${step.step}. ${step.name}: ${step.detail}`),
    };
  } catch (error) {
    log.error("The retry action failed.", { commandId: parsed.data, error });
    return {
      ok: false,
      message: "The retry could not be started. The command and the decision behind it are unchanged.",
      detail: [],
    };
  }
}

/* ==========================================================================
   Set a connector unavailable or healthy
   ========================================================================== */

/**
 * Switches a connector instance between healthy and unavailable.
 *
 * It changes the instance row and, for a simulated connector, the in process
 * simulated system, because the connector asks the simulated system at call
 * time. Changing only the row would leave a connector reporting unavailable
 * while still answering reads, which would make the failure demonstration a
 * lie about itself.
 *
 * The mode moves to `configured-unavailable` and back, so the integration
 * centre groups the instance where an administrator would look for it. The
 * original mode is recovered from the connector key rather than remembered,
 * which avoids a second column holding a shadow copy of the mode.
 */
export async function actionSetConnectorAvailability(
  connectorInstanceId: string,
  available: boolean,
): Promise<IntegrationActionResult> {
  const { instance, failure } = resolveInstanceOrFail(connectorInstanceId);
  if (!instance) return failure;

  if (instance.mode === "planned") {
    return {
      ok: false,
      message: `${instance.displayName} is a planned adapter. There is nothing to make available.`,
      detail: [],
    };
  }

  const state = requireScenarioState();
  const simulated = instance.connectorKey.startsWith("simulated.") ||
    instance.connectorKey === "webhook.generic";

  if (simulated) setSystemAvailability(systemKeyFor(instance.connectorKey), available);

  const restoredMode = available ? modeForKey(instance.connectorKey) : "configured-unavailable";

  getDb()
    .update(connectorInstances)
    .set({
      healthState: available ? "healthy" : "unavailable",
      mode: restoredMode,
      healthMessage: available
        ? `${instance.displayName} is responding.`
        : `${instance.displayName} was set unavailable by an administrator. Approved changes to it are queued, not lost.`,
    })
    .where(eq(connectorInstances.id, instance.id))
    .run();

  recordAuditEvent({
    runId: state.runId,
    atMoment: state.currentMoment,
    category: "system",
    action: available ? "connectorRecovered" : "connectorSetUnavailable",
    objectKind: "connector-instance",
    objectId: instance.id,
    summary: available
      ? `${instance.displayName} was recovered by an administrator. Queued changes can be retried.`
      : `${instance.displayName} was set unavailable by an administrator. Approved decisions are preserved and their delivery is queued.`,
    actorKind: "human",
    roleId: state.activeRoleId,
    reversible: true,
    detail: { connectorInstanceId: instance.id, available },
  });

  revalidateIntegrationSurfaces();

  return {
    ok: true,
    message: available
      ? `${instance.displayName} is available again. Queued commands can be retried.`
      : `${instance.displayName} is now unavailable. Any approved change routed to it will be queued and then need a retry.`,
    detail: [],
  };
}

/** The simulated system a connector key writes to. */
function systemKeyFor(connectorKey: string): string {
  switch (connectorKey) {
    case "simulated.grc":
      return "grc-simulator";
    case "simulated.microsoft-365":
      return "microsoft-365-simulator";
    case "simulated.process-intelligence":
      return "process-intelligence-simulator";
    case "simulated.document-repository":
      return "document-repository-simulator";
    default:
      return connectorKey;
  }
}

/** The mode an instance returns to when it recovers. */
function modeForKey(
  connectorKey: string,
): "live" | "sandbox-ready" | "simulated" | "configured-unavailable" | "planned" {
  if (connectorKey.startsWith("simulated.") || connectorKey === "webhook.generic") return "simulated";
  if (connectorKey === "microsoft-graph") return "sandbox-ready";
  /*
   * The generic REST adapter recovers to `configured-unavailable` and not to
   * anything better, because recovering it does not give it an endpoint. An
   * administrator pressing recover on it is told as much by the mode staying
   * where it was.
   */
  return "configured-unavailable";
}

/* ==========================================================================
   Trigger a simulated inbound event
   ========================================================================== */

/**
 * Sends one simulated inbound event through the full ten step pipeline.
 *
 * Pressing it twice is the deduplication demonstration: the second delivery
 * carries the same event key, the unique index refuses it, and the result says
 * so rather than quietly creating a second live day beat.
 */
export async function actionTriggerSimulatedInboundEvent(
  connectorInstanceId: string,
): Promise<IntegrationActionResult> {
  const { instance, failure } = resolveInstanceOrFail(connectorInstanceId);
  if (!instance) return failure;

  const state = requireScenarioState();
  const event = simulatedEventFor({
    runId: state.runId,
    connectorInstanceId: instance.id,
    connectorKey: instance.connectorKey,
    atMoment: state.currentMoment,
  });

  if (!event) {
    return {
      ok: false,
      message: `${instance.displayName} has no simulated event defined. Only the process intelligence simulator and the generic webhook can be triggered by hand.`,
      detail: [],
    };
  }

  const result = ingestInboundEvent(event);
  revalidateIntegrationSurfaces();

  return {
    ok: result.status === "published",
    message:
      result.status === "deduplicated"
        ? `The delivery repeated an event key that already exists. One integration event remains and no second live day event was created.`
        : result.message,
    detail: result.steps.map((step) => `${step.step}. ${step.name}: ${step.detail}`),
  };
}

/* ==========================================================================
   Run a sync
   ========================================================================== */

/**
 * Runs a delta sync for one connector instance.
 *
 * When no object type is named, every type the connector declares is synced.
 * The capability check happens inside `runSync`, in the runtime, so asking for
 * a type the connector does not declare produces a refusal recorded against
 * the sync state rather than an exception here.
 */
export async function actionRunConnectorSync(
  connectorInstanceId: string,
  objectType?: string,
): Promise<IntegrationActionResult> {
  const { instance, failure } = resolveInstanceOrFail(connectorInstanceId);
  if (!instance) return failure;

  const state = requireScenarioState();
  const types = objectType ? [objectType] : instance.capabilities.read;

  if (types.length === 0) {
    return {
      ok: false,
      message: `${instance.displayName} declares no readable object types, so there is nothing to sync.`,
      detail: [],
    };
  }

  const detail: string[] = [];
  let mapped = 0;
  let failures = 0;

  for (const type of types) {
    const outcome = await runSync({
      runId: state.runId,
      connectorInstanceId: instance.id,
      objectType: type,
      atMoment: state.currentMoment,
    });
    mapped += outcome.recordsMapped;
    if (outcome.status !== "ok") failures += 1;
    detail.push(
      outcome.status === "ok"
        ? `${type}: ${outcome.recordsMapped} mapped, ${outcome.recordsChanged} changed, ${outcome.recordsConflicted} conflicted.`
        : `${type}: ${outcome.status}. ${outcome.error}`,
    );
  }

  revalidateIntegrationSurfaces();

  return {
    ok: failures === 0,
    message:
      failures === 0
        ? `${instance.displayName} synced ${mapped} record(s) across ${types.length} object type(s).`
        : `${instance.displayName} synced ${mapped} record(s). ${failures} object type(s) did not complete.`,
    detail,
  };
}
