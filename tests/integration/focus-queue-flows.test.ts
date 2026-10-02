/**
 * The focus queue and the role workspaces, against the seeded day.
 *
 * The unit tests prove the rules. These prove the rules meet real data, which
 * is a different claim and the one that fails first in practice. A queue
 * derivation that returns nothing is not a bug the type system can see: every
 * field is present, every section exists, and the screen is empty.
 *
 * So the framing here is: for every role, at the moments that matter, does the
 * day actually contain the work the interface promises? And when the scenario
 * changes something, does the queue move on its own rather than because
 * somebody remembered to update a second list?
 *
 * Runs against a temporary database. See `support/harness.ts` for how the
 * developer's own scenario file is kept out of reach.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { recordDecisionAndExecute } from "@/scenario/engine/decide";
import {
  getScenarioState,
  getTimeline,
  setMoment,
  SHARED_EVENT_MOMENT,
  switchRole,
} from "@/scenario/engine/state";
import {
  buildFocusCandidates,
  buildFocusContext,
  buildFocusQueue,
  buildFocusQueueView,
  buildNowDetail,
  focusEvidenceIds,
  triggerCountsForRole,
  WATCHING_LIMIT,
} from "@/db/repositories/focus";
import {
  buildRoleScope,
  buildRoleWorkspace,
  CHANGED_CAP,
  detectChangedObjects,
  selectableIdsOf,
} from "@/db/repositories/workspace";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import { FOCUS_SECTIONS, type FocusItemView } from "@/workday/contracts";
import { momentToMinutes } from "@/domain/nfr/calculators";

/** The first moment of the seeded day. */
const OPENING_MOMENT = "07:45";

/** The RCSA control effectiveness decision, and the option with the full chain. */
const RCSA_DECISION_ID = "DEC-2026-0772";
const RCSA_OPTION_ID = "DEC-2026-0772-O3";
const RATIONALE =
  "The only preventive control mapped to this risk carries a design and an operating deficiency, and two of six flagged items cannot be concluded.";

beforeAll(() => {
  createTemporaryDatabase("focus-queue");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  // Each test starts from the seeded morning. The engine writes to shared
  // rows, so an ordering dependency between tests would make any failure here
  // impossible to interpret.
  seedScenario();
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function idsOf(items: FocusItemView[]): Set<string> {
  return new Set(items.map((row) => row.id));
}

/** The timeline moment immediately before the shared event. */
function momentBeforeSharedEvent(): string {
  const shared = momentToMinutes(SHARED_EVENT_MOMENT);
  const earlier = getTimeline()
    .map((row) => row.moment)
    .filter((moment) => momentToMinutes(moment) < shared);
  const last = earlier.at(-1);
  if (last === undefined) throw new Error("The seeded timeline has no moment before 14:05.");
  return last;
}

/* ==========================================================================
   The opening moment, every role
   ========================================================================== */

describe("the queue at the opening moment", () => {
  it("is non-empty for every one of the six roles", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });

      expect(queue.items.length, `${roleId} has an empty queue`).toBeGreaterThan(0);
      expect(queue.counts["needs-you"], `${roleId} has nothing needing the user`).toBeGreaterThan(0);
      expect(queue.now, `${roleId} has no Now item`).not.toBeNull();
    }
  });

  it("gives every role something to watch, from a real monitored subject", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });
      expect(queue.watching.length, `${roleId} watches nothing`).toBeGreaterThan(0);
      expect(queue.watching.length).toBeLessThanOrEqual(WATCHING_LIMIT);

      // Every watched subject resolves to a row somebody can open, which is
      // what distinguishes a monitored subject from a decorative label.
      for (const row of queue.watching) {
        expect(row.objectId.length, `${roleId} watches an unnamed subject`).toBeGreaterThan(0);
        expect(row.humanAction, `${roleId} asks for an action on a watched item`).toBeNull();
      }
    }
  });

  it("shows the work the partner completed without anybody being interrupted", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });
      expect(queue.counts.handled, `${roleId} reports no handled work`).toBeGreaterThan(0);

      // A grouped row states its own count, so the number is inspectable.
      const grouped = queue.sections.handled.filter(
        (row) => row.objectType === "background-work",
      );
      expect(grouped.length, `${roleId} has no grouped background row`).toBeGreaterThan(0);
      for (const row of grouped) {
        expect(row.title).toMatch(/^\d+ /);
      }
    }
  });

  it("produces well formed items throughout", () => {
    setMoment(OPENING_MOMENT);
    const emDash = String.fromCodePoint(0x2014);

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });

      for (const row of queue.items) {
        const where = `${roleId} ${row.id}`;
        expect(row.title.length, `${where} has no title`).toBeGreaterThan(0);
        expect(row.objectType.length, `${where} has no object type`).toBeGreaterThan(0);
        expect(row.objectId.length, `${where} has no object identifier`).toBeGreaterThan(0);
        expect(row.reason.length, `${where} has no reason`).toBeGreaterThan(0);
        expect(row.arrivedAtMoment, `${where} has a malformed moment`).toMatch(/^\d{1,2}:\d{2}$/);
        expect(row.sourceCount, `${where} has a negative source count`).toBeGreaterThanOrEqual(0);
        expect(row.href.startsWith("/workday/"), `${where} has an off-site link`).toBe(true);
        expect(FOCUS_SECTIONS).toContain(row.section);

        // A reason is one short clause. A paragraph in a queue row defeats the
        // purpose of the queue.
        expect(row.reason.length, `${where} has a long reason`).toBeLessThanOrEqual(110);
        expect(row.reason.includes(". "), `${where} has more than one sentence`).toBe(false);
        expect(row.reason.includes(emDash), `${where} has an em dash`).toBe(false);
        expect(row.title.includes(emDash), `${where} title has an em dash`).toBe(false);
      }
    }
  });

  it("names no model, provider or vendor in anything it produces", () => {
    setMoment(OPENING_MOMENT);
    const forbidden = ["openai", "chatgpt", "gpt-", "anthropic", "claude", "gemini", "llama"];

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });
      for (const row of queue.items) {
        const haystack = `${row.title} ${row.reason} ${row.humanAction ?? ""}`.toLowerCase();
        for (const needle of forbidden) {
          expect(haystack.includes(needle), `${roleId} ${row.id} names ${needle}`).toBe(false);
        }
      }
    }
  });

  it("keeps one object in one section for every role", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });
      const seen = new Set<string>();
      for (const row of queue.items) {
        const key = `${row.objectType}:${row.objectId}`;
        expect(seen.has(key), `${roleId} lists ${key} twice`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("builds a German queue with no umlaut characters in its own copy", () => {
    setMoment(OPENING_MOMENT);
    const umlauts = new RegExp(
      `[${[0xc4, 0xd6, 0xdc, 0xe4, 0xf6, 0xfc, 0xdf]
        .map((code) => String.fromCodePoint(code))
        .join("")}]`,
    );

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "de" });
      for (const row of queue.items) {
        expect(umlauts.test(row.reason), `${roleId} ${row.id} reason has an umlaut`).toBe(false);
        if (row.humanAction !== null) {
          expect(umlauts.test(row.humanAction), `${roleId} ${row.id} action has an umlaut`).toBe(
            false,
          );
        }
      }
    }
  });
});

/* ==========================================================================
   The shell's three entry points
   ========================================================================== */

describe("the shell contract", () => {
  it("returns a flat, deduplicated queue from the positional signature", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const flat = buildFocusQueue(roleId, OPENING_MOMENT, "en");
      const assembled = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });
      expect(idsOf(flat)).toStrictEqual(idsOf(assembled.items));
    }
  });

  it("states the day in one line of counted fact", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const line = buildFocusContext(roleId, OPENING_MOMENT, "en");
      expect(line.length, `${roleId} has no context line`).toBeGreaterThan(10);
      // One sentence. The V1 route opened with a paragraph; this replaces it.
      expect(line.split(". ").length, `${roleId} has a paragraph`).toBe(1);
      expect(line.endsWith(".")).toBe(true);
      expect(/\d/.test(line), `${roleId} states no number`).toBe(true);

      const german = buildFocusContext(roleId, OPENING_MOMENT, "de");
      expect(german).not.toBe(line);
    }
  });

  it("counts the context triggers from the same rail the drawer renders", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const counts = triggerCountsForRole(roleId, OPENING_MOMENT);
      for (const [key, value] of Object.entries(counts)) {
        expect(Number.isInteger(value), `${roleId} ${key} is not an integer`).toBe(true);
        expect(value, `${roleId} ${key} is negative`).toBeGreaterThanOrEqual(0);
      }
      // Policy applies to every role, so this one can never legitimately be
      // zero: a role with no applicable policy section would have no autonomy
      // constraint at all.
      expect(counts.policy, `${roleId} has no applicable policy`).toBeGreaterThan(0);
      expect(counts.audit, `${roleId} has no audit trail`).toBeGreaterThan(0);
    }
  });

  it("resolves evidence for the role from both the moment and the open decisions", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const ids = focusEvidenceIds(roleId, OPENING_MOMENT);
      expect(ids.length, `${roleId} surfaces no evidence`).toBeGreaterThan(0);
      expect(new Set(ids).size, `${roleId} repeats an evidence identifier`).toBe(ids.length);
    }
  });

  it("builds a Now card that cannot grow", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: OPENING_MOMENT, language: "en" });
      const now = queue.now;
      expect(now).not.toBeNull();
      if (now === null) continue;

      const detail = buildNowDetail(now, { roleId, atMoment: OPENING_MOMENT, language: "en" });
      expect(detail.why.length, `${roleId} Now has no reason`).toBeGreaterThan(0);
      expect(detail.changed.length).toBeLessThanOrEqual(2);
      expect(detail.completed.length).toBeLessThanOrEqual(3);
      expect(detail.needs.length).toBeGreaterThan(0);
      expect(detail.action.href.startsWith("/workday/")).toBe(true);
    }
  });
});

/* ==========================================================================
   A decision being recorded
   ========================================================================== */

describe("recording a decision", () => {
  it("moves the item out of needs-you without the queue being told", async () => {
    setMoment("11:45");

    const before = buildFocusQueueView({ roleId: "rcsa", atMoment: "11:45", language: "en" });
    const itemId = `focus-decision-${RCSA_DECISION_ID}`;
    expect(idsOf(before.sections["needs-you"])).toContain(itemId);

    const result = await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(result.ok, result.blockedReasons.join("; ")).toBe(true);

    const after = buildFocusQueueView({ roleId: "rcsa", atMoment: "11:45", language: "en" });
    expect(idsOf(after.sections["needs-you"])).not.toContain(itemId);

    /*
     * It lands under handled rather than vanishing, because something
     * genuinely happened: the chosen option's consequences executed and left
     * receipt lines. A decision with no receipt behind it would be filed
     * nowhere, which is the honest answer for a judgment that changed nothing.
     */
    expect(idsOf(after.sections.handled)).toContain(itemId);
    expect(after.counts["needs-you"]).toBe(before.counts["needs-you"] - 1);
  });

  it("leaves the other roles' queues untouched", async () => {
    setMoment("11:45");
    const otherBefore = buildFocusQueueView({ roleId: "tprm", atMoment: "11:45", language: "en" });

    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const otherAfter = buildFocusQueueView({ roleId: "tprm", atMoment: "11:45", language: "en" });
    expect(otherAfter.counts["needs-you"]).toBe(otherBefore.counts["needs-you"]);
  });

  it("marks the changed control for the role that changed it", async () => {
    setMoment("11:45");

    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const changed = detectChangedObjects({ roleId: "rcsa", atMoment: "11:45", language: "en" });
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThanOrEqual(CHANGED_CAP);
    expect(changed.some((entry) => entry.objectId === "CTL-PAY-014")).toBe(true);
  });
});

/* ==========================================================================
   The shared event
   ========================================================================== */

describe("the shared event at 14:05", () => {
  it("adds an item to every role's queue", () => {
    const earlier = momentBeforeSharedEvent();

    setMoment(earlier);
    const before = new Map<RoleId, Set<string>>();
    for (const roleId of ROLE_IDS) {
      before.set(
        roleId,
        idsOf(buildFocusQueueView({ roleId, atMoment: earlier, language: "en" }).items),
      );
    }

    setMoment(SHARED_EVENT_MOMENT);
    for (const roleId of ROLE_IDS) {
      const after = buildFocusQueueView({
        roleId,
        atMoment: SHARED_EVENT_MOMENT,
        language: "en",
      });
      const previous = before.get(roleId) ?? new Set<string>();
      const added = after.items.filter((row) => !previous.has(row.id));

      expect(added.length, `${roleId} gained nothing at ${SHARED_EVENT_MOMENT}`).toBeGreaterThan(0);
    }
  });

  it("reaches every role either as a decision or as the event itself", () => {
    setMoment(SHARED_EVENT_MOMENT);

    const sharedIncidentId = (
      getSqlite()
        .prepare("select id from incidents where is_shared_event = 1")
        .get() as { id: string } | undefined
    )?.id;
    expect(sharedIncidentId).toBeDefined();

    for (const roleId of ROLE_IDS) {
      const candidates = buildFocusCandidates({
        roleId,
        atMoment: SHARED_EVENT_MOMENT,
        language: "en",
      });

      const touchesEvent = candidates.some(
        (entry) =>
          entry.relatedObjectKey === `incident:${sharedIncidentId}` ||
          entry.item.objectId === sharedIncidentId ||
          entry.item.severity === "critical",
      );
      expect(touchesEvent, `${roleId} does not see the shared event`).toBe(true);
    }
  });

  it("does not show the event before it has happened", () => {
    const earlier = momentBeforeSharedEvent();
    setMoment(earlier);

    for (const roleId of ROLE_IDS) {
      const queue = buildFocusQueueView({ roleId, atMoment: earlier, language: "en" });
      for (const row of queue.items) {
        expect(
          momentToMinutes(row.arrivedAtMoment),
          `${roleId} ${row.id} arrived in the future`,
        ).toBeLessThanOrEqual(momentToMinutes(earlier));
      }
    }
  });
});

/* ==========================================================================
   A role switch
   ========================================================================== */

describe("switching role", () => {
  /** The state a professional would be furious to lose. */
  function sharedStateFingerprint(): string {
    const rows = getSqlite()
      .prepare(
        `select
           (select count(*) from audit_events) as audit,
           (select count(*) from decisions where status = 'decided') as decided,
           (select count(*) from approvals) as approvals,
           (select count(*) from execution_receipt_lines) as receipts,
           (select current_moment from scenario_runs) as moment,
           (select count(*) from incidents where is_shared_event = 1) as sharedEvent`,
      )
      .get() as Record<string, number | string>;
    return JSON.stringify(rows);
  }

  it("changes the queue and keeps the shared state", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const fingerprintBefore = sharedStateFingerprint();
    const rcsaQueue = buildFocusQueueView({ roleId: "rcsa", atMoment: "11:45", language: "en" });

    switchRole("tprm");

    const state = getScenarioState();
    expect(state?.activeRoleId).toBe("tprm");

    const tprmQueue = buildFocusQueueView({ roleId: "tprm", atMoment: "11:45", language: "en" });

    // The queue is genuinely a different professional's work.
    expect(idsOf(tprmQueue.items)).not.toStrictEqual(idsOf(rcsaQueue.items));
    expect(tprmQueue.items.length).toBeGreaterThan(0);

    /*
     * The switch writes one audit event, which is the point: a reviewer can
     * see which professional was acting. Everything else about the shared
     * state is unchanged, including the decision taken as the previous role.
     */
    const after = JSON.parse(sharedStateFingerprint()) as Record<string, number | string>;
    const before = JSON.parse(fingerprintBefore) as Record<string, number | string>;
    expect(after.decided).toBe(before.decided);
    expect(after.approvals).toBe(before.approvals);
    expect(after.receipts).toBe(before.receipts);
    expect(after.moment).toBe(before.moment);
    expect(after.sharedEvent).toBe(before.sharedEvent);
    expect(Number(after.audit)).toBe(Number(before.audit) + 1);
  });

  it("keeps the decision recorded as the previous role visible to that role", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    switchRole("tprm");

    const rcsaAgain = buildFocusQueueView({ roleId: "rcsa", atMoment: "11:45", language: "en" });
    expect(idsOf(rcsaAgain.sections.handled)).toContain(`focus-decision-${RCSA_DECISION_ID}`);
  });
});

/* ==========================================================================
   The role workspaces
   ========================================================================== */

describe("role workspaces", () => {
  it("builds a usable view model for every role", () => {
    setMoment(SHARED_EVENT_MOMENT);

    for (const roleId of ROLE_IDS) {
      const view = buildRoleWorkspace({ roleId, atMoment: SHARED_EVENT_MOMENT, language: "en" });

      expect(view.kind, `${roleId} built the wrong kind`).toBe(roleId);
      expect(view.heading.length, `${roleId} has no heading`).toBeGreaterThan(0);
      expect(
        Object.keys(view.selectable).length,
        `${roleId} exposes nothing selectable`,
      ).toBeGreaterThan(0);
      expect(view.changedIds.length, `${roleId} marks too much`).toBeLessThanOrEqual(CHANGED_CAP);

      // Every selectable entry resolves to a label somebody can read.
      for (const [id, entry] of Object.entries(view.selectable)) {
        expect(entry.objectId, `${roleId} ${id} has a mismatched identifier`).toBe(id);
        expect(entry.label.length, `${roleId} ${id} has no label`).toBeGreaterThan(0);
      }
    }
  });

  it("feeds each hero visualisation with the data it needs", () => {
    setMoment(SHARED_EVENT_MOMENT);

    const rcsa = buildRoleWorkspace({ roleId: "rcsa", atMoment: SHARED_EVENT_MOMENT, language: "en" });
    if (rcsa.kind !== "rcsa") throw new Error("Expected the rcsa view.");
    expect(rcsa.risks.length).toBeGreaterThan(0);
    expect(rcsa.controls.length).toBeGreaterThan(0);
    // The divergence is the reason the screen exists, so it must be present.
    expect(rcsa.effectivenessChanges.length).toBeGreaterThan(0);

    const tprm = buildRoleWorkspace({ roleId: "tprm", atMoment: SHARED_EVENT_MOMENT, language: "en" });
    if (tprm.kind !== "tprm") throw new Error("Expected the tprm view.");
    expect(tprm.supplier).not.toBeNull();
    expect(tprm.nodes.length).toBeGreaterThan(3);
    expect(tprm.edges.length).toBeGreaterThan(0);
    expect(tprm.evidenceChecked.length).toBeGreaterThan(0);

    const assurance = buildRoleWorkspace({
      roleId: "control-assurance",
      atMoment: SHARED_EVENT_MOMENT,
      language: "en",
    });
    if (assurance.kind !== "control-assurance") throw new Error("Expected the assurance view.");
    expect(assurance.test).not.toBeNull();
    expect(assurance.cases.length).toBeGreaterThan(0);
    expect(assurance.relatedControl).not.toBeNull();

    const incident = buildRoleWorkspace({
      roleId: "incident-resilience",
      atMoment: SHARED_EVENT_MOMENT,
      language: "en",
    });
    if (incident.kind !== "incident-resilience") throw new Error("Expected the incident view.");
    expect(incident.nodes.length).toBeGreaterThan(0);
    expect(incident.propagation.length).toBeGreaterThan(0);
    expect(incident.chronology.length).toBeGreaterThan(0);

    const regulatory = buildRoleWorkspace({
      roleId: "regulatory-change",
      atMoment: SHARED_EVENT_MOMENT,
      language: "en",
    });
    if (regulatory.kind !== "regulatory-change") throw new Error("Expected the regulatory view.");
    expect(regulatory.publications.length).toBeGreaterThan(0);
    expect(regulatory.obligations.length).toBeGreaterThan(0);
    expect(regulatory.missingOwnerIds.length).toBeGreaterThan(0);

    const governance = buildRoleWorkspace({
      roleId: "nfr-governance",
      atMoment: SHARED_EVENT_MOMENT,
      language: "en",
    });
    if (governance.kind !== "nfr-governance") throw new Error("Expected the governance view.");
    expect(governance.matter).not.toBeNull();
    expect(governance.lenses.length).toBeGreaterThan(1);
  });

  it("keeps extraction and interpretation as two separate fields", () => {
    setMoment(OPENING_MOMENT);
    const view = buildRoleWorkspace({
      roleId: "regulatory-change",
      atMoment: OPENING_MOMENT,
      language: "en",
    });
    if (view.kind !== "regulatory-change") throw new Error("Expected the regulatory view.");

    expect(view.interpretation.length).toBeGreaterThan(0);
    for (const pair of view.interpretation) {
      // The machine reading is always present and always carries a confidence.
      expect(pair.extractedSummary.length).toBeGreaterThan(0);
      expect(pair.extractionConfidence).toBeGreaterThan(0);
      expect(pair.extractionConfidence).toBeLessThanOrEqual(1);
      // The position is a separate field, and it is null until a person sets
      // it. Nothing in the view model merges the two.
      expect(
        pair.applicabilityDecision === null || pair.applicabilityDecision.length > 0,
      ).toBe(true);
      if (pair.applicabilityDecision === null) {
        expect(pair.decidedBy).toBeNull();
      }
    }

    // At the opening moment nothing has been interpreted yet, which is the
    // whole finding this role carries into the day.
    expect(view.newlyExtractedIds.length).toBeGreaterThan(0);
  });

  it("scopes each role to the objects it demonstrably works on", () => {
    const scope = buildRoleScope("rcsa");
    expect(scope.riskIds.size).toBeGreaterThan(0);
    expect(scope.controlIds.size).toBeGreaterThan(0);
    expect(scope.evidenceIds.size).toBeGreaterThan(0);
    expect(scope.groupScope).toBe(false);

    expect(buildRoleScope("nfr-governance").groupScope).toBe(true);

    const tprmScope = buildRoleScope("tprm");
    expect(tprmScope.supplierIds.size).toBeGreaterThan(0);
    expect(tprmScope.serviceIds.size).toBeGreaterThan(0);
  });

  it("exposes selectable identifiers the shell can reconcile a selection against", () => {
    setMoment(OPENING_MOMENT);

    for (const roleId of ROLE_IDS) {
      const view = buildRoleWorkspace({ roleId, atMoment: OPENING_MOMENT, language: "en" });
      const ids = selectableIdsOf(view);
      expect(ids.length, `${roleId} exposes no identifiers`).toBeGreaterThan(0);
      expect(new Set(ids).size, `${roleId} repeats an identifier`).toBe(ids.length);
    }
  });
});
