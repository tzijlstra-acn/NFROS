/**
 * Entitlement resolution and the function pack catalogue.
 *
 * Entitlements decide what a deployment contains. They are not a sales
 * surface: nothing in this module or in any screen that consumes it tells an
 * end user what they could buy. A pack that is not granted is simply absent,
 * and the only place the difference between granted and defined is visible is
 * the administrator settings area.
 *
 * The check functions take the entitlement object explicitly rather than
 * reading the active configuration themselves. That is deliberate. A gate that
 * silently reaches for global state is a gate nobody can test with a denying
 * profile, and an entitlement model that is never tested denying anything is
 * decoration.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  FUNCTION_PACK_IDS,
  entitlementProfiles,
  functionPacks,
  type FunctionPackId,
} from "@/db/schema/product";
import { CONNECTOR_PACK_IDS, type ConnectorPackId } from "@/db/schema/integration";
import type { RoleId } from "@/db/schema/core";
import {
  createConfigCacheSlot,
  readThroughConfigCache,
  resolveOrganisationProfile,
} from "../organisation/profile";

type EntitlementProfileRow = typeof entitlementProfiles.$inferSelect;
type FunctionPackRow = typeof functionPacks.$inferSelect;

/* ==========================================================================
   Feature identifiers
   ========================================================================== */

/**
 * AI capabilities that can be licensed independently.
 *
 * These name capabilities, never models. A deployment that has not licensed
 * `autonomous-execution` has no path to a policy bound autonomous action no
 * matter what its autonomy level says, which is the entitlement layer and the
 * authority layer agreeing rather than competing.
 */
export const AI_FEATURE_IDS = [
  "ai-partner-chat",
  "suggestion-generation",
  "evidence-retrieval",
  "meeting-preparation",
  "end-of-day-summary",
  "autonomous-execution",
] as const;
export type AiFeatureId = (typeof AI_FEATURE_IDS)[number];

/** Administrator capabilities, each one a settings area or an audit surface. */
export const ADMIN_FEATURE_IDS = [
  "organisation-settings",
  "branding",
  "terminology",
  "integration-settings",
  "mapping-studio",
  "authority-settings",
  "deployment-settings",
  "product-config-audit",
] as const;
export type AdminFeatureId = (typeof ADMIN_FEATURE_IDS)[number];

/**
 * The administrator settings areas.
 *
 * This lives with the entitlement model rather than with the settings
 * components for two reasons. It is the same concept as `ADMIN_FEATURE_IDS` at
 * a different granularity, so the two belong where they can be read together.
 * And it has to be importable from a server component: a navigation list
 * exported from a "use client" module arrives in a server component as a
 * client reference rather than as an array, and the first thing that happens
 * is a call to `.map` on something that is not an array.
 */
export interface AdminArea {
  href: string;
  /** A key the navigation resolves to an icon. Not a component: see above. */
  icon:
    | "organisation"
    | "branding"
    | "integrations"
    | "mappings"
    | "role-packs"
    | "authority"
    | "deployment";
  label: { en: string; de: string };
  /**
   * The capability that governs the area, or null for the role packs screen.
   * Reading what a deployment contains is not an optional capability: an
   * administrator who can reach the settings area can always see which packs
   * are in force, because the alternative is a settings area that hides its
   * own scope.
   */
  adminFeature: AdminFeatureId | null;
}

export const SETTINGS_AREAS: readonly AdminArea[] = [
  {
    href: "/settings/organisation",
    icon: "organisation",
    label: { en: "Organisation", de: "Organisation" },
    adminFeature: "organisation-settings",
  },
  {
    href: "/settings/branding",
    icon: "branding",
    label: { en: "Branding", de: "Marke" },
    adminFeature: "branding",
  },
  {
    href: "/settings/integrations",
    icon: "integrations",
    label: { en: "Integrations", de: "Integrationen" },
    adminFeature: "integration-settings",
  },
  {
    href: "/settings/mappings",
    icon: "mappings",
    label: { en: "Mappings", de: "Zuordnungen" },
    adminFeature: "mapping-studio",
  },
  {
    href: "/settings/role-packs",
    icon: "role-packs",
    label: { en: "Role packs", de: "Rollenpakete" },
    adminFeature: null,
  },
  {
    href: "/settings/authority",
    icon: "authority",
    label: { en: "Authority", de: "Befugnisse" },
    adminFeature: "authority-settings",
  },
  {
    href: "/settings/deployment",
    icon: "deployment",
    label: { en: "Deployment", de: "Betrieb" },
    adminFeature: "deployment-settings",
  },
];

/* ==========================================================================
   Types
   ========================================================================== */

export interface ProductEntitlements {
  id: string;
  name: string;
  functionPacks: string[];
  connectorPacks: string[];
  aiFeatures: string[];
  adminFeatures: string[];
  deploymentProfile: string;
}

/** A function pack as the role packs screen shows it. */
export interface FunctionPackView {
  id: string;
  name: string;
  nameDe: string;
  version: string;
  description: string;
  primaryRoleId: string;
  domainObjects: string[];
  roles: string[];
  tools: string[];
  screens: string[];
  evaluations: string[];
  connectorDependencies: string[];
  /** The pack's own switch. A pack can be defined, granted and still off. */
  enabled: boolean;
  /** True when the active entitlement profile includes this pack. */
  granted: boolean;
  /**
   * Connector packs this pack depends on that the entitlement profile does not
   * grant. A pack can be licensed and still degraded, and saying so is the
   * difference between an honest settings screen and a feature list.
   */
  missingConnectorPacks: string[];
}

/* ==========================================================================
   Checks
   ========================================================================== */

export function hasFunctionPack(entitlements: ProductEntitlements, packId: string): boolean {
  return entitlements.functionPacks.includes(packId);
}

export function hasConnectorPack(entitlements: ProductEntitlements, packId: string): boolean {
  return entitlements.connectorPacks.includes(packId);
}

export function hasAiFeature(entitlements: ProductEntitlements, featureId: string): boolean {
  return entitlements.aiFeatures.includes(featureId);
}

export function hasAdminFeature(entitlements: ProductEntitlements, featureId: string): boolean {
  return entitlements.adminFeatures.includes(featureId);
}

/**
 * Whether a workday role is reachable at all.
 *
 * Derived from the packs rather than stored separately, because a role whose
 * pack is not licensed has no screens, no tools and no evaluations, and
 * granting the role on its own would produce an empty workspace that looks
 * like a bug.
 */
export function rolesFromEntitlements(
  entitlements: ProductEntitlements,
  packs: readonly FunctionPackView[],
): RoleId[] {
  const roles = new Set<string>();
  for (const pack of packs) {
    if (!pack.granted || !pack.enabled) continue;
    for (const role of pack.roles) roles.add(role);
  }
  return [...roles] as RoleId[];
}

export function isFunctionPackId(value: unknown): value is FunctionPackId {
  return typeof value === "string" && (FUNCTION_PACK_IDS as readonly string[]).includes(value);
}

export function isConnectorPackId(value: unknown): value is ConnectorPackId {
  return typeof value === "string" && (CONNECTOR_PACK_IDS as readonly string[]).includes(value);
}

/* ==========================================================================
   Pure resolution
   ========================================================================== */

export function buildEntitlements(row: EntitlementProfileRow): ProductEntitlements {
  return {
    id: row.id,
    name: row.name,
    functionPacks: [...row.functionPacks],
    connectorPacks: [...row.connectorPacks],
    aiFeatures: [...row.aiFeatures],
    adminFeatures: [...row.adminFeatures],
    deploymentProfile: row.deploymentProfile,
  };
}

export function buildFunctionPackView(
  row: FunctionPackRow,
  entitlements: ProductEntitlements,
): FunctionPackView {
  return {
    id: row.id,
    name: row.name,
    nameDe: row.nameDe,
    version: row.version,
    description: row.description,
    primaryRoleId: row.primaryRoleId,
    domainObjects: [...row.domainObjects],
    roles: [...row.roles],
    tools: [...row.tools],
    screens: [...row.screens],
    evaluations: [...row.evaluations],
    connectorDependencies: [...row.connectorDependencies],
    enabled: row.enabled,
    granted: hasFunctionPack(entitlements, row.id),
    missingConnectorPacks: row.connectorDependencies.filter(
      (dependency) => !hasConnectorPack(entitlements, dependency),
    ),
  };
}

/**
 * The entitlements used before the product tables are seeded.
 *
 * It grants everything this build actually contains. An empty set would be the
 * stricter choice and the wrong one: on a fresh clone it would hide the product
 * from itself, and an operator would read a blank workday as a broken
 * application rather than as an unlicensed one. The honest state for "no
 * entitlement profile is configured" is "this build, as built".
 */
export const FALLBACK_ENTITLEMENTS: ProductEntitlements = {
  id: "entitlement-unconfigured",
  name: "Unconfigured build",
  functionPacks: [...FUNCTION_PACK_IDS],
  connectorPacks: [...CONNECTOR_PACK_IDS],
  aiFeatures: [...AI_FEATURE_IDS],
  adminFeatures: [...ADMIN_FEATURE_IDS],
  deploymentProfile: "deployment-restricted-local",
};

/* ==========================================================================
   Database reads
   ========================================================================== */

const entitlementSlot = createConfigCacheSlot<ProductEntitlements>();

export function resolveEntitlements(): ProductEntitlements {
  return readThroughConfigCache(entitlementSlot, () => {
    const organisation = resolveOrganisationProfile();
    if (!organisation) return FALLBACK_ENTITLEMENTS;
    try {
      const row = getDb()
        .select()
        .from(entitlementProfiles)
        .where(eq(entitlementProfiles.id, organisation.entitlementProfileId))
        .get();
      return row ? buildEntitlements(row) : FALLBACK_ENTITLEMENTS;
    } catch {
      return FALLBACK_ENTITLEMENTS;
    }
  });
}

/** Every defined entitlement profile, for the role packs screen. */
export function listEntitlementProfiles(): ProductEntitlements[] {
  try {
    return getDb()
      .select()
      .from(entitlementProfiles)
      .all()
      .map(buildEntitlements)
      .sort((a, b) => b.functionPacks.length - a.functionPacks.length || a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

const packSlot = createConfigCacheSlot<FunctionPackView[]>();

/**
 * The function pack catalogue, resolved against the active entitlements.
 *
 * Every defined pack is returned, granted or not. The screen needs both: the
 * administrator question is which packs this deployment has, and that question
 * cannot be answered by a list that omits the ones it does not.
 */
export function resolveFunctionPacks(): FunctionPackView[] {
  return readThroughConfigCache(packSlot, () => {
    const entitlements = resolveEntitlements();
    try {
      const order = new Map(FUNCTION_PACK_IDS.map((id, index) => [id as string, index]));
      return getDb()
        .select()
        .from(functionPacks)
        .all()
        .map((row) => buildFunctionPackView(row, entitlements))
        .sort(
          (a, b) =>
            (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );
    } catch {
      return [];
    }
  });
}
