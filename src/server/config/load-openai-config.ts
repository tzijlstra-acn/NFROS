/**
 * Server side OpenAI configuration loader.
 *
 * The real API key lives in the user's read-only `RealAIInfrastructure`
 * repository. This application reads it at runtime only. The key is never
 * copied into this repository, never written to disk here, never returned to a
 * caller, and never exposed to the browser.
 *
 * Resolution precedence, per the product brief:
 *   1. process.env.OPENAI_API_KEY, when already set in the launching shell
 *   2. ${REAL_AI_INFRA_PATH}/.env.local
 *   3. ${REAL_AI_INFRA_PATH}/.env
 *   4. OPENAI_MINI_API_KEY from the same files, as a final fallback
 *   5. Safe or offline mode when no valid key is found
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { createLogger } from "@/server/logging/redact";

const log = createLogger("openai-config");

if (typeof window !== "undefined") {
  throw new Error(
    "load-openai-config must never be imported into browser code. Import it from a server module only.",
  );
}

/** Safe metadata. This is the only shape that may cross to the client. */
export interface OpenAIStatus {
  /** True when a usable key was resolved. Never reveals the key itself. */
  configured: boolean;
  /** Human readable provenance, for example "RealAIInfrastructure/.env". */
  source: string;
  /** True when the application may make real OpenAI calls. */
  liveModeAvailable: boolean;
  /** Which variable name supplied the key. Names are not secret; values are. */
  variableName: string | null;
  /** Reason live mode is unavailable, when it is unavailable. */
  reason?: string;
}

interface ResolvedConfig {
  key: string | null;
  status: OpenAIStatus;
}

/** Directory names we accept for the infrastructure repository. */
const INFRA_DIRECTORY_CANDIDATES = ["RealAIInfrastructure", "realaiinfrastructure"];

/** Variable names we will read, in precedence order. */
const KEY_VARIABLE_NAMES = ["OPENAI_API_KEY", "OPENAI_MINI_API_KEY"] as const;

/** Only these variables are parsed out of the source env files. */
const PARSED_VARIABLE_ALLOWLIST = new Set<string>([
  ...KEY_VARIABLE_NAMES,
  "OPENAI_BASE_URL",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
]);

/**
 * Values that look like a key but are not one. A placeholder must never be
 * accepted, because that would report live mode as available and then fail at
 * the first call, in front of an audience.
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^$/,
  /^(x+|y+|z+|0+|\.+|-+)$/i,
  /change[_-]?me/i,
  /^your[_-]?/i,
  /^<.*>$/,
  /^\$\{.*\}$/,
  /placeholder/i,
  /^sk-(xxx|test|example|dummy|fake|replace)/i,
  /example\.com/i,
  /^todo$/i,
  /^none$/i,
  /^null$/i,
  /^undefined$/i,
  /^insert[_-]?/i,
];

/** A plausible OpenAI key: the documented prefix plus real entropy. */
function looksLikeUsableKey(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 20) return false;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  if (!trimmed.startsWith("sk-")) return false;
  // Reject anything with whitespace or quoting artefacts still attached.
  if (/\s/.test(trimmed)) return false;
  return true;
}

/**
 * Minimal dotenv parser. Deliberately small and allowlist driven: it returns
 * only the variables this application needs, so unrelated secrets in the source
 * file (database passwords, service credentials) are never even held in memory.
 */
function parseAllowlistedEnv(contents: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf("=");
    if (separator <= 0) continue;

    const name = withoutExport.slice(0, separator).trim();
    if (!PARSED_VARIABLE_ALLOWLIST.has(name)) continue;

    let value = withoutExport.slice(separator + 1).trim();
    // Strip matched surrounding quotes, then drop trailing inline comments on
    // unquoted values only.
    const firstChar = value.charAt(0);
    const lastChar = value.charAt(value.length - 1);
    const isQuoted =
      value.length > 1 &&
      (firstChar === lastChar) &&
      (firstChar === String.fromCharCode(34) || firstChar === String.fromCharCode(39));

    if (isQuoted) {
      value = value.slice(1, -1);
    } else {
      const comment = value.indexOf(" #");
      if (comment >= 0) value = value.slice(0, comment).trim();
    }
    if (value.length > 0) result.set(name, value);
  }
  return result;
}

function isDirectory(candidate: string): boolean {
  try {
    return existsSync(candidate) && statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolves the infrastructure repository directory.
 *
 * Search is intentionally narrow: the configured path, then the repository
 * parent, then the grandparent, then a configured `NFR_SOURCE_ROOT`. We never
 * scan the wider machine.
 */
export function resolveInfraPath(cwd: string = process.cwd()): string | null {
  const configured = process.env.REAL_AI_INFRA_PATH;
  if (configured && configured.trim().length > 0) {
    const candidate = isAbsolute(configured) ? configured : resolve(cwd, configured);
    if (isDirectory(candidate)) return candidate;
    log.warn("REAL_AI_INFRA_PATH is set but does not resolve to a directory.", {
      configuredPath: configured,
    });
  }

  const searchRoots = [resolve(cwd, ".."), resolve(cwd, "..", "..")];
  const sourceRoot = process.env.NFR_SOURCE_ROOT;
  if (sourceRoot && sourceRoot.trim().length > 0) {
    searchRoots.push(isAbsolute(sourceRoot) ? sourceRoot : resolve(cwd, sourceRoot));
  }

  for (const root of searchRoots) {
    if (!isDirectory(root)) continue;
    for (const name of INFRA_DIRECTORY_CANDIDATES) {
      // Resolved at runtime and outside this project by design. See the note
      // in `resolveConfig` for why the bundler cannot scope this statically.
      const candidate = join(/* turbopackIgnore: true */ root, name);
      if (isDirectory(candidate)) return candidate;
    }
  }
  return null;
}

/** Describes a source location without leaking an absolute machine path. */
function describeSource(infraPath: string, fileName: string): string {
  const segments = infraPath.split(/[\\/]/).filter(Boolean);
  const repoName = segments[segments.length - 1] ?? "RealAIInfrastructure";
  return repoName + "/" + fileName;
}

let cached: ResolvedConfig | null = null;

function resolveConfig(): ResolvedConfig {
  // 1. An explicitly exported shell variable always wins.
  const shellKey = process.env.OPENAI_API_KEY;
  if (shellKey && looksLikeUsableKey(shellKey)) {
    return {
      key: shellKey.trim(),
      status: {
        configured: true,
        source: "process environment",
        liveModeAvailable: true,
        variableName: "OPENAI_API_KEY",
      },
    };
  }

  const infraPath = resolveInfraPath();
  if (!infraPath) {
    return {
      key: null,
      status: {
        configured: false,
        source: "not found",
        liveModeAvailable: false,
        variableName: null,
        reason:
          "The RealAIInfrastructure directory was not found next to this repository. Set REAL_AI_INFRA_PATH, or run in safe or offline mode.",
      },
    };
  }

  // 2 and 3. Only `.env.local` then `.env`, in that order.
  for (const fileName of [".env.local", ".env"]) {
    /*
     * The bundler's static analysis cannot scope this path, because the whole
     * point is that it resolves to a directory outside this project at
     * runtime. Left unannotated it traces the entire project into the server
     * output. The read itself is narrow: two fixed file names inside one
     * resolved directory, and the parser is allowlist driven.
     */
    const filePath = join(/* turbopackIgnore: true */ infraPath, fileName);
    if (!existsSync(filePath)) continue;

    let parsed: Map<string, string>;
    try {
      parsed = parseAllowlistedEnv(readFileSync(filePath, "utf8"));
    } catch (error) {
      log.warn("Could not read a source environment file.", {
        file: describeSource(infraPath, fileName),
        error,
      });
      continue;
    }

    // 4. OPENAI_API_KEY first, OPENAI_MINI_API_KEY only as a final fallback.
    for (const variableName of KEY_VARIABLE_NAMES) {
      const value = parsed.get(variableName);
      if (value === undefined) continue;
      if (!looksLikeUsableKey(value)) {
        log.warn("A key variable was present but rejected as empty or placeholder.", {
          file: describeSource(infraPath, fileName),
          variableName,
        });
        continue;
      }
      return {
        key: value.trim(),
        status: {
          configured: true,
          source: describeSource(infraPath, fileName),
          liveModeAvailable: true,
          variableName,
        },
      };
    }
  }

  // 5. Safe or offline mode.
  return {
    key: null,
    status: {
      configured: false,
      source: describeSource(infraPath, "(no usable key)"),
      liveModeAvailable: false,
      variableName: null,
      reason:
        "No usable OpenAI key was found in the source environment files. The application runs in safe or offline mode.",
    },
  };
}

function getConfig(): ResolvedConfig {
  if (cached === null) {
    cached = resolveConfig();
    log.info("OpenAI configuration resolved.", cached.status);
  }
  return cached;
}

/**
 * Returns safe status metadata only. This is what the health endpoint, the
 * entry screen and the control room consume.
 */
export function getOpenAIStatus(): OpenAIStatus {
  return { ...getConfig().status };
}

/**
 * Returns the API key for server side use by the OpenAI client factory.
 *
 * This function is the single point at which the secret is readable. It must
 * never be called from a React Server Component that serialises its result, a
 * route handler response body, a log statement, or a test fixture.
 */
export function getOpenAIKeyForServerUse(): string | null {
  return getConfig().key;
}

/** Clears the cache. Test use only. */
export function resetOpenAIConfigCache(): void {
  cached = null;
}

/** Exported for unit tests. */
export const internalsForTests = {
  parseAllowlistedEnv,
  looksLikeUsableKey,
  describeSource,
};
