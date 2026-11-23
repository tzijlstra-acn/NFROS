# NFR Workspace v3: the reality-checked plan

Synthetic institution and data. Illustrative regulatory context, not legal advice.

This file replaces the external brief `CLAUDE_CODE_PLAN_NFR_WORKSPACE_PRODUCT_V3.md` as the working
plan. That brief was written without sight of this repository. Its product intent is right and is
kept: a workspace that feels real from sign-in to answer, that starts with work rather than a blank
chat, that answers questions with visual, evidence-linked analysis, and that turns an answer into a
governed write-back with a receipt. Its implementation guidance assumed a thin prototype. This
repository is not one, so roughly half of what the brief asks to build already exists, and several
of its technical suggestions would regress what is here.

The principle is unchanged: **AI prepares. Professionals decide. Systems record.**

---

## 1. What the baseline audit found (main at 7ca5a41, tag `baseline/pre-nfr-workspace-v3`)

| Brief section | Already in NFROS | Verdict |
|---|---|---|
| 7 Today: Now, Next, Watching, Done | V3.3 Home: one "Needs you now", Next capped at three (`NEXT_LIMIT`), Watching and Done collapsed, Your day, Partner update, all with lineage (`src/features/home`) | Keep. Polish only |
| 9 Synthetic data | 122 tables in SQLite through Drizzle, one deterministic seed, reset by the same code path, Arcadia Banking Group across DE, AT and CH (`docs/SCENARIO_BIBLE.md`) | Keep. Deepen with history, do not replace. No IndexedDB |
| 9.4 Stories A to E | All five already exist as threads of the scenario day: Novalink and Corporate Payments (A), Basalt Cloud under two suppliers and the undeclared Aurora fourth party (B), the CTL-PAY cluster with 6 not-effective controls (C), the Swiss tolerance of 120 minutes against about 130 elapsed and RepairDesk 3h40 against a 2h objective (D), REG-2026-0031-DE mapped to CTL-PAY-014 and two overdue policy reviews (E) | Keep the stories. Add the history that makes them chartable |
| 11 Write-back and permissions | Authority gate with six classes and five autonomy levels, payload-bound single-use approvals, `runGovernedChain`, execution receipts, append-only audit, hash chain. Tools `createAction`, `createIssue`, `requestEvidenceDocument`, `activateMonitoring`, `reassignAction` exist | Keep. Reuse for insight write-back. No new permission model |
| 11.4 Seven roles | Six roles with authority scopes and release states (two Available, two Demo, two Planned) | Keep the six. Do not add a parallel role set |
| 10.4 Two-mode AI | Safe, Offline and Live modes, key read server side only, secret scanner over the browser bundle | Keep |
| 12 Agent Builder | Unmerged branch `feat/tprm-skills-builder`: a sentence drafted into a catalog-checked, read-only query, previewed through the `runSkill` READ tool, saved to a personal list, weekly schedule | Merged into this branch (commit 01b6c44). Promote to the Agents area |
| 14 Design | Scoped V3 token system (`src/styles/workday-v3-tokens.css`, IBM Plex, light and dark), bilingual EN and DE copy everywhere, copy rules (no em dash, no placeholder copy) | Keep. New UI must use `--wd-*` tokens and ship EN and DE |
| 18 Tests | 1,109 unit tests passing, integration suite, about 35 Playwright specs at three viewports | Keep. Extend |

### The real gaps

1. **No sign-in and no startup.** `/` is a marketing-style landing page; nothing guards the workday.
2. **The brand is NFROS.** One source (`PRODUCT_IDENTITY`) plus a handful of literals.
3. **The AI Partner cannot answer analytical questions in Safe mode**, which is the presentation
   default. Outside seven prepared topics it answers "There is no prepared, cited answer to this
   question in Safe mode, so nothing was made up." The chat never calls a READ tool, even in Live
   mode, so no answer is ever built from the records.
4. **Answers are prose only**, in a 360px dock. There is no chart, metric or table part. `d3` is a
   dependency but is not used.
5. **History is thin.** KRI readings cover January to September 2026, each control has one test,
   incidents cover six weeks, and there is no risk acceptance record at all. Eight suppliers make a
   portfolio chart look like a list.
6. **No Insights or Agents area**, and a chat proposal cannot be approved and committed in place.

---

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Stay on Next.js 16, SQLite and Drizzle. Every new record is a run-scoped table, seeded deterministically and cleared by reset | One persistence model; reset stays correct by construction |
| D2 | Admin / Admin is a demo sign-in to the existing `administrator` persona through the existing signed-session provider. The administrator acts as a role holder; a role switcher sits in the account menu | No second identity system; replaceable by OIDC behind the same provider interface |
| D3 | The guard lives in `middleware.ts`, which already verifies the signed cookie on the Edge. `NFR_DEMO_AUTH=off` disables it for isolated test stacks | One gate for every product route |
| D4 | Analytical answers come from a deterministic **insight engine**: an intent router plus a library of queries over the scenario tables that returns a Zod-validated `InsightResponse`. It is registered as the READ tool `analyseQuestion`, so Live mode reads the same numbers. The model may phrase; it never produces a figure | Numbers are reproducible and auditable; Safe mode stops declining |
| D5 | One new chat part kind, `insight`, carries the response. The dock shows a compact card; the full canvas opens at `/workday/[role]/insights/[id]`, persisted in `insight_runs` | Extends the existing part pipeline instead of reviving the unused `src/ai/contracts.ts` |
| D6 | Charts are React SVG on `d3` scales, shapes and hierarchy, styled with `--wd-*` tokens plus a small chart palette. Every chart has a conclusion title and a data-table alternative. The engine selects a type from a fixed list and supplies validated data; it never supplies code | One chart system, already a dependency |
| D7 | Insight write-back reuses `runGovernedChain` with the existing tools. A review dialog shows target, fields, before and after, evidence and the approval the person is about to grant | The authority gate stays the only write path |
| D8 | Data depth is additive: a risk acceptance register, a broader supplier portfolio, 24 months of supplier performance and KRI history, eight quarters of control test results. The flagship day, its decisions and the flagship desks are unchanged, and `verify:seed` zero checks still hold | The existing story and tests keep working; analysis gets something real to show |
| D9 | Skills become **Agents** in the interface: the four-step builder (Describe, Scope and permissions, Plan, Run and save) over the skills engine, plus saved analyses. Internally the module keeps its name | No parallel agent runtime; "inherits your access" is already true of `runSkill` |
| D10 | The recorded presentation decks under `/story` keep their NFROS names. They are versioned releases with exported PDFs and captures; rebranding them is a separate decision | Avoids silently changing recorded artefacts |

---

## 3. Scope

### P0, the one believable loop

1. Rebrand the product to **NFR Workspace** through `PRODUCT_IDENTITY` and the remaining literals.
2. Startup sequence at `/` (about 1.8s, static under reduced motion), then sign-in with Admin / Admin,
   invalid-credential state, show and hide password, then a short context-loading step, then Today.
3. Route guard for the workday and the administration surfaces; sign-out in the account menu.
4. Account menu: signed in as Admin, acting as the role holder, role switcher for the two Available
   roles, links to Settings, Control room and Audit integrity, reset demo, sign out.
5. Data depth (D8): `risk_acceptances`, `supplier_performance`, `control_test_results`, KRI history,
   portfolio suppliers, services and subprocessors that make concentration visible.
6. Insight engine with at least these intents, each with synonyms in EN and DE:
   third-party deterioration, provider concentration, what changed in the payment service review,
   repeatedly failing controls, overdue high-severity issues, risk acceptances expiring in 90 days,
   resilience gaps by service, policy change impact, management summary, next action on the case.
7. Insight canvas: conclusion, metric strip (up to five), one primary chart, findings, evidence with
   freshness, recommended action, follow-ups, query plan ("Using, Time window, Grouped by").
8. Chart set: horizontal bar, line and area, stacked bar, heatmap, treemap, network, timeline,
   bullet comparison, waterfall, table. Every one with a table alternative.
9. Ask entry points: an Ask bar on Today with role questions, "Ask about this case" on the Now item,
   and the AI Partner dock returning an insight card in Safe and Offline mode.
10. Write-back from an insight: create a remediation action and request missing evidence, plus
    create issue and activate monitoring where the role holds the scope. Review, confirm, receipt,
    audit, Today and Work reflect the change.
11. Insights area: suggested questions by role, saved analyses, recent analyses.
12. Tests: unit tests for the engine, schemas and seed determinism; an end-to-end journey from
    startup to receipt to reset.

### P1, after P0 is stable

1. Agents area with the four-step builder, "Save as agent" from an insight, run history.
2. Records tab in Insights for the source tables behind a chart, with drill-down from a chart mark.
3. Print-friendly management briefing.
4. "How it works" drawer on the canvas: tool calls, sources, authority classes.
5. Release 5.0.0 entry in the release registry, README and CHANGELOG.

### P2, after the presentation

Enterprise identity behind the provider interface, a server database, live model phrasing over
`analyseQuestion`, connectors, maker-checker service, tenancy. `docs/PRODUCTIZATION_GAPS.md` holds
the longer list.

---

## 4. What is deliberately not done

- No browser-side store, no IndexedDB, no second permission model, no second chart library.
- No new role taxonomy. The brief's "NFR Business Owner" is the audience of the demonstration, not
  a seventh role.
- No model-generated chart code and no model-generated figures.
- No claim that Admin / Admin is security. The sign-in page says it is a synthetic demonstration
  environment, and the session secret has a development fallback that production must override.
- The `/story` decks are not rebranded (D10).

---

## 5. Sequence

| Step | Commit | Content |
|---|---|---|
| 0 | `01b6c44` | Merge the Skills branch |
| 1 | plan | This file |
| 2 | brand | NFR Workspace identity |
| 3 | entry | Startup, sign-in, guard, account menu, sign-out |
| 4 | data | Migration 0010 and the portfolio depth seed |
| 5 | insights | Schema, engine, intents, persistence, READ tool |
| 6 | charts | Renderer and canvas |
| 7 | ask | Today Ask bar, Now "Ask about this case", partner insight part, Insights area |
| 8 | write-back | Review dialog, governed commit, receipt |
| 9 | agents | Agents area, save from insight |
| 10 | QA | Viewports, console, accessibility, journey test, presenter guide |

Each step leaves the application running and the existing suites passing.
