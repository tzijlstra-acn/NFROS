/**
 * Presentation story: sixteen scenes, five chapters, thirty minutes.
 *
 * This module owns the contract between the narrative and the presentation
 * component. The component does not exist yet, so the types are defined here
 * and exported from here. A component renders a scene by switching on
 * `visualKind`, which narrows `content` to the payload that kind consumes.
 *
 * Authoritative content sources, in precedence order:
 *   1. docs/SCENARIO_BIBLE.md           the institution, people, objects, event
 *   2. docs/NFR_ROLE_AND_WORK_ATLAS.md  the six roles and the five work lanes
 *   3. docs/EXPERIENCE_MAP.md           today versus future state per moment
 *
 * Where this module and the bible disagree, the bible wins and this module is
 * corrected.
 *
 * Copy discipline, carried from docs/handoffs/source-visual-findings.md:
 *   - titles at most 10 words, subtitles at most 22 words
 *   - no absolute language, per the list in STORY_COPY_RULES.bannedAbsolutes
 *   - every quantity carries a basis: measured in this simulation,
 *     illustrative, or client input required
 *   - the em dash character does not appear in any string
 *
 * One documented exception. Scene 4 carries the fixed title "Not every part of
 * NFR work changes in the same way.", which is eleven words against a ten word
 * limit. The sixteen titles are fixed by the story brief, so the fixed title
 * stands and the overflow is recorded here rather than silently edited. See
 * STORY_COPY_RULES.knownExceptions.
 *
 * Synthetic institution and data. Illustrative regulatory context, not legal
 * advice.
 */

/* ==========================================================================
   Mandatory labels
   ========================================================================== */

/** Applied to every surface that displays Arcadia content, without exception. */
export const SYNTHETIC_DATA_LABEL = "Synthetic institution and data." as const;

/**
 * Applied at the point of display to every regulatory reference, not in a page
 * footer. The string is exact and is not paraphrased anywhere downstream.
 */
export const REGULATORY_LABEL =
  "Illustrative regulatory context, not legal advice." as const;

/* ==========================================================================
   Copy rules, so a build gate can read them rather than infer them
   ========================================================================== */

export const STORY_COPY_RULES = {
  maxTitleWords: 10,
  maxSubtitleWords: 22,
  /*
   * The banned list itself, which is the one place these words are permitted
   * to appear. A copy linter skips any line carrying the escape marker below.
   */
  bannedAbsolutes: [
    "always", // lint-ok: banned list entry
    "never", // lint-ok: banned list entry
    "guarantees", // lint-ok: banned list entry
    "eliminates", // lint-ok: banned list entry
    "fully automated", // lint-ok: banned list entry
    "zero risk", // lint-ok: banned list entry
  ],
  knownExceptions: [
    {
      sceneNumber: 4,
      rule: "maxTitleWords",
      reason:
        "Title is fixed by the story brief at eleven words. Recorded rather than edited.",
    },
  ],
} as const;

/* ==========================================================================
   Numbers and their basis
   ========================================================================== */

/**
 * Every quantity shown to an audience declares where it came from.
 *
 *  - `measured-in-simulation`: computed from the seeded synthetic dataset for
 *    06.10.2026. Reproducible, and a scenario figure rather than a benchmark.
 *  - `illustrative`: a design target or shaping estimate, not a measurement.
 *  - `client-input-required`: a figure only the client's own data can supply.
 */
export type NumberBasis =
  | "measured-in-simulation"
  | "illustrative"
  | "client-input-required";

export const NUMBER_BASIS_LABELS: Record<NumberBasis, string> = {
  "measured-in-simulation": "Measured in this simulation",
  illustrative: "Illustrative",
  "client-input-required": "Client input required",
};

export interface StoryMetric {
  /** Rendered exactly as written. Formatting decisions live here. */
  value: string;
  /** What the number counts, short enough to sit under the value. */
  label: string;
  basis: NumberBasis;
  /** Optional one line qualification, shown beside the basis label. */
  note?: string;
}

/* ==========================================================================
   Evidence classification, carried from the scenario
   ========================================================================== */

/**
 * `VF` verified fact, `SS` stakeholder statement, `TI` telemetry inference.
 * A classification is displayed, not implied, and is not silently promoted.
 */
export type FactClass = "VF" | "SS" | "TI";

export const FACT_CLASS_LABELS: Record<FactClass, string> = {
  VF: "Verified fact",
  SS: "Stakeholder statement",
  TI: "Telemetry inference",
};

/* ==========================================================================
   Chapters
   ========================================================================== */

export type ChapterId =
  | "two-mornings"
  | "work-lane-by-lane"
  | "one-professional-day"
  | "one-event-six-questions"
  | "authority-and-adoption";

export interface StoryChapter {
  id: ChapterId;
  /** Position marker for the chapter rail. */
  ordinal: string;
  name: string;
  /** What this chapter achieves before the next one can work. */
  intent: string;
  sceneNumbers: readonly number[];
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  {
    id: "two-mornings",
    ordinal: "I",
    name: "Two mornings",
    intent:
      "Put the audience inside a real working morning before any technology is named. Recognition first, then relief.",
    sceneNumbers: [1, 2, 3],
  },
  {
    id: "work-lane-by-lane",
    ordinal: "II",
    name: "Work, lane by lane",
    intent:
      "Replace the impression that everything changes with a precise account of which work changes and which stays human.",
    sceneNumbers: [4, 5],
  },
  {
    id: "one-professional-day",
    ordinal: "III",
    name: "One professional day",
    intent:
      "Live the day in two roles through to a rating a person owns. This is the chapter the audience should want.",
    sceneNumbers: [6, 7, 8, 9, 10, 11],
  },
  {
    id: "one-event-six-questions",
    ordinal: "IV",
    name: "One event, six questions",
    intent:
      "Show one 14:05 event reaching six functions, and one leadership thread in place of six reports.",
    sceneNumbers: [12, 13, 14],
  },
  {
    id: "authority-and-adoption",
    ordinal: "V",
    name: "Authority and adoption",
    intent:
      "Answer the two questions the day provokes: what is this permitted to do, and how would we start.",
    sceneNumbers: [15, 16],
  },
];

/* ==========================================================================
   Scene frame
   ========================================================================== */

/** The visual treatment the presentation component renders for a scene. */
export type VisualKind =
  | "convergence-hero"
  | "signal-clutter-board"
  | "decision-card-collapse"
  | "work-lane-ladder"
  | "lens-switcher"
  | "decision-queue"
  | "supplier-exposure-graph"
  | "role-morph-transition"
  | "change-since-last-cycle"
  | "workshop-table"
  | "dual-position-matrix"
  | "event-fan-out"
  | "six-lens-grid"
  | "portfolio-decision-thread"
  | "authority-ladder"
  | "phase-roadmap";

/** Role slugs, identical to the product's own role identifiers. */
export type StoryRoleSlug =
  | "tprm"
  | "rcsa"
  | "control-assurance"
  | "incident-resilience"
  | "regulatory-change"
  | "nfr-governance";

/** A question a scene provokes, with the honest answer the presenter gives. */
export interface AudienceQuestion {
  question: string;
  answer: string;
}

/**
 * The reveal behind a working scene. Counts are `COUNT` queries over the
 * seeded action ledger, not decorative figures, and the awaiting-release
 * number renders beside the completed number rather than after it.
 */
export interface BackgroundReveal {
  organise: number;
  understand: number;
  execute: number;
  /** Lane 4 is zero by design and is not rendered as a column. */
  judgment: 0;
  total: StoryMetric;
  artefactsTouched: number;
  artefactsExternal: number;
  awaitingRelease: number;
  draftsPrepared: number;
  drillDownNote: string;
}

interface StorySceneBase {
  /** Stable identifier, safe in URLs, analytics and presenter links. */
  id: string;
  sceneNumber: number;
  chapter: ChapterId;
  title: string;
  subtitle: string;
  keyMessage: string;
  /** Speaking points for presenter view. Not the full script. */
  presenterNotes: readonly string[];
  durationSeconds: number;
  /** One line telling the component author what occupies the stage. */
  stageNote: string;
  /** How this scene hands over to the next one. */
  transitionOut: string;
  audienceQuestions: readonly AudienceQuestion[];
  /** Scenario clock, where the scene sits at a point in the day. */
  scenarioClock?: string;
  /** Shared timeline moment, `M01` to `M10`. */
  momentId?: string;
  /** Whose lens the scene is seen through, where it has one. */
  roleFocus?: StoryRoleSlug;
  /** True when the scene displays Arcadia content. Renders the label. */
  showsSyntheticDataLabel: boolean;
  /**
   * Set when the scene carries a regulatory reference. The value is the exact
   * mandatory label, so a component cannot render the reference without it.
   */
  regulatoryNote?: typeof REGULATORY_LABEL;
  /**
   * Which entities the scene's regulatory references apply to. The EU lane and
   * the Swiss lane are shown separately and no flow crosses between them.
   */
  regulatoryScope?: "eu-entities" | "swiss-entity" | "both-lanes-separately";
}

/** A scene, bound to one visual kind and the content that kind consumes. */
type Scene<K extends VisualKind, C> = StorySceneBase & {
  visualKind: K;
  content: C;
};

/* ==========================================================================
   Scene 1 content: convergence hero
   ========================================================================== */

export interface CoverFragment {
  /** What the fragment says on the surface it came from. */
  label: string;
  /** The system, document or person it arrived from. */
  source: string;
  /** Where it ends up in the converged object. */
  landsAs: string;
}

export interface CoverContent {
  eyebrow: string;
  fragments: readonly CoverFragment[];
  converged: {
    objectLabel: string;
    decisionQuestion: string;
    owner: string;
    authorityBasis: string;
    /** What the object states it does not know. */
    statedUnknown: string;
  };
  dateLine: string;
  closingLine: string;
}

/* ==========================================================================
   Scene 2 content: signal clutter board
   ========================================================================== */

export interface ClutterSignal {
  id: string;
  /** The category the audience recognises. */
  kind:
    | "unread-mail"
    | "calendar-conflict"
    | "overdue-grc-work"
    | "duplicate-evidence-request"
    | "disconnected-dashboard"
    | "status-request"
    | "upcoming-workshop"
    | "overnight-signal";
  label: string;
  source: string;
  detail: string;
  metric?: StoryMetric;
  /** The person carrying it this morning. */
  carriedBy: string;
  /** Why it costs time without producing professional output. */
  costOfHandling: string;
}

export interface SignalClutterContent {
  clockLabel: string;
  placeLabel: string;
  signals: readonly ClutterSignal[];
  systemsOpened: readonly string[];
  elapsedBeforeAnythingIsKnown: StoryMetric;
  /** The connection none of these surfaces makes. */
  hiddenConnection: string;
}

/* ==========================================================================
   Scene 3 content: decision card collapse
   ========================================================================== */

export interface DecisionCard {
  id: string;
  question: string;
  whatIsKnown: readonly string[];
  whatIsNotKnown: readonly string[];
  owner: string;
  authorityBasis: string;
  reversible: boolean;
  /** Where the decision lands once taken, including its record identifier. */
  destination: string;
  evidenceRefs: readonly string[];
}

export interface DecisionCardCollapseContent {
  clockLabel: string;
  person: string;
  roleLabel: string;
  entityLabel: string;
  cards: readonly DecisionCard[];
  /** The morning brief writes nothing. This states that explicitly. */
  readOnlyStatement: string;
  /** What the brief withholds, and why withholding it is the design. */
  withheld: readonly string[];
  backgroundReveal: BackgroundReveal;
}

/* ==========================================================================
   Scene 4 content: work lane ladder
   ========================================================================== */

export interface WorkLane {
  laneNumber: 1 | 2 | 3 | 4 | 5;
  /** Simple label used throughout the product. */
  label: "Organise" | "Understand" | "Assess" | "Decide" | "Execute";
  fullName: string;
  definition: string;
  /** What this lane costs a practitioner today, in the scenario. */
  todayCost: string;
  whatChanges: string;
  whatStaysHuman: string;
  ownership:
    | "shared-infrastructure"
    | "shared-engine-role-corpora"
    | "function-specific"
    | "function-specific-unautomated"
    | "shared-engine-role-routes";
  commonShare: StoryMetric;
  /** One worked example from 06.10.2026, so the lane is not an abstraction. */
  scenarioExample: string;
}

export interface WorkLaneLadderContent {
  lanes: readonly WorkLane[];
  /** The claim the lane model makes, stated so it can be argued with. */
  organisingClaim: string;
  /** The lane that produces no automated action, stated as a hard property. */
  judgmentRule: string;
  buildRatioNote: string;
}

/* ==========================================================================
   Scene 5 content: lens switcher
   ========================================================================== */

export interface RoleLens {
  roleSlug: StoryRoleSlug;
  roleLabel: string;
  roleLabelDe: string;
  person: string;
  entityLabel: string;
  unitOfAnalysis: string;
  primaryObject: string;
  heroVisual: string;
  /** The question this role asks that the other five do not. */
  differentQuestion: string;
  hardestJudgment: string;
}

export interface LensSwitcherContent {
  sharedAcrossLenses: readonly string[];
  changesWithTheLens: readonly string[];
  lenses: readonly RoleLens[];
  /** Why one environment rather than six products. */
  economicNote: string;
}

/* ==========================================================================
   Scene 6 content: decision queue
   ========================================================================== */

export interface QueuedDecision {
  id: string;
  headline: string;
  /** The prepared position, with its limitation attached. */
  preparedPosition: string;
  limitation: string;
  deadline: string;
  blockedBy?: string;
  blocking?: string;
  evidenceRefs: readonly string[];
}

export interface DecisionQueueContent {
  clockLabel: string;
  person: string;
  roleLabel: string;
  decisions: readonly QueuedDecision[];
  /** The systems this replaces the opening of, named individually. */
  systemsNotOpened: readonly string[];
  todayComparison: string;
  backgroundReveal: BackgroundReveal;
}

/* ==========================================================================
   Scene 7 content: supplier exposure graph
   ========================================================================== */

export interface ChainNode {
  id: string;
  name: string;
  jurisdiction: string;
  /** What it does for the supplier, and therefore for Arcadia. */
  roleInChain: string;
  ring: 1 | 2 | 3;
  inBindingAppendix: boolean;
  inSupplierRegister: boolean;
  /** The divergence, stated precisely, where one exists. */
  divergence?: string;
  holdsPaymentData: boolean;
}

export interface AssertionDelta {
  subject: string;
  asserted: string;
  observed: string;
  source: string;
  /** Why the delta is a finding rather than a complaint. */
  significance: string;
}

export interface ChallengeQuestion {
  order: number;
  question: string;
  /** What the professional is asking for, with a date. */
  ask: string;
  /** Why it sits in this position in the sequence. */
  sequencingReason: string;
}

export interface SupplierExposureGraphContent {
  supplierName: string;
  supplierId: string;
  criticality: string;
  annualSpend: StoryMetric;
  concentrationStatement: string;
  nodes: readonly ChainNode[];
  assertionDeltas: readonly AssertionDelta[];
  challengeSequence: readonly ChallengeQuestion[];
  humanChoice: string;
  uncertaintyDisclosed: readonly string[];
  meetingLabel: string;
}

/* ==========================================================================
   Scene 8 content: role morph transition
   ========================================================================== */

export interface RoleMorphTransitionContent {
  fromRole: { slug: StoryRoleSlug; person: string; visual: string };
  toRole: { slug: StoryRoleSlug; person: string; visual: string };
  /** What stays put across the switch. The point of the scene. */
  retained: readonly string[];
  /** What the switch changes. */
  changed: readonly string[];
  /** The object both roles are looking at, from two directions. */
  sharedObject: string;
  auditNote: string;
}

/* ==========================================================================
   Scene 9 content: change since last cycle
   ========================================================================== */

export interface CycleChange {
  id: string;
  subject: string;
  previousState: string;
  currentState: string;
  driver: string;
  evidenceRef: string;
  factClass: FactClass;
  /** Where an inference could be wrong, stated for `TI` items. */
  inferenceLimit?: string;
}

export interface ChangeSinceLastCycleContent {
  assessmentId: string;
  assessmentLabel: string;
  cycleLabel: string;
  facilitator: string;
  assessmentOwner: string;
  changes: readonly CycleChange[];
  unchangedCount: StoryMetric;
  /** The residual cell the system leaves empty. */
  blankCellStatement: string;
  todayComparison: string;
}

/* ==========================================================================
   Scene 10 content: workshop table
   ========================================================================== */

export interface EstablishedFact {
  statement: string;
  evidenceRef: string;
  factClass: FactClass;
}

export interface RoomPosition {
  holder: string;
  line: "1LoD" | "2LoD";
  position: string;
  reasoning: readonly string[];
}

export interface WorkshopTableContent {
  meetingLabel: string;
  timeLabel: string;
  attendees: readonly string[];
  establishedFacts: readonly EstablishedFact[];
  contestedQuestion: string;
  positions: readonly RoomPosition[];
  /** What the system states it cannot resolve, and why. */
  systemCannotResolve: string;
  todayComparison: string;
  minutesNote: string;
}

/* ==========================================================================
   Scene 11 content: dual position matrix
   ========================================================================== */

export interface MatrixPosition {
  label: string;
  holder: string;
  impact: number;
  likelihood: number;
  score: number;
  band: string;
  appetitePosition: "within-appetite" | "outside-appetite";
  consequence: string;
}

export interface DualPositionMatrixContent {
  riskId: string;
  riskLabel: string;
  riskLabelDe: string;
  inherent: { impact: number; likelihood: number; score: number; band: string };
  positions: readonly MatrixPosition[];
  appetiteBoundary: {
    threshold: number;
    policySentence: string;
    entityAuthority: string;
  };
  /** What the system did, itemised, so the boundary is legible. */
  systemPrepared: readonly string[];
  /** What the system declined to do, itemised. */
  systemDeclined: readonly string[];
  outcome: {
    decisionId: string;
    timeLabel: string;
    statement: string;
    signedBy: readonly string[];
    supersedes?: string;
  };
  recordedAttributes: readonly string[];
}

/* ==========================================================================
   Scene 12 content: event fan out
   ========================================================================== */

export interface EventArrival {
  id: string;
  timeLabel: string;
  factClass: FactClass;
  source: string;
  content: string;
  /** For `TI` arrivals, the specific reason the inference could be wrong. */
  inferenceLimit?: string;
  /** Set when a later arrival changes this one's classification. */
  reclassifiedTo?: { factClass: FactClass; timeLabel: string; byArrival: string };
  objectsTouched: readonly string[];
}

export interface EntityLane {
  entityLabel: string;
  entityCode: string;
  toleranceId: string;
  toleranceStatement: string;
  disruptionStart: string;
  toleranceLimit: string;
  cutOff?: string;
  runway?: string;
  fallbackOption: string;
  fallbackLeadTime: string;
  frameworkContext: string;
}

export interface EventFanOutContent {
  incidentId: string;
  incidentTitle: string;
  technicalStart: string;
  supplierNotifiedAt: string;
  arcadiaDetectedAt: string;
  detectionGap: StoryMetric;
  severityPath: readonly string[];
  firstNotification: { quote: string; missingFields: string; evidenceRef: string };
  arrivals: readonly EventArrival[];
  entityLanes: readonly EntityLane[];
  /** The rule at the centre of the event, in one sentence. */
  ruleStatement: string;
  repeatStatement: string;
}

/* ==========================================================================
   Scene 13 content: six lens grid
   ========================================================================== */

export interface LensOnEvent {
  roleSlug: StoryRoleSlug;
  person: string;
  /** The arrival this role reads first. */
  firstArrival: string;
  question: string;
  /** What this role concludes by 16:30, stated honestly. */
  output: string;
  /** The decision or action that carries the role's name. */
  ownedRecord: string;
  /** What this role gets wrong, or had missed. Included on purpose. */
  ownUncomfortableFinding: string;
}

export interface SixLensGridContent {
  sharedEvent: string;
  lenses: readonly LensOnEvent[];
  /** The conflicts that resolve, and the one that does not. */
  conflictsResolved: readonly string[];
  conflictUnresolved: {
    id: string;
    subject: string;
    owner: string;
    destination: string;
    whyItStaysOpen: string;
  };
}

/* ==========================================================================
   Scene 14 content: portfolio decision thread
   ========================================================================== */

export interface ThreadNode {
  order: number;
  label: string;
  objectRef: string;
  linkBasis: "evidenced" | "inferred";
  /** For inferred links, what would confirm them. */
  confirmationNeeded?: string;
}

export interface PortfolioDecisionThreadContent {
  person: string;
  roleLabel: string;
  clockLabel: string;
  thread: readonly ThreadNode[];
  evidencedLinks: StoryMetric;
  inferredLinks: StoryMetric;
  constraint: {
    papersClose: string;
    supplierReportDue: string;
    committeeDate: string;
    problem: string;
  };
  decision: {
    id: string;
    timeLabel: string;
    statement: string;
    committeeQuestion: string;
    whyItHolds: string;
  };
  frameworkDefectsOwnedHere: readonly string[];
  todayComparison: string;
}

/* ==========================================================================
   Scene 15 content: authority ladder
   ========================================================================== */

export interface AutonomyStep {
  id:
    | "assist"
    | "prepare"
    | "recommend"
    | "act-with-approval"
    | "act-within-policy"
    | "hand-back-to-human";
  order: number;
  label: string;
  labelDe: string;
  /** What the level permits, in one sentence. */
  permits: string;
  /** What the level withholds, in one sentence. */
  withholds: string;
  /** The authority classes the level can reach at all. */
  reachableClasses: readonly string[];
  /** A worked example from 06.10.2026. */
  scenarioExample: string;
}

export interface AuthorityLadderContent {
  steps: readonly AutonomyStep[];
  /** Conditions that hold at every level, including the most permissive. */
  invariants: readonly string[];
  /** Actions refused by design, so refusal is explicit and testable. */
  refusedByDesign: readonly string[];
  /** The five attributes every write carries, or the write is rejected. */
  mandatoryWriteAttributes: readonly string[];
  earnedNote: string;
}

/* ==========================================================================
   Scene 16 content: phase roadmap
   ========================================================================== */

export interface RoadmapPhase {
  phaseNumber: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  outcome: string;
  /** The thing that proves the phase worked. */
  proofPoint: string;
  /** What has to exist before the phase can start. */
  prerequisite: string;
  /** Which lanes the phase touches. */
  lanes: readonly ("Organise" | "Understand" | "Assess" | "Decide" | "Execute")[];
  /** Duration is a client planning input, not a claim. */
  indicativeDuration: StoryMetric;
  risk: string;
}

export interface PhaseRoadmapContent {
  phases: readonly RoadmapPhase[];
  /** The single ask that closes the presentation. */
  ask: string;
  /** What "prove one working day" means concretely. */
  proofDefinition: readonly string[];
  /** What the presenter declines to promise. */
  notClaimed: readonly string[];
}

/* ==========================================================================
   Chapter I: Two mornings
   ========================================================================== */

const scene01: Scene<"convergence-hero", CoverContent> = {
  id: "cover-live-the-nfr-day",
  sceneNumber: 1,
  visualKind: "convergence-hero",
  chapter: "two-mornings",
  title: "Live the NFR day.",
  subtitle:
    "What changes when AI operates the work around the risk professional.",
  keyMessage:
    "This is a working day you can step into, not a capability list you have to imagine.",
  presenterNotes: [
    "Open on the day, not on the product. Do not name a technology in the first two minutes.",
    "Arcadia Banking Group is synthetic. Say so once, here, plainly, and the audience stops wondering.",
    "The date is fixed: Tuesday 06.10.2026. One day, six professionals, one event at 14:05.",
    "The promise: by the end you have watched one day and you know exactly where a human decides.",
  ],
  durationSeconds: 45,
  stageNote:
    "Eight scattered signal fragments drift on a dark field, then converge into one calm decision object at centre.",
  transitionOut:
    "The converged object dissolves back into its fragments and the clock reads 07:42, which is where the morning actually starts.",
  audienceQuestions: [
    {
      question: "Is this a product you have built, or a concept?",
      answer:
        "It is a running prototype on a synthetic institution. Everything you see today is seeded data for one day, 06.10.2026, and it is reproducible. It is not a deployed system at a client.",
    },
    {
      question: "Why a synthetic bank rather than our own data?",
      answer:
        "Because a synthetic institution lets us build the uncomfortable facts in on purpose: an overdue action, a supplier notification that is wrong, a tolerance that cannot answer its own question. Your data would come later, in phase one.",
    },
  ],
  scenarioClock: "07:42 CET",
  showsSyntheticDataLabel: true,
  content: {
    eyebrow: "Arcadia Banking Group. Tuesday 06.10.2026.",
    fragments: [
      {
        label: "61 unread messages",
        source: "Mail client",
        landsAs: "Seven items linked to the supplier record, ranked by deadline",
      },
      {
        label: "Override rate 3.84 per 10,000",
        source: "KRI-PAY-007, published 05.10.2026 06:00",
        landsAs: "First node of a causal chain",
      },
      {
        label: "Four exceptions, two unable to conclude",
        source: "Control test TST-2026-0318",
        landsAs: "The control environment position under challenge",
      },
      {
        label: "67 days overdue",
        source: "MSN-2026-0147",
        landsAs: "The action that would have prevented one exception",
      },
      {
        label: "Reviewer capacity 75.0%",
        source: "KRI-PAY-011, position PR-SR-02 vacant",
        landsAs: "The pressure term in the chain",
      },
      {
        label: "198 of 214 questionnaire responses",
        source: "Novalink reassessment TPRM-Q-2026",
        landsAs: "Four unresolved resilience questions",
      },
      {
        label: "Appendix v4.2 against register v6.1",
        source: "CTR-2023-0117-A3",
        landsAs: "One undisclosed subprocessor, one undisclosed region",
      },
      {
        label: "Workshop at 10:30",
        source: "RCSA-ARC-DE-PAYOPS-2026-Q4",
        landsAs: "One contested residual rating, 9 against 12",
      },
    ],
    converged: {
      objectLabel: "One decision, prepared and unanswered",
      decisionQuestion:
        "Are these four red indicators four problems, or one problem with four symptoms?",
      owner: "Dr. Katharina Vogt, NFR Portfolio Lead",
      authorityBasis: "Group NFR Framework, portfolio mandate",
      statedUnknown:
        "Two of the six links in the chain are inferred rather than recorded, and the brief says which two.",
    },
    dateLine: "One institution. One day. Six professionals. Sixteen scenes.",
    closingLine:
      "Start with the morning. The technology comes later, once the day already feels real.",
  },
};

const scene02: Scene<"signal-clutter-board", SignalClutterContent> = {
  id: "today-0742-reconstruct-the-work",
  sceneNumber: 2,
  visualKind: "signal-clutter-board",
  chapter: "two-mornings",
  title: "The day begins by reconstructing the work.",
  subtitle:
    "07:42 in Frankfurt. Eight surfaces, none of which tells anyone what today is about.",
  keyMessage:
    "The first hour of an NFR day is spent assembling a picture, and the assembly produces no professional output.",
  presenterNotes: [
    "Walk the board left to right and name the source of each signal. Specificity is the whole effect.",
    "Do not editorialise. The audience recognises this morning; let them recognise it.",
    "Land the elapsed figure: 35 to 50 minutes before Stefan Brunner knows anything, and at the end of it he has a list, not a picture.",
    "The finish is the hidden connection: items two, three, four and ten are the same story told four times, and nothing on any of these screens says so.",
    "Say the uncomfortable part: this is not a tooling gap. Every one of these systems is doing its job.",
  ],
  durationSeconds: 140,
  stageNote:
    "Eight cards in a loose, deliberately uneven grid, each with a source chip; no card connects to another.",
  transitionOut:
    "The clock ticks to 07:45 and the eight cards collapse inward, leaving three.",
  audienceQuestions: [
    {
      question: "Is this not just poor tooling discipline on the bank's part?",
      answer:
        "Partly, and we do not excuse it. But each of these systems is correct on its own terms. The GRC platform holds the indicator, the mail client holds the request, the contract repository holds the appendix. None of them is wrong. The connection is nobody's system of record, so it is nobody's output.",
    },
    {
      question: "How much of the first hour is genuinely wasted?",
      answer:
        "We do not claim a time saving, because we cannot measure what your people take. What we can say from this simulation is that the reconstruction produces no professional artefact: no assessment, no conclusion, no decision. It is lane one work priced as lane three time.",
    },
    {
      question: "Our people would say the pivot table is where the insight is.",
      answer:
        "They are right, and that is the point. In this scenario the OVR-C finding only exists because Marlene Aigner built a pivot table by hand. On a normal morning she does not have time, and the finding is lost. Insight that depends on spare capacity is not a control.",
    },
  ],
  scenarioClock: "07:42 CET",
  momentId: "M01",
  showsSyntheticDataLabel: true,
  content: {
    clockLabel: "07:42 CET, Tuesday 06.10.2026",
    placeLabel: "Group Non-Financial Risk, Frankfurt am Main",
    signals: [
      {
        id: "sig-mail",
        kind: "unread-mail",
        label: "61 unread messages",
        source: "Mail client, shared mailbox payments-supplier included",
        detail:
          "Seven relate to the Novalink record. Which seven is only knowable by opening them.",
        metric: {
          value: "61",
          label: "Unread messages at 07:42",
          basis: "measured-in-simulation",
        },
        carriedBy: "Stefan Brunner, Third-Party Risk Manager",
        costOfHandling:
          "Triage by subject line, with object linkage reconstructed from memory.",
      },
      {
        id: "sig-calendar",
        kind: "calendar-conflict",
        label: "Six meetings in one 10:30 slot",
        source: "Calendar",
        detail:
          "Jakob Steinbacher is due at the control owner challenge from 10:30 to 11:15 and as an observer in the RCSA workshop from 11:15, Munich and video.",
        carriedBy: "Jakob Steinbacher, Control Assurance Specialist",
        costOfHandling:
          "Two preparation packs for one morning, assembled from different sources.",
      },
      {
        id: "sig-overdue",
        kind: "overdue-grc-work",
        label: "MSN-2026-0147 overdue",
        source: "SYS-0031 Arcadia RiskCore",
        detail:
          "60% complete, revised due date 31.07.2026, blocked on a payment UAT environment freeze running to 14.10.2026.",
        metric: {
          value: "67 days",
          label: "Past the revised due date",
          basis: "measured-in-simulation",
          note: "Counted from 31.07.2026 to 06.10.2026",
        },
        carriedBy: "Dr. Katharina Vogt, NFR Portfolio Lead",
        costOfHandling:
          "The 67 days are not displayed. She calculates them herself.",
      },
      {
        id: "sig-duplicate-evidence",
        kind: "duplicate-evidence-request",
        label: "The same question asked twice",
        source: "Mail and the TPRM-Q-2026 shared tracker",
        detail:
          "Nadia Lehmann is about to email Stefan Brunner to ask whether TPRM-Q-2026-R04 has been escalated. The answer exists in a tracker she cannot see.",
        carriedBy: "Nadia Lehmann, Incident and Resilience Lead",
        costOfHandling:
          "One email out, one reply in, both people interrupted, no new fact created.",
      },
      {
        id: "sig-dashboard",
        kind: "disconnected-dashboard",
        label: "Four red indicators, four rows, four owners",
        source: "Group NFR dashboard",
        detail:
          "KRI-PAY-007 at 3.84, KRI-PAY-003 at 2.70%, KRI-PAY-011 at 75.0%, KRI-TPR-002 at 94.6%. Nothing on the screen links them.",
        metric: {
          value: "4 of 6",
          label: "Group indicators in red",
          basis: "measured-in-simulation",
        },
        carriedBy: "Dr. Katharina Vogt, NFR Portfolio Lead",
        costOfHandling:
          "Four separate 1LoD explanation requests, each procedurally correct.",
      },
      {
        id: "sig-status",
        kind: "status-request",
        label: "Committee papers close in two business days",
        source: "Committee tracker spreadsheet",
        detail:
          "CMT-NFR-2026-10 papers due 08.10.2026 at 12:00. Three of five decision items are undrafted. A late paper is tabled for information and cannot carry a decision.",
        metric: {
          value: "3 of 5",
          label: "Decision items undrafted",
          basis: "measured-in-simulation",
        },
        carriedBy: "Dr. Katharina Vogt, NFR Portfolio Lead",
        costOfHandling:
          "Status chased person by person, with no view of who is blocking whom.",
      },
      {
        id: "sig-workshop",
        kind: "upcoming-workshop",
        label: "RCSA workshop at 10:30",
        source: "RCSA-ARC-DE-PAYOPS-2026-Q4",
        detail:
          "Eleven risks, pre-read issued 02.10.2026, one contested residual rating: 1LoD at 9, 2LoD at 12, with the appetite boundary at 10.",
        carriedBy: "Marlene Aigner, Operational Risk Partner",
        costOfHandling:
          "The first 25 minutes of the workshop go on establishing what the control test found.",
      },
      {
        id: "sig-overnight",
        kind: "overnight-signal",
        label: "731 override rows, no summary",
        source: "Excel extract sent by Payment Operations on 01.10.2026",
        detail:
          "OVR-C route substitution grew from 31 to 198 and OVR-D cut-off driven release from 94 to 211. Both facts sit inside the file, visible only to someone who builds a pivot table.",
        metric: {
          value: "+539%",
          label: "OVR-C growth, August to September",
          basis: "measured-in-simulation",
        },
        carriedBy: "Marlene Aigner, Operational Risk Partner",
        costOfHandling:
          "A hand-built pivot table, on a morning with a workshop at 10:30.",
      },
    ],
    systemsOpened: [
      "Mail client",
      "SYS-0031 Arcadia RiskCore, third-party module",
      "SYS-0031 Arcadia RiskCore, risk and control module",
      "Contract repository, through the document management search",
      "TPRM-Q-2026-tracker-v14.xlsx on a shared drive",
      "Resilience-testing-plan-2026.xlsx",
      "The 34-page KRI report PDF, three red rows on page 11",
      "Committee tracker spreadsheet",
    ],
    elapsedBeforeAnythingIsKnown: {
      value: "35 to 50 minutes",
      label: "Before the Third-Party Risk Manager knows anything",
      basis: "measured-in-simulation",
      note: "Scenario figure for one role on one morning, not an industry estimate",
    },
    hiddenConnection:
      "Override volume rose because the primary clearing route failed five times in September. Reviewer capacity sits at 75%. The control governing overrides has four exceptions and two items that cannot be concluded. The action that would have prevented one of those exceptions is 67 days overdue. Four red rows, one causal chain, and no surface in the bank draws it.",
  },
};

const scene03: Scene<"decision-card-collapse", DecisionCardCollapseContent> = {
  id: "future-0745-decisions-not-notifications",
  sceneNumber: 3,
  visualKind: "decision-card-collapse",
  chapter: "two-mornings",
  title: "The future starts with decisions, not notifications.",
  subtitle:
    "07:45. The same eight surfaces, resolved into three decisions that carry an owner and a deadline.",
  keyMessage:
    "The morning brief ranks decisions, states what is not known, and writes nothing until a person decides.",
  presenterNotes: [
    "Same person, same data, three minutes later in scenario time. Nothing has been added to the world.",
    "Read one card in full, including the what-is-not-known block. The unknowns are the credibility of the whole scene.",
    "Land the read-only rule: the morning brief writes nothing to the system of record. A brief that writes before the human has read it inverts accountability.",
    "Only then show the background reveal: 23 actions, 7 artefacts, 0 awaiting release, 1 draft prepared and unaccepted. Drillable, in every case.",
    "Do not say the word agent yet. The audience should want this day before they are told how it is built.",
  ],
  durationSeconds: 140,
  stageNote:
    "Three decision cards, centred, each with a known block, a not-known block, an owner chip and a destination; the eight source signals persist as small provenance chips beneath.",
  transitionOut:
    "A card is pulled apart into the five lanes of work that produced it, which is the next scene.",
  audienceQuestions: [
    {
      question: "How do you decide what counts as a decision worth surfacing?",
      answer:
        "Deterministically, and the ranking is inspectable. Inputs are the hard deadline, the dependency chain, how close an escalation rule is, which entity is accountable, and whether the item blocks another person. The brief shows why an item ranks where it does, so the ranking can be argued with.",
    },
    {
      question: "What stops the brief from being confidently wrong?",
      answer:
        "Two things. Every claim carries provenance, so a wrong claim is traceable to a source. And every inference states the specific reason it could be wrong: here, that 17 of 198 route-substitution overrides fall outside the fallback windows, which is the fact that would weaken the attribution.",
    },
    {
      question: "Three cards for a whole morning seems few.",
      answer:
        "Three is what this role has at 07:45 in this scenario. It is not a design target. The other work has not disappeared; it has been ranked below these three and it is one click away. The claim is about sequence, not about volume.",
    },
  ],
  scenarioClock: "07:45 CET",
  momentId: "M01",
  roleFocus: "rcsa",
  showsSyntheticDataLabel: true,
  content: {
    clockLabel: "07:45 CET",
    person: "Marlene Aigner",
    roleLabel: "Operational Risk Partner, Payments and Transaction Banking",
    entityLabel: "Arcadia Bank AG, Germany. Frankfurt, with a standing presence in Munich.",
    cards: [
      {
        id: "card-causal-or-three",
        question:
          "Three red indicators: request three 1LoD explanations, or one causal investigation?",
        whatIsKnown: [
          "KRI-PAY-007 at 3.84 per 10,000 against a red threshold of 3.50, the first red in 14 months.",
          "The breach decomposes by reason code: OVR-C up 539%, OVR-D up 124%, three components close to flat.",
          "OVR-C growth aligns with five NOVA-GATE fallback activations totalling 8 hours 40 minutes in September, against one hour in August.",
          "KRI-PAY-011 reviewer capacity is 75.0%, driven by position PR-SR-02, vacant since 31.07.2026.",
        ],
        whatIsNotKnown: [
          "Override records carry no field linking them to a specific fallback activation, so the attribution is temporal, not recorded.",
          "181 of 198 September OVR-C overrides fall inside the activation windows. 17 do not, and those 17 are what would falsify the attribution.",
        ],
        owner: "Marlene Aigner, 2LoD",
        authorityBasis: "Group Operational Risk Policy, 2LoD analysis mandate",
        reversible: true,
        destination:
          "Recorded at 09:58 as DEC-2026-0771, one causal investigation rather than three explanation requests",
        evidenceRefs: [
          "KRI-PAY-007 September reading",
          "August and September override extracts by reason code",
          "Five September fallback activation records",
        ],
      },
      {
        id: "card-residual-9-or-12",
        question:
          "RSK-0211 residual: is the control environment Effective, or Partially Effective?",
        whatIsKnown: [
          "Inherent score 12 of 25, High, unchanged across three cycles.",
          "1LoD proposes residual 9 of 25, Medium, within appetite, consequence is monitoring.",
          "2LoD proposes residual 12 of 25, Medium-High, outside appetite, consequence is a remediation plan with dates or a Risikoakzeptanz signed by the entity Chief Operating Officer.",
          "CTL-PAY-014 is the only preventive control mapped to this risk. CTL-PAY-021 is detective, next business day, 10% sampled. CTL-PAY-029 reconciles value, not authorisation.",
        ],
        whatIsNotKnown: [
          "Whether two detective compensating controls can substitute for one preventive control rated Partially Effective. That is a judgment about sufficiency and the system does not hold a view on it.",
          "Jakob Steinbacher has not closed his control conclusion, and his open item is what blocks this rating.",
        ],
        owner: "Andreas Kellner as assessment owner, Marlene Aigner as facilitator",
        authorityBasis: "RCSA procedure, with a dissent clause",
        reversible: true,
        destination:
          "RCSA-ARC-DE-PAYOPS-2026-Q4 workshop at 10:30, with the residual cell left empty until the room fills it",
        evidenceRefs: [
          "TST-2026-0318 report, 25.09.2026",
          "CTL-PAY-021 and CTL-PAY-029 control descriptions",
          "RSK-0211 Q3 assessment, signed 08.07.2026",
        ],
      },
      {
        id: "card-loss-history",
        question:
          "Zero recorded losses over 24 months: is that evidence about likelihood?",
        whatIsKnown: [
          "The loss register records no loss against RSK-0211 in 24 months. That is a verified fact about the register.",
          "1LoD relies on it: four exceptions, no financial loss, all four payments later confirmed correct by clients.",
        ],
        whatIsNotKnown: [
          "Whether detection on this risk is effective. The detective control is CTL-PAY-029, which reconciles value rather than authorisation, so a correctly valued payment sent to a wrong beneficiary would pass it.",
          "A clean loss register with unproven detection is silence, not evidence. The interpretation is contested and the brief says so rather than choosing.",
        ],
        owner: "Marlene Aigner, 2LoD",
        authorityBasis: "Group Operational Risk Policy, challenge mandate",
        reversible: true,
        destination:
          "Carried into the 10:30 workshop as a stated limitation on the 1LoD argument",
        evidenceRefs: [
          "RSK-0211 loss history, 24 months",
          "CTL-PAY-029 control description",
        ],
      },
    ],
    readOnlyStatement:
      "The morning brief writes nothing. M01 is read-only for all six roles by design, because a brief that updates the system of record before the human has read it inverts the accountability.",
    withheld: [
      "No recommended residual rating. The worksheet is prepared with the inherent scores carried forward and the residual cells empty.",
      "No pre-selected option on any card. A pre-selection converts a judgment into a signature.",
      "No drafted rationale. The rationale belongs to the person who forms it.",
    ],
    backgroundReveal: {
      organise: 7,
      understand: 16,
      execute: 0,
      judgment: 0,
      total: {
        value: "23",
        label: "Actions completed before 07:45, this role, this moment",
        basis: "measured-in-simulation",
        note: "COUNT over the seeded action ledger, drillable to every row",
      },
      artefactsTouched: 7,
      artefactsExternal: 0,
      awaitingRelease: 0,
      draftsPrepared: 1,
      drillDownNote:
        "Every counted action lists its type, inputs, outputs and duration. A number without a list is a claim, so the list is part of the number.",
    },
  },
};

/* ==========================================================================
   Chapter II: Work, lane by lane
   ========================================================================== */

const scene04: Scene<"work-lane-ladder", WorkLaneLadderContent> = {
  id: "five-work-lanes",
  sceneNumber: 4,
  visualKind: "work-lane-ladder",
  chapter: "work-lane-by-lane",
  // Eleven words. Fixed by the story brief; recorded in STORY_COPY_RULES.
  title: "Not every part of NFR work changes in the same way.",
  subtitle:
    "Five lanes of work. Three are shared infrastructure, two are professional practice, and one produces no automated action.",
  keyMessage:
    "Organise, Understand and Execute are built once. Assess and Decide stay with the professional, and Decide stays unautomated on purpose.",
  presenterNotes: [
    "This is the scene that stops the audience worrying that you are automating judgment. Do not rush it.",
    "Walk the ladder bottom to top: Organise, Understand, Assess, Decide, Execute. Name what changes and what does not, per lane.",
    "Lane 4 Decide has one hard property: it produces no automated actions. No pre-selection, no default, no drafted rationale.",
    "Lane 5 is the counter-intuitive one. Execute is high volume, low judgment, and it is where the audit trail is created, so banks leave it manual. That is the wrong resolution.",
    "The build ratio is a design target, not a measurement. Say so as you show it.",
  ],
  durationSeconds: 125,
  stageNote:
    "Five horizontal lanes stacked as a ladder; each lane fills from the left with a shared-infrastructure tone or a professional-practice tone, and lane 4 stays deliberately unfilled.",
  transitionOut:
    "The Assess lane splits into six coloured strands, one per role, which resolve into the lens switcher.",
  audienceQuestions: [
    {
      question: "Why is Decide unautomated rather than assisted with a recommendation?",
      answer:
        "Because a rubber-stamped materiality assessment is worse than no assessment: it carries a signature. The system retrieves into the decision moment, models what each option would change, and holds the record structure open. It does not rank the options and it does not draft the rationale before a person has formed one.",
    },
    {
      question: "The 85 and 70 and 20 percent figures: where are they from?",
      answer:
        "They are design targets for planning this product, labelled illustrative. They are not measurements and they are not taken from any external study. If we build it and the Assess lane turns out to be 40% common rather than 20%, the plan changes.",
    },
    {
      question: "If Assess is function-specific, are you building six products?",
      answer:
        "That is the real risk and we test it rather than assert it. The common part of Assess is the shared object model, the evidence layer, and one structure for a professional conclusion: conclusion, method, evidence, limitation. The method itself is configured per function. If that does not hold, this is six products and it is not economic.",
    },
  ],
  showsSyntheticDataLabel: true,
  content: {
    organisingClaim:
      "Three of the five lanes are shared infrastructure and two are not. If that holds, this is one work environment with six configurations. If it does not hold, it is six products.",
    judgmentRule:
      "Lane 4 Decide produces no automated actions. The system may retrieve on demand, show what is known and what is not, and model the consequence of each option. It does not propose the decision, pre-select an answer, or draft a rationale before the human has formed one.",
    buildRatioNote:
      "Roughly 70% of engineering effort sits in the three shared lanes and 30% in the two professional lanes, most of it as configuration of method rather than new code. Design target for planning, not an observed measurement.",
    lanes: [
      {
        laneNumber: 1,
        label: "Organise",
        fullName: "Personal Work Orchestration",
        definition:
          "Turning an unstructured day into a sequenced, owned, deadline-aware set of work.",
        todayCost:
          "The largest share of the day, and the smallest share of the professional judgment.",
        whatChanges:
          "Inbox triage with object linkage, deterministic priority ranking, dependency resolution, chasing with an escalation ladder, routing, meeting pack assembly, routine drafting.",
        whatStaysHuman:
          "Deciding that an item is material enough to route upward, and deciding that a non-response is itself a finding.",
        ownership: "shared-infrastructure",
        commonShare: {
          value: "~85%",
          label: "Common code, with the remainder as configuration",
          basis: "illustrative",
        },
        scenarioExample:
          "Jakob Steinbacher learns at 07:45 that his open control conclusion is blocking Marlene Aigner's 10:30 workshop. No system he uses today can tell him that.",
      },
      {
        laneNumber: 2,
        label: "Understand",
        fullName: "Evidence and Risk Intelligence",
        definition:
          "Getting the facts, proving where they came from, and noticing what they mean together.",
        todayCost:
          "Sixty to ninety minutes to compare two document versions by eye across two monitors.",
        whatChanges:
          "Retrieval with provenance on every claim, reconciliation of two sources of one fact, component decomposition of a headline movement, and contradiction detection with attribution.",
        whatStaysHuman:
          "Deciding which of two contradictory statements to act on, and deciding whether a divergence is material.",
        ownership: "shared-engine-role-corpora",
        commonShare: {
          value: "~70%",
          label: "Common engine, with role-specific corpora and taxonomies",
          basis: "illustrative",
        },
        scenarioExample:
          "Appendix A3 v4.2 reconciled against Novalink register v6.1 node by node, producing a four row divergence table with evidence on every row.",
      },
      {
        laneNumber: 3,
        label: "Assess",
        fullName: "Core Risk Practice",
        definition:
          "The function-specific professional work the role exists to perform.",
        todayCost:
          "Compressed into whatever time survives lanes one and two.",
        whatChanges:
          "The professional arrives at a formed picture rather than a search box, and receives a prepared draft with the conclusion cell left empty.",
        whatStaysHuman:
          "The method, the standard of sufficiency, and the conclusion. A Third-Party Risk Manager and a Control Assurance Specialist do genuinely different jobs here.",
        ownership: "function-specific",
        commonShare: {
          value: "~20%",
          label: "Common object model and conclusion structure",
          basis: "illustrative",
        },
        scenarioExample:
          "Stefan Brunner moves the fourth-party item from gap to drafting gap with no obligation breached, and the Amsterdam region from gap to material change with notice required and not given. That distinction is the professional work of his morning.",
      },
      {
        laneNumber: 4,
        label: "Decide",
        fullName: "Human Judgment and Challenge",
        definition:
          "Materiality, interpretation, challenge, negotiation, acceptance, escalation, accountability.",
        todayCost:
          "Reached late, under time pressure, on a picture assembled by hand.",
        whatChanges:
          "The person arrives fully briefed. Nothing else. At 11:45 nothing is written and nothing is drafted.",
        whatStaysHuman:
          "The whole lane. Materiality, the design against operating distinction, whether to accept a manual-process risk to meet a cut-off, and what to put in front of a committee on incomplete facts.",
        ownership: "function-specific-unautomated",
        commonShare: {
          value: "0%",
          label: "Automated actions in this lane, by design",
          basis: "measured-in-simulation",
          note: "Enforced: the action ledger rejects a lane 4 row",
        },
        scenarioExample:
          "At 15:07 Sibylle Graf commits the Swiss entity to a manual clearing submission with 38 minutes of runway and a 45-minute preparation lead time, 31 minutes before the root cause is known. The decision cannot wait for the facts.",
      },
      {
        laneNumber: 5,
        label: "Execute",
        fullName: "Controlled Execution and Assurance",
        definition:
          "Writing the outcome into the systems of record with an audit trail, and assuring the follow-through.",
        todayCost:
          "Heavily manual, and treated as too sensitive to change because it is where the audit trail is created.",
        whatChanges:
          "One transaction envelope for every write, an append-only audit record naming the human who authorised it, and follow-up assurance that verifies a committed action actually occurred.",
        whatStaysHuman:
          "The release. Every write is prepared, then released by a named person against a specific payload.",
        ownership: "shared-engine-role-routes",
        commonShare: {
          value: "~75%",
          label: "Common engine, with role-specific targets and routes",
          basis: "illustrative",
        },
        scenarioExample:
          "Eight new Massnahmen raised on 06.10.2026 by five different roles are one object type with one structure: title, owner, due date, source, dependency, evidence requirement, escalation rule.",
      },
    ],
  },
};

const scene05: Scene<"lens-switcher", LensSwitcherContent> = {
  id: "one-environment-many-lenses",
  sceneNumber: 5,
  visualKind: "lens-switcher",
  chapter: "work-lane-by-lane",
  title: "One work environment. Multiple professional lenses.",
  subtitle:
    "Six roles, one shared object model. The lens changes the question, the method and the visual, not the environment.",
  keyMessage:
    "Each function keeps its own unit of analysis and its own hero view, while the evidence layer and the audit trail stay shared.",
  presenterNotes: [
    "Name the six roles and the six units of analysis. An arrangement, a risk, a control in a period, a service under disruption, an obligation, the portfolio.",
    "The hero visual per role is the proof that this is not one dashboard with a filter. Six genuinely different pictures.",
    "Land the different question per role. That column is what makes a specialist feel seen rather than flattened.",
    "Be honest about the economics: one environment only works if the shared lanes really are shared. We test that claim in build, we do not assert it.",
  ],
  durationSeconds: 75,
  stageNote:
    "A single framed environment with a six-position lens selector; switching the lens re-renders the central stage while the frame, provenance rail and audit strip stay in place.",
  transitionOut:
    "The lens settles on the Third-Party Risk Manager and the environment loads his 08:10 queue.",
  audienceQuestions: [
    {
      question: "Is this one product or six?",
      answer:
        "One environment with six configurations, on the claim that Organise, Understand and Execute are shared. Assess and Decide are configured per function. If in build the shared share comes out materially lower than the design target, the honest answer changes and so does the plan.",
    },
    {
      question: "Our functions sit in different reporting lines and different countries.",
      answer:
        "So do these. Three are group mandate, one is seconded from the Austrian entity, one sits in Zurich with a group remit, and one reports to the Chief Compliance Officer with a dotted line. The environment holds entity partitioning because the accountability is genuinely local, and local entity sign-off cannot be absorbed by a group function.",
    },
  ],
  showsSyntheticDataLabel: true,
  content: {
    sharedAcrossLenses: [
      "The domain object model: the same risks, controls, suppliers, incidents and obligations.",
      "The evidence and provenance layer: source, version, hash, retrieval path, immutability.",
      "The classification scheme: verified fact, stakeholder statement, telemetry inference, with reclassification history.",
      "The append-only audit trail, naming the human who authorised every write.",
      "The work item model: source, arrival time, object links, deadline, dependency, owner, entity, state, age.",
    ],
    changesWithTheLens: [
      "The unit of analysis, and therefore what counts as a complete answer.",
      "The corpus: contracts and questionnaires, or control descriptions and audit logs, or regulatory texts and policies.",
      "The sufficiency taxonomy: what makes an artefact good enough differs by function.",
      "The hero visualisation, which is a different geometry per role rather than a filtered chart.",
      "The decision rights, the authority basis, and the consequence of being wrong.",
    ],
    economicNote:
      "One environment is worth building only if the shared lanes are genuinely shared. That is a testable claim about engineering effort, not a slogan, and the design target is roughly 70% shared.",
    lenses: [
      {
        roleSlug: "tprm",
        roleLabel: "Third-Party Risk Manager",
        roleLabelDe: "Drittparteienrisikomanagement",
        person: "Stefan Brunner",
        entityLabel: "Arcadia Bank AG, group mandate. Frankfurt.",
        unitOfAnalysis: "An arrangement",
        primaryObject: "TP-0042 Novalink Payment Services GmbH",
        heroVisual: "Supplier dependency and chain graph, three rings deep",
        differentQuestion:
          "Was the thing that saved us even in the contract, and was the thing that failed supposed to be able to fail?",
        hardestJudgment: "Breach, gap or dispute",
      },
      {
        roleSlug: "rcsa",
        roleLabel: "Operational Risk Partner",
        roleLabelDe: "Operationelles Risiko",
        person: "Marlene Aigner",
        entityLabel: "Arcadia Bank AG. Frankfurt, standing presence in Munich.",
        unitOfAnalysis: "A risk",
        primaryObject: "RSK-0211 Erroneous or unauthorised payment release",
        heroVisual: "Risk and control heat grid with a residual movement trail",
        differentQuestion:
          "Is this a new risk, or the risk I already have finally showing its likelihood?",
        hardestJudgment: "The residual rating, and whether to record a dissent",
      },
      {
        roleSlug: "control-assurance",
        roleLabel: "Control Assurance Specialist",
        roleLabelDe: "Internes Kontrollsystem, Pruefung",
        person: "Jakob Steinbacher",
        entityLabel: "Arcadia Bank Oesterreich AG, seconded to group. Vienna.",
        unitOfAnalysis: "A control in a period",
        primaryObject: "CTL-PAY-014 Independent secondary review of manual payment overrides",
        heroVisual: "Control evidence chain and test population waterfall",
        differentQuestion:
          "Did my test have the coverage to have found this, and if not, what else does my method not see?",
        hardestJudgment:
          "Design against operating, and reopening his own conclusion in public",
      },
      {
        roleSlug: "incident-resilience",
        roleLabel: "Incident and Resilience Lead",
        roleLabelDe: "Betriebskontinuitaetsmanagement",
        person: "Nadia Lehmann",
        entityLabel: "Arcadia Bank Schweiz AG, group mandate. Zurich.",
        unitOfAnalysis: "A service under disruption",
        primaryObject: "IBS-0004 Corporate Payments, with ITOL-0004-03",
        heroVisual: "Impact tolerance runway, one lane per entity per service",
        differentQuestion:
          "How much time do I have, per entity, and does the arrangement I am relying on hold while I use it?",
        hardestJudgment:
          "An irreversible fallback decision with 38 minutes of runway",
      },
      {
        roleSlug: "regulatory-change",
        roleLabel: "Regulatory Change Manager",
        roleLabelDe: "Regulatorische Veraenderung",
        person: "Tobias Reinhardt",
        entityLabel: "Arcadia Bank AG, group mandate. Frankfurt.",
        unitOfAnalysis: "An obligation",
        primaryObject: "REG-2026-0031 and REG-2026-0088",
        heroVisual:
          "Obligation to control traceability map, two lanes separated by a hard rule",
        differentQuestion:
          "Which obligations did today touch, in which jurisdiction, and does anything we have already stated need to change?",
        hardestJudgment: "Whether a stated position has to change",
      },
      {
        roleSlug: "nfr-governance",
        roleLabel: "NFR Portfolio Lead",
        roleLabelDe: "Nichtfinanzielle Risiken, Portfolio",
        person: "Dr. Katharina Vogt",
        entityLabel: "Arcadia Bank AG, group mandate. Frankfurt.",
        unitOfAnalysis: "The portfolio",
        primaryObject: "CMT-NFR-2026-10 Group Non-Financial Risk Committee",
        heroVisual: "Group NFR position board with a causal chain overlay",
        differentQuestion:
          "What decision does this group need, who can take it, and can it be taken on the facts that exist at the deadline?",
        hardestJudgment:
          "Whether a decision can be taken on deadline-available facts",
      },
    ],
  },
};

/* ==========================================================================
   Chapter III: One professional day
   ========================================================================== */

const scene06: Scene<"decision-queue", DecisionQueueContent> = {
  id: "tprm-three-decisions",
  sceneNumber: 6,
  visualKind: "decision-queue",
  chapter: "one-professional-day",
  title: "The TPRM manager opens three decisions, not five systems.",
  subtitle:
    "08:10. Contract, questionnaire tracker, evidence vault, register and mailbox arrive as three decisions with deadlines.",
  keyMessage:
    "The work environment replaces the assembly, not the assessment. He opens decisions, and the systems stay where they are.",
  presenterNotes: [
    "Name the five systems he does not open, one by one. The audience knows these systems.",
    "Read the second decision in full. The DR report has been in the vault for 137 days with an unescalated RTO gap; nobody was negligent, the artefact simply had no owner after filing.",
    "The third decision is the one to dwell on: he can meet the reassessment deadline with an open item, and he cannot resolve the appendix divergence without a contractual route that takes weeks. So he chooses the divergence.",
    "Mention the chase ages without drama: the full penetration test report has been outstanding 14 days.",
    "This is lane one and lane two doing their job. He has not yet done anything only he can do. That comes next.",
  ],
  durationSeconds: 115,
  stageNote:
    "A three-row decision queue with deadline, dependency and blocking chips; the five replaced systems sit as dimmed provenance tiles along the lower edge.",
  transitionOut:
    "He opens the first decision and the supplier exposure graph draws itself around the Novalink node.",
  audienceQuestions: [
    {
      question: "Does this replace our GRC platform?",
      answer:
        "No. The GRC platform stays the system of record and every write goes into it with an entity partition, a record identifier, an accountable human and an evidence reference. What changes is that he stops reconstructing the picture from five surfaces before he can use it.",
    },
    {
      question: "He still has to read the contract. What has actually changed?",
      answer:
        "He reads the clause, not the repository. The reconciliation between the binding appendix and the current register is done and evidenced per row, so his time goes on the question that needs him: is the Amsterdam region a material change requiring notice, or a drafting gap.",
    },
    {
      question: "What if the reconciliation is wrong?",
      answer:
        "Then it is wrong visibly. Every row carries both source versions and their dates. He overrode two gap classifications in this scenario, and both overrides are recorded against his name. An assessment you cannot override is not an assessment.",
    },
  ],
  scenarioClock: "08:10 CET",
  momentId: "M02",
  roleFocus: "tprm",
  showsSyntheticDataLabel: true,
  regulatoryNote: REGULATORY_LABEL,
  regulatoryScope: "both-lanes-separately",
  content: {
    clockLabel: "08:10 CET",
    person: "Stefan Brunner",
    roleLabel: "Third-Party Risk Manager, Group Third-Party Risk Management",
    decisions: [
      {
        id: "dec-appendix-divergence",
        headline:
          "The binding subprocessor appendix and the supplier register do not agree.",
        preparedPosition:
          "Four divergence rows, reconciled node by node: one subprocessor in Pune absent from the appendix entirely, one hosting region in Amsterdam not listed, two nodes matching, and fourth parties not addressed by the appendix as drafted.",
        limitation:
          "No notice for the Pune subprocessor exists in the contract repository. That is evidence of absence in Arcadia records, not proof that no notice was given. The search covered the repository and two shared mailboxes, not individual mailboxes.",
        deadline:
          "Committee paper AG-CMT-NFR-2026-10-04, papers close 08.10.2026 at 12:00",
        evidenceRefs: [
          "CTR-2023-0117-A3 v4.2, 14.02.2025, binding",
          "Novalink Subprocessor Register v6.1, 03.08.2026",
          "CTR-2023-0117-A3 clause 3.4, 60 day notice obligation",
          "CTR-2023-0117-A7 v2.2, 20.05.2025, data processing and transfers",
        ],
      },
      {
        id: "dec-dr-evidence-gap",
        headline:
          "The supplier disaster recovery report has been in the vault for 137 days with an unescalated gap.",
        preparedPosition:
          "The report covers the Frankfurt and Amsterdam regions. There is no evidence for the Swiss instance. Contracted recovery time objective is 2 hours; the tested outcome was 3 hours 40 minutes, with no explanation and no remediation plan on record.",
        limitation:
          "The recovery time gap is read from the supplier test report. Arcadia has not observed a recovery itself and has no mechanism to verify the figure without an audit under the audit and access appendix.",
        deadline:
          "MSN-2026-0188, Swiss instance DR evidence, due 20.10.2026, currently 25% complete",
        blocking:
          "Nadia Lehmann is waiting on this answer for the Swiss entity resilience position",
        evidenceRefs: [
          "EVD-2026-40118, DR test report, 22.05.2026, retrieved 15.06.2026",
          "CTR-2023-0117-A1, service description, recovery time objective",
          "TPRM-Q-2026-R04 and TPRM-Q-2026-R07",
        ],
      },
      {
        id: "dec-morning-priority",
        headline:
          "Reassessment deadline in 25 days, or the appendix divergence with no deadline at all?",
        preparedPosition:
          "Reassessment status reconciled from source rather than from the tracker workbook: 198 of 214 responses, 33 of 41 artefacts received, 26 accepted, four unresolved resilience questions. The cycle can close on time carrying an open item.",
        limitation:
          "Whether publication on the supplier client portal constitutes notice under the appendix is a contractual question, not a factual one, and the system does not answer it.",
        deadline: "Reassessment cycle target close 31.10.2026",
        blockedBy:
          "A contract variation route that runs through Procurement and Group Legal and takes weeks",
        evidenceRefs: [
          "TPRM-Q-2026 v2, 214 questions across 11 domains",
          "EVD-2026-40233, penetration test summary, 30.06.2026, two pages",
        ],
      },
    ],
    systemsNotOpened: [
      "The contract repository, through the document management system search",
      "TPRM-Q-2026-tracker-v14.xlsx on a shared drive, last edited 02.10.2026 at 18:42",
      "SYS-0032 Arcadia Evidence Vault, artefact by artefact",
      "The supplier client portal, for the current subprocessor register",
      "The shared mailbox payments-supplier, message by message",
    ],
    todayComparison:
      "Today he opens all five, filters column H of the workbook to see which of 214 questions have responses, cannot tell which of 33 received artefacts he has read, and gives up on the contract repository search after two attempts.",
    backgroundReveal: {
      organise: 17,
      understand: 8,
      execute: 2,
      judgment: 0,
      total: {
        value: "27",
        label: "Actions completed at this moment, this role",
        basis: "measured-in-simulation",
      },
      artefactsTouched: 8,
      artefactsExternal: 3,
      awaitingRelease: 1,
      draftsPrepared: 0,
      drillDownNote:
        "One write is awaiting his release and is shown beside the completed count, not after it. An execute row with no named releaser has not executed.",
    },
  },
};

const scene07: Scene<"supplier-exposure-graph", SupplierExposureGraphContent> = {
  id: "tprm-prepare-and-challenge",
  sceneNumber: 7,
  visualKind: "supplier-exposure-graph",
  chapter: "one-professional-day",
  title: "AI prepares the risk position. The professional challenges the supplier.",
  subtitle:
    "10:30, monthly supplier governance review. He arrives with four asks and dates, not four questions in a spreadsheet.",
  keyMessage:
    "Preparation is machine work. Challenge is professional work, and the meeting produces commitments rather than discussion.",
  presenterNotes: [
    "Start with the chain graph and go outward: the supplier, the three entities, four subprocessors, one fourth party.",
    "The badge is the scene: in the binding appendix against in the supplier current register. Two nodes diverge and the graph says which.",
    "Then flip the overlay to assertion against observation. Recovery objective 2 hours asserted, 3 hours 40 minutes observed. Availability 99.7% contracted, 99.62% calculated.",
    "Be scrupulous on the availability figure: Arcadia calculates 99.62%, the supplier presents 99.74%, and the 0.12 point difference is fully explained by the treatment of one maintenance overrun that the contract does not define. Neither figure is wrong under the contract as drafted.",
    "Land the human move: he raises it as a definitional gap, not a dispute, and asks for the overrun treatment to be agreed in writing. That converts an argument nobody can win into a variation nobody can refuse.",
    "The sequencing of the four asks is a prepared draft he accepted. The judgment to reframe the dispute is his alone.",
  ],
  durationSeconds: 130,
  stageNote:
    "Concentric chain graph, supplier at centre, entity ring inward, subprocessor ring outward, fourth party furthest out and visually thinner; two overlays toggle the edge encoding.",
  transitionOut:
    "The graph holds its shape while the node labels morph from suppliers into processes, risks and controls, and the lens becomes the Operational Risk Partner.",
  audienceQuestions: [
    {
      question: "Where does the supplier data come from in practice?",
      answer:
        "In this simulation, from the seeded contract set, the questionnaire responses and the supplier register, all synthetic. In a real deployment it comes from your contract repository, your questionnaire platform and the supplier portal, and the reconciliation is only as good as the versions you can retrieve. That is the integration cost and we do not minimise it.",
    },
    {
      question: "You are showing a fourth party the contract does not cover. Is that a breach?",
      answer:
        "No, and the distinction matters. The appendix obliges notice of subprocessor changes and is silent on the subprocessors own subcontractors. That is a drafting gap, not a breach, and the professional judgment in this scenario is precisely to record it as one.",
    },
    {
      question: "Could the system have drafted his negotiating position?",
      answer:
        "It drafted the sequence, putting the two asks the supplier can concede cheaply first. It did not decide to reframe the availability dispute as a definitional gap. That reframing is the value of the hour and it is the part we do not automate.",
    },
  ],
  scenarioClock: "10:30 CET",
  momentId: "M05",
  roleFocus: "tprm",
  showsSyntheticDataLabel: true,
  regulatoryNote: REGULATORY_LABEL,
  regulatoryScope: "both-lanes-separately",
  content: {
    supplierName: "Novalink Payment Services GmbH",
    supplierId: "TP-0042",
    criticality: "Tier 1 of 4 on the Arcadia internal scale",
    annualSpend: {
      value: "EUR 6.85m",
      label: "Annual charge, group-wide",
      basis: "measured-in-simulation",
      note: "Scenario figure for a synthetic institution",
    },
    concentrationStatement:
      "The supplier that validates payments also supplies the tool that repairs and overrides them, and the Swiss clearing adapter. Sole provider across all three. Substitutability last assessed 30.06.2025 as 12 to 18 months with material programme cost, with no test performed.",
    meetingLabel:
      "Novalink monthly service and governance review, 10:30 to 11:30. Attending: Stefan Brunner, Lukas Wiesinger, Miriam Falk, Andreas Kellner.",
    nodes: [
      {
        id: "TP-0042",
        name: "Novalink Payment Services GmbH",
        jurisdiction: "Frankfurt am Main, Germany",
        roleInChain:
          "Payment validation gateway, payment repair workbench, Swiss clearing adapter, format library, hosted reconciliation",
        ring: 1,
        inBindingAppendix: true,
        inSupplierRegister: true,
        holdsPaymentData: true,
      },
      {
        id: "TP-0042.1",
        name: "Helvetia CloudWorks AG",
        jurisdiction: "Zurich, Switzerland",
        roleInChain:
          "Infrastructure hosting for the Swiss repair instance and the euroSIC adapter",
        ring: 2,
        inBindingAppendix: true,
        inSupplierRegister: true,
        holdsPaymentData: true,
      },
      {
        id: "TP-0042.2",
        name: "Rheinstack GmbH",
        jurisdiction: "Cologne, Germany. Regions: Frankfurt and Amsterdam.",
        roleInChain:
          "Managed database, backup and regional failover for the gateway and the repair workbench",
        ring: 2,
        inBindingAppendix: true,
        inSupplierRegister: true,
        divergence:
          "The appendix lists the Frankfurt region only. Amsterdam is not listed, and the region change was not notified.",
        holdsPaymentData: true,
      },
      {
        id: "TP-0042.3",
        name: "Polaris Telemetrix s.r.o.",
        jurisdiction: "Brno, Czech Republic",
        roleInChain:
          "Application monitoring, log aggregation, alerting and incident detection for all supplier services",
        ring: 2,
        inBindingAppendix: true,
        inSupplierRegister: true,
        holdsPaymentData: true,
      },
      {
        id: "TP-0042.4",
        name: "Meridian Operations Support Pvt Ltd",
        jurisdiction: "Pune, India",
        roleInChain:
          "First level service desk and out-of-hours monitoring handover, with read access to payment metadata including beneficiary name and reference fields",
        ring: 2,
        inBindingAppendix: false,
        inSupplierRegister: true,
        divergence:
          "Absent from the binding appendix. Onboarded by the supplier on 01.05.2026 with no notice on record. A subprocessing question for the EU entities and a data access question for the Swiss entity.",
        holdsPaymentData: true,
      },
      {
        id: "TP-0042.3-F1",
        name: "Aurora Object Storage Ltd",
        jurisdiction: "Dublin, Ireland",
        roleInChain:
          "Long-term log and telemetry archive for the monitoring subprocessor, 24 month retention, archives contain payment reference metadata",
        ring: 3,
        inBindingAppendix: false,
        inSupplierRegister: false,
        divergence:
          "A fourth party outside the scope of the appendix as drafted. The appendix obliges notice of subprocessor changes and is silent on their subcontractors. A drafting gap, not a breach.",
        holdsPaymentData: true,
      },
    ],
    assertionDeltas: [
      {
        subject: "Recovery time objective, payment repair workbench",
        asserted: "2 hours, per the service description appendix",
        observed: "3 hours 40 minutes in the test report of 22.05.2026",
        source: "EVD-2026-40118, in the vault 137 days, unescalated",
        significance:
          "A 1 hour 40 minute gap between a contracted objective and a tested outcome, with no explanation, no remediation plan and no notification.",
      },
      {
        subject: "Gateway monthly availability, September 2026",
        asserted: "99.7% contracted, excluding planned maintenance",
        observed:
          "99.62% calculated from Arcadia submission telemetry; the supplier presents 99.74%",
        source: "Arcadia calculation, reconciled against the supplier 09:15 deck",
        significance:
          "The 0.12 point difference is fully explained by the treatment of the 11.09.2026 maintenance overrun of 2 hours 5 minutes. The appendix does not define how an overrun is treated, so neither figure is wrong under the contract as drafted.",
      },
      {
        subject: "Disaster recovery coverage",
        asserted: "Test evidence provided for the repair workbench",
        observed:
          "Coverage for the Frankfurt and Amsterdam regions only. No evidence for the Swiss instance.",
        source: "EVD-2026-40118 scope statement",
        significance:
          "The Swiss entity holds no DR evidence for a significant outsourcing. Illustrative regulatory context, not legal advice.",
      },
      {
        subject: "Penetration test scope",
        asserted: "Testing performed on the gateway and the repair workbench",
        observed:
          "A two page summary whose scope statement is silent on whether the override interfaces were in scope",
        source: "EVD-2026-40233, 30.06.2026, full report withheld",
        significance:
          "Arcadia cannot tell whether the highest-privilege function in the process was tested. Outstanding 14 days.",
      },
      {
        subject: "Prior month commitments",
        asserted: "Five commitments given at the September review",
        observed: "Three of five unmet, each with its age",
        source: "Arcadia-authored minute record",
        significance:
          "The supplier writes the minutes today. An Arcadia-authored minute turns a discussion into a dated commitment.",
      },
    ],
    challengeSequence: [
      {
        order: 1,
        question:
          "Confirm in writing how a maintenance overrun is treated in the availability calculation.",
        ask: "Written agreement on the treatment, by 20.10.2026",
        sequencingReason:
          "The supplier can concede a definition cheaply. It costs nothing to agree and it removes a recurring argument.",
      },
      {
        order: 2,
        question:
          "Confirm whether the override interfaces were in scope of the penetration test.",
        ask: "A scope confirmation, or the relevant scope section, by 13.10.2026",
        sequencingReason:
          "A scope confirmation is cheaper for the supplier than releasing a withheld report, and it answers the actual question.",
      },
      {
        order: 3,
        question:
          "Provide disaster recovery test evidence for the Swiss instance, or state that none exists.",
        ask: "Evidence or a written statement, by 20.10.2026, against MSN-2026-0188",
        sequencingReason:
          "This is the expensive ask. It follows two concessions, so refusing it becomes conspicuous.",
      },
      {
        order: 4,
        question:
          "Explain the subprocessor in Pune and the hosting region in Amsterdam against the notice obligation in the appendix.",
        ask: "A formal position, by 16.10.2026, against MSN-2026-0191 and MSN-2026-0221",
        sequencingReason:
          "The contractual question goes last because it changes the temperature of the room and the other three would not survive it.",
      },
    ],
    humanChoice:
      "Whether to contest the availability figure. He raises it as a definitional gap rather than a dispute and asks for the overrun treatment to be agreed in writing, which converts an unwinnable argument into a contract variation that is hard to refuse. Reversible.",
    uncertaintyDisclosed: [
      "The 99.62% availability figure is calculated from Arcadia submission telemetry, not from a supplier service report. If the supplier measurement excludes different maintenance windows, the figure differs and the service level conclusion may not hold.",
      "The stated data access scope for the Pune subprocessor is the supplier assertion. Arcadia has not verified it and has no mechanism to verify it without an audit under the audit and access appendix.",
      "No notice for the Pune subprocessor exists in the Arcadia contract repository. That is evidence of absence in Arcadia records, not proof that no notice was given.",
    ],
  },
};

const scene08: Scene<"role-morph-transition", RoleMorphTransitionContent> = {
  id: "switch-role-keep-environment",
  sceneNumber: 8,
  visualKind: "role-morph-transition",
  chapter: "one-professional-day",
  title: "Switch the role. Keep the environment.",
  subtitle:
    "The supplier exposure graph reshapes into the process, risk and control graph. Same objects, different professional question.",
  keyMessage:
    "The role switch changes the lens and the authority, and it keeps the evidence, the provenance and the audit trail.",
  presenterNotes: [
    "This is a sixty second scene. Let the morph do the talking and say very little over it.",
    "Point out that the Novalink node does not disappear. It becomes a system dependency on a control.",
    "Name what carries across: the same evidence objects, the same classifications, the same audit trail, and the role switch itself recorded as an auditable action.",
    "Name what changes: the authority scopes. The Operational Risk Partner can rate a risk. The Third-Party Risk Manager cannot, and the reverse holds for supplier criticality.",
  ],
  durationSeconds: 70,
  stageNote:
    "One continuous morph: node positions are preserved while labels, edges and the legend cross-fade from the supplier chain into the process, risk and control graph.",
  transitionOut:
    "The control node pulses once, and the Operational Risk Partner workbench opens on what has changed since the last cycle.",
  audienceQuestions: [
    {
      question: "Can one person hold several roles?",
      answer:
        "In the product, the acting role is explicit and the authority scopes follow it. Switching role is itself a recorded action with a timestamp, so a change of hat leaves a trace. Whether one person should hold two of these mandates is your operating model question, not ours.",
    },
    {
      question: "Does the second role see everything the first one saw?",
      answer:
        "It sees the same objects where its permissions reach, and the provenance travels with them. What it does not inherit is the first role authority. A retrieval crossing roles is recorded as a reuse, counted once, against the role that requested it.",
    },
  ],
  scenarioClock: "08:45 CET",
  momentId: "M03",
  showsSyntheticDataLabel: true,
  content: {
    fromRole: {
      slug: "tprm",
      person: "Stefan Brunner",
      visual: "Supplier dependency and chain graph",
    },
    toRole: {
      slug: "rcsa",
      person: "Marlene Aigner",
      visual: "Process, risk and control graph, leading into the heat grid",
    },
    sharedObject:
      "The repair workbench, SYS-0014. To the Third-Party Risk Manager it is a service under a contract. To the Operational Risk Partner it is the system dependency of the only preventive control on her risk.",
    retained: [
      "The evidence objects, with their versions, dates and retrieval paths unchanged.",
      "The classification of every fact: verified, stakeholder statement, or telemetry inference.",
      "The append-only audit trail, including the role switch itself as a recorded action.",
      "The scenario clock. Switching role does not move time.",
      "The open divergence on the control, visible to both roles with both positions attributed.",
    ],
    changed: [
      "The unit of analysis: an arrangement becomes a risk.",
      "The authority scopes: rating a risk becomes reachable, changing supplier criticality does not.",
      "The corpus: contracts and questionnaires give way to assessments, control descriptions and indicator history.",
      "The hero geometry: a concentric chain graph gives way to a five by five grid with a movement trail.",
      "The sufficiency standard: a contractual clause gives way to a control characterisation.",
    ],
    auditNote:
      "The role switch is written to the audit trail with the acting user, the previous role, the new role and the scenario time. A change of lens that leaves no trace would be a control weakness.",
  },
};

const scene09: Scene<"change-since-last-cycle", ChangeSinceLastCycleContent> = {
  id: "rcsa-starts-with-what-changed",
  sceneNumber: 9,
  visualKind: "change-since-last-cycle",
  chapter: "one-professional-day",
  title: "The RCSA starts with what changed.",
  subtitle:
    "Eleven risks in scope. Ten are unchanged and say so. One moved, and the workbench opens on the movement.",
  keyMessage:
    "A quarterly assessment should begin at the delta, with the driver of each movement attached as an object rather than a label.",
  presenterNotes: [
    "Say the number first: eleven risks, ten materially unchanged, one moved. That is what a cycle actually looks like.",
    "Walk the movement trail on RSK-0211: Q3 at 6, the 1LoD Q4 position at 9, the 2LoD position at 12, and the appetite line at 10 running between the second and the third.",
    "Each trail segment carries its driver as an object you can open, not a caption. Six to nine carries reviewer capacity at 75%. Nine to twelve carries the control test conclusion.",
    "Read the inference limit out loud: 181 of 198 route-substitution overrides sit inside the fallback windows, and 17 do not.",
    "Then show the blank cell. The worksheet is prepared with the inherent scores carried forward and the residual cells empty. That is the correct shape and it is the whole ethic of the product.",
  ],
  durationSeconds: 115,
  stageNote:
    "Left: a delta list with ten collapsed unchanged rows and one expanded. Right: the five by five grid with a three-point movement trail crossing the appetite line.",
  transitionOut:
    "The workbench closes and the workshop table assembles around the contested rating, with the established facts already on it.",
  audienceQuestions: [
    {
      question: "How do you know ten risks are unchanged rather than unexamined?",
      answer:
        "Because unchanged is computed, not assumed. Each of the ten is checked for material change against its own drivers, and the check is listed. If a driver moved and the position did not, the row is flagged rather than collapsed.",
    },
    {
      question: "Is the movement trail not just a prettier heat map?",
      answer:
        "The difference is the driver on the segment and the bracket on the disagreement. Where the two lines disagree, this draws two nodes joined by a bracket with the appetite line between them. Most tools cannot draw that, which is why disagreements get resolved by dilution.",
    },
    {
      question: "Who owns the delta if the system produced it?",
      answer:
        "The facilitator. She accepted the structure and she carries the reasoning into the room. In this scenario she also finds out later that her rating was right and her reason was incomplete, which we show rather than hide.",
    },
  ],
  scenarioClock: "08:45 CET",
  momentId: "M03",
  roleFocus: "rcsa",
  showsSyntheticDataLabel: true,
  content: {
    assessmentId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    assessmentLabel:
      "Risk and Control Self Assessment, Payment Operations, Arcadia Bank AG",
    cycleLabel: "Quarterly cycle, Q4 2026. Sign-off required by 16.10.2026.",
    facilitator: "Marlene Aigner, 2LoD facilitator",
    assessmentOwner: "Andreas Kellner, 1LoD assessment owner",
    changes: [
      {
        id: "chg-control-environment",
        subject: "RSK-0211 control environment rating",
        previousState: "Effective, signed 08.07.2026 for Q3",
        currentState:
          "Contested. 1LoD holds Effective; 2LoD proposes Partially Effective.",
        driver:
          "Control test TST-2026-0318: population 1,204 overrides, sample 60, four exceptions, two items on which the tester could not conclude.",
        evidenceRef: "TST-2026-0318 report, 25.09.2026",
        factClass: "VF",
      },
      {
        id: "chg-residual-position",
        subject: "RSK-0211 residual score",
        previousState: "6 of 25, Medium-Low, within appetite",
        currentState:
          "Two proposed positions: 9 of 25 from 1LoD, 12 of 25 from 2LoD, with the appetite boundary at 10.",
        driver:
          "The control environment rating, plus reviewer capacity at 75.0% of approved establishment.",
        evidenceRef: "RSK-0211 Q3 assessment and both Q4 positions",
        factClass: "VF",
      },
      {
        id: "chg-override-components",
        subject: "Override volume composition, Arcadia Bank AG",
        previousState: "412 overrides in August 2026",
        currentState:
          "731 overrides in September 2026. Route substitution grew from 31 to 198, cut-off driven release from 94 to 211, and the other three components moved by 10% or less.",
        driver:
          "Five gateway fallback activations totalling 8 hours 40 minutes in September, against one hour in August.",
        evidenceRef: "August and September override extracts, reconciled to SYS-0011",
        factClass: "TI",
        inferenceLimit:
          "Override records carry no field linking them to a specific activation, so the attribution rests on temporal correlation. 181 of 198 route-substitution overrides fall inside the five activation windows; 17 do not.",
      },
      {
        id: "chg-reviewer-capacity",
        subject: "Secondary reviewer capacity",
        previousState: "Four of four approved positions filled, to 31.07.2026",
        currentState:
          "3.0 of 4.0 approved FTE, 75.0%, red since 01.08.2026. Position PR-SR-02 vacant after the incumbent resigned.",
        driver:
          "MSN-2026-0166 recruitment, overdue 6 days, approved 12.08.2026, two candidate rejections, no start date.",
        evidenceRef: "Position record PR-SR-02, KRI-PAY-011 readings",
        factClass: "VF",
      },
      {
        id: "chg-overdue-remediation",
        subject: "Segregation of duties remediation",
        previousState: "In progress against a revised due date of 31.07.2026",
        currentState:
          "67 days past the revised due date, 60% complete. The supplier change request reached pre-production on 18.09.2026 and Arcadia acceptance testing is unscheduled because the payment test environment refresh is blocked by a change freeze running to 14.10.2026.",
        driver:
          "One exception in the control test, dated 14.07.2026, is exactly the failure this action prevents. It occurred 17 days before the revised due date.",
        evidenceRef: "MSN-2026-0147, with EVD-2026-41102 and EVD-2026-41205",
        factClass: "VF",
      },
    ],
    unchangedCount: {
      value: "10 of 11",
      label: "Risks in scope with no material change this cycle",
      basis: "measured-in-simulation",
      note: "Each checked against its own drivers; the check is listed per risk",
    },
    blankCellStatement:
      "The prepared residual worksheet carries the inherent scores forward and leaves every residual cell empty. A worksheet that arrives with a residual score filled in has taken the assessment away from the assessor.",
    todayComparison:
      "Today she builds the pivot table by hand if the morning allows it, reads two compensating control descriptions in twenty minutes she had allocated elsewhere, and writes her residual reasoning into a Word pre-read.",
  },
};

const scene10: Scene<"workshop-table", WorkshopTableContent> = {
  id: "meeting-for-judgment",
  sceneNumber: 10,
  visualKind: "workshop-table",
  chapter: "one-professional-day",
  title: "The meeting is for judgment, not evidence exchange.",
  subtitle:
    "10:30 workshop. The four established facts are on the table before anyone speaks, so the argument starts where it matters.",
  keyMessage:
    "When the facts are agreed in advance, ninety minutes buys a real disagreement instead of twenty-five minutes of reconciliation.",
  presenterNotes: [
    "Contrast the two openings directly. Today: 25 minutes establishing what the test found, because the control owner and the process owner have read the report differently. Here: the four facts are loaded as facts.",
    "Read the contested question exactly. Can two detective compensating controls substitute for one preventive control rated Partially Effective.",
    "Give both positions their strongest form. The first line argument is not weak, and presenting it weakly would be dishonest and unpersuasive.",
    "Then read the system limitation aloud: it has characterised the three controls and cannot resolve the question, because the question is about sufficiency. Both positions are internally consistent.",
    "Note the structural choice: the contested risk is third on the agenda, not first, so the room reaches it with momentum rather than spending ninety minutes on it.",
  ],
  durationSeconds: 115,
  stageNote:
    "A table with four fact cards laid flat and agreed, and two position columns rising on either side of a single contested question.",
  transitionOut:
    "The two columns resolve into two nodes on the risk grid, joined by a bracket, and the rating scene begins.",
  audienceQuestions: [
    {
      question: "What if the first line disputes one of your established facts?",
      answer:
        "Then it is not an established fact and it moves into the contested column with both positions attributed. The category exists to be challenged. In this scenario the control owner made three assertions in the morning and two of the three were confirmed correct, which is shown rather than smoothed over.",
    },
    {
      question: "Does the system write the minutes?",
      answer:
        "It records the discussion with both positions attributed, and the facilitator releases it. The important change is not the minute. It is that the ten uncontested risk positions are recorded as the workshop passes them, so the last fifteen minutes are not spent nodding through ten risks.",
    },
    {
      question: "Is this not just better pre-reading?",
      answer:
        "Better pre-reading that nobody has read changes nothing. The difference is that the facts are in the room as objects with evidence attached, so a participant who has not read the pre-read still starts from the same picture.",
    },
  ],
  scenarioClock: "10:30 CET",
  momentId: "M05",
  roleFocus: "rcsa",
  showsSyntheticDataLabel: true,
  content: {
    meetingLabel: "RCSA-ARC-DE-PAYOPS-2026-Q4 workshop",
    timeLabel: "10:30 to 12:00 CET, Munich and video",
    attendees: [
      "Marlene Aigner, 2LoD facilitator",
      "Andreas Kellner, Head of Payment Operations, process owner",
      "Beatrix Hofmann, Payment Repair Team Lead, control owner",
      "Elif Demir, Senior Payment Repair Analyst, acting Duty Manager",
      "Jakob Steinbacher, Control Assurance, observer from 11:15",
      "Four unnamed team leads",
    ],
    establishedFacts: [
      {
        statement:
          "The test population was 1,204 manual overrides across three entities for the period 01.06.2026 to 31.08.2026, with a statistical attribute sample of 60.",
        evidenceRef: "TST-2026-0318, fieldwork 07.09.2026 to 24.09.2026",
        factClass: "VF",
      },
      {
        statement:
          "Fifty-four samples showed no deviation, four were exceptions, and on two the tester could not conclude.",
        evidenceRef: "TST-2026-0318 attribute matrix, 60 rows by 5 attributes",
        factClass: "VF",
      },
      {
        statement:
          "Two deviation rates follow: 6.67% counting the exceptions alone, and 10.00% treating the unable-to-conclude items as deviations. The tolerable rate is 5%.",
        evidenceRef: "TST-2026-0318 conclusion",
        factClass: "VF",
      },
      {
        statement:
          "CTL-PAY-014 is the only preventive control mapped to RSK-0211. CTL-PAY-021 is detective, next business day and 10% sampled. CTL-PAY-029 reconciles value rather than authorisation.",
        evidenceRef: "Control descriptions, parsed and characterised",
        factClass: "VF",
      },
    ],
    contestedQuestion:
      "Can two detective compensating controls substitute for one preventive control rated Partially Effective?",
    positions: [
      {
        holder: "Beatrix Hofmann and Andreas Kellner",
        line: "1LoD",
        position: "Control environment Effective. Residual 9 of 25, Medium, within appetite.",
        reasoning: [
          "The four exceptions caused no financial loss and all four payments were subsequently confirmed correct by the clients.",
          "Two compensating controls operate: next-day sampling by the Duty Manager, and daily payment value reconciliation.",
          "The reviewer vacancy is being recruited, so the capacity pressure is temporary.",
          "The team followed the documented process in every case.",
        ],
      },
      {
        holder: "Marlene Aigner, with Jakob Steinbacher from 11:15",
        line: "2LoD",
        position:
          "Control environment Partially Effective. Residual 12 of 25, Medium-High, outside appetite.",
        reasoning: [
          "The only preventive control on this risk is Partially Effective, and a detective control cannot prevent a release.",
          "The next-day sample covers 10% and operates after the payment has left.",
          "The value reconciliation would pass a correctly valued payment sent to the wrong beneficiary, which is the failure mode that matters here.",
          "The reviewer vacancy has no start date, so the pressure is not evidently temporary.",
          "Two of the six flagged items cannot be concluded at all, so the true deviation rate is unknown rather than 6.67%.",
        ],
      },
    ],
    systemCannotResolve:
      "The residual gap between 9 and 12 turns on one question: whether two detective compensating controls can substitute for a Partially Effective preventive control. The system has characterised the three controls and cannot resolve the question, because it is a judgment about sufficiency. Both positions are internally consistent.",
    todayComparison:
      "Today the workshop spends its first 25 minutes establishing what the control test found, reaches the contested risk at 11:20 with 40 minutes left and a room that has already decided, and nods through the other ten risks in the final fifteen minutes.",
    minutesNote:
      "The ten uncontested positions are recorded as the workshop passes them, each released by the facilitator, so the closing minutes are available for the risk that needed them.",
  },
};

const scene11: Scene<"dual-position-matrix", DualPositionMatrixContent> = {
  id: "human-owns-the-rating",
  sceneNumber: 11,
  visualKind: "dual-position-matrix",
  chapter: "one-professional-day",
  title: "The human owns the rating.",
  subtitle:
    "11:58. No agreed rating, a recorded dissent, and an escalation with both positions stated in their owners terms.",
  keyMessage:
    "The system prepares the position and records the outcome. It does not move the node, and a disagreement is allowed to stay a disagreement.",
  presenterNotes: [
    "This is the scene that earns the right to everything else. Slow down.",
    "The grid does not move when evidence arrives. Evidence changes the argument; a human changes the rating.",
    "Read the itemised list of what the system declined to do. No pre-selection, no drafted rationale, no averaging of the two positions.",
    "The outcome at 11:58 is a dissent, not a resolution. She loses a resolved workshop and buys the committee a real decision.",
    "Then the honest coda: at 16:41 the two lines sign one sharper conclusion, Partially Effective with a design deficiency and an operating deficiency, and the residual moves to Medium-High by agreement rather than by escalation. That supersedes the 11:58 record, and the product shows it as a supersession with history, not as a correction.",
    "Say plainly: the first line was right about her team and wrong about the system. The second line reached the right conclusion and had missed the root cause four weeks earlier. Neither of them lost.",
  ],
  durationSeconds: 115,
  stageNote:
    "Five by five grid with two nodes joined by a bracket, the appetite line drawn between them with the policy sentence attached, and a faint inherent-to-residual vector per position.",
  transitionOut:
    "The bracket holds, the clock jumps to 14:05, and a supplier notification lands in the corner of the frame.",
  audienceQuestions: [
    {
      question: "Would the system not have been more useful if it had recommended a rating?",
      answer:
        "More useful in the moment and less defensible afterwards. A recommended residual rating that a person signs is a rubber stamp carrying a signature, and it is the one output that would make the second line indefensible in front of an auditor.",
    },
    {
      question: "How do you prevent quiet dilution of a disagreement?",
      answer:
        "By making the disagreement a first-class object. Two nodes, one bracket, both owners, both dates, and no average. The product cannot collapse them, so the only way to resolve it is for the two owners to agree a sharper statement, which is what happens at 16:41.",
    },
    {
      question: "What does the audit trail actually record at this point?",
      answer:
        "The decision identifier, the maker, the authority basis, the facts relied on with their classifications, the options considered, whether it is reversible, and the review trigger. The 11:58 dissent stays in the history with a pointer to the 16:41 record that supersedes it.",
    },
  ],
  scenarioClock: "11:58 CET",
  momentId: "M06",
  roleFocus: "rcsa",
  showsSyntheticDataLabel: true,
  content: {
    riskId: "RSK-0211",
    riskLabel: "Erroneous or unauthorised payment release",
    riskLabelDe: "Fehlerhafte oder unautorisierte Zahlungsfreigabe",
    inherent: { impact: 4, likelihood: 3, score: 12, band: "High" },
    positions: [
      {
        label: "Q3 2026, signed",
        holder: "Andreas Kellner, signed 08.07.2026",
        impact: 3,
        likelihood: 2,
        score: 6,
        band: "Medium-Low",
        appetitePosition: "within-appetite",
        consequence: "No consequence required.",
      },
      {
        label: "Q4 2026, 1LoD position",
        holder: "Andreas Kellner and Beatrix Hofmann",
        impact: 3,
        likelihood: 3,
        score: 9,
        band: "Medium",
        appetitePosition: "within-appetite",
        consequence: "Monitoring.",
      },
      {
        label: "Q4 2026, 2LoD proposal",
        holder: "Marlene Aigner, pre-read 02.10.2026",
        impact: 4,
        likelihood: 3,
        score: 12,
        band: "Medium-High",
        appetitePosition: "outside-appetite",
        consequence:
          "A remediation plan with committed dates, or a documented Risikoakzeptanz approved by the entity Chief Operating Officer and noted by the Group NFR Committee.",
      },
    ],
    appetiteBoundary: {
      threshold: 10,
      policySentence:
        "A residual score of 10 or above on a payment execution risk sits outside appetite and requires either an approved remediation plan with committed dates or a documented Risk Acceptance / Risikoakzeptanz.",
      entityAuthority:
        "Approved by the entity Chief Operating Officer and noted by the Group NFR Committee.",
    },
    systemPrepared: [
      "Three positions assembled side by side with the appetite boundary drawn at 10 and the consequence text for each side of it.",
      "Each trail segment carrying its driver as an openable object rather than a caption.",
      "The three mapped controls characterised: one preventive and Partially Effective, one detective at 10% next business day, one reconciling value rather than authorisation.",
      "The loss history retrieved with the detection-effectiveness caveat attached to it.",
      "A residual worksheet with the inherent scores carried forward and every residual cell empty.",
      "A dissent record structure holding both positions with no adjudication.",
    ],
    systemDeclined: [
      "Proposing a residual score, or highlighting one of the two as more likely.",
      "Averaging 9 and 12, or presenting a range as though it were a position.",
      "Drafting the rationale before the facilitator had formed one.",
      "Moving the node when new evidence arrived during the day.",
      "Resolving the sufficiency question, which is the judgment the role exists to make.",
    ],
    outcome: {
      decisionId: "DEC-2026-0772",
      timeLabel: "11:58 CET",
      statement:
        "The residual rating remains unagreed. A formal 2LoD dissent is recorded with both positions stated in their owners terms, and the item is escalated to the Group NFR Committee.",
      signedBy: ["Marlene Aigner, 2LoD", "Andreas Kellner, 1LoD"],
      supersedes:
        "Superseded at 16:41 by DEC-2026-0783: Control Effectiveness Partially Effective, with a design deficiency shared with the supplier and an operating deficiency covering three human deviations. Both lines sign, and the residual moves to Medium-High by agreement. Shown as a supersession with history, not as a correction.",
    },
    recordedAttributes: [
      "Decision identifier and scenario timestamp",
      "Decision maker, and the authority basis relied on",
      "Facts relied on, each with its classification",
      "Options considered, without a ranking",
      "Reversibility, and the trigger that would reopen it",
      "System of record, entity partition and record identifier for the write",
    ],
  },
};

/* ==========================================================================
   Chapter IV: One event, six questions
   ========================================================================== */

const scene12: Scene<"event-fan-out", EventFanOutContent> = {
  id: "one-event-every-function",
  sceneNumber: 12,
  visualKind: "event-fan-out",
  chapter: "one-event-six-questions",
  title: "One event reaches every NFR function.",
  subtitle:
    "14:05. A supplier notification says no customer impact. Two minutes later Arcadia telemetry disagrees.",
  keyMessage:
    "Facts arrive late, incomplete and in conflict, and the decisions cannot wait for them.",
  presenterNotes: [
    "Read the first notification verbatim, including the phrase no customer impact. Then show the telemetry that contradicts it two minutes later.",
    "Establish the sequence carefully: the technical start was 13:31, the supplier notified at 14:05, Arcadia detected at 14:07. A 34 minute detection gap.",
    "The fallback activation at 14:12 is a correct decision, taken inside the Duty Manager authority, under the runbook. Nobody bypassed anything.",
    "Then the rule. One configuration line, introduced from a supplier template in a release on 11.11.2024, waives secondary review for route-substitution overrides under EUR 250,000 while fallback mode is active.",
    "Land the numbers: 138 overrides created in 14 minutes, 96 with no review required, EUR 9,420,880, all individually under the threshold.",
    "Close on the repeat: this same rule appeared in the September control test as one exception, classified as system configuration, and closed with a documentation action that had not been started. The finding existed 41 days earlier.",
  ],
  durationSeconds: 135,
  stageNote:
    "A vertical time spine from 13:31 to 16:30 with arrivals docking left and right, each carrying its classification chip; three entity lanes run underneath as consumed-tolerance bars.",
  transitionOut:
    "The spine stays fixed and the frame splits into six panels, one per function, each reading the same arrival differently.",
  audienceQuestions: [
    {
      question: "Is the supplier the villain here?",
      answer:
        "No, and that is the uncomfortable part. The supplier notification was wrong and late. But the rule sat in the Arcadia tenant, it entered through an Arcadia change approval, the control description had not been updated in twenty months, and the same finding was closed as a configuration curiosity six weeks earlier. The hardest question of the day is about Arcadia follow-up discipline.",
    },
    {
      question: "Would your system have caught this before the event?",
      answer:
        "It surfaced the pieces at 07:45: the component growth, the capacity, the control conclusion, the overdue action, and the runbook assertion that contradicts the control inventory. It had not read the supplier tenant configuration, because that needed a formal request under the audit and access clause, which a human made at 15:38. So the honest answer is that it would have made the question obvious and it would not have had the answer.",
    },
    {
      question: "Ninety-six payments with no four-eyes check. Is that a regulatory breach?",
      answer:
        "We do not make that call and the product does not either. It states what the internal tolerance says, which is a zero tolerance on releases with an unsatisfied mandatory gate, that there are 96 candidate breaches against it, and that the assessment is owned by named people with a committee destination. Illustrative regulatory context, not legal advice.",
    },
  ],
  scenarioClock: "14:05 CET",
  momentId: "M08",
  showsSyntheticDataLabel: true,
  regulatoryNote: REGULATORY_LABEL,
  regulatoryScope: "both-lanes-separately",
  content: {
    incidentId: "INC-2026-0412",
    incidentTitle:
      "Supplier regional service degradation affecting payment validation, repair and Swiss clearing",
    technicalStart: "13:31, database cluster quorum loss in the Frankfurt region",
    supplierNotifiedAt: "14:05:12",
    arcadiaDetectedAt: "14:07, by telemetry alert",
    detectionGap: {
      value: "34 minutes",
      label: "From technical start to Arcadia detection",
      basis: "measured-in-simulation",
      note: "Caused by a monitoring subprocessor pinned to the failed region until 14:57",
    },
    severityPath: [
      "Incident raised 14:29 at severity S3",
      "S2 at 14:52",
      "S1 at 15:14, on two grounds: an impact tolerance within 40 minutes of its limit, and a zero-tolerance control condition with 96 candidate breaches",
      "Not closed on 06.10.2026. Open pending the supplier report due 13.10.2026.",
    ],
    firstNotification: {
      quote:
        "Degraded performance affecting clearing submission in the DACH region. Investigation ongoing. Severity P3. No customer impact identified at this time.",
      missingFields:
        "Five of the six mandatory notification fields under the incident appendix are absent: disruption start time, affected entities, severity mapping to the Arcadia scale, initial impact assessment and next update time.",
      evidenceRef: "EVD-2026-41871, received 14:05:12",
    },
    arrivals: [
      {
        id: "ARR-01",
        timeLabel: "14:05",
        factClass: "SS",
        source: "Supplier service notification, shared mailbox and client portal",
        content:
          "Degraded performance in the DACH region, severity P3, no customer impact identified at this time.",
        objectsTouched: ["TP-0042", "SVC-0042-01", "CTR-2023-0117-A5", "IBS-0004"],
      },
      {
        id: "ARR-02",
        timeLabel: "14:07",
        factClass: "TI",
        source: "Payment hub monitoring, alert ALRT-2026-77412",
        content:
          "Submission acknowledgement latency rose from a seven-day median of 1.4 seconds to 42 seconds from 13:38. Timeouts began at 13:51. 2,317 instructions await acknowledgement.",
        inferenceLimit:
          "Latency is measured at the Arcadia edge. An Arcadia network path problem, a firewall change or a name resolution issue would produce the same signature, so supplier-side and path-side degradation cannot be distinguished from this metric alone.",
        objectsTouched: ["SYS-0011", "SYS-0012", "ITOL-0004-01"],
      },
      {
        id: "ARR-03",
        timeLabel: "14:12",
        factClass: "VF",
        source: "Repair workbench configuration audit log, change record CHG-2026-7741",
        content:
          "The acting Duty Manager invoked runbook RB-PAY-007 and set fallback route mode active for the German and Austrian repair queues at 14:12:41. Clearing submission switched to the Arcadia direct link, which performs no payment data validation. The decision was correct under the runbook and inside her authority.",
        objectsTouched: ["PRC-0041", "SYS-0013", "RD-RULE-0031", "CTL-PAY-014", "RB-PAY-007"],
      },
      {
        id: "ARR-04",
        timeLabel: "14:26",
        factClass: "TI",
        source: "Repair queue telemetry",
        content:
          "German queue depth rose from 61 items at 14:12 to 494 at 14:26. 138 route-substitution overrides were created between 14:12:41 and 14:26:00, against a normal full-day figure of approximately 33 overrides of all types.",
        inferenceLimit:
          "A large corporate bulk file submitted at 14:10 would produce a similar spike. The inference has not yet been tested against the file submission log.",
        objectsTouched: ["PRC-0041", "KRI-PAY-007", "KRI-PAY-003"],
      },
      {
        id: "ARR-05",
        timeLabel: "14:34",
        factClass: "TI",
        source: "Override audit log query QRY-2026-88104",
        content:
          "Of the 138 overrides, 96 carry secondary review required false and a null reviewer identity. Combined value EUR 9,420,880, each below EUR 250,000. Split 78 German at EUR 7,611,240 and 18 Austrian at EUR 1,809,640. The remaining 42 required review: 29 reviewed and released, 13 awaiting review.",
        inferenceLimit:
          "An absent reviewer identity at query time is not proof that no review occurred. If the workbench writes reviewer identity asynchronously, the field would be empty now and populated later, and Arcadia does not know how the field is written.",
        reclassifiedTo: { factClass: "VF", timeLabel: "15:38", byArrival: "ARR-12" },
        objectsTouched: ["CTL-PAY-014", "RD-RULE-0031", "ITOL-0004-04", "RSK-0211"],
      },
      {
        id: "ARR-06",
        timeLabel: "14:41",
        factClass: "SS",
        source: "Beatrix Hofmann, control owner, on the incident bridge, recorded",
        content:
          "Every override goes through four-eyes. The log is lagging. The workbench backfills reviewer identities at the end of the batch cycle. There is no bypass. My team does not release payments without review.",
        objectsTouched: ["CTL-PAY-014"],
      },
      {
        id: "ARR-07",
        timeLabel: "14:48",
        factClass: "SS",
        source: "Miriam Falk, Client Service Director, supplier, on the bridge, recorded",
        content:
          "The workbench does not backfill reviewer identities. The field is written at the moment of review submission. If the field is empty, no review was submitted. The four-eyes requirement for route-substitution overrides is configured in the client tenant, not by us.",
        objectsTouched: ["CTL-PAY-014", "RD-RULE-0031", "TP-0042"],
      },
      {
        id: "ARR-10",
        timeLabel: "15:09",
        factClass: "VF",
        source: "Sibylle Graf, Swiss entity, with the payment queue export EVD-2026-41882",
        content:
          "Swiss clearing submission has been queued since 13:47. 1,842 instructions, CHF 61,304,110, of which CHF 18,712,400 carry same-day value against a 16:00 cut-off. No fallback route exists for the Swiss entity. The only option is manual submission through a correspondent bank with a 45 minute preparation lead time.",
        objectsTouched: ["ITOL-0004-03", "SVC-0042-05", "RB-PAY-011"],
      },
      {
        id: "ARR-12",
        timeLabel: "15:38",
        factClass: "VF",
        source:
          "Supplier tenant configuration export, provided on formal request under the audit and access appendix. Evidence EVD-2026-41905.",
        content:
          "Rule RD-RULE-0031 exists in the Arcadia production tenant. Where the override reason is route substitution, fallback mode is active, the value is below EUR 250,000 and the currency is EUR, secondary review required is set to false with a business continuity throughput waiver code. Introduced in a supplier release on 11.11.2024 from a standard configuration template, not requested by Arcadia. It has fired 118 times in total, 96 of them today.",
        objectsTouched: [
          "RD-RULE-0031",
          "CTL-PAY-014",
          "CHG-2024-5512",
          "TST-2026-0318",
          "MSN-2026-0203",
        ],
      },
      {
        id: "ARR-14",
        timeLabel: "15:51",
        factClass: "VF",
        source: "Subprocessor incident summary, forwarded by the supplier. EVD-2026-41911.",
        content:
          "The Frankfurt database cluster lost quorum at 13:31 after a storage firmware update applied in a maintenance window that was not notified to Arcadia. Failover to Amsterdam completed at 13:44. The monitoring pipeline stayed pinned to the failed Frankfurt endpoint until 14:57, because its connection string was statically configured rather than using the failover alias.",
        objectsTouched: ["TP-0042.2", "TP-0042.3", "KRI-RES-005", "RSK-0184"],
      },
      {
        id: "ARR-15",
        timeLabel: "16:04",
        factClass: "VF",
        source: "Correspondent confirmation CONF-2026-9931. EVD-2026-41918.",
        content:
          "1,840 of 1,842 Swiss instructions accepted, CHF 61,289,910. Submitted 15:52, accepted 15:58, two minutes inside the 16:00 cut-off. Two instructions totalling CHF 14,200 rejected on format grounds and rolled to the next value date.",
        objectsTouched: ["ITOL-0004-03", "ITOL-0004-02", "REG-2026-0104"],
      },
      {
        id: "ARR-17",
        timeLabel: "16:19",
        factClass: "TI",
        source:
          "Post-event validation by the payment repair team at the request of Control Assurance. EVD-2026-41924.",
        content:
          "A 20 case sample of the 96 unreviewed overrides was re-checked against the client static data master and the original instructions. Nineteen were correctly repaired. One was not: EUR 38,400 released with an incorrect beneficiary intermediary institution, accepted by the clearing system and routed to the wrong intermediary. The payment is recallable and a recall was initiated at 16:24.",
        inferenceLimit:
          "Twenty of 96 is a 21% sample, not stratified by value or by failure reason. The single error sits on the most error-prone repair type, which is 31% of repair items, so a stratified sample would likely give a different rate. The honest statement is one confirmed error, an unknown number of further errors, and a full check of all 96 cases required.",
        objectsTouched: ["RSK-0211", "CTL-PAY-014", "ITOL-0004-04", "MSN-2026-0214"],
      },
    ],
    entityLanes: [
      {
        entityLabel: "Arcadia Bank AG",
        entityCode: "ARC-DE",
        toleranceId: "ITOL-0004-01",
        toleranceStatement:
          "Maximum tolerable disruption to same-day EUR payment submission is 4 hours during a business day.",
        disruptionStart: "13:38",
        toleranceLimit: "17:38",
        fallbackOption: "RB-PAY-007 clearing route substitution",
        fallbackLeadTime: "Invoked at 14:12, short lead time, already consumed",
        frameworkContext:
          "EU entity. Illustrative regulatory context, not legal advice.",
      },
      {
        entityLabel: "Arcadia Bank Oesterreich AG",
        entityCode: "ARC-AT",
        toleranceId: "ITOL-0004-01",
        toleranceStatement:
          "Maximum tolerable disruption to same-day EUR payment submission is 4 hours during a business day.",
        disruptionStart: "13:38",
        toleranceLimit: "17:38",
        fallbackOption: "RB-PAY-007 clearing route substitution",
        fallbackLeadTime: "Invoked at 14:12 alongside the German queue",
        frameworkContext:
          "EU entity. Illustrative regulatory context, not legal advice.",
      },
      {
        entityLabel: "Arcadia Bank Schweiz AG",
        entityCode: "ARC-CH",
        toleranceId: "ITOL-0004-03",
        toleranceStatement:
          "Maximum tolerable disruption to CHF and euroSIC submission is 2 hours, and submission completes before the 16:00 CET same-day cut-off. Two measures, no stated precedence.",
        disruptionStart: "13:47",
        toleranceLimit: "15:47",
        cutOff: "16:00 CET",
        runway: "38 minutes at 15:09",
        fallbackOption:
          "RB-PAY-011 manual submission through a correspondent bank. No direct clearing participant link exists.",
        fallbackLeadTime:
          "45 minutes of preparation, which is longer than the runway. The decision cannot wait and then act.",
        frameworkContext:
          "Swiss entity, FINMA supervised. The EU digital operational resilience framework does not apply to this entity. Illustrative regulatory context, not legal advice.",
      },
    ],
    ruleStatement:
      "One configuration line, applied from a supplier standard template during a release on 11.11.2024, waives independent secondary review for route-substitution overrides under EUR 250,000 while the fallback route is active. It sits in the Arcadia tenant and an Arcadia administrator can edit it. The control description says review applies to all overrides without exception, and it has not been updated since 14.01.2025.",
    repeatStatement:
      "This rule already appeared in the September control test as one exception, recorded with the root cause system configuration, closed with a low-priority documentation action that had not been started. The finding existed 41 days before the event, and the rule had fired 22 times before today.",
  },
};

const scene13: Scene<"six-lens-grid", SixLensGridContent> = {
  id: "same-event-different-question",
  sceneNumber: 13,
  visualKind: "six-lens-grid",
  chapter: "one-event-six-questions",
  title: "Same event. Different professional question.",
  subtitle:
    "Six functions read the same arrivals. Each one asks a question the other five do not ask.",
  keyMessage:
    "Shared facts, separate professional judgments, and each function carries its own uncomfortable finding.",
  presenterNotes: [
    "Go round the six panels in order and read only the question and the output. Resist elaborating.",
    "Include the uncomfortable finding per role. Every one of the six discovers something about their own method, and that is what makes the scene credible rather than promotional.",
    "The three conflicts that resolve, resolve on evidence and at a stated time. Name the evidence.",
    "Then the fourth conflict, which does not resolve. The Swiss tolerance has two measures, one satisfied and one exceeded, with no stated precedence, so the entity cannot state whether it breached its own tolerance.",
    "Say why that is the most valuable finding of the day and worth more than the incident. Then say that a working day which resolves every question is not a credible working day.",
  ],
  durationSeconds: 135,
  stageNote:
    "Six panels around the fixed event spine; selecting a panel expands its question, its first arrival and its output while the other five stay legible as context.",
  transitionOut:
    "The six panels converge into a single thread, and the portfolio lead view opens on the committee deadline.",
  audienceQuestions: [
    {
      question: "Six panels looks like six silos with better graphics.",
      answer:
        "The panels share one fact base with one classification scheme, so a statement cannot be a fact in one panel and an assertion in another. What is separate is the judgment, and it is separate because the decision rights are separate. Merging the judgments is the failure mode, not the goal.",
    },
    {
      question: "Why show the tolerance question as unresolved rather than answering it?",
      answer:
        "Because it genuinely is unresolved. One measure was satisfied at 15:58 and the other was exceeded at 2 hours 11 minutes against 2 hours, and the record sets no precedence. Answering it would require choosing a measure, which is a committee decision with a named owner and a dated destination.",
    },
    {
      question: "Are you saying our framework would have the same defect?",
      answer:
        "We have no basis to say that about your framework. What we would say is that a tolerance with more than one measure and no stated precedence is a defect worth looking for, and that it is cheap to find and cheap to fix before an event rather than during one.",
    },
  ],
  scenarioClock: "15:00 to 16:30 CET",
  momentId: "M09",
  showsSyntheticDataLabel: true,
  regulatoryNote: REGULATORY_LABEL,
  regulatoryScope: "both-lanes-separately",
  content: {
    sharedEvent:
      "INC-2026-0412, eighteen information arrivals between 14:05 and 16:30, one shared fact base, one classification scheme.",
    lenses: [
      {
        roleSlug: "tprm",
        person: "Stefan Brunner",
        firstArrival:
          "14:05, the notification itself, read as a contractual notice failure before it is an incident",
        question:
          "Was the thing that saved us even in the contract, and was the thing that failed supposed to be able to fail?",
        output:
          "Four assurance failures rather than service failures: a notification missing five of six mandatory fields, an unnotified supplier maintenance window, a single point of failure in the supplier detection capability, and release notes that did not disclose a control waiver.",
        ownedRecord:
          "MSN-2026-0217 on the unnotified change window, MSN-2026-0218 on the detection dependency, MSN-2026-0221 escalating the notice failures as a formal contractual notice.",
        ownUncomfortableFinding:
          "Nothing about his concentration position changed. He rated this Tier 1, sole provider, exit untested before today. Today he can evidence it, which is a change in evidence and not in judgment.",
      },
      {
        roleSlug: "rcsa",
        person: "Marlene Aigner",
        firstArrival:
          "14:34, the 96 unreviewed overrides, read as her own risk showing its likelihood",
        question:
          "Is this a new risk, or the risk I already have finally showing its likelihood, and was my assessment wrong in a way that matters?",
        output:
          "Not a new risk and not a new likelihood. The mechanism existed since 11.11.2024 and fired 22 times before today, so the likelihood was higher than assessed and Arcadia had not observed it. Her rating of 12 stands and the reasoning in her pre-read needs rewriting before the paper goes to committee.",
        ownedRecord:
          "The RSK-0211 residual position, and the rewritten reasoning behind it.",
        ownUncomfortableFinding:
          "The morning component analysis was itself the leading indicator. Every September fallback activation was a rehearsal and each one waived the control for its duration. She had the signal and read it as a capacity story.",
      },
      {
        roleSlug: "control-assurance",
        person: "Jakob Steinbacher",
        firstArrival:
          "14:34, which is his own September exception happening 96 times with a value attached",
        question:
          "Did my test have the coverage to have found this, and if not, what else does my method not see?",
        output:
          "His conclusion was right and under-argued, because his design testing compared the control description to the operation rather than to the implemented configuration. His population was bounded by time while the rule is bounded by condition, so a condition-bounded population would have caught all 22 prior firings.",
        ownedRecord:
          "MSN-2026-0220, re-running the test with the population extended to every fallback period since 11.11.2024, covering all 118 firings.",
        ownUncomfortableFinding:
          "He has to say publicly that the control owner was partly right. Her team bypassed nothing, and for the 96 cases the deficiency is design, shared with the supplier. Conceding that while holding the operating deficiency for the three human deviations is a better outcome than winning.",
      },
      {
        roleSlug: "incident-resilience",
        person: "Nadia Lehmann",
        firstArrival:
          "15:09, the Swiss queue with 38 minutes of runway and a 45 minute fallback",
        question:
          "How much time do I have, per entity, and does the arrangement I am relying on hold while I use it?",
        output:
          "The fallback held: payments cleared, the EU entities stayed well inside tolerance, and the Swiss tranche made the cut-off with two minutes to spare. The framework around the fallback did not hold. Activating the resilience arrangement switched off a key preventive control for 3 hours 56 minutes, and the runbook asserts in writing that the control environment is unchanged during fallback operation.",
        ownedRecord:
          "MSN-2026-0216 amending the runbook assertion, MSN-2026-0219 resolving the two-measure ambiguity, and the provisional incident classification per entity.",
        ownUncomfortableFinding:
          "Her dependency map reached the supplier and stopped. The 34 minute detection lag came from a monitoring subprocessor two levels down, pinned to a failed endpoint by a static connection string. Every notification commitment in her framework rested on a node her map did not contain.",
      },
      {
        roleSlug: "regulatory-change",
        person: "Tobias Reinhardt",
        firstArrival:
          "14:55, the moment a registry completeness gap becomes a live operational fact",
        question:
          "Which obligations did today touch, in which jurisdiction, and does anything we have already stated need to change?",
        output:
          "Four obligation states changed, in two separate jurisdictional lanes, at different times, with different consequences. For the EU entities this is a subcontracting and register question. For the Swiss entity it is an inventory and data access question. Same supplier, same day, two separate obligations, two separate assessments. Illustrative regulatory context, not legal advice.",
        ownedRecord:
          "Two provisional classification assessments kept as two records rather than one, and a single comment on the draft internal resilience standard filed at 16:47.",
        ownUncomfortableFinding:
          "At 07:45 he judged the missing precedence requirement in the draft standard too weak to raise without a concrete case. At 16:04 he got the case with 17 days of consultation window left. The luckiest timing of the day, and the most valuable thing he does is the comment nobody will notice.",
      },
      {
        roleSlug: "nfr-governance",
        person: "Dr. Katharina Vogt",
        firstArrival:
          "15:14, the severity upgrade, read as a governance problem rather than an operational one",
        question:
          "What decision does this group need, who can take it, and can it be taken on the facts that exist at the deadline?",
        output:
          "A decision deadline colliding with a fact arrival schedule. Papers close 08.10.2026 at 12:00 and the supplier root-cause report is due on the morning of the meeting. So the paper is written on verified facts as at the deadline and asks a question the supplier report cannot invalidate.",
        ownedRecord:
          "DEC-2026-0781 and the new committee agenda item added at 16:20.",
        ownUncomfortableFinding:
          "A zero-tolerance condition in her own framework had no monitoring capable of detecting a breach. The 96 candidate breaches were found by an ad hoc query at 14:34, not by a control. That is a framework defect and it is hers.",
      },
    ],
    conflictsResolved: [
      "Did the workbench backfill reviewer identity, and did 96 payments go unreviewed. Opened 14:48, resolved 15:38 by the tenant configuration export. The supplier was correct on the mechanism, the control owner was correct that no human bypassed anything, and the rule waived the control. Accountability shared.",
      "Is the root cause known, and what is affected. Opened 15:02, resolved 15:51 by the subprocessor incident summary. Both statements were honest and both were incomplete, and the real finding is a 34 minute detection lag.",
      "Was there customer impact. Opened 14:07 against the first notification, resolved 16:19 by accumulated verified facts. There was: 1,842 Swiss instructions queued, two rolled to the next value date, and one confirmed misrouted payment of EUR 38,400.",
    ],
    conflictUnresolved: {
      id: "Conflict D",
      subject:
        "Was the Swiss impact tolerance breached? Measure one was satisfied at 15:58, two minutes inside the cut-off. Measure two was exceeded, at 2 hours 11 minutes against a 2 hour limit. The record states no precedence between them.",
      owner: "Nadia Lehmann, with Sibylle Graf for the Swiss entity",
      destination:
        "Committee agenda item AG-CMT-NFR-2026-10-08, the impact tolerance review",
      whyItStaysOpen:
        "Resolving it means choosing which measure governs, which is a committee decision on tolerance definition precedence. The product shows an open question with a named owner and a destination rather than a fabricated answer. A day that resolves every question is not a credible day.",
    },
  },
};

const scene14: Scene<"portfolio-decision-thread", PortfolioDecisionThreadContent> = {
  id: "leadership-one-decision-thread",
  sceneNumber: 14,
  visualKind: "portfolio-decision-thread",
  chapter: "one-event-six-questions",
  title: "Leadership sees one decision thread, not six reports.",
  subtitle:
    "16:30. Four red indicators and one event resolve into one chain with one root and one answerable question.",
  keyMessage:
    "A committee can act on one causal thread with its inferences marked. It has not acted on four red rows in four quarters.",
  presenterNotes: [
    "Draw the chain node by node and name each object. Seven nodes, six links.",
    "Then mark the two inferred links, out loud. Presenting the chain as established would be more persuasive and less defensible.",
    "The constraint is the scene: papers close Thursday at noon, the supplier report arrives on the morning of the meeting, and a late paper cannot carry a decision.",
    "Read the reframed committee question. Not what caused this, which the supplier report answers. Instead: does the group accept that a supplier-configurable rule can waive a key control in the internal control system without an Arcadia control owner review, and what change does that require.",
    "That question is answerable on Thursday facts and stays answerable whatever arrives on the following Tuesday. That is the craft.",
    "Close on her two findings about her own machinery, including the zero-tolerance condition with no detection.",
  ],
  durationSeconds: 115,
  stageNote:
    "A seven-node horizontal chain with four solid links and two dashed; a committee readiness strip runs beneath with a fact-arrival marker sitting after the papers deadline.",
  transitionOut:
    "The thread condenses into a single question chip, which rises into the authority ladder.",
  audienceQuestions: [
    {
      question: "Is the causal chain an AI conclusion we would have to defend?",
      answer:
        "It is a hypothesis with six links, four evidenced and two inferred, and it is labelled that way on the slide the committee sees. What the chair is asked to accept is the question it frames, not the chain as established fact. If the chair rejects the inferred links, the question still stands.",
    },
    {
      question: "Would our committee not simply ask for the supplier report first?",
      answer:
        "It might, and that would cost a quarter. The point of the reframing is that the decision on whether a supplier-configurable rule may waive a key control does not depend on the root cause of one database failure. Separating those two questions is the governance work.",
    },
    {
      question: "How does this differ from a good pack written by a good secretary?",
      answer:
        "In this scenario the difference is that the chain, the readiness state per agenda item and the fact-arrival dependency are computed rather than remembered, including the flag that one decision item depends on a fact that will not exist at the deadline. A good secretary knows that. A good secretary on leave does not hand it over.",
    },
  ],
  scenarioClock: "16:30 CET",
  momentId: "M10",
  roleFocus: "nfr-governance",
  showsSyntheticDataLabel: true,
  regulatoryNote: REGULATORY_LABEL,
  regulatoryScope: "both-lanes-separately",
  content: {
    person: "Dr. Katharina Vogt",
    roleLabel: "NFR Portfolio Lead and committee secretary",
    clockLabel: "16:30 CET",
    thread: [
      {
        order: 1,
        label: "Supplier gateway availability deteriorated through September",
        objectRef: "SVC-0042-01, five fallback activations totalling 8 hours 40 minutes",
        linkBasis: "evidenced",
      },
      {
        order: 2,
        label: "Route-substitution overrides grew more than sixfold",
        objectRef: "OVR-C, 31 in August to 198 in September",
        linkBasis: "inferred",
        confirmationNeeded:
          "Override records carry no activation identifier. 181 of 198 fall inside the five windows and 17 do not. A linking field on the override record would confirm it.",
      },
      {
        order: 3,
        label: "The manual override indicator breached red for the first time in 14 months",
        objectRef: "KRI-PAY-007, 3.84 against a 3.50 threshold",
        linkBasis: "evidenced",
      },
      {
        order: 4,
        label: "Secondary reviewer capacity sits at 75% of approved establishment",
        objectRef: "KRI-PAY-011, position PR-SR-02 vacant since 31.07.2026",
        linkBasis: "inferred",
        confirmationNeeded:
          "No recorded evidence connects the vacancy to any specific deviation. A deviation-level attribution of reviewer workload would confirm it.",
      },
      {
        order: 5,
        label: "The only preventive control on the risk is Partially Effective",
        objectRef: "CTL-PAY-014, test TST-2026-0318",
        linkBasis: "evidenced",
      },
      {
        order: 6,
        label: "The remediation that would have prevented one exception is 67 days overdue",
        objectRef: "MSN-2026-0147, revised due 31.07.2026",
        linkBasis: "evidenced",
      },
      {
        order: 7,
        label: "The risk sits outside appetite, and has now materialised once",
        objectRef: "RSK-0211, residual 12 of 25, one confirmed erroneous release of EUR 38,400",
        linkBasis: "evidenced",
      },
    ],
    evidencedLinks: {
      value: "4 of 6",
      label: "Links in the chain supported by a recorded relationship",
      basis: "measured-in-simulation",
    },
    inferredLinks: {
      value: "2 of 6",
      label: "Links that are inferential, with the confirming evidence named",
      basis: "measured-in-simulation",
      note: "Marked on the committee slide, not smoothed into the chain",
    },
    constraint: {
      papersClose: "Thursday 08.10.2026 at 12:00 CET. A late paper carries no decision.",
      supplierReportDue:
        "Tuesday 13.10.2026, the morning of the committee, five business days after the event.",
      committeeDate: "Tuesday 13.10.2026, 14:00 to 16:30 CET",
      problem:
        "A decision paper has to be written on an event whose supplier account arrives after the deadline and before the meeting. Asking for a decision on incomplete facts, or asking for nothing and losing a quarter.",
    },
    decision: {
      id: "DEC-2026-0781",
      timeLabel: "16:20 CET",
      statement:
        "Write the paper on verified facts as at 08.10.2026, state explicitly which facts are verified, which are stakeholder statements and which are telemetry inferences, and add a new agenda item.",
      committeeQuestion:
        "Does the group accept that a supplier-configurable rule can waive a key control in the Internal Control System / Internes Kontrollsystem without an Arcadia control owner review, and what change does that require?",
      whyItHolds:
        "The question is answerable on the facts available at the deadline and stays answerable whatever the supplier report says, because it is about the group control over supplier configuration rather than about the cause of one database failure.",
    },
    frameworkDefectsOwnedHere: [
      "A zero-tolerance condition with no monitoring capable of detecting a breach. The 96 candidate breaches were found by an ad hoc query at 14:34, not by a control.",
      "A divergence that resolved without her, and better than either option she was weighing at 07:45. Holding a disagreement open for nine hours was the correct governance act and it looks like inaction.",
      "An active conditional Risk Acceptance / Risikoakzeptanz on the adjacent supplier risk whose condition, an exit test, has not been met and has no plan to be met.",
    ],
    todayComparison:
      "Today she opens a dashboard with four reds in four rows owned by four people, counts three of five decision items undrafted in a spreadsheet, calculates the 67 days herself, and does not read the condition status of a live risk acceptance because it sits in a free-text field.",
  },
};

/* ==========================================================================
   Chapter V: Authority and adoption
   ========================================================================== */

const scene15: Scene<"authority-ladder", AuthorityLadderContent> = {
  id: "autonomy-earned-action-by-action",
  sceneNumber: 15,
  visualKind: "authority-ladder",
  chapter: "authority-and-adoption",
  title: "Autonomy is earned action by action.",
  subtitle:
    "Six positions, from retrieval to policy-bound action, with a hand back that is available at every one of them.",
  keyMessage:
    "The permission boundary is a deterministic gate outside the model, so an instruction in a document cannot talk its way past it.",
  presenterNotes: [
    "Climb the ladder one step at a time and give each step a worked example from today.",
    "The gate is not a prompt. It is a registry: a tool not in the registry cannot be called, which is why the registry and not the prompt is the security boundary.",
    "Three conditions have to hold together before any change executes: the level can reach the authority class, the acting role holds the scope, and where required a valid unconsumed approval exists that is bound to that exact payload.",
    "Say the payload binding plainly: an approval for a small change does not transfer to a larger one, because the approval is bound to a fingerprint of the payload.",
    "Raising the level does not make a material change free. A material change is gated at every level, including the most permissive.",
    "Then the refusals. Sending external mail, contacting a supervisory authority, editing the audit trail, and an agent approving its own proposal are refused by design, so that refusal is explicit and testable rather than assumed.",
    "Close on hand back. It is the sixth position and it is available from all five others, because lane four produces no automated action.",
  ],
  durationSeconds: 115,
  stageNote:
    "Six stacked authority bands; selecting a band lights the authority classes it can reach and dims the rest, with the hand-back band rendered as a rail running across all five.",
  transitionOut:
    "The ladder tips forward into six phases and the closing ask appears.",
  audienceQuestions: [
    {
      question: "Who sets the autonomy level, and can a user raise it themselves?",
      answer:
        "In this prototype it is a visible control with a stated effect, so an audience can see the difference. In a deployment it is a governance setting owned by the function that owns the control environment, and the level change itself is an audited event. Raising it still cannot make a material change unapproved.",
    },
    {
      question: "What stops prompt injection from a supplier document?",
      answer:
        "The gate does not read free text. It evaluates the tool name, the authority class, the role scopes and the approval, all structured values. A sentence inside a supplier PDF can ask for anything it likes; it cannot add a tool to the registry or grant an approval.",
    },
    {
      question: "How do you evidence any of this to an auditor?",
      answer:
        "Every write names five things: the system of record, the entity partition, the record identifier, the accountable human and the evidence reference. A write missing any of the five is rejected rather than logged as a warning. The audit trail is append-only and modification is a refused action.",
    },
    {
      question: "Realistically, where would a bank start on this ladder?",
      answer:
        "At the first two positions, which is what phase two of the roadmap is. Retrieval and preparation, no writes at all. Everything above that is earned by evidence from the level below it, function by function, not switched on at a programme level.",
    },
  ],
  showsSyntheticDataLabel: true,
  content: {
    earnedNote:
      "Each position is earned by evidence from the one below it, per function rather than per programme. The ladder is a governance object, not a settings screen.",
    steps: [
      {
        id: "assist",
        order: 1,
        label: "Assist",
        labelDe: "Unterstuetzen",
        permits:
          "Retrieve evidence and answer questions with provenance on every claim.",
        withholds: "No drafting of official records and no change to any record.",
        reachableClasses: ["Read"],
        scenarioExample:
          "Retrieve CTR-2023-0117-A3 v4.2 as the binding appendix version, with its 14.02.2025 date and its retrieval path.",
      },
      {
        id: "prepare",
        order: 2,
        label: "Prepare",
        labelDe: "Vorbereiten",
        permits:
          "Draft records and prepare challenge questions, grounded in cited evidence.",
        withholds: "No change to any record, and no recommendation.",
        reachableClasses: ["Read", "Draft"],
        scenarioExample:
          "Prepare the residual assessment worksheet with the inherent scores carried forward and every residual cell empty.",
      },
      {
        id: "recommend",
        order: 3,
        label: "Recommend",
        labelDe: "Empfehlen",
        permits:
          "Propose a position with supporting and opposing evidence and stated uncertainty.",
        withholds:
          "No change to any record, no pre-selection, and no ranking of the options.",
        reachableClasses: ["Read", "Draft", "Propose"],
        scenarioExample:
          "Propose a control effectiveness position on CTL-PAY-014 with the evidence on both sides, leaving the conclusion to the assurance owner.",
      },
      {
        id: "act-with-approval",
        order: 4,
        label: "Act with approval",
        labelDe: "Handeln nach Genehmigung",
        permits:
          "Prepare a change, pause, and execute only after a named person approves that exact payload.",
        withholds:
          "Nothing executes without an approval bound to the payload, and an agent identity cannot be the approver.",
        reachableClasses: ["Read", "Draft", "Propose", "Approval required"],
        scenarioExample:
          "Create MSN-2026-0214, the full check of all 96 unreviewed overrides with a 07.10.2026 12:00 deadline, after the assurance owner approves it.",
      },
      {
        id: "act-within-policy",
        order: 5,
        label: "Act within policy",
        labelDe: "Handeln im Rahmen der Richtlinie",
        permits:
          "Execute low risk, reversible, routine actions without a separate approval.",
        withholds:
          "Material changes remain gated at this level. Raising the level does not make a material change free.",
        reachableClasses: [
          "Read",
          "Draft",
          "Propose",
          "Approval required",
          "Policy-bound autonomous",
        ],
        scenarioExample:
          "Send a simulated factual validation request to the payment repair team. Reversible, low consequence, and it reaches no real recipient.",
      },
      {
        id: "hand-back-to-human",
        order: 6,
        label: "Hand back to human",
        labelDe: "Rueckgabe an den Menschen",
        permits:
          "Stop, state what is known and what is not, and return the decision with the record structure prepared and blank.",
        withholds:
          "No proposed answer, no default, and no drafted rationale. Available from every other position.",
        reachableClasses: [],
        scenarioExample:
          "The RSK-0211 residual rating, and the Swiss tolerance precedence question, which is returned as an open question with a named owner and a committee destination.",
      },
    ],
    invariants: [
      "Three conditions hold together before a change executes: the level reaches the authority class, the acting role holds every required scope, and where the class demands it a valid unconsumed approval exists.",
      "An approval is bound to a fingerprint of the payload, so approval for one change does not transfer to a different one.",
      "An approval is consumed once. Replay is refused.",
      "The approver confirms they own the rationale before a material change executes.",
      "A material change requires approval at every level, including the most permissive.",
      "A tool absent from the registry cannot be called. The registry, not the prompt, is the boundary.",
      "Lane 4 judgment produces no automated action, and the action ledger rejects a lane 4 row.",
    ],
    refusedByDesign: [
      "Sending mail outside the environment.",
      "Contacting a supervisory authority. The product records a recommendation and notifies nobody.",
      "Writing to the database outside the typed tools.",
      "Reading credential material.",
      "Modifying the audit trail, which is append-only.",
      "An agent approving its own proposal. Approval requires a named person.",
    ],
    mandatoryWriteAttributes: [
      "The system of record the change lands in",
      "The entity partition it belongs to",
      "The record identifier being changed",
      "The accountable human who released it",
      "The evidence reference supporting it",
    ],
  },
};

const scene16: Scene<"phase-roadmap", PhaseRoadmapContent> = {
  id: "prove-one-day-then-scale",
  sceneNumber: 16,
  visualKind: "phase-roadmap",
  chapter: "authority-and-adoption",
  title: "Prove one working day. Then scale the work environment.",
  subtitle:
    "Six phases. The first two write nothing, and each phase is proved by an artefact rather than by a status report.",
  keyMessage:
    "Start by running one day on your own control, supplier and indicator set, and judge the idea on what it produces.",
  presenterNotes: [
    "Give the phases in order and keep each to two sentences. The audience has had a dense half hour.",
    "Phases one and two write nothing at all. Say that early, because it removes the largest objection.",
    "Every phase has a proof point that is an artefact, not a milestone. A work inventory, a morning brief, a prepared draft, a released write, a redesigned population definition, an operating model.",
    "Phase five is the one most programmes skip. Redesigning the work is where the value is: a population bounded by condition rather than by period, a runbook that states control effects, a tolerance with a stated precedence.",
    "Durations are client input required. We have no basis to assert them and we do not.",
    "Close on the ask: one day, your data, your control, your supplier, your indicators. Then decide.",
  ],
  durationSeconds: 115,
  stageNote:
    "Six phases as a left-to-right progression, each with a lane badge and a proof-point chip; a read-only marker spans the first two phases.",
  transitionOut:
    "Return to the converged decision object from the cover, now labelled with the client name placeholder and the single ask.",
  audienceQuestions: [
    {
      question: "How long does phase one take?",
      answer:
        "We do not know and we would rather say so. It depends on how many functions you run, how many entities, and how much of your work inventory already exists. It is a scoping conversation, not a number on a slide.",
    },
    {
      question: "What would make you tell us not to do this?",
      answer:
        "Three things. If your evidence is not retrievable with a version and a date, the Understand lane has nothing to stand on. If your systems of record cannot accept an attributed write, the Execute lane cannot close the loop. And if your functions do not agree on the object model, the shared lanes are not shared and this becomes six products.",
    },
    {
      question: "What does phase two actually deliver if it writes nothing?",
      answer:
        "The morning brief and the evidence layer for one function on one real day. It is read-only, so it is cheap to govern, and it is the phase that tells you whether the ranking and the provenance are good enough to trust. If they are not, you stop there and you have spent very little.",
    },
    {
      question: "Why start with one day rather than a pilot function?",
      answer:
        "Because a day is the unit a professional recognises and a quarter is not. One day, end to end, with an event in the middle, tests the ranking, the evidence, the handoffs and the write path at once. A function pilot without a day tests the tooling and not the work.",
    },
  ],
  showsSyntheticDataLabel: true,
  content: {
    phases: [
      {
        phaseNumber: 1,
        name: "Role and work discovery",
        outcome:
          "The five lanes mapped against your own roles, entities and systems of record, with the work inventory written down rather than assumed.",
        proofPoint:
          "A work inventory per role: which activities sit in which lane, which objects they touch, and which decisions are reserved to a person.",
        prerequisite:
          "Named owners for each function, and access to the current process and control inventory.",
        lanes: ["Organise", "Understand", "Assess", "Decide", "Execute"],
        indicativeDuration: {
          value: "Scoped with you",
          label: "Duration",
          basis: "client-input-required",
        },
        risk:
          "A work inventory that records the documented process rather than the actual one. The mitigation is to derive behaviour from event logs where they exist.",
      },
      {
        phaseNumber: 2,
        name: "Read-only personal work layer",
        outcome:
          "The morning brief and the evidence layer for one function, on one real working day, writing nothing to any system of record.",
        proofPoint:
          "A ranked decision brief a practitioner recognises, with provenance on every claim and a stated limitation on every inference.",
        prerequisite:
          "Retrievable evidence with a version and a date, and read access to the indicator and action inventory.",
        lanes: ["Organise", "Understand"],
        indicativeDuration: {
          value: "Scoped with you",
          label: "Duration",
          basis: "client-input-required",
        },
        risk:
          "A brief that is impressive and wrong. The mitigation is that it writes nothing, so a wrong brief costs credibility and not a record.",
      },
      {
        phaseNumber: 3,
        name: "Specialist evidence production",
        outcome:
          "Function-specific preparation: the workbench opens on a formed picture, with the conclusion cell left empty.",
        proofPoint:
          "A prepared draft per function that the professional accepts, edits or rejects, with every override recorded against their name.",
        prerequisite:
          "An agreed sufficiency taxonomy per function, since what makes an artefact good enough differs by role.",
        lanes: ["Understand", "Assess"],
        indicativeDuration: {
          value: "Scoped with you",
          label: "Duration",
          basis: "client-input-required",
        },
        risk:
          "A draft so complete that acceptance becomes reflexive. The mitigation is the empty conclusion cell and a recorded override rate.",
      },
      {
        phaseNumber: 4,
        name: "Approval-gated execution",
        outcome:
          "Writes into the systems of record, each carrying the five mandatory attributes, each released by a named person against a specific payload.",
        proofPoint:
          "An append-only audit trail an internal auditor can follow from a decision back to its evidence without asking anyone a question.",
        prerequisite:
          "A write interface into the GRC platform that accepts attribution, and an agreed approval route per action type.",
        lanes: ["Execute"],
        indicativeDuration: {
          value: "Scoped with you",
          label: "Duration",
          basis: "client-input-required",
        },
        risk:
          "Approval fatigue, which turns a gate into a formality. The mitigation is to keep policy-bound autonomous actions genuinely low consequence and reversible.",
      },
      {
        phaseNumber: 5,
        name: "Process redesign",
        outcome:
          "Change the work, not only the tooling. Test populations bounded by condition rather than by period, runbooks that state their control effects, tolerances with a stated precedence.",
        proofPoint:
          "At least one framework defect found and fixed before an event rather than during one.",
        prerequisite:
          "Evidence from phases two to four that the picture is trustworthy enough to redesign against.",
        lanes: ["Assess", "Decide"],
        indicativeDuration: {
          value: "Scoped with you",
          label: "Duration",
          basis: "client-input-required",
        },
        risk:
          "Redesigning the easy artefacts and leaving the tolerance definitions alone, which is where the highest-value defects sit.",
      },
      {
        phaseNumber: 6,
        name: "Scaled operating model",
        outcome:
          "Six functions across the entities you operate, with the authority model as a governed object and the autonomy position set per function.",
        proofPoint:
          "A handoff that works without an email: an open item in one function visibly blocking a deadline in another, with the dependency computed.",
        prerequisite:
          "The shared lanes demonstrably shared. If they are not, this is six products and the plan changes.",
        lanes: ["Organise", "Understand", "Assess", "Decide", "Execute"],
        indicativeDuration: {
          value: "Scoped with you",
          label: "Duration",
          basis: "client-input-required",
        },
        risk:
          "Scaling the tooling ahead of the operating model, which produces six configurations of a tool nobody owns.",
      },
    ],
    ask: "Run one working day on your own control, your own supplier and your own indicator set, and judge this on what that day produces.",
    proofDefinition: [
      "One control with a live disagreement between the first and second line.",
      "One Tier 1 supplier with an open assessment and at least one contract appendix you suspect is out of date.",
      "One indicator that breached recently and was explained rather than investigated.",
      "One remediation action that is overdue for a reason nobody has written down.",
      "One event from your own incident history, replayed as information arrivals with their classifications.",
    ],
    notClaimed: [
      "No time saving is asserted. We do not know how long your people take and asserting it would be an invented figure.",
      "No compliance claim is made. The product states what an obligation appears to require, what evidence exists, and what is missing.",
      "No external benchmark or peer comparison appears anywhere. Every quantity here is a scenario figure for a synthetic institution.",
      "No claim that judgment improves. The claim is that judgment arrives earlier, better briefed, and with its limitations stated.",
    ],
  },
};

/* ==========================================================================
   The story
   ========================================================================== */

export type StoryScene =
  | typeof scene01
  | typeof scene02
  | typeof scene03
  | typeof scene04
  | typeof scene05
  | typeof scene06
  | typeof scene07
  | typeof scene08
  | typeof scene09
  | typeof scene10
  | typeof scene11
  | typeof scene12
  | typeof scene13
  | typeof scene14
  | typeof scene15
  | typeof scene16;

/** Sixteen scenes, in presentation order. */
export const STORY_SCENES: StoryScene[] = [
  scene01,
  scene02,
  scene03,
  scene04,
  scene05,
  scene06,
  scene07,
  scene08,
  scene09,
  scene10,
  scene11,
  scene12,
  scene13,
  scene14,
  scene15,
  scene16,
];

/** Total speaking time, in seconds. 1,800 seconds is thirty minutes. */
export const STORY_TOTAL_SECONDS: number = STORY_SCENES.reduce(
  (total, scene) => total + scene.durationSeconds,
  0,
);

/** Total speaking time as a presenter-facing string. */
export function storyDurationLabel(): string {
  const minutes = Math.floor(STORY_TOTAL_SECONDS / 60);
  const seconds = STORY_TOTAL_SECONDS % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

/** One scene by its number, or undefined when the number is out of range. */
export function getSceneByNumber(sceneNumber: number): StoryScene | undefined {
  return STORY_SCENES.find((scene) => scene.sceneNumber === sceneNumber);
}

/** One scene by its stable identifier. */
export function getSceneById(id: string): StoryScene | undefined {
  return STORY_SCENES.find((scene) => scene.id === id);
}

/** Every scene in one chapter, in presentation order. */
export function getScenesByChapter(chapter: ChapterId): StoryScene[] {
  return STORY_SCENES.filter((scene) => scene.chapter === chapter);
}

/** One chapter by its identifier. */
export function getChapter(chapter: ChapterId): StoryChapter | undefined {
  return STORY_CHAPTERS.find((candidate) => candidate.id === chapter);
}

/** Seconds of speaking time per chapter, for the chapter rail. */
export function chapterDurations(): Array<{
  chapter: ChapterId;
  name: string;
  seconds: number;
}> {
  return STORY_CHAPTERS.map((chapter) => ({
    chapter: chapter.id,
    name: chapter.name,
    seconds: getScenesByChapter(chapter.id).reduce(
      (total, scene) => total + scene.durationSeconds,
      0,
    ),
  }));
}

/** Word count of a scene title or subtitle, for the copy audit gate. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
