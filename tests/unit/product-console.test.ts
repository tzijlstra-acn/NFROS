/**
 * The Product Owner Console's pure rules (os-console-core): the persona
 * permission map, the approval check, the acting identity, the console
 * navigation, version comparison, the evaluation verdict, the performance
 * pairing, the experience delay, the CHANGELOG reading and the migration
 * comparison. No database.
 */

import { describe, expect, it } from "vitest";
import { AUTHORITY_SCOPES } from "@/server/security/authority";
import {
  CONSOLE_ACTIONS,
  CONSOLE_SCOPES,
  PRODUCT_PERSONAS,
  PRODUCT_PERSONA_IDS,
  checkConsolePermission,
  personaCan,
  personaForUserId,
  personasWithScope,
  type ConsoleActionId,
} from "@/features/product/permissions";
import { checkConsoleApproval, fingerprintConsoleChange, MIN_RATIONALE_LENGTH } from "@/features/product/governance";
import { actingIdentityFromSession } from "@/features/product/persona/acting";
import { CONSOLE_SECTIONS, isSectionCurrent } from "@/features/product/shell/nav";
import { formGate } from "@/features/product/forms/gate";
import { compareRoleAppVersions } from "@/features/product/role-apps/compare";
import { evaluationVerdict } from "@/features/product/role-apps/evaluations";
import { compareVersionNumbers, parseVersion, suggestNextVersion } from "@/features/product/role-apps/lifecycle";
import { computeRoleAppPerformance, formatDuration, median } from "@/features/product/role-apps/performance";
import { firstActionDelays } from "@/features/product/experience/analytics";
import { changelogBullets } from "@/features/product/overview/model";
import { compareMigrations } from "@/features/product/releases/migrations";
import { gatePasses } from "@/features/product/releases/gate";
import type { ProductSession } from "@/identity/types";
import type { RoleAppVersion } from "@/db/repositories/role-app-release";
import type { AIEvaluationRun } from "@/db/repositories/ai-evaluations";

describe("product-owner personas and permissions", () => {
  it("defines the eight personas of plan 6.1, each able to read the console", () => {
    expect(PRODUCT_PERSONA_IDS).toHaveLength(8);
    for (const id of PRODUCT_PERSONA_IDS) {
      expect(PRODUCT_PERSONAS[id].scopes).toContain("console.read");
      expect(PRODUCT_PERSONAS[id].owns.length).toBeGreaterThan(0);
    }
  });

  it("gives every console action a scope that some persona holds", () => {
    for (const action of Object.values(CONSOLE_ACTIONS)) {
      expect(CONSOLE_SCOPES).toContain(action.scope);
      expect(personasWithScope(action.scope).length).toBeGreaterThan(0);
    }
  });

  it("holds no workday authority scope, so no persona can make a judgment about risk", () => {
    for (const id of PRODUCT_PERSONA_IDS) {
      for (const scope of PRODUCT_PERSONAS[id].scopes) expect((AUTHORITY_SCOPES as readonly string[]).includes(scope)).toBe(false);
    }
  });

  it("separates duties: who prepares a release cannot approve it", () => {
    expect(personaCan("role-app-owner", "role-app.create-candidate").allowed).toBe(true);
    expect(personaCan("role-app-owner", "role-app.approve-release").allowed).toBe(false);
    expect(personaCan("platform-product-owner", "role-app.approve-release").allowed).toBe(true);
    expect(personaCan("platform-product-owner", "role-app.create-candidate").allowed).toBe(false);
    expect(personaCan("operations-owner", "role-app.disable").allowed).toBe(true);
    expect(personaCan("operations-owner", "role-app.enable").allowed).toBe(false);
    expect(personaCan("operations-owner", "release.deploy").allowed).toBe(true);
    expect(personaCan("platform-product-owner", "release.deploy").allowed).toBe(false);
    expect(personaCan("pilot-lead", "pilot.record-exit-decision").allowed).toBe(true);
  });

  it("refuses with no persona, and names the holders when the scope is missing", () => {
    const none = checkConsolePermission(null, "role-app.disable");
    expect(none.allowed).toBe(false);
    if (!none.allowed) expect(none.code).toBe("no-persona");
    const wrong = personaCan("pilot-lead", "role-app.disable");
    expect(wrong.allowed).toBe(false);
    if (!wrong.allowed) {
      expect(wrong.code).toBe("missing-scope");
      expect(wrong.reason.en).toContain("Tenant Administrator");
    }
    expect(formGate(null, "role-app.disable", "en").blockedReason).toBeNull();
    expect(formGate(PRODUCT_PERSONAS["pilot-lead"].scopes, "role-app.disable", "de").blockedReason).toMatch(/^Befugt: /);
  });

  it("marks the plan's material actions as material", () => {
    const material: ConsoleActionId[] = [
      "role-app.assign-pilot-cohort",
      "role-app.approve-release",
      "role-app.enable",
      "role-app.disable",
      "role-app.roll-back",
      "role-app.retire",
      "release.approve-pilot",
      "release.deploy",
      "release.roll-back",
    ];
    for (const id of material) expect(CONSOLE_ACTIONS[id].material).toBe(true);
    expect(CONSOLE_ACTIONS["release.run-gate"].material).toBe(false);
  });
});

describe("payload bound approval", () => {
  const fingerprint = fingerprintConsoleChange("role-app.disable", { roleAppId: "rcsa-cycle-assistant", currentState: "enabled" });
  const rationale = "x".repeat(MIN_RATIONALE_LENGTH);

  it("binds to the change: a different state gives a different fingerprint", () => {
    expect(fingerprintConsoleChange("role-app.disable", { roleAppId: "rcsa-cycle-assistant", currentState: "disabled" })).not.toBe(fingerprint);
  });

  it("refuses a missing, mismatched or unconfirmed approval and accepts a confirmed one", () => {
    expect(checkConsoleApproval(null, fingerprint)).toMatchObject({ ok: false, code: "approval-missing" });
    expect(checkConsoleApproval({ reviewedFingerprint: "other", rationale, rationaleConfirmed: true }, fingerprint)).toMatchObject({
      ok: false,
      code: "approval-payload-mismatch",
    });
    expect(checkConsoleApproval({ reviewedFingerprint: fingerprint, rationale, rationaleConfirmed: false }, fingerprint)).toMatchObject({
      ok: false,
      code: "approval-not-confirmed",
    });
    expect(checkConsoleApproval({ reviewedFingerprint: fingerprint, rationale: "short", rationaleConfirmed: true }, fingerprint)).toMatchObject({
      ok: false,
      code: "approval-not-confirmed",
    });
    expect(checkConsoleApproval({ reviewedFingerprint: fingerprint, rationale, rationaleConfirmed: true }, fingerprint)).toEqual({ ok: true });
  });
});

describe("the acting identity", () => {
  const session = (userId: string, authorityScopes: string[]): ProductSession => ({
    sessionId: "S",
    userId,
    displayName: "Someone",
    organisationId: "ORG-DEMO",
    legalEntityIds: [],
    roleIds: [],
    authorityScopes,
    isAdministrator: false,
    productMode: "demonstration",
    issuedAt: "2026-10-06T00:00:00.000Z",
    expiresAt: "2026-10-06T08:00:00.000Z",
  });

  it("is nobody without a session", () => {
    expect(actingIdentityFromSession(null, "demonstration")).toMatchObject({ source: "none", scopes: null, switchingAllowed: true });
  });

  it("reads a persona's scopes from code, not from the cookie", () => {
    const identity = actingIdentityFromSession(session("DEMO-PO-TENANT", ["release.deploy"]), "demonstration");
    expect(identity.persona?.id).toBe("tenant-administrator");
    expect(identity.scopes).toEqual(PRODUCT_PERSONAS["tenant-administrator"].scopes);
    expect(identity.scopes).not.toContain("release.deploy");
  });

  it("gives another account only the console scopes its session carries", () => {
    const identity = actingIdentityFromSession(session("PILOT-ADM", ["evidence.read", "release.gate.run"]), "design-partner");
    expect(identity.source).toBe("account-without-persona");
    expect(identity.scopes).toEqual(["release.gate.run"]);
    expect(identity.switchingAllowed).toBe(false);
    expect(personaForUserId("PILOT-ADM")).toBeNull();
  });
});

describe("the console navigation", () => {
  it("lists the plan's nine primary sections in order", () => {
    expect(CONSOLE_SECTIONS.filter((section) => section.tier === "primary").map((section) => section.label.en)).toEqual([
      "Overview",
      "Role Apps",
      "Experience",
      "Quality",
      "Value",
      "Integrations",
      "Releases",
      "Pilot",
      "Operations",
    ]);
  });

  it("marks the Overview current only on /product itself", () => {
    const overview = CONSOLE_SECTIONS[0]!;
    expect(isSectionCurrent(overview, "/product")).toBe(true);
    expect(isSectionCurrent(overview, "/product/releases")).toBe(false);
  });
});

const version = (patch: Partial<RoleAppVersion>): RoleAppVersion =>
  ({
    id: "RAV-x-1.0.0",
    roleAppId: "x",
    roleId: "rcsa",
    version: "1.0.0",
    lifecycleState: "installed",
    isCurrent: true,
    processId: "p",
    processDefinitionDigest: "abc",
    processStageIds: ["a", "b"],
    implementedStageIds: ["a"],
    sourceRequirements: [],
    tools: ["t1"],
    authority: { stageCompletionToolName: null, approvalTools: [], humanDecisionKinds: [] },
    evaluations: { configurationIds: ["cfg-1"], evaluationSuiteIds: [] },
    connectorDependencies: [],
    migrationTag: "0008",
    releaseNotes: "n",
    releaseNotesDe: "n",
    supportState: "maintained",
    evaluationRunId: null,
    approvalId: null,
    createdAt: "2026-10-06T00:00:00.000Z",
    createdByLabel: "seed",
    releasedAt: null,
    ...patch,
  }) as RoleAppVersion;

describe("Role App versions", () => {
  it("compares two versions field by field, with added and removed", () => {
    const rows = compareRoleAppVersions(version({}), version({ version: "1.1.0", tools: ["t1", "t2"], lifecycleState: "candidate" }), "en");
    const tools = rows.find((row) => row.key === "tools")!;
    expect(tools.changed).toBe(true);
    expect(tools.added).toEqual(["t2"]);
    expect(rows.find((row) => row.key === "digest")!.changed).toBe(false);
  });

  it("suggests the next minor version and parses only three numbers", () => {
    expect(suggestNextVersion([{ version: "1.0.0" }, { version: "1.2.0" }])).toBe("1.3.0");
    expect(parseVersion("1.1")).toBeNull();
    expect(compareVersionNumbers([1, 1, 0], [1, 0, 9])).toBeGreaterThan(0);
  });

  it("needs a completed run per configuration and no mandatory failure to pass", () => {
    const run = (patch: Partial<AIEvaluationRun>) => ({ configurationId: "cfg-1", status: "completed", mandatoryFailed: 0, ...patch }) as AIEvaluationRun;
    expect(evaluationVerdict(version({}), []).kind).toBe("not-evaluated");
    expect(evaluationVerdict(version({}), [run({ mandatoryFailed: 2 })]).kind).toBe("failed");
    expect(evaluationVerdict(version({}), [run({ status: "running" })]).kind).toBe("running");
    expect(evaluationVerdict(version({}), [run({})]).kind).toBe("passed");
    expect(evaluationVerdict(version({ evaluations: { configurationIds: [], evaluationSuiteIds: [] } }), []).kind).toBe("no-configurations");
  });
});

describe("Role App performance", () => {
  const performance = computeRoleAppPerformance({
    runs: [
      { id: "R1", status: "completed", startedAt: "2026-10-01T08:00:00.000Z", completedAt: "2026-10-03T08:00:00.000Z" },
      { id: "R2", status: "in-progress", startedAt: "2026-10-05T08:00:00.000Z", completedAt: null },
    ],
    stageRuns: [
      { id: "S1", roleAppRunId: "R1", stageId: "a", status: "completed", openedAt: "2026-10-01T08:00:00.000Z", completedAt: "2026-10-01T10:00:00.000Z" },
      { id: "S2", roleAppRunId: "R2", stageId: "a", status: "ready", openedAt: "2026-10-05T08:00:00.000Z", completedAt: null },
    ],
    events: [
      { type: "human-task-created", idempotencyKey: "human-task-created:S1:task:x", occurredAt: "2026-10-01T08:00:00.000Z", processRunId: "R1", stageId: "a" },
      { type: "human-task-completed", idempotencyKey: "human-task-completed:S1:task:x:r1", occurredAt: "2026-10-01T08:30:00.000Z", processRunId: "R1", stageId: "a" },
      { type: "human-task-completed", idempotencyKey: "human-task-completed:S1:task:x:r2", occurredAt: "2026-10-01T09:30:00.000Z", processRunId: "R1", stageId: "a" },
      { type: "ai-preparation-started", idempotencyKey: "ai-preparation-started:J1:a1", occurredAt: "2026-10-01T08:00:00.000Z", processRunId: "R1", stageId: "a" },
      { type: "ai-preparation-held", idempotencyKey: "ai-preparation-held:J1:source:a1", occurredAt: "2026-10-01T08:01:00.000Z", processRunId: "R1", stageId: "a" },
      { type: "ai-preparation-completed", idempotencyKey: "ai-preparation-completed:J1", occurredAt: "2026-10-01T08:11:00.000Z", processRunId: "R1", stageId: "a" },
      { type: "ai-preparation-started", idempotencyKey: "ai-preparation-started:J2:a1", occurredAt: "2026-10-05T08:00:00.000Z", processRunId: "R2", stageId: "a" },
      { type: "ai-preparation-failed", idempotencyKey: "ai-preparation-failed:J2", occurredAt: "2026-10-05T08:05:00.000Z", processRunId: "R2", stageId: "a" },
    ],
    measuredAt: "2026-10-06T08:00:00.000Z",
  });

  it("counts runs and measures cycle and stage time", () => {
    expect(performance.runsStarted).toBe(2);
    expect(performance.runsCompleted).toBe(1);
    expect(performance.cycleTime.medianMs).toBe(2 * 24 * 3600 * 1000);
    expect(performance.stages[0]).toMatchObject({ stageId: "a", completed: 1, open: 1 });
  });

  it("pairs a task with its first completion, and a source hold with the job's completion", () => {
    expect(performance.humanTaskTime.medianMs).toBe(30 * 60 * 1000);
    expect(performance.sourceDelay.medianMs).toBe(10 * 60 * 1000);
    expect(performance.failureRate).toEqual({ numerator: 1, denominator: 2, rate: 0.5 });
    expect(performance.resumeRate).toEqual({ numerator: 1, denominator: 1, rate: 1 });
  });

  it("says not measured rather than zero when nothing is paired", () => {
    expect(performance.decisionDelay.measured).toBe(false);
    expect(performance.approvalDelay.medianMs).toBeNull();
    expect(median([])).toBeNull();
    expect(formatDuration(90 * 60 * 1000, "en")).toBe("1.5 h");
  });
});

describe("experience, overview and release readings", () => {
  it("measures time to first action per role and day, never per person", () => {
    const delays = firstActionDelays(
      [
        { roleId: "rcsa", occurredAt: "2026-10-06T08:00:00.000Z" },
        { roleId: "rcsa", occurredAt: "2026-10-06T09:00:00.000Z" },
      ],
      [
        { roleId: "rcsa", occurredAt: "2026-10-06T07:00:00.000Z" },
        { roleId: "rcsa", occurredAt: "2026-10-06T08:05:00.000Z" },
        { roleId: "tprm", occurredAt: "2026-10-06T08:01:00.000Z" },
      ],
    );
    expect(delays).toEqual([5 * 60 * 1000]);
  });

  it("reads the top-level bullets of one CHANGELOG version, with wrapped lines", () => {
    const markdown = "## [4.1.0] - 2026-10-05\n\n### Added\n\n- First item\n  continues here\n  - nested\n- Second\n\n## [4.0.0]\n\n- Old\n";
    expect(changelogBullets(markdown, "4.1.0")).toEqual(["First item continues here", "Second"]);
    expect(changelogBullets(markdown, "9.9.9")).toEqual([]);
  });

  it("finds pending migrations by generation time", () => {
    const state = compareMigrations(
      [
        { idx: 0, tag: "0000_a", when: 1 },
        { idx: 1, tag: "0001_b", when: 2 },
      ],
      new Set([1]),
    );
    expect(state.pending.map((entry) => entry.tag)).toEqual(["0001_b"]);
    expect(compareMigrations(null, null).journalReadable).toBe(false);
  });

  it("passes the gate only when every mandatory check passed", () => {
    const base = { label: "x", detail: "", evidenceRef: null, durationMs: null };
    expect(gatePasses([{ ...base, gateKey: "a", mandatory: true, status: "passed" }, { ...base, gateKey: "b", mandatory: false, status: "not-run" }])).toBe(true);
    expect(gatePasses([{ ...base, gateKey: "a", mandatory: true, status: "not-run" }])).toBe(false);
  });
});
