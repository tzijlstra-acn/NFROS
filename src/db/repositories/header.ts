/**
 * The header model, and nothing else.
 *
 * This module exists because of a measured defect. The V2 header was built by
 * `buildShellChrome`, which also assembles a searchable index of every risk,
 * control, supplier, service, incident, obligation and decision, and it was
 * rendered inside a page subtree that first awaited the intelligence rail, the
 * role workspace view, the focus queue and the Now detail. On this machine
 * that meant the header needed 312ms of data and waited 1224ms.
 *
 * So the header gets its own assembler with its own budget. Everything here
 * is a lookup or a count. There is deliberately no evidence retrieval, no
 * connector call, no AI call, no workspace view and no command index: each of
 * those is a thing the brief forbids the header from depending on, and the way
 * to guarantee that is for the function that feeds it to be unable to reach
 * them.
 *
 * Every query is wrapped. A header that throws takes the whole workday with
 * it, and the point of the exercise is a header that renders when other things
 * are broken.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, isDatabaseReady } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { decisions } from "@/db/schema/decisions";
import { aiSuggestions, workdayLiveEventReads, workdayLiveEvents } from "@/db/schema/live";
import { getEntity, getRole, getUser } from "./workday";
import { getBrandIdentity } from "@/product";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { momentToMinutes } from "@/domain/nfr/calculators";
import { getScenarioState } from "@/scenario/engine/state";
import type { Language } from "@/i18n/labels";

const db = () => getDb();

/**
 * What the header renders.
 *
 * Deliberately flat and small. The fields the brief excludes are excluded:
 * no work lane, no autonomy explanation, no demo mode detail, no Today versus
 * future, no language buttons, no background work statistics, no timeline
 * title, no connector health, no withheld tool count. Those live in menus and
 * administrator views.
 */
export interface WorkdayHeaderModel {
  productName: string;
  productMark: string | null;
  roleLabel: string;
  entityLabel: string | null;
  updatesCount: number;
  aiState: "idle" | "working" | "ready" | "offline";
  userLabel: string | null;
  language: Language;
  /** True when the scenario is missing, so the header can still say so. */
  degraded: boolean;
}

/** The shape used when nothing at all can be resolved. */
export function fallbackHeaderModel(language: Language = "en"): WorkdayHeaderModel {
  return {
    productName: "NFR WorkOS",
    productMark: null,
    roleLabel: language === "de" ? "Arbeitstag" : "Workday",
    entityLabel: null,
    updatesCount: 0,
    aiState: "idle",
    userLabel: null,
    language,
    degraded: true,
  };
}

/**
 * Counts unread live events for a role at the current moment.
 *
 * One query with a left join. Read state is per role, which is why this cannot
 * be a single count over the events table.
 */
function countUpdates(roleId: RoleId, atMoment: string, runId: string): number {
  try {
    const minutes = momentToMinutes(atMoment);
    const rows = db()
      .select({
        atMoment: workdayLiveEvents.atMoment,
        roleIds: workdayLiveEvents.roleIds,
        readAt: workdayLiveEventReads.readAt,
      })
      .from(workdayLiveEvents)
      .leftJoin(
        workdayLiveEventReads,
        and(
          eq(workdayLiveEventReads.eventId, workdayLiveEvents.id),
          eq(workdayLiveEventReads.roleId, roleId),
        ),
      )
      .where(eq(workdayLiveEvents.runId, runId))
      .all();

    return rows.filter((row) => {
      if (row.readAt !== null) return false;
      if (momentToMinutes(row.atMoment) > minutes) return false;
      const roleIds = row.roleIds ?? [];
      return roleIds.length === 0 || roleIds.includes(roleId);
    }).length;
  } catch {
    return 0;
  }
}

/**
 * The partner state, from what is actually recorded.
 *
 * `working` is not reachable from here on purpose. Whether a generation is in
 * flight is client state, and the header is server rendered; claiming
 * `working` would mean the header asserted activity it cannot observe. The
 * client control raises it to `working` when it starts a run.
 */
function resolveAiState(roleId: RoleId, runId: string): WorkdayHeaderModel["aiState"] {
  try {
    if (getResolvedDemoMode().mode === "offline") return "offline";
    const row = db()
      .select({ n: sql<number>`count(*)` })
      .from(aiSuggestions)
      .where(
        and(
          eq(aiSuggestions.runId, runId),
          eq(aiSuggestions.roleId, roleId),
          eq(aiSuggestions.status, "needs-user"),
          isNull(aiSuggestions.dismissedAt),
        ),
      )
      .get();
    return (row?.n ?? 0) > 0 ? "ready" : "idle";
  } catch {
    return "idle";
  }
}

/** Open decisions for a role, used by the navigation rather than the header. */
export function countOpenDecisions(roleId: RoleId, runId = DEFAULT_RUN_ID): number {
  try {
    const row = db()
      .select({ n: sql<number>`count(*)` })
      .from(decisions)
      .where(
        and(eq(decisions.runId, runId), eq(decisions.roleId, roleId), eq(decisions.status, "open")),
      )
      .get();
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Builds the header model.
 *
 * Never throws. A role that does not resolve yields the `Workday` fallback
 * label rather than an error, because the brief accepts that word while the
 * role is unknown and does not accept a blank strip.
 */
export function buildHeaderModel(
  roleParam: string,
  options: { runId?: string } = {},
): WorkdayHeaderModel {
  const runId = options.runId ?? DEFAULT_RUN_ID;

  if (!isDatabaseReady()) return fallbackHeaderModel();

  try {
    const state = getScenarioState(runId);
    const language = (state?.language ?? "en") as Language;
    const brand = getBrandIdentity();

    const role = getRole(roleParam as RoleId, runId);
    if (!role || !state) {
      return {
        ...fallbackHeaderModel(language),
        productName: brand.shortName,
        productMark: brand.marks[0]?.src ?? null,
      };
    }

    const holder = getUser(role.holderUserId, runId);
    const entity = getEntity(role.entityId, runId);

    return {
      productName: brand.shortName,
      productMark: brand.marks[0]?.src ?? null,
      roleLabel: language === "de" ? role.titleDe : role.title,
      entityLabel: entity?.shortName ?? null,
      updatesCount: countUpdates(role.id, state.currentMoment, runId),
      aiState: resolveAiState(role.id, runId),
      userLabel: holder?.name ?? null,
      language,
      degraded: false,
    };
  } catch {
    return fallbackHeaderModel();
  }
}
