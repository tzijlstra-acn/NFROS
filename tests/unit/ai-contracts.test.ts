/**
 * AI quality contract unit suite.
 *
 * Covers the envelope validator, the source completeness derivation and the
 * prompt registry lookup.
 *
 * The two hand written offline envelopes that used to live in
 * `src/ai/offline-responses.ts` are gone: no screen or engine path read them,
 * and their text ("BCA-CTRL-142", "4 of 7") contradicted the seeded day.
 * Offline output is now composed from the records by the process engine,
 * the meeting and inbox AI layers and the routines, and validated there.
 *
 * No rendering. The contract types and functions are pure, and they are
 * tested directly rather than through a DOM harness.
 */

import { describe, it, expect } from "vitest";
import {
  validateEnvelope,
  type AssistantResponseEnvelope,
} from "@/ai/contracts";
import {
  computeSourceCompleteness,
  getDisplayStatus,
} from "@/ai/source-status";
import {
  getReleasedConfig,
  AI_CONFIGURATION_REGISTRY,
} from "@/ai/prompt-registry";

/* ==========================================================================
   validateEnvelope
   ========================================================================== */

describe("validateEnvelope", () => {
  const validEnvelope: AssistantResponseEnvelope = {
    responseId: "RESP-TEST-001",
    mode: "offline",
    context: {
      roleId: "rcsa",
      subjectKind: null,
      subjectId: null,
      processRunId: null,
      stageRunId: null,
    },
    parts: [],
    sourceIds: [],
    requiredSourceStatus: [],
    isLimited: false,
    generatedAt: "2026-10-02T00:00:00Z",
  };

  it("returns empty errors for a valid envelope", () => {
    const errors = validateEnvelope(validEnvelope);
    expect(errors).toEqual([]);
  });

  it("returns an error when responseId is missing", () => {
    const bad = { ...validEnvelope, responseId: undefined };
    const errors = validateEnvelope(bad);
    expect(errors.some((e) => e.includes("responseId"))).toBe(true);
  });

  it("returns an error for an invalid mode", () => {
    const bad = { ...validEnvelope, mode: "experimental" };
    const errors = validateEnvelope(bad);
    expect(errors.some((e) => e.includes("mode"))).toBe(true);
  });

  it("returns an error when parts is not an array", () => {
    const bad = { ...validEnvelope, parts: "not-an-array" };
    const errors = validateEnvelope(bad);
    expect(errors.some((e) => e.includes("parts"))).toBe(true);
  });

  it("returns an error when the input is not an object", () => {
    const errors = validateEnvelope(null);
    expect(errors.length).toBeGreaterThan(0);

    const errorsStr = validateEnvelope("a string");
    expect(errorsStr.length).toBeGreaterThan(0);
  });

  it("accepts all three valid modes", () => {
    for (const mode of ["live", "safe", "offline"] as const) {
      const errors = validateEnvelope({ ...validEnvelope, mode });
      expect(errors).toEqual([]);
    }
  });
});

/* ==========================================================================
   computeSourceCompleteness
   ========================================================================== */

describe("computeSourceCompleteness", () => {
  it("returns evidence-complete when all sources are loaded", () => {
    const result = computeSourceCompleteness([
      { sourceKind: "incident-log", sourceId: "EVD-001", status: "loaded" },
      { sourceKind: "kri-data", sourceId: "KRI-001", status: "loaded" },
    ]);
    expect(result).toBe("evidence-complete");
  });

  it("returns evidence-incomplete when any source is unavailable", () => {
    const result = computeSourceCompleteness([
      { sourceKind: "incident-log", sourceId: "EVD-001", status: "loaded" },
      { sourceKind: "kri-data", sourceId: "KRI-001", status: "unavailable" },
    ]);
    expect(result).toBe("evidence-incomplete");
  });

  it("returns source-stale when a source is stale and none are unavailable", () => {
    const result = computeSourceCompleteness([
      { sourceKind: "incident-log", sourceId: "EVD-001", status: "loaded" },
      { sourceKind: "kri-data", sourceId: "KRI-001", status: "stale" },
    ]);
    expect(result).toBe("source-stale");
  });

  it("prioritises unavailable over stale", () => {
    const result = computeSourceCompleteness([
      { sourceKind: "incident-log", sourceId: "EVD-001", status: "stale" },
      { sourceKind: "kri-data", sourceId: "KRI-001", status: "unavailable" },
    ]);
    expect(result).toBe("evidence-incomplete");
  });

  it("returns evidence-complete for an empty required source list", () => {
    expect(computeSourceCompleteness([])).toBe("evidence-complete");
  });
});

/* ==========================================================================
   getDisplayStatus
   ========================================================================== */

describe("getDisplayStatus", () => {
  it("returns a non-empty label for every status", () => {
    const statuses = [
      "evidence-complete",
      "evidence-incomplete",
      "sources-conflict",
      "source-stale",
      "judgment-required",
    ] as const;
    for (const status of statuses) {
      const label = getDisplayStatus(status);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("does not include percentage or numeric values in any label", () => {
    const statuses = [
      "evidence-complete",
      "evidence-incomplete",
      "sources-conflict",
      "source-stale",
      "judgment-required",
    ] as const;
    for (const status of statuses) {
      const label = getDisplayStatus(status);
      expect(/\d/.test(label)).toBe(false);
      expect(label.includes("%")).toBe(false);
    }
  });
});

/* ==========================================================================
   getReleasedConfig
   ========================================================================== */

describe("getReleasedConfig", () => {
  it("finds the released config for rcsa stage-preparation", () => {
    const config = getReleasedConfig("rcsa", "stage-preparation");
    expect(config).toBeDefined();
    expect(config?.status).toBe("released");
    expect(config?.roleId).toBe("rcsa");
    expect(config?.taskKind).toBe("stage-preparation");
  });

  it("finds the released config for tprm stage-preparation", () => {
    const config = getReleasedConfig("tprm", "stage-preparation");
    expect(config).toBeDefined();
    expect(config?.status).toBe("released");
    expect(config?.roleId).toBe("tprm");
  });

  it("returns undefined for an unknown roleId", () => {
    expect(getReleasedConfig("unknown-role", "stage-preparation")).toBeUndefined();
  });

  it("returns undefined for an unknown taskKind", () => {
    expect(getReleasedConfig("rcsa", "unknown-task")).toBeUndefined();
  });

  it("every released entry in the registry has a valid modelProfileId", () => {
    const released = AI_CONFIGURATION_REGISTRY.filter((c) => c.status === "released");
    expect(released.length).toBeGreaterThan(0);
    for (const config of released) {
      expect(typeof config.modelProfileId).toBe("string");
      expect(config.modelProfileId.length).toBeGreaterThan(0);
    }
  });
});

/* ==========================================================================
   A limited envelope
   ========================================================================== */

describe("a limited envelope", () => {
  const limited: AssistantResponseEnvelope = {
    responseId: "RESP-TEST-LIMITED",
    mode: "offline",
    context: { roleId: "rcsa", subjectKind: "assessment", subjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4", processRunId: null, stageRunId: null },
    parts: [
      { type: "answer", text: "Part of the evidence is available.", lang: "en" },
      { type: "uncertainty", description: "A required source has not arrived.", requiredForCompletion: true },
      { type: "recommendation", text: "Proceed with what is available and chase the rest.", basis: [], isLimited: true },
    ],
    sourceIds: [],
    requiredSourceStatus: [{ sourceKind: "kri-data", sourceId: null, status: "unavailable" }],
    isLimited: true,
    generatedAt: "2026-10-06T07:45:00Z",
  };

  it("validates, and its completeness follows the unavailable source", () => {
    expect(validateEnvelope(limited)).toEqual([]);
    expect(computeSourceCompleteness(limited.requiredSourceStatus)).toBe("evidence-incomplete");
  });

  it("no obsolete offline envelope text remains in the AI layer", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../../src/ai");
    const text = fs.readdirSync(dir).map((file) => fs.readFileSync(path.join(dir, file), "utf8")).join(" ");
    expect(text).not.toContain("BCA-CTRL-142");
    expect(text).not.toContain("4 of 7");
  });
});
