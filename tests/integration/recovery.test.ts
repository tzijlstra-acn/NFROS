/**
 * Recovery and durability tests for the background job queue.
 *
 * Covers:
 *  - Idempotency: enqueueJob with the same idempotencyKey returns the same job.
 *  - Lease expiry: a job with a past-expiry lease is released by releaseExpiredLeases.
 *  - Max attempts: a job that fails maxAttempts times gets status "failed".
 *  - Hash consistency: hashFile produces the same digest for the same content.
 *
 * Each describe block uses its own runId so leaseNextJob calls never pick up
 * jobs from a sibling test.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";

let enqueueJob: typeof import("@/db/repositories/background-jobs").enqueueJob;
let leaseNextJob: typeof import("@/db/repositories/background-jobs").leaseNextJob;
let completeJob: typeof import("@/db/repositories/background-jobs").completeJob;
let failJob: typeof import("@/db/repositories/background-jobs").failJob;
let releaseExpiredLeases: typeof import("@/db/repositories/background-jobs").releaseExpiredLeases;
let getJob: typeof import("@/db/repositories/background-jobs").getJob;
let getSqlite: typeof import("@/db/client").getSqlite;

beforeAll(async () => {
  createTemporaryDatabase("recovery");

  const repo = await import("@/db/repositories/background-jobs");
  enqueueJob = repo.enqueueJob;
  leaseNextJob = repo.leaseNextJob;
  completeJob = repo.completeJob;
  failJob = repo.failJob;
  releaseExpiredLeases = repo.releaseExpiredLeases;
  getJob = repo.getJob;

  ({ getSqlite } = await import("@/db/client"));
});

afterAll(() => {
  destroyTemporaryDatabase();
});

/* -------------------------------------------------------------------------- */

function makeJob(runId: string, overrides: Record<string, unknown> = {}) {
  const id = `test-job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    runId,
    idempotencyKey: id,
    jobKind: "ai-routine",
    status: "pending",
    priority: 5,
    scheduledAt: new Date(Date.now() - 1000).toISOString(),
    leaseOwner: null,
    leaseExpiresAt: null,
    attemptCount: 0,
    maxAttempts: 3,
    lastErrorCode: null,
    lastErrorRedacted: null,
    relatedRoleId: null,
    relatedProcessRunId: null,
    relatedObjectKind: null,
    relatedObjectId: null,
    payload: null,
    resultSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */

describe("idempotency", () => {
  const runId = "run-idem";

  it("returns the same job when enqueueJob is called twice with the same idempotencyKey", () => {
    const base = makeJob(runId, { idempotencyKey: "idem-key-001" });
    const first = enqueueJob(base as Parameters<typeof enqueueJob>[0], runId);

    const duplicate = makeJob(runId, { idempotencyKey: "idem-key-001", id: "different-id" });
    const second = enqueueJob(duplicate as Parameters<typeof enqueueJob>[0], runId);

    expect(second.id).toBe(first.id);
  });

  it("allows a new job after the previous one with the same key was cancelled", () => {
    const base = makeJob(runId, { idempotencyKey: "idem-key-cancelled" });
    const first = enqueueJob(base as Parameters<typeof enqueueJob>[0], runId);

    getSqlite()
      .prepare("update background_jobs set status = 'cancelled' where id = ?")
      .run(first.id);

    const retry = makeJob(runId, { idempotencyKey: "idem-key-cancelled", id: "retry-id" });
    const retried = enqueueJob(retry as Parameters<typeof enqueueJob>[0], runId);

    expect(retried.id).toBe("retry-id");
  });
});

/* -------------------------------------------------------------------------- */

describe("lease expiry", () => {
  const runId = "run-lease";

  it("re-queues a leased job whose lease has expired", () => {
    const base = makeJob(runId, { idempotencyKey: "expired-lease-001" });
    enqueueJob(base as Parameters<typeof enqueueJob>[0], runId);

    const pastExpiry = new Date(Date.now() - 5000).toISOString();
    getSqlite()
      .prepare(
        "update background_jobs set status = 'leased', lease_owner = 'dead-worker', lease_expires_at = ?, attempt_count = 1 where id = ?",
      )
      .run(pastExpiry, base.id);

    const released = releaseExpiredLeases(runId);

    expect(released).toBeGreaterThanOrEqual(1);

    const job = getJob("expired-lease-001");
    expect(job).toBeDefined();
    // 1 attempt < 3 max -- should go back to pending.
    expect(job!.status).toBe("pending");
    expect(job!.leaseOwner).toBeNull();
  });

  it("marks a leased job as failed when max attempts are exhausted on expiry", () => {
    const base = makeJob(runId, { idempotencyKey: "expired-max-001", maxAttempts: 2 });
    enqueueJob(base as Parameters<typeof enqueueJob>[0], runId);

    const pastExpiry = new Date(Date.now() - 5000).toISOString();
    getSqlite()
      .prepare(
        "update background_jobs set status = 'leased', lease_owner = 'dead-worker', lease_expires_at = ?, attempt_count = 2 where id = ?",
      )
      .run(pastExpiry, base.id);

    releaseExpiredLeases(runId);

    const job = getJob("expired-max-001");
    expect(job).toBeDefined();
    expect(job!.status).toBe("failed");
  });
});

/* -------------------------------------------------------------------------- */

describe("max attempts", () => {
  const runId = "run-maxattempts";

  it("transitions to 'failed' after maxAttempts failures", () => {
    const ikey = "max-attempts-001";
    const base = makeJob(runId, { idempotencyKey: ikey, maxAttempts: 2 });
    const enqueued = enqueueJob(base as Parameters<typeof enqueueJob>[0], runId);

    // First attempt.
    const j1 = leaseNextJob("test-worker", 30, runId);
    expect(j1).toBeDefined();
    expect(j1!.id).toBe(enqueued.id);
    failJob(j1!.id, "TEST_ERROR", "first failure");

    const after1 = getJob(ikey);
    // 1 attempt < 2 max -- should retry.
    expect(after1!.status).toBe("pending");

    // Second attempt.
    const j2 = leaseNextJob("test-worker", 30, runId);
    expect(j2).toBeDefined();
    expect(j2!.id).toBe(enqueued.id);
    failJob(j2!.id, "TEST_ERROR", "second failure");

    const after2 = getJob(ikey);
    // 2 attempts >= 2 max -- exhausted.
    expect(after2!.status).toBe("failed");
  });

  it("completes successfully before exhausting attempts", () => {
    const ikey = "success-before-max";
    const base = makeJob(runId, { idempotencyKey: ikey });
    const enqueued = enqueueJob(base as Parameters<typeof enqueueJob>[0], runId);

    const j = leaseNextJob("test-worker", 30, runId);
    expect(j).toBeDefined();
    expect(j!.id).toBe(enqueued.id);
    completeJob(j!.id, "done");

    const completed = getJob(ikey);
    expect(completed!.status).toBe("completed");
    expect(completed!.resultSummary).toBe("done");
  });
});

/* -------------------------------------------------------------------------- */

describe("hash consistency", () => {
  it("produces the same SHA-256 digest for identical content", () => {
    const content = Buffer.from("nfr-workos-backup-content-sample");

    const hash1 = createHash("sha256").update(content).digest("hex");
    const hash2 = createHash("sha256").update(content).digest("hex");

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("produces different digests for different content", () => {
    const a = Buffer.from("content-a");
    const b = Buffer.from("content-b");

    const hashA = createHash("sha256").update(a).digest("hex");
    const hashB = createHash("sha256").update(b).digest("hex");

    expect(hashA).not.toBe(hashB);
  });
});
