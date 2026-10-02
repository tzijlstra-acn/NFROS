/**
 * Integration runtime unit tests.
 *
 * These cover the parts of the integration layer whose correctness is a
 * property of a function rather than of a flow: the capability gate, the retry
 * schedule, freshness arithmetic, conflict policy selection, canonical field
 * mapping, deep link construction and the error taxonomy.
 *
 * The retry tests inject the clock and the jitter source. That is the whole
 * reason those dependencies are parameters: a backoff schedule read from the
 * ambient clock with random jitter cannot be asserted, only bracketed, and a
 * bracketed assertion passes when the policy is wrong by a factor of two.
 *
 * The database backed cases that genuinely need a database, deduplication,
 * idempotency and the dead letter transition, use the integration harness.
 * Isolation matters even here: these tests set a connector unavailable and
 * dead letter a command, and doing that to the developer's own scenario
 * database would be worse than having no tests.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTemporaryDatabase,
  destroyTemporaryDatabase,
  rowCount,
} from "../integration/support/harness";

/* ==========================================================================
   Pure functions, no database
   ========================================================================== */

describe("connector capability declaration", () => {
  it("permits exactly the declared object types", async () => {
    const { declaresCapability } = await import("@/integrations/core/Connector");
    const capabilities = {
      read: ["grc.control", "grc.risk"],
      search: ["grc.control"],
      events: ["grc.control.rating.changed"],
      draft: [],
      write: ["grc.assessment"],
      attachments: false,
      deepLinks: true,
      deltaSync: true,
      webhooks: false,
    };

    expect(declaresCapability(capabilities, "read", "grc.control")).toBe(true);
    expect(declaresCapability(capabilities, "read", "grc.assessment")).toBe(false);
    expect(declaresCapability(capabilities, "write", "grc.assessment")).toBe(true);
    expect(declaresCapability(capabilities, "write", "grc.control")).toBe(false);
    expect(declaresCapability(capabilities, "draft", "grc.control")).toBe(false);
    expect(declaresCapability(capabilities, "events", "grc.control.rating.changed")).toBe(true);
  });

  it("treats sync as read plus a change feed, so one cannot imply the other", async () => {
    const { declaresCapability, NO_CAPABILITIES } = await import("@/integrations/core/Connector");

    const readableWithoutDelta = { ...NO_CAPABILITIES, read: ["dms.document"], deltaSync: false };
    expect(declaresCapability(readableWithoutDelta, "read", "dms.document")).toBe(true);
    expect(declaresCapability(readableWithoutDelta, "sync", "dms.document")).toBe(false);

    const readableWithDelta = { ...NO_CAPABILITIES, read: ["dms.document"], deltaSync: true };
    expect(declaresCapability(readableWithDelta, "sync", "dms.document")).toBe(true);
    expect(declaresCapability(readableWithDelta, "sync", "dms.folder")).toBe(false);
  });

  it("counts an empty capability set as zero rather than as unknown", async () => {
    const { capabilityCount, NO_CAPABILITIES } = await import("@/integrations/core/Connector");
    expect(capabilityCount(NO_CAPABILITIES)).toBe(0);
  });
});

describe("the retry policy, with an injected clock and jitter", () => {
  it("doubles the delay on each attempt and clamps at the ceiling", async () => {
    const { computeBackoffDelay, backoffSchedule } = await import(
      "@/integrations/runtime/RetryPolicy"
    );
    const { noJitter } = await import("@/integrations/core/ConnectorContext");

    const policy = {
      maxAttempts: 6,
      baseDelayMs: 1_000,
      maxDelayMs: 8_000,
      jitterRatio: 0,
      timeoutMs: 5_000,
    };

    expect(computeBackoffDelay(1, policy, noJitter)).toBe(1_000);
    expect(computeBackoffDelay(2, policy, noJitter)).toBe(2_000);
    expect(computeBackoffDelay(3, policy, noJitter)).toBe(4_000);
    expect(computeBackoffDelay(4, policy, noJitter)).toBe(8_000);
    // Clamped, not 16000.
    expect(computeBackoffDelay(5, policy, noJitter)).toBe(8_000);

    expect(backoffSchedule(policy, noJitter)).toStrictEqual([1_000, 2_000, 4_000, 8_000, 8_000]);
  });

  it("only ever lengthens a delay with jitter, never shortens one", async () => {
    const { computeBackoffDelay } = await import("@/integrations/runtime/RetryPolicy");
    const { seededJitter } = await import("@/integrations/core/ConnectorContext");

    const policy = {
      maxAttempts: 4,
      baseDelayMs: 2_000,
      maxDelayMs: 60_000,
      jitterRatio: 0.25,
      timeoutMs: 5_000,
    };

    const jitter = seededJitter(7);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const exponential = 2_000 * 2 ** (attempt - 1);
      const delay = computeBackoffDelay(attempt, policy, jitter);
      expect(delay).toBeGreaterThanOrEqual(exponential);
      expect(delay).toBeLessThanOrEqual(exponential * 1.25);
    }
  });

  it("schedules the next attempt against the injected clock", async () => {
    const { nextAttemptAt, DEFAULT_RETRY_POLICY } = await import(
      "@/integrations/runtime/RetryPolicy"
    );
    const { fixedClock, noJitter } = await import("@/integrations/core/ConnectorContext");

    const clock = fixedClock("2026-10-06T08:00:00.000Z");
    expect(nextAttemptAt(1, DEFAULT_RETRY_POLICY, clock, noJitter)).toBe(
      "2026-10-06T08:00:02.000Z",
    );
    expect(nextAttemptAt(2, DEFAULT_RETRY_POLICY, clock, noJitter)).toBe(
      "2026-10-06T08:00:04.000Z",
    );
    // The last attempt has no successor.
    expect(nextAttemptAt(3, DEFAULT_RETRY_POLICY, clock, noJitter)).toBeNull();
  });

  it("refuses to retry a failure that retrying cannot fix, even on attempt one", async () => {
    const { shouldRetry, DEFAULT_RETRY_POLICY } = await import(
      "@/integrations/runtime/RetryPolicy"
    );
    const { ConnectorError } = await import("@/integrations/core/errors");
    const { fixedClock, noJitter } = await import("@/integrations/core/ConnectorContext");
    const clock = fixedClock("2026-10-06T08:00:00.000Z");

    const validation = shouldRetry(
      new ConnectorError("validation-failed", "The target rejected the payload."),
      1,
      DEFAULT_RETRY_POLICY,
      clock,
      noJitter,
    );
    expect(validation.retry).toBe(false);
    expect(validation.nextAttemptAt).toBeNull();

    const unavailable = shouldRetry(
      new ConnectorError("connector-unavailable", "Down."),
      1,
      DEFAULT_RETRY_POLICY,
      clock,
      noJitter,
    );
    expect(unavailable.retry).toBe(true);
    expect(unavailable.attemptsRemaining).toBe(2);

    const exhausted = shouldRetry(
      new ConnectorError("connector-unavailable", "Down."),
      3,
      DEFAULT_RETRY_POLICY,
      clock,
      noJitter,
    );
    expect(exhausted.retry).toBe(false);
    expect(exhausted.reason).toMatch(/attempts were used/);
  });

  it("classifies a partial application as not retryable", async () => {
    const { isRetryableCode } = await import("@/integrations/core/errors");
    expect(isRetryableCode("partial")).toBe(false);
    expect(isRetryableCode("timeout")).toBe(true);
    expect(isRetryableCode("capability-not-declared")).toBe(false);
    expect(isRetryableCode("connector-unavailable")).toBe(true);
  });

  it("gives every error code a label, so no failure renders as a blank", async () => {
    const { INTEGRATION_ERROR_CODES, INTEGRATION_ERROR_LABELS } = await import(
      "@/integrations/core/errors"
    );
    for (const code of INTEGRATION_ERROR_CODES) {
      expect(INTEGRATION_ERROR_LABELS[code].en.length).toBeGreaterThan(4);
      expect(INTEGRATION_ERROR_LABELS[code].de.length).toBeGreaterThan(4);
    }
  });
});

describe("source freshness computation", () => {
  it("reports stale beyond the threshold and current inside it", async () => {
    const { computeFreshness } = await import("@/integrations/mappings/CanonicalMapper");
    const { fixedClock } = await import("@/integrations/core/ConnectorContext");
    const clock = fixedClock("2026-10-06T12:00:00.000Z");

    expect(
      computeFreshness({
        lastSyncAt: "2026-10-06T11:30:00.000Z",
        stalenessThresholdMinutes: 60,
        clock,
      }),
    ).toBe("fresh");

    expect(
      computeFreshness({
        lastSyncAt: "2026-10-06T10:30:00.000Z",
        stalenessThresholdMinutes: 60,
        clock,
      }),
    ).toBe("stale");

    // Exactly at the threshold is not yet stale.
    expect(
      computeFreshness({
        lastSyncAt: "2026-10-06T11:00:00.000Z",
        stalenessThresholdMinutes: 60,
        clock,
      }),
    ).toBe("fresh");
  });

  it("reports live only for a push based source", async () => {
    const { computeFreshness } = await import("@/integrations/mappings/CanonicalMapper");
    const { fixedClock } = await import("@/integrations/core/ConnectorContext");
    const clock = fixedClock("2026-10-06T12:00:00.000Z");

    expect(
      computeFreshness({
        lastSyncAt: "2026-10-06T11:59:00.000Z",
        stalenessThresholdMinutes: 60,
        pushBased: true,
        clock,
      }),
    ).toBe("live");

    expect(
      computeFreshness({
        lastSyncAt: "2026-10-06T11:59:00.000Z",
        stalenessThresholdMinutes: 60,
        pushBased: false,
        clock,
      }),
    ).toBe("fresh");
  });

  it("keeps never read separate from read a long time ago", async () => {
    const { computeFreshness } = await import("@/integrations/mappings/CanonicalMapper");
    expect(computeFreshness({ lastSyncAt: null, stalenessThresholdMinutes: 60 })).toBe("unknown");
    expect(computeFreshness({ lastSyncAt: "not a date", stalenessThresholdMinutes: 60 })).toBe(
      "unknown",
    );
  });

  it("does not report a source as impossibly fresh when its clock runs ahead", async () => {
    const { computeFreshness, ageInMinutes } = await import(
      "@/integrations/mappings/CanonicalMapper"
    );
    const { fixedClock } = await import("@/integrations/core/ConnectorContext");
    const clock = fixedClock("2026-10-06T12:00:00.000Z");

    // Five minutes in the future. Clamped to zero rather than trusted.
    expect(
      computeFreshness({
        lastSyncAt: "2026-10-06T12:05:00.000Z",
        stalenessThresholdMinutes: 60,
        clock,
      }),
    ).toBe("fresh");
    expect(ageInMinutes("2026-10-06T12:05:00.000Z", clock)).toBe(0);
  });
});

describe("conflict policy selection", () => {
  it("never treats a re-read from the same source as a disagreement", async () => {
    const { resolveConflict } = await import("@/integrations/mappings/ConflictPolicy");
    const outcome = resolveConflict({
      policy: "escalate-to-human",
      incomingConnectorInstanceId: "CI-GRC-SIM",
      incomingSourceUpdatedAt: "2026-10-06T09:00:00.000Z",
      incomingVersion: "v2",
      existing: {
        connectorInstanceId: "CI-GRC-SIM",
        sourceUpdatedAt: "2026-10-06T08:00:00.000Z",
        externalVersion: "v1",
      },
      systemOfRecordInstanceId: "CI-GRC-SIM",
    });
    expect(outcome.apply).toBe(true);
    expect(outcome.conflicted).toBe(false);
  });

  it("lets the system of record win and refuses the other source", async () => {
    const { resolveConflict } = await import("@/integrations/mappings/ConflictPolicy");
    const competitor = {
      connectorInstanceId: "CI-GRC-SIM",
      sourceUpdatedAt: "2026-10-06T08:00:00.000Z",
      externalVersion: "v1",
    };

    const fromRecord = resolveConflict({
      policy: "source-of-record-wins",
      incomingConnectorInstanceId: "CI-GRC-SIM",
      incomingSourceUpdatedAt: "2026-10-06T09:00:00.000Z",
      incomingVersion: "v2",
      existing: { ...competitor, connectorInstanceId: "CI-PI-SIM" },
      systemOfRecordInstanceId: "CI-GRC-SIM",
    });
    expect(fromRecord.apply).toBe(true);
    expect(fromRecord.conflicted).toBe(false);

    const fromOther = resolveConflict({
      policy: "source-of-record-wins",
      incomingConnectorInstanceId: "CI-PI-SIM",
      incomingSourceUpdatedAt: "2026-10-06T09:00:00.000Z",
      incomingVersion: "v2",
      existing: competitor,
      systemOfRecordInstanceId: "CI-GRC-SIM",
    });
    expect(fromOther.apply).toBe(false);
    expect(fromOther.conflicted).toBe(true);
    expect(fromOther.note).toMatch(/system of record/);
  });

  it("does not let a missing timestamp win a recency contest", async () => {
    const { resolveConflict } = await import("@/integrations/mappings/ConflictPolicy");
    const outcome = resolveConflict({
      policy: "most-recent-wins",
      incomingConnectorInstanceId: "CI-PI-SIM",
      incomingSourceUpdatedAt: null,
      incomingVersion: null,
      existing: {
        connectorInstanceId: "CI-GRC-SIM",
        sourceUpdatedAt: "2026-10-06T08:00:00.000Z",
        externalVersion: "v1",
      },
      systemOfRecordInstanceId: "CI-GRC-SIM",
    });
    expect(outcome.apply).toBe(false);
    expect(outcome.conflicted).toBe(true);
    expect(outcome.note).toMatch(/did not report when it last changed/);
  });

  it("escalates by keeping the value and flagging the disagreement", async () => {
    const { resolveConflict } = await import("@/integrations/mappings/ConflictPolicy");
    const outcome = resolveConflict({
      policy: "escalate-to-human",
      incomingConnectorInstanceId: "CI-PI-SIM",
      incomingSourceUpdatedAt: "2026-10-06T09:00:00.000Z",
      incomingVersion: "v2",
      existing: {
        connectorInstanceId: "CI-GRC-SIM",
        sourceUpdatedAt: "2026-10-06T08:00:00.000Z",
        externalVersion: "v1",
      },
      systemOfRecordInstanceId: "CI-GRC-SIM",
    });
    // Both: the value is shown and the disagreement stays visible.
    expect(outcome.apply).toBe(true);
    expect(outcome.conflicted).toBe(true);
  });

  it("never overwrites, and says so", async () => {
    const { resolveConflict } = await import("@/integrations/mappings/ConflictPolicy");
    const outcome = resolveConflict({
      policy: "never-overwrite",
      incomingConnectorInstanceId: "CI-M365-SIM",
      incomingSourceUpdatedAt: "2026-10-06T09:00:00.000Z",
      incomingVersion: "v2",
      existing: {
        connectorInstanceId: "CI-GRC-SIM",
        sourceUpdatedAt: "2026-10-06T08:00:00.000Z",
        externalVersion: "v1",
      },
      systemOfRecordInstanceId: "CI-GRC-SIM",
    });
    expect(outcome.apply).toBe(false);
    expect(outcome.conflicted).toBe(true);
  });

  it("accepts the first reading of an object with no competitor", async () => {
    const { resolveConflict } = await import("@/integrations/mappings/ConflictPolicy");
    const outcome = resolveConflict({
      policy: "never-overwrite",
      incomingConnectorInstanceId: "CI-GRC-SIM",
      incomingSourceUpdatedAt: null,
      incomingVersion: null,
      existing: null,
      systemOfRecordInstanceId: null,
    });
    expect(outcome.apply).toBe(true);
    expect(outcome.conflicted).toBe(false);
  });
});

describe("canonical mapping and deep links", () => {
  it("reports unmapped fields rather than dropping them", async () => {
    const { mapExternalRecord } = await import("@/integrations/mappings/CanonicalMapper");

    const mapped = mapExternalRecord(
      {
        externalType: "grc.control",
        externalId: "CTL-PAY-014",
        externalUrl: null,
        externalVersion: "v1",
        sourceUpdatedAt: "2026-10-06T08:00:00.000Z",
        canonicalType: "Control",
        canonicalId: "CTL-PAY-014",
        title: "Payment repair secondary review",
        summary: "Partially effective.",
        fields: { reference: " CTL-PAY-014 ", effectiveness: "partially-effective", novelField: 7 },
      },
      {
        id: "SMAP-TEST",
        connectorInstanceId: "CI-GRC-SIM",
        externalType: "grc.control",
        canonicalType: "Control",
        fieldMappings: [
          { externalField: "reference", canonicalField: "reference", transform: "trim" },
          { externalField: "effectiveness", canonicalField: "effectiveness" },
        ],
        taxonomyMappings: [
          {
            dimension: "effectiveness",
            externalValue: "partially-effective",
            canonicalValue: "partially-effective",
          },
        ],
        conflictPolicy: "source-of-record-wins",
        notes: "",
      },
    );

    expect(mapped.canonicalType).toBe("Control");
    expect(mapped.fields.reference).toBe("CTL-PAY-014");
    expect(mapped.fields.effectiveness).toBe("partially-effective");
    // The new field the source started sending is surfaced, not swallowed.
    expect(mapped.unmappedFields).toStrictEqual(["novelField"]);
  });

  it("reports a taxonomy value the mapping does not cover", async () => {
    const { mapExternalRecord } = await import("@/integrations/mappings/CanonicalMapper");

    const mapped = mapExternalRecord(
      {
        externalType: "grc.finding",
        externalId: "ISS-1",
        externalUrl: null,
        externalVersion: null,
        sourceUpdatedAt: null,
        canonicalType: "Finding",
        canonicalId: "ISS-1",
        title: "A finding",
        summary: "",
        fields: { severity: "catastrophic" },
      },
      {
        id: "SMAP-TEST",
        connectorInstanceId: "CI-GRC-SIM",
        externalType: "grc.finding",
        canonicalType: "Finding",
        fieldMappings: [{ externalField: "severity", canonicalField: "severity" }],
        taxonomyMappings: [
          { dimension: "severity", externalValue: "high", canonicalValue: "high" },
        ],
        conflictPolicy: "source-of-record-wins",
        notes: "",
      },
    );

    expect(mapped.unmappedTaxonomyValues).toStrictEqual([
      { dimension: "severity", externalValue: "catastrophic" },
    ]);
  });

  it("refuses a mapping that names a canonical type the product does not have", async () => {
    const { mapExternalRecord } = await import("@/integrations/mappings/CanonicalMapper");
    expect(() =>
      mapExternalRecord(
        {
          externalType: "grc.widget",
          externalId: "W-1",
          externalUrl: null,
          externalVersion: null,
          sourceUpdatedAt: null,
          canonicalType: "Control",
          canonicalId: "W-1",
          title: "",
          summary: "",
          fields: {},
        },
        {
          id: "SMAP-BAD",
          connectorInstanceId: "CI-GRC-SIM",
          externalType: "grc.widget",
          canonicalType: "Widget",
          fieldMappings: [],
          taxonomyMappings: [],
          conflictPolicy: "source-of-record-wins",
          notes: "",
        },
      ),
    ).toThrow(/not in CANONICAL_TYPES/);
  });

  it("builds a deep link and encodes an identifier that contains a separator", async () => {
    const { buildDeepLink } = await import("@/integrations/mappings/CanonicalMapper");
    expect(buildDeepLink("https://riskcore.arcadia.example/record/{externalId}", "TP-0042.3")).toBe(
      "https://riskcore.arcadia.example/record/TP-0042.3",
    );
    expect(buildDeepLink("https://x.example/r/{externalId}", "a/b c")).toBe(
      "https://x.example/r/a%2Fb%20c",
    );
    // Null when the connector cannot deep link, so the interface omits the link.
    expect(buildDeepLink(null, "CTL-PAY-014")).toBeNull();
    expect(buildDeepLink("", "CTL-PAY-014")).toBeNull();
  });
});

describe("the idempotency key", () => {
  it("is stable for the same change and different for a different one", async () => {
    const { buildIdempotencyKey } = await import("@/integrations/runtime/IdempotencyStore");
    const base = {
      runId: "run-001",
      commandKind: "updateAssessment",
      connectorInstanceId: "CI-GRC-SIM",
      targetExternalType: "grc.assessment",
      targetExternalId: null,
      payloadFingerprint: "abc123",
      decisionId: "DEC-2026-0772",
    };

    expect(buildIdempotencyKey(base)).toBe(buildIdempotencyKey({ ...base }));
    expect(buildIdempotencyKey({ ...base, payloadFingerprint: "def456" })).not.toBe(
      buildIdempotencyKey(base),
    );
    expect(buildIdempotencyKey({ ...base, decisionId: "DEC-2026-0783" })).not.toBe(
      buildIdempotencyKey(base),
    );
  });

  it("carries no clock and no counter, so a replay produces the same key", async () => {
    const { buildIdempotencyKey } = await import("@/integrations/runtime/IdempotencyStore");
    const key = buildIdempotencyKey({
      runId: "run-001",
      commandKind: "createAction",
      connectorInstanceId: "CI-GRC-SIM",
      targetExternalType: "grc.action",
      targetExternalId: null,
      payloadFingerprint: "abc123",
    });
    expect(key).not.toMatch(/\d{13}/);
    expect(key).toBe(
      "run-001|no-decision|CI-GRC-SIM|createAction|grc.action|new|abc123",
    );
  });
});

/* ==========================================================================
   Database backed: deduplication, idempotency, dead letter
   ========================================================================== */

describe("the runtime against a database", () => {
  let runtime: typeof import("@/integrations/runtime/IntegrationRuntime");
  let seedScenario: typeof import("@/db/seed/run").seedScenario;
  let seedIntegrations: typeof import("@/integrations/seed").seedIntegrations;
  let ids: typeof import("@/integrations/seed");
  let events: typeof import("@/integrations/connectors/simulated/events");
  let simulated: typeof import("@/integrations/connectors/simulated");
  let requireScenarioState: typeof import("@/scenario/engine/state").requireScenarioState;
  let grantApproval: typeof import("@/scenario/engine/decide").grantApproval;
  let fingerprintPayload: typeof import("@/server/security/authority").fingerprintPayload;

  beforeAll(async () => {
    createTemporaryDatabase("integration-unit");
    ({ seedScenario } = await import("@/db/seed/run"));
    ids = await import("@/integrations/seed");
    seedIntegrations = ids.seedIntegrations;
    runtime = await import("@/integrations/runtime/IntegrationRuntime");
    events = await import("@/integrations/connectors/simulated/events");
    simulated = await import("@/integrations/connectors/simulated");
    ({ requireScenarioState } = await import("@/scenario/engine/state"));
    ({ grantApproval } = await import("@/scenario/engine/decide"));
    ({ fingerprintPayload } = await import("@/server/security/authority"));
  });

  afterAll(() => {
    destroyTemporaryDatabase();
  });

  beforeEach(() => {
    seedScenario();
    seedIntegrations();
    simulated.resetExternalStore();
    runtime.clearInboundHooks();
  });

  it("refuses an operation the connector does not declare, in the runtime", () => {
    const instance = runtime.requireConnectorInstance(ids.CI_PROCESS_INTELLIGENCE);
    expect(instance.capabilities.write).toStrictEqual([]);
    expect(() => runtime.assertCapability(instance, "write", "pi.process")).toThrow(
      /does not declare "write"/,
    );
    // And the declared read still works, so the refusal is specific.
    expect(() => runtime.assertCapability(instance, "read", "pi.process")).not.toThrow();
  });

  it("refuses every operation against a planned adapter", () => {
    const planned = runtime
      .listConnectorInstances({ mode: "planned" })
      .at(0);
    expect(planned).toBeDefined();
    if (!planned) return;
    expect(() => runtime.assertCapability(planned, "read", "anything")).toThrow(
      /planned adapter/,
    );
    expect(runtime.canPerform(planned.id, "read", "anything")).toBe(false);
  });

  it("deduplicates an inbound event on connector plus event key", () => {
    const state = requireScenarioState();
    const event = events.processDeviationEvent({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      atMoment: "10:30",
    });
    expect(event).not.toBeNull();
    if (!event) return;

    const first = runtime.ingestInboundEvent(event);
    expect(first.status).toBe("published");

    const liveEventsAfterFirst = rowCount("workday_live_events");
    const second = runtime.ingestInboundEvent(event);

    expect(second.status).toBe("deduplicated");
    expect(second.deduplicated).toBe(true);
    expect(second.integrationEventId).toBe(first.integrationEventId);
    // The decisive assertion: no second live day event.
    expect(rowCount("workday_live_events")).toBe(liveEventsAfterFirst);
  });

  it("refuses an inbound event type the connector does not declare, and records the rejection", () => {
    const state = requireScenarioState();
    const event = events.processDeviationEvent({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      atMoment: "10:30",
    });
    if (!event) return;

    const result = runtime.ingestInboundEvent({
      ...event,
      eventType: "pi.something.nobody.declared",
      eventKey: "pi.undeclared:1",
    });

    expect(result.status).toBe("rejected");
    expect(result.liveEventId).toBeNull();
    expect(result.message).toMatch(/does not declare the inbound event type/);
  });

  it("publishes the inbound hook with the identifiers another layer needs", () => {
    const state = requireScenarioState();
    const received: Array<Record<string, unknown>> = [];
    const unsubscribe = runtime.registerInboundHook((payload) => {
      received.push(payload as unknown as Record<string, unknown>);
    });

    const event = events.processDeviationEvent({
      runId: state.runId,
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      atMoment: "10:30",
    });
    if (!event) return;
    runtime.ingestInboundEvent(event);
    unsubscribe();

    expect(received).toHaveLength(1);
    const payload = received[0];
    expect(payload?.liveEventId).toBeTruthy();
    expect(payload?.integrationEventId).toBeTruthy();
    expect(payload?.canonicalType).toBe("Control");
    expect(typeof payload?.aiPreparationAllowed).toBe("boolean");
  });

  it("maps an external record onto a canonical object and keeps its external identity", async () => {
    const state = requireScenarioState();
    const outcome = await runtime.runSync({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      objectType: "grc.control",
      atMoment: state.currentMoment,
    });

    expect(outcome.status).toBe("ok");
    expect(outcome.recordsMapped).toBeGreaterThan(10);

    const references = runtime.referencesForConnector(state.runId, ids.CI_GRC);
    expect(references.length).toBe(outcome.recordsMapped);
    const sample = references[0];
    expect(sample?.externalType).toBe("grc.control");
    expect(sample?.canonicalType).toBe("Control");
    // The external identity is what makes the projection openable at source.
    expect(sample?.externalId.length).toBeGreaterThan(0);
    expect(sample?.externalUrl).toMatch(/riskcore\.arcadia\.example/);
  });

  it("reserves one command per idempotency key and finds the existing row on a replay", async () => {
    const state = requireScenarioState();
    const values = {
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      commandKind: "createAction",
      idempotencyKey: "test|replay|key",
      actingUserId: "P-003",
      roleId: "rcsa",
      actorKind: "human",
      authorityClass: "APPROVAL_REQUIRED" as const,
      approvalId: null,
      decisionId: null,
      toolName: "createAction",
      sourceCanonicalType: "Action",
      sourceCanonicalId: "ACT-TEST",
      targetExternalType: "grc.action",
      targetExternalId: null,
      expectedVersion: null,
      payload: { title: "Test" },
      payloadDigest: "digest",
      intentStatement: "Create a test action",
      status: "proposed" as const,
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: null,
      lastError: "",
      correlationId: "COR-TEST",
      traceId: "TRC-TEST",
      atMoment: state.currentMoment,
      createdAt: new Date().toISOString(),
      queuedAt: null,
      executedAt: null,
      acknowledgedAt: null,
      sequence: 0,
    };

    const { reserveCommand } = await import("@/integrations/runtime/IdempotencyStore");
    const first = reserveCommand({ ...values, id: "ICM-TEST-1" });
    const second = reserveCommand({ ...values, id: "ICM-TEST-2" });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.command.id).toBe("ICM-TEST-1");
    expect(rowCount("integration_commands")).toBe(1);
  });

  it("moves an exhausted command to dead letter without touching the approval", async () => {
    const state = requireScenarioState();
    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, false);

    const payload = { title: "An action nobody can deliver", decisionId: "DEC-2026-0772" };
    const approvalId = grantApproval({
      decisionId: "DEC-2026-0772",
      toolName: "createAction",
      payloadFingerprint: fingerprintPayload("createAction", payload),
      rationale: "Confirmed as my own.",
      rationaleConfirmed: true,
    });
    const approvalsBefore = rowCount("approvals");

    const result = await runtime.dispatchCommand(
      {
        runId: state.runId,
        connectorInstanceId: ids.CI_GRC,
        commandKind: "createAction",
        toolName: "createAction",
        actingUserId: "P-003",
        roleId: "rcsa",
        actorKind: "human",
        autonomyLevel: state.autonomyLevel,
        approvalId,
        decisionId: "DEC-2026-0772",
        sourceCanonicalType: "Action",
        sourceCanonicalId: "ACT-DEADLETTER",
        targetExternalType: "grc.action",
        payload,
        intentStatement: "Create a remediation action",
        atMoment: state.currentMoment,
      },
      { jitter: runtime.noJitter },
    );

    expect(result.status).toBe("dead-letter");
    expect(result.attempts).toBe(3);
    expect(rowCount("dead_letter_entries")).toBe(1);
    // The approval and the decision survive. Only the delivery failed.
    expect(rowCount("approvals")).toBe(approvalsBefore);
    expect(rowCount("external_execution_receipts")).toBe(0);
    expect(runtime.hasNoAcknowledgedReceipt(result.commandId ?? "")).toBe(true);

    simulated.setSystemAvailability(simulated.GRC_SYSTEM_KEY, true);
  });

  it("computes source attribution from the real tables, with a deep link and a freshness state", async () => {
    const state = requireScenarioState();
    await runtime.runSync({
      runId: state.runId,
      connectorInstanceId: ids.CI_GRC,
      objectType: "grc.control",
      atMoment: state.currentMoment,
    });

    const sources = runtime.getSourceAttribution({
      runId: state.runId,
      canonicalType: "Control",
      canonicalId: "CTL-PAY-014",
    });

    const grc = sources.find((source) => source.connectorInstanceId === ids.CI_GRC);
    expect(grc).toBeDefined();
    expect(grc?.mode).toBe("simulated");
    expect(grc?.recordCount).toBe(1);
    expect(grc?.freshness === "live" || grc?.freshness === "fresh").toBe(true);
    expect(grc?.deepLink).toMatch(/riskcore\.arcadia\.example/);
    // Nothing in the view model could carry a credential.
    expect(JSON.stringify(sources)).not.toMatch(/secret|credential|token/i);
  });

  it("withholds a final recommendation when a required source has not answered", () => {
    const state = requireScenarioState();
    const before = runtime.checkRequiredSources({
      runId: state.runId,
      contextType: "Control",
      contextId: "CTL-PAY-014",
      canonicalType: "Control",
      canonicalId: "CTL-PAY-014",
    });

    expect(before.satisfied).toBe(false);
    expect(before.missing.length).toBeGreaterThan(0);
    expect(before.statement).toMatch(/withheld/);
    // The missing source is named, so the card can say which one.
    expect(before.missing[0]?.sourceSystem.length).toBeGreaterThan(0);
  });

  it("selects the declared conflict policy for a mapping and escalates for an unmapped type", () => {
    const grcControl = runtime.selectConflictPolicy({
      connectorInstanceId: ids.CI_GRC,
      externalType: "grc.control",
    });
    const piDeviation = runtime.selectConflictPolicy({
      connectorInstanceId: ids.CI_PROCESS_INTELLIGENCE,
      externalType: "pi.deviation",
    });
    const unmapped = runtime.selectConflictPolicy({
      connectorInstanceId: ids.CI_GRC,
      externalType: "grc.nothing",
    });

    expect(grcControl).toBe("source-of-record-wins");
    expect(piDeviation).toBe("escalate-to-human");
    // The cautious default: an unmapped type never silently overwrites.
    expect(unmapped).toBe("escalate-to-human");
  });

  it("degrades the Graph adapter to the sandbox profile with no credential", async () => {
    const instance = runtime.requireConnectorInstance(ids.CI_MICROSOFT_GRAPH);
    expect(instance.secretStatus).toBe("absent");
    expect(instance.mode).toBe("sandbox-ready");

    const state = requireScenarioState();
    const health = await runtime.checkConnectorHealth(ids.CI_MICROSOFT_GRAPH, {
      runId: state.runId,
    });
    expect(health.state).toBe("healthy");
    expect(health.secretStatus).toBe("absent");

    const record = await runtime.readRecord({
      runId: state.runId,
      connectorInstanceId: ids.CI_MICROSOFT_GRAPH,
      objectType: "graph.user",
      externalId: "P-003",
    });
    // It really reads, and it reads the seeded institution.
    expect(record?.title).toBeTruthy();
    expect(record?.externalType).toBe("graph.user");
  });
});
