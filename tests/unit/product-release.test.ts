/**
 * Release coherence.
 *
 * The product used to describe itself five different ways: package.json said
 * 1.0.0, the CHANGELOG put 2.3.0 above 4.0.0, the operations console printed
 * 4.0.0 from a literal, the interface said V3.3 and the deck said V2.4. These
 * tests hold every one of those surfaces to the release registry in
 * `src/product/release`, so the next release cannot drift in the same way.
 *
 * Read from the files on disk rather than imported, because the claim being
 * tested is what a reader of package.json, the CHANGELOG and the README sees.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  INSTALLED_ROLE_APPS,
  KNOWN_LIMITATIONS,
  PREVIEW_ROLE_APPS,
  PRODUCT_IDENTITY,
  PRODUCT_RELEASE,
  RELEASE_COMPONENTS,
  ROLE_RELEASE_DEFINITIONS,
  formatComponentVersion,
  getProductReleaseRegistry,
  getReleaseComponent,
  rolesWithReleaseStatus,
} from "@/product/release";
import { renderReleaseMarkdown, README_RELEASE_END, README_RELEASE_START } from "@/product/release/readme";
import { CURRENT_WORKDAY_UI } from "@/workday/contracts";
import { PRODUCT_BRAND_PROFILES } from "@/product/seed";
import { FALLBACK_BRAND_PROFILE } from "@/product/branding/brand";
import { PRODUCT_COPY } from "@/i18n/labels";
import { DECK_VERSION } from "@/presentation-v2-4/export/types";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";

const ROOT = resolve(__dirname, "..", "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf-8");

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Every `## [x.y.z] - date` heading in the CHANGELOG, in file order. */
function changelogReleases(): Array<{ version: string; date: string | null; line: string }> {
  const headings: Array<{ version: string; date: string | null; line: string }> = [];
  for (const line of read("CHANGELOG.md").split(/\r?\n/)) {
    const match = /^## \[(\d+\.\d+\.\d+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/.exec(line);
    if (match?.[1]) headings.push({ version: match[1], date: match[2] ?? null, line });
  }
  return headings;
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

describe("the product release", () => {
  it("is a semantic version with an ISO date", () => {
    expect(PRODUCT_RELEASE.version).toMatch(SEMVER);
    expect(PRODUCT_RELEASE.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PRODUCT_IDENTITY.name).toBe("NFROS");
  });

  it("matches the package.json version", () => {
    const pkg = JSON.parse(read("package.json")) as { version?: string };
    expect(pkg.version).toBe(PRODUCT_RELEASE.version);
  });

  it("matches the CHANGELOG top entry, version and date", () => {
    const releases = changelogReleases();
    const top = releases[0];
    expect(top, "the CHANGELOG has no `## [x.y.z] - YYYY-MM-DD` heading").toBeDefined();
    expect(top?.version).toBe(PRODUCT_RELEASE.version);
    expect(top?.date).toBe(PRODUCT_RELEASE.date);
  });

  it("orders CHANGELOG product releases newest first, with no duplicates", () => {
    const versions = changelogReleases().map((entry) => entry.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (let i = 1; i < versions.length; i += 1) {
      const previous = versions[i - 1] ?? "0.0.0";
      const current = versions[i] ?? "0.0.0";
      expect(compareSemver(previous, current), `${previous} must be above ${current}`).toBeGreaterThan(0);
    }
  });

  it("keeps the README release block identical to the registry", () => {
    const readme = read("README.md").replace(/\r\n/g, "\n");
    const start = readme.indexOf(`\n${README_RELEASE_START}\n`) + 1;
    const end = readme.indexOf(README_RELEASE_END, start);
    expect(start, "README release section heading missing").toBeGreaterThan(0);
    expect(end, "README release section closing line missing").toBeGreaterThan(start);
    const block = readme.slice(start, end + README_RELEASE_END.length);
    expect(
      block,
      "README release block is out of date. Run: npx tsx scripts/sync-release-readme.ts",
    ).toBe(renderReleaseMarkdown());
  });

  it("names the product NFROS in the README title", () => {
    expect(read("README.md").split(/\r?\n/)[0]).toBe(`# ${PRODUCT_IDENTITY.name}`);
  });

  it("gives every brand profile, the fallback and the shared product copy the registry name", () => {
    for (const profile of PRODUCT_BRAND_PROFILES) {
      expect(profile.productName).toBe(PRODUCT_IDENTITY.name);
    }
    expect(FALLBACK_BRAND_PROFILE.productName).toBe(PRODUCT_IDENTITY.name);
    expect(PRODUCT_COPY.productName).toEqual({ en: PRODUCT_IDENTITY.name, de: PRODUCT_IDENTITY.name });
  });

  it("leaves no superseded product name in interface code", () => {
    /*
     * The legacy story deck keeps its accessible name, which five end to end
     * specs assert; it is the pre V2 presentation and is not an interface
     * surface of this release. Comments are not interface copy and are skipped.
     */
    const exempt = new Set([join("src", "components", "presentation", "StoryDeck.tsx")]);
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(join(ROOT, dir))) {
        const path = join(dir, entry);
        if (statSync(join(ROOT, path)).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry) && !exempt.has(path)) files.push(path);
      }
    };
    walk("app");
    walk(join("src", "components"));
    walk(join("src", "i18n"));
    files.push(join("src", "db", "repositories", "header.ts"));

    for (const file of files) {
      const code = read(file)
        .split(/\r?\n/)
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join("\n");
      expect(code, file).not.toContain("NFR WorkOS");
    }
  });
});

describe("named components", () => {
  it("reads the workday interface version from the router constant", () => {
    expect(getReleaseComponent("workday-interface").version).toBe(
      formatComponentVersion(CURRENT_WORKDAY_UI),
    );
    expect(getReleaseComponent("workday-interface").version).toBe("V3.3");
  });

  it("reads the presentation version from the export pipeline constant", () => {
    expect(getReleaseComponent("presentation").version).toBe(formatComponentVersion(DECK_VERSION));
    expect(getReleaseComponent("presentation").version).toBe("V2.4");
  });

  it("formats lower case identifiers for people", () => {
    expect(formatComponentVersion("v3.3")).toBe("V3.3");
    expect(formatComponentVersion("V2.4")).toBe("V2.4");
    expect(formatComponentVersion("4.1.0")).toBe("4.1.0");
  });

  it("has exactly the two components", () => {
    expect(RELEASE_COMPONENTS.map((component) => component.id)).toEqual([
      "workday-interface",
      "presentation",
    ]);
  });
});

describe("role release states", () => {
  it("are read from role-release.ts, not copied", () => {
    expect(getProductReleaseRegistry().roles).toBe(ROLE_RELEASE_DEFINITIONS);
  });

  it("stay Available, Demo and Planned as agreed", () => {
    expect(rolesWithReleaseStatus("available").map((role) => role.roleId)).toEqual(["rcsa", "tprm"]);
    expect(rolesWithReleaseStatus("demo").map((role) => role.roleId)).toEqual([
      "control-assurance",
      "incident-resilience",
    ]);
    expect(rolesWithReleaseStatus("planned").map((role) => role.roleId)).toEqual([
      "regulatory-change",
      "nfr-governance",
    ]);
  });
});

describe("Role Apps", () => {
  it("are read from the Role App registry", () => {
    expect(INSTALLED_ROLE_APPS.length + PREVIEW_ROLE_APPS.length).toBe(
      ROLE_APP_REGISTRY.filter((app) => app.status === "installed" || app.status === "preview").length,
    );
  });

  it("install exactly the two flagship apps, each with a route", () => {
    expect(INSTALLED_ROLE_APPS.map((app) => app.id)).toEqual([
      "rcsa-cycle-assistant",
      "tprm-third-party-onboarding",
    ]);
    for (const app of INSTALLED_ROLE_APPS) expect(app.entryRoute).not.toBeNull();
  });

  it("route no preview app", () => {
    for (const app of PREVIEW_ROLE_APPS) expect(app.entryRoute).toBeNull();
  });
});

describe("known limitations", () => {
  it("have unique ids, a status and both languages", () => {
    const ids = KNOWN_LIMITATIONS.map((limitation) => limitation.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const limitation of KNOWN_LIMITATIONS) {
      expect(["open", "mitigated"]).toContain(limitation.status);
      expect(limitation.title.en.length).toBeGreaterThan(0);
      expect(limitation.title.de.length).toBeGreaterThan(0);
      expect(limitation.detail.en.length).toBeGreaterThan(0);
      expect(limitation.detail.de.length).toBeGreaterThan(0);
    }
  });
});

describe("copy rules for the registry", () => {
  const strings: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect({ PRODUCT_IDENTITY, PRODUCT_RELEASE, RELEASE_COMPONENTS, KNOWN_LIMITATIONS });

  /*
   * Built from character codes so this file itself carries none of the
   * characters it forbids, and the copy gate does not flag the test.
   */
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
  const UMLAUTS = new RegExp(`[${String.fromCharCode(0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf)}]`);

  it("uses no em dash, no en dash and no umlaut", () => {
    for (const text of strings) {
      expect(text).not.toMatch(DASHES);
      expect(text).not.toMatch(UMLAUTS);
      expect(text).not.toMatch(/ -- /);
    }
  });
});

describe("no surface hard-codes a product version", () => {
  /*
   * A semantic version literal in these files is either a second source for
   * the product release or a stale one. Data versions read from the database
   * (deployment profiles, function packs) are not literals and do not match.
   */
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const path = join(dir, entry);
      if (statSync(join(ROOT, path)).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
    }
  };
  walk("app/ops");
  walk("app/settings");
  files.push(
    "scripts/backup.ts",
    "scripts/release-package.ts",
    "scripts/support-bundle.ts",
    "scripts/sbom.ts",
  );

  for (const file of files) {
    it(`${file} carries no version literal`, () => {
      const text = read(file);
      expect(text).not.toMatch(/["'`]\d+\.\d+\.\d+["'`]/);
      expect(text).not.toMatch(/\d+\+ tables/);
    });
  }
});
