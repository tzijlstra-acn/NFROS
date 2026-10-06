/**
 * The Quality section of the Product Owner Console (plan 7.5).
 *
 * Per role and task: the configuration in force and any open candidate, each
 * with what its latest evaluation runs measured, the release gate's verdict
 * and the one or two controls that change it. Then what people did with the
 * AI's suggestions and said about its output. Runs and failed cases open on
 * their own page (`/product/quality/runs/[runId]`).
 *
 * Truth before theatre: the console never calls a model, so a structural run
 * is Simulated and says it graded synthetic envelopes, a safe-mode run says
 * how many cases it could grade, and latency and cost read "Not measured"
 * rather than zero.
 *
 * Server component. Every control is a `ConsoleActionForm` whose server
 * action goes through `governConsoleAction`.
 */

import Link from "next/link";
import { Field, FieldList, SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty, Item, List, Notice, ObjectRef } from "@/components/workday-v2/primitives";
import { StatusBadge } from "@/product/status";
import { getRoleRelease } from "@/product/release";
import type { Language } from "@/i18n/labels";
import { checkConsolePermission, type Bilingual } from "@/features/product/permissions";
import { readActingConsoleIdentity } from "@/features/product/persona/acting";
import { ConsoleActionForm } from "@/features/product/forms/ConsoleActionForm";
import { CONSOLE_COPY } from "@/features/product/shell/copy";
import { consoleInputStyle, consoleLabelStyle, consoleTextareaStyle, consoleWrapStyle } from "@/features/product/shell/styles";
import { actionApproveCandidate, actionRejectCandidate, actionRollBackConfiguration, actionRunEvaluation } from "./actions";
import { proposeApproveCandidate, proposeRollBack } from "./operations";
import { AI_FEEDBACK_KINDS, readPeopleSignals, readQualityGroups, type ConfigurationView, type Measured, type RunSignals } from "./model";
import { MODE_LABELS, FEEDBACK_KIND_LABELS, QUALITY_COPY as COPY } from "./copy";

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function roleLabel(roleId: string): string {
  return getRoleRelease(roleId)?.releaseLabel ?? roleId;
}

export async function QualityConsole({ language }: { language: Language }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const identity = await readActingConsoleIdentity();
  const can = (actionId: Parameters<typeof checkConsolePermission>[1]) => {
    const verdict = checkConsolePermission(identity.scopes, actionId);
    return { permitted: verdict.allowed, reason: verdict.allowed ? null : say(verdict.reason) };
  };

  let groups: ReturnType<typeof readQualityGroups>;
  try {
    groups = readQualityGroups();
  } catch {
    return (
      <div className="app-stack app-stack-6">
        <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />
        <Notice tone="warning">{say(COPY.unavailable)}</Notice>
      </div>
    );
  }
  const people = readPeopleSignals([...new Set(groups.map((group) => group.roleId))]);

  return (
    <div className="app-stack app-stack-6" data-testid="quality-console">
      <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.title)} lede={say(COPY.lede)} />
      <Notice>{say(COPY.noModel)}</Notice>

      {groups.map((group) => (
        <SettingsSection
          key={`${group.roleId}:${group.taskKind}`}
          title={`${roleLabel(group.roleId)}: ${group.taskKind}`}
          count={(group.inForce ? 1 : 0) + group.candidates.length}
        >
          <div className="app-stack app-stack-5" data-testid={`quality-group-${group.roleId}`}>
            {group.inForce ? (
              <ConfigurationBlock view={group.inForce} language={language} can={can} groupApproval={group.approval !== null} />
            ) : (
              <Empty title={say(COPY.noInForce)} />
            )}
            {group.candidates.length === 0 ? (
              <span className="app-meta">{say(COPY.noCandidate)}</span>
            ) : (
              group.candidates.map((view) => (
                <ConfigurationBlock key={view.configuration.id} view={view} language={language} can={can} groupApproval={false} />
              ))
            )}

            <div className="app-stack app-stack-2">
              <span className="app-eyebrow">{say(COPY.recentRuns)}</span>
              {group.recentRuns.length === 0 ? (
                <Empty title={say(COPY.noRuns)} detail={say(COPY.noRunsDetail)} />
              ) : (
                <List label={say(COPY.recentRuns)}>
                  {group.recentRuns.map((run) => (
                    <Item
                      key={run.id}
                      href={`/product/quality/runs/${run.id}`}
                      title={
                        <span className="app-row app-row-wrap">
                          <ObjectRef id={run.id} />
                          <span>{run.configurationId}</span>
                          <Chip tone={run.mode === "structural" ? "info" : "ai"}>{say(MODE_LABELS[run.mode] ?? { en: run.mode, de: run.mode })}</Chip>
                        </span>
                      }
                      subtitle={fill(say(COPY.runTally), {
                        passed: run.passed,
                        failed: run.failed,
                        notRun: run.notRun,
                        mandatory: run.mandatoryFailed,
                      })}
                      trailing={<Data>{(run.completedAt ?? run.startedAt).slice(0, 16).replace("T", " ")}</Data>}
                    />
                  ))}
                </List>
              )}
            </div>

            {group.decisions.length > 0 ? (
              <div className="app-stack app-stack-2">
                <span className="app-eyebrow">{say(COPY.decisions)}</span>
                <List label={say(COPY.decisions)}>
                  {group.decisions.map((decision) => (
                    <Item
                      key={decision.id}
                      title={
                        <span className="app-row app-row-wrap">
                          <Chip tone={decision.decision === "approved" ? (decision.rolledBackAt ? "neutral" : "success") : "warning"}>
                            {decision.rolledBackAt ? say(COPY.rolledBack) : decision.decision === "approved" ? say(COPY.approved) : say(COPY.rejected)}
                          </Chip>
                          <span>{decision.configurationId}</span>
                        </span>
                      }
                      subtitle={<span style={consoleWrapStyle}>{`${decision.decidedByLabel}: ${decision.rationale}`}</span>}
                      trailing={<Data>{decision.decidedAt.slice(0, 16).replace("T", " ")}</Data>}
                    />
                  ))}
                </List>
              </div>
            ) : null}
          </div>
        </SettingsSection>
      ))}

      <SettingsSection title={say(COPY.people)}>
        <div className="app-stack app-stack-3">
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.peopleNote)}</span>
          {people.map((entry) => {
            const decided = entry.dispositions.accepted + entry.dispositions.modified + entry.dispositions.rejected;
            const feedbackTotal = AI_FEEDBACK_KINDS.reduce((sum, kind) => sum + entry.feedback[kind], 0);
            return (
              <FieldList key={entry.roleId} label={roleLabel(entry.roleId)}>
                <Field label={roleLabel(entry.roleId)} value={<span className="app-strong">{say(COPY.suggestionsAndFeedback)}</span>} />
                <Field
                  label={say(COPY.userRejection)}
                  value={decided === 0 ? say(COPY.notMeasuredDecided) : fill(say(COPY.ofDecided), { count: entry.dispositions.rejected, decided })}
                />
                <Field
                  label={say(COPY.userModification)}
                  value={decided === 0 ? say(COPY.notMeasuredDecided) : fill(say(COPY.ofDecided), { count: entry.dispositions.modified, decided })}
                />
                <Field
                  label={say(COPY.userFeedback)}
                  value={
                    feedbackTotal === 0 ? (
                      say(COPY.noFeedback)
                    ) : (
                      <span className="app-row app-row-wrap">
                        {AI_FEEDBACK_KINDS.filter((kind) => entry.feedback[kind] > 0).map((kind) => (
                          <Chip key={kind}>{`${say(FEEDBACK_KIND_LABELS[kind])} ${entry.feedback[kind]}`}</Chip>
                        ))}
                      </span>
                    )
                  }
                  note={say(COPY.feedbackInboxNote)}
                />
              </FieldList>
            );
          })}
          <Link href="/product/feedback" className="app-source-link">
            {say(COPY.openInbox)}
          </Link>
        </div>
      </SettingsSection>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   One configuration
   --------------------------------------------------------------------------- */

type Can = (actionId: Parameters<typeof checkConsolePermission>[1]) => { permitted: boolean; reason: string | null };

function ConfigurationBlock({
  view,
  language,
  can,
  groupApproval,
}: {
  view: ConfigurationView;
  language: Language;
  can: Can;
  groupApproval: boolean;
}) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const { configuration, status } = view;
  const candidate = view.role === "candidate";
  const testId = `quality-config-${configuration.id}`;
  const run = can("quality.run-evaluation");
  const decide = can("quality.approve-candidate");
  const reject = can("quality.reject-candidate");
  const rollback = can("quality.roll-back");
  const approveProposal = candidate ? proposeApproveCandidate(configuration.id) : null;
  const rollbackProposal = !candidate && groupApproval ? proposeRollBack(configuration.roleId, configuration.taskKind) : null;

  return (
    <section className="app-stack app-stack-3" data-testid={testId}>
      <div className="app-row app-row-wrap app-between">
        <div className="app-stack app-stack-1" style={{ minWidth: 0 }}>
          <span className="app-object-title">{configuration.name}</span>
          <span className="app-row app-row-wrap">
            <ObjectRef id={configuration.id} />
            <Chip tone={candidate ? "ai" : "success"}>{candidate ? say(COPY.candidate) : say(COPY.inForce)}</Chip>
          </span>
        </div>
        <StatusBadge status={status.reading.status} language={language} detail={say(status.reading.detail)} />
      </div>

      <FieldList label={configuration.id}>
        <Field
          label={say(COPY.identity)}
          value={
            <span className="app-row app-row-wrap">
              <span className="app-oid">{configuration.promptVersion}</span>
              <span className="app-oid">{configuration.modelProfileId}</span>
              <span className="app-oid">{configuration.outputSchemaVersion}</span>
              <span className="app-oid">{configuration.evaluationSuiteId}</span>
            </span>
          }
          note={say(COPY.identityNote)}
        />
        <Field
          label={say(COPY.basis)}
          value={
            <span style={consoleWrapStyle}>
              {candidate
                ? `${say(COPY.basisCandidate)}${
                    view.latestDecision
                      ? ` ${fill(say(view.latestDecision.decision === "rejected" ? COPY.lastRejected : COPY.lastApproved), {
                          by: view.latestDecision.decidedByLabel,
                          at: view.latestDecision.decidedAt.slice(0, 10),
                        })}`
                      : ""
                  }`
                : view.latestDecision
                  ? fill(say(COPY.basisApproved), { by: view.latestDecision.decidedByLabel, at: view.latestDecision.decidedAt.slice(0, 10) })
                  : say(COPY.basisRegistry)}
            </span>
          }
          note={say(COPY.runtimeNote)}
        />
        {candidate ? (
          <Field
            label={say(COPY.gate)}
            value={
              <span className="app-stack app-stack-1" data-testid={`${testId}-gate`} data-blocked={status.verdict.blocked ? "true" : "false"}>
                <Chip tone={status.verdict.blocked ? "danger" : "success"}>{status.verdict.blocked ? say(COPY.blocked) : say(COPY.gatePassed)}</Chip>
                {status.verdict.reasons.map((reason) => (
                  <span key={reason.en} className="app-meta" style={consoleWrapStyle}>
                    {say(reason)}
                  </span>
                ))}
              </span>
            }
          />
        ) : null}
      </FieldList>

      {view.signals.length === 0 ? (
        <span className="app-meta">{say(COPY.notEvaluated)}</span>
      ) : (
        view.signals.map((signals) => <SignalList key={signals.run.id} signals={signals} language={language} />)
      )}

      <div className="app-row app-row-wrap" style={{ alignItems: "flex-start", gap: "var(--app-4)" }}>
        <ConsoleActionForm
          action={actionRunEvaluation}
          language={language}
          label={say(COPY.runEvaluation)}
          hidden={{ configurationId: configuration.id }}
          permitted={run.permitted}
          blockedReason={run.reason}
          testId={`${testId}-run`}
          fields={
            <label style={consoleLabelStyle}>
              {say(COPY.mode)}
              <select name="mode" defaultValue="structural" style={consoleInputStyle} data-testid={`${testId}-mode`}>
                <option value="structural">{say(MODE_LABELS.structural ?? { en: "", de: "" })}</option>
                <option value="grounding">{say(MODE_LABELS.grounding ?? { en: "", de: "" })}</option>
              </select>
            </label>
          }
        />
        {candidate && approveProposal ? (
          <ConsoleActionForm
            action={actionApproveCandidate}
            language={language}
            label={say(COPY.approve)}
            hidden={{ configurationId: configuration.id }}
            permitted={decide.permitted}
            blockedReason={decide.reason ?? (status.verdict.blocked ? say(status.verdict.reasons[0] ?? COPY.blocked) : null)}
            approval={{ lines: approveProposal.lines.map(say), fingerprint: approveProposal.fingerprint }}
            tone="primary"
            testId={`${testId}-approve`}
          />
        ) : null}
        {candidate ? (
          <ConsoleActionForm
            action={actionRejectCandidate}
            language={language}
            label={say(COPY.reject)}
            hidden={{ configurationId: configuration.id }}
            permitted={reject.permitted}
            blockedReason={reject.reason}
            testId={`${testId}-reject`}
            fields={
              <label style={consoleLabelStyle}>
                {say(COPY.rejectReason)}
                <textarea name="reason" rows={2} style={consoleTextareaStyle} data-testid={`${testId}-reject-reason`} />
              </label>
            }
          />
        ) : null}
        {rollbackProposal ? (
          <ConsoleActionForm
            action={actionRollBackConfiguration}
            language={language}
            label={say(COPY.rollBack)}
            hidden={{ roleId: configuration.roleId, taskKind: configuration.taskKind }}
            permitted={rollback.permitted}
            blockedReason={rollback.reason}
            approval={{ lines: rollbackProposal.lines.map(say), fingerprint: rollbackProposal.fingerprint }}
            tone="danger"
            testId={`${testId}-rollback`}
          />
        ) : null}
      </div>
    </section>
  );
}

function measuredText(measured: Measured, language: Language): string {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  if (!measured.measured) return say(COPY.notMeasuredMode);
  return fill(say(COPY.failedOfGraded), { failed: measured.failed, graded: measured.graded });
}

function SignalList({ signals, language }: { signals: RunSignals; language: Language }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const { run } = signals;
  return (
    <FieldList label={`${run.id} ${run.mode}`}>
      <Field
        label={say(COPY.latestRun)}
        value={
          <span className="app-row app-row-wrap">
            <Link href={`/product/quality/runs/${run.id}`} className="app-source-link">
              {run.id}
            </Link>
            <Chip tone={run.mode === "structural" ? "info" : "ai"}>{say(MODE_LABELS[run.mode] ?? { en: run.mode, de: run.mode })}</Chip>
            <Link href={`/product/quality/evidence?run=${run.id}`} className="app-source-link" prefetch={false}>
              {say(COPY.exportEvidence)}
            </Link>
          </span>
        }
      />
      <Field
        label={say(COPY.coverage)}
        value={fill(say(COPY.coverageValue), { graded: signals.coverage.graded, total: signals.coverage.total, notRun: signals.coverage.notRun })}
        note={fill(say(COPY.mandatoryValue), { total: signals.mandatory.total, failed: signals.mandatory.failed, notRun: signals.mandatory.notRun })}
      />
      <Field label={say(COPY.grounding)} value={measuredText(signals.grounding, language)} />
      <Field label={say(COPY.citations)} value={measuredText(signals.citations, language)} />
      <Field label={say(COPY.requiredSources)} value={measuredText(signals.requiredSources, language)} />
      <Field
        label={say(COPY.authority)}
        value={fill(say(COPY.authorityValue), {
          refused: signals.authority.refusedByGate,
          failures: signals.authority.failures,
          graded: signals.authority.graded,
        })}
      />
      <Field
        label={say(COPY.german)}
        value={fill(say(COPY.germanValue), { cases: signals.german.cases, graded: signals.german.graded, failed: signals.german.failed })}
        note={`${say(COPY.languageGrader)}: ${measuredText(signals.german.languageGraded, language)}`}
      />
      <Field
        label={say(COPY.latency)}
        value={signals.latency.measured ? `${signals.latency.medianMs} ms` : say(COPY.notMeasuredNoModel)}
      />
      <Field
        label={say(COPY.cost)}
        value={signals.cost.measured ? `USD ${signals.cost.totalUsd.toFixed(4)}` : say(COPY.notMeasuredNoModel)}
      />
    </FieldList>
  );
}
