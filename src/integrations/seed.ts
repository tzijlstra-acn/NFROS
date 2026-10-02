/**
 * The integration seed.
 *
 * Writes the ten connector packs, the connector instances in all five modes,
 * the source mappings with their conflict policies, the sync state with per
 * source staleness thresholds, and the source requirements that tell the AI
 * layer which sources a decision cannot be completed without.
 *
 * Two things about how it is written.
 *
 * Capabilities are not restated here. Each instance takes the capability
 * constant its connector module exports, so the row the runtime gates on and
 * the set the connector reports are the same object. Restating them would
 * produce a seed that slowly disagreed with the implementation, and the
 * disagreement would show up as a capability refusal for an operation the
 * connector in fact supports, which is close to impossible to diagnose from
 * the interface.
 *
 * The function clears its own tables for the run first. It has to: the main
 * seed's own clear list does not include the integration tables, and a reseed
 * that accumulated instances would show the same connector four times after
 * four resets.
 */

import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  connectorInstances,
  connectorPacks,
  connectorSyncState,
  sourceMappings,
  sourceRequirements,
  type ConnectorPackId,
} from "@/db/schema/integration";
import { decisions } from "@/db/schema/decisions";
import type { ConnectorCapabilities } from "@/integrations/core/Connector";
import { NO_CAPABILITIES } from "@/integrations/core/Connector";
import {
  DOCUMENT_REPOSITORY_CAPABILITIES,
  DOCUMENT_REPOSITORY_KEY,
  GRC_SIMULATOR_CAPABILITIES,
  GRC_SIMULATOR_KEY,
  MICROSOFT_365_CAPABILITIES,
  MICROSOFT_365_KEY,
  PROCESS_INTELLIGENCE_CAPABILITIES,
  PROCESS_INTELLIGENCE_KEY,
} from "@/integrations/connectors/simulated";
import { GENERIC_WEBHOOK_CAPABILITIES, GENERIC_WEBHOOK_KEY } from "@/integrations/connectors/webhook";
import {
  GENERIC_REST_CAPABILITIES,
  GENERIC_REST_KEY,
  PLANNED_ADAPTERS,
} from "@/integrations/connectors/generic-rest";
import {
  MICROSOFT_GRAPH_CAPABILITIES,
  MICROSOFT_GRAPH_KEY,
} from "@/integrations/connectors/microsoft-graph";

/* ==========================================================================
   Stable instance identifiers
   ========================================================================== */

export const CI_MICROSOFT_365 = "CI-M365-SIM";
export const CI_GRC = "CI-GRC-SIM";
export const CI_PROCESS_INTELLIGENCE = "CI-PI-SIM";
export const CI_DOCUMENT_REPOSITORY = "CI-DMS-SIM";
export const CI_WEBHOOK = "CI-WEBHOOK-GENERIC";
export const CI_MICROSOFT_GRAPH = "CI-MSGRAPH";
export const CI_GENERIC_REST = "CI-REST-GENERIC";

/** The GRC platform is the designated system of record for risk objects. */
export const SYSTEM_OF_RECORD_INSTANCE_ID = CI_GRC;

export interface IntegrationSeedSummary {
  rowsWritten: number;
  counts: Record<string, number>;
  /**
   * Judgment kinds the requirement map does not cover.
   *
   * Reported rather than ignored. A decision with no required sources lets the
   * AI layer publish a final recommendation without a source check, and an
   * empty requirement list looks exactly like a deliberate one, so the seed
   * names the gap and `scripts/seed-integrations.ts` prints it.
   */
  uncoveredJudgmentKinds: string[];
}

/* ==========================================================================
   Packs
   ========================================================================== */

/**
 * The ten connector families.
 *
 * `namedAdapters` is documentation, not a claim. The integration centre shows
 * these as the family's scope and the mode on each instance is what says
 * whether anything is built.
 */
const packs: Array<{
  id: ConnectorPackId;
  family: string;
  name: string;
  description: string;
  namedAdapters: string[];
}> = [
  {
    id: "microsoft-365",
    family: "Collaboration",
    name: "Microsoft 365 and collaboration",
    description:
      "Mail, calendar, meetings, chat and the people directory. The personal work layer reads from this family.",
    namedAdapters: ["Microsoft Graph", "Exchange Online", "Microsoft Teams", "SharePoint Online"],
  },
  {
    id: "grc-irm",
    family: "Risk and control",
    name: "GRC and integrated risk management",
    description:
      "Risks, controls, assessments, findings and actions. The system of record for the risk and control inventory.",
    namedAdapters: [
      "ServiceNow Integrated Risk Management",
      "Archer Integrated Risk Management",
      "MetricStream",
      "SAP Governance, Risk and Compliance",
    ],
  },
  {
    id: "service-management",
    family: "Operations",
    name: "Service management and observability",
    description:
      "Incidents, changes, problems and operational alerts. The source of a degradation signal before a person reports one.",
    namedAdapters: ["ServiceNow ITSM", "Jira Service Management", "Splunk", "PagerDuty"],
  },
  {
    id: "process-intelligence",
    family: "Process",
    name: "Process intelligence and mining",
    description:
      "Process models, conformance deviations and case level detail. The source of evidence that a control is bypassed in practice.",
    namedAdapters: ["Celonis Process Intelligence", "Signavio", "UiPath Process Mining"],
  },
  {
    id: "document-knowledge",
    family: "Evidence",
    name: "Document and knowledge repositories",
    description:
      "Policies, reports, attestations, contracts and minutes. The evidence corpus a citation has to resolve against.",
    namedAdapters: ["SharePoint Online", "Documentum", "OpenText", "Confluence"],
  },
  {
    id: "procurement-third-party",
    family: "Third party",
    name: "Procurement and third party management",
    description:
      "Suppliers, contracts, obligations, questionnaires and subprocessor registers.",
    namedAdapters: ["SAP Ariba", "Coupa", "Process Unity", "Prevalent"],
  },
  {
    id: "data-platform",
    family: "Data",
    name: "Data platform and warehouse",
    description:
      "Indicator histories, loss data and exposure datasets, read on a schedule rather than queried live.",
    namedAdapters: ["Azure Data Lake Storage", "Databricks", "Snowflake", "Google BigQuery"],
  },
  {
    id: "identity-access",
    family: "Identity",
    name: "Identity and access",
    description:
      "Users, groups, role assignments and entitlement data. Where ownership and legal entity come from in a real deployment.",
    namedAdapters: ["Microsoft Entra ID", "Okta", "SailPoint", "One Identity"],
  },
  {
    id: "regulatory-content",
    family: "Regulatory",
    name: "Regulatory content and horizon scanning",
    description:
      "Publications, consultations and obligation libraries. Jurisdiction aware: German and Austrian EU requirements and Swiss requirements are different sets.",
    namedAdapters: ["Thomson Reuters Regulatory Intelligence", "Wolters Kluwer", "CUBE"],
  },
  {
    id: "generic-rest-webhook",
    family: "Generic",
    name: "Generic REST and webhook",
    description:
      "The route for any internal system without a named adapter. Inbound by webhook, outbound by REST.",
    namedAdapters: ["Generic REST endpoint", "Generic inbound webhook"],
  },
];

/* ==========================================================================
   Instances
   ========================================================================== */

interface InstanceSeed {
  id: string;
  packId: ConnectorPackId;
  connectorKey: string;
  displayName: string;
  sourceSystem: string;
  mode: "live" | "sandbox-ready" | "simulated" | "configured-unavailable" | "planned";
  healthState: "healthy" | "degraded" | "unavailable" | "unconfigured" | "not-implemented";
  healthMessage: string;
  capabilities: ConnectorCapabilities;
  endpointLabel: string;
  secretStatus: "not-required" | "absent" | "present" | "invalid";
  writeEnabled: boolean;
  eventSubscriptionStatus: "none" | "webhook" | "delta-sync" | "polling" | "simulated";
  deepLinkTemplate: string | null;
  requiredByPacks: string[];
}

function instanceSeeds(): InstanceSeed[] {
  const seeds: InstanceSeed[] = [
    /* ---- The five simulated instances the brief names ---- */
    {
      id: CI_MICROSOFT_365,
      packId: "microsoft-365",
      connectorKey: MICROSOFT_365_KEY,
      displayName: "Microsoft 365 simulator",
      sourceSystem: "Microsoft 365",
      mode: "simulated",
      healthState: "healthy",
      healthMessage:
        "Simulated source over the seeded mail, calendar, meetings and collaboration messages. No credential is required.",
      capabilities: MICROSOFT_365_CAPABILITIES,
      endpointLabel: "In process simulator",
      secretStatus: "not-required",
      writeEnabled: true,
      eventSubscriptionStatus: "simulated",
      deepLinkTemplate: "https://workspace.arcadia.example/item/{externalId}",
      requiredByPacks: ["organise"],
    },
    {
      id: CI_GRC,
      packId: "grc-irm",
      connectorKey: GRC_SIMULATOR_KEY,
      displayName: "GRC platform simulator",
      sourceSystem: "GRC platform",
      mode: "simulated",
      healthState: "healthy",
      healthMessage:
        "Simulated source over the seeded risks, controls, assessments, findings and actions. Designated system of record for risk objects.",
      capabilities: GRC_SIMULATOR_CAPABILITIES,
      endpointLabel: "In process simulator",
      secretStatus: "not-required",
      writeEnabled: true,
      eventSubscriptionStatus: "simulated",
      deepLinkTemplate: "https://riskcore.arcadia.example/record/{externalId}",
      requiredByPacks: ["rcsa", "control-assurance", "tprm", "nfr-governance"],
    },
    {
      id: CI_PROCESS_INTELLIGENCE,
      packId: "process-intelligence",
      connectorKey: PROCESS_INTELLIGENCE_KEY,
      displayName: "Process intelligence simulator",
      sourceSystem: "Process intelligence",
      mode: "simulated",
      healthState: "healthy",
      healthMessage:
        "Simulated source over the seeded processes and the mined payment repair cases. Read only by design.",
      capabilities: PROCESS_INTELLIGENCE_CAPABILITIES,
      endpointLabel: "In process simulator",
      secretStatus: "not-required",
      /* False, and not a configuration choice: the capability list is empty. */
      writeEnabled: false,
      eventSubscriptionStatus: "simulated",
      deepLinkTemplate: "https://processmining.arcadia.example/view/{externalId}",
      requiredByPacks: ["rcsa", "control-assurance"],
    },
    {
      id: CI_DOCUMENT_REPOSITORY,
      packId: "document-knowledge",
      connectorKey: DOCUMENT_REPOSITORY_KEY,
      displayName: "Document repository simulator",
      sourceSystem: "Document repository",
      mode: "simulated",
      healthState: "healthy",
      healthMessage:
        "Simulated source over the seeded evidence corpus, including the documents marked stale. Polled, so never reported as live.",
      capabilities: DOCUMENT_REPOSITORY_CAPABILITIES,
      endpointLabel: "In process simulator",
      secretStatus: "not-required",
      writeEnabled: false,
      eventSubscriptionStatus: "polling",
      deepLinkTemplate: "https://evidence.arcadia.example/document/{externalId}",
      requiredByPacks: ["understand", "tprm", "control-assurance"],
    },
    {
      id: CI_WEBHOOK,
      packId: "generic-rest-webhook",
      connectorKey: GENERIC_WEBHOOK_KEY,
      displayName: "Generic webhook connector",
      sourceSystem: "Inbound webhook",
      mode: "simulated",
      healthState: "healthy",
      healthMessage:
        "Accepts an inbound event from any internal system. Deduplicated on connector and event key. No signature is verified in this build.",
      capabilities: GENERIC_WEBHOOK_CAPABILITIES,
      endpointLabel: "POST /api/integrations/webhook/webhook.generic",
      secretStatus: "not-required",
      writeEnabled: false,
      eventSubscriptionStatus: "webhook",
      deepLinkTemplate: null,
      requiredByPacks: [],
    },

    /* ---- The sandbox or live capable adapter ---- */
    {
      id: CI_MICROSOFT_GRAPH,
      packId: "microsoft-365",
      connectorKey: MICROSOFT_GRAPH_KEY,
      displayName: "Microsoft Graph",
      sourceSystem: "Microsoft Graph",
      mode: "sandbox-ready",
      healthState: "healthy",
      healthMessage:
        "Sandbox ready. With no credential configured it reads the seeded institution through the Microsoft 365 simulator. The complete local experience needs no credential.",
      capabilities: MICROSOFT_GRAPH_CAPABILITIES,
      endpointLabel: "Sandbox profile. No endpoint is contacted.",
      /* Absent, not present. Nothing in this build stores a credential. */
      secretStatus: "absent",
      writeEnabled: false,
      eventSubscriptionStatus: "simulated",
      deepLinkTemplate: "https://workspace.arcadia.example/graph/{externalId}",
      requiredByPacks: [],
    },

    /* ---- Configured, implemented, and with no reachable endpoint ---- */
    {
      id: CI_GENERIC_REST,
      packId: "generic-rest-webhook",
      connectorKey: GENERIC_REST_KEY,
      displayName: "Generic REST endpoint",
      sourceSystem: "Generic REST",
      mode: "configured-unavailable",
      healthState: "unconfigured",
      healthMessage:
        "The adapter and its mappings exist. No endpoint is reachable and no credential is stored, so every operation refuses with a retryable unavailability.",
      capabilities: GENERIC_REST_CAPABILITIES,
      endpointLabel: "No endpoint configured",
      secretStatus: "absent",
      /* True so that the failure proof can route an approved command here and
       * reach the retry and dead letter path rather than a refusal. */
      writeEnabled: true,
      eventSubscriptionStatus: "none",
      deepLinkTemplate: null,
      requiredByPacks: [],
    },
  ];

  /* ---- The named adapters on the roadmap ---- */
  for (const spec of PLANNED_ADAPTERS) {
    seeds.push({
      id: `CI-${spec.key.replace("planned.", "").toUpperCase()}`,
      packId: spec.packId,
      connectorKey: spec.key,
      displayName: spec.displayName,
      sourceSystem: spec.sourceSystem,
      mode: "planned",
      healthState: "not-implemented",
      healthMessage: `Planned, not built. ${spec.plannedCapabilityNote} Prerequisite: ${spec.prerequisite}`,
      /* Empty. A planned adapter declares nothing, so the runtime refuses
       * everything, and nobody reading this screen can mistake it for an
       * integration that exists. */
      capabilities: NO_CAPABILITIES,
      endpointLabel: "No endpoint. The adapter is not built.",
      secretStatus: "absent",
      writeEnabled: false,
      eventSubscriptionStatus: "none",
      deepLinkTemplate: null,
      requiredByPacks: [],
    });
  }

  return seeds;
}

/* ==========================================================================
   Mappings
   ========================================================================== */

interface MappingSeed {
  connectorInstanceId: string;
  externalType: string;
  canonicalType: string;
  fieldMappings: Array<{ externalField: string; canonicalField: string; transform?: string }>;
  taxonomyMappings: Array<{ dimension: string; externalValue: string; canonicalValue: string }>;
  conflictPolicy:
    | "source-of-record-wins"
    | "most-recent-wins"
    | "escalate-to-human"
    | "never-overwrite";
  notes: string;
}

/**
 * The declared mappings.
 *
 * Note the conflict policies, because they encode real judgments.
 *
 * A control rating from the GRC platform is `source-of-record-wins`: the
 * rating is a recorded human conclusion and no other system gets to change it.
 * A process intelligence signal about the same control is
 * `escalate-to-human`: the mining platform is entitled to disagree, and the
 * disagreement is the finding rather than something to reconcile away.
 *
 * Ownership and legal entity are `never-overwrite`. Once the product has
 * recorded who owns an object and which entity it belongs to, a second source
 * offering a different answer must not silently move accountability, because
 * entity attribution is what determines whether DORA or the Swiss framework
 * applies.
 */
function mappingSeeds(): MappingSeed[] {
  return [
    /* ---- GRC platform, the system of record ---- */
    {
      connectorInstanceId: CI_GRC,
      externalType: "grc.control",
      canonicalType: "Control",
      fieldMappings: [
        { externalField: "reference", canonicalField: "reference", transform: "trim" },
        { externalField: "title", canonicalField: "title", transform: "trim" },
        { externalField: "effectiveness", canonicalField: "effectiveness" },
        { externalField: "firstLineEffectiveness", canonicalField: "firstLineEffectiveness" },
        { externalField: "nature", canonicalField: "nature" },
        { externalField: "automation", canonicalField: "automation" },
        { externalField: "frequency", canonicalField: "frequency" },
        { externalField: "keyControl", canonicalField: "keyControl", transform: "boolean" },
        { externalField: "ownerUserId", canonicalField: "ownerId" },
        { externalField: "entityIds", canonicalField: "legalEntityIds" },
        { externalField: "lastTestedOn", canonicalField: "lastTestedOn", transform: "iso-date" },
      ],
      taxonomyMappings: [
        { dimension: "effectiveness", externalValue: "effective", canonicalValue: "effective" },
        {
          dimension: "effectiveness",
          externalValue: "partially-effective",
          canonicalValue: "partially-effective",
        },
        { dimension: "effectiveness", externalValue: "ineffective", canonicalValue: "ineffective" },
        { dimension: "nature", externalValue: "preventive", canonicalValue: "preventive" },
        { dimension: "nature", externalValue: "detective", canonicalValue: "detective" },
      ],
      conflictPolicy: "source-of-record-wins",
      notes:
        "The recorded effectiveness is a human conclusion held in the system of record. No other source may change it.",
    },
    {
      connectorInstanceId: CI_GRC,
      externalType: "grc.risk",
      canonicalType: "Risk",
      fieldMappings: [
        { externalField: "title", canonicalField: "title", transform: "trim" },
        { externalField: "taxonomyL1", canonicalField: "taxonomyLevel1" },
        { externalField: "taxonomyL2", canonicalField: "taxonomyLevel2" },
        { externalField: "inherentLikelihood", canonicalField: "inherentLikelihood", transform: "number" },
        { externalField: "inherentImpact", canonicalField: "inherentImpact", transform: "number" },
        { externalField: "appetitePosition", canonicalField: "appetitePosition" },
        { externalField: "ownerUserId", canonicalField: "ownerId" },
        { externalField: "entityIds", canonicalField: "legalEntityIds" },
      ],
      taxonomyMappings: [
        { dimension: "appetitePosition", externalValue: "within", canonicalValue: "within" },
        { dimension: "appetitePosition", externalValue: "at-limit", canonicalValue: "at-limit" },
        { dimension: "appetitePosition", externalValue: "outside", canonicalValue: "outside" },
      ],
      conflictPolicy: "source-of-record-wins",
      notes: "The group risk taxonomy is owned by the GRC platform.",
    },
    {
      connectorInstanceId: CI_GRC,
      externalType: "grc.assessment",
      canonicalType: "Assessment",
      fieldMappings: [
        { externalField: "reference", canonicalField: "reference" },
        { externalField: "title", canonicalField: "title", transform: "trim" },
        { externalField: "kind", canonicalField: "assessmentKind" },
        { externalField: "subjectKind", canonicalField: "subjectKind" },
        { externalField: "subjectId", canonicalField: "subjectId" },
        { externalField: "entityId", canonicalField: "legalEntityId" },
        { externalField: "version", canonicalField: "version", transform: "number" },
        { externalField: "status", canonicalField: "status" },
        { externalField: "residualRisk", canonicalField: "residualRating" },
        { externalField: "overallConclusion", canonicalField: "conclusion" },
        { externalField: "approvedByUserId", canonicalField: "approverId" },
      ],
      taxonomyMappings: [
        { dimension: "residualRating", externalValue: "low", canonicalValue: "low" },
        { dimension: "residualRating", externalValue: "medium", canonicalValue: "medium" },
        { dimension: "residualRating", externalValue: "high", canonicalValue: "high" },
        { dimension: "residualRating", externalValue: "critical", canonicalValue: "critical" },
      ],
      conflictPolicy: "source-of-record-wins",
      notes: "Assessments are versioned in the system of record and never overwritten in place.",
    },
    {
      connectorInstanceId: CI_GRC,
      externalType: "grc.finding",
      canonicalType: "Finding",
      fieldMappings: [
        { externalField: "reference", canonicalField: "reference" },
        { externalField: "title", canonicalField: "title", transform: "trim" },
        { externalField: "severity", canonicalField: "severity" },
        { externalField: "status", canonicalField: "status" },
        { externalField: "ownerUserId", canonicalField: "ownerId" },
        { externalField: "dueOn", canonicalField: "dueOn", transform: "iso-date" },
        { externalField: "entityId", canonicalField: "legalEntityId" },
      ],
      taxonomyMappings: [
        { dimension: "severity", externalValue: "critical", canonicalValue: "critical" },
        { dimension: "severity", externalValue: "high", canonicalValue: "high" },
        { dimension: "severity", externalValue: "medium", canonicalValue: "medium" },
        { dimension: "severity", externalValue: "low", canonicalValue: "low" },
      ],
      conflictPolicy: "source-of-record-wins",
      notes: "Finding severity is a human decision recorded in the system of record.",
    },
    {
      connectorInstanceId: CI_GRC,
      externalType: "grc.action",
      canonicalType: "Action",
      fieldMappings: [
        { externalField: "reference", canonicalField: "reference" },
        { externalField: "title", canonicalField: "title", transform: "trim" },
        { externalField: "status", canonicalField: "status" },
        { externalField: "priority", canonicalField: "priority" },
        { externalField: "ownerUserId", canonicalField: "ownerId" },
        { externalField: "ownerLabel", canonicalField: "ownerLabel" },
        { externalField: "dueOn", canonicalField: "dueOn", transform: "iso-date" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "most-recent-wins",
      notes:
        "Action status moves often and both the GRC platform and service management may touch it, so recency decides.",
    },
    {
      connectorInstanceId: CI_GRC,
      externalType: "grc.supplier",
      canonicalType: "Supplier",
      fieldMappings: [
        { externalField: "name", canonicalField: "name", transform: "trim" },
        { externalField: "domicile", canonicalField: "domicile" },
        { externalField: "criticality", canonicalField: "criticality" },
        { externalField: "outsourcing", canonicalField: "isOutsourcing", transform: "boolean" },
        { externalField: "status", canonicalField: "status" },
        { externalField: "contractingEntityIds", canonicalField: "legalEntityIds" },
        { externalField: "relationshipOwnerUserId", canonicalField: "ownerId" },
      ],
      taxonomyMappings: [
        { dimension: "criticality", externalValue: "critical", canonicalValue: "critical" },
        { dimension: "criticality", externalValue: "important", canonicalValue: "important" },
        { dimension: "criticality", externalValue: "standard", canonicalValue: "standard" },
      ],
      conflictPolicy: "never-overwrite",
      notes:
        "Legal entity attribution and ownership are never overwritten by a second source. Which entity contracts a supplier determines which supervisory framework applies.",
    },
    {
      connectorInstanceId: CI_GRC,
      externalType: "grc.service",
      canonicalType: "Service",
      fieldMappings: [
        { externalField: "name", canonicalField: "name", transform: "trim" },
        { externalField: "domain", canonicalField: "domain" },
        {
          externalField: "importantBusinessService",
          canonicalField: "isImportantBusinessService",
          transform: "boolean",
        },
        { externalField: "operationalStatus", canonicalField: "operationalStatus" },
        { externalField: "entityIds", canonicalField: "legalEntityIds" },
        { externalField: "ownerUserId", canonicalField: "ownerId" },
      ],
      taxonomyMappings: [
        { dimension: "operationalStatus", externalValue: "normal", canonicalValue: "normal" },
        { dimension: "operationalStatus", externalValue: "degraded", canonicalValue: "degraded" },
        { dimension: "operationalStatus", externalValue: "fallback", canonicalValue: "fallback" },
        { dimension: "operationalStatus", externalValue: "impaired", canonicalValue: "impaired" },
      ],
      conflictPolicy: "most-recent-wins",
      notes: "Operational status is the one field a monitoring source may update ahead of the GRC platform.",
    },

    /* ---- Process intelligence, entitled to disagree ---- */
    {
      connectorInstanceId: CI_PROCESS_INTELLIGENCE,
      externalType: "pi.process",
      canonicalType: "Process",
      fieldMappings: [
        { externalField: "code", canonicalField: "code" },
        { externalField: "name", canonicalField: "name", transform: "trim" },
        { externalField: "serviceId", canonicalField: "serviceId" },
        { externalField: "entityIds", canonicalField: "legalEntityIds" },
        { externalField: "ownerUserId", canonicalField: "ownerId" },
        { externalField: "monthlyVolume", canonicalField: "monthlyVolume", transform: "number" },
        { externalField: "manualTouchRate", canonicalField: "manualTouchRate", transform: "number" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "escalate-to-human",
      notes:
        "Volume and manual touch rate are observations and the GRC platform holds the recorded design. Where they imply different conclusions, a person decides.",
    },
    {
      connectorInstanceId: CI_PROCESS_INTELLIGENCE,
      externalType: "pi.case",
      canonicalType: "Test",
      fieldMappings: [
        { externalField: "transactionRef", canonicalField: "reference" },
        { externalField: "controlTestId", canonicalField: "controlTestId" },
        { externalField: "occurredAt", canonicalField: "occurredAt" },
        { externalField: "entityId", canonicalField: "legalEntityId" },
        { externalField: "repairReason", canonicalField: "reason" },
        {
          externalField: "secondaryReviewEvidenced",
          canonicalField: "secondaryReviewEvidenced",
          transform: "boolean",
        },
        { externalField: "outcome", canonicalField: "outcome" },
        { externalField: "fromFallbackRoute", canonicalField: "fromFallbackRoute", transform: "boolean" },
      ],
      taxonomyMappings: [
        { dimension: "outcome", externalValue: "pass", canonicalValue: "pass" },
        { dimension: "outcome", externalValue: "exception", canonicalValue: "exception" },
        { dimension: "outcome", externalValue: "indeterminate", canonicalValue: "indeterminate" },
      ],
      conflictPolicy: "escalate-to-human",
      notes:
        "A mined case that contradicts the recorded test result is the finding, not an error to reconcile.",
    },
    {
      connectorInstanceId: CI_PROCESS_INTELLIGENCE,
      externalType: "pi.deviation",
      canonicalType: "Control",
      fieldMappings: [
        { externalField: "metric", canonicalField: "metric" },
        { externalField: "value", canonicalField: "deviationCount", transform: "number" },
        {
          externalField: "fallbackRouteCases",
          canonicalField: "fallbackRouteCases",
          transform: "number",
        },
        { externalField: "population", canonicalField: "population", transform: "number" },
        { externalField: "controlTestId", canonicalField: "controlTestId" },
        { externalField: "processId", canonicalField: "processId" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "escalate-to-human",
      notes:
        "A deviation is an assertion about a control, so it maps onto Control and not onto Indicator. It never changes the recorded rating: the policy escalates, because a mining platform disagreeing with a recorded conclusion is the finding.",
    },
    {
      connectorInstanceId: CI_PROCESS_INTELLIGENCE,
      externalType: "pi.signal",
      canonicalType: "Indicator",
      fieldMappings: [
        { externalField: "metric", canonicalField: "metric" },
        { externalField: "value", canonicalField: "value", transform: "number" },
        { externalField: "population", canonicalField: "population", transform: "number" },
        { externalField: "controlTestId", canonicalField: "controlTestId" },
        { externalField: "processId", canonicalField: "processId" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "most-recent-wins",
      notes: "A derived signal is replaced by its own later computation and by nothing else.",
    },

    /* ---- Document repository ---- */
    {
      connectorInstanceId: CI_DOCUMENT_REPOSITORY,
      externalType: "dms.document",
      canonicalType: "Evidence",
      fieldMappings: [
        { externalField: "reference", canonicalField: "reference" },
        { externalField: "title", canonicalField: "title", transform: "trim" },
        { externalField: "sourceType", canonicalField: "documentKind" },
        { externalField: "authorLabel", canonicalField: "authorLabel" },
        { externalField: "documentDate", canonicalField: "documentDate", transform: "iso-date" },
        { externalField: "dataClassification", canonicalField: "classification" },
        { externalField: "status", canonicalField: "status" },
        { externalField: "stale", canonicalField: "isStale", transform: "boolean" },
        { externalField: "entityIds", canonicalField: "legalEntityIds" },
      ],
      taxonomyMappings: [
        { dimension: "classification", externalValue: "internal", canonicalValue: "internal" },
        { dimension: "classification", externalValue: "confidential", canonicalValue: "confidential" },
        { dimension: "classification", externalValue: "restricted", canonicalValue: "restricted" },
      ],
      conflictPolicy: "never-overwrite",
      notes:
        "A document is immutable once ingested. A later version is a new document that supersedes it, not an overwrite.",
    },

    /* ---- Microsoft 365 ---- */
    {
      connectorInstanceId: CI_MICROSOFT_365,
      externalType: "m365.message",
      canonicalType: "Message",
      fieldMappings: [
        { externalField: "subject", canonicalField: "subject", transform: "trim" },
        { externalField: "fromLabel", canonicalField: "fromLabel" },
        { externalField: "fromUserId", canonicalField: "fromPersonId" },
        { externalField: "receivedAt", canonicalField: "receivedAt" },
        { externalField: "channel", canonicalField: "channel" },
        { externalField: "read", canonicalField: "isRead", transform: "boolean" },
      ],
      taxonomyMappings: [
        { dimension: "channel", externalValue: "mail", canonicalValue: "mail" },
        { dimension: "channel", externalValue: "collaboration", canonicalValue: "chat" },
        { dimension: "channel", externalValue: "grc-queue", canonicalValue: "workflow" },
        { dimension: "channel", externalValue: "service-management", canonicalValue: "workflow" },
        { dimension: "channel", externalValue: "alert", canonicalValue: "alert" },
      ],
      conflictPolicy: "most-recent-wins",
      notes: "Read state and triage move frequently and the collaboration suite is authoritative.",
    },
    {
      connectorInstanceId: CI_MICROSOFT_365,
      externalType: "m365.user",
      canonicalType: "Person",
      fieldMappings: [
        { externalField: "name", canonicalField: "name", transform: "trim" },
        { externalField: "jobTitle", canonicalField: "jobTitle" },
        { externalField: "department", canonicalField: "department" },
        { externalField: "entityId", canonicalField: "legalEntityId" },
        { externalField: "line", canonicalField: "lineOfDefence" },
      ],
      taxonomyMappings: [
        { dimension: "lineOfDefence", externalValue: "1lod", canonicalValue: "first-line" },
        { dimension: "lineOfDefence", externalValue: "2lod", canonicalValue: "second-line" },
        { dimension: "lineOfDefence", externalValue: "3lod", canonicalValue: "third-line" },
      ],
      conflictPolicy: "never-overwrite",
      notes:
        "Ownership and legal entity attribution are never overwritten by a directory read, because entity attribution determines the supervisory framework that applies.",
    },
    {
      connectorInstanceId: CI_MICROSOFT_365,
      externalType: "m365.chatMessage",
      canonicalType: "Message",
      fieldMappings: [
        { externalField: "subject", canonicalField: "subject", transform: "trim" },
        { externalField: "channelName", canonicalField: "channel" },
        { externalField: "sentAtMoment", canonicalField: "sentAtMoment" },
        { externalField: "simulatedOnly", canonicalField: "simulatedOnly", transform: "boolean" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "most-recent-wins",
      notes: "Collaboration messages written by this product are flagged simulated and never delivered.",
    },
    {
      connectorInstanceId: CI_MICROSOFT_365,
      externalType: "m365.event",
      canonicalType: "Meeting",
      fieldMappings: [
        { externalField: "title", canonicalField: "title", transform: "trim" },
        { externalField: "kind", canonicalField: "meetingKind" },
        { externalField: "scheduledFor", canonicalField: "scheduledFor" },
        { externalField: "status", canonicalField: "status" },
        { externalField: "subjectKind", canonicalField: "subjectKind" },
        { externalField: "subjectId", canonicalField: "subjectId" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "most-recent-wins",
      notes: "The calendar is authoritative for meeting time and attendance.",
    },

    /* ---- Microsoft Graph, mapping the Graph vocabulary ---- */
    {
      connectorInstanceId: CI_MICROSOFT_GRAPH,
      externalType: "graph.message",
      canonicalType: "Message",
      fieldMappings: [
        { externalField: "subject", canonicalField: "subject", transform: "trim" },
        { externalField: "fromLabel", canonicalField: "fromLabel" },
        { externalField: "receivedAt", canonicalField: "receivedAt" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "most-recent-wins",
      notes:
        "Exercised locally in the sandbox profile, so the Graph vocabulary to canonical mapping is tested before a tenant exists.",
    },
    {
      connectorInstanceId: CI_MICROSOFT_GRAPH,
      externalType: "graph.user",
      canonicalType: "Person",
      fieldMappings: [
        { externalField: "name", canonicalField: "name", transform: "trim" },
        { externalField: "jobTitle", canonicalField: "jobTitle" },
        { externalField: "entityId", canonicalField: "legalEntityId" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "never-overwrite",
      notes: "A directory read never changes recorded ownership or entity attribution.",
    },

    /* ---- The generic webhook ---- */
    {
      connectorInstanceId: CI_WEBHOOK,
      externalType: "webhook.record",
      canonicalType: "ExternalRecord",
      fieldMappings: [
        { externalField: "label", canonicalField: "title", transform: "trim" },
        { externalField: "detail", canonicalField: "summary", transform: "trim" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "escalate-to-human",
      notes:
        "An arbitrary inbound record from an unnamed system cannot be allowed to overwrite a projection, so a disagreement always reaches a person.",
    },

    /* ---- The generic REST adapter ---- */
    {
      connectorInstanceId: CI_GENERIC_REST,
      externalType: "rest.record",
      canonicalType: "ExternalRecord",
      fieldMappings: [
        { externalField: "id", canonicalField: "reference" },
        { externalField: "label", canonicalField: "title", transform: "trim" },
      ],
      taxonomyMappings: [],
      conflictPolicy: "escalate-to-human",
      notes: "Mappings exist so the adapter is ready. No endpoint is reachable in this build.",
    },
  ];
}

/* ==========================================================================
   Sync state
   ========================================================================== */

/**
 * Staleness thresholds per source and object type.
 *
 * Two sources do not age at the same rate and a single global threshold would
 * be wrong in both directions. An assessment from the GRC platform four hours
 * old is current, because assessments change on a cycle measured in weeks. A
 * payment volume reading four hours old is not, because the whole point of the
 * mining signal is that it changes during the day.
 */
const STALENESS_MINUTES: Record<string, number> = {
  "grc.risk": 1_440,
  "grc.control": 480,
  "grc.assessment": 1_440,
  "grc.finding": 240,
  "grc.action": 240,
  "grc.supplier": 1_440,
  "grc.service": 30,
  "pi.process": 180,
  "pi.case": 60,
  "pi.signal": 30,
  "pi.deviation": 30,
  "dms.document": 720,
  "m365.message": 15,
  "m365.event": 60,
  "m365.chatMessage": 15,
  "m365.user": 1_440,
  "graph.message": 15,
  "graph.event": 60,
  "graph.chatMessage": 15,
  "graph.user": 1_440,
  "rest.record": 120,
  "webhook.record": 60,
};

/* ==========================================================================
   Source requirements
   ========================================================================== */

/**
 * Which sources a decision cannot be completed without.
 *
 * Declared per judgment kind rather than per decision identifier, so the set
 * holds when the seeded decisions change. `required` is used sparingly and
 * deliberately: it is the classification that stops the AI layer publishing a
 * final recommendation, so over-using it would turn a real guard into a
 * constant obstruction that someone eventually works around.
 */
const REQUIREMENTS_BY_JUDGMENT: Record<
  string,
  Array<{ instanceId: string; objectType: string; necessity: "required" | "helpful" | "optional"; rationale: string }>
> = {
  "control-effectiveness": [
    {
      instanceId: CI_GRC,
      objectType: "grc.control",
      necessity: "required",
      rationale:
        "The recorded rating is the thing being changed. Without it there is nothing to compare a conclusion against.",
    },
    {
      instanceId: CI_PROCESS_INTELLIGENCE,
      objectType: "pi.case",
      necessity: "required",
      rationale:
        "The mined repair cases are the evidence that the control is bypassed in practice. A rating conclusion without them is an opinion.",
    },
    {
      instanceId: CI_DOCUMENT_REPOSITORY,
      objectType: "dms.document",
      necessity: "helpful",
      rationale: "The control description and the previous test report support the conclusion.",
    },
  ],
  "assurance-conclusion": [
    {
      instanceId: CI_PROCESS_INTELLIGENCE,
      objectType: "pi.case",
      necessity: "required",
      rationale: "The test population comes from the mined cases.",
    },
    {
      instanceId: CI_GRC,
      objectType: "grc.control",
      necessity: "required",
      rationale: "The control under test and its recorded design.",
    },
    {
      instanceId: CI_DOCUMENT_REPOSITORY,
      objectType: "dms.document",
      necessity: "helpful",
      rationale: "The per case review evidence, where it exists.",
    },
  ],
  "residual-risk": [
    {
      instanceId: CI_GRC,
      objectType: "grc.assessment",
      necessity: "required",
      rationale: "The current assessment version is what a new residual position supersedes.",
    },
    {
      instanceId: CI_GRC,
      objectType: "grc.control",
      necessity: "required",
      rationale: "Control effectiveness is an input to the residual position.",
    },
  ],
  criticality: [
    {
      instanceId: CI_GRC,
      objectType: "grc.supplier",
      necessity: "required",
      rationale: "The recorded criticality and the contracting entity.",
    },
    {
      instanceId: CI_DOCUMENT_REPOSITORY,
      objectType: "dms.document",
      necessity: "required",
      rationale:
        "The contract and the supplier submission. A criticality conclusion without the contractual position is not defensible.",
    },
  ],
  "conditional-approval": [
    {
      instanceId: CI_GRC,
      objectType: "grc.supplier",
      necessity: "required",
      rationale: "The supplier record and its assessment history.",
    },
    {
      instanceId: CI_DOCUMENT_REPOSITORY,
      objectType: "dms.document",
      necessity: "required",
      rationale: "The evidence behind each contractual obligation being relied on.",
    },
  ],
  severity: [
    {
      instanceId: CI_GRC,
      objectType: "grc.service",
      necessity: "required",
      rationale: "Operational status and the affected important business services.",
    },
    {
      instanceId: CI_DOCUMENT_REPOSITORY,
      objectType: "dms.document",
      necessity: "helpful",
      rationale: "The supplier notification and the internal incident record.",
    },
  ],
  escalation: [
    {
      instanceId: CI_GRC,
      objectType: "grc.service",
      necessity: "required",
      rationale: "The service and tolerance position the escalation rests on.",
    },
  ],
  applicability: [
    {
      instanceId: CI_DOCUMENT_REPOSITORY,
      objectType: "dms.document",
      necessity: "required",
      rationale:
        "The publication text. An applicability interpretation without the source paragraph cannot be checked.",
    },
    {
      instanceId: CI_GRC,
      objectType: "grc.control",
      necessity: "helpful",
      rationale: "The controls that would carry the obligation.",
    },
  ],
  materiality: [
    {
      instanceId: CI_GRC,
      objectType: "grc.finding",
      necessity: "helpful",
      rationale: "Open findings contributing to the theme.",
    },
    {
      instanceId: CI_GRC,
      objectType: "grc.action",
      necessity: "helpful",
      rationale: "Open actions and their ownership.",
    },
  ],
  agenda: [
    {
      instanceId: CI_GRC,
      objectType: "grc.finding",
      necessity: "optional",
      rationale: "Findings that may warrant an agenda slot.",
    },
  ],
  "risk-acceptance": [
    {
      instanceId: CI_GRC,
      objectType: "grc.risk",
      necessity: "required",
      rationale: "The risk and its appetite statement.",
    },
  ],
};

/* ==========================================================================
   The seed function
   ========================================================================== */

/**
 * Writes the integration layer for one run.
 *
 * Add the following line to `seedScenario` in `src/db/seed/run.ts`, inside the
 * `writeEverything` transaction, after the `timelineRoleMoments` insert:
 *
 *     total += seedIntegrations(runId).rowsWritten;
 *
 * with the import `import { seedIntegrations } from "@/integrations/seed";`
 * at the top of that file. It joins the surrounding transaction because it
 * uses the same `getDb()` handle.
 */
export function seedIntegrations(runId: string = DEFAULT_RUN_ID): IntegrationSeedSummary {
  const db = getDb();
  const sqlite = getSqlite();
  const counts: Record<string, number> = {};
  let total = 0;

  /*
   * Cleared here rather than in the main seed's own list, which this module
   * cannot edit. Order matters: the child tables go first, and the pack table
   * is global rather than run scoped so it is replaced wholesale.
   */
  for (const table of [
    "external_execution_receipts",
    "dead_letter_entries",
    "integration_commands",
    "integration_events",
    "external_references",
    "connector_sync_state",
    "source_requirements",
  ]) {
    sqlite.prepare(`delete from ${table} where run_id = ?`).run(runId);
  }
  sqlite.prepare("delete from source_mappings").run();
  sqlite.prepare("delete from connector_instances").run();
  sqlite.prepare("delete from connector_packs").run();

  /* ---- Packs ---- */
  db.insert(connectorPacks).values(packs).run();
  counts.connectorPacks = packs.length;
  total += packs.length;

  /* ---- Instances ---- */
  const createdAt = new Date().toISOString();
  const instances = instanceSeeds().map((seed) => ({
    id: seed.id,
    packId: seed.packId,
    connectorKey: seed.connectorKey,
    displayName: seed.displayName,
    sourceSystem: seed.sourceSystem,
    mode: seed.mode,
    healthState: seed.healthState,
    healthMessage: seed.healthMessage,
    capabilities: seed.capabilities,
    endpointLabel: seed.endpointLabel,
    secretStatus: seed.secretStatus,
    writeEnabled: seed.writeEnabled,
    eventSubscriptionStatus: seed.eventSubscriptionStatus,
    lastSyncAt: null,
    lastSyncStatus: "never-run",
    deepLinkTemplate: seed.deepLinkTemplate,
    requiredByPacks: seed.requiredByPacks,
    createdAt,
  }));
  db.insert(connectorInstances).values(instances).run();
  counts.connectorInstances = instances.length;
  total += instances.length;

  /* ---- Mappings ---- */
  const mappings = mappingSeeds().map((seed, index) => ({
    id: `SMAP-${String(index + 1).padStart(3, "0")}`,
    connectorInstanceId: seed.connectorInstanceId,
    externalType: seed.externalType,
    canonicalType: seed.canonicalType,
    fieldMappings: seed.fieldMappings,
    taxonomyMappings: seed.taxonomyMappings,
    conflictPolicy: seed.conflictPolicy,
    notes: seed.notes,
  }));
  db.insert(sourceMappings).values(mappings).run();
  counts.sourceMappings = mappings.length;
  total += mappings.length;

  /* ---- Sync state, one row per instance and declared read type ---- */
  const syncRows: Array<typeof connectorSyncState.$inferInsert> = [];
  for (const instance of instances) {
    for (const objectType of instance.capabilities.read) {
      syncRows.push({
        id: `CSS-${instance.id}-${objectType}`,
        runId,
        connectorInstanceId: instance.id,
        objectType,
        lastCursor: null,
        lastSyncAt: null,
        lastSyncStatus: "never-run",
        recordsSeen: 0,
        recordsChanged: 0,
        recordsConflicted: 0,
        stalenessThresholdMinutes: STALENESS_MINUTES[objectType] ?? 120,
      });
    }
  }
  if (syncRows.length > 0) db.insert(connectorSyncState).values(syncRows).run();
  counts.connectorSyncState = syncRows.length;
  total += syncRows.length;

  /* ---- Source requirements, derived from the seeded decisions ----
   *
   * Derived rather than listed, so a decision added to the scenario later
   * acquires its requirements automatically from its judgment kind. A hand
   * written list keyed by decision identifier would silently leave new
   * decisions with no required sources, which is the failure that would let
   * the AI layer publish through a gap.
   */
  const decisionRows = db
    .select({
      id: decisions.id,
      judgmentKind: decisions.judgmentKind,
      relatedObjectKind: decisions.relatedObjectKind,
      relatedObjectId: decisions.relatedObjectId,
    })
    .from(decisions)
    .where(eq(decisions.runId, runId))
    .all();

  const requirementRows: Array<typeof sourceRequirements.$inferInsert> = [];
  const seen = new Set<string>();

  const push = (
    contextType: string,
    contextId: string,
    entry: { instanceId: string; objectType: string; necessity: "required" | "helpful" | "optional"; rationale: string },
  ): void => {
    const key = `${contextType}|${contextId}|${entry.instanceId}|${entry.objectType}`;
    if (seen.has(key)) return;
    seen.add(key);
    requirementRows.push({
      id: `SREQ-${String(requirementRows.length + 1).padStart(4, "0")}`,
      runId,
      contextType,
      contextId,
      connectorInstanceId: entry.instanceId,
      objectType: entry.objectType,
      necessity: entry.necessity,
      rationale: entry.rationale,
    });
  };

  /*
   * A judgment kind with no entry would give its decisions no required
   * sources, and the AI layer would then publish a final recommendation
   * through a gap it could not see. Collected and reported rather than
   * silently defaulted, because an empty requirement list is indistinguishable
   * from a deliberate one.
   */
  const uncoveredJudgmentKinds = new Set<string>();

  for (const decision of decisionRows) {
    const entries = REQUIREMENTS_BY_JUDGMENT[decision.judgmentKind];
    if (!entries) {
      uncoveredJudgmentKinds.add(decision.judgmentKind);
      continue;
    }
    for (const entry of entries) {
      push("decision", decision.id, entry);
      /*
       * The same requirements are also recorded against the canonical object,
       * because the AI layer asks about an object when the user selects one
       * and there is not always a decision in play.
       */
      if (decision.relatedObjectId) {
        push(canonicalContextType(decision.relatedObjectKind), decision.relatedObjectId, entry);
      }
    }
  }

  if (requirementRows.length > 0) db.insert(sourceRequirements).values(requirementRows).run();
  counts.sourceRequirements = requirementRows.length;
  total += requirementRows.length;

  return {
    rowsWritten: total,
    counts,
    uncoveredJudgmentKinds: [...uncoveredJudgmentKinds].sort(),
  };
}

/** The scenario's object kind vocabulary mapped onto a canonical type name. */
function canonicalContextType(objectKind: string | null): string {
  switch (objectKind) {
    case "control":
      return "Control";
    case "risk":
      return "Risk";
    case "supplier":
      return "Supplier";
    case "service":
      return "Service";
    case "process":
      return "Process";
    case "assessment":
      return "Assessment";
    case "test-case":
    case "control-test":
      return "Test";
    case "incident":
      return "Incident";
    case "obligation":
      return "Obligation";
    case "theme":
      return "Decision";
    default:
      return "ExternalRecord";
  }
}
