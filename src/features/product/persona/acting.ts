/**
 * Who is acting in the Product Owner Console.
 *
 * Server only (reads the session cookie through `src/identity`). The acting
 * identity is the demonstration session (`src/identity/local-demo.ts`): a
 * product-owner persona chosen at the top of the console. There is no
 * identity provider in this build, so the console says "demonstration
 * persona" wherever it names who is acting, and never presents a persona as a
 * signed-in person.
 *
 * Scopes are resolved here, once, for every console check:
 *
 *   - a product-owner persona's scopes come from `PRODUCT_PERSONAS` in code,
 *     not from the cookie, so a changed permission map takes effect at once
 *     rather than when an eight hour cookie expires;
 *   - any other session (an analyst persona, a pilot account) holds only the
 *     console scopes its own `authorityScopes` carries, which today is none,
 *     so it reads the console and cannot act; Wave 5 gives a named identity
 *     its scopes here without changing a single check;
 *   - no session at all is "nobody", and every action is refused with the
 *     reason.
 */

import { getActiveProvider, getProductMode, isRoleSwitchingAllowed } from "@/identity";
import type { ProductMode, ProductSession } from "@/identity";
import {
  isConsoleScope,
  personaForUserId,
  type ConsoleScope,
  type ProductPersona,
} from "../permissions";

export type ActingSource = "demonstration-persona" | "account-without-persona" | "none";

export interface ActingConsoleIdentity {
  source: ActingSource;
  persona: ProductPersona | null;
  /** The session's user id: a persona's synthetic demonstration id, or an account id. */
  userId: string | null;
  /** The session's display name, for an account that is not a product persona. */
  displayName: string | null;
  /** Null when nobody is acting; an empty list when somebody is, without console authority. */
  scopes: readonly ConsoleScope[] | null;
  productMode: ProductMode;
  /** Whether the persona can be switched here: demonstration mode only. */
  switchingAllowed: boolean;
}

/** Resolves the acting identity from a session. Pure, so the rule can be tested. */
export function actingIdentityFromSession(session: ProductSession | null, productMode: ProductMode): ActingConsoleIdentity {
  const switchingAllowed = isRoleSwitchingAllowed(productMode);
  if (!session) {
    return { source: "none", persona: null, userId: null, displayName: null, scopes: null, productMode, switchingAllowed };
  }
  const persona = personaForUserId(session.userId);
  if (persona) {
    return {
      source: "demonstration-persona",
      persona,
      userId: session.userId,
      displayName: persona.label.en,
      scopes: persona.scopes,
      productMode,
      switchingAllowed,
    };
  }
  return {
    source: "account-without-persona",
    persona: null,
    userId: session.userId,
    displayName: session.displayName,
    scopes: session.authorityScopes.filter(isConsoleScope),
    productMode,
    switchingAllowed,
  };
}

/** The acting identity for this request. */
export async function readActingConsoleIdentity(): Promise<ActingConsoleIdentity> {
  const productMode = getProductMode();
  let session: ProductSession | null = null;
  try {
    session = await getActiveProvider().getSession();
  } catch {
    session = null;
  }
  return actingIdentityFromSession(session, productMode);
}

/** A readable label for the actor, as the audit trail and the history record it. */
export function actingLabel(identity: ActingConsoleIdentity): string {
  if (identity.persona) return `${identity.persona.label.en} (demonstration persona)`;
  if (identity.displayName) return identity.displayName;
  return "nobody";
}
