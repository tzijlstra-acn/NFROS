/**
 * Home read model rules.
 *
 * The claim under test is the one Home used to break: everything on the
 * screen is read from rows, and nothing is supplied when the rows are absent.
 * Before this module the route showed four open actions to an operational
 * risk partner with no actions, two inbox items needing attention with an
 * empty inbox, the first calendar row as the next meeting whatever the clock
 * said, and a Partner Pulse whose two sentences were written into the file.
 *
 * So the framing is adversarial in the same way as the focus queue tests.
 * Each test either gives the assembler nothing and checks it says nothing, or
 * gives it a specific row and checks the output is about that row and links
 * to it. A fallback anywhere would fail the first kind; an invented statement
 * would fail the second.
 *
 * Pure: no database. The integration test proves the rules meet the seed.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assembleActions,
  assembleDone,
  assembleInbox,
  assembleMeeting,
  assemblePartnerUpdate,
  doneSummaryLine,
  happenedToday,
  needsAttention,
  whatChangedFrom,
  HOME_DATA_SOURCES,
  HOME_FRESHNESS_CHANGES,
  PARTNER_STATEMENT_LIMIT,
  type DayWindow,
  type DoneInputs,
  type PartnerInputs,
} from "@/features/home";
import { HOME_COPY } from "@/features/home/copy";
import { classifyAction } from "@/features/work/modules/actions/policy";
import { revalidateWorkday } from "@/workday/revalidate";
import type { FocusItemView } from "@/workday/contracts";

/* ==========================================================================
   Fixtures
   ========================================================================== */

const DAY: DayWindow = {
  scenarioDate: "2026-10-06",
  seededAt: "2026-10-05T09:00:00.000Z",
  atMoment: "10:30",
};

function emptyPartner(overrides: Partial<PartnerInputs> = {}): PartnerInputs {
  return {
    roleId: "rcsa",
    language: "en",
    suggestions: [],
    preparations: [],
    routines: [],
    receipts: [],
    conversions: [],
    background: [],
    activity: [],
    shownSuggestionId: null,
    ...overrides,
  };
}

function emptyDone(overrides: Partial<DoneInputs> = {}): DoneInputs {
  return {
    roleId: "rcsa",
    day: DAY,
    handledRows: [],
    backgroundCounts: {},
    decisions: [],
    stageDecisions: [],
    stages: [],
    actions: [],
    meetings: [],
    ...overrides,
  };
}

function item(overrides: Partial<FocusItemView> & { id: string }): FocusItemView {
  return {
    section: "handled",
    title: "An item",
    objectType: "background-work",
    objectId: "record-reconciled",
    reason: "completed without your input",
    arrivedAtMoment: "07:45",
    sourceCount: 1,
    aiStatus: "completed",
    humanAction: null,
    dueMoment: null,
    decisionId: null,
    suggestionId: null,
    eventId: null,
    severity: "informational",
    authorityClass: null,
    href: "/workday/rcsa",
    ...overrides,
  };
}

/** Every link a statement carries points at the same role's workday. */
function expectLineage(update: ReturnType<typeof assemblePartnerUpdate>): void {
  for (const statement of [...update.statements, ...update.more]) {
    expect(statement.lineage.length, `${statement.id} has no lineage`).toBeGreaterThan(0);
    for (const ref of statement.lineage) {
      expect(ref.id.length, `${statement.id} has a reference with no identifier`).toBeGreaterThan(0);
      expect(ref.href.startsWith("/workday/rcsa"), `${statement.id} links outside the role: ${ref.href}`).toBe(true);
    }
  }
}

/* ==========================================================================
   No fallback anywhere
   ========================================================================== */

describe("an empty day produces an empty Home", () => {
  it("states no open actions instead of a seeded count", () => {
    const actions = assembleActions("rcsa", [], "en");
    expect(actions.state).toBe("empty");
    expect(actions.open).toBe(0);
    expect(actions.value).toBe("No open actions");
    // The old route substituted 4 for this role and 3 for the other.
    expect(assembleActions("tprm", [], "en").open).toBe(0);
  });

  it("states that nothing in the inbox needs attention instead of a seeded count", () => {
    const inbox = assembleInbox("rcsa", [], "en");
    expect(inbox.state).toBe("empty");
    expect(inbox.needsAttention).toBe(0);
    expect(inbox.value).toBe("Nothing needs attention");
  });

  it("states that no meeting is scheduled instead of inventing one", () => {
    const meeting = assembleMeeting("rcsa", [], DAY, "en");
    expect(meeting.state).toBe("empty");
    expect(meeting.reason).toBe("none-scheduled");
    expect(meeting.time).toBeNull();
    expect(meeting.title).toBeNull();
  });

  it("reports an empty Partner update, with no statement at all", () => {
    const update = assemblePartnerUpdate(emptyPartner());
    expect(update.state).toBe("empty");
    expect(update.statements).toStrictEqual([]);
    expect(update.more).toStrictEqual([]);
  });

  it("reports an empty Done with a zero total", () => {
    const done = assembleDone(emptyDone());
    expect(done.state).toBe("empty");
    expect(done.total).toBe(0);
    expect(done.automatic).toBe(0);
    expect(done.byYou).toBe(0);
    expect(doneSummaryLine(done, "en")).toBe("");
  });

  it("says Unavailable when a source cannot be read, rather than zero", () => {
    expect(assembleActions("rcsa", null, "en").state).toBe("unavailable");
    expect(assembleInbox("rcsa", null, "en").state).toBe("unavailable");
    expect(assembleMeeting("rcsa", null, DAY, "en").state).toBe("unavailable");
    const update = assemblePartnerUpdate(
      emptyPartner({
        suggestions: null,
        preparations: null,
        routines: null,
        receipts: null,
        conversions: null,
        background: null,
        activity: null,
      }),
    );
    expect(update.state).toBe("unavailable");
    expect(update.sources.every((source) => source.state === "unavailable")).toBe(true);
  });

  it("reports a single unreadable source per source and still states the rest", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        routines: null,
        background: [
          { id: "BG-1", kind: "item-requested", targetKind: "evidence", targetId: "EVD-1", targetLabel: "Pack", performedAtMoment: "07:45" },
        ],
      }),
    );
    expect(update.state).toBe("present");
    expect(update.sources.find((source) => source.source === "routine")?.state).toBe("unavailable");
    expect(update.sources.find((source) => source.source === "follow-up")?.state).toBe("present");
  });
});

/* ==========================================================================
   The source files carry no fallback either
   ========================================================================== */

describe("the Home source files", () => {
  const root = process.cwd();
  const files = [
    "app/workday/[role]/v3.tsx",
    "src/components/workday-v3/RoleHome.tsx",
    "src/components/workday-v3/home/HomeYourDay.tsx",
    "src/components/workday-v3/home/HomePartnerUpdate.tsx",
    "src/features/home/assemble.ts",
    "src/features/home/read.ts",
  ];

  /** Code only, so a comment that describes the removed fallback does not count as one. */
  function code(path: string): string {
    return readFileSync(join(root, path), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  }

  it("contain no fallback count, fallback list or hard coded partner summary", () => {
    for (const path of files) {
      const source = code(path);
      expect(/fallback/i.test(source), `${path} still names a fallback in code`).toBe(false);
      expect(source.includes("PartnerPulse"), `${path} still renders Partner Pulse`).toBe(false);
      expect(source.includes("summaryText"), `${path} still carries a summary table`).toBe(false);
      // The two sentences Partner Pulse hard coded.
      expect(source.includes("Scanned calendar"), path).toBe(false);
      expect(source.includes("Veridian evidence request status"), path).toBe(false);
      // The two count substitutions the route made.
      expect(/>\s*0\s*\?\s*raw/.test(source), `${path} substitutes a count`).toBe(false);
      expect(/roleId === "rcsa" \? \d/.test(source), `${path} substitutes a per-role number`).toBe(false);
    }
  });
});

/* ==========================================================================
   Your day
   ========================================================================== */

describe("Your day", () => {
  it("classifies actions exactly as the Work Hub does: overdue and blocked are still open", () => {
    /*
     * The inputs are built with the Work Hub's own `classifyAction`, so this
     * is the consistency claim itself: a past due date counts as overdue
     * whatever the stored status says, and blocked comes from the history.
     */
    const row = (status: string, dueOn: string | null) => ({
      status,
      dueOn,
      ownerUserId: "P-003",
      ownerLabel: "",
      isUnowned: false,
    });
    const blockedEntry = { id: "AUP-BLK-1", statusAfter: "blocked", note: "Waiting on the supplier", at: "2026-10-06T08:00:00.000Z" };
    const classify = (id: string, value: ReturnType<typeof row>, updates: Array<typeof blockedEntry> = []) => {
      const classified = classifyAction(value, updates, "P-003", DAY.scenarioDate, null);
      return { id, open: classified.open, overdue: classified.overdue, blocked: classified.blocked };
    };

    const actions = assembleActions(
      "rcsa",
      [
        classify("A1", row("open", "2026-10-20")),
        classify("A2", row("in-progress", "2026-10-20")),
        classify("A3", row("overdue", "2026-09-30")),
        classify("A4", row("in-progress", "2026-10-01")),
        classify("A5", row("in-progress", "2026-10-20"), [blockedEntry]),
        classify("A6", row("completed", "2026-10-02")),
        classify("A7", row("cancelled", null)),
      ],
      "en",
    );
    expect(actions.open).toBe(5);
    expect(actions.overdue).toBe(2);
    expect(actions.blocked).toBe(1);
    expect(actions.value).toBe("5 open, 2 overdue, 1 blocked");
    expect(assembleActions("rcsa", [classify("A1", row("open", null))], "de").value).toBe("1 offen");
  });

  it("counts only unread, unconverted messages that ask for a decision or an action", () => {
    const base = {
      isRead: false,
      proposedTriage: "action",
      confirmedTriage: null,
      conversionKind: null,
    };
    expect(needsAttention({ id: "M1", ...base })).toBe(true);
    expect(needsAttention({ id: "M2", ...base, isRead: true })).toBe(false);
    expect(needsAttention({ id: "M3", ...base, proposedTriage: "information" })).toBe(false);
    // Converted is what the message records (migration 0008), of any work kind.
    expect(needsAttention({ id: "M4", ...base, conversionKind: "action" })).toBe(false);
    expect(needsAttention({ id: "M4b", ...base, conversionKind: "process" })).toBe(false);
    // The person's own triage outranks the proposal, in both directions.
    expect(needsAttention({ id: "M5", ...base, confirmedTriage: "noise" })).toBe(false);
    expect(needsAttention({ id: "M6", ...base, proposedTriage: "noise", confirmedTriage: "decision" })).toBe(true);

    const inbox = assembleInbox("rcsa", [{ id: "M1", ...base }, { id: "M7", ...base, proposedTriage: "decision" }], "en");
    expect(inbox.value).toBe("2 need attention");
  });

  it("takes the next meeting from the clock, skipping focus time and anything already started", () => {
    const rows = [
      { id: "C1", title: "Morning decision brief", titleDe: "", startsAt: "2026-10-06T07:45:00.000Z", kind: "focus-time", meetingId: null },
      { id: "C2", title: "Stand-up", titleDe: "Abstimmung", startsAt: "2026-10-06T09:30:00.000Z", kind: "meeting", meetingId: "MTG-1" },
      { id: "C3", title: "Workshop", titleDe: "", startsAt: "2026-10-06T10:30:00.000Z", kind: "workshop", meetingId: "MTG-2" },
    ];
    const at0745 = assembleMeeting("rcsa", rows, { ...DAY, atMoment: "07:45" }, "en");
    expect(at0745.title).toBe("Stand-up");
    expect(at0745.value).toBe("09:30, Stand-up");
    expect(at0745.href).toContain("MTG-1");
    expect(assembleMeeting("rcsa", rows, { ...DAY, atMoment: "07:45" }, "de").title).toBe("Abstimmung");

    const at1030 = assembleMeeting("rcsa", rows, DAY, "en");
    expect(at1030.title).toBe("Workshop");

    const late = assembleMeeting("rcsa", rows, { ...DAY, atMoment: "17:00" }, "en");
    expect(late.state).toBe("empty");
    expect(late.reason).toBe("none-remaining");
    expect(late.value).toBe("No further meeting today");
  });
});

/* ==========================================================================
   Partner update
   ========================================================================== */

describe("the Partner update", () => {
  it("states what a suggestion prepared and links to the decision it prepared", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        suggestions: [
          {
            id: "SUG-1",
            headline: "Three Red indicators look like one causal chain",
            status: "ready",
            atMoment: "07:45",
            decisionId: "DEC-2026-0771",
            objectType: "risk",
            objectId: "RSK-0211",
          },
        ],
      }),
    );
    expect(update.statements).toHaveLength(1);
    const [only] = update.statements;
    expect(only?.text).toBe("Prepared for your review: Three Red indicators look like one causal chain");
    expect(only?.lineage[0]?.kind).toBe("decision");
    expect(only?.lineage[0]?.href).toBe("/workday/rcsa/decisions#DEC-2026-0771");
    expectLineage(update);
  });

  it("does not repeat the suggestion already shown as the inline AI line", () => {
    const suggestion = {
      id: "SUG-1",
      headline: "A prepared position",
      status: "needs-user",
      atMoment: "07:45",
      decisionId: null,
      objectType: "risk",
      objectId: "RSK-0211",
    };
    expect(assemblePartnerUpdate(emptyPartner({ suggestions: [suggestion] })).statements).toHaveLength(1);
    expect(
      assemblePartnerUpdate(emptyPartner({ suggestions: [suggestion], shownSuggestionId: "SUG-1" })).statements,
    ).toHaveLength(0);
  });

  it("ignores a suggestion that is still being checked", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        suggestions: [
          { id: "SUG-2", headline: "Not finished", status: "checking", atMoment: "07:45", decisionId: null, objectType: "risk", objectId: "RSK-1" },
        ],
      }),
    );
    expect(update.statements).toHaveLength(0);
  });

  it("groups follow-ups and links to every item followed up", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        background: [
          { id: "BG-1", kind: "item-requested", targetKind: "evidence", targetId: "EVD-1", targetLabel: "Recovery test", performedAtMoment: "07:45" },
          { id: "BG-2", kind: "item-requested", targetKind: "evidence", targetId: "EVD-2", targetLabel: "", performedAtMoment: "07:45" },
          { id: "BG-3", kind: "record-reconciled", targetKind: "contract", targetId: "CTR-1", targetLabel: "Appendix", performedAtMoment: "07:45" },
        ],
      }),
    );
    const followUp = update.statements.find((statement) => statement.source === "follow-up");
    expect(followUp?.text).toBe("Requested 2 missing items");
    expect(followUp?.lineage.map((ref) => ref.id)).toStrictEqual(["EVD-1", "EVD-2"]);
    // A target without a recorded label is named by its identifier, never by an invented title.
    expect(followUp?.lineage[1]?.label).toBe("EVD-2");
    // Reconciliation is a check, counted under Done, not a statement.
    expect(update.statements.some((statement) => statement.lineage.some((ref) => ref.id === "CTR-1"))).toBe(false);
    expectLineage(update);
  });

  it("states a conversion and links to the message and to the work it became", () => {
    const none = { convertedBy: null, convertedByYou: false };
    const update = assemblePartnerUpdate(
      emptyPartner({
        conversions: [
          { messageId: "IMSG-1", subject: "Evidence please", atMoment: "08:10", conversionKind: "action", ...none, linkedActionId: "MSN-9", linkedDecisionId: null },
          { messageId: "IMSG-2", subject: "Not converted", atMoment: "08:10", conversionKind: null, ...none, linkedActionId: null, linkedDecisionId: null },
          { messageId: "IMSG-3", subject: "Noise", atMoment: "08:10", conversionKind: "dismissed", ...none, linkedActionId: null, linkedDecisionId: null },
        ],
      }),
    );
    const conversion = update.statements.find((statement) => statement.source === "conversion");
    expect(conversion?.text).toBe("1 message converted into work");
    expect(conversion?.lineage.map((ref) => `${ref.kind}:${ref.id}`)).toStrictEqual(["action:MSN-9", "message:IMSG-1"]);
    expectLineage(update);
  });

  it("reads every work kind of conversion from the message, and names who converted it", () => {
    const row = (id: string, kind: "evidence" | "process" | "delegated", by: { convertedBy: string | null; convertedByYou: boolean }) => ({
      messageId: id,
      subject: id,
      atMoment: "08:10",
      conversionKind: kind,
      ...by,
      linkedActionId: null,
      linkedDecisionId: null,
    });
    const you = { convertedBy: "Anna Weber", convertedByYou: true };
    const mine = assemblePartnerUpdate(emptyPartner({ conversions: [row("IMSG-1", "evidence", you), row("IMSG-2", "process", you)] }));
    expect(mine.statements.find((statement) => statement.source === "conversion")?.text).toBe("You converted 2 messages into work");
    const colleague = assemblePartnerUpdate(emptyPartner({ conversions: [row("IMSG-3", "delegated", { convertedBy: "Jonas Keller", convertedByYou: false })] }));
    expect(colleague.statements.find((statement) => statement.source === "conversion")?.text).toBe("Jonas Keller converted 1 message into work");
    const german = assemblePartnerUpdate(emptyPartner({ language: "de", conversions: [row("IMSG-1", "evidence", you)] }));
    expect(german.statements.find((statement) => statement.source === "conversion")?.text).toBe("Sie haben 1 Nachricht in Arbeit umgewandelt");
    expectLineage(mine);
  });

  it("states the changes recorded after a decision, linking each one", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        receipts: [
          {
            decisionId: "DEC-2026-0772",
            decisionTitle: "CTL-PAY-014 control environment rating",
            decidedAtMoment: "11:45",
            lines: [
              { id: "RCPT-1", objectKind: "control", objectId: "CTL-PAY-014", statement: "Control rating updated" },
              { id: "RCPT-2", objectKind: "action", objectId: "MSN-2026-0999", statement: "Action created" },
              // A second change to the same control is one reference, not two.
              { id: "RCPT-3", objectKind: "control", objectId: "CTL-PAY-014", statement: "Control note added" },
            ],
          },
          // A decision whose consequences wrote nothing is not stated.
          { decisionId: "DEC-EMPTY", decisionTitle: "Nothing executed", decidedAtMoment: "11:45", lines: [] },
        ],
      }),
    );
    expect(update.statements).toHaveLength(1);
    const executed = update.statements[0];
    // Every reference is distinct, so a list keyed on kind and identifier cannot collide.
    const keys = executed?.lineage.map((ref) => `${ref.kind}:${ref.id}`) ?? [];
    expect(new Set(keys).size).toBe(keys.length);
    expect(executed?.text).toBe("Recorded 3 changes after your decision on CTL-PAY-014 control environment rating");
    expect(executed?.lineage.map((ref) => ref.id)).toStrictEqual(["DEC-2026-0772", "CTL-PAY-014", "MSN-2026-0999"]);
    // The Work Hub's own item link, so Home and the hub agree on the address.
    expect(executed?.lineage[2]?.href).toBe("/workday/rcsa/work?view=actions&item=MSN-2026-0999");
    expectLineage(update);
  });

  it("states an outcome from the activity stream but never a check, and never an entry a backbone event already covers", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        activity: [
          { id: "AAE-1", kind: "drafted", label: "Reminder to the supplier", atMoment: "09:30", objectType: "supplier", objectId: "TP-0042", suggestionId: null },
          { id: "AAE-2", kind: "reconciled", label: "Appendix against register", atMoment: "07:45", objectType: "contract", objectId: "CTR-1", suggestionId: null },
          { id: "AAE-3", kind: "completed", label: "Stage preparation", atMoment: "09:30", objectType: "assessment", objectId: "RCSA-1", suggestionId: null },
          { id: "AAE-4", kind: "executed", label: "No object", atMoment: "09:30", objectType: "", objectId: "", suggestionId: null },
        ],
        preparations: [
          { id: "OSE-1", summary: "Evidence pack for stage 2", atMoment: "09:30", processId: "rcsa-cycle-assistant", stageId: "evidence-refresh", activityEntryId: "AAE-3" },
        ],
      }),
    );
    const ids = update.statements.map((statement) => statement.id);
    expect(ids).toContain("activity:AAE-1");
    expect(ids).toContain("preparation:OSE-1");
    expect(ids).not.toContain("activity:AAE-2");
    expect(ids).not.toContain("activity:AAE-3");
    // An outcome with nothing to link to is dropped rather than shown bare.
    expect(ids).not.toContain("activity:AAE-4");
    const preparation = update.statements.find((statement) => statement.id === "preparation:OSE-1");
    expect(preparation?.lineage[0]?.href).toBe("/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh");
    expectLineage(update);
  });

  it("states a completed routine run only when it names what it worked on", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        routines: [
          { id: "OSE-R1", summary: "Evidence freshness checked for RSK-0211", atMoment: "08:00", subjectKind: "risk", subjectId: "RSK-0211", activityEntryId: null },
          { id: "OSE-R2", summary: "A run with no subject", atMoment: "08:00", subjectKind: null, subjectId: null, activityEntryId: null },
        ],
      }),
    );
    expect(update.statements.map((statement) => statement.id)).toStrictEqual(["routine:OSE-R1"]);
    expectLineage(update);
  });

  it("shows three statements, newest first, and keeps the rest behind the cap", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        background: [
          { id: "B1", kind: "item-requested", targetKind: "evidence", targetId: "E1", targetLabel: "", performedAtMoment: "07:45" },
          { id: "B2", kind: "escalated-to-human", targetKind: "kri", targetId: "K1", targetLabel: "", performedAtMoment: "07:45" },
          { id: "B3", kind: "contradiction-identified", targetKind: "control", targetId: "C1", targetLabel: "", performedAtMoment: "07:45" },
        ],
        activity: [
          { id: "AAE-9", kind: "drafted", label: "Committee paper", atMoment: "13:30", objectType: "committee-item", objectId: "AG-1", suggestionId: null },
        ],
      }),
    );
    expect(update.statements).toHaveLength(PARTNER_STATEMENT_LIMIT);
    expect(update.statements[0]?.id).toBe("activity:AAE-9");
    expect(update.more).toHaveLength(1);
    expectLineage(update);
  });

  it("writes German statements from the same rows", () => {
    const update = assemblePartnerUpdate(
      emptyPartner({
        language: "de",
        background: [
          { id: "B1", kind: "item-requested", targetKind: "evidence", targetId: "E1", targetLabel: "", performedAtMoment: "07:45" },
          { id: "B2", kind: "item-requested", targetKind: "evidence", targetId: "E2", targetLabel: "", performedAtMoment: "07:45" },
        ],
      }),
    );
    expect(update.statements[0]?.text).toBe("2 fehlende Unterlagen angefordert");
  });
});

/* ==========================================================================
   Done
   ========================================================================== */

describe("Done", () => {
  it("counts units of automatic work, not grouped rows", () => {
    const done = assembleDone(
      emptyDone({
        handledRows: [
          item({ id: "focus-handled-record-reconciled", objectId: "record-reconciled" }),
          item({ id: "focus-handled-system-checked", objectId: "system-checked" }),
          item({ id: "focus-suggestion-SUG-1", objectType: "risk", objectId: "RSK-1", suggestionId: "SUG-1" }),
        ],
        backgroundCounts: { "record-reconciled": 38, "system-checked": 12 },
      }),
    );
    expect(done.automatic).toBe(51);
    expect(done.byYou).toBe(0);
    expect(done.total).toBe(51);
    expect(doneSummaryLine(done, "en")).toBe("all handled automatically");
  });

  it("counts a recorded decision as completed by the person, never as automatic", () => {
    const done = assembleDone(
      emptyDone({
        // The queue files an executed decision under handled. Done does not count it as automatic.
        handledRows: [item({ id: "focus-decision-DEC-1", objectType: "decision", objectId: "DEC-1", decisionId: "DEC-1" })],
        decisions: [
          { id: "DEC-1", title: "Rating", status: "decided", decidedAtMoment: "10:00" },
          { id: "DEC-2", title: "Still open", status: "open", decidedAtMoment: null },
        ],
      }),
    );
    expect(done.automatic).toBe(0);
    expect(done.byYou).toBe(1);
    expect(done.byYouRows[0]?.lineage.href).toBe("/workday/rcsa/decisions#DEC-1");
  });

  it("counts a decision recorded through a stage once, however many records describe it", () => {
    const done = assembleDone(
      emptyDone({
        decisions: [{ id: "DEC-1", title: "Rating", status: "decided", decidedAtMoment: "10:00" }],
        stageDecisions: [
          {
            id: "OSE-1",
            summary: "Decision DEC-1 recorded",
            occurredAt: "2026-10-05T10:00:00.000Z",
            atMoment: "10:00",
            decisionId: "DEC-1",
            decisionKey: null,
            correlationId: "SR-1",
            processId: "rcsa-cycle-assistant",
            stageId: "scope-trigger",
          },
          {
            id: "OSE-2",
            summary: "P-003 decided the scope",
            occurredAt: "2026-10-05T10:05:00.000Z",
            atMoment: "10:05",
            decisionId: null,
            decisionKey: "scope",
            correlationId: "SR-1",
            processId: "rcsa-cycle-assistant",
            stageId: "scope-trigger",
          },
          {
            id: "OSE-3",
            summary: "P-003 revised the scope",
            occurredAt: "2026-10-05T10:06:00.000Z",
            atMoment: "10:06",
            decisionId: null,
            decisionKey: "scope",
            correlationId: "SR-1",
            processId: "rcsa-cycle-assistant",
            stageId: "scope-trigger",
          },
        ],
      }),
    );
    expect(done.byYou).toBe(2);
  });

  it("counts stages, actions and meetings completed today and not the seeded history", () => {
    const done = assembleDone(
      emptyDone({
        stages: [
          { id: "SR-1", roleAppId: "rcsa-cycle-assistant", stageId: "scope-trigger", stageName: "Scope and trigger", status: "completed", completedAt: "2026-10-01T10:00:00.000Z" },
          { id: "SR-2", roleAppId: "rcsa-cycle-assistant", stageId: "evidence-refresh", stageName: "Evidence refresh", status: "completed", completedAt: "2026-10-05T11:00:00.000Z" },
          { id: "SR-3", roleAppId: "rcsa-cycle-assistant", stageId: "risk-change", stageName: "Risk change", status: "in-progress", completedAt: null },
        ],
        actions: [
          { id: "MSN-1", title: "Old", status: "completed", completedOn: "2026-10-02" },
          { id: "MSN-2", title: "Today, scenario date", status: "completed", completedOn: "2026-10-06" },
          { id: "MSN-3", title: "Today, written live", status: "completed", completedOn: "2026-10-05T12:00:00.000Z" },
          { id: "MSN-4", title: "Open", status: "open", completedOn: null },
        ],
        meetings: [
          { id: "MTG-1", title: "Workshop", status: "concluded", concludedAt: "10:30" },
          { id: "MTG-2", title: "Later", status: "concluded", concludedAt: "16:30" },
          { id: "MTG-3", title: "Not held", status: "not-started", concludedAt: null },
        ],
      }),
    );
    expect(done.byYouRows.map((row) => row.id)).toStrictEqual([
      "done-stage-SR-2",
      "done-action-MSN-2",
      "done-action-MSN-3",
      "done-meeting-MTG-1",
    ]);
    expect(done.byYouRows[0]?.lineage.href).toBe("/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh");
  });

  it("summarises both categories when both have work", () => {
    expect(doneSummaryLine({ automatic: 5, byYou: 2 }, "en")).toBe("5 handled automatically, 2 completed by you");
    expect(doneSummaryLine({ automatic: 1, byYou: 1 }, "de")).toBe("1 automatisch bearbeitet, 1 von Ihnen erledigt");
    expect(doneSummaryLine({ automatic: 0, byYou: 3 }, "en")).toBe("all completed by you");
  });
});

/* ==========================================================================
   The working day
   ========================================================================== */

describe("the working day", () => {
  it("reads the scenario clock, the scenario date and live writes after the seed", () => {
    expect(happenedToday("10:00", DAY)).toBe(true);
    expect(happenedToday("11:00", DAY)).toBe(false);
    expect(happenedToday("2026-10-06", DAY)).toBe(true);
    expect(happenedToday("2026-10-06T08:00:00.000Z", DAY)).toBe(true);
    expect(happenedToday("2026-10-05T10:00:00.000Z", DAY)).toBe(true);
    expect(happenedToday("2026-10-05T08:00:00.000Z", DAY)).toBe(false);
    expect(happenedToday("2026-10-05", DAY)).toBe(true);
    expect(happenedToday("2026-09-30", DAY)).toBe(false);
    expect(happenedToday(null, DAY)).toBe(false);
  });
});

/* ==========================================================================
   Now: what changed
   ========================================================================== */

describe("what changed on the Now card", () => {
  const now = item({ id: "focus-decision-DEC-1", section: "needs-you", objectType: "decision", objectId: "DEC-1", decisionId: "DEC-1", href: "/workday/rcsa/decisions#DEC-1" });

  it("prefers the suggestion's record of the change and links to it", () => {
    const found = whatChangedFrom(now, {
      suggestion: { id: "SUG-1", changeSummary: "KRI-PAY-007 moved to Red overnight. Two more followed." },
      event: { id: "WLE-1", summary: "A decision arrived." },
      background: null,
    });
    expect(found?.text).toBe("KRI-PAY-007 moved to Red overnight.");
    expect(found?.source.kind).toBe("suggestion");
  });

  it("returns nothing when no row records a change, so the card leaves the line out", () => {
    expect(whatChangedFrom(now, { suggestion: null, event: null, background: null })).toBeNull();
    expect(
      whatChangedFrom(now, { suggestion: { id: "SUG-1", changeSummary: "  " }, event: null, background: null }),
    ).toBeNull();
  });
});

/* ==========================================================================
   Freshness dependencies
   ========================================================================== */

describe("what Home reads", () => {
  it("revalidates as a no-op outside a request, against the real Next implementation", () => {
    // No request is in scope in a unit test, so the real `revalidatePath` refuses.
    expect(revalidateWorkday("rcsa", "decision")).toBe(false);
  });

  it("names a table for every change the plan says Home must reflect at once", () => {
    for (const change of HOME_FRESHNESS_CHANGES) {
      expect(
        HOME_DATA_SOURCES.some((source) => source.changes.includes(change)),
        `no Home source is reached by a ${change} change`,
      ).toBe(true);
    }
    for (const table of ["decisions", "actions", "meetings", "role_app_stage_runs", "ai_activity_entries", "inbox_messages"]) {
      expect(HOME_DATA_SOURCES.some((source) => source.table === table), table).toBe(true);
    }
  });
});

/* ==========================================================================
   Copy rules
   ========================================================================== */

describe("Home copy", () => {
  it("carries both languages, no em dash, no umlaut and no vendor name", () => {
    for (const [key, pair] of Object.entries(HOME_COPY)) {
      expect(pair.en.length, `${key} has no English`).toBeGreaterThan(0);
      expect(pair.de.length, `${key} has no German`).toBeGreaterThan(0);
      for (const text of [pair.en, pair.de]) {
        expect(text.includes(String.fromCharCode(0x2014)), `${key} contains an em dash`).toBe(false);
        expect(/[\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df]/.test(text), `${key} contains an umlaut`).toBe(false);
        expect(/openai|gpt|llm|routine handler|\bstub\b/i.test(text), `${key} names internal technology`).toBe(false);
      }
    }
  });
});
