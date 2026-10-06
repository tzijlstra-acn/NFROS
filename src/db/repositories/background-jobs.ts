/**
 * Read and write access for the background job queue.
 *
 * The queue uses a lease model: a worker claims a job for a fixed window and
 * must either complete, fail, or renew before the window expires. Expired
 * leases are released by `releaseExpiredLeases`, which any worker can call at
 * the top of its poll loop.
 *
 * Idempotency is enforced at enqueue time: a second call with the same
 * idempotencyKey returns the existing job unchanged instead of inserting a
 * duplicate. Cancelled and failed jobs are excluded from the idempotency
 * check, so a retry after a definitive failure is allowed.
 *
 * Synchronous throughout -- better-sqlite3 does not use promises.
 */

import { and, asc, eq, lt, lte, ne, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { backgroundJobAttempts, backgroundJobs } from "@/db/schema/background-jobs";

const db = () => getDb();

/* ==========================================================================
   Exported types derived from the schema
   ========================================================================== */

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type NewJob = typeof backgroundJobs.$inferInsert;

export type BackgroundJobAttempt = typeof backgroundJobAttempts.$inferSelect;
export type NewJobAttempt = typeof backgroundJobAttempts.$inferInsert;

/* ==========================================================================
   Enqueue
   ========================================================================== */

/**
 * Inserts a new job or returns the existing job if the idempotencyKey is
 * already present for a non-terminal state.
 *
 * Terminal states (failed, cancelled) are excluded from the idempotency check
 * so a deliberate retry after a definitive failure is permitted. When a
 * terminal job is found, it is deleted and a fresh row is inserted so the
 * caller's requested id and metadata take effect.
 */
export function enqueueJob(job: NewJob, runId = DEFAULT_RUN_ID): BackgroundJob {
  // Check for any existing job with this idempotency key.
  const any = db()
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.idempotencyKey, job.idempotencyKey))
    .get();

  if (any) {
    const isTerminal = any.status === "failed" || any.status === "cancelled";
    if (!isTerminal) {
      // Active or completed job: honour idempotency and return it as-is.
      return any;
    }
    // Terminal job: delete it so the new row can be inserted cleanly.
    db().delete(backgroundJobs).where(eq(backgroundJobs.id, any.id)).run();
  }

  const row: NewJob = { ...job, runId };
  db().insert(backgroundJobs).values(row).run();

  const created = db()
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.id, job.id))
    .get();

  if (!created) throw new Error(`Failed to create background job: ${job.id}`);
  return created;
}

/* ==========================================================================
   Leasing
   ========================================================================== */

/**
 * Atomically claims the next eligible job and returns it.
 *
 * Eligible jobs are pending, scheduled at or before now, ordered by priority
 * ascending (lower number = higher priority) and then by scheduled time.
 *
 * Returns undefined when no eligible job is available.
 */
export function leaseNextJob(
  leaseOwner: string,
  leaseSeconds: number,
  runId = DEFAULT_RUN_ID,
): BackgroundJob | undefined {
  const now = new Date().toISOString();
  const leaseExpiry = new Date(Date.now() + leaseSeconds * 1000).toISOString();

  const candidate = db()
    .select()
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.runId, runId),
        eq(backgroundJobs.status, "pending"),
        lte(backgroundJobs.scheduledAt, now),
      ),
    )
    .orderBy(asc(backgroundJobs.priority), asc(backgroundJobs.scheduledAt))
    .limit(1)
    .get();

  if (!candidate) return undefined;

  db()
    .update(backgroundJobs)
    .set({
      status: "leased",
      leaseOwner,
      leaseExpiresAt: leaseExpiry,
      attemptCount: candidate.attemptCount + 1,
      updatedAt: now,
    })
    .where(
      and(eq(backgroundJobs.id, candidate.id), eq(backgroundJobs.status, "pending")),
    )
    .run();

  // Write an attempt row.
  const attempt: NewJobAttempt = {
    id: `${candidate.id}-A${String(candidate.attemptCount + 1).padStart(2, "0")}`,
    runId,
    jobId: candidate.id,
    attemptNumber: candidate.attemptCount + 1,
    startedAt: now,
    completedAt: null,
    outcome: null,
    errorCode: null,
    errorRedacted: null,
    leaseOwner,
  };
  db().insert(backgroundJobAttempts).values(attempt).run();

  return db()
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.id, candidate.id))
    .get() ?? undefined;
}

/**
 * Extends the lease on a job that is still being processed.
 *
 * A worker that expects to exceed the original lease window should call this
 * before the current window expires.
 */
export function renewLease(jobId: string, leaseOwner: string, leaseSeconds: number): void {
  const leaseExpiry = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  db()
    .update(backgroundJobs)
    .set({ leaseExpiresAt: leaseExpiry, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(backgroundJobs.id, jobId),
        eq(backgroundJobs.leaseOwner, leaseOwner),
        eq(backgroundJobs.status, "leased"),
      ),
    )
    .run();
}

/* ==========================================================================
   Completion
   ========================================================================== */

export function completeJob(jobId: string, resultSummary: string): void {
  const now = new Date().toISOString();
  db()
    .update(backgroundJobs)
    .set({
      status: "completed",
      resultSummary,
      completedAt: now,
      updatedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(eq(backgroundJobs.id, jobId))
    .run();

  // Update the most recent attempt row.
  const latestAttempt = db()
    .select()
    .from(backgroundJobAttempts)
    .where(eq(backgroundJobAttempts.jobId, jobId))
    .orderBy(asc(backgroundJobAttempts.attemptNumber))
    .all()
    .at(-1);

  if (latestAttempt) {
    db()
      .update(backgroundJobAttempts)
      .set({ completedAt: now, outcome: "success" })
      .where(eq(backgroundJobAttempts.id, latestAttempt.id))
      .run();
  }
}

export function failJob(jobId: string, errorCode: string, errorRedacted: string): void {
  const now = new Date().toISOString();

  const job = db()
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.id, jobId))
    .get();

  if (!job) return;

  const exhausted = job.attemptCount >= job.maxAttempts;

  db()
    .update(backgroundJobs)
    .set({
      status: exhausted ? "failed" : "pending",
      lastErrorCode: errorCode,
      lastErrorRedacted: errorRedacted,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: now,
      scheduledAt: exhausted ? job.scheduledAt : now,
    })
    .where(eq(backgroundJobs.id, jobId))
    .run();

  // Update the most recent attempt row.
  const latestAttempt = db()
    .select()
    .from(backgroundJobAttempts)
    .where(eq(backgroundJobAttempts.jobId, jobId))
    .orderBy(asc(backgroundJobAttempts.attemptNumber))
    .all()
    .at(-1);

  if (latestAttempt) {
    db()
      .update(backgroundJobAttempts)
      .set({ completedAt: now, outcome: "failed", errorCode, errorRedacted })
      .where(eq(backgroundJobAttempts.id, latestAttempt.id))
      .run();
  }
}

export function cancelJob(jobId: string): void {
  db()
    .update(backgroundJobs)
    .set({
      status: "cancelled",
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(backgroundJobs.id, jobId))
    .run();
}

/* ==========================================================================
   Lease recovery
   ========================================================================== */

/**
 * Re-queues jobs whose lease has expired without a completion.
 *
 * Any worker can call this. The count of released jobs is returned so the
 * caller can log it.
 */
export function releaseExpiredLeases(runId = DEFAULT_RUN_ID): number {
  const now = new Date().toISOString();

  const expired = db()
    .select()
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.runId, runId),
        eq(backgroundJobs.status, "leased"),
        lt(backgroundJobs.leaseExpiresAt, now),
      ),
    )
    .all();

  for (const job of expired) {
    const exhausted = job.attemptCount >= job.maxAttempts;

    db()
      .update(backgroundJobs)
      .set({
        status: exhausted ? "failed" : "pending",
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: "LEASE_EXPIRED",
        lastErrorRedacted: `Lease expired after ${job.attemptCount} attempt(s)`,
        updatedAt: now,
        scheduledAt: exhausted ? job.scheduledAt : now,
      })
      .where(eq(backgroundJobs.id, job.id))
      .run();

    // Mark the dangling attempt as timed-out.
    const latestAttempt = db()
      .select()
      .from(backgroundJobAttempts)
      .where(eq(backgroundJobAttempts.jobId, job.id))
      .orderBy(asc(backgroundJobAttempts.attemptNumber))
      .all()
      .at(-1);

    if (latestAttempt && !latestAttempt.completedAt) {
      db()
        .update(backgroundJobAttempts)
        .set({ completedAt: now, outcome: "timed-out", errorCode: "LEASE_EXPIRED" })
        .where(eq(backgroundJobAttempts.id, latestAttempt.id))
        .run();
    }
  }

  return expired.length;
}

/* ==========================================================================
   Targeted leasing and parking (process engine)
   ========================================================================== */

/**
 * Leases one named job, when it is pending.
 *
 * The poll loop leases whatever is next; a server action that has just queued
 * a stage preparation wants to run that one. The status condition on the
 * update is the lock: a second caller, in this process or the worker, finds
 * no pending row and gets undefined rather than a second lease.
 */
export function leaseJobById(
  jobId: string,
  leaseOwner: string,
  leaseSeconds: number,
): BackgroundJob | undefined {
  const now = new Date().toISOString();
  const leaseExpiry = new Date(Date.now() + leaseSeconds * 1000).toISOString();

  const candidate = db().select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).get();
  if (!candidate || candidate.status !== "pending") return undefined;

  const result = db()
    .update(backgroundJobs)
    .set({
      status: "leased",
      leaseOwner,
      leaseExpiresAt: leaseExpiry,
      attemptCount: candidate.attemptCount + 1,
      updatedAt: now,
    })
    .where(and(eq(backgroundJobs.id, jobId), eq(backgroundJobs.status, "pending")))
    .run();
  if (result.changes === 0) return undefined;

  db()
    .insert(backgroundJobAttempts)
    .values({
      id: `${candidate.id}-A${String(candidate.attemptCount + 1).padStart(2, "0")}`,
      runId: candidate.runId,
      jobId: candidate.id,
      attemptNumber: candidate.attemptCount + 1,
      startedAt: now,
      completedAt: null,
      outcome: null,
      errorCode: null,
      errorRedacted: null,
      leaseOwner,
    })
    .run();

  return db().select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).get() ?? undefined;
}

/**
 * Parks a job that cannot proceed yet, with the reason.
 *
 * "waiting-for-source" and "waiting-for-approval" are never leased by the
 * poll loop, so a parked job does not burn its attempts while it waits. The
 * attempt that discovered the reason is closed as a success, because nothing
 * failed: the job did exactly what it should and stopped.
 */
export function parkJob(
  jobId: string,
  status: "waiting-for-source" | "waiting-for-approval",
  reason: string,
): void {
  const now = new Date().toISOString();
  const job = db().select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).get();
  if (!job) return;

  db()
    .update(backgroundJobs)
    .set({
      status,
      resultSummary: reason,
      leaseOwner: null,
      leaseExpiresAt: null,
      /*
       * The attempt that parked the job must not count against its retries.
       * The attempt counter also names the attempt rows, so it cannot go back
       * down without colliding with the row just written; the budget grows by
       * one instead.
       */
      maxAttempts: job.status === "leased" ? job.maxAttempts + 1 : job.maxAttempts,
      updatedAt: now,
    })
    .where(eq(backgroundJobs.id, jobId))
    .run();

  const latestAttempt = db()
    .select()
    .from(backgroundJobAttempts)
    .where(eq(backgroundJobAttempts.jobId, jobId))
    .orderBy(asc(backgroundJobAttempts.attemptNumber))
    .all()
    .at(-1);
  if (latestAttempt && !latestAttempt.completedAt) {
    db()
      .update(backgroundJobAttempts)
      .set({ completedAt: now, outcome: "success", errorCode: status, errorRedacted: reason })
      .where(eq(backgroundJobAttempts.id, latestAttempt.id))
      .run();
  }
}

/** Returns a parked job to the queue. Returns false when it was not parked. */
export function unparkJob(jobId: string): boolean {
  const result = db()
    .update(backgroundJobs)
    .set({ status: "pending", scheduledAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(backgroundJobs.id, jobId),
        or(eq(backgroundJobs.status, "waiting-for-source"), eq(backgroundJobs.status, "waiting-for-approval")),
      ),
    )
    .run();
  return result.changes > 0;
}

/** One job by id. */
export function getJobById(jobId: string): BackgroundJob | undefined {
  return db().select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).get() ?? undefined;
}

/* ==========================================================================
   Reads
   ========================================================================== */

/** Returns the first job matching the idempotency key, regardless of status. */
export function getJob(idempotencyKey: string): BackgroundJob | undefined {
  return db()
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.idempotencyKey, idempotencyKey))
    .get() ?? undefined;
}

/** Returns all failed jobs, optionally scoped to a role. */
export function getFailedJobs(roleId?: string, runId = DEFAULT_RUN_ID): BackgroundJob[] {
  const rows = db()
    .select()
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.runId, runId),
        eq(backgroundJobs.status, "failed"),
      ),
    )
    .orderBy(asc(backgroundJobs.createdAt))
    .all();

  return roleId !== undefined ? rows.filter((r) => r.relatedRoleId === roleId) : rows;
}

/** Returns the count of pending jobs in the queue. */
export function getJobDepth(runId = DEFAULT_RUN_ID): number {
  const rows = db()
    .select()
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.runId, runId),
        or(eq(backgroundJobs.status, "pending"), eq(backgroundJobs.status, "leased")),
      ),
    )
    .all();
  return rows.length;
}

/** Returns all jobs in the given status. */
export function getJobsByStatus(status: string, runId = DEFAULT_RUN_ID): BackgroundJob[] {
  return db()
    .select()
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.runId, runId),
        eq(backgroundJobs.status, status),
      ),
    )
    .orderBy(asc(backgroundJobs.scheduledAt))
    .all();
}
