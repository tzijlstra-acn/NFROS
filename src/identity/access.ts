/**
 * Access control helpers.
 *
 * These are assertion functions that throw when the caller does not meet the
 * stated requirement. They are designed to be called at the top of a server
 * action or route handler so an unauthenticated or unauthorised request fails
 * immediately with a consistent error message.
 *
 * Throws are preferred over returning false so TypeScript narrows the type
 * after the call. requireSession is an asserts overload so the compiler knows
 * that session is non-null after it returns.
 */

import type { ProductSession } from "./types";

export function requireSession(session: ProductSession | null): asserts session is ProductSession {
  if (!session) throw new Error("Not authenticated");
}

/**
 * Asserts the session holds the given role.
 *
 * Administrators bypass role checks because they can act on behalf of any
 * role. If neither the role nor administrator status is present, the call
 * throws.
 */
export function requireRole(session: ProductSession, roleId: string): void {
  if (!session.roleIds.includes(roleId) && !session.isAdministrator) {
    throw new Error(`Unauthorized: role ${roleId} required`);
  }
}

export function requireAdministrator(session: ProductSession): void {
  if (!session.isAdministrator) throw new Error("Administrator access required");
}
