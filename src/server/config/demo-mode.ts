/**
 * Demo mode resolution.
 *
 * live          real OpenAI calls, streaming, specialist delegation
 * safe          cached known good outputs for the critical story beats,
 *               live AI only for optional free questions, deterministic timing
 * offline       no OpenAI calls at all, seeded responses only
 *
 * Safe mode is the default because the primary use of this application is a
 * live executive demonstration, where predictable timing matters more than
 * novelty. A requested mode is downgraded rather than failed: asking for live
 * mode without a key yields safe mode with a stated reason.
 */

export const DEMO_MODES = ["live", "safe", "offline"] as const;
export type DemoMode = (typeof DEMO_MODES)[number];

export const DEFAULT_DEMO_MODE: DemoMode = "safe";

export function isDemoMode(value: unknown): value is DemoMode {
  return typeof value === "string" && (DEMO_MODES as readonly string[]).includes(value);
}

export interface DemoModeResolution {
  /** The mode the application will actually run in. */
  mode: DemoMode;
  /** The mode that was asked for, before any downgrade. */
  requested: DemoMode;
  /** True when the requested mode could not be honoured. */
  downgraded: boolean;
  /** Explains a downgrade in language suitable for the control room. */
  reason?: string;
}

/**
 * Resolves the effective mode.
 *
 * @param requestedRaw   value from the environment or a user selection
 * @param liveAvailable  whether a usable OpenAI key was resolved
 */
export function resolveDemoMode(requestedRaw: unknown, liveAvailable: boolean): DemoModeResolution {
  const requested = isDemoMode(requestedRaw) ? requestedRaw : DEFAULT_DEMO_MODE;

  if (requested === "live" && !liveAvailable) {
    return {
      mode: "safe",
      requested,
      downgraded: true,
      reason:
        "Live mode was requested but no usable OpenAI key was resolved. The application runs in presenter safe mode using cached outputs.",
    };
  }

  if (requested === "safe" && !liveAvailable) {
    return {
      mode: "safe",
      requested,
      downgraded: false,
      reason:
        "Presenter safe mode is running entirely from cached and seeded outputs because no key was resolved. Optional free questions are unavailable.",
    };
  }

  return { mode: requested, requested, downgraded: false };
}

/** True when this mode is permitted to make any network call to OpenAI. */
export function allowsNetworkCalls(mode: DemoMode): boolean {
  return mode !== "offline";
}

/**
 * True when this mode must serve the scripted story beats from cache.
 *
 * In safe mode the critical beats come from cache so the demonstration is
 * deterministic, while optional questions may still be answered live.
 */
export function requiresCachedCriticalBeats(mode: DemoMode): boolean {
  return mode === "safe" || mode === "offline";
}

/** Short label for the top bar. */
export function demoModeLabel(mode: DemoMode): string {
  switch (mode) {
    case "live":
      return "Live AI";
    case "safe":
      return "Presenter Safe";
    case "offline":
      return "Offline";
  }
}
