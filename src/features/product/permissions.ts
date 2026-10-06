/**
 * Product-owner personas and console permissions (plan 6.1).
 *
 * "Do not treat all administrators as one person." The console has eight
 * product-owner personas, each with the responsibilities the plan lists and a
 * set of authority scopes. Every console action names the one scope it needs
 * and whether it is material. The server checks the acting persona's scopes
 * on every console action (`governance.ts`); the interface reads the same map
 * only to say in advance what the persona may do, never to decide.
 *
 * The map is the whole rule, and it is shaped so that the separation of
 * duties falls out of it rather than being checked separately:
 *
 *   a Role App Owner prepares a candidate version, but cannot approve it;
 *   an AI Quality Owner evaluates it;
 *   the Platform Product Owner approves the release and the pilot release;
 *   a Tenant Administrator enables it for the tenant;
 *   an Operations Owner deploys, and may disable an app to contain an
 *   incident, but cannot enable one;
 *   a Pilot Lead assigns the pilot cohort and records the exit decision.
 *
 * Identity. There is no identity provider in this build. The acting persona
 * is chosen through the demonstration persona mechanism
 * (`src/identity/local-demo.ts`): each persona below is a demonstration
 * persona whose session carries these scopes as its `authorityScopes`. Wave 5
 * binds a named user to a persona, or gives an identity provider's session
 * the scopes directly; the checks do not change, because they read scopes,
 * not persona names.
 *
 * Pure and client safe: no database, no React, no server import. Exported
 * for the other console workstreams (quality, integrations, feedback, pilot,
 * value), which name their actions from `CONSOLE_ACTIONS` and call
 * `governConsoleAction` with them.
 */

export type Bilingual = { en: string; de: string };

/* ==========================================================================
   Scopes
   ========================================================================== */

/**
 * Console authority scopes.
 *
 * Distinct from the workday's scopes in `src/server/security/authority.ts`
 * (`rcsa.rate`, `supplier.assess` and the rest). Those govern judgments about
 * risk; these govern the product. No persona here holds a workday scope, and
 * no workday role holds one of these.
 */
export const CONSOLE_SCOPES = [
  /* Reading the console. Every persona holds it. */
  "console.read",
  /* Role Apps (7.2) */
  "role-app.version.manage",
  "role-app.evaluate",
  "role-app.cohort.assign",
  "role-app.release.approve",
  "role-app.enable",
  "role-app.disable",
  "role-app.rollback",
  "role-app.retire",
  /* Releases (7.9) */
  "release.gate.run",
  "release.evidence.generate",
  "release.pilot.approve",
  "release.deploy",
  "release.rollback",
  /* AI quality (7.5) */
  "quality.evaluation.run",
  "quality.release.decide",
  "quality.rollback",
  "quality.evidence.export",
  /* Integrations (7.6) */
  "integration.operate",
  "integration.writes.control",
  "integration.mapping.resolve",
  "integration.diagnostics",
  /* Pilot (7.7) and cohorts */
  "cohort.manage",
  "pilot.setup.manage",
  "pilot.measure.record",
  "pilot.issue.manage",
  "pilot.exit.decide",
  /* Feedback (7.8) */
  "feedback.triage",
  "feedback.assign",
  /* Operations */
  "operations.jobs.manage",
  "operations.incident.manage",
] as const;

export type ConsoleScope = (typeof CONSOLE_SCOPES)[number];

export function isConsoleScope(value: unknown): value is ConsoleScope {
  return typeof value === "string" && (CONSOLE_SCOPES as readonly string[]).includes(value);
}

/* ==========================================================================
   Personas
   ========================================================================== */

export const PRODUCT_PERSONA_IDS = [
  "platform-product-owner",
  "function-pack-owner",
  "role-app-owner",
  "tenant-administrator",
  "ai-quality-owner",
  "integration-owner",
  "operations-owner",
  "pilot-lead",
] as const;

export type ProductPersonaId = (typeof PRODUCT_PERSONA_IDS)[number];

export function isProductPersonaId(value: unknown): value is ProductPersonaId {
  return typeof value === "string" && (PRODUCT_PERSONA_IDS as readonly string[]).includes(value);
}

export interface ProductPersona {
  id: ProductPersonaId;
  label: Bilingual;
  /** What the persona owns, in the plan's words (6.1). */
  owns: readonly Bilingual[];
  /**
   * The demonstration user the persona signs in as. A synthetic id, never a
   * person: the persona names a responsibility, not an employee.
   */
  demoUserId: string;
  scopes: readonly ConsoleScope[];
}

export const PRODUCT_PERSONAS: Readonly<Record<ProductPersonaId, ProductPersona>> = {
  "platform-product-owner": {
    id: "platform-product-owner",
    label: { en: "Platform Product Owner", de: "Platform Product Owner" },
    owns: [
      { en: "Product release", de: "Produkt-Release" },
      { en: "Common capabilities", de: "Gemeinsame Funktionen" },
      { en: "Shared roadmap", de: "Gemeinsame Roadmap" },
      { en: "Product health", de: "Produktzustand" },
      { en: "Commercial packaging", de: "Kommerzielle Paketierung" },
    ],
    demoUserId: "DEMO-PO-PLATFORM",
    scopes: [
      "console.read",
      "role-app.release.approve",
      "role-app.enable",
      "role-app.disable",
      "role-app.rollback",
      "role-app.retire",
      "release.gate.run",
      "release.evidence.generate",
      "release.pilot.approve",
      "release.rollback",
      "quality.evidence.export",
      "feedback.triage",
      "feedback.assign",
    ],
  },
  "function-pack-owner": {
    id: "function-pack-owner",
    label: { en: "Function Pack Owner", de: "Function Pack Owner" },
    owns: [
      { en: "Domain language", de: "Fachsprache" },
      { en: "Professional method", de: "Fachmethodik" },
      { en: "Role experience", de: "Rollenerlebnis" },
      { en: "Evaluation scope", de: "Evaluationsumfang" },
      { en: "Function roadmap", de: "Roadmap der Funktion" },
    ],
    demoUserId: "DEMO-PO-FUNCTION-PACK",
    scopes: ["console.read", "role-app.version.manage", "role-app.evaluate", "quality.evaluation.run", "feedback.triage"],
  },
  "role-app-owner": {
    id: "role-app-owner",
    label: { en: "Role App Owner", de: "Role App Owner" },
    owns: [
      { en: "Process stages", de: "Prozessstufen" },
      { en: "Source requirements", de: "Quellenanforderungen" },
      { en: "Decisions", de: "Entscheidungen" },
      { en: "Tools", de: "Werkzeuge" },
      { en: "Outputs", de: "Ergebnisse" },
      { en: "Adoption", de: "Nutzung" },
      { en: "Stage performance", de: "Leistung der Stufen" },
    ],
    demoUserId: "DEMO-PO-ROLE-APP",
    scopes: [
      "console.read",
      "role-app.version.manage",
      "role-app.evaluate",
      "role-app.cohort.assign",
      "pilot.issue.manage",
      "feedback.triage",
    ],
  },
  "tenant-administrator": {
    id: "tenant-administrator",
    label: { en: "Tenant Administrator", de: "Mandantenadministration" },
    owns: [
      { en: "Organisation", de: "Organisation" },
      { en: "Legal entities", de: "Rechtseinheiten" },
      { en: "Users", de: "Benutzer" },
      { en: "Entitlements", de: "Berechtigungen" },
      { en: "Branding", de: "Markenauftritt" },
      { en: "Terminology", de: "Terminologie" },
    ],
    demoUserId: "DEMO-PO-TENANT",
    scopes: ["console.read", "role-app.enable", "role-app.disable", "cohort.manage"],
  },
  "ai-quality-owner": {
    id: "ai-quality-owner",
    label: { en: "AI Quality Owner", de: "AI Quality Owner" },
    owns: [
      { en: "Model profiles", de: "Modellprofile" },
      { en: "Prompts", de: "Prompts" },
      { en: "Evaluation", de: "Evaluation" },
      { en: "Source completeness", de: "Vollstaendigkeit der Quellen" },
      { en: "Failures", de: "Fehler" },
      { en: "Release gates", de: "Release-Pruefungen" },
    ],
    demoUserId: "DEMO-PO-AI-QUALITY",
    scopes: [
      "console.read",
      "role-app.evaluate",
      "quality.evaluation.run",
      "quality.release.decide",
      "quality.rollback",
      "quality.evidence.export",
      "release.gate.run",
      "feedback.triage",
    ],
  },
  "integration-owner": {
    id: "integration-owner",
    label: { en: "Integration Owner", de: "Integration Owner" },
    owns: [
      { en: "Connector health", de: "Zustand der Konnektoren" },
      { en: "Mappings", de: "Zuordnungen" },
      { en: "Credentials", de: "Zugangsdaten" },
      { en: "Retries", de: "Wiederholungen" },
      { en: "Failures", de: "Fehler" },
      { en: "Source freshness", de: "Aktualitaet der Quellen" },
    ],
    demoUserId: "DEMO-PO-INTEGRATION",
    scopes: [
      "console.read",
      "integration.operate",
      "integration.writes.control",
      "integration.mapping.resolve",
      "integration.diagnostics",
      "operations.incident.manage",
      "pilot.issue.manage",
    ],
  },
  "operations-owner": {
    id: "operations-owner",
    label: { en: "Operations Owner", de: "Operations Owner" },
    owns: [
      { en: "Health", de: "Zustand" },
      { en: "Worker", de: "Hintergrundprozess" },
      { en: "Incidents", de: "Vorfaelle" },
      { en: "Support", de: "Support" },
      { en: "Backup", de: "Sicherung" },
      { en: "Release", de: "Release" },
    ],
    demoUserId: "DEMO-PO-OPERATIONS",
    scopes: [
      "console.read",
      "role-app.disable",
      "role-app.rollback",
      "release.gate.run",
      "release.evidence.generate",
      "release.deploy",
      "release.rollback",
      "quality.evidence.export",
      "integration.operate",
      "integration.writes.control",
      "integration.diagnostics",
      "operations.jobs.manage",
      "operations.incident.manage",
      "pilot.issue.manage",
    ],
  },
  "pilot-lead": {
    id: "pilot-lead",
    label: { en: "Pilot Lead", de: "Pilotleitung" },
    owns: [
      { en: "Cohort", de: "Kohorte" },
      { en: "Baseline", de: "Ausgangslage" },
      { en: "Adoption", de: "Nutzung" },
      { en: "Feedback", de: "Rueckmeldungen" },
      { en: "Value measures", de: "Nutzenkennzahlen" },
      { en: "Go or stop decision", de: "Entscheidung ueber Fortsetzung oder Abbruch" },
    ],
    demoUserId: "DEMO-PO-PILOT",
    scopes: [
      "console.read",
      "role-app.cohort.assign",
      "cohort.manage",
      "pilot.setup.manage",
      "pilot.measure.record",
      "pilot.issue.manage",
      "pilot.exit.decide",
      "release.evidence.generate",
      "feedback.triage",
      "feedback.assign",
    ],
  },
};

export function productPersona(id: ProductPersonaId): ProductPersona {
  return PRODUCT_PERSONAS[id];
}

/** The persona a demonstration user id belongs to, if it is one of them. */
export function personaForUserId(userId: string | null | undefined): ProductPersona | null {
  if (!userId) return null;
  return Object.values(PRODUCT_PERSONAS).find((persona) => persona.demoUserId === userId) ?? null;
}

export function scopesForPersona(id: ProductPersonaId): readonly ConsoleScope[] {
  return PRODUCT_PERSONAS[id].scopes;
}

export function personaHoldsScope(id: ProductPersonaId, scope: ConsoleScope): boolean {
  return PRODUCT_PERSONAS[id].scopes.includes(scope);
}

/** The personas that hold a scope, in the plan's order. */
export function personasWithScope(scope: ConsoleScope): ProductPersona[] {
  return PRODUCT_PERSONA_IDS.map((id) => PRODUCT_PERSONAS[id]).filter((persona) => persona.scopes.includes(scope));
}

/* ==========================================================================
   Console actions
   ========================================================================== */

export type ConsoleArea =
  | "role-apps"
  | "releases"
  | "quality"
  | "integrations"
  | "pilot"
  | "feedback"
  | "operations";

export interface ConsoleActionDefinition {
  id: string;
  area: ConsoleArea;
  label: Bilingual;
  /** The one scope the acting persona must hold. */
  scope: ConsoleScope;
  /**
   * Material actions change what people can use, what is in force or what is
   * recorded as decided. They need a payload bound approval: the person sees
   * exactly what will change, confirms the rationale is their own, and the
   * approval is bound to a fingerprint of that change, so a change that moved
   * between review and submission is refused.
   */
  material: boolean;
  /** The plan section the action comes from. */
  planSection: string;
}

function action(
  id: string,
  area: ConsoleArea,
  scope: ConsoleScope,
  material: boolean,
  planSection: string,
  label: Bilingual,
): ConsoleActionDefinition {
  return { id, area, scope, material, planSection, label };
}

/**
 * Every console action in plan 7, named once.
 *
 * The parallel console workstreams use these ids rather than inventing their
 * own, so the permission map, the audit trail and the persona panel agree.
 * An action that is not in this table cannot pass `governConsoleAction`.
 */
export const CONSOLE_ACTIONS = {
  /* ---- Role Apps (7.2) ---- */
  "role-app.create-candidate": action("role-app.create-candidate", "role-apps", "role-app.version.manage", false, "7.2", {
    en: "Create candidate version",
    de: "Kandidatenversion anlegen",
  }),
  "role-app.compare-versions": action("role-app.compare-versions", "role-apps", "console.read", false, "7.2", {
    en: "Compare versions",
    de: "Versionen vergleichen",
  }),
  "role-app.run-evaluations": action("role-app.run-evaluations", "role-apps", "role-app.evaluate", false, "7.2", {
    en: "Run evaluations",
    de: "Evaluationen ausfuehren",
  }),
  "role-app.assign-pilot-cohort": action("role-app.assign-pilot-cohort", "role-apps", "role-app.cohort.assign", true, "7.2", {
    en: "Assign pilot cohort",
    de: "Pilotkohorte zuweisen",
  }),
  "role-app.approve-release": action("role-app.approve-release", "role-apps", "role-app.release.approve", true, "7.2", {
    en: "Approve release",
    de: "Release freigeben",
  }),
  "role-app.enable": action("role-app.enable", "role-apps", "role-app.enable", true, "7.2", {
    en: "Enable",
    de: "Freischalten",
  }),
  "role-app.disable": action("role-app.disable", "role-apps", "role-app.disable", true, "7.2", {
    en: "Disable",
    de: "Sperren",
  }),
  "role-app.roll-back": action("role-app.roll-back", "role-apps", "role-app.rollback", true, "7.2", {
    en: "Roll back",
    de: "Zuruecksetzen",
  }),
  "role-app.retire": action("role-app.retire", "role-apps", "role-app.retire", true, "7.2", {
    en: "Retire",
    de: "Ausser Betrieb nehmen",
  }),

  /* ---- Releases (7.9) ---- */
  "release.run-gate": action("release.run-gate", "releases", "release.gate.run", false, "7.9", {
    en: "Run release gate",
    de: "Release-Pruefung ausfuehren",
  }),
  "release.generate-evidence-pack": action("release.generate-evidence-pack", "releases", "release.evidence.generate", false, "7.9", {
    en: "Generate evidence pack",
    de: "Nachweispaket erzeugen",
  }),
  "release.approve-pilot": action("release.approve-pilot", "releases", "release.pilot.approve", true, "7.9", {
    en: "Approve pilot release",
    de: "Pilot-Release freigeben",
  }),
  "release.deploy": action("release.deploy", "releases", "release.deploy", true, "7.9", {
    en: "Deploy",
    de: "Bereitstellen",
  }),
  "release.roll-back": action("release.roll-back", "releases", "release.rollback", true, "7.9", {
    en: "Roll back release",
    de: "Release zuruecksetzen",
  }),

  /* ---- AI quality (7.5), built by os-console-quality ---- */
  "quality.run-evaluation": action("quality.run-evaluation", "quality", "quality.evaluation.run", false, "7.5", {
    en: "Run evaluation",
    de: "Evaluation ausfuehren",
  }),
  "quality.inspect-case": action("quality.inspect-case", "quality", "console.read", false, "7.5", {
    en: "Inspect failed case",
    de: "Fehlgeschlagenen Fall pruefen",
  }),
  "quality.compare-output": action("quality.compare-output", "quality", "console.read", false, "7.5", {
    en: "Compare output",
    de: "Ausgaben vergleichen",
  }),
  "quality.approve-candidate": action("quality.approve-candidate", "quality", "quality.release.decide", true, "7.5", {
    en: "Approve candidate",
    de: "Kandidat freigeben",
  }),
  "quality.reject-candidate": action("quality.reject-candidate", "quality", "quality.release.decide", false, "7.5", {
    en: "Reject candidate",
    de: "Kandidat ablehnen",
  }),
  "quality.roll-back": action("quality.roll-back", "quality", "quality.rollback", true, "7.5", {
    en: "Roll back configuration",
    de: "Konfiguration zuruecksetzen",
  }),
  "quality.export-evidence": action("quality.export-evidence", "quality", "quality.evidence.export", false, "7.5", {
    en: "Export evidence",
    de: "Nachweise exportieren",
  }),

  /* ---- Integrations (7.6), built by os-console-quality ---- */
  "integration.test-connection": action("integration.test-connection", "integrations", "integration.operate", false, "7.6", {
    en: "Test connection",
    de: "Verbindung testen",
  }),
  "integration.run-sync": action("integration.run-sync", "integrations", "integration.operate", false, "7.6", {
    en: "Run sync",
    de: "Synchronisierung ausfuehren",
  }),
  "integration.pause-writes": action("integration.pause-writes", "integrations", "integration.writes.control", true, "7.6", {
    en: "Pause writes",
    de: "Schreibzugriffe anhalten",
  }),
  "integration.resume-writes": action("integration.resume-writes", "integrations", "integration.writes.control", true, "7.6", {
    en: "Resume writes",
    de: "Schreibzugriffe fortsetzen",
  }),
  "integration.retry-command": action("integration.retry-command", "integrations", "integration.operate", false, "7.6", {
    en: "Retry command",
    de: "Befehl wiederholen",
  }),
  "integration.resolve-mapping": action("integration.resolve-mapping", "integrations", "integration.mapping.resolve", true, "7.6", {
    en: "Resolve mapping",
    de: "Zuordnung klaeren",
  }),
  "integration.download-diagnostics": action("integration.download-diagnostics", "integrations", "integration.diagnostics", false, "7.6", {
    en: "Download diagnostic bundle",
    de: "Diagnosepaket herunterladen",
  }),

  /* ---- Pilot (7.7), built by os-pilot ---- */
  "pilot.edit-setup": action("pilot.edit-setup", "pilot", "pilot.setup.manage", false, "7.7", {
    en: "Edit pilot setup",
    de: "Pilot-Einrichtung bearbeiten",
  }),
  "pilot.manage-cohort": action("pilot.manage-cohort", "pilot", "cohort.manage", true, "7.7", {
    en: "Manage cohort",
    de: "Kohorte verwalten",
  }),
  "pilot.record-baseline": action("pilot.record-baseline", "pilot", "pilot.measure.record", false, "7.7", {
    en: "Record baseline",
    de: "Ausgangswert erfassen",
  }),
  "pilot.set-target": action("pilot.set-target", "pilot", "pilot.measure.record", false, "7.7", {
    en: "Set success criterion",
    de: "Erfolgskriterium festlegen",
  }),
  "pilot.record-reading": action("pilot.record-reading", "pilot", "pilot.measure.record", false, "7.7", {
    en: "Record weekly reading",
    de: "Wochenwert erfassen",
  }),
  "pilot.raise-issue": action("pilot.raise-issue", "pilot", "pilot.issue.manage", false, "7.7", {
    en: "Raise issue",
    de: "Thema erfassen",
  }),
  "pilot.update-issue": action("pilot.update-issue", "pilot", "pilot.issue.manage", false, "7.7", {
    en: "Update issue",
    de: "Thema aktualisieren",
  }),
  "pilot.record-exit-decision": action("pilot.record-exit-decision", "pilot", "pilot.exit.decide", true, "7.7", {
    en: "Record exit decision",
    de: "Abschlussentscheidung erfassen",
  }),

  /* ---- Feedback (7.8), built by os-console-quality ---- */
  "feedback.triage": action("feedback.triage", "feedback", "feedback.triage", false, "7.8", {
    en: "Triage feedback",
    de: "Rueckmeldung sichten",
  }),
  "feedback.link": action("feedback.link", "feedback", "feedback.triage", false, "7.8", {
    en: "Link to feature, Role App or stage",
    de: "Mit Funktion, Rollen-App oder Stufe verknuepfen",
  }),
  "feedback.set-severity": action("feedback.set-severity", "feedback", "feedback.triage", false, "7.8", {
    en: "Set severity",
    de: "Schweregrad festlegen",
  }),
  "feedback.track-release": action("feedback.track-release", "feedback", "feedback.triage", false, "7.8", {
    en: "Track release",
    de: "Release zuordnen",
  }),
  "feedback.assign-owner": action("feedback.assign-owner", "feedback", "feedback.assign", false, "7.8", {
    en: "Assign owner",
    de: "Verantwortung zuweisen",
  }),

  /* ---- Operations ---- */
  "operations.cancel-job": action("operations.cancel-job", "operations", "operations.jobs.manage", false, "6.2", {
    en: "Cancel job",
    de: "Auftrag abbrechen",
  }),
  "operations.open-incident": action("operations.open-incident", "operations", "operations.incident.manage", false, "6.2", {
    en: "Open incident",
    de: "Vorfall eroeffnen",
  }),
  "operations.resolve-incident": action("operations.resolve-incident", "operations", "operations.incident.manage", false, "6.2", {
    en: "Resolve incident",
    de: "Vorfall abschliessen",
  }),
} as const satisfies Record<string, ConsoleActionDefinition>;

export type ConsoleActionId = keyof typeof CONSOLE_ACTIONS;

export function isConsoleActionId(value: unknown): value is ConsoleActionId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CONSOLE_ACTIONS, value);
}

export function consoleAction(id: ConsoleActionId): ConsoleActionDefinition {
  return CONSOLE_ACTIONS[id];
}

export function consoleActionsFor(area: ConsoleArea): ConsoleActionDefinition[] {
  return Object.values(CONSOLE_ACTIONS).filter((entry) => entry.area === area);
}

/* ==========================================================================
   The check
   ========================================================================== */

/**
 * Whether a set of scopes permits an action. Pure; the server calls it on
 * every console action with the acting session's scopes, and the interface
 * calls it to disable a control in advance and say why.
 */
export type PermissionVerdict =
  | { allowed: true; action: ConsoleActionDefinition }
  | { allowed: false; action: ConsoleActionDefinition; code: "no-persona" | "missing-scope"; reason: Bilingual };

export function checkConsolePermission(
  scopes: readonly string[] | null,
  actionId: ConsoleActionId,
): PermissionVerdict {
  const definition = CONSOLE_ACTIONS[actionId];
  if (scopes === null) {
    return {
      allowed: false,
      action: definition,
      code: "no-persona",
      reason: {
        en: "No product-owner persona is acting. Choose a demonstration persona at the top of the console.",
        de: "Es handelt keine Product-Owner-Persona. Waehlen Sie oben in der Konsole eine Demonstrationspersona.",
      },
    };
  }
  if (!scopes.includes(definition.scope)) {
    const holders = personasWithScope(definition.scope).map((persona) => persona.label);
    const list = (language: "en" | "de") => holders.map((label) => label[language]).join(", ");
    return {
      allowed: false,
      action: definition,
      code: "missing-scope",
      reason: {
        en: holders.length > 0
          ? `This persona does not hold the authority for "${definition.label.en}". It is held by: ${list("en")}.`
          : `No persona holds the authority for "${definition.label.en}".`,
        de: holders.length > 0
          ? `Diese Persona hat keine Befugnis fuer "${definition.label.de}". Befugt sind: ${list("de")}.`
          : `Keine Persona hat die Befugnis fuer "${definition.label.de}".`,
      },
    };
  }
  return { allowed: true, action: definition };
}

/** The same check for a persona id, or for nobody. */
export function personaCan(personaId: ProductPersonaId | null, actionId: ConsoleActionId): PermissionVerdict {
  return checkConsolePermission(personaId ? PRODUCT_PERSONAS[personaId].scopes : null, actionId);
}
