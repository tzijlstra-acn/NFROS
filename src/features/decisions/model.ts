/**
 * The decision workspace model, V3.3.
 *
 * Types and pure functions only. No database access, no React, no server
 * imports, for the same reason `src/workday/contracts.ts` holds that line: the
 * stage machine has to be importable from the client component that drives it,
 * from the server component that builds the view, and from a test, without
 * dragging a SQLite handle along behind it.
 *
 * The shape of this module is the shape of plan section 4.10. One queue,
 * exactly one active decision, and that decision moves through five ordered
 * parts with only one of them visible: the question, its context, the
 * evidence, the options, and the confirmation that executes. Making the order
 * a frozen tuple rather than five booleans means the interface cannot show two
 * parts at once and cannot skip one, because there is nothing to set to make
 * that happen.
 *
 * It replaces the four step Understand, Compare, Explain, Confirm sequence.
 * What each of those carried is still here, redistributed: Understand became
 * the Question and its Context, Compare became the Options, and Explain moved
 * into Confirm and execute, which is where the rationale is owned and the
 * exact changes are approved.
 */

import type { AuthorityClass } from "@/db/schema/decisions";

/* ==========================================================================
   The five parts
   ========================================================================== */

/**
 * The parts, in order.
 *
 * The order is the argument: a reader who has not read the question cannot
 * place it, a reader who has not placed it cannot weigh the evidence, and a
 * reader who has not weighed the evidence has nothing to choose between.
 * Confirm and execute is last because it is the only part that writes.
 */
export const DECISION_STAGES = ["question", "context", "evidence", "options", "confirm"] as const;

export type DecisionStage = (typeof DECISION_STAGES)[number];

/** Position of a stage in the sequence. Zero based. */
export function stageIndex(stage: DecisionStage): number {
  return DECISION_STAGES.indexOf(stage);
}

export function isFirstStage(stage: DecisionStage): boolean {
  return stageIndex(stage) === 0;
}

export function isLastStage(stage: DecisionStage): boolean {
  return stageIndex(stage) === DECISION_STAGES.length - 1;
}

/**
 * The next stage, clamped at the last one.
 *
 * Clamped rather than wrapping. A reader who presses forward on Confirm must
 * not be returned to the Question with their selection intact and their stage
 * indicator reset, which is how a person records a decision they thought they
 * had already recorded.
 */
export function nextStage(stage: DecisionStage): DecisionStage {
  const at = stageIndex(stage);
  return DECISION_STAGES[Math.min(at + 1, DECISION_STAGES.length - 1)] ?? stage;
}

/** The previous stage, clamped at the first one. */
export function previousStage(stage: DecisionStage): DecisionStage {
  const at = stageIndex(stage);
  return DECISION_STAGES[Math.max(at - 1, 0)] ?? stage;
}

/**
 * The shortest rationale accepted as reasoning.
 *
 * Enforced twice: here, so the confirm control and the server action agree,
 * and in the feature's server action, which refuses a shorter rationale
 * whatever the browser sends. The engine itself refuses an empty one.
 */
export const MINIMUM_RATIONALE_LENGTH = 20;

/* ==========================================================================
   The queue
   ========================================================================== */

/**
 * One queued row.
 *
 * `headline` is the field the brief is strict about. It carries what
 * distinguishes this decision from the one under it, never the action class.
 * The defect this replaced rendered four rows headed "Record the decision",
 * which is what happens when the lead line is the shared verb.
 */
export interface DecisionQueueRow {
  decisionId: string;
  reference: string;
  /** What distinguishes this decision. Never a verb, never an action class. */
  headline: string;
  /** One clause on why a person is needed. Read without opening the row. */
  summary: string;
  /** The kind of judgment, as a short noun phrase. */
  judgmentLabel: string;
  authorityClass: AuthorityClass;
  authorityLabel: string;
  presentedAtMoment: string;
  decidedAtMoment: string | null;
  status: "open" | "recorded";
  fromSharedEvent: boolean;
  evidenceCount: number;
  optionCount: number;
  /** Real receipt lines written. Only meaningful once recorded. */
  receiptCount: number;
  /** Changes that did not execute. Only meaningful once recorded. */
  failedCount: number;
  /** The option the reader chose, once there is one. */
  chosenOptionLabel: string | null;
}

/* ==========================================================================
   The active decision: the five parts
   ========================================================================== */

/** A link to the work a decision belongs to, or the honest statement that there is none. */
export interface LinkView {
  label: string;
  /** Null when the target exists but has no route in this build. */
  href: string | null;
  /** One line of state, for example "Current stage, open". */
  detail: string;
}

/** 2. Context: why the decision exists and what is waiting on it. */
export interface DecisionContextView {
  /** Why this decision exists, in the professional's terms. */
  trigger: string;
  /** When it arrived and what brought it, for example the 14:05 event. */
  triggerMeta: string;
  /** The process stage waiting on this decision. Null when no installed stage names it. */
  process: LinkView | null;
  /** The meeting about the same subject. Null when there is none. */
  meeting: LinkView | null;
  /** The object the decision is about. */
  affected: { kindLabel: string; label: string } | null;
  /** The earliest response due on the same subject, with where it comes from. */
  deadline: { label: string; basis: string; passed: boolean } | null;
  /** What the record says about the affected object now, before the decision. */
  currentPosition: string | null;
}

/** One cited evidence document, compact enough to read in a line or two. */
export interface EvidenceItemView {
  id: string;
  reference: string;
  title: string;
  /** Source system and document date. */
  source: string;
  provenance: string;
  summary: string;
  stale: boolean;
  staleNote: string;
  /** "current", "requested", "missing" or another status from the record. */
  status: string;
  statusLabel: string;
}

/** 3. Evidence: the strongest case each way, the conflict, and what is uncertain. */
export interface DecisionEvidenceView {
  /** First cited supporting document, which is how the preparation ranks them. */
  strongestSupporting: EvidenceItemView | null;
  strongestOpposing: EvidenceItemView | null;
  supporting: EvidenceItemView[];
  opposing: EvidenceItemView[];
  conflict: { state: "conflicting" | "one-sided" | "uncontested"; label: string };
  /** Cited documents the record marks as stale. */
  stale: EvidenceItemView[];
  /** Cited documents that were requested and have not arrived, or are missing. */
  missing: EvidenceItemView[];
  /** Cited identifiers with no document in the corpus. */
  unresolvedIds: string[];
  uncertainty: string;
  /** What the AI prepared. Attributed, never merged with the reader's words. */
  preparedPosition: string;
}

/** One field of the exact payload an approval binds to. */
export interface ChangeFieldView {
  label: string;
  value: string;
}

/**
 * One change an option would make, with its exact payload.
 *
 * The fingerprint is the authority gate's, computed from the payload the
 * engine will execute. It is sent back when the person approves, and the
 * engine refuses the confirmation if the change it would now execute has a
 * different one.
 */
export interface ChangeView {
  /** Stable per option and position, for keys and form state. */
  key: string;
  /** What changes, in plain language. */
  label: string;
  /** The register written, for example "Control register". */
  register: string;
  /** The record the change targets. */
  targetId: string;
  /** Where the register lives. Every change here is a local record. */
  system: string;
  fields: ChangeFieldView[];
  fingerprint: string | null;
  /** A short form of the fingerprint, readable in a line. */
  reference: string;
  /** True when the gate requires a named person's approval for this change. */
  requiresApproval: boolean;
  /** The gate's refusal, when this change would not be allowed. */
  refusal: string | null;
}

/** 4. Options: one option, what it implies, what it changes and what approval it needs. */
export interface DecisionOptionCard {
  id: string;
  label: string;
  /** What this option means for the risk position. */
  implication: string;
  description: string;
  isRecommended: boolean;
  recommendationBasis: string;
  requiresApproval: boolean;
  changes: ChangeView[];
  /** The distinct registers this option writes. */
  systems: string[];
  /** How many changes need a named person's approval. */
  approvalsNeeded: number;
  /** One line on the approval this option needs. */
  approvalSummary: string;
  /** True when the gate would refuse at least one change, so the option cannot be confirmed. */
  refused: boolean;
}

/**
 * The authority position on one decision.
 *
 * Every field comes from something that already existed: the class names are
 * `AUTHORITY_CLASSES`, `reachable` and `gateNote` are the verdict of
 * `toolsAvailableAt`, and the approver is the person the roles table names as
 * holding the decision's role, which is also who the engine grants the
 * approvals in the name of.
 */
export interface DecisionAuthorityView {
  authorityClass: AuthorityClass;
  authorityLabel: string;
  /** True when a named person must approve before anything executes. */
  requiresApproval: boolean;
  reachable: boolean;
  gateNote: string;
  approverName: string;
  approverTitle: string;
  autonomyLabel: string;
}

/**
 * Everything the five parts need for one open decision.
 *
 * Shipped for every open decision in the queue, so selecting another row is a
 * local state change rather than a round trip.
 */
export interface ActiveDecisionView {
  decisionId: string;
  reference: string;
  headline: string;
  /** 1. The professional question, as a practitioner would ask it. */
  question: string;
  judgmentLabel: string;
  /** What the AI prepared, what the person decides, what changes, what approval: plan 9.5. */
  authoritySummary: { prepared: string; decides: string; changes: string; approval: string };
  context: DecisionContextView;
  evidence: DecisionEvidenceView;
  options: DecisionOptionCard[];
  authority: DecisionAuthorityView;
  status: "open";
  /** True when seeded decision prose has no German form and is shown in English. */
  proseIsEnglish: boolean;
}

/* ==========================================================================
   A recorded decision and its receipt
   ========================================================================== */

/**
 * One change that executed, with the real receipt lines it wrote.
 *
 * Read from `execution_receipt_lines`. A change appears here only when at
 * least one line backs it, so the count of executed changes is a count of
 * rows in that table and never includes a line about the decision itself
 * (J21).
 */
export interface ReceiptLineView {
  /** The first receipt line's identifier. */
  id: string;
  label: string;
  statements: string[];
  register: string;
  targetId: string;
  executedAtMoment: string;
  /** The audit event behind the first line. Every real line has one. */
  auditEventId: string | null;
}

/** One change that did not execute, read from the outcome record. */
export interface FailedChangeView {
  key: string;
  label: string;
  register: string;
  targetId: string;
  reason: string;
  /** "Refused by the authority gate", "Failed while executing" or "Not attempted". */
  outcomeLabel: string;
}

/**
 * A decision on the record, with its receipt.
 *
 * Built from persisted rows only, so it is the same after a refresh as it was
 * the moment the person confirmed. Executed and not executed are two lists,
 * never one count.
 */
export interface RecordedDecisionView {
  decisionId: string;
  reference: string;
  headline: string;
  question: string;
  chosenOptionLabel: string | null;
  rationale: string;
  decidedByName: string;
  decidedByTitle: string;
  decidedAtMoment: string | null;
  approvalCount: number;
  approverName: string;
  executed: ReceiptLineView[];
  failed: FailedChangeView[];
  /** "complete", "partial", "none-executed" or "no-changes". */
  outcome: "complete" | "partial" | "none-executed" | "no-changes";
  /** One line stating the outcome, with both counts. */
  outcomeLine: string;
  process: LinkView | null;
  meeting: LinkView | null;
}

/** A judgment a process stage is waiting on, recorded in the stage rather than here. */
export interface StageDecisionRow {
  key: string;
  label: string;
  question: string;
  /** Process and stage, for example "Third-Party Onboarding, Stage 4: Evidence Review". */
  where: string;
  options: string[];
  href: string | null;
  /** True when the stage can take the decision now. */
  ready: boolean;
  readyNote: string;
}

/* ==========================================================================
   The whole view
   ========================================================================== */

export interface DecisionQueueViewModel {
  roleId: string;
  language: "en" | "de";
  currentMoment: string;
  /** Two parts at most, matching the V3.3 location line. */
  locationParts: string[];
  pageTitle: string;
  /** One sentence of counted fact. Never a paragraph. */
  contextLine: string;
  /** The open queue, in priority order. */
  rows: DecisionQueueRow[];
  /** Recorded today, collapsed by default. */
  recorded: DecisionQueueRow[];
  /** The decision that is expanded on arrival, or null when the queue is empty. */
  initialActiveId: string | null;
  /** The five parts for each open decision, found by identifier. */
  details: ActiveDecisionView[];
  /** The receipt for each recorded decision, found by identifier. */
  recordedDetails: RecordedDecisionView[];
  /** Judgments open in a process stage, listed so the queue is complete. */
  stageRows: StageDecisionRow[];
  /** Set when the process stages could not be read, so the gap is stated. */
  stageRowsUnavailable: boolean;
}

/** The detail for one open decision, or null. Kept here so callers do not index. */
export function findDetail(
  model: Pick<DecisionQueueViewModel, "details">,
  decisionId: string | null,
): ActiveDecisionView | null {
  if (decisionId === null) return null;
  return model.details.find((detail) => detail.decisionId === decisionId) ?? null;
}

/** The receipt for one recorded decision, or null. */
export function findRecorded(
  model: Pick<DecisionQueueViewModel, "recordedDetails">,
  decisionId: string | null,
): RecordedDecisionView | null {
  if (decisionId === null) return null;
  return model.recordedDetails.find((detail) => detail.decisionId === decisionId) ?? null;
}

/**
 * The decision a deep link names, if the queue holds it.
 *
 * Accepts the fragment with or without its `#`. Used on arrival and on every
 * hash change, so `/decisions#DEC-...` from Home, a process stage or the AI
 * Partner selects the decision it names rather than only scrolling to it
 * (J23).
 */
export function decisionFromHash(
  model: Pick<DecisionQueueViewModel, "details" | "recordedDetails">,
  hash: string,
): string | null {
  const id = decodeURIComponent(hash.replace(/^#/, "")).trim();
  if (id.length === 0) return null;
  if (findDetail(model, id)) return id;
  if (findRecorded(model, id)) return id;
  return null;
}

/**
 * Whether the reader may move forward from a stage.
 *
 * Only the Options part has a precondition: the Confirm part asks for the
 * reasoning behind a choice, so it needs a choice. The first three parts are
 * reading, and a reader is free to read on.
 */
export function canAdvance(
  stage: DecisionStage,
  state: { selectedOptionId: string | null },
): boolean {
  switch (stage) {
    case "question":
    case "context":
    case "evidence":
      return true;
    case "options":
      return state.selectedOptionId !== null;
    case "confirm":
      return false;
  }
}

/** The fingerprints a reader has to approve for an option, in execution order. */
export function requiredApprovals(option: Pick<DecisionOptionCard, "changes"> | null): string[] {
  if (!option) return [];
  return option.changes
    .filter((change) => change.requiresApproval && change.fingerprint !== null)
    .map((change) => change.fingerprint ?? "");
}

/**
 * Whether every change that needs an approval has been approved, change by
 * change. One tick does not approve every payload (J22).
 */
export function allChangesApproved(
  option: Pick<DecisionOptionCard, "changes"> | null,
  approved: ReadonlySet<string>,
): boolean {
  return requiredApprovals(option).every((fingerprint) => approved.has(fingerprint));
}

/**
 * Whether the confirm action may run.
 *
 * Six independent conditions. The authority ones are not cosmetic: a decision
 * whose class the gate cannot reach, or an option the gate would refuse, is
 * not confirmable, which is the difference between this screen and one that
 * offers a button the server will refuse.
 */
export function canConfirm(state: {
  selectedOptionId: string | null;
  option: Pick<DecisionOptionCard, "changes" | "refused"> | null;
  rationale: string;
  rationaleConfirmed: boolean;
  approved: ReadonlySet<string>;
  authority: Pick<DecisionAuthorityView, "reachable">;
  pending: boolean;
}): boolean {
  if (state.pending) return false;
  if (state.selectedOptionId === null || state.option === null) return false;
  if (state.option.refused) return false;
  if (state.rationale.trim().length < MINIMUM_RATIONALE_LENGTH) return false;
  if (!state.rationaleConfirmed) return false;
  if (!allChangesApproved(state.option, state.approved)) return false;
  return state.authority.reachable;
}
