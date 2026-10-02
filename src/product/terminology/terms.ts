/**
 * Terminology resolution.
 *
 * A bank that calls a finding an observation gets the word "observation"
 * everywhere the product names that concept, and nowhere else.
 *
 * Why this is a typed key map and not a string replacement pass, stated here
 * because the shortcut is tempting and the damage is not obvious: a global
 * replacement of "finding" with "observation" would also rewrite the word
 * inside the seeded evidence corpus, the audit trail summaries and the quoted
 * passages of a supplier attestation. The product would then be showing a
 * source document that says something the source document does not say. That
 * is not a cosmetic bug, it is a misrepresentation of evidence, and in a
 * product whose central claim is that every statement is traceable to a cited
 * source it is the worst available failure. Terminology therefore applies only
 * where the product itself names a concept: labels, headings, chips, empty
 * states and generated summaries. Quoted content is never touched.
 *
 * Keys are typed, so a profile missing a term is a compile error in the
 * default map rather than a raw key rendered to a client.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  TERMINOLOGY_KEYS,
  terminologyProfiles,
  type TerminologyKey,
  type TerminologyTerm,
} from "@/db/schema/product";
import type { Language } from "@/i18n/labels";
import {
  createConfigCacheSlot,
  readThroughConfigCache,
  resolveOrganisationProfile,
} from "../organisation/profile";

/** A profile after merging with the defaults: every key is present. */
export interface TerminologyProfile {
  id: string;
  name: string;
  description: string;
  terms: Record<TerminologyKey, TerminologyTerm>;
}

export interface TermOptions {
  plural?: boolean;
  /** Prefers the short form where the profile defines one. */
  short?: boolean;
}

export const DEFAULT_TERMINOLOGY_PROFILE_ID = "terminology-dach-default";

/* ==========================================================================
   The default vocabulary
   ========================================================================== */

/**
 * Plain DACH banking vocabulary.
 *
 * German is written in ASCII transliteration, "ae", "oe", "ue" and "ss", to
 * match the rest of the codebase. The reason is recorded in
 * docs/ASSUMPTIONS.md: an encoding accident in seeded content is silent, and a
 * corrupted umlaut in a term that appears on every screen would be noticed
 * late and in front of a client.
 *
 * The plural of a German compound is not formed by adding "s", which is why
 * every term carries its plural explicitly rather than being derived.
 */
export const DEFAULT_TERMINOLOGY_TERMS: Record<TerminologyKey, TerminologyTerm> = {
  riskAssessment: {
    singular: "Risk assessment",
    plural: "Risk assessments",
    singularDe: "Risikobeurteilung",
    pluralDe: "Risikobeurteilungen",
  },
  rcsa: {
    singular: "RCSA",
    plural: "RCSAs",
    singularDe: "RCSA",
    pluralDe: "RCSAs",
    short: "RCSA",
  },
  control: {
    singular: "Control",
    plural: "Controls",
    singularDe: "Kontrolle",
    pluralDe: "Kontrollen",
  },
  controlOwner: {
    singular: "Control owner",
    plural: "Control owners",
    singularDe: "Kontrollverantwortlicher",
    pluralDe: "Kontrollverantwortliche",
  },
  issue: {
    singular: "Issue",
    plural: "Issues",
    singularDe: "Mangel",
    pluralDe: "Maengel",
  },
  finding: {
    singular: "Finding",
    plural: "Findings",
    singularDe: "Feststellung",
    pluralDe: "Feststellungen",
  },
  action: {
    singular: "Action",
    plural: "Actions",
    singularDe: "Massnahme",
    pluralDe: "Massnahmen",
  },
  remediation: {
    singular: "Remediation",
    plural: "Remediations",
    singularDe: "Behebung",
    pluralDe: "Behebungen",
  },
  incident: {
    singular: "Incident",
    plural: "Incidents",
    singularDe: "Vorfall",
    pluralDe: "Vorfaelle",
  },
  event: {
    singular: "Event",
    plural: "Events",
    singularDe: "Ereignis",
    pluralDe: "Ereignisse",
  },
  criticalService: {
    singular: "Critical service",
    plural: "Critical services",
    singularDe: "Kritische Dienstleistung",
    pluralDe: "Kritische Dienstleistungen",
  },
  importantBusinessService: {
    singular: "Important business service",
    plural: "Important business services",
    singularDe: "Wichtige Geschaeftsdienstleistung",
    pluralDe: "Wichtige Geschaeftsdienstleistungen",
    short: "IBS",
  },
  riskAcceptance: {
    singular: "Risk acceptance",
    plural: "Risk acceptances",
    singularDe: "Risikoakzeptanz",
    pluralDe: "Risikoakzeptanzen",
  },
  firstLine: {
    singular: "First line of defence",
    plural: "First lines of defence",
    singularDe: "Erste Verteidigungslinie",
    pluralDe: "Erste Verteidigungslinien",
    short: "1LoD",
  },
  secondLine: {
    singular: "Second line of defence",
    plural: "Second lines of defence",
    singularDe: "Zweite Verteidigungslinie",
    pluralDe: "Zweite Verteidigungslinien",
    short: "2LoD",
  },
};

export const ALTERNATE_TERMINOLOGY_PROFILE_ID = "terminology-observation-led";

/**
 * A second profile that exists to prove the mechanism.
 *
 * Every override here is a real variation seen across DACH institutions: some
 * use "observation" for a second line conclusion and reserve "finding" for
 * internal audit, some spell out the self assessment rather than using the
 * acronym, and some say "deficiency" where others say "issue". A profile that
 * only renamed one noun would not demonstrate that the mechanism reaches the
 * places that matter.
 */
export const ALTERNATE_TERMINOLOGY_OVERRIDES: Partial<Record<TerminologyKey, TerminologyTerm>> = {
  finding: {
    singular: "Observation",
    plural: "Observations",
    singularDe: "Beobachtung",
    pluralDe: "Beobachtungen",
  },
  rcsa: {
    singular: "Risk and control self assessment",
    plural: "Risk and control self assessments",
    singularDe: "Risiko- und Kontroll-Selbstbeurteilung",
    pluralDe: "Risiko- und Kontroll-Selbstbeurteilungen",
    short: "RKSB",
  },
  issue: {
    singular: "Deficiency",
    plural: "Deficiencies",
    singularDe: "Schwachstelle",
    pluralDe: "Schwachstellen",
  },
  action: {
    singular: "Measure",
    plural: "Measures",
    singularDe: "Massnahme",
    pluralDe: "Massnahmen",
  },
  riskAssessment: {
    singular: "Risk appraisal",
    plural: "Risk appraisals",
    singularDe: "Risikoeinschaetzung",
    pluralDe: "Risikoeinschaetzungen",
  },
};

/* ==========================================================================
   Pure lookup
   ========================================================================== */

/**
 * Fills every key from the defaults, then applies the profile's overrides.
 *
 * A stored profile holds only what it changes. That keeps a client
 * configuration to the five rows it actually cares about, and it means adding
 * a sixteenth terminology key does not silently leave every existing profile
 * with a gap.
 */
export function mergeTerms(
  overrides: Partial<Record<TerminologyKey, TerminologyTerm>> | null | undefined,
): Record<TerminologyKey, TerminologyTerm> {
  const merged = {} as Record<TerminologyKey, TerminologyTerm>;
  for (const key of TERMINOLOGY_KEYS) {
    const fallback = DEFAULT_TERMINOLOGY_TERMS[key];
    const override = overrides?.[key];
    merged[key] = override ?? fallback;
  }
  return merged;
}

/** Looks a term up in an already merged map. Pure, so it is directly testable. */
export function termFrom(
  terms: Record<TerminologyKey, TerminologyTerm>,
  key: TerminologyKey,
  language: Language,
  options: TermOptions = {},
): string {
  const entry = terms[key];
  /*
   * The short form is English only. A profile that supplies a German short
   * form would supply it in `short`, and there is no second column for it, so
   * offering the short form in German would mean showing an English acronym
   * inside German copy without saying so. Falling through to the full German
   * term is the honest behaviour.
   */
  if (options.short && entry.short && language === "en") return entry.short;
  if (language === "de") return options.plural ? entry.pluralDe : entry.singularDe;
  return options.plural ? entry.plural : entry.singular;
}

/** The profile used before the product tables are seeded. */
export const FALLBACK_TERMINOLOGY_PROFILE: TerminologyProfile = {
  id: DEFAULT_TERMINOLOGY_PROFILE_ID,
  name: "DACH banking default",
  description: "The built in vocabulary. Active until a profile is configured.",
  terms: mergeTerms(null),
};

/* ==========================================================================
   Database reads
   ========================================================================== */

const terminologySlot = createConfigCacheSlot<TerminologyProfile>();

/** Resolves the terminology profile named by the active organisation profile. */
export function resolveTerminologyProfile(): TerminologyProfile {
  return readThroughConfigCache(terminologySlot, () => {
    const organisation = resolveOrganisationProfile();
    if (!organisation) return FALLBACK_TERMINOLOGY_PROFILE;
    try {
      const row = getDb()
        .select()
        .from(terminologyProfiles)
        .where(eq(terminologyProfiles.id, organisation.terminologyProfileId))
        .get();
      if (!row) return FALLBACK_TERMINOLOGY_PROFILE;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        terms: mergeTerms(row.terms),
      };
    } catch {
      return FALLBACK_TERMINOLOGY_PROFILE;
    }
  });
}

/**
 * The product's term for a concept.
 *
 * The signature every screen uses. It resolves the active profile through the
 * version keyed cache, so calling it per row costs one map lookup.
 */
export function term(key: TerminologyKey, language: Language, options: TermOptions = {}): string {
  return termFrom(resolveTerminologyProfile().terms, key, language, options);
}

/** Every defined terminology profile, for the organisation settings screen. */
export function listTerminologyProfiles(): TerminologyProfile[] {
  try {
    return getDb()
      .select()
      .from(terminologyProfiles)
      .all()
      .map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        terms: mergeTerms(row.terms),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

/** Which keys a profile actually overrides. Shown beside the profile name. */
export function overriddenKeys(profile: TerminologyProfile): TerminologyKey[] {
  return TERMINOLOGY_KEYS.filter(
    (key) => profile.terms[key].singular !== DEFAULT_TERMINOLOGY_TERMS[key].singular,
  );
}
