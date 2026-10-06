/**
 * The seeded day and `demo:reset` for migration 0006.
 *
 * Seeds a temporary database with the full scenario, the path `db:seed` and
 * `demo:reset` both take, and checks that the new tables hold exactly what an
 * honest demonstration needs: the Role App release state of the code
 * registry, one pilot in setup with nothing measured, three dated decisions,
 * every suggestion still new, and every other new table empty. Then it writes
 * the kind of rows a demonstration leaves behind into every scope, reseeds,
 * and checks that the day is restored.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario, type SeedSummary } from "@/db/seed/run";
import { SEEDED_PILOT_ID } from "@/db/seed/product-state";
import { ROLE_APP_REGISTRY } from "@/role-apps/registry";
import { INSTALLED_ROLE_APPS } from "@/product/release";
import { recordAIFeedback } from "@/db/repositories/ai-feedback";
import { recordNotification } from "@/db/repositories/notifications";
import { submitProductFeedback } from "@/db/repositories/product-feedback";
import { recordPilotMeasureReading, listPilotMeasures } from "@/db/repositories/pilot";
import { createRoleAppVersion, getCurrentRoleAppVersion } from "@/db/repositories/role-app-release";
import { saveUserPreferences } from "@/db/repositories/personalisation";
import { recordExperienceEvent } from "@/db/repositories/experience-events";
import { addStageInput } from "@/db/repositories/process-stage-inputs";

/** New tables a fresh seed leaves empty: nothing has happened in them yet. */
const EMPTY_AFTER_SEED = [
  "ai_routine_runs", "ai_routine_run_outputs", "ai_suggestion_dispositions", "ai_feedback", "partner_contexts",
  "notifications", "ai_evaluation_runs", "ai_evaluation_case_results", "ai_configuration_releases",
  "product_feedback", "pilot_measure_readings", "pilot_issues", "pilot_exit_decisions", "product_release_events",
  "release_gate_runs", "integration_incidents", "data_quality_issues", "experience_events", "user_preferences",
  "saved_views", "user_object_lists", "process_stage_inputs",
] as const;

const AT = "2026-10-06T08:00:00.000Z";
let first: SeedSummary;

beforeAll(() => {
  createTemporaryDatabase("data-model-seed");
  first = seedScenario();
}, 600_000);

afterAll(() => {
  destroyTemporaryDatabase();
});

describe("the seeded day, migration 0006", () => {
  it("records one current version per registry app, the installed two enabled for the tenant", () => {
    expect(rowCount("role_app_versions")).toBe(ROLE_APP_REGISTRY.length);
    const states = Object.fromEntries(
      (getSqlite().prepare("select role_app_id as id, lifecycle_state as state from role_app_versions where is_current = 1").all() as Array<{ id: string; state: string }>).map(
        (row) => [row.id, row.state],
      ),
    );
    expect(Object.keys(states).sort()).toStrictEqual(ROLE_APP_REGISTRY.map((app) => app.id).sort());
    expect(Object.entries(states).filter(([, state]) => state === "installed").map(([id]) => id).sort()).toStrictEqual(
      INSTALLED_ROLE_APPS.map((app) => app.id).sort(),
    );
    expect(rowCount("role_app_lifecycle_events")).toBe(ROLE_APP_REGISTRY.length);
    const enabled = (getSqlite().prepare("select role_app_id as id from role_app_enablements where enabled = 1 and scope_kind = 'tenant' order by id").all() as Array<{ id: string }>).map(
      (row) => row.id,
    );
    expect(enabled).toStrictEqual(INSTALLED_ROLE_APPS.map((app) => app.id).sort());
  });

  it("holds one pilot in setup, its cohort, and six baselines that nobody has measured", () => {
    expect(getSqlite().prepare("select status from pilot_programmes").all()).toStrictEqual([{ status: "setup" }]);
    expect(rowCount("product_cohorts")).toBe(1);
    expect(getSqlite().prepare("select count(*) as n from pilot_measures where baseline_status = 'not-measured' and baseline_value is null and target is null").get()).toStrictEqual({ n: 6 });
  });

  it("dates three decisions from their own text, and leaves every suggestion new", () => {
    expect(getSqlite().prepare("select id from decisions where due_at is not null order by id").all()).toStrictEqual([
      { id: "DEC-2026-0745" },
      { id: "DEC-2026-0772" },
      { id: "DEC-2026-0782" },
    ]);
    expect(getSqlite().prepare("select count(*) as n from ai_suggestions where disposition <> 'new'").get()).toStrictEqual({ n: 0 });
    expect(rowCount("ai_suggestions")).toBeGreaterThan(0);
  });

  it("stores no inbox lineage before a person acts, and seeds only ordinary collaboration messages (migration 0008)", () => {
    expect(
      getSqlite()
        .prepare(
          "select count(*) as n from inbox_messages where conversion_kind is not null or converted_at is not null or triage_confirmed_at is not null or linked_evidence_document_id is not null or delegated_to_user_id is not null",
        )
        .get(),
    ).toStrictEqual({ n: 0 });
    expect(getSqlite().prepare("select distinct kind from collaboration_messages").all()).toStrictEqual([{ kind: "message" }]);
  });

  it("links the five decisions the RCSA contract binds to the Q4 run (migration 0007)", () => {
    expect(
      getSqlite().prepare("select id, process_run_id as run, process_stage_id as stage from decisions where process_run_id is not null order by id").all(),
    ).toStrictEqual([
      { id: "DEC-2026-0744", run: "RUN-RCSA-PAYOPS-Q4-2026", stage: "risk-control-change" },
      { id: "DEC-2026-0745", run: "RUN-RCSA-PAYOPS-Q4-2026", stage: "first-line-input" },
      { id: "DEC-2026-0771", run: "RUN-RCSA-PAYOPS-Q4-2026", stage: "evidence-refresh" },
      { id: "DEC-2026-0772", run: "RUN-RCSA-PAYOPS-Q4-2026", stage: "challenge-workshop" },
      { id: "DEC-2026-0782", run: "RUN-RCSA-PAYOPS-Q4-2026", stage: "actions-approval" },
    ]);
  });

  it("leaves every record of things not yet done empty", () => {
    for (const table of EMPTY_AFTER_SEED) expect(rowCount(table), table).toBe(0);
    expect(first.counts["productState"]).toBe(ROLE_APP_REGISTRY.length * 2 + INSTALLED_ROLE_APPS.length + 1 + 1 + 6);
  });

  it("restores the seeded day on a reseed, whatever a demonstration wrote", () => {
    /* Scenario scope. */
    recordAIFeedback({
      id: "AIF-1",
      roleId: "rcsa",
      userId: "P-003",
      kind: "useful",
      targetKind: "chat-turn",
      targetId: "CT-1",
      taskKind: "chat-answer",
      sourceRefs: [],
      atMoment: "08:00",
      createdAt: AT,
    });
    recordNotification({
      id: "NTF-1",
      roleId: "rcsa",
      category: "human-input-required",
      dedupeKey: "task:1",
      sourceKind: "backbone",
      sourceId: "OSE-1",
      budgetOutcome: "raised",
      raisedAt: AT,
      raisedAtMoment: "08:00",
    });
    saveUserPreferences("P-003", { language: "de" }, AT);
    recordExperienceEvent({ id: "XE-1", kind: "workday-opened", roleId: "rcsa", mode: "safe", atMoment: "08:00", occurredAt: AT, idempotencyKey: "XE-1" });
    addStageInput({
      processRunId: "RUN-RCSA-PAYOPS-Q4-2026",
      stageId: "evidence-refresh",
      sourceKind: "message",
      sourceId: "IMSG-2026-0023",
      addedByUserId: "P-003",
      addedAt: AT,
      addedAtMoment: "08:00",
    });
    getSqlite().prepare("update ai_suggestions set disposition = 'rejected'").run();
    /* Product scope. */
    submitProductFeedback({ id: "PFB-1", kind: "workflow-friction", summary: "Too many clicks to confirm.", submittedAt: AT });
    const measure = listPilotMeasures(SEEDED_PILOT_ID)[0];
    if (!measure) throw new Error("No pilot measure.");
    recordPilotMeasureReading({
      id: "PMR-1",
      pilotId: SEEDED_PILOT_ID,
      measureId: measure.id,
      weekStarting: "2026-10-12",
      status: "measured",
      value: 30,
      source: "recorded-by-pilot-lead",
      recordedAt: AT,
      recordedByLabel: "Pilot lead",
    });
    const current = getCurrentRoleAppVersion("rcsa-cycle-assistant");
    if (!current) throw new Error("No current version.");
    createRoleAppVersion(
      { ...current, id: "RAV-rcsa-cycle-assistant-1.1.0", version: "1.1.0", lifecycleState: "candidate" },
      { actorKind: "human", actorUserId: null, actorLabel: "Product owner", at: AT },
    );
    expect(rowCount("role_app_versions")).toBe(ROLE_APP_REGISTRY.length + 1);

    const second = seedScenario();

    for (const table of EMPTY_AFTER_SEED) expect(rowCount(table), table).toBe(0);
    expect(rowCount("role_app_versions")).toBe(ROLE_APP_REGISTRY.length);
    expect(rowCount("role_app_lifecycle_events")).toBe(ROLE_APP_REGISTRY.length);
    expect(getSqlite().prepare("select count(*) as n from ai_suggestions where disposition <> 'new'").get()).toStrictEqual({ n: 0 });
    expect(second.counts["productState"]).toBe(first.counts["productState"]);
    expect(second.counts).toStrictEqual(first.counts);
  }, 600_000);
});
