/**
 * The synthetic evidence corpus.
 *
 * Every AI supported conclusion in NFR WorkOS cites rows from this table by
 * identifier, so this file is the factual floor of the product. If a claim
 * cannot be traced to a document here, the product must not make it.
 *
 * Authoritative source: docs/SCENARIO_BIBLE.md, in particular section 16,
 * which fixes the identifiers of the artefacts the scenario already expects
 * to exist. Every artefact named in section 16 appears below with the exact
 * identifier the bible gives it. Where this module and the bible disagree,
 * the bible wins and this module is fixed.
 *
 * Every document is synthetic. Arcadia Banking Group, its entities, its
 * people, Novalink Payment Services GmbH and every figure below are invented
 * for this scenario. Nothing here is drawn from a real institution, a real
 * supplier or a real supervisory file.
 *
 * Reading notes for whoever maintains this file.
 *
 * 1. Bodies are written in the register of the real artefact. A control test
 *    report has a scope paragraph, a methodology paragraph, findings and a
 *    conclusion. A supplier questionnaire response is written in the
 *    supplier's voice, including where the answer dodges the question.
 *    Retrieval quotes these bodies to banking executives, so thin filler is
 *    worse than no document at all.
 * 2. "provenance" is not decoration. An approved record in the GRC platform
 *    is "approved-record". A supplier's own assertion is
 *    "stakeholder-statement" and stays attributed for ever. A system extract
 *    is "telemetry" where it is a measurement and "verified-fact" where it is
 *    an authoritative record of what happened.
 * 3. Seven documents do not exist. They are recorded as "requested" or
 *    "missing" with the person they were asked of and the date they were
 *    asked. Chasing those is the work, and a corpus that hides its own gaps
 *    teaches the wrong lesson.
 * 4. Several pairs of documents contradict each other on purpose. The
 *    contradictions are readable in the bodies, not asserted in a metadata
 *    field, because that is the only kind a retrieval system can find.
 * 5. Regulatory references carry the mandatory label verbatim. DORA and EBA
 *    guidance are referenced for ARC-DE and ARC-AT only. ARC-CH is addressed
 *    through FINMA operational risk, resilience and outsourcing context.
 *
 * Synthetic institution and data. Illustrative regulatory context, not legal
 * advice.
 */

import {
  DEFAULT_RUN_ID,
  ENTITY_AT,
  ENTITY_CH,
  ENTITY_DE,
  at,
  type NewEvidenceDocument,
} from "./contract";

/** All three entities, in the order the bible lists them. */
const ALL_ENTITIES = [ENTITY_DE, ENTITY_AT, ENTITY_CH];

/** The two EU credit institutions. DORA and EBA references stop here. */
const EU_ENTITIES = [ENTITY_DE, ENTITY_AT];

/** The mandatory label, written once so it cannot drift between documents. */
const REG_LABEL = "Illustrative regulatory context, not legal advice.";

export const evidenceDocuments: NewEvidenceDocument[] = [
  /* ========================================================================
     1. PAYMENTS CONTROL EVIDENCE
     The control, its history, the test that found it wanting, and the first
     line position that refuses the finding.
     ======================================================================== */

  /*
   * The control description itself. Two things make this document matter more
   * than its length suggests: it says "without exception", and it has not
   * been touched since 14.01.2025, which is two months after RD-RULE-0031
   * introduced an exception. Read against EVD-2026-41905 it is simply wrong.
   */
  {
    id: "EVD-2026-41908",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-014 v4.1",
    title:
      "Control description CTL-PAY-014, independent secondary review of manual payment overrides, version 4.1",
    titleDe:
      "Kontrollbeschreibung CTL-PAY-014, unabhaengige Zweitpruefung manueller Zahlungsueberschreibungen, Version 4.1",
    sourceType: "control-description",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Beatrix Hofmann, Payment Repair Team Lead, control owner",
    authorUserId: "P-008",
    documentDate: "2025-01-14",
    ingestedAt: "2025-01-14T16:22:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: true,
    stalenessNote:
      "Last reviewed 14.01.2025, which is 630 days before the scenario day. The Group Internal Control System Standard section 2.6 requires the description of a key control to be reviewed at least annually and whenever a change is made to a system on which the control depends. RepairDesk release 8.3 changed that system on 11.11.2024, two months before this version was issued, and the change is not reflected here.",
    provenance: "approved-record",
    body:
      "CONTROL RECORD CTL-PAY-014. Version 4.1. Effective 14.01.2025. Status: active. Entity scope: ARC-DE, ARC-AT, ARC-CH. Internal Control System / Internes Kontrollsystem (IKS) designation: key control.\n\n" +
      "Control objective. Ensure that every manual override of a payment validation block is independently reviewed and approved by a qualified secondary reviewer before the payment is released.\n\n" +
      "Control statement. For each manual override created in RepairDesk, an independent secondary reviewer who did not create the override reviews the override reason, the supporting evidence and the payment detail, and records approval in RepairDesk before the payment is released. This applies to all overrides without exception.\n\n" +
      "Control attributes. Type: preventive. Nature: hybrid, comprising a manual review action and a system-enforced gate. Frequency: per occurrence, with a monthly monitoring review performed by the control owner. Risk mitigated: RSK-0211 erroneous or unauthorised payment release. Parent process: PRC-0041 payment repair and manual override. Parent service: IBS-0004 Corporate Payments.\n\n" +
      "System dependency. SYS-0014 Novalink RepairDesk enforces the gate. The override record holds the reviewer identity, the review timestamp, the review decision and the evidence reference. Release is not permitted until the review decision is recorded.\n\n" +
      "Evidence of operation. For each override, the RepairDesk override record, the review record, and the evidence object referenced in the override record. The monthly monitoring review is evidenced by the control owner's signed monitoring note held in SYS-0032.\n\n" +
      "Accountabilities. Control owner, first line: Beatrix Hofmann, Payment Repair Team Lead. Process owner: Andreas Kellner, Head of Payment Operations. Assurance owner, second line: Jakob Steinbacher, Group Control Assurance.\n\n" +
      "Change history. Version 4.1, 14.01.2025: removed the value threshold carried in version 3.4 and extended the requirement to all override reason codes. Version 3.4, 30.06.2023: original threshold-based statement. No change recorded since 14.01.2025.\n\n" +
      "Reviewer note recorded at issue. The version 4.1 statement was strengthened deliberately so that no override reason code and no payment value would fall outside the requirement. The description does not enumerate system conditions under which the gate does not operate, because at the date of issue the control owner recorded that no such condition exists.",
    summary:
      "The active version of the CTL-PAY-014 control description. It requires independent secondary review of every manual payment override with no exception for reason code, value or operating mode, and it has not been reviewed since January 2025.",
    relatedObjectIds: [
      "CTL-PAY-014",
      "RSK-0211",
      "PRC-0041",
      "IBS-0004",
      "SYS-0014",
      "POL-IKS-3.2",
      "MSN-2026-0203",
    ],
    pageCount: 3,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Kept because the direction of travel is counter-intuitive and a reader
   * will ask. Arcadia tightened the wording in January 2025 while the system
   * had already been loosened in November 2024. Nobody was careless with the
   * text; they were careless about the configuration.
   */
  {
    id: "EVD-2026-41860",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-014 v3.4",
    title:
      "Control description CTL-PAY-014, independent secondary review of manual payment overrides, version 3.4, superseded",
    titleDe: "Kontrollbeschreibung CTL-PAY-014, Version 3.4, ersetzt",
    sourceType: "control-description",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Beatrix Hofmann, Payment Repair Team Lead, control owner",
    authorUserId: "P-008",
    documentDate: "2023-06-30",
    ingestedAt: "2023-06-30T11:05:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "superseded",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "CONTROL RECORD CTL-PAY-014. Version 3.4. Effective 30.06.2023. Status: superseded by version 4.1 on 14.01.2025. Retained under the immutable versioning rule; this identifier is not reused.\n\n" +
      "Control statement as it then stood. For each manual override created in RepairDesk with a payment value at or above EUR 15,000, an independent secondary reviewer who did not create the override reviews the override reason and the payment detail and records approval in RepairDesk before the payment is released. Overrides below EUR 15,000 are subject to next-business-day sampling by the Duty Manager.\n\n" +
      "Basis of the threshold. The threshold was set in 2021 on a throughput argument: at the volumes then being handled, per-occurrence review of low-value overrides was assessed by the first line as disproportionate, and the sampling control CTL-PAY-021 was introduced as the compensating measure for the population below the threshold.\n\n" +
      "Reason for supersession. The 2024 internal control system review recorded that a value threshold on an authorisation control is a weak design, because the risk being mitigated is unauthorised release rather than loss of value, and a misdirected low-value payment carries the same authorisation failure as a high-value one. Version 4.1 removed the threshold and extended the requirement to all overrides.\n\n" +
      "Pointer. Current version: CTL-PAY-014 v4.1, EVD-2026-41908.",
    summary:
      "The superseded version of the control description, which carried a EUR 15,000 value threshold. It is retained because it shows Arcadia deliberately strengthening the written control in January 2025, two months after the system quietly acquired a waiver.",
    relatedObjectIds: ["CTL-PAY-014", "CTL-PAY-021", "RSK-0211", "PRC-0041"],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The two controls the first line leans on in the RCSA argument. The
   * descriptions are honest about what each one cannot do, which is why the
   * second line quotes them back.
   */
  {
    id: "EVD-2026-41865",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-021 v2.2 and CTL-PAY-029 v1.6",
    title:
      "Control descriptions CTL-PAY-021 override sampling and CTL-PAY-029 payment value reconciliation",
    titleDe:
      "Kontrollbeschreibungen CTL-PAY-021 Stichprobenpruefung und CTL-PAY-029 Zahlungswertabstimmung",
    sourceType: "control-description",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Andreas Kellner, Head of Payment Operations",
    authorUserId: "P-007",
    documentDate: "2026-02-17",
    ingestedAt: "2026-02-17T09:40:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "CONTROL RECORD CTL-PAY-021. Version 2.2. Next-business-day sampling of manual overrides.\n\n" +
      "Control statement. On each business day the Duty Manager, Payment Operations selects a sample of not less than 10 percent of the manual overrides released on the previous business day and re-performs the review of the override reason, the supporting evidence and the payment detail. Exceptions are recorded in the daily control log and referred to the control owner.\n\n" +
      "Attributes. Type: detective. Nature: manual. Frequency: daily, on the previous day's population. Risk mitigated: RSK-0211. Sample basis: judgemental selection weighted to higher values and to override reason codes OVR-A and OVR-E.\n\n" +
      "Stated limitation, recorded at version 2.0. This control operates after release. It cannot prevent an erroneous or unauthorised release, and at a 10 percent sample it is not designed to give assurance over the whole population. It is designed to detect a pattern, not an instance.\n\n" +
      "CONTROL RECORD CTL-PAY-029. Version 1.6. Daily payment value reconciliation.\n\n" +
      "Control statement. On each business day the payment value released from SYS-0011 Arcadia Payment Hub is reconciled to clearing confirmations received from the clearing route used, by entity, by currency and by value date. Unreconciled items are investigated on the day of identification and escalated to Treasury Operations if unresolved at the end of the following business day.\n\n" +
      "Attributes. Type: detective. Nature: automated, with manual investigation of breaks. Frequency: daily. Risk mitigated: RSK-0208 payment settlement and reconciliation failure, with a secondary reference to RSK-0211.\n\n" +
      "Stated limitation, recorded at version 1.4. The reconciliation matches value, not authorisation and not beneficiary. A payment that was released without the required review, and that settles for the correct amount to an incorrect beneficiary or through an incorrect intermediary institution, reconciles cleanly and is not detected by this control.",
    summary:
      "The two controls the first line cites as compensating for CTL-PAY-014. Both descriptions state their own limits: CTL-PAY-021 is detective, next-day and sampled at 10 percent, and CTL-PAY-029 reconciles value rather than authorisation or beneficiary.",
    relatedObjectIds: [
      "CTL-PAY-021",
      "CTL-PAY-029",
      "CTL-PAY-014",
      "RSK-0211",
      "PRC-0041",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * One half of the day's central contradiction. This is the second line
   * conclusion: Partially Effective, design and operating deficiency. Read it
   * against EVD-2026-41855, where the control owner records Fully Effective
   * over the same period on the same population.
   */
  {
    id: "EVD-2026-41850",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0318",
    title:
      "Control test report TST-2026-0318, CTL-PAY-014 design and operating effectiveness",
    titleDe:
      "Kontrolltestbericht TST-2026-0318, CTL-PAY-014 Ausgestaltung und Wirksamkeit",
    sourceType: "control-test-report",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel:
      "Jakob Steinbacher, Control Assurance Specialist, Group Control Assurance",
    authorUserId: "P-004",
    documentDate: "2026-09-25",
    ingestedAt: "2026-09-25T15:12:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "CONTROL TEST REPORT TST-2026-0318. Issued 25.09.2026. Combined design effectiveness and operating effectiveness test of CTL-PAY-014, independent secondary review of manual payment overrides. Performed by Group Control Assurance, second line of defence.\n\n" +
      "1. Scope. The test covers CTL-PAY-014 as it operated in ARC-DE, ARC-AT and ARC-CH during the period 01.06.2026 to 31.08.2026. The population is every manual override record created in SYS-0014 Novalink RepairDesk in the period, being 1,204 records across the three entities. Fieldwork was performed between 07.09.2026 and 24.09.2026. The scope includes the design of the control as described in CTL-PAY-014 version 4.1 and the operation of the control as evidenced in RepairDesk and in SYS-0032 Arcadia Evidence Vault. The scope excludes the sanctions screening queue, which is a separate population under SYS-0016, and excludes the compensating controls CTL-PAY-021 and CTL-PAY-029, which were not tested in this engagement.\n\n" +
      "2. Methodology. Attribute sampling was used, statistical, with random selection from the full population using a seeded generator so that the selection is reproducible. Sample size 60. Tolerable deviation rate 5 percent. Expected deviation rate 0 percent, on the basis that the control is a preventive authorisation control on which no deviation is planned. Five attributes were tested on each sampled item: (a) a secondary review record exists; (b) the reviewer is not the override creator; (c) the review timestamp precedes the release timestamp; (d) an evidence reference is present and retrievable; (e) the override reason code is one of OVR-A to OVR-E and is consistent with the failure reason codes recorded on the instruction. Where an attribute could not be evaluated because the evidence was not obtainable, the item was recorded as unable to conclude rather than as conforming, in accordance with the Group Internal Control System Standard section 3.2.\n\n" +
      "3. Design assessment. The control as described requires review of every override without exception. Walkthrough of the RepairDesk override transition on 09.09.2026 established that the requirement for secondary review is not a fixed property of the transition but is derived at runtime by rule evaluation, and that the derived value is written to the field secondaryReviewRequired. The tester requested the rule set governing that derivation on 11.09.2026 and again on 17.09.2026 and did not obtain it within the fieldwork period. The design assessment is therefore qualified: the control description states an absolute requirement, and the system derives the requirement conditionally by a mechanism the tester could not inspect.\n\n" +
      "4. Results. Of 60 sampled items, 54 showed no deviation on any attribute. Four items were recorded as exceptions, being EXC-TST-2026-0318-01 to EXC-TST-2026-0318-04. Two items were recorded as unable to conclude, being UTC-TST-2026-0318-01 and UTC-TST-2026-0318-02. The deviation rate on the exceptions alone is 4 of 60, being 6.67 percent, against a tolerable rate of 5 percent. Treating the unable-to-conclude items as deviations gives 6 of 60, being 10.00 percent. The report states both rates because the true rate is not known: two items cannot be resolved either way, and presenting only the lower figure would misstate the position.\n\n" +
      "5. Findings. EXC-TST-2026-0318-01, 14.07.2026, ARC-DE, EUR 84,300, OVR-B: a review record exists but the reviewer identity equals the override creator, the system having permitted self-review because the analyst held both role assignments. This is the failure that Massnahme MSN-2026-0147 was raised in November 2025 to prevent, and that Massnahme is overdue. EXC-TST-2026-0318-02, 06.08.2026, ARC-DE, EUR 1,215,000, OVR-D: released at 16:47:12 and reviewed at 16:58:31, the review occurring 11 minutes and 19 seconds after release. A preventive control that operates after the event is not preventive. EXC-TST-2026-0318-03, 19.08.2026, ARC-AT, EUR 12,400, OVR-A: override reason recorded and the evidence reference null, so the reviewer approved with no documented basis; the reviewer confirmed on interview on 16.09.2026 that the rule defect was well known in the team and that no document existed. EXC-TST-2026-0318-04, 27.08.2026, ARC-DE, EUR 46,900, OVR-C: no secondary review record exists, secondaryReviewRequired is false, and the rule evaluation trace records that RD-RULE-0031 fired and set a review waiver code of BCP-THROUGHPUT while the fallback route mode was active. Root cause recorded as system configuration.\n\n" +
      "6. Items on which the tester could not conclude. UTC-TST-2026-0318-01, 02.07.2026, ARC-DE, EUR 233,800, OVR-B: the reviewer identity is svc_repairbatch, a Novalink service account, and Arcadia cannot determine which human, if any, performed the review; Novalink advised on 18.09.2026 that the human identity is held in an application log with 30-day retention and that the log had expired. UTC-TST-2026-0318-02, 21.08.2026, ARC-DE, EUR 3,100, OVR-E: a review record with a named human reviewer exists and the attached evidence object is a broken link following a supplier retention job on 01.09.2026. Combined value of the exception and unable-to-conclude set is EUR 1,595,500.\n\n" +
      "7. Conclusion. Control Effectiveness / Kontrollwirksamkeit: Partially Effective / Teilweise wirksam. A design deficiency exists, in that the requirement stated in the control description is subject to a runtime condition that the description does not disclose and that the tester was unable to inspect. An operating deficiency exists, in that three of the four exceptions are human execution failures independent of any system condition. The control provides some mitigation and is not assessed as Not Effective, because 54 of 60 sampled items show the control operating as described. The second line does not accept a Fully Effective assessment for this period.\n\n" +
      "8. Recommendations. Obtain and inspect the RepairDesk rule set governing derivation of secondaryReviewRequired and reconcile it to the control description. Complete MSN-2026-0147. Make the evidence reference a mandatory field on the override record. Establish with the supplier how a human identity can be recovered where a service account is recorded. Extend the next test population to include fallback operating periods.\n\n" +
      "9. Management response. Requested from the control owner on 25.09.2026 with a response date of 02.10.2026. As at the date of issue the control owner has not accepted the conclusion. The divergence is referred to the NFR Committee under agenda item AG-CMT-NFR-2026-10-03.",
    summary:
      "The second line test report on CTL-PAY-014, concluding Partially Effective with both a design and an operating deficiency, on four exceptions and two items the tester could not resolve out of a statistical sample of 60.",
    relatedObjectIds: [
      "TST-2026-0318",
      "CTL-PAY-014",
      "RSK-0211",
      "PRC-0041",
      "SYS-0014",
      "RD-RULE-0031",
      "EXC-TST-2026-0318-01",
      "EXC-TST-2026-0318-02",
      "EXC-TST-2026-0318-03",
      "EXC-TST-2026-0318-04",
      "UTC-TST-2026-0318-01",
      "UTC-TST-2026-0318-02",
      "MSN-2026-0147",
      "AG-CMT-NFR-2026-10-03",
      "POL-IKS-3.2",
    ],
    pageCount: 24,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The working papers behind the report. Needed because the exception detail
   * is what makes the design versus operating distinction arguable at all,
   * and because item 4 is where the rule was visible 41 days early.
   */
  {
    id: "EVD-2026-41852",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0318 WP-07",
    title:
      "Control test TST-2026-0318 working paper WP-07, exception and unable-to-conclude schedule",
    titleDe:
      "Arbeitspapier WP-07 zum Kontrolltest TST-2026-0318, Feststellungen und nicht abschliessend beurteilbare Positionen",
    sourceType: "control-test-report",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Jakob Steinbacher, Control Assurance Specialist",
    authorUserId: "P-004",
    documentDate: "2026-09-24",
    ingestedAt: "2026-09-24T18:31:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "WORKING PAPER WP-07. Prepared 24.09.2026. Supports section 5 and section 6 of TST-2026-0318. Contains payment values and internal identifiers; classified strictly confidential.\n\n" +
      "Schedule A, exceptions.\n\n" +
      "Item 1. EXC-TST-2026-0318-01. Sample reference S-014. Override date 14.07.2026. Entity ARC-DE. Queue Q-REPAIR-DE. Value EUR 84,300. Override reason OVR-B, client-confirmed correction received out of band. Failure reason codes on the instruction: R03. Attribute failed: (b) reviewer is not the override creator. Evidence inspected: RepairDesk override record, review record, evidence object. Observation: createdBy and secondaryReviewerId hold the same analyst identity. The RepairDesk role model granted that analyst both the Repair Analyst and the Secondary Reviewer role assignment and the system accepted the review. Tester note: this is the precise failure mode described in AUD-2025-09 finding F3 and addressed by MSN-2026-0147, whose revised due date was 31.07.2026. The override occurred 17 days before that date.\n\n" +
      "Item 2. EXC-TST-2026-0318-02. Sample reference S-031. Override date 06.08.2026. Entity ARC-DE. Value EUR 1,215,000. Override reason OVR-D, cut-off driven release with post-release completion. Failure reason codes: R02. Attribute failed: (c) review timestamp precedes release timestamp. Observation: releasedAt 16:47:12, secondaryReviewAt 16:58:31, reviewDecision APPROVED. Elapsed 11 minutes and 19 seconds between release and review. Interview with the releasing analyst on 15.09.2026: the instruction was released to meet the same-day cut-off and the review was completed immediately afterwards because the reviewer was occupied on another item. Tester note: highest value item in the exception set. The system did not block release in the absence of a recorded review decision, which is a design observation carried into section 3.\n\n" +
      "Item 3. EXC-TST-2026-0318-03. Sample reference S-042. Override date 19.08.2026. Entity ARC-AT. Value EUR 12,400. Override reason OVR-A, validation rule false positive. Failure reason codes: R01. Attribute failed: (d) evidence reference present and retrievable. Observation: evidenceRef is null. The override record carries a free-text note reading, in translation, rule defect known. Interview with the reviewer on 16.09.2026: the reviewer stated that the validation rule defect was well known within the team, that the team had been told by Novalink to suppress the rule, and that no document had been issued that the reviewer could attach. Tester note: the evidenceRef field is nullable in the RepairDesk schema. The control description requires supporting evidence; the system does not require it.\n\n" +
      "Item 4. EXC-TST-2026-0318-04. Sample reference S-057. Override date 27.08.2026. Entity ARC-DE. Value EUR 46,900. Override reason OVR-C, route substitution. Failure reason codes: R01, R04. Attribute failed: (a) a secondary review record exists. Observation: no review record exists. secondaryReviewRequired is false. secondaryReviewerId is null. reviewWaiverCode is BCP-THROUGHPUT. The ruleEvaluationTrace records four rules evaluated on the OVERRIDE_PROPOSED transition, of which the third, identified as RD-RULE-0031, returned a result of waived with the audit note secondary review waived under business continuity throughput provision. fallbackRouteMode was ACTIVE on the queue between 15:22 and 17:05 on 27.08.2026 following a NOVA-GATE latency incident. Tester note: root cause recorded as system configuration. The rule definition was requested from Novalink on 11.09.2026 and 17.09.2026 and was not received within fieldwork. No Massnahme was raised against the rule. A documentation action was raised against the control description instead.\n\n" +
      "Schedule B, unable to conclude.\n\n" +
      "Item 5. UTC-TST-2026-0318-01. Sample reference S-009. Override date 02.07.2026. Entity ARC-DE. Value EUR 233,800. Override reason OVR-B. Observation: secondaryReviewerId is svc_repairbatch. reviewDecision APPROVED. secondaryReviewAt 11:04:17. The identity is a Novalink service account. Enquiry to Novalink 15.09.2026; response 18.09.2026: the service account identity is written when a review is submitted through the bulk approval screen, and the underlying human identity is held in an application log with a 30-day retention period. The relevant log had expired before the enquiry was made. Tester conclusion: the control may have operated and may not have operated. The evidence is permanently unavailable. Recorded as unable to conclude. Tester note: the bulk approval screen is in routine use, so this is not an isolated configuration; the population of overrides reviewed through that screen in the test period is 57 of 1,204.\n\n" +
      "Item 6. UTC-TST-2026-0318-02. Sample reference S-050. Override date 21.08.2026. Entity ARC-DE. Value EUR 3,100. Override reason OVR-E, technical suppression on supplier advice. Observation: a review record exists with a named human reviewer and a recorded decision. The evidence object referenced resolves to a broken link in the Novalink evidence store. Novalink acknowledged on 22.09.2026 that a retention job moved the object on 01.09.2026 and committed to restore it from archive by 10.10.2026. As at 24.09.2026 the file has not been produced. Recorded as unable to conclude, attribute (d).\n\n" +
      "Totals. Exceptions 4, combined value EUR 1,358,600. Unable to conclude 2, combined value EUR 236,900. Combined 6 items, EUR 1,595,500. Clean items 54. Sample 60.\n\n" +
      "Tester sign-off. Prepared and cross-referenced to the population extract of 07.09.2026. Reviewed by the Head of Group Control Assurance on 24.09.2026.",
    summary:
      "The itemised working paper behind the TST-2026-0318 findings, giving for each of the four exceptions and two unresolvable items the attribute that failed, the evidence inspected and the interview position taken by the first line.",
    relatedObjectIds: [
      "TST-2026-0318",
      "CTL-PAY-014",
      "EXC-TST-2026-0318-01",
      "EXC-TST-2026-0318-02",
      "EXC-TST-2026-0318-03",
      "EXC-TST-2026-0318-04",
      "UTC-TST-2026-0318-01",
      "UTC-TST-2026-0318-02",
      "RD-RULE-0031",
      "MSN-2026-0147",
      "AUD-2025-09",
      "TP-0042",
    ],
    pageCount: 11,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The other half of the central contradiction, and the document the
   * assistant must never paraphrase into a fact. Note the two separable
   * claims: one about her team, which turns out to be true, and one about how
   * RepairDesk writes reviewer identity, which EVD-2026-41905 disproves at
   * 15:38. Keeping them separable is the whole point.
   */
  {
    id: "EVD-2026-41855",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-ARC-DE-PAYOPS-2026-Q4 CTL-PAY-014 1LoD",
    title:
      "First line control self-assessment, CTL-PAY-014, Q4 2026 cycle, recorded by the control owner",
    titleDe:
      "Kontrollselbstbewertung der ersten Verteidigungslinie, CTL-PAY-014, Zyklus Q4 2026",
    sourceType: "rcsa-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Beatrix Hofmann, Payment Repair Team Lead, control owner",
    authorUserId: "P-008",
    documentDate: "2026-09-29",
    ingestedAt: "2026-09-29T17:48:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "FIRST LINE CONTROL SELF-ASSESSMENT. Control CTL-PAY-014. Assessment cycle Q4 2026. Recorded 29.09.2026 by the control owner. This is the first line assessment form and records the control owner's own position.\n\n" +
      "Assessment. Control Effectiveness: Fully Effective / Voll wirksam.\n\n" +
      "Basis of assessment, as recorded by the control owner. The control operates on every manual override created in RepairDesk. Every override goes through four-eyes review. In the period under assessment my team released no payment without a secondary review being performed. The four items raised by Group Control Assurance are documentation and timing matters, not authorisation failures, and in every one of the four cases the payment itself was subsequently confirmed correct by the client. No financial loss arose and no client complaint was received.\n\n" +
      "Response to the individual findings. On the self-review item, the reviewer was a qualified senior analyst and the review was genuinely performed; the defect is that RepairDesk permitted the same identity to hold both role assignments, which is a system matter already being fixed under MSN-2026-0147 and NOVA-CR-4412. On the timing item, the review was performed within twelve minutes of release under cut-off pressure and the payment was correct; the sequence is wrong on the record but the substance of the control was delivered. On the missing evidence item, the rule defect was known across the team and there was no document to attach; requiring a document that does not exist is a system design point, not a failure by the reviewer. On the fourth item, the record shows that the system did not ask for a review, which is a configuration matter for Technology and not a matter for my team.\n\n" +
      "On the two items Group Control Assurance could not conclude. Both are RepairDesk record-keeping matters. Where the reviewer identity shows a service account, the review was submitted through the bulk approval screen and the reviewer was a member of my team; RepairDesk backfills reviewer identities at the end of the batch cycle and the record therefore shows the batch identity rather than the individual. Where the evidence object is a broken link, the supplier has moved the file and has undertaken to restore it. Neither item indicates that a review did not occur.\n\n" +
      "Compensating controls relied upon. CTL-PAY-021, next-business-day sampling of overrides by the Duty Manager at a minimum 10 percent sample. CTL-PAY-029, daily payment value reconciliation between SYS-0011 and clearing confirmations. Both controls operated without exception in the period.\n\n" +
      "Resourcing comment. The approved establishment for senior secondary reviewers is 4.0 full-time equivalent and 3.0 is filled following the resignation of the holder of position PR-SR-02 on 31.07.2026. Recruitment is in progress under MSN-2026-0166. The team has absorbed the gap through a rota change and the control has continued to operate.\n\n" +
      "Control owner declaration. I confirm that the control described in CTL-PAY-014 version 4.1 operated as described throughout the assessment period and that there is no bypass of the four-eyes requirement in the process I own. I do not accept the Partially Effective conclusion recorded in TST-2026-0318.\n\n" +
      "Second line note appended 30.09.2026. The second line has not agreed this assessment. Under the Group Operational Risk Policy section 4.3 a control may not remain at fully effective where independent testing in the period identified exceptions, unless the second line records a documented basis for treating those exceptions as immaterial to the control objective. No such basis has been recorded. The divergence is referred to AG-CMT-NFR-2026-10-03.",
    summary:
      "The control owner's own Q4 assessment of CTL-PAY-014 as Fully Effective, rejecting the second line conclusion. It asserts that every override receives four-eyes review and that RepairDesk backfills reviewer identity at the end of the batch cycle.",
    relatedObjectIds: [
      "CTL-PAY-014",
      "RSK-0211",
      "RCSA-ARC-DE-PAYOPS-2026-Q4",
      "TST-2026-0318",
      "CTL-PAY-021",
      "CTL-PAY-029",
      "MSN-2026-0147",
      "MSN-2026-0166",
      "POL-ORP-4.3",
      "AG-CMT-NFR-2026-10-03",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Third line origin of the overdue Massnahme. It dates the self-review
   * problem to November 2025, which is what turns a July 2026 exception into
   * a follow-up discipline question rather than bad luck.
   */
  {
    id: "EVD-2026-41105",
    runId: DEFAULT_RUN_ID,
    reference: "AUD-2025-09-F3",
    title: "Internal audit report AUD-2025-09, Payment Operations, finding F3 extract",
    titleDe: "Revisionsbericht AUD-2025-09, Zahlungsverkehr, Auszug Feststellung F3",
    sourceType: "control-test-report",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Peter Maurer, Head of Group Internal Audit",
    authorUserId: "P-017",
    documentDate: "2025-11-28",
    ingestedAt: "2025-11-28T10:15:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "INTERNAL AUDIT REPORT AUD-2025-09. Payment Operations. Issued 28.11.2025. Third line of defence. Extract: finding F3 only. The full report contains six findings, of which F3 alone is in scope for the payments control file.\n\n" +
      "Finding F3. Segregation of duties / Funktionstrennung is not enforced in the payment override workflow. Rating: high.\n\n" +
      "Condition. SYS-0014 Novalink RepairDesk assigns capability by role and permits a single user identity to hold both the Repair Analyst role and the Secondary Reviewer role concurrently. Where a user holds both, the system accepts that user as the secondary reviewer of an override that the same user created. Audit tested 40 override records selected judgementally from the twelve months to 31.10.2025 and identified two records in which the override creator and the recorded secondary reviewer were the same identity. In both cases the payment was subsequently confirmed correct. Audit also established that 11 of the 34 Munich payment repair staff held both role assignments at the date of testing, and that the dual assignment is operationally convenient because it allows any team member to cover the reviewer function at short notice.\n\n" +
      "Criteria. CTL-PAY-014 requires that the secondary reviewer did not create the override. The Group Internal Control System Standard requires that a preventive authorisation control cannot be satisfied by the person whose action is being authorised.\n\n" +
      "Cause. The RepairDesk role model does not implement a mutual exclusion between the two role assignments, and Arcadia has not requested one. Arcadia's own user access review checks that role assignments are authorised, not that they are mutually compatible.\n\n" +
      "Effect. An override can be created and self-approved without any system intervention. The authorisation control on the highest-privilege action in the payment repair process can be satisfied by one person.\n\n" +
      "Recommendation. Management should implement role segregation enforcement in RepairDesk so that an override creator cannot be recorded as the secondary reviewer of that override, and should remove dual role assignments where enforcement cannot be delivered.\n\n" +
      "Management response, recorded 28.11.2025. Accepted. Owner: Andreas Kellner, Head of Payment Operations. Delegate: Beatrix Hofmann. Action: raise a change request with Novalink for system enforcement. Target date 31.03.2026. Management noted that removing dual role assignments in the interim would reduce reviewer coverage below the level needed to meet cut-offs and declined that element of the recommendation. Audit recorded that the interim position is therefore unmitigated.\n\n" +
      "Tracking. Massnahme MSN-2026-0147.",
    summary:
      "The internal audit finding that created MSN-2026-0147. It records in November 2025 that RepairDesk permits self-approval of overrides, that 11 of 34 staff held both roles, and that management declined the interim mitigation.",
    relatedObjectIds: [
      "AUD-2025-09",
      "MSN-2026-0147",
      "CTL-PAY-014",
      "SYS-0014",
      "PRC-0041",
      "RSK-0211",
    ],
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Gap 1 of 7, and the only one that can never be closed. The evidence for a
   * key control in the IKS was destroyed by a supplier retention period
   * before anybody thought to ask for it.
   */
  {
    id: "EVD-2026-41225",
    runId: DEFAULT_RUN_ID,
    reference: "REQ-2026-0618",
    title:
      "Requested: human reviewer identity behind service account svc_repairbatch for the override of 02.07.2026",
    titleDe:
      "Angefordert: Identitaet des menschlichen Pruefers hinter dem Dienstkonto svc_repairbatch",
    sourceType: "control-test-report",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Jakob Steinbacher, Control Assurance Specialist",
    authorUserId: "P-004",
    documentDate: "2026-09-16",
    ingestedAt: "2026-09-16T11:20:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "confidential",
    status: "missing",
    requestedFromLabel: "Novalink Payment Services GmbH, Client Service (Miriam Falk)",
    requestedOn: "2026-09-16",
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "What was asked. On 16.09.2026 Group Control Assurance asked Novalink to identify the human user who submitted the secondary review recorded against the override of 02.07.2026 for ARC-DE, value EUR 233,800, where the reviewer identity on the record is the service account svc_repairbatch. The request supported sample item S-009 in control test TST-2026-0318 and cited the audit and access right at CTR-2023-0117-A4 clause 2.1.\n\n" +
      "What came back. Novalink responded on 18.09.2026 that the service account identity is written whenever a review is submitted through the RepairDesk bulk approval screen, that the underlying human identity is held in a separate application log, and that the application log has a 30-day retention period. The log covering 02.07.2026 had already expired when the request was made.\n\n" +
      "Status. This evidence does not exist and cannot be produced. The item is recorded in TST-2026-0318 as UTC-TST-2026-0318-01, unable to conclude. It is not recorded as conforming and it is not recorded as a deviation, because neither is established.\n\n" +
      "Why it matters beyond one sample item. The bulk approval screen is in routine use. 57 of the 1,204 overrides in the test period were reviewed through it, and for each of those the same limitation applies. An audit trail defect on a key control in the Internal Control System / Internes Kontrollsystem (IKS) is not closed by a supplier statement that the record was once correct.",
    summary:
      "An unrecoverable evidence gap. Arcadia asked Novalink on 16.09.2026 which human approved an override recorded against a service account, and the supplier log holding that identity had already passed its 30-day retention.",
    relatedObjectIds: [
      "UTC-TST-2026-0318-01",
      "TST-2026-0318",
      "CTL-PAY-014",
      "TP-0042",
      "CTR-2023-0117-A4",
      "SYS-0014",
    ],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Gap 2 of 7. Still open and the supplier has put a date on it. Tracked
   * separately from the unrecoverable one, because this one can still close.
   */
  {
    id: "EVD-2026-41230",
    runId: DEFAULT_RUN_ID,
    reference: "REQ-2026-0641",
    title: "Requested: restoration of the evidence object attached to the override of 21.08.2026",
    titleDe: "Angefordert: Wiederherstellung des Nachweisobjekts zur Ueberschreibung vom 21.08.2026",
    sourceType: "control-test-report",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Jakob Steinbacher, Control Assurance Specialist",
    authorUserId: "P-004",
    documentDate: "2026-09-22",
    ingestedAt: "2026-09-22T14:05:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "confidential",
    status: "requested",
    requestedFromLabel: "Novalink Payment Services GmbH, Service Continuity (Ralf Ostermann)",
    requestedOn: "2026-09-22",
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "What was asked. On 22.09.2026 Group Control Assurance asked Novalink to restore the evidence object referenced by the override record of 21.08.2026 for ARC-DE, value EUR 3,100, override reason OVR-E. The reference resolves to a broken link in the Novalink evidence store.\n\n" +
      "What came back. Novalink acknowledged on 22.09.2026 that a retention job moved the object on 01.09.2026 and committed to restore it from archive by 10.10.2026. No file has been produced as at 06.10.2026 07:00.\n\n" +
      "Status. Outstanding. Recorded in TST-2026-0318 as UTC-TST-2026-0318-02, unable to conclude on attribute (d), evidence present and retrievable. If the object is produced the item can be concluded, because the review record itself names a human reviewer and a decision. This gap is recoverable in a way that UTC-TST-2026-0318-01 is not.\n\n" +
      "Follow-up. Chase due 08.10.2026. If the file is not produced by 10.10.2026 the item is reported to the NFR Committee as a supplier evidence retention finding rather than as a control operation finding.",
    summary:
      "An open evidence request. A supplier retention job moved the evidence object attached to one tested override on 01.09.2026, and Novalink has committed to restore it from archive by 10.10.2026.",
    relatedObjectIds: [
      "UTC-TST-2026-0318-02",
      "TST-2026-0318",
      "CTL-PAY-014",
      "TP-0042",
      "SVC-0042-02",
    ],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The document nobody read. The September override log already contained 14
   * releases in which the system had waived the review, and it went through
   * the monthly monitoring review unremarked five days before the event. The
   * monitoring template has no field that asks the question.
   */
  {
    id: "EVD-2026-41805",
    runId: DEFAULT_RUN_ID,
    reference: "QRY-2026-87402",
    title:
      "SYS-0014 override audit log extract, ARC-DE, September 2026, monthly monitoring population",
    titleDe: "Auszug aus dem Ueberschreibungsprotokoll SYS-0014, ARC-DE, September 2026",
    sourceType: "transaction-log",
    sourceSystem: "SYS-0014 Novalink RepairDesk",
    authorLabel: "Arcadia RiskCore scheduled extract, monthly monitoring job",
    authorUserId: null,
    documentDate: "2026-10-01",
    ingestedAt: "2026-10-01T06:05:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "EXTRACT QRY-2026-87402. Source SYS-0014 Novalink RepairDesk, override audit log. Entity partition ARC-DE. Period 01.09.2026 to 30.09.2026. Generated 01.10.2026 by the scheduled monthly monitoring job. Record count 731.\n\n" +
      "Field set extracted. overrideId, instructionId, entity, queue, overrideReasonCode, suppressedRuleIds, failureReasonCodes, valueAmount, valueCurrency, evidenceRef, createdBy, createdAt, fallbackRouteMode, secondaryReviewRequired, reviewWaiverCode, secondaryReviewerId, secondaryReviewAt, reviewDecision, releasedBy, releasedAt.\n\n" +
      "Population by override reason code. OVR-A 68. OVR-B 214. OVR-C 198. OVR-D 211. OVR-E 40. Total 731.\n\n" +
      "Derived counts included in the standard monitoring pack. Records with evidenceRef null: 38. Records with secondaryReviewerId equal to a service account identity: 19, all svc_repairbatch, all submitted through the bulk approval screen. Records where secondaryReviewAt is later than releasedAt: 4. Records where createdBy equals secondaryReviewerId: 1. Records with secondaryReviewRequired false: 14.\n\n" +
      "Detail on the 14 records with secondaryReviewRequired false. All 14 carry overrideReasonCode OVR-C. All 14 carry fallbackRouteMode ACTIVE at the moment of evaluation. All 14 carry reviewWaiverCode BCP-THROUGHPUT. All 14 have secondaryReviewerId null and no review record. All 14 have a valueAmount below EUR 250,000 and a valueCurrency of EUR. Combined value EUR 1,284,600. All 14 fall within the five fallback operating periods recorded for ARC-DE in September 2026.\n\n" +
      "Monitoring review disposition. The monthly monitoring review for September 2026 was performed by the control owner on 02.10.2026 and signed. The signed note addresses the 38 null evidence references, recorded as a known system limitation, and the 4 out-of-sequence reviews, recorded as cut-off pressure. The note does not address the 14 records with secondaryReviewRequired false. There is no field in the monitoring template that asks for them.\n\n" +
      "Extract integrity. Row count reconciles to the SYS-0011 override population for the same period. Content hash recorded in SYS-0032.",
    summary:
      "The September override log for ARC-DE. It already showed 14 releases in which the system recorded that no secondary review was required, all during fallback operation, and the monthly monitoring template has no field that asks about them.",
    relatedObjectIds: [
      "SYS-0014",
      "CTL-PAY-014",
      "KRI-PAY-007",
      "PRC-0041",
      "RD-RULE-0031",
      "RSK-0211",
    ],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* ========================================================================
     2. INDICATOR AND MEASUREMENT EVIDENCE
     What the numbers were, who published them, and the fact that each one
     went to a different owner with no cross-reference.
     ======================================================================== */

  {
    id: "EVD-2026-41820",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PACK-2026-09",
    title: "Group NFR key risk indicator pack, September 2026 reporting run",
    titleDe: "Konzernbericht Risikoindikatoren, Berichtslauf September 2026",
    sourceType: "kri-report",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Group Non-Financial Risk reporting, for the NFR Portfolio Lead",
    authorUserId: "P-001",
    documentDate: "2026-10-05",
    ingestedAt: "2026-10-05T06:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "KEY RISK INDICATOR PACK. Reporting period September 2026. Data as at 30.09.2026. Published 05.10.2026 at 06:00, being the third business day, in accordance with the monthly cycle.\n\n" +
      "Indicator summary.\n\n" +
      "KRI-PAY-007, manual override rate, ARC-DE, measured as overrides per 10,000 instructions released. Thresholds: green at or below 2.50, amber above 2.50 to 3.50, red above 3.50. August 2026: 2.20, green. September 2026: 3.84, red. Status: breach. First red reading in 14 months. Owner: Andreas Kellner. Monitored by Marlene Aigner.\n\n" +
      "KRI-PAY-003, payment repair rate, ARC-DE, measured as the percentage of instructions entering the repair queue. Thresholds: green at or below 2.00 percent, amber above 2.00 to 2.50 percent, red above 2.50 percent. August 2026: 2.28 percent, amber. September 2026: 2.70 percent, red. Status: breach, third consecutive month outside green. Owner: Andreas Kellner.\n\n" +
      "KRI-PAY-011, secondary reviewer capacity, ARC-DE, measured as filled reviewer full-time equivalent as a percentage of approved establishment. Thresholds: green at or above 95 percent, amber 85 to 94 percent, red below 85 percent. August 2026: 75.0 percent, red. September 2026: 75.0 percent, red. Status: breach, red since 01.08.2026. Owner: Andreas Kellner.\n\n" +
      "Reading note carried on every page of the pack. Every threshold and every reading in this pack is a scenario figure for a synthetic institution. Thresholds are set internally against Arcadia's own appetite statements. No reading is compared to any external, industry or peer figure, and none should be read as one.\n\n" +
      "KRI-TPR-002, Tier 1 third parties with a complete and current subprocessor record, measured as a percentage. Thresholds: green at or above 98 percent, amber 95 to 97 percent, red below 95 percent. August 2026: 96.4 percent, amber. September 2026: 94.6 percent, red. Status: breach. Owner: Stefan Brunner.\n\n" +
      "KRI-RES-005, important business services with tested fallback arrangements, measured as a percentage. Thresholds: green at or above 90 percent, amber 80 to 89 percent, red below 80 percent. August 2026: 78 percent, red. September 2026: 78 percent, red. Status: breach. Owner: Nadia Lehmann.\n\n" +
      "KRI-GOV-001, overdue Massnahmen, group, measured as a count. Thresholds: green 0 to 3, amber 4 to 8, red 9 or more. August 2026: 6, amber. September 2026: 7, amber. Status: within amber. Owner: Katharina Vogt.\n\n" +
      "Escalation consequences arising from this run. A red reading on KRI-PAY-007 requires a written first line explanation within five business days, being by 12.10.2026, and an item on the next NFR Committee agenda. A red reading on KRI-PAY-003 requires the same explanation route and has already produced two prior explanations in July and August 2026. A red reading on KRI-TPR-002 and on KRI-RES-005 requires the owner to confirm the remediation position at the committee.\n\n" +
      "Distribution. Each breach notification is issued to the indicator owner and to the monitoring second line contact named against the indicator, in accordance with the notification map. Five separate breach notifications were issued from this run.\n\n" +
      "Note recorded by the NFR Portfolio Lead on publication. The pack presents each indicator against its own thresholds and its own owner. It does not present relationships between indicators. Three of the six breaches in this run relate to the same important business service, IBS-0004 Corporate Payments, and the reporting format does not say so. This limitation has been noted at each of the last four committee meetings and no change to the reporting standard has been agreed.\n\n" +
      "These are scenario figures for a synthetic institution. They are not benchmarks and carry no peer comparison.",
    summary:
      "The September 2026 group indicator pack, published 05.10.2026, showing five breaches including the first red reading on the ARC-DE manual override rate in 14 months. Three of the breaches relate to the same business service and the format does not connect them.",
    relatedObjectIds: [
      "KRI-PAY-007",
      "KRI-PAY-003",
      "KRI-PAY-011",
      "KRI-TPR-002",
      "KRI-RES-005",
      "KRI-GOV-001",
      "IBS-0004",
      "CMT-NFR-2026-10",
      "AG-CMT-NFR-2026-10-02",
    ],
    pageCount: 14,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The analytical hook of the morning. Repair volume rose 20.6 percent and
   * overrides rose 77.4 percent. Behaviour changed, not just volume, and the
   * component split says exactly how.
   */
  {
    id: "EVD-2026-41821",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-007 ANX-2026-09",
    title:
      "KRI-PAY-007 breach annex, September 2026, manual override component analysis for ARC-DE",
    titleDe:
      "Anhang zur Ueberschreitung KRI-PAY-007, September 2026, Komponentenanalyse ARC-DE",
    sourceType: "kri-report",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Marlene Aigner, Operational Risk Partner",
    authorUserId: "P-003",
    documentDate: "2026-10-05",
    ingestedAt: "2026-10-05T07:40:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "BREACH ANNEX. Indicator KRI-PAY-007, manual override rate, ARC-DE. Prepared by the second line monitoring contact on publication of the September 2026 run.\n\n" +
      "Computation. ARC-DE instructions released in September 2026: 1,905,000. Manual overrides created: 731. 731 divided by 1,905,000, multiplied by 10,000, gives 3.8373, displayed as 3.84. Red threshold is above 3.50. The reading is 0.34 above the threshold, being 9.7 percent above it.\n\n" +
      "Historic context. Twelve-month average 2.31 overrides per 10,000. Highest prior reading in 24 months 2.94, recorded in February 2025 during a T2 migration weekend. Consecutive months in green before this reading: 14.\n\n" +
      "Basis of comparison. Every figure in this annex is a scenario figure for a synthetic institution and every comparison in it is internal: September against August, and September against Arcadia's own twelve-month history. No external, industry or peer figure is used anywhere in this analysis.\n\n" +
      "Volume context. Group instructions received rose from 2,362,000 in August to 2,411,000 in September, being 2.1 percent. ARC-DE instructions rose from 1,870,000 to 1,905,000, being 1.9 percent. ARC-DE instructions entering the repair queue rose from 42,636, being 2.28 percent, to 51,435, being 2.70 percent, an increase of 20.6 percent. ARC-DE manual overrides rose from 412 to 731, an increase of 77.4 percent.\n\n" +
      "The asymmetry. Repair volume rose 20.6 percent while override volume rose 77.4 percent. Overrides grew almost four times faster than the queue that produces them. If the only change were volume, the two figures would move together. They did not, which means the way the queue is being resolved changed in September, not only how much of it there was.\n\n" +
      "Component analysis, ARC-DE overrides by reason code. OVR-A validation rule false positive: 62 in August, 68 in September, up 10 percent. OVR-B client-confirmed correction received out of band: 197 to 214, up 9 percent. OVR-C route substitution: 31 to 198, up 539 percent. OVR-D cut-off driven release with post-release completion: 94 to 211, up 124 percent. OVR-E technical suppression on supplier advice: 28 to 40, up 43 percent. Totals: 412 in August, 731 in September.\n\n" +
      "Reading of the components. OVR-A, OVR-B and OVR-E moved broadly with volume and require no separate explanation. The breach is carried almost entirely by OVR-C and OVR-D, which grew by 167 and 117 overrides respectively, being 284 of the 319 additional overrides. Neither code is an error indicator. OVR-C means the primary clearing route was unavailable and instructions were released on an alternative route that does not support a validation performed on the primary route. OVR-D means instructions were released against a cut-off with a non-blocking data item incomplete. Both are pressure indicators.\n\n" +
      "Cross-reference the second line considers material. KRI-PAY-011 shows secondary reviewer capacity at 75.0 percent of approved establishment for the second consecutive month. Read with the component analysis, the September position is a team releasing substantially more payments under substantially more time pressure with one fewer senior reviewer than the establishment provides for. That is a control environment statement, not a volume statement.\n\n" +
      "Recommendation. Treat the KRI-PAY-007 breach, the KRI-PAY-003 breach and the KRI-PAY-011 breach as one causal issue rather than requesting three separate first line explanations, and require the explanation to address the OVR-C and OVR-D growth specifically. Establish what made the primary clearing route unavailable in September.\n\n" +
      "These are scenario figures for a synthetic institution.",
    summary:
      "The component analysis behind the override rate breach. Route substitution overrides grew 539 percent and cut-off driven overrides 124 percent, together accounting for 284 of the 319 additional overrides, against reviewer capacity at 75 percent.",
    relatedObjectIds: [
      "KRI-PAY-007",
      "KRI-PAY-003",
      "KRI-PAY-011",
      "PRC-0041",
      "CTL-PAY-014",
      "RSK-0211",
      "IBS-0004",
      "DEC-2026-0771",
    ],
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41822",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-011 CAP-2026-09",
    title:
      "Secondary reviewer capacity report, ARC-DE payment repair, position as at 30.09.2026",
    titleDe:
      "Kapazitaetsbericht Zweitpruefer, Zahlungsreparatur ARC-DE, Stand 30.09.2026",
    sourceType: "kri-report",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Andreas Kellner, Head of Payment Operations",
    authorUserId: "P-007",
    documentDate: "2026-10-05",
    ingestedAt: "2026-10-05T08:15:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "CAPACITY REPORT. Indicator KRI-PAY-011, secondary reviewer capacity, ARC-DE. Position as at 30.09.2026.\n\n" +
      "Establishment. The approved establishment for the senior secondary reviewer function in the Munich payment repair hub is 4.0 full-time equivalent, held in four named positions PR-SR-01 to PR-SR-04. The function is distinct from the Repair Analyst function: a senior secondary reviewer holds the Secondary Reviewer role assignment in RepairDesk and is authorised to approve overrides of any value and any reason code.\n\n" +
      "Filled position. 3.0 full-time equivalent. Position PR-SR-02 has been vacant since 31.07.2026 following the resignation of Tomas Nowak, who gave notice on 30.06.2026 and left on 31.07.2026. Filled capacity as a percentage of approved establishment is 75.0 percent, against a red threshold of below 85 percent. The indicator has been red since 01.08.2026.\n\n" +
      "Recruitment position. Recruitment was approved on 12.08.2026 and is tracked as Massnahme MSN-2026-0166 with a due date of 30.09.2026. Two candidates were taken to second interview and both were rejected on the assessment of override judgement. No start date exists. The Massnahme is overdue as at the reporting date.\n\n" +
      "Operational consequence recorded by the process owner. Coverage of the reviewer function across the operating window of 06:00 to 19:00 requires a minimum of two senior reviewers on duty at any time and three during the 15:00 to 17:30 cut-off window, which is the period in which override volume concentrates. At 3.0 full-time equivalent, allowing for leave and training, the cut-off window is covered by two reviewers on an average of nine business days per month and by one reviewer on an average of two business days per month. On 06.10.2026 the roster shows one senior secondary reviewer on duty for the afternoon, Elif Demir, who is also the acting Duty Manager.\n\n" +
      "Mitigation in place. A rota change was introduced on 04.08.2026 moving one senior reviewer from the morning to the afternoon shift. Overtime has been authorised. Three Repair Analysts hold the Secondary Reviewer role assignment in addition to their own, which provides cover and is also the condition that produced audit finding AUD-2025-09-F3.\n\n" +
      "Process owner statement. The function continues to operate. The capacity position is a recruitment problem, not a control problem.\n\n" +
      "Second line note. The mitigation that provides reviewer cover is the same dual role assignment that permits self-review. Removing one creates the other. That is a structural position and it cannot be resolved inside the payment repair team.",
    summary:
      "The reviewer capacity report. One of four senior secondary reviewer positions has been vacant since 31.07.2026, the cut-off window is single-covered on about two days a month, and the mitigation that provides cover is the dual role assignment that permits self-review.",
    relatedObjectIds: [
      "KRI-PAY-011",
      "MSN-2026-0166",
      "CTL-PAY-014",
      "AUD-2025-09",
      "PRC-0041",
      "P-018",
      "P-009",
    ],
    pageCount: 3,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The service level miss that Arcadia found by arithmetic rather than by
   * notification. This is also the document that explains the OVR-C growth,
   * and it is the reason the morning brief can reach the supplier six hours
   * before the supplier reaches Arcadia.
   */
  {
    id: "EVD-2026-41810",
    runId: DEFAULT_RUN_ID,
    reference: "AVL-NOVAGATE-2026-09",
    title:
      "NOVA-GATE availability and fallback operation analysis, September 2026, Arcadia edge measurement",
    titleDe:
      "Analyse der Verfuegbarkeit von NOVA-GATE und des Ausweichbetriebs, September 2026",
    sourceType: "telemetry-extract",
    sourceSystem: "SYS-0011 Arcadia Payment Hub",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-10-05",
    ingestedAt: "2026-10-05T11:22:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "telemetry",
    body:
      "AVAILABILITY ANALYSIS. Service SVC-0042-01, payment validation and clearing gateway, provided by TP-0042 Novalink Payment Services GmbH through SYS-0012 NOVA-GATE. Period September 2026. Prepared by Group Third-Party Risk Management because no supplier service level report for September 2026 has been received.\n\n" +
      "Measurement basis. Availability is computed from SYS-0011 submission attempt records at the Arcadia edge. A minute is counted as unavailable where no submission acknowledgement was received within the contractual acknowledgement window and the failure was not attributable to an Arcadia-side outage recorded in the Arcadia change and incident records. Planned maintenance windows notified by Novalink are excluded, in accordance with the measurement definition in CTR-2023-0117-A1.\n\n" +
      "Result, measured in this simulation against the contracted level and against no external reference. Monthly availability excluding planned maintenance: 99.62 percent. Contracted availability: 99.70 percent monthly excluding planned maintenance. The measured figure is 0.08 percentage points below the contracted level. August 2026 measured 99.91 percent on the same basis.\n\n" +
      "Fallback operation, the operational consequence. Each period in which the primary clearing route was unavailable long enough for the Duty Manager to invoke runbook RB-PAY-007 is recorded below with the duration fallbackRouteMode was ACTIVE.\n\n" +
      "04.09.2026, 1 hour 10 minutes, NOVA-GATE latency. 11.09.2026, 2 hours 05 minutes, NOVA-GATE planned maintenance overrun. 18.09.2026, 0 hours 40 minutes, network path failure. 25.09.2026, 3 hours 15 minutes, NOVA-GATE latency. 29.09.2026, 1 hour 30 minutes, NOVA-GATE latency.\n\n" +
      "Totals. Five occurrences in September 2026 totalling 8 hours 40 minutes of fallback operation. One occurrence in August 2026 totalling 1 hour. The supplier's service availability deteriorated through September and the effect appeared in Arcadia's control environment rather than in a service level report.\n\n" +
      "Inference and its limits. The inference drawn is that supplier-side degradation caused the fallback activations and therefore caused the OVR-C route substitution override growth recorded in KRI-PAY-007. The measurement supporting the inference is taken at the Arcadia edge and cannot on its own distinguish supplier-side degradation from a degradation on the network path between Arcadia and Novalink. The 18.09.2026 occurrence is recorded as a network path failure for exactly that reason. Confirmation requires the supplier-side measurement, which is what the September service level report would provide.\n\n" +
      "Actions arising. Request the September 2026 service level report from Novalink. Raise the availability position at the next quarterly service review. Note for the reassessment file that a service level miss on a service supporting a critical or important function was identified by the client rather than reported by the supplier.\n\n" +
      "Illustrative regulatory context, not legal advice.",
    summary:
      "Arcadia's own measurement of NOVA-GATE availability for September 2026 at 99.62 percent against a contracted 99.70 percent, with the five fallback operating periods totalling 8 hours 40 minutes that drove the route substitution override growth.",
    relatedObjectIds: [
      "TP-0042",
      "SVC-0042-01",
      "SYS-0012",
      "CTR-2023-0117-A1",
      "KRI-PAY-007",
      "RB-PAY-007",
      "RSK-0184",
      "PRC-0041",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* ========================================================================
     3. PROCESS AND RESILIENCE EVIDENCE
     How the process is documented, what the runbooks promise, and what has
     and has not been tested.
     ======================================================================== */

  {
    id: "EVD-2026-41700",
    runId: DEFAULT_RUN_ID,
    reference: "PRC-0041 v2.3",
    title: "Process map PRC-0041, payment repair and manual override, version 2.3",
    titleDe: "Prozessbeschreibung PRC-0041, Zahlungsreparatur und manuelle Ueberschreibung, Version 2.3",
    sourceType: "process-map",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Andreas Kellner, Head of Payment Operations",
    authorUserId: "P-007",
    documentDate: "2026-03-16",
    ingestedAt: "2026-03-16T13:50:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "PROCESS RECORD PRC-0041. Payment repair and manual override / Zahlungsreparatur und manuelle Ueberschreibung. Version 2.3. Effective 16.03.2026. Parent service IBS-0004 Corporate Payments. Process owner Andreas Kellner. Operating location Munich hub for ARC-DE and ARC-AT, Zurich for ARC-CH. Operating hours 06:00 to 19:00 CET on business days with on-call cover from 19:00 to 06:00. Headcount 34 full-time equivalent Munich, 6 Zurich.\n\n" +
      "1. Purpose. To resolve payment instructions that fail validation, so that a correct instruction reaches clearing within its value date, and to ensure that where a validation block is suppressed rather than resolved, the suppression is authorised and evidenced.\n\n" +
      "2. Systems in the process. SYS-0011 Arcadia Payment Hub holds the state machine of record for the instruction. SYS-0012 Novalink Gateway performs format validation, enrichment and clearing connectivity for T2, RT1 and TIPS. SYS-0013 Arcadia Direct Link is Arcadia's own T2 direct participant connection, used as the fallback clearing route, and performs no payment data validation. SYS-0014 Novalink RepairDesk holds the repair queue, override creation, four-eyes enforcement and the override audit log. SYS-0015 euroSIC Adapter performs SIC and euroSIC submission for ARC-CH. SYS-0017 Client Static Data Master is the authoritative source for client account, mandate and beneficiary static data.\n\n" +
      "3. Instruction states. RECEIVED to VALIDATING. From VALIDATING either to STP_PASSED and onward to SUBMITTED, ACKNOWLEDGED and SETTLED, or to VALIDATION_FAILED and onward to REPAIR_QUEUED. From REPAIR_QUEUED to REPAIR_IN_PROGRESS, and from there to REPAIRED_REVALIDATE and back into VALIDATING for a maximum of three cycles, or to OVERRIDE_PROPOSED, or to one of the terminal states RETURNED_TO_CLIENT, CANCELLED or ROLLED_TO_NEXT_VALUE_DATE. From OVERRIDE_PROPOSED to AWAITING_SECONDARY_REVIEW where secondary review is required, and from there to REVIEW_APPROVED and RELEASED_WITH_OVERRIDE, or to REVIEW_REJECTED and back to REPAIR_IN_PROGRESS. From RELEASED_WITH_OVERRIDE to SUBMITTED, ACKNOWLEDGED and SETTLED.\n\n" +
      "4. Note on the direct transition, recorded at version 2.1. The state machine also permits the transition from OVERRIDE_PROPOSED directly to RELEASED_WITH_OVERRIDE, without passing through AWAITING_SECONDARY_REVIEW. This transition applies only where secondary review is not required by rule evaluation in SYS-0014. The rules that produce that outcome are held in the supplier system and are not reproduced here.\n\n" +
      "5. Two resolution paths. Path 1, standard repair: the analyst corrects a data field from an authoritative source, the instruction is revalidated and passes, no override record is created and no four-eyes requirement arises. Path 2, manual override: the analyst or Duty Manager suppresses one or more validation rules and forces release, an override record is created in SYS-0014, and control CTL-PAY-014 operates. In September 2026, 50,355 of 51,435 ARC-DE repair items resolved by path 1, being 97.9 percent, with 731 overrides and 349 returns and cancellations.\n\n" +
      "6. Validation failure reason codes entering the queue. R01 invalid or unreachable IBAN and BIC combination. R02 missing or malformed regulatory reporting data for cross-border value above EUR 12,500. R03 beneficiary name and account mismatch. R04 currency or clearing route unavailable. R07 insufficient cover at cut-off. R08 missing corporate mandate static data. R05 duplicate suspicion also enters the queue. R06 sanctions screening pending release does not enter this queue and is handled by Group Compliance under SYS-0016. September 2026 distribution for ARC-DE: R01 31 percent, R02 22 percent, R03 14 percent, R08 10 percent, R04 9 percent, R05 8 percent, R07 6 percent.\n\n" +
      "7. Override reason codes and the policy position. OVR-A validation rule false positive. OVR-B client-confirmed correction received out of band. OVR-C route substitution. OVR-D cut-off driven release with post-release completion. OVR-E technical suppression on supplier advice. Secondary review is required by policy for every one of the five codes, without a value threshold and without a business continuity carve-out.\n\n" +
      "8. Interfaces out of the process. Treasury Operations for R07. Group Compliance for R06. Client Service for R03 callbacks. Technology for rule defects. Group Third-Party Risk Management for any supplier advice to suppress a rule.",
    summary:
      "The approved process record for payment repair and manual override, including the full instruction state machine. Section 4 acknowledges a direct release path where rule evaluation does not require review, and states that those rules live in the supplier system and are not reproduced.",
    relatedObjectIds: [
      "PRC-0041",
      "IBS-0004",
      "CTL-PAY-014",
      "SYS-0011",
      "SYS-0012",
      "SYS-0013",
      "SYS-0014",
      "SYS-0015",
      "SYS-0017",
      "RSK-0211",
    ],
    pageCount: 9,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The runbook that says the thing that is not true. Section 4 asserts the
   * control environment is unchanged during fallback operation. It is a
   * documented control assertion rather than an omission, which is what makes
   * it a finding. Read against EVD-2026-41874 and EVD-2026-41905.
   */
  {
    id: "EVD-2026-41705",
    runId: DEFAULT_RUN_ID,
    reference: "RB-PAY-007 v3.1",
    title: "Runbook RB-PAY-007, clearing route substitution, version 3.1",
    titleDe: "Handbuch RB-PAY-007, Wechsel des Clearingwegs, Version 3.1",
    sourceType: "process-map",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Andreas Kellner, Head of Payment Operations",
    authorUserId: "P-007",
    documentDate: "2026-02-09",
    ingestedAt: "2026-02-09T10:30:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "RUNBOOK RB-PAY-007. Clearing route substitution. Version 3.1. Dated 09.02.2026. Applies to ARC-DE and ARC-AT. Review cycle annual. Next review due 09.02.2027.\n\n" +
      "Section 1. Purpose. To substitute the primary EUR clearing route, SYS-0012 Novalink Gateway, with the secondary route, SYS-0013 Arcadia Direct Link, where the primary route is unavailable or degraded to the point that same-day submission is at risk.\n\n" +
      "Section 2. Trigger authority. The Duty Manager, Payment Operations may invoke this runbook. The Head of Payment Operations may invoke it and must be informed within 15 minutes where the Duty Manager invokes it. No other authority is required and no prior approval from Technology is required, because delay defeats the purpose.\n\n" +
      "Section 3. Technical steps. Step 3.1: confirm the primary route is degraded, using the SYS-0011 submission acknowledgement latency dashboard. Step 3.2: set fallbackRouteMode to ACTIVE per queue in SYS-0014, for Q-REPAIR-DE and Q-REPAIR-AT as applicable. Step 3.3: switch clearing submission in SYS-0011 from SYS-0012 to SYS-0013. Step 3.4: raise an emergency change record recording the invocation, the queues affected and the start time. Step 3.5: notify the Payment Repair Team Lead and the on-call Technology contact. Step 3.6: on restoration, reverse steps 3.3 and 3.2 in that order and close the change record.\n\n" +
      "Section 4. Control environment during fallback operation. SYS-0013 performs no payment data validation. Instructions that SYS-0012 would have enriched or corrected will arrive with failure reason codes R01, R02, R04 or R08 and will enter the repair queue. Repair volume will increase materially. The control environment is unchanged during fallback operation: all controls that apply in normal operation continue to apply, and staff must not treat fallback operation as a reason to depart from the standard process.\n\n" +
      "Section 5. Volume planning. No quantified expectation of the volume increase is given, because the increase depends on the mix of instruction types in the queue at the time of invocation. The Duty Manager should assess whether additional repair resource is required and whether the cut-off can be met.\n\n" +
      "Section 6. Entity availability. This runbook is available to ARC-DE and ARC-AT only. ARC-CH has no direct SIC participant link and cannot substitute the clearing route. Where the Swiss route is unavailable, the only option is manual submission through a correspondent bank under runbook RB-PAY-011, which has a 45-minute preparation lead time. The Zurich Duty Manager must be informed of any ARC-DE or ARC-AT invocation, because the underlying cause is frequently common to all three entities.\n\n" +
      "Section 7. Version history. Version 3.1, 09.02.2026: updated the dashboard reference in step 3.1 and added the Zurich notification in section 6. Version 3.0, 14.03.2025: added the emergency change record requirement. Version 2.2, 08.01.2024: original consolidated runbook.\n\n" +
      "Section 8. Approval. Approved by the Head of Payment Operations. Reviewed by Payments Technology. Not reviewed by Group Control Assurance; the runbook is not in the control assurance testing scope.",
    summary:
      "The fallback route runbook. Section 4 states that the control environment is unchanged during fallback operation and that repair volume will rise materially without quantifying it. It makes no mention of any effect on the four-eyes requirement.",
    relatedObjectIds: [
      "RB-PAY-007",
      "PRC-0041",
      "SYS-0012",
      "SYS-0013",
      "SYS-0014",
      "CTL-PAY-014",
      "MSN-2026-0216",
      "RB-PAY-011",
    ],
    pageCount: 12,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41710",
    runId: DEFAULT_RUN_ID,
    reference: "RB-PAY-011 v2.2",
    title:
      "Runbook RB-PAY-011, manual correspondent submission for ARC-CH CHF and euroSIC payments, version 2.2",
    titleDe:
      "Handbuch RB-PAY-011, manuelle Einlieferung ueber Korrespondenzbank fuer ARC-CH, Version 2.2",
    sourceType: "process-map",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Sibylle Graf, Resilience Officer, Arcadia Bank Schweiz AG",
    authorUserId: "P-015",
    documentDate: "2025-11-14",
    ingestedAt: "2025-11-14T15:05:00.000Z",
    entityIds: [ENTITY_CH],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "RUNBOOK RB-PAY-011. Manual correspondent submission, CHF and euroSIC. Version 2.2. Dated 14.11.2025. Applies to ARC-CH only.\n\n" +
      "Section 1. Purpose and constraint. ARC-CH submits CHF domestic and euroSIC payments through SYS-0015 euroSIC Adapter, provided by TP-0042 under service SVC-0042-05. ARC-CH is not a direct SIC participant and holds no secondary electronic route. Where SYS-0015 or its upstream connectivity is unavailable, the only means of submission is manual preparation of a payment file for transmission to the correspondent bank, Helvetia Clearing Partner AG.\n\n" +
      "Section 2. Trigger authority. The Zurich Duty Manager may prepare the manual file. Transmission requires the authority of the Resilience Officer, Arcadia Bank Schweiz AG together with a member of the ARC-CH executive, normally the Chief Operating Officer. The reason for the higher authority is that manual submission cannot be unwound once transmitted, and it bypasses the format validation performed by SYS-0015.\n\n" +
      "Section 3. Preparation lead time. 45 minutes from decision to transmission. The lead time comprises extraction of the queued instruction set from SYS-0015 or, where unavailable, from SYS-0011; construction of the correspondent file in the correspondent's required format; two-person verification of the control totals; and secure transmission. The 45-minute figure is the estimate agreed at the 2025 walkthrough and has not been validated against a live submission.\n\n" +
      "Section 4. Same-day cut-off. The correspondent accepts same-day value instructions until 16:00 CET. A decision to invoke this runbook for a same-day tranche must therefore be taken no later than 15:15 CET. This is the binding constraint in any Swiss clearing disruption and it is earlier than the 2-hour maximum tolerable disruption stated in impact tolerance ITOL-0004-03 would suggest.\n\n" +
      "Section 5. Control effects of manual submission, stated explicitly. Format validation performed by SYS-0015 does not occur. Instructions rejected by the correspondent on format grounds must be identified from the correspondent acknowledgement and rolled to the next value date. Duplicate submission risk is material where SYS-0015 recovers during preparation, so the queue must be frozen before extraction. Beneficiary and mandate checks performed upstream in SYS-0017 are unaffected.\n\n" +
      "Section 6. Scope of tolerance. Only same-day value instructions should be submitted manually. Forward-dated instructions should be held for the electronic route.\n\n" +
      "Section 7. Testing. Last exercised by desktop walkthrough on 21.11.2025. No live submission test has been performed. A live test requires correspondent participation and has not been scheduled.\n\n" +
      "Illustrative regulatory context, not legal advice. Operational resilience and outsourcing expectations for Arcadia Bank Schweiz AG are considered under FINMA operational risk, resilience and outsourcing context.",
    summary:
      "The only fallback available to the Swiss entity. Manual submission through the correspondent takes 45 minutes to prepare, cannot be unwound, requires executive authority, and has never been tested live.",
    relatedObjectIds: [
      "RB-PAY-011",
      "ITOL-0004-03",
      "SVC-0042-05",
      "SYS-0015",
      "IBS-0004",
      "KRI-RES-005",
      "REG-2026-0088",
    ],
    pageCount: 7,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41505",
    runId: DEFAULT_RUN_ID,
    reference: "BCM-CH-2025-04",
    title:
      "Business continuity exercise report, ARC-CH manual correspondent submission desktop walkthrough",
    titleDe:
      "Bericht zur Notfalluebung, ARC-CH manuelle Einlieferung, Planuebung",
    sourceType: "bcm-test",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Sibylle Graf, Resilience Officer, Arcadia Bank Schweiz AG",
    authorUserId: "P-015",
    documentDate: "2025-11-21",
    ingestedAt: "2025-11-24T09:12:00.000Z",
    entityIds: [ENTITY_CH],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "BUSINESS CONTINUITY EXERCISE REPORT BCM-CH-2025-04. Exercise date 21.11.2025. Business Continuity Management / Betriebskontinuitaetsmanagement (BCM) exercise programme, Arcadia Bank Schweiz AG.\n\n" +
      "1. Objective. To walk through runbook RB-PAY-011 and establish whether the Zurich payment operations team can prepare and transmit a manual correspondent file for the queued same-day CHF and euroSIC tranche within the time available before the 16:00 CET correspondent cut-off.\n\n" +
      "2. Method. Desktop walkthrough. Participants worked through the runbook steps against a synthetic queue of 1,500 instructions using a copy of the previous day's production file. No file was transmitted to the correspondent and the correspondent did not participate. Timings were taken by the exercise facilitator at each step and are therefore estimates of elapsed effort rather than measured end-to-end duration under live conditions.\n\n" +
      "3. Participants. Resilience Officer ARC-CH as facilitator. Zurich Duty Manager. Two Zurich payment repair analysts. ARC-CH Treasury representative. Group Operational Resilience attended as observer.\n\n" +
      "4. Result. The walkthrough completed all runbook steps. Step timings: queue freeze and extraction 11 minutes; correspondent file construction 18 minutes; two-person verification of control totals 9 minutes; transmission preparation and secure channel setup 7 minutes. Total 45 minutes. The runbook lead time of 45 minutes was confirmed as the planning figure on this basis.\n\n" +
      "5. Observations. Observation 1: the extraction step assumes SYS-0015 is reachable for the queue export. If SYS-0015 is unreachable, the export must be taken from SYS-0011, which the team had not previously attempted and which required assistance from Technology during the walkthrough. Observation 2: the correspondent file format template held by the team was two versions behind the correspondent's current specification and was updated after the exercise. Observation 3: no participant had previously performed a live manual submission.\n\n" +
      "6. Limitations, stated by the facilitator. A desktop walkthrough establishes that the team knows the steps. It does not establish that the correspondent will accept the file, that the secure channel will be available, or that 45 minutes is achievable when the same people are simultaneously managing an incident bridge. The figure should be treated as a floor rather than an expectation.\n\n" +
      "7. Recommendation. Schedule a live submission test with correspondent participation for a low-volume forward-dated tranche within the 2026 exercise programme. Include the SYS-0011 extraction path in scope.\n\n" +
      "8. Status of the recommendation as at the date of this record. The live test was not included in the 2026 exercise programme. The programme was scoped in January 2026 around group-level scenarios and the Swiss correspondent test was deferred pending correspondent availability. No new date has been agreed.\n\n" +
      "Illustrative regulatory context, not legal advice. Considered under FINMA operational risk, resilience and outsourcing context for Arcadia Bank Schweiz AG.",
    summary:
      "The only exercise behind the Swiss manual submission route. A desktop walkthrough in November 2025 confirmed the 45-minute lead time as a planning figure, flagged that a live test was needed, and the live test was deferred and never rescheduled.",
    relatedObjectIds: [
      "RB-PAY-011",
      "ITOL-0004-03",
      "KRI-RES-005",
      "SVC-0042-05",
      "SYS-0015",
      "IBS-0004",
    ],
    pageCount: 6,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The stale supplier resilience evidence, and the single most expensive
   * unread document in the corpus. It has been in the vault since May and it
   * contains a 1 hour 40 minute gap between the contracted recovery time
   * objective and the tested outcome. Nobody escalated it for 137 days.
   */
  {
    id: "EVD-2026-40118",
    runId: DEFAULT_RUN_ID,
    reference: "NOVALINK-DR-2026-01",
    title: "Novalink RepairDesk disaster recovery test report, exercise of 22.05.2026",
    titleDe: "Novalink RepairDesk Wiederherstellungstestbericht, Uebung vom 22.05.2026",
    sourceType: "bcm-test",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Ralf Ostermann, Head of Service Continuity, Novalink Payment Services GmbH",
    authorUserId: "P-012",
    documentDate: "2026-05-22",
    ingestedAt: "2026-05-27T08:44:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: true,
    stalenessNote:
      "Created 22.05.2026 and relied upon for the first time on 06.10.2026, 137 days later. The Group Third-Party Risk Policy section 8.4 requires evidence relied upon in a Tier 1 reassessment to be no more than 90 days old at the date of reliance and to be assessed within 20 business days of receipt. Both limits are exceeded. The document has been held in the vault since 27.05.2026 and the 1 hour 40 minute recovery time objective gap it discloses was not escalated in that period.",
    provenance: "stakeholder-statement",
    body:
      "DISASTER RECOVERY TEST REPORT. Novalink Payment Services GmbH. Exercise reference NOVALINK-DR-2026-01. Exercise date 22.05.2026. Issued to clients 26.05.2026. This is Novalink's own report of its own exercise and records Novalink's assessment of the outcome.\n\n" +
      "1. Scope. The exercise covered the RepairDesk application service and the NOVA-GATE gateway service as hosted in the Frankfurt primary region and the Amsterdam secondary region, both operated by our managed infrastructure partner. Database, backup and regional failover services are provided by that partner. The exercise did not cover instances hosted outside those two regions.\n\n" +
      "2. Scenario. Total loss of the Frankfurt primary region during a business day, simulated by controlled shutdown of the primary database cluster at 09:00 CEST on 22.05.2026, with failover to the Amsterdam secondary region and subsequent failback.\n\n" +
      "3. Method. Failover was initiated by the infrastructure partner at 09:00. Service restoration was measured as the point at which a synthetic RepairDesk transaction completed end to end in the secondary region and a synthetic NOVA-GATE submission received an acknowledgement. Failback to Frankfurt was performed out of hours on 23.05.2026 and is not measured in this report.\n\n" +
      "4. Results. NOVA-GATE write traffic was serving from the secondary region at 09:41, being 41 minutes. RepairDesk application service, including the repair queue, override creation and the override audit log, completed its first successful synthetic transaction in the secondary region at 12:40, being 3 hours 40 minutes. The delay between the two was attributable to the RepairDesk session and queue state rebuild, which is not replicated synchronously and had to be reconstructed from the transaction log.\n\n" +
      "5. Assessment. Test objectives met. Failover completed without data loss. Recovery point objective of 15 minutes was achieved for both services. No client impact arose because the exercise was conducted in a non-production tenant.\n\n" +
      "6. Actions. Novalink will investigate options to reduce the RepairDesk queue state rebuild time. No target date is given in this report.\n\n" +
      "7. Statement on other instances. The RepairDesk instance serving Swiss clients is hosted separately by a different infrastructure partner and operates on a separate recovery arrangement. That instance was not in scope for this exercise. Novalink can confirm on request that recovery arrangements exist for that instance.\n\n" +
      "Arcadia receipt note, recorded on ingestion 27.05.2026. Received as part of the standing supplier evidence flow. Filed against SVC-0042-01 and SVC-0042-02. No assessment recorded at receipt. The service description at CTR-2023-0117-A1 states a recovery time objective of 2 hours for RepairDesk. The tested outcome in section 4 is 3 hours 40 minutes.",
    summary:
      "Novalink's own disaster recovery test report for RepairDesk and NOVA-GATE. It records RepairDesk recovery at 3 hours 40 minutes against a contracted 2 hour objective, assesses the test objectives as met, and explicitly excludes the instance serving the Swiss entity.",
    relatedObjectIds: [
      "TP-0042",
      "SVC-0042-01",
      "SVC-0042-02",
      "CTR-2023-0117-A1",
      "MSN-2026-0188",
      "KRI-RES-005",
      "RSK-0184",
      "TP-0042.2",
    ],
    pageCount: 18,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Gap 3 of 7. The Swiss entity holds no recovery evidence at all for a
   * significant outsourcing, and it is the same instance that comes closest
   * to a tolerance breach at 15:09.
   */
  {
    id: "EVD-2026-41210",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026-R04 EVD",
    title:
      "Requested: disaster recovery test evidence for the RepairDesk instance serving Arcadia Bank Schweiz AG",
    titleDe:
      "Angefordert: Wiederherstellungsnachweis fuer die RepairDesk-Instanz der Arcadia Bank Schweiz AG",
    sourceType: "bcm-test",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-09-18",
    ingestedAt: "2026-09-18T16:40:00.000Z",
    entityIds: [ENTITY_CH],
    dataClassification: "confidential",
    status: "missing",
    requestedFromLabel: "Novalink Payment Services GmbH, Service Continuity (Ralf Ostermann)",
    requestedOn: "2026-09-18",
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "What was asked. On 18.09.2026, under reassessment question TPRM-Q-2026-R04, Arcadia asked Novalink for disaster recovery test evidence covering the RepairDesk instance used by Arcadia Bank Schweiz AG, which is hosted by TP-0042.1 Helvetia CloudWorks AG in Zurich. The request followed review of EVD-2026-40118, whose scope covers the Frankfurt and Amsterdam regions only.\n\n" +
      "What came back. Novalink acknowledged the request on 19.09.2026 and stated that recovery arrangements exist for the Swiss instance. No test report, no test date and no measured recovery time have been provided as at 06.10.2026 07:00. A follow-up was sent on 29.09.2026.\n\n" +
      "Consequence. Arcadia Bank Schweiz AG holds no disaster recovery test evidence for RepairDesk, which is a significant outsourcing / wesentliche Auslagerung for that entity, and which supports IBS-0004 Corporate Payments. The reassessment question cannot be closed and the arrangement cannot be assessed as evidenced on resilience for the Swiss entity.\n\n" +
      "Tracking. Massnahme MSN-2026-0188, obtain and assess disaster recovery evidence for the RepairDesk Swiss instance, owner Stefan Brunner, due 20.10.2026, in progress at 25 percent.\n\n" +
      "Illustrative regulatory context, not legal advice. Considered under FINMA operational risk, resilience and outsourcing context for Arcadia Bank Schweiz AG.",
    summary:
      "An open evidence gap for the Swiss entity. Arcadia asked on 18.09.2026 for recovery test evidence covering the Swiss RepairDesk instance, and Novalink has asserted that arrangements exist without producing any test report.",
    relatedObjectIds: [
      "MSN-2026-0188",
      "TP-0042",
      "TP-0042.1",
      "SVC-0042-02",
      "IBS-0004",
      "KRI-RES-005",
      "REG-2026-0088",
      "ITOL-0004-03",
    ],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The tolerance approvals, including the one drafted with two measures and
   * no precedence. A member asked the precedence question in March and was
   * told the measures would not diverge in practice. On 06.10.2026 they
   * diverge by eleven minutes.
   */
  {
    id: "EVD-2026-41500",
    runId: DEFAULT_RUN_ID,
    reference: "ITOL-0004 APPROVALS",
    title:
      "Impact tolerance approvals for IBS-0004 Corporate Payments, committee minute extracts",
    titleDe:
      "Genehmigung der Toleranzschwellen fuer IBS-0004, Auszuege aus Gremienprotokollen",
    sourceType: "committee-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Nadia Lehmann, Incident and Resilience Lead",
    authorUserId: "P-005",
    documentDate: "2026-03-11",
    ingestedAt: "2026-03-13T11:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "IMPACT TOLERANCE APPROVAL RECORD. Important business service IBS-0004 Corporate Payments / Firmenkundenzahlungsverkehr. Compiled from two committee minutes because the tolerances for this service are approved by two different bodies.\n\n" +
      "Extract 1. ARC-CH Board Risk Committee, 24.02.2026, item 6.\n\n" +
      "The committee approved impact tolerance ITOL-0004-03 for Arcadia Bank Schweiz AG in the following terms: the maximum tolerable disruption to CHF and euroSIC submission is 2 hours, and submission must complete before the 16:00 CET same-day cut-off. The tolerance is measured on two measures: elapsed disruption time, and submission completion against the cut-off.\n\n" +
      "Minuted discussion. A member asked which measure prevails if the two give different answers, for example where submission completes before the cut-off but more than two hours after the disruption began. The Resilience Officer, Arcadia Bank Schweiz AG responded that on the volumes and the timings involved the two measures would not diverge in practice, because a disruption long enough to consume two hours would in almost all cases also carry the submission past the cut-off. The chair asked that the point be revisited at the annual tolerance review. No order of precedence was recorded. Approved as drafted.\n\n" +
      "Extract 2. Group NFR Committee, 11.03.2026, item 4.\n\n" +
      "The committee approved the following tolerances for IBS-0004.\n\n" +
      "ITOL-0004-01, applying to ARC-DE and ARC-AT: the maximum tolerable disruption to same-day EUR payment submission is 4 hours during a business day, measured as elapsed time from confirmed disruption start to restoration of submission capability.\n\n" +
      "ITOL-0004-02, applying at group level: no more than 0.5 percent of daily corporate payment value is delayed beyond its value-date cut-off, measured as value delayed divided by total daily value.\n\n" +
      "ITOL-0004-04, applying at group level: no corporate payment is released without the control gates defined for its release path, measured as the count of releases with an unsatisfied mandatory gate. The tolerance is zero.\n\n" +
      "Minuted discussion on ITOL-0004-04. The committee noted that a zero tolerance is unusual and asked how consumption would be measured in practice. The Incident and Resilience Lead responded that a single release with an unsatisfied mandatory gate consumes the tolerance in full, and that the measure depends on the control gates being identifiable in system records. The committee accepted the tolerance on that basis and asked that the identifiability point be confirmed in the next control assurance cycle. That confirmation has not been recorded.\n\n" +
      "Noting for the Swiss entity. ITOL-0004-03 is approved by the ARC-CH Board Risk Committee and noted by the Group NFR Committee. The Group NFR Committee cannot overrule an entity board on an entity tolerance; it may ask the entity to take a decision and record it.\n\n" +
      "Next review. All four tolerances are due for review at agenda item AG-CMT-NFR-2026-10-08 on 13.10.2026.\n\n" +
      "Illustrative regulatory context, not legal advice. The Swiss tolerance is set under FINMA operational risk and resilience context; the EU entity tolerances are set under the group resilience framework as applied to ARC-DE and ARC-AT.",
    summary:
      "The approval record for the four impact tolerances on Corporate Payments. It shows that the Swiss tolerance was approved with two measures and no order of precedence, after a member asked the precedence question and was told the measures would not diverge.",
    relatedObjectIds: [
      "ITOL-0004-01",
      "ITOL-0004-02",
      "ITOL-0004-03",
      "ITOL-0004-04",
      "IBS-0004",
      "AG-CMT-NFR-2026-10-08",
      "POL-RES-2.4",
      "REG-2026-0104",
    ],
    pageCount: 6,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* ========================================================================
     4. SUPPLIER AND CONTRACT EVIDENCE
     What Novalink asserts, what the binding contract says, and the places
     where those two are not the same document.
     ======================================================================== */

  /*
   * The supplier's own resilience answers. Read section R04 against
   * EVD-2026-40118: the questionnaire says all instances used by Arcadia are
   * in scope of the programme, and the attached report says the exercise
   * covered two regions and excluded the Swiss instance. Read R07 against the
   * same report: the questionnaire says there are no open recovery time
   * objective breaches and the report measures 3 hours 40 minutes against a
   * 2 hour objective.
   */
  {
    id: "EVD-2026-41400",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026 D7",
    title:
      "Novalink reassessment questionnaire responses, domain 7, resilience and service continuity",
    titleDe:
      "Antworten Novalink zur Neubeurteilung, Bereich 7, Resilienz und Betriebskontinuitaet",
    sourceType: "supplier-due-diligence",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Miriam Falk, Client Service Director, Novalink Payment Services GmbH",
    authorUserId: "P-011",
    documentDate: "2026-09-29",
    ingestedAt: "2026-09-29T14:20:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "SUPPLIER QUESTIONNAIRE RESPONSE. Questionnaire TPRM-Q-2026 version 2. Domain 7 of 11, resilience and service continuity. Respondent Novalink Payment Services GmbH. Submitted 29.09.2026. Responses are the supplier's own and are recorded as given.\n\n" +
      "Q R04. Provide disaster recovery test evidence for RepairDesk covering all instances used by Arcadia.\n\n" +
      "Response. Novalink operates an annual disaster recovery test programme across its production estate. The most recent exercise was conducted on 22.05.2026 and the report is attached to this submission. All instances used by Arcadia are in scope of the programme. Novalink is satisfied that the recovery arrangements for the Arcadia services are appropriate and tested.\n\n" +
      "Q R05. Confirm the frequency of disaster recovery testing and the date of the next scheduled exercise.\n\n" +
      "Response. Annual. The next exercise is planned for the second quarter of 2027. Dates are set in the annual planning cycle and are not confirmed at this time.\n\n" +
      "Q R07. Confirm the recovery time objective for RepairDesk and provide evidence that it is achieved.\n\n" +
      "Response. The recovery time objective for RepairDesk is 2 hours, as stated in the service description at Appendix A1 of the master agreement. Novalink has no open recovery time objective breaches on the Arcadia services. Evidence of achievement is provided by the attached exercise report.\n\n" +
      "Q R08. Describe the arrangements for recovery of the repair queue state and the override audit log.\n\n" +
      "Response. Queue state and audit log data are protected by the standard backup and replication arrangements of the hosting platform. Recovery is performed as part of the service recovery and is not separately measured.\n\n" +
      "Q R11. Provide evidence of an exit or substitutability test for RepairDesk.\n\n" +
      "Response. Exit and transition arrangements for the Arcadia services are set out in Appendix A6 of the master agreement. Novalink will support an orderly transition in accordance with that appendix. Novalink does not perform client-specific exit testing as a standard service and no such test has been performed for Arcadia. Novalink would be pleased to discuss a scope and a commercial basis for such an exercise.\n\n" +
      "Q R14. Describe your incident detection and notification capability and confirm that the contractual notification timescale is met.\n\n" +
      "Response. Novalink operates continuous application monitoring, log aggregation and alerting across all services. Detection is automated and alerts are routed to the service desk and the on-call engineering function. Novalink's notification process meets the 30-minute notification requirement in the master agreement. Novalink is not aware of any instance in which that requirement has not been met.\n\n" +
      "Q R19. Provide the most recent penetration test report for NOVA-GATE and RepairDesk.\n\n" +
      "Response. A summary of the most recent penetration test is attached. Novalink does not release full penetration test reports to clients, because the reports contain information about the platform architecture that would create risk if distributed. The summary sets out the scope, the finding counts by severity and the remediation status.\n\n" +
      "Q R21. Confirm whether the RepairDesk override and approval interfaces were within the scope of that test.\n\n" +
      "Response. The test scope is described in the attached summary.\n\n" +
      "Assessor annotation, recorded by Group Third-Party Risk Management on 30.09.2026. Four responses in this domain are not accepted. R04 is not accepted because the attached report's own scope statement covers the Frankfurt and Amsterdam regions and expressly excludes the instance serving Arcadia Bank Schweiz AG, which contradicts the response. R07 is not accepted because the attached report records recovery of the RepairDesk service at 3 hours 40 minutes against the 2 hour objective, which is an open gap of 1 hour 40 minutes, and the response states there are no open breaches. R11 is not accepted because no test evidence exists. R19 and R21 are not accepted because the summary does not answer R21; the response refers the question to a document that does not address it. Follow-up requests issued 18.09.2026, 19.09.2026 and 24.09.2026.",
    summary:
      "Novalink's resilience answers in the 2026 reassessment. The supplier asserts that all Arcadia instances are covered by its recovery programme and that it has no open recovery time objective breaches, both of which its own attached test report contradicts.",
    relatedObjectIds: [
      "TP-0042",
      "SVC-0042-01",
      "SVC-0042-02",
      "SVC-0042-05",
      "CTR-2023-0117-A1",
      "CTR-2023-0117-A5",
      "CTR-2023-0117-A6",
      "MSN-2026-0188",
      "MSN-2026-0177",
      "RSK-0184",
    ],
    pageCount: 6,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The subcontracting answers. The portal-publication-is-notice position is
   * on record here on 29.09.2026, a week before Miriam Falk restates it on
   * the bridge, which is why it is a settled supplier position rather than
   * something invented under pressure. Note also that Amsterdam is absent
   * from the list of locations from which Arcadia data can be accessed.
   */
  {
    id: "EVD-2026-41402",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026 D4",
    title:
      "Novalink reassessment questionnaire responses, domain 4, subcontracting, locations and data access",
    titleDe:
      "Antworten Novalink zur Neubeurteilung, Bereich 4, Unterauftragsverhaeltnisse, Standorte und Datenzugriff",
    sourceType: "supplier-due-diligence",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Miriam Falk, Client Service Director, Novalink Payment Services GmbH",
    authorUserId: "P-011",
    documentDate: "2026-09-29",
    ingestedAt: "2026-09-29T14:22:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "SUPPLIER QUESTIONNAIRE RESPONSE. Questionnaire TPRM-Q-2026 version 2. Domain 4 of 11, subcontracting, locations and data access. Respondent Novalink Payment Services GmbH. Submitted 29.09.2026.\n\n" +
      "Q S01. List all subprocessors supporting the services provided to Arcadia, with location and the service each supports.\n\n" +
      "Response. Helvetia CloudWorks AG, Zurich, Switzerland: infrastructure hosting for the RepairDesk Swiss instance and the euroSIC adapter. Rheinstack GmbH, Cologne, Germany: managed database, backup and regional failover for NOVA-GATE and RepairDesk. Polaris Telemetrix s.r.o., Brno, Czech Republic: application monitoring, log aggregation, alerting and incident detection for all Novalink services. Meridian Operations Support Pvt Ltd, Pune, India: level 1 service desk and out-of-hours monitoring handover for NOVA-GATE and RepairDesk, onboarded 01.05.2026.\n\n" +
      "Q S02. Confirm that all additions, removals and material changes to subprocessors have been notified to Arcadia in accordance with the master agreement.\n\n" +
      "Response. Novalink maintains a current subprocessor register and publishes it on the Novalink client portal. The register is version controlled and each version is dated. The portal is available to all clients and clients are able to subscribe to change notifications. Novalink considers publication of the updated register on the client portal to constitute notice to clients of a change to the register.\n\n" +
      "Q S03. State the notice period applied to a subprocessor change and give the date on which notice of the most recent change was given.\n\n" +
      "Response. Novalink publishes register updates as changes take effect. The current register version is 6.1 dated 03.08.2026.\n\n" +
      "Q S04. List any fourth parties, being subcontractors of your subprocessors, that process or have access to Arcadia data.\n\n" +
      "Response. Novalink's subprocessors are contractually responsible for their own supply chains and are required to maintain appropriate controls over their subcontractors. Novalink does not maintain a consolidated fourth-party inventory.\n\n" +
      "Q S04 follow-up, asked 24.09.2026. Arcadia requires the identity of any fourth party that holds or archives Arcadia payment data.\n\n" +
      "Response, received 26.09.2026. Novalink has consulted its subprocessors. Polaris Telemetrix s.r.o. uses Aurora Object Storage Ltd, Dublin, Ireland, for long-term archive of log and telemetry data with a 24-month retention period. Novalink notes that archived telemetry may include payment reference metadata. Novalink has no other fourth party to disclose in respect of the Arcadia services.\n\n" +
      "Q S06. List all locations from which Arcadia payment data can be accessed, including access by subprocessor personnel.\n\n" +
      "Response. Frankfurt am Main, Germany. Zurich, Switzerland. Brno, Czech Republic. Following the follow-up question of 24.09.2026, Novalink confirms that Pune, India, should be added, where Meridian Operations Support personnel hold read access to payment metadata including beneficiary name and reference fields in the course of level 1 service desk activity.\n\n" +
      "Q S09. Confirm the hosting regions used for each service.\n\n" +
      "Response. Services are hosted in the primary region with automated failover to a secondary region as described in the service architecture documentation. Region detail is available on request.\n\n" +
      "Assessor annotation, recorded by Group Third-Party Risk Management on 30.09.2026. The response to S01 lists four subprocessors. The binding subprocessor appendix CTR-2023-0117-A3 version 4.2 lists three and does not include Meridian Operations Support Pvt Ltd. The response to S02 asserts that portal publication constitutes notice; appendix A3 clause 3.4 requires 60 days prior written notice with a 30-day objection right and does not provide for portal publication. The response to S06 discloses access from a third country that Arcadia had not previously recorded. The response to S09 does not answer the question and the region detail requested on 24.09.2026 has not been provided. Recorded as an unresolved transparency gap under the Group Third-Party Risk Policy section 6.2 pending a Group Legal determination on which document is binding.",
    summary:
      "Novalink's subcontracting answers. They disclose a fourth subprocessor in India with payment metadata access, assert that publishing its register on a client portal constitutes contractual notice, and decline to give hosting region detail.",
    relatedObjectIds: [
      "TP-0042",
      "TP-0042.1",
      "TP-0042.2",
      "TP-0042.3",
      "TP-0042.4",
      "TP-0042.3-F1",
      "CTR-2023-0117-A3",
      "CTR-2023-0117-A7",
      "MSN-2026-0191",
      "MSN-2026-0221",
      "KRI-TPR-002",
      "REG-2026-0031",
      "REG-2026-0088",
      "POL-TPR-6.2",
    ],
    pageCount: 7,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* Two pages, and the two pages do not say whether the highest-privilege
   * function in the process was tested. Stale on the 90-day rule as well. */
  {
    id: "EVD-2026-40233",
    runId: DEFAULT_RUN_ID,
    reference: "NOVALINK-PT-2026-SUMMARY",
    title: "Novalink penetration test summary, engagement of June 2026, two pages",
    titleDe: "Novalink Zusammenfassung des Penetrationstests, Juni 2026, zwei Seiten",
    sourceType: "supplier-due-diligence",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Novalink Payment Services GmbH, Information Security",
    authorUserId: null,
    documentDate: "2026-06-30",
    ingestedAt: "2026-09-19T10:05:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: true,
    stalenessNote:
      "Dated 30.06.2026 and relied upon on 06.10.2026, 98 days later, against the 90-day limit for evidence supporting a Tier 1 reassessment in the Group Third-Party Risk Policy section 8.4. Staleness is the lesser problem: the scope statement does not confirm whether the RepairDesk override and approval interfaces were tested, so the document cannot support a conclusion on the control-relevant part of the platform at any age.",
    provenance: "stakeholder-statement",
    body:
      "PENETRATION TEST SUMMARY. Novalink Payment Services GmbH. Prepared for client distribution. Two pages. Issued 30.06.2026.\n\n" +
      "Engagement. An independent security testing provider was engaged to perform penetration testing of the Novalink payment platform. Testing was conducted between 08.06.2026 and 19.06.2026. The provider is a specialist security testing firm holding industry accreditation; the provider is not named in this summary.\n\n" +
      "Scope statement. Testing covered the externally exposed interfaces of the Novalink payment platform, comprising the client-facing web application, the client API gateway, and the authentication and session management layer. Testing was performed against the pre-production environment configured to match production.\n\n" +
      "Method. Authenticated and unauthenticated testing from an external network position, supported by a review of the authentication and authorisation model. Testing was time-boxed to the engagement window.\n\n" +
      "Findings. Critical: none. High: 2. Medium: 7. Low: 14. Informational: 9.\n\n" +
      "Remediation status as at the date of this summary. Both high findings have been remediated and retested. Five of the seven medium findings have been remediated. Two medium findings are scheduled for remediation in the third quarter of 2026. Low and informational findings are managed through the normal maintenance cycle.\n\n" +
      "Statement on disclosure. Novalink does not release the full report. The full report contains architecture, configuration and infrastructure detail whose distribution would itself create risk. Clients requiring additional assurance may raise specific questions through their client service contact and Novalink will respond where it can do so without disclosing that detail.\n\n" +
      "Arcadia assessor note, recorded 19.09.2026. The scope statement describes externally exposed interfaces. It does not state whether the RepairDesk override creation interface, the secondary review interface or the bulk approval screen were within scope. Those are internal application functions reached through the client-facing application and they carry the highest privilege in the payment repair process. A specific question was put to Novalink on 24.09.2026 and is unanswered. Arcadia therefore cannot determine from this document whether the override and approval functions have been tested.",
    summary:
      "The two-page penetration test summary Novalink released in place of the full report. It gives finding counts and remediation status but its scope statement does not say whether the RepairDesk override and approval interfaces were tested.",
    relatedObjectIds: [
      "TP-0042",
      "SVC-0042-01",
      "SVC-0042-02",
      "SYS-0012",
      "SYS-0014",
      "CTL-PAY-014",
    ],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* The assessment that concluded Novalink is substitutable, on an assumption
   * that Arcadia holds a capability it does not hold. Fifteen months old. */
  {
    id: "EVD-2026-41440",
    runId: DEFAULT_RUN_ID,
    reference: "TPR-SUB-2025-0042",
    title: "Substitutability assessment, TP-0042 Novalink Payment Services GmbH",
    titleDe: "Beurteilung der Ersetzbarkeit, TP-0042 Novalink Payment Services GmbH",
    sourceType: "supplier-due-diligence",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2025-06-30",
    ingestedAt: "2025-06-30T16:15:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: true,
    stalenessNote:
      "Completed 30.06.2025, being 463 days before the scenario day. The Group Third-Party Risk Policy requires the substitutability position for a Tier 1 arrangement to be reconfirmed in each annual reassessment cycle. The 2026 cycle has not reconfirmed it. The assessment also rests on an assumption about Arcadia's internal tooling that has not been tested in the intervening period.",
    provenance: "approved-record",
    body:
      "SUBSTITUTABILITY ASSESSMENT. Third party TP-0042 Novalink Payment Services GmbH. Completed 30.06.2025. Tier 1 of 4 on the Arcadia internal criticality scale.\n\n" +
      "1. Purpose. To assess whether, and within what period, the services provided by TP-0042 could be transferred to an alternative provider or brought in-house, so that the criticality rating and the exit plan can be tested against a realistic transition period.\n\n" +
      "2. Services in scope. SVC-0042-01 payment validation and clearing gateway. SVC-0042-02 payment repair workbench. SVC-0042-03 payment file transformation and format library maintenance. SVC-0042-04 hosted payment reconciliation and exception reporting. SVC-0042-05 Swiss clearing connectivity adapter.\n\n" +
      "3. Market position. Three alternative providers were identified as capable of supplying an equivalent validation and clearing gateway for the EUR routes. One of the three also offers a repair workbench. None of the three was found to offer a Swiss clearing connectivity adapter with equivalent functional coverage to SVC-0042-05; the Swiss route would require either a direct participant application or a correspondent arrangement.\n\n" +
      "4. Transition estimate. The assessment concludes that the arrangement is substitutable within 12 to 18 months, with a material programme cost. The estimate comprises provider selection and contracting at 3 to 4 months, integration and format library migration at 6 to 9 months, parallel running at 2 to 3 months, and decommissioning at 1 to 2 months. The Swiss adapter is the longest lead item and is the binding constraint on the upper end of the range.\n\n" +
      "5. Assumptions, stated. Assumption A: during a transition, Arcadia would operate the payment repair queue on an internal tool while the replacement workbench is integrated. Assumption B: the format library can be migrated rather than rebuilt. Assumption C: clearing scheme approvals for a new gateway provider can be obtained within the contracting phase.\n\n" +
      "6. Concentration finding. TP-0042 provides SYS-0012 payment validation, SYS-0014 payment repair tooling and SYS-0015 Swiss clearing connectivity. The provider that validates payments also supplies the tool used to repair and override them, and also supplies the Swiss clearing adapter. A single provider event therefore affects validation, repair and Swiss clearing simultaneously. This is recorded as the principal structural feature of the relationship.\n\n" +
      "7. Testing. No exit or substitutability test has been performed. The conclusion in section 4 is a desk assessment.\n\n" +
      "8. Recommendation. Perform an exit and substitutability test for SVC-0042-02 within the next assessment cycle, focused on Assumption A, because the assessment cannot be relied upon if Arcadia does not in fact hold an internal repair capability.\n\n" +
      "9. Status of the recommendation. Raised as Massnahme MSN-2026-0177, owner Stefan Brunner with Andreas Kellner, due 31.12.2026, not started. The same test is a condition of the conditional Risikoakzeptanz recorded against RSK-0184.\n\n" +
      "Illustrative regulatory context, not legal advice.",
    summary:
      "The 2025 substitutability assessment concluding that Novalink is replaceable within 12 to 18 months. The conclusion rests on an untested assumption that Arcadia could run the repair queue on an internal tool, and the recommended test has not started.",
    relatedObjectIds: [
      "TP-0042",
      "SVC-0042-01",
      "SVC-0042-02",
      "SVC-0042-05",
      "SYS-0012",
      "SYS-0014",
      "SYS-0015",
      "MSN-2026-0177",
      "RSK-0184",
      "CTR-2023-0117-A6",
      "POL-TPR-3.1",
    ],
    pageCount: 12,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41445",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-2026-0042-INT",
    title:
      "Novalink annual reassessment 2026, interim status note as at 05.10.2026",
    titleDe:
      "Jaehrliche Neubeurteilung Novalink 2026, Zwischenstand zum 05.10.2026",
    sourceType: "supplier-due-diligence",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-10-05",
    ingestedAt: "2026-10-05T17:30:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "INTERIM STATUS NOTE. Annual reassessment 2026 of TP-0042 Novalink Payment Services GmbH. Prepared for the NFR Committee agenda item AG-CMT-NFR-2026-10-04. Position as at 05.10.2026.\n\n" +
      "1. Cycle. Kick-off 15.09.2026. Target completion 31.10.2026. Lead: Group Third-Party Risk Management. Questionnaire TPRM-Q-2026 version 2, comprising 214 questions across 11 domains.\n\n" +
      "2. Response position. 198 of 214 questions answered, being 92.5 percent. The 16 outstanding questions are concentrated in domain 4, subcontracting and locations, and domain 7, resilience and service continuity.\n\n" +
      "3. Evidence position. 41 evidence artefacts requested. 33 received. 26 accepted. 7 received but not accepted, on the grounds that the artefact does not answer the question asked, does not cover the scope asked about, or contradicts another artefact in the same submission. 8 requested artefacts not received.\n\n" +
      "4. Open items requiring resolution before the cycle can close. Four unresolved resilience questions, being TPRM-Q-2026-R04 disaster recovery evidence for the Swiss instance, R07 the recovery time objective gap, R11 exit and substitutability test evidence, and R19 the penetration test scope. Eight missing artefacts. Seven received but not accepted.\n\n" +
      "5. Assessment of the position. The 92.5 percent response rate overstates progress. The unanswered questions and the unaccepted artefacts are not randomly distributed: they are the questions about resilience of the services supporting an important business service, and the questions about who else touches Arcadia payment data. The domains that are complete are the ones on which Novalink holds ready documentation.\n\n" +
      "6. Specific concerns carried into the assessment. First, Arcadia Bank Schweiz AG holds no recovery test evidence for RepairDesk, which is a significant outsourcing for that entity. Second, the recovery time objective gap of 1 hour 40 minutes disclosed in EVD-2026-40118 has been in Arcadia's possession since 27.05.2026 without assessment, which is an Arcadia failure rather than a supplier failure. Third, the binding subprocessor appendix does not match the supplier's own register. Fourth, a service level miss on SVC-0042-01 for September 2026 was identified by Arcadia calculation rather than by supplier report.\n\n" +
      "7. Recommendation to the committee. Do not close the 2026 cycle on the current evidence. Continue to the 31.10.2026 target with the four resilience questions escalated to the supplier at director level, and record the reassessment as subject to conditions under the Group Third-Party Risk Policy section 5.4, with each condition carrying a named owner, a deadline and a stated consequence.\n\n" +
      "8. Note on the conditional risk acceptance. The conditional Risikoakzeptanz recorded against RSK-0184 on 19.01.2026 is valid to 31.12.2026 and is conditioned on completion of the 2026 reassessment and on an exit test. The exit test has not started and there is no plan to start it.\n\n" +
      "Illustrative regulatory context, not legal advice.",
    summary:
      "The interim status of the Novalink reassessment: 198 of 214 questions answered but only 26 of 41 evidence artefacts accepted, with the gaps concentrated in resilience and subcontracting, and a recommendation not to close the cycle on current evidence.",
    relatedObjectIds: [
      "TP-0042",
      "MSN-2026-0188",
      "MSN-2026-0191",
      "MSN-2026-0177",
      "RSK-0184",
      "KRI-TPR-002",
      "AG-CMT-NFR-2026-10-04",
      "POL-TPR-5.4",
      "POL-TPR-8.1",
    ],
    pageCount: 9,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* Gap 4 of 7. */
  {
    id: "EVD-2026-41215",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026-R19 EVD",
    title:
      "Requested: full penetration test report, or a scope confirmation covering the RepairDesk override interfaces",
    titleDe:
      "Angefordert: vollstaendiger Penetrationstestbericht oder Bestaetigung des Pruefumfangs",
    sourceType: "supplier-due-diligence",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-09-24",
    ingestedAt: "2026-09-24T09:15:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "requested",
    requestedFromLabel: "Novalink Payment Services GmbH, Client Service (Miriam Falk)",
    requestedOn: "2026-09-24",
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "What was asked. On 24.09.2026, under reassessment question TPRM-Q-2026-R19 and the follow-up R21, Arcadia asked Novalink either for the full penetration test report for the engagement of June 2026, or, failing that, for a written statement from the testing provider confirming whether the RepairDesk override creation interface, the secondary review interface and the bulk approval screen were within the test scope.\n\n" +
      "What came back. Nothing as at 06.10.2026 07:00. Novalink's position on the full report was restated in the domain 7 questionnaire response of 29.09.2026: full reports are not released to clients. The alternative request, being a scope confirmation only, has not been answered and has not been refused.\n\n" +
      "Why the alternative was offered. Arcadia accepts that a full penetration test report contains architecture detail a supplier may reasonably withhold. A scope confirmation discloses nothing sensitive. The refusal of the first request is understandable; the silence on the second is the open item.\n\n" +
      "Status. Outstanding. Recorded as one of the seven artefacts received but not accepted, on the basis that EVD-2026-40233 does not answer the question. Escalation to director level scheduled for the next service review.",
    summary:
      "An open request. Arcadia asked Novalink on 24.09.2026 either for the full penetration test report or simply for confirmation that the RepairDesk override interfaces were in test scope, and the narrower request has not been answered.",
    relatedObjectIds: ["TP-0042", "SVC-0042-02", "SYS-0014", "CTL-PAY-014"],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* Gap 5 of 7. This one is also an unmet condition of a live risk
   * acceptance, which is what makes it more than a missing document. */
  {
    id: "EVD-2026-41220",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026-R11 EVD",
    title:
      "Requested: exit or substitutability test evidence for SVC-0042-02 payment repair workbench",
    titleDe:
      "Angefordert: Nachweis eines Ausstiegs- oder Ersetzbarkeitstests fuer SVC-0042-02",
    sourceType: "supplier-due-diligence",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-09-19",
    ingestedAt: "2026-09-19T11:50:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "missing",
    requestedFromLabel: "Novalink Payment Services GmbH, Client Service (Miriam Falk)",
    requestedOn: "2026-09-19",
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "What was asked. On 19.09.2026, under reassessment question TPRM-Q-2026-R11, Arcadia asked Novalink for evidence of any exit or substitutability test performed in respect of SVC-0042-02, the payment repair workbench.\n\n" +
      "What came back. Novalink referred Arcadia to Appendix A6 of the master agreement and confirmed on 29.09.2026 that it does not perform client-specific exit testing as a standard service and that no such test has been performed for Arcadia.\n\n" +
      "Why the referral does not answer the question. Appendix A6 is a plan, not a test. The plan assumes that Arcadia can operate a payment repair queue on an internal tool during transition. Arcadia holds no such tool. The plan therefore relies on a capability Arcadia does not have, which makes it unexecutable as drafted, and no test has been performed that would have surfaced that.\n\n" +
      "Status. This evidence does not exist on either side. It is not a supplier refusal; it is an exercise nobody has run.\n\n" +
      "Consequence. The exit test is a condition of the conditional Risikoakzeptanz recorded against RSK-0184 on 19.01.2026, valid to 31.12.2026. The condition is unmet and there is no plan to meet it. Under the Group Third-Party Risk Policy section 5.4 a condition without a consequence is not a condition, so the position requires a committee decision rather than a further extension.\n\n" +
      "Tracking. Massnahme MSN-2026-0177, due 31.12.2026, not started.\n\n" +
      "Illustrative regulatory context, not legal advice.",
    summary:
      "A missing test rather than a withheld document. No exit or substitutability test exists for the payment repair workbench, and that test is an unmet condition of the risk acceptance currently held against the third-party concentration risk.",
    relatedObjectIds: [
      "TP-0042",
      "SVC-0042-02",
      "CTR-2023-0117-A6",
      "MSN-2026-0177",
      "RSK-0184",
      "POL-TPR-5.4",
      "KRI-RES-005",
    ],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* Gap 6 of 7. Requested the day after Arcadia worked the number out for
   * itself, which is the wrong order for a service level report. */
  {
    id: "EVD-2026-41240",
    runId: DEFAULT_RUN_ID,
    reference: "REQ-2026-0702",
    title:
      "Requested: Novalink monthly service level report for September 2026, SVC-0042-01 and SVC-0042-02",
    titleDe:
      "Angefordert: Novalink Monatsbericht zu den Dienstguetevereinbarungen, September 2026",
    sourceType: "supplier-due-diligence",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-10-05",
    ingestedAt: "2026-10-05T12:05:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "requested",
    requestedFromLabel: "Novalink Payment Services GmbH, Client Service (Miriam Falk)",
    requestedOn: "2026-10-05",
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "What was asked. On 05.10.2026 Arcadia requested the monthly service level report for September 2026 for SVC-0042-01 payment validation and clearing gateway and SVC-0042-02 payment repair workbench, including the availability calculation, the excluded planned maintenance windows and any service credit position.\n\n" +
      "Why it was requested rather than received. The report is due monthly under CTR-2023-0117-A1. The September 2026 report had not been received by the fourth business day of October, when the equivalent August report had been received on the second business day. Arcadia computed availability independently from its own edge measurement and recorded 99.62 percent against a contracted 99.70 percent, which is a service level miss.\n\n" +
      "Status. Outstanding as at 06.10.2026 07:00. No acknowledgement received.\n\n" +
      "Why it matters. A supplier-side measurement is the only thing that will confirm or rebut Arcadia's own figure, and it is also the only thing that will distinguish supplier-side degradation from a network path problem. Until it arrives, the September availability position is an Arcadia inference rather than an agreed fact.",
    summary:
      "An open request for the supplier's own September service level report, made after Arcadia calculated a service level miss from its own telemetry because the monthly report had not arrived.",
    relatedObjectIds: [
      "TP-0042",
      "SVC-0042-01",
      "SVC-0042-02",
      "CTR-2023-0117-A1",
      "KRI-PAY-007",
    ],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41405",
    runId: DEFAULT_RUN_ID,
    reference: "NOVALINK-SUBREG v6.1",
    title: "Novalink subprocessor register, version 6.1, as published on the client portal",
    titleDe: "Novalink Verzeichnis der Unterauftragnehmer, Version 6.1",
    sourceType: "subprocessor-list",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Novalink Payment Services GmbH, Vendor Management Office",
    authorUserId: null,
    documentDate: "2026-08-03",
    ingestedAt: "2026-09-21T09:30:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "NOVALINK SUBPROCESSOR REGISTER. Version 6.1. Dated 03.08.2026. Published on the Novalink client portal. Supersedes version 6.0 dated 11.02.2026.\n\n" +
      "Front matter as published. This register lists the subprocessors engaged by Novalink Payment Services GmbH in the provision of its services. The register is maintained by the Vendor Management Office and is updated as changes take effect. Clients may subscribe to portal change notifications. Subprocessors are required by contract to maintain controls equivalent to those Novalink owes to its clients.\n\n" +
      "Entry 1. Helvetia CloudWorks AG. Registered seat Zurich, Switzerland. Processing location Zurich, Switzerland. Service provided to Novalink: infrastructure hosting. Novalink services supported: RepairDesk Swiss instance, euroSIC adapter. Engaged since 14.02.2025.\n\n" +
      "Entry 2. Rheinstack GmbH. Registered seat Cologne, Germany. Processing locations Frankfurt am Main, Germany (primary) and Amsterdam, Netherlands (secondary). Service provided to Novalink: managed database, backup and regional failover. Novalink services supported: NOVA-GATE, RepairDesk, hosted reconciliation. Engaged since 09.01.2024.\n\n" +
      "Entry 3. Polaris Telemetrix s.r.o. Registered seat Brno, Czech Republic. Processing location Brno, Czech Republic. Service provided to Novalink: application monitoring, log aggregation, alerting and incident detection. Novalink services supported: all. Engaged since 14.02.2025.\n\n" +
      "Entry 4. Meridian Operations Support Pvt Ltd. Registered seat Pune, India. Processing location Pune, India. Service provided to Novalink: level 1 service desk and out-of-hours monitoring handover. Novalink services supported: NOVA-GATE, RepairDesk. Engaged since 01.05.2026.\n\n" +
      "Register notes as published. Data access. Subprocessor personnel are granted the minimum access required for their function. Level 1 service desk personnel hold read access to service and transaction metadata for the purpose of incident triage. Fourth parties. This register does not extend to subcontractors engaged by the subprocessors listed above.\n\n" +
      "Version history as published. 6.1, 03.08.2026: addition of entry 4 and update of entry 2 processing locations. 6.0, 11.02.2026: annual review, no change. 5.2, 14.02.2025: addition of entries 1 and 3.\n\n" +
      "Arcadia ingestion note, 21.09.2026. Retrieved from the Novalink client portal by Group Third-Party Risk Management during the reassessment. Not received as a notice. No covering communication accompanied version 6.1 and none is held in the Arcadia contract repository.",
    summary:
      "The supplier's own current subprocessor register, listing four subprocessors including Meridian in Pune and two Rheinstack processing locations. Arcadia retrieved it from the portal during the reassessment rather than receiving it as a notice.",
    relatedObjectIds: [
      "TP-0042",
      "TP-0042.1",
      "TP-0042.2",
      "TP-0042.3",
      "TP-0042.4",
      "CTR-2023-0117-A3",
      "KRI-TPR-002",
      "MSN-2026-0191",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Provenance is "conflicting-evidence" deliberately. The content of this
   * document is a documented disagreement between two other documents, and
   * calling it a verified fact would flatten the thing it exists to show.
   */
  {
    id: "EVD-2026-41415",
    runId: DEFAULT_RUN_ID,
    reference: "TPR-REC-2026-0042",
    title:
      "Subprocessor reconciliation working sheet, binding appendix A3 v4.2 against Novalink register v6.1",
    titleDe:
      "Abstimmungsblatt Unterauftragnehmer, bindende Anlage A3 v4.2 gegen Novalink Verzeichnis v6.1",
    sourceType: "subprocessor-list",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-09-21",
    ingestedAt: "2026-09-21T15:45:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "conflicting-evidence",
    body:
      "RECONCILIATION WORKING SHEET. Prepared 21.09.2026 during the 2026 reassessment of TP-0042. Compares the binding contractual subprocessor schedule at CTR-2023-0117-A3 version 4.2 dated 14.02.2025 against the Novalink subprocessor register version 6.1 dated 03.08.2026.\n\n" +
      "Line 1. Number of subprocessors. Appendix A3 v4.2: three. Register v6.1: four. Divergence: one undisclosed addition.\n\n" +
      "Line 2. TP-0042.1 Helvetia CloudWorks AG. Appendix: listed, Zurich. Register: listed, Zurich. Divergence: none.\n\n" +
      "Line 3. TP-0042.2 Rheinstack GmbH. Appendix: listed, processing region Frankfurt am Main. Register: listed, processing regions Frankfurt am Main and Amsterdam. Divergence: an undisclosed secondary processing region in a different country from the one contracted.\n\n" +
      "Line 4. TP-0042.3 Polaris Telemetrix s.r.o. Appendix: listed, Brno. Register: listed, Brno. Divergence: none.\n\n" +
      "Line 5. TP-0042.4 Meridian Operations Support Pvt Ltd. Appendix: absent. Register: listed, Pune, India, engaged since 01.05.2026, holding read access to payment metadata including beneficiary name and reference fields. Divergence: an undisclosed subprocessor in a third country with access to payment metadata, engaged 158 days before this reconciliation was performed.\n\n" +
      "Line 6. Fourth parties. Appendix: not addressed. Register: expressly excluded. Divergence: neither document addresses the subprocessors' own subcontractors. Aurora Object Storage Ltd, Dublin, was disclosed only in response to a specific follow-up question and holds archived telemetry containing payment reference metadata for 24 months.\n\n" +
      "Repository search performed 21.09.2026. Scope: the Arcadia contract repository and the shared supplier mailbox, for any communication from Novalink between 01.01.2025 and 21.09.2026 referring to a subprocessor addition, a subprocessor change, a processing location change or Appendix A3. Search terms: subprocessor, Unterauftragnehmer, Appendix A3, Meridian, Pune, Amsterdam, processing location. Result: no notice of the Meridian engagement. No notice of the Amsterdam processing region. Two unrelated communications about Appendix A3 dated February 2025, being the notices for entries 1 and 3, both correctly given.\n\n" +
      "Position of the two parties. Appendix A3 clause 3.4 requires 60 days prior written notice of any addition, removal or material change to a subprocessor, with a 30-day objection right for Arcadia. Novalink's position, recorded in its questionnaire response of 29.09.2026, is that publication of the register on the client portal constitutes notice. Appendix A3 does not provide for notice by publication.\n\n" +
      "Conclusion recorded. This is an unresolved transparency gap under the Group Third-Party Risk Policy section 6.2, which provides that where the register and the contractual appendix do not agree, the arrangement is treated as having an unresolved transparency gap until Group Legal has established which document is binding. It is recorded as an issue because it affects a critical function. It is not recorded as a breach, because which document governs notice is a contractual question that Arcadia has not yet determined and Novalink has not yet been put on formal notice.\n\n" +
      "Actions. Massnahme MSN-2026-0191 raised, reconcile the binding appendix against the current register and agree a contract variation, owner Group Third-Party Risk Management with Procurement and Group Legal, due 13.11.2026. Group Legal opinion requested on which document is binding.\n\n" +
      "Effect on reporting. KRI-TPR-002, Tier 1 third parties with a complete and current subprocessor record, moves from 96.4 percent to 94.6 percent on this finding, crossing into red.\n\n" +
      "Illustrative regulatory context, not legal advice. Subcontracting and register-of-information considerations apply to ARC-DE and ARC-AT under the EU framework. For Arcadia Bank Schweiz AG the Meridian access question is considered under FINMA outsourcing context and under Swiss data protection law, and is assessed separately.",
    summary:
      "The reconciliation that found the appendix divergence: one undisclosed subprocessor in India with payment metadata access, one undisclosed hosting region, and fourth parties addressed by neither document, with no notice for either change in the contract repository.",
    relatedObjectIds: [
      "TP-0042",
      "TP-0042.2",
      "TP-0042.4",
      "TP-0042.3-F1",
      "CTR-2023-0117-A3",
      "MSN-2026-0191",
      "MSN-2026-0221",
      "KRI-TPR-002",
      "REG-2026-0031",
      "REG-2026-0088",
      "POL-TPR-6.2",
    ],
    pageCount: 3,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Gap 7 of 7, and the only one where the absence is itself the evidence.
   * Provenance is verified-fact because a documented nil result from a
   * defined repository search is a fact about Arcadia's own records.
   */
  {
    id: "EVD-2026-41235",
    runId: DEFAULT_RUN_ID,
    reference: "REQ-2026-0629",
    title:
      "Missing: subprocessor notice for TP-0042.4 Meridian Operations Support under Appendix A3 clause 3.4",
    titleDe:
      "Fehlend: Mitteilung zum Unterauftragnehmer TP-0042.4 gemaess Anlage A3 Ziffer 3.4",
    sourceType: "subprocessor-list",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager",
    authorUserId: "P-002",
    documentDate: "2026-09-21",
    ingestedAt: "2026-09-21T16:10:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "missing",
    requestedFromLabel: "Novalink Payment Services GmbH, Client Service (Miriam Falk)",
    requestedOn: "2026-09-21",
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "What was asked. On 21.09.2026 Arcadia asked Novalink to provide a copy of the notice given to Arcadia of the engagement of Meridian Operations Support Pvt Ltd as a subprocessor, together with the date of that notice, and the equivalent notice for the addition of the Amsterdam processing region for Rheinstack GmbH.\n\n" +
      "What came back. Novalink responded on 25.09.2026 that the subprocessor register is published on the client portal and that no separate written notice is issued. Novalink has not produced a notice document because, on its own account, none exists.\n\n" +
      "What Arcadia holds. Nothing. A defined search of the contract repository and the shared supplier mailbox for the period 01.01.2025 to 21.09.2026 returned no notice for either change. The search terms and the nil result are recorded in EVD-2026-41415.\n\n" +
      "What the contract requires. Appendix A3 clause 3.4 requires 60 days prior written notice of any addition, removal or material change to a subprocessor, and gives Arcadia 30 days from notice in which to object. Meridian was engaged by Novalink on 01.05.2026.\n\n" +
      "Status. The document does not exist. This is recorded as a missing artefact rather than an outstanding request, because the supplier has stated that no such document was ever created. The contractual consequence is a live question, not a settled breach, and is the subject of a Group Legal opinion.\n\n" +
      "Illustrative regulatory context, not legal advice.",
    summary:
      "A document that does not exist. Novalink engaged a subprocessor in India on 01.05.2026 and states that it issues no written notice, so there is no notice in Arcadia's repository and none was ever created.",
    relatedObjectIds: [
      "TP-0042",
      "TP-0042.4",
      "TP-0042.2",
      "CTR-2023-0117-A3",
      "MSN-2026-0221",
      "MSN-2026-0191",
      "KRI-TPR-002",
    ],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The binding appendix. This is the counterparty document to
   * EVD-2026-41402: clause 3.4 requires 60 days prior written notice and the
   * schedule lists three subprocessors, where the supplier's register lists
   * four and the supplier says publication is enough.
   */
  {
    id: "EVD-2026-41410",
    runId: DEFAULT_RUN_ID,
    reference: "CTR-2023-0117-A3 v4.2",
    title:
      "Master Services Agreement appendix A3, subprocessor list and notice provisions, version 4.2",
    titleDe:
      "Rahmenvertrag Anlage A3, Verzeichnis der Unterauftragnehmer und Mitteilungspflichten, Version 4.2",
    sourceType: "contract-clause",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Arcadia Bank AG and Novalink Payment Services GmbH, executed appendix",
    authorUserId: null,
    documentDate: "2025-02-14",
    ingestedAt: "2025-02-14T17:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "APPENDIX A3 TO MASTER SERVICES AGREEMENT CTR-2023-0117. Subprocessor list. Version 4.2. Dated 14.02.2025. Executed by both parties. Governing law: German law, with the Swiss law overlay in the ARC-CH accession schedule applying to data and supervisory access provisions.\n\n" +
      "Clause 3.1. The Supplier may engage subprocessors in the provision of the Services only where the subprocessor is listed in the Schedule to this Appendix or has been notified and not objected to in accordance with clause 3.4.\n\n" +
      "Clause 3.2. The Supplier remains responsible for the performance of any subprocessor as if the acts and omissions of the subprocessor were the acts and omissions of the Supplier.\n\n" +
      "Clause 3.3. The Supplier shall impose on each subprocessor obligations no less onerous than those the Supplier owes to the Bank under this Agreement in respect of information security, data protection, business continuity, audit and supervisory access.\n\n" +
      "Clause 3.4. The Supplier shall give the Bank not less than sixty days prior written notice of any addition to, removal from, or material change in the role, processing location or scope of access of any subprocessor engaged in the provision of the Services. The Bank may object to any such addition or change within thirty days of receipt of notice, stating its grounds. Where the Bank objects, the parties shall discuss the objection in good faith, and the Supplier shall not proceed with the addition or change in respect of the Services provided to the Bank while the objection remains unresolved. For the purposes of this clause, notice means notice in writing to the Bank contract manager named in Appendix A2.\n\n" +
      "Clause 3.5. The Supplier shall maintain a register of subprocessors engaged in the provision of the Services and shall make the register available to the Bank on request. Maintenance of the register does not discharge the notice obligation in clause 3.4.\n\n" +
      "Schedule to Appendix A3, being the subprocessors listed as at the date of this version.\n\n" +
      "Item 1. Helvetia CloudWorks AG, Zurich, Switzerland. Function: infrastructure hosting. Processing location: Zurich, Switzerland. Services supported: payment repair workbench for Arcadia Bank Schweiz AG, Swiss clearing connectivity adapter.\n\n" +
      "Item 2. Rheinstack GmbH, Cologne, Germany. Function: managed database, backup and regional failover. Processing location: Frankfurt am Main, Germany. Services supported: payment validation and clearing gateway, payment repair workbench, hosted payment reconciliation.\n\n" +
      "Item 3. Polaris Telemetrix s.r.o., Brno, Czech Republic. Function: application monitoring, log aggregation, alerting and incident detection. Processing location: Brno, Czech Republic. Services supported: all Services.\n\n" +
      "Note on the Schedule. The Schedule states a single processing location for each subprocessor. There is no provision in this Appendix addressing subcontractors engaged by a subprocessor.\n\n" +
      "Version control. Version 4.2, 14.02.2025: addition of items 1 and 3 following notices given 14.02.2025 [read: notices given in December 2024 and accepted]. Version 4.1, 09.01.2024: addition of item 2. Version 4.0, 01.09.2023: original appendix, no subprocessors listed.\n\n" +
      "Status as at 06.10.2026. This is the binding version. No later version has been executed.",
    summary:
      "The binding contractual subprocessor appendix. Clause 3.4 requires 60 days prior written notice to a named contract manager for any subprocessor addition or processing location change, clause 3.5 states that maintaining a register does not discharge that obligation, and the schedule lists three subprocessors with one location each.",
    relatedObjectIds: [
      "CTR-2023-0117",
      "CTR-2023-0117-A3",
      "TP-0042",
      "TP-0042.1",
      "TP-0042.2",
      "TP-0042.3",
      "MSN-2026-0191",
      "MSN-2026-0221",
      "POL-TPR-6.2",
    ],
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41420",
    runId: DEFAULT_RUN_ID,
    reference: "CTR-2023-0117-A5 v2.0",
    title:
      "Master Services Agreement appendix A5, incident notification and escalation, version 2.0",
    titleDe:
      "Rahmenvertrag Anlage A5, Meldung und Eskalation von Vorfaellen, Version 2.0",
    sourceType: "contract-clause",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Arcadia Bank AG and Novalink Payment Services GmbH, executed appendix",
    authorUserId: null,
    documentDate: "2024-10-15",
    ingestedAt: "2024-10-15T14:30:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "APPENDIX A5 TO MASTER SERVICES AGREEMENT CTR-2023-0117. Incident notification and escalation. Version 2.0. Dated 15.10.2024.\n\n" +
      "Clause 5.1. The Supplier shall operate detection and alerting sufficient to identify a disruption to any Service within fifteen minutes of its onset.\n\n" +
      "Clause 5.2. The Supplier shall maintain a client status portal and shall publish disruption information to it. Publication to the portal is in addition to, and does not replace, the notification required by clause 5.3.\n\n" +
      "Clause 5.3. The Supplier shall notify the Bank within thirty minutes of the Supplier's detection of any disruption affecting a Service supporting a critical or important function. The notification shall be sent to the Bank incident mailbox and shall contain all of the following: (a) the time at which the disruption began; (b) the Services affected; (c) the Bank legal entities affected; (d) the severity assigned by the Supplier; (e) an initial assessment of impact on the Bank; and (f) the time by which the next update will be provided. A notification omitting any of these items is not a notification for the purposes of this clause.\n\n" +
      "Clause 5.4. The Supplier shall provide updates at the interval stated under clause 5.3(f) and in any event not less frequently than hourly while the disruption continues.\n\n" +
      "Clause 5.5. The Supplier shall provide a written incident report within five business days of restoration of the Service, containing the root cause, the chronology, the impact on the Bank, the corrective actions taken and the preventive actions planned with dates.\n\n" +
      "Clause 5.6. Escalation. Where the Bank assesses a disruption as severity one under its own classification, the Supplier shall make available its Head of Service Continuity or an equivalent officer to the Bank incident bridge within thirty minutes of request.\n\n" +
      "Clause 5.7. Nothing in this Appendix limits the Bank's own obligations to its clients or to any supervisory authority in respect of a disruption. Illustrative regulatory context, not legal advice.\n\n" +
      "Version control. Version 2.0, 15.10.2024: introduced the six mandatory notification items in clause 5.3 and the closing sentence of that clause, following a 2024 service review at which the Bank raised the quality of disruption notifications. Version 1.0, 01.09.2023: original appendix, which required notification without specifying content.",
    summary:
      "The incident notification appendix. Clause 5.3 requires notification within 30 minutes of supplier detection carrying six mandatory items, and states expressly that a notification omitting any of them is not a notification.",
    relatedObjectIds: [
      "CTR-2023-0117",
      "CTR-2023-0117-A5",
      "TP-0042",
      "INC-2026-0412",
      "NSN-2026-0887",
      "IBS-0004",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41425",
    runId: DEFAULT_RUN_ID,
    reference: "CTR-2023-0117-A1 v3.0",
    title:
      "Master Services Agreement appendix A1, service descriptions and service levels, version 3.0, extract",
    titleDe:
      "Rahmenvertrag Anlage A1, Leistungsbeschreibungen und Dienstguete, Version 3.0, Auszug",
    sourceType: "contract-clause",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Arcadia Bank AG and Novalink Payment Services GmbH, executed appendix",
    authorUserId: null,
    documentDate: "2025-04-01",
    ingestedAt: "2025-04-01T09:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "APPENDIX A1 TO MASTER SERVICES AGREEMENT CTR-2023-0117. Service descriptions and service levels. Version 3.0. Dated 01.04.2025. Extract: clause 7.2 and the service level schedule for SVC-0042-01 and SVC-0042-02.\n\n" +
      "Clause 7.2. Change notification. The Supplier shall give the Bank not less than ten business days prior written notice of any change that affects or may reasonably be expected to affect the availability of a Service supporting a critical or important function, including any change made by or at a subprocessor. Notice shall state the nature of the change, the period during which it will be applied, the Services affected and the expected effect on availability. The Bank may require the Supplier to defer a change that falls within a Bank change freeze notified to the Supplier.\n\n" +
      "Clause 7.3. Emergency change. Where a change must be applied to preserve the security or integrity of a Service and the notice period in clause 7.2 cannot be met, the Supplier shall notify the Bank as soon as reasonably practicable and in any event within four hours of applying the change, with the reason the notice period could not be met.\n\n" +
      "Service level schedule, SVC-0042-01 payment validation and clearing gateway, NOVA-GATE. Availability: 99.70 percent measured monthly, excluding planned maintenance windows notified under clause 7.2. Measurement: the proportion of minutes in the month in which the Service accepted a submission and returned an acknowledgement within the acknowledgement window. Acknowledgement window: 5 seconds at the ninety-fifth percentile. Reporting: a monthly service level report to be provided to the Bank by the third business day of the following month. Service credits: payable on a sliding scale where measured availability falls below the committed level in any month, claimable by the Bank within sixty days of receipt of the report.\n\n" +
      "Service level schedule, SVC-0042-02 payment repair workbench, RepairDesk. Availability: 99.50 percent measured monthly, excluding planned maintenance. Recovery time objective: 2 hours. Recovery point objective: 15 minutes. Measurement of the recovery time objective: elapsed time from declaration of a service-affecting incident to restoration of the Service to a state in which repair, override creation and review can be performed. Reporting: as for SVC-0042-01.\n\n" +
      "Note on the recovery time objective. The 2-hour objective applies to the Service as a whole. The schedule does not distinguish between instances or hosting regions and does not provide separately for the instance serving Arcadia Bank Schweiz AG.\n\n" +
      "Version control. Version 3.0, 01.04.2025: added the acknowledgement window definition and the service credit scale. Version 2.1, 01.03.2024. Version 2.0, 01.09.2023.",
    summary:
      "The service level appendix. It sets NOVA-GATE availability at 99.70 percent monthly with a monthly report due by the third business day, a 2 hour recovery time objective for RepairDesk with no distinction between instances, and 10 business days notice for any change affecting availability including changes at a subprocessor.",
    relatedObjectIds: [
      "CTR-2023-0117",
      "CTR-2023-0117-A1",
      "TP-0042",
      "TP-0042.2",
      "SVC-0042-01",
      "SVC-0042-02",
      "MSN-2026-0217",
      "KRI-RES-005",
    ],
    pageCount: 6,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* The clause that makes the 15:38 configuration export obtainable at all.
   * Without a four-hour extract right the central contradiction would still
   * be open at the end of the day. */
  {
    id: "EVD-2026-41430",
    runId: DEFAULT_RUN_ID,
    reference: "CTR-2023-0117-A4 v1.0",
    title:
      "Master Services Agreement appendix A4, audit, access and supervisory rights, version 1.0",
    titleDe:
      "Rahmenvertrag Anlage A4, Pruefungs-, Zugangs- und Aufsichtsrechte, Version 1.0",
    sourceType: "contract-clause",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Arcadia Bank AG and Novalink Payment Services GmbH, executed appendix",
    authorUserId: null,
    documentDate: "2023-09-01",
    ingestedAt: "2023-09-01T12:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "APPENDIX A4 TO MASTER SERVICES AGREEMENT CTR-2023-0117. Audit, access and supervisory rights. Version 1.0. Dated 01.09.2023.\n\n" +
      "Clause 2.1. Configuration and audit-trail extracts. On request the Supplier shall provide the Bank with extracts of the configuration and the audit trail of any Supplier system processing Bank data, including the rule sets governing workflow transitions in that system. Where the request is made for the purposes of an incident, the Supplier shall provide the extract within four hours of the request. In all other cases the Supplier shall provide the extract within five business days. The Supplier may redact information relating to other clients of the Supplier.\n\n" +
      "Clause 2.2. Audit right. The Bank, its internal audit function and any third party appointed by the Bank may audit the Supplier's performance of the Services on reasonable notice, not more than twice in any twelve month period other than following a material incident, in which case the limit does not apply.\n\n" +
      "Clause 2.3. Subprocessor access. The rights in clauses 2.1 and 2.2 extend to any subprocessor engaged in the provision of the Services, and the Supplier shall procure that each subprocessor gives effect to them.\n\n" +
      "Clause 2.4. Supervisory access, European Union entities. The Supplier shall give any competent authority of Arcadia Bank AG or Arcadia Bank Oesterreich AG, and any person appointed by such an authority, access to its premises, systems, records and personnel to the extent required in relation to the Services. Illustrative regulatory context, not legal advice.\n\n" +
      "Clause 2.5. Supervisory access, Arcadia Bank Schweiz AG. The Supplier shall give the Swiss Financial Market Supervisory Authority, and any audit firm appointed under Swiss law in respect of Arcadia Bank Schweiz AG, access to its premises, systems, records and personnel to the extent required in relation to the Services provided to Arcadia Bank Schweiz AG. The Supplier shall procure the equivalent right in respect of any subprocessor processing data of Arcadia Bank Schweiz AG, including any subprocessor located outside Switzerland. Illustrative regulatory context, not legal advice.\n\n" +
      "Clause 2.6. Records retention for audit purposes. The Supplier shall retain records evidencing the performance of the Services, including workflow and approval audit trails, for not less than five years. Where a record is held for a shorter period by reason of a technical retention setting, the Supplier shall notify the Bank of that setting.\n\n" +
      "Note recorded by Group Legal on ingestion. Clause 2.6 second sentence has not been operated. Arcadia held no record of the 30-day application log retention on the RepairDesk bulk approval screen before that retention was disclosed in response to an enquiry on 18.09.2026.",
    summary:
      "The audit and access appendix. Clause 2.1 gives Arcadia a right to configuration and rule set extracts within four hours for incident purposes, clause 2.5 secures Swiss supervisory and audit access including at offshore subprocessors, and clause 2.6 requires notification of short technical retention settings.",
    relatedObjectIds: [
      "CTR-2023-0117",
      "CTR-2023-0117-A4",
      "TP-0042",
      "UTC-TST-2026-0318-01",
      "SYS-0014",
      "REG-2026-0088",
      "P-016",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* Three years old, never tested, and it depends on a tool Arcadia has never
   * built. Staleness here is not a document freshness problem, it is a plan
   * that has never been confronted with reality. */
  {
    id: "EVD-2026-41435",
    runId: DEFAULT_RUN_ID,
    reference: "CTR-2023-0117-A6 v2.0",
    title: "Master Services Agreement appendix A6, exit and transition plan, version 2.0",
    titleDe: "Rahmenvertrag Anlage A6, Ausstiegs- und Uebergangsplan, Version 2.0",
    sourceType: "contract-clause",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Arcadia Bank AG and Novalink Payment Services GmbH, executed appendix",
    authorUserId: null,
    documentDate: "2023-09-01",
    ingestedAt: "2023-09-01T12:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: true,
    stalenessNote:
      "Dated 01.09.2023, being 1,131 days before the scenario day, and never tested. The plan has not been reviewed since execution, it predates the addition of two subprocessors and the engagement of a third-country service desk, and its central transition assumption at paragraph 4.2 relies on an Arcadia internal repair capability that does not exist. A plan of this age that has never been exercised cannot be relied upon as evidence of an executable exit.",
    provenance: "approved-record",
    body:
      "APPENDIX A6 TO MASTER SERVICES AGREEMENT CTR-2023-0117. Exit and transition plan. Version 2.0. Dated 01.09.2023.\n\n" +
      "Paragraph 1. Purpose. To set out the arrangements by which the Services may be transferred to the Bank or to a replacement supplier on expiry or termination of the Agreement, so that the Bank is able to continue the business activities the Services support.\n\n" +
      "Paragraph 2. Exit triggers. Expiry of the term. Termination for convenience on twelve months notice. Termination for cause on thirty days notice. A determination by the Bank that continued reliance on the Supplier is inconsistent with the Bank's obligations. A resolution or insolvency event affecting the Supplier.\n\n" +
      "Paragraph 3. Transition phases. Phase 1, planning, 0 to 3 months: joint transition plan, data inventory, format library inventory, replacement supplier selection by the Bank. Phase 2, build and parallel, 3 to 9 months: replacement integration, format library transfer, parallel running of validation and repair. Phase 3, cutover, 9 to 11 months. Phase 4, decommissioning and data return, 11 to 12 months.\n\n" +
      "Paragraph 4. Supplier obligations during transition. Paragraph 4.1: the Supplier shall continue to provide the Services on the existing terms throughout the transition period. Paragraph 4.2: the Supplier shall export the repair queue, the override audit trail and the format library in a documented interchange format, on the basis that the Bank will operate payment repair on its own internal tooling during the parallel and cutover phases. Paragraph 4.3: the Supplier shall provide reasonable assistance to a replacement supplier. Paragraph 4.4: the Supplier shall return or securely destroy Bank data on completion and shall certify which it has done.\n\n" +
      "Paragraph 5. Bank obligations during transition. The Bank shall nominate a transition manager, shall procure the replacement service, and shall provide the receiving environment.\n\n" +
      "Paragraph 6. Costs. Transition assistance within the scope of paragraph 4 is provided at the rates in Appendix A2. Assistance beyond that scope is chargeable on a time and materials basis.\n\n" +
      "Paragraph 7. Testing. This Appendix does not provide for testing of the transition arrangements. Neither party is obliged to exercise the plan.\n\n" +
      "Arcadia assessor note, recorded during the 2026 reassessment. Paragraph 4.2 assumes the Bank will operate payment repair on its own internal tooling. Arcadia holds no internal payment repair tool. The repair queue, override creation and four-eyes enforcement are functions of SYS-0014, which is the supplier system being exited. On the plan as drafted, the exit depends on a capability the Bank does not have, and paragraph 7 means nothing has ever tested that. This is recorded as a plan deficiency rather than a supplier failure: Arcadia executed this appendix.",
    summary:
      "The exit plan, executed in 2023 and never exercised. Paragraph 4.2 assumes Arcadia will run payment repair on its own internal tooling during transition, which Arcadia does not have, and paragraph 7 expressly obliges neither party to test the plan.",
    relatedObjectIds: [
      "CTR-2023-0117",
      "CTR-2023-0117-A6",
      "TP-0042",
      "SVC-0042-02",
      "SYS-0014",
      "MSN-2026-0177",
      "RSK-0184",
      "KRI-RES-005",
    ],
    pageCount: 8,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* ========================================================================
     5. GOVERNANCE EVIDENCE
     The RCSA record, the minutes where the disagreement is on the record,
     the committee decisions, and the remediation trail.
     ======================================================================== */

  {
    id: "EVD-2026-41200",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-ARC-DE-PAYOPS-2026-Q4 PRE",
    title:
      "RCSA Q4 2026 second line pre-read, Payment Operations ARC-DE, RSK-0211 rating proposal",
    titleDe:
      "RCSA Q4 2026 Vorlage der zweiten Verteidigungslinie, Zahlungsverkehr ARC-DE",
    sourceType: "rcsa-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Marlene Aigner, Operational Risk Partner",
    authorUserId: "P-003",
    documentDate: "2026-10-02",
    ingestedAt: "2026-10-02T16:20:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "SECOND LINE PRE-READ. Risk and Control Self Assessment / Risiko- und Kontrollselbstbewertung (RCSA) RCSA-ARC-DE-PAYOPS-2026-Q4. Scope: Payment Operations unit, Arcadia Bank AG, covering PRC-0041 and four adjacent processes. Issued 02.10.2026 ahead of the workshop on 06.10.2026, 10:30 to 12:00, Munich and video. Sign-off required by 16.10.2026.\n\n" +
      "1. Purpose of this pre-read. Eleven risks are in scope for the Q4 cycle. Ten are proposed for roll-forward without change. This pre-read addresses the one risk on which the second line proposes a change to the rating, RSK-0211 erroneous or unauthorised payment release / fehlerhafte oder unautorisierte Zahlungsfreigabe, so that the workshop can spend its time on the contested item.\n\n" +
      "2. The three positions side by side. Q3 2026, signed 08.07.2026: inherent impact 4, inherent likelihood 3, inherent score 12 of 25 High; control environment Effective; residual impact 3, residual likelihood 2, residual score 6 of 25 Medium-Low; within appetite; no consequence required. Q4 2026 first line position: inherent unchanged at 12 High; control environment Effective; residual impact 3, residual likelihood 3, residual score 9 of 25 Medium; within appetite; consequence monitoring. Q4 2026 second line proposal: inherent unchanged at 12 High; control environment Partially Effective; residual impact 4, residual likelihood 3, residual score 12 of 25 Medium-High; outside appetite; consequence a remediation plan with committed dates, or a documented Risk Acceptance / Risikoakzeptanz by the accountable executive.\n\n" +
      "3. The appetite boundary. The Group Operational Risk Policy sets the appetite boundary for payment execution risks at a residual score of 10. At 9 the risk is within appetite and requires monitoring. At 12 it is outside appetite and requires either an approved remediation plan with committed dates or a documented Risikoakzeptanz approved by the entity Chief Operating Officer and noted by the Group NFR Committee. The distance between the two positions is three points and the consequence of crossing the boundary is categorical.\n\n" +
      "4. First line argument for Medium, as recorded by the assessment owner. The four exceptions identified in TST-2026-0318 caused no financial loss. All four payments were subsequently confirmed correct by the clients. Two compensating controls operate, CTL-PAY-021 and CTL-PAY-029. The secondary reviewer vacancy is being recruited under MSN-2026-0166.\n\n" +
      "5. Second line argument for Medium-High. First, CTL-PAY-014 is the only preventive control on this risk and independent testing concluded it is Partially Effective. A residual rating built on an Effective control environment is not available on the evidence. Second, CTL-PAY-021 is detective, operates on the next business day and samples at 10 percent; it cannot prevent a release and is not designed to give assurance over the population. Third, CTL-PAY-029 reconciles value, not authorisation; its own description states that a correctly valued payment released to an incorrect beneficiary reconciles cleanly and is not detected. Fourth, the reviewer vacancy has no start date and two candidates have been rejected. Fifth, and in the second line's view decisively, two of the six flagged test items cannot be concluded at all, which means the true deviation rate is unknown rather than 6.67 percent; a likelihood assessment cannot be reduced on the strength of a rate that has not been established.\n\n" +
      "6. On the absence of loss. The first line argument rests substantially on the fact that no loss occurred. The second line position is that the absence of loss in a sample of 60 over three months is weak evidence about likelihood on a population of 1,204, and that an authorisation control exists to prevent unauthorised release rather than to prevent loss. The two are not the same thing and the risk statement is about the former.\n\n" +
      "7. What the workshop is being asked to do. Agree the control environment rating, agree the residual rating, and where agreement is not reached, record both positions with a formal second line dissent and refer the matter to CMT-NFR-2026-10 under agenda item AG-CMT-NFR-2026-10-03. The workshop is not being asked to agree that the second line is right. It is being asked to make the disagreement precise enough for the committee to decide.\n\n" +
      "8. Off-cycle reassessment trigger. The Group Operational Risk Policy section 4.7 requires an off-cycle reassessment where a key risk indicator moves into red status or where an independent test concludes that a key control is less than largely effective. Both conditions are met. This pre-read serves as the initiation of that reassessment.",
    summary:
      "The second line pre-read for the Q4 RCSA workshop, setting the two positions on RSK-0211 side by side and arguing that the residual rating moves from Medium to Medium-High, which crosses the appetite boundary.",
    relatedObjectIds: [
      "RCSA-ARC-DE-PAYOPS-2026-Q4",
      "RSK-0211",
      "CTL-PAY-014",
      "CTL-PAY-021",
      "CTL-PAY-029",
      "TST-2026-0318",
      "KRI-PAY-007",
      "MSN-2026-0166",
      "POL-ORP-4.7",
      "POL-ORP-5.2",
      "AG-CMT-NFR-2026-10-03",
    ],
    pageCount: 8,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* The signed position that everyone is arguing against. It matters that it
   * was signed on 08.07.2026, two months before the test reported. */
  {
    id: "EVD-2026-41202",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-ARC-DE-PAYOPS-2026-Q3 RSK-0211",
    title:
      "RCSA Q3 2026 signed assessment extract, RSK-0211 erroneous or unauthorised payment release",
    titleDe:
      "RCSA Q3 2026 unterzeichneter Auszug, RSK-0211 fehlerhafte oder unautorisierte Zahlungsfreigabe",
    sourceType: "rcsa-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Marlene Aigner, Operational Risk Partner, facilitator",
    authorUserId: "P-003",
    documentDate: "2026-07-08",
    ingestedAt: "2026-07-08T15:00:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "internal",
    status: "superseded",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "SIGNED ASSESSMENT EXTRACT. RCSA-ARC-DE-PAYOPS-2026-Q3. Risk RSK-0211. Signed 08.07.2026. Superseded by the Q4 2026 cycle, RCSA-ARC-DE-PAYOPS-2026-Q4. Retained as the signed position for the Q3 period.\n\n" +
      "Risk statement. Erroneous or unauthorised payment release. The risk that a payment instruction is released to clearing with incorrect data, or without the authorisation required by the control framework, resulting in funds being sent to an incorrect beneficiary, in an incorrect amount, or without a valid mandate.\n\n" +
      "Ratings as signed. Inherent impact 4. Inherent likelihood 3. Inherent score 12 of 25, High. Control environment rating Effective. Residual impact 3. Residual likelihood 2. Residual score 6 of 25, Medium-Low. Position versus appetite: within appetite. Required consequence: none.\n\n" +
      "Basis of the control environment rating as recorded. CTL-PAY-014 was assessed by the control owner as fully effective. No independent test of CTL-PAY-014 had been performed in the assessment period. The compensating controls CTL-PAY-021 and CTL-PAY-029 were assessed as operating. The Massnahme MSN-2026-0147 arising from AUD-2025-09 finding F3 was recorded as in progress with a revised due date of 31.07.2026 and was treated as a planned improvement rather than as an open weakness.\n\n" +
      "Indicators at the date of signing. KRI-PAY-007 manual override rate stood at 2.31 for June 2026, within green. KRI-PAY-003 payment repair rate stood at 2.11 percent, amber. KRI-PAY-011 reviewer capacity stood at 100 percent; position PR-SR-02 was occupied and the resignation notice had been given on 30.06.2026 but was not reflected in the June indicator.\n\n" +
      "Signatories. Assessment owner, first line: Andreas Kellner, Head of Payment Operations. Facilitator, second line: Marlene Aigner, Operational Risk Partner. Observer: Group Control Assurance.\n\n" +
      "Facilitator note recorded at signing. The control environment rating relies on a first line self-assessment of CTL-PAY-014 and on no independent testing. A combined design and operating effectiveness test of that control was scheduled for the third quarter. The facilitator recorded that the residual rating should be revisited on receipt of the test conclusion.\n\n" +
      "Pointer. Current cycle: RCSA-ARC-DE-PAYOPS-2026-Q4. The Q4 cycle proposes a residual score of 12 of 25.",
    summary:
      "The signed Q3 position on the payment release risk: control environment Effective, residual Medium-Low and within appetite, reached in July 2026 without any independent test of the control and with a facilitator note that it should be revisited once the test reported.",
    relatedObjectIds: [
      "RCSA-ARC-DE-PAYOPS-2026-Q4",
      "RSK-0211",
      "CTL-PAY-014",
      "CTL-PAY-021",
      "CTL-PAY-029",
      "MSN-2026-0147",
      "KRI-PAY-007",
      "KRI-PAY-011",
      "TST-2026-0318",
    ],
    pageCount: 3,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The live risk acceptance whose conditions the day's events show to be
   * unfulfilled. A conditional acceptance with an unmet condition and no
   * consequence is the governance equivalent of an unexploded finding.
   */
  {
    id: "EVD-2026-41204",
    runId: DEFAULT_RUN_ID,
    reference: "RSK-0184 RISIKOAKZEPTANZ",
    title:
      "Conditional Risk Acceptance for RSK-0184, loss or material degradation of a critical third-party payment service",
    titleDe:
      "Bedingte Risikoakzeptanz fuer RSK-0184, Ausfall oder wesentliche Beeintraechtigung einer kritischen Zahlungsdienstleistung",
    sourceType: "rcsa-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel:
      "Arcadia Bank AG Chief Operating Officer, recorded by Group Non-Financial Risk",
    authorUserId: "P-001",
    documentDate: "2026-01-19",
    ingestedAt: "2026-01-19T17:10:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "RISK ACCEPTANCE RECORD. Risk RSK-0184, loss or material degradation of a critical third-party payment service. Risk owner Andreas Kellner, with the risk view held by Group Third-Party Risk Management. Recorded 19.01.2026. Valid to 31.12.2026.\n\n" +
      "Position accepted. Residual score 12 of 25, Medium-High. The appetite boundary for this risk category is a residual score of 10. The position is therefore outside appetite and is held under a conditional Risk Acceptance / Risikoakzeptanz rather than remediated to within appetite.\n\n" +
      "Basis of the acceptance. TP-0042 Novalink Payment Services GmbH provides payment validation, payment repair tooling and Swiss clearing connectivity. The concentration is structural and cannot be removed within the acceptance period. The substitutability assessment of 30.06.2025 concludes that the arrangement is replaceable within 12 to 18 months at material programme cost. Replacing the arrangement inside the appetite boundary is therefore not available as a response in the current year, and the executive accepts the residual position for a defined period on stated conditions.\n\n" +
      "Condition 1. Completion of the 2026 annual reassessment of TP-0042, including resolution of any open resilience questions, by 31.10.2026. Owner: Group Third-Party Risk Management.\n\n" +
      "Condition 2. Performance of an exit and substitutability test for the payment repair workbench service, testing in particular the assumption that Arcadia can operate a payment repair queue during transition, by 31.12.2026. Owner: Group Third-Party Risk Management with the Head of Payment Operations.\n\n" +
      "Consequence if a condition is not met. The acceptance lapses and the position must be re-presented to the Group NFR Committee with either a remediation plan or a request for a further acceptance, in which case the committee must be told which condition was missed and why.\n\n" +
      "Approval. Approved by the Chief Operating Officer, Arcadia Bank AG, 19.01.2026. Noted by the Group NFR Committee 20.01.2026. Recorded by the NFR Portfolio Lead.\n\n" +
      "Status of the conditions as at 06.10.2026, recorded by Group Third-Party Risk Management. Condition 1: the reassessment is in progress with four unresolved resilience questions, eight missing artefacts and seven artefacts received but not accepted. Closure by 31.10.2026 on current evidence is not expected. Condition 2: Massnahme MSN-2026-0177 is not started and no plan exists. The condition will not be met.\n\n" +
      "Note by the NFR Portfolio Lead. The Group Third-Party Risk Policy section 5.4 provides that a condition without a consequence is not a condition. This acceptance has a stated consequence and it is approaching. The committee should be told before 31.12.2026 rather than after it.\n\n" +
      "Illustrative regulatory context, not legal advice.",
    summary:
      "The conditional risk acceptance covering the Novalink concentration, valid to 31.12.2026 on two conditions. One is in progress and unlikely to close on time; the other, an exit test, has not started and has no plan.",
    relatedObjectIds: [
      "RSK-0184",
      "TP-0042",
      "SVC-0042-02",
      "MSN-2026-0177",
      "AG-CMT-NFR-2026-10-04",
      "POL-TPR-5.4",
      "POL-ORP-5.2",
    ],
    pageCount: 3,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* The watch item that never became a Massnahme. Three months before the
   * breach, the workshop saw the trend and agreed to keep an eye on it. */
  {
    id: "EVD-2026-41250",
    runId: DEFAULT_RUN_ID,
    reference: "MIN-RCSA-2026-Q3",
    title:
      "Minutes of the RCSA Q3 2026 workshop, Payment Operations ARC-DE, 25.06.2026",
    titleDe:
      "Protokoll des RCSA-Workshops Q3 2026, Zahlungsverkehr ARC-DE, 25.06.2026",
    sourceType: "meeting-minutes",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Marlene Aigner, Operational Risk Partner, facilitator",
    authorUserId: "P-003",
    documentDate: "2026-06-25",
    ingestedAt: "2026-06-29T10:40:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "MINUTES. Risk and Control Self Assessment workshop, Q3 2026 cycle. Payment Operations, Arcadia Bank AG. 25.06.2026, 09:30 to 11:45, Munich and video. Facilitator: Operational Risk Partner, second line. Minutes approved 02.07.2026.\n\n" +
      "Present. Head of Payment Operations (assessment owner). Payment Repair Team Lead. Senior Payment Repair Analyst. Operational Risk Partner (facilitator). Four team leads. Group Control Assurance was invited and did not attend.\n\n" +
      "Item 1. Cycle scope and approach. Eleven risks in scope. The facilitator confirmed the approach of roll-forward for risks with no change in exposure and full discussion for risks where an indicator, a control test or an incident had moved.\n\n" +
      "Item 2. RSK-0211, erroneous or unauthorised payment release. The assessment owner proposed roll-forward at residual 6 of 25, Medium-Low. The Payment Repair Team Lead confirmed the control owner assessment of CTL-PAY-014 as fully effective. The facilitator noted that no independent test of CTL-PAY-014 had been performed in the period and that a combined test was scheduled for the third quarter, and asked that the rating be revisited on receipt of the conclusion. Agreed.\n\n" +
      "Item 3. Override volumes. The facilitator presented the override trend for the six months to 31.05.2026: 331, 358, 344, 389, 402 and 397 overrides per month for ARC-DE, against a twelve-month average override rate of 2.31 per 10,000 instructions. The facilitator observed that the trend was flat in rate terms but that the route substitution component had begun to move, rising from 18 in March to 29 in May. The Head of Payment Operations attributed this to two gateway latency events in the period and said the position would normalise.\n\n" +
      "Item 4. Agreed watch item. The workshop agreed that override volumes would be watched and that if the route substitution component continued to rise, the driver would be investigated with Group Third-Party Risk Management, on the basis that route substitution reflects primary route availability rather than repair quality. The facilitator asked whether this should be recorded as a Massnahme. The Head of Payment Operations said a Massnahme was disproportionate for a watch item and that it would be picked up in the monthly indicator review. Agreed, recorded as a workshop watch item.\n\n" +
      "Item 5. Reviewer capacity. The Payment Repair Team Lead advised that the holder of position PR-SR-02 had given notice on 30.06.2026 for a leaving date of 31.07.2026 and that recruitment would begin. No change to the assessment was proposed on this basis. The facilitator asked that the effect on reviewer coverage be brought to the Q4 workshop.\n\n" +
      "Items 6 to 9. Ten remaining risks rolled forward without change. No discussion recorded.\n\n" +
      "Item 10. Sign-off route. Assessment to be signed by 08.07.2026.\n\n" +
      "Actions. A1: bring the reviewer coverage position to the Q4 workshop, owner Payment Repair Team Lead. A2: revisit RSK-0211 on receipt of the CTL-PAY-014 test conclusion, owner facilitator.\n\n" +
      "Facilitator note added on review of these minutes on 02.10.2026. The watch item recorded at item 4 was not tracked in any system. It was not a Massnahme, it had no owner and no date, and it does not appear in the monthly indicator review for July, August or September. The route substitution component rose from 29 in May to 31 in August and to 198 in September.",
    summary:
      "Minutes of the June RCSA workshop. The facilitator flagged the rising route substitution component and asked whether it should be a Massnahme; the first line said that was disproportionate, and the agreed watch item was never tracked anywhere.",
    relatedObjectIds: [
      "RCSA-ARC-DE-PAYOPS-2026-Q4",
      "RSK-0211",
      "CTL-PAY-014",
      "KRI-PAY-007",
      "KRI-PAY-011",
      "TST-2026-0318",
      "MSN-2026-0166",
    ],
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * This is where the central disagreement is first stated by both people in
   * the same room, and where item 4 was closed as a configuration curiosity
   * with a documentation action. Forty-one days before the event.
   */
  {
    id: "EVD-2026-41255",
    runId: DEFAULT_RUN_ID,
    reference: "MIN-TST-2026-0318-CLEAR",
    title:
      "Minutes of the TST-2026-0318 findings clearance meeting, 24.09.2026",
    titleDe:
      "Protokoll der Abschlussbesprechung zu den Feststellungen TST-2026-0318, 24.09.2026",
    sourceType: "meeting-minutes",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Jakob Steinbacher, Control Assurance Specialist",
    authorUserId: "P-004",
    documentDate: "2026-09-24",
    ingestedAt: "2026-09-24T19:05:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "MINUTES. Findings clearance meeting for control test TST-2026-0318. 24.09.2026, 14:00 to 15:30, Munich and video. Minutes issued 24.09.2026 and not disputed.\n\n" +
      "Present. Control Assurance Specialist, Group Control Assurance (tester and chair). Head of Payment Operations (process owner). Payment Repair Team Lead (control owner). Operational Risk Partner (observer).\n\n" +
      "Purpose. To put the six flagged items to the first line before issue, to record the first line response on each, and to agree the actions arising.\n\n" +
      "Item 1, exception 01, self-review. The control owner accepted the fact and said the review had genuinely been performed by a qualified analyst. She said the defect is that RepairDesk permits one identity to hold both role assignments, and that this is the subject of MSN-2026-0147. The tester noted that the Massnahme was 55 days past its revised due date at the date of the meeting and that the exception occurred 17 days before that due date. The process owner said the dependency is a supplier change request in pre-production and that Arcadia user acceptance testing is blocked by a change freeze to 14.10.2026. Agreed as an operating deficiency with a design contributor.\n\n" +
      "Item 2, exception 02, review after release. The control owner said the release was made to meet a cut-off and the review followed within twelve minutes. The tester said a preventive control that operates after the event is not preventive and that the record shows the system did not block release. The control owner said the team would not have released if the payment had looked wrong. The tester recorded that the control objective is authorisation before release and that a subsequent review does not satisfy it. Agreed as an operating deficiency. The control owner asked that the minutes record that the payment was correct.\n\n" +
      "Item 3, exception 03, no evidence reference. The control owner said the rule defect was known across the team and no document existed that could have been attached. The tester said the requirement is documented evidence of the basis for approval and that a known defect can be evidenced by a note. The control owner said the field is optional in the system. Agreed as an operating deficiency with a design contributor, being the nullable evidence reference field.\n\n" +
      "Item 4, exception 04, no review record and a waiver code. The tester presented the record: secondaryReviewRequired false, no review record, reviewWaiverCode BCP-THROUGHPUT, and a rule evaluation trace naming RD-RULE-0031, with the fallback route mode active on the queue for 1 hour and 43 minutes that afternoon. The control owner said she had never seen that waiver code and did not know what the rule was. The process owner said it looked like a RepairDesk configuration item and that Technology or the supplier would have to explain it. The tester confirmed he had requested the rule set from Novalink on 11.09.2026 and 17.09.2026 without response. The meeting discussed whether to hold the report until the rule set arrived. The process owner said the report should issue and the rule should be picked up separately because it was a single low-value item. The tester agreed to record the root cause as system configuration and to raise a documentation action against the control description. No Massnahme was raised against the rule itself. Agreed on that basis.\n\n" +
      "Item 5, unable to conclude 01, service account reviewer. The control owner said the review had been submitted through the bulk approval screen by a member of her team and that RepairDesk backfills the reviewer identity at the end of the batch cycle. The tester said Novalink's written response of 18.09.2026 states that the identity is held in a separate application log with 30-day retention and does not describe a backfill. The control owner said that was her understanding of how the screen works. The tester recorded the item as unable to conclude and recorded the control owner's statement as the control owner's statement. Not agreed.\n\n" +
      "Item 6, unable to conclude 02, broken evidence link. Agreed as a supplier evidence retention matter. Novalink to restore by 10.10.2026.\n\n" +
      "Item 7, conclusion. The tester stated the conclusion would be Partially Effective with a design deficiency and an operating deficiency. The control owner said she did not accept that conclusion and would record Fully Effective in her own assessment, on the basis that no payment had gone out unauthorised and no loss had arisen. The chair recorded that the divergence would be reported to the NFR Committee. The observer noted that under the Group Operational Risk Policy section 4.3 the first line rating cannot remain at fully effective without a documented second line basis for treating the exceptions as immaterial, and that no such basis would be recorded.\n\n" +
      "Actions. A1: issue the report 25.09.2026, owner tester. A2: raise a documentation action against the CTL-PAY-014 description to document system-enforced review conditions, owner control owner, low priority, due 30.10.2026. A3: continue to pursue the RepairDesk rule set through Group Third-Party Risk Management, owner tester, no date recorded. A4: refer the effectiveness divergence to CMT-NFR-2026-10, owner tester with the Operational Risk Partner.",
    summary:
      "The clearance meeting minutes. Item 4 records that nobody in the room knew what RD-RULE-0031 was, that the report issued anyway with the root cause recorded as system configuration, and that the only action raised was a low-priority documentation update.",
    relatedObjectIds: [
      "TST-2026-0318",
      "CTL-PAY-014",
      "EXC-TST-2026-0318-01",
      "EXC-TST-2026-0318-02",
      "EXC-TST-2026-0318-03",
      "EXC-TST-2026-0318-04",
      "UTC-TST-2026-0318-01",
      "UTC-TST-2026-0318-02",
      "RD-RULE-0031",
      "MSN-2026-0147",
      "MSN-2026-0203",
      "POL-ORP-4.3",
      "POL-IKS-4.5",
    ],
    pageCount: 6,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* The service review at which none of this came up. Useful because it dates
   * the supplier's portal-notice position to before the incident, and shows
   * that September availability was never tabled. */
  {
    id: "EVD-2026-41260",
    runId: DEFAULT_RUN_ID,
    reference: "MIN-NOVALINK-QSR-2026-Q3",
    title:
      "Minutes of the Novalink quarterly service review, third quarter 2026, 10.09.2026",
    titleDe:
      "Protokoll der vierteljaehrlichen Dienstleisterbesprechung Novalink, Q3 2026",
    sourceType: "meeting-minutes",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Lukas Wiesinger, Category Lead, Payments Technology, Group Procurement",
    authorUserId: "P-010",
    documentDate: "2026-09-10",
    ingestedAt: "2026-09-12T08:50:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "MINUTES. Novalink Payment Services GmbH quarterly service review, third quarter 2026. 10.09.2026, 11:00 to 12:30, Frankfurt am Main and video.\n\n" +
      "Present. For Arcadia: Category Lead Payments Technology (chair), Third-Party Risk Manager, Head of Payment Operations. For Novalink: Client Service Director, Head of Service Continuity.\n\n" +
      "Item 1. Service performance. The Client Service Director presented availability for June, July and August 2026 as within target for all services. The August figure for the payment validation and clearing gateway was reported as 99.91 percent. September to date was not presented; the Client Service Director said the month was not complete and that the September report would follow in the normal cycle. The Head of Payment Operations noted that the Munich team had operated on the fallback clearing route on four occasions since the start of September and asked whether that reflected a gateway problem. The Client Service Director said she would check with engineering and revert. No revert is recorded.\n\n" +
      "Item 2. Change and release pipeline. Novalink confirmed that change request NOVA-CR-4412, role segregation enforcement in the payment repair workbench, was in build with delivery to Arcadia pre-production expected in the second half of September. The Head of Payment Operations noted that Arcadia user acceptance testing would be needed and that the payment test environment was subject to a change freeze. Action: Novalink to confirm the delivery date; Arcadia to confirm a test window.\n\n" +
      "Item 3. Outstanding evidence requests. The Third-Party Risk Manager raised the outstanding request for the payment repair workbench rule set governing the derivation of the secondary review requirement, made on 11.09.2026 in the control assurance workstream. The Client Service Director asked for the request to be routed through the reassessment questionnaire rather than directly, to keep requests in one place. Action: Third-Party Risk Manager to re-route. Note recorded by the Third-Party Risk Manager: the request was made under the audit and access right at Appendix A4 clause 2.1, which carries a four-hour turnaround for incident purposes and five business days otherwise, and re-routing it through the questionnaire does not change that entitlement.\n\n" +
      "Item 4. Subprocessor register. The Third-Party Risk Manager asked whether any subprocessor changes had occurred in 2026. The Client Service Director said the register on the Novalink client portal is kept current and that Arcadia can consult it at any time. Asked directly whether Arcadia had been notified of any change, she said Novalink treats publication of the register as notice to clients and that this has been Novalink's practice since the portal was introduced. The Third-Party Risk Manager said Arcadia would check the position against the contract. Action: Arcadia to review; Novalink to provide the current register version.\n\n" +
      "Item 5. Reassessment. Novalink confirmed the 2026 questionnaire had been received and that responses would be submitted by the end of September. The Head of Service Continuity noted that the disaster recovery evidence had already been provided in May.\n\n" +
      "Item 6. Any other business. None.\n\n" +
      "Next review. First half of December 2026, date to be confirmed.",
    summary:
      "The September service review minutes. Availability for September was not tabled, the four fallback events were queried and never answered, and the supplier stated on the record that it treats publishing its register on the client portal as notice.",
    relatedObjectIds: [
      "TP-0042",
      "SVC-0042-01",
      "SVC-0042-02",
      "NOVA-CR-4412",
      "MSN-2026-0147",
      "CTR-2023-0117-A3",
      "CTR-2023-0117-A4",
      "RD-RULE-0031",
      "P-010",
      "P-011",
      "P-012",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* The extension was granted on a condition that the committee has not yet
   * been reminded of. That is the decision the 67 days now walks into. */
  {
    id: "EVD-2026-41270",
    runId: DEFAULT_RUN_ID,
    reference: "CMT-NFR-2026-04 item 5",
    title:
      "Committee minute extract, NFR Committee 14.04.2026, extension of MSN-2026-0147",
    titleDe:
      "Auszug aus dem Gremienprotokoll, NFR-Komitee 14.04.2026, Fristverlaengerung MSN-2026-0147",
    sourceType: "committee-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Katharina Vogt, NFR Portfolio Lead, committee secretary",
    authorUserId: "P-001",
    documentDate: "2026-04-14",
    ingestedAt: "2026-04-16T09:20:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "COMMITTEE MINUTE EXTRACT. Group Non-Financial Risk Committee. Meeting of 14.04.2026. Item 5, overdue remediation actions. Extract limited to the portion concerning MSN-2026-0147. Minutes approved 12.05.2026.\n\n" +
      "Chair: Group Chief Operating Officer. Present: Group Chief Risk Officer, Group Chief Financial Officer, Group Chief Information Officer, entity Chief Operating Officers for the German, Austrian and Swiss entities, Group Chief Compliance Officer. Standing attendees: NFR Portfolio Lead as secretary, Head of Group Internal Audit as observer.\n\n" +
      "Item presented. The NFR Portfolio Lead presented three actions past their due dates, of which MSN-2026-0147, implement role segregation enforcement in the payment repair workbench so that an override creator cannot be recorded as the secondary reviewer, arising from internal audit finding AUD-2025-09-F3, due 31.03.2026 and 14 days overdue. Accountable owner: Head of Payment Operations.\n\n" +
      "Request. An extension of the due date to 31.07.2026 on the grounds that delivery depends on a supplier change request, NOVA-CR-4412, which the supplier had scheduled for its third-quarter release.\n\n" +
      "Discussion. The Group Chief Risk Officer asked what the exposure is while the action is open. The Head of Group Internal Audit responded that the exposure is that an override can be created and self-approved by one person, that 11 of 34 payment repair staff hold both role assignments, and that management had declined the interim mitigation of removing dual assignments on the grounds of reviewer coverage. The entity Chief Operating Officer for the German entity asked whether the interim exposure could be mitigated by monitoring. The NFR Portfolio Lead responded that the next-business-day sampling control operates at 10 percent and would detect a pattern rather than an instance. The chair asked whether the supplier date was firm. The NFR Portfolio Lead responded that it was the supplier's plan and not a contractual commitment.\n\n" +
      "Decision. The committee approved one extension of MSN-2026-0147 to 31.07.2026. The committee recorded that no further extension would be granted without the matter being noted to the entity board of Arcadia Bank AG with a root-cause explanation of the delay, and asked that any slippage be reported at the meeting following the revised date rather than held to the quarterly cycle.\n\n" +
      "Chair's comment, minuted at the chair's request. An action arising from a high-rated audit finding on an authorisation control in a payment process should not require a second extension. If the supplier dependency cannot be managed, the committee would prefer to see the interim mitigation reconsidered.\n\n" +
      "Secretary's note added 05.10.2026. The revised date of 31.07.2026 was missed. As at 06.10.2026 the action is 67 days past the revised date. The condition attached to the extension has not been operated: no note has been made to the entity board of Arcadia Bank AG and no slippage report was tabled at the meetings of 12.05.2026, 09.06.2026, 14.07.2026 or 08.09.2026. The item returns to the committee at AG-CMT-NFR-2026-10-05.",
    summary:
      "The minute granting the single extension of MSN-2026-0147 to 31.07.2026, on an express condition that a further extension would require a note to the entity board. The date was missed by 67 days and the condition has not been operated.",
    relatedObjectIds: [
      "MSN-2026-0147",
      "AUD-2025-09",
      "CTL-PAY-014",
      "NOVA-CR-4412",
      "CTL-PAY-021",
      "KRI-GOV-001",
      "AG-CMT-NFR-2026-10-05",
      "POL-GOV-6.1",
    ],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41275",
    runId: DEFAULT_RUN_ID,
    reference: "CMT-NFR-2026-10 NOTICE",
    title:
      "Notice of meeting and draft agenda, Group NFR Committee CMT-NFR-2026-10, 13.10.2026",
    titleDe:
      "Einladung und Entwurf der Tagesordnung, Gruppenkomitee fuer nichtfinanzielle Risiken, 13.10.2026",
    sourceType: "committee-extract",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Katharina Vogt, NFR Portfolio Lead, committee secretary",
    authorUserId: "P-001",
    documentDate: "2026-09-04",
    ingestedAt: "2026-09-04T13:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "NOTICE OF MEETING. Group Non-Financial Risk Committee / Gruppenkomitee fuer nichtfinanzielle Risiken. Meeting reference CMT-NFR-2026-10. Tuesday 13.10.2026, 14:00 to 16:30 CET. Frankfurt am Main and video. Issued 04.09.2026.\n\n" +
      "Chair. Group Chief Operating Officer.\n\n" +
      "Members. Group Chief Risk Officer, Group Chief Financial Officer, Group Chief Information Officer, entity Chief Operating Officers for Arcadia Bank AG, Arcadia Bank Oesterreich AG and Arcadia Bank Schweiz AG, Group Chief Compliance Officer.\n\n" +
      "Standing attendees. NFR Portfolio Lead as secretary and portfolio lead. Head of Group Internal Audit as observer.\n\n" +
      "Quorum. The chair plus three members. For any entity-specific decision, the quorum must include the Chief Operating Officer of the entity concerned.\n\n" +
      "Papers deadline. Thursday 08.10.2026 at 12:00 CET. Papers received after that time are tabled for information only and cannot carry a decision. This is applied without exception, because a member cannot be asked to decide on a paper they have not read.\n\n" +
      "Draft agenda.\n\n" +
      "AG-CMT-NFR-2026-10-01. Minutes and open actions. For noting. Secretary.\n\n" +
      "AG-CMT-NFR-2026-10-02. Group NFR dashboard, third quarter 2026. For noting. Secretary. Covers all key risk indicators.\n\n" +
      "AG-CMT-NFR-2026-10-03. The KRI-PAY-007 breach and the divergence between the first and second lines on control CTL-PAY-014. For decision. Operational Risk Partner and Control Assurance Specialist.\n\n" +
      "AG-CMT-NFR-2026-10-04. Novalink reassessment interim status and the subprocessor appendix divergence. For decision. Third-Party Risk Manager.\n\n" +
      "AG-CMT-NFR-2026-10-05. Overdue remediation actions, including MSN-2026-0147. For decision. Secretary.\n\n" +
      "AG-CMT-NFR-2026-10-06. Register of information readiness for Arcadia Bank AG and Arcadia Bank Oesterreich AG. For noting. Regulatory Change Manager. Illustrative regulatory context, not legal advice.\n\n" +
      "AG-CMT-NFR-2026-10-07. Arcadia Bank Schweiz AG outsourcing inventory update and FINMA context. For noting. Regulatory Change Manager with the Resilience Officer, Arcadia Bank Schweiz AG. Illustrative regulatory context, not legal advice.\n\n" +
      "AG-CMT-NFR-2026-10-08. Impact tolerance review for IBS-0004 Corporate Payments. For decision. Incident and Resilience Lead.\n\n" +
      "AG-CMT-NFR-2026-10-09. Any other business. Chair.\n\n" +
      "Secretary's note on agenda construction. Items 03, 04, 05 and 08 all concern the same important business service. They are presented as four items because they arise from four different functions and carry four different decisions. The secretary has proposed on three previous occasions that they be presented as one item with four decisions and the proposal has not been adopted.\n\n" +
      "Note on the committee's authority. The Group committee cannot overrule an entity board. It may require an entity to take a decision and to record it.",
    summary:
      "The notice and draft agenda for the committee on 13.10.2026, with the hard papers deadline of 08.10.2026 at 12:00 and a secretary's note that four separate agenda items all concern the same business service.",
    relatedObjectIds: [
      "CMT-NFR-2026-10",
      "AG-CMT-NFR-2026-10-01",
      "AG-CMT-NFR-2026-10-02",
      "AG-CMT-NFR-2026-10-03",
      "AG-CMT-NFR-2026-10-04",
      "AG-CMT-NFR-2026-10-05",
      "AG-CMT-NFR-2026-10-06",
      "AG-CMT-NFR-2026-10-07",
      "AG-CMT-NFR-2026-10-08",
      "POL-GOV-6.1",
    ],
    pageCount: 3,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41280",
    runId: DEFAULT_RUN_ID,
    reference: "MSN-2026-0147 UPD-09",
    title: "Remediation action update, MSN-2026-0147, position as at 30.09.2026",
    titleDe: "Statusbericht Massnahme MSN-2026-0147, Stand 30.09.2026",
    sourceType: "remediation-update",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Beatrix Hofmann, Payment Repair Team Lead, action delegate",
    authorUserId: "P-008",
    documentDate: "2026-09-30",
    ingestedAt: "2026-09-30T16:55:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "REMEDIATION ACTION UPDATE. Massnahme MSN-2026-0147. Implement role segregation enforcement in RepairDesk so that an override creator cannot be recorded as the secondary reviewer / Durchsetzung der Funktionstrennung in RepairDesk. Update recorded by the action delegate on 30.09.2026.\n\n" +
      "Source. Internal audit report AUD-2025-09, finding F3, issued 28.11.2025. Accountable owner: Head of Payment Operations. Delegate: Payment Repair Team Lead. Original due date 31.03.2026. Revised due date 31.07.2026, one extension approved by the NFR Committee on 14.04.2026.\n\n" +
      "Progress. 60 percent. Status: in progress. Days past the revised due date at the date of this update: 61.\n\n" +
      "Activity since the last update of 31.08.2026. Change request NOVA-CR-4412 was delivered by Novalink to the Arcadia pre-production environment on 18.09.2026. The delivery note is filed as EVD-2026-41102. Functional review of the delivery documentation was completed by the payment repair team on 23.09.2026 and the change appears to meet the requirement, namely that the identity recorded as secondary reviewer cannot equal the identity recorded as override creator.\n\n" +
      "Blocking item. Arcadia user acceptance testing has not been scheduled. The payments user acceptance test environment requires a data refresh before it can be used for this change, and the refresh is blocked by an unrelated infrastructure change freeze which is in place until 14.10.2026. A scheduling request was raised with Payments Test Environment Management on 22.09.2026 and is filed as EVD-2026-41205. No response has been received.\n\n" +
      "Revised date proposed. None. The delegate is not able to propose a date because the earliest possible test window depends on the environment refresh, which depends on the lifting of the change freeze on 14.10.2026, after which a refresh takes an estimated five business days.\n\n" +
      "Interim mitigation. None beyond the existing arrangement. Dual role assignments remain in place for three Repair Analysts, because removing them would reduce reviewer coverage below the level needed to meet the afternoon cut-off window at the current staffing of 3.0 of 4.0 approved full-time equivalent.\n\n" +
      "Delegate comment. The delay is not within the team's control. The supplier has delivered. The test environment is not available. The team has kept the control operating in the meantime.\n\n" +
      "Second line note added 02.10.2026. Exception EXC-TST-2026-0318-01 of 14.07.2026 is the failure this action was raised to prevent, and it occurred 17 days before the revised due date. The action has now been open for 306 days from the issue of the audit finding. The escalation rule for an action more than 60 days past a revised due date is engaged: the action is reported to the NFR Committee with a named accountable executive and a recommendation either to re-baseline with a root-cause explanation or to escalate to the entity board.",
    summary:
      "The last pre-event status update on the overdue segregation of duties action. The supplier change is delivered, Arcadia testing is blocked by an unrelated change freeze until 14.10.2026, no revised date is proposed and there is no interim mitigation.",
    relatedObjectIds: [
      "MSN-2026-0147",
      "AUD-2025-09",
      "CTL-PAY-014",
      "NOVA-CR-4412",
      "EXC-TST-2026-0318-01",
      "KRI-GOV-001",
      "KRI-PAY-011",
      "AG-CMT-NFR-2026-10-05",
    ],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The last line of this delivery note is the one that matters: the change
   * fixes independence and expressly does not touch the rule that decides
   * whether a review is required at all. Nobody read it that way in
   * September.
   */
  {
    id: "EVD-2026-41102",
    runId: DEFAULT_RUN_ID,
    reference: "NOVA-CR-4412 DELIVERY",
    title:
      "Novalink delivery note for change request NOVA-CR-4412, role segregation enforcement in RepairDesk",
    titleDe:
      "Novalink Liefernachweis zur Aenderungsanforderung NOVA-CR-4412, Funktionstrennung in RepairDesk",
    sourceType: "remediation-update",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Novalink Payment Services GmbH, Release Management",
    authorUserId: null,
    documentDate: "2026-09-18",
    ingestedAt: "2026-09-18T15:40:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "DELIVERY NOTE. Novalink Payment Services GmbH, Release Management. Change request NOVA-CR-4412. Client: Arcadia Bank AG. Tenant: arcadia-preprod. Delivered 18.09.2026.\n\n" +
      "Change requested by the client. Prevent the identity recorded as the creator of a manual override from being recorded as the secondary reviewer of the same override.\n\n" +
      "What has been delivered. A validation has been added to the review submission path in RepairDesk. Where the identity submitting a secondary review equals the identity recorded in the createdBy field of the override record, the submission is rejected with a new error condition and the review is not written. The validation applies to the single-item review screen and to the bulk approval screen. A new audit event is written on rejection, recording the override identifier, the rejected reviewer identity and the timestamp.\n\n" +
      "Role model. The change does not alter the RepairDesk role model. A user identity may continue to hold both the Repair Analyst and the Secondary Reviewer role assignment. The change prevents the same identity from acting on both sides of the same override, rather than preventing the dual assignment.\n\n" +
      "Scope statement. The change applies to the review submission path only. It does not alter the derivation of the secondaryReviewRequired field. Where rule evaluation on the OVERRIDE_PROPOSED transition determines that secondary review is not required, no review is submitted, and this validation is not reached.\n\n" +
      "Client action required. Arcadia to perform user acceptance testing in arcadia-preprod and to confirm acceptance. On acceptance Novalink will schedule promotion to arcadia-prod in the next available release window. Novalink requests a test completion date.\n\n" +
      "Release dependencies. None. The change is independent of the RepairDesk release schedule and can be promoted as a configuration-level update.\n\n" +
      "Support contact. Novalink Release Management, reference NOVA-CR-4412.\n\n" +
      "Arcadia ingestion note 18.09.2026. Filed against MSN-2026-0147. Functional review completed 23.09.2026, delivery assessed as meeting the requirement. User acceptance testing not scheduled.",
    summary:
      "The supplier's delivery note for the segregation of duties fix. It states plainly that the change does not alter how the system decides whether a secondary review is required at all, only who may submit one.",
    relatedObjectIds: [
      "MSN-2026-0147",
      "NOVA-CR-4412",
      "CTL-PAY-014",
      "SYS-0014",
      "RD-RULE-0031",
      "TP-0042",
      "EXC-TST-2026-0318-01",
    ],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41205",
    runId: DEFAULT_RUN_ID,
    reference: "UAT-REQ-2026-0914",
    title:
      "User acceptance test scheduling request for NOVA-CR-4412, unanswered",
    titleDe:
      "Terminanfrage fuer den Abnahmetest zu NOVA-CR-4412, unbeantwortet",
    sourceType: "remediation-update",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Arcadia Bank AG Technology, Payments Test Environment Management request queue",
    authorUserId: null,
    documentDate: "2026-09-22",
    ingestedAt: "2026-09-22T11:15:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "TEST ENVIRONMENT SCHEDULING REQUEST. Reference UAT-REQ-2026-0914. Raised 22.09.2026 by Payment Operations against the Payments Test Environment Management queue. Status as at 06.10.2026 07:00: open, unassigned, no response recorded.\n\n" +
      "Request. A user acceptance test window in the payments pre-production environment for change NOVA-CR-4412, role segregation enforcement in RepairDesk. Estimated duration two business days. Requested window: any window between 29.09.2026 and 10.10.2026. Test data requirement: a refreshed copy of production reference data for the payment repair queue, including role assignments for at least three test identities holding both the Repair Analyst and Secondary Reviewer roles.\n\n" +
      "Justification given in the request. The change is the delivery item for Massnahme MSN-2026-0147, which arises from internal audit finding AUD-2025-09-F3 and is past its revised due date. The Massnahme cannot be closed until the change is accepted and promoted to production.\n\n" +
      "Known constraint stated in the request. The environment requires a data refresh before it can support this test. An infrastructure change freeze is in place until 14.10.2026 and the requester understands that the refresh may fall within the freeze. The request asks for either a window, or a statement that no window is available before 14.10.2026 so that the Massnahme owner can record a revised date.\n\n" +
      "Response history. None. No acknowledgement, no assignment and no rejection. The queue service level for acknowledgement is two business days. Ten business days have elapsed.\n\n" +
      "Why this document is in the evidence corpus. The absence of a response is the current blocking item on an overdue remediation action arising from a high-rated audit finding on an authorisation control. The request is evidence that the action owner asked, and it is the document that establishes the delay does not sit with the payment repair team or with the supplier.",
    summary:
      "The unanswered internal request for a test window. It asked either for a slot or for confirmation that none exists before 14.10.2026, and ten business days later it has not been acknowledged.",
    relatedObjectIds: [
      "MSN-2026-0147",
      "NOVA-CR-4412",
      "AUD-2025-09",
      "CTL-PAY-014",
      "SYS-0014",
    ],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41285",
    runId: DEFAULT_RUN_ID,
    reference: "MSN-2026-0166 UPD-09",
    title:
      "Remediation action update, MSN-2026-0166, recruitment to secondary reviewer position PR-SR-02",
    titleDe:
      "Statusbericht Massnahme MSN-2026-0166, Besetzung der Zweitprueferstelle PR-SR-02",
    sourceType: "remediation-update",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Andreas Kellner, Head of Payment Operations",
    authorUserId: "P-007",
    documentDate: "2026-09-30",
    ingestedAt: "2026-09-30T17:20:00.000Z",
    entityIds: [ENTITY_DE],
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "REMEDIATION ACTION UPDATE. Massnahme MSN-2026-0166. Recruit to secondary reviewer position PR-SR-02. Update recorded by the accountable owner on 30.09.2026. Due date 30.09.2026. Status: overdue as at the date of this update.\n\n" +
      "Background. Position PR-SR-02 became vacant on 31.07.2026 following the resignation of its holder, who gave notice on 30.06.2026. The position is one of four senior secondary reviewer positions in the Munich payment repair hub. Filled capacity is 3.0 of 4.0 approved full-time equivalent, being 75.0 percent, against a red indicator threshold of below 85 percent on KRI-PAY-011.\n\n" +
      "Progress. Recruitment was approved on 12.08.2026. The role profile requires three years of payment repair experience, authority to approve overrides of any value, and demonstrated judgement on override decisions under time pressure. The profile was published internally on 17.08.2026 and externally on 24.08.2026.\n\n" +
      "Candidates. Four applications received. Two candidates were taken to second interview. Both were rejected at second interview on the assessment of override judgement, being the case-based exercise in which a candidate is asked to decide whether to release, repair or return a set of five instructions under a cut-off. Neither candidate was assessed as able to hold the reviewer authority unsupervised.\n\n" +
      "Position. No offer has been made. No start date exists. The owner is not able to give a date because the search is open.\n\n" +
      "Owner comment. The position will be filled in the fourth quarter. The team is managing with a rota change and authorised overtime. The alternative of lowering the role requirement in order to fill the seat faster would put an unqualified reviewer into the authorisation path, which is worse than the vacancy.\n\n" +
      "Second line note added 02.10.2026. The owner's judgement on not lowering the requirement is accepted. The consequence is that the reviewer capacity indicator will remain red and that the mitigation for the vacancy is the dual role assignment which is itself the subject of MSN-2026-0147. The two actions are therefore in tension and neither can be closed independently of the other. This should be stated to the committee in those terms.",
    summary:
      "The recruitment status for the vacant reviewer position. Two candidates were rejected on override judgement, no start date exists, and the interim mitigation is the same dual role assignment that another overdue action is trying to remove.",
    relatedObjectIds: [
      "MSN-2026-0166",
      "MSN-2026-0147",
      "KRI-PAY-011",
      "CTL-PAY-014",
      "PRC-0041",
      "P-018",
      "AG-CMT-NFR-2026-10-05",
    ],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The paperwork of the unexploded finding. A low priority documentation
   * item with a rationale recorded in one sentence, raised 11 days before the
   * event and not started. After 15:38 on 06.10.2026 it is no longer a
   * documentation item.
   */
  {
    id: "EVD-2026-41290",
    runId: DEFAULT_RUN_ID,
    reference: "MSN-2026-0203 RAISE",
    title:
      "Remediation action raising note, MSN-2026-0203, document system-enforced review conditions in CTL-PAY-014",
    titleDe:
      "Erfassungsnotiz Massnahme MSN-2026-0203, Dokumentation systemseitiger Pruefbedingungen in CTL-PAY-014",
    sourceType: "remediation-update",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Jakob Steinbacher, Control Assurance Specialist",
    authorUserId: "P-004",
    documentDate: "2026-09-25",
    ingestedAt: "2026-09-25T15:30:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "REMEDIATION ACTION RAISING NOTE. Massnahme MSN-2026-0203. Raised 25.09.2026 on issue of control test report TST-2026-0318.\n\n" +
      "Title. Update the CTL-PAY-014 control description to document all system-enforced review conditions, including any waiver rules configured in RepairDesk.\n\n" +
      "Source. Exception EXC-TST-2026-0318-04, being the sampled override of 27.08.2026 on which no secondary review record exists, the secondaryReviewRequired field is false, and the rule evaluation trace records rule RD-RULE-0031 firing with a review waiver code of BCP-THROUGHPUT while the fallback route mode was active.\n\n" +
      "Owner. Payment Repair Team Lead, as control owner. Due date 30.10.2026. Status: not started.\n\n" +
      "Priority assigned. Low.\n\n" +
      "Priority rationale recorded verbatim at raising. Documentation alignment only; no operational impact identified. Single low-value item in the sample. The rule set itself sits in the supplier system and the operational question is being pursued separately with the supplier.\n\n" +
      "What the action requires. Obtain the rule set governing the derivation of the secondaryReviewRequired field in RepairDesk, and amend the CTL-PAY-014 description so that it states every condition under which the control does not operate, as required by the Group Internal Control System Standard section 2.6.\n\n" +
      "What the action does not require. It does not require the rule to be changed, removed or re-scoped. It does not require an assessment of how often the rule has fired. It does not require the population of prior fallback operating periods to be examined. No separate Massnahme was raised against the rule.\n\n" +
      "Dependency. Delivery depends on obtaining the rule set from Novalink. Requests were made on 11.09.2026 and 17.09.2026 without response and the action carries no date for that dependency.\n\n" +
      "Note added by the second line on 06.10.2026 at 15:52. The priority rationale recorded above is wrong on the facts now available. The rule has fired 118 times since 11.11.2024. It is not a documentation matter and it never was. This action is re-prioritised and re-scoped to depend on the removal or re-scoping of the rule under MSN-2026-0215. The rationale is left on the record unaltered, because the question the committee will ask is how this was classified as low priority on 25.09.2026, and the answer has to be visible.",
    summary:
      "The raising note for the low-priority documentation action arising from the fourth test exception. Its recorded rationale states that no operational impact was identified, and no action was raised against the rule itself.",
    relatedObjectIds: [
      "MSN-2026-0203",
      "MSN-2026-0215",
      "EXC-TST-2026-0318-04",
      "TST-2026-0318",
      "CTL-PAY-014",
      "RD-RULE-0031",
      "POL-IKS-4.5",
      "SYS-0014",
    ],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* ========================================================================
     6. POLICY EVIDENCE
     The internal requirements against which everything above is measured.
     These are the sections the assistant cites when it says a position is
     not available on the evidence.
     ======================================================================== */

  {
    id: "EVD-2026-41600",
    runId: DEFAULT_RUN_ID,
    reference: "POL-ORP v6.2",
    title:
      "Group Operational Risk Policy version 6.2, extract of sections 4.3, 4.7 and 5.2",
    titleDe:
      "Konzernrichtlinie Operationelles Risiko Version 6.2, Auszug der Abschnitte 4.3, 4.7 und 5.2",
    sourceType: "policy",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Katharina Vogt, NFR Portfolio Lead, policy owner",
    authorUserId: "P-001",
    documentDate: "2026-01-01",
    ingestedAt: "2026-01-01T00:05:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "GROUP OPERATIONAL RISK POLICY. Version 6.2. Effective 01.01.2026. Next review due 31.12.2026. Local adoption required by each legal entity with any deviation recorded in the entity deviation register. Extract of three sections.\n\n" +
      "Section 4.3, control effectiveness assessment. A control may be assessed as fully effective only where independent testing in the current assessment period supports that conclusion, or where no independent testing was required and the first line assessment is supported by documented evidence of operation. Where independent testing has identified exceptions, the first line assessment may not remain at fully effective unless the second line records a documented basis for treating the exceptions as immaterial to the control objective. The basis must address the number of exceptions, their nature, and whether the exceptions share a cause. A disagreement between the lines on a control effectiveness rating is recorded with both positions stated and is resolved by the committee to which the control reports, not by the more senior of the two assessors.\n\n" +
      "Section 4.7, off-cycle reassessment. An off-cycle reassessment must be initiated where a key risk indicator moves into red status, where an independent test concludes that a key control is less than largely effective, or where a material process change has occurred since the last assessment. The reassessment must be scoped to the affected risks and controls and must be completed before the next scheduled committee reporting date. An off-cycle reassessment is not satisfied by a note in the periodic report.\n\n" +
      "Section 5.2, risk appetite and escalation. A residual risk position assessed as high requires a documented appetite position and a named accountable executive. A residual position assessed as critical is outside appetite in all cases and must be escalated to the Group Chief Risk Officer on the day the assessment is recorded. Escalation is not satisfied by inclusion in a periodic report. For payment execution risks the appetite boundary is a residual score of 10 on the 25 point scale, and a position at or above that boundary requires either an approved remediation plan with committed dates or a documented Risk Acceptance / Risikoakzeptanz approved by the entity Chief Operating Officer and noted by the Group Non-Financial Risk Committee.\n\n" +
      "Application note issued with version 6.2. Section 4.3 second sentence was added in this version. It was added because in three assessments during 2025 a first line rating of fully effective was carried forward alongside an independent test conclusion of partially effective, with no reconciliation of the two, and the committee was presented with both without being told they were inconsistent.",
    summary:
      "The group operational risk policy sections that govern control effectiveness ratings, off-cycle reassessment triggers and the appetite boundary for payment execution risks at a residual score of 10.",
    relatedObjectIds: [
      "POL-ORP-4.3",
      "POL-ORP-4.7",
      "POL-ORP-5.2",
      "CTL-PAY-014",
      "RSK-0211",
      "RCSA-ARC-DE-PAYOPS-2026-Q4",
      "KRI-PAY-007",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Section 8.4 is the freshness rule the corpus measures staleness against.
   * It is the reason EVD-2026-40118, EVD-2026-40233 and EVD-2026-41440 are
   * flagged rather than merely old.
   */
  {
    id: "EVD-2026-41605",
    runId: DEFAULT_RUN_ID,
    reference: "POL-TPR v4.1",
    title:
      "Group Third-Party Risk Policy version 4.1, extract of sections 6.2, 8.1 and 8.4",
    titleDe:
      "Konzernrichtlinie Drittparteienrisiko Version 4.1, Auszug der Abschnitte 6.2, 8.1 und 8.4",
    sourceType: "policy",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Stefan Brunner, Third-Party Risk Manager, policy owner",
    authorUserId: "P-002",
    documentDate: "2026-03-01",
    ingestedAt: "2026-03-01T00:05:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "GROUP THIRD-PARTY RISK POLICY. Version 4.1. Effective 01.03.2026. Next review due 28.02.2027. Extract of three sections.\n\n" +
      "Section 6.2, subprocessor and fourth-party transparency. The provider must maintain a current register of subprocessors supporting the arrangement and must notify the bank of an intended change before the change takes effect. Where the register and the contractual appendix do not agree, the arrangement is treated as having an unresolved transparency gap until Group Legal has established which document is binding. A transparency gap affecting a critical function must be recorded as an issue. Where a provider asserts that a form of publication constitutes notice, the assertion is recorded as the provider's position and is not treated as satisfying the contractual notice requirement unless the contract so provides.\n\n" +
      "Section 8.1, enhanced monitoring. Enhanced monitoring may be activated by the second line without first line agreement. It requires a defined review frequency, a named reviewer, and a defined exit condition stating what would return the arrangement to standard monitoring. Enhanced monitoring is not a substitute for remediation.\n\n" +
      "Section 8.4, evidence sufficiency and freshness. Evidence relied upon in the assessment or reassessment of a Tier 1 arrangement must satisfy three requirements. First, it must answer the question asked, and evidence whose scope is narrower than the question is recorded as received but not accepted. Second, it must be assessed by the second line within twenty business days of receipt, and the date of assessment must be recorded separately from the date of receipt. Third, it must be no more than ninety days old at the date on which it is relied upon for an assessment conclusion. Where evidence exceeds either time limit it is recorded as stale, and a stale artefact may not support an assessment conclusion unless the assessor records why the passage of time does not affect its reliability.\n\n" +
      "Application note on section 8.4. The twenty business day assessment window exists because the most common failure in third-party evidence handling is not the absence of a document but the presence of an unread one. A document that discloses a gap and is filed without assessment leaves the bank in a worse position than one that was never provided, because the bank is on notice of the gap and has not acted on it.",
    summary:
      "The third-party risk policy sections on transparency gaps, enhanced monitoring and evidence freshness, including the ninety day reliance limit and the twenty business day assessment window that define staleness in this corpus.",
    relatedObjectIds: [
      "POL-TPR-6.2",
      "POL-TPR-8.1",
      "TP-0042",
      "CTR-2023-0117-A3",
      "KRI-TPR-002",
      "MSN-2026-0191",
    ],
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * Section 2.6 is the rule CTL-PAY-014 v4.1 fails twice over: not reviewed
   * annually, and does not state a condition under which the control does
   * not operate.
   */
  {
    id: "EVD-2026-41610",
    runId: DEFAULT_RUN_ID,
    reference: "POL-IKS v2.8",
    title:
      "Group Internal Control System Standard version 2.8, extract of sections 2.6, 3.2 and 4.5",
    titleDe:
      "Konzernstandard Internes Kontrollsystem Version 2.8, Auszug der Abschnitte 2.6, 3.2 und 4.5",
    sourceType: "policy",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Jakob Steinbacher, Control Assurance Specialist, standard owner",
    authorUserId: "P-004",
    documentDate: "2025-10-01",
    ingestedAt: "2025-10-01T00:05:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "GROUP INTERNAL CONTROL SYSTEM STANDARD / KONZERNSTANDARD INTERNES KONTROLLSYSTEM. Version 2.8. Effective 01.10.2025. Next review due 30.09.2026. Extract of three sections.\n\n" +
      "Section 2.6, control descriptions. The description of a key control must be reviewed and reconfirmed at least annually, and must be reviewed whenever a change is made to a system on which the control depends. The description must state every condition under which the control does not operate, including any condition enforced or waived by system configuration, and including any condition arising in a degraded or contingency operating mode. A description that states an absolute requirement where the supporting system applies a conditional one is not an accurate description of the control, whether or not the condition has ever been met in practice.\n\n" +
      "Section 3.2, evidence sufficiency. Evidence is sufficient where it demonstrates that the control operated as designed for the item under test, and where the evidence was created at the time of the control's operation rather than reconstructed afterwards. Where evidence of operation cannot be obtained for an item, the item is recorded as unable to conclude and is not recorded as conforming. An item recorded as unable to conclude counts against the conclusion on operating effectiveness. A statement by the control owner that the control operated is not evidence that it operated.\n\n" +
      "Section 4.5, systemic versus isolated exceptions. An exception is systemic where the cause is capable of recurring without further intervention, irrespective of how many instances were identified in the sample. A small number of instances does not establish that an exception is isolated. Where the cause of an exception is a system configuration, the exception is systemic unless the configuration has been changed. The tester must state the basis on which the distinction was drawn.\n\n" +
      "Application note on section 4.5. This section is the one most frequently applied incorrectly. A single instance in a sample of sixty is read as isolated because it is one instance, when the question the standard asks is whether the cause will produce another instance without anybody doing anything. A configuration that fires under a condition will fire again when the condition recurs.",
    summary:
      "The internal control system standard sections on control descriptions, evidence sufficiency and the systemic versus isolated test. Section 2.6 requires a control description to state every condition under which the control does not operate, including any waived by configuration.",
    relatedObjectIds: [
      "POL-IKS-3.2",
      "POL-IKS-4.5",
      "CTL-PAY-014",
      "TST-2026-0318",
      "EXC-TST-2026-0318-04",
      "UTC-TST-2026-0318-01",
      "MSN-2026-0203",
    ],
    pageCount: 4,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41615",
    runId: DEFAULT_RUN_ID,
    reference: "POL-RES v3.3",
    title:
      "Group Operational Resilience Policy version 3.3, extract of sections 2.4, 5.3 and 7.2",
    titleDe:
      "Konzernrichtlinie Operationelle Resilienz Version 3.3, Auszug der Abschnitte 2.4, 5.3 und 7.2",
    sourceType: "policy",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Nadia Lehmann, Incident and Resilience Lead, policy owner",
    authorUserId: "P-005",
    documentDate: "2026-02-01",
    ingestedAt: "2026-02-01T00:05:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "GROUP OPERATIONAL RESILIENCE POLICY / KONZERNRICHTLINIE OPERATIONELLE RESILIENZ. Version 3.3. Effective 01.02.2026. Next review due 31.01.2027. Extract of three sections.\n\n" +
      "Section 2.4, impact tolerance. An impact tolerance states the maximum tolerable disruption to an important business service, expressed in time or in volume, approved by the entity board. Consumption of tolerance is measured from the point at which the service ceased to be delivered within its normal parameters, not from the point of detection. A determination that a tolerance has been breached is made by the Incident and Resilience Lead and cannot be made automatically. Where a tolerance is expressed with more than one measure, the order of precedence between the measures must be stated at the time of approval; where it is not stated, a divergence between the measures is an open question for the approving body and is not resolved by the Incident and Resilience Lead.\n\n" +
      "Section 5.3, recovery decisions that weaken a control. Where a recovery option would reduce the effectiveness of a key control, the option may be selected only with the agreement of the control owner and the process owner, and the reduction must be recorded as a temporary control weakness with a defined end point. The transactions processed under the weakened control must be identifiable for subsequent review. Where the effect of a recovery option on a control is not known at the time of selection, the option may still be selected, and the unknown effect must be recorded as such and established afterwards.\n\n" +
      "Section 7.2, supervisory notification. A recommendation on supervisory notification is prepared by the Incident and Resilience Lead jointly with Regulatory Change and Group Legal, and the decision to notify is taken by the accountable executive of the affected legal entity. Notification requirements differ by jurisdiction and the applicable requirement must be identified per entity. A group level assessment is not a substitute for an entity level assessment, and the assessments for entities in different jurisdictions are recorded separately with separate conclusions. Illustrative regulatory context, not legal advice.\n\n" +
      "Application note on section 2.4. The precedence requirement in the final sentence was added in version 3.3, in February 2026. Tolerances approved before that date were not re-examined for compliance with it, and no exercise has been run to identify tolerances with more than one measure and no stated precedence.",
    summary:
      "The resilience policy sections on impact tolerance measurement, recovery decisions that weaken a control, and per-entity supervisory notification. Section 2.4 requires an order of precedence where a tolerance has more than one measure, added in February 2026 and never applied retrospectively.",
    relatedObjectIds: [
      "POL-RES-2.4",
      "POL-RES-5.3",
      "POL-RES-7.2",
      "ITOL-0004-03",
      "ITOL-0004-04",
      "IBS-0004",
      "CTL-PAY-014",
      "MSN-2026-0219",
    ],
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* ========================================================================
     7. REGULATORY EVIDENCE
     Two jurisdictions, kept apart on purpose. The EU digest covers ARC-DE
     and ARC-AT. The Swiss digest covers ARC-CH and says in terms that the EU
     instruments are not applicable to it. Nothing in this section asserts
     that Arcadia is compliant with anything.
     ======================================================================== */

  {
    id: "EVD-2026-41300",
    runId: DEFAULT_RUN_ID,
    reference: "REGREF-EU-2026-03",
    title:
      "Regulatory reference digest, ICT third-party risk and operational resilience, European Union entities",
    titleDe:
      "Uebersicht der regulatorischen Referenzen, IKT-Drittparteienrisiko und operationelle Resilienz, EU-Einheiten",
    sourceType: "regulatory-publication",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Tobias Reinhardt, Regulatory Change Manager",
    authorUserId: "P-006",
    documentDate: "2026-09-07",
    ingestedAt: "2026-09-07T10:00:00.000Z",
    entityIds: EU_ENTITIES,
    dataClassification: "public",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "REGULATORY REFERENCE DIGEST. Scope: Arcadia Bank AG (Germany) and Arcadia Bank Oesterreich AG (Austria). Issued 07.09.2026 by Group Regulatory Change. Classified public because it contains no Arcadia-specific assessment, only the reference set and the internal use to which each reference is put.\n\n" +
      REG_LABEL +
      "\n\n" +
      "Purpose and limits of this digest. This digest records which external reference frameworks Arcadia uses when it frames an internal requirement for its European Union credit institutions, and what each reference is used for. It is a navigation aid. It is not a legal analysis, it is not advice, and it does not state that Arcadia or any Arcadia entity is compliant with any instrument. Applicability is determined per legal entity under the Group Regulatory Change Standard section 2.1 and recorded with a rationale in the applicability register.\n\n" +
      "Reference 1. Regulation (EU) 2022/2554, the Digital Operational Resilience Act (DORA). Used for: information and communication technology third-party risk management, the register of information on contractual arrangements, subcontracting of ICT services supporting critical or important functions, incident classification and reporting, and digital operational resilience testing. Appears in: the classification of TP-0042 Novalink Payment Services GmbH and its services, regulatory change item REG-2026-0031, the incident classification assessment for the European Union entities, and the discussion of the subprocessor appendix CTR-2023-0117-A3.\n\n" +
      "Reference 2. EBA Guidelines on outsourcing arrangements. Used for: the determination of material outsourcing / wesentliche Auslagerung, the content of the outsourcing register, audit and access rights, and exit planning. Appears in: the classification of SVC-0042-01 to SVC-0042-04, and in the review of contract appendices A4 and A6.\n\n" +
      "Reference 3. BaFin Minimum Requirements for Risk Management (MaRisk), in particular AT 4.3 on the internal control system and AT 9 on outsourcing. Used for: the framing of the Internal Control System / Internes Kontrollsystem (IKS) and the governance of outsourcing arrangements. Appears in: the IKS designation of CTL-PAY-014 as a key control, and in third-party governance for Arcadia Bank AG.\n\n" +
      "Reference 4. BaFin Supervisory Requirements for IT in Financial Institutions (BAIT). Used for: information technology governance, change management, and third-party information technology arrangements. Appears in: the review of change record CHG-2024-5512 and in the change governance of SYS-0014.\n\n" +
      "Reference 5. National supervision. BaFin and Deutsche Bundesbank for Arcadia Bank AG. FMA Austria and the Austrian implementation of the European Union framework for Arcadia Bank Oesterreich AG. Used for: supervisory access rights and reporting context, and entity level notification.\n\n" +
      "Scope exclusion, stated expressly. This digest does not apply to Arcadia Bank Schweiz AG. The instruments listed above are not applicable to that entity by virtue of their own scope. The reference framework for Arcadia Bank Schweiz AG is set out in a separate digest, EVD-2026-41320, and in any group aggregate view the Swiss entity is shown against its own references or as not applicable, never left blank in a way that would imply coverage.\n\n" +
      REG_LABEL,
    summary:
      "The reference digest for the two EU credit institutions, listing the external frameworks Arcadia uses to frame internal requirements and stating expressly that those instruments do not apply to the Swiss entity, which is covered by a separate digest.",
    relatedObjectIds: [
      "REG-2026-0031",
      "REG-2026-0117",
      "TP-0042",
      "SVC-0042-01",
      "SVC-0042-02",
      "SVC-0042-03",
      "SVC-0042-04",
      "CTR-2023-0117-A3",
      "CTL-PAY-014",
      "CHG-2024-5512",
      "POL-REG-2.1",
      "AG-CMT-NFR-2026-10-06",
    ],
    pageCount: 3,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The Swiss counterpart. This is the document that has to exist so that no
   * surface anywhere is tempted to aggregate ARC-CH under an EU instrument.
   */
  {
    id: "EVD-2026-41320",
    runId: DEFAULT_RUN_ID,
    reference: "REGREF-CH-2026-03",
    title:
      "Regulatory reference digest, operational risk, resilience and outsourcing, Arcadia Bank Schweiz AG",
    titleDe:
      "Uebersicht der regulatorischen Referenzen, operationelles Risiko, Resilienz und Auslagerung, Arcadia Bank Schweiz AG",
    sourceType: "regulatory-publication",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Tobias Reinhardt, Regulatory Change Manager",
    authorUserId: "P-006",
    documentDate: "2026-09-07",
    ingestedAt: "2026-09-07T10:05:00.000Z",
    entityIds: [ENTITY_CH],
    dataClassification: "public",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "REGULATORY REFERENCE DIGEST. Scope: Arcadia Bank Schweiz AG, a Swiss bank supervised by the Swiss Financial Market Supervisory Authority. Issued 07.09.2026 by Group Regulatory Change with the Resilience Officer, Arcadia Bank Schweiz AG. Classified public because it contains no entity-specific assessment.\n\n" +
      REG_LABEL +
      "\n\n" +
      "Purpose and limits of this digest. This digest records which external reference frameworks Arcadia uses when it frames an internal requirement for Arcadia Bank Schweiz AG. It is a navigation aid, not a legal analysis and not advice, and it does not state that the entity is compliant with anything.\n\n" +
      "Reference 1. FINMA Circular 2023/1, Operational risks and resilience, banks. Used for: operational risk management, operational resilience, the identification of critical business processes, the setting of tolerance for disruption, and information and communication technology and cyber risk. Appears in: the designation of IBS-0004 Corporate Payments as a significant business process for the Swiss entity, impact tolerance ITOL-0004-03, the incident reporting assessment for the Swiss entity, and regulatory change item REG-2026-0104.\n\n" +
      "Reference 2. FINMA Circular 2018/3, Outsourcing, banks and insurers. Used for: the determination of significant outsourcing / wesentliche Auslagerung, the outsourcing inventory, supervisory and audit access, and the treatment of data access by subcontractors abroad. Appears in: the classification of SVC-0042-02 for the Swiss entity and of SVC-0042-05, the assessment of TP-0042.1 Helvetia CloudWorks AG, the data access question arising from TP-0042.4 Meridian Operations Support Pvt Ltd, and regulatory change item REG-2026-0088.\n\n" +
      "Reference 3. Swiss Banking Act and Banking Ordinance. Used for: entity level prudential framing. Appears in: the Swiss entity view.\n\n" +
      "Reference 4. Swiss Federal Act on Data Protection (FADP). Used for: the cross-border disclosure of client-identifying data. Appears in: the assessment of TP-0042.4 Meridian Operations Support Pvt Ltd in Pune and of the fourth party TP-0042.3-F1 Aurora Object Storage Ltd in Dublin.\n\n" +
      "Reference 5. FINMA reporting expectations for incidents of substantial importance. Used for: the assessment of whether an operational incident requires a report. Appears in: the Swiss incident classification assessment, which is performed and recorded separately from the assessment performed for the European Union entities.\n\n" +
      "Statement on European Union instruments. Regulation (EU) 2022/2554 and the EBA Guidelines on outsourcing arrangements are referenced in Arcadia's framework for its European Union credit institutions, Arcadia Bank AG and Arcadia Bank Oesterreich AG. They are not applicable to Arcadia Bank Schweiz AG. Where a group aggregate view presents a field derived from one of those instruments, the Swiss column must show the corresponding Swiss reference or must show the field as not applicable. It must not be left blank, because a blank field in an aggregate view reads as coverage.\n\n" +
      "Practical consequence recorded by the Resilience Officer. The same operational event produces two assessments, two records and two conclusions. That is not duplication and the two must never be merged into one assessment for convenience.\n\n" +
      REG_LABEL,
    summary:
      "The reference digest for the Swiss entity, listing the FINMA operational risk, resilience and outsourcing circulars, the Swiss banking and data protection framing, and stating expressly that the EU instruments used for the other two entities are not applicable to it.",
    relatedObjectIds: [
      "REG-2026-0088",
      "REG-2026-0104",
      "REG-2026-0117",
      "IBS-0004",
      "ITOL-0004-03",
      "SVC-0042-02",
      "SVC-0042-05",
      "TP-0042.1",
      "TP-0042.4",
      "TP-0042.3-F1",
      "POL-REG-2.1",
      "AG-CMT-NFR-2026-10-07",
    ],
    pageCount: 3,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41305",
    runId: DEFAULT_RUN_ID,
    reference: "REG-2026-0088 STATUS",
    title:
      "REG-2026-0088 status note, Swiss outsourcing inventory and data-access review for significant outsourcings",
    titleDe:
      "Statusbericht REG-2026-0088, Auslagerungsverzeichnis und Datenzugriffspruefung Schweiz",
    sourceType: "regulatory-publication",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel:
      "Tobias Reinhardt, Regulatory Change Manager, with Sibylle Graf, Resilience Officer ARC-CH",
    authorUserId: "P-006",
    documentDate: "2026-09-23",
    ingestedAt: "2026-09-23T14:30:00.000Z",
    entityIds: [ENTITY_CH],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "REGULATORY CHANGE ITEM STATUS NOTE. Item REG-2026-0088, Swiss outsourcing inventory and data-access review for significant outsourcings. Jurisdiction scope: Arcadia Bank Schweiz AG. Owner: Group Regulatory Change with the Resilience Officer, Arcadia Bank Schweiz AG. Status: in progress. Position as at 23.09.2026.\n\n" +
      REG_LABEL +
      "\n\n" +
      "1. What the item covers. Maintenance of the Arcadia Bank Schweiz AG outsourcing inventory for arrangements classified as significant outsourcing / wesentliche Auslagerung, and a review of which parties can access data of the Swiss entity, including parties located outside Switzerland. Considered under FINMA outsourcing context and, for the disclosure of client-identifying data, under Swiss data protection law. Obligation reference OBL-2026-0088-002 addresses data access by subcontractors abroad.\n\n" +
      "2. Inventory position. Two arrangements with TP-0042 are classified as significant outsourcing for the Swiss entity: SVC-0042-02, the payment repair workbench as provided to the Swiss entity, and SVC-0042-05, the Swiss clearing connectivity adapter for SIC and euroSIC. Both support IBS-0004 Corporate Payments, which is designated a significant business process for the entity. Inventory records for both are complete on the fields the inventory template requires.\n\n" +
      "3. Data access position as previously recorded. Subprocessor TP-0042.1 Helvetia CloudWorks AG, Zurich, hosts the Swiss instance of the payment repair workbench and the euroSIC adapter. Access is from Switzerland. Subprocessor TP-0042.3 Polaris Telemetrix s.r.o., Brno, performs monitoring, log aggregation and alerting for all Novalink services including those provided to the Swiss entity. Access is from the Czech Republic.\n\n" +
      "4. Newly opened question. During the 2026 reassessment of TP-0042, Group Third-Party Risk Management established that TP-0042.4 Meridian Operations Support Pvt Ltd, Pune, India, has been engaged by Novalink since 01.05.2026 to provide level 1 service desk and out-of-hours monitoring handover for the payment repair workbench, and that its personnel hold read access to payment metadata including beneficiary name and reference fields. The payment repair workbench is a significant outsourcing for the Swiss entity. This opens three questions for this item. First, whether data of the Swiss entity is within the scope of that access. Second, whether the access constitutes a disclosure of client-identifying data outside Switzerland that requires a recorded basis. Third, whether the supervisory and audit access right at CTR-2023-0117-A4 clause 2.5 has been procured in respect of that subprocessor.\n\n" +
      "5. Second newly opened question. The fourth party TP-0042.3-F1 Aurora Object Storage Ltd, Dublin, holds archived telemetry containing payment reference metadata for 24 months. It was disclosed only in response to a specific follow-up question on 24.09.2026 and is not addressed by the contract.\n\n" +
      "6. Evidence held. Contract appendices A3, A4 and A7. The Novalink subprocessor register version 6.1. The Novalink questionnaire responses for domain 4. The reconciliation working sheet EVD-2026-41415.\n\n" +
      "7. Evidence not held. Any Novalink notice of the Meridian engagement. Any statement of which entity data is in scope of Meridian access. Any confirmation that the Swiss supervisory and audit access right has been procured from Meridian. Any disaster recovery test evidence for the Swiss instance of the payment repair workbench.\n\n" +
      "8. Position stated plainly. This note does not state that the entity meets or fails to meet any requirement. It states what the arrangements are, which evidence the entity holds, and which evidence it does not hold. Three questions are open, the responsible owners are named, and the item goes to the committee for noting at AG-CMT-NFR-2026-10-07.\n\n" +
      "9. Note on scope separation. Regulation (EU) 2022/2554 is not applicable to Arcadia Bank Schweiz AG and is not referenced in this item. The equivalent group work for Arcadia Bank AG and Arcadia Bank Oesterreich AG is tracked separately as REG-2026-0031 and the two items are not merged.\n\n" +
      REG_LABEL,
    summary:
      "The status of the Swiss outsourcing inventory and data-access review. Two arrangements are significant outsourcings, and the newly discovered Indian service desk subprocessor with payment metadata access has opened three unanswered questions about scope, basis and supervisory access.",
    relatedObjectIds: [
      "REG-2026-0088",
      "OBL-2026-0088-002",
      "SVC-0042-02",
      "SVC-0042-05",
      "TP-0042",
      "TP-0042.1",
      "TP-0042.3",
      "TP-0042.4",
      "TP-0042.3-F1",
      "CTR-2023-0117-A4",
      "CTR-2023-0117-A7",
      "IBS-0004",
      "AG-CMT-NFR-2026-10-07",
    ],
    pageCount: 6,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * A draft standard in consultation, and the destination for the tolerance
   * precedence question that the day cannot resolve. Status is "draft" on
   * purpose: the corpus needs one document that is not yet authority.
   */
  {
    id: "EVD-2026-41310",
    runId: DEFAULT_RUN_ID,
    reference: "REG-2026-0104 DRAFT",
    title:
      "Draft internal standard, impact tolerance definition and testing, issued for consultation 21.09.2026",
    titleDe:
      "Entwurf eines internen Standards, Definition und Pruefung von Toleranzschwellen, Konsultation",
    sourceType: "regulatory-publication",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Tobias Reinhardt, Regulatory Change Manager, with Nadia Lehmann",
    authorUserId: "P-006",
    documentDate: "2026-09-21",
    ingestedAt: "2026-09-21T11:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "draft",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "DRAFT INTERNAL STANDARD. Impact tolerance definition and testing. Regulatory change item REG-2026-0104. Issued for consultation 21.09.2026. Consultation closes 23.10.2026. This is a draft and is not authority until adopted.\n\n" +
      REG_LABEL +
      "\n\n" +
      "Scope note. This standard is a group internal standard. It is developed with separate reference to the European Union framework as applied to Arcadia Bank AG and Arcadia Bank Oesterreich AG, and to FINMA operational risk and resilience context as applied to Arcadia Bank Schweiz AG. The references are held separately in the applicability register and the standard does not import one jurisdiction's framework into another entity.\n\n" +
      "Draft requirement 1, expression of a tolerance. An impact tolerance must be expressed as a single decisive measure. Where more than one measure is used, the standard requires that the order of precedence between the measures be stated in the approval record, together with the treatment where the measures diverge. A tolerance expressed with two measures and no stated precedence cannot be assessed, because the entity cannot say whether it has been breached.\n\n" +
      "Draft requirement 2, retrospective application. Within ninety days of adoption, each entity must review every impact tolerance approved before the adoption date, identify any tolerance expressed with more than one measure, and either state the precedence or re-express the tolerance with a single measure. The review is to be reported to the approving body for each tolerance.\n\n" +
      "Draft requirement 3, measurement start point. Consumption of a tolerance is measured from the point at which the service ceased to be delivered within its normal parameters. Where that point is established only retrospectively, the tolerance position must be restated when it is established and the restatement must be recorded rather than substituted for the original assessment.\n\n" +
      "Draft requirement 4, testing. Each impact tolerance must be tested at least once in every two years by a severe but plausible scenario exercise. A tolerance whose only fallback arrangement has been exercised by desktop walkthrough alone is recorded as untested for the purposes of this requirement.\n\n" +
      "Draft requirement 5, dependency on a single provider. Where the only fallback arrangement for a service depends on a manual process, the tolerance must state the preparation lead time of that process, and the lead time must be validated by exercise rather than estimated.\n\n" +
      "Consultation questions. Question 1: is the ninety day retrospective review window in requirement 2 achievable across all three entities. Question 2: should requirement 4 distinguish between a tolerance for a service with an electronic fallback and one with only a manual fallback. Question 3: should requirement 5 apply to arrangements where the manual fallback has never been performed live.\n\n" +
      "Comments received as at 06.10.2026. Two. From Group Operational Resilience, supporting requirements 1 and 2 and noting that at least one existing tolerance is known to be expressed with two measures and no precedence. From Arcadia Bank Schweiz AG, supporting requirement 5 and noting that the Swiss manual correspondent route has a stated lead time that has never been validated by live exercise.\n\n" +
      REG_LABEL,
    summary:
      "The draft internal standard in consultation until 23.10.2026. Requirement 1 would require a stated order of precedence where a tolerance uses more than one measure, and requirement 5 would require manual fallback lead times to be validated by exercise rather than estimated.",
    relatedObjectIds: [
      "REG-2026-0104",
      "ITOL-0004-01",
      "ITOL-0004-02",
      "ITOL-0004-03",
      "ITOL-0004-04",
      "IBS-0004",
      "MSN-2026-0219",
      "RB-PAY-011",
      "POL-RES-2.4",
      "AG-CMT-NFR-2026-10-08",
    ],
    pageCount: 7,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  {
    id: "EVD-2026-41315",
    runId: DEFAULT_RUN_ID,
    reference: "REG-2026-0117 STD",
    title:
      "Group incident classification and reporting standard, two assessment tracks, implemented 30.04.2026",
    titleDe:
      "Konzernstandard zur Klassifizierung und Meldung von Vorfaellen, zwei Beurteilungswege",
    sourceType: "regulatory-publication",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Tobias Reinhardt, Regulatory Change Manager",
    authorUserId: "P-006",
    documentDate: "2026-04-30",
    ingestedAt: "2026-04-30T09:00:00.000Z",
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "GROUP INCIDENT CLASSIFICATION AND REPORTING STANDARD. Regulatory change item REG-2026-0117. Implemented 30.04.2026. First annual review due 30.11.2026.\n\n" +
      REG_LABEL +
      "\n\n" +
      "1. Purpose. To establish how Arcadia assesses whether an operational incident requires a report to a supervisory authority, and to record the assessment so that it can be re-performed when facts change.\n\n" +
      "2. The two tracks. An operational incident affecting more than one entity produces more than one assessment. For Arcadia Bank AG and Arcadia Bank Oesterreich AG, the assessment is performed against the European Union major-incident classification criteria. For Arcadia Bank Schweiz AG, the assessment is performed against FINMA reporting expectations for incidents of substantial importance. The two assessments are performed separately, recorded separately, and concluded separately. They are never merged into one assessment and one conclusion, and a conclusion reached on one track is never applied to the other entity.\n\n" +
      "3. Criteria considered on the European Union track. Clients affected. Reputational impact. Duration of the incident and service downtime. Geographical spread. Data losses. Criticality of the services affected. Economic impact. Each criterion is assessed on the facts available at the time of assessment, and the facts available are recorded alongside the conclusion.\n\n" +
      "4. Criteria considered on the Swiss track. Whether the incident is of substantial importance to the entity, having regard to the criticality of the affected business processes, the duration and extent of the disruption, the effect on the entity's clients, and the entity's ability to continue to deliver the affected processes. Assessed by the entity with the Group Incident and Resilience Lead and Group Regulatory Change.\n\n" +
      "5. Provisional conclusions. An assessment reached while an incident is open is recorded as provisional and states which facts are not yet available. A provisional conclusion of no report required is not a decision that no report will be required. The assessment must be re-performed when a material new fact arrives, and in particular on receipt of a provider's root-cause report where the incident originated with a provider.\n\n" +
      "6. Who decides. The recommendation is prepared by the Incident and Resilience Lead jointly with Group Regulatory Change and Group Legal. The decision to notify is taken by the accountable executive of the affected legal entity. The group function cannot take the decision for an entity.\n\n" +
      "7. Record. Each assessment is recorded as a decision record with the time of the assessment, the facts relied on, the conclusion, the person who decided, and whether the conclusion is provisional. Superseded assessments are retained and are not overwritten.\n\n" +
      "8. What this standard does not do. It does not state that Arcadia is compliant with any reporting requirement. It states how Arcadia reaches and records a view on whether a report is required.\n\n" +
      REG_LABEL,
    summary:
      "The standard that requires two separate incident classification assessments for a single event, one for the EU entities and one for the Swiss entity, with provisional conclusions that must be re-performed when a provider root-cause report arrives.",
    relatedObjectIds: [
      "REG-2026-0117",
      "INC-2026-0412",
      "DEC-2026-0774",
      "DEC-2026-0775",
      "POL-RES-7.2",
      "POL-REG-2.1",
      "IBS-0004",
    ],
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /* ========================================================================
     8. EVENT EVIDENCE, INC-2026-0412
     Everything below arrives with the 14:05 event or later. Each row carries
     fromSharedEvent true and a revealedAtMoment equal to the clock time at
     which the artefact actually landed, so the workday reveal gate shows
     them in the order a person lived them.
     ======================================================================== */

  /*
   * The first thing Arcadia hears, and it is wrong. Five of the six
   * contractual fields are absent and the one substantive assertion, no
   * customer impact, is contradicted by every verified fact that follows.
   */
  {
    id: "EVD-2026-41871",
    runId: DEFAULT_RUN_ID,
    reference: "NSN-2026-0887",
    title:
      "Novalink service notification NSN-2026-0887 as received in the supplier mailbox at 14:05:12",
    titleDe:
      "Novalink Stoerungsmeldung NSN-2026-0887 wie im Lieferantenpostfach eingegangen",
    sourceType: "incident-notification",
    sourceSystem: "Shared mailbox payments-supplier@arcadia.example",
    authorLabel: "Novalink Payment Services GmbH, Service Desk",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("14:05"),
    entityIds: EU_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "NOTIFICATION AS RECEIVED. Preserved exactly as delivered. Receipt metadata: received 06.10.2026 at 14:05:12 CET in shared mailbox payments-supplier@arcadia.example. Sender: Novalink Payment Services GmbH service desk automated notification address. Subject line: Service notification NSN-2026-0887. Also published to the Novalink client status portal at 14:05.\n\n" +
      "Body, verbatim. Degraded performance affecting NOVA-GATE clearing submission in the DACH region. Investigation ongoing. Severity P3. No customer impact identified at this time.\n\n" +
      "End of notification. Nothing further was included. No attachment. No named contact.\n\n" +
      "Receipt record prepared by the shared mailbox triage at 14:06. What the notification establishes as a verified fact: that a notification bearing this reference existed and was received at 14:05:12. What the notification asserts and does not evidence: the geographic scope, the severity, the state of investigation, and the absence of customer impact. Each of those is a supplier statement and is recorded as such.\n\n" +
      "Content check against CTR-2023-0117-A5 clause 5.3, which requires six items. (a) The time at which the disruption began: not stated. (b) The services affected: partially stated, NOVA-GATE clearing submission, with no reference to the payment repair workbench or the Swiss clearing connectivity adapter. (c) The Arcadia legal entities affected: not stated. The notification refers to a region rather than to entities. (d) The severity assigned by the supplier: stated, P3. (e) An initial assessment of impact on Arcadia: stated only as a negative, no customer impact identified at this time, with no assessment behind it. (f) The time by which the next update will be provided: not stated.\n\n" +
      "Position recorded at 14:06. One of the six required items is unambiguously present. Clause 5.3 provides that a notification omitting any of the six items is not a notification for the purposes of that clause. That is a statement of the contractual position and not a conclusion on breach, which is a matter for Group Legal and Procurement.\n\n" +
      "Note on timing, added at 14:29 when the incident record was raised. Arcadia telemetry places the onset of submission acknowledgement latency at 13:38 and acknowledgement timeouts from 13:51. The notification was received at 14:05:12. Clause 5.3 requires notification within thirty minutes of the supplier's detection, and the supplier's detection time is not stated in the notification, so the thirty minute obligation cannot be measured from this document alone.",
    summary:
      "The supplier's first notification, received at 14:05:12. It asserts no customer impact, names a region rather than entities, and supplies only one of the six items the contract requires a notification to contain.",
    relatedObjectIds: [
      "INC-2026-0412",
      "NSN-2026-0887",
      "TP-0042",
      "SVC-0042-01",
      "CTR-2023-0117-A5",
      "IBS-0004",
      "SYS-0012",
    ],
    pageCount: 1,
    fromSharedEvent: true,
    revealedAtMoment: "14:05",
  },

  {
    id: "EVD-2026-41872",
    runId: DEFAULT_RUN_ID,
    reference: "ALRT-2026-77412",
    title:
      "SYS-0011 monitoring extract, alert ALRT-2026-77412, NOVA-GATE acknowledgement latency",
    titleDe:
      "Auszug aus der Ueberwachung SYS-0011, Alarm ALRT-2026-77412, Bestaetigungslatenz NOVA-GATE",
    sourceType: "telemetry-extract",
    sourceSystem: "SYS-0011 Arcadia Payment Hub",
    authorLabel: "Arcadia Payment Hub monitoring, automated alert",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("14:07"),
    entityIds: EU_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "telemetry",
    body:
      "MONITORING EXTRACT. Alert ALRT-2026-77412. Raised by SYS-0011 Arcadia Payment Hub at 14:07 on 06.10.2026. Alert class: submission acknowledgement latency, clearing route SYS-0012 NOVA-GATE.\n\n" +
      "Measurement. Submission acknowledgement latency, measured as the elapsed time between despatch of a submission from SYS-0011 and receipt of the corresponding acknowledgement. Seven day median for this metric: 1.4 seconds. Current reading at 14:07: 42 seconds. Onset of degradation: 13:38, being the first five minute interval in which the median exceeded three times the seven day median. Acknowledgement timeouts first recorded: 13:51. Instructions currently in SUBMITTED state awaiting acknowledgement: 2,317.\n\n" +
      "Series detail. 13:30 to 13:35 median 1.5 seconds. 13:35 to 13:40 median 6.2 seconds. 13:40 to 13:45 median 14.8 seconds. 13:45 to 13:50 median 27.1 seconds. 13:50 to 13:55 median 38.4 seconds with first timeouts. 13:55 to 14:05 median 41.7 seconds. 14:05 to 14:07 median 42.0 seconds.\n\n" +
      "Inference drawn. The degradation began at approximately 13:38, which is 27 minutes before the supplier notification timestamped 14:05:12. The supplier's statement that no customer impact has been identified is inconsistent with the Arcadia-side measurement, because 2,317 instructions are held in an unacknowledged state.\n\n" +
      "Why the inference could be wrong, stated as required. This latency metric is measured at the Arcadia edge. It measures the round trip from Arcadia to the supplier and back. An Arcadia network path problem, a firewall change on the Arcadia side, or a name resolution failure would produce the same signature as a supplier-side degradation. Arcadia cannot distinguish supplier-side from path-side degradation from this metric alone. The Arcadia change record for the day shows no relevant change, which weakens the path explanation but does not exclude it.\n\n" +
      "What would settle it. A supplier-side measurement of the same interval, or a measurement from a second independent Arcadia network path.\n\n" +
      "Distribution. Payment Operations duty desk. Payments Technology on-call. Group Operational Resilience.",
    summary:
      "The monitoring extract that put the onset of degradation at 13:38, twenty-seven minutes before the supplier notification, with 2,317 instructions held unacknowledged. It also states why an edge measurement cannot on its own prove the fault is the supplier's.",
    relatedObjectIds: [
      "INC-2026-0412",
      "SYS-0011",
      "SYS-0012",
      "TP-0042",
      "SVC-0042-01",
      "ITOL-0004-01",
      "IBS-0004",
    ],
    pageCount: 1,
    fromSharedEvent: true,
    revealedAtMoment: "14:07",
  },

  /*
   * The decision that was correct under the runbook and that silently
   * satisfied the second condition of RD-RULE-0031. No warning was surfaced
   * to the operator because nothing in the system knew to surface one.
   */
  {
    id: "EVD-2026-41874",
    runId: DEFAULT_RUN_ID,
    reference: "QRY-2026-88097",
    title:
      "SYS-0014 configuration audit log extract, fallback route mode activation at 14:12:41",
    titleDe:
      "Auszug aus dem Konfigurationsprotokoll SYS-0014, Aktivierung des Ausweichbetriebs um 14:12:41",
    sourceType: "telemetry-extract",
    sourceSystem: "SYS-0014 Novalink RepairDesk",
    authorLabel: "Novalink RepairDesk configuration audit log, extracted by Payments Technology",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("14:12"),
    entityIds: EU_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "CONFIGURATION AUDIT LOG EXTRACT. Source SYS-0014 Novalink RepairDesk, tenant arcadia-prod, configuration audit log. Extract QRY-2026-88097. Window 06.10.2026 13:00 to 14:15.\n\n" +
      "Row 1. Timestamp 14:12:41. Actor: the identity of the acting Duty Manager, Payment Operations, Elif Demir. Object: queue Q-REPAIR-DE. Parameter: fallbackRouteMode. Previous value: INACTIVE. New value: ACTIVE. Authority reference entered by the actor: RB-PAY-007. Change record reference entered by the actor: CHG-2026-7741.\n\n" +
      "Row 2. Timestamp 14:12:41. Actor: as row 1. Object: queue Q-REPAIR-AT. Parameter: fallbackRouteMode. Previous value: INACTIVE. New value: ACTIVE. Authority reference: RB-PAY-007. Change record reference: CHG-2026-7741.\n\n" +
      "Row 3. Timestamp 14:12:44. Actor: system. Object: queue Q-REPAIR-DE. Event: clearing submission endpoint reconfigured from SYS-0012 to SYS-0013 on instruction from SYS-0011.\n\n" +
      "Row 4. Timestamp 14:12:44. Actor: system. Object: queue Q-REPAIR-AT. Event: as row 3.\n\n" +
      "No row for Q-REPAIR-CH. The Swiss queue was not changed. Arcadia Bank Schweiz AG holds no direct SIC participant link and has no fallback clearing route to activate.\n\n" +
      "Verified facts established by this extract. The change was made at 14:12:41 by the acting Duty Manager. It was made under the authority of runbook RB-PAY-007, which places the change within the Duty Manager's standing authority. An emergency change record was raised as the runbook requires. Clearing submission for the two EU entity queues moved to SYS-0013 Arcadia Direct Link within three seconds.\n\n" +
      "Documented consequence. SYS-0013 performs no payment data validation. Instructions that SYS-0012 would have enriched or corrected now fail with reason codes R01, R02, R04 or R08 and enter the repair queue, and their release requires an OVR-C route substitution override. This consequence is stated in RB-PAY-007 section 4 and in the PRC-0041 process record.\n\n" +
      "Consequence not documented anywhere in Arcadia's records. Setting fallbackRouteMode to ACTIVE satisfies one of the four conditions evaluated by RepairDesk on the OVERRIDE_PROPOSED transition. No entry in this log, no message to the operator and no field in the change record records that effect. The audit log for this window contains no change to any rule and no warning event. Nothing was bypassed and nothing malfunctioned; the configuration behaved exactly as configured, and the configuration was not known.\n\n" +
      "Extract integrity. Rows taken directly from the supplier system audit log through the standard Arcadia extract interface. Content hash recorded in SYS-0032.",
    summary:
      "The audit log rows for the 14:12:41 fallback activation on the German and Austrian queues. The change was authorised, recorded and correct, the Swiss queue was untouched, and nothing in the log or the interface signalled the effect on the secondary review requirement.",
    relatedObjectIds: [
      "INC-2026-0412",
      "PRC-0041",
      "SYS-0013",
      "SYS-0014",
      "RD-RULE-0031",
      "CTL-PAY-014",
      "RB-PAY-007",
      "CHG-2026-7741",
      "DEC-2026-0773",
      "P-009",
    ],
    pageCount: 1,
    fromSharedEvent: true,
    revealedAtMoment: "14:12",
  },

  /*
   * Typed as a process artefact because the enumerated source types carry no
   * change-record value and Arcadia files change records against the process
   * they affect. The line that matters is the risk assessment field: no
   * control impact, entered in good faith by someone who had read the
   * runbook that says so.
   */
  {
    id: "EVD-2026-41875",
    runId: DEFAULT_RUN_ID,
    reference: "CHG-2026-7741",
    title:
      "Arcadia emergency change record CHG-2026-7741, fallback clearing route activation",
    titleDe:
      "Arcadia Notfallaenderung CHG-2026-7741, Aktivierung des Ausweichclearingwegs",
    sourceType: "process-map",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Elif Demir, Senior Payment Repair Analyst, acting Duty Manager",
    authorUserId: "P-009",
    documentDate: "2026-10-06",
    ingestedAt: at("14:12"),
    entityIds: EU_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "EMERGENCY CHANGE RECORD CHG-2026-7741. Raised 06.10.2026 at 14:14. Type: emergency, retrospective approval under the standing authority in runbook RB-PAY-007 section 2.\n\n" +
      "Requester and implementer. Elif Demir, Senior Payment Repair Analyst, acting Duty Manager, Payment Operations, Munich.\n\n" +
      "Approver. Self-approved under the Duty Manager standing authority. The Head of Payment Operations was informed at 14:16, within the fifteen minute requirement in the runbook.\n\n" +
      "Change description. Activate fallback clearing route for the German and Austrian payment repair queues. Set fallbackRouteMode to ACTIVE on Q-REPAIR-DE and Q-REPAIR-AT in SYS-0014. Switch clearing submission in SYS-0011 from SYS-0012 Novalink Gateway to SYS-0013 Arcadia Direct Link.\n\n" +
      "Reason for the change. NOVA-GATE submission acknowledgement latency at 42 seconds against a seven day median of 1.4 seconds, timeouts from 13:51, 2,317 instructions unacknowledged, alert ALRT-2026-77412. Supplier notification NSN-2026-0887 received at 14:05 reporting degraded performance with no restoration estimate. Same-day submission at risk.\n\n" +
      "Systems affected. SYS-0011, SYS-0012, SYS-0013, SYS-0014.\n\n" +
      "Entities affected. Arcadia Bank AG. Arcadia Bank Oesterreich AG. Arcadia Bank Schweiz AG not affected by this change; no fallback route exists for the Swiss queue.\n\n" +
      "Start time. 14:12:41. Expected end time: on restoration of NOVA-GATE, no estimate available.\n\n" +
      "Risk assessment field, as completed by the requester. Repair volume will increase. No control impact.\n\n" +
      "Rollback. Reverse the clearing submission endpoint in SYS-0011, then set fallbackRouteMode to INACTIVE on both queues, in that order, per runbook section 3.6.\n\n" +
      "Notifications sent. Payment Repair Team Lead at 14:15. Head of Payment Operations at 14:16. Payments Technology on-call at 14:15. Zurich Duty Manager at 14:17, per runbook section 6.\n\n" +
      "Closure. Change closed at 16:08 on restoration of full service. Rollback completed per runbook.\n\n" +
      "Post-event annotation added by Group Control Assurance at 16:35. The risk assessment field entry no control impact is accurate against the runbook and wrong against the system. The entry is not a failure by the requester: RB-PAY-007 section 4 states that the control environment is unchanged during fallback operation, and the requester recorded what the runbook told her. The correction belongs to the runbook, which is the subject of MSN-2026-0216.",
    summary:
      "The emergency change record for the fallback activation. Its risk assessment field records no control impact, which matches the runbook and not the system, and the annotation places the correction with the runbook rather than with the Duty Manager.",
    relatedObjectIds: [
      "CHG-2026-7741",
      "INC-2026-0412",
      "RB-PAY-007",
      "PRC-0041",
      "SYS-0013",
      "SYS-0014",
      "CTL-PAY-014",
      "RD-RULE-0031",
      "DEC-2026-0773",
      "MSN-2026-0216",
      "P-009",
    ],
    pageCount: 2,
    fromSharedEvent: true,
    revealedAtMoment: "14:12",
  },

  {
    id: "EVD-2026-41876",
    runId: DEFAULT_RUN_ID,
    reference: "QRY-2026-88101",
    title:
      "SYS-0014 queue telemetry extract, repair queue depth 14:12 to 14:26",
    titleDe:
      "Auszug aus der Warteschlangentelemetrie SYS-0014, Tiefe der Reparaturwarteschlange",
    sourceType: "telemetry-extract",
    sourceSystem: "SYS-0014 Novalink RepairDesk",
    authorLabel: "Novalink RepairDesk queue telemetry, extracted by Payment Operations",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("14:26"),
    entityIds: EU_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "telemetry",
    body:
      "QUEUE TELEMETRY EXTRACT. Source SYS-0014 Novalink RepairDesk queue metrics. Extract QRY-2026-88101. Window 06.10.2026 14:10 to 14:26.\n\n" +
      "Measurement, Q-REPAIR-DE queue depth. 14:10: 58 items. 14:12: 61 items. 14:14: 112 items. 14:16: 187 items. 14:18: 254 items. 14:20: 318 items. 14:22: 381 items. 14:24: 443 items. 14:26: 494 items.\n\n" +
      "Measurement, Q-REPAIR-AT queue depth. 14:12: 14 items. 14:26: 97 items.\n\n" +
      "Measurement, override creation. 138 OVR-C route substitution overrides were created between 14:12:41 and 14:26:00 across the two queues. The normal full-day figure for Arcadia Bank AG is approximately 33 overrides of all reason codes combined.\n\n" +
      "Measurement, failure reason codes on queued items. Of the 433 items added to Q-REPAIR-DE between 14:12 and 14:26, 144 carry R01, 97 carry R02, 41 carry R04 and 38 carry R08, with the remainder carrying combinations of those four. No item added in the window carries R03, R05 or R07 alone.\n\n" +
      "Inference drawn. The rise in queue depth is caused by fallback activation removing NOVA-GATE enrichment, not by a change in client behaviour and not by a data quality event at a client. The distribution of failure reason codes supports this, because R01, R02, R04 and R08 are precisely the codes RB-PAY-007 section 4 predicts will appear when validation and enrichment are absent.\n\n" +
      "Why the inference could be wrong, stated as required. A large corporate bulk file submitted at around 14:10 would produce a similar queue spike, and a bulk file with poor static data would produce a similar reason code distribution. The inference has not yet been tested against the SYS-0011 file submission log for the window. Until it has, the fallback explanation is the most probable cause and not an established one.\n\n" +
      "What would settle it. The file submission log for 14:00 to 14:20, which would show whether a bulk file of the relevant size arrived.\n\n" +
      "Operational note recorded at 14:27. At the current rate of arrival and the current reviewer complement on duty, the queue cannot be cleared before the afternoon cut-off. The Duty Manager has requested support from the morning shift.",
    summary:
      "Queue telemetry showing the German repair queue rising from 61 to 494 items in fourteen minutes with 138 route substitution overrides created, against a normal full-day figure of about 33 overrides of all types.",
    relatedObjectIds: [
      "INC-2026-0412",
      "PRC-0041",
      "SYS-0014",
      "KRI-PAY-007",
      "KRI-PAY-003",
      "RB-PAY-007",
      "CTL-PAY-014",
    ],
    pageCount: 1,
    fromSharedEvent: true,
    revealedAtMoment: "14:26",
  },

  /*
   * The spine of the event. At 14:34 this extract is a measurement with an
   * honest caveat; at 15:38 the caveat is removed by EVD-2026-41905 and the
   * same rows become a verified fact. The reclassification is recorded here
   * rather than overwritten, because the history is the evidence.
   */
  {
    id: "EVD-2026-41878",
    runId: DEFAULT_RUN_ID,
    reference: "QRY-2026-88104",
    title:
      "SYS-0014 override audit log query QRY-2026-88104, the 138 route substitution overrides of 14:12 to 14:26",
    titleDe:
      "Abfrage des Ueberschreibungsprotokolls SYS-0014, QRY-2026-88104, die 138 Ueberschreibungen",
    sourceType: "transaction-log",
    sourceSystem: "SYS-0014 Novalink RepairDesk",
    authorLabel: "Jakob Steinbacher, Control Assurance Specialist, query author",
    authorUserId: "P-004",
    documentDate: "2026-10-06",
    ingestedAt: at("14:34"),
    entityIds: EU_ENTITIES,
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "OVERRIDE AUDIT LOG QUERY QRY-2026-88104. Source SYS-0014 Novalink RepairDesk, override audit log, tenant arcadia-prod. Run 06.10.2026 at 14:34. Query window: override records with createdAt between 14:12:41 and 14:26:00 on 06.10.2026, entity partitions ARC-DE and ARC-AT.\n\n" +
      "Result set size. 138 override records, all with overrideReasonCode OVR-C, all with fallbackRouteMode ACTIVE at the moment of evaluation.\n\n" +
      "Split by the secondary review requirement. 96 records have secondaryReviewRequired false and secondaryReviewerId null. 42 records have secondaryReviewRequired true, of which 29 have a recorded review decision of APPROVED and a release timestamp, and 13 remain in AWAITING_SECONDARY_REVIEW at the time of the query. 96 plus 29 plus 13 equals 138.\n\n" +
      "The 96 records in detail. Combined value EUR 9,420,880. Every one of the 96 has an individual valueAmount below EUR 250,000 and a valueCurrency of EUR. Split by entity: Arcadia Bank AG 78 records, EUR 7,611,240. Arcadia Bank Oesterreich AG 18 records, EUR 1,809,640. 78 plus 18 equals 96, and EUR 7,611,240 plus EUR 1,809,640 equals EUR 9,420,880.\n\n" +
      "Field content common to all 96. reviewWaiverCode: BCP-THROUGHPUT. secondaryReviewerId: null. secondaryReviewAt: null. reviewDecision: null. State: RELEASED_WITH_OVERRIDE, reached directly from OVERRIDE_PROPOSED without passing through AWAITING_SECONDARY_REVIEW. ruleEvaluationTrace: four rules evaluated, the third returning a result of waived, with the rule identifier recorded as RD-RULE-0031 and the audit note secondary review waived under business continuity throughput provision.\n\n" +
      "Sample rows, five of ninety-six. Record 1: ARC-DE, EUR 184,600, failure codes R01 and R04, suppressed rule set of two rules, created 14:14:09, released 14:14:11. Record 2: ARC-DE, EUR 47,300, failure code R02, created 14:15:52, released 14:15:54. Record 3: ARC-AT, EUR 96,150, failure codes R01 and R08, created 14:17:33, released 14:17:35. Record 4: ARC-DE, EUR 231,880, failure code R01, created 14:19:41, released 14:19:43. Record 5: ARC-DE, EUR 38,400, failure code R01, created 14:21:06, released 14:21:08. In each case the elapsed time between override creation and release is approximately two seconds, which is consistent with no human step occurring between them.\n\n" +
      "Inference drawn at 14:34. 96 payments were released without the independent secondary review required by CTL-PAY-014. That is a candidate breach of impact tolerance ITOL-0004-04, which has a tolerance of zero.\n\n" +
      "Why the inference could be wrong, as stated at 14:34. The absence of a reviewer identity at query time is not proof that no review occurred. If RepairDesk populates reviewer identity asynchronously, or if a bulk approval writes the identity at the end of a processing cycle, the field would be empty now and populated later. Arcadia does not know how RepairDesk writes this field. The control owner has stated that the system backfills reviewer identities at the end of the batch cycle. Separately, the rule identifier appearing in the evaluation trace tells Arcadia that a rule waived the requirement but does not tell Arcadia what the rule is, where it came from, whether Arcadia can change it, or how often it has fired.\n\n" +
      "Reclassification recorded at 15:38. The tenant configuration export provided under CTR-2023-0117-A4 clause 2.1 and filed as EVD-2026-41905 establishes that reviewer identity is written synchronously at review submission and that there is no backfill. The caveat above is therefore resolved. From 15:38 the content of this extract is a verified fact: 96 payments were released without secondary review. The 14:34 classification and its caveat are retained above and are not overwritten, because the sequence in which Arcadia came to know this is itself relevant to the committee.\n\n" +
      "Extract integrity. Content hash recorded in SYS-0032 at 14:35.",
    summary:
      "The query at the centre of the event: of 138 route substitution overrides created in fourteen minutes, 96 worth EUR 9,420,880 were released with no secondary review required and no reviewer recorded, each about two seconds after creation.",
    relatedObjectIds: [
      "INC-2026-0412",
      "CTL-PAY-014",
      "RD-RULE-0031",
      "ITOL-0004-04",
      "RSK-0211",
      "TST-2026-0318",
      "EXC-TST-2026-0318-04",
      "SYS-0014",
      "MSN-2026-0214",
      "MSN-2026-0215",
    ],
    pageCount: 3,
    fromSharedEvent: true,
    revealedAtMoment: "14:34",
  },

  /* The written update that says the cause is under investigation seven
   * minutes after the cause was named verbally on the bridge, and that
   * discloses a second affected component nobody had mentioned. */
  {
    id: "EVD-2026-41915",
    runId: DEFAULT_RUN_ID,
    reference: "NSN-2026-0887-U1",
    title: "Novalink client status portal update NSN-2026-0887-U1, 15:02",
    titleDe: "Novalink Statusportal, Aktualisierung NSN-2026-0887-U1, 15:02",
    sourceType: "incident-notification",
    sourceSystem: "Novalink client status portal",
    authorLabel: "Novalink Payment Services GmbH, client status portal",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("15:02"),
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "PORTAL UPDATE AS CAPTURED. Novalink client status portal, incident NSN-2026-0887, update 1. Captured by Arcadia at 15:02 on 06.10.2026.\n\n" +
      "Content, verbatim. Severity raised to P2. Cause under investigation. Monitoring and alerting pipeline also degraded. Next update by 16:00.\n\n" +
      "End of update.\n\n" +
      "What this update adds. A severity change from P3 to P2. A next update time, which the original notification omitted. A second affected component, the monitoring and alerting pipeline, which had not previously been mentioned in any supplier communication.\n\n" +
      "Observation recorded by the incident manager at 15:04. At 14:55, seven minutes before this update was published, the Novalink Head of Service Continuity stated on the Arcadia incident bridge that the root cause was a failed database failover at the Frankfurt hosting provider and that recovery was expected by 16:00. This written update says the cause is under investigation.\n\n" +
      "How the apparent conflict is to be treated. Two readings are available and Arcadia cannot yet distinguish between them. Reading one: a supplier's written client communications policy commonly withholds a root cause until it is confirmed by engineering, and a verbal statement on a bridge to a single client is a different act from a published statement to all clients. On that reading both statements are honest and neither is wrong. Reading two: the verbal statement was premature or the written statement is incomplete. The product must present both readings and must not resolve this prematurely.\n\n" +
      "Second observation, which is substantive rather than procedural. The monitoring and alerting pipeline is operated by subprocessor TP-0042.3 Polaris Telemetrix s.r.o. in Brno. That subprocessor performs incident detection for all Novalink services. If the detection pipeline was degraded, the supplier's own ability to detect and notify was impaired, which is directly relevant to the notification timing question raised against CTR-2023-0117-A5 clause 5.3. Referred to Group Third-Party Risk Management at 15:05.",
    summary:
      "The portal update at 15:02 raising severity to P2, stating that the cause is under investigation seven minutes after a root cause was named verbally, and disclosing degradation of the monitoring and alerting pipeline operated by a subprocessor.",
    relatedObjectIds: [
      "INC-2026-0412",
      "NSN-2026-0887",
      "TP-0042",
      "TP-0042.3",
      "CTR-2023-0117-A5",
      "MSN-2026-0218",
    ],
    pageCount: 1,
    fromSharedEvent: true,
    revealedAtMoment: "15:02",
  },

  /*
   * The day's only genuine deadline, and the one queue with no fallback. The
   * arithmetic in this export is what forces a decision at 15:07 on facts
   * that will not be available until 15:51.
   */
  {
    id: "EVD-2026-41882",
    runId: DEFAULT_RUN_ID,
    reference: "QRY-2026-88112",
    title:
      "ARC-CH payment queue export from SYS-0015, queued SIC and euroSIC instructions as at 15:09",
    titleDe:
      "Export der Zahlungswarteschlange ARC-CH aus SYS-0015, Stand 15:09",
    sourceType: "transaction-log",
    sourceSystem: "SYS-0015 euroSIC Adapter",
    authorLabel: "Sibylle Graf, Resilience Officer, Arcadia Bank Schweiz AG",
    authorUserId: "P-015",
    documentDate: "2026-10-06",
    ingestedAt: at("15:09"),
    entityIds: [ENTITY_CH],
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "PAYMENT QUEUE EXPORT. Source SYS-0015 euroSIC Adapter, service SVC-0042-05. Entity partition ARC-CH. Export QRY-2026-88112 taken at 15:09 on 06.10.2026 by the Resilience Officer, Arcadia Bank Schweiz AG.\n\n" +
      "Position. SIC and euroSIC submission through SVC-0042-05 has been queued since 13:47. No instruction has been submitted since that time and no acknowledgement has been received.\n\n" +
      "Queue contents. 1,842 instructions. Total value CHF 61,304,110. Of that total, CHF 18,712,400 carries same-day value and is subject to the 16:00 CET same-day cut-off. The remaining CHF 42,591,710 carries forward value dates and is not at risk today.\n\n" +
      "Breakdown of the same-day tranche. 611 instructions. Largest single instruction CHF 2,140,000. Instructions above CHF 1,000,000: 7, totalling CHF 9,480,000. The tranche is concentrated: seven instructions carry just over half its value.\n\n" +
      "Route position. Arcadia Bank Schweiz AG is not a direct SIC participant and holds no secondary electronic route. Q-REPAIR-CH was not moved to fallback mode at 14:12 because there is no fallback clearing route to move it to. The only available means of submission is manual preparation of a correspondent file for Helvetia Clearing Partner AG under runbook RB-PAY-011, which states a preparation lead time of 45 minutes.\n\n" +
      "Tolerance position computed at 15:09. Impact tolerance ITOL-0004-03 sets a maximum tolerable disruption of 2 hours for CHF and euroSIC submission, and requires submission to complete before the 16:00 CET same-day cut-off. Queueing began at 13:47. Elapsed at 15:09 is 1 hour 22 minutes. Remaining tolerance on the elapsed time measure: 38 minutes. Time to the 16:00 cut-off: 51 minutes. Preparation lead time for the manual route: 45 minutes.\n\n" +
      "The arithmetic stated plainly. A decision to invoke the manual route must be taken by 15:15 if the same-day tranche is to be submitted before the cut-off. That is six minutes from the time of this export. Novalink's current estimate of recovery, given verbally at 14:55, is 16:00, which is the cut-off itself and therefore cannot be relied upon for a same-day submission. The decision cannot wait for the cause to be known.\n\n" +
      "Note on the two measures. ITOL-0004-03 is expressed with two measures, elapsed disruption time and submission completion against the cut-off, and its approval record states no order of precedence between them. If the manual route is invoked now and submission completes at approximately 15:58, the cut-off measure will not be breached and the elapsed measure will be. The entity will not be able to state whether its tolerance was breached. This is recorded now, before the decision, so that the position is not constructed afterwards.\n\n" +
      "Illustrative regulatory context, not legal advice. Considered under FINMA operational risk and resilience context for Arcadia Bank Schweiz AG.",
    summary:
      "The Swiss queue export at 15:09: 1,842 instructions queued since 13:47, of which CHF 18.7m carries same-day value, with 38 minutes of tolerance left, 51 minutes to the cut-off and a manual route that needs 45 of them.",
    relatedObjectIds: [
      "INC-2026-0412",
      "ITOL-0004-03",
      "SVC-0042-05",
      "SYS-0015",
      "RB-PAY-011",
      "IBS-0004",
      "DEC-2026-0776",
      "MSN-2026-0219",
      "P-015",
    ],
    pageCount: 2,
    fromSharedEvent: true,
    revealedAtMoment: "15:09",
  },

  /*
   * The legal determination that makes the appendix divergence actionable
   * without overstating it. Note how carefully it distinguishes the notice
   * question, which is arguable, from the fourth-party question, which is a
   * drafting gap Arcadia signed.
   */
  {
    id: "EVD-2026-41901",
    runId: DEFAULT_RUN_ID,
    reference: "LEG-OP-2026-0118",
    title:
      "Group Legal opinion on the binding subprocessor appendix version and the sufficiency of portal publication as notice",
    titleDe:
      "Rechtsgutachten Konzernrecht zur bindenden Fassung der Anlage und zur Wirksamkeit der Portalveroeffentlichung als Mitteilung",
    sourceType: "contract-clause",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Dr. Anja Weiss, Outsourcing Counsel, Group Legal",
    authorUserId: "P-016",
    documentDate: "2026-10-06",
    ingestedAt: at("15:23"),
    entityIds: ALL_ENTITIES,
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "GROUP LEGAL OPINION LEG-OP-2026-0118. Prepared at the request of Group Third-Party Risk Management on 21.09.2026 and completed 06.10.2026 at 15:23, brought forward at the requester's urgent request following the disclosure of the Amsterdam processing region on the incident bridge.\n\n" +
      "Questions put. First, which document governs the list of subprocessors permitted to support the services under CTR-2023-0117: the executed Appendix A3 version 4.2 or the Novalink subprocessor register version 6.1. Second, whether publication of the register on the Novalink client portal constitutes notice for the purposes of Appendix A3 clause 3.4. Third, how the position of the fourth party Aurora Object Storage Ltd should be characterised.\n\n" +
      "Documents reviewed. CTR-2023-0117 master agreement and the accession schedules for Arcadia Bank Oesterreich AG and Arcadia Bank Schweiz AG. Appendix A3 version 4.2 as executed. Appendix A1 version 3.0. Appendix A2 version 2.1, which names the Bank contract manager. Appendix A7 version 2.2. The Novalink subprocessor register version 6.1. The Novalink questionnaire responses for domain 4 dated 29.09.2026. The reconciliation working sheet of 21.09.2026. The contract repository search result.\n\n" +
      "Opinion on question 1. Appendix A3 version 4.2 is the binding instrument. It is an executed appendix to the master agreement and the master agreement provides that appendices are varied only in writing signed by both parties. The Novalink register is a unilateral document produced by one party. It records what Novalink has done; it does not vary what Novalink is permitted to do. Clause 3.5 is directly on the point: it obliges Novalink to maintain a register and states in terms that maintenance of the register does not discharge the notice obligation in clause 3.4. The parties therefore expressly contemplated the existence of a register and expressly declined to give it contractual effect.\n\n" +
      "Opinion on question 2. On the drafting as it stands, portal publication does not constitute notice. Clause 3.4 requires notice in writing to the Bank contract manager named in Appendix A2, and requires it not less than sixty days before the change. Publication to a portal available to all clients is not addressed by the clause, is not directed to a named recipient, and on the facts was not given sixty days in advance of the Meridian engagement of 01.05.2026. Clause 3.5 reinforces the conclusion.\n\n" +
      "Qualification on question 2, which must be read with the opinion. This conclusion is not free from argument. Novalink's position, that it has treated portal publication as notice since the portal was introduced and that this has been its consistent practice with all clients, would if established go to whether a course of dealing has modified the parties' understanding of the clause. Arcadia has consulted the portal on its own initiative on at least one occasion during the current reassessment and has not previously objected to the practice. Those facts are capable of supporting an argument Arcadia would need to meet. The prudent characterisation is therefore that Arcadia has a good position and not a certain one, and that the matter is a live contractual dispute rather than a settled breach.\n\n" +
      "Opinion on question 3. The position of Aurora Object Storage Ltd is a drafting gap rather than a breach. Appendix A3 clause 3.4 obliges notice of changes to subprocessors. It is silent as to subcontractors engaged by those subprocessors. There is no obligation that Novalink has failed to perform in respect of Aurora, because no obligation was drafted. Arcadia executed the appendix in that form. This should be presented to the committee as a gap in Arcadia's own contractual protection and not as supplier misconduct.\n\n" +
      "Recommended route. First, put Novalink on formal notice under clause 3.4 in respect of the Meridian engagement and the Amsterdam processing region, stating Arcadia's position and reserving its rights, rather than asserting breach. Second, open a contract variation to Appendix A3 to address fourth parties expressly, to name the notice mechanism, and to provide for processing locations to be stated per subprocessor. Third, do not treat the reassessment as closeable while the notice question is open. Fourth, note that the supervisory and audit access right at Appendix A4 clause 2.5 in respect of Arcadia Bank Schweiz AG extends by its terms to a subprocessor located outside Switzerland, and that Arcadia should ask Novalink to confirm it has been procured from Meridian.\n\n" +
      "Privilege. This opinion is prepared for Arcadia's internal purposes. It is not to be shared with Novalink.\n\n" +
      "Illustrative regulatory context, not legal advice. Subcontracting considerations for the European Union entities and Swiss outsourcing and data access considerations for Arcadia Bank Schweiz AG are assessed separately under their own frameworks and are addressed in REG-2026-0031 and REG-2026-0088 respectively.",
    summary:
      "Group Legal concludes that the executed appendix binds and that portal publication is not notice on the drafting, while stating plainly that Novalink's course of dealing argument gives Arcadia a good position rather than a certain one, and that the fourth-party silence is a gap Arcadia signed.",
    relatedObjectIds: [
      "CTR-2023-0117",
      "CTR-2023-0117-A3",
      "CTR-2023-0117-A4",
      "CTR-2023-0117-A7",
      "TP-0042",
      "TP-0042.2",
      "TP-0042.4",
      "TP-0042.3-F1",
      "MSN-2026-0221",
      "MSN-2026-0191",
      "REG-2026-0031",
      "REG-2026-0088",
      "P-016",
    ],
    pageCount: 7,
    fromSharedEvent: true,
    revealedAtMoment: "15:23",
  },

  /*
   * The document that resolves the central contradiction. It disproves the
   * backfill claim, vindicates the control owner on her team's behaviour,
   * and makes the rule's provenance visible: a supplier template applied
   * during a release whose notes did not disclose that a client control gate
   * would be waived.
   */
  {
    id: "EVD-2026-41905",
    runId: DEFAULT_RUN_ID,
    reference: "RDCFG-ARCADIA-PROD-20261006",
    title:
      "RepairDesk tenant configuration export for arcadia-prod, including rule RD-RULE-0031",
    titleDe:
      "Export der RepairDesk-Mandantenkonfiguration arcadia-prod, einschliesslich Regel RD-RULE-0031",
    sourceType: "telemetry-extract",
    sourceSystem: "SYS-0014 Novalink RepairDesk",
    authorLabel: "Novalink Payment Services GmbH, Engineering, on request under Appendix A4 clause 2.1",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("15:38"),
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "TENANT CONFIGURATION EXPORT. System SYS-0014 Novalink RepairDesk. Tenant arcadia-prod. Exported by Novalink Engineering and delivered to Arcadia at 15:38 on 06.10.2026, on formal request made at 14:58 under CTR-2023-0117-A4 clause 2.1, which provides for a four hour turnaround for incident purposes.\n\n" +
      "Section 1. Rule definition as held in the tenant.\n\n" +
      "RULE RD-RULE-0031, manual override secondary review enforcement. Evaluated on the transition OVERRIDE_PROPOSED. If the override reason equals OVR-C, and the fallback route mode equals ACTIVE, and the value amount is less than 250000, and the value currency is in the set containing EUR, then the secondary review required flag is set to false, the review waiver code is set to BCP-THROUGHPUT, and the audit note is set to secondary review waived under business continuity throughput provision. Otherwise the secondary review required flag is set to true.\n\n" +
      "Section 2. Rule metadata as held in the tenant. Introduced: RepairDesk release 8.3. Deployed to tenant arcadia-prod: 11.11.2024. Source: Novalink standard configuration template BCP-THROUGHPUT-v2. Applied by: Novalink release account, during the release. Last modified: 11.11.2024. Modified by: Novalink release account. Client configurable: yes. Editable by: any identity holding the Arcadia tenant administrator role.\n\n" +
      "Section 3. Statement provided by Novalink Engineering with the export, recorded as the supplier's statement. The rule was applied from the standard configuration template as part of release 8.3 and was not requested by Arcadia. The rule sits in the client tenant configuration and can be edited or removed by an Arcadia tenant administrator at any time without a Novalink change request. On the separate question asked by Arcadia at 14:58: reviewer identity is written synchronously at the moment a secondary review is submitted. RepairDesk does not backfill reviewer identity, at the end of a batch cycle or at any other time. Where the secondaryReviewerId field is null, no review was submitted.\n\n" +
      "Section 4. What this export establishes as verified fact. The rule exists in the Arcadia production tenant with the condition set out in section 1. It entered the tenant on 11.11.2024 from a Novalink template during a Novalink release. It is client configurable. Reviewer identity is written synchronously and there is no backfill mechanism.\n\n" +
      "Section 5. Consequences that follow immediately. First, the mechanism claim made on the incident bridge at 14:41, that RepairDesk backfills reviewer identities at the end of the batch cycle, is not correct. Second, the query result in EVD-2026-41878 is reclassified from a telemetry inference to a verified fact: the 96 payments were released without secondary review. Third, the control description CTL-PAY-014 version 4.1, which states that the requirement applies to all overrides without exception, does not describe the control as the system operates it, and has not since 11.11.2024. Fourth, exception EXC-TST-2026-0318-04 in control test TST-2026-0318 is this same rule, found on 27.08.2026, reported on 25.09.2026 and closed with the root cause recorded as system configuration.\n\n" +
      "Section 6. What this export does not establish. It does not establish who at Arcadia, if anyone, was told in November 2024 that a control gate would be waived. That question is answered, so far as it can be, by the change record and release notes at EVD-2026-41907. It does not establish whether the rule is appropriate, which is a judgement for the control owner and the process owner. It does not establish where accountability sits, which is a matter for the committee.\n\n" +
      "Section 7. Integrity. Delivered as a signed export from the Novalink configuration management system. Content hash recorded in SYS-0032 at 15:39. Retained as the authoritative record of the tenant configuration as at 06.10.2026 15:38.",
    summary:
      "The tenant configuration export that resolves the day's central contradiction. It confirms the waiver rule, dates it to a supplier template applied on 11.11.2024, confirms Arcadia can edit it, and states that reviewer identity is written synchronously with no backfill.",
    relatedObjectIds: [
      "RD-RULE-0031",
      "CTL-PAY-014",
      "CHG-2024-5512",
      "TST-2026-0318",
      "EXC-TST-2026-0318-04",
      "MSN-2026-0203",
      "MSN-2026-0215",
      "MSN-2026-0220",
      "TP-0042",
      "RSK-0211",
      "SYS-0014",
      "CTR-2023-0117-A4",
      "INC-2026-0412",
    ],
    pageCount: 5,
    fromSharedEvent: true,
    revealedAtMoment: "15:38",
  },

  /*
   * 118 firings over 23 months, and nobody asked. This is the document that
   * turns the event from an incident into a population, and it is the basis
   * for extending the next control test back to November 2024.
   */
  {
    id: "EVD-2026-41906",
    runId: DEFAULT_RUN_ID,
    reference: "QRY-2026-88131",
    title:
      "RD-RULE-0031 firing history, 11.11.2024 to 06.10.2026",
    titleDe:
      "Ausloesehistorie der Regel RD-RULE-0031, 11.11.2024 bis 06.10.2026",
    sourceType: "transaction-log",
    sourceSystem: "SYS-0014 Novalink RepairDesk",
    authorLabel: "Novalink RepairDesk rule evaluation log, extracted on Arcadia request",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("15:38"),
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "RULE FIRING HISTORY. Extract QRY-2026-88131. Source SYS-0014 Novalink RepairDesk rule evaluation log, tenant arcadia-prod. Delivered with the tenant configuration export at 15:38 on 06.10.2026.\n\n" +
      "Query. All evaluations of rule RD-RULE-0031 returning a result of waived, between the rule's deployment on 11.11.2024 and 06.10.2026 15:38.\n\n" +
      "Result. 118 firings.\n\n" +
      "Distribution. 96 firings on 06.10.2026, all between 14:12:41 and 14:26:00. 22 firings before 06.10.2026, distributed across 7 separate periods in which fallbackRouteMode was ACTIVE, those 7 periods totalling 9 hours 40 minutes of fallback operation. 96 plus 22 equals 118.\n\n" +
      "Why the firing count is low relative to the rule's age. The rule evaluates on every OVERRIDE_PROPOSED transition, but the second condition requires fallbackRouteMode to be ACTIVE. Fallback operation is rare. Across the 23 months from deployment to the day before the event, fallback mode was active for 9 hours 40 minutes in total. The rule was therefore dormant for almost all of its life, and its effect scaled directly with the duration of fallback operation.\n\n" +
      "Fields recorded per firing. Evaluation timestamp. Override identifier. Entity partition. Queue. Override reason code. Value amount and currency. The four condition evaluations and their individual outcomes. The waiver code written. The audit note written. The resulting state transition.\n\n" +
      "Identified prior firing of particular relevance. One of the 22 prior firings is the override of 27.08.2026 for Arcadia Bank AG, value EUR 46,900, which was selected into the sample for control test TST-2026-0318 and recorded as exception EXC-TST-2026-0318-04. The rule evaluation trace for that firing is identical in structure to the 96 firings of 06.10.2026.\n\n" +
      "Value of the pre-event population. The 22 prior firings carry a combined value of EUR 1,912,400, all individually below EUR 250,000 by the operation of the rule's third condition.\n\n" +
      "What this history establishes. The event of 06.10.2026 is not the first operation of this rule. It is the largest operation of a rule that has been operating whenever the fallback route was active since 11.11.2024. There is therefore a population of 118 releases, not 96, in which the secondary review requirement was waived by configuration, and the pre-event 22 have never been examined.\n\n" +
      "Consequence recorded at 15:45. The next control test of CTL-PAY-014 must extend its population to every fallback operating period since 11.11.2024 and must cover all 118 firings, rather than sampling a period. Recorded as Massnahme MSN-2026-0220, owner Group Control Assurance, due 24.11.2026.\n\n" +
      "Integrity. Delivered as part of the signed supplier export. Content hash recorded in SYS-0032 at 15:39.",
    summary:
      "The firing history of the waiver rule: 118 firings since November 2024, of which 96 on the scenario day and 22 across seven earlier fallback periods, one of them the exception found in the September control test.",
    relatedObjectIds: [
      "RD-RULE-0031",
      "CTL-PAY-014",
      "TST-2026-0318",
      "EXC-TST-2026-0318-04",
      "MSN-2026-0220",
      "MSN-2026-0215",
      "ITOL-0004-04",
      "RSK-0211",
      "SYS-0014",
    ],
    pageCount: 3,
    fromSharedEvent: true,
    revealedAtMoment: "15:38",
  },

  /*
   * Filed as a process artefact for the same reason as CHG-2026-7741. The
   * creation date is November 2024 and the retrieval time is today, and the
   * product must show both: having had this document for two years is a
   * different finding from obtaining it this afternoon.
   */
  {
    id: "EVD-2026-41907",
    runId: DEFAULT_RUN_ID,
    reference: "CHG-2024-5512",
    title:
      "Arcadia change record CHG-2024-5512 with the attached Novalink release notes for RepairDesk release 8.3",
    titleDe:
      "Arcadia Aenderung CHG-2024-5512 mit den beigefuegten Novalink Versionshinweisen zu RepairDesk 8.3",
    sourceType: "process-map",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Arcadia Bank AG Technology change archive, retrieved by Payments Technology",
    authorUserId: null,
    documentDate: "2024-11-11",
    ingestedAt: at("15:40"),
    entityIds: ALL_ENTITIES,
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "approved-record",
    body:
      "CHANGE RECORD CHG-2024-5512. Created 28.10.2024. Implemented 11.11.2024. Closed 13.11.2024. Retrieved from the Arcadia Technology change archive on 06.10.2026 at 15:40. Creation date and retrieval date are both recorded, because they answer different questions.\n\n" +
      "Change title. Accept Novalink RepairDesk release 8.3 into the Arcadia production tenant.\n\n" +
      "Change type. Supplier release acceptance. Standard change, pre-approved category.\n\n" +
      "Requester. Payments Technology, application management for SYS-0014.\n\n" +
      "Approval route as recorded. Reviewed by the Payments Technology change coordinator on 04.11.2024. Approved by the Technology Change Advisory Board on 06.11.2024 under the standard change category for supplier releases. Approval basis recorded: supplier release notes reviewed, no Arcadia configuration change required, no interface change, no data migration.\n\n" +
      "Approvers listed. Payments Technology change coordinator. Technology Change Advisory Board chair. Novalink service delivery manager as the supplier representative.\n\n" +
      "Not in the approval route. No control owner. No process owner. No representative of Group Control Assurance, Group Operational Risk or Group Third-Party Risk Management. The standard change category for supplier releases does not require any of them, and none was consulted.\n\n" +
      "Risk assessment field as completed. Low. Supplier maintenance release. No Arcadia development. Rollback available by tenant restore.\n\n" +
      "Attachment, Novalink release notes for RepairDesk release 8.3, quoted verbatim in the parts material to this record.\n\n" +
      "Release 8.3 highlights. Performance improvements to queue rendering at high queue depths. Continuity throughput improvements for fallback routing. Accessibility improvements to the review screen. Defect corrections, see the defect schedule. Configuration templates updated to the current standard set.\n\n" +
      "Continuity throughput improvements for fallback routing. Release 8.3 includes refinements to the handling of override workflow during fallback routing operation, improving throughput where an alternative clearing route is in use. Tenants on the standard configuration template set will receive the updated template as part of the release.\n\n" +
      "End of the quoted release notes. The full notes run to eleven pages and are attached in the archive. No part of the notes names a control, a review requirement, a four-eyes provision, a waiver, or the rule identifier RD-RULE-0031. The phrase continuity throughput improvements for fallback routing is the whole of the disclosure.\n\n" +
      "Assessment recorded on retrieval, 06.10.2026 15:44, by Group Control Assurance with Payments Technology. Three findings follow from this record. First, Arcadia approved a release that introduced a rule waiving a key control gate, and the approval was properly given under the process as it stands, because the process does not require a control owner to review a supplier release. Second, the supplier's release notes did not disclose that a client control gate would be waived, and a reader of those notes could not have discovered it. Third, the phrase that did appear, continuity throughput improvements for fallback routing, is on reflection an accurate description of what the change did, and it is accurate in a way that is only legible after the fact.\n\n" +
      "Note on accountability. This record does not settle where accountability sits. It establishes that Novalink did not disclose the control effect, that Arcadia approved the release without reviewing its control effects, and that Arcadia did not subsequently update the control description. Those are three separate failures with three different owners and the committee will have to address all three.",
    summary:
      "The 2024 change record that accepted the RepairDesk release carrying the waiver rule. The supplier's release notes described it only as continuity throughput improvements for fallback routing, and no control owner or risk function was in the approval route.",
    relatedObjectIds: [
      "CHG-2024-5512",
      "RD-RULE-0031",
      "CTL-PAY-014",
      "SYS-0014",
      "TP-0042",
      "MSN-2026-0215",
      "MSN-2026-0203",
      "TST-2026-0318",
      "AG-CMT-NFR-2026-10-03",
    ],
    pageCount: 4,
    fromSharedEvent: true,
    revealedAtMoment: "15:40",
  },

  /*
   * The subprocessor's own account, and the document that resolves the
   * second conflict. The substantive finding is neither statement's content
   * but the 34 minute detection lag caused by a monitoring subprocessor
   * pinned to the region that failed.
   */
  {
    id: "EVD-2026-41911",
    runId: DEFAULT_RUN_ID,
    reference: "RHEINSTACK-INC-2026-0884",
    title:
      "Rheinstack GmbH incident summary for the Frankfurt region quorum loss of 06.10.2026, forwarded by Novalink",
    titleDe:
      "Vorfallzusammenfassung Rheinstack GmbH zum Quorumsverlust der Region Frankfurt, weitergeleitet durch Novalink",
    sourceType: "incident-notification",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Rheinstack GmbH, Platform Operations, forwarded by Novalink Service Continuity",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("15:51"),
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "SUBPROCESSOR INCIDENT SUMMARY. Rheinstack GmbH, Platform Operations. Incident RHEINSTACK-INC-2026-0884. Issued to Novalink Payment Services GmbH at 15:44 on 06.10.2026 and forwarded to Arcadia at 15:51. This is the subprocessor's own account, provided through the supplier, and is recorded as the subprocessor's statement.\n\n" +
      "Chronology as given. 13:24, a storage firmware update was applied to the primary storage array serving the Frankfurt region database cluster, within a maintenance window scheduled internally by Rheinstack platform operations. 13:31, the primary database cluster lost quorum. Two of three cluster members became unreachable following the firmware application. 13:33, automatic failover to the Amsterdam region initiated. 13:44, failover completed successfully for NOVA-GATE write traffic. No data loss. 14:57, the monitoring and alerting connection was corrected. 15:32, the Frankfurt cluster was restored to quorum and returned to standby. 15:41, write traffic returned to the Frankfurt region.\n\n" +
      "Root cause as given. The storage firmware update introduced an incompatibility with the cluster membership heartbeat configuration in use on the Frankfurt array. The update had been validated in the Rheinstack test environment, which runs a different heartbeat configuration.\n\n" +
      "Secondary finding as given by Rheinstack. The monitoring and alerting pipeline operated by Polaris Telemetrix s.r.o. remained connected to the Frankfurt database endpoint until 14:57. Its connection string was configured statically against the Frankfurt endpoint rather than against the failover alias. The pipeline therefore continued to poll a database that had lost quorum, and it did not follow the failover. Monitoring and alerting for the affected services were consequently degraded between 13:31 and 14:57.\n\n" +
      "Corrective actions as given. The firmware update has been rolled back on the Frankfurt array. The heartbeat configuration incompatibility has been reported to the storage vendor. The Polaris connection string has been changed to use the failover alias. The maintenance window process is under review.\n\n" +
      "Arcadia receipt assessment recorded at 15:56 by Group Third-Party Risk Management with Group Operational Resilience.\n\n" +
      "Finding 1, detection and notification lag. Quorum was lost at 13:31. Arcadia was notified at 14:05:12. That is a lag of 34 minutes. The supplier's own detection capability depends on a monitoring pipeline operated by a subprocessor, and that pipeline was pinned to the region that failed. The supplier could not detect promptly because the thing that detects was part of what broke. This is a resilience finding against TP-0042, a concentration finding about TP-0042.3, and it is the direct explanation of why the thirty minute notification requirement in CTR-2023-0117-A5 clause 5.3 could not be met. Recorded as Massnahme MSN-2026-0218.\n\n" +
      "Finding 2, unnotified change at a subprocessor. The firmware update applied at 13:24 was a change made by a subprocessor to infrastructure supporting a service that supports a critical or important function for the European Union entities and a significant business process for the Swiss entity. It was applied during an Arcadia business day. CTR-2023-0117-A1 clause 7.2 requires not less than ten business days prior written notice of any change that affects or may reasonably be expected to affect the availability of such a service, including a change made by or at a subprocessor. No notice was received. Recorded as Massnahme MSN-2026-0217.\n\n" +
      "Finding 3, the Amsterdam region. The account confirms that the Amsterdam region carried Arcadia payment traffic from 13:44 to 15:41. Appendix A3 version 4.2 lists Rheinstack GmbH with the Frankfurt processing region only. Arcadia payment data was processed in a location the binding appendix does not permit. This is the divergence identified on 21.09.2026 and it is now evidenced by the supplier's own account of an incident. Referred to MSN-2026-0221.\n\n" +
      "Note on the two supplier statements. The statement made verbally at 14:55 was materially correct and incomplete: there was a failed failover at a hosting subprocessor and Amsterdam did take the traffic. It did not mention the monitoring pipeline, most probably because the speaker's own monitoring was the thing that was broken. The written portal update at 15:02 saying the cause was under investigation was a communications policy default and not a contradiction. Both statements are assessed as honest.\n\n" +
      "Illustrative regulatory context, not legal advice.",
    summary:
      "The subprocessor's own incident account. A firmware update at 13:24 caused quorum loss at 13:31, failover to Amsterdam completed at 13:44, and the monitoring pipeline stayed pinned to the failed region until 14:57, which explains the 34 minute notification lag.",
    relatedObjectIds: [
      "INC-2026-0412",
      "TP-0042",
      "TP-0042.2",
      "TP-0042.3",
      "CTR-2023-0117-A1",
      "CTR-2023-0117-A3",
      "CTR-2023-0117-A5",
      "MSN-2026-0217",
      "MSN-2026-0218",
      "MSN-2026-0221",
      "KRI-RES-005",
      "RSK-0184",
    ],
    pageCount: 4,
    fromSharedEvent: true,
    revealedAtMoment: "15:51",
  },

  /*
   * Two minutes inside the cut-off and eleven minutes outside the elapsed
   * measure. The most valuable finding of the day and the least dramatic:
   * the entity cannot say whether its own tolerance was breached.
   */
  {
    id: "EVD-2026-41918",
    runId: DEFAULT_RUN_ID,
    reference: "CONF-2026-9931",
    title:
      "Correspondent submission confirmation CONF-2026-9931 from Helvetia Clearing Partner AG",
    titleDe:
      "Einlieferungsbestaetigung CONF-2026-9931 der Helvetia Clearing Partner AG",
    sourceType: "transaction-log",
    sourceSystem: "SYS-0011 Arcadia Payment Hub",
    authorLabel: "Helvetia Clearing Partner AG, correspondent confirmation, received by ARC-CH Treasury",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("16:04"),
    entityIds: [ENTITY_CH],
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "CORRESPONDENT CONFIRMATION CONF-2026-9931. Helvetia Clearing Partner AG. Received by Arcadia Bank Schweiz AG Treasury at 16:04 on 06.10.2026 and recorded against SYS-0011.\n\n" +
      "Submission. File transmitted by Arcadia Bank Schweiz AG at 15:52. Acknowledged as received by the correspondent at 15:54. Accepted for same-day value at 15:58, being two minutes before the 16:00 CET same-day cut-off.\n\n" +
      "Result. 1,840 of 1,842 instructions accepted. Value accepted CHF 61,289,910. Two instructions rejected, combined value CHF 14,200, both rejected on format grounds arising from a structured reference field that the correspondent's specification formats differently from SYS-0015. Both rejected instructions have been rolled to value date 07.10.2026.\n\n" +
      "Reconciliation. 1,840 accepted plus 2 rejected equals 1,842 submitted, which equals the queue count in the 15:09 export. CHF 61,289,910 accepted plus CHF 14,200 rejected equals CHF 61,304,110, which equals the queue value in the 15:09 export.\n\n" +
      "Preparation timing. The decision to invoke runbook RB-PAY-011 was taken at 15:07 by the Resilience Officer, Arcadia Bank Schweiz AG with the authority of the Arcadia Bank Schweiz AG Chief Operating Officer. Preparation began immediately and transmission occurred at 15:52. Elapsed preparation time 45 minutes, which matches the runbook lead time exactly. The runbook figure, established by desktop walkthrough in November 2025 and never validated live, proved accurate.\n\n" +
      "The impact tolerance question, stated precisely. Impact tolerance ITOL-0004-03 has two measures.\n\n" +
      "Measure 1, submission completion against the cut-off. Submission was accepted at 15:58, two minutes before the 16:00 cut-off. On this measure the tolerance was not breached.\n\n" +
      "Measure 2, elapsed disruption time against a 2 hour maximum. Queueing began at 13:47 and submission completed at 15:58. Elapsed 2 hours 11 minutes. On this measure the tolerance was breached by 11 minutes.\n\n" +
      "Consequence. Arcadia Bank Schweiz AG cannot state whether its impact tolerance was breached, because the tolerance is defined with two measures and its approval record states no order of precedence between them. This is a definitional defect in the tolerance itself and not an operational failure. The operational response worked: the decision was taken in time, the preparation met its stated lead time, and 99.9 percent of the queued value reached the clearing system on the same day. The reporting cannot describe the outcome.\n\n" +
      "Position against the other tolerances. Two instructions worth CHF 14,200 were delayed beyond their value-date cut-off. Against ITOL-0004-02, which permits no more than 0.5 percent of daily corporate payment value to be delayed beyond its value-date cut-off, that is 0.023 percent of daily Arcadia Bank Schweiz AG corporate payment value and is well inside the tolerance.\n\n" +
      "Referral. The two-measure question is referred to the Group NFR Committee at agenda item AG-CMT-NFR-2026-10-08 with a recommendation, and is recorded as Massnahme MSN-2026-0219. It is not resolved today. A determination of precedence is a matter for the approving body and the Incident and Resilience Lead does not have authority to make it.\n\n" +
      "Illustrative regulatory context, not legal advice. Considered under FINMA operational risk and resilience context for Arcadia Bank Schweiz AG.",
    summary:
      "The correspondent confirmation. 1,840 of 1,842 instructions were accepted two minutes before the cut-off, and the two-measure tolerance gives two different answers: not breached on the cut-off measure, breached by eleven minutes on elapsed time.",
    relatedObjectIds: [
      "INC-2026-0412",
      "ITOL-0004-03",
      "ITOL-0004-02",
      "RB-PAY-011",
      "SYS-0015",
      "SVC-0042-05",
      "DEC-2026-0776",
      "MSN-2026-0219",
      "AG-CMT-NFR-2026-10-08",
      "REG-2026-0104",
      "P-015",
    ],
    pageCount: 2,
    fromSharedEvent: true,
    revealedAtMoment: "16:04",
  },

  {
    id: "EVD-2026-41921",
    runId: DEFAULT_RUN_ID,
    reference: "NSN-2026-0887-U2",
    title: "Novalink client status portal update NSN-2026-0887-U2, restoration confirmed",
    titleDe: "Novalink Statusportal, Aktualisierung NSN-2026-0887-U2, Wiederherstellung bestaetigt",
    sourceType: "incident-notification",
    sourceSystem: "Novalink client status portal",
    authorLabel: "Novalink Payment Services GmbH, client status portal",
    authorUserId: null,
    documentDate: "2026-10-06",
    ingestedAt: at("16:12"),
    entityIds: ALL_ENTITIES,
    dataClassification: "confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "PORTAL UPDATE AS CAPTURED. Novalink client status portal, incident NSN-2026-0887, update 2. Captured by Arcadia at 16:12 on 06.10.2026.\n\n" +
      "Content, verbatim. NOVA-GATE submission latency returned to normal parameters at 15:41. Full service across all affected components confirmed at 16:08. The monitoring and alerting pipeline was restored at 14:57. Root cause has been identified at an infrastructure subprocessor and is described in the incident report. Novalink will provide a written incident report to affected clients within five business days, by 13.10.2026. Novalink apologises for the disruption.\n\n" +
      "End of update.\n\n" +
      "Arcadia record. Fallback route mode was set to INACTIVE for Q-REPAIR-DE and Q-REPAIR-AT at 16:08 on confirmation of full service, and change record CHG-2026-7741 was closed. The incident record INC-2026-0412 remains open pending the supplier's written report.\n\n" +
      "Timing consequence recorded by the NFR Portfolio Lead at 16:20. The papers deadline for CMT-NFR-2026-10 is 08.10.2026 at 12:00 and late papers cannot carry a decision. The supplier's root-cause report is due 13.10.2026, which is the morning of the meeting. The committee paper must therefore be written on 07.10.2026 or 08.10.2026 on the facts verified by then, and it must be structured so that the arrival of the supplier report on the morning of the meeting cannot invalidate the decision the committee is asked to take.\n\n" +
      "How that is to be done, as recorded. The paper separates what is verified from what is a supplier statement and what is an inference, states for each element whether the supplier report could change it, and asks the committee for decisions that do not depend on the elements the report could change. The rule exists and Arcadia can remove it: that is verified and the supplier report cannot change it. Ninety-six payments were released without review: verified. One payment was misrouted: verified. Where accountability sits between the supplier's non-disclosure and Arcadia's approval process: partly dependent on the report, and therefore framed as a position to be confirmed rather than a decision to be taken. Recorded as DEC-2026-0781 and agenda item AG-CMT-NFR-2026-10-10.",
    summary:
      "The supplier's restoration update. Latency normalised at 15:41 and full service was confirmed at 16:08, with a written incident report promised by 13.10.2026, which is the morning of the committee whose papers are due on 08.10.2026.",
    relatedObjectIds: [
      "INC-2026-0412",
      "NSN-2026-0887",
      "TP-0042",
      "CMT-NFR-2026-10",
      "AG-CMT-NFR-2026-10-10",
      "DEC-2026-0781",
      "CHG-2026-7741",
      "CTR-2023-0117-A5",
    ],
    pageCount: 1,
    fromSharedEvent: true,
    revealedAtMoment: "16:12",
  },

  /*
   * The moment the day stops being about documentation. One confirmed
   * misrouted payment means RSK-0211 has materialised, and the first line
   * argument that rested on the absence of loss is no longer available.
   */
  {
    id: "EVD-2026-41924",
    runId: DEFAULT_RUN_ID,
    reference: "PEV-2026-0412-01",
    title:
      "Post-event validation of 20 of the 96 unreviewed overrides, sample result",
    titleDe:
      "Nachtraegliche Pruefung von 20 der 96 ungeprueften Ueberschreibungen, Stichprobenergebnis",
    sourceType: "control-test-report",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel:
      "Arcadia Bank AG Payment Repair team under Beatrix Hofmann, at the request of Jakob Steinbacher",
    authorUserId: "P-008",
    documentDate: "2026-10-06",
    ingestedAt: at("16:19"),
    entityIds: EU_ENTITIES,
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "POST-EVENT VALIDATION. Reference PEV-2026-0412-01. Performed 06.10.2026 between 15:50 and 16:17 by the Arcadia Bank AG payment repair team under the direction of the control owner, at the request of Group Control Assurance. Result reported at 16:19.\n\n" +
      "1. Scope. Twenty of the ninety-six override records identified in EVD-2026-41878 as released without secondary review. Selection was made by taking the first twenty records in override identifier order, on the basis that a selection method was needed immediately and this one is reproducible. The sample was not stratified by value and was not stratified by failure reason code.\n\n" +
      "2. Method. For each sampled record, the released instruction was compared against two independent sources: the client's original instruction as received and stored in SYS-0011, and the authoritative client account, mandate and beneficiary static data held in SYS-0017 Client Static Data Master. The comparison covered the beneficiary name, the beneficiary account identifier, the intermediary institution where one is present, the amount, the currency and the value date. The check was performed by an analyst who had not created the override, and each result was confirmed by a second analyst.\n\n" +
      "3. Findings. Nineteen of the twenty released instructions were correctly repaired. The data suppressed or corrected in each case matched the authoritative source and the client instruction.\n\n" +
      "4. One of the twenty was not correctly repaired. Instruction PAY-DE-20261006-448127, Arcadia Bank AG, value EUR 38,400, failure reason code R01, invalid or unreachable IBAN and BIC combination. The override created at 14:21:06 and released at 14:21:08 suppressed the R01 validation and released the instruction with an intermediary institution identifier that does not match the intermediary named in the client's instruction and does not match the intermediary recorded against the beneficiary in SYS-0017. The clearing system accepted the instruction and routed it to the wrong intermediary institution. The client is identified in this record as CLI-DE-00412. The payment is recallable. A recall was initiated at 16:24 and is recorded as EVD-2026-41930.\n\n" +
      "5. Inference. One confirmed error in a sample of twenty, applied to the population of ninety-six, suggests approximately five affected cases in total.\n\n" +
      "6. Why that inference should not be relied upon, stated as required. Twenty of ninety-six is a 21 percent sample, which is substantial, but it was not stratified by value and not stratified by failure reason code. The single error arose on an R01 IBAN and BIC failure, which is the most error-prone repair type in the process and accounts for 31 percent of repair items. A sample stratified by failure reason code would very probably produce a different rate, and the direction of the difference cannot be predicted from twenty cases. The selection method, first twenty by identifier order, correlates with time of creation and therefore with the early part of the queue surge, which may itself not be representative. The honest statement of the position is: one confirmed error, an unknown number of further errors, and a full check of all ninety-six cases required.\n\n" +
      "7. Consequence. The event is no longer a control documentation matter. There is at least one confirmed erroneous payment release, which is the materialisation of RSK-0211 erroneous or unauthorised payment release. The first line residual rating of Medium, which rested in part on the proposition that the test exceptions caused no loss and all payments were confirmed correct, is no longer available on that basis.\n\n" +
      "8. Action. All ninety-six records to be checked against authoritative source data, not a sample, with confirmed errors reported. Recorded as Massnahme MSN-2026-0214, owner the control owner, assured by Group Control Assurance, due 07.10.2026 at 12:00.\n\n" +
      "9. Note recorded by the control owner. The team performed this validation on its own released work within twenty-seven minutes of being asked, and found and reported the error. That is stated here because it is relevant to the operating effectiveness question and it will not otherwise appear anywhere.",
    summary:
      "The post-event sample check. Nineteen of twenty unreviewed releases were correct and one was not: a EUR 38,400 payment routed to the wrong intermediary institution, now under recall, which means the payment release risk has materialised.",
    relatedObjectIds: [
      "INC-2026-0412",
      "RSK-0211",
      "CTL-PAY-014",
      "ITOL-0004-04",
      "RCSA-ARC-DE-PAYOPS-2026-Q4",
      "MSN-2026-0214",
      "RD-RULE-0031",
      "SYS-0017",
      "DEC-2026-0778",
      "DEC-2026-0783",
    ],
    pageCount: 3,
    fromSharedEvent: true,
    revealedAtMoment: "16:19",
  },

  {
    id: "EVD-2026-41930",
    runId: DEFAULT_RUN_ID,
    reference: "RECALL-2026-0114",
    title:
      "Recall instruction for PAY-DE-20261006-448127, misrouted intermediary institution",
    titleDe:
      "Rueckrufauftrag fuer PAY-DE-20261006-448127, falsche Zwischeninstitution",
    sourceType: "transaction-log",
    sourceSystem: "SYS-0011 Arcadia Payment Hub",
    authorLabel: "Arcadia Bank AG Payment Operations, recall desk",
    authorUserId: "P-007",
    documentDate: "2026-10-06",
    ingestedAt: at("16:24"),
    entityIds: [ENTITY_DE],
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "RECALL INSTRUCTION RECALL-2026-0114. Raised in SYS-0011 Arcadia Payment Hub at 16:24 on 06.10.2026.\n\n" +
      "Subject instruction. PAY-DE-20261006-448127. Entity Arcadia Bank AG. Client reference CLI-DE-00412. Value EUR 38,400. Value date 06.10.2026. Original state path: RECEIVED at 14:19, VALIDATING, VALIDATION_FAILED with reason code R01, REPAIR_QUEUED at 14:20, REPAIR_IN_PROGRESS, OVERRIDE_PROPOSED at 14:21:06, RELEASED_WITH_OVERRIDE at 14:21:08, SUBMITTED at 14:21:11, ACKNOWLEDGED at 14:22:47.\n\n" +
      "Defect identified. The intermediary institution identifier carried on the released instruction is not the identifier named in the client's original instruction and is not the identifier recorded against the beneficiary in SYS-0017 Client Static Data Master. The identifier that was carried belongs to a different institution. The R01 validation that would have blocked the combination was among the rules suppressed by the override. The specific identifier values are held on the instruction record in SYS-0011 and in the evidence object attached to this recall and are not reproduced in this summary.\n\n" +
      "Consequence. The clearing system accepted the instruction, the combination being technically valid though incorrect, and routed the payment to the intermediary institution named on the instruction rather than to the one the client intended.\n\n" +
      "Recall action. Recall message transmitted at 16:26 to the receiving intermediary institution requesting return of funds on the grounds of an incorrect intermediary institution identifier, citing the original instruction reference. Status: pending. Expected response window: one to three business days depending on the receiving institution.\n\n" +
      "Client notification. The client relationship manager was informed at 16:29. Client notification to be made on 07.10.2026 morning with a factual account of what occurred, what has been done and what the client should expect. The client has not yet been informed at the time of this record.\n\n" +
      "Exposure. EUR 38,400. The funds are not lost. They are with a financial institution that has no entitlement to them and that is obliged to return them on a valid recall. The exposure is operational and reputational rather than a credit exposure, unless the receiving institution has onward-credited a beneficiary account, which is being established.\n\n" +
      "Control record. This instruction is one of the ninety-six released on 06.10.2026 without secondary review, and is record 5 in the sample rows of EVD-2026-41878. It is the one confirmed error in the twenty-case post-event validation at EVD-2026-41924. Had the secondary review required by CTL-PAY-014 operated, the reviewer would have compared the intermediary institution identifier against the client instruction, which is one of the five checks the control requires.\n\n" +
      "Note recorded by the process owner. This is the sentence that will be read out at the committee. The control that would have caught this did not operate, and it did not operate because a supplier configuration rule decided it was not required, and nobody at Arcadia knew the rule existed.",
    summary:
      "The recall record for the one confirmed misrouted payment: EUR 38,400 released with an intermediary institution identifier matching neither the client instruction nor the static data master, recalled at 16:26 with the client to be informed the next morning.",
    relatedObjectIds: [
      "INC-2026-0412",
      "RSK-0211",
      "CTL-PAY-014",
      "RD-RULE-0031",
      "SYS-0011",
      "SYS-0017",
      "ITOL-0004-04",
      "MSN-2026-0214",
      "PRC-0041",
    ],
    pageCount: 2,
    fromSharedEvent: true,
    revealedAtMoment: "16:24",
  },

  /*
   * The bridge log. Every statement in the day's two conflicts is here with
   * its speaker, its time and its classification, which is what lets the
   * product flag a contradiction against a person without accusing them of
   * anything. Read the 14:41 and 14:48 turns together.
   */
  {
    id: "EVD-2026-41935",
    runId: DEFAULT_RUN_ID,
    reference: "MIN-INC-2026-0412-BRIDGE",
    title:
      "Incident bridge minutes, INC-2026-0412, 14:38 to 16:30, with statement classifications",
    titleDe:
      "Protokoll der Vorfallkonferenz INC-2026-0412, 14:38 bis 16:30, mit Einordnung der Aussagen",
    sourceType: "meeting-minutes",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "Nadia Lehmann, Incident and Resilience Lead, incident manager",
    authorUserId: "P-005",
    documentDate: "2026-10-06",
    ingestedAt: at("16:30"),
    entityIds: ALL_ENTITIES,
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "stakeholder-statement",
    body:
      "INCIDENT BRIDGE MINUTES. Incident INC-2026-0412, Novalink regional service degradation affecting payment validation, repair and Swiss clearing. Bridge opened 14:38, closed 16:30. Incident manager: Incident and Resilience Lead. Recorded and transcribed; statements are quoted as made. Each statement carries one classification, being verified fact, stakeholder statement or telemetry inference, and a classification is never silently changed.\n\n" +
      "Participants. For Arcadia: Incident and Resilience Lead as incident manager; Head of Payment Operations as entity coordinator for the German and Austrian entities; Resilience Officer Arcadia Bank Schweiz AG as entity coordinator for the Swiss entity; Payment Repair Team Lead; acting Duty Manager Payment Operations; Control Assurance Specialist; Third-Party Risk Manager; Category Lead Payments Technology; NFR Portfolio Lead from 15:14. For Novalink from 14:46: Client Service Director; Head of Service Continuity.\n\n" +
      "14:38. Bridge opened. Incident record raised at 14:29 at severity S3. Incident manager summarised the position: supplier notification at 14:05, Arcadia telemetry placing onset at 13:38, fallback route activated at 14:12:41 for the German and Austrian queues, Swiss queue queueing with no fallback available.\n\n" +
      "14:41. Payment Repair Team Lead, stakeholder statement. Quoted as made: Every override goes through four-eyes. The log is lagging. RepairDesk backfills reviewer identities at the end of the batch cycle. There is no bypass. My team does not release payments without review. Incident manager note recorded at the time: the statement contains two distinct claims, one about a system mechanism and one about the behaviour of a team, and they will resolve differently. Both are recorded as the speaker's statement and neither is restated as fact.\n\n" +
      "14:48. Client Service Director, Novalink, stakeholder statement. Quoted as made: RepairDesk does not backfill reviewer identities. The field is written at the moment of review submission. If the field is empty, no review was submitted. I would add that the four-eyes requirement for route-substitution overrides is configured in the client tenant, not by Novalink. Incident manager note recorded at the time: the first three sentences directly contradict the 14:41 statement on the mechanism. The speaker has authoritative knowledge of the mechanism. The fourth sentence is an accountability assertion made by a party with a commercial interest in where accountability sits; it is recorded as such and is not treated as false.\n\n" +
      "14:52. Severity upgraded S3 to S2 by the incident manager: an important business service is materially degraded with a plausible path to an impact tolerance breach.\n\n" +
      "14:55. Head of Service Continuity, Novalink, stakeholder statement. Quoted as made: Root cause is a failed database failover at our Frankfurt hosting provider. The Amsterdam region is unaffected and traffic has moved there. Recovery expected by 16:00. Third-Party Risk Manager intervention recorded at 14:57: the statement names an Amsterdam region operated by a subprocessor, and the binding subprocessor appendix lists that subprocessor with the Frankfurt region only. To be raised formally.\n\n" +
      "14:58. Third-Party Risk Manager made a formal request to Novalink under Appendix A4 clause 2.1 for the RepairDesk tenant configuration export and the rule set governing derivation of the secondary review requirement, citing the four hour incident turnaround.\n\n" +
      "15:02. Novalink client status portal update captured. Recorded separately as EVD-2026-41915.\n\n" +
      "15:07. Resilience Officer Arcadia Bank Schweiz AG reported the Swiss position and, with the authority of the Arcadia Bank Schweiz AG Chief Operating Officer, invoked runbook RB-PAY-011 to submit the same-day tranche manually. Verified fact. Incident manager note: the decision was taken with 38 minutes of tolerance remaining against a 45 minute preparation lead time and 53 minutes to the cut-off. It could not wait for the cause to be known.\n\n" +
      "15:14. Severity upgraded S2 to S1 by the incident manager on two grounds: an impact tolerance for an important business service is within 40 minutes of its limit, and a zero-tolerance control condition has 96 candidate breaches. Notifications issued to the Group Chief Risk Officer and the Group Chief Operating Officer. Entity incident classification assessments started at 15:20, separately for the European Union entities and for the Swiss entity.\n\n" +
      "15:23. Group Legal opinion received on the binding appendix version. Recorded as EVD-2026-41901.\n\n" +
      "15:38. Tenant configuration export received from Novalink Engineering. Recorded as EVD-2026-41905 with the firing history at EVD-2026-41906. Incident manager note recorded at 15:39: the mechanism claim made at 14:41 is disproved and the behaviour claim made at 14:41 stands. No member of the payment repair team bypassed a control. The rule waived the requirement before any human saw the override. The telemetry inference recorded at 14:34 is reclassified to verified fact at 15:38 and the reclassification is recorded rather than the history overwritten.\n\n" +
      "15:44. Decision taken by the Head of Payment Operations with the Control Assurance Specialist and the Third-Party Risk Manager: do not disable RD-RULE-0031 while fallback mode is active, because disabling it mid-event would place the 13 overrides currently in AWAITING_SECONDARY_REVIEW into an undefined state. Exit fallback on restoration and disable the rule under change control before the next fallback activation. Recorded as DEC-2026-0777.\n\n" +
      "15:47. Provisional incident classification conclusion for the German and Austrian entities recorded as DEC-2026-0774: significant but not meeting the major-incident threshold on the facts available, to be reassessed on receipt of the supplier report. Illustrative regulatory context, not legal advice.\n\n" +
      "15:51. Rheinstack incident summary received. Recorded as EVD-2026-41911.\n\n" +
      "15:52. Provisional incident classification conclusion for the Swiss entity recorded as DEC-2026-0775: no report required on the facts available, assessment documented and to be reassessed. Assessed separately from the German and Austrian conclusion, against FINMA reporting expectations for incidents of substantial importance. The two assessments are not merged. Illustrative regulatory context, not legal advice.\n\n" +
      "16:04. Correspondent confirmation received. Recorded as EVD-2026-41918. Incident manager note: the two measures of the Swiss tolerance give different answers and the question is not resolved on this bridge. It is referred to the committee.\n\n" +
      "16:08. Full service confirmed. Fallback route mode set to INACTIVE on both queues. Change record CHG-2026-7741 closed.\n\n" +
      "16:19. Post-event validation result reported. Recorded as EVD-2026-41924. One confirmed misrouted payment.\n\n" +
      "16:27. Written position statements exchanged between the Payment Repair Team Lead and the Control Assurance Specialist, jointly recorded. Payment Repair Team Lead, revised position: accepts the tenant configuration export, withdraws the backfill claim made at 14:41, accepts that 96 payments were released without secondary review, and maintains that the control operated as the system was configured to operate and that the deficiency is therefore a design deficiency owned jointly with the supplier rather than an operating deficiency of her team. Control Assurance Specialist, revised position: accepts the design deficiency characterisation for exception EXC-TST-2026-0318-04 and for the 96 event cases, and maintains an operating deficiency for the three test exceptions that are independent of the rule, being self-review, review after release, and approval with no documented evidence.\n\n" +
      "16:30. Bridge closed. Incident record INC-2026-0412 remains open pending the supplier's written report due 13.10.2026. Joint conclusion on control effectiveness to be recorded at 16:41 as DEC-2026-0783.",
    summary:
      "The bridge log for the event, recording every statement with its speaker, time and classification. It holds both sides of the backfill contradiction verbatim, the moment at 15:38 when the mechanism claim was disproved and the behaviour claim stood, and the two separate entity incident classifications.",
    relatedObjectIds: [
      "INC-2026-0412",
      "CTL-PAY-014",
      "RD-RULE-0031",
      "ITOL-0004-03",
      "ITOL-0004-04",
      "TP-0042",
      "TP-0042.2",
      "DEC-2026-0774",
      "DEC-2026-0775",
      "DEC-2026-0776",
      "DEC-2026-0777",
      "DEC-2026-0783",
      "REG-2026-0117",
      "CTR-2023-0117-A4",
      "RB-PAY-011",
    ],
    pageCount: 9,
    fromSharedEvent: true,
    revealedAtMoment: "16:30",
  },
];
