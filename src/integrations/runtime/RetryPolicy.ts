/**
 * Bounded retry, exponential backoff, timeout and cancellation.
 *
 * All four are here rather than spread through the dispatcher so that the
 * policy is one readable object and one pure function. The schedule is
 * computed from an injected clock and an injected jitter source, which is what
 * makes the retry test assert exact millisecond values rather than a range.
 *
 * The bound matters more than the backoff. An unbounded retry against a
 * target that is rejecting a malformed payload is not resilience, it is a loop
 * that hides a defect while filling the audit trail with identical failures.
 * `maxAttempts` is therefore not optional and `shouldRetry` consults the error
 * taxonomy before it consults the attempt count.
 */

import {
  noJitter,
  systemClock,
  type IntegrationClock,
  type JitterSource,
} from "@/integrations/core/ConnectorContext";
import { ConnectorError, toConnectorError } from "@/integrations/core/errors";

export interface RetryPolicy {
  /** Total attempts, including the first. Three means one try and two retries. */
  maxAttempts: number;
  /** Delay before attempt two, in milliseconds. */
  baseDelayMs: number;
  /** Ceiling on the exponential term, so attempt nine is not next week. */
  maxDelayMs: number;
  /**
   * Fraction of the computed delay that jitter may add, from 0 to 1.
   *
   * Additive rather than multiplicative in both directions: jitter never
   * shortens a delay. A jitter that could halve the backoff would let a wave
   * of retries reconverge on the target, which is the opposite of the point.
   */
  jitterRatio: number;
  /** Per attempt timeout. A target that never answers must not hold a request. */
  timeoutMs: number;
}

/**
 * The default policy for an external write.
 *
 * Three attempts and a two second base. Chosen so the failure proof is quick
 * to watch and the dead letter is reached deliberately rather than after a
 * minute of apparent hanging, and so the backoff is still long enough that a
 * genuinely rate limited target gets room.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 2_000,
  maxDelayMs: 60_000,
  jitterRatio: 0.2,
  timeoutMs: 10_000,
});

/** A policy for an inbound sync, which is cheaper to repeat than a write. */
export const SYNC_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 2,
  baseDelayMs: 1_000,
  maxDelayMs: 15_000,
  jitterRatio: 0.2,
  timeoutMs: 8_000,
});

/**
 * Milliseconds to wait before the attempt after `completedAttempt`.
 *
 * Pure. `completedAttempt` is one based, so the delay before attempt two is
 * computed from `completedAttempt = 1` and equals `baseDelayMs` plus jitter.
 * Clamped to `maxDelayMs` before jitter is added, so the ceiling is a ceiling
 * on the exponential term and the total can exceed it by the jitter fraction
 * at most.
 */
export function computeBackoffDelay(
  completedAttempt: number,
  policy: RetryPolicy,
  jitter: JitterSource = noJitter,
): number {
  if (completedAttempt < 1) return 0;
  const exponential = policy.baseDelayMs * 2 ** (completedAttempt - 1);
  const capped = Math.min(exponential, policy.maxDelayMs);
  const added = Math.floor(capped * policy.jitterRatio * jitter.next());
  return capped + added;
}

/**
 * The whole schedule, for documentation and for the retry test.
 *
 * Returning the full series lets a test state the policy in one assertion
 * instead of calling the delay function once per attempt and hoping it
 * covered the clamp.
 */
export function backoffSchedule(policy: RetryPolicy, jitter: JitterSource = noJitter): number[] {
  const delays: number[] = [];
  for (let attempt = 1; attempt < policy.maxAttempts; attempt += 1) {
    delays.push(computeBackoffDelay(attempt, policy, jitter));
  }
  return delays;
}

/** The instant the next attempt becomes due, as an ISO string, or null. */
export function nextAttemptAt(
  completedAttempt: number,
  policy: RetryPolicy,
  clock: IntegrationClock = systemClock,
  jitter: JitterSource = noJitter,
): string | null {
  if (completedAttempt >= policy.maxAttempts) return null;
  const delay = computeBackoffDelay(completedAttempt, policy, jitter);
  return new Date(clock.nowMs() + delay).toISOString();
}

export interface RetryDecision {
  retry: boolean;
  /** Why, in one clause, for the command's `last_error` and the dead letter. */
  reason: string;
  /** Null when no further attempt is due. */
  nextAttemptAt: string | null;
  attemptsRemaining: number;
}

/**
 * Whether to try again.
 *
 * Order is deliberate. A non retryable code stops immediately even on attempt
 * one, because retrying a rejected payload three times produces three
 * identical audit entries and delays the dead letter a person has to act on.
 */
export function shouldRetry(
  error: unknown,
  completedAttempt: number,
  policy: RetryPolicy,
  clock: IntegrationClock = systemClock,
  jitter: JitterSource = noJitter,
): RetryDecision {
  const connectorError = toConnectorError(error);
  const remaining = Math.max(0, policy.maxAttempts - completedAttempt);

  if (!connectorError.retryable) {
    return {
      retry: false,
      reason: `The failure "${connectorError.code}" is not resolved by retrying.`,
      nextAttemptAt: null,
      attemptsRemaining: 0,
    };
  }

  if (remaining === 0) {
    return {
      retry: false,
      reason: `All ${policy.maxAttempts} attempts were used.`,
      nextAttemptAt: null,
      attemptsRemaining: 0,
    };
  }

  return {
    retry: true,
    reason: `Attempt ${completedAttempt} failed with "${connectorError.code}". ${remaining} attempt(s) remain.`,
    nextAttemptAt: nextAttemptAt(completedAttempt, policy, clock, jitter),
    attemptsRemaining: remaining,
  };
}

/**
 * Runs one attempt under a timeout and an optional external cancellation.
 *
 * The timeout is a real timer, because a timeout has to be real to be useful:
 * a simulated one would let a connector that genuinely hangs hold the request
 * thread. Tests that need deterministic timing assert `computeBackoffDelay`
 * and `shouldRetry` instead, which is where the policy actually lives.
 *
 * The connector receives the derived signal. A connector that ignores it will
 * keep running after this function rejects, which is why the returned promise
 * rejects rather than resolving a sentinel: the caller must treat a timed out
 * attempt as unacknowledged, and an unacknowledged attempt writes no receipt.
 */
export async function runAttempt<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  policy: RetryPolicy,
  options: { signal?: AbortSignal; connectorInstanceId?: string } = {},
): Promise<T> {
  if (options.signal?.aborted) {
    throw new ConnectorError("cancelled", "The operation was cancelled before it started.", {
      connectorInstanceId: options.connectorInstanceId ?? null,
      detail: "cancelled before start",
    });
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ConnectorError(
          "timeout",
          `The target system did not answer within ${policy.timeoutMs}ms.`,
          {
            connectorInstanceId: options.connectorInstanceId ?? null,
            detail: `timeout after ${policy.timeoutMs}ms`,
          },
        ),
      );
    }, policy.timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer !== null) clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
