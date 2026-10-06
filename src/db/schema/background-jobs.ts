/**
 * Background jobs schema.
 *
 * Provides durable async work queuing with lease-based execution, idempotency,
 * and per-attempt history. The worker polls this table rather than relying on
 * an external message broker.
 *
 * Every table carries `runId` following the project-wide convention. Rows
 * belong to the active scenario run and are cleared by `demo:reset`.
 *
 * Identifier conventions match the core schema: stable kebab-case or
 * uppercase slugs for content identifiers.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/* ---------------------------------------------------------------------------
   Background jobs
   --------------------------------------------------------------------------- */

/**
 * One unit of durable async work.
 *
 * The worker acquires a lease on pending jobs, processes them, and writes the
 * outcome. The leasing model tolerates worker crashes: a job whose lease has
 * expired is re-queued automatically by the next worker poll cycle.
 */
export const backgroundJobs = sqliteTable(
  "background_jobs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    /** "ai-routine"|"ai-preparation"|"meeting-preparation"|"minutes-draft"|"action-follow-up"|"evidence-refresh"|"integration-command"|"process-resume"|"evaluation-run" */
    jobKind: text("job_kind").notNull(),
    /**
     * "pending"|"leased"|"completed"|"failed"|"cancelled", plus two parked
     * states the process engine uses: "waiting-for-source" (a required source
     * is unavailable) and "waiting-for-approval" (the autonomy level does not
     * allow the job to start without a person). A parked job is never leased;
     * it returns to "pending" when its reason clears. The user-facing states
     * (Queued, Running, Retrying, ...) are derived from this column and the
     * attempt count in `src/features/process/preparation.ts`.
     */
    status: text("status").notNull(),
    priority: integer("priority").notNull().default(5),
    scheduledAt: text("scheduled_at").notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: text("lease_expires_at"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastErrorCode: text("last_error_code"),
    lastErrorRedacted: text("last_error_redacted"),
    relatedRoleId: text("related_role_id"),
    relatedProcessRunId: text("related_process_run_id"),
    relatedObjectKind: text("related_object_kind"),
    relatedObjectId: text("related_object_id"),
    /** JSON, no secrets */
    payload: text("payload"),
    /** Redacted summary of outcome */
    resultSummary: text("result_summary"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("background_jobs_run_idx").on(table.runId, table.status),
    index("background_jobs_schedule_idx").on(table.status, table.scheduledAt, table.priority),
  ],
);

/* ---------------------------------------------------------------------------
   Background job attempts
   --------------------------------------------------------------------------- */

/**
 * Per-attempt history for background jobs.
 *
 * Append-only: one row per execution attempt. The parent job row holds the
 * latest outcome; this table holds the full history so a developer can see
 * which workers tried a job and what each attempt produced.
 */
export const backgroundJobAttempts = sqliteTable(
  "background_job_attempts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    jobId: text("job_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    /** "success"|"failed"|"timed-out" */
    outcome: text("outcome"),
    errorCode: text("error_code"),
    errorRedacted: text("error_redacted"),
    leaseOwner: text("lease_owner").notNull(),
  },
  (table) => [index("background_job_attempts_job_idx").on(table.runId, table.jobId)],
);
