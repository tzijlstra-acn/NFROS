/**
 * In-memory metrics.
 *
 * Simple counters and latency histograms for local development.
 * State resets on process restart. For production, configure OTLP_ENDPOINT
 * to export to an OpenTelemetry-compatible backend.
 *
 * Nothing here touches the database or any external service.
 */

const counters: Map<string, number> = new Map();
const latencies: Map<string, number[]> = new Map();

export function incrementCounter(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function recordLatency(name: string, ms: number): void {
  const existing = latencies.get(name) ?? [];
  existing.push(ms);
  // Keep the last 100 samples to bound memory usage.
  if (existing.length > 100) existing.shift();
  latencies.set(name, existing);
}

export function getMetrics(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, value] of counters) {
    result[`counter.${name}`] = value;
  }
  for (const [name, values] of latencies) {
    const sorted = [...values].sort((a, b) => a - b);
    result[`latency.${name}.p50`] = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    result[`latency.${name}.p95`] = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    result[`latency.${name}.count`] = sorted.length;
  }
  return result;
}

/** Metric names used in the product. Centralised to prevent typos across call sites. */
export const METRIC_NAMES = {
  AI_REQUEST: "ai.request",
  AI_FAILURE: "ai.failure",
  AI_FALLBACK: "ai.fallback",
  PROCESS_STAGE_COMPLETE: "process.stage.complete",
  DECISION_COMPLETE: "decision.complete",
  JOB_DEPTH: "job.depth",
  JOB_FAILURE: "job.failure",
} as const;
