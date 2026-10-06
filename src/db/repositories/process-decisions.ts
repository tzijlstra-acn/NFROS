/**
 * Decisions that belong to a process run (migration 0007).
 *
 * Until 0007 a stage contract could only wait for a seeded decision by id, so
 * every run of the RCSA Cycle Assistant met the Q4 cycle's judgments, and an
 * event-driven reassessment stopped at Stage 2. This module is how a run gets
 * judgments of its own: `createDecisionForRun` writes a decision and its
 * options for the run and the stage that waits for it, and
 * `copyDecisionForRun` does so from a template decision (the Q4 decision a
 * contract names), as the RCSA stages workstream described.
 *
 * It writes what the seed writes, a `decisions` row and its
 * `decision_options`, and keeps the decision engine's rules for a new
 * decision itself, because they are properties of the record:
 *
 *   - the decision is open: no option chosen, no rationale, nobody recorded as
 *     having decided it. Only a person, through the engine
 *     (`recordDecisionAndExecute`), ever records a judgment;
 *   - it offers a choice: at least two options, each with its consequences,
 *     from which the engine plans the receipt; no option is pre-selected;
 *   - it belongs to the run's role: a decision for another role's run is
 *     refused, as the engine refuses a cross-role recording;
 *   - an id is written once: creating it again returns the existing decision
 *     and writes nothing.
 *
 * What it does not do is announce the decision. The caller's governed path
 * publishes `decision-requested` on the backbone and writes the audit row, as
 * it does for every other domain change.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { decisionOptions, decisions } from "@/db/schema/decisions";
import { roleAppRuns } from "@/db/schema/role-app-runtime";

const db = () => getDb();

export type ProcessDecision = typeof decisions.$inferSelect;
export type ProcessDecisionOption = typeof decisionOptions.$inferSelect;

/**
 * The fields a creator may set. The open state and the process link are set
 * here; `runId` defaults to the active scenario run.
 */
export type NewProcessDecision = Omit<
  typeof decisions.$inferInsert,
  "runId" | "status" | "chosenOptionId" | "recordedRationale" | "decidedByUserId" | "decidedAtMoment" | "decidedAt" | "processRunId" | "processStageId"
> & { runId?: string };
export type NewProcessDecisionOption = Omit<typeof decisionOptions.$inferInsert, "decisionId" | "runId">;

export interface CreateDecisionForRunInput {
  decision: NewProcessDecision;
  options: readonly NewProcessDecisionOption[];
  processRunId: string;
  /** The stage that waits for the decision. Null for a run-level judgment. */
  processStageId: string | null;
}

export type CreateDecisionForRunResult =
  | { ok: true; created: boolean; decision: ProcessDecision; options: ProcessDecisionOption[] }
  | { ok: false; reason: "unknown-process-run" | "role-mismatch" | "too-few-options" | "duplicate-option-id" | "already-exists-elsewhere" };

function optionsOf(decisionId: string, runId: string): ProcessDecisionOption[] {
  return db()
    .select()
    .from(decisionOptions)
    .where(and(eq(decisionOptions.runId, runId), eq(decisionOptions.decisionId, decisionId)))
    .orderBy(asc(decisionOptions.sortOrder), asc(decisionOptions.id))
    .all();
}

function getDecision(id: string, runId: string): ProcessDecision | undefined {
  return db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.id, id)))
    .get();
}

/**
 * Creates an open decision, with its options, for a process run and stage.
 * Refused, writing nothing, for an unknown run, another role's run, fewer than
 * two options or a repeated option id.
 */
export function createDecisionForRun(input: CreateDecisionForRunInput): CreateDecisionForRunResult {
  const runId = input.decision.runId ?? DEFAULT_RUN_ID;

  const write = getSqlite().transaction((): CreateDecisionForRunResult => {
    const run = db()
      .select({ roleId: roleAppRuns.roleId })
      .from(roleAppRuns)
      .where(and(eq(roleAppRuns.runId, runId), eq(roleAppRuns.id, input.processRunId)))
      .get();
    if (!run) return { ok: false, reason: "unknown-process-run" };
    if (run.roleId !== input.decision.roleId) return { ok: false, reason: "role-mismatch" };

    const existing = getDecision(input.decision.id, runId);
    if (existing) {
      if (existing.processRunId !== input.processRunId || existing.processStageId !== input.processStageId) {
        return { ok: false, reason: "already-exists-elsewhere" };
      }
      return { ok: true, created: false, decision: existing, options: optionsOf(existing.id, runId) };
    }

    if (input.options.length < 2) return { ok: false, reason: "too-few-options" };
    if (new Set(input.options.map((option) => option.id)).size !== input.options.length) {
      return { ok: false, reason: "duplicate-option-id" };
    }

    db()
      .insert(decisions)
      .values({
        ...input.decision,
        runId,
        status: "open",
        chosenOptionId: null,
        recordedRationale: "",
        decidedByUserId: null,
        decidedAtMoment: null,
        decidedAt: null,
        processRunId: input.processRunId,
        processStageId: input.processStageId,
      })
      .run();
    db()
      .insert(decisionOptions)
      .values(input.options.map((option) => ({ ...option, runId, decisionId: input.decision.id })))
      .run();

    const decision = getDecision(input.decision.id, runId);
    if (!decision) throw new Error(`Decision ${input.decision.id} was not written.`);
    return { ok: true, created: true, decision, options: optionsOf(decision.id, runId) };
  });

  return write();
}

export interface CopyDecisionTarget {
  /** The new decision's id. */
  id: string;
  /** The new decision's reference, shown beside its title. */
  reference: string;
  processRunId: string;
  processStageId: string | null;
  /** When the new decision is presented. Defaults to the template's moment. */
  presentedAtMoment?: string;
  /** The object the new run's decision is about. Defaults to the template's. */
  relatedObjectKind?: string | null;
  relatedObjectId?: string | null;
  /** By when it is needed. The template's own due time belongs to the template's run, so none is copied. */
  dueAt?: string | null;
  runId?: string;
}

/**
 * Creates a run's own decision from a template decision and its options.
 *
 * The question, the evidence, the stated uncertainty and the options with
 * their consequences are copied; the recorded state never is, so a recorded
 * template still yields an open decision. Option ids are the new decision's id
 * with the option's position. Undefined when the template does not exist.
 */
export function copyDecisionForRun(templateDecisionId: string, target: CopyDecisionTarget): CreateDecisionForRunResult | undefined {
  const runId = target.runId ?? DEFAULT_RUN_ID;
  const template = getDecision(templateDecisionId, runId);
  if (!template) return undefined;
  const templateOptions = optionsOf(template.id, runId);

  return createDecisionForRun({
    decision: {
      id: target.id,
      runId,
      reference: target.reference,
      roleId: template.roleId,
      entityId: template.entityId,
      title: template.title,
      titleDe: template.titleDe,
      question: template.question,
      judgmentKind: template.judgmentKind,
      presentedAtMoment: target.presentedAtMoment ?? template.presentedAtMoment,
      priorityRank: template.priorityRank,
      whyThisMatters: template.whyThisMatters,
      preparedPosition: template.preparedPosition,
      supportingEvidenceIds: template.supportingEvidenceIds,
      opposingEvidenceIds: template.opposingEvidenceIds,
      uncertaintyNote: template.uncertaintyNote,
      confidence: template.confidence,
      requiredAuthority: template.requiredAuthority,
      relatedObjectKind: target.relatedObjectKind !== undefined ? target.relatedObjectKind : template.relatedObjectKind,
      relatedObjectId: target.relatedObjectId !== undefined ? target.relatedObjectId : template.relatedObjectId,
      fromSharedEvent: false,
      sharedThreadId: null,
      dueAt: target.dueAt ?? null,
    },
    options: templateOptions.map((option, index) => ({
      id: `${target.id}-O${String(index + 1).padStart(2, "0")}`,
      label: option.label,
      labelDe: option.labelDe,
      description: option.description,
      isRecommended: option.isRecommended,
      recommendationBasis: option.recommendationBasis,
      riskImplication: option.riskImplication,
      consequences: option.consequences,
      requiresApproval: option.requiresApproval,
      sortOrder: option.sortOrder,
    })),
    processRunId: target.processRunId,
    processStageId: target.processStageId,
  });
}

/** A run's decisions, by stage and presentation. */
export function listDecisionsForProcessRun(processRunId: string, runId = DEFAULT_RUN_ID): ProcessDecision[] {
  return db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.processRunId, processRunId)))
    .orderBy(asc(decisions.processStageId), asc(decisions.presentedAtMoment), asc(decisions.id))
    .all();
}

/** The decisions one stage of one run waits for. */
export function getDecisionsForStage(processRunId: string, stageId: string, runId = DEFAULT_RUN_ID): ProcessDecision[] {
  return db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.processRunId, processRunId), eq(decisions.processStageId, stageId)))
    .orderBy(asc(decisions.priorityRank), asc(decisions.id))
    .all();
}
