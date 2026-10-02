# EXPERIENCE MAP
## NFR WorkOS: Live the NFR Day
### Ten moments, six roles, sixty cells

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

| Field | Value |
|---|---|
| Document ID | DOC-EXPERIENCE-MAP |
| Version | 1.0 |
| Status | Baseline. Authoritative for moment content and reveal counts. |
| Date | 30.09.2026 |
| Depends on | `DOC-SCENARIO-BIBLE` v1.0 for all facts; `DOC-ROLE-WORK-ATLAS` v1.0 for role scope and lanes |
| Consumers | Engineering (screen content, seeded actions, state transitions), presentation design (scene content), narration |

---

## 1. How to read this document

Ten moments, `M01` to `M10`. Six roles per moment. Sixty cells. Every cell has the same six dimensions, always in this order.

| Dimension | Question it answers | Discipline |
|---|---|---|
| **Today** | What does this person do right now, without the product? | Name the systems opened, the spreadsheets, the emails, the waiting, the rework. No abstractions |
| **Already done** | What has the system completed before the human arrives? | Lanes 1, 2 and 5 only. Lane 3 appears as a prepared draft requiring acceptance. Lane 4 never appears here |
| **Evidence surfaced** | Which specific artefacts, with provenance? | Real identifiers from `DOC-SCENARIO-BIBLE` section 16 |
| **Uncertainty disclosed** | What does the system say it does not know? | Stated as a limitation, not a hedge. Include what would change the answer |
| **Human choice** | What does the person decide, and is it reversible? | One decision per cell where possible. Name the authority basis |
| **State changes** | What is written where, by whom, against what evidence? | Every write names system of record, entity partition, record identifier, accountable human, evidence reference |

Two absolute rules, carried from the Atlas.

1. **Lane 4 produces no automated actions.** At `M06`, the moment designed around human judgment, the "Already done" dimension contains retrieval, option modelling and a prepared record structure, and nothing that resembles a proposed answer. No pre-selection, no default, no draft rationale.
2. **No cell may be generic.** A cell that could be copied between two roles with only the names changed is a design failure and must be rewritten.

### 1.1 Note on decision identifiers

`DOC-SCENARIO-BIBLE` section 15.4 enumerates the ten decisions that appear in the shared narrative, including `DEC-2026-0771` (`rcsa`, 09:58), `DEC-2026-0772` (`rcsa`, 11:58), `DEC-2026-0773` (fallback activation, 14:12) and `DEC-2026-0774` to `-0783`. Additional per-role decision records referenced in this document without an identifier receive one at seed time from the same group-wide `DEC` sequence, under one rule: **allocation is monotonic by creation time.** Engineers must allocate at seeding, not hard-code, or the sequence will contradict itself.

---

## 2. The "What happened in the background?" reveal

### 2.1 The rule

The reveal counts are **not decorative numbers**. They are `COUNT` queries over a seeded action ledger. If the ledger does not contain the actions, the count must not be shown. This is the single most important integrity rule in the product, because the reveal is the moment the product asks to be believed.

### 2.2 The seeded action ledger

Every automated action is a row. The table is seeded for the whole scenario day before the product runs, so the same day always produces the same counts.

| Field | Type | Notes |
|---|---|---|
| `actionId` | string | `ACT-<lane>-<year>-<seq5>`, for example `ACT-L2-2026-01884` |
| `lane` | enum | `L1`, `L2`, `L3`, `L5`. **`L4` is not a permitted value** |
| `moment` | enum | `M01` to `M10` |
| `roleSlug` | enum | `tprm`, `rcsa`, `control-assurance`, `incident-resilience`, `regulatory-change`, `nfr-governance` |
| `startedAt`, `completedAt` | timestamp | Scenario time. Ordering within a moment must be causally valid |
| `actionType` | enum | For example `retrieve`, `reconcile`, `classify`, `decompose`, `detect-contradiction`, `rank`, `route`, `chase`, `draft`, `write`, `notify`, `version`, `retain`, `verify` |
| `inputRefs` | array | Object or evidence identifiers consumed |
| `outputRefs` | array | Object or evidence identifiers produced |
| `evidenceRefs` | array | `EVD-…` references touched |
| `humanReviewRequired` | boolean | True for every `L3` and every `L5` write |
| `humanReleasedBy`, `humanReleasedAt` | string, timestamp | Populated only after human release. An `L5` row with these null has not executed |
| `confidence` | enum | `high`, `medium`, `low`, or `not-applicable` for deterministic actions |
| `limitationNote` | string, nullable | Mandatory where `confidence` is `medium` or `low` |

### 2.3 What the reveal shows

Three numbers and one list, never more.

1. **Actions completed** for this role in this moment, by lane.
2. **Evidence artefacts touched**, with the count of those retrieved from an external party.
3. **Actions awaiting human release**, which is the honest counterweight to the first number.
4. **A drill-down list** of every counted action with its type, inputs, outputs and duration. The reveal is always drillable. A number without a list is a claim.

### 2.4 Reveal counts, per role per moment

Lane `L4` is zero in every cell by design and is therefore not shown as a column. `L3` counts are **prepared drafts requiring human acceptance**, not completed work, and are shown separately for that reason.

#### tprm, `P-002` Stefan Brunner

| Moment | `L1` Organise | `L2` Understand | `L5` Execute | Total automated | `L3` drafts prepared |
|---|---|---|---|---|---|
| `M01` 07:45 | 9 | 14 | 0 | 23 | 1 |
| `M02` 08:10 | 17 | 8 | 2 | 27 | 0 |
| `M03` 08:45 | 4 | 31 | 3 | 38 | 2 |
| `M04` 09:30 | 11 | 19 | 4 | 34 | 1 |
| `M05` 10:30 | 8 | 6 | 3 | 17 | 1 |
| `M06` 11:45 | 2 | 5 | 0 | 7 | 0 |
| `M07` 13:30 | 6 | 12 | 7 | 25 | 3 |
| `M08` 14:05 | 5 | 22 | 2 | 29 | 1 |
| `M09` 15:00 | 9 | 27 | 6 | 42 | 2 |
| `M10` 16:30 | 12 | 9 | 14 | 35 | 3 |
| **Day** | **83** | **153** | **41** | **277** | **14** |

#### rcsa, `P-003` Marlene Aigner

| Moment | `L1` | `L2` | `L5` | Total automated | `L3` drafts |
|---|---|---|---|---|---|
| `M01` | 7 | 16 | 0 | 23 | 1 |
| `M02` | 14 | 7 | 1 | 22 | 0 |
| `M03` | 3 | 26 | 2 | 31 | 2 |
| `M04` | 9 | 13 | 3 | 25 | 1 |
| `M05` | 11 | 9 | 5 | 25 | 2 |
| `M06` | 1 | 4 | 0 | 5 | 0 |
| `M07` | 5 | 8 | 9 | 22 | 2 |
| `M08` | 4 | 15 | 1 | 20 | 0 |
| `M09` | 7 | 18 | 4 | 29 | 1 |
| `M10` | 10 | 7 | 12 | 29 | 3 |
| **Day** | **71** | **123** | **37** | **231** | **12** |

#### control-assurance, `P-004` Jakob Steinbacher

| Moment | `L1` | `L2` | `L5` | Total automated | `L3` drafts |
|---|---|---|---|---|---|
| `M01` | 6 | 12 | 0 | 18 | 1 |
| `M02` | 12 | 6 | 1 | 19 | 0 |
| `M03` | 3 | 38 | 2 | 43 | 3 |
| `M04` | 8 | 21 | 3 | 32 | 2 |
| `M05` | 5 | 7 | 2 | 14 | 1 |
| `M06` | 1 | 6 | 0 | 7 | 0 |
| `M07` | 4 | 10 | 6 | 20 | 2 |
| `M08` | 3 | 24 | 1 | 28 | 1 |
| `M09` | 6 | 29 | 5 | 40 | 3 |
| `M10` | 9 | 11 | 15 | 35 | 3 |
| **Day** | **57** | **164** | **35** | **256** | **16** |

#### incident-resilience, `P-005` Nadia Lehmann

| Moment | `L1` | `L2` | `L5` | Total automated | `L3` drafts |
|---|---|---|---|---|---|
| `M01` | 8 | 13 | 0 | 21 | 1 |
| `M02` | 15 | 7 | 1 | 23 | 0 |
| `M03` | 4 | 22 | 2 | 28 | 2 |
| `M04` | 10 | 14 | 3 | 27 | 1 |
| `M05` | 6 | 8 | 2 | 16 | 1 |
| `M06` | 2 | 5 | 0 | 7 | 0 |
| `M07` | 5 | 9 | 6 | 20 | 2 |
| `M08` | 11 | 33 | 8 | 52 | 1 |
| `M09` | 16 | 41 | 14 | 71 | 2 |
| `M10` | 13 | 12 | 18 | 43 | 3 |
| **Day** | **90** | **164** | **54** | **308** | **13** |

#### regulatory-change, `P-006` Tobias Reinhardt

| Moment | `L1` | `L2` | `L5` | Total automated | `L3` drafts |
|---|---|---|---|---|---|
| `M01` | 6 | 15 | 0 | 21 | 1 |
| `M02` | 13 | 6 | 1 | 20 | 0 |
| `M03` | 3 | 29 | 2 | 34 | 2 |
| `M04` | 7 | 11 | 2 | 20 | 1 |
| `M05` | 5 | 6 | 2 | 13 | 1 |
| `M06` | 1 | 4 | 0 | 5 | 0 |
| `M07` | 4 | 9 | 5 | 18 | 1 |
| `M08` | 3 | 17 | 1 | 21 | 1 |
| `M09` | 6 | 23 | 5 | 34 | 2 |
| `M10` | 8 | 8 | 11 | 27 | 2 |
| **Day** | **56** | **128** | **29** | **213** | **11** |

#### nfr-governance, `P-001` Dr. Katharina Vogt

| Moment | `L1` | `L2` | `L5` | Total automated | `L3` drafts |
|---|---|---|---|---|---|
| `M01` | 11 | 18 | 0 | 29 | 1 |
| `M02` | 21 | 9 | 2 | 32 | 1 |
| `M03` | 5 | 24 | 3 | 32 | 2 |
| `M04` | 12 | 15 | 4 | 31 | 1 |
| `M05` | 7 | 7 | 3 | 17 | 1 |
| `M06` | 2 | 6 | 0 | 8 | 0 |
| `M07` | 6 | 10 | 8 | 24 | 2 |
| `M08` | 7 | 19 | 3 | 29 | 1 |
| `M09` | 12 | 25 | 9 | 46 | 2 |
| `M10` | 18 | 14 | 27 | 59 | 4 |
| **Day** | **101** | **147** | **59** | **307** | **15** |

#### Day totals, all roles

| | `L1` | `L2` | `L5` | `L4` | Total automated | `L3` drafts |
|---|---|---|---|---|---|---|
| All six roles | 458 | 879 | 255 | **0** | **1,592** | **81** |

### 2.5 Reconciliation rules for the ledger

These must pass in CI. A build that fails one of them ships a false claim.

1. Every per-role row total equals the sum of its `L1`, `L2` and `L5` cells.
2. Every per-role day total equals the sum of its ten moment totals.
3. The grand total 1,592 equals 458 plus 879 plus 255, and equals the sum of the six role day totals (277, 231, 256, 308, 213, 307).
4. `L4` count is 0 in all sixty cells. A non-zero value is a build failure, not a warning.
5. `M06` has the lowest automated total for every role, and its `L5` and `L3` counts are 0 for every role. `M06` is the human decision point; nothing is written and nothing is drafted during it.
6. `M10` has the highest `L5` count for every role. The day ends with controlled execution, which is the product's structural argument.
7. `L2` peaks at `M03` for four roles (`tprm` 31, `rcsa` 26, `control-assurance` 38, `regulatory-change` 29) and at `M09` for two (`incident-resilience` 41, `nfr-governance` 25). The four `M03` peaks are evidence-assembly moments; the two `M09` peaks belong to the roles that own the event and the group position. Any other shape is a seeding error and must be justified in the ledger before it ships.
8. Every `L5` row has `humanReviewRequired = true`. Every `L5` row counted as completed has `humanReleasedBy` and `humanReleasedAt` populated.
9. Every `L3` row has `humanReviewRequired = true` and is counted as prepared, never as completed.
10. Every counted action's `inputRefs` and `outputRefs` resolve to objects that exist in the seed at that moment. An action consuming `EVD-2026-41905` cannot be timestamped before 15:38.
11. Every `L2` action with `confidence` of `medium` or `low` has a non-null `limitationNote`, and that note is the text shown in the "Uncertainty disclosed" dimension.
12. The drill-down list length equals the displayed count, exactly.

### 2.6 What the reveal must never do

- Show a round number. 1,592 is a sum, not a headline; the product should resist the temptation to display "over 1,500".
- Count a keystroke, a page render, a cache hit or an internal retry as an action.
- Count the same retrieval twice because two roles consumed it. Shared retrievals are counted once against the requesting role and appear in the other role's ledger as a **reuse**, which is displayed separately and is a better story anyway.
- Show a count without the awaiting-release number beside it.
- Present the count as time saved. The product does not know how long a human would have taken, and asserting it would be an invented benchmark.

---

## 3. `M01` 07:45 Morning decision brief

**The moment.** Six people open the product for the first time today. Nothing has happened yet. Everything in `DOC-SCENARIO-BIBLE` section 14 is already true, and nothing in Arcadia's existing reporting connects any of it. This is the moment where the product either proves its thesis or spends the rest of the day catching up. `M01` is the most important moment in the product and the 14:05 event is not.

---

### `M01` tprm, `P-002` Stefan Brunner

**Today.** Opens Outlook to 61 unread messages. Opens `SYS-0031` Arcadia RiskCore to the third-party module and reads the Novalink record. Opens the reassessment tracker, an Excel workbook, `TPRM-Q-2026-tracker-v14.xlsx`, held on a shared drive, last edited by him at 18:42 on 02.10.2026. Cross-checks which of 214 questions have responses by filtering column H. Cannot tell from the workbook which of the 33 received artefacts he has actually read. Opens the contract repository in a separate browser tab to check an appendix version, gets the document management system's search, and gives up after two attempts. Total elapsed before he knows anything: 35 to 50 minutes, and at the end of it he has a list, not a picture.

**Already done.** `L1` 9: inbox triaged to 61 items, of which 7 linked to `TP-0042` objects and ranked; the `AG-CMT-NFR-2026-10-04` paper deadline placed at 08.10.2026 12:00 with 2 business days remaining; three chases aged (the `TPRM-Q-2026-R19` full report request at 14 days). `L2` 14: reassessment state reconciled from source rather than from the workbook (198 of 214 responses, 33 of 41 artefacts received, 26 accepted); `CTR-2023-0117-A3` v4.2 retrieved as the binding version with its 14.02.2025 date; Novalink register v6.1 retrieved and reconciled against it; `KRI-TPR-002` decomposed to show the shortfall concentrated in subcontracting-chain fields; NOVA-GATE September availability calculated at 99.62% against a contracted 99.7%; `EVD-2026-40118` flagged as 137 days in the vault with an unescalated RTO gap. `L5` 0. `L3` 1: a prepared structure for the `AG-…-04` paper, sections only, no content, requiring his acceptance.

**Evidence surfaced.** `CTR-2023-0117-A3` v4.2 (14.02.2025, binding). Novalink Subprocessor Register v6.1 (03.08.2026). `EVD-2026-40118` DR test report (created 22.05.2026, retrieved 15.06.2026, never escalated). `EVD-2026-40233` penetration test summary (30.06.2026, 2 pages). `CTR-2023-0117-A1` service level clause. `CTR-2023-0117-A3` clause 3.4, the 60-day notice obligation.

**Uncertainty disclosed.** "The 99.62% availability figure is calculated from Arcadia-side submission telemetry, not from a Novalink service report. Novalink has not published September availability. If Novalink's measurement excludes different maintenance windows, the figure will differ and the service-level conclusion may not hold." And: "Novalink's register v6.1 is the version currently on the client portal. Whether portal publication constitutes notice under Appendix A3 clause 3.4 is a contractual question, not a factual one, and this system does not answer it."

**Human choice.** Whether the morning's priority is the reassessment deadline (25 days) or the appendix divergence (no deadline, higher consequence). He chooses the divergence, on the basis that the reassessment can complete on time with an open item and the divergence cannot be resolved without a contractual route that takes weeks. Reversible.

**State changes.** None written. `M01` is read-only for every role by design. A morning brief that writes to the system of record before the human has read it inverts the accountability.

**Background reveal.** 23 actions (`L1` 9, `L2` 14, `L5` 0). 6 artefacts touched, 2 external. 0 awaiting release. 1 draft prepared, unaccepted.

---

### `M01` rcsa, `P-003` Marlene Aigner

**Today.** Opens the KRI report, a PDF emailed at 06:04 on 05.10.2026, 34 pages, three red rows on page 11. Opens `SYS-0031` to read `RSK-0211`'s Q3 assessment. Opens her own pre-read, `RCSA-PAYOPS-Q4-preread-v3.docx`, to check what she committed to on 02.10.2026. Opens the override data extract that `P-007`'s team sent her on 01.10.2026, an Excel file with 731 rows and no reason-code summary, and builds a pivot table by hand. The pivot is where the `OVR-C` finding is, and on a normal morning she does not have time to build it. She has a workshop at 10:30.

**Already done.** `L1` 7: workshop at 10:30 with attendees resolved and the pre-read distribution confirmed; the `KRI-PAY-007` 1LoD explanation deadline placed at 12.10.2026; her `AG-…-03` joint paper obligation with `P-004` flagged as blocked on his unresolved conclusion. `L2` 16: `KRI-PAY-007` decomposed by override reason code across two months, ranking `OVR-C` at +539% and `OVR-D` at +124% against three flat components; the `OVR-C` driver reconciled to five NOVA-GATE fallback activations totalling 8 hours 40 minutes in September against one hour in August; `KRI-PAY-011` linked to position `PR-SR-02` vacant since 31.07.2026 and to `MSN-2026-0166` overdue 6 days; `TST-2026-0318` conclusion and the `P-008` counter-position retrieved as two attributed statements, not one; `RSK-0211` Q3 assessment and both Q4 positions assembled side by side; the `RSK-0211` loss history confirmed at zero recorded losses over 24 months, flagged as a fact whose interpretation is contested. `L5` 0. `L3` 1: a prepared residual-assessment worksheet with the inherent scores carried forward and the residual cells **empty**, which is the correct shape.

**Evidence surfaced.** September and August override extracts by reason code, reconciled to `SYS-0011`. The five September fallback activation records. `TST-2026-0318` report (25.09.2026). `P-008`'s Fully Effective position (recorded 29.09.2026). `RSK-0211` Q3 assessment (signed 08.07.2026). Her own Q4 pre-read (02.10.2026). Position record `PR-SR-02`.

**Uncertainty disclosed.** "The `OVR-C` growth is attributed to fallback activation on the basis of temporal correlation across five September events. The override records do not carry a field linking them to a specific activation, so the attribution is an inference. It would be falsified if a material share of September `OVR-C` overrides fell outside the five activation windows; on current data 181 of 198 fall inside them, and 17 do not." And: "Zero recorded losses over 24 months is a verified fact about the loss register. It is not evidence about likelihood unless detection is known to be effective, and detection on this risk is `CTL-PAY-029`, which reconciles value rather than authorisation."

**Human choice.** Whether to request three separate 1LoD explanations for three red indicators, which is procedurally correct, or one causal investigation, which is analytically useful and procedurally unusual. She takes the second at 09:58 as `DEC-2026-0771`. Reversible, and the choice is made two hours after this moment, which the product should show as an open decision carried forward rather than as a resolved one.

**State changes.** None written.

**Background reveal.** 23 actions (`L1` 7, `L2` 16, `L5` 0). 7 artefacts touched, 0 external. 0 awaiting release. 1 draft prepared, unaccepted.

---

### `M01` control-assurance, `P-004` Jakob Steinbacher

**Today.** Opens his working papers for `TST-2026-0318`, a folder on a shared drive with 60 sample sub-folders, an Excel attribute matrix and a Word report. Opens `SYS-0031` to see whether `P-008` has responded to the conclusion. Finds her Fully Effective position recorded on 29.09.2026 with a three-line rationale. Opens the two unable-to-conclude items and re-reads his own notes. Opens the Novalink correspondence thread on `UTC-TST-2026-0318-02` to check whether the 10.10.2026 restore commitment has moved. Nothing in any of these tools tells him that he is blocking `P-003`'s workshop.

**Already done.** `L1` 6: `P-008`'s counter-position surfaced as an open divergence with its 29.09.2026 date and a 7-day age; the `AG-…-03` paper deadline at 08.10.2026 12:00; **his own conclusion flagged as blocking `P-003`'s 10:30 workshop**, which is the single most useful line in his brief. `L2` 12: the attribute matrix reconstructed from working papers into 60 rows by 5 attributes, 296 pass, 4 fail, 2 unable to conclude; both deviation rates computed (6.67% and 10.00%) against the 5% tolerable rate; `UTC-TST-2026-0318-01` flagged as permanently unrecoverable with the 30-day log expiry date stated; `UTC-TST-2026-0318-02` Novalink restore commitment confirmed at 10.10.2026 with 2 business days of float; the population's time-bounding (01.06.2026 to 31.08.2026) surfaced as a stated scope property; `EXC-TST-2026-0318-04`'s root cause field retrieved verbatim as "system configuration" with `MSN-2026-0203` linked and shown as not started. `L5` 0. `L3` 1: a prepared design-versus-operating split for the four exceptions, with `EXC-…-04` marked undetermined rather than assigned, requiring his classification.

**Evidence surfaced.** `TST-2026-0318` working papers and attribute matrix. `EVD-2026-41908` `CTL-PAY-014` description v4.1 (14.01.2025). The four exception records with their override identifiers, values and timestamps. `UTC-…-01` audit log showing `svc_repairbatch`. `UTC-…-02` broken evidence link with the 01.09.2026 retention job date. `P-008`'s position record. `MSN-2026-0203`.

**Uncertainty disclosed.** "The sample was random but not stratified by value or by override reason code. The exception set contains one item at EUR 1,215,000 and three below EUR 85,000, which is a distribution the sampling method did not control for. A value-stratified sample would produce a different exception profile and this cannot be quantified from the existing work." And: "`UTC-TST-2026-0318-01` cannot be resolved. The underlying human identity was held in a Novalink application log with 30-day retention, and the log expired before the question was asked. No further evidence exists."

**Human choice.** Whether to characterise `EXC-TST-2026-0318-04` as design or operating before he has seen the configuration. He declines to classify it and marks it undetermined pending the configuration, which is the professionally correct answer and which he did not give on 24.09.2026. Reversible.

**State changes.** None written.

**Background reveal.** 18 actions (`L1` 6, `L2` 12, `L5` 0). 7 artefacts touched, 2 external. 0 awaiting release. 1 draft prepared, unaccepted.

---

### `M01` incident-resilience, `P-005` Nadia Lehmann

**Today.** Opens the resilience dashboard in `SYS-0031`, which shows `KRI-RES-005` at 78% and a list of important business services with a tested-or-not flag. Opens her own tracker, `Resilience-testing-plan-2026.xlsx`, to see when `IBS-0004` was last tested. Opens the `ITOL-0004-03` tolerance record to prepare for `AG-…-08`, reads the threshold, does not read it as a definition. Opens the `TPRM-Q-2026` shared tracker to check `R04` and cannot tell whether `P-002` has escalated it. Emails him to ask. Her morning has no way of telling her that five fallback activations happened in her coverage area in September.

**Already done.** `L1` 8: `AG-…-08` paper deadline at 08.10.2026 12:00; the Operational Resilience Working Group at 10:30 with its agenda assembled; `MSN-2026-0188` at 25% surfaced with `P-002` as owner and the dependency stated, removing the need for the email; `MSN-2026-0177` exit test surfaced as not started and linked to the `RSK-0184` acceptance condition. `L2` 13: `KRI-RES-005` decomposed to name `IBS-0004` as one of the untested services; the five September fallback activations aggregated to 8 hours 40 minutes against one hour in August, **presented as a dependency-degradation signal rather than a payments statistic**, which is the reframing no existing report performs; `RB-PAY-007` retrieved with section 4's assertion that "the control environment is unchanged during fallback operation" extracted verbatim and reconciled against the control inventory, which contradicts it; `RB-PAY-011` retrieved with its 45-minute lead time; `ITOL-0004-03` retrieved with **both measures displayed separately** and no precedence found in the record; `TPRM-Q-2026-R04` surfaced showing no DR evidence for the Swiss instance at `TP-0042.1`. `L5` 0. `L3` 2: a prepared `AG-…-08` tolerance review structure listing all four `IBS-0004` tolerances with their measures enumerated; a prepared gap note on `RB-PAY-007` section 4.

**Evidence surfaced.** `RB-PAY-007` v3.1 (09.02.2026), section 4. `RB-PAY-011`. `ITOL-0004-01` to `-04` records with review dates. The five September activation records with durations. `EVD-2026-40118` (no Swiss instance coverage). `KRI-RES-005` composition. Last `IBS-0004` severe-but-plausible test record, 18.11.2025.

**Uncertainty disclosed.** "`RB-PAY-007` section 4 asserts that the control environment is unchanged during fallback operation. Reconciliation against the control inventory identifies `CTL-PAY-014` as conditional on system state, which contradicts the assertion. This system has not verified the actual system configuration and cannot state what changes during fallback. The contradiction is between two Arcadia documents, not between a document and an observed fact." And: "`ITOL-0004-03` contains two measures. The record does not state which governs if they diverge. No divergence has been observed, so the ambiguity is currently theoretical."

That second disclosure is the most consequential sentence in the product, and it is issued at 07:45, eight hours and nineteen minutes before the ambiguity stops being theoretical.

**Human choice.** Whether the `RB-PAY-007` section 4 contradiction is a documentation error to correct quietly or a control assertion to raise as a finding. She defers it to the 10:30 working group, which is a reasonable choice and which costs her the chance to have fixed it before 14:12. The product must not spare her this; the day is more honest if a defensible choice turns out badly.

**State changes.** None written.

**Background reveal.** 21 actions (`L1` 8, `L2` 13, `L5` 0). 7 artefacts touched, 1 external. 0 awaiting release. 2 drafts prepared, unaccepted.

---

### `M01` regulatory-change, `P-006` Tobias Reinhardt

**Today.** Opens the regulatory change tracker in `SYS-0031`, which lists four in-scope items with RAG statuses. Opens `REG-2026-0031`'s completeness report, which says 94.6% of Tier 1 records complete, and cannot see from it which records or which fields. Emails `P-002` to ask. Opens the `REG-2026-0104` draft standard, 23 pages, consultation to 23.10.2026, and skims it because he wrote most of it. Opens two noting-item paper templates. His real risk today is a jurisdictional category error in a noting item that nobody will read carefully, and nothing in his morning flags that.

**Already done.** `L1` 6: both paper deadlines at 08.10.2026 12:00; the Regulatory Change Forum at 10:30 with the `ARC-CH` local compliance attendee (`P-015`) resolved; the email to `P-002` made unnecessary. `L2` 15: `REG-2026-0031`'s 94.6% decomposed into four states (evidenced, unevidenced, stale, unmapped) with the shortfall localised to subcontracting-chain fields on three Tier 1 records including `TP-0042`; `REG-2026-0088`'s `ARC-CH` inventory checked against the Novalink service list, returning `SVC-0042-02` and `-05` as significant outsourcings with `TP-0042.1` correctly recorded; the Novalink register v6.1 cross-read into the Swiss lane, surfacing `TP-0042.4` Meridian in Pune as a data-access question **not yet mapped to any obligation**; `SVC-0042-03`'s classification retrieved with its dependency on `PT-06` bulk files noted as inconsistent with a non-critical rating; `REG-2026-0104`'s draft clauses on tolerance definition retrieved and reconciled against the four `IBS-0004` tolerance records, returning `ITOL-0004-03` as the only tolerance with two measures. `L5` 0. `L3` 1: prepared structures for both noting papers, with the entity-scope field on every obligation node pre-populated and the lane separator enforced.

**Evidence surfaced.** `REG-2026-0031` register extract with per-field completeness. `REG-2026-0088` `ARC-CH` inventory. `REG-2026-0104` draft v0.7 (21.09.2026). `REG-2026-0117` classification standard, both lanes. Novalink Register v6.1. `CTR-2023-0117-A7` data processing and transfers v2.2 (20.05.2025). Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "`TP-0042.4` Meridian appears in the supplier's register with read access to payment metadata including beneficiary name. The scope of that access is stated by the supplier and has not been verified by Arcadia. Whether the access constitutes a disclosure requiring assessment under the Swiss lane depends on the actual data scope, which is unverified. Illustrative regulatory context, not legal advice." And: "The `REG-2026-0104` draft does not require a stated precedence where a tolerance has more than one measure. This is an observation about the draft text, not a defect finding; whether it matters depends on whether any tolerance actually has two measures, and one does."

**Human choice.** Whether to raise the `REG-2026-0104` precedence omission now, during the consultation, or wait for evidence that it causes a problem. He defers, reasonably, because a standard comment without a concrete case is weak. At 16:04 he gets the case with 17 days of window left, which is the day's luckiest timing.

**State changes.** None written.

**Background reveal.** 21 actions (`L1` 6, `L2` 15, `L5` 0). 6 artefacts touched, 2 external. 0 awaiting release. 1 draft prepared, unaccepted.

---

### `M01` nfr-governance, `P-001` Dr. Katharina Vogt

**Today.** Opens the group NFR dashboard, which shows six indicators with four in red and a Massnahme count of 7 overdue. The four reds sit in four rows owned by four people. Opens the committee tracker, a spreadsheet, and counts three of five decision items undrafted against a deadline of 08.10.2026 at 12:00. Opens `MSN-2026-0147` and sees 60% complete, owner `P-007`, revised due 31.07.2026, and has to calculate 67 days herself. Opens the `RSK-0184` acceptance record and sees a valid acceptance; the condition status is in a free-text field she does not read. She spends the morning assembling, and the thing she most needs, that the four reds are one chain, is not derivable from anything on her screen.

**Already done.** `L1` 11: committee readiness computed per agenda item against the 08.10.2026 12:00 deadline, showing three of five decision items undrafted; `MSN-2026-0147` aged at exactly 67 days with the 60-day escalation rule shown as triggered on 29.09.2026; the seven overdue Massnahmen split into dependency-blocked (4) and not-started (3); each of the four red indicators routed to its owner with the owner's own deadline attached; the blocking chain surfaced (`P-004`'s conclusion blocks `P-003`'s rating blocks the RCSA sign-off blocks her `AG-…-03` paper). `L2` 18: **the causal chain assembled**, linking NOVA-GATE September availability to `OVR-C` growth to `KRI-PAY-007` to reviewer capacity at 75% to `CTL-PAY-014` Partially Effective to `MSN-2026-0147` at 67 days to `RSK-0211` outside appetite, as one object with seven nodes and six evidenced links; the `RSK-0184` acceptance parsed into two conditions with status (reassessment in progress, exit test not started) and its 31.12.2026 expiry; `KRI-GOV-001` trend against the red threshold of 9; the `CTL-PAY-014` divergence retrieved as two attributed positions with dates. `L5` 0. `L3` 1: a prepared paper skeleton for `AG-…-03` with the divergence stated as two positions and no recommendation.

**Evidence surfaced.** All four red indicator records with their compositions. `MSN-2026-0147` with `AUD-2025-09-F3` as source and the 14.04.2026 extension approval. `RSK-0184` acceptance record (19.01.2026). `TST-2026-0318` conclusion and `P-008`'s counter-position. The committee agenda and papers tracker. `MSN-2026-0203` not started.

**Uncertainty disclosed.** "The causal chain is constructed from evidenced links between objects. Two of the six links are inferential rather than recorded: the link from fallback activation frequency to `OVR-C` growth (temporal correlation across five events, 181 of 198 overrides inside the windows), and the link from reviewer capacity to deviation frequency (no recorded evidence connects the vacancy to any specific deviation). The chain is a hypothesis with six links, four evidenced and two inferred, and it should be presented to the committee as such."

**Human choice.** Whether to pre-resolve the `CTL-PAY-014` divergence before drafting `AG-…-03`, or table it as a live divergence and make the committee do the work. She holds it open. This looks like inaction and is the correct governance act, and by 16:41 the parties resolve it themselves into something better than either option she was weighing. Reversible.

**State changes.** None written.

**Background reveal.** 29 actions (`L1` 11, `L2` 18, `L5` 0). 6 artefacts touched, 0 external. 0 awaiting release. 1 draft prepared, unaccepted.

---

## 4. `M02` 08:10 Inbox converted into work

**The moment.** The transition from messages to work items. Today this is the single largest consumer of professional time in an NFR function and produces no professional output at all. The design test for this moment: every item leaves with an object link, an owner, a deadline and a next action, or it leaves flagged as unlinkable, which is itself information.

---

### `M02` tprm, `P-002`

**Today.** 61 messages. He reads each, decides what it concerns, and either replies, files, forwards or leaves it. Fourteen concern Novalink. Three are Novalink questionnaire responses with attachments he must save to the shared drive with a naming convention he half-remembers. One is a Novalink portal notification about register v6.1 from 03.08.2026 that he has seen before and has not acted on. Two are chases from `P-006` and `P-005` asking for things his tracker could answer. Elapsed: 40 to 55 minutes. Output: an inbox with fewer bold items.

**Already done.** `L1` 17: 61 items classified; 14 linked to `TP-0042`; 3 questionnaire responses extracted, named per convention, filed to `SYS-0032` and linked to their `TPRM-Q-2026` question identifiers; the 03.08.2026 portal notification linked to the appendix divergence and aged at 64 days with no action, which converts a stale notification into a finding; the chases from `P-006` and `P-005` answered from the tracker with a source-linked reply held for release; 9 items routed to `P-010` (commercial) and `P-007` (service); 4 items flagged unlinkable and grouped for manual triage; 7 items closed as no action with a reason. `L2` 8: each of the 3 new responses assessed for completeness against the question asked, returning 2 complete and 1 partial (the `R19` response again omits the override API scope statement); the partial response reconciled against the original question text. `L5` 2: the 3 artefacts written to `SYS-0032` with retention class assigned, and the `TPRM-Q-2026` tracker updated from 198 to 201 of 214 responses. Both released by him. `L3` 0.

**Evidence surfaced.** Three new response artefacts with provenance and hash. The 03.08.2026 portal notification with its receipt timestamp. `TPRM-Q-2026-R19` original question text against the response text.

**Uncertainty disclosed.** "The `R19` response is assessed as partial because the question asked whether the RepairDesk override APIs were in scope and the response does not address scope. This is an assessment of what the response says, not of whether the APIs were tested. It is possible that they were tested and the response is merely badly written."

**Human choice.** Whether to accept the two complete responses as closing their questions. He accepts both. He rejects the `R19` response for a second time and chooses to escalate it to `P-011` rather than re-ask at working level, which is a change of register and therefore a professional choice. Reversible.

**State changes.** `SYS-0032`, `ARC-DE` partition: 3 evidence artefacts written with retention class `TPRM-5Y`, accountable `P-002`, hashes recorded. `SYS-0031` third-party module, `TP-0042`: response count 198 to 201, `R19` status set to rejected with the reason text, accountable `P-002`, evidence referenced.

**Background reveal.** 27 actions (`L1` 17, `L2` 8, `L5` 2). 5 artefacts touched, 4 external. 0 awaiting release (both writes released). 0 drafts.

---

### `M02` rcsa, `P-003`

**Today.** 38 messages. Eleven concern the workshop: two agenda queries, one attendee change, `P-008` asking whether the exceptions will be discussed, and `P-007` forwarding a spreadsheet. One is the KRI distribution list mail with the 34-page PDF. One is a query from an `ARC-AT` colleague about whether her Q4 method applies to their payments unit, which is a real question she will not have time to answer properly. Elapsed: 30 to 40 minutes.

**Already done.** `L1` 14: 38 items classified; 11 linked to `RCSA-ARC-DE-PAYOPS-2026-Q4`; the attendee change reflected in the 10:30 invitation; `P-008`'s query surfaced with her 29.09.2026 position attached, so the answer is prepared with context; `P-007`'s spreadsheet parsed and reconciled against `SYS-0011` rather than trusted; the `ARC-AT` method query routed with the group method reference and a held reply; 6 items routed to `P-004` and `P-001`; 4 closed with a reason. `L2` 7: `P-007`'s spreadsheet reconciled to source, finding 731 rows matching and one reason-code field blank on 4 rows; the workshop's 11 risks each checked for changes since the pre-read, returning one change (`RSK-0184`'s acceptance condition status). `L5` 1: the workshop invitation and pre-read redistribution, released by her. `L3` 0.

**Evidence surfaced.** `P-007`'s override extract reconciled to `SYS-0011`, with the 4 blank reason-code rows identified by override identifier. `P-008`'s position record. The Q4 pre-read v3 as distributed.

**Uncertainty disclosed.** "Four of 731 override records in the 1LoD extract have a blank `overrideReasonCode`. The same four records in `SYS-0011` also show blank. This is a data quality observation, not a control deviation, and it means the September reason-code decomposition is based on 727 records rather than 731. The `OVR-C` and `OVR-D` conclusions are unaffected at this scale."

**Human choice.** Whether to raise the four blank reason codes in the workshop. She decides to hold them: four blanks in 731 is not the day's issue and raising it would let the workshop spend twenty minutes on data quality instead of on the residual rating. A deliberate act of agenda protection. Reversible.

**State changes.** Calendar and distribution only: `RCSA-ARC-DE-PAYOPS-2026-Q4` meeting record updated with the attendee change, accountable `P-003`. No GRC assessment field written.

**Background reveal.** 22 actions (`L1` 14, `L2` 7, `L5` 1). 3 artefacts touched, 0 external. 0 awaiting release. 0 drafts.

---

### `M02` control-assurance, `P-004`

**Today.** 29 messages. Eight concern `TST-2026-0318`. One is Novalink's reply on `UTC-…-02` restating the 10.10.2026 commitment with no new information. One is `P-008` asking to speak before the workshop, which is either a good sign or the start of a negotiation. Three are Q4 test-plan scheduling mails for other controls. He re-reads his own conclusion twice, which is the tell that he is uncomfortable with it.

**Already done.** `L1` 12: 29 items classified; 8 linked to `TST-2026-0318`; `P-008`'s meeting request accepted into the 10:30 slot as a control-owner challenge meeting with her 29.09.2026 position and the four exception records attached to the invitation, so the meeting starts from evidence rather than from positions; Novalink's `UTC-…-02` reply linked and aged, with the restore commitment now at 2 business days of float and a chase scheduled for 09.10.2026; 3 Q4 scheduling items routed; 5 closed. `L2` 6: Novalink's reply compared against its 22.09.2026 acknowledgement, returning no new information and no revised date; the Q4 test plan's 14 controls screened for the same conditional-enforcement pattern as `CTL-PAY-014`, returning **3 candidates** whose descriptions assert unconditional enforcement of a system-enforced gate. `L5` 1: the challenge meeting record created with its evidence pack, released by him. `L3` 0.

**Evidence surfaced.** Novalink reply on `UTC-…-02` (06.10.2026) against its 22.09.2026 acknowledgement. `P-008`'s position record. The four exception records. Three Q4 control descriptions flagged as candidates for the same pattern.

**Uncertainty disclosed.** "Three Q4 controls have descriptions asserting unconditional enforcement of a system-enforced gate. Whether their implemented configurations match their descriptions is unknown; no configuration has been examined for any of them, including `CTL-PAY-014`. This is a pattern match on control descriptions, not a finding."

That disclosure is issued at 08:10 and it describes, in general terms, the exact failure that will be confirmed at 15:38 in the specific case.

**Human choice.** Whether to add configuration examination to the Q4 test plan for the three candidates, which adds scope he has no capacity for, or note it and proceed. He notes it. After 15:38 this becomes `MSN-2026-0220` extended in scope, and the product should show that his 08:10 note was right and under-resourced rather than wrong.

**State changes.** `SYS-0031`, `ARC-DE` partition: challenge meeting record created against `TST-2026-0318` with the evidence pack linked, accountable `P-004`.

**Background reveal.** 19 actions (`L1` 12, `L2` 6, `L5` 1). 4 artefacts touched, 1 external. 0 awaiting release. 0 drafts.

---

### `M02` incident-resilience, `P-005`

**Today.** 44 messages across three entities in two languages. Nine concern resilience testing. Two are `ARC-CH` local items that only she can action. One is a BCM plan review reminder for an unrelated service. One is a Novalink portal digest she does not read. She spends the first twenty minutes deciding which entity's problems come first, which is a question her inbox cannot answer because it does not know about legal entities.

**Already done.** `L1` 15: 44 items classified **and partitioned by entity**, which no mail client does, returning 26 `ARC-DE` and `ARC-AT`, 14 `ARC-CH`, 4 group; 9 linked to resilience testing objects; the two `ARC-CH` local items flagged as requiring local action with no group substitute available; the working group at 10:30 with its agenda and the `AG-…-08` dependency stated; the BCM plan review deferred with a date; `MSN-2026-0188` chase to `P-002` prepared and held. `L2` 7: the Novalink portal digest parsed, returning one item of substance (a scheduled maintenance note for 11.10.2026 on `SVC-0042-04`) previously unread; the 11.10.2026 window checked against `ARC-DE` and `ARC-AT` month-end processing, returning no conflict; the `ARC-CH` local items checked against `ITOL-0004-03` for relevance. `L5` 1: the 11.10.2026 maintenance window registered as a monitored event with an owner, released by her. `L3` 0.

**Evidence surfaced.** Novalink portal digest with the 11.10.2026 `SVC-0042-04` maintenance note. `ARC-DE` and `ARC-AT` processing calendars. `ITOL-0004-03`. `MSN-2026-0188` status.

**Uncertainty disclosed.** "The 11.10.2026 maintenance note is a supplier statement on a portal. `CTR-2023-0117-A1` clause 7.2 requires 10 business days notice for changes affecting a service supporting a critical or important function. The note gives 5 calendar days. Whether clause 7.2 applies depends on whether `SVC-0042-04` is in scope for this change, which the note does not state."

**Human choice.** Whether the short-notice maintenance note is worth raising with `P-002` as a possible clause 7.2 issue, on a service she is not worried about, on a day with a workshop and two papers. She raises it in one line. It costs her nothing and it is the right professional instinct, and after 15:51 it acquires a second meaning: a subprocessor applied an unnotified firmware change at 13:31 on exactly this pattern.

**State changes.** `SYS-0031`, group partition: monitored event created for the 11.10.2026 window with owner `P-005` and a clause 7.2 question flagged, accountable `P-005`, evidence referenced to the portal digest.

**Background reveal.** 23 actions (`L1` 15, `L2` 7, `L5` 1). 4 artefacts touched, 1 external. 0 awaiting release. 0 drafts.

---

### `M02` regulatory-change, `P-006`

**Today.** 52 messages, of which roughly 30 are subscription digests, law firm newsletters and regulator alert feeds. He skims all 30 for anything that might matter, which is the least productive and least skippable part of his week. Two are internal queries on the `REG-2026-0104` consultation. One is `P-002`'s reply about register completeness, which answers a question the tracker should have answered.

**Already done.** `L1` 13: 52 items classified; 30 digest items screened against the four in-scope `REG` items and against the group's obligation set, returning 2 relevant and 28 not, each with a one-line reason so the screening is auditable; both consultation queries linked to `REG-2026-0104` clauses; `P-002`'s reply linked and marked as superseded by the tracker data already surfaced at `M01`; the Forum at 10:30 with `P-015` confirmed for the Swiss lane; 6 items routed; 5 closed. `L2` 6: the 2 relevant digest items assessed for applicability per entity, returning one EU-lane item on subcontracting chain disclosure relevant to `ARC-DE` and `ARC-AT`, and one Swiss-lane item on outsourcing data access relevant to `ARC-CH`; each mapped to an existing `REG` item rather than opened as new; the lane assignment enforced so that neither item appears against the other lane. `L5` 1: both items appended to their `REG` records with their applicability determinations, released by him. `L3` 0.

**Evidence surfaced.** Two digest items with source, date and applicability determination per entity. `REG-2026-0031` and `REG-2026-0088` records. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "Twenty-eight digest items were screened as not relevant. Screening is performed against the group's current obligation set, which means an item creating an obligation Arcadia does not yet have could be screened out. Each screening decision carries its reason and is reviewable, and the false-negative risk is not zero."

**Human choice.** Whether to accept the 28 not-relevant screenings in bulk or review them. He reviews the reasons and accepts 27, pulling one back: an item on subcontractor data access that was screened as EU-lane-only and which he judges may also touch the Swiss lane. That single pull-back is the role in miniature. Reversible.

**State changes.** `SYS-0031`, `ARC-DE` and `ARC-AT` partitions: one obligation appended to `REG-2026-0031` with applicability per entity. `ARC-CH` partition: one obligation appended to `REG-2026-0088`, plus the pulled-back item added for assessment. Accountable `P-006`, both with source references and the illustrative-context label.

**Background reveal.** 20 actions (`L1` 13, `L2` 6, `L5` 1). 3 artefacts touched, 2 external. 0 awaiting release. 0 drafts.

---

### `M02` nfr-governance, `P-001`

**Today.** 73 messages, the highest volume of the six, because she is copied on everything. Nineteen are committee-related. Eleven are papers, drafts or paper queries. Four are escalations that may or may not be escalations. She spends the morning deciding which of 73 items is actually a governance event, and the honest answer is about six.

**Already done.** `L1` 21: 73 items classified; 19 linked to `CMT-NFR-2026-10` agenda items; the 4 possible escalations assessed against the escalation map, returning 1 genuine (`MSN-2026-0147` crossing 60 days, already surfaced) and 3 informational; 11 paper items reconciled against the readiness tracker so that drafting state is derived rather than reported; 14 items routed to the five role owners with the owner's own deadline attached; 8 closed with a reason; the blocking chain from `M01` refreshed. `L2` 9: each of the 19 committee items checked for whether the facts it depends on exist yet, returning 2 that do not; the `MSN-2026-0147` escalation rule text retrieved and applied to the 67-day age; the seven overdue Massnahmen re-split into dependency-blocked and not-started with the cause stated per item. `L5` 2: the committee readiness tracker updated with derived drafting states, and 14 routings recorded with their handoff records. Both released by her. `L3` 1: a prepared escalation note on `MSN-2026-0147` stating the age, the rule, the cause of delay and the two options (re-baseline with a root cause, or escalate to the entity board), **with no recommendation**.

**Evidence surfaced.** `MSN-2026-0147` full history including the 14.04.2026 extension approval and `EVD-2026-41205`, the unanswered UAT scheduling request. The escalation rule text. The committee readiness state per agenda item. The seven overdue Massnahmen with causes.

**Uncertainty disclosed.** "`MSN-2026-0147` is reported at 60% complete by its owner. The independently verifiable facts are: the supplier change was delivered to pre-production on 18.09.2026 (`EVD-2026-41102`), and the Arcadia UAT request of 22.09.2026 is unanswered (`EVD-2026-41205`). No evidence supports or contradicts the 60% figure. The delay cause is an infrastructure change freeze to 14.10.2026, which is verifiable and is outside the owner's control."

**Human choice.** Whether the `MSN-2026-0147` escalation note recommends re-baselining or board escalation. She writes neither into the note at this moment and carries the choice to `M06`. The distinction between dependency delay and neglect is doing the work here, and it is a judgment about a peer.

**State changes.** `SYS-0031`, group partition: committee readiness states updated against `CMT-NFR-2026-10`, accountable `P-001`. Fourteen handoff records created with source, target, object and deadline.

**Background reveal.** 32 actions (`L1` 21, `L2` 9, `L5` 2). 4 artefacts touched, 0 external. 0 awaiting release. 1 draft prepared, unaccepted.

---

## 5. `M03` 08:45 Evidence and workbench

**The moment.** The first moment in the day where the professional does professional work. Lane 2 has run ahead; lane 3 begins. The design test: the workbench must open onto a **formed picture**, not a search box. A practitioner who has to ask the product for evidence at 08:45 has been given a better filing cabinet, not a better job.

---

### `M03` tprm, `P-002`

**Today.** Opens the contract PDF, 84 pages, and scrolls to Appendix A3. Opens the Novalink register PDF in a second window. Compares two lists by eye, on two monitors, writing differences into a notepad. Opens `CTR-2023-0117-A7` to check whether the data-transfer appendix covers Pune, and cannot tell. Opens the DR test report `EVD-2026-40118` for the first time since June, finds the 3 hours 40 minutes on page 11 against the 2-hour contractual RTO, and realises it has been in the vault for 137 days. Elapsed: 60 to 90 minutes for a comparison a machine does in seconds, and the RTO finding is luck.

**Already done.** `L1` 4: the workbench opened on `TP-0042` with the divergence as the landing object; the `AG-…-04` paper deadline visible; two open chases shown inline. `L2` 31: Appendix A3 v4.2 and Register v6.1 reconciled node by node, producing the four-row divergence table from `DOC-SCENARIO-BIBLE` section 7.3 with each row's evidence attached; `TP-0042.4` Meridian's stated data-access scope extracted and checked against `CTR-2023-0117-A7` v2.2, which does not name Pune or India; `TP-0042.3-F1` Aurora identified from the Polaris Telemetrix sub-schedule and confirmed as outside the scope of Appendix A3 as drafted; `EVD-2026-40118` parsed, the 3 hours 40 minutes located against the contracted 2 hours, and the artefact's 137-day unescalated age computed; `EVD-2026-40233`'s scope statement extracted verbatim and shown to be silent on override APIs; the five services mapped to entities with per-entity classification and the `SVC-0042-03` inconsistency flagged; NOVA-GATE September availability recomputed with the maintenance-window assumption stated; the exit plan `CTR-2023-0117-A6` parsed against Arcadia's actual capability register, returning the dependency on a payment repair tool Arcadia does not hold; Appendix A3 clause 3.4's notice obligation extracted and Arcadia's contract repository searched for any Meridian notice, returning none. `L5` 3: the divergence table written to the `TP-0042` record, the `EVD-2026-40118` RTO gap raised as a reassessment finding against `TPRM-Q-2026-R07`, and the 137-day unescalated age recorded as a process observation. All released by him. `L3` 2: a prepared contractual sufficiency map with clause coverage per classification requirement and gaps marked undetermined; a prepared chain register with notice status per node.

**Evidence surfaced.** `CTR-2023-0117-A3` v4.2 (14.02.2025). Novalink Register v6.1 (03.08.2026). `CTR-2023-0117-A7` v2.2 (20.05.2025). `CTR-2023-0117-A6` v2.0 (01.09.2023). `EVD-2026-40118` (created 22.05.2026, retrieved 15.06.2026). `EVD-2026-40233` (30.06.2026). Appendix A3 clause 3.4. Arcadia capability register.

**Uncertainty disclosed.** "No Meridian notice exists in Arcadia's contract repository. This is evidence of absence in Arcadia's records, not proof that no notice was given. Notice could have been given to `P-010` commercially, or through the client portal, and not filed. The repository search covers the contract repository and the two shared mailboxes; it does not cover individual mailboxes." And: "Meridian's data-access scope is as stated by Novalink in the register. Arcadia has not verified it and has no mechanism to verify it without a supplier audit under `CTR-2023-0117-A4`."

**Human choice.** Whether to accept the prepared contractual sufficiency map's gap classifications. He accepts the map structure and overrides two gap classifications, moving the fourth-party item from "gap" to "drafting gap, no obligation breached" and the Amsterdam region from "gap" to "material change, notice required, not given". That distinction is the professional work of the morning and it is his to make.

**State changes.** `SYS-0031` third-party module, group partition: `TP-0042` divergence table written with 4 rows, accountable `P-002`, evidence `CTR-2023-0117-A3` v4.2 and Register v6.1. `TPRM-Q-2026-R07` finding raised with `EVD-2026-40118` referenced. Process observation recorded on the evidence handling of `EVD-2026-40118`, 137 days unescalated.

**Background reveal.** 38 actions (`L1` 4, `L2` 31, `L5` 3). 9 artefacts touched, 4 external. 0 awaiting release. 2 drafts prepared, 1 accepted with 2 overrides.

---

### `M03` rcsa, `P-003`

**Today.** Builds the pivot table she did not have time for at 07:45, if she has time now, which she usually does not because the workshop is at 10:30 and she is reading the pre-read. Opens `TST-2026-0318`'s report PDF and reads the four exceptions. Opens `CTL-PAY-021` and `CTL-PAY-029` to check what the compensating controls actually do, which requires reading two control descriptions carefully, which takes twenty minutes she has allocated to something else. Writes her residual reasoning into the pre-read by hand.

**Already done.** `L1` 3: the workbench opened on `RSK-0211` with three positions side by side; the 10:30 workshop 105 minutes away; `P-004`'s blocking conclusion shown as still open. `L2` 26: the `OVR-C` and `OVR-D` decomposition completed and linked to the five September activations with the 181-of-198 inside-window figure; `CTL-PAY-021` parsed and characterised as detective, next-business-day, 10% sampled, with the explicit statement that it cannot prevent a release; `CTL-PAY-029` parsed and characterised as reconciling value not authorisation, with the worked implication that a correctly-valued payment to a wrong beneficiary would pass it; `CTL-PAY-014` characterised as the only preventive control mapped to `RSK-0211`; the three Q4 residual positions (6, 9, 12) assembled with the appetite boundary at 10 and the consequence text for each side of it; the `RSK-0211` loss history retrieved with the detection-effectiveness caveat attached; the other ten workshop risks checked for material change, returning one; reviewer capacity reconciled to position `PR-SR-02` and `MSN-2026-0166`. `L5` 2: the compensating-control characterisations written to the `RSK-0211` control environment working note, and the `OVR-C` decomposition attached to the `KRI-PAY-007` breach record. Both released by her. `L3` 2: a prepared control environment rating worksheet with each mapped control characterised and the rating cell **empty**; a prepared workshop discussion structure that puts `RSK-0211` third rather than first, so the workshop reaches it with momentum and does not spend ninety minutes on it.

**Evidence surfaced.** `CTL-PAY-014` description v4.1. `CTL-PAY-021` and `CTL-PAY-029` descriptions. `TST-2026-0318` conclusion and the four exception records. The three residual positions with their dates and authors. `RSK-0211` loss register extract, 24 months, zero entries. The five September activation records.

**Uncertainty disclosed.** "The characterisation of `CTL-PAY-029` as unable to detect a wrong-beneficiary payment is derived from its control description, which reconciles payment value between `SYS-0011` and clearing confirmations. It has not been tested against that scenario. If the reconciliation includes beneficiary identifiers, the characterisation is wrong, and the control description does not say either way."

**Human choice.** Whether to accept the prepared workshop structure that defers `RSK-0211` to third position. She accepts it. This is a facilitation judgment with a real consequence: it means the ten other risks get assessed properly, at the cost of reaching the contested one with fifty minutes left instead of ninety.

**State changes.** `SYS-0031`, `ARC-DE` partition: control environment working note written against `RSK-0211` with three control characterisations, accountable `P-003`, evidence referenced. `KRI-PAY-007` breach record updated with the component decomposition.

**Background reveal.** 31 actions (`L1` 3, `L2` 26, `L5` 2). 7 artefacts touched, 0 external. 0 awaiting release. 2 drafts prepared, both accepted.

---

### `M03` control-assurance, `P-004`

**Today.** Opens the 60 sample sub-folders and re-checks the four exceptions and two unable-to-conclude items, one folder at a time, because the working papers are files and not a structure. Opens `SYS-0014`'s audit log export for `EXC-…-04`, a CSV, and looks at the `ruleEvaluationTrace` column, which contains a string he does not fully understand and which mentions `BCP-THROUGHPUT`. He noted it on 24.09.2026 and moved on. He has 45 minutes before the challenge meeting.

**Already done.** `L1` 3: the workbench opened on `TST-2026-0318` with the population waterfall as the landing object; the 10:30 challenge meeting with its evidence pack; the `AG-…-03` deadline. `L2` 38: the full 60 by 5 attribute matrix rendered with 296 pass, 4 fail and 2 unable-to-conclude in a distinct state; both deviation rates computed against the tolerable 5%; each exception's evidence chain assembled end to end (override record, rule trace, evidence object or its absence, reviewer identity, timestamps); `EXC-…-04`'s `ruleEvaluationTrace` parsed and the `reviewWaiverCode = BCP-THROUGHPUT` extracted and **named as a waiver rather than left as a string**; the `CTL-PAY-014` description v4.1 text "This applies to all overrides without exception" extracted verbatim and set against the waiver, producing an explicit description-versus-behaviour contradiction; the 27.08.2026 fallback window (15:22 to 17:05) retrieved and shown to contain the `EXC-…-04` override; the population's time-bounding surfaced against the waiver's condition-bounding, with the implication stated that the population's shape could not detect the pattern; `UTC-…-01`'s service account and expired log chain assembled with the expiry date; `UTC-…-02`'s broken link traced to the 01.09.2026 retention job; the three Q4 candidate controls from `M02` re-listed with their description text. `L5` 2: the description-versus-behaviour contradiction written as a working-paper finding against `TST-2026-0318`, and the population scope limitation written into the conclusion's limitation section. Both released by him. `L3` 3: a prepared design-versus-operating split with `EXC-…-04` now marked as **probable design, pending configuration**; a prepared limitation statement for the conclusion; a prepared configuration request under `CTR-2023-0117-A4` clause 2.1, addressed to Novalink, unsent.

**Evidence surfaced.** The 60 by 5 attribute matrix reconstructed from working papers. `EXC-…-04` override record with its full `ruleEvaluationTrace`. `EVD-2026-41908` description v4.1 with the verbatim "without exception" sentence. The 27.08.2026 fallback window record. `UTC-…-01` audit log with `svc_repairbatch` and the log expiry date. `UTC-…-02` broken link with the retention job date. `CTR-2023-0117-A4` clause 2.1.

**Uncertainty disclosed.** "`EXC-TST-2026-0318-04`'s rule trace contains `reviewWaiverCode = BCP-THROUGHPUT`, which indicates that a configured rule set `secondaryReviewRequired` to false. The rule itself has not been examined. Its conditions, its origin, whether it is Arcadia-configurable and how often it has fired are all unknown. The characterisation as a design deficiency is probable and unproven, and the configuration is obtainable under `CTR-2023-0117-A4` clause 2.1 within four hours."

That paragraph, at 08:45, is the whole day. It names the missing evidence, names the contractual route to obtain it, and states the four-hour service level. The product's most valuable single act is putting an unsent request on his screen seven hours before the event makes it urgent.

**Human choice.** Whether to send the configuration request to Novalink now, before the challenge meeting, or wait until after it. He sends it now, at 08:52, which is the best decision anyone makes on 06.10.2026. It arrives as `EVD-2026-41905` at 15:38, inside the four-hour window from a formal 15:12 escalation by `P-002` that references his 08:52 request. Irreversible in the sense that the request cannot be unasked, and it changes the day.

**State changes.** `SYS-0031`, group partition: working-paper finding written against `TST-2026-0318` recording the description-versus-behaviour contradiction, accountable `P-004`, evidence `EVD-2026-41908` and the `EXC-…-04` rule trace. Conclusion limitation section updated with the population scope statement. Configuration request logged as an outbound supplier request with the clause reference and the four-hour service level, accountable `P-004`.

**Background reveal.** 43 actions (`L1` 3, `L2` 38, `L5` 2). 8 artefacts touched, 3 external. 0 awaiting release. 3 drafts prepared, 2 accepted, 1 sent.

---

### `M03` incident-resilience, `P-005`

**Today.** Opens `RB-PAY-007`, a Word document, version 3.1, and reads section 4. Opens the control inventory in `SYS-0031` and searches for controls on `PRC-0041`, getting a list of 11. Reads three of them before running out of time. Opens `ITOL-0004-03` and reads the threshold. Opens the last severe-but-plausible test report from 18.11.2025 and confirms that it tested a NOVA-GATE total outage, not a fallback-mode operation. Working group at 10:30.

**Already done.** `L1` 4: the workbench opened on `IBS-0004` with the dependency map and the four tolerances; the 10:30 working group with its agenda; `MSN-2026-0188` and `MSN-2026-0177` shown with owners and ages. `L2` 22: `RB-PAY-007` section 4's assertion reconciled against all 11 controls on `PRC-0041`, returning `CTL-PAY-014` as conditional on system state and therefore contradicting the assertion; the 18.11.2025 test scope parsed and shown to have tested a total outage rather than fallback-mode operation, so the fallback path has never been exercised under observation; the five September activations aggregated with durations and triggers; `ITOL-0004-03`'s two measures separated and the absence of a precedence statement confirmed against the tolerance record and the `ARC-CH` Board Risk Committee minutes of 24.02.2026; `RB-PAY-011`'s 45-minute lead time extracted and checked against the 16:00 cut-off, producing a latest-start time of 15:15 on any day; the `ARC-CH` dependency chain traced to `TP-0042.1` Helvetia CloudWorks with `TPRM-Q-2026-R04` attached showing no DR evidence; the dependency map's depth assessed, returning that it terminates at `TP-0042` and does not include subprocessors. `L5` 2: the `RB-PAY-007` section 4 contradiction written as a resilience finding, and the fallback-path testing gap written against `KRI-RES-005`'s composition. Both released by her. `L3` 2: a prepared `AG-…-08` tolerance review with all four tolerances and their measures enumerated and the two-measure issue marked as an open question; a prepared dependency map extension request to `P-002` for subprocessor-level nodes.

**Evidence surfaced.** `RB-PAY-007` v3.1 section 4, verbatim. The 11 controls on `PRC-0041` with types and frequencies. The 18.11.2025 test report with its scope statement. `ITOL-0004-03` record and the 24.02.2026 committee minutes. `RB-PAY-011` with its lead time. `TPRM-Q-2026-R04`. The current `IBS-0004` dependency map with its terminal depth.

**Uncertainty disclosed.** "`ITOL-0004-03` contains two measures and neither the tolerance record nor the 24.02.2026 minutes state which governs on divergence. This is a definitional gap, not a breach. No divergence has been observed. If the two measures ever diverge, `ARC-CH` will be unable to state whether its tolerance was breached." And: "The dependency map for `IBS-0004` terminates at `TP-0042`. Subprocessor and fourth-party nodes are held in the third-party module and are not linked into the resilience map. A failure at a subprocessor would not be visible on this map."

Both disclosures are issued at 08:45. Both are exactly what happens at 13:31 and 16:04.

**Human choice.** Whether to raise the `ITOL-0004-03` two-measure gap as a finding now, or carry it to `AG-…-08` as an open question. She carries it as an open question, which is defensible: a definitional gap with no observed divergence is a weak finding and a reasonable agenda item. At 16:04 it becomes the day's most valuable finding, and the product should let her have been reasonable and slow rather than prescient.

**State changes.** `SYS-0031`, group partition: resilience finding written against `RB-PAY-007` recording the section 4 contradiction, accountable `P-005`, evidence the runbook text and the control inventory. `KRI-RES-005` composition annotated with the fallback-path testing gap for `IBS-0004`.

**Background reveal.** 28 actions (`L1` 4, `L2` 22, `L5` 2). 7 artefacts touched, 1 external. 0 awaiting release. 2 drafts prepared, both accepted.

---

### `M03` regulatory-change, `P-006`

**Today.** Opens the traceability spreadsheet, `Obligation-mapping-master-v22.xlsx`, 1,840 rows, 14 columns, two tabs for two lanes, maintained by him and one analyst. Filters for Tier 1 third-party obligations. Opens `REG-2026-0031`'s register extract in another window and compares by eye. Opens `CTR-2023-0117-A7` to see whether the data-transfer appendix names India. It does not. He writes a note. Forum at 10:30.

**Already done.** `L1` 3: the workbench opened on the dual-lane traceability map; both paper deadlines; the Forum at 10:30 with `P-015` confirmed. `L2` 29: the full obligation set rendered as a two-lane map with the separator enforced and 1,840 obligations in four terminal states; `REG-2026-0031`'s 94.6% decomposed to name the three Tier 1 records and the specific fields driving the shortfall, all subcontracting-chain fields; `TP-0042.4` Meridian mapped into the Swiss lane as a data-access obligation, moving it from unmapped to mapped-and-unevidenced; `CTR-2023-0117-A7` v2.2 parsed for named transfer destinations, returning Switzerland, Germany, Czech Republic and Ireland, and **not India**; `TP-0042.3-F1` Aurora in Dublin mapped and found to be covered by A7's Ireland reference but absent from Appendix A3, so it is a contractual chain gap rather than a transfer gap; `CTL-PAY-014` identified as a control serving obligations in both lanes and rendered once in the shared band with two separate evidence requirements; `REG-2026-0104`'s draft clauses reconciled against the four `IBS-0004` tolerances, returning `ITOL-0004-03` as the only two-measure tolerance and the draft as silent on precedence; the `SVC-0042-03` classification checked against its `PT-06` dependency and returned as inconsistent; the pulled-back digest item from `M02` assessed for Swiss-lane applicability and returned as applicable. `L5` 2: the Meridian data-access obligation written to `REG-2026-0088` as mapped-and-unevidenced, and the `SVC-0042-03` classification inconsistency written as an open question against `REG-2026-0031`. Both released by him. `L3` 2: prepared structures for both noting papers with entity scope on every node; a prepared consultation comment on `REG-2026-0104` regarding measure precedence, held as a draft with the note that it currently lacks a concrete case.

**Evidence surfaced.** The 1,840-obligation two-lane map with four terminal states. `REG-2026-0031` register extract with per-field completeness on three Tier 1 records. `CTR-2023-0117-A7` v2.2 with its named destinations. Novalink Register v6.1. `REG-2026-0104` draft v0.7 tolerance clauses. `ITOL-0004-03`. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "`CTR-2023-0117-A7` v2.2 names four transfer destinations and does not name India. Meridian is located in Pune and holds read access to payment metadata per the supplier's own register. Whether this constitutes a transfer outside the appendix's scope is a legal question requiring Group Legal input. Illustrative regulatory context, not legal advice." And: "The obligation set contains 1,840 rows maintained manually over three years. Completeness of the obligation set itself has not been independently verified. A missing obligation would not appear as a gap; it would not appear at all."

**Human choice.** Whether to send the `REG-2026-0104` consultation comment now, without a concrete case, or hold it. He holds it, which is the professionally normal choice. At 16:04 he gets the case with 17 days of window remaining and sends it at 16:47. The product should show the held draft persisting across the day, so that the 16:47 send is visibly the completion of an 08:45 thought.

**State changes.** `SYS-0031`, `ARC-CH` partition: data-access obligation written against `REG-2026-0088`, state mapped-and-unevidenced, accountable `P-006`, evidence Register v6.1 and `CTR-2023-0117-A7` v2.2, labelled illustrative regulatory context, not legal advice. `ARC-DE` and `ARC-AT` partitions: `SVC-0042-03` classification question opened against `REG-2026-0031`.

**Background reveal.** 34 actions (`L1` 3, `L2` 29, `L5` 2). 6 artefacts touched, 2 external. 0 awaiting release. 2 drafts prepared, 1 accepted, 1 held.

---

### `M03` nfr-governance, `P-001`

**Today.** Opens PowerPoint and starts the `AG-…-03` paper from last quarter's template. Realises she needs the control conclusion, which `P-004` has not settled, and the residual rating, which `P-003` will not have until after 12:00. Writes the sections she can. Opens the dashboard again and looks at four red rows and has the feeling that they are connected, which is not a governance artefact. Opens `MSN-2026-0147` and decides to think about it later.

**Already done.** `L1` 5: the workbench opened on `CMT-NFR-2026-10` with per-item readiness; the 08.10.2026 12:00 deadline with 2 business days; the two items whose facts do not yet exist flagged; the blocking chain refreshed showing `P-004` at 08:52 having sent a configuration request that could change `AG-…-03`. `L2` 24: the causal chain from `M01` re-rendered with each link's evidence and the two inferred links marked; each of the five decision items assessed for whether it asks one answerable question, returning three that do and two that ask for a discussion; the `RSK-0184` acceptance conditions re-checked, with `MSN-2026-0177` confirmed not started and the 31.12.2026 expiry 86 days away; the seven overdue Massnahmen's causes verified independently of owner status reports, returning 4 verifiably dependency-blocked and 3 with no verifiable activity; `MSN-2026-0203` identified as not started since 25.09.2026 and linked to `EXC-…-04`, which `P-004`'s 08:52 request is about, so the chain now connects her committee paper to an unsent supplier reply; prior-quarter committee decisions on `IBS-0004` retrieved to check for repetition, returning the 14.04.2026 `MSN-2026-0147` extension. `L5` 3: the causal chain written as a governance analysis object with its two inferred links declared; the `RSK-0184` acceptance condition status written to the acceptance record, which had held it in free text; the `MSN-2026-0147` escalation note filed as a draft against `AG-…-05`. All released by her. `L3` 2: a prepared `AG-…-03` paper with the divergence stated as two attributed positions and a blank recommendation; a prepared `AG-…-08` co-authoring structure with `P-005`.

**Evidence surfaced.** The causal chain object with six links, four evidenced and two inferred. `RSK-0184` acceptance record with conditions now structured. `MSN-2026-0147` history including `EVD-2026-41102` and `EVD-2026-41205`. `MSN-2026-0203` not started since 25.09.2026. The 14.04.2026 committee extension decision. Prior-quarter `IBS-0004` decisions.

**Uncertainty disclosed.** "Two of the causal chain's six links are inferential. The chain is a hypothesis and must be presented to the committee as one, with the inferred links visibly marked. Presenting it as established would be the more persuasive and less defensible choice." And: "Three of seven overdue Massnahmen show no verifiable activity. Absence of verifiable activity is not proof that no work occurred; it means no evidence of work exists in the systems of record, which is itself reportable."

**Human choice.** Whether to write `AG-…-03` as a decision paper on a divergence, or wait for `P-004`'s configuration request to land and risk missing the 08.10.2026 deadline. She writes it as a divergence paper and structures it so that new facts sharpen it rather than invalidate it. That structural choice at 08:45 is what makes `DEC-2026-0781` possible at 16:20, and the product should show the continuity.

**State changes.** `SYS-0031`, group partition: governance analysis object written with the seven-node causal chain and two declared inferred links, accountable `P-001`. `RSK-0184` acceptance record: condition status fields populated from free text, accountable `P-001`. `AG-…-05` escalation note filed as a draft.

**Background reveal.** 32 actions (`L1` 5, `L2` 24, `L5` 3). 6 artefacts touched, 0 external. 0 awaiting release. 2 drafts prepared, both accepted with blanks preserved.

---

## 6. `M04` 09:30 Asynchronous factual validation

**The moment.** The professional has a picture and needs specific facts confirmed by specific people. Today this is where days disappear: an email is sent, an answer arrives in two days, the question has moved on. The design test: every outbound question must be **answerable in one action by the recipient**, must carry the evidence the recipient needs, and must be tracked with an age and an escalation. A question without those three things is a delay dressed as diligence.

---

### `M04` tprm, `P-002`

**Today.** Writes four emails. One to `P-011` at Novalink about Meridian, which he rewrites twice because the tone matters and he does not want to assert a breach he has not confirmed. One to `P-016` in Group Legal asking which appendix version binds, a question with an obvious answer that he cannot answer himself. One to `P-010` asking whether he received any Meridian notice commercially. One to `P-007` about the `EVD-2026-40118` RTO gap. He will get two replies today and two next week, and the two he gets today will be the two he needed least.

**Already done.** `L1` 11: four outbound questions structured, each with the specific evidence the recipient needs attached, each answerable in one action; the `P-016` question reduced to a single binary with both candidate versions attached; the `P-010` question framed as a records check with the date range and the appendix clause attached; the `P-011` question drafted with the register row and the clause 3.4 text, deliberately framed as a records reconciliation rather than as an assertion, held for his release; each question given an age target and an escalation path; three earlier chases re-aged, with the `R19` escalation to `P-011` now 1 day old. `L2` 19: Arcadia's contract repository, both shared mailboxes and `P-010`'s filed correspondence searched for any Meridian notice, returning none and stating the search scope; the binding-version question pre-answered from the repository's own version control (v4.2 is marked binding) so that `P-016`'s reply will confirm rather than determine; the `EVD-2026-40118` RTO gap quantified at 1 hour 40 minutes with the contractual RTO clause attached; Novalink's register publication history checked, showing v6.1 published 03.08.2026 and v5.0 published 11.09.2025, establishing that the portal is used and that Arcadia has not monitored it; the concentration position recomputed across the five services and three entities. `L5` 4: the three non-supplier questions released and logged; the `R19` escalation logged; the search scope recorded as evidence of the absence of notice; the register publication history attached to the `TP-0042` record. `L3` 1: a prepared supplier question to `P-011` in a records-reconciliation register, unreleased.

**Evidence surfaced.** Repository and mailbox search scope with a nil return on Meridian notice. Repository version control showing `A3` v4.2 as binding. Novalink register publication history (v5.0 11.09.2025, v6.1 03.08.2026). `CTR-2023-0117-A1` RTO clause against `EVD-2026-40118`. Concentration position across five services.

**Uncertainty disclosed.** "The nil return on Meridian notice covers the contract repository, `payments-supplier@arcadia.example` and `procurement-payments@arcadia.example`, and `P-010`'s filed correspondence. It does not cover individual mailboxes or verbal notice. The conclusion is that no notice is on record, which is not the same as no notice having been given."

**Human choice.** Whether to send the `P-011` question as a records reconciliation or as an assertion that clause 3.4 has been breached. He sends the reconciliation. The reasoning is commercial and professional: the relationship has 23 months left on its initial term, Arcadia has a 12-month notice period, and an unjustified breach assertion would harden a supplier he needs cooperative for a reassessment due in 25 days. Reversible, and he keeps the assertion available.

**State changes.** `SYS-0031` third-party module, group partition: search scope recorded as evidence against the Meridian notice question, accountable `P-002`. Register publication history attached to `TP-0042`. Four outbound questions logged with ages, targets and escalation paths.

**Background reveal.** 34 actions (`L1` 11, `L2` 19, `L5` 4). 6 artefacts touched, 2 external. 1 awaiting release (the `P-011` question, released at 09:41). 1 draft prepared, accepted.

---

### `M04` rcsa, `P-003`

**Today.** Calls `P-007` to ask whether he knows why `OVR-C` jumped, and gets a plausible answer about NOVA-GATE being flaky, which she cannot verify. Emails `P-004` to ask whether the exceptions relate to the fallback periods, a question he cannot answer because his population is time-bounded. Messages `P-008` to check she is attending at 10:30. Fifty minutes, three questions, no confirmed facts.

**Already done.** `L1` 9: three outbound questions structured; the `P-007` question reframed from "why did `OVR-C` jump" (unanswerable) to "confirm that these five fallback windows are complete and that the 17 `OVR-C` overrides outside them have another cause" (answerable in one action, with the window list and the 17 override identifiers attached); the `P-004` question replaced, since the product already links `EXC-…-04` to the 27.08.2026 window, and reduced to "confirm your population excluded prior fallback windows"; `P-008`'s attendance confirmed without a message; the workshop 60 minutes away with the accepted structure loaded; `DEC-2026-0771` prepared as a decision record shell for 09:58. `L2` 13: the five September fallback windows cross-checked against all 198 `OVR-C` overrides, confirming 181 inside and identifying the 17 outside with their timestamps and reason codes; those 17 checked for a common cause, returning 11 on a single afternoon (23.09.2026) with no recorded fallback activation, which is a new open question; `EXC-…-04`'s 27.08.2026 window confirmed as a sixth activation outside the September set, making six known activations in the test period and September combined; `KRI-PAY-011`'s reviewer capacity checked against the deviation dates, returning no direct link and stating so. `L5` 3: the 17-override anomaly written as an open question against `KRI-PAY-007`; the 23.09.2026 cluster logged; `DEC-2026-0771` recorded at 09:58 with its authority basis. All released by her. `L3` 1: a prepared 1LoD explanation request for `KRI-PAY-007` framed as one causal investigation rather than three indicator explanations.

**Evidence surfaced.** The 198 `OVR-C` overrides mapped against six known fallback windows. The 17 outside-window overrides with timestamps. The 23.09.2026 cluster of 11. `EXC-…-04`'s 27.08.2026 window. Reviewer capacity against deviation dates, nil link.

**Uncertainty disclosed.** "Eleven `OVR-C` overrides occurred on the afternoon of 23.09.2026 with no fallback activation recorded. Either an activation occurred and was not logged, or these overrides have a different cause. This cannot be resolved from Arcadia data and requires `P-007`'s confirmation. It does not affect the `OVR-C` conclusion, which rests on 181 of 198, but an unlogged activation would be a separate control issue."

**Human choice.** Whether to raise the 23.09.2026 cluster now, which opens a second front on the same day as a contested workshop, or log it and pursue it after. She logs it. `DEC-2026-0771` is taken at 09:58: one causal investigation rather than three explanations, on her 2LoD analysis mandate. Reversible.

**State changes.** `SYS-0031`, `ARC-DE` partition: open question written against `KRI-PAY-007` on the 17 outside-window overrides, accountable `P-003`, evidence the override mapping. `DEC-2026-0771` recorded with maker, authority basis, facts relied on and reversibility.

**Background reveal.** 25 actions (`L1` 9, `L2` 13, `L5` 3). 5 artefacts touched, 0 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M04` control-assurance, `P-004`

**Today.** Has already sent the configuration request at 08:52, which on a normal day he would not have sent at all. Now emails Novalink support about `UTC-…-02` to ask whether the 10.10.2026 restore is firm. Emails `P-008` to confirm the 10:30 agenda. Re-reads the four exceptions a third time. Waits.

**Already done.** `L1` 8: the 08:52 configuration request tracked against the four-hour service level in `CTR-2023-0117-A4` clause 2.1, with the service level shown as breached at 12:52 if unanswered and an escalation path to `P-002` prepared; the `UTC-…-02` question structured as a single binary with the 22.09.2026 acknowledgement attached; `P-008`'s agenda confirmed without a message; the 10:30 challenge meeting loaded with its evidence pack and the exception records; the three Q4 candidate controls queued for the test plan discussion. `L2` 21: each exception's root cause re-derived from its evidence chain rather than from his own notes, returning three operating and one probable design; `EXC-…-01` checked against `MSN-2026-0147`'s scope, confirming that the Massnahme would have prevented it and that the exception occurred 17 days before the revised due date; `EXC-…-02`'s 11 minute 19 second sequence gap recomputed from the raw timestamps; `EXC-…-03`'s reviewer interview note of 16.09.2026 retrieved with the "well known in the team" statement attributed; `UTC-…-01`'s bulk approval screen checked for usage frequency, returning routine rather than exceptional use across the test period; the `P-008` counter-position's three-line rationale parsed into three separate assertions, each checkable, of which two are checkable today. `L5` 3: the re-derived root causes written to the working papers; the `EXC-…-01` and `MSN-2026-0147` link written as a finding; the `UTC-…-01` bulk-screen usage frequency recorded. All released by him. `L3` 2: a prepared challenge-meeting position separating what he will concede from what he will hold; a prepared escalation to `P-002` for the configuration request, unsent, timed for 12:52.

**Evidence surfaced.** Four exception evidence chains, re-derived. `MSN-2026-0147` scope against `EXC-…-01`. Raw release and review timestamps for `EXC-…-02`. The 16.09.2026 reviewer interview note. `UTC-…-01` bulk screen usage frequency. `P-008`'s rationale parsed into three assertions.

**Uncertainty disclosed.** "`P-008`'s rationale contains three assertions: that the exceptions caused no financial loss, that all four payments were confirmed correct by clients, and that `EXC-…-04` was the system behaving as configured. The first two are checkable and are supported by the loss register and the client confirmation records. The third is checkable only against the configuration, which has been requested and not received. Two of her three assertions are currently correct."

**Human choice.** Whether to go into the challenge meeting with a position that concedes two of `P-008`'s three assertions. He does, and it changes the meeting from a defence into a narrowing. Conceding what is true is the professional instrument here, and it is why the 16:41 outcome is achievable at all.

**State changes.** `SYS-0031`, group partition: re-derived root causes written to `TST-2026-0318` working papers, accountable `P-004`. Finding written linking `EXC-…-01` to `MSN-2026-0147` with the 17-day interval. `UTC-…-01` usage frequency recorded as evidence.

**Background reveal.** 32 actions (`L1` 8, `L2` 21, `L5` 3). 6 artefacts touched, 2 external. 1 awaiting release (the 12:52 escalation, unsent). 2 drafts prepared, 1 accepted, 1 held.

---

### `M04` incident-resilience, `P-005`

**Today.** Emails `P-002` about `MSN-2026-0188` and the Swiss DR evidence, which is her third email on the subject. Emails `P-015` in Zurich asking whether `ARC-CH` has any fallback for euroSIC, a question she believes she knows the answer to and has never confirmed in writing. Emails the `ARC-DE` payment operations mailbox asking whether fallback activations are logged anywhere she can see. Working group in 60 minutes.

**Already done.** `L1` 10: three outbound questions structured; the `P-002` question replaced by a live dependency link, since `MSN-2026-0188` status, owner and the underlying `TPRM-Q-2026-R04` are already on her screen; the `P-015` question reframed from "is there a fallback" to "confirm that `RB-PAY-011` manual correspondent submission is the only `ARC-CH` option and that the 45-minute lead time is current", answerable in one action; the payment operations question answered from `SYS-0014`'s configuration audit log, which logs every `fallbackRouteMode` change and which she did not know existed; the working group loaded with its agenda and the two `M03` findings. `L2` 14: `SYS-0014`'s configuration audit log queried for all `fallbackRouteMode` changes, returning the five September activations plus the 27.08.2026 window plus one on 23.09.2026 **that was not in the September operations report**, which independently confirms `P-003`'s 23.09.2026 anomaly from a different direction; the 23.09.2026 activation's 11 `OVR-C` overrides linked; `RB-PAY-011`'s lead time checked against its last review date, 14.01.2026, and against any recorded rehearsal, returning none; `ITOL-0004-03`'s latest-start time recomputed at 15:15 for a 16:00 cut-off; the `ARC-CH` dependency chain to `TP-0042.1` re-checked for DR evidence, nil. `L5` 3: the previously unreported 23.09.2026 activation written as a finding against `RB-PAY-007` governance; the configuration audit log registered as an authoritative source for activation events; the `RB-PAY-011` never-rehearsed status written against `KRI-RES-005`. All released by her. `L3` 1: a prepared working group paper on fallback governance covering the unlogged activation and the untested path.

**Evidence surfaced.** `SYS-0014` configuration audit log, all `fallbackRouteMode` changes, returning seven windows including one not in operations reporting. The September operations report by contrast. `RB-PAY-011` with its 14.01.2026 review date and nil rehearsal record. `ITOL-0004-03` latest-start computation. `TPRM-Q-2026-R04`.

**Uncertainty disclosed.** "The `SYS-0014` configuration audit log shows a `fallbackRouteMode = ACTIVE` window on 23.09.2026 that does not appear in the September payment operations report. Either the operations report is incomplete or the configuration change was made without invoking `RB-PAY-007`. These have different implications and the log alone cannot distinguish them."

**Human choice.** Whether to raise the unlogged 23.09.2026 activation at the 10:30 working group, where `P-007`'s team is represented, or handle it bilaterally first. She raises it at the working group, on the basis that a fallback activated outside its runbook is a governance issue rather than an operational error and belongs in a forum. Reversible, and it costs her some goodwill in Munich.

**State changes.** `SYS-0031`, group partition: finding written against `RB-PAY-007` on the unreported 23.09.2026 activation, accountable `P-005`, evidence the configuration audit log extract. `SYS-0014` configuration audit log registered as an authoritative source for activation events, with an owner. `KRI-RES-005` annotated with the `RB-PAY-011` nil-rehearsal status.

**Background reveal.** 27 actions (`L1` 10, `L2` 14, `L5` 3). 5 artefacts touched, 1 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M04` regulatory-change, `P-006`

**Today.** Emails Group Legal about whether Pune is within `CTR-2023-0117-A7`'s scope, and knows he will not get an answer before the Forum. Emails `P-015` to check whether the `ARC-CH` outsourcing inventory has been filed locally this quarter. Emails `P-002` asking for the Meridian data-access scope, which `P-002` does not have either.

**Already done.** `L1` 7: three outbound questions structured; the Legal question reduced to a single scope question with `A7` v2.2's destination list and the register row attached, and routed to `P-016` specifically rather than to a Legal mailbox; the `P-015` question answered from the `ARC-CH` inventory record, which shows a 24.07.2026 filing, removing the need to ask; the `P-002` question reframed from "what is the access scope" to "confirm that the only source for Meridian's access scope is the supplier's own register", which is answerable and which is the real question; the Forum in 60 minutes with `P-015` confirmed. `L2` 11: the `ARC-CH` inventory record retrieved with its 24.07.2026 filing and checked against the current service list, returning Meridian as absent from the filed inventory; the filing date set against Meridian's 01.05.2026 onboarding, establishing that the inventory was filed 84 days after the subprocessor was onboarded and does not contain it; `A7` v2.2's destination list re-checked; the pulled-back digest item from `M02` mapped into both lanes with separate applicability; `REG-2026-0104`'s consultation window confirmed as open to 23.10.2026, 17 days. `L5` 2: the inventory gap written as an open item against `REG-2026-0088`; the pulled-back digest item's dual-lane applicability recorded. Both released by him. `L3` 1: a prepared `AG-…-07` noting paper with the inventory gap included.

**Evidence surfaced.** `ARC-CH` outsourcing inventory as filed 24.07.2026, without Meridian. Meridian's 01.05.2026 onboarding date from Register v6.1. `CTR-2023-0117-A7` v2.2 destinations. `REG-2026-0104` consultation window. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "The `ARC-CH` outsourcing inventory filed on 24.07.2026 does not contain Meridian, which the supplier's register shows as onboarded on 01.05.2026. Whether the inventory should contain a subprocessor of a significant outsourcing depends on the inventory's defined scope, which this system has read and which is ambiguous on subcontracting depth. The observation is factual; its consequence is a matter for interpretation and for Group Legal. Illustrative regulatory context, not legal advice."

**Human choice.** Whether to characterise the inventory gap as a filing deficiency or as an inventory-scope definition question. He chooses the second, which is both more honest and less alarming, and which puts the burden on Arcadia's own standard rather than on the person who filed it. Reversible.

**State changes.** `SYS-0031`, `ARC-CH` partition: open item written against `REG-2026-0088` on the inventory scope question, accountable `P-006`, evidence the filed inventory and Register v6.1, labelled illustrative regulatory context, not legal advice. Dual-lane applicability recorded for the pulled-back digest item.

**Background reveal.** 20 actions (`L1` 7, `L2` 11, `L5` 2). 5 artefacts touched, 2 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M04` nfr-governance, `P-001`

**Today.** Emails `P-007` about `MSN-2026-0147`, carefully, because he is a peer and the message will be read by others. Emails `P-004` and `P-003` asking whether they can give her a joint position by Thursday. Emails the committee secretariat about agenda timing. Then starts the `AG-…-05` paper.

**Already done.** `L1` 12: three outbound questions structured; the `P-007` question built around verifiable facts (delivery 18.09.2026, UAT request unanswered since 22.09.2026, freeze to 14.10.2026) and framed as a re-baselining question rather than a performance question, which is the difference between a useful reply and a defensive one; the `P-004` and `P-003` question replaced with a live readiness view showing both their states and the dependency between them; the secretariat question answered from the agenda record; `AG-…-05` loaded with the escalation note from `M03`; the 08.10.2026 12:00 deadline at 2 business days; the two items whose facts do not exist yet flagged with what is missing. `L2` 15: `MSN-2026-0147`'s dependency chain verified end to end (Novalink delivery, Arcadia UAT, infrastructure freeze), with the freeze's 14.10.2026 end date confirmed from the change record and the implication stated that the Massnahme cannot close before then whatever anyone commits to; the three not-started Massnahmen checked for a common owner or cause, returning no common owner and two with the same blocking dependency; `P-004`'s 08:52 configuration request identified as a fact-arrival dependency for `AG-…-03` with a four-hour service level, giving a 12:52 expectation; the prior-quarter extension decision of 14.04.2026 retrieved with its stated conditions, of which one (a monthly progress report to the committee) has not been met since July. `L5` 4: the verified dependency chain written to `MSN-2026-0147`; the unmet extension condition written as a finding against the 14.04.2026 decision; the `AG-…-03` fact-arrival dependency registered with its 12:52 expectation; the three outbound questions logged. All released by her. `L3` 1: a prepared `AG-…-05` paper with both options stated (re-baseline with root cause, escalate to entity board) and no recommendation.

**Evidence surfaced.** `MSN-2026-0147` dependency chain with `EVD-2026-41102`, `EVD-2026-41205` and the freeze change record. The 14.04.2026 extension decision with its monthly reporting condition, unmet since July. The three not-started Massnahmen with causes. `P-004`'s configuration request with its service level.

**Uncertainty disclosed.** "`MSN-2026-0147` cannot close before 14.10.2026 because the UAT environment is frozen until that date. Any commitment to an earlier date would be unachievable on current facts. This is a statement about the dependency, not about the owner's intent or capability." And: "The 14.04.2026 extension was granted on a condition of monthly progress reporting to the committee. No report has been made since July 2026. This is a governance failure in the committee's own follow-up, not only in the owner's delivery."

That second disclosure is the one that costs her something. The unmet condition is her machinery's failure, and surfacing it is a choice.

**Human choice.** Whether to include the committee's own unmet follow-up condition in `AG-…-05`. She includes it. The reasoning is that a paper that reports an owner's delay while concealing the committee's own lapsed condition is not a governance paper, and that the chair will find out. Reversible in principle, not in practice.

**State changes.** `SYS-0031`, group partition: verified dependency chain written to `MSN-2026-0147` with the 14.10.2026 constraint, accountable `P-001`. Finding written against the 14.04.2026 committee decision on the unmet monthly reporting condition. `AG-…-03` fact-arrival dependency registered with a 12:52 expectation. Three outbound questions logged with ages.

**Background reveal.** 31 actions (`L1` 12, `L2` 15, `L5` 4). 5 artefacts touched, 0 external. 0 awaiting release. 1 draft prepared, accepted with the recommendation left blank.

---

## 7. `M05` 10:30 Function-specific meeting or workshop

**The moment.** Six different meetings, one time slot. The design test: the product's contribution is **not** a summary afterwards. It is that the meeting starts from a shared, evidenced picture and that the disagreements in the room are about judgment rather than about facts. A meeting that spends its first twenty minutes establishing what is true has been failed by its preparation.

| Role | Meeting | Time | Attendees |
|---|---|---|---|
| `tprm` | Novalink monthly service and governance review | 10:30 to 11:30 | `P-002`, `P-010`, `P-011`, `P-007` |
| `rcsa` | `RCSA-ARC-DE-PAYOPS-2026-Q4` workshop | 10:30 to 12:00, Munich and video | `P-003`, `P-007`, `P-008`, `P-009`, `P-004` (observer from 11:15), 4 team leads |
| `control-assurance` | Control owner challenge meeting | 10:30 to 11:15 | `P-004`, `P-008`, `P-007` |
| `incident-resilience` | Operational Resilience Working Group | 10:30 to 11:30 | `P-005`, `P-015`, Technology, Payment Operations, `ARC-AT` representative |
| `regulatory-change` | Regulatory Change Forum, dual lane | 10:30 to 11:30 | `P-006`, `P-015` (Swiss lane), `P-002`, Legal representative |
| `nfr-governance` | Committee paper pre-review with the Group CRO | 10:30 to 11:15 | `P-001`, `P-013` |

---

### `M05` tprm, `P-002`

**Today.** Joins a call with a supplier who has prepared a deck. Novalink presents green service levels and reassessment progress. He has four open questions in a spreadsheet and raises three, gets two deferrals and one "we will come back to you", and the fourth he forgets. The minutes are written by Novalink.

**Already done.** `L1` 8: the meeting pack assembled from live objects rather than from a supplier deck, containing the four open resilience questions with their evidence, the divergence table, the calculated availability figure and the `R19` escalation; each item given an ask and a required-by date so the meeting produces commitments rather than discussion; the previous month's commitments retrieved with their status, returning 3 of 5 unmet; an Arcadia-side minute structure prepared. `L2` 6: Novalink's presented availability figure (99.74%, from their deck circulated at 09:15) reconciled against Arcadia's calculated 99.62%, localising the 0.12 point difference to the treatment of the 11.09.2026 maintenance overrun; the 3 unmet prior commitments dated and aged; the `R19` scope silence restated verbatim. `L5` 3: the availability reconciliation written to `TP-0042`; the 3 unmet commitments logged with ages; the Arcadia minute record opened. All released by him. `L3` 1: a prepared negotiation sequence for the four open questions, ordering them so that the two Novalink can concede cheaply come first.

**Evidence surfaced.** Novalink's 09:15 deck with 99.74% availability. Arcadia's calculated 99.62% with the maintenance-window assumption. The 11.09.2026 overrun record. Three unmet prior commitments with dates. `EVD-2026-40233` scope statement. The divergence table.

**Uncertainty disclosed.** "The 0.12 percentage point difference between Novalink's 99.74% and Arcadia's 99.62% is fully explained by the treatment of the 11.09.2026 maintenance overrun of 2 hours 5 minutes. Novalink appears to treat the whole window as planned maintenance; Arcadia's calculation treats the overrun portion as unplanned. `CTR-2023-0117-A1` does not define the treatment of a maintenance overrun. Neither figure is wrong under the contract as drafted."

**Human choice.** Whether to contest the availability figure in the meeting. He raises it as a definitional gap rather than a dispute, and asks for the overrun treatment to be agreed in writing. That converts an argument nobody can win into a contract variation nobody can refuse. Reversible.

**State changes.** `SYS-0031`, group partition: availability reconciliation written to `TP-0042` with both figures and the explaining assumption, accountable `P-002`. Three unmet prior commitments logged with ages. Arcadia-authored minute record opened against the meeting, with one new commitment recorded (overrun treatment to be agreed by 20.10.2026).

**Background reveal.** 17 actions (`L1` 8, `L2` 6, `L5` 3). 6 artefacts touched, 2 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M05` rcsa, `P-003`

**Today.** Runs a 90-minute workshop from a PowerPoint deck and a spreadsheet. Spends the first 25 minutes establishing what the control test found, because `P-008` and `P-007` have read the report differently. Reaches `RSK-0211` at 11:20 with 40 minutes left and a room that has already decided. Nods through the other ten risks in the last 15 minutes. Leaves without an agreed rating.

**Already done.** `L1` 11: the workshop loaded with the accepted structure placing `RSK-0211` third; the 11 risks each with current position, proposed position and any change since the pre-read; attendance and the 11:15 arrival of `P-004` as observer; the four blank reason-code records held out of the agenda per her `M02` choice; a live decision-capture structure with the dissent clause available; the 23.09.2026 open question held. `L2` 9: the four established facts loaded as facts so the first 25 minutes are not spent on them (population 1,204, sample 60, 4 exceptions, 2 unable to conclude, two deviation rates with the tolerable rate); `P-008`'s three assertions loaded with the finding from `M04` that two of three are currently correct; the three control characterisations loaded; the appetite boundary and both consequence texts loaded. `L5` 5: the ten uncontested risk positions recorded as agreed as the workshop passes them; the `RSK-0211` discussion recorded with both positions attributed; the dissent structure prepared. All released by her as the meeting proceeds. `L3` 2: a prepared residual worksheet with blank residual cells; a prepared dissent record structure with both positions and no adjudication.

**Evidence surfaced.** `TST-2026-0318` population, sample and results as established facts. `P-008`'s three assertions with two confirmed correct. The three control characterisations. The appetite boundary at 10 with both consequences. The six known fallback windows.

**Uncertainty disclosed.** "The residual rating gap between 9 and 12 turns on one question: whether two detective compensating controls can substitute for a Partially Effective preventive control. This system has characterised the three controls and cannot resolve the question, because it is a judgment about sufficiency. Both positions are internally consistent."

**Human choice.** Whether to force a rating or record a dissent. She records a dissent at 11:58 as `DEC-2026-0772`, with both positions stated in their owners' terms, and escalates to `CMT-NFR-2026-10`. The choice costs her a resolved workshop and buys the committee a real decision. Superseded at 16:41 by `DEC-2026-0783`, which the product must show as a supersession with history, not as a correction.

**State changes.** `SYS-0031`, `ARC-DE` partition: ten risk positions recorded as agreed against `RCSA-ARC-DE-PAYOPS-2026-Q4`, accountable `P-007` with `P-003` as facilitator. `RSK-0211` recorded as unagreed with two attributed positions. `DEC-2026-0772` recorded at 11:58 with maker, authority basis, both positions and the escalation destination.

**Background reveal.** 25 actions (`L1` 11, `L2` 9, `L5` 5). 5 artefacts touched, 0 external. 0 awaiting release. 2 drafts prepared, both accepted with residual cells left blank.

---

### `M05` control-assurance, `P-004`

**Today.** Meets `P-008` and `P-007` in a room with a printed report. `P-008` restates her position. He restates his. They disagree for 40 minutes about whether four exceptions in 60 samples is material, which is not the question. He leaves with the disagreement unchanged and joins the RCSA workshop as an observer at 11:15.

**Already done.** `L1` 5: the meeting loaded with the exception records and `P-008`'s three assertions; his `M04` position separating concessions from holds; the 08:52 configuration request tracked with a 12:52 service level; the 11:15 RCSA observer slot; the three Q4 candidate controls queued. `L2` 7: `P-008`'s assertions one and two confirmed correct from the loss register and client confirmation records, so the meeting can start from agreement rather than from confrontation; assertion three identified as unresolvable today pending configuration; the `EXC-…-01` to `MSN-2026-0147` link loaded with the 17-day interval; the design-versus-operating distinction loaded as the frame for the meeting, replacing materiality as the topic. `L5` 2: the meeting record opened with the two conceded assertions recorded as agreed; the third recorded as pending evidence with its expected arrival. Both released by him. `L3` 1: a prepared joint position structure with three fields (agreed, disagreed, pending evidence).

**Evidence surfaced.** Loss register, nil on `RSK-0211` over 24 months. Client confirmation records for all four exception payments. `MSN-2026-0147` scope against `EXC-…-01`. The 16.09.2026 reviewer interview note. The configuration request with its 12:52 service level.

**Uncertainty disclosed.** "Assertion three, that `EXC-…-04` was the system behaving as configured, cannot be resolved without the tenant configuration. The configuration has been requested under `CTR-2023-0117-A4` clause 2.1, which carries a four-hour service level from 08:52. If the assertion is correct, the deficiency is design rather than operating, and `P-008`'s characterisation of that exception is right."

**Human choice.** Whether to reframe the meeting from materiality to the design-versus-operating distinction. He does, and it is the professional move of the morning. Conceding two assertions and naming the third as pending evidence converts a 40-minute argument into a 20-minute narrowing and a shared waiting position. The 16:41 resolution is built on this meeting, not on the 15:38 evidence.

**State changes.** `SYS-0031`, group partition: challenge meeting record written against `TST-2026-0318` with two assertions agreed, one pending evidence and the design-versus-operating frame recorded, accountable `P-004` with `P-008` as control owner. `P-008`'s position record annotated with the two confirmations.

**Background reveal.** 14 actions (`L1` 5, `L2` 7, `L5` 2). 5 artefacts touched, 0 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M05` incident-resilience, `P-005`

**Today.** Chairs a working group across three entities on a video call. Runs through a status deck. `KRI-RES-005` is discussed as a percentage. The `IBS-0004` testing gap is noted. Nobody raises `RB-PAY-007` section 4 because nobody has read it against the control inventory. The 23.09.2026 unlogged activation is not in the deck because it is not in the operations report.

**Already done.** `L1` 6: the working group loaded with her two `M03` findings and her `M04` finding; `KRI-RES-005` decomposed to name `IBS-0004`; the agenda structured so that the `AG-…-08` tolerance review is discussed before the status items, since it carries a deadline; `P-015` confirmed for the `ARC-CH` position; the unlogged 23.09.2026 activation placed on the agenda. `L2` 8: the `RB-PAY-007` section 4 contradiction loaded with the control inventory reconciliation; the fallback path's nil-test status loaded against the 18.11.2025 test scope; the seven activation windows from the configuration audit log loaded, including the unreported one; `RB-PAY-011`'s nil-rehearsal status and 45-minute lead time loaded with the 15:15 latest-start computation; the four `IBS-0004` tolerances loaded with their measures enumerated and `ITOL-0004-03`'s two measures separated. `L5` 2: the working group record opened; the unlogged activation raised formally with `P-007`'s representative acknowledging it. Both released by her. `L3` 1: a prepared `AG-…-08` paper with the tolerance measures enumerated and the two-measure issue as an open question.

**Evidence surfaced.** `RB-PAY-007` v3.1 section 4 against 11 controls on `PRC-0041`. The 18.11.2025 test scope. Seven activation windows from the `SYS-0014` configuration audit log against the September operations report. `RB-PAY-011` with nil rehearsal. Four tolerance records with measures enumerated.

**Uncertainty disclosed.** "`ITOL-0004-03` has two measures with no stated precedence. No divergence has been observed. The working group is being asked to decide whether to recommend a precedence to the committee or to treat the question as theoretical." And: "The 23.09.2026 activation appears in the configuration audit log and not in operations reporting. Payment Operations has acknowledged it in this meeting and states it was a brief technical test. That statement is not verified."

**Human choice.** Whether to recommend a tolerance precedence to `AG-…-08` on a theoretical ambiguity, which invites the response that it is not a real problem. She decides to carry it as an open question rather than a recommendation. Defensible, and five and a half hours later it becomes the day's most valuable finding. The product must not make her look foolish for this; it must show that a reasonable professional judgment was overtaken by an event.

**State changes.** `SYS-0031`, group partition: working group record written with the unlogged activation raised and acknowledged, accountable `P-005`. `RB-PAY-007` finding updated with the acknowledgement. `AG-…-08` draft paper attached with the tolerance measures enumerated.

**Background reveal.** 16 actions (`L1` 6, `L2` 8, `L5` 2). 5 artefacts touched, 0 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M05` regulatory-change, `P-006`

**Today.** Runs a forum where the EU and Swiss lanes are two tabs in one spreadsheet, which is how category errors happen. Discusses `REG-2026-0031` completeness as a percentage. Raises the Meridian question and gets a discussion about whether it is a TPRM issue or a compliance issue, which is the wrong question because it is both, in two jurisdictions, differently.

**Already done.** `L1` 5: the forum loaded with the dual-lane map and the separator enforced in the presented view; both paper deadlines; `P-015` confirmed; the pulled-back digest item and the inventory scope question on the agenda. `L2` 6: `REG-2026-0031`'s shortfall decomposed to three named Tier 1 records and their specific fields; the Meridian question rendered **twice**, once in each lane, with different obligations and different evidence requirements, which is the view that prevents the meeting's wrong question; the `ARC-CH` inventory scope ambiguity loaded with the standard's text; `CTL-PAY-014` rendered once in the shared band with two separate evidence requirements. `L5` 2: the forum record opened; the Meridian question formally split into two tracked obligations, one per lane, replacing a single ambiguous item. Both released by him. `L3` 1: a prepared `AG-…-06` noting paper with the four-state decomposition replacing the single percentage.

**Evidence surfaced.** The dual-lane map with the enforced separator. `REG-2026-0031` shortfall on three named records. The Meridian question in both lanes with separate obligations. The `ARC-CH` inventory standard text with its ambiguity. `CTL-PAY-014` as a shared-band control. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "The Meridian arrangement creates obligations in both lanes. Satisfying the EU-lane register obligation would not satisfy the Swiss-lane inventory and data-access obligation, and the converse also holds. Illustrative regulatory context, not legal advice. Whether either obligation is currently unmet is a matter for interpretation with Group Legal and is not determined here."

**Human choice.** Whether to present `REG-2026-0031` to the committee as 94.6% complete, which is accurate and misleading, or as a four-state decomposition, which is accurate and uncomfortable. He chooses the decomposition. A noting item that conceals a structural gap behind a good percentage is the failure mode his role exists to prevent.

**State changes.** `SYS-0031`: one obligation tracked against `REG-2026-0031` in the `ARC-DE` and `ARC-AT` partitions and one against `REG-2026-0088` in the `ARC-CH` partition, replacing a single ambiguous item, accountable `P-006`, both labelled illustrative regulatory context, not legal advice. Forum record written.

**Background reveal.** 13 actions (`L1` 5, `L2` 6, `L5` 2). 5 artefacts touched, 1 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M05` nfr-governance, `P-001`

**Today.** Meets the Group CRO for 45 minutes with three half-drafted papers. Talks through the four red indicators as four items. `P-013` asks whether they are connected and she says she thinks so, which is not an evidenced answer. Leaves with a direction to sharpen `AG-…-03` and no more time than she had before.

**Already done.** `L1` 7: the pre-review loaded with the readiness state per agenda item; the two fact-arrival dependencies flagged, including the 12:52 configuration expectation; the `MSN-2026-0147` escalation note with both options and no recommendation; the unmet 14.04.2026 extension condition included. `L2` 7: the causal chain loaded as a seven-node object with four evidenced and two inferred links, so the CRO's question has an answer with a stated confidence; the `RSK-0211` dissent from 11:58 not yet available, so the item is shown as pending with its expected time; the three decision items that ask one answerable question separated from the two that ask for a discussion; the `RSK-0184` acceptance with its unmet exit-test condition and 86 days to expiry. `L5` 3: the pre-review record written with the CRO's directions; `AG-…-03`'s scope narrowed per direction; the causal chain's presentation status set to "hypothesis with declared inferences". All released by her. `L3` 1: a prepared `AG-…-03` revision reflecting the CRO's direction, with the recommendation still blank.

**Evidence surfaced.** The seven-node causal chain with confidence per link. Per-item committee readiness. `MSN-2026-0147` with the 14.10.2026 constraint and the unmet reporting condition. `RSK-0184` acceptance with condition status and expiry.

**Uncertainty disclosed.** "Two of the causal chain's six links are inferred. Presenting the chain to the committee as established would be more persuasive and less defensible. The recommended presentation marks both inferred links and states what evidence would confirm them."

**Human choice.** Whether to present the causal chain to the committee at all, given that two links are inferred and a chair may reject the whole on that basis. She commits to presenting it with the inferences marked. The alternative, four separate red items, is what the committee has seen every quarter and has acted on never. Reversible.

**State changes.** `SYS-0031`, group partition: pre-review record written with the CRO's directions, accountable `P-001`. `AG-…-03` scope narrowed. Causal chain presentation status set to hypothesis with declared inferences.

**Background reveal.** 17 actions (`L1` 7, `L2` 7, `L5` 3). 4 artefacts touched, 0 external. 0 awaiting release. 1 draft prepared, accepted with the recommendation blank.

---

## 8. `M06` 11:45 Human decision point

**The moment.** The one moment in the day with no lane 5 and no lane 3. Nothing is written and nothing is drafted. The product's entire contribution is that the person arrives fully briefed and decides unaided.

**The hard constraints for every cell in this section.**

- `L5` count is 0 for all six roles. `L3` count is 0 for all six roles. `L4` count is 0 by definition.
- No option is pre-selected, highlighted, ordered by preference or marked as recommended. Options appear in a fixed neutral order, alphabetical or chronological, never ranked.
- No rationale is drafted before the human has formed one. The decision record's rationale field is empty and stays empty until the human types into it.
- The consequence model states what each option would change and who would have to act. It does not state which is better, and it does not compute a score.
- The decision record is created **after** the decision, from what the human states.

A note on timing. `rcsa`'s `M06` decision is taken at 11:58 rather than 11:45, inside the workshop that runs to 12:00, and is recorded as `DEC-2026-0772`. The other five `M06` decisions are taken between 11:45 and 12:15 and receive `DEC` identifiers at seed time, monotonic by creation time.

---

### `M06` tprm, `P-002`

**Today.** Sits with a notepad after the supplier call and tries to decide what the appendix divergence actually is. Has no structured way to compare the three characterisations. Asks a colleague. Decides on instinct, writes an email, and the reasoning exists only in his head and in the email's tone.

**Already done.** `L1` 2: the decision surfaced as the day's open judgment, with the objects it affects listed (`TP-0042`, `CTR-2023-0117-A3`, `MSN-2026-0191`, `MSN-2026-0221`, `AG-…-04`); the reply state of his four `M04` questions shown, of which two have answered (`P-016` confirming v4.2 binds at 11:12 as `EVD-2026-41901`, `P-010` confirming nil commercial notice at 10:58). `L2` 5: the three characterisations set out with the facts that support each, unordered and unranked; the consequence of each modelled (a notice under clause 3.4 starts a 30-day objection clock and requires a named breach; a variation request starts a commercial negotiation with no clock; a records-reconciliation conversation preserves the relationship and creates no right); the facts that would distinguish them listed, of which one is obtainable (whether Novalink asserts portal publication as notice, which `P-011` asserted at 15:31, after this moment) and two are not; the reassessment timeline dependency stated at 25 days; the `RSK-0184` acceptance condition and its 86-day expiry attached.

**Evidence surfaced.** `EVD-2026-41901`, Group Legal confirmation that `CTR-2023-0117-A3` v4.2 binds (11:12). `P-010`'s nil-notice confirmation (10:58). The repository search scope with its nil return. Clause 3.4 text. Register v6.1. The three characterisations with their supporting facts.

**Uncertainty disclosed.** "Novalink's position on whether portal publication constitutes notice is unknown. It is the single fact that most affects the characterisation, and it can be obtained by asking. Asking it in writing, however, may itself be read as asserting a breach. This system cannot tell you whether that cost is worth paying."

**Human choice.** He splits the divergence into three characterisations rather than choosing one, which no option list offered and which is the right answer: Meridian is a notice failure, to be asserted formally; the Amsterdam region is a material change requiring a variation, not a breach assertion; fourth parties are a drafting gap with no obligation breached. Three routes, three owners, three timelines. `MSN-2026-0221` is scoped from this decision at `M07`. Reversible until the notice is issued.

**State changes.** None. The decision record is created at `M07`, from his stated reasoning.

**Background reveal.** 7 actions (`L1` 2, `L2` 5, `L5` 0). 6 artefacts touched, 1 external. 0 awaiting release. 0 drafts. **0 lane 4 actions, by design.**

---

### `M06` rcsa, `P-003`

**Today.** Standing at the front of a room at 11:55 with a decision she has to make in front of the people it affects: force a rating or record a dissent. No preparation, no consequence model, and seven people waiting.

**Already done.** `L1` 1: the dissent clause of the RCSA procedure surfaced with its text and its consequence. `L2` 4: the three positions (6, 9, 12) with the appetite boundary at 10 and the exact consequence text for each side; the two options modelled (an agreed rating closes the RCSA and ends the challenge; a recorded dissent escalates to `CMT-NFR-2026-10` with both positions and leaves the RCSA unsigned past 16.10.2026 unless resolved); the precedent checked, returning two recorded 2LoD dissents in the group in the last eight quarters, so the instrument is real but rare; `P-004`'s pending configuration evidence flagged as a fact that may arrive today and may change the basis.

**Evidence surfaced.** The RCSA dissent clause. Three residual positions with dates and authors. The appetite boundary and both consequences. Two prior group dissents. `P-004`'s pending evidence with its expected arrival.

**Uncertainty disclosed.** "Evidence that may change the basis of this disagreement has been requested from the supplier and is overdue against a four-hour service level. It may arrive today. Deciding now means deciding without it; deferring means the RCSA cannot be signed on schedule."

**Human choice.** She records a dissent at 11:58, `DEC-2026-0772`, with both positions in their owners' terms and no adjudication. The reasoning she types: an agreed rating reached before the configuration evidence arrives would be an agreement about nothing, and the appetite consequence is too consequential to settle by compromise. Superseded at 16:41 by `DEC-2026-0783`, which the product shows as a supersession with full history.

**State changes.** None at 11:45. `DEC-2026-0772` is recorded at 11:58 as part of `M05`'s workshop close, which is why `M05` carries the `L5` count of 5 and `M06` carries 0.

**Background reveal.** 5 actions (`L1` 1, `L2` 4, `L5` 0). 5 artefacts touched, 0 external. 0 awaiting release. 0 drafts. **0 lane 4 actions.**

---

### `M06` control-assurance, `P-004`

**Today.** Back at his desk after the challenge meeting and the RCSA observation. The configuration request has blown its four-hour service level at 12:52, which he will notice at 13:10. He has to decide whether his conclusion holds without the configuration, and there is nothing on his screen to help him decide.

**Already done.** `L1` 1: the 12:52 service level shown as 67 minutes from breach at 11:45, with the escalation path to `P-002` prepared and unsent. `L2` 6: the three options set out unranked (issue the conclusion as Partially Effective with `EXC-…-04` classified as operating; issue it with `EXC-…-04` as design; issue it with `EXC-…-04` marked undetermined and the conclusion's limitation extended); the consequence of each modelled, including that the third option is the only one that survives the configuration arriving and contradicting him; the re-performance standard applied to each, asking whether an independent tester with the same evidence would reach the same conclusion; the two conceded assertions from `M05` confirmed as unaffected by any of the three; the population's time-bounding restated as a separate limitation regardless of which option is chosen.

**Evidence surfaced.** The four exception evidence chains. `EVD-2026-41908` description v4.1. The `EXC-…-04` rule trace with `BCP-THROUGHPUT`. The configuration request with its 08:52 timestamp and 12:52 service level. The two conceded assertions.

**Uncertainty disclosed.** "The classification of `EXC-…-04` cannot be determined without the tenant configuration. Two of the three options require a determination you cannot evidence. The third does not, and is the only option whose conclusion cannot be falsified by the evidence you have requested."

**Human choice.** He marks `EXC-…-04` undetermined, extends the conclusion's limitation to cover both the undetermined classification and the population's time-bounding, and holds the conclusion at Partially Effective on the three operating deviations alone. That is a harder and weaker-sounding position than either alternative, and it is the only one that survives 15:38. Reversible, and revised at 16:41 with the design classification added rather than substituted.

**State changes.** None. Written at `M07`.

**Background reveal.** 7 actions (`L1` 1, `L2` 6, `L5` 0). 5 artefacts touched, 1 external. 0 awaiting release. 0 drafts. **0 lane 4 actions.**

---

### `M06` incident-resilience, `P-005`

**Today.** Decides whether the `RB-PAY-007` section 4 contradiction is a documentation correction or a finding, on the basis of a working group discussion that reached no conclusion, with no record of what either option would mean.

**Already done.** `L1` 2: the decision surfaced with its affected objects (`RB-PAY-007`, `CTL-PAY-014`, `KRI-RES-005`, `AG-…-08`); the working group's acknowledgement of the unlogged 23.09.2026 activation attached. `L2` 5: two options set out unranked (a documentation correction owned by `P-007`, closed in days, no governance visibility; a resilience finding with a Massnahme, committee visibility, and an implied criticism of a runbook `P-007` owns); the consequence of each modelled, including that a documentation correction would not require anyone to establish what actually changes during fallback, which is the substantive question; the control inventory reconciliation restated, showing `CTL-PAY-014` as conditional on system state; the configuration evidence flagged as pending and as the only thing that would establish what actually changes; the `ITOL-0004-03` two-measure question attached as a separate open item with no precedence found.

**Evidence surfaced.** `RB-PAY-007` v3.1 section 4 verbatim against 11 controls. The working group acknowledgement. `ITOL-0004-03` with two measures and no precedence. The pending configuration evidence.

**Uncertainty disclosed.** "The contradiction is between two Arcadia documents. What actually changes during fallback operation is not established by either of them and requires the supplier configuration, which has been requested by Control Assurance and is overdue. A documentation correction made now would correct one document to match an assumption, not a fact."

That sentence would have changed her decision if she had weighted it. She does not, and two hours and twenty-seven minutes later the fallback is activated.

**Human choice.** She raises it as a resilience finding with a Massnahme, and additionally decides not to wait for the configuration before doing so. The reasoning she types: a runbook that makes an unverified control assertion is a finding whatever the configuration turns out to say, because the assertion had no basis when it was written. That reasoning survives the day intact and becomes `MSN-2026-0216`. Reversible.

**State changes.** None. Written at `M07`.

**Background reveal.** 7 actions (`L1` 2, `L2` 5, `L5` 0). 4 artefacts touched, 0 external. 0 awaiting release. 0 drafts. **0 lane 4 actions.**

---

### `M06` regulatory-change, `P-006`

**Today.** Decides how to characterise the `ARC-CH` inventory gap, and whether to treat the Meridian arrangement as a live compliance question or as a TPRM dependency, on the basis of a forum discussion that produced a jurisdictional muddle.

**Already done.** `L1` 1: the decision surfaced with its affected objects (`REG-2026-0088`, `AG-…-07`, `MSN-2026-0221`); the two split obligations from `M05` shown as separately tracked. `L2` 4: two options set out unranked for the inventory gap (a filing deficiency, which names a person and a date and is quickly closed; an inventory-scope definition question, which names the standard and is slower and structural); the consequence of each modelled, including that a filing deficiency closed by adding one line would leave the scope ambiguity intact and the same gap would recur; the standard's text on subcontracting depth retrieved verbatim and confirmed ambiguous; the Group Legal question on Pune shown as unanswered with no expected time.

**Evidence surfaced.** The `ARC-CH` inventory standard text on subcontracting depth, verbatim and ambiguous. The filed inventory of 24.07.2026 without Meridian. Meridian's 01.05.2026 onboarding. The unanswered Legal question. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "The standard's text on subcontracting depth is ambiguous. Both characterisations are available on the same facts. This system has read the standard and cannot resolve its ambiguity, because resolving it is an interpretation of Arcadia's own requirement. Illustrative regulatory context, not legal advice."

**Human choice.** He characterises it as an inventory-scope definition question and additionally decides to keep the Meridian arrangement in both lanes permanently rather than assigning it to one function. The reasoning he types: an arrangement that creates obligations in two jurisdictions cannot be owned by one function, and the attempt to assign it is the origin of the forum's confusion. Reversible.

**State changes.** None. Written at `M07`.

**Background reveal.** 5 actions (`L1` 1, `L2` 4, `L5` 0). 4 artefacts touched, 0 external. 0 awaiting release. 0 drafts. **0 lane 4 actions.**

---

### `M06` nfr-governance, `P-001`

**Today.** Decides, alone, whether `MSN-2026-0147` goes to the committee as a re-baselining or as a board escalation. The difference is a peer's standing. She has facts, a template and no structure for the judgment.

**Already done.** `L1` 2: the decision surfaced with its affected objects (`MSN-2026-0147`, `AG-…-05`, the 14.04.2026 decision); the 08.10.2026 12:00 deadline at 2 business days; `P-007`'s reply to her `M04` question received at 11:31, confirming the freeze and proposing 31.10.2026. `L2` 6: two options set out unranked (re-baseline to a date after 14.10.2026 with a root-cause explanation and the unmet reporting condition disclosed; escalate to the `ARC-DE` entity board); the consequence of each modelled, including that re-baselining is the third date on this Massnahme and that a board escalation on a dependency-blocked action would be read as procedural rather than substantive; the dependency chain re-verified with the freeze's 14.10.2026 end date; the 14.04.2026 extension's unmet monthly reporting condition restated as a failure of her own machinery; the group's precedent on second extensions checked, returning four in eight quarters, all granted; `P-007`'s proposed 31.10.2026 checked against the freeze end and UAT lead time, returning it as achievable.

**Evidence surfaced.** `P-007`'s 11:31 reply with the 31.10.2026 proposal. The verified dependency chain with the 14.10.2026 freeze end. `EVD-2026-41102` and `EVD-2026-41205`. The 14.04.2026 extension decision with its unmet condition. Four prior second extensions in eight quarters.

**Uncertainty disclosed.** "The proposed 31.10.2026 date is achievable on the verified dependency chain. Whether it will be achieved depends on UAT scheduling behaviour, on which there is one data point: the 22.09.2026 request is unanswered after 14 days. The group has granted four second extensions in eight quarters and this system holds no record of whether any of them were met."

That last clause is the most useful sentence in her day. The absence of a record on whether prior extensions were met is itself the finding.

**Human choice.** She recommends re-baselining to 31.10.2026, discloses the committee's own unmet reporting condition in the same paper, and adds a third element neither option contained: a request that the committee require completion reporting on all prior extensions, because nobody knows whether extensions work. Reversible.

**State changes.** None. Written at `M07`.

**Background reveal.** 8 actions (`L1` 2, `L2` 6, `L5` 0). 5 artefacts touched, 0 external. 0 awaiting release. 0 drafts. **0 lane 4 actions.**

---

## 9. `M07` 13:30 Remediation, negotiation or execution design

**The moment.** Decisions become instruments: a contractual notice, an explanation request, a test plan, a runbook amendment, a paper. Lane 5 rises sharply for the first time. The design test: every instrument must be executable by its recipient without a further conversation, and every write must carry its five mandatory attributes.

**One cross-cutting fact at this moment.** `P-004`'s configuration request breached its four-hour service level at 12:52. He escalates to `P-002` at 12:55. `P-002` issues a formal written demand under `CTR-2023-0117-A4` clause 2.1 at 13:41, citing the breach. Novalink acknowledges at 14:02, three minutes before the event notification. The request is re-issued with incident priority at 15:12 and delivered at 15:38 as `EVD-2026-41905`.

---

### `M07` tprm, `P-002`

**Today.** Opens a Word template for a supplier notice and starts writing. Calls `P-016` to check the wording, calls `P-010` to warn him it is coming, and by 15:00 has a draft that nobody has agreed. The formal demand for the configuration does not get sent, because nobody has told him the service level was breached.

**Already done.** `L1` 6: `P-004`'s 12:55 escalation surfaced with the breached service level, the clause text and the elapsed time, so the formal demand is on his screen without anyone asking; the three-route split from `M06` structured into three instruments with owners and dates; `P-010` and `P-016` notified of the split with the reasoning attached. `L2` 12: the clause 3.4 notice requirements parsed into the elements a valid notice must contain, so the draft is complete rather than approximately right; the 30-day objection clock computed from an issue date of 16.10.2026; the variation route's precedent checked, returning two prior `CTR-2023-0117` variations with their elapsed times (41 and 58 days); the fourth-party drafting gap scoped against `CTR-2023-0117-A3`'s current text to produce the specific clause that is missing; `EVD-2026-41901` incorporated as the binding-version basis; the configuration demand drafted with the clause reference, the 08:52 original, the 12:52 breach and the four-hour service level. `L5` 7: the formal configuration demand issued at 13:41; `MSN-2026-0221` created with three sub-items and owners; `MSN-2026-0191` re-scoped to the variation route only; the three-route decision recorded with its reasoning as typed by him; `EVD-2026-41901` attached to `TP-0042`; the `R19` escalation re-aged; the `AG-…-04` paper updated with the three routes. All released by him. `L3` 3: a prepared clause 3.4 notice for Meridian, unissued, for Legal review; a prepared variation request for the Amsterdam region; a prepared fourth-party clause for `CTR-2023-0117-A3`.

**Evidence surfaced.** `EVD-2026-41901`. Clause 3.4 parsed into notice elements. Two prior variation precedents with elapsed times. `CTR-2023-0117-A3` current text against the missing fourth-party clause. The configuration request with its breach.

**Uncertainty disclosed.** "The clause 3.4 notice draft asserts that no notice was given. The evidential basis is a nil return across the contract repository, two shared mailboxes and `P-010`'s filed correspondence. If Novalink produces evidence of notice, the assertion will be withdrawn. The notice is drafted so that withdrawal would not prejudice the variation route or the drafting-gap route."

**Human choice.** Whether to issue the clause 3.4 notice today or hold it for Legal review. He holds it for `P-016` and issues only the configuration demand, which is the urgent instrument. At 14:05 the day makes that sequencing look prescient; it was simply correct.

**State changes.** `SYS-0031` third-party module, group partition: `MSN-2026-0221` created with three sub-items, accountable `P-002` with `P-016` and `P-010`, evidence `EVD-2026-41901` and Register v6.1. `MSN-2026-0191` re-scoped. Three-route decision recorded with his typed reasoning. Formal supplier demand issued and logged under `CTR-2023-0117-A4` clause 2.1 with the breach cited, accountable `P-002`.

**Background reveal.** 25 actions (`L1` 6, `L2` 12, `L5` 7). 6 artefacts touched, 1 external. 0 awaiting release. 3 drafts prepared, 1 issued, 2 held.

---

### `M07` rcsa, `P-003`

**Today.** Writes the 1LoD explanation request for `KRI-PAY-007` and the dissent note for the committee, in two documents, from memory of a workshop that ended 90 minutes ago.

**Already done.** `L1` 5: the dissent from 11:58 loaded with both positions as recorded; the 12.10.2026 explanation deadline; the `AG-…-03` joint paper dependency on `P-004`; the 23.09.2026 open question carried. `L2` 8: the explanation request framed as one causal investigation per `DEC-2026-0771`, with the specific questions it must answer (the `OVR-C` and `OVR-D` component growth, the 17 outside-window overrides, the 23.09.2026 cluster, and the interaction with reviewer capacity); the dissent note's two positions checked for accurate representation against their source records; the remediation-versus-acceptance paths for `RSK-0211` modelled with their approvers and timelines; the ten agreed risk positions reconciled against the RCSA record. `L5` 9: the 1LoD explanation request issued to `P-007` with its four questions and a 12.10.2026 date; the dissent note written to `RCSA-ARC-DE-PAYOPS-2026-Q4`; both `RSK-0211` positions written with attribution; the ten agreed positions confirmed; the 23.09.2026 open question assigned to `P-007` with `P-005`'s independent confirmation attached; `DEC-2026-0772` finalised with its reasoning; the `AG-…-03` input section written; `KRI-PAY-007`'s breach record updated with the explanation request; the four blank reason-code records logged as a data quality item. All released by her. `L3` 2: a prepared remediation-plan template for `RSK-0211` with dates blank; a prepared Risikoakzeptanz template with the approver named and the rationale blank.

**Evidence surfaced.** `DEC-2026-0772` as recorded. Both `RSK-0211` positions from source. The four explanation questions with their supporting decompositions. `P-005`'s independent configuration-audit-log confirmation of the 23.09.2026 activation. The ten agreed positions.

**Uncertainty disclosed.** "The Risikoakzeptanz template is prepared because it is one of two available paths. Preparing it does not indicate that it is appropriate. On current facts the `ARC-DE` Chief Operating Officer would be asked to accept a residual score of 12 on a payment execution risk with one Partially Effective preventive control and no confirmed loss. Whether that is signable is a judgment for the approver."

**Human choice.** Whether to send the explanation request before or after the committee paper. She sends it now, so that `P-007`'s reply is available on 12.10.2026, one day before the meeting, which means the committee sees a 1LoD explanation rather than its absence. A scheduling judgment with a real effect on the quality of the meeting.

**State changes.** `SYS-0031`, `ARC-DE` partition: 1LoD explanation request issued against `KRI-PAY-007` with four questions, accountable `P-003`, addressed to `P-007`, due 12.10.2026. Dissent note and both positions written to `RCSA-ARC-DE-PAYOPS-2026-Q4`. `DEC-2026-0772` finalised. Ten agreed risk positions confirmed. 23.09.2026 open question assigned with evidence.

**Background reveal.** 22 actions (`L1` 5, `L2` 8, `L5` 9). 5 artefacts touched, 0 external. 0 awaiting release. 2 drafts prepared, both held blank.

---

### `M07` control-assurance, `P-004`

**Today.** Notices at some point in the afternoon that Novalink has not replied about the configuration. Sends a chase. Writes his conclusion with the limitation, in Word, and starts the `AG-…-03` section.

**Already done.** `L1` 4: the 12:52 service level breach surfaced at 12:53 with the escalation to `P-002` prepared, sent at 12:55 and acknowledged; `P-002`'s formal demand at 13:41 shown with its acknowledgement expected; the `AG-…-03` section dependency on `P-003`; the three Q4 candidate controls queued for test-plan revision. `L2` 10: the conclusion re-derived with `EXC-…-04` undetermined and both limitations stated; the re-performance standard applied, confirming that an independent tester with the same evidence would reach the same conclusion; the extended population scoped by condition rather than by time, returning all `fallbackRouteMode = ACTIVE` windows since 11.11.2024 as the correct population and seven known windows as the currently identifiable set; the three Q4 candidate controls scoped for configuration examination with an estimate of the additional effort; `UTC-…-02`'s restore commitment at 2 business days of float. `L5` 6: the conclusion issued as Partially Effective with `EXC-…-04` undetermined and two stated limitations; the escalation to `P-002` logged; the extended population scope written as a proposed test revision; the three Q4 candidates added to the test plan as configuration-examination candidates; the challenge meeting outcome written with two assertions agreed; `UTC-…-02` chase scheduled for 09.10.2026. All released by him. `L3` 2: a prepared `AG-…-03` section stating the conclusion, its limitations and the pending evidence; a prepared test revision proposal for a condition-bounded population.

**Evidence surfaced.** The re-derived conclusion with two limitations. The condition-bounded population scope with seven identifiable windows. The 12:52 breach and the 13:41 formal demand. `UTC-…-02` float. Three Q4 candidate control descriptions.

**Uncertainty disclosed.** "The extended population is defined by condition, not by time, which means its true size is unknown until the supplier confirms the complete set of `fallbackRouteMode = ACTIVE` windows since 11.11.2024. Seven windows are identifiable from Arcadia's own configuration audit log. Whether that log is complete for the whole period has not been verified."

**Human choice.** Whether to issue the conclusion now with `EXC-…-04` undetermined, or wait for the configuration that `P-002` has just formally demanded. He issues it. The reasoning he types: a conclusion held open indefinitely pending supplier cooperation gives the supplier control over Arcadia's assurance timetable, and the limitation is the honest instrument for that. Revised at 16:41 by addition, not by correction.

**State changes.** `SYS-0031`, group partition: `TST-2026-0318` conclusion issued as Partially Effective with `EXC-…-04` undetermined and two limitations, accountable `P-004`, evidence the four exception chains and `EVD-2026-41908`. Escalation to `P-002` logged. Test revision proposal written. Three Q4 candidates added to the plan. Challenge meeting outcome recorded.

**Background reveal.** 20 actions (`L1` 4, `L2` 10, `L5` 6). 6 artefacts touched, 2 external. 0 awaiting release. 2 drafts prepared, 1 issued, 1 held.

---

### `M07` incident-resilience, `P-005`

**Today.** Writes the `RB-PAY-007` finding and the `AG-…-08` paper, and drafts a test plan for the fallback path that she will not get resourced this quarter.

**Already done.** `L1` 5: the `M06` decision loaded with her typed reasoning; the `AG-…-08` deadline; `MSN-2026-0188` and `MSN-2026-0177` with owners and ages; the 23.09.2026 acknowledgement from the working group. `L2` 9: the `RB-PAY-007` amendment scoped to the specific text requiring change, section 4's assertion, plus the specific control effects that must replace it, which cannot be stated until the configuration arrives, so the amendment is scoped in two parts; the fallback path test designed as a severe-but-plausible scenario with observation points (recovery time, control effects, queue behaviour, `ARC-CH` correspondent path); the `ARC-CH` test designed separately because `RB-PAY-011` has never been rehearsed; the four `IBS-0004` tolerances re-enumerated with their measures for `AG-…-08`; the `ITOL-0004-03` two-measure question carried as an open item with a 15:15 latest-start computation attached as an operational consequence. `L5` 6: `MSN-2026-0216` created for the `RB-PAY-007` amendment in two parts, accountable `P-007`; the fallback path test written into the 2026 testing plan with a resourcing flag; the `ARC-CH` rehearsal written as a separate item; the `AG-…-08` paper written with the four tolerances and the open question; the `M06` decision recorded with her reasoning; `KRI-RES-005` updated. All released by her. `L3` 2: a prepared `AG-…-08` recommendation on tolerance definition, with the recommendation text blank pending the open question; a prepared resourcing request for the fallback test.

**Evidence surfaced.** `RB-PAY-007` section 4 with the amendment scope. The 18.11.2025 test scope. The seven activation windows with the working group acknowledgement. `RB-PAY-011` with nil rehearsal and the 15:15 latest-start computation. Four tolerance records with measures.

**Uncertainty disclosed.** "The `RB-PAY-007` amendment can only be partly specified. The assertion in section 4 can be removed now, because it had no basis when written. The correct replacement text, stating what actually changes during fallback operation, cannot be written until the RepairDesk configuration is available. `MSN-2026-0216` is therefore scoped in two parts with the second part dependent on evidence Control Assurance has formally demanded."

**Human choice.** Whether to create `MSN-2026-0216` in two parts, which is procedurally awkward and honest, or as one action with a later date, which is tidy and would let the assertion stand for another three weeks. She splits it. Thirty-one minutes later the fallback is activated with the assertion still in force, and the product should let that land without commentary.

**State changes.** `SYS-0031`, group partition: `MSN-2026-0216` created in two parts, accountable `P-007`, evidence the runbook text and the control inventory reconciliation. Fallback path test and `ARC-CH` rehearsal written into the 2026 testing plan with resourcing flags. `AG-…-08` paper written with four tolerances and one open question. `M06` decision recorded with her reasoning.

**Background reveal.** 20 actions (`L1` 5, `L2` 9, `L5` 6). 5 artefacts touched, 0 external. 0 awaiting release. 2 drafts prepared, 1 accepted blank, 1 held.

---

### `M07` regulatory-change, `P-006`

**Today.** Writes two noting papers and the register remediation plan. Chases Group Legal about Pune.

**Already done.** `L1` 4: the `M06` decision loaded with his reasoning; both paper deadlines; the unanswered Legal question at 4 hours with an escalation path; the two split obligations tracked separately. `L2` 9: the register remediation scoped to the three named Tier 1 records and their specific incomplete fields, so the plan is field-level rather than percentage-level; the `ARC-CH` inventory standard's subcontracting-depth ambiguity drafted into a proposed clarification; the Meridian arrangement's dual-lane tracking confirmed with separate evidence requirements; `REG-2026-0104`'s consultation window at 17 days with the held precedence comment carried from `M03`; the `SVC-0042-03` classification question scoped with its `PT-06` dependency. `L5` 5: the register remediation plan written against `REG-2026-0031` at field level; the inventory standard clarification proposed against `REG-2026-0088`; the `M06` decision recorded with his reasoning; both noting papers written with the four-state decomposition replacing the percentage; the Legal question escalated. All released by him. `L3` 1: the `REG-2026-0104` precedence comment, still held, still lacking a concrete case.

**Evidence surfaced.** Three Tier 1 records with field-level incompleteness. The inventory standard's ambiguous text with a proposed clarification. Both split Meridian obligations. `REG-2026-0104` consultation window. `SVC-0042-03` with its `PT-06` dependency. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "The proposed inventory standard clarification would require subcontractors of significant outsourcings to be recorded where they have access to client-identifying data. This is a proposal about Arcadia's own standard. Whether it is required is a matter for interpretation with Group Legal. Illustrative regulatory context, not legal advice."

**Human choice.** Whether to send the `REG-2026-0104` precedence comment without a concrete case, on the last practical day before the consultation gets crowded. He holds it again. Two hours and thirty-four minutes later he has the case, and the held draft is still on his screen. The product's contribution here is persistence, not intelligence.

**State changes.** `SYS-0031`: field-level remediation plan written against `REG-2026-0031` in the `ARC-DE` and `ARC-AT` partitions. Standard clarification proposed against `REG-2026-0088` in the `ARC-CH` partition. Both noting papers written with four-state decompositions. `M06` decision recorded. All accountable `P-006`, all labelled illustrative regulatory context, not legal advice.

**Background reveal.** 18 actions (`L1` 4, `L2` 9, `L5` 5). 5 artefacts touched, 0 external. 0 awaiting release. 1 draft held for the second time.

---

### `M07` nfr-governance, `P-001`

**Today.** Writes `AG-…-05`, revises `AG-…-03`, and has two papers left with one and a half days.

**Already done.** `L1` 6: the `M06` decision loaded with her three-part recommendation; the 08.10.2026 12:00 deadline at 1.5 business days; per-item readiness now showing three of five decision items drafted; the `AG-…-03` dependency on `P-004`'s conclusion, issued at 13:52, and on `P-003`'s dissent, recorded at 11:58; the two fact-arrival dependencies. `L2` 10: `P-004`'s issued conclusion and `P-003`'s dissent reconciled into one coherent `AG-…-03` narrative with both positions preserved and neither editorialised; the causal chain re-rendered with the two inferred links marked and the confirmatory evidence named; the prior-extension completion question scoped into a specific committee request; the decision architecture for each of the five items checked, confirming that each asks one answerable question; `MSN-2026-0147`'s re-baselining proposal checked against the verified dependency chain. `L5` 8: `AG-…-05` written with the re-baselining recommendation, the disclosed unmet condition and the prior-extension request; `AG-…-03` revised with both positions and the causal chain as a marked hypothesis; the `M06` decision recorded with her reasoning; the prior-extension completion request created as a committee ask; the causal chain object updated; per-item readiness updated; two handoff records to `P-005` and `P-006` for their papers; the `RSK-0184` acceptance condition status re-confirmed. All released by her. `L3` 2: a prepared `AG-…-08` co-authoring structure with `P-005`; a prepared committee cover note listing the five decisions and what each requires from the chair.

**Evidence surfaced.** `P-004`'s issued conclusion with its two limitations (13:52). `DEC-2026-0772` with both positions (11:58). The causal chain with confidence per link. `MSN-2026-0147`'s verified dependency chain. The 14.04.2026 unmet condition. Four prior second extensions with no completion record.

**Uncertainty disclosed.** "`AG-…-03` is written on a control conclusion that carries two stated limitations, one of which depends on supplier evidence formally demanded at 13:41 and not yet received. The paper is structured so that the arrival of that evidence would sharpen the question it asks rather than invalidate it. If the evidence contradicts the conclusion, the paper's question still stands."

**Human choice.** Whether to write `AG-…-03` now on a limited conclusion, or wait for the supplier evidence and risk the deadline. She writes it now and structures it to survive. That structural choice, made at 13:30, is what allows `DEC-2026-0781` at 16:20 to be a small adjustment rather than a rewrite.

**State changes.** `SYS-0031`, group partition: `AG-…-05` written with the re-baselining recommendation, the disclosed unmet committee condition and a prior-extension completion request, accountable `P-001`. `AG-…-03` revised with both positions and the marked hypothesis. `M06` decision recorded with her reasoning. Causal chain object updated. Two handoff records created.

**Background reveal.** 24 actions (`L1` 6, `L2` 10, `L5` 8). 6 artefacts touched, 0 external. 0 awaiting release. 2 drafts prepared, both accepted.

---

## 10. `M08` 14:05 Shared supplier and payments event

**The moment.** One event, six lenses. Facts arrive over 2 hours and 25 minutes, classified, incomplete and in conflict. `M08` covers 14:05 to approximately 15:00 and the arrivals `ARR-INC-2026-0412-01` to `-09`. The design test: no role sees a summary. Every role sees the same facts with the same classes, filtered to its own objects, and the classes never change silently.

**Shared arrivals in this moment.** `ARR-…-01` 14:05 `SS` supplier notification. `ARR-…-02` 14:07 `TI` latency telemetry. `ARR-…-03` 14:12 `VF` fallback activation. `ARR-…-04` 14:26 `TI` queue and override surge. `ARR-…-05` 14:34 `TI` 96 overrides with no review. `ARR-…-06` 14:41 `SS` `P-008` backfill claim. `ARR-…-07` 14:48 `SS` `P-011` contradiction. `ARR-…-08` 14:55 `SS` `P-012` root cause. `ARR-…-09` 15:02 `SS` portal update.

---

### `M08` tprm, `P-002`

**Today.** Sees the 14:05 notification in a shared mailbox, possibly an hour later, possibly not at all, because supplier notifications go to Payment Operations and he is copied. Learns about the incident when someone mentions it. Has no way to check the notification against the contract while it is happening.

**Already done.** `L1` 5: `ARR-…-01` routed to him at 14:05:14 with the notification text and the `CTR-2023-0117-A5` clause 5.3 requirements side by side; the incident bridge invitation accepted at 14:38; his 13:41 formal demand linked to the unfolding event; `P-011` and `P-012` identified as speaking on the bridge with their roles and interests noted; the Arcadia-side minute record opened. `L2` 22: `ARR-…-01` reconciled field by field against clause 5.3, returning five of six mandatory fields absent, with the 30-minute detection-to-notification requirement stated; the "no customer impact" claim held as an unverified supplier assertion and set against `ARR-…-02`; `ARR-…-08`'s Amsterdam reference reconciled against `CTR-2023-0117-A3` v4.2 at 14:55:40, returning the region as unlisted, which converts the morning's documentation finding into an operational one; `ARR-…-09`'s monitoring-pipeline disclosure mapped to `TP-0042.3` Polaris Telemetrix in Brno, a subprocessor correctly listed in the appendix; the contradiction between `ARR-…-08` and `ARR-…-09` registered as Conflict B, both attributed, unresolved; `ARR-…-07`'s accountability assertion registered as Conflict A2 and flagged as a statement made with a commercial interest; the 13:41 demand's relevance to `ARR-…-05` computed, showing the configuration as the evidence that would resolve Conflict A. `L5` 2: `ARR-…-01`'s clause 5.3 deficiency recorded as a contractual finding at 14:19; the Amsterdam operational confirmation attached to `MSN-2026-0221`. Both released by him. `L3` 1: a prepared re-issue of the configuration demand at incident priority, unsent.

**Evidence surfaced.** `EVD-2026-41871` notification as received. `CTR-2023-0117-A5` clause 5.3 with its six fields. `CTR-2023-0117-A3` v4.2 subprocessor list. Register v6.1 with the Amsterdam region. Bridge recordings for `ARR-…-06`, `-07`, `-08`. The 13:41 demand.

**Uncertainty disclosed.** "`ARR-…-08` and `ARR-…-09` are both stakeholder statements and they conflict on whether the root cause is known. A supplier's written communications policy may withhold an unconfirmed cause, in which case both statements are honest. This system registers the conflict and does not resolve it. Resolution requires the subprocessor's own account."

**Human choice.** Whether to re-issue the configuration demand at incident priority now, at 14:38, or let the 13:41 demand run. He re-issues it at 15:12, in `M09`, after `ARR-…-07` makes the configuration the decisive evidence. Holding for 34 minutes rather than firing immediately is a judgment about escalation currency: an incident-priority demand issued before the bridge establishes why it matters is easier to deflect.

**State changes.** `SYS-0031` third-party module, group partition: contractual finding recorded against `CTR-2023-0117-A5` clause 5.3 at 14:19, five of six fields absent, accountable `P-002`, evidence `EVD-2026-41871`. Amsterdam operational confirmation attached to `MSN-2026-0221`. Conflicts A2 and B registered with both statements attributed.

**Background reveal.** 29 actions (`L1` 5, `L2` 22, `L5` 2). 7 artefacts touched, 4 external. 0 awaiting release. 1 draft prepared, held.

---

### `M08` rcsa, `P-003`

**Today.** Finds out about the event late and has no reason to connect it to her morning. If she hears about it, she hears "NOVA-GATE is slow", which is an operations matter. The 96 unreviewed overrides are invisible to her until someone in control assurance tells her, days later.

**Already done.** `L1` 4: the event routed to her at 14:13 **because `ARR-…-03` touches `PRC-0041` and `CTL-PAY-014`**, which is the routing rule that makes her presence at this moment possible at all; her 11:58 dissent linked to the unfolding facts; her 13:30 explanation request to `P-007` linked; the bridge available but not joined, since she has no incident role. `L2` 15: `ARR-…-03`'s fallback activation matched against the six known windows, making 06.10.2026 the eighth; `ARR-…-04`'s 138 `OVR-C` overrides in 13 minutes 19 seconds set against September's entire 198, making one afternoon comparable to a month; the implied `KRI-PAY-007` October trajectory computed and flagged as indicative only, since one day does not make a month; `ARR-…-05`'s 96 unreviewed overrides matched against `RSK-0211` as a candidate materialisation and against her 11:58 dissent as evidence bearing on the disputed control environment rating; `ARR-…-06` and `ARR-…-07` registered as Conflict A with both attributed, and the explicit note that her dissent's basis depends on which is correct; the 17 outside-window overrides from `M04` re-checked, with the 23.09.2026 cluster now looking like the same mechanism. `L5` 1: the event linked to `RSK-0211` as a candidate materialisation with `ARR-…-05` attached at its `TI` class. Released by her. `L3` 0.

**Evidence surfaced.** `ARR-…-03` fallback activation with `CHG-2026-7741`. `ARR-…-04` override counts against September totals. `ARR-…-05` query `QRY-2026-88104` with the 96 records and EUR 9,420,880. Conflict A with both statements. The 23.09.2026 cluster.

**Uncertainty disclosed.** "`ARR-…-05` is a telemetry inference. The absence of a reviewer identity at query time is not proof that no review occurred, and the mechanism by which RepairDesk writes that field is disputed between `P-008` and `P-011`. Your 11:58 dissent rests on a control environment rating that either of the two competing accounts would change, in opposite directions. Do not restate this as a control failure until Conflict A resolves."

That is the product refusing to give her what she wants, four hours after she staked a professional position, and it is the single clearest demonstration of why the fact classes matter.

**Human choice.** Whether to update her dissent now, while the facts favour her, or hold it at its 11:58 basis. She holds it. Updating a recorded dissent on a telemetry inference that contradicts a control owner's direct statement would be the fastest way to lose the argument at committee. Reversible, and she updates it at 16:45 on verified facts.

**State changes.** `SYS-0031`, `ARC-DE` partition: `INC-2026-0412` linked to `RSK-0211` as a candidate materialisation, accountable `P-003`, evidence `ARR-…-05` at class `TI` with its limitation attached. No change to `DEC-2026-0772`.

**Background reveal.** 20 actions (`L1` 4, `L2` 15, `L5` 1). 5 artefacts touched, 1 external. 0 awaiting release. 0 drafts.

---

### `M08` control-assurance, `P-004`

**Today.** Nothing. He is in Vienna, he has issued his conclusion, and the event is a payments operations matter in Munich. He learns about the 96 overrides when someone runs a query, which on a normal day happens in the following week during an incident review, by which time the audit log query is harder to defend and the recall window on any misrouted payment has closed.

**Already done.** `L1` 3: the event routed to him at 14:14 because `ARR-…-03` touches `CTL-PAY-014`; his 13:52 conclusion with its undetermined `EXC-…-04` linked; `P-002`'s 13:41 demand shown with Novalink's 14:02 acknowledgement. `L2` 24: `ARR-…-03`'s `fallbackRouteMode = ACTIVE` matched against the `EXC-…-04` rule trace condition at 14:13, which is the moment the morning's undetermined classification becomes a live prediction; `ARR-…-05` reconciled to the exact reconciliation in `DOC-SCENARIO-BIBLE` invariant 12 (138 = 96 plus 29 plus 13) so the counts are defensible before anyone asks; the 96 split by entity (78 `ARC-DE` EUR 7,611,240; 18 `ARC-AT` EUR 1,809,640) and checked to sum; all 96 confirmed below EUR 250,000, which matches the `EXC-…-04` rule trace's value condition and makes the rule's shape inferable before the configuration arrives; `ARR-…-06`'s backfill claim checked against his own `UTC-…-01` evidence, where a service account identity was written synchronously, which is weak contrary evidence and is stated as weak; `ARR-…-07`'s mechanism claim registered as consistent with `UTC-…-01`; Conflict A registered with the configuration named as the resolving evidence; the population implication computed, that a condition-bounded population would contain 06.10.2026 and that his time-bounded one could not. `L5` 1: the live prediction recorded against `TST-2026-0318` at 14:16, stating that if the `EXC-…-04` rule exists as inferred, `ARR-…-05` is its consequence. Released by him. `L3` 1: a prepared 100% examination scope for the 96 overrides, unsent.

**Evidence surfaced.** `ARR-…-03` with `EVD-2026-41874`. `ARR-…-05` with `QRY-2026-88104`, all counts reconciled. The `EXC-…-04` rule trace with its value and mode conditions. `UTC-…-01`'s synchronous service-account write. Conflict A with both statements. The 14:02 supplier acknowledgement.

**Uncertainty disclosed.** "The rule's shape is inferred from two observations: `EXC-…-04`'s trace on 27.08.2026 and the fact that all 96 overrides today fall below EUR 250,000 with `OVR-C` and fallback mode active. The inference is consistent and unproven. The value threshold could be a coincidence of the population. The configuration, demanded at 13:41 and acknowledged at 14:02, would settle it."

**Human choice.** Whether to record the live prediction at 14:16, before the evidence, which is professionally exposed and creates a timestamp he cannot retract. He records it. The reasoning: a prediction recorded before its confirmation is worth more than a conclusion recorded after, and if he is wrong the record of being wrong is itself useful. This is the most professionally confident act in the day.

**State changes.** `SYS-0031`, group partition: prediction recorded against `TST-2026-0318` at 14:16 with its inferential basis and its falsification condition, accountable `P-004`, evidence the `EXC-…-04` trace and `ARR-…-05`.

**Background reveal.** 28 actions (`L1` 3, `L2` 24, `L5` 1). 6 artefacts touched, 2 external. 0 awaiting release. 1 draft prepared, held.

---

### `M08` incident-resilience, `P-005`

**Today.** Gets a call from Payment Operations at some point after 14:30. Opens a bridge. Takes notes in a Word document. Asks what the impact is and gets three different answers. Raises an incident record at 14:29 from memory of the facts. Has no per-entity view, so `ARC-CH` surfaces late, which is the worst possible failure in this scenario because `ARC-CH` is the entity with the deadline.

**Already done.** `L1` 11: the event routed at 14:07 on `ARR-…-02`, 22 minutes before a human would have raised it; `INC-2026-0412` created at 14:29 at `S3` with all arrivals to that point attached at their classes; the bridge opened at 14:38 with `P-007`, `P-015`, `P-011` and `P-012` resolved and their roles stated; severity upgraded to `S2` at 14:52 with the criteria applied to observed facts; the escalation map executed for `S2`; **`ARC-CH` surfaced at 14:15 as a separate lane with no fallback route**, which no manual process achieves; the `RB-PAY-011` 15:15 latest-start time placed as a countdown. `L2` 33: `ARR-…-02`'s latency signature assessed with its Arcadia-edge limitation stated; the disruption start estimated at 13:38 from telemetry and flagged as an estimate; `ARR-…-03`'s activation timed at 14:12:41 with its documented and undocumented consequences both stated, the undocumented one being `RD-RULE-0031`'s second condition, inferred from `P-004`'s 14:16 prediction; the three EU-entity tolerance positions computed against `ITOL-0004-01` and shown as wide; the `ARC-CH` position computed at 14:15 from `SYS-0015` queue state, returning queueing since 13:47 and a consumed-tolerance figure updating live; the `RB-PAY-011` lead time set against the 16:00 cut-off to produce the 15:15 latest start; `ARR-…-04` and `-05` assessed against `ITOL-0004-04`'s zero tolerance, returning 96 candidate breaches; Conflicts A and B registered; `ARR-…-08`'s Amsterdam reference mapped onto the dependency chain and shown to be **absent from the `IBS-0004` resilience map**, confirming her 08:45 depth disclosure; `ARR-…-09`'s monitoring degradation mapped to `TP-0042.3` and the detection-lag hypothesis formed and marked as a hypothesis; `RB-PAY-007` section 4's assertion re-surfaced against the live activation, with `MSN-2026-0216` part one shown as created 38 minutes before the assertion was relied upon. `L5` 8: `INC-2026-0412` created at `S3`; upgraded to `S2` at 14:52 with criteria; the escalation map executed; the `ARC-CH` lane opened as a separate entity view; the `ITOL-0004-04` candidate breach count recorded at 96; the dependency map gap on the Amsterdam node recorded; the detection-lag hypothesis recorded as a hypothesis; the 15:15 countdown registered as a monitored deadline with `P-015` as owner. All released by her. `L3` 1: a prepared `ARC-CH` decision brief for `P-015` with both options and no recommendation.

**Evidence surfaced.** `ARR-…-02` `ALRT-2026-77412`. `ARR-…-03` `EVD-2026-41874` and `EVD-2026-41875`. `SYS-0015` queue state from 14:15. `ITOL-0004-01` to `-04`. `RB-PAY-011` with its lead time. `RB-PAY-007` section 4. The `IBS-0004` dependency map with the Amsterdam node absent. `P-004`'s 14:16 prediction.

**Uncertainty disclosed.** "The disruption start of 13:38 is estimated from Arcadia-side latency telemetry and is not a supplier-confirmed time. The `ARC-CH` consumed-tolerance figure is computed from a queueing start of 13:47, which is observed in `SYS-0015` and is firmer. If the true start is earlier, the consumed tolerance is larger and the 15:15 latest-start time moves earlier." And: "`ITOL-0004-03` has two measures with no precedence. Whichever decision is taken, this system will not be able to state whether the tolerance was breached."

**Human choice.** Whether to upgrade to `S2` at 14:52 on a tolerance position that is wide for two entities and tight for one. She upgrades on the `ARC-CH` position alone, which is the correct reading of a group framework applied to a legal entity, and which most severity frameworks would have averaged away. Reversible, and upgraded again at 15:14.

**State changes.** `SYS-0031`, group partition: `INC-2026-0412` created 14:29 at `S3`, upgraded 14:52 to `S2` with criteria recorded, accountable `P-005`. `ARC-CH` partition: separate entity lane opened with the queue position and the 15:15 monitored deadline, accountable `P-015`. `ITOL-0004-04` candidate breach count recorded at 96 with `ARR-…-05` at class `TI`. Dependency map gap and detection-lag hypothesis recorded.

**Background reveal.** 52 actions (`L1` 11, `L2` 33, `L5` 8). 9 artefacts touched, 4 external. 0 awaiting release. 1 draft prepared, held.

---

### `M08` regulatory-change, `P-006`

**Today.** Not involved. Learns about the event the next morning, or at the incident review. By then the classification assessments have been done by someone else, possibly as one assessment covering three entities.

**Already done.** `L1` 3: the event routed at 14:10 because `ARR-…-01` touches `TP-0042` and `IBS-0004`, both of which carry obligations in both lanes; the `REG-2026-0117` classification standard loaded in both lanes, separately; `P-005` and `P-015` identified as the assessors with him as the framework owner. `L2` 17: the classification criteria for both lanes loaded as two separate assessment structures with no shared fields, which is the mechanism that prevents the merge; the EU-lane criteria enumerated (clients affected, reputational impact, duration and service downtime, geographical spread, data losses, criticality of services affected, economic impact) with the currently available facts mapped to each and the gaps named; the Swiss-lane criteria for incidents of substantial importance enumerated separately with its own fact mapping; `ARR-…-08`'s Amsterdam reference mapped into the EU-lane subcontracting obligation and the Swiss-lane inventory obligation, differently; `ARR-…-09`'s monitoring degradation mapped to `TP-0042.3`, which is correctly recorded in both, so it raises no registry obligation and this is stated as a negative finding; the `SVC-0042-03` classification question re-surfaced, since a format library failure would have compounded this event. `L5` 1: both classification assessment structures opened as two separate records, `ARC-DE` and `ARC-AT` in one, `ARC-CH` in another, before either assessor asks. Released by him. `L3` 1: a prepared framework note on the two-record requirement, for `P-005`.

**Evidence surfaced.** `REG-2026-0117` in both lanes with separate criteria. `ARR-…-01` and `-08` and `-09` mapped per lane. `TP-0042.3`'s correct registry status as a negative finding. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "Both classification assessments are being opened on facts that are predominantly stakeholder statements. Six of nine arrivals to 15:02 are class `SS`. Any conclusion reached now is provisional and must carry an explicit reassessment trigger. Illustrative regulatory context, not legal advice."

**Human choice.** Whether to intervene now to insist on two separate records, before either assessor starts, or to review afterwards. He intervenes now, with one line to `P-005`. Pre-empting a category error costs one sentence; correcting one afterwards costs a retraction. The smallest act in this moment and the one with the highest ratio of consequence to effort.

**State changes.** `SYS-0031`: two classification assessment records opened, one in the `ARC-DE` and `ARC-AT` partitions against EU-lane criteria and one in the `ARC-CH` partition against Swiss-lane criteria, accountable `P-006` as framework owner with `P-005` and `P-015` as assessors, both labelled illustrative regulatory context, not legal advice.

**Background reveal.** 21 actions (`L1` 3, `L2` 17, `L5` 1). 5 artefacts touched, 2 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M08` nfr-governance, `P-001`

**Today.** Hears about it at `S2` notification, if the escalation map runs. Has no view of what it means for her papers until the next day.

**Already done.** `L1` 7: the event routed at 14:15 on `ARR-…-03` touching `CTL-PAY-014`, which is the subject of `AG-…-03`; `S2` notification received at 14:52; the 08.10.2026 12:00 deadline now at 1.4 business days; the five agenda items re-checked for impact, returning `AG-…-03` and `AG-…-08` affected; `P-004`'s 14:16 prediction surfaced to her, so she knows the event may confirm the paper she wrote 45 minutes ago; the causal chain flagged for extension. `L2` 19: the causal chain extended with `INC-2026-0412` as a candidate eighth node and the extension marked provisional; `ARR-…-05`'s 96 candidate `ITOL-0004-04` breaches assessed against the tolerance's zero threshold and against the absence of any monitoring capable of detecting such a breach, which is a framework defect in her own machinery and is recorded as one; Conflicts A and B registered with their impact on `AG-…-03` stated; the `MSN-2026-0203` link re-surfaced, showing a not-started documentation action on exactly this rule since 25.09.2026; the `RSK-0184` conditional acceptance re-checked, with the event bearing directly on the unmet exit-test condition; `AG-…-03`'s structure re-tested against the new facts, confirming that its question still stands whichever way Conflict A resolves. `L5` 3: the framework defect on `ITOL-0004-04` monitoring recorded; the causal chain extension recorded as provisional; the `AG-…-03` impact assessment recorded with the conclusion that the paper's question survives. All released by her. `L3` 1: a prepared tenth agenda item, unadded.

**Evidence surfaced.** `ARR-…-05` with the 96 candidate breaches. `ITOL-0004-04` with its zero threshold and nil monitoring. `MSN-2026-0203` not started since 25.09.2026. `RSK-0184` acceptance with its unmet condition. `AG-…-03` as written at 13:30. `P-004`'s 14:16 prediction.

**Uncertainty disclosed.** "The causal chain extension is provisional. `ARR-…-05` is a telemetry inference and Conflict A is unresolved. If `P-008`'s account is correct, the extension is wrong and the chain reverts to seven nodes. The extension is marked provisional in the record and must not be shown to the committee as established."

**Human choice.** Whether to add the tenth agenda item now, at 14:52, on provisional facts. She waits. Adding an agenda item is cheap and removing one is not, and an item added on a telemetry inference would have to be re-scoped if Conflict A resolved the other way. She adds it at 16:20 on verified facts as part of `DEC-2026-0781`. Reversible either way, and the waiting is the professional instinct.

**State changes.** `SYS-0031`, group partition: framework defect recorded on `ITOL-0004-04`, zero tolerance with no detection capability, accountable `P-001`. Causal chain extension recorded as provisional. `AG-…-03` impact assessment recorded.

**Background reveal.** 29 actions (`L1` 7, `L2` 19, `L5` 3). 6 artefacts touched, 1 external. 0 awaiting release. 1 draft prepared, held.

---

## 11. `M09` 15:00 Event response and stakeholder engagement

**The moment.** The heaviest moment in the day. Conflicts resolve, an irreversible decision is taken under time pressure, and a confirmed error appears. `M09` covers approximately 15:00 to 16:30 and arrivals `ARR-…-10` to `-17`. The design test: reclassification must be visible. When `ARR-…-05` moves from `TI` to `VF` at 15:38, the history remains.

**Shared arrivals in this moment.** `ARR-…-10` 15:09 `VF` `ARC-CH` queue and tolerance. `ARR-…-11` 15:14 `VF` `S1` upgrade and classification assessments. `ARR-…-12` 15:38 `VF` configuration export, resolves Conflict A, reclassifies `ARR-…-05`. `ARR-…-13` 15:47 `VF` `ARC-CH` manual submission. `ARR-…-14` 15:51 `VF` subprocessor account, resolves Conflict B. `ARR-…-15` 16:04 `VF` correspondent confirmation and the two-measure divergence. `ARR-…-16` 16:12 `VF` restoration. `ARR-…-17` 16:19 `TI` with embedded `VF`, one confirmed erroneous release.

---

### `M09` tprm, `P-002`

**Today.** On a bridge for two hours taking notes. Asks Novalink for the configuration and is told it will be looked into. Does not get it today. The appendix divergence and the Amsterdam disclosure are in his notes and nowhere else.

**Already done.** `L1` 9: the configuration demand re-issued at 15:12 at incident priority under `CTR-2023-0117-A4` clause 2.1, citing the 13:41 demand, the 12:52 breach and the live `S1`; `EVD-2026-41901` circulated to all roles at 15:23 establishing the binding appendix version; `P-011`'s 15:31 portal-publication assertion captured and attributed; the Arcadia minute record running; `MSN-2026-0221`'s three sub-items updated as the event supplies evidence for two of them. `L2` 27: `EVD-2026-41905` received at 15:38 and parsed, confirming `RD-RULE-0031`, its 11.11.2024 introduction, its `BCP-THROUGHPUT-v2` template origin, its client-configurability, its 118 firings and the synchronous reviewer write; `CHG-2024-5512` retrieved as `EVD-2026-41907` and its release notes parsed, confirming that no control waiver was named; the accountability position derived and stated as shared, with the three components named (supplier non-disclosure, Arcadia change approval without control review, Arcadia control description not updated); `P-011`'s 14:48 accountability assertion re-assessed against `EVD-2026-41907` and returned as partly correct and materially incomplete; `EVD-2026-41911` received at 15:51 and parsed, returning the 13:31 quorum loss, the unnotified firmware change, the 13:44 Amsterdam failover and the 14:57 monitoring restoration; the 34-minute detection lag computed from 13:31 to 14:05 and attributed to `TP-0042.3`'s static connection string; `CTR-2023-0117-A1` clause 7.2's 10-business-day notice requirement applied to the 13:31 change, returning nil notice; the concentration position on `TP-0042.3` assessed as a single point of failure in the supplier's own detection capability; `ARR-…-16`'s five-business-day report commitment computed against the 08.10.2026 papers deadline, returning a three-business-day gap. `L5` 6: the `RD-RULE-0031` finding recorded against `TP-0042` with shared accountability and its three components; the clause 7.2 nil-notice finding recorded; the detection single-point-of-failure recorded; `EVD-2026-41905`, `-41907` and `-41911` retained with provenance; `MSN-2026-0217` and `MSN-2026-0218` created; the `AG-…-04` paper updated with three new evidenced findings. All released by him. `L3` 2: a prepared re-scoping of `MSN-2026-0221` to add the clause 7.2 point; a prepared supplier governance escalation for the next service review.

**Evidence surfaced.** `EVD-2026-41905` tenant configuration with `RD-RULE-0031`. `EVD-2026-41906` firing history, 118 since 11.11.2024. `EVD-2026-41907` `CHG-2024-5512` with release notes. `EVD-2026-41911` Rheinstack account. `EVD-2026-41901` binding version. `CTR-2023-0117-A1` clause 7.2. `P-011`'s 15:31 assertion.

**Uncertainty disclosed.** "The firing history of 118 is from the supplier's own export. Arcadia's configuration audit log independently confirms seven prior fallback windows and today's, which is consistent but does not verify the count. A complete independent verification would require the full override population since 11.11.2024." And: "`P-011`'s assertion that portal publication constitutes notice is a contractual position, not a fact. Appendix A3 clause 3.4 requires prior written notice and does not define the medium. This is now a dispute with two arguable sides."

**Human choice.** Whether to characterise the `RD-RULE-0031` finding as a supplier failure, which is the easier and more satisfying framing, or as shared accountability, which implicates Arcadia's own change approval. He records it as shared, with the three components named. That costs him the cleaner supplier argument at committee and is the only defensible reading of `EVD-2026-41907`.

**State changes.** `SYS-0031` third-party module, group partition: `RD-RULE-0031` finding recorded against `TP-0042` with shared accountability and three named components, accountable `P-002`, evidence `EVD-2026-41905`, `-41906`, `-41907`. Clause 7.2 nil-notice finding recorded with `EVD-2026-41911`. `TP-0042.3` detection single-point-of-failure recorded. `MSN-2026-0217` and `MSN-2026-0218` created with owners and dates. `SYS-0032`: three artefacts retained with provenance and retention class.

**Background reveal.** 42 actions (`L1` 9, `L2` 27, `L5` 6). 11 artefacts touched, 6 external. 0 awaiting release. 2 drafts prepared, 1 accepted, 1 held.

---

### `M09` rcsa, `P-003`

**Today.** Not on the bridge. Finds out the following week that 96 overrides went unreviewed and that a rule she had never heard of caused it, by which time her dissent has already gone to committee on a control environment argument that was half right.

**Already done.** `L1` 7: `EVD-2026-41905` routed to her at 15:39 with its bearing on `DEC-2026-0772` stated; `ARR-…-05`'s reclassification from `TI` to `VF` shown as a reclassification event with its 15:38 timestamp and its prior class retained; her 13:30 explanation request re-checked against the new facts, returning three of four questions now partly answered; `ARR-…-17` routed at 16:20. `L2` 18: `RD-RULE-0031`'s condition set against the `OVR-C` component growth from `M01`, confirming that every September activation waived the control for its duration and quantifying 22 prior firings; the `RSK-0211` residual reasoning re-derived, returning the same score of 12 on a materially different basis, which is the professionally awkward and correct result; her pre-read reasoning (capacity and discipline) compared against the actual mechanism (a configured waiver) and the difference stated explicitly; the 1LoD compensating-control argument re-tested against `ARR-…-17`, returning that `CTL-PAY-029` reconciled value correctly and did not detect the wrong intermediary BIC, which confirms her `M03` characterisation from an actual case; `ARR-…-17`'s single confirmed error assessed against the 1LoD "no loss occurred" argument, returning that the argument no longer holds while noting the payment is recallable; the 23.09.2026 cluster re-assessed with the rule known, now consistent with an unlogged activation. `L5` 4: the reclassification acknowledged against `RSK-0211`'s candidate materialisation, now confirmed; the re-derived residual reasoning written with the basis change declared; `ARR-…-17` attached to `RSK-0211` as a confirmed materialisation with the recall reference; the explanation request annotated with the three partly answered questions. All released by her. `L3` 1: a prepared revision of her dissent's reasoning, with the score unchanged and the basis rewritten.

**Evidence surfaced.** `EVD-2026-41905` with `RD-RULE-0031`. `EVD-2026-41906` with 22 prior firings. `ARR-…-17` with `EVD-2026-41924` and `EVD-2026-41930`. `CTL-PAY-029`'s characterisation against the actual case. The reclassification event on `ARR-…-05`.

**Uncertainty disclosed.** "`ARR-…-17` confirms one erroneous release in a 20-case sample of 96. The extrapolation to approximately five is a telemetry inference on an unstratified 21% sample, and the single error occurred on the most error-prone repair type. The verified fact is one error. The number of further errors is unknown and a full examination is required." And: "Your residual score of 12 is unchanged. Its basis has changed materially. The reasoning in your 02.10.2026 pre-read and your 11:58 dissent attributes the control weakness to capacity and discipline. The actual mechanism is a configured waiver. Both readings support a score of 12; only one is correct."

**Human choice.** Whether to revise the dissent's reasoning before the committee paper, which means telling the committee that her original reasoning was wrong while her conclusion was right. She revises it at 16:45. Defending a correct number with a wrong argument is how a second line loses credibility, and a visible correction is cheaper than a discovered one.

**State changes.** `SYS-0031`, `ARC-DE` partition: `RSK-0211` candidate materialisation confirmed with `ARR-…-17` and the recall reference, accountable `P-003`. Re-derived residual reasoning written with the basis change declared and the score unchanged at 12. Explanation request annotated. `DEC-2026-0772` reasoning revised at 16:45 with full history retained.

**Background reveal.** 29 actions (`L1` 7, `L2` 18, `L5` 4). 7 artefacts touched, 3 external. 0 awaiting release. 1 draft prepared, accepted.

---

### `M09` control-assurance, `P-004`

**Today.** Not involved. His conclusion, issued at 13:52 with `EXC-…-04` undetermined, stands undetermined for weeks.

**Already done.** `L1` 6: `EVD-2026-41905` routed to him at 15:38:40 with his 14:16 prediction shown alongside it, confirmed; the 100% examination scope from `M08` surfaced for release; `P-008` routed the same evidence at the same moment, so neither learns it before the other, which matters for what happens at 16:27; the `AG-…-03` section flagged for revision. `L2` 29: `EVD-2026-41905` parsed against his 14:16 prediction, confirming the rule's condition, its value threshold and its mode dependency exactly as inferred; `EXC-…-04` reclassified from undetermined to design deficiency with the accountability shared; `EVD-2026-41906`'s 118 firings set against his time-bounded population, confirming that 22 firings preceded his test period and were structurally invisible to it; the three remaining exceptions re-tested against the rule and confirmed as independent of it, which is the precise boundary of what he concedes; `UTC-…-01` re-assessed with the synchronous-write fact confirmed, which strengthens rather than weakens it, since a service account was written synchronously and deliberately; `ARR-…-17`'s single confirmed error assessed against `ITOL-0004-04` and against his conclusion, returning that the design deficiency now has a demonstrated consequence; the extended population re-scoped to all 118 firings; `P-008`'s likely position derived from the evidence and returned as defensible on the 96 cases and on `EXC-…-04`, and not defensible on the other three. `L5` 5: `EXC-…-04` reclassified to design with shared accountability; the 14:16 prediction marked confirmed with its evidence; the conclusion's first limitation closed and the second retained; `MSN-2026-0214` created at 16:02 per `DEC-2026-0778` for a 100% examination of all 96 with a 07.10.2026 12:00 date; `MSN-2026-0220` created for the condition-bounded re-test of all 118 firings. All released by him. `L3` 3: a prepared joint position statement with three fields; a prepared revision of the `AG-…-03` section; a prepared note on the three Q4 candidate controls, now materially more urgent.

**Evidence surfaced.** `EVD-2026-41905` with the rule text. `EVD-2026-41906` with 118 firings and 22 pre-period. `EVD-2026-41907` with the non-disclosing release notes. His own 14:16 prediction record. `ARR-…-17` with the confirmed error. `UTC-…-01` re-assessed.

**Uncertainty disclosed.** "The 22 pre-period firings are confirmed by the supplier's export and not independently verified. Their override records exist in `SYS-0014` and have not been examined. `MSN-2026-0220`'s population is therefore 118 firings of which 96 are examined today, 1 was examined in `TST-2026-0318`, and 21 have never been examined."

**Human choice.** Whether to concede the design characterisation on the 96 cases and `EXC-…-04` while holding operating deficiency on the other three, or to hold the whole conclusion. He concedes precisely, in writing, at 16:27. Precision rather than victory is the professional instrument, and the 16:41 joint signature is only possible because both parties conceded something specific rather than negotiating a middle.

**State changes.** `SYS-0031`, group partition: `EXC-…-04` reclassified to design deficiency with shared accountability, accountable `P-004`, evidence `EVD-2026-41905` and `-41907`. 14:16 prediction marked confirmed. First conclusion limitation closed, second retained. `MSN-2026-0214` created (owner `P-008`, assured by `P-004`, due 07.10.2026 12:00). `MSN-2026-0220` created (owner `P-004`, due 24.11.2026).

**Background reveal.** 40 actions (`L1` 6, `L2` 29, `L5` 5). 9 artefacts touched, 4 external. 0 awaiting release. 3 drafts prepared, 2 accepted, 1 held.

---

### `M09` incident-resilience, `P-005`

**Today.** Runs a bridge, takes notes, upgrades severity on instinct, and tries to get a decision out of Zurich while three people talk over each other. The `ARC-CH` tolerance position is a number she recalculates in her head. Both classification assessments get done next week, possibly as one.

**Already done.** `L1` 16: `ARR-…-10` received at 15:09 with the `ARC-CH` position computed and the 38-minute remaining tolerance and 51-minute cut-off shown against `RB-PAY-011`'s 45-minute lead time, which renders the decision without a word; severity upgraded to `S1` at 15:14 on two independently recorded criteria; the `S1` escalation map executed to `P-013` and `P-014` with delivery recorded; both classification assessments opened at 15:20 in the two separate records `P-006` created; `P-015`'s decision brief released at 15:03 with both options and no recommendation; the 15:15 countdown live; `ARR-…-12` through `-17` routed as they arrive with their classes; the bridge minute running. `L2` 41: the `ARC-CH` tolerance tracked live on both measures from 13:47; `RB-PAY-011`'s 45-minute lead time verified against its 14.01.2026 review and flagged as never rehearsed, which is material to a decision being taken on it; Novalink's 16:00 recovery estimate assessed as a stakeholder statement with no evidential basis and explicitly not relied on; both classification criteria sets populated with available facts and their gaps named, per lane, with no shared fields; `EVD-2026-41905` assessed for its resilience implication, returning that activating her own fallback arrangement waived a key IKS control for the duration, which is confirmed at 15:39 and which `RB-PAY-007` section 4 denied; `EVD-2026-41911` assessed, confirming the 34-minute detection lag and the `TP-0042.3` static connection string, and confirming her 08:45 dependency-map depth disclosure; `ARR-…-15` assessed against both `ITOL-0004-03` measures, returning measure 1 satisfied at 15:58 and measure 2 exceeded at 2 hours 11 minutes, with the divergence registered as Conflict D and explicitly not resolved; the CHF 14,200 rolled value assessed against `ITOL-0004-02`, returning 0.023% of daily `ARC-CH` value, well inside; `ARR-…-17` assessed against `ITOL-0004-04`'s zero tolerance with one confirmed breach consequence. `L5` 14: `S1` upgrade with two criteria; escalation map executed with delivery records; `DEC-2026-0774` recorded at 15:47 as provisional with its reassessment trigger; `DEC-2026-0775` recorded at 15:52 as provisional with its reassessment trigger; `DEC-2026-0776` recorded at 15:07 as irreversible; the `ARC-CH` submission outcome recorded from `EVD-2026-41918`; Conflict D registered as unresolved with `P-005` as owner and `AG-…-08` as destination; `MSN-2026-0219` created; the `RB-PAY-007` section 4 assertion recorded as disproved with `EVD-2026-41905` as evidence; `MSN-2026-0216` part two unblocked; the dependency map gap confirmed with `EVD-2026-41911`; the detection-lag hypothesis confirmed as fact; fallback exit recorded at 16:08; `ITOL-0004-04` breach count confirmed at 96 with one demonstrated consequence. All released by her or by `P-015` for `ARC-CH` records. `L3` 2: a prepared `AG-…-08` recommendation, now with a concrete case; a prepared lessons note.

**Evidence surfaced.** `EVD-2026-41882` `ARC-CH` queue export. `EVD-2026-41918` `CONF-2026-9931`. `EVD-2026-41905`. `EVD-2026-41911`. `EVD-2026-41921`. `EVD-2026-41924`. `RB-PAY-011` with nil rehearsal. Both classification criteria sets with per-lane fact mappings.

**Uncertainty disclosed.** "`ITOL-0004-03` gives two answers. Measure 1, submission completion versus cut-off: not breached, completed 15:58 against a 16:00 cut-off. Measure 2, elapsed disruption: breached by 11 minutes, 2 hours 11 minutes against 2 hours. The tolerance record states no precedence. This system cannot determine whether the tolerance was breached and will not choose a measure. The question is registered as Conflict D, owned by you, destined for `AG-…-08`." And: "`DEC-2026-0776` was taken at 15:07 on a 45-minute lead time that has never been rehearsed. It worked. One data point does not validate the lead time."

**Human choice.** `DEC-2026-0776`, taken with `P-015` and the `ARC-CH` COO at 15:07: invoke `RB-PAY-011` and submit CHF 18,712,400 manually through the correspondent, accepting a manual-process risk on a never-rehearsed path, rather than wait for a supplier recovery estimate that has no evidential basis. Irreversible. Taken 31 minutes before the root cause was known and 44 minutes before the rule was confirmed. The sharpest human decision in the product.

**State changes.** `SYS-0031`, group partition: `INC-2026-0412` upgraded to `S1` at 15:14 with two criteria, accountable `P-005`. `ARC-DE` and `ARC-AT` partitions: `DEC-2026-0774` recorded provisional with reassessment trigger, labelled illustrative regulatory context, not legal advice. `ARC-CH` partition: `DEC-2026-0775` recorded provisional with reassessment trigger, same label; `DEC-2026-0776` recorded irreversible, accountable `P-015`; submission outcome recorded with `EVD-2026-41918`. Group partition: Conflict D registered unresolved with owner and destination; `MSN-2026-0219` created; `RB-PAY-007` section 4 assertion recorded as disproved; fallback exit recorded 16:08.

**Background reveal.** 71 actions (`L1` 16, `L2` 41, `L5` 14). 12 artefacts touched, 6 external. 0 awaiting release. 2 drafts prepared, both accepted.

---

### `M09` regulatory-change, `P-006`

**Today.** Not involved.

**Already done.** `L1` 6: both classification assessments monitored as two separate records with no field sharing; `EVD-2026-41905` routed at 15:40 with its obligation implications per lane; `EVD-2026-41911` routed at 15:52; `ARR-…-15` routed at 16:05 **with the held `REG-2026-0104` comment attached**, which is the product's most valuable single routing decision of the day; the consultation window at 17 days. `L2` 23: `EVD-2026-41905` assessed per lane, returning that a key control in the Internal Control System / Internes Kontrollsystem (IKS) was waived by supplier configuration from 11.11.2024, with the question of whether any stated position now requires review framed precisely and routed to Group Legal rather than answered; `EVD-2026-41911`'s unnotified subprocessor change assessed against the EU-lane subcontracting obligation and the Swiss-lane inventory obligation separately; `TP-0042.3`'s correct registry status re-confirmed, so the detection failure raises a resilience obligation and not a registry one, stated as a distinction; `ARR-…-15`'s two-measure divergence assessed against `REG-2026-0104`'s draft, confirming that the draft as written would permit this tolerance to exist; the precedence comment re-tested with the concrete case attached, returning it as now evidenced; the `SVC-0042-03` classification question re-assessed with the event's evidence, returning it as materially strengthened; both provisional classification conclusions checked for a stated reassessment trigger, returning both present. `L5` 5: the `REG-2026-0104` consultation comment sent at 16:47 with the concrete case; the IKS-waiver question routed to Group Legal as a framed question with an owner; the EU-lane and Swiss-lane subprocessor-change obligations updated separately; the `SVC-0042-03` classification question strengthened with evidence; both classification records confirmed as carrying reassessment triggers. All released by him. `L3` 2: a prepared `AG-…-06` and `AG-…-07` revision with the event's obligation effects; a prepared note on the IKS-waiver question for the Chief Compliance Officer.

**Evidence surfaced.** `EVD-2026-41905`. `EVD-2026-41911`. `ARR-…-15` with both tolerance measures. `REG-2026-0104` draft v0.7 tolerance clauses. The held comment from 08:45. Both classification records with triggers. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "Whether any position Arcadia has stated externally about its payment control environment now requires review is a question for Group Legal and the Chief Compliance Officer. This system has framed the question and identified the facts bearing on it. It does not answer it and must not. Illustrative regulatory context, not legal advice."

**Human choice.** He sends the `REG-2026-0104` precedence comment at 16:47, with 17 days of consultation window remaining and a concrete case, having held it since 08:45 and again at 13:30. The comment requires that any tolerance with more than one measure state which governs on divergence. It is one paragraph, nobody will notice it, and it prevents an unevaluable tolerance from becoming the group standard. The cheapest high-value act on 06.10.2026.

**State changes.** `SYS-0031`: consultation comment sent and recorded against `REG-2026-0104`, group partition, accountable `P-006`, evidence `ARR-…-15` and `ITOL-0004-03`. IKS-waiver question routed to Group Legal with an owner and a framing. Subprocessor-change obligations updated separately in the `ARC-DE` and `ARC-AT` partitions and the `ARC-CH` partition. `SVC-0042-03` question strengthened. All labelled illustrative regulatory context, not legal advice.

**Background reveal.** 34 actions (`L1` 6, `L2` 23, `L5` 5). 7 artefacts touched, 3 external. 0 awaiting release. 2 drafts prepared, both accepted.

---

### `M09` nfr-governance, `P-001`

**Today.** Receives an `S1` notification and a series of increasingly worrying messages. Has no idea what it means for her papers until the following morning, by which time the 08.10.2026 deadline is one day away.

**Already done.** `L1` 12: `S1` notification at 15:14 with both criteria; all arrivals `-10` to `-17` routed with classes and reclassifications; the 08.10.2026 12:00 deadline at 1.4 business days; per-item impact re-assessed as verified facts arrive; `ARR-…-16`'s five-business-day report commitment computed against the deadline, returning a three-business-day gap with the report arriving on the meeting morning; the tenth agenda item prepared and unadded; `P-004`'s and `P-008`'s converging positions monitored. `L2` 25: the causal chain's provisional extension confirmed at 15:38 and the chain finalised at eight nodes with five evidenced and two inferred links, one of the previously inferred links now evidenced by `EVD-2026-41906`; `AG-…-03`'s question re-tested against the resolved Conflict A, confirming that it stands and is now sharper; the decision architecture for the tenth item designed around a question that the 13.10.2026 supplier report cannot invalidate, namely whether the group accepts that a supplier-configurable rule can waive a key IKS control without an Arcadia control-owner review; `MSN-2026-0203`'s not-started status re-assessed as a governance discipline finding, since the documentation action on this exact rule had been open and untouched for 11 days; the `RSK-0184` acceptance re-assessed against `ARR-…-14`, returning the unmet exit-test condition as now materially more serious; the eight new Massnahmen created across five roles reconciled into one portfolio view with owners, dates and dependencies; Conflict D registered as an open question with an owner and a destination, and confirmed as the only unresolved conflict. `L5` 9: the causal chain finalised at eight nodes with link confidences; `AG-…-03` revised on verified facts; the `MSN-2026-0203` discipline finding recorded; the `RSK-0184` acceptance re-assessment recorded; the eight new Massnahmen reconciled into the portfolio; `KRI-GOV-001` recomputed; the tenth agenda item's decision architecture recorded; Conflict D's ownership and destination confirmed; the three-business-day report gap registered as a constraint. All released by her. `L3` 2: a prepared `AG-…-10` paper; a prepared committee cover note revised for six decisions.

**Evidence surfaced.** `EVD-2026-41905`, `-41906`, `-41907`, `-41911`, `-41918`, `-41924`. The finalised eight-node causal chain with link confidences. `MSN-2026-0203` untouched for 11 days. `RSK-0184` acceptance against `ARR-…-14`. Eight new Massnahmen.

**Uncertainty disclosed.** "The supplier's written incident report is due 13.10.2026, the morning of the committee. Papers close 08.10.2026 at 12:00. Any paper written now is written without the supplier's account of root cause. The tenth item's question is constructed so that the report's content cannot invalidate the decision requested, whatever it says. That construction is the only thing making a decision possible at this meeting."

**Human choice.** `DEC-2026-0781` at 16:20: write the papers on verified facts as at 08.10.2026, state every fact's class explicitly, ask a question the supplier's report cannot invalidate, and add `AG-CMT-NFR-2026-10-10`. The alternative was to table the event for information and lose a quarter. Reversible in form and not in substance.

**State changes.** `SYS-0031`, group partition: causal chain finalised at eight nodes with per-link confidence, accountable `P-001`. `AG-…-03` revised on verified facts. `AG-CMT-NFR-2026-10-10` created at 16:20 with its decision architecture. `DEC-2026-0781` recorded. `MSN-2026-0203` discipline finding recorded. `RSK-0184` acceptance re-assessment recorded. Eight new Massnahmen reconciled into the portfolio with `KRI-GOV-001` recomputed. Conflict D ownership confirmed.

**Background reveal.** 46 actions (`L1` 12, `L2` 25, `L5` 9). 10 artefacts touched, 5 external. 0 awaiting release. 2 drafts prepared, both accepted.

---

## 12. `M10` 16:30 End-of-day summary and overnight work

**The moment.** The highest lane 5 count of the day for every role. The day's work becomes state: records written, actions created, evidence retained, overnight work queued. The design test: nothing is summarised that is not also written, and nothing is written without a human release, an accountable name and an evidence reference.

**Two facts hold across all six cells.** First, `DEC-2026-0783` is recorded at 16:41: `CTL-PAY-014` Kontrollwirksamkeit Partially Effective, with a design deficiency (shared accountability with `TP-0042`) and an operating deficiency (three human deviations), signed by both lines. Second, Conflict D remains open. The product must end the day with one unresolved question, an owner and a destination, and it must not apologise for it.

---

### `M10` tprm, `P-002`

**Today.** Leaves at 19:30 with bridge notes in a Word document and nothing in the system of record. Writes it up on 07.10.2026 from memory, by which time the minute is his recollection rather than a record.

**Already done.** `L1` 12: the day's supplier findings assembled into one `TP-0042` position with five new evidenced items; overnight queue set (the clause 3.4 notice awaiting `P-016`, the variation request awaiting `P-010`, the `R19` escalation at 2 days, the `UTC-…-02` chase for 09.10.2026, the overrun treatment commitment for 20.10.2026); the `AG-…-04` paper at 1.4 business days; tomorrow's first actions sequenced; the Arcadia-authored minute closed and circulated to `P-010`, `P-007` and `P-011`, which means the supplier does not own the record of the day. `L2` 9: the five new findings cross-checked for double counting against the morning's items, returning three genuinely new (the rule, the clause 7.2 change, the detection single point of failure) and two that are the morning's findings now evidenced (the appendix divergence, the notification quality); the reassessment's open-item count recomputed, returning `TPRM-Q-2026-R04` and `-R07` as materially advanced by the event's evidence and `-R11` and `-R19` unchanged; the concentration position recomputed with the detection dependency added; the `RSK-0184` acceptance condition re-checked. `L5` 14: the consolidated `TP-0042` position written; five findings written with evidence; `MSN-2026-0217`, `-0218` and `-0221` confirmed with owners and dates; `MSN-2026-0191` re-scoped; three artefacts retained with retention classes; the minute closed and circulated; the reassessment open-item count updated; the concentration position updated; the `AG-…-04` paper updated; the overnight queue registered with five items and owners; the clause 3.4 notice held with a decision date of 08.10.2026. All released by him. `L3` 3: a prepared `AG-…-04` final draft; a prepared supplier governance agenda for the next review with six items; a prepared reassessment status note for `P-001`.

**Evidence surfaced.** The consolidated `TP-0042` position with five findings and their evidence. `EVD-2026-41905`, `-41907`, `-41911` retained. The circulated minute. Reassessment open-item recount.

**Uncertainty disclosed.** "Three of today's five findings rest on supplier-provided evidence obtained under `CTR-2023-0117-A4` clause 2.1. The supplier's written incident report, due 13.10.2026, may add, qualify or contradict it. Two findings rest on Arcadia's own records (`CHG-2024-5512`, the contract repository) and are not exposed to that risk."

**Human choice.** Whether to issue the clause 3.4 notice tomorrow or after the committee. He sets a decision date of 08.10.2026, before the papers close, so the committee sees either an issued notice or a reasoned decision not to issue one. Leaving it undecided into a committee is the one option he rules out.

**State changes.** `SYS-0031` third-party module, group partition: consolidated `TP-0042` position written with five findings, accountable `P-002`, each with evidence. `MSN-2026-0217`, `-0218`, `-0221` confirmed; `MSN-2026-0191` re-scoped. `SYS-0032`: three artefacts retained with retention class `TPRM-5Y`. Minute closed and circulated with a delivery record. Overnight queue registered with five items.

**Background reveal.** 35 actions (`L1` 12, `L2` 9, `L5` 14). 8 artefacts touched, 3 external. 0 awaiting release. 3 drafts prepared, 1 accepted, 2 held.

---

### `M10` rcsa, `P-003`

**Today.** Writes up the workshop on 07.10.2026. The dissent goes to committee on its 11:58 reasoning, uncorrected, because she never learns what actually happened.

**Already done.** `L1` 10: the day's changes to `RSK-0211` assembled; `DEC-2026-0783` at 16:41 received with its effect on `DEC-2026-0772` stated; the 12.10.2026 explanation deadline with three of four questions now partly answered from the event; the 16.10.2026 RCSA sign-off date; the overnight queue set (the revised dissent reasoning, the `MSN-2026-0214` result due 07.10.2026 12:00, the 23.09.2026 open question with `P-007`). `L2` 7: `DEC-2026-0783` reconciled against `DEC-2026-0772`, confirming that the residual moves to Medium-High by agreement rather than by escalation and that her dissent is therefore satisfied rather than upheld, which is a distinction worth recording; the `RSK-0211` Q4 assessment recomputed with the control environment now agreed as Partially Effective, returning residual 12 and outside appetite; the appetite consequence re-derived, returning that a Risikoakzeptanz is no longer realistically signable given one confirmed erroneous release and that the remediation path is the only live option; the other ten risk positions confirmed unaffected. `L5` 12: `RSK-0211` Q4 residual written at 12 with the agreed control environment rating; `DEC-2026-0772`'s reasoning revised with full history retained and its status set to satisfied by `DEC-2026-0783`; the appetite position written as outside appetite with the remediation path named as the only live option; `MSN-2026-0214`'s result registered as a dependency for the committee paper; the `AG-…-03` input section rewritten on verified facts; the explanation request annotated; the 23.09.2026 question re-confirmed with `P-007`; the four blank reason-code records confirmed as a data quality item; the RCSA sign-off path updated; the ten agreed positions confirmed; the reclassification history on `ARR-…-05` acknowledged in the assessment record; the overnight queue registered. All released by her. `L3` 3: a prepared remediation plan for `RSK-0211` with dates to be supplied by `P-007`; a prepared `AG-…-03` input final; a prepared Q1 2027 RCSA method note on condition-bounded control dependencies.

**Evidence surfaced.** `DEC-2026-0783`. `EVD-2026-41905` and `-41906`. `ARR-…-17` with the confirmed error. The revised residual computation. The full history on `DEC-2026-0772`.

**Uncertainty disclosed.** "The residual score of 12 is now agreed by both lines. It rests in part on `ARR-…-17`, which confirms one erroneous release in a 20-case sample. `MSN-2026-0214` will examine all 96 by 07.10.2026 at 12:00. If it finds substantially more errors, impact may need to be reassessed upward; if it finds none beyond the one, the score is unaffected. The assessment is written to be stable under either outcome."

**Human choice.** Whether to record her dissent as satisfied or as upheld. She records it as satisfied, which is accurate and less flattering: the disagreement resolved because evidence arrived, not because her argument prevailed. Reversible in principle, and she does not revisit it.

**State changes.** `SYS-0031`, `ARC-DE` partition: `RSK-0211` Q4 residual written at 12 with the agreed Partially Effective control environment, accountable `P-007` as assessment owner with `P-003` as facilitator, evidence `DEC-2026-0783` and `ARR-…-17`. `DEC-2026-0772` reasoning revised with history retained, status satisfied. Appetite position written with the remediation path named. `MSN-2026-0214` registered as a paper dependency.

**Background reveal.** 29 actions (`L1` 10, `L2` 7, `L5` 12). 6 artefacts touched, 2 external. 0 awaiting release. 3 drafts prepared, 1 accepted, 2 held.

---

### `M10` control-assurance, `P-004`

**Today.** Learns nothing. Reopens the file in November.

**Already done.** `L1` 9: the day's changes to `TST-2026-0318` assembled; `DEC-2026-0783` at 16:41 with both signatures; `MSN-2026-0214` due 07.10.2026 12:00 with `P-008` as owner and himself as assurer; `MSN-2026-0220`'s scope at 118 firings with 21 never examined; the three Q4 candidate controls now flagged as priority; the overnight queue set (the `MSN-2026-0214` result, the `UTC-…-02` chase on 09.10.2026, the `AG-…-03` section for 08.10.2026). `L2` 11: `DEC-2026-0783` reconciled against his 13:52 conclusion, confirming that the conclusion is unchanged at Partially Effective and that the deficiency composition has changed from three operating plus one undetermined to three operating plus one design plus 96 design instances; the conclusion's first limitation confirmed closed and the second (population time-bounding) confirmed retained and now quantified at 21 unexamined firings; the design-versus-operating split recomputed; `UTC-…-01` re-confirmed as permanently unresolvable with the design characterisation now supported by the synchronous-write fact; the three Q4 candidates re-scoped with the configuration-examination method now proven necessary; the re-performance standard re-applied to the revised conclusion. `L5` 15: the revised conclusion written with the changed deficiency composition and the retained limitation; `DEC-2026-0783` recorded with both signatures and both positions; `EXC-…-04`'s design reclassification confirmed; the 96 instances recorded as design-deficiency instances with their values; `MSN-2026-0214` and `-0220` confirmed with owners and dates; the 14:16 prediction record confirmed as the evidence of the inference's timing; four artefacts retained; the three Q4 candidates added as priority with the method; `UTC-…-01`'s permanent-unresolvability status written; the `AG-…-03` section finalised; the test revision proposal confirmed; the working papers versioned and closed for the period; the overnight queue registered. All released by him. `L3` 3: a prepared `MSN-2026-0220` test plan with a condition-bounded population; a prepared method note on condition-bounded populations for the Q1 2027 planning cycle; a prepared note to `P-017` in Internal Audit on the `MSN-2026-0147` linkage.

**Evidence surfaced.** `DEC-2026-0783` with both signatures. `EVD-2026-41905`, `-41906`, `-41907` retained. The 14:16 prediction record. The revised design-versus-operating split. `MSN-2026-0214` scope.

**Uncertainty disclosed.** "The revised conclusion retains one limitation: the tested population was time-bounded and 21 of 118 `RD-RULE-0031` firings have never been examined. `MSN-2026-0220` addresses this with a condition-bounded population and is due 24.11.2026. Until then the conclusion covers 01.06.2026 to 31.08.2026 plus the 96 instances of 06.10.2026, and no other period."

**Human choice.** Whether to write to `P-017` in Internal Audit about the `MSN-2026-0147` linkage, which invites third-line attention onto a control he has just concluded on and onto a follow-up failure that includes his own 24.09.2026 root-cause classification. He writes it. Volunteering the linkage is worth more than having it found, and it is the only act in his day that carries a personal cost with no professional upside.

**State changes.** `SYS-0031`, group partition: revised `TST-2026-0318` conclusion written with the changed deficiency composition and one retained limitation, accountable `P-004`. `DEC-2026-0783` recorded with both signatures and both positions. `EXC-…-04` design reclassification confirmed; 96 design-deficiency instances recorded with values. `MSN-2026-0214` and `-0220` confirmed. Working papers versioned and closed. `SYS-0032`: four artefacts retained.

**Background reveal.** 35 actions (`L1` 9, `L2` 11, `L5` 15). 9 artefacts touched, 3 external. 0 awaiting release. 3 drafts prepared, 1 accepted, 2 held.

---

### `M10` incident-resilience, `P-005`

**Today.** Closes the bridge at 17:00 with a Word document of notes. Writes the incident record properly on 08.10.2026. Both classification assessments get documented retrospectively, and the `ITOL-0004-03` two-measure problem is never noticed, because whoever writes it up picks the measure that gives the comfortable answer.

**Already done.** `L1` 13: `INC-2026-0412` held open at `S1` pending the supplier report due 13.10.2026, with the reassessment triggers on both classification decisions live; the overnight queue set (`MSN-2026-0219` recommendation for 13.10.2026, `MSN-2026-0216` part two now unblocked, the `AG-…-08` paper for 08.10.2026, the `MSN-2026-0214` result, the fallback test resourcing request); the `ARC-CH` rolled payments tracked to value date 07.10.2026; the 08.10.2026 deadline at 1.4 business days; `P-013` and `P-014` briefed with the day's verified position and the one open question. `L2` 12: the incident timeline assembled from all 18 arrivals with classes and the one reclassification preserved; the two provisional classification conclusions confirmed as carrying reassessment triggers; the `ITOL-0004-03` divergence documented on both measures with the open question stated; `MSN-2026-0219`'s scope extended from `ITOL-0004-03` to all four `IBS-0004` tolerances after checking each for the same defect, returning `ITOL-0004-01` as having one measure and `ITOL-0004-02` as having one and `ITOL-0004-04` as having one, so only one tolerance is affected and the review is proportionate; the dependency map extension scoped to subprocessor depth with `TP-0042.2` and `TP-0042.3` named; the fallback test design updated with the control-effect observation point that today proved necessary. `L5` 18: the incident timeline written with all 18 arrivals at their classes and the reclassification preserved; both classification decisions confirmed provisional with triggers; Conflict D written as an open question with `P-005` as owner and `AG-…-08` as destination; `MSN-2026-0219` created and scoped to one affected tolerance; `MSN-2026-0216` part two unblocked with `EVD-2026-41905`; the `RB-PAY-007` section 4 assertion recorded as disproved; the dependency map extension registered; the fallback test design updated; `KRI-RES-005` recomputed; the `ARC-CH` rolled payments tracked; the 34-minute detection lag written as a resilience finding against `TP-0042`; the `ITOL-0004-04` breach count confirmed at 96 with one demonstrated consequence; five artefacts retained; `DEC-2026-0776` confirmed as irreversible and executed; the `RB-PAY-011` single-use data point recorded as not constituting validation; the overnight queue registered; `P-013` and `P-014` briefing records written; the incident held open with a review date. All released by her or by `P-015` for `ARC-CH` records. `L3` 3: a prepared `AG-…-08` paper with the concrete case and a recommendation; a prepared lessons note with four items; a prepared 2027 tolerance review scope.

**Evidence surfaced.** The full 18-arrival timeline with classes and one reclassification. `EVD-2026-41882`, `-41905`, `-41911`, `-41918`, `-41921` retained. Both provisional classification records with triggers. The four-tolerance defect check.

**Uncertainty disclosed.** "`ARC-CH` cannot state whether `ITOL-0004-03` was breached. Measure 1 was satisfied; measure 2 was exceeded by 11 minutes. No precedence exists. This question is open, owned by `P-005`, and destined for `AG-…-08` on 13.10.2026. It is recorded as open and will not be resolved by this system." And: "Both classification conclusions are provisional and both carry a reassessment trigger on receipt of the supplier report due 13.10.2026. Illustrative regulatory context, not legal advice."

**Human choice.** Whether to state in the incident record that `ARC-CH` cannot determine whether its own impact tolerance was breached. She states it. The alternative, picking the measure that gives the comfortable answer, would have been unremarkable, undetectable and the single worst act available to anyone in the product. Irreversible once written, and correctly so.

**State changes.** `SYS-0031`, group partition: `INC-2026-0412` timeline written with all 18 arrivals at their classes and the `ARR-…-05` reclassification preserved, incident held open at `S1` with a 13.10.2026 review date, accountable `P-005`. Conflict D written as an open question with owner and destination. `MSN-2026-0219` created and scoped. `MSN-2026-0216` part two unblocked. Resilience finding written on the 34-minute detection lag. `KRI-RES-005` recomputed. `ARC-CH` partition: rolled payments tracked to 07.10.2026; `DEC-2026-0775` and `-0776` confirmed. `SYS-0032`: five artefacts retained.

**Background reveal.** 43 actions (`L1` 13, `L2` 12, `L5` 18). 10 artefacts touched, 4 external. 0 awaiting release. 3 drafts prepared, 1 accepted, 2 held.

---

### `M10` regulatory-change, `P-006`

**Today.** Goes home. Learns about the event at the incident review. The `REG-2026-0104` consultation closes on 23.10.2026 with no precedence requirement, and every tolerance written under it inherits the defect.

**Already done.** `L1` 8: the day's obligation state changes assembled per lane; the sent consultation comment tracked to the 23.10.2026 close; the Group Legal IKS-waiver question logged with an owner and no expected date, which is honest; the overnight queue set (both noting papers for 08.10.2026, the Legal question, the `SVC-0042-03` classification question, the Pune transfer question); both paper deadlines at 1.4 business days. `L2` 8: the day's obligation state changes counted per lane, returning four in the EU lane and three in the Swiss lane, with none crossing; the `REG-2026-0031` four-state decomposition recomputed after the event's evidence, returning one record moved from mapped-and-unevidenced to evidenced and one new unmapped obligation, so the headline percentage barely moves while the structure improves, which is exactly why the percentage is the wrong measure; the Swiss-lane inventory scope clarification re-tested against the event's facts and returned as strengthened; the `SVC-0042-03` question re-assessed and returned as requiring a classification decision rather than further analysis. `L5` 11: the day's obligation state changes written per lane with no crossing; the `REG-2026-0031` four-state recomputation written; the consultation comment record confirmed with its evidence; the Legal question logged with an owner; both noting papers updated with the event's obligation effects; the Swiss-lane clarification strengthened; the `SVC-0042-03` classification decision request raised to `P-002` and `P-007`; the dual-lane Meridian tracking confirmed; two artefacts retained; the reassessment triggers on both classification records confirmed from his framework-owner position; the overnight queue registered. All released by him. `L3` 2: prepared final drafts of `AG-…-06` and `AG-…-07`.

**Evidence surfaced.** The seven obligation state changes, four EU lane and three Swiss lane, none crossing. The recomputed four-state decomposition. The sent consultation comment with its case. `EVD-2026-41905` and `-41911` retained. Illustrative regulatory context, not legal advice.

**Uncertainty disclosed.** "The `REG-2026-0031` headline completeness figure moves from 94.6% to 94.8% while the underlying structure improves materially: one record newly evidenced, one new unmapped obligation identified. A percentage that barely moves while the picture improves is evidence that the percentage is the wrong measure, and the committee paper presents the four-state decomposition for that reason."

**Human choice.** Whether to present a figure that has barely moved, which invites a question about why a day of work changed nothing, or to explain why the figure is the wrong measure, which is a harder argument to a committee that likes percentages. He explains. A noting item that trains a committee to read the right measure is worth more than one that reports a comfortable number.

**State changes.** `SYS-0031`: seven obligation state changes written, four in the `ARC-DE` and `ARC-AT` partitions and three in the `ARC-CH` partition, no crossing, accountable `P-006`, all labelled illustrative regulatory context, not legal advice. Consultation comment record confirmed against `REG-2026-0104`. Legal question logged with an owner. `SVC-0042-03` classification decision request raised. `SYS-0032`: two artefacts retained.

**Background reveal.** 27 actions (`L1` 8, `L2` 8, `L5` 11). 6 artefacts touched, 2 external. 0 awaiting release. 2 drafts prepared, both accepted.

---

### `M10` nfr-governance, `P-001`

**Today.** Works until 21:00 assembling papers from six people's emails. Two papers are late. The tenth item is not added because she does not know enough to add it. The committee on 13.10.2026 notes an incident and takes no decision.

**Already done.** `L1` 18: all six roles' day-end states assembled into one group position; `DEC-2026-0783` at 16:41 received and its effect on `AG-…-03` computed; the six decision items with per-item readiness against 08.10.2026 12:00, now showing five drafted and one in draft; the eight new Massnahmen reconciled into the portfolio with owners, dates and dependencies; the one open conflict, Conflict D, shown with its owner and destination; the three-business-day supplier report gap registered as a standing constraint; the overnight queue set across all six roles with handoffs; tomorrow's sequence built around the 07.10.2026 12:00 `MSN-2026-0214` result, which is the last fact that will exist before papers close. `L2` 14: the finalised eight-node causal chain re-tested against the day's verified facts, returning five evidenced links, two inferred and one newly evidenced by `EVD-2026-41906`; each of the six decision items re-tested for whether it asks one answerable question on the facts that will exist at 08.10.2026 at 12:00, returning six that do; `AG-…-10`'s question re-tested against every plausible content of the supplier report, confirming it survives all of them; the day's decisions counted and checked for provisional status and reassessment triggers, returning two provisional and both triggered; the eight new Massnahmen checked for owner capacity conflicts, returning two on `P-007` with overlapping dates; `KRI-GOV-001` recomputed with the new actions, moving from 7 overdue to 7 overdue and 8 new within date; the `RSK-0184` acceptance re-assessed and returned as requiring a committee decision before its 31.12.2026 expiry. `L5` 27: the group position written; `AG-…-03` finalised on verified facts with both positions and the resolved conflict; `AG-…-10` finalised with its decision architecture; `AG-…-05` confirmed with the re-baselining recommendation, the disclosed unmet condition and the prior-extension request; the six-item cover note written; the eight new Massnahmen confirmed into the portfolio; the two `P-007` capacity conflicts flagged to him with dates; Conflict D registered as the day's one open question with owner and destination; `DEC-2026-0781` confirmed; `DEC-2026-0783` noted; the causal chain written with per-link confidence; `KRI-GOV-001` recomputed; the `RSK-0184` decision requirement registered for the committee; the `MSN-2026-0203` discipline finding confirmed; the framework defect on `ITOL-0004-04` monitoring confirmed with `MSN-2026-0219` as its remedy; six artefacts retained; the day's decision register closed with 10 shared-narrative decisions and their per-role additions; two handoff records for 07.10.2026; the overnight queue registered across six roles; the 07.10.2026 12:00 dependency registered; the three-business-day report gap registered; the two provisional decisions' triggers confirmed; the committee papers packaged; the readiness state finalised at six of six drafted. All released by her. `L3` 4: a prepared committee cover note final; a prepared framework review note on condition-bounded control dependencies and zero-tolerance monitoring; a prepared briefing note for `P-013`; a prepared Q1 2027 reporting change proposal replacing independent indicator rows with causal-chain presentation.

**Evidence surfaced.** The finalised eight-node causal chain with per-link confidence. `DEC-2026-0783`. All six roles' day-end states. The eight new Massnahmen. `KRI-GOV-001` recomputation. The `RSK-0184` acceptance re-assessment. Six artefacts retained.

**Uncertainty disclosed.** "One fact material to the committee papers does not yet exist: the `MSN-2026-0214` examination of all 96 overrides, due 07.10.2026 at 12:00. Papers close 08.10.2026 at 12:00, so it will exist in time. The supplier's report, due 13.10.2026, will not, and `AG-…-10` is constructed so that its content cannot invalidate the decision requested. Two of the causal chain's eight links remain inferred and are marked as such in every paper."

**Human choice.** Whether to propose a permanent change to group NFR reporting, replacing independent indicator rows with causal-chain presentation, on the strength of one day. She prepares it and holds it for the Q1 2027 cycle rather than attaching it to a committee already carrying six decisions. Judging how much change a governance body can absorb in one meeting is the least visible and most consequential part of her role.

**State changes.** `SYS-0031`, group partition: group position written; `AG-…-03`, `AG-…-05` and `AG-…-10` finalised; six-item cover note written; eight new Massnahmen confirmed into the portfolio with two capacity conflicts flagged to `P-007`; Conflict D registered as the day's one open question with owner `P-005` and destination `AG-…-08`; `DEC-2026-0781` confirmed and `DEC-2026-0783` noted; causal chain written with per-link confidence; `KRI-GOV-001` recomputed; `RSK-0184` decision requirement registered; framework defect on `ITOL-0004-04` confirmed with `MSN-2026-0219` as remedy; decision register closed; committee papers packaged; readiness finalised at six of six. All accountable `P-001`. `SYS-0032`: six artefacts retained.

**Background reveal.** 59 actions (`L1` 18, `L2` 14, `L5` 27). 11 artefacts touched, 2 external. 0 awaiting release. 4 drafts prepared, 2 accepted, 2 held.

---

## 13. Cross-cutting design notes

### 13.1 What the day changed

Stated as state, not as narrative, because state is what the product produces.

| Object | 07:45 | 16:45 |
|---|---|---|
| `CTL-PAY-014` Kontrollwirksamkeit | Contested: Fully Effective (1LoD) against Partially Effective (2LoD) | Agreed: Partially Effective, design deficiency shared with `TP-0042`, operating deficiency on three human deviations, both lines signed (`DEC-2026-0783`) |
| `EXC-TST-2026-0318-04` root cause | "System configuration", closed, `MSN-2026-0203` not started | Design deficiency, rule `RD-RULE-0031`, shared accountability, evidenced (`EVD-2026-41905`, `-41907`) |
| `RSK-0211` residual | Disputed 9 against 12, outside appetite unresolved | Agreed 12, outside appetite, remediation path the only live option, one confirmed materialisation |
| `RD-RULE-0031` | Unknown to every role | Known, evidenced, 118 firings since 11.11.2024, `MSN-2026-0215` to remove it |
| `CTR-2023-0117-A3` divergence | A documentation finding at 40% remediation | Three characterised routes, one notice held for 08.10.2026, operational confirmation from the supplier's own account |
| `ITOL-0004-03` | A threshold | A definitional defect with two measures, no precedence, an owner, a destination and `MSN-2026-0219`. **Still open** |
| `ITOL-0004-04` | A zero tolerance with no detection capability | 96 confirmed breaches, one demonstrated consequence, and a recorded framework defect on the missing detection |
| `TP-0042` detection capability | Unexamined | A single point of failure at `TP-0042.3`, evidenced, `MSN-2026-0218` |
| `REG-2026-0104` draft | Silent on measure precedence | Comment filed 16:47 with a concrete case, 17 days of window remaining |
| `MSN-2026-0147` | 67 days overdue, 60% claimed | Re-baselining recommended to 31.10.2026 on a verified dependency, with the committee's own unmet condition disclosed |
| `CMT-NFR-2026-10` | Five decision items, three undrafted | Six decision items, six drafted, one question constructed to survive a late supplier report |
| Open conflicts | None registered | Four resolved within the day, one open with an owner and a destination |
| New Massnahmen | | Eight, across five roles, in one portfolio |

### 13.2 Where each cell is now rendered

The sixty cells are unchanged. What changed is the interface that renders them,
and anyone comparing this document against a running screen needs the mapping.

| What this document calls it | Where it appears in the interactive workday |
|---|---|
| The moment itself | The live day bar at the foot of the shell. Each of the ten moments is a marker on the event track; the marker carries unread state per role and a heavier mark where a material decision waits |
| `todayNarrative` and `todaySignals` | The Today versus future comparison, reached from the demo menu. No longer a lede paragraph at the head of the route |
| `futureNarrative` and `futureSignals` | The same comparison, plus the Already completed list inside the Now card |
| The role headline | The eyebrow line above the page title, beside the moment |
| The decision presented at the moment | The Now card, which is the one item that needs the user, with why it appeared, what changed, what was already completed, what is needed and the next action |
| The next two or three items | The Next section of the focus queue |
| Work completed without the user | Handled automatically, collapsed by default |
| What is being monitored | Watching, compact, at the foot of the queue |
| Evidence, uncertainty, policy, approvals, activity, audit | The context drawer, opened from the compact triggers under the work object. The same seven tabs in the same order as the V1 intelligence rail |
| The role work object | The centre workspace, below the queue on Today and filling the workbench |
| The background work reveal | The Activity tab of the AI Partner, as a chronological stream with real timings |
| The shared 14:05 event | A `shared-event` row visible to every role from one record, which is what makes the propagation claim structurally true rather than six copies of a story |

Two properties of this document survive the redesign deliberately and are worth
naming, because an interface change is the easiest way to lose them.

The day still ends on an open question. Conflict D is unresolved at 16:45, it
has an owner and a destination, and nothing in the new interface closes it. The
Watching section is where it lives at the end of the day, which is the correct
place for a question that is genuinely still open.

Nothing human-owned is pre-decided. The focus queue is derived from real state,
so an item appears in Needs you because a decision row is open, and moves out
of it because a human recorded a decision. The queue cannot show a decision as
handled that nobody took.

### 13.3 The three things a viewer should take from the day

1. **The morning mattered more than the event.** `P-004`'s configuration request at 08:52 is the single act that determines the day's outcome, and it happened five hours and thirteen minutes before the event, from a lane 2 disclosure that named the missing evidence and the contractual route to obtain it. The event confirmed what the morning had already framed.
2. **The product's credibility is its refusal.** At 14:34, `ARR-…-05` gave `P-003` exactly what her 11:58 dissent needed, and the product told her not to use it because it was a telemetry inference contradicted by a named stakeholder. A system that hands a professional the answer they want is not a professional tool.
3. **The day ends with an open question.** Conflict D is unresolved at 16:45, owned by `P-005`, destined for `AG-…-08` on 13.10.2026. A working day that resolves every question is not a credible working day, and the product should end on the honest state rather than on a closing summary.

### 13.4 Anti-patterns, explicitly prohibited

- A lane 4 moment with a pre-selected option, a ranked option list, or a pre-drafted rationale.
- A reveal count that does not resolve to a seeded ledger row with inputs and outputs.
- A telemetry inference displayed without its measurement and its falsification condition.
- A stakeholder statement restated as a fact, or shown without its speaker and time.
- A reclassification that overwrites rather than appends.
- A group aggregate that applies an EU framework label to `ARC-CH`, or a group total on an EU-derived measure across all three entities.
- A regulatory reference without "Illustrative regulatory context, not legal advice." at the point of display.
- Any surface without "Synthetic institution and data".
- A state change written without all five mandatory attributes.
- A closing summary that resolves Conflict D.
- Any use of the em dash character.

---

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

*End of `DOC-EXPERIENCE-MAP` version 1.0.*
