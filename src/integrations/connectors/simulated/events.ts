/**
 * Simulated inbound events.
 *
 * The events a simulated source would actually send, built from the seeded
 * scenario so that the numbers in the live day beat match the rows a reviewer
 * can count. The process intelligence deviation is the one the proof script
 * uses and the one the integration centre can trigger by hand.
 *
 * Two details are load bearing.
 *
 * `eventKey` is derived from the source identity and nothing else: no
 * timestamp, no counter, no random component. That is what makes the second
 * delivery of the same signal a duplicate rather than a new event, and
 * deduplication is the behaviour the inbound pipeline has to demonstrate.
 * A key containing the clock would make every replay look novel, which is the
 * exact bug the unique index exists to catch.
 *
 * The roles the event reaches are the roles whose work the signal actually
 * touches. The payment repair deviation reaches the Operational Risk Partner
 * and Control Assurance, because it is their control and their test
 * population. Sending it to all six would be easier and would make the role
 * switch meaningless.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { controls } from "@/db/schema/domain";
import { controlTests } from "@/db/schema/practice";
import type { RoleId } from "@/db/schema/core";
import type { InboundEventInput } from "@/integrations/runtime/EventIngestion";
import { externalRecord, processDeviationSignal } from "./scenario-source";
import { PROCESS_DEVIATION_EVENT } from "./process-intelligence";
import { GENERIC_WEBHOOK_EVENTS } from "../webhook";

/**
 * The process intelligence deviation event.
 *
 * Returns null when the scenario holds no mined cases, rather than inventing
 * a population. A simulator with nothing to report must say nothing.
 */
export function processDeviationEvent(params: {
  runId: string;
  connectorInstanceId: string;
  atMoment: string;
}): InboundEventInput | null {
  const derived = processDeviationSignal(params.runId);
  if (!derived) return null;

  const test = getDb()
    .select()
    .from(controlTests)
    .where(eq(controlTests.id, derived.controlTestId))
    .get();

  const control = test
    ? getDb().select().from(controls).where(eq(controls.id, test.controlId)).get()
    : undefined;

  const subjectId = control?.id ?? derived.processId ?? derived.controlTestId;
  const subjectLabel = control ? `${control.reference} ${control.title}` : "Payment repair control";

  return {
    runId: params.runId,
    connectorInstanceId: params.connectorInstanceId,
    /* Source identity only. The same signal always produces the same key. */
    eventKey: `pi.deviation:${derived.controlTestId}:unevidenced-secondary-review`,
    externalEventId: `PI-EVT-${derived.controlTestId}`,
    eventType: PROCESS_DEVIATION_EVENT,
    atMoment: params.atMoment,
    severity: "high",
    title: "Process intelligence flagged a control deviation",
    titleDe: "Prozessanalyse hat eine Kontrollabweichung gemeldet",
    summary: `${derived.unreviewedCount} of ${derived.totalCases} mined payment repair cases carry no evidenced secondary review. The deviation concerns ${subjectLabel}.`,
    summaryDe: `${derived.unreviewedCount} von ${derived.totalCases} erfassten Zahlungsreparaturfaellen tragen keinen nachgewiesenen Zweitpruefungsnachweis. Die Abweichung betrifft ${subjectLabel}.`,
    /*
     * A distinct external type, not the `pi.signal` the sync path uses.
     *
     * A signal read during a sync is an Indicator and belongs under the
     * process; a deviation event is an assertion about a Control and belongs
     * under the control. The mapper takes the canonical type from the mapping
     * row rather than from the connector, so two external types are the only
     * way to say both things. Collapsing them put the deviation on an
     * Indicator and the control's source row never learned that process
     * intelligence had anything to say about it.
     */
    record: externalRecord({
      externalType: "pi.deviation",
      externalId: `PI-DEV-${derived.controlTestId}`,
      canonicalType: "Control",
      canonicalId: subjectId,
      title: subjectLabel,
      summary: `Unreviewed repair cases ${derived.unreviewedCount}, fallback route cases ${derived.fallbackCount}, population ${derived.totalCases}.`,
      sourceUpdatedAt: null,
      externalVersion: `${derived.unreviewedCount}:${derived.fallbackCount}`,
      fields: {
        metric: "unreviewed-repair-cases",
        value: derived.unreviewedCount,
        fallbackRouteCases: derived.fallbackCount,
        population: derived.totalCases,
        controlTestId: derived.controlTestId,
        processId: derived.processId,
      },
    }),
    roleIds: ["rcsa", "control-assurance"] satisfies RoleId[],
    requiresDecision: true,
    autoPause: true,
    liveEventType: "decision-required",
  };
}

/**
 * A generic webhook delivery.
 *
 * Used to demonstrate the endpoint without a named adapter. It carries an
 * `ExternalRecord` canonical type deliberately: an arbitrary inbound record
 * from an unnamed system has no business claiming to be a Control, and the
 * mapping's `escalate-to-human` conflict policy reflects the same caution.
 */
export function genericWebhookEvent(params: {
  runId: string;
  connectorInstanceId: string;
  atMoment: string;
  externalId: string;
  label: string;
  detail: string;
}): InboundEventInput {
  const eventType = GENERIC_WEBHOOK_EVENTS[1];
  return {
    runId: params.runId,
    connectorInstanceId: params.connectorInstanceId,
    eventKey: `webhook:${params.externalId}`,
    externalEventId: params.externalId,
    eventType,
    atMoment: params.atMoment,
    severity: "informational",
    title: params.label,
    titleDe: params.label,
    summary: params.detail,
    summaryDe: params.detail,
    record: externalRecord({
      externalType: "webhook.record",
      externalId: params.externalId,
      canonicalType: "ExternalRecord",
      canonicalId: params.externalId,
      title: params.label,
      summary: params.detail,
      sourceUpdatedAt: null,
      fields: { label: params.label, detail: params.detail },
    }),
    roleIds: [],
    requiresDecision: false,
    liveEventType: "signal",
  };
}

/**
 * The event a connector instance can be asked to simulate by hand.
 *
 * Returns null for a connector with no realistic event to send, which is
 * better than returning a generic one: a document repository that suddenly
 * emitted a payment deviation would make the integration centre a worse guide
 * to what each source does.
 */
export function simulatedEventFor(params: {
  runId: string;
  connectorInstanceId: string;
  connectorKey: string;
  atMoment: string;
}): InboundEventInput | null {
  if (params.connectorKey === "simulated.process-intelligence") {
    return processDeviationEvent({
      runId: params.runId,
      connectorInstanceId: params.connectorInstanceId,
      atMoment: params.atMoment,
    });
  }

  if (params.connectorKey === "webhook.generic") {
    return genericWebhookEvent({
      runId: params.runId,
      connectorInstanceId: params.connectorInstanceId,
      atMoment: params.atMoment,
      externalId: `WH-${params.atMoment.replace(":", "")}`,
      label: "Inbound record from an unnamed internal system",
      detail:
        "A record arrived through the generic webhook. It is held as an external record rather than mapped onto a risk object, because an unnamed source cannot claim an object type.",
    });
  }

  return null;
}
