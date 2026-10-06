"use client";

/**
 * The exit decision, in two steps.
 *
 * Step one is the Pilot Lead's draft: the outcome, the rationale, the
 * commercial implication in words, the next-wave recommendation, and the
 * evidence, unresolved conditions and control findings the product gathered,
 * all editable. The server checks it and returns the exact change.
 *
 * Step two is the approval: the change line by line, the fingerprint it is
 * bound to, the approver's own rationale and confirmation. The server checks
 * the fingerprint against the pilot as it is when the approval arrives, so a
 * decision reviewed against one state cannot be recorded against another.
 */

import { useActionState, useState } from "react";
import type { ConsoleFormState } from "@/features/product/governance";
import { consoleInputStyle, consoleLabelStyle, consolePanelStyle, consoleTextareaStyle, consoleWrapStyle } from "@/features/product/shell/styles";
import type { ExitProposalState } from "../actions";

type Pair = { en: string; de: string };

const COPY = {
  outcome: { en: "Outcome", de: "Ergebnis" },
  scale: { en: "Scale", de: "Skalieren" },
  extend: { en: "Extend pilot", de: "Pilot verlaengern" },
  pause: { en: "Pause", de: "Pausieren" },
  stop: { en: "Stop", de: "Beenden" },
  extendedEnd: { en: "New planned end (Extend pilot only)", de: "Neues geplantes Ende (nur bei Verlaengerung)" },
  rationale: { en: "Why this decision", de: "Begruendung der Entscheidung" },
  commercial: { en: "Commercial implication, in words", de: "Kommerzielle Auswirkung, in Worten" },
  commercialHint: {
    en: "Qualitative only. Amounts and percentages are refused: a figure needs a measured baseline and a measured result.",
    de: "Nur qualitativ. Betraege und Prozentwerte werden abgewiesen: eine Zahl braucht eine gemessene Ausgangslage und ein gemessenes Ergebnis.",
  },
  nextWave: { en: "Next-wave recommendation", de: "Empfehlung fuer die naechste Welle" },
  evidence: { en: "Evidence the decision rests on", de: "Nachweise, auf denen die Entscheidung beruht" },
  conditions: { en: "Unresolved conditions, one per line", de: "Offene Bedingungen, eine je Zeile" },
  findings: { en: "Control findings, one per line", de: "Kontrollbefunde, einer je Zeile" },
  review: { en: "Review the decision", de: "Entscheidung pruefen" },
  working: { en: "Working", de: "In Arbeit" },
  approvalTitle: { en: "Approve and record the exit decision", de: "Abschlussentscheidung genehmigen und erfassen" },
  approvalNote: {
    en: "This decision is material. Your approval is bound to exactly the change listed here.",
    de: "Diese Entscheidung ist wesentlich. Ihre Genehmigung ist an genau die hier aufgefuehrte Aenderung gebunden.",
  },
  fingerprint: { en: "Change fingerprint", de: "Fingerabdruck der Aenderung" },
  approverRationale: { en: "Your rationale for approving", de: "Ihre Begruendung der Genehmigung" },
  confirm: {
    en: "I confirm this rationale is my own and I approve this exact decision.",
    de: "Ich bestaetige, dass diese Begruendung meine eigene ist, und genehmige genau diese Entscheidung.",
  },
  record: { en: "Approve and record", de: "Genehmigen und erfassen" },
  back: { en: "Back to the draft", de: "Zurueck zum Entwurf" },
} as const;

export interface ExitEvidenceOption {
  value: string;
  label: string;
}

export function ExitDecisionForm({
  language,
  propose,
  record,
  evidence,
  conditions,
  findings,
  permitted,
  blockedReason,
}: {
  language: "en" | "de";
  propose: (previous: ExitProposalState | null, data: FormData) => Promise<ExitProposalState>;
  record: (previous: ConsoleFormState | null, data: FormData) => Promise<ConsoleFormState>;
  evidence: readonly ExitEvidenceOption[];
  conditions: readonly string[];
  findings: readonly string[];
  permitted: boolean;
  blockedReason: string | null;
}) {
  const say = (pair: Pair) => (language === "de" ? pair.de : pair.en);
  const [proposal, proposeAction, proposing] = useActionState<ExitProposalState | null, FormData>(propose, null);
  const [result, recordAction, recording] = useActionState<ConsoleFormState | null, FormData>(record, null);
  const [editing, setEditing] = useState(true);
  const reviewed = proposal?.ok && proposal.proposal && !editing ? proposal.proposal : null;

  const status = (state: { ok: boolean; message: string } | null, testId: string) =>
    state ? (
      <span role="status" className="app-meta" data-testid={testId} data-ok={state.ok ? "true" : "false"} style={{ ...consoleWrapStyle, color: state.ok ? "var(--app-success-text)" : "var(--app-warning-text)" }}>
        {state.message}
      </span>
    ) : null;

  return (
    <div className="app-stack app-stack-3" data-testid="exit-decision">
      <form
        action={(data) => {
          setEditing(false);
          proposeAction(data);
        }}
        className="app-stack app-stack-3"
        hidden={reviewed !== null}
        data-testid="exit-draft-form"
      >
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled={!permitted}>
          <div className="app-stack app-stack-3">
            <div className="app-row app-row-wrap" style={{ gap: "var(--app-3)", alignItems: "flex-end" }}>
              <label style={consoleLabelStyle}>
                {say(COPY.outcome)}
                <select name="outcome" defaultValue="extend" style={consoleInputStyle} data-testid="exit-outcome">
                  <option value="scale">{say(COPY.scale)}</option>
                  <option value="extend">{say(COPY.extend)}</option>
                  <option value="pause">{say(COPY.pause)}</option>
                  <option value="stop">{say(COPY.stop)}</option>
                </select>
              </label>
              <label style={consoleLabelStyle}>
                {say(COPY.extendedEnd)}
                <input type="date" name="extendedEndOn" style={consoleInputStyle} data-testid="exit-extended-end" />
              </label>
            </div>
            <label style={consoleLabelStyle}>
              {say(COPY.rationale)}
              <textarea name="decisionRationale" rows={3} style={consoleTextareaStyle} data-testid="exit-rationale" />
            </label>
            <label style={consoleLabelStyle}>
              {say(COPY.commercial)}
              <textarea name="commercialImplication" rows={2} style={consoleTextareaStyle} data-testid="exit-commercial" />
              <span className="app-meta" style={consoleWrapStyle}>{say(COPY.commercialHint)}</span>
            </label>
            <label style={consoleLabelStyle}>
              {say(COPY.nextWave)}
              <textarea name="nextWaveRecommendation" rows={2} style={consoleTextareaStyle} data-testid="exit-next-wave" />
            </label>
            <fieldset style={{ border: "1px solid var(--app-border)", borderRadius: "var(--app-radius)", padding: "var(--app-3)", margin: 0, minWidth: 0 }}>
              <legend className="app-secondary" style={{ fontSize: "var(--app-text-xs)", padding: "0 var(--app-1)" }}>{say(COPY.evidence)}</legend>
              <div className="app-stack app-stack-1">
                {evidence.map((entry) => (
                  <label key={entry.value} style={{ display: "flex", gap: "var(--app-2)", alignItems: "flex-start", fontSize: "var(--app-text-sm)", minWidth: 0 }}>
                    <input type="checkbox" name="evidence" value={entry.value} defaultChecked style={{ marginTop: 3 }} />
                    <span style={consoleWrapStyle}>{entry.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label style={consoleLabelStyle}>
              {say(COPY.conditions)}
              <textarea name="unresolvedConditions" rows={Math.min(8, Math.max(3, conditions.length + 1))} defaultValue={conditions.join("\n")} style={consoleTextareaStyle} data-testid="exit-conditions" />
            </label>
            <label style={consoleLabelStyle}>
              {say(COPY.findings)}
              <textarea name="controlFindings" rows={Math.min(8, Math.max(3, findings.length + 1))} defaultValue={findings.join("\n")} style={consoleTextareaStyle} data-testid="exit-findings" />
            </label>
          </div>
        </fieldset>
        <div className="app-row app-row-wrap">
          <button type="submit" className="app-btn app-btn-primary app-btn-sm" disabled={!permitted || blockedReason !== null || proposing} data-testid="exit-review">
            {proposing ? say(COPY.working) : say(COPY.review)}
          </button>
          {blockedReason ? (
            <span className="app-meta" style={consoleWrapStyle} data-testid="exit-blocked">
              {blockedReason}
            </span>
          ) : null}
        </div>
        {proposal && !proposal.ok ? status(proposal, "exit-proposal-result") : null}
      </form>

      {reviewed ? (
        <form action={recordAction} style={consolePanelStyle} className="app-stack app-stack-3" data-testid="exit-approval">
          <input type="hidden" name="payload" value={reviewed.payload} />
          <input type="hidden" name="fingerprint" value={reviewed.fingerprint} />
          <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>{say(COPY.approvalTitle)}</span>
          <span className="app-meta" style={consoleWrapStyle}>{say(COPY.approvalNote)}</span>
          <ul className="app-stack app-stack-1" style={{ margin: 0, paddingLeft: "var(--app-4)" }} data-testid="exit-approval-lines">
            {reviewed.lines.map((line) => (
              <li key={line} className="app-meta" style={consoleWrapStyle}>
                {line}
              </li>
            ))}
          </ul>
          <span className="app-meta">
            {say(COPY.fingerprint)} <span className="app-oid" data-testid="exit-fingerprint">{reviewed.fingerprint.slice(0, 12)}</span>
          </span>
          <label style={consoleLabelStyle}>
            {say(COPY.approverRationale)}
            <textarea name="rationale" rows={2} style={consoleTextareaStyle} data-testid="exit-approval-rationale" />
          </label>
          <label className="app-row" style={{ fontSize: "var(--app-text-sm)", alignItems: "flex-start" }}>
            <input type="checkbox" name="rationaleConfirmed" style={{ marginTop: 3 }} data-testid="exit-approval-confirm" />
            <span style={consoleWrapStyle}>{say(COPY.confirm)}</span>
          </label>
          <div className="app-row app-row-wrap">
            <button type="submit" className="app-btn app-btn-primary app-btn-sm" disabled={recording || result?.ok === true} data-testid="exit-record">
              {recording ? say(COPY.working) : say(COPY.record)}
            </button>
            {result?.ok ? null : (
              <button type="button" className="app-btn app-btn-quiet app-btn-sm" onClick={() => setEditing(true)}>
                {say(COPY.back)}
              </button>
            )}
          </div>
          {status(result, "exit-record-result")}
        </form>
      ) : null}
    </div>
  );
}
