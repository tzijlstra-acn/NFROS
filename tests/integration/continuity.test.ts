/**
 * Durable context and long sessions.
 *
 * The product's claim is that a full working day stays coherent, and the
 * mechanism it claims to achieve that with is structural rather than clever:
 * almost nothing important lives in the chat transcript, so compaction can
 * discard old turns without losing anything the afternoon depends on.
 *
 * The way to test that claim is not to check that compaction ran. It is to
 * take a snapshot of the state a professional would be furious to lose, throw
 * a long conversation at the session, compact it, and then demand that the
 * snapshot is bit for bit the same. That is what the strict comparison below
 * is for.
 *
 * Retrieval is tested in the same file because it is the other half of the
 * same promise: the day stays coherent partly because evidence is fetched
 * when needed rather than carried in the window.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemporaryDatabase, destroyTemporaryDatabase } from "./support/harness";
import { getSqlite } from "@/db/client";
import { seedScenario } from "@/db/seed/run";
import { recordDecisionAndExecute } from "@/scenario/engine/decide";
import { setMoment } from "@/scenario/engine/state";
import {
  appendMessage,
  assembleContext,
  buildPreservedContext,
  compactSession,
  CONTEXT_BUDGET,
  estimateTokens,
  getMessages,
  getOrCreateSession,
  renderPreservedContext,
  type PreservedContext,
} from "@/agents/sessions/session";
import { lexicalSearch, searchEvidence, sourceCoverage } from "@/server/retrieval/search";
import { momentToMinutes } from "@/domain/nfr/calculators";
import type { RoleId } from "@/db/schema/core";

const ROLE: RoleId = "rcsa";
const USER = "P-003";
const RCSA_DECISION_ID = "DEC-2026-0772";
const RCSA_OPTION_ID = "DEC-2026-0772-O3";
const RATIONALE =
  "The only preventive control carries a design and an operating deficiency and two of six flagged items cannot be concluded, so the deviation rate is unknown.";

/**
 * One long turn.
 *
 * Long enough that a manageable number of turns crosses the compaction
 * threshold, and varied enough that the extractive summariser has a first
 * sentence to take from each one.
 */
function turn(index: number): string {
  const first = `Turn ${index}: the override population for the payment repair process was reviewed again.`;
  const filler = Array.from(
    { length: 12 },
    (_, sentence) =>
      `Observation ${index}.${sentence}: the secondary review record, the release timestamp and the attached evidence object were compared for one item in the sampled population, and the comparison was recorded against the working paper reference rather than summarised.`,
  ).join(" ");
  return `${first} ${filler}`;
}

/** Appends turns until the live transcript passes the compaction threshold. */
function fillSessionPastThreshold(sessionId: string): number {
  let appended = 0;
  let tokens = 0;
  while (tokens <= CONTEXT_BUDGET.compactionThresholdTokens) {
    appended += 1;
    const content = turn(appended);
    appendMessage(sessionId, appended % 2 === 0 ? "assistant" : "user", content);
    tokens += estimateTokens(content);
  }
  // A few more, so the fold is comfortably larger than the kept window.
  for (let i = 0; i < 4; i += 1) {
    appended += 1;
    appendMessage(sessionId, "user", turn(appended));
  }
  return appended;
}

function liveTokens(sessionId: string): number {
  return getMessages(sessionId)
    .filter((message) => !message.compacted)
    .reduce((sum, message) => sum + message.tokenEstimate, 0);
}

function requireContext(): PreservedContext {
  const context = buildPreservedContext(ROLE);
  if (!context) throw new Error("The preserved context could not be built.");
  return context;
}

beforeAll(() => {
  createTemporaryDatabase("continuity");
});

afterAll(() => {
  destroyTemporaryDatabase();
});

beforeEach(() => {
  seedScenario();
});

/* ==========================================================================
   What the preserved context holds
   ========================================================================== */

describe("the preserved context", () => {
  it("names the role, the entity and the state in force", () => {
    const context = requireContext();
    expect(context.role).toBe(ROLE);
    expect(context.roleTitle.length).toBeGreaterThan(5);
    expect(context.roleTitle).not.toBe(ROLE);
    expect(context.entity).not.toBe("unknown");
    expect(context.jurisdiction).not.toBe("unknown");
    expect(context.regulatoryBloc).not.toBe("unknown");
    expect(context.currentMoment).toBe("07:45");
    expect(context.autonomyLevel).toBe("act-with-approval");
  });

  it("lists the open decisions the human still owns", () => {
    const context = requireContext();
    expect(context.openDecisions.length).toBeGreaterThan(0);
    for (const decision of context.openDecisions) {
      expect(decision.id.length).toBeGreaterThan(0);
      expect(decision.title.length).toBeGreaterThan(5);
      expect(decision.judgmentKind.length).toBeGreaterThan(0);
    }
    expect(context.approvedDecisions).toStrictEqual([]);
  });

  it("lists the actions in flight", () => {
    const context = requireContext();
    expect(context.activeActions.length).toBeGreaterThan(0);
    for (const action of context.activeActions) {
      expect(action.status).not.toBe("completed");
      expect(action.status).not.toBe("cancelled");
      expect(action.title.length).toBeGreaterThan(5);
    }
  });

  it("carries the uncertainties that must not be treated as resolved", () => {
    // Missing and stale evidence are the two kinds of open question the
    // afternoon can silently lose. They are read from the evidence table, not
    // from anything the model said.
    const context = requireContext();
    expect(context.openUncertainties.length).toBeGreaterThan(0);
    for (const item of context.openUncertainties) {
      expect(item.length).toBeGreaterThan(10);
    }
  });

  it("carries the source references the day has relied on", () => {
    const context = requireContext();
    expect(context.sourceReferences.length).toBeGreaterThan(0);

    const documents = new Set(
      (
        getSqlite().prepare("select id from evidence_documents").all() as Array<{ id: string }>
      ).map((row) => row.id),
    );
    const dangling = context.sourceReferences.filter((id) => !documents.has(id));
    expect(dangling, `source references that resolve to nothing: ${dangling.join(", ")}`).toStrictEqual(
      [],
    );
  });

  it("includes a decision once the human has recorded it, with their rationale", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const context = requireContext();
    const recorded = context.approvedDecisions.find((entry) => entry.id === RCSA_DECISION_ID);
    expect(recorded, "the recorded decision is not in the preserved context").toBeDefined();
    expect(recorded?.rationale).toBe(RATIONALE);
    expect(recorded?.chosenOptionId).toBe(RCSA_OPTION_ID);
    expect(recorded?.atMoment).toBe("11:45");

    // And it is no longer presented as open.
    expect(context.openDecisions.some((entry) => entry.id === RCSA_DECISION_ID)).toBe(false);
  });

  it("renders as a block that states the decisions and the open uncertainties", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const rendered = renderPreservedContext(requireContext());
    expect(rendered).toContain(RCSA_DECISION_ID);
    expect(rendered).toContain(RATIONALE);
    expect(rendered).toContain("Open uncertainties");
    expect(rendered).toContain("Decisions still open");
  });
});

/* ==========================================================================
   Compaction
   ========================================================================== */

describe("compaction", () => {
  it("does nothing while the transcript is below the threshold", () => {
    const session = getOrCreateSession(USER, ROLE);
    appendMessage(session.id, "user", "What changed on the override control overnight?");

    const result = compactSession(session.id, ROLE);
    expect(result.compacted).toBe(false);
    expect(result.turnsFolded).toBe(0);
    expect(getMessages(session.id).every((message) => !message.compacted)).toBe(true);
  });

  it("folds the old turns, keeps the recent ones and writes a rolling summary", () => {
    const session = getOrCreateSession(USER, ROLE);
    const appended = fillSessionPastThreshold(session.id);
    expect(liveTokens(session.id)).toBeGreaterThan(CONTEXT_BUDGET.compactionThresholdTokens);

    const result = compactSession(session.id, ROLE);

    expect(result.compacted).toBe(true);
    expect(result.turnsFolded).toBe(appended - CONTEXT_BUDGET.alwaysKeepRecentTurns);
    expect(result.summaryLength).toBeGreaterThan(0);
    expect(result.tokensAfter).toBeLessThan(result.tokensBefore);

    const messages = getMessages(session.id);
    const folded = messages.filter((message) => message.compacted);
    const kept = messages.filter((message) => !message.compacted);
    expect(folded.length).toBe(result.turnsFolded);
    expect(kept.length).toBe(CONTEXT_BUDGET.alwaysKeepRecentTurns);

    // The kept turns are the most recent ones, not an arbitrary window.
    const keptOrders = kept.map((message) => message.sortOrder);
    expect(Math.min(...keptOrders)).toBe(appended - CONTEXT_BUDGET.alwaysKeepRecentTurns + 1);
    expect(Math.max(...keptOrders)).toBe(appended);

    const stored = getSqlite()
      .prepare(
        "select rolling_summary as summary, compaction_count as count, last_compacted_at as at from agent_sessions where id = ?",
      )
      .get(session.id) as { summary: string; count: number; at: string | null } | undefined;
    expect(stored?.summary.length ?? 0).toBeGreaterThan(0);
    expect(stored?.count).toBe(1);
    expect(stored?.at).not.toBeNull();
  });

  it("preserves the approved decisions and open uncertainties exactly", async () => {
    // This is the continuity guarantee. Nothing in the snapshot may move.
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const before = requireContext();
    expect(before.approvedDecisions.length).toBeGreaterThan(0);
    expect(before.openUncertainties.length).toBeGreaterThan(0);

    const session = getOrCreateSession(USER, ROLE);
    fillSessionPastThreshold(session.id);
    const result = compactSession(session.id, ROLE);
    expect(result.compacted).toBe(true);

    const after = requireContext();
    expect(after.approvedDecisions).toStrictEqual(before.approvedDecisions);
    expect(after.openUncertainties).toStrictEqual(before.openUncertainties);
    expect(after.openDecisions).toStrictEqual(before.openDecisions);
    expect(after.activeActions).toStrictEqual(before.activeActions);
    expect(after.sourceReferences).toStrictEqual(before.sourceReferences);
    expect(after.sharedEvent).toStrictEqual(before.sharedEvent);
  });

  it("keeps the folded turns readable rather than deleting them", () => {
    const session = getOrCreateSession(USER, ROLE);
    const appended = fillSessionPastThreshold(session.id);
    compactSession(session.id, ROLE);

    // The control room shows that compaction happened, which it can only do
    // if the folded turns are still there.
    expect(getMessages(session.id).length).toBe(appended);
    for (const message of getMessages(session.id)) {
      expect(message.content.length).toBeGreaterThan(0);
    }
  });

  it("records an audit event for the compaction", () => {
    const session = getOrCreateSession(USER, ROLE);
    fillSessionPastThreshold(session.id);
    compactSession(session.id, ROLE);

    const events = getSqlite()
      .prepare(
        "select id, category, object_id as objectId, summary from audit_events where action = 'compactSession'",
      )
      .all() as Array<{ id: string; category: string; objectId: string; summary: string }>;

    expect(events.length).toBe(1);
    expect(events[0]?.objectId).toBe(session.id);
    expect(events[0]?.summary.length ?? 0).toBeGreaterThan(20);
  });

  it("compacts again when the transcript grows again", () => {
    const session = getOrCreateSession(USER, ROLE);
    fillSessionPastThreshold(session.id);
    expect(compactSession(session.id, ROLE).compacted).toBe(true);

    fillSessionPastThreshold(session.id);
    const second = compactSession(session.id, ROLE);
    expect(second.compacted).toBe(true);

    const stored = getSqlite()
      .prepare("select compaction_count as count, rolling_summary as summary from agent_sessions where id = ?")
      .get(session.id) as { count: number; summary: string } | undefined;
    expect(stored?.count).toBe(2);
    // The second summary keeps the first, so the earliest part of the day is
    // not dropped when the middle of the day is folded.
    expect(stored?.summary).toContain("Earlier in the conversation");
  });
});

/* ==========================================================================
   Assembling a request
   ========================================================================== */

describe("assembling a request", () => {
  it("keeps the verbatim transcript inside the token budget", () => {
    const session = getOrCreateSession(USER, ROLE);
    fillSessionPastThreshold(session.id);

    const assembled = assembleContext(session.id, ROLE);
    const transcriptTokens = assembled.transcript.reduce(
      (sum, message) => sum + estimateTokens(message.content),
      0,
    );

    expect(transcriptTokens).toBeLessThanOrEqual(CONTEXT_BUDGET.transcriptTokens);
    expect(assembled.transcript.length).toBeGreaterThan(0);
    expect(assembled.system.length).toBeGreaterThan(0);
  });

  it("keeps the most recent turns, not the first ones", () => {
    const session = getOrCreateSession(USER, ROLE);
    const appended = fillSessionPastThreshold(session.id);

    const assembled = assembleContext(session.id, ROLE);
    const last = assembled.transcript[assembled.transcript.length - 1];
    expect(last?.content).toContain(`Turn ${appended}:`);
    expect(assembled.transcript.some((message) => message.content.includes("Turn 1:"))).toBe(false);
  });

  it("puts the structured state in the system block, where truncation cannot reach it", async () => {
    setMoment("11:45");
    await recordDecisionAndExecute({
      decisionId: RCSA_DECISION_ID,
      optionId: RCSA_OPTION_ID,
      rationale: RATIONALE,
      rationaleConfirmed: true,
    });

    const session = getOrCreateSession(USER, ROLE);
    fillSessionPastThreshold(session.id);
    compactSession(session.id, ROLE);

    const assembled = assembleContext(session.id, ROLE);
    expect(assembled.system).toContain(RCSA_DECISION_ID);
    expect(assembled.system).toContain(RATIONALE);
    expect(assembled.system).toContain("Rolling summary of earlier conversation");
  });

  it("excludes compacted turns from the verbatim transcript", () => {
    const session = getOrCreateSession(USER, ROLE);
    fillSessionPastThreshold(session.id);
    compactSession(session.id, ROLE);

    const assembled = assembleContext(session.id, ROLE);
    expect(assembled.transcript.length).toBeLessThanOrEqual(
      CONTEXT_BUDGET.alwaysKeepRecentTurns,
    );
  });
});

/* ==========================================================================
   Hybrid retrieval
   ========================================================================== */

/** A term that genuinely appears in the seeded corpus, taken from the corpus. */
function termFromCorpus(): string {
  const rows = getSqlite()
    .prepare("select content from evidence_chunks order by id limit 40")
    .all() as Array<{ content: string }>;

  for (const row of rows) {
    const candidate = row.content
      .split(/[^\p{L}]+/u)
      .find((word) => word.length >= 9 && /^[A-Za-z]+$/.test(word));
    if (candidate) return candidate;
  }
  throw new Error("No distinctive term could be taken from the evidence corpus.");
}

describe("lexical retrieval", () => {
  it("returns hits for a term that genuinely appears in the corpus", () => {
    const term = termFromCorpus();
    const hits = lexicalSearch(term, { limit: 8 });

    expect(hits.length, `no lexical hit for "${term}", which is in the corpus`).toBeGreaterThan(0);

    // Every hit resolves, and at least one genuinely contains the term. The
    // porter stemmer can match a variant, so the whole result set is checked
    // rather than every row individually.
    const ids = hits.map((hit) => hit.chunkId);
    const contents = getSqlite()
      .prepare(
        `select id, content from evidence_chunks where id in (${ids.map(() => "?").join(",")})`,
      )
      .all(...ids) as Array<{ id: string; content: string }>;

    expect(contents.length).toBe(ids.length);
    expect(
      contents.some((row) => row.content.toLowerCase().includes(term.toLowerCase().slice(0, 6))),
      `none of the hits for "${term}" contains it`,
    ).toBe(true);
  });

  it("returns nothing for a term that appears nowhere", () => {
    expect(lexicalSearch("zwxqvplmndjkrfghbt", { limit: 8 })).toStrictEqual([]);
    expect(lexicalSearch("frobnicatorquux", { limit: 8 })).toStrictEqual([]);
  });

  it("returns nothing rather than throwing for a query of only stop words", () => {
    expect(lexicalSearch("the and for", { limit: 8 })).toStrictEqual([]);
    expect(lexicalSearch("", { limit: 8 })).toStrictEqual([]);
  });

  it("survives a query containing full text search operators", () => {
    // An unescaped quote or a NEAR in a practitioner's question would be a
    // syntax error against the index, and a search that throws in front of an
    // audience is worse than one that returns nothing.
    for (const query of [
      'what does "independent secondary review" require?',
      "override AND NOT review",
      "control* NEAR/3 deficiency",
      "reviewer's identifier (compared on identifier)",
    ]) {
      expect(() => lexicalSearch(query, { limit: 5 })).not.toThrow();
    }
  });
});

describe("hybrid retrieval", () => {
  it("degrades to lexical retrieval without throwing when semantic search is skipped", async () => {
    const term = termFromCorpus();
    const hits = await searchEvidence(term, { limit: 6, allowSemantic: false });

    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      // No embedding was computed, so there is no semantic score to blend.
      expect(hit.semanticScore).toBeNull();
      expect(hit.score).toBe(hit.lexicalScore);
      expect(hit.documentReference.length).toBeGreaterThan(0);
      expect(hit.provenance.length).toBeGreaterThan(0);
      expect(hit.locator.length).toBeGreaterThan(0);
    }
  });

  it("orders results by score, highest first", async () => {
    const hits = await searchEvidence(termFromCorpus(), { limit: 6, allowSemantic: false });
    for (let i = 1; i < hits.length; i += 1) {
      const previous = hits[i - 1];
      const current = hits[i];
      if (!previous || !current) continue;
      expect(previous.score).toBeGreaterThanOrEqual(current.score);
    }
  });

  it("will not retrieve evidence that has not arrived yet", async () => {
    // A professional cannot search a document that reaches them at 14:05 while
    // the clock reads 07:45. Otherwise the timeline is decorative.
    const hits = await searchEvidence(termFromCorpus(), {
      limit: 20,
      allowSemantic: false,
      atMoment: "07:45",
    });

    const revealed = new Map(
      (
        getSqlite()
          .prepare("select id, revealed_at_moment as revealedAtMoment from evidence_documents")
          .all() as Array<{ id: string; revealedAtMoment: string }>
      ).map((row) => [row.id, row.revealedAtMoment]),
    );

    for (const hit of hits) {
      const moment = revealed.get(hit.documentId) ?? "00:00";
      expect(
        momentToMinutes(moment),
        `${hit.documentId} is revealed at ${moment} but was returned at 07:45`,
      ).toBeLessThanOrEqual(momentToMinutes("07:45"));
    }
  });

  it("returns nothing for a nonsense query even in hybrid mode", async () => {
    expect(await searchEvidence("zwxqvplmndjkrfghbt", { allowSemantic: false })).toStrictEqual([]);
  });

  it("reports source coverage from the documents that actually exist", () => {
    const real = (
      getSqlite().prepare("select id from evidence_documents limit 3").all() as Array<{
        id: string;
      }>
    ).map((row) => row.id);
    expect(real.length).toBe(3);

    expect(sourceCoverage([real])).toBe(1);
    expect(sourceCoverage([["EVD-does-not-exist"]])).toBe(0);
    expect(sourceCoverage([real, ["EVD-does-not-exist"]])).toBe(0.5);
    expect(sourceCoverage([])).toBe(0);
  });
});
