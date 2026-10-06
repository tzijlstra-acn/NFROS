"use server";

/**
 * Server actions for the Role Apps page.
 *
 * Thin, like the process actions: read and validate the identifiers, call
 * the lifecycle function (which goes through `governConsoleAction`), refresh
 * the pages that show the result, and return the result in the reader's
 * language. No rule lives here.
 *
 * Enable, Disable, Retire and Roll back also refresh the role's workday,
 * because the process landing and run pages read the enablement on every
 * request and the client router would otherwise keep the page it saw.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RoleId } from "@/db/schema/core";
import { getRoleApp } from "@/role-apps/registry";
import { getRoleAppVersion } from "@/db/repositories/role-app-release";
import { readAdminLanguage } from "@/product/status/sources";
import { revalidateWorkday } from "@/workday/revalidate";
import {
  authorizeConsoleAction,
  readApprovalFields,
  recordConsoleRead,
  toFormState,
  type ConsoleFormState,
} from "../governance";
import { compareRoleAppVersions, type VersionComparisonRow } from "./compare";
import {
  approveRoleAppRelease,
  assignPilotCohort,
  createCandidateVersion,
  retireRoleApp,
  rollBackRoleApp,
  runVersionEvaluations,
  setTenantEnablement,
} from "./lifecycle";

const identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9._:-]+$/);

function invalid(): ConsoleFormState {
  return readAdminLanguage() === "de"
    ? { ok: false, message: "Die Anfrage ist unvollstaendig." }
    : { ok: false, message: "The request is incomplete." };
}

function refresh(roleAppId: string | null): void {
  revalidatePath("/product", "layout");
  const roleId = roleAppId ? getRoleApp(roleAppId)?.roleId : undefined;
  if (roleId) revalidateWorkday(roleId as RoleId, "process-stage");
}

export async function actionSetRoleAppEnablement(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const roleAppId = identifier.safeParse(data.get("roleAppId"));
  const enabled = data.get("enabled");
  if (!roleAppId.success || (enabled !== "true" && enabled !== "false")) return invalid();
  const result = await setTenantEnablement(roleAppId.data, enabled === "true", readApprovalFields(data));
  if (result.ok) refresh(roleAppId.data);
  return toFormState(result, readAdminLanguage());
}

export async function actionRollBackRoleApp(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const roleAppId = identifier.safeParse(data.get("roleAppId"));
  if (!roleAppId.success) return invalid();
  const result = await rollBackRoleApp(roleAppId.data, readApprovalFields(data));
  if (result.ok) refresh(roleAppId.data);
  return toFormState(result, readAdminLanguage());
}

export async function actionRetireRoleApp(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const roleAppId = identifier.safeParse(data.get("roleAppId"));
  if (!roleAppId.success) return invalid();
  const result = await retireRoleApp(roleAppId.data, readApprovalFields(data));
  if (result.ok) refresh(roleAppId.data);
  return toFormState(result, readAdminLanguage());
}

export async function actionCreateCandidate(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const roleAppId = identifier.safeParse(data.get("roleAppId"));
  const version = z.string().min(1).max(20).safeParse(data.get("version"));
  if (!roleAppId.success || !version.success) return invalid();
  const result = await createCandidateVersion(roleAppId.data, {
    version: version.data,
    notes: String(data.get("notes") ?? "").slice(0, 2000),
    notesDe: String(data.get("notesDe") ?? "").slice(0, 2000),
  });
  if (result.ok) refresh(null);
  return toFormState(result, readAdminLanguage());
}

export async function actionRunEvaluations(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const versionId = identifier.safeParse(data.get("versionId"));
  if (!versionId.success) return invalid();
  const result = await runVersionEvaluations(versionId.data);
  if (result.ok) refresh(null);
  return toFormState(result, readAdminLanguage());
}

export async function actionAssignPilotCohort(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const versionId = identifier.safeParse(data.get("versionId"));
  const cohortId = identifier.safeParse(data.get("cohortId"));
  if (!versionId.success) return invalid();
  const result = await assignPilotCohort(versionId.data, cohortId.success ? cohortId.data : null, readApprovalFields(data));
  if (result.ok) refresh(getRoleAppVersion(versionId.data)?.roleAppId ?? null);
  return toFormState(result, readAdminLanguage());
}

export async function actionApproveRelease(_previous: ConsoleFormState | null, data: FormData): Promise<ConsoleFormState> {
  const versionId = identifier.safeParse(data.get("versionId"));
  if (!versionId.success) return invalid();
  const result = await approveRoleAppRelease(versionId.data, readApprovalFields(data));
  if (result.ok) refresh(getRoleAppVersion(versionId.data)?.roleAppId ?? null);
  return toFormState(result, readAdminLanguage());
}

export interface CompareState extends ConsoleFormState {
  rows: VersionComparisonRow[];
  left: string | null;
  right: string | null;
}

/** Compare versions: permission checked and recorded as a console read. */
export async function actionCompareVersions(_previous: CompareState | null, data: FormData): Promise<CompareState> {
  const language = readAdminLanguage();
  const leftId = identifier.safeParse(data.get("left"));
  const rightId = identifier.safeParse(data.get("right"));
  if (!leftId.success || !rightId.success) return { ...invalid(), rows: [], left: null, right: null };
  const left = getRoleAppVersion(leftId.data);
  const right = getRoleAppVersion(rightId.data);
  const target = { kind: "role-app", id: left?.roleAppId ?? leftId.data };
  const authorized = await authorizeConsoleAction("role-app.compare-versions", target);
  if (!authorized.ok) {
    return { ok: false, message: language === "de" ? authorized.reason.de : authorized.reason.en, code: authorized.code, rows: [], left: null, right: null };
  }
  if (!left || !right || left.roleAppId !== right.roleAppId) {
    return {
      ok: false,
      message: language === "de" ? "Waehlen Sie zwei Versionen derselben Rollen-App." : "Choose two versions of the same Role App.",
      rows: [],
      left: null,
      right: null,
    };
  }
  recordConsoleRead("role-app.compare-versions", authorized.actor, target, {
    en: `Compared ${left.version} with ${right.version}.`,
    de: `${left.version} mit ${right.version} verglichen.`,
  });
  const rows = compareRoleAppVersions(left, right, language);
  const changed = rows.filter((row) => row.changed).length;
  return {
    ok: true,
    message:
      language === "de"
        ? `${left.version} und ${right.version}: ${changed} von ${rows.length} Feldern unterscheiden sich.`
        : `${left.version} and ${right.version}: ${changed} of ${rows.length} fields differ.`,
    rows,
    left: left.version,
    right: right.version,
  };
}
