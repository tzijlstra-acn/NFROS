/**
 * Risk spine: processes, risks, controls, key risk indicators, indicator
 * history and the RCSA versions that sit on top of them.
 *
 * Authoritative source: docs/SCENARIO_BIBLE.md sections 1, 2, 3, 4, 5, 6, 8,
 * 9, 10 and 17. Where this module and the bible disagree, the bible wins and
 * this module is fixed, not the bible.
 *
 * Two arithmetic contracts govern this file.
 *
 * First, every residual position on an assessment line is exactly what
 * `calculateRiskMatrixPosition` in src/domain/nfr/calculators.ts returns for
 * the inherent position and control effectiveness recorded on that line. The
 * group methodology gives a fully effective control a two band likelihood
 * reduction and a one band impact reduction, a largely effective control a one
 * band likelihood reduction, and a partially effective or not effective
 * control nothing at all. No line in this file rounds, smooths or negotiates
 * that result.
 *
 * Second, every indicator reading status is derived from the indicator's own
 * thresholds by `statusFor` below, and the final reading in each series is
 * checked against the indicator's recorded current value at module load. A
 * trend that does not end where the dashboard says it ends is a bug.
 *
 * Synthetic institution and data.
 */

import {
  appetitePositionFor,
  calculateRiskMatrixPosition,
  type ControlEffectiveness,
  type RiskRating,
} from "@/domain/nfr/calculators";

import {
  DEFAULT_RUN_ID,
  ENTITY_AT,
  ENTITY_CH,
  ENTITY_DE,
  type NewAssessment,
  type NewAssessmentLine,
  type NewControl,
  type NewKri,
  type NewKriReading,
  type NewProcess,
  type NewRisk,
} from "./contract";

/**
 * Aggregation scope for indicators that are reported at group level rather
 * than for one legal entity. It is deliberately not a member of
 * `legalEntities`: the group parent does not carry the prudential
 * accountability that the three banking entities carry.
 */
const SCOPE_GROUP = "ARC-GROUP";

/* ==========================================================================
   Processes

   The payments hierarchy is modelled to the depth the scenario needs and no
   further. PRC-0041 is the process the whole day turns on, so it carries real
   volumetrics; processes outside payments carry none, because the bible states
   no volumetrics for them and inventing plausible ones would put numbers in
   front of a banking executive that nothing supports.
   ========================================================================== */

export const processes: NewProcess[] = [
  {
    id: "PRC-0040",
    runId: DEFAULT_RUN_ID,
    name: "Corporate payment execution",
    nameDe: "Ausfuehrung von Firmenkundenzahlungen",
    code: "PAY.03",
    serviceId: "IBS-0004",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    description:
      "Parent process for the end-to-end execution of outbound payment instructions submitted by corporate and institutional clients, from instruction receipt through validation, repair, release and clearing submission to confirmation. Operated from the Munich hub for Arcadia Bank AG and Arcadia Bank Oesterreich AG, and from Zurich for Arcadia Bank Schweiz AG.",
    monthlyVolume: 1905000,
    manualTouchRate: 2.7,
    recentChangeNote:
      "Arcadia Bank AG instructions rose from 1,870,000 in August 2026 to 1,905,000 in September 2026, an increase of 1.9 percent. The share entering the repair queue rose from 2.28 percent to 2.70 percent over the same period, which is a far larger movement than the volume increase explains. Scenario figures.",
  },
  {
    id: "PRC-0042",
    runId: DEFAULT_RUN_ID,
    name: "Payment instruction intake and validation",
    nameDe: "Annahme und Validierung von Zahlungsauftraegen",
    code: "PAY.03.01",
    parentProcessId: "PRC-0040",
    serviceId: "IBS-0004",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    description:
      "Receipt of client payment instructions into the Arcadia Payment Hub, format and content validation through the Novalink Gateway, and assignment of a validation failure reason code from R01 to R08 where validation does not pass. This process is the gate that produces the repair queue, so its population is the same population as the parent process.",
    monthlyVolume: 1905000,
    manualTouchRate: 2.7,
    recentChangeNote:
      "Validation failures rose from 42,636 in August 2026 to 51,435 in September 2026, an increase of 20.6 percent. The reason code mix in September was R01 31 percent, R02 22 percent, R03 14 percent, R08 10 percent, R04 9 percent, R05 8 percent and R07 6 percent. Scenario figures.",
  },
  {
    /*
     * The manual touch rate here is the share of repair items resolved by
     * creating a manual override record, 731 of 51,435 in September 2026. It is
     * not the share of instructions a human touched: every item in this process
     * is human-touched by definition, so that reading of the field would carry
     * no information. The figure that matters operationally is how often a
     * human suppresses a validation rule rather than correcting the data.
     */
    id: "PRC-0041",
    runId: DEFAULT_RUN_ID,
    name: "Payment repair and manual override",
    nameDe: "Zahlungsreparatur und manuelle Ueberschreibung",
    code: "PAY.03.02",
    parentProcessId: "PRC-0040",
    serviceId: "IBS-0004",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    description:
      "Resolution of payment instructions that failed validation. Two paths exist. Under standard repair the analyst corrects a data field from an authoritative source, the instruction is revalidated and no override record is created. Under manual override the analyst or duty manager suppresses one or more validation rules and forces release, an override record is created in Novalink RepairDesk, and CTL-PAY-014 independent secondary review applies. Operating hours are 06:00 to 19:00 CET on business days with on-call cover overnight. Headcount is 34 full time equivalents in Munich and 6 in Zurich.",
    monthlyVolume: 51435,
    manualTouchRate: 1.42,
    recentChangeNote:
      "September 2026 repair items for Arcadia Bank AG were 51,435, resolving as 50,355 standard repairs, 731 manual overrides and 349 returns and cancellations. Repair volume rose 20.6 percent on August while overrides rose 77.4 percent, from 412 to 731. Overrides grew almost four times faster than the queue that produces them, which means behaviour changed and not only volume. By reason code the movement was concentrated in OVR-C route substitution, 31 to 198, and OVR-D cut-off driven release, 94 to 211. Both are pressure indicators rather than error indicators. Scenario figures.",
  },
  {
    id: "PRC-0043",
    runId: DEFAULT_RUN_ID,
    name: "Clearing submission and route management",
    nameDe: "Clearingeinlieferung und Steuerung der Clearingwege",
    code: "PAY.03.03",
    parentProcessId: "PRC-0040",
    serviceId: "IBS-0004",
    entityIds: [ENTITY_DE, ENTITY_AT],
    ownerUserId: "P-007",
    description:
      "Submission of released instructions to the applicable clearing route and management of route substitution. The primary route for euro clearing is the Novalink Gateway to T2, RT1 and TIPS. The secondary route is the Arcadia Direct Link, Arcadia's own T2 direct participant connection, which performs no payment data validation. Route substitution is authorised under runbook RB-PAY-007 version 3.1 dated 09.02.2026.",
    monthlyVolume: 1904651,
    manualTouchRate: 0.01,
    recentChangeNote:
      "Volume is September 2026 instructions received less the 349 returns and cancellations recorded in the month. Route substitution was applied to 198 instructions in September against 31 in August, following five fallback activations totalling 8 hours 40 minutes.",
  },
  {
    id: "PRC-0044",
    runId: DEFAULT_RUN_ID,
    name: "Payment exception investigation and client callback",
    nameDe: "Klaerfallbearbeitung und Kundenrueckfrage",
    code: "PAY.03.04",
    parentProcessId: "PRC-0040",
    serviceId: "IBS-0004",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-008",
    description:
      "Investigation of repair items that cannot be resolved from an authoritative internal source and require the client to confirm a payment detail. A recorded callback is performed and the confirmation is retained as the evidentiary basis for any override raised under reason code OVR-B.",
    monthlyVolume: 7201,
    manualTouchRate: 100,
    recentChangeNote:
      "Volume is the R03 beneficiary name and account mismatch share of the September 2026 repair queue, 14 percent of 51,435. OVR-B client-confirmed corrections released out of band rose from 197 in August to 214 in September. Scenario figures.",
  },
  {
    id: "PRC-0045",
    runId: DEFAULT_RUN_ID,
    name: "Corporate payment static data maintenance",
    nameDe: "Pflege der Stammdaten im Firmenkundenzahlungsverkehr",
    code: "PAY.03.05",
    parentProcessId: "PRC-0040",
    serviceId: "IBS-0004",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    description:
      "Maintenance of client account, mandate and beneficiary static data in the Client Static Data Master, which is the authoritative source the repair team corrects from. Where an instruction fails on R08 missing corporate mandate static data, the correction is made here rather than on the instruction, so that the same failure does not recur on the next instruction from the same client.",
    monthlyVolume: 5144,
    manualTouchRate: 100,
    recentChangeNote:
      "Volume is the R08 share of the September 2026 repair queue, 10 percent of 51,435. Static data corrections made on the instruction rather than in the master are the reason the same client can generate the same failure in consecutive months. Scenario figures.",
  },
  {
    id: "PRC-0046",
    runId: DEFAULT_RUN_ID,
    name: "Swiss franc and euroSIC clearing submission",
    nameDe: "Einlieferung CHF und euroSIC",
    code: "PAY.04",
    parentProcessId: "PRC-0040",
    serviceId: "IBS-0004",
    entityIds: [ENTITY_CH],
    ownerUserId: "P-015",
    description:
      "Submission of Swiss franc domestic payments and euroSIC payments for Arcadia Bank Schweiz AG through the euroSIC Adapter. Submission must complete before the 16:00 CET same-day cut-off. The entity holds no direct SIC participant link, so its only fallback is manual submission through a correspondent bank under runbook RB-PAY-011, which carries a 45 minute preparation lead time.",
    monthlyVolume: 198000,
    manualTouchRate: 0.02,
    recentChangeNote:
      "Arcadia Bank Schweiz AG instructions rose from 195,000 in August 2026 to 198,000 in September 2026. Manual overrides rose from 38 to 49, a smaller movement than either euro entity, because the Swiss route has no automated fallback that can be activated under pressure.",
  },
  {
    id: "PRC-0052",
    runId: DEFAULT_RUN_ID,
    name: "Third-party onboarding and due diligence",
    nameDe: "Aufnahme und Pruefung von Drittparteien",
    code: "TPR.01",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    description:
      "Pre-contract assessment of a prospective third party, determination of criticality tier, identification of the services to be provided and of any subprocessors engaged beneath them, and confirmation that audit and access rights, resilience obligations and exit provisions are secured contractually before the arrangement is signed.",
    recentChangeNote:
      "No onboarding of a Tier 1 payment provider occurred in the period. The open work in this domain is reassessment of an existing arrangement rather than onboarding of a new one.",
  },
  {
    id: "PRC-0053",
    runId: DEFAULT_RUN_ID,
    name: "Third-party ongoing monitoring and reassessment",
    nameDe: "Laufende Ueberwachung und Neubewertung von Drittparteien",
    code: "TPR.02",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    description:
      "Periodic reassessment of third-party arrangements at a frequency set by criticality tier, monitoring of service levels against contractual commitments, review of subprocessor changes against the binding contract appendix, and maintenance of exit and substitutability plans for arrangements supporting a critical or important function.",
    recentChangeNote:
      "The 2026 reassessment of the Tier 1 payment provider is in progress against a cycle deadline of 31.10.2026. Two of its findings are open as remediation actions and one of them is a condition of a live risk acceptance.",
  },
  {
    id: "PRC-0061",
    runId: DEFAULT_RUN_ID,
    name: "Operational resilience scenario testing",
    nameDe: "Szenariotests zur operationellen Resilienz",
    code: "RES.01",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-005",
    description:
      "Design and execution of severe but plausible disruption scenarios for each important business service, measurement of the result against the approved impact tolerances, and recording of the remediation required where a scenario shows that a tolerance cannot be met.",
    recentChangeNote:
      "Fallback arrangements remain untested for a material share of important business services. The share with tested arrangements has been below the red threshold since June 2026.",
  },
  {
    id: "PRC-0062",
    runId: DEFAULT_RUN_ID,
    name: "Incident management and severity classification",
    nameDe: "Vorfallmanagement und Schweregradeinstufung",
    code: "RES.02",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-005",
    description:
      "Detection, classification, escalation and closure of operational incidents. Severity is assigned on the S1 to S4 scale, where S1 requires that an impact tolerance for an important business service is breached or within 60 minutes of breach, that a zero-tolerance control condition has candidate breaches, or that client funds are at risk.",
    recentChangeNote:
      "No S1 or S2 incident affecting Corporate Payments was recorded in September 2026. The five fallback activations in the month were handled as service degradations below the incident threshold, which is why none of them appears in incident reporting.",
  },
  {
    id: "PRC-0071",
    runId: DEFAULT_RUN_ID,
    name: "Regulatory change identification and impact assessment",
    nameDe: "Identifikation regulatorischer Vorhaben und Auswirkungsanalyse",
    code: "REG.01",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-006",
    description:
      "Horizon scanning for regulatory publications relevant to the group, determination of which legal entities a publication applies to, decomposition of the publication into discrete obligations, and assignment of each obligation to an accountable owner with an implementation date. Applicability is determined per entity, because the three banking entities sit in two different regulatory blocs.",
    recentChangeNote:
      "Applicability determination remains the step that consumes the most effort, because a group-level publication frequently applies to two of the three entities and the third requires its own domestic framework reference or an explicit not-applicable.",
  },
  {
    id: "PRC-0081",
    runId: DEFAULT_RUN_ID,
    name: "Internal control system testing",
    nameDe: "Testierung des internen Kontrollsystems",
    code: "GOV.01",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-004",
    description:
      "Independent design and operating effectiveness testing of key controls in the Internal Control System, performed by Group Control Assurance on an annual cycle per control with attribute sampling against a stated tolerable deviation rate. Results are reported to the control owner, the process owner, the Operational Risk Partner and the NFR Portfolio Lead.",
    recentChangeNote:
      "The September 2026 test of the key payment release control reported four exceptions and two items on which the tester could not conclude, in a sample of 60 drawn from a population of 1,204.",
  },
  {
    id: "PRC-0082",
    runId: DEFAULT_RUN_ID,
    name: "Remediation action management",
    nameDe: "Massnahmenmanagement",
    code: "GOV.02",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-001",
    description:
      "Recording, tracking, extension approval and closure of remediation actions raised from audit findings, control test exceptions, third-party assessments and incidents. An action more than 60 days past a revised due date is reported to the NFR Committee with a named accountable executive and a recommendation either to re-baseline with a root-cause explanation or to escalate to the entity board.",
    recentChangeNote:
      "Seven actions were overdue at group level as at 06.10.2026, of which two relate to Corporate Payments. One of those two is 67 days past a revised due date that had already been extended once.",
  },
];

/* ==========================================================================
   Risks

   Inherent positions are on the group five by five scale. RSK-0211 carries the
   inherent position the bible fixes for it, likelihood 3 and impact 4, which
   the group matrix rates high at 12 of 25. Every assessment line in this file
   reuses the inherent position recorded here rather than restating it, because
   an inherent position that differs between the register and the assessment is
   the first thing an auditor finds and the last thing anyone can explain.
   ========================================================================== */

export const risks: NewRisk[] = [
  {
    /*
     * The appetite position recorded here is the second line pre-read position
     * of 02.10.2026, not the signed Q3 position. First line disputes it and the
     * 10:30 workshop exists to settle it. The register deliberately carries the
     * more adverse of the two recorded positions: a portfolio view that reads
     * "within appetite" while a red indicator and a partially effective key
     * preventive control sit underneath it is precisely the reporting failure
     * this product exists to remove.
     */
    id: "RSK-0211",
    runId: DEFAULT_RUN_ID,
    title: "Erroneous or unauthorised payment release",
    titleDe: "Fehlerhafte oder unautorisierte Zahlungsfreigabe",
    taxonomyL1: "Execution, Delivery and Process Management",
    taxonomyL2: "Payment execution and settlement",
    processIds: ["PRC-0041", "PRC-0042", "PRC-0043"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    description:
      "A corporate payment instruction is released to clearing with incorrect payment data, or without the authorisation the release path requires. The exposure arises where a validation block is suppressed by manual override and the override is not independently reviewed before release, so that no second person confirms the override reason, the supporting evidence and the payment detail. Realisation would produce an irrevocable transfer of client funds to an unintended beneficiary, a client claim, and a breach of the group zero-tolerance condition that no corporate payment is released without the control gates defined for its release path.",
    inherentLikelihood: 3,
    inherentImpact: 4,
    appetiteStatement:
      "Group Operational Risk Policy: a residual score of 10 or above on a payment execution risk is outside appetite and requires either an approved remediation plan with committed dates or a documented Risikoakzeptanz approved by the entity Chief Operating Officer and noted by the Group NFR Committee. Monitoring alone does not discharge the requirement.",
    appetitePosition: "outside",
  },
  {
    id: "RSK-0212",
    runId: DEFAULT_RUN_ID,
    title: "Delay to same-day corporate payment submission beyond the value-date cut-off",
    titleDe:
      "Verzoegerung der Einlieferung von Taggleich-Zahlungen ueber den Valuta-Annahmeschluss hinaus",
    taxonomyL1: "Execution, Delivery and Process Management",
    taxonomyL2: "Payment execution and settlement",
    processIds: ["PRC-0041", "PRC-0043"],
    entityIds: [ENTITY_DE, ENTITY_AT],
    ownerUserId: "P-007",
    description:
      "A corporate payment instruction accepted for same-day value is not submitted to clearing before its value-date cut-off, either because it sits in the repair queue past the cut-off or because the release path cannot complete in time. The consequence is a rolled value date, a client interest claim and, at volume, a measured position against the group tolerance that no more than 0.5 percent of daily corporate payment value is delayed beyond its value-date cut-off. The risk interacts with RSK-0211 under time pressure: the faster route to meeting a cut-off is an override, and the override is the path on which the authorisation control sits. Scenario figures.",
    inherentLikelihood: 3,
    inherentImpact: 4,
    appetiteStatement:
      "Group Operational Risk Policy: a residual score of 10 or above on a payment execution risk is outside appetite. The supporting service measure is impact tolerance ITOL-0004-02, which permits no more than 0.5 percent of daily corporate payment value to be delayed beyond its value-date cut-off. Illustrative scenario parameter.",
    appetitePosition: "outside",
  },
  {
    id: "RSK-0213",
    runId: DEFAULT_RUN_ID,
    title: "Missing or incorrect regulatory reporting data on cross-border payments",
    titleDe: "Fehlende oder fehlerhafte Meldedaten bei grenzueberschreitenden Zahlungen",
    taxonomyL1: "Compliance and Regulatory Risk",
    taxonomyL2: "Regulatory reporting accuracy",
    processIds: ["PRC-0041", "PRC-0042"],
    entityIds: [ENTITY_DE, ENTITY_AT],
    ownerUserId: "P-007",
    description:
      "A cross-border payment above the reporting threshold of EUR 12,500 is released without complete and well-formed regulatory reporting data, either because the client instruction did not carry it or because it was completed from instruction free text rather than from a confirmed source. R02 is the second largest reason code in the repair queue at 22 percent of September 2026 items, and OVR-D permits release before cut-off with the data completed within one business day, which makes the post-release completion step the control that actually matters. Scenario figures.",
    inherentLikelihood: 3,
    inherentImpact: 3,
    appetiteStatement:
      "Group Operational Risk Policy: regulatory reporting data completeness is assessed against a residual score ceiling of 9. Post-release completion is acceptable only where it is evidenced within one business day for every instance.",
    appetitePosition: "within",
  },
  {
    id: "RSK-0214",
    runId: DEFAULT_RUN_ID,
    title: "Duplicate release of a corporate payment instruction",
    titleDe: "Doppelte Zahlungsfreigabe",
    taxonomyL1: "Execution, Delivery and Process Management",
    taxonomyL2: "Payment execution and settlement",
    processIds: ["PRC-0041", "PRC-0042"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-008",
    description:
      "An instruction that duplicates a prior instruction is released a second time, either because the duplicate suspicion flag R05 was cleared without comparison against the prior instruction, or because a client resubmitted a file after a partial failure. R05 accounted for 8 percent of September 2026 repair items. The financial exposure is recoverable in most cases but the client impact is immediate and visible. Scenario figures.",
    inherentLikelihood: 2,
    inherentImpact: 3,
    appetiteStatement:
      "Group Operational Risk Policy: duplicate release is assessed against a residual score ceiling of 9. A confirmed duplicate release requires same-day notification to the client and a recorded recovery attempt.",
    appetitePosition: "within",
  },
  {
    id: "RSK-0215",
    runId: DEFAULT_RUN_ID,
    title: "Inaccurate corporate mandate and beneficiary static data",
    titleDe: "Unrichtige Mandats- und Beguenstigtenstammdaten",
    taxonomyL1: "Data and Reporting Risk",
    taxonomyL2: "Data quality and lineage",
    processIds: ["PRC-0045", "PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    description:
      "The Client Static Data Master holds an incorrect account, mandate or beneficiary record, and the repair team corrects instructions from it in the belief that it is authoritative. This is the quiet version of RSK-0211: the override is reviewed, the reviewer checks the data against the master, the master is wrong, and the control operates correctly while producing the wrong outcome. R01 and R08 together were 41 percent of the September 2026 repair queue. Scenario figures.",
    inherentLikelihood: 3,
    inherentImpact: 3,
    appetiteStatement:
      "Group Operational Risk Policy: static data integrity supporting an important business service is assessed against a residual score ceiling of 9, with dual authorisation required for any change to a mandate or beneficiary record.",
    appetitePosition: "within",
  },
  {
    id: "RSK-0216",
    runId: DEFAULT_RUN_ID,
    title: "Swiss franc clearing submission misses the domestic same-day cut-off",
    titleDe: "Verfehlen des taggleichen Annahmeschlusses im Schweizer Clearing",
    taxonomyL1: "Business Disruption and Operational Resilience",
    taxonomyL2: "Important business service disruption",
    processIds: ["PRC-0046"],
    entityIds: [ENTITY_CH],
    ownerUserId: "P-015",
    description:
      "Arcadia Bank Schweiz AG fails to complete Swiss franc and euroSIC submission before the 16:00 CET same-day cut-off. The entity holds no direct SIC participant link, so the only available fallback is manual submission through a correspondent bank under runbook RB-PAY-011, which requires 45 minutes of preparation before the first instruction can be sent. The decision to invoke that route therefore has to be taken well before the outcome is known.",
    inherentLikelihood: 3,
    inherentImpact: 4,
    appetiteStatement:
      "Group Operational Risk Policy: a residual score of 10 or above on a payment execution risk is outside appetite. The supporting service measure is impact tolerance ITOL-0004-03, approved by the Arcadia Bank Schweiz AG Board Risk Committee, which sets a maximum tolerable disruption of 2 hours and requires submission to complete before the 16:00 CET same-day cut-off.",
    appetitePosition: "outside",
  },
  {
    /*
     * The adjacent risk from bible section 10.2. It is carried in the Payment
     * Operations RCSA as well as in the Third-Party Risk assessment, because the
     * unit that depends on the service has to own the exposure even though the
     * supplier relationship is managed elsewhere.
     */
    id: "RSK-0184",
    runId: DEFAULT_RUN_ID,
    title: "Loss or material degradation of a critical third-party payment service",
    titleDe:
      "Verlust oder wesentliche Beeintraechtigung einer kritischen Zahlungsdienstleistung eines Dritten",
    taxonomyL1: "Third-Party and Outsourcing Risk",
    taxonomyL2: "Critical service provider dependency",
    processIds: ["PRC-0041", "PRC-0042", "PRC-0043", "PRC-0046", "PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    description:
      "A single provider supplies payment validation and clearing connectivity, the repair and override workbench, and the Swiss clearing adapter. Degradation of that provider therefore affects validation, repair and Swiss clearing simultaneously rather than one at a time, and the fallback for the euro entities removes the validation the provider performs rather than replacing it. The exposure is not the loss of a system; it is the loss of a control environment at the same moment as the loss of a route.",
    inherentLikelihood: 4,
    inherentImpact: 4,
    appetiteStatement:
      "Group Third-Party Risk Policy: a residual score of 10 or above on a Tier 1 arrangement supporting a critical or important function is outside appetite unless a Risikoakzeptanz is approved by the entity Chief Operating Officer. A conditional acceptance lapses if its conditions are not met by the stated date, and a lapsed acceptance is treated as no acceptance.",
    appetitePosition: "outside",
  },
  {
    id: "RSK-0185",
    runId: DEFAULT_RUN_ID,
    title: "Undisclosed or unapproved subprocessor processing Arcadia payment data",
    titleDe: "Nicht offengelegter oder nicht genehmigter Unterauftragnehmer",
    taxonomyL1: "Third-Party and Outsourcing Risk",
    taxonomyL2: "Subprocessor and fourth-party transparency",
    processIds: ["PRC-0052", "PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    description:
      "A provider engages a subprocessor that is not recorded in the binding contract appendix, or a subprocessor recorded in the appendix is no longer the entity actually performing the function. Arcadia then cannot state where its payment data is processed, cannot confirm that audit and access rights extend to the party performing the work, and cannot assess the fourth parties beneath it. The gap is found by reconciliation rather than by notification, which means it is found late.",
    inherentLikelihood: 3,
    inherentImpact: 3,
    appetiteStatement:
      "Group Third-Party Risk Policy: the subprocessor record for every Tier 1 arrangement must be complete and current, evidenced by reconciliation against the binding contract appendix. A residual score of 10 or above is outside appetite.",
    appetitePosition: "at-limit",
  },
  {
    id: "RSK-0186",
    runId: DEFAULT_RUN_ID,
    title: "Inability to exit or substitute a critical payment service provider within tolerance",
    titleDe: "Fehlende Ausstiegs- und Substitutionsfaehigkeit bei einem kritischen Dienstleister",
    taxonomyL1: "Third-Party and Outsourcing Risk",
    taxonomyL2: "Exit and substitutability",
    processIds: ["PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    description:
      "An exit or substitution plan exists on paper for a Tier 1 payment arrangement but has never been tested, so neither the elapsed time to substitute nor the control environment during substitution is known. The plan asserts a capability that no evidence supports. For the repair and override workbench there is no substitutable product in service anywhere in the group, which makes the plan a statement of intent rather than an arrangement.",
    inherentLikelihood: 3,
    inherentImpact: 4,
    appetiteStatement:
      "Group Third-Party Risk Policy: every Tier 1 arrangement supporting a critical or important function requires a documented and tested exit and substitutability plan. An untested plan may not be credited in the residual assessment.",
    appetitePosition: "outside",
  },
  {
    /*
     * This risk was on the register with no indicator and no test coverage, and
     * it is the register entry that RD-RULE-0031 belongs to. Nobody connected
     * the two, which is why a supplier template changed a key control gate in
     * November 2024 and the risk stayed at its limit rather than moving.
     */
    id: "RSK-0261",
    runId: DEFAULT_RUN_ID,
    title: "Unreviewed supplier configuration change alters a payment control gate",
    titleDe: "Nicht gepruefte Konfigurationsaenderung in einem Zahlungssystem",
    taxonomyL1: "Technology and Cyber Risk",
    taxonomyL2: "Change and configuration management",
    processIds: ["PRC-0041", "PRC-0043", "PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    description:
      "A configuration change deployed by a provider into the Arcadia tenant alters the behaviour of a control that Arcadia relies on, and the Arcadia change approval is taken on the provider's release notes rather than on the configuration itself. No control owner reviews the change, the control description is not updated, and the control continues to be reported as operating as described. The tenant configuration is client editable, so the capability to prevent this exists and is simply not exercised.",
    inherentLikelihood: 3,
    inherentImpact: 4,
    appetiteStatement:
      "Group Operational Risk Policy: a change that alters the operation of a key control in the Internal Control System requires review and sign-off by the named control owner before deployment, irrespective of who originates the change. A residual score of 10 or above is outside appetite.",
    appetitePosition: "at-limit",
  },
  {
    id: "RSK-0262",
    runId: DEFAULT_RUN_ID,
    title: "Loss of the audit trail or evidence supporting a key control",
    titleDe: "Verlust des Nachweis- und Pruefpfads einer Schluesselkontrolle",
    taxonomyL1: "Governance and Internal Control",
    taxonomyL2: "Control evidence and audit trail",
    processIds: ["PRC-0041", "PRC-0081"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-004",
    description:
      "The record of a key control's operation cannot be produced, because the acting human identity was replaced by a service account identity, because a provider-side log retention period expired before the question was asked, or because a retention job moved the evidence object. The control may have operated correctly. Nobody can demonstrate it, and an assurance opinion cannot be formed on an assertion. Unable to conclude is a distinct category from failure and is routinely neglected.",
    inherentLikelihood: 3,
    inherentImpact: 3,
    appetiteStatement:
      "Group Operational Risk Policy: evidence of the operation of a key control in the Internal Control System must be retrievable for the full assurance retention period, including where the evidence is held in a provider system. A residual score of 10 or above is outside appetite.",
    appetitePosition: "at-limit",
  },
  {
    id: "RSK-0301",
    runId: DEFAULT_RUN_ID,
    title: "Important business service disruption exceeding the approved impact tolerance",
    titleDe: "Ueberschreitung der Toleranzschwelle einer wichtigen Geschaeftsdienstleistung",
    taxonomyL1: "Business Disruption and Operational Resilience",
    taxonomyL2: "Important business service disruption",
    processIds: ["PRC-0061", "PRC-0062", "PRC-0040"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-005",
    description:
      "An operational disruption to Corporate Payments runs past the elapsed time the entity has stated it can tolerate, or past the value-delay proportion it has stated it can tolerate. The harder exposure is not the disruption but the measurement: where a tolerance carries two measures and no stated precedence between them, the entity can be within one measure and outside the other at the same moment and cannot say whether it breached its own tolerance.",
    inherentLikelihood: 3,
    inherentImpact: 5,
    appetiteStatement:
      "Group Operational Resilience Policy: an important business service must be capable of remaining within its approved impact tolerances under severe but plausible disruption. A tolerance breach requires same-day notification to the entity NFR Committee and the Group Chief Risk Officer.",
    appetitePosition: "outside",
  },
  {
    id: "RSK-0302",
    runId: DEFAULT_RUN_ID,
    title: "Fallback arrangements untested or ineffective when invoked",
    titleDe: "Nicht getestete oder unwirksame Ausweichvorkehrungen",
    taxonomyL1: "Business Disruption and Operational Resilience",
    taxonomyL2: "Continuity and fallback arrangements",
    processIds: ["PRC-0061", "PRC-0043", "PRC-0046"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-005",
    description:
      "A documented fallback arrangement does not deliver the capability it claims when it is invoked, because it was never tested end to end or because the test covered availability and not the control environment. Runbook RB-PAY-007 section 4 states that the control environment is unchanged during fallback operation. That statement is factually wrong, and because it is a documented assertion rather than a silence it is a finding rather than an omission.",
    inherentLikelihood: 3,
    inherentImpact: 4,
    appetiteStatement:
      "Group Operational Resilience Policy: fallback arrangements supporting an important business service must be tested at least annually, and the test must cover the control environment in the fallback state and not only the availability of the route.",
    appetitePosition: "outside",
  },
  {
    id: "RSK-0331",
    runId: DEFAULT_RUN_ID,
    title: "Remediation actions not completed within committed dates",
    titleDe: "Nicht fristgerechte Umsetzung von Massnahmen",
    taxonomyL1: "Governance and Internal Control",
    taxonomyL2: "Remediation discipline",
    processIds: ["PRC-0082"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-001",
    description:
      "An action raised to close a known control weakness passes its committed date without completion, and the weakness it was raised to remove remains live in the meantime. The exposure is cumulative rather than immediate: each extension is individually defensible, and the position that results is that a weakness identified by internal audit in November 2025 is still open when the control test finds exactly the failure the action was raised to prevent.",
    inherentLikelihood: 4,
    inherentImpact: 3,
    appetiteStatement:
      "Group NFR Framework: no more than three remediation actions may be overdue at group level at any month end. An action more than 60 days past a revised due date is reported to the NFR Committee with a named accountable executive and a recommendation to re-baseline with a root-cause explanation or to escalate to the entity board.",
    appetitePosition: "at-limit",
  },
  {
    id: "RSK-0332",
    runId: DEFAULT_RUN_ID,
    title: "Control environment misstated in internal risk reporting",
    titleDe: "Unzutreffende Darstellung des Kontrollumfelds in der internen Berichterstattung",
    taxonomyL1: "Governance and Internal Control",
    taxonomyL2: "Control framework integrity",
    processIds: ["PRC-0081", "PRC-0082"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-001",
    description:
      "A control is reported as operating as described when the system that enforces it behaves differently, because the description has not been updated since a configuration change altered the enforced condition. Committees then take decisions on a control environment that does not exist. This risk is the reason a control description review is a control in its own right rather than a documentation task, and it is the risk under which a two-line disagreement about a single control is a governance matter and not a difference of opinion.",
    inherentLikelihood: 3,
    inherentImpact: 4,
    appetiteStatement:
      "Group Operational Risk Policy: the recorded description of a key control must reflect the conditions the system actually enforces, reviewed at least annually and on every change that affects the enforced condition. A residual score of 10 or above is outside appetite.",
    appetitePosition: "at-limit",
  },
  {
    id: "RSK-0351",
    runId: DEFAULT_RUN_ID,
    title: "Failure to identify or implement an applicable regulatory requirement on time",
    titleDe: "Nicht fristgerechte Umsetzung einer anwendbaren regulatorischen Anforderung",
    taxonomyL1: "Compliance and Regulatory Risk",
    taxonomyL2: "Regulatory change management",
    processIds: ["PRC-0071"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-006",
    description:
      "A regulatory publication that applies to one or more group entities is not identified, is identified but assessed as not applicable, or is assessed as applicable without an owner and a date. The group operates across two regulatory blocs, so the most common failure is not missing a publication but attributing it to the wrong set of entities, and applying an EU requirement to the Swiss entity is as much an error as failing to apply it to the EU entities.",
    inherentLikelihood: 3,
    inherentImpact: 4,
    appetiteStatement:
      "Group NFR Framework: every identified regulatory change item must carry a per-entity applicability determination, a decomposition into discrete obligations, and a named owner with an implementation date, before the next scheduled committee reporting date after identification.",
    appetitePosition: "within",
  },
  {
    id: "RSK-0371",
    runId: DEFAULT_RUN_ID,
    title: "Insufficient qualified reviewer capacity in payment operations",
    titleDe: "Unzureichende qualifizierte Pruefkapazitaet im Zahlungsverkehr",
    taxonomyL1: "People and Conduct Risk",
    taxonomyL2: "Capacity and key person dependency",
    processIds: ["PRC-0041", "PRC-0044"],
    entityIds: [ENTITY_DE],
    ownerUserId: "P-007",
    description:
      "The approved establishment of qualified secondary reviewers in the Munich payment repair team is not filled, so the pool available to review manual overrides is smaller than the process was designed for. Capacity pressure does not produce a control failure on its own; it produces a preference for the faster path, and the faster path under a cut-off is an override. Reviewer capacity is therefore an input to RSK-0211 and not a separate operational inconvenience.",
    inherentLikelihood: 4,
    inherentImpact: 3,
    appetiteStatement:
      "Group Operational Risk Policy: the approved establishment for a role that performs a key preventive control must be at least 95 percent filled. Below 85 percent the accountable process owner must record a compensating arrangement and a recruitment plan with a committed start date. Illustrative scenario parameter.",
    appetitePosition: "outside",
  },
];

/* ==========================================================================
   Controls

   CTL-PAY-014 is the control the day turns on and it is reproduced exactly as
   bible section 8 states it, including the version 4.1 control statement of
   14.01.2025.

   Effectiveness is recorded twice on purpose. `firstLineEffectiveness` is the
   control owner's self-assessment on the first line form, which offers the
   label "Fully Effective / Voll wirksam". `currentEffectiveness` is the value
   held in the register, which carries whichever assessment was last recorded
   against the control: normally the independent assurance result on the
   second line scale, which offers the label "Effective / Wirksam", and where
   no assurance conclusion has been signed, the first line position that was
   carried into the last approved assessment. The two scales are not identical
   and nobody has aligned them. That is left visible rather than normalised,
   because it is a real and irritating finding that slightly weakens both
   positions.
   ========================================================================== */

export const controls: NewControl[] = [
  {
    /*
     * The central divergence, and the one row in the seed whose value the day
     * is supposed to move.
     *
     * The register carries the first line assessment until the second line
     * challenge is recorded. That is not a convenience for the demonstration,
     * it is what the record actually holds at 07:45 on 06.10.2026. The last
     * approved assessment of this control is the Q3 2026 RCSA, signed by the
     * process owner on 08.07.2026 with the control environment rated
     * effective on a first line self-assessment, because no independent test
     * result existed at that date. Independent test TST-2026-0318 reported on
     * 25.09.2026 and concluded partially effective, and that conclusion is
     * not in the register, because `assuranceConclusion` on TST-2026-0318 is
     * still null: the test status is disputed, the control owner has recorded
     * that she does not accept the result, and the assurance owner has not
     * signed a conclusion. A register that already held partially effective
     * would be asserting a second line conclusion that nobody has reached.
     *
     * So both fields read fully effective at seed time, and they say it on
     * two different scales that nobody has aligned. `lastTestedOn` stays at
     * 25.09.2026, which is the uncomfortable part and the point: the control
     * was tested eleven days ago, the test reported a deficiency, and the
     * register still carries the rating the first line asserts.
     *
     * The 11:45 decision DEC-2026-0772 is what moves this value, and moving
     * it is the whole claim the workshop exists to demonstrate. Option one
     * carries the first line position forward, option three records the
     * second line conclusion of partially effective, and only after that
     * decision does the rating change, the residual position return to the
     * inherent position, and the divergence become visible in every other
     * function's view.
     */
    id: "CTL-PAY-014",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-014",
    title: "Independent secondary review of manual payment overrides",
    titleDe: "Unabhaengige Zweitpruefung manueller Zahlungsueberschreibungen",
    description:
      "Control objective: ensure that every manual override of a payment validation block is independently reviewed and approved by a qualified secondary reviewer before the payment is released. Control statement, version 4.1 dated 14.01.2025: For each manual override created in RepairDesk, an independent secondary reviewer who did not create the override reviews the override reason, the supporting evidence and the payment detail, and records approval in RepairDesk before the payment is released. This applies to all overrides without exception. The control is designated a key control in the Internal Control System (Internes Kontrollsystem). It operates per occurrence in Novalink RepairDesk with a monthly monitoring review by the control owner, and assurance is owned in the second line by Group Control Assurance.",
    riskIds: ["RSK-0211"],
    processIds: ["PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-008",
    nature: "preventive",
    automation: "it-dependent-manual",
    frequency: "per occurrence, with monthly monitoring review",
    isKeyControl: true,
    currentEffectiveness: "fully-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-08T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-09-25",
    designNote:
      "The register rating of fully effective was set on 08.07.2026 at the Q3 RCSA sign-off, on a first line self-assessment made before any independent test existed. It has not been revised, because the independent test result is disputed and no assurance conclusion has been signed. Both deficiencies below are reported and neither is yet reflected in the register. Design deficiency. The control statement says review is required for all overrides without exception. RepairDesk rule RD-RULE-0031, introduced in release 8.3 and deployed to the arcadia-prod tenant on 11.11.2024 from a Novalink standard configuration template, sets secondaryReviewRequired to false where the override reason is OVR-C, the fallback route is active, the value is below EUR 250,000 and the currency is EUR. Change CHG-2024-5512 was approved on the basis of Novalink release notes that referenced continuity throughput improvements for fallback routing without naming a control waiver, and no Arcadia control owner reviewed the rule. The description has not been updated since 14.01.2025, two months after the rule entered the tenant. The rule sits in Arcadia's own tenant configuration and is editable by an Arcadia tenant administrator, so the capability to close the gap has been available throughout. Operating deficiency. Test TST-2026-0318 reported four exceptions and two items on which the tester could not conclude, in a sample of 60 drawn from a population of 1,204: a deviation rate of 6.67 percent on exceptions alone and 10.00 percent treating the unable-to-conclude items as deviations, against a tolerable deviation rate of 5 percent. Compensating controls claimed by the first line are CTL-PAY-021 and CTL-PAY-029. Scenario figures.",
  },
  {
    id: "CTL-PAY-021",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-021",
    title: "Next-business-day sampling of manual overrides by the Duty Manager",
    titleDe: "Stichprobenpruefung der Ueberschreibungen am folgenden Geschaeftstag",
    description:
      "On each business day the Duty Manager, Payment Operations selects a 10 percent sample of the manual override records created on the previous business day and confirms for each selected record that the override reason code is consistent with the validation failure reason codes present on the instruction, that an evidence reference is present, and that a secondary review record exists where one was required. Findings are recorded in the daily operations log and referred to the control owner. Scenario figures.",
    riskIds: ["RSK-0211", "RSK-0213"],
    processIds: ["PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-008",
    nature: "detective",
    automation: "manual",
    frequency: "daily, on the next business day",
    isKeyControl: false,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-02T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "Claimed by the first line as a compensating control for CTL-PAY-014, and it cannot compensate for a preventive failure. The control is detective, it operates on the next business day after the payment has been submitted and is irrevocable, and it examines one record in ten. On the September 2026 population of 731 overrides it would be expected to examine 73. A sample of that size gives no assurance about any individual release, and the control holds no mechanism to stop one.",
  },
  {
    id: "CTL-PAY-029",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-029",
    title: "Daily payment value reconciliation to clearing confirmations",
    titleDe: "Taegliche Abstimmung der Zahlungswerte gegen Clearingbestaetigungen",
    description:
      "Each business day the total value and count of payment instructions recorded as submitted in the Arcadia Payment Hub is reconciled against the clearing confirmations received from each clearing route. Differences are investigated on the day of identification and unresolved differences above the investigation threshold are escalated to the Head of Payment Operations before the following business day opens.",
    riskIds: ["RSK-0211", "RSK-0212", "RSK-0214"],
    processIds: ["PRC-0043", "PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    nature: "detective",
    automation: "it-dependent-manual",
    frequency: "daily",
    isKeyControl: true,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-02T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "Also claimed by the first line as a compensating control for CTL-PAY-014. It reconciles value, not authorisation. A payment of the correct amount released to the wrong beneficiary reconciles perfectly, and so does a payment released without the required secondary review. The control is well designed for the risk it addresses and is simply not addressing this one.",
  },
  {
    id: "CTL-PAY-003",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-003",
    title: "Automated format, IBAN and BIC validation at the payment gateway",
    titleDe: "Automatisierte Format- und IBAN-BIC-Validierung",
    description:
      "Every payment instruction accepted into the Arcadia Payment Hub is passed to the Novalink Gateway for format validation against the applicable message scheme, IBAN and BIC reachability validation, and enrichment from the clearing directories. Instructions that fail are assigned a validation failure reason code from R01 to R08 and routed to the repair queue rather than to clearing. This control is the reason the repair queue exists, and the reason the queue is the safe outcome rather than the failure outcome.",
    riskIds: ["RSK-0211", "RSK-0215"],
    processIds: ["PRC-0042"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    nature: "preventive",
    automation: "automated",
    frequency: "per occurrence",
    isKeyControl: true,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-02T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "The control is performed by a provider system, and it is not performed at all on the secondary clearing route. The Arcadia Direct Link performs no payment data validation, so instructions the gateway would have enriched or corrected reach the repair queue carrying R01, R02, R04 or R08 whenever the fallback route is active. The control is effective when it runs. The design question is that nothing in the fallback runbook records that it stops running.",
  },
  {
    id: "CTL-PAY-006",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-006",
    title: "Segregation of duties in RepairDesk role assignment",
    titleDe: "Funktionstrennung bei Rollenzuweisung in RepairDesk",
    description:
      "Role assignments in Novalink RepairDesk are maintained so that no individual holds both the Repair Analyst role, which creates override records, and the Secondary Reviewer role, which approves them. Assignments are reviewed quarterly by the control owner against the current team roster and any combination that would permit self-review is removed.",
    riskIds: ["RSK-0211"],
    processIds: ["PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-008",
    nature: "preventive",
    automation: "it-dependent-manual",
    frequency: "quarterly review, with maintenance on each role change",
    isKeyControl: true,
    currentEffectiveness: "not-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-25T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    lastTestedOn: "2026-09-25",
    designNote:
      "A periodic review in a system that does not enforce the separation it reviews. RepairDesk permits an individual holding both role assignments to approve an override that the same individual created, which is the failure recorded as EXC-TST-2026-0318-01 on 14.07.2026 on a value of EUR 84,300. Remediation action MSN-2026-0147, raised from internal audit finding AUD-2025-09-F3 issued 28.11.2025 to implement enforcement in the system, is 67 days past a revised due date of 31.07.2026. The exception occurred 17 days before that due date. Novalink change request NOVA-CR-4412 was delivered to pre-production on 18.09.2026 and Arcadia acceptance testing is not scheduled, because the payment test environment refresh is blocked by an unrelated infrastructure change freeze running to 14.10.2026.",
  },
  {
    id: "CTL-PAY-008",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-008",
    title: "Duplicate payment detection and analyst confirmation",
    titleDe: "Erkennung und Bestaetigung von Doppelzahlungsverdacht",
    description:
      "The Arcadia Payment Hub flags an instruction as a duplicate suspicion where it matches a prior instruction on counterparty, amount, currency, value date and reference within the detection window, and assigns reason code R05. The instruction is held and may be released only after an analyst has compared it against the identified prior instruction and recorded the basis on which it is not a duplicate.",
    riskIds: ["RSK-0214"],
    processIds: ["PRC-0041", "PRC-0042"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-008",
    nature: "preventive",
    automation: "it-dependent-manual",
    frequency: "per occurrence",
    isKeyControl: true,
    currentEffectiveness: "fully-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-02T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "Tested in the June 2026 cycle with no deviation. R05 accounted for 8 percent of the September 2026 repair queue and no item reached release without a recorded analyst comparison. Held in this dataset because a genuinely fully effective key control on the same process is the evidence that the assessment movements elsewhere are specific findings rather than a general downgrade of the unit. Scenario figures.",
  },
  {
    id: "CTL-PAY-011",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-011",
    title: "Payment release authority matrix and system value limits",
    titleDe: "Freigabekompetenzmatrix und Betragsgrenzen",
    description:
      "Release authority for corporate payment instructions is assigned by role and value band in the Arcadia Payment Hub, and the system rejects a release attempt by a user whose authority does not cover the value of the instruction. The matrix is approved by the Head of Payment Operations and reviewed annually and on any change to the team structure.",
    riskIds: ["RSK-0211"],
    processIds: ["PRC-0041", "PRC-0043"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    nature: "preventive",
    automation: "automated",
    frequency: "per occurrence, with annual matrix review",
    isKeyControl: true,
    currentEffectiveness: "fully-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-02T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "The authority matrix governs who may release. It does not govern whether a second person reviewed the override that made the release possible, and it holds no value threshold below which review is waived. The distinction matters, because the first line has at times described the value limits as a substitute for review on low-value items. They are not: the waiver in RD-RULE-0031 is a separate mechanism with a separate origin and a separate threshold.",
  },
  {
    id: "CTL-PAY-017",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-017",
    title: "Daily override log review and reason code completeness check",
    titleDe: "Taegliche Durchsicht des Ueberschreibungsprotokolls",
    description:
      "Each business day the Payment Repair Team Lead reviews the complete override log for the previous day and confirms that every record carries an override reason code from OVR-A to OVR-E, the identifiers of the suppressed validation rules, the validation failure reason codes present on the instruction, and the rule evaluation trace. Records with a missing mandatory field are referred back to the creating analyst for completion on the day of review.",
    riskIds: ["RSK-0211", "RSK-0262"],
    processIds: ["PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-008",
    nature: "detective",
    automation: "manual",
    frequency: "daily",
    isKeyControl: false,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-02T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "The review covers field completeness and not the substance of the rule evaluation trace. A record showing that RD-RULE-0031 fired and waived secondary review is a complete record, and the control passes it. Completeness checks pass the very records that most need attention, because a waiver applied by a rule is always perfectly well formed.",
  },
  {
    id: "CTL-PAY-023",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-023",
    title: "Cross-border regulatory reporting data completeness check",
    titleDe: "Vollstaendigkeitspruefung der Meldedaten bei grenzueberschreitenden Zahlungen",
    description:
      "Cross-border payment instructions with a value above EUR 12,500 are checked for the presence and format of the required regulatory reporting data before submission and are assigned reason code R02 where the data is missing or malformed. Where an instruction is released under reason code OVR-D with the data incomplete, an open item is raised and the data must be completed within one business day of release.",
    riskIds: ["RSK-0213"],
    processIds: ["PRC-0042", "PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT],
    ownerUserId: "P-007",
    nature: "preventive",
    automation: "automated",
    frequency: "per occurrence",
    isKeyControl: false,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-02T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "The detection step is automated and reliable. The completion step after an OVR-D release is manual and carries no system-enforced deadline, so the one business day commitment depends on an open item list that nobody reconciles. OVR-D releases rose from 94 in August 2026 to 211 in September 2026, which more than doubles the population that manual step has to clear.",
  },
  {
    id: "CTL-PAY-026",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-026",
    title: "Dual authorisation of client static data changes",
    titleDe: "Doppelunterschrift bei Aenderung von Kundenstammdaten",
    description:
      "A change to a client account, mandate or beneficiary record in the Client Static Data Master is entered by one authorised user and released by a second authorised user who did not enter it. The system will not activate the change until the second authorisation is recorded, and both identities and timestamps are retained with the record.",
    riskIds: ["RSK-0215"],
    processIds: ["PRC-0045"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-007",
    nature: "preventive",
    automation: "it-dependent-manual",
    frequency: "per occurrence",
    isKeyControl: true,
    currentEffectiveness: "fully-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-02T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "This is the control CTL-PAY-014 was intended to mirror, and the comparison is instructive. Both are four-eyes controls on a payment-critical action. The static data system refuses to activate a change until the second authorisation exists, so the gate cannot be waived by configuration. The override system evaluates a client-configurable rule to decide whether the gate applies at all. Same control concept, two different enforcement architectures, one of which cannot be switched off from a template.",
  },
  {
    id: "CTL-PAY-031",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-031",
    title: "Value-date cut-off monitoring and escalation",
    titleDe: "Ueberwachung und Eskalation der Valuta-Annahmeschlusszeiten",
    description:
      "Instructions accepted for same-day value are monitored against the cut-off for their clearing route through the business day. Items still unresolved at the defined warning point before cut-off are listed for the Duty Manager, who decides whether to prioritise repair, release under an override, return the instruction to the client or roll it to the next value date, and records the decision against the instruction.",
    riskIds: ["RSK-0212"],
    processIds: ["PRC-0041", "PRC-0043"],
    entityIds: [ENTITY_DE, ENTITY_AT],
    ownerUserId: "P-007",
    nature: "detective",
    automation: "it-dependent-manual",
    frequency: "continuous through the business day",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-25T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-09-25",
    designNote:
      "The control creates the pressure it monitors. It surfaces items approaching a cut-off and offers release under override as one of four responses, with no constraint on choosing that response when no reviewer is available. EXC-TST-2026-0318-02 on 06.08.2026, a value of EUR 1,215,000 and the highest value item in the exception set, was released at 16:47:12 with the secondary review recorded at 16:58:31, eleven minutes and nineteen seconds after release. A preventive control that operates after the event is not preventive, and the monitoring control that produced the urgency holds no block on release.",
  },
  {
    id: "CTL-PAY-034",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-034",
    title: "Authorisation of clearing route substitution",
    titleDe: "Autorisierung des Clearingwegwechsels",
    description:
      "Activation of the secondary clearing route is authorised only by the Duty Manager, Payment Operations or the Head of Payment Operations, following runbook RB-PAY-007 version 3.1 dated 09.02.2026. The authorising individual, the time of activation, the queues affected and the trigger are recorded, and the same authority is required to return the queues to the primary route.",
    riskIds: ["RSK-0212", "RSK-0302", "RSK-0261"],
    processIds: ["PRC-0043"],
    entityIds: [ENTITY_DE, ENTITY_AT],
    ownerUserId: "P-007",
    nature: "preventive",
    automation: "manual",
    frequency: "per occurrence",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-25T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "The authorisation step operates as designed: each of the five September 2026 activations carries a named authoriser and a time. The deficiency is in what the authoriser is told. RB-PAY-007 states that repair volume will increase materially without quantifying it, does not mention RD-RULE-0031, and section 4 states that the control environment is unchanged during fallback operation. That statement is factually wrong. A documented control assertion that is wrong is a finding rather than an omission, and its practical effect is that the person with the authority to activate the route is not informed that activating it removes a four-eyes gate.",
  },
  {
    id: "CTL-PAY-037",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-037",
    title: "Confirmation of Swiss submission completion before the same-day cut-off",
    titleDe: "Bestaetigung der Einlieferung vor dem taggleichen Annahmeschluss",
    description:
      "Each business day the Zurich payment team confirms that all Swiss franc and euroSIC instructions accepted for same-day value have been submitted and acknowledged before the 16:00 CET cut-off, and records the completion time. Where completion is at risk, the decision to prepare manual submission through a correspondent bank under runbook RB-PAY-011 must be taken at least 45 minutes before the cut-off.",
    riskIds: ["RSK-0216", "RSK-0301"],
    processIds: ["PRC-0046"],
    entityIds: [ENTITY_CH],
    ownerUserId: "P-015",
    nature: "detective",
    automation: "it-dependent-manual",
    frequency: "daily",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-17T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "The confirmation step is reliable. The decision step is not supported. The only fallback available to the Swiss entity requires 45 minutes of preparation and there is no automated alternative route, so the decision to invoke it has to be taken before the outcome it protects against is known. Impact tolerance ITOL-0004-03 carries two measures, elapsed disruption time and completion against the cut-off, with no stated precedence between them, so the control cannot report a single tolerance position even when it operates perfectly.",
  },
  {
    id: "CTL-PAY-041",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-041",
    title: "Monthly override trend and reason code component review",
    titleDe: "Monatliche Trendauswertung der Ueberschreibungen",
    description:
      "Each month the control owner reviews the manual override rate for the reporting entity against its indicator thresholds, records an explanation for any movement outside the green band, and submits the explanation with the monthly operations pack to the Head of Payment Operations and the Operational Risk Partner.",
    riskIds: ["RSK-0211", "RSK-0371"],
    processIds: ["PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-008",
    nature: "detective",
    automation: "manual",
    frequency: "monthly",
    isKeyControl: false,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-25T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "The standard monthly pack carries the aggregate override rate and not the split by reason code. The aggregate moved from 2.20 to 3.84 overrides per 10,000 instructions, which the review captured. The component split, in which OVR-C route substitution grew from 31 to 198 and OVR-D cut-off driven release from 94 to 211, is available in the underlying data and is not in the pack. A reviewer reading the pack sees that overrides rose. A reviewer reading the components sees that the primary clearing route was unavailable more often and that more payments were released against a cut-off with incomplete data, which is a different finding with a different owner and a different remedy.",
  },
  {
    id: "CTL-PAY-044",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-044",
    title: "Secondary reviewer establishment and roster monitoring",
    titleDe: "Ueberwachung des Sollbestands an Zweitpruefern",
    description:
      "Each month the Head of Payment Operations reviews the filled secondary reviewer establishment against the approved establishment for the Munich repair team, confirms that the daily roster provides reviewer cover across the full operating window of 06:00 to 19:00 CET, and records a recruitment or cover plan where the establishment is not fully filled.",
    riskIds: ["RSK-0371", "RSK-0211"],
    processIds: ["PRC-0041"],
    entityIds: [ENTITY_DE],
    ownerUserId: "P-007",
    nature: "preventive",
    automation: "manual",
    frequency: "monthly",
    isKeyControl: false,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-30T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "The monitoring limb operates: the position is known and reported monthly, and the indicator has read 75.0 percent of approved establishment since 01.08.2026. The planning limb does not. Position PR-SR-02 has been vacant since Tomas Nowak resigned on 31.07.2026. Remediation action MSN-2026-0166 to recruit to the position passed its due date of 30.09.2026 with two candidate rejections and no start date, and no compensating cover arrangement has been recorded. Reporting a gap every month without a dated plan to close it is monitoring, not control. Scenario figures.",
  },
  {
    id: "CTL-TPR-002",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-TPR-002",
    title: "Criticality determination and tiering on third-party onboarding",
    titleDe: "Kritikalitaetsbestimmung und Einstufung bei Aufnahme",
    description:
      "Before a third-party arrangement is signed, Group Third-Party Risk Management determines whether the arrangement supports a critical or important function or a significant business process, assigns a criticality tier from 1 to 4 against the substitutability criteria in the Group Third-Party Risk Policy, and records the determination with the evidence on which it rests. The tier drives the reassessment frequency and the contractual requirements.",
    riskIds: ["RSK-0184", "RSK-0186"],
    processIds: ["PRC-0052"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    nature: "preventive",
    automation: "manual",
    frequency: "per arrangement, at onboarding and on material change",
    isKeyControl: true,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-20T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "Tiering is performed per arrangement and not per concentration. A provider supplying three separate services across payment validation, repair and Swiss clearing is tiered three times and never once as the single dependency it actually is. Each individual determination is correct and the aggregate exposure appears nowhere in the record.",
  },
  {
    /*
     * The register itself, treated as a control rather than as a database.
     * CTL-TPR-002 decides the tier at onboarding and CTL-TPR-011 reconciles
     * the subprocessor list each quarter; this control is what keeps the
     * record between those two events true, and it is the control every
     * regulatory completeness question is ultimately answered from. It is
     * rated partially effective on the preliminary result of TST-2026-0294.
     */
    id: "CTL-TPR-006",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-TPR-006",
    title: "Maintenance and completeness of the third-party register and its subcontracting chain",
    titleDe: "Pflege und Vollstaendigkeit des Drittparteienverzeichnisses und der Unterauftragskette",
    description:
      "The third-party register holds, for every arrangement, a current and approved criticality tier, the services the arrangement supports, and the subcontracting chain down to the entity that actually performs the service, with the country from which each entity performs and the categories of data it is able to access. A record is updated on every change to the arrangement, on every change of criticality tier and on every notified or identified subprocessor change, and the completeness of the chain fields on Tier 1 arrangements is confirmed by the Category Lead each quarter.",
    riskIds: ["RSK-0185", "RSK-0184", "RSK-0186"],
    processIds: ["PRC-0052", "PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    nature: "preventive",
    automation: "it-dependent-manual",
    frequency: "on every change to an arrangement, with quarterly confirmation for Tier 1",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-24T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    lastTestedOn: "2026-07-24",
    designNote:
      "TST-2026-0294 examined 15 of 38 suppliers on a judgemental selection and reported 12 registers reconciling and 3 not, in every case because the provider's own current register names entities the binding appendix does not. Third-Party Risk Management accepted the preliminary result. Two separate weaknesses sit behind it. The first is resolvable and is not the control's fault: on TP-0042 the appendix version in force is itself contested, which is a legal determination held by Outsourcing Counsel under MSN-2026-0191 with a date of 13.11.2026, and the register cannot record a subprocessor the bank has not approved. The second is structural. The register holds one row per arrangement and its chain fields stop at the subprocessor tier, so a fourth party that retains data arising from the service has nowhere to be recorded at all. That is not an incomplete field, it is an absent field, and no quarterly confirmation can detect it. The indicator for complete and current subprocessor records on Tier 1 arrangements moved from amber into red in the September 2026 run. Scenario figures.",
  },
  {
    id: "CTL-TPR-007",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-TPR-007",
    title: "Annual reassessment of Tier 1 third parties",
    titleDe: "Jaehrliche Neubewertung von Drittparteien der Stufe 1",
    description:
      "Each Tier 1 third-party arrangement is reassessed annually against the current Group Third-Party Risk Policy requirements, covering financial standing, resilience and continuity arrangements, information security, subprocessor and fourth-party transparency, contractual audit and access rights, and exit and substitutability. Findings are raised as remediation actions with named owners and dates, and the reassessment closes only when the conclusion has been recorded by the relationship owner.",
    riskIds: ["RSK-0184", "RSK-0185", "RSK-0186"],
    processIds: ["PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    nature: "detective",
    automation: "manual",
    frequency: "annual",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-20T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "The 2026 reassessment of the Tier 1 payment provider is in progress against a cycle deadline of 31.10.2026, with findings open as MSN-2026-0188, MSN-2026-0191 and MSN-2026-0177. The reassessment examines the provider. It does not examine what the provider's standard configuration templates do to Arcadia's control descriptions once deployed into the Arcadia tenant, and that route is precisely how the design deficiency in CTL-PAY-014 arrived.",
  },
  {
    id: "CTL-TPR-011",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-TPR-011",
    title: "Subprocessor register reconciliation against the binding contract appendix",
    titleDe: "Abstimmung des Unterauftragnehmerverzeichnisses gegen die Vertragsanlage",
    description:
      "Each quarter the subprocessor list submitted by the provider is reconciled line by line against the subprocessor appendix that is contractually binding, and every difference is classified as an addition, a removal or a change of domicile or function. Differences affecting a subprocessor that supports a critical function are notified to Group Third-Party Risk Management, Outsourcing Counsel and the Category Lead, and are pursued as a contract variation.",
    riskIds: ["RSK-0185"],
    processIds: ["PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    nature: "detective",
    automation: "manual",
    frequency: "quarterly",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-20T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "The reconciliation is performed and it does identify differences. What it cannot do is resolve which version of the appendix is binding, which is a legal determination sitting with Outsourcing Counsel and the reason MSN-2026-0191 is open at 40 percent with a date of 13.11.2026. The indicator for complete and current subprocessor records on Tier 1 arrangements moved from amber into red in September 2026, so the control is detecting a position that is getting worse rather than holding it. Scenario figures.",
  },
  {
    id: "CTL-TPR-015",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-TPR-015",
    title: "Supplier service level monitoring and notification review",
    titleDe: "Ueberwachung der Dienstleistungsguete und Durchsicht von Stoerungsmeldungen",
    description:
      "Monthly service reporting from each Tier 1 provider is reviewed against the availability and performance commitments in the applicable service schedule, service notifications received in the month are reconciled against the internally recorded degradation events, and any shortfall against a commitment is raised with the relationship owner and the Category Lead for contractual follow-up.",
    riskIds: ["RSK-0184", "RSK-0302"],
    processIds: ["PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    nature: "detective",
    automation: "it-dependent-manual",
    frequency: "monthly",
    isKeyControl: false,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-20T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "The control depends on a notification that did not arrive. The payment gateway carries a contracted availability commitment of 99.7 percent monthly excluding planned maintenance. September 2026 actual was 99.62 percent, a shortfall the provider has not reported and that Arcadia identified by calculating the figure from its own degradation records. A monitoring control whose only input is supplied by the party being monitored is a reconciliation control, or it is nothing. Scenario figures.",
  },
  {
    id: "CTL-TPR-019",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-TPR-019",
    title: "Exit and substitutability plan maintenance and testing for Tier 1 services",
    titleDe: "Pflege und Test von Ausstiegs- und Substitutionsplaenen",
    description:
      "Each Tier 1 service supporting a critical or important function holds a documented exit and substitutability plan naming the substitute arrangement, the elapsed time to substitute, the data and process migration steps and the control environment that applies during substitution. The plan is reviewed annually and is exercised by an exit or substitutability test at the frequency set by the Group Third-Party Risk Policy.",
    riskIds: ["RSK-0186", "RSK-0184"],
    processIds: ["PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    nature: "preventive",
    automation: "manual",
    frequency: "annual review, with testing on the policy cycle",
    isKeyControl: true,
    currentEffectiveness: "not-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-20T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    designNote:
      "The plan exists and has never been exercised. MSN-2026-0177, the exit and substitutability test for the repair and override workbench service, is not started and has no plan to start, and it is a stated condition of the conditional Risikoakzeptanz of 19.01.2026 that holds RSK-0184 outside appetite to 31.12.2026. An untested plan may not be credited in a residual assessment. The control is recorded as not effective rather than not tested, because the maintenance limb did operate and what it produced is a document asserting a capability nobody has demonstrated.",
  },
  {
    /*
     * This is the control that would have prevented the CTL-PAY-014 design
     * deficiency from ever existing. It has never been tested, which is why its
     * failure had to be found 23 months later by a test of the control it was
     * supposed to protect.
     */
    id: "CTL-TPR-028",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-TPR-028",
    title: "Review of supplier change and release notifications before tenant deployment",
    titleDe: "Durchsicht von Aenderungs- und Releasemitteilungen des Dienstleisters",
    description:
      "Before a provider release is deployed into an Arcadia tenant, the release notification and the associated configuration changes are reviewed by the accountable Arcadia system owner and by the owner of every control that depends on the system, and the Arcadia change record captures the review and the control impact assessment. A release that alters a condition enforced by a key control may not be deployed until the control owner has signed off and the control description has been updated.",
    riskIds: ["RSK-0261", "RSK-0332", "RSK-0184"],
    processIds: ["PRC-0053", "PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    nature: "preventive",
    automation: "manual",
    frequency: "per supplier release",
    isKeyControl: true,
    currentEffectiveness: "not-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-25T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    designNote:
      "Change CHG-2024-5512, which deployed RepairDesk release 8.3 to the arcadia-prod tenant on 11.11.2024, was approved on the basis of provider release notes referencing continuity throughput improvements for fallback routing. The configuration applied from the provider's standard template was not read. No control owner was asked. No control impact assessment was recorded. The control has never been independently tested, so the register carried it as operating while the single change it existed to catch went through unexamined.",
  },
  {
    id: "CTL-TPR-023",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-TPR-023",
    title: "Verification of contractual audit, access and exit rights",
    titleDe: "Pruefung der vertraglichen Pruef-, Zugangs- und Ausstiegsrechte",
    description:
      "For every arrangement supporting a critical or important function, Outsourcing Counsel and Group Third-Party Risk Management confirm that the contract secures audit and access rights extending to subprocessors, resilience and continuity obligations, service level commitments with reporting duties, and exit assistance provisions with a stated notice period. The verification is repeated on every contract variation and on every change of criticality tier.",
    riskIds: ["RSK-0186", "RSK-0184", "RSK-0185"],
    processIds: ["PRC-0052", "PRC-0053"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-002",
    nature: "preventive",
    automation: "manual",
    frequency: "at contracting, and on every contract variation",
    isKeyControl: true,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-20T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "Rights are secured in the contract and the verification confirms that they are. What the control does not test is whether the rights can be exercised in practice, and the two are not the same thing. Audit and access rights over a subprocessor are of no use where the binding subprocessor appendix and the provider's current register do not agree on which entity performs the function, which is the unresolved position on the Tier 1 payment provider and the reason MSN-2026-0191 is open.",
  },
  {
    /*
     * The arrangement, not the programme. CTL-RES-009 runs the severe but
     * plausible scenario testing programme; this control is the requirement
     * that each important business service actually holds a substitute route
     * and has exercised it. It is rated not effective on the concluded result
     * of TST-2026-0302, which tested the full population of eleven services.
     */
    id: "CTL-RES-003",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-RES-003",
    title: "Fallback and substitution arrangements for important business services, maintained and exercised",
    titleDe: "Ausweich- und Substitutionsvorkehrungen fuer wichtige Geschaeftsprozesse, gepflegt und geuebt",
    description:
      "Each important business service holds a documented fallback or substitution arrangement stating the alternative route or provider, the authority to invoke it, the elapsed time to invoke it and the control environment that applies while it is active. The arrangement is exercised on the frequency set by the Group Operational Resilience Policy, the exercise measures restoration against the impact tolerance approved for that service, and the evidence of the exercise is retained and postdates the last material change to the service, to its provider or to its clearing arrangements.",
    riskIds: ["RSK-0302", "RSK-0301"],
    processIds: ["PRC-0061", "PRC-0043"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-005",
    nature: "preventive",
    automation: "manual",
    frequency: "annual review per important business service, with exercise on the policy cycle",
    isKeyControl: true,
    currentEffectiveness: "not-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-08-07T09:00:00.000Z",
    firstLineEffectiveness: "not-effective",
    lastTestedOn: "2026-08-07",
    designNote:
      "Rated not effective on 07.08.2026 and accepted at that rating by Resilience, which is worth recording because an agreed adverse rating is rarer than a disputed one. TST-2026-0302 tested the full population of 11 important business services and nothing is projected: 2 hold no fallback test evidence at all, 4 hold evidence predating the last material change to the service or its provider, and 1 holds a measured restoration time that exceeds its own impact tolerance with no escalation on record. Corporate Payments is in the untested set on the euro side, where the clearing fallback has been invoked in production and never exercised under observation, and it has no fallback arrangement at all on the Swiss side, where the manual correspondent route has never been rehearsed. The control's maintenance limb operates and its exercise limb does not, which produces documents asserting capabilities nobody has demonstrated. The indicator for important business services with tested fallback arrangements has stood below its red threshold since June 2026. Scenario figures.",
  },
  {
    id: "CTL-RES-004",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-RES-004",
    title: "Impact tolerance setting and periodic approval",
    titleDe: "Festlegung und Genehmigung von Toleranzschwellen",
    description:
      "Each important business service holds board-approved impact tolerances expressing the maximum disruption the entity is willing to tolerate, stated as a measure with a threshold and a method of measurement. Tolerances are reviewed at least annually by the approving committee and on any material change to the service, its dependencies or its clearing arrangements.",
    riskIds: ["RSK-0301"],
    processIds: ["PRC-0061"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-005",
    nature: "preventive",
    automation: "manual",
    frequency: "annual, and on material service change",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-21T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "Tolerances are set, approved and reviewed on schedule, with the euro entity tolerances last reviewed on 11.03.2026 and the Swiss tolerance on 24.02.2026. The deficiency is in what was approved. ITOL-0004-03 carries two measures, elapsed disruption time and submission completion against the 16:00 CET cut-off, with no stated precedence between them. The two measures can diverge, and when they diverge the entity cannot state whether it breached its own tolerance. This control approved a tolerance that cannot be evaluated, which is a more valuable finding than most incidents and considerably less dramatic.",
  },
  {
    id: "CTL-RES-009",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-RES-009",
    title: "Scenario testing of severe but plausible disruption",
    titleDe: "Szenariotests schwerer aber plausibler Stoerungen",
    description:
      "Each important business service is tested at least annually against severe but plausible disruption scenarios covering the loss of a critical provider, the loss of a clearing route and the loss of a primary operating location. The test measures the result against the approved impact tolerances and records the control environment that applied during the simulated disruption.",
    riskIds: ["RSK-0302", "RSK-0301"],
    processIds: ["PRC-0061"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-005",
    nature: "detective",
    automation: "manual",
    frequency: "annual per important business service",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-21T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    lastTestedOn: "2026-03-20",
    designNote:
      "The share of important business services with tested fallback arrangements has been below the red threshold since June 2026 at 78 percent. For Corporate Payments the euro clearing fallback was exercised in production five times in September 2026 and has never been the subject of a scenario test that examined the control environment in the fallback state. Real activations are not tests: nobody records the control position during an activation, and the control position during fallback is exactly the observation a test is designed to produce. Scenario figures.",
  },
  {
    id: "CTL-RES-013",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-RES-013",
    title: "Incident severity classification and escalation",
    titleDe: "Einstufung und Eskalation von Vorfaellen",
    description:
      "Every operational incident is assigned a severity on the S1 to S4 scale at detection and on every material change of facts, and escalation follows the notification map for the assigned severity. Severity S1 applies where an impact tolerance for an important business service is breached or within 60 minutes of breach, where a zero-tolerance control condition has candidate breaches, or where client funds are at risk.",
    riskIds: ["RSK-0301"],
    processIds: ["PRC-0062"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-005",
    nature: "preventive",
    automation: "it-dependent-manual",
    frequency: "per occurrence",
    isKeyControl: true,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-21T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "Classification is timely and the escalation map is followed. The gap sits upstream of the control: a service degradation handled inside the payment operations team without an incident record never reaches it. The five fallback activations in September 2026, totalling 8 hours 40 minutes, were treated as operational events below the incident threshold, so none was classified, none was escalated, and none appears in incident reporting to the committee.",
  },
  {
    id: "CTL-GOV-005",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-GOV-005",
    title: "Remediation action tracking, extension approval and overdue escalation",
    titleDe: "Nachverfolgung und Eskalation ueberfaelliger Massnahmen",
    description:
      "Remediation actions are recorded in the group GRC platform with an accountable owner, a delegate where applicable, an original due date and any revised due date with the approving body and the date of approval. Overdue actions are reported monthly, and an action more than 60 days past a revised due date is reported to the NFR Committee with a named accountable executive and a recommendation either to re-baseline with a root-cause explanation or to escalate to the entity board.",
    riskIds: ["RSK-0331"],
    processIds: ["PRC-0082"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-001",
    nature: "detective",
    automation: "it-dependent-manual",
    frequency: "monthly",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-23T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "Tracking and reporting operate accurately: seven actions were overdue at group level as at 06.10.2026, of which two relate to Corporate Payments, and the position is reported monthly. The escalation limb is where the control weakens. MSN-2026-0147 is 67 days past a revised due date of 31.07.2026 that had already been extended once by the NFR Committee on 14.04.2026, and the escalation the 60 day rule requires has not yet produced either a re-baseline with a root cause or a board referral. The control reports the number. It does not force the consequence the framework attaches to the number.",
  },
  {
    /*
     * The consequence limb, separated from the reporting limb on purpose.
     * CTL-GOV-005 records, extends and reports overdue actions accurately.
     * This control is the step the framework attaches to the number, and
     * splitting them is what makes it possible to say that one works and the
     * other does not.
     */
    id: "CTL-GOV-009",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-GOV-009",
    title: "Committee escalation of a remediation action past a revised due date, with a named accountable executive",
    titleDe: "Eskalation ueberfaelliger Massnahmen an das Gremium mit benannter verantwortlicher Fuehrungskraft",
    description:
      "Where a remediation action passes a revised due date, it is escalated to the NFR Committee within the period the Group Operational Risk Policy requires. The escalation names the accountable executive personally rather than presenting the action inside an aggregate count, states why the revised date was missed, and the committee record shows either a re-baseline with a stated root cause or a referral to the entity board. The escalation is repeated at each subsequent committee until the action closes or the referral is made.",
    riskIds: ["RSK-0331", "RSK-0332"],
    processIds: ["PRC-0082"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-001",
    nature: "detective",
    automation: "manual",
    frequency: "per action passing a revised due date, on the monthly committee cycle",
    isKeyControl: true,
    currentEffectiveness: "partially-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-18T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-09-18",
    designNote:
      "TST-2026-0311 drew 20 of the 42 actions that passed a revised due date between 01.04.2026 and 31.08.2026 and found 18 escalated within the required period. The two that were not are the two oldest in the sample, and both appeared in the committee pack inside an aggregate count with no named accountable executive. One of them is MSN-2026-0147, which is 67 days past a revised due date of 31.07.2026 that the NFR Committee had already extended once on 14.04.2026, and which has produced neither a re-baseline with a root cause nor a board referral. The mechanism is the pack template: it permits an overdue action to be rendered as a number, and a number has no owner. Governance accepted the finding and is changing the template for the October cycle, so the deficiency has a dated fix and the fix has not yet been made. Escalating is not the control objective; naming the person who owns the delay is.",
  },
  {
    id: "CTL-GOV-012",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-GOV-012",
    title: "Independent control testing programme in the Internal Control System",
    titleDe: "Unabhaengiges Kontrolltestprogramm im internen Kontrollsystem",
    description:
      "Group Control Assurance performs independent design and operating effectiveness testing of key controls on an annual cycle per control, using attribute sampling with a stated population, sample size, sampling method, tolerable deviation rate and expected deviation rate. Exceptions and items on which the tester cannot conclude are recorded separately, each deviation is assigned a root cause category and an owner, and the conclusion is reported on the second line effectiveness scale.",
    riskIds: ["RSK-0332", "RSK-0262"],
    processIds: ["PRC-0081"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-004",
    nature: "detective",
    automation: "manual",
    frequency: "annual per key control",
    isKeyControl: true,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-23T09:00:00.000Z",
    firstLineEffectiveness: "largely-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "The testing limb of this control worked and the follow-up limb did not, and that distinction is the uncomfortable finding of the scenario. EXC-TST-2026-0318-04 on 27.08.2026 recorded that no secondary review existed because RD-RULE-0031 had fired with a review waiver while the fallback route was active. The root cause was recorded as system configuration, no further investigation was performed, and no remediation action was raised against the rule itself. The finding was correct, complete and closed. It named the exact mechanism, 41 days before that mechanism was needed. Identifying a deficiency is not the control objective; pursuing it to a root cause with an owner and a date is.",
  },
  {
    id: "CTL-GOV-016",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-GOV-016",
    title: "Periodic review and version control of key control descriptions",
    titleDe: "Jaehrliche Durchsicht und Versionierung von Kontrollbeschreibungen",
    description:
      "The recorded description of every key control in the Internal Control System is reviewed at least annually by its control owner, and on every change to the system, process or configuration that affects the conditions the control enforces. The review confirms that the description states what the system actually enforces, and each approved change produces a new version with a date and an approver.",
    riskIds: ["RSK-0332", "RSK-0261"],
    processIds: ["PRC-0081", "PRC-0082"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-001",
    nature: "preventive",
    automation: "manual",
    frequency: "annual, and on every change affecting an enforced condition",
    isKeyControl: true,
    currentEffectiveness: "not-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-25T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    lastTestedOn: "2026-09-25",
    designNote:
      "Version control operates; periodic review does not. CTL-PAY-014 stands at version 4.1 dated 14.01.2025, which is 20 months before the scenario day and two months after RD-RULE-0031 entered the arcadia-prod tenant. The description says review is required for all overrides without exception while the system waives it under four stated conditions, and the annual review that should have caught that has not been performed since. MSN-2026-0203, raised on 25.09.2026 to update the description, is recorded as a low-priority documentation item and is not started. It is not a documentation item. It is the disclosure of a design deficiency in a key control.",
  },
  {
    id: "CTL-GOV-021",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-GOV-021",
    title: "Retention and retrievability of key control evidence",
    titleDe: "Aufbewahrung und Abrufbarkeit von Kontrollnachweisen",
    description:
      "Evidence of the operation of a key control is retained for the full assurance retention period and is retrievable on request, including where the evidence is generated or held in a provider system. Where a control operates in a provider system, the retention period and the identity recorded against the control action are confirmed against the contractual requirement before the arrangement is relied upon for assurance.",
    riskIds: ["RSK-0262"],
    processIds: ["PRC-0081", "PRC-0041"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-004",
    nature: "preventive",
    automation: "it-dependent-manual",
    frequency: "per occurrence, with annual confirmation per provider system",
    isKeyControl: true,
    currentEffectiveness: "not-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-25T09:00:00.000Z",
    firstLineEffectiveness: "partially-effective",
    lastTestedOn: "2026-09-25",
    designNote:
      "Two failures in one test, both caused by provider design choices that Arcadia accepted without examining. UTC-TST-2026-0318-01 on 02.07.2026, a value of EUR 233,800, records the secondary reviewer as svc_repairbatch, a provider service account written whenever a review is submitted through the bulk approval screen. The human identity sits in an application log with 30 day retention that had expired before the question was asked, so the evidence is permanently gone. UTC-TST-2026-0318-02 on 21.08.2026 has a named human reviewer and a broken evidence link after a provider retention job moved the object on 01.09.2026. The first is the more serious despite the smaller profile, because the bulk approval screen is used routinely rather than exceptionally, and the control owner cannot fix either failure alone.",
  },
  {
    /*
     * The only control in the set rated on a scope limitation rather than on
     * a deviation. TST-2026-0325 tested the full population of 27 items and
     * found no deviations, and the conclusion still carries a limitation on
     * its face: the control tests whether a decision was recorded and
     * reasoned, not whether it was right. That is why the register holds
     * largely effective and not fully effective on a clean test.
     */
    id: "CTL-REG-004",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-REG-004",
    title: "Recording of a per-entity applicability decision on every regulatory change item",
    titleDe: "Erfassung der Anwendbarkeitsentscheidung je Rechtseinheit zu jedem regulatorischen Aenderungsvorhaben",
    description:
      "Every regulatory change item on the register carries an applicability decision for each legal entity within the scope of the scan, the identity of the person who made it, the date it was made, and a written rationale. Where an item is determined not applicable to an entity, the rationale states the framework that governs that entity instead rather than asserting non-applicability, and no decision is inherited from another entity or taken once at group level. An item is not closed to implementation planning until every entity in scope carries a decision. Illustrative regulatory context, not legal advice.",
    riskIds: ["RSK-0351"],
    processIds: ["PRC-0071"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-006",
    nature: "preventive",
    automation: "it-dependent-manual",
    frequency: "per regulatory change item, before the next scheduled committee reporting date",
    isKeyControl: true,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-09-25T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-09-25",
    designNote:
      "All 27 items that reached an applicability decision between 01.05.2026 and 31.08.2026 carry a per-entity decision with a named decision maker and a written rationale, including 9 where the Swiss position differs from the two EU entities and the difference is argued rather than stated. No deviations. The rating sits below fully effective on two scope limitations that Regulatory Change asked to travel with the conclusion wherever it is quoted. The first is what the control tests: a wrong decision recorded well passes it, so a clean result is evidence of discipline and not of correctness. The second is the unit of decision. Applicability is recorded at item level while implementation happens at obligation level, so an instrument that applies in part to an entity carries one decision for a set of obligations that do not share it, and the register cannot show which obligation the decision was actually about. Illustrative regulatory context, not legal advice.",
  },
  {
    id: "CTL-REG-006",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-REG-006",
    title: "Regulatory horizon scanning and per-entity impact assessment",
    titleDe: "Regulatorische Fruehaufklaerung und Auswirkungsanalyse",
    description:
      "Group Compliance performs monthly horizon scanning across the regulatory sources applicable to the group, records each identified publication as a regulatory change item, determines applicability separately for each legal entity, decomposes applicable publications into discrete obligations, and assigns each obligation to an accountable owner with an implementation date before the next scheduled committee reporting date.",
    riskIds: ["RSK-0351"],
    processIds: ["PRC-0071"],
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    ownerUserId: "P-006",
    nature: "preventive",
    automation: "manual",
    frequency: "monthly",
    isKeyControl: true,
    currentEffectiveness: "largely-effective",
    effectivenessSetBy: "seed",
    effectivenessSetAt: "2026-07-23T09:00:00.000Z",
    firstLineEffectiveness: "fully-effective",
    lastTestedOn: "2026-06-19",
    designNote:
      "Identification and decomposition are reliable. The per-entity applicability determination is the step that carries the risk, because the group operates across two regulatory blocs and a publication applying to the two EU entities frequently does not apply to the Swiss entity, which requires its own domestic framework reference or an explicit not-applicable rather than silence. Recording an entity as in scope when it is not is as much an error as omitting one that is.",
  },
];

/* ==========================================================================
   Key risk indicators

   Monthly cycle, measured at month end and published on the third business
   day. The September 2026 run was published on 05.10.2026 at 06:00, which is
   why four payments and third-party indicators and a resilience indicator are
   already sitting red in the register when the scenario day opens at 07:45.

   Thresholds are stated as the outer edge of the acceptable band, and a
   reading is adverse only strictly beyond that edge. For an indicator whose
   adverse direction is up, a value above the amber threshold is amber and a
   value above the red threshold is red. For an indicator whose adverse
   direction is down, the comparison inverts. One rule, every indicator, no
   special cases: see `statusFor` below.
   ========================================================================== */

export const kris: NewKri[] = [
  {
    /*
     * The indicator the morning brief leads with. Scenario figures for a
     * synthetic institution throughout: no external benchmark exists for this
     * indicator anywhere in the product. First red in 14 months, and 0.34
     * above the red threshold, which is 9.7 percent above it. The previous
     * high in 24 months was 2.94 in February 2025 during a T2 migration
     * weekend, so this reading has no precedent in the available history.
     * 731 divided by 1,905,000, times 10,000, is 3.8373, displayed as 3.84.
     */
    id: "KRI-PAY-007",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-007",
    name: "Manual override rate, Arcadia Bank AG",
    nameDe: "Quote manueller Ueberschreibungen",
    riskIds: ["RSK-0211", "RSK-0371"],
    processIds: ["PRC-0041"],
    entityId: ENTITY_DE,
    unit: "overrides per 10,000 instructions released",
    adverseDirection: "up",
    amberThreshold: 2.5,
    redThreshold: 3.5,
    ownerUserId: "P-007",
    definition:
      "Count of manual override records created in RepairDesk for Arcadia Bank AG in the reporting month, divided by the count of payment instructions released in the month, expressed per 10,000 instructions. Monitored by the Operational Risk Partner. A red reading requires a written first line explanation within 5 business days and an item on the next NFR Committee agenda.",
    currentStatus: "red",
    currentValue: 3.84,
  },
  {
    id: "KRI-PAY-003",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-003",
    name: "Payment repair rate, Arcadia Bank AG",
    nameDe: "Quote der Zahlungsreparaturen",
    riskIds: ["RSK-0211", "RSK-0215", "RSK-0212"],
    processIds: ["PRC-0042", "PRC-0041"],
    entityId: ENTITY_DE,
    unit: "percent of instructions entering the repair queue",
    adverseDirection: "up",
    amberThreshold: 2,
    redThreshold: 2.5,
    ownerUserId: "P-007",
    definition:
      "Payment instructions for Arcadia Bank AG that failed validation and entered the repair queue in the reporting month, as a percentage of instructions received in the month. September 2026 is the third consecutive month outside the green band, which is the pattern that should have prompted an off-cycle reassessment before the quarterly RCSA reached it.",
    currentStatus: "red",
    currentValue: 2.7,
  },
  {
    id: "KRI-PAY-011",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-011",
    name: "Secondary reviewer capacity, Arcadia Bank AG",
    nameDe: "Besetzungsgrad Zweitpruefer",
    riskIds: ["RSK-0371", "RSK-0211"],
    processIds: ["PRC-0041"],
    entityId: ENTITY_DE,
    unit: "percent of approved establishment filled",
    adverseDirection: "down",
    amberThreshold: 95,
    redThreshold: 85,
    ownerUserId: "P-007",
    definition:
      "Filled secondary reviewer full time equivalents in the Munich payment repair team as a percentage of the approved establishment of 8. Six of 8 seats have been filled since 01.08.2026, following the resignation of the holder of position PR-SR-02 on 31.07.2026 against an establishment that already carried one vacancy.",
    currentStatus: "red",
    currentValue: 75,
  },
  {
    /*
     * The indicator that explains KRI-PAY-007 and that nobody joined to it.
     * It is amber, it is owned by the same process owner, it is published in the
     * same monthly run, and the causal link runs directly from it: fallback
     * operation means route substitution, route substitution means OVR-C, and
     * OVR-C under RD-RULE-0031 means no secondary review. An amber indicator
     * sitting next to a red one, explaining it, with nothing in the reporting
     * that connects them, is the whole argument for this product.
     */
    id: "KRI-PAY-016",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-016",
    name: "Fallback clearing route activations, Arcadia Bank AG",
    nameDe: "Anzahl Aktivierungen des Ausweichclearingwegs",
    riskIds: ["RSK-0212", "RSK-0302", "RSK-0184"],
    processIds: ["PRC-0043"],
    entityId: ENTITY_DE,
    unit: "activations per month",
    adverseDirection: "up",
    amberThreshold: 2,
    redThreshold: 6,
    ownerUserId: "P-007",
    definition:
      "Count of occasions in the reporting month on which the secondary clearing route was activated for one or more payment queues under runbook RB-PAY-007. September 2026 recorded five activations totalling 8 hours 40 minutes, against one activation of 1 hour in August 2026.",
    currentStatus: "amber",
    currentValue: 5,
  },
  {
    id: "KRI-PAY-022",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-022",
    name: "Overrides released without a retrievable evidence reference, Arcadia Bank AG",
    nameDe: "Ueberschreibungen ohne abrufbaren Nachweis",
    riskIds: ["RSK-0262", "RSK-0211"],
    processIds: ["PRC-0041"],
    entityId: ENTITY_DE,
    unit: "percent of overrides",
    adverseDirection: "up",
    amberThreshold: 1,
    redThreshold: 3,
    ownerUserId: "P-008",
    definition:
      "Manual override records released in the reporting month for which the evidence reference is null or the referenced object cannot be retrieved, as a percentage of override records released. The measure is possible only because the evidence reference field in RepairDesk is nullable, which is itself the control weakness the indicator monitors.",
    currentStatus: "amber",
    currentValue: 2.46,
  },
  {
    id: "KRI-TPR-002",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-TPR-002",
    name: "Tier 1 third parties with a complete and current subprocessor record",
    nameDe: "Drittparteien der Stufe 1 mit vollstaendigem Unterauftragnehmerverzeichnis",
    riskIds: ["RSK-0185", "RSK-0184"],
    processIds: ["PRC-0053"],
    entityId: SCOPE_GROUP,
    unit: "percent of Tier 1 third parties",
    adverseDirection: "down",
    amberThreshold: 98,
    redThreshold: 95,
    ownerUserId: "P-002",
    definition:
      "Tier 1 third-party arrangements for which the subprocessor record has been reconciled against the binding contract appendix within the policy period and carries no unresolved difference, as a percentage of all Tier 1 arrangements. Population is 56 arrangements across the three banking entities.",
    currentStatus: "red",
    currentValue: 94.6,
  },
  {
    id: "KRI-RES-005",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-RES-005",
    name: "Important business services with tested fallback arrangements",
    nameDe: "Wichtige Geschaeftsdienstleistungen mit getesteten Ausweichvorkehrungen",
    riskIds: ["RSK-0302", "RSK-0301"],
    processIds: ["PRC-0061"],
    entityId: SCOPE_GROUP,
    unit: "percent of important business services",
    adverseDirection: "down",
    amberThreshold: 90,
    redThreshold: 80,
    ownerUserId: "P-005",
    definition:
      "Important business services whose fallback arrangements have been exercised by a scenario test within the policy period, as a percentage of all important business services at group level. A production activation is not a test for this purpose, because it produces no record of the control environment in the fallback state.",
    currentStatus: "red",
    currentValue: 78,
  },
  {
    id: "KRI-GOV-001",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-GOV-001",
    name: "Overdue remediation actions, group",
    nameDe: "Ueberfaellige Massnahmen im Konzern",
    riskIds: ["RSK-0331"],
    processIds: ["PRC-0082"],
    entityId: SCOPE_GROUP,
    unit: "count",
    adverseDirection: "up",
    amberThreshold: 3,
    redThreshold: 8,
    ownerUserId: "P-001",
    definition:
      "Count of remediation actions past their current due date at group level at month end. Thresholds are stated as band edges: at or below 3 is green, 4 to 8 is amber, 9 or more is red. Two of the seven actions overdue at 30.09.2026 relate to Corporate Payments; the other five sit outside this scenario's scope and are carried as a count with no further detail.",
    currentStatus: "amber",
    currentValue: 7,
  },
  {
    id: "KRI-GOV-004",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-GOV-004",
    name: "Key controls with a current description review",
    nameDe: "Schluesselkontrollen mit aktueller Beschreibungsdurchsicht",
    riskIds: ["RSK-0332", "RSK-0261"],
    processIds: ["PRC-0081"],
    entityId: SCOPE_GROUP,
    unit: "percent of key controls",
    adverseDirection: "down",
    amberThreshold: 95,
    redThreshold: 90,
    ownerUserId: "P-001",
    definition:
      "Key controls in the Internal Control System whose recorded description has been reviewed by the control owner within the last 12 months, as a percentage of all key controls. Population is 92 key controls across the three banking entities. CTL-PAY-014 is one of the eight that has not, and its description predates the configuration change that altered what the system enforces.",
    currentStatus: "amber",
    currentValue: 91.3,
  },
];

/* ==========================================================================
   Indicator readings

   Nine monthly readings per indicator, January to September 2026, so that the
   trend views show a baseline, a drift and a break rather than only the break.

   Status is never stated by hand. It is derived from the indicator's own
   thresholds, and the last reading in each series is checked against the
   indicator's recorded current value at module load, so a trend that does not
   end where the dashboard says it ends fails the build instead of quietly
   misleading a committee.
   ========================================================================== */

const MONTHS_2026: ReadonlyArray<{ period: string; periodEnd: string }> = [
  { period: "2026-01", periodEnd: "2026-01-31" },
  { period: "2026-02", periodEnd: "2026-02-28" },
  { period: "2026-03", periodEnd: "2026-03-31" },
  { period: "2026-04", periodEnd: "2026-04-30" },
  { period: "2026-05", periodEnd: "2026-05-31" },
  { period: "2026-06", periodEnd: "2026-06-30" },
  { period: "2026-07", periodEnd: "2026-07-31" },
  { period: "2026-08", periodEnd: "2026-08-31" },
  { period: "2026-09", periodEnd: "2026-09-30" },
];

/** The one threshold comparison, applied to every indicator in this module. */
function statusFor(kri: NewKri, value: number): "green" | "amber" | "red" {
  if (kri.adverseDirection === "up") {
    if (value > kri.redThreshold) return "red";
    if (value > kri.amberThreshold) return "amber";
    return "green";
  }
  if (value < kri.redThreshold) return "red";
  if (value < kri.amberThreshold) return "amber";
  return "green";
}

/**
 * Expands a monthly series into reading rows, deriving each status from the
 * indicator and asserting that the series lands on the recorded current value.
 */
function readingsFor(
  kriId: string,
  series: ReadonlyArray<readonly [value: number, commentary: string]>,
): NewKriReading[] {
  const kri = kris.find((candidate) => candidate.id === kriId);
  if (!kri) {
    throw new Error(`Reading series references an unknown indicator: ${kriId}`);
  }
  if (series.length !== MONTHS_2026.length) {
    throw new Error(
      `Reading series for ${kriId} has ${series.length} entries and the calendar has ${MONTHS_2026.length}`,
    );
  }
  const last = series[series.length - 1];
  if (last && last[0] !== kri.currentValue) {
    throw new Error(
      `Reading series for ${kriId} ends at ${last[0]} but the indicator records ${kri.currentValue}`,
    );
  }
  return series.map(([value, commentary], index) => {
    const month = MONTHS_2026[index];
    if (!month) {
      throw new Error(`No calendar month defined at index ${index} for ${kriId}`);
    }
    return {
      id: `${kriId}-${month.period}`,
      runId: DEFAULT_RUN_ID,
      kriId,
      period: month.period,
      periodEnd: month.periodEnd,
      value,
      status: statusFor(kri, value),
      commentary,
      sortOrder: index + 1,
    };
  });
}

export const kriReadings: NewKriReading[] = [
  ...readingsFor("KRI-PAY-007", [
    [2.18, ""],
    [2.24, ""],
    [2.11, ""],
    [2.29, ""],
    [2.35, ""],
    [
      2.41,
      "Highest reading of the year to date and still comfortably inside the green band. The monthly explanation recorded ordinary volume growth.",
    ],
    [2.33, ""],
    [
      2.2,
      "412 overrides on 1,870,000 instructions. Fourteenth consecutive month in green, and the reading a committee would take as evidence that the control environment is stable.",
    ],
    [
      3.84,
      "731 overrides on 1,905,000 instructions. First red in 14 months and 0.34 above the red threshold, which is 9.7 percent above it. No reading in the previous 24 months exceeded 2.94. The movement is concentrated in OVR-C route substitution, 31 to 198, and OVR-D cut-off driven release, 94 to 211, and the aggregate rate alone does not show that. Scenario figures.",
    ],
  ]),
  ...readingsFor("KRI-PAY-003", [
    [1.82, ""],
    [1.88, ""],
    [1.79, ""],
    [1.91, ""],
    [1.94, ""],
    [
      1.97,
      "Last green reading. The trend through the first half of the year was a slow drift towards the threshold rather than a step change.",
    ],
    [
      2.09,
      "First month outside green. A single amber reading on a volume-driven indicator did not trigger an off-cycle reassessment under the policy test.",
    ],
    [
      2.28,
      "42,636 of 1,870,000 instructions. Second consecutive month outside green, which is the point at which the drift should have stopped being read as volume.",
    ],
    [
      2.7,
      "51,435 of 1,905,000 instructions, a rise of 20.6 percent on August. Third consecutive month outside green and the first red. Read against KRI-PAY-007 the asymmetry is the finding: the queue grew 20.6 percent and the overrides it produces grew 77.4 percent. Scenario figures.",
    ],
  ]),
  ...readingsFor("KRI-PAY-011", [
    [100, ""],
    [100, ""],
    [
      87.5,
      "Seven of 8 seats filled. One vacancy carried without a recruitment action, on the basis that the roster still covered the full operating window.",
    ],
    [87.5, ""],
    [87.5, ""],
    [87.5, ""],
    [
      87.5,
      "Fifth consecutive amber month. The position was reported monthly and accepted monthly.",
    ],
    [
      75,
      "Six of 8 seats filled. Tomas Nowak resigned from position PR-SR-02 on 31.07.2026 and the seat has not been filled. First red reading on this indicator.",
    ],
    [
      75,
      "Unchanged at 75.0 percent. MSN-2026-0166 to recruit to PR-SR-02 passed its due date of 30.09.2026 with two candidate rejections and no start date. This is the indicator that turns the override rate from a volume story into a capacity story: more overrides, under more cut-off pressure, with fewer reviewers. Scenario figures.",
    ],
  ]),
  ...readingsFor("KRI-PAY-016", [
    [0, ""],
    [1, ""],
    [0, ""],
    [1, ""],
    [0, ""],
    [
      2,
      "Two activations in the month, at the green band edge. No service level shortfall was reported by the provider.",
    ],
    [1, ""],
    [
      1,
      "One activation of 1 hour. The August baseline against which the September movement has to be read.",
    ],
    [
      5,
      "Five activations totalling 8 hours 40 minutes: 04.09 for 1 hour 10 minutes, 11.09 for 2 hours 05 minutes, 18.09 for 40 minutes, 25.09 for 3 hours 15 minutes and 29.09 for 1 hour 30 minutes. Gateway availability for the month was 99.62 percent against a contracted 99.7 percent, a shortfall the provider has not reported. This indicator is amber while the override rate it drives is red, and no reporting in the group connects the two. Scenario figures.",
    ],
  ]),
  ...readingsFor("KRI-PAY-022", [
    [0.62, ""],
    [0.71, ""],
    [0.58, ""],
    [0.84, ""],
    [0.79, ""],
    [0.91, ""],
    [0.88, ""],
    [0.97, "Four of 412 override records. Within green and unremarkable."],
    [
      2.46,
      "Eighteen of 731 override records. The rise tracks the override volume rather than a change in practice, which is the point: a fixed rate of missing evidence applied to a population that grew 77.4 percent produces a materially larger set of releases that cannot be evidenced after the fact. Scenario figures.",
    ],
  ]),
  ...readingsFor("KRI-TPR-002", [
    [98.2, ""],
    [98.2, ""],
    [98.2, ""],
    [98.2, ""],
    [
      96.4,
      "Two of 56 Tier 1 arrangements carry an unresolved difference between the submitted subprocessor list and the binding appendix.",
    ],
    [96.4, ""],
    [96.4, ""],
    [96.4, ""],
    [
      94.6,
      "Fifty-three of 56 arrangements. The third unresolved arrangement is the Tier 1 payment provider, where the question of which appendix version is binding is a legal determination rather than a data correction. MSN-2026-0191 is open at 40 percent with a date of 13.11.2026. Scenario figures.",
    ],
  ]),
  ...readingsFor("KRI-RES-005", [
    [84, ""],
    [84, ""],
    [84, ""],
    [82, ""],
    [82, ""],
    [
      78,
      "First red reading. Two services fell out of the tested population as their previous test results passed the policy period.",
    ],
    [78, ""],
    [78, ""],
    [
      78,
      "Fourth consecutive red month with no movement. Corporate Payments sits in the untested population for its euro clearing fallback, which was exercised in production five times during the month.",
    ],
  ]),
  ...readingsFor("KRI-GOV-001", [
    [3, ""],
    [4, "First month outside green. MSN-2026-0147 passed its original due date of 31.03.2026."],
    [4, ""],
    [5, ""],
    [5, ""],
    [5, ""],
    [
      6,
      "MSN-2026-0147 passed its revised due date of 31.07.2026, the second date on an action extended once by the NFR Committee on 14.04.2026.",
    ],
    [6, ""],
    [
      7,
      "Seven overdue at group level, of which two relate to Corporate Payments: MSN-2026-0147 at 67 days past its revised due date and MSN-2026-0166 at 6 days. The indicator is amber, which is why the individual action 67 days overdue does not surface in the aggregate view at all.",
    ],
  ]),
  ...readingsFor("KRI-GOV-004", [
    [98.9, ""],
    [98.9, ""],
    [97.8, ""],
    [96.7, ""],
    [95.7, "Last green reading. Five of 92 key control descriptions outside the review period."],
    [94.6, "First amber reading. Six of 92 outside the review period."],
    [93.5, ""],
    [92.4, ""],
    [
      91.3,
      "Eight of 92 key control descriptions have not been reviewed within 12 months. CTL-PAY-014 is one of them, at version 4.1 dated 14.01.2025. A percentage in the low nineties reads as housekeeping. One of the eight is the only preventive control on payment release authorisation, and its description says the opposite of what the system enforces.",
    ],
  ]),
];

/* ==========================================================================
   Assessments

   Versions are created, never overwritten. The Payment Operations RCSA runs
   quarterly, so Q2 is version 2, Q3 version 3 and Q4 version 4, each pointing
   forward through `supersededBy` so that comparing the current version against
   the previous one is a two row read.

   RCSA-ARC-DE-PAYOPS-2026-Q4 is a draft carrying the second line pre-read
   position issued on 02.10.2026. It has no approver, because the position it
   proposes has not been accepted by the first line and the workshop that will
   settle it sits at 10:30 on the scenario day.
   ========================================================================== */

export const assessments: NewAssessment[] = [
  {
    /*
     * The current version. Assessment level residual is unchanged at high
     * against Q3, because RSK-0184 was already high and outside appetite under
     * a conditional acceptance. What changed is the composition: Q3 had one
     * line outside appetite, Q4 has four, and one of them is the only
     * preventive control on payment release authorisation. A header figure that
     * does not move while the portfolio underneath it does is exactly why the
     * line level comparison has to be the primary view.
     */
    id: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    runId: DEFAULT_RUN_ID,
    kind: "rcsa",
    reference: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    title: "Payment Operations risk and control self assessment, Arcadia Bank AG, Q4 2026",
    subjectKind: "process",
    subjectId: "PRC-0041",
    entityId: ENTITY_DE,
    version: 4,
    status: "draft",
    cycle: "Q4 2026",
    performedByUserId: "P-003",
    performedOn: "2026-10-02",
    supersededBy: null,
    residualRisk: "high",
    overallConclusion:
      "Second line pre-read position: the residual risk profile of the Payment Operations unit has deteriorated materially since the Q3 assessment, and three of the eleven risks in scope have moved outside appetite. The proposed conclusion on RSK-0211 Erroneous or unauthorised payment release is a residual position of likelihood 3 and impact 4, which the group matrix rates high at 12 of 25 and which the appetite statement for payment execution risks places outside appetite. That conclusion requires either an approved remediation plan with committed dates or a documented Risikoakzeptanz approved by the entity Chief Operating Officer and noted by the Group NFR Committee. Monitoring does not discharge it. The first line position of medium is recorded and is not accepted.",
    rationale:
      "The proposal rests on four points and one measurement problem. First, CTL-PAY-014 is the only preventive control on this risk and independent testing concluded partially effective on 25.09.2026, with a design deficiency and an operating deficiency. Under the group methodology a partially effective control earns no likelihood reduction and no impact reduction, so the residual position returns to the inherent position without any exercise of judgment. Second, the two compensating controls the first line relies on do not address this risk: CTL-PAY-021 is detective, operates on the next business day after an irrevocable submission and samples one record in ten, and CTL-PAY-029 reconciles value rather than authorisation, so a correctly valued payment released to the wrong beneficiary reconciles perfectly. Third, the reviewer vacancy in position PR-SR-02 has no start date, so the capacity input to the risk is not improving. Fourth, remediation action MSN-2026-0147, raised to prevent exactly the self-review failure the test found, is 67 days past a revised due date that had already been extended once. The measurement problem is the one the first line argument does not address: two of the six flagged items are recorded as unable to conclude because the evidence is a provider service account identity and a broken evidence link. The true deviation rate is therefore not 6.67 percent; it is unknown, with a lower bound of 6.67 percent and an upper bound of 10.00 percent, against a tolerable rate of 5 percent. The first line is right that no financial loss occurred and that all four payments were subsequently confirmed correct by the clients. That is an outcome, not a control conclusion, and it is not available as evidence at the moment of release. Scenario figures.",
    createdBySession: false,
  },
  {
    id: "RCSA-ARC-DE-PAYOPS-2026-Q3",
    runId: DEFAULT_RUN_ID,
    kind: "rcsa",
    reference: "RCSA-ARC-DE-PAYOPS-2026-Q3",
    title: "Payment Operations risk and control self assessment, Arcadia Bank AG, Q3 2026",
    subjectKind: "process",
    subjectId: "PRC-0041",
    entityId: ENTITY_DE,
    version: 3,
    status: "superseded",
    cycle: "Q3 2026",
    performedByUserId: "P-003",
    approvedByUserId: "P-007",
    performedOn: "2026-07-02",
    approvedOn: "2026-07-08",
    supersededBy: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    residualRisk: "high",
    overallConclusion:
      "The control environment of the Payment Operations unit is assessed as effective for ten of the eleven risks in scope. One risk, RSK-0184 Loss or material degradation of a critical third-party payment service, remains outside appetite and is held under the conditional Risikoakzeptanz dated 19.01.2026. No other risk in scope requires a remediation plan or a risk acceptance in this cycle. The workshop recorded no dissent.",
    rationale:
      "RSK-0211 Erroneous or unauthorised payment release is assessed with CTL-PAY-014 at fully effective, which under the group methodology reduces likelihood by two bands and impact by one band, giving a residual position of likelihood 1 and impact 3 and a rating of low. The basis for the fully effective rating is the first line self-assessment: CTL-PAY-014 had not been independently tested at the date of this assessment. Test TST-2026-0318 covers the period 01.06.2026 to 31.08.2026 with fieldwork from 07.09.2026 and a report issued on 25.09.2026, all of which postdate this sign-off. The second line facilitator recorded at the time that the rating carried forward on a self-assessment and that the annual test result was expected in the third quarter. That note is the reason the Q4 movement is a revision of an assumption rather than a reversal of a finding.",
    createdBySession: false,
  },
  {
    id: "RCSA-ARC-DE-PAYOPS-2026-Q2",
    runId: DEFAULT_RUN_ID,
    kind: "rcsa",
    reference: "RCSA-ARC-DE-PAYOPS-2026-Q2",
    title: "Payment Operations risk and control self assessment, Arcadia Bank AG, Q2 2026",
    subjectKind: "process",
    subjectId: "PRC-0041",
    entityId: ENTITY_DE,
    version: 2,
    status: "superseded",
    cycle: "Q2 2026",
    performedByUserId: "P-003",
    approvedByUserId: "P-007",
    performedOn: "2026-04-02",
    approvedOn: "2026-04-09",
    supersededBy: "RCSA-ARC-DE-PAYOPS-2026-Q3",
    residualRisk: "high",
    overallConclusion:
      "The control environment of the Payment Operations unit is assessed as effective for ten of the eleven risks in scope, with RSK-0184 outside appetite under the conditional Risikoakzeptanz dated 19.01.2026. The unit reported no material process change in the quarter and no indicator outside its green band on a payment execution risk.",
    rationale:
      "This version is the stable baseline against which the second half of the year should be read. Every payment execution indicator was inside its green band at 31.03.2026, CTL-PAY-014 was rated fully effective on the first line self-assessment and had been so rated in every cycle since the control was designated a key control, and the secondary reviewer establishment was fully filled at the date of the workshop. The one persistent exception was remediation action MSN-2026-0147, which had passed its original due date of 31.03.2026 and for which an extension to 31.07.2026 was approved by the NFR Committee on 14.04.2026, five days after this version was signed.",
    createdBySession: false,
  },
  {
    id: "RCSA-ARC-AT-PAYOPS-2026-Q3",
    runId: DEFAULT_RUN_ID,
    kind: "rcsa",
    reference: "RCSA-ARC-AT-PAYOPS-2026-Q3",
    title:
      "Payment Operations risk and control self assessment, Arcadia Bank Oesterreich AG, Q3 2026",
    subjectKind: "process",
    subjectId: "PRC-0041",
    entityId: ENTITY_AT,
    version: 3,
    status: "approved",
    cycle: "Q3 2026",
    performedByUserId: "P-003",
    approvedByUserId: "P-007",
    performedOn: "2026-07-03",
    approvedOn: "2026-07-14",
    supersededBy: null,
    residualRisk: "medium",
    overallConclusion:
      "The Austrian payment operations exposure is assessed at medium residual for both payment execution risks in scope, at the limit of appetite rather than within it. The entity consumes the same repair and override process, the same provider systems and the same control set as Arcadia Bank AG, operated from the Munich hub, but at approximately one sixth of the volume, so the same control weakness produces a smaller absolute population of affected releases.",
    rationale:
      "The Austrian assessment cannot be more favourable than the German one on a shared process, and this version records it at the limit rather than within appetite for that reason. CTL-PAY-014 is rated largely effective rather than fully effective, because Austrian overrides are created and reviewed by the same Munich team against the same RepairDesk configuration, and any deficiency in that configuration applies identically here. Austrian manual overrides rose from 71 in August 2026 to 128 in September 2026, an increase of 80.3 percent, which is a steeper proportional movement than the German entity recorded. Local adoption of this assessment and local sign-off were recorded separately by the Arcadia Bank Oesterreich AG NFR Committee, because group NFR staff are legally Arcadia Bank AG employees performing work under an intragroup arrangement and cannot absorb the local accountability. Scenario figures.",
    createdBySession: false,
  },
  {
    id: "RCSA-ARC-CH-PAYOPS-2026-Q3",
    runId: DEFAULT_RUN_ID,
    kind: "rcsa",
    reference: "RCSA-ARC-CH-PAYOPS-2026-Q3",
    title: "Payment Operations risk and control self assessment, Arcadia Bank Schweiz AG, Q3 2026",
    subjectKind: "process",
    subjectId: "PRC-0046",
    entityId: ENTITY_CH,
    version: 3,
    status: "approved",
    cycle: "Q3 2026",
    performedByUserId: "P-003",
    approvedByUserId: "P-015",
    performedOn: "2026-07-07",
    approvedOn: "2026-07-17",
    supersededBy: null,
    residualRisk: "high",
    overallConclusion:
      "The Swiss payment operations exposure is assessed at high residual and outside appetite on all three risks in scope. The determining factor is not control operation, which is sound, but the absence of any automated alternative: the entity holds no direct SIC participant link, so the only fallback for domestic clearing is manual submission through a correspondent bank with a 45 minute preparation lead time against a 16:00 CET same-day cut-off.",
    rationale:
      "Two findings carry this conclusion and neither is a control failure in the ordinary sense. First, impact tolerance ITOL-0004-03 carries two measures, a maximum tolerable disruption of 2 hours and completion of submission before the 16:00 CET cut-off, with no stated precedence between them. The two measures can diverge, and where they diverge the entity cannot state whether it has breached its own tolerance. That is a governance gap in an approved tolerance rather than an operational weakness, and it cannot be closed by the unit that operates the process. Second, the entity depends on the same provider as the euro entities for its clearing adapter while having no fallback of its own, so a provider degradation that the euro entities can route around leaves the Swiss entity with a manual process and a decision that has to be taken before the outcome is known. This assessment references the Swiss operational risk and outsourcing framework. The EU digital operational resilience regulation is not applicable to this entity and is not cited.",
    createdBySession: false,
  },
  {
    id: "RCSA-ARC-DE-TPRM-2026-Q3",
    runId: DEFAULT_RUN_ID,
    kind: "rcsa",
    reference: "RCSA-ARC-DE-TPRM-2026-Q3",
    title: "Third-Party Risk Management risk and control self assessment, Arcadia Bank AG, Q3 2026",
    subjectKind: "process",
    subjectId: "PRC-0053",
    entityId: ENTITY_DE,
    version: 3,
    status: "approved",
    cycle: "Q3 2026",
    performedByUserId: "P-003",
    approvedByUserId: "P-002",
    performedOn: "2026-07-09",
    approvedOn: "2026-07-20",
    supersededBy: null,
    residualRisk: "high",
    overallConclusion:
      "Two of the three risks in scope are outside appetite. The concentration exposure on the Tier 1 payment provider is held under a conditional Risikoakzeptanz; the exit and substitutability exposure is not covered by any acceptance and has no tested arrangement behind it. Subprocessor transparency is at the limit of appetite with an unresolved reconciliation difference on the same provider.",
    rationale:
      "The unit performs the assessments the policy requires and does so on time. The exposure that the assessment cannot close is structural. One provider supplies payment validation and clearing connectivity, the repair and override workbench and the Swiss clearing adapter, and the tiering control assesses each of those services separately, so the aggregate single point of failure appears in no individual determination. The exit and substitutability plan for the repair and override workbench asserts a capability that has never been exercised, and MSN-2026-0177, the exit test that is a stated condition of the RSK-0184 acceptance, is not started with a date of 31.12.2026. An acceptance whose condition is not being worked should not be relied on as though it were in force, and this version records that reservation rather than treating the acceptance as settled.",
    createdBySession: false,
  },
  {
    id: "RCSA-ARC-DE-RESIL-2026-Q3",
    runId: DEFAULT_RUN_ID,
    kind: "rcsa",
    reference: "RCSA-ARC-DE-RESIL-2026-Q3",
    title: "Operational Resilience risk and control self assessment, Arcadia Bank AG, Q3 2026",
    subjectKind: "process",
    subjectId: "PRC-0061",
    entityId: ENTITY_DE,
    version: 3,
    status: "approved",
    cycle: "Q3 2026",
    performedByUserId: "P-003",
    approvedByUserId: "P-005",
    performedOn: "2026-07-10",
    approvedOn: "2026-07-21",
    supersededBy: null,
    residualRisk: "high",
    overallConclusion:
      "Both risks in scope are outside appetite. Impact tolerances are set and approved for every important business service, and the testing that would demonstrate they can be met is incomplete for a material share of them. A tolerance that has been approved but not tested is a statement of intent.",
    rationale:
      "The share of important business services with tested fallback arrangements has stood at 78 percent since June 2026, below the red threshold of 80 percent. For Corporate Payments the gap is sharper than the percentage suggests: the euro clearing fallback has been exercised in production on seven occasions since November 2024 and has never been the subject of a scenario test, so no record exists of the control environment that applies while it is active. Runbook RB-PAY-007 section 4 asserts that the control environment is unchanged during fallback operation. That assertion has never been tested and is not correct, which makes it a finding rather than a gap in coverage, and it is the reason this assessment rates CTL-PAY-034 and CTL-RES-009 both at partially effective despite each operating as documented. Scenario figures.",
    createdBySession: false,
  },
  {
    id: "RCSA-ARC-DE-GOVCTL-2026-Q3",
    runId: DEFAULT_RUN_ID,
    kind: "rcsa",
    reference: "RCSA-ARC-DE-GOVCTL-2026-Q3",
    title:
      "NFR Governance and Internal Control risk and control self assessment, Arcadia Bank AG, Q3 2026",
    subjectKind: "process",
    subjectId: "PRC-0081",
    entityId: ENTITY_DE,
    version: 3,
    status: "approved",
    cycle: "Q3 2026",
    performedByUserId: "P-004",
    approvedByUserId: "P-001",
    performedOn: "2026-07-13",
    approvedOn: "2026-07-23",
    supersededBy: null,
    residualRisk: "high",
    overallConclusion:
      "Two of the three risks in scope are outside appetite. The framework, the testing programme and the action tracking all operate. What does not operate reliably is the step after each of them: pursuing a finding to a root cause, forcing the consequence the framework attaches to an overdue action, and keeping a control description aligned with what the system enforces.",
    rationale:
      "This assessment was performed by Group Control Assurance and approved by the NFR Portfolio Lead, which is the correct route for an assessment of the control framework itself. Three observations carry the conclusion. Remediation action tracking is accurate and the escalation rule for actions more than 60 days past a revised due date has not produced the re-baseline or board referral it requires on the one action that qualifies. Key control description review is at 91.3 percent against a 95 percent threshold, and the eight controls outside the review period include a key preventive control on payment release authorisation whose recorded description predates a configuration change that altered the condition the system enforces. Evidence retrievability for controls operating in provider systems is not confirmed against the contractual requirement before the arrangement is relied upon for assurance, which is how a provider service account identity and a 30 day log retention period came to be the reason an assurance opinion could not be formed on two sampled items. Scenario figures.",
    createdBySession: false,
  },
];

/* ==========================================================================
   Assessment lines

   No residual position in this file is typed by hand. Each line names an
   inherent position, which it takes from the risk register so the two can
   never drift, and a control effectiveness, which is the human judgment. The
   residual likelihood, residual impact, residual rating and appetite position
   are then computed by the same functions the product uses at runtime. That
   removes the most common defect in seeded risk data, which is a residual
   rating that no stated methodology produces.
   ========================================================================== */

/**
 * Appetite ceiling for payment execution and third-party payment risks. The
 * Group Operational Risk Policy sets the boundary at a residual score of 10 or
 * above, which on the group matrix is the point at which a position rates high.
 * A medium residual therefore sits at the limit and a high residual sits
 * outside.
 */
const APPETITE_CEILING: RiskRating = "medium";

interface LineSpec {
  riskId: string;
  controlIds: string[];
  controlEffectiveness: ControlEffectiveness;
  commentary: string;
  changeFromPrevious?: string;
}

function linesFor(assessmentId: string, specs: ReadonlyArray<LineSpec>): NewAssessmentLine[] {
  return specs.map((spec, index) => {
    const risk = risks.find((candidate) => candidate.id === spec.riskId);
    if (!risk) {
      throw new Error(`Assessment ${assessmentId} references an unknown risk: ${spec.riskId}`);
    }
    const position = calculateRiskMatrixPosition({
      inherentLikelihood: risk.inherentLikelihood,
      inherentImpact: risk.inherentImpact,
      controlEffectiveness: spec.controlEffectiveness,
    });
    return {
      id: `${assessmentId}-L${String(index + 1).padStart(2, "0")}`,
      runId: DEFAULT_RUN_ID,
      assessmentId,
      riskId: spec.riskId,
      controlIds: spec.controlIds,
      inherentLikelihood: position.inherentLikelihood,
      inherentImpact: position.inherentImpact,
      controlEffectiveness: spec.controlEffectiveness,
      residualLikelihood: position.residualLikelihood,
      residualImpact: position.residualImpact,
      residualRating: position.residualRating,
      appetitePosition: appetitePositionFor(position.residualRating, APPETITE_CEILING),
      commentary: spec.commentary,
      changeFromPrevious: spec.changeFromPrevious ?? "",
      sortOrder: index + 1,
    };
  });
}

export const assessmentLines: NewAssessmentLine[] = [
  /*
   * Q4 2026, the current draft. Four of the five lines moved and the fifth
   * deliberately did not. Read the change notes in order: the first three
   * record a downgrade of a control, the fourth records a rating that did not
   * move while the basis for accepting it collapsed, and the fifth records a
   * control that is genuinely fully effective. A downgrade that touched every
   * line would be a downgrade of the unit rather than a set of findings.
   */
  ...linesFor("RCSA-ARC-DE-PAYOPS-2026-Q4", [
    {
      riskId: "RSK-0211",
      controlIds: ["CTL-PAY-014", "CTL-PAY-006", "CTL-PAY-021", "CTL-PAY-029", "CTL-PAY-017"],
      controlEffectiveness: "partially-effective",
      commentary:
        "Second line pre-read position of 02.10.2026. CTL-PAY-014 is the only preventive control on this risk and independent test TST-2026-0318 concluded partially effective on 25.09.2026, with a design deficiency in RD-RULE-0031 and an operating deficiency across four exceptions. CTL-PAY-006 role segregation is not effective and the remediation that would make it effective is 67 days overdue. The two controls the first line offers as compensating are detective, and neither can prevent a release: CTL-PAY-021 samples one record in ten on the next business day, and CTL-PAY-029 reconciles value rather than authorisation. The first line position on this line is medium, on the basis that the four exceptions caused no financial loss, that all four payments were subsequently confirmed correct by the clients, and that recruitment to the vacant reviewer seat is in progress. That position is recorded and is not accepted.",
      changeFromPrevious:
        "Moved from low to high, and from within appetite to outside appetite. The inherent position is unchanged at likelihood 3 and impact 4. What changed is the control effectiveness input: CTL-PAY-014 moved from fully effective, which was a first line self-assessment carried forward because no test result existed at Q3 sign-off, to partially effective on the independent test reported 25.09.2026. Under the group methodology a fully effective control reduces likelihood by two bands and impact by one; a partially effective control reduces neither. The residual position therefore returns to the inherent position without any exercise of judgment on the risk itself. Nothing about the risk changed between July and October. The credit taken for the control did.",
    },
    {
      riskId: "RSK-0212",
      controlIds: ["CTL-PAY-031", "CTL-PAY-029", "CTL-PAY-034", "CTL-PAY-014"],
      controlEffectiveness: "partially-effective",
      commentary:
        "CTL-PAY-031 cut-off monitoring surfaces items approaching a cut-off and offers release under override as one of four responses, with no constraint on choosing that response when no reviewer is available. It monitors the pressure it creates and holds no block on release before review. CTL-PAY-034 route substitution authorisation operates, and the runbook it operates under misstates the control environment that results.",
      changeFromPrevious:
        "Moved from medium to high, and from at the limit of appetite to outside appetite. EXC-TST-2026-0318-02 on 06.08.2026, a value of EUR 1,215,000, was released at 16:47:12 with the secondary review recorded at 16:58:31, eleven minutes and nineteen seconds after release. OVR-D cut-off driven overrides rose from 94 in August 2026 to 211 in September 2026. The pattern is the same in both facts: under cut-off pressure the release happens and the review follows it.",
    },
    {
      riskId: "RSK-0371",
      controlIds: ["CTL-PAY-044", "CTL-PAY-041"],
      controlEffectiveness: "partially-effective",
      commentary:
        "CTL-PAY-044 monitors the establishment accurately and produces no dated plan to fill it. The Munich repair team has operated with six of eight approved secondary reviewer seats filled since 01.08.2026, against a process designed for eight, while the population of overrides requiring review rose 77.4 percent in September 2026. Scenario figures.",
      changeFromPrevious:
        "Moved from medium to high, and from at the limit of appetite to outside appetite. KRI-PAY-011 has been red since 01.08.2026 at 75.0 percent of approved establishment, following the resignation of Tomas Nowak from position PR-SR-02 on 31.07.2026. MSN-2026-0166 to recruit to that position passed its due date of 30.09.2026 with two candidate rejections and no start date, and no compensating cover arrangement has been recorded, so CTL-PAY-044 cannot be rated above partially effective. This line is an input to RSK-0211 and not an independent staffing matter: fewer reviewers under more cut-off pressure is the mechanism by which a capacity number becomes a payment authorisation exposure. Scenario figures.",
    },
    {
      riskId: "RSK-0184",
      controlIds: ["CTL-TPR-007", "CTL-TPR-015", "CTL-TPR-019", "CTL-PAY-034"],
      controlEffectiveness: "largely-effective",
      commentary:
        "Carried in this assessment as well as in the Third-Party Risk assessment, because the unit that depends on the service owns the exposure even where the supplier relationship is managed elsewhere. One provider supplies payment validation and clearing connectivity, the repair and override workbench and the Swiss clearing adapter, so a degradation removes a route and a control environment at the same moment.",
      changeFromPrevious:
        "Rating unchanged at high and outside appetite. What changed is the basis on which the position is held. The conditional Risikoakzeptanz dated 19.01.2026 is valid to 31.12.2026 and is conditioned on completion of the 2026 provider reassessment and an exit test. MSN-2026-0177, the exit and substitutability test for the repair and override workbench service, is not started and has no plan to start. An acceptance whose condition nobody is working is not an acceptance, and a line that shows no movement in its rating can still be the line whose governance position deteriorated most.",
    },
    {
      riskId: "RSK-0214",
      controlIds: ["CTL-PAY-008", "CTL-PAY-029"],
      controlEffectiveness: "fully-effective",
      commentary:
        "CTL-PAY-008 duplicate detection was tested in the June 2026 cycle with no deviation, and no R05 item reached release without a recorded analyst comparison against the identified prior instruction. This line is unchanged and is reported unchanged. It matters to the conclusion: the movements on the other four lines are specific findings against specific controls, not a general downgrade of a unit that is under pressure.",
    },
  ]),

  /*
   * Q3 2026, signed 08.07.2026. The line to read here is the first one: the
   * fully effective rating was a first line self-assessment carried forward
   * because the annual test had not yet been performed. The Q4 movement is
   * therefore the correction of an assumption, not the reversal of a finding,
   * and that distinction is what makes the disagreement legitimate on both
   * sides rather than a failure by either.
   */
  ...linesFor("RCSA-ARC-DE-PAYOPS-2026-Q3", [
    {
      riskId: "RSK-0211",
      controlIds: ["CTL-PAY-014", "CTL-PAY-006", "CTL-PAY-021", "CTL-PAY-029", "CTL-PAY-017"],
      controlEffectiveness: "fully-effective",
      commentary:
        "CTL-PAY-014 rated fully effective on the first line self-assessment, earning the full two band likelihood reduction and one band impact reduction the group methodology permits. No independent test result was available at the date of sign-off: TST-2026-0318 covers 01.06.2026 to 31.08.2026, with fieldwork from 07.09.2026 and a report issued 25.09.2026. The facilitator recorded that the rating carried forward on a self-assessment and that the annual test was expected in the third quarter.",
      changeFromPrevious:
        "Unchanged from Q2 2026. The reviewer establishment had one vacancy at the date of the workshop and the roster still covered the full operating window, which the workshop accepted as within tolerance.",
    },
    {
      riskId: "RSK-0212",
      controlIds: ["CTL-PAY-031", "CTL-PAY-029", "CTL-PAY-034", "CTL-PAY-014"],
      controlEffectiveness: "largely-effective",
      commentary:
        "CTL-PAY-031 rated largely effective rather than fully effective, on the basis that cut-off monitoring surfaces at-risk items reliably but offers release under override as an unconstrained response. No exception had been reported against the control at the date of sign-off.",
      changeFromPrevious:
        "Moved from low to medium, and from within appetite to the limit of appetite. The workshop reduced CTL-PAY-031 from fully effective to largely effective after the repair rate indicator moved outside its green band in the June reporting run, on the reasoning that a larger repair queue means more items reaching the cut-off warning point with the same number of people available to clear them.",
    },
    {
      riskId: "RSK-0371",
      controlIds: ["CTL-PAY-044", "CTL-PAY-041"],
      controlEffectiveness: "largely-effective",
      commentary:
        "CTL-PAY-044 rated largely effective. Seven of eight approved secondary reviewer seats were filled at the date of the workshop, KRI-PAY-011 stood amber at 87.5 percent, and the roster covered the full operating window. The workshop recorded the single vacancy as accepted without a recruitment action. Scenario figures.",
      changeFromPrevious:
        "Unchanged from Q2 2026 in rating and in control effectiveness. Recorded because the resignation that produced the red reading took effect on 31.07.2026, 23 days after this version was signed: the assessment was accurate on the day it was approved and was out of date three weeks later, with no mechanism to revisit it until the next quarterly cycle.",
    },
    {
      riskId: "RSK-0184",
      controlIds: ["CTL-TPR-007", "CTL-TPR-015", "CTL-TPR-019", "CTL-PAY-034"],
      controlEffectiveness: "largely-effective",
      commentary:
        "The only line in this version outside appetite. Held under the conditional Risikoakzeptanz dated 19.01.2026, valid to 31.12.2026 and conditioned on completion of the 2026 provider reassessment and an exit test.",
      changeFromPrevious:
        "Rating unchanged. The workshop reconfirmed the conditional acceptance on the basis that the 2026 provider reassessment was on track to complete by its cycle deadline of 31.10.2026. The exit test condition was noted and was not discussed.",
    },
    {
      riskId: "RSK-0214",
      controlIds: ["CTL-PAY-008", "CTL-PAY-029"],
      controlEffectiveness: "fully-effective",
      commentary:
        "CTL-PAY-008 rated fully effective on the June 2026 test result, with no deviation in the sample and no duplicate release recorded in the quarter.",
    },
  ]),

  /* Q2 2026. The stable baseline the second half of the year has to be read against. */
  ...linesFor("RCSA-ARC-DE-PAYOPS-2026-Q2", [
    {
      riskId: "RSK-0211",
      controlIds: ["CTL-PAY-014", "CTL-PAY-006", "CTL-PAY-021", "CTL-PAY-029"],
      controlEffectiveness: "fully-effective",
      commentary:
        "CTL-PAY-014 rated fully effective on the first line self-assessment, as it has been in every cycle since the control was designated a key control in the Internal Control System. Every payment execution indicator was inside its green band at 31.03.2026.",
    },
    {
      riskId: "RSK-0212",
      controlIds: ["CTL-PAY-031", "CTL-PAY-029", "CTL-PAY-034"],
      controlEffectiveness: "fully-effective",
      commentary:
        "CTL-PAY-031 rated fully effective. The repair rate stood at 1.79 percent at the end of March 2026, inside the green band, and no instruction accepted for same-day value missed its cut-off in the quarter. Scenario figures.",
    },
    {
      riskId: "RSK-0371",
      controlIds: ["CTL-PAY-044", "CTL-PAY-041"],
      controlEffectiveness: "largely-effective",
      commentary:
        "CTL-PAY-044 rated largely effective. The reviewer establishment moved from fully filled to seven of eight seats during March 2026, which took KRI-PAY-011 to amber at 87.5 percent for the first time in the year. Scenario figures.",
    },
    {
      riskId: "RSK-0184",
      controlIds: ["CTL-TPR-007", "CTL-TPR-015", "CTL-TPR-019"],
      controlEffectiveness: "largely-effective",
      commentary:
        "Outside appetite and held under the conditional Risikoakzeptanz dated 19.01.2026, approved three months before this version was signed. Both conditions of the acceptance, the 2026 provider reassessment and an exit test, were open at the date of the workshop with dates later in the year.",
    },
    {
      riskId: "RSK-0214",
      controlIds: ["CTL-PAY-008", "CTL-PAY-029"],
      controlEffectiveness: "fully-effective",
      commentary:
        "CTL-PAY-008 rated fully effective on the prior year test result and on the absence of any duplicate release in the quarter.",
    },
  ]),

  /* Arcadia Bank Oesterreich AG, Q3 2026. Same process, same controls, one sixth of the volume. */
  ...linesFor("RCSA-ARC-AT-PAYOPS-2026-Q3", [
    {
      riskId: "RSK-0211",
      controlIds: ["CTL-PAY-014", "CTL-PAY-006", "CTL-PAY-021", "CTL-PAY-029"],
      controlEffectiveness: "largely-effective",
      commentary:
        "CTL-PAY-014 rated largely effective rather than fully effective. Austrian overrides are created and reviewed by the same Munich team against the same RepairDesk configuration as the German entity, so any deficiency in that configuration applies identically here, and this entity cannot reasonably assess the shared control more favourably than the entity that operates it. Austrian overrides rose from 71 in August 2026 to 128 in September 2026, a proportional increase of 80.3 percent, which is steeper than the German movement. Scenario figures.",
      changeFromPrevious:
        "Moved from low to medium, and from within appetite to the limit of appetite. EXC-TST-2026-0318-03 on 19.08.2026 is an Austrian item: the override reason code was recorded, the evidence reference was null, and the reviewer approved with no documented basis, stating on interview that the rule defect was well known in the team and that no document existed.",
    },
    {
      riskId: "RSK-0212",
      controlIds: ["CTL-PAY-031", "CTL-PAY-029", "CTL-PAY-034"],
      controlEffectiveness: "largely-effective",
      commentary:
        "The Austrian entity shares the euro clearing routes and the fallback arrangement with the German entity, so it inherits both the route substitution exposure and the control environment that applies during fallback operation, without any separate ability to decide when the fallback is activated.",
    },
    {
      riskId: "RSK-0214",
      controlIds: ["CTL-PAY-008", "CTL-PAY-029"],
      controlEffectiveness: "fully-effective",
      commentary:
        "CTL-PAY-008 operates centrally in the Arcadia Payment Hub for all three entities and was tested across the full population, so the Austrian conclusion follows the group test result.",
    },
  ]),

  /* Arcadia Bank Schweiz AG, Q3 2026. Swiss framework references only. */
  ...linesFor("RCSA-ARC-CH-PAYOPS-2026-Q3", [
    {
      riskId: "RSK-0216",
      controlIds: ["CTL-PAY-037", "CTL-PAY-014", "CTL-PAY-029"],
      controlEffectiveness: "partially-effective",
      commentary:
        "CTL-PAY-037 confirms submission completion reliably and cannot support the decision it exists to trigger. The only fallback available to this entity is manual submission through a correspondent bank under runbook RB-PAY-011, requiring 45 minutes of preparation against a 16:00 CET same-day cut-off, so the decision to invoke it must be taken before the outcome it protects against is known. There is no direct SIC participant link and no automated alternative route.",
      changeFromPrevious:
        "Moved from medium to high, and from the limit of appetite to outside appetite. The assessment records the 45 minute preparation lead time as a design constraint rather than an operational one, because no amount of control operation shortens it.",
    },
    {
      riskId: "RSK-0301",
      controlIds: ["CTL-RES-004", "CTL-RES-009", "CTL-RES-013", "CTL-PAY-037"],
      controlEffectiveness: "partially-effective",
      commentary:
        "CTL-RES-004 rated partially effective on the substance of what it approved rather than on how it operated. Impact tolerance ITOL-0004-03, approved by the Arcadia Bank Schweiz AG Board Risk Committee on 24.02.2026, carries two measures, a maximum tolerable disruption of 2 hours and completion of submission before the 16:00 CET cut-off, with no stated precedence between them. The two measures can diverge, and where they diverge the entity cannot state whether it breached its own tolerance. That is a governance gap in an approved tolerance and the operating unit cannot close it.",
    },
    {
      riskId: "RSK-0184",
      controlIds: ["CTL-TPR-007", "CTL-TPR-015", "CTL-TPR-019"],
      controlEffectiveness: "largely-effective",
      commentary:
        "This entity depends on the same provider as the euro entities for its clearing adapter while holding no fallback of its own, so a provider degradation that the euro entities can route around leaves this entity with a manual process and a decision under a hard cut-off. The concentration is identical and the mitigation is not.",
    },
  ]),

  /* Third-Party Risk Management unit, Arcadia Bank AG, Q3 2026. */
  ...linesFor("RCSA-ARC-DE-TPRM-2026-Q3", [
    {
      riskId: "RSK-0184",
      controlIds: ["CTL-TPR-002", "CTL-TPR-007", "CTL-TPR-015", "CTL-TPR-019", "CTL-TPR-028"],
      controlEffectiveness: "largely-effective",
      commentary:
        "The assessments the policy requires are performed and are performed on time. The exposure the assessment cannot close is structural: tiering is applied per arrangement and not per concentration, so a provider supplying validation, repair and Swiss clearing is assessed three times and never once as the single dependency it is. Held outside appetite under the conditional Risikoakzeptanz dated 19.01.2026.",
    },
    {
      riskId: "RSK-0185",
      controlIds: ["CTL-TPR-011", "CTL-TPR-007", "CTL-TPR-002"],
      controlEffectiveness: "partially-effective",
      commentary:
        "CTL-TPR-011 reconciles the submitted subprocessor list against the binding appendix each quarter and does identify differences. It cannot resolve which appendix version is binding, which is a legal determination sitting with Outsourcing Counsel, and MSN-2026-0191 is open at 40 percent with a date of 13.11.2026. KRI-TPR-002 moved from amber into red in the September 2026 run. Scenario figures.",
    },
    {
      riskId: "RSK-0186",
      controlIds: ["CTL-TPR-019", "CTL-TPR-023"],
      controlEffectiveness: "not-effective",
      commentary:
        "The exit and substitutability plan for the repair and override workbench service exists and has never been exercised, so neither the elapsed time to substitute nor the control environment during substitution is known. There is no substitutable product in service anywhere in the group. MSN-2026-0177, the exit test that is a stated condition of the RSK-0184 acceptance, is not started with a date of 31.12.2026. The control is rated not effective rather than not tested, because the maintenance limb operated and produced a document asserting an untested capability.",
    },
  ]),

  /* Operational Resilience, Arcadia Bank AG, Q3 2026. */
  ...linesFor("RCSA-ARC-DE-RESIL-2026-Q3", [
    {
      riskId: "RSK-0301",
      controlIds: ["CTL-RES-004", "CTL-RES-009", "CTL-RES-013"],
      controlEffectiveness: "partially-effective",
      commentary:
        "Impact tolerances are set and approved for every important business service, and the testing that would demonstrate they can be met is incomplete for a material share of them. CTL-RES-013 incident classification operates well and sits downstream of the gap: a service degradation handled inside an operating team without an incident record never reaches it, which is how five fallback activations totalling 8 hours 40 minutes in September 2026 produced no incident, no classification and no entry in committee reporting.",
    },
    {
      riskId: "RSK-0302",
      controlIds: ["CTL-RES-009", "CTL-PAY-034", "CTL-TPR-019"],
      controlEffectiveness: "partially-effective",
      commentary:
        "The euro clearing fallback has been exercised in production on seven occasions since November 2024 and has never been the subject of a scenario test, so no record exists of the control environment that applies while it is active. Runbook RB-PAY-007 section 4 asserts that the control environment is unchanged during fallback operation. The assertion has never been tested and is not correct, which makes it a finding rather than a gap in coverage.",
    },
  ]),

  /* NFR Governance and Internal Control, Arcadia Bank AG, Q3 2026. */
  ...linesFor("RCSA-ARC-DE-GOVCTL-2026-Q3", [
    {
      riskId: "RSK-0331",
      controlIds: ["CTL-GOV-005"],
      controlEffectiveness: "partially-effective",
      commentary:
        "Tracking and reporting are accurate: seven actions were overdue at group level at the September 2026 month end and the position is reported monthly. The escalation limb has not produced the consequence the framework attaches to it. MSN-2026-0147 is 67 days past a revised due date of 31.07.2026 that had already been extended once by the NFR Committee on 14.04.2026, and neither a re-baseline with a root-cause explanation nor a board referral has been recorded.",
    },
    {
      riskId: "RSK-0332",
      controlIds: ["CTL-GOV-016", "CTL-GOV-012", "CTL-TPR-028"],
      controlEffectiveness: "partially-effective",
      commentary:
        "CTL-GOV-016 key control description review stands at 91.3 percent against a 95 percent threshold, and the eight controls outside the review period include CTL-PAY-014, whose description at version 4.1 dated 14.01.2025 predates a configuration change that altered the condition the system enforces. CTL-GOV-012 identified the mechanism on 27.08.2026 in EXC-TST-2026-0318-04, classified the root cause as system configuration and raised no action against the rule. The testing limb of the framework worked. The limb that turns a finding into an owner and a date did not. Scenario figures.",
    },
    {
      riskId: "RSK-0262",
      controlIds: ["CTL-GOV-021", "CTL-PAY-017", "CTL-TPR-007"],
      controlEffectiveness: "not-effective",
      commentary:
        "Two sampled items in one test could not be concluded, both caused by provider design choices Arcadia accepted without examining: a service account identity written by a bulk approval screen with the human identity held in a log retained for 30 days, and an evidence object moved by a provider retention job. The first is permanently unrecoverable. Neither failure is within the control owner's power to fix alone, which is why evidence retrievability has to be confirmed against the contractual requirement before a provider system is relied upon for assurance rather than after.",
    },
  ]),
];
