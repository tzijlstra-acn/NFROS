/**
 * The product status vocabulary.
 *
 * Eight words, and every status the product shows about itself is one of
 * them. The list is the one in the product principles ("truth before
 * theatre"): a reader should be able to tell, from the word alone, whether a
 * value was checked, whether it is synthetic, whether the AI is answering from
 * a reviewed cache or a live provider, and whether anything is there at all.
 *
 *   Empty         the source works and holds nothing yet
 *   Unavailable   the source or capability cannot be used here
 *   Simulated     synthetic data through the real contract
 *   Safe          AI answers critical steps from reviewed, cached responses
 *   Offline       no AI provider is called at all
 *   Live          connected to a real provider or system
 *   Verified      a check ran just now, against real data, and passed
 *   Not verified  nothing checked it, or the check failed
 *
 * "Verified" is the expensive word. It is only ever returned by a function
 * that ran a check, and the absence of a check is "Not verified", never a
 * hopeful default. `sources.ts` holds those functions; this module is the
 * vocabulary and the pure mappings onto it.
 *
 * Pure. No database, no environment, no React, so a client component, a
 * script and a test can all import it.
 */

import type { Language } from "@/i18n/labels";

export const PRODUCT_STATUSES = [
  "empty",
  "unavailable",
  "simulated",
  "safe",
  "offline",
  "live",
  "verified",
  "not-verified",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * The tone a status renders in.
 *
 * Matches the `data-tone` values of the V3.3 `wd-chip`, so the badge needs no
 * stylesheet of its own. `neutral` renders the chip without a tone.
 */
export type StatusTone = "neutral" | "accent" | "info" | "success" | "warning" | "danger";

export interface ProductStatusDefinition {
  id: ProductStatus;
  label: { en: string; de: string };
  tone: StatusTone;
  /** One line, for a tooltip, a legend or a screen reader. */
  meaning: { en: string; de: string };
}

export const PRODUCT_STATUS: Record<ProductStatus, ProductStatusDefinition> = {
  empty: {
    id: "empty",
    label: { en: "Empty", de: "Leer" },
    tone: "neutral",
    meaning: {
      en: "The source works and holds no records yet.",
      de: "Die Quelle funktioniert und enthaelt noch keine Datensaetze.",
    },
  },
  unavailable: {
    id: "unavailable",
    label: { en: "Unavailable", de: "Nicht verfuegbar" },
    tone: "warning",
    meaning: {
      en: "The source or capability cannot be used here, so nothing is shown in its place.",
      de: "Die Quelle oder Funktion ist hier nicht nutzbar, daher wird nichts an ihrer Stelle gezeigt.",
    },
  },
  simulated: {
    id: "simulated",
    label: { en: "Simulated", de: "Simuliert" },
    tone: "info",
    meaning: {
      en: "Produced from the synthetic institution through the real contract, not from a client system.",
      de: "Aus der synthetischen Institution ueber den echten Vertrag erzeugt, nicht aus einem Kundensystem.",
    },
  },
  safe: {
    id: "safe",
    label: { en: "Safe", de: "Sicher" },
    tone: "accent",
    meaning: {
      en: "Critical AI steps come from reviewed, cached responses. A live provider answers only optional questions, and only when one is configured.",
      de: "Kritische KI-Schritte stammen aus geprueften, zwischengespeicherten Antworten. Ein Live-Anbieter beantwortet nur optionale Fragen und nur, wenn einer konfiguriert ist.",
    },
  },
  offline: {
    id: "offline",
    label: { en: "Offline", de: "Offline" },
    tone: "neutral",
    meaning: {
      en: "No AI provider is called. Every response comes from seeded content.",
      de: "Es wird kein KI-Anbieter aufgerufen. Jede Antwort stammt aus eingespielten Inhalten.",
    },
  },
  live: {
    id: "live",
    label: { en: "Live", de: "Live" },
    tone: "accent",
    meaning: {
      en: "Connected to a real provider or system and reading its responses.",
      de: "Mit einem echten Anbieter oder System verbunden und liest dessen Antworten.",
    },
  },
  verified: {
    id: "verified",
    label: { en: "Verified", de: "Verifiziert" },
    tone: "success",
    meaning: {
      en: "A check ran against real data and passed.",
      de: "Eine Pruefung lief gegen echte Daten und war erfolgreich.",
    },
  },
  "not-verified": {
    id: "not-verified",
    label: { en: "Not verified", de: "Nicht verifiziert" },
    tone: "warning",
    meaning: {
      en: "No check has confirmed this, or the check did not pass.",
      de: "Keine Pruefung hat dies bestaetigt, oder die Pruefung war nicht erfolgreich.",
    },
  },
};

export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && (PRODUCT_STATUSES as readonly string[]).includes(value);
}

export function statusLabel(status: ProductStatus, language: Language): string {
  const entry = PRODUCT_STATUS[status];
  return language === "de" ? entry.label.de : entry.label.en;
}

export function statusMeaning(status: ProductStatus, language: Language): string {
  const entry = PRODUCT_STATUS[status];
  return language === "de" ? entry.meaning.de : entry.meaning.en;
}

/* ==========================================================================
   A status with its evidence
   ========================================================================== */

/**
 * A status plus the sentence that justifies it.
 *
 * The word alone is not enough on an administrator screen: "Not verified"
 * because no call was attempted and "Not verified" because the call was
 * rejected need different responses. Every computed status carries its
 * reason, in both languages, built from the data that produced it.
 */
export interface StatusReading {
  status: ProductStatus;
  detail: { en: string; de: string };
}

export function reading(status: ProductStatus, en: string, de: string): StatusReading {
  return { status, detail: { en, de } };
}

/* ==========================================================================
   Pure mappings onto the vocabulary
   ========================================================================== */

/**
 * The AI mode, as a status.
 *
 * The three demo modes are three of the eight words, by design.
 */
export function statusForAiMode(mode: "live" | "safe" | "offline"): ProductStatus {
  return mode;
}

/**
 * A connector readiness mode, as a status.
 *
 * The connector mode says what is built. The status says what is true of the
 * data it supplies, which is the question an administrator is asking:
 *
 *   live                    Live
 *   simulated               Simulated
 *   sandbox-ready           Not verified: the adapter exists, no tenant has
 *                           confirmed it
 *   configured-unavailable  Unavailable
 *   planned                 Unavailable: every operation is refused
 */
export function statusForConnectorMode(
  mode: "live" | "sandbox-ready" | "simulated" | "configured-unavailable" | "planned",
): ProductStatus {
  switch (mode) {
    case "live":
      return "live";
    case "simulated":
      return "simulated";
    case "sandbox-ready":
      return "not-verified";
    case "configured-unavailable":
    case "planned":
      return "unavailable";
  }
}

/**
 * An audit chain verification result, as a status.
 *
 * `valid` is Verified because `verifyChain` recomputed every hash on this
 * request. `broken` is Not verified, and the caller shows the failing
 * sequence beside it.
 */
export function statusForAuditChain(result: "valid" | "broken" | "empty"): ProductStatus {
  switch (result) {
    case "valid":
      return "verified";
    case "broken":
      return "not-verified";
    case "empty":
      return "empty";
  }
}

/**
 * A health component status, as a status.
 *
 * `healthy` maps to Verified only because every health check that returns it
 * performed a real probe. `not-configured` is Unavailable rather than a
 * softer word: the component cannot be used here.
 */
export function statusForHealth(
  status: "healthy" | "degraded" | "unavailable" | "not-configured" | "not-verified",
): ProductStatus {
  switch (status) {
    case "healthy":
      return "verified";
    case "degraded":
    case "not-verified":
      return "not-verified";
    case "unavailable":
    case "not-configured":
      return "unavailable";
  }
}

/**
 * The overall status of a set of readings.
 *
 * Verified only when every reading is Verified. Unavailable when any reading
 * is Unavailable. Otherwise Not verified. This is deliberately stricter than
 * the health endpoint's own roll up, which reports healthy while the worker is
 * unchecked: a summary must not be more confident than its least confident
 * part.
 */
export function overallStatus(statuses: readonly ProductStatus[]): ProductStatus {
  if (statuses.length === 0) return "empty";
  if (statuses.some((status) => status === "unavailable")) return "unavailable";
  if (statuses.every((status) => status === "verified")) return "verified";
  return "not-verified";
}
