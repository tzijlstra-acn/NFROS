/**
 * Audit database protection.
 *
 * The application enforces tamper-evidence through:
 * 1. All audit writes go through appendChainRecord() which builds the hash chain.
 * 2. No repository function exposes UPDATE or DELETE on audit_chain_records or
 *    audit_events.
 * 3. The chain can be verified at any time with npm run audit:verify-chain.
 *
 * Important limitation: A machine administrator with direct database access can
 * still replace the database file or modify it with SQLite tools outside the
 * application boundary. This protection is tamper-evident, not tamper-proof.
 *
 * The correct claim is: "Tamper-evident within the application and database
 * boundary."
 */

export const AUDIT_PROTECTION_STATEMENT =
  "Tamper-evident within the application and database boundary.";
