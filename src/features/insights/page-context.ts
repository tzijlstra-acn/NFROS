/**
 * What every Insights page needs from the server: the role, its language,
 * the people involved, and the permission view of each proposed action.
 *
 * Server only. The permission view is computed here from the role's
 * authority scopes, so the canvas can show a locked action as locked before
 * anyone presses it; the gate checks again at commit, whatever the canvas
 * showed.
 */

import { notFound } from "next/navigation";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { getRole, getUsers } from "@/db/repositories/workday";
import { getScenarioState } from "@/scenario/engine/state";
import { evaluateAuthority, ROLE_AUTHORITY_SCOPES } from "@/server/security/authority";
import { ROLE_RELEASE_DEFINITIONS } from "@/product/release";
import { getSession } from "@/identity";
import { permissionFor } from "./build/common";
import type { InsightResponse } from "./schema";

export interface InsightsPageContext {
  roleId: RoleId;
  language: "en" | "de";
  holderName: string;
  roleLabel: string;
  signedInAs: string | null;
}

export async function insightsPageContext(roleParam: string): Promise<InsightsPageContext> {
  if (!(ROLE_IDS as readonly string[]).includes(roleParam)) notFound();
  const roleId = roleParam as RoleId;
  const state = getScenarioState();
  const holderId = getRole(roleId)?.holderUserId ?? null;
  const holderName = getUsers().find((user) => user.id === holderId)?.name ?? "";
  const roleLabel = ROLE_RELEASE_DEFINITIONS.find((entry) => entry.roleId === roleId)?.releaseLabel ?? roleId;
  const session = await getSession().catch(() => null);
  return { roleId, language: state?.language === "de" ? "de" : "en", holderName, roleLabel, signedInAs: session?.displayName ?? null };
}

export function permissionViews(roleId: RoleId, response: InsightResponse) {
  const views: Record<string, { allowed: boolean; missingScopes: string[]; authorityClass: string; approvalRequired: boolean; heldBy: string[] }> = {};
  for (const recommendation of response.recommendations) {
    const action = recommendation.proposedAction;
    if (!action) continue;
    const permission = permissionFor(roleId, action.toolName);
    /* Ask the gate, with no approval, what it would require now. Pure: it writes nothing. */
    const state = getScenarioState();
    const verdict = state
      ? evaluateAuthority({ toolName: action.toolName, roleId, autonomyLevel: state.autonomyLevel, payload: action.payload, actingUserId: getRole(roleId)?.holderUserId ?? "", approval: null })
      : null;
    const approvalRequired = verdict ? (verdict.allowed ? verdict.requiresApproval : verdict.code === "approval-missing") : permission.approvalRequired;
    const heldBy = permission.missingScopes.length
      ? ROLE_RELEASE_DEFINITIONS.filter((entry) =>
          permission.missingScopes.every((scope) => (ROLE_AUTHORITY_SCOPES[entry.roleId as RoleId] ?? []).includes(scope as never)),
        ).map((entry) => entry.releaseLabel)
      : [];
    views[recommendation.id] = {
      allowed: permission.allowed,
      missingScopes: permission.missingScopes,
      authorityClass: permission.authorityClass,
      approvalRequired,
      heldBy,
    };
  }
  return views;
}
