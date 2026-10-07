/**
 * The product release registry.
 *
 * One typed answer to "what is this product, which release is it, and what
 * does it honestly contain". Every surface that prints a version, a release
 * name, a role release state, an installed Role App or a known limitation
 * reads it from here: `/ops`, the settings area, the landing page, the README
 * release block and the CHANGELOG top entry. A unit test
 * (`tests/unit/product-release.test.ts`) fails when package.json, the
 * CHANGELOG or the README disagree with this module.
 *
 * Three kinds of version live in this product, and they were being confused:
 *
 *   product release     semantic version of the whole product, for example
 *                       4.1.0. This is the number package.json carries and
 *                       the CHANGELOG is ordered by.
 *   workday interface   the analyst interface generation, V3.3. Read from
 *                       `CURRENT_WORKDAY_UI`, which is what the router serves.
 *   presentation        the released deck, V2.4. Read from `DECK_VERSION`,
 *                       which is what the export pipeline stamps.
 *
 * The two named components are not duplicated here. They are read from the
 * constant that actually decides them, so the registry cannot claim a
 * workday interface the router does not serve. Role release states are read
 * from `role-release.ts` and Role Apps from `src/role-apps/registry.ts` for
 * the same reason: one source each, and this module only arranges them.
 *
 * Pure data and pure functions. No database, no React, no server imports, so
 * it is safe in a client component, a server component, a script and a test.
 */

import { CURRENT_WORKDAY_UI } from "@/workday/contracts";
import { DECK_NAME, DECK_VERSION } from "@/presentation-v2-4/export/types";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";
import type { RoleAppMaturity, RoleAppStatus } from "@/role-apps/contracts";
import {
  ROLE_RELEASE_DEFINITIONS,
  type RoleReleaseDefinition,
  type RoleReleaseStatus,
} from "./role-release";
import { PRODUCT_IDENTITY, type ProductIdentity } from "./identity";

/** An English and German pair, the shape every bilingual label here uses. */
export interface Bilingual {
  en: string;
  de: string;
}

/* ==========================================================================
   Product identity
   ========================================================================== */

/*
 * Defined in the leaf module `identity.ts`, so that a label file can import the
 * name without the rest of this registry. Re-exported here unchanged.
 */
export { PRODUCT_IDENTITY };
export type { ProductIdentity };

/* ==========================================================================
   Product release
   ========================================================================== */

/**
 * Where the release is in its life.
 *
 * `candidate` while the workstreams of a release are still landing, and
 * `released` once its exit criteria are met. The release manager flips it;
 * nothing infers it, because a stage that changed itself would be exactly the
 * kind of asserted status this registry exists to remove.
 */
export type ReleaseStage = "candidate" | "released";

export const RELEASE_STAGE_LABELS: Record<ReleaseStage, Bilingual> = {
  candidate: { en: "Release candidate", de: "Release-Kandidat" },
  released: { en: "Released", de: "Freigegeben" },
};

export interface ProductRelease {
  /** Semantic version. package.json and the CHANGELOG top entry must match. */
  version: string;
  /** ISO date of the CHANGELOG entry, YYYY-MM-DD. */
  date: string;
  name: Bilingual;
  stage: ReleaseStage;
  summary: Bilingual;
}

/**
 * The current product release.
 *
 * 4.1.0, because the previous product release was 4.0.0, the Design Partner
 * Release, and this one adds a registry, a status vocabulary and honest status
 * computation without changing the database schema, a route or a public
 * contract. That is a minor version by any semantic versioning reading. The
 * 2.x numbers that once sat above 4.0.0 in the CHANGELOG were presentation
 * releases, which now live under their own heading and their own V labels.
 */
export const PRODUCT_RELEASE: ProductRelease = {
  version: "4.1.0",
  date: "2026-10-05",
  name: {
    en: "Product truth and release coherence",
    de: "Produktwahrheit und stimmiges Release",
  },
  stage: "candidate",
  summary: {
    en: "One product identity, one release registry and one status vocabulary. Versions, role release states, Role Apps, connector modes, AI modes, evaluation status, readiness and audit integrity are read from data or marked Not verified.",
    de: "Eine Produktidentitaet, ein Release-Verzeichnis und ein Statusvokabular. Versionen, Rollenstatus, Rollen-Apps, Konnektormodi, KI-Modi, Evaluationsstatus, Bereitschaft und Audit-Integritaet werden aus Daten gelesen oder als Nicht verifiziert ausgewiesen.",
  },
};

/* ==========================================================================
   Named components
   ========================================================================== */

export type ReleaseComponentId = "workday-interface" | "presentation";

export interface ReleaseComponent {
  id: ReleaseComponentId;
  name: Bilingual;
  /** Display label, for example "V3.3". */
  version: string;
  /** The constant the label is read from, so a reader can check it. */
  source: string;
  /** Where the component is reached. */
  route: string;
}

/**
 * "v3.3" to "V3.3".
 *
 * The router and the export pipeline use lower case identifiers because they
 * appear in query strings and file names. People read an upper case V.
 */
export function formatComponentVersion(identifier: string): string {
  const trimmed = identifier.trim();
  return /^v\d/i.test(trimmed) ? `V${trimmed.slice(1)}` : trimmed;
}

export const RELEASE_COMPONENTS: readonly ReleaseComponent[] = [
  {
    id: "workday-interface",
    name: { en: "Workday interface", de: "Arbeitsoberflaeche" },
    version: formatComponentVersion(CURRENT_WORKDAY_UI),
    source: "CURRENT_WORKDAY_UI in src/workday/contracts.ts",
    route: "/workday",
  },
  {
    id: "presentation",
    name: { en: DECK_NAME, de: "NFROS Praesentation fuer Risikoverantwortliche" },
    version: formatComponentVersion(DECK_VERSION),
    source: "DECK_VERSION in src/presentation-v2-4/export/types.ts",
    route: "/story",
  },
];

export function getReleaseComponent(id: ReleaseComponentId): ReleaseComponent {
  const component = RELEASE_COMPONENTS.find((entry) => entry.id === id);
  /*
   * The list above is a literal with both ids, so this cannot miss. The throw
   * is for the case where somebody removes an entry and keeps a caller.
   */
  if (!component) throw new Error(`Unknown release component: ${id}`);
  return component;
}

/* ==========================================================================
   Role release states
   ========================================================================== */

export const ROLE_RELEASE_STATUS_ORDER: readonly RoleReleaseStatus[] = [
  "available",
  "demo",
  "planned",
];

export const ROLE_RELEASE_STATUS_LABELS: Record<RoleReleaseStatus, Bilingual> = {
  available: { en: "Available", de: "Verfuegbar" },
  demo: { en: "Demo", de: "Demo" },
  planned: { en: "Planned", de: "Geplant" },
  hidden: { en: "Hidden", de: "Ausgeblendet" },
};

/** Roles in one release state, in registry order. */
export function rolesWithReleaseStatus(status: RoleReleaseStatus): RoleReleaseDefinition[] {
  return ROLE_RELEASE_DEFINITIONS.filter((role) => role.status === status);
}

/* ==========================================================================
   Role Apps
   ========================================================================== */

export interface RoleAppReleaseEntry {
  id: string;
  name: Bilingual;
  roleId: "rcsa" | "tprm";
  status: RoleAppStatus;
  maturity: RoleAppMaturity;
  version: string;
  entryRoute: string | null;
}

function toRoleAppEntry(app: (typeof ROLE_APP_REGISTRY)[number]): RoleAppReleaseEntry {
  return {
    id: app.id,
    name: { en: app.name, de: app.nameDe },
    roleId: app.roleId,
    status: app.status,
    maturity: app.maturity,
    version: app.version,
    entryRoute: app.entryRoute,
  };
}

/** Installed Role Apps: the ones a person can open and run. */
export const INSTALLED_ROLE_APPS: readonly RoleAppReleaseEntry[] = ROLE_APP_REGISTRY.filter(
  (app) => app.status === "installed",
).map(toRoleAppEntry);

/** Preview Role Apps: defined in the catalogue, with no routed process page. */
export const PREVIEW_ROLE_APPS: readonly RoleAppReleaseEntry[] = ROLE_APP_REGISTRY.filter(
  (app) => app.status === "preview",
).map(toRoleAppEntry);

export const ROLE_APP_STATUS_LABELS: Record<RoleAppStatus, Bilingual> = {
  installed: { en: "Installed", de: "Installiert" },
  preview: { en: "Preview", de: "Vorschau" },
  available: { en: "Available to install", de: "Installierbar" },
  disabled: { en: "Disabled", de: "Deaktiviert" },
};

/* ==========================================================================
   Known limitations
   ========================================================================== */

/**
 * `open` is still true of this release. `mitigated` is still true, and the
 * product now says so at the point of use rather than leaving the reader to
 * find out.
 */
export type LimitationStatus = "open" | "mitigated";

export const LIMITATION_STATUS_LABELS: Record<LimitationStatus, Bilingual> = {
  open: { en: "Open", de: "Offen" },
  mitigated: { en: "Stated in the product", de: "Im Produkt ausgewiesen" },
};

export type LimitationArea =
  | "roles"
  | "ai"
  | "integrations"
  | "identity"
  | "product-owner"
  | "operations"
  | "localisation"
  | "deployment"
  | "scenario";

export interface KnownLimitation {
  id: string;
  area: LimitationArea;
  status: LimitationStatus;
  title: Bilingual;
  detail: Bilingual;
  /** A file or screen where the limitation is visible or documented. */
  reference: string;
}

export const KNOWN_LIMITATIONS: readonly KnownLimitation[] = [
  {
    id: "two-complete-roles",
    area: "roles",
    status: "mitigated",
    title: {
      en: "Two of six roles are complete",
      de: "Zwei von sechs Rollen sind vollstaendig",
    },
    detail: {
      en: "Only the Available roles have the full workday and complete processes. A Demo role opens an explanatory page, and a Planned role is not built. The role selector labels each one.",
      de: "Nur die verfuegbaren Rollen haben den vollstaendigen Arbeitstag und vollstaendige Prozesse. Eine Demo-Rolle oeffnet eine erlaeuternde Seite, eine geplante Rolle ist nicht gebaut. Die Rollenauswahl kennzeichnet jede Rolle.",
    },
    reference: "src/product/release/role-release.ts",
  },
  {
    id: "evaluation-structural-only",
    area: "ai",
    status: "mitigated",
    title: {
      en: "AI evaluation is structural only",
      de: "Die KI-Evaluation ist nur strukturell",
    },
    detail: {
      en: "Evaluation cases are graded against synthetic test envelopes built from each case. Grounded and live modes record every case as not run, so the quality of model output is not verified. The AI quality page shows the recorded run and says so.",
      de: "Evaluationsfaelle werden gegen synthetische Testhuellen bewertet, die aus jedem Fall erzeugt werden. Fundierte und Live-Modi erfassen jeden Fall als nicht ausgefuehrt, daher ist die Qualitaet der Modellausgaben nicht verifiziert. Die Seite KI-Qualitaet zeigt den erfassten Lauf und sagt das.",
    },
    reference: "/settings/ai-quality",
  },
  {
    id: "connectors-not-client-systems",
    area: "integrations",
    status: "mitigated",
    title: {
      en: "No client system is connected",
      de: "Kein Kundensystem ist angebunden",
    },
    detail: {
      en: "Every seeded connector instance is simulated, sandbox ready without a credential, configured but unreachable, or planned. None reads a client system, and each one shows its mode.",
      de: "Jede eingespielte Konnektorinstanz ist simuliert, ohne Anmeldeinformation sandbox-bereit, konfiguriert aber nicht erreichbar oder geplant. Keine liest ein Kundensystem, und jede zeigt ihren Modus.",
    },
    reference: "/settings/integrations",
  },
  {
    id: "local-identity",
    area: "identity",
    status: "open",
    title: {
      en: "No enterprise identity",
      de: "Keine Unternehmensidentitaet",
    },
    detail: {
      en: "Sessions are local demonstration personas or a static pilot account list. There is no single sign-on and no tenancy, and in demonstration mode the acting role is scenario state.",
      de: "Sitzungen sind lokale Demonstrationspersonen oder eine feste Liste von Pilotkonten. Es gibt kein Single Sign-on und keine Mandantentrennung, und im Demonstrationsmodus ist die handelnde Rolle Teil des Szenariozustands.",
    },
    reference: "src/identity/",
  },
  {
    id: "role-app-lifecycle-read-only",
    area: "product-owner",
    status: "open",
    title: {
      en: "Role App management is read only",
      de: "Die Verwaltung der Rollen-Apps ist nur lesend",
    },
    detail: {
      en: "A product owner cannot enable, disable, stage, compare, assign or retire a Role App. Installed and preview states come from the code registry.",
      de: "Ein Product Owner kann eine Rollen-App weder aktivieren, deaktivieren, bereitstellen, vergleichen, zuweisen noch stilllegen. Installierte und Vorschau-Zustaende stammen aus dem Code-Verzeichnis.",
    },
    reference: "/settings/role-apps",
  },
  {
    id: "pilot-readiness-narrow",
    area: "product-owner",
    status: "open",
    title: {
      en: "The pilot cohort holds local accounts only",
      de: "Die Pilotkohorte enthaelt nur lokale Konten",
    },
    detail: {
      en: "The pilot workspace manages setup, the cohort, the baseline, weekly readings, issues and the governed exit decision. The cohort can hold only the static pilot accounts, because there is no identity provider, and every figure the product measures in this environment comes from the synthetic institution.",
      de: "Der Pilotbereich fuehrt Einrichtung, Kohorte, Ausgangslage, Wochenwerte, Themen und die gesteuerte Abschlussentscheidung. Die Kohorte kann nur die festen Pilotkonten enthalten, weil es keinen Identitaetsanbieter gibt, und jede Zahl, die das Produkt in dieser Umgebung misst, stammt aus der synthetischen Institution.",
    },
    reference: "/product/pilot",
  },
  {
    id: "evidence-exports-command-line",
    area: "operations",
    status: "open",
    title: {
      en: "Audit chain verification runs from the command line",
      de: "Die Pruefung der Audit-Kette laeuft ueber die Kommandozeile",
    },
    detail: {
      en: "The pilot evidence pack downloads from the pilot workspace. Audit chain verification and the support bundle are still produced by npm scripts, and the backup script always reads data/nfr-workos.db.",
      de: "Das Pilot-Nachweispaket wird im Pilotbereich heruntergeladen. Die Pruefung der Audit-Kette und das Supportpaket entstehen weiterhin durch npm-Skripte, und das Sicherungsskript liest immer data/nfr-workos.db.",
    },
    reference: "npm run audit:verify-chain, npm run support:bundle, scripts/backup.ts",
  },
  {
    id: "operations-not-linked",
    area: "operations",
    status: "open",
    title: {
      en: "Operations is not linked to roles or processes",
      de: "Der Betrieb ist nicht mit Rollen oder Prozessen verknuepft",
    },
    detail: {
      en: "The operations console shows component health, the job queue and the audit chain. It does not connect an incident to an affected role, process, person or release decision.",
      de: "Die Betriebskonsole zeigt den Zustand der Komponenten, die Auftragswarteschlange und die Audit-Kette. Sie verbindet keinen Vorfall mit betroffenen Rollen, Prozessen, Personen oder Release-Entscheidungen.",
    },
    reference: "/ops",
  },
  {
    id: "admin-stored-values-english",
    area: "localisation",
    status: "open",
    title: {
      en: "Stored administrator values are English",
      de: "Gespeicherte Werte in der Administration sind englisch",
    },
    detail: {
      en: "The settings area and the operations console follow the scenario language. Values read from a registry or the database, such as tool and autonomy descriptions, deployment profiles, connector notes, model profile purposes and regulatory references, are shown as stored, in English.",
      de: "Die Einstellungen und die Betriebskonsole folgen der Szenariosprache. Werte aus einem Verzeichnis oder der Datenbank, etwa Beschreibungen von Werkzeugen und Autonomiestufen, Betriebsprofile, Konnektorhinweise, Zwecke von Modellprofilen und regulatorische Bezuege, erscheinen wie gespeichert auf Englisch.",
    },
    reference: "app/settings/",
  },
  {
    id: "single-machine",
    area: "deployment",
    status: "open",
    title: {
      en: "Runs on one machine",
      de: "Laeuft auf einem Rechner",
    },
    detail: {
      en: "One process with a local SQLite file. A Dockerfile and a compose file exist; no cloud deployment has been made.",
      de: "Ein Prozess mit einer lokalen SQLite-Datei. Ein Dockerfile und eine Compose-Datei sind vorhanden; eine Cloud-Bereitstellung gibt es nicht.",
    },
    reference: "/settings/deployment",
  },
  {
    id: "voice-best-effort",
    area: "ai",
    status: "open",
    title: {
      en: "Voice is best effort",
      de: "Sprache ist ohne Zusage",
    },
    detail: {
      en: "Voice falls back to typed input whenever a realtime model or live mode is unavailable. The typed path is the tested one.",
      de: "Die Spracheingabe faellt auf getippte Eingabe zurueck, sobald kein Echtzeitmodell oder Live-Modus verfuegbar ist. Getestet ist der getippte Weg.",
    },
    reference: "docs/ASSUMPTIONS.md",
  },
  {
    id: "scenario-figures",
    area: "scenario",
    status: "open",
    title: {
      en: "Two scenario figures are not fully reconciled",
      de: "Zwei Szenariowerte sind nicht vollstaendig abgestimmt",
    },
    detail: {
      en: "Two figures could not be fully reconciled with the coded risk methodology and with each other. Cost figures are illustrative and no live price list is read.",
      de: "Zwei Werte liessen sich nicht vollstaendig mit der codierten Risikomethodik und untereinander abstimmen. Kostenangaben sind illustrativ, eine aktuelle Preisliste wird nicht gelesen.",
    },
    reference: "docs/ASSUMPTIONS.md sections 4.2 and 4.3",
  },
];

export function limitationsWithStatus(status: LimitationStatus): KnownLimitation[] {
  return KNOWN_LIMITATIONS.filter((limitation) => limitation.status === status);
}

/* ==========================================================================
   The registry
   ========================================================================== */

export interface ProductReleaseRegistry {
  identity: ProductIdentity;
  release: ProductRelease;
  components: readonly ReleaseComponent[];
  roles: readonly RoleReleaseDefinition[];
  roleApps: {
    installed: readonly RoleAppReleaseEntry[];
    preview: readonly RoleAppReleaseEntry[];
  };
  limitations: readonly KnownLimitation[];
}

/** Everything above in one object, for a surface that renders the whole release. */
export function getProductReleaseRegistry(): ProductReleaseRegistry {
  return {
    identity: PRODUCT_IDENTITY,
    release: PRODUCT_RELEASE,
    components: RELEASE_COMPONENTS,
    roles: ROLE_RELEASE_DEFINITIONS,
    roleApps: { installed: INSTALLED_ROLE_APPS, preview: PREVIEW_ROLE_APPS },
    limitations: KNOWN_LIMITATIONS,
  };
}

/** "NFROS 4.1.0", the one line form for a title or a footer. */
export function productReleaseLabel(): string {
  return `${PRODUCT_IDENTITY.name} ${PRODUCT_RELEASE.version}`;
}
