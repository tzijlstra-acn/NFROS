/**
 * Seed data for the executable Third-Party Onboarding stages.
 *
 * The seeded Veridian file (TP-0099) is at Stage 4, with Stages 1 to 3
 * completed before the day began, so on its own it cannot show the first
 * three stages running. This module adds a second onboarding file that is at
 * Stage 1, so all eight stages can be executed from intake to the monitoring
 * handover, and it adds the specialist review huddles both files' Stage 5
 * reads.
 *
 *   Supplier:  TP-0104 Elbmarsch Dokumentenservice GmbH, Hamburg
 *   Request:   PRQ-2026-0104, the group correspondence provider that replaces
 *              TP-0071 Donaudruck (exit planned) for IBS-0009
 *   Run:       RUN-TPRM-ELBMARSCH-2026, at Stage 1 Request and Intake
 *   Service:   SVC-OB-0104-01
 *   Contract:  CTR-OB-2026-0104 (draft v0.2)
 *   Evidence:  EVD-OB-0104-01 to EVD-OB-0104-14
 *   Huddles:   MTG-TPRM-OB-0104-HUDDLE and MTG-TPRM-OB-0099-HUDDLE, held,
 *              with draft minutes awaiting confirmation
 *
 * Why the file is at Stage 1 while sourcing evidence already exists: the
 * request went through a sourcing evaluation (questionnaire, certificates,
 * an assurance report, specialist pre-reviews) before Third-Party Risk
 * Management received it. The first intake, on 08.09.2026, was returned on
 * 12.09.2026 because the legal entities in scope were incomplete; the
 * request was resubmitted on 05.10.2026. That is the ordinary shape of a
 * large sourcing exercise, and it is why Stage 3 has reusable evidence to
 * find.
 *
 * The run starts before the Veridian run, so the onboarding page still opens
 * on Veridian by default; the Elbmarsch file is one click away in the
 * onboarding pipeline above the stage map.
 *
 * `seedTprmOnboardingStages` writes everything inside the scenario
 * transaction, after `seedProcessRuntime`, and opens Stage 1 through the
 * engine's own `openStage` with the safe mode cache of its preparation, the
 * same way the engine seeds the other current stages.
 *
 * Synthetic institution and data. All figures are scenario figures.
 * Illustrative regulatory context, not legal advice.
 */

import { getDb } from "@/db/client";
import { contractObligations, contracts, services, suppliers } from "@/db/schema/domain";
import { evidenceChunks, evidenceDocuments, meetings } from "@/db/schema/work";
import { meetingMinutes, roleAppRuns } from "@/db/schema/role-app-runtime";
import { getRun } from "@/db/repositories/role-app-runtime";
import { getProcessDefinition, getRoleApp } from "@/role-apps/registry";
import { DEFAULT_RUN_ID, ENTITY_AT, ENTITY_CH, ENTITY_DE } from "@/scenario/data/contract";
import type {
  NewContract,
  NewContractObligation,
  NewEvidenceDocument,
  NewMeeting,
  NewService,
  NewSupplier,
} from "@/scenario/data/contract";
import type { NewMeetingMinutes, NewRun } from "@/db/repositories/role-app-runtime";
import "@/features/process/implementations";
import { buildStageContext } from "@/features/process/context";
import { captureSeededPreparation } from "@/features/process/preparation";
import { openStage } from "@/features/process/transition";

export const ELBMARSCH_RUN_ID = "RUN-TPRM-ELBMARSCH-2026";
export const ELBMARSCH_SUPPLIER_ID = "TP-0104";
const SERVICE_ID = "SVC-OB-0104-01";
const CONTRACT_ID = "CTR-OB-2026-0104";
const REQUEST_ID = "PRQ-2026-0104";
const STAGE_ONE_RUN_ID = "STAGERUN-TPRM-ELB-1";
const STAGE_ONE_OPENED = "2026-09-08T09:00:00.000Z";

/** When the safe mode preparation counts as captured: before the day starts. */
const CACHE_CAPTURED_AT = "2026-10-06T07:40:00.000Z";

/* ==========================================================================
   Supplier and service
   ========================================================================== */

export const elbmarschSuppliers: NewSupplier[] = [
  {
    id: ELBMARSCH_SUPPLIER_ID,
    runId: DEFAULT_RUN_ID,
    name: "Elbmarsch Dokumentenservice GmbH",
    legalForm: "Gesellschaft mit beschraenkter Haftung (GmbH)",
    domicile: "Hamburg, Germany",
    /** The business owner's proposal. Classification is decided at Stage 2. */
    criticality: "standard",
    isOutsourcing: false,
    /** The entities named in the request form. The scope note names a third. */
    contractingEntityIds: [ENTITY_DE, ENTITY_AT],
    /** A candidate in onboarding. Stage 7 activates it, or does not. */
    status: "onboarding",
    lastAssessmentDate: null,
    nextAssessmentDue: null,
    annualSpend: 1260000,
    spendCurrency: "EUR",
    relationshipOwnerUserId: "P-002",
    description:
      "Statement production, regulatory mailings and outbound client correspondence, proposed under PRQ-2026-0104 as the single group correspondence provider that replaces TP-0071 Donaudruck Dokumentenlogistik GmbH (exit planned, contract end 31.03.2027). Print and dispatch centre in Hamburg. Requested by Group Procurement (P-010 Lukas Wiesinger) for Group Retail Operations. Onboarding opened 08.09.2026; the intake was returned on 12.09.2026 and resubmitted on 05.10.2026. Synthetic institution and data.",
    concentrationNote:
      "New supplier with no existing footprint in the register. Replaces TP-0071 for IBS-0009, so the correspondence service stays on one provider rather than moving to two. Synthetic institution and data.",
  },
];

export const elbmarschServices: NewService[] = [
  {
    id: SERVICE_ID,
    runId: DEFAULT_RUN_ID,
    name: "Group statement production and client correspondence",
    nameDe: "Konzernweite Kontoauszugsproduktion und Kundenkorrespondenz",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT],
    ownerUserId: null,
    domain: "shared",
    description:
      "Print, enveloping and dispatch of account statements, regulatory mailings and outbound client letters for the group, with a secure print file transfer from the Arcadia output management platform. Supports IBS-0009 Statement Production and Client Correspondence. Not yet operational; onboarding in progress. Synthetic institution and data.",
    supplierIds: [ELBMARSCH_SUPPLIER_ID],
    operationalStatus: "normal",
  },
];

/* ==========================================================================
   Draft contract
   ========================================================================== */

export const elbmarschContracts: NewContract[] = [
  {
    id: CONTRACT_ID,
    runId: DEFAULT_RUN_ID,
    supplierId: ELBMARSCH_SUPPLIER_ID,
    entityId: ENTITY_DE,
    reference: CONTRACT_ID,
    title: "Print and Correspondence Services Agreement (Draft)",
    effectiveFrom: "2027-01-01",
    effectiveTo: "2030-12-31",
    documentType: "framework",
    noticePeriodDays: 180,
    auditRightsSecured: true,
    subprocessorConsentModel:
      "Notice and objection, 60 days. Group Legal has not yet confirmed whether prior consent is required for the Swiss scope.",
    summary:
      "Draft version 0.2 dated 01.10.2026, negotiated during the sourcing evaluation. Four-year term from 01.01.2027 with a 180-day notice period. Contracting entity Arcadia Bank AG with an accession schedule for Arcadia Bank Oesterreich AG; the accession of Arcadia Bank Schweiz AG is not yet drafted. Annual charge EUR 1,260,000 group-wide (scenario figure). Synthetic institution and data.",
  },
];

export const elbmarschContractObligations: NewContractObligation[] = [
  {
    id: "COB-OB-2026-0104-01",
    runId: DEFAULT_RUN_ID,
    contractId: CONTRACT_ID,
    clauseReference: "Draft clause 9.1, audit and inspection rights",
    obligationText:
      "Arcadia, its internal and external auditors and the competent supervisory authorities may audit and inspect the print and dispatch centre on site with 10 business days notice.",
    category: "audit",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note: "AGREED in draft v0.2 dated 01.10.2026.",
  },
  {
    id: "COB-OB-2026-0104-02",
    runId: DEFAULT_RUN_ID,
    contractId: CONTRACT_ID,
    clauseReference: "Draft clause 6.3, data location",
    obligationText: "All client correspondence data is processed and stored at the Hamburg print and dispatch centre.",
    category: "security",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: ["EVD-OB-0104-02"],
    note: "AGREED in draft v0.2. The clause does not yet address correspondence for Arcadia Bank Schweiz AG.",
  },
  {
    id: "COB-OB-2026-0104-03",
    runId: DEFAULT_RUN_ID,
    contractId: CONTRACT_ID,
    clauseReference: "Draft clause 11.2, subcontracting",
    obligationText: "Elbmarsch may engage a subcontractor after 60 days written notice; Arcadia may object within that period.",
    category: "subprocessor",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note: "CONDITION OUTSTANDING. Group Legal review of the notice and objection model is pending.",
  },
  {
    id: "COB-OB-2026-0104-04",
    runId: DEFAULT_RUN_ID,
    contractId: CONTRACT_ID,
    clauseReference: "Draft clause 14.4, termination assistance and exit",
    obligationText:
      "On termination Elbmarsch provides transition assistance for up to nine months and returns or deletes all client data, with written confirmation.",
    category: "exit",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note: "AGREED in draft v0.2.",
  },
  {
    id: "COB-OB-2026-0104-05",
    runId: DEFAULT_RUN_ID,
    contractId: CONTRACT_ID,
    clauseReference: "Draft clause 7.2, secure transfer of print files",
    obligationText: "Print files are transferred by SFTP with PGP encryption only. Transfer of print files by e-mail is excluded.",
    category: "security",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: ["EVD-OB-0104-11"],
    note: "AGREED in draft v0.2. Reflects the Group Information Security condition of 24.09.2026.",
  },
];

/* ==========================================================================
   Evidence: the request, the sourcing evidence and the specialist reviews
   ========================================================================== */

const BASE: Pick<
  NewEvidenceDocument,
  "runId" | "entityIds" | "dataClassification" | "requestedFromLabel" | "requestedOn" | "isStale" | "stalenessNote" | "fromSharedEvent" | "revealedAtMoment"
> = {
  runId: DEFAULT_RUN_ID,
  entityIds: [ENTITY_DE, ENTITY_AT],
  dataClassification: "confidential",
  requestedFromLabel: null,
  requestedOn: null,
  isStale: false,
  stalenessNote: "",
  fromSharedEvent: false,
  revealedAtMoment: "07:45",
};

function requested(input: {
  id: string;
  title: string;
  titleDe: string;
  sourceType?: string;
  requestedOn: string;
  expectedBy: string;
  from: string;
  summary: string;
  body: string;
}): NewEvidenceDocument {
  return {
    ...BASE,
    id: input.id,
    reference: input.id,
    title: input.title,
    titleDe: input.titleDe,
    sourceType: input.sourceType ?? "supplier-due-diligence",
    sourceSystem: "Arcadia Procurement Portal",
    authorLabel: "Elbmarsch Dokumentenservice GmbH (requested)",
    authorUserId: null,
    documentDate: input.requestedOn,
    ingestedAt: `${input.requestedOn}T16:00:00.000Z`,
    status: "requested",
    requestedFromLabel: input.from,
    requestedOn: input.requestedOn,
    provenance: "stakeholder-statement",
    pageCount: 0,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID, REQUEST_ID],
    summary: input.summary,
    body: `${input.body}\n\nExpected by ${input.expectedBy}.`,
  };
}

export const elbmarschEvidenceDocuments: NewEvidenceDocument[] = [
  {
    ...BASE,
    id: "EVD-OB-0104-01",
    reference: REQUEST_ID,
    title: "Procurement request PRQ-2026-0104: group correspondence provider (revision 2)",
    titleDe: "Beschaffungsantrag PRQ-2026-0104: Konzern-Korrespondenzdienstleister (Fassung 2)",
    sourceType: "procurement-request",
    sourceSystem: "Arcadia Procurement Portal",
    authorLabel: "Procurement portal, submitted by Lukas Wiesinger (P-010)",
    authorUserId: "P-010",
    documentDate: "2026-10-05",
    ingestedAt: "2026-10-05T15:20:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    dataClassification: "internal",
    status: "current",
    provenance: "stakeholder-statement",
    pageCount: 3,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID, REQUEST_ID, SERVICE_ID],
    summary:
      "Revision 2 of the procurement request for a single group correspondence provider, resubmitted by Group Procurement on 05.10.2026 after Third-Party Risk Management returned revision 1 on 12.09.2026. Candidate Elbmarsch Dokumentenservice GmbH replaces TP-0071 Donaudruck for IBS-0009. The form names ARC-DE and ARC-AT; the scope note adds ARC-CH from the second quarter of 2027.",
    body: `ARCADIA BANK AG
PROCUREMENT REQUEST: NEW THIRD-PARTY ARRANGEMENT

Request reference: PRQ-2026-0104
Revision: 2, resubmitted 05.10.2026. Revision 1 of 08.09.2026 was returned by Third-Party Risk Management on 12.09.2026 because the legal entities in scope were incomplete.
Requested by: Lukas Wiesinger (P-010), Group Procurement
Business owner: Head of Client Correspondence, Group Retail Operations
Supplier candidate: Elbmarsch Dokumentenservice GmbH, Hamburg
Commercial register: HRB 168402, Amtsgericht Hamburg
Service requested: Statement production, regulatory mailings and outbound client correspondence for the group
Replaces: TP-0071 Donaudruck Dokumentenlogistik GmbH, exit planned, contract end 31.03.2027
Supports: IBS-0009 Statement Production and Client Correspondence
Legal entities: ARC-DE, ARC-AT
Data categories: client name and postal address; account statements; regulatory notices
Planned start: 01.01.2027
Annual spend: EUR 1,260,000 (scenario figure)
Business owner proposal: not an outsourcing; standard criticality

SCOPE NOTE

The arrangement consolidates the group's printed client correspondence on one provider. Arcadia Bank Schweiz AG (ARC-CH) moves its in-house statement printing to the same provider from the second quarter of 2027, once the German and Austrian migration is complete.

SOURCING

Three providers were evaluated between July and September 2026. Elbmarsch was selected on 04.09.2026. The sourcing evaluation collected the vendor questionnaire, the ISO 27001 certificate, the 2025 ISAE 3402 Type II report, the financial statements and a business continuity test report, and asked Group Information Security and the Group Data Protection Office for a pre-review.

Synthetic institution and data.`,
  },
  {
    ...BASE,
    id: "EVD-OB-0104-02",
    reference: "EVD-OB-0104-02",
    title: "Elbmarsch Dokumentenservice GmbH Vendor Information Questionnaire",
    titleDe: "Elbmarsch Dokumentenservice GmbH Lieferanteninformationsfragebogen",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia Procurement Portal",
    authorLabel: "Elbmarsch Dokumentenservice GmbH, Vendor Management",
    authorUserId: null,
    documentDate: "2026-09-10",
    ingestedAt: "2026-09-12T10:05:00.000Z",
    status: "current",
    provenance: "stakeholder-statement",
    pageCount: 16,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID, REQUEST_ID],
    summary:
      "Standard vendor questionnaire submitted during the sourcing evaluation: company details, ownership, information security, business continuity, subprocessors and financial standing. One print and dispatch centre in Hamburg. Two subprocessors named.",
    body: `ARCADIA BANK AG VENDOR INFORMATION QUESTIONNAIRE
PRQ-2026-0104

Supplier: Elbmarsch Dokumentenservice GmbH
Submission date: 10.09.2026

SECTION 1: COMPANY DETAILS

Legal name: Elbmarsch Dokumentenservice GmbH
Commercial register: HRB 168402, Amtsgericht Hamburg
Registered address: Billstrasse 118, 20539 Hamburg, Germany
Founded: 2004
Employees: approximately 410 (scenario figure)

SECTION 2: SITES

Print and dispatch centre: Hamburg, Germany. No other production site.

SECTION 3: INFORMATION SECURITY

ISO 27001 certified, last surveillance audit February 2026. Print files are received through an SFTP gateway. Client data is deleted 90 days after dispatch.

SECTION 4: BUSINESS CONTINUITY

Business continuity plan in place. Last full business continuity test: November 2024. A second print line in the Hamburg building is the recovery arrangement.

SECTION 5: SUBPROCESSORS

The following subprocessors have access to client data:
1. Nordstern Rechenzentrum GmbH, Hamburg: hosting of the print file platform.
2. Hanse Logistik Zustelldienst GmbH, Hamburg: postal consolidation and handover to the postal operators.

No other subprocessor has access to Arcadia data.

SECTION 6: FINANCIAL STANDING

Audited accounts for 2025 are provided separately.`,
  },
  {
    ...BASE,
    id: "EVD-OB-0104-03",
    reference: "EVD-OB-0104-03",
    title: "Elbmarsch Dokumentenservice GmbH ISO 27001 Certificate",
    titleDe: "Elbmarsch Dokumentenservice GmbH ISO-27001-Zertifikat",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia Evidence Vault",
    authorLabel: "Elbmarsch Dokumentenservice GmbH, certification body",
    authorUserId: null,
    documentDate: "2026-02-10",
    ingestedAt: "2026-09-12T10:10:00.000Z",
    status: "current",
    provenance: "approved-record",
    pageCount: 2,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID],
    summary: "ISO 27001 certificate for the Hamburg print and dispatch centre and the print file platform, issued 10.02.2026, valid to 09.02.2029.",
    body: `CERTIFICATE ISO/IEC 27001

Organisation: Elbmarsch Dokumentenservice GmbH
Scope: Print, enveloping and dispatch services and the print file platform, Hamburg
Issued: 10.02.2026
Valid to: 09.02.2029`,
  },
  {
    ...BASE,
    id: "EVD-OB-0104-04",
    reference: "EVD-OB-0104-04",
    title: "Elbmarsch Dokumentenservice GmbH ISAE 3402 Type II Report 2025",
    titleDe: "Elbmarsch Dokumentenservice GmbH ISAE-3402-Typ-II-Bericht 2025",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia Evidence Vault",
    authorLabel: "Elbmarsch Dokumentenservice GmbH, external auditor",
    authorUserId: null,
    documentDate: "2026-03-20",
    ingestedAt: "2026-09-15T09:30:00.000Z",
    status: "current",
    provenance: "approved-record",
    pageCount: 38,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID],
    summary:
      "ISAE 3402 Type II report covering 01.01.2025 to 31.12.2025, issued 20.03.2026. Unqualified opinion. No exceptions. The system description names a disaster recovery provider for the print file platform.",
    body: `ELBMARSCH DOKUMENTENSERVICE GMBH
ISAE 3402 TYPE II REPORT
Reporting period: 01 January 2025 to 31 December 2025
Report date: 20 March 2026

OPINION

In our opinion, in all material respects, the controls described operated effectively throughout the period.

EXCEPTIONS

None.

SYSTEM DESCRIPTION EXTRACT

The print file platform is hosted in Hamburg by Nordstern Rechenzentrum GmbH. Disaster recovery for the print file platform is operated by Weserdata Backup GmbH in Bremen, with a recovery time objective of 24 hours. Postal consolidation is performed by Hanse Logistik Zustelldienst GmbH.`,
  },
  {
    ...BASE,
    id: "EVD-OB-0104-05",
    reference: "EVD-OB-0104-05",
    title: "Elbmarsch Dokumentenservice GmbH Business Continuity Test Report November 2024",
    titleDe: "Elbmarsch Dokumentenservice GmbH Bericht zum Notfalltest November 2024",
    sourceType: "bcm-test",
    sourceSystem: "Arcadia Procurement Portal",
    authorLabel: "Elbmarsch Dokumentenservice GmbH, Business Continuity",
    authorUserId: null,
    documentDate: "2024-11-18",
    ingestedAt: "2026-09-12T10:20:00.000Z",
    status: "current",
    isStale: true,
    stalenessNote: "Older than the twelve months the group third-party standard allows for business continuity evidence.",
    provenance: "stakeholder-statement",
    pageCount: 6,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID],
    summary:
      "Business continuity test of the Hamburg print lines, performed 18.11.2024. Recovery onto the second print line within 6 hours. The report is older than twelve months and does not cover the print file platform's disaster recovery site.",
    body: `BUSINESS CONTINUITY TEST REPORT

Test date: 18.11.2024
Scope: Failover from print line A to print line B, Hamburg
Result: Recovery within 6 hours. Statement dispatch resumed the same day.
Not in scope: Disaster recovery of the print file platform.`,
  },
  requested({
    id: "EVD-OB-0104-06",
    title: "Elbmarsch Dokumentenservice GmbH Exit and Transition Plan (REQUESTED, NOT RECEIVED)",
    titleDe: "Elbmarsch Dokumentenservice GmbH Ausstiegs- und Uebergangsplan (ANGEFORDERT, NICHT EINGEGANGEN)",
    requestedOn: "2026-09-15",
    expectedBy: "16.10.2026",
    from: "Elbmarsch Dokumentenservice GmbH, Vendor Management",
    summary: "Exit and transition plan for the correspondence service, requested during sourcing on 15.09.2026. Not received.",
    body: `EVIDENCE REQUEST LOG

Request ID: REQ-OB-0104-01
Date requested: 15.09.2026
Requested by: Group Procurement, on behalf of Third-Party Risk Management
Item requested: Exit and transition plan, including the return of print templates and the deletion of client data.
Status as at 06.10.2026: NOT RECEIVED.`,
  }),
  requested({
    id: "EVD-OB-0104-07",
    title: "Elbmarsch Dokumentenservice GmbH Data Location Statement for ARC-CH (REQUESTED, NOT RECEIVED)",
    titleDe: "Elbmarsch Dokumentenservice GmbH Datenstandorterklaerung fuer ARC-CH (ANGEFORDERT, NICHT EINGEGANGEN)",
    requestedOn: "2026-10-05",
    expectedBy: "20.10.2026",
    from: "Elbmarsch Dokumentenservice GmbH, Vendor Management",
    summary:
      "Statement of where correspondence for Arcadia Bank Schweiz AG would be processed, requested on 05.10.2026 when the request was resubmitted with ARC-CH in its scope note. Not received.",
    body: `EVIDENCE REQUEST LOG

Request ID: REQ-OB-0104-02
Date requested: 05.10.2026
Requested by: Group Procurement, on behalf of Third-Party Risk Management
Item requested: Data location statement for correspondence of Arcadia Bank Schweiz AG, naming the site and any transfer outside Switzerland.
Status as at 06.10.2026: NOT RECEIVED.`,
  }),
  {
    ...BASE,
    id: "EVD-OB-0104-08",
    reference: "EVD-OB-0104-08",
    title: "Elbmarsch Dokumentenservice GmbH Audited Financial Statements 2025",
    titleDe: "Elbmarsch Dokumentenservice GmbH Gepruefter Jahresabschluss 2025",
    sourceType: "supplier-due-diligence",
    sourceSystem: "Arcadia Procurement Portal",
    authorLabel: "Elbmarsch Dokumentenservice GmbH, Finance",
    authorUserId: null,
    documentDate: "2026-04-30",
    ingestedAt: "2026-09-12T10:25:00.000Z",
    status: "current",
    provenance: "approved-record",
    pageCount: 24,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID],
    summary: "Audited financial statements for 2025 with an unqualified audit opinion. Revenue EUR 61.4m (scenario figure). No going concern note.",
    body: `ELBMARSCH DOKUMENTENSERVICE GMBH
FINANCIAL STATEMENTS 2025

Audit opinion: unqualified.
Revenue: EUR 61.4m (scenario figure).
Going concern: no material uncertainty reported.`,
  },
  requested({
    id: "EVD-OB-0104-09",
    title: "Elbmarsch Dokumentenservice GmbH Penetration Test Summary (REQUESTED, NOT RECEIVED)",
    titleDe: "Elbmarsch Dokumentenservice GmbH Zusammenfassung Penetrationstest (ANGEFORDERT, NICHT EINGEGANGEN)",
    requestedOn: "2026-09-12",
    expectedBy: "13.10.2026",
    from: "Elbmarsch Dokumentenservice GmbH, Information Security",
    summary: "Summary of the most recent external penetration test of the SFTP gateway and the print file platform, requested during sourcing. Not received.",
    body: `EVIDENCE REQUEST LOG

Request ID: REQ-OB-0104-03
Date requested: 12.09.2026
Requested by: Group Procurement, on behalf of Group Information Security
Item requested: Summary of the most recent external penetration test of the SFTP gateway and the print file platform, with its scope statement.
Status as at 06.10.2026: NOT RECEIVED.`,
  }),
  requested({
    id: "EVD-OB-0104-10",
    title: "Elbmarsch Dokumentenservice GmbH Payment Data Handling Questionnaire (REQUESTED, NOT RECEIVED)",
    titleDe: "Elbmarsch Dokumentenservice GmbH Fragebogen zur Verarbeitung von Zahlungsdaten (ANGEFORDERT, NICHT EINGEGANGEN)",
    requestedOn: "2026-09-08",
    expectedBy: "30.09.2026",
    from: "Elbmarsch Dokumentenservice GmbH, Vendor Management",
    summary:
      "Payment data handling questionnaire, raised automatically by the procurement portal's standard request pack on 08.09.2026. Not received; the supplier asked whether it applies to a print and dispatch service.",
    body: `EVIDENCE REQUEST LOG

Request ID: REQ-OB-0104-04
Date requested: 08.09.2026
Requested by: Arcadia Procurement Portal, standard request pack
Item requested: Payment data handling questionnaire, covering payment instructions, payment initiation and card data.
Supplier response: Asked on 15.09.2026 whether the questionnaire applies, since the service prints statements and executes no payments.
Status as at 06.10.2026: NOT RECEIVED.`,
  }),

  /* ---- Specialist reviews, from the sourcing evaluation and since ---- */
  {
    ...BASE,
    id: "EVD-OB-0104-11",
    reference: "EVD-OB-0104-11",
    title: "Elbmarsch Dokumentenservice GmbH Information Security Pre-Review",
    titleDe: "Elbmarsch Dokumentenservice GmbH Vorpruefung Informationssicherheit",
    sourceType: "specialist-review",
    sourceSystem: "Arcadia RiskCore",
    authorLabel: "Group Information Security, Arcadia Bank AG",
    authorUserId: null,
    documentDate: "2026-09-24",
    ingestedAt: "2026-09-24T15:00:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    status: "current",
    provenance: "approved-record",
    pageCount: 4,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID, REQUEST_ID],
    summary:
      "Group Information Security pre-review of the print file transfer, the print file platform and the Hamburg centre. Conclusion: APPROVED WITH CONDITION. Print files by SFTP with PGP encryption only. The Hamburg print and dispatch centre is approved for correspondence of all three entities.",
    body: `ARCADIA BANK AG
GROUP INFORMATION SECURITY
THIRD-PARTY SPECIALIST REVIEW

Supplier: Elbmarsch Dokumentenservice GmbH (TP-0104)
Procurement reference: PRQ-2026-0104
Review date: 24.09.2026

FINDINGS

ISO 27001 certificate current. ISAE 3402 Type II report 2025 without exceptions. The SFTP gateway accepts unencrypted files when a sender does not use PGP.

CONDITION: Print files are transferred by SFTP with PGP encryption only; transfer of print files by e-mail is not permitted.

CONCLUSION

APPROVED WITH CONDITION. The Hamburg print and dispatch centre is approved for correspondence of all three entities.

Signed: Group Information Security, Arcadia Bank AG, 24.09.2026`,
  },
  {
    ...BASE,
    id: "EVD-OB-0104-12",
    reference: "EVD-OB-0104-12",
    title: "Elbmarsch Dokumentenservice GmbH Data Protection Pre-Review",
    titleDe: "Elbmarsch Dokumentenservice GmbH Vorpruefung Datenschutz",
    sourceType: "specialist-review",
    sourceSystem: "Arcadia RiskCore",
    authorLabel: "Group Data Protection Office, Arcadia Bank AG",
    authorUserId: null,
    documentDate: "2026-09-29",
    ingestedAt: "2026-09-29T11:40:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    status: "current",
    provenance: "approved-record",
    pageCount: 5,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID, REQUEST_ID],
    summary:
      "Group Data Protection Office pre-review. Correspondence contains client names, postal addresses, account numbers and transaction details. Conclusion: APPROVED WITH CONDITION for the Swiss scope.",
    body: `ARCADIA BANK AG
GROUP DATA PROTECTION OFFICE
PRIVACY PRE-REVIEW

Supplier: Elbmarsch Dokumentenservice GmbH (TP-0104)
Procurement reference: PRQ-2026-0104
Review date: 29.09.2026

DATA PROCESSED

Client names and postal addresses, account numbers (IBAN), account balances and transaction details on statements, and the content of regulatory notices.

CONDITION: Correspondence for Arcadia Bank Schweiz AG is processed in Switzerland, or a documented transfer basis is in place before ARC-CH joins the arrangement.

CONCLUSION

APPROVED WITH CONDITION. The German and Austrian scope is approved as drafted.

Signed: Group Data Protection Office, Arcadia Bank AG, 29.09.2026`,
  },
  {
    ...BASE,
    id: "EVD-OB-0104-13",
    reference: "EVD-OB-0104-13",
    title: "Elbmarsch Dokumentenservice GmbH Legal Review Status (PENDING)",
    titleDe: "Elbmarsch Dokumentenservice GmbH Status der Rechtspruefung (AUSSTEHEND)",
    sourceType: "specialist-review",
    sourceSystem: "Arcadia RiskCore",
    authorLabel: "Group Legal, Arcadia Bank AG",
    authorUserId: "P-016",
    documentDate: "2026-10-02",
    ingestedAt: "2026-10-02T09:15:00.000Z",
    dataClassification: "internal",
    status: "draft",
    provenance: "stakeholder-statement",
    pageCount: 1,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID, CONTRACT_ID],
    summary:
      "Group Legal status note on draft v0.2 of CTR-OB-2026-0104. Review pending; the subcontracting clause and the accession of ARC-CH are open. Formal sign-off expected by 23.10.2026.",
    body: `ARCADIA BANK AG
GROUP LEGAL: THIRD-PARTY REVIEW STATUS NOTE

Supplier: Elbmarsch Dokumentenservice GmbH (TP-0104)
Contract reference: CTR-OB-2026-0104
Status note date: 02.10.2026
Reviewer: Dr. Anja Weiss, Outsourcing Counsel (P-016)

STATUS: LEGAL REVIEW PENDING

Open points:
1. Clause 11.2 subcontracting: notice and objection is proposed; prior consent may be needed for the Swiss scope.
2. The accession schedule for Arcadia Bank Schweiz AG is not drafted.

Estimated sign-off date: 23.10.2026`,
  },
  {
    ...BASE,
    id: "EVD-OB-0104-14",
    reference: "EVD-OB-0104-14",
    title: "Elbmarsch Dokumentenservice GmbH Compliance Review for ARC-CH",
    titleDe: "Elbmarsch Dokumentenservice GmbH Compliance-Pruefung fuer ARC-CH",
    sourceType: "specialist-review",
    sourceSystem: "Arcadia RiskCore",
    authorLabel: "Group Compliance, Arcadia Bank Schweiz AG",
    authorUserId: null,
    documentDate: "2026-10-02",
    ingestedAt: "2026-10-02T14:30:00.000Z",
    entityIds: [ENTITY_CH],
    status: "current",
    provenance: "approved-record",
    pageCount: 2,
    relatedObjectIds: [ELBMARSCH_SUPPLIER_ID, REQUEST_ID],
    summary:
      "Compliance review of the Swiss scope note. Conclusion: APPROVED WITH CONDITION. Before ARC-CH joins, the arrangement is assessed under the FINMA outsourcing framework and recorded in the ARC-CH inventory of outsourced functions. Illustrative regulatory context, not legal advice.",
    body: `ARCADIA BANK SCHWEIZ AG
COMPLIANCE
THIRD-PARTY SPECIALIST REVIEW

Supplier: Elbmarsch Dokumentenservice GmbH (TP-0104)
Review date: 02.10.2026

CONDITION: Before ARC-CH joins, the arrangement is assessed as an outsourcing under the FINMA outsourcing framework and recorded in the ARC-CH inventory of outsourced functions.

CONCLUSION

APPROVED WITH CONDITION for the Swiss scope. The EU entities are outside this review.

Illustrative regulatory context, not legal advice.

Signed: Compliance, Arcadia Bank Schweiz AG, 02.10.2026`,
  },
];

/* ==========================================================================
   Specialist review huddles, with their draft minutes
   ========================================================================== */

export const huddleMeetings: NewMeeting[] = [
  {
    id: "MTG-TPRM-OB-0104-HUDDLE",
    runId: DEFAULT_RUN_ID,
    roleId: "tprm",
    reference: "TPRM-SR-TP-0104-20261002",
    title: "Specialist review huddle: Elbmarsch correspondence consolidation",
    titleDe: "Abstimmung mit Fachspezialisten: Elbmarsch Korrespondenzkonsolidierung",
    kind: "one-to-one",
    momentLabel: "07:45",
    scheduledFor: "2026-10-02T15:00:00.000Z",
    participantUserIds: ["P-002", "P-016", "P-010"],
    objective:
      "Consolidate the specialist pre-reviews from the sourcing evaluation into one set of conditions, and agree who resolves the Swiss data location question before ARC-CH joins.",
    preparationSummary:
      "Group Information Security approved with one condition (encrypted print file transfer). The Group Data Protection Office approved with a condition for the Swiss scope. Group Legal is pending. Compliance for ARC-CH approved with a condition.",
    evidenceDocumentIds: ["EVD-OB-0104-11", "EVD-OB-0104-12", "EVD-OB-0104-13", "EVD-OB-0104-14"],
    preparedQuestions: [
      "Group Information Security approved the Hamburg centre for all three entities; the Data Protection Office requires Swiss processing for ARC-CH. Which position does the contract follow?",
      "Is a documented transfer basis achievable before the second quarter of 2027, or does ARC-CH need a Swiss site?",
    ],
    status: "concluded",
    outcome:
      "Positions read out by each function. The Swiss data location question is not resolved: Group Information Security and the Group Data Protection Office hold different positions. Group Legal to confirm the subcontracting model by 23.10.2026.",
    concludedAt: "2026-10-02T15:45:00.000Z",
    supportsVoice: false,
    subjectKind: "supplier",
    subjectId: ELBMARSCH_SUPPLIER_ID,
    heldByUserId: "P-002",
    heldAt: "2026-10-02T15:45:00.000Z",
    processRunId: ELBMARSCH_RUN_ID,
    stageId: "specialist-reviews",
  },
  {
    id: "MTG-TPRM-OB-0099-HUDDLE",
    runId: DEFAULT_RUN_ID,
    roleId: "tprm",
    reference: "TPRM-SR-TP-0099-20261005",
    title: "Specialist review huddle: Veridian conditions",
    titleDe: "Abstimmung mit Fachspezialisten: Bedingungen Veridian",
    kind: "one-to-one",
    momentLabel: "07:45",
    scheduledFor: "2026-10-05T15:00:00.000Z",
    participantUserIds: ["P-002", "P-016"],
    objective:
      "Take each specialist function's position on Veridian Document Systems GmbH and the conditions it sets, before the file reaches the contract stage.",
    preparationSummary:
      "Group IT Security approved with one condition (full penetration test report before contract signature). The Group Data Protection Office approved, noting the Netherlands backup question. Group Legal is pending on contract draft v0.3.",
    evidenceDocumentIds: ["EVD-OB-0099-02", "EVD-OB-0099-03", "EVD-OB-0099-07"],
    preparedQuestions: [
      "Does the Netherlands backup question belong to the Privacy condition or to the data residency clause, and who owns closing it?",
    ],
    status: "concluded",
    outcome:
      "IT Security and Privacy confirmed their written positions. Legal confirmed that sign-off depends on the supplier's response to v0.3, expected by 13.10.2026.",
    concludedAt: "2026-10-05T15:40:00.000Z",
    supportsVoice: false,
    subjectKind: "supplier",
    subjectId: "TP-0099",
    heldByUserId: "P-002",
    heldAt: "2026-10-05T15:40:00.000Z",
    processRunId: "RUN-TPRM-VERIDIAN-2026",
    stageId: "specialist-reviews",
  },
];

export const huddleMinutes: NewMeetingMinutes[] = [
  {
    id: "MINUTES-TPRM-OB-0104-HUDDLE",
    runId: DEFAULT_RUN_ID,
    meetingId: "MTG-TPRM-OB-0104-HUDDLE",
    roleId: "tprm",
    title: "Specialist review huddle: Elbmarsch correspondence consolidation",
    summary:
      "Stefan Brunner took each specialist position on Elbmarsch Dokumentenservice GmbH (TP-0104). Group Information Security approved with an encrypted transfer condition and approved the Hamburg centre for all three entities. The Group Data Protection Office requires Swiss processing or a documented transfer basis before ARC-CH joins. Group Legal is pending. Draft minutes awaiting confirmation by Stefan Brunner.",
    factItems: [
      "Group Information Security: approved with condition, SFTP with PGP only (EVD-OB-0104-11)",
      "Group Data Protection Office: approved with condition for the Swiss scope (EVD-OB-0104-12)",
      "Group Legal: pending, sign-off expected 23.10.2026 (EVD-OB-0104-13)",
      "Compliance ARC-CH: approved with condition (EVD-OB-0104-14)",
    ],
    decisionIds: [],
    actionIds: [],
    unresolvedItems: ["Swiss data location: Hamburg for all entities, or Swiss processing for ARC-CH"],
    evidenceIds: ["EVD-OB-0104-11", "EVD-OB-0104-12", "EVD-OB-0104-13", "EVD-OB-0104-14"],
    participantUserIds: ["P-002", "P-016", "P-010"],
    status: "draft",
    preparedBy: "ai",
    confirmedByUserId: null,
    confirmedAt: null,
    distributedAt: null,
    createdAt: "2026-10-02T16:00:00.000Z",
  },
  {
    id: "MINUTES-TPRM-OB-0099-HUDDLE",
    runId: DEFAULT_RUN_ID,
    meetingId: "MTG-TPRM-OB-0099-HUDDLE",
    roleId: "tprm",
    title: "Specialist review huddle: Veridian conditions",
    summary:
      "Stefan Brunner took the specialist positions on Veridian Document Systems GmbH (TP-0099). IT Security holds its condition on the full penetration test report. Privacy approved and noted the Netherlands backup question. Legal sign-off depends on the supplier's response to draft v0.3. Draft minutes awaiting confirmation by Stefan Brunner.",
    factItems: [
      "Group IT Security: approved with condition, full penetration test report before contract signature (EVD-OB-0099-02)",
      "Group Data Protection Office: approved, Netherlands processing scope to be confirmed (EVD-OB-0099-03)",
      "Group Legal: pending, supplier response to v0.3 expected 13.10.2026 (EVD-OB-0099-07)",
    ],
    decisionIds: [],
    actionIds: [],
    unresolvedItems: ["Netherlands backup scope confirmation from the supplier"],
    evidenceIds: ["EVD-OB-0099-02", "EVD-OB-0099-03", "EVD-OB-0099-07"],
    participantUserIds: ["P-002", "P-016"],
    status: "draft",
    preparedBy: "ai",
    confirmedByUserId: null,
    confirmedAt: null,
    distributedAt: null,
    createdAt: "2026-10-05T16:00:00.000Z",
  },
];

/* ==========================================================================
   The run
   ========================================================================== */

export const elbmarschRun: NewRun = {
  id: ELBMARSCH_RUN_ID,
  runId: DEFAULT_RUN_ID,
  roleAppId: "tprm-third-party-onboarding",
  roleId: "tprm",
  subjectKind: "supplier",
  subjectId: ELBMARSCH_SUPPLIER_ID,
  currentStageId: "request-and-intake",
  status: "in-progress",
  mode: "offline",
  startedAt: STAGE_ONE_OPENED,
  updatedAt: "2026-10-05T15:20:00.000Z",
  completedAt: null,
  blockedReason: null,
};

/* ==========================================================================
   Writing it
   ========================================================================== */

/**
 * Paragraph-aware retrieval chunks for the documents above, in the format
 * the scenario seed writes for every other document, so search and the
 * evidence drawer treat these documents like the rest of the corpus.
 */
function chunksFor(doc: NewEvidenceDocument, runId: string): Array<typeof evidenceChunks.$inferInsert> {
  const paragraphs = doc.body.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length > 0);
  const chunks: Array<typeof evidenceChunks.$inferInsert> = [];
  let buffer: string[] = [];
  let length = 0;
  const flush = (): void => {
    if (buffer.length === 0) return;
    const content = buffer.join("\n\n");
    const index = chunks.length;
    chunks.push({
      id: `${doc.id}-C${String(index).padStart(2, "0")}`,
      runId,
      documentId: doc.id,
      chunkIndex: index,
      locator: `Section ${index + 1}`,
      content,
      embedding: null,
      embeddingModel: null,
      embeddedAt: null,
      tokenEstimate: Math.ceil(content.length / 4),
    });
    buffer = [];
    length = 0;
  };
  for (const paragraph of paragraphs) {
    if (length > 0 && length + paragraph.length > 900) flush();
    buffer.push(paragraph);
    length += paragraph.length;
  }
  flush();
  return chunks;
}

/**
 * Writes the second onboarding file and the huddles, then opens its Stage 1
 * through the engine and captures the safe mode preparation. Runs inside the
 * seed transaction, after `seedProcessRuntime`. Returns the rows written.
 */
export function seedTprmOnboardingStages(runId: string = DEFAULT_RUN_ID): number {
  const db = getDb();
  const withRun = <T extends { runId?: string }>(rows: readonly T[]): T[] => rows.map((row) => ({ ...row, runId }));
  let written = 0;

  const insert = (table: Parameters<typeof db.insert>[0], rows: readonly Record<string, unknown>[]): void => {
    if (rows.length === 0) return;
    db.insert(table).values(rows as never).run();
    written += rows.length;
  };

  insert(suppliers, withRun(elbmarschSuppliers));
  insert(services, withRun(elbmarschServices));
  insert(contracts, withRun(elbmarschContracts));
  insert(contractObligations, withRun(elbmarschContractObligations));
  insert(evidenceDocuments, withRun(elbmarschEvidenceDocuments));
  insert(evidenceChunks, elbmarschEvidenceDocuments.flatMap((doc) => chunksFor(doc, runId)));
  insert(meetings, withRun(huddleMeetings));
  insert(meetingMinutes, withRun(huddleMinutes));
  insert(roleAppRuns, [{ ...elbmarschRun, runId }]);

  /* Stage 1, opened by the engine with its tasks and queued preparation. */
  const run = getRun(ELBMARSCH_RUN_ID, runId);
  const app = run ? getRoleApp(run.roleAppId) : undefined;
  const process = app ? getProcessDefinition(app.processId) : undefined;
  const stage = process?.stages.find((candidate) => candidate.id === "request-and-intake");
  if (!run || !stage) return written;

  const opened = openStage({
    runId,
    run,
    stage,
    atMoment: "09:00",
    seed: { stageRunId: STAGE_ONE_RUN_ID, openedAt: STAGE_ONE_OPENED },
  });
  written += 1 + stage.humanTasks.length + stage.decisions.length + stage.aiJobs.length + (opened.jobId ? 1 : 0);

  if (stage.implementation.implemented) {
    captureSeededPreparation(buildStageContext({ processRunId: run.id, stageId: stage.id, runId }), CACHE_CAPTURED_AT);
    written += 1;
  }
  return written;
}
