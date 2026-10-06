"use client";

/**
 * The five parts of one decision.
 *
 * Question, Context, Evidence, Options, Confirm and execute, and exactly one
 * of them on screen. Everything plan section 4.10 asks for is reachable; it is
 * distributed across the parts so the reader is asked one thing at a time,
 * which is what keeps the queue and the active part on screen together at
 * 1366x768.
 *
 * What is deliberately absent, and the reason, because these frictions are
 * the point of the product:
 *
 *   no option is pre-selected, on Options or anywhere after it;
 *   the rationale is never pre-filled with the preparation's text, and there
 *   is no control that copies it in, because a one click accept would make
 *   the claim that a person owns the reasoning false;
 *   the preparation and the reader's words are separately labelled, so the
 *   record can always say which is which;
 *   one tick does not approve every change: each change that needs an
 *   approval is approved on its own, against its exact payload;
 *   nothing executes until the reader confirms the rationale is theirs.
 *
 * Evidence is on its own part, read inline from the corpus rather than through
 * the contextual drawer, so the strongest case each way is on screen without a
 * second panel.
 */

import { useState } from "react";
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconLock,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import { WorkdayDisclosure } from "@/components/workday-v3/WorkdayDisclosure";
import { ACTION_LABELS, PRODUCT_COPY, t, type Language } from "@/i18n/labels";
import { AUTHORITY_TONES, COPY, STAGE_HINTS, STAGE_LABELS, fill, say } from "./copy";
import {
  DECISION_STAGES,
  MINIMUM_RATIONALE_LENGTH,
  allChangesApproved,
  requiredApprovals,
  stageIndex,
  type ActiveDecisionView,
  type ChangeView,
  type DecisionOptionCard,
  type DecisionStage,
  type EvidenceItemView,
  type LinkView,
} from "./model";

/* ==========================================================================
   Where the reader is
   ========================================================================== */

/**
 * The stage indicator.
 *
 * An ordered list with `aria-current="step"`. Parts already passed are buttons
 * so backward movement is available without stepping through; parts ahead are
 * inert, because skipping Options would put a reader on Confirm with nothing
 * chosen.
 */
export function StageIndicator({
  stage,
  language,
  onGo,
}: {
  stage: DecisionStage;
  language: Language;
  onGo: (stage: DecisionStage) => void;
}) {
  const at = stageIndex(stage);

  return (
    <ol className="wd-dq-steps" aria-label={say(COPY.stageOf, language)}>
      {DECISION_STAGES.map((candidate, index) => {
        const state = index < at ? "done" : index === at ? "current" : "ahead";
        const label = say(STAGE_LABELS[candidate], language);

        return (
          <li
            key={candidate}
            className="wd-dq-step"
            data-state={state}
            data-stage={candidate}
            aria-current={state === "current" ? "step" : undefined}
          >
            {state === "done" ? (
              <button type="button" className="wd-dq-step-btn" onClick={() => onGo(candidate)}>
                <span className="wd-dq-step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{label}</span>
              </button>
            ) : (
              <span className="wd-dq-step-btn" aria-disabled={state === "ahead"}>
                <span className="wd-dq-step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{label}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** One line saying what this part asks for. */
export function StageHint({ stage, language }: { stage: DecisionStage; language: Language }) {
  return <p className="wd-dq-hint">{say(STAGE_HINTS[stage], language)}</p>;
}

/**
 * The regulatory disclosure, on every part of every decision.
 *
 * Second line decision copy routinely names an obligation or a policy section,
 * and a disclosure that depends on a keyword list is one that can be
 * forgotten. The wording is the product's single one from `PRODUCT_COPY`.
 */
export function RegulatoryLine({ language }: { language: Language }) {
  return <p className="wd-regulatory">{t(PRODUCT_COPY, "regulatoryNote", language)}</p>;
}

/** Seeded prose has no German form; mark it so assistive technology reads it as English. */
function proseLang(detail: Pick<ActiveDecisionView, "proseIsEnglish">): "en" | undefined {
  return detail.proseIsEnglish ? "en" : undefined;
}

/** A link to the work the decision belongs to, or the honest statement that there is none. */
function LinkLine({ link, empty }: { link: LinkView | null; empty: string }) {
  if (!link) return <span className="wd-dq-muted-line">{empty}</span>;
  return (
    <span className="wd-stack-1">
      {link.href ? (
        <a className="wd-dq-link" href={link.href}>
          <span>{link.label}</span>
          <IconArrowUpRight size={13} stroke={2} aria-hidden="true" />
        </a>
      ) : (
        <span className="wd-dq-body">{link.label}</span>
      )}
      <span className="wd-dq-micro">{link.detail}</span>
    </span>
  );
}

/* ==========================================================================
   1. Question
   ========================================================================== */

export function StageQuestion({ detail, language }: { detail: ActiveDecisionView; language: Language }) {
  const summary = detail.authoritySummary;
  return (
    <div className="wd-stack-3" data-testid="decision-part-question">
      <div className="wd-stack-1">
        <span className="wd-dq-label">{say(COPY.theQuestion, language)}</span>
        <p className="wd-dq-question" lang={proseLang(detail)}>
          {detail.question}
        </p>
        <span className="wd-dq-micro">
          {detail.judgmentLabel}
          <span aria-hidden="true"> · </span>
          <span className="wd-oid">{detail.reference}</span>
        </span>
      </div>

      {/* Plan 9.5: what the AI prepared, what the person decides, what changes, what approval. */}
      <dl className="wd-dq-facts" data-testid="decision-authority-summary">
        <div>
          <dt>
            <IconSparkles size={12} stroke={2} aria-hidden="true" />
            {say(COPY.aiPrepared, language)}
          </dt>
          <dd>{summary.prepared}</dd>
        </div>
        <div>
          <dt>
            <IconUser size={12} stroke={2} aria-hidden="true" />
            {say(COPY.youDecide, language)}
          </dt>
          <dd>{summary.decides}</dd>
        </div>
        <div>
          <dt>{say(COPY.willChangeSummary, language)}</dt>
          <dd>{summary.changes}</dd>
        </div>
        <div>
          <dt>
            <IconLock size={12} stroke={2} aria-hidden="true" />
            {say(COPY.approvalRequiredSummary, language)}
          </dt>
          <dd>{summary.approval}</dd>
        </div>
      </dl>

      {detail.proseIsEnglish ? <span className="wd-dq-micro">{say(COPY.englishProse, language)}</span> : null}
    </div>
  );
}

/* ==========================================================================
   2. Context
   ========================================================================== */

export function StageContext({ detail, language }: { detail: ActiveDecisionView; language: Language }) {
  const context = detail.context;
  return (
    <div className="wd-dq-context" data-testid="decision-part-context">
      <div className="wd-dq-context-wide">
        <span className="wd-dq-label">{say(COPY.trigger, language)}</span>
        <p className="wd-dq-body wd-dq-clamp-3" lang={proseLang(detail)}>
          {context.trigger}
        </p>
        <span className="wd-dq-micro">{context.triggerMeta}</span>
      </div>

      <div data-testid="decision-context-process">
        <span className="wd-dq-label">{say(COPY.processStage, language)}</span>
        <LinkLine link={context.process} empty={say(COPY.noProcess, language)} />
      </div>

      <div data-testid="decision-context-meeting">
        <span className="wd-dq-label">{say(COPY.meeting, language)}</span>
        <LinkLine link={context.meeting} empty={say(COPY.noMeeting, language)} />
      </div>

      <div>
        <span className="wd-dq-label">{say(COPY.affected, language)}</span>
        {context.affected ? (
          <span className="wd-stack-1">
            <span className="wd-dq-body wd-dq-clamp-2">{context.affected.label}</span>
            <span className="wd-dq-micro">{context.affected.kindLabel}</span>
          </span>
        ) : (
          <span className="wd-dq-muted-line">{say(COPY.noAffected, language)}</span>
        )}
      </div>

      <div data-testid="decision-context-deadline">
        <span className="wd-dq-label">
          <IconClock size={12} stroke={2} aria-hidden="true" />
          {say(COPY.deadline, language)}
        </span>
        {context.deadline ? (
          <span className="wd-stack-1">
            <span className="wd-dq-body" data-passed={context.deadline.passed}>
              {context.deadline.label}
            </span>
            <span className="wd-dq-micro wd-dq-clamp-2" lang={proseLang(detail)}>
              {context.deadline.basis}
            </span>
          </span>
        ) : (
          <span className="wd-dq-muted-line">{say(COPY.noDeadline, language)}</span>
        )}
      </div>

      <div className="wd-dq-context-wide">
        <span className="wd-dq-label">{say(COPY.currentPosition, language)}</span>
        <span className="wd-dq-body">{context.currentPosition ?? say(COPY.noPosition, language)}</span>
      </div>
    </div>
  );
}

/* ==========================================================================
   3. Evidence
   ========================================================================== */

function EvidenceCard({
  item,
  heading,
  empty,
  tone,
  language,
}: {
  item: EvidenceItemView | null;
  heading: string;
  empty: string;
  tone: "for" | "against";
  language: Language;
}) {
  return (
    <div className="wd-dq-evidence-card" data-tone={tone}>
      <span className="wd-dq-label">{heading}</span>
      {item ? (
        <>
          <span className="wd-dq-body wd-dq-strongish wd-dq-clamp-2" lang={language === "de" ? "en" : undefined}>
            {item.title}
          </span>
          <span className="wd-dq-micro wd-dq-truncate">
            {item.source}
            <span aria-hidden="true"> · </span>
            {item.provenance}
          </span>
          <span className="wd-dq-micro wd-dq-clamp-2" lang={language === "de" ? "en" : undefined}>
            {item.summary}
          </span>
          {item.stale ? (
            <span className="wd-chip" data-tone="warning">
              {say(COPY.staleLabel, language)}
            </span>
          ) : null}
        </>
      ) : (
        <span className="wd-dq-muted-line">{empty}</span>
      )}
    </div>
  );
}

export function StageEvidence({ detail, language }: { detail: ActiveDecisionView; language: Language }) {
  const evidence = detail.evidence;
  const total = evidence.supporting.length + evidence.opposing.length;

  return (
    <div className="wd-stack-2" data-testid="decision-part-evidence">
      <div className="wd-dq-evidence-pair">
        <EvidenceCard
          item={evidence.strongestSupporting}
          heading={say(COPY.strongestFor, language)}
          empty={say(COPY.noneFor, language)}
          tone="for"
          language={language}
        />
        <EvidenceCard
          item={evidence.strongestOpposing}
          heading={say(COPY.strongestAgainst, language)}
          empty={say(COPY.noneAgainst, language)}
          tone="against"
          language={language}
        />
      </div>

      <dl className="wd-dq-evidence-facts">
        <div data-testid="decision-evidence-conflict">
          <dt>{say(COPY.conflictLabel, language)}</dt>
          <dd>{evidence.conflict.label}</dd>
        </div>
        <div data-testid="decision-evidence-stale">
          <dt>{say(COPY.staleLabel, language)}</dt>
          <dd>
            {evidence.stale.length === 0 ? (
              say(COPY.noStale, language)
            ) : (
              <span className="wd-dq-clamp-2" lang={language === "de" ? "en" : undefined}>
                {evidence.stale.map((item) => item.reference).join(", ")}
                {evidence.stale[0]?.staleNote ? `: ${evidence.stale[0].staleNote}` : ""}
              </span>
            )}
          </dd>
        </div>
        <div data-testid="decision-evidence-uncertainty">
          <dt>{say(COPY.uncertaintyLabel, language)}</dt>
          <dd className="wd-dq-clamp-2" lang={proseLang(detail)}>
            {evidence.uncertainty}
          </dd>
        </div>
        {evidence.missing.length > 0 || evidence.unresolvedIds.length > 0 ? (
          <div>
            <dt>{say(COPY.missingLabel, language)}</dt>
            <dd>
              {[
                evidence.missing.map((item) => `${item.reference} (${item.statusLabel})`).join(", "),
                evidence.unresolvedIds.length > 0
                  ? fill(say(COPY.unresolved, language), { count: evidence.unresolvedIds.length })
                  : "",
              ]
                .filter((part) => part.length > 0)
                .join(". ")}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="wd-dq-prepared">
        <span className="wd-dq-label" data-tone="accent">
          <IconSparkles size={13} stroke={2} aria-hidden="true" />
          {say(COPY.aiPrepared, language)}
        </span>
        <p className="wd-dq-body wd-dq-clamp-2" lang={proseLang(detail)}>
          {evidence.preparedPosition}
        </p>
      </div>

      {total > 0 ? (
        <WorkdayDisclosure label={say(COPY.allEvidence, language)} count={total} language={language}>
          <ul className="wd-dq-evidence-list">
            {evidence.supporting.map((item) => (
              <li key={`for-${item.id}`}>
                <span className="wd-chip" data-tone="success">
                  {say(COPY.forHeading, language)}
                </span>
                <span className="wd-dq-truncate" lang={language === "de" ? "en" : undefined}>
                  {item.title}
                </span>
                <span className="wd-oid">{item.reference}</span>
              </li>
            ))}
            {evidence.opposing.map((item) => (
              <li key={`against-${item.id}`}>
                <span className="wd-chip" data-tone="warning">
                  {say(COPY.againstHeading, language)}
                </span>
                <span className="wd-dq-truncate" lang={language === "de" ? "en" : undefined}>
                  {item.title}
                </span>
                <span className="wd-oid">{item.reference}</span>
              </li>
            ))}
          </ul>
        </WorkdayDisclosure>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   4. Options
   ========================================================================== */

export function StageOptions({
  detail,
  language,
  selectedOptionId,
  onSelect,
}: {
  detail: ActiveDecisionView;
  language: Language;
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
}) {
  return (
    <div
      className="wd-dq-options"
      role="radiogroup"
      aria-label={say(COPY.optionsLabel, language)}
      data-testid="decision-part-options"
    >
      {detail.options.map((option) => (
        <OptionCard
          key={option.id}
          option={option}
          language={language}
          proseIsEnglish={detail.proseIsEnglish}
          selected={option.id === selectedOptionId}
          onSelect={() => onSelect(option.id)}
        />
      ))}
    </div>
  );
}

/**
 * One option.
 *
 * The implication carries the weight, then what the option changes and where,
 * then the approval it needs. Two options can be described in nearly the same
 * words and differ entirely in what they commit the bank to.
 */
function OptionCard({
  option,
  language,
  proseIsEnglish,
  selected,
  onSelect,
}: {
  option: DecisionOptionCard;
  language: Language;
  proseIsEnglish: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className="wd-dq-option"
      data-selected={selected}
      data-option-id={option.id}
      onClick={onSelect}
    >
      <span className="wd-dq-option-head">
        <span className="wd-dq-option-label">{option.label}</span>
        {option.isRecommended ? (
          <span className="wd-chip" data-tone="info">
            {say(COPY.recommended, language)}
          </span>
        ) : null}
      </span>
      <span className="wd-dq-option-implication" lang={proseIsEnglish ? "en" : undefined}>
        {option.implication}
      </span>
      <span className="wd-dq-option-meta">
        {option.changes.length === 0
          ? say(COPY.noChanges, language)
          : fill(say(option.changes.length === 1 ? COPY.changesInOne : COPY.changesIn, language), {
              count: option.changes.length,
              systems: option.systems.join(", "),
            })}
      </span>
      <span className="wd-dq-option-meta">
        <IconLock size={11} stroke={2} aria-hidden="true" />
        {option.approvalSummary}
      </span>
      {option.refused ? (
        <span className="wd-dq-option-meta" data-tone="warning">
          <IconAlertTriangle size={11} stroke={2} aria-hidden="true" />
          {fill(say(COPY.optionRefused, language), {
            count: option.changes.filter((change) => change.refusal !== null).length,
          })}
        </span>
      ) : null}
    </button>
  );
}

/* ==========================================================================
   5. Confirm and execute
   ========================================================================== */

/** One change, its approval, and its exact payload behind a toggle. */
function ChangeRow({
  change,
  approved,
  onToggle,
  language,
  disabled,
}: {
  change: ChangeView;
  approved: boolean;
  onToggle: (value: boolean) => void;
  language: Language;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const checkboxId = `wd-dq-approve-${change.key.replace(/[^A-Za-z0-9-]/g, "-")}`;
  const panelId = `${checkboxId}-payload`;

  return (
    <li className="wd-dq-change" data-approved={approved} data-testid="decision-change">
      <div className="wd-dq-change-head">
        {/*
          * Three states, never confused: a change the gate would refuse
          * (nothing to approve, and the option cannot be confirmed), a change
          * that needs this person's approval, and a routine change that runs
          * within policy.
          */}
        {change.refusal !== null ? (
          <IconAlertTriangle size={14} stroke={2} aria-hidden="true" className="wd-dq-change-refused" />
        ) : change.requiresApproval ? (
          <input
            id={checkboxId}
            type="checkbox"
            checked={approved}
            disabled={disabled}
            onChange={(event) => onToggle(event.target.checked)}
            aria-describedby={`${checkboxId}-target`}
          />
        ) : (
          <IconCheck size={14} stroke={2} aria-hidden="true" className="wd-dq-change-auto" />
        )}
        <span className="wd-stack-1 wd-dq-change-main">
          {change.requiresApproval && change.refusal === null ? (
            <label htmlFor={checkboxId} className="wd-dq-change-label">
              {change.label}
              <span className="wd-sr-only">. {say(COPY.approveChange, language)}</span>
            </label>
          ) : (
            <span className="wd-dq-change-label">{change.label}</span>
          )}
          <span id={`${checkboxId}-target`} className="wd-dq-micro wd-dq-truncate" data-testid="decision-change-target">
            {change.register}
            <span aria-hidden="true"> · </span>
            <span className="wd-mono">{change.targetId}</span>
            {change.requiresApproval || change.refusal !== null ? null : (
              <>
                <span aria-hidden="true"> · </span>
                {say(COPY.noApprovalChange, language)}
              </>
            )}
          </span>
        </span>
        <button
          type="button"
          className="wd-dq-change-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          {say(COPY.exactChange, language)}
          <IconChevronDown size={13} stroke={2} aria-hidden="true" data-open={open} />
        </button>
      </div>
      {change.refusal ? (
        <span className="wd-dq-micro" data-tone="warning">
          {change.refusal}
        </span>
      ) : null}
      {open ? (
        <div id={panelId} className="wd-dq-payload" data-testid="decision-change-payload">
          <dl>
            {change.fields.map((field) => (
              <div key={`${change.key}-${field.label}`}>
                <dt>{field.label}</dt>
                <dd lang={language === "de" ? "en" : undefined}>{field.value}</dd>
              </div>
            ))}
          </dl>
          <span className="wd-dq-micro">{change.system}</span>
          <span className="wd-dq-micro">{fill(say(COPY.bindingNote, language), { reference: change.reference })}</span>
        </div>
      ) : null}
    </li>
  );
}

export function StageConfirm({
  detail,
  language,
  option,
  rationale,
  onRationaleChange,
  confirmed,
  onConfirmedChange,
  approved,
  onApprovedChange,
  onConfirm,
  pending,
  enabled,
  refusal,
}: {
  detail: ActiveDecisionView;
  language: Language;
  option: DecisionOptionCard | null;
  rationale: string;
  onRationaleChange: (value: string) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  approved: ReadonlySet<string>;
  onApprovedChange: (fingerprint: string, value: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  enabled: boolean;
  /** A refusal from the last attempt, shown where the reader acts. */
  refusal: { message: string; reasons: string[] } | null;
}) {
  const authority = detail.authority;
  const fieldId = `wd-dq-rationale-${detail.decisionId}`;
  const helpId = `${fieldId}-help`;
  const checkboxId = `wd-dq-confirm-${detail.decisionId}`;
  const written = rationale.trim().length;
  const required = requiredApprovals(option);
  const approvedCount = required.filter((fingerprint) => approved.has(fingerprint)).length;

  const blocked: string[] = [];
  if (option?.refused) blocked.push(say(COPY.confirmBlockedRefused, language));
  if (written < MINIMUM_RATIONALE_LENGTH) {
    blocked.push(fill(say(COPY.confirmBlockedRationale, language), { minimum: MINIMUM_RATIONALE_LENGTH }));
  }
  if (!confirmed) blocked.push(say(COPY.confirmBlockedOwnership, language));
  if (!allChangesApproved(option, approved)) blocked.push(say(COPY.confirmBlockedApprovals, language));

  return (
    <div className="wd-dq-confirm-grid" data-testid="decision-part-confirm">
      {/* The reader's choice and their own words. */}
      <div className="wd-stack-2">
        <div className="wd-stack-1">
          <span className="wd-dq-label">{say(COPY.chosenOption, language)}</span>
          {option ? (
            <span className="wd-dq-body wd-dq-strongish wd-dq-clamp-2" data-testid="decision-chosen-option">
              {option.label}
            </span>
          ) : (
            <span className="wd-dq-muted-line" data-testid="decision-chosen-option">
              {say(COPY.chooseFirst, language)}
            </span>
          )}
        </div>

        <div className="wd-stack-1">
          <label className="wd-dq-label" htmlFor={fieldId}>
            <IconUser size={13} stroke={2} aria-hidden="true" />
            {say(COPY.yourReasoning, language)}
          </label>
          <textarea
            id={fieldId}
            className="wd-dq-textarea"
            value={rationale}
            onChange={(event) => onRationaleChange(event.target.value)}
            placeholder={say(COPY.rationalePlaceholder, language)}
            aria-describedby={helpId}
            rows={4}
          />
          <span id={helpId} className="wd-dq-micro">
            {fill(say(COPY.charactersOf, language), { written, minimum: MINIMUM_RATIONALE_LENGTH })}
            <span aria-hidden="true"> · </span>
            {say(COPY.yourReasoningHelp, language)}
          </span>
        </div>

        <label className="wd-dq-confirm" htmlFor={checkboxId}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={confirmed}
            onChange={(event) => onConfirmedChange(event.target.checked)}
          />
          <span className="wd-stack-1">
            <span className="wd-strong">{t(ACTION_LABELS, "confirmRationale", language)}</span>
            <span className="wd-dq-micro">
              {fill(say(COPY.ownership, language), { name: authority.approverName, title: authority.approverTitle })}
            </span>
          </span>
        </label>
      </div>

      {/* The exact changes, each approved on its own, and the one action. */}
      <div className="wd-stack-2">
        <div className="wd-dq-changes-head">
          <span className="wd-dq-label">{say(COPY.changesToApprove, language)}</span>
          {required.length > 0 ? (
            <span className="wd-dq-micro" data-testid="decision-approved-count">
              {fill(say(COPY.approvedCount, language), { approved: approvedCount, required: required.length })}
            </span>
          ) : null}
        </div>
        {option && option.changes.length > 0 ? (
          <ul className="wd-dq-change-list" data-testid="decision-changes">
            {option.changes.map((change) => (
              <ChangeRow
                key={change.key}
                change={change}
                approved={change.fingerprint !== null && approved.has(change.fingerprint)}
                onToggle={(value) => change.fingerprint && onApprovedChange(change.fingerprint, value)}
                language={language}
                disabled={pending}
              />
            ))}
          </ul>
        ) : (
          <span className="wd-dq-muted-line">{say(COPY.noChanges, language)}</span>
        )}

        <span className="wd-dq-micro" data-testid="decision-approver">
          <span className="wd-chip" data-tone={AUTHORITY_TONES[authority.authorityClass]}>
            {authority.requiresApproval ? <IconLock size={11} stroke={2} aria-hidden="true" /> : null}
            {authority.authorityLabel}
          </span>{" "}
          {fill(say(COPY.approverLine, language), { name: authority.approverName, title: authority.approverTitle })}{" "}
          {say(COPY.autonomyLabel, language)}: {authority.autonomyLabel}.
        </span>

        {!authority.reachable ? (
          <p className="wd-notice" data-tone="warning">
            <IconAlertTriangle size={14} stroke={2} aria-hidden="true" />
            {authority.gateNote}
          </p>
        ) : null}

        {refusal ? (
          <div className="wd-notice" data-tone="warning" role="alert" data-testid="decision-refusal">
            <IconAlertTriangle size={14} stroke={2} aria-hidden="true" />
            <span className="wd-stack-1">
              <span className="wd-strong">{say(COPY.refusedTitle, language)}</span>
              <span>{refusal.message}</span>
              {refusal.reasons.map((reason) => (
                <span key={reason} className="wd-dq-micro">
                  {reason}
                </span>
              ))}
            </span>
          </div>
        ) : null}

        <div className="wd-row wd-row-wrap">
          <button
            type="button"
            className="wd-btn wd-btn-primary wd-btn-lg"
            disabled={!enabled}
            onClick={onConfirm}
            data-testid="decision-confirm"
          >
            {pending ? (
              say(COPY.confirming, language)
            ) : (
              <>
                <IconCheck size={16} stroke={2} aria-hidden="true" />
                {say(COPY.confirmAction, language)}
              </>
            )}
          </button>
          {!enabled && !pending && blocked.length > 0 ? (
            <span className="wd-dq-micro" data-testid="decision-confirm-blocked">
              {blocked.join(" ")}
            </span>
          ) : null}
        </div>
        <span className="wd-dq-micro">{say(COPY.auditNote, language)}</span>
      </div>
    </div>
  );
}
