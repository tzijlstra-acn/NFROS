/**
 * The planned adapter.
 *
 * One implementation serving every named vendor adapter on the roadmap:
 * ServiceNow IRM, RSA Archer, MetricStream, SAP GRC, Celonis, Entra ID, Azure
 * Data Lake, Databricks, Snowflake and Splunk. Each is a real instance row in
 * `planned` mode, so the integration centre shows the product roadmap, and
 * each refuses every operation with `connector-not-implemented`.
 *
 * This is the part of the integration layer that exists to stop the product
 * lying. The alternative, and it is the usual one, is a settings screen listing
 * ten vendor logos with a toggle next to each. A reviewer reads that as ten
 * integrations. Here, a planned instance carries the word "Planned", its
 * capability lists are empty, its health state is `not-implemented`, and
 * calling it produces a refusal rather than an empty result. An empty result
 * would be the dangerous outcome: it looks exactly like a working connector
 * with nothing to report.
 *
 * `plannedCapabilityNote` carries what the adapter is expected to cover when
 * it is built. It is written as an expectation, never as a capability, and the
 * capability arrays stay empty so the runtime refuses everything.
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
import { NO_CAPABILITIES } from "@/integrations/core/Connector";
import type { ConnectorContext } from "@/integrations/core/ConnectorContext";
import type { ConnectorPackId } from "@/db/schema/integration";
import { ConnectorError } from "@/integrations/core/errors";

/** A named adapter on the roadmap. */
export interface PlannedAdapterSpec {
  key: string;
  packId: ConnectorPackId;
  /** The vendor product, named plainly. No claim is attached to it. */
  vendorLabel: string;
  displayName: string;
  sourceSystem: string;
  /** What the adapter is expected to cover. An expectation, not a capability. */
  plannedCapabilityNote: string;
  /** What has to be true before it can be built. The honest blocker. */
  prerequisite: string;
}

/**
 * The named adapters a real engagement would scope.
 *
 * Chosen to be the realistic set for a DACH banking group: three integrated
 * risk management platforms, one ERP risk module, one process mining platform,
 * one identity provider, three data platforms and one observability platform.
 */
export const PLANNED_ADAPTERS: readonly PlannedAdapterSpec[] = [
  {
    key: "planned.servicenow-irm",
    packId: "grc-irm",
    vendorLabel: "ServiceNow Integrated Risk Management",
    displayName: "ServiceNow IRM",
    sourceSystem: "ServiceNow IRM",
    plannedCapabilityNote:
      "Expected to cover risk, control, assessment, issue and task objects, with write access to assessments and tasks.",
    prerequisite:
      "A sandbox instance, an OAuth client with scoped roles, and agreement on which tables are the system of record.",
  },
  {
    key: "planned.rsa-archer",
    packId: "grc-irm",
    vendorLabel: "Archer Integrated Risk Management",
    displayName: "RSA Archer",
    sourceSystem: "RSA Archer",
    plannedCapabilityNote:
      "Expected to cover applications, records and sub forms for risk and control, read first and write only after a field level mapping review.",
    prerequisite:
      "A per application field mapping, because Archer schemas are configured per client and no generic mapping is possible.",
  },
  {
    key: "planned.metricstream",
    packId: "grc-irm",
    vendorLabel: "MetricStream",
    displayName: "MetricStream",
    sourceSystem: "MetricStream",
    plannedCapabilityNote:
      "Expected to cover risk, control, issue and action objects through the platform API.",
    prerequisite: "API enablement on the client tenant and a named integration service account.",
  },
  {
    key: "planned.sap-grc",
    packId: "grc-irm",
    vendorLabel: "SAP Governance, Risk and Compliance",
    displayName: "SAP GRC",
    sourceSystem: "SAP GRC",
    plannedCapabilityNote:
      "Expected to cover process control and risk management objects, read only in the first release.",
    prerequisite:
      "A decision on the integration route, because the usable surface differs sharply between the on premise and cloud products.",
  },
  {
    key: "planned.celonis",
    packId: "process-intelligence",
    vendorLabel: "Celonis Process Intelligence",
    displayName: "Celonis",
    sourceSystem: "Celonis",
    plannedCapabilityNote:
      "Expected to cover process models, conformance deviations and case level detail, read only, with deviations delivered as events.",
    prerequisite:
      "An existing data model for the payment processes in scope. Without one there is nothing to read.",
  },
  {
    key: "planned.entra-id",
    packId: "identity-access",
    vendorLabel: "Microsoft Entra ID",
    displayName: "Entra ID",
    sourceSystem: "Entra ID",
    plannedCapabilityNote:
      "Expected to cover users, groups and role assignments, read only, to resolve ownership and legal entity from the directory rather than from seeded data.",
    prerequisite:
      "An application registration with directory read consent, and a decision on how group membership maps to the authority scopes.",
  },
  {
    key: "planned.azure-data-lake",
    packId: "data-platform",
    vendorLabel: "Azure Data Lake Storage",
    displayName: "Azure Data Lake",
    sourceSystem: "Azure Data Lake",
    plannedCapabilityNote:
      "Expected to cover indicator and loss datasets as scheduled reads, not as a live query path.",
    prerequisite: "A landing zone, a schema contract and a retention agreement for extracted data.",
  },
  {
    key: "planned.databricks",
    packId: "data-platform",
    vendorLabel: "Databricks",
    displayName: "Databricks",
    sourceSystem: "Databricks",
    plannedCapabilityNote:
      "Expected to cover indicator aggregates and model outputs through SQL warehouse reads.",
    prerequisite:
      "A warehouse, a service principal, and a view layer the product reads instead of raw tables.",
  },
  {
    key: "planned.snowflake",
    packId: "data-platform",
    vendorLabel: "Snowflake",
    displayName: "Snowflake",
    sourceSystem: "Snowflake",
    plannedCapabilityNote:
      "Expected to cover indicator and exposure datasets through a read only role on curated views.",
    prerequisite: "A curated schema and a role with read access limited to it.",
  },
  {
    key: "planned.splunk",
    packId: "service-management",
    vendorLabel: "Splunk",
    displayName: "Splunk",
    sourceSystem: "Splunk",
    plannedCapabilityNote:
      "Expected to cover operational alerts as inbound events, to detect a degradation before a person reports it.",
    prerequisite:
      "An agreed alert taxonomy. Without one, every alert arrives as an undifferentiated signal and the inbound pipeline cannot classify severity.",
  },
];

export function plannedAdapterFactory(spec: PlannedAdapterSpec) {
  return (instance: ConnectorInstanceView): Connector => {
    const refuse = (operation: string): ConnectorError =>
      new ConnectorError(
        "connector-not-implemented",
        `The ${spec.vendorLabel} adapter is planned and not built, so it cannot ${operation}. ${spec.plannedCapabilityNote} Prerequisite: ${spec.prerequisite}`,
        { connectorInstanceId: instance.id, detail: `planned adapter, ${operation} refused` },
      );

    const metadata = (): ConnectorMetadata => ({
      key: spec.key,
      packId: spec.packId,
      displayName: spec.displayName,
      sourceSystem: spec.sourceSystem,
      vendorLabel: spec.vendorLabel,
      mode: "planned",
      endpointLabel: "No endpoint. The adapter is not built.",
      deepLinkTemplate: null,
      requiresCredential: true,
      readinessNote: `Planned, not built. ${spec.plannedCapabilityNote} Prerequisite: ${spec.prerequisite}`,
    });

    return {
      metadata,
      /* Empty, so the runtime refuses every operation before reaching here. */
      capabilities: () => NO_CAPABILITIES satisfies ConnectorCapabilities,

      async health(context: ConnectorContext): Promise<ConnectorHealth> {
        return {
          state: "not-implemented",
          message: `Planned adapter. ${spec.plannedCapabilityNote}`,
          checkedAt: context.clock.nowIso(),
          lastSuccessfulSyncAt: null,
          secretStatus: "absent",
        };
      },

      async read(objectType: string): Promise<ConnectorReadResult> {
        throw refuse(`read "${objectType}"`);
      },

      async search(_query: string, options: { objectType: string }): Promise<ConnectorSearchResult> {
        throw refuse(`search "${options.objectType}"`);
      },

      async sync(): Promise<ConnectorSyncResult> {
        throw refuse("run a delta sync");
      },

      async execute(): Promise<ConnectorAcknowledgement> {
        throw refuse("execute an outbound command");
      },

      async subscribe(): Promise<ConnectorSubscription> {
        return {
          mechanism: "none",
          eventTypes: [],
          endpointLabel: "No endpoint. The adapter is not built.",
          active: false,
          note: spec.prerequisite,
        };
      },
    };
  };
}
