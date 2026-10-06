/**
 * The Work Hub shell: URL state, selection, the bound context and the role
 * configuration.
 *
 *   The selection is one identifier in the URL and every tab link carries
 *   it, so it persists across tabs.
 *   The first module that recognises an identifier owns it.
 *   The bound context is a projection of the detail, nothing more.
 *   The two roles configure the same six groups, in both languages, in ASCII.
 *   Role copy is not embedded in the shared renderer: the shell and module
 *   files name no role's vocabulary and no scenario object.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toBoundContext, WORK_TABS } from "@/features/work/model";
import { partnerTypeFor, resolveSelected, subjectAiContext } from "@/features/work/selection";
import { DEFAULT_QUERY, itemHref, parseWorkQuery, workHref } from "@/features/work/url";
import { getWorkRoleConfig, workRoleIds } from "@/features/work/roles";
import { OPERATIONAL_RISK_WORK } from "@/features/work/roles/operational-risk";
import { THIRD_PARTY_RISK_WORK } from "@/features/work/roles/third-party-risk";
import { resolveActionDetail, EMPTY_ACTIONS_EXTRAS } from "@/features/work/modules/actions/read-model";
import { actionRow, query, shared } from "./support/work-fixtures";

describe("URL state", () => {
  it("falls back to the defaults for missing or invalid values", () => {
    expect(parseWorkQuery(undefined)).toStrictEqual(DEFAULT_QUERY);
    const parsed = parseWorkQuery({ view: "nonsense", filter: "everything", item: "a b<script>", scope: "year" });
    expect(parsed).toStrictEqual(DEFAULT_QUERY);
  });

  it("keeps the earlier hub's action filter value", () => {
    expect(parseWorkQuery({ view: "actions", filter: "waiting-others" }).actionsView).toBe("waiting-others");
  });

  it("carries the selection and every saved view across a tab change, and drops the kind filter", () => {
    const current = parseWorkQuery({ view: "actions", item: "MSN-2026-0188", filter: "overdue", scope: "week", kind: "remediation" });
    const href = workHref("tprm", current, { tab: "agenda" });
    const next = parseWorkQuery(Object.fromEntries(new URL(`http://x${href}`).searchParams));
    expect(next).toMatchObject({ tab: "agenda", item: "MSN-2026-0188", actionsView: "overdue", scope: "week", kind: null });
  });

  it("writes only non-default values, so the common links stay short", () => {
    expect(workHref("rcsa", DEFAULT_QUERY)).toBe("/workday/rcsa/work");
    expect(itemHref("rcsa", "actions", "MSN-1")).toBe("/workday/rcsa/work?view=actions&item=MSN-1");
  });
});

describe("selection", () => {
  it("gives the identifier to the first module that recognises it", () => {
    const calls: string[] = [];
    const found = resolveSelected("X", [
      (id) => {
        calls.push(`agenda:${id}`);
        return null;
      },
      (id) => {
        calls.push(`meetings:${id}`);
        return "meeting";
      },
      () => {
        calls.push("actions");
        return "action";
      },
    ]);
    expect(found).toBe("meeting");
    expect(calls).toStrictEqual(["agenda:X", "meetings:X"]);
    expect(resolveSelected(null, [() => "never"])).toBeNull();
  });

  it("maps an item's subject onto the partner's object types, and keeps the role context otherwise", () => {
    expect(partnerTypeFor("rcsa")).toBe("assessment");
    expect(partnerTypeFor("kri")).toBeNull();
    expect(subjectAiContext("kri", "KRI-1", "Title", "Meeting", "en").selection).toBeNull();
    expect(subjectAiContext("supplier", "TP-1", "Title", "Meeting", "en").selection).toStrictEqual({
      objectType: "supplier",
      objectId: "TP-1",
      label: "Title",
    });
  });

  it("projects the detail into the bound context without adding anything", () => {
    const detail = resolveActionDetail("A-1", shared({ actions: [actionRow({ id: "A-1" })] }), EMPTY_ACTIONS_EXTRAS, query());
    expect(detail).not.toBeNull();
    if (!detail) return;
    const bound = toBoundContext("rcsa", detail);
    expect(bound).toMatchObject({ roleId: "rcsa", itemId: "A-1", kind: "action", title: detail.title });
    expect(bound.evidence).toBe(detail.evidence);
    expect(bound.ai).toBe(detail.ai);
  });
});

describe("role configuration", () => {
  it("exists for exactly the two Available roles", () => {
    expect(workRoleIds().sort()).toStrictEqual(["rcsa", "tprm"]);
    expect(getWorkRoleConfig("control-assurance")).toBeNull();
  });

  it("configures the same groups and action kinds for both roles", () => {
    expect(Object.keys(OPERATIONAL_RISK_WORK).sort()).toStrictEqual(Object.keys(THIRD_PARTY_RISK_WORK).sort());
    expect(Object.keys(OPERATIONAL_RISK_WORK.actionKinds).sort()).toStrictEqual(Object.keys(THIRD_PARTY_RISK_WORK.actionKinds).sort());
    expect(Object.keys(OPERATIONAL_RISK_WORK.inboxClassifications).sort()).toStrictEqual(
      Object.keys(THIRD_PARTY_RISK_WORK.inboxClassifications).sort(),
    );
  });

  it("is bilingual and ASCII only, with no dash used as punctuation", () => {
    for (const config of [OPERATIONAL_RISK_WORK, THIRD_PARTY_RISK_WORK]) {
      const text = JSON.stringify(config);
      /* Umlauts, sharp s, en dash and em dash, by code point so this file carries none of them. */
      const forbidden = new RegExp(`[${[0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf, 0x2013, 0x2014].map((code) => String.fromCharCode(code)).join("")}]`);
      expect(forbidden.test(text)).toBe(false);
      expect(text).not.toMatch(/ -- /);
      const pairs: Array<{ en: string; de: string }> = [];
      JSON.parse(text, (key, value) => {
        if (value && typeof value === "object" && "en" in value && "de" in value) pairs.push(value as { en: string; de: string });
        return value;
      });
      expect(pairs.length).toBeGreaterThan(40);
      for (const pair of pairs) {
        expect(pair.en.length, JSON.stringify(pair)).toBeGreaterThan(0);
        expect(pair.de.length, JSON.stringify(pair)).toBeGreaterThan(0);
      }
    }
  });
});

describe("role copy is not embedded in the shared renderer", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return entry === "roles" ? [] : files(full);
      return /\.(ts|tsx)$/.test(entry) ? [full] : [];
    });
  }

  const shell = [...files(join(process.cwd(), "src", "features", "work")), ...files(join(process.cwd(), "src", "components", "work"))];
  const roleVocabulary = [
    "RCSA challenge workshop",
    "Supplier challenge call",
    "Specialist review huddle",
    "First-line validation",
    "challenge pack",
    "supplier pack",
    "Novalink",
    "Veridian",
    "RCSA-ARC",
    "TP-0042",
    "CTL-PAY",
  ];

  it("finds the shell and module files", () => {
    expect(shell.length).toBeGreaterThan(20);
  });

  for (const phrase of roleVocabulary) {
    it(`does not name "${phrase}" outside the role configuration`, () => {
      const offenders = shell.filter((file) => readFileSync(file, "utf8").includes(phrase));
      expect(offenders).toStrictEqual([]);
    });
  }

  it("renders all four tabs from one tab list", () => {
    expect(WORK_TABS).toStrictEqual(["agenda", "meetings", "actions", "inbox"]);
  });
});
