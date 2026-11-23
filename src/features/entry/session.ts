/**
 * Signing in to and out of NFR Workspace.
 *
 * Server only. A sign-in checks the demonstration account, opens a session
 * through the existing demonstration identity provider, writes an audit
 * event, and returns the facts the context-loading step shows: the acting
 * role and its holder, how many authority scopes the role holds, how many
 * decisions are open, and the moment the records are read at. Each of those
 * is read from the same sources the workspace itself reads, so the loading
 * step never announces something the next screen contradicts.
 */

import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { buildHeaderModel } from "@/db/repositories/header";
import { localDemoProvider } from "@/identity/local-demo";
import { checkDemoCredentials, WORKSPACE_ADMIN_PERSONA } from "@/identity/demo-credentials";
import { getSession } from "@/identity";
import { ROLE_AUTHORITY_SCOPES } from "@/server/security/authority";
import { recordAuditEvent } from "@/server/security/audit";
import { requireScenarioState } from "@/scenario/engine/state";
import { DEFAULT_WORKSPACE_ROLE, safeNextPath } from "./routes";

export interface WorkspaceContextFacts {
  roleId: RoleId;
  roleLabel: string;
  holderName: string | null;
  entityLabel: string | null;
  scopeCount: number;
  decisionsOpen: number;
  /** "06.10.2026, 07:45", the scenario moment the records are read at. */
  recordsAsOf: string | null;
}

export type SignInResult =
  | { ok: true; next: string; displayName: string; context: WorkspaceContextFacts }
  | { ok: false; reason: "missing" | "invalid" };

function roleFromPath(path: string): RoleId {
  const segment = path.split("/")[2] ?? "";
  return (ROLE_IDS as readonly string[]).includes(segment) ? (segment as RoleId) : DEFAULT_WORKSPACE_ROLE;
}

function formatMoment(date: string, moment: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}, ${moment}`;
}

/** Writes an audit event when the scenario exists. A sign-in never fails on audit. */
function audit(action: string, summary: string, actorUserId: string | null, blocked: boolean): void {
  try {
    const state = requireScenarioState();
    recordAuditEvent({
      runId: state.runId,
      atMoment: state.currentMoment,
      category: blocked ? "blocked" : "system",
      action,
      objectKind: "session",
      objectId: actorUserId ?? "anonymous",
      summary,
      actorUserId,
      actorKind: "human",
      blocked,
      blockedReason: blocked ? "invalid-credentials" : null,
    });
  } catch {
    /* No seeded scenario yet: the sign-in still works, and there is no trail to write to. */
  }
}

export function readWorkspaceContext(roleId: RoleId): WorkspaceContextFacts {
  const model = buildHeaderModel(roleId);
  let recordsAsOf: string | null = null;
  try {
    const state = requireScenarioState();
    recordsAsOf = formatMoment(state.scenarioDate, state.currentMoment);
  } catch {
    recordsAsOf = null;
  }
  return {
    roleId,
    roleLabel: model.roleLabel,
    holderName: model.userLabel,
    entityLabel: model.entityLabel,
    scopeCount: ROLE_AUTHORITY_SCOPES[roleId]?.length ?? 0,
    decisionsOpen: model.decisionsOpen,
    recordsAsOf,
  };
}

export async function signInToWorkspace(input: {
  username: unknown;
  password: unknown;
  next: unknown;
}): Promise<SignInResult> {
  const check = checkDemoCredentials(input.username, input.password);
  if (!check.ok) {
    if (check.reason === "invalid") {
      audit("signIn", "A sign-in to NFR Workspace was refused: the username or password did not match.", null, true);
    }
    return { ok: false, reason: check.reason };
  }
  const session = await localDemoProvider.signIn({ personaId: WORKSPACE_ADMIN_PERSONA, browserSession: true });
  const next = safeNextPath(input.next);
  audit("signIn", `${session.displayName} signed in to NFR Workspace.`, session.userId, false);
  return { ok: true, next, displayName: session.displayName, context: readWorkspaceContext(roleFromPath(next)) };
}

export async function signOutOfWorkspace(): Promise<void> {
  const session = await getSession().catch(() => null);
  await localDemoProvider.signOut();
  if (session) audit("signOut", `${session.displayName} signed out of NFR Workspace.`, session.userId, false);
}
