/**
 * Domain schema: the objects the bank actually manages.
 *
 * Suppliers and services are shared between Third-Party Risk Management and
 * Operational Resilience. Processes, risks and controls are shared between the
 * Operational Risk Partner and Control Assurance. There is one row per real
 * object, so a rating change in one view is visible in every other view.
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    name: text("name").notNull(),
    legalForm: text("legal_form").notNull(),
    domicile: text("domicile").notNull(),
    /** "critical", "important" or "standard", as currently recorded. */
    criticality: text("criticality").notNull(),
    /** True when the arrangement is a regulated outsourcing (Auslagerung). */
    isOutsourcing: integer("is_outsourcing", { mode: "boolean" }).notNull(),
    /** Contracting entity identifiers. A supplier may serve several entities. */
    contractingEntityIds: text("contracting_entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** "active", "under-reassessment", "exit-planned". */
    status: text("status").notNull(),
    lastAssessmentDate: text("last_assessment_date"),
    nextAssessmentDue: text("next_assessment_due"),
    /** Aggregate annual spend, in the contracting entity currency. */
    annualSpend: integer("annual_spend"),
    spendCurrency: text("spend_currency"),
    relationshipOwnerUserId: text("relationship_owner_user_id"),
    description: text("description").notNull(),
    /** Concentration note: other places this supplier appears in the group. */
    concentrationNote: text("concentration_note").notNull().default(""),
  },
  (table) => [index("suppliers_run_idx").on(table.runId)],
);

/**
 * A fourth party: a subprocessor engaged by a supplier. The contract appendix
 * and the current submitted list do not fully align, which is one of the
 * scenario's open gaps.
 */
export const subprocessors = sqliteTable(
  "subprocessors",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    supplierId: text("supplier_id").notNull(),
    name: text("name").notNull(),
    domicile: text("domicile").notNull(),
    /** Whether data leaves the European Economic Area. */
    dataLocation: text("data_location").notNull(),
    functionProvided: text("function_provided").notNull(),
    /**
     * "contract-appendix", "supplier-submission", "both", or "neither".
     *
     * "neither" is not an oversight. A fourth party engaged by a subprocessor
     * can be absent from both records because the contractual appendix, as
     * drafted, does not reach a subprocessor's own subcontractors. Recording
     * that honestly is the point: the drafting gap is the finding.
     */
    declaredIn: text("declared_in").notNull(),
    /** True when this entry is the appendix and submission mismatch. */
    isDiscrepancy: integer("is_discrepancy", { mode: "boolean" }).notNull().default(false),
    discrepancyNote: text("discrepancy_note").notNull().default(""),
    /** True when this subprocessor supports a critical function. */
    supportsCriticalFunction: integer("supports_critical_function", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => [index("subproc_supplier_idx").on(table.runId, table.supplierId)],
);

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    name: text("name").notNull(),
    nameDe: text("name_de").notNull(),
    /** True for an important business service under resilience rules. */
    isImportantBusinessService: integer("is_important_business_service", { mode: "boolean" }).notNull(),
    entityIds: text("entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    ownerUserId: text("owner_user_id"),
    /** "payments", "retail", "corporate", "technology" or "shared". */
    domain: text("domain").notNull(),
    description: text("description").notNull(),
    /** Supplier identifiers this service depends on. */
    supplierIds: text("supplier_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** Current operational status: "normal", "degraded", "fallback", "impaired". */
    operationalStatus: text("operational_status").notNull().default("normal"),
  },
  (table) => [index("services_run_idx").on(table.runId)],
);

/**
 * Directed dependency edges between services, suppliers and systems. This is
 * the data behind the service dependency map with the live event pulse.
 */
export const serviceDependencies = sqliteTable(
  "service_dependencies",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** "service", "supplier", "subprocessor" or "system". */
    fromKind: text("from_kind").notNull(),
    fromId: text("from_id").notNull(),
    toKind: text("to_kind").notNull(),
    toId: text("to_id").notNull(),
    /** "critical", "important" or "supporting". */
    dependencyStrength: text("dependency_strength").notNull(),
    /** True when no substitutable alternative is currently available. */
    singlePointOfFailure: integer("single_point_of_failure", { mode: "boolean" })
      .notNull()
      .default(false),
    /** True when this edge carries the 14:05 degradation. */
    affectedByEvent: integer("affected_by_event", { mode: "boolean" }).notNull().default(false),
    note: text("note").notNull().default(""),
  },
  (table) => [index("svcdep_run_idx").on(table.runId, table.fromId)],
);

/** Impact tolerances for important business services. */
export const impactTolerances = sqliteTable(
  "impact_tolerances",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    serviceId: text("service_id").notNull(),
    /**
     * The scope the board approved the tolerance for.
     *
     * This is a scope label rather than a single foreign key, because a board
     * can approve one tolerance covering two entities or the whole group. It
     * therefore holds values such as "ARC-DE", "ARC-DE, ARC-AT" or "group".
     * Use `toleranceAppliesToEntity` rather than an equality comparison.
     */
    entityId: text("entity_id").notNull(),
    /** For example "Maximum tolerable disruption". */
    metric: text("metric").notNull(),
    /** Threshold in minutes, for duration based tolerances. */
    thresholdMinutes: integer("threshold_minutes"),
    /** Threshold as a volume, for throughput based tolerances. */
    thresholdVolume: integer("threshold_volume"),
    unit: text("unit").notNull(),
    /** Board approved statement of the tolerance. */
    statement: text("statement").notNull(),
    /** Minutes consumed at the current timeline moment. Updated by the engine. */
    consumedMinutes: integer("consumed_minutes").notNull().default(0),
    approvedBy: text("approved_by").notNull(),
    approvedOn: text("approved_on").notNull(),
  },
  (table) => [index("tol_service_idx").on(table.runId, table.serviceId)],
);

export const contracts = sqliteTable(
  "contracts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    supplierId: text("supplier_id").notNull(),
    entityId: text("entity_id").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    /** "framework", "service-schedule", "appendix" or "amendment". */
    documentType: text("document_type").notNull(),
    noticePeriodDays: integer("notice_period_days"),
    /** True when audit and access rights are contractually secured. */
    auditRightsSecured: integer("audit_rights_secured", { mode: "boolean" }).notNull().default(false),
    subprocessorConsentModel: text("subprocessor_consent_model").notNull().default(""),
    evidenceDocumentId: text("evidence_document_id"),
    summary: text("summary").notNull(),
  },
  (table) => [index("contracts_supplier_idx").on(table.runId, table.supplierId)],
);

/** Individual contractual obligations that TPRM can test a supplier against. */
export const contractObligations = sqliteTable(
  "contract_obligations",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    contractId: text("contract_id").notNull(),
    clauseReference: text("clause_reference").notNull(),
    obligationText: text("obligation_text").notNull(),
    /** "resilience", "subprocessor", "audit", "reporting", "exit", "security". */
    category: text("category").notNull(),
    /** "met", "partially-met", "not-evidenced" or "breached". */
    evidenceStatus: text("evidence_status").notNull(),
    evidenceDocumentIds: text("evidence_document_ids", { mode: "json" }).$type<string[]>().notNull(),
    note: text("note").notNull().default(""),
  },
  (table) => [index("contr_obl_idx").on(table.runId, table.contractId)],
);

export const processes = sqliteTable(
  "processes",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    name: text("name").notNull(),
    nameDe: text("name_de").notNull(),
    /** Hierarchical code, for example "PAY.03.02". */
    code: text("code").notNull(),
    parentProcessId: text("parent_process_id"),
    serviceId: text("service_id"),
    entityIds: text("entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    description: text("description").notNull(),
    /** Monthly volume from the process intelligence platform. */
    monthlyVolume: integer("monthly_volume"),
    /** Percentage of cases requiring manual intervention. */
    manualTouchRate: real("manual_touch_rate"),
    /** Narrative of what changed in the last month. */
    recentChangeNote: text("recent_change_note").notNull().default(""),
  },
  (table) => [index("processes_run_idx").on(table.runId)],
);

export const risks = sqliteTable(
  "risks",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull(),
    /** Level one risk taxonomy category. */
    taxonomyL1: text("taxonomy_l1").notNull(),
    taxonomyL2: text("taxonomy_l2").notNull(),
    processIds: text("process_ids", { mode: "json" }).$type<string[]>().notNull(),
    entityIds: text("entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    description: text("description").notNull(),
    /** Inherent position, on the group five by five scale. */
    inherentLikelihood: integer("inherent_likelihood").notNull(),
    inherentImpact: integer("inherent_impact").notNull(),
    /** The risk appetite statement that applies. */
    appetiteStatement: text("appetite_statement").notNull().default(""),
    /** "within", "at-limit" or "outside". Current recorded position. */
    appetitePosition: text("appetite_position").notNull().default("within"),
  },
  (table) => [index("risks_run_idx").on(table.runId)],
);

export const controls = sqliteTable(
  "controls",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    titleDe: text("title_de").notNull(),
    description: text("description").notNull(),
    riskIds: text("risk_ids", { mode: "json" }).$type<string[]>().notNull(),
    processIds: text("process_ids", { mode: "json" }).$type<string[]>().notNull(),
    entityIds: text("entity_ids", { mode: "json" }).$type<string[]>().notNull(),
    /** First line control owner. */
    ownerUserId: text("owner_user_id").notNull(),
    /** "preventive" or "detective". */
    nature: text("nature").notNull(),
    /** "manual", "automated" or "it-dependent-manual". */
    automation: text("automation").notNull(),
    frequency: text("frequency").notNull(),
    /** Whether the control is designated a key control. */
    isKeyControl: integer("is_key_control", { mode: "boolean" }).notNull(),
    /**
     * Current recorded effectiveness. This is the field the Operational Risk
     * Partner changes, and the change propagates to every other view.
     */
    currentEffectiveness: text("current_effectiveness").notNull(),
    effectivenessSetBy: text("effectiveness_set_by").notNull().default("seed"),
    effectivenessSetAt: text("effectiveness_set_at"),
    /** The first line owner's own assessment, which may differ from second line. */
    firstLineEffectiveness: text("first_line_effectiveness").notNull(),
    lastTestedOn: text("last_tested_on"),
    designNote: text("design_note").notNull().default(""),
  },
  (table) => [index("controls_run_idx").on(table.runId)],
);

export const kris = sqliteTable(
  "kris",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    reference: text("reference").notNull(),
    name: text("name").notNull(),
    nameDe: text("name_de").notNull(),
    riskIds: text("risk_ids", { mode: "json" }).$type<string[]>().notNull(),
    processIds: text("process_ids", { mode: "json" }).$type<string[]>().notNull(),
    entityId: text("entity_id").notNull(),
    unit: text("unit").notNull(),
    /** Direction in which the indicator is adverse: "up" or "down". */
    adverseDirection: text("adverse_direction").notNull(),
    amberThreshold: real("amber_threshold").notNull(),
    redThreshold: real("red_threshold").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    definition: text("definition").notNull(),
    /** "green", "amber" or "red" at the current moment. */
    currentStatus: text("current_status").notNull(),
    currentValue: real("current_value").notNull(),
  },
  (table) => [index("kris_run_idx").on(table.runId)],
);

/** Monthly indicator history, used for the trend views. */
export const kriReadings = sqliteTable(
  "kri_readings",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    kriId: text("kri_id").notNull(),
    /** Period label, for example "2026-08". */
    period: text("period").notNull(),
    periodEnd: text("period_end").notNull(),
    value: real("value").notNull(),
    status: text("status").notNull(),
    commentary: text("commentary").notNull().default(""),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("kri_read_idx").on(table.runId, table.kriId, table.sortOrder)],
);
