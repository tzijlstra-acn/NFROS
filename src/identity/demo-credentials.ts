/**
 * The demonstration sign-in: one named account, checked on the server.
 *
 * NFR Workspace opens on a sign-in screen so that the product is entered the
 * way an enterprise workspace is entered. In demonstration mode there is one
 * account, `Admin` with the password `Admin`, configurable through
 * `NFR_DEMO_USERNAME` and `NFR_DEMO_PASSWORD`. It is an experience gate, not a
 * security boundary: the values are documented, the session secret has a
 * development fallback, and the sign-in screen says the environment is a
 * synthetic demonstration. Enterprise identity replaces this module behind
 * the same `IdentityProvider` interface (docs/NFR_WORKSPACE_V3_PLAN.md, D2).
 *
 * Server only. The comparison hashes both sides first so that it runs in
 * constant time whatever the input length, which costs nothing and keeps the
 * habit right for the module that replaces this one.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/** The persona a successful demonstration sign-in opens. */
export const WORKSPACE_ADMIN_PERSONA = "workspace-admin" as const;

const DEFAULT_USERNAME = "Admin";
const DEFAULT_PASSWORD = "Admin";

/**
 * Whether the workspace asks for a sign-in at all.
 *
 * On unless `NFR_DEMO_AUTH=off`, which isolated test stacks and scripted
 * captures set. Read on every call rather than at import, so a test can
 * change it.
 */
export function demoAuthEnabled(): boolean {
  return (process.env["NFR_DEMO_AUTH"] ?? "on").toLowerCase() !== "off";
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function same(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export type CredentialCheck =
  | { ok: true; displayName: string }
  | { ok: false; reason: "missing" | "invalid" };

/**
 * Checks a username and password against the demonstration account.
 *
 * The username is matched without regard to case, as directory sign-ins
 * usually are; the password is matched exactly. Both are always compared, so
 * a wrong username and a wrong password take the same path.
 */
export function checkDemoCredentials(username: unknown, password: unknown): CredentialCheck {
  const user = typeof username === "string" ? username.trim() : "";
  const pass = typeof password === "string" ? password : "";
  if (user.length === 0 || pass.length === 0) return { ok: false, reason: "missing" };

  const expectedUser = process.env["NFR_DEMO_USERNAME"] ?? DEFAULT_USERNAME;
  const expectedPass = process.env["NFR_DEMO_PASSWORD"] ?? DEFAULT_PASSWORD;

  const userMatches = same(user.toLowerCase(), expectedUser.toLowerCase());
  const passMatches = same(pass, expectedPass);
  return userMatches && passMatches ? { ok: true, displayName: expectedUser } : { ok: false, reason: "invalid" };
}
