/**
 * The connector contract.
 *
 * One interface, eight members, and the rule that makes the whole thing
 * governable: a connector declares what it can do, and the runtime refuses
 * everything else. The refusal happens in `IntegrationRuntime`, before the
 * connector is called at all.
 *
 * That placement is the important design decision. If each connector checked
 * its own capabilities, then a connector with a bug, or a connector written
 * later by someone who did not read this file, would be the only thing
 * standing between an undeclared write capability and the bank's system of
 * record. Moving the check up means a new connector cannot grant itself an
 * operation by forgetting to refuse it, and it means the refusal is testable
 * once rather than once per adapter.
 *
 * Nothing in this module reaches a database, a network or an environment
 * variable. It is types and two pure helpers, so it is importable from a
 * client component, a route handler and a test.
 */

import type { ConnectorHealthState, ConnectorMode, ConnectorPackId } from "@/db/schema/integration";
import type { AuthorityClass } from "@/db/schema/decisions";
import type { CanonicalType } from "@/workday/contracts";
import type { ConnectorContext } from "./ConnectorContext";

/* ==========================================================================
   Metadata and capabilities
   ========================================================================== */

/**
 * What a connector says about itself.
 *
 * `mode` is the honesty column. Every instance declares exactly one of the
 * five modes, and the integration centre groups by it, so a vendor name can
 * never appear on screen implying an integration that does not exist.
 */
export interface ConnectorMetadata {
  /** Registry key. The instance row stores this and the registry resolves it. */
  key: string;
  packId: ConnectorPackId;
  displayName: string;
  /** The label shown beside data, for example "GRC assessment". */
  sourceSystem: string;
  /** The product family, named honestly. Never a vendor claim. */
  vendorLabel: string;
  mode: ConnectorMode;
  /** Readable endpoint description. Never a URL carrying a token. */
  endpointLabel: string;
  /** Template with `{externalId}`, or null when deep linking is impossible. */
  deepLinkTemplate: string | null;
  /** False for every simulated connector. The local experience needs no key. */
  requiresCredential: boolean;
  /** One sentence a reviewer can read to understand the honest status. */
  readinessNote: string;
}

/**
 * The declared surface of a connector.
 *
 * The five arrays hold object type names. An empty array means the connector
 * cannot do that at all, which is the common and correct case: most of the
 * connectors in this build are read only, and `write: []` is how they say so.
 */
export interface ConnectorCapabilities {
  /** Object types this connector can fetch by identifier. */
  read: string[];
  /** Object types this connector can search. */
  search: string[];
  /** Event types this connector can deliver inbound. */
  events: string[];
  /** Object types this connector can prepare a draft against. */
  draft: string[];
  /** Object types this connector can change. The highest consequence list. */
  write: string[];
  attachments: boolean;
  deepLinks: boolean;
  deltaSync: boolean;
  webhooks: boolean;
}

/** An empty capability set. New connectors start here and opt in. */
export const NO_CAPABILITIES: ConnectorCapabilities = Object.freeze({
  read: [],
  search: [],
  events: [],
  draft: [],
  write: [],
  attachments: false,
  deepLinks: false,
  deltaSync: false,
  webhooks: false,
});

/** The operations the runtime gates. */
export const CONNECTOR_OPERATIONS = ["read", "search", "events", "draft", "write", "sync"] as const;
export type ConnectorOperation = (typeof CONNECTOR_OPERATIONS)[number];

/**
 * True when the capability set permits this operation on this object type.
 *
 * `sync` maps onto `read` plus the `deltaSync` flag, because a connector that
 * can fetch an object but has no change feed cannot be asked for a delta. An
 * earlier draft treated sync as its own array and the result was two lists
 * that silently disagreed about the same object type.
 */
export function declaresCapability(
  capabilities: ConnectorCapabilities,
  operation: ConnectorOperation,
  objectType: string,
): boolean {
  switch (operation) {
    case "read":
      return capabilities.read.includes(objectType);
    case "search":
      return capabilities.search.includes(objectType);
    case "events":
      return capabilities.events.includes(objectType);
    case "draft":
      return capabilities.draft.includes(objectType);
    case "write":
      return capabilities.write.includes(objectType);
    case "sync":
      return capabilities.deltaSync && capabilities.read.includes(objectType);
  }
}

/** Counts declared operations, for the integration centre summary line. */
export function capabilityCount(capabilities: ConnectorCapabilities): number {
  return (
    capabilities.read.length +
    capabilities.search.length +
    capabilities.events.length +
    capabilities.draft.length +
    capabilities.write.length
  );
}

/* ==========================================================================
   Health
   ========================================================================== */

export interface ConnectorHealth {
  state: ConnectorHealthState;
  /** Plain language. Shown in the integration centre verbatim. */
  message: string;
  checkedAt: string;
  /** Null when the connector has never synced. */
  lastSuccessfulSyncAt: string | null;
  /**
   * Whether a credential is present, as a state only. The value itself is
   * never held in this object, never returned to the browser and never
   * logged, which is why the type is a union of four words.
   */
  secretStatus: "not-required" | "absent" | "present" | "invalid";
}

/* ==========================================================================
   Reading
   ========================================================================== */

/**
 * One record as the source system holds it.
 *
 * `fields` is the mapped-ready projection, already flattened by the
 * connector. `canonicalType` and `canonicalId` are the connector's proposal
 * for where this record lands; the mapper may override them from
 * `source_mappings`, which is why they are a proposal and not a decision.
 */
export interface ExternalRecord {
  externalType: string;
  externalId: string;
  externalUrl: string | null;
  /** ETag, row version or change token. Null when the source has none. */
  externalVersion: string | null;
  /** When the source system last changed it. Drives freshness. */
  sourceUpdatedAt: string | null;
  canonicalType: CanonicalType;
  canonicalId: string;
  /** Short display label. Safe to render. */
  title: string;
  /** One line of plain language. Safe to render. */
  summary: string;
  fields: Record<string, unknown>;
}

export interface ConnectorReadResult {
  record: ExternalRecord | null;
  /** Milliseconds the source took. Real, not simulated upward. */
  durationMs: number;
}

export interface ConnectorSearchResult {
  records: ExternalRecord[];
  /** True when the source has more than this page. */
  hasMore: boolean;
  durationMs: number;
}

export interface ConnectorSyncRequest {
  objectType: string;
  /** Opaque cursor from the previous sync. Null for a full read. */
  cursor: string | null;
  limit: number;
}

export interface ConnectorSyncResult {
  records: ExternalRecord[];
  /** Cursor to persist. Null when the source has no change feed. */
  cursor: string | null;
  hasMore: boolean;
  /** Records the source offered, which may exceed those returned. */
  recordsSeen: number;
  durationMs: number;
}

/* ==========================================================================
   Writing
   ========================================================================== */

/**
 * The outbound command envelope.
 *
 * Everything the brief requires on an external change travels here, which is
 * why this interface is long. The alternative, passing a payload and letting
 * each connector reconstruct who authorised it, is how an audit trail ends up
 * with an external write nobody can attribute.
 *
 * `approvalId` is null only for a command whose authority class genuinely does
 * not require approval. The dispatcher, not the connector, decides that, and
 * it decides it by calling the same `evaluateAuthority` the local mutation
 * path calls.
 */
export interface OutboundCommandEnvelope {
  commandId: string;
  /** Unique in `integration_commands`. A replay finds the row, not a second object. */
  idempotencyKey: string;
  commandKind: string;
  /* ---- who, and under what authority ---- */
  actingUserId: string;
  roleId: string;
  actorKind: string;
  authorityClass: AuthorityClass;
  /** The gate's fingerprint over the payload. Binds approval to this change. */
  payloadFingerprint: string;
  approvalId: string | null;
  decisionId: string | null;
  toolName: string;
  /* ---- source and target ---- */
  sourceCanonicalType: string;
  sourceCanonicalId: string;
  targetExternalType: string;
  targetExternalId: string | null;
  /** Optimistic concurrency token, where the connector supports one. */
  expectedVersion: string | null;
  payload: Record<string, unknown>;
  /** Plain language, shown to the approver before they approve. */
  intentStatement: string;
  /* ---- tracing ---- */
  correlationId: string;
  traceId: string;
  atMoment: string;
  attempt: number;
}

/**
 * What a target system confirmed.
 *
 * A connector returns this only when the target accepted the change and
 * returned a reference for it. Anything else is a thrown `ConnectorError`.
 * There is deliberately no "probably fine" shape: the receipt writer accepts
 * only this object, so an unacknowledged write cannot produce a receipt line.
 */
export interface ConnectorAcknowledgement {
  externalType: string;
  externalId: string;
  externalUrl: string | null;
  externalVersion: string | null;
  /** The receipt line, already in plain language. */
  statement: string;
  statementDe: string;
  /**
   * `partial` when the target accepted some of the change and declined the
   * rest. The receipt says so, and the command does not count as complete.
   */
  outcome: "acknowledged" | "partial";
  /** What was not applied, when the outcome is partial. */
  notApplied: string[];
  acknowledgedAt: string;
  durationMs: number;
}

/* ==========================================================================
   Subscriptions
   ========================================================================== */

export interface ConnectorSubscription {
  /** "webhook", "delta-sync", "polling" or "simulated". */
  mechanism: "none" | "webhook" | "delta-sync" | "polling" | "simulated";
  eventTypes: string[];
  /** Readable, never a URL carrying a token. */
  endpointLabel: string;
  active: boolean;
  note: string;
}

/* ==========================================================================
   The interface
   ========================================================================== */

/**
 * A connector.
 *
 * `subscribe` is optional because a document repository that supports neither
 * webhooks nor a change feed has nothing honest to return, and an optional
 * member says that more clearly than a method that returns `mechanism: "none"`
 * forever.
 */
export interface Connector {
  metadata(): ConnectorMetadata;
  health(context: ConnectorContext): Promise<ConnectorHealth>;
  capabilities(): ConnectorCapabilities;
  search(
    query: string,
    options: { objectType: string; limit: number },
    context: ConnectorContext,
  ): Promise<ConnectorSearchResult>;
  read(
    objectType: string,
    externalId: string,
    context: ConnectorContext,
  ): Promise<ConnectorReadResult>;
  sync(request: ConnectorSyncRequest, context: ConnectorContext): Promise<ConnectorSyncResult>;
  execute(
    envelope: OutboundCommandEnvelope,
    context: ConnectorContext,
  ): Promise<ConnectorAcknowledgement>;
  subscribe?(context: ConnectorContext): Promise<ConnectorSubscription>;
}

/** The instance row a factory receives. Narrowed to what a connector may see. */
export interface ConnectorInstanceView {
  id: string;
  packId: string;
  connectorKey: string;
  displayName: string;
  sourceSystem: string;
  mode: ConnectorMode;
  healthState: ConnectorHealthState;
  healthMessage: string;
  capabilities: ConnectorCapabilities;
  endpointLabel: string;
  secretStatus: "not-required" | "absent" | "present" | "invalid";
  writeEnabled: boolean;
  eventSubscriptionStatus: "none" | "webhook" | "delta-sync" | "polling" | "simulated";
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  deepLinkTemplate: string | null;
  requiredByPacks: string[];
}

/** A connector factory. Receives the instance row, returns an implementation. */
export type ConnectorFactory = (instance: ConnectorInstanceView) => Connector;
