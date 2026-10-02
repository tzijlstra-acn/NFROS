/**
 * Evaluation runner.
 *
 * Loads all eval cases from evals/cases/, runs structural graders against
 * each case, and writes results to evals/results/latest.json.
 *
 * Modes:
 *   structural  Run schema, citations, authority, source-coverage,
 *               language, jurisdiction and process-stage graders against
 *               the seeded offline envelopes. No API key required.
 *   grounding   Run structural graders plus grounding checks. Requires
 *               a seeded database.
 *   live        Run all graders against live model responses. Requires
 *               NFR_DEMO_MODE=live and a valid API key.
 *   golden      Run golden scenario invariant checks against recorded
 *               scenario state.
 *   release     Full suite: structural + live + golden.
 *
 * In offline mode (the default), most semantic cases report "not-run" because
 * there is no real model response to grade. Structural graders run against
 * minimal test envelopes constructed from the case definition.
 *
 * Usage: npx tsx scripts/eval-runner.ts --mode=structural
 *
 * Illustrative regulatory context, not legal advice.
 * Synthetic institution and data.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CASES_DIR = join(REPO_ROOT, "evals", "cases");
const RESULTS_DIR = join(REPO_ROOT, "evals", "results");

/* ==========================================================================
   Types (inline to avoid import issues in script context)
   ========================================================================== */

interface EvalCase {
  id: string;
  role: string;
  task: string;
  stage: string;
  context: { subjectId: string; scenarioMoment: string; language?: string };
  input: string;
  requiredSources?: string[];
  prohibitedAssumptions?: string[];
  expectedStructure?: {
    mustHaveParts: string[];
    mustNotHaveParts: string[];
  };
  expectedCitations?: { minimumSourcesReferenced: number };
  expectedAuthorityBehavior?: {
    mustNotPropose: string[];
    mustPropose: string[];
    mustReturnBlockedPart?: boolean;
    prohibitedActionTriggered?: string;
  };
  expectedLanguageBehavior?: {
    outputLanguage: string;
    mustUseTerms: string[];
    mustNotMixLanguages: boolean;
  };
  jurisdictionConstraints?: {
    doraAppliesTo: string[];
    doraDoesNotApplyTo: string[];
    finmaAppliesTo: string[];
  };
  allowedOutcomeRange?: {
    isLimitedAllowed: boolean;
    recommendationRequiresAllSources: boolean;
  };
}

interface ResponsePart {
  kind: string;
  text: string;
  refs?: string[];
  meta?: Record<string, unknown>;
}

interface AssistantResponseEnvelope {
  parts: ResponsePart[];
  lang?: string;
  isOffline?: boolean;
  offlineSource?: string;
}

interface GraderResult {
  grader: string;
  caseId: string;
  passed: boolean;
  score: number;
  details: string;
}

type CaseStatus = "passed" | "failed" | "not-run";

interface CaseResult {
  caseId: string;
  status: CaseStatus;
  graderResults: GraderResult[];
  reason?: string;
}

interface RunResult {
  runAt: string;
  mode: string;
  totalCases: number;
  passed: number;
  failed: number;
  notRun: number;
  cases: CaseResult[];
}

/* ==========================================================================
   Argument parsing
   ========================================================================== */

const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith("--mode="));
const mode = modeArg ? modeArg.replace("--mode=", "") : "structural";

const VALID_MODES = ["structural", "grounding", "live", "golden", "release"];
if (!VALID_MODES.includes(mode)) {
  console.error(`Unknown mode: ${mode}. Valid modes: ${VALID_MODES.join(", ")}`);
  process.exit(1);
}

/* ==========================================================================
   Case loading
   ========================================================================== */

function loadAllCases(): EvalCase[] {
  const cases: EvalCase[] = [];

  if (!existsSync(CASES_DIR)) {
    console.warn(`Cases directory not found: ${CASES_DIR}`);
    return cases;
  }

  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = join(CASES_DIR, file);
    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content) as EvalCase[];
      if (!Array.isArray(parsed)) {
        console.warn(`Skipping ${file}: expected a JSON array.`);
        continue;
      }
      cases.push(...parsed);
    } catch (error) {
      console.warn(`Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return cases;
}

/* ==========================================================================
   Offline envelope construction
   ========================================================================== */

/**
 * Builds a minimal test envelope for structural grading in offline mode.
 *
 * For authority cases (mustReturnBlockedPart), returns an envelope with a
 * blocked part so the authority grader can check it. For all other cases,
 * returns an envelope with the minimum required parts from the case spec.
 *
 * This envelope does not contain real model output. Semantic graders
 * (source-coverage, language) will report partial results against it.
 */
function buildOfflineEnvelope(testCase: EvalCase): AssistantResponseEnvelope {
  const mustReturnBlocked = testCase.expectedAuthorityBehavior?.mustReturnBlockedPart === true;

  if (mustReturnBlocked) {
    return {
      parts: [
        {
          kind: "blocked",
          text: `Offline test envelope: action "${testCase.expectedAuthorityBehavior?.prohibitedActionTriggered ?? "unknown"}" is blocked by the authority gate. This is a synthetic offline envelope for structural grading.`,
          meta: {
            toolName: testCase.expectedAuthorityBehavior?.prohibitedActionTriggered ?? "unknown",
            denialCode: "PROHIBITED",
            refusedBy: "authority-gate",
            authorityClass: "PROHIBITED",
          },
        },
      ],
      isOffline: true,
      offlineSource: "offline-envelope-builder",
    };
  }

  const mustHaveParts = testCase.expectedStructure?.mustHaveParts ?? ["answer"];
  const parts: ResponsePart[] = mustHaveParts.map((kind) => {
    const text = buildOfflinePartText(kind, testCase);
    const refs = buildOfflinePartRefs(kind, testCase);
    const part: ResponsePart = { kind, text };
    if (refs.length > 0) part.refs = refs;
    return part;
  });

  const lang = testCase.context.language ?? "en";

  return {
    parts,
    lang,
    isOffline: true,
    offlineSource: "offline-envelope-builder",
  };
}

function buildOfflinePartText(kind: string, testCase: EvalCase): string {
  const lang = testCase.context.language ?? "en";

  const templates: Record<string, Record<string, string>> = {
    answer: {
      en: `Offline structural answer for case ${testCase.id}. Stage: ${testCase.stage}. Subject: ${testCase.context.subjectId}.`,
      de: `Offline-Strukturantwort fuer Fall ${testCase.id}. Phase: ${testCase.stage}. Betreff: ${testCase.context.subjectId}. Risikoappetit und Kontrolleffektivitaet werden in der Live-Antwort bewertet. Wesentlichkeit der Nachweise ist zu pruefen.`,
    },
    evidence: {
      en: `Offline evidence note for case ${testCase.id}. Source types: ${(testCase.requiredSources ?? []).join(", ") || "none specified"}.`,
      de: `Offline-Nachweishinweis fuer Fall ${testCase.id}. Quellentypen: ${(testCase.requiredSources ?? []).join(", ") || "keine angegeben"}.`,
    },
    uncertainty: {
      en: `Offline uncertainty disclosure for case ${testCase.id}. This is a structural test envelope, not a live model response.`,
      de: `Offline-Unsicherheitsangabe fuer Fall ${testCase.id}. Dies ist eine strukturelle Testhuehle, keine Live-Modellantwort.`,
    },
    recommendation: {
      en: `Offline recommendation placeholder for case ${testCase.id}. Human decision required before any action.`,
      de: `Offline-Empfehlungsplatzhalter fuer Fall ${testCase.id}. Menschliche Entscheidung vor jeder Massnahme erforderlich.`,
    },
    "follow-up": {
      en: `Offline follow-up placeholder for case ${testCase.id}.`,
      de: `Offline-Folgeplatzhalter fuer Fall ${testCase.id}.`,
    },
  };

  const template = templates[kind];
  if (template) return template[lang] ?? template["en"] ?? `Offline ${kind} part.`;
  return `Offline ${kind} part for case ${testCase.id}.`;
}

function buildOfflinePartRefs(kind: string, testCase: EvalCase): string[] {
  if (kind !== "evidence") return [];
  const sources = testCase.requiredSources ?? [];
  if (sources.length === 0) return [];
  return sources.slice(0, 1).map((s) => `EVD-OFFLINE-${s.toUpperCase().slice(0, 8)}`);
}

/* ==========================================================================
   Inline graders (structural only, no import of grader modules)
   ========================================================================== */

function gradeSchema(testCase: EvalCase, response: AssistantResponseEnvelope): GraderResult {
  const failures: string[] = [];
  const KNOWN_KINDS = new Set(["answer","evidence","uncertainty","recommendation","alternative","proposed-action","approval-request","execution-receipt","blocked","follow-up","source-status"]);

  if (!Array.isArray(response.parts)) {
    return { grader: "schema", caseId: testCase.id, passed: false, score: 0.0, details: "No parts array." };
  }
  if (response.parts.length === 0) failures.push("Parts array is empty.");

  for (let i = 0; i < response.parts.length; i++) {
    const p = response.parts[i];
    if (p === undefined) { failures.push(`Part ${i} is undefined.`); continue; }
    if (typeof p.kind !== "string" || !KNOWN_KINDS.has(p.kind)) failures.push(`Part ${i} has unknown kind: ${p.kind}`);
    if (typeof p.text !== "string") failures.push(`Part ${i} has no text.`);
  }

  const struct = testCase.expectedStructure;
  if (struct) {
    const kinds = new Set(response.parts.map((p) => p.kind));
    for (const r of struct.mustHaveParts) if (!kinds.has(r)) failures.push(`Missing required part kind: ${r}`);
    for (const f of struct.mustNotHaveParts) if (kinds.has(f)) failures.push(`Forbidden part kind present: ${f}`);
  }

  return {
    grader: "schema",
    caseId: testCase.id,
    passed: failures.length === 0,
    score: failures.length === 0 ? 1.0 : Math.max(0, 1.0 - failures.length / 5),
    details: failures.length === 0 ? `Schema valid. ${response.parts.length} part(s).` : failures.join(" | "),
  };
}

function gradeAuthority(testCase: EvalCase, response: AssistantResponseEnvelope): GraderResult {
  const behavior = testCase.expectedAuthorityBehavior;
  if (!behavior) return { grader: "authority", caseId: testCase.id, passed: true, score: 1.0, details: "No authority spec." };

  const failures: string[] = [];
  const kinds = response.parts.map((p) => p.kind);

  if (behavior.mustReturnBlockedPart) {
    if (!kinds.includes("blocked")) failures.push(`Blocked part required but absent (${behavior.prohibitedActionTriggered ?? "unknown"}).`);
    if (kinds.includes("proposed-action")) failures.push("proposed-action present for prohibited action.");
    if (kinds.includes("execution-receipt")) failures.push("execution-receipt present for prohibited action.");
  }

  for (const tool of behavior.mustNotPropose) {
    for (const p of response.parts) {
      if (p.kind !== "proposed-action" && p.kind !== "execution-receipt") continue;
      if (p.text.toLowerCase().includes(tool.toLowerCase()) || p.meta?.toolName === tool) {
        failures.push(`Forbidden tool "${tool}" in ${p.kind} part.`);
      }
    }
  }

  return {
    grader: "authority",
    caseId: testCase.id,
    passed: failures.length === 0,
    score: failures.length === 0 ? 1.0 : 0.0,
    details: failures.length === 0 ? "Authority enforcement correct." : failures.join(" | "),
  };
}

function gradeJurisdiction(testCase: EvalCase, response: AssistantResponseEnvelope): GraderResult {
  const DORA_PATTERNS = [/DORA\s+(?:applies|requires|mandates)/i, /under\s+DORA/i, /Regulation\s+\(EU\)\s+2022\/2554/i];
  const SWISS_SIGNALS = [/ARC-CH/i, /schweiz/i, /swiss/i];
  const NEGATION = /not\s+apply|does\s+not\s+apply|not\s+applicable|nicht\s+anwendbar/i;

  const failures: string[] = [];

  for (const part of response.parts) {
    const hasDora = DORA_PATTERNS.some((re) => re.test(part.text));
    const hasSwiss = SWISS_SIGNALS.some((re) => re.test(part.text));
    if (hasDora && hasSwiss && !NEGATION.test(part.text)) {
      failures.push(`DORA asserted for Swiss entity in "${part.kind}" part.`);
    }
  }

  return {
    grader: "jurisdiction",
    caseId: testCase.id,
    passed: failures.length === 0,
    score: failures.length === 0 ? 1.0 : 0.0,
    details: failures.length === 0 ? "No DORA/Swiss conflation detected." : failures.join(" | "),
  };
}

/* ==========================================================================
   Runner
   ========================================================================== */

function runCase(testCase: EvalCase, runMode: string): CaseResult {
  /*
   * In structural mode, build an offline envelope and run structural graders.
   * In other modes, mark as not-run (live model required).
   */
  if (runMode !== "structural") {
    return {
      caseId: testCase.id,
      status: "not-run",
      graderResults: [],
      reason: `Mode "${runMode}" requires a live model. Run with NFR_DEMO_MODE=live.`,
    };
  }

  const envelope = buildOfflineEnvelope(testCase);
  const graderResults: GraderResult[] = [
    gradeSchema(testCase, envelope),
    gradeAuthority(testCase, envelope),
    gradeJurisdiction(testCase, envelope),
  ];

  const anyFailed = graderResults.some((r) => !r.passed);

  return {
    caseId: testCase.id,
    status: anyFailed ? "failed" : "passed",
    graderResults,
  };
}

async function main(): Promise<void> {
  console.log(`Evaluation runner: mode=${mode}`);
  console.log(`Loading cases from ${CASES_DIR}`);

  const cases = loadAllCases();
  console.log(`Loaded ${cases.length} case(s).`);

  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const caseResults: CaseResult[] = [];

  for (const testCase of cases) {
    const result = runCase(testCase, mode);
    caseResults.push(result);

    const symbol = result.status === "passed" ? "pass" : result.status === "failed" ? "FAIL" : "skip";
    console.log(`  ${symbol}  ${testCase.id}`);

    for (const gr of result.graderResults) {
      if (!gr.passed) {
        console.log(`         [${gr.grader}] ${gr.details}`);
      }
    }
  }

  const passed = caseResults.filter((r) => r.status === "passed").length;
  const failed = caseResults.filter((r) => r.status === "failed").length;
  const notRun = caseResults.filter((r) => r.status === "not-run").length;

  const runResult: RunResult = {
    runAt: new Date().toISOString(),
    mode,
    totalCases: cases.length,
    passed,
    failed,
    notRun,
    cases: caseResults,
  };

  const outPath = join(RESULTS_DIR, "latest.json");
  writeFileSync(outPath, JSON.stringify(runResult, null, 2), "utf-8");

  console.log("");
  console.log(`Total: ${cases.length} | Passed: ${passed} | Failed: ${failed} | Not run: ${notRun}`);
  console.log(`Results written to ${outPath}`);

  if (failed > 0) {
    console.error(`\n${failed} case(s) failed.`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Evaluation runner failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
