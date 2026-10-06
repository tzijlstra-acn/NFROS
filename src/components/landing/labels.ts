/**
 * Landing page copy, English and German.
 *
 * The proposition is fixed by the product plan (section 4.1): the headline,
 * the supporting line, the three actions and the four trust words. The
 * product name and descriptor come from the product identity in the release
 * registry, and everything the page says about the roles is read from that
 * registry and the scenario database, so nothing here describes product state.
 *
 * German is ASCII transliterated, as everywhere else in the codebase.
 */

import type { Language } from "@/i18n/labels";
import { PRODUCT_IDENTITY } from "@/product/release";

interface Pair {
  en: string;
  de: string;
}

export function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export const LANDING_COPY = {
  synthetic: { en: "Synthetic institution and data", de: "Synthetische Institution und Daten" },

  headline: {
    en: "Run NFR work from one governed environment",
    de: "NFR-Arbeit aus einer kontrollierten Umgebung steuern",
  },
  /* `{product}` is the registry's product name, so the line cannot drift from the wordmark. */
  supporting: {
    en: "{product} prepares the work, runs complete risk processes and keeps material decisions with people",
    de: "{product} bereitet die Arbeit vor, fuehrt vollstaendige Risikoprozesse durch und belaesst wesentliche Entscheidungen bei Menschen",
  },

  explore: { en: "Explore the product", de: "Produkt erkunden" },
  presentation: { en: "View the presentation", de: "Praesentation ansehen" },
  designPartner: { en: "Enter design-partner workspace", de: "Design-Partner-Arbeitsbereich oeffnen" },
  designPartnerUnavailable: {
    en: "Not available in this release",
    de: "In diesem Release nicht verfuegbar",
  },

  proofLabel: { en: "In the product now", de: "Jetzt im Produkt" },
  proofSource: { en: "Synthetic scenario, {date}, {moment}", de: "Synthetisches Szenario, {date}, {moment}" },
  proofUnavailable: {
    en: "Unavailable: the scenario has not been seeded",
    de: "Nicht verfuegbar: das Szenario wurde nicht geladen",
  },
  proofEmpty: {
    en: "No role is marked Available in the release registry",
    de: "Im Release-Verzeichnis ist keine Rolle als verfuegbar markiert",
  },
  osSuffix: { en: "OS", de: "OS" },
  open: { en: "Open", de: "Oeffnen" },

  trustLabel: { en: "How the product works", de: "Wie das Produkt arbeitet" },

  disclosure: {
    en: "Arcadia Banking Group is a synthetic institution. Every person, supplier and record shown is invented for the demonstration. Illustrative regulatory context, not legal advice.",
    de: "Die Arcadia Banking Group ist eine synthetische Institution. Alle gezeigten Personen, Lieferanten und Datensaetze sind fuer die Demonstration erfunden. Illustrativer regulatorischer Kontext, keine Rechtsberatung.",
  },
  presenters: { en: "For presenters:", de: "Fuer Praesentierende:" },
  controlRoom: { en: "Control room", de: "Kontrollraum" },
} as const satisfies Record<string, Pair>;

/**
 * The trust strip. Exactly these four, in this order.
 *
 * Each is a property the product already enforces (citations, the approval
 * gate, receipts and audit) or a disclosure it owes (synthetic data). None is
 * a compliance claim.
 */
export const TRUST_ITEMS: readonly Pair[] = [
  { en: "Evidence-linked", de: "Mit Nachweisen verknuepft" },
  { en: "Human-approved", de: "Von Menschen genehmigt" },
  { en: "Audit-ready", de: "Pruefbereit" },
  { en: "Synthetic demonstration", de: "Synthetische Demonstration" },
];

/** The product name and its descriptor, from the registry's product identity. */
export const PRODUCT_NAME = PRODUCT_IDENTITY.name;
export const PRODUCT_DESCRIPTOR: Pair = PRODUCT_IDENTITY.descriptor;

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
