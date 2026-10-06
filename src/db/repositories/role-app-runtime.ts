/**
 * Read and write access for role-app runtime state.
 *
 * Queries here cover the full process runtime: runs, stage runs, tasks,
 * artifacts, AI routines, meeting minutes and action updates. Process events
 * are no longer here: they are events on the OS event backbone
 * (`src/features/events/backbone.ts`), read by process run.
 *
 * Mutation functions are intentionally thin: they update one row or insert
 * one row. The lifecycle rules (what may change when, and what must change
 * together in one transaction) belong to the process engine in
 * `src/features/process`, which is the only writer of stage state.
 *
 * Synchronous throughout: better-sqlite3 does not use promises.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import {
  actionUpdates,
  aiRoutines,
  meetingMinutes,
  roleAppArtifacts,
  roleAppRuns,
  roleAppStageRuns,
  roleAppStageTasks,
} from "@/db/schema/role-app-runtime";
import { evidenceDocuments } from "@/db/schema/work";

const db = () => getDb();

/* ==========================================================================
   Exported types derived from the schema
   ========================================================================== */

export type PersistedRoleAppRun = typeof roleAppRuns.$inferSelect;
export type NewRun = typeof roleAppRuns.$inferInsert;

export type RoleAppStageRun = typeof roleAppStageRuns.$inferSelect;
export type NewStageRun = typeof roleAppStageRuns.$inferInsert;

export type RoleAppStageTask = typeof roleAppStageTasks.$inferSelect;
export type NewStageTask = typeof roleAppStageTasks.$inferInsert;

export type RoleAppArtifact = typeof roleAppArtifacts.$inferSelect;
export type NewArtifact = typeof roleAppArtifacts.$inferInsert;

export type AIRoutine = typeof aiRoutines.$inferSelect;
export type NewAIRoutine = typeof aiRoutines.$inferInsert;

export type MeetingMinutes = typeof meetingMinutes.$inferSelect;
export type NewMeetingMinutes = typeof meetingMinutes.$inferInsert;

export type ActionUpdate = typeof actionUpdates.$inferSelect;
export type NewActionUpdate = typeof actionUpdates.$inferInsert;

/* ==========================================================================
   Role-app runs
   ========================================================================== */

/**
 * Returns the first in-progress or not-started run for the given role and app.
 * The process page uses this to display the current state without knowing the
 * run ID up front.
 */
export function getActiveRun(
  roleId: string,
  roleAppId: string,
  runId = DEFAULT_RUN_ID,
): PersistedRoleAppRun | undefined {
  return db()
    .select()
    .from(roleAppRuns)
    .where(
      and(
        eq(roleAppRuns.runId, runId),
        eq(roleAppRuns.roleId, roleId),
        eq(roleAppRuns.roleAppId, roleAppId),
      ),
    )
    .orderBy(desc(roleAppRuns.startedAt))
    .limit(1)
    .all()[0];
}

export function getRun(id: string, runId = DEFAULT_RUN_ID): PersistedRoleAppRun | undefined {
  return db()
    .select()
    .from(roleAppRuns)
    .where(and(eq(roleAppRuns.runId, runId), eq(roleAppRuns.id, id)))
    .get() ?? undefined;
}

export function createRun(run: NewRun): PersistedRoleAppRun {
  db().insert(roleAppRuns).values(run).run();
  const created = getRun(run.id, run.runId ?? DEFAULT_RUN_ID);
  if (!created) throw new Error(`Failed to create role-app run: ${run.id}`);
  return created;
}

export function updateRunStage(id: string, currentStageId: string, status: string): void {
  db()
    .update(roleAppRuns)
    .set({ currentStageId, status, updatedAt: new Date().toISOString(), blockedReason: null })
    .where(eq(roleAppRuns.id, id))
    .run();
}

export function completeRun(id: string): void {
  const now = new Date().toISOString();
  db()
    .update(roleAppRuns)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(roleAppRuns.id, id))
    .run();
}

export function blockRun(id: string, reason: string): void {
  db()
    .update(roleAppRuns)
    .set({ status: "blocked", blockedReason: reason, updatedAt: new Date().toISOString() })
    .where(eq(roleAppRuns.id, id))
    .run();
}

/** Every run of one role-app for a role, newest first. */
export function getRunsForApp(
  roleId: string,
  roleAppId: string,
  runId = DEFAULT_RUN_ID,
): PersistedRoleAppRun[] {
  return db()
    .select()
    .from(roleAppRuns)
    .where(
      and(
        eq(roleAppRuns.runId, runId),
        eq(roleAppRuns.roleId, roleId),
        eq(roleAppRuns.roleAppId, roleAppId),
      ),
    )
    .orderBy(desc(roleAppRuns.startedAt))
    .all();
}

/* ==========================================================================
   Stage runs
   ========================================================================== */

export function getStageRun(
  roleAppRunId: string,
  stageId: string,
  runId = DEFAULT_RUN_ID,
): RoleAppStageRun | undefined {
  return db()
    .select()
    .from(roleAppStageRuns)
    .where(
      and(
        eq(roleAppStageRuns.runId, runId),
        eq(roleAppStageRuns.roleAppRunId, roleAppRunId),
        eq(roleAppStageRuns.stageId, stageId),
      ),
    )
    .get() ?? undefined;
}

export function getStageRuns(roleAppRunId: string, runId = DEFAULT_RUN_ID): RoleAppStageRun[] {
  return db()
    .select()
    .from(roleAppStageRuns)
    .where(
      and(
        eq(roleAppStageRuns.runId, runId),
        eq(roleAppStageRuns.roleAppRunId, roleAppRunId),
      ),
    )
    .orderBy(asc(roleAppStageRuns.openedAt))
    .all();
}

export function createStageRun(stageRun: NewStageRun): RoleAppStageRun {
  db().insert(roleAppStageRuns).values(stageRun).run();
  const created = db()
    .select()
    .from(roleAppStageRuns)
    .where(eq(roleAppStageRuns.id, stageRun.id))
    .get();
  if (!created) throw new Error(`Failed to create stage run: ${stageRun.id}`);
  return created;
}

export function advanceStageRun(id: string, status: string): void {
  db()
    .update(roleAppStageRuns)
    .set({ status })
    .where(eq(roleAppStageRuns.id, id))
    .run();
}

export function completeStageRun(
  id: string,
  userId: string | null,
  completion: { approvalId?: string | null; rationale?: string | null; at?: string } = {},
): void {
  const now = completion.at ?? new Date().toISOString();
  db()
    .update(roleAppStageRuns)
    .set({
      status: "completed",
      completedAt: now,
      completedByUserId: userId ?? undefined,
      completionApprovalId: completion.approvalId ?? null,
      completionRationale: completion.rationale ?? null,
    })
    .where(eq(roleAppStageRuns.id, id))
    .run();
}

export function getStageRunById(id: string): RoleAppStageRun | undefined {
  return db().select().from(roleAppStageRuns).where(eq(roleAppStageRuns.id, id)).get() ?? undefined;
}

/** Updates the preparation pointers on a stage run. */
export function setStageRunPreparation(
  id: string,
  patch: { status?: string; preparationJobId?: string | null; aiOutputId?: string | null },
): void {
  db().update(roleAppStageRuns).set(patch).where(eq(roleAppStageRuns.id, id)).run();
}

/* ==========================================================================
   Stage tasks
   ========================================================================== */

export function getStageTasks(stageRunId: string, runId = DEFAULT_RUN_ID): RoleAppStageTask[] {
  return db()
    .select()
    .from(roleAppStageTasks)
    .where(and(eq(roleAppStageTasks.runId, runId), eq(roleAppStageTasks.stageRunId, stageRunId)))
    .orderBy(asc(roleAppStageTasks.createdAt), asc(roleAppStageTasks.id))
    .all();
}

export function getStageTask(stageRunId: string, taskKey: string): RoleAppStageTask | undefined {
  return (
    db()
      .select()
      .from(roleAppStageTasks)
      .where(and(eq(roleAppStageTasks.stageRunId, stageRunId), eq(roleAppStageTasks.taskKey, taskKey)))
      .get() ?? undefined
  );
}

/**
 * Inserts a task unless one with the same stage run and key exists.
 *
 * Returns the row and whether it was created, so the caller publishes a
 * "human task created" event only for a task that is genuinely new.
 */
export function ensureStageTask(task: NewStageTask): { task: RoleAppStageTask; created: boolean } {
  const existing = getStageTask(task.stageRunId, task.taskKey ?? "");
  if (existing) return { task: existing, created: false };
  db().insert(roleAppStageTasks).values(task).run();
  const created = getStageTask(task.stageRunId, task.taskKey ?? "");
  if (!created) throw new Error(`Failed to create stage task: ${task.id}`);
  return { task: created, created: true };
}

export function updateStageTask(
  id: string,
  patch: Partial<
    Pick<
      RoleAppStageTask,
      "status" | "completedAt" | "completedByUserId" | "approvalId" | "statusReason" | "output" | "label"
    >
  >,
): void {
  db().update(roleAppStageTasks).set(patch).where(eq(roleAppStageTasks.id, id)).run();
}

/* ==========================================================================
   Artifacts
   ========================================================================== */

/** The latest version of one artifact of a stage, or undefined. */
export function getLatestArtifact(
  roleAppRunId: string,
  stageId: string,
  artifactKey: string,
  runId = DEFAULT_RUN_ID,
): RoleAppArtifact | undefined {
  return (
    db()
      .select()
      .from(roleAppArtifacts)
      .where(
        and(
          eq(roleAppArtifacts.runId, runId),
          eq(roleAppArtifacts.roleAppRunId, roleAppRunId),
          eq(roleAppArtifacts.stageId, stageId),
          eq(roleAppArtifacts.artifactKey, artifactKey),
        ),
      )
      .orderBy(desc(roleAppArtifacts.version))
      .limit(1)
      .get() ?? undefined
  );
}

export function getArtifactById(id: string): RoleAppArtifact | undefined {
  return db().select().from(roleAppArtifacts).where(eq(roleAppArtifacts.id, id)).get() ?? undefined;
}

export function createArtifact(artifact: NewArtifact): RoleAppArtifact {
  db().insert(roleAppArtifacts).values(artifact).run();
  const created = db()
    .select()
    .from(roleAppArtifacts)
    .where(eq(roleAppArtifacts.id, artifact.id))
    .get();
  if (!created) throw new Error(`Failed to create artifact: ${artifact.id}`);
  return created;
}

export function getArtifacts(
  roleAppRunId: string,
  stageId?: string,
  runId = DEFAULT_RUN_ID,
): RoleAppArtifact[] {
  const rows = db()
    .select()
    .from(roleAppArtifacts)
    .where(
      and(
        eq(roleAppArtifacts.runId, runId),
        eq(roleAppArtifacts.roleAppRunId, roleAppRunId),
      ),
    )
    .orderBy(asc(roleAppArtifacts.createdAt))
    .all();

  return stageId !== undefined ? rows.filter((r) => r.stageId === stageId) : rows;
}

/*
 * Process events: `recordEvent` and `getEvents` were removed with the
 * `role_app_events` table. Publish with `publishOsEvent` and read with
 * `listOsEvents({ processRunId })` from `src/features/events/backbone.ts`.
 */

/* ==========================================================================
   AI routines
   ========================================================================== */

export function getRoutines(roleId: string, runId = DEFAULT_RUN_ID): AIRoutine[] {
  return db()
    .select()
    .from(aiRoutines)
    .where(and(eq(aiRoutines.runId, runId), eq(aiRoutines.roleId, roleId)))
    .all();
}

export function getActiveRoutines(roleId: string, runId = DEFAULT_RUN_ID): AIRoutine[] {
  return db()
    .select()
    .from(aiRoutines)
    .where(
      and(
        eq(aiRoutines.runId, runId),
        eq(aiRoutines.roleId, roleId),
        eq(aiRoutines.status, "active"),
      ),
    )
    .all();
}

export function pauseRoutine(id: string): void {
  db().update(aiRoutines).set({ status: "paused" }).where(eq(aiRoutines.id, id)).run();
}

export function resumeRoutine(id: string): void {
  db().update(aiRoutines).set({ status: "active" }).where(eq(aiRoutines.id, id)).run();
}

export function recordRoutineRun(id: string, runAt: string): void {
  db()
    .update(aiRoutines)
    .set({ lastRunAt: runAt })
    .where(eq(aiRoutines.id, id))
    .run();
}

/* ==========================================================================
   Meeting minutes
   ========================================================================== */

export function getMeetingMinutes(
  meetingId: string,
  runId = DEFAULT_RUN_ID,
): MeetingMinutes | undefined {
  return db()
    .select()
    .from(meetingMinutes)
    .where(
      and(eq(meetingMinutes.runId, runId), eq(meetingMinutes.meetingId, meetingId)),
    )
    .get() ?? undefined;
}

export function getMinutesArchive(roleId: string, runId = DEFAULT_RUN_ID): MeetingMinutes[] {
  return db()
    .select()
    .from(meetingMinutes)
    .where(
      and(eq(meetingMinutes.runId, runId), eq(meetingMinutes.roleId, roleId)),
    )
    .orderBy(desc(meetingMinutes.createdAt))
    .all();
}

export function createMeetingMinutes(minutes: NewMeetingMinutes): MeetingMinutes {
  db().insert(meetingMinutes).values(minutes).run();
  const created = db()
    .select()
    .from(meetingMinutes)
    .where(eq(meetingMinutes.id, minutes.id))
    .get();
  if (!created) throw new Error(`Failed to create meeting minutes: ${minutes.id}`);
  return created;
}

export function confirmMeetingMinutes(id: string, userId: string): void {
  const now = new Date().toISOString();
  db()
    .update(meetingMinutes)
    .set({ status: "confirmed", confirmedByUserId: userId, confirmedAt: now })
    .where(eq(meetingMinutes.id, id))
    .run();
}

export function updateMinutesStatus(id: string, status: string): void {
  db().update(meetingMinutes).set({ status }).where(eq(meetingMinutes.id, id)).run();
}

/* ==========================================================================
   Action updates
   ========================================================================== */

export function getActionUpdates(actionId: string, runId = DEFAULT_RUN_ID): ActionUpdate[] {
  return db()
    .select()
    .from(actionUpdates)
    .where(
      and(eq(actionUpdates.runId, runId), eq(actionUpdates.actionId, actionId)),
    )
    .orderBy(asc(actionUpdates.at))
    .all();
}

export function appendActionUpdate(update: NewActionUpdate): ActionUpdate {
  db().insert(actionUpdates).values(update).run();
  const created = db()
    .select()
    .from(actionUpdates)
    .where(eq(actionUpdates.id, update.id))
    .get();
  if (!created) throw new Error(`Failed to create action update: ${update.id}`);
  return created;
}

/* ==========================================================================
   Evidence documents for a supplier subject
   ========================================================================== */

/**
 * Evidence documents that reference the given subject ID in their
 * relatedObjectIds array. Used by the TPRM onboarding page to read
 * evidence status from the database rather than a static constant.
 *
 * SQLite does not support an efficient native JSON contains query via the
 * Drizzle ORM, so all documents for the run are fetched and filtered in JS.
 * The evidence corpus for a demo scenario is small enough that this is fine.
 */
export function getEvidenceDocumentsForSubject(
  subjectId: string,
  runId = DEFAULT_RUN_ID,
): Array<typeof evidenceDocuments.$inferSelect> {
  const all = db()
    .select()
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.runId, runId))
    .orderBy(asc(evidenceDocuments.reference))
    .all();

  return all.filter((doc) => doc.relatedObjectIds.includes(subjectId));
}
