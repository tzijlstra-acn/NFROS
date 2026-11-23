"use server";

/**
 * Agents server actions: save an analysis agent, run it, submit or retire it.
 * Each validates its input and calls the agents service; a run goes through
 * the analyseQuestion READ tool and the authority gate.
 */

import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { revalidateWorkday } from "@/workday/revalidate";
import { createAgent, runAgent, setAgentStatus } from "@/features/agents/service";
import { INTENT_IDS } from "@/features/insights/intents";

const roleSchema = z.enum(ROLE_IDS);
const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);

const createSchema = z.object({
  roleId: roleSchema,
  name: z.string().trim().min(1).max(120),
  outcome: z.string().trim().max(600),
  question: z.string().trim().min(1).max(600),
  intentId: z.enum(INTENT_IDS),
  schedule: z.enum(["manual", "weekly"]),
  submit: z.boolean(),
  sourceInsightId: idSchema.nullable(),
});

export async function actionCreateAgent(input: unknown): Promise<{ ok: boolean; agentId: string | null }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, agentId: null };
  const result = createAgent({ ...parsed.data, roleId: parsed.data.roleId as RoleId });
  if (result.ok) revalidateWorkday(parsed.data.roleId as RoleId);
  return { ok: result.ok, agentId: result.ok ? result.agent.id : null };
}

const runSchema = z.object({ roleId: roleSchema, agentId: idSchema });

export async function actionRunAgent(input: unknown): Promise<{ ok: boolean; insightId: string | null; message: string | null }> {
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) return { ok: false, insightId: null, message: null };
  const outcome = await runAgent(parsed.data.roleId as RoleId, parsed.data.agentId);
  if (outcome.ok) revalidateWorkday(parsed.data.roleId as RoleId);
  return outcome.ok ? { ok: true, insightId: outcome.id, message: null } : { ok: false, insightId: null, message: outcome.message.en };
}

const statusSchema = z.object({ roleId: roleSchema, agentId: idSchema, status: z.enum(["submitted", "retired"]) });

export async function actionSetAgentStatus(input: unknown): Promise<{ ok: boolean }> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const agent = setAgentStatus(parsed.data.roleId as RoleId, parsed.data.agentId, parsed.data.status);
  if (agent) revalidateWorkday(parsed.data.roleId as RoleId);
  return { ok: Boolean(agent) };
}
