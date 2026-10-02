"use client";

/**
 * The four stages of one decision.
 *
 * Understand, Compare, Explain, Confirm, and exactly one of them on screen.
 * That is the difference between this and the V2 decision flow, which rendered
 * the question, both evidence lists, the uncertainty, every option, the
 * rationale field and the confirmation in one column, for several decisions at
 * once. Everything V2 showed is still reachable; it is distributed across four
 * stages so the reader is asked one question at a time.
 *
 * What is deliberately absent, and the reason, because these are the same
 * frictions the V2 flow argues for and they are the point of the product:
 *
 *   no option is pre-selected;
 *   the rationale is never pre-filled with the preparation's text, and there
 *   is no control that copies it in, because a one click accept would make the
 *   claim that a person owns the reasoning false;
 *   the preparation and the reader's own words sit in two separately labelled
 *   blocks, so the record can always say which is which;
 *   nothing executes until the reader confirms the rationale is theirs.
 *
 * Evidence is not on any stage. It opens in the contextual drawer through the
 * existing trigger, one click from the stage that cites it.
 */

import {
  IconAlertTriangle,
  IconCheck,
  IconLock,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import { WorkdayDisclosure } from "@/components/workday-v3/WorkdayDisclosure";
import { WorkdayEvidenceTrigger } from "@/components/workday-v3/WorkdayEvidenceTrigger";
import { ACTION_LABELS, PRODUCT_COPY, t, type Language } from "@/i18n/labels";
import { AUTHORITY_TONES, COPY, STAGE_HINTS, STAGE_LABELS, say } from "./copy";
import {
  DECISION_STAGES,
  MINIMUM_RATIONALE_LENGTH,
  stageIndex,
  type ActiveDecisionView,
  type DecisionOptionCard,
  type DecisionStage,
} from "./model";

/* ==========================================================================
   Where the reader is
   ========================================================================== */

/**
 * The stage indicator.
 *
 * An ordered list with `aria-current="step"`, which is the thing a screen
 * reader needs and which also gives the visible treatment something to key
 * on. Stages already passed are buttons so backward movement is available
 * without stepping through; stages ahead are inert, because skipping Compare
 * would put a reader on Explain with nothing chosen to explain.
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

/** One line saying what this stage asks for. */
export function StageHint({ stage, language }: { stage: DecisionStage; language: Language }) {
  return <p className="wd-dq-hint">{say(STAGE_HINTS[stage], language)}</p>;
}

/**
 * The regulatory disclosure.
 *
 * Rendered on every stage of every decision rather than when a detector fires.
 * Second line decision copy routinely names an obligation, a policy section or
 * a supervisory expectation, and a disclosure that depends on a keyword list
 * is a disclosure that can be forgotten. The wording is the product's single
 * one from `PRODUCT_COPY`, in both languages, so there is no second version of
 * it to drift.
 */
export function RegulatoryLine({ language }: { language: Language }) {
  return <p className="wd-regulatory">{t(PRODUCT_COPY, "regulatoryNote", language)}</p>;
}

/* ==========================================================================
   1. Understand
   ========================================================================== */

export function StageUnderstand({
  detail,
  language,
}: {
  detail: ActiveDecisionView;
  language: Language;
}) {
  return (
    <div className="wd-stack-3">
      <p className="wd-dq-body">{detail.understandParagraph}</p>
      <div className="wd-row wd-row-wrap">
        <WorkdayEvidenceTrigger
          language={language}
          count={detail.evidenceCount}
          objectLabel={detail.headline}
        />
        <span className="wd-oid">{detail.reference}</span>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. Compare
   ========================================================================== */

export function StageCompare({
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
    <div className="wd-dq-options" role="radiogroup" aria-label={say(COPY.optionsLabel, language)}>
      {detail.options.map((option) => (
        <OptionCard
          key={option.id}
          option={option}
          language={language}
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
 * The implication is the field with the most weight, not the label. Two of the
 * seeded options on a single decision can be described in nearly the same
 * words and differ entirely in what they commit the bank to, so what an option
 * implies is what a reader is actually comparing.
 */
function OptionCard({
  option,
  language,
  selected,
  onSelect,
}: {
  option: DecisionOptionCard;
  language: Language;
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
      {/*
        * The label is a sibling of the clamped text, not a child of it.
        *
        * It was inside, and the rendered card showed what that costs: a block
        * child counts as one line against `-webkit-line-clamp`, so a clamp of
        * two gave the label plus a single line of the implication, and the
        * reader comparing two positions got half a sentence of each.
        */}
      <span className="wd-dq-micro">{say(COPY.implies, language)}</span>
      <span className="wd-dq-option-implication">
        {option.implication.length > 0 ? option.implication : option.description}
      </span>
      {option.consequenceLabels.length > 0 ? (
        <span className="wd-dq-micro">
          {say(COPY.willChange, language)}: {option.consequenceLabels.length}
        </span>
      ) : null}
    </button>
  );
}

/* ==========================================================================
   3. Explain
   ========================================================================== */

export function StageExplain({
  detail,
  language,
  rationale,
  onRationaleChange,
}: {
  detail: ActiveDecisionView;
  language: Language;
  rationale: string;
  onRationaleChange: (value: string) => void;
}) {
  const fieldId = `wd-dq-rationale-${detail.decisionId}`;
  const helpId = `${fieldId}-help`;
  const written = rationale.trim().length;

  return (
    <div className="wd-dq-explain">
      {/* The reader's own words. Named as theirs, and empty until they write. */}
      <div className="wd-stack-1">
        <label className="wd-dq-label" htmlFor={fieldId}>
          <IconUser size={13} stroke={2} aria-hidden="true" />
          {say(COPY.yourReasoning, language)}
        </label>
        <span className="wd-dq-micro">{say(COPY.yourReasoningHelp, language)}</span>
        <textarea
          id={fieldId}
          className="wd-dq-textarea"
          value={rationale}
          onChange={(event) => onRationaleChange(event.target.value)}
          placeholder={say(COPY.rationalePlaceholder, language)}
          aria-describedby={helpId}
          rows={5}
        />
        <span id={helpId} className="wd-dq-micro">
          {written} {say(COPY.charactersOf, language)} {MINIMUM_RATIONALE_LENGTH}{" "}
          {say(COPY.minimumRequired, language)}
        </span>
      </div>

      {/* What the AI prepared. A separate block, labelled as not the reader's. */}
      <div className="wd-dq-prepared">
        <span className="wd-dq-label" data-tone="accent">
          <IconSparkles size={13} stroke={2} aria-hidden="true" />
          {say(COPY.preparedByAi, language)}
        </span>
        <p className="wd-dq-body">{detail.preparedPosition}</p>
        {detail.uncertaintyNote.length > 0 ? (
          <>
            <span className="wd-dq-micro">{say(COPY.statedUncertainty, language)}</span>
            <p className="wd-dq-body">{detail.uncertaintyNote}</p>
          </>
        ) : null}
        <span className="wd-dq-micro">{say(COPY.separableNote, language)}</span>
      </div>
    </div>
  );
}

/* ==========================================================================
   4. Confirm
   ========================================================================== */

export function StageConfirm({
  detail,
  language,
  option,
  confirmed,
  onConfirmedChange,
  onConfirm,
  pending,
  enabled,
}: {
  detail: ActiveDecisionView;
  language: Language;
  option: DecisionOptionCard | null;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  enabled: boolean;
}) {
  const authority = detail.authority;
  const checkboxId = `wd-dq-confirm-${detail.decisionId}`;

  return (
    <div className="wd-stack-2">
      {/* The authority class, and who approves when the class demands one. */}
      <dl className="wd-dq-authority">
        <div>
          <dt>{say(COPY.authorityLabel, language)}</dt>
          <dd>
            <span className="wd-chip" data-tone={AUTHORITY_TONES[authority.authorityClass]}>
              {authority.requiresApproval ? (
                <IconLock size={11} stroke={2} aria-hidden="true" />
              ) : null}
              {authority.authorityLabel}
            </span>
          </dd>
        </div>
        <div>
          <dt>{say(COPY.approverLabel, language)}</dt>
          <dd>
            {authority.requiresApproval ? (
              <>
                {authority.approverName}
                <span className="wd-dq-micro">
                  {authority.approverTitle.length > 0
                    ? authority.approverTitle
                    : say(COPY.approvalPerChange, language)}
                </span>
              </>
            ) : (
              say(COPY.noApprovalNeeded, language)
            )}
          </dd>
        </div>
        <div>
          <dt>{say(COPY.autonomyLabel, language)}</dt>
          <dd>{authority.autonomyLabel}</dd>
        </div>
      </dl>

      {!authority.reachable ? (
        <p className="wd-notice" data-tone="warning">
          <IconAlertTriangle size={14} stroke={2} aria-hidden="true" />
          {authority.gateNote}
        </p>
      ) : null}

      {/*
        * The choice, read back, and the count of what it would change.
        *
        * The count is on screen and the list is one click away, which is the
        * same budget rule the rest of V3.1 applies: a reader at Confirm has
        * already compared the options and needs to know how many records this
        * touches, not to re-read seven consequence lines that would push the
        * confirm action below the fold.
        */}
      {option ? (
        <div className="wd-stack-1">
          <span className="wd-dq-label">{say(COPY.chosenOption, language)}</span>
          <span className="wd-dq-body">{option.label}</span>
          {option.consequenceLabels.length > 0 ? (
            <WorkdayDisclosure
              label={say(COPY.willChange, language)}
              count={option.consequenceLabels.length}
              language={language}
            >
              <ul className="wd-dq-changes">
                {option.consequenceLabels.map((label, index) => (
                  <li key={`${detail.decisionId}-change-${index}`}>{label}</li>
                ))}
              </ul>
            </WorkdayDisclosure>
          ) : null}
        </div>
      ) : (
        <p className="wd-dq-micro">{say(COPY.chooseFirst, language)}</p>
      )}

      {/* The confirmation, then one action. */}
      <label className="wd-dq-confirm" htmlFor={checkboxId}>
        <input
          id={checkboxId}
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmedChange(event.target.checked)}
        />
        <span className="wd-stack-1">
          <span className="wd-strong">{t(ACTION_LABELS, "confirmRationale", language)}</span>
          <span className="wd-dq-micro">{say(COPY.auditNote, language)}</span>
        </span>
      </label>

      <div className="wd-row wd-row-wrap">
        <button
          type="button"
          className="wd-btn wd-btn-primary wd-btn-lg"
          disabled={!enabled}
          onClick={onConfirm}
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
      </div>
    </div>
  );
}
