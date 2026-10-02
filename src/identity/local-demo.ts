/**
 * Identity provider for demonstration mode.
 *
 * Returns a seeded persona session from a signed cookie. No password, no
 * real credential -- persona selection is the only authentication step.
 * This provider must never be used in any environment where access control
 * matters; it exists solely to support recorded demonstrations and local
 * development.
 *
 * Session lifetime is 8 hours from issuance.
 */

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import type { IdentityProvider, ProductSession } from "./types";
import { signValue, verifyAndExtract } from "./session";
import { DEMO_SESSION_COOKIE } from "./cookies";

export { DEMO_SESSION_COOKIE };

/** Eight hours in milliseconds. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * The supported demonstration personas.
 *
 * Each persona maps to a fixed synthetic user. Display names, role IDs and
 * administrator flags are seeded values only -- no real people are referenced.
 */
const PERSONAS = {
  "rcsa-analyst": {
    userId: "DEMO-RCSA-001",
    displayName: "Thomas Zijlstra",
    email: "thomas.zijlstra@arcadia.demo",
    roleIds: ["rcsa"],
    isAdministrator: false,
  },
  "tprm-analyst": {
    userId: "DEMO-TPRM-001",
    displayName: "Anna Mueller",
    email: "anna.mueller@arcadia.demo",
    roleIds: ["tprm"],
    isAdministrator: false,
  },
  administrator: {
    userId: "DEMO-ADM-001",
    displayName: "Max Weber",
    email: "max.weber@arcadia.demo",
    roleIds: [],
    isAdministrator: true,
  },
} as const;

export type DemoPersonaId = keyof typeof PERSONAS;

export function isDemoPersonaId(value: unknown): value is DemoPersonaId {
  return typeof value === "string" && value in PERSONAS;
}

function buildSession(personaId: DemoPersonaId, mode: "demonstration" | "offline-evaluation"): ProductSession {
  const persona = PERSONAS[personaId];
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  return {
    sessionId: randomUUID(),
    userId: persona.userId,
    displayName: persona.displayName,
    email: persona.email,
    organisationId: "ORG-DEMO",
    legalEntityIds: ["LE-001"],
    roleIds: [...persona.roleIds],
    authorityScopes: [],
    isAdministrator: persona.isAdministrator,
    productMode: mode,
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

function isExpired(session: ProductSession): boolean {
  return new Date(session.expiresAt).getTime() < Date.now();
}

async function readSessionFromCookie(
  mode: "demonstration" | "offline-evaluation",
): Promise<ProductSession | null> {
  const jar = await cookies();
  const raw = jar.get(DEMO_SESSION_COOKIE)?.value;
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
  // Re-stamp the productMode from the current environment, not from the cookie.
  session.productMode = mode;
  return session;
}

export function makeLocalDemoProvider(
  mode: "demonstration" | "offline-evaluation",
): IdentityProvider {
  return {
    async getSession(): Promise<ProductSession | null> {
      return readSessionFromCookie(mode);
    },

    async signIn(input?: unknown): Promise<ProductSession> {
      const personaId: DemoPersonaId = isDemoPersonaId(input) ? input : "rcsa-analyst";
      const session = buildSession(personaId, mode);
      const jar = await cookies();
      jar.set(DEMO_SESSION_COOKIE, await signValue(JSON.stringify(session)), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: SESSION_TTL_MS / 1000,
      });
      return session;
    },

    async signOut(): Promise<void> {
      const jar = await cookies();
      jar.delete(DEMO_SESSION_COOKIE);
    },
  };
}

export const localDemoProvider: IdentityProvider = makeLocalDemoProvider("demonstration");
