/**
 * Third-party and resilience spine: suppliers, subprocessors and fourth
 * parties, services, dependency edges, impact tolerances, contracts and
 * contractual obligations.
 *
 * Authoritative source: docs/SCENARIO_BIBLE.md sections 5 (Corporate
 * Payments), 5.3 (impact tolerances), 6.1 (systems), 7.1 to 7.4 (Novalink)
 * and 1 (identifier convention). Where this module and the bible disagree,
 * the bible wins and this module is fixed.
 *
 * Two things this module exists to make queryable.
 *
 * 1. The Novalink concentration. One supplier provides the system that
 *    validates payments, the system that repairs and overrides them, and the
 *    only route ARC-CH holds into Swiss clearing. That single structural fact
 *    is why the 14:05 degradation reaches validation, repair and Swiss
 *    clearing at the same moment.
 * 2. The evidence position as it actually stands on the morning of
 *    06.10.2026, not as the supplier file would prefer it to read. Several
 *    obligations are recorded as not evidenced or partially met because that
 *    is the truth, and the four resilience questions in bible section 7.4 are
 *    open for a reason.
 *
 * Conventions used here. Dates are stored as ISO calendar dates; the bible
 * writes them DD.MM.YYYY and display surfaces convert back. Contractual
 * obligations hang off the framework agreement CTR-2023-0117 even where the
 * clause sits in an appendix, because the appendices are part of the
 * agreement; the appendix and clause are carried in clauseReference. Every
 * service carries operationalStatus "normal" at seed time: the 14:05 event is
 * applied by the scenario engine at runtime and is never baked into the seed.
 * Dependency edge identifiers are sequential within this module, because the
 * bible assigns identifier types to objects and not to the edges between them.
 *
 * Synthetic institution and data. Illustrative regulatory context, not legal
 * advice.
 */

import {
  DEFAULT_RUN_ID,
  ENTITY_AT,
  ENTITY_CH,
  ENTITY_DE,
  type NewContract,
  type NewContractObligation,
  type NewImpactTolerance,
  type NewService,
  type NewServiceDependency,
  type NewSubprocessor,
  type NewSupplier,
} from "./contract";

/* ==========================================================================
   Suppliers / Drittparteien
   ========================================================================== */

export const suppliers: NewSupplier[] = [
  /*
   * The deepest record in the register and the only one under reassessment on
   * the scenario day. Note the three ownership seats: commercial, risk and
   * business. Every escalation on 06.10.2026 has to travel through all three,
   * which is a large part of why nothing moves quickly.
   */
  {
    id: "TP-0042",
    runId: DEFAULT_RUN_ID,
    name: "Novalink Payment Services GmbH",
    legalForm: "Gesellschaft mit beschraenkter Haftung (GmbH)",
    domicile: "Frankfurt am Main, Germany",
    criticality: "critical",
    isOutsourcing: true,
    contractingEntityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    status: "under-reassessment",
    lastAssessmentDate: "2025-10-31",
    nextAssessmentDue: "2026-10-31",
    annualSpend: 6850000,
    spendCurrency: "EUR",
    relationshipOwnerUserId: "P-002",
    description:
      "Payment processing software and managed clearing connectivity for European banks. Commercial register HRB 98431, founded 2011, approximately 850 employees (scenario figure). Contracted since 01.09.2023 under CTR-2023-0117, a German law master agreement signed by Arcadia Bank AG with accession schedules for the Austrian and Swiss entities. Provides five services to the group, three of which sit inside IBS-0004 Corporate Payments. Rated Tier 1 of 4 on the Arcadia internal criticality scale. Ownership is split three ways: P-010 Lukas Wiesinger holds the commercial relationship in Group Procurement, P-002 Stefan Brunner holds the risk relationship, P-007 Andreas Kellner is the business owner. The 2026 annual reassessment opened on 15.09.2026 and is not complete: 198 of 214 questionnaire responses received, 33 of 41 requested evidence artefacts received and 26 accepted, four resilience questions unresolved.",
    concentrationNote:
      "Sole provider of payment validation (SYS-0012 NOVA-GATE), payment repair and override tooling (SYS-0014 RepairDesk) and Swiss clearing connectivity (SYS-0015 euroSIC Adapter). The supplier that validates payments also supplies the tool used to repair and override them, and also supplies the only route ARC-CH holds into SIC and euroSIC. Substitutability last assessed 30.06.2025: substitutable in 12 to 18 months with material programme cost, no test ever performed. ARC-DE and ARC-AT can fall back to the in-house SYS-0013 Arcadia Direct Link for clearing submission, at the cost of losing all payment data validation. ARC-CH has no fallback route at all, because it holds no direct SIC participant link; its only alternative is manual submission through a correspondent bank with a 45 minute preparation lead time.",
  },
  /*
   * Screening sits outside PRC-0041 by design: a screening hold is not a
   * repair item, and this supplier was untouched on 06.10.2026. It earns its
   * critical rating on breadth rather than on incident history.
   */
  {
    id: "TP-0015",
    runId: DEFAULT_RUN_ID,
    name: "Sentinel Screening Solutions Ltd",
    legalForm: "Private limited company (Ltd)",
    domicile: "London, United Kingdom",
    criticality: "critical",
    isOutsourcing: true,
    contractingEntityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    status: "active",
    lastAssessmentDate: "2026-03-27",
    nextAssessmentDue: "2027-03-31",
    annualSpend: 2380000,
    spendCurrency: "EUR",
    relationshipOwnerUserId: "P-002",
    description:
      "Sanctions, politically exposed person and adverse media screening platform behind SYS-0016. Screens every outbound payment instruction and every client onboarding and periodic review case across the group, on one platform with a separate tenant per legal entity. Screening holds are worked by Group Compliance and are not payment repair items, which is why this supplier sits outside process PRC-0041 and was not affected by the 06.10.2026 degradation. Contracted under CTR-2024-0233. The arrangement involves a transfer of personal data to a provider domiciled outside the European Economic Area and outside Switzerland; a documented transfer basis is held per entity and reviewed annually by Group Legal. Illustrative regulatory context, not legal advice.",
    concentrationNote:
      "Serves all three entities and four business services (IBS-0002, IBS-0003, IBS-0004 and IBS-0007) from a single platform. After Novalink this is the widest blast radius in the register: a screening outage stops payment release and client onboarding at the same time in Germany, Austria and Switzerland. Hosting sits with TP-0015.2 Basalt Cloud Infrastructure B.V., which also hosts the group GRC platform supplied by TP-0007 under an unrelated contract.",
  },
  /*
   * The uncomfortable one. The system of record for non-financial risk is
   * also the system used to manage an incident while it is happening, and the
   * contract gives Arcadia no direct audit right over the layer that holds
   * Arcadia records.
   */
  {
    id: "TP-0007",
    runId: DEFAULT_RUN_ID,
    name: "Kestrel Governance Cloud SE",
    legalForm: "Societas Europaea (SE)",
    domicile: "Utrecht, Netherlands",
    criticality: "important",
    isOutsourcing: true,
    contractingEntityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    status: "active",
    lastAssessmentDate: "2026-06-12",
    nextAssessmentDue: "2027-06-30",
    annualSpend: 1740000,
    spendCurrency: "EUR",
    relationshipOwnerUserId: "P-002",
    description:
      "Provider of SYS-0031 Arcadia RiskCore, the group governance, risk and compliance platform, with entity partitioning. Holds the risks, controls, control tests, findings, Massnahmen, RCSAs, third-party records and incident records for all three legal entities. Contracted under CTR-2025-0044. Audit and access rights are not secured as a direct right: the contract substitutes an annual third-party assurance report which covers the hosting and platform layers and stops short of the application layer where Arcadia records are held. That gap is open and is the reason this supplier is rated important rather than standard, despite holding no client money and no payment instruction data.",
    concentrationNote:
      "Two group-wide platforms, this one and the screening platform at TP-0015, are hosted by the same infrastructure provider, Basalt Cloud Infrastructure B.V., recorded as TP-0007.1 and TP-0015.2 under two unrelated contracts. No single supplier assessment sees both, because each assessment stops at its own supplier boundary. Worth stating plainly: on 06.10.2026 every state change recorded against INC-2026-0412 was written into a third-party platform while the incident was live.",
  },
  /*
   * The only Swiss law contract in the critical population. Its audit, data
   * location and supervisory access clauses are drafted differently from the
   * rest of the register and cannot be assessed against the EU checklist.
   */
  {
    id: "TP-0023",
    runId: DEFAULT_RUN_ID,
    name: "Alpenrand Rechenzentrum AG",
    legalForm: "Aktiengesellschaft (AG)",
    domicile: "Zug, Switzerland",
    criticality: "critical",
    isOutsourcing: true,
    contractingEntityIds: [ENTITY_CH],
    status: "active",
    lastAssessmentDate: "2026-02-06",
    nextAssessmentDue: "2027-01-31",
    annualSpend: 4120000,
    spendCurrency: "CHF",
    relationshipOwnerUserId: "P-002",
    description:
      "Data centre operations and core banking application hosting for Arcadia Bank Schweiz AG. Contracted by ARC-CH under CTR-2022-0081, governed by Swiss law, with client identifying data required to remain in Switzerland and with audit and supervisory access drafted for FINMA. Supports IBS-0010 Swiss Core Banking Platform Operations and, through it, the Swiss legs of retail servicing and corporate payments. P-015 Sibylle Graf is the local resilience counterpart, and the Swiss recovery position she holds rests in part on this supplier's arrangements as well as on Novalink's. Illustrative regulatory context, not legal advice.",
    concentrationNote:
      "Sole data centre for the Swiss core banking platform. Substitution would be a platform migration rather than a supplier swap. ARC-CH therefore carries two suppliers with no practical substitute, this one and TP-0042, against the same significant business process, and it is the only entity in the group in that position.",
  },
  {
    id: "TP-0058",
    runId: DEFAULT_RUN_ID,
    name: "Nordwind Kundendialog GmbH",
    legalForm: "Gesellschaft mit beschraenkter Haftung (GmbH)",
    domicile: "Leipzig, Germany",
    criticality: "important",
    isOutsourcing: true,
    contractingEntityIds: [ENTITY_DE, ENTITY_AT],
    status: "active",
    lastAssessmentDate: "2026-05-15",
    nextAssessmentDue: "2027-05-31",
    annualSpend: 3260000,
    spendCurrency: "EUR",
    relationshipOwnerUserId: "P-002",
    description:
      "Outsourced retail contact centre for Arcadia Bank AG and Arcadia Bank Oesterreich AG: inbound account servicing, card blocking, dispute intake and first line digital banking support. Approximately 340 agent seats at one delivery site in Leipzig (scenario figure), with the German and Austrian queues worked by separate agent groups on the same platform. Agents hold read access to account and transaction data and can execute a card block, which is a client affecting action taken by a third-party employee. That is why the arrangement is rated important rather than standard.",
    concentrationNote:
      "Two entities served from one delivery site, with no second contact centre supplier and in-house overflow capacity of roughly 60 seats (scenario figure). A site event degrades retail servicing in Germany and Austria simultaneously. The exposure is recorded, accepted and reviewed annually; no alternative site has been contracted.",
  },
  /*
   * Low criticality, high usefulness. This is the only exit in the register
   * being executed rather than documented, which makes it the reference case
   * when the untested Novalink exit plan is challenged.
   */
  {
    id: "TP-0071",
    runId: DEFAULT_RUN_ID,
    name: "Donaudruck Dokumentenlogistik GmbH",
    legalForm: "Gesellschaft mit beschraenkter Haftung (GmbH)",
    domicile: "Linz, Austria",
    criticality: "standard",
    isOutsourcing: true,
    contractingEntityIds: [ENTITY_AT, ENTITY_DE],
    status: "exit-planned",
    lastAssessmentDate: "2025-11-21",
    nextAssessmentDue: "2026-11-30",
    annualSpend: 890000,
    spendCurrency: "EUR",
    relationshipOwnerUserId: "P-002",
    description:
      "Statement production, regulatory mailings and outbound client correspondence for the German and Austrian entities, supporting IBS-0009. Notice of termination for convenience was served on 30.06.2026 with contract end 31.03.2027, as part of a group consolidation onto a single correspondence provider. The Austrian population has migrated; the German population transfers in two waves in February and March 2027. Personal data is processed but no payment instruction is executed, which is why the arrangement is rated standard.",
    concentrationNote:
      "The only live exit in the register, and worth keeping visible for that reason: when the Novalink exit plan is challenged for never having been tested, this is the one relationship where Arcadia can show what an executed exit actually costs in elapsed time and effort.",
  },
  /*
   * Not an outsourcing, and recorded as such. Held in the register anyway,
   * because contractor access to production payment systems is a control
   * question whether or not the arrangement is an outsourcing.
   */
  {
    id: "TP-0093",
    runId: DEFAULT_RUN_ID,
    name: "Ostkurve Personaldienste GmbH",
    legalForm: "Gesellschaft mit beschraenkter Haftung (GmbH)",
    domicile: "Munich, Germany",
    criticality: "standard",
    isOutsourcing: false,
    contractingEntityIds: [ENTITY_DE],
    status: "active",
    lastAssessmentDate: "2026-01-30",
    nextAssessmentDue: "2027-01-31",
    annualSpend: 1150000,
    spendCurrency: "EUR",
    relationshipOwnerUserId: "P-002",
    description:
      "Contingent engineering and test capacity for ARC-DE Technology, including work on the Arcadia Payment Hub and the Arcadia Direct Link. Not a regulated outsourcing: Arcadia directs the work, defines the deliverable, retains the function and keeps the output inside Arcadia systems. Recorded in the third-party register regardless, because contractor accounts hold non-production access and, under change freeze exceptions, production read access to SYS-0011 and SYS-0013. Joiner, mover and leaver evidence for those accounts is requested quarterly.",
  },
];

/* ==========================================================================
   Subprocessors and fourth parties / Unterauftragnehmer und Viertparteien
   ========================================================================== */

export const subprocessors: NewSubprocessor[] = [
  {
    id: "TP-0042.1",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    name: "Helvetia CloudWorks AG",
    domicile: "Zurich, Switzerland",
    dataLocation: "Switzerland only. Outside the European Economic Area.",
    functionProvided:
      "Infrastructure hosting for the RepairDesk Swiss instance and for the euroSIC adapter. This is the only Novalink hosting footprint that keeps Swiss payment data inside Switzerland.",
    declaredIn: "both",
    supportsCriticalFunction: true,
    discrepancyNote:
      "Correctly listed in binding Appendix A3 v4.2 and correctly notified on 14.02.2025. The problem with this subprocessor is not disclosure, it is evidence: TPRM-Q-2026-R04 is open because the RepairDesk disaster recovery test report of 22.05.2026 covers the Frankfurt and Amsterdam regions only and says nothing about the instance hosted here.",
  },
  /*
   * The appendix mismatch that the supplier itself disclosed while explaining
   * the incident. P-012 named the Amsterdam region at 14:55; the binding
   * appendix lists Frankfurt only. Recording the divergence on the Rheinstack
   * row, not on a separate row, because there is one subprocessor and one
   * undisclosed region.
   */
  {
    id: "TP-0042.2",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    name: "Rheinstack GmbH",
    domicile: "Cologne, Germany",
    dataLocation:
      "European Economic Area. Frankfurt primary region, Amsterdam secondary region.",
    functionProvided:
      "Managed database, backup and regional failover for NOVA-GATE and RepairDesk. Operates the database cluster whose loss of quorum at 13:31 on 06.10.2026 started INC-2026-0412.",
    declaredIn: "both",
    isDiscrepancy: true,
    discrepancyNote:
      "Listed in binding Appendix A3 v4.2 with the Frankfurt region only. The Novalink Subprocessor Register v6.1 of 03.08.2026 lists Frankfurt and Amsterdam. Arcadia holds no notice for the Amsterdam region. The divergence surfaced through the supplier's own root cause statement at 14:55 on 06.10.2026, when P-012 Ralf Ostermann said Amsterdam had taken the traffic. P-002 noted it at 14:57 and raised it formally at 15:23 under MSN-2026-0221. Secondary point, separate from the region question: the storage firmware update that triggered the quorum loss was applied in a maintenance window Novalink had not notified.",
    supportsCriticalFunction: true,
  },
  {
    id: "TP-0042.3",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    name: "Polaris Telemetrix s.r.o.",
    domicile: "Brno, Czech Republic",
    dataLocation: "European Economic Area. Brno, with archive at a fourth party in Dublin.",
    functionProvided:
      "Application monitoring, log aggregation, alerting and incident detection for all Novalink services. Arcadia should read that scope carefully: the supplier's ability to notice its own incidents sits with this subprocessor.",
    declaredIn: "both",
    supportsCriticalFunction: true,
    discrepancyNote:
      "Correctly listed and correctly notified on 14.02.2025, so there is no disclosure gap here. There is a concentration finding instead. On 06.10.2026 this subprocessor's monitoring stayed pinned to the failed Frankfurt database endpoint until 14:57 because the connection string was statically configured rather than using the failover alias, which produced a 34 minute gap between the 13:31 quorum loss and the 14:05 notification. MSN-2026-0218 assesses whether Novalink incident detection has a single point of failure here.",
  },
  /*
   * The undisclosed one. A third country subprocessor with read access to
   * beneficiary names and reference fields, onboarded five months before
   * anyone at Arcadia heard of it. Three questions in one row: contractual
   * notice, subprocessing for the EU entities, data access and offshoring for
   * ARC-CH.
   */
  {
    id: "TP-0042.4",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    name: "Meridian Operations Support Pvt Ltd",
    domicile: "Pune, India",
    dataLocation:
      "India. Outside the European Economic Area and outside Switzerland. Read access to payment metadata including beneficiary name and reference fields.",
    functionProvided:
      "Level 1 service desk and out-of-hours monitoring handover for NOVA-GATE and RepairDesk.",
    declaredIn: "supplier-submission",
    isDiscrepancy: true,
    discrepancyNote:
      "Absent from binding Appendix A3 v4.2 entirely. Appears in the Novalink Subprocessor Register v6.1 of 03.08.2026, onboarded by Novalink on 01.05.2026. Arcadia's contract repository contains no notice. Appendix A3 clause 3.4 requires 60 days prior written notice of any addition. Novalink's position, given by P-011 Miriam Falk at 15:31 on 06.10.2026, is that the register was published on its client portal and that portal publication constitutes notice; Appendix A3 does not say that. This is a live contractual dispute and must be presented as one, not as a settled breach. Raised as MSN-2026-0221 with P-016 Group Legal and P-010 Procurement.",
    supportsCriticalFunction: true,
  },
  /*
   * Fourth party. declaredIn is "neither" on purpose: Aurora is in no contract
   * document and in no supplier submission, because Appendix A3 as drafted
   * does not reach the subprocessors' own subcontractors. That is a drafting
   * gap, not a breach, and the product must say so in those words.
   */
  {
    id: "TP-0042.3-F1",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    name: "Aurora Object Storage Ltd",
    domicile: "Dublin, Ireland",
    dataLocation:
      "European Economic Area. Dublin. Archived logs contain payment reference metadata, retained 24 months.",
    functionProvided:
      "Long-term log and telemetry archive for TP-0042.3 Polaris Telemetrix, engaged by the subprocessor rather than by Novalink.",
    declaredIn: "neither",
    isDiscrepancy: true,
    discrepancyNote:
      "Not listed in Appendix A3 v4.2 and not listed in the Novalink Subprocessor Register v6.1. Appendix A3 clause 3.4 obliges notice of subprocessor changes and is silent on the subprocessors' own subcontractors, so the contract has no fourth-party provision to breach. Arcadia therefore has a party holding payment reference metadata for 24 months with no contractual visibility, notice right or objection right. Characterise this as a drafting gap to be closed by variation under MSN-2026-0221, not as supplier non-compliance.",
    supportsCriticalFunction: true,
  },
  {
    id: "TP-0015.1",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0015",
    name: "Foxglove Sanctions Data Services Ltd",
    domicile: "Dublin, Ireland",
    dataLocation:
      "European Economic Area. Dublin. Reference list data only; no Arcadia client or payment data.",
    functionProvided:
      "Curation and daily delivery of sanctions, politically exposed person and adverse media list data into the screening platform. A delivery failure produces stale lists rather than an outage, which is the harder failure mode to detect.",
    declaredIn: "both",
    supportsCriticalFunction: true,
  },
  {
    id: "TP-0015.2",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0015",
    name: "Basalt Cloud Infrastructure B.V.",
    domicile: "Amsterdam, Netherlands",
    dataLocation:
      "European Economic Area. Amsterdam primary, Dublin secondary. Holds screening payloads including payer and payee names.",
    functionProvided:
      "Infrastructure hosting, storage and regional failover for the screening platform tenants of all three Arcadia entities.",
    declaredIn: "both",
    supportsCriticalFunction: true,
    discrepancyNote:
      "No disclosure issue. The finding is that the same provider appears again as TP-0007.1 under the unrelated Kestrel contract, so two group-wide critical platforms rest on one infrastructure provider. Neither supplier assessment currently reports that, because each stops at its own supplier boundary.",
  },
  {
    id: "TP-0015.2-F1",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0015",
    name: "Nordholt Datacenter Services B.V.",
    domicile: "Groningen, Netherlands",
    dataLocation: "European Economic Area. Groningen. Physical facility only; no logical data access.",
    functionProvided:
      "Colocation, power and physical security for the Basalt Cloud Amsterdam region. Fourth party under TP-0015.2.",
    declaredIn: "supplier-submission",
    supportsCriticalFunction: false,
  },
  {
    id: "TP-0007.1",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0007",
    name: "Basalt Cloud Infrastructure B.V.",
    domicile: "Amsterdam, Netherlands",
    dataLocation:
      "European Economic Area. Amsterdam primary, Frankfurt secondary. Holds the Arcadia RiskCore database and evidence index.",
    functionProvided:
      "Infrastructure hosting, storage, backup and regional failover for the Arcadia RiskCore tenant that carries all three entity partitions.",
    declaredIn: "both",
    supportsCriticalFunction: false,
    discrepancyNote:
      "Correctly disclosed. Recorded here mainly so that the constellation shows what a single supplier view hides: this is the same legal entity as TP-0015.2, reached through a different contract. If it fails, the group loses its screening platform and its system of record for non-financial risk in the same event.",
  },
];

/* ==========================================================================
   Services

   Two populations in one table. IBS-nnnn rows are Arcadia business services,
   of which four carry the important business service designation. SVC-0042-nn
   rows are the services Novalink provides, per bible section 7.1.
   ========================================================================== */

export const services: NewService[] = [
  {
    id: "IBS-0001",
    runId: DEFAULT_RUN_ID,
    name: "Retail Account Servicing and Digital Banking",
    nameDe: "Privatkunden-Kontofuehrung und Digitalbanking",
    isImportantBusinessService: true,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    domain: "retail",
    description:
      "Account access, balance and transaction enquiry, standing order and direct debit maintenance, and servicing of retail current and savings accounts through the mobile application, online banking and the contact centre. Designated an important business service at group level because a sustained loss removes the ability of retail clients to see or move their own money.",
    supplierIds: ["TP-0058", "TP-0071"],
    operationalStatus: "normal",
  },
  {
    id: "IBS-0002",
    runId: DEFAULT_RUN_ID,
    name: "Retail Card Payments and ATM Access",
    nameDe: "Kartenzahlungen und Geldautomatenzugang Privatkunden",
    isImportantBusinessService: true,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    domain: "retail",
    description:
      "Authorisation of debit and credit card transactions at the point of sale and online, cash withdrawal at own and third-party automated teller machines, and card blocking and replacement. Designated an important business service: it is the group service with the shortest tolerable outage, because a declined card is immediate and public.",
    supplierIds: ["TP-0058", "TP-0015"],
    operationalStatus: "normal",
  },
  {
    id: "IBS-0003",
    runId: DEFAULT_RUN_ID,
    name: "Corporate Lending Drawdown and Servicing",
    nameDe: "Firmenkundenkredit: Auszahlung und Bestandsfuehrung",
    isImportantBusinessService: true,
    entityIds: [ENTITY_DE, ENTITY_AT],
    domain: "corporate",
    description:
      "Execution of committed facility drawdowns, rollovers, interest and fee settlement, and covenant and collateral administration for corporate and institutional borrowers. Designated an important business service because a failed drawdown on a committed facility is a contractual failure by the bank rather than an inconvenience to the client.",
    supplierIds: ["TP-0015"],
    operationalStatus: "normal",
  },
  /*
   * The service the whole scenario day turns on. Three of its five supplier
   * side dependencies come from one supplier, and the fourth entity level
   * dependency, Swiss clearing, has no substitute at all.
   */
  {
    id: "IBS-0004",
    runId: DEFAULT_RUN_ID,
    name: "Corporate Payments",
    nameDe: "Firmenkundenzahlungsverkehr",
    isImportantBusinessService: true,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    domain: "payments",
    description:
      "End-to-end execution of outbound payment instructions submitted by corporate and institutional clients, from instruction receipt to clearing submission and confirmation. Covers SEPA credit transfers, SEPA instant credit transfers, high value EUR payments, cross-border non-EUR payments, CHF domestic payments over SIC and euroSIC, and bulk file payments. Designated an important business service at group level; a critical or important function for ARC-DE and ARC-AT and a significant business process for ARC-CH. Service owner P-007 Andreas Kellner, executive owner P-014 Dr. Heinrich Adler, resilience owner P-005 Nadia Lehmann with P-015 Sibylle Graf for ARC-CH. Illustrative regulatory context, not legal advice.",
    supplierIds: ["TP-0042", "TP-0015"],
    operationalStatus: "normal",
  },
  {
    id: "IBS-0005",
    runId: DEFAULT_RUN_ID,
    name: "Client Onboarding and Static Data Maintenance",
    nameDe: "Kundenanlage und Stammdatenpflege",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    domain: "corporate",
    description:
      "Client take-on, periodic review, mandate capture and maintenance of account, beneficiary and signatory static data in SYS-0017 Client Static Data Master. Not designated an important business service, because a short outage delays onboarding rather than interrupting service to existing clients. It is nonetheless the authoritative reference against which repaired payment instructions are checked, which is how the post-event sample of 20 overrides was validated on 06.10.2026.",
    supplierIds: ["TP-0015", "TP-0058"],
    operationalStatus: "normal",
  },
  {
    id: "IBS-0006",
    runId: DEFAULT_RUN_ID,
    name: "Treasury and Liquidity Management",
    nameDe: "Treasury und Liquiditaetssteuerung",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    domain: "corporate",
    description:
      "Intraday liquidity monitoring, cash and collateral positioning at central banks and correspondents, and funding execution for the three entities. Operated entirely on in-house systems with no third-party dependency, which makes it the useful control case in the dependency map: it shows what a service with no supplier exposure looks like next to services that have a great deal.",
    supplierIds: [],
    operationalStatus: "normal",
  },
  {
    id: "IBS-0007",
    runId: DEFAULT_RUN_ID,
    name: "Financial Crime Screening and Sanctions Compliance",
    nameDe: "Sanktions- und Finanzkriminalitaetspruefung",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    domain: "shared",
    description:
      "Screening of payment instructions, clients and counterparties against sanctions, politically exposed person and adverse media data, with hold management, alert disposition and regulatory reporting handled by Group Compliance. Not itself designated an important business service, because it is a control layer inside other services rather than a service delivered to clients, but a loss here stops payment release and client onboarding at the same time. Illustrative regulatory context, not legal advice.",
    supplierIds: ["TP-0015"],
    operationalStatus: "normal",
  },
  {
    id: "IBS-0008",
    runId: DEFAULT_RUN_ID,
    name: "Non-Financial Risk Management and Governance Reporting",
    nameDe: "Steuerung nicht-finanzieller Risiken und Gremienberichterstattung",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-001",
    domain: "shared",
    description:
      "The group non-financial risk operating service: risk and control registers, control testing, RCSA cycles, Massnahmen tracking, third-party assessment, incident management and committee reporting, across all three entity partitions. Runs on SYS-0031 Arcadia RiskCore with evidence held in SYS-0032 Arcadia Evidence Vault. Not a client facing service, and it is in this register for a reason that matters on 06.10.2026: it is the service used to manage an incident, so a loss of it would take away the group's ability to record what it is doing while it is doing it.",
    supplierIds: ["TP-0007"],
    operationalStatus: "normal",
  },
  {
    id: "IBS-0009",
    runId: DEFAULT_RUN_ID,
    name: "Statement Production and Client Correspondence",
    nameDe: "Kontoauszugsproduktion und Kundenkorrespondenz",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT],
    domain: "shared",
    description:
      "Production, printing and despatch of account statements, contractual notices and regulatory mailings, in paper and in the secure document inbox. Delay is recoverable and the service carries no intraday deadline, which is why it is not designated important. It is currently mid-exit to a consolidated group provider.",
    supplierIds: ["TP-0071"],
    operationalStatus: "normal",
  },
  {
    id: "IBS-0010",
    runId: DEFAULT_RUN_ID,
    name: "Swiss Core Banking Platform Operations",
    nameDe: "Betrieb der Kernbankplattform Schweiz",
    isImportantBusinessService: false,
    entityIds: [ENTITY_CH],
    domain: "technology",
    description:
      "Hosting, operation, patching and recovery of the core banking platform for Arcadia Bank Schweiz AG, including the account ledger, the client master and the Swiss payment ledger. A technology service rather than a business service, but every ARC-CH business service sits on top of it, which is why its loss and the loss of TP-0042 are the two Swiss scenarios with no practical substitute.",
    supplierIds: ["TP-0023"],
    operationalStatus: "normal",
  },
  {
    id: "SVC-0042-01",
    runId: DEFAULT_RUN_ID,
    name: "Payment validation and clearing gateway (NOVA-GATE)",
    nameDe: "Zahlungsvalidierung und Clearing-Gateway",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT],
    domain: "payments",
    description:
      "Format validation, enrichment and clearing connectivity for T2, RT1 and TIPS, delivered through SYS-0012. Classified as an ICT service supporting a critical or important function and as a material outsourcing (wesentliche Auslagerung) for the EU entities. Contracted availability is 99.7% monthly excluding planned maintenance (scenario figure). The enrichment function is the part that matters when the fallback route is used: SYS-0013 Arcadia Direct Link performs no payment data validation, so instructions this service would have corrected arrive at the repair queue instead. Illustrative regulatory context, not legal advice.",
    supplierIds: ["TP-0042"],
    operationalStatus: "normal",
  },
  {
    id: "SVC-0042-02",
    runId: DEFAULT_RUN_ID,
    name: "Payment Repair Workbench (RepairDesk)",
    nameDe: "Arbeitsplatz Zahlungsreparatur",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    domain: "payments",
    description:
      "The repair queue, override creation, four-eyes enforcement and override audit log for process PRC-0041, delivered through SYS-0014. Classified as an ICT service supporting a critical or important function and a material outsourcing for the EU entities, and a significant outsourcing for ARC-CH. This is the service that carries rule RD-RULE-0031 in tenant arcadia-prod, which is where the control CTL-PAY-014 is actually enforced or not enforced. Illustrative regulatory context, not legal advice.",
    supplierIds: ["TP-0042"],
    operationalStatus: "normal",
  },
  {
    id: "SVC-0042-03",
    runId: DEFAULT_RUN_ID,
    name: "Payment file transformation and format library maintenance",
    nameDe: "Zahlungsdateitransformation und Pflege der Formatbibliothek",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    domain: "technology",
    description:
      "Transformation of client payment files between formats and maintenance of the ISO 20022 and legacy format library used by the hub and the gateway. Currently classified as an ICT service that does not support a critical or important function, and not significant for ARC-CH. That classification is the open question of the day: a format library failure would stop PT-06 bulk file payments outright, which P-002 reaches from the third-party side and P-006 reaches from the regulatory side on 06.10.2026. Illustrative regulatory context, not legal advice.",
    supplierIds: ["TP-0042"],
    operationalStatus: "normal",
  },
  {
    id: "SVC-0042-04",
    runId: DEFAULT_RUN_ID,
    name: "Hosted payment reconciliation and exception reporting",
    nameDe: "Gehostete Zahlungsabstimmung und Ausnahmeberichterstattung",
    isImportantBusinessService: false,
    entityIds: [ENTITY_DE, ENTITY_AT],
    domain: "shared",
    description:
      "Daily reconciliation of submitted against cleared payments, break identification and exception reporting into the finance close. Classified as an ICT service supporting a critical or important function for the EU entities. Supports IBS-0004 and the finance close; a short loss is absorbed by deferring the reconciliation rather than by stopping payments. Illustrative regulatory context, not legal advice.",
    supplierIds: ["TP-0042"],
    operationalStatus: "normal",
  },
  /*
   * The service with the hard deadline. ARC-CH holds no direct SIC
   * participant link, so there is no technical fallback behind this one, only
   * a 45 minute manual correspondent route under RB-PAY-011.
   */
  {
    id: "SVC-0042-05",
    runId: DEFAULT_RUN_ID,
    name: "Swiss clearing connectivity adapter, SIC and euroSIC",
    nameDe: "Adapter Schweizer Clearing-Anbindung, SIC und euroSIC",
    isImportantBusinessService: false,
    entityIds: [ENTITY_CH],
    domain: "payments",
    description:
      "SIC and euroSIC submission for Arcadia Bank Schweiz AG, delivered through SYS-0015. Classified as a significant outsourcing (wesentliche Auslagerung) for ARC-CH; the EU classifications do not apply to this entity. The only Swiss clearing route the entity holds: there is no direct SIC participant link and therefore no technical fallback, and the alternative is manual submission through a correspondent bank under runbook RB-PAY-011 with a 45 minute preparation lead time. Illustrative regulatory context, not legal advice.",
    supplierIds: ["TP-0042"],
    operationalStatus: "normal",
  },
];

/* ==========================================================================
   Service dependency edges

   Directed, from dependent to dependency. singlePointOfFailure means no
   substitutable alternative is available today, not that the dependency is
   fragile. affectedByEvent is set only where the bible's account of the 14:05
   degradation actually reaches the edge; it is deliberately false on edges
   that a reader might assume were involved and were not.
   ========================================================================== */

export const serviceDependencies: NewServiceDependency[] = [
  {
    id: "DEP-0001",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "supplier",
    toId: "TP-0042",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "Three of the systems in the payment repair process come from this one supplier. Substitutability assessed at 12 to 18 months on 30.06.2025 and never tested, so for any operational timeframe this is a single point of failure.",
  },
  {
    id: "DEP-0002",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "service",
    toId: "SVC-0042-01",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "Primary clearing route for SEPA, instant and high value EUR payments. The in-house SYS-0013 link substitutes the connectivity but not the validation and enrichment, so the substitute is partial by design.",
  },
  {
    id: "DEP-0003",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "service",
    toId: "SVC-0042-02",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "No internal repair tool exists. Appendix A6 assumes one does, which is why the exit plan is unexecutable as written. Worth noticing that the repair workbench is the compensating route for a gateway failure and comes from the same supplier as the gateway.",
  },
  /*
   * affectedByEvent is false because the format library did not fail on
   * 06.10.2026. The event nevertheless made the classification of this
   * service a live question, which is a different thing and must not be
   * conflated with impact.
   */
  {
    id: "DEP-0004",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "service",
    toId: "SVC-0042-03",
    dependencyStrength: "important",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Not touched by the degradation. Flagged because the classification is contested: PT-06 bulk file payments stop outright if the format library fails, which is hard to reconcile with a rating of not supporting a critical or important function.",
  },
  {
    id: "DEP-0005",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "service",
    toId: "SVC-0042-04",
    dependencyStrength: "supporting",
    singlePointOfFailure: false,
    affectedByEvent: false,
    note: "Reconciliation can be deferred to the next day and run manually from the hub extract, so a loss here is absorbed rather than propagated.",
  },
  {
    id: "DEP-0006",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "service",
    toId: "SVC-0042-05",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "The euroSIC and SIC cut-off dependency for ARC-CH. Submission queued from 13:47 on 06.10.2026: 1,842 instructions, CHF 61,304,110, of which CHF 18,712,400 carried same-day value against the 16:00 CET cut-off. ARC-CH holds no direct SIC participant link, so the only alternative is manual correspondent submission under RB-PAY-011 with a 45 minute lead time. This edge is the reason the day has a genuine deadline.",
  },
  {
    id: "DEP-0007",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "supplier",
    toId: "TP-0015",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Every instruction is screened before release and there is no second screening provider. Unaffected on 06.10.2026, and recording that explicitly is useful: the event did not touch screening, so no screening hold contributed to the repair queue spike.",
  },
  {
    id: "DEP-0008",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "service",
    toId: "IBS-0005",
    dependencyStrength: "important",
    singlePointOfFailure: false,
    affectedByEvent: false,
    note: "Static data is the authoritative reference for a repaired instruction. It is how the 20 case post-event sample was checked at 16:19 and how the misrouted intermediary BIC on PAY-DE-20261006-448127 was identified.",
  },
  {
    id: "DEP-0009",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "system",
    toId: "SYS-0011",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "The Arcadia Payment Hub is the state machine of record and stayed available throughout. It held 2,317 instructions in SUBMITTED state awaiting acknowledgement and its monitoring raised the first Arcadia side signal at 14:07, two minutes after the supplier notification.",
  },
  /*
   * The fallback route is an alternative, not a failure, so
   * singlePointOfFailure is false. affectedByEvent is true because this edge
   * is the one the event switched on, and switching it on is what removed
   * validation and satisfied the second condition of RD-RULE-0031.
   */
  {
    id: "DEP-0010",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "system",
    toId: "SYS-0013",
    dependencyStrength: "important",
    singlePointOfFailure: false,
    affectedByEvent: true,
    note: "Arcadia Direct Link carried EUR clearing for ARC-DE and ARC-AT from 14:12:41 under RB-PAY-007. It performs no payment data validation, so instructions the gateway would have enriched failed with R01, R02, R04 or R08 and entered the repair queue as OVR-C route substitution overrides. Setting fallbackRouteMode ACTIVE also satisfied the second condition of RD-RULE-0031, which no runbook or control description mentions.",
  },
  {
    id: "DEP-0011",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "system",
    toId: "SYS-0016",
    dependencyStrength: "important",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Screening platform. A screening hold is a compliance item and never a repair item, which is the distinction that keeps the repair queue figures clean during the event.",
  },
  {
    id: "DEP-0012",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "system",
    toId: "SYS-0017",
    dependencyStrength: "important",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Client Static Data Master. In-house and single instance; a repair cannot be verified against anything else, so its loss would stop repair work even with the gateway healthy.",
  },
  {
    id: "DEP-0013",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "SVC-0042-01",
    toKind: "system",
    toId: "SYS-0012",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "NOVA-GATE. Acknowledgement latency rose from a seven-day median of 1.4 seconds to 42 seconds from 13:38, with timeouts from 13:51. Normal latency returned at 15:41 and full service was confirmed at 16:08.",
  },
  {
    id: "DEP-0014",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "SVC-0042-02",
    toKind: "system",
    toId: "SYS-0014",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "RepairDesk. Q-REPAIR-DE depth rose from 61 items at 14:12 to 494 at 14:26 and Q-REPAIR-AT from 14 to 97. The tenant configuration in this system holds RD-RULE-0031, which waived secondary review on 96 of the 138 OVR-C overrides created between 14:12:41 and 14:26:00.",
  },
  {
    id: "DEP-0015",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "SVC-0042-05",
    toKind: "system",
    toId: "SYS-0015",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "euroSIC Adapter. Swiss submission queued from 13:47 with no fallback available. The same-day tranche was eventually submitted manually through correspondent Helvetia Clearing Partner AG at 15:52 and accepted at 15:58, two minutes inside the cut-off.",
  },
  /*
   * affectedByEvent is false on this edge and that is a deliberate, awkward
   * choice. The Swiss submission queue did stop, but the root cause evidence
   * points at the Frankfurt database of TP-0042.2, not at this host. How the
   * Swiss instance came to be affected is not explained by anything Arcadia
   * holds, and inventing a mechanism here would be worse than recording the
   * gap and waiting for the report due 13.10.2026.
   */
  {
    id: "DEP-0016",
    runId: DEFAULT_RUN_ID,
    fromKind: "supplier",
    fromId: "TP-0042",
    toKind: "subprocessor",
    toId: "TP-0042.1",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Hosts the RepairDesk Swiss instance and the euroSIC adapter. TPRM-Q-2026-R04 is open against exactly this footprint: the disaster recovery test report of 22.05.2026 covers Frankfurt and Amsterdam only, so ARC-CH holds no recovery evidence for a significant outsourcing. That is the instance behind the tolerance that came closest to breach.",
  },
  {
    id: "DEP-0017",
    runId: DEFAULT_RUN_ID,
    fromKind: "supplier",
    fromId: "TP-0042",
    toKind: "subprocessor",
    toId: "TP-0042.2",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "Origin of the event. The primary database cluster in the Frankfurt region lost quorum at 13:31 after a storage firmware update applied in a maintenance window Novalink had not notified. Failover to Amsterdam completed for NOVA-GATE write traffic at 13:44. Evidence EVD-2026-41911.",
  },
  {
    id: "DEP-0018",
    runId: DEFAULT_RUN_ID,
    fromKind: "supplier",
    fromId: "TP-0042",
    toKind: "subprocessor",
    toId: "TP-0042.3",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "Monitoring, alerting and incident detection for all Novalink services. The pipeline stayed pinned to the failed Frankfurt database endpoint until 14:57 because its connection string was static rather than using the failover alias. That is the 34 minute gap between quorum loss at 13:31 and notification at 14:05, and it is why Appendix A5 clause 5.3 could not be met.",
  },
  {
    id: "DEP-0019",
    runId: DEFAULT_RUN_ID,
    fromKind: "supplier",
    fromId: "TP-0042",
    toKind: "subprocessor",
    toId: "TP-0042.4",
    dependencyStrength: "important",
    singlePointOfFailure: false,
    affectedByEvent: false,
    note: "Level 1 service desk and out-of-hours handover, with read access to payment metadata including beneficiary name and reference fields. Not involved in the event. It is on the map because Arcadia did not know it existed: onboarded 01.05.2026, absent from binding Appendix A3 v4.2, no notice on record.",
  },
  {
    id: "DEP-0020",
    runId: DEFAULT_RUN_ID,
    fromKind: "subprocessor",
    fromId: "TP-0042.2",
    toKind: "system",
    toId: "SYS-0012",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "Managed database and regional failover behind the gateway. This is the edge that carried the 13:31 quorum loss into Arcadia payment traffic.",
  },
  {
    id: "DEP-0021",
    runId: DEFAULT_RUN_ID,
    fromKind: "subprocessor",
    fromId: "TP-0042.2",
    toKind: "system",
    toId: "SYS-0014",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: true,
    note: "The same subprocessor also sits behind the repair workbench, so the repair tool and the thing it compensates for share a database provider. A resilience design that puts the primary and its compensating control on one dependency is the finding, independent of what happened on 06.10.2026.",
  },
  {
    id: "DEP-0022",
    runId: DEFAULT_RUN_ID,
    fromKind: "subprocessor",
    fromId: "TP-0042.1",
    toKind: "system",
    toId: "SYS-0015",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Swiss hosting for the euroSIC adapter. Recorded as not affected because no evidence places the failure here, while the Swiss queue still stopped. The open question, which belongs in the request for the 13.10.2026 report, is which shared Novalink platform component links this instance to the Frankfurt failure.",
  },
  {
    id: "DEP-0023",
    runId: DEFAULT_RUN_ID,
    fromKind: "subprocessor",
    fromId: "TP-0042.3",
    toKind: "subprocessor",
    toId: "TP-0042.3-F1",
    dependencyStrength: "supporting",
    singlePointOfFailure: false,
    affectedByEvent: false,
    note: "Fourth party. Long-term archive of logs and telemetry containing payment reference metadata, retained 24 months, engaged by the subprocessor and not by Novalink. The contract has no fourth-party provision, so Arcadia holds no notice right and no objection right over this edge at all.",
  },
  {
    id: "DEP-0024",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0007",
    toKind: "supplier",
    toId: "TP-0015",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "The screening service is the supplier platform in practice; there is no in-house screening capability to fall back to and no second provider under contract.",
  },
  {
    id: "DEP-0025",
    runId: DEFAULT_RUN_ID,
    fromKind: "supplier",
    fromId: "TP-0015",
    toKind: "subprocessor",
    toId: "TP-0015.1",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Sole source of curated list data. The failure mode to watch is not an outage but a silent delivery failure producing stale lists, which screens cleanly and wrongly.",
  },
  {
    id: "DEP-0026",
    runId: DEFAULT_RUN_ID,
    fromKind: "supplier",
    fromId: "TP-0015",
    toKind: "subprocessor",
    toId: "TP-0015.2",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Infrastructure hosting for all three entity tenants of the screening platform. Same legal entity as TP-0007.1 under a different contract, which is the group's least visible concentration.",
  },
  {
    id: "DEP-0027",
    runId: DEFAULT_RUN_ID,
    fromKind: "subprocessor",
    fromId: "TP-0015.2",
    toKind: "subprocessor",
    toId: "TP-0015.2-F1",
    dependencyStrength: "supporting",
    singlePointOfFailure: false,
    affectedByEvent: false,
    note: "Fourth party providing colocation, power and physical security for the Amsterdam region. Facility only, with no logical access to Arcadia data, which is why it is rated supporting rather than critical.",
  },
  {
    id: "DEP-0028",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0008",
    toKind: "supplier",
    toId: "TP-0007",
    dependencyStrength: "important",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "The group GRC platform supplier. Not affected on 06.10.2026, and the point of the edge is the reverse dependency: incident management, decision records and evidence references for INC-2026-0412 were all written into a third-party platform while the incident was running.",
  },
  {
    id: "DEP-0029",
    runId: DEFAULT_RUN_ID,
    fromKind: "supplier",
    fromId: "TP-0007",
    toKind: "subprocessor",
    toId: "TP-0007.1",
    dependencyStrength: "important",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Hosting for the RiskCore tenant carrying all three entity partitions. Same provider as TP-0015.2: a single infrastructure failure would remove both the screening platform and the system of record for non-financial risk.",
  },
  {
    id: "DEP-0030",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0008",
    toKind: "system",
    toId: "SYS-0031",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Arcadia RiskCore holds risks, controls, tests, findings, Massnahmen, RCSAs, third parties and incidents with entity partitioning. Every state change named in the scenario is written here.",
  },
  {
    id: "DEP-0031",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0008",
    toKind: "system",
    toId: "SYS-0032",
    dependencyStrength: "important",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Arcadia Evidence Vault, in-house, immutable and hash addressed. It held EVD-2026-40118 with the recovery time gap from 22.05.2026 onwards, which is a reminder that storing evidence and reading it are different activities.",
  },
  {
    id: "DEP-0032",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0010",
    toKind: "supplier",
    toId: "TP-0023",
    dependencyStrength: "critical",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Sole data centre and hosting provider for the Swiss core banking platform. Substitution is a platform migration, so there is no operational alternative.",
  },
  {
    id: "DEP-0033",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0004",
    toKind: "service",
    toId: "IBS-0010",
    dependencyStrength: "important",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "The ARC-CH leg of corporate payments runs on the Swiss core banking platform before it reaches the euroSIC adapter. Following this edge is how the Swiss exposure resolves into two unsubstitutable suppliers rather than one.",
  },
  {
    id: "DEP-0034",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0001",
    toKind: "supplier",
    toId: "TP-0058",
    dependencyStrength: "important",
    singlePointOfFailure: true,
    affectedByEvent: false,
    note: "Retail servicing for two entities from one contact centre site, with in-house overflow capacity well below the contracted seat count (scenario figures).",
  },
  {
    id: "DEP-0035",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0002",
    toKind: "supplier",
    toId: "TP-0058",
    dependencyStrength: "supporting",
    singlePointOfFailure: false,
    affectedByEvent: false,
    note: "Card blocking and dispute intake. Authorisation itself is unaffected by a contact centre loss, so the dependency is supporting rather than critical, but the card block path is a client affecting action performed by a third party.",
  },
  {
    id: "DEP-0036",
    runId: DEFAULT_RUN_ID,
    fromKind: "service",
    fromId: "IBS-0009",
    toKind: "supplier",
    toId: "TP-0071",
    dependencyStrength: "supporting",
    singlePointOfFailure: false,
    affectedByEvent: false,
    note: "Statement and correspondence production, mid-exit to the consolidated group provider with contract end 31.03.2027. Delay is recoverable and there is no intraday deadline.",
  },
];

/* ==========================================================================
   Impact tolerances / Toleranzschwellen

   Bible section 5.3, all four against IBS-0004. consumedMinutes is 0 at seed
   time and is advanced by the engine as the timeline runs.
   ========================================================================== */

export const impactTolerances: NewImpactTolerance[] = [
  /*
   * Scope is two entities and the schema carries one scope field, so entityId
   * holds the entity scope exactly as section 5.3 states it. ARC-CH is
   * deliberately absent: it has its own tolerance, with its own measure and
   * its own approver, two rows below.
   */
  {
    id: "ITOL-0004-01",
    runId: DEFAULT_RUN_ID,
    serviceId: "IBS-0004",
    entityId: "ARC-DE, ARC-AT",
    metric: "Maximum tolerable disruption to same-day EUR payment submission",
    thresholdMinutes: 240,
    unit: "minutes",
    statement:
      "Maximum tolerable disruption to same-day EUR payment submission is 4 hours during a business day. The measure is elapsed time from confirmed disruption start to restoration of submission capability. Restoration means the ability to submit, not the clearance of the backlog that the disruption created, and the two are recorded separately. Approved by the entity Non-Financial Risk Committees of Arcadia Bank AG and Arcadia Bank Oesterreich AG. These are scenario figures for a synthetic institution.",
    consumedMinutes: 0,
    approvedBy: "Entity NFR Committees, ARC-DE and ARC-AT",
    approvedOn: "2026-03-11",
  },
  /*
   * Expressed in basis points rather than as a percentage so that the
   * threshold is an exact integer: 50 basis points is the 0.5% of daily value
   * the committee approved.
   */
  {
    id: "ITOL-0004-02",
    runId: DEFAULT_RUN_ID,
    serviceId: "IBS-0004",
    entityId: "group",
    metric: "Share of daily corporate payment value delayed beyond its value-date cut-off",
    thresholdVolume: 50,
    unit: "basis points of daily corporate payment value",
    statement:
      "No more than 0.5% of daily corporate payment value, that is 50 basis points, is delayed beyond its value-date cut-off. The measure is value delayed divided by total daily value, aggregated across the three entities and across all in-scope payment types. Value delayed is counted at the point the cut-off passes, not at the point the payment eventually clears. Approved by the Group Non-Financial Risk Committee. These are scenario figures for a synthetic institution.",
    consumedMinutes: 0,
    approvedBy: "Group NFR Committee",
    approvedOn: "2026-03-11",
  },
  /*
   * The two-measure tolerance. Both measures live in one row because the
   * board approved one tolerance, and the defect is precisely that: two
   * measures, no stated precedence, so the entity cannot say whether it
   * breached its own tolerance. The schema carries the duration measure in
   * thresholdMinutes and the cut-off measure in the unit and the statement.
   */
  {
    id: "ITOL-0004-03",
    runId: DEFAULT_RUN_ID,
    serviceId: "IBS-0004",
    entityId: ENTITY_CH,
    metric:
      "Maximum tolerable disruption to CHF and euroSIC submission, and submission completion against the same-day cut-off",
    thresholdMinutes: 120,
    unit: "minutes, and completion before the 16:00 CET same-day cut-off",
    statement:
      "Maximum tolerable disruption to CHF and euroSIC submission is 2 hours, and submission must complete before the 16:00 CET same-day cut-off. The tolerance carries two measures: elapsed disruption time, and submission completion versus the cut-off. The statement does not say which measure prevails where they give different answers, and they can give different answers, because a disruption that begins early enough can exceed two hours and still complete before the cut-off. Approved by the Board Risk Committee of Arcadia Bank Schweiz AG. The 16:00 CET cut-off is a scenario figure set for this synthetic institution and is not taken from any published market timetable. Illustrative regulatory context, not legal advice.",
    consumedMinutes: 0,
    approvedBy: "ARC-CH Board Risk Committee",
    approvedOn: "2026-02-24",
  },
  /*
   * Zero tolerance, which makes it the only tolerance in the set that can be
   * breached by a single transaction rather than by elapsed time.
   */
  {
    id: "ITOL-0004-04",
    runId: DEFAULT_RUN_ID,
    serviceId: "IBS-0004",
    entityId: "group",
    metric: "Releases with an unsatisfied mandatory control gate",
    thresholdVolume: 0,
    unit: "count of releases with an unsatisfied mandatory control gate",
    statement:
      "No corporate payment is released without the control gates defined for its release path. The measure is a count of releases with an unsatisfied mandatory gate and the tolerance is zero. A release counts against this tolerance whether the gate was bypassed by a person or waived by a system configuration, because the tolerance is written about the outcome and not about the mechanism. Approved by the Group Non-Financial Risk Committee. These are scenario figures for a synthetic institution.",
    consumedMinutes: 0,
    approvedBy: "Group NFR Committee",
    approvedOn: "2026-03-11",
  },
];

/* ==========================================================================
   Contracts / Vertraege

   CTR-2023-0117 is held as the framework agreement with each appendix as its
   own row, because the appendices carry different versions, different dates
   and different states of alignment with reality, and the A3 version question
   cannot be modelled on a single contract row.
   ========================================================================== */

export const contracts: NewContract[] = [
  {
    id: "CTR-2023-0117",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    entityId: ENTITY_DE,
    reference: "CTR-2023-0117",
    title: "Master Services Agreement, Payment Processing Services",
    effectiveFrom: "2023-09-01",
    effectiveTo: "2028-08-31",
    documentType: "framework",
    noticePeriodDays: 365,
    auditRightsSecured: true,
    subprocessorConsentModel:
      "Notice and objection, not prior consent. Appendix A3 clause 3.4 gives Arcadia 60 days prior written notice of an addition, removal or material change and a 30 day objection window.",
    summary:
      "Signed 12.06.2023, effective 01.09.2023, initial term five years to 31.08.2028. Contracting entity Arcadia Bank AG, with accession schedules bringing Arcadia Bank Oesterreich AG and Arcadia Bank Schweiz AG into the same terms. Governing law is German; the Swiss accession schedule carries a Swiss law overlay for the data and supervisory access clauses, which is the reason the Swiss position on this supplier cannot simply be read off the German one. Termination on 12 months notice for convenience, 30 days for cause. Annual charge EUR 6.85m group-wide (scenario figure). Seven appendices, held as separate records. Illustrative regulatory context, not legal advice.",
  },
  {
    id: "CTR-2023-0117-A1",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    entityId: ENTITY_DE,
    reference: "CTR-2023-0117-A1",
    title: "Appendix A1, Service descriptions and service levels",
    effectiveFrom: "2025-04-01",
    documentType: "appendix",
    auditRightsSecured: false,
    summary:
      "Binding version 3.0 dated 01.04.2025. Describes the five Novalink services and their service levels. Clause 7.2 requires 10 business days notice of any change affecting the availability of a service supporting a critical or important function, including changes at a subprocessor. Sets NOVA-GATE contracted availability at 99.7% monthly excluding planned maintenance and states a RepairDesk recovery time objective of 2 hours (scenario figures). Both of those numbers are the subject of open evidence questions in the 2026 reassessment.",
  },
  {
    id: "CTR-2023-0117-A2",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    entityId: ENTITY_DE,
    reference: "CTR-2023-0117-A2",
    title: "Appendix A2, Charges",
    effectiveFrom: "2026-01-01",
    documentType: "appendix",
    auditRightsSecured: false,
    summary:
      "Binding version 2.1 dated 01.01.2026. Sets the charging structure and the annual indexation mechanism for the group-wide charge of EUR 6.85m (scenario figure). Current and uncontested. Relevant to the day only because a commercial negotiation is one of the levers available to P-010 when the notice and evidence questions are put to the supplier.",
  },
  /*
   * The contested document. Two things must stay separate in every surface
   * that shows it: which version is binding, and what the supplier says about
   * notice. The first is settled by the Group Legal opinion; the second is
   * live and is a dispute, not a finding.
   */
  {
    id: "CTR-2023-0117-A3",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    entityId: ENTITY_DE,
    reference: "CTR-2023-0117-A3",
    title: "Appendix A3, Subprocessor list",
    effectiveFrom: "2025-02-14",
    documentType: "appendix",
    noticePeriodDays: 60,
    auditRightsSecured: false,
    subprocessorConsentModel:
      "Notice and objection. Clause 3.4: 60 days prior written notice of any addition, removal or material change to a subprocessor, with a 30 day Arcadia objection window. Silent on the subprocessors' own subcontractors.",
    /*
     * The appendix itself, version 4.2 of 14.02.2025, and not the Group Legal
     * opinion about it. The opinion EVD-2026-41901 is a separate document,
     * written on the scenario day and revealed at 15:23, so a contract row
     * pointing at it would resolve to nothing visible for most of the day and
     * would offer a reader an argument about the appendix in place of the
     * appendix. The opinion is cited where it belongs, on the decisions and
     * the chronology entries that turn on it.
     */
    evidenceDocumentId: "EVD-2026-41410",
    summary:
      "Binding version 4.2 dated 14.02.2025, listing three subprocessors: Helvetia CloudWorks AG in Zurich, Rheinstack GmbH with the Frankfurt region only, and Polaris Telemetrix s.r.o. in Brno. Out of alignment with reality on two counts. The Novalink Subprocessor Register v6.1 of 03.08.2026 lists four subprocessors, adding Meridian Operations Support Pvt Ltd in Pune (onboarded 01.05.2026), and records a second Rheinstack region in Amsterdam. That register is a supplier document and not a contract document: v4.2 remains the binding appendix, which is the conclusion of the Group Legal opinion of P-016 Dr. Anja Weiss recorded as EVD-2026-41901 on 06.10.2026 at 15:23. Novalink's position, given by P-011 Miriam Falk at 15:31, is that publication of the register on its client portal constitutes notice under clause 3.4. Clause 3.4 does not say that. Arcadia's contract repository holds no notice for Meridian and no notice for the Amsterdam region. Present this as a live contractual dispute, not as a settled breach.",
  },
  {
    id: "CTR-2023-0117-A4",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    entityId: ENTITY_DE,
    reference: "CTR-2023-0117-A4",
    title: "Appendix A4, Audit, access and supervisory rights",
    effectiveFrom: "2023-09-01",
    documentType: "appendix",
    auditRightsSecured: true,
    summary:
      "Binding version 1.0 dated 01.09.2023, unchanged since signature. Secures Arcadia audit and access rights, supervisory authority access for the EU entities and FINMA access for ARC-CH. Clause 2.1 allows Arcadia to request configuration and audit-trail extracts from any Novalink system processing Arcadia data, within 4 hours for incident purposes. That clause earned its keep on 06.10.2026: it is the instrument P-002 used at 15:38 to obtain the RepairDesk tenant configuration export and the rule firing history, which is what turned a disputed inference into a verified fact. Illustrative regulatory context, not legal advice.",
  },
  {
    id: "CTR-2023-0117-A5",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    entityId: ENTITY_DE,
    reference: "CTR-2023-0117-A5",
    title: "Appendix A5, Incident notification and escalation",
    effectiveFrom: "2024-10-15",
    documentType: "appendix",
    auditRightsSecured: false,
    summary:
      "Binding version 2.0 dated 15.10.2024. Clause 5.3 requires Novalink to notify Arcadia within 30 minutes of detection with six mandatory fields: disruption start time, affected services, affected entities, severity, initial impact assessment and next update time. Service notification NSN-2026-0887, received at 14:05:12 on 06.10.2026, carried one of the six. The appendix also sets the escalation contacts and the supplier obligation to join the Arcadia incident bridge, both of which were met.",
  },
  {
    id: "CTR-2023-0117-A6",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    entityId: ENTITY_DE,
    reference: "CTR-2023-0117-A6",
    title: "Appendix A6, Exit and transition plan",
    effectiveFrom: "2023-09-01",
    documentType: "appendix",
    auditRightsSecured: false,
    summary:
      "Binding version 2.0 dated 01.09.2023 and never tested in the three years since. The plan assumes Arcadia can operate a payment repair queue on an internal tool during transition. Arcadia holds no such tool, and the repair workbench it would replace is supplied by the party being exited. A plan that depends on a capability the bank does not have is not a slow plan, it is an unexecutable one, and that is the finding rather than the absence of a test.",
  },
  {
    id: "CTR-2023-0117-A7",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0042",
    entityId: ENTITY_DE,
    reference: "CTR-2023-0117-A7",
    title: "Appendix A7, Data processing and transfers",
    effectiveFrom: "2025-05-20",
    documentType: "appendix",
    auditRightsSecured: false,
    summary:
      "Binding version 2.2 dated 20.05.2025. Sets the processing purposes, the security measures, the access restrictions for Novalink personnel and the transfer arrangements for Arcadia payment data. It is drafted against the subprocessor population in Appendix A3 v4.2, which means it does not address the transfer of payment metadata to Pune, and it does not address the 24 month retention of payment reference metadata by a fourth party in Dublin. Illustrative regulatory context, not legal advice.",
  },
  {
    id: "CTR-2024-0233",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0015",
    entityId: ENTITY_DE,
    reference: "CTR-2024-0233",
    title: "Master Services Agreement, Financial Crime Screening Platform",
    effectiveFrom: "2024-04-01",
    effectiveTo: "2029-03-31",
    documentType: "framework",
    noticePeriodDays: 180,
    auditRightsSecured: true,
    subprocessorConsentModel:
      "Prior written consent for any new subprocessor with access to Arcadia data, and notice only for subprocessors without such access. The stronger of the two consent models in the critical population.",
    summary:
      "Signed 19.02.2024, effective 01.04.2024, five year term to 31.03.2029, contracted by Arcadia Bank AG with accession for the Austrian and Swiss entities. Secures direct audit rights, on-site inspection, supervisory access for all three entities and a documented transfer basis per entity for the transfer of screening payloads outside the European Economic Area and outside Switzerland. Worth contrasting with CTR-2023-0117: this agreement was negotiated after the group tightened its third-party policy, and it is the internal benchmark P-002 uses when he argues for a subprocessor consent model rather than a notice model. Illustrative regulatory context, not legal advice.",
  },
  {
    id: "CTR-2022-0081",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0023",
    entityId: ENTITY_CH,
    reference: "CTR-2022-0081",
    title: "Outsourcing Agreement, Data Centre and Core Platform Operations",
    effectiveFrom: "2022-07-01",
    effectiveTo: "2027-06-30",
    documentType: "framework",
    noticePeriodDays: 270,
    auditRightsSecured: true,
    subprocessorConsentModel:
      "Prior written consent for any subprocessor, and a standing prohibition on processing client identifying data outside Switzerland.",
    summary:
      "The only Swiss law agreement in the critical population. Signed 11.04.2022 by Arcadia Bank Schweiz AG, effective 01.07.2022, five year term to 30.06.2027, so renewal negotiation opens in the first quarter of 2027. Client identifying data must remain in Switzerland. Audit, access and supervisory rights are drafted for FINMA rather than for EU authorities, and the business continuity schedule requires an annual recovery test witnessed by the bank, which has been performed in each of the last three years. This is the record to point at when someone asks why the Swiss entity cannot simply be assessed on the group checklist. Illustrative regulatory context, not legal advice.",
  },
  {
    id: "CTR-2025-0044",
    runId: DEFAULT_RUN_ID,
    supplierId: "TP-0007",
    entityId: ENTITY_DE,
    reference: "CTR-2025-0044",
    title: "Software as a Service Agreement, Governance Risk and Compliance Platform",
    effectiveFrom: "2025-06-01",
    effectiveTo: "2030-05-31",
    documentType: "framework",
    noticePeriodDays: 180,
    auditRightsSecured: false,
    subprocessorConsentModel:
      "Notice only, with a published subprocessor page and a 30 day objection window that does not suspend the change.",
    summary:
      "Signed 14.04.2025, effective 01.06.2025, five year term to 31.05.2030, contracted by Arcadia Bank AG for all three entity partitions. Audit and access rights are not secured as a direct right: the agreement substitutes an annual third-party assurance report and offers no on-site inspection, no pooled audit participation and no right to test controls. The assurance report scope covers the hosting and platform layers and stops short of the application layer where Arcadia risk, control and incident records are held. The exit provision promises a data export in a documented machine readable format within 30 days of termination and has never been exercised. This is the weakest contractual position in the register, held against the platform that is the system of record for non-financial risk.",
  },
];

/* ==========================================================================
   Contract obligations / Vertragspflichten

   Obligations are held against the framework agreement, with the appendix and
   clause carried in clauseReference, because the appendices are part of the
   agreement and a professional testing the supplier works from one obligation
   register rather than from eight. evidenceStatus is the honest position at
   07:45 on 06.10.2026 unless the note says otherwise.
   ========================================================================== */

export const contractObligations: NewContractObligation[] = [
  {
    id: "COB-CTR-2023-0117-01",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A1 clause 7.2",
    obligationText:
      "Novalink gives 10 business days notice of any change affecting the availability of a service supporting a critical or important function, including changes at a subprocessor.",
    category: "reporting",
    evidenceStatus: "partially-met",
    evidenceDocumentIds: ["EVD-2026-41911"],
    note:
      "Notice has been given for planned maintenance in the ordinary course, so the obligation is not wholly unperformed. The storage firmware update applied at the Frankfurt hosting subprocessor at 13:31 on 06.10.2026 was not notified, and it caused the quorum loss that started INC-2026-0412. Whether that constitutes a breach of clause 7.2 is being assessed under MSN-2026-0217 with P-010; do not record a conclusion before that assessment is complete.",
  },
  /*
   * A verified service level miss that the supplier has not reported. The
   * reporting failure is separate from the availability failure and is
   * tracked as obligation 03.
   */
  {
    id: "COB-CTR-2023-0117-02",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A1, service level schedule, NOVA-GATE availability",
    obligationText:
      "NOVA-GATE contracted availability is 99.7% monthly, excluding planned maintenance.",
    category: "resilience",
    evidenceStatus: "breached",
    evidenceDocumentIds: [],
    note:
      "September 2026 actual availability was 99.62% excluding planned maintenance against a contracted 99.7% (scenario figures). The miss is visible in the supplier's own monthly data and Novalink has not reported it as a miss. Arcadia found it by reading the report rather than by being told, which is the part worth raising in the reassessment.",
  },
  {
    id: "COB-CTR-2023-0117-03",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A1, service level reporting",
    obligationText:
      "Novalink reports monthly on service levels for each contracted service, including availability measured against the contracted level and an explanation of any shortfall.",
    category: "reporting",
    evidenceStatus: "partially-met",
    evidenceDocumentIds: [],
    note:
      "Monthly reports arrive on time and in the agreed format. The September 2026 report contained the availability shortfall in its data and did not identify it as a shortfall or explain it (scenario figure). A report that is complete but not candid satisfies the format and not the purpose, and the reassessment should say so in those terms.",
  },
  /*
   * The most uncomfortable row in this register. The evidence has been in the
   * vault since 22.05.2026 and nobody escalated it for 137 days, which is an
   * Arcadia follow-up finding rather than a supplier finding.
   */
  {
    id: "COB-CTR-2023-0117-04",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A1, service description, RepairDesk recovery time objective",
    obligationText:
      "RepairDesk is recoverable within a recovery time objective of 2 hours.",
    category: "resilience",
    evidenceStatus: "breached",
    evidenceDocumentIds: ["EVD-2026-40118"],
    note:
      "The disaster recovery test report of 22.05.2026 records actual recovery of 3 hours 40 minutes against the contracted 2 hour objective: a gap of 1 hour 40 minutes, with no explanation, no remediation plan and no notification to Arcadia. Open as TPRM-Q-2026-R07. The report has been in the Evidence Vault since 22.05.2026, so the finding is as much about Arcadia reading its own evidence as about Novalink missing its objective.",
  },
  /*
   * This is the obligation that intersects the 14:05 event. The instance with
   * no recovery evidence is the instance behind the tolerance that came
   * closest to breach.
   */
  {
    id: "COB-CTR-2023-0117-05",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A1, service description, disaster recovery testing",
    obligationText:
      "Novalink tests disaster recovery for each service at least annually and provides the test evidence for every instance used by Arcadia.",
    category: "resilience",
    evidenceStatus: "partially-met",
    evidenceDocumentIds: ["EVD-2026-40118"],
    note:
      "The test report of 22.05.2026 covers the Frankfurt and Amsterdam regions. There is no evidence for the Swiss instance hosted at TP-0042.1 Helvetia CloudWorks, so ARC-CH holds no recovery evidence for a significant outsourcing. Open as TPRM-Q-2026-R04. Note the intersection with 06.10.2026: the untested instance is the one behind ITOL-0004-03, the tolerance that came closest to breach.",
  },
  /*
   * A drafting gap presented as a drafting gap. The notice clause is written
   * about availability, and a configuration change that silently waives a
   * control gate does not affect availability at all. Arcadia reads the clause
   * more widely than Novalink does, and neither reading has been tested.
   */
  {
    id: "COB-CTR-2023-0117-06",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A1 clause 7.2, applied to tenant configuration change",
    obligationText:
      "Arcadia reads clause 7.2 as requiring notice of any Novalink change that alters how an Arcadia service behaves, including a change to the Arcadia tenant configuration delivered inside a Novalink release. Novalink has not accepted that reading.",
    category: "resilience",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: ["EVD-2026-41905", "EVD-2026-41907"],
    note:
      "Rule RD-RULE-0031 entered tenant arcadia-prod with RepairDesk release 8.3 on 11.11.2024, applied from Novalink standard configuration template BCP-THROUGHPUT-v2 and not requested by Arcadia. The release notes attached to CHG-2024-5512 referred to continuity throughput improvements for fallback routing and named no control waiver. Clause 7.2 is drafted about availability, and this change affected a control gate rather than availability, so the obligation as drafted may not reach it. Accountability is shared: Novalink for non-disclosure, Arcadia for approving a release without reviewing its control effects. Close the drafting gap by variation rather than by argument.",
  },
  /*
   * The notice failure. Two omissions, one clause, and a supplier position
   * that has to be recorded as a position and not as a finding.
   */
  {
    id: "COB-CTR-2023-0117-07",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A3 clause 3.4",
    obligationText:
      "Novalink gives 60 days prior written notice of any addition, removal or material change to a subprocessor, and Arcadia may object within 30 days of notice.",
    category: "subprocessor",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: ["EVD-2026-41901"],
    note:
      "Arcadia's contract repository contains no notice for TP-0042.4 Meridian Operations Support, onboarded by Novalink on 01.05.2026, and no notice for the Amsterdam region of TP-0042.2 Rheinstack. Novalink's position, stated by P-011 Miriam Falk at 15:31 on 06.10.2026, is that publication of its subprocessor register on the client portal constitutes notice; clause 3.4 does not say that. Live contractual dispute, escalated as a formal notice under MSN-2026-0221 with P-016 and P-010. Do not record it as a settled breach.",
  },
  /*
   * The appendix versus submission discrepancy in one row: three listed in
   * the binding version, four in the supplier register, plus an undisclosed
   * region on one of the three.
   */
  {
    id: "COB-CTR-2023-0117-08",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A3, subprocessor list",
    obligationText:
      "Novalink maintains a complete and accurate list of the subprocessors engaged in the provision of the services, including the location of processing for each.",
    category: "subprocessor",
    evidenceStatus: "partially-met",
    evidenceDocumentIds: ["EVD-2026-41901"],
    note:
      "Binding Appendix A3 v4.2 of 14.02.2025 lists three subprocessors. The Novalink Subprocessor Register v6.1 of 03.08.2026 lists four and adds a second processing region. Two of the three shared entries are accurate; Rheinstack is listed with the Frankfurt region only and operates Amsterdam as well. The register is a supplier document and not a contract document, so v4.2 remains binding: that is the conclusion of the Group Legal opinion recorded as EVD-2026-41901. The supplier disclosed the region divergence itself, while explaining the incident at 14:55.",
  },
  /*
   * A fourth party holding payment reference metadata for 24 months, and no
   * contractual provision to breach. Record it as a gap to close, not as
   * supplier non-compliance.
   */
  {
    id: "COB-CTR-2023-0117-09",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A3, scope of the subprocessor provision",
    obligationText:
      "The appendix governs subprocessors engaged by Novalink. It does not address the subcontractors those subprocessors engage in their turn.",
    category: "subprocessor",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "TP-0042.3-F1 Aurora Object Storage holds Arcadia payment reference metadata in archived logs for 24 months, engaged by the monitoring subprocessor rather than by Novalink. Clause 3.4 obliges notice of subprocessor changes and is silent on fourth parties, so Arcadia holds no notice right, no objection right and no visibility at that layer. This is a drafting gap and must be presented as one. Opened as a contract variation under MSN-2026-0221.",
  },
  /*
   * One obligation in this register is properly met, and it is the one that
   * mattered most on the day: the four hour extract right is what turned a
   * disputed inference into a verified fact at 15:38.
   */
  {
    id: "COB-CTR-2023-0117-10",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A4 clause 2.1",
    obligationText:
      "Arcadia may request configuration and audit-trail extracts from any Novalink system processing Arcadia data, and Novalink provides them within 4 hours for incident purposes.",
    category: "audit",
    evidenceStatus: "met",
    evidenceDocumentIds: ["EVD-2026-41905", "EVD-2026-41906"],
    note:
      "Exercised on 06.10.2026. P-002 made a formal request under this clause and Novalink engineering returned the RepairDesk tenant configuration export and the RD-RULE-0031 firing history at 15:38, well inside the four hour window. The extract resolved a conflict between two credible people that no amount of discussion would have settled. This is the clause to point at when a colleague asks what contractual audit rights are actually for.",
  },
  {
    id: "COB-CTR-2023-0117-11",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A4, audit and supervisory access",
    obligationText:
      "Arcadia, its internal audit function, its external auditors and the competent supervisory authorities for each contracting entity, including FINMA for Arcadia Bank Schweiz AG, may audit and inspect the services on site.",
    category: "audit",
    evidenceStatus: "partially-met",
    evidenceDocumentIds: [],
    note:
      "The right is secured in text and covers all three entities. It has never been exercised on site in the three years since 01.09.2023, so its operability is untested: no access request, no data room, no evidence of how Novalink would handle a supervisory inspection. A right that has never been used is not the same as a right that works. Illustrative regulatory context, not legal advice.",
  },
  {
    id: "COB-CTR-2023-0117-12",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A4, security testing evidence",
    obligationText:
      "Novalink provides the most recent penetration test report for the systems processing Arcadia data, with the scope statement and the remediation position for any finding.",
    category: "security",
    evidenceStatus: "partially-met",
    evidenceDocumentIds: ["EVD-2026-40233"],
    note:
      "A two page summary dated 30.06.2026 was provided and the full report was withheld on confidentiality grounds. The summary's scope statement does not confirm whether the RepairDesk override application programming interfaces were in scope, so Arcadia cannot tell whether the highest privilege function in the payment repair process was tested. Open as TPRM-Q-2026-R19. A redacted full report with the scope section intact would close this.",
  },
  /*
   * A clear failure on the content requirement, with the timing question left
   * open on purpose. Five of six mandatory fields absent is a fact; when
   * Novalink detected the disruption is not yet evidenced.
   */
  {
    id: "COB-CTR-2023-0117-13",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A5 clause 5.3",
    obligationText:
      "Novalink notifies Arcadia within 30 minutes of detection with six mandatory fields: disruption start time, affected services, affected entities, severity, initial impact assessment and next update time.",
    category: "reporting",
    evidenceStatus: "breached",
    evidenceDocumentIds: ["EVD-2026-41871"],
    note:
      "Service notification NSN-2026-0887 was received at 14:05:12 on 06.10.2026 and carried one of the six mandatory fields, severity. Disruption start time, affected services, affected entities, initial impact assessment and next update time were all absent, and the notification asserted no customer impact against an actual technical start of 13:31. The content requirement is plainly not met. The 30 minute clock runs from Novalink detection, and when Novalink detected is not evidenced, because its own monitoring was pinned to the failed region until 14:57. A remediation that only fixes the notification template will not fix this: the cause is structural and sits with TP-0042.3.",
  },
  {
    id: "COB-CTR-2023-0117-14",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A5, written incident report",
    obligationText:
      "Novalink provides a written incident report with root cause and remediation within five business days of a notified disruption.",
    category: "reporting",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "For INC-2026-0412 the report is due 13.10.2026, which is the morning of CMT-NFR-2026-10. Nothing is overdue and nothing can be assessed. The consequence is procedural rather than contractual: the committee paper has to be written on 07.10.2026 or 08.10.2026 without the supplier's account, structured so that the report's arrival on the day of the meeting does not invalidate the decision taken. Recorded as DEC-2026-0781.",
  },
  {
    id: "COB-CTR-2023-0117-15",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A6, exit and transition plan",
    obligationText:
      "Novalink maintains an exit and transition plan that enables Arcadia to move the services to another provider or in-house, and supports Arcadia in keeping that plan current.",
    category: "exit",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "Version 2.0 dated 01.09.2023, unchanged and never tested. The plan assumes Arcadia can operate a payment repair queue on an internal tool during transition; Arcadia holds no such tool and the repair workbench it would replace comes from the party being exited. The plan is therefore unexecutable as written, which is a stronger finding than an untested plan and should be stated as such. Open as TPRM-Q-2026-R11.",
  },
  {
    id: "COB-CTR-2023-0117-16",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A6, exit and substitutability testing",
    obligationText:
      "Novalink supports an exit or substitutability test on Arcadia request, including the extraction of Arcadia data and configuration in a documented format.",
    category: "exit",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "No test evidence has been provided and Novalink refers back to Appendix A6. Arcadia's own substitutability assessment of 30.06.2025 concluded 12 to 18 months with material programme cost and recorded that no test had been performed. Neither side holds evidence, which means the 12 to 18 month figure is an opinion rather than a finding. A data and configuration extraction test would be the cheapest way to turn it into one.",
  },
  {
    id: "COB-CTR-2023-0117-17",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A7, data processing and transfers",
    obligationText:
      "Any transfer of Arcadia data to a location outside the European Economic Area, or outside Switzerland for Arcadia Bank Schweiz AG data, requires a documented transfer basis and prior notification to the contracting entity.",
    category: "security",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "TP-0042.4 Meridian Operations Support in Pune holds read access to payment metadata including beneficiary name and reference fields, and Arcadia holds no notification and no transfer documentation for it. Three separate questions follow: contractual notice, subprocessing for the EU entities, and data access and offshoring for ARC-CH, which must be assessed against the Swiss framework and never rolled into the EU answer. Illustrative regulatory context, not legal advice.",
  },
  {
    id: "COB-CTR-2023-0117-18",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2023-0117",
    clauseReference: "Appendix A7, access control and least privilege",
    obligationText:
      "Access to Arcadia payment data is restricted to named Novalink personnel with a documented business need, and Novalink provides evidence of that restriction on request.",
    category: "security",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "Arcadia holds no access list, no joiner, mover and leaver evidence and no access log for the Meridian service desk population, which is the group with the broadest read access to payment metadata and the group Arcadia did not know about. Requested as part of the 2026 reassessment and outstanding. This is one of the eight missing artefacts in the reassessment count.",
  },
  /*
   * A second supplier is carried here to keep the obligation register from
   * reading as a Novalink file. The interesting thing about Kestrel is that
   * its weakest clause sits under the platform that records everything the
   * NFR function does.
   */
  {
    id: "COB-CTR-2025-0044-01",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2025-0044",
    clauseReference: "Master agreement, audit and access",
    obligationText:
      "In place of a direct Arcadia audit right, Kestrel provides an annual independent third-party assurance report covering the controls relevant to the service.",
    category: "audit",
    evidenceStatus: "partially-met",
    evidenceDocumentIds: [],
    note:
      "The 2026 report was delivered on time and is clean within its scope. The scope is the problem: it covers the hosting and platform layers and stops short of the application layer, where Arcadia risk, control, test and incident records are held and where logical access segregation between the three entity partitions is enforced. Arcadia has no right of on-site inspection, no pooled audit participation and no right to test controls, so there is no route to close the gap other than a contract variation at renewal.",
  },
  {
    id: "COB-CTR-2025-0044-02",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2025-0044",
    clauseReference: "Master agreement, data export on termination",
    obligationText:
      "On termination Kestrel provides a full export of Arcadia data in a documented machine readable format within 30 days, including attachments and audit history.",
    category: "exit",
    evidenceStatus: "not-evidenced",
    evidenceDocumentIds: [],
    note:
      "Never exercised and never tested. The platform holds the risk, control, test, Massnahme, RCSA, third-party and incident records for all three entities, together with the audit history that gives those records their evidential value. An export that arrived without the audit history would satisfy the clause and be worth very little. A scoped extraction test is the obvious ask at the 2027 review.",
  },
  {
    id: "COB-CTR-2025-0044-03",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2025-0044",
    clauseReference: "Service schedule, platform availability and recovery",
    obligationText:
      "Kestrel maintains platform availability of 99.5% monthly excluding planned maintenance, with a recovery time objective of 4 hours and a recovery point objective of 15 minutes, evidenced by an annual recovery test.",
    category: "resilience",
    evidenceStatus: "met",
    evidenceDocumentIds: [],
    note:
      "Availability has been at or above the contracted level in every month since 01.06.2025 and the recovery test of 04.03.2026 met both objectives (scenario figures). Recorded as met, with one qualification worth keeping visible: the recovery test was performed by the supplier and witnessed on a call rather than on site, because the contract gives Arcadia no inspection right.",
  },
  {
    id: "COB-CTR-2025-0044-04",
    runId: DEFAULT_RUN_ID,
    contractId: "CTR-2025-0044",
    clauseReference: "Master agreement, subprocessor notification",
    obligationText:
      "Kestrel notifies Arcadia of any addition or change to its subprocessors through its published subprocessor page, with a 30 day objection window that does not suspend the change.",
    category: "subprocessor",
    evidenceStatus: "met",
    evidenceDocumentIds: [],
    note:
      "Notification has been given correctly for every change since 01.06.2025, including the hosting arrangement recorded as TP-0007.1. The obligation is met and the exposure is still worth reporting: TP-0007.1 is the same legal entity as TP-0015.2 under the screening contract, so two group-wide platforms rest on one infrastructure provider. Neither supplier assessment reports it, because each stops at its own supplier boundary. That is a register design gap rather than a supplier failure.",
  },
];
