/**
 * The Scenario State Engine.
 *
 * Deterministic. This module owns the scenario clock, the acting role, the
 * autonomy level, the world view toggle and the language, and it is the only
 * place those values change.
 *
 * The important behaviour is what a role switch preserves. Switching role must
 * retain the shared event, the scenario state, earlier decisions and the audit
 * history, and must change the brief, the work object, the evidence priorities,
 * the specialist agent and the decision rights. That is achieved structurally:
 * role is a column on the run, not a separate database.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  DEFAULT_RUN_ID,
  scenarioRuns,
  timelineEvents,
  timelineRoleMoments,
  type AutonomyLevel,
  type RoleId,
} from "@/db/schema/core";
import { momentToMinutes } from "@/domain/nfr/calculators";
import { recordAuditEvent } from "@/server/security/audit";

export type WorldView = "today" | "future";
export type Language = "en" | "de";

export interface ScenarioState {
  runId: string;
  label: string;
  scenarioDate: string;
  currentMoment: string;
  activeRoleId: RoleId;
  autonomyLevel: AutonomyLevel;
  worldView: WorldView;
  language: Language;
  eventTriggered: boolean;
  seededAt: string;
}

/** The moment at which the shared event occurs. */
export const SHARED_EVENT_MOMENT = "14:05";

export function getScenarioState(runId: string = DEFAULT_RUN_ID): ScenarioState | null {
  const row = getDb().select().from(scenarioRuns).where(eq(scenarioRuns.id, runId)).get();
  if (!row) return null;
  return {
    runId: row.id,
    label: row.label,
    scenarioDate: row.scenarioDate,
    currentMoment: row.currentMoment,
    activeRoleId: row.activeRoleId,
    autonomyLevel: row.autonomyLevel,
    worldView: row.worldView === "today" ? "today" : "future",
    language: row.language === "de" ? "de" : "en",
    eventTriggered: row.eventTriggered,
    seededAt: row.seededAt,
  };
}

/** Throws when the database has not been seeded. Callers surface this clearly. */
export function requireScenarioState(runId: string = DEFAULT_RUN_ID): ScenarioState {
  const state = getScenarioState(runId);
  if (!state) {
    throw new Error(
      "The scenario has not been seeded. Run npm run db:migrate and npm run db:seed.",
    );
  }
  return state;
}

/** All ten timeline moments, in order. */
export function getTimeline(runId: string = DEFAULT_RUN_ID) {
  return getDb()
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.runId, runId))
    .orderBy(asc(timelineEvents.sortOrder))
    .all();
}

/** The role specific content for one moment. */
export function getRoleMoment(
  roleId: RoleId,
  timelineEventId: string,
  runId: string = DEFAULT_RUN_ID,
) {
  return getDb()
    .select()
    .from(timelineRoleMoments)
    .where(
      and(
        eq(timelineRoleMoments.runId, runId),
        eq(timelineRoleMoments.roleId, roleId),
        eq(timelineRoleMoments.timelineEventId, timelineEventId),
      ),
    )
    .get();
}

/** Every moment for a role, in order. */
export function getRoleMoments(roleId: RoleId, runId: string = DEFAULT_RUN_ID) {
  const timeline = getTimeline(runId);
  const moments = getDb()
    .select()
    .from(timelineRoleMoments)
    .where(and(eq(timelineRoleMoments.runId, runId), eq(timelineRoleMoments.roleId, roleId)))
    .all();

  const byEvent = new Map(moments.map((m) => [m.timelineEventId, m]));
  return timeline.map((event) => ({ event, roleMoment: byEvent.get(event.id) ?? null }));
}

/**
 * Advances or rewinds the scenario clock.
 *
 * Scrubbing backwards is permitted because the presentation needs it, but it
 * never un-records a decision: audit events and recorded decisions persist.
 * That asymmetry is intentional. Time is a view; decisions are facts.
 */
export function setMoment(
  moment: string,
  options: { runId?: string; actorUserId?: string; roleId?: RoleId } = {},
): ScenarioState {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const state = requireScenarioState(runId);
  const eventTriggered =
    state.eventTriggered || momentToMinutes(moment) >= momentToMinutes(SHARED_EVENT_MOMENT);

  getDb()
    .update(scenarioRuns)
    .set({ currentMoment: moment, eventTriggered })
    .where(eq(scenarioRuns.id, runId))
    .run();

  // Crossing into the shared event is worth recording once.
  if (eventTriggered && !state.eventTriggered) {
    recordAuditEvent({
      runId,
      atMoment: moment,
      category: "system",
      action: "sharedEventReached",
      objectKind: "timeline",
      objectId: SHARED_EVENT_MOMENT,
      summary:
        "The shared supplier and payments event at 14:05 became visible to every non-financial risk function.",
      actorKind: "system",
      roleId: options.roleId ?? state.activeRoleId,
      reversible: true,
    });
  }

  return requireScenarioState(runId);
}

/**
 * Switches the acting role.
 *
 * Nothing about the scenario is reset. The audit event records the switch so a
 * reviewer can see which professional was acting when a decision was taken.
 */
export function switchRole(
  roleId: RoleId,
  options: { runId?: string; actorUserId?: string } = {},
): ScenarioState {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const state = requireScenarioState(runId);
  if (state.activeRoleId === roleId) return state;

  getDb().update(scenarioRuns).set({ activeRoleId: roleId }).where(eq(scenarioRuns.id, runId)).run();

  recordAuditEvent({
    runId,
    atMoment: state.currentMoment,
    category: "system",
    action: "switchRole",
    objectKind: "scenario-run",
    objectId: runId,
    summary: `The acting role changed from ${state.activeRoleId} to ${roleId}. Scenario state, earlier decisions and audit history were retained.`,
    actorUserId: options.actorUserId ?? null,
    actorKind: "human",
    roleId,
    reversible: true,
    detail: { previousRoleId: state.activeRoleId, newRoleId: roleId },
  });

  return requireScenarioState(runId);
}

/**
 * Changes the autonomy level.
 *
 * This genuinely changes what the tool runtime will permit, because the gate
 * reads the level from this row. It is not a label.
 */
export function setAutonomyLevel(
  level: AutonomyLevel,
  options: { runId?: string; actorUserId?: string } = {},
): ScenarioState {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const state = requireScenarioState(runId);
  if (state.autonomyLevel === level) return state;

  getDb().update(scenarioRuns).set({ autonomyLevel: level }).where(eq(scenarioRuns.id, runId)).run();

  recordAuditEvent({
    runId,
    atMoment: state.currentMoment,
    category: "system",
    action: "setAutonomyLevel",
    objectKind: "scenario-run",
    objectId: runId,
    summary: `The autonomy level changed from ${state.autonomyLevel} to ${level}, which changed the set of permitted tool actions.`,
    actorUserId: options.actorUserId ?? null,
    actorKind: "human",
    roleId: state.activeRoleId,
    reversible: true,
    detail: { previousLevel: state.autonomyLevel, newLevel: level },
  });

  return requireScenarioState(runId);
}

/** Toggles between the current reality and the AI enabled future. */
export function setWorldView(view: WorldView, runId: string = DEFAULT_RUN_ID): ScenarioState {
  getDb().update(scenarioRuns).set({ worldView: view }).where(eq(scenarioRuns.id, runId)).run();
  return requireScenarioState(runId);
}

export function setLanguage(language: Language, runId: string = DEFAULT_RUN_ID): ScenarioState {
  getDb().update(scenarioRuns).set({ language }).where(eq(scenarioRuns.id, runId)).run();
  return requireScenarioState(runId);
}

/** True when content revealed at `moment` should be visible now. */
export function isVisibleNow(moment: string, state: ScenarioState): boolean {
  return momentToMinutes(moment) <= momentToMinutes(state.currentMoment);
}
