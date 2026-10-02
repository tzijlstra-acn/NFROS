/**
 * The V3.1 decision queue.
 *
 * Four claims are tested here, and each one is written to try to break the
 * thing the brief is specific about rather than to confirm that the code runs.
 *
 *   1. A queued row leads with what distinguishes that decision. The defect
 *      this feature replaces headed four rows "Record the decision", so the
 *      test asserts the headlines are distinct, that none of them is the
 *      shared action class, and that they are the seeded titles.
 *
 *   2. Exactly one decision is active. The model ships stage content for every
 *      open decision so selecting another is local, and the test asserts the
 *      stage machine is a single ordered sequence that clamps at both ends and
 *      refuses to advance without the input the next stage needs.
 *
 *   3. The authority position is the gate's, not this feature's. At an
 *      autonomy level that cannot reach APPROVAL_REQUIRED, a decision of that
 *      class is not confirmable, and the reason is the gate's own wording.
 *
 *   4. Confirm writes the existing trail. The decision is recorded through the
 *      existing server action and the existing engine, the audit events and
 *      receipt lines appear in the tables that already existed, and the
 *      feature module itself contains no write path at all.
 *
 * Runs against a temporary database. See `support/harness.ts`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase, rowCount } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { recordDecisionAndExecute } from "@/scenario/engine/decide";
import { setMoment } from "@/scenario/engine/state";
import { AUTHORITY_CLASSES } from "@/db/schema/decisions";
import { getUser } from "@/db/repositories/workday";
import { buildDecisionQueueView, shortParagraph } from "@/features/decisions/queue";
import {
  canAdvance,
  canConfirm,
  DECISION_STAGES,
  findDetail,
  isFirstStage,
  isLastStage,
  MINIMUM_RATIONALE_LENGTH,
  nextStage,
  previousStage,
  stageIndex,
  type DecisionQueueViewModel,
} from "@/features/decisions/model";
import {
  AUTHORITY_LABELS,
  CONSEQUENCE_LABELS,
  COPY,
  JUDGMENT_LABELS,
  STAGE_HINTS,
  STAGE_LABELS,
  type Pair,
} from "@/features/decisions/copy";

/** The moment at which both roles have four open decisions. */
const MOMENT = "11:45";

/** The RCSA control effectiveness decision. Every option needs an approval. */
const APPROVAL_DECISION = "DEC-2026-0772";
const APPROVAL_OPTION = "DEC-2026-0772-O3";

/** The RCSA workshop sequencing decision. No option needs an approval. */
const PROPOSAL_DECISION = "DEC-2026-0745";

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
  // Every test starts from the seeded morning, because the engine writes to
  // shared rows and an ordering dependency would make a failure here
  // impossible to interpret.
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

    /*
     * The defect, stated as an assertion. "Record the decision" is the shared
     * `humanAction` every decision item carries in the focus queue, and four
     * rows headed with it is what this feature exists to stop.
     */
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
   2. Exactly one active decision, moving through four ordered stages
   ========================================================================== */

describe("the active decision", () => {
  it("opens exactly one decision, and ships the stage content for all of them", () => {
    const model = view();
    expect(model.initialActiveId).toBe(model.rows[0]?.decisionId);
    expect(model.details.length).toBe(model.rows.length);

    // One identifier can only resolve one detail, which is what makes a second
    // expanded decision unrepresentable rather than merely discouraged.
    const active = findDetail(model, model.initialActiveId);
    expect(active?.decisionId).toBe(model.initialActiveId);
    expect(findDetail(model, null)).toBeNull();
    expect(findDetail(model, "DEC-does-not-exist")).toBeNull();

    const other = model.rows[2]?.decisionId ?? null;
    expect(findDetail(model, other)?.decisionId).toBe(other);
  });

  it("has four stages, in the order the brief sets", () => {
    expect([...DECISION_STAGES]).toStrictEqual(["understand", "compare", "explain", "confirm"]);
    expect(stageIndex("understand")).toBe(0);
    expect(stageIndex("confirm")).toBe(3);
  });

  it("moves forward and backward, and clamps at both ends", () => {
    expect(nextStage("understand")).toBe("compare");
    expect(nextStage("compare")).toBe("explain");
    expect(nextStage("explain")).toBe("confirm");
    expect(nextStage("confirm")).toBe("confirm");

    expect(previousStage("confirm")).toBe("explain");
    expect(previousStage("understand")).toBe("understand");

    expect(isFirstStage("understand")).toBe(true);
    expect(isLastStage("confirm")).toBe(true);
  });

  it("refuses to advance past a stage whose input is missing", () => {
    const empty = { selectedOptionId: null, rationale: "" };
    expect(canAdvance("understand", empty)).toBe(true);
    expect(canAdvance("compare", empty)).toBe(false);

    const chosen = { selectedOptionId: APPROVAL_OPTION, rationale: "" };
    expect(canAdvance("compare", chosen)).toBe(true);
    expect(canAdvance("explain", chosen)).toBe(false);
    expect(canAdvance("explain", { ...chosen, rationale: "x".repeat(MINIMUM_RATIONALE_LENGTH) })).toBe(
      true,
    );
  });

  it("gives each stage the content that stage is for", () => {
    const detail = findDetail(view(), APPROVAL_DECISION);
    expect(detail).not.toBeNull();
    if (!detail) return;

    // Understand: one short paragraph, plus the evidence count the trigger
    // opens the drawer with.
    expect(detail.understandParagraph.length).toBeGreaterThan(40);
    expect(detail.understandParagraph.length).toBeLessThanOrEqual(290);
    expect(detail.evidenceCount).toBeGreaterThan(0);

    // Compare: the options, with what each one implies.
    expect(detail.options.length).toBe(4);
    for (const option of detail.options) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.implication.length).toBeGreaterThan(0);
      expect(option.consequenceLabels.every((label) => label.length > 0)).toBe(true);
    }

    // Explain: what the AI prepared, separate from anything the reader writes.
    expect(detail.preparedPosition.length).toBeGreaterThan(0);
    expect(detail.uncertaintyNote.length).toBeGreaterThan(0);
    expect(detail.recordedRationale).toBe("");

    // Confirm: the authority position.
    expect(detail.authority.authorityClass).toBe("APPROVAL_REQUIRED");
  });

  it("translates every declared consequence into a plain line", () => {
    const detail = findDetail(view(), APPROVAL_DECISION);
    const option = detail?.options.find((candidate) => candidate.id === APPROVAL_OPTION);
    expect(option).toBeDefined();
    expect(option?.consequenceLabels.length).toBeGreaterThan(1);
    // A label that fell through to the raw kind would still contain a hyphen.
    expect(option?.consequenceLabels.some((label) => label.includes("-"))).toBe(false);
  });
});

/* ==========================================================================
   3. The authority gate, reused rather than reimplemented
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
    const approval = rows.find((row) => row.decisionId === APPROVAL_DECISION);
    const proposal = rows.find((row) => row.decisionId === PROPOSAL_DECISION);

    expect(approval?.authorityClass).toBe("APPROVAL_REQUIRED");
    expect(proposal?.authorityClass).toBe("PROPOSE");
    expect(findDetail(view(), PROPOSAL_DECISION)?.authority.requiresApproval).toBe(false);
  });

  it("names the accountable person from the roles and users tables", () => {
    const authority = findDetail(view(), APPROVAL_DECISION)?.authority;
    const holder = getUser(RCSA_HOLDER);
    expect(authority?.approverName).toBe(holder?.name);
    expect(authority?.approverTitle).toBe(holder?.jobTitle);
    expect(authority?.autonomyLabel).toBe("Act with approval");
  });

  it("refuses to confirm a class the gate cannot reach at the current autonomy level", () => {
    /*
     * At "recommend" the gate reaches READ, DRAFT and PROPOSE and nothing
     * else, so an APPROVAL_REQUIRED decision is not confirmable. The reason
     * shown is the gate's own, which is the point: a sentence written here
     * would drift from the rule that actually refuses the change.
     */
    const low = findDetail(view({ autonomyLevel: "recommend" }), APPROVAL_DECISION);
    expect(low?.authority.reachable).toBe(false);
    expect(low?.authority.gateNote.length).toBeGreaterThan(0);
    expect(low?.authority.gateNote.toLowerCase()).toContain("autonomy level");

    const armed = {
      selectedOptionId: APPROVAL_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
      pending: false,
    };
    expect(canConfirm({ ...armed, authority: { reachable: false } })).toBe(false);
    expect(canConfirm({ ...armed, authority: { reachable: true } })).toBe(true);
  });

  it("will not confirm without a choice, a rationale and the confirmation", () => {
    const authority = { reachable: true };
    expect(
      canConfirm({
        selectedOptionId: null,
        rationale: RATIONALE,
        rationaleConfirmed: true,
        authority,
        pending: false,
      }),
    ).toBe(false);

    expect(
      canConfirm({
        selectedOptionId: APPROVAL_OPTION,
        rationale: "too short",
        rationaleConfirmed: true,
        authority,
        pending: false,
      }),
    ).toBe(false);

    expect(
      canConfirm({
        selectedOptionId: APPROVAL_OPTION,
        rationale: RATIONALE,
        rationaleConfirmed: false,
        authority,
        pending: false,
      }),
    ).toBe(false);

    expect(
      canConfirm({
        selectedOptionId: APPROVAL_OPTION,
        rationale: RATIONALE,
        rationaleConfirmed: true,
        authority,
        pending: true,
      }),
    ).toBe(false);
  });
});

/* ==========================================================================
   4. Confirming writes the trail that already existed
   ========================================================================== */

describe("confirming a decision", () => {
  it("is refused by the existing server action when the rationale is unconfirmed", async () => {
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

    // The decision is still in the open queue, unchanged.
    expect(view().rows.map((row) => row.decisionId)).toContain(APPROVAL_DECISION);
  });

  it("writes the existing audit trail, approvals and receipt, and moves the row to recorded", async () => {
    const beforeAudit = rowCount("audit_events");
    const beforeApprovals = rowCount("approvals");

    /*
     * The governed engine the server action wraps. It is called directly here
     * rather than through the action because the action additionally calls
     * `revalidatePath`, which has no request to revalidate inside a test. The
     * refusal path above exercises the action itself.
     */
    const result = await recordDecisionAndExecute({
      decisionId: APPROVAL_DECISION,
      optionId: APPROVAL_OPTION,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    expect(result.ok).toBe(true);
    expect(result.receiptStatements.length).toBeGreaterThan(1);

    // The existing tables, not a second set.
    expect(rowCount("audit_events")).toBeGreaterThan(beforeAudit);
    expect(rowCount("approvals")).toBeGreaterThan(beforeApprovals);
    expect(rowCount("execution_receipt_lines")).toBeGreaterThan(0);

    const recorded = auditEvents("recordDecision");
    expect(recorded.map((event) => event.objectId)).toContain(APPROVAL_DECISION);
    expect(recorded.every((event) => event.actorKind === "human")).toBe(true);

    const model = view();
    expect(model.rows.map((row) => row.decisionId)).not.toContain(APPROVAL_DECISION);

    const row = model.recorded.find((entry) => entry.decisionId === APPROVAL_DECISION);
    expect(row).toBeDefined();
    expect(row?.status).toBe("recorded");
    expect(row?.receiptCount).toBeGreaterThan(0);
    expect(row?.chosenOptionLabel?.length).toBeGreaterThan(0);

    // A recorded decision is a record rather than a task, so it carries no
    // stage content and cannot become the active decision.
    expect(findDetail(model, APPROVAL_DECISION)).toBeNull();
    expect(model.initialActiveId).not.toBe(APPROVAL_DECISION);
  });

  it("has no write path of its own anywhere in the feature", () => {
    const directory = join(process.cwd(), "src", "features", "decisions");
    const sources = readdirSync(directory)
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .map((name) => ({ name, body: readFileSync(join(directory, name), "utf8") }));

    expect(sources.length).toBeGreaterThan(3);

    // The one entry point to a mutation, and it is the existing action.
    expect(sources.some((file) => file.body.includes('from "@app/actions"'))).toBe(true);

    /*
     * Nothing in this feature may open a database handle, insert a row, grant
     * an approval or write an audit event. A parallel trail would be the worst
     * thing this screen could add, so it is asserted rather than reviewed.
     */
    for (const file of sources) {
      const body = file.body;
      expect(body, `${file.name} must not open a database handle`).not.toMatch(/\bgetDb\s*\(/);
      expect(body, `${file.name} must not insert rows`).not.toMatch(/\.insert\s*\(/);
      expect(body, `${file.name} must not grant approvals`).not.toMatch(/\bgrantApproval\s*\(/);
      expect(body, `${file.name} must not write audit events`).not.toMatch(
        /\brecordAuditEvent\s*\(/,
      );
    }
  });
});

/* ==========================================================================
   5. Both languages, ASCII German, no em dash
   ========================================================================== */

describe("the copy", () => {
  /*
   * The characters this file must not contain are built from their code
   * points rather than written down. Writing them literally would make the
   * test the one place in the repository that carries an em dash and a set
   * of umlauts, and the copy gate at `scripts/check-no-emdash.mjs` scans
   * `tests` as well as `src`, so the test asserting the rule would be the
   * thing that broke it.
   */
  const UMLAUT_CODES = [0x00c4, 0x00d6, 0x00dc, 0x00e4, 0x00f6, 0x00fc, 0x00df];
  const EM_DASH = String.fromCharCode(0x2014);
  const hasUmlaut = (value: string): boolean =>
    UMLAUT_CODES.some((code) => value.includes(String.fromCharCode(code)));

  const dictionaries: Array<[string, Record<string, Pair>]> = [
    ["STAGE_LABELS", STAGE_LABELS],
    ["STAGE_HINTS", STAGE_HINTS],
    ["AUTHORITY_LABELS", AUTHORITY_LABELS],
    ["JUDGMENT_LABELS", JUDGMENT_LABELS],
    ["CONSEQUENCE_LABELS", CONSEQUENCE_LABELS],
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
  });

  it("carries no em dash in either language, including the built model", () => {
    for (const [name, dictionary] of dictionaries) {
      for (const [key, pair] of Object.entries(dictionary)) {
        expect(pair.en.includes(EM_DASH), `${name}.${key}.en`).toBe(false);
        expect(pair.de.includes(EM_DASH), `${name}.${key}.de`).toBe(false);
      }
    }

    for (const language of ["en", "de"] as const) {
      const serialised = JSON.stringify(view({ language }));
      expect(serialised.includes(EM_DASH), `the ${language} model carries an em dash`).toBe(false);
    }
  });

  it("builds a German view whose own labels are German", () => {
    const german = view({ language: "de" });
    expect(german.pageTitle).toBe("Entscheidungen");
    expect(german.contextLine).toContain("offen");
    expect(german.contextLine).toContain("heute erfasst");

    const row = german.rows.find((entry) => entry.decisionId === APPROVAL_DECISION);
    expect(row?.authorityLabel).toBe("Genehmigung erforderlich");
    expect(row?.judgmentLabel).toBe("Kontrollwirksamkeit");

    // The German title comes from the seed's own `titleDe`, not from English.
    const titleDe = (
      getSqlite()
        .prepare("select title_de as titleDe from decisions where id = ?")
        .get(APPROVAL_DECISION) as { titleDe: string }
    ).titleDe;
    expect(row?.headline).toBe(titleDe);
  });
});

/* ==========================================================================
   6. The other roles
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
});
