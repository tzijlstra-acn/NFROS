/**
 * The integration error taxonomy.
 *
 * Every failure crossing a connector boundary is classified here before the
 * runtime decides what to do with it, because the single most consequential
 * question about an external failure is whether retrying it could possibly
 * help. Getting that wrong is expensive in both directions: retrying a
 * validation error burns the retry budget and delays the dead letter a human
 * needs to see, and refusing to retry a transport blip turns a two second
 * network stall into an approved decision that never reached the system of
 * record.
 *
 * So `retryable` is a property of the code rather than a judgment made at the
 * call site. `RETRYABLE_CODES` below is the whole policy.
 */

/** Classification of an integration failure. */
export const INTEGRATION_ERROR_CODES = [
  /* ---- refusals: the runtime stopped this, not the target ---- */
  "capability-not-declared",
  "connector-not-registered",
  "connector-not-implemented",
  "authority-denied",
  /* ---- configuration: a person has to change something ---- */
  "connector-unavailable",
  "authentication-missing",
  "write-not-enabled",
  /* ---- the request was wrong ---- */
  "validation-failed",
  "not-found",
  "conflict",
  "version-mismatch",
  /* ---- the target was willing but could not, right now ---- */
  "rate-limited",
  "timeout",
  "transport",
  "partial",
  /* ---- stopped deliberately ---- */
  "cancelled",
  /* ---- anything the target reported that we cannot classify ---- */
  "unknown",
] as const;

export type IntegrationErrorCode = (typeof INTEGRATION_ERROR_CODES)[number];

/**
 * Codes a bounded retry may help with.
 *
 * `connector-unavailable` is in this set deliberately. The failure proof in
 * this product turns a simulated target system off, retries, dead letters,
 * then recovers the connector and completes the same command. If
 * unavailability were classified permanent, the operator would have no path
 * back other than re-approving a decision a person already took, which is
 * exactly the outcome this design exists to prevent.
 *
 * `partial` is not retryable. A partially applied write needs a human to look
 * at what landed before anything is sent again.
 */
const RETRYABLE_CODES: ReadonlySet<IntegrationErrorCode> = new Set([
  "connector-unavailable",
  "rate-limited",
  "timeout",
  "transport",
  "unknown",
]);

/** Short, non technical explanations for the integration centre. */
export const INTEGRATION_ERROR_LABELS: Record<IntegrationErrorCode, { en: string; de: string }> = {
  "capability-not-declared": {
    en: "The connector does not declare this operation",
    de: "Der Konnektor deklariert diesen Vorgang nicht",
  },
  "connector-not-registered": {
    en: "No implementation is registered for this connector",
    de: "Fuer diesen Konnektor ist keine Implementierung registriert",
  },
  "connector-not-implemented": {
    en: "This adapter is planned and not built",
    de: "Dieser Adapter ist geplant und nicht gebaut",
  },
  "authority-denied": {
    en: "The authority gate refused the action",
    de: "Die Berechtigungspruefung hat die Aktion abgelehnt",
  },
  "connector-unavailable": {
    en: "The target system is unavailable",
    de: "Das Zielsystem ist nicht verfuegbar",
  },
  "authentication-missing": {
    en: "No credential is configured for this connector",
    de: "Fuer diesen Konnektor ist keine Anmeldeinformation konfiguriert",
  },
  "write-not-enabled": {
    en: "Writing is not enabled for this connector instance",
    de: "Schreiben ist fuer diese Konnektorinstanz nicht aktiviert",
  },
  "validation-failed": {
    en: "The target system rejected the request as invalid",
    de: "Das Zielsystem hat die Anfrage als ungueltig abgelehnt",
  },
  "not-found": {
    en: "The target object does not exist",
    de: "Das Zielobjekt existiert nicht",
  },
  conflict: {
    en: "Another change reached the target first",
    de: "Eine andere Aenderung hat das Ziel zuerst erreicht",
  },
  "version-mismatch": {
    en: "The expected version no longer matches",
    de: "Die erwartete Version stimmt nicht mehr",
  },
  "rate-limited": {
    en: "The target system is rate limiting requests",
    de: "Das Zielsystem begrenzt die Anfragerate",
  },
  timeout: {
    en: "The target system did not answer in time",
    de: "Das Zielsystem hat nicht rechtzeitig geantwortet",
  },
  transport: {
    en: "The connection to the target system failed",
    de: "Die Verbindung zum Zielsystem ist fehlgeschlagen",
  },
  partial: {
    en: "Part of the change was applied and part was not",
    de: "Ein Teil der Aenderung wurde angewendet, ein Teil nicht",
  },
  cancelled: { en: "The operation was cancelled", de: "Der Vorgang wurde abgebrochen" },
  unknown: {
    en: "The target system reported an unclassified error",
    de: "Das Zielsystem meldete einen nicht klassifizierten Fehler",
  },
};

/**
 * A failure at, or about, a connector boundary.
 *
 * `detail` carries a short operational note and is written to
 * `integration_commands.last_error`, which the integration centre displays.
 * It must therefore never hold payload content, an endpoint carrying a token,
 * or anything a credential could be reconstructed from. Connectors build it
 * from the classification and the object identity only.
 */
export class ConnectorError extends Error {
  readonly code: IntegrationErrorCode;
  readonly retryable: boolean;
  readonly connectorInstanceId: string | null;
  readonly detail: string;

  constructor(
    code: IntegrationErrorCode,
    message: string,
    options: { connectorInstanceId?: string | null; detail?: string; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ConnectorError";
    this.code = code;
    this.retryable = options.retryable ?? RETRYABLE_CODES.has(code);
    this.connectorInstanceId = options.connectorInstanceId ?? null;
    this.detail = options.detail ?? message;
  }
}

/** True when the code is one a bounded retry may resolve. */
export function isRetryableCode(code: IntegrationErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

/**
 * Classifies anything thrown inside the runtime.
 *
 * An unclassified throw becomes `unknown`, which is retryable. That default
 * errs towards delivering an approved human decision rather than abandoning
 * it, and the bounded attempt count stops the error from looping forever.
 */
export function toConnectorError(
  error: unknown,
  options: { connectorInstanceId?: string | null } = {},
): ConnectorError {
  if (error instanceof ConnectorError) return error;
  const message = error instanceof Error ? error.message : "Unknown integration failure.";
  return new ConnectorError("unknown", message, options);
}

/** The runtime refusing an operation a connector never claimed to support. */
export function capabilityRefusal(params: {
  connectorInstanceId: string;
  operation: string;
  objectType: string;
}): ConnectorError {
  return new ConnectorError(
    "capability-not-declared",
    `The connector instance ${params.connectorInstanceId} does not declare "${params.operation}" for "${params.objectType}", so the runtime refused the call before it reached the connector.`,
    {
      connectorInstanceId: params.connectorInstanceId,
      detail: `capability ${params.operation}:${params.objectType} not declared`,
    },
  );
}
