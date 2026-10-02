/**
 * The product configuration import surface.
 *
 * One call, `getProductConfig()`, returns every resolved profile the shell and
 * the settings screens need. It is synchronous and it is cached per process
 * against the `active_product_config` version, because the shell calls it on
 * every render and a configuration read that cost a query per surface would
 * show up as latency on a screen that changes once a quarter.
 *
 * It never throws. An unseeded or unmigrated database resolves to the
 * documented fallbacks with `configured: false`, so the administrator area
 * stays reachable in exactly the state where somebody needs to read it.
 */

import { getDb } from "@/db/client";
import { productConfigChanges } from "@/db/schema/product";
import {
  FALLBACK_ORGANISATION_PROFILE,
  createConfigCacheSlot,
  readThroughConfigCache,
  resolveOrganisationProfile,
  type OrganisationProfile,
} from "./organisation/profile";
import {
  FALLBACK_BRAND_PROFILE,
  resolveActiveBrandProfile,
  resolveBrandIdentity,
  type BrandIdentity,
  type BrandProfile,
} from "./branding/brand";
import { resolveTerminologyProfile, type TerminologyProfile } from "./terminology/terms";
import {
  resolveEntitlements,
  resolveFunctionPacks,
  type FunctionPackView,
  type ProductEntitlements,
} from "./entitlements/entitlements";
import { resolveDeploymentProfile, type DeploymentProfileView } from "./deployment/deployment";

export interface ResolvedProductConfig {
  /**
   * False when no active configuration row was found. Screens use this to say
   * that the product tables are not seeded instead of presenting fallbacks as
   * though they were somebody's configuration.
   */
  configured: boolean;
  organisation: OrganisationProfile;
  brand: BrandProfile;
  /** What a shell surface renders. See `resolveBrandIdentity`. */
  identity: BrandIdentity;
  terminology: TerminologyProfile;
  entitlements: ProductEntitlements;
  deployment: DeploymentProfileView;
  functionPacks: FunctionPackView[];
  updatedAt: string | null;
  updatedBy: string | null;
}

const configSlot = createConfigCacheSlot<ResolvedProductConfig>();

/** The resolved product configuration. Cheap, synchronous, never throws. */
export function getProductConfig(): ResolvedProductConfig {
  return readThroughConfigCache(configSlot, (pointer) => {
    const organisation = resolveOrganisationProfile();
    const brand = resolveActiveBrandProfile();
    const configured = pointer !== null && organisation !== null;

    const resolvedOrganisation = organisation ?? FALLBACK_ORGANISATION_PROFILE;
    const resolvedBrand = brand ?? FALLBACK_BRAND_PROFILE;

    return {
      configured,
      organisation: resolvedOrganisation,
      brand: resolvedBrand,
      identity: resolveBrandIdentity(resolvedBrand),
      terminology: resolveTerminologyProfile(),
      entitlements: resolveEntitlements(),
      deployment: resolveDeploymentProfile(),
      functionPacks: resolveFunctionPacks(),
      updatedAt: pointer?.updatedAt ?? null,
      updatedBy: pointer?.updatedBy ?? null,
    };
  });
}

/**
 * The identity alone.
 *
 * A convenience for the shell top bar, which needs nothing else and should not
 * have to destructure a seven field object to render a name and a mark.
 */
export function getBrandIdentity(): BrandIdentity {
  return getProductConfig().identity;
}

/** One entry in the product configuration change log. */
export interface ProductConfigChangeEntry {
  id: string;
  at: string;
  area: string;
  summary: string;
  changedBy: string;
}

/**
 * The product configuration change log, newest first.
 *
 * Separate from the domain audit trail, and read here rather than from
 * `actions.ts`, because every export of a "use server" module becomes a
 * callable endpoint and a read has no business being one.
 */
export function listProductConfigChanges(limit = 12): ProductConfigChangeEntry[] {
  try {
    return getDb()
      .select({
        id: productConfigChanges.id,
        at: productConfigChanges.at,
        area: productConfigChanges.area,
        summary: productConfigChanges.summary,
        changedBy: productConfigChanges.changedBy,
      })
      .from(productConfigChanges)
      .all()
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/* ==========================================================================
   Re-exports
   ========================================================================== */

export {
  ACTIVE_PRODUCT_CONFIG_ID,
  FALLBACK_ORGANISATION_PROFILE,
  buildOrganisationProfile,
  getActiveConfigPointer,
  listOrganisationProfiles,
  localeIsSupported,
  organisationProfileSchema,
  regulatorContextForBloc,
  resetProductConfigCaches,
  resolveOrganisationProfile,
  resolvedLegalEntitySchema,
  unresolvedEntityCount,
} from "./organisation/profile";
export type {
  ActiveConfigPointer,
  OrganisationProfile,
  ResolvedLegalEntity,
} from "./organisation/profile";

export {
  BRAND_MODE_EXPLANATION,
  BRAND_MODE_LABELS,
  FALLBACK_BRAND_PROFILE,
  isBrandMode,
  listBrandProfiles,
  resolveActiveBrandProfile,
  resolveBrandIdentity,
  resolveBrandProfile,
} from "./branding/brand";
export type { BrandIdentity, BrandMark, BrandProfile } from "./branding/brand";

export {
  ALTERNATE_TERMINOLOGY_OVERRIDES,
  ALTERNATE_TERMINOLOGY_PROFILE_ID,
  DEFAULT_TERMINOLOGY_PROFILE_ID,
  DEFAULT_TERMINOLOGY_TERMS,
  FALLBACK_TERMINOLOGY_PROFILE,
  listTerminologyProfiles,
  mergeTerms,
  overriddenKeys,
  resolveTerminologyProfile,
  term,
  termFrom,
} from "./terminology/terms";
export type { TerminologyProfile, TermOptions } from "./terminology/terms";

export {
  ADMIN_FEATURE_IDS,
  AI_FEATURE_IDS,
  FALLBACK_ENTITLEMENTS,
  SETTINGS_AREAS,
  buildEntitlements,
  buildFunctionPackView,
  hasAdminFeature,
  hasAiFeature,
  hasConnectorPack,
  hasFunctionPack,
  isConnectorPackId,
  isFunctionPackId,
  listEntitlementProfiles,
  resolveEntitlements,
  resolveFunctionPacks,
  rolesFromEntitlements,
} from "./entitlements/entitlements";
export type {
  AdminArea,
  AdminFeatureId,
  AiFeatureId,
  FunctionPackView,
  ProductEntitlements,
} from "./entitlements/entitlements";

export {
  DEPLOYMENT_KIND_LABELS,
  FALLBACK_DEPLOYMENT_PROFILE,
  buildDeploymentProfile,
  deploymentHonesty,
  listDeploymentProfiles,
  resolveDeploymentProfile,
} from "./deployment/deployment";
export type { DeploymentHonesty, DeploymentProfileView } from "./deployment/deployment";
