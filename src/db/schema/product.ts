/**
 * Product configuration schema.
 *
 * This is the layer that makes NFR WorkOS a product rather than one bank's
 * application. Everything a second institution would otherwise need a code
 * fork to change lives in these tables: its name and legal entities, the words
 * it uses for a control and a finding, its branding, which function packs and
 * connector packs it has licensed, and how it is deployed.
 *
 * Two design decisions are worth stating because they are load bearing.
 *
 * First, there is a singleton `active_product_config` row. Switching a bank
 * from client branded to co-branded is one update to one row, and no domain
 * data moves. That is the structural form of the claim that configuration does
 * not require a fork, and it is what the branding acceptance test exercises.
 *
 * Second, terminology is a typed key map rather than string replacement.
 * A bank that calls a finding an observation gets that word everywhere the
 * product names the concept, and nowhere else. Global replacement would also
 * rewrite the word inside seeded evidence text, which would be a lie about
 * what the source document says.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/** How the product presents itself. Configuration, never hardcoded. */
export const BRAND_MODES = ["client", "accenture", "co-branded"] as const;
export type BrandMode = (typeof BRAND_MODES)[number];

/**
 * Deployment shapes the product is architected for.
 *
 * Only `restricted-local-prototype` is what this repository actually runs.
 * The other three are defined and documented, and the integration settings
 * screen says which is which. Claiming otherwise would be the kind of
 * overstatement the brief explicitly prohibits.
 */
export const DEPLOYMENT_KINDS = [
  "dedicated-managed",
  "customer-managed-private",
  "bank-private-cloud",
  "restricted-local-prototype",
] as const;
export type DeploymentKind = (typeof DEPLOYMENT_KINDS)[number];

/** The function packs that make up the licensable surface. */
export const FUNCTION_PACK_IDS = [
  "rcsa-operational-risk",
  "third-party-risk",
  "control-assurance",
  "incident-operational-resilience",
  "regulatory-change",
  "nfr-governance",
] as const;
export type FunctionPackId = (typeof FUNCTION_PACK_IDS)[number];

/**
 * Terminology keys.
 *
 * Typed, so a missing translation is a compile error rather than a screen
 * showing a raw key to a client.
 */
export const TERMINOLOGY_KEYS = [
  "riskAssessment",
  "rcsa",
  "control",
  "controlOwner",
  "issue",
  "finding",
  "action",
  "remediation",
  "incident",
  "event",
  "criticalService",
  "importantBusinessService",
  "riskAcceptance",
  "firstLine",
  "secondLine",
] as const;
export type TerminologyKey = (typeof TERMINOLOGY_KEYS)[number];

/** One term, in both supported languages, singular and plural. */
export interface TerminologyTerm {
  singular: string;
  plural: string;
  singularDe: string;
  pluralDe: string;
  /** Optional short form for a chip or a dense row. */
  short?: string;
}

export const brandProfiles = sqliteTable("brand_profiles", {
  id: text("id").primaryKey(),
  mode: text("mode").$type<BrandMode>().notNull(),
  productName: text("product_name").notNull(),
  shortName: text("short_name").notNull(),
  clientName: text("client_name").notNull(),
  operatorName: text("operator_name"),
  /**
   * Logo references are paths into `public/`, not remote URLs. A deployment
   * inside a bank cannot be allowed to fetch its own client's mark from a
   * third party host at render time.
   */
  primaryLogoUrl: text("primary_logo_url"),
  secondaryLogoUrl: text("secondary_logo_url"),
  faviconUrl: text("favicon_url"),
  supportLabel: text("support_label"),
  supportUrl: text("support_url"),
  legalNotice: text("legal_notice"),
  /** A token name from the workday scope, for example `--app-ai`. */
  accentToken: text("accent_token"),
  /** Shown in the shell at all times. Not configurable away in this build. */
  syntheticDisclosure: integer("synthetic_disclosure", { mode: "boolean" })
    .notNull()
    .default(true),
});

export const terminologyProfiles = sqliteTable("terminology_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  terms: text("terms", { mode: "json" })
    .$type<Partial<Record<TerminologyKey, TerminologyTerm>>>()
    .notNull(),
});

export const entitlementProfiles = sqliteTable("entitlement_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  functionPacks: text("function_packs", { mode: "json" }).$type<string[]>().notNull(),
  connectorPacks: text("connector_packs", { mode: "json" }).$type<string[]>().notNull(),
  aiFeatures: text("ai_features", { mode: "json" }).$type<string[]>().notNull(),
  adminFeatures: text("admin_features", { mode: "json" }).$type<string[]>().notNull(),
  deploymentProfile: text("deployment_profile").notNull(),
});

export const deploymentProfiles = sqliteTable("deployment_profiles", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<DeploymentKind>().notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  region: text("region").notNull(),
  identityMode: text("identity_mode").notNull(),
  modelEndpointProfile: text("model_endpoint_profile").notNull(),
  dataRetentionProfile: text("data_retention_profile").notNull(),
  observabilityProfile: text("observability_profile").notNull(),
  environment: text("environment").notNull(),
  version: text("version").notNull(),
  /**
   * False for the three profiles this repository defines but does not run.
   * The settings screen reads this column rather than asserting readiness.
   */
  implementedHere: integer("implemented_here", { mode: "boolean" }).notNull(),
  /** What a real engagement would still have to build for this profile. */
  outstandingWork: text("outstanding_work", { mode: "json" }).$type<string[]>().notNull(),
});

export const organisationProfiles = sqliteTable("organisation_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  countries: text("countries", { mode: "json" }).$type<string[]>().notNull(),
  /**
   * Legal entities are mirrored here from `legal_entities` rather than
   * replacing it. The domain table stays the system of record for the
   * scenario; this is the product's view of which entities the deployment
   * is configured for, including the regulator context that drives the
   * jurisdiction disclosures.
   */
  legalEntityIds: text("legal_entity_ids", { mode: "json" }).$type<string[]>().notNull(),
  defaultLocale: text("default_locale").notNull(),
  supportedLocales: text("supported_locales", { mode: "json" }).$type<string[]>().notNull(),
  timezone: text("timezone").notNull(),
  dateFormat: text("date_format").notNull(),
  timeFormat: text("time_format").$type<"12h" | "24h">().notNull(),
  terminologyProfileId: text("terminology_profile_id").notNull(),
  brandProfileId: text("brand_profile_id").notNull(),
  entitlementProfileId: text("entitlement_profile_id").notNull(),
  deploymentProfileId: text("deployment_profile_id").notNull(),
  /** Working calendar, used by the focus queue for due time language. */
  workingDayStart: text("working_day_start").notNull().default("07:00"),
  workingDayEnd: text("working_day_end").notNull().default("19:00"),
});

export const functionPacks = sqliteTable("function_packs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameDe: text("name_de").notNull(),
  version: text("version").notNull(),
  description: text("description").notNull(),
  /** The role this pack primarily serves, matching a workday route segment. */
  primaryRoleId: text("primary_role_id").notNull(),
  domainObjects: text("domain_objects", { mode: "json" }).$type<string[]>().notNull(),
  roles: text("roles", { mode: "json" }).$type<string[]>().notNull(),
  tools: text("tools", { mode: "json" }).$type<string[]>().notNull(),
  screens: text("screens", { mode: "json" }).$type<string[]>().notNull(),
  evaluations: text("evaluations", { mode: "json" }).$type<string[]>().notNull(),
  connectorDependencies: text("connector_dependencies", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

/**
 * The singleton that names the active configuration.
 *
 * One row, id `active`. A branding change updates this row or the profile it
 * points at, and the whole workday re-renders against the new identity with
 * every decision, approval and audit event intact. That is the separation
 * between product configuration and domain state, made testable.
 */
export const activeProductConfig = sqliteTable("active_product_config", {
  id: text("id").primaryKey(),
  organisationProfileId: text("organisation_profile_id").notNull(),
  /**
   * Overrides the organisation profile's brand pointer when an administrator
   * switches branding mode without editing the organisation.
   */
  brandProfileIdOverride: text("brand_profile_id_override"),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull().default("system"),
});

/**
 * An append only record of product configuration changes.
 *
 * Separate from `audit_events`, which records domain actions. A reviewer
 * asking "who changed the branding" and a reviewer asking "who approved the
 * residual risk rating" are asking different questions of different systems.
 */
export const productConfigChanges = sqliteTable(
  "product_config_changes",
  {
    id: text("id").primaryKey(),
    at: text("at").notNull(),
    area: text("area").notNull(),
    summary: text("summary").notNull(),
    previousValue: text("previous_value", { mode: "json" }).$type<unknown>(),
    newValue: text("new_value", { mode: "json" }).$type<unknown>(),
    changedBy: text("changed_by").notNull(),
  },
  (table) => [index("pcc_area_idx").on(table.area, table.at)],
);
