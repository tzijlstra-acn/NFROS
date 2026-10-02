/**
 * Stage sequencing and timing.
 *
 * One visible state machine, three sources of truth about when it advances.
 * That is the whole design, and it is the acceptance criterion about live,
 * presenter safe and offline sharing a single contract: the interface cannot
 * tell which mode it is in from the shape of the progression, only from the
 * discreet source label.
 *
 *   live      transitions are recorded as the server actually reaches them.
 *             Nothing here delays a live request. A progress animation that
 *             costs real latency is a lie that the user pays for.
 *   safe      a recorded stage shape is replayed over cached validated output,
 *             so the pacing is a real measurement from when the beat was
 *             captured rather than an invented curve.
 *   offline   a seeded shape is replayed over seeded validated output.
 *
 * The 300ms floor exists for one specific failure. When cached content
 * resolves in under a millisecond the interface jumps from empty to complete,
 * which reads as a glitch rather than as work, and a reviewer reasonably
 * concludes that nothing happened. The floor applies to a replayed transition
 * only. It is never applied to a live request.
 */

import {
  AI_STAGE_LABELS,
  AI_STAGE_ORDER,
  type AIGenerationState,
} from "@/workday/contracts";

/** One recorded transition. Matches the `stages` column on `ai_suggestions`. */
export interface StageTransition {
  state: AIGenerationState;
  label: string;
  labelDe: string;
  /** Milliseconds after the start of the generation. */
  atMs: number;
}

/**
 * The minimum visible duration of a replayed transition.
 *
 * Deliberately a floor rather than a target. A recorded gap of 900ms replays
 * as 900ms; a recorded gap of 0ms replays as 300ms.
 */
export const MIN_TRANSITION_MS = 300;

/** Upper bound on any single replayed gap, so a slow capture cannot stall. */
export const MAX_TRANSITION_MS = 1_400;

export function stageLabel(state: AIGenerationState, language: "en" | "de"): string {
  const pair = AI_STAGE_LABELS[state];
  return language === "de" ? pair.de : pair.en;
}

function transition(state: AIGenerationState, atMs: number): StageTransition {
  return {
    state,
    label: AI_STAGE_LABELS[state].en,
    labelDe: AI_STAGE_LABELS[state].de,
    atMs,
  };
}

/**
 * The deterministic shape used by offline mode and by any beat with no
 * recorded timing.
 *
 * The gaps are not uniform on purpose. Retrieval and reconciliation are the
 * slow parts of this work in reality, and a believable shape is one whose
 * relative durations match where the time actually goes. A perfectly even
 * progression looks like a loading bar, which is what the product is trying
 * not to be.
 */
const SEEDED_GAPS_MS: Record<AIGenerationState, number> = {
  idle: 0,
  queued: 0,
  retrieving: 520,
  reconciling: 760,
  analysing: 640,
  drafting: 580,
  validating: 420,
  ready: 300,
  blocked: 300,
  error: 300,
};

/** The full seeded progression, as transitions with cumulative offsets. */
export function seededStageShape(): StageTransition[] {
  let cursor = 0;
  return AI_STAGE_ORDER.map((state) => {
    cursor += SEEDED_GAPS_MS[state];
    return transition(state, cursor);
  });
}

/**
 * The progression that stops short of publication.
 *
 * Used when a required source is still loading or has failed. The sequence
 * must not reach `ready`, because `isPublishableState` gates rendering on
 * exactly that value and a card that reached `ready` without a validated
 * recommendation would be published content built on a gap.
 */
export function heldStageShape(holdAt: "retrieving" | "reconciling"): StageTransition[] {
  const shape: StageTransition[] = [];
  let cursor = 0;
  for (const state of AI_STAGE_ORDER) {
    cursor += SEEDED_GAPS_MS[state];
    shape.push(transition(state, cursor));
    if (state === holdAt) break;
  }
  return shape;
}

/**
 * Records real progress for a live generation.
 *
 * `mark` is called as the server reaches each stage and stores the elapsed
 * time. No waiting happens here at all, which is the difference between
 * reporting progress and performing it.
 */
export class StageRecorder {
  private readonly startedMs: number;
  private readonly transitions: StageTransition[] = [];

  constructor(startedMs: number = Date.now()) {
    this.startedMs = startedMs;
  }

  mark(state: AIGenerationState): StageTransition {
    const entry = transition(state, Date.now() - this.startedMs);
    this.transitions.push(entry);
    return entry;
  }

  /** Transitions recorded so far, in order. */
  recorded(): StageTransition[] {
    return [...this.transitions];
  }

  completed(): AIGenerationState[] {
    return this.transitions.map((entry) => entry.state);
  }

  current(): AIGenerationState {
    return this.transitions[this.transitions.length - 1]?.state ?? "idle";
  }

  elapsedMs(): number {
    return Date.now() - this.startedMs;
  }
}

/**
 * Normalises a recorded shape for replay.
 *
 * Two corrections are applied. A gap below the floor is raised to it, which is
 * the anti-flash rule. A gap above the ceiling is clamped, because a beat
 * captured on a bad network should not make presenter safe mode slower than
 * the live mode it is standing in for.
 */
export function normaliseForReplay(stages: readonly StageTransition[]): StageTransition[] {
  if (stages.length === 0) return seededStageShape();

  const normalised: StageTransition[] = [];
  let previousAt = 0;
  let cursor = 0;

  for (const stage of stages) {
    const rawGap = Math.max(0, stage.atMs - previousAt);
    const gap = Math.min(Math.max(rawGap, MIN_TRANSITION_MS), MAX_TRANSITION_MS);
    previousAt = stage.atMs;
    cursor += gap;
    normalised.push({ ...stage, atMs: cursor });
  }

  return normalised;
}

/**
 * Replays a recorded shape, invoking `onStage` at each transition.
 *
 * `budgetMs` caps the whole replay. A presenter who clicks three objects in
 * quick succession should not accumulate a queue of animations, and a hard
 * budget is a simpler guarantee than per-stage arithmetic that has to be
 * reasoned about at the call site.
 */
export async function replayStages(
  stages: readonly StageTransition[],
  onStage: (stage: StageTransition, completed: AIGenerationState[]) => void,
  options: { budgetMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<AIGenerationState[]> {
  const budgetMs = options.budgetMs ?? 4_000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const shape = normaliseForReplay(stages);
  const completed: AIGenerationState[] = [];
  let elapsed = 0;
  let previousAt = 0;

  for (const stage of shape) {
    const gap = Math.max(0, stage.atMs - previousAt);
    previousAt = stage.atMs;
    const remaining = Math.max(0, budgetMs - elapsed);
    const wait = Math.min(gap, remaining);
    if (wait > 0) await sleep(wait);
    elapsed += wait;
    completed.push(stage.state);
    onStage(stage, [...completed]);
  }

  return completed;
}

/**
 * Checks that a progression is a legal walk of the state machine.
 *
 * Exported because the acceptance criterion is about all three modes
 * producing the same contract, and the only way to hold three independent
 * code paths to that is a shared predicate the tests and the verification
 * script both call.
 */
export function validateStageSequence(stages: readonly StageTransition[]): {
  ok: boolean;
  problems: string[];
} {
  const problems: string[] = [];

  if (stages.length === 0) {
    return { ok: false, problems: ["The progression is empty."] };
  }

  const first = stages[0];
  if (first && first.state !== "queued") {
    problems.push(`The progression starts at "${first.state}" rather than "queued".`);
  }

  let orderCursor = -1;
  let previousAt = -1;

  for (const stage of stages) {
    const position = AI_STAGE_ORDER.indexOf(stage.state);
    if (position === -1) {
      problems.push(`"${stage.state}" is not a member of the published stage order.`);
      continue;
    }
    if (position <= orderCursor) {
      problems.push(`"${stage.state}" repeats or moves backwards in the progression.`);
    }
    if (position > orderCursor + 1) {
      problems.push(
        `The progression skips from "${AI_STAGE_ORDER[orderCursor] ?? "start"}" to "${stage.state}".`,
      );
    }
    orderCursor = position;

    if (stage.atMs < previousAt) {
      problems.push(`"${stage.state}" is recorded earlier than the stage before it.`);
    }
    previousAt = stage.atMs;

    if (stage.label.length === 0 || stage.labelDe.length === 0) {
      problems.push(`"${stage.state}" carries an empty label in one language.`);
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * True when a progression reached publication.
 *
 * Separate from `validateStageSequence` because a held progression is legal
 * and must not be publishable. Conflating the two is how a constrained interim
 * view ends up rendered as a finished recommendation.
 */
export function reachedPublication(stages: readonly StageTransition[]): boolean {
  return stages.some((stage) => stage.state === "ready");
}
