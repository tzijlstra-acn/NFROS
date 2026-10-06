/**
 * The V3.3 decision queue and its five-part workspace.
 *
 * Each claim is written to try to break the thing plan section 4.10 is
 * specific about rather than to confirm that the code runs.
 *
 *   1. A queued row leads with what distinguishes that decision. The defect
 *      this feature replaced headed four rows "Record the decision", so the
 *      test asserts the headlines are distinct, that none of them is the
 *      shared action class, and that they are the seeded titles.
 *
 *   2. Exactly one decision is active, and it moves through five ordered
 *      parts: Question, Context, Evidence, Options, Confirm and execute. The
 *      machine clamps at both ends and refuses to reach Confirm without a
 *      choice.
 *
 *   3. Each part carries what the plan asks of it: the professional question;
 *      the trigger, process stage, affected object, deadline and current
 *      position; the strongest evidence each way, the conflict, the stale
 *      source and the uncertainty; each option's implication, affected
 *      systems and approval requirement; and on Confirm, the exact payload and
 *      target of every change.
 *
 *   4. The authority position is the gate's, not this feature's, and nothing
 *      is confirmable without a choice, a rationale of the minimum length, the
 *      ownership confirmation and an approval of every change.
 *
 *   5. Confirm writes the existing trail, through the feature's one server
 *      action and the governed engine, and the feature itself has no write
 *      path at all.
 *
 * Runs against a temporary database. See `support/harness.ts`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { planDecisionOption, recordDecisionAndExecute } from "@/scenario/engine/decide";
import { setMoment } from "@/scenario/engine/state";
import { AUTHORITY_CLASSES } from "@/db/schema/decisions";
import { getUser } from "@/db/repositories/workday";
import { buildDecisionQueueView, shortParagraph } from "@/features/decisions/queue";
import {
  allChangesApproved,
  canAdvance,
  canConfirm,
  DECISION_STAGES,
  decisionFromHash,
  findDetail,
  findRecorded,
  isFirstStage,
  isLastStage,
  MINIMUM_RATIONALE_LENGTH,
  nextStage,
  previousStage,
  requiredApprovals,
  stageIndex,
  type DecisionQueueViewModel,
} from "@/features/decisions/model";
import {
  AUTHORITY_LABELS,
  CONSEQUENCE_LABELS,
  COPY,
  DENIAL_REASONS_DE,
  JUDGMENT_LABELS,
  LOCAL_SYSTEM,
  PAYLOAD_FIELD_LABELS,
  RECEIPT_LABELS,
  REFUSAL_MESSAGES,
  STAGE_HINTS,
  STAGE_LABELS,
  SUBJECT_KIND_LABELS,
  TOOL_REGISTERS,
  VALUE_LABELS,
  type Pair,
} from "@/features/decisions/copy";

/** The moment at which both roles have four open decisions. */
const MOMENT = "11:45";

/** The RCSA control effectiveness decision. Every option needs an approval. */
const APPROVAL_DECISION = "DEC-2026-0772";
const APPROVAL_OPTION = "DEC-2026-0772-O3";

/** The RCSA workshop sequencing decision. No option is seeded as needing an approval. */
const PROPOSAL_DECISION = "DEC-2026-0745";

/** The RCSA indicator decision the evidence refresh stage is bound to. */
const STAGE_BOUND_DECISION = "DEC-2026-0771";

/** The person the roles table names as holding the RCSA role. */
const RCSA_HOLDER = "P-003";

const RATIONALE =
  "The only preventive control mapped to this risk carries a design and an operating deficiency, and two of six flagged items cannot be concluded, so the deviation rate is unknown.";

function view(
  overrides: Partial<Parameters<typeof buildDecisionQueueView>[0]> = {},
): DecisionQueueViewModel {
  return buildDecisionQueueView({
    roleId: "rcsa",
    atMoment: MOMENT,
    language: "en",
    autonomyLevel: "act-with-approval",
    ...overrides,
  });
}

/** Audit events of one action, from the table that already existed. */
function auditEvents(action: string): Array<{ id: string; objectId: string; actorKind: string }> {
  return getSqlite()
    .prepare(
      "select id, object_id as objectId, actor_kind as actorKind from audit_events where action = ? order by id",
    )
    .all(action) as Array<{ id: string; objectId: string; actorKind: string }>;
}

beforeAll(() => {
  createTemporaryDatabase("decision-queue-v3");
  seedScenario();
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
  setMoment(MOMENT);
});

/* ==========================================================================
   1. The queue reads without being opened
   ========================================================================== */

describe("the queued rows", () => {
  it("shows every open decision for the role at this moment", () => {
    const model = view();
    expect(model.rows.length).toBe(4);
    expect(model.recorded).toStrictEqual([]);
    expect(model.rows.map((row) => row.decisionId)).toContain(APPROVAL_DECISION);
  });

  it("leads with what distinguishes the decision, never with the action class", () => {
    const model = view();
    for (const row of model.rows) {
      expect(row.headline.toLowerCase()).not.toContain("record the decision");
      expect(row.headline.toLowerCase()).not.toContain("entscheidung erfassen");
      expect(row.headline.length).toBeGreaterThan(12);
    }
    const headlines = model.rows.map((row) => row.headline);
    expect(new Set(headlines).size).toBe(headlines.length);
  });

  it("uses the seeded title, which is the field that says what the decision turns on", () => {
    const model = view();
    const titles = getSqlite()
      .prepare("select id, title from decisions where role_id = 'rcsa'")
      .all() as Array<{ id: string; title: string }>;
    const byId = new Map(titles.map((row) => [row.id, row.title]));
    for (const row of model.rows) {
      expect(row.headline).toBe(byId.get(row.decisionId));
    }
  });

  it("carries a one clause summary and a judgment label on every row", () => {
    for (const row of view().rows) {
      expect(row.summary.length).toBeGreaterThan(0);
      expect(row.summary.length).toBeLessThanOrEqual(120);
      expect(row.judgmentLabel.length).toBeGreaterThan(0);
      expect(row.judgmentLabel).not.toBe(row.headline);
    }
  });

  it("keeps a paragraph to one or two sentences and never cuts mid clause without saying so", () => {
    const long =
      "The gap between 9 and 12 is not a numerical quibble. It is the difference between monitoring and a signed acceptance. A third sentence that must not appear.";
    const paragraph = shortParagraph(long);
    expect(paragraph).toContain("not a numerical quibble");
    expect(paragraph).not.toContain("A third sentence");

    const single = `${"word ".repeat(80)}end.`;
    expect(shortParagraph(single).endsWith("...")).toBe(true);
  });
});

/* ==========================================================================
   2. Exactly one active decision, moving through five ordered parts
   ========================================================================== */

describe("the active decision", () => {
  it("opens exactly one decision, and ships the five parts for all of them", () => {
    const model = view();
    expect(model.initialActiveId).toBe(model.rows[0]?.decisionId);
    expect(model.details.length).toBe(model.rows.length);

    const active = findDetail(model, model.initialActiveId);
    expect(active?.decisionId).toBe(model.initialActiveId);
    expect(findDetail(model, null)).toBeNull();
    expect(findDetail(model, "DEC-does-not-exist")).toBeNull();
  });

  it("has five parts, in the order plan section 4.10 sets", () => {
    expect([...DECISION_STAGES]).toStrictEqual(["question", "context", "evidence", "options", "confirm"]);
    expect(stageIndex("question")).toBe(0);
    expect(stageIndex("confirm")).toBe(4);
  });

  it("moves forward and backward, and clamps at both ends", () => {
    expect(nextStage("question")).toBe("context");
    expect(nextStage("context")).toBe("evidence");
    expect(nextStage("evidence")).toBe("options");
    expect(nextStage("options")).toBe("confirm");
    expect(nextStage("confirm")).toBe("confirm");
    expect(previousStage("confirm")).toBe("options");
    expect(previousStage("question")).toBe("question");
    expect(isFirstStage("question")).toBe(true);
    expect(isLastStage("confirm")).toBe(true);
  });

  it("reads freely through the first three parts and refuses Confirm without a choice", () => {
    const empty = { selectedOptionId: null };
    expect(canAdvance("question", empty)).toBe(true);
    expect(canAdvance("context", empty)).toBe(true);
    expect(canAdvance("evidence", empty)).toBe(true);
    expect(canAdvance("options", empty)).toBe(false);
    expect(canAdvance("options", { selectedOptionId: APPROVAL_OPTION })).toBe(true);
    expect(canAdvance("confirm", { selectedOptionId: APPROVAL_OPTION })).toBe(false);
  });

  it("selects the decision a deep link names, open or recorded, and ignores one it does not hold (J23)", async () => {
    const model = view();
    expect(decisionFromHash(model, `#${APPROVAL_DECISION}`)).toBe(APPROVAL_DECISION);
    expect(decisionFromHash(model, APPROVAL_DECISION)).toBe(APPROVAL_DECISION);
    expect(decisionFromHash(model, "#DEC-1999-0001")).toBeNull();
    expect(decisionFromHash(model, "")).toBeNull();

    await recordDecisionAndExecute({
      decisionId: APPROVAL_DECISION,
      optionId: APPROVAL_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    expect(decisionFromHash(view(), `#${APPROVAL_DECISION}`)).toBe(APPROVAL_DECISION);
  });
});

/* ==========================================================================
   3. What each part carries
   ========================================================================== */

describe("the five parts", () => {
  it("1. Question: one professional question, and the four authority facts of plan 9.5", () => {
    const detail = findDetail(view(), APPROVAL_DECISION);
    const question = getSqlite().prepare("select question from decisions where id = ?").get(APPROVAL_DECISION) as {
      question: string;
    };
    expect(detail?.question).toBe(question.question);
    expect(detail?.authoritySummary.prepared).toMatch(/cited documents/);
    expect(detail?.authoritySummary.decides).toMatch(/One of 4 options/);
    expect(detail?.authoritySummary.changes).toMatch(/records/);
    expect(detail?.authoritySummary.approval).toContain(getUser(RCSA_HOLDER)?.name ?? "missing");
  });

  it("2. Context: trigger, process stage, meeting, affected object, deadline and current position", () => {
    const bound = findDetail(view(), STAGE_BOUND_DECISION)?.context;
    expect(bound?.trigger.length).toBeGreaterThan(20);
    expect(bound?.triggerMeta).toContain("Presented at 07:45");
    // The stage contract binds this decision to RCSA Stage 2, which is the run's current stage.
    expect(bound?.process?.label).toContain("Stage 2: Evidence Refresh");
    expect(bound?.process?.href).toBe("/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh");
    expect(bound?.process?.detail).toBe("The process is at this stage");
    // The meeting on the same indicator.
    expect(bound?.meeting?.label).toContain("KRI-PAY-007");
    expect(bound?.meeting?.href).toContain("/workday/rcsa/work");
    expect(bound?.meeting?.href).toContain("MTG-2026-0006");
    expect(bound?.affected?.label).toContain("KRI-PAY-007");
    // The response due on the same subject, from the inbox, with its basis.
    expect(bound?.deadline?.label).toMatch(/Response due 12\.10\.2026 at 17:00/);
    expect(bound?.deadline?.basis).toContain("KRI-PAY-007");
    expect(bound?.currentPosition).toMatch(/Red at/);

    // A decision no stage names says so, rather than borrowing a process from its subject.
    const control = findDetail(view(), APPROVAL_DECISION)?.context;
    expect(control?.currentPosition).toMatch(/^Recorded as .+\. The first line assesses it as .+\.$/);
  });

  it("2. Context: a TPRM decision is honest that no running process waits on it", () => {
    const tprm = view({ roleId: "tprm", atMoment: "07:45" });
    const context = findDetail(tprm, "DEC-2026-0741")?.context;
    expect(context?.process).toBeNull();
    expect(context?.meeting?.href).toContain("MTG-2026-000");
    expect(context?.affected?.kindLabel).toBe("Supplier");
  });

  it("3. Evidence: strongest each way, conflict, stale source and uncertainty", () => {
    const evidence = findDetail(view({ roleId: "tprm", atMoment: "07:45" }), "DEC-2026-0741")?.evidence;
    expect(evidence?.strongestSupporting?.id).toBe("EVD-2026-40118");
    expect(evidence?.strongestOpposing?.id).toBe("EVD-2026-41435");
    expect(evidence?.conflict.state).toBe("conflicting");
    expect(evidence?.conflict.label).toMatch(/3 documents support .* 2 argue against/);
    // Both cited exit plan and DR report are marked stale in the corpus.
    expect(evidence?.stale.map((item) => item.id).sort()).toStrictEqual(["EVD-2026-40118", "EVD-2026-41435"]);
    expect(evidence?.uncertainty.length).toBeGreaterThan(20);
    expect(evidence?.preparedPosition.length).toBeGreaterThan(20);
  });

  it("4. Options: implication, affected systems and approval requirement, with nothing pre-selected", () => {
    const detail = findDetail(view(), APPROVAL_DECISION);
    expect(detail?.options.length).toBe(4);
    for (const option of detail?.options ?? []) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.implication.length).toBeGreaterThan(0);
      expect(option.systems.length).toBeGreaterThan(0);
      expect(option.approvalSummary.length).toBeGreaterThan(0);
      expect(option.refused).toBe(false);
    }
    const chain = detail?.options.find((option) => option.id === APPROVAL_OPTION);
    expect(chain?.changes.length).toBe(7);
    expect(chain?.systems).toContain("Control register");
    expect(chain?.approvalsNeeded).toBe(7);
    expect(chain?.approvalSummary).toBe(`7 approvals by ${getUser(RCSA_HOLDER)?.name}`);
  });

  it("5. Confirm and execute: every change carries its exact payload, target and binding", () => {
    const chain = findDetail(view(), APPROVAL_DECISION)?.options.find((option) => option.id === APPROVAL_OPTION);
    const plan = planDecisionOption({ decisionId: APPROVAL_DECISION, optionId: APPROVAL_OPTION });
    expect(chain?.changes.map((change) => change.fingerprint)).toStrictEqual(
      plan?.consequences.map((entry) => entry.fingerprint),
    );

    const rating = chain?.changes.find((change) => change.register === "Control register");
    expect(rating?.targetId).toBe("CTL-PAY-014");
    expect(rating?.label).toBe("Change the recorded control effectiveness");
    expect(rating?.fields).toContainEqual({ label: "Effectiveness", value: "Partially effective" });
    expect(rating?.fields).toContainEqual({ label: "Control", value: "CTL-PAY-014" });
    expect(rating?.system).toBe(LOCAL_SYSTEM.en);
    expect(rating?.reference).toHaveLength(12);
    expect(rating?.requiresApproval).toBe(true);
  });

  it("lists the TPRM Stage 4 gate, a stage decision the process engine publishes, with a link to the stage", () => {
    const tprm = view({ roleId: "tprm", atMoment: "07:45" });
    expect(tprm.stageRowsUnavailable).toBe(false);
    const gate = tprm.stageRows.find((row) => row.label === "Stage 4 gate");
    expect(gate).toBeDefined();
    expect(gate?.where).toBe("Third-Party Onboarding, Stage 4: Evidence Review");
    expect(gate?.href).toBe("/workday/tprm/processes/third-party-onboarding?stage=evidence-review");
    expect(gate?.options).toStrictEqual(["Pass the stage gate", "Pass with conditions", "Hold the file at Stage 4"]);
    expect(tprm.contextLine).toContain("1 in a process stage");
  });
});

/* ==========================================================================
   4. The authority gate, reused rather than reimplemented
   ========================================================================== */

describe("the authority position", () => {
  it("classifies every decision with a class from the existing registry", () => {
    for (const row of view().rows) {
      expect(AUTHORITY_CLASSES).toContain(row.authorityClass);
      expect(row.authorityLabel.length).toBeGreaterThan(0);
    }
  });

  it("marks a decision whose options need an approval, and one whose options do not", () => {
    const rows = view().rows;
    expect(rows.find((row) => row.decisionId === APPROVAL_DECISION)?.authorityClass).toBe("APPROVAL_REQUIRED");
    expect(rows.find((row) => row.decisionId === PROPOSAL_DECISION)?.authorityClass).toBe("PROPOSE");
    expect(findDetail(view(), PROPOSAL_DECISION)?.authority.requiresApproval).toBe(false);
  });

  it("names the accountable person from the roles and users tables", () => {
    const authority = findDetail(view(), APPROVAL_DECISION)?.authority;
    const holder = getUser(RCSA_HOLDER);
    expect(authority?.approverName).toBe(holder?.name);
    expect(authority?.approverTitle).toBe(holder?.jobTitle);
    expect(authority?.autonomyLabel).toBe("Act with approval");
  });

  it("refuses to confirm a class the gate cannot reach, and says why in the gate's words", () => {
    const low = findDetail(view({ autonomyLevel: "recommend" }), APPROVAL_DECISION);
    expect(low?.authority.reachable).toBe(false);
    expect(low?.authority.gateNote.toLowerCase()).toContain("autonomy level");
  });

  it("will not confirm without a choice, a rationale, the ownership confirmation and every approval", () => {
    const option = findDetail(view(), APPROVAL_DECISION)?.options.find((candidate) => candidate.id === APPROVAL_OPTION) ?? null;
    const all = new Set(requiredApprovals(option));
    const armed = {
      selectedOptionId: APPROVAL_OPTION,
      option,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      approved: all,
      authority: { reachable: true },
      pending: false,
    };
    expect(canConfirm(armed)).toBe(true);
    expect(canConfirm({ ...armed, selectedOptionId: null, option: null })).toBe(false);
    expect(canConfirm({ ...armed, rationale: "x".repeat(MINIMUM_RATIONALE_LENGTH - 1) })).toBe(false);
    expect(canConfirm({ ...armed, rationaleConfirmed: false })).toBe(false);
    expect(canConfirm({ ...armed, authority: { reachable: false } })).toBe(false);
    expect(canConfirm({ ...armed, pending: true })).toBe(false);

    // One tick does not approve every payload: each change is approved on its own.
    const oneShort = new Set([...all].slice(1));
    expect(allChangesApproved(option, oneShort)).toBe(false);
    expect(canConfirm({ ...armed, approved: oneShort })).toBe(false);
  });
});

/* ==========================================================================
   5. Confirming writes the trail that already existed
   ========================================================================== */

describe("confirming a decision", () => {
  it("is refused by the shared V1 and V2 server action when the rationale is unconfirmed", async () => {
    const before = {
      approvals: rowCount("approvals"),
      audit: rowCount("audit_events"),
      receipts: rowCount("execution_receipt_lines"),
    };

    const { actionRecordDecision } = await import("@app/actions");
    const result = await actionRecordDecision({
      decisionId: APPROVAL_DECISION,
      optionId: APPROVAL_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: false,
    });

    expect(result.ok).toBe(false);
    expect(result.blockedReasons).toContain("approval-not-confirmed");
    expect(rowCount("approvals")).toBe(before.approvals);
    expect(rowCount("audit_events")).toBe(before.audit);
    expect(rowCount("execution_receipt_lines")).toBe(before.receipts);
    expect(view().rows.map((row) => row.decisionId)).toContain(APPROVAL_DECISION);
  });

  it("writes the existing audit trail, approvals and receipt, and moves the decision to its receipt", async () => {
    const beforeAudit = rowCount("audit_events");
    const result = await recordDecisionAndExecute({
      decisionId: APPROVAL_DECISION,
      optionId: APPROVAL_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      actingRoleId: "rcsa",
    });

    expect(result.ok).toBe(true);
    expect(result.receiptStatements.length).toBeGreaterThan(1);
    expect(rowCount("audit_events")).toBeGreaterThan(beforeAudit);
    expect(rowCount("execution_receipt_lines")).toBe(result.receiptStatements.length);

    const recorded = auditEvents("recordDecision");
    expect(recorded.map((event) => event.objectId)).toContain(APPROVAL_DECISION);
    expect(recorded.every((event) => event.actorKind === "human")).toBe(true);
    expect(auditEvents("recordDecisionOutcome").map((event) => event.objectId)).toStrictEqual([APPROVAL_DECISION]);

    const model = view();
    expect(model.rows.map((row) => row.decisionId)).not.toContain(APPROVAL_DECISION);
    const row = model.recorded.find((entry) => entry.decisionId === APPROVAL_DECISION);
    expect(row?.status).toBe("recorded");
    expect(row?.receiptCount).toBe(result.receiptStatements.length);
    expect(row?.failedCount).toBe(0);
    expect(row?.chosenOptionLabel?.length).toBeGreaterThan(0);

    // A recorded decision has no five parts any more; it has its receipt.
    expect(findDetail(model, APPROVAL_DECISION)).toBeNull();
    const receipt = findRecorded(model, APPROVAL_DECISION);
    expect(receipt?.outcome).toBe("complete");
    expect(receipt?.executed.length).toBe(7);
    expect(receipt?.decidedByName).toBe(getUser(RCSA_HOLDER)?.name);
    expect(receipt?.approvalCount).toBe(7);
    expect(model.initialActiveId).not.toBe(APPROVAL_DECISION);
  });

  it("has no write path of its own anywhere in the feature", () => {
    const directory = join(process.cwd(), "src", "features", "decisions");
    const sources = readdirSync(directory)
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((name) => ({ name, body: readFileSync(join(directory, name), "utf8") }));

    expect(sources.length).toBeGreaterThan(5);

    // The one entry point to a mutation is the feature's server action, which calls the governed engine.
    const action = sources.find((file) => file.name === "actions.ts");
    expect(action?.body.startsWith('"use server";')).toBe(true);
    expect(action?.body).toMatch(/\brecordDecisionAndExecute\s*\(/);
    expect(sources.some((file) => file.name === "DecisionQueue.tsx" && file.body.includes('from "./actions"'))).toBe(true);

    for (const file of sources) {
      const body = file.body;
      expect(body, `${file.name} must not open a database handle`).not.toMatch(/\bgetDb\s*\(/);
      expect(body, `${file.name} must not insert rows`).not.toMatch(/\.insert\s*\(/);
      expect(body, `${file.name} must not grant approvals`).not.toMatch(/\bgrantApproval\s*\(/);
      expect(body, `${file.name} must not write audit events`).not.toMatch(/\brecordAuditEvent\s*\(/);
    }
  });
});

/* ==========================================================================
   6. Both languages, ASCII German, no em dash
   ========================================================================== */

describe("the copy", () => {
  /*
   * The characters this file must not contain are built from their code
   * points rather than written down, because the copy gate scans `tests` too.
   */
  const UMLAUT_CODES = [0x00c4, 0x00d6, 0x00dc, 0x00e4, 0x00f6, 0x00fc, 0x00df];
  const EM_DASH = String.fromCharCode(0x2014);
  const EN_DASH = String.fromCharCode(0x2013);
  const hasUmlaut = (value: string): boolean =>
    UMLAUT_CODES.some((code) => value.includes(String.fromCharCode(code)));

  const dictionaries: Array<[string, Record<string, Pair>]> = [
    ["STAGE_LABELS", STAGE_LABELS],
    ["STAGE_HINTS", STAGE_HINTS],
    ["AUTHORITY_LABELS", AUTHORITY_LABELS],
    ["JUDGMENT_LABELS", JUDGMENT_LABELS],
    ["CONSEQUENCE_LABELS", CONSEQUENCE_LABELS],
    ["RECEIPT_LABELS", RECEIPT_LABELS],
    ["TOOL_REGISTERS", TOOL_REGISTERS],
    ["PAYLOAD_FIELD_LABELS", PAYLOAD_FIELD_LABELS],
    ["VALUE_LABELS", VALUE_LABELS],
    ["SUBJECT_KIND_LABELS", SUBJECT_KIND_LABELS],
    ["REFUSAL_MESSAGES", REFUSAL_MESSAGES],
    ["COPY", COPY],
  ];

  it("gives every string an English and a German form", () => {
    for (const [name, dictionary] of dictionaries) {
      for (const [key, pair] of Object.entries(dictionary)) {
        expect(pair.en.length, `${name}.${key}.en`).toBeGreaterThan(0);
        expect(pair.de.length, `${name}.${key}.de`).toBeGreaterThan(0);
      }
    }
  });

  it("writes German in ASCII transliteration, with no umlaut and no sharp s", () => {
    for (const [name, dictionary] of dictionaries) {
      for (const [key, pair] of Object.entries(dictionary)) {
        expect(hasUmlaut(pair.de), `${name}.${key}.de carries a non ASCII character`).toBe(false);
      }
    }
    for (const [key, text] of Object.entries(DENIAL_REASONS_DE)) {
      expect(hasUmlaut(text), `DENIAL_REASONS_DE.${key}`).toBe(false);
    }
  });

  it("carries no em dash or en dash in either language, including the built models", async () => {
    for (const [name, dictionary] of dictionaries) {
      for (const [key, pair] of Object.entries(dictionary)) {
        for (const text of [pair.en, pair.de]) {
          expect(text.includes(EM_DASH), `${name}.${key}`).toBe(false);
          expect(text.includes(EN_DASH), `${name}.${key}`).toBe(false);
        }
      }
    }

    await recordDecisionAndExecute({
      decisionId: APPROVAL_DECISION,
      optionId: APPROVAL_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    for (const roleId of ["rcsa", "tprm"] as const) {
      for (const language of ["en", "de"] as const) {
        const serialised = JSON.stringify(view({ roleId, language }));
        expect(serialised.includes(EM_DASH), `the ${roleId} ${language} model carries an em dash`).toBe(false);
        expect(serialised.includes(EN_DASH), `the ${roleId} ${language} model carries an en dash`).toBe(false);
      }
    }
  });

  it("builds a German view whose own labels are German", async () => {
    const german = view({ language: "de" });
    expect(german.pageTitle).toBe("Entscheidungen");
    expect(german.contextLine).toContain("offen");
    expect(german.contextLine).toContain("heute erfasst");

    const row = german.rows.find((entry) => entry.decisionId === APPROVAL_DECISION);
    expect(row?.authorityLabel).toBe("Genehmigung erforderlich");
    expect(row?.judgmentLabel).toBe("Kontrollwirksamkeit");

    const titleDe = (
      getSqlite().prepare("select title_de as titleDe from decisions where id = ?").get(APPROVAL_DECISION) as {
        titleDe: string;
      }
    ).titleDe;
    expect(row?.headline).toBe(titleDe);

    const detail = findDetail(german, APPROVAL_DECISION);
    expect(detail?.proseIsEnglish).toBe(true);
    const rating = detail?.options
      .find((option) => option.id === APPROVAL_OPTION)
      ?.changes.find((change) => change.targetId === "CTL-PAY-014");
    expect(rating?.register).toBe("Kontrollregister");
    expect(rating?.fields).toContainEqual({ label: "Wirksamkeit", value: "Teilweise wirksam" });

    await recordDecisionAndExecute({
      decisionId: APPROVAL_DECISION,
      optionId: APPROVAL_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });
    const receipt = findRecorded(view({ language: "de" }), APPROVAL_DECISION);
    expect(receipt?.outcomeLine).toBe("Entscheidung erfasst. 7 von 7 Aenderungen ausgefuehrt.");
    // The German receipt is composed from German labels, not the handlers' English sentences.
    expect(receipt?.executed.some((change) => change.statements.some((line) => line.startsWith("Kontrollwirksamkeit geaendert")))).toBe(true);
  });
});

/* ==========================================================================
   7. The other roles
   ========================================================================== */

describe("every role", () => {
  it("builds a queue whose rows are distinct and whose first row is the active one", () => {
    const roles = ["rcsa", "tprm", "control-assurance", "incident-resilience"] as const;

    for (const roleId of roles) {
      const model = view({ roleId });
      const headlines = model.rows.map((row) => row.headline);
      expect(new Set(headlines).size, `${roleId} repeats a headline`).toBe(headlines.length);

      if (model.rows.length > 0) {
        expect(model.initialActiveId).toBe(model.rows[0]?.decisionId);
        expect(findDetail(model, model.initialActiveId)).not.toBeNull();
      } else {
        expect(model.initialActiveId).toBeNull();
      }

      expect(model.locationParts.length).toBeGreaterThan(0);
      expect(model.pageTitle).toBe("Decisions");
    }
  });

  it("plans every seeded option of both flagship roles without a refusal at the default autonomy level", () => {
    for (const roleId of ["rcsa", "tprm"] as const) {
      for (const moment of ["07:45", "11:45", "15:00", "16:30"]) {
        setMoment(moment);
        for (const detail of view({ roleId, atMoment: moment }).details) {
          for (const option of detail.options) {
            const refusals = option.changes.filter((change) => change.refusal !== null).map((change) => change.refusal);
            expect(refusals, `${roleId} ${option.id}`).toStrictEqual([]);
          }
        }
      }
    }
  });
});
