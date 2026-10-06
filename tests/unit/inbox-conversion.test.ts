/**
 * The stored inbox conversion rule (migration 0008), without a database.
 *
 * The first conversion to work is kept; a dismissal is recorded only while
 * there is no conversion to work, and work replaces it. Every pair of current
 * and incoming kind is checked, so a handler that calls `conversionPatch`
 * cannot record a different rule from the one the migration backfilled.
 */

import { describe, expect, it } from "vitest";
import { conversionPatch } from "@/db/repositories/inbox-conversion";
import { INBOX_CONVERSION_KINDS, INBOX_WORK_CONVERSION_KINDS, type InboxConversionKind } from "@/db/schema/work";

const AT = "2026-10-06T09:00:00.000Z";

describe("the inbox conversion rule", () => {
  it("names five kinds of work and the dismissal", () => {
    expect([...INBOX_CONVERSION_KINDS]).toStrictEqual(["action", "decision", "evidence", "process", "delegated", "dismissed"]);
    expect([...INBOX_WORK_CONVERSION_KINDS]).toStrictEqual(INBOX_CONVERSION_KINDS.filter((kind) => kind !== "dismissed"));
  });

  it("decides every pair of current and incoming kind", () => {
    const work = new Set<InboxConversionKind>(INBOX_WORK_CONVERSION_KINDS);
    for (const current of [null, ...INBOX_CONVERSION_KINDS]) {
      for (const incoming of INBOX_CONVERSION_KINDS) {
        const patch = conversionPatch({ conversionKind: current }, { kind: incoming, byUserId: "P-002", at: AT });
        const expected = work.has(incoming) ? current === null || current === "dismissed" : current === null;
        expect(patch !== null, `${current ?? "none"} then ${incoming}`).toBe(expected);
        if (patch) expect(patch).toStrictEqual({ conversionKind: incoming, convertedByUserId: "P-002", convertedAt: AT });
      }
    }
  });
});
