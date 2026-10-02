# Workday V3.2 TPRM Onboarding Process Design

**Status:** Seeded and integrated (v3.2 release)
**Author:** Agent E (NFR WorkOS V3.2 release)
**Date:** 2026-10-06

Synthetic institution and data. Illustrative only.

---

## 1. Purpose of this document

This document records the design of the Third-Party Onboarding process and the seed data for the new onboarding case introduced in V3.2. It describes:

- The synthetic onboarding case (supplier, service, parties, evidence status)
- All eight stages with data mapping and completion criteria
- How existing TPRM decisions and supplier data connect to the process
- The seed data additions and the loading sequence
- What "completing" each stage means in the demo context

---

## 2. Synthetic onboarding case

### 2.1 Supplier

| Field | Value |
|---|---|
| Supplier ID | TP-0099 |
| Name | Veridian Document Systems GmbH |
| Legal form | GmbH |
| Domicile | Berlin, Germany |
| Status | Active (onboarding in progress) |
| Criticality (proposed) | Important |
| Is outsourcing | No (proposed as ICT service) |
| Contracting entities | ARC-DE, ARC-AT |
| Annual spend (estimate) | EUR 480,000 |
| Relationship owner | P-002 Stefan Brunner |

The name "Meridian" was avoided because TP-0042.4 Meridian Operations Support Pvt Ltd already exists in the register as a subprocessor.

### 2.2 Service

| Field | Value |
|---|---|
| Service ID | SVC-OB-0099-01 |
| Name | Cloud document processing and payment data reconciliation |
| Domain | payments |
| Entities | ARC-DE, ARC-AT |
| Business owner | P-007 Andreas Kellner |
| Status | Not yet operational |

The service ingests SWIFT MT9xx and ISO 20022 camt.054 payment confirmation documents and reconciles them against the Arcadia Payment Hub ledger. It generates exception reports and a reconciliation dashboard for Payment Operations and Finance.

### 2.3 Parties

| Role | Person | ID |
|---|---|---|
| Business owner / requestor | Andreas Kellner, Head of Payment Operations | P-007 |
| TPRM owner | Stefan Brunner, Third-Party Risk Manager | P-002 |
| IT Security reviewer | Group Information Security (no individual user row) | n/a |
| Privacy reviewer | Group Data Protection Office (no individual user row) | n/a |
| Legal reviewer | Dr. Anja Weiss, Outsourcing Counsel | P-016 |
| Executive sponsor | Dr. Heinrich Adler, Group COO | P-014 |

### 2.4 Procurement reference

PRQ-2026-0087. Submitted by P-007 on 14.08.2026 via the Arcadia Procurement Portal.

### 2.5 Classification proposal

The business owner proposed the arrangement as an ICT service supporting the Corporate Payments function (IBS-0004). The arrangement is not proposed as a regulated outsourcing because Arcadia retains the function (payment reconciliation), defines the output and holds the authoritative data in the Payment Hub. TPRM has not yet confirmed this classification at Stage 2; the criticality scorecard records the proposal.

Proposed criticality: Important. Rationale: the service supports but does not replace payment reconciliation; loss would not stop payments but would degrade the daily close and exception management process.

### 2.6 Contract

| Field | Value |
|---|---|
| Contract ID | CTR-OB-2026-0087 |
| Title | ICT Service Agreement, Document Processing and Reconciliation Platform (Draft) |
| Version | 0.3 as at 06.10.2026 |
| Governing law | German |
| Contracting entity | ARC-DE (with accession schedule for ARC-AT) |
| Term | 3 years from 01.11.2026 (proposed) |
| Notice period | 90 days for convenience |

Three conditions outstanding as at 06.10.2026:
1. Audit rights clause (clause 4.1): supplier proposes substituting SOC 2 report; Group Legal holds on-site inspection right.
2. Data residency (clause 5.2): Netherlands backup scope not confirmed; processing scope unclear.
3. Subprocessor consent model (clause 6.1): supplier proposes notice-and-objection; Group Legal requires prior consent.

### 2.7 Evidence status

| Evidence ID | Item | Status |
|---|---|---|
| EVD-OB-0099-01 | Vendor Information Questionnaire | Accepted |
| EVD-OB-0099-02 | IT Security Assessment | Accepted with condition |
| EVD-OB-0099-03 | Privacy Impact Assessment | Accepted |
| EVD-OB-0099-04 | SOC 2 Type II Report 2025 | Accepted |
| EVD-OB-0099-05 | Penetration Test Report (full) | MISSING - requested 28.09.2026 |
| EVD-OB-0099-06 | Business Continuity Plan and Test Report | MISSING - requested 28.09.2026 |
| EVD-OB-0099-07 | Legal Review Status Note | Draft (pending) |
| EVD-OB-0099-08 | Stage 4 Stage Gate Memo | Draft (in progress) |

### 2.8 Specialist review status

| Function | Status | Condition |
|---|---|---|
| IT Security | Approved with condition | Full penetration test report required before contract signature |
| Privacy | Approved | Netherlands processing scope confirmation required before contract signature |
| Legal | Pending | Open points on audit rights, data residency and subprocessor consent |

### 2.9 Current stage

Stage 4: Nachweispruefung (Evidence Review). Active and in progress as at 06.10.2026 at 07:45.

---

## 3. The eight-stage process

### Stage 1: Antrag und Aufnahme (Request and Intake)

**What happens:** The business owner submits a supplier intake request. TPRM validates completeness, assigns a procurement reference and creates the supplier candidate record.

**Completion criteria:** Intake form received and validated, procurement reference assigned, supplier candidate record created, relationship owner identified.

**Data mapping for the seeded case:**
- Intake form: EVD-OB-0099-01 covers the intake questionnaire
- Procurement reference: PRQ-2026-0087 assigned 22.08.2026
- Supplier record: TP-0099 created

**Status in seeded run:** Complete.

### Stage 2: Einstufung und Kritikalitaet (Classification and Criticality)

**What happens:** TPRM determines the regulatory classification (outsourcing vs. ICT service) and the criticality rating, and confirms which legal entities are in scope.

**Completion criteria:** Classification decision recorded with rationale, proposed criticality assigned, contracting entities confirmed.

**Data mapping for the seeded case:**
- Classification: ICT service (proposed; not outsourcing)
- Criticality: Important (proposed by business owner, not yet formally confirmed)
- Entities: ARC-DE, ARC-AT (ARC-CH excluded; service does not serve the Swiss entity)

**Status in seeded run:** Complete (classification and criticality recorded at intake, awaiting TPRM formal confirmation which is a Stage 2 output rather than an intake field).

### Stage 3: Massgeschneiderte Sorgfaltspruefung (Tailored Due Diligence)

**What happens:** TPRM tailors the due diligence questionnaire and evidence request list to the classification and criticality. The supplier is invited to respond.

**Completion criteria:** Questionnaire dispatched, responses received, evidence request list agreed.

**Data mapping for the seeded case:**
- Questionnaire dispatched: 28.08.2026
- Supplier response (EVD-OB-0099-01): received 05.09.2026, ingested 08.09.2026
- Evidence request list: six items (four received, two outstanding)

**Status in seeded run:** Complete.

### Stage 4: Nachweispruefung (Evidence Review) -- CURRENT STAGE

**What happens:** TPRM reviews each evidence item, accepts or rejects it, and chases outstanding items. The stage gate passes when all items are either accepted or formally recorded as outstanding with a chase date.

**Completion criteria:** All requested items either accepted, rejected with a documented reason, or recorded as outstanding with a chase date. No unreviewed items.

**Data mapping for the seeded case:**
- Four items accepted: EVD-OB-0099-01, EVD-OB-0099-02, EVD-OB-0099-03, EVD-OB-0099-04
- Two items outstanding with chase dates: EVD-OB-0099-05 (penetration test), EVD-OB-0099-06 (BCM plan)
- Stage gate memo: EVD-OB-0099-08 (in progress)

**Status in seeded run:** Active and in progress. The stage gate has not been passed. The decision point is whether to pass the gate conditionally (items expected by 09.10.2026) or hold at Stage 4 until items are received.

**What "completing" this stage means in the demo:**
The TPRM professional records a conditional stage gate decision: the file progresses to Stage 5 on the basis that the two outstanding items are received by 09.10.2026. A condition is placed on the file. The decision is a human decision with a recorded rationale.

### Stage 5: Fachpruefungen (Specialist Reviews)

**What happens:** The completed evidence file is sent to IT Security, Privacy and Legal for specialist review. Each function returns an opinion or a list of conditions.

**Completion criteria:** IT Security complete, Privacy complete, Legal complete or conditions recorded.

**Data mapping for the seeded case:**
- IT Security: EVD-OB-0099-02, approved with condition (EVD-OB-0099-05 required)
- Privacy: EVD-OB-0099-03, approved
- Legal: EVD-OB-0099-07, pending

**Status in seeded run:** Partially complete. IT Security and Privacy opinions are recorded. Legal is pending (expected 20.10.2026). The stage cannot be formally closed until Legal signs off.

### Stage 6: Vertrag und Bedingungen (Contract and Conditions)

**What happens:** Group Legal drafts or reviews the contract. Specialist review conditions are translated into contract conditions. Business owner and procurement confirm commercial terms.

**Completion criteria:** Draft contract reviewed by Legal, all specialist conditions reflected as contract obligations or formally waived, sign-off obtained.

**Data mapping for the seeded case:**
- Draft contract: CTR-OB-2026-0087 v0.3
- Contract obligations: COB-OB-2026-0087-01 (audit rights), COB-OB-2026-0087-02 (data residency), COB-OB-2026-0087-03 (subprocessor consent)
- All three obligations have status "not-evidenced" (conditions not yet resolved)

**Status in seeded run:** Not reached. Three contract conditions are outstanding.

### Stage 7: Entscheidung und Onboarding (Decision and Onboarding)

**What happens:** TPRM presents the onboarding file to the NFR Committee (for important suppliers). Approval or conditional approval is recorded. Contract is executed.

**Completion criteria:** Governance approval recorded, conditions documented, contract signed, supplier status changed to active.

**Status in seeded run:** Not reached.

### Stage 8: Uebergabe an Monitoring (Handover to Monitoring)

**What happens:** The supplier file is handed over to the ongoing monitoring cycle. Monitoring frequency and next assessment date are set. The onboarding case is closed.

**Completion criteria:** Monitoring plan created, next assessment date set, relationship owner confirmed, case closed.

**Status in seeded run:** Not reached. Next assessment date pre-populated as 2027-10-31.

---

## 4. Connection to existing TPRM decisions

The existing TPRM decisions in the scenario (all relating to TP-0042 Novalink) are the reassessment scenario. The onboarding case (TP-0099) is an independent case. The two cases coexist in the TPRM workday to show that the role holder manages a portfolio, not a single file.

Existing TPRM decisions (Novalink reassessment) are not affected by the onboarding seed data. No Novalink records are modified.

The workspace builder at `src/db/repositories/workspace.ts` currently renders the TPRM workspace focused on TP-0042 (line `const TPRM_SUPPLIER_ID = "TP-0042"`). The onboarding app is a separate view, not the main workspace view.

---

## 5. Seed data additions and loading sequence

### 5.1 New records added

| Table | Records | IDs |
|---|---|---|
| suppliers | 1 | TP-0099 |
| services | 1 | SVC-OB-0099-01 |
| contracts | 1 | CTR-OB-2026-0087 |
| contract_obligations | 3 | COB-OB-2026-0087-01/02/03 |
| evidence_documents | 8 | EVD-OB-0099-01 through EVD-OB-0099-08 |

No existing records are modified.

### 5.2 Module location

`src/db/seed/tprm-onboarding.ts` exports five arrays:
- `tprmOnboardingSuppliers`
- `tprmOnboardingServices`
- `tprmOnboardingContracts`
- `tprmOnboardingContractObligations`
- `tprmOnboardingEvidenceDocuments`

### 5.3 Integration point

`src/db/seed/run.ts` imports these arrays and spreads them into the existing insertAll calls at the relevant positions. The loading sequence follows the existing dependency order:

1. suppliers (includes TP-0099)
2. services (includes SVC-OB-0099-01)
3. contracts (includes CTR-OB-2026-0087)
4. contractObligations (includes the three draft obligations)
5. evidenceDocuments (includes EVD-OB-0099-01 through 08, spread into allEvidenceDocuments)

Evidence chunks are derived automatically from the evidenceDocuments body text by the chunkDocument function in run.ts.

### 5.4 Process definition location

`src/role-apps/tprm/definition.ts` exports:
- `TPRM_ONBOARDING_PROCESS`: the eight-stage process definition
- `THIRD_PARTY_ONBOARDING_APP`: the role app definition with seeded run state

The file defines its types locally (RoleProcessDefinition, RoleAppDefinition, etc.) for compatibility before `src/role-apps/contracts.ts` is created by Agent D.

---

## 6. Stable ID prefix conventions

All new records introduced by this onboarding case use the following prefixes:

- Supplier: `TP-0099`
- Service: `SVC-OB-0099-`
- Contract: `CTR-OB-2026-`
- Contract obligations: `COB-OB-2026-0087-`
- Evidence documents: `EVD-OB-0099-`
- Evidence requests (in body text only): `REQ-OB-0099-`

---

## 7. Constraints honoured

- No em dash (U+2014) in any file
- German text uses ae oe ue ss (no umlauts) in code identifiers and technical fields
- No real company names (Veridian Document Systems GmbH is synthetic)
- No second institution created; all records belong to Arcadia Bank AG
- "Synthetic institution and data" appears in the supplier description and in body text where appropriate
- Novalink data (TP-0042) is untouched
- No claim of regulatory compliance
- No fake client savings
