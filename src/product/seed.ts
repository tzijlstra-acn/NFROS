/**
 * Product configuration seed.
 *
 * Writes the packaging layer: brands, terminology, entitlements, deployment
 * profiles, the organisation profile for the synthetic institution, the six
 * function packs, and the singleton row that names which of them is active.
 *
 * Idempotent by delete then insert, scoped strictly to the eight product
 * tables. It never touches a domain table. That boundary is the point of the
 * whole layer: reconfiguring the product must not be able to move a decision,
 * an approval or an audit event, and a seed that cleared more than its own
 * tables would quietly break that guarantee the first time somebody reran it.
 *
 * Deterministic. No wall clock in the content, so two seeds of the same build
 * produce identical rows and the configuration version only moves when an
 * administrator actually changes something.
 */

import { getDb, getSqlite } from "@/db/client";
import {
  activeProductConfig,
  brandProfiles,
  deploymentProfiles,
  entitlementProfiles,
  functionPacks,
  organisationProfiles,
  productConfigChanges,
  terminologyProfiles,
} from "@/db/schema/product";
import { CONNECTOR_PACK_IDS } from "@/db/schema/integration";
import { ADMIN_FEATURE_IDS, AI_FEATURE_IDS } from "./entitlements/entitlements";
import {
  ALTERNATE_TERMINOLOGY_OVERRIDES,
  ALTERNATE_TERMINOLOGY_PROFILE_ID,
  DEFAULT_TERMINOLOGY_PROFILE_ID,
  DEFAULT_TERMINOLOGY_TERMS,
} from "./terminology/terms";
import { ACTIVE_PRODUCT_CONFIG_ID, resetProductConfigCaches } from "./organisation/profile";
import { PRODUCT_IDENTITY } from "./release/identity";

/**
 * A fixed timestamp rather than `new Date()`.
 *
 * The configuration version key is built from `updatedAt`, and every resolver
 * cache compares against it. If the seed stamped the current time, every seed
 * would invalidate every cache and, worse, the product configuration audit
 * trail would show a change that nobody made. A constant means the only rows
 * carrying a real timestamp are the ones an administrator wrote.
 */
export const PRODUCT_SEEDED_AT = "2026-10-06T06:00:00.000Z";

export const ORGANISATION_PROFILE_ID = "org-arcadia-banking-group";
export const DEFAULT_BRAND_PROFILE_ID = "brand-client-arcadia";
export const OPERATOR_BRAND_PROFILE_ID = "brand-accenture-demo";
export const COBRANDED_BRAND_PROFILE_ID = "brand-cobranded-arcadia";
export const FULL_ENTITLEMENT_PROFILE_ID = "entitlement-group-full";
export const RESTRICTED_ENTITLEMENT_PROFILE_ID = "entitlement-two-function-pilot";
export const LOCAL_DEPLOYMENT_PROFILE_ID = "deployment-restricted-local";

/* ==========================================================================
   Brand profiles
   ========================================================================== */

/*
 * Logo assets are neutral placeholder marks in `public/brand/`, not real
 * trademark artwork.
 *
 * Two reasons, both of which would be a problem in a client review. Shipping
 * an institution's actual mark into a repository whose data is entirely
 * synthetic attaches a real brand to invented suppliers, invented incidents
 * and invented ratings. Shipping Accenture's mark into the same repository
 * implies that the firm endorses those invented figures. The placeholder is
 * abstract geometry with no wordmark, and the organisation name is rendered as
 * text beside it by the shell, so swapping in a real asset at engagement time
 * is a file replacement and nothing else.
 *
 * The product name is read from the release registry in every mode. Branding
 * changes whose marks and attribution are shown, never what the product is
 * called, and a seed that typed the name three times was how the shell came to
 * say one name while the landing page said another.
 */
export const PRODUCT_BRAND_PROFILES: (typeof brandProfiles.$inferInsert)[] = [
  {
    id: DEFAULT_BRAND_PROFILE_ID,
    mode: "client",
    productName: PRODUCT_IDENTITY.name,
    shortName: PRODUCT_IDENTITY.name,
    clientName: "Arcadia Banking Group",
    operatorName: "Accenture",
    primaryLogoUrl: "/brand/client-mark.svg",
    secondaryLogoUrl: "/brand/operator-mark.svg",
    faviconUrl: "/brand/favicon.svg",
    supportLabel: "Group NFR service desk",
    supportUrl: "https://support.arcadia.example/nfr-workos",
    legalNotice:
      "Synthetic institution and data. Operated for Arcadia Banking Group under an intragroup service agreement.",
    accentToken: "--app-ai",
    syntheticDisclosure: true,
  },
  {
    id: COBRANDED_BRAND_PROFILE_ID,
    mode: "co-branded",
    productName: PRODUCT_IDENTITY.name,
    shortName: PRODUCT_IDENTITY.name,
    clientName: "Arcadia Banking Group",
    operatorName: "Accenture",
    primaryLogoUrl: "/brand/client-mark.svg",
    secondaryLogoUrl: "/brand/operator-mark.svg",
    faviconUrl: "/brand/favicon.svg",
    supportLabel: "Joint service desk, Arcadia and Accenture",
    supportUrl: "https://support.arcadia.example/nfr-workos",
    legalNotice:
      "Synthetic institution and data. Operated jointly by Arcadia Banking Group and Accenture under the managed service agreement.",
    accentToken: "--app-ai",
    syntheticDisclosure: true,
  },
  {
    id: OPERATOR_BRAND_PROFILE_ID,
    mode: "accenture",
    productName: PRODUCT_IDENTITY.name,
    shortName: PRODUCT_IDENTITY.name,
    clientName: "Arcadia Banking Group",
    operatorName: "Accenture",
    /*
     * In operator mode the single mark shown is the operator's, and the
     * resolver reads the primary slot, so the operator file goes there. The
     * secondary slot stays set to the institution mark so switching back to
     * client or co-branded mode needs no re-upload.
     */
    primaryLogoUrl: "/brand/operator-mark.svg",
    secondaryLogoUrl: "/brand/client-mark.svg",
    faviconUrl: "/brand/favicon.svg",
    supportLabel: "Accenture NFR product team",
    supportUrl: "https://support.accenture.example/nfr-workos",
    legalNotice:
      "Accenture demonstration build. Synthetic institution and data. Not a client deployment and not connected to a client system.",
    accentToken: "--app-ai",
    syntheticDisclosure: true,
  },
];

/* ==========================================================================
   Terminology profiles
   ========================================================================== */

/*
 * The default profile stores the full map and the alternate stores only its
 * overrides. That asymmetry is intentional and it is what a client
 * configuration looks like: the institution lists the five words it uses
 * differently, and the other ten come from the product.
 */
export const PRODUCT_TERMINOLOGY_PROFILES: (typeof terminologyProfiles.$inferInsert)[] = [
  {
    id: DEFAULT_TERMINOLOGY_PROFILE_ID,
    name: "DACH banking default",
    description:
      "Plain second line vocabulary as used across German, Austrian and Swiss institutions. German terms are written in ASCII transliteration to match the rest of the product.",
    terms: DEFAULT_TERMINOLOGY_TERMS,
  },
  {
    id: ALTERNATE_TERMINOLOGY_PROFILE_ID,
    name: "Observation led house style",
    description:
      "For an institution that reserves the word finding for internal audit, spells out the self assessment rather than using the acronym, and says deficiency where others say issue.",
    terms: ALTERNATE_TERMINOLOGY_OVERRIDES,
  },
];

/* ==========================================================================
   Entitlement profiles
   ========================================================================== */

export const PRODUCT_ENTITLEMENT_PROFILES: (typeof entitlementProfiles.$inferInsert)[] = [
  {
    id: FULL_ENTITLEMENT_PROFILE_ID,
    name: "Group wide, all function packs",
    functionPacks: [
      "rcsa-operational-risk",
      "third-party-risk",
      "control-assurance",
      "incident-operational-resilience",
      "regulatory-change",
      "nfr-governance",
    ],
    connectorPacks: [...CONNECTOR_PACK_IDS],
    aiFeatures: [...AI_FEATURE_IDS],
    adminFeatures: [...ADMIN_FEATURE_IDS],
    deploymentProfile: LOCAL_DEPLOYMENT_PROFILE_ID,
  },
  {
    /*
     * The restricted profile exists so the entitlement model can be seen
     * denying something. It grants two function packs, three connector packs
     * and no autonomous execution, which is what a first phase pilot in a DACH
     * institution actually looks like: operational risk and third party risk
     * first, everything else after the first supervisory conversation.
     */
    id: RESTRICTED_ENTITLEMENT_PROFILE_ID,
    name: "Two function pilot, no autonomous execution",
    functionPacks: ["rcsa-operational-risk", "third-party-risk"],
    connectorPacks: ["microsoft-365", "grc-irm", "document-knowledge"],
    aiFeatures: [
      "ai-partner-chat",
      "suggestion-generation",
      "evidence-retrieval",
      "meeting-preparation",
    ],
    adminFeatures: [
      "organisation-settings",
      "branding",
      "terminology",
      "integration-settings",
      "deployment-settings",
      "product-config-audit",
    ],
    deploymentProfile: LOCAL_DEPLOYMENT_PROFILE_ID,
  },
];

/* ==========================================================================
   Deployment profiles
   ========================================================================== */

export const PRODUCT_DEPLOYMENT_PROFILES: (typeof deploymentProfiles.$inferInsert)[] = [
  {
    id: LOCAL_DEPLOYMENT_PROFILE_ID,
    kind: "restricted-local-prototype",
    name: "Restricted local prototype",
    description:
      "One process on one machine, holding a synthetic institution in a local SQLite file. This is what this repository runs and the only profile whose statements can be checked by reading the running build.",
    region: "Local machine, no hosted region",
    identityMode:
      "No authentication. The acting role is scenario state, so role switching is a demonstration control and not an identity change.",
    modelEndpointProfile:
      "Operator supplied endpoint, read from the environment once at startup. Safe mode serves cached outputs and makes no network call.",
    dataRetentionProfile:
      "Retained in the local database file until reset or deletion. No backup, no export, no second copy.",
    observabilityProfile:
      "Console logging with credential redaction, plus the in product audit trail. No external telemetry sink.",
    environment: "prototype",
    version: "1.0.0",
    implementedHere: true,
    outstandingWork: [],
  },
  {
    id: "deployment-dedicated-managed",
    kind: "dedicated-managed",
    name: "Dedicated managed service, one tenant per institution",
    description:
      "A dedicated environment per institution, operated by the provider in a named EU or Swiss region, with the institution as data controller and the provider as processor.",
    region: "One named region per institution, EU or Switzerland, no cross region replication",
    identityMode:
      "Federated to the institution identity provider by OIDC, with group to role mapping and no local accounts.",
    modelEndpointProfile:
      "Regional model endpoint under a zero retention agreement, with the endpoint and the region named in the trust page.",
    dataRetentionProfile:
      "Retention per object class, agreed contractually, with legal hold and deletion on exit.",
    observabilityProfile:
      "Provider operated logging and tracing with the audit trail exported to the institution on a schedule.",
    environment: "managed",
    version: "0.1.0-design",
    implementedHere: false,
    outstandingWork: [
      "Tenant provisioning and teardown, including a verified data deletion path on exit.",
      "OIDC federation, group to role mapping and session handling, replacing scenario role state with real identity.",
      "Per tenant encryption key management and a documented key rotation procedure.",
      "A processor agreement, a transfer impact assessment and a subprocessor register for the model endpoint.",
      "Backup, restore and a tested recovery time objective for the tenant database.",
      "Change management, release notes and a staging environment per tenant.",
    ],
  },
  {
    id: "deployment-customer-managed-private",
    kind: "customer-managed-private",
    name: "Customer managed, provider supplied build",
    description:
      "The institution runs the product in its own subscription from a provider supplied container image, keeping the data plane entirely inside its own estate.",
    region: "Wherever the institution runs it. The provider holds no copy of the data.",
    identityMode:
      "The institution identity provider, configured by the institution. The provider has no standing access.",
    modelEndpointProfile:
      "The institution model endpoint, configured by the institution. The provider never holds the credential.",
    dataRetentionProfile:
      "Entirely the institution policy. The product exposes retention settings and enforces nothing of its own.",
    observabilityProfile:
      "The institution logging stack. The product emits structured events and ships them nowhere by itself.",
    environment: "customer-managed",
    version: "0.1.0-design",
    implementedHere: false,
    outstandingWork: [
      "A hardened container image, a published software bill of materials and a signed release chain.",
      "An installation and upgrade runbook that assumes no provider access to the environment.",
      "External configuration and secret handling through the institution secret manager rather than environment files.",
      "A migration path that an institution can run itself, with a rollback that has been tested.",
      "A support model that works without the provider being able to read the data or the logs.",
      "Replacing the local SQLite store with a database the institution already operates.",
    ],
  },
  {
    id: "deployment-bank-private-cloud",
    kind: "bank-private-cloud",
    name: "Bank private cloud, inside the regulated perimeter",
    description:
      "Deployed onto the institution internal platform inside the existing regulated perimeter, inheriting its network controls, its change process and its audit boundary.",
    region: "The institution own data centres or private cloud footprint",
    identityMode:
      "The institution internal single sign on and privileged access management, with break glass under existing controls.",
    modelEndpointProfile:
      "An internally hosted or internally brokered model endpoint. No egress to a public inference endpoint.",
    dataRetentionProfile:
      "The institution records management schedule, applied by the platform rather than by the product.",
    observabilityProfile:
      "The institution monitoring, logging and security operations tooling. The audit boundary is the institution own.",
    environment: "private-cloud",
    version: "0.1.0-design",
    implementedHere: false,
    outstandingWork: [
      "Platform conformance: base image, network policy, service mesh and secret management to the institution standard.",
      "Internal model endpoint integration, including the case where no inference capability is available at all.",
      "Penetration test, threat model and architecture review through the institution own governance.",
      "Operating the product under the institution change freeze calendar and release windows.",
      "Disaster recovery that fits the institution existing tiering rather than defining its own.",
      "Evidence packs for internal audit mapped onto the institution control framework.",
    ],
  },
];

/* ==========================================================================
   Organisation profile
   ========================================================================== */

/*
 * One organisation profile, referencing the real `legal_entities` rows by
 * identifier rather than copying their content.
 *
 * Regulator context is not stored here. It is derived at resolve time from
 * each entity's regulatory bloc, which is what makes it structurally
 * impossible for the Swiss entity to display a DORA reference. See
 * `src/product/organisation/profile.ts` for the failure mode that drove it.
 */
export const PRODUCT_ORGANISATION_PROFILES: (typeof organisationProfiles.$inferInsert)[] = [
  {
    id: ORGANISATION_PROFILE_ID,
    name: "Arcadia Banking Group",
    shortName: "Arcadia",
    countries: ["Germany", "Austria", "Switzerland"],
    legalEntityIds: ["ARC-DE", "ARC-AT", "ARC-CH"],
    defaultLocale: "en-GB",
    /*
     * Two locales, not four. The product has English and German interface
     * copy; it does not have separate Austrian and Swiss German variants, and
     * listing "de-AT" and "de-CH" would claim a localisation depth that does
     * not exist. The German copy is written to serve all three countries.
     */
    supportedLocales: ["en-GB", "de-DE"],
    timezone: "Europe/Berlin",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "24h",
    terminologyProfileId: DEFAULT_TERMINOLOGY_PROFILE_ID,
    brandProfileId: DEFAULT_BRAND_PROFILE_ID,
    entitlementProfileId: FULL_ENTITLEMENT_PROFILE_ID,
    deploymentProfileId: LOCAL_DEPLOYMENT_PROFILE_ID,
    workingDayStart: "07:00",
    workingDayEnd: "19:00",
  },
];

/* ==========================================================================
   Function packs
   ========================================================================== */

/*
 * Every tool name below is a key in `TOOL_REGISTRY` and every screen path is a
 * route that exists. The unit test asserts both, because a pack listing a tool
 * the product does not have is a capability claim that would survive review
 * and fail in front of a client.
 */
export const PRODUCT_FUNCTION_PACKS: (typeof functionPacks.$inferInsert)[] = [
  {
    id: "rcsa-operational-risk",
    name: "RCSA and Operational Risk",
    nameDe: "RCSA und operationelles Risiko",
    version: "1.4.0",
    description:
      "Off cycle reassessment triggered by what changed, challenge preparation grounded in cited evidence, and a residual risk position that a named person records.",
    primaryRoleId: "rcsa",
    domainObjects: ["Process", "Risk", "Control", "Assessment", "Indicator", "Action", "Issue"],
    roles: ["rcsa", "nfr-governance"],
    tools: [
      "getRiskControlGraph",
      "getAssessmentHistory",
      "compareAssessments",
      "getKriHistory",
      "calculateRiskMatrixPosition",
      "prepareChallengeQuestions",
      "proposeResidualRisk",
      "proposeControlRating",
      "initiateReassessment",
      "updateAssessment",
      "proposeAndRecordResidualRisk",
      "updateControlRating",
      "createAction",
      "requestFactualValidation",
    ],
    screens: [
      "/workday/rcsa",
      "/workday/rcsa/workbench",
      "/workday/rcsa/decisions",
      "/workday/rcsa/meetings",
      "/workday/rcsa/assistant",
    ],
    evaluations: [
      "eval-citations-resolve",
      "eval-opposing-evidence",
      "eval-human-decisions-unmade",
      "eval-uncertainty",
      "probe-control-divergence",
    ],
    connectorDependencies: [
      "grc-irm",
      "process-intelligence",
      "document-knowledge",
      "microsoft-365",
    ],
    enabled: true,
  },
  {
    id: "third-party-risk",
    name: "Third-Party Risk",
    nameDe: "Drittparteienrisiko",
    version: "1.3.0",
    description:
      "Supplier, service, subprocessor and fourth party exposure, submission comparison against the contract, and criticality and restriction decisions that stay with the manager.",
    primaryRoleId: "tprm",
    domainObjects: ["Supplier", "Service", "Contract", "Obligation", "Evidence", "Action"],
    roles: ["tprm", "nfr-governance"],
    tools: [
      "getSupplierExposure",
      "getSupplierAssessment",
      "compareSupplierSubmissions",
      "getContractObligations",
      "proposeSupplierCriticality",
      "draftSupplierCommunication",
      "requestEvidenceDocument",
      "recordSupplierAssessment",
      "setSupplierCriticality",
      "applySupplierRestriction",
      "activateMonitoring",
      "createIssue",
    ],
    screens: [
      "/workday/tprm",
      "/workday/tprm/workbench",
      "/workday/tprm/decisions",
      "/workday/tprm/mail",
      "/workday/tprm/meetings",
    ],
    evaluations: [
      "eval-citations-resolve",
      "eval-material-gating",
      "eval-retrieval-grounding",
      "probe-subprocessor-gap",
    ],
    connectorDependencies: [
      "procurement-third-party",
      "grc-irm",
      "document-knowledge",
      "microsoft-365",
    ],
    enabled: true,
  },
  {
    id: "control-assurance",
    name: "Control Assurance",
    nameDe: "Kontrollpruefung",
    version: "1.2.0",
    description:
      "Test populations with every override evidenced, exception classification that distinguishes systemic from isolated, and findings whose severity a human decides.",
    primaryRoleId: "control-assurance",
    domainObjects: ["Control", "Test", "Exception", "Finding", "Evidence", "Issue", "Action"],
    roles: ["control-assurance", "nfr-governance"],
    tools: [
      "getControlTestResults",
      "getEvidenceItem",
      "searchEvidence",
      "getApplicablePolicy",
      "draftFinding",
      "proposeFinding",
      "proposeControlRating",
      "recordTestConclusion",
      "classifyTestException",
      "recordFinding",
      "createIssue",
      "createAction",
    ],
    screens: [
      "/workday/control-assurance",
      "/workday/control-assurance/workbench",
      "/workday/control-assurance/decisions",
      "/workday/control-assurance/collaboration",
    ],
    evaluations: [
      "eval-exceptions-unclassified",
      "eval-citations-resolve",
      "eval-no-compliance-claim",
      "eval-retrieval-grounding",
    ],
    connectorDependencies: ["grc-irm", "service-management", "document-knowledge", "data-platform"],
    enabled: true,
  },
  {
    id: "incident-operational-resilience",
    name: "Incident and Operational Resilience",
    nameDe: "Vorfall und operationelle Resilienz",
    version: "1.3.0",
    description:
      "Incident chronology with provenance per entry, impact tolerance headroom per service, recovery option trade offs, and a supervisory notification recommendation that notifies nobody.",
    primaryRoleId: "incident-resilience",
    domainObjects: ["Incident", "Service", "Process", "Loss", "Evidence", "Decision", "Action"],
    roles: ["incident-resilience", "nfr-governance"],
    tools: [
      "getIncidentTimeline",
      "getServiceDependencies",
      "calculateToleranceRemaining",
      "proposeIncidentClassification",
      "openIncident",
      "classifyIncident",
      "escalateIncident",
      "selectRecoveryOption",
      "recordNotificationRecommendation",
      "captureLessonsLearned",
      "activateMonitoring",
    ],
    screens: [
      "/workday/incident-resilience",
      "/workday/incident-resilience/workbench",
      "/workday/incident-resilience/decisions",
      "/workday/incident-resilience/meetings",
    ],
    evaluations: [
      "eval-jurisdiction-separation",
      "eval-regulatory-label",
      "eval-material-gating",
      "probe-swiss-jurisdiction",
    ],
    connectorDependencies: ["service-management", "microsoft-365", "data-platform", "grc-irm"],
    enabled: true,
  },
  {
    id: "regulatory-change",
    name: "Regulatory Change",
    nameDe: "Regulatorische Aenderung",
    version: "1.1.0",
    description:
      "Obligation applicability decided per legal entity, so an EU requirement is never silently applied to the Swiss entity, with the interpretation recorded against a named person.",
    primaryRoleId: "regulatory-change",
    domainObjects: ["Obligation", "Policy", "Control", "LegalEntity", "Evidence", "Action"],
    roles: ["regulatory-change", "nfr-governance"],
    tools: [
      "getApplicablePolicy",
      "searchEvidence",
      "getEvidenceItem",
      "proposeObligationApplicability",
      "draftCommitteeNarrative",
      "recordObligationInterpretation",
      "addCommitteeAgendaItem",
      "createAction",
    ],
    screens: [
      "/workday/regulatory-change",
      "/workday/regulatory-change/workbench",
      "/workday/regulatory-change/decisions",
      "/workday/regulatory-change/mail",
    ],
    evaluations: [
      "eval-jurisdiction-separation",
      "eval-regulatory-label",
      "eval-no-compliance-claim",
      "probe-unanswerable",
    ],
    connectorDependencies: [
      "regulatory-content",
      "document-knowledge",
      "grc-irm",
      "microsoft-365",
    ],
    enabled: true,
  },
  {
    id: "nfr-governance",
    name: "NFR Governance and Portfolio",
    nameDe: "NFR Governance und Portfolio",
    version: "1.2.0",
    description:
      "One matter as every contributing function sees it, portfolio materiality, committee agenda order, and the end of day account of what was decided and by whom.",
    primaryRoleId: "nfr-governance",
    domainObjects: ["Decision", "Approval", "Theme", "Meeting", "Risk", "Incident", "Supplier"],
    roles: ["nfr-governance"],
    tools: [
      "getPortfolioThread",
      "getDailyBrief",
      "getOpenDecisions",
      "getAuditTrail",
      "proposeAgendaPriority",
      "draftCommitteeNarrative",
      "summariseEndOfDay",
      "setPortfolioMateriality",
      "addCommitteeAgendaItem",
      "escalateIncident",
    ],
    screens: [
      "/workday/nfr-governance",
      "/workday/nfr-governance/decisions",
      "/workday/nfr-governance/meetings",
      "/control-room",
      "/trust",
    ],
    evaluations: [
      "eval-role-completeness",
      "eval-shared-event",
      "eval-guardrails",
      "eval-human-decisions-unmade",
    ],
    connectorDependencies: ["microsoft-365", "data-platform", "grc-irm", "identity-access"],
    enabled: true,
  },
];

/* ==========================================================================
   The active configuration
   ========================================================================== */

export const PRODUCT_ACTIVE_CONFIG: typeof activeProductConfig.$inferInsert = {
  id: ACTIVE_PRODUCT_CONFIG_ID,
  organisationProfileId: ORGANISATION_PROFILE_ID,
  /*
   * Null, so the organisation profile's own brand pointer wins. The override
   * column is what an administrator sets when switching branding mode, and
   * leaving it null at seed time means the seeded state and a state reached by
   * switching back to client branding are not the same row, which is how the
   * change log stays meaningful.
   */
  brandProfileIdOverride: null,
  updatedAt: PRODUCT_SEEDED_AT,
  updatedBy: "seed",
};

/**
 * A genesis entry in the product configuration change log.
 *
 * Without it the branding screen shows an empty history on a fresh seed, and
 * an empty history reads as "no changes are recorded" rather than "the initial
 * configuration is the only state so far".
 */
export const PRODUCT_CONFIG_GENESIS_CHANGE: typeof productConfigChanges.$inferInsert = {
  id: "PCC-0001",
  at: PRODUCT_SEEDED_AT,
  area: "organisation",
  summary:
    "Initial product configuration seeded: Arcadia Banking Group, client branding, DACH banking default terminology, all six function packs, restricted local prototype deployment.",
  previousValue: null,
  newValue: {
    organisationProfileId: ORGANISATION_PROFILE_ID,
    brandProfileId: DEFAULT_BRAND_PROFILE_ID,
    entitlementProfileId: FULL_ENTITLEMENT_PROFILE_ID,
    deploymentProfileId: LOCAL_DEPLOYMENT_PROFILE_ID,
  },
  changedBy: "seed",
};

/* ==========================================================================
   The writer
   ========================================================================== */

export interface ProductSeedSummary {
  rowsWritten: number;
  tablesWritten: number;
  counts: Record<string, number>;
}

/**
 * Writes the product configuration layer.
 *
 * One transaction, so a failure part way through leaves the previous
 * configuration intact rather than a deployment with brands but no
 * organisation to point at them.
 */
export function seedProductConfiguration(): ProductSeedSummary {
  const sqlite = getSqlite();
  const counts: Record<string, number> = {};
  let total = 0;

  const write = sqlite.transaction(() => {
    const db = getDb();

    /*
     * Delete then insert, and only these eight tables. Order matters on the
     * way out only in the sense that the singleton goes first: if the
     * transaction were ever to be run against a schema with foreign keys
     * declared between these tables, clearing the pointer before its targets
     * is the order that works.
     */
    db.delete(activeProductConfig).run();
    db.delete(productConfigChanges).run();
    db.delete(functionPacks).run();
    db.delete(organisationProfiles).run();
    db.delete(deploymentProfiles).run();
    db.delete(entitlementProfiles).run();
    db.delete(terminologyProfiles).run();
    db.delete(brandProfiles).run();

    db.insert(brandProfiles).values(PRODUCT_BRAND_PROFILES).run();
    counts.brandProfiles = PRODUCT_BRAND_PROFILES.length;

    db.insert(terminologyProfiles).values(PRODUCT_TERMINOLOGY_PROFILES).run();
    counts.terminologyProfiles = PRODUCT_TERMINOLOGY_PROFILES.length;

    db.insert(entitlementProfiles).values(PRODUCT_ENTITLEMENT_PROFILES).run();
    counts.entitlementProfiles = PRODUCT_ENTITLEMENT_PROFILES.length;

    db.insert(deploymentProfiles).values(PRODUCT_DEPLOYMENT_PROFILES).run();
    counts.deploymentProfiles = PRODUCT_DEPLOYMENT_PROFILES.length;

    db.insert(organisationProfiles).values(PRODUCT_ORGANISATION_PROFILES).run();
    counts.organisationProfiles = PRODUCT_ORGANISATION_PROFILES.length;

    db.insert(functionPacks).values(PRODUCT_FUNCTION_PACKS).run();
    counts.functionPacks = PRODUCT_FUNCTION_PACKS.length;

    db.insert(productConfigChanges).values([PRODUCT_CONFIG_GENESIS_CHANGE]).run();
    counts.productConfigChanges = 1;

    db.insert(activeProductConfig).values([PRODUCT_ACTIVE_CONFIG]).run();
    counts.activeProductConfig = 1;

    for (const value of Object.values(counts)) total += value;
  });

  write();

  /*
   * The resolvers cache against the configuration version, and the seed writes
   * a fixed timestamp. A reseed inside a live process therefore produces the
   * same version key as before and would be served from a cache built against
   * the previous rows. Clearing explicitly is what makes `db:seed` take effect
   * without a restart.
   */
  resetProductConfigCaches();

  return { rowsWritten: total, tablesWritten: Object.keys(counts).length, counts };
}
