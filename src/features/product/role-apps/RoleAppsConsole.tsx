/**
 * The Role Apps section of the Product Owner Console (plan 7.2 and 7.3).
 *
 * Installed apps first, each with what matters for running it: its state and
 * whether the workday may open it, the one control that changes that, its
 * candidate if it has one, and four process figures. The rest (the full
 * performance breakdown, the history, the comparison) sits behind
 * disclosures, quiet by default (plan 9.1). The catalogue (Demo and Planned)
 * follows as rows, because nothing can be done to a catalogue entry from here.
 *
 * Every control is a `ConsoleActionForm` posting to a server action that goes
 * through `governConsoleAction`. The permission and the rule shown here are
 * computed for the acting persona in advance, and checked again on the
 * server when the form is submitted.
 *
 * Server component.
 */

import Link from "next/link";
import { SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty, Item, List, Notice } from "@/components/workday-v2/primitives";
import { getProcessDefinition } from "@/role-apps/registry";
import { StatusBadge } from "@/product/status";
import type { Language } from "@/i18n/labels";
import type { Bilingual, ConsoleActionId } from "../permissions";
import { readActingConsoleIdentity } from "../persona/acting";
import { ConsoleActionForm } from "../forms/ConsoleActionForm";
import { formGate, type FormGate } from "../forms/gate";
import { CONSOLE_COPY } from "../shell/copy";
import { consoleFigureGridStyle, consoleInputStyle, consoleLabelStyle, consoleTextareaStyle, consoleWrapStyle } from "../shell/styles";
import {
  actionApproveRelease,
  actionAssignPilotCohort,
  actionCreateCandidate,
  actionRetireRoleApp,
  actionRollBackRoleApp,
  actionRunEvaluations,
  actionSetRoleAppEnablement,
} from "./actions";
import { CompareVersionsForm } from "./CompareVersionsForm";
import { roleAppEvaluationCapability, verdictReason } from "./evaluations";
import { AVAILABILITY_LABELS, EVENT_KIND_LABELS, LIFECYCLE_STATE_LABELS, LIFECYCLE_STATE_MEANINGS, SUPPORT_STATE_LABELS } from "./labels";
import {
  candidateStructuralBlock,
  proposeApproveRelease,
  proposeAssignPilotCohort,
  proposeCreateCandidate,
  proposeEnablement,
  proposeRetire,
  proposeRollBack,
  type LifecycleProposal,
} from "./lifecycle";
import { readRoleAppsView, type RoleAppRow } from "./model";
import { formatDuration, formatRate } from "./performance";

const COPY = {
  title: { en: "Role Apps", de: "Rollen-Apps" },
  lede: {
    en: "Lifecycle, enablement and process performance of each Role App, read from the release records. Definitions stay in reviewed code: a version records which definition is in force, and nothing here uploads or changes code.",
    de: "Lebenszyklus, Freischaltung und Prozessleistung jeder Rollen-App, aus den Release-Datensaetzen gelesen. Definitionen bleiben in geprueftem Code: Eine Version haelt fest, welche Definition gilt, und hier wird kein Code hochgeladen oder geaendert.",
  },
  unavailable: {
    en: "The release records could not be read, so no lifecycle state is shown. Run npm run db:migrate and npm run demo:reset.",
    de: "Die Release-Datensaetze konnten nicht gelesen werden, daher wird kein Lebenszyklus gezeigt. Fuehren Sie npm run db:migrate und npm run demo:reset aus.",
  },
  installedApps: { en: "Installed Role Apps", de: "Installierte Rollen-Apps" },
  catalogue: { en: "Catalogue", de: "Katalog" },
  catalogueNote: {
    en: "Demo and Planned entries have no executable process in this build. Their state changes only through reviewed code.",
    de: "Demo- und geplante Eintraege haben in diesem Build keinen ausfuehrbaren Prozess. Ihr Zustand aendert sich nur ueber geprueften Code.",
  },
  states: { en: "Lifecycle states", de: "Lebenszyklus-Zustaende" },
  version: { en: "Version", de: "Version" },
  workday: { en: "In the workday", de: "Im Arbeitstag" },
  activeRuns: { en: "active runs", de: "aktive Laeufe" },
  support: { en: "Support", de: "Support" },
  openProcess: { en: "Open process page", de: "Prozessseite oeffnen" },
  candidate: { en: "Candidate", de: "Kandidat" },
  noCandidate: { en: "No candidate version is open.", de: "Es ist keine Kandidatenversion offen." },
  createCandidate: { en: "Create candidate version", de: "Kandidatenversion anlegen" },
  candidateVersion: { en: "Version number", de: "Versionsnummer" },
  notes: { en: "Release notes (English)", de: "Release-Hinweise (Englisch)" },
  notesDe: { en: "Release notes (German)", de: "Release-Hinweise (Deutsch)" },
  evaluation: { en: "Evaluation", de: "Evaluation" },
  cohort: { en: "Cohort", de: "Kohorte" },
  compare: { en: "Compare versions", de: "Versionen vergleichen" },
  compareNote: {
    en: "Two versions side by side, from their release manifests.",
    de: "Zwei Versionen nebeneinander, aus ihren Release-Manifesten.",
  },
  performance: { en: "Process performance", de: "Prozessleistung" },
  performanceNote: {
    en: "Aggregate process measures from the event backbone and the process runtime, for this scenario run. No person is named or ranked.",
    de: "Aggregierte Prozesskennzahlen aus dem Ereignis-Backbone und der Prozesslaufzeit, fuer diesen Szenariolauf. Keine Person wird genannt oder bewertet.",
  },
  runsStarted: { en: "Runs started", de: "Gestartete Laeufe" },
  runsCompleted: { en: "Runs completed", de: "Abgeschlossene Laeufe" },
  cycleTime: { en: "Median cycle time", de: "Median der Durchlaufzeit" },
  failureRate: { en: "Preparation failure rate", de: "Fehlerquote der Vorbereitung" },
  moreMeasures: { en: "All measures", de: "Alle Kennzahlen" },
  waitingByStage: { en: "Waiting time by stage", de: "Wartezeit je Stufe" },
  stage: { en: "Stage", de: "Stufe" },
  completedMedian: { en: "Completed, median open", de: "Abgeschlossen, Median offen" },
  openNow: { en: "Open now, median open for", de: "Jetzt offen, Median offen seit" },
  humanTask: { en: "Human task time", de: "Bearbeitungszeit menschlicher Aufgaben" },
  sourceDelay: { en: "Source delay", de: "Verzoegerung durch Quellen" },
  decisionDelay: { en: "Decision delay", de: "Entscheidungsverzoegerung" },
  approvalDelay: { en: "Approval delay", de: "Genehmigungsverzoegerung" },
  resumeRate: { en: "Resume rate", de: "Fortsetzungsquote" },
  held: { en: "held for a source", de: "auf eine Quelle wartend" },
  suggestions: { en: "AI suggestions in the role's working day", de: "KI-Vorschlaege im Arbeitstag der Rolle" },
  accepted: { en: "accepted", de: "angenommen" },
  modified: { en: "modified", de: "geaendert" },
  rejected: { en: "rejected", de: "abgelehnt" },
  ofDecided: { en: "of the suggestions a person acted on", de: "der Vorschlaege, zu denen eine Person entschieden hat" },
  noneDecided: { en: "Not measured: no suggestion has been accepted, modified or rejected yet.", de: "Nicht gemessen: Noch kein Vorschlag wurde angenommen, geaendert oder abgelehnt." },
  feedback: { en: "Feedback", de: "Rueckmeldungen" },
  noFeedback: { en: "No feedback is recorded for this app.", de: "Fuer diese App sind keine Rueckmeldungen erfasst." },
  aiFeedback: { en: "on AI output", de: "zu KI-Ausgaben" },
  productFeedback: { en: "product feedback items", de: "Produktrueckmeldungen" },
  notMeasured: { en: "Not measured", de: "Nicht gemessen" },
  history: { en: "History", de: "Verlauf" },
  noHistory: { en: "No history is recorded.", de: "Es ist kein Verlauf erfasst." },
  disable: { en: "Disable", de: "Sperren" },
  enable: { en: "Enable", de: "Freischalten" },
  rollBack: { en: "Roll back", de: "Zuruecksetzen" },
  retire: { en: "Retire", de: "Ausser Betrieb nehmen" },
  runEvaluations: { en: "Run evaluations", de: "Evaluationen ausfuehren" },
  assignCohort: { en: "Assign pilot cohort", de: "Pilotkohorte zuweisen" },
  approveRelease: { en: "Approve release", de: "Release freigeben" },
  cohortsAssigned: { en: "Pilot cohorts", de: "Pilotkohorten" },
  cohortNote: {
    en: "applies to cohort members signed in with their own accounts; the demonstration workday follows the tenant setting",
    de: "gilt fuer Kohortenmitglieder mit eigenem Konto; der Demonstrations-Arbeitstag folgt der Mandanteneinstellung",
  },
  enabledFor: { en: "enabled", de: "freigeschaltet" },
  disabledFor: { en: "disabled", de: "gesperrt" },
} as const;

type Say = (pair: Bilingual) => string;

function Figure({ label, value, note, testId }: { label: string; value: string; note?: string; testId?: string }) {
  return (
    <div className="app-stack-1" style={{ minWidth: 0 }} {...(testId ? { "data-testid": testId } : {})}>
      <span className="app-meta">{label}</span>
      <span className="app-data-md app-strong">{value}</span>
      {note ? (
        <span className="app-meta" style={consoleWrapStyle}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

export async function RoleAppsConsole({ language }: { language: Language }) {
  const say: Say = (pair) => (language === "de" ? pair.de : pair.en);
  const view = readRoleAppsView();
  const identity = await readActingConsoleIdentity();

  /** The form props for one proposal: permission for this persona, then the action's own rule. */
  const gate = (actionId: ConsoleActionId, proposal?: LifecycleProposal | null, rule?: Bilingual | null): FormGate =>
    formGate(identity.scopes, actionId, language, rule ?? proposal?.blocked ?? null);

  const installed = view.rows.filter((row) => row.installed);
  const catalogue = view.rows.filter((row) => !row.installed);

  return (
    <div className="app-stack-6" data-testid="console-role-apps">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />

      {!view.available ? <Notice tone="warning">{say(COPY.unavailable)}</Notice> : null}

      <div className="app-row app-row-wrap" data-testid="role-app-state-counts">
        {(Object.keys(LIFECYCLE_STATE_LABELS) as Array<keyof typeof LIFECYCLE_STATE_LABELS>).map((state) => (
          <Chip
            key={state}
            tone={(view.stateCounts[state] ?? 0) === 0 ? "neutral" : state === "installed" ? "success" : state === "retired" ? "warning" : "neutral"}
            title={say(LIFECYCLE_STATE_MEANINGS[state])}
          >
            {say(LIFECYCLE_STATE_LABELS[state])} {view.stateCounts[state] ?? 0}
          </Chip>
        ))}
      </div>

      <SettingsSection title={say(COPY.installedApps)} count={installed.length}>
        <div className="app-stack-6">
          {installed.map((row) => (
            <InstalledApp key={row.app.id} row={row} say={say} language={language} gate={gate} cohorts={view.cohorts} />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={say(COPY.catalogue)} count={catalogue.length}>
        <div className="app-stack-2">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.catalogueNote)}</span>
          <List label={say(COPY.catalogue)}>
            {catalogue.map((row) => (
              <Item
                key={row.app.id}
                title={
                  <span className="app-row app-row-wrap">
                    <span>{language === "de" ? row.app.nameDe : row.app.name}</span>
                    {row.state ? <Chip>{say(LIFECYCLE_STATE_LABELS[row.state])}</Chip> : null}
                  </span>
                }
                trailing={<Data>{row.current?.version ?? row.app.version}</Data>}
              >
                <span className="app-meta" style={consoleWrapStyle}>
                  {row.state ? say(LIFECYCLE_STATE_MEANINGS[row.state]) : ""} {say(row.availability.reason)}
                </span>
              </Item>
            ))}
          </List>
        </div>
      </SettingsSection>
    </div>
  );
}

function InstalledApp({
  row,
  say,
  language,
  gate,
  cohorts,
}: {
  row: RoleAppRow;
  say: Say;
  language: Language;
  gate: (actionId: ConsoleActionId, proposal?: LifecycleProposal | null, rule?: Bilingual | null) => FormGate;
  cohorts: ReturnType<typeof readRoleAppsView>["cohorts"];
}) {
  const app = row.app;
  const name = language === "de" ? app.nameDe : app.name;
  const runnable = row.availability.runnable;
  const enablement = proposeEnablement(app.id, !runnable);
  const rollBack = proposeRollBack(app.id);
  const retire = proposeRetire(app.id);
  const create = proposeCreateCandidate(app.id, null);
  const candidate = row.candidate;
  const assign = candidate ? proposeAssignPilotCohort(candidate.id, cohorts[0]?.id ?? null) : null;
  const approve = candidate ? proposeApproveRelease(candidate.id) : null;
  const capability = roleAppEvaluationCapability();
  const testId = `role-app-${app.id}`;
  const process = getProcessDefinition(app.processId);
  const stageName = (stageId: string) => {
    const stage = process?.stages.find((entry) => entry.id === stageId);
    return stage ? (language === "de" ? stage.nameDe : stage.name) : stageId;
  };
  const lines = (proposal: LifecycleProposal) => proposal.lines.map((line) => say(line));
  const perf = row.performance;

  return (
    <section
      className="app-stack-4"
      style={{ borderTop: "1px solid var(--app-border)", paddingTop: "var(--app-4)" }}
      data-testid={testId}
      data-availability={row.availability.state}
      aria-label={name}
    >
      <div className="app-row app-row-wrap" style={{ justifyContent: "space-between", rowGap: "var(--app-2)" }}>
        <div className="app-row app-row-wrap" style={{ minWidth: 0 }}>
          <h3 className="app-section-title" style={{ fontSize: "var(--app-text-md)" }}>
            {name}
          </h3>
          {row.state ? (
            <Chip tone={row.state === "installed" ? "success" : row.state === "retired" ? "warning" : "neutral"} title={say(LIFECYCLE_STATE_MEANINGS[row.state])}>
              {say(LIFECYCLE_STATE_LABELS[row.state])}
            </Chip>
          ) : null}
          <span data-testid={`${testId}-availability`} data-state={row.availability.state}>
            <Chip tone={runnable ? "success" : "warning"} title={say(row.availability.reason)}>
              {say(AVAILABILITY_LABELS[row.availability.state])}
            </Chip>
          </span>
          {!row.availability.recorded ? (
            <StatusBadge status="not-verified" language={language} detail={say(row.availability.reason)} />
          ) : null}
        </div>
        <div className="app-row app-row-wrap">
          <span className="app-meta">{say(COPY.version)}</span>
          <Data>{row.current?.version ?? "-"}</Data>
          <span className="app-meta">
            <Data>{row.activeRuns}</Data> {say(COPY.activeRuns)}
          </span>
          {row.current ? <Chip>{say(SUPPORT_STATE_LABELS[row.current.supportState])}</Chip> : null}
          {app.entryRoute && runnable ? (
            <Link href={app.entryRoute} className="app-source-link">
              {say(COPY.openProcess)}
            </Link>
          ) : null}
        </div>
      </div>

      <span className="app-meta" style={consoleWrapStyle}>
        {say(COPY.workday)}: {say(row.availability.reason)}
        {row.availability.changeReason ? ` "${row.availability.changeReason}"` : ""}
      </span>

      <div className="app-row app-row-wrap app-row-top" style={{ gap: "var(--app-3)" }}>
        <ConsoleActionForm
          action={actionSetRoleAppEnablement}
          language={language}
          label={runnable ? say(COPY.disable) : say(COPY.enable)}
          hidden={{ roleAppId: app.id, enabled: runnable ? "false" : "true" }}
          {...gate(enablement.actionId, enablement)}
          approval={{ lines: lines(enablement), fingerprint: enablement.fingerprint }}
          tone={runnable ? "danger" : "primary"}
          testId={`${testId}-${runnable ? "disable" : "enable"}`}
        />
        <ConsoleActionForm
          action={actionRollBackRoleApp}
          language={language}
          label={say(COPY.rollBack)}
          hidden={{ roleAppId: app.id }}
          {...gate("role-app.roll-back", rollBack)}
          approval={{ lines: lines(rollBack), fingerprint: rollBack.fingerprint }}
          testId={`${testId}-roll-back`}
        />
        <ConsoleActionForm
          action={actionRetireRoleApp}
          language={language}
          label={say(COPY.retire)}
          hidden={{ roleAppId: app.id }}
          {...gate("role-app.retire", retire)}
          approval={{ lines: lines(retire), fingerprint: retire.fingerprint }}
          tone="danger"
          testId={`${testId}-retire`}
        />
      </div>

      {row.cohortEnablements.length > 0 ? (
        <span className="app-meta" style={consoleWrapStyle} data-testid={`${testId}-cohorts`}>
          {say(COPY.cohortsAssigned)}:{" "}
          {row.cohortEnablements
            .map((entry) => {
              const version = row.versions.find((candidateVersion) => candidateVersion.id === entry.versionId)?.version ?? "-";
              return `${entry.scopeId} ${version} (${entry.enabled ? say(COPY.enabledFor) : say(COPY.disabledFor)})`;
            })
            .join(", ")}{" "}
          ({say(COPY.cohortNote)})
        </span>
      ) : null}

      {/* Candidate */}
      <div className="app-stack-2" data-testid={`${testId}-candidate`}>
        <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>{say(COPY.candidate)}</span>
        {candidate ? (
          <div className="app-stack-2">
            <span className="app-row app-row-wrap">
              <Data>{candidate.version}</Data>
              <Chip tone="info">{say(LIFECYCLE_STATE_LABELS[candidate.lifecycleState])}</Chip>
              <span className="app-meta" style={consoleWrapStyle}>
                {language === "de" ? candidate.releaseNotesDe || candidate.releaseNotes : candidate.releaseNotes}
              </span>
            </span>
            <span className="app-meta" style={consoleWrapStyle} data-testid={`${testId}-evaluation`}>
              {say(COPY.evaluation)}: {row.candidateVerdict ? say(verdictReason(row.candidateVerdict)) : "-"}
            </span>
            <div className="app-row app-row-wrap app-row-top" style={{ gap: "var(--app-3)" }}>
              <ConsoleActionForm
                action={actionRunEvaluations}
                language={language}
                label={say(COPY.runEvaluations)}
                hidden={{ versionId: candidate.id }}
                {...gate("role-app.run-evaluations", null, capability.available ? null : capability.reason)}
                testId={`${testId}-run-evaluations`}
              />
              {assign ? (
                <ConsoleActionForm
                  action={actionAssignPilotCohort}
                  language={language}
                  label={say(COPY.assignCohort)}
                  hidden={{ versionId: candidate.id, cohortId: String(assign.payload["cohortId"] ?? "") }}
                  {...gate("role-app.assign-pilot-cohort", assign)}
                  approval={{ lines: lines(assign), fingerprint: assign.fingerprint }}
                  testId={`${testId}-assign-cohort`}
                />
              ) : null}
              {approve ? (
                <ConsoleActionForm
                  action={actionApproveRelease}
                  language={language}
                  label={say(COPY.approveRelease)}
                  hidden={{ versionId: candidate.id }}
                  {...gate("role-app.approve-release", approve)}
                  approval={{ lines: lines(approve), fingerprint: approve.fingerprint }}
                  tone="primary"
                  testId={`${testId}-approve-release`}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="app-stack-2">
            <span className="app-meta">{say(COPY.noCandidate)}</span>
            {/* Before submission only the rules that hold whatever version is typed apply; the rest are checked on the server. */}
            <details>
              <summary className="app-meta" style={{ cursor: "pointer" }} data-testid={`${testId}-create-candidate-toggle`}>
                {say(COPY.createCandidate)}
              </summary>
              <div style={{ marginTop: "var(--app-2)" }}>
                <ConsoleActionForm
                  action={actionCreateCandidate}
                  language={language}
                  label={say(COPY.createCandidate)}
                  hidden={{ roleAppId: app.id }}
                  {...gate("role-app.create-candidate", null, candidateStructuralBlock(app.id))}
                  fields={
                    <div className="app-stack-2" style={{ maxWidth: 720 }}>
                      <ul className="app-stack-1" style={{ margin: 0, paddingLeft: "var(--app-4)" }}>
                        {create.lines.map((line) => (
                          <li key={line.en} className="app-meta" style={consoleWrapStyle}>
                            {say(line)}
                          </li>
                        ))}
                      </ul>
                      <label style={consoleLabelStyle}>
                        {say(COPY.candidateVersion)}
                        <input name="version" defaultValue={String(create.payload["version"] ?? "")} style={{ ...consoleInputStyle, width: 120 }} data-testid={`${testId}-candidate-version`} />
                      </label>
                      <label style={consoleLabelStyle}>
                        {say(COPY.notes)}
                        <textarea name="notes" rows={2} style={consoleTextareaStyle} data-testid={`${testId}-candidate-notes`} />
                      </label>
                      <label style={consoleLabelStyle}>
                        {say(COPY.notesDe)}
                        <textarea name="notesDe" rows={2} style={consoleTextareaStyle} data-testid={`${testId}-candidate-notes-de`} />
                      </label>
                    </div>
                  }
                  testId={`${testId}-create-candidate`}
                />
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Performance, four figures then the rest on demand */}
      <div className="app-stack-2" data-testid={`${testId}-performance`}>
        <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>{say(COPY.performance)}</span>
        {perf ? (
          <>
            <div style={consoleFigureGridStyle}>
              <Figure label={say(COPY.runsStarted)} value={String(perf.runsStarted)} testId={`${testId}-runs-started`} />
              <Figure label={say(COPY.runsCompleted)} value={String(perf.runsCompleted)} />
              <Figure
                label={say(COPY.cycleTime)}
                value={perf.cycleTime.measured ? formatDuration(perf.cycleTime.medianMs, language) : say(COPY.notMeasured)}
                note={say(perf.cycleTime.note)}
              />
              <Figure label={say(COPY.failureRate)} value={formatRate(perf.failureRate, language)} />
            </div>
            <details>
              <summary className="app-meta" style={{ cursor: "pointer" }}>
                {say(COPY.moreMeasures)}
              </summary>
              <div className="app-stack-3" style={{ marginTop: "var(--app-2)" }}>
                <span className="app-meta" style={consoleWrapStyle}>{say(COPY.performanceNote)}</span>
                <div className="app-stack-1">
                  <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{say(COPY.waitingByStage)}</span>
                  {perf.stages.length === 0 ? (
                    <Empty title={say(COPY.notMeasured)} />
                  ) : (
                    <List label={say(COPY.waitingByStage)}>
                      {perf.stages.map((stage) => (
                        <Item
                          key={stage.stageId}
                          title={stageName(stage.stageId)}
                          trailing={
                            <span className="app-row app-row-wrap">
                              <span className="app-meta">
                                {say(COPY.completedMedian)} <Data>{stage.completed}</Data>,{" "}
                                <Data>{stage.completedDuration.measured ? formatDuration(stage.completedDuration.medianMs, language) : "-"}</Data>
                              </span>
                              <span className="app-meta">
                                {say(COPY.openNow)} <Data>{stage.open}</Data>,{" "}
                                <Data>{stage.openFor.measured ? formatDuration(stage.openFor.medianMs, language) : "-"}</Data>
                              </span>
                            </span>
                          }
                        />
                      ))}
                    </List>
                  )}
                </div>
                <div style={consoleFigureGridStyle}>
                  <Figure
                    label={say(COPY.humanTask)}
                    value={perf.humanTaskTime.measured ? formatDuration(perf.humanTaskTime.medianMs, language) : say(COPY.notMeasured)}
                    note={say(perf.humanTaskTime.note)}
                  />
                  <Figure
                    label={say(COPY.sourceDelay)}
                    value={perf.sourceDelay.measured ? formatDuration(perf.sourceDelay.medianMs, language) : say(COPY.notMeasured)}
                    note={`${perf.sourceDelay.held} ${say(COPY.held)}. ${say(perf.sourceDelay.note)}`}
                  />
                  <Figure
                    label={say(COPY.decisionDelay)}
                    value={perf.decisionDelay.measured ? formatDuration(perf.decisionDelay.medianMs, language) : say(COPY.notMeasured)}
                    note={say(perf.decisionDelay.note)}
                  />
                  <Figure
                    label={say(COPY.approvalDelay)}
                    value={perf.approvalDelay.measured ? formatDuration(perf.approvalDelay.medianMs, language) : say(COPY.notMeasured)}
                    note={say(perf.approvalDelay.note)}
                  />
                  <Figure label={say(COPY.resumeRate)} value={formatRate(perf.resumeRate, language)} />
                </div>
                <div className="app-stack-1">
                  <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{say(COPY.suggestions)}</span>
                  <span className="app-meta" style={consoleWrapStyle}>
                    {row.suggestions && row.suggestions.decided > 0
                      ? `${row.suggestions.accepted} ${say(COPY.accepted)}, ${row.suggestions.modified} ${say(COPY.modified)}, ${row.suggestions.rejected} ${say(COPY.rejected)} ${say(COPY.ofDecided)} (${row.suggestions.decided} / ${row.suggestions.total})`
                      : say(COPY.noneDecided)}
                  </span>
                </div>
                <div className="app-stack-1">
                  <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{say(COPY.feedback)}</span>
                  <span className="app-meta" style={consoleWrapStyle}>
                    {row.feedback && row.feedback.aiFeedback + row.feedback.productFeedback > 0
                      ? `${row.feedback.aiFeedback} ${say(COPY.aiFeedback)}, ${row.feedback.productFeedback} ${say(COPY.productFeedback)}: ${row.feedback.byKind.map((entry) => `${entry.kind} ${entry.count}`).join(", ")}`
                      : say(COPY.noFeedback)}
                  </span>
                </div>
              </div>
            </details>
          </>
        ) : (
          <Empty title={say(COPY.notMeasured)} detail={say(COPY.unavailable)} />
        )}
      </div>

      {/* Compare and history, on demand */}
      <details>
        <summary className="app-meta" style={{ cursor: "pointer" }} data-testid={`${testId}-compare-toggle`}>
          {say(COPY.compare)}
        </summary>
        <div className="app-stack-2" style={{ marginTop: "var(--app-2)" }}>
          <span className="app-meta">{say(COPY.compareNote)}</span>
          <CompareVersionsForm
            language={language}
            versions={row.versions.map((version) => ({
              id: version.id,
              label: `${version.version} (${say(LIFECYCLE_STATE_LABELS[version.lifecycleState])})`,
            }))}
            defaultLeft={row.current?.id ?? row.versions[0]?.id ?? ""}
            defaultRight={candidate?.id ?? row.versions.find((version) => !version.isCurrent)?.id ?? row.current?.id ?? ""}
            {...gate("role-app.compare-versions")}
            testId={`${testId}-compare`}
          />
        </div>
      </details>

      <details>
        <summary className="app-meta" style={{ cursor: "pointer" }}>
          {say(COPY.history)} <Data>{row.history.length}</Data>
        </summary>
        <div style={{ marginTop: "var(--app-2)" }}>
          {row.history.length === 0 ? (
            <Empty title={say(COPY.noHistory)} />
          ) : (
            <List label={say(COPY.history)}>
              {row.history.slice(0, 12).map((event) => (
                <Item
                  key={event.id}
                  title={
                    <span className="app-row app-row-wrap">
                      <span>{say(EVENT_KIND_LABELS[event.kind])}</span>
                      {event.toState ? <Chip>{say(LIFECYCLE_STATE_LABELS[event.toState])}</Chip> : null}
                      {event.scopeKind ? <span className="app-oid">{`${event.scopeKind}:${event.scopeId ?? ""}`}</span> : null}
                    </span>
                  }
                  trailing={<Data>{event.at.slice(0, 16).replace("T", " ")}</Data>}
                >
                  <span className="app-meta" style={consoleWrapStyle}>
                    {event.actorLabel}
                    {event.reason ? `: ${event.reason}` : ""}
                    {event.approvalId ? ` (${event.approvalId})` : ""}
                  </span>
                </Item>
              ))}
            </List>
          )}
        </div>
      </details>
    </section>
  );
}
