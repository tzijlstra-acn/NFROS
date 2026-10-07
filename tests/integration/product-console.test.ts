/**
 * The Product Owner Console's governed actions against a migrated database
 * (os-console-core).
 *
 * The acting persona is the one seam mocked: the session cookie needs a
 * request, so `readActingConsoleIdentity` returns the persona a test sets.
 * Everything else is real: the governed path, the audit rows, the release
 * records, the enablement check the process pages call, the release gate's
 * rule and the release events.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import type { ActingConsoleIdentity } from "@/features/product/persona/acting";
import type { ProductPersonaId } from "@/features/product/permissions";

const acting: { persona: ProductPersonaId | null } = { persona: null };

vi.mock("@/features/product/persona/acting", async () => {
  const permissions = await vi.importActual<typeof import("@/features/product/permissions")>("@/features/product/permissions");
  const identity = (): ActingConsoleIdentity => {
    const persona = acting.persona ? permissions.PRODUCT_PERSONAS[acting.persona] : null;
    return {
      source: persona ? "demonstration-persona" : "none",
      persona,
      userId: persona?.demoUserId ?? null,
      displayName: persona?.label.en ?? null,
      scopes: persona ? persona.scopes : null,
      productMode: "demonstration",
      switchingAllowed: true,
    };
  };
  return {
    readActingConsoleIdentity: async () => identity(),
    actingIdentityFromSession: () => identity(),
    actingLabel: (value: ActingConsoleIdentity) => (value.persona ? `${value.persona.label.en} (demonstration persona)` : "nobody"),
  };
});

const { getSqlite } = await import("@/db/client");
const { seedProductState } = await import("@/db/seed/product-state");
const { readRoleAppAvailability } = await import("@/role-apps/enablement");
const { getCurrentRoleAppVersion, listRoleAppLifecycleEvents, getRoleAppVersion } = await import("@/db/repositories/role-app-release");
const { createEvaluationRun } = await import("@/db/repositories/ai-evaluations");
const { startReleaseGateRun, completeReleaseGateRun, getDeployedRelease } = await import("@/db/repositories/release-management");
const lifecycle = await import("@/features/product/role-apps/lifecycle");
const release = await import("@/features/product/releases/release");
const { recordReleaseEvent } = await import("@/db/repositories/release-management");

const RCSA = "rcsa-cycle-assistant";
const rationale = "Containing a defect found during the pilot.";

function audit(action: string): Array<{ category: string; blocked: number; approval_id: string | null }> {
  return getSqlite()
    .prepare("SELECT category, blocked, approval_id FROM audit_events WHERE action = ? ORDER BY recorded_at, id")
    .all(`console:${action}`) as Array<{ category: string; blocked: number; approval_id: string | null }>;
}

beforeAll(() => {
  createTemporaryDatabase("product-console");
  seedProductState();
});

afterAll(() => destroyTemporaryDatabase());

beforeEach(() => {
  acting.persona = null;
});

describe("enable and disable", () => {
  it("refuses with no persona and with the wrong persona, and audits both refusals", async () => {
    const proposal = lifecycle.proposeEnablement(RCSA, false);
    const approval = { reviewedFingerprint: proposal.fingerprint, rationale, rationaleConfirmed: true };
    expect(await lifecycle.setTenantEnablement(RCSA, false, approval)).toMatchObject({ ok: false, code: "no-persona" });
    acting.persona = "pilot-lead";
    expect(await lifecycle.setTenantEnablement(RCSA, false, approval)).toMatchObject({ ok: false, code: "missing-scope" });
    expect(audit("role-app.disable").filter((row) => row.blocked === 1)).toHaveLength(2);
    expect(readRoleAppAvailability(RCSA).runnable).toBe(true);
  });

  it("needs a payload bound approval, then really disables the app for the process pages", async () => {
    acting.persona = "tenant-administrator";
    expect(await lifecycle.setTenantEnablement(RCSA, false, { reviewedFingerprint: "", rationale: "", rationaleConfirmed: false })).toMatchObject({
      ok: false,
      code: "approval-missing",
    });
    expect(await lifecycle.setTenantEnablement(RCSA, false, { reviewedFingerprint: "stale", rationale, rationaleConfirmed: true })).toMatchObject({
      ok: false,
      code: "approval-payload-mismatch",
    });
    const proposal = lifecycle.proposeEnablement(RCSA, false);
    const result = await lifecycle.setTenantEnablement(RCSA, false, { reviewedFingerprint: proposal.fingerprint, rationale, rationaleConfirmed: true });
    expect(result.ok).toBe(true);

    const availability = readRoleAppAvailability(RCSA);
    expect(availability).toMatchObject({ runnable: false, state: "disabled", changeReason: rationale });

    const rows = audit("role-app.disable").filter((row) => row.blocked === 0);
    expect(rows.map((row) => row.category)).toEqual(["approval", "mutation"]);
    expect(rows[1]?.approval_id).toBeTruthy();
    const event = listRoleAppLifecycleEvents(RCSA).at(-1);
    expect(event).toMatchObject({ kind: "disabled", approvalId: rows[1]?.approval_id });

    /* Repeating the same approval is refused: the state it was bound to has changed. */
    expect(await lifecycle.setTenantEnablement(RCSA, false, { reviewedFingerprint: proposal.fingerprint, rationale, rationaleConfirmed: true })).toMatchObject({
      ok: false,
    });
  });

  it("enables it again", async () => {
    acting.persona = "tenant-administrator";
    const proposal = lifecycle.proposeEnablement(RCSA, true);
    expect((await lifecycle.setTenantEnablement(RCSA, true, { reviewedFingerprint: proposal.fingerprint, rationale, rationaleConfirmed: true })).ok).toBe(true);
    expect(readRoleAppAvailability(RCSA).runnable).toBe(true);
  });

  it("never makes a catalogue entry runnable", () => {
    expect(readRoleAppAvailability("rcsa-rapid-assessment")).toMatchObject({ runnable: false, state: "not-installed" });
    expect(lifecycle.proposeEnablement("rcsa-rapid-assessment", true).blocked).not.toBeNull();
  });
});

describe("candidate, evaluation, release and roll back", () => {
  it("creates a candidate from the reviewed definition, and refuses its release until it is evaluated", async () => {
    acting.persona = "role-app-owner";
    const created = await lifecycle.createCandidateVersion(RCSA, { version: "1.1.0", notes: "Candidate for the pilot cohort.", notesDe: "Kandidat fuer die Pilotkohorte." });
    expect(created.ok).toBe(true);
    const candidate = getRoleAppVersion("RAV-rcsa-cycle-assistant-1.1.0");
    expect(candidate).toMatchObject({ lifecycleState: "candidate", isCurrent: false });
    expect(candidate?.processDefinitionDigest).toBe(getCurrentRoleAppVersion(RCSA)?.processDefinitionDigest);

    acting.persona = "platform-product-owner";
    const proposal = lifecycle.proposeApproveRelease("RAV-rcsa-cycle-assistant-1.1.0");
    expect(proposal.blocked?.en).toContain("No completed evaluation");
    expect(
      await lifecycle.approveRoleAppRelease("RAV-rcsa-cycle-assistant-1.1.0", { reviewedFingerprint: proposal.fingerprint, rationale, rationaleConfirmed: true }),
    ).toMatchObject({ ok: false, code: "rule" });
  });

  it("runs the candidate's evaluations through the quality service, one run per configuration", async () => {
    acting.persona = "role-app-owner";
    const result = await lifecycle.runVersionEvaluations("RAV-rcsa-cycle-assistant-1.1.0");
    const candidate = getRoleAppVersion("RAV-rcsa-cycle-assistant-1.1.0")!;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(candidate.evaluations.configurationIds.length);
    const recorded = getSqlite()
      .prepare("SELECT count(*) AS n FROM ai_evaluation_runs WHERE role_app_version_id = ?")
      .get(candidate.id) as { n: number };
    expect(recorded.n).toBe(candidate.evaluations.configurationIds.length);
    getSqlite().prepare("DELETE FROM ai_evaluation_case_results").run();
    getSqlite().prepare("DELETE FROM ai_evaluation_runs").run();
  });

  it("releases an evaluated candidate and rolls it back", async () => {
    const candidate = getRoleAppVersion("RAV-rcsa-cycle-assistant-1.1.0")!;
    for (const [index, configurationId] of candidate.evaluations.configurationIds.entries()) {
      createEvaluationRun({
        id: `AER-test-${index}`,
        configurationId,
        configurationStatus: "candidate",
        roleId: "rcsa",
        taskKind: "stage-preparation",
        promptVersion: "v1.0",
        modelProfileId: "gpt-4o-mini-structured",
        outputSchemaVersion: "1",
        evaluationSuiteId: "suite",
        roleAppVersionId: candidate.id,
        mode: "structural",
        status: "completed",
        totalCases: 1,
        passed: 1,
        triggeredByLabel: "test",
        startedAt: "2026-10-06T09:00:00.000Z",
        completedAt: "2026-10-06T09:01:00.000Z",
      });
    }
    acting.persona = "platform-product-owner";
    const proposal = lifecycle.proposeApproveRelease(candidate.id);
    expect(proposal.blocked).toBeNull();
    expect((await lifecycle.approveRoleAppRelease(candidate.id, { reviewedFingerprint: proposal.fingerprint, rationale, rationaleConfirmed: true })).ok).toBe(true);
    expect(getCurrentRoleAppVersion(RCSA)).toMatchObject({ version: "1.1.0", lifecycleState: "installed", supportState: "maintained" });
    expect(getRoleAppVersion("RAV-rcsa-cycle-assistant-1.0.0")).toMatchObject({ lifecycleState: "retired", isCurrent: false });

    const rollBack = lifecycle.proposeRollBack(RCSA);
    expect((await lifecycle.rollBackRoleApp(RCSA, { reviewedFingerprint: rollBack.fingerprint, rationale, rationaleConfirmed: true })).ok).toBe(true);
    expect(getCurrentRoleAppVersion(RCSA)).toMatchObject({ version: "1.0.0", lifecycleState: "installed" });
    expect(listRoleAppLifecycleEvents(RCSA).some((event) => event.kind === "rolled-back")).toBe(true);
    expect(readRoleAppAvailability(RCSA).runnable).toBe(true);
  });
});

describe("release management", () => {
  it("refuses a pilot release while the gate has not passed, then approves and deploys it (Simulated)", async () => {
    acting.persona = "platform-product-owner";
    let proposal = release.proposeApprovePilotRelease();
    expect(proposal.blocked?.en).toContain("No release gate run");

    startReleaseGateRun({ id: "RGR-test-1", releaseVersion: "4.1.0", startedAt: "2026-10-06T10:00:00.000Z", triggeredByLabel: "test" });
    completeReleaseGateRun("RGR-test-1", {
      status: "failed",
      results: [{ gateKey: "a", label: "A", mandatory: true, status: "failed", detail: "", evidenceRef: null, durationMs: 1 }],
      completedAt: "2026-10-06T10:01:00.000Z",
    });
    proposal = release.proposeApprovePilotRelease();
    expect(proposal.blocked?.en).toContain("No release while mandatory gates fail");
    expect(await release.approvePilotRelease({ reviewedFingerprint: proposal.fingerprint, rationale, rationaleConfirmed: true })).toMatchObject({ ok: false, code: "rule" });

    startReleaseGateRun({ id: "RGR-test-2", releaseVersion: "4.1.0", startedAt: "2026-10-06T11:00:00.000Z", triggeredByLabel: "test" });
    completeReleaseGateRun("RGR-test-2", {
      status: "passed",
      results: [{ gateKey: "a", label: "A", mandatory: true, status: "passed", detail: "", evidenceRef: null, durationMs: 1 }],
      completedAt: "2026-10-06T11:01:00.000Z",
    });
    recordReleaseEvent({
      id: "PRE-test-evidence",
      releaseVersion: "4.1.0",
      kind: "evidence-pack-generated",
      gateRunId: "RGR-test-2",
      evidencePackRef: "release/console-evidence/test.json",
      evidencePackDigest: "d",
      at: "2026-10-06T11:02:00.000Z",
      actorLabel: "test",
    });
    proposal = release.proposeApprovePilotRelease();
    expect(proposal.blocked).toBeNull();
    expect((await release.approvePilotRelease({ reviewedFingerprint: proposal.fingerprint, rationale, rationaleConfirmed: true })).ok).toBe(true);

    /* The Platform Product Owner approves; deploying is the Operations Owner's. */
    const deploy = release.proposeDeploy();
    expect(await release.deployRelease({ reviewedFingerprint: deploy.fingerprint, rationale, rationaleConfirmed: true })).toMatchObject({ ok: false, code: "missing-scope" });
    acting.persona = "operations-owner";
    expect((await release.deployRelease({ reviewedFingerprint: deploy.fingerprint, rationale, rationaleConfirmed: true })).ok).toBe(true);
    expect(getDeployedRelease()).toMatchObject({ releaseVersion: "4.1.0", rolloutStatus: "pilot" });

    const rollBack = release.proposeReleaseRollBack();
    expect((await release.rollBackRelease({ reviewedFingerprint: rollBack.fingerprint, rationale, rationaleConfirmed: true })).ok).toBe(true);
    expect(getDeployedRelease()).toBeNull();
  });

  it("refuses a second gate run while one is in progress", async () => {
    acting.persona = "operations-owner";
    startReleaseGateRun({ id: "RGR-test-3", releaseVersion: "4.1.0", startedAt: new Date().toISOString(), triggeredByLabel: "test" });
    expect(await release.startReleaseGate()).toMatchObject({ ok: false, code: "rule" });
  });
});
