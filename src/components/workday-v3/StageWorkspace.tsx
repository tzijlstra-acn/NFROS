/**
 * StageWorkspace: the generic stage renderer for Role App process pages.
 *
 * Server-rendered and driven entirely by the stage contract, through the view
 * model in `src/features/process/view.ts`. It renders, in order:
 *
 *   the stage heading and status, and the human responsibility
 *   source status (the "Evidence status" region on the onboarding page)
 *   what people attached to the stage as input (an inbox message, minutes,
 *   a document), when anything is attached
 *   the AI preparation and its durable job state
 *   the human tasks, as the forms their stage registered
 *   the decisions, with prepared position, options and consequences
 *   the governed changes and the approval they need
 *   the completion criteria with live checks, the blocking conditions, and
 *   Continue, disabled with its reasons until the criteria pass
 *   the stored artifacts and the recent events from the event backbone
 *
 * It decides nothing. Every "may this happen" is answered by the engine
 * before the view reaches this component, and answered again by the engine
 * when the form is submitted, so a disabled button is a courtesy and not the
 * control.
 *
 * Status badge colour tokens:
 *   completed         wd-success
 *   in-progress       wd-accent
 *   waiting-for-input wd-warning (amber)
 *   blocked           wd-danger
 *   ready, locked     wd-text-muted, wd-text-disabled
 *
 * No em dashes. No umlauts. No Tailwind. Server component.
 */

import type { CSSProperties, ReactNode } from "react";
import { IconAlertTriangle, IconCheck, IconCircleDashed, IconLock } from "@tabler/icons-react";
import type { Language } from "@/i18n/labels";
import type { StageView } from "@/features/process/view";
import { PROCESS_COPY as C, say } from "@/features/process/copy";
import {
  actionCompleteStage,
  actionExecuteStageTools,
  actionRecordStageDecision,
  actionRecordStageTask,
  actionStartPreparation,
} from "@/features/process/actions";
import { StageActionForm } from "@/features/process/StageActionForm";
import { StageSync } from "@/features/process/StageSync";

export interface StageWorkspaceProps {
  view: StageView;
  language: Language;
}

/* ---------------------------------------------------------------------------
   Styles
   --------------------------------------------------------------------------- */

function labelStyle(): CSSProperties {
  return {
    display: "block",
    fontSize: "var(--wd-text-xs)",
    fontWeight: "var(--wd-weight-medium)" as unknown as number,
    color: "var(--wd-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "var(--wd-2)",
  };
}

const panel: CSSProperties = {
  padding: "var(--wd-4)",
  background: "var(--wd-surface)",
  border: "1px solid var(--wd-border)",
  borderRadius: "var(--wd-radius)",
  minWidth: 0,
};

const subtle: CSSProperties = {
  padding: "var(--wd-3) var(--wd-4)",
  background: "var(--wd-surface-subtle)",
  border: "1px solid var(--wd-border)",
  borderRadius: "var(--wd-radius)",
  minWidth: 0,
};

const bodyText: CSSProperties = {
  fontSize: "var(--wd-text-sm)",
  color: "var(--wd-text-secondary)",
  lineHeight: "var(--wd-leading-normal)",
  margin: 0,
  overflowWrap: "anywhere",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "var(--wd-2) var(--wd-3)",
  fontSize: "var(--wd-text-sm)",
  color: "var(--wd-text)",
  background: "var(--wd-surface-subtle)",
  border: "1px solid var(--wd-border)",
  borderRadius: "var(--wd-radius)",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function badgeStyle(tone: "ok" | "muted" | "warning" | "danger" | "accent"): CSSProperties {
  const tones: Record<typeof tone, { background: string; color: string; border: string }> = {
    ok: { background: "var(--wd-success-soft)", color: "var(--wd-success)", border: "1px solid var(--wd-success-soft)" },
    accent: { background: "var(--wd-accent-soft)", color: "var(--wd-accent)", border: "1px solid var(--wd-accent-border)" },
    warning: {
      background: "var(--wd-warning-soft, color-mix(in srgb, var(--wd-accent-soft) 60%, transparent))",
      color: "var(--wd-warning, var(--wd-accent))",
      border: "1px solid var(--wd-warning-border, var(--wd-accent-border))",
    },
    danger: { background: "var(--wd-danger-soft)", color: "var(--wd-danger)", border: "1px solid var(--wd-danger-soft)" },
    muted: { background: "var(--wd-surface-subtle)", color: "var(--wd-text-muted)", border: "1px solid var(--wd-border)" },
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px var(--wd-3)",
    borderRadius: "var(--wd-radius-pill)",
    fontSize: "var(--wd-text-xs)",
    fontWeight: "var(--wd-weight-medium)" as unknown as number,
    whiteSpace: "nowrap",
    flexShrink: 0,
    ...tones[tone],
  };
}

function statusTone(status: StageView["statusKey"]): "ok" | "muted" | "warning" | "danger" | "accent" {
  switch (status) {
    case "completed":
      return "ok";
    case "in-progress":
      return "accent";
    case "waiting-for-input":
      return "warning";
    case "blocked":
      return "danger";
    default:
      return "muted";
  }
}

function prepTone(state: string): "ok" | "muted" | "warning" | "danger" | "accent" {
  if (state === "completed") return "ok";
  if (state === "failed") return "danger";
  if (state === "waiting-for-source" || state === "waiting-for-approval" || state === "retrying") return "warning";
  if (state === "running" || state === "queued") return "accent";
  return "muted";
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  return iso.length >= 16 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso;
}

function Section({ label, children, region, testId }: { label: string; children: ReactNode; region?: string | null; testId?: string }) {
  return (
    <div
      data-testid={testId}
      {...(region ? { "data-presentation-region": region, "data-presentation-ready": "true" } : {})}
      style={{ minWidth: 0 }}
    >
      <span style={labelStyle()}>{label}</span>
      {children}
    </div>
  );
}

function hiddenFor(view: StageView): Record<string, string> {
  return { processRunId: view.processRunId, stageId: view.stageId, roleId: view.roleId };
}

function ConfirmFields({ language, rationaleDefault = "" }: { language: Language; rationaleDefault?: string }) {
  return (
    <>
      <label style={{ display: "flex", flexDirection: "column", gap: "var(--wd-1)", fontSize: "var(--wd-text-sm)", color: "var(--wd-text)" }}>
        <span style={{ fontWeight: 500 }}>{say(C.rationale, language)}</span>
        <textarea name="rationale" rows={3} defaultValue={rationaleDefault} placeholder={say(C.rationalePlaceholder, language)} style={{ ...inputStyle, resize: "vertical", lineHeight: "var(--wd-leading-normal)" }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "var(--wd-2)", fontSize: "var(--wd-text-sm)", color: "var(--wd-text)" }}>
        <input type="checkbox" name="rationaleConfirmed" />
        <span>{say(C.confirmOwn, language)}</span>
      </label>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Sections
   --------------------------------------------------------------------------- */

function SourcesSection({ view, language }: StageWorkspaceProps) {
  if (view.sources.length === 0) return null;
  const label = view.sourcesRegion ? say(C.evidenceStatus, language) : say(C.sources, language);
  return (
    <Section label={label} region={view.sourcesRegion} testId="stage-sources">
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
        {view.sources.map((source) => (
          <li key={source.key} style={subtle}>
            <details>
              <summary style={{ display: "flex", alignItems: "center", gap: "var(--wd-3)", flexWrap: "wrap", cursor: "pointer", listStyle: "none" }}>
                <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: "var(--wd-text-sm)", fontWeight: 500, color: "var(--wd-text)" }}>{source.label}</span>
                <span style={{ fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)" }}>
                  {source.necessity}, {source.count} {say(source.count === 1 ? C.recordSingular : C.records, language)}
                </span>
                <span style={badgeStyle(source.badgeTone)}>{source.badge}</span>
              </summary>
              {source.detail ? <p style={{ ...bodyText, marginTop: "var(--wd-2)", fontSize: "var(--wd-text-xs)" }}>{source.detail}</p> : null}
              {source.records.length > 0 ? (
                <ul style={{ listStyle: "none", margin: "var(--wd-2) 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
                  {source.records.map((record) => (
                    <li key={record.id} style={{ display: "flex", gap: "var(--wd-3)", fontSize: "var(--wd-text-xs)", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--wd-font-mono)", color: "var(--wd-text-muted)", minWidth: 120 }}>{record.id}</span>
                      <span style={{ flex: "1 1 200px", minWidth: 0, color: "var(--wd-text-secondary)", overflowWrap: "anywhere" }}>{record.label}</span>
                      <span style={{ color: "var(--wd-text)" }}>{record.value}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** What people attached to the stage as input, beside the sources. Shown only when something is attached. */
function InputsSection({ view, language }: StageWorkspaceProps) {
  if (view.inputs.length === 0) return null;
  return (
    <Section label={say(C.stageInputs, language)} testId="stage-inputs">
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
        {view.inputs.map((input) => (
          <li key={input.id} data-input-source={input.sourceId} style={{ ...subtle, display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--wd-3)", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--wd-font-mono)", fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)" }}>{input.sourceId}</span>
              <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: "var(--wd-text-sm)", fontWeight: 500, color: "var(--wd-text)", overflowWrap: "anywhere" }}>{input.title}</span>
              <span style={badgeStyle("muted")}>{input.kind}</span>
            </div>
            <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>
              {input.from ? `${input.from}. ` : ""}
              {input.added}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PreparationSection({ view, language }: StageWorkspaceProps) {
  const prep = view.preparation;
  return (
    <Section label={say(C.aiPrepared, language)} testId="stage-preparation">
      <div style={{ padding: "var(--wd-4)", background: "var(--wd-accent-soft)", border: "1px solid var(--wd-accent-border)", borderRadius: "var(--wd-radius)", display: "flex", flexDirection: "column", gap: "var(--wd-3)", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--wd-2)", flexWrap: "wrap" }}>
          <span data-testid="preparation-state" style={badgeStyle(prepTone(prep.stateKey))}>{prep.state}</span>
          {prep.modeLabel ? <span style={badgeStyle("muted")}>{prep.modeLabel}</span> : null}
          {prep.sourceNote ? <span style={{ fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)" }}>{prep.sourceNote}</span> : null}
        </div>
        {prep.summary ? <p style={bodyText}>{prep.summary}</p> : null}
        {!prep.summary && prep.prepares.length > 0 ? (
          <p style={bodyText}>
            {say(C.whatAiPrepares, language)}: {prep.prepares.join(", ")}.
          </p>
        ) : null}
        {prep.reason ? <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{prep.reason}</p> : null}
        {prep.canStart ? (
          <StageActionForm
            action={actionStartPreparation}
            hidden={hiddenFor(view)}
            submitLabel={prep.startLabel}
            workingLabel={say(C.working, language)}
            ariaLabel={prep.startLabel}
            testId="start-preparation"
          />
        ) : null}
        {prep.findings.length > 0 ? (
          <details>
            <summary style={{ cursor: "pointer", fontSize: "var(--wd-text-xs)", fontWeight: 600, color: "var(--wd-accent)" }}>
              {say(C.findings, language)} ({prep.findings.length})
            </summary>
            <ul style={{ margin: "var(--wd-2) 0 0", paddingLeft: "var(--wd-5)", display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
              {prep.findings.map((finding) => (
                <li key={finding.text} style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>
                  {finding.text}
                  {finding.evidenceIds.length > 0 ? <span style={{ color: "var(--wd-text-muted)" }}> [{finding.evidenceIds.join(", ")}]</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {prep.inferences.map((inference) => (
          <div key={inference.text} style={{ ...subtle, background: "var(--wd-surface)" }}>
            <span style={{ ...labelStyle(), marginBottom: "var(--wd-1)" }}>{say(C.inference, language)}</span>
            <p style={bodyText}>{inference.text}</p>
            <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)", marginTop: "var(--wd-1)" }}>
              {say(C.uncertainty, language)}: {inference.uncertainty}
            </p>
          </div>
        ))}
        {prep.contradictions.length > 0 ? (
          <div>
            <span style={{ ...labelStyle(), marginBottom: "var(--wd-1)" }}>{say(C.contradictions, language)}</span>
            <ul style={{ margin: 0, paddingLeft: "var(--wd-5)", display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
              {prep.contradictions.map((item) => (
                <li key={item.text} style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{item.text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {prep.gaps.length > 0 ? (
          <div>
            <span style={{ ...labelStyle(), marginBottom: "var(--wd-1)" }}>{say(C.gaps, language)}</span>
            <ul style={{ margin: 0, paddingLeft: "var(--wd-5)", display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
              {prep.gaps.map((gap) => (
                <li key={gap.text} style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{gap.text}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {prep.limitations.length > 0 ? (
          <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>
            {say(C.limitations, language)}: {prep.limitations.join(" ")}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function TasksSection({ view, language }: StageWorkspaceProps) {
  if (view.tasks.length === 0) return null;
  return (
    <Section label={say(C.yourTask, language)} testId="stage-tasks">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
        {view.tasks.map((task) => (
          <div key={task.key} style={{ ...panel, border: task.status === "pending" && task.canRecord ? "1.5px solid var(--wd-accent-border)" : panel.border }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--wd-2)", flexWrap: "wrap", marginBottom: "var(--wd-2)" }}>
              <span style={{ fontSize: "var(--wd-text-base)", fontWeight: 600, color: "var(--wd-text)" }}>{task.label}</span>
              {task.status === "recorded" ? <span style={badgeStyle("ok")}>{say(C.recorded, language)}</span> : null}
            </div>
            <p style={{ ...bodyText, marginBottom: "var(--wd-3)" }}>{task.instruction}</p>
            {task.recordedSummary.length > 0 ? (
              <ul style={{ margin: "0 0 var(--wd-3)", paddingLeft: "var(--wd-5)" }}>
                {task.recordedSummary.map((line) => (
                  <li key={line} style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{line}</li>
                ))}
              </ul>
            ) : null}
            {task.canRecord && task.layout ? (
              <StageActionForm
                action={actionRecordStageTask}
                hidden={{ ...hiddenFor(view), taskKey: task.key }}
                submitLabel={say(task.status === "recorded" ? C.recordAgain : C.record, language)}
                workingLabel={say(C.working, language)}
                ariaLabel={task.label}
                testId={`task-${task.key}`}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
                  {task.layout.rows.map((row) => (
                    <fieldset key={row.id} style={{ ...subtle, margin: 0, display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
                      <legend style={{ fontSize: "var(--wd-text-sm)", fontWeight: 500, color: "var(--wd-text)", padding: 0, overflowWrap: "anywhere" }}>{row.label}</legend>
                      {row.detail ? <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{row.detail}</p> : null}
                      <div style={{ display: "flex", gap: "var(--wd-3)", flexWrap: "wrap" }}>
                        {row.choice.options.map((option) => (
                          <label key={option.value} style={{ display: "inline-flex", alignItems: "center", gap: "var(--wd-1)", fontSize: "var(--wd-text-sm)", color: "var(--wd-text)" }}>
                            <input type="radio" name={row.choice.name} value={option.value} defaultChecked={row.choice.value === option.value} />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "var(--wd-2)", flexWrap: "wrap" }}>
                        {row.note ? (
                          <input type="text" name={row.note.name} defaultValue={row.note.value} placeholder={row.note.placeholder} aria-label={`${row.label}: ${row.note.placeholder}`} style={{ ...inputStyle, flex: "1 1 260px" }} />
                        ) : null}
                        {row.date ? (
                          <label style={{ display: "inline-flex", alignItems: "center", gap: "var(--wd-2)", fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)" }}>
                            {row.date.label}
                            <input type="date" name={row.date.name} defaultValue={row.date.value} style={{ ...inputStyle, width: "auto" }} />
                          </label>
                        ) : null}
                      </div>
                    </fieldset>
                  ))}
                  {task.layout.overall ? (
                    <label style={{ display: "flex", flexDirection: "column", gap: "var(--wd-1)", fontSize: "var(--wd-text-sm)", color: "var(--wd-text)" }}>
                      {task.layout.overall.label}
                      <textarea name={task.layout.overall.name} rows={2} defaultValue={task.layout.overall.value} style={{ ...inputStyle, resize: "vertical" }} />
                    </label>
                  ) : null}
                </div>
              </StageActionForm>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function DecisionsSection({ view, language }: StageWorkspaceProps) {
  if (view.decisions.length === 0) return null;
  return (
    <Section label={say(C.decision, language)} testId="stage-decisions">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
        {view.decisions.map((decision) => (
          <div key={decision.key} style={{ ...panel, border: decision.canRecord ? "1.5px solid var(--wd-accent-border)" : panel.border, display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--wd-2)", flexWrap: "wrap" }}>
              <span style={{ fontSize: "var(--wd-text-base)", fontWeight: 600, color: "var(--wd-text)" }}>{decision.label}</span>
              {decision.decisionId ? <span style={{ fontSize: "var(--wd-text-xs)", fontFamily: "var(--wd-font-mono)", color: "var(--wd-text-muted)" }}>{decision.decisionId}</span> : null}
              {decision.status === "recorded" ? <span style={badgeStyle(decision.outcome === "hold" ? "warning" : "ok")}>{say(C.recorded, language)}</span> : null}
              {decision.binding === "seeded-decision" ? (
                <a href={decision.decisionsHref} style={{ marginLeft: "auto", fontSize: "var(--wd-text-xs)", color: "var(--wd-accent)" }}>{say(C.openInDecisions, language)}</a>
              ) : null}
            </div>
            <p style={{ ...bodyText, color: "var(--wd-text)" }}>{decision.question}</p>
            {decision.status === "recorded" ? (
              <div style={subtle}>
                <p style={{ ...bodyText, color: "var(--wd-text)", fontWeight: 500 }}>{decision.chosenLabel}</p>
                {decision.rationale ? <p style={{ ...bodyText, marginTop: "var(--wd-1)" }}>{decision.rationale}</p> : null}
                <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)", marginTop: "var(--wd-1)" }}>
                  {say(C.decidedBy, language)} {decision.decidedBy ?? ""} {formatTimestamp(decision.decidedAt)}
                </p>
              </div>
            ) : null}
            {decision.preparedPosition && decision.status === "pending" ? (
              <details>
                <summary style={{ cursor: "pointer", fontSize: "var(--wd-text-xs)", fontWeight: 600, color: "var(--wd-accent)" }}>{say(C.preparedPosition, language)}</summary>
                <p style={{ ...bodyText, marginTop: "var(--wd-2)" }}>{decision.preparedPosition}</p>
                {decision.uncertainty ? <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)", marginTop: "var(--wd-1)" }}>{say(C.uncertainty, language)}: {decision.uncertainty}</p> : null}
              </details>
            ) : null}
            {decision.canRecord ? (
              <StageActionForm
                action={actionRecordStageDecision}
                hidden={{ ...hiddenFor(view), decisionKey: decision.key }}
                submitLabel={say(decision.revisable ? C.reviseDecision : C.recordDecision, language)}
                workingLabel={say(C.working, language)}
                ariaLabel={decision.label}
                testId={`decision-${decision.key}`}
              >
                <div role="radiogroup" aria-label={decision.label} style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
                  {decision.options.map((option) => (
                    <label key={option.id} style={{ ...subtle, display: "flex", gap: "var(--wd-3)", alignItems: "flex-start", cursor: "pointer" }}>
                      <input type="radio" name="optionId" value={option.id} style={{ marginTop: 4 }} />
                      <span style={{ display: "flex", flexDirection: "column", gap: "var(--wd-1)", minWidth: 0 }}>
                        <span style={{ fontSize: "var(--wd-text-sm)", fontWeight: 600, color: "var(--wd-text)" }}>
                          {option.label}
                          {option.recommended ? <span style={{ ...badgeStyle("accent"), marginLeft: "var(--wd-2)" }}>{say(C.aiRecommends, language)}</span> : null}
                        </span>
                        <span style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{option.description}</span>
                        {option.consequences.length > 0 ? (
                          <span style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>
                            {say(C.whatChanges, language)}: {option.consequences.join("; ")}.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <ConfirmFields language={language} />
              </StageActionForm>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

function ToolsSection({ view, language }: StageWorkspaceProps) {
  if (view.tools.length === 0) {
    if (!view.isOpen || view.preparation.stateKey !== "completed") return null;
    const hasTools = view.decisions.length > 0;
    return hasTools ? (
      <Section label={say(C.governedChanges, language)} testId="stage-tools">
        <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{say(C.nothingProposed, language)}</p>
      </Section>
    ) : null;
  }
  return (
    <Section label={say(C.governedChanges, language)} testId="stage-tools">
      <div style={{ ...panel, display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
          {view.tools.map((tool) => (
            <li key={tool.key} data-testid={`tool-${tool.key}`} style={subtle}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--wd-2)", flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: "var(--wd-text-sm)", fontWeight: 500, color: "var(--wd-text)" }}>{tool.label}</span>
                <span style={badgeStyle(tool.stateKey === "acknowledged" || tool.stateKey === "executed" ? "ok" : tool.stateKey === "failed" || tool.stateKey === "blocked" ? "danger" : tool.stateKey === "queued" ? "warning" : "accent")}>
                  {tool.state}
                  {tool.externalId ? ` ${tool.externalId}` : ""}
                </span>
              </div>
              <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)", marginTop: "var(--wd-1)" }}>
                {tool.channel}, {tool.authorityClass}
                {tool.needsApproval && (tool.stateKey === "proposed" || tool.stateKey === "failed") ? `, ${say(C.approvalRequired, language).toLowerCase()}` : ""}
              </p>
              {tool.intent ? <p style={{ ...bodyText, marginTop: "var(--wd-1)" }}>{tool.intent}</p> : null}
              {tool.unavailable ? <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)", marginTop: "var(--wd-1)" }}>{tool.unavailable}</p> : null}
              {tool.summary && tool.stateKey !== "proposed" ? <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)", marginTop: "var(--wd-1)" }}>{tool.summary}</p> : null}
            </li>
          ))}
        </ul>
        {view.canExecuteTools ? (
          <StageActionForm
            action={actionExecuteStageTools}
            hidden={hiddenFor(view)}
            submitLabel={say(C.approveAndExecute, language)}
            workingLabel={say(C.working, language)}
            ariaLabel={say(C.governedChanges, language)}
            testId="execute-tools"
          >
            {view.toolsNeedApproval ? <ConfirmFields language={language} /> : null}
          </StageActionForm>
        ) : null}
      </div>
    </Section>
  );
}

function CompletionSection({ view, language }: StageWorkspaceProps) {
  if (view.isCompleted && view.completion) {
    return (
      <Section label={say(C.completed, language)} testId="stage-completion">
        <div style={{ ...subtle, background: "var(--wd-success-soft)", borderColor: "var(--wd-success-soft)" }}>
          <p style={{ ...bodyText, color: "var(--wd-success)", fontWeight: 500 }}>
            {say(C.completedBy, language)} {view.completion.completedBy ?? ""} {formatTimestamp(view.completion.completedAt)}
          </p>
          {view.completion.rationale ? <p style={{ ...bodyText, marginTop: "var(--wd-1)" }}>{view.completion.rationale}</p> : null}
        </div>
      </Section>
    );
  }
  if (!view.isOpen) return null;

  return (
    <Section label={say(C.criteria, language)} testId="stage-completion">
      <div style={{ ...panel, display: "flex", flexDirection: "column", gap: "var(--wd-3)" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--wd-1)" }}>
          {view.criteria.map((criterion) => (
            <li key={criterion.label} data-met={criterion.met ? "true" : "false"} style={{ display: "flex", gap: "var(--wd-2)", alignItems: "flex-start", fontSize: "var(--wd-text-sm)" }}>
              {criterion.met ? (
                <IconCheck size={16} stroke={2} aria-hidden="true" style={{ color: "var(--wd-success)", flexShrink: 0, marginTop: 2 }} />
              ) : (
                <IconCircleDashed size={16} stroke={2} aria-hidden="true" style={{ color: "var(--wd-text-muted)", flexShrink: 0, marginTop: 2 }} />
              )}
              <span style={{ minWidth: 0, color: criterion.met ? "var(--wd-text)" : "var(--wd-text-secondary)" }}>
                <span className="sr-only">
                  {criterion.met ? (language === "de" ? "Erfuellt: " : "Met: ") : language === "de" ? "Nicht erfuellt: " : "Not met: "}
                </span>
                {criterion.label}
              </span>
            </li>
          ))}
        </ul>
        {view.blocking.length > 0 ? (
          <div style={{ ...subtle, borderColor: "var(--wd-danger-soft)" }}>
            <span style={{ ...labelStyle(), color: "var(--wd-danger)", marginBottom: "var(--wd-1)" }}>
              <IconAlertTriangle size={12} stroke={2} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 4 }} />
              {say(C.blocking, language)}
            </span>
            {view.blocking.map((item) => (
              <p key={item.label} style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>
                {item.label}
                {item.detail ? `. ${item.detail}` : ""}
              </p>
            ))}
          </div>
        ) : null}
        {!view.canComplete ? (
          <div data-testid="continue-disabled-reasons">
            <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)", fontWeight: 600, color: "var(--wd-text)" }}>{say(C.continueDisabled, language)}</p>
            <ul style={{ margin: "var(--wd-1) 0 0", paddingLeft: "var(--wd-5)" }}>
              {view.completeReasons.slice(0, 6).map((reason) => (
                <li key={reason} style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{say(C.completionNote, language)}</p>
        )}
        <StageActionForm
          action={actionCompleteStage}
          hidden={hiddenFor(view)}
          submitLabel={say(C.completeAndContinue, language)}
          workingLabel={say(C.working, language)}
          ariaLabel={say(C.completeAndContinue, language)}
          disabled={!view.canComplete}
          testId="complete-stage"
        >
          {view.canComplete ? <ConfirmFields language={language} /> : null}
        </StageActionForm>
      </div>
    </Section>
  );
}

function ArtifactsSection({ view, language }: StageWorkspaceProps) {
  if (view.stageRunId === null) return null;
  return (
    <Section label={say(C.artifacts, language)} testId="stage-artifacts">
      {view.artifacts.length === 0 ? (
        <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{say(C.noArtifacts, language)}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
          {view.artifacts.map((artifact) => (
            <details key={artifact.id} style={subtle}>
              <summary style={{ cursor: "pointer", display: "flex", gap: "var(--wd-2)", flexWrap: "wrap", alignItems: "center", listStyle: "none" }}>
                <span style={{ fontSize: "var(--wd-text-sm)", fontWeight: 500, color: "var(--wd-text)" }}>{artifact.label}</span>
                <span style={{ fontSize: "var(--wd-text-xs)", color: "var(--wd-text-muted)" }}>
                  {say(C.version, language)} {artifact.version}, {formatTimestamp(artifact.createdAt)}
                  {artifact.mode ? `, ${artifact.mode}` : ""}
                </span>
              </summary>
              {artifact.lines.length > 0 ? (
                <ul style={{ margin: "var(--wd-2) 0 0", paddingLeft: "var(--wd-5)" }}>
                  {artifact.lines.map((line) => (
                    <li key={line} style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </details>
          ))}
        </div>
      )}
    </Section>
  );
}

function EventsSection({ view, language }: StageWorkspaceProps) {
  return (
    <details data-testid="stage-events" style={{ borderTop: "1px solid var(--wd-border)", paddingTop: "var(--wd-4)" }}>
      <summary style={{ ...labelStyle(), marginBottom: 0, cursor: "pointer", userSelect: "none", listStyle: "none" }}>
        {say(C.recentEvents, language)}
        {view.events.length > 0 ? ` (${view.events.length})` : ""}
      </summary>
      <div style={{ marginTop: "var(--wd-3)" }}>
        {view.events.length === 0 ? (
          <p style={{ ...bodyText, color: "var(--wd-text-disabled)" }}>{say(C.noEvents, language)}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--wd-2)" }}>
            {view.events.map((event) => (
              <div key={event.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--wd-4)", fontSize: "var(--wd-text-xs)", color: "var(--wd-text-secondary)", padding: "var(--wd-2) var(--wd-3)", background: "var(--wd-surface-subtle)", borderRadius: "var(--wd-radius)" }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <span style={{ fontWeight: 500, color: "var(--wd-text)", marginRight: "var(--wd-2)" }}>{event.type}</span>
                  {event.summary}
                </span>
                <span style={{ color: "var(--wd-text-disabled)", whiteSpace: "nowrap", flexShrink: 0 }}>{formatTimestamp(event.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

export function StageWorkspace({ view, language }: StageWorkspaceProps) {
  const locked = view.stageRunId === null;

  return (
    <div
      data-presentation-region={view.region}
      data-presentation-ready="true"
      data-stage-id={view.stageId}
      data-stage-status={view.statusKey}
      style={{ display: "flex", flexDirection: "column", gap: "var(--wd-6)", minWidth: 0 }}
    >
      {/* Stage heading + status badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--wd-4)", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "var(--wd-text-xl)", fontWeight: "var(--wd-weight-strong)" as unknown as number, color: locked ? "var(--wd-text-disabled)" : "var(--wd-text)", lineHeight: "var(--wd-leading-tight)", margin: 0 }}>
          {view.name}
        </h2>
        <span data-testid="stage-status" style={badgeStyle(statusTone(view.statusKey))}>{view.statusLabel}</span>
      </div>

      {/* Responsibility */}
      <div>
        <span style={labelStyle()}>{say(C.yourResponsibility, language)}</span>
        <p style={{ ...bodyText, fontSize: "var(--wd-text-base)", color: view.isOpen ? "var(--wd-text)" : "var(--wd-text-secondary)" }}>{view.responsibility}</p>
      </div>

      {/* Not executable, stated */}
      {!view.executable ? (
        <div data-testid="stage-not-executable" style={{ ...subtle, display: "flex", gap: "var(--wd-2)", alignItems: "flex-start" }}>
          <IconLock size={16} stroke={2} aria-hidden="true" style={{ color: "var(--wd-text-muted)", flexShrink: 0, marginTop: 2 }} />
          <p style={bodyText}>
            <strong style={{ color: "var(--wd-text)" }}>{say(C.notExecutable, language)}.</strong> {view.notExecutableReason}
          </p>
        </div>
      ) : null}

      {locked ? (
        <>
          <p style={{ ...bodyText, color: "var(--wd-text-disabled)" }}>{say(C.locked, language)}</p>
          {view.preparation.prepares.length > 0 ? (
            <p style={{ ...bodyText, fontSize: "var(--wd-text-xs)" }}>
              {say(C.whatAiPrepares, language)}: {view.preparation.prepares.join(", ")}.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <StageSync
            processRunId={view.processRunId}
            stageId={view.stageId}
            roleId={view.roleId}
            needsSync={view.needsSync}
            polling={view.polling}
            stillRunningLabel={say(C.stillRunning, language)}
          />
          <SourcesSection view={view} language={language} />
          <InputsSection view={view} language={language} />
          <PreparationSection view={view} language={language} />
          <TasksSection view={view} language={language} />
          <DecisionsSection view={view} language={language} />
          <ToolsSection view={view} language={language} />
          <CompletionSection view={view} language={language} />
          <ArtifactsSection view={view} language={language} />
        </>
      )}

      <EventsSection view={view} language={language} />
    </div>
  );
}
