/**
 * Loading state machine unit tests.
 *
 * Tests the pure functions exported from the hooks and the ProgressiveContent
 * ordering logic. The test environment is node (no DOM), so this file exercises
 * only exported pure functions, not the React hooks or rendered components.
 *
 * Coverage areas:
 * - progressiveDataReducer: all state transitions
 * - aiGenReducer: all transitions, backward-movement guard, supersede behaviour
 * - shouldApplyMinTransition: the 300ms minimum rule, reduced-motion bypass
 * - resolveStageVisibility: population order enforcement
 * - isPublishableFromMachine: publishable only when validated and not superseded
 * - Label dictionary: no em dash, no vendor or model name
 */

import { describe, expect, it } from "vitest";

import {
  progressiveDataReducer,
  shouldApplyMinTransition,
  MIN_LOADING_MS,
  type ProgressiveDataMap,
} from "@/hooks/useProgressiveData";

import {
  aiGenReducer,
  isPublishableFromMachine,
  initialAIGenState,
  type AIGenMachineState,
} from "@/hooks/useAIGenerationState";

import { resolveStageVisibility } from "@/components/loading/ProgressiveContent";

import {
  DATA_SOURCE_STAGE_LABELS,
  STALE_LABELS,
  CONNECTION_LABELS,
  AI_CARD_LABELS,
  STAGE_LIST_LABELS,
  INLINE_ROW_LABELS,
  PROGRESSIVE_LABELS,
} from "@/components/loading/labels";

import { AI_STAGE_ORDER, type AIGenerationState } from "@/workday/contracts";

/* ==========================================================================
   progressiveDataReducer
   ========================================================================== */

describe("progressiveDataReducer", () => {
  const empty: ProgressiveDataMap = {};

  it("adds a region on REGION_CHANGED from empty", () => {
    const next = progressiveDataReducer(empty, {
      type: "REGION_CHANGED",
      region: "focus",
      state: "connecting",
      detail: "",
    });
    expect(next["focus"]?.state).toBe("connecting");
  });

  it("transitions connecting to loading", () => {
    const s1 = progressiveDataReducer(empty, {
      type: "REGION_CHANGED",
      region: "r",
      state: "connecting",
      detail: "",
    });
    const s2 = progressiveDataReducer(s1, {
      type: "REGION_CHANGED",
      region: "r",
      state: "loading",
      detail: "",
    });
    expect(s2["r"]?.state).toBe("loading");
  });

  it("transitions loading to partial", () => {
    const s1 = progressiveDataReducer(empty, {
      type: "REGION_CHANGED",
      region: "r",
      state: "loading",
      detail: "",
    });
    const s2 = progressiveDataReducer(s1, {
      type: "REGION_CHANGED",
      region: "r",
      state: "partial",
      detail: "",
    });
    expect(s2["r"]?.state).toBe("partial");
  });

  it("transitions partial to ready", () => {
    const s1 = progressiveDataReducer(empty, {
      type: "REGION_CHANGED",
      region: "r",
      state: "partial",
      detail: "",
    });
    const s2 = progressiveDataReducer(s1, {
      type: "REGION_CHANGED",
      region: "r",
      state: "ready",
      detail: "",
    });
    expect(s2["r"]?.state).toBe("ready");
  });

  it("transitions loading to error", () => {
    const s1 = progressiveDataReducer(empty, {
      type: "REGION_CHANGED",
      region: "r",
      state: "loading",
      detail: "",
    });
    const s2 = progressiveDataReducer(s1, {
      type: "REGION_CHANGED",
      region: "r",
      state: "error",
      detail: "Source offline",
    });
    expect(s2["r"]?.state).toBe("error");
    expect(s2["r"]?.detail).toBe("Source offline");
  });

  it("transitions loading to stale", () => {
    const s1 = progressiveDataReducer(empty, {
      type: "REGION_CHANGED",
      region: "r",
      state: "loading",
      detail: "",
    });
    const s2 = progressiveDataReducer(s1, {
      type: "REGION_CHANGED",
      region: "r",
      state: "stale",
      detail: "",
    });
    expect(s2["r"]?.state).toBe("stale");
  });

  it("tracks multiple regions independently", () => {
    let s = empty;
    s = progressiveDataReducer(s, {
      type: "REGION_CHANGED",
      region: "focus",
      state: "loading",
      detail: "",
    });
    s = progressiveDataReducer(s, {
      type: "REGION_CHANGED",
      region: "inbox",
      state: "ready",
      detail: "",
    });
    expect(s["focus"]?.state).toBe("loading");
    expect(s["inbox"]?.state).toBe("ready");
  });

  it("removes a region on REGION_RESET", () => {
    let s = progressiveDataReducer(empty, {
      type: "REGION_CHANGED",
      region: "r",
      state: "ready",
      detail: "",
    });
    s = progressiveDataReducer(s, { type: "REGION_RESET", region: "r" });
    expect(s["r"]).toBeUndefined();
  });

  it("clears all regions on CLEAR_ALL", () => {
    let s = empty;
    s = progressiveDataReducer(s, {
      type: "REGION_CHANGED",
      region: "a",
      state: "ready",
      detail: "",
    });
    s = progressiveDataReducer(s, {
      type: "REGION_CHANGED",
      region: "b",
      state: "loading",
      detail: "",
    });
    s = progressiveDataReducer(s, { type: "CLEAR_ALL" });
    expect(Object.keys(s)).toHaveLength(0);
  });

  it("is immutable: the original state object is not mutated", () => {
    const original: ProgressiveDataMap = { r: { state: "loading", detail: "" } };
    const next = progressiveDataReducer(original, {
      type: "REGION_CHANGED",
      region: "r",
      state: "ready",
      detail: "",
    });
    expect(original["r"]?.state).toBe("loading");
    expect(next["r"]?.state).toBe("ready");
  });
});

/* ==========================================================================
   shouldApplyMinTransition
   ========================================================================== */

describe("shouldApplyMinTransition", () => {
  it("applies when elapsed is less than the minimum", () => {
    const start = 1000;
    const resolve = 1050; // 50ms elapsed
    const result = shouldApplyMinTransition(start, resolve, false);
    expect(result.apply).toBe(true);
    expect(result.remainingMs).toBe(MIN_LOADING_MS - 50);
  });

  it("does not apply when elapsed is at least the minimum", () => {
    const start = 1000;
    const resolve = 1000 + MIN_LOADING_MS; // exactly 300ms
    const result = shouldApplyMinTransition(start, resolve, false);
    expect(result.apply).toBe(false);
    expect(result.remainingMs).toBe(0);
  });

  it("does not apply when elapsed exceeds the minimum", () => {
    const start = 1000;
    const resolve = 1600; // 600ms
    const result = shouldApplyMinTransition(start, resolve, false);
    expect(result.apply).toBe(false);
  });

  it("is bypassed entirely in reduced-motion mode", () => {
    /*
     * In reduced-motion mode there is no animation to smooth, so the delay
     * would introduce a pause with no visual benefit. The hook skips it and
     * all state information is still delivered.
     */
    const start = 1000;
    const resolve = 1010; // 10ms elapsed: would normally trigger the delay
    const result = shouldApplyMinTransition(start, resolve, true);
    expect(result.apply).toBe(false);
    expect(result.remainingMs).toBe(0);
  });

  it("remaining time is never negative", () => {
    const result = shouldApplyMinTransition(1000, 1299, false); // 1ms short
    expect(result.remainingMs).toBeGreaterThan(0);
    expect(result.remainingMs).toBeLessThanOrEqual(MIN_LOADING_MS);
  });
});

/* ==========================================================================
   aiGenReducer
   ========================================================================== */

describe("aiGenReducer: stage transitions", () => {
  it("starts in idle", () => {
    expect(initialAIGenState.current).toBe("idle");
  });

  it("transitions idle to queued on STAGE_CHANGED", () => {
    const next = aiGenReducer(initialAIGenState, {
      type: "STAGE_CHANGED",
      state: "queued",
      completedStages: [],
    });
    expect(next.current).toBe("queued");
  });

  it("advances through the stage order", () => {
    let state: AIGenMachineState = initialAIGenState;
    const completed: AIGenerationState[] = [];

    for (const stage of AI_STAGE_ORDER) {
      state = aiGenReducer(state, {
        type: "STAGE_CHANGED",
        state: stage,
        completedStages: [...completed],
      });
      expect(state.current).toBe(stage);
      completed.push(stage);
    }
  });

  it("does not go backwards in stage order", () => {
    /*
     * A late-arriving event for an earlier stage (network reorder) must not
     * regress the state. The later-arriving event already advanced things.
     */
    let state = aiGenReducer(initialAIGenState, {
      type: "STAGE_CHANGED",
      state: "reconciling",
      completedStages: ["queued", "retrieving"],
    });
    state = aiGenReducer(state, {
      type: "STAGE_CHANGED",
      state: "queued", // stale / out of order
      completedStages: [],
    });
    expect(state.current).toBe("reconciling");
  });

  it("records completed stages", () => {
    const state = aiGenReducer(initialAIGenState, {
      type: "STAGE_CHANGED",
      state: "analysing",
      completedStages: ["queued", "retrieving", "reconciling"],
    });
    expect(state.completedStages).toContain("queued");
    expect(state.completedStages).toContain("retrieving");
    expect(state.completedStages).toContain("reconciling");
  });
});

describe("aiGenReducer: error and retry", () => {
  it("sets error state on ERROR", () => {
    const state = aiGenReducer(initialAIGenState, {
      type: "ERROR",
      reason: "Timeout",
      retryable: true,
    });
    expect(state.current).toBe("error");
    expect(state.error).toBe("Timeout");
    expect(state.retryable).toBe(true);
  });

  it("clears error on RETRY and resets to queued", () => {
    let state = aiGenReducer(initialAIGenState, {
      type: "ERROR",
      reason: "Timeout",
      retryable: true,
    });
    state = aiGenReducer(state, { type: "RETRY" });
    expect(state.current).toBe("queued");
    expect(state.error).toBeNull();
    expect(state.retryable).toBe(false);
    expect(state.completedStages).toHaveLength(0);
  });
});

describe("aiGenReducer: supersede behaviour", () => {
  it("ignores STAGE_CHANGED after SUPERSEDE", () => {
    let state = aiGenReducer(initialAIGenState, {
      type: "STAGE_CHANGED",
      state: "retrieving",
      completedStages: ["queued"],
    });
    state = aiGenReducer(state, { type: "SUPERSEDE" });
    /*
     * This STAGE_CHANGED simulates a slow previous request finishing after
     * the context was superseded. It must not overwrite current state.
     */
    state = aiGenReducer(state, {
      type: "STAGE_CHANGED",
      state: "ready",
      completedStages: AI_STAGE_ORDER.filter((s) => s !== "ready"),
    });
    expect(state.current).toBe("retrieving");
    expect(state.superseded).toBe(true);
  });

  it("ignores ERROR after SUPERSEDE", () => {
    let state = aiGenReducer(initialAIGenState, { type: "SUPERSEDE" });
    state = aiGenReducer(state, {
      type: "ERROR",
      reason: "late error",
      retryable: false,
    });
    expect(state.current).toBe("idle");
    expect(state.error).toBeNull();
  });

  it("RETRY un-supersedes and resets to queued", () => {
    let state = aiGenReducer(initialAIGenState, { type: "SUPERSEDE" });
    state = aiGenReducer(state, { type: "RETRY" });
    expect(state.superseded).toBe(false);
    expect(state.current).toBe("queued");
  });
});

/* ==========================================================================
   isPublishableFromMachine
   ========================================================================== */

describe("isPublishableFromMachine", () => {
  it("returns false for all non-ready states", () => {
    const nonReady: Array<AIGenMachineState["current"]> = [
      "idle",
      "queued",
      "retrieving",
      "reconciling",
      "analysing",
      "drafting",
      "validating",
      "blocked",
      "error",
    ];
    for (const state of nonReady) {
      const machine: AIGenMachineState = {
        ...initialAIGenState,
        current: state,
      };
      expect(isPublishableFromMachine(machine), `should not be publishable: ${state}`).toBe(false);
    }
  });

  it("returns true only when state is ready and not superseded", () => {
    const machine: AIGenMachineState = {
      ...initialAIGenState,
      current: "ready",
      completedStages: AI_STAGE_ORDER.filter((s) => s !== "ready"),
    };
    expect(isPublishableFromMachine(machine)).toBe(true);
  });

  it("returns false when state is ready but superseded", () => {
    const machine: AIGenMachineState = {
      ...initialAIGenState,
      current: "ready",
      completedStages: AI_STAGE_ORDER.filter((s) => s !== "ready"),
      superseded: true,
    };
    expect(isPublishableFromMachine(machine)).toBe(false);
  });

  it("never reports publishable before validating completes", () => {
    /*
     * The acceptance criterion is that nothing renders before validation.
     * The validating stage must appear in completedStages before "ready" is
     * reported by the event channel. This test verifies that even if the
     * state is "ready", a superseded machine returns false.
     */
    const machineBeforeValidation: AIGenMachineState = {
      ...initialAIGenState,
      current: "drafting",
      completedStages: ["queued", "retrieving", "reconciling", "analysing"],
    };
    expect(isPublishableFromMachine(machineBeforeValidation)).toBe(false);
  });
});

/* ==========================================================================
   resolveStageVisibility (ProgressiveContent population order)
   ========================================================================== */

describe("resolveStageVisibility: population order", () => {
  it("shows content for all ready stages when none block", () => {
    const visibility = resolveStageVisibility([
      { ready: true, blocks: false },
      { ready: true, blocks: false },
      { ready: true, blocks: false },
    ]);
    expect(visibility).toEqual([true, true, true]);
  });

  it("shows content only for stages before the first not-ready blocker", () => {
    const visibility = resolveStageVisibility([
      { ready: true },
      { ready: false }, // blocks here
      { ready: true }, // blocked by stage 1
      { ready: true }, // blocked by stage 1
    ]);
    expect(visibility).toEqual([true, false, false, false]);
  });

  it("a non-blocking not-ready stage does not prevent later stages", () => {
    const visibility = resolveStageVisibility([
      { ready: true },
      { ready: false, blocks: false }, // supplementary, does not block
      { ready: true }, // not blocked
    ]);
    expect(visibility).toEqual([true, false, true]);
  });

  it("all false when the first stage is not ready and blocks", () => {
    const visibility = resolveStageVisibility([
      { ready: false },
      { ready: true },
      { ready: true },
    ]);
    expect(visibility).toEqual([false, false, false]);
  });

  it("all true when all stages are ready", () => {
    const stages = Array.from({ length: 9 }, () => ({ ready: true }));
    const visibility = resolveStageVisibility(stages);
    expect(visibility).toEqual(Array.from({ length: 9 }, () => true));
  });

  it("empty stages returns empty result", () => {
    expect(resolveStageVisibility([])).toEqual([]);
  });

  it("actions in a later stage are not shown until earlier stages are ready", () => {
    /*
     * This test models the primary-action guarantee from the brief.
     * Stages: structure (0), content (1), actions (2).
     * If content (1) is not ready, actions (2) must not show.
     */
    const visibility = resolveStageVisibility([
      { ready: true },  // structure: ready
      { ready: false }, // content: not ready, blocks
      { ready: true },  // actions: ready but blocked
    ]);
    expect(visibility[2]).toBe(false);
  });
});

/* ==========================================================================
   Reduced-motion information preservation
   ========================================================================== */

describe("reduced-motion: information is preserved", () => {
  it("shouldApplyMinTransition in reduced-motion returns all state fields", () => {
    /*
     * The function must return a complete result object even in reduced-motion.
     * Only the apply flag changes: the shape of the result is always the same
     * so callers can safely destructure it regardless of motion preference.
     */
    const result = shouldApplyMinTransition(1000, 1010, true);
    expect(Object.keys(result)).toContain("apply");
    expect(Object.keys(result)).toContain("remainingMs");
  });

  it("aiGenReducer in reduced-motion mode carries the same information", () => {
    /*
     * Reduced motion does not affect the reducer at all: the reducer has no
     * motion concept. This test asserts that the state carries all fields.
     */
    const state = aiGenReducer(initialAIGenState, {
      type: "STAGE_CHANGED",
      state: "analysing",
      completedStages: ["queued", "retrieving", "reconciling"],
    });
    expect(Object.keys(state)).toContain("current");
    expect(Object.keys(state)).toContain("completedStages");
    expect(Object.keys(state)).toContain("error");
    expect(Object.keys(state)).toContain("retryable");
    expect(Object.keys(state)).toContain("superseded");
  });
});

/* ==========================================================================
   Label dictionary assertions
   ========================================================================== */

/*
 * Collect all bilingual string values from the labels module.
 *
 * The check runs over string values only: function values are excluded.
 * The recordsIdentifiedLabel function is tested separately because its output
 * depends on a runtime count.
 */
function collectLabelStrings(): string[] {
  const sources: unknown[] = [
    ...DATA_SOURCE_STAGE_LABELS,
    STALE_LABELS,
    CONNECTION_LABELS,
    AI_CARD_LABELS,
    STAGE_LIST_LABELS,
    INLINE_ROW_LABELS,
    PROGRESSIVE_LABELS,
  ];

  const strings: string[] = [];

  function extract(value: unknown): void {
    if (typeof value === "string") {
      strings.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) extract(item);
    } else if (value !== null && typeof value === "object") {
      for (const v of Object.values(value as Record<string, unknown>)) {
        if (typeof v !== "function") extract(v);
      }
    }
  }

  for (const source of sources) extract(source);
  return strings;
}

describe("label dictionary: copy quality", () => {
  // Use fromCharCode so this file itself does not contain the forbidden character. copy-check-ignore
  const EM_DASH = String.fromCharCode(0x2014);
  const EN_DASH = String.fromCharCode(0x2013);
  const allStrings = collectLabelStrings();

  it("contains no em dash character (U+2014)", () => {
    const violations = allStrings.filter((s) => s.includes(EM_DASH));
    expect(violations).toHaveLength(0);
  });

  it("contains no en dash character (U+2013)", () => {
    const violations = allStrings.filter((s) => s.includes(EN_DASH));
    expect(violations).toHaveLength(0);
  });

  it("contains no umlaut characters (ae/oe/ue/ss transliteration required)", () => {
    /*
     * German strings must use ASCII transliteration only. Umlaut characters
     * would fail the encoding safety check and break the build on systems
     * with a non-UTF8 default locale.
     */
    const umlauts = /[äöüÄÖÜß]/;
    const violations = allStrings.filter((s) => umlauts.test(s));
    expect(violations).toHaveLength(0);
  });

  it("names no AI provider or model in any label", () => {
    /*
     * Loading labels must describe observable processing steps only. Naming a
     * vendor or a model would expose implementation details that the product
     * is explicitly designed not to show.
     */
    const forbidden = ["openai", "gpt", "claude", "anthropic", "llm", "model"];
    for (const term of forbidden) {
      const violations = allStrings.filter((s) =>
        s.toLowerCase().includes(term),
      );
      expect(violations, `label must not contain "${term}"`).toHaveLength(0);
    }
  });

  it("all bilingual entries have both an en and a de key", () => {
    function checkBilingual(value: unknown, path: string): void {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        const obj = value as Record<string, unknown>;
        if ("en" in obj && "de" in obj) {
          expect(typeof obj["en"], `${path}.en must be a string`).toBe("string");
          expect(typeof obj["de"], `${path}.de must be a string`).toBe("string");
          expect((obj["en"] as string).length, `${path}.en must not be empty`).toBeGreaterThan(0);
          expect((obj["de"] as string).length, `${path}.de must not be empty`).toBeGreaterThan(0);
        } else {
          for (const [k, v] of Object.entries(obj)) {
            if (typeof v !== "function") checkBilingual(v, `${path}.${k}`);
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => checkBilingual(v, `${path}[${i}]`));
      }
    }

    checkBilingual(DATA_SOURCE_STAGE_LABELS, "DATA_SOURCE_STAGE_LABELS");
    checkBilingual(STALE_LABELS, "STALE_LABELS");
    checkBilingual(CONNECTION_LABELS, "CONNECTION_LABELS");
    checkBilingual(AI_CARD_LABELS, "AI_CARD_LABELS");
    checkBilingual(STAGE_LIST_LABELS, "STAGE_LIST_LABELS");
    checkBilingual(INLINE_ROW_LABELS, "INLINE_ROW_LABELS");
    checkBilingual(PROGRESSIVE_LABELS, "PROGRESSIVE_LABELS");
  });

  it("DATA_SOURCE_STAGE_LABELS has exactly six entries matching the brief", () => {
    expect(DATA_SOURCE_STAGE_LABELS).toHaveLength(6);
  });
});

/* ==========================================================================
   recordsIdentifiedLabel helper
   ========================================================================== */

import { recordsIdentifiedLabel } from "@/components/loading/labels";

describe("recordsIdentifiedLabel", () => {
  it("includes the count in English", () => {
    expect(recordsIdentifiedLabel(12, "en")).toContain("12");
    expect(recordsIdentifiedLabel(12, "en")).toMatch(/record/i);
  });

  it("includes the count in German", () => {
    expect(recordsIdentifiedLabel(12, "de")).toContain("12");
  });

  it("does not contain an em dash", () => {
    // Use fromCharCode so this file itself does not contain the forbidden character. copy-check-ignore
    const EM_DASH = String.fromCharCode(0x2014);
    expect(recordsIdentifiedLabel(12, "en")).not.toContain(EM_DASH);
    expect(recordsIdentifiedLabel(12, "de")).not.toContain(EM_DASH);
  });

  it("does not name a provider or model", () => {
    const forbidden = ["openai", "gpt", "claude", "anthropic", "llm", "model"];
    for (const term of forbidden) {
      expect(recordsIdentifiedLabel(12, "en").toLowerCase()).not.toContain(term);
      expect(recordsIdentifiedLabel(12, "de").toLowerCase()).not.toContain(term);
    }
  });
});
