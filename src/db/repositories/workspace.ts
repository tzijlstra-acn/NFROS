/**
 * Role workspace view models and changed-object detection.
 *
 * Two jobs, kept in one module because the second is an input to the first.
 *
 * The first is to turn the scenario database into the exact props each role's
 * hero visualisation already accepts, so a workspace component composes a
 * working visualisation rather than reimplementing one. The mappings mirror the
 * V1 workbench deliberately. If the two ever disagree, the product holds two
 * truths about one institution, which is the failure this schema is shaped to
 * prevent.
 *
 * The second is to answer "what moved?" from evidence rather than from a guess.
 * That answer drives the single `data-changed` marker the redesign uses in
 * three places, and it is capped on purpose: a change marker on half the graph
 * tells a reader nothing, so candidates are ranked by recency and only a
 * handful are returned.
 *
 * Read side only. Every function here is a query, as in `workday.ts`, so a
 * server component can call any of them during render without changing state.
 */

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  auditEvents,
  DEFAULT_RUN_ID,
  timelineRoleMoments,
  type RoleId,
} from "@/db/schema/core";
import { backgroundActions, decisions, monitoringActivations } from "@/db/schema/decisions";
import { controls } from "@/db/schema/domain";
import { assessments, incidents, obligations, testCases } from "@/db/schema/practice";
import { workdayLiveEvents } from "@/db/schema/live";
import {
  calculateToleranceRemaining,
  CONTROL_EFFECTIVENESS,
  formatAmount,
  momentToMinutes,
} from "@/domain/nfr/calculators";
import {
  compareAssessments,
  getActions,
  getAllDecisions,
  getAllSubprocessors,
  getCommitteeItems,
  getControl,
  getControlTest,
  getControlTests,
  getDecisionThread,
  getEntity,
  getImpactTolerances,
  getIncidentTimeline,
  getMonitoringActivations,
  getObligations,
  getPolicy,
  getPopulationSummary,
  getPortfolioThemes,
  getProcess,
  getRecoveryOptions,
  getRegulatoryPublications,
  getRiskControlGraph,
  getRole,
  getRoles,
  getServiceDependencies,
  getServices,
  getSharedEventIncident,
  getSupplierExposure,
  getSuppliers,
  getUser,
  getUserNameMap,
} from "./workday";
import type { WorkdaySelection } from "@/workday/contracts";
import type { Language } from "@/i18n/labels";
import type {
  ControlNodeView,
  IndicatorNodeView,
  ProcessNodeView,
  RiskNodeView,
} from "@/components/visualisations/RiskControlGraph";
import type {
  ConstellationCriticality,
  ConstellationEdge,
  ConstellationNode,
  ObligationEvidenceCounts,
} from "@/components/visualisations/SupplierConstellation";
import type {
  PopulationCase,
  PopulationFieldTest,
} from "@/components/visualisations/PopulationField";
import type {
  DependencyEdgeView,
  DependencyKind,
  DependencyNodeView,
  ToleranceMeasureView,
  ToleranceState,
} from "@/components/visualisations/ServiceDependencyMap";
import type {
  LineageLane,
  LineageObligation,
  LineagePublication,
  LineageTarget,
  LineageTerminalState,
} from "@/components/visualisations/ObligationLineage";
import type {
  PortfolioLensView,
  PortfolioMatterView,
} from "@/components/visualisations/PortfolioThread";

const db = () => getDb();

/** The scenario subjects, resolved with a fallback so a reseed degrades rather than breaks. */
const TPRM_SUPPLIER_ID = "TP-0042";
const RCSA_PROCESS_ID = "PRC-0041";
const ASSURANCE_TEST_ID = "TST-2026-0318";

/** The moment the shared event lands. Mirrors the scenario engine constant. */
const SHARED_EVENT_MOMENT = "14:05";

/* ==========================================================================
   Bilingual interface copy for the derived parts of a workspace
   ========================================================================== */

interface Pair {
  en: string;
  de: string;
}

function say(pair: Pair, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

const COPY: Record<string, Pair> = {
  changedByEvent: { en: "arrived with the event", de: "mit dem Ereignis eingetroffen" },
  changedByMutation: {
    en: "changed by a recorded action",
    de: "durch eine erfasste Aktion geaendert",
  },
  changedByBackground: {
    en: "touched by prepared work",
    de: "durch vorbereitete Arbeit beruehrt",
  },
  changedByRecord: {
    en: "a field owned by a person is now set",
    de: "ein von einer Person verantwortetes Feld ist nun gesetzt",
  },
};

/* ==========================================================================
   Role scope
   ========================================================================== */

/**
 * Every object this role demonstrably works on.
 *
 * Assembled from four real links rather than from a list written per role: the
 * objects the role's decisions name, the objects its timeline moments put in
 * the centre of the screen, the objects its prepared background work touched,
 * and the objects its actions point at. A written list would drift from the
 * seed the first time a subject identifier changed, and nothing would fail
 * loudly when it did.
 *
 * The expansion step matters as much as the collection step. A role that owns a
 * control also watches the indicators of the risks that control mitigates, and
 * that relationship is in the data, so it is followed here rather than
 * asserted per role.
 */
export interface RoleScope {
  roleId: RoleId;
  /** Every object identifier in scope, regardless of kind. */
  objectIds: Set<string>;
  byKind: Map<string, Set<string>>;
  riskIds: Set<string>;
  processIds: Set<string>;
  controlIds: Set<string>;
  serviceIds: Set<string>;
  supplierIds: Set<string>;
  evidenceIds: Set<string>;
  /**
   * True for the portfolio role, whose scope is the group rather than a
   * subject. Without this the portfolio lead would watch nothing, because that
   * role deliberately owns no single work object.
   */
  groupScope: boolean;
}

function addTo(map: Map<string, Set<string>>, kind: string, id: string): void {
  const set = map.get(kind) ?? new Set<string>();
  set.add(id);
  map.set(kind, set);
}

export function buildRoleScope(roleId: RoleId, runId = DEFAULT_RUN_ID): RoleScope {
  const objectIds = new Set<string>();
  const byKind = new Map<string, Set<string>>();
  const evidenceIds = new Set<string>();

  const note = (kind: string | null, id: string | null | undefined): void => {
    if (!id) return;
    objectIds.add(id);
    if (kind) addTo(byKind, kind, id);
  };

  /* 1. The objects this role's decisions name. */
  for (const row of db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.roleId, roleId)))
    .all()) {
    note("decision", row.id);
    note(row.relatedObjectKind, row.relatedObjectId);
    for (const id of row.supportingEvidenceIds) evidenceIds.add(id);
    for (const id of row.opposingEvidenceIds) evidenceIds.add(id);
  }

  /* 2. The objects its timeline moments put on the screen. */
  for (const row of db()
    .select()
    .from(timelineRoleMoments)
    .where(and(eq(timelineRoleMoments.runId, runId), eq(timelineRoleMoments.roleId, roleId)))
    .all()) {
    note(row.workObjectKind, row.workObjectId);
    for (const id of row.evidenceIds) evidenceIds.add(id);
    for (const id of row.decisionIds) note("decision", id);
  }

  /* 3. The objects its prepared background work touched. */
  for (const row of db()
    .select()
    .from(backgroundActions)
    .where(and(eq(backgroundActions.runId, runId), eq(backgroundActions.roleId, roleId)))
    .all()) {
    note(row.targetKind, row.targetId);
    for (const id of row.evidenceIds) evidenceIds.add(id);
  }

  /* 4. The objects its actions point at. */
  for (const row of getActions({ roleId }, runId)) {
    note("action", row.id);
    note(row.relatedObjectKind, row.relatedObjectId);
  }

  for (const id of evidenceIds) note("evidence", id);

  /* ---- Expansion along recorded relationships ---- */
  const controlIds = new Set(byKind.get("control") ?? []);
  const riskIds = new Set(byKind.get("risk") ?? []);
  const processIds = new Set(byKind.get("process") ?? []);
  const serviceIds = new Set(byKind.get("service") ?? []);
  const supplierIds = new Set(byKind.get("supplier") ?? []);

  /* A control test in scope brings its control, and with it that control's risks. */
  for (const test of getControlTests(runId)) {
    if (!objectIds.has(test.id)) continue;
    controlIds.add(test.controlId);
  }

  for (const control of db().select().from(controls).where(eq(controls.runId, runId)).all()) {
    if (!controlIds.has(control.id)) continue;
    for (const id of control.riskIds) riskIds.add(id);
    for (const id of control.processIds) processIds.add(id);
  }

  /* A service in scope brings the suppliers that deliver it, and the reverse. */
  const allServices = getServices(runId);
  for (const service of allServices) {
    if (!serviceIds.has(service.id)) continue;
    for (const id of service.supplierIds) supplierIds.add(id);
  }
  for (const service of allServices) {
    if (service.supplierIds.some((id) => supplierIds.has(id))) serviceIds.add(service.id);
  }

  for (const id of controlIds) note("control", id);
  for (const id of riskIds) note("risk", id);
  for (const id of processIds) note("process", id);
  for (const id of serviceIds) note("service", id);
  for (const id of supplierIds) note("supplier", id);

  return {
    roleId,
    objectIds,
    byKind,
    riskIds,
    processIds,
    controlIds,
    serviceIds,
    supplierIds,
    evidenceIds,
    groupScope: roleId === "nfr-governance",
  };
}

/* ==========================================================================
   Changed-object detection
   ========================================================================== */

export type ChangedSource = "live-event" | "audit" | "background-action" | "record";

export interface ChangedObject {
  objectType: string;
  objectId: string;
  /** What the object is, as recorded. */
  label: string;
  /** Why this counts as changed. One clause, in the interface language. */
  reason: string;
  atMoment: string;
  source: ChangedSource;
}

export interface ChangedObjectOptions {
  roleId: RoleId;
  atMoment: string;
  language: Language;
  runId?: string;
  /** How far back in scenario minutes a change still counts as recent. */
  windowMinutes?: number;
  /** The maximum number of objects that may carry the marker. */
  cap?: number;
  scope?: RoleScope;
}

/** The default look back window, in scenario minutes. */
export const CHANGED_WINDOW_MINUTES = 150;

/** The maximum number of marked objects. A marker on everything marks nothing. */
export const CHANGED_CAP = 6;

/** Lower wins when two sources report the same object at the same moment. */
const SOURCE_PRECEDENCE: Record<ChangedSource, number> = {
  "live-event": 0,
  audit: 1,
  "background-action": 2,
  record: 3,
};

/**
 * Which objects changed recently, from evidence.
 *
 * Four evidence sources, in precedence order: an event that arrived, a recorded
 * mutation in the audit log, prepared background work that touched the object,
 * and a record whose human owned field is now set where the seed left it null.
 *
 * The fourth source carries a caveat worth stating. Those record fields have no
 * scenario clock of their own, so a change found that way is dated at the
 * moment being viewed. That is why it sits last in the precedence order: when
 * the audit log reports the same object, the audit moment wins and the
 * timestamp shown is the real one.
 */
export function detectChangedObjects(options: ChangedObjectOptions): ChangedObject[] {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const { roleId, atMoment, language } = options;
  const windowMinutes = options.windowMinutes ?? CHANGED_WINDOW_MINUTES;
  const cap = options.cap ?? CHANGED_CAP;
  const scope = options.scope ?? buildRoleScope(roleId, runId);

  const now = momentToMinutes(atMoment);
  const earliest = now - windowMinutes;
  const recent = (moment: string): boolean => {
    const minutes = momentToMinutes(moment);
    return minutes <= now && minutes >= earliest;
  };

  const candidates: ChangedObject[] = [];

  /* ---- 1. Live events for this role ---- */
  for (const event of db()
    .select()
    .from(workdayLiveEvents)
    .where(eq(workdayLiveEvents.runId, runId))
    .all()) {
    if (event.roleIds.length > 0 && !event.roleIds.includes(roleId)) continue;
    if (event.objectId.length === 0) continue;
    if (!recent(event.atMoment)) continue;
    candidates.push({
      objectType: event.objectType,
      objectId: event.objectId,
      label: language === "de" ? event.titleDe : event.title,
      reason: say(COPY.changedByEvent as Pair, language),
      atMoment: event.atMoment,
      source: "live-event",
    });
  }

  /* ---- 2. Recorded mutations, decisions and approvals ---- */
  for (const entry of db()
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.runId, runId))
    .orderBy(desc(auditEvents.recordedAt))
    .limit(300)
    .all()) {
    if (entry.preExisting || entry.blocked) continue;
    /*
     * Mutations and decisions only.
     *
     * An approval is not a change to a work object: it is the authority under
     * which one was permitted, and the change itself already has a mutation
     * row. Including approvals put a change marker on six approval records for
     * every one control that actually moved, and the control then lost its
     * place to them under the cap.
     */
    if (entry.category !== "mutation" && entry.category !== "decision") continue;
    if (entry.roleId !== null && entry.roleId !== roleId) continue;
    if (entry.objectId.length === 0) continue;
    if (!recent(entry.atMoment)) continue;
    candidates.push({
      objectType: entry.objectKind,
      objectId: entry.objectId,
      label: entry.summary,
      reason: say(COPY.changedByMutation as Pair, language),
      atMoment: entry.atMoment,
      source: "audit",
    });
  }

  /* ---- 3. Prepared background work ---- */
  for (const action of db()
    .select()
    .from(backgroundActions)
    .where(and(eq(backgroundActions.runId, runId), eq(backgroundActions.roleId, roleId)))
    .all()) {
    if (!recent(action.performedAtMoment)) continue;
    /*
     * A system check is a read, not a change. Including it would put a marker
     * on every system the role touched this morning, which is most of them,
     * and the marker would stop meaning anything.
     */
    if (action.kind === "system-checked") continue;
    candidates.push({
      objectType: action.targetKind,
      objectId: action.targetId,
      label: action.targetLabel,
      reason: say(COPY.changedByBackground as Pair, language),
      atMoment: action.performedAtMoment,
      source: "background-action",
    });
  }

  /* ---- 4. Records whose field owned by a person is now set ---- */
  const recordReason = say(COPY.changedByRecord as Pair, language);

  for (const row of db().select().from(controls).where(eq(controls.runId, runId)).all()) {
    if (!scope.controlIds.has(row.id)) continue;
    if (row.effectivenessSetBy === "seed" || row.effectivenessSetAt === null) continue;
    candidates.push({
      objectType: "control",
      objectId: row.id,
      label: `${row.reference} ${row.title}`,
      reason: recordReason,
      atMoment,
      source: "record",
    });
  }
  for (const row of db().select().from(assessments).where(eq(assessments.runId, runId)).all()) {
    if (!row.createdBySession) continue;
    if (!scope.objectIds.has(row.subjectId) && !scope.objectIds.has(row.id)) continue;
    candidates.push({
      objectType: "assessment",
      objectId: row.id,
      label: `${row.reference} version ${row.version}`,
      reason: recordReason,
      atMoment,
      source: "record",
    });
  }
  for (const row of db().select().from(testCases).where(eq(testCases.runId, runId)).all()) {
    if (row.classifiedAt === null) continue;
    if (!scope.objectIds.has(row.controlTestId)) continue;
    candidates.push({
      objectType: "test-case",
      objectId: row.id,
      label: row.transactionRef,
      reason: recordReason,
      atMoment,
      source: "record",
    });
  }
  for (const row of db().select().from(incidents).where(eq(incidents.runId, runId)).all()) {
    if (row.severitySetByUserId === null) continue;
    if (!scope.objectIds.has(row.id)) continue;
    candidates.push({
      objectType: "incident",
      objectId: row.id,
      label: `${row.reference} ${row.title}`,
      reason: recordReason,
      atMoment,
      source: "record",
    });
  }
  for (const row of db().select().from(obligations).where(eq(obligations.runId, runId)).all()) {
    if (row.applicabilityDecision === null) continue;
    if (!scope.objectIds.has(row.id)) continue;
    candidates.push({
      objectType: "obligation",
      objectId: row.id,
      label: row.paragraphReference,
      reason: recordReason,
      atMoment,
      source: "record",
    });
  }
  for (const row of db()
    .select()
    .from(monitoringActivations)
    .where(eq(monitoringActivations.runId, runId))
    .all()) {
    if (!row.active) continue;
    if (!recent(row.activatedAtMoment)) continue;
    candidates.push({
      objectType: row.subjectKind,
      objectId: row.subjectId,
      label: row.description,
      reason: recordReason,
      atMoment: row.activatedAtMoment,
      source: "record",
    });
  }

  /*
   * Objects the workspace draws come first.
   *
   * Executing a decision writes a mutation row for every consequence, so one
   * judgment can produce a remediation action, a committee item, a monitoring
   * activation and a message, all at the same moment and all genuinely
   * changed. Ranked by recency alone they tie with the control the decision
   * was actually about, and the alphabetical tie break then decides which six
   * the graph marks. An object in the role's recorded scope is one the
   * workspace can actually mark, so those are taken first and the rest fill
   * the remainder of the cap.
   */
  const ranked = rankChangedObjects(candidates, Number.MAX_SAFE_INTEGER);
  const inScope = ranked.filter((entry) => scope.objectIds.has(entry.objectId));
  const elsewhere = ranked.filter((entry) => !scope.objectIds.has(entry.objectId));
  return [...inScope, ...elsewhere].slice(0, Math.max(0, cap));
}

/**
 * Collapses duplicates and keeps the most recent few.
 *
 * Exported because the cap is a product rule rather than an implementation
 * detail, and a rule that matters is worth testing without a database behind
 * it.
 */
export function rankChangedObjects(candidates: ChangedObject[], cap: number): ChangedObject[] {
  const best = new Map<string, ChangedObject>();
  for (const candidate of candidates) {
    const key = `${candidate.objectType}:${candidate.objectId}`;
    const existing = best.get(key);
    if (existing === undefined) {
      best.set(key, candidate);
      continue;
    }
    const candidateMinutes = momentToMinutes(candidate.atMoment);
    const existingMinutes = momentToMinutes(existing.atMoment);
    const newer = candidateMinutes > existingMinutes;
    const sameMomentButStronger =
      candidateMinutes === existingMinutes &&
      SOURCE_PRECEDENCE[candidate.source] < SOURCE_PRECEDENCE[existing.source];
    if (newer || sameMomentButStronger) best.set(key, candidate);
  }

  return [...best.values()]
    .sort(
      (a, b) =>
        momentToMinutes(b.atMoment) - momentToMinutes(a.atMoment) ||
        SOURCE_PRECEDENCE[a.source] - SOURCE_PRECEDENCE[b.source] ||
        a.objectId.localeCompare(b.objectId),
    )
    .slice(0, Math.max(0, cap));
}

/** The identifiers a workspace marks with `data-changed`. */
export function changedIdsOf(changed: ChangedObject[]): string[] {
  return [...new Set(changed.map((entry) => entry.objectId))];
}

/* ==========================================================================
   Shared workspace shapes
   ========================================================================== */

/** A selectable object, resolved so a click can report a label with the id. */
export interface SelectableObject {
  objectType: WorkdaySelection["objectType"];
  objectId: string;
  label: string;
}

/** One consequence of a selected object, in either direction. */
export interface ConsequenceLink {
  objectType: WorkdaySelection["objectType"];
  objectId: string;
  label: string;
  /** The recorded relationship, for example "mitigates" or "indicates". */
  relation: string;
}

/** A quiet statement of context. Rendered as a row, never as a paragraph. */
export interface ContextLine {
  label: string;
  value: string;
  /** Set when the line carries a regulatory reference and needs the disclosure. */
  regulatory?: boolean;
}

export interface WorkspaceBase {
  /** The object title. Never above 20px, so this is a string not a heading. */
  heading: string;
  objectId: string | null;
  changed: ChangedObject[];
  changedIds: string[];
  /** Everything a click in this workspace may select, keyed by object id. */
  selectable: Record<string, SelectableObject>;
}

export interface WorkspaceOptions {
  roleId: RoleId;
  atMoment: string;
  language: Language;
  runId?: string;
}

/* ==========================================================================
   Narrowing helpers, shared with the V1 workbench mapping
   ========================================================================== */

function narrowCriticality(value: string): ConstellationCriticality {
  if (
    value === "critical" ||
    value === "important" ||
    value === "standard" ||
    value === "supporting"
  ) {
    return value;
  }
  return "standard";
}

function narrowStrength(value: string): "critical" | "important" | "supporting" {
  if (value === "critical" || value === "important" || value === "supporting") return value;
  return "supporting";
}

/** Distance between two effectiveness bands, in bands. */
function bandsApart(first: string, second: string): number {
  const order = (value: string) => (CONTROL_EFFECTIVENESS as readonly string[]).indexOf(value);
  const a = order(first);
  const b = order(second);
  if (a < 0 || b < 0) return 0;
  return Math.abs(a - b);
}

/* ==========================================================================
   1. RCSA: the process, risk and control graph
   ========================================================================== */

/** A control whose recorded effectiveness moved, or whose two lines disagree. */
export interface EffectivenessChange {
  controlId: string;
  reference: string;
  title: string;
  /** The second line position, which is the recorded one. */
  recorded: string;
  /** The first line owner's own position. */
  firstLine: string;
  bandsApart: number;
  /** "seed" means nobody in this session has touched it. */
  setBy: string;
  isKeyControl: boolean;
}

export interface RcsaWorkspaceView extends WorkspaceBase {
  kind: "rcsa";
  processes: ProcessNodeView[];
  risks: RiskNodeView[];
  controls: ControlNodeView[];
  indicators: IndicatorNodeView[];
  /** Upstream and downstream consequences, precomputed per node. */
  consequences: Record<string, { upstream: ConsequenceLink[]; downstream: ConsequenceLink[] }>;
  effectivenessChanges: EffectivenessChange[];
  /** The lines that differ from the previous assessment version. */
  assessmentChanges: Array<{ riskId: string; riskLabel: string; note: string }>;
  context: ContextLine[];
}

function buildRcsaWorkspace(
  options: WorkspaceOptions,
  base: Omit<WorkspaceBase, "heading" | "objectId" | "selectable">,
): RcsaWorkspaceView {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language;
  const names = getUserNameMap(runId);

  const process = getProcess(RCSA_PROCESS_ID, runId) ?? null;
  const processId = process?.id ?? null;
  const graph = processId
    ? getRiskControlGraph({ processId }, runId)
    : getRiskControlGraph({}, runId);
  const comparison = processId ? compareAssessments(processId, runId) : null;

  const riskIds = new Set(graph.risks.map((risk) => risk.id));
  const currentLineByRisk = new Map(
    (comparison?.currentLines ?? []).map((line) => [line.riskId, line]),
  );
  const previousLineByRisk = new Map(
    (comparison?.previousLines ?? []).map((line) => [line.riskId, line]),
  );

  const testByControl = new Map<string, string>();
  for (const test of getControlTests(runId)) {
    if (!testByControl.has(test.controlId)) testByControl.set(test.controlId, test.reference);
  }

  const processes: ProcessNodeView[] = graph.processes.map((row) => ({
    id: row.id,
    label: row.name,
    code: row.code,
    ...(row.recentChangeNote.length > 0 ? { detail: row.recentChangeNote } : {}),
    riskIds: graph.risks.filter((risk) => risk.processIds.includes(row.id)).map((risk) => risk.id),
  }));

  const risks: RiskNodeView[] = graph.risks.map((row) => {
    const line = currentLineByRisk.get(row.id);
    const position =
      row.appetitePosition === "within" ||
      row.appetitePosition === "at-limit" ||
      row.appetitePosition === "outside"
        ? row.appetitePosition
        : undefined;
    return {
      id: row.id,
      label: language === "de" ? row.titleDe : row.title,
      ownerLabel: names.get(row.ownerUserId) ?? row.ownerUserId,
      inherentScore: row.inherentLikelihood * row.inherentImpact,
      ...(row.appetiteStatement.length > 0 ? { appetiteStatement: row.appetiteStatement } : {}),
      ...(position ? { appetitePosition: position } : {}),
      ...(line ? { residualScore: line.residualLikelihood * line.residualImpact } : {}),
      ...(line && line.commentary.length > 0 ? { materialisationNote: line.commentary } : {}),
    };
  });

  const controlViews: ControlNodeView[] = graph.controls.map((row) => {
    const reference = testByControl.get(row.id);
    return {
      id: row.id,
      reference: row.reference,
      title: language === "de" ? row.titleDe : row.title,
      riskIds: row.riskIds.filter((id) => riskIds.has(id)),
      ownerLabel: names.get(row.ownerUserId) ?? row.ownerUserId,
      isKeyControl: row.isKeyControl,
      nature: row.nature,
      automation: row.automation,
      currentEffectiveness: row.currentEffectiveness,
      firstLineEffectiveness: row.firstLineEffectiveness,
      firstLineOwnerLabel: names.get(row.ownerUserId) ?? row.ownerUserId,
      ...(row.lastTestedOn ? { lastTestedOn: row.lastTestedOn } : {}),
      ...(reference ? { evidenceRef: reference } : {}),
    };
  });

  const indicators: IndicatorNodeView[] = graph.kris.map((row) => ({
    id: row.id,
    reference: row.reference,
    name: language === "de" ? row.nameDe : row.name,
    riskIds: row.riskIds.filter((id) => riskIds.has(id)),
    status: row.currentStatus,
    currentValue: row.currentValue,
    unit: row.unit,
    amberThreshold: row.amberThreshold,
    redThreshold: row.redThreshold,
  }));

  /*
   * Consequences, both directions, derived from the same edges the graph draws.
   *
   * Precomputed per node rather than resolved on click, because the workspace
   * is a client component and a click must not need a round trip to say what
   * else a control touches.
   */
  const labelOf = new Map<string, SelectableObject>();
  for (const row of graph.processes) {
    labelOf.set(row.id, { objectType: "process", objectId: row.id, label: row.name });
  }
  for (const row of risks) {
    labelOf.set(row.id, { objectType: "risk", objectId: row.id, label: row.label });
  }
  for (const row of controlViews) {
    labelOf.set(row.id, { objectType: "control", objectId: row.id, label: row.reference });
  }
  for (const row of indicators) {
    labelOf.set(row.id, { objectType: "risk", objectId: row.id, label: row.reference });
  }

  const consequences: Record<
    string,
    { upstream: ConsequenceLink[]; downstream: ConsequenceLink[] }
  > = {};
  const ensure = (id: string) => {
    const existing = consequences[id];
    if (existing) return existing;
    const created = { upstream: [] as ConsequenceLink[], downstream: [] as ConsequenceLink[] };
    consequences[id] = created;
    return created;
  };

  for (const edge of graph.edges) {
    const from = labelOf.get(edge.from);
    const to = labelOf.get(edge.to);
    if (!from || !to) continue;
    ensure(edge.from).downstream.push({ ...to, relation: edge.kind });
    ensure(edge.to).upstream.push({ ...from, relation: edge.kind });
  }

  const effectivenessChanges: EffectivenessChange[] = graph.controls
    .filter((row) => row.firstLineEffectiveness !== row.currentEffectiveness)
    .map((row) => ({
      controlId: row.id,
      reference: row.reference,
      title: language === "de" ? row.titleDe : row.title,
      recorded: row.currentEffectiveness,
      firstLine: row.firstLineEffectiveness,
      bandsApart: bandsApart(row.firstLineEffectiveness, row.currentEffectiveness),
      setBy: row.effectivenessSetBy,
      isKeyControl: row.isKeyControl,
    }))
    .sort(
      (a, b) =>
        b.bandsApart - a.bandsApart ||
        Number(b.isKeyControl) - Number(a.isKeyControl) ||
        a.reference.localeCompare(b.reference),
    );

  const assessmentChanges = (comparison?.currentLines ?? [])
    .map((line) => {
      const previous = previousLineByRisk.get(line.riskId);
      const changed =
        previous === undefined ||
        previous.residualRating !== line.residualRating ||
        previous.controlEffectiveness !== line.controlEffectiveness ||
        previous.appetitePosition !== line.appetitePosition;
      if (!changed) return null;
      const risk = risks.find((row) => row.id === line.riskId);
      return {
        riskId: line.riskId,
        riskLabel: risk?.label ?? line.riskId,
        note:
          line.changeFromPrevious.length > 0
            ? line.changeFromPrevious
            : `${line.residualRating} residual, control effectiveness ${line.controlEffectiveness}`,
      };
    })
    .filter((entry): entry is { riskId: string; riskLabel: string; note: string } => entry !== null);

  const context: ContextLine[] = [];
  if (process) {
    context.push({
      label: language === "de" ? "Prozesseigner" : "Process owner",
      value: names.get(process.ownerUserId) ?? process.ownerUserId,
    });
    if (process.monthlyVolume !== null) {
      context.push({
        label: language === "de" ? "Monatsvolumen" : "Monthly volume",
        value: process.monthlyVolume.toLocaleString("de-DE"),
      });
    }
    context.push({
      label: language === "de" ? "Einheiten" : "Entities",
      value: process.entityIds.join(", "),
    });
  }

  const selectable: Record<string, SelectableObject> = {};
  for (const [id, entry] of labelOf) selectable[id] = entry;
  const assessment = comparison?.current;
  if (assessment) {
    selectable[assessment.id] = {
      objectType: "assessment",
      objectId: assessment.id,
      label: assessment.reference,
    };
  }

  return {
    kind: "rcsa",
    heading: process ? `${process.code} ${process.name}` : "Risk and control graph",
    objectId: process?.id ?? null,
    processes,
    risks,
    controls: controlViews,
    indicators,
    consequences,
    effectivenessChanges,
    assessmentChanges,
    context,
    selectable,
    changed: base.changed,
    changedIds: base.changedIds,
  };
}

/* ==========================================================================
   2. TPRM: the supplier and fourth-party constellation
   ========================================================================== */

/** One obligation the arrangement was checked against. */
export interface EvidenceCheck {
  obligationId: string;
  clauseReference: string;
  category: string;
  status: string;
  evidenceIds: string[];
  note: string;
}

/** Monitoring that a person turned on, or that the arrangement is already under. */
export interface MonitoringView {
  id: string;
  subjectId: string;
  kind: string;
  description: string;
  reviewFrequency: string;
  activatedAtMoment: string;
  nextReviewOn: string | null;
  /** True when this session turned it on rather than the seed. */
  fromThisSession: boolean;
}

/** A condition attached to an approval that is not yet satisfied. */
export interface ApprovalCondition {
  id: string;
  statement: string;
  owner: string;
  dueOn: string | null;
  status: string;
}

export interface TprmWorkspaceView extends WorkspaceBase {
  kind: "tprm";
  supplier: {
    id: string;
    name: string;
    criticality: string;
    domicile: string;
    isOutsourcing: boolean;
    concentrationNote: string;
  } | null;
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  obligationSummary: ObligationEvidenceCounts;
  eventMoment: string;
  /** The subprocessor and service nodes the monitoring change reaches. */
  affectedNodeIds: string[];
  evidenceChecked: EvidenceCheck[];
  monitoring: MonitoringView[];
  approvalConditions: ApprovalCondition[];
  /** Contractual and operational context, as rows. */
  context: ContextLine[];
}

function buildTprmWorkspace(
  options: WorkspaceOptions,
  base: Omit<WorkspaceBase, "heading" | "objectId" | "selectable">,
): TprmWorkspaceView {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language;
  const names = getUserNameMap(runId);

  const suppliers = getSuppliers(runId);
  const supplierId =
    suppliers.find((row) => row.id === TPRM_SUPPLIER_ID)?.id ??
    suppliers.find((row) => row.criticality === "critical")?.id ??
    suppliers[0]?.id ??
    null;
  const exposure = supplierId ? getSupplierExposure(supplierId, runId) : null;

  if (!exposure) {
    return {
      kind: "tprm",
      heading: "Supplier exposure",
      objectId: null,
      supplier: null,
      nodes: [],
      edges: [],
      obligationSummary: { met: 0, partiallyMet: 0, notEvidenced: 0, breached: 0 },
      eventMoment: SHARED_EVENT_MOMENT,
      affectedNodeIds: [],
      evidenceChecked: [],
      monitoring: [],
      approvalConditions: [],
      context: [],
      selectable: {},
      changed: base.changed,
      changedIds: base.changedIds,
    };
  }

  const { supplier, services, subprocessors, contracts, obligations: contractObligations } =
    exposure;

  const obligationSummary: ObligationEvidenceCounts = {
    met: contractObligations.filter((row) => row.evidenceStatus === "met").length,
    partiallyMet: contractObligations.filter((row) => row.evidenceStatus === "partially-met").length,
    notEvidenced: contractObligations.filter((row) => row.evidenceStatus === "not-evidenced").length,
    breached: contractObligations.filter((row) => row.evidenceStatus === "breached").length,
  };

  const isFourthParty = (id: string) => /-F\d+$/.test(id);
  const parentOf = (id: string) => id.replace(/-F\d+$/, "");

  const strengthByTarget = new Map<string, string>();
  const eventTargets = new Set<string>();
  const spofTargets = new Set<string>();
  for (const dep of exposure.dependencies) {
    strengthByTarget.set(dep.toId, dep.dependencyStrength);
    if (dep.affectedByEvent) {
      eventTargets.add(dep.toId);
      eventTargets.add(dep.fromId);
    }
    if (dep.singlePointOfFailure) spofTargets.add(dep.toId);
  }
  for (const dep of getServiceDependencies(runId)) {
    if (!services.some((service) => service.id === dep.toId)) continue;
    strengthByTarget.set(dep.toId, dep.dependencyStrength);
    if (dep.affectedByEvent) eventTargets.add(dep.toId);
    if (dep.singlePointOfFailure) spofTargets.add(dep.toId);
  }

  const nodes: ConstellationNode[] = [
    {
      id: supplier.id,
      ring: "supplier",
      label: supplier.name,
      detail: `${supplier.legalForm}, ${supplier.domicile}`,
      criticality: narrowCriticality(supplier.criticality),
      affectedByEvent: true,
      evidence: obligationSummary,
    },
    ...services.map<ConstellationNode>((service) => ({
      id: service.id,
      ring: "service",
      label: service.name,
      detail: service.domain,
      criticality: narrowCriticality(strengthByTarget.get(service.id) ?? "standard"),
      supportsCriticalFunction: service.isImportantBusinessService,
      singlePointOfFailure: spofTargets.has(service.id),
      affectedByEvent: eventTargets.has(service.id),
    })),
    ...subprocessors.map<ConstellationNode>((sub) => ({
      id: sub.id,
      ring: isFourthParty(sub.id) ? "fourth-party" : "subprocessor",
      label: sub.name,
      detail: sub.domicile,
      dataLocation: sub.dataLocation,
      supportsCriticalFunction: sub.supportsCriticalFunction,
      isDiscrepancy: sub.isDiscrepancy,
      ...(sub.discrepancyNote.length > 0 ? { discrepancyNote: sub.discrepancyNote } : {}),
      ...(sub.declaredIn === "contract-appendix" ||
      sub.declaredIn === "supplier-submission" ||
      sub.declaredIn === "both"
        ? { declaredIn: sub.declaredIn }
        : {}),
      affectedByEvent: eventTargets.has(sub.id),
    })),
  ];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: ConstellationEdge[] = [];
  const edgeSeen = new Set<string>();

  for (const dep of exposure.dependencies) {
    if (!nodeIds.has(dep.fromId) || !nodeIds.has(dep.toId)) continue;
    edges.push({
      id: dep.id,
      from: dep.fromId,
      to: dep.toId,
      strength: narrowStrength(dep.dependencyStrength),
      singlePointOfFailure: dep.singlePointOfFailure,
      affectedByEvent: dep.affectedByEvent,
      ...(dep.note.length > 0 ? { note: dep.note } : {}),
    });
    edgeSeen.add(`${dep.fromId}|${dep.toId}`);
    edgeSeen.add(`${dep.toId}|${dep.fromId}`);
  }

  /*
   * Delivery edges are structural, not recorded.
   *
   * The dependency table records operational dependencies between business
   * services and their providers, not the delivery relationship between a
   * supplier and its own services. Those edges are added here and labelled as
   * structural, so a reader is never told the register contains a row it does
   * not contain.
   */
  for (const service of services) {
    if (edgeSeen.has(`${supplier.id}|${service.id}`)) continue;
    edges.push({
      id: `structural-${supplier.id}-${service.id}`,
      from: supplier.id,
      to: service.id,
      strength: narrowStrength(strengthByTarget.get(service.id) ?? "supporting"),
      singlePointOfFailure: spofTargets.has(service.id),
      affectedByEvent: eventTargets.has(service.id),
      note: "Delivery relationship from the service register. No dependency row records this edge.",
    });
    edgeSeen.add(`${supplier.id}|${service.id}`);
  }
  for (const sub of subprocessors) {
    const from = isFourthParty(sub.id) ? parentOf(sub.id) : supplier.id;
    if (!nodeIds.has(from) || edgeSeen.has(`${from}|${sub.id}`)) continue;
    edges.push({
      id: `structural-${from}-${sub.id}`,
      from,
      to: sub.id,
      strength: sub.supportsCriticalFunction ? "critical" : "supporting",
      affectedByEvent: eventTargets.has(sub.id),
      note: isFourthParty(sub.id)
        ? "Engaged by the subprocessor, not by the supplier."
        : "Engagement recorded on the subprocessor register.",
    });
    edgeSeen.add(`${from}|${sub.id}`);
  }

  const evidenceChecked: EvidenceCheck[] = contractObligations
    .filter((row) => row.evidenceStatus !== "met")
    .map((row) => ({
      obligationId: row.id,
      clauseReference: row.clauseReference,
      category: row.category,
      status: row.evidenceStatus,
      evidenceIds: row.evidenceDocumentIds,
      note: row.note,
    }))
    .sort((a, b) => a.clauseReference.localeCompare(b.clauseReference));

  const monitoring: MonitoringView[] = getMonitoringActivations(runId)
    .filter((row) => row.active && (row.subjectId === supplier.id || nodeIds.has(row.subjectId)))
    .map((row) => ({
      id: row.id,
      subjectId: row.subjectId,
      kind: row.kind,
      description: row.description,
      reviewFrequency: row.reviewFrequency,
      activatedAtMoment: row.activatedAtMoment,
      nextReviewOn: row.nextReviewOn,
      fromThisSession: row.sourceDecisionId !== null,
    }));

  /*
   * Approval conditions come from the actions a decision created, not from a
   * separate conditions table. That is the only honest source: a condition
   * nobody owns and nobody has a date for is not a condition, and the action
   * row is where ownership and a date live.
   */
  const approvalConditions: ApprovalCondition[] = getActions({ roleId: "tprm" }, runId)
    .filter((row) => row.status !== "completed" && row.status !== "cancelled")
    .filter((row) => row.relatedObjectId === supplier.id || nodeIds.has(row.relatedObjectId ?? ""))
    .map((row) => ({
      id: row.id,
      statement: language === "de" && row.titleDe.length > 0 ? row.titleDe : row.title,
      owner: row.ownerUserId
        ? (names.get(row.ownerUserId) ?? row.ownerUserId)
        : row.ownerLabel.length > 0
          ? row.ownerLabel
          : "unowned",
      dueOn: row.dueOn,
      status: row.status,
    }));

  const appendixContract = contracts.find((row) => row.documentType === "appendix");
  const context: ContextLine[] = [
    {
      label: language === "de" ? "Erfasste Kritikalitaet" : "Recorded criticality",
      value: supplier.criticality,
    },
    {
      label: language === "de" ? "Regulierte Auslagerung" : "Regulated outsourcing",
      value: supplier.isOutsourcing ? "yes" : "no",
      regulatory: true,
    },
    {
      label: language === "de" ? "Vertragspartner" : "Contracting entities",
      value: supplier.contractingEntityIds.join(", "),
    },
    { label: language === "de" ? "Status" : "Status", value: supplier.status },
  ];
  if (appendixContract) {
    context.push({
      label: language === "de" ? "Massgebliche Anlage" : "Governing appendix",
      value: `${appendixContract.reference}, ${appendixContract.subprocessorConsentModel || appendixContract.documentType}`,
    });
  }
  const operationalServices = services.filter((row) => row.operationalStatus !== "normal");
  if (operationalServices.length > 0) {
    context.push({
      label: language === "de" ? "Betriebsstatus" : "Operational status",
      value: operationalServices.map((row) => `${row.id} ${row.operationalStatus}`).join(", "),
    });
  }

  const selectable: Record<string, SelectableObject> = {
    [supplier.id]: { objectType: "supplier", objectId: supplier.id, label: supplier.name },
  };
  for (const service of services) {
    selectable[service.id] = {
      objectType: "service",
      objectId: service.id,
      label: service.name,
    };
  }
  for (const sub of subprocessors) {
    selectable[sub.id] = { objectType: "supplier", objectId: sub.id, label: sub.name };
  }

  return {
    kind: "tprm",
    heading: `${supplier.id} ${supplier.name}`,
    objectId: supplier.id,
    supplier: {
      id: supplier.id,
      name: supplier.name,
      criticality: supplier.criticality,
      domicile: supplier.domicile,
      isOutsourcing: supplier.isOutsourcing,
      concentrationNote: supplier.concentrationNote,
    },
    nodes,
    edges,
    obligationSummary,
    eventMoment: SHARED_EVENT_MOMENT,
    affectedNodeIds: [...eventTargets].filter((id) => nodeIds.has(id)),
    evidenceChecked,
    monitoring,
    approvalConditions,
    context,
    selectable,
    changed: base.changed,
    changedIds: base.changedIds,
  };
}

/* ==========================================================================
   3. Control Assurance: the population field
   ========================================================================== */

/** Why one case was selected into the sample or flagged. */
export interface CaseSelectionReason {
  caseId: string;
  transactionRef: string;
  reason: string;
  outcome: string;
  inSample: boolean;
  fromFallbackRoute: boolean;
}

export interface ControlAssuranceWorkspaceView extends WorkspaceBase {
  kind: "control-assurance";
  test: PopulationFieldTest | null;
  cases: PopulationCase[];
  /** Cases that entered the population because of the event. */
  newCaseIds: string[];
  selectionReasons: CaseSelectionReason[];
  classification: {
    total: number;
    sampled: number;
    exceptions: number;
    classified: number;
    unclassified: number;
    missingReviewEvidence: number;
  };
  relatedControl: { id: string; reference: string; title: string; effectiveness: string } | null;
  context: ContextLine[];
}

function buildControlAssuranceWorkspace(
  options: WorkspaceOptions,
  base: Omit<WorkspaceBase, "heading" | "objectId" | "selectable">,
): ControlAssuranceWorkspaceView {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language;
  const names = getUserNameMap(runId);

  const tests = getControlTests(runId);
  const test =
    getControlTest(ASSURANCE_TEST_ID, runId) ??
    tests.find((row) => row.status === "disputed") ??
    tests[0] ??
    null;

  if (!test) {
    return {
      kind: "control-assurance",
      heading: "Population field",
      objectId: null,
      test: null,
      cases: [],
      newCaseIds: [],
      selectionReasons: [],
      classification: {
        total: 0,
        sampled: 0,
        exceptions: 0,
        classified: 0,
        unclassified: 0,
        missingReviewEvidence: 0,
      },
      relatedControl: null,
      context: [],
      selectable: {},
      changed: base.changed,
      changedIds: base.changedIds,
    };
  }

  const summary = getPopulationSummary(test.id, runId);
  const control = getControl(test.controlId, runId);

  const tolerableMatch = /tolerable deviation rate\s*([\d.]+)\s*%/i.exec(test.samplingMethod);
  const tolerableRate = tolerableMatch?.[1] ? Number(tolerableMatch[1]) / 100 : undefined;

  const cases: PopulationCase[] = summary.cases.map((row) => ({
    id: row.id,
    transactionRef: row.transactionRef,
    occurredAt: row.occurredAt,
    repairReason: row.repairReason,
    repairedByLabel: names.get(row.repairedByUserId) ?? row.repairedByUserId,
    reviewerLabel: row.reviewerUserId ? (names.get(row.reviewerUserId) ?? row.reviewerUserId) : null,
    secondaryReviewEvidenced: row.secondaryReviewEvidenced,
    inSample: row.inSample,
    outcome: row.outcome,
    anomalyKind: row.anomalyKind,
    exceptionClassification: row.exceptionClassification,
    exceptionScope: row.exceptionScope,
    fromFallbackRoute: row.fromFallbackRoute,
    amountLabel: formatAmount(row.amountMinor, row.currency),
    ...(row.note.length > 0 ? { note: row.note } : {}),
  }));

  /*
   * A fallback route case is a case the event put into the population. That is
   * what "new cases entering the population" means here, and it is a recorded
   * column rather than a guess about arrival order.
   */
  const newCaseIds = summary.cases.filter((row) => row.fromFallbackRoute).map((row) => row.id);

  const selectionReasons: CaseSelectionReason[] = summary.cases
    .filter((row) => row.outcome !== "conforming" || row.inSample)
    .slice(0, 24)
    .map((row) => ({
      caseId: row.id,
      transactionRef: row.transactionRef,
      reason:
        row.anomalyKind !== null && row.anomalyKind.length > 0
          ? row.anomalyKind
          : row.outcome === "exception"
            ? `${row.repairReason}, no secondary review evidenced`
            : row.inSample
              ? test.samplingMethod
              : row.repairReason,
      outcome: row.outcome,
      inSample: row.inSample,
      fromFallbackRoute: row.fromFallbackRoute,
    }));

  const classified = summary.exceptionCases.filter(
    (row) => row.exceptionClassification !== null,
  ).length;

  const context: ContextLine[] = [
    {
      label: language === "de" ? "Pruefer" : "Tester",
      value: names.get(test.testerUserId) ?? test.testerUserId,
    },
    {
      label: language === "de" ? "Zeitraum" : "Period",
      value: `${test.periodFrom} to ${test.periodTo}`,
    },
    { label: language === "de" ? "Auswahlverfahren" : "Sampling method", value: test.samplingMethod },
    { label: language === "de" ? "Status" : "Status", value: test.status },
  ];
  if (test.managementResponse.length > 0) {
    context.push({
      label: language === "de" ? "Stellungnahme der ersten Linie" : "First line response",
      value: test.managementResponse,
    });
  }

  const selectable: Record<string, SelectableObject> = {};
  for (const row of summary.cases) {
    selectable[row.id] = {
      objectType: "test-case",
      objectId: row.id,
      label: row.transactionRef,
    };
  }
  if (control) {
    selectable[control.id] = {
      objectType: "control",
      objectId: control.id,
      label: control.reference,
    };
  }

  return {
    kind: "control-assurance",
    heading: `${test.reference} ${test.title}`,
    objectId: test.id,
    test: {
      reference: test.reference,
      title: test.title,
      populationSize: test.populationSize,
      sampleSize: test.sampleSize,
      samplingMethod: test.samplingMethod,
      samplingRationale: test.samplingRationale,
      periodFrom: test.periodFrom,
      periodTo: test.periodTo,
      ...(tolerableRate !== undefined ? { tolerableDeviationRate: tolerableRate } : {}),
    },
    cases,
    newCaseIds,
    selectionReasons,
    classification: {
      total: summary.total,
      sampled: summary.sampled,
      exceptions: summary.exceptions,
      classified,
      unclassified: summary.unclassifiedExceptions,
      missingReviewEvidence: summary.missingReviewEvidence,
    },
    relatedControl: control
      ? {
          id: control.id,
          reference: control.reference,
          title: language === "de" ? control.titleDe : control.title,
          effectiveness: control.currentEffectiveness,
        }
      : null,
    context,
    selectable,
    changed: base.changed,
    changedIds: base.changedIds,
  };
}

/* ==========================================================================
   4. Incident and Resilience: the service dependency map
   ========================================================================== */

export interface ChronologyEntry {
  id: string;
  atMoment: string;
  channel: string;
  sourceLabel: string;
  provenance: string;
  statement: string;
  conflictsWithId: string | null;
  evidenceIds: string[];
}

export interface PropagationStep {
  order: number;
  fromId: string;
  toId: string;
  fromLabel: string;
  toLabel: string;
  strength: string;
  singlePointOfFailure: boolean;
}

export interface RecoveryOptionView {
  id: string;
  name: string;
  description: string;
  minutesToRestore: number;
  controlTradeOff: string;
  operationalRisk: string;
  availability: string;
  requiresApprovalFrom: string;
  selected: boolean;
}

export interface IncidentResilienceWorkspaceView extends WorkspaceBase {
  kind: "incident-resilience";
  incident: {
    id: string;
    reference: string;
    title: string;
    status: string;
    severity: string | null;
    proposedSeverity: string | null;
    detectedAtMoment: string;
  } | null;
  nodes: DependencyNodeView[];
  edges: DependencyEdgeView[];
  tolerances: ToleranceMeasureView[];
  /** Set when one tolerance carries two measures and no stated precedence. */
  precedenceNote: string | null;
  eventMoment: string;
  chronology: ChronologyEntry[];
  propagation: PropagationStep[];
  options: RecoveryOptionView[];
  /** The decision this workspace exposes. The player pausing on it is elsewhere. */
  materialDecisionId: string | null;
  context: ContextLine[];
}

function buildIncidentResilienceWorkspace(
  options: WorkspaceOptions,
  base: Omit<WorkspaceBase, "heading" | "objectId" | "selectable">,
): IncidentResilienceWorkspaceView {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language;
  const atMoment = options.atMoment;

  const incident = getSharedEventIncident(runId) ?? null;

  if (!incident) {
    return {
      kind: "incident-resilience",
      heading: "Service dependency map",
      objectId: null,
      incident: null,
      nodes: [],
      edges: [],
      tolerances: [],
      precedenceNote: null,
      eventMoment: SHARED_EVENT_MOMENT,
      chronology: [],
      propagation: [],
      options: [],
      materialDecisionId: null,
      context: [],
      selectable: {},
      changed: base.changed,
      changedIds: base.changedIds,
    };
  }

  const allDependencies = getServiceDependencies(runId);
  const services = getServices(runId);
  const suppliers = getSuppliers(runId);
  const serviceById = new Map(services.map((row) => [row.id, row]));
  const supplierById = new Map(suppliers.map((row) => [row.id, row]));
  const subprocessorById = new Map(
    getAllSubprocessors(runId).map((row) => [row.id, { name: row.name, domicile: row.domicile }]),
  );

  const seeds = new Set<string>([...incident.serviceIds, ...incident.supplierIds]);
  const included = new Set<string>(seeds);
  let frontier = new Set<string>(seeds);
  for (let hop = 0; hop < 2; hop += 1) {
    const next = new Set<string>();
    for (const dep of allDependencies) {
      if (frontier.has(dep.fromId) && !included.has(dep.toId)) next.add(dep.toId);
      if (frontier.has(dep.toId) && !included.has(dep.fromId)) next.add(dep.fromId);
    }
    for (const id of next) included.add(id);
    frontier = next;
  }

  const scoped = allDependencies.filter(
    (dep) => included.has(dep.fromId) && included.has(dep.toId),
  );

  const kindOf = (id: string): DependencyKind => {
    if (serviceById.has(id)) return "service";
    if (supplierById.has(id)) return "supplier";
    if (subprocessorById.has(id)) return "subprocessor";
    return "system";
  };

  const eventAffected = new Set<string>();
  for (const dep of scoped) {
    if (!dep.affectedByEvent) continue;
    eventAffected.add(dep.fromId);
    eventAffected.add(dep.toId);
  }
  for (const id of incident.serviceIds) eventAffected.add(id);
  for (const id of incident.supplierIds) eventAffected.add(id);

  const entityShortNames = new Map<string, string>(
    incident.entityIds.map((id) => [id, getEntity(id, runId)?.shortName ?? id]),
  );

  const labelFor = (id: string): string => {
    const service = serviceById.get(id);
    if (service) return language === "de" ? service.nameDe : service.name;
    const supplier = supplierById.get(id);
    if (supplier) return supplier.name;
    const sub = subprocessorById.get(id);
    if (sub) return sub.name;
    return id;
  };

  const nodes: DependencyNodeView[] = [...included].map((id) => {
    const kind = kindOf(id);
    const affected = eventAffected.has(id);
    if (kind === "service") {
      const service = serviceById.get(id);
      return {
        id,
        kind,
        label: labelFor(id),
        ...(service ? { detail: service.domain } : {}),
        ...(service ? { operationalStatus: service.operationalStatus } : {}),
        ...(service ? { isImportantBusinessService: service.isImportantBusinessService } : {}),
        ...(service && service.entityIds.length > 0
          ? {
              entityLabel: service.entityIds
                .map((entityId) => entityShortNames.get(entityId) ?? entityId)
                .join(", "),
            }
          : {}),
        affectedByEvent: affected,
        ...(affected ? { failedAtMoment: SHARED_EVENT_MOMENT } : {}),
      };
    }
    if (kind === "supplier") {
      const supplier = supplierById.get(id);
      return {
        id,
        kind,
        label: labelFor(id),
        ...(supplier ? { detail: `${supplier.criticality}, ${supplier.domicile}` } : {}),
        affectedByEvent: affected,
        ...(affected ? { failedAtMoment: SHARED_EVENT_MOMENT } : {}),
      };
    }
    if (kind === "subprocessor") {
      const sub = subprocessorById.get(id);
      return {
        id,
        kind,
        label: labelFor(id),
        ...(sub ? { detail: sub.domicile } : {}),
        affectedByEvent: affected,
      };
    }
    return { id, kind: "system", label: id, detail: id, affectedByEvent: affected };
  });

  const edges: DependencyEdgeView[] = scoped.map((dep) => ({
    id: dep.id,
    from: dep.fromId,
    to: dep.toId,
    strength: narrowStrength(dep.dependencyStrength),
    singlePointOfFailure: dep.singlePointOfFailure,
    affectedByEvent: dep.affectedByEvent,
    ...(dep.note.length > 0 ? { note: dep.note } : {}),
  }));

  /*
   * The propagation order is the breadth first distance from the incident's own
   * services along edges the data marks as carrying the event. It is therefore
   * the recorded path, not an animation timeline someone chose.
   */
  const propagation: PropagationStep[] = [];
  const visited = new Set<string>(incident.serviceIds);
  let layer = [...incident.serviceIds];
  let order = 0;
  while (layer.length > 0 && order < 6) {
    const next: string[] = [];
    for (const dep of scoped) {
      if (!dep.affectedByEvent) continue;
      for (const current of layer) {
        const other =
          dep.fromId === current ? dep.toId : dep.toId === current ? dep.fromId : null;
        if (other === null || visited.has(other)) continue;
        visited.add(other);
        next.push(other);
        propagation.push({
          order,
          fromId: current,
          toId: other,
          fromLabel: labelFor(current),
          toLabel: labelFor(other),
          strength: dep.dependencyStrength,
          singlePointOfFailure: dep.singlePointOfFailure,
        });
      }
    }
    layer = next;
    order += 1;
  }

  const relevantTolerances = getImpactTolerances(runId).filter(
    (row) => incident.serviceIds.includes(row.serviceId) || included.has(row.serviceId),
  );

  const tolerances: ToleranceMeasureView[] = relevantTolerances.map((row) => {
    const service = serviceById.get(row.serviceId);
    if (row.thresholdMinutes !== null) {
      const status = calculateToleranceRemaining({
        serviceId: row.serviceId,
        metric: row.metric,
        thresholdMinutes: row.thresholdMinutes,
        consumedMinutes: row.consumedMinutes,
        statement: row.statement,
      });
      return {
        id: row.id,
        serviceId: row.serviceId,
        ...(service ? { serviceLabel: service.name } : {}),
        entityLabel: row.entityId,
        metric: row.metric,
        unit: row.unit,
        thresholdValue: status.thresholdMinutes,
        consumedValue: status.consumedMinutes,
        state: status.state as ToleranceState,
        statement: row.statement,
        approvedBy: row.approvedBy,
        note: `${status.remainingMinutes} minutes of headroom remain. Computed from the recorded threshold and consumption.`,
      };
    }
    return {
      id: row.id,
      serviceId: row.serviceId,
      ...(service ? { serviceLabel: service.name } : {}),
      entityLabel: row.entityId,
      metric: row.metric,
      unit: row.unit,
      thresholdValue: row.thresholdVolume ?? 0,
      consumedValue: 0,
      state: "within",
      statement: row.statement,
      approvedBy: row.approvedBy,
      note: "This measure is a count or a share, not elapsed time, so consumption against it is not computed here.",
    };
  });

  const precedenceTolerance = relevantTolerances.find(
    (row) => row.thresholdMinutes !== null && /cut-off/i.test(row.unit),
  );

  const chronology: ChronologyEntry[] = getIncidentTimeline(incident.id, atMoment, runId).map(
    (row) => ({
      id: row.id,
      atMoment: row.atMoment,
      channel: row.channel,
      sourceLabel: row.sourceLabel,
      provenance: row.provenance,
      statement: row.statement,
      conflictsWithId: row.conflictsWithId,
      evidenceIds: row.evidenceDocumentIds,
    }),
  );

  const recoveryOptions: RecoveryOptionView[] = getRecoveryOptions(incident.id, runId).map(
    (row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      minutesToRestore: row.estimatedMinutesToRestore,
      controlTradeOff: row.controlTradeOff,
      operationalRisk: row.operationalRisk,
      availability: row.availability,
      requiresApprovalFrom: row.requiresApprovalFrom,
      selected: row.selected,
    }),
  );

  /*
   * The material decision is the open severity judgment on this incident. It is
   * exposed rather than acted on here: pausing the live player at it belongs to
   * the player, and a workspace that also paused would fight it.
   */
  const materialDecision = db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.runId, runId), eq(decisions.roleId, "incident-resilience")))
    .all()
    .filter((row) => row.status === "open" && row.relatedObjectId === incident.id)
    .sort((a, b) => a.priorityRank - b.priorityRank)[0];

  const context: ContextLine[] = [
    {
      label: language === "de" ? "Erkannt" : "Detected",
      value: incident.detectedAt.slice(11, 16),
    },
    {
      label: language === "de" ? "Technischer Beginn" : "Technical start",
      value: incident.occurredAt ? incident.occurredAt.slice(11, 16) : "not established",
    },
    { label: language === "de" ? "Status" : "Status", value: incident.status },
    {
      label: language === "de" ? "Schweregrad" : "Severity",
      value: incident.severity ?? `${incident.proposedSeverity ?? "not set"}, proposed`,
    },
  ];

  const selectable: Record<string, SelectableObject> = {
    [incident.id]: {
      objectType: "incident",
      objectId: incident.id,
      label: incident.reference,
    },
  };
  for (const node of nodes) {
    if (node.kind === "service") {
      selectable[node.id] = { objectType: "service", objectId: node.id, label: node.label };
    } else if (node.kind === "supplier" || node.kind === "subprocessor") {
      selectable[node.id] = { objectType: "supplier", objectId: node.id, label: node.label };
    }
  }

  return {
    kind: "incident-resilience",
    heading: `${incident.reference} ${incident.title}`,
    objectId: incident.id,
    incident: {
      id: incident.id,
      reference: incident.reference,
      title: language === "de" ? incident.titleDe : incident.title,
      status: incident.status,
      severity: incident.severity,
      proposedSeverity: incident.proposedSeverity,
      detectedAtMoment: incident.detectedAt.slice(11, 16),
    },
    nodes,
    edges,
    tolerances,
    precedenceNote: precedenceTolerance
      ? "One tolerance in scope carries two measures, elapsed disruption time and completion against the same-day cut-off, and the approved statement does not say which prevails."
      : null,
    eventMoment: SHARED_EVENT_MOMENT,
    chronology,
    propagation,
    options: recoveryOptions,
    materialDecisionId: materialDecision?.id ?? null,
    context,
    selectable,
    changed: base.changed,
    changedIds: base.changedIds,
  };
}

/* ==========================================================================
   5. Regulatory Change: the obligation lineage
   ========================================================================== */

/**
 * The distinction this role exists to hold.
 *
 * Extraction is what a machine read out of a paragraph. Interpretation is what
 * a named person decided it means for a named entity. They are separate fields
 * in the schema and they are separate fields here, because collapsing them is
 * how a model's reading of a regulation quietly becomes the institution's
 * position on it.
 */
export interface ExtractionAndInterpretation {
  obligationId: string;
  paragraphReference: string;
  /** Machine extracted. Carries its own confidence. */
  extractedSummary: string;
  extractionConfidence: number;
  /** Decided by a person. Null until someone decides. */
  applicabilityDecision: string | null;
  applicabilityRationale: string | null;
  decidedBy: string | null;
  decidedOn: string | null;
  /** The entities the extraction proposes. Applicability stays a human call. */
  candidateEntityLabel: string;
  ownerLabel: string | null;
  isUnownedGap: boolean;
}

export interface RegulatoryChangeWorkspaceView extends WorkspaceBase {
  kind: "regulatory-change";
  publications: LineagePublication[];
  obligations: LineageObligation[];
  /** Obligations extracted but not yet interpreted by a person. */
  newlyExtractedIds: string[];
  missingOwnerIds: string[];
  interpretation: ExtractionAndInterpretation[];
  context: ContextLine[];
}

function buildRegulatoryChangeWorkspace(
  options: WorkspaceOptions,
  base: Omit<WorkspaceBase, "heading" | "objectId" | "selectable">,
): RegulatoryChangeWorkspaceView {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language;
  const names = getUserNameMap(runId);

  const publications = getRegulatoryPublications(runId);
  const rows = getObligations(undefined, runId);

  const laneOf = (jurisdiction: string): LineageLane => (jurisdiction === "ch" ? "ch" : "eu");
  const publicationById = new Map(publications.map((row) => [row.id, row]));

  const lineagePublications: LineagePublication[] = publications.map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    issuer: row.issuer,
    jurisdiction: row.jurisdiction,
    lane: laneOf(row.jurisdiction),
    instrumentType: row.instrumentType,
    publishedOn: row.publishedOn,
  }));

  const newestTestByControl = new Map<string, string>();
  for (const test of getControlTests(runId)) {
    const existing = newestTestByControl.get(test.controlId);
    if (existing === undefined || test.periodTo > existing) {
      newestTestByControl.set(test.controlId, test.periodTo);
    }
  }
  const STALE_AFTER_DAYS = 365;
  const reference = Date.parse("2026-10-06T00:00:00.000Z");

  const terminalStateFor = (row: (typeof rows)[number]): LineageTerminalState => {
    const hasTarget =
      row.policyIds.length > 0 || row.processIds.length > 0 || row.controlIds.length > 0;
    if (row.isUnownedGap || !hasTarget) return "unmapped";
    if (row.controlIds.length === 0) return "unevidenced";
    const dates = row.controlIds
      .map((id) => newestTestByControl.get(id))
      .filter((value): value is string => value !== undefined)
      .map((value) => Date.parse(`${value}T00:00:00.000Z`))
      .filter((value) => !Number.isNaN(value));
    if (dates.length === 0) return "unevidenced";
    const newest = Math.max(...dates);
    const ageDays = (reference - newest) / (1000 * 60 * 60 * 24);
    return ageDays > STALE_AFTER_DAYS ? "stale" : "evidenced";
  };

  const laneByTarget = new Map<string, Set<LineageLane>>();
  for (const row of rows) {
    const publication = publicationById.get(row.publicationId);
    if (!publication) continue;
    const lane = laneOf(publication.jurisdiction);
    for (const id of [...row.policyIds, ...row.processIds, ...row.controlIds]) {
      const set = laneByTarget.get(id) ?? new Set<LineageLane>();
      set.add(lane);
      laneByTarget.set(id, set);
    }
  }

  const targetsFor = (row: (typeof rows)[number]): LineageTarget[] => {
    const result: LineageTarget[] = [];
    for (const id of row.policyIds) {
      const policy = getPolicy(id, runId);
      result.push({
        id,
        kind: "policy",
        label: policy ? `${policy.reference} ${policy.section}` : id,
        ...(policy ? { detail: policy.sectionTitle } : {}),
        servesBothLanes: (laneByTarget.get(id)?.size ?? 0) > 1,
      });
    }
    for (const id of row.processIds) {
      const process = getProcess(id, runId);
      result.push({
        id,
        kind: "process",
        label: process ? process.code : id,
        ...(process ? { detail: process.name } : {}),
        servesBothLanes: (laneByTarget.get(id)?.size ?? 0) > 1,
      });
    }
    for (const id of row.controlIds) {
      const control = getControl(id, runId);
      result.push({
        id,
        kind: "control",
        label: control ? control.reference : id,
        ...(control ? { detail: control.title } : {}),
        servesBothLanes: (laneByTarget.get(id)?.size ?? 0) > 1,
      });
    }
    return result;
  };

  const lineageObligations: LineageObligation[] = rows.map((row) => {
    const newestTest = row.controlIds
      .map((id) => newestTestByControl.get(id))
      .filter((value): value is string => value !== undefined)
      .sort()
      .at(-1);
    return {
      id: row.id,
      publicationId: row.publicationId,
      paragraphReference: row.paragraphReference,
      summary: row.extractedSummary,
      theme: row.theme,
      entityScopeLabel:
        row.candidateEntityIds.length > 0 ? row.candidateEntityIds.join(", ") : "not scoped",
      extractionConfidence: row.extractionConfidence,
      applicabilityDecision: row.applicabilityDecision,
      ownerLabel: row.ownerUserId ? (names.get(row.ownerUserId) ?? row.ownerUserId) : null,
      isUnownedGap: row.isUnownedGap,
      ...(row.gapNote.length > 0 ? { gapNote: row.gapNote } : {}),
      targets: targetsFor(row),
      terminalState: terminalStateFor(row),
      ...(newestTest ? { evidenceRef: newestTest, evidenceAgeLabel: `tested to ${newestTest}` } : {}),
    };
  });

  const interpretation: ExtractionAndInterpretation[] = rows.map((row) => ({
    obligationId: row.id,
    paragraphReference: row.paragraphReference,
    extractedSummary: row.extractedSummary,
    extractionConfidence: row.extractionConfidence,
    applicabilityDecision: row.applicabilityDecision,
    applicabilityRationale: row.applicabilityRationale,
    decidedBy: row.decidedByUserId ? (names.get(row.decidedByUserId) ?? row.decidedByUserId) : null,
    decidedOn: row.decidedOn,
    candidateEntityLabel:
      row.candidateEntityIds.length > 0 ? row.candidateEntityIds.join(", ") : "not scoped",
    ownerLabel: row.ownerUserId ? (names.get(row.ownerUserId) ?? row.ownerUserId) : null,
    isUnownedGap: row.isUnownedGap,
  }));

  const context: ContextLine[] = [
    {
      label: language === "de" ? "Veroeffentlichungen" : "Publications",
      value: String(publications.length),
      regulatory: true,
    },
    {
      label: language === "de" ? "Extrahierte Pflichten" : "Extracted obligations",
      value: String(rows.length),
      regulatory: true,
    },
    {
      label: language === "de" ? "Ohne Eigentuemer" : "Without an owner",
      value: String(rows.filter((row) => row.isUnownedGap).length),
      regulatory: true,
    },
  ];

  const selectable: Record<string, SelectableObject> = {};
  for (const row of rows) {
    selectable[row.id] = {
      objectType: "obligation",
      objectId: row.id,
      label: row.paragraphReference,
    };
  }

  return {
    kind: "regulatory-change",
    heading:
      language === "de" ? "Von der Quelle zur Pflicht zur Kontrolle" : "Source to obligation to control",
    objectId: publications[0]?.id ?? null,
    publications: lineagePublications,
    obligations: lineageObligations,
    newlyExtractedIds: rows.filter((row) => row.applicabilityDecision === null).map((row) => row.id),
    missingOwnerIds: rows.filter((row) => row.ownerUserId === null).map((row) => row.id),
    interpretation,
    context,
    selectable,
    changed: base.changed,
    changedIds: base.changedIds,
  };
}

/* ==========================================================================
   6. NFR Governance: the portfolio thread
   ========================================================================== */

export interface CrossFunctionChange {
  roleId: RoleId;
  roleTitle: string;
  objectId: string;
  label: string;
  atMoment: string;
}

export interface NfrGovernanceWorkspaceView extends WorkspaceBase {
  kind: "nfr-governance";
  matter: PortfolioMatterView | null;
  lenses: PortfolioLensView[];
  threadDecisionIds: string[];
  crossFunctionChanges: CrossFunctionChange[];
  /** Decisions on the thread with their current owner and status. */
  owners: Array<{ decisionId: string; reference: string; owner: string; status: string }>;
  /** How many separate reports would cover this matter today. */
  duplicateReportCount: number;
  context: ContextLine[];
}

function buildNfrGovernanceWorkspace(
  options: WorkspaceOptions,
  base: Omit<WorkspaceBase, "heading" | "objectId" | "selectable">,
): NfrGovernanceWorkspaceView {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const language = options.language;
  const atMoment = options.atMoment;
  const names = getUserNameMap(runId);

  const themes = getPortfolioThemes(runId);
  const allDecisions = getAllDecisions(atMoment, runId);
  const committee = getCommitteeItems(runId);
  const roles = getRoles(runId);
  const roleById = new Map(roles.map((row) => [row.id, row]));

  const theme = themes[0] ?? null;
  const themeDecisionIds = new Set(theme?.decisionIds ?? []);
  const themeDecisions = allDecisions.filter((row) => themeDecisionIds.has(row.id));
  const sharedThreadId =
    themeDecisions.find((row) => row.sharedThreadId !== null)?.sharedThreadId ?? null;
  const threadDecisions = sharedThreadId ? getDecisionThread(sharedThreadId, runId) : themeDecisions;
  const visibleThread = threadDecisions.filter((row) =>
    allDecisions.some((visible) => visible.id === row.id),
  );

  const committeeForTheme = theme ? committee.filter((item) => item.themeId === theme.id) : [];
  const lensRoleIds = theme
    ? theme.contributingRoleIds
    : [...new Set(visibleThread.map((row) => row.roleId))];

  const lenses: PortfolioLensView[] = lensRoleIds.map((roleId) => {
    const roleRow = roleById.get(roleId);
    const forRole = visibleThread.filter((row) => row.roleId === roleId);
    const primary = forRole[0];
    const reportItem = committeeForTheme.find((item) => item.raisedByRoleId === roleId);
    const holder = roleRow ? getUser(roleRow.holderUserId, runId) : undefined;
    return {
      roleId,
      roleTitle: roleRow ? (language === "de" ? roleRow.titleDe : roleRow.title) : roleId,
      ...(holder ? { holderLabel: holder.name } : {}),
      question: primary
        ? primary.question
        : "This function contributes to the theme and has no decision open on it at this moment.",
      position: primary
        ? primary.preparedPosition
        : "No position has been prepared for this function on this matter.",
      ...(primary ? { positionStatus: primary.status } : {}),
      confidence: primary ? primary.confidence : null,
      decisionIds: forRole.map((row) => row.id),
      producesSeparateReportToday: reportItem !== undefined,
      ...(reportItem ? { reportNameToday: reportItem.title } : {}),
      ...(primary ? { evidenceRefs: primary.supportingEvidenceIds } : {}),
    };
  });

  const matter: PortfolioMatterView | null = theme
    ? {
        id: theme.id,
        title: language === "de" && theme.titleDe.length > 0 ? theme.titleDe : theme.title,
        description: theme.description,
        ...(visibleThread[0] ? { detectedAtMoment: visibleThread[0].presentedAtMoment } : {}),
        entityLabels: [...new Set(visibleThread.map((row) => row.entityId))],
        duplicateReportCount: theme.duplicateReportCount,
        materiality: theme.materiality,
        materialityDecidedBy: theme.materialityDecidedBy
          ? (names.get(theme.materialityDecidedBy) ?? theme.materialityDecidedBy)
          : null,
        confidence: theme.confidence,
      }
    : null;

  /*
   * Cross function changes are the per role changed objects, consolidated.
   *
   * The portfolio lead's claim is that one thread replaces six reports, so the
   * changes are gathered per contributing function and reported once rather
   * than six times.
   */
  const crossFunctionChanges: CrossFunctionChange[] = [];
  for (const roleId of lensRoleIds) {
    if (roleId === "nfr-governance") continue;
    const roleRow = roleById.get(roleId);
    const forRole = detectChangedObjects({
      roleId,
      atMoment,
      language,
      runId,
      cap: 2,
    });
    for (const entry of forRole) {
      crossFunctionChanges.push({
        roleId,
        roleTitle: roleRow ? (language === "de" ? roleRow.titleDe : roleRow.title) : roleId,
        objectId: entry.objectId,
        label: entry.label,
        atMoment: entry.atMoment,
      });
    }
  }
  crossFunctionChanges.sort(
    (a, b) => momentToMinutes(b.atMoment) - momentToMinutes(a.atMoment) || a.roleId.localeCompare(b.roleId),
  );

  const owners = visibleThread.map((row) => ({
    decisionId: row.id,
    reference: row.reference,
    owner: row.decidedByUserId
      ? (names.get(row.decidedByUserId) ?? row.decidedByUserId)
      : (roleById.get(row.roleId)?.title ?? row.roleId),
    status: row.status,
  }));

  const context: ContextLine[] = [
    {
      label: language === "de" ? "Beitragende Funktionen" : "Contributing functions",
      value: String(lensRoleIds.length),
    },
    {
      label: language === "de" ? "Entscheidungen im Strang" : "Decisions on the thread",
      value: String(visibleThread.length),
    },
    {
      label: language === "de" ? "Portfoliowesentlichkeit" : "Portfolio materiality",
      value: theme?.materiality ?? (language === "de" ? "nicht entschieden" : "not decided"),
    },
  ];

  const selectable: Record<string, SelectableObject> = {};
  if (theme) {
    selectable[theme.id] = { objectType: "theme", objectId: theme.id, label: theme.title };
  }
  for (const row of visibleThread) {
    selectable[row.id] = { objectType: "decision", objectId: row.id, label: row.reference };
  }

  return {
    kind: "nfr-governance",
    heading: matter?.title ?? "Portfolio thread",
    objectId: theme?.id ?? null,
    matter,
    lenses,
    threadDecisionIds: visibleThread.map((row) => row.id),
    crossFunctionChanges: crossFunctionChanges.slice(0, 8),
    owners,
    duplicateReportCount: theme?.duplicateReportCount ?? 0,
    context,
    selectable,
    changed: base.changed,
    changedIds: base.changedIds,
  };
}

/* ==========================================================================
   Dispatch
   ========================================================================== */

export type RoleWorkspaceView =
  | RcsaWorkspaceView
  | TprmWorkspaceView
  | ControlAssuranceWorkspaceView
  | IncidentResilienceWorkspaceView
  | RegulatoryChangeWorkspaceView
  | NfrGovernanceWorkspaceView;

/**
 * The workspace view model for one role at one moment.
 *
 * A switch rather than a lookup table, for the same reason the V1 workbench
 * uses one: each builder takes a different slice of the scenario, and a uniform
 * signature would only hide that.
 */
export function buildRoleWorkspace(options: WorkspaceOptions): RoleWorkspaceView {
  const runId = options.runId ?? DEFAULT_RUN_ID;
  const scope = buildRoleScope(options.roleId, runId);
  const changed = detectChangedObjects({
    roleId: options.roleId,
    atMoment: options.atMoment,
    language: options.language,
    runId,
    scope,
  });
  const base = { changed, changedIds: changedIdsOf(changed) };

  switch (options.roleId) {
    case "rcsa":
      return buildRcsaWorkspace(options, base);
    case "tprm":
      return buildTprmWorkspace(options, base);
    case "control-assurance":
      return buildControlAssuranceWorkspace(options, base);
    case "incident-resilience":
      return buildIncidentResilienceWorkspace(options, base);
    case "regulatory-change":
      return buildRegulatoryChangeWorkspace(options, base);
    case "nfr-governance":
      return buildNfrGovernanceWorkspace(options, base);
  }
}

/** The role's hero visualisation identifier, as recorded on the role. */
export function heroVisualOf(roleId: RoleId, runId = DEFAULT_RUN_ID): string {
  return getRole(roleId, runId)?.heroVisual ?? "";
}

/** Every object identifier a route exposes, for the selection reconciliation. */
export function selectableIdsOf(view: RoleWorkspaceView): string[] {
  return Object.keys(view.selectable);
}
