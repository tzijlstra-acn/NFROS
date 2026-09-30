/**
 * Scenario integration tests: the migration, the seed and the seeded day.
 *
 * These run against a real SQLite file in the system temporary directory, not
 * against the developer's database. See `tests/integration/support/harness.ts`
 * for how that isolation is enforced.
 *
 * The framing is adversarial in a specific way. A seeded demonstration is easy
 * to make look complete and very easy to leave internally inconsistent: a
 * decision that cites an evidence document nobody wrote, a control test
 * pointing at a control that was renamed, a consequence whose target does not
 * exist. None of that shows up when a presenter clicks the happy path, and all
 * of it shows up the moment an auditor asks to see the source. So the tests
 * here resolve every declared reference and report what dangles.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  columnValues,
  createTemporaryDatabase,
  destroyTemporaryDatabase,
  rowCount,
  rowCounts,
  tableNames,
} from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario, type SeedSummary } from "@/db/seed/run";
import {
  getRoleMoments,
  getScenarioState,
  getTimeline,
  requireScenarioState,
  setMoment,
} from "@/scenario/engine/state";
import {
  getAllEvidenceDocuments,
  getBackgroundWork,
  getControlTest,
  getDecisions,
  getInbox,
  getIncidentTimeline,
  getPopulationSummary,
  getSharedEventIncident,
} from "@/db/repositories/workday";
import { CONTROL_EFFECTIVENESS, momentToMinutes } from "@/domain/nfr/calculators";
import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "@/db/schema/core";

/** The schema tables the application reads. Missing any one of them is fatal. */
const EXPECTED_TABLES = [
  "actions",
  "agent_messages",
  "agent_runs",
  "agent_sessions",
  "approvals",
  "assessment_lines",
  "assessments",
  "audit_events",
  "background_actions",
  "cached_ai_outputs",
  "calendar_events",
  "collaboration_messages",
  "committee_items",
  "contract_obligations",
  "contracts",
  "control_tests",
  "controls",
  "decision_options",
  "decisions",
  "evidence_chunks",
  "evidence_documents",
  "execution_receipt_lines",
  "impact_tolerances",
  "inbox_messages",
  "incident_events",
  "incidents",
  "issues",
  "kri_readings",
  "kris",
  "legal_entities",
  "meeting_messages",
  "meetings",
  "monitoring_activations",
  "obligations",
  "policies",
  "portfolio_themes",
  "processes",
  "recovery_options",
  "regulatory_publications",
  "risks",
  "roles",
  "scenario_runs",
  "service_dependencies",
  "services",
  "subprocessors",
  "suppliers",
  "test_cases",
  "timeline_events",
  "timeline_role_moments",
  "tool_calls",
  "users",
] as const;

/** Tables whose row count is compared across two seeds. */
const COUNTED_TABLES: readonly string[] = [...EXPECTED_TABLES, "evidence_chunks_fts"];

/**
 * Columns compared across two seeds.
 *
 * Identifiers plus the content decisions turn on. Timestamps are excluded on
 * purpose: `createdAt` and `seededAt` are wall clock values, and the seed's
 * determinism claim is about content, not about clocks.
 */
const IDENTITY_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["decisions", "id"],
  ["decisions", "title"],
  ["decision_options", "id"],
  ["decision_options", "consequences"],
  ["controls", "id"],
  ["controls", "current_effectiveness"],
  ["evidence_documents", "id"],
  ["evidence_documents", "revealed_at_moment"],
  ["evidence_chunks", "id"],
  ["evidence_chunks", "content"],
  ["test_cases", "id"],
  ["test_cases", "outcome"],
  ["incident_events", "id"],
  ["incident_events", "statement"],
  ["timeline_role_moments", "id"],
  ["background_actions", "id"],
  ["audit_events", "action"],
];

let firstSeed: SeedSummary;
let firstCounts: Record<string, number>;
const firstContent = new Map<string, string[]>();

beforeAll(() => {
  createTemporaryDatabase("scenario");
  firstSeed = seedScenario();
  firstCounts = rowCounts(COUNTED_TABLES);
  for (const [table, column] of IDENTITY_COLUMNS) {
    firstContent.set(`${table}.${column}`, columnValues(table, column));
  }
});

afterAll(() => {
  destroyTemporaryDatabase();
});

/* ==========================================================================
   Migration
   ========================================================================== */

describe("the migration", () => {
  it("creates every table the application reads", () => {
    const present = new Set(tableNames());
    for (const table of EXPECTED_TABLES) {
      expect(present.has(table), `table ${table} is missing`).toBe(true);
    }
  });

  it("creates the full text index and its synchronisation triggers", () => {
    // Without the virtual table, lexical retrieval returns nothing and the
    // product's offline search claim is false.
    expect(tableNames()).toContain("evidence_chunks_fts");

    const triggers = (
      getSqlite()
        .prepare("select name from sqlite_master where type = 'trigger' order by name")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    expect(triggers).toContain("evidence_chunks_fts_insert");
    expect(triggers).toContain("evidence_chunks_fts_delete");
    expect(triggers).toContain("evidence_chunks_fts_update");
  });

  it("enforces foreign keys and uses write ahead logging", () => {
    expect(getSqlite().pragma("foreign_keys", { simple: true })).toBe(1);
    expect(String(getSqlite().pragma("journal_mode", { simple: true })).toLowerCase()).toBe("wal");
  });
});

/* ==========================================================================
   Seed
   ========================================================================== */

describe("the seed", () => {
  it("writes a substantial day rather than a stub", () => {
    expect(firstSeed.rowsWritten).toBeGreaterThan(500);
    expect(firstSeed.tablesWritten).toBeGreaterThan(30);
  });

  it("writes a plausible number of rows to every table the day depends on", () => {
    // Each figure below is a floor, not an expected value. The point is that
    // no lane of the work model is empty, because an empty lane produces a
    // screen that renders and says nothing.
    const floors: Record<string, number> = {
      legal_entities: 3,
      users: 10,
      roles: 6,
      timeline_events: 10,
      timeline_role_moments: 6,
      policies: 1,
      suppliers: 1,
      subprocessors: 1,
      services: 1,
      service_dependencies: 1,
      impact_tolerances: 1,
      contracts: 1,
      contract_obligations: 1,
      processes: 1,
      risks: 1,
      controls: 1,
      kris: 1,
      kri_readings: 1,
      assessments: 1,
      assessment_lines: 1,
      control_tests: 1,
      test_cases: 10,
      incidents: 1,
      incident_events: 5,
      recovery_options: 1,
      regulatory_publications: 1,
      obligations: 1,
      evidence_documents: 20,
      evidence_chunks: 20,
      inbox_messages: 6,
      calendar_events: 6,
      meetings: 1,
      meeting_messages: 1,
      collaboration_messages: 1,
      issues: 1,
      actions: 1,
      decisions: 12,
      decision_options: 24,
      committee_items: 1,
      portfolio_themes: 1,
      background_actions: 12,
      audit_events: 1,
    };

    for (const [table, floor] of Object.entries(floors)) {
      expect(rowCount(table), `${table} has too few rows`).toBeGreaterThanOrEqual(floor);
    }
  });

  it("indexes every evidence chunk for lexical retrieval", () => {
    // The triggers only help if they fired during the seed. A chunk that is
    // not in the index cannot be retrieved, and nothing else would say so.
    expect(rowCount("evidence_chunks")).toBeGreaterThan(0);
    expect(rowCount("evidence_chunks_fts")).toBe(rowCount("evidence_chunks"));
  });

  it("is deterministic: a second seed writes the same number of rows", () => {
    const secondSeed = seedScenario();
    expect(secondSeed.rowsWritten).toBe(firstSeed.rowsWritten);
    expect(secondSeed.tablesWritten).toBe(firstSeed.tablesWritten);
    expect(secondSeed.counts).toStrictEqual(firstSeed.counts);
    expect(rowCounts(COUNTED_TABLES)).toStrictEqual(firstCounts);
  });

  it("is deterministic: a second seed writes the same key content", () => {
    // Runs after the reseed above, comparing against the capture taken before
    // it. Order matters here, which is why the reseed is its own test.
    for (const [table, column] of IDENTITY_COLUMNS) {
      const before = firstContent.get(`${table}.${column}`);
      expect(before, `${table}.${column} was not captured`).toBeDefined();
      expect(columnValues(table, column), `${table}.${column} changed between seeds`).toStrictEqual(
        before,
      );
    }
  });
});

/* ==========================================================================
   The run and its starting state
   ========================================================================== */

describe("the scenario run", () => {
  it("exists with the documented starting state", () => {
    const state = requireScenarioState();
    expect(state.runId).toBe(DEFAULT_RUN_ID);
    expect(state.currentMoment).toBe("07:45");
    expect(state.worldView).toBe("future");
    expect(state.autonomyLevel).toBe("act-with-approval");
    expect(state.eventTriggered).toBe(false);
    expect(state.language).toBe("en");
    expect(state.activeRoleId).toBe("rcsa");
    expect(state.scenarioDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has a timeline that starts at 07:45 and contains the 14:05 shared event", () => {
    const timeline = getTimeline();
    expect(timeline.length).toBeGreaterThanOrEqual(10);
    expect(timeline[0]?.moment).toBe("07:45");

    const sharedEvents = timeline.filter((moment) => moment.isSharedEvent);
    expect(sharedEvents.length).toBe(1);
    expect(sharedEvents[0]?.moment).toBe("14:05");
  });

  it("orders the timeline monotonically by clock time", () => {
    const timeline = getTimeline();
    for (let i = 1; i < timeline.length; i += 1) {
      const previous = timeline[i - 1];
      const current = timeline[i];
      if (!previous || !current) continue;
      expect(
        momentToMinutes(current.moment),
        `${previous.moment} is not before ${current.moment}`,
      ).toBeGreaterThan(momentToMinutes(previous.moment));
    }
  });
});

describe("every role", () => {
  it("has decisions across the day", () => {
    for (const roleId of ROLE_IDS) {
      // 23:59 means "everything the day holds", not "visible now".
      const entries = getDecisions(roleId, "23:59");
      expect(entries.length, `${roleId} has no decisions`).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.options.length, `${entry.decision.id} has no options`).toBeGreaterThanOrEqual(
          2,
        );
      }
    }
  });

  it("has at least one decision presented in the morning brief at 07:45", () => {
    for (const roleId of ROLE_IDS) {
      const morning = getDecisions(roleId, "07:45");
      expect(morning.length, `${roleId} opens the day with nothing to decide`).toBeGreaterThan(0);
    }
  });

  it("opens every decision unchosen, with no rationale written for the human", () => {
    for (const roleId of ROLE_IDS) {
      for (const entry of getDecisions(roleId, "23:59")) {
        expect(entry.decision.status, `${entry.decision.id}`).toBe("open");
        expect(entry.decision.chosenOptionId).toBeNull();
        expect(entry.decision.recordedRationale).toBe("");
        expect(entry.decision.decidedByUserId).toBeNull();
        // Options may be recommended, but a recommendation is not a selection.
        const recommended = entry.options.filter((option) => option.isRecommended);
        expect(recommended.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("states uncertainty and cites both sides on every decision", () => {
    for (const roleId of ROLE_IDS) {
      for (const entry of getDecisions(roleId, "23:59")) {
        const decision = entry.decision;
        expect(
          decision.uncertaintyNote.length,
          `${decision.id} states no uncertainty`,
        ).toBeGreaterThan(20);
        expect(
          decision.supportingEvidenceIds.length,
          `${decision.id} cites no supporting evidence`,
        ).toBeGreaterThan(0);
        expect(
          decision.opposingEvidenceIds.length,
          `${decision.id} cites no opposing evidence`,
        ).toBeGreaterThan(0);
        expect(decision.confidence).toBeGreaterThan(0);
        expect(decision.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it("has background actions with inspectable targets", () => {
    for (const roleId of ROLE_IDS) {
      const background = getBackgroundWork(roleId, "23:59");
      expect(background.total, `${roleId} has no background actions`).toBeGreaterThan(0);
      for (const action of background.actions) {
        expect(action.targetId.length, `${action.id} has no target`).toBeGreaterThan(0);
        expect(action.description.length).toBeGreaterThan(20);
      }
    }
  });

  it("has a timeline role moment for every moment of the day", () => {
    const timeline = getTimeline();
    for (const roleId of ROLE_IDS) {
      const moments = getRoleMoments(roleId);
      const missing = moments
        .filter((entry) => entry.roleMoment === undefined || entry.roleMoment === null)
        .map((entry) => entry.event.moment);
      expect(missing, `${roleId} has no role moment at ${missing.join(", ")}`).toStrictEqual([]);
      expect(moments.length).toBe(timeline.length);
    }
  });

  it("gives each role moment both a Today and a future narrative", () => {
    for (const roleId of ROLE_IDS) {
      for (const entry of getRoleMoments(roleId)) {
        const moment = entry.roleMoment;
        if (!moment) continue;
        // The toggle compares the same screen in two states. An empty side
        // makes the comparison decorative.
        expect(moment.todayNarrative.length, `${moment.id} has no Today narrative`).toBeGreaterThan(
          20,
        );
        expect(
          moment.futureNarrative.length,
          `${moment.id} has no future narrative`,
        ).toBeGreaterThan(20);
      }
    }
  });
});

/* ==========================================================================
   Referential integrity
   ========================================================================== */

/** Identifier sets per object family. */
function identifierIndex(): Map<string, Set<string>> {
  const tables = [
    "legal_entities",
    "users",
    "roles",
    "policies",
    "suppliers",
    "subprocessors",
    "services",
    "impact_tolerances",
    "contracts",
    "contract_obligations",
    "processes",
    "risks",
    "controls",
    "kris",
    "assessments",
    "assessment_lines",
    "control_tests",
    "test_cases",
    "incidents",
    "incident_events",
    "recovery_options",
    "regulatory_publications",
    "obligations",
    "evidence_documents",
    "inbox_messages",
    "meetings",
    "issues",
    "actions",
    "decisions",
    "decision_options",
    "committee_items",
    "portfolio_themes",
  ];

  const index = new Map<string, Set<string>>();
  for (const table of tables) {
    const rows = getSqlite().prepare(`select id from "${table}"`).all() as Array<{ id: string }>;
    index.set(
      table,
      new Set(rows.map((row) => row.id)),
    );
  }
  return index;
}

/**
 * Consequence kinds whose executing tool loads the target row and throws when
 * it is absent.
 *
 * A dangling reference here is a consequence that cannot execute at all: the
 * decision records, the approval is granted and consumed, and the receipt
 * carries a blocked reason instead of the change the option promised.
 */
const HARD_LOOKUP_TARGET_TABLE: Record<string, string> = {
  "set-control-effectiveness": "controls",
  "version-assessment": "assessments",
  "set-residual-risk": "assessment_lines",
  "set-supplier-criticality": "suppliers",
  "record-test-conclusion": "control_tests",
  "select-recovery-option": "recovery_options",
};

/**
 * Consequence kinds whose executing tool writes without resolving the target.
 *
 * These are worse in one respect and better in another. They do not fail, so
 * the decision completes and the receipt reads as a success. What they write
 * is either an update that matched no row or a record pointing at an object
 * that does not exist. Both produce a confident statement about a change that
 * did not happen, which is precisely the failure mode the execution receipt
 * exists to prevent.
 */
const SILENT_WRITE_TARGET_TABLE: Record<string, string> = {
  "create-reassessment": "processes",
  "add-committee-item": "decisions",
  "record-supplier-assessment": "suppliers",
  "apply-supplier-restriction": "suppliers",
  "classify-test-exception": "test_cases",
  "record-finding": "control_tests",
  "classify-incident": "incidents",
  "escalate-incident": "incidents",
  "record-notification-recommendation": "incidents",
  "capture-lessons-learned": "incidents",
  "record-obligation-interpretation": "obligations",
  "set-portfolio-materiality": "portfolio_themes",
};

/** For `activate-monitoring`, the declared `value` names the subject family. */
const MONITORING_SUBJECT_TABLE: Record<string, string> = {
  supplier: "suppliers",
  control: "controls",
  kri: "kris",
  risk: "risks",
  service: "services",
  process: "processes",
  obligation: "obligations",
  "impact-tolerance": "impact_tolerances",
  "portfolio-theme": "portfolio_themes",
};

/** Kinds that attach to a related object of any family. */
const ANY_OBJECT_KINDS = new Set([
  "create-action",
  "create-issue",
  "send-collaboration-message",
  "request-factual-validation",
  "request-evidence",
]);

interface SeededConsequence {
  kind: string;
  targetId: string;
  value?: string;
  note?: string;
}

function seededOptionConsequences(): Array<{ optionId: string; consequence: SeededConsequence }> {
  const rows = getSqlite()
    .prepare("select id, consequences from decision_options order by id")
    .all() as Array<{ id: string; consequences: string }>;

  const out: Array<{ optionId: string; consequence: SeededConsequence }> = [];
  for (const row of rows) {
    const parsed = JSON.parse(row.consequences) as SeededConsequence[];
    for (const consequence of parsed) out.push({ optionId: row.id, consequence });
  }
  return out;
}

describe("referential integrity", () => {
  it("resolves every evidence identifier cited by a decision", () => {
    const documents = identifierIndex().get("evidence_documents") ?? new Set<string>();
    const dangling: string[] = [];

    for (const roleId of ROLE_IDS) {
      for (const entry of getDecisions(roleId, "23:59")) {
        const decision = entry.decision;
        for (const id of decision.supportingEvidenceIds) {
          if (!documents.has(id)) dangling.push(`${decision.id} supporting -> ${id}`);
        }
        for (const id of decision.opposingEvidenceIds) {
          if (!documents.has(id)) dangling.push(`${decision.id} opposing -> ${id}`);
        }
      }
    }

    // A citation that does not resolve is the most damaging defect this
    // product can carry, because the whole claim is that every statement can
    // be opened at its source.
    expect(dangling, `dangling evidence citations: ${dangling.join("; ")}`).toStrictEqual([]);
  });

  it("resolves the control behind every control test", () => {
    const controls = identifierIndex().get("controls") ?? new Set<string>();
    const rows = getSqlite()
      .prepare("select id, control_id as controlId from control_tests")
      .all() as Array<{ id: string; controlId: string }>;

    expect(rows.length).toBeGreaterThan(0);
    const dangling = rows
      .filter((row) => !controls.has(row.controlId))
      .map((row) => `${row.id} -> ${row.controlId}`);
    expect(dangling, `control tests pointing at no control: ${dangling.join("; ")}`).toStrictEqual(
      [],
    );
  });

  it("resolves the control test behind every test case", () => {
    const tests = identifierIndex().get("control_tests") ?? new Set<string>();
    const rows = getSqlite()
      .prepare("select id, control_test_id as testId from test_cases")
      .all() as Array<{ id: string; testId: string }>;

    const dangling = rows
      .filter((row) => !tests.has(row.testId))
      .map((row) => `${row.id} -> ${row.testId}`);
    expect(dangling, `test cases pointing at no test: ${dangling.join("; ")}`).toStrictEqual([]);
  });

  it("resolves every consequence target the executing tool looks up", () => {
    // These are the consequences that cannot execute when the target is
    // missing, so a dangling reference is a decision that cannot complete.
    const index = identifierIndex();
    const consequences = seededOptionConsequences();
    expect(consequences.length).toBeGreaterThan(0);

    const dangling: string[] = [];
    for (const { optionId, consequence } of consequences) {
      const table = HARD_LOOKUP_TARGET_TABLE[consequence.kind];
      if (!table) continue;
      const ids = index.get(table) ?? new Set<string>();
      if (!ids.has(consequence.targetId)) {
        dangling.push(`${optionId} ${consequence.kind} -> ${consequence.targetId} (${table})`);
      }
    }

    expect(
      dangling,
      `consequences whose target does not exist and whose tool will throw: ${dangling.join("; ")}`,
    ).toStrictEqual([]);
  });

  it("resolves every consequence target the executing tool writes against", () => {
    // These do not throw. They update no row, or record a reference to an
    // object that is not there, and still return a success receipt line.
    const index = identifierIndex();
    const consequences = seededOptionConsequences();

    const dangling: string[] = [];
    for (const { optionId, consequence } of consequences) {
      const table = SILENT_WRITE_TARGET_TABLE[consequence.kind];
      if (table) {
        const ids = index.get(table) ?? new Set<string>();
        if (!ids.has(consequence.targetId)) {
          dangling.push(`${optionId} ${consequence.kind} -> ${consequence.targetId} (${table})`);
        }
        continue;
      }

      if (consequence.kind === "activate-monitoring") {
        const subjectKind = consequence.value ?? "supplier";
        const subjectTable = MONITORING_SUBJECT_TABLE[subjectKind];
        if (!subjectTable) {
          dangling.push(`${optionId} activate-monitoring names subject kind "${subjectKind}"`);
          continue;
        }
        const ids = index.get(subjectTable) ?? new Set<string>();
        if (!ids.has(consequence.targetId)) {
          dangling.push(
            `${optionId} activate-monitoring -> ${consequence.targetId} (${subjectTable})`,
          );
        }
      }
    }

    expect(
      dangling,
      `consequences that would write a reference to nothing: ${dangling.join("; ")}`,
    ).toStrictEqual([]);
  });

  it("resolves every loosely attached consequence target to some real object", () => {
    const index = identifierIndex();
    const allIds = new Set<string>();
    for (const ids of index.values()) for (const id of ids) allIds.add(id);

    // Committees are named by their reference rather than by a row identifier,
    // and a related object may legitimately be one.
    for (const row of getSqlite()
      .prepare("select distinct committee_ref as ref from committee_items")
      .all() as Array<{ ref: string }>) {
      allIds.add(row.ref);
    }

    const dangling: string[] = [];
    for (const { optionId, consequence } of seededOptionConsequences()) {
      if (!ANY_OBJECT_KINDS.has(consequence.kind)) continue;
      if (!allIds.has(consequence.targetId)) {
        dangling.push(`${optionId} ${consequence.kind} -> ${consequence.targetId}`);
      }
    }

    expect(
      dangling,
      `consequences attached to an identifier that names nothing: ${dangling.join("; ")}`,
    ).toStrictEqual([]);
  });

  it("declares only consequence kinds the engine can execute", () => {
    // A kind the engine cannot map produces a blocked reason on the receipt,
    // so a typo in seeded data degrades a decision quietly.
    const implemented = new Set([
      ...Object.keys(HARD_LOOKUP_TARGET_TABLE),
      ...Object.keys(SILENT_WRITE_TARGET_TABLE),
      ...ANY_OBJECT_KINDS,
      "activate-monitoring",
    ]);

    const unknown = new Set<string>();
    for (const { consequence } of seededOptionConsequences()) {
      if (!implemented.has(consequence.kind)) unknown.add(consequence.kind);
    }

    expect(Array.from(unknown).sort(), "consequence kinds with no engine mapping").toStrictEqual([]);
  });

  it("uses only valid control effectiveness values, seeded and declared", () => {
    // `updateControlRating` writes this string straight onto the control row,
    // and the risk calculator indexes its reduction tables by it, so a value
    // outside the vocabulary produces a residual position that is not a number.
    const valid = new Set<string>(CONTROL_EFFECTIVENESS);
    const offending: string[] = [];

    const seeded = getSqlite()
      .prepare("select id, current_effectiveness as effectiveness from controls")
      .all() as Array<{ id: string; effectiveness: string }>;
    for (const row of seeded) {
      if (!valid.has(row.effectiveness)) offending.push(`control ${row.id} = ${row.effectiveness}`);
    }

    for (const { optionId, consequence } of seededOptionConsequences()) {
      if (consequence.kind !== "set-control-effectiveness") continue;
      const value = consequence.value ?? "partially-effective";
      if (!valid.has(value)) offending.push(`option ${optionId} sets "${value}"`);
    }

    expect(
      offending,
      `invalid control effectiveness values: ${offending.join("; ")}`,
    ).toStrictEqual([]);
  });

  it("resolves every evidence chunk to its document", () => {
    const documents = identifierIndex().get("evidence_documents") ?? new Set<string>();
    const rows = getSqlite()
      .prepare("select id, document_id as documentId from evidence_chunks")
      .all() as Array<{ id: string; documentId: string }>;

    const dangling = rows
      .filter((row) => !documents.has(row.documentId))
      .map((row) => `${row.id} -> ${row.documentId}`);
    expect(dangling).toStrictEqual([]);
  });

  it("resolves the timeline event behind every role moment", () => {
    const timelineIds = new Set(getTimeline().map((moment) => moment.id));
    const rows = getSqlite()
      .prepare("select id, timeline_event_id as eventId from timeline_role_moments")
      .all() as Array<{ id: string; eventId: string }>;

    const dangling = rows
      .filter((row) => !timelineIds.has(row.eventId))
      .map((row) => `${row.id} -> ${row.eventId}`);
    expect(dangling).toStrictEqual([]);
  });
});

/* ==========================================================================
   The control test population
   ========================================================================== */

/** The control test that carries the disputed CTL-PAY-014 conclusion. */
function centralControlTestId(): string {
  const row = getSqlite()
    .prepare(
      "select id from control_tests where control_id = 'CTL-PAY-014' order by exception_count desc, id limit 1",
    )
    .get() as { id: string } | undefined;
  if (!row) throw new Error("The seed holds no control test against CTL-PAY-014.");
  return row.id;
}

describe("the control test population", () => {
  it("returns the full seeded population rather than only the sample", () => {
    const controlTestId = centralControlTestId();
    const summary = getPopulationSummary(controlTestId);
    const seededRows = (
      getSqlite()
        .prepare("select count(*) as n from test_cases where control_test_id = ?")
        .get(controlTestId) as { n: number }
    ).n;

    expect(summary.total).toBe(seededRows);
    expect(summary.cases.length).toBe(summary.total);
    expect(summary.sampled).toBeGreaterThan(0);
    expect(summary.total).toBeGreaterThan(summary.sampled);
  });

  it("computes an exception count that matches the recorded one", () => {
    const controlTestId = centralControlTestId();
    const test = getControlTest(controlTestId);
    expect(test).toBeDefined();
    const summary = getPopulationSummary(controlTestId);

    // The recorded count is a stated number on the test row; the summary count
    // is computed from the case rows. If they disagree, one of the two is
    // lying to whoever reads it.
    expect(summary.exceptions).toBe(test?.exceptionCount);
  });

  it("computes the breakdown from the same rows as the total", () => {
    const summary = getPopulationSummary(centralControlTestId());
    const byReason = summary.byRepairReason.reduce((sum, row) => sum + row.count, 0);
    expect(byReason).toBe(summary.total);
    expect(summary.exceptionCases.length).toBe(summary.exceptions);
    expect(summary.anomalyCases.length).toBe(summary.anomalies);
  });
});

/* ==========================================================================
   Reveal semantics
   ========================================================================== */

/** The first inbox message in the day that is not visible at 07:45. */
function findLaterRevealedInboxMessage(): {
  id: string;
  roleId: RoleId;
  revealedAtMoment: string;
} | null {
  const rows = getSqlite()
    .prepare(
      "select id, role_id as roleId, revealed_at_moment as revealedAtMoment from inbox_messages order by revealed_at_moment, id",
    )
    .all() as Array<{ id: string; roleId: RoleId; revealedAtMoment: string }>;

  return (
    rows.find((row) => momentToMinutes(row.revealedAtMoment) > momentToMinutes("07:45")) ?? null
  );
}

/** The first evidence document in the day that is not visible at 07:45. */
function findLaterRevealedEvidence(): { id: string; revealedAtMoment: string } | null {
  const rows = getSqlite()
    .prepare(
      "select id, revealed_at_moment as revealedAtMoment from evidence_documents order by revealed_at_moment, id",
    )
    .all() as Array<{ id: string; revealedAtMoment: string }>;

  return (
    rows.find((row) => momentToMinutes(row.revealedAtMoment) > momentToMinutes("07:45")) ?? null
  );
}

describe("reveal semantics", () => {
  afterAll(() => {
    // The clock is moved in this block, and passing 14:05 latches
    // `eventTriggered`. Reseeding restores the morning for anything later.
    seedScenario();
  });

  it("withholds an inbox message until its reveal moment, then returns it", () => {
    const later = findLaterRevealedInboxMessage();
    expect(
      later,
      "no inbox message is revealed after 07:45, so information arriving over the day is not modelled",
    ).not.toBeNull();
    if (!later) return;

    const atMorning = getInbox(later.roleId, "07:45").map((row) => row.id);
    expect(atMorning).not.toContain(later.id);

    const atReveal = getInbox(later.roleId, later.revealedAtMoment).map((row) => row.id);
    expect(atReveal).toContain(later.id);
  });

  it("withholds an evidence document until its reveal moment, then returns it", () => {
    const later = findLaterRevealedEvidence();
    expect(later, "no evidence document arrives after 07:45").not.toBeNull();
    if (!later) return;

    const atMorning = getAllEvidenceDocuments("07:45").map((row) => row.id);
    expect(atMorning).not.toContain(later.id);

    const atReveal = getAllEvidenceDocuments(later.revealedAtMoment).map((row) => row.id);
    expect(atReveal).toContain(later.id);
  });

  it("withholds incident chronology entries until their reveal moment", () => {
    const incident = getSharedEventIncident();
    expect(incident, "there is no shared event incident").toBeDefined();
    if (!incident) return;

    const rows = getSqlite()
      .prepare(
        "select id, revealed_at_moment as revealedAtMoment from incident_events where incident_id = ? order by sort_order",
      )
      .all(incident.id) as Array<{ id: string; revealedAtMoment: string }>;
    expect(rows.length).toBeGreaterThan(3);

    const late = rows.find(
      (row) => momentToMinutes(row.revealedAtMoment) > momentToMinutes("07:45"),
    );
    expect(late, "the whole incident chronology is already visible at 07:45").toBeDefined();
    if (!late) return;

    const atMorning = getIncidentTimeline(incident.id, "07:45").map((row) => row.id);
    expect(atMorning).not.toContain(late.id);

    const atReveal = getIncidentTimeline(incident.id, late.revealedAtMoment).map((row) => row.id);
    expect(atReveal).toContain(late.id);
  });

  it("changes what is exposed when the scenario clock is advanced", () => {
    // The same property through the engine rather than through an explicit
    // moment argument, because the interface reads the clock from the run.
    const later = findLaterRevealedEvidence();
    if (!later) return;

    expect(getScenarioState()?.currentMoment).toBe("07:45");
    const before = getAllEvidenceDocuments(requireScenarioState().currentMoment).map(
      (row) => row.id,
    );
    expect(before).not.toContain(later.id);

    const advanced = setMoment(later.revealedAtMoment);
    expect(advanced.currentMoment).toBe(later.revealedAtMoment);

    const after = getAllEvidenceDocuments(advanced.currentMoment).map((row) => row.id);
    expect(after).toContain(later.id);
    expect(after.length).toBeGreaterThan(before.length);
  });

  it("latches the shared event once the clock passes 14:05, and scrubbing back does not undo it", () => {
    setMoment("14:05");
    expect(requireScenarioState().eventTriggered).toBe(true);

    setMoment("07:45");
    const state = requireScenarioState();
    expect(state.currentMoment).toBe("07:45");
    expect(state.eventTriggered).toBe(true);
  });
});
