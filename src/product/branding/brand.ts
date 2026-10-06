/**
 * Brand profile resolution.
 *
 * Three modes, one resolver. The product presents itself as the client's own
 * application, as an Accenture product, or as both, and nothing outside this
 * module is allowed to decide which marks and which names a surface shows.
 *
 * The structural rule worth stating, because it is the reason the resolved
 * object is shaped the way it is: in client mode the resolved identity carries
 * `operatorName: null`. The operator name is still in the database and the
 * branding settings screen still shows it, but a shell component rendering the
 * identity object cannot leak it, because it is not there. Relying on every
 * consumer to remember "do not show the operator in client mode" is the kind of
 * rule that holds until the fourth component.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { BRAND_MODES, brandProfiles, type BrandMode } from "@/db/schema/product";
import {
  createConfigCacheSlot,
  readThroughConfigCache,
  resolveOrganisationProfile,
} from "../organisation/profile";
import { PRODUCT_IDENTITY } from "../release/identity";

type BrandProfileRow = typeof brandProfiles.$inferSelect;

/* ==========================================================================
   Types
   ========================================================================== */

export interface BrandProfile {
  id: string;
  mode: BrandMode;
  productName: string;
  shortName: string;
  clientName: string;
  operatorName?: string;
  primaryLogoUrl?: string;
  secondaryLogoUrl?: string;
  faviconUrl?: string;
  supportLabel?: string;
  supportUrl?: string;
  legalNotice?: string;
  accentToken?: string;
  /** Not configurable away in this build. See the branding settings screen. */
  syntheticDisclosure: boolean;
}

/** One logo mark, with the organisation it belongs to. */
export interface BrandMark {
  src: string;
  alt: string;
  owner: "client" | "operator";
}

/**
 * What a shell surface may render.
 *
 * Everything a top bar, a footer or a report header needs, already decided.
 * A consumer picks fields out of this object; it never branches on the mode
 * itself, because that branch is what drifts between surfaces.
 */
export interface BrandIdentity {
  brandProfileId: string;
  mode: BrandMode;
  /** The full product name, for titles and the top bar. */
  productName: string;
  /** The compact name, for a narrow bar or a breadcrumb. */
  shortName: string;
  /** The institution whose data this deployment holds. Always shown. */
  clientName: string;
  /** Null in client mode, by construction. See the module comment. */
  operatorName: string | null;
  /** Who the interface attributes the product to in this mode. */
  attribution: string;
  marks: BrandMark[];
  /** True when two marks are shown side by side with a hairline between. */
  showPair: boolean;
  supportLabel: string | null;
  supportUrl: string | null;
  legalNotice: string | null;
  /** A custom property name from the workday scope, for example `--app-ai`. */
  accentToken: string;
  faviconUrl: string | null;
  syntheticDisclosure: boolean;
}

export const BRAND_MODE_LABELS: Record<BrandMode, { en: string; de: string }> = {
  client: { en: "Client branded", de: "Kundenmarke" },
  accenture: { en: "Accenture branded", de: "Accenture Marke" },
  "co-branded": { en: "Co-branded", de: "Gemeinsame Marke" },
};

/** What each mode means in practice, for the branding settings screen. */
export const BRAND_MODE_EXPLANATION: Record<BrandMode, { en: string; de: string }> = {
  client: {
    en: "The product carries the institution name and mark only. The operator is named in this settings area and in the contractual documentation, and nowhere in the working interface.",
    de: "Das Produkt traegt ausschliesslich Namen und Zeichen des Instituts. Der Betreiber wird in diesem Einstellungsbereich und in der Vertragsdokumentation genannt, nicht in der Arbeitsoberflaeche.",
  },
  accenture: {
    en: "The product carries the operator name and mark. Appropriate for a demonstration or an internal build, not for a deployment holding a client record.",
    de: "Das Produkt traegt Namen und Zeichen des Betreibers. Geeignet fuer eine Demonstration oder einen internen Build, nicht fuer eine Umgebung mit Kundendaten.",
  },
  "co-branded": {
    en: "Both marks appear, separated by a hairline, with the institution first. Used where the operating model is openly a joint one.",
    de: "Beide Zeichen erscheinen, getrennt durch eine Haarlinie, das Institut zuerst. Verwendet, wo das Betriebsmodell offen gemeinsam ist.",
  },
};

export function isBrandMode(value: unknown): value is BrandMode {
  return typeof value === "string" && (BRAND_MODES as readonly string[]).includes(value);
}

/* ==========================================================================
   Pure resolution
   ========================================================================== */

/** Narrows a database row into the profile shape, dropping empty strings. */
export function resolveBrandProfile(row: BrandProfileRow): BrandProfile {
  /*
   * SQLite gives back null for an unset text column, and the brief's shape
   * uses optional properties. Normalising here means no consumer has to handle
   * both the null and the undefined case, which is where "Support: null"
   * rendered into a footer comes from.
   */
  const optional = (value: string | null): string | undefined =>
    value !== null && value.trim().length > 0 ? value : undefined;

  return {
    id: row.id,
    mode: row.mode,
    productName: row.productName,
    shortName: row.shortName,
    clientName: row.clientName,
    operatorName: optional(row.operatorName),
    primaryLogoUrl: optional(row.primaryLogoUrl),
    secondaryLogoUrl: optional(row.secondaryLogoUrl),
    faviconUrl: optional(row.faviconUrl),
    supportLabel: optional(row.supportLabel),
    supportUrl: optional(row.supportUrl),
    legalNotice: optional(row.legalNotice),
    accentToken: optional(row.accentToken),
    syntheticDisclosure: row.syntheticDisclosure,
  };
}

/**
 * Decides which marks a surface shows.
 *
 * A profile may name two logo files regardless of mode, because an operator
 * switching from client to co-branded should not have to re-upload anything.
 * The mode decides which of them are shown, so switching mode is one row
 * update and the marks follow.
 */
function resolveMarks(brand: BrandProfile): BrandMark[] {
  const clientMark: BrandMark | null = brand.primaryLogoUrl
    ? { src: brand.primaryLogoUrl, alt: brand.clientName, owner: "client" }
    : null;
  const operatorMark: BrandMark | null = brand.secondaryLogoUrl
    ? {
        src: brand.secondaryLogoUrl,
        alt: brand.operatorName ?? brand.productName,
        owner: "operator",
      }
    : null;

  switch (brand.mode) {
    case "client":
      return clientMark ? [clientMark] : [];
    case "accenture":
      /*
       * In operator mode the single mark is the operator's. A profile written
       * for this mode puts the operator file in `primaryLogoUrl`, so the
       * primary slot is used and relabelled rather than requiring the caller
       * to know which column holds which organisation.
       */
      return clientMark
        ? [{ ...clientMark, alt: brand.operatorName ?? brand.productName, owner: "operator" }]
        : [];
    case "co-branded":
      return [clientMark, operatorMark].filter((mark): mark is BrandMark => mark !== null);
  }
}

/** The resolved identity a shell surface consumes. */
export function resolveBrandIdentity(brand: BrandProfile): BrandIdentity {
  const marks = resolveMarks(brand);
  return {
    brandProfileId: brand.id,
    mode: brand.mode,
    productName: brand.productName,
    shortName: brand.shortName,
    clientName: brand.clientName,
    operatorName: brand.mode === "client" ? null : (brand.operatorName ?? null),
    attribution:
      brand.mode === "accenture"
        ? (brand.operatorName ?? brand.productName)
        : brand.clientName,
    marks,
    showPair: brand.mode === "co-branded" && marks.length === 2,
    supportLabel: brand.supportLabel ?? null,
    supportUrl: brand.supportUrl ?? null,
    legalNotice: brand.legalNotice ?? null,
    /*
     * The accent falls back to the AI accent rather than to a hardcoded colour
     * value. Every colour in this product is a custom property, and a profile
     * that forgot to set one should inherit the palette, not escape it.
     */
    accentToken: brand.accentToken ?? "--app-ai",
    faviconUrl: brand.faviconUrl ?? null,
    syntheticDisclosure: brand.syntheticDisclosure,
  };
}

/**
 * The profile used before the product tables are seeded.
 *
 * Deliberately names no institution. A fallback that said "Arcadia Banking
 * Group" would make an unseeded deployment look configured for a bank it has
 * never heard of.
 */
export const FALLBACK_BRAND_PROFILE: BrandProfile = {
  id: "brand-unconfigured",
  mode: "client",
  /* The product name comes from the release registry, as in the seeded profiles. */
  productName: PRODUCT_IDENTITY.name,
  shortName: PRODUCT_IDENTITY.name,
  clientName: "Not configured",
  syntheticDisclosure: true,
};

/* ==========================================================================
   Database reads
   ========================================================================== */

const brandSlot = createConfigCacheSlot<BrandProfile | null>();

/**
 * Resolves the active brand profile.
 *
 * The override on the singleton wins over the organisation profile's pointer.
 * That is what makes a branding switch a one row update: the administrator
 * changes which brand is active without editing the organisation, so nothing
 * about the institution, its entities or its locales is touched by a
 * presentation change.
 */
export function resolveActiveBrandProfile(): BrandProfile | null {
  return readThroughConfigCache(brandSlot, (pointer) => {
    /*
     * The organisation lookup is taken from its own cache rather than passed
     * in, so there is exactly one answer to "which brand is active" no matter
     * which module asks. An earlier shape took the identifier as an argument
     * and the cache key did not include it, which would have returned the
     * wrong profile to the second caller.
     */
    const id = pointer?.brandProfileIdOverride ?? resolveOrganisationProfile()?.brandProfileId;
    if (!id) return null;
    try {
      const row = getDb().select().from(brandProfiles).where(eq(brandProfiles.id, id)).get();
      return row ? resolveBrandProfile(row) : null;
    } catch {
      return null;
    }
  });
}

/** Every defined brand profile, for the branding settings screen. */
export function listBrandProfiles(): BrandProfile[] {
  try {
    const rows = getDb().select().from(brandProfiles).all();
    const order: Record<BrandMode, number> = { client: 0, "co-branded": 1, accenture: 2 };
    return rows
      .map(resolveBrandProfile)
      .sort((a, b) => order[a.mode] - order[b.mode] || a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}
