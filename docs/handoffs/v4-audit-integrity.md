# V4 Audit Integrity Handoff

## What was built

A tamper-evident audit hash chain that covers every pre-existing audit event in the seeded scenario. Verification runs on demand via a CLI script and is exposed as a read-only admin page.

## Files created or modified

### New schema
- `src/db/schema/audit-chain.ts` -- defines `auditChainRecords` table
- `src/db/schema/index.ts` -- exports `audit-chain` (added line)

### Audit service
- `src/audit/chain.ts` -- `canonicalize()`, `computeHash()`, `appendChainRecord()`
- `src/audit/verify-chain.ts` -- `verifyChain()`, `ChainVerificationResult`
- `src/audit/db-protection.ts` -- `AUDIT_PROTECTION_STATEMENT` and module-level protection documentation

### Verification script
- `scripts/verify-chain.ts` -- CLI entry point

### Admin page
- `app/settings/audit-integrity/page.tsx` -- server component, calls `verifyChain()` on render

### Seed
- `src/db/seed/audit-chain.ts` -- `seedAuditChain()`, seeds 5 chain records
- `src/db/seed/run.ts` -- imports `seedAuditChain`, calls it after the scenario transaction; adds `"audit_chain_records"` to `RUN_SCOPED_TABLES` so `demo:reset` clears the chain too

### Tests
- `tests/unit/audit-chain.test.ts` -- 18 tests covering all pure functions and DB-dependent verifyChain paths

### Package script
- `package.json` -- added `"audit:verify-chain": "tsx scripts/verify-chain.ts"`

## Hash algorithm

SHA-256 from Node.js built-in `node:crypto`. No external hash library.

Hash input: `previousHash + canonicalPayload` where `canonicalPayload` is a deterministic JSON string with alphabetically sorted keys.

## Chain scope

Default: `org-arcadia-demo`. Override with `AUDIT_CHAIN_SCOPE` environment variable.

## Migration status

The migration SQL already existed in `src/db/migrations/0003_calm_sentry.sql` from a prior version of the schema. Running `npm run db:migrate` applies it. Confirmed: `npm run db:migrate` completes successfully (94 tables).

## Seed status

`npm run db:seed` writes 5 chain records covering the 5 pre-existing audit events (AUE-2024-0001 through AUE-2025-0005) in chronological order.

## Verification command

```
npm run audit:verify-chain
```

Expected output on a clean seed:
```
Audit chain verification
Scope:                   org-arcadia-demo
Status:                  valid
Total records:           5
Verified through seq:    5
Verified at:             <ISO timestamp>
Chain is valid.
```

## TypeScript status

No TypeScript errors in any of the new or modified audit files. Two pre-existing errors in `evals/graders/schema.ts` and `scripts/eval-runner.ts` are unrelated to this work and were present before.

## Test status

All 557 unit tests pass, including the 18 new audit chain tests.

## Protection boundary

The correct claim is: "Tamper-evident within the application and database boundary."

A machine administrator with direct database file access can replace or modify the database using SQLite tools outside the application boundary. This is tamper-evident, not tamper-proof, and is not equivalent to cryptographic non-repudiation. This limitation is stated explicitly in the admin page, in `src/audit/db-protection.ts`, and in the schema file header.

No repository function exposes UPDATE or DELETE on `audit_chain_records` or `audit_events`.
