/**
 * ProcessOrchestrator: the one entry point to the process engine.
 *
 * Both installed Role Apps run through this module, and nothing else writes
 * stage state. It composes the engine's components into the stage lifecycle
 * of plan section 4.9:
 *
 *    1  validate entry criteria          CompletionValidator   ./validator.ts
 *    2  load required sources            SourceLoader          ./sources.ts
 *    3  show source status               StageContextBuilder   ./context.ts
 *    4  start AI preparation             AIStagePreparation    ./preparation.ts
 *    5  validate structured output       AIStagePreparation    ./preparation-schema.ts
 *    6  create human tasks               StageTransition       ./transition.ts (openStage)
 *    7  create proposed actions          ToolExecution         ./tools.ts (derived proposals)
 *    8  wait for human input             HumanTaskService      ./tasks.ts
 *                                        DecisionGate          ./decisions.ts
 *    9  request approval where needed    ApprovalGate          ./approvals.ts
 *   10  execute governed tools           ToolExecution         ./tools.ts
 *   11  store artifacts                  ArtifactService       ./artifacts.ts
 *   12  verify completion criteria       CompletionValidator   ./validator.ts
 *   13  complete stage                   StageTransition       ./transition.ts (completeStage)
 *   14  open next stage                  StageTransition       ./transition.ts (openStage)
 *   15  update Home, Work, Decisions,    ProcessEventPublisher ../events/backbone.ts
 *       Activity and Audit
 *
 * Every command here rebuilds the stage context from the database, acts, and
 * then synchronises the derived lifecycle facts (approval requested, a seeded
 * decision recorded elsewhere). There is no in-memory state between calls, so
 * a refresh or a restart resumes exactly where the database says.
 */

import "./implementations";
import { getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { releaseExpiredLeases } from "@/db/repositories/background-jobs";
import {
  ensureStageTask,
  getActiveRun,
  getRun,
  type PersistedRoleAppRun,
} from "@/db/repositories/role-app-runtime";
import { getInstalledRoleApps } from "@/role-apps/registry";
import { publishOsEvent } from "@/features/events/backbone";
import type { RoleId } from "@/db/schema/core";
import { buildStageContext, StageContextError } from "./context";
import { refused, processOf, subjectOf, type CommandResult } from "./common";
import { publishSeededDecisionRecorded, recordStageDecision, type RecordDecisionInput } from "./decisions";
import { eventKey, taskKey } from "./keys";
import {
  releaseIfSourcesReturned,
  restartStagePreparation,
  runPreparationJob,
  type PreparationRunOptions,
} from "./preparation";
import { recordHumanTask } from "./tasks";
import { executeProposedTools, toolNeedsApproval } from "./tools";
import { completeStage, type CompleteStageResult } from "./transition";
import { validateStage } from "./validator";
import type { StageContext } from "./types";

export { buildStageContext, StageContextError } from "./context";
export { validateStage } from "./validator";

/* ==========================================================================
   Locating a run
   ========================================================================== */

/** The active run of a role's installed app, or null when none is seeded. */
export function findActiveProcessRun(roleId: RoleId, roleAppId?: string, runId = DEFAULT_RUN_ID): PersistedRoleAppRun | null {
  const app = getInstalledRoleApps(roleId).find((candidate) => roleAppId === undefined || candidate.id === roleAppId);
  if (!app) return null;
  return getActiveRun(roleId, app.id, runId) ?? null;
}

/**
 * The acting role of a process command is the role of the workday it came
 * from, and it has to be the role that owns the run. Every task, decision,
 * approval and completion is recorded under the run's role and that role's
 * holder, so a request naming another role's process is refused before
 * anything is written. Returns the refusal, or null when the roles match.
 */
export function routeRoleRefusal(processRunId: string, routeRoleId: RoleId, runId = DEFAULT_RUN_ID): CommandResult | null {
  const run = getRun(processRunId, runId);
  if (!run) {
    return refused({
      en: `The process run ${processRunId} does not exist.`,
      de: `Der Prozesslauf ${processRunId} existiert nicht.`,
    });
  }
  if (run.roleId !== routeRoleId) {
    return refused({
      en: "This process belongs to another role. Open it from that role's workday to act on it.",
      de: "Dieser Prozess gehoert zu einer anderen Rolle. Oeffnen Sie ihn im Arbeitstag dieser Rolle, um darin zu handeln.",
    });
  }
  return null;
}

/* ==========================================================================
   Synchronisation (resume)
   ========================================================================== */

export interface SyncResult {
  ran: boolean;
  preparation: string | null;
}

/**
 * Brings a stage up to date with what the database already implies.
 *
 * Releases expired leases, returns a job parked for a source that is back,
 * runs a queued preparation, and publishes the lifecycle facts that follow
 * from state written elsewhere: a seeded decision recorded on the Decisions
 * surface, a tool proposal that now needs approval, a stage whose completion
 * can now be approved. Idempotent: calling it twice writes nothing the
 * second time. The process page calls it once on load through a server
 * action, never during render.
 */
export async function syncStage(
  processRunId: string,
  stageId?: string,
  options: PreparationRunOptions = {},
): Promise<SyncResult> {
  let context = buildStageContext({ processRunId, ...(stageId ? { stageId } : {}) });
  if (!context.stageRun || context.stageRun.status === "completed") return { ran: false, preparation: null };

  releaseExpiredLeases(context.runId);
  context = buildStageContext({ processRunId, stageId: context.stage.id });
  releaseIfSourcesReturned(context);
  context = buildStageContext({ processRunId, stageId: context.stage.id });

  let preparation: string | null = null;
  if (context.job && context.job.status === "pending") {
    preparation = (await runPreparationJob(context.job.id, options)).outcome;
    context = buildStageContext({ processRunId, stageId: context.stage.id });
  }

  publishDerivedFacts(context);
  return { ran: true, preparation };
}

/** Publishes the lifecycle facts derived from state. Every write is keyed, so repeats are no-ops. */
function publishDerivedFacts(context: StageContext): void {
  const stageRun = context.stageRun;
  if (!stageRun || stageRun.status === "completed") return;

  getSqlite().transaction(() => {
    for (const decision of context.decisions) {
      if (decision.spec.binding.kind === "seeded-decision" && decision.status === "recorded") {
        publishSeededDecisionRecorded(context, decision.spec.binding.decisionId, decision.chosenOptionId);
      }
    }

    for (const tool of context.tools) {
      if (tool.state !== "proposed") continue;
      const spec = context.stage.tools.find((candidate) => candidate.key === tool.key);
      if (!spec || !toolNeedsApproval(context, spec.toolName).needed) continue;
      publishOsEvent({
        runId: context.runId,
        type: "approval-requested",
        roleId: context.roleId,
        atMoment: context.state.currentMoment,
        actorKind: "system",
        subject: subjectOf(context),
        process: processOf(context),
        correlationId: stageRun.id,
        summary: { en: `Approval requested: ${spec.label.en}.`, de: `Genehmigung angefordert: ${spec.label.de}.` },
        payload: { toolKey: spec.key, toolName: spec.toolName },
        idempotencyKey: eventKey.approvalRequested(stageRun.id, `tool:${spec.key}`),
      });
    }

    if (validateStage(context).canComplete) {
      ensureStageTask({
        id: `TASK-${stageRun.id}-completion`,
        runId: context.runId,
        stageRunId: stageRun.id,
        taskKey: taskKey.completion,
        taskKind: "approval",
        label: "Stage completion approval",
        status: "pending",
        requiredForCompletion: true,
        createdAt: new Date().toISOString(),
      });
      publishOsEvent({
        runId: context.runId,
        type: "approval-requested",
        roleId: context.roleId,
        atMoment: context.state.currentMoment,
        actorKind: "system",
        subject: subjectOf(context),
        process: processOf(context),
        correlationId: stageRun.id,
        summary: {
          en: `Stage ${context.stage.sequence} ${context.stage.name} is ready to complete. Approval requested.`,
          de: `Stufe ${context.stage.sequence} ${context.stage.nameDe} kann abgeschlossen werden. Genehmigung angefordert.`,
        },
        payload: { subject: "stage-completion" },
        idempotencyKey: eventKey.approvalRequested(stageRun.id, "stage-completion"),
      });
    }
  })();
}

/* ==========================================================================
   Commands
   ========================================================================== */

async function withContext<T extends CommandResult>(
  processRunId: string,
  stageId: string,
  act: (context: StageContext) => Promise<T> | T,
): Promise<T | CommandResult> {
  let context: StageContext;
  try {
    context = buildStageContext({ processRunId, stageId });
  } catch (error) {
    if (error instanceof StageContextError) return refused({ en: error.message, de: error.message });
    throw error;
  }
  const result = await act(context);
  publishDerivedFacts(buildStageContext({ processRunId, stageId }));
  return result;
}

/** Records the input for one human task (lifecycle step 8). */
export function submitHumanTask(processRunId: string, stageId: string, taskKeyValue: string, data: FormData) {
  return withContext(processRunId, stageId, (context) => recordHumanTask(context, taskKeyValue, data));
}

/** Records a stage decision through its binding (lifecycle steps 8 and 9). */
export function submitStageDecision(processRunId: string, stageId: string, input: RecordDecisionInput) {
  return withContext(processRunId, stageId, (context) => recordStageDecision(context, input));
}

/** Approves and executes every proposed tool under one confirmation (steps 9 and 10). */
export function approveAndExecuteTools(
  processRunId: string,
  stageId: string,
  input: { rationale: string; rationaleConfirmed: boolean },
) {
  return withContext(processRunId, stageId, () =>
    executeProposedTools(() => buildStageContext({ processRunId, stageId }), input),
  );
}

/** Completes the stage and opens the next (steps 12 to 14). */
export async function submitStageCompletion(
  processRunId: string,
  stageId: string,
  input: { rationale: string; rationaleConfirmed: boolean },
): Promise<CompleteStageResult | CommandResult> {
  let context: StageContext;
  try {
    context = buildStageContext({ processRunId, stageId });
  } catch (error) {
    if (error instanceof StageContextError) return refused({ en: error.message, de: error.message });
    throw error;
  }
  return completeStage(context, input);
}

/** Starts, restarts or resumes the preparation on a person's request (step 4). */
export function requestPreparation(processRunId: string, stageId: string) {
  return withContext(processRunId, stageId, (context): CommandResult => {
    const outcome = restartStagePreparation(context);
    return { ok: outcome.jobId !== null, message: outcome.message };
  });
}

/** Runs the next stage's queued preparation. Called after the response, or by the worker. */
export async function runQueuedPreparation(jobId: string, options: PreparationRunOptions = {}): Promise<string> {
  return (await runPreparationJob(jobId, options)).outcome;
}
