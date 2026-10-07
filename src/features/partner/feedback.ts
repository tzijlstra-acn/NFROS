/**
 * Structured feedback on what the AI Partner produced (plan 4.11, Feedback).
 *
 * Server only. Six kinds (Useful, Not useful, Wrong source, Wrong
 * interpretation, Missing context, Too verbose) on three outputs: a
 * suggestion, a chat answer and a routine run. Each record is linked, at the
 * moment it is given, to what the Product Owner Console needs to act on it:
 * the output, the task kind, the configuration and prompt version that
 * produced it, the model profile, the sources it rested on and the role.
 * The configuration and profile are read from the code registry
 * (`src/ai/prompt-registry.ts`) when a released configuration exists for the
 * role and task; when none does, they are stored as null rather than guessed.
 *
 * Giving a kind a second time takes it back, which is how the dock's toggle
 * works. "Useful" and "Not useful" exclude each other.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { aiSuggestions, chatThreads, chatTurns } from "@/db/schema/live";
import { aiFeedback, type AIFeedbackKind, type AIFeedbackTargetKind } from "@/db/schema/ai-partner";
import { getRole } from "@/db/repositories/workday";
import { recordAIFeedback, removeAIFeedback, type AIFeedbackRow } from "@/db/repositories/ai-feedback";
import { findRoutineRunsForObject, getRoutineRun, getRoutineRunOutputs } from "@/db/repositories/ai-routine-runs";
import { getReleasedConfig } from "@/ai/prompt-registry";
import type { ScenarioState } from "@/scenario/engine/state";
import { routineKindOf } from "@/features/routines/registry";
import { exclusiveWith, type PartnerFeedbackKind, type PartnerFeedbackTarget } from "./rules";
import { PARTNER_PROMPT_VERSIONS, type PartnerTaskKind } from "./tasks";

const db = () => getDb();

let sequence = 0;
function feedbackId(): string {
  sequence += 1;
  return `AIF-${Date.now().toString(36).toUpperCase()}-${String(sequence).padStart(4, "0")}`;
}

interface ResolvedTarget {
  roleId: RoleId;
  taskKind: PartnerTaskKind;
  sourceRefs: string[];
}

/** Reads the output the feedback is about, for its links. Null when it does not exist for the role. */
function resolveTarget(roleId: RoleId, kind: PartnerFeedbackTarget, id: string, runId: string): ResolvedTarget | null {
  if (kind === "suggestion") {
    const row = db()
      .select()
      .from(aiSuggestions)
      .where(and(eq(aiSuggestions.runId, runId), eq(aiSuggestions.id, id)))
      .get();
    if (!row || row.roleId !== roleId) return null;
    const run = findRoutineRunsForObject("suggestion", id, runId)[0];
    return {
      roleId,
      taskKind: run ? (routineKindOf(run.routineId, runId) ?? "suggestion") : "suggestion",
      sourceRefs: [...new Set([...(row.evidenceIds ?? []), ...(row.sourceConnectorIds ?? [])])].slice(0, 40),
    };
  }
  if (kind === "chat-turn") {
    const turn = db()
      .select()
      .from(chatTurns)
      .where(and(eq(chatTurns.runId, runId), eq(chatTurns.id, id)))
      .get();
    if (!turn || turn.author !== "partner") return null;
    const thread = db().select().from(chatThreads).where(eq(chatThreads.id, turn.threadId)).get();
    if (!thread || thread.roleId !== roleId) return null;
    const refs = new Set<string>();
    for (const part of turn.parts ?? []) for (const ref of part.refs ?? []) refs.add(ref);
    return { roleId, taskKind: "chat-answer", sourceRefs: [...refs].slice(0, 40) };
  }
  const run = getRoutineRun(id);
  if (!run || run.runId !== runId || run.roleId !== roleId) return null;
  return {
    roleId,
    taskKind: routineKindOf(run.routineId, runId) ?? "suggestion",
    sourceRefs: getRoutineRunOutputs(run.id).map((output) => output.objectId).slice(0, 40),
  };
}

export interface FeedbackInput {
  roleId: RoleId;
  targetKind: PartnerFeedbackTarget;
  targetId: string;
  kind: PartnerFeedbackKind;
  comment?: string;
}

export type FeedbackResult =
  | { ok: true; given: boolean; kinds: AIFeedbackKind[]; feedback: AIFeedbackRow | null }
  | { ok: false; message: { en: string; de: string } };

/** The person's feedback kinds on one output, in the plan's order. */
export function feedbackKindsOn(userId: string, targetKind: AIFeedbackTargetKind, targetId: string, runId = DEFAULT_RUN_ID): AIFeedbackKind[] {
  return db()
    .select({ kind: aiFeedback.kind })
    .from(aiFeedback)
    .where(
      and(
        eq(aiFeedback.runId, runId),
        eq(aiFeedback.userId, userId),
        eq(aiFeedback.targetKind, targetKind),
        eq(aiFeedback.targetId, targetId),
      ),
    )
    .all()
    .map((row) => row.kind);
}

/** Every output the person gave feedback on in a role: target key to kinds. */
export function feedbackGivenBy(userId: string, roleId: RoleId, runId = DEFAULT_RUN_ID): Record<string, AIFeedbackKind[]> {
  const map: Record<string, AIFeedbackKind[]> = {};
  for (const row of db()
    .select({ targetKind: aiFeedback.targetKind, targetId: aiFeedback.targetId, kind: aiFeedback.kind })
    .from(aiFeedback)
    .where(and(eq(aiFeedback.runId, runId), eq(aiFeedback.userId, userId), eq(aiFeedback.roleId, roleId)))
    .all()) {
    const key = `${row.targetKind}:${row.targetId}`;
    (map[key] ??= []).push(row.kind);
  }
  return map;
}

/**
 * Gives or takes back one kind of feedback.
 *
 * Toggle semantics: a kind the person already gave on the output is removed;
 * otherwise it is recorded with its links, and its exclusive counterpart, if
 * given, is removed.
 */
export function togglePartnerFeedback(input: FeedbackInput, state: ScenarioState): FeedbackResult {
  const runId = state.runId ?? DEFAULT_RUN_ID;
  const userId = getRole(input.roleId, runId)?.holderUserId;
  if (!userId) return { ok: false, message: { en: "The role has no holder.", de: "Die Rolle hat keine Inhaberin." } };
  const target = resolveTarget(input.roleId, input.targetKind, input.targetId, runId);
  if (!target) {
    return { ok: false, message: { en: "This output does not exist for the role.", de: "Diese Ausgabe existiert fuer die Rolle nicht." } };
  }

  const existing = db()
    .select()
    .from(aiFeedback)
    .where(
      and(
        eq(aiFeedback.runId, runId),
        eq(aiFeedback.userId, userId),
        eq(aiFeedback.targetKind, input.targetKind),
        eq(aiFeedback.targetId, input.targetId),
      ),
    )
    .all();

  const same = existing.find((row) => row.kind === input.kind);
  if (same) {
    removeAIFeedback(same.id, userId, runId);
    return { ok: true, given: false, kinds: feedbackKindsOn(userId, input.targetKind, input.targetId, runId), feedback: null };
  }

  const opposite = exclusiveWith(input.kind);
  const clash = opposite ? existing.find((row) => row.kind === opposite) : undefined;
  if (clash) removeAIFeedback(clash.id, userId, runId);

  const configuration = getReleasedConfig(input.roleId, target.taskKind);
  const { feedback } = recordAIFeedback({
    id: feedbackId(),
    runId,
    roleId: input.roleId,
    userId,
    kind: input.kind,
    targetKind: input.targetKind,
    targetId: input.targetId,
    taskKind: target.taskKind,
    configurationId: configuration?.id ?? null,
    promptVersion: configuration?.promptVersion ?? PARTNER_PROMPT_VERSIONS[target.taskKind],
    modelProfileId: configuration?.modelProfileId ?? null,
    sourceRefs: target.sourceRefs,
    processRunId: null,
    stageId: null,
    comment: (input.comment ?? "").trim().slice(0, 600),
    atMoment: state.currentMoment,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, given: true, kinds: feedbackKindsOn(userId, input.targetKind, input.targetId, runId), feedback };
}
