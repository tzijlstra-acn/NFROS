/**
 * The inbound webhook endpoint.
 *
 * One route, one method, and a deliberately small surface. A delivery names a
 * connector in the path, carries an event in the body, and the handler runs the
 * ten step inbound pipeline against it.
 *
 * What this endpoint does NOT do is the part that matters for an honest
 * reading. It does not verify a signature. Signature verification needs a
 * shared secret per connector, and this build stores no credential of any
 * kind: the schema deliberately holds only a `secretStatus` state. So instead
 * of a weak check that would imply a strong one, there is none, and the gap is
 * recorded as the first item in docs/PRODUCTIZATION_GAPS.md. What the endpoint
 * does enforce is structural: the connector must exist, must not be a planned
 * adapter, must declare the event type, and must have a webhook or simulated
 * subscription. A delivery failing any of those is rejected and the rejection
 * is recorded.
 *
 * The response status says what happened. 202 for a new event, 200 for a
 * duplicate, because a duplicate is a success from the sender's point of view
 * and answering 4xx would make a well behaved sender retry forever.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { CANONICAL_TYPES } from "@/workday/contracts";
import { LIVE_EVENT_SEVERITIES, LIVE_EVENT_TYPES } from "@/db/schema/live";
import { ROLE_IDS } from "@/db/schema/core";
import { requireScenarioState } from "@/scenario/engine/state";
import { createLogger } from "@/server/logging/redact";
import {
  getConnectorInstance,
  listConnectorInstances,
} from "@/integrations/core/ConnectorRegistry";
import { ingestInboundEvent } from "@/integrations/runtime/EventIngestion";
import { bootstrapServer } from "@/server/bootstrap";

const log = createLogger("integration-webhook");

/**
 * The delivery body.
 *
 * Strict in two places on purpose. `fields` is a flat record of primitives,
 * because a nested payload would let a sender push an arbitrary object graph
 * into a JSON column the mappings screen then has to render. And `eventKey` is
 * required rather than derived: the sender owns the identity of its own event,
 * and a key the handler invented from the body would change whenever the body
 * changed, which would defeat deduplication exactly when it is needed.
 */
const deliverySchema = z.object({
  eventKey: z.string().min(1).max(200),
  eventType: z.string().min(1).max(120),
  externalEventId: z.string().max(200).nullish(),
  atMoment: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "atMoment must be a 24 hour time label such as 14:05.")
    .optional(),
  severity: z.enum(LIVE_EVENT_SEVERITIES).optional(),
  liveEventType: z.enum(LIVE_EVENT_TYPES).optional(),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(600),
  roleIds: z.array(z.enum(ROLE_IDS)).max(6).optional(),
  requiresDecision: z.boolean().optional(),
  record: z.object({
    externalType: z.string().min(1).max(120),
    externalId: z.string().min(1).max(200),
    externalVersion: z.string().max(200).nullish(),
    sourceUpdatedAt: z.string().max(40).nullish(),
    canonicalType: z.enum(CANONICAL_TYPES),
    canonicalId: z.string().min(1).max(200),
    fields: z
      .record(z.string().max(80), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]))
      .default({}),
  }),
});

/**
 * Resolves the path segment to a connector instance.
 *
 * Accepts either an instance identifier or a connector key, because a sender
 * configured against a family is the realistic case and requiring the instance
 * identifier would mean reconfiguring every sender when an instance is
 * recreated. A key matching more than one instance is refused rather than
 * guessed: delivering an event to an arbitrary one of two GRC instances would
 * attribute it to the wrong legal entity.
 */
function resolveTarget(segment: string):
  | { instanceId: string; failure: null }
  | { instanceId: null; failure: { status: number; body: Record<string, unknown> } } {
  const direct = getConnectorInstance(segment);
  if (direct) return { instanceId: direct.id, failure: null };

  const byKey = listConnectorInstances().filter((instance) => instance.connectorKey === segment);
  if (byKey.length === 1 && byKey[0]) return { instanceId: byKey[0].id, failure: null };

  if (byKey.length > 1) {
    return {
      instanceId: null,
      failure: {
        status: 409,
        body: {
          status: "rejected",
          reason: `The connector key "${segment}" names ${byKey.length} instances. Address the instance identifier instead.`,
          instanceIds: byKey.map((instance) => instance.id),
        },
      },
    };
  }

  return {
    instanceId: null,
    failure: {
      status: 404,
      body: {
        status: "rejected",
        reason: `No connector instance or connector key matches "${segment}".`,
      },
    },
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ connector: string }> },
): Promise<NextResponse> {
  bootstrapServer();
  const { connector } = await context.params;

  const target = resolveTarget(connector);
  if (target.instanceId === null) {
    log.warn("A webhook delivery named an unknown connector.", { connector });
    return NextResponse.json(target.failure.body, { status: target.failure.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "rejected", reason: "The request body is not valid JSON." },
      { status: 400 },
    );
  }

  const parsed = deliverySchema.safeParse(body);
  if (!parsed.success) {
    /*
     * The validation issues are returned but the body is not echoed. An error
     * response that quoted the payload back would put inbound content into a
     * log and into whatever the sender does with the response.
     */
    return NextResponse.json(
      {
        status: "rejected",
        reason: "The delivery did not match the expected shape.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 422 },
    );
  }

  let runId: string;
  let currentMoment: string;
  try {
    const state = requireScenarioState();
    runId = state.runId;
    currentMoment = state.currentMoment;
  } catch {
    return NextResponse.json(
      {
        status: "rejected",
        reason: "The scenario has not been seeded, so there is no run to attach the event to.",
      },
      { status: 503 },
    );
  }

  const delivery = parsed.data;

  const result = ingestInboundEvent({
    runId,
    connectorInstanceId: target.instanceId,
    eventKey: delivery.eventKey,
    externalEventId: delivery.externalEventId ?? null,
    eventType: delivery.eventType,
    atMoment: delivery.atMoment ?? currentMoment,
    ...(delivery.severity ? { severity: delivery.severity } : {}),
    ...(delivery.liveEventType ? { liveEventType: delivery.liveEventType } : {}),
    title: delivery.title,
    summary: delivery.summary,
    roleIds: delivery.roleIds ?? [],
    requiresDecision: delivery.requiresDecision ?? false,
    record: {
      externalType: delivery.record.externalType,
      externalId: delivery.record.externalId,
      externalUrl: null,
      externalVersion: delivery.record.externalVersion ?? null,
      sourceUpdatedAt: delivery.record.sourceUpdatedAt ?? null,
      canonicalType: delivery.record.canonicalType,
      canonicalId: delivery.record.canonicalId,
      title: delivery.title,
      summary: delivery.summary,
      fields: delivery.record.fields,
    },
  });

  /* The event key is logged, never the payload. */
  log.info("A webhook delivery was processed.", {
    connectorInstanceId: target.instanceId,
    eventKey: delivery.eventKey,
    status: result.status,
  });

  const status =
    result.status === "published"
      ? 202
      : result.status === "deduplicated"
        ? 200
        : result.status === "rejected"
          ? 422
          : 500;

  return NextResponse.json(
    {
      status: result.status,
      integrationEventId: result.integrationEventId,
      liveEventId: result.liveEventId,
      canonicalType: result.canonicalType,
      canonicalId: result.canonicalId,
      deduplicated: result.deduplicated,
      evidenceIds: result.evidenceIds,
      aiPreparationRequested: result.aiPreparationRequested,
      message: result.message,
      steps: result.steps,
    },
    { status },
  );
}

/**
 * A readiness probe.
 *
 * Returns the subscription shape the endpoint expects for one connector, so a
 * sender can be configured without reading this file. It returns no credential
 * state, no endpoint and no instance internals beyond the declared event types.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ connector: string }> },
): Promise<NextResponse> {
  const { connector } = await context.params;
  const target = resolveTarget(connector);
  if (target.instanceId === null) {
    return NextResponse.json(target.failure.body, { status: target.failure.status });
  }

  const instance = getConnectorInstance(target.instanceId);
  if (!instance) {
    return NextResponse.json({ status: "rejected", reason: "Unknown instance." }, { status: 404 });
  }

  return NextResponse.json({
    connectorInstanceId: instance.id,
    displayName: instance.displayName,
    mode: instance.mode,
    acceptsDeliveries:
      instance.mode !== "planned" &&
      instance.capabilities.webhooks &&
      instance.eventSubscriptionStatus !== "none",
    declaredEventTypes: instance.capabilities.events,
    deduplicationKey: "connectorInstanceId plus eventKey, enforced by a unique index",
    signatureVerification:
      "Not implemented in this build. No credential is stored, so no shared secret exists to verify against.",
  });
}
