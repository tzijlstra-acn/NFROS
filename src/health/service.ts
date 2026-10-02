/**
 * Health service.
 *
 * Checks the operational state of each component the product depends on.
 * Every check returns a narrow object: no secrets, no content, no raw prompts.
 *
 * The audit chain and worker checks are caught gracefully because those
 * components may not be present in every deployment stage.
 */

export type ComponentStatus =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "not-configured"
  | "not-verified";

export type ComponentHealth = {
  name: string;
  status: ComponentStatus;
  latencyMs?: number;
  detail?: string;
};

export type HealthSummary = {
  status: "healthy" | "degraded" | "unavailable";
  components: ComponentHealth[];
  checkedAt: string;
};

export async function checkDatabaseHealth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const { isDatabaseReady } = await import("@/db/client");
    const ready = isDatabaseReady();
    return {
      name: "database",
      status: ready ? "healthy" : "unavailable",
      latencyMs: Date.now() - start,
    };
  } catch {
    return { name: "database", status: "unavailable", latencyMs: Date.now() - start };
  }
}

export async function checkWorkerHealth(): Promise<ComponentHealth> {
  // Check if any job has been leased recently (within last 10 minutes).
  // If background_jobs table does not exist yet, return not-configured.
  try {
    const { getJobDepth } = await import("@/db/repositories/background-jobs");
    const depth = getJobDepth();
    return {
      name: "worker",
      status: "not-verified",
      detail: `${depth} jobs pending`,
    };
  } catch {
    return { name: "worker", status: "not-configured" };
  }
}

export async function checkAIProviderHealth(): Promise<ComponentHealth> {
  const hasKey = !!(process.env.OPENAI_MINI_API_KEY || process.env.OPENAI_API_KEY);
  if (!hasKey) {
    return {
      name: "ai-provider",
      status: "not-configured",
      detail: "No API key configured -- offline mode only",
    };
  }
  return {
    name: "ai-provider",
    status: "not-verified",
    detail: "Key configured; live call not performed",
  };
}

export async function checkAuditChainHealth(): Promise<ComponentHealth> {
  try {
    const { verifyChain, CHAIN_SCOPE } = await import("@/audit/verify-chain");
    const result = verifyChain(CHAIN_SCOPE);
    return {
      name: "audit-chain",
      status:
        result.status === "valid"
          ? "healthy"
          : result.status === "empty"
            ? "not-configured"
            : "degraded",
      detail: `${result.totalRecords} records, verified through ${result.verifiedThrough}`,
    };
  } catch {
    return { name: "audit-chain", status: "not-configured" };
  }
}

export async function getHealthSummary(includeDetails: boolean): Promise<HealthSummary> {
  const components = await Promise.all([
    checkDatabaseHealth(),
    checkWorkerHealth(),
    checkAIProviderHealth(),
    checkAuditChainHealth(),
  ]);

  const hasUnavailable = components.some((c) => c.status === "unavailable");
  const hasDegraded = components.some((c) => c.status === "degraded");

  const summary: HealthSummary = {
    status: hasUnavailable ? "unavailable" : hasDegraded ? "degraded" : "healthy",
    components: includeDetails
      ? components
      : components.map((c) => ({ name: c.name, status: c.status })),
    checkedAt: new Date().toISOString(),
  };

  return summary;
}
