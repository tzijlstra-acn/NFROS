"use server";

/**
 * The recording point for experience events (plan 7.4).
 *
 * One server action, called by `ExperienceBeacon` once per visit. It writes
 * one `experience_events` row (0006) with no user id, keyed so a double
 * render records one event. Only the kinds the table defines are accepted,
 * and only for a known role; anything else is ignored.
 */

import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { recordExperienceEvent } from "@/db/repositories/experience-events";
import { EXPERIENCE_EVENT_KINDS, type ExperienceEventKind } from "@/db/schema/product-console";
import { getScenarioState } from "@/scenario/engine/state";
import { getResolvedDemoMode } from "@/server/config/runtime";

export async function actionRecordExperienceEvent(input: { kind: string; roleId: string; visitKey: string; subjectKind?: string; subjectId?: string }): Promise<void> {
  if (!(EXPERIENCE_EVENT_KINDS as readonly string[]).includes(input.kind)) return;
  if (!(ROLE_IDS as readonly string[]).includes(input.roleId)) return;
  if (!/^[A-Za-z0-9-]{8,64}$/.test(input.visitKey)) return;
  try {
    const state = getScenarioState();
    if (!state) return;
    recordExperienceEvent({
      id: `XEV-${input.kind}-${input.roleId}-${input.visitKey}`,
      runId: state.runId,
      kind: input.kind as ExperienceEventKind,
      roleId: input.roleId as RoleId,
      legalEntityId: null,
      processId: null,
      processRunId: null,
      stageId: null,
      cohortId: null,
      mode: getResolvedDemoMode().mode,
      subjectKind: input.subjectKind ?? null,
      subjectId: input.subjectId ?? null,
      atMoment: state.currentMoment,
      occurredAt: new Date().toISOString(),
      idempotencyKey: `${input.kind}:${input.roleId}:${input.visitKey}`,
    });
  } catch {
    /* Analytics never breaks the page it measures. */
  }
}
