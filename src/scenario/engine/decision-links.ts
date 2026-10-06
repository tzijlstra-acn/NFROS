/**
 * Where a decision sits in the working day.
 *
 * A decision is rarely free standing. Some are the judgment a process stage is
 * waiting on, because the stage contract binds a seeded decision to it, or
 * because the decision was made for a run's stage and names it in its own
 * record (migration 0007). This module reads that record or the contract's
 * binding, and the run that is executing it, so the decision
 * engine can publish its event with the process attached and the Decisions
 * workspace can link back to the stage that is waiting.
 *
 * Reads only. Nothing here writes, and nothing here is inferred: a decision
 * that no installed stage contract names has no process link, and the
 * workspace says so rather than guessing one from the subject.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { RoleId } from "@/db/schema/core";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { decisions } from "@/db/schema/decisions";
import { getActiveRun, getRun, getStageRun } from "@/db/repositories/role-app-runtime";
import { getInstalledRoleApps, PROCESS_DEFINITIONS } from "@/role-apps/registry";
import type { RoleAppDefinition, RoleProcessDefinition, RoleProcessStage } from "@/role-apps/contracts";

export interface DecisionProcessBinding {
  app: RoleAppDefinition;
  process: RoleProcessDefinition;
  stage: RoleProcessStage;
  /** The stage contract's own key for this decision. */
  decisionKey: string;
  /** The role-app run executing the process, when one is seeded. */
  processRunId: string | null;
  /** The stage run, when the stage has been opened. */
  stageRunId: string | null;
  /** The stage run status as persisted, or null when the stage is not open yet. */
  stageStatus: string | null;
  /** True when the run is currently at this stage. */
  isCurrentStage: boolean;
}

/**
 * The installed stage that names this decision as its judgment, if any.
 *
 * Only installed apps are searched, and only for the decision's own role: a
 * stage contract of another role cannot be waiting on this role's judgment.
 */
export function findDecisionProcessBinding(
  decisionId: string,
  roleId: RoleId,
  runId = DEFAULT_RUN_ID,
): DecisionProcessBinding | null {
  /*
   * Since migration 0007 a decision can name its own run and stage
   * (`decisions.process_run_id`, `process_stage_id`): the seeded Q4 decisions
   * name the Q4 run, and a later run's own decision, which no contract names
   * by identifier, names that run. The record is read first; the contract's
   * binding is the reading for a decision no run claims.
   */
  const stored = getDb()
    .select({ processRunId: decisions.processRunId, processStageId: decisions.processStageId })
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.id, decisionId)))
    .get();
  const storedRun = stored?.processRunId ? getRun(stored.processRunId, runId) : undefined;
  if (storedRun && storedRun.roleId === roleId && stored?.processStageId) {
    const app = getInstalledRoleApps(roleId).find((candidate) => candidate.id === storedRun.roleAppId);
    const process = app ? PROCESS_DEFINITIONS.find((candidate) => candidate.id === app.processId) : undefined;
    const stage = process?.stages.find((candidate) => candidate.id === stored.processStageId);
    const seeded = stage?.decisions.filter((decision) => decision.binding.kind === "seeded-decision") ?? [];
    const spec =
      seeded.find((decision) => decision.binding.kind === "seeded-decision" && decision.binding.decisionId === decisionId) ??
      (seeded.length === 1 ? seeded[0] : undefined);
    if (app && process && stage && spec) {
      const stageRun = getStageRun(storedRun.id, stage.id, runId) ?? null;
      return {
        app,
        process,
        stage,
        decisionKey: spec.key,
        processRunId: storedRun.id,
        stageRunId: stageRun?.id ?? null,
        stageStatus: stageRun?.status ?? null,
        isCurrentStage: storedRun.currentStageId === stage.id,
      };
    }
  }

  for (const app of getInstalledRoleApps(roleId)) {
    const process = PROCESS_DEFINITIONS.find((candidate) => candidate.id === app.processId);
    if (!process) continue;

    for (const stage of process.stages) {
      const spec = stage.decisions.find(
        (decision) => decision.binding.kind === "seeded-decision" && decision.binding.decisionId === decisionId,
      );
      if (!spec) continue;

      const run = getActiveRun(roleId, app.id, runId) ?? null;
      const stageRun = run ? (getStageRun(run.id, stage.id, runId) ?? null) : null;
      return {
        app,
        process,
        stage,
        decisionKey: spec.key,
        processRunId: run?.id ?? null,
        stageRunId: stageRun?.id ?? null,
        stageStatus: stageRun?.status ?? null,
        isCurrentStage: run?.currentStageId === stage.id,
      };
    }
  }
  return null;
}

/** The route of the stage workspace for a binding, or null when the app is not routed. */
export function stageHref(binding: Pick<DecisionProcessBinding, "app" | "stage">): string | null {
  if (!binding.app.entryRoute) return null;
  return `${binding.app.entryRoute}?stage=${encodeURIComponent(binding.stage.id)}`;
}
