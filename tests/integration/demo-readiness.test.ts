/**
 * Demonstration readiness (v6 meeting readiness).
 *
 *   - a freshly seeded day is ready and clean, and the first scripted question
 *     builds its visual answer from the records;
 *   - the check writes nothing: no analysis run and no audit event;
 *   - an analysis makes the day "used" (still ready, no longer clean);
 *   - the reset makes it clean again, and the first answer is unchanged.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { seedScenario } from "@/db/seed/run";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { checkDemoReadiness, FIRST_QUESTION } from "@/demo/readiness";
import { prepareInsight } from "@/features/insights/service";
import { resetScenarioDay } from "@/scenario/engine/reset";

beforeAll(() => {
  createTemporaryDatabase("demo-readiness");
  seedScenario(DEFAULT_RUN_ID);
}, 600_000);

afterAll(() => {
  destroyTemporaryDatabase();
});

describe("demo readiness", () => {
  it("reports a seeded day as ready and clean, with the first answer built from the records", () => {
    const before = { runs: rowCount("insight_runs"), audit: rowCount("audit_events") };
    const r = checkDemoReadiness();
    expect(r.ready, JSON.stringify(r.checks)).toBe(true);
    expect(r.cleanDay).toBe(true);
    expect(r.firstAnswer?.intentId).toBeTruthy();
    expect(r.firstAnswer?.visualisations.length).toBeGreaterThan(0);
    expect(r.firstAnswer?.conclusion).toMatch(/deteriorat/i);
    expect(r.scenario).toEqual({ date: "2026-10-06", moment: "07:45" });
    // Read-only: nothing stored, nothing audited
    expect(rowCount("insight_runs")).toBe(before.runs);
    expect(rowCount("audit_events")).toBe(before.audit);
  });

  it("marks a used day as not clean, and the reset restores a clean day with the same answer", async () => {
    const first = checkDemoReadiness().firstAnswer;
    const outcome = await prepareInsight({ roleId: "tprm", question: FIRST_QUESTION });
    expect(outcome.ok).toBe(true);
    const used = checkDemoReadiness();
    expect(used.ready).toBe(true);
    expect(used.cleanDay).toBe(false);
    expect(used.checks.find((c) => c.name === "clean day")?.detail).toMatch(/reset/);

    resetScenarioDay();
    const again = checkDemoReadiness();
    expect(again.cleanDay).toBe(true);
    expect(again.firstAnswer?.conclusion).toBe(first?.conclusion);
    expect(again.firstAnswer?.metrics).toEqual(first?.metrics);
  });
});
