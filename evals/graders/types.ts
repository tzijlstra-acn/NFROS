/**
 * Shared types for the evaluation graders.
 *
 * EvalCase mirrors the JSON structure in evals/cases/.
 * AssistantResponseEnvelope represents a parsed chat turn response,
 * matching the part schema from src/agents/chat/parts.ts.
 *
 * Synthetic institution and data. Illustrative regulatory context, not legal advice.
 */

/* ==========================================================================
   Eval case types
   ========================================================================== */

export interface EvalCaseContext {
  subjectId: string;
  scenarioMoment: string;
  language?: string;
}

export interface EvalCaseExpectedStructure {
  mustHaveParts: string[];
  mustNotHaveParts: string[];
}

export interface EvalCaseExpectedCitations {
  minimumSourcesReferenced: number;
}

export interface EvalCaseExpectedAuthorityBehavior {
  mustNotPropose: string[];
  mustPropose: string[];
  mustReturnBlockedPart?: boolean;
  prohibitedActionTriggered?: string;
}

export interface EvalCaseAllowedOutcomeRange {
  isLimitedAllowed: boolean;
  recommendationRequiresAllSources: boolean;
}

export interface EvalCaseJurisdictionConstraints {
  doraAppliesTo: string[];
  doraDoesNotApplyTo: string[];
  finmaAppliesTo: string[];
}

export interface EvalCaseLanguageBehavior {
  outputLanguage: string;
  mustUseTerms: string[];
  mustNotMixLanguages: boolean;
}

export interface EvalCase {
  id: string;
  role: string;
  task: string;
  stage: string;
  context: EvalCaseContext;
  input: string;
  requiredSources?: string[];
  prohibitedAssumptions?: string[];
  expectedStructure?: EvalCaseExpectedStructure;
  expectedCitations?: EvalCaseExpectedCitations;
  expectedAuthorityBehavior?: EvalCaseExpectedAuthorityBehavior;
  allowedOutcomeRange?: EvalCaseAllowedOutcomeRange;
  jurisdictionConstraints?: EvalCaseJurisdictionConstraints;
  expectedLanguageBehavior?: EvalCaseLanguageBehavior;
  expectedConflictBehavior?: {
    mustSurfaceConflict: boolean;
    mustNotSilentlyResolve: boolean;
    conflictKind: string;
  };
  expectedRatingBehavior?: {
    mayProposeRating: boolean;
    mustRequireHumanDecision: boolean;
    mustNotFinaliseAutonomously: boolean;
  };
  expectedChallengeBehavior?: {
    mustPrepareQuestions: boolean;
    mustNotMakeJudgment: boolean;
    questionsMustCiteEvidence: boolean;
  };
  expectedMeetingBehavior?: {
    factsSeparatedFromDecisions: boolean;
    actionsHaveOwnersAndDueDates: boolean;
    unresolvedItemsLabelled: boolean;
  };
  expectedTriageBehavior?: {
    classificationMustBeOneOf: string[];
    rationaleRequired: boolean;
  };
  expectedActionBehavior?: {
    mustFlagVagueWording: boolean;
    mustRequireMeasurableCompletion: boolean;
    mustNotApproveWithoutCriterion: boolean;
  };
}

/* ==========================================================================
   Response envelope types
   ========================================================================== */

/**
 * One part of a chat turn response.
 * Mirrors src/agents/chat/parts.ts ChatTurnPart.
 */
export interface ResponsePart {
  kind: string;
  text: string;
  refs?: string[];
  meta?: Record<string, unknown>;
}

/**
 * The full response from the assistant for one turn.
 * In offline mode, this is constructed from seeded data.
 * In live mode, this is the parsed output of runManagerTurn.
 */
export interface AssistantResponseEnvelope {
  parts: ResponsePart[];
  lang?: string;
  /** True when this envelope was constructed from offline seeded data. */
  isOffline?: boolean;
  /** The source of this envelope in offline mode. */
  offlineSource?: string;
}

/* ==========================================================================
   Grader result type
   ========================================================================== */

export interface GraderResult {
  grader: string;
  caseId: string;
  passed: boolean;
  /** 0.0 = complete failure, 1.0 = full pass. */
  score: number;
  details: string;
}
