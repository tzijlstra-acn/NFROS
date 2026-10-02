# RCSA Cycle Assistant

The RCSA Cycle Assistant is the structured process app for the Operational Risk Partner role. It guides the professional through the eight stages of a Risk and Control Self-Assessment from the first evidence check through the committee-ready conclusion, one authority-gated stage at a time.

The app is part of the NFR WorkOS Operational Risk function pack.

---

## What it does

An RCSA is a quarterly structured exercise in which the Operational Risk Partner challenges the first line's own view of its risks and controls. Done without support, it involves gathering KRI readings, control test results and audit findings from multiple systems, comparing them against the prior version, setting a workshop agenda, running the challenge session, recording a rationale for any disputed rating, and assembling the actions and committee paper on the same day.

The RCSA Cycle Assistant holds each stage open until the human authority gate is satisfied, then advances to the next. The AI partner prepares the evidence, surfaces the gaps and drafts positions. The professional decides.

---

## The eight stages

### Stage 1: Scope and trigger

The assessment scope is confirmed before evidence gathering begins. The AI reads the process hierarchy, identifies the legal entities in scope and surfaces any scope changes since the prior cycle. The human confirms the scope and trigger reason. Nothing moves until this is on the record.

### Stage 2: Evidence refresh

Every KRI reading, control test result, incident record and audit finding from the assessment period is retrieved and loaded into the evidence corpus. The AI flags which indicators have breached their thresholds and whether the breach pattern is consistent across them. Where evidence is missing, it is formally requested with a due date.

The professional decides the investigation strategy: separate explanations per indicator, as the escalation rule requires, or one causal investigation that names the shared mechanism. This is a recorded departure from procedure when it applies, and it is a professional judgment about what will inform the committee better.

### Stage 3: Risk and control change

The AI compares every risk and control in scope against the prior assessment version. Changes to control effectiveness, inherent position and appetite position are flagged with the source that drove each change. The professional determines what the evidence says about risk likelihood. Where the loss register shows no losses, the AI surfaces the question: is that evidence about likelihood, or evidence about the detection controls' ability to see the outcome?

### Stage 4: First-line input

First-line effectiveness positions are collected and compared with the second-line pre-read. The AI identifies which controls have a gap between first-line and second-line positions and how many bands apart the two readings are. The professional sets the challenge workshop agenda. Facilitation sequence is a professional instrument: the order in which contested items are heard determines whether the room arrives at a disputed rating with momentum or fatigue.

### Stage 5: Challenge workshop

The workshop is run. The AI presents a side-by-side view of the two positions for every contested control, with the evidence behind each and the unresolved points flagged. The professional challenges the first-line position and records a conclusion or a formal dissent. A recorded dissent requires a rationale the professional confirms as their own. The authority gate does not open until the rationale is confirmed.

### Stage 6: Rating and appetite

Every residual position is computed from the agreed control effectiveness using the group methodology. Each risk is classified as within appetite, at limit or outside appetite. The AI produces the matrix and identifies which risks require either a committed remediation plan with dates or a Risikoakzeptanz. The professional decides which path applies to each outside-appetite risk. Monitoring alone does not discharge the requirement where the group policy says it does not.

### Stage 7: Actions and approval

Remediation actions from the workshop are recorded with an owner, a due date and a success criterion. The assessment is versioned and the rationale is confirmed. The committee paper is drafted by the AI from the agreed positions and the action register. The professional approves the assessment version and confirms the rationale. Where the mechanism behind a rating is now known to differ from the argument recorded in the morning, the professional decides whether to revise the reasoning before the paper goes out.

### Stage 8: Monitoring and reassessment

The post-cycle monitoring plan is set. KRI alert thresholds are confirmed for the period while remediation actions remain open. The next cycle trigger date is recorded. The assessment is closed. The AI proposes enhanced monitoring for any indicator that contributed to an outside-appetite rating, with a frequency based on the action due dates. The professional confirms the plan and the escalation threshold.

---

## Current scenario

The seeded demo has Anna Weber (Operational Risk Partner) in Stage 2 (Evidence Refresh) for the Payments Execution Q4 assessment covering process PAY.03.02 at Arcadia Bank AG. Three indicators have breached their thresholds, a control test of the key preventive control found four exceptions and two items where the tester could not conclude, and the challenge workshop is scheduled for the same morning at 10:30.

The Now item on the home page at the start of the day is the Stage 2 authority gate: whether to request three separate indicator explanations or one causal investigation.

---

## How the AI and the human divide the work

The AI prepares. The human decides.

Preparation means: gathering evidence from the registered connectors, computing residual positions from agreed effectiveness using the group methodology, identifying pattern breaks in indicator series, flagging outstanding evidence requests, drafting workshop materials, and producing the committee paper from confirmed positions.

Deciding means: confirming the scope, setting the investigation approach, determining what absence of loss implies about likelihood, sequencing the workshop, challenging a disputed rating and confirming a rationale, approving an assessment version, and signing off a monitoring plan.

Every authority gate in the process requires a confirmed rationale. The rationale field cannot be pre-filled by the AI and cannot be empty. A decision recorded without a confirmed rationale is refused by the authority gate and is not written to the audit trail.

---

## Object kinds the app works across

- assessment (the RCSA document being produced)
- risk (the risks in scope for the assessment)
- control (the controls mapped to those risks)
- kri (the key risk indicators monitored against each risk)
- evidence (KRI data, control test results, incident records, audit findings)
- decision (the authority-gated judgments at each stage)
- action (remediation actions from the workshop conclusions)
- process (the process hierarchy in scope)

---

## Version history

**1.0.0** -- Initial release, V3.2. Eight stages. Covers the RCSA lifecycle from evidence refresh to monitoring plan. The seeded demo scenario is Payments Execution Q4 at ARC-DE.
