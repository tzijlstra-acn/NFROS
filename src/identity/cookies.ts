/**
 * Session cookie name constants.
 *
 * Kept in a separate module so the middleware can import them without
 * pulling in next/headers (which is not available in the Edge runtime).
 */

export const DEMO_SESSION_COOKIE = "nfr-demo-session";
export const PILOT_SESSION_COOKIE = "nfr-pilot-session";
