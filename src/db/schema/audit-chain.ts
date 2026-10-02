/**
 * Audit hash chain schema.
 *
 * A parallel table to audit_events that builds a tamper-evident hash chain over
 * every recorded event. Each record stores the SHA-256 hash of the previous
 * record's hash concatenated with the canonical JSON of the current event,
 * creating a chain where any modification to a record breaks all subsequent
 * hashes.
 *
 * The chain can be verified at any time with:
 *   npm run audit:verify-chain
 *
 * Protection boundary: tamper-evident within the application and database
 * boundary. A machine administrator with direct database access can still
 * replace the database file outside the application boundary.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const auditChainRecords = sqliteTable(
  "audit_chain_records",
  {
    /** Stable identifier: ACR-{sequence}-{timestamp-ms}. */
    id: text("id").primaryKey(),
    /** The scenario run this record belongs to. */
    runId: text("run_id").notNull(),
    /** Monotonically increasing position in the chain, starting at 1. */
    sequence: integer("sequence").notNull(),
    /**
     * Logical scope of the chain, for example "org-arcadia-demo".
     * All records in one chain share the same scope.
     */
    chainScope: text("chain_scope").notNull(),
    /** Foreign key reference to the source audit_events row. */
    auditEventId: text("audit_event_id").notNull(),
    /** The action field from the audit event, for example "updateControlRating". */
    eventKind: text("event_kind").notNull(),
    /**
     * Deterministic JSON representation of the fields that were hashed.
     * Keys are sorted; no mutable presentation fields are included.
     */
    canonicalPayload: text("canonical_payload").notNull(),
    /**
     * The eventHash of the previous record, or GENESIS_HASH for sequence 1.
     * Storing it here makes the chain self-describing: a verifier does not need
     * to load the previous record to check the current one.
     */
    previousHash: text("previous_hash").notNull(),
    /** SHA-256(previousHash + canonicalPayload), hex-encoded, lowercase. */
    eventHash: text("event_hash").notNull(),
    /** Hash algorithm identifier stored alongside the hash. Always "sha256". */
    hashAlgorithm: text("hash_algorithm").notNull().default("sha256"),
    /** ISO-8601 wall clock time this record was created. */
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("acr_scope_seq_idx").on(table.chainScope, table.sequence),
    index("acr_audit_event_idx").on(table.auditEventId),
    index("acr_run_idx").on(table.runId),
  ],
);
