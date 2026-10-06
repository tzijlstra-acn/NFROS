/**
 * The GRC platform simulator.
 *
 * Stands in for the bank's governance, risk and compliance platform, which in
 * this synthetic institution is "SYS-0031 Arcadia RiskCore". It is the system
 * of record for risks, controls, assessments, findings, actions, suppliers and
 * services, and that designation is not decorative: the conflict policy on
 * these mappings is `source-of-record-wins`, so when the process intelligence
 * platform disagrees with a recorded control rating, the rating does not move
 * and the disagreement is flagged instead.
 *
 * This is the only simulator with a write capability, and it has exactly six:
 * an assessment, a control rating, a finding and an action, which the seeded
 * decisions produce, and a supplier and a service record, which the
 * third-party onboarding writes when a candidate is registered, approved and
 * handed over to monitoring. A capability with no caller is how a capability
 * list stops describing the product, so each one here has one.
 */

import type { ConnectorCapabilities, OutboundCommandEnvelope } from "@/integrations/core/Connector";
import { simulatedConnector } from "./base";
import {
  grcActions,
  grcAssessments,
  grcControls,
  grcIssues,
  grcRisks,
  serviceRecords,
  supplierRecords,
} from "./scenario-source";

export const GRC_SIMULATOR_KEY = "simulated.grc";
export const GRC_SYSTEM_KEY = "grc-simulator";

export const GRC_SIMULATOR_CAPABILITIES: ConnectorCapabilities = {
  read: [
    "grc.risk",
    "grc.control",
    "grc.assessment",
    "grc.finding",
    "grc.action",
    "grc.supplier",
    "grc.service",
  ],
  search: ["grc.control", "grc.assessment", "grc.finding", "grc.supplier"],
  events: ["grc.assessment.updated", "grc.finding.raised", "grc.control.rating.changed"],
  draft: ["grc.assessment", "grc.finding"],
  write: ["grc.assessment", "grc.control", "grc.finding", "grc.action", "grc.supplier", "grc.service"],
  attachments: true,
  deepLinks: true,
  deltaSync: true,
  webhooks: true,
};

/**
 * The plain language a write produces.
 *
 * Written per object type rather than generically, because "the record was
 * updated" is not a receipt line a risk professional can check. "RCSA
 * assessment version created in the GRC platform as GRC-000004" is.
 */
function statement(
  envelope: OutboundCommandEnvelope,
  externalId: string,
): { en: string; de: string } {
  switch (envelope.targetExternalType) {
    case "grc.assessment":
      return {
        en: `Assessment version created in the GRC platform as ${externalId}.`,
        de: `Bewertungsversion im GRC System als ${externalId} erstellt.`,
      };
    case "grc.control":
      return {
        en: `Control effectiveness updated in the GRC platform on ${externalId}.`,
        de: `Kontrollwirksamkeit im GRC System auf ${externalId} aktualisiert.`,
      };
    case "grc.finding":
      return {
        en: `Finding raised in the GRC platform as ${externalId}.`,
        de: `Feststellung im GRC System als ${externalId} erfasst.`,
      };
    case "grc.action":
      return {
        en: `Action created in the GRC platform as ${externalId}.`,
        de: `Massnahme im GRC System als ${externalId} erstellt.`,
      };
    case "grc.supplier":
      return {
        en: `Supplier record written to the GRC third-party register as ${externalId}.`,
        de: `Lieferantendatensatz im GRC Drittparteienregister als ${externalId} geschrieben.`,
      };
    case "grc.service":
      return {
        en: `Service record written to the GRC platform as ${externalId}.`,
        de: `Leistungsdatensatz im GRC System als ${externalId} geschrieben.`,
      };
    default:
      return {
        en: `${envelope.intentStatement} recorded in the GRC platform as ${externalId}.`,
        de: `${envelope.intentStatement} im GRC System als ${externalId} erfasst.`,
      };
  }
}

export const grcSimulatorFactory = simulatedConnector({
  key: GRC_SIMULATOR_KEY,
  packId: "grc-irm",
  displayName: "GRC platform simulator",
  sourceSystem: "GRC platform",
  vendorLabel: "Simulator for an integrated risk management platform",
  endpointLabel: "In process simulator over the seeded scenario",
  deepLinkTemplate: "https://riskcore.arcadia.example/record/{externalId}",
  readinessNote:
    "Simulated. Projects the seeded risks, controls, assessments, findings, actions, suppliers and services. No vendor adapter is implemented.",
  capabilities: GRC_SIMULATOR_CAPABILITIES,
  idPrefix: "GRC",
  systemKey: GRC_SYSTEM_KEY,
  projections: {
    "grc.risk": grcRisks,
    "grc.control": grcControls,
    "grc.assessment": grcAssessments,
    "grc.finding": grcIssues,
    "grc.action": grcActions,
    "grc.supplier": supplierRecords,
    "grc.service": serviceRecords,
  },
  statement,
  subscription: {
    mechanism: "simulated",
    eventTypes: GRC_SIMULATOR_CAPABILITIES.events,
    endpointLabel: "Simulated webhook at /api/integrations/webhook/simulated.grc",
    active: true,
    note: "Simulated deliveries only. No vendor webhook is registered and no signature is verified.",
  },
});
