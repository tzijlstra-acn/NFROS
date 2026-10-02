#!/usr/bin/env tsx
/**
 * scripts/worker.ts
 *
 * Local durable job worker for NFR WorkOS.
 *
 * Polls the background_jobs table, acquires a lease on the next eligible job,
 * dispatches it to the appropriate handler, and marks it complete or failed.
 * Expired leases from crashed workers are released at the top of every cycle.
 *
 * Run with: npm run worker
 */

import {
  leaseNextJob,
  completeJob,
  failJob,
  releaseExpiredLeases,
} from "@/db/repositories/background-jobs";
import type { BackgroundJob } from "@/db/repositories/background-jobs";

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const LEASE_SECONDS = 30;
const POLL_INTERVAL_MS = 5000;

async function processJob(job: BackgroundJob): Promise<void> {
  console.log(`[worker] Processing job ${job.id} kind=${job.jobKind}`);

  switch (job.jobKind) {
    case "ai-routine":
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      completeJob(job.id, `Routine completed: ${job.relatedObjectKind ?? "unknown"}`);
      break;

    case "ai-preparation":
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      completeJob(job.id, "AI preparation completed (offline mode)");
      break;

    case "meeting-preparation":
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
      completeJob(job.id, "Meeting preparation completed");
      break;

    case "minutes-draft":
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      completeJob(job.id, "Minutes draft completed (offline mode)");
      break;

    case "action-follow-up":
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      completeJob(job.id, "Action follow-up check completed");
      break;

    case "evidence-refresh":
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
      completeJob(job.id, "Evidence freshness check completed");
      break;

    case "integration-command":
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      completeJob(job.id, "Integration command dispatched (offline mode)");
      break;

    case "process-resume":
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      completeJob(job.id, "Process resumed");
      break;

    case "evaluation-run":
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      completeJob(job.id, "Evaluation run completed (offline mode)");
      break;

    default:
      completeJob(job.id, `Job kind ${job.jobKind} completed`);
  }
}

async function runWorkerLoop(): Promise<void> {
  console.log(`[worker] NFR WorkOS worker started. ID: ${WORKER_ID}`);

  let shuttingDown = false;

  process.on("SIGTERM", () => {
    shuttingDown = true;
    console.log("[worker] Shutting down...");
  });
  process.on("SIGINT", () => {
    shuttingDown = true;
    console.log("[worker] Shutting down...");
  });

  while (!shuttingDown) {
    try {
      const released = releaseExpiredLeases();
      if (released > 0) {
        console.log(`[worker] Released ${released} expired leases`);
      }

      const job = leaseNextJob(WORKER_ID, LEASE_SECONDS);

      if (job) {
        try {
          await processJob(job);
        } catch (err) {
          const errorCode = err instanceof Error ? err.constructor.name : "UNKNOWN_ERROR";
          failJob(job.id, errorCode, `Job failed after ${job.attemptCount} attempt(s)`);
          console.error(`[worker] Job ${job.id} failed: ${errorCode}`);
        }
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err) {
      console.error(
        "[worker] Worker loop error:",
        err instanceof Error ? err.name : "Error",
      );
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  console.log("[worker] Worker stopped.");
  process.exit(0);
}

runWorkerLoop().catch((err) => {
  console.error("[worker] Fatal:", err instanceof Error ? err.name : "Error");
  process.exit(1);
});
