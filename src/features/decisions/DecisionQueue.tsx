"use client";

/**
 * The decision queue, V3.1.
 *
 * One queue, and exactly one decision expanded inside it. Selecting another
 * row collapses the previous one, which is enforced by the state being a
 * single identifier rather than a set: there is nothing to add a second value
 * to. V2 expanded every open decision at once, which put four full decision
 * flows in one scroll and made the screen a list of forms rather than a
 * queue of judgments.
 *
 * The expanded decision sits directly under its own row rather than in a
 * second column. That keeps the reader's eye in one place, and it is what lets
 * the queue and the active stage share 1366x768 without a right hand rail:
 * three collapsed rows are 120px, the selected row is 40px, and the stage
 * panel has the rest. Evidence is one click away in the existing contextual
 * drawer, which overlays rather than taking a column.
 *
 * The stage machine lives in `ActiveDecision`, which is keyed by the decision
 * identifier. So moving to another decision remounts it, and the stage, the
 * chosen option, the rationale and the confirmation all reset by construction.
 * Carrying a half written rationale from one decision to another would be the
 * worst possible bug in this screen.
 *
 * Confirm calls `actionRecordDecision`, the server action that already exists.
 * It is the same entry point the V1 and V2 decision flows use, it goes through
 * `recordDecisionAndExecute`, and from there through `grantApproval` and the
 * authority gate, writing the existing audit trail and the existing execution
 * receipt. There is no second write path in this feature and nothing in it
 * inserts a row.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconCheck, IconLock } from "@tabler/icons-react";
import { actionRecordDecision } from "@app/actions";
import type { DecisionActionResult } from "@app/actions";
import { WorkdayDisclosure } from "@/components/workday-v3/WorkdayDisclosure";
import type { Language } from "@/i18n/labels";
import { AUTHORITY_TONES, COPY, say } from "./copy";
import {
  RegulatoryLine,
  StageCompare,
  StageConfirm,
  StageExplain,
  StageHint,
  StageIndicator,
  StageUnderstand,
} from "./DecisionStages";
import {
  canAdvance,
  canConfirm,
  findDetail,
  isFirstStage,
  isLastStage,
  nextStage,
  previousStage,
  type ActiveDecisionView,
  type DecisionQueueRow,
  type DecisionQueueViewModel,
  type DecisionStage,
} from "./model";

/**
 * The one panel the queue opens into.
 *
 * A constant identifier rather than one per row, because there is exactly one
 * panel. Every row's `aria-controls` points at it and the selected row's
 * `aria-expanded` says whether it is showing that row's decision.
 */
const PANEL_ID = "wd-dq-active-decision";

export function DecisionQueue({ model }: { model: DecisionQueueViewModel }) {
  const language = model.language as Language;
  const [activeId, setActiveId] = useState<string | null>(model.initialActiveId);
  const active = findDetail(model, activeId);

  if (model.rows.length === 0 && model.recorded.length === 0) {
    return (
      <div className="wd-empty">
        <span className="wd-empty-title">{say(COPY.nothingOpen, language)}</span>
        <span>{say(COPY.nothingOpenDetail, language)}</span>
      </div>
    );
  }

  return (
    <div className="wd-stack-4">
      {model.rows.length > 0 ? (
        <section aria-label={say(COPY.queueLabel, language)}>
          {/*
            * The whole queue, then the active decision under it.
            *
            * The first version expanded the panel between the selected row and
            * the one below it, which reads well and measures badly: with the
            * fourth row selected, three collapsed rows sat above the panel and
            * the confirm action fell 77px below the fold at 1366x768, while
            * with the first row selected the same panel fitted. The reader's
            * budget changed depending on which row they picked.
            *
            * Below the queue, the height is the same whichever row is active:
            * four rows, then the panel. The whole queue stays on screen, the
            * selected row carries the accent edge, and `aria-controls` ties
            * the row to the panel it opens.
            */}
          <div className="wd-queue">
            {model.rows.map((row) => (
              <QueueRow
                key={row.decisionId}
                row={row}
                language={language}
                selected={row.decisionId === activeId}
                panelId={PANEL_ID}
                /*
                 * Selecting is not a toggle. A reader who clicks the open row
                 * expects nothing to happen, not the one thing on the screen
                 * to disappear, and the brief asks for exactly one active
                 * decision rather than at most one.
                 */
                onSelect={() => setActiveId(row.decisionId)}
              />
            ))}
          </div>
          {active ? (
            <ActiveDecision
              key={active.decisionId}
              id={PANEL_ID}
              detail={active}
              language={language}
            />
          ) : null}
        </section>
      ) : (
        <div className="wd-empty">
          <span className="wd-empty-title">{say(COPY.nothingOpen, language)}</span>
          <span>{say(COPY.nothingOpenDetail, language)}</span>
        </div>
      )}

      {model.recorded.length > 0 ? (
        <section aria-label={say(COPY.recordedToday, language)}>
          <WorkdayDisclosure
            label={say(COPY.recordedToday, language)}
            count={model.recorded.length}
            language={language}
          >
            <div className="wd-list">
              {model.recorded.map((row) => (
                <span key={row.decisionId} className="wd-item" id={row.decisionId}>
                  <IconCheck
                    size={14}
                    stroke={2.2}
                    aria-hidden="true"
                    style={{ color: "var(--wd-success)", flexShrink: 0 }}
                  />
                  <span className="wd-item-main">
                    <span className="wd-item-title">{row.headline}</span>
                    <span className="wd-item-sub">
                      {row.chosenOptionLabel ?? row.judgmentLabel}
                    </span>
                  </span>
                  <span className="wd-mono wd-muted wd-shrink-0">
                    {row.decidedAtMoment ?? row.presentedAtMoment}
                  </span>
                </span>
              ))}
            </div>
          </WorkdayDisclosure>
        </section>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   One queued row
   ========================================================================== */

/**
 * One line, readable without opening it.
 *
 * The headline is the only thing with text weight, and it is what
 * distinguishes this decision from the one under it. The action class the
 * reader is about to perform is identical on every row, so it is not on the
 * row at all: it is the label on the confirm button, which is where a reader
 * looks for what to do.
 */
function QueueRow({
  row,
  language,
  selected,
  panelId,
  onSelect,
}: {
  row: DecisionQueueRow;
  language: Language;
  selected: boolean;
  panelId: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      id={row.decisionId}
      className="wd-queue-row wd-dq-row"
      data-selected={selected}
      aria-expanded={selected}
      aria-controls={panelId}
      /*
       * The clause the row does not have room for, available on hover and to
       * assistive technology without costing the row a second line.
       */
      title={row.summary}
      onClick={onSelect}
    >
      <span className="wd-cell wd-cell-primary wd-dq-row-headline">{row.headline}</span>
      <span className="wd-cell wd-muted wd-dq-row-kind">{row.judgmentLabel}</span>
      <span className="wd-chip" data-tone={AUTHORITY_TONES[row.authorityClass]}>
        {row.authorityClass === "APPROVAL_REQUIRED" ? (
          <IconLock size={11} stroke={2} aria-hidden="true" />
        ) : null}
        {row.authorityLabel}
      </span>
      <span className="wd-mono wd-muted wd-shrink-0">{row.presentedAtMoment}</span>
      <span className="wd-sr-only">
        {selected ? say(COPY.active, language) : say(COPY.openRow, language)}
      </span>
    </button>
  );
}

/* ==========================================================================
   The active decision and its stage machine
   ========================================================================== */

function ActiveDecision({
  id,
  detail,
  language,
}: {
  id: string;
  detail: ActiveDecisionView;
  language: Language;
}) {
  const [stage, setStage] = useState<DecisionStage>("understand");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [rationaleConfirmed, setRationaleConfirmed] = useState(false);
  const [result, setResult] = useState<DecisionActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const option = detail.options.find((candidate) => candidate.id === selectedOptionId) ?? null;
  const forward = canAdvance(stage, { selectedOptionId, rationale });
  const confirmable = canConfirm({
    selectedOptionId,
    rationale,
    rationaleConfirmed,
    authority: detail.authority,
    pending,
  });

  /**
   * Records the decision.
   *
   * One call to the existing server action, which validates the input, refuses
   * an unconfirmed rationale, and then hands the work to the scenario engine.
   * The engine grants an approval per consequence, fingerprinted to that
   * consequence's own payload, and executes each through the authority gate.
   * The receipt this component then shows is read back from what the engine
   * reported as executed, never from the option's declared consequences.
   */
  const confirm = () => {
    if (!option) return;
    start(async () => {
      const response = await actionRecordDecision({
        decisionId: detail.decisionId,
        optionId: option.id,
        rationale: rationale.trim(),
        rationaleConfirmed,
      });
      setResult(response);
      router.refresh();
    });
  };

  if (result !== null) {
    return (
      <div
        className="wd-dq-active"
        id={id}
        data-presentation-region="decision-result"
        data-presentation-ready={result.receiptStatements.length > 0 ? "true" : undefined}
      >
        <ConfirmResult result={result} language={language} />
      </div>
    );
  }

  return (
    <div className="wd-dq-active" id={id} aria-label={detail.headline}>
      {/*
        * The stepper and the stage's own one line brief share a row.
        *
        * Stacked they cost 24px of the panel, and at 1366x768 that was the
        * difference between the forward control being on screen and 16px
        * under the fold. The stepper is about 340px of an 880px column, so
        * the hint sits beside it without either of them wrapping.
        */}
      <div className="wd-dq-stage-head">
        <StageIndicator stage={stage} language={language} onGo={setStage} />
        <StageHint stage={stage} language={language} />
      </div>

      <div className="wd-dq-stage">
        {stage === "understand" ? (
          <StageUnderstand detail={detail} language={language} />
        ) : null}
        {stage === "compare" ? (
          <StageCompare
            detail={detail}
            language={language}
            selectedOptionId={selectedOptionId}
            onSelect={setSelectedOptionId}
          />
        ) : null}
        {stage === "explain" ? (
          <StageExplain
            detail={detail}
            language={language}
            rationale={rationale}
            onRationaleChange={setRationale}
          />
        ) : null}
        {stage === "confirm" ? (
          <StageConfirm
            detail={detail}
            language={language}
            option={option}
            confirmed={rationaleConfirmed}
            onConfirmedChange={setRationaleConfirmed}
            onConfirm={confirm}
            pending={pending}
            enabled={confirmable}
          />
        ) : null}
      </div>

      <div className="wd-dq-nav">
        <button
          type="button"
          className="wd-btn wd-btn-quiet"
          disabled={isFirstStage(stage)}
          onClick={() => setStage(previousStage(stage))}
        >
          <IconArrowLeft size={15} stroke={2} aria-hidden="true" />
          {say(COPY.back, language)}
        </button>

        {isLastStage(stage) ? null : (
          <button
            type="button"
            className="wd-btn wd-btn-secondary"
            disabled={!forward}
            onClick={() => setStage(nextStage(stage))}
          >
            {say(COPY.forward, language)}
            <IconArrowRight size={15} stroke={2} aria-hidden="true" />
          </button>
        )}

        {!forward && !isLastStage(stage) ? (
          <span className="wd-dq-micro">
            {stage === "compare" ? say(COPY.chooseFirst, language) : say(COPY.writeMore, language)}
          </span>
        ) : null}

        <span className="wd-dq-nav-spacer" />
        <RegulatoryLine language={language} />
      </div>
    </div>
  );
}

/* ==========================================================================
   What actually happened
   ========================================================================== */

/**
 * The result of a confirm.
 *
 * Rendered from the engine's reply, which lists the changes that completed and
 * the ones that did not. A blocked consequence is shown rather than hidden: a
 * reader who approved seven changes and got six is owed the seventh.
 */
function ConfirmResult({
  result,
  language,
}: {
  result: DecisionActionResult;
  language: Language;
}) {
  return (
    <div className="wd-stack-3">
      <p className="wd-notice" data-tone={result.ok ? "info" : "warning"}>
        <IconCheck size={14} stroke={2} aria-hidden="true" />
        {result.message}
      </p>

      {result.receiptStatements.length > 0 ? (
        <div className="wd-stack-1">
          <span className="wd-dq-label">
            {say(COPY.receiptLabel, language)}
            <span className="wd-disclosure-count">{result.receiptStatements.length}</span>
          </span>
          <ul className="wd-dq-receipt">
            {result.receiptStatements.map((statement, index) => (
              <li key={`receipt-${index}`}>{statement}</li>
            ))}
          </ul>
          <span className="wd-dq-micro">{say(COPY.receiptNote, language)}</span>
        </div>
      ) : null}

      {result.blockedReasons.length > 0 ? (
        <div className="wd-stack-1">
          <span className="wd-dq-label">
            {say(COPY.notExecuted, language)}
            <span className="wd-disclosure-count">{result.blockedReasons.length}</span>
          </span>
          <ul className="wd-dq-receipt" data-tone="warning">
            {result.blockedReasons.map((reason, index) => (
              <li key={`blocked-${index}`}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <RegulatoryLine language={language} />
    </div>
  );
}
