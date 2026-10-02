/**
 * Identity module entry point.
 *
 * getActiveProvider() selects the correct IdentityProvider based on the
 * PRODUCT_MODE environment variable. Callers that only need the current
 * session can call getSession() directly without caring which provider is
 * active.
 *
 * PRODUCT_MODE values:
 *   demonstration (default) -- persona-based, no password, role switching allowed
 *   design-partner          -- named pilot accounts, roles fixed, 4-hour sessions
 *   offline-evaluation      -- same provider as demonstration, productMode field differs
 */

import type { IdentityProvider, ProductSession } from "./types";
import { getProductMode } from "./product-mode";
import { makeLocalDemoProvider, localDemoProvider } from "./local-demo";
import { localPilotProvider } from "./local-pilot";

export type { ProductMode, ProductSession, IdentityProvider } from "./types";
export { getProductMode, isRoleSwitchingAllowed, isResetAllowed } from "./product-mode";
export { requireSession, requireRole, requireAdministrator } from "./access";
export { isDemoPersonaId } from "./local-demo";
export { PILOT_USERS } from "./pilot-config";

export function getActiveProvider(): IdentityProvider {
  const mode = getProductMode();
  switch (mode) {
    case "design-partner":
      return localPilotProvider;
    case "offline-evaluation":
      return makeLocalDemoProvider("offline-evaluation");
    case "demonstration":
    default:
      return localDemoProvider;
  }
}

export async function getSession(): Promise<ProductSession | null> {
  return getActiveProvider().getSession();
}
