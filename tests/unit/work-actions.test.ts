/**
 * The Actions module read model.
 *
 * Pure tests over plain fixtures. Each claim is one the plan makes about
 * actions, written to break the thing it names:
 *
 *   there is no static fallback: an empty role shows an empty state;
 *   the four views are filters over one classification, so their counts are
 *   counts of the rows they show;
 *   overdue is a date, not only a stored word; blocked is the history;
 *   materiality and the evidence rule come from the role's configuration;
 *   operations say why they are disabled, in the gate's words where the
 *   gate is the reason;
 *   related links exist only when the thing they link to exists.
 */

import { describe, expect, it } from "vitest";
import {
  buildActionsView,
  countActions,
  EMPTY_ACTIONS_EXTRAS,
  resolveActionDetail,
  type ActionsExtras,
} from "@/features/work/modules/actions/read-model";
import {
  actionMateriality,
  classifyAction,
  composeReminder,
  duplicateCandidates,
  entryKindOf,
  evidenceRequiredToComplete,
  newEntryId,
  vagueWording,
} from "@/features/work/modules/actions/policy";
import { OPERATIONAL_RISK_WORK } from "@/features/work/roles/operational-risk";
import { THIRD_PARTY_RISK_WORK } from "@/features/work/roles/third-party-risk";
import { actionRow, evidenceRow, openGate, processScope, query, shared, updateRow, DATE } from "./support/work-fixtures";

function extras(overrides: Partial<ActionsExtras> = {}): ActionsExtras {
  return { ...EMPTY_ACTIONS_EXTRAS, ...overrides };
}

describe("no static fallback", () => {
  it("shows an empty state, not invented actions, when the role has none", () => {
    const view = buildActionsView(shared(), extras(), query({ tab: "actions" }));
    expect(view.groups).toStrictEqual([]);
    expect(view.empty?.title).toBe("No actions");
    expect(view.savedViews.every((saved) => saved.count === 0)).toBe(true);
  });

  it("names the empty view rather than the empty role when other views have rows", () => {
    const data = shared({ actions: [actionRow({ id: "A-1", status: "completed", completedOn: "2026-10-02" })] });
    const view = buildActionsView(data, extras(), query({ tab: "actions", actionsView: "needs-me" }));
    expect(view.empty?.title).toBe("Nothing needs you");
  });
});

describe("classification", () => {
  it("treats a passed due date as overdue even when the stored status says open", () => {
    const state = classifyAction(actionRow({ id: "A-1", dueOn: "2026-09-30", status: "open" }), [], "P-003", DATE, "Anna Weber");
    expect(state.overdue).toBe(true);
    expect(state.overdueDays).toBe(6);
    expect(state.effective).toBe("overdue");
  });

  it("respects a stored overdue status", () => {
    const state = classifyAction(actionRow({ id: "A-1", dueOn: "2026-12-31", status: "overdue" }), [], "P-003", DATE, null);
    expect(state.overdue).toBe(true);
  });

  it("reads blocked from the latest history entry and the blocker note from the blocking entry", () => {
    const updates = [
      updateRow({ id: "AUP-BLK-1-0001", actionId: "A-1", note: "Test environment frozen to 14.10.", statusAfter: "blocked", at: "2026-10-06T08:00:00.000Z" }),
      updateRow({ id: "AUP-UPD-2-0002", actionId: "A-1", note: "Chased again.", statusAfter: "blocked", at: "2026-10-06T09:00:00.000Z" }),
    ];
    const state = classifyAction(actionRow({ id: "A-1" }), updates, "P-003", DATE, null);
    expect(state.blocked).toBe(true);
    expect(state.blockerNote).toBe("Test environment frozen to 14.10.");

    const cleared = classifyAction(
      actionRow({ id: "A-1" }),
      [...updates, updateRow({ id: "AUP-UNB-3-0003", actionId: "A-1", statusAfter: "open", at: "2026-10-06T10:00:00.000Z" })],
      "P-003",
      DATE,
      null,
    );
    expect(cleared.blocked).toBe(false);
  });

  it("puts an action owned by the holder in Needs me and one delivered by a supplier in Waiting on others", () => {
    const mine = classifyAction(actionRow({ id: "A-1" }), [], "P-003", DATE, "Anna Weber");
    const supplier = classifyAction(actionRow({ id: "A-2", ownerLabel: "Novalink client service" }), [], "P-003", DATE, "Anna Weber");
    const colleague = classifyAction(actionRow({ id: "A-3", ownerUserId: "P-007" }), [], "P-003", DATE, "Jonas Keller");
    const unowned = classifyAction(actionRow({ id: "A-4", ownerUserId: null, isUnowned: true }), [], "P-003", DATE, null);

    expect(mine.needsMe).toBe(true);
    expect(supplier.needsMe).toBe(false);
    expect(supplier.waitingOn).toBe("Novalink client service");
    expect(colleague.waitingOn).toBe("Jonas Keller");
    /* An unowned action is the raising role's to assign. */
    expect(unowned.needsMe).toBe(true);
  });

  it("counts the same rows the saved views show", () => {
    const data = shared({
      actions: [
        actionRow({ id: "A-1" }),
        actionRow({ id: "A-2", dueOn: "2026-09-01", status: "overdue" }),
        actionRow({ id: "A-3", ownerUserId: "P-007" }),
        actionRow({ id: "A-4", status: "completed", completedOn: "2026-10-01" }),
      ],
    });
    const counts = countActions(data, extras());
    const view = buildActionsView(data, extras(), query({ tab: "actions" }));
    const byId = Object.fromEntries(view.savedViews.map((saved) => [saved.id, saved.count]));
    expect(byId).toStrictEqual({ "needs-me": counts.needsMe, "waiting-others": counts.waiting, overdue: counts.overdue, completed: counts.completed });
    expect(counts).toMatchObject({ needsMe: 2, waiting: 1, overdue: 1, completed: 1 });
    /* The overdue action that needs the holder is first in Needs me. */
    expect(view.groups[0]?.rows[0]?.id).toBe("A-2");
    expect(view.groups[0]?.rows[0]?.flag).toBe("danger");
  });
});

describe("materiality and evidence", () => {
  it("is material for high priority, for an issue, and for a material kind", () => {
    expect(actionMateriality(actionRow({ id: "A", priority: "high" }), OPERATIONAL_RISK_WORK, "en").material).toBe(true);
    expect(actionMateriality(actionRow({ id: "A", issueId: "ISS-1" }), OPERATIONAL_RISK_WORK, "en").reasons[0]).toContain("ISS-1");
    expect(actionMateriality(actionRow({ id: "A", kind: "remediation" }), OPERATIONAL_RISK_WORK, "en").material).toBe(true);
    expect(actionMateriality(actionRow({ id: "A", kind: "communication" }), OPERATIONAL_RISK_WORK, "en").material).toBe(false);
  });

  it("takes the evidence rule from the role and requires evidence for unknown kinds", () => {
    expect(evidenceRequiredToComplete("communication", OPERATIONAL_RISK_WORK)).toBe(false);
    expect(evidenceRequiredToComplete("evidence-request", THIRD_PARTY_RISK_WORK)).toBe(true);
    expect(evidenceRequiredToComplete("something-new", OPERATIONAL_RISK_WORK)).toBe(true);
  });
});

describe("AI checks", () => {
  it("flags wording that names an activity rather than a result", () => {
    const findings = vagueWording("Monthly monitoring review of manual override volumes", "en").map((finding) => finding.term);
    expect(findings).toContain("review");
    expect(findings).toContain("monitor");
    expect(vagueWording("Recruit to secondary reviewer position PR-SR-02", "en")).toStrictEqual([]);
  });

  it("flags an open action on the same object and kind, and ignores evidence requests raised from it", () => {
    const target = actionRow({ id: "A-1", relatedObjectId: "CTL-1", kind: "remediation" });
    const candidates = duplicateCandidates(target, [
      target,
      actionRow({ id: "A-2", relatedObjectId: "CTL-1", kind: "remediation" }),
      actionRow({ id: "A-3", relatedObjectId: "CTL-1", kind: "remediation", status: "completed" }),
      actionRow({ id: "REQ-1", relatedObjectKind: "action", relatedObjectId: "A-1", kind: "evidence-request" }),
    ]);
    expect(candidates.map((candidate) => candidate.id)).toStrictEqual(["A-2"]);
  });

  it("drafts a reminder from the role's own template", () => {
    const rcsa = composeReminder({ ownerName: "Jonas Keller", title: "T", reference: "R-1", dueOn: "2026-10-10", condition: "C" }, OPERATIONAL_RISK_WORK, "en");
    const tprm = composeReminder({ ownerName: "Novalink", title: "T", reference: "R-1", dueOn: "2026-10-10", condition: "C" }, THIRD_PARTY_RISK_WORK, "en");
    expect(rcsa.body).toContain("RCSA line");
    expect(tprm.body).toContain("verbal assurance");
    expect(rcsa.subject).toContain("10.10.2026");
  });
});

describe("history entries", () => {
  it("carries the entry kind in the identifier and reads it back", () => {
    const id = newEntryId("CMP");
    expect(id.startsWith("AUP-CMP-")).toBe(true);
    expect(entryKindOf(id)).toBe("CMP");
    expect(entryKindOf("seeded-note")).toBe("UPD");
  });
});

describe("the detail", () => {
  const base = () =>
    shared({
      actions: [
        actionRow({ id: "A-1", kind: "remediation", relatedObjectKind: "control", relatedObjectId: "CTL-1", progressNote: "Delivered to pre production." }),
        actionRow({ id: "A-2", ownerUserId: "P-007", status: "completed", completedOn: "2026-10-01" }),
      ],
      processScopes: [processScope()],
    });

  it("returns null for an identifier that is not one of the role's actions", () => {
    expect(resolveActionDetail("MTG-1", base(), extras(), query())).toBeNull();
  });

  it("links only what exists: the process in scope and the object, but no decision or meeting", () => {
    const detail = resolveActionDetail("A-1", base(), extras(), query({ tab: "actions", item: "A-1" }));
    const kinds = detail?.related.map((link) => link.kind) ?? [];
    expect(kinds).toContain("process");
    expect(kinds).toContain("object");
    expect(kinds).not.toContain("decision");
    expect(kinds).not.toContain("meeting");
    expect(detail?.sources.decision).toBeNull();
  });

  it("shows the record's own progress note as the first history entry without inventing an author", () => {
    const detail = resolveActionDetail("A-1", base(), extras(), query());
    expect(detail?.activity[0]?.text).toBe("Delivered to pre production.");
    expect(detail?.activity[0]?.actor).toBe("On the action record");
  });

  it("proposes a measurable completion condition and records none until a person agrees one", () => {
    const detail = resolveActionDetail("A-1", base(), extras(), query());
    expect(detail?.completion.agreed).toBeNull();
    expect(detail?.completion.proposal).toContain("CTL-1");

    const agreed = resolveActionDetail(
      "A-1",
      base(),
      extras({
        updates: new Map([
          ["A-1", [updateRow({ id: "AUP-CC-1-0001", actionId: "A-1", note: "Closed when the re-test passes." })]],
        ]),
      }),
      query(),
    );
    expect(agreed?.completion.agreed).toBe("Closed when the re-test passes.");
  });

  it("lists cited evidence first and the object's documents after it", () => {
    const detail = resolveActionDetail(
      "A-1",
      base(),
      extras({
        updates: new Map([["A-1", [updateRow({ id: "AUP-UPD-1-0001", actionId: "A-1", evidenceIds: ["EVD-2"] })]]]),
        evidence: new Map([["EVD-2", evidenceRow({ id: "EVD-2" })]]),
        relatedEvidence: new Map([["CTL-1", [evidenceRow({ id: "EVD-1", isStale: true }), evidenceRow({ id: "EVD-2" })]]]),
      }),
      query(),
    );
    expect(detail?.evidence.map((doc) => doc.id)).toStrictEqual(["EVD-2", "EVD-1"]);
    expect(detail?.freshness?.tone).toBe("warning");
  });

  it("disables operations with the reason, and only offers Reopen on a completed action", () => {
    const open = resolveActionDetail("A-1", base(), extras(), query());
    const done = resolveActionDetail("A-2", base(), extras(), query());
    const op = (detail: typeof open, id: string) => detail?.operations.find((entry) => entry.id === id);

    expect(op(open, "complete")?.enabled).toBe(true);
    expect(op(open, "complete")?.material).toBe(true);
    expect(op(open, "reopen")?.enabled).toBe(false);
    expect(op(done, "reopen")?.enabled).toBe(true);
    expect(op(done, "complete")?.disabledReason).toContain("Reopen it first");
  });

  it("uses the gate's own wording when the gate is the reason", () => {
    const gate = { ...openGate() };
    gate.completeAction = { ...gate.completeAction!, reachable: false, reason: "The autonomy level cannot reach this." };
    const detail = resolveActionDetail("A-1", shared({ ...base(), gate }), extras(), query());
    const complete = detail?.operations.find((entry) => entry.id === "complete");
    expect(complete?.enabled).toBe(false);
    expect(complete?.disabledReason).toBe("The autonomy level cannot reach this.");
  });

  it("binds the AI Partner to the action itself", () => {
    const detail = resolveActionDetail("A-1", base(), extras(), query());
    expect(detail?.ai.selection).toStrictEqual({ objectType: "action", objectId: "A-1", label: "Action A-1" });
  });

  it("renders in German without falling back to English labels", () => {
    const detail = resolveActionDetail("A-1", shared({ ...base(), language: "de" }), extras(), query());
    expect(detail?.kindLabel).toBe("Massnahme");
    expect(detail?.operations.find((entry) => entry.id === "complete")?.label).toBe("Mit Nachweis abschliessen");
  });
});
