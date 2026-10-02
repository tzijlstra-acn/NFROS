#!/usr/bin/env tsx
/**
 * Audit chain verification script.
 *
 * Reads every record in the audit hash chain for the configured scope and
 * recomputes each hash from scratch. Exits with code 0 if the chain is valid
 * or empty, and code 1 if any record has been tampered with.
 *
 * Usage:
 *   npm run audit:verify-chain
 *   NFR_DB_PATH=./data/nfr-workos.db npm run audit:verify-chain
 */

import { verifyChain, CHAIN_SCOPE } from "@/audit/verify-chain";

const scope = process.env.AUDIT_CHAIN_SCOPE ?? CHAIN_SCOPE;
const result = verifyChain(scope);

console.log("Audit chain verification");
console.log("Scope:                  ", scope);
console.log("Status:                 ", result.status);
console.log("Total records:          ", result.totalRecords);
console.log("Verified through seq:   ", result.verifiedThrough);
console.log("Verified at:            ", result.verifiedAt);

if (result.status === "empty") {
  console.log("No chain records found. The chain has not been seeded.");
  process.exit(0);
}

if (result.status === "broken") {
  console.error(
    `CHAIN BROKEN at sequence ${result.firstFailureSequence}. ` +
      "The record at that position has a hash that does not match the recomputed value. " +
      "Either the record or a preceding record was modified after it was written.",
  );
  process.exit(1);
}

console.log("Chain is valid.");
process.exit(0);
