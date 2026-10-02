# AI Routines in NFR WorkOS

Illustrative regulatory context only -- not legal advice. All data is synthetic institution data.

---

## What are AI Routines?

AI Routines are scheduled and event-driven automations that run on behalf of a role in NFR WorkOS. Unlike one-off AI jobs, a routine recurs according to its trigger configuration and produces a new output each time it fires.

Routines operate within a defined authority class. They do not make decisions. They read data, prepare drafts, and surface signals -- and they hand the result to the responsible person for review.

A routine is not an agent acting autonomously. It is a configured background task with a narrow scope, an explicit trigger, and a declared output kind. The person holding the role retains all authority over outcomes.

---

## Trigger types

| Trigger type     | Description                                                       |
|------------------|-------------------------------------------------------------------|
| `schedule`       | Fires on a fixed cadence (daily, hourly, weekly) at a set time    |
| `before-meeting` | Fires a fixed number of minutes before a calendar meeting starts  |
| `after-meeting`  | Fires a fixed number of minutes after a calendar meeting ends     |
| `event`          | Fires when a specific domain event occurs (e.g. KRI breach)       |

---

## Authority classes

Authority classes bound what a routine may do without a human decision in the loop.

| Class   | What the routine may do                                                    |
|---------|----------------------------------------------------------------------------|
| `READ`  | Read data from connected sources. No writes, no drafts.                    |
| `DRAFT` | Produce a draft output (message, document, plan). The draft is not sent or committed without human confirmation. |
| `ACT`   | Reserved for future use. Not used in the current release.                  |

All routines in the V3.3 release are `READ` or `DRAFT`.

---

## How routines relate to the process runtime

A routine is a horizontal background layer -- it runs across all active process runs, not inside a single stage. It reads the current state of process runs (stages, evidence, actions) and surfaces a digest or a draft for the role holder.

For example, the RCSA Morning Brief reads the current RCSA Cycle run state, the calendar, open actions and the inbox in a single scheduled pass. It does not advance any stage or write any record. It outputs a brief that the role holder reads and acts on.

The Pre-Meeting Preparation routine reads the active run and produces a meeting brief thirty minutes before the meeting starts. The brief is a `DRAFT` output -- it is available for review but does not commit to any record until the role holder confirms it.

---

## RCSA active routines

Five routines are seeded for the RCSA role.

| ID                        | Name                     | Trigger           | Authority | Output             | Last run            |
|---------------------------|--------------------------|-------------------|-----------|--------------------|---------------------|
| `morning-brief-rcsa`      | Morning Brief            | Daily at 07:00    | READ      | morning-brief      | 2026-10-06 07:00    |
| `calendar-scan-rcsa`      | Calendar Scan            | Daily at 07:00    | READ      | calendar-digest    | 2026-10-06 07:05    |
| `pre-meeting-prep-rcsa`   | Pre-Meeting Preparation  | Before meeting    | DRAFT     | meeting-preparation| 2026-10-06 10:00    |
| `kri-control-watch`       | KRI and Control Watch    | Hourly            | READ      | alert-digest       | 2026-10-06 07:30    |
| `evidence-freshness-rcsa` | Evidence Freshness Check | Weekly (Monday)   | READ      | freshness-report   | 2026-09-29 06:00    |

The Morning Brief scans the Q4 RCSA Cycle state, the calendar, open actions, inbox and evidence position each morning. It is the primary entry point for the role holder's daily situational awareness.

---

## TPRM active routines

Four routines are seeded for the TPRM role.

| ID                          | Name                       | Trigger           | Authority | Output                  | Last run            |
|-----------------------------|----------------------------|-------------------|-----------|-----------------------  |---------------------|
| `morning-brief-tprm`        | Morning Brief              | Daily at 07:00    | READ      | morning-brief           | 2026-10-06 07:00    |
| `pre-meeting-prep-tprm`     | Pre-Meeting Preparation    | Before meeting    | DRAFT     | meeting-preparation     | (not yet fired)     |
| `supplier-monitoring-watch` | Supplier Monitoring Watch  | Daily at 08:00    | READ      | supplier-alert-digest   | 2026-10-06 08:00    |
| `evidence-request-followup` | Evidence-Request Follow-up | Daily at 09:00    | DRAFT     | follow-up-digest        | 2026-10-06 09:00    |

The Evidence-Request Follow-up routine is a `DRAFT` routine: it drafts a follow-up message to a supplier when an evidence request is overdue. The draft appears in the inbox for review before it is sent.

---

## Where routines are accessible in the UI

1. **Home page partner pulse** -- A compact bar below the daily strip shows a one-line summary of what the AI Partner did since the last morning brief, with links to Review (Work Hub inbox) and Ask (AI Partner panel).

2. **Processes page -- AI Routines sub-view** -- The Processes landing page carries a tab row: "Active processes" (default) and "AI Routines". The routines sub-view lists all routines for the role with their trigger, status, last run time and output kind. Clicking "View" on any routine links to the expanded detail for that routine.

3. **Morning Brief detail** -- When `?view=routines&routine=morning-brief-rcsa` (or `...tprm`) is set on the Processes page, an expanded panel shows the full morning brief content for today, including process state, calendar, actions, inbox and evidence signals.

No new primary navigation item was added. Routines are accessed through existing surfaces.

---

## Regulatory note

AI Routines in NFR WorkOS are illustrative of how a financial institution might deploy background AI automation in a non-financial risk management workflow. They are not a compliance system, a regulatory reporting system, or a legal record. All data is synthetic. All content is for demonstration purposes only.

Illustrative regulatory context -- not legal advice.

---

## Synthetic institution note

All routine data, process data, entity data, supplier data, person data and timeline data in this codebase refers to a synthetic institution (Arcadia Bank AG, ARC-DE) and synthetic counterparties (Veridian Document Systems GmbH, TP-0099). No real institution, supplier, regulatory filing or legal obligation is represented.
