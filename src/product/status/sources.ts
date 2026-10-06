/**
 * Where each product status comes from.
 *
 * Server only. Every function here reads something real (the database, the
 * runtime AI configuration, the recorded evaluation run, the audit chain) and
 * returns a reading in the product vocabulary, with the sentence that
 * justifies it. No function returns "verified" without having run the check
 * it names, and a check that cannot run returns "unavailable" or "not
 * verified" rather than a default.
 *
 * The settings area and the operations console render these readings and
 * decide nothing themselves. That keeps the route files thin and keeps one
 * answer to "is this verified" across every screen that asks.
 *
 * Nothing here returns, logs or formats a credential. The AI reading is built
 * from `getPublicHealth`, which carries whether a key was resolved and never
 * anything about its value.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getSqlite } from "@/db/client";
import { CHAIN_SCOPE, verifyChain, type ChainVerificationResult } from "@/audit/verify-chain";
import { checkDatabaseHealth, checkWorkerHealth } from "@/health/service";
import { getProductMode } from "@/identity/product-mode";
import { getPublicHealth } from "@/server/config/runtime";
import { getScenarioState } from "@/scenario/engine/state";
import { listConnectors } from "@/integrations/runtime/IntegrationRuntime";
import type { ConnectorMode } from "@/db/schema/integration";
import type { Language } from "@/i18n/labels";
import {
  overallStatus,
  reading,
  statusForAuditChain,
  statusForConnectorMode,
  type ProductStatus,
  type StatusReading,
} from "./vocabulary";

type Bilingual = { en: string; de: string };

/* ==========================================================================
   Language
   ========================================================================== */

/**
 * The scenario language, or English when there is no scenario to ask.
 *
 * The administrator area follows the same language switch as the workday, so
 * a German demonstration does not drop into English the moment somebody opens
 * the operations console.
 */
export function readAdminLanguage(): Language {
  try {
    return getScenarioState()?.language === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

/* ==========================================================================
   AI mode and verification
   ========================================================================== */

export interface AiModeReading {
  mode: StatusReading;
  verification: StatusReading;
  /** Whether a usable key was resolved. Never anything about the key itself. */
  keyResolved: boolean;
  requestedMode: "live" | "safe" | "offline";
  downgraded: boolean;
}

/**
 * The AI mode the product is running in, and whether the provider is known
 * to accept calls.
 *
 * Two readings, because they answer different questions. The mode is a fact
 * about configuration. Verification is a fact about the provider, and it is
 * only Verified once a real call has been accepted in this server process:
 * a resolved key can still be revoked, expired or wrong.
 */
export function readAiMode(): AiModeReading {
  const health = getPublicHealth();
  const keyResolved = health.liveAiConfigured;

  const downgradeEn = health.modeDowngraded
    ? `${capitalise(health.requestedMode)} mode was requested and could not be honoured. `
    : "";
  const downgradeDe = health.modeDowngraded
    ? `Der Modus ${capitalise(health.requestedMode)} wurde angefordert und konnte nicht eingehalten werden. `
    : "";

  let mode: StatusReading;
  switch (health.mode) {
    case "live":
      mode = reading(
        "live",
        `${downgradeEn}The live provider answers every AI step.`,
        `${downgradeDe}Der Live-Anbieter beantwortet jeden KI-Schritt.`,
      );
      break;
    case "offline":
      mode = reading(
        "offline",
        `${downgradeEn}No AI provider is called. Every response comes from seeded content.`,
        `${downgradeDe}Es wird kein KI-Anbieter aufgerufen. Jede Antwort stammt aus eingespielten Inhalten.`,
      );
      break;
    case "safe":
      mode = keyResolved
        ? reading(
            "safe",
            `${downgradeEn}Critical steps use reviewed, cached responses. Optional questions may call the live provider.`,
            `${downgradeDe}Kritische Schritte nutzen gepruefte, zwischengespeicherte Antworten. Optionale Fragen koennen den Live-Anbieter aufrufen.`,
          )
        : reading(
            "safe",
            `${downgradeEn}Critical steps use reviewed, cached responses. No key was resolved, so optional questions are unavailable.`,
            `${downgradeDe}Kritische Schritte nutzen gepruefte, zwischengespeicherte Antworten. Es wurde kein Schluessel gefunden, daher sind optionale Fragen nicht verfuegbar.`,
          );
      break;
  }

  let verification: StatusReading;
  if (health.liveAiVerified === true) {
    verification = reading(
      "verified",
      "A live call was accepted by the provider in this server process.",
      "Ein Live-Aufruf wurde in diesem Serverprozess vom Anbieter angenommen.",
    );
  } else if (health.liveAiVerified === false) {
    verification = reading(
      "not-verified",
      "The last live call in this server process was rejected by the provider.",
      "Der letzte Live-Aufruf in diesem Serverprozess wurde vom Anbieter abgelehnt.",
    );
  } else if (health.mode === "offline") {
    verification = reading(
      "not-verified",
      "Offline mode makes no call, so the provider is not checked.",
      "Der Offline-Modus ruft nichts auf, daher wird der Anbieter nicht geprueft.",
    );
  } else if (!keyResolved) {
    verification = reading(
      "not-verified",
      "No usable key was resolved, so no live call can be made.",
      "Es wurde kein nutzbarer Schluessel gefunden, daher ist kein Live-Aufruf moeglich.",
    );
  } else {
    verification = reading(
      "not-verified",
      "A key was resolved and no live call has been made in this server process. Run npm run smoke:live to check the provider.",
      "Ein Schluessel wurde gefunden, in diesem Serverprozess gab es aber noch keinen Live-Aufruf. Mit npm run smoke:live laesst sich der Anbieter pruefen.",
    );
  }

  return {
    mode,
    verification,
    keyResolved,
    requestedMode: health.requestedMode,
    downgraded: health.modeDowngraded,
  };
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ==========================================================================
   Audit integrity
   ========================================================================== */

export interface AuditIntegrityReading {
  /** Whether the chain records recompute. */
  chain: StatusReading;
  /** Whether the audit trail is in the chain at all. */
  coverage: StatusReading;
  /** Null when the chain could not be read. */
  result: ChainVerificationResult | null;
  auditEventCount: number | null;
  chainedEventCount: number | null;
}

/**
 * The audit chain, verified on this request, and how much of the audit trail
 * it covers.
 *
 * Coverage is the half that was missing. The chain verifying says the chain
 * records are intact. It says nothing about an audit event that was never put
 * into the chain, and in this build the audit service writes events without
 * appending chain records, so only the seeded events are chained. A screen
 * that showed only the first half would let "Verified" stand for the whole
 * audit trail.
 */
export function readAuditIntegrity(runId?: string): AuditIntegrityReading {
  let result: ChainVerificationResult | null = null;
  let chain: StatusReading;
  try {
    result = verifyChain(CHAIN_SCOPE);
    const status = statusForAuditChain(result.status);
    chain =
      result.status === "valid"
        ? reading(
            status,
            `${result.totalRecords} chain records recomputed on this request. Every hash matches.`,
            `${result.totalRecords} Kettenelemente bei dieser Anfrage neu berechnet. Jeder Hash stimmt ueberein.`,
          )
        : result.status === "broken"
          ? reading(
              status,
              `The chain is broken at sequence ${String(result.firstFailureSequence)}. Records verify through sequence ${result.verifiedThrough}.`,
              `Die Kette ist bei Sequenz ${String(result.firstFailureSequence)} unterbrochen. Elemente sind bis Sequenz ${result.verifiedThrough} verifiziert.`,
            )
          : reading(
              status,
              "No chain records have been written yet.",
              "Es wurden noch keine Kettenelemente geschrieben.",
            );
  } catch {
    chain = reading(
      "unavailable",
      "The audit chain table could not be read. Run npm run db:migrate.",
      "Die Tabelle der Audit-Kette konnte nicht gelesen werden. Fuehren Sie npm run db:migrate aus.",
    );
  }

  let auditEventCount: number | null = null;
  let chainedEventCount: number | null = null;
  let coverage: StatusReading;
  try {
    const scopeRun = runId ?? safeRunId();
    const total = getSqlite()
      .prepare("SELECT count(*) AS n FROM audit_events WHERE run_id = ?")
      .get(scopeRun) as { n: number } | undefined;
    const chained = getSqlite()
      .prepare(
        "SELECT count(*) AS n FROM audit_events e WHERE e.run_id = ? AND EXISTS (SELECT 1 FROM audit_chain_records c WHERE c.audit_event_id = e.id AND c.chain_scope = ?)",
      )
      .get(scopeRun, CHAIN_SCOPE) as { n: number } | undefined;
    auditEventCount = total?.n ?? 0;
    chainedEventCount = chained?.n ?? 0;
    coverage = coverageReading(chainedEventCount, auditEventCount);
  } catch {
    coverage = reading(
      "unavailable",
      "The audit trail could not be read, so its coverage is unknown.",
      "Der Audit-Trail konnte nicht gelesen werden, daher ist seine Abdeckung unbekannt.",
    );
  }

  return { chain, coverage, result, auditEventCount, chainedEventCount };
}

/** Coverage of the audit trail by the chain, as a reading. Pure. */
export function coverageReading(chained: number, total: number): StatusReading {
  if (total === 0) {
    return reading("empty", "No audit events are recorded yet.", "Es sind noch keine Audit-Ereignisse erfasst.");
  }
  if (chained >= total) {
    return reading(
      "verified",
      `All ${total} audit events are in the chain.`,
      `Alle ${total} Audit-Ereignisse sind in der Kette.`,
    );
  }
  return reading(
    "not-verified",
    `${chained} of ${total} audit events are in the chain. Events written after the seed are not appended to the chain in this build, so their integrity is not verified.`,
    `${chained} von ${total} Audit-Ereignissen sind in der Kette. Nach dem Einspielen geschriebene Ereignisse werden in diesem Build nicht an die Kette angehaengt, ihre Integritaet ist daher nicht verifiziert.`,
  );
}

function safeRunId(): string {
  try {
    return getScenarioState()?.runId ?? "run-001";
  } catch {
    return "run-001";
  }
}

/* ==========================================================================
   Evaluation evidence
   ========================================================================== */

/** The subset of `evals/results/latest.json` this module reads. */
export interface RecordedEvaluationRun {
  runAt: string;
  mode: string;
  totalCases: number;
  passed: number;
  failed: number;
  notRun: number;
  cases: Array<{ caseId: string; status: string }>;
}

export interface EvaluationTally {
  cases: number;
  passed: number;
  failed: number;
  notRun: number;
}

export interface EvaluationEvidence {
  recorded: boolean;
  runAt: string | null;
  mode: string | null;
  totals: EvaluationTally;
  byRole: Record<string, EvaluationTally>;
  /** Whether the grading harness itself ran and passed. */
  harness: StatusReading;
  /** Whether the quality of model output is verified. */
  modelOutput: StatusReading;
}

const EMPTY_TALLY: EvaluationTally = { cases: 0, passed: 0, failed: 0, notRun: 0 };

/**
 * What a recorded evaluation run proves. Pure, so the rules can be tested.
 *
 * The structural mode grades synthetic envelopes that the runner builds from
 * each case definition. A pass there proves the graders and the case files
 * agree, which is worth knowing, and it proves nothing about a model. So a
 * structural run is Simulated for the harness and Not verified for model
 * output, however many cases pass. Only a non-structural run in which every
 * case ran and none failed is Verified.
 */
export function summariseEvaluationRun(
  run: RecordedEvaluationRun | null,
  caseRoles: ReadonlyMap<string, string>,
): EvaluationEvidence {
  if (run === null) {
    const none = reading(
      "not-verified",
      "No evaluation run is recorded in this environment. Run npm run eval:structural to record one.",
      "In dieser Umgebung ist kein Evaluationslauf erfasst. Mit npm run eval:structural wird einer erfasst.",
    );
    return {
      recorded: false,
      runAt: null,
      mode: null,
      totals: { ...EMPTY_TALLY },
      byRole: {},
      harness: none,
      modelOutput: none,
    };
  }

  const byRole: Record<string, EvaluationTally> = {};
  for (const entry of run.cases) {
    const role = caseRoles.get(entry.caseId) ?? "unassigned";
    const tally = byRole[role] ?? { ...EMPTY_TALLY };
    tally.cases += 1;
    if (entry.status === "passed") tally.passed += 1;
    else if (entry.status === "failed") tally.failed += 1;
    else tally.notRun += 1;
    byRole[role] = tally;
  }

  const totals: EvaluationTally = {
    cases: run.totalCases,
    passed: run.passed,
    failed: run.failed,
    notRun: run.notRun,
  };

  const structural = run.mode === "structural";
  const harness: StatusReading =
    run.failed > 0
      ? reading(
          "not-verified",
          `${run.failed} of ${run.totalCases} cases failed in the ${run.mode} run.`,
          `${run.failed} von ${run.totalCases} Faellen sind im Lauf ${run.mode} fehlgeschlagen.`,
        )
      : structural
        ? reading(
            "simulated",
            `${run.passed} of ${run.totalCases} cases passed against synthetic test envelopes built from each case.`,
            `${run.passed} von ${run.totalCases} Faellen gegen synthetische Testhuellen bestanden, die aus jedem Fall erzeugt werden.`,
          )
        : run.notRun > 0
          ? reading(
              "not-verified",
              `${run.notRun} of ${run.totalCases} cases did not run in the ${run.mode} run.`,
              `${run.notRun} von ${run.totalCases} Faellen liefen im Lauf ${run.mode} nicht.`,
            )
          : reading(
              "verified",
              `All ${run.totalCases} cases ran and passed in the ${run.mode} run.`,
              `Alle ${run.totalCases} Faelle liefen und bestanden im Lauf ${run.mode}.`,
            );

  const modelOutput: StatusReading =
    !structural && run.failed === 0 && run.notRun === 0 && run.totalCases > 0
      ? reading(
          "verified",
          `Model output was graded in the ${run.mode} run and every case passed.`,
          `Modellausgaben wurden im Lauf ${run.mode} bewertet, und jeder Fall hat bestanden.`,
        )
      : reading(
          "not-verified",
          structural
            ? "The recorded run is structural. No model output was graded."
            : "The recorded run did not grade every case against model output.",
          structural
            ? "Der erfasste Lauf ist strukturell. Es wurden keine Modellausgaben bewertet."
            : "Der erfasste Lauf hat nicht jeden Fall gegen Modellausgaben bewertet.",
        );

  return {
    recorded: true,
    runAt: run.runAt,
    mode: run.mode,
    totals,
    byRole,
    harness,
    modelOutput,
  };
}

/**
 * The same two readings, for the cases of one role. Pure.
 *
 * Used beside each released AI configuration. The configuration names an
 * evaluation suite, and no case file is grouped under that identifier, so the
 * honest scope is the role: every case declares the role it grades.
 */
export function evaluationReadingsForRole(
  evidence: EvaluationEvidence,
  roleId: string,
): { tally: EvaluationTally; harness: StatusReading; modelOutput: StatusReading } {
  const tally = evidence.byRole[roleId] ?? { ...EMPTY_TALLY };
  if (!evidence.recorded) {
    return { tally, harness: evidence.harness, modelOutput: evidence.modelOutput };
  }
  if (tally.cases === 0) {
    const none = reading(
      "not-verified",
      "The recorded run holds no case for this role.",
      "Der erfasste Lauf enthaelt keinen Fall fuer diese Rolle.",
    );
    return { tally, harness: none, modelOutput: none };
  }
  const structural = evidence.mode === "structural";
  const harness =
    tally.failed > 0
      ? reading(
          "not-verified",
          `${tally.failed} of ${tally.cases} cases for this role failed.`,
          `${tally.failed} von ${tally.cases} Faellen fuer diese Rolle sind fehlgeschlagen.`,
        )
      : structural
        ? reading(
            "simulated",
            `${tally.passed} of ${tally.cases} cases for this role passed against synthetic test envelopes.`,
            `${tally.passed} von ${tally.cases} Faellen fuer diese Rolle gegen synthetische Testhuellen bestanden.`,
          )
        : tally.notRun > 0
          ? reading(
              "not-verified",
              `${tally.notRun} of ${tally.cases} cases for this role did not run.`,
              `${tally.notRun} von ${tally.cases} Faellen fuer diese Rolle liefen nicht.`,
            )
          : reading(
              "verified",
              `All ${tally.cases} cases for this role ran and passed.`,
              `Alle ${tally.cases} Faelle fuer diese Rolle liefen und bestanden.`,
            );
  const modelOutput =
    !structural && tally.failed === 0 && tally.notRun === 0
      ? reading(
          "verified",
          "Model output for this role was graded and every case passed.",
          "Modellausgaben fuer diese Rolle wurden bewertet, und jeder Fall hat bestanden.",
        )
      : evidence.modelOutput;
  return { tally, harness, modelOutput };
}

function isRecordedRun(value: unknown): value is RecordedEvaluationRun {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.runAt === "string" &&
    typeof candidate.mode === "string" &&
    typeof candidate.totalCases === "number" &&
    typeof candidate.passed === "number" &&
    typeof candidate.failed === "number" &&
    typeof candidate.notRun === "number" &&
    Array.isArray(candidate.cases)
  );
}

/**
 * Reads the recorded evaluation run and the case files it graded.
 *
 * `evals/results/latest.json` is written by `scripts/eval-runner.ts` and is
 * not committed, so a fresh checkout has none and says so. A file that does
 * not parse is treated the same as a missing one: an unreadable result is not
 * evidence of anything.
 */
export function readEvaluationEvidence(root: string = process.cwd()): EvaluationEvidence {
  let run: RecordedEvaluationRun | null = null;
  try {
    const path = join(root, "evals", "results", "latest.json");
    if (existsSync(path)) {
      const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
      if (isRecordedRun(parsed)) run = parsed;
    }
  } catch {
    run = null;
  }

  const caseRoles = new Map<string, string>();
  try {
    const casesDir = join(root, "evals", "cases");
    if (existsSync(casesDir)) {
      for (const file of readdirSync(casesDir).filter((name) => name.endsWith(".json"))) {
        const parsed: unknown = JSON.parse(readFileSync(join(casesDir, file), "utf-8"));
        if (!Array.isArray(parsed)) continue;
        for (const entry of parsed as Array<{ id?: unknown; role?: unknown }>) {
          if (typeof entry.id === "string" && typeof entry.role === "string") {
            caseRoles.set(entry.id, entry.role);
          }
        }
      }
    }
  } catch {
    /* Roles are a breakdown, not the evidence. Without them every case is unassigned. */
  }

  return summariseEvaluationRun(run, caseRoles);
}

/* ==========================================================================
   Pilot readiness
   ========================================================================== */

export type ReadinessCheckId =
  | "database"
  | "seed-data"
  | "identity-mode"
  | "ai-routines"
  | "audit-chain"
  | "audit-coverage"
  | "active-run";

export interface ReadinessCheck {
  id: ReadinessCheckId;
  label: Bilingual;
  reading: StatusReading;
}

function countRows(sql: string): number | null {
  try {
    const row = getSqlite().prepare(sql).get() as { n: number } | undefined;
    return row?.n ?? 0;
  } catch {
    return null;
  }
}

/** A counted table, as a reading. Null count means the table could not be read. */
export function countReading(
  count: number | null,
  present: (n: number) => Bilingual,
  empty: Bilingual,
  missing: Bilingual,
): StatusReading {
  if (count === null) return reading("unavailable", missing.en, missing.de);
  if (count === 0) return reading("empty", empty.en, empty.de);
  const text = present(count);
  return reading("verified", text.en, text.de);
}

/**
 * The pilot readiness checks.
 *
 * Each one runs on this request. The audit chain check verifies the chain
 * rather than checking that its table exists, and coverage is a check of its
 * own, because a pilot is exactly the setting in which somebody will ask
 * whether the audit trail is protected.
 */
export function runReadinessChecks(): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  const tables = countRows("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'");
  checks.push({
    id: "database",
    label: { en: "Database reachable", de: "Datenbank erreichbar" },
    reading: countReading(
      tables,
      (n) => ({ en: `${n} tables present.`, de: `${n} Tabellen vorhanden.` }),
      {
        en: "The database opens and holds no tables. Run npm run db:migrate and npm run db:seed.",
        de: "Die Datenbank oeffnet sich und enthaelt keine Tabellen. Fuehren Sie npm run db:migrate und npm run db:seed aus.",
      },
      { en: "The database could not be opened.", de: "Die Datenbank konnte nicht geoeffnet werden." },
    ),
  });

  const runs = countRows("SELECT count(*) AS n FROM role_app_runs");
  checks.push({
    id: "seed-data",
    label: { en: "Scenario seeded", de: "Szenario eingespielt" },
    reading: countReading(
      runs,
      (n) => ({ en: `${n} process runs seeded.`, de: `${n} Prozesslaeufe eingespielt.` }),
      { en: "No process runs are seeded. Run npm run db:seed.", de: "Es sind keine Prozesslaeufe eingespielt. Fuehren Sie npm run db:seed aus." },
      { en: "The process run table is missing. Run npm run db:migrate.", de: "Die Tabelle der Prozesslaeufe fehlt. Fuehren Sie npm run db:migrate aus." },
    ),
  });

  const mode = getProductMode();
  const rawMode = process.env["PRODUCT_MODE"] ?? "";
  checks.push({
    id: "identity-mode",
    label: { en: "Identity mode set for a pilot", de: "Identitaetsmodus fuer einen Piloten gesetzt" },
    reading:
      mode === "design-partner"
        ? reading(
            "verified",
            "PRODUCT_MODE is design-partner. Roles are fixed per account.",
            "PRODUCT_MODE ist design-partner. Rollen sind je Konto festgelegt.",
          )
        : mode === "offline-evaluation"
          ? reading(
              "verified",
              "PRODUCT_MODE is offline-evaluation. Sessions are safe to leave unattended.",
              "PRODUCT_MODE ist offline-evaluation. Sitzungen koennen unbeaufsichtigt laufen.",
            )
          : rawMode === ""
            ? reading(
                "not-verified",
                "PRODUCT_MODE is not set, so the product runs in demonstration mode, which is not suitable for a pilot session.",
                "PRODUCT_MODE ist nicht gesetzt, das Produkt laeuft daher im Demonstrationsmodus, der fuer eine Pilotsitzung nicht geeignet ist.",
              )
            : reading(
                "not-verified",
                `PRODUCT_MODE is ${rawMode}, which is not a pilot mode. Set it to design-partner.`,
                `PRODUCT_MODE ist ${rawMode}, das ist kein Pilotmodus. Setzen Sie design-partner.`,
              ),
  });

  const routines = countRows("SELECT count(*) AS n FROM ai_routines");
  checks.push({
    id: "ai-routines",
    label: { en: "AI routines seeded", de: "KI-Routinen eingespielt" },
    reading: countReading(
      routines,
      (n) => ({ en: `${n} AI routines seeded.`, de: `${n} KI-Routinen eingespielt.` }),
      { en: "No AI routines are seeded. Run npm run db:seed.", de: "Es sind keine KI-Routinen eingespielt. Fuehren Sie npm run db:seed aus." },
      { en: "The AI routine table is missing. Run npm run db:migrate.", de: "Die Tabelle der KI-Routinen fehlt. Fuehren Sie npm run db:migrate aus." },
    ),
  });

  const audit = readAuditIntegrity();
  checks.push({
    id: "audit-chain",
    label: { en: "Audit chain intact", de: "Audit-Kette intakt" },
    reading: audit.chain,
  });
  checks.push({
    id: "audit-coverage",
    label: { en: "Audit trail covered by the chain", de: "Audit-Trail von der Kette abgedeckt" },
    reading: audit.coverage,
  });

  const active = countRows("SELECT count(*) AS n FROM role_app_runs WHERE status != 'archived'");
  checks.push({
    id: "active-run",
    label: { en: "At least one process run active", de: "Mindestens ein Prozesslauf aktiv" },
    reading: countReading(
      active,
      (n) => ({ en: `${n} active process runs.`, de: `${n} aktive Prozesslaeufe.` }),
      { en: "No active process run. Run npm run db:seed.", de: "Kein aktiver Prozesslauf. Fuehren Sie npm run db:seed aus." },
      { en: "The process run table is missing. Run npm run db:migrate.", de: "Die Tabelle der Prozesslaeufe fehlt. Fuehren Sie npm run db:migrate aus." },
    ),
  });

  return checks;
}

/**
 * Whether a pilot evidence pack has been generated on this machine.
 *
 * `npm run pilot:evidence-pack` writes `release/pilot-evidence.json`, which is
 * not committed. The settings screen used to link to an API route for the
 * download that does not exist; it now says whether a pack is on disk and
 * when it was produced.
 */
export function readPilotEvidencePack(root: string = process.cwd()): StatusReading & {
  generatedAt: string | null;
} {
  const path = join(root, "release", "pilot-evidence.json");
  try {
    if (!existsSync(path)) {
      return {
        ...reading(
          "empty",
          "No evidence pack has been generated on this machine. Run npm run pilot:evidence-pack.",
          "Auf diesem Rechner wurde noch kein Nachweispaket erzeugt. Fuehren Sie npm run pilot:evidence-pack aus.",
        ),
        generatedAt: null,
      };
    }
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { runDate?: unknown };
    const generatedAt = typeof parsed.runDate === "string" ? parsed.runDate : null;
    return {
      ...reading(
        "not-verified",
        "An evidence pack is on disk. It reflects the state when it was generated, not the checks above.",
        "Ein Nachweispaket liegt vor. Es zeigt den Stand bei seiner Erzeugung, nicht die Pruefungen oben.",
      ),
      generatedAt,
    };
  } catch {
    return {
      ...reading(
        "unavailable",
        "The evidence pack file could not be read.",
        "Die Datei des Nachweispakets konnte nicht gelesen werden.",
      ),
      generatedAt: null,
    };
  }
}

/* ==========================================================================
   System health, for the operations console
   ========================================================================== */

export interface SystemComponentReading {
  id: "database" | "worker" | "audit-chain" | "audit-coverage";
  label: Bilingual;
  reading: StatusReading;
  latencyMs: number | null;
}

export interface SystemHealthReading {
  checkedAt: string;
  overall: ProductStatus;
  components: SystemComponentReading[];
}

/**
 * Component health in the product vocabulary.
 *
 * The overall reading is computed with `overallStatus`, which is stricter
 * than the health endpoint: a worker whose heartbeat nobody checks keeps the
 * whole console at Not verified, because a summary must not be more confident
 * than its least confident part.
 */
export async function readSystemHealth(): Promise<SystemHealthReading> {
  const [database, worker, queue] = await Promise.all([
    checkDatabaseHealth(),
    checkWorkerHealth(),
    readJobQueue(),
  ]);
  const audit = readAuditIntegrity();

  const components: SystemComponentReading[] = [
    {
      id: "database",
      label: { en: "Database", de: "Datenbank" },
      latencyMs: database.latencyMs ?? null,
      reading:
        database.status === "healthy"
          ? reading(
              "verified",
              "Schema present and the scenario seeded, checked on this request.",
              "Schema vorhanden und Szenario eingespielt, bei dieser Anfrage geprueft.",
            )
          : reading(
              "unavailable",
              "The schema is missing or the scenario is not seeded.",
              "Das Schema fehlt oder das Szenario ist nicht eingespielt.",
            ),
    },
    {
      id: "worker",
      label: { en: "Background worker", de: "Hintergrundprozess" },
      latencyMs: null,
      reading:
        worker.status === "not-configured" || !queue.available
          ? reading(
              "unavailable",
              "The background job tables are not present.",
              "Die Tabellen fuer Hintergrundauftraege sind nicht vorhanden.",
            )
          : reading(
              "not-verified",
              `${queue.pending} jobs pending. Whether a worker is running is not checked: there is no heartbeat.`,
              `${queue.pending} Auftraege offen. Ob ein Hintergrundprozess laeuft, wird nicht geprueft: es gibt kein Lebenszeichen.`,
            ),
    },
    {
      id: "audit-chain",
      label: { en: "Audit chain", de: "Audit-Kette" },
      latencyMs: null,
      reading: audit.chain,
    },
    {
      id: "audit-coverage",
      label: { en: "Audit trail coverage", de: "Abdeckung des Audit-Trails" },
      latencyMs: null,
      reading: audit.coverage,
    },
  ];

  return {
    checkedAt: new Date().toISOString(),
    overall: overallStatus(components.map((component) => component.reading.status)),
    components,
  };
}

/* ==========================================================================
   Job queue
   ========================================================================== */

export interface JobQueueReading {
  available: boolean;
  pending: number;
  failed: Array<{ id: string; createdAt: string; status: string; kind: string }>;
}

export async function readJobQueue(): Promise<JobQueueReading> {
  try {
    const repo = await import("@/db/repositories/background-jobs");
    const failed = repo
      .getFailedJobs()
      .slice(-5)
      .map((job) => ({
        id: job.id,
        createdAt: job.createdAt,
        status: job.status,
        kind: job.jobKind,
      }));
    return { available: true, pending: repo.getJobDepth(), failed };
  } catch {
    return { available: false, pending: 0, failed: [] };
  }
}

/* ==========================================================================
   Connectors
   ========================================================================== */

export interface ConnectorStatusCount {
  status: ProductStatus;
  modes: ConnectorMode[];
  count: number;
}

/**
 * Connector instances counted by product status.
 *
 * Read from the instance table, so a connector that is added, removed or
 * switched to live changes the count without anybody editing a screen.
 */
export function readConnectorStatusCounts(): ConnectorStatusCount[] | null {
  try {
    const counts = new Map<ProductStatus, ConnectorStatusCount>();
    for (const instance of listConnectors()) {
      const status = statusForConnectorMode(instance.mode);
      const entry = counts.get(status) ?? { status, modes: [], count: 0 };
      entry.count += 1;
      if (!entry.modes.includes(instance.mode)) entry.modes.push(instance.mode);
      counts.set(status, entry);
    }
    return [...counts.values()];
  } catch {
    return null;
  }
}
