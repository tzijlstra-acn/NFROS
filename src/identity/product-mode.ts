/**
 * Product mode helpers.
 *
 * Reads PRODUCT_MODE from the environment and exposes behaviour rules that
 * depend on it. These are pure functions with no side effects; they can be
 * called from any server context.
 */

import type { ProductMode } from "./types";

export function getProductMode(): ProductMode {
  const env = process.env["PRODUCT_MODE"];
  if (env === "design-partner") return "design-partner";
  if (env === "offline-evaluation") return "offline-evaluation";
  return "demonstration";
}

/**
 * Role switching is only permitted in demonstration mode.
 *
 * In design-partner mode the assigned roles are fixed at account creation and
 * cannot be changed without a configuration update. In offline-evaluation the
 * same restriction applies because the session is typically unattended.
 */
export function isRoleSwitchingAllowed(mode: ProductMode): boolean {
  return mode === "demonstration";
}

/**
 * Scenario reset is always allowed in demonstration mode.
 *
 * In design-partner and offline-evaluation modes only an administrator may
 * trigger a reset, so that a participant cannot erase another participant's
 * work during a shared session.
 */
export function isResetAllowed(mode: ProductMode, isAdministrator: boolean): boolean {
  if (mode === "demonstration") return true;
  return isAdministrator;
}
