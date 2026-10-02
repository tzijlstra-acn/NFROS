/**
 * The decision queue model, V3.1.
 *
 * Types and pure functions only. No database access, no React, no server
 * imports, for the same reason `src/workday/contracts.ts` holds that line: the
 * stage machine has to be importable from the client component that drives it,
 * from the server component that builds the view, and from a test, without
 * dragging a SQLite handle along behind it.
 *
 * The shape of this module is the shape of the brief. One queue, exactly one
 * active decision, and that decision moves through four ordered stages with
 * only one of them visible. Making the stage order a frozen tuple rather than
 * four booleans means the interface cannot show two stages at once and cannot
 * skip one, because there is nothing to set to make that happen.
 */

import type { AuthorityClass } from "@/db/schema/decisions";

/* ==========================================================================
   The four stages
   ========================================================================== */

/**
 * The stages, in order.
 *
 * Understand, Compare, Explain, Confirm. The order is the argument: a reader
 * who has not understood what happened cannot weigh the options, and a reader
 * who has not weighed the options has nothing to explain. Confirm is last
 * because it is the only stage that writes anything.
 */
export const DECISION_STAGES = ["understand", "compare", "explain", "confirm"] as const;

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
 * not be returned to Understand with their selection intact and their stage
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
 * The shortest rationale the engine will accept as reasoning.
 *
 * Kept here so the forward control and the confirm control agree. The engine
 * itself refuses an empty rationale and the authority gate refuses an
 * unconfirmed one; this is the interface declining to let a reader reach
 * Confirm with three characters and then be refused there.
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
 * The defect this replaces rendered four rows headed "Record the decision",
 * which is what happens when the lead line is the shared verb: four different
 * judgments looked like one thing repeated.
 *
 * Everything on the row is a single line by construction. `summary` is one
 * clause, not a sentence, and the builder clamps it.
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
  /** Receipt lines already written. Only meaningful once recorded. */
  receiptCount: number;
  /** The option the reader chose, once there is one. */
  chosenOptionLabel: string | null;
}

/* ==========================================================================
   The active decision
   ========================================================================== */

/** One option, with what choosing it implies. */
export interface DecisionOptionCard {
  id: string;
  label: string;
  /** What this option means for the risk position. */
  implication: string;
  description: string;
  isRecommended: boolean;
  recommendationBasis: string;
  requiresApproval: boolean;
  /** What would change, one plain line per declared consequence. */
  consequenceLabels: string[];
}

/**
 * The authority position on one decision.
 *
 * Every field here comes from something that already existed. The class names
 * are `AUTHORITY_CLASSES` from the decision schema, `reachable` and `gateNote`
 * are the verdict of `toolsAvailableAt` in the authority gate, and the
 * approver is the person the roles table names as holding the role. Nothing
 * about authority is decided in this feature.
 */
export interface DecisionAuthorityView {
  authorityClass: AuthorityClass;
  authorityLabel: string;
  /** True when a named person must approve before anything executes. */
  requiresApproval: boolean;
  /**
   * Whether the gate can reach this class at the current autonomy level for
   * this role. False disables confirm, and `gateNote` says why in the gate's
   * own words rather than this feature's.
   */
  reachable: boolean;
  gateNote: string;
  /** The person recorded as accountable, from the roles and users tables. */
  approverName: string;
  approverTitle: string;
  autonomyLabel: string;
}

/**
 * Everything the four stages need for one decision.
 *
 * Shipped for every open decision in the queue, so selecting another row is a
 * local state change rather than a round trip. Four decisions of this size is
 * a few kilobytes, and a fetch per selection would put a spinner between the
 * reader and the thing they are comparing.
 */
export interface ActiveDecisionView {
  decisionId: string;
  reference: string;
  headline: string;
  /** The professional question, as a practitioner would ask it. */
  question: string;
  /** Understand: one short paragraph on what happened and why it needs a person. */
  understandParagraph: string;
  evidenceCount: number;
  /** Explain: what the AI prepared. Attributed, never merged with the reader's words. */
  preparedPosition: string;
  /** Explain: the uncertainty the preparation states about itself. */
  uncertaintyNote: string;
  options: DecisionOptionCard[];
  authority: DecisionAuthorityView;
  status: "open" | "recorded";
  /** Set once recorded. The reader's own words, read back to them. */
  recordedRationale: string;
  chosenOptionId: string | null;
  /** Lines of the existing execution receipt. Never re-derived from options. */
  receiptStatements: string[];
}

/* ==========================================================================
   The whole view
   ========================================================================== */

export interface DecisionQueueViewModel {
  roleId: string;
  language: "en" | "de";
  currentMoment: string;
  /** Two parts at most, matching the V3.1 location line. */
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
  /** Stage content for each open decision, found by identifier. */
  details: ActiveDecisionView[];
}

/** The detail for one decision, or null. Kept here so callers do not index. */
export function findDetail(
  model: Pick<DecisionQueueViewModel, "details">,
  decisionId: string | null,
): ActiveDecisionView | null {
  if (decisionId === null) return null;
  return model.details.find((detail) => detail.decisionId === decisionId) ?? null;
}

/**
 * Whether the reader may move forward from a stage.
 *
 * The preconditions are the engine's, stated one stage earlier so the reader
 * meets them where the work is rather than being refused at Confirm. Compare
 * needs a chosen option because Explain asks for the reasoning behind a
 * choice, and Explain needs a rationale because Confirm records it.
 */
export function canAdvance(
  stage: DecisionStage,
  state: { selectedOptionId: string | null; rationale: string },
): boolean {
  switch (stage) {
    case "understand":
      return true;
    case "compare":
      return state.selectedOptionId !== null;
    case "explain":
      return state.rationale.trim().length >= MINIMUM_RATIONALE_LENGTH;
    case "confirm":
      return false;
  }
}

/**
 * Whether the confirm action may run.
 *
 * Four independent conditions, and the authority one is not cosmetic: a
 * decision whose class requires approval is not confirmable when the gate
 * cannot reach that class, which is the difference between this screen and one
 * that offers a button the server will refuse.
 */
export function canConfirm(state: {
  selectedOptionId: string | null;
  rationale: string;
  rationaleConfirmed: boolean;
  authority: Pick<DecisionAuthorityView, "reachable">;
  pending: boolean;
}): boolean {
  if (state.pending) return false;
  if (state.selectedOptionId === null) return false;
  if (state.rationale.trim().length < MINIMUM_RATIONALE_LENGTH) return false;
  if (!state.rationaleConfirmed) return false;
  return state.authority.reachable;
}
