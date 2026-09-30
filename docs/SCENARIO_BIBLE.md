# SCENARIO BIBLE
## NFR WorkOS: Live the NFR Day
### Single source of truth for all synthetic content

**Synthetic institution and data.**

| Field | Value |
|---|---|
| Document ID | DOC-SCENARIO-BIBLE |
| Version | 1.0 |
| Status | Baseline. Authoritative. |
| Date | 30.09.2026 |
| Owner | Principal NFR Service Designer |
| Consumers | Engineering, scenario seeding, presentation design, narration |

---

## 0. How to use this document

This document is the only permitted source of names, identifiers, figures, timestamps and factual claims in NFR WorkOS. If a value is needed and it is not here, it must be added here first and then used. Engineers must not invent supplementary facts in code, fixtures or copy.

Three rules govern everything downstream.

1. **Synthetic institution and data.** Every screen, page, export and narration that shows Arcadia content carries this label. No exception, including internal builds.
2. **Illustrative regulatory context, not legal advice.** Every regulatory reference carries this label at the point of display, not only in a footer. See section 18.
3. **No compliance claims.** The product never states or implies that Arcadia, or a user, is compliant with any regulation. It states what an obligation appears to require, what evidence exists, and what is missing.

### 0.1 Prohibited constructions

- The em dash character is not used anywhere in the product or its documentation. Use commas, colons, semicolons, parentheses or separate sentences.
- No external benchmarks. Every quantity in this document is a scenario figure for a synthetic institution. Where a figure could be mistaken for an industry reference, it is labelled "scenario figure".
- No claim that DORA applies to Arcadia Bank Schweiz AG. See section 18.3.

### 0.2 Formatting standards

| Standard | Rule |
|---|---|
| Dates | DD.MM.YYYY |
| Times | 24-hour, HH:MM or HH:MM:SS |
| Time zone | CET/CEST, displayed as "CET" throughout the scenario day |
| Currency | EUR for ARC-DE and ARC-AT; CHF for ARC-CH; always show the code |
| Terminology | Paired labels, English / German / abbreviation. See section 18.4 |

---

## 1. Identifier convention

All identifiers follow one pattern.

```
<TYPE>-<SCOPE>-<SEQUENCE>
```

- `TYPE` is a fixed uppercase token from the table below.
- `SCOPE` is one of: an entity code (`ARC-DE`, `ARC-AT`, `ARC-CH`), a domain code (`PAY`, `TPR`, `RES`, `REG`, `GOV`), a four-digit year, or a parent identifier.
- `SEQUENCE` is a zero-padded integer, monotonically increasing within its scope. Width is fixed per type and never changes.

Identifiers are immutable. If an object is superseded, a new identifier is issued and the old one is retained with a pointer. Identifiers are never reused.

| TYPE | Meaning | German term | Scope | Width | Example |
|---|---|---|---|---|---|
| entity code | Legal entity | Rechtseinheit | none | n/a | `ARC-DE` |
| `P` | Person | Person | none | 3 | `P-001` |
| `IBS` | Important business service | Wichtige Geschaeftsdienstleistung | none | 4 | `IBS-0004` |
| `PRC` | Process | Prozess | none | 4 | `PRC-0041` |
| `SYS` | System or application | System | none | 4 | `SYS-0012` |
| `RSK` | Risk | Risiko | none | 4 | `RSK-0211` |
| `CTL` | Control | Kontrolle | domain | 3 | `CTL-PAY-014` |
| `TST` | Control test | Kontrolltest | year | 4 | `TST-2026-0318` |
| `EXC` | Test exception | Feststellung | parent test | 2 | `EXC-TST-2026-0318-01` |
| `UTC` | Unable to conclude item | Nicht abschliessend beurteilbar | parent test | 2 | `UTC-TST-2026-0318-01` |
| `KRI` | Key risk indicator | Risikoindikator | domain | 3 | `KRI-PAY-007` |
| `RCSA` | Risk and control self assessment | Risiko- und Kontrollselbstbewertung | entity + unit + period | n/a | `RCSA-ARC-DE-PAYOPS-2026-Q4` |
| `MSN` | Remediation action | Massnahme | year | 4 | `MSN-2026-0147` |
| `TP` | Third party | Drittpartei | none | 4 | `TP-0042` |
| `TP-nnnn.n` | Subprocessor of a third party | Unterauftragnehmer | parent | 1 | `TP-0042.4` |
| `TP-nnnn.n-Fm` | Fourth party under a subprocessor | Viertpartei | parent | 1 | `TP-0042.3-F1` |
| `SVC` | Service provided by a third party | Dienstleistung | parent third party | 2 | `SVC-0042-02` |
| `CTR` | Contract | Vertrag | year | 4 | `CTR-2023-0117` |
| `CTR-yyyy-nnnn-An` | Contract appendix | Vertragsanlage | parent contract | 1 | `CTR-2023-0117-A3` |
| `INC` | Incident | Vorfall | year | 4 | `INC-2026-0412` |
| `ITOL` | Impact tolerance | Toleranzschwelle | parent IBS | 2 | `ITOL-0004-03` |
| `EVD` | Evidence artefact | Nachweis | year | 5 | `EVD-2026-41905` |
| `DEC` | Human decision record | Entscheidungsprotokoll | year | 4 | `DEC-2026-0771` |
| `ACT` | Seeded automated action | Automatisierte Aktion | lane + year | 5 | `ACT-L2-2026-01884` |
| `ARR` | Information arrival in an event | Informationseingang | parent incident | 2 | `ARR-INC-2026-0412-07` |
| `CMT` | Committee meeting | Gremiensitzung | year | 2 | `CMT-NFR-2026-10` |
| `AG` | Committee agenda item | Agendapunkt | parent meeting | 2 | `AG-CMT-NFR-2026-10-03` |
| `REG` | Regulatory change item | Regulatorisches Vorhaben | year | 4 | `REG-2026-0088` |
| `OBL` | Regulatory obligation | Anforderung | parent REG | 3 | `OBL-2026-0088-014` |
| `CHG` | Change record | Aenderung | year | 4 | `CHG-2026-7741` |
| `AUD` | Internal audit report | Revisionsbericht | year | 2 | `AUD-2025-09` |
| `NSN` | Novalink service notification | Stoerungsmeldung | year | 4 | `NSN-2026-0887` |
| `RD-RULE` | RepairDesk configuration rule | Regel | none | 4 | `RD-RULE-0031` |
| `NOVA-CR` | Novalink change request | Aenderungsanforderung | none | 4 | `NOVA-CR-4412` |
| `RB` | Runbook | Handbuch | domain | 3 | `RB-PAY-007` |
| `EVD` query | Evidence query record | Abfrage | year | 5 | `QRY-2026-88104` |

Short codes used inside records, not standalone identifiers: payment failure reason codes `R01` to `R08`; override reason codes `OVR-A` to `OVR-E`; severity `S1` to `S4`; fact classes `VF`, `SS`, `TI`; work lane codes `L1` to `L5`.

German terms in this document are written without the eszett character and without umlaut diacritics in identifier tables, to keep code-facing content ASCII-safe. Display surfaces use correct German orthography with "ss" for the eszett, per section 18.4.

---

## 2. Scenario clock and calendar

The product always runs one day: **Tuesday, 06.10.2026**. Time is deterministic and seeded. The clock is scenario time, not wall-clock time, and it can be scrubbed.

| Anchor | Date | Weekday | Note |
|---|---|---|---|
| Baseline month | 01.08.2026 to 31.08.2026 | | Comparison month for all trend figures |
| Previous month | 01.09.2026 to 30.09.2026 | | The month referred to as "last month" in the morning situation |
| KRI reporting run | 05.10.2026 | Monday | Data as at 30.09.2026; breaches published 06:00 |
| **Scenario day** | **06.10.2026** | **Tuesday** | The whole product |
| Next business day | 07.10.2026 | Wednesday | Value date for rolled payments |
| Committee papers due | 08.10.2026, 12:00 | Thursday | Hard cut-off in the scenario |
| NFR Committee | 13.10.2026, 14:00 to 16:30 | Tuesday | `CMT-NFR-2026-10` |
| Novalink incident report due | 13.10.2026 | Tuesday | Five business days after the event; arrives on committee day |
| Novalink reassessment target close | 31.10.2026 | Saturday | Cycle deadline, not a working deadline |

### 2.1 The fixed daily timeline

Shared by all six roles. Every role has content at every moment. Moment identifiers are used in code and in the presentation.

| Moment | Time | Name |
|---|---|---|
| `M01` | 07:45 | Morning decision brief |
| `M02` | 08:10 | Inbox converted into work |
| `M03` | 08:45 | Evidence and workbench |
| `M04` | 09:30 | Asynchronous factual validation |
| `M05` | 10:30 | Function-specific meeting or workshop |
| `M06` | 11:45 | Human decision point |
| `M07` | 13:30 | Remediation, negotiation or execution design |
| `M08` | 14:05 | Shared supplier and payments event |
| `M09` | 15:00 | Event response and stakeholder engagement |
| `M10` | 16:30 | End-of-day summary and overnight work |

---

## 3. The institution

**Arcadia Banking Group.** Synthetic institution and data.

| Attribute | Value |
|---|---|
| Group parent | Arcadia Banking Group AG, Frankfurt am Main |
| Type | Mid-large universal banking group (scenario profile) |
| Business lines | Retail banking, corporate banking, payments |
| Employees | Approximately 16,000 (scenario figure) |
| Countries of operation | Germany, Austria, Switzerland |
| Group functions | Risk, Finance, Technology, Operations, Procurement, Legal, Compliance, Internal Audit |
| NFR operating model | Central policy and group-level governance; local legal-entity accountability; shared technology and third-party services |
| Group reporting currency | EUR |

These are scenario figures, not benchmarks.

### 3.1 Legal entities

| Entity code | Legal name | Country | Locations | Functional currency | Employees (scenario figure) | Prudential context |
|---|---|---|---|---|---|---|
| `ARC-DE` | Arcadia Bank AG | Germany | Frankfurt am Main (head office), Munich (payment operations hub) | EUR | approx. 9,400 | EU credit institution |
| `ARC-AT` | Arcadia Bank Oesterreich AG | Austria | Vienna | EUR | approx. 2,900 | EU credit institution |
| `ARC-CH` | Arcadia Bank Schweiz AG | Switzerland | Zurich | CHF | approx. 3,700 | Swiss bank, FINMA supervised |

All group functions are employed by `ARC-DE` and charged out under intragroup service agreements. This detail matters: group NFR staff are legally `ARC-DE` employees performing work for `ARC-AT` and `ARC-CH` under intragroup arrangements, which is why local entity sign-off is always required and cannot be absorbed by the group function.

### 3.2 NFR operating model, in the detail engineers need

- **Policy layer.** One Group NFR Framework, one Group Operational Risk Policy, one Group Third-Party Risk Policy, one Group Operational Resilience Policy. Each has a mandatory local adoption step per entity, with a documented local deviation register.
- **Three lines.** First Line of Defence / 1LoD owns processes, controls and remediation. Second Line of Defence / 2LoD owns framework, challenge, independent assessment and aggregate reporting. Internal Audit is the third line and is out of scope as a user role but present as a stakeholder.
- **Committee structure.** Entity NFR Committees for `ARC-DE`, `ARC-AT`, `ARC-CH`, each feeding the Group NFR Committee. The Group NFR Committee cannot overrule an entity board; it can require an entity to take a decision and record it.
- **Systems of record.** One group GRC platform (`SYS-0031` Arcadia RiskCore) holds risks, controls, tests, findings, Massnahmen, RCSAs, third parties and incidents, with entity partitioning. Evidence lives in `SYS-0032` Arcadia Evidence Vault with immutable versioning.
- **Consequence for the product.** Any state change written by NFR WorkOS must name the target system of record, the entity partition, the record identifier, the accountable human and the evidence reference. A state change without all five is invalid and must be rejected.

---

## 4. People register

Synthetic institution and data. All persons are fictional. Eighteen named people; six are the NFR professional roles that the product serves, twelve are the counterparties they work with.

### 4.1 The six NFR professional roles (product users)

| ID | Name | Role | Role slug | Entity | Location | Function | Reports to |
|---|---|---|---|---|---|---|---|
| `P-001` | Dr. Katharina Vogt | NFR Portfolio Lead | `nfr-governance` | `ARC-DE`, group mandate | Frankfurt | Group Non-Financial Risk | `P-013` Claudia Renner |
| `P-002` | Stefan Brunner | Third-Party Risk Manager | `tprm` | `ARC-DE`, group mandate | Frankfurt | Group Third-Party Risk Management / Drittparteienrisikomanagement | `P-001` |
| `P-003` | Marlene Aigner | Operational Risk Partner | `rcsa` | `ARC-DE` | Frankfurt, standing presence in Munich | Operational Risk, Payments and Transaction Banking coverage | `P-001` |
| `P-004` | Jakob Steinbacher | Control Assurance Specialist | `control-assurance` | `ARC-AT`, seconded to group | Vienna | Group Control Assurance, Internes Kontrollsystem (IKS) testing | `P-001` |
| `P-005` | Nadia Lehmann | Incident and Resilience Lead | `incident-resilience` | `ARC-CH`, group mandate for operational resilience | Zurich | Group Operational Resilience and Business Continuity Management | `P-001` |
| `P-006` | Tobias Reinhardt | Regulatory Change Manager | `regulatory-change` | `ARC-DE`, group mandate | Frankfurt | Group Compliance, Regulatory Change | Group Chief Compliance Officer, dotted line to `P-001` |

Design note. `P-005` sits in Zurich with a group mandate deliberately. It forces the Swiss and EU regulatory lanes to be visibly separate inside one person's working day, and it is why the resilience role is the one that most often has to say "that applies to two of our three entities".

### 4.2 Counterparties, first line and governance

| ID | Name | Role | Line | Entity | Location | Why they matter in this scenario |
|---|---|---|---|---|---|---|
| `P-007` | Andreas Kellner | Head of Payment Operations, process owner for `PRC-0041` | 1LoD | `ARC-DE` | Munich | Accountable owner of the overdue Massnahme `MSN-2026-0147` and of the fallback decision |
| `P-008` | Beatrix Hofmann | Payment Repair Team Lead, control owner for `CTL-PAY-014` | 1LoD | `ARC-DE` | Munich | Assesses the control as Fully Effective against the 2LoD conclusion; the central professional disagreement of the day |
| `P-009` | Elif Demir | Senior Payment Repair Analyst, designated Secondary Reviewer, acting Duty Manager on 06.10.2026 | 1LoD | `ARC-DE` | Munich | The only filled senior secondary reviewer seat; activates the fallback route at 14:12 |
| `P-010` | Lukas Wiesinger | Category Lead, Payments Technology, Group Procurement | 1LoD | `ARC-AT` | Vienna | Owns the Novalink commercial relationship and the contract change route |
| `P-011` | Miriam Falk | Client Service Director, Novalink Payment Services GmbH | Supplier | Supplier | Frankfurt | Novalink's contractual voice; makes the statement that conflicts with `P-008` |
| `P-012` | Ralf Ostermann | Head of Service Continuity, Novalink Payment Services GmbH | Supplier | Supplier | Frankfurt | Gives the early root-cause statement that later proves incomplete |
| `P-013` | Claudia Renner | Group Chief Risk Officer | 2LoD | `ARC-DE` | Frankfurt | Escalation recipient at severity `S1`; owns group risk appetite |
| `P-014` | Dr. Heinrich Adler | Group Chief Operating Officer; Chair, Group NFR Committee | Governance | `ARC-DE` | Frankfurt | Chairs `CMT-NFR-2026-10`; the audience for the day's decisions |
| `P-015` | Sibylle Graf | Resilience Officer, Arcadia Bank Schweiz AG | Local hybrid 1LoD and 2LoD role | `ARC-CH` | Zurich | Holds the Swiss impact tolerance position and the euroSIC cut-off problem |
| `P-016` | Dr. Anja Weiss | Outsourcing Counsel, Group Legal | Group function | `ARC-DE` | Frankfurt | Establishes which contract appendix version is binding |
| `P-017` | Peter Maurer | Head of Group Internal Audit | 3LoD | `ARC-DE` | Frankfurt | Source of `AUD-2025-09`; observer at the committee |
| `P-018` | Tomas Nowak | Former Secondary Reviewer, position `PR-SR-02` | 1LoD, former | `ARC-DE` | Munich | Resigned 31.07.2026; his unfilled seat is the capacity driver |

`P-018` is included because a named vacancy is more useful to the product than an abstract one: the seat has a position identifier, a leaver and a date.

### 4.3 Notification and escalation map

| Trigger | Notify | Channel |
|---|---|---|
| KRI red breach published | `P-003` (owner), `P-007` (process owner), `P-001` (portfolio) | GRC platform notification plus morning brief |
| Control test exception raised | `P-008` (control owner), `P-007`, `P-003`, `P-001` | GRC platform |
| Incident severity `S2` | `P-005`, `P-007`, `P-001`, entity resilience officer | Incident bridge plus SMS |
| Incident severity `S1` | All of `S2` plus `P-013`, `P-014`, entity CEO (unnamed) | Incident bridge plus SMS plus call |
| Supplier notification received | `P-002`, `P-010`, `P-007` | Shared mailbox `payments-supplier@arcadia.example` |
| Subprocessor change identified | `P-002`, `P-016`, `P-010` | GRC platform third-party module |

---

## 5. Important business service: Corporate Payments

| Attribute | Value |
|---|---|
| ID | `IBS-0004` |
| Name | Corporate Payments |
| German label | Firmenkundenzahlungsverkehr |
| Definition | End-to-end execution of outbound payment instructions submitted by corporate and institutional clients, from instruction receipt to clearing submission and confirmation |
| Entities served | `ARC-DE`, `ARC-AT`, `ARC-CH` |
| Designation | Important business service at group level; critical or important function for `ARC-DE` and `ARC-AT`; significant business process for `ARC-CH` |
| Service owner | `P-007` Andreas Kellner |
| Executive owner | `P-014` Dr. Heinrich Adler |
| Resilience owner | `P-005` Nadia Lehmann, with `P-015` Sibylle Graf for `ARC-CH` |

Illustrative regulatory context, not legal advice.

### 5.1 In-scope payment types

| Code | Payment type | Format | Entities | Clearing route |
|---|---|---|---|---|
| `PT-01` | SEPA credit transfer | `pain.001` / `pacs.008` | `ARC-DE`, `ARC-AT`, `ARC-CH` (EUR) | T2 and RT1 via `SVC-0042-01` |
| `PT-02` | SEPA instant credit transfer | `pacs.008` instant | `ARC-DE`, `ARC-AT` | TIPS via `SVC-0042-01` |
| `PT-03` | High-value EUR payment | `pacs.008` RTGS | `ARC-DE`, `ARC-AT` | T2 RTGS, dual path: `SVC-0042-01` primary, Arcadia direct participant link secondary |
| `PT-04` | Cross-border non-EUR payment | `pacs.008` / MT103 | All | Correspondent network |
| `PT-05` | CHF domestic payment | `pain.001` CH | `ARC-CH` | SIC and euroSIC via `SVC-0042-05` |
| `PT-06` | Bulk file payment | `pain.001` bulk | All | Route by underlying type |

### 5.2 Volumes (scenario figures)

| Metric | August 2026 | September 2026 | Change |
|---|---|---|---|
| Group instructions received | 2,362,000 | 2,411,000 | +2.1% |
| `ARC-DE` instructions | 1,870,000 | 1,905,000 | +1.9% |
| `ARC-AT` instructions | 297,000 | 308,000 | +3.7% |
| `ARC-CH` instructions | 195,000 | 198,000 | +1.5% |
| `ARC-DE` instructions entering repair queue | 42,636 (2.28%) | 51,435 (2.70%) | +20.6% |
| `ARC-DE` manual overrides | 412 | 731 | +77.4% |
| `ARC-AT` manual overrides | 71 | 128 | +80.3% |
| `ARC-CH` manual overrides | 38 | 49 | +28.9% |
| `ARC-DE` overrides per 10,000 instructions | 2.20 | 3.84 | +1.64 |

These are scenario figures, not benchmarks. The asymmetry matters: repair volume rose 20.6% while overrides rose 77.4%. Overrides grew far faster than the queue that produces them. That gap is the analytical hook of the morning, because it means behaviour changed, not only volume.

### 5.3 Impact tolerances

| ID | Entity scope | Statement | Measure | Set by | Last reviewed |
|---|---|---|---|---|---|
| `ITOL-0004-01` | `ARC-DE`, `ARC-AT` | Maximum tolerable disruption to same-day EUR payment submission is 4 hours during a business day | Elapsed time from confirmed disruption start to restoration of submission capability | Entity NFR Committees | 11.03.2026 |
| `ITOL-0004-02` | Group | No more than 0.5% of daily corporate payment value is delayed beyond its value-date cut-off | Value delayed divided by total daily value | Group NFR Committee | 11.03.2026 |
| `ITOL-0004-03` | `ARC-CH` | Maximum tolerable disruption to CHF and euroSIC submission is 2 hours, and submission must complete before the 16:00 CET same-day cut-off | Two measures: elapsed disruption time, and submission completion versus cut-off | `ARC-CH` Board Risk Committee | 24.02.2026 |
| `ITOL-0004-04` | Group | No corporate payment is released without the control gates defined for its release path | Count of releases with an unsatisfied mandatory gate; tolerance is zero | Group NFR Committee | 11.03.2026 |

`ITOL-0004-03` contains two measures that can diverge, and they do diverge during the 14:05 event. This is deliberate and it is the most valuable single finding of the scenario day. `ITOL-0004-04` has a zero tolerance and the event produces 96 candidate breaches against it.

The 16:00 CET Swiss same-day cut-off is a scenario figure, set for the scenario and not taken from any published market timetable.

Illustrative regulatory context, not legal advice.

---

## 6. Core process: Payment repair and manual override

This section is written so that an engineer can model the process without further input.

| Attribute | Value |
|---|---|
| ID | `PRC-0041` |
| Name | Payment repair and manual override |
| German label | Zahlungsreparatur und manuelle Ueberschreibung |
| Parent service | `IBS-0004` Corporate Payments |
| Process owner | `P-007` Andreas Kellner |
| Operating location | Munich hub for `ARC-DE` and `ARC-AT`; Zurich for `ARC-CH` |
| Operating hours | 06:00 to 19:00 CET, business days; on-call 19:00 to 06:00 |
| Headcount | 34 FTE Munich, 6 FTE Zurich (scenario figures) |
| Primary system | `SYS-0014` Novalink RepairDesk |
| Key risk | `RSK-0211` Erroneous or unauthorised payment release |
| Key control | `CTL-PAY-014` Independent secondary review of manual payment overrides |

### 6.1 Systems

| ID | System | Owner | Provider | Role in the process |
|---|---|---|---|---|
| `SYS-0011` | Arcadia Payment Hub (APH) | `ARC-DE` Technology | In-house | Instruction intake, orchestration, state machine of record for payment instructions, routing |
| `SYS-0012` | Novalink Gateway (NOVA-GATE) | `ARC-DE` Technology | `TP-0042`, `SVC-0042-01` | Format validation, enrichment, clearing connectivity for T2, RT1, TIPS |
| `SYS-0013` | Arcadia Direct Link (ADL) | `ARC-DE` Treasury Technology | In-house | Arcadia's own T2 direct participant connection, used as the fallback clearing route; performs no payment data validation |
| `SYS-0014` | Novalink RepairDesk | `ARC-DE` Operations | `TP-0042`, `SVC-0042-02` | Repair queue, override creation, four-eyes enforcement, override audit log |
| `SYS-0015` | euroSIC Adapter | `ARC-CH` Technology | `TP-0042`, `SVC-0042-05` | SIC and euroSIC submission for `ARC-CH` |
| `SYS-0016` | Sanctions Screening Platform | Group Compliance | Third party, out of scope | Screens instructions; screening holds are not repair items |
| `SYS-0017` | Client Static Data Master | `ARC-DE` Operations | In-house | Authoritative source for client account, mandate and beneficiary static data |
| `SYS-0031` | Arcadia RiskCore (GRC platform) | Group NFR | Third party, in scope as system of record | Risks, controls, tests, findings, Massnahmen, RCSA, third parties, incidents |
| `SYS-0032` | Arcadia Evidence Vault | Group NFR | In-house | Immutable evidence store, versioned, hash-addressed |

Concentration note for the third-party role: Novalink provides `SYS-0012`, `SYS-0014` and `SYS-0015`. The supplier that validates payments also supplies the tool that repairs and overrides them, and also supplies the Swiss clearing adapter. That is the single most important structural fact about the Novalink relationship and the reason the 14:05 event affects validation, repair and Swiss clearing simultaneously.

### 6.2 Payment instruction state machine

States on the instruction record held in `SYS-0011`.

```
RECEIVED
  -> VALIDATING
       -> STP_PASSED            -> SUBMITTED -> ACKNOWLEDGED -> SETTLED
       -> VALIDATION_FAILED     -> REPAIR_QUEUED

REPAIR_QUEUED
  -> REPAIR_IN_PROGRESS
       -> REPAIRED_REVALIDATE   -> VALIDATING          (loop, max 3 cycles)
       -> OVERRIDE_PROPOSED
       -> RETURNED_TO_CLIENT                           (terminal)
       -> CANCELLED                                    (terminal)
       -> ROLLED_TO_NEXT_VALUE_DATE                    (terminal for the day)

OVERRIDE_PROPOSED
  -> AWAITING_SECONDARY_REVIEW   (only when secondaryReviewRequired = true)
       -> REVIEW_APPROVED        -> RELEASED_WITH_OVERRIDE
       -> REVIEW_REJECTED        -> REPAIR_IN_PROGRESS
  -> RELEASED_WITH_OVERRIDE      (direct, when secondaryReviewRequired = false)

RELEASED_WITH_OVERRIDE
  -> SUBMITTED -> ACKNOWLEDGED -> SETTLED
```

The transition `OVERRIDE_PROPOSED -> RELEASED_WITH_OVERRIDE` without passing `AWAITING_SECONDARY_REVIEW` is the transition at the heart of this scenario. It is a legitimate, implemented transition in `SYS-0014`. Nobody bypassed anything. The rule itself removed the gate. Engineers must implement it as a first-class path, not as an error.

### 6.3 Validation failure reason codes

Assigned by `SYS-0012` NOVA-GATE, or by `SYS-0011` when NOVA-GATE is bypassed.

| Code | Description | German | Typical resolution | Enters repair queue |
|---|---|---|---|---|
| `R01` | Invalid or unreachable IBAN and BIC combination | Ungueltige IBAN-BIC-Kombination | Repair from `SYS-0017` or client confirmation | Yes |
| `R02` | Missing or malformed regulatory reporting data for cross-border value above EUR 12,500 | Fehlende Meldedaten | Repair from client instruction text | Yes |
| `R03` | Beneficiary name and account mismatch | Namens- und Kontoabweichung | Client callback | Yes |
| `R04` | Currency or clearing route unavailable | Clearingweg nicht verfuegbar | Route substitution | Yes |
| `R05` | Duplicate suspicion | Doppelzahlungsverdacht | Analyst confirmation against prior instruction | Yes |
| `R06` | Sanctions screening pending release | Sanktionspruefung offen | Compliance queue | No, separate queue |
| `R07` | Insufficient cover at cut-off | Deckung nicht ausreichend | Treasury liquidity decision | Yes |
| `R08` | Missing corporate mandate static data | Fehlende Mandatsdaten | Static data correction | Yes |

Distribution of `ARC-DE` repair items, September 2026 (scenario figures): `R01` 31%, `R02` 22%, `R03` 14%, `R08` 10%, `R04` 9%, `R05` 8%, `R07` 6%.

### 6.4 Two resolution paths

**Path 1: standard repair.** The analyst corrects a data field using an authoritative source, the instruction is revalidated, and it passes. No override record is created. No four-eyes requirement. In September 2026, 50,355 of 51,435 `ARC-DE` repair items resolved this way (97.9%), with 731 overrides and 349 returns and cancellations.

**Path 2: manual override.** The analyst or duty manager suppresses one or more validation rules and forces release. An override record is created in `SYS-0014`. This is the controlled path and it is where `CTL-PAY-014` operates.

### 6.5 Override reason codes

| Code | Name | German | Description | Secondary review required by policy |
|---|---|---|---|---|
| `OVR-A` | Validation rule false positive | Regelfehler | A documented defect in a validation rule produced a block on a correct instruction | Always |
| `OVR-B` | Client-confirmed correction received out of band | Kundenbestaetigung ausserhalb des Kanals | The client confirmed the correct detail by telephone or email; a callback was performed and recorded | Always |
| `OVR-C` | Route substitution | Clearingwegwechsel | The instruction is released on an alternative clearing route that does not support a validation performed on the primary route | Always |
| `OVR-D` | Cut-off driven release with post-release completion | Freigabe vor Annahmeschluss | A non-blocking data item is incomplete; the payment is released before cut-off and the data is completed within one business day | Always |
| `OVR-E` | Technical suppression on supplier advice | Technische Unterdrueckung | Novalink has advised suppression of a specific rule pending a fix | Always |

The policy position is unambiguous: secondary review is required for every override reason code, without a value threshold and without a business-continuity carve-out. The `CTL-PAY-014` control description says the same. The system does not implement that. See section 6.7.

### 6.6 The override record

Field definition as held in `SYS-0014` and replicated to `SYS-0011`.

| Field | Type | Notes |
|---|---|---|
| `overrideId` | string | Format `OVR-<entity>-<YYYYMMDD>-<seq4>`, for example `OVR-DE-20261006-0138` |
| `instructionId` | string | Foreign key into `SYS-0011`, format `PAY-<entity>-<YYYYMMDD>-<seq6>` |
| `entity` | enum | `ARC-DE` / `ARC-AT` / `ARC-CH` |
| `queue` | enum | `Q-REPAIR-DE` / `Q-REPAIR-AT` / `Q-REPAIR-CH` |
| `overrideReasonCode` | enum | `OVR-A` to `OVR-E` |
| `suppressedRuleIds` | array | Validation rule identifiers suppressed |
| `failureReasonCodes` | array | `R01` to `R08` present on the instruction |
| `valueAmount`, `valueCurrency` | decimal, string | Payment value |
| `evidenceRef` | string, nullable | Reference into `SYS-0032`. Nullable is itself a control weakness |
| `createdBy`, `createdAt` | string, timestamp | Override creator |
| `fallbackRouteMode` | enum | `INACTIVE` / `ACTIVE` at the moment of evaluation |
| `secondaryReviewRequired` | boolean | Derived by rule evaluation, not entered by a human |
| `reviewWaiverCode` | string, nullable | Populated when a rule waives the requirement |
| `ruleEvaluationTrace` | array | Ordered list of rules evaluated and their outcome |
| `secondaryReviewerId` | string, nullable | Null when review not required, or when review did not occur. Accepts service-account identities |
| `secondaryReviewAt` | timestamp, nullable | |
| `reviewDecision` | enum, nullable | `APPROVED` / `REJECTED` |
| `releasedBy`, `releasedAt` | string, timestamp | |

Two structural weaknesses are visible in this schema and both appear in the control test findings: `evidenceRef` is nullable, and `secondaryReviewerId` accepts a service account identity.

### 6.7 `RD-RULE-0031`, the four-eyes enforcement rule

This is the single most important technical object in the scenario. It must be implemented exactly as written.

```
RULE RD-RULE-0031  "Manual override secondary review enforcement"
  introduced: RepairDesk release 8.3, 11.11.2024
  source:     Novalink standard configuration template BCP-THROUGHPUT-v2
  tenant:     arcadia-prod (client configurable)

  EVALUATE on transition OVERRIDE_PROPOSED:

    IF   overrideReason    == "OVR-C"
     AND fallbackRouteMode == "ACTIVE"
     AND valueAmount       <  250000
     AND valueCurrency     IN ("EUR")
    THEN
         secondaryReviewRequired = false
         reviewWaiverCode        = "BCP-THROUGHPUT"
         auditNote               = "Secondary review waived under business
                                    continuity throughput provision"
    ELSE
         secondaryReviewRequired = true
```

Facts about this rule that the product must be able to evidence.

| Fact | Detail | Evidence |
|---|---|---|
| When it entered the tenant | RepairDesk release 8.3, deployed to `arcadia-prod` on 11.11.2024 | `CHG-2024-5512` |
| How it entered | Applied from a Novalink standard configuration template during the release, not requested by Arcadia | `EVD-2026-41905` |
| Arcadia change approval | `CHG-2024-5512` was approved on the basis of Novalink release notes. The release notes referenced "continuity throughput improvements for fallback routing" without naming a control waiver. No Arcadia control owner reviewed the rule | `CHG-2024-5512`, `EVD-2026-41907` |
| Control description alignment | `CTL-PAY-014` states review is required for every override with no exception. It has not been updated since 14.01.2025 | `EVD-2026-41908` |
| Is it client configurable | Yes. The rule sits in Arcadia's tenant configuration and can be edited by an Arcadia tenant administrator | `EVD-2026-41905` |
| How often it has fired | 118 times between 11.11.2024 and 06.10.2026, of which 96 on 06.10.2026 alone. The rule fires only when `fallbackRouteMode == ACTIVE`, which before 06.10.2026 had occurred on 7 occasions totalling 9 hours 40 minutes | `EVD-2026-41906` |
| Was it already visible | Yes. `EXC-TST-2026-0318-04` in the September control test was one of the 22 pre-event firings. The root cause was recorded as "system configuration" and not pursued | `TST-2026-0318` |

The last row is the professional point of the whole scenario. The finding existed 41 days before the event. It was classified as a low-value configuration curiosity and closed as such. The event turned the same rule into 96 releases worth EUR 9.42m, one confirmed misrouted payment and a zero-tolerance impact tolerance question.

### 6.8 Fallback route activation

| Attribute | Value |
|---|---|
| Trigger authority | Duty Manager, Payment Operations, or Head of Payment Operations |
| Runbook | `RB-PAY-007` Clearing route substitution, version 3.1, dated 09.02.2026 |
| Technical action | Set `fallbackRouteMode = ACTIVE` per queue in `SYS-0014`; switch clearing submission in `SYS-0011` from `SYS-0012` to `SYS-0013` |
| Validation consequence | `SYS-0013` performs no payment data validation. Instructions that NOVA-GATE would have enriched or corrected arrive with `R01`, `R02`, `R04` or `R08` and enter the repair queue |
| Expected volume effect | Runbook states "repair volume will increase materially". It does not quantify. It does not mention `RD-RULE-0031` or any effect on four-eyes |
| `ARC-CH` availability | None. `ARC-CH` has no direct SIC participant link. Its only fallback is manual submission through a correspondent bank, runbook `RB-PAY-011`, with a 45-minute preparation lead time |
| Runbook gap | `RB-PAY-007` section 4 states "the control environment is unchanged during fallback operation". This statement is factually wrong. It is a documented control assertion, which makes it a finding rather than an omission |

---

## 7. Third party: Novalink Payment Services GmbH

| Attribute | Value |
|---|---|
| ID | `TP-0042` |
| Legal name | Novalink Payment Services GmbH |
| Registered seat | Frankfurt am Main, Germany |
| Commercial register | HRB 98431 (synthetic) |
| Founded | 2011 |
| Employees | Approximately 850 (scenario figure) |
| Business | Payment processing software and managed clearing connectivity for European banks |
| Arcadia relationship since | 01.09.2023 |
| Relationship owner, commercial | `P-010` Lukas Wiesinger |
| Relationship owner, risk | `P-002` Stefan Brunner |
| Business owner | `P-007` Andreas Kellner |
| Annual spend | EUR 6.85m group-wide (scenario figure) |
| Criticality rating | Tier 1 of 4, Arcadia internal scale |
| Concentration flag | Yes. Sole provider for payment validation, payment repair tooling and Swiss clearing connectivity |
| Substitutability assessment | Last completed 30.06.2025. Conclusion: substitutable within 12 to 18 months with material programme cost. No test performed |

### 7.1 Services provided

| ID | Service | Entities | Classification, EU entities | Classification, `ARC-CH` | Supports |
|---|---|---|---|---|---|
| `SVC-0042-01` | Payment validation and clearing gateway (NOVA-GATE) | `ARC-DE`, `ARC-AT` | ICT service supporting a critical or important function; material outsourcing / wesentliche Auslagerung | not applicable | `IBS-0004` |
| `SVC-0042-02` | Payment Repair Workbench (RepairDesk) | `ARC-DE`, `ARC-AT`, `ARC-CH` | ICT service supporting a critical or important function; material outsourcing | Significant outsourcing / wesentliche Auslagerung | `IBS-0004` |
| `SVC-0042-03` | Payment file transformation and format library maintenance | `ARC-DE`, `ARC-AT`, `ARC-CH` | ICT service, not currently classified as supporting a critical or important function | Not significant | `IBS-0004` |
| `SVC-0042-04` | Hosted payment reconciliation and exception reporting | `ARC-DE`, `ARC-AT` | ICT service supporting a critical or important function | not applicable | `IBS-0004`, finance close |
| `SVC-0042-05` | Swiss clearing connectivity adapter, SIC and euroSIC | `ARC-CH` | not applicable | Significant outsourcing / wesentliche Auslagerung | `IBS-0004` |

Illustrative regulatory context, not legal advice.

Open classification question for the day: `SVC-0042-03` is rated as not supporting a critical or important function, but the 14:05 event shows that a format library failure would stop `PT-06` bulk files. `P-002` and `P-006` both reach this question from different directions.

### 7.2 Subprocessors and fourth parties

| ID | Name | Location | Service to Novalink | Supports which Arcadia service | Listed in binding Appendix `CTR-2023-0117-A3` v4.2 | Notified to Arcadia |
|---|---|---|---|---|---|---|
| `TP-0042.1` | Helvetia CloudWorks AG | Zurich, Switzerland | Infrastructure hosting for the RepairDesk Swiss instance and the euroSIC adapter | `SVC-0042-02` (CH), `SVC-0042-05` | Yes, correctly | Yes, 14.02.2025 |
| `TP-0042.2` | Rheinstack GmbH | Cologne, Germany | Managed database, backup and regional failover for NOVA-GATE and RepairDesk. Regions: Frankfurt primary, Amsterdam secondary | `SVC-0042-01`, `SVC-0042-02`, `SVC-0042-04` | Yes, but Frankfurt region only. Amsterdam is not listed | Region change not notified |
| `TP-0042.3` | Polaris Telemetrix s.r.o. | Brno, Czech Republic | Application monitoring, log aggregation, alerting and incident detection for all Novalink services | All | Yes, correctly | Yes, 14.02.2025 |
| `TP-0042.4` | Meridian Operations Support Pvt Ltd | Pune, India | Level 1 service desk and out-of-hours monitoring handover for NOVA-GATE and RepairDesk. Holds read access to payment metadata including beneficiary name and reference fields | `SVC-0042-01`, `SVC-0042-02` | No. Not listed at all | No notice on record. Onboarded by Novalink 01.05.2026 |
| `TP-0042.3-F1` | Aurora Object Storage Ltd | Dublin, Ireland | Long-term log and telemetry archive for Polaris Telemetrix, 24-month retention. Archived logs contain payment reference metadata | All, indirectly | No. Fourth party, outside the scope of Appendix A3 as drafted | No |

Three material facts follow from this table.

1. `TP-0042.4` Meridian is an unnotified subprocessor in a third country with access to payment metadata. This is a contractual notice question, a subprocessing question for the EU entities, and a data-access and offshoring question for `ARC-CH`. Illustrative regulatory context, not legal advice.
2. `TP-0042.2` Rheinstack operates a secondary region, Amsterdam, that the binding appendix does not mention. During the 14:05 event, Novalink's own root-cause statement names the Amsterdam region. The supplier discloses the appendix divergence while explaining the incident.
3. `TP-0042.3-F1` Aurora is a fourth party holding payment metadata for 24 months, and the contract has no fourth-party provision at all. Appendix A3 clause 3.4 obliges notice of subprocessor changes; it is silent on the subprocessors' own subcontractors. This is a drafting gap, not a breach, and it must be presented as such.

### 7.3 Contract

| Attribute | Value |
|---|---|
| ID | `CTR-2023-0117` |
| Title | Master Services Agreement, Payment Processing Services |
| Parties | Arcadia Bank AG (`ARC-DE`) as contracting entity, with accession schedules for `ARC-AT` and `ARC-CH` |
| Signed | 12.06.2023 |
| Effective | 01.09.2023 |
| Initial term | 5 years, to 31.08.2028 |
| Termination notice | 12 months for convenience; 30 days for cause |
| Governing law | German law; the `ARC-CH` accession schedule carries a Swiss law overlay for data and supervisory access clauses |
| Annual charge | EUR 6.85m group-wide (scenario figure) |
| Audit and access rights | Present, Appendix A4. Includes supervisory authority access for the EU entities and FINMA access for `ARC-CH`. Illustrative regulatory context, not legal advice |
| Exit plan | Appendix A6, version 2.0, dated 01.09.2023. Never tested |

#### Appendices

| ID | Title | Binding version | Version date | Status |
|---|---|---|---|---|
| `CTR-2023-0117-A1` | Service descriptions and service levels | 3.0 | 01.04.2025 | Current |
| `CTR-2023-0117-A2` | Charges | 2.1 | 01.01.2026 | Current |
| `CTR-2023-0117-A3` | Subprocessor list | 4.2 | 14.02.2025 | Out of alignment with reality |
| `CTR-2023-0117-A4` | Audit, access and supervisory rights | 1.0 | 01.09.2023 | Current |
| `CTR-2023-0117-A5` | Incident notification and escalation | 2.0 | 15.10.2024 | Current |
| `CTR-2023-0117-A6` | Exit and transition plan | 2.0 | 01.09.2023 | Current, untested |
| `CTR-2023-0117-A7` | Data processing and transfers | 2.2 | 20.05.2025 | Current |

Relevant clauses used by the scenario.

| Clause | Content |
|---|---|
| `A1` clause 7.2 | Novalink gives 10 business days notice of any change affecting the availability of a service supporting a critical or important function, including changes at a subprocessor |
| `A1` service level | NOVA-GATE contracted availability 99.7% monthly excluding planned maintenance. September 2026 actual 99.62% excluding planned maintenance, a miss Novalink has not reported |
| `A3` clause 3.4 | Novalink gives 60 days prior written notice of any addition, removal or material change to a subprocessor; Arcadia may object within 30 days of notice |
| `A4` clause 2.1 | Arcadia may request configuration and audit-trail extracts from any Novalink system processing Arcadia data, within 4 hours for incident purposes |
| `A5` clause 5.3 | Novalink notifies Arcadia within 30 minutes of detection with six mandatory fields: disruption start time, affected services, affected entities, severity, initial impact assessment, next update time |

#### The appendix inconsistency, stated precisely

| Aspect | Binding Appendix A3 v4.2, 14.02.2025 | Novalink Subprocessor Register v6.1, 03.08.2026 | Divergence |
|---|---|---|---|
| Number of subprocessors | 3 | 4 | One undisclosed addition |
| `TP-0042.1` Helvetia CloudWorks | Listed, Zurich | Listed, Zurich | None |
| `TP-0042.2` Rheinstack | Listed, region: Frankfurt | Listed, regions: Frankfurt, Amsterdam | Undisclosed secondary region |
| `TP-0042.3` Polaris Telemetrix | Listed, Brno | Listed, Brno | None |
| `TP-0042.4` Meridian Operations Support | Absent | Listed, Pune, onboarded 01.05.2026 | Undisclosed subprocessor in a third country with payment metadata access |
| Fourth parties | Not addressed by the appendix | Not addressed by the register | Contractual drafting gap |

Arcadia's contract repository contains no notice for Meridian and no notice for the Amsterdam region. Novalink's position, given by `P-011` at 15:31 on 06.10.2026, is that the register was published on its client portal and that portal publication constitutes notice. Appendix A3 does not say that. This is a live contractual dispute, not a settled breach, and the product must present it that way.

### 7.4 Novalink reassessment in progress

| Attribute | Value |
|---|---|
| Cycle | Annual reassessment 2026 |
| Kick-off | 15.09.2026 |
| Target completion | 31.10.2026 |
| Lead | `P-002` Stefan Brunner |
| Questionnaire | `TPRM-Q-2026` v2, 214 questions across 11 domains |
| Responses received | 198 of 214 (92.5%) as at 06.10.2026 07:00 |
| Evidence artefacts requested | 41 |
| Evidence artefacts received | 33 |
| Evidence artefacts accepted | 26 |
| Open items | 4 unresolved resilience questions, 8 missing artefacts, 7 received but not accepted |

#### The four unresolved resilience questions

| ID | Question | Novalink response so far | Why it is unresolved |
|---|---|---|---|
| `TPRM-Q-2026-R04` | Provide disaster recovery test evidence for RepairDesk covering all instances used by Arcadia | DR test report dated 22.05.2026 provided, `EVD-2026-40118` | The report covers the Frankfurt and Amsterdam regions only. There is no evidence for the Swiss instance hosted at `TP-0042.1` Helvetia CloudWorks. `ARC-CH` therefore has no DR evidence for a significant outsourcing |
| `TPRM-Q-2026-R07` | Confirm the recovery time objective for RepairDesk and evidence that it is achieved | Service description `CTR-2023-0117-A1` states RTO 2 hours. The 22.05.2026 test report shows actual recovery of 3 hours 40 minutes | A 1 hour 40 minute gap between the contracted objective and the tested outcome, with no explanation, no remediation plan and no notification to Arcadia |
| `TPRM-Q-2026-R11` | Provide evidence of an exit or substitutability test for RepairDesk | None provided. Novalink refers to Appendix A6 | Appendix A6 assumes Arcadia can operate a payment repair queue on an internal tool. Arcadia has no such tool. The exit plan relies on a capability Arcadia does not hold, which makes the plan unexecutable as written |
| `TPRM-Q-2026-R19` | Provide the most recent penetration test report for NOVA-GATE and RepairDesk | Two-page summary provided, `EVD-2026-40233`. Full report withheld on confidentiality grounds | The summary's scope statement does not confirm whether the RepairDesk override APIs were in scope. Arcadia cannot tell whether the highest-privilege function in the process was tested |

`TPRM-Q-2026-R04` and the 14:05 event intersect directly: the Swiss instance with no DR evidence is the instance behind the impact tolerance that comes closest to breach.

Illustrative regulatory context, not legal advice.

---

## 8. The control: `CTL-PAY-014`

| Attribute | Value |
|---|---|
| ID | `CTL-PAY-014` |
| Name | Independent secondary review of manual payment overrides |
| German label | Unabhaengige Zweitpruefung manueller Zahlungsueberschreibungen |
| Control objective | Ensure that every manual override of a payment validation block is independently reviewed and approved by a qualified secondary reviewer before the payment is released |
| Control statement, version 4.1, 14.01.2025 | "For each manual override created in RepairDesk, an independent secondary reviewer who did not create the override reviews the override reason, the supporting evidence and the payment detail, and records approval in RepairDesk before the payment is released. This applies to all overrides without exception." |
| Type | Preventive |
| Nature | Hybrid: manual review action, system-enforced gate |
| Frequency | Per occurrence, with monthly monitoring review |
| IKS designation | Key control in the Internal Control System / Internes Kontrollsystem (IKS) |
| Mitigates | `RSK-0211` Erroneous or unauthorised payment release |
| Control owner, 1LoD | `P-008` Beatrix Hofmann |
| Process owner | `P-007` Andreas Kellner |
| Assurance owner, 2LoD | `P-004` Jakob Steinbacher |
| Entities in scope | `ARC-DE`, `ARC-AT`, `ARC-CH` |
| System dependency | `SYS-0014` RepairDesk, rule `RD-RULE-0031` |
| Last description update | 14.01.2025 |
| Compensating controls claimed by 1LoD | `CTL-PAY-021` next-business-day sampling of overrides by the Duty Manager, 10% sample; `CTL-PAY-029` daily payment value reconciliation between `SYS-0011` and clearing confirmations |

The gap between the control statement ("without exception") and `RD-RULE-0031` (an exception introduced 11.11.2024 from a supplier template) is the design deficiency. The control description has not been updated since 14.01.2025, which is two months after the rule was introduced.

### 8.1 Control test `TST-2026-0318`

| Attribute | Value |
|---|---|
| ID | `TST-2026-0318` |
| Type | Combined design effectiveness and operating effectiveness test |
| Performed by | `P-004` Jakob Steinbacher, Group Control Assurance |
| Test period | 01.06.2026 to 31.08.2026 |
| Fieldwork | 07.09.2026 to 24.09.2026 |
| Report issued | 25.09.2026 |
| Population | 1,204 manual overrides across all three entities in the test period |
| Sampling method | Attribute sampling, statistical, random selection with a seeded generator |
| Sample size | 60 |
| Tolerable deviation rate | 5% |
| Expected deviation rate | 0% |
| Attributes tested | Five: (a) a secondary review record exists; (b) the reviewer is not the override creator; (c) the review timestamp precedes the release timestamp; (d) an evidence reference is present and retrievable; (e) the override reason code is one of `OVR-A` to `OVR-E` and is consistent with the failure reason codes |
| Result | 54 samples with no deviation, 4 exceptions, 2 items on which the tester could not conclude |
| Deviation rate on exceptions alone | 4 of 60 = 6.67% |
| Deviation rate treating unable-to-conclude items as deviations | 6 of 60 = 10.00% |
| 2LoD conclusion | Control Effectiveness / Kontrollwirksamkeit: Partially Effective. Design deficiency and operating deficiency |
| 1LoD position as at 06.10.2026 07:45 | Fully Effective / Voll wirksam |

### 8.2 The four exceptions

| ID | Date | Entity | Value | Override code | Deviation type | Attribute failed | Detail |
|---|---|---|---|---|---|---|---|
| `EXC-TST-2026-0318-01` | 14.07.2026 | `ARC-DE` | EUR 84,300 | `OVR-B` | Independence failure | (b) | A secondary review record exists but `secondaryReviewerId` equals `createdBy`. The analyst held both the Repair Analyst and the Secondary Reviewer role assignments in RepairDesk and the system permitted self-review. This is precisely the failure that Massnahme `MSN-2026-0147` was raised in November 2025 to prevent, and that Massnahme is overdue |
| `EXC-TST-2026-0318-02` | 06.08.2026 | `ARC-DE` | EUR 1,215,000 | `OVR-D` | Sequence failure | (c) | `releasedAt` is 16:47:12, `secondaryReviewAt` is 16:58:31. The review occurred 11 minutes and 19 seconds after release. A preventive control that operates after the event is not preventive. Highest value item in the exception set |
| `EXC-TST-2026-0318-03` | 19.08.2026 | `ARC-AT` | EUR 12,400 | `OVR-A` | Evidence failure | (d) | Override reason code recorded, `evidenceRef` is null. The reviewer approved with no documented basis. The reviewer, when interviewed on 16.09.2026, stated that the rule defect was well known in the team and that no document existed |
| `EXC-TST-2026-0318-04` | 27.08.2026 | `ARC-DE` | EUR 46,900 | `OVR-C` | Configuration-driven omission | (a) | No secondary review record exists. `secondaryReviewRequired` is false. `ruleEvaluationTrace` shows `RD-RULE-0031` fired with `reviewWaiverCode = BCP-THROUGHPUT`. `fallbackRouteMode` was `ACTIVE` between 15:22 and 17:05 on 27.08.2026 following a NOVA-GATE latency incident. Root cause recorded in the test report as "system configuration". No further investigation was performed and no Massnahme was raised for the rule itself |

The classification of `EXC-TST-2026-0318-04` as a closed configuration matter is the unexploded finding. It is the reason the 14:05 event is a repeat rather than a surprise, and it is why the day's most uncomfortable question is not about the supplier but about Arcadia's own follow-up discipline.

### 8.3 The two items with missing reviewer evidence

Recorded separately from the exceptions because the tester could not determine whether the control operated or failed. "Unable to conclude" is a distinct and often neglected category.

| ID | Date | Entity | Value | Override code | Issue | Novalink position | Status as at 06.10.2026 |
|---|---|---|---|---|---|---|---|
| `UTC-TST-2026-0318-01` | 02.07.2026 | `ARC-DE` | EUR 233,800 | `OVR-B` | `secondaryReviewerId` is `svc_repairbatch`, a Novalink service account. Arcadia cannot determine which human, if any, performed the review | Novalink advised on 18.09.2026 that the service account identity is written when a review is submitted through the bulk approval screen, and that the underlying human identity is held in an application log with 30-day retention. By the time the question was asked, the log had expired | Unresolvable. The evidence is gone. This is an audit trail defect in a key control in the IKS |
| `UTC-TST-2026-0318-02` | 21.08.2026 | `ARC-DE` | EUR 3,100 | `OVR-E` | A review record exists with a named human reviewer, but the attached evidence object is a broken link in the Novalink evidence store. A retention job moved the object on 01.09.2026 | Novalink acknowledged the retention job on 22.09.2026 and has not produced the file | Open. Novalink has committed to restore from archive by 10.10.2026 |

Combined value of the exception and unable-to-conclude set: EUR 1,595,500.

Two observations that matter professionally. First, `UTC-TST-2026-0318-01` is the more serious of the two despite the lower profile, because the evidence is permanently gone and it affects a bulk approval screen used routinely rather than exceptionally. Second, both unable-to-conclude items are caused by supplier-side design choices (a service account identity, a retention job), which links control assurance directly to third-party risk. The control owner cannot fix either of them alone.

### 8.4 Root cause classification of the test result

| Deviation | Root cause category | Owner of the root cause | Design or operating |
|---|---|---|---|
| `EXC-…-01` | Access and role design in a supplier system, with an overdue Arcadia remediation | Shared: `P-007` as Massnahme owner, Novalink for system capability | Operating, with a known design contributor |
| `EXC-…-02` | Process discipline under cut-off pressure; no system block on release before review | `P-008` | Operating |
| `EXC-…-03` | Evidence requirement not enforced by the system; `evidenceRef` nullable | `P-008`, with a design contributor | Operating |
| `EXC-…-04` | Rule `RD-RULE-0031` removes the control gate by design | Shared: Novalink template, Arcadia change approval `CHG-2024-5512`, Arcadia control description not updated | Design |
| `UTC-…-01` | Supplier service-account identity and 30-day log retention | Novalink, with Arcadia acceptance of the design | Design |
| `UTC-…-02` | Supplier evidence retention job | Novalink | Operating, supplier side |

---

## 9. Key risk indicators

Monthly cycle. Data as at month end, published on the third business day. September 2026 data published 05.10.2026 at 06:00.

| ID | Indicator | Unit | Green | Amber | Red | Aug 2026 | Sep 2026 | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `KRI-PAY-007` | Manual override rate, `ARC-DE` | Overrides per 10,000 instructions released | at or below 2.50 | above 2.50 to 3.50 | above 3.50 | 2.20 Green | 3.84 Red | Breach. First red in 14 months | `P-007`, monitored by `P-003` |
| `KRI-PAY-003` | Payment repair rate, `ARC-DE` | Percent of instructions entering the repair queue | at or below 2.00% | above 2.00% to 2.50% | above 2.50% | 2.28% Amber | 2.70% Red | Breach. Third consecutive month outside Green | `P-007`, monitored by `P-003` |
| `KRI-PAY-011` | Secondary reviewer capacity, `ARC-DE` | Filled reviewer FTE as a percent of approved establishment | at or above 95% | 85% to 94% | below 85% | 75.0% Red | 75.0% Red | Breach. Red since 01.08.2026 | `P-007` |
| `KRI-TPR-002` | Tier 1 third parties with a complete and current subprocessor record | Percent | at or above 98% | 95% to 97% | below 95% | 96.4% Amber | 94.6% Red | Breach | `P-002` |
| `KRI-RES-005` | Important business services with tested fallback arrangements | Percent | at or above 90% | 80% to 89% | below 80% | 78% Red | 78% Red | Breach | `P-005` |
| `KRI-GOV-001` | Overdue Massnahmen, group | Count | 0 to 3 | 4 to 8 | 9 or more | 6 Amber | 7 Amber | Within Amber | `P-001` |

**The KRI that breached** and that the morning brief leads with is `KRI-PAY-007`.

| Detail | Value |
|---|---|
| Twelve-month average | 2.31 overrides per 10,000 |
| Highest prior reading in 24 months | 2.94, February 2025, during a T2 migration weekend |
| September 2026 reading | 3.84 |
| Consecutive months in Green before this | 14 |
| Distance above the Red threshold | 0.34, which is 9.7% above threshold |
| Breach escalation rule | A Red reading requires a written 1LoD explanation within 5 business days, by 12.10.2026, and an item on the next NFR Committee agenda |

Component analysis available in the data, `ARC-DE` overrides by reason code.

| Override code | August 2026 | September 2026 | Change |
|---|---|---|---|
| `OVR-A` Validation rule false positive | 62 | 68 | +10% |
| `OVR-B` Client-confirmed out of band | 197 | 214 | +9% |
| `OVR-C` Route substitution | 31 | 198 | +539% |
| `OVR-D` Cut-off driven | 94 | 211 | +124% |
| `OVR-E` Technical suppression | 28 | 40 | +43% |
| Total | 412 | 731 | +77.4% |

The component analysis is the analytically important part and it is the thing a human would most easily miss on a dashboard. `OVR-C` grew more than sixfold and `OVR-D` more than doubled. Both are pressure indicators, not error indicators: `OVR-C` means the primary clearing route was unavailable more often, and `OVR-D` means more payments were released against a cut-off with incomplete data. Read together with `KRI-PAY-011` at 75% reviewer capacity, the picture is a team releasing more payments under more time pressure with fewer reviewers. That is the morning's real finding, and it precedes the 14:05 event by six hours.

### 9.1 `OVR-C` driver: NOVA-GATE availability in September 2026

| Date | Duration of fallback mode | Trigger |
|---|---|---|
| 04.09.2026 | 1 hour 10 minutes | NOVA-GATE latency |
| 11.09.2026 | 2 hours 05 minutes | NOVA-GATE planned maintenance overrun |
| 18.09.2026 | 0 hours 40 minutes | Network path failure |
| 25.09.2026 | 3 hours 15 minutes | NOVA-GATE latency |
| 29.09.2026 | 1 hour 30 minutes | NOVA-GATE latency |

Total 8 hours 40 minutes of fallback operation in September 2026 across 5 occurrences. In August 2026 there was 1 occurrence of 1 hour. The supplier's service availability deteriorated through September and the effect landed in Arcadia's control environment, not in a service-level report. NOVA-GATE's contracted availability is 99.7% monthly excluding planned maintenance; September actual was 99.62%, a service-level miss that Novalink has not yet reported and that `P-002` finds by calculation rather than by notification.

---

## 10. The RCSA in question

| Attribute | Value |
|---|---|
| ID | `RCSA-ARC-DE-PAYOPS-2026-Q4` |
| Scope | Payment Operations unit, `ARC-DE`, covering `PRC-0041` and four adjacent processes |
| Cycle | Quarterly |
| Facilitator, 2LoD | `P-003` Marlene Aigner |
| Assessment owner, 1LoD | `P-007` Andreas Kellner |
| Workshop | 06.10.2026, 10:30 to 12:00, Munich and video |
| Attendees | `P-007`, `P-008`, `P-009`, `P-003`, `P-004` as observer, plus 4 unnamed team leads |
| Risks in scope | 11, of which `RSK-0211` is the contested one |
| 2LoD pre-read issued | 02.10.2026 |
| Sign-off required by | 16.10.2026 |

### 10.1 `RSK-0211` Erroneous or unauthorised payment release

German label: Fehlerhafte oder unautorisierte Zahlungsfreigabe.

| Dimension | Q3 2026, signed 08.07.2026 | Q4 2026, 1LoD position | Q4 2026, 2LoD proposal, pre-read 02.10.2026 |
|---|---|---|---|
| Inherent impact, 1 to 5 | 4 | 4 | 4 |
| Inherent likelihood, 1 to 5 | 3 | 3 | 3 |
| Inherent score | 12 of 25, High | 12 of 25, High | 12 of 25, High |
| Control environment rating | Effective | Effective | Partially Effective |
| Residual impact | 3 | 3 | 4 |
| Residual likelihood | 2 | 3 | 3 |
| Residual score | 6 of 25, Medium-Low | 9 of 25, Medium | 12 of 25, Medium-High |
| Position versus appetite | Within appetite | Within appetite | Outside appetite |
| Required consequence | None | Monitoring | Remediation plan with dates, or formal Risk Acceptance / Risikoakzeptanz by the accountable executive |

Appetite statement for this risk category, from the Group Operational Risk Policy: a residual score of 10 or above on a payment execution risk is outside appetite and requires either an approved remediation plan with committed dates or a documented Risikoakzeptanz approved by the entity Chief Operating Officer and noted by the Group NFR Committee.

1LoD argument for Medium: the four exceptions caused no financial loss; all four payments were subsequently confirmed correct by the clients; two compensating controls operate (`CTL-PAY-021`, `CTL-PAY-029`); and the reviewer vacancy is being recruited.

2LoD argument for Medium-High: `CTL-PAY-014` is the only preventive control on this risk and it is Partially Effective; `CTL-PAY-021` is detective, next-day and sampled at 10%, which cannot prevent a release; `CTL-PAY-029` reconciles value, not authorisation, and would not detect a correctly-valued payment sent to the wrong beneficiary; the reviewer vacancy has no start date; and two of the six flagged test items cannot be concluded at all, which means the true deviation rate is unknown rather than 6.67%.

The gap between Medium and Medium-High is not a numerical quibble. It is the difference between "monitor" and "the accountable executive must either commit to dates or sign a Risikoakzeptanz". That is why it is a human decision and why the workshop at 10:30 cannot be automated.

### 10.2 Adjacent risk

| ID | Risk | Owner | Q4 residual | Appetite position |
|---|---|---|---|---|
| `RSK-0184` | Loss or material degradation of a critical third-party payment service | `P-007`, risk view `P-002` | 12 of 25, Medium-High | Outside appetite, held under a conditional Risikoakzeptanz dated 19.01.2026 valid to 31.12.2026, conditioned on completion of the 2026 Novalink reassessment and an exit test |

The condition "an exit test" has not been met and there is no plan to meet it. This matters at 14:05, because the entity holds an active risk acceptance whose condition the day's events show to be unfulfilled.

---

## 11. Remediation actions (Massnahmen)

### 11.1 The overdue action

| Attribute | Value |
|---|---|
| ID | `MSN-2026-0147` |
| Title | Implement role segregation enforcement in RepairDesk so that an override creator cannot be recorded as the secondary reviewer |
| German title | Durchsetzung der Funktionstrennung in RepairDesk |
| Source | Internal audit report `AUD-2025-09`, Payment Operations, issued 28.11.2025, finding `AUD-2025-09-F3` |
| Accountable owner | `P-007` Andreas Kellner |
| Delegate | `P-008` Beatrix Hofmann |
| Original due date | 31.03.2026 |
| Revised due date | 31.07.2026, one extension approved by the NFR Committee on 14.04.2026 |
| Status | In progress, 60% |
| Days overdue as at 06.10.2026 | 67 |
| Dependency | Novalink change request `NOVA-CR-4412` |
| Progress detail | `NOVA-CR-4412` delivered to Novalink pre-production on 18.09.2026. Arcadia user acceptance testing is not scheduled because the payment UAT environment refresh is blocked by an unrelated infrastructure change freeze in place to 14.10.2026 |
| Evidence of progress | `EVD-2026-41102` Novalink delivery note; `EVD-2026-41205` UAT scheduling request, unanswered |
| Consequence of the delay | `EXC-TST-2026-0318-01` on 14.07.2026 is exactly the failure this action prevents, and it occurred 17 days before the revised due date |
| Escalation rule triggered | An action more than 60 days past a revised due date is reported to the NFR Committee with a named accountable executive and a recommendation to either re-baseline with a root-cause explanation or escalate to the entity board |

### 11.2 Other open actions in scope for the day

| ID | Title | Owner | Due | Status | Relevance |
|---|---|---|---|---|---|
| `MSN-2026-0203` | Update the `CTL-PAY-014` control description to document all system-enforced review conditions, including any waiver rules configured in RepairDesk | `P-008` | 30.10.2026 | Not started | Raised as a low-priority documentation item on 25.09.2026 from `EXC-TST-2026-0318-04`. After 15:38 on 06.10.2026 it is no longer a documentation item; it is the disclosure of a design deficiency |
| `MSN-2026-0188` | Obtain and assess disaster recovery evidence for the RepairDesk Swiss instance | `P-002` | 20.10.2026 | In progress, 25% | From `TPRM-Q-2026-R04` |
| `MSN-2026-0191` | Reconcile the binding subprocessor appendix `CTR-2023-0117-A3` against Novalink's current register and agree a contract variation | `P-002`, with `P-010` and `P-016` | 13.11.2026 | In progress, 40% | From the reassessment; escalated during the event |
| `MSN-2026-0166` | Recruit to secondary reviewer position `PR-SR-02` | `P-007` | 30.09.2026 | Overdue, 6 days, in progress | Recruitment approved 12.08.2026; two candidate rejections; no start date |
| `MSN-2026-0177` | Perform an exit and substitutability test for `SVC-0042-02` RepairDesk | `P-002`, with `P-007` | 31.12.2026 | Not started | Condition of the `RSK-0184` Risikoakzeptanz |

Group overdue count as at 06.10.2026 is 7, of which 2 relate to `IBS-0004` (`MSN-2026-0147` and `MSN-2026-0166`). The remaining 5 are outside this scenario's scope and are represented in the product as a count only, with no invented detail.

---

## 12. The committee

| Attribute | Value |
|---|---|
| ID | `CMT-NFR-2026-10` |
| Name | Group Non-Financial Risk Committee |
| German name | Gruppenkomitee fuer nichtfinanzielle Risiken |
| Date and time | Tuesday 13.10.2026, 14:00 to 16:30 CET |
| Location | Frankfurt am Main and video |
| Chair | `P-014` Dr. Heinrich Adler, Group Chief Operating Officer |
| Members | `P-013` Claudia Renner (Group CRO), Group CFO, Group CIO, entity COOs for `ARC-DE`, `ARC-AT`, `ARC-CH`, Group Chief Compliance Officer |
| Standing attendees | `P-001` Katharina Vogt as secretary and portfolio lead, `P-017` Peter Maurer as Internal Audit observer |
| Papers deadline | Thursday 08.10.2026, 12:00 CET. Late papers are tabled for information only and cannot carry a decision |
| Decision quorum | Chair plus three members, including at least one entity COO for any entity-specific decision |

### 12.1 Agenda

| ID | Item | Type | Owner | Links |
|---|---|---|---|---|
| `AG-CMT-NFR-2026-10-01` | Minutes and open actions | Noting | `P-001` | |
| `AG-CMT-NFR-2026-10-02` | Group NFR dashboard, Q3 2026 | Noting | `P-001` | All KRIs |
| `AG-CMT-NFR-2026-10-03` | `KRI-PAY-007` breach and the 1LoD and 2LoD divergence on `CTL-PAY-014` | Decision | `P-003` and `P-004` | `KRI-PAY-007`, `TST-2026-0318`, `RCSA-ARC-DE-PAYOPS-2026-Q4` |
| `AG-CMT-NFR-2026-10-04` | Novalink reassessment interim status and the subprocessor appendix divergence | Decision | `P-002` | `TP-0042`, `CTR-2023-0117-A3`, `MSN-2026-0191` |
| `AG-CMT-NFR-2026-10-05` | Overdue Massnahmen, including `MSN-2026-0147` at 67 days | Decision | `P-001` | `MSN-2026-0147`, `MSN-2026-0166` |
| `AG-CMT-NFR-2026-10-06` | Register of information readiness for `ARC-DE` and `ARC-AT` | Noting | `P-006` | `REG-2026-0031`. Illustrative regulatory context, not legal advice |
| `AG-CMT-NFR-2026-10-07` | `ARC-CH` outsourcing inventory update and FINMA context | Noting | `P-006` and `P-015` | `REG-2026-0088`. Illustrative regulatory context, not legal advice |
| `AG-CMT-NFR-2026-10-08` | `IBS-0004` Corporate Payments impact tolerance review | Decision | `P-005` | `ITOL-0004-01` to `ITOL-0004-04` |
| `AG-CMT-NFR-2026-10-09` | Any other business | | Chair | |
| `AG-CMT-NFR-2026-10-10` | `INC-2026-0412` and the `ITOL-0004-04` candidate breaches. **Added 06.10.2026 at 16:20** | Decision | `P-001` with `P-005` | `INC-2026-0412`, `ITOL-0004-04`, `MSN-2026-0215` |

Adding item 10 is one of the day's end-of-day decisions. The tension the product should make visible is that papers are due 08.10.2026 at 12:00 while Novalink's written incident report is not due until 13.10.2026. `P-001` must write a decision paper on an event whose supplier root-cause report will arrive on the morning of the meeting.

---

## 13. Regulatory change items in scope

| ID | Item | Jurisdiction scope | Status | Owner |
|---|---|---|---|---|
| `REG-2026-0031` | ICT third-party register of information: completeness of subcontracting chains | `ARC-DE`, `ARC-AT` | In progress. 94.6% of Tier 1 records complete | `P-006` with `P-002` |
| `REG-2026-0088` | Swiss outsourcing inventory and data-access review for significant outsourcings | `ARC-CH` | In progress. Meridian access question newly opened | `P-006` with `P-015` |
| `REG-2026-0104` | Operational resilience: impact tolerance definition and testing standards | Group, with separate EU and Swiss references | Draft internal standard issued 21.09.2026, consultation to 23.10.2026 | `P-006` with `P-005` |
| `REG-2026-0117` | Incident classification and reporting thresholds | `ARC-DE`, `ARC-AT` under EU references; `ARC-CH` under FINMA references, assessed separately | Implemented, first annual review due 30.11.2026 | `P-006` with `P-005` |

Illustrative regulatory context, not legal advice.

---

## 14. The morning situation, consolidated as at 06.10.2026 07:45

Every item below is already true before the product opens. Nothing here is generated by the day's events.

| # | Fact | Object | Since |
|---|---|---|---|
| 1 | Payment repair volume increased: `ARC-DE` repair rate 2.70% in September against 2.28% in August | `KRI-PAY-003` Red | Published 05.10.2026 06:00 |
| 2 | Manual override volume increased: 731 overrides in September against 412 in August, 3.84 per 10,000 against a 3.50 Red threshold | `KRI-PAY-007` Red, first red in 14 months | Published 05.10.2026 06:00 |
| 3 | One secondary reviewer position remains unfilled: `PR-SR-02`, vacant since 31.07.2026 after `P-018` Tomas Nowak resigned. Capacity 3.0 of 4.0 approved FTE | `KRI-PAY-011` Red, `MSN-2026-0166` overdue 6 days | 31.07.2026 |
| 4 | A control test found four exceptions plus two items on which the tester could not conclude | `TST-2026-0318`, `EXC-…-01` to `-04`, `UTC-…-01` and `-02` | Reported 25.09.2026 |
| 5 | The first-line control owner still assesses the control as fully effective | `P-008` position on `CTL-PAY-014`, against the 2LoD Partially Effective conclusion | Recorded 29.09.2026 |
| 6 | A quarterly RCSA workshop is approaching, today at 10:30, with a contested residual rating | `RCSA-ARC-DE-PAYOPS-2026-Q4`, `RSK-0211` Medium versus Medium-High | Pre-read 02.10.2026 |
| 7 | Novalink is undergoing reassessment | `TP-0042`, 198 of 214 responses, 26 of 41 artefacts accepted | Kick-off 15.09.2026 |
| 8 | Supplier evidence contains unresolved resilience questions | `TPRM-Q-2026-R04`, `-R07`, `-R11`, `-R19` | 15.09.2026 onwards |
| 9 | A contract appendix and the current subprocessor list do not fully align | `CTR-2023-0117-A3` v4.2 versus Novalink register v6.1: one undisclosed subprocessor in India, one undisclosed hosting region, fourth parties not addressed | Identified 21.09.2026 |
| 10 | One remediation action is overdue | `MSN-2026-0147`, 67 days past its revised due date of 31.07.2026 | 01.08.2026 |
| 11 | An NFR committee meeting is scheduled for next week | `CMT-NFR-2026-10` on 13.10.2026, papers due 08.10.2026 12:00 | Scheduled 04.09.2026 |

### 14.1 The hidden connection the morning should surface

Items 2, 3, 4 and 10 are the same story told four times. Override volume rose because the primary clearing route failed five times in September (`OVR-C` up more than sixfold) and because cut-off pressure rose (`OVR-D` up 124%). Reviewer capacity is at 75%. The control that governs overrides has four exceptions and two unresolvable items. The action that would have prevented one of those exceptions is 67 days overdue. Presented as four separate red items on a dashboard, this looks like four problems. Presented as one causal chain, it is one problem with four symptoms, and it points at a specific rule in a specific supplier system that nobody has looked at.

Nothing in Arcadia's current reporting connects them. That is the product's thesis, and it is why the morning brief matters more than the event.

---

## 15. The shared event: `INC-2026-0412`

| Attribute | Value |
|---|---|
| ID | `INC-2026-0412` |
| Title | Novalink regional service degradation affecting payment validation, repair and Swiss clearing |
| Date | 06.10.2026 |
| Actual technical start | 13:31 |
| Detected by Arcadia | 14:07 by telemetry; notified by supplier 14:05 |
| Incident record raised | 14:29, severity `S3` |
| Severity upgrades | `S2` at 14:52; `S1` at 15:14 |
| Incident manager | `P-005` Nadia Lehmann |
| Entity coordinators | `P-007` for `ARC-DE` and `ARC-AT`; `P-015` for `ARC-CH` |
| Bridge opened | 14:38 |
| Service restored | NOVA-GATE normal latency 15:41; full service confirmed 16:08 |
| Incident closed | Not closed on 06.10.2026. Remains open pending the Novalink report due 13.10.2026 |

### 15.1 Fact classification scheme

Every information arrival carries exactly one classification. The product must display it and must never silently promote one class to another.

| Class | Code | Definition | Display rule |
|---|---|---|---|
| Verified fact | `VF` | Directly evidenced by a system record, a document, or a confirmation from the party with authoritative knowledge, and the evidence is retrievable | Shown with the evidence reference. No hedging language |
| Stakeholder statement | `SS` | Asserted by a named person. The assertion itself is a fact; its content is not verified | Shown with the person's name and the time of the statement. Always attributed. Never restated as fact |
| Telemetry inference | `TI` | Derived from monitoring or log data by interpretation. The measurement is reliable; the conclusion drawn from it is not proven | Shown with the measurement, the inference, and the specific reason the inference could be wrong |

A fourth state exists and is important: an arrival can be **reclassified**. When `ARR-INC-2026-0412-12` arrives, `ARR-INC-2026-0412-05` changes from `TI` to `VF`. The product must show the reclassification and the time it occurred, not overwrite the history.

### 15.2 Minute by minute: information arrivals, 14:05 to 16:30

Eighteen arrivals. Each has an identifier, a time, a class, a source, content, and the objects it touches. In this section `ARR-…-nn` abbreviates `ARR-INC-2026-0412-nn`.

---

**`ARR-…-01`  14:05  Class: `SS`**

**Source.** Novalink service notification `NSN-2026-0887`, received in shared mailbox `payments-supplier@arcadia.example` at 14:05:12 and published on the Novalink client status portal.

**Content, verbatim.** "Degraded performance affecting NOVA-GATE clearing submission in the DACH region. Investigation ongoing. Severity P3. No customer impact identified at this time."

**Verified element.** The notification exists and was received at 14:05:12. Evidence `EVD-2026-41871`.

**Unverified element.** Everything the notification asserts, including "no customer impact".

**What is missing against `CTR-2023-0117-A5` clause 5.3.** Disruption start time, list of affected services, list of affected entities, initial impact assessment, next update time. Five of the six mandatory fields are absent. Appendix A5 requires notification within 30 minutes of supplier detection with all six fields.

**Objects touched.** `TP-0042`, `SVC-0042-01`, `CTR-2023-0117-A5`, `IBS-0004`.

---

**`ARR-…-02`  14:07  Class: `TI`**

**Source.** `SYS-0011` Arcadia Payment Hub monitoring, alert `ALRT-2026-77412`.

**Measurement.** NOVA-GATE submission acknowledgement latency rose from a seven-day median of 1.4 seconds to 42 seconds beginning at 13:38. Acknowledgement timeouts began at 13:51. 2,317 instructions are in `SUBMITTED` state awaiting acknowledgement.

**Inference.** The degradation began approximately 27 minutes before the supplier notification, and the supplier's "no customer impact" statement is inconsistent with Arcadia-side measurement.

**Why the inference could be wrong.** The latency metric is measured at the Arcadia edge. An Arcadia network path problem, a firewall change or a DNS issue would produce the same signature. Arcadia cannot distinguish supplier-side from path-side degradation from this metric alone.

**Objects touched.** `SYS-0011`, `SYS-0012`, `ITOL-0004-01`.

---

**`ARR-…-03`  14:12  Class: `VF`**

**Source.** `SYS-0014` configuration audit log and Arcadia change record `CHG-2026-7741`.

**Content.** `P-009` Elif Demir, acting Duty Manager, invoked runbook `RB-PAY-007` and set `fallbackRouteMode = ACTIVE` at 14:12:41 for `Q-REPAIR-DE` and `Q-REPAIR-AT`. Clearing submission switched from `SYS-0012` NOVA-GATE to `SYS-0013` Arcadia Direct Link. The decision was correct under the runbook and was taken within the Duty Manager's authority.

**Consequence, known and documented.** `SYS-0013` performs no payment data validation. Instructions that NOVA-GATE would have enriched now fail with `R01`, `R02`, `R04` or `R08` and enter the repair queue, requiring `OVR-C` route-substitution overrides.

**Consequence, not documented anywhere.** Setting `fallbackRouteMode = ACTIVE` satisfies the second condition of `RD-RULE-0031`. From 14:12:41, every `OVR-C` override below EUR 250,000 is released without secondary review, by design, silently.

**`ARC-CH` note.** No fallback was activated for `Q-REPAIR-CH`, because `ARC-CH` has no direct SIC link. `ARC-CH` instructions simply queued.

**Evidence.** `EVD-2026-41874`, `EVD-2026-41875`.

**Objects touched.** `PRC-0041`, `SYS-0013`, `SYS-0014`, `RD-RULE-0031`, `CTL-PAY-014`, `RB-PAY-007`.

---

**`ARR-…-04`  14:26  Class: `TI`**

**Source.** `SYS-0014` queue telemetry.

**Measurement, verified.** `Q-REPAIR-DE` depth rose from 61 items at 14:12 to 494 items at 14:26. 138 `OVR-C` overrides were created between 14:12:41 and 14:26:00, against a normal full-day `ARC-DE` figure of approximately 33 overrides of all types. `Q-REPAIR-AT` depth rose from 14 to 97.

**Inference.** The rise is caused by fallback activation removing NOVA-GATE enrichment, not by a change in client behaviour or a data quality event.

**Why the inference could be wrong.** A large corporate bulk file submitted at 14:10 would produce a similar queue spike. The inference is not yet tested against the file submission log.

**Objects touched.** `PRC-0041`, `KRI-PAY-007`, `KRI-PAY-003`.

---

**`ARR-…-05`  14:34  Class: `TI`, later reclassified to `VF` at 15:38**

**Source.** `SYS-0014` override audit log query `QRY-2026-88104`.

**Measurement, verified.** Of the 138 `OVR-C` overrides created between 14:12:41 and 14:26:00, **96 have `secondaryReviewRequired = false` and `secondaryReviewerId = null`**. Combined value EUR 9,420,880. All 96 have individual values below EUR 250,000. Split: `ARC-DE` 78 overrides, EUR 7,611,240; `ARC-AT` 18 overrides, EUR 1,809,640. The remaining 42 overrides have `secondaryReviewRequired = true`, of which 29 were reviewed and released and 13 remain in `AWAITING_SECONDARY_REVIEW`.

**Inference.** 96 payments were released without the independent secondary review required by `CTL-PAY-014`, which is a candidate breach of the zero-tolerance `ITOL-0004-04`.

**Why the inference could be wrong at 14:34.** The absence of a reviewer identity at query time is not proof that no review occurred. If RepairDesk populates reviewer identity asynchronously, or if a bulk approval writes the identity at the end of a cycle, the field would be empty now and populated later. Arcadia does not know how RepairDesk writes this field.

**Objects touched.** `CTL-PAY-014`, `RD-RULE-0031`, `ITOL-0004-04`, `RSK-0211`, `TST-2026-0318`.

**This arrival is the spine of the event.**

---

**`ARR-…-06`  14:41  Class: `SS`  (Conflict A, statement 1)**

**Source.** `P-008` Beatrix Hofmann, control owner, on the incident bridge, recorded.

**Statement, verbatim.** "Every override goes through four-eyes. The log is lagging. RepairDesk backfills reviewer identities at the end of the batch cycle. There is no bypass. My team does not release payments without review."

**Assessment at the time of the statement.** The speaker is the person with the most operational knowledge of the process and the least knowledge of the system's internal behaviour. Her claim has two parts: a mechanism claim about backfill and a behaviour claim about her team. The product must separate them, because they resolve differently.

**Objects touched.** `CTL-PAY-014`, `P-008` position record.

---

**`ARR-…-07`  14:48  Class: `SS`  (Conflict A, statement 2; opens Conflict A2)**

**Source.** `P-011` Miriam Falk, Client Service Director, Novalink, on the incident bridge, recorded.

**Statement, verbatim.** "RepairDesk does not backfill reviewer identities. The field is written at the moment of review submission. If the field is empty, no review was submitted. I would add that the four-eyes requirement for route-substitution overrides is configured in the client tenant, not by Novalink."

**Conflict.** Directly contradicts `ARR-…-06` on the mechanism. Also introduces an accountability assertion, "configured in the client tenant", that nobody has yet verified and that shifts responsibility to Arcadia.

**Assessment at the time.** The speaker has authoritative knowledge of the mechanism and a commercial interest in the accountability assertion. The product must flag the second sentence as a statement made with an interest, without implying it is false.

**Objects touched.** `CTL-PAY-014`, `RD-RULE-0031`, `TP-0042`, accountability.

---

**`ARR-…-08`  14:55  Class: `SS`  (Conflict B, statement 1)**

**Source.** `P-012` Ralf Ostermann, Head of Service Continuity, Novalink, on the incident bridge, recorded.

**Statement, verbatim.** "Root cause is a failed database failover at our Frankfurt hosting provider. The Amsterdam region is unaffected and traffic has moved there. Recovery expected by 16:00."

**Immediate secondary finding.** The statement names an Amsterdam region operated by a subprocessor. `CTR-2023-0117-A3` v4.2 lists `TP-0042.2` Rheinstack GmbH with the Frankfurt region only. The supplier has disclosed the appendix divergence while explaining the incident. `P-002` notes this at 14:57 and raises it formally at 15:23.

**Objects touched.** `TP-0042.2`, `CTR-2023-0117-A3`, `MSN-2026-0191`.

---

**`ARR-…-09`  15:02  Class: `SS`  (Conflict B, statement 2)**

**Source.** Novalink client status portal, update `NSN-2026-0887-U1`.

**Content, verbatim.** "Severity raised to P2. Cause under investigation. Monitoring and alerting pipeline also degraded. Next update by 16:00."

**Conflict.** A named root cause was given verbally at 14:55; the written update seven minutes later says the cause is under investigation. The written update also discloses a second affected component, the monitoring and alerting pipeline, which `P-012` did not mention. That pipeline is operated by subprocessor `TP-0042.3` Polaris Telemetrix in Brno.

**Why this conflict is not necessarily a contradiction.** A supplier's written communications policy often withholds an unconfirmed root cause. The product must present the possibility that both statements are honest alongside the possibility that they are not, and must not resolve it prematurely.

**Objects touched.** `TP-0042.3`, `CTR-2023-0117-A5`, `TP-0042`.

---

**`ARR-…-10`  15:09  Class: `VF`**

**Source.** `P-015` Sibylle Graf, `ARC-CH`, with the `ARC-CH` payment queue export `EVD-2026-41882` from `SYS-0015`.

**Content.** euroSIC and SIC submission through `SVC-0042-05` has been queued since 13:47. 1,842 instructions, CHF 61,304,110 total, of which CHF 18,712,400 carry same-day value with a 16:00 CET cut-off. No fallback route exists for `ARC-CH`. The only option is manual submission through the correspondent bank under `RB-PAY-011`, which has a 45-minute preparation lead time.

**Tolerance position at 15:09.** `ITOL-0004-03` sets a 2-hour maximum tolerable disruption. Elapsed time from 13:47 is 1 hour 22 minutes. Remaining tolerance: 38 minutes. The 16:00 cut-off is 51 minutes away and the manual route needs 45 of them.

**Objects touched.** `ITOL-0004-03`, `SVC-0042-05`, `SYS-0015`, `ARC-CH`, `RB-PAY-011`.

**This arrival creates the day's only genuine deadline.**

---

**`ARR-…-11`  15:14  Class: `VF`**

**Source.** `P-005` Nadia Lehmann, incident manager. Incident record `INC-2026-0412`.

**Content.** Severity upgraded from `S2` to `S1` on two grounds: an impact tolerance for an important business service is within 40 minutes of its limit, and a zero-tolerance control condition (`ITOL-0004-04`) has 96 candidate breaches. `S1` triggers notification to `P-013` Claudia Renner and `P-014` Dr. Heinrich Adler, and triggers the incident classification assessments for each entity.

**Classification assessments started at 15:20.**

- For `ARC-DE` and `ARC-AT`: assessment against the EU major-incident classification criteria, covering clients affected, reputational impact, duration and service downtime, geographical spread, data losses, criticality of services affected, and economic impact. Provisional conclusion at 15:47: the event is significant but does not meet the major-incident threshold on the facts available; the assessment must be re-run when the Novalink report arrives. Recorded as `DEC-2026-0774`. Illustrative regulatory context, not legal advice.
- For `ARC-CH`: a separate assessment against FINMA operational risk and resilience reporting expectations for incidents of substantial importance. Provisional conclusion at 15:52: no report required on the facts available; the assessment is documented and will be re-run. Recorded as `DEC-2026-0775`. Illustrative regulatory context, not legal advice.

**Product rule.** These two assessments are never merged into one. Two entities, two frameworks, two records, two conclusions.

**Objects touched.** `INC-2026-0412`, `REG-2026-0117`, `DEC-2026-0774`, `DEC-2026-0775`.

---

**`ARR-…-12`  15:38  Class: `VF`  (resolves Conflict A)**

**Source.** Novalink engineering: RepairDesk tenant configuration export and rule definition, provided at `P-002`'s formal request under `CTR-2023-0117-A4` clause 2.1. Evidence `EVD-2026-41905`.

**Content.** The export confirms that rule `RD-RULE-0031` exists in tenant `arcadia-prod` with the condition set out in section 6.7. Further verified facts from the same export and from `CHG-2024-5512`:

- The rule entered the tenant with RepairDesk release 8.3 on 11.11.2024, applied from Novalink standard configuration template `BCP-THROUGHPUT-v2`.
- Arcadia approved release 8.3 under `CHG-2024-5512` on the basis of Novalink release notes referring to "continuity throughput improvements for fallback routing". No control waiver was named in the release notes. No Arcadia control owner reviewed the rule.
- The rule is client configurable. An Arcadia tenant administrator can edit or remove it.
- The rule has fired 118 times since 11.11.2024, of which 96 on 06.10.2026. It fires only when `fallbackRouteMode = ACTIVE`, which occurred on 7 prior occasions totalling 9 hours 40 minutes.
- Reviewer identity is written synchronously at review submission. There is no backfill.

**Resolution of Conflict A.**

- `P-011` was correct on the mechanism. There is no backfill. The mechanism claim in `ARR-…-06` is false.
- `P-008` was correct on behaviour. No member of her team bypassed a control. The 96 releases were not circumventions; the rule waived the requirement before any human saw it. Her behaviour claim is true.
- `P-011`'s accountability assertion is partly correct and materially incomplete. The configuration does sit in Arcadia's tenant, but it was placed there by a Novalink template during a Novalink release, and Novalink's release notes did not disclose that a client control gate would be waived. Accountability is shared: Novalink for non-disclosure, Arcadia for approving a release without reviewing its control effects, and Arcadia again for not updating the `CTL-PAY-014` description.
- `ARR-…-05` is reclassified from `TI` to `VF` at 15:38. The 96 payments were released without secondary review. This is now a verified fact.

**Consequence for `TST-2026-0318`.** `EXC-TST-2026-0318-04` is the same rule. It was found on 27.08.2026, reported 25.09.2026, classified as "system configuration" and closed with a documentation action (`MSN-2026-0203`, not started). The root cause was visible 41 days before the event.

**Objects touched.** `RD-RULE-0031`, `CTL-PAY-014`, `CHG-2024-5512`, `TST-2026-0318`, `EXC-TST-2026-0318-04`, `MSN-2026-0203`, `TP-0042`, `RSK-0211`.

---

**`ARR-…-13`  15:47  Class: `VF`**

**Source.** `SYS-0015` and `ARC-CH` Treasury, reported by `P-015`.

**Content.** `P-015`, with the `ARC-CH` Treasury desk and the authority of the `ARC-CH` COO, invoked `RB-PAY-011` at 15:07. Manual submission of the CHF 18,712,400 same-day tranche through correspondent Helvetia Clearing Partner AG has been prepared and transmitted. Preparation took 45 minutes, as the runbook states.

**Objects touched.** `ITOL-0004-03`, `RB-PAY-011`, `ARC-CH`.

**Note on sequencing.** The decision at 15:07 was taken with 38 minutes of tolerance remaining and a 45-minute lead time. The decision therefore had to be taken before the cause was known and before Novalink's 16:00 recovery estimate could be tested. This is the clearest example in the scenario of a decision that cannot wait for facts.

---

**`ARR-…-14`  15:51  Class: `VF`  (resolves Conflict B)**

**Source.** `TP-0042.2` Rheinstack GmbH incident summary, forwarded by Novalink. Evidence `EVD-2026-41911`.

**Content.** The primary database cluster in the Frankfurt region lost quorum at 13:31 following a storage firmware update applied in a maintenance window that Novalink had not notified to Arcadia. Automatic failover to the Amsterdam region completed successfully at 13:44 for NOVA-GATE write traffic. The monitoring and alerting pipeline operated by `TP-0042.3` Polaris Telemetrix remained pinned to the Frankfurt database endpoint until 14:57, because its connection string was statically configured rather than using the failover alias.

**Resolution of Conflict B.**

- `P-012`'s 14:55 statement was materially correct and incomplete. There was a failed failover at a hosting subprocessor and Amsterdam did take the traffic. He did not mention the monitoring pipeline, most probably because his own monitoring was the thing that was broken.
- The written "cause under investigation" at 15:02 was a communications-policy default, not a contradiction. Both statements were honest.
- The substantive finding is neither statement's content. It is that Novalink's incident detection depends on a subprocessor whose monitoring was pinned to the failed region, producing a 34-minute detection and notification lag (13:31 quorum loss, 14:05 notification). That is a resilience finding against `TP-0042`, a concentration finding about `TP-0042.3`, and a direct explanation of why `CTR-2023-0117-A5` clause 5.3 could not be met.
- Secondary finding: the storage firmware update at 13:31 was a change at a subprocessor, applied during an Arcadia business day, unnotified. `CTR-2023-0117-A1` clause 7.2 requires 10 business days notice of changes affecting availability of a critical service.

**Objects touched.** `TP-0042`, `TP-0042.2`, `TP-0042.3`, `CTR-2023-0117-A1`, `CTR-2023-0117-A5`, `KRI-RES-005`, `RSK-0184`.

---

**`ARR-…-15`  16:04  Class: `VF`**

**Source.** Correspondent confirmation `CONF-2026-9931` from Helvetia Clearing Partner AG. Evidence `EVD-2026-41918`.

**Content.** 1,840 of 1,842 instructions accepted, CHF 61,289,910. Submitted 15:52, accepted 15:58, two minutes before the 16:00 cut-off. Two instructions totalling CHF 14,200 were rejected on format grounds and rolled to value date 07.10.2026.

**The tolerance question, stated precisely.** `ITOL-0004-03` has two measures and they give different answers.

- Measure 1, submission completion versus cut-off: submission completed at 15:58, two minutes before the 16:00 cut-off. **Not breached.**
- Measure 2, elapsed disruption: queueing began at 13:47 and submission completed at 15:58. Elapsed 2 hours 11 minutes against a 2-hour maximum. **Breached by 11 minutes.**

**Consequence.** `ARC-CH` cannot state whether its impact tolerance was breached, because the tolerance is defined with two measures and no stated precedence. This is a definitional defect in the tolerance itself, not an operational failure, and it must go to `AG-CMT-NFR-2026-10-08` with a recommendation. Separately, two payments worth CHF 14,200 were delayed, which is 0.023% of daily `ARC-CH` corporate payment value, well inside `ITOL-0004-02`.

**Objects touched.** `ITOL-0004-03`, `ITOL-0004-02`, `AG-CMT-NFR-2026-10-08`, `REG-2026-0104`.

**This is the most valuable finding of the day and the least dramatic. The product should treat it that way.**

---

**`ARR-…-16`  16:12  Class: `VF`**

**Source.** Novalink client status portal, update `NSN-2026-0887-U2`. Evidence `EVD-2026-41921`.

**Content.** NOVA-GATE latency returned to normal at 15:41. Full service confirmed at 16:08. The monitoring and alerting pipeline was restored at 14:57. Novalink commits to a written incident report within five business days, by 13.10.2026.

**Timing consequence.** `CMT-NFR-2026-10` papers are due 08.10.2026 at 12:00. The supplier's root-cause report is due 13.10.2026, the morning of the meeting. `P-001` must therefore write a decision paper on 07.10.2026 or 08.10.2026 that states clearly which facts are verified, which are supplier statements, and what the committee is being asked to decide without the supplier's account. The paper must be structured so that the arrival of the report on 13.10.2026 does not invalidate the decision. Recorded as `DEC-2026-0781`.

**Objects touched.** `TP-0042`, `CMT-NFR-2026-10`, `INC-2026-0412`.

---

**`ARR-…-17`  16:19  Class: `TI` with an embedded `VF`**

**Source.** Post-event validation performed by the Payment Repair team under `P-008`'s direction at `P-004`'s request. Evidence `EVD-2026-41924`.

**Content.** A 20-case sample of the 96 unreviewed overrides was re-checked against `SYS-0017` Client Static Data Master and the original client instructions.

- **Verified fact.** 19 of 20 were correctly repaired. **1 of 20 was not.** Instruction `PAY-DE-20261006-448127`, value EUR 38,400, was released with an incorrect beneficiary intermediary BIC. The clearing system accepted it and routed it to the wrong intermediary institution. The payment is recallable and a recall was initiated at 16:24 under `EVD-2026-41930`. Client identified in the product only as `CLI-DE-00412`.
- **Inference.** A 1-in-20 observed error rate, applied to 96 cases, suggests approximately 5 affected cases in total, with a wide interval on a sample of 20.

**Why the inference could be wrong.** 20 of 96 is a 21% sample, not stratified by value or by failure reason code. The single error was on an `R01` IBAN and BIC failure, which is the most error-prone repair type and represents 31% of repair items. A stratified sample would very likely give a different rate. The honest statement is: one confirmed error, an unknown number of further errors, and a full check of all 96 cases required.

**Consequence.** The event is no longer a control documentation matter. There is at least one confirmed erroneous payment release, which is the realisation of `RSK-0211`. The 1LoD residual rating of Medium is no longer arguable on the basis that no loss occurred.

**Objects touched.** `RSK-0211`, `CTL-PAY-014`, `ITOL-0004-04`, `RCSA-ARC-DE-PAYOPS-2026-Q4`, `MSN-2026-0214`.

---

**`ARR-…-18`  16:27  Class: `SS` from both parties, jointly recorded**

**Source.** Written position statements from `P-008` and `P-004`, captured in `DEC-2026-0783`.

**`P-008` Beatrix Hofmann, revised position.** Accepts `EVD-2026-41905` and withdraws the backfill claim made at 14:41. Accepts that 96 payments were released without secondary review. Maintains that the control operated as the system was configured to operate, that her team followed the process correctly, and that the deficiency is therefore a **design** deficiency owned jointly with Novalink, not an operating deficiency of her team.

**`P-004` Jakob Steinbacher, revised position.** Accepts the design-deficiency characterisation for `EXC-TST-2026-0318-04` and for the 96 event cases. Maintains **operating** deficiency for `EXC-…-01` (self-review), `EXC-…-02` (review after release) and `EXC-…-03` (no evidence), which are independent of `RD-RULE-0031` and are human execution failures.

**Resolution.** The divergence does not disappear. It becomes precise and documentable. Joint conclusion recorded at 16:41: **Control Effectiveness / Kontrollwirksamkeit: Partially Effective**, with a **design deficiency** (rule `RD-RULE-0031`, accountability shared with `TP-0042`) and an **operating deficiency** (three human deviations in the test sample). Both lines sign `DEC-2026-0783`. The RCSA residual rating for `RSK-0211` moves to Medium-High by agreement, not by escalation.

**Objects touched.** `CTL-PAY-014`, `TST-2026-0318`, `RSK-0211`, `RCSA-ARC-DE-PAYOPS-2026-Q4`, `DEC-2026-0783`.

**Professional note.** This is the correct shape of an outcome. The disagreement was real, it was about a genuine distinction (design versus operating), and it resolved into a sharper statement rather than into one side losing. The product must not depict 1LoD as wrong and 2LoD as right. `P-008` was right about her team and wrong about the system. `P-004` was right about the conclusion and had missed the root cause of `EXC-…-04` four weeks earlier.

---

### 15.3 Conflict register

| Conflict | Statements | Subject | Opened | Resolved | Resolved by | Outcome |
|---|---|---|---|---|---|---|
| A | `ARR-…-06` (`P-008`, 14:41) versus `ARR-…-07` (`P-011`, 14:48) | Does RepairDesk backfill reviewer identity, and did 96 payments go unreviewed | 14:48 | 15:38 | `ARR-…-12`, tenant configuration export `EVD-2026-41905` | `P-011` correct on mechanism; `P-008` correct that no human bypassed anything; the rule waived the control. Accountability shared |
| A2 | `ARR-…-07`, second sentence (`P-011`, 14:48) | Is the four-eyes configuration Arcadia's responsibility | 14:48 | Partially at 15:38. Contractually open | `ARR-…-12` plus `CHG-2024-5512` | The configuration sits in Arcadia's tenant; it was placed there by a Novalink template with non-disclosing release notes. Shared accountability. A commercial and contractual question remains open beyond 06.10.2026 |
| B | `ARR-…-08` (`P-012`, 14:55) versus `ARR-…-09` (portal, 15:02) | Is the root cause known, and what is affected | 15:02 | 15:51 | `ARR-…-14`, Rheinstack incident summary `EVD-2026-41911` | Both statements honest and both incomplete. The real finding is a 34-minute detection lag caused by a monitoring subprocessor pinned to the failed region |
| C | `ARR-…-01` ("no customer impact") versus `ARR-…-02`, `-10`, `-15`, `-17` | Was there customer impact | 14:07 | 16:19 | Accumulated verified facts | There was customer impact: 1,842 `ARC-CH` instructions queued, 2 rolled to the next value date, 1 confirmed misrouted payment of EUR 38,400. The supplier's first notification was wrong. This is a notification-quality finding under `CTR-2023-0117-A5` |
| D | `ARR-…-15` measure 1 versus measure 2 | Was `ITOL-0004-03` breached | 16:04 | Not resolved on 06.10.2026 | Requires a committee decision on tolerance definition precedence | Deliberately unresolved. The product must show an open question with a named owner (`P-005`) and a destination (`AG-CMT-NFR-2026-10-08`), not a fabricated answer |

Conflict D is the one the product must handle most carefully. Three conflicts resolve within the day. One does not, and it is not a failure of the product that it does not. A working day that resolves every question is not a credible working day.

### 15.4 Decisions recorded on 06.10.2026

| ID | Time | Decision | Decision maker | Authority basis | Reversible |
|---|---|---|---|---|---|
| `DEC-2026-0771` | 09:58 | Treat the `KRI-PAY-007` breach as a single causal issue with `KRI-PAY-003` and `KRI-PAY-011` and investigate `OVR-C` and `OVR-D` component growth, rather than requesting three separate 1LoD explanations | `P-003` | Operational Risk Policy, 2LoD analysis mandate | Yes |
| `DEC-2026-0772` | 11:58 | `RSK-0211` residual rating remains unagreed at the RCSA workshop; `P-003` records a formal 2LoD dissent and escalates to `CMT-NFR-2026-10` with both positions stated | `P-003` and `P-007` | RCSA procedure, dissent clause | Superseded at 16:41 by `DEC-2026-0783` |
| `DEC-2026-0773` | 14:12 | Activate `fallbackRouteMode = ACTIVE` for `Q-REPAIR-DE` and `Q-REPAIR-AT` under `RB-PAY-007` | `P-009` | Duty Manager authority | Yes, reversed at 16:08 |
| `DEC-2026-0776` | 15:07 | `ARC-CH`: invoke `RB-PAY-011` and submit the CHF 18.7m same-day tranche manually through the correspondent, accepting a manual-process risk, rather than wait for Novalink's 16:00 recovery estimate | `P-015` with the `ARC-CH` COO | Local resilience authority | No. Once submitted it cannot be unwound |
| `DEC-2026-0777` | 15:44 | Do not disable `RD-RULE-0031` while fallback mode is active, because disabling it mid-event would place 13 in-flight overrides into an undefined state. Instead exit fallback at 16:08 and disable the rule under change control before the next fallback activation | `P-007` with `P-004` and `P-002` | Change control, emergency provision | Yes |
| `DEC-2026-0774` | 15:47 | `ARC-DE` and `ARC-AT`: the event is significant but does not meet the major-incident threshold on facts available; reassess on receipt of the Novalink report | `P-005` with `P-006` | Group Incident Classification Standard. Illustrative regulatory context, not legal advice | Yes, explicitly provisional |
| `DEC-2026-0775` | 15:52 | `ARC-CH`: no FINMA report required on facts available; assessment documented and to be reassessed | `P-015` with `P-005` and `P-006` | `ARC-CH` local standard. Illustrative regulatory context, not legal advice | Yes, explicitly provisional |
| `DEC-2026-0778` | 16:02 | Raise a Massnahme to check all 96 unreviewed overrides, not a sample, with a 07.10.2026 12:00 deadline | `P-004` with `P-007` | Control Assurance mandate | No, once committed to the committee |
| `DEC-2026-0781` | 16:20 | Write the committee paper on verified facts as at 08.10.2026 and structure it so the 13.10.2026 supplier report cannot invalidate the decision requested. Add agenda item `AG-CMT-NFR-2026-10-10` | `P-001` | Committee secretary mandate | Yes |
| `DEC-2026-0783` | 16:41 | `CTL-PAY-014` Kontrollwirksamkeit: Partially Effective, with a design deficiency (shared accountability with `TP-0042`) and an operating deficiency (three human deviations). Both lines sign. `RSK-0211` residual moves to Medium-High by agreement | `P-008` and `P-004`, noted by `P-003` and `P-001` | RCSA and control assurance procedures | Yes, at the next test |

### 15.5 New Massnahmen raised on 06.10.2026

| ID | Title | Owner | Due | Source |
|---|---|---|---|---|
| `MSN-2026-0214` | Check all 96 overrides released without secondary review on 06.10.2026 against authoritative source data and report confirmed errors | `P-008`, assured by `P-004` | 07.10.2026 12:00 | `DEC-2026-0778`, `ARR-…-17` |
| `MSN-2026-0215` | Remove or re-scope `RD-RULE-0031` under change control so that no override reason code waives secondary review, and confirm the change in the RepairDesk tenant for all three entities | `P-007`, with `TP-0042` | 13.10.2026 | `ARR-…-12`, `DEC-2026-0777` |
| `MSN-2026-0216` | Amend runbook `RB-PAY-007` to remove the assertion that the control environment is unchanged during fallback operation, and to state the specific control effects of fallback activation | `P-007` | 20.10.2026 | `ARR-…-03` |
| `MSN-2026-0217` | Obtain the `TP-0042.2` change management commitment for subprocessor maintenance windows affecting Arcadia critical services, and assess the unnotified 13:31 firmware change against `CTR-2023-0117-A1` clause 7.2 | `P-002`, with `P-010` | 27.10.2026 | `ARR-…-14` |
| `MSN-2026-0218` | Assess the concentration and detection dependency on `TP-0042.3` Polaris Telemetrix, including whether Novalink's incident detection has a single point of failure | `P-002`, with `P-005` | 10.11.2026 | `ARR-…-14` |
| `MSN-2026-0219` | Resolve the two-measure ambiguity in `ITOL-0004-03` and review all `IBS-0004` tolerances for the same defect | `P-005`, with `P-015` | 13.10.2026 for the recommendation, 30.11.2026 for implementation | `ARR-…-15`, `DEC-2026-0781` |
| `MSN-2026-0220` | Re-run the `CTL-PAY-014` control test with the population extended to all fallback-mode periods since 11.11.2024, covering all 118 `RD-RULE-0031` firings | `P-004` | 24.11.2026 | `ARR-…-12` |
| `MSN-2026-0221` | Escalate the `TP-0042.4` Meridian notice failure and the `TP-0042.2` Amsterdam region omission as a formal notice under `CTR-2023-0117-A3` clause 3.4, and open the fourth-party drafting gap as a contract variation | `P-002`, with `P-016` and `P-010` | 16.10.2026 | `ARR-…-08`, section 7.2 |

`MSN-2026-0203`, which existed before the day as a low-priority documentation update, is re-prioritised at 15:52 and re-scoped to depend on `MSN-2026-0215`.

---

## 16. Evidence artefacts referenced in this scenario

All evidence lives in `SYS-0032` Arcadia Evidence Vault with immutable versioning. Identifiers are sequential within the year.

| ID | Artefact | Source | Created | Used by |
|---|---|---|---|---|
| `EVD-2026-40118` | Novalink RepairDesk DR test report | `TP-0042` | 22.05.2026 | `TPRM-Q-2026-R04`, `-R07` |
| `EVD-2026-40233` | Penetration test summary, 2 pages | `TP-0042` | 30.06.2026 | `TPRM-Q-2026-R19` |
| `EVD-2026-41102` | `NOVA-CR-4412` delivery note | `TP-0042` | 18.09.2026 | `MSN-2026-0147` |
| `EVD-2026-41205` | UAT scheduling request, unanswered | `ARC-DE` Technology | 22.09.2026 | `MSN-2026-0147` |
| `EVD-2026-41871` | `NSN-2026-0887` notification as received | Shared mailbox | 06.10.2026 14:05 | `ARR-…-01` |
| `EVD-2026-41874` | `SYS-0014` configuration audit log extract, fallback activation | `SYS-0014` | 06.10.2026 14:12 | `ARR-…-03` |
| `EVD-2026-41875` | `CHG-2026-7741` change record | `ARC-DE` Technology | 06.10.2026 14:12 | `ARR-…-03` |
| `EVD-2026-41882` | `ARC-CH` payment queue export | `SYS-0015` | 06.10.2026 15:09 | `ARR-…-10` |
| `EVD-2026-41901` | Group Legal opinion on the binding appendix version | `P-016` | 06.10.2026 15:23 | `MSN-2026-0221` |
| `EVD-2026-41905` | RepairDesk tenant configuration export including `RD-RULE-0031` | `TP-0042` engineering | 06.10.2026 15:38 | `ARR-…-12` |
| `EVD-2026-41906` | `RD-RULE-0031` firing history, 11.11.2024 to 06.10.2026 | `SYS-0014` | 06.10.2026 15:38 | `ARR-…-12`, `MSN-2026-0220` |
| `EVD-2026-41907` | `CHG-2024-5512` change record and attached Novalink release notes for release 8.3 | `ARC-DE` Technology archive | created 11.11.2024, retrieved 06.10.2026 15:40 | `ARR-…-12` |
| `EVD-2026-41908` | `CTL-PAY-014` control description version 4.1 | `SYS-0031` | 14.01.2025 | `ARR-…-12` |
| `EVD-2026-41911` | `TP-0042.2` Rheinstack incident summary | `TP-0042.2` via `TP-0042` | 06.10.2026 15:51 | `ARR-…-14` |
| `EVD-2026-41918` | Correspondent confirmation `CONF-2026-9931` | Helvetia Clearing Partner AG | 06.10.2026 16:04 | `ARR-…-15` |
| `EVD-2026-41921` | `NSN-2026-0887-U2` restoration update | `TP-0042` portal | 06.10.2026 16:12 | `ARR-…-16` |
| `EVD-2026-41924` | Post-event validation of 20 of 96 overrides | `ARC-DE` Payment Repair | 06.10.2026 16:19 | `ARR-…-17` |
| `EVD-2026-41930` | Recall instruction for `PAY-DE-20261006-448127` | `SYS-0011` | 06.10.2026 16:24 | `ARR-…-17` |

Evidence retrieved on 06.10.2026 but created earlier retains its original creation date and records a separate retrieval timestamp. The product must display both, because "we have had this document since May and nobody read it" is a different finding from "we obtained this document today".

`EVD-2026-40118` is exactly such a case. It has been in the vault since 22.05.2026 and it contains the 1 hour 40 minute RTO gap. Nobody escalated it for 137 days.

---

## 17. Rating scales

### 17.1 Control effectiveness / Kontrollwirksamkeit

| Rating | German | Definition |
|---|---|---|
| Effective | Wirksam | Designed appropriately and operating as designed throughout the period. No deviations, or deviations that are isolated and fully explained |
| Partially Effective | Teilweise wirksam | A design deficiency or an operating deficiency exists that could allow the risk to materialise, but the control provides some mitigation |
| Not Effective | Nicht wirksam | The control does not mitigate the risk, whether by design or by operation |
| Not Tested | Nicht getestet | No assurance obtained in the period |

`CTL-PAY-014` carries "Fully Effective / Voll wirksam" as a 1LoD self-assessment label. Note the terminology mismatch: the 1LoD self-assessment form offers "Fully Effective / Voll wirksam" while the 2LoD scale offers "Effective / Wirksam". The two scales are not identical and nobody has aligned them. The product should surface this as a small, real, irritating finding, because it is the kind of thing that actually happens and it slightly weakens both positions.

### 17.2 Risk rating

Score is impact multiplied by likelihood on a 1 to 5 scale, giving 1 to 25.

| Band | Score | German |
|---|---|---|
| Low | 1 to 4 | Niedrig |
| Medium-Low | 5 to 7 | Niedrig-Mittel |
| Medium | 8 to 9 | Mittel |
| Medium-High | 10 to 14 | Mittel-Hoch |
| High | 15 to 19 | Hoch |
| Very High | 20 to 25 | Sehr hoch |

Appetite boundary for payment execution risks: a residual score of 10 or above is outside appetite.

### 17.3 Incident severity

| Severity | Criteria |
|---|---|
| `S1` | An impact tolerance for an important business service is breached or within 60 minutes of breach, or a zero-tolerance control condition has candidate breaches, or client funds are at risk |
| `S2` | An important business service is materially degraded with a plausible path to an impact tolerance breach |
| `S3` | A service is degraded with no current path to a tolerance breach |
| `S4` | Minor or contained |

### 17.4 Third-party criticality

| Tier | Criteria |
|---|---|
| Tier 1 | Supports a critical or important function, or a significant business process, and is not readily substitutable |
| Tier 2 | Supports a critical or important function and is substitutable within 3 months |
| Tier 3 | Material spend, no critical function dependency |
| Tier 4 | All others |

---

## 18. Regulatory reference register

Every reference below must be rendered with the label **"Illustrative regulatory context, not legal advice."** at the point of display. The product never states that Arcadia is compliant with anything.

### 18.1 `ARC-DE` Arcadia Bank AG, Germany

| Reference | Used for | Where it appears |
|---|---|---|
| DORA (Regulation (EU) 2022/2554) | ICT third-party risk, register of information, subcontracting, incident classification and reporting, resilience testing | `TP-0042` classification, `REG-2026-0031`, `DEC-2026-0774`, `CTR-2023-0117-A3` discussion |
| EBA Guidelines on outsourcing arrangements | Material outsourcing / wesentliche Auslagerung classification, register content, audit rights, exit planning | `SVC-0042-01` to `-04`, `CTR-2023-0117-A4`, `-A6` |
| MaRisk (BaFin Minimum Requirements for Risk Management), AT 4.3 internal control system and AT 9 outsourcing | Internes Kontrollsystem (IKS) framing, Auslagerung governance | `CTL-PAY-014` IKS designation, `TP-0042` governance |
| BAIT (BaFin Supervisory Requirements for IT in Financial Institutions) | IT governance, change management, third-party IT | `CHG-2024-5512` review, `SYS-0014` change governance |
| National supervision: BaFin and Deutsche Bundesbank | Supervisory access rights, reporting context | Entity views |

### 18.2 `ARC-AT` Arcadia Bank Oesterreich AG, Austria

| Reference | Used for | Where it appears |
|---|---|---|
| DORA (Regulation (EU) 2022/2554) | Same as `ARC-DE` | `REG-2026-0031`, `DEC-2026-0774` |
| EBA Guidelines on outsourcing arrangements | Same as `ARC-DE` | `SVC-0042-01`, `-02`, `-03`, `-04` |
| FMA Austria supervision and the Austrian implementation of the EU framework | National supervision context, local entity notification | `ARC-AT` entity views |

### 18.3 `ARC-CH` Arcadia Bank Schweiz AG, Switzerland

**DORA does not apply to `ARC-CH`. The product must never state or imply that it does.** Where a group-level view aggregates all three entities, the `ARC-CH` column must show its own framework references, and any DORA-derived field must be shown as not applicable for `ARC-CH` rather than left to imply coverage.

| Reference | Used for | Where it appears |
|---|---|---|
| FINMA Circular 2023/1 Operational risks and resilience, banks | Operational risk management, operational resilience, critical business processes, tolerance for disruption, ICT and cyber risk | `IBS-0004` designation for `ARC-CH`, `ITOL-0004-03`, `DEC-2026-0775`, `REG-2026-0104` |
| FINMA Circular 2018/3 Outsourcing, banks and insurers | Significant outsourcing / wesentliche Auslagerung, inventory, supervisory and audit access, data access by subcontractors abroad | `SVC-0042-02` (CH), `SVC-0042-05`, `TP-0042.1`, the `TP-0042.4` Meridian data access question, `REG-2026-0088` |
| Swiss Banking Act and Banking Ordinance | Entity-level prudential framing | `ARC-CH` entity view |
| Swiss Federal Act on Data Protection (FADP) | Cross-border disclosure of client-identifying data | `TP-0042.4`, `TP-0042.3-F1` |
| FINMA reporting expectations for incidents of substantial importance | Incident reporting assessment | `DEC-2026-0775` |

### 18.4 Terminology pairs, mandatory

Every surface uses the paired form on first use in a view: English / German / abbreviation where one exists.

| English | German | Abbreviation |
|---|---|---|
| Internal Control System | Internes Kontrollsystem | IKS |
| Third-Party Risk Management | Drittparteienrisikomanagement | TPRM |
| Outsourcing | Auslagerung | |
| Material outsourcing | Wesentliche Auslagerung | |
| Subprocessor | Unterauftragnehmer | |
| Fourth party | Viertpartei | |
| Materiality | Wesentlichkeit | |
| Control Effectiveness | Kontrollwirksamkeit | |
| Risk Acceptance | Risikoakzeptanz | |
| First Line of Defence | Erste Verteidigungslinie | 1LoD |
| Second Line of Defence | Zweite Verteidigungslinie | 2LoD |
| Third Line of Defence | Dritte Verteidigungslinie | 3LoD |
| Remediation Action | Massnahme | |
| Risk and Control Self Assessment | Risiko- und Kontrollselbstbewertung | RCSA |
| Key Risk Indicator | Risikoindikator | KRI |
| Important business service | Wichtige Geschaeftsdienstleistung | |
| Impact tolerance | Toleranzschwelle | |
| Business Continuity Management | Betriebskontinuitaetsmanagement | BCM |
| Segregation of duties | Funktionstrennung | |
| Four-eyes principle | Vier-Augen-Prinzip | |
| Finding | Feststellung | |
| Evidence | Nachweis | |
| Escalation | Eskalation | |
| Incident | Vorfall | |
| Committee | Gremium | |

Note on orthography. Display surfaces use correct German spelling with umlauts. The eszett is written as "ss" throughout, which is the Swiss convention and which keeps one spelling of "Massnahme" across a group that includes a Swiss entity. This is a deliberate choice and it is applied uniformly. Identifier tables and code-facing content in this document transliterate umlauts to keep them ASCII-safe; display surfaces must not.

---

## 19. Invariants for engineers

These must hold in every seeded dataset and in every generated surface. A build that violates one of these is broken.

1. Every displayed Arcadia surface carries "Synthetic institution and data".
2. Every regulatory reference carries "Illustrative regulatory context, not legal advice." at the point of display.
3. No surface asserts compliance with any regulation.
4. No `ARC-CH` record, view, field or narration references DORA as applicable. Group aggregate views show `ARC-CH` with its own framework references or an explicit not-applicable.
5. The em dash character does not appear in any string, anywhere.
6. Times are 24-hour. Dates are DD.MM.YYYY.
7. Every state change names five things: system of record, entity partition, record identifier, accountable human, evidence reference. A state change missing any of the five is rejected.
8. Every information arrival carries exactly one of `VF`, `SS`, `TI`, plus any reclassification history. Classifications are never silently changed.
9. Stakeholder statements are always attributed to a named person with a timestamp and are never restated as facts.
10. Telemetry inferences always display the measurement, the inference, and the specific reason the inference could be wrong.
11. Conflict D, the `ITOL-0004-03` two-measure question, is never resolved within the scenario day.
12. Numbers reconcile. 138 `OVR-C` overrides created between 14:12:41 and 14:26:00 = 96 with no review required, plus 29 reviewed and released, plus 13 awaiting review. 96 = 78 `ARC-DE` plus 18 `ARC-AT`. EUR 9,420,880 = EUR 7,611,240 plus EUR 1,809,640. 1,842 `ARC-CH` instructions = 1,840 accepted plus 2 rolled.
13. `TST-2026-0318`: 60 = 54 clean, plus 4 exceptions, plus 2 unable to conclude.
14. `KRI-PAY-007` September value: 731 divided by 1,905,000, times 10,000, equals 3.8373, displayed as 3.84.
15. `MSN-2026-0147` overdue days as at 06.10.2026 = 67, counted from 31.07.2026.
16. `RD-RULE-0031` total firings 118 = 96 on 06.10.2026, plus 22 across 7 prior fallback activations.
17. September 2026 `ARC-DE` override components sum to 731: 68 plus 214 plus 198 plus 211 plus 40. August components sum to 412: 62 plus 197 plus 31 plus 94 plus 28.
18. `ARC-DE` September repair items 51,435 = 50,355 standard repairs, plus 731 overrides, plus 349 returns and cancellations.
19. Every identifier follows section 1. No identifier is reused. Superseded objects keep their identifier and gain a pointer.
20. The 1LoD scale label "Fully Effective / Voll wirksam" and the 2LoD scale label "Effective / Wirksam" remain distinct. Do not silently normalise them.
21. No external benchmark, industry average or peer comparison appears anywhere. Every quantity is a scenario figure for a synthetic institution.

---

## 20. What this scenario is designed to demonstrate

Stated plainly so that engineering and design decisions can be tested against it.

1. **The morning brief matters more than the event.** Four red indicators, one control test, one overdue action and one supplier reassessment are already, at 07:45, one causal chain pointing at one rule in one supplier system. No current reporting connects them. That connection is the product's core value and it is available six hours before anything dramatic happens.
2. **The event is a repeat, not a surprise.** `EXC-TST-2026-0318-04` was the same rule, found 41 days earlier, classified as a configuration curiosity and closed with a documentation action that was never started. The uncomfortable question the day raises is about Arcadia's own follow-up discipline, not about the supplier.
3. **Facts arrive late, incomplete and in conflict, and decisions cannot wait for them.** `DEC-2026-0776` had to be taken at 15:07, 31 minutes before the root cause was known, because the manual route needed 45 minutes and the cut-off was at 16:00. The product must make decisions under uncertainty legible, not eliminate uncertainty.
4. **Human judgment is where the value sits and it must stay visibly human.** Materiality, the design versus operating distinction, whether to accept a manual-process risk to meet a cut-off, whether to disable a rule mid-event, and what to put in front of a committee on incomplete facts are all decisions that a competent system should prepare completely and decide never.
5. **The most valuable finding is the least dramatic.** An impact tolerance with two measures and no stated precedence means the entity cannot say whether it breached its own tolerance. That is worth more than the incident.
6. **Disagreement between the lines is legitimate and resolves into precision, not into a winner.** `P-008` was right about her team and wrong about the system. `P-004` reached the right conclusion and had missed the root cause four weeks earlier. Both signed one sharper statement at 16:41.

---

**Synthetic institution and data. Illustrative regulatory context, not legal advice.**

*End of `DOC-SCENARIO-BIBLE` version 1.0.*
