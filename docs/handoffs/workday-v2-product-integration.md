# Handoff: the integration runtime

Agent G. Connector contracts, the registry, inbound ingestion, the outbound
outbox, retries, dead letters, external execution receipts and the
administrator integration screens.

Read `docs/INTEGRATION_FABRIC.md` for how it works,
`docs/CONNECTOR_CONTRACT.md` for how to add a connector, and
`docs/PRODUCTIZATION_GAPS.md` for what a real engagement still has to build.

---

## 1. The one line you must add

`src/db/seed/run.ts` is not mine to edit. Two lines are needed there.

**Import**, with the other imports at the top of the file:

```ts
import { seedIntegrations } from "@/integrations/seed";
```

**Call**, inside the `writeEverything` transaction in `seedScenario`, as the
last statement after the `timelineRoleMoments` insert:

```ts
    total += seedIntegrations(runId).rowsWritten;
```

It must be inside the transaction and after the decisions are inserted. The
source requirements are derived from the seeded decisions, so running it before
them produces connectors that no decision depends on. It uses the same
`getDb()` handle, so it joins the surrounding transaction.

`seedIntegrations` clears its own tables for the run first, because the main
seed's `RUN_SCOPED_TABLES` list does not include the integration tables and a
reseed that accumulated instances would show the same connector four times
after four resets.

Until that line exists, run `npx tsx scripts/seed-integrations.ts` after
`npm run db:seed`.

---

## 2. The public API other layers call

Everything is exported from one module:

```ts
import { ... } from "@/integrations/runtime/IntegrationRuntime";
```

Importing it registers the connectors. Nothing else has to remember to.

### For the workday: source attribution under a work object

```ts
getSourceAttribution(query: {
  runId: string;
  canonicalType: string;          // "Control", "Supplier", "Assessment", ...
  canonicalId: string;
  contextType?: string;           // pass these two to get the real necessity
  contextId?: string;
  clock?: IntegrationClock;
}): SourceAttribution[]
```

```ts
// Convenience over the above, taking the workday's own object vocabulary.
sourcesForWorkObject(params: {
  runId: string;
  objectKind: string;             // "control", "supplier", "test-case", ...
  objectId: string;
  decisionId?: string | null;     // supplies the requirement context
  clock?: IntegrationClock;
}): SourceAttribution[]
```

```ts
getDecisionSourceAttribution(
  runId: string,
  decisionId: string,
  clock?: IntegrationClock,
): SourceAttribution[]
```

`SourceAttribution` is the shape already in `src/workday/contracts.ts`, so
`SourceRow` in `src/components/workday-v2/primitives.tsx` renders it with no
adaptation. Pass `contextType` and `contextId` if you want `necessity` to come
from the declared requirements rather than defaulting to `helpful`.

A declared source with no records still appears in the array, with
`recordCount: 0`. That is intentional: "we did not ask" and "we asked and there
was nothing" are different situations.

`canonicalTypeForObjectKind(objectKind: string): string` is exported if you
need the mapping without the query.

### For the AI layer: the required source check

Call this **before publishing a final recommendation**.

```ts
checkRequiredSources(params: {
  runId: string;
  contextType: string;            // "decision" or a canonical type
  contextId: string;              // the decision id or the canonical id
  canonicalType?: string;         // supply both to get attributions back
  canonicalId?: string;
  clock?: IntegrationClock;
}): RequiredSourceCheck
```

```ts
interface RequiredSourceCheck {
  satisfied: boolean;             // false means withhold the recommendation
  missing: MissingSource[];       // absent. Prevents a recommendation.
  stale: MissingSource[];         // present but old. Constrains one.
  attributions: SourceAttribution[];
  statement: string;              // render verbatim on the card
}

interface MissingSource {
  connectorInstanceId: string;
  sourceSystem: string;           // name it, do not apologise generically
  objectType: string;
  mode: string;
  reason: string;                 // one clause, renderable
}
```

Map it onto `aiSuggestions` like this:

- `satisfied === false` means do not publish a `recommendedAction`. Set
  `constrained: true` and `missingRequiredSources` to
  `check.missing.map((m) => m.sourceSystem)`.
- `satisfied === true` with a non empty `stale` also means
  `constrained: true`, but a recommendation may be published.
- `sources` on `AISuggestionView` is `check.attributions`.

`RequiredSourceNotice` in `src/components/integrations` renders the whole check
and returns null when there is nothing to say, so it can be rendered
unconditionally above a suggestion card.

There is also a convenience the inbound pipeline uses:

```ts
evaluateAiPreparationPolicy(params: {
  runId: string; canonicalType: string; canonicalId: string; clock?: IntegrationClock;
}): { allowed: boolean; reason: string }
```

It combines the run's autonomy level (nothing prepares automatically at
`assist`) with the required source check.

### For the live day: the inbound hook

The inbound pipeline writes the `workday_live_events` row itself and returns
its id. It does not touch the AI Partner or the live day components. Subscribe
to be told.

```ts
registerInboundHook(hook: (payload: InboundHookPayload) => void): () => void
clearInboundHooks(): void   // test and reset seam
```

```ts
interface InboundHookPayload {
  runId: string;
  integrationEventId: string;
  liveEventId: string | null;
  connectorInstanceId: string;
  sourceSystem: string;
  eventType: string;
  canonicalType: string;
  canonicalId: string;
  atMoment: string;               // scenario clock, e.g. "14:05"
  severity: LiveEventSeverity;
  evidenceIds: string[];          // already resolved against the seeded corpus
  roleIds: RoleId[];              // empty means every role
  requiresDecision: boolean;
  aiPreparationAllowed: boolean;  // respect this
  aiPreparationBlockedReason: string;
  correlationId: string;
  traceId: string;
}
```

Contract notes:

- The row is already durably written when hooks run. A hook that throws is
  logged and ignored.
- Identifiers, not rows. Read what you need through your own repository.
- **Do not prepare a suggestion when `aiPreparationAllowed` is false.** That is
  the case where a required source has not answered.
- The live day row carries `derivedFrom: "integration"`,
  `integrationEventId` and `sourceConnectorIds`, so a reader can verify no beat
  was invented.
- Register the hook from a module the server actually loads. Nothing in my code
  registers one.

### For the decisions view: receipt lines

```ts
receiptLinesForDecision(runId: string, decisionId: string): ExecutionReceiptLineView[]
receiptLinesForCommand(commandId: string): ExecutionReceiptLineView[]
receiptsForCommand(commandId: string): ExternalReceiptRow[]
receiptsForDecision(runId: string, decisionId: string): ExternalReceiptRow[]
hasNoAcknowledgedReceipt(commandId: string): boolean
```

`receiptLinesForDecision` returns the `ExecutionReceiptLineView` shape from
`src/workday/contracts.ts`, merging acknowledged receipt rows with commands
still in flight. A pending line has `status` queued, failed or `dead-letter`,
`externalId: null` and a statement that says plainly it is not confirmed.
`ExternalReceiptList` in `src/components/integrations` renders them.

Only acknowledged lines come from `external_execution_receipts`. Nothing else
writes to that table.

### For an outbound change

```ts
dispatchCommand(input: DispatchCommandInput, options?: DispatchOptions): Promise<DispatchResult>
retryCommand(commandId: string, options?: DispatchOptions & { autonomyLevel? }): Promise<DispatchResult>
drainOutbox(runId: string, options?: DispatchOptions): Promise<DispatchResult[]>
cancelCommand(commandId: string, reason: string): void
```

`input` needs a real `toolName` from `TOOL_REGISTRY` and an `approvalId` for
anything material. The payload you pass must be the exact payload the approval
was fingerprinted over, or the gate refuses with
`approval-payload-mismatch`. `grantApproval` in `src/scenario/engine/decide.ts`
and `fingerprintPayload` in `src/server/security/authority.ts` are the pair to
use.

`DispatchResult` never throws for an expected outcome. Check `blocked`,
`denialCode`, `acknowledged`, `deadLettered` and `status`. `steps` is the ten
step trace, suitable for an expandable panel.

### For reads and sync

```ts
readRecord({ runId, connectorInstanceId, objectType, externalId, ... }): Promise<ExternalRecord | null>
searchRecords({ runId, connectorInstanceId, objectType, query, limit?, ... }): Promise<ConnectorSearchResult>
runSync({ runId, connectorInstanceId, objectType, limit?, clock?, atMoment?, signal? }): Promise<SyncOutcome>
runAllSyncs({ runId, clock?, atMoment? }): Promise<SyncOutcome[]>
```

All four enforce the capability declaration before the connector is called.
`assertCapability(instance, operation, objectType)` throws and
`canPerform(instanceId, operation, objectType)` returns a boolean for an
interface that wants to hide a control rather than show a refusal.

### Inventory, health, queue, freshness

```ts
listConnectors(filter?): ConnectorInstanceView[]
getConnector(id): ConnectorInstanceView | null
checkConnectorHealth(id, { runId, atMoment?, clock? }): Promise<ConnectorHealth>
checkAllConnectorHealth({ runId, atMoment?, clock? }): Promise<Array<{ instance, health }>>
describeSubscription({ runId, connectorInstanceId, atMoment?, clock? })

listQueue(runId) | listAllCommands(runId) | listCommandsForDecision(runId, decisionId)
summariseOutbox(runId): OutboxSummary
listOpenDeadLetters(runId) | partitionDeadLetters(runId) | resolveDeadLetter(commandId, resolution)

computeFreshness({ lastSyncAt, stalenessThresholdMinutes, pushBased?, clock? }): FreshnessState
buildDeepLink(template, externalId): string | null
ageInMinutes(lastSyncAt, clock?): number | null
referencesForCanonicalObject(runId, canonicalType, canonicalId)
listSyncState(runId) | syncStateForConnector(runId, id) | listSourceRequirements(runId, ...)
selectConflictPolicy({ connectorInstanceId, externalType }) | resolveConflict(input)
```

### Server actions

`src/integrations/actions.ts`, all returning
`{ ok, message, detail: string[] }`:

```ts
actionRetryIntegrationCommand(commandId: string)
actionSetConnectorAvailability(connectorInstanceId: string, available: boolean)
actionTriggerSimulatedInboundEvent(connectorInstanceId: string)
actionRunConnectorSync(connectorInstanceId: string, objectType?: string)
```

### Stable identifiers

From `@/integrations/seed`: `CI_MICROSOFT_365`, `CI_GRC`,
`CI_PROCESS_INTELLIGENCE`, `CI_DOCUMENT_REPOSITORY`, `CI_WEBHOOK`,
`CI_MICROSOFT_GRAPH`, `CI_GENERIC_REST`, `SYSTEM_OF_RECORD_INSTANCE_ID`.

### Test seams

`fixedClock`, `manualClock`, `noJitter`, `seededJitter` from the runtime
export. `setSystemAvailability`, `countExternalObjects`, `countWriteAttempts`,
`resetExternalStore` from `@/integrations/connectors/simulated`.

---

## 3. Files created

**Core** `src/integrations/core/`: `Connector.ts`, `ConnectorRegistry.ts`,
`ConnectorContext.ts`, `errors.ts`

**Runtime** `src/integrations/runtime/`: `IntegrationRuntime.ts`,
`SyncCoordinator.ts`, `EventIngestion.ts`, `CommandDispatcher.ts`,
`RetryPolicy.ts`, `IdempotencyStore.ts`, `DeadLetterStore.ts`, `Outbox.ts`

**Mappings** `src/integrations/mappings/`: `CanonicalMapper.ts`,
`ConflictPolicy.ts`

**Receipts** `src/integrations/receipts/ExternalExecutionReceipt.ts`

**Connectors** `src/integrations/connectors/`
- `simulated/`: `index.ts`, `base.ts`, `scenario-source.ts`,
  `external-store.ts`, `events.ts`, `grc.ts`, `microsoft365.ts`,
  `process-intelligence.ts`, `document-repository.ts`
- `webhook/`: `GenericWebhookConnector.ts`, `index.ts`
- `generic-rest/`: `GenericRestConnector.ts`, `PlannedAdapter.ts`, `index.ts`
- `microsoft-graph/`: `MicrosoftGraphConnector.ts`, `index.ts`

**Seed and actions**: `src/integrations/seed.ts`, `src/integrations/actions.ts`

**Components** `src/components/integrations/`: `connector-health.tsx`,
`freshness.tsx`, `receipts.tsx`, `queue.tsx` (client), `index.ts`

**Routes**: `app/api/integrations/webhook/[connector]/route.ts`,
`app/settings/integrations/page.tsx`, `app/settings/mappings/page.tsx`,
`app/settings/authority/page.tsx`

**Scripts**: `scripts/seed-integrations.ts`, `scripts/prove-integration.ts`

**Tests**: `tests/unit/integration-runtime.test.ts` (37),
`tests/integration/integration-flows.test.ts` (22)

**Docs**: `docs/INTEGRATION_FABRIC.md`, `docs/CONNECTOR_CONTRACT.md`,
`docs/PRODUCTIZATION_GAPS.md`, this file

Nothing in the DO NOT MODIFY list was touched. No file under
`app/settings/layout.tsx`, `app/settings/page.tsx`,
`app/settings/organisation`, `branding`, `role-packs`, `deployment` or
`src/product/**` was created or changed.

---

## 4. The connector inventory

| Instance | Mode | Writes | Notes |
| --- | --- | --- | --- |
| `CI-M365-SIM` | simulated | `m365.chatMessage` | Seeded mail, calendar, meetings, people. No mail write: `sendExternalEmail` is PROHIBITED. |
| `CI-GRC-SIM` | simulated | assessment, control, finding, action | System of record for risk objects. |
| `CI-PI-SIM` | simulated | none | Read only by design. `write: []`. |
| `CI-DMS-SIM` | simulated | none | Seeded evidence corpus. Polled, never reported live. |
| `CI-WEBHOOK-GENERIC` | simulated | none | Inbound only. No read, search, sync or write. |
| `CI-MSGRAPH` | sandbox-ready | none | Degrades to the M365 simulator under the Graph vocabulary. |
| `CI-REST-GENERIC` | configured-unavailable | `rest.record` | Implemented, no reachable endpoint. Produces the dead letter path. |
| 10 planned instances | planned | none | ServiceNow IRM, RSA Archer, MetricStream, SAP GRC, Celonis, Entra ID, Azure Data Lake, Databricks, Snowflake, Splunk. Empty capabilities, every operation refused. |

No instance reports `secretStatus: "present"`. The complete local experience
requires no credential anywhere.

Every simulated connector projects the seeded institution. There is no second
dataset.

---

## 5. Brief acceptance criteria 69 to 89 and 92

| # | Criterion | How it is satisfied |
| --- | --- | --- |
| 69 | A documented connector contract with metadata, health, capabilities, search, read, sync, execute and optional subscribe | `src/integrations/core/Connector.ts`. All eight members, `subscribe` optional. `docs/CONNECTOR_CONTRACT.md`. |
| 70 | Capabilities declared per instance as read, search, events, draft, write, attachments, deep links, delta sync, webhooks | `ConnectorCapabilities`, stored on `connector_instances.capabilities` from the connector's own exported constant. |
| 71 | A connector that does not declare a capability is refused that operation by the runtime | `assertCapability` in `IntegrationRuntime.ts`, before the connector is called. Unit test "refuses an operation the connector does not declare, in the runtime"; integration test "refuses a write the connector never declared"; proof step 3. |
| 72 | A connector registry resolving a key to an implementation, and an instance to a connector | `ConnectorRegistry.ts`. Two separate lookups. An unregistered key is a hard failure, never an empty result. |
| 73 | At least five simulated connector instances covering M365, GRC, process intelligence, documents and a generic webhook | The five rows in the table above. |
| 74 | Simulated connectors return data derived from the existing seeded scenario | `simulated/scenario-source.ts` reads controls, risks, assessments, suppliers, services, processes, test cases, evidence, inbox, meetings, collaboration messages and users. No second dataset. Proof step 5 asserts the event's population equals the seeded case count. |
| 75 | A sandbox or live capable adapter that degrades cleanly with no credentials and requires none locally | `microsoft-graph`. `resolveProfile` reads `secretStatus` only. With none it reports `sandbox-ready` and reads through the M365 simulator. Unit test "degrades the Graph adapter to the sandbox profile with no credential". |
| 76 | Honest `planned` instances for a realistic set of named adapters | Ten in `PLANNED_ADAPTERS`, each with its expected capability and its prerequisite. Empty capabilities. Every operation refused with `connector-not-implemented`. |
| 77 | An inbound pipeline: identify, validate, deduplicate, map, retain, create event, trigger, update the live day, load evidence, start AI preparation | `EventIngestion.ts`, exactly ten steps returned in `IngestionResult.steps`. Proof step 6 asserts all ten ran. |
| 78 | Deduplication on connector plus event key | `ie_event_key_unq` and `onConflictDoNothing`. Unit test; integration test; proof step 7 proves one row from two deliveries. |
| 79 | The inbound event updates the live workday with integration attribution | `workday_live_events` with `derivedFrom: "integration"`, `integrationEventId`, `sourceConnectorIds`. Integration test; proof step 8. |
| 80 | An outbound pipeline: propose, gate, approve, outbox, execute, acknowledge, receipt, projection, audit, activity | `CommandDispatcher.ts`, exactly ten steps in `DispatchResult.steps`. Proof steps 12 to 17. |
| 81 | Every outbound command carries identity, authority, approval, source, target, expected version, correlation and trace | `OutboundCommandEnvelope` and the `integration_commands` columns. Proof step 14 asserts the approval, the authority class, the correlation id and the trace id. |
| 82 | Outbound commands pass through the same authority gate, with no separate path | `evaluateAuthority` is called directly. Integration tests cover `approval-missing`, `missing-scope` and `approval-payload-mismatch`. Proof steps 12 and 13. |
| 83 | Never mark an external update complete before acknowledgement; a receipt only from an acknowledgement | `markAcknowledged` is the only writer of `acknowledgedAt`; `writeReceiptFromAcknowledgement` throws without it. Integration test "produces no acknowledged receipt line". Proof step 23. |
| 84 | Idempotency: a replay finds the existing row and creates no second external object | Unique `idempotency_key`; `reserveCommand`. Proof step 18 and steps 25, 27, 29 assert the external object count. |
| 85 | Bounded retries, exponential backoff, timeout, cancellation, dead letter and manual retry | `RetryPolicy.ts`, `DeadLetterStore.ts`, `actionRetryIntegrationCommand`, `RetryQueue`. Six unit tests on the schedule with an injected clock and jitter. Proof steps 21 to 29. |
| 86 | A connector failure preserves the approved decision | Nothing in the failure path touches `decisions`, `approvals` or `audit_events` except to append. Integration test "preserves the approved decision and its approval". Proof step 22. |
| 87 | Conflict detection with a declared policy, and optimistic version checks | `ConflictPolicy.ts`, four policies per mapping; `expectedVersion` honoured by `applyExternalWrite` with `version-mismatch`. Seven unit tests. Proof step 10 asserts the disagreement is flagged with a note. |
| 88 | Source attribution with freshness, deep links and necessity, shown under a work object | `getSourceAttribution` returns the `SourceAttribution` shape `SourceRow` already renders. Per connector and object type thresholds. Proof steps 10 and 11. |
| 89 | A required source check the AI layer calls before a final recommendation | `checkRequiredSources`. `missing` prevents, `stale` constrains, both name the source. Unit test "withholds a final recommendation when a required source has not answered". Proof step 11. |
| 92 | Administrator integration screens: connectors by mode with health and capabilities, mappings with conflict policy, authority as a read only view of the gate | `app/settings/integrations`, `/mappings`, `/authority`. The retry queue has a working manual retry. No screen can display a credential. The authority screen states on the page that it is a view of the gate and not a second implementation. |

---

## 6. Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean, repository wide, zero errors |
| `npm run check:copy` | Passes repository wide. No finding of any severity in any file I own, and no em dash, en dash or umlaut character in any of them |
| `npx vitest run tests/unit/integration-runtime.test.ts` | 37 passed |
| `npx vitest run tests/integration/integration-flows.test.ts` | 22 passed |
| `npx vitest run tests/unit` | 418 passed, 10 files |
| `npx vitest run tests/integration` | 197 passed, 1 failed in `ai-partner-flows.test.ts`, another agent's file with no reference to the integration layer |
| `npx tsx scripts/prove-integration.ts` | Exit 0. 29 numbered steps, 0 assertions failed |
| `npx tsx scripts/seed-integrations.ts` | 185 rows. 5 simulated, 1 sandbox-ready, 1 configured-unavailable, 10 planned |
| `/settings/integrations`, `/settings/mappings`, `/settings/authority` | HTTP 200 against the running dev server |
| `POST /api/integrations/webhook/webhook.generic` | 202 published; 200 deduplicated on a repeat; 422 for an undeclared event type; 422 for a planned adapter |

### Not mine

`tests/integration/ai-partner-flows.test.ts:557` fails, expecting a null
suggestion where a cached one is returned. The file is untracked work in
progress and has zero references to `@/integrations`, so the integration layer
is not involved. Everything else in `tests/integration` passes.

An earlier em dash error in `scripts/verify-live-day.ts` was fixed by its owner
while this work was in progress. `npm run check:copy` now passes repository
wide.

---

## 7. What is incomplete

Everything substantive is in `docs/PRODUCTIZATION_GAPS.md`, which is written
to be read. The items that most affect the agents around me:

1. **No module registers an inbound hook.** The pipeline publishes one and
   nothing subscribes. Whoever owns the AI Partner or the live day player has
   to call `registerInboundHook` from a module the server loads.

2. **No scheduled drain.** `drainOutbox(runId)` makes one pass and nothing
   calls it on a schedule. A command that fails with one attempt remaining
   stays queued until a person presses retry. The default
   `attemptPolicy: "exhaust"` means `dispatchCommand` normally reaches a
   terminal state in one call, so this is only visible when a caller passes
   `"single"`.

3. **The retry loop does not sleep.** The backoff is computed and persisted on
   `next_attempt_at`; the loop attempts immediately. Honest and documented, and
   it means the persisted schedule is advisory rather than enforced.

4. **The simulated external store is in process memory.** The durable
   idempotency guarantee is the unique index; the store is a simulator detail
   that does not survive a restart.

5. **No signature verification on the webhook endpoint.** The first item in the
   gaps document. Structural validation only.

6. **`partial` acknowledgements are untested end to end.** The receipt writer
   handles the outcome and no connector produces one.

7. **`ConnectorContext.signal` is unexercised.** `runAttempt` honours it and no
   caller supplies one.

8. **The integration centre probes health on render.** Twenty awaited calls in
   a server component. Fine at this scale, named so nobody is surprised.

9. **The mappings and authority screens are read only** and say so. A real
   engagement needs a mapping editor with source schema validation and a
   change history.

10. **`fromFallbackRoute` is false for every seeded test case**, so the derived
    deviation signal leads with the unevidenced secondary review count (7 of
    100) and reports the fallback count honestly as zero. If the scenario later
    adds fallback route cases to the tested period, the headline metric in
    `processSignals` and `processDeviationEvent` should be revisited.
