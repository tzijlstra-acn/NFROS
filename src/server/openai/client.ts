/**
 * OpenAI client factory.
 *
 * This is the only module that calls `getOpenAIKeyForServerUse`. Everything
 * else asks this module for a client, so there is exactly one place in the
 * codebase where the secret is read and exactly one place to audit.
 *
 * The client is never returned to a caller in offline mode, and the model
 * availability probe is what turns the documented preference list into a
 * resolved model set rather than a guess.
 */

import OpenAI from "openai";
import { setDefaultOpenAIClient, setTracingDisabled } from "@openai/agents";
import { getOpenAIKeyForServerUse, getOpenAIStatus } from "@/server/config/load-openai-config";
import { getResolvedDemoMode, recordLiveVerification } from "@/server/config/runtime";
import { resolveModels, setResolvedModels, type ResolvedModels } from "@/server/config/models";
import { createLogger, redactString } from "@/server/logging/redact";

const log = createLogger("openai-client");

let client: OpenAI | null = null;
let availabilityProbed = false;

/**
 * Returns a configured client, or null when live calls are not permitted.
 *
 * Returning null rather than throwing is deliberate: every call site has to
 * handle the offline and safe cases anyway, and a null check is harder to
 * forget than a try block.
 */
export function getOpenAIClient(): OpenAI | null {
  const mode = getResolvedDemoMode();
  if (mode.mode === "offline") return null;

  const status = getOpenAIStatus();
  if (!status.liveModeAvailable) return null;

  if (client === null) {
    const key = getOpenAIKeyForServerUse();
    if (key === null) return null;
    client = new OpenAI({
      apiKey: key,
      // A short timeout matters in a live demonstration: a hung request is
      // worse than a fallback to the cached beat.
      timeout: 60_000,
      maxRetries: 2,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    });

    /*
     * Hand the same client to the Agents SDK.
     *
     * This is not optional plumbing. The SDK constructs its own default client
     * and looks for the key in `process.env.OPENAI_API_KEY`, which is not
     * where this product's key lives: it is read at runtime from a file
     * outside the project and never exported into the environment. Without
     * this call every `run(manager, ...)` failed with "Missing credentials"
     * even when a perfectly good key had been resolved, and the failure was
     * invisible because the manager catches it and falls back to a seeded
     * response.
     *
     * Tracing export is disabled deliberately. The SDK would otherwise send
     * trace payloads to a hosted endpoint, and this product's traces contain
     * synthetic banking content that has no business leaving the machine.
     * Observability is served locally by the `agent_runs` and `tool_calls`
     * tables instead, which the control room reads.
     */
    setDefaultOpenAIClient(client);
    setTracingDisabled(true);
    log.info("The OpenAI client was configured and handed to the Agents SDK.", {
      tracingExport: "disabled",
    });
  }

  return client;
}

/**
 * Probes which models the account can use and resolves the model roles.
 *
 * Called once. On failure the resolution falls back to the first preference
 * per role and records that the availability was not verified, which the
 * control room displays honestly rather than implying it checked.
 */
export async function probeModelAvailability(): Promise<ResolvedModels> {
  if (availabilityProbed) {
    const { getResolvedModels } = await import("@/server/config/models");
    return getResolvedModels();
  }

  const openai = getOpenAIClient();
  if (!openai) {
    availabilityProbed = true;
    const resolved = resolveModels(null);
    setResolvedModels(resolved);
    return resolved;
  }

  try {
    const response = await openai.models.list();
    const available = new Set<string>();
    for await (const model of response) {
      available.add(model.id);
    }
    const resolved = resolveModels(available);
    setResolvedModels(resolved);
    availabilityProbed = true;
    log.info("Model availability probed.", {
      modelCount: available.size,
      primary: resolved.primary,
      fast: resolved.fast,
      realtime: resolved.realtime,
    });
    return resolved;
  } catch (error) {
    log.warn("Could not list account models. Falling back to the preference list.", { error });
    availabilityProbed = true;
    const resolved = resolveModels(null);
    setResolvedModels(resolved);
    return resolved;
  }
}

export interface SmokeTestResult {
  ok: boolean;
  /** Only safe metadata. Never any part of the key. */
  model: string | null;
  status: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  /** True when the response carried usable text, not merely a 200. */
  producedText: boolean;
  error?: string;
}

/**
 * Minimal live API smoke test.
 *
 * Records the model name, status, latency and token counts, and nothing else.
 * The prompt is deliberately trivial so the cost is negligible.
 */
export async function runLiveSmokeTest(): Promise<SmokeTestResult> {
  const startedAt = Date.now();
  const openai = getOpenAIClient();

  if (!openai) {
    return {
      ok: false,
      model: null,
      status: "not-configured",
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      producedText: false,
      error: "Live calls are not permitted in the current mode, or no key was resolved.",
    };
  }

  const models = await probeModelAvailability();

  try {
    /*
     * The budget is 256 tokens and the reasoning effort is low, and both
     * numbers are the fix for a real failure rather than arbitrary.
     *
     * This call originally asked for 16 output tokens, which is ample for the
     * word "ready" and completely wrong for the model that answers it. The
     * gpt-5 family draws its reasoning tokens from the SAME output budget, so
     * 16 was consumed by reasoning before any text was produced and the
     * provider returned status "incomplete" with zero output tokens and a 200.
     *
     * The old code reported that as ok: true, which is the precise failure
     * this codebase works hard to avoid elsewhere: a green status that a
     * presenter would act on and that does not mean what it says. See the
     * liveAiConfigured against liveAiVerified distinction in
     * `src/server/config/runtime.ts` for the same argument.
     */
    const response = await openai.responses.create({
      model: models.fast,
      input: "Reply with the single word: ready",
      max_output_tokens: 256,
      reasoning: { effort: "low" },
    });

    const text = (response.output_text ?? "").trim();
    const producedText = text.length > 0;
    const status = response.status ?? "completed";

    /*
     * ok means a usable response came back, not that the request did not
     * throw. An incomplete response with no text is a configuration problem
     * the presenter needs to know about before the demonstration, not after.
     */
    const ok = producedText && status !== "failed";
    recordLiveVerification(ok);

    return {
      ok,
      model: models.fast,
      status,
      latencyMs: Date.now() - startedAt,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      producedText,
      ...(ok
        ? {}
        : {
            error:
              "The provider accepted the request and returned no usable text. The output budget may be exhausted by reasoning before any text is produced.",
          }),
    };
  } catch (error) {
    /*
     * The provider's own error text is redacted before it is returned.
     *
     * This is not defensive padding. When a key is rejected, OpenAI echoes it
     * back in a masked form that still discloses the last four characters and
     * the exact length. Passing that through would put key material into a
     * console, a health payload or a screenshot, which is precisely what this
     * product undertakes not to do.
     */
    const raw = error instanceof Error ? error.message : "Unknown error";
    const message = redactString(raw);
    log.warn("The live smoke test failed. The application falls back to safe mode.", { error });
    recordLiveVerification(false);
    return {
      ok: false,
      model: models.fast,
      status: "failed",
      latencyMs: Date.now() - startedAt,
      inputTokens: 0,
      outputTokens: 0,
      producedText: false,
      error: message,
    };
  }
}

/** Clears the cached client. Test use only. */
export function resetOpenAIClient(): void {
  client = null;
  availabilityProbed = false;
}
