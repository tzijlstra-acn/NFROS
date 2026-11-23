/**
 * Preparing, storing and reading analyses.
 *
 * Server only. `prepareInsight` runs the `analyseQuestion` READ tool through
 * the gate in the role's Work context (the role's holder acting), then keeps
 * the validated response in `insight_runs`, so an analysis has a stable link,
 * can be saved to Insights, re-opened after a refresh and cited by the write
 * it leads to. Keeping the run is the person's own record of what they were
 * shown, like a saved view; the tool call is what the audit trail records.
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { RoleId } from "@/db/schema/core";
import { insightRuns } from "@/db/schema/portfolio";
import { executeTool } from "@/agents/tools/runtime";
import { workToolContext } from "@/features/work/governance";
import { requireScenarioState } from "@/scenario/engine/state";
import { recordAuditEvent } from "@/server/security/audit";
import { suggestedIntents } from "./intents";
import { validateInsight, type InsightResponse } from "./schema";
import { ANALYSE_QUESTION_TOOL, type AnalysisToolData } from "./tools";

export type PrepareOutcome =
  | { ok: true; id: string; response: InsightResponse }
  | {
      ok: false;
      reason: "no-intent" | "invalid" | "blocked" | "failed";
      message: { en: string; de: string };
      suggestions: Array<{ en: string; de: string }>;
    };

function suggestionsFor(roleId: RoleId) {
  return suggestedIntents(roleId, 6).map((intent) => intent.question);
}

export async function prepareInsight(input: {
  roleId: RoleId;
  question: string;
  context?: { kind: string; id: string } | null;
  intentId?: string;
}): Promise<PrepareOutcome> {
  const question = input.question.trim().slice(0, 600);
  const toolContext = workToolContext(input.roleId);
  const tool = await executeTool(
    ANALYSE_QUESTION_TOOL,
    { question, context: input.context ?? null, ...(input.intentId ? { intentId: input.intentId } : {}) },
    { ...toolContext, target: { kind: "insight", id: input.intentId ?? "question" } },
  );
  if (tool.outcome !== "executed") {
    return {
      ok: false,
      reason: tool.outcome === "blocked" ? "blocked" : "failed",
      message: {
        en: tool.outcome === "blocked" ? `The analysis was not run. ${tool.summary}` : "The analysis could not be prepared. Nothing was changed.",
        de: tool.outcome === "blocked" ? `Die Analyse wurde nicht ausgefuehrt. ${tool.summary}` : "Die Analyse konnte nicht vorbereitet werden. Nichts wurde geaendert.",
      },
      suggestions: suggestionsFor(input.roleId),
    };
  }
  const data = tool.data as AnalysisToolData;
  if (!data.ok) {
    return {
      ok: false,
      reason: data.reason,
      message:
        data.reason === "no-intent"
          ? {
              en: "This question is not one the Workspace analyses yet. These are the questions it answers from the records today.",
              de: "Diese Frage analysiert der Workspace noch nicht. Diese Fragen beantwortet er heute aus den Datensaetzen.",
            }
          : {
              en: "The analysis did not pass its quality check, so it is not shown. The issue was recorded.",
              de: "Die Analyse hat die Qualitaetspruefung nicht bestanden und wird nicht gezeigt. Der Befund wurde erfasst.",
            },
      suggestions: suggestionsFor(input.roleId),
    };
  }
  const state = requireScenarioState();
  const id = `INS-${randomUUID().slice(0, 8).toUpperCase()}`;
  getDb()
    .insert(insightRuns)
    .values({
      id,
      runId: state.runId,
      roleId: input.roleId,
      question,
      intentId: data.response.intentId,
      contextKind: input.context?.kind ?? null,
      contextId: input.context?.id ?? null,
      response: data.response as unknown as Record<string, unknown>,
      generatedAt: new Date().toISOString(),
      generatedAtMoment: state.currentMoment,
      actorUserId: toolContext.actingUserId,
      savedAt: null,
      savedTitle: null,
      auditEventId: tool.auditEventId ?? null,
    })
    .run();
  return { ok: true, id, response: data.response };
}

export interface StoredInsight {
  id: string;
  roleId: RoleId;
  question: string;
  intentId: string;
  generatedAt: string;
  generatedAtMoment: string;
  savedAt: string | null;
  savedTitle: string | null;
  auditEventId: string | null;
  /** Null when the stored response no longer passes the schema. */
  response: InsightResponse | null;
}

function toStored(row: typeof insightRuns.$inferSelect): StoredInsight {
  const checked = validateInsight(row.response);
  return {
    id: row.id,
    roleId: row.roleId,
    question: row.question,
    intentId: row.intentId,
    generatedAt: row.generatedAt,
    generatedAtMoment: row.generatedAtMoment,
    savedAt: row.savedAt,
    savedTitle: row.savedTitle,
    auditEventId: row.auditEventId,
    response: checked.ok ? checked.response : null,
  };
}

export function getInsight(roleId: RoleId, id: string): StoredInsight | null {
  const state = requireScenarioState();
  const row = getDb()
    .select()
    .from(insightRuns)
    .where(and(eq(insightRuns.runId, state.runId), eq(insightRuns.roleId, roleId), eq(insightRuns.id, id)))
    .get();
  return row ? toStored(row) : null;
}

export function listInsights(roleId: RoleId, options: { savedOnly?: boolean; limit?: number } = {}): StoredInsight[] {
  const state = requireScenarioState();
  const conditions = [eq(insightRuns.runId, state.runId), eq(insightRuns.roleId, roleId)];
  if (options.savedOnly) conditions.push(isNotNull(insightRuns.savedAt));
  return getDb()
    .select()
    .from(insightRuns)
    .where(and(...conditions))
    .orderBy(desc(insightRuns.generatedAt))
    .limit(options.limit ?? 20)
    .all()
    .map(toStored);
}

/** Saves an analysis to Insights under a title. A personal record; audited in the system category. */
export function saveInsight(roleId: RoleId, id: string, title: string): StoredInsight | null {
  const state = requireScenarioState();
  const existing = getInsight(roleId, id);
  if (!existing) return null;
  const savedTitle = title.trim().slice(0, 120) || existing.response?.title || existing.question;
  getDb()
    .update(insightRuns)
    .set({ savedAt: new Date().toISOString(), savedTitle })
    .where(and(eq(insightRuns.runId, state.runId), eq(insightRuns.id, id)))
    .run();
  const context = workToolContext(roleId);
  recordAuditEvent({
    runId: state.runId,
    atMoment: state.currentMoment,
    category: "system",
    action: "insight-saved",
    objectKind: "insight",
    objectId: id,
    summary: `${context.actingUserId} saved the analysis "${savedTitle}" to Insights.`,
    actorUserId: context.actingUserId,
    actorKind: "human",
    roleId,
  });
  return getInsight(roleId, id);
}
