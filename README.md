# NFR WorkOS

## Live the NFR Day

One work environment for non-financial risk. Specialist intelligence for every
function. Human accountability at every material decision.

**Synthetic institution and data.** Arcadia Banking Group and every person,
supplier, control, transaction, incident and regulatory publication in this
repository are invented for the purpose of a demonstration.
**Illustrative regulatory context, not legal advice.**

---

## What this is

A working prototype of a non-financial risk operating environment, built around
one synthetic banking day: Tuesday 06.10.2026 at Arcadia Banking Group, a
mid-large universal banking group operating in Germany, Austria and
Switzerland.

The product proposition it exists to test:

> NFR professionals should not spend the day reconstructing work from email,
> meetings, documents, dashboards, spreadsheets and GRC queues. They should
> begin with the decisions that require their judgment, with evidence already
> assembled and routine execution already handled.

The design principle it is built on:

> Do not make the user operate the AI. Make the AI operate the work around the
> user.

It is not a chatbot with a risk theme. The interactive surfaces read from a
seeded relational scenario, a human decision produces real database mutations
through a governed path, and the execution receipt the user sees afterwards is
assembled from the changes that actually succeeded.

### What it is not

- Not a production system, and not validated within any bank's control
  framework.
- Not a compliance assertion. It makes none, anywhere.
- Not a claim about client savings. Every figure is labelled as measured in
  this simulation, illustrative, or client input required.

---

## Purpose, in one paragraph

The prototype demonstrates control patterns that require validation within the
bank's legal, regulatory, security, and model-risk framework.

---

## Quick start

Prerequisites: Node.js 20.9 or later. No Docker. No cloud account.

```bash
npm install
npm run db:migrate
npm run db:seed
npm run demo:safe
```

Then open:

| Surface | URL |
|---|---|
| Entry screen | http://localhost:3000 |
| Presentation | http://localhost:3000/story |
| Workday, role selection | http://localhost:3000/workday |
| Workday, Operational Risk Partner | http://localhost:3000/workday/rcsa |
| Workday, Third-Party Risk Manager | http://localhost:3000/workday/tprm |
| Control room | http://localhost:3000/control-room |
| Trust and authority | http://localhost:3000/trust |
| Value model | http://localhost:3000/value |
| Roadmap | http://localhost:3000/roadmap |
| AI health, JSON | http://localhost:3000/api/health/ai |

If port 3000 is taken, pass another: `next dev -p 3001`.

---

## The six professional lenses

The same day, the same event, six different professional questions.

| Route | Role | Holder | Entity | Hero view |
|---|---|---|---|---|
| `/workday/tprm` | Third-Party Risk Manager | Stefan Brunner | Arcadia Bank AG | Supplier and fourth-party exposure constellation |
| `/workday/rcsa` | Operational Risk Partner | Marlene Aigner | Arcadia Bank AG | Living process, risk and control graph |
| `/workday/control-assurance` | Control Assurance Specialist | Jakob Steinbacher | Arcadia Bank Oesterreich | Interactive full-population control test field |
| `/workday/incident-resilience` | Incident and Resilience Lead | Nadia Lehmann | Arcadia Bank Schweiz | Service dependency map with a live event pulse |
| `/workday/regulatory-change` | Regulatory Change Manager | Tobias Reinhardt | Arcadia Bank AG | Source to obligation to control lineage |
| `/workday/nfr-governance` | NFR Portfolio Lead | Dr. Katharina Vogt | Arcadia Bank AG | One event, six lenses, one decision thread |

The first four are deeply interactive. The last two have complete journeys with
less interaction depth, and the interface says so rather than implying
otherwise.

### The shared day

Ten moments, shared by every role, scrubbable from the bottom timeline.

```
07:45  Morning decision brief
08:10  Inbox converted into work
08:45  Evidence and workbench
09:30  Asynchronous factual validation
10:30  Function-specific meeting or workshop
11:45  Human decision point
13:30  Remediation, negotiation or execution design
14:05  Shared supplier and payments event
15:00  Event response and stakeholder engagement
16:30  End-of-day summary and overnight work
```

Switching role retains the shared event, the scenario state, earlier decisions
and the audit history. It changes the brief, the work object, the evidence
priorities, the specialist agent and the decision rights.

### The five work lanes

| Lane | Label | German | Changes by function? |
|---|---|---|---|
| Personal Work Orchestration | Organise | Organisieren | Largely common |
| Evidence and Risk Intelligence | Understand | Verstehen | Reusable services |
| Core Risk Practice | Assess | Beurteilen | Function specific |
| Human Judgment and Challenge | Decide | Entscheiden | Function specific |
| Controlled Execution and Assurance | Execute | Umsetzen | Governed and traceable |

---

## Architecture

```
Browser
  |
  |  server actions and /api routes
  v
Next.js App Router (server components read; actions mutate)
  |
  +--> Scenario State Engine        deterministic: clock, role, autonomy, view
  +--> Authority and Policy Gate    deterministic: may this action run at all?
  +--> Tool Runtime                 gate -> handler -> audit -> observability
  +--> Audit Service                append only
  +--> Calculators                  risk matrix, impact tolerance
  |
  +--> Personal NFR Work Agent      manager, owns the conversation
  |      +--> eight specialists     exposed as tools
  |      +--> retrieval             SQLite FTS5, plus cached embeddings
  |
  v
SQLite (Drizzle ORM), 40 tables, one scenario run
```

The important structural property: **the model never touches the database.** It
can ask the tool runtime to attempt something. The runtime asks the authority
gate, which is a pure function that never reads free text, so no instruction
inside a document, an email or a meeting transcript can influence whether an
action is permitted.

Read `docs/AI_ARCHITECTURE.md` and `docs/SECURITY_AND_AUTHORITY.md` for detail.

### Authority model

Every tool carries exactly one classification:

```
READ  DRAFT  PROPOSE  APPROVAL_REQUIRED  POLICY_BOUND_AUTONOMOUS  PROHIBITED
```

Three independent conditions must all hold before a mutation executes:

1. the tool's authority class is reachable at the current autonomy level;
2. the acting role holds every authority scope the tool requires;
3. where the class demands it, a valid, unconsumed, payload-bound approval
   exists, granted by a named person, with the rationale confirmed.

Autonomy levels change real tool permissions, not labels:

| Level | What it permits |
|---|---|
| Assist | Retrieve evidence, answer questions. No official drafting. |
| Prepare | Draft records and challenge questions. No record changes. |
| Recommend | Recommend with alternatives and uncertainty. No record changes. |
| Act with approval | Prepare, pause for approval, execute after a person approves. |
| Act within policy | Execute low risk, reversible, routine actions. Material actions still require approval. |

Raising the autonomy level never makes a material change free of approval. That
is tested, adversarially, in `tests/unit/authority.test.ts`.

---

## Modes

| Mode | Command | Behaviour |
|---|---|---|
| Presenter safe (default) | `npm run demo:safe` | Cached known-good outputs for the critical story beats, deterministic timing, live AI only for optional free questions. |
| Live | `npm run demo:live` | Real OpenAI calls, streaming, specialist delegation. |
| Offline | `NFR_DEMO_MODE=offline npm run dev` | No OpenAI calls at all. Seeded responses. The complete core story still works. |

A requested mode is downgraded rather than failed: asking for live mode without
a resolvable key yields presenter safe mode with the reason stated on the entry
screen and in the control room.

Mode selection is available on the entry screen and in the control room. It is
deliberately absent from the exported executive slides.

---

## Key loading

The OpenAI key is read **at runtime only**, from the user's existing
`RealAIInfrastructure` repository. It is never copied into this repository.

Resolution precedence:

1. `process.env.OPENAI_API_KEY`, when already set in the launching shell
2. `${REAL_AI_INFRA_PATH}/.env.local`
3. `${REAL_AI_INFRA_PATH}/.env`
4. `OPENAI_MINI_API_KEY` from the same files, as a final fallback
5. Presenter safe or offline mode when no usable key is found

### Current status of the key on this machine

The key in `RealAIInfrastructure/.env` **resolves correctly and is rejected by
OpenAI with HTTP 401**. Live mode therefore cannot function until it is
replaced. Presenter safe and offline mode are unaffected, and every interactive
surface, the whole story and the full decision and execution path work without
a model.

```bash
npm run smoke:live     # one minimal call; reports model, status, latency, tokens
npm run verify:config  # safe metadata only, plus a leak assertion
```

Note the distinction the health endpoint draws, which exists because of this
case. `liveAiConfigured` means a usable key was resolved. `liveAiVerified`
means a call was actually accepted, and is null until one has been attempted.
Reporting only the first would tell a presenter that live mode works when it
does not.

Configure the path in `.env.local` (never commit it):

```env
REAL_AI_INFRA_PATH=../RealAIInfrastructure
NFR_PITCH_SOURCE_PATH=../NFRPitch
NFR_DEMO_MODE=safe
```

When the variables are absent, the loader searches only the repository parent,
the grandparent, and a configured `NFR_SOURCE_ROOT`. It never scans the wider
machine. Directory matching is case insensitive.

### What the key handling never does

Never copies the key into this repository. Never creates a symlink to a key
file. Never exposes it through a `NEXT_PUBLIC_*` variable. Never embeds it in
browser JavaScript. Never logs any part of it. Never displays a prefix, a
suffix or a length. Never includes it in a screenshot, trace, test fixture,
export or error message. Never inspects Git history for secrets. Never performs
a broad recursive search for strings beginning with `sk-`. Never sends it
anywhere except the official OpenAI API, from server-side code.

`src/server/openai/client.ts` is the only module that reads the key.
`src/server/config/load-openai-config.ts` is the only module that can return
it, and it returns only safe metadata to everything else.

---

## Presentation mode

`/story` is a first-class product surface and the source of the exported deck.
Sixteen scenes in five chapters, budgeted at exactly thirty minutes.

Keyboard: arrows, space, page up and down to navigate; `Home` and `End` for
first and last; `F` full screen; `P` presenter notes; `M` pause motion; `R`
replay the scene; `?` help; `Escape` to exit full screen.

`?safe=1` or `?export=1` forces every reveal to its final state, which is what
makes the screenshot capture deterministic.

No scene may overflow at 1920x1080, 1440x900 or 1366x768. That is asserted in
`tests/e2e/visual.spec.ts` and again during the deck export, which fails if any
scene overflows.

---

## Deck export

```bash
npm run build
npm run export:deck
```

Produces:

```
exports/NFR_WorkOS_DACH_Banking.pdf
exports/NFR_WorkOS_DACH_Banking.pptx
exports/NFR_WorkOS_Speaker_Script.md
```

The PowerPoint carries the speaker notes per slide. Slides are full-bleed
captures of the real scenes rather than reconstructed native shapes, because
the visualisations are SVG and CSS and a native rebuild would lose fidelity and
drift from the live version. **The live web presentation remains the highest
fidelity surface.**

Exports contain no API keys, no developer controls, no test banners and no
hidden debug information. The secret scanner covers the `exports/` directory.

---

## Reset

```bash
npm run demo:reset
```

Restores the entire original day: the decisions, approvals, mutations and audit
events created during a demonstration are removed and the seeded state is
rewritten. Reset calls the same code path as the seed, so the restored day is
the seeded day by construction rather than by careful maintenance of a second
routine. There is also a reset control on the entry screen and in the left
rail.

---

## Testing

```bash
npm run typecheck        # TypeScript strict
npm run check:copy       # no em dash, no mojibake, no placeholder copy
npm run scan:secrets     # source, browser bundles, exports
npm run test:unit        # authority gate, secrets, calculators, guardrails, schemas
npm run test:integration # seed, consequences, state propagation, reset, continuity
npm run test:e2e         # journeys, visual matrix, security
npm run eval             # 14 structural evaluations, plus grounded ones in live mode
npm run verify:seed      # seed depth, and that nothing human owned is pre-decided
npm run verify:config    # safe configuration metadata, plus a leak assertion
npm run audit:all        # everything above, one verdict
```

`npm run verify:seed` is worth singling out. Alongside the depth minimums it
asserts a set of counts that must be **zero**: no decision already decided, no
severity already set on the shared event, no obligation already ruled
applicable, no test exception already classified, no approvals and no execution
receipts. Those are the checks that prove the seeded day leaves the human's
judgment genuinely unmade rather than merely presenting it as open.

The visual suite runs at three viewports and asserts no overflow, no text below
10px, and no covered controls. Screenshots land in
`tests/e2e/__screenshots__/` for manual inspection.

Run `npm run build` before `npm run scan:secrets` if you want the scan to cover
the browser bundles, which is the check that matters most.

---

## Relationship to the source repositories

Both are **read only** references. Neither was modified, and no secret was
copied from either.

| Repository | What was taken |
|---|---|
| `NFRPitch` | Visual design DNA: the dark token palette, the display, body and mono type split, the scene geometry contract, the motion discipline, and the copy and layout quality rules. Concepts, not code. |
| `RealAIInfrastructure` | NFR domain language, agent and step structures, the RCSA decomposition, and the human-in-the-loop pause shape. Concepts, not code. Also the runtime source of the OpenAI key. |

`docs/SOURCE_REPOSITORY_AUDIT.md` lists every file inspected, 60 borrowed
concepts, 27 items rebuilt rather than reused, and 53 inconsistencies found in
the sources.

---

## Documentation

| File | Contents |
|---|---|
| `docs/SCENARIO_BIBLE.md` | The single source of truth for all synthetic content |
| `docs/NFR_ROLE_AND_WORK_ATLAS.md` | The six roles, five lanes, and what is common versus function specific |
| `docs/EXPERIENCE_MAP.md` | All sixty cells: ten moments by six roles, today versus future |
| `docs/PRESENTATION_SCRIPT.md` | The thirty minute spoken script |
| `docs/STORYBOARD.md` | Scene construction and the emotional arc |
| `docs/AI_ARCHITECTURE.md` | Manager pattern, specialists, schemas, modes, durable context |
| `docs/SECURITY_AND_AUTHORITY.md` | Authority model, approval properties, secret handling, threat model |
| `docs/VISUAL_SYSTEM.md` | Tokens, semantic colour contract, visualisations, accessibility |
| `docs/DACH_CONTEXT.md` | Entities, jurisdiction separation, paired terminology |
| `docs/SOURCE_REPOSITORY_AUDIT.md` | What was inspected and what was borrowed |
| `docs/ASSUMPTIONS.md` | **Every judgment call, including the ones to challenge first** |
| `docs/QA_REPORT.md` | What was tested, what passed, what did not |

---

## Security

- The authority gate is the security boundary. It is deterministic and never
  reads free text.
- The text-matching guardrails are quality and hygiene, not security, and the
  documentation says so rather than overstating them.
- Prohibited tools are registered and offered to the model on purpose, so the
  refusal produces an audit record rather than resting on our assertion.
- Simulated messages cannot reach a real recipient. `simulatedOnly` is written
  as true on the row, so the trust page proves it from data.
- The audit trail is append only. Blocked attempts are recorded, because a gate
  that silently refuses teaches an auditor nothing.
- Interface clicks pass through the same gate as model requests.

---

## Limitations

Stated plainly, and in more detail in `docs/ASSUMPTIONS.md` section 6.

1. **No automated grounding evaluation suite.** Authority and refusal behaviour
   is tested thoroughly. Automated hallucination detection against live model
   output is not implemented. This is the largest gap against the original
   brief.
2. **`npm run lint` is not a real linter.** It runs the typecheck plus the copy
   and secret gates. ESLint was not added.
3. **Depth is uneven by role, by design.** Two of the six roles have complete
   but lighter journeys, and the interface labels them.
4. **Voice is best effort.** It degrades to a typed fallback whenever a realtime
   model or live mode is unavailable, and the typed path is the tested one.
5. **Two scenario figures could not be fully reconciled** with the coded risk
   methodology and with each other. Both are recorded in
   `docs/ASSUMPTIONS.md` sections 4.2 and 4.3.
6. **Cost figures are illustrative.** Published model prices change and this
   application does not read a live price list.
7. **No cloud deployment.** Optional in the brief, and not attempted.

---

## DACH jurisdiction caveat

The three legal entities sit in two different regulatory contexts and the
product keeps them apart structurally rather than by convention.

- **Arcadia Bank AG (Germany)** and **Arcadia Bank Oesterreich AG (Austria)**
  are European Union credit institutions. Synthetic content may reference the
  EU digital operational resilience framework, EBA guidance and applicable
  national supervision.
- **Arcadia Bank Schweiz AG (Switzerland)** is FINMA supervised. Its content
  uses Swiss operational risk, resilience and outsourcing context. **The EU
  digital operational resilience regulation does not apply to this entity**, and
  nothing in this product states or implies that it does.

Every regulatory reference in the product carries the label **"Illustrative
regulatory context, not legal advice."** at the point of display, not in a
footer. No compliance claim is made anywhere.

---

## Licence and data

All content is synthetic. There is no client data, no real institution, no real
person and no real supplier in this repository. No API key is committed, and
`.env` and `.env.local` are ignored.
