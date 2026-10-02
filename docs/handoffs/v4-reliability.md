# V4 Reliability: Durable Job System

Agent E delivery for NFR WorkOS V4.0. Implements the background job queue,
worker process, backup/restore tooling, and migration verification.

---

## Files created

### DB schema

`src/db/schema/background-jobs.ts`
Defines two SQLite tables via Drizzle:
- `background_jobs` -- 22 columns, 3 indexes (run+status, status+schedule+priority). Covers lease ownership, attempt tracking, idempotency key (unique), related object references, redacted error fields.
- `background_job_attempts` -- 10 columns, 1 index. One row per execution attempt for full history.

Both tables carry `runId` and are cleared by `demo:reset`.

`src/db/schema/index.ts`
Added `export * from "./background-jobs"` so the Drizzle schema object picks up both new tables.

`src/db/seed/run.ts`
Added `"background_job_attempts"` and `"background_jobs"` at the head of `RUN_SCOPED_TABLES` (most-dependent first). No seed data is written for these tables -- they start empty on each scenario run.

### DB repository

`src/db/repositories/background-jobs.ts`
Full set of synchronous repository functions:

| Function | Behaviour |
|---|---|
| `enqueueJob` | Idempotency check: returns active job if key exists; deletes terminal (failed/cancelled) job and inserts fresh one if key was reused |
| `leaseNextJob` | Claims the next eligible pending job; writes attempt row; uses `lte` on scheduledAt to avoid same-millisecond edge case |
| `renewLease` | Extends the lease window for long-running jobs |
| `completeJob` | Marks job and latest attempt row as succeeded |
| `failJob` | Re-queues with `status=pending` when `attemptCount < maxAttempts`; sets `status=failed` when exhausted |
| `cancelJob` | Sets status to cancelled; clears lease fields |
| `releaseExpiredLeases` | Re-queues or fails all leased jobs whose `leaseExpiresAt` is past; marks dangling attempt rows as timed-out |
| `getJob` | Lookup by idempotency key |
| `getFailedJobs` | All failed jobs, optionally filtered by roleId |
| `getJobDepth` | Count of pending+leased jobs |
| `getJobsByStatus` | All jobs in a given status, ordered by scheduledAt |

### Worker

`scripts/worker.ts`
Standalone polling worker. Dispatches on `jobKind` with stub handlers for all
nine job kinds (ai-routine, ai-preparation, meeting-preparation, minutes-draft,
action-follow-up, evidence-refresh, integration-command, process-resume,
evaluation-run). In offline/demo mode each handler completes after a small
synthetic delay. Handles `SIGTERM`/`SIGINT` for clean shutdown. Releases
expired leases at the top of every poll cycle.

Run with: `npm run worker`

### Backup/restore

`scripts/backup.ts`
Three subcommands:
- `create` -- copies `data/nfr-workos.db` to `backups/nfr-workos-<timestamp>.db` and writes a JSON manifest with the SHA-256 hash.
- `verify` -- re-hashes the most recent backup and compares against the manifest.
- `restore` -- verifies integrity then copies the backup over the live database.

### Migration test

`scripts/test-migration.ts`
Reports table count, checks all 10 required tables are present, verifies
`role_app_runs` has at least one row (seed check), and reports job queue depth.
Exits 0 on pass, 1 on any missing table.

### Dev helper

`scripts/dev-all.ts`
Spawns Next.js dev server and the job worker as sibling processes with shared
stdio. Handles SIGINT/SIGTERM forwarding. Note: install `concurrently` for a
richer parallel experience (`npm install --save-dev concurrently`).

### Integration tests

`tests/integration/recovery.test.ts`
8 passing Vitest tests covering:
- Idempotency (same key returns same job)
- Re-enqueue after cancellation (new ID accepted after terminal state)
- Lease expiry re-queues a job (attempt count below max)
- Lease expiry fails a job (attempt count at max)
- Max attempts exhaustion sets status to "failed"
- Successful completion before exhaustion
- SHA-256 hash consistency (same content, same digest)
- SHA-256 collision resistance (different content, different digest)

---

## Migration

Migration file generated: `src/db/migrations/0003_calm_sentry.sql`
Created by: `npx drizzle-kit generate` (detected 87 existing + 2 new tables = 89 total, reported as 94 after later agents added more tables).

Migration applied successfully: `npm run db:migrate` -- 94 tables at `data/nfr-workos.db`.
Seed applied successfully: `npm run db:seed` -- 2724 rows across 53 tables.

---

## Package scripts added

```
worker          tsx scripts/worker.ts
dev:all         tsx scripts/dev-all.ts
backup:create   tsx scripts/backup.ts create
backup:verify   tsx scripts/backup.ts verify
backup:restore  tsx scripts/backup.ts restore
test:recovery   vitest run tests/integration/recovery.test.ts
test:migration  tsx scripts/test-migration.ts
```

---

## TypeScript status

No TypeScript errors introduced by V4 reliability files. Two pre-existing
errors in `evals/graders/schema.ts` and `scripts/eval-runner.ts` (TS18048,
possibly-undefined) were present before this work and are not in scope for
this agent.

---

## Worker behaviour

- Poll interval: 5000 ms (configurable via constant at top of worker.ts)
- Lease window: 30 seconds (configurable)
- Lease release: called at top of every poll cycle
- Shutdown: clean on SIGTERM or SIGINT
- Error redaction: only error class name and attempt count are logged; no content or PII

---

## Backup status

- Backup directory: `backups/` (created on first `backup:create` run)
- Manifest file: `backups/manifest-<timestamp>.json` per backup
- Hash algorithm: SHA-256 over raw file bytes
- Note in manifest: "Backup excludes API keys and runtime secrets"
- No API keys or session tokens are stored in the SQLite database
