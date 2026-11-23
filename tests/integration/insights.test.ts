/**
 * Insights end to end on a seeded database (NFR Workspace v3).
 *
 *   - every curated question produces a response that passes the schema,
 *     through the analyseQuestion READ tool and the authority gate;
 *   - the numbers are the stories the data was built to hold;
 *   - an analysis changes no record and leaves an audited tool call;
 *   - analyses respect the scenario moment: the 14:05 event is invisible at
 *     07:45 and visible after it;
 *   - runs are stored per role, can be saved, and are cleared by reset.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { setMoment } from "@/scenario/engine/state";
import { INTENTS } from "@/features/insights/intents";
import { getInsight, listInsights, prepareInsight, saveInsight } from "@/features/insights/service";

function recordFingerprint(): string {
  const tables = ["suppliers", "controls", "issues", "actions", "decisions", "approvals", "risk_acceptances"];
  return tables.map((table) => `${table}:${rowCount(table)}`).join(",");
}

beforeAll(() => {
  createTemporaryDatabase("insights");
  seedScenario(DEFAULT_RUN_ID);
}, 600_000);

afterAll(() => {
  destroyTemporaryDatabase();
});

describe("insights", () => {
  it("answers every curated question for both Available roles with a valid response", async () => {
    for (const roleId of ["tprm", "rcsa"] as const) {
      for (const intent of INTENTS) {
        const outcome = await prepareInsight({ roleId, question: intent.question.en });
        expect(outcome.ok, `${roleId} ${intent.id}`).toBe(true);
        if (outcome.ok) {
          expect(outcome.response.intentId).toBe(intent.id);
          expect(outcome.response.visualisations.length).toBeGreaterThan(0);
          expect(outcome.response.conclusion.length).toBeGreaterThan(20);
        }
      }
    }
  });

  it("finds the stories the portfolio was built to hold", async () => {
    const deterioration = await prepareInsight({ roleId: "tprm", question: "Which critical third-party services are deteriorating, and why?" });
    expect(deterioration.ok && deterioration.response.conclusion).toContain("Novalink");
    const concentration = await prepareInsight({ roleId: "tprm", question: "Where do we have provider concentration across critical services?" });
    expect(concentration.ok && concentration.response.conclusion).toContain("Basalt Cloud");
    const acceptances = await prepareInsight({ roleId: "tprm", question: "Which risk acceptances expire in the next 90 days?" });
    expect(acceptances.ok && acceptances.response.metrics.find((metric) => metric.id === "m-expiring")?.value).toBe(7);
    const controls = await prepareInsight({ roleId: "rcsa", question: "Which controls are repeatedly failing?" });
    expect(controls.ok && controls.response.conclusion).toContain("CTL-PAY-014");
  });

  it("changes no record and records the call as a READ tool call", async () => {
    const before = recordFingerprint();
    const calls = (getSqlite().prepare("select count(*) as n from tool_calls where tool_name = 'analyseQuestion'").get() as { n: number }).n;
    await prepareInsight({ roleId: "tprm", question: "Which high-severity issues are overdue?" });
    expect(recordFingerprint()).toBe(before);
    const after = (getSqlite().prepare("select count(*) as n from tool_calls where tool_name = 'analyseQuestion'").get() as { n: number }).n;
    expect(after).toBe(calls + 1);
  });

  it("keeps the 14:05 event out of an analysis at 07:45", async () => {
    setMoment("07:45");
    const morning = await prepareInsight({ roleId: "tprm", question: "What changed in the payment service review since last quarter?" });
    const morningIds = morning.ok ? morning.response.evidence.map((item) => item.recordId) : [];
    expect(morningIds).not.toContain("INC-2026-0412");
    setMoment("15:00");
    const afternoon = await prepareInsight({ roleId: "tprm", question: "What changed in the payment service review since last quarter?" });
    const afternoonIds = afternoon.ok ? afternoon.response.evidence.map((item) => item.recordId) : [];
    expect(afternoonIds).toContain("INC-2026-0412");
    setMoment("07:45");
  });

  it("declines a question it cannot analyse and offers the ones it can", async () => {
    const outcome = await prepareInsight({ roleId: "tprm", question: "What is the weather like?" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe("no-intent");
      expect(outcome.suggestions.length).toBeGreaterThan(3);
    }
  });

  it("stores runs per role, saves one, and reset clears them", async () => {
    const outcome = await prepareInsight({ roleId: "tprm", question: "Show operational resilience gaps by service." });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getInsight("tprm", outcome.id)?.response?.intentId).toBe("resilience-gaps");
    expect(getInsight("rcsa", outcome.id)).toBeNull();
    saveInsight("tprm", outcome.id, "Resilience gaps for the committee");
    expect(listInsights("tprm", { savedOnly: true }).map((entry) => entry.savedTitle)).toContain("Resilience gaps for the committee");
    seedScenario(DEFAULT_RUN_ID);
    expect(rowCount("insight_runs")).toBe(0);
  });
});
