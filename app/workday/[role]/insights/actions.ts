"use server";

/**
 * Insights server actions: prepare an analysis, save it, commit a governed
 * action from it.
 *
 * Each validates its input, then calls the insights service, which goes
 * through the authority gate. The commit names an analysis and one of its
 * recommendations; the payload is read back from the stored analysis on the
 * server, never accepted from the browser. Server actions post to the
 * workday route, so the session guard in the middleware covers them.
 */

import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { createLogger } from "@/server/logging/redact";
import { revalidateWorkday } from "@/workday/revalidate";
import { prepareInsight, saveInsight, type PrepareOutcome } from "@/features/insights/service";
import { commitInsightAction, type WritebackReceipt } from "@/features/insights/writeback";

const log = createLogger("insights-actions");

const roleSchema = z.enum(ROLE_IDS);
const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);

const prepareSchema = z.object({
  roleId: roleSchema,
  question: z.string().trim().min(1).max(600),
  context: z.object({ kind: z.string().max(40), id: idSchema }).nullable().optional(),
  intentId: z.string().max(60).optional(),
});

export async function actionPrepareInsight(input: unknown): Promise<PrepareOutcome> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "failed",
      message: { en: "The question could not be read.", de: "Die Frage konnte nicht gelesen werden." },
      suggestions: [],
    };
  }
  try {
    const outcome = await prepareInsight({
      roleId: parsed.data.roleId as RoleId,
      question: parsed.data.question,
      context: parsed.data.context ?? null,
      ...(parsed.data.intentId ? { intentId: parsed.data.intentId } : {}),
    });
    if (outcome.ok) revalidateWorkday(parsed.data.roleId as RoleId);
    return outcome;
  } catch (error) {
    log.error("An analysis failed.", { error });
    return {
      ok: false,
      reason: "failed",
      message: { en: "The analysis could not be prepared. Nothing was changed.", de: "Die Analyse konnte nicht vorbereitet werden. Nichts wurde geaendert." },
      suggestions: [],
    };
  }
}

const saveSchema = z.object({ roleId: roleSchema, id: idSchema, title: z.string().trim().max(120) });

export async function actionSaveInsight(input: unknown): Promise<{ ok: boolean; title: string | null }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, title: null };
  const saved = saveInsight(parsed.data.roleId as RoleId, parsed.data.id, parsed.data.title);
  if (saved) revalidateWorkday(parsed.data.roleId as RoleId);
  return { ok: Boolean(saved), title: saved?.savedTitle ?? null };
}

const commitSchema = z.object({
  roleId: roleSchema,
  insightId: idSchema,
  recommendationId: idSchema,
  rationale: z.string().trim().max(1200),
  confirmed: z.boolean(),
});

export async function actionCommitInsightAction(input: unknown): Promise<WritebackReceipt> {
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: "not-found",
      message: { en: "The request could not be read, so nothing was changed.", de: "Die Anfrage konnte nicht gelesen werden, daher wurde nichts geaendert." },
      toolName: null,
      authorityClass: null,
      target: null,
      changes: [],
      createdRecordId: null,
      approvalId: null,
      auditEventId: null,
      receiptLines: [],
      actorUserId: null,
      atMoment: null,
      committedAt: null,
      evidenceIds: [],
    };
  }
  try {
    const receipt = await commitInsightAction({ ...parsed.data, roleId: parsed.data.roleId as RoleId });
    if (receipt.ok) revalidateWorkday(parsed.data.roleId as RoleId, "action");
    return receipt;
  } catch (error) {
    log.error("An insight write-back failed.", { error });
    return {
      ok: false,
      status: "refused",
      message: { en: "The change could not be recorded. Nothing was changed.", de: "Die Aenderung konnte nicht erfasst werden. Nichts wurde geaendert." },
      toolName: null,
      authorityClass: null,
      target: null,
      changes: [],
      createdRecordId: null,
      approvalId: null,
      auditEventId: null,
      receiptLines: [],
      actorUserId: null,
      atMoment: null,
      committedAt: null,
      evidenceIds: [],
    };
  }
}
