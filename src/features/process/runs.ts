/**
 * The run factory: starts a new run of an installed Role App.
 *
 * Until now every run was seeded. A process that can only ever run the cycle
 * the seed wrote is a demonstration of one cycle, so the factory exists for
 * the case the plan names: an event-driven reassessment that starts a new run
 * of the same Role App (plan section 5.1). It writes the run row, publishes
 * that the work arrived, and opens the first stage through the engine's own
 * `openStage`, so the new run's first stage, its tasks and its queued
 * preparation are exactly what the engine produces for any stage.
 *
 * Synchronous, so it joins the caller's transaction: a stage completion that
 * starts a reassessment commits the completion and the new run together, or
 * neither. Idempotent by the run identifier, which the caller derives from
 * what the run is about (never from a clock), so a repeated call returns the
 * run it already started.
 *
 * Only installed apps can be started. A preview app (Event-Driven
 * Reassessment is one) has no executable process, and starting it would be
 * installing it by the back door.
 */

import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { createRun, getRun, getStageRun, type PersistedRoleAppRun } from "@/db/repositories/role-app-runtime";
import { getProcessDefinition, getRoleApp } from "@/role-apps/registry";
import { roleAppUnavailableReason } from "@/role-apps/enablement";
import type { Bilingual } from "@/role-apps/contracts";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { publishOsEvent } from "@/features/events/backbone";
import { openStage } from "./transition";

/** Why a run started. Recorded on the backbone event that announces it. */
export interface ProcessRunTrigger {
  kind: "event-driven" | "scheduled";
  summary: Bilingual;
  /** The run and stage run whose outcome started this one, when another run did. */
  sourceProcessRunId: string | null;
  sourceStageRunId: string | null;
}

export interface StartProcessRunInput {
  runId?: string;
  /** The new run's identifier, derived by the caller from its subject. */
  processRunId: string;
  roleAppId: string;
  subjectKind: string;
  subjectId: string;
  trigger: ProcessRunTrigger;
  actingUserId: string | null;
  atMoment: string;
  at?: string;
}

export interface StartProcessRunResult {
  run: PersistedRoleAppRun;
  created: boolean;
  stageRunId: string | null;
  jobId: string | null;
}

export function startProcessRun(input: StartProcessRunInput): StartProcessRunResult {
  const runId = input.runId ?? DEFAULT_RUN_ID;
  const app = getRoleApp(input.roleAppId);
  if (!app || app.status !== "installed") {
    throw new Error(`${input.roleAppId} is not an installed Role App, so no run of it can be started.`);
  }
  const process = getProcessDefinition(app.processId);
  const first = process?.stages[0];
  if (!process || !first) throw new Error(`The process ${app.processId} has no stages to start.`);

  const existing = getRun(input.processRunId, runId);
  if (existing) {
    const stageRun = getStageRun(existing.id, first.id, runId) ?? null;
    return { run: existing, created: false, stageRunId: stageRun?.id ?? null, jobId: stageRun?.preparationJobId ?? null };
  }

  /* A Role App the product owner disabled or retired cannot be started (src/role-apps/enablement.ts). */
  const unavailable = roleAppUnavailableReason(app.id);
  if (unavailable) throw new Error(unavailable.en);

  const at = input.at ?? new Date().toISOString();
  const run = createRun({
    id: input.processRunId,
    runId,
    roleAppId: app.id,
    roleId: app.roleId,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    currentStageId: first.id,
    status: "in-progress",
    mode: getResolvedDemoMode().mode,
    startedAt: at,
    updatedAt: at,
    completedAt: null,
    blockedReason: null,
  });

  publishOsEvent({
    runId,
    type: "work-arrived",
    roleId: app.roleId as RoleId,
    atMoment: input.atMoment,
    occurredAt: at,
    actorKind: input.actingUserId ? "human" : "system",
    actorUserId: input.actingUserId,
    subject: { kind: input.subjectKind, id: input.subjectId },
    process: { runId: run.id, stageId: null },
    correlationId: input.trigger.sourceStageRunId,
    summary: {
      en: `${app.name} started for ${input.subjectId} (${input.trigger.kind === "event-driven" ? "event-driven" : "scheduled"}). ${input.trigger.summary.en}`,
      de: `${app.nameDe} fuer ${input.subjectId} gestartet (${input.trigger.kind === "event-driven" ? "ereignisgesteuert" : "planmaessig"}). ${input.trigger.summary.de}`,
    },
    payload: {
      processRunId: run.id,
      trigger: input.trigger.kind,
      sourceProcessRunId: input.trigger.sourceProcessRunId,
      sourceStageRunId: input.trigger.sourceStageRunId,
    },
    idempotencyKey: `process-run-started:${run.id}`,
  });

  const opened = openStage({ runId, run, stage: first, at, atMoment: input.atMoment });
  return { run, created: true, stageRunId: opened.stageRun.id, jobId: opened.jobId };
}
