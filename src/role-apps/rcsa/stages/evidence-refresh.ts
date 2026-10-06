/**
 * RCSA Stage 2, Evidence Refresh: the reference implementation.
 *
 * This module is the pattern the remaining RCSA stages copy. It registers,
 * under the keys the stage contract names:
 *
 *   eight source loaders   KRI readings, incidents, losses, control tests,
 *                          open actions, the prior assessment, process
 *                          telemetry and control evidence freshness
 *   one preparer           the offline composer and the live prompt
 *   one task form          the evidence sufficiency review
 *   one payload builder    the GRC platform action that registers the
 *                          investigation agreed in the stage's decision
 *                          (DEC-2026-0771 for the Q4 cycle, the run's own
 *                          copy of it for a later run)
 *   one artifact builder   the evidence pack written at completion
 *
 * Every loader reads the seeded database and nothing else. The scope comes
 * from the assessment the run is about: its process, its entity and the risks
 * and controls on its lines (`./shared.ts`, which follows the assessment's
 * versions and gives an off-cycle assessment the lines of its baseline).
 * Nothing here names a figure; every figure in the preparation is read from a
 * row.
 *
 * The loaders registered here are shared by later stages (the KRI readings,
 * the prior assessment, the control tests, the losses, the open actions and
 * the incidents), which is why they live with the stage that first reads them.
 *
 * Synthetic institution and data.
 */

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { kriReadings, kris, processes, controls } from "@/db/schema/domain";
import { controlTests, incidents } from "@/db/schema/practice";
import { actions, issues } from "@/db/schema/decisions";
import type { Bilingual } from "@/role-apps/contracts";
import { formatDate, formatNumber, relatedTo, revealedEvidence, unique } from "@/role-apps/stage-support";
import {
  registerArtifactBuilder,
  registerPayloadBuilder,
  registerPreparer,
  registerSourceLoader,
  registerTaskForm,
  type SourceLoaderContext,
} from "@/features/process/registry";
import type { SourceRecord, StageContext } from "@/features/process/types";
import type { StagePreparationOutput } from "@/features/process/preparation-schema";
import { recordedTaskOutput } from "@/features/process/tasks";
import {
  boundDecisionId,
  chosenPosition,
  effectivenessLabel,
  list,
  priorAssessmentOf,
  ratingLabel,
  recordsOf,
  result,
  scopeOf,
  sourceOf,
  type RcsaScope,
} from "./shared";

const PROCESS_ID = "rcsa-cycle";
const STAGE_ID = "evidence-refresh";
/** The decision the contract names: the Q4 cycle's. A later run binds its own copy. */
const DECISION_ID = "DEC-2026-0771";

/* ==========================================================================
   Source loaders
   ========================================================================== */

function kriRows(context: SourceLoaderContext, scope: RcsaScope) {
  return getDb()
    .select()
    .from(kris)
    .where(eq(kris.runId, context.runId))
    .all()
    .filter(
      (kri) =>
        kri.entityId === scope.entityId &&
        (kri.processIds.includes(scope.processId) || kri.riskIds.some((id) => scope.riskIds.includes(id))),
    );
}

registerSourceLoader("rcsa.kri-readings", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const order = { red: 0, amber: 1, green: 2 } as Record<string, number>;

  const records = kriRows(context, scope)
    .map((kri): SourceRecord => {
      const readings = getDb()
        .select()
        .from(kriReadings)
        .where(and(eq(kriReadings.runId, context.runId), eq(kriReadings.kriId, kri.id)))
        .orderBy(desc(kriReadings.sortOrder))
        .limit(3)
        .all();
      const latest = readings[0];
      const previous = readings[1];
      const evidence = relatedTo(docs, [kri.id], ["kri-report"]).map((doc) => doc.id);
      return {
        id: kri.id,
        label: kri.name,
        value: `${(latest?.status ?? kri.currentStatus).toUpperCase()} ${latest?.value ?? kri.currentValue}`,
        evidenceIds: evidence,
        facts: {
          status: latest?.status ?? kri.currentStatus,
          value: latest?.value ?? kri.currentValue,
          period: latest?.period ?? null,
          previousValue: previous?.value ?? null,
          previousPeriod: previous?.period ?? null,
          amber: kri.amberThreshold,
          red: kri.redThreshold,
          unit: kri.unit,
          nameDe: kri.nameDe,
        },
      };
    })
    .sort((a, b) => (order[String(a.facts?.status)] ?? 3) - (order[String(b.facts?.status)] ?? 3) || a.id.localeCompare(b.id));

  const latestPeriod = records.map((record) => String(record.facts?.period ?? "")).sort().at(-1) ?? null;
  return result(records, { asOf: latestPeriod });
});

function incidentRows(context: SourceLoaderContext, scope: RcsaScope) {
  return getDb()
    .select()
    .from(incidents)
    .where(eq(incidents.runId, context.runId))
    .all()
    .filter((incident) => incident.processIds.includes(scope.processId))
    // The shared 14:05 event is not known before it happens.
    .filter((incident) => !incident.isSharedEvent || context.state.eventTriggered)
    .sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));
}

registerSourceLoader("rcsa.incidents", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const records = incidentRows(context, scope).map(
    (incident): SourceRecord => ({
      id: incident.id,
      label: incident.title,
      value: `${incident.kind}, ${incident.status}`,
      evidenceIds: relatedTo(docs, [incident.id]).map((doc) => doc.id),
      facts: { kind: incident.kind, status: incident.status, detectedAt: incident.detectedAt, titleDe: incident.titleDe },
    }),
  );
  return result(records, { asOf: records.at(-1)?.facts?.detectedAt?.toString().slice(0, 10) ?? null });
});

registerSourceLoader("rcsa.losses", (context) => {
  const scope = scopeOf(context);
  const withLoss = incidentRows(context, scope).filter((incident) => (incident.grossLossMinor ?? 0) > 0);
  const records = withLoss.map(
    (incident): SourceRecord => ({
      id: incident.id,
      label: incident.title,
      value: `${((incident.grossLossMinor ?? 0) / 100).toFixed(2)} ${incident.lossCurrency ?? "EUR"}`,
      evidenceIds: [],
      facts: { lossMinor: incident.grossLossMinor ?? 0, currency: incident.lossCurrency ?? "EUR" },
    }),
  );
  return result(records, {
    note:
      records.length === 0
        ? {
            en: "No loss is recorded against the incidents on this process. Zero recorded losses is a fact about the loss record, not about the risk.",
            de: "Gegen die Vorfaelle dieses Prozesses ist kein Verlust erfasst. Null erfasste Verluste sind eine Aussage ueber die Verlusterfassung, nicht ueber das Risiko.",
          }
        : null,
  });
});

function testRows(context: SourceLoaderContext, scope: RcsaScope) {
  return getDb()
    .select()
    .from(controlTests)
    .where(eq(controlTests.runId, context.runId))
    .all()
    .filter((test) => scope.controlIds.includes(test.controlId) && test.entityId === scope.entityId);
}

registerSourceLoader("rcsa.control-tests", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const records: SourceRecord[] = [];

  for (const test of testRows(context, scope)) {
    const related = docs.filter((doc) =>
      doc.relatedObjectIds.some((id) => id === test.id || id.endsWith(test.id) || id.includes(`-${test.id}-`)),
    );
    const reports = related.filter((doc) => doc.sourceType === "control-test-report" && doc.status === "current");
    records.push({
      id: test.id,
      label: test.title,
      value: `${test.status}, ${test.exceptionCount} exception(s)`,
      evidenceIds: reports.map((doc) => doc.id),
      facts: {
        controlId: test.controlId,
        status: test.status,
        exceptions: test.exceptionCount,
        population: test.populationSize,
        sample: test.sampleSize,
        periodTo: test.periodTo,
      },
    });
    for (const gap of related.filter((doc) => doc.status === "missing" || doc.status === "requested")) {
      records.push({
        id: gap.id,
        label: gap.title,
        value: gap.status,
        evidenceIds: [gap.id],
        facts: {
          gapFor: test.id,
          status: gap.status,
          requestedOn: gap.requestedOn,
          requestedFrom: gap.requestedFromLabel,
          titleDe: gap.titleDe,
        },
      });
    }
  }
  return result(records);
});

registerSourceLoader("rcsa.actions", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const testIds = testRows(context, scope).map((test) => test.id);
  const kriIds = kriRows(context, scope).map((kri) => kri.id);
  const inScope = new Set([
    ...scope.controlIds,
    ...scope.riskIds,
    scope.processId,
    scope.subjectAssessmentId,
    scope.assessmentId,
    ...kriIds,
    ...testIds,
  ]);
  const touches = (id: string | null): boolean =>
    id !== null && (inScope.has(id) || testIds.some((testId) => id.includes(testId)));
  const scenarioDate = context.state.scenarioDate;

  const actionRecords = getDb()
    .select()
    .from(actions)
    .where(eq(actions.runId, context.runId))
    .all()
    .filter((action) => touches(action.relatedObjectId) && action.status !== "completed" && action.status !== "cancelled")
    .map((action): SourceRecord => {
      const overdue = action.status === "overdue" || (action.dueOn !== null && action.dueOn < scenarioDate);
      return {
        id: action.id,
        label: action.title,
        value: overdue ? "overdue" : action.status,
        evidenceIds: relatedTo(docs, [action.id], ["remediation-update"]).map((doc) => doc.id),
        facts: { kind: action.kind, status: action.status, dueOn: action.dueOn, overdue, unowned: action.isUnowned },
      };
    });

  const issueRecords = getDb()
    .select()
    .from(issues)
    .where(eq(issues.runId, context.runId))
    .all()
    .filter((issue) => (touches(issue.relatedObjectId) || issue.controlIds.some((id) => inScope.has(id))) && issue.status !== "closed")
    .map(
      (issue): SourceRecord => ({
        id: issue.id,
        label: issue.title,
        value: issue.status,
        evidenceIds: [],
        facts: { kind: "issue", status: issue.status, dueOn: issue.dueOn, overdue: false },
      }),
    );

  return result([...actionRecords, ...issueRecords].sort((a, b) => a.id.localeCompare(b.id)));
});

registerSourceLoader("rcsa.prior-assessment", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const found = priorAssessmentOf(context.runId, scope);
  if (!found) return result([]);
  const { assessment: prior, lines } = found;

  /*
   * The signed extract of the prior cycle is filed against the assessment
   * series rather than the prior version's own identifier, so both are read:
   * extracts of the prior version, and superseded extracts of the series.
   */
  const evidence = unique([
    ...relatedTo(docs, [prior.id], ["rcsa-extract"]).map((doc) => doc.id),
    ...relatedTo(docs, [scope.subjectAssessmentId], ["rcsa-extract"])
      .filter((doc) => doc.status === "superseded")
      .map((doc) => doc.id),
  ]);

  return result(
    lines.map(
      (line): SourceRecord => ({
        id: line.id,
        label: `${line.riskId} in ${prior.cycle}`,
        value: `${line.residualRating}, ${line.controlEffectiveness}`,
        evidenceIds: evidence,
        facts: {
          assessmentId: prior.id,
          version: prior.version,
          cycle: prior.cycle,
          status: prior.status,
          riskId: line.riskId,
          residualRating: line.residualRating,
          controlEffectiveness: line.controlEffectiveness,
          appetitePosition: line.appetitePosition,
        },
      }),
    ),
    { asOf: prior.approvedOn ?? prior.performedOn },
  );
});

registerSourceLoader("rcsa.process-telemetry", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const row = getDb()
    .select()
    .from(processes)
    .where(and(eq(processes.runId, context.runId), eq(processes.id, scope.processId)))
    .get();
  if (!row) return result([]);
  const evidence = relatedTo(docs, [scope.processId], ["telemetry-extract", "transaction-log"]).map((doc) => doc.id);
  return result([
    {
      id: row.id,
      label: row.name,
      value: `${row.monthlyVolume ?? 0} cases a month, ${row.manualTouchRate ?? 0} percent manual`,
      evidenceIds: evidence,
      facts: {
        code: row.code,
        monthlyVolume: row.monthlyVolume,
        manualTouchRate: row.manualTouchRate,
        recentChange: row.recentChangeNote,
        nameDe: row.nameDe,
      },
    },
  ]);
});

registerSourceLoader("rcsa.control-evidence", (context) => {
  const scope = scopeOf(context);
  const docs = revealedEvidence(context.runId, context.state);
  const keyControls = getDb()
    .select()
    .from(controls)
    .where(eq(controls.runId, context.runId))
    .all()
    .filter((control) => scope.controlIds.includes(control.id) && control.isKeyControl);

  const records: SourceRecord[] = [];
  for (const control of keyControls) {
    const descriptions = relatedTo(docs, [control.id], ["control-description"]).filter((doc) => doc.status === "current");
    // The first line's self-assessment is the stakeholder statement among the current extracts.
    const selfAssessments = relatedTo(docs, [control.id], ["rcsa-extract"]).filter(
      (doc) => doc.status === "current" && doc.provenance === "stakeholder-statement",
    );
    records.push({
      id: control.id,
      label: control.title,
      value: `second line ${control.currentEffectiveness}, first line ${control.firstLineEffectiveness}`,
      evidenceIds: unique([...descriptions.map((doc) => doc.id), ...selfAssessments.map((doc) => doc.id)]),
      facts: {
        secondLine: control.currentEffectiveness,
        firstLine: control.firstLineEffectiveness,
        staleDescriptions: descriptions.filter((doc) => doc.isStale).map((doc) => doc.id).join(","),
        selfAssessment: selfAssessments[0]?.id ?? null,
        titleDe: control.titleDe,
      },
    });
  }
  const anyStale = records.some((record) => String(record.facts?.staleDescriptions ?? "").length > 0);
  return { ...result(records), status: records.length === 0 ? "empty" : anyStale ? "stale" : "loaded" };
});

/* ==========================================================================
   The preparer
   ========================================================================== */

type Sources = StageContext["sources"];

function composeEvidenceRefresh(input: { context: StageContext; sources: Sources }): StagePreparationOutput {
  const { context, sources } = input;
  const subject = context.run.subjectId;
  const findings: StagePreparationOutput["findings"] = [];
  const gaps: StagePreparationOutput["gaps"] = [];
  const contradictions: StagePreparationOutput["contradictions"] = [];
  const inferences: StagePreparationOutput["inferences"] = [];
  const limitations: StagePreparationOutput["limitations"] = [];

  /* Indicators. */
  const kriRecords = recordsOf(sources, "kri-readings");
  const red = kriRecords.filter((record) => record.facts?.status === "red");
  const amber = kriRecords.filter((record) => record.facts?.status === "amber");
  for (const record of [...red, ...amber].slice(0, 5)) {
    const facts = record.facts ?? {};
    const status = String(facts.status);
    const statusDe = status === "red" ? "Rot" : status === "amber" ? "Gelb" : "Gruen";
    const previous =
      facts.previousValue !== null && facts.previousValue !== undefined
        ? { en: ` (${facts.previousValue} in ${facts.previousPeriod})`, de: ` (${facts.previousValue} in ${facts.previousPeriod})` }
        : { en: "", de: "" };
    findings.push({
      sourceKey: "kri-readings",
      statement: {
        en: `${record.id} ${record.label} read ${facts.value} in ${facts.period}, ${status === "red" ? "Red" : "Amber"} against a Red threshold of ${facts.red}${previous.en}.`,
        de: `${record.id} ${String(facts.nameDe ?? record.label)} lag ${facts.period} bei ${facts.value}, ${statusDe} bei einer roten Schwelle von ${facts.red}${previous.de}.`,
      },
      evidenceIds: record.evidenceIds.slice(0, 3),
      basis: "verified-fact",
    });
  }

  /* Incidents and losses. */
  const incidentRecords = recordsOf(sources, "incidents");
  const openIncidents = incidentRecords.filter((record) => !["closed", "recovered"].includes(String(record.facts?.status)));
  findings.push({
    sourceKey: "incidents",
    statement: {
      en: `${incidentRecords.length} incident(s) are recorded on the process, ${openIncidents.length} of them still open.`,
      de: `Im Prozess sind ${incidentRecords.length} Vorfaelle erfasst, davon ${openIncidents.length} noch offen.`,
    },
    evidenceIds: unique(incidentRecords.flatMap((record) => record.evidenceIds)).slice(0, 4),
    basis: "approved-record",
  });
  const losses = sourceOf(sources, "losses");
  if (losses && losses.result.records.length === 0) {
    findings.push({
      sourceKey: "losses",
      statement: {
        en: `No loss is recorded against the ${incidentRecords.length} incident(s) on the process.`,
        de: `Gegen die ${incidentRecords.length} Vorfaelle des Prozesses ist kein Verlust erfasst.`,
      },
      evidenceIds: [],
      basis: "approved-record",
    });
    limitations.push({
      en: "Zero recorded losses cannot be read as low likelihood until it is clear whether the detective controls can see the outcome.",
      de: "Null erfasste Verluste lassen sich erst dann als geringe Eintrittswahrscheinlichkeit lesen, wenn klar ist, ob die aufdeckenden Kontrollen das Ergebnis sehen koennen.",
    });
  }

  /* Control tests and their evidence gaps. */
  for (const record of recordsOf(sources, "control-tests")) {
    const facts = record.facts ?? {};
    if (facts.gapFor) {
      const missing = facts.status === "missing";
      gaps.push({
        key: `gap-${record.id}`,
        statement: {
          en: `${record.id} for ${facts.gapFor} is ${missing ? "missing" : "requested"}${facts.requestedOn ? ` since ${formatDate(String(facts.requestedOn))}` : ""}${facts.requestedFrom ? ` from ${facts.requestedFrom}` : ""}. The item it supports cannot be concluded without it.`,
          de: `${record.id} zu ${facts.gapFor} ist ${missing ? "nicht vorhanden" : "angefordert"}${facts.requestedOn ? ` seit ${formatDate(String(facts.requestedOn))}` : ""}. Der zugehoerige Punkt kann ohne ihn nicht abgeschlossen werden.`,
        },
        evidenceIds: [record.id],
        severity: "material",
      });
      continue;
    }
    findings.push({
      sourceKey: "control-tests",
      statement: {
        en: `${record.id} on ${facts.controlId} is ${facts.status} with ${facts.exceptions} exception(s) in a sample of ${facts.sample} from ${formatNumber(Number(facts.population ?? 0), "en")}.`,
        de: `${record.id} zu ${facts.controlId} ist ${facts.status === "disputed" ? "strittig" : facts.status} mit ${facts.exceptions} Ausnahmen in einer Stichprobe von ${facts.sample} aus ${formatNumber(Number(facts.population ?? 0), "de")}.`,
      },
      evidenceIds: record.evidenceIds.slice(0, 3),
      basis: "approved-record",
    });
  }

  /* Open actions. */
  const actionRecords = recordsOf(sources, "open-actions");
  const overdue = actionRecords.filter((record) => record.facts?.overdue === true);
  findings.push({
    sourceKey: "open-actions",
    statement: {
      en: `${actionRecords.length} action(s) and issue(s) are open on the scope${overdue.length > 0 ? `, ${overdue.length} overdue: ${list(overdue.slice(0, 3).map((record) => `${record.id} (due ${formatDate(String(record.facts?.dueOn ?? ""))})`), "en")}` : ""}.`,
      de: `Im Umfang sind ${actionRecords.length} Massnahmen und Themen offen${overdue.length > 0 ? `, ${overdue.length} ueberfaellig: ${list(overdue.slice(0, 3).map((record) => `${record.id} (faellig ${formatDate(String(record.facts?.dueOn ?? ""))})`), "de")}` : ""}.`,
    },
    evidenceIds: unique(actionRecords.flatMap((record) => record.evidenceIds)).slice(0, 4),
    basis: "approved-record",
  });

  /* Prior assessment. */
  const priorRecords = recordsOf(sources, "prior-assessment");
  const priorFirst = priorRecords[0];
  if (priorFirst) {
    const facts = priorFirst.facts ?? {};
    findings.push({
      sourceKey: "prior-assessment",
      statement: {
        en: `The prior version ${facts.assessmentId} (version ${facts.version}, ${facts.status}) rated ${facts.riskId} ${ratingLabel(String(facts.residualRating), "en")} with control effectiveness ${effectivenessLabel(String(facts.controlEffectiveness), "en").toLowerCase()}.`,
        de: `Die Vorversion ${facts.assessmentId} (Version ${facts.version}, ${facts.status}) bewertete ${facts.riskId} mit ${ratingLabel(String(facts.residualRating), "de")} bei Kontrollwirksamkeit ${effectivenessLabel(String(facts.controlEffectiveness), "de").toLowerCase()}.`,
      },
      evidenceIds: priorFirst.evidenceIds.slice(0, 2),
      basis: "approved-record",
    });
  } else {
    gaps.push({
      key: "gap-prior-assessment",
      statement: { en: "No prior assessment version exists for comparison.", de: "Es gibt keine Vorversion der Bewertung zum Vergleich." },
      evidenceIds: [],
      severity: "minor",
    });
  }

  /* Process telemetry (helpful). */
  const telemetry = sourceOf(sources, "process-telemetry");
  const telemetryRecord = telemetry?.result.records[0];
  if (telemetryRecord) {
    const facts = telemetryRecord.facts ?? {};
    findings.push({
      sourceKey: "process-telemetry",
      statement: {
        en: `${telemetryRecord.id} handles ${formatNumber(Number(facts.monthlyVolume ?? 0), "en")} cases a month with a manual touch rate of ${facts.manualTouchRate} percent.`,
        de: `${telemetryRecord.id} bearbeitet ${formatNumber(Number(facts.monthlyVolume ?? 0), "de")} Faelle im Monat bei einer manuellen Quote von ${facts.manualTouchRate} Prozent.`,
      },
      evidenceIds: telemetryRecord.evidenceIds.slice(0, 3),
      basis: "telemetry",
    });
  } else if (telemetry?.status === "unavailable") {
    limitations.push({
      en: "Process telemetry was unavailable, so volume and manual intervention are not part of this preparation.",
      de: "Prozesstelemetrie war nicht verfuegbar, daher fehlen Volumen und manuelle Eingriffe in dieser Vorbereitung.",
    });
  }

  /* Control evidence: staleness and the first and second line disagreement. */
  for (const record of recordsOf(sources, "control-evidence")) {
    const facts = record.facts ?? {};
    const stale = String(facts.staleDescriptions ?? "").split(",").filter((id) => id.length > 0);
    for (const id of stale) {
      gaps.push({
        key: `stale-${id}`,
        statement: {
          en: `The control description ${id} for ${record.id} is stale, so the design being assessed may not be the design in operation.`,
          de: `Die Kontrollbeschreibung ${id} zu ${record.id} ist veraltet; das bewertete Design ist moeglicherweise nicht das betriebene.`,
        },
        evidenceIds: [id],
        severity: "minor",
      });
    }
    /*
     * The recorded rating against the test. A control recorded as fully
     * effective while its test found exceptions is a contradiction between two
     * records, whichever line holds the rating; it is the question the
     * challenge workshop has to answer, so it is surfaced here, not resolved.
     */
    const testEvidence = recordsOf(sources, "control-tests").find(
      (test) => test.facts?.controlId === record.id && Number(test.facts?.exceptions ?? 0) > 0,
    );
    const ratingEvidence = facts.selfAssessment ? String(facts.selfAssessment) : record.evidenceIds[0];
    const fullyEffective = facts.secondLine === "fully-effective" || facts.firstLine === "fully-effective";
    if (testEvidence && testEvidence.evidenceIds[0] && ratingEvidence && (fullyEffective || facts.firstLine !== facts.secondLine)) {
      contradictions.push({
        statement: {
          en: `${record.id} is recorded as ${effectivenessLabel(String(facts.secondLine), "en").toLowerCase()} (first line: ${effectivenessLabel(String(facts.firstLine), "en").toLowerCase()}), while ${testEvidence.id} is ${testEvidence.facts?.status} with ${testEvidence.facts?.exceptions} exception(s).`,
          de: `${record.id} ist als ${effectivenessLabel(String(facts.secondLine), "de").toLowerCase()} erfasst (erste Linie: ${effectivenessLabel(String(facts.firstLine), "de").toLowerCase()}), waehrend ${testEvidence.id} ${testEvidence.facts?.status === "disputed" ? "strittig" : testEvidence.facts?.status} ist mit ${testEvidence.facts?.exceptions} Ausnahmen.`,
        },
        evidenceIds: unique([ratingEvidence, testEvidence.evidenceIds[0]]),
      });
    }
  }

  /* One inference, labelled as such. */
  if (red.length >= 2) {
    const kriEvidence = unique(red.flatMap((record) => record.evidenceIds)).slice(0, 3);
    const telemetryEvidence = telemetryRecord?.evidenceIds.slice(0, 1) ?? [];
    inferences.push({
      statement: {
        en: `The Red indicators ${list(red.map((record) => record.id), "en")} sit on the same process and the same key risk, which points to one mechanism behind them rather than ${red.length} separate breaches.`,
        de: `Die roten Indikatoren ${list(red.map((record) => record.id), "de")} liegen auf demselben Prozess und demselben Schluesselrisiko; das deutet auf einen gemeinsamen Mechanismus statt auf ${red.length} getrennte Verletzungen.`,
      },
      evidenceIds: unique([...kriEvidence, ...telemetryEvidence]),
      uncertainty: {
        en: "The link is structural and temporal. The override records carry no field that ties them to one cause, so the mechanism is an inference until the first line confirms it.",
        de: "Der Zusammenhang ist strukturell und zeitlich. Die Ueberschreibungen tragen kein Feld, das sie einer Ursache zuordnet; der Mechanismus bleibt eine Schlussfolgerung, bis die erste Linie ihn bestaetigt.",
      },
    });
  }

  const gapCount = gaps.filter((gap) => gap.severity !== "minor").length;
  return {
    schemaVersion: "stage-preparation-v1",
    summary: {
      en: `Evidence for ${subject} is loaded from ${sources.filter((source) => source.status !== "unavailable").length} sources. ${red.length} indicator(s) are Red${red.length > 0 ? ` (${list(red.map((record) => record.id), "en")})` : ""}, ${overdue.length} action(s) are overdue, and ${gapCount} test evidence item(s) are still outstanding.`,
      de: `Die Nachweise zu ${subject} sind aus ${sources.filter((source) => source.status !== "unavailable").length} Quellen geladen. ${red.length} Indikatoren sind rot${red.length > 0 ? ` (${list(red.map((record) => record.id), "de")})` : ""}, ${overdue.length} Massnahmen sind ueberfaellig, und ${gapCount} Testnachweise stehen noch aus.`,
    },
    findings,
    inferences,
    contradictions,
    gaps,
    itemAssessments: [],
    proposals: [
      {
        toolKey: "register-investigation",
        rationale: {
          en: "Once the investigation strategy is decided, register it in the GRC platform so the first line sees one owner and one due date.",
          de: "Sobald die Untersuchungsstrategie entschieden ist, im GRC-System registrieren, damit die erste Linie eine Verantwortung und einen Termin sieht.",
        },
      },
    ],
    recommendedOptionId: null,
    limitations,
  };
}

const PROMPT = `You prepare Stage 2 (Evidence Refresh) of a Risk and Control Self-Assessment for a second-line Operational Risk Partner at a synthetic bank.
Use only the source records provided. Cite evidence identifiers exactly as given; never invent one. Separate verified facts, interpretations (inferences, with their uncertainty), contradictions between sources, and gaps.
Do not recommend a rating or close any action. The investigation strategy is a human decision.
Write every text field in British English ("en") and in German ("de", ASCII only: ae, oe, ue, ss; no umlauts). No dashes as punctuation.`;

registerPreparer("rcsa.evidence-refresh", {
  compose: (input) => composeEvidenceRefresh(input),
  prompt: ({ context, sources }) => ({
    instructions: PROMPT,
    input: JSON.stringify({
      assessment: context.run.subjectId,
      stage: context.stage.name,
      sources: sources.map((source) => ({
        key: source.spec.key,
        necessity: source.necessity,
        status: source.status,
        records: source.result.records.map((record) => ({ id: record.id, label: record.label, value: record.value, evidenceIds: record.evidenceIds, facts: record.facts })),
        note: source.result.note?.en ?? null,
      })),
      tools: context.stage.tools.map((tool) => tool.key),
    }),
  }),
  itemIds: () => [],
});

/* ==========================================================================
   The evidence sufficiency task form
   ========================================================================== */

const sufficiencySchema = z.object({
  sources: z
    .array(
      z.object({
        sourceKey: z.string().min(1),
        sufficiency: z.enum(["sufficient", "limited"], { message: "Choose sufficient or limited for every source." }),
        note: z.string().max(600),
      }),
    )
    .min(1),
  overall: z.string().max(1200),
});
type SufficiencyInput = z.infer<typeof sufficiencySchema>;

/** The material gaps the preparation found in one source. */
function gapsFor(context: StageContext, sourceKey: string): StagePreparationOutput["gaps"] {
  const output = context.preparation.output;
  if (!output) return [];
  return output.gaps.filter(
    (gap) =>
      gap.severity !== "minor" &&
      (gap.key.endsWith(sourceKey) ||
        recordsOf(context.sources, sourceKey).some((record) => gap.evidenceIds.includes(record.id))),
  );
}

registerTaskForm<SufficiencyInput>("rcsa.evidence-sufficiency", {
  schema: sufficiencySchema,
  fields: (context, language, current) => ({
    rows: context.stage.requiredSources.map((source) => {
      const entry = current?.sources.find((candidate) => candidate.sourceKey === source.key);
      const loaded = context.sources.find((candidate) => candidate.spec.key === source.key);
      const count = loaded?.result.records.length ?? 0;
      const gaps = gapsFor(context, source.key);
      const gapHint = gaps.length > 0 ? ` ${language === "de" ? "KI-Hinweis" : "AI note"}: ${gaps.map((gap) => (language === "de" ? gap.statement.de : gap.statement.en)).join(" ")}` : "";
      return {
        id: source.key,
        label: language === "de" ? source.label.de : source.label.en,
        detail:
          language === "de"
            ? `${count} Datensaetze gelesen.${loaded?.result.note ? ` ${loaded.result.note.de}` : ""}${gapHint}`
            : `${count} record(s) read.${loaded?.result.note ? ` ${loaded.result.note.en}` : ""}${gapHint}`,
        choice: {
          name: `sufficiency:${source.key}`,
          options: [
            { value: "sufficient", label: language === "de" ? "Ausreichend" : "Sufficient" },
            { value: "limited", label: language === "de" ? "Eingeschraenkt" : "Limited" },
          ],
          value: entry?.sufficiency ?? "",
        },
        note: {
          name: `note:${source.key}`,
          value: entry?.note ?? "",
          placeholder: language === "de" ? "Was ist eingeschraenkt, und warum?" : "What is limited, and why?",
        },
        date: null,
      };
    }),
    overall: {
      name: "overall",
      value: current?.overall ?? "",
      label: language === "de" ? "Gesamteinschaetzung (optional)" : "Overall view (optional)",
    },
  }),
  fromFormData: (data, context) => ({
    sources: context.stage.requiredSources.map((source) => ({
      sourceKey: source.key,
      sufficiency: String(data.get(`sufficiency:${source.key}`) ?? ""),
      note: String(data.get(`note:${source.key}`) ?? "").trim(),
    })),
    overall: String(data.get("overall") ?? "").trim(),
  }),
  validate: (context, input) => {
    const problems: Bilingual[] = [];
    for (const required of context.stage.requiredSources) {
      if (!input.sources.some((entry) => entry.sourceKey === required.key)) {
        problems.push({ en: `${required.label.en} has no answer.`, de: `${required.label.de} hat keine Antwort.` });
      }
    }
    for (const entry of input.sources) {
      if (entry.sufficiency === "limited" && entry.note.length < 10) {
        const label = context.stage.requiredSources.find((source) => source.key === entry.sourceKey)?.label;
        problems.push({
          en: `Say why ${label?.en ?? entry.sourceKey} is limited.`,
          de: `Begruenden Sie, warum ${label?.de ?? entry.sourceKey} eingeschraenkt ist.`,
        });
      }
    }
    return problems;
  },
  defaults: (context) => {
    const output = context.preparation.output;
    if (!output) return null;
    return {
      sources: context.stage.requiredSources.map((source) => {
        const gaps = gapsFor(context, source.key);
        return {
          sourceKey: source.key,
          sufficiency: gaps.length > 0 ? ("limited" as const) : ("sufficient" as const),
          note: gaps.map((gap) => gap.statement.en).join(" ").slice(0, 600),
        };
      }),
      overall: "",
    };
  },
  summarise: (context, input) =>
    input.sources.map((entry) => {
      const label = context.stage.requiredSources.find((source) => source.key === entry.sourceKey)?.label ?? { en: entry.sourceKey, de: entry.sourceKey };
      return entry.sufficiency === "sufficient"
        ? { en: `${label.en}: sufficient`, de: `${label.de}: ausreichend` }
        : { en: `${label.en}: limited. ${entry.note}`, de: `${label.de}: eingeschraenkt. ${entry.note}` };
    }),
});

/* ==========================================================================
   The GRC registration of the investigation
   ========================================================================== */

registerPayloadBuilder("rcsa.register-investigation", (context) => {
  const decision = context.decisions.find((state) => state.spec.key === "investigation-strategy");
  if (!decision || decision.status !== "recorded" || !decision.chosenOptionId) {
    return {
      unavailable: {
        en: "Record the investigation strategy before it is registered in the GRC platform.",
        de: "Erfassen Sie die Untersuchungsstrategie, bevor sie im GRC-System registriert wird.",
      },
    };
  }
  const option = decision.options.find((candidate) => candidate.id === decision.chosenOptionId);
  const red = recordsOf(context.sources, "kri-readings").filter((record) => record.facts?.status === "red").map((record) => record.id);
  /* The second option is the three separate first-line explanations. */
  const separate = chosenPosition(decision) === 2;
  const title = separate
    ? `First-line explanations for the indicator breaches: ${red.join(", ")}`
    : `Causal investigation of the indicator breaches: ${red.join(", ")}`;
  const decisionId = boundDecisionId(context, "investigation-strategy", DECISION_ID);

  return {
    payload: {
      decisionId,
      entityId: context.run.subjectId.includes("-AT-") ? "ARC-AT" : "ARC-DE",
      title,
      description: option?.label.en ?? title,
      relatedObjectId: red[0] ?? context.run.subjectId,
      relatedObjectKind: "kri",
      kind: "validation-request",
      dueOn: "2026-10-12",
      ownerLabel: "Payments Operations, first line",
      assessmentId: context.run.subjectId,
    },
    intentStatement: {
      en: `Register "${title}" as an action in the GRC platform, due 12.10.2026, as agreed in ${decisionId}.`,
      de: `"${title}" als Massnahme im GRC-System registrieren, faellig am 12.10.2026, wie in ${decisionId} entschieden.`,
    },
    sourceCanonicalType: "Decision",
    sourceCanonicalId: decisionId,
    decisionId,
  };
});

/* ==========================================================================
   The evidence pack, written at completion
   ========================================================================== */

registerArtifactBuilder("rcsa.evidence-pack", (context) => {
  const sufficiency = recordedTaskOutput(context, "evidence-sufficiency");
  const decision = context.decisions.find((state) => state.spec.key === "investigation-strategy");
  const tool = context.tools.find((state) => state.key === "register-investigation");
  return {
    label: { en: "Evidence pack", de: "Nachweispaket" },
    content: {
      assessmentId: context.run.subjectId,
      sources: context.sources.map((source) => ({
        key: source.spec.key,
        label: source.spec.label,
        necessity: source.necessity,
        status: source.status,
        recordCount: source.result.records.length,
        evidenceIds: source.result.evidenceIds,
      })),
      sufficiency: sufficiency ? { input: sufficiency.input, summary: sufficiency.summary, revision: sufficiency.revision } : null,
      decision: decision
        ? { decisionId: boundDecisionId(context, "investigation-strategy", DECISION_ID), optionId: decision.chosenOptionId, rationale: decision.rationale, decidedBy: decision.decidedByUserId }
        : null,
      investigation: tool ? { commandId: tool.commandId, externalId: tool.externalId, state: tool.state } : null,
      preparation: { artifactId: context.preparation.artifactId, mode: context.preparation.mode, source: context.preparation.source },
    },
  };
});

export const RCSA_EVIDENCE_REFRESH = { processId: PROCESS_ID, stageId: STAGE_ID } as const;
