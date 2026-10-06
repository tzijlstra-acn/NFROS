/**
 * The evaluation harness, as the Product Owner Console runs it (plan 7.5).
 *
 * The same harness as `npm run eval:structural`: the case files in
 * `evals/cases/` and the grader modules in `evals/graders/`, imported here
 * rather than copied, so the console and the command line grade with the
 * same code. The console never calls a model, in any demo mode. It offers
 * the two modes that need none:
 *
 *   structural (Offline)   a synthetic test envelope built from each case,
 *                          graded by the structural graders (schema,
 *                          authority, jurisdiction). The same envelope rule
 *                          and graders as `scripts/eval-runner.ts
 *                          --mode=structural`. It proves the graders and the
 *                          case files agree; it proves nothing about model
 *                          output, and the console says so (Simulated).
 *
 *   grounding (Safe)       what the product itself answers in safe mode, with
 *                          no model: the authority gate's decision when the
 *                          case asks for an action the Partner recognises, or
 *                          the reviewed answer the Partner gives to that
 *                          question. Graded by all seven graders plus a
 *                          grounding check: every identifier the answer
 *                          cites must exist in the seeded scenario. A case no
 *                          reviewed answer covers is recorded as not run,
 *                          with that reason, because grading it would need a
 *                          model call.
 *
 * Latency and cost are recorded as null in both modes. No model is called, so
 * there is nothing to measure, and the console shows "Not measured" rather
 * than a zero.
 *
 * Mandatory cases. A case is mandatory when its failure would breach a rule
 * this product never weakens: a prohibited action must be refused (the case
 * requires a blocked part) and DORA is never applied to the Swiss entity (the
 * case carries jurisdiction constraints). A configuration cannot be released
 * while a mandatory case fails (`gate.ts`).
 *
 * Server only: it reads the case files and the seeded scenario. It writes
 * nothing; `api.ts` records the run.
 *
 * Illustrative regulatory context, not legal advice. Synthetic institution and data.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AIConfigurationVersion } from "@/ai/prompt-registry";
import type { AutonomyLevel, RoleId } from "@/db/schema/core";
import type { EvaluationGraderResult } from "@/db/schema/product-console";
import type { NewAIEvaluationCaseResult } from "@/db/repositories/ai-evaluations";
import { detectRequestedTool } from "@/agents/chat/service";
import { matchSeededChatAnswer } from "@/agents/chat/seeded";
import { collectKnownIdentifiers } from "@/agents/evaluations/suite";
import { evaluateAuthority, TOOL_REGISTRY } from "@/server/security/authority";
import type {
  AssistantResponseEnvelope,
  EvalCase,
  GraderResult,
  ResponsePart,
} from "../../../../evals/graders/types";
import { grade as gradeSchema } from "../../../../evals/graders/schema";
import { grade as gradeAuthority } from "../../../../evals/graders/authority";
import { grade as gradeJurisdiction } from "../../../../evals/graders/jurisdiction";
import { grade as gradeCitations } from "../../../../evals/graders/citations";
import { grade as gradeSourceCoverage } from "../../../../evals/graders/source-coverage";
import { grade as gradeLanguage } from "../../../../evals/graders/language";
import { grade as gradeProcessStage } from "../../../../evals/graders/process-stage";

/** The console's two modes, as `ai_evaluation_runs.mode` records them. */
export const CONSOLE_EVALUATION_MODES = ["structural", "grounding"] as const;
export type ConsoleEvaluationMode = (typeof CONSOLE_EVALUATION_MODES)[number];

export function isConsoleEvaluationMode(value: unknown): value is ConsoleEvaluationMode {
  return value === "structural" || value === "grounding";
}

/** Which graders each mode runs. */
export const GRADERS_BY_MODE: Record<ConsoleEvaluationMode, readonly string[]> = {
  structural: ["schema", "authority", "jurisdiction"],
  grounding: ["schema", "authority", "jurisdiction", "citations", "source-coverage", "language", "process-stage", "grounding"],
};

/** Where a graded output came from. */
export type CaseOutputSource = "structural-envelope" | "authority-gate" | "reviewed-answer";

/** What `output` holds on a stored case result. */
export interface StoredCaseOutput {
  source: CaseOutputSource;
  lang: string | null;
  parts: ResponsePart[];
}

/* ==========================================================================
   Cases
   ========================================================================== */

/** Every case in `evals/cases/`, in file order. A file that does not parse is skipped. */
export function loadEvaluationCases(root: string = process.cwd()): EvalCase[] {
  const dir = join(root, "evals", "cases");
  if (!existsSync(dir)) return [];
  const cases: EvalCase[] = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      if (Array.isArray(parsed)) cases.push(...(parsed as EvalCase[]));
    } catch {
      /* An unreadable case file grades nothing, and is not evidence of a pass. */
    }
  }
  return cases;
}

/**
 * The cases that grade a configuration: those of its role. No case file is
 * grouped under a suite identifier (the settings page says the same), so the
 * honest scope of a suite is every case its role declares.
 */
export function casesForConfiguration(configuration: Pick<AIConfigurationVersion, "roleId">, cases: readonly EvalCase[]): EvalCase[] {
  return cases.filter((testCase) => testCase.role === configuration.roleId);
}

/** Whether a case is mandatory for release. */
export function isMandatoryCase(testCase: EvalCase): boolean {
  return testCase.expectedAuthorityBehavior?.mustReturnBlockedPart === true || testCase.jurisdictionConstraints !== undefined;
}

export function findEvaluationCase(caseId: string, root?: string): EvalCase | undefined {
  return loadEvaluationCases(root).find((testCase) => testCase.id === caseId);
}

/* ==========================================================================
   Outputs
   ========================================================================== */

/**
 * The structural test envelope, built from the case definition alone. The
 * rule `scripts/eval-runner.ts` applies in structural mode: a blocked part for
 * a case that requires one, otherwise one part of each required kind.
 */
export function structuralEnvelope(testCase: EvalCase): AssistantResponseEnvelope {
  const behaviour = testCase.expectedAuthorityBehavior;
  if (behaviour?.mustReturnBlockedPart === true) {
    const tool = behaviour.prohibitedActionTriggered ?? "unknown";
    return {
      parts: [
        {
          kind: "blocked",
          text: `Offline test envelope: action "${tool}" is blocked by the authority gate. This is a synthetic offline envelope for structural grading.`,
          meta: { toolName: tool, denialCode: "PROHIBITED", refusedBy: "authority-gate", authorityClass: "PROHIBITED" },
        },
      ],
      isOffline: true,
      offlineSource: "offline-envelope-builder",
    };
  }
  const lang = testCase.context.language ?? "en";
  const parts = (testCase.expectedStructure?.mustHaveParts ?? ["answer"]).map((kind): ResponsePart => {
    const part: ResponsePart = { kind, text: structuralText(kind, testCase, lang) };
    const sources = testCase.requiredSources ?? [];
    if (kind === "evidence" && sources.length > 0) {
      part.refs = sources.slice(0, 1).map((source) => `EVD-OFFLINE-${source.toUpperCase().slice(0, 8)}`);
    }
    return part;
  });
  return { parts, lang, isOffline: true, offlineSource: "offline-envelope-builder" };
}

function structuralText(kind: string, testCase: EvalCase, lang: string): string {
  const sources = (testCase.requiredSources ?? []).join(", ");
  const de = lang === "de";
  switch (kind) {
    case "answer":
      return de
        ? `Offline-Strukturantwort fuer Fall ${testCase.id}. Phase: ${testCase.stage}. Betreff: ${testCase.context.subjectId}. Risikoappetit und Kontrolleffektivitaet werden in der Live-Antwort bewertet. Wesentlichkeit der Nachweise ist zu pruefen.`
        : `Offline structural answer for case ${testCase.id}. Stage: ${testCase.stage}. Subject: ${testCase.context.subjectId}.`;
    case "evidence":
      return de
        ? `Offline-Nachweishinweis fuer Fall ${testCase.id}. Quellentypen: ${sources || "keine angegeben"}.`
        : `Offline evidence note for case ${testCase.id}. Source types: ${sources || "none specified"}.`;
    case "uncertainty":
      return de
        ? `Offline-Unsicherheitsangabe fuer Fall ${testCase.id}. Dies ist eine strukturelle Testhuehle, keine Live-Modellantwort.`
        : `Offline uncertainty disclosure for case ${testCase.id}. This is a structural test envelope, not a live model response.`;
    case "recommendation":
      return de
        ? `Offline-Empfehlungsplatzhalter fuer Fall ${testCase.id}. Menschliche Entscheidung vor jeder Massnahme erforderlich.`
        : `Offline recommendation placeholder for case ${testCase.id}. Human decision required before any action.`;
    default:
      return `Offline ${kind} part for case ${testCase.id}.`;
  }
}

/**
 * What the product answers to a case in safe mode, without a model. Null
 * when no reviewed response covers it.
 */
export function safeModeOutput(
  testCase: EvalCase,
  autonomyLevel: AutonomyLevel,
): { source: CaseOutputSource; envelope: AssistantResponseEnvelope } | { source: null; reason: string } {
  const lang = testCase.context.language === "de" ? "de" : "en";
  const roleId = testCase.role as RoleId;

  /* An action request goes to the authority gate, as the Partner sends it. */
  const intent = detectRequestedTool(testCase.input);
  if (intent) {
    const decision = evaluateAuthority({
      toolName: intent.toolName,
      roleId,
      autonomyLevel,
      payload: intent.payload,
      approval: null,
      actingUserId: "evaluation",
    });
    const authorityClass = TOOL_REGISTRY[intent.toolName]?.authorityClass ?? "";
    if (!decision.allowed && decision.code !== "approval-missing") {
      return {
        source: "authority-gate",
        envelope: {
          lang,
          parts: [
            { kind: "answer", text: "That request was not carried out. The decision was made by the deterministic authority gate." },
            {
              kind: "blocked",
              text: decision.reason,
              meta: { toolName: intent.toolName, denialCode: decision.code, refusedBy: "authority-gate", authorityClass },
            },
          ],
        },
      };
    }
    if (!decision.allowed) {
      return {
        source: "authority-gate",
        envelope: {
          lang,
          parts: [
            { kind: "answer", text: "The change was prepared and not carried out. It needs an approval from a named person." },
            { kind: "approval-request", text: decision.reason, meta: { toolName: intent.toolName, authorityClass } },
          ],
        },
      };
    }
    return {
      source: null,
      reason: `The request maps to ${intent.toolName}, which the gate would let run. The console does not execute tools, so the case is not graded here.`,
    };
  }

  /* A question the Partner has a reviewed answer for. */
  const reviewed = matchSeededChatAnswer(testCase.input, roleId);
  if (reviewed) {
    const parts = (lang === "de" ? reviewed.de : reviewed.en).map(
      (part): ResponsePart => ({
        kind: part.kind,
        text: part.text,
        ...(part.refs && part.refs.length > 0 ? { refs: [...part.refs] } : {}),
        ...(part.meta ? { meta: { ...part.meta } } : {}),
      }),
    );
    return { source: "reviewed-answer", envelope: { lang, parts } };
  }

  return {
    source: null,
    reason: "No reviewed answer covers this case and no action request was recognised. Grading it needs a model call, which the console never makes.",
  };
}

/* ==========================================================================
   Grading
   ========================================================================== */

/** The identifier pattern the citations grader and the structural suite share. */
const IDENTIFIER_PATTERN =
  /\b(?:EVD|CTL|TST|RSK|TP|CTR|INC|OBL|MSN|KRI|PRC|ITOL|DEC|IBS|SVC|CMT|AG|REG|EXC|UTC|P)-[0-9A-Za-z.-]+/g;

/**
 * Grounding: every identifier the output cites exists in the seeded
 * scenario. An invented identifier is a hallucination wearing the costume of
 * a source, so one is enough to fail. Trailing punctuation is stripped first,
 * as `gradeGroundedAnswer` does, so a sentence ending in an identifier is not
 * reported as invented.
 */
export function gradeGrounding(testCase: EvalCase, envelope: AssistantResponseEnvelope, known: ReadonlySet<string>): GraderResult {
  const cited = new Set<string>();
  for (const part of envelope.parts) {
    for (const raw of [...(part.text.match(IDENTIFIER_PATTERN) ?? []), ...(part.refs ?? [])]) {
      const id = raw.replace(/[.,;:)\]}]+$/, "");
      if (id.length > 0) cited.add(id);
    }
  }
  const unknown = [...cited].filter((id) => !known.has(id));
  return {
    grader: "grounding",
    caseId: testCase.id,
    passed: unknown.length === 0,
    score: cited.size === 0 ? 1 : (cited.size - unknown.length) / cited.size,
    details:
      unknown.length === 0
        ? `${cited.size} cited identifier(s), all present in the seeded scenario.`
        : `Cited identifier(s) not in the seeded scenario: ${unknown.join(", ")}.`,
  };
}

function runGraders(
  mode: ConsoleEvaluationMode,
  testCase: EvalCase,
  envelope: AssistantResponseEnvelope,
  known: ReadonlySet<string>,
): GraderResult[] {
  const results = [gradeSchema(testCase, envelope), gradeAuthority(testCase, envelope), gradeJurisdiction(testCase, envelope)];
  if (mode === "grounding") {
    results.push(
      gradeCitations(testCase, envelope),
      gradeSourceCoverage(testCase, envelope),
      gradeLanguage(testCase, envelope),
      gradeProcessStage(testCase, envelope),
      gradeGrounding(testCase, envelope, known),
    );
  }
  return results;
}

export interface HarnessOptions {
  mode: ConsoleEvaluationMode;
  autonomyLevel: AutonomyLevel;
  /** The scenario run the grounding check reads identifiers from. */
  runId: string;
  /** The cases to grade. Defaults to the case files. */
  cases?: readonly EvalCase[];
  /**
   * Replaces the output for a case. For tests only: it lets a test grade an
   * output that fails, which no shipped case produces today.
   */
  outputOverride?: (testCase: EvalCase) => AssistantResponseEnvelope | null;
}

/** Grades a configuration's cases. Pure over its inputs apart from reading the scenario's identifiers. */
export function gradeConfiguration(
  configuration: Pick<AIConfigurationVersion, "roleId" | "taskKind">,
  options: HarnessOptions,
): NewAIEvaluationCaseResult[] {
  const cases = casesForConfiguration(configuration, options.cases ?? loadEvaluationCases());
  const known = options.mode === "grounding" ? collectKnownIdentifiers(options.runId) : new Set<string>();

  return cases.map((testCase) => {
    const base = {
      id: `${testCase.id}`,
      caseId: testCase.id,
      roleId: testCase.role,
      taskKind: testCase.task,
      stageId: testCase.stage ?? null,
      language: testCase.context.language ?? "en",
      mandatory: isMandatoryCase(testCase),
      latencyMs: null,
      costUsd: null,
    };

    const override = options.outputOverride?.(testCase) ?? null;
    let source: CaseOutputSource;
    let envelope: AssistantResponseEnvelope;
    if (override) {
      source = options.mode === "structural" ? "structural-envelope" : "reviewed-answer";
      envelope = override;
    } else if (options.mode === "structural") {
      source = "structural-envelope";
      envelope = structuralEnvelope(testCase);
    } else {
      const safe = safeModeOutput(testCase, options.autonomyLevel);
      if (safe.source === null) {
        return {
          ...base,
          status: "not-run" as const,
          graderResults: [],
          reason: safe.reason,
          outputDigest: null,
          output: null,
        };
      }
      source = safe.source;
      envelope = safe.envelope;
    }

    const graderResults: EvaluationGraderResult[] = runGraders(options.mode, testCase, envelope, known).map((result) => ({
      grader: result.grader,
      passed: result.passed,
      score: result.score,
      details: result.details,
    }));
    const failed = graderResults.find((result) => !result.passed);
    const output: StoredCaseOutput = { source, lang: envelope.lang ?? null, parts: envelope.parts };
    return {
      ...base,
      status: failed ? ("failed" as const) : ("passed" as const),
      graderResults,
      reason: failed ? `${failed.grader}: ${failed.details}` : "",
      outputDigest: createHash("sha256").update(JSON.stringify(envelope.parts)).digest("hex").slice(0, 16),
      output: output as unknown as Record<string, unknown>,
    };
  });
}
