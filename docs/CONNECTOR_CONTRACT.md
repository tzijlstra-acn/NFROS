# The connector contract

What a connector is, what it must declare, what it receives, what it may
return, and what a new one has to implement.

The contract lives in `src/integrations/core/Connector.ts`. This document
explains the parts that are decisions rather than syntax.

---

## 1. The interface

```ts
interface Connector {
  metadata(): ConnectorMetadata;
  health(context): Promise<ConnectorHealth>;
  capabilities(): ConnectorCapabilities;
  search(query, { objectType, limit }, context): Promise<ConnectorSearchResult>;
  read(objectType, externalId, context): Promise<ConnectorReadResult>;
  sync(request, context): Promise<ConnectorSyncResult>;
  execute(envelope, context): Promise<ConnectorAcknowledgement>;
  subscribe?(context): Promise<ConnectorSubscription>;
}
```

`subscribe` is optional. A document repository that supports neither webhooks
nor a change feed has nothing honest to return, and an optional member says
that more clearly than a method that answers `mechanism: "none"` forever.

Everything else is required, including on a connector that cannot do it. A
read only connector implements `execute` and throws
`capability-not-declared`. That is deliberate: the refusal is a code path, it
is reachable by a test, and a connector written next year cannot acquire a
write capability by leaving a method out.

### What a connector does not receive

No database handle. No credential. No environment access. No user object.

A connector is constructed from its `connector_instances` row and is given a
`ConnectorContext` per call. That is the whole surface. "A connector cannot
widen its own authority" is therefore a structural statement rather than a
convention someone has to remember.

---

## 2. Capability declaration

```ts
interface ConnectorCapabilities {
  read: string[];        // object types it can fetch by identifier
  search: string[];      // object types it can search
  events: string[];      // event types it can deliver inbound
  draft: string[];       // object types it can prepare a draft against
  write: string[];       // object types it can change
  attachments: boolean;
  deepLinks: boolean;
  deltaSync: boolean;
  webhooks: boolean;
}
```

An empty array means the connector cannot do that at all, and it is the common
and correct case. Most connectors in this build are read only and `write: []`
is how they say so.

**The runtime enforces the declaration, not the connector.** `assertCapability`
in `src/integrations/runtime/IntegrationRuntime.ts` is the only gate, and it
runs before the connector is touched. If each adapter checked its own
capabilities, then an adapter with a bug would be the only thing standing
between an undeclared write and the bank's system of record. Moving the check
up means the refusal is tested once rather than once per adapter.

`sync` is derived rather than declared: it maps onto `read` plus the
`deltaSync` flag. A connector that can fetch an object but has no change feed
cannot be asked for a delta. An earlier draft gave sync its own array and the
result was two lists that silently disagreed about the same object type.

### Declaring once

A connector module exports its capability constant and
`src/integrations/seed.ts` writes the same constant into
`connector_instances.capabilities`. One source of truth, because the runtime
gates on the row and the connector reports the constant. A drift between the
two would make the capability refusal untestable.

---

## 3. Readiness modes

Every instance declares exactly one mode, and the mode is the claim the
integration centre makes on screen.

| Mode | Meaning |
| --- | --- |
| `live` | Connected to a real endpoint, reading real data. |
| `sandbox-ready` | The adapter is built and runs against a sandbox or live tenant when one is supplied. With no credential it reads the seeded institution and says so. |
| `simulated` | Projects the seeded institution through the real connector contract. No vendor adapter is implemented and no credential is required. |
| `configured-unavailable` | The adapter and its mappings exist and no endpoint is reachable. Changes routed here are queued and then need a retry. |
| `planned` | Named on the roadmap and not built. Every operation is refused rather than returning an empty result. |

The refusal on a `planned` adapter is the important one. An empty result is the
dangerous outcome, because it is indistinguishable from a working connector
with nothing to report.

### The credential rule

`connector_instances` stores `secretStatus`, which is one of `not-required`,
`absent`, `present` or `invalid`. It never stores a credential, and no
component in the interface has a prop a credential could travel in. Every
simulated connector reports `not-required`: the complete local experience works
with no key configured anywhere.

---

## 4. The command envelope

Every outbound change carries:

| Field | Why it is on the envelope |
| --- | --- |
| `commandId` | The durable record of intent, written before anything is sent. |
| `idempotencyKey` | Unique. A replay finds the row rather than creating a second object. |
| `actingUserId`, `roleId`, `actorKind` | Who, under what role, as a person or an agent. |
| `authorityClass` | The class the gate evaluated. |
| `payloadFingerprint` | Binds the approval to this exact change. |
| `approvalId` | Null only where the class genuinely needs no approval. |
| `decisionId` | The human judgment this consequence belongs to. |
| `toolName` | A real entry in `TOOL_REGISTRY`. |
| `sourceCanonicalType`, `sourceCanonicalId` | The local object. |
| `targetExternalType`, `targetExternalId` | The external object. Null target means create. |
| `expectedVersion` | Optimistic concurrency, where the connector supports one. |
| `intentStatement` | Plain language, shown to the approver before they approve. |
| `correlationId`, `traceId` | One logical operation, one attempt. |
| `atMoment`, `attempt` | Scenario clock, and which attempt this is. |

The envelope is long because the alternative is passing a payload and letting
each connector reconstruct who authorised it, which is how an audit trail ends
up with an external write nobody can attribute.

### Authority

The dispatcher calls `evaluateAuthority` from
`src/server/security/authority.ts`. It does not reimplement any part of it and
there is no separate authority path for integration actions. An external write
is the highest consequence action the product can take, so if it had its own
gate then the gate the trust page documents would no longer be the gate that
matters.

The runtime's own refusals, an undeclared capability, a planned adapter, a
disabled write, happen **before** the gate. A missing capability is a
configuration fact, not a question of who is allowed to do something, and
recording it as an authority denial would misattribute it to the acting role.

### Approval consumption

The local tool runtime consumes an approval after execution. The dispatcher
deliberately does not, and the reason is worth stating.

Here the replay guard is the unique index on `idempotency_key`: a second
attempt at the same change finds the same command row, and a second *different*
change produces a different payload fingerprint and therefore fails the gate's
payload binding. Single use is preserved structurally either way.

Consuming the approval would break the behaviour that matters more. A transport
failure would leave the operator holding a dead letter whose approval had
already been spent, so pressing retry would require a person to approve again a
decision they already took.

---

## 5. Idempotency

The key is built by `buildIdempotencyKey`:

```
runId | decisionId | connectorInstanceId | commandKind | targetExternalType | targetExternalId | payloadFingerprint
```

No timestamp and no counter, because a key that changes between attempts is not
an idempotency key. The payload fingerprint is included so that approving
"partially effective" and then dispatching "ineffective" produces a different
key and therefore a different command. Without it, a second, different change
would be swallowed as a duplicate of the first, and the user would see an
acknowledgement for a change the target never received.

`reserveCommand` uses `onConflictDoNothing` plus a read rather than a select
followed by an insert. A select has a window in which two callers both see
nothing and both insert, and in this product the two callers are plausible: a
user pressing retry while the outbox drain is already working on the same
command.

A connector may also be idempotent on the key, and the simulated ones are. That
is additional, not a substitute: the durable guarantee is the index.

---

## 6. Versioning

`expectedVersion` on the envelope is the optimistic concurrency token, and
`ConnectorAcknowledgement.externalVersion` is what the target returns. A
connector that supports versioning compares them and throws
`version-mismatch`, which is **not** retryable: another change reached the
target first and a person has to look at it.

A connector whose source has no version concept returns
`externalVersion: null`, and the mapper records that honestly rather than
synthesising one. `external_references.external_version` null means the source
cannot tell us, which is a different statement from "unchanged".

---

## 7. Error taxonomy

`src/integrations/core/errors.ts`. `retryable` is a property of the code, not a
judgment at the call site.

| Code | Retryable | Meaning |
| --- | --- | --- |
| `capability-not-declared` | no | The runtime refused an operation the connector never claimed. |
| `connector-not-registered` | no | No implementation for that key. |
| `connector-not-implemented` | no | A planned adapter. |
| `authority-denied` | no | The gate refused. |
| `connector-unavailable` | **yes** | The target is down. |
| `authentication-missing` | no | No credential configured. |
| `write-not-enabled` | no | Writing is disabled on this instance. |
| `validation-failed` | no | The target rejected the request. |
| `not-found` | no | The target object does not exist. |
| `conflict` | no | Another change reached the target first. |
| `version-mismatch` | no | The expected version no longer matches. |
| `rate-limited` | yes | Too many requests. |
| `timeout` | yes | No answer in time. |
| `transport` | yes | The connection failed. |
| `partial` | **no** | Part applied, part not. A person has to look. |
| `cancelled` | no | Stopped deliberately. |
| `unknown` | yes | Unclassified. |

Two choices to defend:

`connector-unavailable` is retryable, so an approved decision can be delivered
when the target comes back. If unavailability were permanent the operator would
have no path back other than re-approving a decision a person already took.

`partial` is not retryable. A partially applied write needs a human to see what
landed before anything is sent again.

`unknown` is retryable. The default errs towards delivering an approved human
decision rather than abandoning it, and the bounded attempt count stops the
error from looping.

### What may go in `detail`

`ConnectorError.detail` is written to `integration_commands.last_error`, which
the integration centre displays. It must carry the classification and the
object identity only: never payload content, never an endpoint with a token,
never anything a credential could be reconstructed from.

---

## 8. What a new connector must implement

1. **A capability constant**, exported from the module. The seed writes it into
   the instance row. Start from `NO_CAPABILITIES` and opt in.
2. **`metadata()`**, including a `readinessNote` that a reviewer can read to
   understand the honest status, and a `mode` that does not overclaim.
3. **`health()`**, returning a real state. `secretStatus` is a state, never a
   value.
4. **`read`, `search`, `sync`**, or an honest refusal for each one the
   capability set does not declare.
5. **`execute`**, returning a `ConnectorAcknowledgement` only when the target
   accepted the change and returned a reference for it. Anything else throws a
   classified `ConnectorError`. There is no "probably fine" shape: the receipt
   writer accepts only an acknowledgement, so an unacknowledged write cannot
   produce a receipt line.
6. **`subscribe()`** if and only if the connector has a subscription.
7. **Registration** in `src/integrations/connectors/simulated/index.ts`
   through `registerConnector(key, factory)`.
8. **Instance rows, mappings and sync state** in `src/integrations/seed.ts`,
   including a staleness threshold appropriate to how fast that source
   actually changes.
9. **A statement function** producing the plain language receipt line. "The
   record was updated" is not a line a risk professional can check; "RCSA
   assessment version created in the GRC platform as GRC-000004" is.

### What a new connector must not do

- Read an environment variable, a file or a credential.
- Open a database handle.
- Return a fabricated acknowledgement for a request it did not make.
- Declare a capability it has not implemented.
- Claim a mode more advanced than the truth.
- Put payload content, an endpoint with a token, or anything secret into an
  error `detail` or a log line.

---

## 9. The inbound side

A connector does not push. Something pushes to
`POST /api/integrations/webhook/[connector]`, or the sync coordinator pulls.
Either way the ten step inbound pipeline in
`src/integrations/runtime/EventIngestion.ts` runs, and the connector's only
obligations are to declare the event type in `capabilities.events` and to have
a subscription other than `none`.

`eventKey` is supplied by the sender and is the deduplication key. It must be
derived from the source event identity and nothing else. A key containing a
clock makes every replay look novel, which defeats the unique index that exists
to catch exactly that.
