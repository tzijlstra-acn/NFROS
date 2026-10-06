/**
 * Whether an installed Role App may be started and opened.
 *
 * The one enablement check (plan 7.2, Wave 4 exit criterion: an installed app
 * can be enabled and disabled). The Product Owner Console's Enable, Disable
 * and Retire write the release state; this reads it, and the process landing,
 * the process run pages, the process server actions and the run factory call
 * it, so a disabled app cannot be opened, resumed, worked or started by any
 * of the paths that lead into it.
 *
 * The rule, in order:
 *
 *   1. Only an app the code registry marks installed can run at all. A
 *      preview app has no executable process; nothing here can install one.
 *   2. An app whose current release version is Retired is not runnable.
 *   3. The tenant enablement decides. Disabled means disabled, with who did
 *      it, when and why.
 *   4. No enablement recorded (a database seeded before the console existed)
 *      means the installed app runs as released, and the reading says the
 *      enablement is not recorded rather than claiming it was granted.
 *
 * Cohort enablement (a candidate version pinned to a pilot cohort) applies to
 * signed-in cohort members. The demonstration workday acts as the role
 * holder, not as a cohort member, so it follows the tenant setting, and the
 * console says so where a cohort is assigned.
 *
 * A database without the release tables (before migration 0006) must not
 * take the process pages down, so a read failure is reported as "not
 * recorded" and the app runs as released.
 *
 * Server only.
 */

import { getCurrentRoleAppVersion, getRoleAppEnablement } from "@/db/repositories/role-app-release";
import { getRun } from "@/db/repositories/role-app-runtime";
import { ORGANISATION_PROFILE_ID } from "@/product/seed";
import type { Bilingual } from "./contracts";
import { getRoleApp } from "./registry";

export type RoleAppAvailabilityState = "enabled" | "disabled" | "retired" | "not-installed";

export interface RoleAppAvailability {
  roleAppId: string;
  runnable: boolean;
  state: RoleAppAvailabilityState;
  /** Whether an enablement record exists for the tenant. False is never read as "granted". */
  recorded: boolean;
  /** Why, in both languages, for the page and for a refused action. */
  reason: Bilingual;
  changedAt: string | null;
  changedByLabel: string | null;
  /** The person's own reason for the change, as recorded. */
  changeReason: string | null;
}

/** The tenant the enablement is read for: the organisation profile this installation serves. */
export const ENABLEMENT_TENANT_ID = ORGANISATION_PROFILE_ID;

export function readRoleAppAvailability(roleAppId: string): RoleAppAvailability {
  const app = getRoleApp(roleAppId);
  if (!app || app.status !== "installed") {
    return {
      roleAppId,
      runnable: false,
      state: "not-installed",
      recorded: false,
      reason: {
        en: "This Role App is not installed in this build, so it cannot be started or opened.",
        de: "Diese Rollen-App ist in diesem Build nicht installiert und kann daher weder gestartet noch geoeffnet werden.",
      },
      changedAt: null,
      changedByLabel: null,
      changeReason: null,
    };
  }

  try {
    const current = getCurrentRoleAppVersion(roleAppId);
    if (current?.lifecycleState === "retired") {
      return {
        roleAppId,
        runnable: false,
        state: "retired",
        recorded: true,
        reason: {
          en: `${app.name} is retired by the product owner. Its runs are kept as they were and cannot be opened or worked.`,
          de: `${app.nameDe} wurde von der Produktverantwortung ausser Betrieb genommen. Ihre Laeufe bleiben unveraendert erhalten und koennen weder geoeffnet noch bearbeitet werden.`,
        },
        changedAt: current.releasedAt,
        changedByLabel: null,
        changeReason: null,
      };
    }

    const tenant = getRoleAppEnablement(roleAppId, "tenant", ENABLEMENT_TENANT_ID);
    if (tenant && !tenant.enabled) {
      return {
        roleAppId,
        runnable: false,
        state: "disabled",
        recorded: true,
        reason: {
          en: `${app.name} is disabled by the product owner (${tenant.changedByLabel}, ${tenant.changedAt.slice(0, 16).replace("T", " ")}). Its runs are kept as they were and cannot be opened, worked or started until it is enabled again.`,
          de: `${app.nameDe} wurde von der Produktverantwortung gesperrt (${tenant.changedByLabel}, ${tenant.changedAt.slice(0, 16).replace("T", " ")}). Ihre Laeufe bleiben unveraendert erhalten und koennen bis zur erneuten Freischaltung weder geoeffnet, bearbeitet noch gestartet werden.`,
        },
        changedAt: tenant.changedAt,
        changedByLabel: tenant.changedByLabel,
        changeReason: tenant.reason || null,
      };
    }

    return {
      roleAppId,
      runnable: true,
      state: "enabled",
      recorded: tenant !== undefined,
      reason: tenant
        ? {
            en: `${app.name} is enabled for the tenant.`,
            de: `${app.nameDe} ist fuer den Mandanten freigeschaltet.`,
          }
        : {
            en: `No enablement is recorded for ${app.name}. The installed app runs as released.`,
            de: `Fuer ${app.nameDe} ist keine Freischaltung erfasst. Die installierte App laeuft wie freigegeben.`,
          },
      changedAt: tenant?.changedAt ?? null,
      changedByLabel: tenant?.changedByLabel ?? null,
      changeReason: tenant?.reason || null,
    };
  } catch {
    return {
      roleAppId,
      runnable: true,
      state: "enabled",
      recorded: false,
      reason: {
        en: `The release state could not be read, so ${app.name} runs as released. Run npm run db:migrate.`,
        de: `Der Release-Zustand konnte nicht gelesen werden, ${app.nameDe} laeuft daher wie freigegeben. Fuehren Sie npm run db:migrate aus.`,
      },
      changedAt: null,
      changedByLabel: null,
      changeReason: null,
    };
  }
}

/** Whether the app may be started and opened. */
export function isRoleAppRunnable(roleAppId: string): boolean {
  return readRoleAppAvailability(roleAppId).runnable;
}

/** The refusal for a write into a disabled app, or null when it is runnable. */
export function roleAppUnavailableReason(roleAppId: string): Bilingual | null {
  const availability = readRoleAppAvailability(roleAppId);
  return availability.runnable ? null : availability.reason;
}

/**
 * The same refusal for a process run, by the app the run belongs to. An
 * unknown run is not refused here; the engine refuses it with its own reason.
 */
export function processRunUnavailableReason(processRunId: string): Bilingual | null {
  let roleAppId: string | undefined;
  try {
    roleAppId = getRun(processRunId)?.roleAppId;
  } catch {
    roleAppId = undefined;
  }
  return roleAppId ? roleAppUnavailableReason(roleAppId) : null;
}
