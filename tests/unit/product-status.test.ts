/**
 * The product status vocabulary and the rules that map onto it.
 *
 * Unit tests only. The pure mappings are tested directly; the readers that
 * touch the file system are pointed at a temporary directory. Readers that
 * need the database are covered by the screens that use them and by the
 * integration suite, not here.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PRODUCT_STATUS,
  PRODUCT_STATUSES,
  StatusBadge,
  isProductStatus,
  overallStatus,
  statusForAiMode,
  statusForAuditChain,
  statusForConnectorMode,
  statusForHealth,
  statusLabel,
} from "@/product/status";
import {
  countReading,
  coverageReading,
  evaluationReadingsForRole,
  readEvaluationEvidence,
  readPilotEvidencePack,
  summariseEvaluationRun,
  type RecordedEvaluationRun,
} from "@/product/status/sources";

const ROOT = resolve(__dirname, "..", "..");

describe("the vocabulary", () => {
  it("is exactly the eight agreed words, in order", () => {
    expect(PRODUCT_STATUSES.map((status) => PRODUCT_STATUS[status].label.en)).toEqual([
      "Empty",
      "Unavailable",
      "Simulated",
      "Safe",
      "Offline",
      "Live",
      "Verified",
      "Not verified",
    ]);
  });

  it("has a German label, a tone and a one line meaning in both languages", () => {
    for (const status of PRODUCT_STATUSES) {
      const entry = PRODUCT_STATUS[status];
      expect(entry.id).toBe(status);
      expect(entry.label.de.length).toBeGreaterThan(0);
      expect(["neutral", "accent", "info", "success", "warning", "danger"]).toContain(entry.tone);
      expect(entry.meaning.en).toMatch(/\.$/);
      expect(entry.meaning.de).toMatch(/\.$/);
    }
    expect(statusLabel("not-verified", "de")).toBe("Nicht verifiziert");
    expect(statusLabel("unavailable", "de")).toBe("Nicht verfuegbar");
  });

  it("follows the copy rules: no dash punctuation, ASCII German", () => {
    /* Built from character codes so this file carries none of the characters it forbids. */
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    const umlauts = new RegExp(`[${String.fromCharCode(0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf)}]`);
    for (const status of PRODUCT_STATUSES) {
      const entry = PRODUCT_STATUS[status];
      for (const text of [entry.label.en, entry.label.de, entry.meaning.en, entry.meaning.de]) {
        expect(text).not.toMatch(dashes);
        expect(text).not.toMatch(umlauts);
      }
    }
  });

  it("recognises its own words and nothing else", () => {
    expect(isProductStatus("verified")).toBe(true);
    expect(isProductStatus("healthy")).toBe(false);
    expect(isProductStatus("pass")).toBe(false);
  });
});

describe("mappings onto the vocabulary", () => {
  it("maps AI modes one to one", () => {
    expect(statusForAiMode("safe")).toBe("safe");
    expect(statusForAiMode("offline")).toBe("offline");
    expect(statusForAiMode("live")).toBe("live");
  });

  it("maps connector modes to what is true of the data", () => {
    expect(statusForConnectorMode("live")).toBe("live");
    expect(statusForConnectorMode("simulated")).toBe("simulated");
    expect(statusForConnectorMode("sandbox-ready")).toBe("not-verified");
    expect(statusForConnectorMode("configured-unavailable")).toBe("unavailable");
    expect(statusForConnectorMode("planned")).toBe("unavailable");
  });

  it("maps audit chain results", () => {
    expect(statusForAuditChain("valid")).toBe("verified");
    expect(statusForAuditChain("broken")).toBe("not-verified");
    expect(statusForAuditChain("empty")).toBe("empty");
  });

  it("never turns an unchecked health component into Verified", () => {
    expect(statusForHealth("healthy")).toBe("verified");
    expect(statusForHealth("not-verified")).toBe("not-verified");
    expect(statusForHealth("degraded")).toBe("not-verified");
    expect(statusForHealth("not-configured")).toBe("unavailable");
    expect(statusForHealth("unavailable")).toBe("unavailable");
  });

  it("rolls up no more confidently than the least confident part", () => {
    expect(overallStatus(["verified", "verified"])).toBe("verified");
    expect(overallStatus(["verified", "not-verified"])).toBe("not-verified");
    expect(overallStatus(["verified", "empty"])).toBe("not-verified");
    expect(overallStatus(["verified", "unavailable", "not-verified"])).toBe("unavailable");
    expect(overallStatus([])).toBe("empty");
  });
});

describe("audit trail coverage", () => {
  it("is Verified only when every audit event is chained", () => {
    expect(coverageReading(20, 20).status).toBe("verified");
    expect(coverageReading(5, 20).status).toBe("not-verified");
    expect(coverageReading(5, 20).detail.en).toContain("5 of 20");
    expect(coverageReading(0, 0).status).toBe("empty");
  });
});

describe("counted readiness checks", () => {
  const present = (n: number) => ({ en: `${n} rows.`, de: `${n} Zeilen.` });
  const empty = { en: "None.", de: "Keine." };
  const missing = { en: "Missing.", de: "Fehlt." };

  it("distinguishes present, empty and unreadable", () => {
    expect(countReading(3, present, empty, missing).status).toBe("verified");
    expect(countReading(0, present, empty, missing).status).toBe("empty");
    expect(countReading(null, present, empty, missing).status).toBe("unavailable");
  });
});

describe("evaluation evidence", () => {
  const roles = new Map([
    ["EVAL-RCSA-1", "rcsa"],
    ["EVAL-RCSA-2", "rcsa"],
    ["EVAL-TPRM-1", "tprm"],
  ]);
  const run = (overrides: Partial<RecordedEvaluationRun>): RecordedEvaluationRun => ({
    runAt: "2026-10-02T11:12:22.401Z",
    mode: "structural",
    totalCases: 3,
    passed: 3,
    failed: 0,
    notRun: 0,
    cases: [
      { caseId: "EVAL-RCSA-1", status: "passed" },
      { caseId: "EVAL-RCSA-2", status: "passed" },
      { caseId: "EVAL-TPRM-1", status: "passed" },
    ],
    ...overrides,
  });

  it("is Not verified when no run is recorded", () => {
    const evidence = summariseEvaluationRun(null, roles);
    expect(evidence.recorded).toBe(false);
    expect(evidence.harness.status).toBe("not-verified");
    expect(evidence.modelOutput.status).toBe("not-verified");
  });

  it("treats a structural pass as Simulated and model output as Not verified", () => {
    const evidence = summariseEvaluationRun(run({}), roles);
    expect(evidence.harness.status).toBe("simulated");
    expect(evidence.modelOutput.status).toBe("not-verified");
    expect(evidence.byRole.rcsa).toEqual({ cases: 2, passed: 2, failed: 0, notRun: 0 });
    expect(evidence.byRole.tprm?.cases).toBe(1);
  });

  it("reports structural failures as Not verified", () => {
    const evidence = summariseEvaluationRun(
      run({ passed: 2, failed: 1, cases: [
        { caseId: "EVAL-RCSA-1", status: "failed" },
        { caseId: "EVAL-RCSA-2", status: "passed" },
        { caseId: "EVAL-TPRM-1", status: "passed" },
      ] }),
      roles,
    );
    expect(evidence.harness.status).toBe("not-verified");
    expect(evaluationReadingsForRole(evidence, "rcsa").harness.status).toBe("not-verified");
    expect(evaluationReadingsForRole(evidence, "tprm").harness.status).toBe("simulated");
  });

  it("does not verify a live run in which cases did not run", () => {
    const evidence = summariseEvaluationRun(
      run({ mode: "live", passed: 0, notRun: 3, cases: [
        { caseId: "EVAL-RCSA-1", status: "not-run" },
        { caseId: "EVAL-RCSA-2", status: "not-run" },
        { caseId: "EVAL-TPRM-1", status: "not-run" },
      ] }),
      roles,
    );
    expect(evidence.harness.status).toBe("not-verified");
    expect(evidence.modelOutput.status).toBe("not-verified");
  });

  it("verifies only a non-structural run in which every case ran and passed", () => {
    const evidence = summariseEvaluationRun(run({ mode: "release" }), roles);
    expect(evidence.harness.status).toBe("verified");
    expect(evidence.modelOutput.status).toBe("verified");
    expect(evaluationReadingsForRole(evidence, "rcsa").modelOutput.status).toBe("verified");
  });

  it("says so when the run holds no case for a role", () => {
    const evidence = summariseEvaluationRun(run({}), roles);
    expect(evaluationReadingsForRole(evidence, "control-assurance").harness.status).toBe(
      "not-verified",
    );
  });

  it("reads the files the runner writes, and treats a missing run as none", () => {
    const dir = mkdtempSync(join(tmpdir(), "nfros-eval-"));
    expect(readEvaluationEvidence(dir).recorded).toBe(false);

    mkdirSync(join(dir, "evals", "results"), { recursive: true });
    mkdirSync(join(dir, "evals", "cases"), { recursive: true });
    writeFileSync(
      join(dir, "evals", "cases", "sample.json"),
      JSON.stringify([{ id: "EVAL-RCSA-1", role: "rcsa" }]),
    );
    writeFileSync(
      join(dir, "evals", "results", "latest.json"),
      JSON.stringify(run({ totalCases: 1, passed: 1, cases: [{ caseId: "EVAL-RCSA-1", status: "passed" }] })),
    );
    const evidence = readEvaluationEvidence(dir);
    expect(evidence.recorded).toBe(true);
    expect(evidence.harness.status).toBe("simulated");
    expect(evidence.byRole.rcsa?.passed).toBe(1);

    writeFileSync(join(dir, "evals", "results", "latest.json"), "{ not json");
    expect(readEvaluationEvidence(dir).recorded).toBe(false);
  });
});

describe("the pilot evidence pack", () => {
  it("is Empty until one is generated, and never Verified", () => {
    const dir = mkdtempSync(join(tmpdir(), "nfros-pack-"));
    expect(readPilotEvidencePack(dir).status).toBe("empty");
    mkdirSync(join(dir, "release"));
    writeFileSync(join(dir, "release", "pilot-evidence.json"), JSON.stringify({ runDate: "2026-10-05" }));
    const pack = readPilotEvidencePack(dir);
    expect(pack.status).toBe("not-verified");
    expect(pack.generatedAt).toBe("2026-10-05");
  });
});

describe("the status badge", () => {
  it("is a V3.3 chip carrying the vocabulary tone, label and reason", () => {
    const html = renderToStaticMarkup(
      createElement(StatusBadge, { status: "not-verified", language: "en", detail: "No call made." }),
    );
    expect(html).toContain('class="wd-chip"');
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain('data-status="not-verified"');
    expect(html).toContain("Not verified");
    expect(html).toContain("No call made.");
  });

  it("renders German and leaves neutral statuses untoned", () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: "empty", language: "de" }));
    expect(html).toContain("Leer");
    expect(html).not.toContain("data-tone");
  });
});

describe("status-bearing screens use the shared vocabulary", () => {
  const screens = [
    "app/ops/page.tsx",
    "app/settings/ai-quality/page.tsx",
    "app/settings/audit-integrity/page.tsx",
    "app/settings/pilot/page.tsx",
    "app/settings/integrations/page.tsx",
    "app/settings/role-apps/page.tsx",
  ];

  for (const screen of screens) {
    it(`${screen} renders statuses through the shared badge`, () => {
      const source = readFileSync(join(ROOT, screen), "utf-8");
      expect(source).toMatch(/StatusBadge|StatusRow/);
      // No local status helpers or ad hoc status words left behind.
      expect(source).not.toMatch(/function (StatusBadge|statusColor|statusLabel|CheckMark)\b/);
      expect(source).not.toMatch(/>\s*(Pass|Warn|Valid|Broken|HEALTHY)\s*</);
      expect(source).not.toMatch(/Not yet evaluated|non-functional in this build|Arcadia Savings Bank/);
      expect(source).not.toContain("/api/pilot/evidence");
    });
  }
});
