/**
 * Product configuration tests.
 *
 * Written against the pure builders and the seeded data constants rather than
 * against a database, for the same reason the authority tests are: a test that
 * needs a seeded SQLite file tells you the seed ran, not that the rule holds.
 *
 * The jurisdiction test is the one that matters most here. Everything else in
 * this file protects a product property; that one protects a statement about
 * banking regulation that the product must never make.
 */

import { describe, expect, it } from "vitest";
import {
  buildFunctionPackView,
  buildOrganisationProfile,
  buildEntitlements,
  buildDeploymentProfile,
  deploymentHonesty,
  hasAdminFeature,
  hasAiFeature,
  hasConnectorPack,
  hasFunctionPack,
  localeIsSupported,
  mergeTerms,
  organisationProfileSchema,
  regulatorContextForBloc,
  resolveBrandIdentity,
  resolveBrandProfile,
  rolesFromEntitlements,
  termFrom,
  unresolvedEntityCount,
  DEFAULT_TERMINOLOGY_TERMS,
  ALTERNATE_TERMINOLOGY_OVERRIDES,
} from "@/product";
import {
  PRODUCT_ACTIVE_CONFIG,
  PRODUCT_BRAND_PROFILES,
  PRODUCT_CONFIG_GENESIS_CHANGE,
  PRODUCT_DEPLOYMENT_PROFILES,
  PRODUCT_ENTITLEMENT_PROFILES,
  PRODUCT_FUNCTION_PACKS,
  PRODUCT_ORGANISATION_PROFILES,
  PRODUCT_TERMINOLOGY_PROFILES,
  FULL_ENTITLEMENT_PROFILE_ID,
  RESTRICTED_ENTITLEMENT_PROFILE_ID,
  ORGANISATION_PROFILE_ID,
  DEFAULT_BRAND_PROFILE_ID,
} from "@/product/seed";
import { BRAND_MODES, DEPLOYMENT_KINDS, FUNCTION_PACK_IDS, TERMINOLOGY_KEYS } from "@/db/schema/product";
import { CONNECTOR_PACK_IDS } from "@/db/schema/integration";
import { TOOL_REGISTRY } from "@/server/security/authority";
import { legalEntities } from "@/scenario/data/institution";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ==========================================================================
   Helpers
   ========================================================================== */

/*
 * The forbidden characters are built from their code points rather than
 * written out. A test that asserted the absence of an em dash by containing
 * one would itself fail the repository copy gate, which scans tests as well as
 * source, so the only way to write this check is to never spell the character.
 */
const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);
const NON_ASCII_GERMAN = new RegExp(
  `[${[0xc4, 0xd6, 0xdc, 0xe4, 0xf6, 0xfc, 0xdf].map((code) => String.fromCodePoint(code)).join("")}]`,
);

/*
 * The seed data is written in insert shape, where a column with a database
 * default is optional. The resolvers take the select shape, where it is not.
 * These adapters fill the defaults once so no test has to reach for a cast,
 * which would also hide a genuine shape mismatch if the schema ever moved.
 */
const ENTITY_ROWS = legalEntities.map((entity) => ({ ...entity, notes: entity.notes ?? "" }));

function organisationRow() {
  const row = PRODUCT_ORGANISATION_PROFILES[0];
  if (!row) throw new Error("The seed defines no organisation profile.");
  return {
    ...row,
    workingDayStart: row.workingDayStart ?? "07:00",
    workingDayEnd: row.workingDayEnd ?? "19:00",
  };
}

function brandRow(mode: (typeof BRAND_MODES)[number]) {
  const row = PRODUCT_BRAND_PROFILES.find((profile) => profile.mode === mode);
  if (!row) throw new Error(`The seed defines no brand profile for ${mode} mode.`);
  return {
    ...row,
    operatorName: row.operatorName ?? null,
    primaryLogoUrl: row.primaryLogoUrl ?? null,
    secondaryLogoUrl: row.secondaryLogoUrl ?? null,
    faviconUrl: row.faviconUrl ?? null,
    supportLabel: row.supportLabel ?? null,
    supportUrl: row.supportUrl ?? null,
    legalNotice: row.legalNotice ?? null,
    accentToken: row.accentToken ?? null,
    syntheticDisclosure: row.syntheticDisclosure ?? true,
  };
}

function entitlementRow(id: string) {
  const row = PRODUCT_ENTITLEMENT_PROFILES.find((profile) => profile.id === id);
  if (!row) throw new Error(`The seed defines no entitlement profile ${id}.`);
  return row;
}

function packRow(id: string) {
  const row = PRODUCT_FUNCTION_PACKS.find((pack) => pack.id === id);
  if (!row) throw new Error(`The seed defines no function pack ${id}.`);
  return { ...row, enabled: row.enabled ?? true };
}

/** The resolved profile every organisation test builds from. */
function resolvedOrganisation() {
  return buildOrganisationProfile(organisationRow(), ENTITY_ROWS);
}

/**
 * The evaluation identifiers the suite defines.
 *
 * Read from the source rather than imported, because the suite exposes its
 * structural cases only through a function that queries the database and this
 * is a unit test. A string scan is enough for the property that matters here,
 * which is that a pack cannot name an evaluation case that does not exist.
 */
function knownEvaluationIds(): Set<string> {
  const source = readFileSync(
    resolve(process.cwd(), "src/agents/evaluations/suite.ts"),
    "utf8",
  );
  const ids = new Set<string>();
  for (const match of source.matchAll(/id:\s*"((?:eval|probe)-[a-z0-9-]+)"/g)) {
    const id = match[1];
    if (id) ids.add(id);
  }
  return ids;
}

/* ==========================================================================
   Organisation profile
   ========================================================================== */

describe("the organisation profile", () => {
  it("validates against the resolved schema", () => {
    const parsed = organisationProfileSchema.safeParse(resolvedOrganisation());
    expect(parsed.success).toBe(true);
  });

  it("resolves every declared legal entity", () => {
    const row = organisationRow();
    const profile = resolvedOrganisation();
    expect(profile.legalEntities).toHaveLength(row.legalEntityIds.length);
    expect(unresolvedEntityCount(row, profile)).toBe(0);
  });

  it("keeps the declared entity order rather than the query order", () => {
    const profile = resolvedOrganisation();
    expect(profile.legalEntities.map((entity) => entity.id)).toEqual(
      organisationRow().legalEntityIds,
    );
  });

  it("declares a default locale it also supports", () => {
    expect(localeIsSupported(resolvedOrganisation())).toBe(true);
  });

  it("points at profiles the seed actually defines", () => {
    const profile = resolvedOrganisation();
    expect(PRODUCT_BRAND_PROFILES.map((entry) => entry.id)).toContain(profile.brandProfileId);
    expect(PRODUCT_TERMINOLOGY_PROFILES.map((entry) => entry.id)).toContain(
      profile.terminologyProfileId,
    );
    expect(PRODUCT_ENTITLEMENT_PROFILES.map((entry) => entry.id)).toContain(
      profile.entitlementProfileId,
    );
    expect(PRODUCT_DEPLOYMENT_PROFILES.map((entry) => entry.id)).toContain(
      profile.deploymentProfileId,
    );
  });

  it("is the profile the active singleton points at", () => {
    expect(PRODUCT_ACTIVE_CONFIG.organisationProfileId).toBe(ORGANISATION_PROFILE_ID);
    expect(PRODUCT_ACTIVE_CONFIG.id).toBe("active");
  });

  it("drops a dangling entity reference instead of rendering a blank row", () => {
    const row = organisationRow();
    const profile = buildOrganisationProfile(
      { ...row, legalEntityIds: [...row.legalEntityIds, "ARC-XX"] },
      ENTITY_ROWS,
    );
    expect(profile.legalEntities.map((entity) => entity.id)).not.toContain("ARC-XX");
    expect(
      unresolvedEntityCount({ legalEntityIds: [...row.legalEntityIds, "ARC-XX"] }, profile),
    ).toBe(1);
  });
});

/* ==========================================================================
   Jurisdiction
   ========================================================================== */

describe("jurisdiction separation", () => {
  it("gives the Swiss entity FINMA and never DORA", () => {
    const swiss = resolvedOrganisation().legalEntities.find((entity) => entity.id === "ARC-CH");
    expect(swiss).toBeDefined();
    const context = (swiss?.regulatorContext ?? []).join(" ");
    expect(context).toContain("FINMA");
    expect(context).not.toContain("DORA");
    expect(context).not.toContain("EBA");
    expect(context).not.toContain("Regulation (EU)");
  });

  it("gives the German and Austrian entities DORA and EBA references", () => {
    for (const entityId of ["ARC-DE", "ARC-AT"]) {
      const entity = resolvedOrganisation().legalEntities.find((entry) => entry.id === entityId);
      expect(entity, `${entityId} should resolve`).toBeDefined();
      const context = (entity?.regulatorContext ?? []).join(" ");
      expect(context).toContain("DORA");
      expect(context).toContain("EBA");
      expect(context).not.toContain("FINMA");
    }
  });

  it("filters an EU reference out of a non EU bloc even if the map is wrong", () => {
    /*
     * The derivation already makes this unreachable through configuration. The
     * assertion is on the filter itself, because the filter is the guard that
     * survives somebody editing the map.
     */
    expect(regulatorContextForBloc("ch").some((item) => item.includes("DORA"))).toBe(false);
    expect(regulatorContextForBloc("unknown-bloc")).toEqual([]);
  });
});

/* ==========================================================================
   Terminology
   ========================================================================== */

describe("terminology", () => {
  const defaults = mergeTerms(null);
  const alternate = mergeTerms(ALTERNATE_TERMINOLOGY_OVERRIDES);

  it("defines every typed key in the default profile", () => {
    for (const key of TERMINOLOGY_KEYS) {
      const entry = DEFAULT_TERMINOLOGY_TERMS[key];
      expect(entry.singular.length, key).toBeGreaterThan(0);
      expect(entry.plural.length, key).toBeGreaterThan(0);
      expect(entry.singularDe.length, key).toBeGreaterThan(0);
      expect(entry.pluralDe.length, key).toBeGreaterThan(0);
    }
  });

  it("renders singular and plural in both languages", () => {
    expect(termFrom(defaults, "finding", "en")).toBe("Finding");
    expect(termFrom(defaults, "finding", "en", { plural: true })).toBe("Findings");
    expect(termFrom(defaults, "finding", "de")).toBe("Feststellung");
    expect(termFrom(defaults, "finding", "de", { plural: true })).toBe("Feststellungen");
    expect(termFrom(defaults, "action", "de", { plural: true })).toBe("Massnahmen");
    expect(termFrom(defaults, "incident", "de", { plural: true })).toBe("Vorfaelle");
  });

  it("prefers a short form in English and falls back to the full German term", () => {
    expect(termFrom(defaults, "secondLine", "en", { short: true })).toBe("2LoD");
    expect(termFrom(defaults, "secondLine", "de", { short: true })).toBe(
      "Zweite Verteidigungslinie",
    );
    // No short form defined, so the full term is returned rather than nothing.
    expect(termFrom(defaults, "control", "en", { short: true })).toBe("Control");
  });

  it("reconfigures only the terms a profile overrides", () => {
    expect(termFrom(alternate, "finding", "en")).toBe("Observation");
    expect(termFrom(alternate, "finding", "de")).toBe("Beobachtung");
    expect(termFrom(alternate, "rcsa", "en")).toBe("Risk and control self assessment");
    expect(termFrom(alternate, "issue", "en")).toBe("Deficiency");
    // Untouched by the alternate profile, so it still comes from the default.
    expect(termFrom(alternate, "control", "en")).toBe("Control");
    expect(termFrom(alternate, "criticalService", "de")).toBe("Kritische Dienstleistung");
  });

  it("contains no umlaut or eszett characters anywhere in the German terms", () => {
    /*
     * The codebase is ASCII transliterated throughout. A single umlaut slipping
     * into a term that appears on every screen would be found late and in
     * front of a client.
     */
    for (const key of TERMINOLOGY_KEYS) {
      for (const profile of [defaults, alternate]) {
        const entry = profile[key];
        expect(
          NON_ASCII_GERMAN.test(`${entry.singularDe} ${entry.pluralDe}`),
          key,
        ).toBe(false);
      }
    }
  });
});

/* ==========================================================================
   Branding
   ========================================================================== */

describe("brand profile resolution", () => {
  it("defines one profile per mode", () => {
    for (const mode of BRAND_MODES) {
      expect(PRODUCT_BRAND_PROFILES.filter((profile) => profile.mode === mode)).toHaveLength(1);
    }
  });

  it("shows the institution mark only in client mode, and never the operator name", () => {
    const brand = resolveBrandProfile(brandRow("client"));
    const identity = resolveBrandIdentity(brand);
    expect(identity.mode).toBe("client");
    expect(identity.marks).toHaveLength(1);
    expect(identity.marks[0]?.owner).toBe("client");
    expect(identity.showPair).toBe(false);
    expect(identity.operatorName).toBeNull();
    expect(identity.attribution).toBe("Arcadia Banking Group");
  });

  it("shows one operator mark in Accenture mode", () => {
    const identity = resolveBrandIdentity(
      resolveBrandProfile(brandRow("accenture")),
    );
    expect(identity.marks).toHaveLength(1);
    expect(identity.marks[0]?.owner).toBe("operator");
    expect(identity.showPair).toBe(false);
    expect(identity.operatorName).toBe("Accenture");
    expect(identity.attribution).toBe("Accenture");
  });

  it("shows a pair in co-branded mode, institution first", () => {
    const identity = resolveBrandIdentity(
      resolveBrandProfile(brandRow("co-branded")),
    );
    expect(identity.marks).toHaveLength(2);
    expect(identity.marks.map((mark) => mark.owner)).toEqual(["client", "operator"]);
    expect(identity.showPair).toBe(true);
    expect(identity.operatorName).toBe("Accenture");
    expect(identity.attribution).toBe("Arcadia Banking Group");
  });

  it("resolves the accent to a custom property name, never a colour value", () => {
    for (const mode of BRAND_MODES) {
      const identity = resolveBrandIdentity(resolveBrandProfile(brandRow(mode)));
      expect(identity.accentToken.startsWith("--")).toBe(true);
    }
  });

  it("keeps the synthetic data disclosure on in every mode", () => {
    for (const profile of PRODUCT_BRAND_PROFILES) {
      expect(profile.syntheticDisclosure, profile.id).toBe(true);
    }
  });

  it("is the brand the seeded organisation profile points at", () => {
    expect(resolvedOrganisation().brandProfileId).toBe(DEFAULT_BRAND_PROFILE_ID);
    expect(brandRow("client").id).toBe(DEFAULT_BRAND_PROFILE_ID);
  });
});

/* ==========================================================================
   Entitlements
   ========================================================================== */

describe("entitlements", () => {
  const full = buildEntitlements(entitlementRow(FULL_ENTITLEMENT_PROFILE_ID));
  const restricted = buildEntitlements(entitlementRow(RESTRICTED_ENTITLEMENT_PROFILE_ID));

  it("grants every function pack in the full profile", () => {
    for (const packId of FUNCTION_PACK_IDS) {
      expect(hasFunctionPack(full, packId), packId).toBe(true);
    }
  });

  it("denies the packs the pilot profile does not include", () => {
    expect(hasFunctionPack(restricted, "rcsa-operational-risk")).toBe(true);
    expect(hasFunctionPack(restricted, "third-party-risk")).toBe(true);
    expect(hasFunctionPack(restricted, "control-assurance")).toBe(false);
    expect(hasFunctionPack(restricted, "incident-operational-resilience")).toBe(false);
    expect(hasFunctionPack(restricted, "regulatory-change")).toBe(false);
    expect(hasFunctionPack(restricted, "nfr-governance")).toBe(false);
  });

  it("gates connector packs, AI capabilities and administrator capabilities", () => {
    expect(hasConnectorPack(full, "regulatory-content")).toBe(true);
    expect(hasConnectorPack(restricted, "regulatory-content")).toBe(false);

    expect(hasAiFeature(full, "autonomous-execution")).toBe(true);
    expect(hasAiFeature(restricted, "autonomous-execution")).toBe(false);
    expect(hasAiFeature(restricted, "ai-partner-chat")).toBe(true);

    expect(hasAdminFeature(full, "authority-settings")).toBe(true);
    expect(hasAdminFeature(restricted, "authority-settings")).toBe(false);
    expect(hasAdminFeature(restricted, "branding")).toBe(true);
  });

  it("reduces the reachable roles when packs are denied", () => {
    const views = PRODUCT_FUNCTION_PACKS.map((row) =>
      buildFunctionPackView(packRow(row.id), restricted),
    );
    const roles = rolesFromEntitlements(restricted, views);
    expect(roles).toContain("rcsa");
    expect(roles).toContain("tprm");
    expect(roles).not.toContain("control-assurance");
    expect(roles).not.toContain("incident-resilience");
  });

  it("reports a licensed pack with an ungranted connector dependency as degraded", () => {
    const view = buildFunctionPackView(packRow("rcsa-operational-risk"), restricted);
    expect(view.granted).toBe(true);
    expect(view.missingConnectorPacks).toContain("process-intelligence");
  });

  it("names only connector packs the integration layer defines", () => {
    for (const profile of PRODUCT_ENTITLEMENT_PROFILES) {
      for (const packId of profile.connectorPacks) {
        expect(CONNECTOR_PACK_IDS as readonly string[], packId).toContain(packId);
      }
    }
  });
});

/* ==========================================================================
   Function packs
   ========================================================================== */

describe("function packs", () => {
  it("defines all six, once each", () => {
    expect(PRODUCT_FUNCTION_PACKS).toHaveLength(FUNCTION_PACK_IDS.length);
    expect(PRODUCT_FUNCTION_PACKS.map((pack) => pack.id).sort()).toEqual(
      [...FUNCTION_PACK_IDS].sort(),
    );
  });

  it("fills every content array", () => {
    for (const pack of PRODUCT_FUNCTION_PACKS) {
      expect(pack.domainObjects.length, pack.id).toBeGreaterThan(0);
      expect(pack.roles.length, pack.id).toBeGreaterThan(0);
      expect(pack.tools.length, pack.id).toBeGreaterThan(0);
      expect(pack.screens.length, pack.id).toBeGreaterThan(0);
      expect(pack.evaluations.length, pack.id).toBeGreaterThan(0);
      expect(pack.connectorDependencies.length, pack.id).toBeGreaterThan(0);
    }
  });

  it("names only tools that exist in the registry", () => {
    /*
     * A pack listing a tool the product does not have is a capability claim
     * that survives review and fails in front of a client. This is the cheapest
     * place to catch it.
     */
    for (const pack of PRODUCT_FUNCTION_PACKS) {
      for (const tool of pack.tools) {
        expect(Object.keys(TOOL_REGISTRY), `${pack.id} names ${tool}`).toContain(tool);
      }
    }
  });

  it("names no prohibited tool", () => {
    for (const pack of PRODUCT_FUNCTION_PACKS) {
      for (const tool of pack.tools) {
        expect(TOOL_REGISTRY[tool]?.authorityClass, `${pack.id} names ${tool}`).not.toBe(
          "PROHIBITED",
        );
      }
    }
  });

  it("names only evaluation cases that exist in the suite", () => {
    const ids = knownEvaluationIds();
    expect(ids.size).toBeGreaterThan(10);
    for (const pack of PRODUCT_FUNCTION_PACKS) {
      for (const evaluation of pack.evaluations) {
        expect(ids.has(evaluation), `${pack.id} names ${evaluation}`).toBe(true);
      }
    }
  });

  it("names screens as absolute route paths", () => {
    for (const pack of PRODUCT_FUNCTION_PACKS) {
      for (const screen of pack.screens) {
        expect(screen.startsWith("/"), `${pack.id} names ${screen}`).toBe(true);
      }
    }
  });

  it("names connector dependencies the integration layer defines", () => {
    for (const pack of PRODUCT_FUNCTION_PACKS) {
      for (const dependency of pack.connectorDependencies) {
        expect(CONNECTOR_PACK_IDS as readonly string[], `${pack.id}`).toContain(dependency);
      }
    }
  });
});

/* ==========================================================================
   Deployment honesty
   ========================================================================== */

describe("deployment profiles", () => {
  it("defines all four kinds, once each", () => {
    expect(PRODUCT_DEPLOYMENT_PROFILES).toHaveLength(DEPLOYMENT_KINDS.length);
    expect(PRODUCT_DEPLOYMENT_PROFILES.map((profile) => profile.kind).sort()).toEqual(
      [...DEPLOYMENT_KINDS].sort(),
    );
  });

  it("marks exactly one profile as implemented here, and it is the prototype", () => {
    const implemented = PRODUCT_DEPLOYMENT_PROFILES.filter((profile) => profile.implementedHere);
    expect(implemented).toHaveLength(1);
    expect(implemented[0]?.kind).toBe("restricted-local-prototype");
  });

  it("lists outstanding work for every profile that is not implemented here", () => {
    for (const profile of PRODUCT_DEPLOYMENT_PROFILES) {
      if (profile.implementedHere) {
        expect(profile.outstandingWork, profile.id).toHaveLength(0);
        continue;
      }
      expect(profile.outstandingWork.length, profile.id).toBeGreaterThanOrEqual(4);
      for (const item of profile.outstandingWork) {
        expect(item.length, profile.id).toBeGreaterThan(20);
      }
    }
  });

  it("claims capability only where the flag allows it", () => {
    for (const row of PRODUCT_DEPLOYMENT_PROFILES) {
      const honesty = deploymentHonesty(buildDeploymentProfile(row));
      if (row.implementedHere) {
        expect(honesty.statusLabel.en).toBe("Implemented here");
        expect(honesty.claim.en).toContain("running build");
      } else {
        expect(honesty.statusLabel.en).toBe("Defined only");
        expect(honesty.claim.en).toContain("not implemented in this build");
        expect(honesty.outstandingWork.length).toBeGreaterThan(0);
      }
    }
  });

  it("states a region, an identity mode and a retention profile for every kind", () => {
    for (const profile of PRODUCT_DEPLOYMENT_PROFILES) {
      expect(profile.region.length, profile.id).toBeGreaterThan(5);
      expect(profile.identityMode.length, profile.id).toBeGreaterThan(20);
      expect(profile.modelEndpointProfile.length, profile.id).toBeGreaterThan(20);
      expect(profile.dataRetentionProfile.length, profile.id).toBeGreaterThan(20);
      expect(profile.observabilityProfile.length, profile.id).toBeGreaterThan(20);
    }
  });
});

/* ==========================================================================
   Seeded copy
   ========================================================================== */

describe("seeded copy", () => {
  /** Every string the product configuration seed writes, flattened. */
  function seededStrings(): string[] {
    const found: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "string") {
        found.push(value);
        return;
      }
      if (Array.isArray(value)) {
        for (const entry of value) walk(entry);
        return;
      }
      if (value !== null && typeof value === "object") {
        for (const entry of Object.values(value)) walk(entry);
      }
    };
    walk([
      PRODUCT_BRAND_PROFILES,
      PRODUCT_TERMINOLOGY_PROFILES,
      PRODUCT_ENTITLEMENT_PROFILES,
      PRODUCT_DEPLOYMENT_PROFILES,
      PRODUCT_ORGANISATION_PROFILES,
      PRODUCT_FUNCTION_PACKS,
      PRODUCT_ACTIVE_CONFIG,
      PRODUCT_CONFIG_GENESIS_CHANGE,
    ]);
    return found;
  }

  it("contains no em dash", () => {
    for (const value of seededStrings()) {
      expect(value.includes(EM_DASH), value.slice(0, 80)).toBe(false);
    }
  });

  it("contains no en dash either", () => {
    for (const value of seededStrings()) {
      expect(value.includes(EN_DASH), value.slice(0, 80)).toBe(false);
    }
  });

  it("contains no umlaut or eszett character", () => {
    for (const value of seededStrings()) {
      expect(NON_ASCII_GERMAN.test(value), value.slice(0, 80)).toBe(false);
    }
  });

  it("makes no compliance claim and shows no savings figure", () => {
    /*
     * The two assertions the brief makes unconditional. "Compliant with" and a
     * percentage saving are both statements this product is not entitled to
     * make, and seeded copy is where they would appear first.
     */
    for (const value of seededStrings()) {
      expect(value.toLowerCase(), value.slice(0, 80)).not.toMatch(
        /\b(?:fully compliant|ensures compliance|compliant with|guarantees compliance)\b/,
      );
      expect(value.toLowerCase(), value.slice(0, 80)).not.toMatch(
        /\b\d{1,3}\s*(?:%|percent)\s*(?:saving|reduction|faster|cheaper)\b/,
      );
    }
  });

  it("carries no upsell or pricing language", () => {
    for (const value of seededStrings()) {
      expect(value.toLowerCase(), value.slice(0, 80)).not.toMatch(
        /\b(?:upgrade now|contact sales|per seat|per user per month|pricing|free trial|buy now)\b/,
      );
    }
  });
});
