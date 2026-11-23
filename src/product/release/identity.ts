/**
 * The product identity.
 *
 * A leaf module on purpose: no imports at all. Label files, shells and
 * fallbacks that only need the product name import it from here without
 * pulling the rest of the release registry, the Role App catalogue or the
 * router contracts into their bundle. `product-release.ts` re-exports it, so
 * `@/product/release` remains the one import surface for everything else.
 */

export interface ProductIdentity {
  /** The product name. One name, everywhere. */
  name: string;
  /** What the name stands for, for a first line under the wordmark. */
  descriptor: { en: string; de: string };
  /** The one line proposition. */
  tagline: { en: string; de: string };
}

export const PRODUCT_IDENTITY: ProductIdentity = {
  name: "NFR Workspace",
  descriptor: { en: "Non-financial risk workspace", de: "Arbeitsbereich fuer nicht-finanzielle Risiken" },
  tagline: {
    en: "One workspace for non-financial risk. The work arrives prepared, professionals decide, and the systems of record are updated through governed steps.",
    de: "Ein Arbeitsbereich fuer nicht-finanzielle Risiken. Die Arbeit kommt vorbereitet an, Fachleute entscheiden, und die fuehrenden Systeme werden ueber gesteuerte Schritte aktualisiert.",
  },
};
