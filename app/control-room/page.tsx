/**
 * The control room.
 *
 * This is the engineering and observability view, and it is the page an
 * enterprise architect or a model risk reviewer will ask for by name. It shows
 * the trace of what actually ran: which agent was invoked, what it delegated,
 * every tool call with its authority class and outcome, what the authority
 * gate refused, what changed in the database, what the run cost, and how each
 * model role was resolved.
 *
 * Two editorial decisions matter here.
 *
 * First, refused and held actions are rendered before anything else. A gate
 * that blocks an action and then buries the record three panels down is
 * indistinguishable, to a reader, from a gate that did nothing. The refusals
 * are the product feature, so they occupy the position of a feature.
 *
 * Second, every figure carries its basis. Token counts and durations are
 * counted from rows and are labelled as measured in this simulation. Cost is
 * derived from an indicative price table held in this repository, so it is
 * labelled illustrative and never presented as a bill.
 *
 * This is also the one home of presenter runtime state. The entry page used
 * to carry AI mode, key state, verification, configuration source, database
 * state, the mode selector, the setup commands and the reset control beside
 * the proposition. All of them now live here, merged into the sections that
 * already reported them rather than repeated, and the entry page links here
 * from its footer.
 */

import Link from "next/link";
import { ModeSelector } from "@/components/shell/ModeSelector";
import { ResetButton } from "@/components/shell/controls";
import { Caveat, KeyValue, ReportSection, ReportShell, SeedNotice } from "@/components/shell/ReportShell";
import { Chip, ObjectId, type Tone } from "@/components/evidence/primitives";
import { ValueMetric } from "@/components/evidence/figures";
import { isDatabaseReady } from "@/db/client";
import { getRoles, getUser } from "@/db/repositories/workday";
import {
  buildDelegationTree,
  formatDuration,
  formatUsd,
  getAgentRuns,
  getAgentSessions,
  getApprovalRows,
  getCachedOutputs,
  getExecutionReceiptLines,
  getMutationEvents,
  getSessionMessageStats,
  getToolCalls,
  summariseTrace,
  type AgentRunRow,
  type ToolCallRow,
} from "@/db/repositories/observability";
import { MODEL_PREFERENCES, type ModelRole } from "@/server/config/models";
import { getPublicHealth, getRuntimeStatus } from "@/server/config/runtime";
import { AUTONOMY_DESCRIPTIONS } from "@/server/security/authority";
import { getScenarioState } from "@/scenario/engine/state";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

const MODEL_ROLES: ModelRole[] = ["primary", "fast", "deep", "realtime", "embedding"];

const MODEL_ROLE_PURPOSE: Record<ModelRole, string> = {
  primary: "Synthesis, challenge preparation and the specialist recommendations.",
  fast: "Briefs, short classifications and interface labels where latency is visible.",
  deep: "Contradiction analysis and cross function impact reasoning.",
  realtime: "Speech to speech meeting simulation. Degrades to the typed fallback.",
  embedding: "Retrieval embeddings over the synthetic evidence corpus.",
};

/**
 * Copy for the presenter runtime and the controls that moved here from the
 * entry page.
 *
 * Bilingual because every string added to the product is, and the runtime
 * section is translated whole so a German session does not read one row in
 * each language. The trace sections below predate that rule and are English
 * only. Mode names (live, safe, offline) are identifiers and stay as they are.
 */
const PRESENTER_COPY = {
  runtimeTitle: { en: "Demonstration mode and runtime", de: "Demonstrationsmodus und Laufzeit" },
  runtimeQuestion: {
    en: "What is running, and was the requested mode honoured?",
    de: "Was laeuft, und wurde der angeforderte Modus eingehalten?",
  },
  runtimeAnswerDowngraded: {
    en: 'The requested mode was "{requested}" and the effective mode is "{mode}". The request was downgraded rather than failed.',
    de: 'Angefordert war der Modus "{requested}", wirksam ist "{mode}". Die Anforderung wurde herabgestuft statt abgelehnt.',
  },
  runtimeAnswerAsRequested: {
    en: 'The effective mode is "{mode}", which is the mode that was requested. No downgrade was applied.',
    de: 'Wirksam ist der Modus "{mode}", wie angefordert. Es wurde nicht herabgestuft.',
  },
  requestedMode: { en: "Requested mode", de: "Angeforderter Modus" },
  effectiveMode: { en: "Effective mode", de: "Wirksamer Modus" },
  downgraded: { en: "Downgraded", de: "Herabgestuft" },
  liveCalls: { en: "Live calls permitted", de: "Live-Aufrufe erlaubt" },
  voice: { en: "Voice", de: "Sprache" },
  voiceAvailable: { en: "available", de: "verfuegbar" },
  voiceTyped: { en: "typed fallback only", de: "nur Texteingabe" },
  keyResolved: { en: "Key resolved", de: "Schluessel gefunden" },
  scenarioSeeded: { en: "Scenario seeded", de: "Szenario geladen" },
  scenarioClock: { en: "Scenario clock", de: "Szenariouhr" },
  actingRole: { en: "Acting role", de: "Handelnde Rolle" },
  autonomy: { en: "Autonomy level in force", de: "Geltende Autonomiestufe" },
  changeMode: { en: "Change the mode", de: "Modus wechseln" },
  whyMode: { en: "Why the mode is what it is", de: "Warum dieser Modus gilt" },
  yes: { en: "true", de: "ja" },
  no: { en: "false", de: "nein" },
  autonomyCaveat: {
    en: "Autonomy level {label}: {detail} This value is read by the authority gate on every call, so changing it changes behaviour rather than wording.",
    de: "Autonomiestufe {label}: {detail} Die Befugnispruefung liest diesen Wert bei jedem Aufruf; eine Aenderung aendert also das Verhalten, nicht nur die Formulierung.",
  },
  keyCaveat: {
    en: "The key is read at runtime from a file outside this repository. This page reports only that a key was resolved and which file supplied it. No part of the value is displayed, logged, exported or sent to the browser, and no length, prefix or masked form of it exists anywhere in this application.",
    de: "Der Schluessel wird zur Laufzeit aus einer Datei ausserhalb dieses Repositorys gelesen. Diese Seite meldet nur, dass ein Schluessel gefunden wurde und welche Datei ihn geliefert hat. Kein Teil des Werts wird angezeigt, protokolliert, exportiert oder an den Browser gesendet, und weder Laenge, Praefix noch eine maskierte Form existieren in dieser Anwendung.",
  },
  liveVerified: { en: "Live AI verified", de: "Live-KI verifiziert" },
  verifiedTrue: { en: "true", de: "ja" },
  verifiedRejected: { en: "key rejected", de: "Schluessel abgelehnt" },
  verifiedNotAttempted: { en: "not yet attempted", de: "noch nicht versucht" },
  configurationSource: { en: "Configuration source", de: "Konfigurationsquelle" },
  setupTitle: { en: "Scenario setup and reset", de: "Szenario einrichten und zuruecksetzen" },
  setupQuestion: {
    en: "Is the scenario in place, and how is it rebuilt?",
    de: "Ist das Szenario geladen, und wie wird es neu aufgebaut?",
  },
  setupAnswerSeeded: {
    en: "The scenario is seeded and the clock stands at {moment}. Resetting discards every decision, approval and audit event recorded in this run and restores the seeded morning.",
    de: "Das Szenario ist geladen und die Uhr steht auf {moment}. Das Zuruecksetzen verwirft alle in diesem Lauf erfassten Entscheidungen, Genehmigungen und Audit-Ereignisse und stellt den geladenen Morgen wieder her.",
  },
  setupAnswerNotSeeded: {
    en: "The scenario has not been seeded. Run the setup commands below in the repository, then reload this page.",
    de: "Das Szenario wurde nicht geladen. Fuehren Sie die folgenden Befehle im Repository aus und laden Sie die Seite neu.",
  },
  setupFirstRun: { en: "First run on a new machine", de: "Erster Start auf einem neuen Rechner" },
  setupRebuild: {
    en: "Rebuild the seeded day from the command line",
    de: "Den geladenen Tag ueber die Kommandozeile neu aufbauen",
  },
  resetInPage: { en: "Reset from this page", de: "Auf dieser Seite zuruecksetzen" },
  resetUnavailable: {
    en: "Unavailable until the scenario is seeded.",
    de: "Nicht verfuegbar, bis das Szenario geladen ist.",
  },
  related: {
    en: "Operational health is reported in {ops}. Product configuration is in {settings}.",
    de: "Der Betriebszustand steht unter {ops}. Die Produktkonfiguration steht unter {settings}.",
  },
  ops: { en: "Operations", de: "Betrieb" },
  settings: { en: "Settings", de: "Einstellungen" },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

function yesNo(value: boolean, language: Language): string {
  return pick(value ? PRESENTER_COPY.yes : PRESENTER_COPY.no, language);
}

/** Replaces `{name}` placeholders. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export default function ControlRoomPage() {
  const runtime = getRuntimeStatus();
  const health = getPublicHealth();
  /*
   * "Seeded" means a scenario run exists, not merely that the tables exist.
   * A migrated but unseeded database has every table and no rows, and
   * reporting that as seeded would show a page of zeros as though they were
   * observations.
   */
  const state = isDatabaseReady() ? getScenarioState() : null;
  const seeded = state !== null;
  const language = (state?.language ?? "en") as Language;

  const status = (
    <>
      <Chip tone={runtime.demoMode.mode === "live" ? "green" : "cyan"}>
        mode {runtime.demoMode.mode}
      </Chip>
      <Chip tone={runtime.demoMode.downgraded ? "amber" : "neutral"}>
        {runtime.demoMode.downgraded ? "downgraded" : "as requested"}
      </Chip>
      <Chip tone={runtime.liveCallsPermitted ? "green" : "neutral"}>
        {runtime.liveCallsPermitted ? "live calls permitted" : "no live calls"}
      </Chip>
    </>
  );

  return (
    <ReportShell
      title="Control room"
      lede="The trace of what ran, what it was allowed to do, what it was refused, what it changed and what it cost."
      active="control-room"
      language={language}
      status={status}
    >
      {/* ------------------------------------------------------------------
          Demonstration mode. Rendered first because every other figure on
          this page depends on which mode produced it.
         ------------------------------------------------------------------ */}
      <ReportSection
        title={pick(PRESENTER_COPY.runtimeTitle, language)}
        question={pick(PRESENTER_COPY.runtimeQuestion, language)}
        answer={fill(
          pick(
            runtime.demoMode.downgraded
              ? PRESENTER_COPY.runtimeAnswerDowngraded
              : PRESENTER_COPY.runtimeAnswerAsRequested,
            language,
          ),
          { requested: runtime.demoMode.requested, mode: runtime.demoMode.mode },
        )}
        tone={runtime.demoMode.downgraded ? "amber" : "cyan"}
      >
        <div className="grid grid-2" data-testid="runtime-state">
          <div className="stack stack-3">
            <KeyValue label={pick(PRESENTER_COPY.requestedMode, language)}>
              <Chip tone="neutral">{runtime.demoMode.requested}</Chip>
            </KeyValue>
            <KeyValue label={pick(PRESENTER_COPY.effectiveMode, language)}>
              <Chip tone={runtime.demoMode.mode === "live" ? "green" : "cyan"}>
                {runtime.demoMode.mode}
              </Chip>
            </KeyValue>
            <KeyValue label={pick(PRESENTER_COPY.downgraded, language)}>
              <Chip tone={runtime.demoMode.downgraded ? "amber" : "neutral"}>
                {yesNo(runtime.demoMode.downgraded, language)}
              </Chip>
            </KeyValue>
            <KeyValue label={pick(PRESENTER_COPY.liveCalls, language)}>
              <Chip tone={runtime.liveCallsPermitted ? "green" : "neutral"}>
                {yesNo(runtime.liveCallsPermitted, language)}
              </Chip>
            </KeyValue>
            <KeyValue label={pick(PRESENTER_COPY.voice, language)}>
              <Chip tone={health.voiceAvailable ? "green" : "neutral"}>
                {pick(health.voiceAvailable ? PRESENTER_COPY.voiceAvailable : PRESENTER_COPY.voiceTyped, language)}
              </Chip>
            </KeyValue>
            <KeyValue label={pick(PRESENTER_COPY.keyResolved, language)}>
              <Chip tone={runtime.openai.configured ? "green" : "amber"}>
                {yesNo(runtime.openai.configured, language)}
              </Chip>
            </KeyValue>
            {/*
              * Configured and verified are different claims. A key can be
              * present and well formed and still be revoked or wrong, and a
              * presenter needs to know which of the two they have.
              */}
            <KeyValue label={pick(PRESENTER_COPY.liveVerified, language)}>
              <Chip
                tone={
                  health.liveAiVerified === null ? "neutral" : health.liveAiVerified ? "green" : "red"
                }
              >
                {pick(
                  health.liveAiVerified === null
                    ? PRESENTER_COPY.verifiedNotAttempted
                    : health.liveAiVerified
                      ? PRESENTER_COPY.verifiedTrue
                      : PRESENTER_COPY.verifiedRejected,
                  language,
                )}
              </Chip>
            </KeyValue>
            <KeyValue label={pick(PRESENTER_COPY.configurationSource, language)}>
              <span className="mono meta">{health.configurationSource}</span>
            </KeyValue>
            <KeyValue label={pick(PRESENTER_COPY.scenarioSeeded, language)}>
              <Chip tone={seeded ? "green" : "red"}>{yesNo(seeded, language)}</Chip>
            </KeyValue>
            {state ? (
              <>
                <KeyValue label={pick(PRESENTER_COPY.scenarioClock, language)}>
                  <span className="mono meta">{state.currentMoment}</span>
                </KeyValue>
                <KeyValue label={pick(PRESENTER_COPY.actingRole, language)}>
                  <span className="mono meta">{state.activeRoleId}</span>
                </KeyValue>
                <KeyValue label={pick(PRESENTER_COPY.autonomy, language)}>
                  <Chip tone="amber">{AUTONOMY_DESCRIPTIONS[state.autonomyLevel].label}</Chip>
                </KeyValue>
              </>
            ) : null}
          </div>

          <div className="stack stack-4">
            <div className="stack stack-2" data-testid="mode-selector">
              <span className="label">{pick(PRESENTER_COPY.changeMode, language)}</span>
              <ModeSelector current={runtime.demoMode.mode} liveAvailable={runtime.openai.configured} />
            </div>
            {runtime.demoMode.reason ? (
              <div className="card card-edge" data-tone="amber">
                <div className="stack stack-2">
                  <span className="label">{pick(PRESENTER_COPY.whyMode, language)}</span>
                  <p style={{ fontSize: "var(--text-sm)" }}>{runtime.demoMode.reason}</p>
                </div>
              </div>
            ) : null}
            {runtime.openai.reason ? (
              <Caveat>{runtime.openai.reason}</Caveat>
            ) : null}
            {runtime.openai.configured ? <Caveat>{health.liveAiConfiguredMeaning}</Caveat> : null}
            {state ? (
              <Caveat>
                {fill(pick(PRESENTER_COPY.autonomyCaveat, language), {
                  label: AUTONOMY_DESCRIPTIONS[state.autonomyLevel].label,
                  detail: AUTONOMY_DESCRIPTIONS[state.autonomyLevel].detail,
                })}
              </Caveat>
            ) : null}
            <Caveat>{pick(PRESENTER_COPY.keyCaveat, language)}</Caveat>
          </div>
        </div>
      </ReportSection>

      {/* ------------------------------------------------------------------
          Scenario setup and reset. Moved here from the entry page, which
          is now the product entrance and carries no presenter controls.
          The commands are shown whether or not the scenario is seeded,
          because a presenter rebuilding a machine needs them either way.
         ------------------------------------------------------------------ */}
      <ReportSection
        title={pick(PRESENTER_COPY.setupTitle, language)}
        question={pick(PRESENTER_COPY.setupQuestion, language)}
        answer={
          state
            ? pick(PRESENTER_COPY.setupAnswerSeeded, language).replace("{moment}", state.currentMoment)
            : pick(PRESENTER_COPY.setupAnswerNotSeeded, language)
        }
        tone={state ? "cyan" : "amber"}
      >
        <div className="grid grid-2">
          <div className="stack stack-3">
            <div className="stack stack-2">
              <span className="label">{pick(PRESENTER_COPY.setupFirstRun, language)}</span>
              <pre
                className="mono"
                data-testid="setup-commands"
                style={{
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-1)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3)",
                  fontSize: "var(--text-sm)",
                  margin: 0,
                }}
              >
                {"npm run db:migrate\nnpm run db:seed"}
              </pre>
            </div>
            <div className="stack stack-2">
              <span className="label">{pick(PRESENTER_COPY.setupRebuild, language)}</span>
              <pre
                className="mono"
                style={{
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-1)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3)",
                  fontSize: "var(--text-sm)",
                  margin: 0,
                }}
              >
                {"npm run demo:reset"}
              </pre>
            </div>
          </div>

          <div className="stack stack-3">
            <div className="stack stack-2" data-testid="reset-control">
              <span className="label">{pick(PRESENTER_COPY.resetInPage, language)}</span>
              {state ? (
                <ResetButton language={language} />
              ) : (
                <p className="meta">{pick(PRESENTER_COPY.resetUnavailable, language)}</p>
              )}
            </div>
            <Caveat>
              <RelatedSurfaces language={language} />
            </Caveat>
          </div>
        </div>
      </ReportSection>

      {/* ------------------------------------------------------------------
          Model configuration. Independent of the database, so it renders
          whether or not the scenario has been seeded.
         ------------------------------------------------------------------ */}
      <ReportSection
        title="Resolved model configuration"
        question="Which model was used for each role, and how was that decided?"
        answer="Each model role is resolved independently: an environment variable wins, otherwise the first model from a documented preference list that the account can actually use, otherwise a stated fallback. The provenance of every choice is shown rather than implied."
      >
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Resolved model per role with the provenance of the choice</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Resolved model</th>
                <th scope="col">Provenance of the choice</th>
                <th scope="col">Preference list, most preferred first</th>
                <th scope="col">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_ROLES.map((role) => {
                const resolved = runtime.models[role];
                const provenance = runtime.models.provenance[role];
                return (
                  <tr key={role}>
                    <th scope="row" className="mono">
                      {role}
                    </th>
                    <td className="mono">
                      {resolved === null ? (
                        <span style={{ color: "var(--amber)" }}>none resolved</span>
                      ) : (
                        resolved
                      )}
                    </td>
                    <td>
                      <Chip tone={provenanceTone(provenance)}>{provenance}</Chip>
                    </td>
                    <td className="mono meta">{MODEL_PREFERENCES[role].join(", ")}</td>
                    <td className="dim">{MODEL_ROLE_PURPOSE[role]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="stack stack-2">
          <KeyValue label="Account model list retrieved">
            <Chip tone={runtime.models.availabilityChecked ? "green" : "amber"}>
              {runtime.models.availabilityChecked ? "true" : "false"}
            </Chip>
          </KeyValue>
          {runtime.models.realtimeDisabledReason ? (
            <Caveat>{runtime.models.realtimeDisabledReason}</Caveat>
          ) : null}
          <Caveat>
            A provenance of &quot;fallback&quot; means the account model list was not retrieved, or
            contained none of the preferred identifiers, and the first preference was used without
            verification. That is a weaker claim than &quot;preference list&quot; and is shown as
            such rather than being flattened into one word.
          </Caveat>
        </div>
      </ReportSection>

      {seeded ? (
        <SeededControlRoom />
      ) : (
        <SeedNotice unavailable="The agent trace, the tool calls, the refusals, the state changes, the session counters and the cost figures are all counted from database rows and are therefore not shown." />
      )}
    </ReportShell>
  );
}

/* ==========================================================================
   The database driven part of the page
   ========================================================================== */

function SeededControlRoom() {
  const runs = getAgentRuns();
  const calls = getToolCalls();
  const totals = summariseTrace(runs, calls);
  const { roots, orphans } = buildDelegationTree(runs);
  const sessions = getAgentSessions();
  const approvalRows = getApprovalRows();
  const mutations = getMutationEvents();
  const receipts = getExecutionReceiptLines();
  const cached = getCachedOutputs();
  const roles = getRoles();

  const held = calls.filter((call) => call.outcome === "proposed");
  const refused = calls.filter((call) => call.outcome === "blocked");
  const failed = calls.filter((call) => call.outcome === "failed");
  const gateEvidence = [...refused, ...held, ...failed];

  return (
    <>
      {/* ---------------- Trace summary ---------------- */}
      <ReportSection
        title="Trace summary"
        question="What did this run actually consume?"
        answer={`${totals.agentRunCount} agent runs and ${totals.toolCallCount} tool calls are recorded for this scenario run. ${totals.blockedCount} tool calls were refused by the authority gate and ${totals.proposedCount} were held for a human approval.`}
      >
        <div className="grid grid-4">
          <ValueMetric
            label="Agent runs"
            value={totals.agentRunCount}
            basis="measured"
            derivation="Row count in agent_runs for this scenario run."
          />
          <ValueMetric
            label="Manager runs"
            value={totals.managerRunCount}
            basis="measured"
            derivation="Agent runs with no parent run identifier."
          />
          <ValueMetric
            label="Delegated specialist runs"
            value={totals.specialistRunCount}
            basis="measured"
            derivation="Agent runs whose parent run identifier is set."
          />
          <ValueMetric
            label="Runs held for approval"
            value={totals.interruptedForApprovalCount}
            basis="measured"
            tone="amber"
            derivation="Agent runs with status interrupted-for-approval."
          />
          <ValueMetric
            label="Tool calls"
            value={totals.toolCallCount}
            basis="measured"
            derivation="Row count in tool_calls for this scenario run."
          />
          <ValueMetric
            label="Refused by the gate"
            value={totals.blockedCount}
            basis="measured"
            tone="red"
            derivation="Tool calls with outcome blocked."
            note="A refusal is recorded, not silent. Each one carries the reason the gate gave."
          />
          <ValueMetric
            label="Held for approval"
            value={totals.proposedCount}
            basis="measured"
            tone="amber"
            derivation="Tool calls with outcome proposed."
          />
          <ValueMetric
            label="Executed"
            value={totals.executedCount}
            basis="measured"
            derivation="Tool calls with outcome executed."
          />
          <ValueMetric
            label="Trace duration, agent runs"
            value={formatDuration(totals.totalDurationMs)}
            basis="measured"
            derivation="Sum of duration_ms across agent runs. Safe mode durations include the simulated latency held with each cached beat."
          />
          <ValueMetric
            label="Longest single run"
            value={formatDuration(totals.longestRunMs)}
            basis="measured"
            derivation="Maximum duration_ms across agent runs."
          />
          <ValueMetric
            label="Input tokens"
            value={totals.inputTokens}
            basis="measured"
            derivation="Sum of input_tokens across agent runs."
          />
          <ValueMetric
            label="Output tokens"
            value={totals.outputTokens}
            basis="measured"
            derivation="Sum of output_tokens across agent runs."
          />
          <ValueMetric
            label="Estimated model cost"
            value={formatUsd(totals.recomputedCostUsd)}
            unit="USD"
            basis="illustrative"
            derivation="Recomputed with estimateCostUsd from the recorded token counts and the indicative price table in src/server/config/models.ts. Published prices change and this application does not read a live price list."
            note="This is an estimate of what these token counts would cost. It is not an invoice and it must not be extrapolated to a production workload."
          />
          <ValueMetric
            label="Cost recorded at run time"
            value={formatUsd(totals.recordedCostUsd)}
            unit="USD"
            basis="illustrative"
            derivation="Sum of the estimated_cost_usd column, written by each run when it executed. Shown alongside the recomputed figure so a divergence between them is visible."
          />
          <ValueMetric
            label="Outputs served from cache"
            value={totals.fromCacheCount}
            basis="measured"
            derivation="Agent runs with from_cache set true."
          />
          <ValueMetric
            label="Outputs from a live call"
            value={totals.liveCallCount}
            basis="measured"
            derivation="Agent runs with from_cache set false."
          />
        </div>

        {totals.byAuthorityClass.length > 0 ? (
          <div className="stack stack-2">
            <span className="label">Tool calls by authority class</span>
            <div className="row row-2 row-wrap">
              {totals.byAuthorityClass.map((entry) => (
                <Chip key={entry.authorityClass} tone={authorityTone(entry.authorityClass)}>
                  {entry.authorityClass} {entry.count}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {totals.byModel.length > 0 ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Token use and estimated cost per model</caption>
              <thead>
                <tr>
                  <th scope="col">Model recorded on the run</th>
                  <th scope="col" className="num">
                    Runs
                  </th>
                  <th scope="col" className="num">
                    Input tokens
                  </th>
                  <th scope="col" className="num">
                    Output tokens
                  </th>
                  <th scope="col" className="num">
                    Estimated cost, USD
                  </th>
                </tr>
              </thead>
              <tbody>
                {totals.byModel.map((entry) => (
                  <tr key={entry.model}>
                    <th scope="row" className="mono">
                      {entry.model}
                    </th>
                    <td className="num">{entry.runs}</td>
                    <td className="num">{entry.inputTokens.toLocaleString("en-GB")}</td>
                    <td className="num">{entry.outputTokens.toLocaleString("en-GB")}</td>
                    <td className="num">{formatUsd(entry.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <Caveat>
          Run counts and token counts are measured in this simulation. Every cost column is
          illustrative: it is the indicative price table in this repository applied to those token
          counts.
        </Caveat>
      </ReportSection>

      {/* ---------------- Refusals first ---------------- */}
      <ReportSection
        title="Refused and held actions"
        question="What did the authority gate stop, and why?"
        answer={
          gateEvidence.length === 0
            ? "No tool call in this run was refused, held or failed. With an empty refusal list this section proves nothing; exercise a material action at a low autonomy level to see the gate act."
            : `${refused.length} calls were refused, ${held.length} were held for a human approval and ${failed.length} failed after passing the gate. Each row below carries the authority class, the autonomy level in force and the reason given.`
        }
        tone={gateEvidence.length === 0 ? "neutral" : "red"}
      >
        {gateEvidence.length === 0 ? (
          <div className="empty-state">
            <span className="label">No refusals recorded</span>
            <p>
              The gate is deterministic and is exercised on every call. An empty list here means no
              call in this run required it to intervene.
            </p>
          </div>
        ) : (
          <div className="stack stack-3">
            {gateEvidence.map((call) => (
              <GateCard key={call.id} call={call} />
            ))}
          </div>
        )}
        <Caveat>
          A refusal is not an error state. The gate is a deterministic function that reads the tool
          registry, the acting role and the autonomy level. It never reads free text, so an
          instruction inside a document, a supplier email or a meeting transcript cannot argue its
          way past it.
        </Caveat>
      </ReportSection>

      {/* ---------------- Delegation ---------------- */}
      <ReportSection
        title="Manager and specialist delegation"
        question="Which agent ran, and what did it delegate?"
        answer={
          roots.length === 0
            ? "No agent run is recorded for this scenario run."
            : `${roots.length} manager runs are recorded, delegating to ${totals.specialistRunCount} specialist runs. The relationship below is read from the parent run identifier on each row, not reconstructed from names.`
        }
      >
        {roots.length === 0 ? (
          <div className="empty-state">
            <span className="label">No agent activity</span>
            <p>Open the workday and use the assistant to produce a trace.</p>
          </div>
        ) : (
          <div className="stack stack-4">
            {roots.map((node) => (
              <div key={node.run.id} className="stack stack-2">
                <AgentRunCard run={node.run} depth={0} />
                {node.children.length > 0 ? (
                  <div className="stack stack-2" style={{ paddingLeft: "var(--space-6)" }}>
                    {node.children.map((child) => (
                      <AgentRunCard key={child.id} run={child} depth={1} />
                    ))}
                  </div>
                ) : (
                  <p className="meta" style={{ paddingLeft: "var(--space-6)" }}>
                    This manager run delegated nothing.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {orphans.length > 0 ? (
          <div className="card card-edge" data-tone="amber">
            <div className="stack stack-2">
              <span className="label">Runs with an unresolved parent</span>
              <p style={{ fontSize: "var(--text-sm)" }}>
                {orphans.length} runs name a parent run that is not present in this run. They are
                listed separately rather than shown as manager runs, because that would misstate
                the delegation structure.
              </p>
              <div className="row row-2 row-wrap">
                {orphans.map((run) => (
                  <ObjectId key={run.id} id={run.id} label={run.agentName} />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="stack stack-2">
          <span className="label">Accountable human per specialist agent</span>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Specialist agent ownership by role</caption>
              <thead>
                <tr>
                  <th scope="col">Function</th>
                  <th scope="col">Specialist agent</th>
                  <th scope="col">Accountable person in the scenario</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const holder = getUser(role.holderUserId);
                  return (
                    <tr key={role.id}>
                      <th scope="row">{role.title}</th>
                      <td className="mono">{role.specialistAgent}</td>
                      <td>
                        {holder ? `${holder.name}, ${holder.jobTitle}` : "not recorded"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </ReportSection>

      {/* ---------------- All tool calls ---------------- */}
      <ReportSection
        title="Every tool call"
        question="What was called, under what authority, and what happened?"
        answer={`${calls.length} tool calls are recorded. Authority class, outcome, duration, the autonomy level in force and the blocked reason where one exists are columns on the row rather than narrative.`}
      >
        {calls.length === 0 ? (
          <div className="empty-state">
            <span className="label">No tool calls</span>
            <p>Nothing has called a governed tool in this scenario run yet.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 620 }}>
            <table className="table">
              <caption className="sr-only">Tool calls with authority class, outcome and reason</caption>
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Authority class</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Autonomy in force</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Arguments, redacted summary</th>
                  <th scope="col">Result or reason</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id}>
                    <th scope="row" className="mono">
                      {call.toolName}
                    </th>
                    <td>
                      <Chip tone={authorityTone(call.authorityClass)}>{call.authorityClass}</Chip>
                    </td>
                    <td>
                      <Chip tone={outcomeTone(call.outcome)}>{call.outcome}</Chip>
                    </td>
                    <td className="mono meta">{call.autonomyLevel}</td>
                    <td className="mono meta">{formatDuration(call.durationMs)}</td>
                    <td className="dim" style={{ maxWidth: 240 }}>
                      {call.argumentSummary}
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      {call.blockedReason ? (
                        <span style={{ color: "var(--red)" }}>{call.blockedReason}</span>
                      ) : (
                        <span className="dim">{call.resultSummary || "no summary recorded"}</span>
                      )}
                    </td>
                    <td className="mono meta">
                      {call.evidenceIds.length === 0 ? "none" : call.evidenceIds.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportSection>

      {/* ---------------- Evidence and approvals ---------------- */}
      <ReportSection
        title="Evidence retrieved and approvals requested"
        question="What did the agents read, and what did they have to ask a person for?"
        answer={`${totals.distinctEvidenceIds.length} distinct evidence documents were returned by tool calls in this run. ${approvalRows.length} approval records exist, of which ${approvalRows.filter((row) => row.consumedAt !== null).length} have been consumed by an execution.`}
      >
        <div className="grid grid-2">
          <div className="stack stack-2">
            <span className="label">Distinct evidence identifiers returned</span>
            {totals.distinctEvidenceIds.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No tool call in this run returned an evidence identifier.
              </p>
            ) : (
              <div className="row row-2 row-wrap">
                {totals.distinctEvidenceIds.map((id) => (
                  <span key={id} className="chip" data-tone="green">
                    {id}
                  </span>
                ))}
              </div>
            )}
            <Caveat>
              Every identifier here is a row in the synthetic evidence corpus and can be opened in
              the workday. A conclusion that cites nothing cites nothing visibly.
            </Caveat>
          </div>

          <div className="stack stack-2">
            <span className="label">Approval records</span>
            {approvalRows.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No approval has been granted in this scenario run.
              </p>
            ) : (
              <div className="stack stack-2">
                {approvalRows.map((row) => (
                  <div key={row.id} className="card card-edge" data-tone={row.consumedAt ? "green" : "amber"}>
                    <div className="stack stack-2">
                      <div className="row row-2 row-wrap row-between">
                        <span className="mono strong-text" style={{ fontSize: "var(--text-sm)" }}>
                          {row.toolName}
                        </span>
                        <Chip tone={row.consumedAt ? "green" : "amber"}>
                          {row.consumedAt ? "consumed" : "unconsumed"}
                        </Chip>
                      </div>
                      <div className="row row-2 row-wrap meta">
                        <span>{row.approvedAtMoment}</span>
                        <span>&middot;</span>
                        <span>{row.roleId}</span>
                        <span>&middot;</span>
                        <span>{row.autonomyLevel}</span>
                        <span>&middot;</span>
                        <span>
                          rationale {row.rationaleConfirmed ? "confirmed" : "not confirmed"}
                        </span>
                      </div>
                      <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                        {row.rationale}
                      </p>
                      <ObjectId id={row.payloadFingerprint} label="payload fingerprint" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ReportSection>

      {/* ---------------- State changes ---------------- */}
      <ReportSection
        title="State changes"
        question="What changed in the database, and can it be reversed?"
        answer={`${mutations.length} audit events of category mutation are recorded, with ${receipts.length} execution receipt lines naming the object that changed. A proposal that was never approved leaves a decision row and no receipt line, which is exactly what an auditor should see.`}
      >
        {mutations.length === 0 ? (
          <div className="empty-state">
            <span className="label">No state change</span>
            <p>Nothing in this scenario run has written to a record through a governed tool.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 520 }}>
            <table className="table">
              <caption className="sr-only">Mutation audit events</caption>
              <thead>
                <tr>
                  <th scope="col">Moment</th>
                  <th scope="col">Action</th>
                  <th scope="col">Object</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Authority class</th>
                  <th scope="col">Reversible</th>
                  <th scope="col">Summary</th>
                </tr>
              </thead>
              <tbody>
                {mutations.map((event) => (
                  <tr key={event.id}>
                    <td className="mono meta">{event.atMoment}</td>
                    <th scope="row" className="mono">
                      {event.action}
                    </th>
                    <td className="mono meta">
                      {event.objectKind} {event.objectId}
                    </td>
                    <td className="meta">{event.actorKind}</td>
                    <td>
                      {event.authorityClass ? (
                        <Chip tone={authorityTone(event.authorityClass)}>{event.authorityClass}</Chip>
                      ) : (
                        <span className="meta">not recorded</span>
                      )}
                    </td>
                    <td>
                      <Chip tone={event.reversible ? "green" : "red"}>
                        {event.reversible ? "reversible" : "not reversible"}
                      </Chip>
                    </td>
                    <td className="dim" style={{ maxWidth: 420 }}>
                      {event.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {receipts.length > 0 ? (
          <div className="stack stack-2">
            <span className="label">Execution receipt lines ({receipts.length})</span>
            <ul className="stack stack-2">
              {receipts.map((line) => (
                <li key={line.id} className="card card-edge" data-tone={line.reversible ? "green" : "amber"}>
                  <div className="stack stack-1">
                    <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                      {line.statement}
                    </span>
                    <div className="row row-2 row-wrap meta">
                      <span>{line.changeKind}</span>
                      <span>&middot;</span>
                      <span>
                        {line.objectKind} {line.objectId}
                      </span>
                      <span>&middot;</span>
                      <span>{line.executedAtMoment}</span>
                      <span>&middot;</span>
                      <span>{line.reversible ? "reversible" : "not reversible"}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ReportSection>

      {/* ---------------- Sessions and compaction ---------------- */}
      <ReportSection
        title="Sessions, compaction and durable context"
        question="How is long running context held without losing what matters?"
        answer={
          sessions.length === 0
            ? "No agent session exists in this scenario run."
            : `${sessions.length} sessions are recorded. Compaction folds older turns into a rolling summary that survives, so the working context does not grow without limit and does not silently drop a decision either.`
        }
      >
        {sessions.length === 0 ? (
          <div className="empty-state">
            <span className="label">No session</span>
            <p>A session is created when a professional first uses the assistant in a role.</p>
          </div>
        ) : (
          <div className="stack stack-4">
            {sessions.map((session) => {
              const messages = getSessionMessageStats(session.id);
              return (
                <div key={session.id} className="card">
                  <div className="stack stack-3">
                    <div className="row row-2 row-wrap row-between">
                      <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                        {session.roleId} session
                      </span>
                      <ObjectId id={session.id} />
                    </div>
                    <div className="grid grid-4">
                      <ValueMetric
                        label="Compaction events"
                        value={session.compactionCount}
                        basis="measured"
                        derivation="The compaction_count column on this session row."
                      />
                      <ValueMetric
                        label="Last compacted"
                        value={session.lastCompactedAt ?? "never"}
                        basis="measured"
                        derivation="The last_compacted_at column on this session row."
                      />
                      <ValueMetric
                        label="Rolling summary length"
                        value={session.rollingSummary.length}
                        unit="characters"
                        basis="measured"
                        derivation="Character length of the rolling_summary column. Shown in characters because a token count of the summary is not recorded."
                      />
                      <ValueMetric
                        label="Turns recorded"
                        value={session.turnCount}
                        basis="measured"
                        derivation="The turn_count column on this session row."
                      />
                      <ValueMetric
                        label="Messages held"
                        value={messages.total}
                        basis="measured"
                        derivation="Row count in agent_messages for this session."
                      />
                      <ValueMetric
                        label="Messages folded into the summary"
                        value={messages.compacted}
                        basis="measured"
                        derivation="Agent messages for this session with compacted set true."
                      />
                      <ValueMetric
                        label="Session input tokens"
                        value={session.totalInputTokens}
                        basis="measured"
                        derivation="The total_input_tokens column on this session row."
                      />
                      <ValueMetric
                        label="Session output tokens"
                        value={session.totalOutputTokens}
                        basis="measured"
                        derivation="The total_output_tokens column on this session row."
                      />
                    </div>
                    {session.rollingSummary.length > 0 ? (
                      <div className="stack stack-1">
                        <span className="label">Rolling summary as held</span>
                        <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
                          {session.rollingSummary}
                        </p>
                      </div>
                    ) : (
                      <p className="meta">No rolling summary has been written for this session.</p>
                    )}
                    {Object.keys(session.workingMemory).length > 0 ? (
                      <div className="stack stack-1">
                        <span className="label">
                          Working memory keys ({Object.keys(session.workingMemory).length})
                        </span>
                        <div className="row row-2 row-wrap">
                          {Object.keys(session.workingMemory).map((key) => (
                            <span key={key} className="chip" data-tone="cyan">
                              {key}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Caveat>
          Working memory is held outside the conversation history on purpose. A fact that the
          professional needs at 16:30 should not depend on whether the turn that produced it
          survived compaction.
        </Caveat>
      </ReportSection>

      {/* ---------------- Cache ---------------- */}
      <ReportSection
        title="Cached against live outputs"
        question="How much of what was shown came from a model call, and how much from cache?"
        answer={`${totals.fromCacheCount} of ${totals.agentRunCount} agent runs were served from cache and ${totals.liveCallCount} came from a live call. ${cached.length} cached beats are held in this run, each validated against a named output schema at seed time.`}
      >
        <div className="grid grid-3">
          <ValueMetric
            label="Cached beats held"
            value={cached.length}
            basis="measured"
            derivation="Row count in cached_ai_outputs for this scenario run."
          />
          <ValueMetric
            label="Cached beats authored by the seed"
            value={cached.filter((row) => row.seeded).length}
            basis="measured"
            derivation="Cached outputs with seeded set true. The remainder were captured from a live model call."
          />
          <ValueMetric
            label="Cached beats captured live"
            value={cached.filter((row) => !row.seeded).length}
            basis="measured"
            derivation="Cached outputs with seeded set false, carrying the model they were captured from."
          />
        </div>

        {cached.length > 0 ? (
          <div className="table-wrap" style={{ maxHeight: 420 }}>
            <table className="table">
              <caption className="sr-only">Cached model outputs</caption>
              <thead>
                <tr>
                  <th scope="col">Beat key</th>
                  <th scope="col">Role</th>
                  <th scope="col">Output schema</th>
                  <th scope="col">Origin</th>
                  <th scope="col">Captured from model</th>
                  <th scope="col" className="num">
                    Simulated latency
                  </th>
                </tr>
              </thead>
              <tbody>
                {cached.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="mono">
                      {row.beatKey}
                    </th>
                    <td className="mono meta">{row.roleId ?? "all roles"}</td>
                    <td className="mono">{row.schemaName}</td>
                    <td>
                      <Chip tone={row.seeded ? "cyan" : "green"}>
                        {row.seeded ? "authored in the seed" : "captured live"}
                      </Chip>
                    </td>
                    <td className="mono meta">{row.capturedFromModel ?? "not applicable"}</td>
                    <td className="num mono">{row.simulatedLatencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <Caveat>
          Presenter safe mode serves the critical beats from this table so the demonstration has
          deterministic timing and content. A cached beat is labelled as cached wherever it appears
          in the interface; it is never passed off as a live call.
        </Caveat>
      </ReportSection>
    </>
  );
}

/* ==========================================================================
   Local components
   ========================================================================== */

/**
 * Links to the adjacent operator surfaces.
 *
 * Linked rather than summarised: operations and settings are owned by their
 * own pages, and a second rendering of their state here would drift.
 */
function RelatedSurfaces({ language }: { language: Language }) {
  const [beforeOps, afterOps = ""] = pick(PRESENTER_COPY.related, language).split("{ops}");
  const [between, afterSettings = ""] = afterOps.split("{settings}");
  return (
    <>
      {beforeOps}
      <Link href="/ops">{pick(PRESENTER_COPY.ops, language)}</Link>
      {between}
      <Link href="/settings">{pick(PRESENTER_COPY.settings, language)}</Link>
      {afterSettings}
    </>
  );
}

/** A refused, held or failed call, rendered at full width with the reason. */
function GateCard({ call }: { call: ToolCallRow }) {
  const tone: Tone = outcomeTone(call.outcome);
  return (
    <div className="card card-edge" data-tone={tone}>
      <div className="stack stack-3">
        <div className="row row-3 row-wrap row-between">
          <div className="row row-2 row-wrap">
            <span className="mono strong-text">{call.toolName}</span>
            <Chip tone={authorityTone(call.authorityClass)}>{call.authorityClass}</Chip>
            <Chip tone={tone}>{call.outcome}</Chip>
          </div>
          <div className="row row-2 row-wrap meta">
            <span>autonomy {call.autonomyLevel}</span>
            <span>&middot;</span>
            <span>{formatDuration(call.durationMs)}</span>
            <span>&middot;</span>
            <span>{call.requestedAt}</span>
          </div>
        </div>

        <div className="stack stack-1">
          <span className="label">What was requested</span>
          <p style={{ fontSize: "var(--text-sm)" }}>{call.argumentSummary}</p>
        </div>

        <div className="stack stack-1">
          <span className="label">
            {call.outcome === "blocked"
              ? "Why the gate refused it"
              : call.outcome === "proposed"
                ? "Why it is held"
                : "What failed"}
          </span>
          <p style={{ fontSize: "var(--text-sm)", color: tone === "red" ? "var(--red)" : "var(--amber)" }}>
            {call.blockedReason ?? call.resultSummary ?? "No reason was recorded, which is itself a defect."}
          </p>
        </div>

        <div className="row row-3 row-wrap meta">
          {call.decisionId ? <span>decision {call.decisionId}</span> : null}
          {call.approvalId ? <span>approval {call.approvalId}</span> : <span>no approval attached</span>}
          <ObjectId id={call.id} />
        </div>
      </div>
    </div>
  );
}

/** One agent run. Indentation carries the delegation relationship. */
function AgentRunCard({ run, depth }: { run: AgentRunRow; depth: number }) {
  return (
    <div
      className="card card-edge"
      data-tone={
        run.status === "failed"
          ? "red"
          : run.status === "interrupted-for-approval"
            ? "amber"
            : depth === 0
              ? "accent"
              : "cyan"
      }
    >
      <div className="stack stack-2">
        <div className="row row-3 row-wrap row-between">
          <div className="row row-2 row-wrap">
            <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
              {run.agentName}
            </span>
            <Chip tone={depth === 0 ? "accent" : "cyan"}>
              {depth === 0 ? "manager" : "delegated specialist"}
            </Chip>
            <Chip tone={run.agentKind === "manager" ? "accent" : "neutral"}>{run.agentKind}</Chip>
            <Chip tone={run.fromCache ? "cyan" : "green"}>
              {run.fromCache ? "from cache" : "live call"}
            </Chip>
            <Chip
              tone={
                run.status === "completed"
                  ? "green"
                  : run.status === "failed"
                    ? "red"
                    : run.status === "interrupted-for-approval"
                      ? "amber"
                      : "neutral"
              }
            >
              {run.status}
            </Chip>
          </div>
          <div className="row row-2 row-wrap meta">
            <span className="mono">{run.model}</span>
            <span>&middot;</span>
            <span>{run.sourceMode}</span>
            <span>&middot;</span>
            <span>{formatDuration(run.durationMs)}</span>
          </div>
        </div>

        <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
          {run.task}
        </p>

        <div className="row row-3 row-wrap meta">
          <span>in {run.inputTokens.toLocaleString("en-GB")} tokens</span>
          <span>out {run.outputTokens.toLocaleString("en-GB")} tokens</span>
          <span>cost estimate {formatUsd(run.estimatedCostUsd)} USD, illustrative</span>
          {run.outputSchema ? <span>schema {run.outputSchema}</span> : null}
          <ObjectId id={run.id} />
          {run.parentRunId ? <ObjectId id={run.parentRunId} label="delegated by" /> : null}
        </div>

        {run.guardrailTriggered ? (
          <div className="stack stack-1">
            <span className="label" style={{ color: "var(--red)" }}>
              Guardrail triggered
            </span>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--red)" }}>
              {run.guardrailNote ?? "No note was recorded."}
            </p>
          </div>
        ) : null}

        {run.errorSummary ? (
          <div className="stack stack-1">
            <span className="label" style={{ color: "var(--red)" }}>
              Error
            </span>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--red)" }}>{run.errorSummary}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ==========================================================================
   Tone mapping
   ========================================================================== */

function outcomeTone(outcome: string): Tone {
  switch (outcome) {
    case "executed":
      return "green";
    case "proposed":
      return "amber";
    case "blocked":
      return "red";
    case "failed":
      return "red";
    default:
      return "neutral";
  }
}

function authorityTone(authorityClass: string): Tone {
  switch (authorityClass) {
    case "READ":
      return "cyan";
    case "DRAFT":
      return "neutral";
    case "PROPOSE":
      return "accent";
    case "POLICY_BOUND_AUTONOMOUS":
      return "green";
    case "APPROVAL_REQUIRED":
      return "amber";
    case "PROHIBITED":
      return "red";
    default:
      return "neutral";
  }
}

function provenanceTone(
  provenance: "environment variable" | "preference list" | "fallback" | "unavailable",
): Tone {
  switch (provenance) {
    case "environment variable":
      return "cyan";
    case "preference list":
      return "green";
    case "fallback":
      return "amber";
    case "unavailable":
      return "red";
  }
}
