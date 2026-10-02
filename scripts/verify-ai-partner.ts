/**
 * Headless verification of the AI Partner server side.
 *
 * This exists because the live path cannot be exercised in this environment:
 * no usable credential is available, so the safe and offline paths are the
 * ones that carry the product. A suite that only ran under Vitest would be
 * easy to skip in a hurry, so the same assertions are available as one
 * command that exits non-zero.
 *
 * It runs against a disposable database in the system temporary directory and
 * refuses to run against anything inside the repository. The developer's
 * scenario database is what a presenter is about to use, and a verification
 * script that wiped it would be worse than no script.
 *
 * Run with: npx tsx scripts/verify-ai-partner.ts
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { closeDb, getDb, getSqlite, resolveDbPath } from "../src/db/client";
import { seedScenario } from "../src/db/seed/run";
import { DEFAULT_RUN_ID, ROLE_IDS, type RoleId } from "../src/db/schema/core";
import { getEvidenceDocuments } from "../src/db/repositories/workday";
import { AI_STAGE_ORDER } from "../src/workday/contracts";
import { seedAiPartner, seededCoverage } from "../src/agents/suggestions/seed";
import {
  SEEDED_SUGGESTIONS,
  SUGGESTION_BEATS,
  allSeededEvidenceIds,
  allSeededStrings,
  beatForMoment,
} from "../src/agents/suggestions/seeded";
import {
  heldStageShape,
  normaliseForReplay,
  reachedPublication,
  seededStageShape,
  StageRecorder,
  validateStageSequence,
  MIN_TRANSITION_MS,
} from "../src/agents/suggestions/stages";
import {
  computeStateDigest,
  resetSingleFlight,
  singleFlight,
  type SuggestionStateInput,
} from "../src/agents/suggestions/digest";
import {
  REGULATORY_DISCLOSURE,
  findSwissJurisdictionErrors,
  validateSuggestionDraft,
  type SuggestionDraft,
} from "../src/agents/suggestions/validate";

const EM_DASH = String.fromCharCode(0x2014);

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ""): void {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL  ${label}${detail ? `\n          ${detail}` : ""}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/* ==========================================================================
   Disposable database
   ========================================================================== */

let temporaryDirectory: string | null = null;

function openDisposableDatabase(): void {
  closeDb();

  const directory = mkdtempSync(join(tmpdir(), "nfr-verify-ai-partner-"));
  const dbPath = join(directory, "scenario.db");

  const repositoryRoot = resolve(process.cwd());
  if (dbPath.startsWith(repositoryRoot + sep) || !dbPath.startsWith(resolve(tmpdir()))) {
    throw new Error(`Refusing to verify against ${dbPath}, which is not a disposable path.`);
  }

  process.env.NFR_DB_PATH = dbPath;
  if (resolveDbPath() !== dbPath) {
    throw new Error("The client did not resolve the temporary path. Isolation is not in force.");
  }

  migrate(getDb(), { migrationsFolder: "src/db/migrations" });

  // Mirrors `scripts/migrate.ts`. Drizzle does not model virtual tables, and
  // the evidence chunk triggers reference this table by name.
  getSqlite().exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS evidence_chunks_fts USING fts5(
      chunk_id UNINDEXED, document_id UNINDEXED, run_id UNINDEXED,
      locator, content, tokenize = 'porter unicode61'
    );
  `);

  temporaryDirectory = directory;
}

function destroyDisposableDatabase(): void {
  closeDb();
  delete process.env.NFR_DB_PATH;
  if (temporaryDirectory !== null) {
    try {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    } catch {
      // A locked write ahead log on Windows is not worth failing over. The
      // directory sits under the system temporary path.
    }
    temporaryDirectory = null;
  }
}

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

function draftFixture(overrides: Partial<SuggestionDraft> = {}): SuggestionDraft {
  const base: SuggestionDraft = {
    headline: "A short factual headline about the control test result",
    changeSummary: "Four items failed an attribute and two could not be concluded.",
    whyItMatters: "The rate is unknown rather than four in sixty, which changes the conclusion.",
    checksCompleted: ["Read the working paper schedule and recomputed both rates."],
    actionsCompleted: [],
    recommendedAction: "Propose a partially effective rating with the scope limitation stated.",
    recommendedToolName: "proposeControlRating",
    alternatives: ["Conclude on design only and keep the test open."],
    evidenceIds: ["EVD-2026-41850"],
    confidence: 55,
    uncertainty: ["The two unconcludable items may be retrievable."],
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

const KNOWN = new Set(["EVD-2026-41850", "EVD-2026-41852"]);

function validate(draft: SuggestionDraft, constrained = false) {
  return validateSuggestionDraft(draft, {
    knownEvidenceIds: KNOWN,
    constrained,
    entityId: "ARC-DE",
    language: "en",
  });
}

/* ==========================================================================
   Checks
   ========================================================================== */

function verifySeededCoverage(): void {
  section("Seeded coverage");

  const coverage = seededCoverage();
  check("every role has seeded content", coverage.length === ROLE_IDS.length, `found ${coverage.length}`);

  for (const roleId of ROLE_IDS) {
    const entry = coverage.find((candidate) => candidate.roleId === roleId);
    const beats = entry?.beats ?? [];
    check(
      `${roleId} covers all three beats`,
      SUGGESTION_BEATS.every((beat) => beats.includes(beat)),
      `found ${beats.join(", ") || "none"}`,
    );
  }

  check(
    "both languages are present on every card",
    SEEDED_SUGGESTIONS.every(
      (entry) => entry.en.headline.length > 0 && entry.de.headline.length > 0,
    ),
  );

  check(
    "every card names the work object it concerns",
    SEEDED_SUGGESTIONS.every((entry) => entry.objectId.length > 0 && entry.objectLabel.length > 0),
  );

  check(
    "the beat boundaries route every moment of the day",
    beatForMoment("07:45") === "morning" &&
      beatForMoment("10:30") === "morning" &&
      beatForMoment("11:45") === "decision" &&
      beatForMoment("13:30") === "decision" &&
      beatForMoment("14:05") === "shared-event" &&
      beatForMoment("16:30") === "shared-event",
  );
}

function verifySeededCopyRules(): void {
  section("Seeded copy rules");

  const strings = allSeededStrings();
  check("the seeded set has substantial copy", strings.length > 250, `found ${strings.length}`);

  const withEmDash = strings.filter((value) => value.includes(EM_DASH));
  check("no em dash anywhere in the seeded set", withEmDash.length === 0, withEmDash[0] ?? "");

  const umlauts = strings.filter((value) => /[ÄÖÜäöüß]/.test(value));
  check("no umlaut or sharp s in the seeded set", umlauts.length === 0, umlauts[0] ?? "");

  const providerNames = strings.filter((value) =>
    /\b(?:open\s?ai|chat\s?gpt|gpt-|anthropic|claude|gemini|llama|mistral)\b/i.test(value),
  );
  check("no provider or model name in the seeded set", providerNames.length === 0, providerNames[0] ?? "");

  const compliance = strings.filter((value) =>
    /\b(?:is|are|remains?|fully) compliant\b|\bcomplies with\b/i.test(value),
  );
  check("no compliance claim in the seeded set", compliance.length === 0, compliance[0] ?? "");

  const savings = strings.filter((value) => /\bsavings?\b|\bcost reduction\b|\bEinsparung/i.test(value));
  check("no savings claim in the seeded set", savings.length === 0, savings[0] ?? "");

  const swissErrors = findSwissJurisdictionErrors(strings);
  check(
    "the Swiss entity is never associated with a European Union instrument",
    swissErrors.length === 0,
    swissErrors[0] ?? "",
  );

  const regulatoryCards = SEEDED_SUGGESTIONS.filter((entry) =>
    [entry.en, entry.de].some((draft) =>
      /\bDORA\b|\bFINMA\b|\bEBA\b|\bOBL-[0-9]|\bsupervisory (?:authority|notification|expectation|requirement)\b/i.test(
        [draft.headline, draft.changeSummary, draft.whyItMatters, ...draft.uncertainty].join(" "),
      ),
    ),
  );
  check(
    "every card touching regulation carries the disclosure",
    regulatoryCards.every((entry) =>
      [entry.en, entry.de].every((draft) =>
        [draft.headline, draft.changeSummary, draft.whyItMatters, ...draft.uncertainty]
          .join(" ")
          .includes(REGULATORY_DISCLOSURE) ||
        !/\bDORA\b|\bFINMA\b|\bEBA\b|\bOBL-[0-9]|\bsupervisory (?:authority|notification|expectation|requirement)\b/i.test(
          [draft.headline, draft.changeSummary, draft.whyItMatters, ...draft.uncertainty].join(" "),
        ),
      ),
    ),
    `${regulatoryCards.length} card(s) touch regulation`,
  );

  check(
    "no card presents a check as a completed change",
    SEEDED_SUGGESTIONS.every((entry) =>
      [entry.en, entry.de].every((draft) => draft.actionsCompleted.length === 0 || draft.actionsCompleted.every((line) => line.length > 0)),
    ),
  );
}

function verifySeededCitations(): void {
  section("Seeded citations resolve");

  const cited = allSeededEvidenceIds();
  const resolved = new Set(getEvidenceDocuments(cited, DEFAULT_RUN_ID).map((row) => row.id));
  const dangling = cited.filter((id) => !resolved.has(id));

  check(`${cited.length} cited identifier(s) all resolve`, dangling.length === 0, dangling.join(", "));

  check(
    "every card with a recommendation cites at least one document",
    SEEDED_SUGGESTIONS.every((entry) =>
      [entry.en, entry.de].every(
        (draft) => draft.recommendedAction === null || draft.evidenceIds.length > 0,
      ),
    ),
  );

  check(
    "every recommendation names a tool in the authority registry",
    SEEDED_SUGGESTIONS.every((entry) =>
      [entry.en, entry.de].every(
        (draft) => draft.recommendedAction === null || (draft.recommendedToolName ?? "").length > 0,
      ),
    ),
  );
}

async function verifyDedupe(): Promise<void> {
  section("Deduplication");

  const base = baseState();
  check("the same inputs produce the same digest", computeStateDigest(base) === computeStateDigest(base));

  check(
    "evidence order does not change the digest",
    computeStateDigest(base) ===
      computeStateDigest({ ...base, evidenceIds: [...base.evidenceIds].reverse() }),
  );

  check(
    "a changed evidence set changes the digest",
    computeStateDigest(base) !==
      computeStateDigest({ ...base, evidenceIds: [...base.evidenceIds, "EVD-2026-41855"] }),
  );

  check(
    "a changed autonomy level changes the digest",
    computeStateDigest(base) !== computeStateDigest({ ...base, autonomyLevel: "recommend" }),
  );

  check(
    "a changed language changes the digest",
    computeStateDigest(base) !== computeStateDigest({ ...base, language: "de" }),
  );

  check(
    "a changed viewed moment changes the digest",
    computeStateDigest(base) !== computeStateDigest({ ...base, viewedMoment: "14:05" }),
  );

  resetSingleFlight();
  let invocations = 0;
  const work = async () => {
    invocations += 1;
    await new Promise((done) => setTimeout(done, 30));
    return invocations;
  };
  const digest = computeStateDigest(base);
  const [first, second, third] = await Promise.all([
    singleFlight(digest, work),
    singleFlight(digest, work),
    singleFlight(digest, work),
  ]);

  check("three concurrent requests run the work once", invocations === 1, `ran ${invocations} time(s)`);
  check(
    "two of the three report that they joined an existing generation",
    [first, second, third].filter((entry) => entry.joined).length === 2,
  );
  resetSingleFlight();
}

function verifyStageContract(): void {
  section("The three mode stage contract");

  const seeded = seededStageShape();
  const seededCheck = validateStageSequence(seeded);
  check("the offline shape is a legal walk of the state machine", seededCheck.ok, seededCheck.problems.join("; "));
  check("the offline shape reaches publication", reachedPublication(seeded));
  check("the offline shape visits every published stage", seeded.length === AI_STAGE_ORDER.length);

  const replayed = normaliseForReplay(seeded);
  const replayCheck = validateStageSequence(replayed);
  check("the safe replay is the same legal walk", replayCheck.ok, replayCheck.problems.join("; "));
  check(
    "the safe replay never jumps from empty to complete",
    replayed.length > 1 && replayed[0]?.state === "queued",
  );

  // A beat captured instantaneously must still be visible rather than flash.
  const instant = AI_STAGE_ORDER.map((state) => ({
    state,
    label: state,
    labelDe: state,
    atMs: 0,
  }));
  const floored = normaliseForReplay(instant);
  check(
    `an instantaneous capture is floored at ${MIN_TRANSITION_MS}ms per transition`,
    floored.every((stage, index) => stage.atMs >= MIN_TRANSITION_MS * (index + 1)),
  );

  const recorder = new StageRecorder();
  for (const state of AI_STAGE_ORDER) recorder.mark(state);
  const liveCheck = validateStageSequence(recorder.recorded());
  check("the live recording is the same legal walk", liveCheck.ok, liveCheck.problems.join("; "));
  check(
    "the live recording is not padded",
    recorder.recorded().every((stage) => stage.atMs < 1_000),
    "a live request must never be delayed to lengthen an animation",
  );

  const held = heldStageShape("reconciling");
  check("a held progression stops before publication", !reachedPublication(held));
  check(
    "a held progression is still a legal walk",
    validateStageSequence(held).ok,
    validateStageSequence(held).problems.join("; "),
  );
}

function verifyValidationRejections(): void {
  section("Validation rejects what it must");

  check("a well formed draft passes", validate(draftFixture()).ok);

  const invented = validate(draftFixture({ evidenceIds: ["EVD-9999-00000"] }));
  check(
    "an invented evidence identifier is rejected",
    !invented.ok && invented.failures.some((failure) => failure.code === "dangling-evidence"),
  );

  const emDash = validate(
    draftFixture({ headline: `A headline with an em dash ${EM_DASH} in the middle of it` }),
  );
  check("an em dash is rejected", !emDash.ok && emDash.failures.some((f) => f.code === "em-dash"));

  const provider = validate(
    draftFixture({ whyItMatters: "The language model produced this conclusion from the test." }),
  );
  check(
    "a provider or model reference is rejected",
    !provider.ok && provider.failures.some((f) => f.code === "provider-name"),
  );

  const compliance = validate(
    draftFixture({ whyItMatters: "The control is fully compliant with the group standard." }),
  );
  check(
    "a compliance claim is rejected",
    !compliance.ok && compliance.failures.some((f) => f.code === "compliance-claim"),
  );

  const savings = validate(
    draftFixture({ changeSummary: "This approach saves EUR 40,000 of annual review effort." }),
  );
  check(
    "a savings claim is rejected",
    !savings.ok && savings.failures.some((f) => f.code === "savings-claim"),
  );

  const confident = validate(draftFixture({ confidence: 85 }), true);
  check(
    "high confidence while constrained is rejected",
    !confident.ok && confident.failures.some((f) => f.code === "confidence-while-constrained"),
  );

  const unknownTool = validate(draftFixture({ recommendedToolName: "doSomethingClever" }));
  check(
    "a recommendation whose tool is not in the registry is rejected",
    !unknownTool.ok && unknownTool.failures.some((f) => f.code === "unknown-tool"),
  );

  const prohibited = validate(draftFixture({ recommendedToolName: "notifySupervisor" }));
  check(
    "a recommendation naming a prohibited tool is rejected",
    !prohibited.ok && prohibited.failures.some((f) => f.code === "prohibited-tool"),
  );

  const swiss = validate(
    draftFixture({
      whyItMatters:
        "The Swiss entity must meet the DORA requirement on this arrangement. Illustrative regulatory context, not legal advice.",
    }),
  );
  check(
    "the Swiss entity with a European Union instrument is rejected",
    !swiss.ok && swiss.failures.some((f) => f.code === "swiss-dora"),
  );

  const allowed = validate(
    draftFixture({
      whyItMatters:
        "The DORA requirement does not apply to the Swiss entity, which follows the FINMA framework. Illustrative regulatory context, not legal advice.",
    }),
  );
  check("an explicit statement that it does not apply is permitted", allowed.ok);

  const noDisclosure = validate(
    draftFixture({ whyItMatters: "The FINMA expectation bears on this arrangement." }),
  );
  check(
    "a regulatory reference without the disclosure is rejected",
    !noDisclosure.ok && noDisclosure.failures.some((f) => f.code === "missing-disclosure"),
  );

  const uncited = validate(draftFixture({ evidenceIds: [], grounding: { verifiedFacts: [], approvedRecords: [], stakeholderStatements: [], modelInference: [], conflictingEvidence: [] } }));
  check(
    "a recommendation with no citation is rejected",
    !uncited.ok && uncited.failures.some((f) => f.code === "uncited-recommendation"),
  );

  const mislabelled = validate(
    draftFixture({
      grounding: {
        verifiedFacts: [
          {
            statement: "The exception is probably systemic.",
            provenance: "model-inference",
            sourceIds: ["EVD-2026-41850"],
            confidence: 0.6,
          },
        ],
        approvedRecords: [],
        stakeholderStatements: [],
        modelInference: [],
        conflictingEvidence: [],
      },
    }),
  );
  check(
    "an inference filed as a verified fact is rejected",
    !mislabelled.ok && mislabelled.failures.some((f) => f.code === "inference-as-record"),
  );
}

function verifySeedWrites(): void {
  section("The seed writes what it claims");

  const summary = seedAiPartner(DEFAULT_RUN_ID);

  check(
    "a cached beat exists for every role, beat and language",
    summary.cachedBeats === ROLE_IDS.length * SUGGESTION_BEATS.length * 2,
    `wrote ${summary.cachedBeats}`,
  );
  check(
    "a validated morning card exists for every role",
    summary.suggestions === ROLE_IDS.length,
    `wrote ${summary.suggestions}`,
  );
  check("the opening activity stream is populated", summary.activityEntries > 100, `wrote ${summary.activityEntries}`);

  const sqlite = getSqlite();
  const perRole = sqlite
    .prepare(
      "select role_id as roleId, count(*) as n from ai_activity_entries where run_id = ? group by role_id",
    )
    .all(DEFAULT_RUN_ID) as Array<{ roleId: RoleId; n: number }>;
  check(
    "every role has an opening activity stream",
    perRole.length === ROLE_IDS.length,
    `found ${perRole.length} role(s)`,
  );

  const unvalidated = (
    sqlite
      .prepare("select count(*) as n from ai_suggestions where run_id = ? and validated_at is null")
      .get(DEFAULT_RUN_ID) as { n: number }
  ).n;
  check("no unvalidated suggestion was published by the seed", unvalidated === 0, `found ${unvalidated}`);

  // Running it twice must leave the same database, or a reseed doubles the day.
  const second = seedAiPartner(DEFAULT_RUN_ID);
  check(
    "the seed is idempotent",
    second.cachedBeats === summary.cachedBeats &&
      second.suggestions === summary.suggestions &&
      second.activityEntries === summary.activityEntries,
  );

  const totalActivity = (
    sqlite
      .prepare("select count(*) as n from ai_activity_entries where run_id = ?")
      .get(DEFAULT_RUN_ID) as { n: number }
  ).n;
  check(
    "a second seed did not double the activity stream",
    totalActivity === summary.activityEntries,
    `found ${totalActivity} against ${summary.activityEntries}`,
  );
}

/* ==========================================================================
   Main
   ========================================================================== */

async function main(): Promise<void> {
  console.log("Verifying the AI Partner server side.");

  verifySeededCoverage();
  verifySeededCopyRules();
  await verifyDedupe();
  verifyStageContract();

  openDisposableDatabase();
  try {
    seedScenario(DEFAULT_RUN_ID);
    verifySeededCitations();
    verifyValidationRejections();
    verifySeedWrites();
  } finally {
    destroyDisposableDatabase();
  }

  console.log(`\n${checks} check(s) run, ${failures} failure(s).`);
  if (failures > 0) {
    console.error("Verification failed.");
    process.exit(1);
  }
  console.log("Verification passed.");
}

main().catch((error: unknown) => {
  destroyDisposableDatabase();
  console.error("Verification could not complete.", error);
  process.exit(1);
});
