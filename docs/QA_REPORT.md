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

---

## 7. Interactive Workday V2: QA and design review

Added by the QA and design review workstream after the V2 redesign. The full
record is `docs/handoffs/workday-v2-qa.md`: every command with its real output,
a verdict per capability, every defect with a reproduction, the accessibility
violations by impact, the visual review against the captured screens, and an
explicit list of what could not be verified. This section is the summary and
the part that changes the conclusions in sections 2 to 6 above.

**No application code was changed by this workstream.** Not one line, including
the small self-evident fixes the brief permits. Every failure listed below is
the product as it stands.

### 7.1 Five new Playwright suites

| File | Covers |
|---|---|
| `tests/e2e/workday-v2.spec.ts` | the six role landings, the icon rail, the command palette, the context drawer, the role switch, a decision end to end, the modes, German, the settings area, `?ui=v1`, and that `/story` is untouched |
| `tests/e2e/workday-v2-live-day.spec.ts` | play, pause, step, jump to live, unread, guided catch-up, auto-pause, viewed versus live time, the 14:05 propagation, and the keyboard map including the negative test |
| `tests/e2e/workday-v2-ai-partner.spec.ts` | the dock on all eight routes for two roles, the three tabs, the state, the card's two separate lists, evidence in place, the chat, and the generation contract |
| `tests/e2e/workday-v2-visual.spec.ts` | the type cap, Geist resolution, overflow, clipped controls, the centre being the largest region, the permanent disclosure, reduced motion, and axe-core on eleven surfaces |
| `tests/e2e/workday-v2-integration.spec.ts` | the integration centre, connector health and mode, freshness, the credential scan, deep links, the queue, and branding |

RESULTS_SUMMARY_PLACEHOLDER

### 7.2 The three most serious defects

1. **The command palette resets the scenario with no confirmation.** The row
   is labelled "Reset the day, confirm in the demo menu" and the code comment
   claims it "performs nothing until the second confirmation", but its handler
   calls `actionResetScenario()` directly and `app/actions.ts:167` has no gate.
   One keystroke discards every decision, rationale, approval and audit event
   taken during a demonstration. The palette's subsequence matching returns
   that row for almost any query. Handoff defect 7.1.
2. **The AI Partner's generation choreography can never run.** Three
   independent causes: the event channel never publishes an `agent.` kind; the
   dock's bridge listens only for `message` while the route names every frame
   with `event:`, so it receives nothing at all; and nothing calls the
   generation route automatically, because `onRoleOpened`,
   `onFocusItemSelected` and `onDecisionOpened` are exported and never called.
   Four acceptance criteria about preparation, progressive reveal and the
   failure fallback are unreachable in the running product. Handoff defect 7.6.
3. **The context drawer is not usable from the keyboard.** It does not take
   focus when it opens, Tab is not trapped and walks the page behind the scrim,
   and Escape does not return focus to the trigger. Two one line causes, both
   in `Drawer`: an effect that depends on `[open]` while the portal only
   renders once `mounted` flips, and an early `return null` in `ContextDrawer`
   that unmounts the panel before the `!open` branch can restore focus. Handoff
   defect 7.2.

### 7.3 This revises section 4.8 of this report

Section 4.8 above records an accent-text contrast defect as fixed. A different
one is open in the V2 scope: `--app-text-faint` is `#5f6875`, which measures
**3.33:1** against `--app-shell` `#0f1216` and is applied at 12px. It is used
for the entity name in the top bar, the secondary line on every queue row,
"Nothing new" in the live day bar and the capability labels on every connector
row, and it accounts for 94 of the 96 serious axe nodes.
`--app-text-muted` at 5.31:1 passes, so the fix is a token value.

The same token is why the mandatory synthetic data disclosure fails contrast in
the administrator area, though not in the workday.

### 7.4 This revises the live AI path section

Section 3 above records the live path as unverified for want of a credential.
With a valid key the smoke test passes first hand: 744 models, `gpt-5.1`
primary, `ok true`, status completed, `produced text true`, and no key material
in the result. The redaction layer was exercised incidentally by an invalid key
and passed, logging `[redacted]`.

Two findings follow, and the first is the important one.

**The three AI modes do not differ in origin when driven through the product.**
Selecting Live AI, Presenter Safe and Offline from the demo menu and then
requesting the same suggestion produced `source: "cache"` all three times with
identical stage lists. The cause is that `setResolvedDemoMode` does not reach
the module instance the route handlers hold: after selecting Live AI the AI
Partner header reported Live while `/api/health/ai` continued to report `safe`,
and `generateSuggestion` gates its live branch on the route handler's copy. A
presenter can select Live AI, see the interface agree, and be served cached
content for the whole demonstration. Handoff defect 7.13.

The confound is recorded in the handoff: the development server resolves an
invalid key, so `source: "cache"` in live mode has a second sufficient
explanation. The key-independent evidence is the health route, which calls no
provider and still reported `safe`. Starting the server with
`NFR_DEMO_MODE=live` and a valid key would settle it in one step and was not
done, because restarting would have interrupted other workstreams.

**A live suggestion that did reach the interface was corrupted.** One of the
`source: "live"` rows in the developer database contains a CJK ideograph
`U+770B` and a typographic apostrophe `U+2019` in English prose, and renders
verbatim in the dock on `/workday/tprm`. It has `validated_at` set:
`validateSuggestionDraft` has no character set rule, and `check:copy` scans
files by extension so it cannot see run time content. Handoff defect 7.14. The
row predates the change to the provider's strict `json_schema` mode and a live
generation run after that change came back character set clean, so the
likelihood is lower than the row suggests; the missing rule is not.

**The validator is otherwise strong, and that was verified on live output.** A
live generation for the resilience lead was refused outright on the
`swiss-dora` rule, because the draft asserted an EU instrument against the
Swiss entity. Nothing was published, `generation.state` was `error` and the
stage list honestly stopped at `reconciling`. That is the single most damaging
factual error this product could make, a real model made it, and the
deterministic gate caught it.

**A live suggestion publishes correctly through the deployment path.**
Generated first hand for `rcsa` / `CTL-PAY-014`: `source: live`, state `ready`,
the full seven stage list, confidence 79, six checks and **zero** actions
completed, which is the two-lists rule holding on live output rather than only
on authored content. `sources` is empty, confirming the generation handoff's
own limitation that no `source_requirements` rows are seeded.

### 7.5 One pre-existing suite no longer tests what is served

Measured at desktop-1920 by running the whole directory:
`journeys.spec.ts` 29 tests with **13 failed**, `security.spec.ts` 18 of 18
passed, `visual.spec.ts` 37 of 37 passed.

`journeys.spec.ts` was written against V1 and V2 is now the default on the same
routes. It keys on a "Workday timeline" navigation, a
`header .mono.strong-text` clock, an `aria-haspopup="true"` role switcher and
an "Interface language" group, none of which V2 renders. **So
`npm run audit:all` cannot pass**, and 13 of its failures are not defects in
the product. The fix is `?ui=v1` on that file's `open()` helper, or a selector
migration, and it belongs to its owner. It was not done here.

Two corrections to the expectation going in. `security.spec.ts` is unaffected
because it inspects served bundles rather than the rendered interface. And
`visual.spec.ts` **passes in full against V2 with nothing changed**: it
measures properties rather than a shell, so no horizontal or vertical overflow,
no text below 10px, no dead or covered control and no content clipped out of
reach all hold on all thirteen workday surfaces it checks. That is an
independent confirmation of the V2 geometry results, written by someone else
against a different interface.

### 7.6 Two things that make the captured screens misleading

Both matter because `docs/screenshots/workday-v2/` is the artefact a designer
reviews.

The **Next development overlay badge sits exactly on top of the live day play
control** at every viewport: the badge is at (22, 1026) 32 by 32 and the
control at (24, 1042) 28 by 28, and `elementFromPoint` at the control's centre
returns `NEXTJS-PORTAL`. In `npm run dev` the Play button cannot be clicked,
and in all 72 captured images the product's signature control is hidden.
`visual.spec.ts` excuses `nextjs-portal` from its obstruction check, with good
reason, which is why no gate catches it.

And **`capture-screens.mjs` waits 1500ms after `networkidle`, which is not
enough for the role visualisations**. Every `*-workbench-*.png` shows the
Processes and Risks columns empty and a risk card floating at the bottom with
its chip clipped mid word. Captured again with an 8000ms settle the same route
renders correctly.

### 7.7 What the redesign demonstrably achieved

Worth recording alongside the defects, because it is measurable and it is the
thing section 1 of `docs/INTERACTIVE_WORKDAY_V2.md` claims.

The centre work area is **1526x982 at 1920x1080 (72.3 percent), 1046x802 at
1440x900 (64.7 percent) and 1260x670 at 1366x768 (80.5 percent)**,
independently recomputed and matching the published figures exactly. The centre
is the largest region of the shell on all eight routes at all three viewports.
**Zero** text bearing elements render above 24px anywhere in the workday scope,
so the token bridge enforces the type cap structurally rather than by review.
Geist Sans and Geist Mono are the only resolved families. Nothing overflows
horizontally and no control is clipped or unreachable. The permanent disclosure
is rendered and inside the viewport on every surface checked. Under
`prefers-reduced-motion: reduce` there is not one infinitely animating element
in the workday scope. And a branding switch changes the resolved identity and
the change log while leaving the clock, the open decision count and the audit
trail length identical, which is the central product claim and it holds.

The strongest single piece of evidence is not in the new suites at all.
`tests/e2e/visual.spec.ts`, written against V1 by a different workstream and
unchanged, passes 37 of 37 against V2. It measures properties rather than
selectors: no overflow in either axis on a surface designed as one stage, no
text below 10px, no control with a dead hit area or covered at its own centre,
and no content clipped out of reach. V2 satisfies the whole of the V1 visual
matrix without that file being touched.
