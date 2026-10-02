# Role workflows: the role native home page for V3.1

Agent B, role workflow design. One document, one owned path.

## What this document is

The V3.1 role home keeps one fixed mental model for all six professions: `Now`
(one thing that needs your judgment), `Next` (up to three), `Done` (collapsed).
This document says what goes inside that model for each role: the objects, the
column names, the vocabulary, and what counts as a decision.

Everything below is grounded in rows that exist in `data/nfr-workos.db` under
`run-001` and in the code that assembles the queue. Where a figure is quoted, it
is quoted with the identifier it came from, so a reader can open the record. The
institution, the suppliers, the regulators and the publications are synthetic
and are not presented as real.

### Where the current behaviour comes from

- `src/db/repositories/focus.ts` builds the queue. `buildFocusCandidates` calls
  six derivations: `decisionCandidates`, `suggestionCandidates`,
  `eventCandidates`, `backgroundCandidates`, `sharedEventCandidates` and
  `watchingCandidates`. `assembleFocusQueue` then deduplicates, orders and
  splits into `now`, `next` and `watching`.
- `src/workday/contracts.ts` owns `FocusItemView`, `FocusSection` and
  `dedupeFocusItems`. The four sections are `needs-you`, `prepared`, `handled`
  and `watching`. The V3.1 home maps `needs-you` plus `prepared` onto `Now` and
  `Next`, and `handled` onto `Done`.
- `src/components/workday-v3/RoleHome.tsx` renders it.
  `app/workday/[role]/v3.tsx` supplies it.
- The authority classes live in `src/db/schema/decisions.ts` as
  `AUTHORITY_CLASSES`: `READ`, `DRAFT`, `PROPOSE`, `APPROVAL_REQUIRED`,
  `POLICY_BOUND_AUTONOMOUS`, `PROHIBITED`.

### The scenario frame

`scenario_runs.id = run-001`, `scenario_date = 2026-10-06`,
`current_moment = 11:45`, ten timeline moments from `07:45` to `16:30`, with the
shared event at `14:05` (`timeline_events.is_shared_event = 1`,
`incidents.reference = INC-2026-0412`).

Three legal entities, from `legal_entities`:

| id | name | jurisdiction | regulatory_bloc | currency |
| --- | --- | --- | --- | --- |
| `ARC-DE` | Arcadia Bank AG | Germany | `eu` | EUR |
| `ARC-AT` | Arcadia Bank Oesterreich AG | Austria | `eu` | EUR |
| `ARC-CH` | Arcadia Bank Schweiz AG | Switzerland | `ch` | CHF |

Jurisdiction rule applied throughout this document: DORA and EBA guidance are
referenced only for `ARC-DE` and `ARC-AT`. FINMA expectations are referenced
only for `ARC-CH`. The EU digital operational resilience regulation is never
stated to apply to the Swiss entity, which is also what
`legal_entities.supervisory_context` records for `ARC-CH`. Illustrative
regulatory context, not legal advice.

### A note on authority classes, before the six roles

`decisionCandidates` does not read `decisions.required_authority`, which is a
sentence of prose naming the policy section. It computes the class in two lines:

```
const requiresApproval = entry.options.some((option) => option.requiresApproval);
const authorityClass: AuthorityClass = requiresApproval ? "APPROVAL_REQUIRED" : "PROPOSE";
```

Against the seeded `decision_options`, that resolves to `APPROVAL_REQUIRED` for
34 of the 36 open decisions. The two exceptions are the two agenda decisions
whose every option carries `requires_approval = 0`: `TPRM-D2`
(`DEC-2026-0742`) and `RCSA-D3` (`DEC-2026-0745`). Both resolve to `PROPOSE`.

The other classes enter the queue from elsewhere:

- `suggestionCandidates` passes `ai_suggestions.authority_class` straight
  through. Seeded: `APPROVAL_REQUIRED` for `tprm`, `rcsa` and
  `incident-resilience`; `PROPOSE` for `control-assurance` and
  `regulatory-change`; `DRAFT` for `nfr-governance`.
- `backgroundCandidates` passes `background_actions.authority_class`:
  `PROPOSE` on `escalated-to-human`, `READ` on `contradiction-identified`,
  `DRAFT` on `item-requested`, `POLICY_BOUND_AUTONOMOUS` on `routine-update`,
  `READ` on the rest.
- `eventCandidates`, `sharedEventCandidates` and `watchingCandidates` set
  `authorityClass: null`.
- `PROHIBITED` appears nowhere in the queue, and there are no `tool_calls` or
  `background_actions` rows carrying it. It is a gate outcome, not a queue
  state, and the home page should not try to show it.

---

## 1. Operational Risk Partner, `rcsa`

`roles.id = rcsa`, `title = Operational Risk Partner`,
`title_de = Partner Operationelles Risiko`, holder `users.id = P-003`,
entity `ARC-DE`, specialist agent `rcsa-specialist`,
`hero_visual_label = Living process, risk and control graph`.

### 1.1 What this person actually does in a working day

She is second line. The first line writes its own risk and control self
assessment for a process, and her job is to disagree with it in a way that
survives a committee. She spends the day reading the first line's recorded
positions against what the records actually show: indicator movements, loss
history, control test results, remediation progress. Her output is not a report
but a set of recorded positions: which risks are relevant, what the likelihood
and impact are, whether a control is effective, what the residual rating is and
whether that rating sits inside appetite. On 06.10.2026 she is preparing the
challenge workshop for the Q4 payment operations assessment while three payment
indicators are Red with three different first line owners.

### 1.2 The role's native objects

| Object | Table and key columns | Seeded identifier format | Seeded examples |
| --- | --- | --- | --- |
| Process | `processes.id`, `processes.code`, `name`, `name_de`, `monthly_volume`, `manual_touch_rate` | `PRC-NNNN` with a hierarchical `code` | `PRC-0041` code `PAY.03.02` Payment repair and manual override, monthly volume 51435; `PRC-0042` code `PAY.03.01` |
| Risk | `risks.id`, `taxonomy_l1`, `taxonomy_l2`, `inherent_likelihood`, `inherent_impact`, `appetite_position` | `RSK-NNNN` | `RSK-0211` Erroneous or unauthorised payment release, 3 by 4 inherent, `appetite_position = outside`; `RSK-0371` reviewer capacity, `outside` |
| Control | `controls.id`, `reference`, `nature`, `automation`, `frequency`, `is_key_control`, `current_effectiveness`, `first_line_effectiveness` | `CTL-<AREA>-NNN` | `CTL-PAY-014` key control, `current_effectiveness = fully-effective`, last tested 2026-09-25; `CTL-PAY-006` `not-effective` against a first line `partially-effective` |
| Assessment version | `assessments.id`, `kind`, `subject_kind`, `subject_id`, `version`, `status`, `cycle`, `residual_risk`, `superseded_by` | `RCSA-<ENTITY>-<AREA>-YYYY-QN` | `RCSA-ARC-DE-PAYOPS-2026-Q4` v4 `draft`; `RCSA-ARC-DE-PAYOPS-2026-Q3` v3 `superseded` |
| Assessment line | `assessment_lines.assessment_id`, `risk_id`, `control_ids`, `residual_rating`, `appetite_position`, `change_from_previous` | one row per risk in a version | the `RSK-0211` line inside `RCSA-ARC-DE-PAYOPS-2026-Q4` |
| Key risk indicator | `kris.id`, `reference`, `unit`, `adverse_direction`, `amber_threshold`, `red_threshold`, `current_value`, `current_status` | `KRI-<AREA>-NNN` | `KRI-PAY-007` 3.84 overrides per 10,000 instructions against a red threshold of 3.5, `red`; `KRI-PAY-003` 2.7 against red 2.5; `KRI-PAY-011` 3.0 filled of 4.0 approved, `red` |
| Indicator history | `kri_readings.kri_id`, `period`, `value`, `status`, `commentary` | `YYYY-MM` periods | the monthly series behind `KRI-PAY-007` |
| Remediation action | `actions.id`, `reference`, `kind`, `status`, `due_on`, `progress_note` | `MSN-YYYY-NNNN` with a business `reference` | `MSN-2026-0166` ref `PR-SR-02`, `overdue`, due 2026-09-30; `MSN-2026-0181` ref `CTL-PAY-014-MONITORING` |
| Issue | `issues.id`, `reference`, `kind`, `severity`, `status` | `ISS-YYYY-NNNN` | `ISS-2026-0311` ref `TST-2026-0318-CTL-GAP`; `ISS-2026-0305` ref `KRI-PAY-011-ESTABLISHMENT` |

### 1.3 The queue columns this role would recognise

| Slot | English | German, ASCII only |
| --- | --- | --- |
| `Now` | Your challenge position | Ihre kritische Wuerdigung |
| `Next` | Assessment lines open | Offene Bewertungszeilen |
| `Done` | Recorded in the cycle | Im Zyklus erfasst |
| Watching strip | Indicators and appetite | Indikatoren und Risikoappetit |

Why these and not "tasks": a second line partner does not have tasks, she has
positions. "Kritische Wuerdigung" is the recorded second line appraisal, which
is the thing the workshop argues about and the thing the committee minutes.
"Bewertungszeilen" are literally the rows of `assessment_lines` that still have
no agreed residual rating. "Im Zyklus erfasst" ties `Done` to the cycle label on
`assessments.cycle`, which is how she measures her own progress.

### 1.4 What a decision means for this role

A decision is a recorded position that changes a rating or an appetite
statement, and that creates a new `assessments` version rather than overwriting
the old one. The seeded judgment kinds for `rcsa` are `residual-risk` (two),
`control-effectiveness` (one), `escalation` (one) and `agenda` (one).

Authority classes as `decisionCandidates` actually computes them:

| Reference | id | `judgment_kind` | Computed class | Why |
| --- | --- | --- | --- | --- |
| `RCSA-D1` | `DEC-2026-0771` | `escalation` | `APPROVAL_REQUIRED` | all three options carry `requires_approval = 1` |
| `RCSA-D2` | `DEC-2026-0744` | `residual-risk` | `APPROVAL_REQUIRED` | all options require approval |
| `RCSA-D3` | `DEC-2026-0745` | `agenda` | `PROPOSE` | all three options carry `requires_approval = 0` |
| `RCSA-D4` | `DEC-2026-0772` | `control-effectiveness` | `APPROVAL_REQUIRED` | all four options require approval |
| `RCSA-D5` | `DEC-2026-0782` | `residual-risk` | `APPROVAL_REQUIRED` | all options require approval |

The role's morning suggestion `SUG-SEED-rcsa-morning` carries a recorded
`authority_class = APPROVAL_REQUIRED`. Her prepared contradictions arrive as
`READ` (`contradiction-identified`) and her one escalation as `PROPOSE`. One
`routine-update` pair is `POLICY_BOUND_AUTONOMOUS`, which is the only autonomy
the role grants without a person in the loop and is correctly filed under
`Done`.

The honest reading: for this role nearly every real decision is
`APPROVAL_REQUIRED`, and the single `PROPOSE` is the one decision that changes
nothing in the record (the order of the workshop agenda). The home page should
show the class, because it tells a first week analyst whether finishing this
item ends with a record change or only with a proposal.

### 1.5 The first-week analyst test

Record: `decisions.id = DEC-2026-0771`, `reference = RCSA-D1`,
`related_object_kind = kri`, `related_object_id = KRI-PAY-007`,
presented at `07:45`, `priority_rank = 1`, `status = open`.

- Heading, one line:
  `KRI-PAY-007: three Red indicators on PRC-0041, or one causal chain`
- Reason, one line:
  `Two pressure indicators moved and three error indicators did not, so three explanations would each describe a symptom.`
- Primary button:
  `Record the escalation route`

German equivalents, ASCII only: heading
`KRI-PAY-007: drei rote Indikatoren auf PRC-0041, oder eine Ursachenkette`;
button `Eskalationsweg erfassen`.

The heading names the indicator and the process, which is what distinguishes
this item from `DEC-2026-0744` (loss history and likelihood on `RSK-0211`) and
from `DEC-2026-0745` (workshop sequencing). The current build renders
`Record the decision` as the button for all three.

### 1.6 What should NOT be on this role's home page

- The full risk and control graph for `PRC-0041`. It belongs in
  `/workday/rcsa/workbench`, which is where `getRiskControlGraph` is rendered.
- The 38 grouped `record-reconciled` background rows as individual lines. The
  grouped `Done` row is correct; the individual rows belong behind it and in
  `/control-room`.
- Indicators that are not hers. At `11:45` her Watching column contains
  `KRI-TPR-002` (Tier 1 subprocessor record completeness, a third-party risk
  indicator held at group level) and `KRI-GOV-004` (key control description
  review, a governance indicator). Those belong on `tprm` and `nfr-governance`
  respectively.
- Inbox triage. `inbox_messages` for `rcsa` holds 15 rows across five triage
  classes. Triage belongs in `/workday/rcsa/mail`, and only the items triaged
  to `decision` should ever reach the home page.
- Workshop preparation packs. `RCSA-WS-ARC-DE-PAYOPS-2026-Q4` at `10:30`
  belongs in `/workday/rcsa/meetings`.

---

## 2. Third-Party Risk Manager, `tprm`

`roles.id = tprm`, `title = Third-Party Risk Manager`,
`title_de = Manager Drittparteienrisiko`, holder `users.id = P-002`,
entity `ARC-DE`, specialist agent `tprm-specialist`,
`hero_visual_label = Supplier and fourth-party exposure constellation`.

### 2.1 What this person actually does in a working day

He owns the independent view of what the bank has handed to other firms. His day
is a reassessment cycle: one arrangement at a time, he decides whether the
recorded criticality is still right, whether the due diligence evidence on file
is sufficient, whether the contract actually secures the rights the policy
assumes, who is in the chain below the first supplier, and whether the bank
could leave. Much of the work is chasing evidence that has been requested and
has not arrived, and reconciling what a supplier says about itself against what
its own reports show. On 06.10.2026 the 2026 reassessment of the payment
services provider is due on 31.10.2026 and two of its findings turn on evidence
that is missing rather than negative.

### 2.2 The role's native objects

| Object | Table and key columns | Seeded identifier format | Seeded examples |
| --- | --- | --- | --- |
| Supplier, the arrangement | `suppliers.id`, `name`, `domicile`, `criticality`, `is_outsourcing`, `contracting_entity_ids`, `status`, `next_assessment_due`, `concentration_note` | `TP-NNNN` | `TP-0042` Novalink Payment Services GmbH, Frankfurt, `critical`, `is_outsourcing = 1`, `status = under-reassessment`, due 2026-10-31, serves all three entities; `TP-0023` Alpenrand Rechenzentrum AG, Zug, `ARC-CH` only; `TP-0071` `exit-planned` |
| Subprocessor, the fourth party | `subprocessors.id`, `supplier_id`, `domicile`, `data_location`, `declared_in`, `is_discrepancy`, `supports_critical_function` | `TP-NNNN.N`, and `TP-NNNN.N-FN` for a fifth party | `TP-0042.4` Meridian Operations Support Pvt Ltd, Pune, `declared_in = supplier-submission`, `is_discrepancy = 1`; `TP-0042.3-F1` Aurora Object Storage Ltd, Dublin, `declared_in = neither` |
| Service | `services.id`, `name`, `name_de`, `is_important_business_service`, `supplier_ids`, `entity_ids`, `operational_status` | `IBS-NNNN` for business services, `SVC-NNNN-NN` for supplier delivered services | `IBS-0004` Corporate Payments, `is_important_business_service = 1`; `SVC-0042-02` Payment Repair Workbench (RepairDesk); `SVC-0042-05` Swiss clearing connectivity adapter |
| Contract and appendix | `contracts.id`, `reference`, `document_type`, `audit_rights_secured`, `subprocessor_consent_model`, `notice_period_days` | `CTR-YYYY-NNNN` and `CTR-YYYY-NNNN-AN` | `CTR-2023-0117` framework, `audit_rights_secured = 1`; `CTR-2023-0117-A3` Appendix A3 Subprocessor list; `CTR-2023-0117-A4` Audit, access and supervisory rights |
| Contractual obligation | `contract_obligations.id`, `contract_id`, `clause_reference`, `category`, `evidence_status` | clause references inside a contract | the `subprocessor` and `audit` category rows under `CTR-2023-0117-A3` and `-A4` |
| Due diligence request | `actions.kind = evidence-request`, `reference`, `owner_label`, `due_on` | `MSN-YYYY-NNNN` with a `TPRM-Q-YYYY-RNN` reference | `MSN-2026-0188` ref `TPRM-Q-2026-R04` Swiss instance recovery evidence; `MSN-2026-0184` ref `TPRM-Q-2026-R19` penetration test scope |
| Reassessment finding | `issues.id`, `reference`, `kind`, `severity`, `due_on` | `ISS-YYYY-NNNN` with a `TPRM-Q-YYYY-RNN-<TOPIC>` reference | `ISS-2026-0276` ref `TPRM-Q-2026-R07-RTO`; `ISS-2026-0277` ref `TPRM-Q-2026-R11-EXIT`; `ISS-2026-0298` ref `CTR-2023-0117-A3-DIVERGENCE` |
| Evidence document | `evidence_documents.id`, `reference`, `source_type`, `status`, `requested_from_label`, `is_stale` | `EVD-YYYY-NNNNN` | `EVD-2026-41210` `missing`, Swiss recovery test evidence; `EVD-2026-41235` `missing`, subprocessor notice for `TP-0042.4`; `EVD-2026-41215` `requested` |
| The reassessment itself | `actions.kind = reassessment` plus `suppliers.next_assessment_due` | no `assessments` row exists | `MSN-2026-0195` ref `TPRM-Q-2026`, `in-progress`, due 2026-10-31 |

Jurisdiction note for this role: `TP-0042` carries
`contracting_entity_ids = ["ARC-DE","ARC-AT","ARC-CH"]`, so one arrangement sits
under two different frameworks at once. The EU digital operational resilience
expectations are referenced for the `ARC-DE` and `ARC-AT` contracting positions
and the FINMA outsourcing expectations for the `ARC-CH` position, and his
reassessment conclusion has to be recorded in a way that keeps the two apart.
Illustrative regulatory context, not legal advice.

One structural note that matters to the design: `assessments.kind` admits
`supplier`, but all eight seeded `assessments` rows are `kind = rcsa`. The
supplier reassessment is modelled as one `actions` row plus a set of `issues`
rows. A TPRM home page that looks for a supplier assessment object will find
nothing, so it has to render the cycle from `suppliers.next_assessment_due`, the
`TPRM-Q-2026-R*` findings and the open evidence requests.

### 2.3 The queue columns this role would recognise

| Slot | English | German, ASCII only |
| --- | --- | --- |
| `Now` | Assessment call | Bewertungsentscheid |
| `Next` | Due diligence open | Sorgfaltspruefung offen |
| `Done` | Closed on the file | In der Akte geschlossen |
| Watching strip | Evidence outstanding | Ausstehende Nachweise |

"Bewertungsentscheid" is the word for the conclusion he signs on an arrangement.
"Sorgfaltspruefung" is the standard German term for due diligence and covers
both the evidence requests and the contract review. "In der Akte geschlossen"
is the test he applies: an item is done when the supplier file can be handed to
an auditor without a verbal explanation.

### 2.4 What a decision means for this role

A decision changes the recorded position on an arrangement: its criticality, the
materiality of a gap, the conditions attached to an approval, or whether
enhanced monitoring is switched on. The seeded kinds for `tprm` are
`materiality` (three), `criticality` (one), `conditional-approval` (one) and
`agenda` (one).

| Reference | id | `judgment_kind` | Computed class | Why |
| --- | --- | --- | --- | --- |
| `TPRM-D1` | `DEC-2026-0741` | `materiality` | `APPROVAL_REQUIRED` | three of four options require approval |
| `TPRM-D2` | `DEC-2026-0742` | `agenda` | `PROPOSE` | all three options carry `requires_approval = 0` |
| `TPRM-D3` | `DEC-2026-0743` | `criticality` | `APPROVAL_REQUIRED` | all three options require approval |
| `TPRM-D4` | `DEC-2026-0759` | `materiality` | `APPROVAL_REQUIRED` | all options require approval |
| `TPRM-D5` | `DEC-2026-0779` | `materiality` | `APPROVAL_REQUIRED` | all options require approval |
| `TPRM-D6` | `DEC-2026-0785` | `conditional-approval` | `APPROVAL_REQUIRED` | all four options require approval |

His morning suggestion `SUG-SEED-tprm-morning` is recorded as
`APPROVAL_REQUIRED`. The two contradictions the partner prepared for him arrive
as `READ`: supplier `TP-0042` "Recovery objective asserted against recovery
observed" and service `SVC-0042-01` "Availability contracted against
availability calculated". The two `item-requested` background rows are `DRAFT`,
which is the right class: drafting an evidence request to a supplier changes no
record of the bank's own.

Note that `TPRM-D1` has four options, one of which (`Service level point: handle
it in the monthly service review`) carries `requires_approval = 0`. Because the
computation is `options.some(...)`, the item is still labelled
`APPROVAL_REQUIRED`. That is defensible but it is not the same statement as "the
option you are most likely to choose needs approval", and the home page should
not imply that it is.

### 2.5 The first-week analyst test

Record: `decisions.id = DEC-2026-0741`, `reference = TPRM-D1`,
`related_object_kind = supplier`, `related_object_id = TP-0042`, presented at
`07:45`, `priority_rank = 1`, `status = open`. The underlying finding is
`issues.id = ISS-2026-0276`, `reference = TPRM-Q-2026-R07-RTO`, due 2026-10-31.

- Heading, one line:
  `TP-0042 Novalink: recovery tested at 3 hours 40 minutes against 2 hours contracted`
- Reason, one line:
  `The supplier's own test report has been in the vault since 22.05.2026 and nobody escalated it.`
- Primary button:
  `Record the materiality determination`

German equivalents, ASCII only: heading
`TP-0042 Novalink: Wiederherstellung in 3 Stunden 40 Minuten gegen vertraglich 2 Stunden`;
button `Wesentlichkeitsentscheidung erfassen`.

The heading names the arrangement and the two figures that are in conflict,
which is what distinguishes it from `DEC-2026-0743` (whether September behaviour
changes criticality) and `DEC-2026-0759` (the Appendix A3 divergence). All three
currently render the same button.

### 2.6 What should NOT be on this role's home page

- The supplier dossier and the subprocessor divergence table. Those belong in
  `/workday/tprm/workbench`, where `getSupplierExposure` already assembles the
  chain.
- Contract clause text. `contracts` and `contract_obligations` bodies belong
  behind the evidence drawer, not in the queue.
- Services whose only relationship to him is that they share a supplier.
  `buildRoleScope` expands supplier to service and back
  (`src/db/repositories/workspace.ts`, the service and supplier expansion
  block), which is why `SVC-0042-01` reaches his prepared column. That is
  correct for `tprm` and is the reason the same expansion misfires for other
  roles.
- The 14:05 incident bridge. `INC-2026-0412` reaches his prepared column after
  `14:05` because his supplier is in its path, and that is right; the
  chronology, the recovery options and the severity are the resilience lead's
  objects and belong on that role's page.
- Supplier calls and the contract variation meeting.
  `TPRM-CHAL-TP-0042-2026-10` at `10:30` and `TPRM-LEGAL-A3-20261006` at
  `13:30` belong in `/workday/tprm/meetings`.

---

## 3. Control Assurance Specialist, `control-assurance`

`roles.id = control-assurance`, `title = Control Assurance Specialist`,
`title_de = Spezialist Kontrollsicherung`, holder `users.id = P-004`,
entity `ARC-AT`, specialist agent `control-assurance-specialist`,
`hero_visual_label = Interactive full-population control test field`.

### 3.1 What this person actually does in a working day

He tests controls and writes the conclusion that follows from the evidence he
obtained, and nothing beyond it. A test round has a period, a full population, a
sample drawn by a stated method, a procedure and an exception count. His day is
spent inside a population: looking at the cases that were drawn, deciding
whether a deviation is a real exception or an evidence problem, deciding whether
one exception is isolated or systemic, and deciding whether he can conclude at
all when the evidence has gone. He also has to survive the first line's
response, which on 06.10.2026 disputes his preliminary result on the key
payments control.

### 3.2 The role's native objects

| Object | Table and key columns | Seeded identifier format | Seeded examples |
| --- | --- | --- | --- |
| Control under test | `controls.id`, `reference`, `nature`, `automation`, `frequency`, `is_key_control`, `design_note` | `CTL-<AREA>-NNN` | `CTL-PAY-014` key, preventive, it-dependent-manual; `CTL-GOV-021` retention and retrievability of key control evidence, `not-effective` |
| Test round | `control_tests.id`, `reference`, `control_id`, `test_type`, `period_from`, `period_to`, `population_size`, `sample_size`, `sampling_method`, `sampling_rationale`, `status`, `exception_count` | `TST-YYYY-NNNN` | `TST-2026-0318` `combined`, 01.06.2026 to 31.08.2026, population 1204, sample 60, `status = disputed`, 4 exceptions; `TST-2026-0294` `preliminary`, 3 exceptions; `TST-2026-0340` `planned` |
| Population case | `test_cases.id`, `control_test_id`, `transaction_ref`, `occurred_at`, `amount_minor`, `currency`, `in_sample`, `outcome`, `anomaly_kind`, `secondary_review_evidenced` | `OVR-<ENTITY>-YYYYMMDD-NNNN`, with `UTC-TST-YYYY-NNNN-NN` for unable to conclude items | `OVR-DE-20260714-0112` `exception`, `anomaly_kind = independence-failure`, EUR 8 430 000; `OVR-DE-20260702-0108` `anomaly`, `unable-to-conclude-reviewer-identity`; `OVR-AT-20260819-0103` `exception`, `evidence-failure` |
| Exception classification | `test_cases.exception_classification`, `exception_scope`, `root_cause`, `classified_by_user_id` | `isolated` or `systemic` in `exception_scope` | all four exceptions on `TST-2026-0318` currently `NULL` on both fields |
| Assurance conclusion | `control_tests.preliminary_conclusion`, `assurance_conclusion`, `concluded_by_user_id`, `concluded_on` | prose, signed | `TST-2026-0302` concluded `Not Effective / Nicht wirksam`; `TST-2026-0318` `NULL`, unsigned |
| Management response | `control_tests.management_response`, `management_response_by` | prose | the disputing response on `TST-2026-0318` |
| Finding | `issues.id`, `reference`, `kind = control-gap`, `severity` | `ISS-YYYY-NNNN` | `ISS-2026-0311` ref `TST-2026-0318-CTL-GAP`; `ISS-2026-0312` ref `UTC-TST-2026-0318-01-AUDIT-TRAIL` |
| Remediation action he tracks | `actions.id`, `reference`, `status`, `due_on` | `MSN-YYYY-NNNN` with an audit finding reference | `MSN-2026-0147` ref `AUD-2025-09-F3`, `overdue`, original due 2026-07-31; `MSN-2026-0203` ref `EXC-TST-2026-0318-04` |
| Missing evidence | `evidence_documents.status in (requested, missing)` | `EVD-YYYY-NNNNN` | `EVD-2026-41225` `missing`, reviewer identity behind service account `svc_repairbatch`; `EVD-2026-41230` `requested`, restoration of a moved evidence object |

The full population is stored, not only the sample: `TST-2026-0318` has 99
`test_cases` rows, of which 60 carry `in_sample = 1`. Thirteen rows are
`outcome = anomaly` and eleven of those were never sampled. That distinction is
the whole of his professional judgment and the home page has to be able to
express it.

### 3.3 The queue columns this role would recognise

| Slot | English | German, ASCII only |
| --- | --- | --- |
| `Now` | Exception to classify | Zu klassifizierende Abweichung |
| `Next` | Test rounds in progress | Laufende Pruefungsrunden |
| `Done` | Concluded and signed | Abgeschlossen und gezeichnet |
| Watching strip | Evidence not obtained | Nicht erlangte Nachweise |

A tester does not have tasks, he has rounds and exceptions. "Abweichung" is the
German control testing term for a deviation; "Feststellung" is reserved for the
finding that follows it, which is a later object. "Abgeschlossen und gezeichnet"
is deliberate: a round is not done when the work stops, it is done when a named
person has signed the conclusion, which is exactly what
`control_tests.concluded_by_user_id` records.

### 3.4 What a decision means for this role

A decision is a classification or a conclusion that he personally owns and that
cannot be derived from the evidence alone: whether a deviation is an exception,
whether it is isolated or systemic, whether the evidence obtained is sufficient
to conclude, and what the conclusion is. The seeded kinds are `materiality`
(one), `escalation` (three), `assurance-conclusion` (two) and
`control-effectiveness` (one).

| Reference | id | `judgment_kind` | Computed class | Why |
| --- | --- | --- | --- | --- |
| `CA-D1` | `DEC-2026-0746` | `materiality` | `APPROVAL_REQUIRED` | all three options require approval |
| `CA-D2` | `DEC-2026-0747` | `escalation` | `APPROVAL_REQUIRED` | at least one option requires approval |
| `CA-D3` | `DEC-2026-0748` | `escalation` | `APPROVAL_REQUIRED` | at least one option requires approval |
| `CA-D4` | `DEC-2026-0760` | `assurance-conclusion` | `APPROVAL_REQUIRED` | two of three options require approval |
| `CA-D5` | `DEC-2026-0764` | `assurance-conclusion` | `APPROVAL_REQUIRED` | at least one option requires approval |
| `CA-D6` | `DEC-2026-0778` | `escalation` | `APPROVAL_REQUIRED` | at least one option requires approval |
| `CA-D7` | `DEC-2026-0783` | `control-effectiveness` | `APPROVAL_REQUIRED` | all three options require approval |

Every one of his seven decisions is `APPROVAL_REQUIRED`. His morning suggestion
`SUG-SEED-control-assurance-morning` is recorded as `PROPOSE`, which is correct:
the partner can propose a classification but cannot record one. Two
contradictions arrive as `READ` and one escalation as `PROPOSE`.

`decisions.required_authority` on `CA-D1` records the real constraint in prose:
"Control assurance classification of deviation scope, Group Internal Control
System Standard section 3.2. A systemic classification carries a reporting
obligation to the accountable executive." The queue does not read that field.
For this role in particular it should be surfaced, because the consequence of
the classification is a reporting obligation, not just a rating.

### 3.5 The first-week analyst test

Record: `decisions.id = DEC-2026-0746`, `reference = CA-D1`,
`related_object_kind = test-case`,
`related_object_id = OVR-DE-20260714-0112`, presented at `07:45`,
`priority_rank = 1`, `status = open`. The case sits in `TST-2026-0318`, occurred
14.07.2026, EUR 8 430 000, `anomaly_kind = independence-failure`,
`in_sample = 1`.

- Heading, one line:
  `OVR-DE-20260714-0112: the creator reviewed their own override, 17 days before MSN-2026-0147 fell due`
- Reason, one line:
  `RepairDesk let one analyst hold both role assignments, and the action raised in November 2025 to stop it is 67 days past its revised date.`
- Primary button:
  `Classify the exception`

German equivalents, ASCII only: heading
`OVR-DE-20260714-0112: Ersteller hat seine eigene Ueberschreibung geprueft, 17 Tage vor Faelligkeit von MSN-2026-0147`;
button `Abweichung klassifizieren`.

The heading names the case, the defect and the remediation action, which is what
makes it unmistakably this item rather than `DEC-2026-0747` (demand the tenant
configuration) or `DEC-2026-0748` (reporting an item whose evidence is gone).
All three currently render `Record the decision`.

### 3.6 What should NOT be on this role's home page

- The population field. The 99 `test_cases` rows of `TST-2026-0318`, their
  amounts and their anomaly distribution are the centre of
  `/workday/control-assurance/workbench`, not of the home page. The home page
  carries one sentence of population arithmetic and a way in.
- Sampling rationale and procedure text. `control_tests.sampling_rationale` and
  `test_procedure` belong beside the population, behind the evidence drawer.
- Supplier status. At `11:45` his Watching column contains supplier `TP-0042`
  with the reason "the arrangement is under reassessment". That reason is a
  `suppliers.status` value owned by `tprm`. What he actually needs to watch
  about that supplier is narrower: the two evidence objects
  (`EVD-2026-41225`, `EVD-2026-41230`) that his unable to conclude items depend
  on.
- The `KRI-PAY-003` and `KRI-PAY-011` indicator rows. Those are the operational
  risk partner's instruments. His equivalent is `KRI-PAY-022`, overrides
  released without a retrievable evidence reference, which is a control evidence
  indicator and is the only one of the four that belongs to him.
- The handover and scoping meetings. `CA-HANDOVER-TST-2026-0318` at `08:45` and
  `CA-SCOPE-POST-EVENT-20261006` at `16:30` belong in
  `/workday/control-assurance/meetings`.

---

## 4. Incident and Resilience Lead, `incident-resilience`

`roles.id = incident-resilience`, `title = Incident and Resilience Lead`,
`title_de = Leiter Vorfall und Resilienz`, holder `users.id = P-005`,
entity `ARC-CH`, specialist agent `incident-resilience-specialist`,
`hero_visual_label = Service dependency map with a live event pulse`.

### 4.1 What this person actually does in a working day

On a quiet day he is a planner: he maintains the dependency map for the
important business services, keeps the impact tolerances current, schedules
severe but plausible exercises and chases evidence that fallback arrangements
have actually been tested. On a day with an event he is the person who
classifies it, decides whether a tolerance has been breached, chooses between
recovery options that each weaken a different control, and recommends whether a
supervisory notification is required. On 06.10.2026 he is doing the quiet
version until `14:05`, when `INC-2026-0412` reaches three services across all
three entities and his own entity, `ARC-CH`, turns out to have the weakest
position. His notification question is two questions: the EU major incident
criteria for `ARC-DE` and `ARC-AT`, and the FINMA expectations on incidents of
substantial importance for `ARC-CH`. Illustrative regulatory context, not legal
advice.

### 4.2 The role's native objects

| Object | Table and key columns | Seeded identifier format | Seeded examples |
| --- | --- | --- | --- |
| Important business service | `services.id`, `is_important_business_service`, `entity_ids`, `supplier_ids`, `operational_status` | `IBS-NNNN` | `IBS-0004` Corporate Payments, `is_important_business_service = 1`, all three entities; `IBS-0001`, `IBS-0002`, `IBS-0003` |
| Dependency edge | `service_dependencies.from_kind`, `from_id`, `to_kind`, `to_id`, `dependency_strength`, `single_point_of_failure`, `affected_by_event` | derived edges | the edges from `IBS-0004` to `SVC-0042-01`, `SVC-0042-02` and `SVC-0042-05`, and on to `TP-0042` and its subprocessors |
| Impact tolerance | `impact_tolerances.id`, `service_id`, `entity_id` as a scope label, `metric`, `threshold_minutes`, `threshold_volume`, `unit`, `consumed_minutes`, `approved_by`, `approved_on` | `ITOL-NNNN-NN` | `ITOL-0004-01` scope `ARC-DE, ARC-AT`, 240 minutes; `ITOL-0004-03` scope `ARC-CH`, 120 minutes and completion before the 16:00 CET same day cut-off; `ITOL-0004-04` scope `group`, count of releases with an unsatisfied mandatory control gate |
| Incident | `incidents.id`, `reference`, `kind`, `severity`, `proposed_severity`, `status`, `regulatory_classification`, `notification_recommended`, `is_shared_event` | `INC-YYYY-NNNN` | `INC-2026-0412` `under-assessment`, `severity = NULL`, `proposed_severity = S1`, `is_shared_event = 1`; `INC-2026-0388` closed `S2` with two separate entity assessments |
| Chronology entry | `incident_events.id`, `incident_id`, `at_moment`, `channel`, `provenance`, `statement`, `conflicts_with_id`, `confidence`, `revealed_at_moment` | ordered rows per incident | `INC-2026-0412` has 18 entries: 8 `verified-fact`, 6 `stakeholder-statement`, 4 `telemetry` |
| Recovery option | `recovery_options.id`, `incident_id`, `estimated_minutes_to_restore`, `control_trade_off`, `availability`, `requires_approval_from`, `selected` | `REC-NNNN-NN` | `REC-0412-04` ARC-CH manual submission under `RB-PAY-011`, 45 minutes, `requires-approval`; `REC-0412-05` `not-available` |
| Runbook | referenced from `issues.related_object_kind = runbook` and from `actions` | `RB-<AREA>-NNN` | `RB-PAY-007`, whose control assertion is disputed in `ISS-2026-0285`; `RB-PAY-011`, the Swiss manual correspondent route |
| Resilience indicator | `kris.id` in the `RES` area | `KRI-RES-NNN` | `KRI-RES-005` important business services with tested fallback arrangements, `red` |
| Resilience gap | `issues.kind = resilience-gap` | `ISS-YYYY-NNNN` | `ISS-2026-0288` ref `KRI-RES-005-IBS-0004`; `ISS-2026-0285` ref `RB-PAY-007-S4-ASSERTION` |
| Exercise action | `actions.kind = exercise-action`, `is_unowned` | `MSN-YYYY-NNNN` | `MSN-2026-0196` rehearse the Swiss manual route, `is_unowned = 1`; `MSN-2026-0201` the 2026 severe but plausible exercise, `is_unowned = 1` |

`incidents.regulatory_classification` and `incidents.notification_recommended`
are per entity conclusions, not group ones, and the seeded closed incidents
record them that way. Illustrative regulatory context, not legal advice.

### 4.3 The queue columns this role would recognise

| Slot | English | German, ASCII only |
| --- | --- | --- |
| `Now` | Classification due | Faellige Einstufung |
| `Next` | Tolerance and recovery | Toleranz und Wiederherstellung |
| `Done` | Closed and logged | Geschlossen und protokolliert |
| Watching strip | Tolerance budget | Toleranzbudget |

"Einstufung" is the German word for the severity and regulatory classification
he owns, and it is the one judgment on his desk that has a clock attached.
"Toleranz und Wiederherstellung" pairs the two things he trades off against each
other. "Geschlossen und protokolliert" matches the two columns that actually
close an incident, `incidents.closed_at` and `incidents.lessons_learned`.

The Watching strip is the one place where this role's column genuinely differs
in kind from the others: it is not a list of subjects, it is a budget.
`ITOL-0004-03` is 120 minutes with `consumed_minutes` currently 0, and at
`15:00` the scenario puts euroSIC queueing since 13:47 against a 45 minute
manual route lead time. The honest Watching strip for this role shows minutes
remaining per tolerance, per entity scope.

### 4.4 What a decision means for this role

A decision sets a value that has regulatory and client consequences and that no
model may set: severity, regulatory classification, whether a tolerance was
breached, which recovery option to invoke, and whether to recommend a
notification. Illustrative regulatory context, not legal advice. The seeded
kinds are `materiality` (three), `severity` (one),
`assurance-conclusion` (one), `agenda` (one), `risk-acceptance` (one) and
`escalation` (two).

| Reference | id | `judgment_kind` | Computed class | Why |
| --- | --- | --- | --- | --- |
| `IR-D1` | `DEC-2026-0749` | `materiality` | `APPROVAL_REQUIRED` | two of three options require approval |
| `IR-D2` | `DEC-2026-0750` | `assurance-conclusion` | `APPROVAL_REQUIRED` | all three options require approval |
| `IR-D3` | `DEC-2026-0751` | `agenda` | `APPROVAL_REQUIRED` | two of three options require approval |
| `IR-D4` | `DEC-2026-0761` | `materiality` | `APPROVAL_REQUIRED` | at least one option requires approval |
| `IR-D5` | `DEC-2026-0765` | `severity` | `APPROVAL_REQUIRED` | all three options require approval |
| `IR-D6` | `DEC-2026-0776` | `risk-acceptance` | `APPROVAL_REQUIRED` | all three options require approval |
| `IR-D7` | `DEC-2026-0774` | `escalation` | `APPROVAL_REQUIRED` | at least one option requires approval |
| `IR-D8` | `DEC-2026-0775` | `escalation` | `APPROVAL_REQUIRED` | at least one option requires approval |
| `IR-D9` | `DEC-2026-0786` | `materiality` | `APPROVAL_REQUIRED` | at least one option requires approval |

All nine are `APPROVAL_REQUIRED`, and his morning suggestion
`SUG-SEED-incident-resilience-morning` is recorded as `APPROVAL_REQUIRED` too.
This is the role where that uniformity is least misleading: the role genuinely
has no autonomous decision authority on a live incident. Note that `IR-D3`, an
`agenda` kind, is `APPROVAL_REQUIRED` here while the `agenda` decisions for
`tprm` and `rcsa` are `PROPOSE`. The difference is in the options, not in the
kind, which is the right way round and is worth preserving.

Jurisdiction split, visible in the decision set itself: `IR-D7`
(`DEC-2026-0774`) is scoped to `ARC-DE` and `ARC-AT` and asks about the major
incident threshold and a notification recommendation under the EU framework.
`IR-D8` (`DEC-2026-0775`) is scoped to `ARC-CH` and asks separately whether a
FINMA report is required. They are two decisions, not one, and the home page
must never merge them. `incidents.regulatory_classification` on `INC-2026-0388`
already records the pattern: "Two entities, two frameworks, two conclusions."
Illustrative regulatory context, not legal advice.

### 4.5 The first-week analyst test

Record: `decisions.id = DEC-2026-0749`, `reference = IR-D1`,
`related_object_kind = service`, `related_object_id = SVC-0042-05`,
`entity_id = ARC-CH`, presented at `07:45`, `priority_rank = 1`,
`status = open`. Related tolerance `ITOL-0004-03`, related issue
`ISS-2026-0288`, related runbook `RB-PAY-011`.

- Heading, one line:
  `SVC-0042-05 ARC-CH: no tested fallback route and no recovery evidence for Swiss clearing`
- Reason, one line:
  `The EU entities have a fallback that has been used five times; ARC-CH has only manual submission with a 45 minute lead time against a 16:00 cut-off (scenario figure).`
- Primary button:
  `Record the resilience gap`

German equivalents, ASCII only: heading
`SVC-0042-05 ARC-CH: keine geuebte Ausweichroute und kein Wiederherstellungsnachweis`;
button `Resilienzluecke erfassen`.

The heading names the service and the entity, which is what separates it from
`DEC-2026-0750` (whether five uses of a fallback constitute a test) and
`DEC-2026-0751` (the two measure ambiguity in `ITOL-0004-03`). All three
currently render `Record the decision`.

### 4.6 What should NOT be on this role's home page

- The dependency map. `service_dependencies` with the live event pulse is the
  hero visualisation and belongs in `/workday/incident-resilience/workbench`.
- The incident chronology. Eighteen `incident_events` rows with three provenance
  classes and a conflict pair is a reading surface, not a queue. It belongs
  beside the incident.
- The recovery option comparison. Five `recovery_options` rows with control
  trade-offs belong on the incident page, reached from the `Now` card when the
  decision is `IR-D6`.
- Other roles' supplier workflow state. At `11:45` his Watching column leads
  with supplier `TP-0042` and the reason "the arrangement is under
  reassessment". What he needs is the tolerance budget and the two unowned
  exercise actions (`MSN-2026-0196`, `MSN-2026-0201`).
- The crisis bridge transcript. `RES-BRIDGE-INC-2026-0412` at `14:05` belongs in
  `/workday/incident-resilience/meetings`.

---

## 5. Regulatory Change Manager, `regulatory-change`

`roles.id = regulatory-change`, `title = Regulatory Change Manager`,
`title_de = Manager Regulatorische Aenderungen`, holder `users.id = P-006`,
entity `ARC-DE`, specialist agent `regulatory-change-specialist`,
`hero_visual_label = Source to obligation to control lineage`.

### 5.1 What this person actually does in a working day

She reads what supervisors publish and turns it into obligations the bank can
own. The unit of work is a paragraph: a publication is split into candidate
obligations, each obligation is assessed for applicability to each legal entity
separately, and each applicable obligation is mapped to a policy, a process and
a control so that someone can be asked to evidence it. Her hardest daily call is
that the same arrangement can raise different questions in two jurisdictions and
that satisfying one would not satisfy the other. On 06.10.2026 she has eighteen
extracted obligations across six publications with no applicability decision
recorded on any of them, and a consultation closing on 23.10.2026. Illustrative
regulatory context, not legal advice.

### 5.2 The role's native objects

| Object | Table and key columns | Seeded identifier format | Seeded examples |
| --- | --- | --- | --- |
| Publication | `regulatory_publications.id`, `reference`, `issuer`, `jurisdiction`, `instrument_type`, `published_on`, `effective_from`, `consultation_closes` | `REG-YYYY-NNNN-<LANE>` or `REG-YYYY-NNNN` | `REG-2026-0031-EU` ref `EFSCB/GL/2026/04`, `eu` guideline, effective 2027-01-01; `REG-2026-0088` ref `SFMOB-RS-2026/02`, `ch` circular; `REG-2026-0104-EU` consultation closing 2026-10-23 |
| Paragraph and candidate obligation | `obligations.id`, `publication_id`, `paragraph_reference`, `obligation_text`, `extracted_summary`, `extraction_confidence`, `theme` | `OBL-YYYY-NNNN-NNN` | `OBL-2026-0031-001` Section 2, paragraph 3, confidence 0.91; `OBL-2026-0088-002` Margin number 11; `OBL-2026-0117-001` Article 3(2) |
| Applicability decision | `obligations.candidate_entity_ids`, `applicability_decision`, `applicability_rationale`, `decided_by_user_id`, `decided_on` | recorded per entity | all eighteen rows have `applicability_decision = NULL`; candidates are `["ARC-DE","ARC-AT"]` in the EU lane and `["ARC-CH"]` in the Swiss lane |
| Lineage mapping | `obligations.policy_ids`, `process_ids`, `control_ids` | existing identifiers | `CTL-REG-004` and `CTL-REG-006` are the controls on her own process `PRC-0071` |
| Unowned gap | `obligations.is_unowned_gap`, `gap_note` | flag | `OBL-2026-0031-004`, `OBL-2026-0031-006`, `OBL-2026-0117-003`, `OBL-2026-0104-003`, `OBL-2026-0088-002` |
| Policy section | `policies.id`, `reference`, `section`, `section_title`, `scope`, `version`, `related_role_ids` | `POL-<AREA>-N.N` | `POL-REG-2.1` Applicability determination, v1.9; `POL-RES-7.2` Supervisory notification, shared with `incident-resilience` |
| Obligation gap issue | `issues.kind = obligation-gap` | `ISS-YYYY-NNNN` | `ISS-2026-0292` ref `REG-2026-0031-CHAIN`; `ISS-2026-0294` ref `REG-2026-0088-INVENTORY`, entity `ARC-CH` |
| Implementation action | `actions.kind in (remediation, validation-request, reassessment)` with an obligation target | `MSN-YYYY-NNNN` | `MSN-2026-0173` ref `REG-2026-0031-REMEDIATION`, due 2026-11-28; `MSN-2026-0175` ref `REG-2026-0088-INVENTORY`, due 2026-10-24 |
| The subject she assesses | `subprocessors.id`, `services.id`, `suppliers.id` as named by a decision | `TP-NNNN.N`, `SVC-NNNN-NN` | `TP-0042.4` Meridian Operations Support Pvt Ltd, Pune; `SVC-0042-03` payment file transformation |

Jurisdiction is a first class column here: `regulatory_publications.jurisdiction`
holds `eu`, `de`, `at` or `ch`, and the lanes never merge. Three seeded
publications are `eu`, one is `de`, two are `ch`. Illustrative regulatory
context, not legal advice.

### 5.3 The queue columns this role would recognise

| Slot | English | German, ASCII only |
| --- | --- | --- |
| `Now` | Applicability to decide | Zu entscheidende Anwendbarkeit |
| `Next` | Obligations in assessment | Pflichten in Pruefung |
| `Done` | Interpretation recorded | Auslegung erfasst |
| Watching strip | Unowned and undated | Ohne Eigentuemer und ohne Termin |

"Anwendbarkeit" is the exact word her policy uses (`POL-REG-2.1`
`section_title = Applicability determination`). "Pflichten in Pruefung" is the
obligation inventory in flight. "Auslegung erfasst" is right because her output
is an interpretation on the record, and `POL-REG-2.1` requires it to be written
into an interpretation register rather than merely agreed. The Watching strip
names the two failure modes she is paid to prevent: an obligation with nobody
named, and an obligation with no implementation date.

Every column in this role is split by lane. The honest rendering of her `Next`
column puts the entity scope on every row, because `OBL-2026-0088-002` applies
to `ARC-CH` and `OBL-2026-0031-004` applies to `ARC-DE` and `ARC-AT`, and those
two rows are not interchangeable. Illustrative regulatory context, not legal
advice.

### 5.4 What a decision means for this role

A decision is an applicability determination or an interpretation, recorded per
legal entity, with a rationale a supervisor could read. Illustrative regulatory
context, not legal advice. The seeded kinds are `applicability` (two),
`escalation` (one), `criticality` (one) and `materiality` (one).

| Reference | id | `judgment_kind` | Computed class | Why |
| --- | --- | --- | --- | --- |
| `REG-D1` | `DEC-2026-0752` | `applicability` | `APPROVAL_REQUIRED` | all three options require approval |
| `REG-D2` | `DEC-2026-0753` | `escalation` | `APPROVAL_REQUIRED` | two of three options require approval |
| `REG-D3` | `DEC-2026-0754` | `criticality` | `APPROVAL_REQUIRED` | two of three options require approval |
| `REG-D4` | `DEC-2026-0762` | `materiality` | `APPROVAL_REQUIRED` | all three options require approval |
| `REG-D5` | `DEC-2026-0787` | `applicability` | `APPROVAL_REQUIRED` | all three options require approval |

All five are `APPROVAL_REQUIRED`. Her morning suggestion
`SUG-SEED-regulatory-change-morning` is `PROPOSE`, which is exactly right: a
model may extract a paragraph and propose a reading, and may not record an
applicability decision. Her two `item-requested` background rows are `DRAFT` and
the single contradiction is `READ`.

`required_authority` on `REG-D1` records the real constraint: "Applicability
determination per legal entity, Group Regulatory Change Standard section 2.1.
Interpretation requires Group Legal input and is recorded in the interpretation
register." The second clause is the one the home page is currently hiding: her
decision is gated on an input from another function. Illustrative regulatory
context, not legal advice.

### 5.5 The first-week analyst test

Record: `decisions.id = DEC-2026-0752`, `reference = REG-D1`,
`related_object_kind = subprocessor`, `related_object_id = TP-0042.4`,
`entity_id = ARC-CH`, presented at `07:45`, `priority_rank = 1`,
`status = open`. Subject: `subprocessors.id = TP-0042.4`, Meridian Operations
Support Pvt Ltd, Pune, `declared_in = supplier-submission`,
`is_discrepancy = 1`, onboarded 01.05.2026. Related issue `ISS-2026-0294`.

- Heading, one line:
  `TP-0042.4 Meridian, Pune: applicable in the Swiss lane and the EU lane, and the answers differ`
- Reason, one line:
  `ARC-CH filed its outsourcing inventory on 24.07.2026 and this subprocessor was onboarded on 01.05.2026. Illustrative regulatory context, not legal advice.`
- Primary button:
  `Record applicability per entity`

German equivalents, ASCII only: heading
`TP-0042.4 Meridian, Pune: anwendbar im Schweizer und im EU-Pfad, mit unterschiedlichem Ergebnis`;
button `Anwendbarkeit je Rechtseinheit erfassen`.

The heading names the subprocessor and the two lanes, which is what separates it
from `DEC-2026-0753` (whether to comment on a consultation) and `DEC-2026-0754`
(whether `SVC-0042-03` should be reclassified). All three currently render
`Record the decision`. Illustrative regulatory context, not legal advice.

### 5.6 What should NOT be on this role's home page

- Publication full text. `regulatory_publications.full_text` is a reading
  surface and belongs in `/workday/regulatory-change/workbench` with the lineage
  view.
- The lineage graph from source to obligation to control. That is the role's hero
  visualisation and belongs in the workbench.
- Raw extraction confidence as a number on every row. `extraction_confidence`
  ranges from 0.63 to 0.93 across the eighteen obligations; the home page needs
  the low confidence rows flagged, not eighteen decimals.
- Supplier reassessment state. At `11:45` her Watching column contains supplier
  `TP-0042` with the reason "the arrangement is under reassessment", which is a
  `tprm` workflow state. What belongs there instead is the consultation clock on
  `REG-2026-0104-EU`, closing 23.10.2026, and the three unowned obligation gaps.
  Illustrative regulatory context, not legal advice.
- Consultation drafting. `REG-CONSULT-0104-20261006` at `16:30` belongs in
  `/workday/regulatory-change/meetings`.

---

## 6. NFR Portfolio Lead, `nfr-governance`

`roles.id = nfr-governance`, `title = NFR Portfolio Lead`,
`title_de = Leiterin NFR-Portfolio`, holder `users.id = P-001`,
entity `ARC-DE`, specialist agent `nfr-governance-specialist`,
`hero_visual_label = One event, six professional lenses, one decision thread`.

### 6.1 What this person actually does in a working day

She does not own any of the underlying records, and that is the point: her job
is to decide what the aggregate position is and what the committee will spend
its hour on. She reads across the five other functions, decides whether a set of
separate findings is actually one problem, decides whether a remediation delay
has stopped being a project issue and become a governance issue, and sets the
agenda for the committee that can compel action. Her work product is an agenda,
a paper and an escalation, and her scarcest resource is committee attention. On
06.10.2026 she has nine agenda slots on `CMT-NFR-2026-10`, four candidate items
that are not on it, four Red indicators owned by four different people and a
remediation action 67 days past its revised date.

### 6.2 The role's native objects

| Object | Table and key columns | Seeded identifier format | Seeded examples |
| --- | --- | --- | --- |
| Cross function theme | `portfolio_themes.id`, `title`, `title_de`, `contributing_role_ids`, `decision_ids`, `duplicate_report_count`, `materiality`, `confidence` | `THEME-<TOPIC>-NN` | `THEME-PAY-01` all six roles, 18 decisions, `duplicate_report_count = 6`, `materiality = NULL`; `THEME-CHAIN-02`; `THEME-TOLERANCE-03`; `THEME-ASSURANCE-04`; `THEME-CAPACITY-05` |
| Committee and agenda item | `committee_items.id`, `committee_ref`, `committee_name`, `meeting_date`, `item_type`, `raised_by_role_id`, `on_agenda`, `agenda_position`, `theme_id` | `AG-<COMMITTEE>-NN` on the agenda, `AG-CAND-YYYY-NN-NN` for candidates | `CMT-NFR-2026-10` Group Non-Financial Risk Committee, 2026-10-13, nine items `on_agenda = 1`; `AG-CAND-2026-10-01` to `-04` `on_agenda = 0`; `CMT-NFRDE-2026-04` entity committee, 2026-10-20 |
| Decision thread | `decisions.shared_thread_id` and `portfolio_themes.decision_ids` | existing decision identifiers | the eighteen decisions on `THEME-PAY-01` across all six roles |
| Risk appetite position | `risks.appetite_statement`, `appetite_position` | `within`, `at-limit`, `outside` | eight risks are `outside`: `RSK-0211`, `RSK-0212`, `RSK-0216`, `RSK-0184`, `RSK-0186`, `RSK-0301`, `RSK-0302`, `RSK-0371` |
| Group indicator | `kris.id` with `entity_id = ARC-GROUP` | `KRI-<AREA>-NNN` | `KRI-GOV-001` overdue remediation actions, 7 against amber 3 and red 8, `amber`; `KRI-GOV-004` `amber`; `KRI-TPR-002` `red`; `KRI-RES-005` `red` |
| Remediation portfolio | `actions.id`, `status = overdue`, `due_on`, `is_unowned` | `MSN-YYYY-NNNN` | `MSN-2026-0147` ref `AUD-2025-09-F3`, 67 days past its revised date; `MSN-2026-0102`, `-0119`, `-0131`, `-0158`, `-0172` all `overdue` |
| Live risk acceptance | `issues.kind = finding` on a risk | `ISS-YYYY-NNNN` | `ISS-2026-0301` ref `RSK-0184-ACCEPTANCE-CONDITION`, "Live risk acceptance is operating on an unmet condition" |
| Management information | `evidence_documents.source_type in (committee-extract, kri-report)` | `EVD-YYYY-NNNNN` | the committee extracts behind `CMT-NFR-2026-10` |
| Policy she applies | `policies.id` with `related_role_ids` containing `nfr-governance` | `POL-<AREA>-N.N` | `POL-GOV-6.1` Committee escalation and agenda, v5.0; `POL-ORP-5.2` Risk appetite and escalation |

She is the only role with `groupScope = true` in `buildRoleScope`
(`src/db/repositories/workspace.ts`), which is why group scoped indicators reach
her and only her.

### 6.3 The queue columns this role would recognise

| Slot | English | German, ASCII only |
| --- | --- | --- |
| `Now` | Aggregate position | Aggregierte Position |
| `Next` | Agenda and escalation | Agenda und Eskalation |
| `Done` | Tabled and minuted | Eingebracht und protokolliert |
| Watching strip | Portfolio pressure | Portfoliodruck |

"Aggregierte Position" is the thing only she can set, and `required_authority`
on `GOV-D1` says so in those terms: "The portfolio lead owns the aggregate view;
indicator owners retain their own positions." "Eingebracht und protokolliert" is
the only definition of done a governance role accepts: an item is finished when
it is on an agenda and in minutes, which is what `committee_items.on_agenda` and
`agenda_position` record. "Portfoliodruck" is her real watch list: appetite
breaches, overdue remediation and group indicators, counted rather than listed.

### 6.4 What a decision means for this role

A decision is an aggregation or a prioritisation: whether separate findings are
one theme, whether a theme is material at portfolio level, what goes on the
agenda and in what order, and what gets escalated to executive management. The
seeded kinds are `materiality` (two), `risk-acceptance` (one), `agenda` (two) and
`escalation` (one).

| Reference | id | `judgment_kind` | Computed class | Why |
| --- | --- | --- | --- | --- |
| `GOV-D1` | `DEC-2026-0755` | `materiality` | `APPROVAL_REQUIRED` | all three options require approval |
| `GOV-D2` | `DEC-2026-0756` | `risk-acceptance` | `APPROVAL_REQUIRED` | all three options require approval |
| `GOV-D3` | `DEC-2026-0757` | `agenda` | `APPROVAL_REQUIRED` | two of three options require approval |
| `GOV-D4` | `DEC-2026-0763` | `escalation` | `APPROVAL_REQUIRED` | all three options require approval |
| `GOV-D5` | `DEC-2026-0781` | `agenda` | `APPROVAL_REQUIRED` | two of three options require approval |
| `GOV-D6` | `DEC-2026-0784` | `materiality` | `APPROVAL_REQUIRED` | all three options require approval |

All six are `APPROVAL_REQUIRED`. Her morning suggestion
`SUG-SEED-nfr-governance-morning` is the only one of the six recorded as
`DRAFT`, which is the most honest class in the whole seed: a model may draft an
aggregate narrative and may not propose it as a position, because aggregation is
interpretation. That distinction should be visible on her home page rather than
flattened into the same treatment the other five roles get.

### 6.5 The first-week analyst test

Record: `decisions.id = DEC-2026-0755`, `reference = GOV-D1`,
`related_object_kind = kri`, `related_object_id = KRI-PAY-007`, presented at
`07:45`, `priority_rank = 1`, `status = open`, `confidence = 0.65`, the lowest of
the six morning decisions. Related theme `THEME-PAY-01`
(`duplicate_report_count = 6`).

- Heading, one line:
  `THEME-PAY-01: four Red indicators in four functions, or one chain with two inferred links`
- Reason, one line:
  `Four separate rows is what the committee has seen every quarter and acted on never, and a chair can reject the chain on one inferred link.`
- Primary button:
  `Set the aggregate position`

German equivalents, ASCII only: heading
`THEME-PAY-01: vier rote Indikatoren in vier Funktionen, oder eine Kette mit zwei abgeleiteten Verbindungen`;
button `Aggregierte Position festlegen`.

The heading names the theme and the shape of the choice, which is what separates
it from `DEC-2026-0756` (a live risk acceptance on an unmet condition) and
`DEC-2026-0757` (pre-resolve the control divergence or table it). All three
currently render `Record the decision`.

### 6.6 What should NOT be on this role's home page

- The five identical overdue action rows. At every moment her Watching column is
  `MSN-2026-0102`, `-0119`, `-0131`, `-0158` and `-0172`, all five of which have
  the title "Overdue remediation action outside the payments scope of this
  scenario". Five rows of identical text is the worst case of the generic queue:
  it consumes five of her six Watching slots and says one thing. The honest
  rendering is one counted row, "7 remediation actions overdue", which is what
  `KRI-GOV-001` already measures at 7 against a red threshold of 8, with the
  list behind it.
- Other roles' decision detail. The eighteen decisions on `THEME-PAY-01` belong
  in the portfolio lens in `/workday/nfr-governance/workbench`, as a thread, not
  as eighteen rows in her queue.
- Indicator detail. `KRI-PAY-003` reaches her Watching column because her scope
  is group wide. She needs the count of group indicators outside threshold, not
  the payments repair rate series, which is the operational risk partner's
  instrument.
- Committee paper drafting. `MSN-2026-0213` and the other `communication` kind
  actions belong in `/workday/nfr-governance/collaboration`.
- The agenda walk-through. `GOV-AGENDA-CMT-2026-10` at `13:30` belongs in
  `/workday/nfr-governance/meetings`.

---

## 7. Cross-role summary

| Role | `Now` / `Next` / `Done` (EN) | `Now` / `Next` / `Done` (DE, ASCII) | Primary object | Primary decision type | The one thing needed in the first viewport |
| --- | --- | --- | --- | --- | --- |
| `rcsa` | Your challenge position / Assessment lines open / Recorded in the cycle | Ihre kritische Wuerdigung / Offene Bewertungszeilen / Im Zyklus erfasst | `risks.id` and `controls.id` inside an `assessments` version (`RCSA-ARC-DE-PAYOPS-2026-Q4`) | `residual-risk` and `control-effectiveness`, `APPROVAL_REQUIRED` | the contested residual position: which risk, whose rating, and how far outside appetite |
| `tprm` | Assessment call / Due diligence open / Closed on the file | Bewertungsentscheid / Sorgfaltspruefung offen / In der Akte geschlossen | `suppliers.id` (`TP-0042`) with its `contracts` and `subprocessors` | `materiality` on a reassessment gap, `APPROVAL_REQUIRED` | which arrangement, how many days to `next_assessment_due`, and which evidence is still missing |
| `control-assurance` | Exception to classify / Test rounds in progress / Concluded and signed | Zu klassifizierende Abweichung / Laufende Pruefungsrunden / Abgeschlossen und gezeichnet | `control_tests.id` (`TST-2026-0318`) and its `test_cases` | exception scope, `isolated` or `systemic`, and `assurance-conclusion`, `APPROVAL_REQUIRED` | the exception, its case identifier, and the population and sample it came from |
| `incident-resilience` | Classification due / Tolerance and recovery / Closed and logged | Faellige Einstufung / Toleranz und Wiederherstellung / Geschlossen und protokolliert | `incidents.id` (`INC-2026-0412`) and `impact_tolerances.id` (`ITOL-0004-03`) | `severity`, and `materiality` on a tolerance breach, `APPROVAL_REQUIRED` | minutes of tolerance remaining, per entity scope, against the cut-off clock |
| `regulatory-change` | Applicability to decide / Obligations in assessment / Interpretation recorded | Zu entscheidende Anwendbarkeit / Pflichten in Pruefung / Auslegung erfasst | `obligations.id` (`OBL-2026-0088-002`) under a `regulatory_publications` row | `applicability` per legal entity, `APPROVAL_REQUIRED` | which paragraph, which entity, and which jurisdiction lane it sits in |
| `nfr-governance` | Aggregate position / Agenda and escalation / Tabled and minuted | Aggregierte Position / Agenda und Eskalation / Eingebracht und protokolliert | `portfolio_themes.id` (`THEME-PAY-01`) and `committee_items` on `CMT-NFR-2026-10` | portfolio `materiality` and `agenda`, `APPROVAL_REQUIRED` | how many agenda slots remain before 13.10.2026 and what is competing for them |

The jurisdiction lane in the `regulatory-change` row, and the per entity scope in
the `incident-resilience` row, are the two places where a single home page row
must never collapse two entities into one. Illustrative regulatory context, not
legal advice.

## 8. Implementation notes for whoever builds this

These are design constraints, not code. The implementer owns the code.

1. `FocusItemView` already carries everything the role native heading needs
   except the related object. `decisions.related_object_kind` and
   `related_object_id` are read in `decisionCandidates` only to build
   `relatedObjectKey`, which is used for the Watching suppression rule and then
   discarded. Carrying them onto the item would let `RoleHome.tsx` render
   `KIND_LABEL` from the subject (`Supplier`, `Exception`, `Obligation`,
   `Tolerance`) rather than from `Decision`.
2. `humanAction` is an action class, one of five phrases, and must not be the
   heading. The existing comment in `RoleHome.tsx` records that lesson. The
   per-role button labels in this document map to `judgment_kind`, not to role,
   which is the smaller and more durable mapping: eleven kinds, eleven labels,
   each in two languages.
3. `dueMoment` is `null` at every construction site in `focus.ts`. The
   comparator in `orderFocusItems` reads it and can never see a value. Real
   dates exist on `actions.due_on`, `issues.due_on`,
   `suppliers.next_assessment_due`,
   `regulatory_publications.consultation_closes` and
   `impact_tolerances.threshold_minutes` against `consumed_minutes`.
4. The `Done` column cannot currently contain the professional's own work.
   `decisionCandidates` files a decision under `handled` only when
   `getExecutionReceipt` returns rows, and the seeded baseline has zero
   `status = decided` decisions and zero `approvals`. So `Done` is five grouped
   `background-work` rows for every role at every moment. Either the seed needs
   closed professional work, or `Done` needs to also count the role's own
   concluded records (`control_tests.concluded_on`, `assessments.approved_on`,
   `incidents.closed_at`, `obligations.decided_on`, `committee_items.on_agenda`).
5. The Watching list is scope driven rather than role driven, which is the right
   architecture and the wrong filter. `watchingCandidates` already has two role
   specific branches, obligations for `regulatory-change` and committee items for
   `nfr-governance`. The same pattern extends to the other four: a role should
   watch the subject kinds its own profession monitors, not everything its scope
   expansion reached.
