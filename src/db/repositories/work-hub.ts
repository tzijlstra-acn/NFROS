/**
 * Read side data access for the Work Hub.
 *
 * Everything here is a query, in the same spirit as `workday.ts`: a server
 * component can import it freely without any risk of changing state while it
 * renders. The writes the hub performs are tool handlers reached through
 * `executeTool`, never functions in this file.
 *
 * It exists as its own module rather than as additions to `workday.ts`
 * because the hub reads across tables that module does not join: action
 * updates, follow-up messages, escalations and evidence requests that point
 * back at an action, the scope of a running process, and the names of the
 * objects work is linked to. Keeping those joins together keeps the module
 * read models free of database code, which is what makes them unit testable.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, users, type RoleId } from "@/db/schema/core";
import {
  actions,
  committeeItems,
  decisions,
} from "@/db/schema/decisions";
import {
  contracts,
  controls,
  kris,
  processes,
  risks,
  services,
  subprocessors,
  suppliers,
} from "@/db/schema/domain";
import { assessmentLines, assessments } from "@/db/schema/practice";
import { actionUpdates, meetingMinutes, roleAppRuns } from "@/db/schema/role-app-runtime";
import { collaborationMessages, evidenceDocuments } from "@/db/schema/work";
import { getAuditTrailForObject } from "@/server/security/audit";
import { getInstalledRoleApps, getProcessDefinition } from "@/role-apps/registry";
import { momentToMinutes } from "@/domain/nfr/calculators";

const db = () => getDb();

export type WorkActionRow = typeof actions.$inferSelect;
export type WorkActionUpdateRow = typeof actionUpdates.$inferSelect;
export type WorkFollowUpRow = typeof collaborationMessages.$inferSelect;
export type WorkCommitteeItemRow = typeof committeeItems.$inferSelect;
export type WorkEvidenceRow = typeof evidenceDocuments.$inferSelect;
export type WorkMinutesRow = typeof meetingMinutes.$inferSelect;

/* ==========================================================================
   Actions and what points back at them
   ========================================================================== */

/**
 * The actions on one role's desk.
 *
 * Two routes onto it, and both count. An action the role raised is the
 * role's to follow up, whoever owns it; an action owned by the person who
 * holds the role is theirs to do, whichever function raised it. The earlier
 * hub read only the first, so an action raised by Control Assurance and owned
 * by the Operational Risk Partner was invisible to the person it was waiting
 * on.
 */
export function getWorkActions(roleId: RoleId, holderUserId: string | null, runId = DEFAULT_RUN_ID): WorkActionRow[] {
  return db()
    .select()
    .from(actions)
    .where(eq(actions.runId, runId))
    .all()
    .filter(
      (row) => row.raisedByRoleId === roleId || (holderUserId !== null && row.ownerUserId === holderUserId),
    );
}

export function getWorkAction(actionId: string, runId = DEFAULT_RUN_ID): WorkActionRow | undefined {
  return db()
    .select()
    .from(actions)
    .where(and(eq(actions.runId, runId), eq(actions.id, actionId)))
    .get();
}

/** Append-only progress entries, grouped by action, oldest first. */
export function getActionUpdatesFor(
  actionIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, WorkActionUpdateRow[]> {
  const grouped = new Map<string, WorkActionUpdateRow[]>();
  if (actionIds.length === 0) return grouped;
  const rows = db()
    .select()
    .from(actionUpdates)
    .where(and(eq(actionUpdates.runId, runId), inArray(actionUpdates.actionId, [...actionIds])))
    .orderBy(asc(actionUpdates.at), asc(actionUpdates.id))
    .all();
  for (const row of rows) {
    const list = grouped.get(row.actionId) ?? [];
    list.push(row);
    grouped.set(row.actionId, list);
  }
  return grouped;
}

/** Simulated follow-up messages sent about an action, oldest first. */
export function getFollowUpsFor(
  actionIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, WorkFollowUpRow[]> {
  const grouped = new Map<string, WorkFollowUpRow[]>();
  if (actionIds.length === 0) return grouped;
  const rows = db()
    .select()
    .from(collaborationMessages)
    .where(
      and(
        eq(collaborationMessages.runId, runId),
        eq(collaborationMessages.relatedObjectKind, "action"),
        inArray(collaborationMessages.relatedObjectId, [...actionIds]),
      ),
    )
    .orderBy(asc(collaborationMessages.sentAt))
    .all();
  for (const row of rows) {
    const key = row.relatedObjectId ?? "";
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

/** Actions raised against another action: the evidence requests it produced. */
export function getActionsLinkedTo(
  actionIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, WorkActionRow[]> {
  const grouped = new Map<string, WorkActionRow[]>();
  if (actionIds.length === 0) return grouped;
  const rows = db()
    .select()
    .from(actions)
    .where(
      and(
        eq(actions.runId, runId),
        eq(actions.relatedObjectKind, "action"),
        inArray(actions.relatedObjectId, [...actionIds]),
      ),
    )
    .all();
  for (const row of rows) {
    const key = row.relatedObjectId ?? "";
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

/** Committee items raised as escalations of an action. */
export function getEscalationsFor(
  actionIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, WorkCommitteeItemRow[]> {
  const grouped = new Map<string, WorkCommitteeItemRow[]>();
  if (actionIds.length === 0) return grouped;
  const rows = db()
    .select()
    .from(committeeItems)
    .where(
      and(
        eq(committeeItems.runId, runId),
        eq(committeeItems.relatedObjectKind, "action"),
        inArray(committeeItems.relatedObjectId, [...actionIds]),
      ),
    )
    .all();
  for (const row of rows) {
    const key = row.relatedObjectId ?? "";
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

/* ==========================================================================
   Evidence
   ========================================================================== */

export function getEvidenceByIds(ids: readonly string[], runId = DEFAULT_RUN_ID): Map<string, WorkEvidenceRow> {
  const found = new Map<string, WorkEvidenceRow>();
  const unique = [...new Set(ids)].filter((id) => id.length > 0);
  if (unique.length === 0) return found;
  const rows = db()
    .select()
    .from(evidenceDocuments)
    .where(and(eq(evidenceDocuments.runId, runId), inArray(evidenceDocuments.id, unique)))
    .all();
  for (const row of rows) found.set(row.id, row);
  return found;
}

/**
 * Evidence documents that name one of these objects in `relatedObjectIds`.
 *
 * The corpus is a few hundred rows and SQLite has no efficient JSON contains
 * through Drizzle, so the filter runs in memory, the same choice
 * `getEvidenceDocumentsForSubject` already made.
 */
export function getEvidenceRelatedTo(
  objectIds: readonly string[],
  runId = DEFAULT_RUN_ID,
): Map<string, WorkEvidenceRow[]> {
  const grouped = new Map<string, WorkEvidenceRow[]>();
  const wanted = new Set(objectIds.filter((id) => id.length > 0));
  if (wanted.size === 0) return grouped;
  const rows = db()
    .select()
    .from(evidenceDocuments)
    .where(eq(evidenceDocuments.runId, runId))
    .orderBy(asc(evidenceDocuments.reference))
    .all();
  for (const row of rows) {
    for (const objectId of row.relatedObjectIds) {
      if (!wanted.has(objectId)) continue;
      const list = grouped.get(objectId) ?? [];
      list.push(row);
      grouped.set(objectId, list);
    }
  }
  return grouped;
}

/* ==========================================================================
   Audit
   ========================================================================== */

export interface WorkAuditRow {
  id: string;
  atMoment: string;
  recordedAt: string;
  summary: string;
  actorUserId: string | null;
  actorKind: string;
  blocked: boolean;
}

/** Audit events recorded against one object, newest first. */
export function getAuditForObject(objectKind: string, objectId: string, runId = DEFAULT_RUN_ID): WorkAuditRow[] {
  return getAuditTrailForObject(runId, objectKind, objectId).map((row) => ({
    id: row.id,
    atMoment: row.atMoment,
    recordedAt: row.recordedAt,
    summary: row.summary,
    actorUserId: row.actorUserId,
    actorKind: row.actorKind,
    blocked: row.blocked,
  }));
}

/* ==========================================================================
   Meeting minutes
   ========================================================================== */

export function getMinutesForRole(roleId: RoleId, runId = DEFAULT_RUN_ID): WorkMinutesRow[] {
  return db()
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.runId, runId), eq(meetingMinutes.roleId, roleId)))
    .orderBy(asc(meetingMinutes.createdAt))
    .all();
}

/* ==========================================================================
   Decisions by identifier
   ========================================================================== */

export interface WorkDecisionRef {
  id: string;
  reference: string;
  title: string;
  titleDe: string;
  status: string;
  roleId: string;
  relatedObjectId: string | null;
}

/**
 * The decisions a role can see at a moment, open or recorded, for link
 * building.
 *
 * Filtered by `presentedAtMoment` the way the decision queue is, so a link
 * never points at a decision the Decisions page would not show yet.
 */
export function getDecisionRefs(roleId: RoleId, atMoment: string, runId = DEFAULT_RUN_ID): WorkDecisionRef[] {
  const now = momentToMinutes(atMoment);
  return db()
    .select({
      id: decisions.id,
      reference: decisions.reference,
      title: decisions.title,
      titleDe: decisions.titleDe,
      status: decisions.status,
      roleId: decisions.roleId,
      relatedObjectId: decisions.relatedObjectId,
      presentedAtMoment: decisions.presentedAtMoment,
    })
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.roleId, roleId)))
    .all()
    .filter((row) => momentToMinutes(row.presentedAtMoment) <= now)
    .map(({ presentedAtMoment: _presented, ...row }) => row);
}

/* ==========================================================================
   Object names
   ========================================================================== */

/**
 * Display names for the objects work is linked to.
 *
 * One pass over each small table the scenario links work to. An identifier
 * that resolves to nothing is simply absent from the map, and the caller
 * shows the identifier itself: `CTL-PAY-014` is honest, an invented title is
 * not.
 */
export function getObjectLabels(runId = DEFAULT_RUN_ID): Map<string, { en: string; de: string }> {
  const labels = new Map<string, { en: string; de: string }>();
  const put = (id: string, en: string, de?: string) => {
    if (!labels.has(id)) labels.set(id, { en, de: de && de.length > 0 ? de : en });
  };

  for (const row of db().select().from(controls).where(eq(controls.runId, runId)).all()) {
    put(row.id, row.title, row.titleDe);
  }
  for (const row of db().select().from(risks).where(eq(risks.runId, runId)).all()) {
    put(row.id, row.title, row.titleDe);
  }
  for (const row of db().select().from(kris).where(eq(kris.runId, runId)).all()) {
    put(row.id, row.name, row.nameDe);
  }
  for (const row of db().select().from(processes).where(eq(processes.runId, runId)).all()) {
    put(row.id, row.name, row.nameDe);
  }
  for (const row of db().select().from(suppliers).where(eq(suppliers.runId, runId)).all()) {
    put(row.id, row.name);
  }
  for (const row of db().select().from(subprocessors).where(eq(subprocessors.runId, runId)).all()) {
    put(row.id, row.name);
  }
  for (const row of db().select().from(services).where(eq(services.runId, runId)).all()) {
    put(row.id, row.name);
  }
  for (const row of db().select().from(contracts).where(eq(contracts.runId, runId)).all()) {
    put(row.id, row.title);
  }
  for (const row of db().select().from(assessments).where(eq(assessments.runId, runId)).all()) {
    put(row.id, row.title);
  }
  return labels;
}

/* ==========================================================================
   Process scope
   ========================================================================== */

export interface WorkProcessScope {
  roleAppRunId: string;
  roleAppId: string;
  processName: { en: string; de: string };
  subjectKind: string;
  subjectId: string;
  status: string;
  currentStageId: string;
  currentStageName: { en: string; de: string } | null;
  /** Stage names by identifier, for naming the stage a meeting serves. */
  stageNames: Record<string, { en: string; de: string }>;
  entryRoute: string | null;
  /**
   * Every object identifier the running process covers.
   *
   * For an assessment that is the assessment, its process, every risk and
   * control on its lines and the indicators on the process. For a supplier it
   * is the supplier, its contracts and its subprocessors. Work is linked to a
   * process when its subject is in this set, and only then: a meeting about
   * one supplier is not linked to the onboarding of another.
   */
  scopeIds: string[];
}

export function getProcessScopes(roleId: RoleId, runId = DEFAULT_RUN_ID): WorkProcessScope[] {
  const scopes: WorkProcessScope[] = [];

  for (const app of getInstalledRoleApps(roleId)) {
    const runs = db()
      .select()
      .from(roleAppRuns)
      .where(and(eq(roleAppRuns.runId, runId), eq(roleAppRuns.roleId, roleId), eq(roleAppRuns.roleAppId, app.id)))
      .all();
    const definition = getProcessDefinition(app.processId);
    const stageNames: Record<string, { en: string; de: string }> = {};
    for (const stage of definition?.stages ?? []) stageNames[stage.id] = { en: stage.name, de: stage.nameDe };

    for (const run of runs) {
      const ids = new Set<string>([run.subjectId]);

      if (run.subjectKind === "assessment") {
        const assessment = db()
          .select()
          .from(assessments)
          .where(and(eq(assessments.runId, runId), eq(assessments.id, run.subjectId)))
          .get();
        if (assessment) {
          ids.add(assessment.subjectId);
          for (const line of db()
            .select()
            .from(assessmentLines)
            .where(and(eq(assessmentLines.runId, runId), eq(assessmentLines.assessmentId, assessment.id)))
            .all()) {
            ids.add(line.riskId);
            for (const controlId of line.controlIds) ids.add(controlId);
          }
          for (const kri of db().select().from(kris).where(eq(kris.runId, runId)).all()) {
            if (kri.processIds.includes(assessment.subjectId)) ids.add(kri.id);
          }
        }
      }

      if (run.subjectKind === "supplier") {
        for (const row of db()
          .select()
          .from(contracts)
          .where(and(eq(contracts.runId, runId), eq(contracts.supplierId, run.subjectId)))
          .all()) {
          ids.add(row.id);
        }
        for (const row of db()
          .select()
          .from(subprocessors)
          .where(and(eq(subprocessors.runId, runId), eq(subprocessors.supplierId, run.subjectId)))
          .all()) {
          ids.add(row.id);
        }
      }

      scopes.push({
        roleAppRunId: run.id,
        roleAppId: app.id,
        processName: { en: definition?.name ?? app.name, de: definition?.nameDe ?? app.nameDe },
        subjectKind: run.subjectKind,
        subjectId: run.subjectId,
        status: run.status,
        currentStageId: run.currentStageId,
        currentStageName: stageNames[run.currentStageId] ?? null,
        stageNames,
        entryRoute: app.entryRoute,
        scopeIds: [...ids],
      });
    }
  }

  return scopes;
}

/* ==========================================================================
   People
   ========================================================================== */

export interface WorkPerson {
  id: string;
  name: string;
  jobTitle: string;
  line: string;
}

/** Everyone an action could be assigned to: internal people, not external contacts. */
export function getAssignablePeople(runId = DEFAULT_RUN_ID): WorkPerson[] {
  return db()
    .select()
    .from(users)
    .where(eq(users.runId, runId))
    .all()
    .filter((row) => row.line !== "external")
    .map((row) => ({ id: row.id, name: row.name, jobTitle: row.jobTitle, line: row.line }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
