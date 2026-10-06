/**
 * The release import surface.
 *
 * Import from `@/product/release` rather than from the files behind it. The
 * role release definitions keep their own path as well, because the released
 * presentation appendix cites `src/product/release/role-release.ts` by name.
 *
 * Client safe: nothing exported here reads the database or the environment.
 */

export {
  INSTALLED_ROLE_APPS,
  KNOWN_LIMITATIONS,
  LIMITATION_STATUS_LABELS,
  PREVIEW_ROLE_APPS,
  PRODUCT_IDENTITY,
  PRODUCT_RELEASE,
  RELEASE_COMPONENTS,
  RELEASE_STAGE_LABELS,
  ROLE_APP_STATUS_LABELS,
  ROLE_RELEASE_STATUS_LABELS,
  ROLE_RELEASE_STATUS_ORDER,
  formatComponentVersion,
  getProductReleaseRegistry,
  getReleaseComponent,
  limitationsWithStatus,
  productReleaseLabel,
  rolesWithReleaseStatus,
} from "./product-release";
export type {
  Bilingual,
  KnownLimitation,
  LimitationArea,
  LimitationStatus,
  ProductIdentity,
  ProductRelease,
  ProductReleaseRegistry,
  ReleaseComponent,
  ReleaseComponentId,
  ReleaseStage,
  RoleAppReleaseEntry,
} from "./product-release";

export { ROLE_RELEASE_DEFINITIONS, getRoleRelease } from "./role-release";
export type { RoleReleaseDefinition, RoleReleaseStatus } from "./role-release";
