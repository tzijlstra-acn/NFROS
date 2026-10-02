/**
 * AI quality contract unit suite.
 *
 * Covers the envelope validator, the source completeness derivation, the
 * prompt registry lookup, and the two seeded offline responses.
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
import {
  RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE,
  TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE,
} from "@/ai/offline-responses";

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
   Seeded offline responses
   ========================================================================== */

describe("RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE", () => {
  it("validates cleanly", () => {
    const errors = validateEnvelope(RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE);
    expect(errors).toEqual([]);
  });

  it("is in offline mode", () => {
    expect(RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE.mode).toBe("offline");
  });

  it("is marked as limited due to missing sources", () => {
    expect(RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE.isLimited).toBe(true);
  });

  it("contains an answer, a fact, an inference, an uncertainty and a recommendation", () => {
    const types = RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE.parts.map((p) => p.type);
    expect(types).toContain("answer");
    expect(types).toContain("fact");
    expect(types).toContain("inference");
    expect(types).toContain("uncertainty");
    expect(types).toContain("recommendation");
  });

  it("has at least one unavailable required source", () => {
    const unavailable = RCSA_EVIDENCE_REFRESH_OFFLINE_RESPONSE.requiredSourceStatus.filter(
      (s) => s.status === "unavailable"
    );
    expect(unavailable.length).toBeGreaterThan(0);
  });
});

describe("TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE", () => {
  it("validates cleanly", () => {
    const errors = validateEnvelope(TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE);
    expect(errors).toEqual([]);
  });

  it("is in offline mode", () => {
    expect(TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE.mode).toBe("offline");
  });

  it("is marked as limited due to missing sources", () => {
    expect(TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE.isLimited).toBe(true);
  });

  it("contains an answer part with tprm context", () => {
    const answer = TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE.parts.find(
      (p) => p.type === "answer"
    );
    expect(answer).toBeDefined();
  });

  it("has at least one unavailable required source", () => {
    const unavailable = TPRM_EVIDENCE_REVIEW_OFFLINE_RESPONSE.requiredSourceStatus.filter(
      (s) => s.status === "unavailable"
    );
    expect(unavailable.length).toBeGreaterThan(0);
  });
});
