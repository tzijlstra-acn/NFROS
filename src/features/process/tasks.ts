/**
 * HumanTaskService: lifecycle steps 6 and 8, create human tasks and record
 * human input.
 *
 * Tasks are created when a stage opens (see `./transition.ts`), one row per
 * contract item, so "human task created" is a real event with a real row
 * behind it. Input is recorded through the task's registered form: the form
 * parses the fields, applies the stage's content rules, and summarises the
 * result in plain language for the workspace and the stage record.
 *
 * Recording is idempotent by content. Submitting the same input twice writes
 * nothing the second time. Submitting different input before the stage
 * completes records a new revision, because a professional correcting their
 * own review before the gate is ordinary work, and the backbone keeps every
 * revision.
 */

import { getSqlite } from "@/db/client";
import { ensureStageTask, updateStageTask } from "@/db/repositories/role-app-runtime";
import { publishOsEvent } from "@/features/events/backbone";
import { digestContent } from "./artifacts";
import { done, guardOpenStage, processOf, refused, subjectOf, type CommandResult } from "./common";
import { findTask, parseTaskOutput, type HumanTaskOutput } from "./derive";
import { eventKey, taskKey } from "./keys";
import { getTaskForm } from "./registry";
import type { StageContext } from "./types";

/** The form defaults for a task, from the AI preparation. Null when there are none. */
export function taskDefaults(context: StageContext, key: string): unknown {
  const spec = context.stage.humanTasks.find((task) => task.key === key);
  if (!spec) return null;
  const form = getTaskForm(spec.form);
  return form ? form.defaults(context) : null;
}

/** The recorded input of a task, or null. */
export function recordedTaskOutput(context: StageContext, key: string): HumanTaskOutput | null {
  const task = findTask(context.tasks, taskKey.human(key));
  return task?.status === "completed" ? parseTaskOutput<HumanTaskOutput>(task) : null;
}

/**
 * Records the input for one human task.
 *
 * `data` is the submitted form. The form converts it to the object its
 * schema parses, so the field naming is the form's own concern and the route
 * does not know it.
 */
export function recordHumanTask(context: StageContext, key: string, data: FormData): CommandResult {
  const guard = guardOpenStage(context, { requirePreparation: true });
  if (guard) return guard;

  const spec = context.stage.humanTasks.find((task) => task.key === key);
  if (!spec) {
    return refused({ en: `There is no task ${key} on this stage.`, de: `Diese Stufe hat keine Aufgabe ${key}.` });
  }
  const form = getTaskForm(spec.form);
  if (!form) {
    return refused({
      en: "This task cannot be recorded in this build.",
      de: "Diese Aufgabe kann in diesem Build nicht erfasst werden.",
    });
  }

  const parsed = form.schema.safeParse(form.fromFormData(data, context));
  if (!parsed.success) {
    return refused(
      {
        en: "The input is incomplete. Every item needs an answer before it can be recorded.",
        de: "Die Eingabe ist unvollstaendig. Jeder Punkt braucht eine Antwort, bevor sie erfasst werden kann.",
      },
      parsed.error.issues.slice(0, 6).map((issue) => ({ en: issue.message, de: issue.message })),
    );
  }

  const problems = form.validate(context, parsed.data);
  if (problems.length > 0) {
    return refused(problems[0] ?? { en: "The input was refused.", de: "Die Eingabe wurde abgelehnt." }, problems);
  }

  const stageRun = context.stageRun;
  if (!stageRun) return refused({ en: "This stage has not been opened yet.", de: "Diese Stufe wurde noch nicht geoeffnet." });

  const digest = digestContent(parsed.data);
  const existingTask = findTask(context.tasks, taskKey.human(key));
  const existing = parseTaskOutput<HumanTaskOutput>(existingTask);
  if (existingTask?.status === "completed" && existing?.digest === digest) {
    return done({ en: `${spec.label.en} was already recorded with this input.`, de: `${spec.label.de} war mit dieser Eingabe bereits erfasst.` }, true);
  }

  const revision = (existing?.revision ?? 0) + 1;
  const now = new Date().toISOString();
  const summary = form.summarise(context, parsed.data);
  const output: HumanTaskOutput = { input: parsed.data, digest, revision, recordedAt: now, summary };

  getSqlite().transaction(() => {
    const { task } = ensureStageTask({
      id: `TASK-${stageRun.id}-${key}`,
      runId: context.runId,
      stageRunId: stageRun.id,
      taskKey: taskKey.human(key),
      taskKind: spec.kind,
      label: spec.label.en,
      status: "pending",
      requiredForCompletion: spec.required,
      createdAt: now,
    });
    updateStageTask(task.id, {
      status: "completed",
      completedAt: now,
      completedByUserId: context.actingUserId,
      statusReason: null,
      output: JSON.stringify(output),
    });

    publishOsEvent({
      runId: context.runId,
      type: "human-task-completed",
      roleId: context.roleId,
      atMoment: context.state.currentMoment,
      actorKind: "human",
      actorUserId: context.actingUserId,
      subject: subjectOf(context),
      process: processOf(context),
      correlationId: stageRun.id,
      summary: {
        en: `${context.actingUserId} recorded ${spec.label.en.toLowerCase()}${revision > 1 ? ` (revision ${revision})` : ""}.`,
        de: `${context.actingUserId} hat ${spec.label.de} erfasst${revision > 1 ? ` (Fassung ${revision})` : ""}.`,
      },
      payload: { taskKey: key, revision, digest },
      idempotencyKey: eventKey.taskCompleted(stageRun.id, key, revision),
      audit: {
        category: "mutation",
        action: "recordStageTask",
        objectKind: "process-stage-task",
        objectId: task.id,
        actorKind: "human",
        reversible: true,
      },
    });
  })();

  return done({ en: `${spec.label.en} recorded.`, de: `${spec.label.de} erfasst.` });
}
