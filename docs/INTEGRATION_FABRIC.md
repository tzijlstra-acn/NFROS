# The integration fabric

How this product relates to the bank's existing systems, and the machinery that
makes the relationship real rather than decorative.

---

## 1. The system of engagement principle

The bank's GRC platform, document repository, process intelligence tool and
collaboration suite remain systems of record. This product is a system of
engagement: it orchestrates work across them, prepares judgments, and writes
back only what a person has approved.

That sentence is easy to say and expensive to mean. Three consequences follow
from meaning it, and all three are enforced structurally.

**Source identity survives normalisation.** Every object read from outside
keeps a row in `external_references` carrying the connector, the external type,
the external identifier, the external version and the source timestamp. A
record that came from the GRC platform can always be opened there again. A
projection that cannot be traced back to its source is a copy, and a copy is
what turns an integration layer into a second system of record, which is the
thing this product must not become.

**Nothing external is reported as done before the target says so.** An outbound
change is a row in `integration_commands` that moves through proposed,
approved, queued, executing, acknowledged. The receipt in
`external_execution_receipts` is written from the acknowledgement, and the
single writer refuses a command without an `acknowledgedAt`. A receipt line
cannot exist for a change the target never confirmed.

**Retry cannot duplicate.** `idempotency_key` is unique, and a replay of the
same approved command finds the existing row rather than creating a second
external object.

### The honesty constraint

Every connector instance declares exactly one readiness mode, and the
integration centre groups by it. A vendor name can never appear on screen
implying an integration that does not exist. A `planned` adapter declares no
capabilities, so the runtime refuses every operation against it rather than
returning an empty result, because an empty result is indistinguishable from a
working connector with nothing to report.

This build contains five simulated connectors, one sandbox ready adapter, one
configured but unreachable generic adapter, and ten named adapters that are
honestly marked planned. It contains no live connector, and it says so.

---

## 2. The inbound pipeline

Ten steps, in this order, in
`src/integrations/runtime/EventIngestion.ts`. The order is the design.

| # | Step | What it does |
| --- | --- | --- |
| 1 | identify the connector | Resolve the instance. An unknown instance stops here. |
| 2 | verify or validate the source | Three structural checks: not a planned adapter, declares the event type, has a subscription other than `none`. A refusal is recorded as a rejected integration event. |
| 3 | deduplicate | Insert with `onConflictDoNothing` against the unique index on connector plus event key. Zero changed rows means a repeat, and the pipeline stops, returning the identifier of the row that won. |
| 4 | map to a canonical object | Apply the `source_mappings` row. Unmapped fields and unmapped taxonomy values are reported, not dropped. |
| 5 | retain the raw external reference | Upsert `external_references`, keyed on connector plus external type plus external identifier. |
| 6 | create an integration event | Complete the row with the canonical identity and the reference. |
| 7 | trigger the product event | Publication, separate from the durable write, so a subscriber failure cannot lose the event. |
| 8 | update the live workday | Write `workday_live_events` with `derivedFrom: "integration"`, `integrationEventId` and `sourceConnectorIds`. |
| 9 | start evidence loading | Resolve which seeded evidence documents reference the object, bounded to eight. |
| 10 | start automatic AI preparation when policy allows | Evaluate the policy and publish the hook. |

### Why deduplication is step three

A webhook that fires twice fires twice quickly. A select that finds nothing,
twice, is how two live day events appear for one real signal. The unique index
closes the window; the application code's job is to notice the constraint
violation and return the row that won.

The deduplication key is supplied by the sender and must be derived from the
source event identity alone. No clock, no counter, no random component.

### The boundary at steps eight to ten

This module writes the `workday_live_events` row and returns its identifier. It
does not reach into the AI Partner or the live day components, which are owned
elsewhere. Instead it publishes a hook.

```ts
registerInboundHook((payload: InboundHookPayload) => void): () => void
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
  atMoment: string;
  severity: LiveEventSeverity;
  evidenceIds: string[];
  roleIds: RoleId[];
  requiresDecision: boolean;
  aiPreparationAllowed: boolean;
  aiPreparationBlockedReason: string;
  correlationId: string;
  traceId: string;
}
```

The payload carries identifiers rather than rows, so a subscriber reads what it
needs through its own repository and this module never becomes a transport for
another layer's view model.

A hook that throws is logged and ignored. An inbound signal from the bank's
process intelligence platform must not be lost because a presentation component
had a bad render, and the integration event row is already durably written by
the time hooks run.

`aiPreparationAllowed` is the policy answer, computed from the run's autonomy
level and the required source check. A subscriber may decline to prepare
anything; what it must not do is prepare something when this is false, because
that is the case where a required source has not answered.

---

## 3. The outbound pipeline

Ten steps, in `src/integrations/runtime/CommandDispatcher.ts`.

| # | Step | What it does |
| --- | --- | --- |
| 1 | begin as a proposed command | Reserve the row on its idempotency key. A replay finds the existing one. |
| 2 | pass the authority gate | Call `evaluateAuthority`. A refusal writes an audit event and the command is held or cancelled. |
| 3 | receive approval where required | The approval is bound to the payload fingerprint. |
| 4 | enter the outbox | Status queued. The durable record of intent exists before anything is sent. |
| 5 | execute through the target connector | Bounded attempts under a per attempt timeout. |
| 6 | receive an acknowledgement | `acknowledgedAt` is set here and only here. |
| 7 | persist an external receipt | Written from the acknowledgement. |
| 8 | update the local projection | The external identity the target returned becomes an `external_references` row. |
| 9 | create an audit event | Written before the receipt, so the receipt can cite it. |
| 10 | appear in the activity stream | A row in `ai_activity_entries` with the connector and the authority class. |

### The guarantee

Nothing between steps five and seven marks the change complete. The connector
either returns a `ConnectorAcknowledgement` or throws. On a throw, the command
is failed or dead lettered, no receipt row is written, and the human decision
behind it is left exactly as it was.

The optimistic version of this, writing the receipt when the request was sent,
is what makes an integration layer lie. It is forbidden by the schema comment
on `external_execution_receipts`, by the single writer in
`src/integrations/receipts/ExternalExecutionReceipt.ts` which throws without an
acknowledgement, and by a test in
`tests/integration/integration-flows.test.ts` that proves a failed execution
produces no acknowledged receipt line.

### Queued and failed states in the interface

A queued or failed line is **not** a row in the receipts table. It is projected
from the command row by `receiptLinesForDecision`, which merges acknowledged
receipts with commands still in flight. That keeps the table honest and still
lets a receipt read:

> Assessment version created in the GRC platform as GRC-000004.
> Supplier record update queued for the generic REST endpoint and not yet
> confirmed by the target system.

Both statements are true. A single tick against the whole decision is the thing
that makes an integration layer untrustworthy.

### The ordering of steps nine and seven

The audit event is created before the receipt, so the receipt line can carry
`auditEventId`. A reviewer reading "Assessment updated in the GRC platform" can
follow it to the audit record and from there to the approval and the decision.

---

## 4. Authority applies identically

There is one gate. `src/server/security/authority.ts`. The dispatcher calls
`evaluateAuthority` with the same five inputs the local tool runtime passes:
tool name, role, autonomy level, payload and approval.

A change to the bank's GRC platform is therefore subject to exactly the
conditions a change to a local record is subject to:

1. the tool's authority class must be reachable at the current autonomy level
2. the acting role must hold every required authority scope
3. where the class demands it, a valid, unconsumed, payload bound approval must
   exist, granted by a person, with rationale confirmed

And it is subject to two additional conditions that only apply externally:

4. the connector must declare a write capability for the target object type
5. the change cannot be reported as complete until the target acknowledges it

Conditions four and five are checked by the runtime, not by the gate.
Condition four happens **before** the gate, because a missing capability is a
configuration fact and recording it as an authority denial would misattribute a
configuration problem to the acting role.

`app/settings/authority/page.tsx` is a view of the gate read live from
`TOOL_REGISTRY` and `ROLE_AUTHORITY_SCOPES` at request time. It is read only
and there is no configuration table behind it. If it could be edited, the gate
the trust page documents would no longer be the gate that decides.

---

## 5. Reliability

| Mechanism | Where | Note |
| --- | --- | --- |
| Idempotency | `IdempotencyStore.ts` | Unique index on `idempotency_key`. |
| Bounded retries | `RetryPolicy.ts` | `maxAttempts` is not optional. |
| Exponential backoff | `computeBackoffDelay` | Doubling, clamped at `maxDelayMs`. |
| Jitter | injected `JitterSource` | Additive only. Jitter never shortens a delay. |
| Timeout | `runAttempt` | A real timer per attempt, with a derived abort signal. |
| Cancellation | `AbortSignal` on the context | Connectors must honour it. |
| Dead letter | `DeadLetterStore.ts` | Never deletes the decision or the approval. |
| Manual retry | `actionRetryIntegrationCommand` | Same command, same key, attempt counter reset. |
| Partial failure | `outcome: "partial"` | A receipt line that says what was not applied. |
| Conflict detection | `ConflictPolicy.ts` | Four declared policies per mapping. |
| Optimistic version | `expectedVersion` | Where the connector supports one. |
| Correlation and trace | `ConnectorContext` | One logical operation, one attempt. |
| Source timestamps | `external_references.source_updated_at` | From the source, never synthesised. |
| Local projections | `external_references` | Keyed on external identity. |

### Determinism in tests

The clock and the jitter source are injected rather than read from the ambient
environment. That is not stylistic. A backoff schedule built from `Date.now()`
and `Math.random()` cannot be asserted: the test either sleeps for the real
delay, which makes the suite slow and flaky, or it asserts a range, which means
the test passes when the policy is wrong by a factor of two. With both
injected, the retry test states the exact millisecond of every attempt.

### What the retry loop does not do

It does not sleep. The backoff schedule is computed and persisted on
`next_attempt_at`, which the outbox drain and the interface read, but a request
thread that blocked for the real delay would make the failure demonstration
take a minute and would hold a server action open for the same. A real
deployment needs a worker; that is recorded in
`docs/PRODUCTIZATION_GAPS.md`.

### Why a dead letter never rolls anything back

An approved decision whose delivery failed stays approved. The decision row,
the approval row and the audit trail are untouched; what failed is the delivery
of a consequence to one external system, and the interface says exactly that.

Rolling the decision back would teach the user that a recorded decision is
provisional until every downstream system agrees, which is both false and
corrosive to the accountability this product is about.

---

## 6. Conflict policy

Two systems disagree about the same object more often than any integration
design document admits. The decision has to be declared per mapping rather than
improvised per record.

| Policy | Behaviour |
| --- | --- |
| `source-of-record-wins` | The designated system of record wins. Another source may add fields but not change one the record owns. |
| `most-recent-wins` | The later source timestamp wins. A missing timestamp loses: a connector that cannot report when the source changed must not win by omission. |
| `escalate-to-human` | The incoming value is stored **and** the reference is flagged conflicted. The work object shows that two systems disagree. |
| `never-overwrite` | The first value recorded stands. A later, different value is kept as a note. |

`escalate-to-human` is the one that matters. A product that silently reconciles
a disagreement between two systems of record has destroyed the only signal that
the disagreement exists. So escalation does not mean "fail": it means accept
the value, flag the reference, and let the source row under the work object
show it.

An unmapped external type defaults to `escalate-to-human`. An unmapped type
arriving at the runtime is already a sign of misconfiguration, and quietly
overwriting a projection on the strength of it would be the worst available
response.

### Real examples from the seeded mappings

- A control rating from the GRC platform is `source-of-record-wins`. The rating
  is a recorded human conclusion and no other system changes it.
- A process intelligence deviation about the same control is
  `escalate-to-human`. The mining platform is entitled to disagree, and the
  disagreement is the finding.
- Ownership and legal entity are `never-overwrite`. Which entity holds an
  arrangement determines which supervisory framework applies to it, and no
  directory read moves that quietly.
- A document is `never-overwrite`. A later version is a new document that
  supersedes it, not an overwrite.

Both sides of a flagged conflict are marked. Otherwise the interface would show
the disagreement under one source and not the other, and a user looking at the
GRC row would have no indication that the mining row disputes it.

---

## 7. Freshness and source attribution

`getSourceAttribution` returns the `SourceAttribution[]` shape defined in
`src/workday/contracts.ts`. It is what the workday renders as the quiet source
row under a work object.

```ts
getSourceAttribution({
  runId, canonicalType, canonicalId, contextType?, contextId?, clock?
}): SourceAttribution[]
```

Freshness comes from `connector_sync_state.staleness_threshold_minutes`, which
is per connector and object type because two sources do not age at the same
rate. An assessment four hours old is current; a payment volume four hours old
is not.

| State | Meaning |
| --- | --- |
| `live` | Inside the threshold, from a push based source. |
| `fresh` | Inside the threshold, from a polled source. |
| `stale` | Outside the threshold. The interface says "Last known". |
| `unknown` | Never read at all. Deliberately not folded into stale. |

`lastSyncAt` advances only on a successful sync. A failed attempt that moved it
forward would make stale data look fresh, which is the most misleading thing
that table could do. A source timestamp ahead of our clock is clamped rather
than trusted.

The deep link comes from `connector_instances.deep_link_template` and is null
when the connector cannot deep link, in which case the interface omits it
rather than rendering a dead one. The identifier is URL encoded: external
identifiers in this domain contain dots and slashes.

Nothing in `SourceAttribution` could carry a credential. There is no field for
an endpoint, a token or a raw payload, which is why the view model is defined
in the contracts module rather than being the database row.

### Required sources

```ts
checkRequiredSources({
  runId, contextType, contextId, canonicalType?, canonicalId?, clock?
}): RequiredSourceCheck
```

The AI generation layer calls this before publishing a final recommendation.
`source_requirements` classifies each source as `required`, `helpful` or
`optional`, derived at seed time from the judgment kind of each decision.

`required` is used sparingly and deliberately, because it is the classification
that stops a recommendation being published. Over-using it would turn a real
guard into a constant obstruction that someone eventually works around.

`missing` and `stale` are kept separate because they warrant different copy: a
stale source constrains a recommendation, an absent required source prevents
one. The missing sources are named, so the card can say which one is absent
rather than offering a generic apology. "The GRC platform has not answered"
tells a professional whether to wait; "some information is unavailable" tells
them nothing.

A declared source with no records still appears in the attribution row.
"We did not ask" and "we asked and there was nothing" are different situations
for someone deciding whether to trust a conclusion.

---

## 8. The connector inventory in this build

### Simulated, five instances

| Instance | Source | Capabilities |
| --- | --- | --- |
| `CI-M365-SIM` | Microsoft 365 | Reads the seeded mail, calendar, meetings and people. Writes a simulated internal chat message only. |
| `CI-GRC-SIM` | GRC platform | Reads risks, controls, assessments, findings, actions, suppliers, services. Writes assessments, control ratings, findings, actions. The designated system of record. |
| `CI-PI-SIM` | Process intelligence | Reads processes, mined repair cases and derived signals. Read only: `write: []`. |
| `CI-DMS-SIM` | Document repository | Reads the seeded evidence corpus including the stale documents. Read only. Polled, so never reported as live. |
| `CI-WEBHOOK-GENERIC` | Inbound webhook | Events only. No read, no search, no sync, no write. |

Every simulated connector projects the seeded institution. There is no second
dataset. A source attribution row saying "GRC platform, 14 controls" means the
same fourteen controls the Operational Risk Partner is looking at. A simulator
that generated its own plausible controls would quietly falsify the product's
central claim at exactly the layer that is supposed to prove it.

### Sandbox ready, one instance

`CI-MSGRAPH`, Microsoft Graph. With no credential it reports `sandbox-ready`
and degrades to the Microsoft 365 simulator's projections under the Graph
vocabulary, so the Graph type to canonical type mapping is exercised locally
before a tenant exists. It declares no write capability in any profile: writing
to a real mailbox is outside what this product does, and `sendExternalEmail` is
a registered PROHIBITED tool.

With a credential present it reports `live` and refuses every operation with
`authentication-missing`. That looks backwards and is deliberate: the Graph
client is not implemented, and an adapter that claimed `live` and then served
simulator data would be the most dishonest thing in the product.

### Configured but unavailable, one instance

`CI-REST-GENERIC`, a generic REST adapter. Implemented, mapped, and with no
reachable endpoint, because this build makes no outbound network calls and
stores no credential. Every operation refuses with a retryable
`connector-unavailable`, so an approved change routed here produces a visible
queued command and then a dead letter. That is the state a real engagement sees
on the morning before the first endpoint is whitelisted.

### Planned, ten instances

ServiceNow IRM, RSA Archer, MetricStream, SAP GRC, Celonis, Entra ID, Azure
Data Lake, Databricks, Snowflake, Splunk. Each carries the capability it is
expected to cover and the prerequisite that has to be true before it can be
built. Each declares nothing and refuses everything.

---

## 9. Proving it

`npx tsx scripts/prove-integration.ts` runs headlessly against a disposable
database and prints a numbered transcript of twenty nine steps across three
parts: inbound, outbound and failure. Every line is an assertion that has
already been checked, and the script exits non-zero if any of them did not
hold.

It runs against a temporary database rather than the developer's own, because
it sets a connector unavailable and dead letters a command, and doing that to
the database somebody is about to present from would be worse than having no
proof.
