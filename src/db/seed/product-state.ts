/**
 * Product state seed (migration 0006).
 *
 * Writes what an honest demonstration of the Product Owner Console needs, and
 * nothing it would have to pretend:
 *
 *   - one version per Role App in the code registry, two installed and five
 *     preview, each with its lifecycle state, the manifest of its reviewed
 *     definition and one "registered" history entry;
 *   - the tenant enablement of the two installed apps;
 *   - one design-partner pilot in setup, its cohort (the two pilot accounts in
 *     `src/identity/pilot-config.ts`) and its six baseline measures, every one
 *     of them marked not measured.
 *
 * And deliberately nothing else. No feedback, no evaluation run, no release
 * approval, no gate run, no release event, no reading and no analytics: those
 * are records of things a person or a run did, and none has happened on a
 * fresh database. Their tables stay empty, and the console's empty states
 * say so.
 *
 * Every version is derived from `ROLE_APP_REGISTRY` and the process
 * definitions at seed time, never typed in by hand, so the seeded release
 * state cannot drift from the code it describes. A unit test
 * (`tests/unit/product-state-seed.test.ts`) holds the two together.
 *
 * Idempotent by delete then insert, scoped to the product state tables only,
 * exactly like `seedProductConfiguration`: it never touches a domain table or
 * a scenario run. Deterministic: a fixed timestamp, no random values.
 */

import { getDb, getSqlite } from "@/db/client";
import {
  aiConfigurationReleases,
  aiEvaluationCaseResults,
  aiEvaluationRuns,
  pilotExitDecisions,
  pilotIssues,
  pilotMeasureReadings,
  pilotMeasures,
  pilotProgrammes,
  productCohorts,
  productFeedback,
  productReleaseEvents,
  releaseGateRuns,
  roleAppEnablements,
  roleAppLifecycleEvents,
  roleAppVersions,
  type RoleAppLifecycleState,
  type RoleAppSupportState,
  type RoleAppVersionSource,
} from "@/db/schema/product-console";
import type { RoleId } from "@/db/schema/core";
import { AI_CONFIGURATION_REGISTRY } from "@/ai/prompt-registry";
import { digestContent } from "@/features/process/artifacts";
import { PILOT_USERS } from "@/identity/pilot-config";
import {
  OPERATOR_BRAND_PROFILE_ID,
  ORGANISATION_PROFILE_ID,
  PRODUCT_BRAND_PROFILES,
  PRODUCT_SEEDED_AT,
  RESTRICTED_ENTITLEMENT_PROFILE_ID,
  DEFAULT_BRAND_PROFILE_ID,
} from "@/product/seed";
import type { RoleAppDefinition, RoleProcessDefinition } from "@/role-apps/contracts";
import { getProcessDefinition, ROLE_APP_REGISTRY } from "@/role-apps/registry";

/** The migration these versions were recorded against. */
export const SEEDED_AGAINST_MIGRATION = "0006_data_model";

/** The seeded design-partner pilot and its cohort. */
export const SEEDED_PILOT_ID = "PILOT-DP-2026-01";
export const SEEDED_COHORT_ID = "COHORT-DP-2026-01";

/** Who the seed records as the actor: the seed itself, never a person. */
const SEED_ACTOR = "seed";

/**
 * The product state tables, in the order they are cleared.
 *
 * Every table `seedProductState` owns. A reseed clears all of them, which is
 * how `demo:reset` restores the console to its seeded state, as it does the
 * product configuration.
 */
export const PRODUCT_STATE_TABLES = [
  aiEvaluationCaseResults,
  aiEvaluationRuns,
  aiConfigurationReleases,
  productFeedback,
  pilotExitDecisions,
  pilotIssues,
  pilotMeasureReadings,
  pilotMeasures,
  pilotProgrammes,
  productCohorts,
  releaseGateRuns,
  productReleaseEvents,
  roleAppEnablements,
  roleAppLifecycleEvents,
  roleAppVersions,
] as const;

/* ==========================================================================
   Role App versions, derived from the code registry
   ========================================================================== */

/**
 * The lifecycle state a registry entry is in.
 *
 * The registry carries two words, a status and a maturity; the console has
 * the plan's eight states. The registry's own description of its preview apps
 * is "demo or concept status": a preview prototype can be shown (Demo), a
 * preview concept is only defined (Planned). A disabled app is still
 * installed; its enablement says it is off.
 */
export function lifecycleStateFor(app: Pick<RoleAppDefinition, "status" | "maturity">): RoleAppLifecycleState {
  switch (app.status) {
    case "installed":
    case "disabled":
      return "installed";
    case "available":
      return "available";
    case "preview":
      return app.maturity === "concept" ? "planned" : "demo";
  }
}

/** What the product team stands behind for a version in a given state. */
export function supportStateFor(state: RoleAppLifecycleState): RoleAppSupportState {
  switch (state) {
    case "installed":
    case "available":
    case "pilot":
      return "maintained";
    case "demo":
    case "candidate":
      return "demonstration-only";
    case "draft":
    case "planned":
      return "not-built";
    case "retired":
      return "ended";
  }
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

/** The manifest of one Role App, read from its definition. */
export interface RoleAppManifest {
  processId: string | null;
  processDefinitionDigest: string | null;
  processStageIds: string[];
  implementedStageIds: string[];
  sourceRequirements: RoleAppVersionSource[];
  tools: string[];
  authority: { stageCompletionToolName: string | null; approvalTools: string[]; humanDecisionKinds: string[] };
  evaluations: { configurationIds: string[]; evaluationSuiteIds: string[] };
  connectorDependencies: string[];
}

/**
 * Reads a Role App's release manifest from its definition and process.
 *
 * An app with no process definition (every preview app) has no digest and no
 * implemented stages; its stage list is the stages it declares it will cover.
 */
export function buildRoleAppManifest(
  app: RoleAppDefinition,
  process: RoleProcessDefinition | undefined,
): RoleAppManifest {
  const stages = process?.stages ?? [];
  const configurationIds = unique(stages.flatMap((stage) => stage.aiJobs.map((job) => job.configurationId)));
  const evaluationSuiteIds = unique(
    configurationIds.flatMap((id) => {
      const configuration = AI_CONFIGURATION_REGISTRY.find((entry) => entry.id === id);
      return configuration ? [configuration.evaluationSuiteId] : [];
    }),
  );
  const approvalTools = unique(stages.flatMap((stage) => stage.approvalRequirements.map((approval) => approval.toolName)));
  const stageTools = stages.flatMap((stage) => stage.tools.map((tool) => tool.toolName));

  return {
    processId: process ? process.id : null,
    processDefinitionDigest: process ? digestContent(process) : null,
    processStageIds: process ? [...stages].sort((a, b) => a.sequence - b.sequence).map((stage) => stage.id) : [...app.coveredStageIds],
    implementedStageIds: [...stages]
      .sort((a, b) => a.sequence - b.sequence)
      .filter((stage) => stage.implementation.implemented)
      .map((stage) => stage.id),
    sourceRequirements: stages.flatMap((stage) => [
      ...stage.requiredSources.map((source) => ({
        stageId: stage.id,
        key: source.key,
        necessity: "required" as const,
        connectorInstanceId: source.connectorInstanceId,
      })),
      ...stage.helpfulSources.map((source) => ({
        stageId: stage.id,
        key: source.key,
        necessity: "helpful" as const,
        connectorInstanceId: source.connectorInstanceId,
      })),
    ]),
    tools: unique([...stageTools, ...approvalTools, ...(app.stageCompletionToolName ? [app.stageCompletionToolName] : [])]),
    authority: {
      stageCompletionToolName: app.stageCompletionToolName ?? null,
      approvalTools,
      humanDecisionKinds: [...app.humanDecisionKinds],
    },
    evaluations: { configurationIds, evaluationSuiteIds },
    connectorDependencies: [...app.requiredConnectorPackIds],
  };
}

function releaseNotes(state: RoleAppLifecycleState, manifest: RoleAppManifest): { en: string; de: string } {
  if (state === "installed") {
    const implemented = manifest.implementedStageIds.length;
    const total = manifest.processStageIds.length;
    if (implemented === total) {
      return {
        en: `Installed release, recorded from the code registry. All ${total} stages run end to end in this build.`,
        de: `Installiertes Release, aus dem Code-Verzeichnis erfasst. Alle ${total} Stufen laufen in diesem Build vollstaendig.`,
      };
    }
    return {
      en: `Installed release, recorded from the code registry. ${implemented} of ${total} stages run end to end in this build; the others open, show their contract and refuse completion with the reason.`,
      de: `Installiertes Release, aus dem Code-Verzeichnis erfasst. ${implemented} von ${total} Stufen laufen in diesem Build vollstaendig; die anderen oeffnen, zeigen ihren Vertrag und verweigern den Abschluss mit Begruendung.`,
    };
  }
  if (state === "demo") {
    return {
      en: "Catalogue entry, recorded from the code registry. A prototype with no routed process page: it can be shown, not run.",
      de: "Katalogeintrag, aus dem Code-Verzeichnis erfasst. Ein Prototyp ohne Prozessseite: Er kann gezeigt, aber nicht ausgefuehrt werden.",
    };
  }
  return {
    en: "Catalogue entry, recorded from the code registry. A concept: only its definition exists.",
    de: "Katalogeintrag, aus dem Code-Verzeichnis erfasst. Ein Konzept: Nur seine Definition existiert.",
  };
}

export function roleAppVersionId(app: Pick<RoleAppDefinition, "id" | "version">): string {
  return `RAV-${app.id}-${app.version}`;
}

/** One current version per registry entry. */
export function seededRoleAppVersions(): (typeof roleAppVersions.$inferInsert)[] {
  return ROLE_APP_REGISTRY.map((app) => {
    const state = lifecycleStateFor(app);
    const manifest = buildRoleAppManifest(app, getProcessDefinition(app.processId));
    const notes = releaseNotes(state, manifest);
    return {
      id: roleAppVersionId(app),
      roleAppId: app.id,
      roleId: app.roleId,
      version: app.version,
      lifecycleState: state,
      isCurrent: true,
      processId: manifest.processId,
      processDefinitionDigest: manifest.processDefinitionDigest,
      processStageIds: manifest.processStageIds,
      implementedStageIds: manifest.implementedStageIds,
      sourceRequirements: manifest.sourceRequirements,
      tools: manifest.tools,
      authority: manifest.authority,
      evaluations: manifest.evaluations,
      connectorDependencies: manifest.connectorDependencies,
      migrationTag: SEEDED_AGAINST_MIGRATION,
      releaseNotes: notes.en,
      releaseNotesDe: notes.de,
      supportState: supportStateFor(state),
      evaluationRunId: null,
      approvalId: null,
      createdAt: PRODUCT_SEEDED_AT,
      createdByLabel: SEED_ACTOR,
      /* Released means in force: an installed version is, a catalogue entry is not. */
      releasedAt: state === "installed" ? PRODUCT_SEEDED_AT : null,
    };
  });
}

/** One "registered" entry per version: where the release state came from. */
export function seededRoleAppLifecycleEvents(): (typeof roleAppLifecycleEvents.$inferInsert)[] {
  return ROLE_APP_REGISTRY.map((app) => ({
    /* The first position in the app's history, the format the repository continues. */
    id: `RALE-${app.id}-0001`,
    roleAppId: app.id,
    versionId: roleAppVersionId(app),
    kind: "registered" as const,
    fromState: null,
    toState: lifecycleStateFor(app),
    scopeKind: null,
    scopeId: null,
    actorKind: "system" as const,
    actorUserId: null,
    actorLabel: SEED_ACTOR,
    at: PRODUCT_SEEDED_AT,
    reason: "Recorded from the code registry, src/role-apps/registry.ts.",
    approvalId: null,
    evaluationRunId: null,
  }));
}

/** The installed apps are enabled for the tenant; nothing else is enabled anywhere. */
export function seededRoleAppEnablements(): (typeof roleAppEnablements.$inferInsert)[] {
  return installedApps().map((app) => ({
    id: `RAE-${app.id}-tenant`,
    roleAppId: app.id,
    versionId: null,
    scopeKind: "tenant" as const,
    scopeId: ORGANISATION_PROFILE_ID,
    enabled: true,
    changedAt: PRODUCT_SEEDED_AT,
    changedByLabel: SEED_ACTOR,
    changedByUserId: null,
    reason: "Installed in the code registry.",
  }));
}

/* ==========================================================================
   The design-partner pilot, in setup
   ========================================================================== */

const PILOT_ROLE_IDS: RoleId[] = ["rcsa", "tprm"];
const PILOT_LEGAL_ENTITY_IDS = ["ARC-DE"];

function installedApps(): RoleAppDefinition[] {
  return ROLE_APP_REGISTRY.filter((app) => app.status === "installed");
}

/** The connector instances the installed apps' stages read from or write to. */
export function pilotSourceSystemIds(): string[] {
  return unique(
    installedApps().flatMap((app) =>
      (getProcessDefinition(app.processId)?.stages ?? []).flatMap((stage) => [
        ...stage.requiredSources.map((source) => source.connectorInstanceId),
        ...stage.helpfulSources.map((source) => source.connectorInstanceId),
        ...stage.tools.map((tool) => tool.connectorInstanceId),
      ]),
    ).filter((id): id is string => typeof id === "string" && id.length > 0),
  );
}

export function seededCohort(): typeof productCohorts.$inferInsert {
  return {
    id: SEEDED_COHORT_ID,
    name: "Design-partner pilot cohort",
    nameDe: "Pilotkohorte Designpartner",
    description:
      "The two pilot accounts in src/identity/pilot-config.ts, one per Available role. Synthetic accounts; the design partner names its users at setup.",
    userIds: PILOT_USERS.filter((user) => !user.isAdministrator).map((user) => user.userId),
    roleIds: PILOT_ROLE_IDS,
    legalEntityIds: PILOT_LEGAL_ENTITY_IDS,
    pilotProgrammeId: SEEDED_PILOT_ID,
    createdAt: PRODUCT_SEEDED_AT,
    createdByLabel: SEED_ACTOR,
  };
}

function brandSupport(id: string): { label: string; channel: string } | null {
  const profile = PRODUCT_BRAND_PROFILES.find((entry) => entry.id === id);
  if (!profile?.supportLabel) return null;
  return { label: profile.supportLabel, channel: profile.supportUrl ?? "" };
}

export function seededPilotProgramme(): typeof pilotProgrammes.$inferInsert {
  const contacts = [
    { support: brandSupport(DEFAULT_BRAND_PROFILE_ID), role: "Service desk for pilot users" },
    { support: brandSupport(OPERATOR_BRAND_PROFILE_ID), role: "Product team" },
  ].flatMap(({ support, role }) => (support ? [{ label: support.label, role, channel: support.channel }] : []));

  return {
    id: SEEDED_PILOT_ID,
    name: "Design-partner pilot: Operational Risk Partner and Third-Party Risk Manager",
    nameDe: "Designpartner-Pilot: Operational Risk Partner und Third-Party Risk Manager",
    status: "setup",
    businessArea: "Second line non-financial risk at Arcadia Bank AG: operational risk and third-party risk",
    businessAreaDe: "Nichtfinanzielle Risiken der zweiten Verteidigungslinie bei der Arcadia Bank AG: operationelles Risiko und Drittparteienrisiko",
    legalEntityIds: PILOT_LEGAL_ENTITY_IDS,
    cohortId: SEEDED_COHORT_ID,
    roleIds: PILOT_ROLE_IDS,
    roleAppIds: installedApps().map((app) => app.id),
    sourceSystemIds: pilotSourceSystemIds(),
    authority: {
      entitlementProfileId: RESTRICTED_ENTITLEMENT_PROFILE_ID,
      maxAutonomyLevel: "act-with-approval",
      autonomousExecution: false,
      note: "Every material change needs a named person's approval, bound to the exact change. Nothing executes within policy without a person.",
    },
    supportContacts: contacts,
    plannedStartOn: null,
    plannedEndOn: null,
    startedAt: null,
    closedAt: null,
    createdAt: PRODUCT_SEEDED_AT,
    createdByLabel: SEED_ACTOR,
    updatedAt: PRODUCT_SEEDED_AT,
  };
}

/**
 * The six baseline measures of plan section 7.7, none of them measured.
 *
 * A baseline is the design partner's own current figure. Nobody has taken
 * one, so every measure is `not-measured`, with no value and no target: the
 * pilot lead records the baseline and agrees the success criterion with the
 * design partner. Weekly readings come from the source named on each measure;
 * "systems opened" is recorded by the pilot lead, never tracked.
 */
export function seededPilotMeasures(): (typeof pilotMeasures.$inferInsert)[] {
  const measures: Array<Omit<typeof pilotMeasures.$inferInsert, "id" | "pilotId" | "baselineStatus" | "sortOrder">> = [
    {
      key: "preparation-time",
      label: "Preparation time",
      labelDe: "Vorbereitungszeit",
      kind: "efficiency",
      unit: "minutes",
      direction: "lower-is-better",
      method: "Time a professional spends preparing one process stage or one meeting before the judgment.",
      methodDe: "Zeit, die eine Fachkraft fuer die Vorbereitung einer Prozessstufe oder einer Besprechung vor der Beurteilung aufwendet.",
      source: "recorded-by-pilot-lead",
    },
    {
      key: "cycle-time",
      label: "Cycle time",
      labelDe: "Durchlaufzeit",
      kind: "efficiency",
      unit: "days",
      direction: "lower-is-better",
      method: "Calendar days from the start of a process run to its completion: one RCSA cycle or one supplier onboarding.",
      methodDe: "Kalendertage vom Beginn eines Prozesslaufs bis zu seinem Abschluss: ein RCSA-Zyklus oder eine Lieferantenaufnahme.",
      source: "os-events",
    },
    {
      key: "handoffs",
      label: "Handoffs",
      labelDe: "Uebergaben",
      kind: "efficiency",
      unit: "count",
      direction: "lower-is-better",
      method: "Times the work passes between people or teams within one process run.",
      methodDe: "Anzahl der Uebergaben zwischen Personen oder Teams innerhalb eines Prozesslaufs.",
      source: "os-events",
    },
    {
      key: "systems-opened",
      label: "Systems opened",
      labelDe: "Geoeffnete Systeme",
      kind: "efficiency",
      unit: "count",
      direction: "lower-is-better",
      method: "Separate systems a professional opens to complete one stage, as the pilot lead observes and records it.",
      methodDe: "Anzahl getrennter Systeme, die eine Fachkraft fuer eine Stufe oeffnet, wie sie die Pilotleitung beobachtet und erfasst.",
      source: "recorded-by-pilot-lead",
    },
    {
      key: "overdue-actions",
      label: "Overdue actions",
      labelDe: "Ueberfaellige Massnahmen",
      kind: "control",
      unit: "count",
      direction: "lower-is-better",
      method: "Open actions past their due date on the pilot roles' desks at the end of the week.",
      methodDe: "Offene Massnahmen nach Faelligkeit auf den Arbeitslisten der Pilotrollen am Ende der Woche.",
      source: "action-register",
    },
    {
      key: "evidence-completeness",
      label: "Evidence completeness",
      labelDe: "Vollstaendigkeit der Nachweise",
      kind: "control",
      unit: "percent",
      direction: "higher-is-better",
      method: "Share of required evidence received and reviewed when a stage decision is taken.",
      methodDe: "Anteil der erforderlichen Nachweise, die bei einer Stufenentscheidung vorliegen und geprueft sind.",
      source: "process-runtime",
    },
  ];

  return measures.map((measure, index) => ({
    ...measure,
    id: `${SEEDED_PILOT_ID}-M-${measure.key}`,
    pilotId: SEEDED_PILOT_ID,
    target: null,
    baselineStatus: "not-measured" as const,
    baselineValue: null,
    baselinePeriod: null,
    baselineRecordedAt: null,
    baselineRecordedByLabel: null,
    sortOrder: index + 1,
  }));
}

/* ==========================================================================
   The writer
   ========================================================================== */

export interface ProductStateSeedSummary {
  rowsWritten: number;
  counts: Record<string, number>;
}

/**
 * Writes the product state.
 *
 * One transaction, delete then insert, the product state tables only.
 */
export function seedProductState(): ProductStateSeedSummary {
  const counts: Record<string, number> = {};

  const write = getSqlite().transaction(() => {
    const db = getDb();
    for (const table of PRODUCT_STATE_TABLES) db.delete(table).run();

    const versions = seededRoleAppVersions();
    const events = seededRoleAppLifecycleEvents();
    const enablements = seededRoleAppEnablements();
    const measures = seededPilotMeasures();

    db.insert(roleAppVersions).values(versions).run();
    db.insert(roleAppLifecycleEvents).values(events).run();
    if (enablements.length > 0) db.insert(roleAppEnablements).values(enablements).run();
    db.insert(pilotProgrammes).values([seededPilotProgramme()]).run();
    db.insert(productCohorts).values([seededCohort()]).run();
    db.insert(pilotMeasures).values(measures).run();

    counts.roleAppVersions = versions.length;
    counts.roleAppLifecycleEvents = events.length;
    counts.roleAppEnablements = enablements.length;
    counts.pilotProgrammes = 1;
    counts.productCohorts = 1;
    counts.pilotMeasures = measures.length;
  });

  write();

  return { rowsWritten: Object.values(counts).reduce((sum, n) => sum + n, 0), counts };
}
