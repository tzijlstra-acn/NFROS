"use client";

/**
 * The decision queue, V3.3.
 *
 * One queue, and exactly one decision expanded under it. Selecting another row
 * collapses the previous one, which is enforced by the state being a single
 * identifier rather than a set: there is nothing to add a second value to.
 *
 * The expanded decision sits directly under the queue rather than in a second
 * column. That keeps the reader's eye in one place, and it is what lets the
 * queue and the active part share 1366x768 without a right hand rail. The
 * same slot holds the receipt of a recorded decision, so the receipt appears
 * exactly where the reader pressed Confirm and execute, and stays there after
 * the page re-renders from the database (J21).
 *
 * The five part machine lives in `ActiveDecision`, which is keyed by the
 * decision identifier. So moving to another decision remounts it, and the
 * part, the chosen option, the rationale, the confirmation and the per change
 * approvals all reset by construction. Carrying a half written rationale or an
 * approval from one decision to another would be the worst possible bug in
 * this screen.
 *
 * Confirm calls `actionConfirmDecision`, the feature's one server action. It
 * states the acting role, enforces the rationale minimum on the server, sends
 * the fingerprints of the changes the reader approved, and hands the work to
 * `recordDecisionAndExecute`, which plans, refuses or executes through the
 * authority gate and writes the audit trail and the receipt. Nothing in this
 * feature inserts a row.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconArrowUpRight, IconCheck, IconAlertTriangle, IconLock } from "@tabler/icons-react";
import { actionConfirmDecision, type DecisionConfirmState } from "./actions";
import { WorkdayDisclosure } from "@/components/workday-v3/WorkdayDisclosure";
import type { Language } from "@/i18n/labels";
import { AUTHORITY_TONES, COPY, say } from "./copy";
import { DecisionReceipt } from "./DecisionReceipt";
import {
  RegulatoryLine,
  StageConfirm,
  StageContext,
  StageEvidence,
  StageHint,
  StageIndicator,
  StageOptions,
  StageQuestion,
} from "./DecisionStages";
import {
  canAdvance,
  canConfirm,
  decisionFromHash,
  findDetail,
  findRecorded,
  isFirstStage,
  isLastStage,
  nextStage,
  previousStage,
  requiredApprovals,
  type ActiveDecisionView,
  type DecisionQueueRow,
  type DecisionQueueViewModel,
  type DecisionStage,
  type StageDecisionRow,
} from "./model";

/**
 * The one panel the queue opens into.
 *
 * A constant identifier rather than one per row, because there is exactly one
 * panel. Every row's `aria-controls` points at it.
 */
const PANEL_ID = "wd-dq-active-decision";

/** Writes the selection into the address, so a reload or a shared link opens the same decision. */
function rememberSelection(decisionId: string): void {
  try {
    window.history.replaceState(window.history.state, "", `#${encodeURIComponent(decisionId)}`);
  } catch {
    // A browser refusing history changes keeps the selection in memory only.
  }
}

export function DecisionQueue({ model }: { model: DecisionQueueViewModel }) {
  const language = model.language as Language;
  const [activeId, setActiveId] = useState<string | null>(model.initialActiveId);
  const open = findDetail(model, activeId);
  const recorded = open ? null : findRecorded(model, activeId);

  /*
   * Deep links select, they do not only scroll (J23).
   *
   * `/decisions#DEC-...` from Home, a process stage or the AI Partner names a
   * decision. On arrival and on every later hash change, the named decision
   * becomes the active one, open or recorded, and the panel is brought into
   * view. A hash that names nothing in this queue changes nothing.
   */
  useEffect(() => {
    const apply = () => {
      const id = decisionFromHash(model, window.location.hash);
      if (id === null) return;
      setActiveId(id);
      window.requestAnimationFrame(() => {
        document.getElementById(PANEL_ID)?.scrollIntoView({ block: "nearest" });
      });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // The model changes on every re-render from the server; the hash is read once per change of it.
  }, [model]);

  /*
   * After a confirm, the decision leaves the open queue and its receipt
   * arrives in `recordedDetails`. The active identifier is kept, so the slot
   * that showed the five parts now shows the receipt. If the identifier names
   * nothing (another tab recorded it, a reset removed it), fall back to the
   * first open decision rather than an empty panel.
   */
  useEffect(() => {
    if (activeId !== null && !findDetail(model, activeId) && !findRecorded(model, activeId)) {
      setActiveId(model.initialActiveId);
    }
  }, [model, activeId]);

  /*
   * A receipt on screen is named in the address. Written after the model
   * re-renders rather than at the click, because the router's refresh after a
   * confirm settles its own history entry, and a reload of the page must
   * reopen this receipt rather than the first open decision.
   */
  const recordedId = recorded?.decisionId ?? null;
  useEffect(() => {
    if (recordedId === null) return;
    if (decodeURIComponent(window.location.hash.replace(/^#/, "")) !== recordedId) rememberSelection(recordedId);
  }, [recordedId]);

  const select = useCallback((decisionId: string) => {
    setActiveId(decisionId);
    rememberSelection(decisionId);
  }, []);

  if (model.rows.length === 0 && model.recorded.length === 0 && model.stageRows.length === 0) {
    return (
      <div className="wd-empty">
        <span className="wd-empty-title">{say(COPY.nothingOpen, language)}</span>
        <span>{say(COPY.nothingOpenDetail, language)}</span>
      </div>
    );
  }

  const panel = open ? (
    <ActiveDecision
      key={open.decisionId}
      id={PANEL_ID}
      roleId={model.roleId}
      detail={open}
      language={language}
      onRecorded={() => rememberSelection(open.decisionId)}
    />
  ) : recorded ? (
    <DecisionReceipt key={recorded.decisionId} id={PANEL_ID} detail={recorded} language={language} />
  ) : null;

  return (
    <div className="wd-stack-4">
      <section aria-label={say(COPY.queueLabel, language)}>
        {model.rows.length > 0 ? (
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
                 * to disappear.
                 */
                onSelect={() => select(row.decisionId)}
              />
            ))}
          </div>
        ) : (
          <div className="wd-empty">
            <span className="wd-empty-title">{say(COPY.nothingOpen, language)}</span>
            <span>{say(COPY.nothingOpenDetail, language)}</span>
          </div>
        )}
        {panel}
      </section>

      {model.stageRows.length > 0 || model.stageRowsUnavailable ? (
        <StageDecisions rows={model.stageRows} unavailable={model.stageRowsUnavailable} language={language} />
      ) : null}

      {model.recorded.length > 0 ? (
        <section aria-label={say(COPY.recordedToday, language)} data-testid="decision-recorded-today">
          <WorkdayDisclosure
            /*
             * Remounted open when a recorded decision is the active one, so
             * the row that matches the receipt above is visible beside it.
             */
            key={recorded ? "open" : "closed"}
            defaultOpen={recorded !== null}
            label={say(COPY.recordedToday, language)}
            count={model.recorded.length}
            language={language}
          >
            <div className="wd-list">
              {model.recorded.map((row) => (
                <RecordedRow
                  key={row.decisionId}
                  row={row}
                  language={language}
                  selected={row.decisionId === activeId}
                  onSelect={() => select(row.decisionId)}
                />
              ))}
            </div>
          </WorkdayDisclosure>
        </section>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Rows
   ========================================================================== */

/**
 * One line, readable without opening it.
 *
 * The headline is the only thing with text weight, and it is what
 * distinguishes this decision from the one under it. The action the reader is
 * about to perform is identical on every row, so it is not on the row at all.
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
      title={row.summary}
      onClick={onSelect}
    >
      <span className="wd-cell wd-cell-primary wd-dq-row-headline">{row.headline}</span>
      <span className="wd-cell wd-muted wd-dq-row-kind">{row.judgmentLabel}</span>
      <span className="wd-chip" data-tone={AUTHORITY_TONES[row.authorityClass]}>
        {row.authorityClass === "APPROVAL_REQUIRED" ? <IconLock size={11} stroke={2} aria-hidden="true" /> : null}
        {row.authorityLabel}
      </span>
      <span className="wd-mono wd-muted wd-shrink-0">{row.presentedAtMoment}</span>
      <span className="wd-sr-only">{selected ? say(COPY.active, language) : say(COPY.openRow, language)}</span>
    </button>
  );
}

/** A recorded decision. Opens its receipt in the panel above. */
function RecordedRow({
  row,
  language,
  selected,
  onSelect,
}: {
  row: DecisionQueueRow;
  language: Language;
  selected: boolean;
  onSelect: () => void;
}) {
  const partial = row.failedCount > 0;
  return (
    <button
      type="button"
      id={row.decisionId}
      className="wd-item wd-dq-recorded-row"
      data-selected={selected}
      aria-controls={PANEL_ID}
      aria-expanded={selected}
      onClick={onSelect}
      data-testid="decision-recorded-row"
    >
      {partial ? (
        <IconAlertTriangle size={14} stroke={2.2} aria-hidden="true" style={{ color: "var(--wd-warning)", flexShrink: 0 }} />
      ) : (
        <IconCheck size={14} stroke={2.2} aria-hidden="true" style={{ color: "var(--wd-success)", flexShrink: 0 }} />
      )}
      <span className="wd-item-main">
        <span className="wd-item-title">{row.headline}</span>
        <span className="wd-item-sub">{row.chosenOptionLabel ?? row.judgmentLabel}</span>
      </span>
      <span className="wd-mono wd-muted wd-shrink-0">{row.decidedAtMoment ?? row.presentedAtMoment}</span>
      <span className="wd-sr-only">{say(COPY.openReceipt, language)}</span>
    </button>
  );
}

/**
 * Judgments a process stage is waiting on.
 *
 * Listed so the queue is complete, and linked to the stage, because a stage
 * decision is recorded where the evidence it depends on is recorded.
 */
function StageDecisions({
  rows,
  unavailable,
  language,
}: {
  rows: StageDecisionRow[];
  unavailable: boolean;
  language: Language;
}) {
  return (
    <section aria-label={say(COPY.stageDecisions, language)} className="wd-stack-1" data-testid="decision-stage-rows">
      <div className="wd-dq-changes-head">
        <span className="wd-dq-label">
          {say(COPY.stageDecisions, language)}
          <span className="wd-disclosure-count">{rows.length}</span>
        </span>
        <span className="wd-dq-micro">{say(COPY.stageDecisionsNote, language)}</span>
      </div>
      {unavailable ? <span className="wd-dq-muted-line">{say(COPY.stageRowsUnavailable, language)}</span> : null}
      {rows.length > 0 ? (
        <div className="wd-queue">
          {rows.map((row) => (
            <a
              key={row.key}
              className="wd-queue-row wd-dq-stage-row"
              href={row.href ?? undefined}
              title={row.question}
              data-testid="decision-stage-row"
            >
              <span className="wd-cell wd-cell-primary wd-dq-row-headline">{row.label}</span>
              <span className="wd-cell wd-muted wd-dq-row-kind">{row.where}</span>
              <span className="wd-chip" data-tone={row.ready ? "info" : "neutral"}>
                {row.readyNote}
              </span>
              <span className="wd-dq-link wd-shrink-0">
                {say(COPY.openStage, language)}
                <IconArrowUpRight size={13} stroke={2} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/* ==========================================================================
   The active decision and its five parts
   ========================================================================== */

function ActiveDecision({
  id,
  roleId,
  detail,
  language,
  onRecorded,
}: {
  id: string;
  roleId: string;
  detail: ActiveDecisionView;
  language: Language;
  onRecorded: () => void;
}) {
  const [stage, setStage] = useState<DecisionStage>("question");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [rationaleConfirmed, setRationaleConfirmed] = useState(false);
  const [approved, setApproved] = useState<ReadonlySet<string>>(new Set());
  const [result, setResult] = useState<DecisionConfirmState | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const option = detail.options.find((candidate) => candidate.id === selectedOptionId) ?? null;
  const forward = canAdvance(stage, { selectedOptionId });
  const confirmable = canConfirm({
    selectedOptionId,
    option,
    rationale,
    rationaleConfirmed,
    approved,
    authority: detail.authority,
    pending,
  });

  /*
   * Choosing another option clears the approvals. An approval is bound to a
   * payload, and the payloads of one option are not the payloads of another,
   * so carrying the ticks across would show approvals that approve nothing.
   */
  const choose = (optionId: string) => {
    if (optionId !== selectedOptionId) setApproved(new Set());
    setSelectedOptionId(optionId);
    setResult(null);
  };

  const toggleApproval = (fingerprint: string, value: boolean) => {
    setApproved((current) => {
      const next = new Set(current);
      if (value) next.add(fingerprint);
      else next.delete(fingerprint);
      return next;
    });
  };

  /**
   * Records the decision.
   *
   * One call to the feature's server action. The engine re-plans the option,
   * compares the changes with the ones approved here, and refuses before
   * writing anything if they differ, if the role is not the decision's, or if
   * the gate would refuse any change. Otherwise it records the judgment,
   * grants one approval per change in the name of the decision role's holder,
   * executes each, and writes the receipt and the outcome record that the
   * receipt panel then reads.
   */
  const confirm = () => {
    if (!option) return;
    start(async () => {
      const response = await actionConfirmDecision({
        roleId,
        decisionId: detail.decisionId,
        optionId: option.id,
        rationale: rationale.trim(),
        rationaleConfirmed,
        approvedChanges: requiredApprovals(option),
      });
      setResult(response);
      if (response.recorded) {
        onRecorded();
        router.refresh();
      }
    });
  };

  return (
    <div className="wd-dq-active" id={id} aria-label={detail.headline} data-testid="decision-workspace">
      {/*
        * The stepper and the part's own one line brief share a row. Stacked
        * they cost 24px of the panel, which at 1366x768 is the difference
        * between the forward control being on screen or under the fold.
        */}
      <div className="wd-dq-stage-head">
        <StageIndicator stage={stage} language={language} onGo={setStage} />
        <StageHint stage={stage} language={language} />
      </div>

      <div className="wd-dq-stage" data-stage={stage}>
        {stage === "question" ? <StageQuestion detail={detail} language={language} /> : null}
        {stage === "context" ? <StageContext detail={detail} language={language} /> : null}
        {stage === "evidence" ? <StageEvidence detail={detail} language={language} /> : null}
        {stage === "options" ? (
          <StageOptions
            detail={detail}
            language={language}
            selectedOptionId={selectedOptionId}
            onSelect={choose}
          />
        ) : null}
        {stage === "confirm" ? (
          result?.recorded ? (
            <p className="wd-dq-outcome" data-tone={result.ok ? "success" : "warning"} role="status">
              {result.ok ? (
                <IconCheck size={15} stroke={2} aria-hidden="true" />
              ) : (
                <IconAlertTriangle size={15} stroke={2} aria-hidden="true" />
              )}
              {result.message}
            </p>
          ) : (
            <StageConfirm
              detail={detail}
              language={language}
              option={option}
              rationale={rationale}
              onRationaleChange={setRationale}
              confirmed={rationaleConfirmed}
              onConfirmedChange={setRationaleConfirmed}
              approved={approved}
              onApprovedChange={toggleApproval}
              onConfirm={confirm}
              pending={pending}
              enabled={confirmable}
              refusal={result && !result.recorded ? { message: result.message, reasons: result.reasons } : null}
            />
          )
        ) : null}
      </div>

      <div className="wd-dq-nav">
        <button
          type="button"
          className="wd-btn wd-btn-quiet"
          disabled={isFirstStage(stage) || pending}
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
            data-testid="decision-next"
          >
            {say(COPY.forward, language)}
            <IconArrowRight size={15} stroke={2} aria-hidden="true" />
          </button>
        )}

        {!forward && !isLastStage(stage) ? <span className="wd-dq-micro">{say(COPY.chooseFirst, language)}</span> : null}

        <span className="wd-dq-nav-spacer" />
        <RegulatoryLine language={language} />
      </div>
    </div>
  );
}
