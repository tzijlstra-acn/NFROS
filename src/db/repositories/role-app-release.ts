/**
 * Data access for Role App release state: versions, their lifecycle history,
 * enablement per tenant and cohort, and cohorts.
 *
 * The definitions themselves stay in code (`src/role-apps/`); nothing here
 * writes or reads a definition. Every write that changes release state also
 * appends its `role_app_lifecycle_events` row in the same transaction, so the
 * history can never miss a change the state shows.
 *
 * What a product owner may do and when (approve only after a passing
 * evaluation, roll back to which version, whether a material change needs a
 * payload bound approval first) is the console's rule. This module records
 * what the console decided, and keeps one invariant itself: at most one
 * current version per app, which the database also enforces.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import {
  productCohorts,
  roleAppEnablements,
  roleAppLifecycleEvents,
  roleAppVersions,
  type EnablementScopeKind,
  type RoleAppLifecycleState,
} from "@/db/schema/product-console";

const db = () => getDb();

export type RoleAppVersion = typeof roleAppVersions.$inferSelect;
export type NewRoleAppVersion = typeof roleAppVersions.$inferInsert;
export type RoleAppLifecycleEvent = typeof roleAppLifecycleEvents.$inferSelect;
export type NewRoleAppLifecycleEvent = typeof roleAppLifecycleEvents.$inferInsert;
export type RoleAppEnablement = typeof roleAppEnablements.$inferSelect;
export type ProductCohort = typeof productCohorts.$inferSelect;
export type NewProductCohort = typeof productCohorts.$inferInsert;

/** Who did it, as every release write records it. */
export interface ReleaseActor {
  actorKind: "human" | "system";
  actorUserId: string | null;
  actorLabel: string;
  at: string;
  reason?: string;
  approvalId?: string | null;
  evaluationRunId?: string | null;
}

/**
 * The next history id for an app: its position in the app's history. Called
 * inside the writing transaction, so two writers cannot take the same number.
 */
function nextEventId(roleAppId: string): string {
  const row = db()
    .select({ n: sql<number>`count(*)` })
    .from(roleAppLifecycleEvents)
    .where(eq(roleAppLifecycleEvents.roleAppId, roleAppId))
    .get();
  return `RALE-${roleAppId}-${String(Number(row?.n ?? 0) + 1).padStart(4, "0")}`;
}

/* ==========================================================================
   Versions
   ========================================================================== */

export function getRoleAppVersion(id: string): RoleAppVersion | undefined {
  return db().select().from(roleAppVersions).where(eq(roleAppVersions.id, id)).get();
}

/** An app's versions, newest record first. */
export function listRoleAppVersions(roleAppId?: string): RoleAppVersion[] {
  return db()
    .select()
    .from(roleAppVersions)
    .where(roleAppId ? eq(roleAppVersions.roleAppId, roleAppId) : undefined)
    .orderBy(asc(roleAppVersions.roleAppId), desc(roleAppVersions.createdAt), desc(roleAppVersions.version))
    .all();
}

/** The current version of an app, the one its lifecycle state is read from. */
export function getCurrentRoleAppVersion(roleAppId: string): RoleAppVersion | undefined {
  return db()
    .select()
    .from(roleAppVersions)
    .where(and(eq(roleAppVersions.roleAppId, roleAppId), eq(roleAppVersions.isCurrent, true)))
    .get();
}

/** Every app's current version, in app order. */
export function listCurrentRoleAppVersions(): RoleAppVersion[] {
  return db()
    .select()
    .from(roleAppVersions)
    .where(eq(roleAppVersions.isCurrent, true))
    .orderBy(asc(roleAppVersions.roleAppId))
    .all();
}

/**
 * Records a new version, for example a candidate, with its "registered"
 * history entry. A new version is never current; making it current is a
 * state change.
 */
export function createRoleAppVersion(version: NewRoleAppVersion, actor: ReleaseActor): RoleAppVersion {
  const write = getSqlite().transaction((): RoleAppVersion => {
    db().insert(roleAppVersions).values({ ...version, isCurrent: false }).run();
    appendRoleAppLifecycleEvent({
      roleAppId: version.roleAppId,
      versionId: version.id,
      kind: "registered",
      fromState: null,
      toState: version.lifecycleState,
      scopeKind: null,
      scopeId: null,
      ...eventActor(actor),
    });
    const written = getRoleAppVersion(version.id);
    if (!written) throw new Error(`Role App version ${version.id} was not written.`);
    return written;
  });
  return write();
}

export interface StateChange {
  toState: RoleAppLifecycleState;
  /** Make this the app's current version, releasing the previous current one. */
  makeCurrent?: boolean;
  /** Set when the version comes into force. */
  releasedAt?: string | null;
  /** "rolled-back" when the change is a rollback; "state-changed" otherwise. */
  kind?: "state-changed" | "rolled-back";
}

/**
 * Moves a version to a new lifecycle state, and optionally makes it current,
 * in one transaction with its history entry. Returns undefined for an unknown
 * version.
 */
export function changeRoleAppVersionState(versionId: string, change: StateChange, actor: ReleaseActor): RoleAppVersion | undefined {
  const write = getSqlite().transaction((): RoleAppVersion | undefined => {
    const version = getRoleAppVersion(versionId);
    if (!version) return undefined;
    if (change.makeCurrent) {
      db()
        .update(roleAppVersions)
        .set({ isCurrent: false })
        .where(and(eq(roleAppVersions.roleAppId, version.roleAppId), eq(roleAppVersions.isCurrent, true)))
        .run();
    }
    db()
      .update(roleAppVersions)
      .set({
        lifecycleState: change.toState,
        ...(change.makeCurrent ? { isCurrent: true } : {}),
        ...(change.releasedAt !== undefined ? { releasedAt: change.releasedAt } : {}),
        ...(actor.approvalId !== undefined ? { approvalId: actor.approvalId } : {}),
        ...(actor.evaluationRunId !== undefined ? { evaluationRunId: actor.evaluationRunId } : {}),
      })
      .where(eq(roleAppVersions.id, versionId))
      .run();
    const kind = change.kind ?? "state-changed";
    appendRoleAppLifecycleEvent({
      roleAppId: version.roleAppId,
      versionId,
      kind,
      fromState: version.lifecycleState,
      toState: change.toState,
      scopeKind: null,
      scopeId: null,
      ...eventActor(actor),
    });
    return getRoleAppVersion(versionId);
  });
  return write();
}

/**
 * Sets what the product team stands behind for a version, for example
 * "maintained" once a candidate is released or "ended" once it is retired.
 * Called inside the console's governed write, beside the state change it
 * follows, which records the history entry; this adds none of its own.
 */
export function setRoleAppVersionSupportState(versionId: string, supportState: RoleAppVersion["supportState"]): void {
  db().update(roleAppVersions).set({ supportState }).where(eq(roleAppVersions.id, versionId)).run();
}

/* ==========================================================================
   History
   ========================================================================== */

function eventActor(actor: ReleaseActor) {
  return {
    actorKind: actor.actorKind,
    actorUserId: actor.actorUserId,
    actorLabel: actor.actorLabel,
    at: actor.at,
    reason: actor.reason ?? "",
    approvalId: actor.approvalId ?? null,
    evaluationRunId: actor.evaluationRunId ?? null,
  };
}

/**
 * Appends a history entry on its own, for an event no state column records.
 * The id is the app's next history position unless one is given. Returns the id.
 */
export function appendRoleAppLifecycleEvent(event: Omit<NewRoleAppLifecycleEvent, "id"> & { id?: string }): string {
  const id = event.id ?? nextEventId(event.roleAppId);
  db().insert(roleAppLifecycleEvents).values({ ...event, id }).run();
  return id;
}

/** An app's history, oldest first; every app's when no id is given. */
export function listRoleAppLifecycleEvents(roleAppId?: string): RoleAppLifecycleEvent[] {
  return db()
    .select()
    .from(roleAppLifecycleEvents)
    .where(roleAppId ? eq(roleAppLifecycleEvents.roleAppId, roleAppId) : undefined)
    .orderBy(asc(roleAppLifecycleEvents.at), asc(roleAppLifecycleEvents.id))
    .all();
}

/* ==========================================================================
   Enablement
   ========================================================================== */

export function getRoleAppEnablement(
  roleAppId: string,
  scopeKind: EnablementScopeKind,
  scopeId: string,
): RoleAppEnablement | undefined {
  return db()
    .select()
    .from(roleAppEnablements)
    .where(
      and(
        eq(roleAppEnablements.roleAppId, roleAppId),
        eq(roleAppEnablements.scopeKind, scopeKind),
        eq(roleAppEnablements.scopeId, scopeId),
      ),
    )
    .get();
}

export function listRoleAppEnablements(roleAppId?: string): RoleAppEnablement[] {
  return db()
    .select()
    .from(roleAppEnablements)
    .where(roleAppId ? eq(roleAppEnablements.roleAppId, roleAppId) : undefined)
    .orderBy(asc(roleAppEnablements.roleAppId), asc(roleAppEnablements.scopeKind), asc(roleAppEnablements.scopeId))
    .all();
}

export interface EnablementChange {
  roleAppId: string;
  scopeKind: EnablementScopeKind;
  scopeId: string;
  enabled: boolean;
  /** Pin the scope to a version; null follows the app's current version. */
  versionId?: string | null;
}

/**
 * Enables or disables an app for one scope, with its history entry. A cohort
 * enabled with a pinned version is recorded as "cohort-assigned". Writing the
 * state the scope is already in changes nothing and returns false.
 */
export function setRoleAppEnablement(change: EnablementChange, actor: ReleaseActor): boolean {
  const versionId = change.versionId ?? null;
  const write = getSqlite().transaction((): boolean => {
    const existing = getRoleAppEnablement(change.roleAppId, change.scopeKind, change.scopeId);
    if (existing && existing.enabled === change.enabled && existing.versionId === versionId) return false;

    db()
      .insert(roleAppEnablements)
      .values({
        id: `RAE-${change.roleAppId}-${change.scopeKind}-${change.scopeId}`,
        roleAppId: change.roleAppId,
        versionId,
        scopeKind: change.scopeKind,
        scopeId: change.scopeId,
        enabled: change.enabled,
        changedAt: actor.at,
        changedByLabel: actor.actorLabel,
        changedByUserId: actor.actorUserId,
        reason: actor.reason ?? "",
      })
      .onConflictDoUpdate({
        target: [roleAppEnablements.roleAppId, roleAppEnablements.scopeKind, roleAppEnablements.scopeId],
        set: {
          versionId,
          enabled: change.enabled,
          changedAt: actor.at,
          changedByLabel: actor.actorLabel,
          changedByUserId: actor.actorUserId,
          reason: actor.reason ?? "",
        },
      })
      .run();

    const kind = !change.enabled ? "disabled" : change.scopeKind === "cohort" && versionId ? "cohort-assigned" : "enabled";
    appendRoleAppLifecycleEvent({
      roleAppId: change.roleAppId,
      versionId,
      kind,
      fromState: null,
      toState: null,
      scopeKind: change.scopeKind,
      scopeId: change.scopeId,
      ...eventActor(actor),
    });
    return true;
  });
  return write();
}

/* ==========================================================================
   Cohorts
   ========================================================================== */

export function getCohort(id: string): ProductCohort | undefined {
  return db().select().from(productCohorts).where(eq(productCohorts.id, id)).get();
}

export function listCohorts(): ProductCohort[] {
  return db().select().from(productCohorts).orderBy(asc(productCohorts.createdAt), asc(productCohorts.id)).all();
}

/** The cohorts a person belongs to, for enablement and for the analytics cohort filter. */
export function listCohortsForUser(userId: string): ProductCohort[] {
  return db()
    .select()
    .from(productCohorts)
    .where(sql`exists (select 1 from json_each(${productCohorts.userIds}) j where j.value = ${userId})`)
    .orderBy(asc(productCohorts.id))
    .all();
}

/** Creates a cohort or replaces its membership and description. */
export function saveCohort(cohort: NewProductCohort): ProductCohort {
  db()
    .insert(productCohorts)
    .values(cohort)
    .onConflictDoUpdate({
      target: productCohorts.id,
      set: {
        name: cohort.name,
        nameDe: cohort.nameDe,
        description: cohort.description ?? "",
        userIds: cohort.userIds,
        roleIds: cohort.roleIds,
        legalEntityIds: cohort.legalEntityIds,
        pilotProgrammeId: cohort.pilotProgrammeId ?? null,
      },
    })
    .run();
  const saved = getCohort(cohort.id);
  if (!saved) throw new Error(`Cohort ${cohort.id} was not written.`);
  return saved;
}
