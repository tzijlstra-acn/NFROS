/**
 * The process intelligence simulator.
 *
 * Stands in for a process mining platform. It returns the seeded processes and
 * the mined repair cases behind the payment control test, which is where the
 * control assurance story in this scenario actually comes from: a population
 * of overrides on the fallback route, some of them without an evidenced
 * secondary review.
 *
 * It is read only and event capable, and that combination is deliberate. A
 * process mining platform observes; it does not hold a record anyone would
 * write back to. Declaring an empty write array is how the connector says so,
 * and the runtime then refuses a write against it before the connector is
 * called. The unit test for capability refusal uses exactly this instance,
 * because a read only observer being asked to write is the realistic version
 * of that mistake.
 *
 * The deviation signal it raises is computed from the seeded cases rather than
 * stated, so the count on the live day event is the count a reviewer gets by
 * counting the rows.
 */

import type { ConnectorCapabilities, ExternalRecord } from "@/integrations/core/Connector";
import { simulatedConnector } from "./base";
import {
  externalRecord,
  processCases,
  processDeviationSignal,
  processRecords,
} from "./scenario-source";

export const PROCESS_INTELLIGENCE_KEY = "simulated.process-intelligence";
export const PROCESS_INTELLIGENCE_SYSTEM_KEY = "process-intelligence-simulator";

/** The inbound event type the proof script sends. */
export const PROCESS_DEVIATION_EVENT = "pi.process.deviation.detected";

export const PROCESS_INTELLIGENCE_CAPABILITIES: ConnectorCapabilities = {
  read: ["pi.process", "pi.case", "pi.signal"],
  search: ["pi.process", "pi.case"],
  events: [PROCESS_DEVIATION_EVENT, "pi.process.volume.changed"],
  draft: [],
  /* Empty on purpose. A mining platform is an observer, not a system of
   * record, and nothing in this product should be able to write to one. */
  write: [],
  attachments: false,
  deepLinks: true,
  deltaSync: true,
  webhooks: true,
};

/**
 * The derived deviation signals.
 *
 * Two signals, both computed from the seeded cases so they agree with the test
 * population exactly. The unevidenced secondary review comes first because it
 * is the one with signal in this scenario; the fallback route count is
 * reported honestly even though it is zero for the tested period, because
 * suppressing a zero would hide the fact that the question was asked.
 */
function processSignals(runId: string): ExternalRecord[] {
  const derived = processDeviationSignal(runId);
  if (!derived) return [];
  const subject = derived.processId.length > 0 ? derived.processId : derived.controlTestId;

  return [
    externalRecord({
      externalType: "pi.signal",
      externalId: `PI-SIG-UNREVIEWED-${derived.controlTestId}`,
      canonicalType: "Indicator",
      canonicalId: subject,
      title: "Payment repair cases with no evidenced secondary review",
      summary: `${derived.unreviewedCount} of ${derived.totalCases} mined repair cases carry no secondary review evidence.`,
      sourceUpdatedAt: null,
      externalVersion: String(derived.unreviewedCount),
      fields: {
        metric: "unreviewed-repair-cases",
        value: derived.unreviewedCount,
        population: derived.totalCases,
        controlTestId: derived.controlTestId,
        processId: derived.processId,
      },
    }),
    externalRecord({
      externalType: "pi.signal",
      externalId: `PI-SIG-FALLBACK-${derived.controlTestId}`,
      canonicalType: "Indicator",
      canonicalId: subject,
      title: "Payment repair cases routed through the fallback",
      summary: `${derived.fallbackCount} of ${derived.totalCases} mined repair cases in the tested period took the fallback route.`,
      sourceUpdatedAt: null,
      externalVersion: String(derived.fallbackCount),
      fields: {
        metric: "fallback-route-cases",
        value: derived.fallbackCount,
        population: derived.totalCases,
        controlTestId: derived.controlTestId,
        processId: derived.processId,
      },
    }),
  ];
}

export const processIntelligenceFactory = simulatedConnector({
  key: PROCESS_INTELLIGENCE_KEY,
  packId: "process-intelligence",
  displayName: "Process intelligence simulator",
  sourceSystem: "Process intelligence",
  vendorLabel: "Simulator for a process mining platform",
  endpointLabel: "In process simulator over the seeded process and case data",
  deepLinkTemplate: "https://processmining.arcadia.example/view/{externalId}",
  readinessNote:
    "Simulated. Projects the seeded processes and the mined payment repair cases behind the control test. Read only by design. No vendor adapter is implemented.",
  capabilities: PROCESS_INTELLIGENCE_CAPABILITIES,
  idPrefix: "PI",
  systemKey: PROCESS_INTELLIGENCE_SYSTEM_KEY,
  projections: {
    "pi.process": processRecords,
    "pi.case": (runId: string) => processCases(runId),
    "pi.signal": processSignals,
  },
  statement: (envelope, externalId) => ({
    /* Unreachable: the write array is empty, so the runtime refuses first.
     * Present because the specification requires a statement and an honest
     * one here says what would be true if this ever changed. */
    en: `${envelope.intentStatement} recorded in the process intelligence platform as ${externalId}.`,
    de: `${envelope.intentStatement} in der Prozessanalyse als ${externalId} erfasst.`,
  }),
  subscription: {
    mechanism: "simulated",
    eventTypes: PROCESS_INTELLIGENCE_CAPABILITIES.events,
    endpointLabel: "Simulated webhook at /api/integrations/webhook/simulated.process-intelligence",
    active: true,
    note: "Simulated deliveries only. No vendor webhook is registered and no signature is verified.",
  },
});

/** Re-exported so the proof script and the seed read the same derived numbers. */
export { processDeviationSignal };
