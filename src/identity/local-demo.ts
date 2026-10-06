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
import { PRODUCT_PERSONAS, isProductPersonaId, type ProductPersonaId } from "@/features/product/permissions";

export { DEMO_SESSION_COOKIE };

/** Eight hours in milliseconds. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * The supported demonstration personas.
 *
 * Each persona maps to a fixed synthetic user. The two analyst personas carry
 * the names of the seeded role holders (P-003 rcsa, P-002 tprm); the
 * administrator persona names no person. No real people are referenced.
 */
const PERSONAS = {
  "rcsa-analyst": {
    userId: "DEMO-RCSA-001",
    displayName: "Marlene Aigner",
    email: "marlene.aigner@arcadia.example",
    roleIds: ["rcsa"],
    isAdministrator: false,
  },
  "tprm-analyst": {
    userId: "DEMO-TPRM-001",
    displayName: "Stefan Brunner",
    email: "stefan.brunner@arcadia.example",
    roleIds: ["tprm"],
    isAdministrator: false,
  },
  administrator: {
    userId: "DEMO-ADM-001",
    displayName: "Demonstration administrator",
    email: "administrator@arcadia.example",
    roleIds: [],
    isAdministrator: true,
  },
} as const;

/**
 * The eight product-owner personas of the Product Owner Console (plan 6.1).
 *
 * Defined in `src/features/product/permissions.ts`, with the console
 * authority scopes each one holds; the session carries those scopes as its
 * `authorityScopes`, which is what every console action checks. They name a
 * responsibility, not a person, and hold no workday role.
 */
function productOwnerPersona(id: ProductPersonaId) {
  const persona = PRODUCT_PERSONAS[id];
  return {
    userId: persona.demoUserId,
    displayName: persona.label.en,
    email: `${id}@arcadia.example`,
    roleIds: [] as string[],
    isAdministrator: id === "tenant-administrator",
    authorityScopes: [...persona.scopes] as string[],
  };
}

export type DemoPersonaId = keyof typeof PERSONAS | ProductPersonaId;

export function isDemoPersonaId(value: unknown): value is DemoPersonaId {
  return typeof value === "string" && (value in PERSONAS || isProductPersonaId(value));
}

function buildSession(personaId: DemoPersonaId, mode: "demonstration" | "offline-evaluation"): ProductSession {
  const persona = isProductPersonaId(personaId)
    ? productOwnerPersona(personaId)
    : { ...PERSONAS[personaId], authorityScopes: [] as string[] };
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
    authorityScopes: [...persona.authorityScopes],
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
