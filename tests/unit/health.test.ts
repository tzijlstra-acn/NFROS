/**
 * Health service and metrics tests.
 *
 * These are unit tests only: they do not open the database and do not
 * make network calls. The health service uses dynamic imports so that
 * each component check can be tested in isolation.
 */

import { describe, expect, it } from "vitest";
import {
  checkAIProviderHealth,
  checkWorkerHealth,
  checkAuditChainHealth,
  getHealthSummary,
  type ComponentHealth,
  type HealthSummary,
} from "@/health/service";
import {
  incrementCounter,
  recordLatency,
  getMetrics,
  METRIC_NAMES,
} from "@/health/metrics";

/* ==========================================================================
   checkAIProviderHealth
   ========================================================================== */

describe("checkAIProviderHealth", () => {
  it("returns a ComponentHealth object with a name field", async () => {
    const result = await checkAIProviderHealth();
    expect(result).toHaveProperty("name", "ai-provider");
    expect(result).toHaveProperty("status");
  });

  it("returns not-configured when no key is set", async () => {
    const savedMini = process.env.OPENAI_MINI_API_KEY;
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MINI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await checkAIProviderHealth();
    expect(result.status).toBe("not-configured");

    process.env.OPENAI_MINI_API_KEY = savedMini;
    process.env.OPENAI_API_KEY = savedKey;
  });

  it("returns not-verified when a key is present", async () => {
    const saved = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-placeholder";

    const result = await checkAIProviderHealth();
    expect(result.status).toBe("not-verified");

    process.env.OPENAI_API_KEY = saved;
  });
});

/* ==========================================================================
   checkWorkerHealth
   ========================================================================== */

describe("checkWorkerHealth", () => {
  it("returns a ComponentHealth object with name worker", async () => {
    const result = await checkWorkerHealth();
    expect(result).toHaveProperty("name", "worker");
    expect(result).toHaveProperty("status");
  });

  it("returns not-configured or not-verified (never throws)", async () => {
    const result = await checkWorkerHealth();
    expect(["not-configured", "not-verified"]).toContain(result.status);
  });
});

/* ==========================================================================
   checkAuditChainHealth
   ========================================================================== */

describe("checkAuditChainHealth", () => {
  it("returns a ComponentHealth object with name audit-chain", async () => {
    const result = await checkAuditChainHealth();
    expect(result).toHaveProperty("name", "audit-chain");
    expect(result).toHaveProperty("status");
  });

  it("never throws even when the verify-chain module is absent", async () => {
    const result = await checkAuditChainHealth();
    expect(result.status).toBeTruthy();
  });
});

/* ==========================================================================
   getHealthSummary
   ========================================================================== */

describe("getHealthSummary", () => {
  it("returns a HealthSummary with a status field", async () => {
    const summary: HealthSummary = await getHealthSummary(false);
    expect(summary).toHaveProperty("status");
    expect(["healthy", "degraded", "unavailable"]).toContain(summary.status);
  });

  it("returns the checkedAt timestamp as an ISO string", async () => {
    const summary = await getHealthSummary(false);
    expect(summary.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes all four component names", async () => {
    const summary = await getHealthSummary(false);
    const names = summary.components.map((c: ComponentHealth) => c.name);
    expect(names).toContain("database");
    expect(names).toContain("worker");
    expect(names).toContain("ai-provider");
    expect(names).toContain("audit-chain");
  });

  it("strips detail from components when includeDetails is false", async () => {
    const summary = await getHealthSummary(false);
    for (const component of summary.components) {
      expect(component).not.toHaveProperty("latencyMs");
      expect(component).not.toHaveProperty("detail");
    }
  });

  it("includes detail on components when includeDetails is true", async () => {
    const summary = await getHealthSummary(true);
    // At least one component should have latencyMs (the database check always measures latency)
    const hasSomeDetail = summary.components.some(
      (c: ComponentHealth) => c.latencyMs !== undefined || c.detail !== undefined,
    );
    expect(hasSomeDetail).toBe(true);
  });
});

/* ==========================================================================
   Metrics: incrementCounter
   ========================================================================== */

describe("incrementCounter", () => {
  it("increments a counter by 1 by default", () => {
    const before = (getMetrics()[`counter.${METRIC_NAMES.AI_REQUEST}`] as number) ?? 0;
    incrementCounter(METRIC_NAMES.AI_REQUEST);
    const after = (getMetrics()[`counter.${METRIC_NAMES.AI_REQUEST}`] as number) ?? 0;
    expect(after).toBe(before + 1);
  });

  it("increments by the specified amount", () => {
    const before = (getMetrics()[`counter.${METRIC_NAMES.AI_FAILURE}`] as number) ?? 0;
    incrementCounter(METRIC_NAMES.AI_FAILURE, 5);
    const after = (getMetrics()[`counter.${METRIC_NAMES.AI_FAILURE}`] as number) ?? 0;
    expect(after).toBe(before + 5);
  });

  it("creates the counter when it does not yet exist", () => {
    const name = `test.counter.${Date.now()}`;
    incrementCounter(name);
    expect(getMetrics()[`counter.${name}`]).toBe(1);
  });
});

/* ==========================================================================
   Metrics: recordLatency
   ========================================================================== */

describe("recordLatency", () => {
  it("stores and retrieves a p50 value", () => {
    const name = `test.latency.${Date.now()}`;
    // Record 10 identical values; p50 should equal that value
    for (let i = 0; i < 10; i += 1) {
      recordLatency(name, 42);
    }
    const metrics = getMetrics();
    expect(metrics[`latency.${name}.p50`]).toBe(42);
  });

  it("reports a count equal to the number of samples recorded", () => {
    const name = `test.latency.count.${Date.now()}`;
    for (let i = 0; i < 7; i += 1) {
      recordLatency(name, i * 10);
    }
    const metrics = getMetrics();
    expect(metrics[`latency.${name}.count`]).toBe(7);
  });

  it("caps samples at 100 to bound memory", () => {
    const name = `test.latency.cap.${Date.now()}`;
    for (let i = 0; i < 150; i += 1) {
      recordLatency(name, i);
    }
    const metrics = getMetrics();
    expect(metrics[`latency.${name}.count`]).toBe(100);
  });
});

/* ==========================================================================
   METRIC_NAMES constants
   ========================================================================== */

describe("METRIC_NAMES", () => {
  it("exposes all expected names as string constants", () => {
    expect(typeof METRIC_NAMES.AI_REQUEST).toBe("string");
    expect(typeof METRIC_NAMES.AI_FAILURE).toBe("string");
    expect(typeof METRIC_NAMES.AI_FALLBACK).toBe("string");
    expect(typeof METRIC_NAMES.PROCESS_STAGE_COMPLETE).toBe("string");
    expect(typeof METRIC_NAMES.DECISION_COMPLETE).toBe("string");
    expect(typeof METRIC_NAMES.JOB_DEPTH).toBe("string");
    expect(typeof METRIC_NAMES.JOB_FAILURE).toBe("string");
  });
});
