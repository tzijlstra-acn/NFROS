/**
 * Payload bound approval with a target (migration 0005).
 *
 * An approval now names what it is about (`approvals.target_kind`,
 * `target_id`), and a request may name its object too. The fingerprint is
 * still the binding; the target narrows it: an approval granted for one
 * object is refused for another, even with an identical payload. Either side
 * may leave the target out, and then the gate behaves exactly as before.
 */

import { describe, expect, it } from "vitest";
import { evaluateAuthority, fingerprintPayload, ROLE_AUTHORITY_SCOPES, type ApprovalContext } from "@/server/security/authority";

const PAYLOAD = { minutesId: "MIN-1", version: 2, contentDigest: "abc" };

function approval(overrides: Partial<ApprovalContext> = {}): ApprovalContext {
  return {
    approvedBy: "P-003",
    decisionId: "",
    approvedAt: "2026-10-06T13:30:00.000Z",
    rationaleConfirmed: true,
    role: "rcsa",
    authorityScope: [...ROLE_AUTHORITY_SCOPES.rcsa],
    payloadFingerprint: fingerprintPayload("confirmMeetingMinutes", PAYLOAD),
    consumedAt: null,
    target: { kind: "minutes", id: "MIN-1" },
    ...overrides,
  };
}

function ask(target: { kind: string; id: string } | null, granted: ApprovalContext | null, payload: unknown = PAYLOAD) {
  return evaluateAuthority({
    toolName: "confirmMeetingMinutes",
    roleId: "rcsa",
    autonomyLevel: "act-with-approval",
    payload,
    actingUserId: "P-003",
    approval: granted,
    target,
  });
}

describe("approval targets", () => {
  it("classifies minutes confirmation as material and the draft tools as routine", () => {
    const confirm = ask(null, null);
    expect(confirm.allowed).toBe(false);
    expect(confirm.tool?.material).toBe(true);
    if (!confirm.allowed) expect(confirm.code).toBe("approval-missing");
    for (const tool of ["captureMeetingItem", "prepareMeetingMinutes", "editMeetingMinutes", "distributeMeetingMinutes"]) {
      const decision = evaluateAuthority({ toolName: tool, roleId: "tprm", autonomyLevel: "act-with-approval", payload: {}, actingUserId: "P-002", approval: null });
      expect(decision.tool?.material, tool).toBe(false);
      expect(decision.tool?.authorityClass, tool).toBe("POLICY_BOUND_AUTONOMOUS");
    }
  });

  it("allows an approval granted for the same object and payload", () => {
    expect(ask({ kind: "minutes", id: "MIN-1" }, approval()).allowed).toBe(true);
  });

  it("refuses an approval granted for another object, even with an identical payload", () => {
    const decision = ask({ kind: "minutes", id: "MIN-2" }, approval());
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("approval-target-mismatch");
    const otherKind = ask({ kind: "meeting", id: "MIN-1" }, approval());
    if (!otherKind.allowed) expect(otherKind.code).toBe("approval-target-mismatch");
    expect(otherKind.allowed).toBe(false);
  });

  it("still reports a different payload as a payload mismatch first", () => {
    const decision = ask({ kind: "minutes", id: "MIN-2" }, approval(), { ...PAYLOAD, version: 3 });
    if (!decision.allowed) expect(decision.code).toBe("approval-payload-mismatch");
    expect(decision.allowed).toBe(false);
  });

  it("binds by the fingerprint alone when either side names no target, as before migration 0005", () => {
    expect(ask(null, approval()).allowed).toBe(true);
    expect(ask({ kind: "minutes", id: "MIN-2" }, approval({ target: null })).allowed).toBe(true);
    expect(ask({ kind: "minutes", id: "MIN-2" }, approval({ target: undefined })).allowed).toBe(true);
  });

  it("keeps every other check: a consumed approval, an agent approver, another role", () => {
    const consumed = ask({ kind: "minutes", id: "MIN-1" }, approval({ consumedAt: "2026-10-06T13:31:00.000Z" }));
    if (!consumed.allowed) expect(consumed.code).toBe("approval-already-consumed");
    const agent = ask({ kind: "minutes", id: "MIN-1" }, approval({ approvedBy: "agent:manager" }));
    if (!agent.allowed) expect(agent.code).toBe("self-approval");
    const role = ask({ kind: "minutes", id: "MIN-1" }, approval({ role: "tprm" }));
    if (!role.allowed) expect(role.code).toBe("approval-role-mismatch");
    expect([consumed.allowed, agent.allowed, role.allowed]).toStrictEqual([false, false, false]);
  });

  it("does not let the draft tools reach a person's record below the autonomy that permits a change", () => {
    const decision = evaluateAuthority({ toolName: "confirmMeetingMinutes", roleId: "rcsa", autonomyLevel: "recommend", payload: PAYLOAD, actingUserId: "P-003", approval: approval() });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("autonomy-too-low");
  });
});
