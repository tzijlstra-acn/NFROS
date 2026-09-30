/**
 * Authority gate tests.
 *
 * These are the most important tests in the repository. The product's central
 * claim is that human accountability cannot be bypassed, and that claim is
 * only as good as this gate. The tests are written adversarially: each one
 * tries a specific way of getting a material change through without a valid
 * human approval.
 */

import { describe, expect, it } from "vitest";
import {
  evaluateAuthority,
  fingerprintPayload,
  listToolRegistry,
  ROLE_AUTHORITY_SCOPES,
  toolsAvailableAt,
  type ApprovalContext,
} from "@/server/security/authority";
import { AUTONOMY_LEVELS, ROLE_IDS } from "@/db/schema/core";

const PAYLOAD = { controlId: "CTL-PAY-014", effectiveness: "partially-effective" };

function validApproval(overrides: Partial<ApprovalContext> = {}): ApprovalContext {
  return {
    approvedBy: "P-003",
    decisionId: "DEC-2026-0771",
    approvedAt: new Date().toISOString(),
    rationaleConfirmed: true,
    role: "rcsa",
    authorityScope: [...ROLE_AUTHORITY_SCOPES.rcsa],
    payloadFingerprint: fingerprintPayload("updateControlRating", PAYLOAD),
    consumedAt: null,
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    toolName: "updateControlRating",
    roleId: "rcsa" as const,
    autonomyLevel: "act-with-approval" as const,
    payload: PAYLOAD,
    actingUserId: "P-003",
    approval: validApproval(),
    ...overrides,
  };
}

describe("the registry", () => {
  it("classifies every tool", () => {
    for (const tool of listToolRegistry()) {
      expect(tool.authorityClass).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("marks every mutating tool as either material or policy bound", () => {
    for (const tool of listToolRegistry()) {
      if (!tool.mutates) continue;
      const governed =
        tool.authorityClass === "APPROVAL_REQUIRED" ||
        tool.authorityClass === "POLICY_BOUND_AUTONOMOUS";
      expect(governed, `${tool.name} mutates but is classified ${tool.authorityClass}`).toBe(true);
    }
  });

  it("never marks a read or draft tool as mutating", () => {
    for (const tool of listToolRegistry()) {
      if (tool.authorityClass === "READ" || tool.authorityClass === "DRAFT" || tool.authorityClass === "PROPOSE") {
        expect(tool.mutates, `${tool.name} is ${tool.authorityClass} but mutates`).toBe(false);
      }
    }
  });
});

describe("prohibited tools", () => {
  const prohibited = listToolRegistry().filter((tool) => tool.authorityClass === "PROHIBITED");

  it("has prohibited tools registered so the refusal is explicit", () => {
    expect(prohibited.length).toBeGreaterThan(0);
  });

  it("refuses them at every autonomy level and for every role", () => {
    for (const tool of prohibited) {
      for (const autonomyLevel of AUTONOMY_LEVELS) {
        for (const roleId of ROLE_IDS) {
          const decision = evaluateAuthority({
            toolName: tool.name,
            roleId,
            autonomyLevel,
            payload: {},
            actingUserId: "P-001",
            approval: null,
          });
          expect(decision.allowed, `${tool.name} allowed at ${autonomyLevel} for ${roleId}`).toBe(false);
          if (!decision.allowed) expect(decision.code).toBe("prohibited");
        }
      }
    }
  });

  it("refuses them even when handed a valid looking approval", () => {
    for (const tool of prohibited) {
      const decision = evaluateAuthority({
        toolName: tool.name,
        roleId: "rcsa",
        autonomyLevel: "act-within-policy",
        payload: {},
        actingUserId: "P-003",
        approval: validApproval({
          payloadFingerprint: fingerprintPayload(tool.name, {}),
        }),
      });
      expect(decision.allowed).toBe(false);
    }
  });

  it("never registers a handler for a prohibited tool", async () => {
    const { hasToolHandler } = await import("@/agents/tools/runtime");
    await import("@/agents/tools/reads");
    await import("@/agents/tools/mutations");
    for (const tool of prohibited) {
      expect(hasToolHandler(tool.name), `${tool.name} has a handler`).toBe(false);
    }
  });
});

describe("unknown tools", () => {
  it("refuses a tool that is not in the registry", () => {
    const decision = evaluateAuthority(request({ toolName: "deleteEverything" }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("unknown-tool");
  });
});

describe("autonomy levels", () => {
  it("cannot reach a material change below act with approval", () => {
    for (const autonomyLevel of ["assist", "prepare", "recommend"] as const) {
      const decision = evaluateAuthority(request({ autonomyLevel }));
      expect(decision.allowed, `allowed at ${autonomyLevel}`).toBe(false);
      if (!decision.allowed) expect(decision.code).toBe("autonomy-too-low");
    }
  });

  it("allows reads at every level", () => {
    for (const autonomyLevel of AUTONOMY_LEVELS) {
      const decision = evaluateAuthority({
        toolName: "searchEvidence",
        roleId: "rcsa",
        autonomyLevel,
        payload: { query: "control test" },
        actingUserId: "P-003",
        approval: null,
      });
      expect(decision.allowed, `read refused at ${autonomyLevel}`).toBe(true);
    }
  });

  it("refuses drafting at assist", () => {
    const decision = evaluateAuthority({
      toolName: "draftDecisionRationale",
      roleId: "rcsa",
      autonomyLevel: "assist",
      payload: {},
      actingUserId: "P-003",
      approval: null,
    });
    expect(decision.allowed).toBe(false);
  });

  it("still requires approval for a material change at the most permissive level", () => {
    const decision = evaluateAuthority(
      request({ autonomyLevel: "act-within-policy", approval: null }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-missing");
  });

  it("permits a low risk reversible action without approval only at act within policy", () => {
    const atPolicy = evaluateAuthority({
      toolName: "requestFactualValidation",
      roleId: "rcsa",
      autonomyLevel: "act-within-policy",
      payload: { question: "Please confirm." },
      actingUserId: "P-003",
      approval: null,
    });
    expect(atPolicy.allowed).toBe(true);

    const belowPolicy = evaluateAuthority({
      toolName: "requestFactualValidation",
      roleId: "rcsa",
      autonomyLevel: "act-with-approval",
      payload: { question: "Please confirm." },
      actingUserId: "P-003",
      approval: null,
    });
    expect(belowPolicy.allowed).toBe(false);
  });

  it("changes the reachable tool set when the level changes", () => {
    const atAssist = toolsAvailableAt("assist", "rcsa");
    const atPolicy = toolsAvailableAt("act-within-policy", "rcsa");
    expect(atPolicy.available.length).toBeGreaterThan(atAssist.available.length);
    expect(atAssist.withheld.length).toBeGreaterThan(atPolicy.withheld.length);
  });
});

describe("authority scopes", () => {
  it("refuses a tool whose scope the role does not hold", () => {
    // The control assurance role may conclude a test but may not rate an RCSA.
    const decision = evaluateAuthority(
      request({
        roleId: "control-assurance",
        approval: validApproval({
          role: "control-assurance",
          authorityScope: [...ROLE_AUTHORITY_SCOPES["control-assurance"]],
        }),
      }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("missing-scope");
  });

  it("refuses when the approver lacks the scope even if the actor holds it", () => {
    const decision = evaluateAuthority(
      request({ approval: validApproval({ authorityScope: ["evidence.read"] }) }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-scope-insufficient");
  });

  it("gives every role the read scopes it needs to function", () => {
    for (const roleId of ROLE_IDS) {
      expect(ROLE_AUTHORITY_SCOPES[roleId]).toContain("evidence.read");
      expect(ROLE_AUTHORITY_SCOPES[roleId]).toContain("work.read");
    }
  });
});

describe("approval validation", () => {
  it("allows a material change with a fully valid approval", () => {
    const decision = evaluateAuthority(request());
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.requiresApproval).toBe(true);
  });

  it("refuses when no approval is present, returning a proposal code", () => {
    const decision = evaluateAuthority(request({ approval: null }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-missing");
  });

  it("refuses when the rationale was not confirmed", () => {
    const decision = evaluateAuthority(
      request({ approval: validApproval({ rationaleConfirmed: false }) }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-not-confirmed");
  });

  it("refuses an approval already consumed, preventing replay", () => {
    const decision = evaluateAuthority(
      request({ approval: validApproval({ consumedAt: new Date().toISOString() }) }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-already-consumed");
  });

  it("refuses an approval granted under a different role", () => {
    const decision = evaluateAuthority(request({ approval: validApproval({ role: "tprm" }) }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-role-mismatch");
  });

  it("refuses an agent as the approver", () => {
    const decision = evaluateAuthority(
      request({ approval: validApproval({ approvedBy: "agent:manager" }) }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("self-approval");
  });

  it("refuses an empty approver", () => {
    const decision = evaluateAuthority(request({ approval: validApproval({ approvedBy: "  " }) }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("self-approval");
  });
});

describe("payload binding", () => {
  it("refuses when the payload differs from the approved one", () => {
    const decision = evaluateAuthority(
      request({
        // Approved for partially effective; attempting not effective instead.
        payload: { controlId: "CTL-PAY-014", effectiveness: "not-effective" },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-payload-mismatch");
  });

  it("refuses when the target object differs from the approved one", () => {
    const decision = evaluateAuthority(
      request({ payload: { controlId: "CTL-PAY-021", effectiveness: "partially-effective" } }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-payload-mismatch");
  });

  it("produces a fingerprint independent of key order", () => {
    const a = fingerprintPayload("updateControlRating", {
      controlId: "CTL-PAY-014",
      effectiveness: "partially-effective",
    });
    const b = fingerprintPayload("updateControlRating", {
      effectiveness: "partially-effective",
      controlId: "CTL-PAY-014",
    });
    expect(a).toBe(b);
  });

  it("produces a different fingerprint for a different tool", () => {
    const a = fingerprintPayload("updateControlRating", PAYLOAD);
    const b = fingerprintPayload("updateAssessment", PAYLOAD);
    expect(a).not.toBe(b);
  });

  it("produces a different fingerprint for nested differences", () => {
    const a = fingerprintPayload("createAction", { title: "x", meta: { owner: "P-007" } });
    const b = fingerprintPayload("createAction", { title: "x", meta: { owner: "P-008" } });
    expect(a).not.toBe(b);
  });

  it("ignores undefined values so an absent field and an explicit undefined agree", () => {
    const a = fingerprintPayload("createAction", { title: "x", dueOn: undefined });
    const b = fingerprintPayload("createAction", { title: "x" });
    expect(a).toBe(b);
  });
});
