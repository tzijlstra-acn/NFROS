/**
 * Mutation integrity tests.
 *
 * These cover one specific guarantee: a receipt line is only ever produced by
 * a change that actually happened.
 *
 * That guarantee was broken once. Several handlers issued an update against an
 * identifier that named nothing, matched zero rows, and returned their receipt
 * statements anyway, so a mistyped target in seeded data produced a confident
 * line saying a record had been updated when nothing had been written. These
 * tests exist so that cannot come back quietly, because the failure is
 * invisible from the outside: the interface looks correct and the audit trail
 * agrees with it.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";

let seed: () => void;
let executeTool: typeof import("@/agents/tools/runtime").executeTool;
let grantApproval: typeof import("@/scenario/engine/decide").grantApproval;
let fingerprintPayload: typeof import("@/server/security/authority").fingerprintPayload;
let requireScenarioState: typeof import("@/scenario/engine/state").requireScenarioState;
let switchRole: typeof import("@/scenario/engine/state").switchRole;

/** The person who holds each role, matching the engine's own map. */
const HOLDERS = {
  tprm: "P-002",
  rcsa: "P-003",
  "control-assurance": "P-004",
  "incident-resilience": "P-005",
  "regulatory-change": "P-006",
  "nfr-governance": "P-001",
} as const;

beforeAll(async () => {
  createTemporaryDatabase("mutations");
  const seedModule = await import("@/db/seed/run");
  seed = () => seedModule.seedScenario();
  ({ executeTool } = await import("@/agents/tools/runtime"));
  await import("@/agents/tools/mutations");
  ({ grantApproval } = await import("@/scenario/engine/decide"));
  ({ fingerprintPayload } = await import("@/server/security/authority"));
  ({ requireScenarioState, switchRole } = await import("@/scenario/engine/state"));
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seed();
});

/**
 * Builds a context and an approval bound to the payload, then executes.
 *
 * The acting role has to hold the tool's authority scopes, otherwise the gate
 * correctly refuses on scope before the handler runs and the test would be
 * measuring the gate rather than the handler. `grantApproval` reads the run's
 * active role, so the run is switched first and the approval and the execution
 * then agree.
 */
async function executeWithApproval(
  toolName: string,
  payload: Record<string, unknown>,
  roleId: "tprm" | "rcsa" | "control-assurance" | "incident-resilience" | "regulatory-change" | "nfr-governance",
) {
  switchRole(roleId);
  const state = requireScenarioState();
  const approvalId = grantApproval({
    decisionId: "DEC-2026-0772",
    toolName,
    payloadFingerprint: fingerprintPayload(toolName, payload),
    rationale: "Test rationale, confirmed.",
    rationaleConfirmed: true,
  });

  return executeTool(
    toolName,
    payload,
    {
      runId: state.runId,
      roleId: state.activeRoleId,
      autonomyLevel: state.autonomyLevel,
      actingUserId: HOLDERS[roleId],
      atMoment: state.currentMoment,
      sessionId: "test-session",
      actorKind: "human",
      language: "en",
    },
    approvalId,
  );
}

describe("an update against a target that does not exist", () => {
  const cases: Array<{
    tool: string;
    payload: Record<string, unknown>;
    table: string;
    roleId: Parameters<typeof executeWithApproval>[2];
  }> = [
    {
      tool: "classifyIncident",
      roleId: "incident-resilience",
      payload: { incidentId: "INC-9999-0000", severity: "high" },
      table: "incidents",
    },
    {
      tool: "escalateIncident",
      roleId: "incident-resilience",
      payload: { incidentId: "INC-9999-0000", escalateTo: "P-013" },
      table: "incidents",
    },
    {
      tool: "recordNotificationRecommendation",
      roleId: "incident-resilience",
      payload: { incidentId: "INC-9999-0000", recommended: true, rationale: "Because." },
      table: "incidents",
    },
    {
      tool: "captureLessonsLearned",
      roleId: "incident-resilience",
      payload: { incidentId: "INC-9999-0000", lessonsLearned: "Something." },
      table: "incidents",
    },
    {
      tool: "classifyTestException",
      roleId: "control-assurance",
      payload: { testCaseId: "OVR-XX-99999999-9999", classification: "control-failure", scope: "systemic" },
      table: "test_cases",
    },
    {
      tool: "recordObligationInterpretation",
      roleId: "regulatory-change",
      payload: {
        obligationId: "OBL-9999-0000-999",
        applicabilityDecision: "applicable",
        rationale: "Because.",
      },
      table: "obligations",
    },
    {
      tool: "setPortfolioMateriality",
      roleId: "nfr-governance",
      payload: { themeId: "THEME-DOES-NOT-EXIST", materiality: "high" },
      table: "portfolio_themes",
    },
    {
      tool: "applySupplierRestriction",
      roleId: "tprm",
      payload: { supplierId: "TP-9999", restriction: "exit-planned" },
      table: "suppliers",
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.tool} fails rather than reporting a change`, async () => {
      const result = await executeWithApproval(testCase.tool, testCase.payload, testCase.roleId);

      expect(result.outcome, `${testCase.tool} reported ${result.outcome}`).toBe("failed");
      // The critical assertion: no receipt line for a change that did not happen.
      expect(result.receiptStatements ?? []).toStrictEqual([]);
      expect(result.summary).toMatch(/matched no row|does not exist/i);
    });
  }

  it("records the failure in the tool call log so it is not silent", async () => {
    const before = rowCount("tool_calls");
    await executeWithApproval(
      "classifyIncident",
      { incidentId: "INC-9999-0000", severity: "high" },
      "incident-resilience",
    );
    expect(rowCount("tool_calls")).toBe(before + 1);
  });

  it("leaves the target table untouched", async () => {
    const before = rowCount("incidents");
    await executeWithApproval(
      "classifyIncident",
      { incidentId: "INC-9999-0000", severity: "high" },
      "incident-resilience",
    );
    expect(rowCount("incidents")).toBe(before);
  });

  it("does not create an issue when the control test behind a finding is absent", async () => {
    const before = rowCount("issues");
    const result = await executeWithApproval(
      "recordFinding",
      {
        title: "A finding against nothing",
        description: "Should not be recorded.",
        controlTestId: "TST-9999-0000",
        severity: "medium",
      },
      "control-assurance",
    );

    expect(result.outcome).toBe("failed");
    expect(rowCount("issues")).toBe(before);
    expect(result.summary).toMatch(/control test/i);
  });
});

describe("an update against a target that does exist", () => {
  it("succeeds and produces a receipt line", async () => {
    const result = await executeWithApproval(
      "classifyIncident",
      { incidentId: "INC-2026-0412", severity: "high" },
      "incident-resilience",
    );

    expect(result.outcome).toBe("executed");
    expect((result.receiptStatements ?? []).length).toBeGreaterThan(0);
  });

  it("writes the value it claims to have written", async () => {
    await executeWithApproval(
      "classifyIncident",
      { incidentId: "INC-2026-0412", severity: "critical" },
      "incident-resilience",
    );

    const { getSqlite } = await import("@/db/client");
    const row = getSqlite()
      .prepare("select severity as s, severity_set_by_user_id as u from incidents where id = ?")
      .get("INC-2026-0412") as { s: string; u: string } | undefined;

    expect(row?.s).toBe("critical");
    // The human is named, not the agent.
    expect(row?.u).toBe(HOLDERS["incident-resilience"]);
  });
});
