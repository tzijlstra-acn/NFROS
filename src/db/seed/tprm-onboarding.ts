/**
 * Seed additions for the TPRM Third-Party Onboarding case.
 *
 * Adds a new synthetic supplier (Veridian Document Systems GmbH, TP-0099)
 * at Stage 4 (Nachweispruefung, Evidence Review) of the onboarding process.
 * All records are prefixed "tprm-ob-" for new onboarding-specific rows, or
 * use the supplier ID prefix "TP-0099" and contract ID "CTR-OB-2026-0087".
 *
 * These arrays are designed to be spread into the insertAll calls in run.ts
 * alongside the existing third-party and evidence data. They do not modify or
 * remove any existing row.
 *
 * Synthetic institution and data. Illustrative only.
 */

import { DEFAULT_RUN_ID, ENTITY_AT, ENTITY_DE } from "@/scenario/data/contract";
import type {
  NewContractObligation,
  NewContract,
  NewEvidenceDocument,
  NewService,
  NewSupplier,
} from "@/scenario/data/contract";

/* ==========================================================================
   Supplier
   ========================================================================== */

export const tprmOnboardingSuppliers: NewSupplier[] = [
  {
    id: "TP-0099",
    runId: DEFAULT_RUN_ID,
    name: "Veridian Document Systems GmbH",
    legalForm: "Gesellschaft mit beschraenkter Haftung (GmbH)",
    domicile: "Berlin, Germany",
    /**
     * Proposed as important by the business owner. Criticality is under review
     * and has not yet been confirmed by TPRM at Stage 4.
     */
    criticality: "important",
    /**
     * The arrangement is proposed as an ICT service (not a regulated
     * outsourcing) because Arcadia retains the function, defines the output
     * and holds the data in its own systems. TPRM has not yet issued a final
     * classification opinion; this is the business owner's proposal.
     */
    isOutsourcing: false,
    contractingEntityIds: [ENTITY_DE, ENTITY_AT],
    /**
     * Onboarding status indicates the supplier is in the intake pipeline and
     * has not yet been approved for active use.
     */
    status: "active",
    lastAssessmentDate: null,
    nextAssessmentDue: "2027-10-31",
    annualSpend: 480000,
    spendCurrency: "EUR",
    relationshipOwnerUserId: "P-002",
    description:
      "Cloud-hosted document processing and payment data reconciliation platform, covering automated ingestion of incoming payment confirmations, SWIFT message parsing, exception flagging and an interactive reconciliation dashboard. To be used by the Payment Operations and Finance teams at Arcadia Bank AG and Arcadia Bank Oesterreich AG. Requested by Andreas Kellner (P-007) under procurement reference PRQ-2026-0087 on 14.08.2026. Registered commercial register HRB 211874 B, Berlin, founded 2019, approximately 120 employees (scenario figure). Onboarding process opened 22.08.2026, currently at Stage 4 Evidence Review as at 06.10.2026. Synthetic institution and data.",
    concentrationNote:
      "New supplier with no existing footprint in the Arcadia third-party register. No concentration exposure identified at intake. Post-approval the service will sit alongside IBS-0004 Corporate Payments in the data lineage; concentration implications are noted in the classification memo for Stage 2.",
  },
];

/* ==========================================================================
   Services
   ========================================================================== */

export const tprmOnboardingServices: NewService[] = [
  {
    id: "SVC-OB-0099-01",
    runId: DEFAULT_RUN_ID,
    name: "Cloud document processing and payment data reconciliation",
    nameDe: "Cloud-Dokumentenverarbeitung und Zahlungsabstimmung",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT],
    ownerUserId: "P-007",
    domain: "payments",
    description:
      "Automated ingestion and parsing of incoming payment confirmation documents (SWIFT MT9xx, ISO 20022 camt.054) and reconciliation against the Arcadia Payment Hub ledger. Generates exception reports and an interactive dashboard for the payment operations and finance teams. Classified as an ICT service (business owner's proposal; formal classification pending TPRM Stage 2 conclusion). Not yet operational; onboarding in progress. Synthetic institution and data.",
    supplierIds: ["TP-0099"],
    operationalStatus: "normal",
  },
];

/* ==========================================================================
   Contracts
   ========================================================================== */

export const tprmOnboardingContracts: NewContract[] = [
  {
    id: "CTR-OB-2026-0087",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0099",
    entityId: ENTITY_DE,
    reference: "CTR-OB-2026-0087",
    title: "ICT Service Agreement, Document Processing and Reconciliation Platform (Draft)",
    effectiveFrom: "2026-11-01",
    effectiveTo: "2029-10-31",
    documentType: "framework",
    noticePeriodDays: 90,
    auditRightsSecured: false,
    subprocessorConsentModel:
      "Prior written consent for any subprocessor with access to Arcadia data. This clause is proposed by Group Legal and has not yet been accepted by the supplier.",
    summary:
      "Draft version 0.3 as at 06.10.2026. Negotiation is ongoing. Three conditions remain outstanding: (1) the audit and inspection rights clause has not been agreed, (2) the data residency schedule lists Germany and Austria but the supplier has not confirmed that no processing occurs in other EEA member states, and (3) the subprocessor consent model is disputed. The draft sets an initial three-year term from 01.11.2026 with a 90-day notice period for convenience. Annual charge EUR 480,000 group-wide (scenario figure). Governing law German. Contracting entity Arcadia Bank AG with an accession schedule for Arcadia Bank Oesterreich AG. Synthetic institution and data.",
  },
];

/* ==========================================================================
   Contract obligations
   ========================================================================== */

export const tprmOnboardingContractObligations: NewContractObligation[] = [
  {
    id: "COB-OB-2026-0087-01",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-OB-2026-0087",
    clauseReference: "Draft clause 4.1, audit and inspection rights",
    obligationText:
      "Arcadia, its internal audit function, its external auditors and competent supervisory authorities may audit and inspect the services on site, with 10 business days notice. Veridian provides a response within 5 business days.",
    category: "audit",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "CONDITION OUTSTANDING. Veridian has proposed replacing the on-site right with an annual third-party assurance report. Group Legal (P-016) has declined this substitution given the data processing scope. The clause is the primary open point in contract negotiation as at 06.10.2026.",
  },
  {
    id: "COB-OB-2026-0087-02",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-OB-2026-0087",
    clauseReference: "Draft clause 5.2, data residency",
    obligationText:
      "All processing of Arcadia payment data takes place within Germany and Austria. No Arcadia data is transferred to or processed in any other country without prior written consent.",
    category: "security",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: ["EVD-OB-0099-04"],
    note:
      "CONDITION OUTSTANDING. The supplier's SOC 2 report (EVD-OB-0099-04) references a backup location in the Netherlands. Veridian has not confirmed whether Arcadia data is included in that scope. Clarification requested on 28.09.2026, response outstanding as at 06.10.2026.",
  },
  {
    id: "COB-OB-2026-0087-03",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-OB-2026-0087",
    clauseReference: "Draft clause 6.1, subprocessor consent",
    obligationText:
      "Veridian obtains prior written consent from Arcadia before engaging any subprocessor with access to Arcadia data.",
    category: "subprocessor",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "CONDITION OUTSTANDING. The supplier has proposed a notice-and-objection model rather than prior consent. Group Legal has not accepted the change. Position remains open. The supplier's current subprocessor list was received on 12.09.2026 but has not been reviewed against the draft contract.",
  },
];

/* ==========================================================================
   Evidence documents
   ========================================================================== */

export const tprmOnboardingEvidenceDocuments: NewEvidenceDocument[] = [
  {
    id: "EVD-OB-0099-01",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-OB-0099-01",
    title: "Veridian Document Systems GmbH Vendor Information Questionnaire",
    titleDe: "Veridian Document Systems GmbH Lieferanteninformationsfragebogen",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia Procurement Portal",
    authorLabel: "Veridian Document Systems GmbH, Vendor Relations",
    authorUserId: null,
    documentDate: "2026-09-05",
    ingestedAt: "2026-09-08T09:14:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    pageCount: 18,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    relatedObjectIds: ["TP-0099", "PRQ-2026-0087"],
    summary:
      "Standard vendor questionnaire covering company registration, ownership structure, financial standing, key personnel, insurance, information security policies, business continuity posture and subprocessor list. Submitted 05.09.2026 via the Arcadia Procurement Portal. Reviewed by Stefan Brunner (P-002) on 08.09.2026. Responses are complete. Two follow-up questions raised on data residency and the identity of the backup infrastructure provider.",
    body: `ARCADIA BANK AG VENDOR INFORMATION QUESTIONNAIRE
PRQ-2026-0087

Supplier: Veridian Document Systems GmbH
Submission date: 05.09.2026
Reviewed by: Stefan Brunner (P-002), 08.09.2026

SECTION 1: COMPANY DETAILS

Legal name: Veridian Document Systems GmbH
Commercial register: HRB 211874 B, Amtsgericht Berlin-Charlottenburg
Registered address: Kurfuerstenstrasse 72, 10787 Berlin, Germany
Founded: 2019
Employees: approximately 120 (scenario figure)
Annual revenue: EUR 14.2m (scenario figure, last audited year 2025)
Shareholders: Veridian Technologies Holding Ltd (100%), registered in the Netherlands

SECTION 2: KEY PERSONNEL

Managing Directors: Dr. Petra Falkner, Jonas Rheinhardt
Data Protection Officer: Claudia Steineck, DPO@veridian-systems.example
Information Security Officer: Markus Luethi, CISO@veridian-systems.example

SECTION 3: INFORMATION SECURITY

Information security policy: ISO 27001 certified, certification body TUV Sueddeutschland, last audit 14.03.2026, valid to 31.03.2028.
Security incident response: Defined SLAs, 4-hour initial response for critical incidents, 24-hour written report.
Penetration testing: Annual third-party penetration test. Most recent test completed February 2026. Report available on request.
Access control: Role-based access control, multi-factor authentication for all staff with access to client data, quarterly access reviews.

SECTION 4: BUSINESS CONTINUITY

Business continuity policy: In place, last reviewed January 2026.
Recovery time objective: 4 hours for the platform, 2 hours for data ingestion services.
Recovery point objective: 1 hour.
Last BCM test: The last full business continuity test was conducted in November 2025. Summary available on request; full report can be shared under NDA.
Backup location: Germany primary, Netherlands backup (infrastructure operated by Veridian Technologies Holding Ltd).

SECTION 5: SUBPROCESSORS

The following subprocessors have access to client data:
1. Alpenkern Rechenzentrum GmbH, Berlin, Germany - primary data centre, processing and storage.
2. Nordlicht Connectivity GmbH, Hamburg, Germany - network and VPN infrastructure.

No other subprocessors have access to Arcadia data. Any change will be notified in accordance with the agreed contract terms.

SECTION 6: FINANCIAL STANDING

Audited accounts for the financial year ending 31.12.2025 are attached as Appendix A. The company holds no insolvency proceedings and no regulatory sanctions. EUR 2m liability insurance in place (policy details in Appendix B).

SECTION 7: REGULATORY AND COMPLIANCE

Data protection registration: Registered with the Berlin Commissioner for Data Protection and Freedom of Information.
No outstanding regulatory investigations or material litigation.`,
  },
  {
    id: "EVD-OB-0099-02",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-OB-0099-02",
    title: "Veridian Document Systems GmbH IT Security Assessment",
    titleDe: "Veridian Document Systems GmbH IT-Sicherheitspruefung",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia RiskCore",
    authorLabel: "Group Information Security, Arcadia Bank AG",
    authorUserId: null,
    documentDate: "2026-09-25",
    ingestedAt: "2026-09-26T11:30:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    pageCount: 7,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    relatedObjectIds: ["TP-0099", "CTR-OB-2026-0087"],
    summary:
      "IT Security specialist review of Veridian Document Systems GmbH. Assessment covers ISO 27001 certification, access control, vulnerability management, penetration testing posture and data encryption. Conclusion: APPROVED WITH CONDITIONS. Condition: full penetration test report must be received and reviewed before contract signature. The February 2026 executive summary provided is not sufficient for a service involving payment data. Issued by Group Information Security on 25.09.2026.",
    body: `ARCADIA BANK AG
GROUP INFORMATION SECURITY
THIRD-PARTY SPECIALIST REVIEW

Supplier: Veridian Document Systems GmbH (TP-0099)
Procurement reference: PRQ-2026-0087
Review date: 25.09.2026
Reviewer: Group IT Security (specialist function)
Classification: Confidential

SCOPE

This review assesses the information security posture of Veridian Document Systems GmbH in the context of their proposed cloud document processing and payment data reconciliation service for Arcadia Bank AG and Arcadia Bank Oesterreich AG.

1. CERTIFICATION

Veridian holds a current ISO 27001 certificate issued by TUV Sueddeutschland, valid to 31.03.2028. The certificate covers the Berlin facility and the cloud platform. Certification scope is appropriate for the proposed service.

2. ACCESS CONTROL

Multi-factor authentication is in place for all staff with access to client data. Access reviews are conducted quarterly. Role-based access control is documented and periodically tested. No significant findings in this area.

3. VULNERABILITY MANAGEMENT

Veridian operates a defined vulnerability management programme with 30-day remediation targets for critical findings. The vendor information questionnaire does not specify the CVSS threshold for critical classification. TPRM to seek confirmation.

4. PENETRATION TESTING

Annual third-party penetration test is performed. The most recent test was in February 2026. Only an executive summary has been provided. The summary states that no critical or high severity findings remained open at the time of testing. However, the summary does not confirm:
- The scope of the test (whether the payment data reconciliation interfaces were included)
- The identity of the testing provider
- The specific findings and remediation status

CONDITION: The full penetration test report must be received and reviewed before contract signature. An executive summary is not sufficient for a service that processes Arcadia payment confirmation data.

5. DATA ENCRYPTION

Data is encrypted in transit using TLS 1.3 and at rest using AES-256. Key management is handled by the primary data centre provider. Key rotation frequency not stated in the questionnaire.

6. CONCLUSION

APPROVED WITH ONE CONDITION.

Condition (mandatory before contract signature): Full penetration test report for the February 2026 assessment, including scope statement, finding list and remediation status, to be provided to Group IT Security for review.

Signed: Group Information Security, Arcadia Bank AG, 25.09.2026`,
  },
  {
    id: "EVD-OB-0099-03",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-OB-0099-03",
    title: "Veridian Document Systems GmbH Privacy Impact Assessment",
    titleDe: "Veridian Document Systems GmbH Datenschutzfolgenabschaetzung",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia RiskCore",
    authorLabel: "Group Data Protection Office, Arcadia Bank AG",
    authorUserId: null,
    documentDate: "2026-09-30",
    ingestedAt: "2026-10-01T08:55:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    relatedObjectIds: ["TP-0099", "CTR-OB-2026-0087"],
    summary:
      "Privacy impact assessment for the proposed Veridian Document Systems GmbH arrangement. Payment confirmation documents contain beneficiary names, payment references and IBAN data. Processing is limited to Germany and Austria subject to data residency confirmation. Assessment conclusion: APPROVED. Transfer basis for the arrangement does not require a third-country transfer mechanism, provided the Netherlands backup question is resolved. Issued by the Group Data Protection Office on 30.09.2026.",
    body: `ARCADIA BANK AG
GROUP DATA PROTECTION OFFICE
PRIVACY IMPACT ASSESSMENT

Supplier: Veridian Document Systems GmbH (TP-0099)
Procurement reference: PRQ-2026-0087
Assessment date: 30.09.2026
Assessor: Group Data Protection Office
Classification: Confidential

1. DATA PROCESSED

The service ingests incoming payment confirmation documents (SWIFT MT9xx and ISO 20022 camt.054 messages) and reconciles them against the Arcadia Payment Hub ledger. The documents contain:
- Beneficiary names and IBAN numbers
- Payment amounts and value dates
- Payment references and message identifiers

This constitutes personal data within the meaning of applicable data protection law for natural persons named as payees or payers.

2. LAWFUL BASIS

Processing is necessary for the performance of payment services contracts with corporate and institutional clients. The arrangement is a data processor arrangement under which Arcadia Bank AG acts as controller.

3. DATA LOCATION

The vendor questionnaire and the supplier's SOC 2 Type II report both indicate primary processing in Germany. A backup facility is described in the Netherlands. The service is being contracted for Germany and Austria only.

Open point: TPRM has requested confirmation from the supplier that no personal data is processed at the Netherlands backup location. If data is replicated there, a transfer basis documentation is required for the Dutch operation. This question was raised on 28.09.2026 and is outstanding as at 30.09.2026.

4. RETENTION

Payment confirmation data is retained in the supplier's system for 90 days before deletion. Arcadia holds the authoritative copy in the Payment Hub. The retention period is proportionate.

5. TRANSFER MECHANISM

Subject to resolution of the Netherlands point, no transfer to a third country outside the EEA is involved. No adequacy decision or standard contractual clauses are required for a purely intra-EEA arrangement.

6. CONCLUSION

APPROVED.

Condition noted: Confirmation of Netherlands processing scope from the supplier is required before final contract signature. If Dutch processing is confirmed, a transfer basis note is to be added to the data processing schedule.

Signed: Group Data Protection Office, Arcadia Bank AG, 30.09.2026`,
  },
  {
    id: "EVD-OB-0099-04",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-OB-0099-04",
    title: "Veridian Document Systems GmbH SOC 2 Type II Report 2025",
    titleDe: "Veridian Document Systems GmbH SOC 2 Type II Bericht 2025",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia Evidence Vault",
    authorLabel: "Veridian Document Systems GmbH, external auditor",
    authorUserId: null,
    documentDate: "2026-03-14",
    ingestedAt: "2026-09-20T14:10:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    pageCount: 42,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    relatedObjectIds: ["TP-0099"],
    summary:
      "SOC 2 Type II report covering the period 01.04.2025 to 31.03.2026, issued 14.03.2026. Opinion: unqualified. Controls covering security, availability and confidentiality are operating effectively. One exception noted for availability: a planned maintenance window in November 2025 exceeded the stated 4-hour window by 37 minutes. Management response confirmed the root cause was a database schema migration that required more time than estimated, and the deployment procedure was subsequently updated. No further exceptions in the period. Backup facility described as the Netherlands, infrastructure operated by Veridian Technologies Holding Ltd. Data residency scope for the backup facility is not described in this report.",
    body: `VERIDIAN DOCUMENT SYSTEMS GMBH
SOC 2 TYPE II REPORT
SECURITY, AVAILABILITY AND CONFIDENTIALITY CRITERIA
Reporting period: 01 April 2025 to 31 March 2026
Report date: 14 March 2026

INDEPENDENT PRACTITIONER'S REPORT

To the Management of Veridian Document Systems GmbH

We have examined the accompanying description of Veridian Document Systems GmbH's cloud document processing and data reconciliation platform (the System) and the suitability of the design and operating effectiveness of controls relevant to security, availability and confidentiality throughout the period from 01 April 2025 to 31 March 2026.

OPINION

In our opinion, in all material respects:
(a) the description fairly presents the System as designed and implemented throughout the period;
(b) the controls stated in the description were suitably designed; and
(c) the controls operated effectively throughout the specified period to provide reasonable assurance that the criteria would be met.

EXCEPTIONS

One exception was identified during the review period.

Exception AV-01: Planned maintenance window exceeded.
During the maintenance window on 09 November 2025, a database schema migration required 4 hours and 37 minutes, exceeding the stated maximum maintenance window of 4 hours by 37 minutes. Affected services: document ingestion and reconciliation dashboard. Impact: service unavailable beyond the notified window.

Management response: The deployment procedure has been updated to require a 30-minute pre-flight check and a staged deployment with automated rollback for schema changes estimated to take more than 2 hours.

No other exceptions were identified.

SYSTEM DESCRIPTION EXTRACT

Infrastructure: Primary data centre in Berlin, Germany, operated by Alpenkern Rechenzentrum GmbH. Backup and disaster recovery at a secondary facility in the Netherlands, operated by Veridian Technologies Holding Ltd. Failover is manual and requires 4 hours to complete.

Access: All production access requires multi-factor authentication. Privileged access is limited to 8 named administrators. Access is reviewed quarterly and changes are logged.

Encryption: Data encrypted in transit using TLS 1.3 and at rest using AES-256.`,
  },
  {
    id: "EVD-OB-0099-05",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-OB-0099-05",
    title: "Veridian Document Systems GmbH Penetration Test Report (REQUESTED, NOT RECEIVED)",
    titleDe: "Veridian Document Systems GmbH Penetrationstest-Bericht (ANGEFORDERT, NICHT EINGEGANGEN)",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia Procurement Portal",
    authorLabel: "Veridian Document Systems GmbH (requested)",
    authorUserId: null,
    documentDate: "2026-09-28",
    ingestedAt: "2026-09-28T16:45:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "requested",
    requestedFromLabel: "Veridian Document Systems GmbH, Markus Luethi (CISO)",
    requestedOn: "2026-09-28",
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    pageCount: 0,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    relatedObjectIds: ["TP-0099", "CTR-OB-2026-0087"],
    summary:
      "Full penetration test report for the February 2026 test, requested by Group IT Security (see EVD-OB-0099-02) on 28.09.2026. Supplier confirmed receipt of the request and stated a response would follow within 10 business days. As at 06.10.2026 the report has not been received. This is one of the two outstanding evidence items blocking the move from Stage 4 to Stage 5 Specialist Reviews conclusion. Condition: must be received and reviewed before contract signature.",
    body: `ARCADIA BANK AG - EVIDENCE REQUEST LOG

Request ID: REQ-OB-0099-01
Date requested: 28.09.2026
Requested by: Stefan Brunner (P-002), Group Third-Party Risk Management
Requested from: Markus Luethi, CISO, Veridian Document Systems GmbH

Item requested: Full penetration test report for the most recent external penetration test (February 2026), including scope statement, finding list with severity ratings, remediation status for each finding, and the identity of the testing provider.

Reason: The executive summary provided with the vendor questionnaire does not confirm whether the payment data reconciliation interfaces were in scope. Group IT Security requires the full report before it can complete its specialist review.

Supplier acknowledgement: Received 29.09.2026. Markus Luethi confirmed the request and stated a response would follow within 10 business days.

Status as at 06.10.2026: NOT RECEIVED. Expected by 09.10.2026. Chase message sent 06.10.2026 at 09:15 by Stefan Brunner.`,
  },
  {
    id: "EVD-OB-0099-06",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-OB-0099-06",
    title: "Veridian Document Systems GmbH Business Continuity Plan (REQUESTED, NOT RECEIVED)",
    titleDe: "Veridian Document Systems GmbH Business-Continuity-Plan (ANGEFORDERT, NICHT EINGEGANGEN)",
    sourceType: "bcm-test",
    sourceSystem: "Arcadia Procurement Portal",
    authorLabel: "Veridian Document Systems GmbH (requested)",
    authorUserId: null,
    documentDate: "2026-09-28",
    ingestedAt: "2026-09-28T16:50:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "requested",
    requestedFromLabel: "Veridian Document Systems GmbH, Vendor Relations",
    requestedOn: "2026-09-28",
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    pageCount: 0,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    relatedObjectIds: ["TP-0099", "CTR-OB-2026-0087"],
    summary:
      "Business continuity plan and November 2025 BCM test report, requested by TPRM on 28.09.2026. The vendor questionnaire states a BCM plan exists and that the last test was November 2025, but no evidence has been provided. As at 06.10.2026 the documents have not been received. This is one of the two outstanding evidence items blocking Stage 4 completion. The summary report is acceptable as an interim document; the full plan is required before Stage 7 governance approval.",
    body: `ARCADIA BANK AG - EVIDENCE REQUEST LOG

Request ID: REQ-OB-0099-02
Date requested: 28.09.2026
Requested by: Stefan Brunner (P-002), Group Third-Party Risk Management
Requested from: Vendor Relations, Veridian Document Systems GmbH

Items requested:
1. Current Business Continuity Plan for the cloud document processing and data reconciliation platform.
2. Summary test report for the November 2025 BCM exercise.

Reason: The vendor questionnaire confirms a BCM plan exists with an RTO of 4 hours and an RPO of 1 hour. TPRM requires evidence of the plan and the most recent test to assess the adequacy of continuity arrangements for a service that supports payment data processing.

Supplier acknowledgement: Not confirmed as at 06.10.2026. Initial request sent via the procurement portal on 28.09.2026. A follow-up was sent by email on 04.10.2026.

Status as at 06.10.2026: NOT RECEIVED. Chase message sent 04.10.2026. No response received.

Note: The full BCM plan is a Stage 7 requirement. A summary test report (equivalent to the SOC 2 exception note format) is acceptable to progress through Stage 4 and Stage 5, provided the full plan is received before governance approval.`,
  },
  {
    id: "EVD-OB-0099-07",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-OB-0099-07",
    title: "Veridian Document Systems GmbH Legal Review Status (PENDING)",
    titleDe: "Veridian Document Systems GmbH Rechtspruefung Status (AUSSTEHEND)",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia RiskCore",
    authorLabel: "Group Legal, Arcadia Bank AG",
    authorUserId: "P-016",
    documentDate: "2026-10-01",
    ingestedAt: "2026-10-01T10:20:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "draft",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    relatedObjectIds: ["TP-0099", "CTR-OB-2026-0087"],
    summary:
      "Legal review status note from Group Legal (P-016, Dr. Anja Weiss). The legal review of the contract draft CTR-OB-2026-0087 is pending. Group Legal has reviewed version 0.2 and provided redlines on 01.10.2026. The audit rights clause and the subprocessor consent model remain open. Version 0.3 was sent to the supplier on 03.10.2026 with Arcadia's redlines. Legal review is not complete; formal sign-off is expected by 20.10.2026 subject to supplier acceptance of the open clauses.",
    body: `ARCADIA BANK AG
GROUP LEGAL - THIRD-PARTY REVIEW STATUS NOTE

Supplier: Veridian Document Systems GmbH (TP-0099)
Contract reference: CTR-OB-2026-0087
Status note date: 01.10.2026
Reviewer: Dr. Anja Weiss, Outsourcing Counsel (P-016)

STATUS: LEGAL REVIEW PENDING

Group Legal reviewed contract draft v0.2 dated 22.09.2026 and returned redlines on 01.10.2026. Version 0.3 incorporating Arcadia's positions was sent to the supplier on 03.10.2026.

Open points as at 06.10.2026:
1. Clause 4.1 Audit and inspection rights: Arcadia proposes on-site inspection with 10 business days notice. Supplier counter-proposed substitution with annual SOC 2 report. Group Legal position is that on-site rights must be retained. Supplier response to v0.3 awaited.
2. Clause 6.1 Subprocessor consent: Arcadia proposes prior written consent. Supplier counter-proposed notice and objection (30 days). Group Legal position is that prior consent is required given the payment data scope. Supplier response to v0.3 awaited.
3. Clause 5.2 Data residency: Arcadia has included language requiring written consent for any processing outside Germany and Austria. Supplier has not yet accepted this clause pending internal review of the Netherlands backup scope.

Next steps: Supplier to respond to v0.3 by 13.10.2026. Group Legal will issue formal sign-off once open points are resolved. Estimated sign-off date: 20.10.2026.`,
  },
  {
    id: "EVD-OB-0099-08",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-OB-0099-08",
    title: "TPRM Onboarding Stage Gate Memo: Stage 4 Evidence Review (IN PROGRESS)",
    titleDe: "TPRM Onboarding Stufentor-Memo: Stufe 4 Nachweispruefung (IN BEARBEITUNG)",
    sourceType: "committee-extract",
    sourceSystem: "Arcadia RiskCore",
    authorLabel: "Stefan Brunner (P-002), Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-10-06",
    ingestedAt: "2026-10-06T07:45:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "internal",
    status: "draft",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
    relatedObjectIds: ["TP-0099", "CTR-OB-2026-0087"],
    summary:
      "TPRM internal stage gate memo for Stage 4 Evidence Review. Summarises the evidence position as at 06.10.2026: four items received and reviewed, two items outstanding (penetration test report and BCM plan). IT Security and Privacy specialist reviews are complete with one condition each. Legal review is pending. Proposal: progress the file to Stage 5 on the basis that the pending items are received by 09.10.2026, with a formal condition recorded on the file. If items are not received by 09.10.2026, Stage 4 gate will not be passed. Synthetic institution and data.",
    body: `ARCADIA BANK AG
GROUP THIRD-PARTY RISK MANAGEMENT
ONBOARDING STAGE GATE MEMO

Supplier: Veridian Document Systems GmbH (TP-0099)
Procurement reference: PRQ-2026-0087
Current stage: Stage 4 Nachweispruefung (Evidence Review)
Memo date: 06.10.2026
Author: Stefan Brunner (P-002)

EVIDENCE POSITION AS AT 06.10.2026

Items received and reviewed:
1. EVD-OB-0099-01 Vendor Information Questionnaire - ACCEPTED
2. EVD-OB-0099-02 IT Security Assessment - ACCEPTED WITH CONDITION (see below)
3. EVD-OB-0099-03 Privacy Impact Assessment - ACCEPTED
4. EVD-OB-0099-04 SOC 2 Type II Report 2025 - ACCEPTED

Items outstanding:
5. EVD-OB-0099-05 Full Penetration Test Report - NOT RECEIVED (requested 28.09.2026, expected 09.10.2026)
6. EVD-OB-0099-06 Business Continuity Plan and Test Report - NOT RECEIVED (requested 28.09.2026, chased 04.10.2026)

SPECIALIST REVIEWS

IT Security (EVD-OB-0099-02): APPROVED WITH CONDITION
Condition: Full penetration test report must be received and reviewed before contract signature.

Privacy (EVD-OB-0099-03): APPROVED
Note: Confirmation of Netherlands processing scope required before contract signature.

Legal (EVD-OB-0099-07): PENDING. Review of contract draft v0.3 in progress. Formal sign-off expected 20.10.2026.

CONTRACT STATUS

Draft v0.3 with Arcadia redlines sent to supplier 03.10.2026.
Three conditions outstanding: audit rights (clause 4.1), data residency (clause 5.2), subprocessor consent (clause 6.1).

STAGE GATE RECOMMENDATION

Conditional progression to Stage 5 is recommended, subject to:
(a) receipt and acceptance of the penetration test report by 09.10.2026, and
(b) receipt of BCM summary by 09.10.2026.

If items are not received by 09.10.2026, Stage 4 gate is not passed and the file remains at Stage 4.

The Legal review condition means Stage 6 cannot commence until 20.10.2026 at the earliest.

Synthetic institution and data.`,
  },
];
