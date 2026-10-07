"use server";

/**
 * The one write Updates makes: marking an arrival read.
 *
 * Thin, like the process engine's actions. The role is named by the caller
 * because Updates belongs to the route's role, not to the scenario's acting
 * role; the existing live day action reads the acting role, which is the
 * mismatch audit finding J20 describes for decisions, and a read mark under
 * the wrong role would clear another function's update.
 *
 * Only arrivals can be marked read. Every other update is a state that clears
 * when its work is done, so there is deliberately no action that dismisses
 * one. The arrival has to exist and be addressed to the role; anything else is
 * refused without writing.
 */

import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseReady } from "@/db/client";
import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "@/db/schema/core";
import { workdayLiveEvents } from "@/db/schema/live";
import { markEventRead } from "@/scenario/engine/live-events";
import { gateForRole } from "@/workday/role-gate";
import { revalidateWorkday } from "@/workday/revalidate";
import { markRoutineNotificationRead } from "@/features/partner/notifications";

export interface MarkUpdateReadResult {
  ok: boolean;
}

const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;

export async function actionMarkUpdateRead(roleId: string, eventId: string): Promise<MarkUpdateReadResult> {
  if (!(ROLE_IDS as readonly string[]).includes(roleId)) return { ok: false };
  if (gateForRole(roleId).kind !== "open") return { ok: false };
  if (typeof eventId !== "string" || !EVENT_ID.test(eventId)) return { ok: false };
  if (!isDatabaseReady()) return { ok: false };

  /* A routine's new work is a message too; its read mark is the notification ledger's. */
  if (eventId.startsWith("NTF-")) {
    const marked = markRoutineNotificationRead(roleId as RoleId, eventId);
    if (marked) revalidateWorkday(roleId as RoleId, "routine");
    return { ok: marked };
  }

  const row = getDb()
    .select({ id: workdayLiveEvents.id, roleIds: workdayLiveEvents.roleIds })
    .from(workdayLiveEvents)
    .where(and(eq(workdayLiveEvents.runId, DEFAULT_RUN_ID), eq(workdayLiveEvents.id, eventId)))
    .get();
  if (!row) return { ok: false };
  const addressed = row.roleIds ?? [];
  if (addressed.length > 0 && !addressed.includes(roleId as RoleId)) return { ok: false };

  markEventRead(eventId, roleId as RoleId);
  revalidateWorkday(roleId as RoleId, "activity");
  return { ok: true };
}
