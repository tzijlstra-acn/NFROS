"use client";

/**
 * The decision flow.
 *
 * This is the most important interaction in the product, so it is worth being
 * explicit about what it deliberately does not do.
 *
 * It does not pre-select an option. It does not pre-fill the rationale with
 * model text that the user can accept with one click. It does not hide the
 * evidence that argues against the prepared position. And it does not let a
 * material change execute until the user has written or edited a rationale and
 * confirmed, in a separate act, that the rationale is theirs.
 *
 * Every one of those is a friction a product manager would ask us to remove.
 * They are the point: the claim this product makes is that a human is
 * accountable for the judgment, and a one-click accept would make that false.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionRecordDecision } from "@app/actions";
import {
  Chip,
  ConfidenceMeter,
  EvidenceList,
  ObjectId,
  RegulatoryNote,
  type EvidenceCitation,
  type Tone,
} from "@/components/evidence/primitives";
import { ACTION_LABELS, PRODUCT_COPY, t, type Language } from "@/i18n/labels";

export interface DecisionOptionView {
  id: string;
  label: string;
  labelDe: string;
  description: string;
  isRecommended: boolean;
  recommendationBasis: string;
  riskImplication: string;
  requiresApproval: boolean;
  consequences: Array<{ kind: string; targetId: string; value?: string; note?: string }>;
}

export interface DecisionView {
  id: string;
  reference: string;
  title: string;
  titleDe: string;
  question: string;
  judgmentKind: string;
  presentedAtMoment: string;
  priorityRank: number;
  whyThisMatters: string;
  preparedPosition: string;
  uncertaintyNote: string;
  confidence: number;
  requiredAuthority: string;
  status: string;
  chosenOptionId: string | null;
  recordedRationale: string;
  decidedByUserId: string | null;
  decidedAtMoment: string | null;
  fromSharedEvent: boolean;
  entityId: string;
  mentionsRegulation: boolean;
}

export interface DecisionFlowProps {
  decision: DecisionView;
  options: DecisionOptionView[];
  supportingEvidence: EvidenceCitation[];
  opposingEvidence: EvidenceCitation[];
  receiptStatements: string[];
  language: Language;
  /** Human readable name of the person who holds the acting role. */
  actingUserName: string;
}

/** Human readable label for a consequence kind, for the preview list. */
const CONSEQUENCE_LABELS: Record<string, string> = {
  "set-control-effectiveness": "Change the recorded control effectiveness",
  "version-assessment": "Create a new assessment version",
  "set-residual-risk": "Record a residual risk position",
  "create-reassessment": "Initiate an off-cycle reassessment",
  "create-action": "Create a remediation action with an owner and a due date",
  "create-issue": "Raise an issue",
  "add-committee-item": "Add an item to the committee agenda",
  "activate-monitoring": "Activate enhanced monitoring",
  "send-collaboration-message": "Post a simulated internal message",
  "request-factual-validation": "Ask the first line to validate a factual point",
  "set-supplier-criticality": "Change the recorded supplier criticality",
  "record-supplier-assessment": "Record a supplier assessment conclusion",
  "apply-supplier-restriction": "Apply a restriction to the arrangement",
  "record-test-conclusion": "Record the assurance conclusion",
  "classify-test-exception": "Classify an exception and its scope",
  "record-finding": "Record a finding",
  "classify-incident": "Record the incident severity and classification",
  "escalate-incident": "Escalate the incident",
  "record-notification-recommendation": "Record a recommendation on supervisory notification",
  "select-recovery-option": "Record the selected recovery option",
  "capture-lessons-learned": "Record lessons learned",
  "record-obligation-interpretation": "Record the obligation interpretation and applicability",
  "set-portfolio-materiality": "Record portfolio materiality",
  "request-evidence": "Record a request for a missing evidence document",
};

export function DecisionFlow({
  decision,
  options,
  supportingEvidence,
  opposingEvidence,
  receiptStatements,
  language,
  actingUserName,
}: DecisionFlowProps) {
  const alreadyDecided = decision.status === "decided";

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    receiptStatements: string[];
    blockedReasons: string[];
  } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null;
  const canSubmit =
    selectedOption !== null && rationale.trim().length >= 20 && confirmed && !pending;

  const submit = () => {
    if (!selectedOption) return;
    start(async () => {
      const response = await actionRecordDecision({
        decisionId: decision.id,
        optionId: selectedOption.id,
        rationale: rationale.trim(),
        rationaleConfirmed: confirmed,
      });
      setResult(response);
      router.refresh();
    });
  };

  /* ---- Already decided: show the record and the receipt ---- */
  if (alreadyDecided && result === null) {
    const chosen = options.find((option) => option.id === decision.chosenOptionId);
    return (
      <article className="panel">
        <div className="panel-head">
          <div className="stack stack-1">
            <span className="panel-title">{language === "de" ? decision.titleDe : decision.title}</span>
            <ObjectId id={decision.reference} />
          </div>
          <Chip tone="green">decided</Chip>
        </div>
        <div className="panel-body stack stack-5">
          <div className="stack stack-2">
            <span className="label">Decision recorded</span>
            <p className="strong-text">
              {chosen ? (language === "de" ? chosen.labelDe : chosen.label) : decision.chosenOptionId}
            </p>
            <span className="meta">
              {decision.decidedByUserId} at {decision.decidedAtMoment}
            </span>
          </div>

          <div className="stack stack-2">
            <span className="label">Rationale, owned by the decision maker</span>
            <blockquote
              style={{
                fontSize: "var(--text-sm)",
                borderLeft: "2px solid var(--amber)",
                paddingLeft: "var(--space-3)",
                color: "var(--text-2)",
              }}
            >
              {decision.recordedRationale}
            </blockquote>
          </div>

          {receiptStatements.length > 0 ? (
            <ExecutionReceipt statements={receiptStatements} />
          ) : null}
        </div>
      </article>
    );
  }

  /* ---- Just submitted: show the live result ---- */
  if (result !== null) {
    return (
      <article className="panel">
        <div className="panel-head">
          <div className="stack stack-1">
            <span className="panel-title">{language === "de" ? decision.titleDe : decision.title}</span>
            <ObjectId id={decision.reference} />
          </div>
          <Chip tone={result.ok ? "green" : "amber"}>{result.ok ? "executed" : "partly executed"}</Chip>
        </div>
        <div className="panel-body stack stack-5">
          <p className="lede">{result.message}</p>
          <ExecutionReceipt statements={result.receiptStatements} />
          {result.blockedReasons.length > 0 ? (
            <div className="stack stack-2">
              <span className="label" style={{ color: "var(--red)" }}>
                Not executed ({result.blockedReasons.length})
              </span>
              <ul className="stack stack-1">
                {result.blockedReasons.map((reason, index) => (
                  <li key={index} className="card card-edge" data-tone="red">
                    <p style={{ fontSize: "var(--text-sm)" }}>{reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  /* ---- Open decision ---- */
  return (
    <article className="panel">
      <div className="panel-head">
        <div className="stack stack-1">
          <div className="row row-2 row-wrap">
            <span className="panel-title">{language === "de" ? decision.titleDe : decision.title}</span>
            {decision.fromSharedEvent ? <Chip tone="red">from the 14:05 event</Chip> : null}
          </div>
          <div className="row row-3 row-wrap">
            <ObjectId id={decision.reference} />
            <span className="meta">presented {decision.presentedAtMoment}</span>
            <span className="meta">{decision.judgmentKind.replace(/-/g, " ")}</span>
          </div>
        </div>
        <Chip tone="amber">{t(PRODUCT_COPY, "humanDecides", language)}</Chip>
      </div>

      <div className="panel-body stack stack-6">
        {/* The professional question */}
        <div className="stack stack-2">
          <span className="label">The question</span>
          <p style={{ fontSize: "var(--text-md)", color: "var(--text-1)", lineHeight: 1.45 }}>
            {decision.question}
          </p>
        </div>

        <div className="grid grid-2">
          <div className="stack stack-2">
            <span className="label">Why this matters</span>
            <p style={{ fontSize: "var(--text-sm)" }}>{decision.whyThisMatters}</p>
          </div>
          <div className="stack stack-2">
            <span className="label">Authority required</span>
            <p style={{ fontSize: "var(--text-sm)" }}>{decision.requiredAuthority}</p>
            <ConfidenceMeter value={decision.confidence} label="Prepared position confidence" />
          </div>
        </div>

        {/* What the assistant prepared */}
        <div className="card card-edge" data-tone="accent">
          <div className="stack stack-2">
            <span className="label" style={{ color: "var(--accent)" }}>
              Prepared position, for you to accept, change or reject
            </span>
            <p style={{ fontSize: "var(--text-sm)" }}>{decision.preparedPosition}</p>
          </div>
        </div>

        {/* Uncertainty, shown before the choice */}
        <div className="card card-edge" data-tone="amber">
          <div className="stack stack-2">
            <span className="label" style={{ color: "var(--amber)" }}>
              Stated uncertainty
            </span>
            <p style={{ fontSize: "var(--text-sm)" }}>{decision.uncertaintyNote}</p>
          </div>
        </div>

        {/* Both sides of the evidence */}
        <div className="grid grid-2">
          <EvidenceList
            citations={supportingEvidence}
            heading="Evidence supporting the prepared position"
            language={language}
          />
          <EvidenceList
            citations={opposingEvidence}
            heading="Evidence that argues against it"
            emptyMessage="No evidence in the corpus argues against this position. That absence is itself worth questioning."
            language={language}
          />
        </div>

        {decision.mentionsRegulation ? <RegulatoryNote language={language} /> : null}

        {/* Options */}
        <div className="stack stack-3">
          <span className="label">
            Your options ({options.length}). Nothing is pre-selected.
          </span>
          <div className="stack stack-2">
            {options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={option.id === selectedOptionId}
                language={language}
                onSelect={() => setSelectedOptionId(option.id)}
              />
            ))}
          </div>
        </div>

        {/* Rationale and confirmation */}
        {selectedOption ? (
          <div className="panel-flush" style={{ padding: "var(--space-5)" }}>
            <div className="stack stack-4">
              <div className="stack stack-2">
                <label className="field-label" htmlFor={`rationale-${decision.id}`}>
                  Your rationale
                </label>
                <p className="meta">
                  Write the reasoning you are prepared to defend. This text is recorded against your
                  name and is not generated for you.
                </p>
                <textarea
                  id={`rationale-${decision.id}`}
                  className="textarea"
                  value={rationale}
                  onChange={(changeEvent) => setRationale(changeEvent.target.value)}
                  placeholder="State the basis for your conclusion, including how you treated the evidence that points the other way."
                  aria-describedby={`rationale-help-${decision.id}`}
                />
                <span id={`rationale-help-${decision.id}`} className="meta">
                  {rationale.trim().length} characters. At least 20 are required.
                </span>
              </div>

              {selectedOption.consequences.length > 0 ? (
                <div className="stack stack-2">
                  <span className="label">
                    What will change if you proceed ({selectedOption.consequences.length})
                  </span>
                  <ul className="stack stack-1">
                    {selectedOption.consequences.map((consequence, index) => (
                      <li key={index} className="row row-2 row-start">
                        <span className="mono" style={{ color: "var(--cyan)", fontSize: "var(--text-xs)" }}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: "var(--text-sm)" }}>
                          {CONSEQUENCE_LABELS[consequence.kind] ?? consequence.kind}
                          <span className="mono meta"> {consequence.targetId}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label className="row row-3 row-start" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(changeEvent) => setConfirmed(changeEvent.target.checked)}
                  style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--amber)" }}
                />
                <span className="stack stack-1">
                  <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                    {t(ACTION_LABELS, "confirmRationale", language)}
                  </span>
                  <span className="meta">
                    {actingUserName} is recorded as the accountable decision maker. Without this
                    confirmation the authority gate refuses every material change.
                  </span>
                </span>
              </label>

              <div className="row row-3 row-wrap">
                <button
                  type="button"
                  className="btn btn-decide btn-lg"
                  disabled={!canSubmit}
                  onClick={submit}
                >
                  {pending ? "Executing" : t(ACTION_LABELS, "approveAndExecute", language)}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    setSelectedOptionId(null);
                    setConfirmed(false);
                  }}
                  disabled={pending}
                >
                  Change option
                </button>
                {!canSubmit ? (
                  <span className="meta">
                    {rationale.trim().length < 20
                      ? "A rationale of at least 20 characters is required."
                      : !confirmed
                        ? "Confirm the rationale is yours to proceed."
                        : ""}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function OptionCard({
  option,
  selected,
  language,
  onSelect,
}: {
  option: DecisionOptionView;
  selected: boolean;
  language: Language;
  onSelect: () => void;
}) {
  const tone: Tone = selected ? "pink" : option.isRecommended ? "cyan" : "neutral";
  return (
    <button
      type="button"
      className="card card-interactive card-edge"
      data-tone={tone}
      data-selected={selected}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="stack stack-2">
        <div className="row row-3 row-between row-wrap">
          <span className="strong-text">{language === "de" ? option.labelDe : option.label}</span>
          <span className="row row-2">
            {option.isRecommended ? <Chip tone="cyan">specialist recommendation</Chip> : null}
            {option.requiresApproval ? <Chip tone="amber">approval required</Chip> : null}
          </span>
        </div>
        <p style={{ fontSize: "var(--text-sm)" }}>{option.description}</p>
        {option.riskImplication ? (
          <div className="stack stack-1">
            <span className="label">Risk implication</span>
            <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
              {option.riskImplication}
            </p>
          </div>
        ) : null}
        {option.isRecommended && option.recommendationBasis ? (
          <div className="stack stack-1">
            <span className="label">Basis for the recommendation</span>
            <p className="dim" style={{ fontSize: "var(--text-sm)" }}>
              {option.recommendationBasis}
            </p>
          </div>
        ) : null}
      </div>
    </button>
  );
}

/**
 * The execution receipt.
 *
 * Each line corresponds to a database mutation that actually succeeded, which
 * is why it is rendered from the recorded receipt rather than from the option's
 * declared consequences. A consequence that was blocked does not appear here.
 */
export function ExecutionReceipt({ statements }: { statements: string[] }) {
  if (statements.length === 0) return null;
  return (
    <div className="card card-edge" data-tone="green">
      <div className="stack stack-2">
        <span className="label" style={{ color: "var(--green)" }}>
          Execution receipt ({statements.length} completed change{statements.length === 1 ? "" : "s"})
        </span>
        <ul className="stack stack-1">
          {statements.map((statement, index) => (
            <li key={index} className="row row-2 row-start">
              <span aria-hidden="true" style={{ color: "var(--green)" }}>
                =
              </span>
              <span className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
                {statement}
              </span>
            </li>
          ))}
        </ul>
        <span className="meta">
          Each line is a change that completed and wrote an audit event. Nothing is listed here that
          did not execute.
        </span>
      </div>
    </div>
  );
}

/**
 * A compact decision card for the morning brief.
 *
 * The brief opens with these, ranked. The point of the ranking is that the
 * professional's attention is directed at judgment rather than at a list of
 * notifications, so the card shows the question and the stakes, not the volume
 * of work behind it.
 */
export function DecisionBriefCard({
  decision,
  href,
  language,
}: {
  decision: DecisionView;
  href: string;
  language: Language;
}) {
  const decided = decision.status === "decided";
  return (
    <a
      href={href}
      className="card card-interactive card-edge"
      data-tone={decided ? "green" : decision.fromSharedEvent ? "red" : "amber"}
      style={{ textDecoration: "none" }}
    >
      <div className="stack stack-3">
        <div className="row row-3 row-between row-wrap">
          <div className="row row-2 row-wrap">
            <span
              className="mono"
              style={{ color: "var(--text-4)", fontSize: "var(--text-xs)" }}
            >
              {String(decision.priorityRank).padStart(2, "0")}
            </span>
            <span className="strong-text">{language === "de" ? decision.titleDe : decision.title}</span>
          </div>
          <span className="row row-2">
            {decision.fromSharedEvent ? <Chip tone="red">event</Chip> : null}
            <Chip tone={decided ? "green" : "amber"}>{decided ? "decided" : "your decision"}</Chip>
          </span>
        </div>

        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>{decision.question}</p>

        <div className="row row-4 row-wrap row-between">
          <span className="meta">{decision.judgmentKind.replace(/-/g, " ")}</span>
          <ConfidenceMeter value={decision.confidence} label="conf" />
        </div>
      </div>
    </a>
  );
}
