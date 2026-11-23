/**
 * Data access for saved skills.
 *
 * Plain reads and writes. Whether a stored spec may run is decided by the
 * skills feature, which checks every spec against the catalog when it reads
 * one (`src/features/skills/operations.ts`); nothing here interprets a spec.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { skills } from "@/db/schema/skills";

const db = () => getDb();

export type SkillRow = typeof skills.$inferSelect;
export type NewSkillRow = typeof skills.$inferInsert;

export function listSkills(roleId: RoleId, userId: string, runId = DEFAULT_RUN_ID): SkillRow[] {
  return db()
    .select()
    .from(skills)
    .where(and(eq(skills.runId, runId), eq(skills.roleId, roleId), eq(skills.userId, userId)))
    .orderBy(asc(skills.createdAt), asc(skills.id))
    .all();
}

export function getSkill(skillId: string, runId = DEFAULT_RUN_ID): SkillRow | undefined {
  return db().select().from(skills).where(and(eq(skills.runId, runId), eq(skills.id, skillId))).get();
}

export function findSkillByName(roleId: RoleId, userId: string, name: string, runId = DEFAULT_RUN_ID): SkillRow | undefined {
  return db()
    .select()
    .from(skills)
    .where(and(eq(skills.runId, runId), eq(skills.roleId, roleId), eq(skills.userId, userId), eq(skills.name, name)))
    .get();
}

export function insertSkill(row: NewSkillRow): SkillRow {
  db().insert(skills).values(row).run();
  const saved = getSkill(row.id, row.runId);
  if (!saved) throw new Error(`The skill ${row.id} was not written.`);
  return saved;
}

export function recordSkillRun(
  skillId: string,
  run: { at: string; moment: string; matched: number; inScope: number; auditEventId: string | null },
  runId = DEFAULT_RUN_ID,
): void {
  db()
    .update(skills)
    .set({
      lastRunAt: run.at,
      lastRunMoment: run.moment,
      lastRunMatched: run.matched,
      lastRunInScope: run.inScope,
      lastRunAuditEventId: run.auditEventId,
      updatedAt: run.at,
    })
    .where(and(eq(skills.runId, runId), eq(skills.id, skillId)))
    .run();
}

export function deleteSkill(skillId: string, runId = DEFAULT_RUN_ID): boolean {
  const result = db().delete(skills).where(and(eq(skills.runId, runId), eq(skills.id, skillId))).run();
  return result.changes > 0;
}
