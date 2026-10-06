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
 * them. The search index is fetched by the palette when it is first opened;
 * it is not built here.
 *
 * Every count is the count of its destination, read through the same function
 * the destination reads, because a badge that disagrees with the page it opens
 * is the one kind of number a reader learns to ignore (audit T06, T07):
 *
 *   Decisions   the open decisions the Decisions page lists at this moment,
 *               through `getDecisions`, which filters on `presentedAtMoment`.
 *               It used to count every open row, including the ones the day
 *               presents at 11:45 and 15:00, and showed 5 beside a queue of 3.
 *
 *   AI Partner  the suggestions the dock marks as needing the person, through
 *               `getActiveSuggestions`, which applies the moment, snooze and
 *               validation filters the dock applies. It used to say
 *               "1 suggestion" whatever the number.
 *
 *   Updates     the updates the Updates panel raises, through `readUpdates`,
 *               after the notification budget. It used to count unread
 *               arrivals, a list nothing in the V3.3 shell displayed.
 *
 * Every query is wrapped. A header that throws takes the whole workday with
 * it, and the point of the exercise is a header that renders when other things
 * are broken. A count that cannot be read is zero, and zero is never shown as
 * a badge.
 */

import { isDatabaseReady } from "@/db/client";
import { DEFAULT_RUN_ID, type RoleId } from "@/db/schema/core";
import { getDecisions, getEntity, getRole, getUser } from "./workday";
import { getActiveSuggestions } from "./partner";
import { countNeedingYou } from "@/features/partner/rules";
import { getBrandIdentity } from "@/product";
import { PRODUCT_IDENTITY } from "@/product/release/identity";
import { getRoleRelease, type RoleReleaseStatus } from "@/product/release/role-release";
import { getResolvedDemoMode } from "@/server/config/runtime";
import { getScenarioState, type ScenarioState } from "@/scenario/engine/state";
import { readUpdates } from "@/features/updates/read";
import type { Language } from "@/i18n/labels";

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
  /** The updates the Updates panel raises. */
  updatesCount: number;
  /** The suggestions the AI Partner dock marks as needing the person. */
  suggestionsNeedingYou: number;
  /** The open decisions the Decisions page lists, for the rail badge. */
  decisionsOpen: number;
  aiState: "idle" | "working" | "ready" | "offline";
  userLabel: string | null;
  language: Language;
  /**
   * The role's release state. A Demo role's header shows the state and none
   * of the work controls, because nothing behind them can be opened.
   */
  releaseStatus: RoleReleaseStatus | null;
  /** True when the scenario is missing, so the header can still say so. */
  degraded: boolean;
}

/** The shape used when nothing at all can be resolved. */
export function fallbackHeaderModel(language: Language = "en"): WorkdayHeaderModel {
  return {
    productName: PRODUCT_IDENTITY.name,
    productMark: null,
    roleLabel: language === "de" ? "Arbeitstag" : "Workday",
    entityLabel: null,
    updatesCount: 0,
    suggestionsNeedingYou: 0,
    decisionsOpen: 0,
    aiState: "idle",
    userLabel: null,
    language,
    releaseStatus: null,
    degraded: true,
  };
}

/** The updates the panel raises for a role now. Zero when they cannot be read. */
function countUpdates(roleId: RoleId, state: ScenarioState): number {
  try {
    return readUpdates(roleId, state).raised.length;
  } catch {
    return 0;
  }
}

/**
 * Suggestions the dock marks as needing the person.
 *
 * The same rows the dock receives (`getActiveSuggestions`, default limit) and
 * the same rule it applies to them: revealable, not dismissed, and either
 * waiting for the user or requiring a decision.
 */
export function countSuggestionsNeedingYou(roleId: RoleId, atMoment: string, runId = DEFAULT_RUN_ID): number {
  try {
    // One rule for the header and the dock (`suggestionNeedsYou`), including the person's disposition.
    return countNeedingYou(getActiveSuggestions(roleId, atMoment, { runId }));
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
function resolveAiState(suggestions: number): WorkdayHeaderModel["aiState"] {
  try {
    if (getResolvedDemoMode().mode === "offline") return "offline";
  } catch {
    return "idle";
  }
  return suggestions > 0 ? "ready" : "idle";
}

/**
 * Open decisions for a role at a moment: exactly the rows the Decisions page
 * lists as open.
 *
 * Read through `getDecisions`, the function `buildDecisionQueueView` reads,
 * so the rail badge and the queue apply one visibility rule. The badge used to
 * count every open row in the table, including decisions the day presents
 * later, and the integration test `tests/integration/shell-header.test.ts`
 * now pins the two together at several moments.
 */
export function countOpenDecisions(roleId: RoleId, atMoment: string, runId = DEFAULT_RUN_ID): number {
  try {
    return getDecisions(roleId, atMoment, runId).filter((entry) => entry.decision.status === "open").length;
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
    const releaseStatus = getRoleRelease(roleParam)?.status ?? null;

    const role = getRole(roleParam as RoleId, runId);
    if (!role || !state) {
      return {
        ...fallbackHeaderModel(language),
        productName: brand.shortName,
        productMark: brand.marks[0]?.src ?? null,
        releaseStatus,
      };
    }

    const holder = getUser(role.holderUserId, runId);
    const entity = getEntity(role.entityId, runId);

    /*
     * A gated role counts nothing. Its routes show the release page, so a
     * badge would point at work that cannot be opened.
     */
    const gated = releaseStatus !== null && releaseStatus !== "available";
    const suggestions = gated ? 0 : countSuggestionsNeedingYou(role.id, state.currentMoment, runId);

    return {
      productName: brand.shortName,
      productMark: brand.marks[0]?.src ?? null,
      roleLabel: language === "de" ? role.titleDe : role.title,
      entityLabel: entity?.shortName ?? null,
      updatesCount: gated ? 0 : countUpdates(role.id, state),
      suggestionsNeedingYou: suggestions,
      decisionsOpen: gated ? 0 : countOpenDecisions(role.id, state.currentMoment, runId),
      aiState: gated ? "idle" : resolveAiState(suggestions),
      userLabel: holder?.name ?? null,
      language,
      releaseStatus,
      degraded: false,
    };
  } catch {
    return fallbackHeaderModel();
  }
}
