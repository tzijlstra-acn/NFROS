/**
 * AI Partner unit suite.
 *
 * Covers the rules that would be expensive to notice visually and costly to
 * get wrong: the state derivation, the gate that stops an unvalidated
 * suggestion reaching the screen, which actions a card offers, the cap on
 * suggested prompts, and the two copy constraints that the brief treats as
 * non-negotiable.
 *
 * Deliberately free of rendering. The partner components are client
 * components and the rules they apply are pure, so the rules live in
 * `labels.ts` and are tested directly. A DOM harness here would test React
 * rather than the product rules.
 */

import { describe, it, expect } from "vitest";
import { AI_GENERATION_STATES, SUGGESTION_STATUSES, type SuggestionStatus } from "@/db/schema/live";
import { AUTHORITY_CLASSES, type AuthorityClass } from "@/db/schema/decisions";
import {
  AI_PARTNER_STATES,
  AI_STAGE_LABELS,
  AI_STAGE_ORDER,
  isPublishableState,
  partnerStateFromGeneration,
  type AIGenerationState,
  type AIPartnerState,
} from "@/workday/contracts";
import {
  AI_CONNECTION_PHASES,
  AI_CONNECTION_PHASE_LABELS,
  AI_PART_KINDS,
  AI_PART_LABELS,
  CONSTRAINED_CONFIDENCE_CEILING,
  MAX_PROMPT_CHIPS,
  PARTNER_LABELS,
  PARTNER_STATE_DETAIL,
  PROMPT_IDS,
  PROMPT_LABELS,
  canRevealSuggestion,
  confidenceBand,
  connectionPhaseFromPart,
  groupByMoment,
  selectPromptIds,
  selectSuggestionActions,
  type LabelPair,
} from "@/components/ai-partner/labels";

/* ==========================================================================
   Partner state derivation
   ========================================================================== */

describe("partner state derivation", () => {
  const expected: Record<AIGenerationState, AIPartnerState> = {
    idle: "monitoring",
    queued: "checking-evidence",
    retrieving: "checking-evidence",
    reconciling: "preparing",
    analysing: "preparing",
    drafting: "preparing",
    validating: "preparing",
    ready: "ready",
    blocked: "needs-you",
    // A failed run returns to the honest resting state rather than inventing one.
    error: "monitoring",
  };

  it("maps every generation state to a partner state", () => {
    for (const state of AI_GENERATION_STATES) {
      expect(partnerStateFromGeneration(state)).toBe(expected[state]);
    }
    // Guards against a state being added to the schema with no mapping here.
    expect(Object.keys(expected).sort()).toEqual([...AI_GENERATION_STATES].sort());
  });

  it("escalates ready to needs-you when a decision is required", () => {
    expect(partnerStateFromGeneration("ready", { decisionRequired: true })).toBe("needs-you");
    expect(partnerStateFromGeneration("ready", { decisionRequired: false })).toBe("ready");
  });

  it("lets offline and executing win over the pipeline state", () => {
    for (const state of AI_GENERATION_STATES) {
      expect(partnerStateFromGeneration(state, { offline: true })).toBe("offline");
      expect(partnerStateFromGeneration(state, { executing: true })).toBe("executing");
      // Offline outranks executing: with no connection nothing is being carried out.
      expect(partnerStateFromGeneration(state, { offline: true, executing: true })).toBe("offline");
    }
  });

  it("only produces states the header knows how to render", () => {
    for (const state of AI_GENERATION_STATES) {
      const derived = partnerStateFromGeneration(state);
      expect(AI_PARTNER_STATES).toContain(derived);
      expect(PARTNER_STATE_DETAIL[derived]).toBeDefined();
    }
  });

  it("has a detail line for all nine partner states", () => {
    for (const state of AI_PARTNER_STATES) {
      expect(PARTNER_STATE_DETAIL[state]).toBeDefined();
    }
  });
});

/* ==========================================================================
   The reveal gate
   ========================================================================== */

describe("a suggestion is not publishable before ready", () => {
  it("treats only ready as publishable", () => {
    for (const state of AI_GENERATION_STATES) {
      expect(isPublishableState(state)).toBe(state === "ready");
    }
  });

  it("hides a suggestion while its own run is mid pipeline", () => {
    const suggestion = { id: "sug-1", status: "ready" as SuggestionStatus };
    const prePublish: AIGenerationState[] = [
      "idle",
      "queued",
      "retrieving",
      "reconciling",
      "analysing",
      "drafting",
      "validating",
      "error",
    ];
    for (const state of prePublish) {
      expect(canRevealSuggestion(suggestion, { state, suggestionId: "sug-1" })).toBe(false);
    }
    expect(canRevealSuggestion(suggestion, { state: "ready", suggestionId: "sug-1" })).toBe(true);
    // Blocked is post validation: it means a validated suggestion awaits approval.
    expect(canRevealSuggestion(suggestion, { state: "blocked", suggestionId: "sug-1" })).toBe(true);
  });

  it("does not hide an unrelated suggestion while another run is in flight", () => {
    const suggestion = { id: "sug-2", status: "ready" as SuggestionStatus };
    expect(canRevealSuggestion(suggestion, { state: "drafting", suggestionId: "sug-9" })).toBe(true);
  });

  it("hides a suggestion whose own status says it is still being worked on", () => {
    for (const status of SUGGESTION_STATUSES) {
      const revealed = canRevealSuggestion({ id: "sug-3", status }, null);
      expect(revealed).toBe(status !== "monitoring" && status !== "checking");
    }
  });

  it("reveals nothing when there is no suggestion", () => {
    expect(canRevealSuggestion(null, { state: "ready", suggestionId: null })).toBe(false);
    expect(canRevealSuggestion(undefined)).toBe(false);
  });

  it("keeps the stage list inside the ordered pipeline", () => {
    for (const stage of AI_STAGE_ORDER) {
      expect(AI_STAGE_LABELS[stage]).toBeDefined();
    }
    expect(AI_STAGE_ORDER[AI_STAGE_ORDER.length - 1]).toBe("ready");
  });
});

/* ==========================================================================
   Card actions
   ========================================================================== */

describe("card action selection", () => {
  const base = {
    status: "ready" as SuggestionStatus,
    authorityClass: "APPROVAL_REQUIRED" as AuthorityClass,
    constrained: false,
    decisionRequired: false,
    hasRecommendation: true,
  };

  it("offers approve on a gated, unconstrained, open suggestion", () => {
    expect(selectSuggestionActions(base).primary).toBe("approve");
    expect(selectSuggestionActions({ ...base, authorityClass: "PROPOSE" }).primary).toBe("approve");
  });

  it("never offers approve where the authority model has no human gate", () => {
    const ungated: AuthorityClass[] = [
      "READ",
      "DRAFT",
      "POLICY_BOUND_AUTONOMOUS",
      "PROHIBITED",
    ];
    for (const authorityClass of ungated) {
      const plan = selectSuggestionActions({ ...base, authorityClass });
      expect(plan.primary).not.toBe("approve");
      expect(plan.overflow).not.toContain("approve");
    }
  });

  it("withdraws approve from a constrained suggestion", () => {
    const plan = selectSuggestionActions({ ...base, constrained: true });
    expect(plan.primary).toBe("review");
    expect(plan.overflow).not.toContain("approve");
  });

  it("withdraws approve when there is no recommendation to approve", () => {
    const plan = selectSuggestionActions({ ...base, hasRecommendation: false });
    expect(plan.primary).toBe("review");
    expect(plan.overflow).not.toContain("approve");
  });

  it("removes snooze and dismiss once a decision is required", () => {
    const plan = selectSuggestionActions({ ...base, decisionRequired: true });
    expect(plan.overflow).not.toContain("snooze");
    expect(plan.overflow).not.toContain("dismiss");
  });

  it("leaves only read paths on a closed suggestion", () => {
    const completed = selectSuggestionActions({ ...base, status: "completed" });
    expect(completed.primary).toBe("review");
    expect(completed.overflow).not.toContain("approve");
    expect(completed.overflow).not.toContain("snooze");
    expect(completed.overflow).not.toContain("dismiss");

    // A dismissed suggestion keeps one way back to the object and nothing else.
    const dismissed = selectSuggestionActions({ ...base, status: "dismissed" });
    expect(dismissed.primary).toBe("open-object");
    expect(dismissed.overflow).toEqual([]);
  });

  it("offers nothing to approve while the partner is still watching", () => {
    for (const status of ["monitoring", "checking"] as SuggestionStatus[]) {
      const plan = selectSuggestionActions({ ...base, status });
      expect(plan.primary).toBe("open-object");
      expect(plan.overflow).not.toContain("approve");
      expect(plan.overflow).not.toContain("modify");
    }
  });

  it("never duplicates the primary action in the overflow", () => {
    for (const status of SUGGESTION_STATUSES) {
      for (const authorityClass of AUTHORITY_CLASSES) {
        for (const constrained of [true, false]) {
          for (const decisionRequired of [true, false]) {
            const plan = selectSuggestionActions({
              status,
              authorityClass,
              constrained,
              decisionRequired,
              hasRecommendation: true,
            });
            if (plan.primary) expect(plan.overflow).not.toContain(plan.primary);
            expect(new Set(plan.overflow).size).toBe(plan.overflow.length);
          }
        }
      }
    }
  });
});

/* ==========================================================================
   Confidence
   ========================================================================== */

describe("confidence", () => {
  it("never presents a constrained suggestion as high confidence", () => {
    for (const raw of [0, 40, 55, 70, 88, 100]) {
      const { band, value } = confidenceBand(raw, true);
      expect(band).not.toBe("high");
      expect(value).toBeLessThanOrEqual(CONSTRAINED_CONFIDENCE_CEILING);
    }
  });

  it("leaves an unconstrained score alone", () => {
    expect(confidenceBand(88).band).toBe("high");
    expect(confidenceBand(88).value).toBe(88);
    expect(confidenceBand(60).band).toBe("moderate");
    expect(confidenceBand(20).band).toBe("low");
  });
});

/* ==========================================================================
   Prompts
   ========================================================================== */

describe("suggested prompts", () => {
  it("never offers more than three", () => {
    const contexts = [
      {},
      { hasSelection: true },
      { hasSelection: true, hasOpenDecision: true },
      {
        hasSelection: true,
        hasOpenDecision: true,
        hasConflictingEvidence: true,
        hasCompletedActions: true,
        hasSuggestion: true,
        turnCount: 4,
      },
      { turnCount: 12 },
    ];
    for (const context of contexts) {
      const chosen = selectPromptIds(context);
      expect(chosen.length).toBeLessThanOrEqual(MAX_PROMPT_CHIPS);
      expect(chosen.length).toBeGreaterThan(0);
      expect(new Set(chosen).size).toBe(chosen.length);
      for (const id of chosen) expect(PROMPT_IDS).toContain(id);
    }
  });

  it("puts the open decision first when the day is blocked on one", () => {
    expect(selectPromptIds({ hasOpenDecision: true })[0]).toBe("needs-decision");
  });

  it("has a label for every prompt in the contextual set", () => {
    expect(Object.keys(PROMPT_LABELS).sort()).toEqual([...PROMPT_IDS].sort());
  });
});

/* ==========================================================================
   Typed parts
   ========================================================================== */

describe("typed response parts", () => {
  /** The discriminator as `chat_turns.parts` declares it. */
  const SCHEMA_KINDS = [
    "answer",
    "evidence",
    "uncertainty",
    "recommendation",
    "alternative",
    "proposed-action",
    "approval-request",
    "execution-receipt",
    "blocked",
    "follow-up",
    "source-status",
  ];

  it("renders every kind the schema can produce", () => {
    expect([...AI_PART_KINDS].sort()).toEqual([...SCHEMA_KINDS].sort());
    for (const kind of AI_PART_KINDS) {
      const label = AI_PART_LABELS[kind];
      expect(label).toBeDefined();
      expect(label.en.length).toBeGreaterThan(0);
      expect(label.de.length).toBeGreaterThan(0);
    }
  });

  it("distinguishes a proposal, an approval request and an executed change", () => {
    const proposed = AI_PART_LABELS["proposed-action"].en;
    const approval = AI_PART_LABELS["approval-request"].en;
    const executed = AI_PART_LABELS["execution-receipt"].en;
    expect(new Set([proposed, approval, executed]).size).toBe(3);
  });

  it("reads the connected system phase from the kind when none is stated", () => {
    expect(connectionPhaseFromPart({ kind: "evidence" })).toBe("read-from-source");
    expect(connectionPhaseFromPart({ kind: "recommendation" })).toBe("prepared-locally");
    expect(connectionPhaseFromPart({ kind: "approval-request" })).toBe("waiting-approval");
    // Pessimistic by design: an unqualified receipt is queued, not done.
    expect(connectionPhaseFromPart({ kind: "execution-receipt" })).toBe("queued-external");
    expect(connectionPhaseFromPart({ kind: "blocked" })).toBe("failed-external");
    expect(connectionPhaseFromPart({ kind: "answer" })).toBeNull();
  });

  it("prefers a stated phase over the inferred one", () => {
    expect(
      connectionPhaseFromPart({
        kind: "execution-receipt",
        meta: { phase: "executed-external" },
      }),
    ).toBe("executed-external");
    expect(
      connectionPhaseFromPart({ kind: "execution-receipt", meta: { phase: "nonsense" } }),
    ).toBe("queued-external");
  });

  it("labels all six connected system phases", () => {
    for (const phase of AI_CONNECTION_PHASES) {
      expect(AI_CONNECTION_PHASE_LABELS[phase].en.length).toBeGreaterThan(0);
      expect(AI_CONNECTION_PHASE_LABELS[phase].de.length).toBeGreaterThan(0);
    }
  });
});

/* ==========================================================================
   Grouping
   ========================================================================== */

describe("activity grouping", () => {
  it("groups by moment and keeps arrival order", () => {
    const groups = groupByMoment([
      { atMoment: "09:15", id: "a" },
      { atMoment: "09:15", id: "b" },
      { atMoment: "14:05", id: "c" },
      { atMoment: "09:15", id: "d" },
    ]);
    expect(groups.map((group) => group.moment)).toEqual(["09:15", "14:05"]);
    expect(groups[0]?.entries.map((entry) => entry.id)).toEqual(["a", "b", "d"]);
  });
});

/* ==========================================================================
   Copy constraints
   ========================================================================== */

function allLabelPairs(): Array<{ key: string; pair: LabelPair }> {
  const sources: Array<Record<string, LabelPair>> = [
    PARTNER_LABELS,
    PARTNER_STATE_DETAIL,
    AI_PART_LABELS,
    PROMPT_LABELS,
    AI_CONNECTION_PHASE_LABELS,
  ];
  const pairs: Array<{ key: string; pair: LabelPair }> = [];
  for (const source of sources) {
    for (const [key, pair] of Object.entries(source)) pairs.push({ key, pair });
  }
  return pairs;
}

describe("copy constraints", () => {
  const EM_DASH = String.fromCodePoint(0x2014);

  it("contains no em dash anywhere in the dictionary", () => {
    for (const { key, pair } of allLabelPairs()) {
      expect(pair.en.includes(EM_DASH), `${key} en`).toBe(false);
      expect(pair.de.includes(EM_DASH), `${key} de`).toBe(false);
    }
  });

  it("carries an English and a German form for every label", () => {
    for (const { key, pair } of allLabelPairs()) {
      expect(pair.en.trim().length, `${key} en`).toBeGreaterThan(0);
      expect(pair.de.trim().length, `${key} de`).toBeGreaterThan(0);
    }
  });

  it("keeps the German side ASCII, transliterating umlauts", () => {
    for (const { key, pair } of allLabelPairs()) {
      expect(/^[\x20-\x7E]*$/.test(pair.de), `${key} de`).toBe(true);
      expect(/^[\x20-\x7E]*$/.test(pair.en), `${key} en`).toBe(true);
    }
  });

  it("names no provider, vendor or engine in the workday interface", () => {
    /*
     * The normal workday is a neutral product. Provider and trace metadata is
     * available in Control Room and Trust, and in the workday only behind the
     * explicit "View details" disclosure, never in a label.
     */
    const forbidden = ["openai", "gpt", "claude", "anthropic", "llm", "model"];
    for (const { key, pair } of allLabelPairs()) {
      const text = `${pair.en} ${pair.de}`.toLowerCase();
      for (const term of forbidden) {
        expect(text.includes(term), `${key} contains ${term}`).toBe(false);
      }
    }
  });

  it("labels the conversational tab Chat rather than Ask", () => {
    expect(PARTNER_LABELS["tabChat"]?.en).toBe("Chat");
    expect(PARTNER_LABELS["tabChat"]?.de).toBe("Chat");
  });

  it("uses the exact composer placeholder the brief specifies", () => {
    expect(PARTNER_LABELS["chatPlaceholder"]?.en).toBe("Ask about the current work");
  });
});
