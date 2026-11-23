/**
 * Analysis agents: save, run, promote, retire.
 *
 * Server only. An agent runs its saved intent through `prepareInsight`, the
 * same governed READ path as a question typed by the person, in the person's
 * Work context, so an agent can never read more than its owner. The intent
 * is passed explicitly, never re-routed from the text, so a run asks the
 * same analysis every time. Saving and changing an agent are the person's
 * own records, audited in the system category. Submitting for review asks a
 * reviewer to make it a team template; the owner cannot promote it.
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { RoleId } from "@/db/schema/core";
import { analysisAgents, type AgentStatus } from "@/db/schema/agents";
import { insightRuns } from "@/db/schema/portfolio";
import { workToolContext } from "@/features/work/governance";
import { requireScenarioState } from "@/scenario/engine/state";
import { recordAuditEvent } from "@/server/security/audit";
import { getIntent } from "@/features/insights/intents";
import { prepareInsight, type PrepareOutcome } from "@/features/insights/service";

export type AgentRow = typeof analysisAgents.$inferSelect;

function audit(roleId: RoleId, action: string, agentId: string, summary: string): void {
  const state = requireScenarioState();
  const context = workToolContext(roleId);
  recordAuditEvent({
    runId: state.runId,
    atMoment: state.currentMoment,
    category: "system",
    action,
    objectKind: "analysis-agent",
    objectId: agentId,
    summary: `${context.actingUserId} ${summary}`,
    actorUserId: context.actingUserId,
    actorKind: "human",
    roleId,
  });
}

export function listAgents(roleId: RoleId): AgentRow[] {
  const state = requireScenarioState();
  const userId = workToolContext(roleId).actingUserId;
  return getDb()
    .select()
    .from(analysisAgents)
    .where(and(eq(analysisAgents.runId, state.runId), eq(analysisAgents.roleId, roleId), eq(analysisAgents.userId, userId)))
    .orderBy(desc(analysisAgents.updatedAt))
    .all();
}

export function getAgent(roleId: RoleId, agentId: string): AgentRow | null {
  return listAgents(roleId).find((agent) => agent.id === agentId) ?? null;
}

/** The agent's past runs, newest first: the insight runs it prepared. */
export function agentRuns(roleId: RoleId, agentId: string, limit = 5) {
  const state = requireScenarioState();
  return getDb()
    .select({ id: insightRuns.id, generatedAt: insightRuns.generatedAt, moment: insightRuns.generatedAtMoment, response: insightRuns.response })
    .from(insightRuns)
    .where(and(eq(insightRuns.runId, state.runId), eq(insightRuns.roleId, roleId), eq(insightRuns.contextKind, "agent"), eq(insightRuns.contextId, agentId)))
    .orderBy(desc(insightRuns.generatedAt))
    .limit(limit)
    .all()
    .map((row) => ({ id: row.id, generatedAt: row.generatedAt, moment: row.moment, conclusion: String((row.response as { conclusion?: unknown }).conclusion ?? "") }));
}

export type CreateAgentResult = { ok: true; agent: AgentRow } | { ok: false; reason: "unknown-intent" | "invalid" };

export function createAgent(input: {
  roleId: RoleId;
  name: string;
  outcome: string;
  question: string;
  intentId: string;
  schedule: "manual" | "weekly";
  submit: boolean;
  sourceInsightId: string | null;
}): CreateAgentResult {
  if (!getIntent(input.intentId)) return { ok: false, reason: "unknown-intent" };
  const name = input.name.trim().slice(0, 120);
  if (name.length === 0) return { ok: false, reason: "invalid" };
  const state = requireScenarioState();
  const context = workToolContext(input.roleId);
  const now = new Date().toISOString();
  const id = `AGT-${randomUUID().slice(0, 8).toUpperCase()}`;
  const status: AgentStatus = input.submit ? "submitted" : "personal";
  getDb()
    .insert(analysisAgents)
    .values({
      id,
      runId: state.runId,
      userId: context.actingUserId,
      roleId: input.roleId,
      name,
      outcome: input.outcome.trim().slice(0, 600) || input.question,
      question: input.question.trim().slice(0, 600),
      intentId: input.intentId,
      schedule: input.schedule,
      status,
      sourceInsightId: input.sourceInsightId,
      createdAt: now,
      createdAtMoment: state.currentMoment,
      updatedAt: now,
      lastRunInsightId: null,
      lastRunAt: null,
      runCount: 0,
    })
    .run();
  audit(input.roleId, "agent-saved", id, `saved the analysis agent "${name}" (${input.intentId}, ${input.schedule}${input.submit ? ", submitted for team review" : ""}).`);
  const agent = getAgent(input.roleId, id);
  return agent ? { ok: true, agent } : { ok: false, reason: "invalid" };
}

export async function runAgent(roleId: RoleId, agentId: string): Promise<PrepareOutcome | { ok: false; reason: "not-found"; message: { en: string; de: string }; suggestions: [] }> {
  const agent = getAgent(roleId, agentId);
  if (!agent || agent.status === "retired") {
    return { ok: false, reason: "not-found", message: { en: "This agent is not available.", de: "Dieser Agent ist nicht verfuegbar." }, suggestions: [] };
  }
  const outcome = await prepareInsight({ roleId, question: agent.question, intentId: agent.intentId, context: { kind: "agent", id: agent.id } });
  if (outcome.ok) {
    const state = requireScenarioState();
    getDb()
      .update(analysisAgents)
      .set({ lastRunInsightId: outcome.id, lastRunAt: new Date().toISOString(), runCount: agent.runCount + 1, updatedAt: new Date().toISOString() })
      .where(and(eq(analysisAgents.runId, state.runId), eq(analysisAgents.id, agent.id)))
      .run();
  }
  return outcome;
}

/** The owner may submit for review or retire. Making a template is a reviewer's step and is not offered here. */
export function setAgentStatus(roleId: RoleId, agentId: string, status: "submitted" | "retired"): AgentRow | null {
  const agent = getAgent(roleId, agentId);
  if (!agent) return null;
  const state = requireScenarioState();
  getDb()
    .update(analysisAgents)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(and(eq(analysisAgents.runId, state.runId), eq(analysisAgents.id, agent.id)))
    .run();
  audit(roleId, status === "submitted" ? "agent-submitted" : "agent-retired", agent.id, status === "submitted" ? `submitted "${agent.name}" for review as a team template.` : `retired "${agent.name}".`);
  return getAgent(roleId, agentId);
}
