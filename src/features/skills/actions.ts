"use server";

/**
 * Server actions for Processes, Skills.
 *
 * Thin, like the Work Hub's: validate the form, call the skills operation,
 * revalidate the role's workday and return to the Skills view. The role
 * arrives from the form and is re-checked against the role list; the acting
 * person is the role's holder, read on the server. Saving and removing a
 * skill change the person's own list of skills and never a record.
 */

import { redirect } from "next/navigation";
import { z } from "zod";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { revalidateWorkday } from "@/workday/revalidate";
import { decodeSpec } from "@/features/skills/schema";
import { removeSkill, saveSkill } from "@/features/skills/operations";

const saveSchema = z.object({
  roleId: z.enum(ROLE_IDS),
  name: z.string().max(200),
  request: z.string().max(400),
  spec: z.string().min(1).max(4000),
  via: z.enum(["model", "rules"]),
});

const removeSchema = z.object({
  roleId: z.enum(ROLE_IDS),
  skillId: z.string().regex(/^SKL-[A-Z0-9]{8}$/),
});

function skillsHref(roleId: RoleId, query: Record<string, string>): string {
  const params = new URLSearchParams({ view: "skills", ...query });
  return `/workday/${roleId}/processes?${params.toString()}`;
}

function fields(data: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of data.entries()) if (typeof value === "string") result[key] = value;
  return result;
}

export async function actionSaveSkill(data: FormData): Promise<void> {
  const parsed = saveSchema.safeParse(fields(data));
  if (!parsed.success) redirect(skillsHref("tprm", { notice: "invalid" }));
  const { roleId, name, request, spec: encoded, via } = parsed.data;
  const spec = decodeSpec(encoded);
  if (!spec) redirect(skillsHref(roleId, { notice: "invalid" }));
  const schedule = data.get("schedule") === "weekly" ? "weekly" : "manual";
  const outcome = saveSkill(roleId, { name, request, spec: { ...spec, schedule }, via });
  if (!outcome.ok) {
    const code = outcome.message.en.startsWith("You already have") ? "duplicate" : outcome.message.en.startsWith("Give the skill") ? "name" : "invalid";
    redirect(skillsHref(roleId, { notice: code, ask: request }));
  }
  revalidateWorkday(roleId, "skill");
  redirect(skillsHref(roleId, { skill: outcome.skill.id, notice: "saved" }));
}

export async function actionRemoveSkill(data: FormData): Promise<void> {
  const parsed = removeSchema.safeParse(fields(data));
  if (!parsed.success) redirect(skillsHref("tprm", { notice: "invalid" }));
  const removed = removeSkill(parsed.data.roleId, parsed.data.skillId);
  revalidateWorkday(parsed.data.roleId, "skill");
  redirect(skillsHref(parsed.data.roleId, { notice: removed ? "removed" : "invalid" }));
}
