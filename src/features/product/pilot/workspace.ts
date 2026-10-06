/**
 * The design-partner pilot workspace, as one read model.
 *
 * Server only. Everything the pilot pages show is assembled here from the
 * records it comes from, so the route files stay thin and every page reads
 * the same answer:
 *
 *   setup       `pilot_programmes`, its cohort (`product_cohorts`), the
 *               organisation's legal entities with their regulatory context,
 *               the release registry's roles and Role Apps, the connector
 *               instances and the entitlement profiles
 *   baseline    `pilot_measures`, each beside what this environment can
 *               measure about itself from synthetic data (clearly labelled)
 *   weekly      readings, issues, risks and decisions required
 *   exit        the exit decisions, in the order they were taken
 *   history     the audit trail of every pilot record, newest first
 *
 * Nothing here writes. Nothing here computes a baseline, a target or a
 * saving.
 */

import { listPilotExitDecisions, listPilotIssues, listPilotMeasureReadings, listPilotMeasures, listPilotProgrammes, type PilotExitDecision, type PilotIssue, type PilotMeasure, type PilotMeasureReading, type PilotProgramme } from "@/db/repositories/pilot";
import { getCohort } from "@/db/repositories/role-app-release";
import type { AutonomyLevel } from "@/db/schema/core";
import type { PilotStatus, PilotSupportContact } from "@/db/schema/product-console";
import { PILOT_USERS } from "@/identity/pilot-config";
import { listConnectors } from "@/integrations/runtime/IntegrationRuntime";
import { getProductConfig } from "@/product";
import { listEntitlementProfiles } from "@/product/entitlements/entitlements";
import { ROLE_RELEASE_DEFINITIONS, type RoleReleaseStatus } from "@/product/release/role-release";
import { statusForConnectorMode, type ProductStatus } from "@/product/status/vocabulary";
import { getProcessDefinition, ROLE_APP_REGISTRY } from "@/role-apps/registry";
import { getAuditTrailForObject } from "@/server/security/audit";
import { getScenarioState } from "@/scenario/engine/state";
import { DEFAULT_RUN_ID } from "@/db/schema/core";
import { startConditions, type Bilingual, type CohortCandidate, type SetupOptions } from "./rules";
import { readSyntheticEquivalents, unknownSyntheticEquivalent, type SyntheticEquivalent } from "./synthetic-measures";

/** The audit object kinds pilot changes are recorded against. */
export const PILOT_AUDIT_KINDS = {
  programme: "pilot-programme",
  cohort: "pilot-cohort",
  measure: "pilot-measure",
  issue: "pilot-issue",
} as const;

export interface HistoryEntry {
  id: string;
  at: string;
  category: string;
  summary: string;
  actorUserId: string | null;
  blocked: boolean;
}

export interface WorkspaceLegalEntity {
  id: string;
  name: string;
  country: string;
  regulatoryBloc: string;
  regulatorContext: string[];
  inPilot: boolean;
}

export interface WorkspaceRole {
  roleId: string;
  label: string;
  status: RoleReleaseStatus;
  inPilot: boolean;
}

export interface WorkspaceRoleApp {
  id: string;
  name: Bilingual;
  roleId: string;
  status: string;
  version: string;
  stageCount: number;
  inPilot: boolean;
}

export interface WorkspaceSourceSystem {
  id: string;
  sourceSystem: string;
  mode: string;
  status: ProductStatus;
  inPilot: boolean;
  /** The pilot's Role Apps whose stages read or write through it. */
  usedBy: string[];
}

export interface WorkspaceCohortMember {
  userId: string;
  displayName: string;
  roleIds: string[];
  inCohort: boolean;
  isAdministrator: boolean;
}

export interface WorkspaceMeasure {
  measure: PilotMeasure;
  label: Bilingual;
  method: Bilingual;
  synthetic: SyntheticEquivalent;
  readings: PilotMeasureReading[];
  history: HistoryEntry[];
}

export interface PilotWorkspace {
  pilot: PilotProgramme;
  name: Bilingual;
  businessArea: Bilingual;
  status: PilotStatus;
  runId: string;
  scenarioDate: string | null;
  cohort: { id: string; name: Bilingual; userIds: string[] } | null;
  people: WorkspaceCohortMember[];
  legalEntities: WorkspaceLegalEntity[];
  roles: WorkspaceRole[];
  roleApps: WorkspaceRoleApp[];
  sourceSystems: WorkspaceSourceSystem[];
  authority: {
    entitlementProfileId: string | null;
    entitlementProfileName: string | null;
    maxAutonomyLevel: AutonomyLevel;
    autonomousExecution: boolean;
    note: string;
  };
  entitlementProfiles: Array<{ id: string; name: string }>;
  supportContacts: PilotSupportContact[];
  measures: WorkspaceMeasure[];
  readings: PilotMeasureReading[];
  issues: PilotIssue[];
  exitDecisions: PilotExitDecision[];
  startConditions: Bilingual[];
  history: HistoryEntry[];
  /** What setup may choose from, for the rules. */
  options: SetupOptions;
  candidates: CohortCandidate[];
}

function runIdNow(): string {
  try {
    return getScenarioState()?.runId ?? DEFAULT_RUN_ID;
  } catch {
    return DEFAULT_RUN_ID;
  }
}

function historyFor(runId: string, kind: string, id: string): HistoryEntry[] {
  try {
    return getAuditTrailForObject(runId, kind, id).map((row) => ({
      id: row.id,
      at: row.recordedAt,
      category: row.category,
      summary: row.summary,
      actorUserId: row.actorUserId,
      blocked: row.blocked,
    }));
  } catch {
    return [];
  }
}

/** The connector instances each installed app's stages read from or write to. */
function connectorUse(roleAppIds: readonly string[]): Map<string, string[]> {
  const use = new Map<string, string[]>();
  for (const app of ROLE_APP_REGISTRY.filter((entry) => roleAppIds.includes(entry.id))) {
    const process = getProcessDefinition(app.processId);
    for (const stage of process?.stages ?? []) {
      const ids = [
        ...stage.requiredSources.map((source) => source.connectorInstanceId),
        ...stage.helpfulSources.map((source) => source.connectorInstanceId),
        ...stage.tools.map((tool) => tool.connectorInstanceId),
      ].filter((id): id is string => typeof id === "string" && id.length > 0);
      for (const id of ids) {
        const list = use.get(id) ?? [];
        if (!list.includes(app.name)) list.push(app.name);
        use.set(id, list);
      }
    }
  }
  return use;
}

/** The setup options, read from configuration and the release registry. */
export function readSetupOptions(): SetupOptions {
  const config = getProductConfig();
  let connectorIds: string[] = [];
  try {
    connectorIds = listConnectors().map((connector) => connector.id);
  } catch {
    connectorIds = [];
  }
  return {
    legalEntityIds: config.organisation.legalEntities.map((entity) => entity.id),
    roles: ROLE_RELEASE_DEFINITIONS.map((role) => ({ roleId: role.roleId, status: role.status, label: role.releaseLabel })),
    roleApps: ROLE_APP_REGISTRY.map((app) => ({ id: app.id, roleId: app.roleId, status: app.status, name: app.name })),
    connectorIds,
    entitlementProfileIds: listEntitlementProfiles().map((profile) => profile.id),
  };
}

/** The identity accounts a cohort may hold. */
export function readCohortCandidates(): CohortCandidate[] {
  return PILOT_USERS.map((user) => ({ userId: user.userId, roleIds: [...user.roleIds], isAdministrator: user.isAdministrator }));
}

/** The pilot the workspace manages: the first programme, which the seed writes in setup. */
export function readCurrentPilot(): PilotProgramme | null {
  try {
    return listPilotProgrammes()[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The whole workspace for one pilot, or null when no pilot is configured.
 */
export function readPilotWorkspace(pilotId?: string): PilotWorkspace | null {
  let found: PilotProgramme | null = null;
  try {
    const programmes = listPilotProgrammes();
    found = (pilotId ? programmes.find((entry) => entry.id === pilotId) : programmes[0]) ?? null;
  } catch {
    found = null;
  }
  if (!found) return null;
  const pilot: PilotProgramme = found;

  const runId = runIdNow();
  const state = (() => {
    try {
      return getScenarioState(runId);
    } catch {
      return null;
    }
  })();
  const config = getProductConfig();
  const options = readSetupOptions();
  const candidates = readCohortCandidates();

  const cohortRow = pilot.cohortId ? getCohort(pilot.cohortId) : undefined;
  const cohortUserIds = cohortRow ? [...cohortRow.userIds] : [];

  const people: WorkspaceCohortMember[] = PILOT_USERS.map((user) => ({
    userId: user.userId,
    displayName: user.displayName,
    roleIds: [...user.roleIds],
    inCohort: cohortUserIds.includes(user.userId),
    isAdministrator: user.isAdministrator,
  }));

  const legalEntities: WorkspaceLegalEntity[] = config.organisation.legalEntities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    country: entity.country,
    regulatoryBloc: entity.regulatoryBloc,
    regulatorContext: [...entity.regulatorContext],
    inPilot: pilot.legalEntityIds.includes(entity.id),
  }));

  const roles: WorkspaceRole[] = ROLE_RELEASE_DEFINITIONS.filter((role) => role.status !== "hidden").map((role) => ({
    roleId: role.roleId,
    label: role.releaseLabel,
    status: role.status,
    inPilot: (pilot.roleIds as readonly string[]).includes(role.roleId),
  }));

  const roleApps: WorkspaceRoleApp[] = ROLE_APP_REGISTRY.map((app) => ({
    id: app.id,
    name: { en: app.name, de: app.nameDe },
    roleId: app.roleId,
    status: app.status,
    version: app.version,
    stageCount: getProcessDefinition(app.processId)?.stages.length ?? app.coveredStageIds.length,
    inPilot: pilot.roleAppIds.includes(app.id),
  }));

  const use = connectorUse(pilot.roleAppIds);
  let sourceSystems: WorkspaceSourceSystem[] = [];
  try {
    sourceSystems = listConnectors().map((connector) => ({
      id: connector.id,
      sourceSystem: connector.sourceSystem,
      mode: connector.mode,
      status: statusForConnectorMode(connector.mode),
      inPilot: pilot.sourceSystemIds.includes(connector.id),
      usedBy: use.get(connector.id) ?? [],
    }));
  } catch {
    sourceSystems = [];
  }

  const profiles = listEntitlementProfiles();
  const authority = pilot.authority;

  const scope = { roleIds: pilot.roleIds, roleAppIds: pilot.roleAppIds, runId };
  const synthetic = readSyntheticEquivalents(scope);
  const readings = listPilotMeasureReadings(pilot.id);
  const measures: WorkspaceMeasure[] = listPilotMeasures(pilot.id).map((measure) => ({
    measure,
    label: { en: measure.label, de: measure.labelDe },
    method: { en: measure.method, de: measure.methodDe },
    synthetic: synthetic.get(measure.key) ?? unknownSyntheticEquivalent(measure.key, measure.unit),
    readings: readings.filter((entry) => entry.measureId === measure.id),
    history: historyFor(runId, PILOT_AUDIT_KINDS.measure, measure.id),
  }));

  const issues = listPilotIssues(pilot.id);
  const exitDecisions = listPilotExitDecisions(pilot.id);

  const history = [
    ...historyFor(runId, PILOT_AUDIT_KINDS.programme, pilot.id),
    ...(pilot.cohortId ? historyFor(runId, PILOT_AUDIT_KINDS.cohort, pilot.cohortId) : []),
    ...measures.flatMap((entry) => entry.history),
    ...issues.flatMap((issue) => historyFor(runId, PILOT_AUDIT_KINDS.issue, issue.id)),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return {
    pilot,
    name: { en: pilot.name, de: pilot.nameDe },
    businessArea: { en: pilot.businessArea, de: pilot.businessAreaDe },
    status: pilot.status,
    runId,
    scenarioDate: state?.scenarioDate ?? null,
    cohort: cohortRow ? { id: cohortRow.id, name: { en: cohortRow.name, de: cohortRow.nameDe }, userIds: cohortUserIds } : null,
    people,
    legalEntities,
    roles,
    roleApps,
    sourceSystems,
    authority: {
      entitlementProfileId: authority.entitlementProfileId,
      entitlementProfileName: profiles.find((profile) => profile.id === authority.entitlementProfileId)?.name ?? null,
      maxAutonomyLevel: authority.maxAutonomyLevel,
      autonomousExecution: authority.autonomousExecution,
      note: authority.note,
    },
    entitlementProfiles: profiles.map((profile) => ({ id: profile.id, name: profile.name })),
    supportContacts: [...pilot.supportContacts],
    measures,
    readings,
    issues,
    exitDecisions,
    startConditions: startConditions({
      status: pilot.status,
      plannedStartOn: pilot.plannedStartOn,
      plannedEndOn: pilot.plannedEndOn,
      cohortSize: cohortUserIds.length,
      baselines: measures.map((entry) => ({ label: entry.label, status: entry.measure.baselineStatus })),
    }),
    history,
    options,
    candidates,
  };
}
