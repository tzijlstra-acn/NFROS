/**
 * The attention order behind Now and Next.
 *
 * Plan section 4.3 orders Next by materiality, deadline, dependency and
 * readiness. `focus.ts` names those keys in `ATTENTION_ORDER` and compares on
 * them one at a time, so each key is tested here in isolation and then in the
 * order the plan gives, with the pair of items that would come out the other
 * way round if two keys were swapped.
 */

import { describe, expect, it } from "vitest";
import {
  assembleFocusQueue,
  ATTENTION_ORDER,
  compareOnAttentionKey,
  orderForAttention,
  orderFocusItems,
  type FocusCandidate,
} from "@/db/repositories/focus";
import type { FocusItemView } from "@/workday/contracts";

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

function candidate(view: FocusItemView): FocusCandidate {
  return { item: view, relatedObjectKey: null };
}

const ids = (items: FocusItemView[]) => items.map((row) => row.id);

describe("the attention keys", () => {
  it("are the plan's four, in the plan's order, then two tie breaks", () => {
    expect([...ATTENTION_ORDER]).toStrictEqual([
      "materiality",
      "deadline",
      "dependency",
      "readiness",
      "age",
      "identifier",
    ]);
  });

  it("rank materiality by severity", () => {
    const critical = item({ id: "A", severity: "critical" });
    const low = item({ id: "B", severity: "low" });
    expect(compareOnAttentionKey("materiality", critical, low)).toBeLessThan(0);
  });

  it("rank a deadline ahead of none, and the earlier deadline first", () => {
    const due10 = item({ id: "A", dueMoment: "10:00" });
    const due12 = item({ id: "B", dueMoment: "12:00" });
    const none = item({ id: "C", dueMoment: null });
    expect(compareOnAttentionKey("deadline", due10, due12)).toBeLessThan(0);
    expect(compareOnAttentionKey("deadline", due12, none)).toBeLessThan(0);
  });

  it("rank work waiting on the person ahead of work prepared for review", () => {
    const waiting = item({ id: "A", section: "needs-you" });
    const prepared = item({ id: "B", section: "prepared" });
    expect(compareOnAttentionKey("dependency", waiting, prepared)).toBeLessThan(0);
  });

  it("rank finished preparation ahead of preparation still in hand", () => {
    const ready = item({ id: "A", aiStatus: "ready" });
    const checking = item({ id: "B", aiStatus: "checking" });
    expect(compareOnAttentionKey("readiness", ready, checking)).toBeLessThan(0);
  });
});

describe("the order across keys", () => {
  it("puts materiality before deadline", () => {
    const order = orderForAttention([
      item({ id: "DUE-SOON", severity: "medium", dueMoment: "08:00" }),
      item({ id: "MATERIAL", severity: "high", dueMoment: null }),
    ]);
    expect(ids(order)).toStrictEqual(["MATERIAL", "DUE-SOON"]);
  });

  it("puts deadline before dependency", () => {
    const order = orderForAttention([
      item({ id: "WAITING", section: "needs-you", dueMoment: null }),
      item({ id: "PREPARED-DUE", section: "prepared", dueMoment: "10:30" }),
    ]);
    expect(ids(order)).toStrictEqual(["PREPARED-DUE", "WAITING"]);
  });

  it("puts dependency before readiness", () => {
    const order = orderForAttention([
      item({ id: "PREPARED-READY", section: "prepared", aiStatus: "ready" }),
      item({ id: "WAITING-CHECKING", section: "needs-you", aiStatus: "checking" }),
    ]);
    expect(ids(order)).toStrictEqual(["WAITING-CHECKING", "PREPARED-READY"]);
  });

  it("puts readiness before age", () => {
    const order = orderForAttention([
      item({ id: "OLD-CHECKING", aiStatus: "checking", arrivedAtMoment: "07:45" }),
      item({ id: "NEW-READY", aiStatus: "ready", arrivedAtMoment: "10:30" }),
    ]);
    expect(ids(order)).toStrictEqual(["NEW-READY", "OLD-CHECKING"]);
  });

  it("agrees with the section order for a list drawn from one section", () => {
    const list = [
      item({ id: "C", severity: "medium", arrivedAtMoment: "07:45" }),
      item({ id: "A", severity: "critical", arrivedAtMoment: "14:05" }),
      item({ id: "B", severity: "high", arrivedAtMoment: "11:45" }),
    ];
    expect(ids(orderFocusItems(list))).toStrictEqual(ids(orderForAttention(list)));
  });
});

describe("Now and Next in the attention order", () => {
  it("promotes a more material prepared item above a less material open decision", () => {
    const queue = assembleFocusQueue(
      [
        candidate(item({ id: "DEC-MEDIUM", section: "needs-you", severity: "medium" })),
        candidate(item({ id: "EVENT-CRITICAL", section: "prepared", objectType: "incident", severity: "critical" })),
      ],
      "rcsa",
      "14:05",
    );
    expect(queue.now?.id).toBe("EVENT-CRITICAL");
    expect(ids(queue.next)).toStrictEqual(["DEC-MEDIUM"]);
  });

  it("keeps an equally material open decision ahead of a prepared item", () => {
    const queue = assembleFocusQueue(
      [
        candidate(item({ id: "PREPARED", section: "prepared", objectType: "assessment", severity: "high" })),
        candidate(item({ id: "DECISION", section: "needs-you", severity: "high" })),
      ],
      "rcsa",
      "08:10",
    );
    expect(queue.now?.id).toBe("DECISION");
    expect(ids(queue.next)).toStrictEqual(["PREPARED"]);
  });

  it("orders Next by the same keys and caps it at three", () => {
    const queue = assembleFocusQueue(
      [
        candidate(item({ id: "N1", severity: "high" })),
        candidate(item({ id: "N2", severity: "medium", dueMoment: "10:30" })),
        candidate(item({ id: "N3", severity: "medium" })),
        candidate(item({ id: "N4", section: "prepared", objectType: "assessment", severity: "medium" })),
        candidate(item({ id: "N5", severity: "low" })),
      ],
      "rcsa",
      "08:10",
    );
    expect(queue.now?.id).toBe("N1");
    expect(ids(queue.next)).toStrictEqual(["N2", "N3", "N4"]);
  });
});
