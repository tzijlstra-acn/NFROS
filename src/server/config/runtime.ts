/**
 * Runtime configuration facade.
 *
 * One place that answers "what mode are we in, what models are resolved, and
 * is live AI actually available". Everything in the application reads this
 * rather than the environment directly, so a mode downgrade is visible in one
 * place instead of being recomputed inconsistently in three.
 *
 * Server only. The values exposed here are safe metadata; the key itself is
 * reachable only through `getOpenAIKeyForServerUse`.
 */

import {
  DEFAULT_DEMO_MODE,
  resolveDemoMode,
  type DemoMode,
  type DemoModeResolution,
} from "./demo-mode";
import { getOpenAIStatus, type OpenAIStatus } from "./load-openai-config";
import { getResolvedModels, type ResolvedModels } from "./models";

export interface RuntimeStatus {
  demoMode: DemoModeResolution;
  openai: OpenAIStatus;
  models: ResolvedModels;
  /** True when the application may make a real OpenAI call right now. */
  liveCallsPermitted: boolean;
}

let cachedMode: DemoModeResolution | null = null;

/**
 * The effective demo mode.
 *
 * A requested mode is downgraded rather than failed, and the downgrade reason
 * is carried so the control room can explain itself.
 */
export function getResolvedDemoMode(): DemoModeResolution {
  if (cachedMode === null) {
    const requested = process.env.NFR_DEMO_MODE ?? DEFAULT_DEMO_MODE;
    cachedMode = resolveDemoMode(requested, getOpenAIStatus().liveModeAvailable);
  }
  return cachedMode;
}

/** Overrides the mode for this process. Used by the mode selector. */
export function setResolvedDemoMode(mode: DemoMode): DemoModeResolution {
  cachedMode = resolveDemoMode(mode, getOpenAIStatus().liveModeAvailable);
  return cachedMode;
}

export function getRuntimeStatus(): RuntimeStatus {
  const demoMode = getResolvedDemoMode();
  const openai = getOpenAIStatus();
  const models = getResolvedModels();

  return {
    demoMode,
    openai,
    models,
    liveCallsPermitted: demoMode.mode !== "offline" && openai.liveModeAvailable,
  };
}

/**
 * What the key resolution means, in one sentence chosen from four.
 *
 * This used to be one fixed sentence, "A usable key was resolved from the
 * local source", returned whether or not a key had been resolved, so the
 * control room printed it next to "no key was resolved". The sentence is now
 * chosen from what is actually known: whether a key in the expected form was
 * found, and whether a live call in this process has been accepted or
 * rejected. Each sentence is fixed text with nothing interpolated, so none of
 * them can carry anything about the key itself: not its value, prefix, suffix
 * or length.
 */
export function describeKeyResolution(configured: boolean, verified: boolean | null): string {
  if (!configured) {
    return "No key was resolved from the local source, so live AI is not available. The Safe and Offline modes do not need one.";
  }
  if (verified === true) {
    return "A key was resolved from the local source, and the provider accepted a live call made with it in this process.";
  }
  if (verified === false) {
    return "A key was resolved from the local source, but the provider rejected the last live call made with it in this process. Check that the key is current.";
  }
  return "A key in the expected form was resolved from the local source. It has not been sent to the provider in this process, so it is not verified. Run npm run smoke:live to verify it.";
}

/**
 * Safe status for the health endpoint and the entry screen.
 *
 * Deliberately narrow. It reports whether a key was found and which file
 * supplied it, and nothing about the value: no prefix, no suffix, no length.
 */
export function getPublicHealth(): {
  status: "ok";
  mode: DemoMode;
  requestedMode: DemoMode;
  modeDowngraded: boolean;
  modeReason: string | null;
  liveAiConfigured: boolean;
  /** What `liveAiConfigured` does and does not mean. */
  liveAiConfiguredMeaning: string;
  /** Null until a call has actually been attempted. See `npm run smoke:live`. */
  liveAiVerified: boolean | null;
  configurationSource: string;
  configurationVariable: string | null;
  voiceAvailable: boolean;
} {
  const runtime = getRuntimeStatus();
  return {
    status: "ok",
    mode: runtime.demoMode.mode,
    requestedMode: runtime.demoMode.requested,
    modeDowngraded: runtime.demoMode.downgraded,
    modeReason: runtime.demoMode.reason ?? runtime.openai.reason ?? null,
    liveAiConfigured: runtime.openai.configured,
    /*
     * This distinction is not pedantry, it is the difference between two very
     * different situations on a demonstration day. A key can be present, well
     * formed and resolvable, and still be revoked, expired or wrong. Reporting
     * only "configured: true" would tell a presenter that live mode works when
     * it does not. The endpoint deliberately does not make a call to find out,
     * because a health check that spends money and adds latency every time it
     * is polled is the wrong trade; `npm run smoke:live` makes exactly one.
     */
    liveAiConfiguredMeaning: describeKeyResolution(runtime.openai.configured, lastVerification),
    liveAiVerified: lastVerification,
    configurationSource: runtime.openai.source,
    configurationVariable: runtime.openai.variableName,
    voiceAvailable: runtime.liveCallsPermitted && runtime.models.realtime !== null,
  };
}

/** Set once a real call has been attempted in this process. */
let lastVerification: boolean | null = null;

/** Records the outcome of a live call, so health can report verified status. */
export function recordLiveVerification(ok: boolean): void {
  lastVerification = ok;
}
