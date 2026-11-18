/**
 * Skills operations: preview, save, run and remove.
 *
 * A preview and a run go through `executeTool("runSkill", ...)`, so the gate
 * decides and the call is audited. Saving and removing a skill are the
 * person's own personalisation writes, like a saved view: no tool, an audit
 * event in the system category, and nothing about a record changes. The
 * acting person is the role's holder, read on the server.
 */

import { randomUUID } from "node:crypto";
import type { RoleId } from "@/db/schema/core";
import { executeTool, type ToolCallResult, type ToolContext } from "@/agents/tools/runtime";
import { workToolContext } from "@/features/work/governance";
import { requireScenarioState } from "@/scenario/engine/state";
import { recordAuditEvent } from "@/server/security/audit";
import {
  deleteSkill,
  findSkillByName,
  getSkill,
  insertSkill,
  listSkills,
  recordSkillRun,
  type SkillRow,
} from "@/db/repositories/skills";
import type { Bilingual } from "./catalog";
import { checkSkillSpec, type SkillSpec } from "./schema";
import type { SkillRunResult } from "./execute";
import type { SkillDraftedVia } from "./compile";
import { RUN_SKILL_TOOL } from "./tools";

export interface SkillRunOutcome {
  ok: boolean;
  result: SkillRunResult | null;
  /** What the gate or the handler said, when there is no result. */
  message: Bilingual | null;
  auditEventId: string | null;
  tool: ToolCallResult;
}

function outcomeOf(tool: ToolCallResult): SkillRunOutcome {
  if (tool.outcome === "executed" && tool.data && typeof tool.data === "object") {
    return { ok: true, result: tool.data as SkillRunResult, message: null, auditEventId: tool.auditEventId ?? null, tool };
  }
  return {
    ok: false,
    result: null,
    message: {
      en: tool.outcome === "blocked" ? `The skill was not run. ${tool.summary}` : "The skill could not be run. Nothing was changed.",
      de: tool.outcome === "blocked" ? `Der Skill wurde nicht ausgefuehrt. ${tool.summary}` : "Der Skill konnte nicht ausgefuehrt werden. Nichts wurde geaendert.",
    },
    auditEventId: tool.auditEventId ?? null,
    tool,
  };
}

/** Runs a spec through the gate, in a context the caller assembled on the server. */
export async function runSkillThroughGate(spec: SkillSpec, context: ToolContext, skillId: string | null = null): Promise<SkillRunOutcome> {
  const tool = await executeTool(
    RUN_SKILL_TOOL,
    { spec, skillId: skillId ?? "draft" },
    { ...context, target: { kind: "skill", id: skillId ?? "draft" } },
  );
  return outcomeOf(tool);
}

/** Previews a draft from the builder: the person's own read, in the Work context. */
export async function previewSkill(roleId: RoleId, spec: SkillSpec): Promise<SkillRunOutcome> {
  return runSkillThroughGate(spec, workToolContext(roleId));
}

export interface SavedSkillView {
  row: SkillRow;
  /** Null when the stored spec no longer passes the catalog check. */
  spec: SkillSpec | null;
}

export function savedSkills(roleId: RoleId): SavedSkillView[] {
  const context = workToolContext(roleId);
  return listSkills(roleId, context.actingUserId, context.runId).map((row) => {
    const checked = checkSkillSpec(row.spec);
    return { row, spec: checked.ok ? checked.spec : null };
  });
}

export type SaveSkillOutcome = { ok: true; skill: SkillRow } | { ok: false; message: Bilingual };

export function saveSkill(roleId: RoleId, input: { name: string; request: string; spec: unknown; via: SkillDraftedVia }): SaveSkillOutcome {
  const checked = checkSkillSpec(input.spec);
  if (!checked.ok) {
    return { ok: false, message: checked.problems[0] ?? { en: "The skill cannot be saved.", de: "Der Skill kann nicht gespeichert werden." } };
  }
  const name = input.name.trim().slice(0, 80);
  if (name.length < 3) {
    return { ok: false, message: { en: "Give the skill a name of at least three letters.", de: "Geben Sie dem Skill einen Namen mit mindestens drei Zeichen." } };
  }
  const state = requireScenarioState();
  const context = workToolContext(roleId);
  if (findSkillByName(roleId, context.actingUserId, name, state.runId)) {
    return { ok: false, message: { en: `You already have a skill named "${name}".`, de: `Sie haben bereits einen Skill mit dem Namen "${name}".` } };
  }
  const at = new Date().toISOString();
  const skill = insertSkill({
    id: `SKL-${randomUUID().slice(0, 8).toUpperCase()}`,
    runId: state.runId,
    userId: context.actingUserId,
    roleId,
    name,
    request: input.request.trim().slice(0, 400),
    spec: checked.spec as unknown as Record<string, unknown>,
    schedule: checked.spec.schedule,
    draftedVia: input.via,
    createdAt: at,
    createdAtMoment: state.currentMoment,
    updatedAt: at,
  });
  recordAuditEvent({
    runId: state.runId,
    atMoment: state.currentMoment,
    category: "system",
    action: "skill-saved",
    objectKind: "skill",
    objectId: skill.id,
    summary: `Saved the skill "${skill.name}". It reads ${checked.spec.source} and changes nothing.`,
    actorUserId: context.actingUserId,
    actorKind: "human",
    roleId,
    authorityClass: "READ",
    reversible: true,
    detail: { source: checked.spec.source, filters: checked.spec.filters.length, schedule: checked.spec.schedule, draftedVia: input.via },
  });
  return { ok: true, skill };
}

/** Runs a saved skill through the gate and records the run on the row. */
export async function runSavedSkill(roleId: RoleId, skillId: string): Promise<SkillRunOutcome | null> {
  const context = workToolContext(roleId);
  const row = getSkill(skillId, context.runId);
  if (!row || row.roleId !== roleId || row.userId !== context.actingUserId) return null;
  const checked = checkSkillSpec(row.spec);
  if (!checked.ok) {
    return {
      ok: false,
      result: null,
      message: { en: "This skill no longer matches the catalog, so it was not run. Draft it again.", de: "Dieser Skill passt nicht mehr zum Katalog und wurde nicht ausgefuehrt. Entwerfen Sie ihn neu." },
      auditEventId: null,
      tool: { toolName: RUN_SKILL_TOOL, outcome: "failed", summary: "The stored spec failed the catalog check.", evidenceIds: [], durationMs: 0 },
    };
  }
  const outcome = await runSkillThroughGate(checked.spec, context, row.id);
  if (outcome.ok && outcome.result) {
    recordSkillRun(
      row.id,
      { at: new Date().toISOString(), moment: context.atMoment, matched: outcome.result.matched, inScope: outcome.result.inScope, auditEventId: outcome.auditEventId },
      context.runId,
    );
  }
  return outcome;
}

export function removeSkill(roleId: RoleId, skillId: string): boolean {
  const context = workToolContext(roleId);
  const row = getSkill(skillId, context.runId);
  if (!row || row.roleId !== roleId || row.userId !== context.actingUserId) return false;
  const removed = deleteSkill(row.id, context.runId);
  if (removed) {
    recordAuditEvent({
      runId: context.runId,
      atMoment: context.atMoment,
      category: "system",
      action: "skill-removed",
      objectKind: "skill",
      objectId: row.id,
      summary: `Removed the skill "${row.name}". No record was changed.`,
      actorUserId: context.actingUserId,
      actorKind: "human",
      roleId,
      reversible: false,
    });
  }
  return removed;
}
