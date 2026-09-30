# QA report

What was tested, what passed, what did not, and what was found and fixed.

This report is written to be useful to someone deciding whether to trust this
prototype, which means the defects section is the important part. A QA report
that lists only passes is a marketing document.

Synthetic institution and data. Illustrative regulatory context, not legal
advice.

---

## 1. How to reproduce

```bash
npm install
npm run db:migrate
npm run db:seed
npm run audit:all        # every gate below, one verdict
```

Individually:

```bash
npm run typecheck        # TypeScript strict, zero errors expected
npm run check:copy       # no em dash, no mojibake, no placeholder copy
npm run scan:secrets     # source, browser bundles, exports
npm run test:unit
npm run test:integration
npm run eval             # 14 structural evaluations
npm run test:e2e         # journeys, visual matrix, security
npm run verify:config    # safe configuration metadata, plus a leak assertion
npm run smoke:live       # one minimal live call, live mode only
```

---

## 2. Results

| Gate | Result | Count |
|---|---|---|
| TypeScript strict typecheck | pass | 0 errors |
| Copy standard | pass | 131 files scanned, 0 errors |
| Secret scan | pass | 1260 files including browser bundles and exports, 0 findings |
| Seed depth and structure | pass | 37 checks, including 6 that must be zero |
| Unit tests | pass | 127 |
| Integration tests | pass | 108 |
| Structural evaluations | pass | 14 of 14 |
| End to end, all three viewports | pass | 252 |
| Production build | pass | 19 routes, 0 warnings |
| Deck export | pass | PDF, PowerPoint and speaker script |
| Live API smoke test | **fail, external cause** | see section 3 |

The end to end figure is the full matrix at 1920x1080, 1440x900 and 1366x768:
87 journey tests, 111 visual tests and 54 security tests. No presentation
scene overflows, no text renders below 10px, no control is covered, and no
credential material appears in any browser bundle.

Deck export produces a 2.7 MB PDF with all 16 scenes embedded, a 3.8 MB
PowerPoint with 16 slides and 16 populated speaker notes, and an 18 KB speaker
script generated from the same scene data the live deck renders.

Every route returns HTTP 200 and renders real content against the seeded
scenario: the entry screen, all six workday roles, all six workday sub-routes
per role, the presentation, the control room, trust, value and roadmap.

Seed: 2,039 rows across 43 tables. Every minimum in the brief's seed depth
section is met or exceeded, including 179 evidence documents against a
requirement of 40, 100 test cases, 78 inbox messages, 38 decisions with 117
options, and 165 background actions.

---

## 3. The live AI path

**The OpenAI key in `RealAIInfrastructure/.env` resolves correctly and is
rejected by the provider with HTTP 401.** Live mode cannot function until a
valid key is supplied. This is an external condition, not a defect in the
product, and the product behaves correctly: it resolves the key, attempts the
call, fails, records the failure, and falls back to presenter safe behaviour
with an accurate reason rather than crashing or pretending.

Consequences for this report:

- The four grounded evaluations, which require a live model, **did not run**.
  The 14 structural evaluations did, and they pass.
- The live streaming, specialist delegation and realtime voice paths are
  **implemented and wired but not verified end to end against a model**. What
  is verified is that the request reaches the provider and that the failure
  path is correct. That is an honest limit on this report.

To verify after replacing the key:

```bash
npm run smoke:live
NFR_DEMO_MODE=live npm run eval
```

---

## 4. Defects found and fixed

Every item here was found by a gate in this repository, not by inspection.
That is the point of having them.

### 4.1 Authority gate: routine actions unreachable at the default level

**Found by** `tests/integration/decisions.test.ts`.

A `POLICY_BOUND_AUTONOMOUS` action such as asking the first line to confirm a
fact was not reachable at the `act-with-approval` autonomy level **even with a
valid human approval attached**, because the class was absent from that level's
reachable set and the reachability check ran before the approval check. The
code's own comment described the intended behaviour, which the code did not
implement.

**Fixed** in `src/server/security/authority.ts`. Reachability and the approval
requirement are two separate questions, and the level now reaches the class
while still requiring approval.

### 4.2 Rationale confirmation enforced in only one caller

**Found by** `tests/integration/decisions.test.ts`.

`recordDecisionAndExecute` did not check `rationaleConfirmed`. The guard lived
only in `app/actions.ts`, so any other caller could record a decision and
execute its consequences with the confirmation withheld. The authority gate
would still have refused each material tool, but the decision row and its audit
event would already have been written, which is a misleading half state.

**Fixed** in `src/scenario/engine/decide.ts`. A control that only one caller
enforces is not a control.

### 4.3 Consequence chains executed in declaration order

**Found by** `tests/integration/decisions.test.ts`, which asserted that the new
assessment version carries the decided rating and found it carrying the old
one.

Versioning an assessment copies each line's control effectiveness from the
control row. The showcase decision's seeded chain declared the version step
before the rating change, so the new version captured the pre-decision rating
and the chain silently produced a wrong record.

**Fixed** in `src/scenario/engine/decide.ts` with an explicit execution order:
change the underlying objects, then capture them into a versioned record, then
create follow-up work, then notify. The engine no longer depends on every
seeded chain being written in the right order.

### 4.4 Approval identifiers collided, and were not deterministic

**Found by** `tests/integration/decisions.test.ts`.

Approval identifiers combined the millisecond clock with a random suffix. One
decision grants an approval per consequence, so a seven step chain grants seven
inside the same millisecond, and the suffix collided. `Math.random` also broke
the determinism the seed depends on.

**Fixed** with a monotonic sequence.

### 4.5 A masked key leaked through a provider error message

**Found by** running `npm run smoke:live`.

When OpenAI rejects a key it echoes it back in its own masked form: the prefix,
a run of asterisks, and **four real trailing characters**. That discloses the
suffix and the exact length, both of which this product undertakes never to
reveal, and the redaction patterns did not match it because an asterisk is not
in their character class. The message reached the console.

**Fixed at three layers:** a masked-key pattern in
`src/server/logging/redact.ts`, redaction of the provider text in
`runLiveSmokeTest`, and an `openai-key-masked` detector in the build-time
scanner. Covered by a regression test that asserts the trailing characters do
not survive while the useful part of the message ("401") does.

This was the most serious defect found, and it was found by using the product
rather than by reading it.

### 4.6 The Agents SDK never received the configured client

**Found by** reading a warning in the end to end test server log.

The SDK constructs its own client and looks for the key in
`process.env.OPENAI_API_KEY`, which is deliberately not where this product's
key lives. Every `run(manager, ...)` failed with "Missing credentials" before
making any request, and the failure was invisible because the manager catches
it and falls back to a seeded response. Live mode was structurally broken
independently of whether the key was valid.

**Fixed** with `setDefaultOpenAIClient`. Confirmed by the change in failure
mode: the call now reaches the provider and returns a real HTTP status.
`setTracingDisabled(true)` was added at the same point, because the SDK would
otherwise export traces containing the synthetic banking content off the
machine.

### 4.7 A fallback message named the wrong cause

**Found by** reading the output of the probe in 4.6.

When a live call failed, the fallback told the user the application was
"running in safe mode". The mode was live and the call had failed. Telling a
presenter the wrong reason for a fallback sends them to the wrong place.

**Fixed** with a dedicated failure message that names the provider's reason,
redacted.

### 4.8 Accent text failed WCAG AA contrast

**Found by** the documentation pass measuring the tokens.

`--accent` (#b44cff) as 12px text on its own 12 percent tint over surface one
measures **3.85:1** against the AA threshold of 4.5:1. Accent text carries the
AI activity state, which a reader must be able to distinguish from evidence and
from human judgment.

**Fixed** with a dedicated `--accent-text` token (#c47dff, 5.18:1 on the tint,
6.26:1 on the surface) applied to the three small-text usages. Every other
semantic tone was measured and already passes: pink 5.16:1, cyan 6.85:1, green
6.58:1, amber 7.26:1, red 4.72:1.

### 4.9 The evaluation suite was never invoked

**Found by** the documentation pass.

The 14 structural evaluations, including the check that no Swiss scoped content
asserts an EU instrument applies, were not run by any test or audit script. A
check that never runs is not a control.

**Fixed** by adding it to `npm run audit:all` as a required gate, plus
`tests/unit/evaluations.test.ts` covering the graders themselves.

### 4.10 The identifier grader reported real citations as invented

**Found by** `tests/unit/evaluations.test.ts`, written to test the grader.

The citation pattern must allow a dot, because a fourth party is genuinely
written `TP-0042.3-F1`. The consequence was that an identifier ending a
sentence matched with its full stop attached and was reported as a
fabrication. A false positive here is worse than the check being absent,
because it trains a reader to ignore the grader.

**Fixed** by normalising trailing punctuation, with two regression tests.

### 4.11 158 evidence citations did not resolve

**Found by** the evaluation suite, on its first run.

Four seed modules were authored in parallel and minted evidence identifiers
independently of the corpus, so 158 distinct cited identifiers pointed at
nothing. An unresolvable citation is a hallucination wearing the costume of a
source.

**Fixed** by adding 102 documents (100 generated per-transaction override
record extracts, which genuinely should exist, plus 2 authored artefacts) and
remapping 30 citations to the corpus document that actually is the artefact the
surrounding text describes. The corpus grew from 77 to 179 documents.
`evaluateEvidenceCitations` now checks all six citation sites, including single
valued fields, and passes over **423 citations**.

### 4.12 The font loader made the build depend on the network

**Found by** a build failure.

`next/font/google` resolves fonts at build time. After a cache clear the build
failed outright with an unresolvable bundler internal, and the product had
claimed offline-correct typography.

**Fixed** by self-hosting three variable fonts in `public/fonts/` with plain
`@font-face`, removing the dependency. A licence notice was added, since
redistributing OFL fonts carries that obligation.

### 4.13 The build traced the whole project into the server output

**Found by** build warnings.

Three intentional runtime path resolutions caused the bundler to trace every
source file, including `public/`, into the server output. Annotated, with the
reason recorded at each site. The build now emits no warnings.

### 4.14 `isDatabaseReady` reported seeded when only migrated

**Found by** running `verify:config` after a bare migration.

It checked that tables existed, so after `db:migrate` the application reported
itself seeded and rendered an empty interface instead of the instruction to
seed. Split into `isSchemaReady` and `isDatabaseReady`.

### 4.15 The secret scanner reported false positives in vendored code

**Found by** running the scan against a build.

A bundled JWT library carries private key blocks in its test vectors, and the
OpenAI SDK carries a literal `Bearer` placeholder. Reporting these trains a
reader to ignore the scanner.

**Fixed** by skipping only the three generic credential-shape detectors in
compiled server output, never the key detectors, and never in browser facing
output. Coverage was verified by planting a key-shaped string in a server chunk
and confirming the scan still failed.

### 4.16 Thirty decision consequences named objects that do not exist

**Found by** `tests/integration/scenario.test.ts`.

Roughly 30 decision option consequences carried a `targetId` naming an object
of the wrong type for the tool that would execute it, or no object at all: test
case labels from the report (`EXC-TST-2026-0318-01` and similar) used where row
primary keys were required, obligation identifiers that were never seeded, a
key risk indicator and an impact tolerance passed where a control test
identifier was expected, and a runbook reference that names nothing because
there is no runbook table.
Four control tests also pointed at controls that did not exist, and one option
set an invalid control effectiveness value. **Executing those specific options
would have failed at runtime**, which is the worst place for this class of
defect to surface.

**Fixed** by adding the four missing controls, authored from the tests that
examine them; repointing each consequence to the object its surrounding text
actually describes; and changing three consequence kinds where the tool they
routed to could not honestly accept the object (a defect in an approved
tolerance record became an issue rather than a control test finding, because no
control test examined that tolerance).

Two related corrections followed from the same sweep. All six
`regulatoryPublications.evidenceDocumentId` values pointed at absent documents
and were set to **null**, because no corpus document is any of those
instruments' source text and citing an internal reference digest as a
supervisory instrument would have been worse than citing nothing. One contract
appendix pointed at the Group Legal opinion *about* the appendix, which is not
visible until 15:23, rather than at the appendix itself.

### 4.17 The register held a conclusion nobody had reached

**Found by** `tests/integration/decisions.test.ts`, which asserted that the
showcase decision changes the recorded rating and found it recording a value
the seed already held.

The seeded control row carried the second line test conclusion
(`partially-effective`) while `TST-2026-0318.assuranceConclusion` was null and
its status was `disputed`. So the register asserted a second line conclusion
that no human had reached, and the 11:45 decision the whole product is built
around changed nothing.

**Fixed** by setting the register to the first line position
(`fully-effective`) with `effectivenessSetAt` moved to the Q3 assessment
approval date, which is when that value was actually set. `lastTestedOn` stays
at 25.09.2026 deliberately: the control was tested eleven days before the
scenario day, the test reported a deficiency, and the register still carries
the first line rating. That tension is the finding, and it is now visible in
the data instead of pre-resolved.

A consequence worth knowing: the control acquires its divergence badge when the
11:45 decision is recorded rather than carrying it from 07:45. That movement is
itself evidence that a human decision changed a later screen.

### 4.18 A deck fixture contradicted the scenario it illustrates

**Found by** the seed remediation, which checked whether anything else read the
value it changed.

The presentation's chapter three fixture in
`src/components/presentation/hero-adapters.ts` put the first line position at
`largely-effective`. The scenario fixes it at fully effective, on both the
first line form and the seeded control row. The scene exists to show that two
lines of defence disagree about the same control, so a wrong value on either
side removes the disagreement the scene is about.

**Fixed**, with the mapping between the two positions documented at the call
site: the first line field carries the control owner's assertion, and the
current field carries the second line pre-read that the 11:45 decision either
confirms or sets aside.

### 4.19 Ten mutation handlers returned a success receipt without writing anything

**Found by** the integration test author, while investigating why defect 4.16
produced confident receipt lines rather than errors.

Ten handlers issued an `update ... where id = ?` and returned their receipt
statements without checking that a row had matched. So a target identifier
naming nothing produced a receipt line saying a record had been updated when
the database was untouched. The module header claims the execution receipt is
"derived from completed mutations rather than from the proposal", and for those
ten handlers that claim was false.

This is the worst class of defect in this product, because it is invisible from
the outside: the interface looks correct, the receipt looks correct, and the
audit trail agrees with both.

**Fixed** with one shared `assertWrote` helper that reads the statement's
`changes` count and throws when it is zero, applied to all eight update based
handlers, plus an `assertExists` check on the one insert that carries a foreign
reference. Throwing is the right behaviour rather than a soft failure: the tool
runtime catches it, records the call as failed, writes the audit event, and the
decision engine reports it under "not executed", so the user sees that the
change did not happen.

Covered by `tests/integration/mutations.test.ts`, 13 tests asserting that a
non-existent target produces no receipt line, leaves the table untouched, and
is still recorded in the tool call log rather than failing silently.

### 4.20 A finding could claim a relationship to a control test that does not exist

**Found by** the same investigation.

The `record-finding` consequence maps its target into `controlTestId`
regardless of what the target actually is, and the handler then stored it with
`relatedObjectKind: "control-test"`. A consequence aimed at an impact tolerance
or a runbook produced a finding asserting a relationship to a control test.
Fixing the seeded data alone would have left the mapping able to reproduce it.

**Fixed** by validating the control test exists before the insert, so a wrong
target now fails loudly instead of recording a false relationship.

### 4.21 The workday top bar pushed its controls and the mandatory disclosure off screen

**Found by** `tests/e2e/visual.spec.ts`.

The shell's top bar had a non-shrinking group on the right that measured over a
thousand pixels on its own, which laid the whole shell out at roughly 2068px
against a declared `height: 100vh; overflow: hidden`. Measured consequences at
1366x768: the Today versus future toggle ended at x=1674, the language toggle
at x=1773, and the synthetic data label at x=2052, all beyond the viewport with
no scrollbar to reach them.

Two things made this serious rather than cosmetic. A presenter could not reach
the world view toggle, which is the control the product's central argument
depends on. And **the mandatory synthetic data disclosure was not visible on
any workday screen at any of the three projected sizes**, which the brief
requires to be permanent.

**Fixed** by giving the header `overflow: hidden` with `min-width: 0` on its
flexible children, marking the two informational chips as droppable below
1560px, and **moving the synthetic data disclosure out of the top bar into the
bottom bar**, where it always has room. Putting a permanent disclosure in the
one row where every control competes for width was the underlying design error.

### 4.22 The exported PDF contained almost no content

**Found by** inspecting the export rather than trusting that it succeeded. The
script reported success, produced a file with the right number of pages, and
that file was 11 kilobytes for sixteen full 1920x1080 frames.

The scene captures were referenced with a `file://` URL from a page created
with `setContent`, which has an `about:blank` origin and no file access, so
every image silently failed to load. The PowerPoint was unaffected, because
PptxGenJS reads the files itself.

**Fixed** by inlining the captures as data URIs, and by asserting in the export
that every image decoded before printing, so a blank export now fails loudly
instead of being produced. The PDF is now 2.7 MB with all 16 scenes embedded.

Worth stating plainly: this defect would have survived every gate in this
repository. The export script exited zero, the file existed, and the page count
was right. It was caught only by opening the artefact and counting the embedded
images, which is the argument for section 6 of this report.

---

## 5. Open items

### 5.1 A note on how the visual matrix was measured

Playwright clears `test-results/` at the start of every run, so two
concurrent runs destroy each other's evidence and produce summaries that
cannot be attributed. Several intermediate results during this build were
unusable for that reason, including one run whose only failures were
Playwright trace file errors rather than product defects.

The result recorded in section 2 comes from a single run with nothing else
touching the repository, after the build, the seed and the server had all been
refreshed. Any earlier number quoted during development should be ignored.

The non-presentation half of the matrix was additionally verified on its own
(60 tests across the workday shell, the entry screen and the report surfaces,
at all three viewports) before the full run, because those were the surfaces
this author changed.

### 5.1b Two presentation polish defects found by looking at the captures

Both were found by opening the exported scene images, and neither is caught by
the visual test suite, because the suite checks overflow, text size and covered
controls rather than composition.

**Scene 4, overlapping badges.** The illustrative percentage badges sit on top
of the text beneath them in at least three of the five lane rows: the badge and
its "Illustrative" label overlap "Cost today" on the Assess row and
"On 06.10.2026" on the Organise row. The content is still readable around the
overlap but it looks unfinished, and this is the scene that carries the
product's organising claim. The covered-control check does not catch it because
it only examines buttons and links, not text over text.

**Scene 12, sparse composition.** The final reveal state leaves roughly 250
pixels of empty stage above and below the two text panels. The panels
themselves carry the right content, the rule at the centre of the event and the
fact that it is a repeat rather than a surprise, and every mandatory label is
present. The scene reads as under-filled rather than wrong. This appears to be
a consequence of the swap-region design, where one pane is shown at a time
inside a fixed region sized for the largest pane.

Neither blocks a demonstration. Both would be the first things to fix before
showing the deck to a client, and both are the kind of defect that only surfaces
when a person looks at the artefact.

### 5.2 Structured output is not enforced on live model turns

The twelve output schemas are complete and validated, and the five-array
grounding block is guaranteed for seeded and cached content. The manager's live
conversational turn does not set an `outputType`, so a live reply is free text
guided by the prompt rather than a schema-validated object. The separation of
verified fact from model inference is therefore a **structural guarantee for
seeded content and a prompt instruction for live content**. This is the most
significant gap between what the architecture documentation describes and what
the code enforces.

### 5.3 No authentication of the human

The authority model answers "what may this role do", never "is this person who
they claim to be". The approver identity comes from a static role-to-holder
map. The self-approval check rejects an identity beginning `agent:`, but any
other string is accepted as a person. Appropriate for a local prototype, and
the first thing a bank would need to change.

### 5.4 The audit trail is append only by behaviour, not by constraint

Nothing in the application updates or deletes an audit event, and
`modifyAuditTrail` is a registered prohibited tool. There is no database
trigger, hash chain or tamper evidence.

### 5.5 Other limitations

- `npm run lint` is the typecheck plus the copy and secret gates. ESLint was
  not added.
- `axe-core` is installed but no automated accessibility check runs. Contrast
  was measured by hand for every semantic tone; keyboard, focus, reduced motion
  and non-colour cues were implemented and reviewed but not automatically
  asserted.
- The population field visual computes its totals from the 100 seeded rows, not
  the recorded population of 1,204. Disclosed on the page.
- Cost figures are illustrative. Published prices change and this application
  does not read a live price list.
- Two scenario figures could not be fully reconciled with the coded risk
  methodology and with each other, recorded in `docs/ASSUMPTIONS.md` sections
  4.2 and 4.3.

---

## 6. What was verified by hand

- Every route loaded and its rendered content inspected, not merely its status
  code.
- The background work reveal figures checked against the brief's stated example
  and confirmed to be row counts over the seeded action ledger: 12 systems, 38
  records, 7 documents, 4 requests, 3 contradictions, 2 routine updates, 1
  escalation.
- The value page checked for its three basis labels and for the absence of any
  client saving claim: 90 measured, 10 illustrative, 14 client input required.
- The trust page checked for the six authority classes and the verbatim
  validation statement.
- Contrast ratios computed for all six semantic tones.
- The key leak reproduced, fixed and re-checked.
- Key coverage of the secret scanner proved by planting a key-shaped string in
  a server chunk.
- The showcase decision executed end to end through the governed path, and its
  receipt read against the brief's own example. All nine lines appeared:
  rationale recorded, control assessment updated, assessment version created,
  off-cycle reassessment created, action assigned, monitoring activated,
  committee agenda updated, and a simulated collaboration message sent.
- The same decision attempted with the rationale confirmation withheld,
  confirming nothing executed.
- Reset run immediately afterwards, confirming the decision was open again, the
  control rating was back to its seeded value, and the session audit events
  were gone while the twenty pre-existing ones remained.
- Document scroll and control reachability measured in a browser at all three
  projected sizes, confirming the document cannot scroll and the permanent
  synthetic data disclosure is inside the viewport.
- The exported PDF opened and its embedded image count verified, and the
  PowerPoint's 16 speaker notes read.

The last item is the one worth generalising. Three of the defects in section 4
would have passed every automated gate in this repository: the PDF export
exited zero with a blank file, the mutation handlers returned success receipts
for writes that never happened, and the masked key leak came out of a code path
no test exercised. Gates catch what they were written to catch. Opening the
artefact catches the rest.
