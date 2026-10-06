/**
 * DecisionGate: lifecycle steps 7 to 9 for judgments.
 *
 * Two bindings, one rule: a material judgment is explicit, recorded by a named
 * person with a rationale they confirm as their own, and audited.
 *
 *   A seeded decision lives in the `decisions` table and is recorded through
 *   `recordDecisionAndExecute`, the same governed path the Decisions surface
 *   uses. Its consequences run through the authority gate with an approval
 *   each. The stage does not reimplement any of that; it calls it.
 *
 *   A stage decision belongs to the process runtime. It is recorded on the
 *   stage's decision task, published to the backbone with an audit row, and
 *   its material consequences run as governed tools through `./tools.ts`.
 *
 * A recorded decision whose outcome is "advance" is final. A recorded "hold"
 * may be revised, because holding a file until evidence arrives is exactly the
 * judgment that is expected to be revisited.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { auditEvents } from "@/db/schema/core";
import { ensureStageTask, updateStageTask } from "@/db/repositories/role-app-runtime";
import { recordDecisionAndExecute } from "@/scenario/engine/decide";
import { publishOsEvent } from "@/features/events/backbone";
import { done, guardOpenStage, processOf, refused, subjectOf, type CommandResult } from "./common";
import { findTask, parseTaskOutput, type DecisionTaskOutput } from "./derive";
import { eventKey, taskKey } from "./keys";
import { getDecisionRules } from "./registry";
import type { StageContext } from "./types";

export interface RecordDecisionInput {
  decisionKey: string;
  optionId: string;
  rationale: string;
  rationaleConfirmed: boolean;
}

/** Records a decision of the stage, through the binding the contract names. */
export async function recordStageDecision(
  context: StageContext,
  input: RecordDecisionInput,
): Promise<CommandResult> {
  const guard = guardOpenStage(context, { requirePreparation: true });
  if (guard) return guard;

  const state = context.decisions.find((decision) => decision.spec.key === input.decisionKey);
  if (!state) {
    return refused({
      en: `There is no decision ${input.decisionKey} on this stage.`,
      de: `Diese Stufe hat keine Entscheidung ${input.decisionKey}.`,
    });
  }
  if (!input.rationaleConfirmed) {
    return refused({
      en: "The decision was not recorded. Confirm that the rationale is your own.",
      de: "Die Entscheidung wurde nicht erfasst. Bestaetigen Sie, dass die Begruendung Ihre eigene ist.",
    });
  }
  if (input.rationale.trim().length === 0) {
    return refused({
      en: "The decision was not recorded. A rationale is required.",
      de: "Die Entscheidung wurde nicht erfasst. Eine Begruendung ist erforderlich.",
    });
  }
  const option = state.options.find((candidate) => candidate.id === input.optionId);
  if (!option) {
    return refused({
      en: "The chosen option does not belong to this decision.",
      de: "Die gewaehlte Option gehoert nicht zu dieser Entscheidung.",
    });
  }

  if (state.spec.binding.kind === "seeded-decision") {
    return recordSeededDecision(context, state.spec.binding.decisionId, input, state.status === "recorded");
  }
  return recordOwnDecision(context, input, option.outcome);
}

async function recordSeededDecision(
  context: StageContext,
  decisionId: string,
  input: RecordDecisionInput,
  alreadyRecorded: boolean,
): Promise<CommandResult> {
  if (alreadyRecorded) {
    return done(
      { en: "This decision is already recorded. Nothing was changed.", de: "Diese Entscheidung ist bereits erfasst. Es wurde nichts geaendert." },
      true,
    );
  }

  /*
   * The decision engine executes a decision as the role that owns it and
   * grants every approval in the name of that role's holder (J20), so the
   * shell's active role no longer matters here. The run's role is stated as
   * the acting role: a stage of one role recording another role's decision is
   * refused by the engine before anything is written.
   */
  const result = await recordDecisionAndExecute({
    decisionId,
    optionId: input.optionId,
    rationale: input.rationale.trim(),
    rationaleConfirmed: true,
    actingRoleId: context.roleId,
  });
  if (!result.recorded) {
    return refused({ en: result.message, de: result.message }, result.blockedReasons.map((reason) => ({ en: reason, de: reason })));
  }

  publishSeededDecisionRecorded(context, decisionId, input.optionId);

  return result.ok
    ? done({ en: result.message, de: "Entscheidung erfasst und ihre Folgen ausgefuehrt." })
    : {
        ok: true,
        message: { en: result.message, de: "Entscheidung erfasst. Nicht alle Folgen wurden ausgefuehrt." },
        reasons: result.blockedReasons.map((reason) => ({ en: reason, de: reason })),
      };
}

/**
 * Publishes the backbone event for a seeded decision, linking the audit row
 * the decision engine wrote.
 *
 * The key is shared with the decisions engine (`decision-recorded:<id>`), so
 * whichever publishes first is the one account of it. The process engine also
 * calls this when it notices a decision recorded on the Decisions surface.
 */
export function publishSeededDecisionRecorded(context: StageContext, decisionId: string, optionId: string | null): void {
  const audit = getDb()
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.runId, context.runId),
        eq(auditEvents.objectKind, "decision"),
        eq(auditEvents.objectId, decisionId),
        eq(auditEvents.action, "recordDecision"),
      ),
    )
    .orderBy(desc(auditEvents.recordedAt))
    .get();

  publishOsEvent({
    runId: context.runId,
    type: "decision-recorded",
    roleId: context.roleId,
    atMoment: context.state.currentMoment,
    actorKind: "human",
    actorUserId: context.actingUserId,
    subject: subjectOf(context),
    process: processOf(context),
    correlationId: context.stageRun?.id ?? null,
    summary: {
      en: `Decision ${decisionId} recorded with a confirmed rationale.`,
      de: `Entscheidung ${decisionId} mit bestaetigter Begruendung erfasst.`,
    },
    payload: { decisionId, optionId },
    idempotencyKey: eventKey.seededDecisionRecorded(decisionId),
    auditEventId: audit?.id ?? null,
  });
}

function recordOwnDecision(
  context: StageContext,
  input: RecordDecisionInput,
  outcome: "advance" | "hold",
): CommandResult {
  const stageRun = context.stageRun;
  if (!stageRun) return refused({ en: "This stage has not been opened yet.", de: "Diese Stufe wurde noch nicht geoeffnet." });

  const spec = context.stage.decisions.find((decision) => decision.key === input.decisionKey);
  if (!spec) return refused({ en: "Unknown decision.", de: "Unbekannte Entscheidung." });

  const rules = getDecisionRules(context.process.id, context.stage.id);
  const objection = rules?.validateOption?.(context, input.decisionKey, input.optionId) ?? null;
  if (objection) return refused(objection);

  const task = findTask(context.tasks, taskKey.decision(input.decisionKey));
  const previous = parseTaskOutput<DecisionTaskOutput>(task);
  const rationale = input.rationale.trim();

  if (task?.status === "completed" && previous) {
    if (previous.optionId === input.optionId && previous.rationale === rationale) {
      return done(
        { en: "This decision is already recorded with the same option and rationale.", de: "Diese Entscheidung ist mit derselben Option und Begruendung bereits erfasst." },
        true,
      );
    }
    if (previous.outcome !== "hold") {
      return refused({
        en: "This decision is recorded and final. A recorded decision is not overwritten.",
        de: "Diese Entscheidung ist erfasst und endgueltig. Eine erfasste Entscheidung wird nicht ueberschrieben.",
      });
    }
  }

  const now = new Date().toISOString();
  const revision = (previous?.revision ?? 0) + 1;
  const output: DecisionTaskOutput = {
    optionId: input.optionId,
    outcome,
    rationale,
    decidedByUserId: context.actingUserId,
    decidedAt: now,
    revision,
    history: previous
      ? [...previous.history, { optionId: previous.optionId, outcome: previous.outcome, rationale: previous.rationale, decidedAt: previous.decidedAt }]
      : [],
  };
  const optionLabel =
    spec.binding.kind === "stage-decision"
      ? spec.binding.options.find((candidate) => candidate.id === input.optionId)?.label
      : undefined;

  getSqlite().transaction(() => {
    const { task: row } = ensureStageTask({
      id: `TASK-${stageRun.id}-decision-${spec.key}`,
      runId: context.runId,
      stageRunId: stageRun.id,
      taskKey: taskKey.decision(spec.key),
      taskKind: "human-decision",
      label: spec.label.en,
      status: "pending",
      requiredForCompletion: true,
      createdAt: now,
    });
    updateStageTask(row.id, {
      status: "completed",
      completedAt: now,
      completedByUserId: context.actingUserId,
      statusReason: null,
      output: JSON.stringify(output),
    });

    publishOsEvent({
      runId: context.runId,
      type: "decision-recorded",
      roleId: context.roleId,
      atMoment: context.state.currentMoment,
      actorKind: "human",
      actorUserId: context.actingUserId,
      subject: subjectOf(context),
      process: processOf(context),
      correlationId: stageRun.id,
      summary: {
        en: `${context.actingUserId} decided "${spec.label.en}": ${optionLabel?.en ?? input.optionId}. The rationale was confirmed as their own.`,
        de: `${context.actingUserId} hat entschieden "${spec.label.de}": ${optionLabel?.de ?? input.optionId}. Die Begruendung wurde als eigene bestaetigt.`,
      },
      payload: { decisionKey: spec.key, optionId: input.optionId, outcome, revision, judgmentKind: spec.judgmentKind },
      idempotencyKey: eventKey.stageDecisionRecorded(stageRun.id, spec.key, revision),
      audit: {
        category: "decision",
        action: "recordStageDecision",
        objectKind: "process-stage-decision",
        objectId: row.id,
        actorKind: "human",
        decisionId: row.id,
        reversible: outcome === "hold",
      },
    });
  })();

  return done(
    outcome === "hold"
      ? { en: "Decision recorded. The stage is held until the decision is revised.", de: "Entscheidung erfasst. Die Stufe bleibt angehalten, bis die Entscheidung ueberarbeitet wird." }
      : { en: "Decision recorded.", de: "Entscheidung erfasst." },
  );
}
