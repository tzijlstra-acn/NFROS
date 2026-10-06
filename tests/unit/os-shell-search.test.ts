/**
 * Global search and the command palette: the pure rules.
 *
 * The matcher, the grouping, the recent and pinned lists and the command
 * builder are pure so the palette and these tests apply one rule. The
 * database-backed scope (which objects a role may find, and where each opens)
 * is tested against a seeded database in `tests/integration/os-shell.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  buildPaletteCommands,
  HITS_PER_GROUP,
  isPinned,
  normaliseForSearch,
  PALETTE_COMMAND_IDS,
  parseStored,
  PINNED_LIMIT,
  RECENT_LIMIT,
  reconcileStored,
  rememberRecent,
  scoreEntry,
  searchEntries,
  storageKey,
  togglePinned,
  toStored,
  type SearchEntry,
  type SearchKind,
} from "@/features/search";

function entry(kind: SearchKind, id: string, label: string, extra: Partial<SearchEntry> = {}): SearchEntry {
  return {
    kind,
    id,
    label,
    reference: id,
    detail: null,
    href: `/workday/rcsa/work?view=actions&object=${id}`,
    keywords: "",
    ...extra,
  };
}

const ORDER: SearchKind[] = ["decision", "action", "risk", "control", "supplier", "evidence"];

describe("normalising a query", () => {
  it("lower cases, collapses whitespace and transliterates German letters to the product's ASCII forms", () => {
    // Built from code points so this file carries no umlaut character.
    const typed = `Pr${String.fromCodePoint(0xfc)}fung  der Ma${String.fromCodePoint(0xdf)}nahme`;
    expect(normaliseForSearch(typed)).toBe("pruefung der massnahme");
  });

  it("strips accents that are not German letters", () => {
    expect(normaliseForSearch(`R${String.fromCodePoint(0xe9)}sum${String.fromCodePoint(0xe9)}`)).toBe("resume");
  });
});

describe("matching", () => {
  const control = entry("control", "CTL-PAY-014", "Manual override review", { reference: "CTL-PAY-014" });

  it("requires every word of the query, not a subsequence of letters", () => {
    expect(scoreEntry(control, ["override", "review"])).not.toBeNull();
    expect(scoreEntry(control, ["override", "approval"])).toBeNull();
    // The V2 palette matched subsequences; "mor" is in no word here.
    expect(scoreEntry(entry("control", "C-1", "Critical Control"), ["crcl"])).toBeNull();
  });

  it("ranks an exact reference over a prefix, a prefix over a label start, and a label start over a word", () => {
    const exact = scoreEntry(control, ["ctl-pay-014"]);
    const prefix = scoreEntry(control, ["ctl-pay"]);
    const labelStart = scoreEntry(control, ["manual"]);
    const word = scoreEntry(control, ["review"]);
    expect(exact).toBe(0);
    expect(prefix).toBe(1);
    expect(labelStart).toBe(2);
    expect(word).toBe(3);
  });

  it("finds an entry by its keywords without showing them", () => {
    const supplier = entry("supplier", "TP-0099", "Veridian Document Systems GmbH", { keywords: "Druck Archiv" });
    expect(scoreEntry(supplier, ["archiv"])).not.toBeNull();
  });
});

describe("grouping by professional object type", () => {
  const entries: SearchEntry[] = [
    entry("risk", "RSK-0211", "Payment repair backlog"),
    entry("control", "CTL-PAY-014", "Payment override review"),
    entry("decision", "DEC-2026-0771", "Payment indicator explanation"),
    ...Array.from({ length: 8 }, (_, index) => entry("evidence", `EVD-${index}`, `Payment evidence ${index}`)),
  ];

  it("returns nothing for a blank query across the whole scope, so commands are not buried", () => {
    expect(searchEntries(entries, "   ", { kindOrder: ORDER, language: "en" })).toEqual([]);
  });

  it("orders the groups by the role's kind order and labels them in the interface language", () => {
    const groups = searchEntries(entries, "payment", { kindOrder: ORDER, language: "de" });
    expect(groups.map((group) => group.kind)).toEqual(["decision", "risk", "control", "evidence"]);
    expect(groups.map((group) => group.label)).toEqual(["Entscheidungen", "Risiken", "Kontrollen", "Nachweise"]);
  });

  it("shows at most a handful per group and says how many matched", () => {
    const evidence = searchEntries(entries, "payment", { kindOrder: ORDER, language: "en" }).find(
      (group) => group.kind === "evidence",
    );
    expect(evidence?.hits).toHaveLength(HITS_PER_GROUP);
    expect(evidence?.total).toBe(8);
  });

  it("lists one type on a blank query when the search is narrowed to it", () => {
    const groups = searchEntries(entries, "", { kindOrder: ORDER, language: "en", kind: "evidence" });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.hits).toHaveLength(8);
  });

  it("leads with the group holding an exact reference match, whatever the kind order", () => {
    const scope = [
      entry("decision", "DEC-1", "Rating of the override control", { keywords: "CTL-PAY-014" }),
      entry("control", "CTL-PAY-014", "Manual override review"),
    ];
    const groups = searchEntries(scope, "CTL-PAY-014", { kindOrder: ORDER, language: "en" });
    expect(groups.map((group) => group.kind)).toEqual(["control", "decision"]);
    // Without an exact match the role's order holds.
    expect(searchEntries(scope, "override", { kindOrder: ORDER, language: "en" }).map((group) => group.kind)).toEqual([
      "decision",
      "control",
    ]);
  });

  it("never returns a type the search was not narrowed to", () => {
    const groups = searchEntries(entries, "payment", { kindOrder: ORDER, language: "en", kind: "control" });
    expect(groups.map((group) => group.kind)).toEqual(["control"]);
  });
});

describe("recent and pinned objects", () => {
  const a = toStored(entry("risk", "RSK-0211", "Payment repair backlog"));
  const b = toStored(entry("control", "CTL-PAY-014", "Override review"));

  it("keeps recent items newest first, once each, to a limit", () => {
    let list = rememberRecent([], a);
    list = rememberRecent(list, b);
    list = rememberRecent(list, a);
    expect(list.map((item) => item.id)).toEqual(["RSK-0211", "CTL-PAY-014"]);

    let many = list;
    for (let index = 0; index < RECENT_LIMIT + 3; index += 1) {
      many = rememberRecent(many, toStored(entry("evidence", `EVD-${index}`, "Doc")));
    }
    expect(many).toHaveLength(RECENT_LIMIT);
  });

  it("toggles a pin and keeps pins to a limit", () => {
    const pinned = togglePinned([], a);
    expect(isPinned(pinned, a)).toBe(true);
    expect(isPinned(togglePinned(pinned, a), a)).toBe(false);

    let many = pinned;
    for (let index = 0; index < PINNED_LIMIT + 2; index += 1) {
      many = togglePinned(many, toStored(entry("evidence", `EVD-${index}`, "Doc")));
    }
    expect(many).toHaveLength(PINNED_LIMIT);
  });

  it("keys storage per role", () => {
    expect(storageKey("recent", "rcsa")).not.toBe(storageKey("recent", "tprm"));
    expect(storageKey("pinned", "rcsa")).not.toBe(storageKey("recent", "rcsa"));
  });

  it("discards malformed storage and routes that are not this role's workday", () => {
    expect(parseStored("not json", "rcsa")).toEqual([]);
    expect(parseStored(JSON.stringify({ kind: "risk" }), "rcsa")).toEqual([]);
    const raw = JSON.stringify([
      a,
      { ...b, href: "/workday/tprm/work" },
      { ...b, href: "https://example.invalid/workday/rcsa" },
      { ...b, kind: "secret" },
    ]);
    expect(parseStored(raw, "rcsa").map((item) => item.id)).toEqual(["RSK-0211"]);
  });

  it("drops stored items the scope no longer holds and takes label and route from the scope", () => {
    const scope = [entry("risk", "RSK-0211", "Payment repair backlog, current title", { href: "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh" })];
    const stale = [{ ...a, label: "Edited in storage", href: "/workday/rcsa/decisions" }, b];
    const reconciled = reconcileStored(stale, scope);
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]?.label).toBe("Payment repair backlog, current title");
    expect(reconciled[0]?.href).toBe("/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh");
  });
});

describe("the eight palette commands", () => {
  const found = buildPaletteCommands({
    roleId: "rcsa",
    language: "en",
    nextMeeting: { found: true, href: "/workday/rcsa/work?view=meetings&item=MTG-2026-0006", detail: "09:30 KRI framing" },
    currentProcess: { found: true, href: "/workday/rcsa/processes/rcsa-cycle?stage=evidence-refresh", detail: "RCSA, Stage 2" },
    openDecisions: 3,
  });

  it("lists the plan's commands in the plan's order", () => {
    expect(found.map((command) => command.id)).toEqual([...PALETTE_COMMAND_IDS]);
    expect(found.map((command) => command.label)).toEqual([
      "Open current work",
      "Open next meeting",
      "Find supplier",
      "Find control",
      "Open current process",
      "Review decisions",
      "Ask AI",
      "Open evidence",
    ]);
  });

  it("names what each command opens, from the facts", () => {
    expect(found.find((command) => command.id === "open-next-meeting")?.detail).toBe("09:30 KRI framing");
    expect(found.find((command) => command.id === "review-decisions")?.detail).toBe("3 open");
  });

  it("only navigates inside the role's workday, narrows the search or opens a panel: nothing writes", () => {
    for (const command of found) {
      expect(["navigate", "search", "ask-ai", "evidence"]).toContain(command.action.kind);
      if (command.action.kind === "navigate") expect(command.action.href.startsWith("/workday/rcsa")).toBe(true);
    }
    expect(found.find((command) => command.id === "find-supplier")?.action).toEqual({ kind: "search", searchKind: "supplier" });
    expect(found.find((command) => command.id === "find-control")?.action).toEqual({ kind: "search", searchKind: "control" });
  });

  it("marks a command with nothing to open as unavailable, with the reason in words, in German too", () => {
    const none = buildPaletteCommands({
      roleId: "tprm",
      language: "de",
      nextMeeting: { found: false, reason: "none-remaining" },
      currentProcess: { found: false, reason: "none-active" },
      openDecisions: 0,
    });
    const meeting = none.find((command) => command.id === "open-next-meeting");
    const process = none.find((command) => command.id === "open-current-process");
    expect(meeting?.available).toBe(false);
    expect(meeting?.unavailableReason).toBe("Heute keine weitere Besprechung");
    expect(process?.available).toBe(false);
    expect(process?.unavailableReason).toBe("Kein aktiver Prozess");
    expect(none.find((command) => command.id === "review-decisions")?.detail).toBe("Nichts offen");
  });
});
