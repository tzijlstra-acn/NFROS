/**
 * AI Partner read model.
 *
 * The partner dock is server rendered from these queries and then kept current
 * by the event channel. That split matters: the first paint must show the real
 * state of the day without waiting for a client fetch, because the dock is the
 * thing that tells the user what happened while they were away, and a dock
 * that arrives empty and fills in a second later has already failed at that.
 *
 * Every function here is read only and degrades to an empty result rather than
 * throwing. The suggestion and activity tables are populated by the preparation
 * layer, and the shell has to render correctly before it has run, for example
 * immediately after a migration on a fresh clone.
 */

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, type AutonomyLevel, type RoleId } from "@/db/schema/core";
import { aiActivityEntries, aiSuggestions, chatThreads } from "@/db/schema/live";
import { connectorInstances, externalReferences, sourceRequirements } from "@/db/schema/integration";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type {
  AIActivityEntryView,
  AIPartnerState,
  AISuggestionView,
  SourceAttribution,
} from "@/workday/contracts";
import type { Language } from "@/i18n/labels";

const db = () => getDb();

/* ==========================================================================
   Suggestions
   ========================================================================== */

/**
 * Suggestions visible to a role at a moment.
 *
 * Ordered by priority then recency, because the dock shows a small number and
 * the one it shows first should be the one that matters most, not the one that
 * happened to arrive last. Dismissed and snoozed suggestions are excluded;
 * a snoozed item returns when the clock passes its moment, which is why the
 * comparison is against the scenario clock rather than a wall clock.
 */
export function getActiveSuggestions(
  roleId: RoleId,
  atMoment: string,
  options: { language?: Language; limit?: number; runId?: string } = {},
): AISuggestionView[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const minutes = momentToMinutes(atMoment);

  let rows: Array<typeof aiSuggestions.$inferSelect>;
  try {
    rows = db()
      .select()
      .from(aiSuggestions)
      .where(and(eq(aiSuggestions.runId, runId), eq(aiSuggestions.roleId, roleId), isNull(aiSuggestions.dismissedAt)))
      .orderBy(desc(aiSuggestions.createdAt))
      .all();
  } catch {
    return [];
  }

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  return rows
    .filter((row) => momentToMinutes(row.atMoment) <= minutes)
    .filter((row) => {
      if (!row.snoozedUntilMoment) return true;
      return momentToMinutes(row.snoozedUntilMoment) <= minutes;
    })
    /*
     * A suggestion is only readable once validation has stamped it. The
     * column is the record of that, and filtering on it here means an
     * unvalidated row cannot reach the interface even if something upstream
     * wrote one, which is the structural form of the rule that a final
     * recommendation is shown only after structured validation succeeds.
     */
    .filter((row) => row.validatedAt !== null)
    .sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, options.limit ?? 8)
    .map((row) => toSuggestionView(row, runId));
}

function toSuggestionView(
  row: typeof aiSuggestions.$inferSelect,
  runId: string,
): AISuggestionView {
  return {
    id: row.id,
    roleId: row.roleId,
    eventId: row.eventId,
    objectType: row.objectType,
    objectId: row.objectId,
    atMoment: row.atMoment,
    status: row.status,
    priority: row.priority,
    authorityClass: row.authorityClass,
    decisionId: row.decisionId,
    source: row.source,
    constrained: row.constrained,
    missingRequiredSources: row.missingRequiredSources ?? [],
    sources: getSourceAttributions(row.objectType, row.objectId, runId),
    createdAt: row.createdAt,

    headline: row.headline,
    changeSummary: row.changeSummary,
    whyItMatters: row.whyItMatters,
    checksCompleted: row.checksCompleted ?? [],
    actionsCompleted: row.actionsCompleted ?? [],
    recommendedAction: row.recommendedAction,
    alternatives: row.alternatives ?? [],
    evidenceIds: row.evidenceIds ?? [],
    confidence: row.confidence,
    uncertainty: row.uncertainty ?? [],
    decisionRequired: row.decisionRequired,
  };
}

/* ==========================================================================
   Activity
   ========================================================================== */

export function getActivityEntries(
  roleId: RoleId,
  atMoment: string,
  options: { limit?: number; runId?: string } = {},
): AIActivityEntryView[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const minutes = momentToMinutes(atMoment);

  let rows: Array<typeof aiActivityEntries.$inferSelect>;
  try {
    rows = db()
      .select()
      .from(aiActivityEntries)
      .where(and(eq(aiActivityEntries.runId, runId), eq(aiActivityEntries.roleId, roleId)))
      .orderBy(asc(aiActivityEntries.sequence))
      .all();
  } catch {
    return [];
  }

  const connectorNames = connectorNameMap(runId);

  return rows
    .filter((row) => momentToMinutes(row.atMoment) <= minutes)
    .slice(-(options.limit ?? 60))
    .reverse()
    .map((row) => ({
      id: row.id,
      atMoment: row.atMoment,
      sequence: row.sequence,
      kind: row.kind,
      label: row.label,
      detail: row.detail,
      objectType: row.objectType,
      objectId: row.objectId,
      toolName: row.toolName,
      durationMs: row.durationMs,
      outcome: row.outcome,
      authorityClass: row.authorityClass,
      auditEventId: row.auditEventId,
      evidenceIds: row.evidenceIds ?? [],
      connectorLabel: row.connectorInstanceId
        ? (connectorNames.get(row.connectorInstanceId) ?? null)
        : null,
    }));
}

/* ==========================================================================
   Source attribution
   ========================================================================== */

function connectorNameMap(runId: string): Map<string, string> {
  try {
    return new Map(
      db()
        .select({ id: connectorInstances.id, label: connectorInstances.sourceSystem })
        .from(connectorInstances)
        .all()
        .map((row) => [row.id, row.label]),
    );
  } catch {
    return new Map();
  }
}

/**
 * Which systems a canonical object was read from, with freshness.
 *
 * This is the data behind the quiet source row under a work object. It carries
 * the system label, how fresh it is, whether two sources disagree, how
 * necessary it is, and a deep link where the connector supports one.
 *
 * It carries nothing secret, and it could not: the connector table stores a
 * credential STATE and an endpoint LABEL, never a value and never a URL with a
 * token in it. There is no path from this function to key material.
 */
export function getSourceAttributions(
  canonicalType: string,
  canonicalId: string,
  runId = DEFAULT_RUN_ID,
): SourceAttribution[] {
  try {
    const references = db()
      .select()
      .from(externalReferences)
      .where(
        and(
          eq(externalReferences.runId, runId),
          eq(externalReferences.canonicalType, canonicalType),
          eq(externalReferences.canonicalId, canonicalId),
        ),
      )
      .all();

    if (references.length === 0) return [];

    const instances = new Map(
      db().select().from(connectorInstances).all().map((row) => [row.id, row]),
    );

    const necessities = new Map(
      db()
        .select()
        .from(sourceRequirements)
        .where(
          and(
            eq(sourceRequirements.runId, runId),
            eq(sourceRequirements.contextType, canonicalType),
            eq(sourceRequirements.contextId, canonicalId),
          ),
        )
        .all()
        .map((row) => [row.connectorInstanceId, row.necessity]),
    );

    /* One row per connector, with the record count folded in. */
    const grouped = new Map<string, { count: number; conflicted: boolean; latest: string | null; freshness: string }>();
    for (const reference of references) {
      const existing = grouped.get(reference.connectorInstanceId);
      const latest = reference.sourceUpdatedAt ?? reference.syncedAt;
      if (existing) {
        existing.count += 1;
        existing.conflicted = existing.conflicted || reference.conflicted;
        if (latest && (!existing.latest || latest > existing.latest)) existing.latest = latest;
        // The worst freshness in the group wins, because a view is only as
        // current as its stalest input.
        if (reference.freshnessStatus === "stale" || existing.freshness === "stale") {
          existing.freshness = "stale";
        }
      } else {
        grouped.set(reference.connectorInstanceId, {
          count: 1,
          conflicted: reference.conflicted,
          latest,
          freshness: reference.freshnessStatus,
        });
      }
    }

    const result: SourceAttribution[] = [];
    for (const [instanceId, group] of grouped) {
      const instance = instances.get(instanceId);
      if (!instance) continue;

      const firstReference = references.find((r) => r.connectorInstanceId === instanceId);
      const deepLink =
        instance.deepLinkTemplate && firstReference
          ? instance.deepLinkTemplate.replace("{externalId}", firstReference.externalId)
          : null;

      result.push({
        connectorInstanceId: instanceId,
        sourceSystem: instance.sourceSystem,
        mode: instance.mode,
        freshness: group.freshness as SourceAttribution["freshness"],
        lastUpdated: group.latest,
        recordCount: group.count,
        conflicted: group.conflicted,
        necessity: (necessities.get(instanceId) ?? "helpful") as SourceAttribution["necessity"],
        deepLink,
        loadState:
          instance.healthState === "unavailable"
            ? "error"
            : group.freshness === "stale"
              ? "stale"
              : "ready",
      });
    }

    // Required sources first: they are the ones that gate a recommendation.
    const order = { required: 0, helpful: 1, optional: 2 };
    return result.sort((a, b) => order[a.necessity] - order[b.necessity]);
  } catch {
    return [];
  }
}

/* ==========================================================================
   Partner state
   ========================================================================== */

/**
 * The state shown in the partner header.
 *
 * Derived from what the application has actually got, in a fixed order of
 * precedence. The resting state is `monitoring` and it is the honest answer
 * most of the time: a dock that advertises activity it is not performing would
 * undermine the one thing the activity stream is for.
 */
export function derivePartnerState(input: {
  demoMode: "live" | "safe" | "offline";
  suggestions: AISuggestionView[];
  hasRunningGeneration: boolean;
  hasQueuedExternalCommand: boolean;
}): AIPartnerState {
  if (input.demoMode === "offline") return "offline";
  if (input.hasQueuedExternalCommand) return "executing";
  if (input.hasRunningGeneration) return "preparing";
  if (input.suggestions.some((s) => s.status === "needs-user" || s.decisionRequired)) {
    return "needs-you";
  }
  if (input.suggestions.some((s) => s.status === "ready")) return "ready";
  if (input.suggestions.some((s) => s.status === "checking")) return "checking-evidence";
  if (input.suggestions.length > 0 && input.suggestions.every((s) => s.status === "completed")) {
    return "completed";
  }
  return "monitoring";
}

/** Counts suggestions by whether they are waiting for the user. */
export function countNeedsUser(roleId: RoleId, runId = DEFAULT_RUN_ID): number {
  try {
    const row = db()
      .select({ n: sql<number>`count(*)` })
      .from(aiSuggestions)
      .where(
        and(
          eq(aiSuggestions.runId, runId),
          eq(aiSuggestions.roleId, roleId),
          inArray(aiSuggestions.status, ["needs-user"]),
          isNull(aiSuggestions.dismissedAt),
        ),
      )
      .get();
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** The autonomy label shown in the partner header, with the withheld count. */
export function partnerAutonomySummary(
  autonomyLevel: AutonomyLevel,
  withheldCount: number,
  language: Language,
): string {
  if (withheldCount === 0) {
    return language === "de" ? "Alle Werkzeuge verfuegbar" : "Every tool available";
  }
  return language === "de"
    ? `${withheldCount} Aktionen zurueckgehalten`
    : `${withheldCount} actions withheld`;
}

/* ==========================================================================
   Chat thread continuity
   ========================================================================== */

/**
 * The role's most recent open chat thread, or null.
 *
 * Read only, and deliberately so: it must not create a thread. Rendering the
 * dock is not the user starting a conversation, and a getter that inserted a
 * row would leave an empty thread behind every time anyone opened any workday
 * route.
 *
 * This exists because navigating between work objects replaces the page
 * subtree, so the dock is remounted and its in memory transcript is lost. The
 * turns are durable; without the thread identifier there was nothing to
 * restore them from, and a conversation disappeared the moment the user opened
 * the object it was about.
 */
export function getOpenChatThreadId(roleId: RoleId, runId = DEFAULT_RUN_ID): string | null {
  try {
    const row = db()
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(
        and(eq(chatThreads.runId, runId), eq(chatThreads.roleId, roleId), isNull(chatThreads.closedAt)),
      )
      .orderBy(desc(chatThreads.lastActiveAtMoment), desc(chatThreads.createdAt))
      .limit(1)
      .get();
    return row?.id ?? null;
  } catch {
    return null;
  }
}
