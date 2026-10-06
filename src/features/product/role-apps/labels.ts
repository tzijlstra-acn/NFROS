/**
 * Words for Role App release state, in both languages.
 *
 * The eight lifecycle states of plan 7.2, the support states and the history
 * event kinds, as the data model stores them (`src/db/schema/product-console.ts`).
 * Release facts, not readings of a system, so they render as plain chips, not
 * as status badges (the same distinction `ReleasePanel` makes).
 *
 * Pure and client safe.
 */

import type {
  RoleAppEventKind,
  RoleAppLifecycleState,
  RoleAppSupportState,
} from "@/db/schema/product-console";
import type { Bilingual } from "../permissions";

export const LIFECYCLE_STATE_LABELS: Record<RoleAppLifecycleState, Bilingual> = {
  draft: { en: "Draft", de: "Entwurf" },
  candidate: { en: "Candidate", de: "Kandidat" },
  pilot: { en: "Pilot", de: "Pilot" },
  installed: { en: "Installed", de: "Installiert" },
  available: { en: "Available", de: "Verfuegbar" },
  demo: { en: "Demo", de: "Demo" },
  planned: { en: "Planned", de: "Geplant" },
  retired: { en: "Retired", de: "Ausser Betrieb" },
};

/** What each lifecycle state means, one line, for a title and the legend. */
export const LIFECYCLE_STATE_MEANINGS: Record<RoleAppLifecycleState, Bilingual> = {
  draft: { en: "Being prepared; not visible outside the console.", de: "In Vorbereitung; ausserhalb der Konsole nicht sichtbar." },
  candidate: { en: "A reviewed version that can be evaluated and compared.", de: "Eine gepruefte Version, die evaluiert und verglichen werden kann." },
  pilot: { en: "Enabled for a pilot cohort only.", de: "Nur fuer eine Pilotkohorte freigeschaltet." },
  installed: { en: "Live in the workday for its role.", de: "Im Arbeitstag der Rolle in Betrieb." },
  available: { en: "Packaged and licensed, not provisioned to this tenant.", de: "Paketiert und lizenziert, fuer diesen Mandanten nicht bereitgestellt." },
  demo: { en: "Can be shown, not run: a prototype in the catalogue.", de: "Kann gezeigt, nicht ausgefuehrt werden: ein Prototyp im Katalog." },
  planned: { en: "On the roadmap, not built: a concept in the catalogue.", de: "Auf der Roadmap, nicht gebaut: ein Konzept im Katalog." },
  retired: { en: "Withdrawn; kept for the record.", de: "Zurueckgezogen; fuer die Nachvollziehbarkeit erhalten." },
};

export const SUPPORT_STATE_LABELS: Record<RoleAppSupportState, Bilingual> = {
  maintained: { en: "Maintained", de: "Gepflegt" },
  "demonstration-only": { en: "Demonstration only", de: "Nur Demonstration" },
  "not-built": { en: "Not built", de: "Nicht gebaut" },
  ended: { en: "Support ended", de: "Support beendet" },
};

export const EVENT_KIND_LABELS: Record<RoleAppEventKind, Bilingual> = {
  registered: { en: "Registered", de: "Erfasst" },
  "state-changed": { en: "State changed", de: "Zustand geaendert" },
  enabled: { en: "Enabled", de: "Freigeschaltet" },
  disabled: { en: "Disabled", de: "Gesperrt" },
  "cohort-assigned": { en: "Cohort assigned", de: "Kohorte zugewiesen" },
  "rolled-back": { en: "Rolled back", de: "Zurueckgesetzt" },
};

export const AVAILABILITY_LABELS = {
  enabled: { en: "Enabled", de: "Freigeschaltet" },
  disabled: { en: "Disabled", de: "Gesperrt" },
  retired: { en: "Retired", de: "Ausser Betrieb" },
  "not-installed": { en: "Not runnable", de: "Nicht ausfuehrbar" },
} as const satisfies Record<string, Bilingual>;
