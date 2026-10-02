/**
 * Integration schema.
 *
 * The product is a system of engagement. The bank's GRC platform, document
 * repository, process intelligence tool and collaboration suite remain systems
 * of record. These tables are what makes that relationship real rather than
 * decorative.
 *
 * Three guarantees are enforced structurally here, not by convention.
 *
 * 1. Source identity survives normalisation. `external_references` keeps the
 *    connector, the external type, the external identifier, the external
 *    version and the source timestamp for every object read from outside. A
 *    record that came from the GRC platform can always be opened there again.
 *
 * 2. Nothing external is reported as done before the target says so. An
 *    outbound change is a row in `integration_commands` that moves
 *    proposed, approved, queued, executing, acknowledged. The receipt in
 *    `external_execution_receipts` is written from the acknowledgement, so a
 *    receipt line cannot exist for a change the target never confirmed. This
 *    mirrors the guarantee the local mutation layer already makes.
 *
 * 3. Retry cannot duplicate. `idempotency_key` is unique, and a replay of the
 *    same approved command finds the existing row rather than creating a
 *    second external object.
 */

import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import type { AuthorityClass } from "./decisions";

/**
 * How honest a connector instance is about itself.
 *
 * This column exists because the alternative is a screen full of vendor names
 * implying integrations that do not exist. Every instance must declare one of
 * these, and the integration centre groups by it.
 */
export const CONNECTOR_MODES = [
  "live",
  "sandbox-ready",
  "simulated",
  "configured-unavailable",
  "planned",
] as const;
export type ConnectorMode = (typeof CONNECTOR_MODES)[number];

export const CONNECTOR_HEALTH_STATES = [
  "healthy",
  "degraded",
  "unavailable",
  "unconfigured",
  "not-implemented",
] as const;
export type ConnectorHealthState = (typeof CONNECTOR_HEALTH_STATES)[number];

/** Connector families, matching the documented connector packs. */
export const CONNECTOR_PACK_IDS = [
  "microsoft-365",
  "grc-irm",
  "service-management",
  "process-intelligence",
  "document-knowledge",
  "procurement-third-party",
  "data-platform",
  "identity-access",
  "regulatory-content",
  "generic-rest-webhook",
] as const;
export type ConnectorPackId = (typeof CONNECTOR_PACK_IDS)[number];

/** Freshness of a projected external record, shown beside the data. */
export const FRESHNESS_STATES = ["live", "fresh", "stale", "unknown"] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

/**
 * Outbound command lifecycle.
 *
 * `acknowledged` is the only terminal success state. There is deliberately no
 * state meaning "sent, probably fine".
 */
export const COMMAND_STATUSES = [
  "proposed",
  "awaiting-approval",
  "approved",
  "queued",
  "executing",
  "acknowledged",
  "failed",
  "dead-letter",
  "cancelled",
] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

/** How a source should win or lose when two systems disagree. */
export const CONFLICT_POLICIES = [
  "source-of-record-wins",
  "most-recent-wins",
  "escalate-to-human",
  "never-overwrite",
] as const;
export type ConflictPolicy = (typeof CONFLICT_POLICIES)[number];

export const connectorPacks = sqliteTable("connector_packs", {
  id: text("id").primaryKey(),
  family: text("family").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  /** Named adapters this family covers, for the documentation table. */
  namedAdapters: text("named_adapters", { mode: "json" }).$type<string[]>().notNull(),
});

export const connectorInstances = sqliteTable(
  "connector_instances",
  {
    id: text("id").primaryKey(),
    packId: text("pack_id").notNull(),
    /** The registry key the runtime resolves to an implementation. */
    connectorKey: text("connector_key").notNull(),
    displayName: text("display_name").notNull(),
    /** The label shown beside data, for example "GRC assessment". */
    sourceSystem: text("source_system").notNull(),
    mode: text("mode").$type<ConnectorMode>().notNull(),
    healthState: text("health_state").$type<ConnectorHealthState>().notNull(),
    healthMessage: text("health_message").notNull().default(""),
    capabilities: text("capabilities", { mode: "json" })
      .$type<{
        read: string[];
        search: string[];
        events: string[];
        draft: string[];
        write: string[];
        attachments: boolean;
        deepLinks: boolean;
        deltaSync: boolean;
        webhooks: boolean;
      }>()
      .notNull(),
    /**
     * A human readable endpoint label, never a credential and never a URL
     * carrying a token. The integration centre shows this; it has nothing
     * secret to leak.
     */
    endpointLabel: text("endpoint_label").notNull().default(""),
    /**
     * Whether a credential is present, as a state only. The value is never
     * stored here, never read into the browser and never logged.
     */
    secretStatus: text("secret_status")
      .$type<"not-required" | "absent" | "present" | "invalid">()
      .notNull(),
    writeEnabled: integer("write_enabled", { mode: "boolean" }).notNull().default(false),
    eventSubscriptionStatus: text("event_subscription_status")
      .$type<"none" | "webhook" | "delta-sync" | "polling" | "simulated">()
      .notNull(),
    lastSyncAt: text("last_sync_at"),
    lastSyncStatus: text("last_sync_status"),
    /**
     * A template with `{externalId}`, used to build the "Open in source
     * system" link. Null when the connector cannot deep link.
     */
    deepLinkTemplate: text("deep_link_template"),
    /** Which function packs stop working properly without this instance. */
    requiredByPacks: text("required_by_packs", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("ci_pack_idx").on(table.packId), index("ci_mode_idx").on(table.mode)],
);

export const sourceMappings = sqliteTable(
  "source_mappings",
  {
    id: text("id").primaryKey(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    externalType: text("external_type").notNull(),
    canonicalType: text("canonical_type").notNull(),
    fieldMappings: text("field_mappings", { mode: "json" })
      .$type<Array<{ externalField: string; canonicalField: string; transform?: string }>>()
      .notNull(),
    taxonomyMappings: text("taxonomy_mappings", { mode: "json" })
      .$type<Array<{ dimension: string; externalValue: string; canonicalValue: string }>>()
      .notNull(),
    conflictPolicy: text("conflict_policy").$type<ConflictPolicy>().notNull(),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    index("sm_connector_idx").on(table.connectorInstanceId),
    unique("sm_connector_type_unq").on(table.connectorInstanceId, table.externalType),
  ],
);

/**
 * The identity of an object in the system that owns it.
 *
 * Keyed on the connector plus the external type plus the external identifier,
 * so re-reading the same record updates one row rather than accumulating
 * duplicates.
 */
export const externalReferences = sqliteTable(
  "external_references",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    sourceSystem: text("source_system").notNull(),
    externalType: text("external_type").notNull(),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url"),
    externalVersion: text("external_version"),
    sourceUpdatedAt: text("source_updated_at"),
    syncedAt: text("synced_at").notNull(),
    freshnessStatus: text("freshness_status").$type<FreshnessState>().notNull(),
    /** The canonical object this external record projects onto. */
    canonicalType: text("canonical_type").notNull(),
    canonicalId: text("canonical_id").notNull(),
    /** True when two sources disagree about this object. */
    conflicted: integer("conflicted", { mode: "boolean" }).notNull().default(false),
    conflictNote: text("conflict_note").notNull().default(""),
  },
  (table) => [
    unique("er_identity_unq").on(table.connectorInstanceId, table.externalType, table.externalId),
    index("er_canonical_idx").on(table.canonicalType, table.canonicalId),
    index("er_run_idx").on(table.runId),
  ],
);

/**
 * Inbound and outbound integration events.
 *
 * `eventKey` is the deduplication key. A webhook that fires twice, or a delta
 * sync that returns a record it already returned, produces one row.
 */
export const integrationEvents = sqliteTable(
  "integration_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    direction: text("direction").$type<"inbound" | "outbound">().notNull(),
    /** Stable key derived from the source event identity. Deduplicates. */
    eventKey: text("event_key").notNull(),
    externalEventId: text("external_event_id"),
    eventType: text("event_type").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    canonicalType: text("canonical_type").notNull().default(""),
    canonicalId: text("canonical_id").notNull().default(""),
    externalReferenceId: text("external_reference_id"),
    summary: text("summary").notNull(),
    severity: text("severity").notNull().default("informational"),
    receivedAt: text("received_at").notNull(),
    /** Scenario clock time, so the live day can place it on the track. */
    atMoment: text("at_moment").notNull(),
    processedAt: text("processed_at"),
    status: text("status")
      .$type<"received" | "deduplicated" | "mapped" | "published" | "rejected" | "failed">()
      .notNull(),
    rejectionReason: text("rejection_reason").notNull().default(""),
    correlationId: text("correlation_id").notNull(),
    traceId: text("trace_id").notNull(),
    /** The live workday event this produced, when it produced one. */
    liveEventId: text("live_event_id"),
  },
  (table) => [
    unique("ie_event_key_unq").on(table.connectorInstanceId, table.eventKey),
    index("ie_run_direction_idx").on(table.runId, table.direction),
    index("ie_moment_idx").on(table.runId, table.atMoment),
  ],
);

/**
 * The outbox. One row per external change the product intends to make.
 *
 * Every row carries the authority decision that permitted it and the approval
 * that authorised it, because an external write is the highest consequence
 * action the product can take and the reviewer asking "who allowed this"
 * should not have to join three tables to find out.
 */
export const integrationCommands = sqliteTable(
  "integration_commands",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    commandKind: text("command_kind").notNull(),
    /** Unique. This is what makes retry safe. */
    idempotencyKey: text("idempotency_key").notNull(),
    /* ---- who and under what authority ---- */
    actingUserId: text("acting_user_id").notNull(),
    roleId: text("role_id").notNull(),
    actorKind: text("actor_kind").notNull(),
    authorityClass: text("authority_class").$type<AuthorityClass>().notNull(),
    approvalId: text("approval_id"),
    decisionId: text("decision_id"),
    toolName: text("tool_name").notNull().default(""),
    /* ---- what, where ---- */
    sourceCanonicalType: text("source_canonical_type").notNull().default(""),
    sourceCanonicalId: text("source_canonical_id").notNull().default(""),
    targetExternalType: text("target_external_type").notNull(),
    targetExternalId: text("target_external_id"),
    expectedVersion: text("expected_version"),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    payloadDigest: text("payload_digest").notNull(),
    /** Plain language, shown to the user before approval. */
    intentStatement: text("intent_statement").notNull(),
    /* ---- lifecycle ---- */
    status: text("status").$type<CommandStatus>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextAttemptAt: text("next_attempt_at"),
    lastError: text("last_error").notNull().default(""),
    correlationId: text("correlation_id").notNull(),
    traceId: text("trace_id").notNull(),
    atMoment: text("at_moment").notNull(),
    createdAt: text("created_at").notNull(),
    queuedAt: text("queued_at"),
    executedAt: text("executed_at"),
    acknowledgedAt: text("acknowledged_at"),
    /** Ordering within one decision, so receipts read in a sensible order. */
    sequence: integer("sequence").notNull().default(0),
  },
  (table) => [
    unique("ic_idempotency_unq").on(table.idempotencyKey),
    index("ic_run_status_idx").on(table.runId, table.status),
    index("ic_decision_idx").on(table.decisionId),
    index("ic_connector_idx").on(table.connectorInstanceId),
  ],
);

/**
 * What the target system actually confirmed.
 *
 * Written from an acknowledgement. A row here means an external system
 * returned a reference for a change it accepted.
 */
export const externalExecutionReceipts = sqliteTable(
  "external_execution_receipts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    commandId: text("command_id").notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    targetSystem: text("target_system").notNull(),
    externalType: text("external_type").notNull(),
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url"),
    externalVersion: text("external_version"),
    /** The line as shown in the receipt, already in plain language. */
    statement: text("statement").notNull(),
    statementDe: text("statement_de").notNull().default(""),
    status: text("status")
      .$type<"acknowledged" | "partial" | "queued" | "failed" | "dead-letter">()
      .notNull(),
    statusDetail: text("status_detail").notNull().default(""),
    retryState: text("retry_state").notNull().default(""),
    attempts: integer("attempts").notNull().default(1),
    completedAt: text("completed_at"),
    atMoment: text("at_moment").notNull(),
    /** Links the receipt line to the audit event that recorded it. */
    auditEventId: text("audit_event_id"),
    decisionId: text("decision_id"),
    sequence: integer("sequence").notNull().default(0),
  },
  (table) => [
    index("eer_command_idx").on(table.commandId),
    index("eer_decision_idx").on(table.decisionId),
    index("eer_run_idx").on(table.runId, table.sequence),
  ],
);

export const connectorSyncState = sqliteTable(
  "connector_sync_state",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    objectType: text("object_type").notNull(),
    lastCursor: text("last_cursor"),
    lastSyncAt: text("last_sync_at"),
    lastSyncStatus: text("last_sync_status").notNull().default("never-run"),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsChanged: integer("records_changed").notNull().default(0),
    recordsConflicted: integer("records_conflicted").notNull().default(0),
    /** Minutes after which data from this source is shown as stale. */
    stalenessThresholdMinutes: integer("staleness_threshold_minutes").notNull().default(120),
  },
  (table) => [
    unique("css_instance_type_unq").on(table.connectorInstanceId, table.objectType),
    index("css_run_idx").on(table.runId),
  ],
);

/**
 * Commands that exhausted their retries.
 *
 * A dead letter row never deletes the command or the approval behind it. The
 * human decision is preserved and remains visible; what failed is the delivery
 * of its consequence to one external system.
 */
export const deadLetterEntries = sqliteTable(
  "dead_letter_entries",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    commandId: text("command_id").notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    reason: text("reason").notNull(),
    lastError: text("last_error").notNull().default(""),
    attempts: integer("attempts").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    enteredAt: text("entered_at").notNull(),
    atMoment: text("at_moment").notNull(),
    resolvedAt: text("resolved_at"),
    resolution: text("resolution").notNull().default(""),
    /** True while an operator may retry it from the integration centre. */
    retryable: integer("retryable", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    unique("dle_command_unq").on(table.commandId),
    index("dle_run_idx").on(table.runId),
  ],
);

/**
 * Which sources a given piece of work depends on, and how badly.
 *
 * The AI must not produce a final recommendation while a required source is
 * still loading or unavailable. That rule needs somewhere to read the
 * classification from, and this is it.
 */
export const sourceRequirements = sqliteTable(
  "source_requirements",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    /** The work context, for example a decision or a canonical object. */
    contextType: text("context_type").notNull(),
    contextId: text("context_id").notNull(),
    connectorInstanceId: text("connector_instance_id").notNull(),
    objectType: text("object_type").notNull(),
    necessity: text("necessity").$type<"required" | "helpful" | "optional">().notNull(),
    rationale: text("rationale").notNull().default(""),
  },
  (table) => [
    index("sr_context_idx").on(table.contextType, table.contextId),
    unique("sr_unq").on(table.contextType, table.contextId, table.connectorInstanceId, table.objectType),
  ],
);
