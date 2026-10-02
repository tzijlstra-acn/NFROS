/**
 * Active organisation profile resolution.
 *
 * This module answers one question for the rest of the product: which
 * institution is this deployment configured for, which legal entities does it
 * cover, and what regulatory context may be referenced for each of them.
 *
 * It also owns the read of the `active_product_config` singleton, because every
 * other resolver under `src/product` needs that pointer and only one module
 * should know how to find it. The brand, terminology, entitlement and
 * deployment resolvers all import from here, and nothing here imports from
 * them, so the dependency graph stays a tree.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { DEFAULT_RUN_ID, legalEntities } from "@/db/schema/core";
import { activeProductConfig, organisationProfiles } from "@/db/schema/product";

/** The singleton row identifier. There is exactly one active configuration. */
export const ACTIVE_PRODUCT_CONFIG_ID = "active";

type OrganisationProfileRow = typeof organisationProfiles.$inferSelect;
type LegalEntityRow = typeof legalEntities.$inferSelect;

/* ==========================================================================
   Types
   ========================================================================== */

/** One legal entity as the product is configured to see it. */
export interface ResolvedLegalEntity {
  id: string;
  name: string;
  shortName: string;
  country: string;
  currency: string;
  /**
   * "eu" or "ch". Carried through because the jurisdiction rule is decided by
   * the bloc and not by the entity name, and a screen that has to explain why
   * an entity shows what it shows needs the reason as well as the result.
   */
  regulatoryBloc: string;
  regulatorContext: string[];
}

export interface OrganisationProfile {
  id: string;
  name: string;
  shortName: string;
  countries: string[];
  legalEntities: ResolvedLegalEntity[];
  defaultLocale: string;
  supportedLocales: string[];
  timezone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  terminologyProfileId: string;
  brandProfileId: string;
  entitlementProfileId: string;
  deploymentProfileId: string;
  workingDayStart: string;
  workingDayEnd: string;
}

export interface ActiveConfigPointer {
  organisationProfileId: string;
  brandProfileIdOverride: string | null;
  updatedAt: string;
  updatedBy: string;
}

/* ==========================================================================
   Regulatory context
   ========================================================================== */

/**
 * Regulatory context, derived from the regulatory bloc rather than stored per
 * entity.
 *
 * The failure mode this prevents is specific. A hand maintained per entity list
 * of regulatory references drifts: somebody adds a reference for the EU
 * entities, copies the whole array onto the Swiss entity because it looks like
 * the same list, and the interface now states that the EU digital operational
 * resilience regulation applies to a Swiss bank. That is wrong, and it is wrong
 * in the one place a supervisor would look. Deriving from
 * `legal_entities.regulatory_bloc` makes the error unreachable: there is no
 * Swiss row that could carry an EU reference, because no entity row carries
 * references at all.
 */
const REGULATOR_CONTEXT_BY_BLOC: Record<string, readonly string[]> = {
  eu: [
    "DORA, Regulation (EU) 2022/2554 on digital operational resilience",
    "EBA Guidelines on outsourcing arrangements, EBA/GL/2019/02",
    "EBA Guidelines on ICT and security risk management, EBA/GL/2019/04",
  ],
  ch: [
    "FINMA Circular 2023/1 on operational risks and resilience for banks",
    "FINMA Circular 2018/3 on outsourcing for banks and insurers",
  ],
};

/**
 * References that may only ever appear against an EU entity.
 *
 * Defence in depth behind the derivation above. If somebody later edits the map
 * and files an EU reference under another bloc, this filter drops it rather
 * than rendering it. A list that is silently one item short is a recoverable
 * mistake; telling a Swiss entity that DORA applies to it is not.
 */
const EU_ONLY_MARKERS = ["DORA", "EBA", "Regulation (EU)"];

export function regulatorContextForBloc(bloc: string): string[] {
  const base = REGULATOR_CONTEXT_BY_BLOC[bloc] ?? [];
  if (bloc === "eu") return [...base];
  return base.filter((reference) => !EU_ONLY_MARKERS.some((marker) => reference.includes(marker)));
}

/* ==========================================================================
   Validation
   ========================================================================== */

/**
 * Schema for a resolved profile.
 *
 * Validation runs against the resolved object rather than the database row,
 * because the properties that matter are relational: a profile naming four
 * legal entity identifiers that resolves to two has a broken reference, and no
 * amount of column level validation would have caught it.
 */
export const resolvedLegalEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  country: z.string().min(1),
  currency: z.string().length(3),
  regulatoryBloc: z.string().min(1),
  regulatorContext: z.array(z.string().min(1)),
});

export const organisationProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  countries: z.array(z.string().min(1)).min(1),
  legalEntities: z.array(resolvedLegalEntitySchema).min(1),
  defaultLocale: z.string().min(2),
  supportedLocales: z.array(z.string().min(2)).min(1),
  timezone: z.string().min(3),
  dateFormat: z.string().min(3),
  timeFormat: z.enum(["12h", "24h"]),
  terminologyProfileId: z.string().min(1),
  brandProfileId: z.string().min(1),
  entitlementProfileId: z.string().min(1),
  deploymentProfileId: z.string().min(1),
  workingDayStart: z.string().regex(/^\d{2}:\d{2}$/),
  workingDayEnd: z.string().regex(/^\d{2}:\d{2}$/),
});

/** True when the default locale is one the profile claims to support. */
export function localeIsSupported(profile: OrganisationProfile): boolean {
  return profile.supportedLocales.includes(profile.defaultLocale);
}

/* ==========================================================================
   Pure resolution
   ========================================================================== */

/**
 * Builds the resolved profile from its rows.
 *
 * Pure, so the validation rules above can be exercised without a database.
 * Entity order follows `legalEntityIds` rather than the order the query
 * returned, because the settings screen lists entities in the order the
 * configuration declares them and that order is editorial.
 */
export function buildOrganisationProfile(
  row: OrganisationProfileRow,
  entities: readonly LegalEntityRow[],
): OrganisationProfile {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const resolved: ResolvedLegalEntity[] = [];

  for (const entityId of row.legalEntityIds) {
    const entity = byId.get(entityId);
    /*
     * A dangling identifier is skipped rather than rendered as a blank row.
     * The organisation screen compares the configured count against the
     * resolved count and states the difference, which is more useful than an
     * empty row that a reader would read as a loading state.
     */
    if (!entity) continue;
    resolved.push({
      id: entity.id,
      name: entity.name,
      shortName: entity.shortName,
      country: entity.jurisdiction,
      currency: entity.currency,
      regulatoryBloc: entity.regulatoryBloc,
      regulatorContext: regulatorContextForBloc(entity.regulatoryBloc),
    });
  }

  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    countries: [...row.countries],
    legalEntities: resolved,
    defaultLocale: row.defaultLocale,
    supportedLocales: [...row.supportedLocales],
    timezone: row.timezone,
    dateFormat: row.dateFormat,
    timeFormat: row.timeFormat,
    terminologyProfileId: row.terminologyProfileId,
    brandProfileId: row.brandProfileId,
    entitlementProfileId: row.entitlementProfileId,
    deploymentProfileId: row.deploymentProfileId,
    workingDayStart: row.workingDayStart,
    workingDayEnd: row.workingDayEnd,
  };
}

/** How many declared entity references failed to resolve. */
export function unresolvedEntityCount(
  row: Pick<OrganisationProfileRow, "legalEntityIds">,
  profile: OrganisationProfile,
): number {
  return Math.max(0, row.legalEntityIds.length - profile.legalEntities.length);
}

/**
 * The profile used before the product tables are seeded.
 *
 * Returning this instead of throwing keeps the administrator shell renderable
 * on a fresh clone. An exception raised from a layout would take out every
 * settings route including the one that explains that nothing is seeded yet.
 */
export const FALLBACK_ORGANISATION_PROFILE: OrganisationProfile = {
  id: "org-unconfigured",
  name: "Not configured",
  shortName: "Not configured",
  countries: [],
  legalEntities: [],
  defaultLocale: "en-GB",
  supportedLocales: ["en-GB"],
  timezone: "Europe/Berlin",
  dateFormat: "DD.MM.YYYY",
  timeFormat: "24h",
  terminologyProfileId: "terminology-dach-default",
  brandProfileId: "brand-unconfigured",
  entitlementProfileId: "entitlement-unconfigured",
  deploymentProfileId: "deployment-restricted-local",
  workingDayStart: "07:00",
  workingDayEnd: "19:00",
};

/* ==========================================================================
   Database reads and the configuration version cache
   ========================================================================== */

/**
 * Reads the active pointer on every call, deliberately.
 *
 * This is the invalidation mechanism for every other cache under
 * `src/product`: the pointer row carries `updatedAt`, the caches are keyed on
 * it, and an administrator action bumps it. Caching the pointer as well would
 * mean a branding switch did not take effect until the process restarted,
 * which is precisely the failure the configuration-not-fork claim cannot
 * afford. The read is a primary key lookup against a single row table, so
 * doing it per render costs nothing next to the scenario queries beside it.
 */
export function getActiveConfigPointer(): ActiveConfigPointer | null {
  try {
    const row = getDb()
      .select()
      .from(activeProductConfig)
      .where(eq(activeProductConfig.id, ACTIVE_PRODUCT_CONFIG_ID))
      .get();
    if (!row) return null;
    return {
      organisationProfileId: row.organisationProfileId,
      brandProfileIdOverride: row.brandProfileIdOverride,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  } catch {
    /*
     * The database may be absent or unmigrated. The settings area has to stay
     * reachable in that state, because it is where an operator finds out what
     * is missing.
     */
    return null;
  }
}

/** A cache slot owned by one resolver module. */
export interface ConfigCacheSlot<T> {
  current: { version: string; value: T } | null;
}

/** Every slot handed out, so an administrator write can clear all of them. */
const registeredSlots: ConfigCacheSlot<unknown>[] = [];

export function createConfigCacheSlot<T>(): ConfigCacheSlot<T> {
  const slot: ConfigCacheSlot<T> = { current: null };
  registeredSlots.push(slot as ConfigCacheSlot<unknown>);
  return slot;
}

/**
 * The version key the caches compare against.
 *
 * It includes the organisation pointer and the brand override as well as the
 * timestamp, so a switch that only repoints the brand still invalidates even
 * if two writes land inside the same millisecond.
 */
export function productConfigVersion(pointer: ActiveConfigPointer | null): string {
  if (!pointer) return "unconfigured";
  return [
    pointer.organisationProfileId,
    pointer.brandProfileIdOverride ?? "",
    pointer.updatedAt,
  ].join("|");
}

/** Resolves through a module owned cache, rebuilding when the version moves. */
export function readThroughConfigCache<T>(
  slot: ConfigCacheSlot<T>,
  build: (pointer: ActiveConfigPointer | null) => T,
): T {
  const pointer = getActiveConfigPointer();
  const version = productConfigVersion(pointer);
  const current = slot.current;
  if (current !== null && current.version === version) return current.value;
  const value = build(pointer);
  slot.current = { version, value };
  return value;
}

/**
 * Clears every registered cache slot.
 *
 * The version key already covers the normal case. This exists for the server
 * action path, where the write and the next render happen in one process and
 * an operator should never have to wonder whether they are looking at a stale
 * object after changing the configuration themselves.
 */
export function resetProductConfigCaches(): void {
  for (const slot of registeredSlots) slot.current = null;
}

const organisationSlot = createConfigCacheSlot<OrganisationProfile | null>();

/** Reads the configured organisation profile, or null when none is active. */
export function resolveOrganisationProfile(): OrganisationProfile | null {
  return readThroughConfigCache(organisationSlot, (pointer) => {
    if (!pointer) return null;
    try {
      const db = getDb();
      const row = db
        .select()
        .from(organisationProfiles)
        .where(eq(organisationProfiles.id, pointer.organisationProfileId))
        .get();
      if (!row) return null;
      const entities = db
        .select()
        .from(legalEntities)
        .where(eq(legalEntities.runId, DEFAULT_RUN_ID))
        .all();
      return buildOrganisationProfile(row, entities);
    } catch {
      return null;
    }
  });
}

/** Lists every organisation profile. Used by the settings index. */
export function listOrganisationProfiles(): OrganisationProfile[] {
  try {
    const db = getDb();
    const rows = db.select().from(organisationProfiles).all();
    const entities = db
      .select()
      .from(legalEntities)
      .where(eq(legalEntities.runId, DEFAULT_RUN_ID))
      .all();
    return rows.map((row) => buildOrganisationProfile(row, entities));
  } catch {
    return [];
  }
}
