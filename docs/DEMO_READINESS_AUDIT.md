# NFR Workspace: demo readiness audit (v6 meeting plan)

Audited on 2026-11-24 on the committed build `feat/nfr-workspace-v3` at edd2881 (release 5.0.0), in an isolated worktree with its own database, production build and port. Baseline tag: `baseline/pre-demo-readiness-v6`. Working branch: `feat/demo-readiness-v6`.

Method: the five acts of `docs/NFR_WORKSPACE_PRESENTER_GUIDE.md` were driven end to end by `scripts/demo/rehearse.mjs` against a production server (`next start`) at 1920x1080, cold (first run after the server started) and warm (second run), and every step was screenshotted. Each run committed a real write-back and then reset the day. Both runs: 20 steps, 0 console errors.

## 1. Areas

| Area | Current behaviour | Strong | Weak | Missing | Meeting risk | Action |
|---|---|:-:|:-:|:-:|:-:|---|
| Startup | Mark draws, three status lines, then the sign-in (about 2 s, deliberate) | x | | | low | Keep |
| Sign-in | `Admin` / `Admin`; a wrong password is refused without naming the field; three preparation steps resolve with real facts | x | | | low | Keep |
| Role initialisation | Lands on `/workday/tprm`, Third-Party Risk Manager, Arcadia Bank AG, records as of 06.10.2026, 07:45 | x | | | low | Keep |
| Today | One Now item (RepairDesk recovery time gap, TP-0042, decision DEC-2026-0741), three Next, Ask the records, Watching 6, Done today 18 | x | | | low | Keep |
| Today: Evidence on the Now card | Opens the context drawer, which shows only what the Work Hub last selected. In a fresh session it says **"Nothing selected"**; after a Work Hub visit it shows that item, not the Now item | | x | | **high** if shown | Do not click it on stage. Show evidence through Record the decision (step 3, Evidence: five cited documents) or the analysis's evidence drawer. Proposal in section 4 |
| Ask the records | The first question routes to a deterministic analysis (no model); about 1.4 s, including the three visible preparation steps | x | | | low | Keep; the readiness probe now builds it at launch |
| Visualisation | Conclusion headline, five figures, ranked bar chart with a threshold, Explain this chart, Show as table, findings with sources, a recommended next step | x | | | low | Keep. Second proposal in section 4 |
| Evidence drill-down | "12 sources" on a finding and "All evidence (15)" open the evidence drawer with source register, record id, freshness and excerpt | x | | | low | Keep |
| Human decision | Review and approve opens the proposed change: system of record, before and after per field, reason, evidence, authority; commit stays disabled until "I confirm the judgment and the reason are my own" | x | | | low | Keep. Minor: the authority line shows raw identifiers (`requestEvidenceDocument, POLICY_BOUND_AUTONOMOUS`) |
| Write-back | Commit writes a new evidence request through the gate (about 0.13 s) | x | | | low | Keep |
| Audit receipt | Transaction (AUD-...), the new record (REQ-...), fields written, recorded by, committed at (wall clock and scenario time), approval bound to the payload, evidence; View in audit log, Open the record | x | | | low | Keep |
| Agent Builder | Save as agent: outcome, scope and permissions ("This agent inherits your access. It does not create new access."), May propose, Never, the plan, Run once, Save to My agents, Save and run weekly, Request team template; promotion path | x | | | low | Keep |
| Reset | Account menu, **Reset demonstration** arms it ("Confirm reset of the demonstration", four seconds), the second click reseeds the day (about 1 s), the label says "Demonstration reset"; the page refreshes in place | x | | | low | Intentional arm-and-confirm, now named as such in the guide. Seeded ids (TP-0042, DEC-2026-0741) are stable; ids created during the demo (INS-, REQ-, AUD-, APR-) are new each run |
| Standalone launcher | Port 3200, own database, starting page, warm-up of the main pages | | x | | **high** | **Defect found:** the build step ran `C:\Program Files\nodejs\node.exe` unquoted through a shell, so every rebuild failed and the launcher fell back to the development server. The showcase build in the main checkout dates from 7 October, so every launch since the next code change has run the slower development server. Also: no readiness probe (it waited for the port only), no log file, no stop command, no failure message in the browser. Fixed (section 3) |
| First-load performance | Production server: port answers in 2.4 s; first sign-in to Today 2.8 s cold, 2.1 s warm; later steps 0.03 to 0.6 s | x | | | medium | The launcher now waits for readiness and warms every scripted page before the browser switches |
| Presentation mode | `NFR_DEMO_MODE=safe`; synthetic footer on every screen; no Next.js dev indicator; session lasts until the browser closes (cap 8 hours); seeded moment 07:45 | x | | | low | Already present; no new mode needed |

## 2. Act map (presenter guide to routes, controls and state)

| Act | Route | Controls (test id or label) | Expected state change | Fallback capture |
|---|---|---|---|---|
| 1 Startup and sign-in | `/` then `/login` | `sign-in-form`; Username, Password; wrong password shows `sign-in-error`; `Admin` / `Admin`, Enter; `preparing` | Session cookie (browser session); lands on `/workday/tprm` | 01 to 03 |
| 2 Today | `/workday/tprm` | Needs you now (`.wd-now`): Record the decision (`/workday/tprm/decisions#DEC-2026-0741`), Evidence (see risk), Ask about this case; Done today disclosure | None | 04 to 06 (06 shows the empty drawer: do not use on stage) |
| 3 Question and visual answer | `/workday/tprm/insights/INS-<new>` | `home-ask-input`, type *Which critical third-party services are deteriorating, and why?*, Enter; `insight-canvas`; `evidence-open` ("12 sources"); Ask next: Concentration | An analysis run is stored (INS-...); read-only, audited tool call | 07 to 10 |
| 4 Insight to action | same, then `/workday/tprm/insights/records?source=audit&record=AUD-...` | `review-<rec>` (Review and approve), `writeback-dialog`, `writeback-confirm`, `writeback-commit`, `writeback-receipt`, View in audit log, Open the record | New evidence request REQ-... on Novalink (TP-0042), approval APR-... consumed, audit AUD-...; the recommendation shows Done | 11 to 16 |
| 5 The long tail | `/workday/tprm/agents?from=INS-...` | Save as agent, `agent-builder`, Save and run weekly, `my-agents` | Personal agent saved, weekly Monday 07:00, 0 runs | 17 to 19 |
| Reset | any workday page | `header-account`, `account-reset` twice | Seeded day restored; analyses, approvals, agents cleared | 20 |

## 3. Changes in this branch

| Change | Why |
|---|---|
| `GET /api/health/demo` (`src/demo/readiness.ts`) | One answer to "can the meeting journey run": database migrated and seeded, portfolio history present, the day clean since the last reset, and the first question built from the records in memory (no model, nothing stored, nothing audited). Building it also warms the analysis. Covered by `tests/integration/demo-readiness.test.ts` |
| `scripts/launcher/launch.cjs` | Checks Node and the SQLite driver with a plain message; reuses a healthy showcase and refuses a foreign process on 3200; migrates and seeds when needed; `--reset` restores the clean day before start; builds when the code changed (quoting fixed; webpack on a junctioned `node_modules`); waits for `/api/health/demo` (four-minute limit); warms every scripted page; reports each check and whether the day is clean; logs everything to `data/launcher.log`; writes `data/showcase.pid` |
| `scripts/launcher/starting.html` | Shows the launcher's real progress and switches to the product only when the launcher reports ready; shows the failure and the log path if it fails |
| `scripts/launcher/stop.cjs`, `Stop NFROS.cmd` | A matching stop: stops the showcase's Node process (pid file, else the port 3200 listener), never a non-Node process |
| `scripts/demo/rehearse.mjs` | Repeatable rehearsal of the five acts with step timings, one screenshot per step, an optional recording and `captures.json`; refuses port 3000; resets at the end |

## 4. Proposals not implemented here (the insight and work areas are being changed in another session)

1. **Today, Evidence on the Now card.** Bind the Now item's evidence (the decision's cited documents) before opening the drawer, or link the button to the decision's Evidence step. Today it shows "Nothing selected" or a stale Work Hub item.
2. **First-answer visual (plan section 13).** The answer is already conclusion-first with five figures and a ranked bar chart. Optional: put the shared-provider point in the chart title ("Three critical third parties deteriorated; two share Basalt Cloud"), cap the figures at four (plan), and show the as-of date and stale-evidence count beside the chart.
3. **Authority line in the review.** Show a plain label instead of `requestEvidenceDocument, POLICY_BOUND_AUTONOMOUS`.

## 5. Timings

See the presenter guide's checklist; measured values are in section 6 of this document after the launcher change.
