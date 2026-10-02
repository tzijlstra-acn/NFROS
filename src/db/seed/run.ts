/**
 * Seed and reset implementation.
 *
 * One function writes the entire day, and `demo:reset` calls the same function.
 * That is deliberate: if reset used a different code path from seed, the two
 * would drift and "reset restores the original day" would slowly stop being
 * true without anyone noticing.
 *
 * Deterministic. No random values, no wall clock dependence in the content, so
 * two seeds of the same build produce identical rows.
 */

import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "@/db/client";
import {
  DEFAULT_RUN_ID,
  auditEvents,
  legalEntities,
  roles,
  scenarioRuns,
  timelineEvents,
  timelineRoleMoments,
} from "@/db/schema/core";
import { users } from "@/db/schema/core";
import {
  contractObligations,
  contracts,
  controls,
  impactTolerances,
  kriReadings,
  kris,
  processes,
  risks,
  serviceDependencies,
  services,
  subprocessors,
  suppliers,
} from "@/db/schema/domain";
import {
  assessmentLines,
  assessments,
  controlTests,
  incidentEvents,
  incidents,
  obligations,
  policies,
  recoveryOptions,
  regulatoryPublications,
  testCases,
} from "@/db/schema/practice";
import {
  calendarEvents,
  collaborationMessages,
  evidenceChunks,
  evidenceDocuments,
  inboxMessages,
  meetingMessages,
  meetings,
} from "@/db/schema/work";
import {
  actions,
  agentMessages,
  agentRuns,
  agentSessions,
  approvals,
  backgroundActions,
  cachedAiOutputs,
  committeeItems,
  decisionOptions,
  decisions,
  executionReceiptLines,
  issues,
  monitoringActivations,
  portfolioThemes,
  toolCalls,
} from "@/db/schema/decisions";

import * as institution from "@/scenario/data/institution";
import * as thirdParty from "@/scenario/data/third-party";
import {
  tprmOnboardingSuppliers,
  tprmOnboardingServices,
  tprmOnboardingContracts,
  tprmOnboardingContractObligations,
  tprmOnboardingEvidenceDocuments,
} from "@/db/seed/tprm-onboarding";
import * as risk from "@/scenario/data/risk";
import * as assurance from "@/scenario/data/assurance";
import * as eventData from "@/scenario/data/event";
import * as evidence from "@/scenario/data/evidence";
import { generatedEvidenceDocuments } from "@/scenario/data/evidence-generated";
import * as work from "@/scenario/data/work";
import * as decisionData from "@/scenario/data/decisions";
import * as timelineMoments from "@/scenario/data/timeline-moments";
import { SCENARIO_DATE } from "@/scenario/data/contract";

/*
 * The four layers that sit on top of the scenario.
 *
 * Every one of them READS the seeded day rather than inventing a parallel
 * dataset: the integration simulators project real controls, suppliers and
 * evidence; the live event projection derives each row from a seeded moment,
 * background action, message, meeting or decision; the AI Partner seed grounds
 * its suggestions in real identifiers.
 *
 * Where each one runs is not interchangeable.
 *
 * `seedIntegrations` goes INSIDE the scenario transaction, last. It uses the
 * same database handle and therefore joins this transaction, and its source
 * requirement map is derived from the seeded decisions, so it has to run after
 * them.
 *
 * The other three go AFTER the transaction commits, because each opens its own
 * transaction over the rows this one writes. Nesting them would mean a failure
 * in the last rolls back the first for no reason.
 *
 * Their order matters too: a live event may be produced by an inbound
 * integration event, and a suggestion is attached to a live event.
 */
import { seedProductConfiguration } from "@/product/seed";
import { seedIntegrations } from "@/integrations/seed";
import { seedLiveEvents } from "@/scenario/live-event-seed";
import { seedAiPartner } from "@/agents/suggestions/seed";

export interface SeedSummary {
  rowsWritten: number;
  tablesWritten: number;
  counts: Record<string, number>;
}

/**
 * Tables cleared before a reseed, in an order that respects dependencies.
 *
 * Session artefacts are included: a reset must remove the decisions, approvals
 * and audit events created during a demonstration, or the next run starts with
 * yesterday's conclusions already on the record.
 */
const RUN_SCOPED_TABLES = [
  "execution_receipt_lines", "approvals", "tool_calls", "agent_messages", "agent_runs",
  "agent_sessions", "cached_ai_outputs", "monitoring_activations", "background_actions",
  "portfolio_themes", "committee_items", "decision_options", "decisions", "actions", "issues",
  "evidence_chunks", "evidence_documents", "collaboration_messages", "meeting_messages",
  "meetings", "calendar_events", "inbox_messages",
  "obligations", "regulatory_publications", "recovery_options", "incident_events", "incidents",
  "test_cases", "control_tests", "assessment_lines", "assessments", "policies",
  "kri_readings", "kris", "controls", "risks", "processes",
  "contract_obligations", "contracts", "impact_tolerances", "service_dependencies", "services",
  "subprocessors", "suppliers",
  "timeline_role_moments", "timeline_events", "roles", "users", "legal_entities",
  "audit_events",
] as const;

function clearRun(runId: string): void {
  const sqlite = getSqlite();

  // Deleted in dependency order, most dependent first.
  for (const table of RUN_SCOPED_TABLES) {
    sqlite.prepare(`delete from ${table} where run_id = ?`).run(runId);
  }

  // The run row keys on `id` rather than `run_id`, so it is handled separately.
  getDb().delete(scenarioRuns).where(eq(scenarioRuns.id, runId)).run();
}

/**
 * Splits a document body into retrieval chunks.
 *
 * Chunking is paragraph aware rather than a fixed character window, because a
 * citation that straddles two paragraphs is much harder for a reader to verify
 * against the source than one that lines up with a section.
 */
function chunkDocument(
  documentId: string,
  runId: string,
  body: string,
): Array<typeof evidenceChunks.$inferInsert> {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: Array<typeof evidenceChunks.$inferInsert> = [];
  const targetSize = 900;
  let buffer: string[] = [];
  let bufferLength = 0;
  let index = 0;

  const flush = (): void => {
    if (buffer.length === 0) return;
    const content = buffer.join("\n\n");
    chunks.push({
      id: `${documentId}-C${String(index).padStart(2, "0")}`,
      runId,
      documentId,
      chunkIndex: index,
      locator: `Section ${index + 1}`,
      content,
      embedding: null,
      embeddingModel: null,
      embeddedAt: null,
      // A rough token estimate is enough for a context budget, and avoids
      // pulling a tokeniser into the seed path.
      tokenEstimate: Math.ceil(content.length / 4),
    });
    index += 1;
    buffer = [];
    bufferLength = 0;
  };

  for (const paragraph of paragraphs) {
    if (bufferLength > 0 && bufferLength + paragraph.length > targetSize) flush();
    buffer.push(paragraph);
    bufferLength += paragraph.length;
  }
  flush();

  if (chunks.length === 0) {
    chunks.push({
      id: `${documentId}-C00`,
      runId,
      documentId,
      chunkIndex: 0,
      locator: "Section 1",
      content: body.trim().length > 0 ? body.trim() : "This document has no retrievable body text.",
      embedding: null,
      embeddingModel: null,
      embeddedAt: null,
      tokenEstimate: Math.ceil(body.length / 4),
    });
  }

  return chunks;
}

type AnyTable = Parameters<ReturnType<typeof getDb>["insert"]>[0];

/**
 * Inserts rows in batches.
 *
 * SQLite has a bound parameter limit per statement, and some of these tables
 * are wide enough that a hundred rows is already close to it.
 */
function insertAll(
  table: AnyTable,
  rows: readonly Record<string, unknown>[],
  counts: Record<string, number>,
  label: string,
): number {
  counts[label] = rows.length;
  if (rows.length === 0) return 0;

  const db = getDb();
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    db.insert(table)
      .values(rows.slice(i, i + batchSize) as never)
      .run();
  }
  return rows.length;
}

/**
 * Writes the full seeded day.
 *
 * Wrapped in a single transaction so a failure part way through leaves the
 * database as it was rather than half a scenario, which would be worse than no
 * scenario at all.
 */
export function seedScenario(runId: string = DEFAULT_RUN_ID): SeedSummary {
  const sqlite = getSqlite();
  const counts: Record<string, number> = {};
  let total = 0;

  const writeEverything = sqlite.transaction(() => {
    clearRun(runId);

    /* The run row first, so every later row has a container to belong to. */
    getDb()
      .insert(scenarioRuns)
      .values({
        id: runId,
        label: "Corporate Payments override and supplier degradation",
        scenarioDate: SCENARIO_DATE,
        createdAt: new Date().toISOString(),
        currentMoment: "07:45",
        activeRoleId: "rcsa",
        autonomyLevel: "act-with-approval",
        worldView: "future",
        language: "en",
        eventTriggered: false,
        seededAt: new Date().toISOString(),
      })
      .run();
    counts.scenarioRuns = 1;
    total += 1;

    /* Institution spine */
    total += insertAll(legalEntities, institution.legalEntities, counts, "legalEntities");
    total += insertAll(users, institution.users, counts, "users");
    total += insertAll(roles, institution.roles, counts, "roles");
    total += insertAll(timelineEvents, institution.timelineEvents, counts, "timelineEvents");
    total += insertAll(policies, institution.policies, counts, "policies");

    /* Third party and resilience */
    total += insertAll(suppliers, [...thirdParty.suppliers, ...tprmOnboardingSuppliers], counts, "suppliers");
    total += insertAll(subprocessors, thirdParty.subprocessors, counts, "subprocessors");
    total += insertAll(services, [...thirdParty.services, ...tprmOnboardingServices], counts, "services");
    total += insertAll(serviceDependencies, thirdParty.serviceDependencies, counts, "serviceDependencies");
    total += insertAll(impactTolerances, thirdParty.impactTolerances, counts, "impactTolerances");
    total += insertAll(contracts, [...thirdParty.contracts, ...tprmOnboardingContracts], counts, "contracts");
    total += insertAll(contractObligations, [...thirdParty.contractObligations, ...tprmOnboardingContractObligations], counts, "contractObligations");

    /* Risk and control */
    total += insertAll(processes, risk.processes, counts, "processes");
    total += insertAll(risks, risk.risks, counts, "risks");
    total += insertAll(controls, risk.controls, counts, "controls");
    total += insertAll(kris, risk.kris, counts, "kris");
    total += insertAll(kriReadings, risk.kriReadings, counts, "kriReadings");
    total += insertAll(assessments, risk.assessments, counts, "assessments");
    total += insertAll(assessmentLines, risk.assessmentLines, counts, "assessmentLines");

    /* Control assurance */
    total += insertAll(controlTests, assurance.controlTests, counts, "controlTests");
    total += insertAll(testCases, assurance.testCases, counts, "testCases");

    /* Incidents and regulatory */
    total += insertAll(incidents, eventData.incidents, counts, "incidents");
    total += insertAll(incidentEvents, eventData.incidentEvents, counts, "incidentEvents");
    total += insertAll(recoveryOptions, eventData.recoveryOptions, counts, "recoveryOptions");
    total += insertAll(regulatoryPublications, eventData.regulatoryPublications, counts, "regulatoryPublications");
    total += insertAll(obligations, eventData.obligations, counts, "obligations");

    /*
     * Evidence corpus, with derived retrieval chunks.
     *
     * Two sources, one table. `evidence.evidenceDocuments` is the authored
     * corpus. `generatedEvidenceDocuments` holds the per-override records
     * behind the control test population, which are derived from the test case
     * rows rather than hand written, plus a small number of authored artefacts
     * that belong with them. Both are chunked the same way, because a
     * retrieval system that can only quote half of the corpus is worse than
     * one that quotes all of it.
     */
    const allEvidenceDocuments = [
      ...evidence.evidenceDocuments,
      ...generatedEvidenceDocuments,
      ...tprmOnboardingEvidenceDocuments,
    ];
    total += insertAll(evidenceDocuments, allEvidenceDocuments, counts, "evidenceDocuments");
    const chunks = allEvidenceDocuments.flatMap((doc: { id: string; body: string }) =>
      chunkDocument(doc.id, runId, doc.body),
    );
    total += insertAll(evidenceChunks, chunks, counts, "evidenceChunks");

    /* Personal work layer */
    total += insertAll(inboxMessages, work.inboxMessages, counts, "inboxMessages");
    total += insertAll(calendarEvents, work.calendarEvents, counts, "calendarEvents");
    total += insertAll(meetings, work.meetings, counts, "meetings");
    total += insertAll(meetingMessages, work.meetingMessages, counts, "meetingMessages");
    total += insertAll(collaborationMessages, work.collaborationMessages, counts, "collaborationMessages");

    /* Decisions, execution and governance */
    total += insertAll(issues, decisionData.issues, counts, "issues");
    total += insertAll(actions, decisionData.actions, counts, "actions");
    total += insertAll(decisions, decisionData.decisions, counts, "decisions");
    total += insertAll(decisionOptions, decisionData.decisionOptions, counts, "decisionOptions");
    total += insertAll(committeeItems, decisionData.committeeItems, counts, "committeeItems");
    total += insertAll(portfolioThemes, decisionData.portfolioThemes, counts, "portfolioThemes");
    total += insertAll(backgroundActions, decisionData.backgroundActions, counts, "backgroundActions");
    total += insertAll(auditEvents, decisionData.preExistingAuditEvents, counts, "preExistingAuditEvents");

    /* Per role timeline detail */
    total += insertAll(timelineRoleMoments, timelineMoments.timelineRoleMoments, counts, "timelineRoleMoments");

    /*
     * The integration projection, inside the transaction and last.
     *
     * Inside, because it uses the same database handle and therefore joins
     * this transaction: a failure here must not leave a scenario with
     * connector instances pointing at records that were rolled back. Last,
     * because the source requirement map is derived from the seeded decisions,
     * so it has to see them.
     */
    const integrations = seedIntegrations(runId);
    counts["integrations"] = integrations.rowsWritten;
    total += integrations.rowsWritten;
  });

  writeEverything();

  /*
   * The layers above the scenario. Counted into the same summary so
   * `npm run db:seed` and `demo:reset` report one number for the whole day,
   * and so a layer that silently wrote nothing is visible as a zero rather
   * than as an absence.
   */
  const product = seedProductConfiguration();
  counts["productConfiguration"] = product.rowsWritten;
  total += product.rowsWritten;

  const live = seedLiveEvents(runId);
  counts["liveEvents"] = live.events;
  counts["liveEventReads"] = live.readRows;
  total += live.events + live.readRows;

  const partner = seedAiPartner(runId);
  counts["aiPartner"] = partner.rowsWritten;
  total += partner.rowsWritten;

  return {
    rowsWritten: total,
    tablesWritten: Object.keys(counts).length,
    counts,
  };
}
