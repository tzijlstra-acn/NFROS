/**
 * Redaction utilities.
 *
 * Every log line, error message, trace payload and export in this application
 * passes through `redact` before it leaves the server process. The goal is that
 * a secret cannot escape through a log, a stack trace or an exported artefact
 * even when calling code is careless.
 */

/** Replacement marker written in place of any value judged to be a secret. */
export const REDACTED = "[redacted]";

/**
 * Patterns for values that must never be emitted.
 *
 * These are deliberately broad. A false positive costs us a less readable log
 * line; a false negative leaks a credential.
 */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  // OpenAI style keys, including project and service account variants.
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bsk-proj-[A-Za-z0-9_-]{8,}/g,
  /\bsk-svcacct-[A-Za-z0-9_-]{8,}/g,
  /*
   * Partially masked keys.
   *
   * This pattern exists because of a real leak. When OpenAI rejects a key it
   * echoes it back in the error message in its own masked form, for example
   * "sk-proj-****...****Uk0A". That masking still discloses the final
   * characters and the exact length, both of which the product undertakes
   * never to reveal, and the unmasked patterns above do not match it because
   * an asterisk is not in their character class. Any `sk-` prefixed run
   * containing mask characters is therefore replaced wholesale.
   */
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_*.-]*[*•.]{4,}[A-Za-z0-9_*.-]*/g,
  // Organisation and project identifiers are not secrets but are still noise
  // we do not need in logs.
  /\borg-[A-Za-z0-9]{16,}/g,
  // Bearer tokens and raw authorization header values.
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  // Generic long high entropy tokens that look like credentials.
  /\b(?:gh[pousr]|xox[baprs])-[A-Za-z0-9_-]{10,}/g,
  // JSON Web Tokens.
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g,
  // Private key blocks.
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

/**
 * Keys whose values are replaced wholesale, regardless of the value shape.
 * Matching is case insensitive and ignores separators, so `api_key`, `apiKey`
 * and `API-KEY` are all covered.
 */
const SECRET_KEY_NAMES = [
  "apikey",
  "openaiapikey",
  "openaiminiapikey",
  "authorization",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "secret",
  "secretkey",
  "clientsecret",
  "password",
  "passwd",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "sessionsecret",
  "privatekey",
  "credential",
  "credentials",
  "ephemeralkey",
  "clientephemeralkey",
];

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSecretKeyName(key: string): boolean {
  return SECRET_KEY_NAMES.includes(normaliseKey(key));
}

/** Redacts secret shaped substrings inside a single string. */
export function redactString(input: string): string {
  let output = input;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    output = output.replace(pattern, REDACTED);
  }
  // Catch `KEY=value` and `"key": "value"` forms where the name is sensitive
  // but the value itself has no recognisable shape.
  output = output.replace(
    /(\b[A-Za-z_][A-Za-z0-9_-]*\b)(\s*[:=]\s*)("?)([^\s",;}]{6,})\3/g,
    (match, key: string, sep: string, quote: string, value: string) =>
      isSecretKeyName(key) ? `${key}${sep}${quote}${REDACTED}${quote}` : match,
  );
  return output;
}

/**
 * Recursively redacts an arbitrary value. Objects and arrays are copied rather
 * than mutated so callers can safely log a redacted view of live state.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[function]";

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, depth + 1));
  }

  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of value.entries()) {
      const name = String(key);
      out[name] = isSecretKeyName(name) ? REDACTED : redact(entry, depth + 1);
    }
    return out;
  }

  if (value instanceof Set) {
    return Array.from(value).map((entry) => redact(entry, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKeyName(key) ? REDACTED : redact(entry, depth + 1);
    }
    return out;
  }

  return "[unserialisable]";
}

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, context?: unknown): void {
  const line = {
    at: new Date().toISOString(),
    level,
    scope,
    message: redactString(message),
    ...(context === undefined ? {} : { context: redact(context) }),
  };
  const serialised = redactString(JSON.stringify(line));
  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else console.log(serialised);
}

export interface Logger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

/**
 * Creates a scoped redacting logger. This is the only logging entry point the
 * application should use.
 */
export function createLogger(scope: string): Logger {
  return {
    debug: (message, context) => {
      if (process.env.NODE_ENV !== "production") emit("debug", scope, message, context);
    },
    info: (message, context) => emit("info", scope, message, context),
    warn: (message, context) => emit("warn", scope, message, context),
    error: (message, context) => emit("error", scope, message, context),
  };
}
