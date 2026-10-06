/**
 * A run's own decisions (migration 0007).
 *
 * Stages 2, 3, 4, 5 and 7 bind a seeded decision of the Q4 2026 cycle
 * (DEC-2026-0771, 0744, 0745, 0772 and 0782), which the seed links to
 * RUN-RCSA-PAYOPS-Q4-2026 and its stages (`decisions.process_run_id` and
 * `process_stage_id`). A later run of the app, such as the event-driven
 * reassessment Stage 8 starts, needs judgments of its own rather than finding
 * the Q4 cycle's already recorded. So when the stage before one of those
 * completes on such a run, its completion hook presents the run's own
 * decision for the stage that opens:
 *
 *   through the decision insert path the data model provides, so the
 *   decision is open, offers every option of the decision it is made from,
 *   with no option chosen, and is bound to the run and the stage;
 *     `copyDecisionForRun` when the template's consequences concern nothing
 *     the Q4 assessment owns (the Stage 2 investigation is about an
 *     indicator and the process);
 *     `createDecisionForRun` with the consequences pointed at this run's
 *     assessment where they name the Q4 assessment or one of its lines, so
 *     a judgment on the reassessment never versions or rates the Q4 record;
 *   inside the completion transaction, so the stage that opens and its
 *   decision commit together or not at all;
 *   announced on the backbone as `decision-requested`, with its audit row.
 *
 * The engine binds the stage to it (`buildStageContext`, by the template's
 * reference among the run's decisions for the stage). The Q4 run creates
 * nothing: the seeded decisions are its own.
 *
 * A decision that cannot be presented throws, which rolls the completion
 * back: a stage must not open waiting on a judgment that does not exist.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { decisionOptions, decisions } from "@/db/schema/decisions";
import { assessmentLines } from "@/db/schema/practice";
import { roleAppRuns } from "@/db/schema/role-app-runtime";
import {
  copyDecisionForRun,
  createDecisionForRun,
  type CreateDecisionForRunResult,
  type NewProcessDecisionOption,
} from "@/db/repositories/process-decisions";
import { publishOsEvent } from "@/features/events/backbone";
import { registerCompletionHook, type CompletionFollowOn } from "@/features/process/registry";
import type { StageContext } from "@/features/process/types";
import type { RoleProcessStage } from "@/role-apps/contracts";
import { RCSA_CYCLE_PROCESS } from "@/role-apps/rcsa/definition";
import { RCSA_PROCESS_ID, scopeOf, type RcsaScope } from "./shared";

type DecisionRow = typeof decisions.$inferSelect;
type OptionRow = typeof decisionOptions.$inferSelect;
type Consequence = OptionRow["consequences"][number];

/** The identifier of a run's own decision for a stage: the run and the stage, never a clock. */
export function runDecisionId(processRunId: string, stage: Pick<RoleProcessStage, "sequence">, index = 0): string {
  return `DEC-${processRunId.replace(/^RUN-/, "")}-S${stage.sequence}${index > 0 ? `-${index + 1}` : ""}`;
}

function decisionRow(runId: string, id: string): DecisionRow | undefined {
  return getDb().select().from(decisions).where(and(eq(decisions.runId, runId), eq(decisions.id, id))).get();
}

function optionRows(runId: string, decisionId: string): OptionRow[] {
  return getDb()
    .select()
    .from(decisionOptions)
    .where(and(eq(decisionOptions.runId, runId), eq(decisionOptions.decisionId, decisionId)))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function runSubject(runId: string, processRunId: string): string | null {
  return (
    getDb()
      .select({ subjectId: roleAppRuns.subjectId })
      .from(roleAppRuns)
      .where(and(eq(roleAppRuns.runId, runId), eq(roleAppRuns.id, processRunId)))
      .get()?.subjectId ?? null
  );
}

/**
 * The template's consequences, pointed at this run.
 *
 * A consequence on the template run's assessment goes to this run's
 * assessment. A consequence on one of its lines goes to this run's line for
 * the same risk, the line its scope reads; one with no such line is left out
 * rather than aimed at the Q4 record. Every other target (an indicator, a
 * control, the process, a risk) is shared by both runs and stays.
 */
function retarget(
  options: readonly OptionRow[],
  from: { subjectId: string; lines: ReadonlyMap<string, string> },
  to: { subjectId: string; scope: RcsaScope },
): { options: Array<Omit<NewProcessDecisionOption, "id">>; changed: boolean } {
  let changed = false;
  const lineForRisk = (riskId: string) => to.scope.lines.find((line) => line.riskId === riskId)?.id ?? null;
  const mapped = options.map((option): Omit<NewProcessDecisionOption, "id"> => {
    const consequences = option.consequences.flatMap((consequence): Consequence[] => {
      if (consequence.targetId === from.subjectId) {
        changed = true;
        return [{ ...consequence, targetId: to.subjectId }];
      }
      const riskId = from.lines.get(consequence.targetId);
      if (riskId !== undefined) {
        const line = lineForRisk(riskId);
        if (line !== consequence.targetId) changed = true;
        return line ? [{ ...consequence, targetId: line }] : [];
      }
      return [consequence];
    });
    const { decisionId: _decisionId, runId: _runId, id: _id, ...rest } = option;
    return { ...rest, consequences };
  });
  return { options: mapped, changed };
}

/** Presents the run's own decision for every seeded binding of the stage that opens. Returns what it presented. */
function presentDecisionsFor(context: StageContext, next: RoleProcessStage): Array<{ id: string; created: boolean; templateId: string }> {
  const presented: Array<{ id: string; created: boolean; templateId: string }> = [];
  const bindings = next.decisions.flatMap((spec) => (spec.binding.kind === "seeded-decision" ? [spec.binding.decisionId] : []));
  bindings.forEach((templateId, index) => {
    const template = decisionRow(context.runId, templateId);
    /* The decision is this run's own already (the Q4 cycle), or belongs to no run: nothing to present. */
    if (!template || template.processRunId === null || template.processRunId === context.run.id) return;

    const id = runDecisionId(context.run.id, next, index);
    const templateSubject = runSubject(context.runId, template.processRunId);
    const scope = scopeOf(context);
    const options = optionRows(context.runId, template.id);
    const targets = options.flatMap((option) => option.consequences.map((consequence) => consequence.targetId));
    const lines = new Map(
      (targets.length > 0
        ? getDb()
            .select({ id: assessmentLines.id, riskId: assessmentLines.riskId, assessmentId: assessmentLines.assessmentId })
            .from(assessmentLines)
            .where(and(eq(assessmentLines.runId, context.runId), inArray(assessmentLines.id, targets)))
            .all()
        : []
      )
        .filter((line) => line.assessmentId === templateSubject)
        .map((line) => [line.id, line.riskId] as const),
    );
    const target = { id, reference: template.reference, processRunId: context.run.id, processStageId: next.id, presentedAtMoment: context.state.currentMoment };
    const related = template.relatedObjectId !== null && template.relatedObjectId === templateSubject ? context.run.subjectId : template.relatedObjectId;
    const pointed = templateSubject ? retarget(options, { subjectId: templateSubject, lines }, { subjectId: context.run.subjectId, scope }) : { options: [], changed: false };

    let result: CreateDecisionForRunResult | undefined;
    if (!pointed.changed && related === template.relatedObjectId) {
      result = copyDecisionForRun(template.id, { ...target, runId: context.runId });
    } else {
      const {
        runId: _runId,
        status: _status,
        chosenOptionId: _chosen,
        recordedRationale: _rationale,
        decidedByUserId: _by,
        decidedAtMoment: _atMoment,
        decidedAt: _at,
        processRunId: _processRunId,
        processStageId: _processStageId,
        ...question
      } = template;
      result = createDecisionForRun({
        decision: {
          ...question,
          runId: context.runId,
          id,
          reference: template.reference,
          presentedAtMoment: context.state.currentMoment,
          relatedObjectId: related,
          fromSharedEvent: false,
          sharedThreadId: null,
          dueAt: null,
        },
        options: pointed.options.map((option, position) => ({ ...option, id: `${id}-O${String(position + 1).padStart(2, "0")}` })),
        processRunId: context.run.id,
        processStageId: next.id,
      });
    }
    if (!result || !result.ok) {
      throw new Error(`The decision of ${context.run.id} for Stage ${next.sequence} ${next.name} could not be presented (${result ? result.reason : "template missing"}), so the stage did not complete.`);
    }
    if (result.created) {
      publishOsEvent({
        runId: context.runId,
        type: "decision-requested",
        roleId: context.roleId,
        atMoment: context.state.currentMoment,
        actorKind: "system",
        subject: { kind: "decision", id },
        process: { runId: context.run.id, stageId: next.id },
        correlationId: context.stageRun?.id ?? null,
        summary: {
          en: `${id} presented for Stage ${next.sequence} ${next.name} of ${context.run.id}: ${template.title}. It is this run's own judgment, made from ${template.id}; no option is chosen.`,
          de: `${id} fuer Stufe ${next.sequence} ${next.nameDe} von ${context.run.id} vorgelegt: ${template.titleDe.length > 0 ? template.titleDe : template.title}. Es ist die eigene Beurteilung dieses Durchlaufs, angelegt aus ${template.id}; keine Option ist gewaehlt.`,
        },
        payload: { decisionId: id, templateDecisionId: template.id, processRunId: context.run.id, processStageId: next.id, retargeted: pointed.changed },
        idempotencyKey: `decision-requested:run:${context.run.id}:${id}`,
        audit: {
          category: "mutation",
          action: "presentRunDecision",
          objectKind: "decision",
          objectId: id,
          entityId: template.entityId,
          decisionId: id,
          reversible: false,
        },
      });
    }
    presented.push({ id, created: result.created, templateId: template.id });
  });
  return presented;
}

/** The hook of a stage whose next stage binds a seeded decision. */
function hookFor(stage: RoleProcessStage, next: RoleProcessStage) {
  return ({ context }: { context: StageContext }): CompletionFollowOn | null => {
    const presented = presentDecisionsFor(context, next).filter((entry) => entry.created);
    if (presented.length === 0) return null;
    const ids = presented.map((entry) => entry.id).join(", ");
    return {
      summary: {
        en: `Stage ${next.sequence} ${next.name} presents ${ids}, this run's own decision.`,
        de: `Stufe ${next.sequence} ${next.nameDe} legt ${ids} vor, die eigene Entscheidung dieses Durchlaufs.`,
      },
      receipt: presented.map((entry) => `Decision ${entry.id} presented for Stage ${next.sequence} ${next.name}, made from ${entry.templateId}`),
      payload: { decisionIds: presented.map((entry) => entry.id), completedStageId: stage.id },
    };
  };
}

/** Every stage followed by one that binds a seeded decision presents that decision for a later run. */
export const RUN_DECISION_HOOK_STAGES: string[] = [];
for (const stage of RCSA_CYCLE_PROCESS.stages) {
  const next = stage.nextStageId ? RCSA_CYCLE_PROCESS.stages.find((candidate) => candidate.id === stage.nextStageId) : undefined;
  if (!next || !next.decisions.some((spec) => spec.binding.kind === "seeded-decision")) continue;
  registerCompletionHook(RCSA_PROCESS_ID, stage.id, hookFor(stage, next));
  RUN_DECISION_HOOK_STAGES.push(stage.id);
}

export const RCSA_RUN_DECISIONS_REGISTERED = true;
