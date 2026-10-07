/**
 * The rules of pilot management (`src/features/product/pilot/rules.ts`).
 *
 * The claims these pin: a pilot covers Available roles and installed Role Apps
 * only; it never runs autonomously; a baseline is a person's figure with its
 * period, or unavailable with the reason; a pilot starts only with a window,
 * a cohort and every baseline recorded; and an exit decision states its
 * commercial implication in words, rests on evidence, and is taken on a
 * started pilot.
 */

import { describe, expect, it } from "vitest";
import {
  isMonday,
  parseBaselineImport,
  startConditions,
  statesAFigure,
  validateBaseline,
  validateCohort,
  validateExitDecision,
  validateReading,
  validateSetup,
  weekStartOf,
  type SetupDraft,
  type SetupOptions,
} from "@/features/product/pilot/rules";

const OPTIONS: SetupOptions = {
  legalEntityIds: ["ARC-DE", "ARC-AT", "ARC-CH"],
  roles: [
    { roleId: "rcsa", status: "available", label: "Operational Risk Partner" },
    { roleId: "tprm", status: "available", label: "Third-Party Risk Manager" },
    { roleId: "control-assurance", status: "demo", label: "Control Assurance Specialist" },
    { roleId: "regulatory-change", status: "planned", label: "Regulatory Change Manager" },
  ],
  roleApps: [
    { id: "rcsa-cycle-assistant", roleId: "rcsa", status: "installed", name: "RCSA Cycle Assistant" },
    { id: "tprm-third-party-onboarding", roleId: "tprm", status: "installed", name: "Third-Party Onboarding" },
    { id: "kri-monitor", roleId: "rcsa", status: "preview", name: "KRI Monitor" },
  ],
  connectorIds: ["CI-GRC-SIM", "CI-DMS-SIM"],
  entitlementProfileIds: ["entitlement-two-function-pilot"],
};

function draft(patch: Partial<SetupDraft> = {}): SetupDraft {
  return {
    businessArea: "Second line non-financial risk",
    businessAreaDe: "Nichtfinanzielle Risiken der zweiten Linie",
    legalEntityIds: ["ARC-DE"],
    roleIds: ["rcsa", "tprm"],
    roleAppIds: ["rcsa-cycle-assistant", "tprm-third-party-onboarding"],
    sourceSystemIds: ["CI-GRC-SIM"],
    entitlementProfileId: "entitlement-two-function-pilot",
    maxAutonomyLevel: "act-with-approval",
    supportContacts: [{ label: "Service desk", role: "Pilot users", channel: "" }],
    plannedStartOn: "2026-10-12",
    plannedEndOn: "2026-12-04",
    ...patch,
  };
}

describe("setup", () => {
  it("accepts a setup inside the release", () => {
    expect(validateSetup(draft(), OPTIONS).ok).toBe(true);
  });

  it("refuses Demo and Planned roles and preview Role Apps, with the reason", () => {
    const result = validateSetup(draft({ roleIds: ["rcsa", "control-assurance", "regulatory-change"], roleAppIds: ["kri-monitor"] }), OPTIONS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = result.problems.map((entry) => entry.en).join(" ");
    expect(text).toContain("Demo role");
    expect(text).toContain("Planned role");
    expect(text).toContain("not installed");
  });

  it("never allows autonomous execution within policy", () => {
    expect(validateSetup(draft({ maxAutonomyLevel: "act-within-policy" }), OPTIONS).ok).toBe(false);
  });

  it("needs both window dates, in order", () => {
    expect(validateSetup(draft({ plannedEndOn: null }), OPTIONS).ok).toBe(false);
    expect(validateSetup(draft({ plannedStartOn: "2026-12-10" }), OPTIONS).ok).toBe(false);
    expect(validateSetup(draft({ plannedStartOn: null, plannedEndOn: null }), OPTIONS).ok).toBe(true);
  });

  it("refuses an app whose role is not in the pilot", () => {
    expect(validateSetup(draft({ roleIds: ["rcsa"] }), OPTIONS).ok).toBe(false);
  });
});

describe("cohort", () => {
  const candidates = [
    { userId: "PILOT-001", roleIds: ["rcsa"], isAdministrator: false },
    { userId: "PILOT-ADM", roleIds: [], isAdministrator: true },
  ];
  it("holds identity accounts in the pilot's roles, never an administrator", () => {
    expect(validateCohort(["PILOT-001"], candidates, ["rcsa"]).ok).toBe(true);
    expect(validateCohort(["PILOT-ADM"], candidates, ["rcsa"]).ok).toBe(false);
    expect(validateCohort(["SOMEONE"], candidates, ["rcsa"]).ok).toBe(false);
    expect(validateCohort(["PILOT-001"], candidates, ["tprm"]).ok).toBe(false);
  });
});

describe("baseline", () => {
  it("records a measured figure only with its period", () => {
    expect(validateBaseline({ status: "measured", value: "21", period: "Q3 2026", note: "" }, "days").ok).toBe(true);
    expect(validateBaseline({ status: "measured", value: "21", period: "", note: "" }, "days").ok).toBe(false);
    expect(validateBaseline({ status: "measured", value: "abc", period: "Q3", note: "" }, "days").ok).toBe(false);
  });

  it("refuses an impossible value for the unit", () => {
    expect(validateBaseline({ status: "measured", value: "120", period: "Q3", note: "" }, "percent").ok).toBe(false);
    expect(validateBaseline({ status: "measured", value: "2.5", period: "Q3", note: "" }, "count").ok).toBe(false);
  });

  it("records unavailable only with the reason", () => {
    expect(validateBaseline({ status: "unavailable", value: "", period: "", note: "" }, "days").ok).toBe(false);
    expect(validateBaseline({ status: "unavailable", value: "", period: "", note: "Not tracked by the bank" }, "days").ok).toBe(true);
  });

  it("imports every line or none", () => {
    const measures = [
      { key: "cycle-time", unit: "days" as const },
      { key: "evidence-completeness", unit: "percent" as const },
    ];
    const good = parseBaselineImport("measure, value, period\ncycle-time, 21, Q3 2026\nevidence-completeness, 70, Q3 2026", measures);
    expect(good.ok && good.value.length).toBe(2);
    expect(parseBaselineImport("cycle-time, 21, Q3 2026\nunknown, 3, Q3", measures).ok).toBe(false);
    expect(parseBaselineImport("evidence-completeness, 140, Q3", measures).ok).toBe(false);
    expect(parseBaselineImport("", measures).ok).toBe(false);
  });
});

describe("weekly readings", () => {
  it("belong to a week starting on a Monday", () => {
    expect(weekStartOf("2026-10-07")).toBe("2026-10-05");
    expect(isMonday("2026-10-05")).toBe(true);
    expect(validateReading({ weekStarting: "2026-10-07", status: "measured", value: "3", source: "action register", note: "" }, "count").ok).toBe(false);
    expect(validateReading({ weekStarting: "2026-10-05", status: "unavailable", value: "", source: "action register", note: "" }, "count").ok).toBe(false);
    expect(validateReading({ weekStarting: "2026-10-05", status: "measured", value: "3", source: "action register", note: "" }, "count").ok).toBe(true);
  });
});

describe("starting the pilot", () => {
  it("names every condition still open", () => {
    const conditions = startConditions({
      status: "setup",
      plannedStartOn: null,
      plannedEndOn: null,
      cohortSize: 0,
      baselines: [{ label: { en: "Cycle time", de: "Durchlaufzeit" }, status: "not-measured" }],
    });
    expect(conditions).toHaveLength(3);
    expect(
      startConditions({ status: "setup", plannedStartOn: "2026-10-12", plannedEndOn: "2026-12-04", cohortSize: 2, baselines: [{ label: { en: "x", de: "x" }, status: "unavailable" }] }),
    ).toHaveLength(0);
  });
});

describe("the exit decision", () => {
  const running = { id: "PILOT-1", status: "running" as const, plannedEndOn: "2026-12-04" };
  const decision = {
    outcome: "extend",
    rationale: "Four more weeks of use are needed before a scale decision.",
    commercialImplication: "No commercial implication can be stated until readings show a change.",
    nextWaveRecommendation: "Add the Austrian entity.",
    unresolvedConditions: ["Identity does not bind approvals"],
    controlFindings: ["Audit chain coverage not verified"],
    evidence: [{ kind: "evidence-pack", ref: "abc123", label: "Pack" }],
    extendedEndOn: "2027-01-29",
  };

  it("records a complete decision on a started pilot", () => {
    const result = validateExitDecision(running, decision);
    expect(result.ok).toBe(true);
  });

  it("refuses a figure in the commercial implication", () => {
    expect(statesAFigure("A saving of 20 percent")).toBe(true);
    expect(statesAFigure("about EUR 2 million a year")).toBe(true);
    expect(statesAFigure("rund 300.000 €")).toBe(true);
    expect(statesAFigure("Two roles, four more weeks of use")).toBe(false);
    expect(validateExitDecision(running, { ...decision, commercialImplication: "Saves 1.2m" }).ok).toBe(false);
  });

  it("needs evidence, a started pilot and, to extend, a later end", () => {
    expect(validateExitDecision(running, { ...decision, evidence: [] }).ok).toBe(false);
    expect(validateExitDecision({ ...running, status: "setup" }, decision).ok).toBe(false);
    expect(validateExitDecision(running, { ...decision, extendedEndOn: "2026-11-01" }).ok).toBe(false);
    expect(validateExitDecision(running, { ...decision, outcome: "stop", extendedEndOn: null }).ok).toBe(true);
  });
});
