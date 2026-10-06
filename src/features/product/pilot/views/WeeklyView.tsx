/**
 * The pilot's weekly view (plan 7.7): adoption, completion, issues, user
 * feedback, quality, value measures, risks and decisions required.
 *
 * Server component. Every section names its source and its status. Adoption
 * and completion are counted per role, never per person.
 */

import Link from "next/link";
import { SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty } from "@/components/workday-v2/primitives";
import { StatusBadge } from "@/product/status";
import type { Language } from "@/i18n/labels";
import { ConsoleActionForm } from "@/features/product/forms/ConsoleActionForm";
import { consoleInputStyle, consoleLabelStyle, consoleTextareaStyle } from "@/features/product/shell/styles";
import { actionRaiseIssue, actionRecordReading, actionUpdateIssue } from "../actions";
import type { PilotAccess } from "../access";
import type { PilotIssue } from "@/db/repositories/pilot";
import { weekLabel, type PilotWeek } from "../weekly";
import type { PilotWorkspace } from "../workspace";
import { say, Wrap } from "./PilotFrame";

const COPY = {
  adoption: { en: "Adoption", de: "Nutzung" },
  role: { en: "Role", de: "Rolle" },
  actions: { en: "Actions by people", de: "Handlungen von Personen" },
  stages: { en: "Stages completed", de: "Abgeschlossene Stufen" },
  processes: { en: "Runs completed", de: "Abgeschlossene Laeufe" },
  decisions: { en: "Decisions recorded", de: "Erfasste Entscheidungen" },
  experience: { en: "Experience recorder", de: "Nutzungsrekorder" },
  completion: { en: "Completion", de: "Abschluss" },
  issues: { en: "Issues", de: "Themen" },
  risks: { en: "Risks", de: "Risiken" },
  decisionsRequired: { en: "Decisions required", de: "Erforderliche Entscheidungen" },
  noneOpen: { en: "None open", de: "Keine offen" },
  raised: { en: "Raised this week", de: "Diese Woche erfasst" },
  resolved: { en: "Resolved this week", de: "Diese Woche geloest" },
  raise: { en: "Raise an issue, risk or decision", de: "Thema, Risiko oder Entscheidung erfassen" },
  kind: { en: "Kind", de: "Art" },
  title: { en: "Title", de: "Titel" },
  detail: { en: "Detail", de: "Details" },
  severity: { en: "Severity", de: "Schweregrad" },
  owner: { en: "Owner", de: "Verantwortlich" },
  record: { en: "Record", de: "Erfassen" },
  update: { en: "Update", de: "Aktualisieren" },
  resolution: { en: "Resolution or reason", de: "Loesung oder Begruendung" },
  feedback: { en: "User feedback", de: "Rueckmeldungen der Nutzer" },
  quality: { en: "Quality", de: "Qualitaet" },
  harness: { en: "Evaluation harness", de: "Evaluationsumgebung" },
  modelOutput: { en: "Model output", de: "Modellausgaben" },
  cases: { en: "cases", de: "Faelle" },
  runs: { en: "Evaluation runs recorded in the console", de: "In der Konsole erfasste Evaluationslaeufe" },
  value: { en: "Value measures", de: "Nutzenkennzahlen" },
  baseline: { en: "Baseline", de: "Ausgangslage" },
  reading: { en: "This week", de: "Diese Woche" },
  difference: { en: "Against baseline", de: "Gegenueber Ausgangslage" },
  noReading: { en: "No reading", de: "Kein Wert" },
  recordReading: { en: "Record reading", de: "Wert erfassen" },
  status: { en: "Status", de: "Status" },
  measured: { en: "Measured", de: "Gemessen" },
  unavailable: { en: "Unavailable", de: "Nicht verfuegbar" },
  value_: { en: "Value", de: "Wert" },
  source: { en: "Source", de: "Quelle" },
  note: { en: "Note", de: "Notiz" },
  outside: { en: "Outside the agreed pilot window", de: "Ausserhalb des vereinbarten Pilotzeitraums" },
  weeks: { en: "Weeks", de: "Wochen" },
} as const;

const KIND_LABEL: Record<string, { en: string; de: string }> = {
  issue: { en: "Issue", de: "Thema" },
  risk: { en: "Risk", de: "Risiko" },
  "decision-required": { en: "Decision required", de: "Erforderliche Entscheidung" },
};

function IssueRows({ issues, access, language, testId }: { issues: PilotIssue[]; access: PilotAccess; language: Language; testId: string }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  if (issues.length === 0) return <span className="app-meta">{t(COPY.noneOpen)}</span>;
  const can = access.can("pilot.update-issue") && !access.readOnly;
  return (
    <ul className="app-stack app-stack-2" style={{ listStyle: "none", margin: 0, padding: 0 }} data-testid={testId}>
      {issues.map((issue) => (
        <li key={issue.id} className="app-stack app-stack-1">
          <span className="app-row app-row-wrap">
            <span className="app-strong" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{issue.title}</span>
            <Chip tone={issue.severity === "critical" || issue.severity === "high" ? "warning" : "neutral"}>{issue.severity}</Chip>
            {issue.ownerLabel ? <span className="app-meta">{issue.ownerLabel}</span> : null}
          </span>
          {issue.detail ? <Wrap>{issue.detail}</Wrap> : null}
          {can ? (
            <details>
              <summary className="app-meta" style={{ cursor: "pointer" }}>{t(COPY.update)}</summary>
              <ConsoleActionForm
                action={actionUpdateIssue}
                language={language}
                label={t(COPY.update)}
                hidden={{ issueId: issue.id }}
                permitted={can}
                testId={`issue-update-${issue.id}`}
                fields={
                  <div className="app-row app-row-wrap" style={{ gap: "var(--app-2)", alignItems: "flex-end" }}>
                    <label style={consoleLabelStyle}>
                      {t(COPY.status)}
                      <select name="status" defaultValue="resolved" style={consoleInputStyle}>
                        <option value="resolved">{language === "de" ? "Geloest" : "Resolved"}</option>
                        <option value="accepted">{language === "de" ? "Akzeptiert" : "Accepted"}</option>
                        <option value="closed">{language === "de" ? "Geschlossen" : "Closed"}</option>
                      </select>
                    </label>
                    <label style={{ ...consoleLabelStyle, flex: "1 1 260px" }}>
                      {t(COPY.resolution)}
                      <input name="resolution" style={{ ...consoleInputStyle, width: "100%" }} />
                    </label>
                  </div>
                }
              />
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function WeeklyView({ workspace, week, access, language }: { workspace: PilotWorkspace; week: PilotWeek; access: PilotAccess; language: Language }) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const canRead = access.can("pilot.record-reading") && !access.readOnly;
  const canRaise = access.can("pilot.raise-issue") && !access.readOnly;
  const unitLabel = (unit: string) => unit;

  return (
    <div className="app-stack app-stack-6" data-testid="pilot-weekly" data-week={week.weekStarting}>
      <nav aria-label={t(COPY.weeks)} className="app-row app-row-wrap" style={{ gap: "var(--app-2)" }}>
        {week.weeks.map((entry) => (
          <Link
            key={entry}
            href={`/product/pilot/weekly?week=${entry}`}
            className={`app-btn app-btn-sm ${entry === week.weekStarting ? "app-btn-secondary" : "app-btn-quiet"}`}
            {...(entry === week.weekStarting ? { "aria-current": "page" as const } : {})}
          >
            {weekLabel(entry, language)}
          </Link>
        ))}
        {!week.inWindow ? <span className="app-meta">{t(COPY.outside)}</span> : null}
      </nav>

      <SettingsSection title={t(COPY.adoption)} trailing={<StatusBadge status={week.adoption.reading.status} language={language} detail={t(week.adoption.reading.detail)} />}>
        <div className="app-stack app-stack-2">
          <Wrap>{t(week.adoption.reading.detail)}</Wrap>
          <table className="app-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--app-text-sm)" }} data-testid="weekly-adoption">
            <thead>
              <tr>
                {[COPY.role, COPY.actions, COPY.stages, COPY.processes, COPY.decisions].map((head) => (
                  <th key={head.en} style={{ textAlign: "left", padding: "var(--app-1) var(--app-2)", borderBottom: "1px solid var(--app-border)", fontWeight: 500 }}>
                    {t(head)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {week.adoption.byRole.map((row) => (
                <tr key={row.roleId}>
                  <td style={{ padding: "var(--app-1) var(--app-2)" }}>{row.label}</td>
                  <td style={{ padding: "var(--app-1) var(--app-2)" }}><Data>{row.humanActions}</Data></td>
                  <td style={{ padding: "var(--app-1) var(--app-2)" }}><Data>{row.stagesCompleted}</Data></td>
                  <td style={{ padding: "var(--app-1) var(--app-2)" }}><Data>{row.processesCompleted}</Data></td>
                  <td style={{ padding: "var(--app-1) var(--app-2)" }}><Data>{row.decisionsRecorded}</Data></td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="app-row app-row-wrap">
            <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{t(COPY.experience)}</span>
            <StatusBadge status={week.adoption.experienceReading.status} language={language} detail={t(week.adoption.experienceReading.detail)} />
            {week.adoption.experience.map((entry) => (
              <span key={entry.kind} className="app-meta">
                {entry.kind}: <Data>{entry.count}</Data>
              </span>
            ))}
          </span>
          <Wrap>{t(week.adoption.experienceReading.detail)}</Wrap>
        </div>
      </SettingsSection>

      <SettingsSection title={t(COPY.completion)} trailing={<StatusBadge status={week.completion.reading.status} language={language} detail={t(week.completion.reading.detail)} />}>
        <Wrap>
          {t(COPY.stages)}: {week.completion.stages}. {t(COPY.processes)}: {week.completion.processes}. {t(COPY.decisions)}: {week.completion.decisions}. {t(week.completion.reading.detail)}
        </Wrap>
      </SettingsSection>

      <SettingsSection title={t(COPY.value)} trailing={<StatusBadge status={week.value.reading.status} language={language} detail={t(week.value.reading.detail)} />}>
        <div className="app-stack app-stack-3" data-testid="weekly-value">
          <Wrap>{t(week.value.reading.detail)}</Wrap>
          {week.value.rows.map((row) => {
            const m = row.entry.measure;
            return (
              <div key={m.id} className="app-stack app-stack-1" style={{ borderTop: "1px solid var(--app-border)", paddingTop: "var(--app-2)" }}>
                <span className="app-row app-row-wrap">
                  <span className="app-strong">{t(row.entry.label)}</span>
                  <span className="app-meta">
                    {t(COPY.baseline)}: {m.baselineStatus === "measured" ? `${m.baselineValue} ${unitLabel(m.unit)} (${m.baselinePeriod ?? ""})` : m.baselineStatus === "unavailable" ? t(COPY.unavailable) : language === "de" ? "nicht gemessen" : "not measured"}
                  </span>
                  <span className="app-meta">
                    {t(COPY.reading)}: {row.reading ? (row.reading.status === "measured" ? `${row.reading.value} ${unitLabel(m.unit)}` : t(COPY.unavailable)) : t(COPY.noReading)}
                  </span>
                  {row.difference !== null ? (
                    <span className="app-meta">
                      {t(COPY.difference)}: <Data>{row.difference > 0 ? `+${row.difference}` : row.difference}</Data>
                    </span>
                  ) : null}
                </span>
                {row.reading?.note ? <Wrap>{row.reading.note}</Wrap> : null}
                {canRead ? (
                  <details>
                    <summary className="app-meta" style={{ cursor: "pointer" }}>{t(COPY.recordReading)}</summary>
                    <ConsoleActionForm
                      action={actionRecordReading}
                      language={language}
                      label={t(COPY.recordReading)}
                      hidden={{ measureId: m.id, weekStarting: week.weekStarting }}
                      permitted={canRead}
                      testId={`reading-form-${m.key}`}
                      fields={
                        <div className="app-row app-row-wrap" style={{ gap: "var(--app-2)", alignItems: "flex-end" }}>
                          <label style={consoleLabelStyle}>
                            {t(COPY.status)}
                            <select name="status" defaultValue="measured" style={consoleInputStyle}>
                              <option value="measured">{t(COPY.measured)}</option>
                              <option value="unavailable">{t(COPY.unavailable)}</option>
                            </select>
                          </label>
                          <label style={consoleLabelStyle}>
                            {t(COPY.value_)} ({m.unit})
                            <input name="value" inputMode="decimal" style={{ ...consoleInputStyle, width: 100 }} />
                          </label>
                          <label style={consoleLabelStyle}>
                            {t(COPY.source)}
                            <input name="source" defaultValue={m.source} style={{ ...consoleInputStyle, width: 190 }} />
                          </label>
                          <label style={{ ...consoleLabelStyle, flex: "1 1 200px" }}>
                            {t(COPY.note)}
                            <input name="note" style={{ ...consoleInputStyle, width: "100%" }} />
                          </label>
                        </div>
                      }
                    />
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title={t(COPY.issues)} count={week.issues.open.length}>
        <div className="app-stack app-stack-2">
          <span className="app-meta">
            {t(COPY.raised)}: {week.issues.raisedThisWeek}. {t(COPY.resolved)}: {week.issues.resolvedThisWeek}.
          </span>
          <IssueRows issues={week.issues.open} access={access} language={language} testId="weekly-issues" />
        </div>
      </SettingsSection>
      <SettingsSection title={t(COPY.risks)} count={week.issues.risks.length}>
        <IssueRows issues={week.issues.risks} access={access} language={language} testId="weekly-risks" />
      </SettingsSection>
      <SettingsSection title={t(COPY.decisionsRequired)} count={week.issues.decisions.length}>
        <IssueRows issues={week.issues.decisions} access={access} language={language} testId="weekly-decisions" />
      </SettingsSection>

      {canRaise ? (
        <SettingsSection title={t(COPY.raise)}>
          <ConsoleActionForm
            action={actionRaiseIssue}
            language={language}
            label={t(COPY.record)}
            permitted={canRaise}
            testId="issue-raise-form"
            fields={
              <div className="app-stack app-stack-2">
                <div className="app-row app-row-wrap" style={{ gap: "var(--app-2)" }}>
                  <label style={consoleLabelStyle}>
                    {t(COPY.kind)}
                    <select name="kind" defaultValue="issue" style={consoleInputStyle} data-testid="issue-kind">
                      {Object.entries(KIND_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {t(label)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={consoleLabelStyle}>
                    {t(COPY.severity)}
                    <select name="severity" defaultValue="medium" style={consoleInputStyle}>
                      {["critical", "high", "medium", "low"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ ...consoleLabelStyle, flex: "1 1 220px" }}>
                    {t(COPY.owner)}
                    <input name="ownerLabel" style={{ ...consoleInputStyle, width: "100%" }} />
                  </label>
                </div>
                <label style={consoleLabelStyle}>
                  {t(COPY.title)}
                  <input name="title" style={{ ...consoleInputStyle, width: "100%", maxWidth: 640 }} data-testid="issue-title" />
                </label>
                <label style={consoleLabelStyle}>
                  {t(COPY.detail)}
                  <textarea name="detail" rows={2} style={{ ...consoleTextareaStyle, maxWidth: 640 }} />
                </label>
              </div>
            }
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title={t(COPY.feedback)} count={week.feedback.items.length} trailing={<StatusBadge status={week.feedback.reading.status} language={language} detail={t(week.feedback.reading.detail)} />}>
        <div className="app-stack app-stack-2">
          <Wrap>{t(week.feedback.reading.detail)}</Wrap>
          {week.feedback.items.length === 0 ? null : (
            <ul className="app-stack app-stack-1" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {week.feedback.items.slice(0, 8).map((item) => (
                <li key={item.id} className="app-meta" style={{ whiteSpace: "normal" }}>
                  <Chip>{item.kind}</Chip> {item.summary} ({item.status})
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={t(COPY.quality)}>
        <div className="app-stack app-stack-2">
          <span className="app-row app-row-wrap">
            <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{t(COPY.harness)}</span>
            <StatusBadge status={week.quality.harness.status} language={language} detail={t(week.quality.harness.detail)} />
            <span className="app-secondary" style={{ fontSize: "var(--app-text-xs)" }}>{t(COPY.modelOutput)}</span>
            <StatusBadge status={week.quality.modelOutput.status} language={language} detail={t(week.quality.modelOutput.detail)} />
          </span>
          <Wrap>{t(week.quality.modelOutput.detail)}</Wrap>
          {week.quality.byRole.map((role) => (
            <span key={role.roleId} className="app-row app-row-wrap">
              <span>{workspace.roles.find((entry) => entry.roleId === role.roleId)?.label ?? role.roleId}</span>
              <StatusBadge status={role.harness.status} language={language} detail={t(role.harness.detail)} />
              <span className="app-meta">
                {role.cases} {t(COPY.cases)}
              </span>
            </span>
          ))}
          <span className="app-meta">
            {t(COPY.runs)}: {week.quality.runs}
          </span>
        </div>
      </SettingsSection>
      {week.issues.open.length + week.issues.risks.length + week.issues.decisions.length === 0 && !canRaise ? (
        <Empty title={language === "de" ? "Keine offenen Punkte" : "Nothing open"} />
      ) : null}
    </div>
  );
}
