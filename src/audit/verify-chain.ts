/**
 * Audit chain verifier.
 *
 * Reads every record for a chain scope in sequence order and recomputes each
 * hash from scratch, comparing it to the stored value. Any mismatch means the
 * chain was tampered with or corrupted after the record was written.
 *
 * This module is safe to call from server components, scripts, and tests.
 * It is read-only: it never writes to the database.
 */

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditChainRecords } from "@/db/schema/audit-chain";
import { GENESIS_HASH, computeHash, CHAIN_SCOPE as DEFAULT_SCOPE } from "@/audit/chain";

export { CHAIN_SCOPE } from "@/audit/chain";

/* --------------------------------------------------------------------------
   Result type
   -------------------------------------------------------------------------- */

export interface ChainVerificationResult {
  /** "valid" -- all hashes match; "broken" -- at least one hash does not match; "empty" -- no records. */
  status: "valid" | "broken" | "empty";
  /** The sequence number of the last record that verified successfully. 0 if none verified. */
  verifiedThrough: number;
  /** The sequence number of the first record whose hash did not match, or null. */
  firstFailureSequence: number | null;
  /** Total number of chain records examined. */
  totalRecords: number;
  /** ISO-8601 timestamp of when this verification ran. */
  verifiedAt: string;
}

/* --------------------------------------------------------------------------
   Verification
   -------------------------------------------------------------------------- */

/**
 * Verifies every record in the chain for the given scope.
 *
 * Iterates records in ascending sequence order, recomputing each hash from the
 * stored canonicalPayload and the previous record's eventHash. The first record
 * is compared against GENESIS_HASH as its predecessor.
 */
export function verifyChain(chainScope: string = DEFAULT_SCOPE): ChainVerificationResult {
  const db = getDb();
  const verifiedAt = new Date().toISOString();

  const records = db
    .select()
    .from(auditChainRecords)
    .where(eq(auditChainRecords.chainScope, chainScope))
    .orderBy(asc(auditChainRecords.sequence))
    .all();

  if (records.length === 0) {
    return {
      status: "empty",
      verifiedThrough: 0,
      firstFailureSequence: null,
      totalRecords: 0,
      verifiedAt,
    };
  }

  let previousHash = GENESIS_HASH;
  let verifiedThrough = 0;

  for (const record of records) {
    const expectedHash = computeHash(previousHash, record.canonicalPayload);
    if (expectedHash !== record.eventHash) {
      return {
        status: "broken",
        verifiedThrough,
        firstFailureSequence: record.sequence,
        totalRecords: records.length,
        verifiedAt,
      };
    }
    previousHash = record.eventHash;
    verifiedThrough = record.sequence;
  }

  return {
    status: "valid",
    verifiedThrough,
    firstFailureSequence: null,
    totalRecords: records.length,
    verifiedAt,
  };
}
