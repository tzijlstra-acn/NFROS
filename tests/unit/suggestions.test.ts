/**
 * Unit tests for the suggestion pipeline.
 *
 * Pure. No database, because the parts of this pipeline that are easiest to
 * get quietly wrong are the digest, the stage machine and the validator, and
 * all three are functions. Evidence resolution is injected as a set rather
 * than read, which is what makes the validator testable here at all.
 *
 * Each test is written to try to break one specific claim rather than to
 * exercise a happy path. A validator that passes everything is worse than no
 * validator, so the rejection cases are the ones that matter.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ROLE_IDS } from "@/db/schema/core";
import { AI_STAGE_ORDER, isPublishableState } from "@/workday/contracts";
import {
  collapsedRequestCount,
  computeStateDigest,
  isGenerationInFlight,
  resetSingleFlight,
  singleFlight,
  type SuggestionStateInput,
} from "@/agents/suggestions/digest";
import {
  MIN_TRANSITION_MS,
  heldStageShape,
  normaliseForReplay,
  reachedPublication,
  replayStages,
  seededStageShape,
  StageRecorder,
  validateStageSequence,
} from "@/agents/suggestions/stages";
import {
  HIGH_CONFIDENCE_THRESHOLD,
  REGULATORY_DISCLOSURE,
  copyStrings,
  findSwissJurisdictionErrors,
  sanitiseDraftCopy,
  stripDashes,
  validateSuggestionDraft,
  type SuggestionDraft,
} from "@/agents/suggestions/validate";
import {
  SEEDED_SUGGESTIONS,
  SUGGESTION_BEATS,
  allSeededStrings,
  beatForMoment,
  beatKeyFor,
  seededSuggestionFor,
  seededSuggestionForObject,
} from "@/agents/suggestions/seeded";
import { textToParts, partsToPlainText, enforceNeutralCopy, extractRefs } from "@/agents/chat/parts";
import {
  SEEDED_CHAT_ANSWERS,
  matchSeededChatAnswer,
  seededChatDecline,
} from "@/agents/chat/seeded";
import { detectRequestedTool } from "@/agents/chat/service";
import { TOOL_REGISTRY } from "@/server/security/authority";

/*
 * Built from code points. These files exist to reject the characters, so
 * writing them literally would make the repository copy gate fail on the test
 * that enforces the rule.
 */
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

/* ==========================================================================
   Fixtures
   ========================================================================== */

function baseState(): SuggestionStateInput {
  return {
    roleId: "rcsa",
    objectType: "control",
    objectId: "CTL-PAY-014",
    eventId: null,
    viewedMoment: "11:45",
    autonomyLevel: "act-with-approval",
    worldView: "future",
    language: "en",
    evidenceIds: ["EVD-2026-41850", "EVD-2026-41852"],
  };
}

const KNOWN_EVIDENCE = new Set(["EVD-2026-41850", "EVD-2026-41852", "EVD-2026-41855"]);

function draft(overrides: Partial<SuggestionDraft> = {}): SuggestionDraft {
  const base: SuggestionDraft = {
    headline: "Two items that cannot be concluded make the rate unknown",
    changeSummary: "Four items failed an attribute and two could not be concluded at all.",
    whyItMatters:
      "An item where evidence of operation cannot be obtained counts against the conclusion rather than dropping out of the denominator.",
    checksCompleted: ["Reconstructed the attribute matrix and recomputed both deviation rates."],
    actionsCompleted: [],
    recommendedAction: "Propose a partially effective rating with the scope limitation stated.",
    recommendedToolName: "proposeControlRating",
    alternatives: ["Conclude on design only and keep the test open for the missing evidence."],
    evidenceIds: ["EVD-2026-41850"],
    confidence: 55,
    uncertainty: ["One of the two unconcludable items may be retrievable."],
    decisionRequired: true,
    grounding: {
      verifiedFacts: [],
      approvedRecords: [
        {
          statement: "The control test report records four exceptions in a sample of sixty.",
          provenance: "approved-record",
          sourceIds: ["EVD-2026-41850"],
          confidence: null,
        },
      ],
      stakeholderStatements: [],
      modelInference: [],
      conflictingEvidence: [],
    },
  };
  return { ...base, ...overrides };
}

function validate(input: SuggestionDraft, constrained = false) {
  return validateSuggestionDraft(input, {
    knownEvidenceIds: KNOWN_EVIDENCE,
    constrained,
    entityId: "ARC-DE",
    language: "en",
  });
}

function codes(result: ReturnType<typeof validate>): string[] {
  return result.ok ? [] : result.failures.map((failure) => failure.code);
}

/* ==========================================================================
   The state digest
   ========================================================================== */

describe("the state digest", () => {
  it("is stable across calls with the same inputs", () => {
    expect(computeStateDigest(baseState())).toBe(computeStateDigest(baseState()));
  });

  it("ignores the order of the evidence set", () => {
    // This is not cosmetic. The evidence identifiers arrive from several
    // repository calls whose ordering is not guaranteed, and an order
    // sensitive hash would miss the cache on roughly every second request
    // while passing a test that happened to build the list the same way twice.
    const forward = computeStateDigest(baseState());
    const reversed = computeStateDigest({
      ...baseState(),
      evidenceIds: [...baseState().evidenceIds].reverse(),
    });
    expect(forward).toBe(reversed);
  });

  it("ignores a duplicated evidence identifier", () => {
    const once = computeStateDigest(baseState());
    const twice = computeStateDigest({
      ...baseState(),
      evidenceIds: [...baseState().evidenceIds, "EVD-2026-41850"],
    });
    expect(once).toBe(twice);
  });

  it("changes when the evidence set changes", () => {
    expect(computeStateDigest(baseState())).not.toBe(
      computeStateDigest({
        ...baseState(),
        evidenceIds: [...baseState().evidenceIds, "EVD-2026-41855"],
      }),
    );
  });

  it.each([
    ["role", { roleId: "tprm" as const }],
    ["object type", { objectType: "supplier" }],
    ["object id", { objectId: "CTL-PAY-021" }],
    ["event id", { eventId: "WLE-0001" }],
    ["viewed moment", { viewedMoment: "14:05" }],
    ["autonomy level", { autonomyLevel: "recommend" as const }],
    ["world view", { worldView: "today" as const }],
    ["language", { language: "de" as const }],
  ])("changes when the %s changes", (_label, override) => {
    expect(computeStateDigest(baseState())).not.toBe(
      computeStateDigest({ ...baseState(), ...override }),
    );
  });

  it("produces a key short enough to index and long enough not to collide", () => {
    const digest = computeStateDigest(baseState());
    expect(digest).toMatch(/^[0-9a-f]{40}$/);
  });
});

/* ==========================================================================
   Single flight
   ========================================================================== */

describe("the single flight map", () => {
  beforeEach(() => {
    resetSingleFlight();
  });

  it("runs the work once for concurrent callers with the same digest", async () => {
    let invocations = 0;
    const work = async () => {
      invocations += 1;
      await new Promise((done) => setTimeout(done, 20));
      return invocations;
    };

    const results = await Promise.all([
      singleFlight("digest-a", work),
      singleFlight("digest-a", work),
      singleFlight("digest-a", work),
    ]);

    expect(invocations).toBe(1);
    expect(results.filter((entry) => entry.joined)).toHaveLength(2);
    expect(results.every((entry) => entry.value === 1)).toBe(true);
    expect(collapsedRequestCount()).toBe(2);
  });

  it("runs separate work for different digests", async () => {
    let invocations = 0;
    const work = async () => {
      invocations += 1;
      await new Promise((done) => setTimeout(done, 10));
      return invocations;
    };

    await Promise.all([singleFlight("digest-a", work), singleFlight("digest-b", work)]);
    expect(invocations).toBe(2);
  });

  it("clears the entry so a later request runs again", async () => {
    let invocations = 0;
    const work = async () => {
      invocations += 1;
      return invocations;
    };

    await singleFlight("digest-a", work);
    expect(isGenerationInFlight("digest-a")).toBe(false);
    await singleFlight("digest-a", work);
    expect(invocations).toBe(2);
  });

  it("does not poison a digest when the work rejects", async () => {
    /*
     * The failure this guards is specific. If a rejected promise stayed in
     * the map, every later request for that state would await an already
     * rejected promise, so one transient provider failure would permanently
     * break one digest. It is invisible in casual testing because the first
     * request still returns its error correctly.
     */
    let attempts = 0;
    const failing = async () => {
      attempts += 1;
      throw new Error("provider unavailable");
    };

    await expect(singleFlight("digest-c", failing)).rejects.toThrow("provider unavailable");
    expect(isGenerationInFlight("digest-c")).toBe(false);

    await expect(singleFlight("digest-c", failing)).rejects.toThrow("provider unavailable");
    expect(attempts).toBe(2);
  });
});

/* ==========================================================================
   The stage contract
   ========================================================================== */

describe("the stage contract", () => {
  it("walks the published order in the offline shape", () => {
    const shape = seededStageShape();
    expect(shape.map((stage) => stage.state)).toEqual(AI_STAGE_ORDER);
    expect(validateStageSequence(shape).ok).toBe(true);
  });

  it("produces the same legal walk in all three modes", () => {
    const recorder = new StageRecorder();
    for (const state of AI_STAGE_ORDER) recorder.mark(state);

    const live = validateStageSequence(recorder.recorded());
    const safe = validateStageSequence(normaliseForReplay(seededStageShape()));
    const offline = validateStageSequence(seededStageShape());

    expect([live.ok, safe.ok, offline.ok]).toEqual([true, true, true]);
    expect(recorder.recorded().map((stage) => stage.state)).toEqual(AI_STAGE_ORDER);
  });

  it("never lets a replay jump from empty straight to complete", () => {
    const replayed = normaliseForReplay(seededStageShape());
    expect(replayed.length).toBe(AI_STAGE_ORDER.length);
    expect(replayed[0]?.state).toBe("queued");
    expect(replayed[replayed.length - 1]?.state).toBe("ready");
  });

  it("floors an instantaneous capture so cached content does not flash", () => {
    const instant = AI_STAGE_ORDER.map((state) => ({
      state,
      label: state,
      labelDe: state,
      atMs: 0,
    }));
    const floored = normaliseForReplay(instant);
    floored.forEach((stage, index) => {
      expect(stage.atMs).toBeGreaterThanOrEqual(MIN_TRANSITION_MS * (index + 1));
    });
  });

  it("does not pad a live recording", () => {
    // A progress animation that costs real latency is a lie the user pays for.
    const recorder = new StageRecorder();
    for (const state of AI_STAGE_ORDER) recorder.mark(state);
    for (const stage of recorder.recorded()) {
      expect(stage.atMs).toBeLessThan(500);
    }
  });

  it("holds short of publication when a required source is outstanding", () => {
    for (const holdAt of ["retrieving", "reconciling"] as const) {
      const held = heldStageShape(holdAt);
      expect(reachedPublication(held)).toBe(false);
      expect(validateStageSequence(held).ok).toBe(true);
      const last = held[held.length - 1];
      expect(last).toBeDefined();
      expect(isPublishableState(last!.state)).toBe(false);
    }
  });

  it("rejects a progression that skips a stage", () => {
    const skipping = [
      { state: "queued" as const, label: "a", labelDe: "a", atMs: 0 },
      { state: "ready" as const, label: "b", labelDe: "b", atMs: 100 },
    ];
    const result = validateStageSequence(skipping);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("skips");
  });

  it("rejects a progression that moves backwards", () => {
    const backwards = [
      { state: "queued" as const, label: "a", labelDe: "a", atMs: 0 },
      { state: "retrieving" as const, label: "b", labelDe: "b", atMs: 10 },
      { state: "queued" as const, label: "c", labelDe: "c", atMs: 20 },
    ];
    expect(validateStageSequence(backwards).ok).toBe(false);
  });

  it("replays within its budget and reports each transition in order", async () => {
    const seen: string[] = [];
    const completed = await replayStages(
      seededStageShape(),
      (stage) => seen.push(stage.state),
      { budgetMs: 0, sleep: async () => undefined },
    );
    expect(seen).toEqual(AI_STAGE_ORDER);
    expect(completed).toEqual(AI_STAGE_ORDER);
  });
});

/* ==========================================================================
   Validation
   ========================================================================== */

describe("suggestion validation", () => {
  it("passes a well formed draft", () => {
    expect(validate(draft()).ok).toBe(true);
  });

  it("rejects an invented evidence identifier", () => {
    expect(codes(validate(draft({ evidenceIds: ["EVD-9999-00000"] })))).toContain(
      "dangling-evidence",
    );
  });

  it("rejects an invented identifier hidden inside the grounding block", () => {
    // The obvious place to check is `evidenceIds`. A citation smuggled into a
    // grounding statement is the one that would otherwise reach the interface
    // wearing the styling reserved for a verified record.
    const result = validate(
      draft({
        grounding: {
          verifiedFacts: [
            {
              statement: "A fact with a citation nobody can open.",
              provenance: "verified-fact",
              sourceIds: ["EVD-0000-11111"],
              confidence: null,
            },
          ],
          approvedRecords: [],
          stakeholderStatements: [],
          modelInference: [],
          conflictingEvidence: [],
        },
      }),
    );
    expect(codes(result)).toContain("dangling-evidence");
  });

  it("rejects an em dash", () => {
    expect(
      codes(validate(draft({ headline: `A headline ${EM_DASH} with an em dash in it` }))),
    ).toContain("em-dash");
  });

  it.each([
    "The language model drew this conclusion from the sample.",
    "Produced with OpenAI on the current configuration.",
    "A GPT-4 class model reviewed the working papers.",
  ])("rejects a provider or model reference: %s", (text) => {
    expect(codes(validate(draft({ whyItMatters: text })))).toContain("provider-name");
  });

  it.each([
    "The control is fully compliant with the group standard.",
    "Arcadia complies with the applicable requirements.",
    "This approach guarantees the exception will not recur.",
  ])("rejects a compliance claim: %s", (text) => {
    expect(codes(validate(draft({ whyItMatters: text })))).toContain("compliance-claim");
  });

  it.each([
    "This approach saves EUR 40,000 of annual review effort.",
    "The change reduces cost across the payment repair team.",
    "Savings of 120 hours per quarter follow from this.",
  ])("rejects a savings claim: %s", (text) => {
    expect(codes(validate(draft({ changeSummary: text })))).toContain("savings-claim");
  });

  it("rejects high confidence while a required source is unavailable", () => {
    const result = validate(draft({ confidence: HIGH_CONFIDENCE_THRESHOLD }), true);
    expect(codes(result)).toContain("confidence-while-constrained");
  });

  it("permits low confidence while a required source is unavailable", () => {
    expect(validate(draft({ confidence: 35, recommendedAction: null, recommendedToolName: null }), true).ok).toBe(
      true,
    );
  });

  it("rejects a recommendation whose tool is not in the authority registry", () => {
    expect(codes(validate(draft({ recommendedToolName: "doSomethingClever" })))).toContain(
      "unknown-tool",
    );
  });

  it("rejects a recommendation naming a prohibited tool", () => {
    const result = validate(draft({ recommendedToolName: "notifySupervisor" }));
    expect(codes(result)).toContain("prohibited-tool");
  });

  it("computes the authority class from the registry rather than from the copy", () => {
    const result = validate(draft({ recommendedToolName: "createIssue" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.authorityClass).toBe(TOOL_REGISTRY.createIssue?.authorityClass);
      expect(result.authorityClass).toBe("APPROVAL_REQUIRED");
    }
  });

  it("rejects a recommendation that cites nothing", () => {
    const result = validate(
      draft({
        evidenceIds: [],
        grounding: {
          verifiedFacts: [],
          approvedRecords: [],
          stakeholderStatements: [],
          modelInference: [],
          conflictingEvidence: [],
        },
      }),
    );
    expect(codes(result)).toContain("uncited-recommendation");
  });

  it("rejects an inference filed as a record", () => {
    const result = validate(
      draft({
        grounding: {
          verifiedFacts: [],
          approvedRecords: [
            {
              statement: "The exception is probably systemic.",
              provenance: "model-inference",
              sourceIds: ["EVD-2026-41850"],
              confidence: 0.6,
            },
          ],
          stakeholderStatements: [],
          modelInference: [],
          conflictingEvidence: [],
        },
      }),
    );
    expect(codes(result)).toContain("inference-as-record");
  });

  it("requires the disclosure on a regulatory reference", () => {
    expect(
      codes(validate(draft({ whyItMatters: "The FINMA expectation bears on this arrangement." }))),
    ).toContain("missing-disclosure");
  });

  it("accepts a regulatory reference that carries the disclosure", () => {
    expect(
      validate(
        draft({
          whyItMatters: `The FINMA expectation bears on this arrangement. ${REGULATORY_DISCLOSURE}`,
        }),
      ).ok,
    ).toBe(true);
  });

  it("rejects the Swiss entity attached to a European Union instrument", () => {
    const result = validate(
      draft({
        whyItMatters: `The Swiss entity must meet the DORA requirement here. ${REGULATORY_DISCLOSURE}`,
      }),
    );
    expect(codes(result)).toContain("swiss-dora");
  });

  it("permits an explicit statement that the instrument does not apply", () => {
    // This is the sentence the product most wants to be able to say, and a
    // naive co-occurrence rule would reject exactly it.
    expect(
      validate(
        draft({
          whyItMatters: `DORA does not apply to the Swiss entity, which follows the FINMA framework. ${REGULATORY_DISCLOSURE}`,
        }),
      ).ok,
    ).toBe(true);
  });

  it("reports every failing rule rather than only the first", () => {
    const result = validate(
      draft({
        headline: `Bad headline ${EM_DASH} here`,
        whyItMatters: "The bank is fully compliant and the language model agrees.",
        evidenceIds: ["EVD-9999-00000"],
      }),
    );
    expect(result.ok).toBe(false);
    expect(codes(result).length).toBeGreaterThanOrEqual(4);
  });

  it("strips both dash characters without touching anything else", () => {
    expect(stripDashes(`a${EM_DASH}b`)).toBe("a, b");
    expect(stripDashes(`10${EN_DASH}20`)).toBe("10 to 20");
    expect(stripDashes("a hyphen-joined word")).toBe("a hyphen-joined word");
  });

  it("sanitises every copy field of a draft", () => {
    const dirty = draft({
      headline: `Headline ${EM_DASH} one`,
      checksCompleted: [`Check ${EM_DASH} one`],
      uncertainty: [`Unknown ${EN_DASH} thing`],
    });
    const clean = sanitiseDraftCopy(dirty);
    expect(copyStrings(clean).some((value) => value.includes(EM_DASH))).toBe(false);
    expect(copyStrings(clean).some((value) => value.includes(EN_DASH))).toBe(false);
  });
});

/* ==========================================================================
   Seeded content
   ========================================================================== */

describe("the seeded suggestion set", () => {
  it("covers all six roles", () => {
    const roles = new Set(SEEDED_SUGGESTIONS.map((entry) => entry.roleId));
    for (const roleId of ROLE_IDS) expect(roles.has(roleId)).toBe(true);
  });

  it("covers all three beats for every role", () => {
    for (const roleId of ROLE_IDS) {
      for (const beat of SUGGESTION_BEATS) {
        expect(seededSuggestionFor(roleId, beat), `${roleId}/${beat}`).not.toBeNull();
      }
    }
  });

  it("covers both languages on every card", () => {
    for (const entry of SEEDED_SUGGESTIONS) {
      expect(entry.en.headline.length).toBeGreaterThan(10);
      expect(entry.de.headline.length).toBeGreaterThan(10);
      expect(entry.en.headline).not.toBe(entry.de.headline);
    }
  });

  it("contains no em dash in any seeded string", () => {
    const offenders = allSeededStrings().filter((value) => value.includes(EM_DASH));
    expect(offenders).toEqual([]);
  });

  it("contains no umlaut or sharp s in any seeded string", () => {
    const offenders = allSeededStrings().filter((value) =>
      /[ÄÖÜäöüß]/.test(value),
    );
    expect(offenders).toEqual([]);
  });

  it("never associates the Swiss entity with a European Union instrument", () => {
    expect(findSwissJurisdictionErrors(allSeededStrings())).toEqual([]);
  });

  it("keeps checks separate from completed changes", () => {
    // Reading the override audit log is a check. It is not an action, because
    // nothing changed, and blurring the two is how a product starts claiming
    // work it did not do.
    for (const entry of SEEDED_SUGGESTIONS) {
      for (const content of [entry.en, entry.de]) {
        expect(content.checksCompleted.length).toBeGreaterThan(0);
        expect(content.actionsCompleted).toEqual([]);
      }
    }
  });

  it("names a registry tool whenever it recommends an action", () => {
    for (const entry of SEEDED_SUGGESTIONS) {
      for (const content of [entry.en, entry.de]) {
        if (content.recommendedAction === null) continue;
        const toolName = content.recommendedToolName ?? "";
        expect(TOOL_REGISTRY[toolName], `${entry.roleId}/${entry.beat}: ${toolName}`).toBeDefined();
        expect(TOOL_REGISTRY[toolName]?.authorityClass).not.toBe("PROHIBITED");
      }
    }
  });

  it("states uncertainty on every card", () => {
    for (const entry of SEEDED_SUGGESTIONS) {
      for (const content of [entry.en, entry.de]) {
        expect(content.uncertainty.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the five grounding arrays distinct", () => {
    for (const entry of SEEDED_SUGGESTIONS) {
      for (const content of [entry.en, entry.de]) {
        for (const statement of content.grounding.verifiedFacts) {
          expect(statement.provenance).toBe("verified-fact");
        }
        for (const statement of content.grounding.approvedRecords) {
          expect(statement.provenance).toBe("approved-record");
        }
        for (const statement of content.grounding.stakeholderStatements) {
          expect(statement.provenance).toBe("stakeholder-statement");
        }
        for (const statement of content.grounding.modelInference) {
          expect(statement.provenance).toBe("model-inference");
          expect(statement.confidence).not.toBeNull();
        }
      }
    }
  });

  it("maps a moment onto a beat across the whole day", () => {
    expect(beatForMoment("07:45")).toBe("morning");
    expect(beatForMoment("11:44")).toBe("morning");
    expect(beatForMoment("11:45")).toBe("decision");
    expect(beatForMoment("14:04")).toBe("decision");
    expect(beatForMoment("14:05")).toBe("shared-event");
    expect(beatForMoment("16:30")).toBe("shared-event");
  });

  it("prefers the card for the selected object over the card for the moment", () => {
    const contract = seededSuggestionForObject("tprm", "contract", "CTR-2023-0117-A3", "16:30");
    expect(contract?.beat).toBe("decision");

    const byMoment = seededSuggestionForObject("tprm", "risk", "RSK-0211", "16:30");
    expect(byMoment?.beat).toBe("shared-event");
  });

  it("produces a distinct cache key per role, beat and language", () => {
    const keys = new Set<string>();
    for (const entry of SEEDED_SUGGESTIONS) {
      for (const language of ["en", "de"] as const) {
        keys.add(beatKeyFor(entry.roleId, entry.beat, language));
      }
    }
    expect(keys.size).toBe(SEEDED_SUGGESTIONS.length * 2);
  });
});

/* ==========================================================================
   Chat parts
   ========================================================================== */

describe("the chat part mapping", () => {
  it("maps labelled lines onto typed parts", () => {
    const parts = textToParts(
      [
        "ANSWER: The recorded rating is not supported by the independent test.",
        "EVIDENCE: Control test report TST-2026-0318 records four exceptions. EVD-2026-41850",
        "UNCERTAINTY: Two items could not be concluded at all.",
        "RECOMMENDATION: Propose a partially effective rating.",
      ].join("\n"),
    );

    expect(parts.map((part) => part.kind)).toEqual([
      "answer",
      "evidence",
      "uncertainty",
      "recommendation",
    ]);
    expect(parts[1]?.refs).toContain("EVD-2026-41850");
  });

  it("appends an unlabelled continuation to the part above it", () => {
    const parts = textToParts(
      ["RECOMMENDATION: Propose a partially effective rating.", "State the scope limitation."].join(
        "\n",
      ),
    );
    expect(parts).toHaveLength(1);
    expect(parts[0]?.text).toContain("State the scope limitation");
  });

  it("degrades unlabelled prose to an answer rather than to nothing", () => {
    const parts = textToParts("The rating is not supported by the test result.");
    expect(parts).toHaveLength(1);
    expect(parts[0]?.kind).toBe("answer");
  });

  it("never promotes prose into a stronger kind by inference", () => {
    // A classifier guessing which sentence is a citation will eventually give
    // a model inference the styling reserved for a cited record.
    const parts = textToParts("I recommend proposing a partially effective rating. EVD-2026-41850");
    expect(parts[0]?.kind).toBe("answer");
  });

  it("removes both dash characters from chat copy", () => {
    const parts = textToParts(`ANSWER: One thing ${EM_DASH} and another ${EN_DASH} here.`);
    expect(parts[0]?.text).not.toContain(EM_DASH);
    expect(parts[0]?.text).not.toContain(EN_DASH);
  });

  it("extracts product identifiers as refs", () => {
    expect(extractRefs("See CTL-PAY-014 and TST-2026-0318 and EVD-2026-41850")).toEqual([
      "CTL-PAY-014",
      "TST-2026-0318",
      "EVD-2026-41850",
    ]);
  });

  it("excludes a refusal from the plain text mirror", () => {
    // The mirror feeds search and evaluation, and a refusal is not an answer
    // to the question that was asked.
    const parts = textToParts("ANSWER: Here is the position.\nBLOCKED: That is refused by design.");
    expect(partsToPlainText(parts)).toContain("Here is the position");
    expect(partsToPlainText(parts)).not.toContain("refused by design");
  });

  it("replaces a part that names processing metadata", () => {
    const result = enforceNeutralCopy(
      [{ kind: "answer", text: "The GPT model produced this." }],
      "en",
    );
    expect(result.replaced).toBe(1);
    expect(result.parts[0]?.text).not.toMatch(/gpt/i);
  });
});

/* ==========================================================================
   Seeded chat
   ========================================================================== */

describe("the seeded chat answers", () => {
  it("answers a question it was written for", () => {
    const match = matchSeededChatAnswer(
      "what is the rating on CTL-PAY-014 and is it effective",
      "rcsa",
    );
    expect(match).not.toBeNull();
    expect(match?.id).toBe("chat-ctl-pay-014-rating");
  });

  it("declines a near miss rather than guessing", () => {
    // A seeded paragraph that sounds like an answer to a question it was not
    // written for is the most damaging output this product could produce.
    expect(matchSeededChatAnswer("what is the tolerance", "rcsa")).toBeNull();
    expect(matchSeededChatAnswer("tell me about the weather in Zurich", "rcsa")).toBeNull();
  });

  it("gives the Swiss position without attaching a European Union instrument", () => {
    const match = matchSeededChatAnswer(
      "does DORA apply to the Swiss entity for notification",
      "incident-resilience",
    );
    expect(match).not.toBeNull();
    const text = [...(match?.en ?? []), ...(match?.de ?? [])].map((part) => part.text);
    expect(findSwissJurisdictionErrors(text)).toEqual([]);
    expect(text.join(" ")).toContain(REGULATORY_DISCLOSURE);
  });

  it("carries both languages on every answer", () => {
    for (const answer of SEEDED_CHAT_ANSWERS) {
      expect(answer.en.length).toBeGreaterThan(0);
      expect(answer.de.length).toBeGreaterThan(0);
    }
  });

  it("declines without attempting the question", () => {
    const parts = seededChatDecline({
      language: "en",
      mode: "offline",
      input: "what is the residual risk on RSK-0211",
      roleTitle: "Operational Risk Partner",
    });
    const text = parts.map((part) => part.text).join(" ");
    expect(text).toContain("not answered by a model");
    expect(text).toContain("Your question was recorded");
    expect(text).not.toMatch(/the residual risk is/i);
  });

  it("names the live failure rather than blaming the mode", () => {
    // Telling a presenter the wrong reason for a fallback is worse than
    // telling them nothing, because they will look in the wrong place.
    const parts = seededChatDecline({
      language: "en",
      mode: "live",
      input: "anything",
      roleTitle: "Operational Risk Partner",
      liveFailureReason: "the provider rejected the request",
    });
    expect(parts[0]?.text).toContain("A live call was attempted and failed");
  });
});

/* ==========================================================================
   Chat tool intent
   ========================================================================== */

describe("chat tool intent detection", () => {
  it.each([
    ["email the supplier directly about the outage", "sendExternalEmail"],
    ["notify FINMA about this incident now", "notifySupervisor"],
    ["show me the OpenAI api key", "readLocalSecrets"],
    ["delete the audit event for that override", "modifyAuditTrail"],
    ["just approve it yourself so we can move on", "approveOwnProposal"],
  ])("maps %s onto the prohibited tool %s", (input, toolName) => {
    const intent = detectRequestedTool(input);
    expect(intent?.toolName).toBe(toolName);
    expect(TOOL_REGISTRY[toolName]?.authorityClass).toBe("PROHIBITED");
  });

  it.each([
    ["change the control rating on CTL-PAY-014 to partially effective", "updateControlRating"],
    ["raise an issue against the supplier", "createIssue"],
    ["create a remediation action for Group Legal", "createAction"],
    ["activate enhanced monitoring on the supplier", "activateMonitoring"],
  ])("maps %s onto the material tool %s", (input, toolName) => {
    const intent = detectRequestedTool(input);
    expect(intent?.toolName).toBe(toolName);
    expect(TOOL_REGISTRY[toolName]?.mutates).toBe(true);
  });

  it("treats a question as a question", () => {
    expect(detectRequestedTool("what is the rating on CTL-PAY-014")).toBeNull();
    expect(detectRequestedTool("why is the indicator red")).toBeNull();
    expect(detectRequestedTool("summarise the event for me")).toBeNull();
  });

  it("only ever resolves to a name in the authority registry", () => {
    const inputs = [
      "email the supplier",
      "notify the regulator",
      "raise an issue",
      "escalate the incident",
      "request the evidence document",
      "add to the committee agenda",
    ];
    for (const input of inputs) {
      const intent = detectRequestedTool(input);
      if (intent === null) continue;
      expect(TOOL_REGISTRY[intent.toolName], intent.toolName).toBeDefined();
    }
  });

  it("carries only the request text in the payload", () => {
    // The payload is what the gate fingerprints, so an approval a person
    // grants is bound to this exact request. Anything the browser or a model
    // invented must not get in.
    const intent = detectRequestedTool("raise an issue against the supplier");
    expect(Object.keys(intent?.payload ?? {}).sort()).toEqual(["request", "requestedVia"]);
  });
});
