/**
 * AI configuration and prompt registry.
 *
 * In V4 this is a static code registry. A database-backed registry with
 * per-version eval results, rollback and staged rollout is the documented
 * next step for a production deployment. The static form here is intentional:
 * it is versioned with the code, so a configuration change and the code
 * change that depends on it ship together.
 *
 * Nothing in this file talks to the network or to a database. It is safe to
 * import in any module, including tests.
 */

/* ==========================================================================
   Types
   ========================================================================== */

export type AIConfigurationStatus = "draft" | "candidate" | "released" | "retired";

export type AIConfigurationVersion = {
  id: string;
  name: string;
  roleId: string;
  taskKind: string;
  promptVersion: string;
  outputSchemaVersion: string;
  modelProfileId: string;
  evaluationSuiteId: string;
  releasedAt: string;
  releasedBy: string;
  status: AIConfigurationStatus;
};

export type ModelProfile = {
  id: string;
  provider: "openai" | "anthropic" | "local";
  modelId: string;
  maxTokens: number;
  temperature: number;
  purpose: string;
};

/* ==========================================================================
   Model profiles
   ========================================================================== */

/**
 * The model profiles available in this build.
 *
 * A model profile separates the choice of model from the configuration of an
 * individual task. Two configurations can reference the same profile and be
 * updated together when the profile changes, rather than in each configuration
 * independently.
 */
export const MODEL_PROFILES: ModelProfile[] = [
  {
    id: "gpt-4o-mini-structured",
    provider: "openai",
    modelId: "gpt-4o-mini",
    maxTokens: 4000,
    temperature: 0.2,
    purpose: "Structured stage preparation and evidence assessment",
  },
  {
    id: "gpt-4o-reasoning",
    provider: "openai",
    modelId: "gpt-4o",
    maxTokens: 8000,
    temperature: 0.1,
    purpose: "Challenge workshop preparation and risk rating rationale",
  },
];

/* ==========================================================================
   Configuration registry
   ========================================================================== */

/**
 * The released AI configurations for this build.
 *
 * Each entry describes one task type for one role. The combination of roleId
 * and taskKind is the lookup key. A configuration moves through draft ->
 * candidate -> released; only released configurations are used at runtime.
 */
export const AI_CONFIGURATION_REGISTRY: AIConfigurationVersion[] = [
  {
    id: "AICFG-RCSA-STAGE-PREP-001",
    name: "RCSA Stage Preparation",
    roleId: "rcsa",
    taskKind: "stage-preparation",
    promptVersion: "v1.0",
    outputSchemaVersion: "envelope-v1",
    modelProfileId: "gpt-4o-mini-structured",
    evaluationSuiteId: "EVAL-RCSA-001",
    releasedAt: "2026-10-02T00:00:00Z",
    releasedBy: "system",
    status: "released",
  },
  {
    id: "AICFG-TPRM-STAGE-PREP-001",
    name: "TPRM Stage Preparation",
    roleId: "tprm",
    taskKind: "stage-preparation",
    promptVersion: "v1.0",
    outputSchemaVersion: "envelope-v1",
    modelProfileId: "gpt-4o-mini-structured",
    evaluationSuiteId: "EVAL-TPRM-001",
    releasedAt: "2026-10-02T00:00:00Z",
    releasedBy: "system",
    status: "released",
  },
];

/* ==========================================================================
   Lookup helpers
   ========================================================================== */

/**
 * The released configuration for a given role and task, if one exists.
 *
 * Returns undefined when no released configuration matches. The caller is
 * responsible for deciding whether to fall back to offline mode or to reject
 * the request.
 */
export function getReleasedConfig(
  roleId: string,
  taskKind: string
): AIConfigurationVersion | undefined {
  return AI_CONFIGURATION_REGISTRY.find(
    (c) => c.roleId === roleId && c.taskKind === taskKind && c.status === "released"
  );
}

/** A model profile by id, if registered. */
export function getModelProfile(id: string): ModelProfile | undefined {
  return MODEL_PROFILES.find((p) => p.id === id);
}
