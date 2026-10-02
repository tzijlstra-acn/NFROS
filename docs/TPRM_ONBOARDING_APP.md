# Third-Party Onboarding App

**Role:** Third-Party Risk Manager (tprm)
**Status:** Installed, production-shaped
**Maturity:** V3.2

Synthetic institution and data.

---

## What this app does

The Third-Party Onboarding app guides the Third-Party Risk Manager through the structured process of bringing a new supplier into scope, from the first business request to active monitoring.

The app breaks the onboarding into eight defined stages. At each stage gate, the TPRM professional reviews the work, makes a decision and records a rationale. The AI partner does the preparation: it summarises evidence, flags missing items, drafts specialist review requests and produces the governance paper.

The professional's job is to read, challenge and decide. The AI partner's job is to make sure the file is complete and the decision is informed.

---

## The eight stages

| Stage | German name | What happens |
|---|---|---|
| 1 | Antrag und Aufnahme | Business request received, supplier candidate registered |
| 2 | Einstufung und Kritikalitaet | Classification (outsourcing vs. ICT service) and criticality determined |
| 3 | Massgeschneiderte Sorgfaltspruefung | Tailored due diligence questionnaire dispatched and responses received |
| 4 | Nachweispruefung | Evidence reviewed item by item, gaps chased |
| 5 | Fachpruefungen | IT Security, Privacy and Legal specialist reviews |
| 6 | Vertrag und Bedingungen | Contract drafted, conditions reflected, commercial terms agreed |
| 7 | Entscheidung und Onboarding | Governance approval recorded, contract signed |
| 8 | Uebergabe an Monitoring | Monitoring plan set, case closed, supplier moved to active monitoring |

---

## The seeded demo case

The demo opens at Stage 4 with a real onboarding file in progress.

**Supplier:** Veridian Document Systems GmbH (TP-0099)
**Service:** Cloud document processing and payment data reconciliation
**Business owner:** Andreas Kellner, Head of Payment Operations (P-007)
**Procurement reference:** PRQ-2026-0087
**Entities in scope:** Arcadia Bank AG (ARC-DE), Arcadia Bank Oesterreich AG (ARC-AT)

The file is mid-process. Four evidence items have been received and reviewed. Two are missing: the full penetration test report and the business continuity plan. IT Security and Privacy have signed off, each with a condition. Legal is still reviewing the contract draft.

The professional's task at Stage 4 is to decide whether to pass the stage gate conditionally (items expected in three days) or hold the file until they arrive.

---

## What the AI partner does

Before the session starts, the AI partner has:

- Reviewed each evidence document and written a summary with open questions
- Cross-referenced the SOC 2 report against the supplier questionnaire and flagged the Netherlands backup discrepancy
- Identified the two outstanding evidence items and drafted chase messages to the supplier
- Produced a draft stage gate memo recommending conditional progression, with the condition documented
- Noted that the Legal review timeline means Stage 6 cannot start before 20.10.2026

The professional reviews the AI partner's preparation, challenges the reasoning and makes the gate decision.

---

## Key decisions the app surfaces

**Stage 4 gate decision:** Pass conditionally, hold, or escalate? The file has two missing items. The AI partner recommends conditional progression with a recorded condition. The professional decides.

**Evidence adequacy:** Is the SOC 2 executive summary sufficient for IT Security sign-off, or is the full penetration test report genuinely required? IT Security has said it is required. The professional confirms or overrides.

**Contract conditions:** Three contract conditions are outstanding. Each requires a position: accept the supplier's counter-proposal, hold the original Arcadia position, or negotiate. Group Legal has held the on-site inspection right. The professional endorses or challenges that position.

---

## How the demo differs from the Novalink scenario

The Novalink scenario (the main workday) is a reassessment: an existing, critical supplier under active review during a live incident. The onboarding case is a forward-looking intake: a new, important supplier being brought in during a normal working day.

The two cases coexist in the TPRM role to show that the role holder manages a portfolio rather than a single file. The Novalink file is urgent; the Veridian file is important but not urgent. Part of the demo is showing how the AI partner holds both cases in view so the professional can prioritise.

---

## Constraints and scope

This app is part of the NFR WorkOS V3.2 release. It is a demo and prototyping tool.

- Synthetic institution and data
- The supplier, service, parties and all documentation are fictional
- Illustrative regulatory context, not legal advice
- No claim of regulatory compliance is made
