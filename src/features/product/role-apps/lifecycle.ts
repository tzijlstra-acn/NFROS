/**
 * The Role App lifecycle actions (plan 7.2).
 *
 *   Create candidate version   record a new version from the reviewed code
 *   Compare versions           (compare.ts)
 *   Run evaluations            (evaluations.ts; Unavailable until the
 *                              quality service is connected)
 *   Assign pilot cohort        enable a candidate for one cohort
 *   Approve release            make a candidate the installed version
 *   Enable, Disable            the tenant enablement the workday obeys
 *   Roll back                  restore the previous released version
 *   Retire                     withdraw the app; its runs are kept
 *
 * Each action is two functions. `propose*` reads the current state and
 * returns the change (its payload and fingerprint), the lines that say in
 * plain words what will change, and the reason it cannot be done now, if
 * there is one. The page renders the proposal; the material ones become the
 * approval the person gives. The action function recomputes the proposal
 * from the state at submission and hands it to `governConsoleAction`, which
 * checks the persona's authority, the approval's fingerprint and the rule,
 * and writes the change and its audit record together.
 *
 * What these actions do not do: they never upload or change code. A version
 * is a release record of reviewed code; a candidate captures the manifest of
 * the definition in this build (plan 7.2: "Do not allow arbitrary code
 * upload"). Approving or rolling back a version changes release state and
 * enablement, not the definition that runs, and the approval says so. No
 * action can install a Role App the code registry does not mark installed.
 *
 * Server only.
 */

import {
  changeRoleAppVersionState,
  createRoleAppVersion,
  getCurrentRoleAppVersion,
  getRoleAppVersion,
  listCohorts,
  listRoleAppEnablements,
  listRoleAppVersions,
  setRoleAppEnablement,
  setRoleAppVersionSupportState,
  type ReleaseActor,
  type RoleAppVersion,
} from "@/db/repositories/role-app-release";
import { getRunsForApp } from "@/db/repositories/role-app-runtime";
import { buildRoleAppManifest, roleAppVersionId, supportStateFor } from "@/db/seed/product-state";
import { ENABLEMENT_TENANT_ID, readRoleAppAvailability } from "@/role-apps/enablement";
import { getProcessDefinition, getRoleApp } from "@/role-apps/registry";
import type { RoleAppDefinition } from "@/role-apps/contracts";
import {
  fingerprintConsoleChange,
  governConsoleAction,
  type ConsoleActionResult,
  type ConsoleApprovalInput,
  type ConsoleExecutionContext,
  type ConsoleTarget,
} from "../governance";
import type { Bilingual, ConsoleActionId } from "../permissions";
import { readMigrationState } from "../releases/migrations";
import { sameDefinition } from "./compare";
import { roleAppEvaluationCapability, startVersionEvaluations, verdictReason, versionEvaluationVerdict } from "./evaluations";

export interface LifecycleProposal {
  actionId: ConsoleActionId;
  target: ConsoleTarget;
  payload: Record<string, unknown>;
  fingerprint: string;
  /** What will change, in plain words. */
  lines: Bilingual[];
  /** Why it cannot be done now, or null. */
  blocked: Bilingual | null;
}

const OPEN_CANDIDATE_STATES = new Set<RoleAppVersion["lifecycleState"]>(["draft", "candidate", "pilot"]);

function proposal(
  actionId: ConsoleActionId,
  target: ConsoleTarget,
  payload: Record<string, unknown>,
  lines: Bilingual[],
  blocked: Bilingual | null,
): LifecycleProposal {
  return { actionId, target, payload, fingerprint: fingerprintConsoleChange(actionId, payload), lines, blocked };
}

function releaseActor(context: ConsoleExecutionContext, reason?: string, evaluationRunId?: string | null): ReleaseActor {
  return {
    actorKind: "human",
    actorUserId: context.actor.userId,
    actorLabel: context.actor.label,
    at: context.at,
    reason: reason ?? context.rationale,
    approvalId: context.approvalId,
    ...(evaluationRunId !== undefined ? { evaluationRunId } : {}),
  };
}

function appTarget(roleAppId: string): ConsoleTarget {
  return { kind: "role-app", id: roleAppId };
}

function unknownApp(roleAppId: string): Bilingual {
  return { en: `There is no Role App ${roleAppId}.`, de: `Es gibt keine Rollen-App ${roleAppId}.` };
}

function notInstalled(app: RoleAppDefinition): Bilingual {
  return {
    en: `${app.name} is a catalogue entry, not an installed Role App. Its state changes only through reviewed code; this console cannot install it.`,
    de: `${app.nameDe} ist ein Katalogeintrag, keine installierte Rollen-App. Ihr Zustand aendert sich nur ueber geprueften Code; diese Konsole kann sie nicht installieren.`,
  };
}

/** Active runs of an app, which a disable or retire keeps as they are. */
function activeRunCount(roleAppId: string): number {
  const app = getRoleApp(roleAppId);
  if (!app) return 0;
  try {
    return getRunsForApp(app.roleId, roleAppId).filter((run) => run.status !== "completed").length;
  } catch {
    return 0;
  }
}

/** The open candidate of an app: a version that is not current and not yet released. */
export function openCandidate(roleAppId: string): RoleAppVersion | undefined {
  return listRoleAppVersions(roleAppId).find((version) => !version.isCurrent && OPEN_CANDIDATE_STATES.has(version.lifecycleState));
}

/** The version a rollback restores: the most recently released version that is not current. */
export function rollbackTarget(roleAppId: string): RoleAppVersion | undefined {
  const current = getCurrentRoleAppVersion(roleAppId);
  if (current?.lifecycleState === "retired") return current;
  return listRoleAppVersions(roleAppId)
    .filter((version) => !version.isCurrent && version.releasedAt !== null && version.lifecycleState === "retired")
    .sort((a, b) => (a.releasedAt ?? "").localeCompare(b.releasedAt ?? ""))
    .at(-1);
}

/* ==========================================================================
   Versions
   ========================================================================== */

/** "1.2.3" to its parts, or null. */
export function parseVersion(value: string): [number, number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersionNumbers(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** The next minor version after every version the app has. */
export function suggestNextVersion(versions: readonly Pick<RoleAppVersion, "version">[]): string {
  const parsed = versions.map((entry) => parseVersion(entry.version)).filter((entry): entry is [number, number, number] => entry !== null);
  const highest = parsed.sort(compareVersionNumbers).at(-1) ?? [1, 0, 0];
  return `${highest[0]}.${highest[1] + 1}.0`;
}

export interface CandidateInput {
  version: string;
  notes: string;
  notesDe: string;
}

/**
 * Why no candidate can be created for an app whatever version is typed: it
 * is not an installed app, or it already has an open candidate. Null when a
 * candidate can be created.
 */
export function candidateStructuralBlock(roleAppId: string): Bilingual | null {
  const app = getRoleApp(roleAppId);
  if (!app) return unknownApp(roleAppId);
  if (app.status !== "installed" || !getProcessDefinition(app.processId)) return notInstalled(app);
  const open = openCandidate(roleAppId);
  if (open) {
    return {
      en: `${app.name} already has an open candidate (${open.version}). Decide it before a new candidate is created.`,
      de: `${app.nameDe} hat bereits einen offenen Kandidaten (${open.version}). Entscheiden Sie ihn, bevor ein neuer Kandidat angelegt wird.`,
    };
  }
  return null;
}

/** Create candidate version: what would be recorded, and why not. */
export function proposeCreateCandidate(roleAppId: string, input: CandidateInput | null): LifecycleProposal {
  const app = getRoleApp(roleAppId);
  const target = appTarget(roleAppId);
  if (!app) return proposal("role-app.create-candidate", target, { roleAppId }, [], unknownApp(roleAppId));
  const versions = listRoleAppVersions(roleAppId);
  const process = getProcessDefinition(app.processId);
  const manifest = buildRoleAppManifest(app, process);
  const current = getCurrentRoleAppVersion(roleAppId);
  const version = input?.version.trim() ?? suggestNextVersion(versions);
  const migration = readMigrationState().latestTag;
  const payload = { roleAppId, version, digest: manifest.processDefinitionDigest, migration };

  const lines: Bilingual[] = [
    {
      en: `Version ${version} of ${app.name} is recorded as a Candidate, not current and not enabled anywhere.`,
      de: `Version ${version} von ${app.nameDe} wird als Kandidat erfasst, nicht aktuell und nirgends freigeschaltet.`,
    },
    {
      en: `Its manifest is read from the reviewed definition in this build: ${manifest.processStageIds.length} stages, ${manifest.implementedStageIds.length} run end to end, ${manifest.tools.length} tools, ${manifest.evaluations.configurationIds.length} AI configurations.`,
      de: `Sein Manifest wird aus der geprueften Definition dieses Builds gelesen: ${manifest.processStageIds.length} Stufen, davon ${manifest.implementedStageIds.length} vollstaendig ausfuehrbar, ${manifest.tools.length} Werkzeuge, ${manifest.evaluations.configurationIds.length} KI-Konfigurationen.`,
    },
    current && current.processDefinitionDigest === manifest.processDefinitionDigest
      ? {
          en: `The definition is the same as the current version ${current.version} (digest ${manifest.processDefinitionDigest ?? "-"}): the candidate differs in its release notes only.`,
          de: `Die Definition entspricht der aktuellen Version ${current.version} (Digest ${manifest.processDefinitionDigest ?? "-"}): Der Kandidat unterscheidet sich nur in den Release-Hinweisen.`,
        }
      : {
          en: `The definition differs from the current version (digest ${manifest.processDefinitionDigest ?? "-"}).`,
          de: `Die Definition unterscheidet sich von der aktuellen Version (Digest ${manifest.processDefinitionDigest ?? "-"}).`,
        },
  ];

  let blocked: Bilingual | null = candidateStructuralBlock(roleAppId);
  const parsed = parseVersion(version);
  const highest = versions
    .map((entry) => parseVersion(entry.version))
    .filter((entry): entry is [number, number, number] => entry !== null)
    .sort(compareVersionNumbers)
    .at(-1);
  if (blocked) {
    /* An open candidate, or not an installed app: whatever version is typed. */
  } else if (!parsed) blocked = { en: "Give the version as three numbers, for example 1.1.0.", de: "Geben Sie die Version als drei Zahlen an, zum Beispiel 1.1.0." };
  else if (highest && compareVersionNumbers(parsed, highest) <= 0)
    blocked = {
      en: `The version must be higher than ${highest.join(".")}, the highest version recorded.`,
      de: `Die Version muss hoeher sein als ${highest.join(".")}, die hoechste erfasste Version.`,
    };
  else if (input && (input.notes.trim().length < 10 || input.notesDe.trim().length < 10))
    blocked = {
      en: "Write the release notes in English and German (at least 10 characters each).",
      de: "Schreiben Sie die Release-Hinweise auf Englisch und Deutsch (jeweils mindestens 10 Zeichen).",
    };

  return proposal("role-app.create-candidate", target, payload, lines, blocked);
}

export async function createCandidateVersion(roleAppId: string, input: CandidateInput): Promise<ConsoleActionResult<RoleAppVersion>> {
  const proposed = proposeCreateCandidate(roleAppId, input);
  const app = getRoleApp(roleAppId);
  return governConsoleAction({
    actionId: "role-app.create-candidate",
    target: proposed.target,
    payload: proposed.payload,
    summary: { en: `Create candidate version ${input.version} of ${roleAppId}.`, de: `Kandidatenversion ${input.version} von ${roleAppId} anlegen.` },
    rule: () => proposed.blocked,
    execute: (context) => {
      if (!app) throw new Error(`Unknown Role App ${roleAppId}.`);
      const manifest = buildRoleAppManifest(app, getProcessDefinition(app.processId));
      return createRoleAppVersion(
        {
          id: roleAppVersionId({ id: app.id, version: input.version.trim() }),
          roleAppId: app.id,
          roleId: app.roleId,
          version: input.version.trim(),
          lifecycleState: "candidate",
          isCurrent: false,
          processId: manifest.processId,
          processDefinitionDigest: manifest.processDefinitionDigest,
          processStageIds: manifest.processStageIds,
          implementedStageIds: manifest.implementedStageIds,
          sourceRequirements: manifest.sourceRequirements,
          tools: manifest.tools,
          authority: manifest.authority,
          evaluations: manifest.evaluations,
          connectorDependencies: manifest.connectorDependencies,
          migrationTag: readMigrationState().latestTag,
          releaseNotes: input.notes.trim(),
          releaseNotesDe: input.notesDe.trim(),
          supportState: supportStateFor("candidate"),
          evaluationRunId: null,
          approvalId: null,
          createdAt: context.at,
          createdByLabel: context.actor.label,
          releasedAt: null,
        },
        releaseActor(context, "Candidate version recorded from the reviewed definition in this build."),
      );
    },
    success: (version) => ({
      en: `Candidate ${version.version} recorded. Evaluate it before it can be released.`,
      de: `Kandidat ${version.version} erfasst. Evaluieren Sie ihn, bevor er freigegeben werden kann.`,
    }),
  });
}

/* ==========================================================================
   Run evaluations
   ========================================================================== */

export async function runVersionEvaluations(versionId: string): Promise<ConsoleActionResult<string[]>> {
  const version = getRoleAppVersion(versionId);
  const capability = roleAppEvaluationCapability();
  return governConsoleAction<undefined, string[]>({
    actionId: "role-app.run-evaluations",
    target: { kind: "role-app-version", id: versionId },
    payload: { versionId },
    summary: { en: `Run evaluations for ${versionId}.`, de: `Evaluationen fuer ${versionId} ausfuehren.` },
    rule: () =>
      !version
        ? { en: `There is no version ${versionId}.`, de: `Es gibt keine Version ${versionId}.` }
        : !capability.available
          ? capability.reason
          : !OPEN_CANDIDATE_STATES.has(version.lifecycleState)
            ? { en: "Only a candidate or pilot version is evaluated here.", de: "Hier werden nur Kandidaten- oder Pilotversionen evaluiert." }
            : null,
    execute: (context) => {
      if (!version) throw new Error("The version disappeared.");
      const result = startVersionEvaluations(version, { label: context.actor.label, userId: context.actor.userId });
      if (!result.ok) throw new Error(result.reason.en);
      return result.runIds;
    },
    success: (runIds) => {
      const verdict = version ? verdictReason(versionEvaluationVerdict(version)) : null;
      return {
        en: `${runIds.length} evaluation run(s) recorded. ${verdict?.en ?? ""}`.trim(),
        de: `${runIds.length} Evaluationslauf bzw. -laeufe erfasst. ${verdict?.de ?? ""}`.trim(),
      };
    },
  });
}

/* ==========================================================================
   Assign pilot cohort
   ========================================================================== */

export function proposeAssignPilotCohort(versionId: string, cohortId: string | null): LifecycleProposal {
  const version = getRoleAppVersion(versionId);
  const target: ConsoleTarget = { kind: "role-app-version", id: versionId };
  if (!version) return proposal("role-app.assign-pilot-cohort", target, { versionId }, [], { en: `There is no version ${versionId}.`, de: `Es gibt keine Version ${versionId}.` });
  const cohorts = listCohorts();
  const cohort = cohorts.find((entry) => entry.id === cohortId) ?? cohorts[0];
  const existing = listRoleAppEnablements(version.roleAppId).find((entry) => entry.scopeKind === "cohort" && entry.scopeId === cohort?.id);
  const payload = {
    versionId,
    state: version.lifecycleState,
    cohortId: cohort?.id ?? null,
    cohortMembers: cohort?.userIds.length ?? 0,
    pinned: existing?.versionId ?? null,
    pinnedEnabled: existing?.enabled ?? null,
  };
  const verdict = versionEvaluationVerdict(version);
  const lines: Bilingual[] = cohort
    ? [
        {
          en: `Version ${version.version} is enabled for the cohort "${cohort.name}" (${cohort.userIds.length} members) as a pilot.`,
          de: `Version ${version.version} wird fuer die Kohorte "${cohort.nameDe}" (${cohort.userIds.length} Mitglieder) als Pilot freigeschaltet.`,
        },
        ...(version.lifecycleState === "candidate"
          ? [{ en: "The version moves from Candidate to Pilot.", de: "Die Version wechselt von Kandidat zu Pilot." }]
          : []),
        {
          en: "Cohort members who sign in with their own accounts get this version. The demonstration workday acts as the role holder and follows the tenant setting.",
          de: "Kohortenmitglieder, die sich mit eigenen Konten anmelden, erhalten diese Version. Der Demonstrations-Arbeitstag handelt als Rolleninhaber und folgt der Mandanteneinstellung.",
        },
        ...(verdict.kind !== "passed" && verdict.kind !== "no-configurations" ? [verdictReason(verdict)] : []),
      ]
    : [];
  const blocked: Bilingual | null = !cohort
    ? { en: "No cohort is recorded. A pilot cohort is set up on the Pilot page.", de: "Es ist keine Kohorte erfasst. Eine Pilotkohorte wird auf der Seite Pilot eingerichtet." }
    : version.lifecycleState !== "candidate" && version.lifecycleState !== "pilot"
      ? {
          en: `Only a candidate can be assigned to a pilot cohort; version ${version.version} is ${version.lifecycleState}.`,
          de: `Nur ein Kandidat kann einer Pilotkohorte zugewiesen werden; Version ${version.version} ist im Zustand ${version.lifecycleState}.`,
        }
      : verdict.kind === "failed"
        ? verdictReason(verdict)
        : existing?.enabled && existing.versionId === versionId
          ? { en: `Version ${version.version} is already assigned to this cohort.`, de: `Version ${version.version} ist dieser Kohorte bereits zugewiesen.` }
          : null;
  return proposal("role-app.assign-pilot-cohort", target, payload, lines, blocked);
}

export async function assignPilotCohort(
  versionId: string,
  cohortId: string | null,
  approval: ConsoleApprovalInput,
): Promise<ConsoleActionResult<null>> {
  const proposed = proposeAssignPilotCohort(versionId, cohortId);
  const version = getRoleAppVersion(versionId);
  const cohort = proposed.payload["cohortId"] as string | null;
  return governConsoleAction({
    actionId: "role-app.assign-pilot-cohort",
    target: proposed.target,
    payload: proposed.payload,
    approval,
    summary: { en: `Assign ${versionId} to cohort ${cohort ?? "-"}.`, de: `${versionId} der Kohorte ${cohort ?? "-"} zuweisen.` },
    rule: () => proposed.blocked,
    execute: (context) => {
      if (!version || !cohort) throw new Error("The version or cohort disappeared.");
      setRoleAppEnablement(
        { roleAppId: version.roleAppId, scopeKind: "cohort", scopeId: cohort, enabled: true, versionId },
        releaseActor(context),
      );
      if (version.lifecycleState === "candidate") {
        changeRoleAppVersionState(versionId, { toState: "pilot" }, releaseActor(context));
      }
      return null;
    },
    success: () => ({
      en: `Version ${version?.version ?? versionId} is assigned to the pilot cohort.`,
      de: `Version ${version?.version ?? versionId} ist der Pilotkohorte zugewiesen.`,
    }),
  });
}

/* ==========================================================================
   Approve release
   ========================================================================== */

function definitionLine(left: RoleAppVersion, right: RoleAppVersion | undefined): Bilingual {
  if (right && sameDefinition(left, right)) {
    return {
      en: `Release state only: both versions record the same reviewed definition (digest ${left.processDefinitionDigest ?? "-"}), which is the code that runs in this build.`,
      de: `Nur Release-Zustand: Beide Versionen erfassen dieselbe gepruefte Definition (Digest ${left.processDefinitionDigest ?? "-"}), also den Code, der in diesem Build laeuft.`,
    };
  }
  return {
    en: "Release state only: the definition that runs is the reviewed code in this build. This action records which version is in force; it does not change code.",
    de: "Nur Release-Zustand: Es laeuft die gepruefte Definition dieses Builds. Diese Aktion erfasst, welche Version gilt; sie aendert keinen Code.",
  };
}

export function proposeApproveRelease(versionId: string): LifecycleProposal {
  const version = getRoleAppVersion(versionId);
  const target: ConsoleTarget = { kind: "role-app-version", id: versionId };
  if (!version) return proposal("role-app.approve-release", target, { versionId }, [], { en: `There is no version ${versionId}.`, de: `Es gibt keine Version ${versionId}.` });
  const app = getRoleApp(version.roleAppId);
  const current = getCurrentRoleAppVersion(version.roleAppId);
  const verdict = versionEvaluationVerdict(version);
  const payload = {
    versionId,
    state: version.lifecycleState,
    currentVersionId: current?.id ?? null,
    currentState: current?.lifecycleState ?? null,
    evaluation: verdict.kind,
  };
  const lines: Bilingual[] = [
    {
      en: `Version ${version.version} becomes the current Installed version of ${app?.name ?? version.roleAppId}.`,
      de: `Version ${version.version} wird die aktuelle installierte Version von ${app?.nameDe ?? version.roleAppId}.`,
    },
    ...(current && current.id !== version.id
      ? [{ en: `Version ${current.version} is superseded and recorded as Retired. It can be restored with Roll back.`, de: `Version ${current.version} wird abgeloest und als ausser Betrieb erfasst. Mit Zuruecksetzen kann sie wiederhergestellt werden.` }]
      : []),
    definitionLine(version, current),
    verdictReason(verdict),
  ];
  const blocked: Bilingual | null =
    !app || app.status !== "installed"
      ? app
        ? notInstalled(app)
        : unknownApp(version.roleAppId)
      : version.lifecycleState !== "candidate" && version.lifecycleState !== "pilot"
        ? {
            en: `Only a candidate or pilot version can be approved for release; version ${version.version} is ${version.lifecycleState}.`,
            de: `Nur ein Kandidat oder eine Pilotversion kann freigegeben werden; Version ${version.version} ist im Zustand ${version.lifecycleState}.`,
          }
        : verdict.kind === "passed" || verdict.kind === "no-configurations"
          ? null
          : verdictReason(verdict);
  return proposal("role-app.approve-release", target, payload, lines, blocked);
}

export async function approveRoleAppRelease(versionId: string, approval: ConsoleApprovalInput): Promise<ConsoleActionResult<null>> {
  const proposed = proposeApproveRelease(versionId);
  const version = getRoleAppVersion(versionId);
  return governConsoleAction({
    actionId: "role-app.approve-release",
    target: proposed.target,
    payload: proposed.payload,
    approval,
    summary: { en: `Approve release of ${versionId}.`, de: `Release von ${versionId} freigeben.` },
    rule: () => proposed.blocked,
    execute: (context) => {
      if (!version) throw new Error("The version disappeared.");
      const previous = getCurrentRoleAppVersion(version.roleAppId);
      const evaluationRunId = versionEvaluationVerdict(version).runs[0]?.id ?? null;
      changeRoleAppVersionState(versionId, { toState: "installed", makeCurrent: true, releasedAt: context.at }, releaseActor(context, undefined, evaluationRunId));
      setRoleAppVersionSupportState(versionId, supportStateFor("installed"));
      if (previous && previous.id !== versionId) {
        changeRoleAppVersionState(
          previous.id,
          { toState: "retired" },
          releaseActor(context, `Superseded by version ${version.version}.`),
        );
        setRoleAppVersionSupportState(previous.id, supportStateFor("retired"));
      }
      return null;
    },
    success: () => ({
      en: `Version ${version?.version ?? versionId} is released and current.`,
      de: `Version ${version?.version ?? versionId} ist freigegeben und aktuell.`,
    }),
  });
}

/* ==========================================================================
   Enable and Disable
   ========================================================================== */

export function proposeEnablement(roleAppId: string, enabled: boolean): LifecycleProposal {
  const actionId: ConsoleActionId = enabled ? "role-app.enable" : "role-app.disable";
  const app = getRoleApp(roleAppId);
  const target = appTarget(roleAppId);
  if (!app) return proposal(actionId, target, { roleAppId }, [], unknownApp(roleAppId));
  const availability = readRoleAppAvailability(roleAppId);
  const current = getCurrentRoleAppVersion(roleAppId);
  const runs = activeRunCount(roleAppId);
  const payload = {
    roleAppId,
    tenantId: ENABLEMENT_TENANT_ID,
    enabled,
    currentState: availability.state,
    currentVersionId: current?.id ?? null,
  };
  const lines: Bilingual[] = enabled
    ? [
        { en: `${app.name} is enabled for the tenant.`, de: `${app.nameDe} wird fuer den Mandanten freigeschaltet.` },
        {
          en: `Its process pages open again, with ${runs} active run(s) exactly as they were left.`,
          de: `Ihre Prozessseiten oeffnen sich wieder, mit ${runs} aktiven Laeufen genau so, wie sie verlassen wurden.`,
        },
      ]
    : [
        { en: `${app.name} is disabled for the tenant.`, de: `${app.nameDe} wird fuer den Mandanten gesperrt.` },
        {
          en: "Its process pages show the disabled state. No stage can be opened, worked, completed or started, and no preparation runs.",
          de: "Ihre Prozessseiten zeigen den gesperrten Zustand. Keine Stufe kann geoeffnet, bearbeitet, abgeschlossen oder gestartet werden, und keine Vorbereitung laeuft.",
        },
        {
          en: `${runs} active run(s) are kept as they are and resume when the app is enabled again. Links from Home and Work lead to the disabled state.`,
          de: `${runs} aktive Laeufe bleiben unveraendert erhalten und laufen nach erneuter Freischaltung weiter. Links von Start und Arbeit fuehren zum gesperrten Zustand.`,
        },
      ];
  const blocked: Bilingual | null =
    app.status !== "installed"
      ? notInstalled(app)
      : enabled
        ? availability.state === "retired"
          ? {
              en: `${app.name} is retired. Roll it back before enabling it.`,
              de: `${app.nameDe} ist ausser Betrieb. Setzen Sie sie zurueck, bevor Sie sie freischalten.`,
            }
          : availability.runnable
            ? { en: `${app.name} is already enabled.`, de: `${app.nameDe} ist bereits freigeschaltet.` }
            : null
        : availability.runnable
          ? null
          : { en: `${app.name} is already not runnable (${availability.state}).`, de: `${app.nameDe} ist bereits nicht ausfuehrbar (${availability.state}).` };
  return proposal(actionId, target, payload, lines, blocked);
}

export async function setTenantEnablement(
  roleAppId: string,
  enabled: boolean,
  approval: ConsoleApprovalInput,
): Promise<ConsoleActionResult<null>> {
  const proposed = proposeEnablement(roleAppId, enabled);
  const app = getRoleApp(roleAppId);
  return governConsoleAction({
    actionId: proposed.actionId,
    target: proposed.target,
    payload: proposed.payload,
    approval,
    summary: enabled
      ? { en: `Enable ${roleAppId} for the tenant.`, de: `${roleAppId} fuer den Mandanten freischalten.` }
      : { en: `Disable ${roleAppId} for the tenant.`, de: `${roleAppId} fuer den Mandanten sperren.` },
    rule: () => proposed.blocked,
    execute: (context) => {
      setRoleAppEnablement(
        { roleAppId, scopeKind: "tenant", scopeId: ENABLEMENT_TENANT_ID, enabled, versionId: null },
        releaseActor(context),
      );
      return null;
    },
    success: () =>
      enabled
        ? { en: `${app?.name ?? roleAppId} is enabled. Its process pages open again.`, de: `${app?.nameDe ?? roleAppId} ist freigeschaltet. Ihre Prozessseiten oeffnen sich wieder.` }
        : { en: `${app?.name ?? roleAppId} is disabled. Its process pages show the disabled state.`, de: `${app?.nameDe ?? roleAppId} ist gesperrt. Ihre Prozessseiten zeigen den gesperrten Zustand.` },
  });
}

/* ==========================================================================
   Roll back
   ========================================================================== */

export function proposeRollBack(roleAppId: string): LifecycleProposal {
  const app = getRoleApp(roleAppId);
  const target = appTarget(roleAppId);
  if (!app) return proposal("role-app.roll-back", target, { roleAppId }, [], unknownApp(roleAppId));
  const current = getCurrentRoleAppVersion(roleAppId);
  const restore = rollbackTarget(roleAppId);
  const payload = { roleAppId, currentVersionId: current?.id ?? null, currentState: current?.lifecycleState ?? null, restoreVersionId: restore?.id ?? null };
  const restoringRetiredCurrent = restore !== undefined && current !== undefined && restore.id === current.id;
  const lines: Bilingual[] = restore
    ? restoringRetiredCurrent
      ? [
          {
            en: `Version ${restore.version} is restored from Retired to Installed.`,
            de: `Version ${restore.version} wird von ausser Betrieb auf installiert zurueckgesetzt.`,
          },
          {
            en: "The tenant enablement stays as it is: enable the app separately when it should open again.",
            de: "Die Freischaltung des Mandanten bleibt unveraendert: Schalten Sie die App separat frei, wenn sie wieder oeffnen soll.",
          },
        ]
      : [
          {
            en: `Version ${restore.version} becomes the current Installed version again.`,
            de: `Version ${restore.version} wird wieder die aktuelle installierte Version.`,
          },
          ...(current
            ? [{ en: `Version ${current.version} is recorded as Retired (rolled back).`, de: `Version ${current.version} wird als ausser Betrieb erfasst (zurueckgesetzt).` }]
            : []),
          ...(current ? [definitionLine(restore, current)] : []),
        ]
    : [];
  const blocked: Bilingual | null =
    app.status !== "installed"
      ? notInstalled(app)
      : restore
        ? null
        : {
            en: `${app.name} has no earlier released version to roll back to. Only version ${current?.version ?? "-"} has been released.`,
            de: `${app.nameDe} hat keine fruehere freigegebene Version, auf die zurueckgesetzt werden kann. Nur Version ${current?.version ?? "-"} wurde freigegeben.`,
          };
  return proposal("role-app.roll-back", target, payload, lines, blocked);
}

export async function rollBackRoleApp(roleAppId: string, approval: ConsoleApprovalInput): Promise<ConsoleActionResult<null>> {
  const proposed = proposeRollBack(roleAppId);
  return governConsoleAction({
    actionId: "role-app.roll-back",
    target: proposed.target,
    payload: proposed.payload,
    approval,
    summary: { en: `Roll back ${roleAppId}.`, de: `${roleAppId} zuruecksetzen.` },
    rule: () => proposed.blocked,
    execute: (context) => {
      const current = getCurrentRoleAppVersion(roleAppId);
      const restore = rollbackTarget(roleAppId);
      if (!restore) throw new Error("Nothing to roll back to.");
      if (current && restore.id === current.id) {
        changeRoleAppVersionState(restore.id, { toState: "installed", kind: "rolled-back" }, releaseActor(context));
        setRoleAppVersionSupportState(restore.id, supportStateFor("installed"));
        return null;
      }
      changeRoleAppVersionState(restore.id, { toState: "installed", makeCurrent: true, kind: "rolled-back" }, releaseActor(context));
      setRoleAppVersionSupportState(restore.id, supportStateFor("installed"));
      if (current) {
        changeRoleAppVersionState(current.id, { toState: "retired" }, releaseActor(context, `Rolled back to version ${restore.version}.`));
        setRoleAppVersionSupportState(current.id, supportStateFor("retired"));
      }
      return null;
    },
    success: () => ({ en: "Rolled back.", de: "Zurueckgesetzt." }),
  });
}

/* ==========================================================================
   Retire
   ========================================================================== */

export function proposeRetire(roleAppId: string): LifecycleProposal {
  const app = getRoleApp(roleAppId);
  const target = appTarget(roleAppId);
  if (!app) return proposal("role-app.retire", target, { roleAppId }, [], unknownApp(roleAppId));
  const current = getCurrentRoleAppVersion(roleAppId);
  const runs = activeRunCount(roleAppId);
  const enablements = listRoleAppEnablements(roleAppId).filter((entry) => entry.enabled);
  const payload = { roleAppId, currentVersionId: current?.id ?? null, currentState: current?.lifecycleState ?? null, enabledScopes: enablements.map((entry) => `${entry.scopeKind}:${entry.scopeId}`) };
  const lines: Bilingual[] = [
    {
      en: `Version ${current?.version ?? "-"} of ${app.name} is recorded as Retired.`,
      de: `Version ${current?.version ?? "-"} von ${app.nameDe} wird als ausser Betrieb erfasst.`,
    },
    {
      en: `The app is disabled for the tenant and every cohort (${enablements.length} enablement(s)).`,
      de: `Die App wird fuer den Mandanten und jede Kohorte gesperrt (${enablements.length} Freischaltungen).`,
    },
    {
      en: `${runs} active run(s) are kept for the record and cannot be opened. Roll back restores the version; enabling it is a separate step.`,
      de: `${runs} aktive Laeufe bleiben zur Nachvollziehbarkeit erhalten und koennen nicht geoeffnet werden. Zuruecksetzen stellt die Version wieder her; die Freischaltung ist ein eigener Schritt.`,
    },
  ];
  const blocked: Bilingual | null =
    app.status !== "installed"
      ? notInstalled(app)
      : !current
        ? { en: `${app.name} has no current version.`, de: `${app.nameDe} hat keine aktuelle Version.` }
        : current.lifecycleState === "retired"
          ? { en: `${app.name} is already retired.`, de: `${app.nameDe} ist bereits ausser Betrieb.` }
          : null;
  return proposal("role-app.retire", target, payload, lines, blocked);
}

export async function retireRoleApp(roleAppId: string, approval: ConsoleApprovalInput): Promise<ConsoleActionResult<null>> {
  const proposed = proposeRetire(roleAppId);
  return governConsoleAction({
    actionId: "role-app.retire",
    target: proposed.target,
    payload: proposed.payload,
    approval,
    summary: { en: `Retire ${roleAppId}.`, de: `${roleAppId} ausser Betrieb nehmen.` },
    rule: () => proposed.blocked,
    execute: (context) => {
      const current = getCurrentRoleAppVersion(roleAppId);
      if (!current) throw new Error("No current version.");
      changeRoleAppVersionState(current.id, { toState: "retired" }, releaseActor(context));
      setRoleAppVersionSupportState(current.id, supportStateFor("retired"));
      for (const entry of listRoleAppEnablements(roleAppId).filter((row) => row.enabled)) {
        setRoleAppEnablement(
          { roleAppId, scopeKind: entry.scopeKind, scopeId: entry.scopeId, enabled: false, versionId: entry.versionId },
          releaseActor(context, `Retired: ${context.rationale}`),
        );
      }
      return null;
    },
    success: () => ({ en: "Retired. Its runs are kept and cannot be opened.", de: "Ausser Betrieb genommen. Ihre Laeufe bleiben erhalten und koennen nicht geoeffnet werden." }),
  });
}
