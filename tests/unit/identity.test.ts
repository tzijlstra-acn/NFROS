/**
 * Identity layer unit tests.
 *
 * Covers the HMAC signing round-trip, tamper detection, product mode reading,
 * and the access-control behaviour rules. No real credentials are used; all
 * session payloads are synthetic.
 *
 * next/headers is not available in the test environment (Node, no Next.js
 * runtime), so local-demo and local-pilot providers are not imported here.
 * The session and product-mode modules are pure Node and are tested directly.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signValue, verifyAndExtract } from "@/identity/session";
import { getProductMode, isRoleSwitchingAllowed, isResetAllowed } from "@/identity/product-mode";
import { requireSession, requireRole, requireAdministrator } from "@/identity/access";
import type { ProductSession } from "@/identity/types";

/* ==========================================================================
   Helpers
   ========================================================================== */

function makeSession(overrides: Partial<ProductSession> = {}): ProductSession {
  return {
    sessionId: "test-session-001",
    userId: "DEMO-001",
    displayName: "Test User",
    email: "test@demo.local",
    organisationId: "ORG-TEST",
    legalEntityIds: ["LE-001"],
    roleIds: ["rcsa"],
    authorityScopes: [],
    isAdministrator: false,
    productMode: "demonstration",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

/* ==========================================================================
   HMAC signing
   ========================================================================== */

describe("signValue + verifyAndExtract round-trip", () => {
  it("returns the original value after a sign-verify cycle", async () => {
    const payload = "rcsa-analyst";
    const signed = await signValue(payload);
    const extracted = await verifyAndExtract(signed);
    expect(extracted).toBe(payload);
  });

  it("round-trips a JSON string payload correctly", async () => {
    const payload = JSON.stringify({ userId: "DEMO-001", role: "rcsa" });
    const signed = await signValue(payload);
    const extracted = await verifyAndExtract(signed);
    expect(extracted).toBe(payload);
  });

  it("returns null when the value has been tampered with", async () => {
    const signed = await signValue("original-value");
    // Corrupt the payload portion, keeping the dot-separated HMAC suffix.
    const tampered = "tampered-value" + signed.slice(signed.lastIndexOf("."));
    expect(await verifyAndExtract(tampered)).toBeNull();
  });

  it("returns null when the HMAC has been replaced with a different digest", async () => {
    const signed = await signValue("some-payload");
    const dotIndex = signed.lastIndexOf(".");
    const withBadHmac = signed.slice(0, dotIndex + 1) + "a".repeat(64);
    expect(await verifyAndExtract(withBadHmac)).toBeNull();
  });

  it("returns null when there is no dot separator", async () => {
    expect(await verifyAndExtract("nodotanywhere")).toBeNull();
  });

  it("returns null for an empty string", async () => {
    expect(await verifyAndExtract("")).toBeNull();
  });

  it("returns null when the signed value is truncated", async () => {
    const signed = await signValue("test");
    expect(await verifyAndExtract(signed.slice(0, 8))).toBeNull();
  });
});

/* ==========================================================================
   Product mode
   ========================================================================== */

describe("getProductMode", () => {
  it("returns demonstration when PRODUCT_MODE is unset", () => {
    delete process.env["PRODUCT_MODE"];
    expect(getProductMode()).toBe("demonstration");
  });

  it("returns design-partner when PRODUCT_MODE=design-partner", () => {
    process.env["PRODUCT_MODE"] = "design-partner";
    expect(getProductMode()).toBe("design-partner");
  });

  it("returns offline-evaluation when PRODUCT_MODE=offline-evaluation", () => {
    process.env["PRODUCT_MODE"] = "offline-evaluation";
    expect(getProductMode()).toBe("offline-evaluation");
  });

  it("falls back to demonstration for an unrecognised value", () => {
    process.env["PRODUCT_MODE"] = "production";
    expect(getProductMode()).toBe("demonstration");
  });
});

/* ==========================================================================
   Role switching
   ========================================================================== */

describe("isRoleSwitchingAllowed", () => {
  it("returns true for demonstration mode", () => {
    expect(isRoleSwitchingAllowed("demonstration")).toBe(true);
  });

  it("returns false for design-partner mode", () => {
    expect(isRoleSwitchingAllowed("design-partner")).toBe(false);
  });

  it("returns false for offline-evaluation mode", () => {
    expect(isRoleSwitchingAllowed("offline-evaluation")).toBe(false);
  });
});

/* ==========================================================================
   Reset permission
   ========================================================================== */

describe("isResetAllowed", () => {
  it("returns true for demonstration mode regardless of admin status", () => {
    expect(isResetAllowed("demonstration", false)).toBe(true);
    expect(isResetAllowed("demonstration", true)).toBe(true);
  });

  it("returns false for design-partner mode when not administrator", () => {
    expect(isResetAllowed("design-partner", false)).toBe(false);
  });

  it("returns true for design-partner mode when administrator", () => {
    expect(isResetAllowed("design-partner", true)).toBe(true);
  });

  it("returns false for offline-evaluation mode when not administrator", () => {
    expect(isResetAllowed("offline-evaluation", false)).toBe(false);
  });

  it("returns true for offline-evaluation mode when administrator", () => {
    expect(isResetAllowed("offline-evaluation", true)).toBe(true);
  });
});

/* ==========================================================================
   Access control helpers
   ========================================================================== */

describe("requireSession", () => {
  it("does not throw when a session is present", () => {
    expect(() => requireSession(makeSession())).not.toThrow();
  });

  it("throws when session is null", () => {
    expect(() => requireSession(null)).toThrow("Not authenticated");
  });
});

describe("requireRole", () => {
  it("does not throw when the session holds the required role", () => {
    const session = makeSession({ roleIds: ["rcsa"] });
    expect(() => requireRole(session, "rcsa")).not.toThrow();
  });

  it("does not throw when the session is for an administrator", () => {
    const session = makeSession({ roleIds: [], isAdministrator: true });
    expect(() => requireRole(session, "rcsa")).not.toThrow();
  });

  it("throws when the role is absent and the user is not an administrator", () => {
    const session = makeSession({ roleIds: ["tprm"], isAdministrator: false });
    expect(() => requireRole(session, "rcsa")).toThrow("Unauthorized: role rcsa required");
  });
});

describe("requireAdministrator", () => {
  it("does not throw when isAdministrator is true", () => {
    const session = makeSession({ isAdministrator: true });
    expect(() => requireAdministrator(session)).not.toThrow();
  });

  it("throws when isAdministrator is false", () => {
    const session = makeSession({ isAdministrator: false });
    expect(() => requireAdministrator(session)).toThrow("Administrator access required");
  });
});
