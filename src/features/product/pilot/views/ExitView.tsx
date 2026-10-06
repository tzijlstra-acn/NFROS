/**
 * The exit decision (plan 7.7): Scale, Extend pilot, Pause or Stop, with the
 * evidence, unresolved conditions, control findings, the commercial
 * implication in words, and the next-wave recommendation.
 *
 * Server component. The decision is the Pilot Lead's and is recorded as a
 * governed decision with a payload-bound approval (`ExitDecisionForm`,
 * `actionRecordExitDecision`). The product gathers what it should rest on and
 * proposes no outcome. The decisions already taken are listed with the
 * approval each one carries.
 */

import { SettingsSection } from "@/components/settings/primitives";
import { Chip, Empty, Notice } from "@/components/workday-v2/primitives";
import type { Language } from "@/i18n/labels";
import { actionProposeExitDecision, actionRecordExitDecision } from "../actions";
import { EXIT_OUTCOME_LABELS } from "../changes";
import type { ExitDraft } from "../exit-draft";
import type { PilotAccess } from "../access";
import type { PilotWorkspace } from "../workspace";
import { ExitDecisionForm } from "./ExitDecisionForm";
import { formatDateTime, say, Wrap } from "./PilotFrame";

const COPY = {
  lede: {
    en: "The go or stop decision is the Pilot Lead's. The product gathers what it should rest on: the evidence pack's digest, the readiness result, every reading and issue, the open conditions and the control findings as they read now. It proposes no outcome, no commercial figure and no recommendation.",
    de: "Die Entscheidung ueber Fortsetzung oder Abbruch trifft die Pilotleitung. Das Produkt sammelt, worauf sie beruhen soll: den Fingerabdruck des Nachweispakets, das Bereitschaftsergebnis, alle Werte und Themen, die offenen Bedingungen und die Kontrollbefunde nach aktuellem Stand. Es schlaegt kein Ergebnis, keine kommerzielle Zahl und keine Empfehlung vor.",
  },
  take: { en: "Take the exit decision", de: "Abschlussentscheidung treffen" },
  notStarted: {
    en: "An exit decision is taken on a pilot that has started. Start the pilot from its setup first.",
    de: "Eine Abschlussentscheidung betrifft einen gestarteten Piloten. Starten Sie den Piloten zuerst in der Einrichtung.",
  },
  closed: { en: "The pilot is closed. Its decisions are listed below.", de: "Der Pilot ist abgeschlossen. Seine Entscheidungen stehen unten." },
  taken: { en: "Decisions taken", de: "Getroffene Entscheidungen" },
  none: { en: "No exit decision has been recorded.", de: "Es ist keine Abschlussentscheidung erfasst." },
  noneDetail: { en: "A decision appears here with its approval and the evidence it cites.", de: "Eine Entscheidung erscheint hier mit ihrer Genehmigung und den zitierten Nachweisen." },
  by: { en: "Decided by", de: "Entschieden von" },
  approval: { en: "Approval", de: "Genehmigung" },
  rationale: { en: "Rationale", de: "Begruendung" },
  commercial: { en: "Commercial implication", de: "Kommerzielle Auswirkung" },
  nextWave: { en: "Next-wave recommendation", de: "Empfehlung fuer die naechste Welle" },
  conditions: { en: "Unresolved conditions", de: "Offene Bedingungen" },
  findings: { en: "Control findings", de: "Kontrollbefunde" },
  evidence: { en: "Evidence", de: "Nachweise" },
} as const;

function Lines({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <details>
      <summary className="app-meta" style={{ cursor: "pointer" }}>
        {title} ({items.length})
      </summary>
      <ul className="app-stack app-stack-1" style={{ margin: "var(--app-1) 0 0", paddingLeft: "var(--app-4)" }}>
        {items.map((item) => (
          <li key={item} className="app-meta" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ExitView({
  workspace,
  draft,
  access,
  language,
}: {
  workspace: PilotWorkspace;
  draft: ExitDraft | null;
  access: PilotAccess;
  language: Language;
}) {
  const t = (pair: { en: string; de: string }) => say(pair, language);
  const status = workspace.pilot.status;
  const permitted = access.can("pilot.record-exit-decision") && !access.readOnly;
  const reason = access.reasonFor("pilot.record-exit-decision");
  const decisions = [...workspace.exitDecisions].reverse();

  return (
    <div className="app-stack app-stack-6">
      <Notice tone="info">{t(COPY.lede)}</Notice>

      <SettingsSection title={t(COPY.take)}>
        {status === "setup" ? (
          <Notice tone="warning">
            <span data-testid="exit-not-started">{t(COPY.notStarted)}</span>
          </Notice>
        ) : status === "closed" ? (
          <Wrap>{t(COPY.closed)}</Wrap>
        ) : draft ? (
          <ExitDecisionForm
            language={language}
            propose={actionProposeExitDecision}
            record={actionRecordExitDecision}
            evidence={draft.evidence.map((entry) => ({ value: JSON.stringify(entry), label: `${entry.label} (${entry.kind}: ${entry.ref.slice(0, 16)})` }))}
            conditions={draft.unresolvedConditions}
            findings={draft.controlFindings}
            permitted={permitted}
            blockedReason={!permitted && reason ? t(reason) : null}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection title={t(COPY.taken)} count={decisions.length}>
        {decisions.length === 0 ? (
          <Empty title={t(COPY.none)} detail={t(COPY.noneDetail)} />
        ) : (
          <div className="app-stack app-stack-4" data-testid="exit-decisions">
            {decisions.map((decision) => (
              <article key={decision.id} className="app-stack app-stack-2" style={{ borderTop: "1px solid var(--app-border)", paddingTop: "var(--app-3)" }} data-testid={`exit-decision-${decision.id}`}>
                <span className="app-row app-row-wrap">
                  <Chip tone={decision.outcome === "stop" ? "warning" : decision.outcome === "scale" ? "success" : "info"}>
                    <span data-testid="exit-decision-outcome">{t(EXIT_OUTCOME_LABELS[decision.outcome])}</span>
                  </Chip>
                  <span className="app-oid">{decision.id}</span>
                  <span className="app-meta">
                    {t(COPY.by)} {decision.decidedByLabel}, {formatDateTime(decision.decidedAt)}
                  </span>
                  <span className="app-meta">
                    {t(COPY.approval)} <span className="app-oid" data-testid="exit-decision-approval">{decision.approvalId ?? "none"}</span>
                  </span>
                </span>
                <Wrap>
                  <strong>{t(COPY.rationale)}:</strong> {decision.rationale}
                </Wrap>
                <Wrap>
                  <strong>{t(COPY.commercial)}:</strong> {decision.commercialImplication}
                </Wrap>
                <Wrap>
                  <strong>{t(COPY.nextWave)}:</strong> {decision.nextWaveRecommendation}
                </Wrap>
                <Lines title={t(COPY.evidence)} items={decision.evidence.map((entry) => `${entry.label} (${entry.kind}: ${entry.ref})`)} />
                <Lines title={t(COPY.conditions)} items={decision.unresolvedConditions} />
                <Lines title={t(COPY.findings)} items={decision.controlFindings} />
              </article>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
