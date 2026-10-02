/**
 * Audit hash chain service.
 *
 * Builds a tamper-evident chain over audit events. Every time an audit event
 * is appended to the log, a corresponding chain record is created that hashes
 * the event's canonical representation together with the previous record's
 * hash. Any later modification to a chain record breaks all subsequent hashes,
 * which the verifier detects.
 *
 * Hash algorithm: SHA-256 from the Node.js built-in crypto module.
 * No external dependencies.
 *
 * Protection boundary: tamper-evident within the application and database
 * boundary. A machine administrator with direct database access can replace the
 * database file outside the application boundary. This is not equivalent to
 * cryptographic non-repudiation.
 */

import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditChainRecords } from "@/db/schema/audit-chain";

/**
 * The fixed hash value used as the "previous hash" for the first record.
 * Its prefix makes it recognisable in logs and exports.
 */
export const GENESIS_HASH =
  "GENESIS-0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Logical chain scope, scoped to a single demo organisation by default.
 * Override with the AUDIT_CHAIN_SCOPE environment variable.
 */
export const CHAIN_SCOPE = process.env.AUDIT_CHAIN_SCOPE ?? "org-arcadia-demo";

export const HASH_ALGORITHM = "sha256";

/* --------------------------------------------------------------------------
   Canonical payload
   -------------------------------------------------------------------------- */

export interface CanonicalEventInput {
  sequence: number;
  chainScope: string;
  eventKind: string;
  auditEventId: string;
  actorKind: string;
  actorId: string | null;
  at: string;
}

/**
 * Produces the deterministic JSON string that is hashed for a chain record.
 *
 * Keys are fixed in alphabetical order. No mutable presentation fields
 * (summaries, labels, display text) are included, because those can be updated
 * by a user without affecting the action that was taken, and including them
 * would make every cosmetic edit break the chain.
 */
export function canonicalize(event: CanonicalEventInput): string {
  return JSON.stringify({
    algorithm: HASH_ALGORITHM,
    actorId: event.actorId ?? null,
    actorKind: event.actorKind,
    at: event.at,
    auditEventId: event.auditEventId,
    chainScope: event.chainScope,
    eventKind: event.eventKind,
    sequence: event.sequence,
  });
}

/* --------------------------------------------------------------------------
   Hash computation
   -------------------------------------------------------------------------- */

/**
 * Computes the SHA-256 hash of previousHash concatenated with canonicalPayload.
 * Returns a lowercase hex string, 64 characters long.
 */
export function computeHash(previousHash: string, canonicalPayload: string): string {
  return createHash("sha256")
    .update(previousHash + canonicalPayload)
    .digest("hex");
}

/* --------------------------------------------------------------------------
   Append
   -------------------------------------------------------------------------- */

export interface AppendChainRecordParams {
  auditEventId: string;
  eventKind: string;
  actorKind: string;
  actorId: string | null;
  at: string;
  runId: string;
}

/**
 * Creates a new chain record for an audit event.
 *
 * Reads the last record for the configured chain scope to determine the
 * sequence number and previous hash, then inserts the new record atomically.
 * Callers that need to create a chain record for every audit event should call
 * this immediately after writing to audit_events, within the same transaction.
 */
export function appendChainRecord(params: AppendChainRecordParams): void {
  const db = getDb();

  const lastRecord = db
    .select()
    .from(auditChainRecords)
    .where(eq(auditChainRecords.chainScope, CHAIN_SCOPE))
    .orderBy(desc(auditChainRecords.sequence))
    .limit(1)
    .all()[0];

  const sequence = lastRecord ? lastRecord.sequence + 1 : 1;
  const previousHash = lastRecord ? lastRecord.eventHash : GENESIS_HASH;

  const canonical = canonicalize({
    sequence,
    chainScope: CHAIN_SCOPE,
    eventKind: params.eventKind,
    auditEventId: params.auditEventId,
    actorKind: params.actorKind,
    actorId: params.actorId,
    at: params.at,
  });

  const eventHash = computeHash(previousHash, canonical);

  db.insert(auditChainRecords)
    .values({
      id: `ACR-${sequence}-${Date.now()}`,
      runId: params.runId,
      sequence,
      chainScope: CHAIN_SCOPE,
      auditEventId: params.auditEventId,
      eventKind: params.eventKind,
      canonicalPayload: canonical,
      previousHash,
      eventHash,
      hashAlgorithm: HASH_ALGORITHM,
      createdAt: params.at,
    })
    .run();
}
