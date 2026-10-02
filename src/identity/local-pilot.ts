/**
 * Identity provider for design-partner (pilot) mode.
 *
 * Authenticates named pilot accounts defined in pilot-config.ts. Role IDs are
 * fixed at account creation and cannot be changed at runtime. Role switching
 * is prohibited in this mode.
 *
 * Session lifetime is 4 hours from issuance.
 */

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import type { IdentityProvider, ProductSession } from "./types";
import { signValue, verifyAndExtract } from "./session";
import { PILOT_USERS, type PilotUserId } from "./pilot-config";
import { PILOT_SESSION_COOKIE } from "./cookies";

export { PILOT_SESSION_COOKIE };

/** Four hours in milliseconds. */
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

function isPilotUserId(value: unknown): value is PilotUserId {
  return typeof value === "string" && PILOT_USERS.some((u) => u.userId === value);
}

function buildSession(userId: PilotUserId): ProductSession {
  const account = PILOT_USERS.find((u) => u.userId === userId);
  if (!account) throw new Error(`Unknown pilot user: ${userId}`);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  return {
    sessionId: randomUUID(),
    userId: account.userId,
    displayName: account.displayName,
    email: account.email,
    organisationId: "ORG-PILOT",
    legalEntityIds: ["LE-001"],
    roleIds: [...account.roleIds],
    authorityScopes: [],
    isAdministrator: account.isAdministrator,
    productMode: "design-partner",
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

function isExpired(session: ProductSession): boolean {
  return new Date(session.expiresAt).getTime() < Date.now();
}

async function readSessionFromCookie(): Promise<ProductSession | null> {
  const jar = await cookies();
  const raw = jar.get(PILOT_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const verified = await verifyAndExtract(raw);
  if (!verified) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(verified);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const session = parsed as ProductSession;
  if (isExpired(session)) return null;
  return session;
}

export const localPilotProvider: IdentityProvider = {
  async getSession(): Promise<ProductSession | null> {
    return readSessionFromCookie();
  },

  async signIn(input?: unknown): Promise<ProductSession> {
    if (!isPilotUserId(input)) {
      throw new Error(
        `Invalid pilot user ID. Expected one of: ${PILOT_USERS.map((u) => u.userId).join(", ")}`,
      );
    }
    const session = buildSession(input);
    const jar = await cookies();
    jar.set(PILOT_SESSION_COOKIE, await signValue(JSON.stringify(session)), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_MS / 1000,
    });
    return session;
  },

  async signOut(): Promise<void> {
    const jar = await cookies();
    jar.delete(PILOT_SESSION_COOKIE);
  },
};
