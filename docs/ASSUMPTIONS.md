# Assumptions and recorded decisions

This file records every judgment call taken while building NFR WorkOS where the
brief was silent, ambiguous, or internally inconsistent. It is deliberately
blunt. A reviewer should be able to disagree with any line here and know
exactly what to change.

Synthetic institution and data. Illustrative regulatory context, not legal
advice.

---

## 1. Source repositories

### 1.1 The pitch source repository is named `NFRPitch`, not `30minsAIChat`

The brief names `30minsAIChat` as the visual and presentation source. No such
directory exists on this machine. `NFRPitch` is the same body of work under its
current name, which is confirmed by the brief's own environment variable
`NFR_PITCH_SOURCE_PATH` and by the repository's contents (a 16:9 executive
pitch, a scene system, layout tests, and copy and motion audit scripts).

**Decision.** `NFRPitch` was treated as the pitch source. The path variable in
`.env.example` points to `../NFRPitch`. `RealAIInfrastructure` matched the brief
exactly and needed no interpretation.

### 1.2 `NFRPitch` is not a single HTML file

The brief describes the pitch source as a single-file HTML product. It is not.
`pitch.html` is 124 KB but only 739 lines of markup; the design system lives in
five external stylesheets (`pitch.css` alone is 84 KB) and 37 JavaScript
modules. Treating it as one file would have missed the entire design system.

### 1.3 `RealAIInfrastructure` contains two products

An NFR agent platform, which is in scope, and an OpenAI-compatible inference
gateway with Prometheus, Grafana and Helm, which is not. The gateway dominates
that repository's own documentation, so the domain findings were drawn from
`backend/` rather than from its README.

### 1.4 Neither source repository was modified

Confirmed by `git status` in both. Both carry pre-existing uncommitted work that
predates this build: `NFRPitch` had three modified files last touched
28.09.2026, and `RealAIInfrastructure` had ten last touched 21.08.2026. Nothing
in this build wrote to either path, created a file there, or committed to them.

**Worth telling the user:** both source repositories have uncommitted work
sitting in them, unrelated to this build.

---

## 2. Technology choices

### 2.1 No Tailwind, no Fluent UI

The brief lists Tailwind as optional ("only when useful") and Fluent UI as
"selectively" used, while also requiring that overlapping UI libraries be
avoided.

**Decision.** Neither was installed. The product uses CSS custom properties and
a hand-built component vocabulary in `src/styles/globals.css`. Rationale:
Tailwind and a design-token system solve the same problem twice, and Fluent UI
would have imported a second, conflicting visual language into a product whose
entire visual argument is that it evolves one specific design system. The
collaboration-style cards the brief asks for are built from the product's own
components.

**Cost of this decision.** No utility-class ergonomics, and the component
vocabulary had to be written. Roughly 900 lines of CSS carry it.

### 2.2 `lint` is typecheck plus the copy and secret gates

Next.js 16 removed `next lint`. Rather than add ESLint and a config chain for
one script name, `npm run lint` runs `tsc --noEmit`, the copy gate and the
secret scanner. That is a narrower definition of linting than a bank's
engineering function would expect, and adding ESLint with
`eslint-config-next` is a reasonable change.

### 2.3 TypeScript 5.9.3, not 7.x

TypeScript 7 is available but new. Given `drizzle-kit`, Next.js 16 and the
OpenAI Agents SDK all in the dependency graph, 5.9.3 was pinned for
compatibility. `strict` is on, plus `noUncheckedIndexedAccess`,
`noImplicitOverride` and `noFallthroughCasesInSwitch`.

### 2.4 Agents SDK tools must use `strict: true`

The SDK documents that "Zod schemas are not supported without `strict: true`".
Strict mode requires every property to be present, so every optional tool
argument is declared `.nullable()` rather than `.optional()`, and the tool
wrapper strips nulls before handing the payload to a handler. See
`src/agents/tools/sdk-tools.ts`.

### 2.5 The Agents SDK must be handed the configured client explicitly

Found late, and it would have made live mode impossible.

The SDK constructs its own default OpenAI client and looks for the key in
`process.env.OPENAI_API_KEY`. That is not where this product's key lives: it is
read at runtime from a file outside the project and deliberately never exported
into the environment. So every `run(manager, ...)` failed with "Missing
credentials" before making any request, and the failure was invisible because
the manager catches it and falls back to a seeded response. The product looked
like it was working in safe mode when in fact live mode was structurally
broken.

`getOpenAIClient` now calls `setDefaultOpenAIClient(client)`. Confirmed by the
change in failure mode: the call now reaches the provider and returns a real
HTTP status instead of failing locally.

The same call site sets `setTracingDisabled(true)`. The SDK would otherwise
export trace payloads to a hosted endpoint, and those traces contain the
synthetic banking content, which has no reason to leave the machine.
Observability is served locally by the `agent_runs` and `tool_calls` tables,
which the control room reads.

### 2.5b The demo scripts run the development server

`npm run demo:safe` and `npm run demo:live` run `next dev`, which is what the
brief's script list implies. For an actual demonstration prefer:

```
npm run build
NFR_DEMO_MODE=safe npm run start
```

The development server recompiles on demand, which introduces a visible pause
the first time a route is opened. That is the wrong behaviour in front of an
audience, and it is also how the font loader problem recorded in
`docs/QA_REPORT.md` section 4.12 first appeared. The production server has no
such pause. The dev scripts were kept because the brief named them and they are
correct for development.

### 2.6 Specialists are tools, not handoffs

The brief allows either. Specialists are exposed to the manager as tools
because the manager must combine several specialist outputs without any one of
them taking over the conversation. Handoff is used in exactly one place, the
meeting role play, where taking over is the correct behaviour.

### 2.6 Compaction is extractive, not model generated

`compactSession` folds old turns into a rolling summary using a deterministic
extractive rule rather than a model call. A model summary would read better,
but compaction fires at unpredictable moments and a network failure mid
demonstration must not be able to lose the thread. The important state does not
live in the transcript anyway (see section 3.2).

---

### 2.7 The workday shell is fixed to the viewport, not merely sized to it

An application shell sized with `height: 100dvh` and `overflow: hidden`, with
every tall region inside its own scroller, still allowed the document to scroll
by over two thousand pixels. `window.scrollTo` moved it and carried the entire
top bar and the permanent synthetic data disclosure off screen.

Two things are worth knowing, because both cost time to establish:

1. `overflow: hidden` suppresses the scrollbar and user scrolling, but it does
   **not** prevent programmatic scrolling and it does not stop `scrollHeight`
   reporting the full content size. Applying it to `html` and `body` was
   therefore not sufficient either.
2. No unclipped element could be found below the fold, and hiding any one of
   the three sibling scrollers collapsed the reported height back to the
   viewport. That is the signature of a layout artefact rather than of real
   overflowing content, which is why chasing the offending element did not
   converge.

The shell root is now `position: fixed; inset: 0`, which removes it from
document flow so there is no in-flow content left to overflow. Verified at all
three projected sizes: the document reports exactly the viewport height, it
cannot be scrolled by any means, and the disclosure is inside the viewport.

The general lesson, recorded because it will recur: for a fixed viewport
application shell, take it out of flow. Do not size it and hope.

## 3. Data model decisions

### 3.1 Every content row carries `runId`

Rather than a shared immutable baseline plus per-run overlays, the seed writes
the whole day into a run, and `demo:reset` deletes and rewrites that run using
the same code path as the seed. This makes "reset restores the entire original
day" structurally true rather than a best-effort cleanup, at the cost of a
`runId` filter on every query.

### 3.2 Durable state lives outside the chat transcript

Approved decisions, ratings, actions, the event timeline, meeting outcomes,
evidence status and audit events are all in their own tables. The transcript is
a transcript. This is what lets compaction discard old turns without losing
anything the afternoon depends on, and it is tested in
`tests/integration/continuity.test.ts`.

### 3.3 `impactTolerances.entityId` is a scope label, not a foreign key

A board can approve one tolerance covering two entities or the whole group, so
this column holds values such as `ARC-DE`, `ARC-DE, ARC-AT` or `group`. Use
`toleranceAppliesToEntity` in `src/db/repositories/workday.ts` rather than an
equality comparison. A plain equality test would silently miss the two-entity
case, which is the case that matters for the cross-border payment service.

### 3.4 `subprocessors.declaredIn` has a fourth value, `neither`

A fourth party engaged by a subprocessor can be absent from both the contract
appendix and the supplier submission, because the appendix as drafted does not
reach a subprocessor's own subcontractors. Recording that honestly is the
point: the drafting gap is the finding. Any future interface switching on this
field must handle four cases.

### 3.5 Two change records are typed `process-map`

The `sourceType` enumeration has no value for a change record, and the scenario
requires two. Rather than invent an eighteenth type that an interface switch
might not handle, both are typed `process-map` and filed against the process
they affect, with an inline comment. A future revision should add a
`change-record` type.

### 3.6 `meetings.kind` was extended

The schema comment names four values; the seed uses eight, adding `meeting`,
`one-to-one`, `supplier-call` and `workshop` for the lighter meetings. The
extension is documented in the seed module.

### 3.7 A sentinel entity code is used for non-entity actors

`EXT-NOVALINK` for supplier personnel and `ARC-GROUP` for group-level
indicators. Neither is a member of `legalEntities`. This is a pragmatic choice
that keeps the column non-nullable; a cleaner model would separate internal and
external parties.

---

## 4. Scenario content decisions

### 4.1 The scenario bible is authoritative over the code

Where a seed module and `docs/SCENARIO_BIBLE.md` disagreed, the bible won and
the module was corrected.

### 4.2 The bible's pre-event fallback durations are internally inconsistent

Section 6.7 gives seven fallback occasions totalling 9 hours 40 minutes;
section 9.1 gives five September occasions totalling 8 hours 40 minutes plus one
August occasion of 1 hour; section 8.2 puts the 27.08.2026 fallback at 1 hour 43
minutes. These cannot all hold.

**Decision.** The evidence corpus quotes the bible's headline figures verbatim
and deliberately does not decompose the 22 pre-event rule firings by month, so
the product does not expose or compound the inconsistency. This should be
reconciled in the bible before the content is reused.

### 4.3 One residual rating could not be reproduced under the coded methodology

The bible's Q3 RCSA row states residual impact 3 and residual likelihood 2. No
control effectiveness band in `src/domain/nfr/calculators.ts` produces a
one-band likelihood cut and a one-band impact cut simultaneously, so that
position is unreachable.

**Decision.** `fully-effective` was used, which reproduces the bible's residual
impact of 3, its "within appetite" position and the first line rating the Q3
version was actually signed on. The likelihood differs by one band. Either the
bible's figure or the methodology table needs adjusting; the methodology is
stated in one place and is easy to change.

### 4.4 The control test population is 1,204 but only 100 rows are seeded

`controlTests.populationSize` records 1,204, which is the real period population
from the scenario bible. The `testCases` table holds 100 rows: all 60 sampled
items plus 40 unsampled ones chosen so every anomaly and every exception is
present and inspectable.

**Why.** The brief asks for 100 synthetic transactions, and the bible fixes the
population at 1,204. Both are honoured: the recorded population size is the
bible's figure, and the 100 rows are a faithful subset.

**Consequence.** The population field visual computes its totals from the rows
it holds, so it can only speak about 100. The workbench page discloses this
explicitly and separates "recorded population" from "rows held", and every
deviation rate on the page is computed over the 60 sampled items rather than
over the 100 rows. A reviewer should read the visual as a window onto the
population, not as the population.

### 4.5 "Unable to conclude" is not an outcome value

The two items where evidence of operation could not be obtained are stored as
`outcome: "anomaly"` with an `anomalyKind` beginning `unable-to-conclude`,
because the schema's outcome enumeration has three values and adding a fourth
would have rippled through every consumer. The interface detects them by that
prefix and shows them in a separately bordered panel away from the four
exceptions, which is the distinction the internal control standard requires. A
future revision should make this a first class outcome value.

### 4.6 Scene 4's title is eleven words against a ten word limit

The brief fixes the sixteen scene titles verbatim and separately imposes a ten
word title limit carried over from the pitch design system. Scene 4's fixed
title is eleven words. The fixed title was kept and the conflict recorded in
`STORY_COPY_RULES.knownExceptions` rather than edited silently.

### 4.5 The sixth autonomy level is a rail, not an enum value

`src/server/security/authority.ts` implements five autonomy levels. The brief's
scene 15 names six, including "Hand back to human". Hand-back is modelled as a
position available from all five levels with no reachable authority classes,
which is faithful both to the code and to the rule that human judgment produces
no automated action. It is not a sixth enum value.

### 4.6 The Swiss impact tolerance is deliberately unresolvable

`ITOL-0004-03` has two measures and no stated precedence, so after the event the
Swiss entity cannot say whether it breached its own tolerance. Four of the five
scenario conflicts resolve within the day; this one does not, and it carries a
named owner and a committee destination. This is intentional scenario design,
not an omission.

### 4.7 German in code is ASCII transliterated

Code-facing strings write `ss` for the eszett and `ae`, `oe`, `ue` for umlauts
(`Massnahme`, `Oesterreich`, `Kontrollwirksamkeit`). This trades typographic
correctness for encoding safety: mojibake in seeded content is hard to detect
and harder to fix, and the copy gate checks for it. A production build should
use correct German orthography with a verified UTF-8 pipeline.

---

## 5. Security decisions

### 5.1 The authority gate is the security boundary; guardrails are hygiene

`src/server/security/authority.ts` is deterministic and never reads free text,
so no instruction in a document, email or transcript can influence it. The text
matching guardrails in `src/agents/guardrails/index.ts` improve quality and
refuse obvious abuse, but they are easy to defeat and are not presented as the
thing that keeps the product safe.

### 5.2 Prohibited tools are offered to the model deliberately

`sendExternalEmail`, `notifySupervisor`, `writeDatabaseDirectly`,
`readLocalSecrets`, `modifyAuditTrail` and `approveOwnProposal` are registered
and exposed. Hiding them would mean the only evidence they are refused is our
own assertion. Offering them and having the gate refuse produces an audit
record that proves it, and the refusal is tested at every autonomy level for
every role.

### 5.3 Interface clicks pass through the same gate as model requests

`app/actions.ts` routes decisions through `executeTool`. There is no privileged
interface path, so a screen cannot do something the model could not.

### 5.4 Approvals are single use and payload bound

An approval carries a SHA-256 fingerprint of the exact payload and is marked
consumed on execution. This prevents approving a small change and executing a
larger one, and prevents replaying one approval for a second change.

### 5.5 The OpenAI key in the source repository is rejected by the provider

This is the most important operational finding in this document.

The key in `RealAIInfrastructure/.env` **resolves correctly and is rejected by
OpenAI with HTTP 401, "Incorrect API key provided"**. Verified with
`npm run smoke:live` on 30.09.2026.

Consequences:

- Live mode cannot function until a valid key is supplied. The application
  behaves correctly: it resolves the key, attempts the call, fails, and falls
  back to presenter safe behaviour rather than breaking.
- Presenter safe and offline mode are unaffected. Every interactive surface,
  the whole story, the decision and execution path and the meeting scripts read
  from the seeded scenario, so the demonstration is complete without a model.
- The grounded evaluations in `npm run eval` cannot run. The fourteen
  structural evaluations do, and they pass.

`getPublicHealth` therefore reports two separate fields.
`liveAiConfigured` means a usable key was resolved. `liveAiVerified` means a
call was actually accepted, and is null until one has been attempted. Reporting
only the first would have told a presenter that live mode works when it does
not.

**To fix:** put a valid key in `RealAIInfrastructure/.env` as
`OPENAI_API_KEY`, or export it in the launching shell, then run
`npm run smoke:live`.

### 5.6 A masked key in a provider error message was leaking, and is now redacted

Found while running the live smoke test. When OpenAI rejects a key it echoes it
back in its own masked form, for example `sk-proj-` followed by asterisks and
four real trailing characters. That still discloses the suffix and the exact
length, both of which this product undertakes never to reveal, and the original
redaction patterns did not match it because an asterisk is not in their
character class. The message reached the console.

Three changes, at three layers:

1. `src/server/logging/redact.ts` gained a masked-key pattern, so the redactor
   catches it wherever it appears.
2. `runLiveSmokeTest` now redacts the provider's error text before returning
   it, rather than passing it through.
3. `scripts/scan-secrets.mjs` gained an `openai-key-masked` detector, so a
   masked key in any build artefact is a finding.

Covered by a regression test in `tests/unit/secrets.test.ts`, which asserts
that the trailing characters do not survive redaction while the useful part of
the message ("401") does.

### 5.7 The secret scanner skips three generic detectors in compiled server output

In `.next/server` and in vendored chunks, the `bearer-token`, `jwt` and
`private-key-block` detectors are skipped. The OpenAI key detectors are never
skipped anywhere, and browser facing output (`.next/static`, `out`, `dist`) is
scanned with every detector.

The reason is that library code trips the generic detectors legitimately: a JWT
library carries private key blocks in its test vectors, and the OpenAI SDK
carries a literal `Bearer` placeholder it compares a header against. Reporting
those trains a reader to ignore the scanner. Coverage of the check that
actually matters was verified by planting a key-shaped string in a server chunk
and confirming the scanner still failed.

### 5.8 The secret scanner reports locations, never values

And it does not inspect Git history or scan the wider machine, both of which the
brief prohibits.

---

## 6. Scope and completeness

### 6.1 Depth is uneven by design, following the brief's own priority

The brief marks four roles as "deeply interactive" and two as needing "complete
and polished journeys". That distinction is honoured and is stated in the
interface, so nobody is misled about which is which.

### 6.2 Voice is optional everywhere

Realtime voice is implemented behind a short lived client token
(`app/api/realtime/session/route.ts`), degrades to a typed fallback when no
realtime model is available, and the typed path is always the tested one.

### 6.3 No gateway adapter

The brief says not to use an existing gateway by default and that an adapter may
be documented as future work. The product calls the official OpenAI SDK
directly. No adapter was written.

### 6.4 Cloud deployment was not attempted

The brief makes it optional and says it must not block localhost. It was not
built.

### 6.5 The evaluation suite is narrower than the brief describes

The brief asks for evaluations across eleven dimensions. What exists is the
authority and refusal behaviour tested thoroughly in unit and integration
tests, plus source coverage measurement in `src/server/retrieval/search.ts`.
Factual grounding and hallucination detection against live model output are
**not** implemented as an automated suite. This is the largest gap against the
brief and is recorded as such rather than glossed.

---

## 7. Interactive Workday V2 decisions

Every judgment call in the interactive redesign. The reasoning for the design
itself is in `docs/INTERACTIVE_WORKDAY_V2.md`; this records the choices that a
reviewer could reasonably have made differently.

### 7.1 Two visual scopes rather than one

The presentation system was kept and the interactive layer was moved onto a
separate scoped system, rather than unifying them or restyling the deck.

The alternative considered was one system serving both. It was rejected because
the two surfaces have genuinely incompatible requirements: a deck is read from
eight metres by an audience that is not operating it, and an application is
read from sixty centimetres by someone who has it open for seven hours. Any
single scale is wrong for one of them, and V1 demonstrated which way the
compromise falls.

The cost is two stylesheets to maintain and a bridge between them. Challenge
this if the presentation and the application are ever expected to converge.

### 7.2 The old token names were remapped rather than the components rewritten

The bridge block in `src/styles/workday-v2-tokens.css` redefines the
presentation token names to application values inside `.workday-v2`, so roughly
six thousand lines of reused domain components adopt the new system untouched.

The honest alternative was rewriting those components against the new names.
That was rejected as a large change producing no new capability, and one that
would have forked them away from the V1 interface which has to keep working
during the transition.

The cost is a layer of indirection a newcomer will not expect: a component
asking for `--surface-1` gets a different colour depending on which scope it is
rendered in. The bridge is commented at length for exactly that reason.

### 7.3 The type scale is capped by remapping, not by review

`--text-2xl` is 36px in the presentation system and 20px in the workday scope,
and `--text-3xl` and `--text-4xl` both collapse to 24px. A reused component
cannot therefore produce a deck sized heading on a working screen.

This was chosen over auditing each call site because a structural guarantee
survives a future change and a review does not. The cost is that a component
genuinely needing 36px inside the workday cannot have it without an explicit
override, which is the intended outcome.

### 7.4 V1 is a fallback, not a supported variant

Both interfaces are served from the same routes through `?ui=v1` and `?ui=v2`,
read the same database, scenario run, repositories, server actions and
authority gate, and differ only in presentation.

There is deliberately no third implementation and no per-user persistence. Two
permanent business implementations would be a maintenance trap, which the brief
states directly. V1 exists so a reviewer can see the before and after side by
side and so a regression has somewhere to fall back to.

A reviewer should challenge how long V1 stays. The answer should be weeks, not
quarters, and the V1 files are deliberately named `v1.tsx` so the deletion is a
single mechanical step.

### 7.5 The live event table is a projection, and the derivation is recorded

`workday_live_events` holds 78 rows, every one derived from content that already
existed, with the source recorded in `derivedFrom` and `derivedFromId`: 22 from
the timeline, 26 from decisions, 12 from meetings, 12 from the inbox, 6 from
background actions.

The alternative was authoring an event stream directly, which would have been
faster and produced a denser day. It was rejected because the product's central
claim is that one institution and one day are shared across six functions, and
a parallel event source would quietly break it while looking fine.

The cost is that the projection is a capped deterministic sample rather than
every candidate row, so a reviewer hunting one specific seeded inbox message
may not find it on the track.

### 7.6 Automatic pause is restricted to two event kinds

The player stops at a `decision-required` event whose judgment kind is not
`agenda`, and at the 14:05 shared event. Nowhere else.

A broader rule was tried first and was wrong in both directions: pausing on
everything carrying `requires_decision` stopped the player at the 07:45 morning
brief, before the day had started, and still missed 14:05.

### 7.7 There were briefly two live day bars, and the interim one was deleted

An interim bar was written inside the shell directory while the player was
still being built, so the shell geometry could be reviewed against a real
component. It was deleted rather than kept, and the reason is not taste: it
drove the clock with `actionSetMoment`, so stepping backwards rewound LIVE time
for the whole scenario rather than moving the viewed moment. That breaks the
rule the live day rests on, which is that time is a view and decisions are
facts.

### 7.8 Approve on a suggestion card navigates rather than executes

A suggestion card's primary action routes to the decision flow. It does not
execute, and the AI Partner dock executes nothing at all: every action is a
callback and `src/components/workday-v2/PartnerClient.tsx` is the only place
the dock meets the application.

A one click Approve would have been a better demonstration and a worse product.
The rationale and the confirmation that the rationale is the accountable
person's own are captured in the decision flow, and the gate refuses without
them, so a shortcut past it would bypass the single most important control in
the product.

### 7.9 Motion requires two conditions, not one

The AI sheen and the live dot run only when a real running flag is set AND the
partner state is one of checking evidence, preparing or executing. A `ready`
partner with work in flight elsewhere stays still.

An interface that pulses while nothing is happening is lying about work, and it
is the easiest lie for an AI product to tell. The cost is that a genuinely busy
moment can look still if the state was not updated, which is the right way for
this to fail.

### 7.10 Stale is not blocking

The required source gate holds a recommendation when a required source is
MISSING, and merely constrains it when a source is present but stale. A stale
source is reported through the freshness in the source row rather than through
the outstanding list.

Blocking on staleness would stop the product producing anything the moment a
simulator went quiet, and the rule the brief states is about a required source
being unavailable, not about it being old. The translation is in
`src/server/bootstrap.ts` and is commented there.

### 7.11 A context with no recorded source requirements is treated as available

The AI layer does not block when a context declares no required sources.
Defaulting the other way would hold every suggestion at `retrieving` until the
integration requirement map covered every judgment kind, which reads as a
deadlock rather than as discipline. The integration seed reports the judgment
kinds its map does not cover, so the gap is visible rather than silent.

### 7.12 The selection URL format lives outside the client module

`parseSelectionParam` and the `?select=` format are in
`src/workday/selection-url.ts`, not in `SelectionProvider.tsx`, and the
provider re-exports them.

This is not organisational tidiness. The provider carries the client directive,
and a server component calling a function out of a client module fails at
runtime with "Attempted to call parseSelectionParam() from the server". The
parsing has to happen on the server, because the server is the only side that
can resolve an identifier to a title.

### 7.13 `next/dynamic` options are repeated at each call site

`src/components/workday-v2/RoleWorkObject.tsx` writes `{ loading:
WorkspaceSkeleton }` out six times rather than sharing a constant. The bundler
analyses the call statically and rejects anything that is not an inline object
literal, with an error that only appears at build time. The repetition is the
price of the analysis and is commented.

### 7.14 The stack utilities each declare their own flex direction

`.app-stack-1` through `.app-stack-6` each set `display: flex` and
`flex-direction: column`, rather than being gap-only modifiers on `.app-stack`.

They began as modifiers and the failure was quiet and specific: a class used
without its base produced a horizontal row, so a calendar entry rendered its
start and end time as one unreadable number. Declaring the direction on every
variant removes the possibility.

### 7.15 The brand accent token is resolved but not applied

`BrandIdentity.accentToken` names a custom property and is surfaced in the
branding settings screen, but the workday does not re-tint from it. Doing so
needs care, because the configured default IS the product accent and a naive
`--app-ai: var(--app-ai)` is circular. A client specific accent is a documented
gap rather than a silent one.

### 7.16 Administrator chrome is English only

German strings exist for the terminology comparison, because that is the thing
the screen is about, but the settings navigation and headings are English. The
NFR workday itself is fully bilingual. A deployment with German speaking
administrators would need this completed.

### 7.17 German falls back to English on two projected surfaces

Projected activity entries and inbox derived live events carry English content
inside a German frame, because `background_actions` has no German target label
and `timeline_role_moments` has no German headline. Decision, meeting and
timeline titles are fully German.

This was left as a visible fallback rather than machine translated. A wrong
German label in a risk product is worse than an English one, because a reader
cannot tell which it is.

### 7.18 The live path is verified, and verifying it found three defects

Three credentials were supplied during the build. The first two are rejected by
the provider with HTTP 401 `invalid_api_key`, confirmed with a raw request
straight to `api.openai.com` bypassing all application code. The third works:
744 models visible, `gpt-5.1` resolved as primary and `gpt-5-mini` as fast.

Running the live path found three real defects that the fallback had been
hiding. All three are fixed, and they are recorded here because each is a
general lesson rather than a local slip.

**The smoke test asked for 16 output tokens.** Ample for the word "ready" and
completely wrong for the model that answers it: the gpt-5 family draws its
reasoning tokens from the same output budget, so 16 was spent on reasoning
before any text was produced. The provider returned a 200 with status
`incomplete` and zero output tokens, and the old code reported that as
`ok: true`. That is the exact failure this codebase works to avoid elsewhere, a
green status a presenter would act on that does not mean what it says. The
budget is now 256 with low reasoning effort, `ok` requires usable text, and the
result carries a `producedText` field.

**Live suggestion generation never succeeded.** It relied on the prompt plus a
brace extractor, and the model returned plain strings inside the five grounding
arrays, which expect typed statement objects. Validation correctly rejected
drafts whose prose was good. The grounding block is the one part of the schema
that must not be relaxed to make a call succeed, so the fix was to send the
schema: `z.toJSONSchema` with the provider's strict `json_schema` mode makes
the wrong shape impossible rather than retried. Local validation after it is
not redundant, because structured output guarantees shape and says nothing
about whether an evidence identifier resolves.

**Two per entry length limits were set by eye and rejected correct output.**
`checksCompleted` and `actionsCompleted` capped entries at 200 characters,
measured against seeded copy that happened to be terser than real model output.
Raised to 320, with the number stated in the prompt so the model aims below it
rather than discovering it through a rejection.

What is now verified live: the smoke test, model probing, suggestion generation
for both demonstration roles with real citations and correctly empty action
lists, a chat turn producing typed parts with cited evidence, and the full
evaluation suite with its four grounded probes.

Presenter safe and offline mode remain complete and are still the default,
because the brief requires the complete local experience to work without
external credentials and because predictable timing matters more than novelty
in a live demonstration.

### 7.19 Five label defects in the hero visualisations, one root cause

Visual review of the redesigned workbench found five text defects in the hero
visualisations. All five were present in V1 as well, at every viewport, so none
is a regression. They are recorded together because they share one cause and
the cause generalises.

SVG text neither wraps nor clips. A label simply draws wherever it is told, over
whatever is already there. Every one of these was a label whose length depended
on seeded content that happened to be shorter when the component was written.

| Component | Defect | Fix |
|---|---|---|
| `RiskControlGraph` | Short columns were centred against the tallest, so with 24 controls against 8 processes the two left columns sat at the midpoint of a 2000px canvas and the first screenful showed two empty headers | Centring offset capped at 160px |
| `RiskControlGraph` | `inh 16` and `residual 12` shared a baseline and merged into "residual 12nh 16" when the two scores were close | Two baselines, card 12px taller |
| `RiskControlGraph` | An indicator value that is a phrase, for example "2.7 percent of instructions entering the repair queue", drew through the reference beside it | Value truncated to the measured remaining width, full text on the title |
| `RiskControlGraph` | "OUTSIDE APPETITE" is 106px of monospace in a 92px pill | Pill widened to 118px |
| `ObligationLineage` | The obligation card repeated the paragraph reference that the paragraph column already showed on the same row, and the repetition collided with the right anchored entity scope | Identifier only, reference on the title |
| `ServiceDependencyMap` | The entity label sat 4px below a two line service name and was not truncated, so it drew through the title and past the card edge | Card 12px taller, label truncated to the measured width |

The general lesson, which is worth applying to any future visualisation in this
repository: a left anchored label and a right anchored label on the same
baseline are a collision waiting for longer content, and the fix is to budget
the width from the geometry rather than to judge it against the current data.
Where a label must be shortened, the full text goes on a `title` element so
nothing is lost.

A reviewer should note that these were found by LOOKING at the rendered screens
rather than by any test. The Playwright suite asserts structure and the unit
tests assert logic, and neither would have caught a label drawn over another
label. That gap is the argument for the visual review step rather than against
the tests.

---

## 8. Things a reviewer should challenge first

1. **Section 7.18**, the three defects the live path was hiding. Two of them
   were misleading green statuses rather than crashes, which is the class of
   defect a fallback is best at concealing.
2. **Section 4.3**, the residual rating that could not be reproduced. Either the
   methodology table or the bible figure is wrong, and the product currently
   reflects the methodology.
3. **Section 7.2**, the token bridge. It is the single most surprising thing in
   the codebase for a newcomer, and the alternative was a very large rewrite.
4. **Section 4.2**, the inconsistent fallback durations, which are unresolved
   upstream.
5. **Section 7.4**, how long V1 stays. The answer should be weeks, not quarters.
6. **Section 6.5**, the missing automated grounding evaluations.
7. **Section 2.2**, `lint` not being a real linter.
8. **Section 3.3 and 3.4**, the two schema columns that carry more meaning than
   their type suggests.
