/**
 * The release gate for workday routes.
 *
 * The release registry says which roles are Available, Demo or Planned
 * (`src/product/release/role-release.ts`). Until this module existed, only the
 * role Home read it: a Planned role served full Work, Processes and Decisions
 * pages, and `?ui=v2` served the whole earlier shell for every role. A release
 * state that one route honours and three ignore is not a release state.
 *
 * The rule, stated once and applied in two places:
 *
 *   Available  every route opens as normal.
 *   Demo       every route shows the role's honest demo page inside the
 *              frame, in the current interface, whatever `?ui=` asks for.
 *              Nothing in it can be opened or changed.
 *   Planned    no route can be entered. The request is redirected to the role
 *              selector, which says why.
 *
 * `middleware.ts` applies it before any route renders, so the redirect and the
 * interface choice are made once per request for every workday path. The page
 * dispatcher (`src/workday/dispatch.tsx`) applies it again while rendering, so
 * a page reached without the middleware (a test, a changed matcher) still
 * cannot render a gated role's work. Both read this module, so they cannot
 * disagree.
 *
 * Pure and dependency light on purpose: the middleware runs on the edge
 * runtime, and the only thing this imports is the registry's leaf module.
 */

import { getRoleRelease, type RoleReleaseDefinition } from "@/product/release/role-release";

/** The query parameter the role selector reads to explain a refused role. */
export const UNAVAILABLE_ROLE_PARAM = "unavailable";

export type RoleGate =
  | { kind: "open" }
  | { kind: "demo"; release: RoleReleaseDefinition }
  | { kind: "planned"; release: RoleReleaseDefinition };

/**
 * The gate for one role.
 *
 * An identifier the registry does not know is `open` here, because it is not
 * this module's job to decide that a role exists: the workday layout answers an
 * unknown role with a 404. A `hidden` role is treated as Planned, the stricter
 * of the two closed states, so a role nobody may see cannot be entered either.
 */
export function gateForRole(roleId: string): RoleGate {
  const release = getRoleRelease(roleId);
  if (!release) return { kind: "open" };
  if (release.status === "planned" || release.status === "hidden") return { kind: "planned", release };
  if (release.status === "demo") return { kind: "demo", release };
  return { kind: "open" };
}

/** The role segment of a workday path, or null when the path is not a role route. */
export function roleFromWorkdayPath(pathname: string): string | null {
  const parts = pathname.split("/").filter((part) => part.length > 0);
  if (parts[0] !== "workday") return null;
  return parts[1] ?? null;
}

/** The gate for a request path. Paths outside `/workday/<role>` are always open. */
export function gateForPath(pathname: string): RoleGate {
  const roleId = roleFromWorkdayPath(pathname);
  return roleId === null ? { kind: "open" } : gateForRole(roleId);
}

/** Where a refused Planned role is sent: the role selector, told which role it was. */
export function plannedRoleRedirectHref(roleId: string): string {
  return `/workday?${UNAVAILABLE_ROLE_PARAM}=${encodeURIComponent(roleId)}`;
}

/**
 * The refused role named in the role selector's query, if it is one the gate
 * would refuse.
 *
 * Checked against the registry rather than echoed, so the selector can never
 * be made to print an arbitrary string or to call an Available role
 * unavailable.
 */
export function refusedRoleFromQuery(value: string | string[] | undefined): RoleReleaseDefinition | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const gate = gateForRole(raw);
  return gate.kind === "planned" ? gate.release : null;
}
