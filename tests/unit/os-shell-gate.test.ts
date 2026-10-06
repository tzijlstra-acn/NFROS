/**
 * The release gate on every workday route, and the runtime key statement.
 *
 * Three layers are tested, because the gate is applied in two places and both
 * must hold on their own:
 *
 *   the pure rule (`src/workday/role-gate.ts`) for all six registry roles;
 *   the middleware, called with real requests, which redirects a Planned role
 *   and pins a Demo role to the current interface under any `?ui=`;
 *   the page dispatcher, which redirects a Planned role and renders the
 *   release page for a Demo role whatever version the header asks for.
 *
 * The dispatcher test mocks the database client, so it never opens the
 * shared database, and mocks the Next request APIs it calls.
 */

import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new Error(`REDIRECT ${location}`);
  },
  notFound: () => {
    throw new Error("NOT FOUND");
  },
}));
vi.mock("@/db/client", () => ({
  isDatabaseReady: () => false,
  getDb: () => {
    throw new Error("the gate test must not open a database");
  },
  getSqlite: () => {
    throw new Error("the gate test must not open a database");
  },
}));

const { NextRequest } = await import("next/server");
const { middleware } = await import("../../middleware");
const { createWorkdayPage } = await import("@/workday/dispatch");
const { PreviewRolePage } = await import("@/components/workday-v3/PreviewRolePage");
const {
  gateForPath,
  gateForRole,
  plannedRoleRedirectHref,
  refusedRoleFromQuery,
  roleFromWorkdayPath,
} = await import("@/workday/role-gate");
const { ROLE_RELEASE_DEFINITIONS } = await import("@/product/release/role-release");
const { describeKeyResolution } = await import("@/server/config/runtime");

const SEGMENTS = ["", "/work", "/processes", "/decisions", "/processes/rcsa-cycle", "/workbench"];

describe("the rule, for every role in the registry", () => {
  it("opens the Available roles, shows Demo roles their release page, and refuses Planned roles", () => {
    const kinds = Object.fromEntries(ROLE_RELEASE_DEFINITIONS.map((role) => [role.roleId, gateForRole(role.roleId).kind]));
    expect(kinds).toEqual({
      rcsa: "open",
      tprm: "open",
      "control-assurance": "demo",
      "incident-resilience": "demo",
      "regulatory-change": "planned",
      "nfr-governance": "planned",
    });
  });

  it("applies to every route of a role, not only its home", () => {
    for (const segment of SEGMENTS) {
      expect(gateForPath(`/workday/regulatory-change${segment}`).kind).toBe("planned");
      expect(gateForPath(`/workday/control-assurance${segment}`).kind).toBe("demo");
      expect(gateForPath(`/workday/rcsa${segment}`).kind).toBe("open");
    }
    expect(gateForPath("/workday").kind).toBe("open");
    expect(gateForPath("/story").kind).toBe("open");
    expect(roleFromWorkdayPath("/workday/tprm/decisions")).toBe("tprm");
  });

  it("names a refused role for the role selector only when the registry would refuse it", () => {
    expect(plannedRoleRedirectHref("nfr-governance")).toBe("/workday?unavailable=nfr-governance");
    expect(refusedRoleFromQuery("nfr-governance")?.releaseLabel).toBe("NFR Portfolio Lead");
    expect(refusedRoleFromQuery(["regulatory-change", "x"])?.roleId).toBe("regulatory-change");
    expect(refusedRoleFromQuery("rcsa")).toBeNull();
    expect(refusedRoleFromQuery("control-assurance")).toBeNull();
    expect(refusedRoleFromQuery("<script>")).toBeNull();
    expect(refusedRoleFromQuery(undefined)).toBeNull();
  });
});

describe("the middleware", () => {
  async function run(path: string) {
    return middleware(new NextRequest(new URL(path, "http://localhost:3108")));
  }

  it("redirects every route of a Planned role to the role selector, under any interface", async () => {
    for (const path of [
      "/workday/regulatory-change",
      "/workday/regulatory-change/decisions",
      "/workday/nfr-governance/processes",
      "/workday/nfr-governance/work?ui=v2",
      "/workday/nfr-governance?ui=v1",
    ]) {
      const response = await run(path);
      expect(response.status, path).toBe(307);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname, path).toBe("/workday");
      expect(location.searchParams.get("unavailable"), path).toMatch(/^(regulatory-change|nfr-governance)$/);
    }
  });

  it("pins a Demo role to the current interface on every route, even when V1 or V2 is asked for", async () => {
    for (const path of ["/workday/control-assurance?ui=v2", "/workday/incident-resilience/work?ui=v1", "/workday/control-assurance/workbench"]) {
      const response = await run(path);
      expect(response.status, path).toBe(200);
      expect(response.headers.get("x-middleware-request-x-nfr-workday-ui"), path).toBe("v3.3");
    }
  });

  it("leaves an Available role's interface choice alone", async () => {
    const response = await run("/workday/rcsa/decisions?ui=v2");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-nfr-workday-ui")).toBe("v2");
  });
});

describe("the page dispatcher", () => {
  const V1 = () => "v1";
  const V2 = () => "v2";
  const V3 = () => "v3";
  const page = createWorkdayPage(V1, V2, V3);

  async function render(role: string, version: string): Promise<unknown> {
    requestHeaders.set("x-nfr-workday-ui", version);
    return page({ params: Promise.resolve({ role }), searchParams: Promise.resolve({}) });
  }

  it("redirects a Planned role from every interface version", async () => {
    for (const version of ["v1", "v2", "v3.3"]) {
      await expect(render("nfr-governance", version)).rejects.toThrow("REDIRECT /workday?unavailable=nfr-governance");
    }
  });

  it("renders the release page for a Demo role from every interface version", async () => {
    for (const version of ["v1", "v2", "v3.3"]) {
      const element = await render("incident-resilience", version);
      expect(isValidElement(element), version).toBe(true);
      expect((element as ReactElement).type, version).toBe(PreviewRolePage);
      expect((element as ReactElement<{ role: { status: string } }>).props.role.status).toBe("demo");
    }
  });

  it("renders the chosen interface for an Available role", async () => {
    const element = (await render("tprm", "v2")) as ReactElement;
    expect(element.type).toBe(V2);
    const current = (await render("tprm", "v3.3")) as ReactElement;
    expect(current.type).toBe(V3);
  });
});

describe("the runtime key statement (audit T21)", () => {
  it("never claims a key was resolved when none was", () => {
    const text = describeKeyResolution(false, null);
    expect(text).toMatch(/^No key was resolved/);
    expect(text).not.toMatch(/usable key was resolved/i);
  });

  it("says a resolved key is not verified until a live call is accepted, and says so when one is rejected", () => {
    expect(describeKeyResolution(true, null)).toMatch(/not verified/);
    expect(describeKeyResolution(true, true)).toMatch(/accepted a live call/);
    expect(describeKeyResolution(true, false)).toMatch(/rejected the last live call/);
  });

  it("is fixed text: four sentences, none carrying anything about the key", () => {
    const all = [
      describeKeyResolution(false, null),
      describeKeyResolution(false, true),
      describeKeyResolution(true, null),
      describeKeyResolution(true, true),
      describeKeyResolution(true, false),
    ];
    expect(new Set(all).size).toBe(4);
    for (const text of all) {
      expect(text).not.toMatch(/prefix|suffix|length|\*{3}/i);
    }
  });
});
