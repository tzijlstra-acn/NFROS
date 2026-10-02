# Productization gaps in the integration layer

What a real engagement would still have to build. This document is
deliberately unflinching. A gap list that reads as a roadmap is marketing; this
one is an estimate of work, written so that nobody discovers any of it in week
three.

Scope: the integration runtime, the connectors, the registry, the pipelines and
the administrator screens. Gaps in the AI layer, the workday interface and the
scenario engine are other documents' problems.

---

## 1. The honest summary

This build contains a **real integration contract** and **no real
integration**.

The connector interface, the registry, the two pipelines, the outbox, the
idempotency guarantee, the retry policy, the dead letter handling, the conflict
policy, the freshness model, the receipt discipline and the authority
enforcement are all implemented and tested. They would not need to be rewritten
to connect a real system.

What does not exist: a single line of code that makes an outbound network call.
No HTTP client, no authentication, no credential storage, no signature
verification, no vendor schema. Every connector in this build reads the seeded
SQLite database or refuses.

That is the correct shape for a prototype whose purpose is to prove the
governance model, and it means the first real connector is a larger piece of
work than the twenty instances on the integrations screen suggest.

---

## 2. Per connector gaps

### The generic webhook endpoint (`webhook.generic`)

**No signature verification.** This is the first thing to close and it is not
close to optional. `POST /api/integrations/webhook/[connector]` accepts any
well formed body for any declared connector. Anyone who can reach the endpoint
can inject an event that creates a live day beat, flags a control as
conflicted, and triggers AI preparation.

What is enforced today is structural only: the connector must exist, must not
be planned, must declare the event type, must have a subscription. That stops a
misconfiguration, not an attacker.

To close it: a per connector shared secret, HMAC over the raw body with a
timestamp inside the signed material, constant time comparison, a replay window
shorter than the deduplication retention, and a rejection path that records the
attempt without logging the body. The secret has to live somewhere, which is
section 3.

**No delivery ordering or sequence gap detection.** Two events about the same
object delivered out of order produce whichever projection arrived last. There
is no sequence number on the envelope and no mechanism to notice a missing one.

**No backpressure.** The handler processes synchronously. A burst produces a
burst of SQLite writes on the request thread.

### The generic REST adapter (`generic-rest`)

Mapped and implemented, with no endpoint. Needs: an HTTP client with connection
pooling, a request signing or bearer scheme, a pagination contract, a schema
contract for `rest.record`, a response size limit, and a decision about whether
the product tolerates a source that cannot report a version or a change
timestamp.

### Microsoft Graph (`microsoft-graph`)

The sandbox profile works and exercises the vocabulary mapping. The live profile
refuses, because none of the following exists:

- An application registration, the client credentials or on behalf of flow, and
  token acquisition and refresh.
- The real Graph calls. The sandbox projections are shaped like Graph
  responses; they are not Graph responses. Field names, pagination (`@odata.nextLink`),
  delta tokens (`@odata.deltaLink`) and error bodies all differ.
- Change notification subscriptions, which expire and must be renewed, and
  whose validation handshake the webhook endpoint does not implement.
- Throttling handling. Graph returns 429 with `Retry-After`, which the retry
  policy would need to honour instead of using its own backoff.
- Permission scoping. Reading one mailbox versus the tenant is a different
  consent, and the product currently has no model for which mailbox it is
  entitled to read.

The adapter declares no write capability and that is a product decision rather
than a gap. Writing to a real mailbox or calendar is outside what this product
does.

### The four simulators

The GRC, Microsoft 365, process intelligence and document repository simulators
read the seeded database. They are faithful to the **contract** and not to any
vendor. Specifically:

- **No vendor schema.** `grc.control` has the fields this scenario needs. A
  real Archer or ServiceNow control object has dozens, configured per client,
  and no generic mapping is possible for Archer at all.
- **The cursor is not a change token.** `applyCursor` orders by external
  identifier and resumes after the last one returned. A real delta feed returns
  changes since a token and includes deletions; this cannot express a deletion
  at all.
- **No deletions, anywhere.** `external_references` has no tombstone. An object
  removed in the source system remains projected forever.
- **The simulated external store is in process memory.** `external-store.ts`
  does not survive a restart. The durable idempotency guarantee in this product
  is the unique index on `integration_commands.idempotency_key`, not that map,
  and the proof script asserts both. A restart mid proof would show the command
  as acknowledged with no external object behind it, which is a limitation of
  the simulator rather than of the runtime.
- **No attachments.** `capabilities.attachments` is declared true on three
  connectors and nothing reads a binary. The evidence corpus is text in a
  column.
- **Latency is real but trivial.** Every simulated call completes in under a
  millisecond, so no timeout path and no concurrency path is exercised by the
  simulators.

### The ten planned adapters

Each carries its prerequisite in `PLANNED_ADAPTERS`. The prerequisites are the
honest blockers and worth repeating here because they are the actual cost:

- **RSA Archer** needs a per application field mapping. Archer schemas are
  configured per client; there is no generic adapter to write.
- **SAP GRC** needs a decision about the integration route, because the usable
  surface differs sharply between the on premise and cloud products.
- **Celonis** needs an existing data model for the payment processes in scope.
  Without one there is nothing to read.
- **Splunk** needs an agreed alert taxonomy. Without one every alert arrives as
  an undifferentiated signal and the inbound pipeline cannot classify severity.
- **Entra ID** needs a decision about how group membership maps onto the
  authority scopes, which is a governance question rather than an engineering
  one.

Estimating any of these as "one connector" is the mistake. The adapter is the
small part; the mapping, the taxonomy agreement and the system of record
designation are the work.

---

## 3. Authentication and secret management

**Nothing in this build stores a credential.** `connector_instances` holds a
four valued `secretStatus` and no value. That is correct for a prototype and
insufficient for anything else.

A real deployment needs:

- A secret store. Azure Key Vault or the equivalent, with the product holding a
  managed identity and never a key.
- Per connector, per tenant, per environment credential scoping. One GRC
  instance per legal entity means one credential per instance, and the registry
  already supports several instances per key for exactly this reason.
- Rotation without downtime, which means two valid credentials during a
  rotation window and a connector that can try the new one and fall back.
- A `secretStatus` that is observed rather than configured. Today the column is
  seeded; it should be the result of a real authentication probe, and `invalid`
  should appear because a token was rejected, not because somebody set it.
- An audit trail of credential access that does not contain the credential.
- A decision about on behalf of versus service principal access. Reading the
  GRC platform as the product is simple and loses the user's own entitlements;
  reading it as the user is correct and much harder.

The current `scan:secrets` gate covers source, bundles, exports, logs and
screenshots. It does not and cannot cover a secret store, so the operational
control there is a different one.

---

## 4. Multi-tenancy

The whole build is single tenant and single run. `run_id` scopes the scenario,
not a customer.

What is missing:

- A tenant column on every integration table, and a query layer that cannot
  omit it. Row level isolation enforced by convention will leak.
- Per tenant connector instances, mappings, conflict policies and staleness
  thresholds. The mappings are global today.
- Per tenant secret scoping, per section 3.
- A noisy neighbour story. One tenant's sync of two hundred thousand controls
  currently blocks the process.
- Tenant aware deduplication. `ie_event_key_unq` is on connector plus event
  key; with shared connector instances across tenants that key would collide.

---

## 5. Scale

SQLite, one process, synchronous writes, no worker.

| Concern | Today | What a deployment needs |
| --- | --- | --- |
| Database | SQLite, one file, WAL | PostgreSQL with connection pooling |
| Outbox drain | A function called in a request | A worker with leasing, visibility timeouts and at least once delivery |
| Retry backoff | Computed and persisted, never slept on | A scheduler that wakes on `next_attempt_at` |
| Sync | Sequential, in a request or a script | A scheduled job per connector and object type, with concurrency limits |
| Sync paging | Whole projection in memory, then sliced | Streaming, with a bounded working set |
| Inbound bursts | Processed on the request thread | A queue in front of the pipeline |
| Full sync | Reads every row every time | Incremental, with a change token and a periodic reconciliation pass |
| Attribution | `getSourceAttribution` issues several queries per object | A single projected view, or caching with explicit invalidation |

`getSourceAttribution` is worth naming specifically: it queries references, sync
state and requirements per object. Rendering a focus queue of forty items calls
it forty times. At demonstration scale that is invisible and at real scale it is
the first thing to show up in a trace.

---

## 6. Observability

There is a redacting structured logger and an append only audit trail. There is
no observability.

Missing:

- Distributed tracing. `correlationId` and `traceId` exist on every command and
  every integration event and nothing exports them. They are the right fields;
  they need an OpenTelemetry exporter and propagation into the outbound HTTP
  call that does not yet exist.
- Metrics. Command throughput, attempt counts, dead letter depth, per connector
  error rates by code, sync lag per object type, projection staleness
  distribution. Every one of these is derivable from the tables today and none
  of them is emitted.
- Alerting. Dead letter depth above a threshold and sync lag beyond the
  staleness threshold are the two that matter operationally, because both mean
  a professional is looking at data they believe is current and is not.
- A health endpoint that aggregates connector health, rather than a screen that
  probes on render.
- Log sampling and retention. The logger writes one line per attempt; a real
  volume needs sampling for the successful path.

---

## 7. Data residency

The scenario spans German, Austrian and Swiss entities, and the Swiss entity is
supervised under a different framework. The integration layer currently has no
residency model at all.

Needed:

- A region per connector instance and per tenant, and a rule that a connector
  in one region cannot project an object attributed to an entity whose data may
  not leave another.
- Enforcement of the entity attribution the mappings already protect. The
  `never-overwrite` policy on ownership and legal entity exists because entity
  attribution determines which framework applies; nothing yet stops a
  projection crossing a boundary on the strength of that attribution.
- A decision on where `external_references` lives when the source is in another
  region, because the reference carries the external identifier and sometimes
  the title.
- Subprocessor transparency for the integration layer itself. The scenario's
  own supplier story is about an appendix that does not reach a subprocessor's
  subcontractors; a product that integrates into a bank is subject to the same
  question about its own hosting.
- A model for the one case the product deliberately refuses: supervisory
  notification. `notifySupervisor` is a PROHIBITED tool and must stay one, but
  a real deployment will be asked, and the answer has to be a documented
  position rather than a refusal with no rationale attached.

---

## 8. Retention

Nothing in the integration layer is ever deleted.

- `integration_events` grows one row per inbound delivery, forever. It is the
  deduplication index, so it cannot simply be truncated: a retention policy has
  to be longer than any plausible replay window and shorter than unbounded.
- `external_references` grows and never shrinks. There is no tombstone, so a
  deleted source object stays projected.
- `integration_commands` and `external_execution_receipts` are the external
  audit trail and arguably must be kept for as long as the local one. That is a
  retention decision with a legal input, not an engineering default.
- `dead_letter_entries` keeps resolved entries indefinitely, which is right for
  an audit and wrong for a worklist. The partition exists; the archive does not.
- `ai_activity_entries` receives a row per external change and has no retention
  at all.
- There is no right to erasure path. An external record projected into
  `external_references` carries an identifier and a title from the source
  system, and a deletion request against the source has no mechanism to
  propagate here.

---

## 9. Change management

The mappings are seeded TypeScript and the administrator screens are read only.
That is stated on screen, and it is a real gap.

- **No mapping editor.** A mapping change today is a code change and a reseed.
  An engagement will need to change a field mapping in an afternoon.
- **No validation against the source schema.** A mapping can name an external
  field the source does not send, and the only symptom is the field appearing in
  `unmappedFields`, which nothing alerts on.
- **No mapping version history.** When a projection changes, there is no way to
  see which mapping change caused it.
- **No dry run.** `resolveConflict` is pure and could preview what a policy
  change would do to existing references. Nothing calls it that way.
- **No migration path for a mapping change.** Changing a canonical type on a
  mapping orphans every reference already written under the old one.
- **No connector instance lifecycle.** Instances are created by the seed.
  There is no create, no decommission, no "this instance is being replaced by
  that one" with reference migration.
- **The staleness thresholds are code.** They are per connector and object type,
  which is right, and they are not configurable, which is wrong: how fast a
  source ages is a client specific fact.

---

## 10. Testing against real vendor APIs

This is the largest gap and the one most often underestimated.

Every test in this build runs against a simulator that the same authors wrote.
That proves the contract and proves nothing about any vendor.

What a real engagement needs:

- **A sandbox tenant per vendor**, which is a procurement and provisioning
  exercise measured in weeks, not an engineering task.
- **Contract tests** recorded against a real response, replayed in CI, and
  re-recorded on a schedule so that a vendor's breaking change is caught by the
  suite rather than by a user.
- **Error path tests against real errors.** The error taxonomy in this build
  maps cleanly onto codes because the simulators throw those codes. A real
  vendor returns an HTTP status, a body and sometimes a 200 containing a
  failure, and classifying those correctly is the work that decides whether
  retry helps or harms.
- **Throttling tests.** Every real API throttles differently and the retry
  policy currently ignores `Retry-After`.
- **Pagination and delta tests at volume.** A connector that works on fourteen
  controls and fails on fourteen thousand is the normal outcome.
- **Idempotency tests against the real target.** The guarantee in this build is
  that *the product* does not send twice. Whether *the target* treats a repeat
  as a duplicate is a property of the target, and some do not. For those, the
  connector has to carry a target side idempotency token, and not all vendors
  offer one.
- **A clock skew test.** `computeFreshness` clamps a source timestamp ahead of
  our clock. Real skew between a bank's systems is routinely minutes.
- **Permission tests.** A credential with less entitlement than expected
  currently surfaces as an empty result from a healthy connector, which is the
  exact failure mode the `planned` mode refusal exists to prevent, reappearing
  through a different door.

---

## 11. Smaller items, named so they are not forgotten

- `drainOutbox` makes one pass and is called by nothing on a schedule.
- `cancelCommand` exists and no interface calls it.
- The `partial` acknowledgement outcome is implemented in the receipt writer and
  no connector produces one, so the partial path is untested end to end.
- `ConnectorContext.signal` is honoured by `runAttempt` and no caller supplies
  one, so cancellation is reachable and unexercised.
- `actionSetConnectorAvailability` recovers the generic REST adapter to
  `configured-unavailable` rather than to anything better, which is honest and
  will read as a bug to somebody.
- The webhook endpoint accepts a connector key as well as an instance
  identifier and refuses an ambiguous key. That is the right behaviour and it
  means a sender configured against a family breaks the day a second instance
  appears.
- `source_requirements` is derived from the judgment kind at seed time. An
  uncovered judgment kind is now collected and printed by
  `scripts/seed-integrations.ts`, which is an improvement on silence and not a
  control: nothing fails, and a judgment kind added without a requirement entry
  would still let the AI layer publish through a gap. A deployment should make
  it an error.
- Nothing enforces that a connector's `metadata().mode` agrees with its
  instance row. The Graph adapter deliberately reports its profile rather than
  the row, which is correct for that case and means the general invariant does
  not hold.
- The integration centre probes connector health on render. At twenty instances
  that is twenty awaited calls in a server component.
