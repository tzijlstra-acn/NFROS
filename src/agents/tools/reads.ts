/**
 * Read and draft tool handlers.
 *
 * These return data and text. None of them writes, which is why they are
 * separated from the mutation handlers: the split makes it possible to read
 * this file and be confident nothing in it can change a record.
 *
 * Every handler that returns a conclusion also returns the evidence
 * identifiers that support it, so the citation chain is assembled by the tool
 * rather than being something the model is asked to remember.
 */

import {
  getActions,
  getAllEvidenceDocuments,
  getApplicablePolicies,
  getAssessments,
  getBackgroundWork,
  getBreachedKris,
  getCalendar,
  getContractObligations,
  getContracts,
  getControl,
  getControlTest,
  getControlTests,
  getDecisions,
  getEntity,
  getEvidenceDocument,
  getImpactTolerances,
  getIncident,
  getIncidentTimeline,
  getKriReadings,
  getKris,
  getMeetings,
  getPopulationSummary,
  getRiskControlGraph,
  getRole,
  getServiceDependencies,
  getSupplierExposure,
  getUser,
  compareAssessments as compareAssessmentVersions,
  getInbox,
  getPortfolioThemes,
  getDecisionThread,
} from "@/db/repositories/workday";
import { getAuditTrail, getAuditTrailForObject } from "@/server/security/audit";
import { searchEvidence } from "@/server/retrieval/search";
import {
  calculateRiskMatrixPosition,
  calculateToleranceRemaining,
  type ControlEffectiveness,
} from "@/domain/nfr/calculators";
import { registerToolHandler, type ToolContext, type ToolHandlerResult } from "./runtime";

function str(payload: Record<string, unknown>, key: string, fallback = ""): string {
  const value = payload[key];
  return typeof value === "string" ? value : fallback;
}

function requireStr(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The tool requires a "${key}" value.`);
  }
  return value;
}

/* ==========================================================================
   Role and work context
   ========================================================================== */

registerToolHandler("getRoleContext", (_payload, context): ToolHandlerResult => {
  const role = getRole(context.roleId, context.runId);
  if (!role) throw new Error(`Role ${context.roleId} was not found.`);
  const holder = getUser(role.holderUserId, context.runId);
  const entity = getEntity(role.entityId, context.runId);

  return {
    summary: `Role context returned for ${role.title} at ${entity?.shortName ?? role.entityId}.`,
    objectKind: "role",
    objectId: role.id,
    data: {
      roleId: role.id,
      title: role.title,
      mandate: role.mandate,
      holder: holder?.name,
      holderJobTitle: holder?.jobTitle,
      entity: entity?.name,
      jurisdiction: entity?.jurisdiction,
      regulatoryBloc: entity?.regulatoryBloc,
      supervisoryContext: entity?.supervisoryContext,
      humanOwnedDecisions: role.humanOwnedDecisions,
      primaryObjects: role.primaryObjects,
      autonomyLevel: context.autonomyLevel,
      atMoment: context.atMoment,
    },
  };
});

registerToolHandler("getDailyBrief", (_payload, context): ToolHandlerResult => {
  const entries = getDecisions(context.roleId, context.atMoment, context.runId);
  const open = entries.filter((entry) => entry.decision.status === "open");
  const background = getBackgroundWork(context.roleId, context.atMoment, context.runId);
  const breached = getBreachedKris(context.runId);
  const overdue = getActions({ roleId: context.roleId, status: "overdue" }, context.runId);

  const evidenceIds = Array.from(
    new Set(open.flatMap((entry) => entry.decision.supportingEvidenceIds)),
  );

  return {
    summary: `Daily brief assembled: ${open.length} open decision(s) at ${context.atMoment}.`,
    objectKind: "brief",
    objectId: `${context.roleId}-${context.atMoment}`,
    evidenceIds,
    data: {
      atMoment: context.atMoment,
      openDecisions: open.map((entry) => ({
        decisionId: entry.decision.id,
        title: entry.decision.title,
        question: entry.decision.question,
        judgmentKind: entry.decision.judgmentKind,
        priorityRank: entry.decision.priorityRank,
        whyThisMatters: entry.decision.whyThisMatters,
        preparedPosition: entry.decision.preparedPosition,
        uncertaintyNote: entry.decision.uncertaintyNote,
        confidence: entry.decision.confidence,
        requiredAuthority: entry.decision.requiredAuthority,
        supportingEvidenceIds: entry.decision.supportingEvidenceIds,
        opposingEvidenceIds: entry.decision.opposingEvidenceIds,
        optionCount: entry.options.length,
      })),
      backgroundWork: {
        systemsChecked: background.systemsChecked,
        recordsReconciled: background.recordsReconciled,
        documentsClassified: background.documentsClassified,
        itemsRequested: background.itemsRequested,
        contradictionsIdentified: background.contradictionsIdentified,
        routineUpdates: background.routineUpdates,
        escalatedToHuman: background.escalatedToHuman,
      },
      indicatorsOutsideTolerance: breached.map((kri) => ({
        id: kri.id,
        reference: kri.reference,
        name: kri.name,
        currentValue: kri.currentValue,
        status: kri.currentStatus,
        redThreshold: kri.redThreshold,
      })),
      overdueActions: overdue.map((action) => ({
        id: action.id,
        title: action.title,
        dueOn: action.dueOn,
        ownerUserId: action.ownerUserId,
      })),
    },
  };
});

registerToolHandler("readInbox", (payload, context): ToolHandlerResult => {
  const messages = getInbox(context.roleId, context.atMoment, context.runId);
  const channel = str(payload, "channel");
  const filtered = channel ? messages.filter((m) => m.channel === channel) : messages;

  return {
    summary: `${filtered.length} message(s) visible at ${context.atMoment}, of which ${filtered.filter((m) => m.isDuplicateOf !== null).length} duplicate an earlier request.`,
    objectKind: "inbox",
    objectId: context.roleId,
    data: filtered.map((message) => ({
      id: message.id,
      channel: message.channel,
      from: message.fromLabel,
      subject: message.subject,
      receivedAt: message.receivedAt,
      proposedTriage: message.proposedTriage,
      triageRationale: message.triageRationale,
      triageConfidence: message.triageConfidence,
      confirmedTriage: message.confirmedTriage,
      isDuplicateOf: message.isDuplicateOf,
      relatedObjectId: message.relatedObjectId,
      fromSharedEvent: message.fromSharedEvent,
      requiresResponseBy: message.requiresResponseBy,
    })),
  };
});

registerToolHandler("getCalendar", (_payload, context): ToolHandlerResult => {
  const entries = getCalendar(context.roleId, context.runId);
  const conflicts = entries.filter((entry) => entry.hasConflict);
  return {
    summary: `${entries.length} calendar entr${entries.length === 1 ? "y" : "ies"} today, with ${conflicts.length} in conflict.`,
    objectKind: "calendar",
    objectId: context.roleId,
    data: entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      kind: entry.kind,
      hasConflict: entry.hasConflict,
      conflictWithId: entry.conflictWithId,
      meetingId: entry.meetingId,
      preparationStatus: entry.preparationStatus,
      attendeeUserIds: entry.attendeeUserIds,
    })),
  };
});

registerToolHandler("getUpcomingMeetings", (_payload, context): ToolHandlerResult => {
  const meetings = getMeetings(context.roleId, context.runId);
  return {
    summary: `${meetings.length} meeting(s) for this role today.`,
    objectKind: "meetings",
    objectId: context.roleId,
    evidenceIds: meetings.flatMap((meeting) => meeting.evidenceDocumentIds),
    data: meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      kind: meeting.kind,
      momentLabel: meeting.momentLabel,
      objective: meeting.objective,
      participantUserIds: meeting.participantUserIds,
      preparationSummary: meeting.preparationSummary,
      preparedQuestions: meeting.preparedQuestions,
      status: meeting.status,
      supportsVoice: meeting.supportsVoice,
      subjectKind: meeting.subjectKind,
      subjectId: meeting.subjectId,
      evidenceDocumentIds: meeting.evidenceDocumentIds,
    })),
  };
});

registerToolHandler("getOpenDecisions", (_payload, context): ToolHandlerResult => {
  const entries = getDecisions(context.roleId, context.atMoment, context.runId).filter(
    (entry) => entry.decision.status === "open",
  );
  return {
    summary: `${entries.length} open decision(s) awaiting this role's judgment.`,
    objectKind: "decisions",
    objectId: context.roleId,
    data: entries.map((entry) => ({
      decisionId: entry.decision.id,
      title: entry.decision.title,
      question: entry.decision.question,
      judgmentKind: entry.decision.judgmentKind,
      requiredAuthority: entry.decision.requiredAuthority,
      options: entry.options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        isRecommended: option.isRecommended,
        riskImplication: option.riskImplication,
        consequenceCount: option.consequences.length,
      })),
    })),
  };
});

registerToolHandler("getBackgroundWork", (_payload, context): ToolHandlerResult => {
  const background = getBackgroundWork(context.roleId, context.atMoment, context.runId);
  return {
    summary: `${background.total} background action(s) recorded for this role by ${context.atMoment}.`,
    objectKind: "background-work",
    objectId: context.roleId,
    data: background,
  };
});

/* ==========================================================================
   Evidence
   ========================================================================== */

registerToolHandler("searchEvidence", async (payload, context): Promise<ToolHandlerResult> => {
  const query = requireStr(payload, "query");
  const limit = typeof payload.limit === "number" ? payload.limit : 8;
  const sourceTypes = Array.isArray(payload.sourceTypes) ? (payload.sourceTypes as string[]) : undefined;

  const hits = await searchEvidence(query, {
    atMoment: context.atMoment,
    limit,
    runId: context.runId,
    ...(sourceTypes ? { sourceTypes } : {}),
  });

  return {
    summary:
      hits.length === 0
        ? `No evidence in the corpus matched "${query}". The corpus does not contain enough to answer this.`
        : `${hits.length} evidence chunk(s) retrieved for "${query}".`,
    objectKind: "evidence-search",
    objectId: query.slice(0, 40),
    evidenceIds: Array.from(new Set(hits.map((hit) => hit.documentId))),
    data: hits.map((hit) => ({
      evidenceId: hit.documentId,
      reference: hit.documentReference,
      title: hit.documentTitle,
      locator: hit.locator,
      excerpt: hit.content.slice(0, 700),
      sourceType: hit.sourceType,
      sourceSystem: hit.sourceSystem,
      documentDate: hit.documentDate,
      status: hit.status,
      provenance: hit.provenance,
      isStale: hit.isStale,
      entityIds: hit.entityIds,
      score: Number(hit.score.toFixed(4)),
      lexicalScore: Number(hit.lexicalScore.toFixed(4)),
      semanticScore: hit.semanticScore === null ? null : Number(hit.semanticScore.toFixed(4)),
    })),
  };
});

registerToolHandler("getEvidenceItem", (payload, context): ToolHandlerResult => {
  const id = requireStr(payload, "evidenceId");
  const document = getEvidenceDocument(id, context.runId);
  if (!document) {
    return {
      summary: `Evidence document ${id} is not in the corpus.`,
      objectKind: "evidence",
      objectId: id,
      data: { found: false },
    };
  }

  return {
    summary: `Evidence ${document.reference} returned with full provenance. Status ${document.status}${document.isStale ? ", stale" : ""}.`,
    objectKind: "evidence",
    objectId: id,
    evidenceIds: [id],
    data: {
      found: true,
      id: document.id,
      reference: document.reference,
      title: document.title,
      sourceType: document.sourceType,
      sourceSystem: document.sourceSystem,
      authorLabel: document.authorLabel,
      documentDate: document.documentDate,
      ingestedAt: document.ingestedAt,
      entityIds: document.entityIds,
      dataClassification: document.dataClassification,
      status: document.status,
      requestedFromLabel: document.requestedFromLabel,
      requestedOn: document.requestedOn,
      isStale: document.isStale,
      stalenessNote: document.stalenessNote,
      provenance: document.provenance,
      summary: document.summary,
      body: document.body,
      relatedObjectIds: document.relatedObjectIds,
      pageCount: document.pageCount,
    },
  };
});

registerToolHandler("getApplicablePolicy", (_payload, context): ToolHandlerResult => {
  const policies = getApplicablePolicies(context.roleId, context.runId);
  return {
    summary: `${policies.length} policy section(s) apply to this role.`,
    objectKind: "policy",
    objectId: context.roleId,
    data: policies.map((policy) => ({
      id: policy.id,
      reference: policy.reference,
      section: policy.section,
      sectionTitle: policy.sectionTitle,
      scope: policy.scope,
      version: policy.version,
      body: policy.body,
      controlIds: policy.controlIds,
    })),
  };
});

/* ==========================================================================
   Assessments and the risk graph
   ========================================================================== */

registerToolHandler("getAssessmentHistory", (payload, context): ToolHandlerResult => {
  const subjectId = requireStr(payload, "subjectId");
  const versions = getAssessments({ subjectId }, context.runId);
  return {
    summary: `${versions.length} assessment version(s) exist for ${subjectId}.`,
    objectKind: "assessment",
    objectId: subjectId,
    data: versions.map((version) => ({
      id: version.id,
      reference: version.reference,
      version: version.version,
      status: version.status,
      cycle: version.cycle,
      residualRisk: version.residualRisk,
      overallConclusion: version.overallConclusion,
      rationale: version.rationale,
      performedByUserId: version.performedByUserId,
      approvedByUserId: version.approvedByUserId,
      performedOn: version.performedOn,
      supersededBy: version.supersededBy,
      createdBySession: version.createdBySession,
    })),
  };
});

registerToolHandler("compareAssessments", (payload, context): ToolHandlerResult => {
  const subjectId = requireStr(payload, "subjectId");
  const comparison = compareAssessmentVersions(subjectId, context.runId);
  if (!comparison) {
    return {
      summary: `No assessment exists for ${subjectId}.`,
      objectKind: "assessment",
      objectId: subjectId,
      data: { found: false },
    };
  }

  const changed = comparison.currentLines.filter((line) => line.changeFromPrevious.length > 0);

  return {
    summary:
      comparison.previous === null
        ? `${subjectId} has only one assessment version, so there is nothing to compare.`
        : `Comparing version ${comparison.previous.version} with version ${comparison.current.version}: ${changed.length} line(s) changed.`,
    objectKind: "assessment",
    objectId: subjectId,
    data: {
      found: true,
      current: {
        id: comparison.current.id,
        version: comparison.current.version,
        residualRisk: comparison.current.residualRisk,
        conclusion: comparison.current.overallConclusion,
        lines: comparison.currentLines,
      },
      previous: comparison.previous
        ? {
            id: comparison.previous.id,
            version: comparison.previous.version,
            residualRisk: comparison.previous.residualRisk,
            conclusion: comparison.previous.overallConclusion,
            lines: comparison.previousLines,
          }
        : null,
      changedLines: changed.map((line) => ({
        id: line.id,
        riskId: line.riskId,
        controlIds: line.controlIds,
        controlEffectiveness: line.controlEffectiveness,
        residualRating: line.residualRating,
        changeFromPrevious: line.changeFromPrevious,
      })),
    },
  };
});

registerToolHandler("getRiskControlGraph", (payload, context): ToolHandlerResult => {
  const processId = str(payload, "processId");
  const riskId = str(payload, "riskId");
  const graph = getRiskControlGraph(
    { ...(processId ? { processId } : {}), ...(riskId ? { riskId } : {}) },
    context.runId,
  );

  // The divergence between first and second line is the thing worth naming.
  const divergent = graph.controls.filter(
    (control) => control.firstLineEffectiveness !== control.currentEffectiveness,
  );

  return {
    summary: `Graph returned with ${graph.nodes.length} node(s) and ${graph.edges.length} edge(s). ${divergent.length} control(s) show a first line and second line divergence.`,
    objectKind: "risk-control-graph",
    objectId: processId || riskId || "all",
    data: {
      nodes: graph.nodes,
      edges: graph.edges,
      divergentControls: divergent.map((control) => ({
        id: control.id,
        reference: control.reference,
        title: control.title,
        firstLineEffectiveness: control.firstLineEffectiveness,
        recordedEffectiveness: control.currentEffectiveness,
        ownerUserId: control.ownerUserId,
        lastTestedOn: control.lastTestedOn,
      })),
    },
  };
});

registerToolHandler("getKriHistory", (payload, context): ToolHandlerResult => {
  const kriId = str(payload, "kriId");
  const allKris = getKris(context.runId);
  const targets = kriId ? allKris.filter((kri) => kri.id === kriId) : allKris;

  return {
    summary: `Indicator history returned for ${targets.length} indicator(s).`,
    objectKind: "kri",
    objectId: kriId || "all",
    data: targets.map((kri) => ({
      id: kri.id,
      reference: kri.reference,
      name: kri.name,
      unit: kri.unit,
      adverseDirection: kri.adverseDirection,
      amberThreshold: kri.amberThreshold,
      redThreshold: kri.redThreshold,
      currentValue: kri.currentValue,
      currentStatus: kri.currentStatus,
      definition: kri.definition,
      readings: getKriReadings(kri.id, context.runId).map((reading) => ({
        period: reading.period,
        value: reading.value,
        status: reading.status,
        commentary: reading.commentary,
      })),
    })),
  };
});

/* ==========================================================================
   Control testing
   ========================================================================== */

registerToolHandler("getControlTestResults", (payload, context): ToolHandlerResult => {
  const testId = str(payload, "controlTestId");
  if (!testId) {
    const tests = getControlTests(context.runId);
    return {
      summary: `${tests.length} control test(s) in scope.`,
      objectKind: "control-test",
      objectId: "all",
      data: tests.map((test) => ({
        id: test.id,
        reference: test.reference,
        controlId: test.controlId,
        title: test.title,
        status: test.status,
        exceptionCount: test.exceptionCount,
        populationSize: test.populationSize,
        sampleSize: test.sampleSize,
        assuranceConclusion: test.assuranceConclusion,
      })),
    };
  }

  const test = getControlTest(testId, context.runId);
  if (!test) throw new Error(`Control test ${testId} was not found.`);
  const population = getPopulationSummary(testId, context.runId);

  return {
    summary: `Test ${test.reference}: population ${population.total}, sample ${population.sampled}, exceptions ${population.exceptions}, items without review evidence ${population.missingReviewEvidence}.`,
    objectKind: "control-test",
    objectId: testId,
    evidenceIds: Array.from(
      new Set(population.exceptionCases.flatMap((testCase) => testCase.evidenceDocumentIds)),
    ),
    data: {
      test: {
        id: test.id,
        reference: test.reference,
        controlId: test.controlId,
        title: test.title,
        testType: test.testType,
        testerUserId: test.testerUserId,
        periodFrom: test.periodFrom,
        periodTo: test.periodTo,
        samplingMethod: test.samplingMethod,
        samplingRationale: test.samplingRationale,
        testProcedure: test.testProcedure,
        status: test.status,
        preliminaryConclusion: test.preliminaryConclusion,
        assuranceConclusion: test.assuranceConclusion,
        managementResponse: test.managementResponse,
        managementResponseBy: test.managementResponseBy,
      },
      populationSummary: {
        total: population.total,
        sampled: population.sampled,
        conforming: population.conforming,
        anomalies: population.anomalies,
        exceptions: population.exceptions,
        missingReviewEvidence: population.missingReviewEvidence,
        unclassifiedExceptions: population.unclassifiedExceptions,
        byRepairReason: population.byRepairReason,
        byReviewer: population.byReviewer,
      },
      exceptions: population.exceptionCases.map((testCase) => ({
        id: testCase.id,
        transactionRef: testCase.transactionRef,
        occurredAt: testCase.occurredAt,
        amountMinor: testCase.amountMinor,
        currency: testCase.currency,
        repairReason: testCase.repairReason,
        repairedByUserId: testCase.repairedByUserId,
        reviewerUserId: testCase.reviewerUserId,
        secondaryReviewEvidenced: testCase.secondaryReviewEvidenced,
        anomalyKind: testCase.anomalyKind,
        note: testCase.note,
        exceptionClassification: testCase.exceptionClassification,
        exceptionScope: testCase.exceptionScope,
        evidenceDocumentIds: testCase.evidenceDocumentIds,
      })),
    },
  };
});

/* ==========================================================================
   Third party
   ========================================================================== */

registerToolHandler("getSupplierExposure", (payload, context): ToolHandlerResult => {
  const supplierId = requireStr(payload, "supplierId");
  const exposure = getSupplierExposure(supplierId, context.runId);
  if (!exposure) throw new Error(`Supplier ${supplierId} was not found.`);

  return {
    summary: `${exposure.supplier.name}: ${exposure.services.length} service(s), ${exposure.subprocessors.length} subprocessor(s), ${exposure.evidenceGaps.length} obligation(s) without sufficient evidence, ${exposure.discrepancies.length} subprocessor discrepanc${exposure.discrepancies.length === 1 ? "y" : "ies"}.`,
    objectKind: "supplier",
    objectId: supplierId,
    evidenceIds: Array.from(
      new Set(exposure.obligations.flatMap((obligation) => obligation.evidenceDocumentIds)),
    ),
    data: {
      supplier: exposure.supplier,
      services: exposure.services,
      subprocessors: exposure.subprocessors,
      contracts: exposure.contracts,
      obligations: exposure.obligations,
      dependencies: exposure.dependencies,
      evidenceGaps: exposure.evidenceGaps,
      discrepancies: exposure.discrepancies,
    },
  };
});

registerToolHandler("getSupplierAssessment", (payload, context): ToolHandlerResult => {
  const supplierId = requireStr(payload, "supplierId");
  const versions = getAssessments({ subjectId: supplierId, kind: "supplier" }, context.runId);
  return {
    summary: `${versions.length} supplier assessment version(s) for ${supplierId}.`,
    objectKind: "assessment",
    objectId: supplierId,
    data: versions,
  };
});

registerToolHandler("compareSupplierSubmissions", (payload, context): ToolHandlerResult => {
  const supplierId = requireStr(payload, "supplierId");
  const exposure = getSupplierExposure(supplierId, context.runId);
  if (!exposure) throw new Error(`Supplier ${supplierId} was not found.`);

  const appendixOnly = exposure.subprocessors.filter((s) => s.declaredIn === "contract-appendix");
  const submissionOnly = exposure.subprocessors.filter((s) => s.declaredIn === "supplier-submission");
  const both = exposure.subprocessors.filter((s) => s.declaredIn === "both");

  return {
    summary: `Subprocessor comparison for ${exposure.supplier.name}: ${both.length} in both records, ${appendixOnly.length} only in the contract appendix, ${submissionOnly.length} only in the current submission.`,
    objectKind: "supplier",
    objectId: supplierId,
    data: {
      inBoth: both,
      onlyInContractAppendix: appendixOnly,
      onlyInSupplierSubmission: submissionOnly,
      discrepancies: exposure.discrepancies.map((s) => ({
        id: s.id,
        name: s.name,
        domicile: s.domicile,
        functionProvided: s.functionProvided,
        declaredIn: s.declaredIn,
        discrepancyNote: s.discrepancyNote,
        supportsCriticalFunction: s.supportsCriticalFunction,
      })),
    },
  };
});

registerToolHandler("getContractObligations", (payload, context): ToolHandlerResult => {
  const supplierId = requireStr(payload, "supplierId");
  const contractRows = getContracts(supplierId, context.runId);
  const obligationRows = getContractObligations(
    contractRows.map((c) => c.id),
    context.runId,
  );

  const notEvidenced = obligationRows.filter((o) => o.evidenceStatus === "not-evidenced");

  return {
    summary: `${obligationRows.length} contractual obligation(s) across ${contractRows.length} contract document(s). ${notEvidenced.length} are not evidenced.`,
    objectKind: "contract",
    objectId: supplierId,
    evidenceIds: Array.from(new Set(obligationRows.flatMap((o) => o.evidenceDocumentIds))),
    data: { contracts: contractRows, obligations: obligationRows },
  };
});

/* ==========================================================================
   Incidents and resilience
   ========================================================================== */

registerToolHandler("getIncidentTimeline", (payload, context): ToolHandlerResult => {
  const incidentId = requireStr(payload, "incidentId");
  const incident = getIncident(incidentId, context.runId);
  if (!incident) throw new Error(`Incident ${incidentId} was not found.`);

  const chronology = getIncidentTimeline(incidentId, context.atMoment, context.runId);
  const conflicts = chronology.filter((entry) => entry.conflictsWithId !== null);
  const unresolved = conflicts.filter((entry) => entry.conflictResolution.length === 0);

  return {
    summary: `${chronology.length} chronology entr${chronology.length === 1 ? "y" : "ies"} visible at ${context.atMoment}. ${conflicts.length} conflict(s), of which ${unresolved.length} remain unresolved.`,
    objectKind: "incident",
    objectId: incidentId,
    evidenceIds: Array.from(new Set(chronology.flatMap((entry) => entry.evidenceDocumentIds))),
    data: {
      incident: {
        id: incident.id,
        reference: incident.reference,
        title: incident.title,
        kind: incident.kind,
        status: incident.status,
        severity: incident.severity,
        proposedSeverity: incident.proposedSeverity,
        detectedAt: incident.detectedAt,
        description: incident.description,
        serviceIds: incident.serviceIds,
        supplierIds: incident.supplierIds,
        entityIds: incident.entityIds,
        notificationRecommended: incident.notificationRecommended,
      },
      chronology: chronology.map((entry) => ({
        id: entry.id,
        atMoment: entry.atMoment,
        channel: entry.channel,
        sourceLabel: entry.sourceLabel,
        provenance: entry.provenance,
        statement: entry.statement,
        confidence: entry.confidence,
        conflictsWithId: entry.conflictsWithId,
        conflictResolution: entry.conflictResolution,
        evidenceDocumentIds: entry.evidenceDocumentIds,
      })),
    },
  };
});

registerToolHandler("getServiceDependencies", (_payload, context): ToolHandlerResult => {
  const dependencies = getServiceDependencies(context.runId);
  const affected = dependencies.filter((edge) => edge.affectedByEvent);
  const spof = dependencies.filter((edge) => edge.singlePointOfFailure);

  return {
    summary: `${dependencies.length} dependency edge(s). ${affected.length} are affected by the shared event and ${spof.length} are single points of failure.`,
    objectKind: "service-dependency",
    objectId: "all",
    data: { dependencies, affected, singlePointsOfFailure: spof },
  };
});

/* ==========================================================================
   Deterministic calculators
   ========================================================================== */

registerToolHandler("calculateRiskMatrixPosition", (payload): ToolHandlerResult => {
  const position = calculateRiskMatrixPosition({
    inherentLikelihood: Number(payload.inherentLikelihood ?? 3),
    inherentImpact: Number(payload.inherentImpact ?? 3),
    controlEffectiveness: (payload.controlEffectiveness as ControlEffectiveness) ?? "not-assessed",
  });

  return {
    summary: `Residual position computed as ${position.residualRating} at likelihood ${position.residualLikelihood} and impact ${position.residualImpact}. ${position.methodologyNote}`,
    objectKind: "calculation",
    objectId: "risk-matrix",
    data: position,
  };
});

registerToolHandler("calculateToleranceRemaining", (payload, context): ToolHandlerResult => {
  const serviceId = requireStr(payload, "serviceId");
  const tolerances = getImpactTolerances(context.runId).filter((t) => t.serviceId === serviceId);

  const results = tolerances.map((tolerance) =>
    calculateToleranceRemaining({
      serviceId: tolerance.serviceId,
      metric: tolerance.metric,
      thresholdMinutes: tolerance.thresholdMinutes ?? 0,
      consumedMinutes:
        typeof payload.consumedMinutes === "number"
          ? payload.consumedMinutes
          : tolerance.consumedMinutes,
      statement: tolerance.statement,
    }),
  );

  const worst = results.reduce<(typeof results)[number] | null>((acc, item) => {
    if (!acc) return item;
    return item.consumedFraction > acc.consumedFraction ? item : acc;
  }, null);

  return {
    summary: worst
      ? `Tightest tolerance on ${serviceId}: ${worst.metric}, ${worst.remainingMinutes} minute(s) remaining, state ${worst.state}. Whether this constitutes a breach is a human determination.`
      : `No impact tolerance is recorded for ${serviceId}.`,
    objectKind: "calculation",
    objectId: serviceId,
    data: { tolerances: results },
  };
});

/* ==========================================================================
   Audit and portfolio
   ========================================================================== */

registerToolHandler("getAuditTrail", (payload, context): ToolHandlerResult => {
  const objectKind = str(payload, "objectKind");
  const objectId = str(payload, "objectId");

  const events =
    objectKind && objectId
      ? getAuditTrailForObject(context.runId, objectKind, objectId)
      : getAuditTrail(context.runId, 100);

  return {
    summary: `${events.length} audit event(s) returned, of which ${events.filter((e) => e.blocked).length} record a refused action.`,
    objectKind: "audit",
    objectId: objectId || "session",
    data: events.map((event) => ({
      id: event.id,
      atMoment: event.atMoment,
      category: event.category,
      action: event.action,
      summary: event.summary,
      actorKind: event.actorKind,
      actorUserId: event.actorUserId,
      blocked: event.blocked,
      blockedReason: event.blockedReason,
      reversible: event.reversible,
      authorityClass: event.authorityClass,
    })),
  };
});

registerToolHandler("getPortfolioThread", (payload, context): ToolHandlerResult => {
  const threadId = str(payload, "sharedThreadId");
  const themes = getPortfolioThemes(context.runId);

  if (!threadId) {
    return {
      summary: `${themes.length} cross function theme(s) in the portfolio.`,
      objectKind: "portfolio",
      objectId: "all",
      data: themes,
    };
  }

  const decisions = getDecisionThread(threadId, context.runId);
  const byRole = new Map<string, typeof decisions>();
  for (const decision of decisions) {
    const list = byRole.get(decision.roleId) ?? [];
    list.push(decision);
    byRole.set(decision.roleId, list);
  }

  return {
    summary: `Thread ${threadId} spans ${byRole.size} function(s) across ${decisions.length} decision(s).`,
    objectKind: "portfolio-thread",
    objectId: threadId,
    data: {
      threadId,
      lenses: Array.from(byRole.entries()).map(([roleId, roleDecisions]) => {
        const role = getRole(roleId as never, context.runId);
        return {
          roleId,
          roleTitle: role?.title ?? roleId,
          professionalQuestion: roleDecisions[0]?.question ?? "",
          decisionIds: roleDecisions.map((d) => d.id),
          statuses: roleDecisions.map((d) => d.status),
          confidence:
            roleDecisions.reduce((sum, d) => sum + d.confidence, 0) / (roleDecisions.length || 1),
          sourceIds: Array.from(
            new Set(roleDecisions.flatMap((d) => d.supportingEvidenceIds)),
          ),
        };
      }),
      themes: themes.filter((theme) => theme.decisionIds.some((id) => decisions.some((d) => d.id === id))),
    },
  };
});

/** Ensures the module's registrations have run. */
export const readHandlersRegistered = true;
