/**
 * The status import surface.
 *
 * The vocabulary, its pure mappings and the badge. Client safe.
 *
 * The functions that compute a status from the database, the runtime AI
 * configuration or the recorded evaluation run are server only and are
 * imported from `@/product/status/sources` directly, so that a client
 * component importing the badge cannot pull a database driver into the
 * browser bundle by accident.
 */

export {
  PRODUCT_STATUS,
  PRODUCT_STATUSES,
  isProductStatus,
  overallStatus,
  reading,
  statusForAiMode,
  statusForAuditChain,
  statusForConnectorMode,
  statusForHealth,
  statusLabel,
  statusMeaning,
} from "./vocabulary";
export type {
  ProductStatus,
  ProductStatusDefinition,
  StatusReading,
  StatusTone,
} from "./vocabulary";
export { StatusBadge } from "./StatusBadge";
