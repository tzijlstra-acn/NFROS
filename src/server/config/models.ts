/**
 * Central model configuration.
 *
 * The product must not depend on one fragile hardcoded model name. Every model
 * choice is expressed as a role (primary, fast, deep, realtime, embedding),
 * each role is overridable by an environment variable, and when no override is
 * present we walk a documented preference list and pick the first model the
 * account can actually use.
 *
 * Resolved model names are shown only in the control room, never in the
 * exported executive slides.
 */

import { createLogger } from "@/server/logging/redact";

const log = createLogger("model-config");

export type ModelRole = "primary" | "fast" | "deep" | "realtime" | "embedding";

/**
 * Documented preference lists, most preferred first.
 *
 * Rationale per role:
 *   primary   a strong general model for synthesis and challenge preparation
 *   fast      a low latency model for briefs, labels and short classifications
 *   deep      a reasoning oriented model for contradiction and impact analysis
 *   realtime  a speech to speech model for the meeting simulations
 *   embedding a retrieval embedding model for the evidence corpus
 */
export const MODEL_PREFERENCES: Record<ModelRole, readonly string[]> = {
  primary: ["gpt-5.1", "gpt-5", "gpt-4.1", "gpt-4o"],
  fast: ["gpt-5.1-mini", "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"],
  deep: ["gpt-5.1", "o4-mini", "gpt-5", "gpt-4.1"],
  realtime: ["gpt-realtime", "gpt-4o-realtime-preview"],
  embedding: ["text-embedding-3-small", "text-embedding-3-large"],
};

const ENV_OVERRIDE: Record<ModelRole, string> = {
  primary: "OPENAI_MODEL_PRIMARY",
  fast: "OPENAI_MODEL_FAST",
  deep: "OPENAI_MODEL_DEEP",
  realtime: "OPENAI_REALTIME_MODEL",
  embedding: "OPENAI_EMBEDDING_MODEL",
};

export interface ResolvedModels {
  primary: string;
  fast: string;
  deep: string;
  realtime: string | null;
  embedding: string | null;
  /** How each role was decided. Shown in the control room. */
  provenance: Record<ModelRole, "environment variable" | "preference list" | "fallback" | "unavailable">;
  /** True when the account model list was successfully retrieved. */
  availabilityChecked: boolean;
  /** Set when voice had to be disabled. */
  realtimeDisabledReason?: string;
}

function readOverride(role: ModelRole): string | null {
  const raw = process.env[ENV_OVERRIDE[role]];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves all model roles against an optional set of model identifiers the
 * account can use.
 *
 * `availableModels` is `null` when we could not query the account, for example
 * in offline mode. In that case we fall back to the first preference and mark
 * the provenance as a fallback rather than claiming it was verified.
 */
export function resolveModels(availableModels: ReadonlySet<string> | null): ResolvedModels {
  const provenance: ResolvedModels["provenance"] = {
    primary: "fallback",
    fast: "fallback",
    deep: "fallback",
    realtime: "fallback",
    embedding: "fallback",
  };

  function pick(role: ModelRole): string | null {
    const override = readOverride(role);
    if (override) {
      provenance[role] = "environment variable";
      return override;
    }

    const preferences = MODEL_PREFERENCES[role];
    if (availableModels) {
      for (const candidate of preferences) {
        if (availableModels.has(candidate)) {
          provenance[role] = "preference list";
          return candidate;
        }
      }
      // The account list was retrieved and contained none of our preferences.
      // Voice and embeddings degrade gracefully; text roles fall back so the
      // application still runs.
      if (role === "realtime" || role === "embedding") {
        provenance[role] = "unavailable";
        return null;
      }
    }

    provenance[role] = availableModels ? "fallback" : "fallback";
    return preferences[0] ?? null;
  }

  const primary = pick("primary") ?? "gpt-4o";
  const fast = pick("fast") ?? primary;
  const deep = pick("deep") ?? primary;
  const realtime = pick("realtime");
  const embedding = pick("embedding");

  const resolved: ResolvedModels = {
    primary,
    fast,
    deep,
    realtime,
    embedding,
    provenance,
    availabilityChecked: availableModels !== null,
  };

  if (realtime === null) {
    resolved.realtimeDisabledReason =
      "No realtime model is available for this account. Voice is disabled and the typed fallback is used.";
  }

  return resolved;
}

let cached: ResolvedModels | null = null;

/** Returns the resolved model set, computing it once per process. */
export function getResolvedModels(availableModels: ReadonlySet<string> | null = null): ResolvedModels {
  if (cached === null) {
    cached = resolveModels(availableModels);
    log.info("Model roles resolved.", {
      primary: cached.primary,
      fast: cached.fast,
      deep: cached.deep,
      realtime: cached.realtime,
      embedding: cached.embedding,
      availabilityChecked: cached.availabilityChecked,
    });
  }
  return cached;
}

/** Replaces the cached resolution, used after a successful availability probe. */
export function setResolvedModels(models: ResolvedModels): void {
  cached = models;
}

/** Clears the cache. Test use only. */
export function resetModelCache(): void {
  cached = null;
}

/**
 * Indicative pricing per million tokens, in United States dollars.
 *
 * These figures drive the cost meter in the control room. They are labelled as
 * illustrative in the interface because published prices change and this
 * application does not read a live price list.
 */
export const INDICATIVE_PRICE_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5.1-mini": { input: 0.25, output: 2 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};

/** Default used when a model is not in the indicative price table. */
const DEFAULT_PRICE = { input: 1.25, output: 10 };

/** Estimated cost in United States dollars. Labelled illustrative in the UI. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = INDICATIVE_PRICE_PER_MILLION_TOKENS[model] ?? DEFAULT_PRICE;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
