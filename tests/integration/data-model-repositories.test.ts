/**
 * The migration 0006 repositories, against a real migrated database.
 *
 * A temporary database with every migration applied and no scenario seed:
 * each block writes the few rows it needs and checks the repository's
 * guarantees (once-only keys, atomic writes, merges, the counts it derives),
 * not any feature's rules. The product state seed runs once, because the
 * Role App and pilot repositories read what it writes.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedProductState, SEEDED_COHORT_ID, SEEDED_PILOT_ID } from "@/db/seed/product-state";
import {
  completeRoutineRun,
  findRoutineRunsForObject,
  getOutputsForRoutineRuns,
  getRoutineRunOutputs,
  listRoutineRuns,
  recordRoutineRunOutputs,
  startRoutineRun,
  updateRoutineRun,
} from "@/db/repositories/ai-routine-runs";
import {
  countSuggestionDispositions,
  getSuggestionDispositionHistory,
  recordSuggestionDisposition,
} from "@/db/repositories/suggestion-dispositions";
import {
  countAIFeedbackByKind,
  getAIFeedbackForTarget,
  linkAIFeedbackToProductFeedback,
  listAIFeedback,
  recordAIFeedback,
  removeAIFeedback,
} from "@/db/repositories/ai-feedback";
import { clearPartnerContext, getPartnerContext, savePartnerContext } from "@/db/repositories/partner-context";
import {
  countRaisedByCategory,
  listNotifications,
  markNotificationRead,
  recordNotification,
  settleNotification,
} from "@/db/repositories/notifications";
import {
  changeRoleAppVersionState,
  createRoleAppVersion,
  getCurrentRoleAppVersion,
  getRoleAppEnablement,
  listCohortsForUser,
  listCurrentRoleAppVersions,
  listRoleAppLifecycleEvents,
  setRoleAppEnablement,
  type NewRoleAppVersion,
} from "@/db/repositories/role-app-release";
import {
  completeEvaluationRun,
  createEvaluationRun,
  getApprovedConfigurationInForce,
  getEvaluationCaseResults,
  getLatestCompletedEvaluationRun,
  recordConfigurationRelease,
  recordConfigurationRollback,
  recordEvaluationCaseResults,
} from "@/db/repositories/ai-evaluations";
import {
  countProductFeedbackByStatus,
  listProductFeedback,
  submitProductFeedback,
  triageProductFeedback,
} from "@/db/repositories/product-feedback";
import {
  getPilotProgramme,
  getLatestPilotExitDecision,
  listPilotIssues,
  listPilotMeasureReadings,
  listPilotMeasures,
  raisePilotIssue,
  recordPilotBaseline,
  recordPilotExitDecision,
  recordPilotMeasureReading,
  updatePilotIssue,
  updatePilotProgramme,
} from "@/db/repositories/pilot";
import {
  completeReleaseGateRun,
  getDeployedRelease,
  getLatestReleaseGateRun,
  recordReleaseEvent,
  startReleaseGateRun,
} from "@/db/repositories/release-management";
import {
  listDataQualityIssues,
  listIntegrationIncidents,
  openIntegrationIncident,
  recordDataQualityIssue,
  updateDataQualityIssue,
  updateIntegrationIncident,
} from "@/db/repositories/integration-operations";
import { aggregateExperienceEvents, recordExperienceEvent } from "@/db/repositories/experience-events";
import {
  copyDecisionForRun,
  createDecisionForRun,
  getDecisionsForStage,
  listDecisionsForProcessRun,
} from "@/db/repositories/process-decisions";
import {
  addStageInput,
  findStageInputsForSource,
  linkStageInputRecords,
  listStageInputs,
} from "@/db/repositories/process-stage-inputs";
import { recordInboxConversion, recordTriageConfirmation } from "@/db/repositories/inbox-conversion";
import {
  addToObjectList,
  deleteSavedView,
  getUserPreferences,
  listObjectList,
  listSavedViews,
  removeFromObjectList,
  saveSavedView,
  saveUserPreferences,
  trimObjectList,
} from "@/db/repositories/personalisation";

const AT = "2026-10-06T07:45:00.000Z";

function insertSuggestion(id: string, roleId = "rcsa"): void {
  getSqlite()
    .prepare(
      "insert into ai_suggestions (id, run_id, role_id, object_type, object_id, at_moment, status, priority, headline, change_summary, why_it_matters, checks_completed, actions_completed, alternatives, evidence_ids, confidence, uncertainty, decision_required, authority_class, source, missing_required_sources, source_connector_ids, stages, state_digest, created_at) values (?, 'run-001', ?, 'kri', 'KRI-1', '07:45', 'needs-user', 'high', 'H', 'C', 'W', '[]', '[]', '[]', '[]', 70, '[]', 1, 'PROPOSE', 'seeded', '[]', '[]', '[]', ?, ?)",
    )
    .run(id, roleId, `digest-${id}`, AT);
}

beforeAll(() => {
  createTemporaryDatabase("data-model-repositories");
  seedProductState();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

/* ==========================================================================
   Wave 3: the AI Partner
   ========================================================================== */

describe("AI routine runs", () => {
  it("starts a run once per idempotency key", () => {
    const base = {
      id: "RR-1",
      routineId: "morning-brief-rcsa",
      roleId: "rcsa" as const,
      triggerKind: "schedule" as const,
      status: "queued" as const,
      mode: "offline" as const,
      atMoment: "07:00",
      startedAt: "2026-10-06T07:00:00.000Z",
      idempotencyKey: "routine:morning-brief-rcsa:2026-10-06",
    };
    const first = startRoutineRun(base);
    const second = startRoutineRun({ ...base, id: "RR-1-again" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.run.id).toBe("RR-1");
    expect(listRoutineRuns({ roleId: "rcsa" })).toHaveLength(1);
  });

  it("completes a run with its outputs in one write, and records each output once", () => {
    updateRoutineRun("RR-1", { status: "running", jobId: "JOB-1" });
    const done = completeRoutineRun(
      "RR-1",
      {
        status: "completed",
        outcome: "created-work",
        summary: "Prepared the challenge workshop brief.",
        summaryDe: "Hat die Unterlage fuer den Challenge-Workshop vorbereitet.",
        completedAt: "2026-10-06T07:02:00.000Z",
        osEventId: "OSE-9",
      },
      [
        { id: "RRO-1", objectKind: "meeting-preparation", objectId: "MTG-2026-0005", effect: "created", sortOrder: 1, createdAt: AT },
        { id: "RRO-2", objectKind: "action", objectId: "MSN-2026-0166", effect: "updated", sortOrder: 2, createdAt: AT },
      ],
    );
    expect(done).toMatchObject({ status: "completed", outcome: "created-work", jobId: "JOB-1", osEventId: "OSE-9" });
    expect(getRoutineRunOutputs("RR-1").map((row) => row.objectId)).toStrictEqual(["MTG-2026-0005", "MSN-2026-0166"]);
    expect(
      recordRoutineRunOutputs("RR-1", [{ id: "RRO-3", objectKind: "action", objectId: "MSN-2026-0166", effect: "updated", createdAt: AT }]),
    ).toBe(0);
    expect(getOutputsForRoutineRuns(["RR-1"]).get("RR-1")).toHaveLength(2);
    expect(findRoutineRunsForObject("meeting-preparation", "MTG-2026-0005").map((run) => run.id)).toStrictEqual(["RR-1"]);
    expect(listRoutineRuns({ statuses: ["failed"] })).toHaveLength(0);
  });
});

describe("suggestion dispositions", () => {
  it("refuses an unknown suggestion and writes nothing", () => {
    const result = recordSuggestionDisposition({
      id: "SD-0",
      suggestionId: "SUG-NONE",
      to: "reviewed",
      actorKind: "human",
      actorUserId: "P-003",
      at: AT,
      atMoment: "07:45",
    });
    expect(result).toStrictEqual({ recorded: false, reason: "unknown-suggestion" });
    expect(getSuggestionDispositionHistory("SUG-NONE")).toHaveLength(0);
  });

  it("records each change in the history and on the suggestion, and ignores a repeat", () => {
    insertSuggestion("SUG-1");
    insertSuggestion("SUG-2");
    const step = (id: string, to: "reviewed" | "modified" | "executed", modification?: { summary: string; fields: Array<{ field: string; prepared: string; recorded: string }> }) =>
      recordSuggestionDisposition({ id, suggestionId: "SUG-1", to, actorKind: "human", actorUserId: "P-003", at: AT, atMoment: "07:45", modification });

    expect(step("SD-1", "reviewed").recorded).toBe(true);
    const repeat = step("SD-1b", "reviewed");
    expect(repeat).toMatchObject({ recorded: false, reason: "unchanged" });
    expect(
      step("SD-2", "modified", { summary: "Owner changed.", fields: [{ field: "owner", prepared: "P-007", recorded: "P-008" }] }).recorded,
    ).toBe(true);
    expect(step("SD-3", "executed").recorded).toBe(true);

    const history = getSuggestionDispositionHistory("SUG-1");
    expect(history.map((entry) => [entry.sequence, entry.fromDisposition, entry.toDisposition])).toStrictEqual([
      [1, "new", "reviewed"],
      [2, "reviewed", "modified"],
      [3, "modified", "executed"],
    ]);
    expect(history[1]?.modification?.fields[0]).toStrictEqual({ field: "owner", prepared: "P-007", recorded: "P-008" });
    const row = getSqlite().prepare("select disposition, disposition_by_user_id as by from ai_suggestions where id = 'SUG-1'").get();
    expect(row).toStrictEqual({ disposition: "executed", by: "P-003" });

    const counts = countSuggestionDispositions({ roleId: "rcsa" });
    expect(counts.executed).toBe(1);
    expect(counts.new).toBe(1);
    expect(counts.rejected).toBe(0);
  });
});

describe("AI feedback", () => {
  const feedback = (id: string, kind: "useful" | "wrong-source", userId = "P-003") => ({
    id,
    roleId: "rcsa" as const,
    userId,
    kind,
    targetKind: "suggestion" as const,
    targetId: "SUG-1",
    taskKind: "suggestion",
    configurationId: "AICFG-RCSA-STAGE-PREP-001",
    promptVersion: "v1.0",
    modelProfileId: "gpt-4o-mini-structured",
    sourceRefs: ["EVD-2026-41821"],
    atMoment: "07:45",
    createdAt: AT,
  });

  it("records feedback once per person, output and kind", () => {
    expect(recordAIFeedback(feedback("AIF-1", "wrong-source")).created).toBe(true);
    const again = recordAIFeedback(feedback("AIF-1b", "wrong-source"));
    expect(again.created).toBe(false);
    expect(again.feedback.id).toBe("AIF-1");
    expect(recordAIFeedback(feedback("AIF-2", "useful", "P-002")).created).toBe(true);
    expect(getAIFeedbackForTarget("suggestion", "SUG-1")).toHaveLength(2);
  });

  it("links an item to the product inbox, counts by kind, and removes only a person's own feedback", () => {
    expect(linkAIFeedbackToProductFeedback("AIF-1", "PFB-1")).toBe(true);
    expect(listAIFeedback({ forwarded: true }).map((row) => row.id)).toStrictEqual(["AIF-1"]);
    expect(listAIFeedback({ forwarded: false }).map((row) => row.id)).toStrictEqual(["AIF-2"]);
    const counts = countAIFeedbackByKind({ configurationId: "AICFG-RCSA-STAGE-PREP-001" });
    expect(counts).toMatchObject({ "wrong-source": 1, useful: 1, "too-verbose": 0 });
    expect(removeAIFeedback("AIF-2", "P-003")).toBe(false);
    expect(removeAIFeedback("AIF-2", "P-002")).toBe(true);
  });
});

describe("partner context", () => {
  it("creates a context with empty lists, merges later writes, and counts versions", () => {
    const first = savePartnerContext({
      userId: "P-003",
      roleId: "rcsa",
      fields: { legalEntityId: "ARC-DE", selectedObjectKind: "control", selectedObjectId: "CTL-PAY-014" },
      updatedAt: AT,
      updatedAtMoment: "07:45",
    });
    expect(first).toMatchObject({ version: 1, selectedObjectId: "CTL-PAY-014", priorDecisionIds: [], userEdits: [], sourceFreshness: [] });

    const second = savePartnerContext({
      userId: "P-003",
      roleId: "rcsa",
      fields: { meetingId: "MTG-2026-0005", priorDecisionIds: ["DEC-2026-0771"], selectedObjectId: undefined },
      updatedAt: "2026-10-06T10:30:00.000Z",
      updatedAtMoment: "10:30",
    });
    expect(second).toMatchObject({ version: 2, selectedObjectId: "CTL-PAY-014", meetingId: "MTG-2026-0005", priorDecisionIds: ["DEC-2026-0771"] });

    const third = savePartnerContext({ userId: "P-003", roleId: "rcsa", fields: { meetingId: null }, updatedAt: AT, updatedAtMoment: "11:00" });
    expect(third.meetingId).toBeNull();
    expect(third.version).toBe(3);
    expect(getPartnerContext("P-003", "tprm")).toBeUndefined();
    expect(clearPartnerContext("P-003", "rcsa")).toBe(true);
    expect(getPartnerContext("P-003", "rcsa")).toBeUndefined();
  });
});

describe("notifications", () => {
  it("records one notification per thing, resolves an arrival's read mark from the live day, and settles once", () => {
    const base = {
      roleId: "tprm" as const,
      category: "routine-created-work" as const,
      budgetOutcome: "raised" as const,
      raisedAt: AT,
      raisedAtMoment: "07:45",
    };
    expect(recordNotification({ ...base, id: "NTF-1", dedupeKey: "routine:RR-1", sourceKind: "backbone", sourceId: "OSE-9" }).created).toBe(true);
    expect(recordNotification({ ...base, id: "NTF-1b", dedupeKey: "routine:RR-1", sourceKind: "backbone", sourceId: "OSE-10" }).created).toBe(false);
    recordNotification({ ...base, id: "NTF-2", category: "material-change", dedupeKey: "arrival:WLE-1", sourceKind: "live-event", sourceId: "WLE-1" });

    getSqlite()
      .prepare("insert into workday_live_event_reads (id, run_id, event_id, role_id, read_at) values ('R-1', 'run-001', 'WLE-1', 'tprm', '2026-10-06T08:00:00.000Z')")
      .run();

    expect(markNotificationRead("NTF-2", "P-002", AT)).toBe(false);
    expect(markNotificationRead("NTF-1", "P-002", "2026-10-06T08:05:00.000Z")).toBe(true);
    expect(markNotificationRead("NTF-1", "P-002", "2026-10-06T08:06:00.000Z")).toBe(false);

    const views = Object.fromEntries(listNotifications({ roleId: "tprm" }).map((view) => [view.id, [view.read, view.readAt]]));
    expect(views).toStrictEqual({
      "NTF-1": [true, "2026-10-06T08:05:00.000Z"],
      "NTF-2": [true, "2026-10-06T08:00:00.000Z"],
    });

    expect(settleNotification("NTF-2", AT, "OSE-11")).toBe(true);
    expect(settleNotification("NTF-2", AT, "OSE-12")).toBe(false);
    expect(listNotifications({ roleId: "tprm", openOnly: true }).map((view) => view.id)).toStrictEqual(["NTF-1"]);
    expect(countRaisedByCategory("tprm", "2026-10-06T00:00:00.000Z")).toMatchObject({ "routine-created-work": 1, "material-change": 1, "execution-failed": 0 });
  });
});

/* ==========================================================================
   Wave 4: the Product Owner Console
   ========================================================================== */

describe("Role App release state", () => {
  const candidate = (): NewRoleAppVersion => {
    const current = getCurrentRoleAppVersion("tprm-third-party-onboarding");
    if (!current) throw new Error("The seed did not record the installed version.");
    const { id: _id, isCurrent: _current, ...rest } = current;
    void _id;
    void _current;
    return { ...rest, id: "RAV-tprm-third-party-onboarding-1.1.0", version: "1.1.0", lifecycleState: "candidate", releasedAt: null, createdAt: AT, createdByLabel: "Product owner" };
  };
  const actor = { actorKind: "human" as const, actorUserId: "PILOT-ADM", actorLabel: "Product owner", at: AT };

  it("reads the seeded current versions", () => {
    expect(listCurrentRoleAppVersions()).toHaveLength(7);
    expect(getCurrentRoleAppVersion("rcsa-cycle-assistant")?.lifecycleState).toBe("installed");
  });

  it("records a candidate that is not current, then makes it current with its history", () => {
    const created = createRoleAppVersion(candidate(), actor);
    expect(created.isCurrent).toBe(false);
    expect(getCurrentRoleAppVersion("tprm-third-party-onboarding")?.version).toBe("1.0.0");

    const installed = changeRoleAppVersionState(created.id, { toState: "installed", makeCurrent: true, releasedAt: AT }, actor);
    expect(installed).toMatchObject({ isCurrent: true, lifecycleState: "installed" });
    expect(getCurrentRoleAppVersion("tprm-third-party-onboarding")?.version).toBe("1.1.0");

    const back = changeRoleAppVersionState("RAV-tprm-third-party-onboarding-1.0.0", { toState: "installed", makeCurrent: true, kind: "rolled-back" }, { ...actor, reason: "Candidate failed in pilot." });
    expect(back?.isCurrent).toBe(true);
    expect(getCurrentRoleAppVersion("tprm-third-party-onboarding")?.version).toBe("1.0.0");

    const history = listRoleAppLifecycleEvents("tprm-third-party-onboarding");
    expect(history.map((event) => [event.id, event.kind])).toStrictEqual([
      ["RALE-tprm-third-party-onboarding-0001", "registered"],
      ["RALE-tprm-third-party-onboarding-0002", "registered"],
      ["RALE-tprm-third-party-onboarding-0003", "state-changed"],
      ["RALE-tprm-third-party-onboarding-0004", "rolled-back"],
    ]);
    expect(history[2]).toMatchObject({ fromState: "candidate", toState: "installed" });
    expect(changeRoleAppVersionState("RAV-unknown", { toState: "retired" }, actor)).toBeUndefined();
  });

  it("enables per scope, records a cohort assignment, and ignores a repeat", () => {
    expect(
      setRoleAppEnablement({ roleAppId: "tprm-third-party-onboarding", scopeKind: "tenant", scopeId: "org-arcadia-banking-group", enabled: true }, actor),
    ).toBe(false);
    expect(
      setRoleAppEnablement(
        { roleAppId: "tprm-third-party-onboarding", scopeKind: "cohort", scopeId: SEEDED_COHORT_ID, enabled: true, versionId: "RAV-tprm-third-party-onboarding-1.1.0" },
        actor,
      ),
    ).toBe(true);
    expect(
      setRoleAppEnablement({ roleAppId: "tprm-third-party-onboarding", scopeKind: "tenant", scopeId: "org-arcadia-banking-group", enabled: false }, actor),
    ).toBe(true);
    expect(getRoleAppEnablement("tprm-third-party-onboarding", "tenant", "org-arcadia-banking-group")?.enabled).toBe(false);
    const kinds = listRoleAppLifecycleEvents("tprm-third-party-onboarding").slice(-2).map((event) => event.kind);
    expect(kinds).toStrictEqual(["cohort-assigned", "disabled"]);
    expect(listCohortsForUser("PILOT-001").map((cohort) => cohort.id)).toStrictEqual([SEEDED_COHORT_ID]);
    expect(listCohortsForUser("P-003")).toHaveLength(0);
  });
});

describe("AI evaluations and configuration releases", () => {
  it("recomputes a completed run's counts from its cases, and keeps one row per re-graded case", () => {
    createEvaluationRun({
      id: "AER-1",
      configurationId: "AICFG-TPRM-STAGE-PREP-001",
      configurationStatus: "released",
      roleId: "tprm",
      taskKind: "stage-preparation",
      promptVersion: "v1.0",
      modelProfileId: "gpt-4o-mini-structured",
      outputSchemaVersion: "envelope-v1",
      evaluationSuiteId: "EVAL-TPRM-001",
      mode: "structural",
      status: "running",
      triggeredByLabel: "Product owner",
      startedAt: AT,
    });
    const graded = (status: "passed" | "failed" | "not-run") => [{ grader: "citations", passed: status === "passed", score: status === "passed" ? 1 : 0, details: "" }];
    recordEvaluationCaseResults("AER-1", [
      { id: "C1", caseId: "tprm-001", roleId: "tprm", taskKind: "stage-preparation", mandatory: true, status: "failed", graderResults: graded("failed") },
      { id: "C2", caseId: "tprm-002", roleId: "tprm", taskKind: "stage-preparation", mandatory: false, status: "passed", graderResults: graded("passed") },
      { id: "C3", caseId: "tprm-003", roleId: "tprm", taskKind: "stage-preparation", mandatory: false, status: "not-run", graderResults: [], reason: "No live response." },
    ]);
    recordEvaluationCaseResults("AER-1", [
      { id: "C2b", caseId: "tprm-002", roleId: "tprm", taskKind: "stage-preparation", mandatory: false, status: "failed", graderResults: graded("failed") },
    ]);
    expect(getEvaluationCaseResults("AER-1").map((row) => [row.caseId, row.status])).toStrictEqual([
      ["tprm-001", "failed"],
      ["tprm-002", "failed"],
      ["tprm-003", "not-run"],
    ]);
    const run = completeEvaluationRun("AER-1", { status: "completed", completedAt: "2026-10-06T08:00:00.000Z" });
    expect(run).toMatchObject({ totalCases: 3, passed: 0, failed: 2, notRun: 1, mandatoryFailed: 1 });
    expect(getLatestCompletedEvaluationRun("AICFG-TPRM-STAGE-PREP-001")?.id).toBe("AER-1");
  });

  it("records an approval and rolls it back once; the registry is in force when no approval stands", () => {
    recordConfigurationRelease({
      id: "ACR-1",
      configurationId: "AICFG-TPRM-STAGE-PREP-002",
      roleId: "tprm",
      taskKind: "stage-preparation",
      decision: "approved",
      evaluationRunId: "AER-1",
      supersedesConfigurationId: "AICFG-TPRM-STAGE-PREP-001",
      rationale: "Mandatory cases pass on the candidate.",
      decidedAt: AT,
      decidedByLabel: "AI quality owner",
    });
    expect(getApprovedConfigurationInForce("tprm", "stage-preparation")?.id).toBe("ACR-1");
    const rolled = recordConfigurationRollback("ACR-1", { at: AT, byLabel: "AI quality owner", reason: "German results regressed.", restoredConfigurationId: "AICFG-TPRM-STAGE-PREP-001" });
    expect(rolled?.rolledBackAt).toBe(AT);
    expect(recordConfigurationRollback("ACR-1", { at: AT, byLabel: "x", reason: "again", restoredConfigurationId: null })).toBeUndefined();
    expect(getApprovedConfigurationInForce("tprm", "stage-preparation")).toBeUndefined();
  });
});

describe("product feedback", () => {
  it("submits, triages only what triage may change, and counts by status", () => {
    submitProductFeedback({ id: "PFB-1", kind: "wrong-source", summary: "Cited the superseded appendix.", submittedAt: AT, roleId: "tprm", aiFeedbackId: "AIF-1" });
    submitProductFeedback({ id: "PFB-2", kind: "feature-request", summary: "Export the evidence pack.", submittedAt: "2026-10-06T09:00:00.000Z" });
    const triaged = triageProductFeedback("PFB-1", {
      status: "planned",
      severity: "high",
      ownerLabel: "Role App owner",
      roleAppId: "tprm-third-party-onboarding",
      stageId: "evidence-review",
      releaseVersion: "4.2.0",
      triagedAt: AT,
      triagedByLabel: "Product owner",
    });
    expect(triaged).toMatchObject({ status: "planned", severity: "high", summary: "Cited the superseded appendix.", aiFeedbackId: "AIF-1" });
    expect(listProductFeedback({ statuses: ["planned"], roleAppId: "tprm-third-party-onboarding" }).map((row) => row.id)).toStrictEqual(["PFB-1"]);
    expect(listProductFeedback().map((row) => row.id)).toStrictEqual(["PFB-2", "PFB-1"]);
    expect(countProductFeedbackByStatus()).toMatchObject({ new: 1, planned: 1, closed: 0 });
  });
});

describe("pilot management", () => {
  it("reads the seeded pilot and records a baseline without ever storing an unmeasured value", () => {
    expect(getPilotProgramme(SEEDED_PILOT_ID)?.status).toBe("setup");
    const measures = listPilotMeasures(SEEDED_PILOT_ID);
    expect(measures.map((measure) => measure.baselineStatus)).toStrictEqual(Array(6).fill("not-measured"));

    const cycle = measures.find((measure) => measure.key === "cycle-time");
    if (!cycle) throw new Error("The cycle time measure is missing.");
    expect(
      recordPilotBaseline(cycle.id, { status: "measured", value: 42, period: "Q3 2026", recordedAt: AT, recordedByLabel: "Pilot lead" }),
    ).toMatchObject({ baselineStatus: "measured", baselineValue: 42 });
    expect(
      recordPilotBaseline(cycle.id, { status: "unavailable", recordedAt: AT, recordedByLabel: "Pilot lead" }),
    ).toMatchObject({ baselineStatus: "unavailable", baselineValue: null });

    expect(updatePilotProgramme(SEEDED_PILOT_ID, { status: "running", startedAt: AT, updatedAt: AT })?.status).toBe("running");
  });

  it("keeps one reading per measure and week, and a reading that was not taken has no value", () => {
    const measure = listPilotMeasures(SEEDED_PILOT_ID)[0];
    if (!measure) throw new Error("No measure.");
    const reading = { id: "PMR-1", pilotId: SEEDED_PILOT_ID, measureId: measure.id, weekStarting: "2026-10-12", source: "recorded-by-pilot-lead", recordedAt: AT, recordedByLabel: "Pilot lead" };
    recordPilotMeasureReading({ ...reading, status: "measured", value: 35 });
    const replaced = recordPilotMeasureReading({ ...reading, id: "PMR-1b", status: "not-measured", value: 99, note: "Pilot lead absent." });
    expect(replaced).toMatchObject({ id: "PMR-1", status: "not-measured", value: null, note: "Pilot lead absent." });
    expect(listPilotMeasureReadings(SEEDED_PILOT_ID)).toHaveLength(1);
  });

  it("raises and resolves issues, and reads exit decisions in order", () => {
    raisePilotIssue({ id: "PI-1", pilotId: SEEDED_PILOT_ID, kind: "risk", title: "Read connector not verified.", severity: "high", status: "open", raisedAt: AT, raisedByLabel: "Pilot lead" });
    updatePilotIssue("PI-1", { status: "resolved", resolvedAt: AT, resolution: "Verified in sandbox." });
    expect(listPilotIssues(SEEDED_PILOT_ID, { status: "resolved" }).map((issue) => issue.id)).toStrictEqual(["PI-1"]);

    const decision = (id: string, outcome: "extend" | "scale", decidedAt: string) =>
      recordPilotExitDecision({ id, pilotId: SEEDED_PILOT_ID, outcome, evidence: [], unresolvedConditions: [], controlFindings: [], rationale: "Stated by the steering group.", decidedAt, decidedByLabel: "Pilot lead" });
    decision("PED-1", "extend", "2026-11-01T10:00:00.000Z");
    decision("PED-2", "scale", "2026-12-01T10:00:00.000Z");
    expect(getLatestPilotExitDecision(SEEDED_PILOT_ID)?.outcome).toBe("scale");
  });
});

describe("release management", () => {
  it("knows nothing is deployed until a deployment is recorded, and follows a rollback", () => {
    expect(getDeployedRelease()).toBeNull();
    const event = (id: string, kind: "deployed" | "rollout-updated" | "rolled-back", at: string, rolloutStatus: "pilot" | "complete" | null = null) =>
      recordReleaseEvent({ id, releaseVersion: "4.1.0", kind, rolloutStatus, at, actorLabel: "Release manager" });
    event("PRE-1", "deployed", "2026-10-07T08:00:00.000Z", "pilot");
    expect(getDeployedRelease()).toStrictEqual({ releaseVersion: "4.1.0", deployedAt: "2026-10-07T08:00:00.000Z", rolloutStatus: "pilot" });
    event("PRE-2", "rollout-updated", "2026-10-08T08:00:00.000Z", "complete");
    expect(getDeployedRelease()?.rolloutStatus).toBe("complete");
    event("PRE-3", "rolled-back", "2026-10-09T08:00:00.000Z");
    expect(getDeployedRelease()).toBeNull();
  });

  it("counts a mandatory gate that failed or did not run against the release", () => {
    startReleaseGateRun({ id: "RGR-1", releaseVersion: "4.1.0", startedAt: AT, triggeredByLabel: "Release manager" });
    const done = completeReleaseGateRun("RGR-1", {
      status: "failed",
      completedAt: AT,
      results: [
        { gateKey: "typecheck", label: "Typecheck", mandatory: true, status: "passed", detail: "", evidenceRef: null, durationMs: 1 },
        { gateKey: "scan-secrets", label: "Secret scan", mandatory: true, status: "not-run", detail: "", evidenceRef: null, durationMs: null },
        { gateKey: "eval-live", label: "Live evaluation", mandatory: false, status: "failed", detail: "", evidenceRef: null, durationMs: null },
      ],
    });
    expect(done).toMatchObject({ mandatoryTotal: 2, mandatoryFailed: 1 });
    expect(getLatestReleaseGateRun("4.1.0")?.id).toBe("RGR-1");
  });
});

describe("integration operations", () => {
  it("records an incident's impact and a data quality issue's resolution", () => {
    openIntegrationIncident({
      id: "II-1",
      connectorInstanceId: "CI-REST-GENERIC",
      title: "Outbound commands to the generic REST endpoint fail.",
      severity: "medium",
      status: "open",
      affectedRoleIds: ["tprm"],
      affectedProcessRunIds: ["RUN-TPRM-VERIDIAN-2026"],
      affectedUserCount: 1,
      failedCommandIds: ["CMD-1"],
      deadLetterIds: [],
      openedAt: AT,
      openedAtMoment: "07:45",
      openedByLabel: "Integration owner",
    });
    updateIntegrationIncident("II-1", { status: "resolved", resolvedAt: AT, resolvedByLabel: "Integration owner", recoveryNote: "Endpoint restored." });
    expect(listIntegrationIncidents({ statuses: ["resolved"] }).map((row) => row.id)).toStrictEqual(["II-1"]);

    recordDataQualityIssue({
      id: "DQI-1",
      kind: "mapping",
      connectorInstanceId: "CI-GRC-SIM",
      title: "Control rating value not mapped.",
      severity: "low",
      status: "open",
      detectedAt: AT,
      detectedAtMoment: "07:45",
      detectedBy: "connector",
    });
    updateDataQualityIssue("DQI-1", { status: "resolved", resolvedAt: AT, resolvedByLabel: "Integration owner", resolution: "Mapping added.", productConfigChangeId: "PCC-0002" });
    expect(listDataQualityIssues({ kinds: ["mapping"], statuses: ["resolved"] })[0]).toMatchObject({ productConfigChangeId: "PCC-0002" });
    expect(listDataQualityIssues({ statuses: ["open"] })).toHaveLength(0);
  });
});

describe("experience events", () => {
  it("holds no person, records an interaction once, and aggregates by kind, role and week", () => {
    const columns = (getSqlite().prepare("select name from pragma_table_info('experience_events')").all() as Array<{ name: string }>).map((row) => row.name);
    expect(columns.some((name) => name.includes("user"))).toBe(false);

    const event = (id: string, kind: "now-item-opened" | "evidence-opened", roleId: "rcsa" | "tprm", occurredAt: string) =>
      recordExperienceEvent({ id, kind, roleId, mode: "safe", cohortId: SEEDED_COHORT_ID, atMoment: "07:45", occurredAt, idempotencyKey: id });
    expect(event("XE-1", "now-item-opened", "rcsa", "2026-10-06T07:50:00.000Z").created).toBe(true);
    expect(event("XE-1", "now-item-opened", "rcsa", "2026-10-06T07:50:00.000Z").created).toBe(false);
    event("XE-2", "evidence-opened", "rcsa", "2026-10-07T09:00:00.000Z");
    event("XE-3", "evidence-opened", "tprm", "2026-10-13T09:00:00.000Z");

    expect(aggregateExperienceEvents()).toStrictEqual([{ count: 3 }]);
    expect(aggregateExperienceEvents({ kinds: ["evidence-opened"] }, ["roleId", "week"])).toStrictEqual(
      expect.arrayContaining([
        { roleId: "rcsa", week: "2026-10-05", count: 1 },
        { roleId: "tprm", week: "2026-10-12", count: 1 },
      ]),
    );
    expect(aggregateExperienceEvents({ cohortId: SEEDED_COHORT_ID, roleId: "rcsa" }, ["kind"])).toHaveLength(2);
  });
});

/* ==========================================================================
   Migration 0007: decisions that belong to a process run
   ========================================================================== */

describe("process decisions", () => {
  beforeAll(() => {
    const sqlite = getSqlite();
    const runRow = sqlite.prepare(
      "insert into role_app_runs (id, run_id, role_app_id, role_id, subject_kind, subject_id, current_stage_id, status, started_at, updated_at) values (?, 'run-001', 'rcsa-cycle-assistant', 'rcsa', 'assessment', ?, 'evidence-refresh', 'in-progress', '2026-10-06', '2026-10-06')",
    );
    runRow.run("RUN-RCSA-PAYOPS-Q4-2026", "RCSA-ARC-DE-PAYOPS-2026-Q4");
    runRow.run("RUN-RCSA-OFFCYCLE-1", "RCSA-OFFCYCLE-1");
    /* The Q4 template, already recorded, with two options. */
    sqlite
      .prepare(
        "insert into decisions (id, run_id, reference, role_id, entity_id, title, question, judgment_kind, presented_at_moment, priority_rank, why_this_matters, prepared_position, supporting_evidence_ids, opposing_evidence_ids, uncertainty_note, confidence, required_authority, status, chosen_option_id, recorded_rationale, decided_by_user_id, decided_at_moment, process_run_id, process_stage_id, due_at) values ('DEC-2026-0771', 'run-001', 'RCSA-D1', 'rcsa', 'ARC-DE', 'Three explanations or one investigation', 'Which?', 'escalation', '07:45', 1, 'Why.', 'One investigation.', '[\"EVD-1\"]', '[\"EVD-2\"]', 'Inference.', 0.74, 'rcsa.escalate', 'decided', 'DEC-2026-0771-B', 'Mine.', 'P-003', '09:00', 'RUN-RCSA-PAYOPS-Q4-2026', 'evidence-refresh', '2026-10-06T12:00:00.000Z')",
      )
      .run();
    const option = sqlite.prepare(
      "insert into decision_options (id, run_id, decision_id, label, description, is_recommended, consequences, sort_order) values (?, 'run-001', 'DEC-2026-0771', ?, 'd', ?, ?, ?)",
    );
    option.run("DEC-2026-0771-A", "Three explanations", 0, JSON.stringify([{ kind: "create-action", targetId: "KRI-PAY-007" }]), 1);
    option.run("DEC-2026-0771-B", "One investigation", 1, JSON.stringify([{ kind: "create-action", targetId: "PRC-PAY-01" }]), 2);
  });

  it("copies a recorded template into an open decision for another run, options and consequences kept", () => {
    const result = copyDecisionForRun("DEC-2026-0771", {
      id: "DEC-OFFCYCLE-1-S2",
      reference: "RCSA-OC1-D1",
      processRunId: "RUN-RCSA-OFFCYCLE-1",
      processStageId: "evidence-refresh",
      presentedAtMoment: "14:05",
    });
    if (!result?.ok) throw new Error(`The copy was refused: ${JSON.stringify(result)}`);
    expect(result.created).toBe(true);
    expect(result.decision).toMatchObject({
      status: "open",
      chosenOptionId: null,
      recordedRationale: "",
      decidedByUserId: null,
      processRunId: "RUN-RCSA-OFFCYCLE-1",
      processStageId: "evidence-refresh",
      presentedAtMoment: "14:05",
      dueAt: null,
      question: "Which?",
    });
    expect(result.options.map((row) => [row.id, row.label, row.consequences[0]?.targetId])).toStrictEqual([
      ["DEC-OFFCYCLE-1-S2-O01", "Three explanations", "KRI-PAY-007"],
      ["DEC-OFFCYCLE-1-S2-O02", "One investigation", "PRC-PAY-01"],
    ]);
    /* The template is untouched. */
    expect(getSqlite().prepare("select status from decisions where id = 'DEC-2026-0771'").get()).toStrictEqual({ status: "decided" });
  });

  it("writes a decision once, and refuses another role's run, a non-choice and a repeated option", () => {
    const again = copyDecisionForRun("DEC-2026-0771", { id: "DEC-OFFCYCLE-1-S2", reference: "x", processRunId: "RUN-RCSA-OFFCYCLE-1", processStageId: "evidence-refresh" });
    expect(again).toMatchObject({ ok: true, created: false });
    expect(copyDecisionForRun("DEC-NONE", { id: "x", reference: "x", processRunId: "RUN-RCSA-OFFCYCLE-1", processStageId: null })).toBeUndefined();

    const base = {
      id: "DEC-NEW",
      reference: "RCSA-NEW",
      roleId: "rcsa" as const,
      entityId: "ARC-DE",
      title: "T",
      question: "Q",
      judgmentKind: "materiality",
      presentedAtMoment: "07:45",
      priorityRank: 1,
      whyThisMatters: "W",
      preparedPosition: "P",
      supportingEvidenceIds: [],
      opposingEvidenceIds: [],
      uncertaintyNote: "U",
      confidence: 0.5,
      requiredAuthority: "rcsa.rate",
    };
    const option = (id: string) => ({ id, label: id, description: "d", consequences: [], sortOrder: 1 });
    expect(createDecisionForRun({ decision: base, options: [option("A"), option("B")], processRunId: "RUN-NONE", processStageId: null })).toStrictEqual({
      ok: false,
      reason: "unknown-process-run",
    });
    expect(
      createDecisionForRun({ decision: { ...base, roleId: "tprm" }, options: [option("A"), option("B")], processRunId: "RUN-RCSA-OFFCYCLE-1", processStageId: null }),
    ).toStrictEqual({ ok: false, reason: "role-mismatch" });
    expect(createDecisionForRun({ decision: base, options: [option("A")], processRunId: "RUN-RCSA-OFFCYCLE-1", processStageId: null })).toStrictEqual({
      ok: false,
      reason: "too-few-options",
    });
    expect(createDecisionForRun({ decision: base, options: [option("A"), option("A")], processRunId: "RUN-RCSA-OFFCYCLE-1", processStageId: null })).toStrictEqual({
      ok: false,
      reason: "duplicate-option-id",
    });
    expect(getSqlite().prepare("select count(*) as n from decisions where id = 'DEC-NEW'").get()).toStrictEqual({ n: 0 });
    expect(
      createDecisionForRun({ decision: { ...base, id: "DEC-OFFCYCLE-1-S2" }, options: [option("C"), option("D")], processRunId: "RUN-RCSA-PAYOPS-Q4-2026", processStageId: "evidence-refresh" }),
    ).toStrictEqual({ ok: false, reason: "already-exists-elsewhere" });
  });

  it("lists a run's decisions and the ones a stage waits for", () => {
    expect(listDecisionsForProcessRun("RUN-RCSA-OFFCYCLE-1").map((row) => row.id)).toStrictEqual(["DEC-OFFCYCLE-1-S2"]);
    expect(getDecisionsForStage("RUN-RCSA-PAYOPS-Q4-2026", "evidence-refresh").map((row) => row.id)).toStrictEqual(["DEC-2026-0771"]);
    expect(getDecisionsForStage("RUN-RCSA-OFFCYCLE-1", "challenge-workshop")).toHaveLength(0);
  });
});

/* ==========================================================================
   Migration 0008: stored inbox lineage and process stage inputs
   ========================================================================== */

describe("process stage inputs", () => {
  it("records an attachment once per stage and source, and links its records once", () => {
    const input = {
      processRunId: "RUN-TPRM-VERIDIAN-2026",
      stageId: "evidence-review",
      stageRunId: "STAGERUN-TPRM-4",
      sourceKind: "message" as const,
      sourceId: "IMSG-2026-0006",
      addedByUserId: "P-002",
      addedAt: AT,
      addedAtMoment: "07:45",
      note: "The supplier's answer on the SOC report.",
    };
    const first = addStageInput(input);
    expect(first.created).toBe(true);
    expect(addStageInput({ ...input, note: "Again." }).created).toBe(false);
    addStageInput({ ...input, stageId: "specialist-reviews", stageRunId: null });

    expect(listStageInputs("RUN-TPRM-VERIDIAN-2026", "evidence-review").map((row) => row.note)).toStrictEqual(["The supplier's answer on the SOC report."]);
    expect(listStageInputs("RUN-TPRM-VERIDIAN-2026")).toHaveLength(2);
    expect(findStageInputsForSource("message", "IMSG-2026-0006").map((row) => row.stageId)).toStrictEqual(["evidence-review", "specialist-reviews"]);

    expect(linkStageInputRecords(first.input.id, { osEventId: "OSE-1", auditEventId: "AUD-1" })).toMatchObject({ osEventId: "OSE-1", auditEventId: "AUD-1" });
    expect(linkStageInputRecords(first.input.id, { osEventId: "OSE-2" })?.osEventId).toBe("OSE-1");
  });
});

describe("inbox conversion", () => {
  beforeAll(() => {
    const insert = getSqlite().prepare(
      "insert into inbox_messages (id, run_id, role_id, channel, from_label, subject, body, received_at, revealed_at_moment, proposed_triage) values (?, 'run-001', 'tprm', 'mail', 'Sender', 's', 'b', '2026-10-06T07:00:00.000Z', '07:45', 'action')",
    );
    for (const id of ["IN-1", "IN-2"]) insert.run(id);
  });

  const stored = (id: string) =>
    getSqlite().prepare("select conversion_kind as kind, converted_by_user_id as by, converted_at as at from inbox_messages where id = ?").get(id);

  it("keeps the first conversion to work, and lets work replace a dismissal but never the reverse", () => {
    expect(recordInboxConversion("IN-1", { kind: "evidence", byUserId: "P-003", at: "2026-10-06T08:00:00.000Z" })).toStrictEqual({ changed: true });
    expect(recordInboxConversion("IN-1", { kind: "action", byUserId: "P-002", at: "2026-10-06T09:00:00.000Z" })).toStrictEqual({ changed: false });
    expect(recordInboxConversion("IN-1", { kind: "dismissed", byUserId: "P-002", at: "2026-10-06T10:00:00.000Z" })).toStrictEqual({ changed: false });
    expect(stored("IN-1")).toStrictEqual({ kind: "evidence", by: "P-003", at: "2026-10-06T08:00:00.000Z" });

    recordInboxConversion("IN-2", { kind: "dismissed", byUserId: "P-002", at: "2026-10-06T08:00:00.000Z" });
    recordInboxConversion("IN-2", { kind: "decision", byUserId: "P-002", at: "2026-10-06T11:00:00.000Z" });
    expect(stored("IN-2")).toStrictEqual({ kind: "decision", by: "P-002", at: "2026-10-06T11:00:00.000Z" });
    expect(recordInboxConversion("IN-NONE", { kind: "action", byUserId: null, at: AT })).toBeUndefined();
  });

  it("writes a classification with who confirmed it, when and why", () => {
    expect(recordTriageConfirmation("IN-1", { classification: "information", byUserId: "P-003", at: AT, reason: "Already in the pack." })).toBe(true);
    expect(
      getSqlite()
        .prepare("select confirmed_triage as triage, triage_confirmed_by_user_id as by, triage_confirmed_at as at, triage_reason as reason from inbox_messages where id = 'IN-1'")
        .get(),
    ).toStrictEqual({ triage: "information", by: "P-003", at: AT, reason: "Already in the pack." });
    expect(recordTriageConfirmation("IN-NONE", { classification: "noise", byUserId: null, at: AT, reason: null })).toBe(false);
  });
});

/* ==========================================================================
   Wave 5: personalisation
   ========================================================================== */

describe("personalisation", () => {
  it("merges preferences, and null returns a field to the product's default", () => {
    saveUserPreferences("P-003", { language: "de", theme: "dark" }, AT);
    saveUserPreferences("P-003", { defaultWorkTab: "actions", theme: null }, "2026-10-06T08:00:00.000Z");
    expect(getUserPreferences("P-003")).toMatchObject({ language: "de", theme: null, defaultWorkTab: "actions", notificationPreference: "standard" });
  });

  it("keeps one default view per surface and replaces a view of the same name", () => {
    const view = (id: string, name: string, isDefault: boolean) =>
      saveSavedView({ id, userId: "P-002", roleId: "tprm", surface: "work", name, filters: { view: "actions" }, isDefault, createdAt: AT, updatedAt: AT });
    view("SV-1", "Overdue", true);
    view("SV-2", "Veridian only", true);
    view("SV-1b", "Overdue", false);
    const views = listSavedViews("P-002", "tprm", "work");
    expect(views.map((row) => [row.id, row.isDefault])).toStrictEqual([
      ["SV-1", false],
      ["SV-2", true],
    ]);
    expect(deleteSavedView("SV-2", "P-003")).toBe(false);
    expect(deleteSavedView("SV-2", "P-002")).toBe(true);
  });

  it("keeps pinned, recent and watched objects once each, and trims a bounded list", () => {
    const key = { userId: "P-003", roleId: "rcsa" as const };
    addToObjectList({ ...key, list: "pinned", objectKind: "control", objectId: "CTL-PAY-014", touchedAt: AT });
    addToObjectList({ ...key, list: "pinned", objectKind: "control", objectId: "CTL-PAY-014", touchedAt: "2026-10-06T09:00:00.000Z" });
    addToObjectList({ ...key, list: "watchlist", objectKind: "supplier", objectId: "TP-0042", touchedAt: AT, note: "Committee item." });
    expect(listObjectList({ ...key, list: "pinned" })).toHaveLength(1);
    expect(listObjectList({ ...key, list: "pinned" })[0]?.touchedAt).toBe("2026-10-06T09:00:00.000Z");

    for (const [index, id] of ["A", "B", "C", "D"].entries()) {
      addToObjectList({ ...key, list: "recent", objectKind: "action", objectId: `MSN-${id}`, touchedAt: `2026-10-06T0${index + 1}:00:00.000Z` });
    }
    expect(trimObjectList({ ...key, list: "recent" }, 2)).toBe(2);
    expect(listObjectList({ ...key, list: "recent" }).map((row) => row.objectId)).toStrictEqual(["MSN-D", "MSN-C"]);
    expect(removeFromObjectList({ ...key, list: "watchlist", objectKind: "supplier", objectId: "TP-0042" })).toBe(true);
    expect(listObjectList({ ...key, list: "watchlist" })).toHaveLength(0);
  });
});
