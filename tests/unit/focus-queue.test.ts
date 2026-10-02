/**
 * Focus queue, selection and changed-object rules.
 *
 * Every rule tested here is a product rule rather than an implementation
 * detail, which is why each one is a pure function in the first place. The
 * queue's behaviour is described in the brief as a set of statements about
 * sections, ordering and duplication, and a statement that cannot be checked
 * without a database and a seed is a statement nobody will check.
 *
 * The framing is adversarial in one specific way. A queue is easy to make look
 * right on the happy path and very easy to leave subtly wrong: an item that
 * appears twice under two headings, a watched indicator that is also an open
 * decision, a change marker on half the graph. Each test below is built to
 * produce exactly one of those failures if the rule is not implemented.
 */

import { describe, expect, it } from "vitest";
import {
  assembleFocusQueue,
  firstClause,
  HANDLED_BACKGROUND_KINDS,
  NEXT_LIMIT,
  NOW_CHANGED_LIMIT,
  NOW_COMPLETED_LIMIT,
  orderFocusItems,
  WATCHING_LIMIT,
  type FocusCandidate,
} from "@/db/repositories/focus";
import {
  rankChangedObjects,
  type ChangedObject,
} from "@/db/repositories/workspace";
import {
  FOCUS_SECTIONS,
  FOCUS_SECTION_LABELS,
  dedupeFocusItems,
  momentAge,
  type FocusItemView,
  type FocusSection,
} from "@/workday/contracts";
import {
  selectionReducer,
  parseSelectionParam,
  formatSelectionParam,
  type SelectionSnapshot,
} from "@/components/workday-v2/SelectionProvider";
import {
  WS_ASSURANCE,
  WS_GOVERNANCE,
  WS_INCIDENT,
  WS_RCSA,
  WS_REGULATORY,
  WS_SHARED,
  WS_TPRM,
  type LabelPair,
} from "@/components/workday-v2/role-workspaces/labels";

/* ==========================================================================
   Fixtures
   ========================================================================== */

/**
 * One item, with only the fields a test cares about overridden.
 *
 * A helper rather than inline literals, because `FocusItemView` has eighteen
 * fields and a test that spells all of them out three times hides the one
 * field it is actually about.
 */
function item(overrides: Partial<FocusItemView> & { id: string }): FocusItemView {
  return {
    section: "needs-you",
    title: "An item",
    objectType: "decision",
    objectId: overrides.id,
    reason: "a short clause",
    arrivedAtMoment: "07:45",
    sourceCount: 2,
    aiStatus: "ready",
    humanAction: "Record the decision",
    dueMoment: null,
    decisionId: null,
    suggestionId: null,
    eventId: null,
    severity: "medium",
    authorityClass: null,
    href: "/workday/rcsa",
    ...overrides,
  };
}

function candidate(
  view: FocusItemView,
  relatedObjectKey: string | null = null,
): FocusCandidate {
  return { item: view, relatedObjectKey };
}

/* ==========================================================================
   Section assignment
   ========================================================================== */

describe("focus queue sections", () => {
  it("places each kind of real state in the section that matches what is being asked", () => {
    const queue = assembleFocusQueue(
      [
        // An open decision: the most demanding state there is.
        candidate(
          item({ id: "DEC-1", section: "needs-you", objectType: "decision", objectId: "DEC-1" }),
          "control:CTL-PAY-014",
        ),
        // A suggestion the partner finished, on a different object.
        candidate(
          item({ id: "AIS-1", section: "prepared", objectType: "assessment", objectId: "ASM-1" }),
          "assessment:ASM-1",
        ),
        // Work completed within policy.
        candidate(
          item({
            id: "BG-1",
            section: "handled",
            objectType: "background-work",
            objectId: "record-reconciled",
          }),
        ),
        // A monitored subject with nothing attached to it.
        candidate(
          item({ id: "KRI-1", section: "watching", objectType: "kri", objectId: "KRI-PAY-003" }),
          "kri:KRI-PAY-003",
        ),
      ],
      "rcsa",
      "08:10",
    );

    expect(queue.counts).toStrictEqual({
      "needs-you": 1,
      prepared: 1,
      handled: 1,
      watching: 1,
    });
    expect(queue.sections["needs-you"][0]?.id).toBe("DEC-1");
    expect(queue.sections.prepared[0]?.id).toBe("AIS-1");
    expect(queue.sections.handled[0]?.id).toBe("BG-1");
    expect(queue.sections.watching[0]?.id).toBe("KRI-1");
  });

  it("keeps every section in the canonical order from the contract", () => {
    expect([...FOCUS_SECTIONS]).toStrictEqual(["needs-you", "prepared", "handled", "watching"]);
  });

  it("does not file an escalation or a contradiction as handled automatically", () => {
    // Both end at a person, so neither may be described as handled without one.
    expect(HANDLED_BACKGROUND_KINDS).not.toContain("escalated-to-human");
    expect(HANDLED_BACKGROUND_KINDS).not.toContain("contradiction-identified");
  });
});

/* ==========================================================================
   The no-duplicate rule
   ========================================================================== */

describe("no item in two active sections", () => {
  it("collapses a suggestion onto the decision it names", () => {
    /*
     * This is the exact failure the precedence in the contract exists to
     * prevent: the same control assessment under both "Needs you" as a
     * decision and "Prepared for review" as the suggestion that prepared it.
     */
    const queue = assembleFocusQueue(
      [
        candidate(
          item({ id: "DEC-A", section: "needs-you", objectType: "decision", objectId: "DEC-772" }),
          "control:CTL-PAY-014",
        ),
        candidate(
          item({
            id: "AIS-A",
            section: "prepared",
            objectType: "decision",
            objectId: "DEC-772",
            suggestionId: "AIS-A",
          }),
          "control:CTL-PAY-014",
        ),
      ],
      "rcsa",
      "08:10",
    );

    expect(queue.counts["needs-you"]).toBe(1);
    expect(queue.counts.prepared).toBe(0);
    expect(queue.items).toHaveLength(1);
  });

  it("drops a watched subject that is already the object of an active item", () => {
    const queue = assembleFocusQueue(
      [
        candidate(
          item({ id: "DEC-B", section: "needs-you", objectType: "decision", objectId: "DEC-771" }),
          "kri:KRI-PAY-007",
        ),
        candidate(
          item({ id: "KRI-B", section: "watching", objectType: "kri", objectId: "KRI-PAY-007" }),
          "kri:KRI-PAY-007",
        ),
        candidate(
          item({ id: "KRI-C", section: "watching", objectType: "kri", objectId: "KRI-PAY-011" }),
          "kri:KRI-PAY-011",
        ),
      ],
      "rcsa",
      "08:10",
    );

    expect(queue.sections.watching.map((row) => row.objectId)).toStrictEqual(["KRI-PAY-011"]);
  });

  it("never lists one object identifier in more than one section", () => {
    const queue = assembleFocusQueue(
      FOCUS_SECTIONS.map((section) =>
        candidate(item({ id: `X-${section}`, section, objectType: "risk", objectId: "RSK-0211" })),
      ),
      "rcsa",
      "08:10",
    );

    const seen = new Map<string, FocusSection>();
    for (const row of queue.items) {
      const key = `${row.objectType}:${row.objectId}`;
      expect(seen.has(key), `${key} appears twice`).toBe(false);
      seen.set(key, row.section);
    }
    // The most demanding section wins.
    expect(seen.get("risk:RSK-0211")).toBe("needs-you");
  });

  it("is idempotent, so a caller may deduplicate a second time safely", () => {
    const items = [
      item({ id: "ONE", section: "needs-you", objectType: "risk", objectId: "RSK-1" }),
      item({ id: "TWO", section: "prepared", objectType: "risk", objectId: "RSK-1" }),
      item({ id: "THREE", section: "watching", objectType: "kri", objectId: "KRI-1" }),
    ];
    const once = dedupeFocusItems(items);
    expect(dedupeFocusItems(once)).toStrictEqual(once);
  });
});

/* ==========================================================================
   Ordering
   ========================================================================== */

describe("ordering within a section", () => {
  it("puts severity first, then a due time, then the oldest item", () => {
    const ordered = orderFocusItems([
      item({ id: "C", severity: "medium", arrivedAtMoment: "07:45" }),
      item({ id: "A", severity: "critical", arrivedAtMoment: "14:05" }),
      item({ id: "B", severity: "high", arrivedAtMoment: "11:45" }),
      item({ id: "D", severity: "medium", arrivedAtMoment: "08:10" }),
    ]);

    expect(ordered.map((row) => row.id)).toStrictEqual(["A", "B", "C", "D"]);
  });

  it("brings an item with a due time ahead of an equally severe one without", () => {
    const ordered = orderFocusItems([
      item({ id: "NO-DUE", severity: "high", arrivedAtMoment: "07:45", dueMoment: null }),
      item({ id: "DUE", severity: "high", arrivedAtMoment: "11:45", dueMoment: "12:00" }),
    ]);

    expect(ordered.map((row) => row.id)).toStrictEqual(["DUE", "NO-DUE"]);
  });

  it("is stable, so two renders of the same queue agree", () => {
    const input = [
      item({ id: "B", severity: "medium", arrivedAtMoment: "08:10" }),
      item({ id: "A", severity: "medium", arrivedAtMoment: "08:10" }),
    ];
    expect(orderFocusItems(input).map((row) => row.id)).toStrictEqual(["A", "B"]);
    expect(orderFocusItems([...input].reverse()).map((row) => row.id)).toStrictEqual(["A", "B"]);
  });
});

/* ==========================================================================
   Now and Next
   ========================================================================== */

describe("Now and Next", () => {
  it("promotes exactly one item to Now and caps Next", () => {
    const queue = assembleFocusQueue(
      Array.from({ length: 8 }, (_, index) =>
        candidate(
          item({
            id: `DEC-${index}`,
            section: "needs-you",
            objectId: `DEC-${index}`,
            severity: index === 0 ? "critical" : "medium",
          }),
        ),
      ),
      "rcsa",
      "08:10",
    );

    expect(queue.now?.id).toBe("DEC-0");
    expect(queue.next).toHaveLength(NEXT_LIMIT);
    expect(queue.next.map((row) => row.id)).not.toContain("DEC-0");
  });

  it("uses a prepared item for Now only when nothing needs the user", () => {
    const withoutDecisions = assembleFocusQueue(
      [candidate(item({ id: "AIS-1", section: "prepared", objectId: "ASM-1" }))],
      "rcsa",
      "08:10",
    );
    expect(withoutDecisions.now?.id).toBe("AIS-1");

    const withDecisions = assembleFocusQueue(
      [
        candidate(item({ id: "AIS-1", section: "prepared", objectId: "ASM-1" })),
        candidate(item({ id: "DEC-1", section: "needs-you", objectId: "DEC-1" })),
      ],
      "rcsa",
      "08:10",
    );
    expect(withDecisions.now?.id).toBe("DEC-1");
  });

  it("caps the watching list so it stays a glance", () => {
    const queue = assembleFocusQueue(
      Array.from({ length: WATCHING_LIMIT + 5 }, (_, index) =>
        candidate(
          item({
            id: `KRI-${index}`,
            section: "watching",
            objectType: "kri",
            objectId: `KRI-${index}`,
          }),
        ),
      ),
      "rcsa",
      "08:10",
    );

    expect(queue.watching).toHaveLength(WATCHING_LIMIT);
  });

  it("keeps the Now card to a small fixed number of lines", () => {
    // The caps are the mechanism behind the five second read, so they are
    // asserted rather than left as a convention someone can quietly raise.
    expect(NOW_CHANGED_LIMIT).toBeLessThanOrEqual(2);
    expect(NOW_COMPLETED_LIMIT).toBeLessThanOrEqual(3);
    expect(NEXT_LIMIT).toBeLessThanOrEqual(3);
  });

  it("returns no Now when the day holds nothing for this role", () => {
    const queue = assembleFocusQueue([], "rcsa", "07:45");
    expect(queue.now).toBeNull();
    expect(queue.next).toStrictEqual([]);
    expect(queue.items).toStrictEqual([]);
  });
});

/* ==========================================================================
   Age and clause formatting
   ========================================================================== */

describe("age formatting", () => {
  it("reads in scenario time, not wall clock", () => {
    expect(momentAge("07:45", "07:45", "en")).toBe("now");
    expect(momentAge("07:45", "08:10", "en")).toBe("25m");
    expect(momentAge("07:45", "08:45", "en")).toBe("1h");
    expect(momentAge("07:45", "09:20", "en")).toBe("1h 35m");
    expect(momentAge("07:45", "07:45", "de")).toBe("jetzt");
  });

  it("keeps a reason to one clause", () => {
    expect(firstClause("The recorded effectiveness is disputed, and two lines disagree.")).toBe(
      "The recorded effectiveness is disputed",
    );
    expect(firstClause("")).toBe("");
    const long = firstClause("a".repeat(200), 40);
    expect(long.length).toBeLessThanOrEqual(44);
  });
});

/* ==========================================================================
   Selection
   ========================================================================== */

describe("selection", () => {
  const start: SelectionSnapshot = { roleId: "rcsa", selection: null };
  const risk = { objectType: "risk" as const, objectId: "RSK-0211", label: "Payment override" };

  it("selects and clears", () => {
    const selected = selectionReducer(start, { kind: "select", selection: risk });
    expect(selected.selection).toStrictEqual(risk);
    expect(selectionReducer(selected, { kind: "clear" }).selection).toBeNull();
  });

  it("survives navigation inside a role when the object is still on the route", () => {
    const next = selectionReducer(
      { roleId: "rcsa", selection: risk },
      { kind: "restore", roleId: "rcsa", selection: risk, validObjectIds: ["RSK-0211", "CTL-1"] },
    );
    expect(next.selection).toStrictEqual(risk);
  });

  it("clears when the object is not part of the new route", () => {
    const next = selectionReducer(
      { roleId: "rcsa", selection: risk },
      { kind: "restore", roleId: "rcsa", selection: risk, validObjectIds: ["CTL-1", "PRC-1"] },
    );
    expect(next.selection).toBeNull();
  });

  it("clears when the new route exposes no objects at all", () => {
    /*
     * A calendar or a mailbox exposes nothing selectable. Treating that as
     * "unknown, keep it" is how a transaction reference survives onto a screen
     * that has nothing to do with it, and both the drawer and the partner then
     * describe an object the reader cannot see.
     */
    const next = selectionReducer(
      { roleId: "rcsa", selection: risk },
      { kind: "restore", roleId: "rcsa", selection: risk, validObjectIds: [] },
    );
    expect(next.selection).toBeNull();
  });

  it("clears on a role switch even when the identifier happens to exist", () => {
    const next = selectionReducer(
      { roleId: "rcsa", selection: risk },
      { kind: "restore", roleId: "tprm", selection: risk, validObjectIds: ["RSK-0211"] },
    );
    expect(next.roleId).toBe("tprm");
    expect(next.selection).toBeNull();
  });

  it("round trips through the query parameter", () => {
    expect(formatSelectionParam(risk)).toBe("risk:RSK-0211");
    expect(parseSelectionParam("risk:RSK-0211")).toStrictEqual({
      objectType: "risk",
      objectId: "RSK-0211",
      label: "RSK-0211",
    });
    expect(parseSelectionParam("risk:RSK-0211", () => "Payment override")).toStrictEqual(risk);
  });

  it("refuses a parameter that is not a selectable object type", () => {
    expect(parseSelectionParam("nonsense:RSK-0211")).toBeNull();
    expect(parseSelectionParam("risk:")).toBeNull();
    expect(parseSelectionParam(":RSK-0211")).toBeNull();
    expect(parseSelectionParam(null)).toBeNull();
    expect(parseSelectionParam("")).toBeNull();
  });
});

/* ==========================================================================
   The changed-object cap
   ========================================================================== */

describe("changed objects", () => {
  function change(overrides: Partial<ChangedObject> & { objectId: string }): ChangedObject {
    return {
      objectType: "control",
      label: "A control",
      reason: "changed by a recorded action",
      atMoment: "11:45",
      source: "audit",
      ...overrides,
    };
  }

  it("caps the marked set, because a marker on everything marks nothing", () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      change({ objectId: `CTL-${index}`, atMoment: "11:45" }),
    );
    expect(rankChangedObjects(many, 6)).toHaveLength(6);
    expect(rankChangedObjects(many, 0)).toHaveLength(0);
  });

  it("prefers the most recent change", () => {
    const ranked = rankChangedObjects(
      [
        change({ objectId: "OLD", atMoment: "07:45" }),
        change({ objectId: "NEW", atMoment: "14:05" }),
        change({ objectId: "MID", atMoment: "11:45" }),
      ],
      2,
    );
    expect(ranked.map((row) => row.objectId)).toStrictEqual(["NEW", "MID"]);
  });

  it("collapses two reports of the same object and keeps the stronger source", () => {
    const ranked = rankChangedObjects(
      [
        change({ objectId: "CTL-PAY-014", source: "record", atMoment: "14:05" }),
        change({ objectId: "CTL-PAY-014", source: "live-event", atMoment: "14:05" }),
      ],
      6,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.source).toBe("live-event");
  });

  it("lets a later record change beat an earlier event", () => {
    const ranked = rankChangedObjects(
      [
        change({ objectId: "CTL-PAY-014", source: "live-event", atMoment: "11:45" }),
        change({ objectId: "CTL-PAY-014", source: "record", atMoment: "14:05" }),
      ],
      6,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.atMoment).toBe("14:05");
  });
});

/* ==========================================================================
   Copy discipline
   ========================================================================== */

/** Every bilingual pair this feature owns, flattened for assertion. */
function everyLabel(): Array<{ key: string; pair: LabelPair }> {
  const dictionaries: Array<[string, Record<string, LabelPair>]> = [
    ["WS_SHARED", WS_SHARED],
    ["WS_RCSA", WS_RCSA],
    ["WS_TPRM", WS_TPRM],
    ["WS_ASSURANCE", WS_ASSURANCE],
    ["WS_INCIDENT", WS_INCIDENT],
    ["WS_REGULATORY", WS_REGULATORY],
    ["WS_GOVERNANCE", WS_GOVERNANCE],
    ["FOCUS_SECTION_LABELS", FOCUS_SECTION_LABELS],
  ];

  const out: Array<{ key: string; pair: LabelPair }> = [];
  for (const [name, dictionary] of dictionaries) {
    for (const [key, pair] of Object.entries(dictionary)) {
      out.push({ key: `${name}.${key}`, pair });
    }
  }
  return out;
}

describe("label copy", () => {
  it("carries both an English and a German form for every label", () => {
    for (const { key, pair } of everyLabel()) {
      expect(pair.en.length, `${key} has no English form`).toBeGreaterThan(0);
      expect(pair.de.length, `${key} has no German form`).toBeGreaterThan(0);
    }
  });

  it("contains no em dash", () => {
    // The character is written by code point so this file does not itself
    // contain the thing the copy gate scans for.
    const emDash = String.fromCodePoint(0x2014);
    for (const { key, pair } of everyLabel()) {
      expect(pair.en.includes(emDash), `${key} English form has an em dash`).toBe(false);
      expect(pair.de.includes(emDash), `${key} German form has an em dash`).toBe(false);
    }
  });

  it("writes German in ASCII transliteration, with no umlaut characters", () => {
    const umlauts = new RegExp(
      `[${[0xc4, 0xd6, 0xdc, 0xe4, 0xf6, 0xfc, 0xdf]
        .map((code) => String.fromCodePoint(code))
        .join("")}]`,
    );
    for (const { key, pair } of everyLabel()) {
      expect(umlauts.test(pair.de), `${key} German form contains an umlaut`).toBe(false);
      expect(umlauts.test(pair.en), `${key} English form contains an umlaut`).toBe(false);
    }
  });

  it("names no model, provider or vendor", () => {
    /*
     * The product describes what it did, never what produced the output. A
     * label naming a provider would also date the demonstration the moment the
     * provider is changed.
     */
    const forbidden = [
      "openai",
      "chatgpt",
      "gpt-",
      "anthropic",
      "claude",
      "gemini",
      "bard",
      "llama",
      "mistral",
      "cohere",
      "copilot",
      "bedrock",
      "vertex",
      "azure",
      "aws",
      "google",
      "microsoft",
      "nvidia",
      "huggingface",
    ];

    for (const { key, pair } of everyLabel()) {
      const haystack = `${pair.en} ${pair.de}`.toLowerCase();
      for (const needle of forbidden) {
        expect(haystack.includes(needle), `${key} names ${needle}`).toBe(false);
      }
    }
  });

  it("names no regulatory framework in a shared label file", () => {
    /*
     * Framework labels are jurisdiction bound and the entities in this
     * scenario are not in the same jurisdiction, so a framework name in a file
     * shared by all six roles would be true for some entities and false for
     * others. Framework wording belongs to the record, with the standing
     * disclosure attached.
     */
    const frameworks = ["dora", "finma", "eba", "mifid", "basel", "gdpr"];
    for (const { key, pair } of everyLabel()) {
      const haystack = `${pair.en} ${pair.de}`.toLowerCase();
      for (const needle of frameworks) {
        expect(haystack.includes(needle), `${key} names ${needle}`).toBe(false);
      }
    }
  });
});
