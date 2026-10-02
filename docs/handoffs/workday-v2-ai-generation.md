# Workday V2: AI generation, chat and activity (server side)

This covers the server side of the AI Partner: automatic structured suggestion
generation, the persistent contextual chat, the three API routes,
deduplication, progressive stage reporting, and the presenter safe and offline
fallbacks.

An operational fact shapes every decision below. No usable OpenAI credential
is available in this environment: the key present resolves and is rejected by
the provider. The safe and offline paths are therefore the ones that carry the
product, and they are the ones that are fully verified. The live path is
correct by construction and provably falls back, and it is not treated as the
main case anywhere.

## Files

| File | What it owns |
| --- | --- |
| `src/agents/suggestions/generate.ts` | The generation service, the authoritative context, the required source interface, the mode branch, persistence |
| `src/agents/suggestions/digest.ts` | The state digest and both layers of deduplication |
| `src/agents/suggestions/stages.ts` | Stage sequencing and timing, shared by all three modes |
| `src/agents/suggestions/seeded.ts` | Eighteen authored cards: six roles, three beats, two languages |
| `src/agents/suggestions/prompt.ts` | The suggestion system prompt and the context renderer |
| `src/agents/suggestions/validate.ts` | Structured validation, grounding checks, copy rules (pure) |
| `src/agents/suggestions/seed.ts` | Cached beats, morning cards, the opening activity stream |
| `src/agents/chat/service.ts` | Threads, turns, context assembly, the gated action path |
| `src/agents/chat/prompt.ts` | The chat system prompt and the context renderer |
| `src/agents/chat/parts.ts` | Text to typed parts, connected system status parts |
| `src/agents/chat/seeded.ts` | Seven prepared, cited chat answers plus the decline |
| `src/agents/activity/record.ts` | Writes `ai_activity_entries` from real events only |
| `app/api/workday/suggestion/route.ts` | `POST /api/workday/suggestion` |
| `app/api/workday/chat/route.ts` | `POST /api/workday/chat` |
| `app/api/workday/chat/thread/route.ts` | `GET /api/workday/chat/thread` |
| `scripts/verify-ai-partner.ts` | 61 headless assertions, exits non-zero on failure |
| `tests/unit/suggestions.test.ts` | 92 pure tests |
| `tests/integration/ai-partner-flows.test.ts` | 43 tests against a seeded temporary database |

## The generation pipeline

```
authoritative context  ->  evidence set  ->  digest  ->  dedupe
  ->  required source gate  ->  mode branch  ->  validation  ->  persist
```

Validation sits after the mode branch rather than inside it, so live, cached
and seeded output all pass through identical checks. An earlier shape
validated only the live path on the grounds that authored content was already
trustworthy. That was wrong twice over: authored content drifts when the
scenario is reseeded, and a validator that only runs on the path nobody can
exercise is a validator nobody has tested.

### Authoritative context

`buildWorkdayContext` reads the role from the request and everything else from
the scenario run: autonomy level, scenario clock, acting user, world view,
language and demo mode. A client that claims a higher autonomy level, a
different acting user or a later clock changes nothing. `viewedMoment` is the
one value a caller may influence, because the live player genuinely owns it
and looking at an earlier moment grants nothing.

Verified by curl: posting `autonomyLevel`, `actingUserId` and `currentMoment`
in the body returns the same row with the same authority class.

### Automatic triggers

There is no Generate button. Thin wrappers in `generate.ts` cover every
trigger the brief names, and they all funnel into `generateSuggestion`, which
is why the deduplication can be complete: there is exactly one place that
could start duplicate work.

`onRoleOpened`, `onFocusItemSelected`, `onLiveEventArrived`,
`onDecisionOpened`, `onRefreshRequested`. Completing a meeting, approving an
action and switching to an affected role use `onFocusItemSelected` or
`onLiveEventArrived` with the relevant object.

Manual refresh is the `refresh` flag only.

## The dedupe design

Two layers, because they stop different failures.

**1. Persistent.** `stateDigest` is a SHA-256 prefix over role, object type,
object id, event id, viewed moment, autonomy level, world view, language and
the evidence id set. `findValidatedSuggestion` returns a row only when
`validated_at` is non null and `dismissed_at` is null, which is the database
side of the publication rule. Survives a reload and a second browser tab.

Three details that are not cosmetic:

- The evidence set is sorted and de-duplicated before hashing. The identifiers
  arrive from several repository calls whose ordering is not guaranteed, and an
  order sensitive hash would miss the cache on roughly every second request
  while passing a test that happened to build the list the same way twice.
- Autonomy level, world view and language are in the digest. All three change
  the content of a correct suggestion, and an earlier design that keyed only on
  role and object served German cached content to an English session.
- `resolveEvidenceSet` keeps only identifiers that resolve to a document. A
  decision record can cite a document revealed later in the day, and an
  unresolvable identifier would both destabilise the key and invite a citation
  the reader cannot open.

**2. In-process single flight.** `singleFlight(digest, work)` keyed on the
digest. Two requests arriving before the first writes its row would both miss
the persistent layer, so without this the persistent layer is useless under
exactly the conditions that matter. The caller is told whether it started the
work or joined, so the route reports `cached` honestly. The map entry is
cleared in `finally`: a rejected promise left in the map would make every
later request for that state await an already rejected promise, so one
transient failure would permanently poison one digest.

**Not creating another request.** The four conditions from the brief:

| Condition | Mechanism | `dedupeReason` |
| --- | --- | --- |
| A matching request is already running | single flight map | `running` |
| A valid cached response exists for the same state | digest lookup | `cached` |
| The current object has not changed | the object is in the digest | `cached` |
| Viewing historical time without a refresh | `viewedMoment < currentMoment` returns idle, writes nothing | `historical-view` |

## The three mode stage contract

Acceptance criterion 57. One visible state machine, three sources of truth
about when it advances. The interface cannot tell which mode it is in from the
shape of the progression, only from the discreet source label.

| Mode | Timing source | Content source |
| --- | --- | --- |
| live | `StageRecorder.mark` as the server reaches each stage | the model |
| safe | the recorded shape in `cached_ai_outputs`, normalised | the cached validated beat |
| offline | `seededStageShape()` | the authored module |

- **Live is never padded.** `StageRecorder` records elapsed time and waits for
  nothing. A progress animation that costs real latency is a lie the user pays
  for. The test asserts every live transition is under 500ms.
- **Safe replays a real shape.** The seed stores the stage transitions into the
  `stages` column and into the cached payload, so safe mode paces to a recorded
  shape rather than an invented curve. Gaps are clamped to
  `MAX_TRANSITION_MS` so a beat captured on a bad network cannot make safe mode
  slower than the live mode it stands in for.
- **The 300ms floor** (`MIN_TRANSITION_MS`) applies to a replayed transition
  only, and exists for one failure: cached content resolving in under a
  millisecond makes the interface jump from empty to complete, which reads as a
  glitch rather than as work.
- **Never empty to complete.** `validateStageSequence` rejects a progression
  that starts anywhere but `queued`, skips a stage, or moves backwards. All
  three modes are held to the same predicate by the tests and the verify
  script.
- **Held progressions.** `heldStageShape("retrieving" | "reconciling")` stops
  before `ready`, so `isPublishableState` is false and the interface cannot
  render a card. `reachedPublication` is deliberately separate from
  `validateStageSequence`, because a held progression is legal and must not be
  publishable; conflating the two is how a constrained interim view ends up
  rendered as a finished recommendation.

## Validation rules

`validateSuggestionDraft` is pure. Evidence resolution is injected as a
`ReadonlySet` rather than read from the database, which makes every rule
testable without a seeded scenario and lets the seed validate authored content
before writing rows it is in the middle of writing.

All rules are evaluated, not short circuited: a draft that fails three rules
reports three rules.

| Code | Rule |
| --- | --- |
| `schema` | `suggestionDraftSchema` (the shared `aiSuggestionSchema` plus `recommendedToolName` and the five array `groundingSchema`) |
| `dangling-evidence` | every id in `evidenceIds` **and in every grounding `sourceIds`** resolves to a real document |
| `unknown-tool` | a non null `recommendedAction` names a tool in `TOOL_REGISTRY`, so the authority class is computed rather than asserted |
| `prohibited-tool` | the named tool is not `PROHIBITED` |
| `uncited-recommendation` | a recommendation carries at least one citation |
| `em-dash` | no U+2014 in any copy field |
| `provider-name` | no provider, model or trace metadata in any copy field |
| `compliance-claim` | no assertion of compliance, and no guarantee |
| `savings-claim` | no saving, cost reduction or financial benefit |
| `missing-disclosure` | any regulatory reference carries "Illustrative regulatory context, not legal advice." verbatim |
| `swiss-dora` | no sentence puts the Swiss entity and an EU instrument together, **except** to say the instrument does not apply |
| `confidence-while-constrained` | confidence below 70 while `constrained` is true |
| `inference-as-record` | nothing with `model-inference` provenance appears under verified facts or approved records |

### Why `recommendedToolName` exists

`AISuggestionContent` is fixed by `src/workday/contracts.ts` and carries no
field for a tool name. Parsing a tool name out of the recommendation sentence
was tried and rejected: it made the copy read like an API call and it silently
resolved to `READ` whenever the parse missed. So the draft carries the tool
name and the grounding block alongside the contract shape, the validator
checks both, and `generate.ts` projects the result down onto the contract plus
the `authorityClass` column. The contract shape is rebuilt field by field
rather than spread, so a later addition to the draft schema cannot leak an
internal field into the payload the browser receives.

### On a validation failure

No partial unvalidated recommendation is ever published. The row is written
with `validatedAt` null so the failure is visible in the database and the
control room, and `findValidatedSuggestion` will not serve it. An audit event
is recorded with `blocked: true` and the failure codes, and a `blocked`
activity entry is written. The response reports `retryable: true`.

### Grounding

The five array discipline from `src/agents/schemas` is preserved verbatim:
`verifiedFacts`, `approvedRecords`, `stakeholderStatements`, `modelInference`,
`conflictingEvidence`. In the view model it surfaces as `checksCompleted`
(what was examined) being strictly separate from `actionsCompleted` (what was
changed) and from `recommendedAction` (what is proposed). Every authored card
has a non empty `checksCompleted` and an empty `actionsCompleted`, because
nothing in the seeded day actually changed a record, and the test asserts it.

`seeded.ts` has five separate constructors (`fact`, `record`, `stated`,
`inferred`, `conflict`) and deliberately no generic one taking a provenance
argument: a writer must choose the category by choosing the function, which is
how a stakeholder statement stops ending up filed as a verified fact.

Citation checking follows `src/agents/evaluations/suite.ts` and does not weaken
it: identifiers are checked against the corpus, and the grounding `sourceIds`
are checked as well as `evidenceIds`, because a citation smuggled into a
grounding statement is the one that would otherwise reach the interface
wearing the styling reserved for a verified record.

## The required source rule

### The interface

Agent G owns the integration runtime. Until it lands, `generate.ts` exports a
narrow interface and a default implementation that reads the tables directly.

```ts
export interface OutstandingSource {
  connectorInstanceId: string;
  sourceSystem: string;
  objectType: string;
  state: "loading" | "failed" | "unknown";
  detail: string;
}

export interface RequiredSourceStatus {
  allRequiredAvailable: boolean;
  outstanding: OutstandingSource[];
  attributions: SourceAttribution[];   // from src/workday/contracts.ts
}

export interface RequiredSourceQuery {
  runId: string;
  contextType: string;
  contextId: string;
}

export type RequiredSourceResolver = (q: RequiredSourceQuery) => RequiredSourceStatus;

export function setRequiredSourceResolver(resolver: RequiredSourceResolver): void;
export function resetRequiredSourceResolver(): void;          // tests
export function defaultRequiredSourceResolver(q: RequiredSourceQuery): RequiredSourceStatus;
```

**Agent G: call `setRequiredSourceResolver(yourResolver)` once at integration
runtime initialisation.** Nothing else is needed. The interface is narrow on
purpose: the integration runtime does not have to know anything about
suggestions, and this module does not have to know anything about connectors
beyond the three facts it uses.

Registration rather than a dynamic import is deliberate. A dynamic import of a
module that does not exist yet is a compile error under this project's
TypeScript settings, and a try block around it would hide a real integration
failure behind the same silence as a missing file.

### The default implementation

Reads `source_requirements` for the context, joins `connector_instances` and
`connector_sync_state`, and classifies: `unavailable` health or a `failed`
sync is **failed**; a `never-run` or `running` sync is **loading**.

A context with **no recorded requirements is available**, not blocked. The rule
the brief states is that a *required* source must not be missing, and a context
declaring no required sources has none missing. Defaulting the other way would
hold every suggestion in the product at `retrieving` until the integration seed
lands, which reads as a deadlock rather than as discipline.

### Behaviour

| Situation | Behaviour |
| --- | --- |
| Required source still loading | state held at `reconciling`, never reaches `ready`, `suggestion` is null, the outstanding source is named in `error`, `retryable: true`. The evidence reads and a `waiting` activity entry are still written, so already loaded facts are inspectable. Continues automatically on the next request once available. |
| Required source failed | `constrained` column true, `missingRequiredSources` populated, `recommendedAction` and `alternatives` withdrawn, confidence capped at 40, the outstanding source prepended to `uncertainty`, `decisionRequired` false. `checksCompleted` is kept. `retryable: true`. |

## Chat context assembly

All of it server side. `postChatTurn` assembles: current role and holder,
legal entity and its recorded supervisory context, live scenario time, viewed
scenario time, the selected object, open decisions with their required
authority, unread live events (from `workday_live_events` minus
`workday_live_event_reads`), the current evidence set, the autonomy level in
force, previously recorded decisions with their rationale, and the relevant
conversation history.

Conversation history reuses `src/agents/sessions/session.ts`:
`getOrCreateSession`, `appendMessage`, `assembleContext` and `compactSession`.
No second mechanism is invented. The important consequence is that almost
nothing the afternoon depends on lives in the transcript, so compaction can
discard old turns without losing the thread.

**One open thread per role, not per object.** The chat has to survive
navigation between work objects, and a thread per object would reset the
conversation on every click. Each turn records `contextObjectType`,
`contextObjectId`, `contextEventId` and `contextDecisionId` instead, so the
thread reads correctly when the user comes back to it. Naming another role's
thread returns an empty list rather than its content.

### Typed parts

`src/agents/chat/parts.ts`. `ChatTurnPart` is **derived** from the
`chat_turns.parts` column type rather than restated, so the column and the
wire shape cannot drift.

All eleven kinds are implemented: `answer`, `evidence`, `uncertainty`,
`recommendation`, `alternative`, `proposed-action`, `approval-request`,
`execution-receipt`, `blocked`, `follow-up`, `source-status`.

`textToParts` maps **explicit labels** the prompt asks for, not heuristics over
free prose. A classifier guessing which sentence is a recommendation will be
wrong occasionally, and when it is wrong it presents a model inference with the
styling the product reserves for a cited record. An unlabelled line becomes an
`answer`, which is the harmless default; nothing is ever promoted into a
stronger kind by inference. A continuation line is appended to the part above
it, so a two sentence recommendation stays one recommendation.

`partsToPlainText` excludes `blocked` and `source-status` from the `plainText`
mirror, because that column feeds search and evaluation and a refusal is not an
answer to the question that was asked.

### Connected system status

Six states, as separate values rather than a boolean pair:
`read-from-source`, `prepared-locally`, `waiting-for-approval`,
`queued-for-external-execution`, `executed-externally`, `failed-externally`.
`prepared-locally` and `queued-for-external-execution` are the two a user is
most likely to confuse, and conflating them is how someone leaves a meeting
believing a change reached the bank's platform when it is sitting in a queue.

## The chat security property

A natural language request never bypasses connector capabilities, role
permissions, authority policy, human approval, idempotency, audit or external
acknowledgement. Held structurally, not by instruction.

1. `detectRequestedTool(input)` maps an action request onto a name in
   `TOOL_REGISTRY`. Deterministic and keyword based. It is not a classifier and
   must not become one: its job is to get an action request in front of the
   gate, and a model deciding which tool a sentence means would put a model
   between the user and the authority model. A phrase matching nothing is
   treated as a question, which is the safe default because a question cannot
   change a record.
2. The request goes through `executeTool` from `src/agents/tools/runtime.ts`,
   which is the same runtime the agents and the interface use: gate, handler,
   audit, observability, no bypass. There is no privileged path here and no
   tool name this module can reach that the rest of the server cannot.
3. The payload carries only the request text, nothing a model or the browser
   invented, so the approval a person grants is fingerprinted against this exact
   request.
4. The refusal the user reads is the gate's own `reason`, and the `blocked`
   part carries `denialCode` plus `refusedBy: "authority-gate"`.

**Ordering note.** Tool intent is resolved *before* the text guardrails run.
That looks backwards and is deliberate: the guardrails match patterns in free
text, and if they refused first then the product's evidence that the gate works
would be a regular expression. Letting the request reach the gate produces a
refusal attributable to the authority model.

Four outcomes, four part shapes, none of them written by this module's judgment
about whether the action was reasonable:

| Gate outcome | Parts produced |
| --- | --- |
| `blocked` | `answer` + `blocked` (with `denialCode`, `refusedBy`) + `answer` saying what it can do instead |
| `proposed` | `answer` + `proposed-action` + `approval-request` (bound to `payloadFingerprint`) + `source-status: prepared-locally` |
| `executed` | `answer` + `execution-receipt` per receipt statement (carrying the real `auditEventId`) + `source-status` |
| `failed` | `answer` + `source-status: failed-externally` |

Verified live by curl: `notify FINMA about this incident now` returns
`blocked: "prohibited"` with
`meta: { toolName: "notifySupervisor", denialCode: "prohibited", refusedBy: "authority-gate", authorityClass: "PROHIBITED" }`,
and a `tool_calls` row exists with `outcome = "blocked"`. The integration test
asserts the mechanism rather than the message, across five prohibited tools,
plus a `missing-scope` refusal for a tool the acting role has no scope for.

`executionReceiptPart` cannot be constructed from a model's claim that it did
something, because the audit event identifier has to come from a real audit
event.

## Activity

`src/agents/activity/record.ts` writes `ai_activity_entries` from real events
only. Two consequences in the API:

- `durationMs` is a **required** parameter, not an optional one with a default.
  A caller that has not measured the work has to pass zero explicitly and will
  notice.
- The only way to record a tool call is `recordToolCallActivity`, which takes
  the `ToolCallResult` the runtime returned, so the outcome, the authority class
  and the audit reference come from the gate rather than from the caller's
  description of what it thinks it did. `kind` is derived from the outcome.

API: `recordActivity`, `recordActivityBatch`, `recordToolCallActivity`,
`recordRetrievalActivity`, `getActivityEntries`, `getActivityForSuggestion`,
`nextActivitySequence`, `clearActivityForRun`.

Sequence numbers are read from the table rather than held in memory, because
the seed writes the opening stream in one process and the dev server appends in
another. An in-memory counter would restart at one and reorder the morning.

The opening stream is **projected** from `background_actions`, not authored. An
integration test asserts that every entry traces back to a background action
row, and another asserts no entry carries a zero duration. Durations are a
bounded, deterministic function of the recorded kind and evidence count, so two
seeds produce the same stream.

## Seeded coverage matrix

Eighteen cards: six roles, three beats, two languages each. Every identifier is
a real row: controls, suppliers, subprocessors, contracts, test cases,
obligations, indicators, services, tolerances, runbooks, themes, actions and
evidence documents. Evidence sets are taken from the authored
`timeline_role_moments` and the decision records, so a card cites what was in
front of that professional at that moment and nothing that had not yet arrived.

| Role | morning (07:45) | decision (11:45) | shared event (14:05) |
| --- | --- | --- | --- |
| `tprm` | supplier `TP-0042`, `DEC-2026-0741`, recovery time gap open 137 days, `createIssue` | contract `CTR-2023-0117-A3`, `DEC-2026-0759`, breach against material change against drafting gap, `createAction` | supplier `TP-0042`, `DEC-2026-0779`, five of six A5 notification fields absent, `activateMonitoring` |
| `rcsa` | risk `RSK-0211`, `DEC-2026-0771`, three Red indicators as one causal chain, `createAction` | control `CTL-PAY-014`, `DEC-2026-0772`, deviation rate unknown not four in sixty, `proposeControlRating` | risk `RSK-0211`, `DEC-2026-0782`, 138 route substitution overrides in fourteen minutes, `proposeResidualRisk` |
| `control-assurance` | test case `OVR-DE-20260714-0112`, `DEC-2026-0746`, self review exception 17 days inside an open action, `proposeFinding` | control test `TST-2026-0318`, `DEC-2026-0760`, two unconcludable items, `recordTestConclusion` | control test `TST-2026-0318`, `DEC-2026-0764`, population growing while a conclusion is held, `createAction` |
| `incident-resilience` | service `SVC-0042-05`, `DEC-2026-0749`, no Swiss fallback and no instance evidence, `createIssue` | runbook `RB-PAY-007`, `DEC-2026-0761`, runbook asserts an unchanged control environment, `draftFinding` | incident `INC-2026-0412`, `DEC-2026-0765`, the Swiss clock is the binding one, `proposeIncidentClassification` |
| `regulatory-change` | subprocessor `TP-0042.4`, `DEC-2026-0752`, two lanes with no shared fields, `proposeObligationApplicability` | obligation `OBL-2026-0088-002`, `DEC-2026-0762`, filing deficiency against scope definition, `recordObligationInterpretation` | obligation `OBL-2026-0117-001`, `DEC-2026-0787`, two classification tracks opened, `proposeObligationApplicability` |
| `nfr-governance` | theme `THEME-PAY-01`, `DEC-2026-0755`, four Red rows as a seven node chain, `draftCommitteeNarrative` | action `MSN-2026-0147`, `DEC-2026-0763`, 67 days past due with an ended dependency, `addCommitteeAgendaItem` | theme `THEME-PAY-01`, `DEC-2026-0781`, a zero tolerance with no detection, `proposeAgendaPriority` |

Priority is `high` for morning and decision, `critical` for the shared event.
45 distinct evidence identifiers are cited and all resolve.

**Strict object matching.** A card's copy is about one named object: it cites
that object's evidence, names the checks run against it and recommends an
action on it. `seededSuggestionForObjectStrict` returns only a card authored
about the requested identifier, and `generate.ts` publishes nothing when there
is no match, reporting "No prepared suggestion exists for `<id>`" while keeping
the evidence reads and open decisions usable. Serving the `CTL-PAY-014` card
under a different object identifier would publish prose about one record while
the row says another, which nobody notices until a reviewer opens the citation.
Matching is on the identifier alone, not the type, because callers are
independent components whose type strings ("test-case" against "control-test")
are not guaranteed to match.

The cache key follows the matched card's beat, not the clock. Those differ when
a user opens an object at a moment whose beat has no card for it.

### Seeded chat answers

Seven prepared, cited answers in both languages: the `CTL-PAY-014` rating, the
subprocessor appendix divergence, the Swiss entity's regulatory position, the
Swiss tolerance and its cut-off, the overdue action `MSN-2026-0147`, the state
of the event, and the causal chain behind the Red indicators.

Intent matching requires **every** keyword group to match, so a near miss
declines rather than guesses. A seeded paragraph that sounds like an answer to
a question it was not written for is the single most damaging output this
product could produce, because the entire claim is that a conclusion is
traceable to evidence. The decline names what mode the application is in, what
is still usable, which topics do have prepared answers (generated from the
seeded set, so it cannot drift), and that the question was recorded. When a
live call was attempted and failed, it says so and gives the redacted provider
reason, rather than blaming the mode: telling a presenter the wrong reason for
a fallback sends them to look in the wrong place.

## Seed wiring

**Already in place.** `src/db/seed/run.ts` now carries:

```ts
import { seedAiPartner } from "@/agents/suggestions/seed";
```

and, after `writeEverything()`:

```ts
const partner = seedAiPartner(runId);
counts["aiPartner"] = partner.rowsWritten;
total += partner.rowsWritten;
```

It must stay **outside** the transaction, because it validates authored content
against committed evidence rows.

It writes 36 cached beats, 6 validated morning cards and 165 activity entries,
and it is idempotent: it clears the four tables it owns first (and only the
`suggestion:` prefixed rows in `cached_ai_outputs`, since other agents' beats
share that table), so a reseed does not double the day. `run.ts` does not list
those four tables in its own clear list, which is why the clearing lives here.

Every beat is validated before it is written. A card with an invented
identifier, an em dash, a provider name, a compliance claim or the Swiss entity
attached to an EU instrument fails the seed rather than the demonstration. That
is the right place for it to fail: a seed error is a five minute fix.

## Route contracts

Implemented exactly as specified and verified by curl against the running dev
server.

```
POST /api/workday/suggestion
  body { roleId, objectType, objectId, eventId?, refresh?, viewedMoment? }
  ->   { suggestion: AISuggestionView | null,
         generation: { state, completedStages, label },
         cached: boolean,
         error?, retryable?,
         details?: { model, durationMs, source },
         dedupeReason? }

POST /api/workday/chat
  body { roleId, threadId?, input, selection? }
  ->   { threadId,
         turn: { id, author: "partner", parts: [{kind, text, refs?, meta?}], source, atMoment },
         blocked?, details?: { model, durationMs } }

GET  /api/workday/chat/thread?roleId=...&threadId=...
  ->   { threadId, turns: [{ id, author, parts, atMoment, contextObjectId }] }
```

`viewedMoment` and `dedupeReason` are additions, both optional and additive.
`threadId` on the GET is optional: without it the role's open thread is
returned, which is what a freshly loaded panel needs and saves it a round trip
to discover an identifier it has no way of knowing.

**Neutral product.** `details` is the only place a model name or a duration
appears, and the interface shows it behind an explicit disclosure. The payloads
are assembled field by field rather than spread, so an internal field cannot
leak into the neutral surface. An integration test asserts the serialised
suggestion matches no provider or model name, and `enforceNeutralCopy` replaces
any chat part that names processing metadata.

## Acceptance criteria

**49 to 60 (AI Partner).**

| # | Satisfied by |
| --- | --- |
| Automatic generation, no Generate button | `onRoleOpened`, `onFocusItemSelected`, `onLiveEventArrived`, `onDecisionOpened`; `refresh` is the only manual control |
| Deduplication | `stateDigest` plus the single flight map; four `dedupeReason` values; tested at both layers |
| Required source discipline | `RequiredSourceResolver`, the held state, the constrained view, `constrained` and `missingRequiredSources` columns |
| Progressive stage reporting | `AI_STAGE_ORDER`, `StageRecorder`, `replayStages`, `validateStageSequence` |
| 57: one state machine in three modes | asserted by the integration test comparing safe and offline `completedStages`, and by the verify script across all three |
| Validation before publication | `validateSuggestionDraft`; `findValidatedSuggestion` requires `validated_at` |
| Grounding separation | five array `groundingSchema`; `checksCompleted` against `actionsCompleted` against `recommendedAction` |
| Activity from real events | `recordToolCallActivity` takes the gate's result; projection from `background_actions`; tested |
| Presenter safe and offline excellence | 36 cached beats, 18 authored cards, 7 chat answers, all validated |

**17 to 21 (honesty and provenance).** `source` is `live`, `cache` or `seeded`
on every row and never blurred: the chat labels authored content `seeded` and
reserves `cache` for a row that genuinely came out of `cached_ai_outputs`. A
live failure that fell back says so and gives the redacted reason rather than
claiming safe mode. A nil return is recorded as a finding with its query scope.
`AISuggestionView.sources` carries `SourceAttribution` with freshness,
necessity and load state.

**44 to 48 (governed execution from natural language).** `executeTool` for
every proposed action; the gate's `denialCode` surfaced; approval bound to a
payload fingerprint; `prepared-locally` distinguished from
`queued-for-external-execution`; `execution-receipt` constructible only from a
real audit event; every gate decision written to `tool_calls`, `audit_events`
and `ai_activity_entries`.

## Verification

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run check:copy` | no finding in any file owned here |
| `npm run scan:secrets` | passed |
| `npx vitest run tests/unit` | 418 passed, of which 92 are `suggestions.test.ts` |
| `npx vitest run tests/integration` | 198 passed, of which 43 are `ai-partner-flows.test.ts` |
| `npx tsx scripts/verify-ai-partner.ts` | 61 checks, 0 failures, exit 0 |

## Limitations

1. **The live path is unexercised.** No usable credential exists here, so the
   live branch is correct by construction and verified only in its fallback
   behaviour. The structured output is parsed with a balanced brace extractor
   rather than the provider's JSON schema mode, which is the more forgiving
   choice but is not the one a working credential would justify. Revisit with
   `npm run smoke:live` passing.
2. **No retry on the live path.** The caller's fallback is faster and more
   predictable than a second attempt, and in a live demonstration
   predictability wins. A retry with backoff would be the right change once the
   live path is real.
3. **`SourceAttribution` is empty until Agent G registers a resolver.** The
   default implementation returns attributions only for contexts with recorded
   `source_requirements`, and none are seeded yet, so `suggestion.sources` is
   `[]` today. The contract and the rendering path are in place.
4. **German labels on projected activity entries fall back to English.** The
   `background_actions` rows carry no German text, and a wrong German label in
   a risk product is worse than an English one. Either add `target_label_de` to
   that table or accept the fallback.
5. **Chat answers are keyword matched.** Seven topics are covered well and
   everything else declines. That is the correct trade without a credential,
   but it is a smaller surface than a working live path would give.
6. **The unread event list depends on another agent's table.** `readUnreadEvents`
   reads `workday_live_events` and `workday_live_event_reads`; it returns an
   empty list cleanly when they are empty.
