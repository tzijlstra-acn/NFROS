/**
 * The RCSA source loaders the later stages share.
 *
 * Stage 2 registers the evidence loaders (indicators, incidents, losses,
 * tests, open actions, prior assessment, telemetry, control evidence) in
 * `./evidence-refresh.ts`. This module registers the loaders Stages 1 and 3
 * to 8 add:
 *
 *   rcsa.risk-control-register   the lines of the current version, with the
 *                                register's inherent position, both lines'
 *                                effectiveness and the recorded change
 *   rcsa.first-line-submissions  the first line's own written positions on
 *                                the controls in scope, and the management
 *                                responses to the control tests
 *   rcsa.appetite-statements     the appetite statement of each risk in scope
 *   rcsa.scope-participants      the owners and participants the scope needs
 *   rcsa.reassessment-trigger    why this run exists: the cycle schedule and
 *                                the scope minutes, or the event that started
 *                                an off-cycle run
 *   rcsa.cycle-decisions         the decisions recorded in this cycle
 *   rcsa.action-plan             the actions on the scope, with owner, date,
 *                                completion condition and lineage
 *   rcsa.monitoring-activations  enhanced monitoring already switched on
 *
 * Each reads the seeded database and nothing else, and cites only evidence
 * revealed at the current scenario moment. An empty result is a finding, and
 * says so in its note.
 *
 * Synthetic institution and data.
 */

import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users, type RoleId } from "@/db/schema/core";
import { controls, kris, processes, risks } from "@/db/schema/domain";
import { assessments, controlTests } from "@/db/schema/practice";
import { actions, decisionOptions, monitoringActivations } from "@/db/schema/decisions";
import { getArtifacts, getMinutesArchive, getStageRunById } from "@/db/repositories/role-app-runtime";
import { listDecisionsForProcessRun } from "@/db/repositories/process-decisions";
import { findOsEvent } from "@/features/events/backbone";
import { roleHolder } from "@/features/process/context";
import { registerSourceLoader, type SourceLoaderContext } from "@/features/process/registry";
import type { SourceRecord } from "@/features/process/types";
import { formatDate, relatedTo, revealedEvidence, unique } from "@/role-apps/stage-support";
import { RCSA_CYCLE_PROCESS } from "@/role-apps/rcsa/definition";
import { clip, personLabel, priorAssessmentOf, result, scopeOf, type RcsaScope } from "./shared";
import { outsideFromScore } from "../matrix";

function riskRows(context: SourceLoaderContext, ids: readonly string[]) {
  return getDb()
    .select()
    .from(risks)
    .where(eq(risks.runId, context.runId))
    .all()
    .filter((row) => ids.includes(row.id));
}

function controlRows(context: SourceLoaderContext, ids: readonly string[]) {
  return getDb()
    .select()
    .from(controls)
    .where(eq(controls.runId, context.runId))
    .all()
    .filter((row) => ids.includes(row.id));
}

/** The key control of a line: the first key control on it, else its first control. */
export function keyControlOf(line: { controlIds: string[] }, rows: ReadonlyArray<{ id: string; isKeyControl: boolean }>): string | null {
  const key = line.controlIds.find((id) => rows.some((row) => row.id === id && row.isKeyControl));
  return key ?? line.controlIds[0] ?? null;
}


/* ==========================================================================
   The risk and control register
   ========================================================================== */

registerSourceLoader("rcsa.risk-control-register", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const riskList = riskRows(context, scope.riskIds);
  const controlList = controlRows(context, scope.controlIds);

  const records = scope.lines.map((line): SourceRecord => {
    const risk = riskList.find((row) => row.id === line.riskId);
    const keyId = keyControlOf(line, controlList);
    const control = controlList.find((row) => row.id === keyId);
    const evidence = relatedTo(docs, keyId ? [keyId] : [], ["control-description", "control-test-report", "rcsa-extract"])
      .filter((doc) => doc.status === "current")
      .map((doc) => doc.id)
      .slice(0, 4);
    return {
      id: line.id,
      label: `${line.riskId} ${risk?.title ?? ""}`.trim(),
      value: `${line.residualRating}, ${line.appetitePosition}`,
      evidenceIds: evidence,
      facts: {
        riskId: line.riskId,
        riskTitleDe: risk?.titleDe ?? "",
        riskOwner: risk?.ownerUserId ?? null,
        keyControlId: keyId,
        keyControlTitle: control?.title ?? "",
        keyControlTitleDe: control?.titleDe ?? "",
        controlOwner: control?.ownerUserId ?? null,
        controlIds: line.controlIds.join(","),
        inherentLikelihood: line.inherentLikelihood,
        inherentImpact: line.inherentImpact,
        effectiveness: line.controlEffectiveness,
        secondLine: control?.currentEffectiveness ?? null,
        firstLine: control?.firstLineEffectiveness ?? null,
        residualLikelihood: line.residualLikelihood,
        residualImpact: line.residualImpact,
        residualRating: line.residualRating,
        appetitePosition: line.appetitePosition,
        registerAppetite: risk?.appetitePosition ?? null,
        changeFromPrevious: clip(line.changeFromPrevious),
        commentary: clip(line.commentary, 500),
        assessmentId: scope.assessmentId,
        linesFrom: scope.linesFromId,
        processId: scope.processId,
        entityId: scope.entityId,
        riskProcessIds: (risk?.processIds ?? []).join(","),
        riskEntityIds: (risk?.entityIds ?? []).join(","),
        sortOrder: line.sortOrder,
      },
    };
  });

  return result(records, {
    note:
      scope.linesFromId !== scope.assessmentId
        ? {
            en: `${scope.assessmentId} has no lines of its own yet, so the scope is read from ${scope.linesFromId}, the version it reassesses.`,
            de: `${scope.assessmentId} hat noch keine eigenen Zeilen; der Umfang wird aus ${scope.linesFromId} gelesen, der Version, die neu bewertet wird.`,
          }
        : null,
  });
});

/* ==========================================================================
   First-line submissions
   ========================================================================== */

registerSourceLoader("rcsa.first-line-submissions", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const controlList = controlRows(context, scope.controlIds);
  const inScope = new Set([...scope.controlIds, ...scope.riskIds, scope.subjectAssessmentId, scope.assessmentId]);

  /*
   * The approved records a position can be checked against: second-line and
   * system records (never another stakeholder statement) that name one of the
   * specific objects the position names, such as a test exception, a
   * Massnahme or an indicator. Assessment, process and policy identifiers are
   * too broad to say anything about one position, so they are not matched.
   */
  const broad = (id: string) => id.startsWith("RCSA-") || id.startsWith("PRC-") || id.startsWith("POL-") || id.startsWith("AG-");
  const checkable = docs.filter(
    (doc) =>
      doc.status === "current" &&
      (doc.provenance === "approved-record" || doc.provenance === "verified-fact") &&
      ["control-test-report", "kri-report", "control-description", "transaction-log"].includes(doc.sourceType),
  );
  const order = ["control-test-report", "kri-report", "transaction-log", "control-description"];
  const recordsAgainst = (ids: readonly string[], self: string): string[] =>
    checkable
      .filter((doc) => doc.id !== self && doc.relatedObjectIds.some((id) => !broad(id) && ids.includes(id)))
      .sort((a, b) => order.indexOf(a.sourceType) - order.indexOf(b.sourceType) || a.id.localeCompare(b.id))
      .map((doc) => doc.id)
      .slice(0, 3);
  const actionRows = getDb().select().from(actions).where(eq(actions.runId, context.runId)).all();
  const overdueAmong = (ids: readonly string[]): string[] =>
    actionRows
      .filter((action) => ids.includes(action.id) && action.status !== "completed" && action.status !== "cancelled" && (action.status === "overdue" || (action.dueOn !== null && action.dueOn < context.state.scenarioDate)))
      .map((action) => action.id);

  const records: SourceRecord[] = docs
    .filter(
      (doc) =>
        doc.provenance === "stakeholder-statement" &&
        doc.sourceType === "rcsa-extract" &&
        doc.status === "current" &&
        doc.relatedObjectIds.some((id) => inScope.has(id)),
    )
    .map((doc): SourceRecord => {
      const controlId = doc.relatedObjectIds.find((id) => scope.controlIds.includes(id)) ?? null;
      const control = controlList.find((row) => row.id === controlId);
      const line = scope.lines.find((candidate) => controlId !== null && keyControlOf(candidate, controlList) === controlId)
        ?? scope.lines.find((candidate) => doc.relatedObjectIds.includes(candidate.riskId));
      const against = recordsAgainst(doc.relatedObjectIds, doc.id);
      return {
        id: doc.id,
        label: doc.title,
        value: `${doc.authorLabel.split(",")[0] ?? doc.authorLabel}, ${formatDate(doc.documentDate)}`,
        evidenceIds: unique([doc.id, ...against]),
        facts: {
          kind: "self-assessment",
          authorUserId: doc.authorUserId,
          authorLabel: doc.authorLabel,
          controlId,
          riskId: line?.riskId ?? null,
          lineId: line?.id ?? null,
          assessed: line?.controlEffectiveness ?? null,
          firstLine: control?.firstLineEffectiveness ?? null,
          secondLine: control?.currentEffectiveness ?? null,
          recordsAgainst: against.join(","),
          overdueActions: overdueAmong(doc.relatedObjectIds).join(","),
          documentDate: doc.documentDate,
          titleDe: doc.titleDe,
          summary: clip(doc.summary, 400),
        },
      };
    });

  /* The first line's management response to each test in scope is a position too. */
  const tests = getDb()
    .select()
    .from(controlTests)
    .where(eq(controlTests.runId, context.runId))
    .all()
    .filter((test) => scope.controlIds.includes(test.controlId) && test.managementResponse.trim().length > 0);
  for (const test of tests) {
    const reports = relatedTo(docs, [test.id], ["control-test-report"]).filter((doc) => doc.status === "current");
    const line = scope.lines.find((candidate) => keyControlOf(candidate, controlList) === test.controlId);
    records.push({
      id: test.id,
      label: `Management response to ${test.id}`,
      value: `${personLabel(context.runId, test.managementResponseBy)}, ${test.status}`,
      evidenceIds: reports.map((doc) => doc.id).slice(0, 2),
      facts: {
        kind: "management-response",
        authorUserId: test.managementResponseBy,
        authorLabel: personLabel(context.runId, test.managementResponseBy),
        controlId: test.controlId,
        riskId: line?.riskId ?? null,
        lineId: line?.id ?? null,
        assessed: line?.controlEffectiveness ?? null,
        recordsAgainst: reports.map((doc) => doc.id).slice(0, 2).join(","),
        overdueActions: "",
        firstLine: controlList.find((row) => row.id === test.controlId)?.firstLineEffectiveness ?? null,
        secondLine: controlList.find((row) => row.id === test.controlId)?.currentEffectiveness ?? null,
        testStatus: test.status,
        exceptions: test.exceptionCount,
        summary: clip(test.managementResponse, 400),
      },
    });
  }

  return result(records, {
    note:
      records.length === 0
        ? {
            en: "No first-line submission is recorded on the controls in scope.",
            de: "Zu den Kontrollen im Umfang ist keine Eingabe der ersten Linie erfasst.",
          }
        : null,
  });
});

/* ==========================================================================
   Appetite statements
   ========================================================================== */

registerSourceLoader("rcsa.appetite-statements", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const records = riskRows(context, scope.riskIds)
    .sort((a, b) => scope.riskIds.indexOf(a.id) - scope.riskIds.indexOf(b.id))
    .map(
      (risk): SourceRecord => ({
        id: risk.id,
        label: risk.title,
        value: risk.appetitePosition,
        evidenceIds: relatedTo(docs, [risk.id], ["policy"]).map((doc) => doc.id).slice(0, 2),
        facts: {
          statement: clip(risk.appetiteStatement, 700),
          outsideFromScore: outsideFromScore(risk.appetiteStatement),
          recordedPosition: risk.appetitePosition,
          inherentLikelihood: risk.inherentLikelihood,
          inherentImpact: risk.inherentImpact,
          titleDe: risk.titleDe,
        },
      }),
    );
  return result(records);
});

/* ==========================================================================
   Owners and participants
   ========================================================================== */

registerSourceLoader("rcsa.scope-participants", (context) => {
  const scope = scopeOf(context);
  const roleOf = new Map<string, string[]>();
  const add = (userId: string | null | undefined, role: string): void => {
    if (!userId) return;
    roleOf.set(userId, unique([...(roleOf.get(userId) ?? []), role]));
  };

  const process = getDb()
    .select()
    .from(processes)
    .where(and(eq(processes.runId, context.runId), eq(processes.id, scope.processId)))
    .get();
  add(process?.ownerUserId, `process owner ${scope.processId}`);
  for (const risk of riskRows(context, scope.riskIds)) add(risk.ownerUserId, `risk owner ${risk.id}`);
  const controlList = controlRows(context, scope.controlIds);
  for (const line of scope.lines) {
    const keyId = keyControlOf(line, controlList);
    const control = controlList.find((row) => row.id === keyId);
    if (control?.isKeyControl) add(control.ownerUserId, `control owner ${control.id}`);
  }
  for (const test of getDb().select().from(controlTests).where(eq(controlTests.runId, context.runId)).all()) {
    if (scope.controlIds.includes(test.controlId) && test.entityId === scope.entityId) add(test.testerUserId, `control tester ${test.id}`);
  }
  add(roleHolder(context.run.roleId as RoleId, context.runId), "second-line facilitator");

  const people = getDb().select().from(users).where(eq(users.runId, context.runId)).all();
  const records = [...roleOf.entries()]
    .map(([userId, roles]): SourceRecord => {
      const person = people.find((row) => row.id === userId);
      return {
        id: userId,
        label: person?.name ?? userId,
        value: roles.join(", "),
        evidenceIds: [],
        facts: {
          jobTitle: person?.jobTitle ?? "",
          line: person?.line ?? "",
          department: person?.department ?? "",
          roles: roles.join("; "),
          facilitator: roles.includes("second-line facilitator"),
          processOwner: roles.some((role) => role.startsWith("process owner")),
          controlOwner: roles.some((role) => role.startsWith("control owner")),
        },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return result(records);
});

/* ==========================================================================
   Why the run exists
   ========================================================================== */

registerSourceLoader("rcsa.reassessment-trigger", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const subject = getDb()
    .select()
    .from(assessments)
    .where(and(eq(assessments.runId, context.runId), eq(assessments.id, scope.subjectAssessmentId)))
    .get();
  if (!subject) return result([]);

  if (scope.offCycle) {
    const started = findOsEvent(`process-run-started:${context.run.id}`, context.runId);
    const payload = (started?.payload ?? {}) as { sourceProcessRunId?: string | null; sourceStageRunId?: string | null };
    const baseline = priorAssessmentOf(context.runId, scope)?.assessment;
    const records: SourceRecord[] = [
      {
        id: subject.id,
        label: subject.title,
        value: "event-driven",
        evidenceIds: [],
        facts: {
          trigger: "event-driven",
          scopeStatement: clip(subject.rationale, 700),
          sourceDecisionId: subject.sourceDecisionId,
          sourceRunId: payload.sourceProcessRunId ?? null,
          sourceStageRunId: payload.sourceStageRunId ?? null,
          cycle: subject.cycle,
          baseline: scope.linesFromId,
          baselineCycle: baseline?.cycle ?? null,
          performedOn: (baseline?.approvedOn ?? baseline?.performedOn ?? "").slice(0, 10),
        },
      },
    ];
    /* The monitoring plan that decided the reassessment, when another run started this one. */
    const sourceStageRun = payload.sourceStageRunId ? getStageRunById(payload.sourceStageRunId) : undefined;
    if (sourceStageRun) {
      const plan = getArtifacts(sourceStageRun.roleAppRunId, sourceStageRun.stageId, context.runId).find(
        (artifact) => artifact.artifactKey === "monitoring-plan",
      );
      if (plan) {
        records.push({
          id: plan.id,
          label: plan.label,
          value: `${sourceStageRun.roleAppRunId}, ${sourceStageRun.completedAt ? formatDate(sourceStageRun.completedAt) : "open"}`,
          evidenceIds: [],
          facts: { kind: "monitoring-plan", sourceRunId: sourceStageRun.roleAppRunId, completedBy: sourceStageRun.completedByUserId, rationale: clip(sourceStageRun.completionRationale ?? "", 500) },
        });
      }
    }
    return result(records);
  }

  /* A cycle run: the schedule, and the minutes that confirmed its scope and trigger. */
  const records: SourceRecord[] = [
    {
      id: subject.id,
      label: subject.title,
      value: "scheduled",
      evidenceIds: [],
      facts: { trigger: "scheduled", cycle: subject.cycle, performedOn: subject.performedOn, status: subject.status },
    },
  ];
  for (const minutes of getMinutesArchive("rcsa", context.runId)) {
    const subjectMatch = minutes.title.includes(scope.processId) || minutes.summary.includes(scope.processId);
    if (!subjectMatch || (minutes.status !== "confirmed" && minutes.status !== "distributed")) continue;
    const evidence = docs.filter((doc) => doc.id === `EVD-${minutes.id}` || doc.relatedObjectIds.includes(minutes.id)).map((doc) => doc.id);
    records.push({
      id: minutes.id,
      label: minutes.title,
      value: `${minutes.status}, ${personLabel(context.runId, minutes.confirmedByUserId)}`,
      evidenceIds: evidence,
      facts: {
        kind: "scope-minutes",
        confirmedBy: minutes.confirmedByUserId,
        confirmedAt: minutes.confirmedAt,
        facts: clip(minutes.factItems.join(" | "), 700),
      },
    });
  }
  return result(records);
});

/* ==========================================================================
   Decisions recorded in the cycle
   ========================================================================== */

/** The stage order of the RCSA contract, for listing a run's decisions as the cycle meets them. */
const STAGE_SEQUENCE = new Map(RCSA_CYCLE_PROCESS.stages.map((stage) => [stage.id, stage.sequence]));

/**
 * The decisions of this run (`decisions.process_run_id`, migration 0007), in
 * stage order: the Q4 cycle's seeded judgments for its run, a later run's own
 * decisions for that run. Each record names its stage and the position of the
 * chosen option, which is how the later stages read what was decided.
 */
registerSourceLoader("rcsa.cycle-decisions", (context) => {
  const docs = new Set(revealedEvidence(context.runId, context.state).map((doc) => doc.id));
  const rows = listDecisionsForProcessRun(context.run.id, context.runId)
    .slice()
    .sort((a, b) => (STAGE_SEQUENCE.get(a.processStageId ?? "") ?? 99) - (STAGE_SEQUENCE.get(b.processStageId ?? "") ?? 99) || a.id.localeCompare(b.id));
  if (rows.length === 0) {
    return result([], {
      note: {
        en: "No decision of this run has been presented yet. A stage presents the run's own decision when it opens.",
        de: "Fuer diesen Durchlauf wurde noch keine Entscheidung vorgelegt. Eine Stufe legt die eigene Entscheidung des Durchlaufs vor, wenn sie geoeffnet wird.",
      },
    });
  }
  const options = getDb().select().from(decisionOptions).where(eq(decisionOptions.runId, context.runId)).orderBy(asc(decisionOptions.sortOrder)).all();
  const records = rows.map((row): SourceRecord => {
    const own = options.filter((option) => option.decisionId === row.id);
    const chosenIndex = own.findIndex((option) => option.id === row.chosenOptionId);
    const chosen = chosenIndex >= 0 ? own[chosenIndex] : undefined;
    return {
      id: row.id,
      label: row.title,
      value: row.status === "decided" ? (chosen?.label ?? row.chosenOptionId ?? "decided") : "open",
      evidenceIds: unique([...row.supportingEvidenceIds, ...row.opposingEvidenceIds]).filter((evidenceId) => docs.has(evidenceId)).slice(0, 4),
      facts: {
        status: row.status,
        stageId: row.processStageId,
        chosenOptionId: row.chosenOptionId,
        chosenOptionPosition: chosenIndex >= 0 ? chosenIndex + 1 : null,
        optionLabel: chosen?.label ?? null,
        optionLabelDe: chosen?.labelDe ?? null,
        rationale: clip(row.recordedRationale, 500),
        decidedBy: row.decidedByUserId,
        decidedAt: row.decidedAt,
        presentedAt: row.presentedAtMoment,
        judgmentKind: row.judgmentKind,
        relatedObjectId: row.relatedObjectId,
        titleDe: row.titleDe,
      },
    };
  });
  return result(records);
});

/* ==========================================================================
   Actions on the scope
   ========================================================================== */

/** The open actions on a scope, and the ones this run raised. Shared with the stage tools. */
export function actionsOnScope(context: { runId: string; run: { id: string } }, scope: RcsaScope) {
  const kriIds = getDb()
    .select()
    .from(kris)
    .where(eq(kris.runId, context.runId))
    .all()
    .filter((kri) => kri.entityId === scope.entityId && (kri.processIds.includes(scope.processId) || kri.riskIds.some((id) => scope.riskIds.includes(id))))
    .map((kri) => kri.id);
  const inScope = new Set([...scope.controlIds, ...scope.riskIds, scope.processId, scope.subjectAssessmentId, scope.assessmentId, ...kriIds]);
  return getDb()
    .select()
    .from(actions)
    .where(eq(actions.runId, context.runId))
    .all()
    .filter(
      (action) =>
        action.sourceProcessRunId === context.run.id ||
        (action.status !== "completed" && action.status !== "cancelled" && action.relatedObjectId !== null && inScope.has(action.relatedObjectId)),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

registerSourceLoader("rcsa.action-plan", (context) => {
  const scope = scopeOf(context);
  const scenarioDate = context.state.scenarioDate;
  const records = actionsOnScope(context, scope).map((action): SourceRecord => {
    const overdue = action.status === "overdue" || (action.dueOn !== null && action.dueOn < scenarioDate && action.status !== "completed");
    return {
      id: action.id,
      label: action.title,
      value: `${overdue ? "overdue" : action.status}, ${action.ownerUserId ?? "no owner"}, ${action.dueOn ? formatDate(action.dueOn) : "no date"}`,
      evidenceIds: [],
      facts: {
        kind: action.kind,
        status: action.status,
        overdue,
        ownerUserId: action.ownerUserId,
        ownerLabel: action.ownerLabel,
        dueOn: action.dueOn,
        relatedObjectId: action.relatedObjectId,
        sourceDecisionId: action.sourceDecisionId,
        sourceProcessRunId: action.sourceProcessRunId,
        sourceStageId: action.sourceStageId,
        completionCondition: action.completionCondition,
        raisedByRoleId: action.raisedByRoleId,
        titleDe: action.titleDe,
      },
    };
  });
  return result(records, {
    note: records.length === 0 ? { en: "No open action is recorded on the scope.", de: "Im Umfang ist keine offene Massnahme erfasst." } : null,
  });
});

/* ==========================================================================
   The records the earlier stages wrote
   ========================================================================== */

/**
 * Each earlier stage's completion record, latest version, with the flat
 * `facts` the stage record carries for the stages after it. Persisted rows
 * only: a stage that has not completed has no record here.
 */
registerSourceLoader("rcsa.cycle-record", (context) => {
  const latest = new Map<string, ReturnType<typeof getArtifacts>[number]>();
  for (const artifact of getArtifacts(context.run.id, undefined, context.runId)) {
    if (artifact.producedBy !== "stage-completion") continue;
    const key = `${artifact.stageId}:${artifact.artifactKey}`;
    const seen = latest.get(key);
    if (!seen || artifact.version > seen.version) latest.set(key, artifact);
  }
  const order = RCSA_CYCLE_PROCESS.stages.map((stage) => stage.id);
  const records = [...latest.values()]
    .sort((a, b) => order.indexOf(a.stageId) - order.indexOf(b.stageId))
    .map((artifact): SourceRecord => {
      let facts: Record<string, string | number | boolean | null> = {};
      try {
        const content = JSON.parse(artifact.content ?? "{}") as { facts?: Record<string, unknown> };
        for (const [key, value] of Object.entries(content.facts ?? {})) {
          if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") facts[key] = value;
        }
      } catch {
        facts = {};
      }
      return {
        id: artifact.id,
        label: artifact.label,
        value: `${artifact.stageId}, version ${artifact.version}`,
        evidenceIds: [],
        facts: { stageId: artifact.stageId, artifactKey: artifact.artifactKey, ...facts },
      };
    });
  return result(records, {
    note: records.length === 0 ? { en: "No earlier stage of this run has written a record yet.", de: "Keine fruehere Stufe dieses Durchlaufs hat bisher ein Protokoll geschrieben." } : null,
  });
});

/* ==========================================================================
   Monitoring already active
   ========================================================================== */

registerSourceLoader("rcsa.monitoring-activations", (context) => {
  const scope = scopeOf(context);
  const kriIds = getDb()
    .select()
    .from(kris)
    .where(eq(kris.runId, context.runId))
    .all()
    .filter((kri) => kri.entityId === scope.entityId && (kri.processIds.includes(scope.processId) || kri.riskIds.some((id) => scope.riskIds.includes(id))))
    .map((kri) => kri.id);
  const inScope = new Set([...scope.controlIds, ...scope.riskIds, scope.processId, ...kriIds]);
  const records = getDb()
    .select()
    .from(monitoringActivations)
    .where(eq(monitoringActivations.runId, context.runId))
    .all()
    .filter((row) => row.active && inScope.has(row.subjectId))
    .map(
      (row): SourceRecord => ({
        id: row.id,
        label: row.description,
        value: `${row.subjectId}, ${row.reviewFrequency}`,
        evidenceIds: [],
        facts: { subjectKind: row.subjectKind, subjectId: row.subjectId, reviewFrequency: row.reviewFrequency, sourceDecisionId: row.sourceDecisionId, nextReviewOn: row.nextReviewOn },
      }),
    );
  return result(records, {
    note:
      records.length === 0
        ? { en: "No enhanced monitoring is active on the scope.", de: "Im Umfang ist keine verstaerkte Ueberwachung aktiv." }
        : null,
  });
});
