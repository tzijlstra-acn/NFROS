/**
 * Updates: what is material, what settles it, and the notification budget.
 *
 * Pure rules over hand-built backbone events, so each case says exactly which
 * event raises an update and which later event ends it. The seeded day is
 * covered in `tests/integration/os-shell.test.ts`.
 */

import { describe, expect, it } from "vitest";
import type { OsEventType, OsEventView } from "@/features/events/backbone";
import {
  classifyArrivals,
  classifyBackbone,
  deadlineUpdates,
  recency,
  routineCreatedWork,
  type ClassifyContext,
} from "@/features/updates/classify";
import { applyBudget, dedupeUpdates, NOTIFICATION_BUDGET, UPDATE_CATEGORIES, type UpdateItem } from "@/features/updates";

let sequence = 0;

function event(type: OsEventType, extra: Partial<OsEventView> = {}): OsEventView {
  sequence += 1;
  return {
    id: `OSE-${sequence}`,
    sequence,
    type,
    roleId: "rcsa",
    atMoment: "07:45",
    occurredAt: "2026-10-06T07:45:00.000Z",
    actorKind: "system",
    actorUserId: null,
    subjectKind: "assessment",
    subjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    processRunId: "RUN-1",
    stageId: "evidence-refresh",
    correlationId: "STAGERUN-2",
    summary: `${type} summary`,
    payload: {},
    auditEventId: null,
    activityEntryId: null,
    origin: "backbone",
    ...extra,
  };
}

function arrival(id: string, payload: Record<string, unknown>, extra: Partial<OsEventView> = {}): OsEventView {
  return event("work-arrived", { id, sequence: 0, origin: "live-event", processRunId: null, stageId: null, correlationId: null, payload, summary: `Arrival ${id}`, ...extra });
}

function context(overrides: Partial<ClassifyContext> = {}): ClassifyContext {
  return {
    language: "en",
    openDecisionIds: new Set(["DEC-OPEN"]),
    decisionTitles: new Map([["DEC-OPEN", "Three indicator explanations"]]),
    readEventIds: new Set(),
    stageLabel: (_run, stage) => (stage ? `Stage 2: ${stage}` : null),
    seededDecisionId: (_run, _stage, key) => (key === "seeded-key" ? "DEC-OPEN" : key === "seeded-closed" ? "DEC-CLOSED" : null),
    isStageCompletionTool: (toolName) => toolName === "completeRcsaStage",
    stageHref: (_run, stage) => `/workday/rcsa/processes/rcsa-cycle?stage=${stage ?? ""}`,
    decisionHref: (id) => `/workday/rcsa/decisions#${id}`,
    subjectHref: (_kind, id) => `/workday/rcsa/work?view=actions&object=${id ?? ""}`,
    arrivalHref: () => "/workday/rcsa",
    happenedToday: (item) => item.occurredAt.startsWith("2026-10-06"),
    ...overrides,
  };
}

describe("backbone events that stay material until their work is done", () => {
  it("raises a created task as input needed, and settles it when the task is completed", () => {
    const created = event("human-task-created", { payload: { taskKey: "evidence-sufficiency" } });
    const open = classifyBackbone([created], context());
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      category: "human-input-required",
      key: "task:STAGERUN-2:evidence-sufficiency",
      title: "Input needed in Stage 2: evidence-refresh",
      href: "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh",
      readableEventId: null,
    });

    const done = event("human-task-completed", { payload: { taskKey: "evidence-sufficiency", revision: 1 } });
    expect(classifyBackbone([created, done], context())).toEqual([]);
  });

  it("settles everything in a stage once the stage is completed", () => {
    const events = [
      event("human-task-created", { payload: { taskKey: "a" } }),
      event("approval-requested", { payload: { subject: "stage-completion" } }),
      event("stage-completed", { payload: {} }),
    ];
    expect(classifyBackbone(events, context())).toEqual([]);
  });

  it("raises a stage this release cannot complete once, as a blocked process, not as tasks", () => {
    const events = [
      event("stage-opened", { correlationId: "STAGERUN-5", stageId: "specialist-reviews", payload: { executable: false } }),
      event("human-task-created", { correlationId: "STAGERUN-5", stageId: "specialist-reviews", payload: { taskKey: "review" } }),
    ];
    const items = classifyBackbone(events, context());
    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe("process-blocked");
  });

  it("raises a preparation waiting for a source as blocked, and waiting for a person as input needed", () => {
    const source = classifyBackbone([event("ai-preparation-held", { payload: { state: "waiting-for-source" } })], context());
    expect(source[0]?.category).toBe("process-blocked");
    const person = classifyBackbone([event("ai-preparation-held", { payload: { state: "waiting-for-approval" } })], context());
    expect(person[0]?.category).toBe("human-input-required");
  });

  it("settles a held or failed preparation when it starts again", () => {
    const held = event("ai-preparation-held", { payload: { state: "waiting-for-source" } });
    const failed = event("ai-preparation-failed", { payload: { detail: "x" } });
    expect(classifyBackbone([held, failed], context()).map((item) => item.category)).toEqual([
      "process-blocked",
      "execution-failed",
    ]);
    expect(classifyBackbone([held, failed, event("ai-preparation-started")], context())).toEqual([]);
  });

  it("maps a stage decision bound to a seeded decision onto that decision, and drops it once the decision is not open", () => {
    const requested = event("decision-requested", { payload: { decisionKey: "seeded-key", binding: "seeded-decision" } });
    const items = classifyBackbone([requested], context());
    expect(items[0]).toMatchObject({
      key: "decision:DEC-OPEN",
      title: "Decision needed: Three indicator explanations",
      href: "/workday/rcsa/decisions#DEC-OPEN",
    });
    const closed = event("decision-requested", { payload: { decisionKey: "seeded-closed" } });
    expect(classifyBackbone([closed], context())).toEqual([]);
  });

  it("settles a stage decision when it is recorded", () => {
    const requested = event("decision-requested", { payload: { decisionKey: "gate", binding: "stage-decision" } });
    expect(classifyBackbone([requested], context())).toHaveLength(1);
    const recorded = event("decision-recorded", { payload: { decisionKey: "gate", optionId: "advance" } });
    expect(classifyBackbone([requested, recorded], context())).toEqual([]);
  });

  it("settles a tool approval by a grant for that tool, and the completion approval by the completion tool", () => {
    const tool = event("approval-requested", { payload: { toolKey: "raise", toolName: "createIssue" } });
    const completion = event("approval-requested", { payload: { subject: "stage-completion" } });
    const otherGrant = event("approval-granted", { payload: { toolName: "requestEvidenceDocument" } });
    expect(classifyBackbone([tool, completion, otherGrant], context())).toHaveLength(2);

    const toolGrant = event("approval-granted", { payload: { toolName: "createIssue" } });
    const completionGrant = event("approval-granted", { payload: { toolName: "completeRcsaStage" } });
    expect(classifyBackbone([tool, completion, toolGrant, completionGrant], context())).toEqual([]);
  });

  it("prints the clock for today and the date for an earlier day", () => {
    const today = classifyBackbone([event("human-task-created", { payload: { taskKey: "a" } })], context());
    expect(today[0]?.when).toBe("07:45");
    const earlier = classifyBackbone(
      [event("human-task-created", { atMoment: "10:00", occurredAt: "2026-10-01T10:00:00.000Z", payload: { taskKey: "b" } })],
      context(),
    );
    expect(earlier[0]?.when).toBe("01.10.2026");
  });

  it("raises a source change only when it happened today, until a later preparation completes", () => {
    const today = event("source-changed", { payload: { jobId: "J" } });
    const earlier = event("source-changed", { correlationId: "OTHER", occurredAt: "2026-09-30T10:00:00.000Z" });
    expect(classifyBackbone([today, earlier], context()).map((item) => item.key)).toEqual(["source:STAGERUN-2"]);
    expect(classifyBackbone([today, event("ai-preparation-completed")], context())).toEqual([]);
  });

  it("raises a routine only when it recorded the work it created", () => {
    expect(routineCreatedWork({ createdCount: 2 })).toBe(2);
    expect(routineCreatedWork({ createdWork: ["A", "B", "C"] })).toBe(3);
    expect(routineCreatedWork({})).toBe(0);
    const nothing = event("routine-completed", { payload: {} });
    const work = event("routine-completed", { payload: { createdCount: 1 }, subjectId: "KRI-PAY-007" });
    const items = classifyBackbone([nothing, work], context());
    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe("routine-created-work");
  });

  it("ignores lifecycle facts that are not material", () => {
    const quiet: OsEventType[] = ["stage-opened", "ai-preparation-started", "ai-preparation-completed", "tool-executed", "process-completed"];
    expect(classifyBackbone(quiet.map((type) => event(type, { payload: { executable: true, outcome: "executed" } })), context())).toEqual([]);
  });
});

describe("arrivals read through the backbone", () => {
  it("keeps a required decision while it is open, read or not, and drops it once taken", () => {
    const required = arrival("WLE-DE-1", { liveEventType: "decision-required", severity: "high" }, { correlationId: "DEC-OPEN" });
    const read = context({ readEventIds: new Set(["WLE-DE-1"]) });
    expect(classifyArrivals([required], read)[0]).toMatchObject({ key: "decision:DEC-OPEN", readableEventId: null });
    const taken = arrival("WLE-DE-2", { liveEventType: "decision-required", severity: "high" }, { correlationId: "DEC-CLOSED" });
    expect(classifyArrivals([taken], context())).toEqual([]);
  });

  it("raises a high or critical arrival as a material change until it is read, and marks it readable", () => {
    const message = arrival("WLE-IN-1", { liveEventType: "message", severity: "high", derivedFrom: "inbox" });
    expect(classifyArrivals([message], context())[0]).toMatchObject({ category: "material-change", readableEventId: "WLE-IN-1" });
    expect(classifyArrivals([message], context({ readEventIds: new Set(["WLE-IN-1"]) }))).toEqual([]);
  });

  it("raises prepared work from background routines, and nothing for informational arrivals", () => {
    const prepared = arrival("WLE-BG-1", { liveEventType: "agent-action", severity: "medium", derivedFrom: "background-action" });
    const signal = arrival("WLE-TL-1", { liveEventType: "signal", severity: "informational", derivedFrom: "timeline" });
    const items = classifyArrivals([prepared, signal], context());
    expect(items.map((item) => item.category)).toEqual(["routine-created-work"]);
  });
});

describe("deadlines from the action register", () => {
  const href = "/workday/rcsa/work?view=actions";
  it("raises actions due today or tomorrow and overdue ones, and nothing further out or finished", () => {
    const items = deadlineUpdates(
      [
        { id: "A-today", title: "Today", status: "open", dueOn: "2026-10-06", href },
        { id: "A-tomorrow", title: "Tomorrow", status: "in-progress", dueOn: "2026-10-07", href },
        { id: "A-later", title: "Later", status: "open", dueOn: "2026-10-08", href },
        { id: "A-overdue", title: "Late", status: "overdue", dueOn: "2026-09-30", href },
        { id: "A-done", title: "Done", status: "completed", dueOn: "2026-10-06", href },
        { id: "A-none", title: "Undated", status: "open", dueOn: null, href },
      ],
      "2026-10-06",
      "en",
    );
    expect(items.map((item) => item.sourceId).sort()).toEqual(["A-overdue", "A-today", "A-tomorrow"]);
    expect(items.find((item) => item.sourceId === "A-overdue")?.title).toBe("Overdue since 30.09.2026: Late");
    expect(items.every((item) => item.category === "deadline-approaching" && item.origin === "action-register")).toBe(true);
  });

  it("speaks German", () => {
    const [item] = deadlineUpdates([{ id: "A", title: "Bericht", status: "open", dueOn: "2026-10-07", href }], "2026-10-06", "de");
    expect(item?.title).toBe("Morgen faellig: Bericht");
  });
});

describe("recency across the backbone and the arrivals", () => {
  it("ranks by today's clock first, earlier days last, the sequence breaking ties", () => {
    expect(recency("16:30", 0)).toBeGreaterThan(recency("07:45", 40));
    expect(recency("07:45", 41)).toBeGreaterThan(recency("07:45", 40));
    expect(recency(null, 999)).toBeLessThan(recency("00:00", 0));
  });

  it("puts a decision that arrived this afternoon above a task opened on an earlier day", () => {
    const task = classifyBackbone(
      [event("human-task-created", { occurredAt: "2026-10-01T10:00:00.000Z", atMoment: "10:00", payload: { taskKey: "t" } })],
      context(),
    );
    const decision = classifyArrivals(
      [arrival("WLE-DE-9", { liveEventType: "decision-required", severity: "high" }, { correlationId: "DEC-OPEN", atMoment: "16:30" })],
      context(),
    );
    const { raised } = applyBudget([...task, ...decision]);
    expect(raised.map((item) => item.key)).toEqual(["decision:DEC-OPEN", "task:STAGERUN-2:t"]);
  });
});

describe("the notification budget", () => {
  function item(category: UpdateItem["category"], key: string, rank = 1): UpdateItem {
    return { key, category, title: key, detail: null, atMoment: null, when: null, href: "/workday/rcsa", origin: "backbone", sourceId: key, readableEventId: null, rank };
  }

  it("raises one update per thing, the most urgent of its events", () => {
    const deduped = dedupeUpdates([item("process-blocked", "preparation:S"), item("execution-failed", "preparation:S")]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.category).toBe("execution-failed");
  });

  it("raises in priority order, newest first within a kind, and caps the total and each kind", () => {
    const items = [
      item("routine-created-work", "r1"),
      item("human-input-required", "h1", 1),
      item("human-input-required", "h2", 3),
      item("human-input-required", "h3", 2),
      item("human-input-required", "h4", 4),
      item("execution-failed", "f1"),
      item("deadline-approaching", "d1"),
      item("material-change", "m1"),
    ];
    const { raised, heldBack } = applyBudget(items, NOTIFICATION_BUDGET);
    expect(raised.map((entry) => entry.key)).toEqual(["f1", "h4", "h2", "h3", "d1"]);
    expect(raised).toHaveLength(NOTIFICATION_BUDGET.total);
    expect(raised.filter((entry) => entry.category === "human-input-required")).toHaveLength(NOTIFICATION_BUDGET.perCategory);
    expect(heldBack.map((entry) => entry.key)).toEqual(["h1", "m1", "r1"]);
  });

  it("orders the categories as the plan's material list, failures first", () => {
    expect([...UPDATE_CATEGORIES]).toEqual([
      "execution-failed",
      "process-blocked",
      "human-input-required",
      "deadline-approaching",
      "material-change",
      "routine-created-work",
    ]);
  });
});
