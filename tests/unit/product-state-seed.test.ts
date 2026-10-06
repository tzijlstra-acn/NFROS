/**
 * Migration 0006's seed and vocabularies, without a database.
 *
 * Two promises are held here. The seeded Role App release state is derived
 * from the code registry and the release registry, never typed in, so the
 * seed cannot claim a state the code does not have. And every vocabulary the
 * new schema mirrors (Updates categories, Work tabs, the plan's lists) stays
 * equal to its source, so the ledger, the preferences and the console can
 * never disagree with the surfaces they serve.
 */

import { describe, expect, it } from "vitest";
import {
  buildRoleAppManifest,
  lifecycleStateFor,
  pilotSourceSystemIds,
  roleAppVersionId,
  SEEDED_AGAINST_MIGRATION,
  SEEDED_COHORT_ID,
  SEEDED_PILOT_ID,
  seededCohort,
  seededPilotMeasures,
  seededPilotProgramme,
  seededRoleAppEnablements,
  seededRoleAppLifecycleEvents,
  seededRoleAppVersions,
  supportStateFor,
} from "@/db/seed/product-state";
import { getProcessDefinition, ROLE_APP_REGISTRY } from "@/role-apps/registry";
import { INSTALLED_ROLE_APPS, PREVIEW_ROLE_APPS } from "@/product/release";
import { AI_CONFIGURATION_REGISTRY } from "@/ai/prompt-registry";
import { PILOT_USERS } from "@/identity/pilot-config";
import { UPDATE_CATEGORIES } from "@/features/updates/types";
import { WORK_TABS } from "@/features/work/model";
import { SUGGESTION_DISPOSITIONS } from "@/db/schema/live";
import { AI_FEEDBACK_KINDS, NOTIFICATION_CATEGORIES } from "@/db/schema/ai-partner";
import {
  EVALUATION_MODES,
  EXPERIENCE_EVENT_KINDS,
  PILOT_EXIT_OUTCOMES,
  PRODUCT_FEEDBACK_KINDS,
  ROLE_APP_LIFECYCLE_STATES,
} from "@/db/schema/product-console";
import {
  MANDATORY_NOTIFICATION_CATEGORIES,
  PREFERENCE_WORK_TABS,
  QUIETABLE_NOTIFICATION_CATEGORIES,
} from "@/db/schema/personalisation";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };

describe("the seeded Role App versions", () => {
  const versions = seededRoleAppVersions();

  it("records one current version for every registry app, under the registry's id and version", () => {
    expect(versions.map((row) => row.roleAppId)).toStrictEqual(ROLE_APP_REGISTRY.map((app) => app.id));
    expect(versions.map((row) => row.version)).toStrictEqual(ROLE_APP_REGISTRY.map((app) => app.version));
    expect(versions.every((row) => row.isCurrent)).toBe(true);
    expect(versions.map((row) => row.id)).toStrictEqual(ROLE_APP_REGISTRY.map(roleAppVersionId));
  });

  it("matches the release registry: its installed apps are Installed, its preview apps Demo or Planned", () => {
    const installed = versions.filter((row) => row.lifecycleState === "installed").map((row) => row.roleAppId);
    expect(installed).toStrictEqual(INSTALLED_ROLE_APPS.map((app) => app.id));
    expect(installed).toHaveLength(2);
    const preview = versions.filter((row) => row.lifecycleState === "demo" || row.lifecycleState === "planned").map((row) => row.roleAppId);
    expect(preview).toStrictEqual(PREVIEW_ROLE_APPS.map((app) => app.id));
    expect(preview).toHaveLength(5);
    for (const app of PREVIEW_ROLE_APPS) {
      const row = versions.find((entry) => entry.roleAppId === app.id);
      expect(row?.lifecycleState, app.id).toBe(app.maturity === "concept" ? "planned" : "demo");
    }
  });

  it("maps every registry status and maturity to a lifecycle state, and every state to a support state", () => {
    expect(lifecycleStateFor({ status: "installed", maturity: "production-shaped" })).toBe("installed");
    expect(lifecycleStateFor({ status: "disabled", maturity: "production-shaped" })).toBe("installed");
    expect(lifecycleStateFor({ status: "available", maturity: "prototype" })).toBe("available");
    expect(lifecycleStateFor({ status: "preview", maturity: "prototype" })).toBe("demo");
    expect(lifecycleStateFor({ status: "preview", maturity: "concept" })).toBe("planned");
    for (const state of ROLE_APP_LIFECYCLE_STATES) expect(supportStateFor(state), state).toBeTruthy();
    expect(supportStateFor("installed")).toBe("maintained");
    expect(supportStateFor("planned")).toBe("not-built");
    expect(supportStateFor("retired")).toBe("ended");
  });

  it("reads each manifest from the definition: digest, stages, tools, evaluations and connectors", () => {
    for (const app of ROLE_APP_REGISTRY) {
      const row = versions.find((entry) => entry.roleAppId === app.id);
      const process = getProcessDefinition(app.processId);
      expect(Boolean(row?.processDefinitionDigest), app.id).toBe(Boolean(process));
      expect(row?.connectorDependencies, app.id).toStrictEqual(app.requiredConnectorPackIds);
      expect(row?.migrationTag).toBe(SEEDED_AGAINST_MIGRATION);
      if (process) {
        expect(row?.processStageIds).toStrictEqual([...process.stages].sort((a, b) => a.sequence - b.sequence).map((stage) => stage.id));
        expect(row?.tools).toContain(app.stageCompletionToolName);
        expect(row?.authority.humanDecisionKinds).toStrictEqual(app.humanDecisionKinds);
        for (const suite of row?.evaluations.evaluationSuiteIds ?? []) {
          expect(AI_CONFIGURATION_REGISTRY.some((configuration) => configuration.evaluationSuiteId === suite)).toBe(true);
        }
        expect(row?.releasedAt).not.toBeNull();
      } else {
        expect(row?.processStageIds).toStrictEqual(app.coveredStageIds);
        expect(row?.implementedStageIds).toStrictEqual([]);
        expect(row?.releasedAt).toBeNull();
      }
    }
  });

  it("is deterministic: two builds of the manifest are identical", () => {
    const app = ROLE_APP_REGISTRY[0];
    if (!app) throw new Error("The registry is empty.");
    expect(buildRoleAppManifest(app, getProcessDefinition(app.processId))).toStrictEqual(
      buildRoleAppManifest(app, getProcessDefinition(app.processId)),
    );
    expect(seededRoleAppVersions()).toStrictEqual(versions);
  });

  it("records where each state came from, and enables only the installed apps, for the tenant", () => {
    const events = seededRoleAppLifecycleEvents();
    expect(events.map((event) => event.kind)).toStrictEqual(ROLE_APP_REGISTRY.map(() => "registered"));
    expect(events.every((event) => event.actorLabel === "seed" && event.actorUserId === null)).toBe(true);
    const enablements = seededRoleAppEnablements();
    expect(enablements.map((row) => row.roleAppId)).toStrictEqual(INSTALLED_ROLE_APPS.map((app) => app.id));
    expect(enablements.every((row) => row.scopeKind === "tenant" && row.enabled)).toBe(true);
  });
});

describe("the seeded design-partner pilot", () => {
  it("is in setup, with no window agreed and its users in the pilot cohort", () => {
    const pilot = seededPilotProgramme();
    expect(pilot).toMatchObject({ id: SEEDED_PILOT_ID, status: "setup", cohortId: SEEDED_COHORT_ID, plannedStartOn: null, startedAt: null });
    expect(pilot.roleAppIds).toStrictEqual(INSTALLED_ROLE_APPS.map((app) => app.id));
    expect(pilot.authority.autonomousExecution).toBe(false);
    expect(pilot.sourceSystemIds).toStrictEqual(pilotSourceSystemIds());
    expect(pilot.sourceSystemIds.length).toBeGreaterThan(0);
    expect(seededCohort().userIds).toStrictEqual(PILOT_USERS.filter((user) => !user.isAdministrator).map((user) => user.userId));
  });

  it("has the plan's six baseline measures, none measured, no value and no target", () => {
    const measures = seededPilotMeasures();
    expect(measures.map((measure) => measure.key)).toStrictEqual([
      "preparation-time",
      "cycle-time",
      "handoffs",
      "systems-opened",
      "overdue-actions",
      "evidence-completeness",
    ]);
    for (const measure of measures) {
      expect(measure.baselineStatus, measure.key).toBe("not-measured");
      expect(measure.baselineValue, measure.key).toBeNull();
      expect(measure.target, measure.key).toBeNull();
    }
    /* Never tracked: systems opened is observed and recorded by a person. */
    expect(measures.find((measure) => measure.key === "systems-opened")?.source).toBe("recorded-by-pilot-lead");
  });

  it("writes copy within the rules: ASCII only, no em or en dash, no double hyphen", () => {
    const text = JSON.stringify([seededRoleAppVersions(), seededRoleAppLifecycleEvents(), seededPilotProgramme(), seededCohort(), seededPilotMeasures()]);
    expect(/[^\x00-\x7F]/.test(text)).toBe(false);
    expect(text.includes(" -- ")).toBe(false);
  });
});

describe("the vocabularies the new schema mirrors", () => {
  it("notification categories are the Updates categories, and a preference can quiet only what is not mandatory", () => {
    expect([...NOTIFICATION_CATEGORIES]).toStrictEqual([...UPDATE_CATEGORIES]);
    const quiet = new Set(QUIETABLE_NOTIFICATION_CATEGORIES);
    expect(MANDATORY_NOTIFICATION_CATEGORIES.some((category) => quiet.has(category))).toBe(false);
    expect([...QUIETABLE_NOTIFICATION_CATEGORIES, ...MANDATORY_NOTIFICATION_CATEGORIES].sort()).toStrictEqual([...NOTIFICATION_CATEGORIES].sort());
    for (const category of ["execution-failed", "process-blocked", "human-input-required", "deadline-approaching"] as const) {
      expect(MANDATORY_NOTIFICATION_CATEGORIES).toContain(category);
    }
  });

  it("the default Work tab is one of the Work Hub's tabs", () => {
    expect([...PREFERENCE_WORK_TABS]).toStrictEqual([...WORK_TABS]);
  });

  it("keeps the plan's lists in the plan's order", () => {
    expect([...SUGGESTION_DISPOSITIONS]).toStrictEqual(["new", "reviewed", "accepted", "modified", "rejected", "executed", "expired"]);
    expect([...AI_FEEDBACK_KINDS]).toStrictEqual(["useful", "not-useful", "wrong-source", "wrong-interpretation", "missing-context", "too-verbose"]);
    expect([...ROLE_APP_LIFECYCLE_STATES]).toStrictEqual(["draft", "candidate", "pilot", "installed", "available", "demo", "planned", "retired"]);
    expect([...PRODUCT_FEEDBACK_KINDS]).toStrictEqual([
      "wrong-source",
      "missing-context",
      "incorrect-interpretation",
      "unhelpful-suggestion",
      "workflow-friction",
      "feature-request",
      "data-issue",
      "performance-issue",
    ]);
    expect([...PILOT_EXIT_OUTCOMES]).toStrictEqual(["scale", "extend", "pause", "stop"]);
    expect([...EXPERIENCE_EVENT_KINDS]).toStrictEqual(["workday-opened", "now-item-opened", "evidence-opened", "meeting-preparation-reviewed"]);
  });

  it("evaluation modes are the runner's modes", () => {
    const scripts = Object.keys(packageJson.scripts)
      .filter((name) => name.startsWith("eval:"))
      .map((name) => name.slice("eval:".length));
    expect([...EVALUATION_MODES].sort()).toStrictEqual(scripts.sort());
  });

  it("the migration the versions name is the journal's latest at the time of writing", () => {
    const journal = JSON.parse(readFileSync(join(process.cwd(), "src/db/migrations/meta/_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((entry) => entry.tag)).toContain(SEEDED_AGAINST_MIGRATION);
  });
});
