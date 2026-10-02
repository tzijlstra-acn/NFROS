# Workday V3.2 RCSA Process Design

**Agent**: D (RCSA Process Design)
**Release**: V3.2
**Date**: 2026-10-06
**Status**: Design complete, pending Agent F (UI implementation)

---

## Summary

This document defines the eight-stage RCSA Cycle process, maps it to the existing seed data, specifies what the AI prepares at each stage, and describes what completing a stage does to real database rows. The implementation agent (Agent F) builds the process page UI against this contract.

No em dashes appear in this document. German text uses ae, oe, ue, ss.

---

## 1. Data objects in scope

The seed scenario for RCSA is the Payments Execution Q4 assessment. All object identifiers below resolve to seeded rows.

| Kind | Identifier | Description |
|------|------------|-------------|
| assessment | RCSA-ARC-DE-PAYOPS-2026-Q4 | Payments Execution Q4 assessment, ARC-DE |
| process | PRC-0041 | Payment repair and manual override (PAY.03.02) |
| process | PRC-0040 | Corporate payment execution (PAY.03) -- parent |
| risk | RSK-0211 | Erroneous or unauthorised payment release |
| risk | RSK-0212 | Delay to same-day corporate payment submission |
| risk | RSK-0213 | Missing regulatory reporting data on cross-border payments |
| risk | RSK-0214 | Duplicate release of a corporate payment instruction |
| risk | RSK-0215 | Inaccurate corporate mandate and beneficiary static data |
| control | CTL-PAY-014 | Four-eyes independent review (the key control) |
| control | CTL-PAY-021 | Duty manager daily sample |
| control | CTL-PAY-029 | Daily value reconciliation |
| kri | KRI-PAY-007 | Override rate (breached red threshold) |
| kri | KRI-RES-005 | Tested fallback arrangements (breached) |
| control-test | TST-2026-0318 | Four-eyes control design and operating effectiveness test |
| decision | DEC-2026-0771 | RCSA-D1: escalation about KRI investigation approach |
| decision | DEC-2026-0744 | RCSA-D2: residual-risk about zero-loss inference |
| decision | DEC-2026-0745 | RCSA-D3: agenda for challenge workshop |
| decision | DEC-2026-0772 | RCSA-D4: control-effectiveness for CTL-PAY-014 |
| decision | DEC-2026-0782 | RCSA-D5: residual-risk revision post shared event |

Role holder: P-003 (Anna Weber, Operational Risk Partner)

---

## 2. The eight stages mapped to existing data

### Stage 1: Scope and trigger (scope-trigger)

**Purpose**: Confirm the RCSA scope before any evidence is gathered.

**Relevant objects**:
- assessment RCSA-ARC-DE-PAYOPS-2026-Q4 (the assessment being produced)
- process PRC-0041 and its parent PRC-0040 (the processes in scope)
- entities ARC-DE, ARC-AT, ARC-CH

**Existing decision mapping**: No dedicated decision in the seed. The scope for Payments Execution Q4 is pre-agreed. RCSA-D3 (agenda/workshop sequencing) touches scope indirectly in its uncertainty note about PRC-0041 volume changes.

**What the AI prepares**:
- Process hierarchy from PRC-0040 down: PRC-0041, PRC-0042, PRC-0043, PRC-0044, PRC-0045.
- Entity scope: three legal entities (ARC-DE, ARC-AT, ARC-CH) because PRC-0041 runs across all three.
- Cycle quarter: Q4 2026, assessment reference RCSA-ARC-DE-PAYOPS-2026-Q4.
- Prior assessment version for comparison (the Q3 2026 version if seeded, or the prior lines).

**What the human decides**: Confirm the scope and trigger reason. A scope that is narrower than PRC-0041 misses the manual override population. A scope that adds PRC-0042 (intake and validation) adds 1.9 million items and a different risk profile.

**Completing the stage**: The assessment row has entity IDs, process IDs and a confirmed trigger code. No new rows; the confirmation is the audit event.

**Now item link**: The Now item at this stage reads "Confirm RCSA scope for Payments Execution Q4". It links to the process page at stage 1. Not active in the seeded demo (scope is pre-confirmed).

---

### Stage 2: Evidence refresh (evidence-refresh)

**Purpose**: Retrieve and classify all evidence from the assessment period. Surface gaps.

**Relevant objects**:
- kri KRI-PAY-007 (override rate, breached red)
- kri KRI-RES-005 (tested fallback, breached)
- control-test TST-2026-0318 (four-eyes test result)
- evidence documents EVD-2026-41821 (override rate data), EVD-2026-41810, EVD-2026-41820, EVD-2026-41822, EVD-2026-41850, EVD-2026-41852
- decision DEC-2026-0771 (RCSA-D1): escalation -- three separate KRI explanations or one causal investigation?

**Existing decision mapping**: RCSA-D1 (DEC-2026-0771) is the authority-gate decision for this stage. judgmentKind is "escalation". It is presented at 07:45 and requires a rationale from Anna Weber (P-003) before the investigation can be shaped.

**What the AI prepares**:
- KRI status summary: KRI-PAY-007 is red (override rate 731 in September against a threshold). KRI-RES-005 is red (fallback tested arrangements below the threshold).
- Control test result digest: TST-2026-0318 found four exceptions (EXC-TST-2026-0318-01 to -04) and two items where the tester could not conclude (UTC-TST-2026-0318-01, UTC-TST-2026-0318-02).
- Pattern analysis: override rate grew 77.4 percent while the repair queue grew 20.6 percent. Route substitution overrides (OVR-C) rose from 31 to 198. Cut-off overrides (OVR-D) rose from 94 to 211. Reviewer headcount is 3.0 of 4.0 approved.
- Missing evidence: the RepairDesk tenant configuration export requested under Appendix A4 clause 2.1, which is overdue.

**What the human decides**: Whether to request three separate first-line explanations (one per KRI, as the escalation rule requires) or one causal investigation that names the mechanism. The choice determines whether the committee sees one problem or three. This is a departure from standard procedure and must be recorded.

**Completing the stage**: An audit event records the investigation approach. If one causal investigation is chosen, a background action is created requesting it. The evidence corpus is complete or the outstanding items are formally noted.

**Now item link**: At 07:45 the Now item on the home page is DEC-2026-0771 (RCSA-D1). Title: "Three indicator explanations or one causal investigation". The Now card shows the prepared position (one causal investigation) and the uncertainty note. The action button opens the decision page at the process page stage 2 context.

**Active in seed**: YES. This is the currentStageId of the seeded run (run-rcsa-payops-q4-2026). The demo opens here.

---

### Stage 3: Risk and control change (risk-control-change)

**Purpose**: Compare each risk and control against the prior assessment version. Record changes with source references.

**Relevant objects**:
- risks RSK-0211 through RSK-0215
- controls CTL-PAY-014, CTL-PAY-021, CTL-PAY-029
- assessment lines (RCSA-ARC-DE-PAYOPS-2026-Q4-L01 and sibling lines)
- decision DEC-2026-0744 (RCSA-D2): residual-risk -- what zero recorded losses tells about likelihood for RSK-0211

**Existing decision mapping**: RCSA-D2 (DEC-2026-0744) is the authority-gate decision for this stage. judgmentKind is "residual-risk". It is presented at 07:45 and addresses the inferential step: absence of loss in the register versus absence of detection capability.

**What the AI prepares**:
- Prior vs current comparison for each risk: inherent position, control effectiveness, appetite position, residual score.
- RSK-0211 change narrative: appetite position was recorded as "outside" in the second-line pre-read. First-line holds "within" (residual 9). Second-line holds "outside" (residual 12). The gap is driven by CTL-PAY-014 effectiveness.
- Loss register read: zero recorded losses in 24 months. The AI surfaces the detection logic -- value reconciliation reconciles value not authorisation, duty manager sample is next-day and one-in-ten.
- Control test result for CTL-PAY-014: TST-2026-0318 concluded "Partially Effective" on a design deficiency (role segregation not enforced in RepairDesk) and an operating deficiency (four deviations in sample of 60, two items where conclusion was impossible).

**What the human decides**: Whether zero recorded losses is evidence about likelihood or evidence about detection quality. If detection cannot catch the outcome, absence of loss is not absence of risk. The rationale must be the professional's own.

**Completing the stage**: The assessment lines carry updated change-from-previous notes. Every control that moved carries a source reference. The prior version lines remain untouched.

**Now item link**: At 07:45 RCSA-D2 competes with RCSA-D1 for Now. RCSA-D1 has priorityRank 1 so it is Now; RCSA-D2 is the first item in Next.

---

### Stage 4: First-line input (first-line-input)

**Purpose**: Collect first-line effectiveness positions. Surface gaps. Set the workshop agenda.

**Relevant objects**:
- controls CTL-PAY-014 (first-line holds Effective; second-line holds Partially Effective)
- assessment RCSA-ARC-DE-PAYOPS-2026-Q4
- decision DEC-2026-0745 (RCSA-D3): agenda -- workshop sequencing (contested risk first, third, or last)

**Existing decision mapping**: RCSA-D3 (DEC-2026-0745) is the authority-gate decision for this stage. judgmentKind is "agenda". Presented at 07:45. The decision is about facilitation order, not content.

**What the AI prepares**:
- First-line vs second-line effectiveness comparison for CTL-PAY-014: first-line "Effective", second-line "Partially Effective". Bands apart: 2.
- The uncertainty note on the ordering: if the third-party service risk (RSK-0184, referenced in one decision thread) takes 15 minutes instead of four, the contested rating arrives with 35 minutes not 50.
- Workshop agenda draft: 11 risks at 4 minutes each leaves RSK-0211 at position 3 with approximately 50 minutes.

**What the human decides**: The workshop sequence. The prepared position places the contested risk third. Opening with it wastes goodwill before shared ground exists. Last places it with fatigue. The sequence is recorded with the workshop record.

**Completing the stage**: A calendar event row for the 10:30 workshop carries the confirmed agenda. The decision is recorded with rationale.

**Now item link**: RCSA-D3 appears in Next (not Now) at 07:45 because RCSA-D1 is the most demanding item.

---

### Stage 5: Challenge workshop (challenge-workshop)

**Purpose**: Run the second-line challenge. Agree or record a dissent on every contested rating.

**Relevant objects**:
- control CTL-PAY-014 (the core dispute)
- risk RSK-0211 (the risk the control maps to)
- assessment RCSA-ARC-DE-PAYOPS-2026-Q4
- decision DEC-2026-0772 (RCSA-D4): control-effectiveness -- what does Anna record at the end of the workshop?

**Existing decision mapping**: RCSA-D4 (DEC-2026-0772) is the authority-gate decision for this stage. judgmentKind is "control-effectiveness". Presented at 11:45 (the workshop closes at approximately this moment). This is the most material decision of the day.

**What the AI prepares**:
- Side-by-side view of the two positions for CTL-PAY-014: Effective (first-line) vs Partially Effective (second-line). Evidence behind each.
- The three first-line assertions: (a) zero losses in 24 months, (b) client confirmations for all four test exceptions, (c) the configuration behaved as designed. The AI flags that only (c) is unresolved.
- The outstanding supplier evidence: the RepairDesk tenant configuration is overdue under Appendix A4 clause 2.1. Deciding now means deciding without it.
- Uncertainty note: deciding now versus deferring. If deferred, the assessment cannot be signed by 16.10.2026.

**What the human decides**: Record "Partially Effective" for CTL-PAY-014 and accept a residual of 12 for RSK-0211 (outside appetite), or record "Effective" and accept a residual of 9 (within appetite). A recorded dissent is available under the RCSA procedure. The rationale must be confirmed as the professional's own.

**Completing the stage**: The consequence chain for RCSA-D4:
- set-control-effectiveness: CTL-PAY-014 moves to "partially-effective".
- version-assessment: RCSA-ARC-DE-PAYOPS-2026-Q4 is versioned with the new control rating.
- set-residual-risk: RCSA-ARC-DE-PAYOPS-2026-Q4-L01 gets residualLikelihood and residualImpact set (score 12 = 3x4).
- create-reassessment: an off-cycle reassessment is initiated for PRC-0041.
- The audit event records the decision, the confirming party (P-003) and the moment (11:45).

**Now item link**: At 11:45 DEC-2026-0772 is the Now item. Title: "CTL-PAY-014 control environment rating and the RSK-0211 residual position". The Now card shows the prepared position (Partially Effective, residual 12) and the uncertainty note about the outstanding supplier evidence.

---

### Stage 6: Rating and appetite (rating-appetite)

**Purpose**: Compute all residual positions from agreed control effectiveness using the group methodology. Classify each against appetite.

**Relevant objects**:
- assessment lines RCSA-ARC-DE-PAYOPS-2026-Q4-L01 (RSK-0211, now residual 12, outside appetite)
- risks RSK-0211 (appetitePosition: "outside"), RSK-0212 (appetitePosition: "outside")
- action items from the consequence chain of RCSA-D4

**Existing decision mapping**: No dedicated decision in the seed for this stage alone. The rating is the direct output of RCSA-D4 (Stage 5). The consequence "set-residual-risk" executes immediately when D4 is recorded. The appetite classification follows from the methodology in the domain calculator.

**What the AI prepares**:
- Residual score matrix: all five risks with inherent scores, agreed control effectiveness, and computed residual.
- Appetite exceedance summary: RSK-0211 at 12 of 25 is outside appetite. RSK-0212 at computed score is outside appetite. The group policy requires either a committed remediation plan with dates or a Risikoakzeptanz signed by the entity COO.
- Draft committee paper section: the outside-appetite risks with their agreed positions.

**What the human decides**: Which path applies to RSK-0211 -- remediation plan with dates or Risikoakzeptanz. The remediation plan path requires the reviewer vacancy to be filled by a committed date. The Risikoakzeptanz path requires the entity COO signature.

**Completing the stage**: Assessment lines have residual scores and appetite positions set. Outside-appetite risks have an action (remediation plan) or a documented Risikoakzeptanz record attached.

---

### Stage 7: Actions and approval (actions-approval)

**Purpose**: Record remediation actions. Version the assessment. Approve and submit.

**Relevant objects**:
- action items (remediation actions from the consequence chain)
- assessment RCSA-ARC-DE-PAYOPS-2026-Q4 (to be versioned)
- decision DEC-2026-0782 (RCSA-D5): residual-risk -- whether to revise the recorded reasoning when the mechanism is now known to differ from the prior argument

**Existing decision mapping**: RCSA-D5 (DEC-2026-0782) is the authority-gate decision for this stage. judgmentKind is "residual-risk". Presented at 15:00 after the shared event at 14:05. The decision is about intellectual integrity: the score of 12 stands, but the reason given in the morning (capacity and discipline) was wrong. The mechanism is a configured waiver that switches the control off when the fallback route is active.

**What the AI prepares**:
- The prior recorded reasoning (reviewer capacity at 3.0 of 4.0, human deviations in test sample).
- The now-confirmed mechanism: the RepairDesk configuration export shows the control requirement is waived by rule for route substitution overrides below EUR 250,000 while the fallback route is active. Twenty-two fallback activations in September; the waiver applied every time.
- The consequences of revision: the score does not change; the attribution does. The committee paper can now cite the mechanism, not a capacity argument.
- The one confirmed error in the post-event validation sample of 20 drawn from 96.

**What the human decides**: Revise the recorded reasoning or leave it. The prepared position: revise it. A correct number defended with a wrong argument loses credibility at the worst moment (under challenge in front of the chair). The prior reasoning is retained; a revision supersedes it.

**Completing the stage**: The consequence chain for RCSA-D5:
- version-assessment: the assessment is versioned with the revised rationale.
- add-committee-item: the revised position with the mechanism is added to the committee agenda.
- send-collaboration-message: the process owner and control owner are notified of the mechanism finding.

**Now item link**: At 15:00 DEC-2026-0782 is the Now item. Title: "Whether to revise the reasoning behind a position that was right". The Now card shows the prepared position (revise, score unchanged) and the post-event context.

---

### Stage 8: Monitoring and reassessment (monitoring-reassessment)

**Purpose**: Confirm the post-cycle monitoring plan. Set the next cycle trigger. Close the assessment.

**Relevant objects**:
- kri KRI-PAY-007 (override rate -- enhanced monitoring until remediation closes)
- kri KRI-RES-005 (tested fallback -- enhanced monitoring)
- action items (open remediation actions drive the monitoring period)
- assessment RCSA-ARC-DE-PAYOPS-2026-Q4 (to be closed)

**Existing decision mapping**: No dedicated decision in the seed for Stage 8. The monitoring period and frequency are derived from the action due dates, which are consequences of earlier decisions. The professional confirms rather than decides.

**What the AI prepares**:
- Open action summary: two remediation actions from the consequence chain of RCSA-D4, with due dates and owners.
- Proposed monitoring frequency for KRI-PAY-007: weekly until the reviewer vacancy is filled and the remediation actions close.
- Next cycle trigger: Q1 2027, or earlier if either indicator breaches red again.
- Off-cycle reassessment schedule for PRC-0041: triggered by the create-reassessment consequence of RCSA-D4.

**What the human decides**: Confirm the monitoring plan. The escalation threshold for KRI-PAY-007 -- at what reading does the indicator trigger an unscheduled reassessment rather than a review?

**Completing the stage**: Monitoring activations are created for KRI-PAY-007 and KRI-RES-005 (kind: enhanced, subject: the KRI ID, frequency: weekly). The assessment status moves to "closed". The next cycle date is written to the assessment row.

---

## 3. RCSA Cycle Assistant definition

```
id:               rcsa-cycle-assistant
roleId:           rcsa
functionPackId:   nfr-operational-risk
name:             RCSA Cycle Assistant
nameDe:           RCSA-Zyklus-Assistent
status:           installed
maturity:         production-shaped
version:          1.0.0
entryRoute:       /workday/rcsa/process/rcsa-cycle
processId:        rcsa-cycle
coveredStageIds:  all eight
requiredConnectors: risk-register, control-register, kri-platform
humanDecisionKinds: escalation, residual-risk, control-effectiveness,
                    agenda, assurance-conclusion, risk-acceptance
```

---

## 4. Now item link from the home page

The RCSA role home page shows a Now item when the run status is "in-progress" or "waiting-for-input".

At 07:45 the Now item is DEC-2026-0771 (RCSA-D1, "Three indicator explanations or one causal investigation"). The decision is at stage 2 (evidence-refresh). The link from the Now card goes to the process page at `/workday/rcsa/process/rcsa-cycle?stage=evidence-refresh&decision=DEC-2026-0771`.

The process page renders:
1. The eight-stage progress bar with stage 2 active.
2. The evidence corpus assembled for stage 2: KRI readings, control test digest, override rate analysis.
3. The prepared position from the AI (one causal investigation).
4. The decision card for RCSA-D1 with the two options and the rationale field.

The Now card on the home page shows the first sentence of whyThisMatters for DEC-2026-0771 plus the two changed objects (KRI-PAY-007 breach, TST-2026-0318 result).

If the user has already decided RCSA-D1 and the stage has moved, the Now item advances to the next open decision in the queue.

---

## 5. Loading sequence for the process page

The process page is a server component. It renders in one pass without client-side waterfall.

**Step 1** -- Load the run row: `run-rcsa-payops-q4-2026`. Read `currentStageId`, `status`, `subjectId`.

**Step 2** -- Load the assessment: `RCSA-ARC-DE-PAYOPS-2026-Q4`. Read current lines, prior version lines.

**Step 3** -- Load the process definition: `rcsa-cycle`. Resolve `currentStageId` to the matching stage.

**Step 4** -- Load decisions for the current stage: filter decisions by `roleId = rcsa` and `status = open`, match `judgmentKind` to the stage's `decisionKinds`.

**Step 5** -- Load evidence for the current stage: from the open decisions, collect `supportingEvidenceIds` and `opposingEvidenceIds`. Add the evidence IDs from the timeline role moment at the current scenario clock.

**Step 6** -- Load the risk and control graph: call `getRiskControlGraph({ processId: "PRC-0041" })`. This returns processes, risks, controls, KRIs and edges.

**Step 7** -- Load background actions for the stage: filter by `roleId = rcsa` and `performedAtMoment` within the current window.

**Step 8** -- Render. The stage component receives: stage definition, open decisions, evidence corpus, graph data, background actions.

**Error posture**: If the run row is not found, render the "no active run" state. Do not throw; the process page must degrade gracefully when the seed has not run.

---

## 6. Active stage in the seed

The seeded run (`run-rcsa-payops-q4-2026`) has `currentStageId: "evidence-refresh"`. This is stage 2.

The reason evidence-refresh is the opening state rather than scope-trigger:
- The scope for Payments Execution Q4 is pre-agreed; the seed writes it directly to the assessment.
- Stage 1 (scope-trigger) would show a blank decision card with nothing to decide, which is not a useful demo opening.
- Stage 2 (evidence-refresh) has three red indicators, a completed control test and a live open decision at 07:45. That is the most informative opening for a demonstration.

The stage moves to "risk-control-change" when RCSA-D1 is recorded. It moves to "first-line-input" when RCSA-D2 is recorded. It moves to "challenge-workshop" when RCSA-D3 is recorded. It moves to "rating-appetite" when RCSA-D4 is recorded. The stage transitions are driven by decision recording, not by clock time.

---

## 7. Consequence kinds used in RCSA decisions

All consequence kinds below are implemented in `src/scenario/engine/decide.ts`:

| Stage | Decision | Consequence kind | What it does |
|-------|----------|-----------------|--------------|
| challenge-workshop | RCSA-D4 | set-control-effectiveness | CTL-PAY-014 to partially-effective |
| challenge-workshop | RCSA-D4 | version-assessment | creates new version of RCSA-ARC-DE-PAYOPS-2026-Q4 |
| challenge-workshop | RCSA-D4 | set-residual-risk | sets residual on RCSA-ARC-DE-PAYOPS-2026-Q4-L01 |
| challenge-workshop | RCSA-D4 | create-reassessment | off-cycle reassessment for PRC-0041 |
| challenge-workshop | RCSA-D4 | create-action | remediation action for CTL-PAY-014 reviewer vacancy |
| challenge-workshop | RCSA-D4 | add-committee-item | escalates to NFR Committee |
| actions-approval | RCSA-D5 | version-assessment | revised assessment with corrected rationale |
| actions-approval | RCSA-D5 | add-committee-item | committee paper with mechanism finding |
| actions-approval | RCSA-D5 | send-collaboration-message | notifies process owner and control owner |

---

## 8. Open items for Agent F (UI)

The following are design decisions that Agent F must implement but that this document does not resolve:

1. **Stage progress indicator style**: whether the eight stages render as a horizontal stepper, a vertical sidebar, or a compact numbered list. The process page component must accept the stage definitions array and the currentStageId.

2. **Evidence corpus panel**: the process page needs a panel that shows the evidence IDs loaded for the current stage. This reuses the existing intelligence rail component if the rail accepts a stage-scoped evidence set.

3. **Decision card placement**: within a stage, decision cards appear in priorityRank order. RCSA-D4 at stage 5 is the only decision for that stage; it renders full-width.

4. **Stage gate behaviour**: the Next Stage button is disabled until the open decision for the current stage is recorded. Agent F must wire the decision status to the gate.

5. **Now item route**: the route `/workday/rcsa/process/rcsa-cycle` does not yet exist. Agent F creates it.
