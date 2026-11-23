/**
 * The governed step of a skill: `runSkill` (READ).
 *
 * Every preview and every run of a skill, from the builder, a saved skill or
 * the work partner, goes through `executeTool("runSkill", ...)`, so the
 * authority gate decides whether it may run and the call is audited and
 * recorded either way. The handler checks the spec against the catalog again
 * (the payload is never trusted), takes the scope from the tool context
 * rather than the payload, and returns rows. It writes nothing.
 *
 * Registered once per process, as the other tool modules do.
 */

import {
  hasToolHandler,
  registerToolHandler,
  type ToolHandlerResult,
} from "@/agents/tools/runtime";
import { checkSkillSpec } from "./schema";
import { runSkillSpec, sourceLabel, type SkillRunResult } from "./execute";

export const RUN_SKILL_TOOL = "runSkill";

function register(): void {
  if (hasToolHandler(RUN_SKILL_TOOL)) return;
  registerToolHandler(RUN_SKILL_TOOL, (payload, context): ToolHandlerResult => {
    const checked = checkSkillSpec(payload["spec"]);
    if (!checked.ok) {
      throw new Error(`The skill was not run: ${checked.problems.map((entry) => entry.en).join(" ")}`);
    }
    const skillId = typeof payload["skillId"] === "string" && payload["skillId"].length > 0 ? payload["skillId"] : "draft";
    const result: SkillRunResult = runSkillSpec(checked.spec, {
      runId: context.runId,
      roleId: context.roleId,
      atMoment: context.atMoment,
      language: context.language,
    });
    const noun = sourceLabel(result.source, "en").toLowerCase();
    return {
      summary: `Ran ${skillId === "draft" ? "a draft skill" : `skill ${skillId}`} over ${result.inScope} ${noun} in scope; ${result.matched} matched. Nothing was changed.`,
      data: result,
      objectKind: "skill",
      objectId: skillId,
      evidenceIds: result.source === "evidence" ? result.rows.map((row) => row.id).slice(0, 24) : [],
    };
  });
}

register();
