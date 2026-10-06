/**
 * StageTransition: lifecycle steps 12 to 14, verify, complete, open the next
 * stage.
 *
 * Completion is a material outcome, so it is a governed tool. The route asks
 * `completeStage`, which validates, binds an approval to the exact completion
 * payload and calls `executeTool`. The authority gate decides; the handler
 * registered below does the work, inside one transaction:
 *
 *   re-read the stage and re-validate it (state may have moved since the
 *   approval), refuse if the completion record no longer matches the payload
 *   the person approved, store the stage-completion artifacts, close the
 *   tasks, complete the stage run, publish the stage-completed event, open the
 *   next stage with its tasks and its queued preparation, move the run
 *   pointer, or complete the run.
 *
 * All of that commits together or not at all. A duplicate submission finds
 * the stage completed and writes nothing: before the approval when it arrives
 * second, inside the handler when two arrive together.
 */

import { getSqlite } from "@/db/client";
import {
  completeRun,
  completeStageRun,
  createStageRun,
  ensureStageTask,
  getStageRun,
  getStageTask,
  updateRunStage,
  updateStageTask,
  type PersistedRoleAppRun,
  type RoleAppStageRun,
} from "@/db/repositories/role-app-runtime";
import type { RoleProcessStage } from "@/role-apps/contracts";
import { executeTool, hasToolHandler, registerToolHandler, type ToolHandlerResult } from "@/agents/tools/runtime";
import { linkOsEventAudit, publishOsEvent } from "@/features/events/backbone";
import { ApprovalRefused, grantStageApproval } from "./approvals";
import { digestContent, storeArtifact } from "./artifacts";
import { done, guardOpenStage, processOf, refused, stageName, stageToolContextFor, subjectOf, toolContextFor, type CommandResult } from "./common";
import { buildStageContext } from "./context";
import { findTask, parseTaskOutput, stageIsExecutable, type DecisionTaskOutput } from "./derive";
import { publishSeededDecisionRecorded } from "./decisions";
import { eventKey, taskKey } from "./keys";
import { enqueueStagePreparation } from "./preparation";
import { getArtifactBuilder, getCompletionHook } from "./registry";
import { toolNeedsApproval } from "./tools";
import { validateStage } from "./validator";
import type { StageContext } from "./types";

/* ==========================================================================
   Opening a stage
   ========================================================================== */

export interface OpenStageResult {
  stageRun: RoleAppStageRun;
  created: boolean;
  jobId: string | null;
}

/**
 * Opens a stage: the stage run, one task per contract item, the queued
 * preparation, and the events that announce them. Synchronous, so it joins
 * the caller's transaction, which is how the completion of one stage and the
 * opening of the next commit together. Idempotent: a stage that is already
 * open is returned unchanged.
 *
 * The seed calls this too, with fixed identifiers and times, so the seeded
 * day's open stages are exactly what the engine would have produced.
 */
export function openStage(params: {
  runId: string;
  run: PersistedRoleAppRun;
  stage: RoleProcessStage;
  at?: string;
  atMoment: string;
  /** Fixed identifiers and times for the seed. */
  seed?: { stageRunId: string; openedAt: string; status?: string };
}): OpenStageResult {
  const { runId, run, stage } = params;
  const existing = getStageRun(run.id, stage.id, runId);
  const at = params.seed?.openedAt ?? params.at ?? new Date().toISOString();

  const stageRun =
    existing ??
    createStageRun({
      id: params.seed?.stageRunId ?? `SR-${run.id}-${stage.id}`,
      runId,
      roleAppRunId: run.id,
      stageId: stage.id,
      status: params.seed?.status ?? "ready",
      openedAt: at,
      completedAt: null,
      completedByUserId: null,
      aiOutputId: null,
    });

  const executable = stageIsExecutable(stage);
  const notImplemented = stage.implementation.reason?.en ?? "This stage is not executable in this build.";

  for (const job of stage.aiJobs) {
    ensureStageTask({
      id: `TASK-${stageRun.id}-job-${job.key}`,
      runId,
      stageRunId: stageRun.id,
      taskKey: taskKey.job(job.key),
      taskKind: "ai-job",
      label: job.label.en,
      status: executable ? "pending" : "skipped",
      requiredForCompletion: true,
      createdAt: at,
      statusReason: executable ? null : notImplemented,
    });
  }

  const createdTasks = stage.humanTasks.filter(
    (task) =>
      ensureStageTask({
        id: `TASK-${stageRun.id}-${task.key}`,
        runId,
        stageRunId: stageRun.id,
        taskKey: taskKey.human(task.key),
        taskKind: task.kind,
        label: task.label.en,
        status: "pending",
        requiredForCompletion: task.required,
        createdAt: at,
        statusReason: executable ? null : notImplemented,
      }).created,
  );

  for (const decision of stage.decisions) {
    ensureStageTask({
      id: `TASK-${stageRun.id}-decision-${decision.key}`,
      runId,
      stageRunId: stageRun.id,
      taskKey: taskKey.decision(decision.key),
      taskKind: "human-decision",
      label: decision.label.en,
      status: "pending",
      requiredForCompletion: true,
      createdAt: at,
      statusReason: executable ? null : notImplemented,
    });
  }

  let jobId = stageRun.preparationJobId ?? null;
  if (!jobId && executable) {
    const job = enqueueStagePreparation({ runId, run, stage, stageRun, generation: 1, humanStarted: false, at });
    jobId = job?.id ?? null;
  }

  publishOsEvent({
    runId,
    type: "stage-opened",
    roleId: run.roleId as StageContext["roleId"],
    atMoment: params.atMoment,
    occurredAt: at,
    actorKind: "system",
    subject: { kind: run.subjectKind, id: run.subjectId },
    process: { runId: run.id, stageId: stage.id },
    correlationId: stageRun.id,
    summary: {
      en: `Stage ${stage.sequence} ${stage.name} opened.${executable ? "" : " It is not executable in this build."}`,
      de: `Stufe ${stage.sequence} ${stage.nameDe} geoeffnet.${executable ? "" : " Sie ist in diesem Build nicht ausfuehrbar."}`,
    },
    payload: { stageRunId: stageRun.id, executable, preparationJobId: jobId },
    idempotencyKey: eventKey.stageOpened(stageRun.id),
    ...(params.seed ? { id: `OSE-SEED-${stageRun.id}-opened` } : {}),
  });

  for (const task of createdTasks) {
    publishOsEvent({
      runId,
      type: "human-task-created",
      roleId: run.roleId as StageContext["roleId"],
      atMoment: params.atMoment,
      occurredAt: at,
      actorKind: "system",
      subject: { kind: run.subjectKind, id: run.subjectId },
      process: { runId: run.id, stageId: stage.id },
      correlationId: stageRun.id,
      summary: { en: `Task created: ${task.label.en}.`, de: `Aufgabe angelegt: ${task.label.de}.` },
      payload: { taskKey: task.key, kind: task.kind },
      idempotencyKey: eventKey.taskCreated(stageRun.id, task.key),
      ...(params.seed ? { id: `OSE-SEED-${stageRun.id}-task-${task.key}` } : {}),
    });
  }

  return { stageRun: getStageRun(run.id, stage.id, runId) ?? stageRun, created: !existing, jobId };
}

/* ==========================================================================
   The completion record
   ========================================================================== */

/**
 * The content of every stage-completion artifact, built from the context.
 *
 * Deterministic and free of timestamps, so the digest computed when the
 * person approves is the digest the handler recomputes when it executes. A
 * change in between (a decision revised, a command acknowledged) changes the
 * digest and the handler refuses, which means a person never approves one
 * stage record and has another committed under their name.
 */
export function buildCompletionRecord(context: StageContext): Array<{
  key: string;
  kind: string;
  label: { en: string; de: string };
  content: Record<string, unknown>;
}> {
  return context.stage.artifacts
    .filter((artifact) => artifact.producedBy === "stage-completion")
    .map((artifact) => {
      const builder = getArtifactBuilder(artifact.builder);
      if (!builder) throw new Error(`No artifact builder is registered for ${artifact.builder}.`);
      const built = builder(context);
      return { key: artifact.key, kind: artifact.kind, label: built.label, content: built.content };
    });
}

export function completionDigest(context: StageContext): string {
  return digestContent({
    record: buildCompletionRecord(context),
    decisions: context.decisions.map((decision) => [decision.spec.key, decision.chosenOptionId]),
    tools: context.tools.map((tool) => [tool.key, tool.satisfied]),
  });
}

/* ==========================================================================
   The completion handler (runs inside executeTool, after the authority gate)
   ========================================================================== */

class StageAlreadyCompleted extends Error {
  constructor() {
    super("STAGE_ALREADY_COMPLETED: the stage is already completed. Nothing was written.");
  }
}

interface CompletionPayload {
  processRunId: string;
  stageId: string;
  stageRunId: string;
  completionDigest: string;
}

function readPayload(payload: Record<string, unknown>): CompletionPayload {
  const read = (key: keyof CompletionPayload): string => {
    const value = payload[key];
    if (typeof value !== "string" || value.length === 0) throw new Error(`The completion requires "${key}".`);
    return value;
  };
  return {
    processRunId: read("processRunId"),
    stageId: read("stageId"),
    stageRunId: read("stageRunId"),
    completionDigest: read("completionDigest"),
  };
}

function completeStageHandler(payload: Record<string, unknown>, toolContext: { runId: string }): ToolHandlerResult {
  const input = readPayload(payload);

  const committed = getSqlite().transaction(() => {
    const context = buildStageContext({ processRunId: input.processRunId, stageId: input.stageId, runId: toolContext.runId });
    const stageRun = context.stageRun;
    if (!stageRun || stageRun.id !== input.stageRunId) throw new Error("The stage run in the approval is not the open stage.");
    if (stageRun.status === "completed") throw new StageAlreadyCompleted();

    const validation = validateStage(context);
    if (!validation.canComplete) {
      throw new Error(`The completion criteria are not met: ${validation.reasons[0]?.en ?? "unknown reason"}`);
    }
    if (completionDigest(context) !== input.completionDigest) {
      throw new Error("The stage changed after it was approved. Review it and complete it again.");
    }

    const now = new Date().toISOString();
    const completionTask = getStageTask(stageRun.id, taskKey.completion);
    const completionOutput = parseTaskOutput<{ approvalId: string; rationale: string }>(completionTask);

    /* Stage-completion artifacts. */
    const artifactIds: string[] = [];
    for (const record of buildCompletionRecord(context)) {
      const { artifact } = storeArtifact({
        runId: context.runId,
        roleAppRunId: context.run.id,
        stageId: context.stage.id,
        stageRunId: stageRun.id,
        artifactKey: record.key,
        artifactKind: record.kind,
        label: record.label,
        content: record.content,
        producedBy: "stage-completion",
        mode: null,
        createdByUserId: context.actingUserId,
        createdAt: now,
      });
      artifactIds.push(artifact.id);
    }

    /* Seeded decisions recorded elsewhere are snapshotted onto their task. */
    for (const decision of context.decisions) {
      if (decision.spec.binding.kind !== "seeded-decision" || decision.status !== "recorded") continue;
      const task = findTask(context.tasks, taskKey.decision(decision.spec.key));
      if (task && task.status !== "completed") {
        const snapshot: DecisionTaskOutput = {
          optionId: decision.chosenOptionId ?? "",
          outcome: "advance",
          rationale: decision.rationale ?? "",
          decidedByUserId: decision.decidedByUserId ?? "",
          decidedAt: decision.decidedAt ?? now,
          revision: 1,
          history: [],
        };
        updateStageTask(task.id, { status: "completed", completedAt: now, output: JSON.stringify(snapshot) });
      }
      publishSeededDecisionRecorded(context, decision.spec.binding.decisionId, decision.chosenOptionId);
    }

    if (completionTask) {
      updateStageTask(completionTask.id, { status: "completed", completedAt: now, completedByUserId: context.actingUserId });
    }

    completeStageRun(stageRun.id, context.actingUserId, {
      approvalId: completionOutput?.approvalId ?? null,
      rationale: completionOutput?.rationale ?? null,
      at: now,
    });

    const next = context.stage.nextStageId
      ? context.process.stages.find((stage) => stage.id === context.stage.nextStageId)
      : undefined;

    const completedEvent = publishOsEvent({
      runId: context.runId,
      type: "stage-completed",
      roleId: context.roleId,
      atMoment: context.state.currentMoment,
      actorKind: "human",
      actorUserId: context.actingUserId,
      subject: subjectOf(context),
      process: processOf(context),
      correlationId: stageRun.id,
      summary: {
        en: `${stageName(context).en} completed by ${context.actingUserId}.${next ? ` Stage ${next.sequence} ${next.name} opened.` : " The process is complete."}`,
        de: `${stageName(context).de} von ${context.actingUserId} abgeschlossen.${next ? ` Stufe ${next.sequence} ${next.nameDe} geoeffnet.` : " Der Prozess ist abgeschlossen."}`,
      },
      payload: { stageRunId: stageRun.id, artifactIds, approvalId: completionOutput?.approvalId ?? null, nextStageId: next?.id ?? null },
      idempotencyKey: eventKey.stageCompleted(stageRun.id),
    });

    let nextJobId: string | null = null;
    if (next) {
      const opened = openStage({ runId: context.runId, run: context.run, stage: next, at: now, atMoment: context.state.currentMoment });
      nextJobId = opened.jobId;
      updateRunStage(context.run.id, next.id, "in-progress");
    } else {
      completeRun(context.run.id);
      publishOsEvent({
        runId: context.runId,
        type: "process-completed",
        roleId: context.roleId,
        atMoment: context.state.currentMoment,
        actorKind: "human",
        actorUserId: context.actingUserId,
        subject: subjectOf(context),
        process: { runId: context.run.id, stageId: null },
        correlationId: context.run.id,
        summary: {
          en: `${context.process.name} for ${context.run.subjectId} is complete.`,
          de: `${context.process.nameDe} fuer ${context.run.subjectId} ist abgeschlossen.`,
        },
        payload: { processId: context.process.id },
        idempotencyKey: eventKey.processCompleted(context.run.id),
      });
    }

    /*
     * Follow-on work the stage declares, in the same transaction: for example
     * the run of an event-driven reassessment that the completion record the
     * person approved names. A hook that throws rolls the completion back.
     */
    const hook = getCompletionHook(context.process.id, context.stage.id);
    const followOn = hook ? hook({ context, at: now }) : null;

    return {
      stageName: stageName(context),
      nextStageName: next ? { en: `Stage ${next.sequence} ${next.name}`, de: `Stufe ${next.sequence} ${next.nameDe}` } : null,
      nextStageId: next?.id ?? null,
      nextJobId,
      eventId: completedEvent.event.id,
      artifactIds,
      followOn: followOn ? { summary: followOn.summary, payload: followOn.payload } : null,
      followOnReceipt: followOn?.receipt ?? [],
    };
  })();

  return {
    summary: `${committed.stageName.en} completed under a confirmed approval.${committed.nextStageName ? ` ${committed.nextStageName.en} opened.` : " The process is complete."}${committed.followOn ? ` ${committed.followOn.summary.en}` : ""}`,
    objectKind: "process-stage",
    objectId: input.stageRunId,
    data: committed,
    receiptStatements: [
      `${committed.stageName.en} completed`,
      ...(committed.nextStageName ? [`${committed.nextStageName.en} opened`] : ["Process completed"]),
      ...committed.followOnReceipt,
    ],
  };
}

for (const toolName of ["completeRcsaStage", "completeOnboardingStage"]) {
  if (!hasToolHandler(toolName)) registerToolHandler(toolName, completeStageHandler);
}

/* ==========================================================================
   The completion command
   ========================================================================== */

export interface CompleteStageResult extends CommandResult {
  nextJobId?: string | null;
  nextStageId?: string | null;
}

/**
 * Completes the stage on a person's confirmation.
 *
 * Validates first, so a refused completion writes nothing at all, not even an
 * approval. Then grants the approval bound to the completion payload, records
 * it on the stage, and executes the completion tool through the gate.
 */
export async function completeStage(
  context: StageContext,
  input: { rationale: string; rationaleConfirmed: boolean },
): Promise<CompleteStageResult> {
  if (context.stageRun?.status === "completed") {
    return done({ en: "This stage is already completed. Nothing was changed.", de: "Diese Stufe ist bereits abgeschlossen. Es wurde nichts geaendert." }, true);
  }
  const guard = guardOpenStage(context, { requirePreparation: false });
  if (guard) return guard;
  const stageRun = context.stageRun;
  if (!stageRun) return refused({ en: "This stage has not been opened yet.", de: "Diese Stufe wurde noch nicht geoeffnet." });

  const validation = validateStage(context);
  if (!validation.canComplete) {
    return refused(
      validation.reasons[0] ?? { en: "The completion criteria are not met.", de: "Die Abschlusskriterien sind nicht erfuellt." },
      validation.reasons,
    );
  }

  const toolName = context.app.stageCompletionToolName;
  if (!toolName) {
    return refused({ en: "This app does not declare how its stages complete.", de: "Diese App legt nicht fest, wie ihre Stufen abgeschlossen werden." });
  }
  const authority = toolNeedsApproval(context, toolName);
  if (authority.refusal) return refused({ en: authority.refusal, de: authority.refusal });

  const payload: CompletionPayload = {
    processRunId: context.run.id,
    stageId: context.stage.id,
    stageRunId: stageRun.id,
    completionDigest: completionDigest(context),
  };

  const next = context.stage.nextStageId
    ? context.process.stages.find((stage) => stage.id === context.stage.nextStageId)
    : undefined;

  let approvalId: string;
  try {
    approvalId = grantStageApproval({
      context,
      toolName,
      payload: payload as unknown as Record<string, unknown>,
      rationale: input.rationale,
      rationaleConfirmed: input.rationaleConfirmed,
      decisionId: stageRun.id,
      subject: {
        en: `complete ${stageName(context).en}${next ? ` and open Stage ${next.sequence} ${next.name}` : ""}`,
        de: `${stageName(context).de} abschliessen${next ? ` und Stufe ${next.sequence} ${next.nameDe} oeffnen` : ""}`,
      },
    }).approvalId;
  } catch (error) {
    if (error instanceof ApprovalRefused) return refused(error.reason);
    throw error;
  }

  const now = new Date().toISOString();
  const { task } = ensureStageTask({
    id: `TASK-${stageRun.id}-completion`,
    runId: context.runId,
    stageRunId: stageRun.id,
    taskKey: taskKey.completion,
    taskKind: "approval",
    label: "Stage completion approval",
    status: "pending",
    requiredForCompletion: true,
    createdAt: now,
  });
  updateStageTask(task.id, {
    approvalId,
    output: JSON.stringify({ approvalId, rationale: input.rationale.trim(), fingerprint: payload.completionDigest }),
  });

  const result = await executeTool(toolName, payload as unknown as Record<string, unknown>, stageToolContextFor(context), approvalId);

  if (result.outcome === "executed") {
    const data = result.data as {
      eventId: string;
      nextJobId: string | null;
      nextStageId: string | null;
      nextStageName: { en: string; de: string } | null;
      followOn: { summary: { en: string; de: string } } | null;
    };
    if (result.auditEventId) linkOsEventAudit(data.eventId, result.auditEventId);
    const message = data.nextStageName
      ? { en: `${stageName(context).en} completed. ${data.nextStageName.en} is open.`, de: `${stageName(context).de} abgeschlossen. ${data.nextStageName.de} ist geoeffnet.` }
      : { en: `${stageName(context).en} completed. The process is complete.`, de: `${stageName(context).de} abgeschlossen. Der Prozess ist abgeschlossen.` };
    return {
      ok: true,
      message: data.followOn
        ? { en: `${message.en} ${data.followOn.summary.en}`, de: `${message.de} ${data.followOn.summary.de}` }
        : message,
      nextJobId: data.nextJobId,
      nextStageId: data.nextStageId,
    };
  }

  if (result.summary.includes("STAGE_ALREADY_COMPLETED")) {
    return done({ en: "This stage was already completed. Nothing was changed.", de: "Diese Stufe war bereits abgeschlossen. Es wurde nichts geaendert." }, true);
  }

  updateStageTask(task.id, { status: "failed", statusReason: result.summary });
  return refused({ en: result.summary, de: result.summary });
}
