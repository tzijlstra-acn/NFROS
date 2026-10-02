/**
 * Shell data assembly.
 *
 * Every workday route needs the same chrome: who is acting, in which entity,
 * at which moment, under which branding, with which counts on the navigation,
 * and with a searchable index for the command palette. Assembling that in each
 * route would guarantee the routes drifted apart, so this module is the single
 * assembler, in the same spirit as `buildIntelligenceRail` being the single
 * mapper for the context drawer.
 *
 * It is a server module. Nothing here reaches the browser except the narrow
 * view models it returns, and none of those carry a credential, an endpoint or
 * anything about a key.
 */

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type AutonomyLevel, type RoleId } from "@/db/schema/core";
import { decisions } from "@/db/schema/decisions";
import { inboxMessages } from "@/db/schema/work";
import {
  activeProductConfig,
  brandProfiles,
  organisationProfiles,
} from "@/db/schema/product";
import {
  aiSuggestions,
  livePlayerState,
  workdayLiveEventReads,
  workdayLiveEvents,
} from "@/db/schema/live";
import { getRoleMoments, requireScenarioState } from "@/scenario/engine/state";
import { momentToMinutes } from "@/domain/nfr/calculators";
import {
  getControls,
  getEntity,
  getIncidents,
  getObligations,
  getRisks,
  getRole,
  getRoles,
  getServices,
  getSuppliers,
  getUser,
} from "./workday";
import type { RoleOption } from "@/components/workday-v2/TopBarV2";
import { getBrandIdentity, type BrandIdentity } from "@/product";
import type { NavCounts } from "@/components/workday-v2/NavigationRail";
import type { CommandIndexEntry, CommandRole } from "@/components/command/CommandPalette";
import type {
  WorkdayContext,
  WorkdayLiveEvent,
  WorkdaySelection,
} from "@/workday/contracts";

const db = () => getDb();

/* ==========================================================================
   Branding
   ========================================================================== */

/*
 * Delegated, not reimplemented.
 *
 * There was briefly a second resolver here, written while the product layer
 * was still being built so the shell could render. It read the same three
 * tables and reached the same answer, which is exactly the problem: two
 * resolvers agree until one of them is corrected. `getBrandIdentity` is the
 * single place the branding mode is interpreted, and it returns an object the
 * top bar consumes without branching on the mode at all.
 */

/* ==========================================================================
   Navigation counts
   ========================================================================== */

/**
 * The badges on the navigation rail.
 *
 * Each one counts something real at the current moment. A count that was
 * merely plausible would be worse than no count, because the rail is the one
 * place a user glances at to decide where to go next.
 *
 * The live event and suggestion queries are guarded: those tables are
 * populated by the live day projection and the AI preparation layer, and the
 * shell has to render correctly before either has run.
 */
export function getNavCounts(
  roleId: RoleId,
  atMoment: string,
  runId = DEFAULT_RUN_ID,
): NavCounts {
  const minutes = momentToMinutes(atMoment);

  const openDecisions = db()
    .select({ n: sql<number>`count(*)` })
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.roleId, roleId), eq(decisions.status, "open")))
    .get();

  const mail = db()
    .select({ n: sql<number>`count(*)` })
    .from(inboxMessages)
    .where(and(eq(inboxMessages.runId, runId), eq(inboxMessages.roleId, roleId)))
    .get();

  let unread = 0;
  let needsUser = 0;

  try {
    /*
     * An event counts as unread when it has arrived on the scenario clock and
     * has no read row for this role. The left join is the whole query: read
     * state is per role, so the same 14:05 event can be unread for the third
     * party lead and read for the resilience lead at the same instant.
     */
    const unreadRows = db()
      .select({ id: workdayLiveEvents.id, atMoment: workdayLiveEvents.atMoment, roleIds: workdayLiveEvents.roleIds })
      .from(workdayLiveEvents)
      .leftJoin(
        workdayLiveEventReads,
        and(
          eq(workdayLiveEventReads.eventId, workdayLiveEvents.id),
          eq(workdayLiveEventReads.roleId, roleId),
        ),
      )
      .where(
        and(
          eq(workdayLiveEvents.runId, runId),
          or(isNull(workdayLiveEventReads.readAt), isNull(workdayLiveEventReads.id)),
        ),
      )
      .all();

    unread = unreadRows.filter((row) => {
      if (momentToMinutes(row.atMoment) > minutes) return false;
      const roleIds = row.roleIds ?? [];
      return roleIds.length === 0 || roleIds.includes(roleId);
    }).length;
  } catch {
    unread = 0;
  }

  try {
    const needs = db()
      .select({ n: sql<number>`count(*)` })
      .from(aiSuggestions)
      .where(
        and(
          eq(aiSuggestions.runId, runId),
          eq(aiSuggestions.roleId, roleId),
          inArray(aiSuggestions.status, ["needs-user", "ready"]),
          isNull(aiSuggestions.dismissedAt),
        ),
      )
      .get();
    needsUser = needs?.n ?? 0;
  } catch {
    needsUser = 0;
  }

  return {
    decisions: openDecisions?.n ?? 0,
    mail: mail?.n ?? 0,
    unread,
    needsUser,
  };
}

/* ==========================================================================
   Role options
   ========================================================================== */

export function getRoleOptions(runId = DEFAULT_RUN_ID): RoleOption[] {
  return getRoles(runId).map((role) => {
    const holder = getUser(role.holderUserId, runId);
    const entity = getEntity(role.entityId, runId);
    return {
      id: role.id,
      title: role.title,
      titleDe: role.titleDe,
      holderName: holder?.name ?? role.holderUserId,
      entityShortName: entity?.shortName ?? role.entityId,
    };
  });
}

export function getCommandRoles(runId = DEFAULT_RUN_ID): CommandRole[] {
  return getRoles(runId).map((role) => ({
    id: role.id,
    title: role.title,
    titleDe: role.titleDe,
  }));
}

/* ==========================================================================
   The command palette index
   ========================================================================== */

/**
 * The searchable object index.
 *
 * Built on the server and passed to the palette as a flat list, so searching
 * is instant and the database stays out of the browser. It is capped per kind:
 * a palette that ships four thousand rows to the client to support a search
 * that will match three of them is a performance problem disguised as a
 * feature.
 *
 * Every entry routes into the workbench with a selection parameter rather than
 * to a dedicated object page, because the workbench is where an object is
 * actually worked on and a separate read only page would be a dead end.
 */
export function buildCommandIndex(roleId: RoleId, runId = DEFAULT_RUN_ID): CommandIndexEntry[] {
  const workbench = `/workday/${roleId}/workbench`;
  const perKindCap = 60;

  const entries: CommandIndexEntry[] = [];

  for (const risk of getRisks(runId).slice(0, perKindCap)) {
    entries.push({
      id: risk.id,
      kind: "risk",
      label: risk.title,
      reference: risk.id,
      href: `${workbench}?select=risk:${risk.id}`,
    });
  }

  for (const control of getControls(runId).slice(0, perKindCap)) {
    entries.push({
      id: control.id,
      kind: "control",
      label: control.title,
      reference: control.reference,
      href: `${workbench}?select=control:${control.id}`,
    });
  }

  for (const supplier of getSuppliers(runId).slice(0, perKindCap)) {
    entries.push({
      id: supplier.id,
      kind: "supplier",
      label: supplier.name,
      reference: supplier.id,
      href: `${workbench}?select=supplier:${supplier.id}`,
    });
  }

  for (const service of getServices(runId).slice(0, perKindCap)) {
    entries.push({
      id: service.id,
      kind: "service",
      label: service.name,
      reference: service.id,
      href: `${workbench}?select=service:${service.id}`,
    });
  }

  for (const incident of getIncidents(runId).slice(0, perKindCap)) {
    entries.push({
      id: incident.id,
      kind: "incident",
      label: incident.title,
      reference: incident.reference,
      href: `${workbench}?select=incident:${incident.id}`,
    });
  }

  for (const obligation of getObligations(undefined, runId).slice(0, perKindCap)) {
    entries.push({
      id: obligation.id,
      kind: "obligation",
      label: obligation.extractedSummary,
      reference: obligation.paragraphReference,
      href: `${workbench}?select=obligation:${obligation.id}`,
    });
  }

  /*
   * Decisions route to the decisions list with a fragment, not to the
   * workbench, because a decision is not inspected in a work object view; it
   * is taken in the decision flow where the rationale, the options and the
   * approval live.
   */
  const decisionRows = db()
    .select()
    .from(decisions)
    .where(eq(decisions.runId, runId))
    .orderBy(desc(decisions.priorityRank))
    .limit(perKindCap)
    .all();

  for (const decision of decisionRows) {
    entries.push({
      id: decision.id,
      kind: "decision",
      label: decision.title,
      reference: decision.reference,
      href: `/workday/${decision.roleId}/decisions#${decision.id}`,
    });
  }

  return entries;
}

/* ==========================================================================
   The whole chrome, in one call
   ========================================================================== */

export interface ShellChromeData {
  brand: BrandIdentity;
  roleOptions: RoleOption[];
  commandRoles: CommandRole[];
  commandIndex: CommandIndexEntry[];
  navCounts: NavCounts;
  roleTitle: string;
  holderName: string;
  entityName: string;
  entityShortName: string;
  entityCountry: string;
  autonomyLevel: AutonomyLevel;
}

export function buildShellChrome(
  roleId: RoleId,
  options: { atMoment: string; language: "en" | "de"; autonomyLevel: AutonomyLevel; runId?: string },
): ShellChromeData {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const role = getRole(roleId, runId);
  const holder = role ? getUser(role.holderUserId, runId) : undefined;
  const entity = role ? getEntity(role.entityId, runId) : undefined;

  return {
    brand: getBrandIdentity(),
    roleOptions: getRoleOptions(runId),
    commandRoles: getCommandRoles(runId),
    commandIndex: buildCommandIndex(roleId, runId),
    navCounts: getNavCounts(roleId, options.atMoment, runId),
    roleTitle: role ? (options.language === "de" ? role.titleDe : role.title) : roleId,
    holderName: holder?.name ?? role?.holderUserId ?? "",
    entityName: entity?.shortName ?? role?.entityId ?? "",
    entityShortName: entity?.shortName ?? role?.entityId ?? "",
    entityCountry: entity?.jurisdiction ?? "",
    autonomyLevel: options.autonomyLevel,
  };
}

/* ==========================================================================
   The partner's view of the current work
   ========================================================================== */

/**
 * Assembles the context the AI Partner and the chat reason about.
 *
 * Every field is read on the server. The browser never asserts the autonomy
 * level, the acting user or the scenario clock, which is the same rule the
 * agent route already enforces and for the same reason: a client that claimed
 * a higher autonomy level must change nothing at all.
 *
 * The regulator context is carried per entity rather than globally. DORA and
 * the EBA guidance reach the German and Austrian entities; the Swiss entity is
 * supervised by FINMA and is not in scope for DORA. Flattening that into one
 * list for the group would produce exactly the misstatement this product is
 * required to avoid.
 */
export function buildWorkdayContext(
  roleId: RoleId,
  options: {
    language: "en" | "de";
    demoMode: "live" | "safe" | "offline";
    selection?: WorkdaySelection | null;
    activeSuggestionId?: string | null;
    runId?: string;
  },
): WorkdayContext {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const state = requireScenarioState(runId);
  const role = getRole(roleId, runId);
  const holder = role ? getUser(role.holderUserId, runId) : undefined;
  const entity = role ? getEntity(role.entityId, runId) : undefined;

  const openDecisionIds = db()
    .select({ id: decisions.id })
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.roleId, roleId), eq(decisions.status, "open")))
    .all()
    .map((row) => row.id);

  const recentDecisionIds = db()
    .select({ id: decisions.id })
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.roleId, roleId), eq(decisions.status, "decided")))
    .orderBy(desc(decisions.decidedAtMoment))
    .limit(6)
    .all()
    .map((row) => row.id);

  const roleMoment = getRoleMoments(roleId, runId).find(
    (entry) => entry.event.moment === state.currentMoment,
  )?.roleMoment;

  let unreadEventIds: string[] = [];
  try {
    unreadEventIds = db()
      .select({ id: workdayLiveEvents.id, atMoment: workdayLiveEvents.atMoment, roleIds: workdayLiveEvents.roleIds })
      .from(workdayLiveEvents)
      .leftJoin(
        workdayLiveEventReads,
        and(
          eq(workdayLiveEventReads.eventId, workdayLiveEvents.id),
          eq(workdayLiveEventReads.roleId, roleId),
        ),
      )
      .where(
        and(
          eq(workdayLiveEvents.runId, runId),
          or(isNull(workdayLiveEventReads.readAt), isNull(workdayLiveEventReads.id)),
        ),
      )
      .all()
      .filter((row) => {
        if (momentToMinutes(row.atMoment) > momentToMinutes(state.currentMoment)) return false;
        const roleIds = row.roleIds ?? [];
        return roleIds.length === 0 || roleIds.includes(roleId);
      })
      .map((row) => row.id);
  } catch {
    unreadEventIds = [];
  }

  return {
    runId,
    roleId,
    roleTitle: role ? (options.language === "de" ? role.titleDe : role.title) : roleId,
    holderName: holder?.name ?? role?.holderUserId ?? "",
    entityId: role?.entityId ?? "",
    entityName: entity?.name ?? role?.entityId ?? "",
    entityCountry: entity?.jurisdiction ?? "",
    regulatorContext: entity ? [entity.regulatoryBloc, entity.supervisoryContext].filter((value) => value.length > 0) : [],
    currentMoment: state.currentMoment,
    viewedMoment: getViewedMomentForContext(runId, state.currentMoment),
    autonomyLevel: state.autonomyLevel,
    language: options.language,
    demoMode: options.demoMode,
    worldView: state.worldView,
    selection: options.selection ?? null,
    openDecisionIds,
    unreadEventIds,
    evidenceIds: roleMoment?.evidenceIds ?? [],
    recentDecisionIds,
    activeSuggestionId: options.activeSuggestionId ?? null,
  };
}

/** Local read of viewed time, so this module does not depend on the player. */
function getViewedMomentForContext(runId: string, liveMoment: string): string {
  try {
    const row = db()
      .select({ viewedMoment: livePlayerState.viewedMoment })
      .from(livePlayerState)
      .where(eq(livePlayerState.runId, runId))
      .get();
    return row?.viewedMoment ?? liveMoment;
  } catch {
    return liveMoment;
  }
}

/* ==========================================================================
   Live events for a role
   ========================================================================== */

/**
 * The role's arrived live events, oldest first, with read state resolved.
 *
 * The shell needs these in three places: the live day track, the role
 * workspace change highlighting, and the partner context. Reading them once
 * here means those three cannot disagree about what has arrived, which they
 * would if each queried with its own filter.
 *
 * An event with an empty `roleIds` array is visible to every role. That is how
 * the 14:05 shared supplier and payments event reaches all six functions from
 * one row rather than six copies.
 */
export function getRoleLiveEvents(
  roleId: RoleId,
  atMoment: string,
  options: { limit?: number; runId?: string } = {},
): WorkdayLiveEvent[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const minutes = momentToMinutes(atMoment);

  try {
    const rows = db()
      .select({
        event: workdayLiveEvents,
        readAt: workdayLiveEventReads.readAt,
        acknowledgedAt: workdayLiveEventReads.acknowledgedAt,
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

    return rows
      .filter((row) => {
        if (momentToMinutes(row.event.atMoment) > minutes) return false;
        const roleIds = row.event.roleIds ?? [];
        return roleIds.length === 0 || roleIds.includes(roleId);
      })
      .sort(
        (a, b) =>
          momentToMinutes(a.event.atMoment) - momentToMinutes(b.event.atMoment) ||
          a.event.sortOrder - b.event.sortOrder,
      )
      .slice(-(options.limit ?? 80))
      .map((row) => ({
        id: row.event.id,
        atMoment: row.event.atMoment,
        sortOrder: row.event.sortOrder,
        type: row.event.type,
        roleIds: row.event.roleIds ?? [],
        severity: row.event.severity,
        title: row.event.title,
        summary: row.event.summary,
        objectType: row.event.objectType,
        objectId: row.event.objectId,
        evidenceIds: row.event.evidenceIds ?? [],
        requiresDecision: row.event.requiresDecision,
        autoPause: row.event.autoPause,
        decisionId: row.event.decisionId,
        derivedFrom: row.event.derivedFrom,
        sourceConnectorIds: row.event.sourceConnectorIds ?? [],
        createdAt: row.event.createdAt,
        readAt: row.readAt ?? null,
        acknowledgedAt: row.acknowledgedAt ?? null,
      }));
  } catch {
    return [];
  }
}
