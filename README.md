# NFROS

## Live the NFR Day

Role Operating Systems for non-financial risk professionals, with human
accountability at every material decision.

**Synthetic institution and data.** Arcadia Banking Group and every person,
supplier, control, transaction, incident and regulatory publication in this
repository are invented for the purpose of a demonstration.
**Illustrative regulatory context, not legal advice.**

---

## Release

| | |
|---|---|
| Product | NFROS, NFR Operating System |
| Product release | 4.1.0, Product truth and release coherence (release candidate, 2026-10-05) |
| Workday interface | V3.3, `/workday` |
| NFROS Risk Audience Presentation | V2.4, `/story` |

One product identity, one release registry and one status vocabulary. Versions, role release states, Role Apps, connector modes, AI modes, evaluation status, readiness and audit integrity are read from data or marked Not verified.

Role release states:

| State | Roles |
|---|---|
| Available | Operational Risk Partner, Third-Party Risk Manager |
| Demo | Control Assurance Specialist, Incident and Resilience Lead |
| Planned | Regulatory Change Manager, NFR Portfolio Lead |

Role Apps:

| Role App | Role | State | Version | Route |
|---|---|---|---|---|
| RCSA Cycle Assistant | Operational Risk Partner | Installed | 1.0.0 | `/workday/rcsa/processes/rcsa-cycle` |
| Third-Party Onboarding | Third-Party Risk Manager | Installed | 1.0.0 | `/workday/tprm/processes/third-party-onboarding` |
| Event-Driven Reassessment | Operational Risk Partner | Preview | 0.1.0 | Not routed |
| Rapid Assessment | Operational Risk Partner | Preview | 0.1.0 | Not routed |
| Periodic Reassessment | Third-Party Risk Manager | Preview | 0.1.0 | Not routed |
| Exit Planning | Third-Party Risk Manager | Preview | 0.1.0 | Not routed |
| Fourth-Party Deep Dive | Third-Party Risk Manager | Preview | 0.1.0 | Not routed |

Known limitations:

1. **Two of six roles are complete.** Only the Available roles have the full workday and complete processes. A Demo role opens an explanatory page, and a Planned role is not built. The role selector labels each one. State: stated in the product. See `src/product/release/role-release.ts`.
2. **AI evaluation is structural only.** Evaluation cases are graded against synthetic test envelopes built from each case. Grounded and live modes record every case as not run, so the quality of model output is not verified. The AI quality page shows the recorded run and says so. State: stated in the product. See `/settings/ai-quality`.
3. **No client system is connected.** Every seeded connector instance is simulated, sandbox ready without a credential, configured but unreachable, or planned. None reads a client system, and each one shows its mode. State: stated in the product. See `/settings/integrations`.
4. **No enterprise identity.** Sessions are local demonstration personas or a static pilot account list. There is no single sign-on and no tenancy, and in demonstration mode the acting role is scenario state. State: open. See `src/identity/`.
5. **Role App management is read only.** A product owner cannot enable, disable, stage, compare, assign or retire a Role App. Installed and preview states come from the code registry. State: open. See `/settings/role-apps`.
6. **Pilot management is readiness checks only.** There is no pilot cohort, baseline, goal, success criterion, feedback log or go or stop decision. State: open. See `/settings/pilot`.
7. **Evidence exports run from the command line.** The pilot evidence pack and audit chain verification are produced by npm scripts. The interface offers no download for either. State: open. See `npm run pilot:evidence-pack, npm run audit:verify-chain`.
8. **Operations is not linked to roles or processes.** The operations console shows component health, the job queue and the audit chain. It does not connect an incident to an affected role, process, person or release decision. State: open. See `/ops`.
9. **Stored administrator values are English.** The settings area and the operations console follow the scenario language. Values read from a registry or the database, such as tool and autonomy descriptions, deployment profiles, connector notes, model profile purposes and regulatory references, are shown as stored, in English. State: open. See `app/settings/`.
10. **Runs on one machine.** One process with a local SQLite file. A Dockerfile and a compose file exist; no cloud deployment has been made. State: open. See `/settings/deployment`.
11. **Voice is best effort.** Voice falls back to typed input whenever a realtime model or live mode is unavailable. The typed path is the tested one. State: open. See `docs/ASSUMPTIONS.md`.
12. **Two scenario figures are not fully reconciled.** Two figures could not be fully reconciled with the coded risk methodology and with each other. Cost figures are illustrative and no live price list is read. State: open. See `docs/ASSUMPTIONS.md sections 4.2 and 4.3`.

_This section is generated from `src/product/release`. After changing the registry, run `npx tsx scripts/sync-release-readme.ts`._

---

## What this is

A working prototype of a non-financial risk operating environment, built around
one synthetic banking day: Tuesday 06.10.2026 at Arcadia Banking Group, a
mid-large universal banking group operating in Germany, Austria and
Switzerland. Two flagship Role Operating Systems, the Operational Risk Partner
and the Third-Party Risk Manager, are complete enough to work in; the other
four roles are labelled Demo or Planned and say so.

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
| The previous interface, for comparison | http://localhost:3000/workday/rcsa?ui=v2 |
| Administration, settings index and release | http://localhost:3000/settings |
| Administration, integrations | http://localhost:3000/settings/integrations |
| Administration, role apps | http://localhost:3000/settings/role-apps |
| Administration, AI quality | http://localhost:3000/settings/ai-quality |
| Administration, pilot readiness | http://localhost:3000/settings/pilot |
| Administration, audit integrity | http://localhost:3000/settings/audit-integrity |
| Operations console | http://localhost:3000/ops |
| Control room, mode and reset | http://localhost:3000/control-room |
| Trust and authority | http://localhost:3000/trust |
| Value model | http://localhost:3000/value |
| Roadmap | http://localhost:3000/roadmap |
| AI health, JSON | http://localhost:3000/api/health/ai |

If port 3000 is taken, pass another: `next dev -p 3001`.

### Which interface you get

The interactive workday has three interfaces served from the same routes. They
read the same database, the same scenario run, the same repositories, the same
server actions and the same authority gate; only the presentation differs.

```text
?ui=v3.3  Workday interface V3.3, the default (also ?ui=current, latest, v3, v3.1)
?ui=v2    Interactive Workday V2
?ui=v1    the previous interface
NFR_WORKDAY_UI=v1|v2|v3.3    pins a version for a deployment
```

V3.3 is the current workday interface: a light, role-native Home, Work,
Processes and Decisions, with the AI Partner, Search and Updates in the shell.
A route that has no V3.3 implementation is served by V2 rather than by a
hybrid of the two; the list of V3.3 routes is `V3_NATIVE_SEGMENTS` in
`src/workday/contracts.ts`. V2 and V1 are retained for comparison and are not
supported variants. The reasoning behind V2 is in
`docs/INTERACTIVE_WORKDAY_V2.md` and behind V3 in
`docs/INTERACTIVE_WORKDAY_V3_1.md`.

---

## The six roles

The same day, the same event, six different professional questions. The
release state of each role is read from `src/product/release/role-release.ts`
and shown in the role selector.

| Route | Role | Release state | Holder | Entity |
|---|---|---|---|---|
| `/workday/rcsa` | Operational Risk Partner | Available | Marlene Aigner | Arcadia Bank AG |
| `/workday/tprm` | Third-Party Risk Manager | Available | Stefan Brunner | Arcadia Bank AG |
| `/workday/control-assurance` | Control Assurance Specialist | Demo | Jakob Steinbacher | Arcadia Bank Oesterreich |
| `/workday/incident-resilience` | Incident and Resilience Lead | Demo | Nadia Lehmann | Arcadia Bank Schweiz |
| `/workday/regulatory-change` | Regulatory Change Manager | Planned | Tobias Reinhardt | Arcadia Bank AG |
| `/workday/nfr-governance` | NFR Portfolio Lead | Planned | Dr. Katharina Vogt | Arcadia Bank AG |

The two Available roles have the full workday: Home, Work (Agenda, Meetings,
Actions and Inbox), Processes with an eight-stage Role App each, and
Decisions. A Demo or Planned role opens an explanatory page rather than a
partial workday, so nothing implies parity that does not exist.

### The shared day

Ten moments, shared by every role.

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

---

## Role app architecture

A Role App is a packaged, stage-gated process that the AI Partner guides a
named role through. It is distinct from a function pack (the licensing unit)
and from a connector pack (the data source family).

```
Function pack    what a deployment has licensed
  Role App       a specific process within that function
    Run          one live instance of that process, for one subject
```

The type contracts are in `src/role-apps/contracts.ts`. The installed
definitions are in `src/role-apps/rcsa/definition.ts` and
`src/role-apps/tprm/definition.ts`. The full catalogue, including preview
apps, is in `src/role-apps/registry.ts`, and the installed and preview apps
are listed in the Release section above, generated from it.

Preview apps appear in the administrator registry view at
`/settings/role-apps` and have no routed process page. There is no enable or
disable control: installed state comes from the code registry, and the
settings screen marks the control Unavailable.

---

## Product status

The product reports on itself in one vocabulary of eight words, defined in
`src/product/status/vocabulary.ts` with an English and a German label, a tone
and a one line meaning each:

| Status | Meaning |
|---|---|
| Empty | The source works and holds no records yet. |
| Unavailable | The source or capability cannot be used here, so nothing is shown in its place. |
| Simulated | Produced from the synthetic institution through the real contract, not from a client system. |
| Safe | Critical AI steps come from reviewed, cached responses. |
| Offline | No AI provider is called. |
| Live | Connected to a real provider or system. |
| Verified | A check ran against real data and passed. |
| Not verified | No check has confirmed this, or the check did not pass. |

Verified is only ever returned by a function that ran its check; the absence
of a check is Not verified. The functions are in
`src/product/status/sources.ts`, and the operations console and the settings
area render them:

- AI mode is Safe, Offline or Live, and the provider is Verified only after a
  live call has been accepted in the running server process.
- Connector instances are Simulated, Live, Not verified (sandbox ready) or
  Unavailable (configured but unreachable, or planned).
- The recorded evaluation run is Simulated for the harness when it is
  structural, and model output is Not verified until a run grades it.
- The audit chain is Verified when every chain record recomputes, and
  coverage of the audit trail is reported beside it.

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
  +--> Release registry and status  what the product is, and what is true of it
  |
  +--> Personal NFR Work Agent      manager, owns the conversation
  |      +--> eight specialists     exposed as tools
  |      +--> retrieval             SQLite FTS5, plus cached embeddings
  |
  v
SQLite (Drizzle ORM), one scenario run
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
| Safe (default) | `npm run demo:safe` | Cached known-good outputs for the critical story beats, deterministic timing, live AI only for optional free questions. |
| Live | `npm run demo:live` | Real OpenAI calls, streaming, specialist delegation. |
| Offline | `NFR_DEMO_MODE=offline npm run dev` | No OpenAI calls at all. Seeded responses. The complete core story still works. |

A requested mode is downgraded rather than failed: asking for live mode without
a resolvable key yields Safe mode, with the reason stated in the control room
and on the operations console.

Mode selection is available in the control room. It is deliberately absent
from the exported executive slides.

---

## Key loading

The OpenAI key is read **at runtime only**, from the user's existing
`RealAIInfrastructure` repository. It is never copied into this repository.

Resolution precedence:

1. `process.env.OPENAI_API_KEY`, when already set in the launching shell
2. `${REAL_AI_INFRA_PATH}/.env.local`
3. `${REAL_AI_INFRA_PATH}/.env`
4. `OPENAI_MINI_API_KEY` from the same files, as a final fallback
5. Safe or offline mode when no usable key is found

### Running live mode

Precedence 1 is the route to use, because it is the only one that keeps the key
out of this repository entirely. Set it in the launching shell:

```bash
export OPENAI_API_KEY=...        # never committed, never written to a file here
npm run demo:live
```

The same applies to every script that makes a call: `npm run smoke:live`,
`npm run eval` with `NFR_DEMO_MODE=live`, and `npx tsx scripts/verify-ai-partner.ts`.
A key set this way reaches the server process and nothing else: it is not
written to disk, not sent to the browser, and not readable through any route.
`npm run scan:secrets` covers the production browser bundle and asserts it.

### Whether live mode works here

This README does not assert it, because it is a property of the machine and
the key, not of the code. The product reports it instead: the operations
console shows the provider as Verified only after a live call has been
accepted in the running server process, and as Not verified otherwise, with
the reason. A live run verified during earlier work found three defects that
the fallback had been hiding; they are fixed and recorded in
`docs/ASSUMPTIONS.md` section 7.18.

Safe remains the default, because predictable timing matters more than
novelty in a live demonstration. Every interactive surface, the whole story,
the AI Partner and the full decision and execution path also work with no
model at all, which is a requirement rather than a consolation: the complete
local experience must not require external credentials.

```bash
npm run smoke:live     # one minimal call; reports model, status, latency, tokens
npm run verify:config  # safe metadata only, plus a leak assertion
```

The health endpoint draws the same distinction. `liveAiConfigured` means a
usable key was resolved. `liveAiVerified` means a call was actually accepted,
and is null until one has been attempted. Reporting only the first would tell
a presenter that live mode works when it does not.

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

`/story` opens the Risk Audience Presentation, release V2.4: a thirteen-slide
core (cover, agenda, eleven content slides), a Q&A close, and a reference
appendix of twenty topics. It is a first-class product surface and the source
of the exported PDF and PowerPoint.

| URL | Opens |
| --- | --- |
| `/story` | V2.4, slide 1 |
| `/story?deck=current` or `?deck=v2.4` | V2.4 |
| `/story?deck=v2.4&core=7` | V2.4, core slide 7 |
| `/story?deck=v2.4&appendix=app-05&from=core-7` | Appendix topic, with a return to slide 7 |
| `/story?deck=v2.4&view=appendix-index` | Appendix index, grouped by topic area |
| `/story?deck=v2.3`, `v2.2`, `legacy` | Earlier releases, unchanged |

The URL always reflects the current slide, so refresh and the browser back
button land where you expect.

Keyboard: `Left` and `Right` to move; `Home` and `End` for first and last; `A`
appendix index; `C` back to the core slide you came from; `R` replay the current
slide; `M` pause and resume motion; `D` downloads; `F` full screen; `P` speaker
notes; `?` help.

`?export=1&safe=1` renders every exhibit in its final state, which is what
makes capture and export deterministic. Reduced motion does the same.

Product proof on slides 6, 7, 8 and 10 uses real captures of the Role Operating
Systems, registered in `public/presentation-assets/v2.4-final/`. See
`docs/PRESENTATION_V2_4_COMPLETION.md` for the full release record.

The legacy sixteen-scene deck remains at `/story?deck=legacy`.

---

## Deck export

V2.4, the current release:

```bash
npm run build
npm run capture:presentation-assets    # refresh the real product captures
npm run verify:presentation-assets
npm run export:presentation-v2-4
npm run verify:presentation-exports
```

Produces, and publishes to `public/downloads/` for the in-deck download menu:

```
exports/NFROS_Risk_Audience_V24_Core.pdf
exports/NFROS_Risk_Audience_V24_Core_and_Appendix.pdf
exports/NFROS_Risk_Audience_V24_Core_and_Appendix.pptx
exports/NFROS_Risk_Audience_V24_Speaker_Notes.md
```

Appendix references stay clickable in both the PDF and the PowerPoint. The
export fails if any product proof asset is missing. Details in
`docs/PRESENTATION_V2_4_EXPORTS.md`.

The legacy deck export:

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
routine. There is also a reset control in the control room.

---

## Testing

```bash
npm run typecheck        # TypeScript strict
npm run check:copy       # no em dash, no mojibake, no placeholder copy
npm run scan:secrets     # source, browser bundles, exports
npm run test:unit        # authority gate, secrets, calculators, guardrails, schemas, release and status
npm run test:integration # seed, consequences, state propagation, reset, continuity
npm run test:e2e         # journeys, visual matrix, security
npm run eval             # structural evaluations, plus grounded ones in live mode
npm run eval:structural  # the case suite against synthetic envelopes; writes evals/results/latest.json
npm run verify:seed      # seed depth, and that nothing human owned is pre-decided
npm run verify:config    # safe configuration metadata, plus a leak assertion
npm run audit:all        # everything above, one verdict
```

`tests/unit/product-release.test.ts` fails when package.json, the CHANGELOG top
entry, the README release section or a hard-coded version on the operations
console or the settings area disagree with the release registry.

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
| `docs/OS_PRODUCT_EXCELLENCE_PLAN.md` | **The current improvement programme for the two flagship Role Operating Systems** |
| `docs/SCENARIO_BIBLE.md` | The single source of truth for all synthetic content |
| `docs/NFR_ROLE_AND_WORK_ATLAS.md` | The six roles, five lanes, and what is common versus function specific |
| `docs/EXPERIENCE_MAP.md` | All sixty cells: ten moments by six roles, today versus future |
| `docs/PRESENTATION_SCRIPT.md` | The thirty minute spoken script |
| `docs/STORYBOARD.md` | Scene construction and the emotional arc |
| `docs/AI_ARCHITECTURE.md` | Manager pattern, specialists, schemas, modes, durable context |
| `docs/AI_ROUTINES.md` | The AI routines shown on the Processes page |
| `docs/SECURITY_AND_AUTHORITY.md` | Authority model, approval properties, secret handling, threat model |
| `docs/VISUAL_SYSTEM.md` | Tokens, semantic colour contract, visualisations, accessibility |
| `docs/DACH_CONTEXT.md` | Entities, jurisdiction separation, paired terminology |
| `docs/SOURCE_REPOSITORY_AUDIT.md` | What was inspected and what was borrowed |
| `docs/ASSUMPTIONS.md` | **Every judgment call, including the ones to challenge first** |
| `docs/QA_REPORT.md` | What was tested, what passed, what did not |
| `docs/INTERACTIVE_WORKDAY_V2.md` | The V2 interactive redesign: what changed, why, and where the code is |
| `docs/INTERACTIVE_WORKDAY_V3_1.md` | The light V3 workday interface |
| `docs/ROLE_APP_ARCHITECTURE.md` | The Role App model: function pack, Role App, run |
| `docs/RCSA_PROCESS_APP.md` | The RCSA Cycle Assistant |
| `docs/TPRM_ONBOARDING_APP.md` | Third-Party Onboarding |
| `docs/EVALUATION_REPORT.md` | The last written evaluation report |
| `docs/PRODUCT_ARCHITECTURE.md` | The packaging model, function packs, dedicated deployment assumption |
| `docs/WHITE_LABEL_AND_PACKAGING.md` | The three branding modes, product language, entitlements |
| `docs/DEPLOYMENT_PROFILES.md` | The four deployment shapes and what this prototype actually runs |
| `docs/INTEGRATION_FABRIC.md` | The system of engagement principle, inbound and outbound pipelines |
| `docs/CONNECTOR_CONTRACT.md` | The connector interface, capabilities, idempotency, errors |
| `docs/PRODUCTIZATION_GAPS.md` | **What a real engagement would still have to build** |
| `docs/handoffs/` | Per workstream handoffs, including the V1 baseline audit |

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
- Tamper evidence covers chained records only. In this build the seeded audit
  events are chained and events written by the audit service are not;
  `/settings/audit-integrity` shows both the chain status and the coverage.
- Interface clicks pass through the same gate as model requests.

---

## Limitations

The known limitations of this release are listed in the Release section above,
generated from `src/product/release/product-release.ts`, and shown with their
state on the operations console. More detail is in `docs/ASSUMPTIONS.md`
section 6 and `docs/PRODUCTIZATION_GAPS.md`.

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
