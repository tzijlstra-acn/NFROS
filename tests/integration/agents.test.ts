/**
 * Analysis agents (NFR Workspace v3, migration 0011).
 *
 *   - an agent is saved from an analysis and runs that same analysis again,
 *     through the analyseQuestion READ tool, with its runs as history;
 *   - running an agent changes no record;
 *   - the owner can submit it for review or retire it, not promote it;
 *   - another role cannot see or run it;
 *   - reset clears agents.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { prepareInsight } from "@/features/insights/service";
import { agentRuns, createAgent, getAgent, listAgents, runAgent, setAgentStatus } from "@/features/agents/service";

beforeAll(() => {
  createTemporaryDatabase("agents");
  seedScenario(DEFAULT_RUN_ID);
}, 600_000);

afterAll(() => {
  destroyTemporaryDatabase();
});

describe("analysis agents", () => {
  it("saves an agent from an analysis, runs it, and keeps its runs as history", async () => {
    const analysis = await prepareInsight({ roleId: "tprm", question: "Which risk acceptances expire in the next 90 days?" });
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    const created = createAgent({
      roleId: "tprm",
      name: "Expiring acceptances, weekly",
      outcome: "Tell me every Monday which acceptances expire within 90 days.",
      question: analysis.response.question,
      intentId: analysis.response.intentId,
      schedule: "weekly",
      submit: false,
      sourceInsightId: analysis.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const before = ["actions", "issues", "approvals", "risk_acceptances"].map((table) => rowCount(table)).join(",");
    const run = await runAgent("tprm", created.agent.id);
    expect(run.ok).toBe(true);
    expect(["actions", "issues", "approvals", "risk_acceptances"].map((table) => rowCount(table)).join(",")).toBe(before);
    if (run.ok) expect(run.response.intentId).toBe("expiring-acceptances");
    expect(getAgent("tprm", created.agent.id)?.runCount).toBe(1);
    expect(agentRuns("tprm", created.agent.id)).toHaveLength(1);
    const calls = getSqlite().prepare("select count(*) as n from tool_calls where tool_name = 'analyseQuestion'").get() as { n: number };
    expect(calls.n).toBeGreaterThanOrEqual(2);
  });

  it("refuses an unknown analysis and keeps agents per role", () => {
    expect(createAgent({ roleId: "tprm", name: "x", outcome: "", question: "x", intentId: "nope", schedule: "manual", submit: false, sourceInsightId: null }).ok).toBe(false);
    expect(listAgents("rcsa")).toHaveLength(0);
  });

  it("lets the owner submit and retire, and a retired agent does not run", async () => {
    const [agent] = listAgents("tprm");
    if (!agent) throw new Error("no agent");
    expect(setAgentStatus("tprm", agent.id, "submitted")?.status).toBe("submitted");
    expect(setAgentStatus("tprm", agent.id, "retired")?.status).toBe("retired");
    expect((await runAgent("tprm", agent.id)).ok).toBe(false);
  });

  it("is cleared by reset", () => {
    seedScenario(DEFAULT_RUN_ID);
    expect(rowCount("analysis_agents")).toBe(0);
  });
});
