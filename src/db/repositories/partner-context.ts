/**
 * Data access for the AI Partner's durable working context.
 *
 * One row per person and role. `savePartnerContext` merges: a field the
 * caller passes is written, a field it leaves out keeps its value, and a
 * field set to null is cleared. Each write raises `version`, so a reader that
 * cached a context can tell it has changed.
 *
 * What goes into the context (what "the selected object" is after a
 * navigation, which prior decisions bear on it) is the Partner's rule; this
 * module only keeps the context outside the chat transcript.
 */

import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { partnerContexts } from "@/db/schema/ai-partner";

const db = () => getDb();

export type PartnerContextRow = typeof partnerContexts.$inferSelect;

/** The fields a caller may set. Everything else is identity or bookkeeping. */
export type PartnerContextFields = Partial<
  Omit<PartnerContextRow, "id" | "runId" | "userId" | "roleId" | "version" | "updatedAt" | "updatedAtMoment">
>;

export interface SavePartnerContextInput {
  userId: string;
  roleId: RoleId;
  fields: PartnerContextFields;
  updatedAt: string;
  updatedAtMoment: string;
  runId?: string;
}

export function getPartnerContext(userId: string, roleId: RoleId, runId = DEFAULT_RUN_ID): PartnerContextRow | undefined {
  return db()
    .select()
    .from(partnerContexts)
    .where(and(eq(partnerContexts.runId, runId), eq(partnerContexts.userId, userId), eq(partnerContexts.roleId, roleId)))
    .get();
}

/** Writes the context, merging into the existing row. Returns the row as stored. */
export function savePartnerContext(input: SavePartnerContextInput): PartnerContextRow {
  const runId = input.runId ?? DEFAULT_RUN_ID;
  /* Undefined means "leave as it is"; it must not reach the update as a value. */
  const fields = Object.fromEntries(
    Object.entries(input.fields).filter(([, value]) => value !== undefined),
  ) as PartnerContextFields;

  const write = getSqlite().transaction((): PartnerContextRow => {
    const existing = getPartnerContext(input.userId, input.roleId, runId);
    if (existing) {
      db()
        .update(partnerContexts)
        .set({ ...fields, version: existing.version + 1, updatedAt: input.updatedAt, updatedAtMoment: input.updatedAtMoment })
        .where(eq(partnerContexts.id, existing.id))
        .run();
    } else {
      db()
        .insert(partnerContexts)
        .values({
          id: `PCTX-${runId}-${input.userId}-${input.roleId}`,
          runId,
          userId: input.userId,
          roleId: input.roleId,
          sourceFreshness: [],
          priorDecisionIds: [],
          userEdits: [],
          ...fields,
          version: 1,
          updatedAt: input.updatedAt,
          updatedAtMoment: input.updatedAtMoment,
        })
        .run();
    }
    const saved = getPartnerContext(input.userId, input.roleId, runId);
    if (!saved) throw new Error(`The partner context for ${input.userId} in ${input.roleId} was not written.`);
    return saved;
  });

  return write();
}

/** Forgets a person's context in a role. Returns whether there was one. */
export function clearPartnerContext(userId: string, roleId: RoleId, runId = DEFAULT_RUN_ID): boolean {
  return (
    db()
      .delete(partnerContexts)
      .where(and(eq(partnerContexts.runId, runId), eq(partnerContexts.userId, userId), eq(partnerContexts.roleId, roleId)))
      .run().changes > 0
  );
}
