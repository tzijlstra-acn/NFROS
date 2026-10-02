/**
 * The context a connector receives, and the two injected dependencies that
 * make the runtime testable.
 *
 * Time and jitter are parameters here rather than calls to `Date.now()` and
 * `Math.random()` inside the retry path. That is not stylistic. A backoff
 * schedule built from the ambient clock and a random jitter cannot be
 * asserted: the test either sleeps for the real delay, which makes the suite
 * slow and flaky, or it asserts a range, which means the test passes when the
 * schedule is wrong by a factor of two. With both injected, the retry test
 * states the exact millisecond of every attempt and fails if the policy
 * changes.
 *
 * Correlation and trace identifiers are also generated here, from a counter
 * plus the injected clock, so a seeded run produces a reproducible trace.
 */

/** The clock the runtime reads. Injected so tests can fix it. */
export interface IntegrationClock {
  /** ISO 8601 wall clock, written to `synced_at`, `created_at` and friends. */
  nowIso(): string;
  /** Milliseconds since the epoch, used for durations and backoff arithmetic. */
  nowMs(): number;
}

/** The real clock. The default everywhere outside a test. */
export const systemClock: IntegrationClock = {
  nowIso: () => new Date().toISOString(),
  nowMs: () => Date.now(),
};

/** A clock frozen at one instant. */
export function fixedClock(iso: string): IntegrationClock {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`fixedClock received an unparseable instant: ${iso}`);
  return { nowIso: () => new Date(ms).toISOString(), nowMs: () => ms };
}

/**
 * A clock the caller advances by hand.
 *
 * The retry tests use this so that "the second attempt is scheduled 2000ms
 * after the first" is a statement about the policy and not about how long the
 * test runner happened to take.
 */
export function manualClock(startIso: string): IntegrationClock & { advance(ms: number): void } {
  let ms = Date.parse(startIso);
  if (Number.isNaN(ms)) throw new Error(`manualClock received an unparseable instant: ${startIso}`);
  return {
    nowIso: () => new Date(ms).toISOString(),
    nowMs: () => ms,
    advance(delta: number) {
      ms += delta;
    },
  };
}

/**
 * The source of backoff jitter. Returns a value in [0, 1).
 *
 * Jitter exists so that a hundred commands failing against the same target do
 * not all retry in the same millisecond and recreate the overload that caused
 * the failure. It is injected so the schedule is reproducible.
 */
export interface JitterSource {
  next(): number;
}

/** Real jitter. */
export const randomJitter: JitterSource = { next: () => Math.random() };

/** No jitter at all. The delay is then exactly the exponential term. */
export const noJitter: JitterSource = { next: () => 0 };

/**
 * A deterministic jitter sequence.
 *
 * A small xorshift so the values vary between attempts, which is what jitter
 * is for, while remaining identical between runs, which is what a test needs.
 */
export function seededJitter(seed: number): JitterSource {
  let state = seed >>> 0 || 1;
  return {
    next() {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 0x1_0000_0000;
    },
  };
}

/**
 * Everything a connector is given for one operation.
 *
 * Note what is absent. There is no database handle, no credential, no
 * environment access and no user object. A connector reads the instance row it
 * was constructed with and the arguments of the call, and nothing else. That
 * is what makes "a connector cannot widen its own authority" a structural
 * statement rather than a convention.
 */
export interface ConnectorContext {
  runId: string;
  connectorInstanceId: string;
  /** Ties every row produced by one logical operation together. */
  correlationId: string;
  /** Ties one attempt, including its retries, to its log lines. */
  traceId: string;
  /** Scenario clock label, for example "14:05". */
  atMoment: string;
  clock: IntegrationClock;
  language: "en" | "de";
  /** Set when the caller can cancel. Connectors must honour it. */
  signal?: AbortSignal;
}

let correlationSequence = 0;
let traceSequence = 0;

/**
 * Monotonic identifiers.
 *
 * A millisecond timestamp alone collides: one inbound sync produces dozens of
 * mapped records inside the same millisecond, and the decision engine in this
 * product already hit exactly that bug with approval identifiers. The counter
 * is what actually guarantees uniqueness; the timestamp only makes the value
 * readable in a log.
 */
export function createCorrelationId(clock: IntegrationClock = systemClock, prefix = "COR"): string {
  correlationSequence += 1;
  return `${prefix}-${clock.nowMs().toString(36).toUpperCase()}-${String(correlationSequence).padStart(5, "0")}`;
}

export function createTraceId(clock: IntegrationClock = systemClock): string {
  traceSequence += 1;
  return `TRC-${clock.nowMs().toString(36).toUpperCase()}-${String(traceSequence).padStart(5, "0")}`;
}

/** Builds a context, filling in the identifiers the caller did not supply. */
export function createConnectorContext(input: {
  runId: string;
  connectorInstanceId: string;
  atMoment: string;
  correlationId?: string;
  traceId?: string;
  clock?: IntegrationClock;
  language?: "en" | "de";
  signal?: AbortSignal;
}): ConnectorContext {
  const clock = input.clock ?? systemClock;
  const context: ConnectorContext = {
    runId: input.runId,
    connectorInstanceId: input.connectorInstanceId,
    correlationId: input.correlationId ?? createCorrelationId(clock),
    traceId: input.traceId ?? createTraceId(clock),
    atMoment: input.atMoment,
    clock,
    language: input.language ?? "en",
  };
  // Assigned conditionally because the project compiles with a strict
  // optional property policy and an explicit `undefined` is not the same as
  // an absent key to a consumer doing `"signal" in context`.
  if (input.signal) context.signal = input.signal;
  return context;
}

/** Throws a cancellation if the caller has already aborted. */
export function throwIfCancelled(context: ConnectorContext): void {
  if (context.signal?.aborted) {
    throw new Error("The integration operation was cancelled before it reached the connector.");
  }
}
