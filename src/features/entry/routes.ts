/**
 * Where the NFR Workspace entry leads, and which routes it guards.
 *
 * Edge safe: no imports beyond types, so `middleware.ts` can use it. The
 * sign-in route, the startup screen and the server actions all read the same
 * lists, so the guard and the redirect target cannot disagree.
 */

import type { RoleId } from "@/db/schema/core";

/**
 * The role a sign-in opens. The Third-Party Risk Manager carries the
 * payment service review that the demonstration starts with.
 */
export const DEFAULT_WORKSPACE_ROLE: RoleId = "tprm";

export const DEFAULT_WORKSPACE_HREF = `/workday/${DEFAULT_WORKSPACE_ROLE}`;

/** The sign-in screen. `/` plays the startup sequence first; this route does not. */
export const SIGN_IN_PATH = "/login";

/**
 * Page routes that need a session. Everything that shows the synthetic
 * institution's work or its administration. The recorded presentation under
 * `/story` is not here: it is a deck, not the workspace.
 */
export const PROTECTED_PAGE_PREFIXES: readonly string[] = [
  "/workday",
  "/settings",
  "/product",
  "/ops",
  "/control-room",
  "/trust",
  "/value",
  "/roadmap",
  "/setup",
];

/**
 * API routes that need a session. Health checks, the deck downloads and the
 * inbound integration webhook stay open: a monitor, a link in a deck and a
 * connector have no browser session.
 */
export const PROTECTED_API_PREFIXES: readonly string[] = [
  "/api/workday",
  "/api/agent",
  "/api/realtime",
  "/api/insights",
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((prefix) => matches(pathname, prefix));
}

export function isProtectedApi(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some((prefix) => matches(pathname, prefix));
}

/**
 * The page a sign-in returns to.
 *
 * Only a same-origin path to a protected page is accepted. Anything else, an
 * absolute URL, a protocol-relative `//host`, a backslash trick or an
 * unknown route, falls back to the default workspace, so the parameter can
 * never send a person somewhere else.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return DEFAULT_WORKSPACE_HREF;
  const value = next.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return DEFAULT_WORKSPACE_HREF;
  const pathname = value.split(/[?#]/)[0] ?? "";
  if (!isProtectedPage(pathname)) return DEFAULT_WORKSPACE_HREF;
  return value;
}
