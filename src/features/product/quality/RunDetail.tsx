/**
 * One evaluation run: every case, failed first, and the selected case
 * inspected (plan 7.5: Inspect failed case, Compare output).
 *
 * Inspecting shows the case's input and expectations (read from the case
 * file, which is versioned with the code), the output that was graded with
 * where it came from, and each grader's verdict. Compare puts the same case
 * beside the latest run of the same mode for every other configuration of the
 * role and task, so a candidate's answer sits next to the released one.
 *
 * Server component. Reading is permitted to every product-owner persona
 * (`quality.inspect-case` needs `console.read`); with no persona acting, the
 * case list shows and the outputs do not.
 */

import Link from "next/link";
import { Field, FieldList, SettingsHead, SettingsSection } from "@/components/settings/primitives";
import { Chip, Data, Empty, Item, List, Notice, ObjectRef, RegulatoryNote } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import { getCaseResultsAcrossRuns, getEvaluationCaseResults, getEvaluationRun, listEvaluationRuns, type AIEvaluationCaseResult } from "@/db/repositories/ai-evaluations";
import { checkConsolePermission, type Bilingual } from "@/features/product/permissions";
import { readActingConsoleIdentity } from "@/features/product/persona/acting";
import { CONSOLE_COPY } from "@/features/product/shell/copy";
import { consoleWrapStyle } from "@/features/product/shell/styles";
import { getConfiguration, listEvaluableConfigurations } from "./api";
import { latestCompletedByMode } from "./gate";
import { findEvaluationCase } from "./harness";
import { outputOf } from "./model";
import { CASE_STATUS_LABELS, MODE_LABELS, OUTPUT_SOURCE_LABELS, QUALITY_COPY as COPY } from "./copy";

export async function RunDetail({ runId, caseId, language }: { runId: string; caseId: string | null; language: Language }) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const run = getEvaluationRun(runId);
  if (!run) {
    return (
      <div className="app-stack app-stack-6">
        <SettingsHead eyebrow={say(CONSOLE_COPY.eyebrow)} title={say(COPY.runTitle)} />
        <Notice tone="warning">{say(COPY.noSuchRun)}</Notice>
        <Link href="/product/quality" className="app-source-link">
          {say(COPY.backToQuality)}
        </Link>
      </div>
    );
  }

  const identity = await readActingConsoleIdentity();
  const permitted = checkConsolePermission(identity.scopes, "quality.inspect-case").allowed;
  const cases = getEvaluationCaseResults(run.id);
  const selected = cases.find((entry) => entry.caseId === caseId) ?? cases.find((entry) => entry.status === "failed") ?? null;
  const configuration = getConfiguration(run.configurationId);

  return (
    <div className="app-stack app-stack-6" data-testid="quality-run">
      <SettingsHead
        eyebrow={say(CONSOLE_COPY.eyebrow)}
        title={`${say(COPY.runTitle)} ${run.id}`}
        lede={`${configuration?.name ?? run.configurationId}. ${say(MODE_LABELS[run.mode] ?? { en: run.mode, de: run.mode })}.`}
      />
      <span className="app-row app-row-wrap">
        <Link href="/product/quality" className="app-source-link">
          {say(COPY.backToQuality)}
        </Link>
        <Link href={`/product/quality/evidence?run=${run.id}`} className="app-source-link" prefetch={false}>
          {say(COPY.exportEvidence)}
        </Link>
      </span>

      <SettingsSection title={say(COPY.cases)} count={cases.length}>
        {cases.length === 0 ? (
          <Empty title={say(COPY.noRuns)} />
        ) : (
          <List label={say(COPY.cases)}>
            {cases.map((entry) => {
              const status = CASE_STATUS_LABELS[entry.status] ?? CASE_STATUS_LABELS["not-run"];
              return (
                <Item
                  key={entry.id}
                  href={`/product/quality/runs/${run.id}?case=${encodeURIComponent(entry.caseId)}`}
                  selected={selected?.caseId === entry.caseId}
                  title={
                    <span className="app-row app-row-wrap">
                      <Chip tone={status?.tone ?? "neutral"}>{status ? say(status) : entry.status}</Chip>
                      <ObjectRef id={entry.caseId} />
                      {entry.mandatory ? <Chip tone="warning">{say(COPY.mandatory)}</Chip> : null}
                      <span className="app-meta">{entry.taskKind}</span>
                    </span>
                  }
                  subtitle={entry.reason.length > 0 ? <span style={consoleWrapStyle}>{entry.reason}</span> : undefined}
                />
              );
            })}
          </List>
        )}
      </SettingsSection>

      {selected ? (
        permitted ? (
          <CaseInspection runId={run.id} mode={run.mode} roleId={run.roleId} taskKind={run.taskKind} configurationId={run.configurationId} entry={selected} language={language} />
        ) : (
          <Notice>{say(COPY.notPermittedInspect)}</Notice>
        )
      ) : null}
    </div>
  );
}

function CaseInspection({
  runId,
  mode,
  roleId,
  taskKind,
  configurationId,
  entry,
  language,
}: {
  runId: string;
  mode: string;
  roleId: string;
  taskKind: string;
  configurationId: string;
  entry: AIEvaluationCaseResult;
  language: Language;
}) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
  const list = (items: readonly string[]) => (items.length > 0 ? items.join(", ") : say(COPY.none));
  const definition = findEvaluationCase(entry.caseId);

  /* Compare: the same case in the latest run of this mode for each other configuration. */
  const others = listEvaluableConfigurations().filter(
    (configuration) => configuration.roleId === roleId && configuration.taskKind === taskKind && configuration.id !== configurationId,
  );
  const otherRuns = others
    .map((configuration) => latestCompletedByMode(listEvaluationRuns({ configurationId: configuration.id })).find((run) => run.mode === mode))
    .filter((run): run is NonNullable<typeof run> => run !== undefined);
  const compared = getCaseResultsAcrossRuns(entry.caseId, otherRuns.map((run) => run.id));

  return (
    <SettingsSection title={`${say(COPY.inspect)} ${entry.caseId}`}>
      <div className="app-stack app-stack-4" data-testid="quality-case">
        {definition ? (
          <FieldList label={say(COPY.input)}>
            <Field label={say(COPY.input)} value={<span style={consoleWrapStyle} data-testid="quality-case-input">{definition.input}</span>} note={say(COPY.caseFileNote)} />
            <Field
              label={say(COPY.expected)}
              value={
                <span className="app-stack app-stack-1" data-testid="quality-case-expected">
                  {definition.expectedStructure ? (
                    <span style={consoleWrapStyle}>
                      {fill(say(COPY.expParts), {
                        must: list(definition.expectedStructure.mustHaveParts),
                        never: list(definition.expectedStructure.mustNotHaveParts),
                      })}
                    </span>
                  ) : null}
                  {definition.requiredSources && definition.requiredSources.length > 0 ? (
                    <span style={consoleWrapStyle}>{fill(say(COPY.expSources), { sources: list(definition.requiredSources) })}</span>
                  ) : null}
                  {definition.expectedCitations ? (
                    <span>{fill(say(COPY.expCitations), { count: definition.expectedCitations.minimumSourcesReferenced })}</span>
                  ) : null}
                  {definition.expectedAuthorityBehavior?.mustReturnBlockedPart ? (
                    <span style={consoleWrapStyle}>
                      {fill(say(COPY.expRefused), { action: definition.expectedAuthorityBehavior.prohibitedActionTriggered ?? "" })}
                    </span>
                  ) : null}
                  {definition.expectedLanguageBehavior ? (
                    <span style={consoleWrapStyle}>
                      {fill(say(COPY.expLanguage), {
                        language: definition.expectedLanguageBehavior.outputLanguage,
                        terms: list(definition.expectedLanguageBehavior.mustUseTerms),
                      })}
                    </span>
                  ) : null}
                  {definition.jurisdictionConstraints ? (
                    <span className="app-stack app-stack-1">
                      <span style={consoleWrapStyle}>
                        {fill(say(COPY.expJurisdiction), {
                          dora: list(definition.jurisdictionConstraints.doraAppliesTo),
                          notDora: list(definition.jurisdictionConstraints.doraDoesNotApplyTo),
                          finma: list(definition.jurisdictionConstraints.finmaAppliesTo),
                        })}
                      </span>
                      <RegulatoryNote language={language} />
                    </span>
                  ) : null}
                </span>
              }
            />
          </FieldList>
        ) : (
          <Notice tone="warning">{say(COPY.caseMissing)}</Notice>
        )}

        <FieldList label={say(COPY.graders)}>
          {entry.graderResults.length === 0 ? (
            <Field label={say(COPY.graders)} value={<span style={consoleWrapStyle}>{entry.reason}</span>} />
          ) : (
            entry.graderResults.map((result) => (
              <Field
                key={result.grader}
                label={result.grader}
                value={
                  <span className="app-row app-row-wrap" style={{ alignItems: "flex-start" }}>
                    <Chip tone={result.passed ? "success" : "danger"}>{say(result.passed ? CASE_STATUS_LABELS.passed ?? COPY.approved : CASE_STATUS_LABELS.failed ?? COPY.rejected)}</Chip>
                    <span style={consoleWrapStyle}>{result.details}</span>
                  </span>
                }
              />
            ))
          )}
        </FieldList>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--app-4)" }}>
          <OutputPanel title={`${say(COPY.actual)}: ${configurationId}`} entry={entry} language={language} testId="quality-case-actual" runId={runId} />
          {compared.map((other) => (
            <OutputPanel
              key={other.id}
              title={`${say(COPY.compare)}: ${otherRuns.find((run) => run.id === other.evaluationRunId)?.configurationId ?? other.evaluationRunId}`}
              entry={other}
              language={language}
              testId="quality-case-compare"
              runId={other.evaluationRunId}
              comparedWith={entry}
            />
          ))}
        </div>
        {compared.length === 0 ? <span className="app-meta">{say(COPY.compareNone)}</span> : <span className="app-meta">{say(COPY.compareNote)}</span>}
        {definition?.jurisdictionConstraints ? <span className="app-meta" style={consoleWrapStyle}>{say(COPY.regulatory)}</span> : null}
      </div>
    </SettingsSection>
  );
}

function OutputPanel({
  title,
  entry,
  language,
  testId,
  runId,
  comparedWith,
}: {
  title: string;
  entry: AIEvaluationCaseResult;
  language: Language;
  testId: string;
  runId: string;
  comparedWith?: AIEvaluationCaseResult;
}) {
  const say = (pair: Bilingual) => (language === "de" ? pair.de : pair.en);
  const output = outputOf(entry);
  return (
    <div className="app-stack app-stack-2" data-testid={testId} style={{ minWidth: 0 }}>
      <span className="app-strong" style={{ fontSize: "var(--app-text-sm)", ...consoleWrapStyle }}>
        {title}
      </span>
      <span className="app-meta">
        <Link href={`/product/quality/runs/${runId}?case=${encodeURIComponent(entry.caseId)}`} className="app-source-link">
          {runId}
        </Link>
      </span>
      {comparedWith ? (
        <span className="app-meta" style={consoleWrapStyle} data-testid={`${testId}-verdict`}>
          {entry.outputDigest !== null && entry.outputDigest === comparedWith.outputDigest ? say(COPY.sameOutput) : say(COPY.differentOutput)}
        </span>
      ) : null}
      {output ? (
        <>
          <span className="app-meta">
            {say(COPY.outputSource)}: {say(OUTPUT_SOURCE_LABELS[output.source] ?? { en: output.source, de: output.source })}
          </span>
          <ul className="app-stack app-stack-1" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {output.parts.map((part, index) => (
              <li key={`${part.kind}-${index}`} className="app-stack app-stack-1" style={{ borderLeft: "2px solid var(--app-border)", paddingLeft: "var(--app-2)" }}>
                <span className="app-row app-row-wrap">
                  <Chip>{part.kind}</Chip>
                  {(part.refs ?? []).map((ref) => (
                    <Data key={ref}>{ref}</Data>
                  ))}
                </span>
                <span className="app-secondary" style={{ fontSize: "var(--app-text-sm)", ...consoleWrapStyle }}>
                  {part.text}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <span className="app-meta" style={consoleWrapStyle}>
          {say(COPY.noOutput)} {entry.reason}
        </span>
      )}
    </div>
  );
}
