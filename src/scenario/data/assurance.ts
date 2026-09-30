/**
 * Control assurance: the Q4 2026 test portfolio and the full inspectable
 * population behind the central test.
 *
 * Authoritative source: docs/SCENARIO_BIBLE.md sections 1, 2, 4, 6 (the payment
 * repair and manual override process, including RD-RULE-0031), 8, 8.1, 8.2, 8.3
 * and 8.4. Where this module and the bible disagree, the bible wins and this
 * module is fixed.
 *
 * Why the population and not only the sample.
 *
 * A control test is usually stored as a conclusion plus a list of exceptions.
 * That is enough to file and not enough to challenge. The product lets a
 * professional open the population field of TST-2026-0318 and inspect an
 * override that was never drawn into the sample, because the most valuable
 * items in this scenario are exactly those: the service account approvals that
 * carry the same audit trail defect as UTC-TST-2026-0318-01 but were never
 * looked at, and the OVR-C release that sat EUR 18,400 above the RD-RULE-0031
 * waiver threshold and therefore passed for a reason that has nothing to do
 * with the control working. Neither is a deviation. Neither appears in any
 * report. Both change what a reasonable person concludes.
 *
 * Scope of this extract. The real population is 1,204 manual overrides across
 * all three entities, and populationSize on the test row says so. The 100 rows
 * seeded here are the loaded extract: the 60 drawn sample items plus 40
 * unsampled neighbours, covering ARC-DE and ARC-AT, which is where all six
 * deviations sit and where the Munich repair team named in the people register
 * operates. The ARC-CH overrides in the period are handled from Zurich by staff
 * the bible does not name, so they are represented in populationSize only, with
 * no invented detail, following the bible's own practice in section 11.2.
 *
 * Human decisions are left undecided on purpose. assuranceConclusion and
 * concludedByUserId on TST-2026-0318 are null, and every exception's
 * exceptionClassification, exceptionScope, rootCause, classifiedByUserId and
 * classifiedAt are null. Deciding whether four deviations are isolated or
 * systemic is the judgement the Control Assurance role exists to make, and
 * pre-filling it would hand the professional the answer and remove the work.
 *
 * Timestamps carry scenario clock time (CET) in the ISO field, matching the
 * convention in contract.ts at().
 *
 * Synthetic institution and data.
 */

import {
  DEFAULT_RUN_ID,
  ENTITY_AT,
  ENTITY_CH,
  ENTITY_DE,
  type NewControlTest,
  type NewTestCase,
} from "./contract";

/* ==========================================================================
   Shared codes and helpers
   ========================================================================== */

const TEST_ID = "TST-2026-0318";

/**
 * Validation failure reason codes, bible 6.3, with the code text carried in the
 * field so an interface can render the reason without a lookup table.
 *
 * R06 is absent by design: sanctions screening holds go to the compliance queue
 * and never enter the repair queue, so they cannot appear in an override
 * population.
 */
const REASON_TEXT = {
  R01: "R01 Invalid or unreachable IBAN and BIC combination",
  R02: "R02 Missing or malformed regulatory reporting data for cross-border value above EUR 12,500",
  R03: "R03 Beneficiary name and account mismatch",
  R04: "R04 Currency or clearing route unavailable",
  R05: "R05 Duplicate suspicion",
  R07: "R07 Insufficient cover at cut-off",
  R08: "R08 Missing corporate mandate static data",
} as const;

type ReasonCode = keyof typeof REASON_TEXT;

/** The Novalink service account identity that the bulk approval screen writes. */
const SERVICE_ACCOUNT = "svc_repairbatch";

function entityToken(entityId: string): string {
  if (entityId === ENTITY_AT) return "AT";
  if (entityId === ENTITY_CH) return "CH";
  return "DE";
}

/** Override record identifier, bible 6.6: OVR-<entity>-<YYYYMMDD>-<seq4>. */
function overrideId(entityId: string, date: string, seq: string): string {
  return `OVR-${entityToken(entityId)}-${date.replaceAll("-", "")}-${seq}`;
}

/** Payment instruction identifier, bible 6.6: PAY-<entity>-<YYYYMMDD>-<seq6>. */
function paymentRef(entityId: string, date: string, seq: string): string {
  return `PAY-${entityToken(entityId)}-${date.replaceAll("-", "")}-${seq}`;
}

function occurred(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

/**
 * Evidence Vault identifier, bible 1 and 16: EVD-<year>-<seq5>, sequential
 * within the year. The bands used here sit between the fixed identifiers the
 * bible already allocates, so creation order still rises with creation date:
 * June items above EVD-2026-40118 (22.05.2026) and below EVD-2026-40233
 * (30.06.2026), July and August items above EVD-2026-40233 and below
 * EVD-2026-41102 (18.09.2026). The band is walked in steps of three rather
 * than consecutively, because the vault numbers on receipt from every source in
 * the group and an extract from one control test is never contiguous.
 */
function evd(sequence: number): string {
  return `EVD-2026-${sequence}`;
}

/* ==========================================================================
   Control tests
   ========================================================================== */

/*
 * TST-2026-0318 is the central test. The other seven are the rest of the Q4
 * plan that the payments dispute is currently crowding out, which is why the
 * portfolio carries a planned test, an in-progress test, a preliminary result
 * and four concluded results alongside one disputed one.
 *
 * Controls CTL-PAY-014, CTL-PAY-021 and CTL-PAY-029 are named in the bible.
 * CTL-TPR-006, CTL-RES-003, CTL-GOV-009 and CTL-REG-004 follow the bible's
 * identifier convention (type, domain scope, width three) and each has a row
 * in `risk.ts`, authored from the test that examines it: the conclusion, the
 * management response and the rating in the register agree across the two
 * modules, which is the only way a reader can open a test and land on a
 * control that says the same thing.
 */
export const controlTests: NewControlTest[] = [
  {
    id: "TST-2026-0281",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0281",
    controlId: "CTL-PAY-029",
    entityId: ENTITY_DE,
    title: "Daily payment value reconciliation between the payment hub and clearing confirmations",
    testType: "operating-effectiveness",
    testerUserId: "P-004",
    periodFrom: "2026-03-01",
    periodTo: "2026-05-31",
    populationSize: 63,
    sampleSize: 24,
    samplingMethod: "Attribute sampling, statistical, random selection with a seeded generator over reconciliation days",
    samplingRationale:
      "The control operates once per business day, so the sampling unit is a day and not a payment. 24 days were drawn by seeded generator across the three months, with the three month ends forced into the selection before the random draw and that forcing disclosed in the working papers. A month end carries the highest break volume and is the day on which an unresolved break is most likely to be carried forward, so excluding it would have made the sample cheaper to pass than the control is to operate.",
    testProcedure:
      "For each sampled day: the reconciliation was completed and signed before the next business day cut-off; every break above the EUR 10,000 investigation threshold carries a documented cause; and any break carried forward beyond two business days was escalated to the process owner. Value traced from SYS-0011 to the clearing confirmations held against that day.",
    status: "concluded",
    exceptionCount: 0,
    preliminaryConclusion:
      "No deviations in 24 sampled days. The control operates as designed within its own scope, which is value completeness.",
    assuranceConclusion:
      "Effective / Wirksam, recorded with an explicit scope limitation. This control reconciles value and says nothing about whether a release was authorised, so it cannot carry reliance as a compensating control for CTL-PAY-014.",
    concludedByUserId: "P-004",
    concludedOn: "2026-06-19",
    managementResponse: "Accepted without comment by the process owner on 22.06.2026.",
    managementResponseBy: "P-007",
    includesEventPopulation: false,
  },
  {
    id: "TST-2026-0294",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0294",
    controlId: "CTL-TPR-006",
    entityId: ENTITY_DE,
    title: "Criticality classification and subprocessor register completeness for tier one third parties",
    testType: "design",
    testerUserId: "P-004",
    periodFrom: "2026-01-01",
    periodTo: "2026-06-30",
    populationSize: 38,
    sampleSize: 15,
    samplingMethod: "Judgemental selection, risk weighted by criticality tier and by date of last register update",
    samplingRationale:
      "Judgemental and not statistical, stated as such so no deviation rate is projected from it. The 15 selected suppliers are the 8 whose register had not been updated in the preceding 12 months and the 7 supporting an important business service. A statistical sample of 38 items would have been cheap to draw and would have told the reader nothing about the suppliers where a stale register actually matters.",
    testProcedure:
      "For each selected supplier: the criticality classification is current and approved by the accountable category lead; the subprocessor register reconciles line by line to the binding contract appendix; and every fourth party named by a subprocessor appears in the register with a country of processing.",
    status: "preliminary",
    exceptionCount: 3,
    preliminaryConclusion:
      "Partially Effective / Teilweise wirksam. 12 of 15 registers reconcile. Three do not, and in all three cases the supplier's own current register names entities that the binding appendix does not. One of the three is TP-0042, where the appendix version in force is itself contested.",
    assuranceConclusion: null,
    concludedByUserId: null,
    concludedOn: null,
    managementResponse:
      "Third Party Risk Management accepts the preliminary result. The TP-0042 item is linked to MSN-2026-0191 and is being handled through the contract variation route rather than as a register correction, because correcting the register without a variation would record a subprocessor the bank has not approved.",
    managementResponseBy: "P-002",
    includesEventPopulation: false,
  },
  {
    id: "TST-2026-0302",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0302",
    controlId: "CTL-RES-003",
    entityId: ENTITY_CH,
    title: "Evidence of tested fallback arrangements for important business services",
    testType: "operating-effectiveness",
    testerUserId: "P-004",
    periodFrom: "2026-01-01",
    periodTo: "2026-06-30",
    populationSize: 11,
    sampleSize: 11,
    samplingMethod: "Full population, no selection",
    samplingRationale:
      "The population is 11 important business services, small enough to test in full, so nothing was selected and nothing is projected. Testing the whole population also closes the only argument available against an adverse rating, which is that the result is a sampling artefact. When the conclusion is going to be Not Effective, the method has to be unarguable before the conclusion is written.",
    testProcedure:
      "For each service: fallback test evidence exists; the evidence postdates the last material change to the service or to its provider; the test covered the actual substitute route rather than a desk walkthrough; and the measured restoration time is compared against the impact tolerance set for that service.",
    status: "concluded",
    exceptionCount: 2,
    preliminaryConclusion:
      "Not Effective / Nicht wirksam. 2 of 11 services hold no fallback test evidence at all. A further 4 hold evidence that predates the last material change to the service, and 1 holds a measured restoration time that exceeds its own impact tolerance without that gap having been escalated.",
    assuranceConclusion:
      "Not Effective / Nicht wirksam. An untested fallback arrangement is an assumption and not an arrangement, and the control is designed to stop the bank holding assumptions. The rating is on the control, not on the services.",
    concludedByUserId: "P-004",
    concludedOn: "2026-08-07",
    managementResponse:
      "Resilience accepts the rating. Notes that one of the two services without evidence depends on a provider whose disaster recovery report has been in the Evidence Vault since 22.05.2026 without being assessed, which is a separate and worse finding than the one tested here. Remediation is sequenced behind MSN-2026-0188.",
    managementResponseBy: "P-005",
    includesEventPopulation: false,
  },
  {
    id: "TST-2026-0311",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0311",
    controlId: "CTL-GOV-009",
    entityId: ENTITY_DE,
    title: "Escalation of remediation actions past a revised due date",
    testType: "operating-effectiveness",
    testerUserId: "P-004",
    periodFrom: "2026-04-01",
    periodTo: "2026-08-31",
    populationSize: 42,
    sampleSize: 20,
    samplingMethod: "Attribute sampling, statistical, random selection with a seeded generator",
    samplingRationale:
      "20 of the 42 actions that passed a revised due date in the period, drawn by seeded generator with no stratification by risk rating. Stratifying towards high rated actions was considered and rejected: the control applies to every overdue action regardless of rating, and a sample weighted to the visible ones would have measured how well the bank escalates things it was already talking about.",
    testProcedure:
      "For each sampled action: escalation to the NFR Committee occurred within the period the framework requires; the escalation names an accountable executive rather than reporting a count; and the committee record shows either a re-baseline with a root cause explanation or an escalation to the entity board.",
    status: "concluded",
    exceptionCount: 2,
    preliminaryConclusion:
      "Partially Effective / Teilweise wirksam. 18 of 20 actions were escalated within the required period. Two appeared in the committee pack inside an aggregate count with no named accountable executive, one of which is MSN-2026-0147.",
    assuranceConclusion:
      "Partially Effective / Teilweise wirksam. The escalation reliably happens. The part of it that changes behaviour, naming the executive who owns the delay, is applied inconsistently, and the two items where it was omitted are the two oldest in the sample.",
    concludedByUserId: "P-004",
    concludedOn: "2026-09-18",
    managementResponse:
      "Governance accepts the finding and is changing the committee pack template for the October cycle so that an overdue action cannot be rendered as a count.",
    managementResponseBy: "P-001",
    includesEventPopulation: false,
  },
  {
    /*
     * The central test. Reference, tester, period, population, sample, result
     * and the two positions are taken from bible 8.1 without adjustment.
     * entityId is ARC-DE because that is the lead entity and the control's
     * system dependency sits there; the population itself spans all three
     * entities, which the sampling rationale states explicitly so that nobody
     * reads the single entity field as the scope.
     */
    id: TEST_ID,
    runId: DEFAULT_RUN_ID,
    reference: TEST_ID,
    controlId: "CTL-PAY-014",
    entityId: ENTITY_DE,
    title:
      "Independent secondary review of manual payment overrides / Unabhaengige Zweitpruefung manueller Zahlungsueberschreibungen",
    testType: "combined",
    testerUserId: "P-004",
    periodFrom: "2026-06-01",
    periodTo: "2026-08-31",
    populationSize: 1204,
    sampleSize: 60,
    samplingMethod:
      "Attribute sampling, statistical, random selection with a seeded generator. Tolerable deviation rate 5%, expected deviation rate 0%",
    samplingRationale:
      "Every override in the 1,204 item population, across ARC-DE, ARC-AT and ARC-CH, was given a sequence number ordered by entity and then by release timestamp, and 60 sequence numbers were drawn by a seeded random number generator with the seed recorded in the working papers. Any reader can re-perform the draw and land on the same 60 items, which is the only honest answer to the question why was this case selected: its sequence number came up, and no item was added to or removed from the selection after the draw. The sample size follows the attribute sampling table for a 5% tolerable deviation rate, a 0% expected deviation rate and 90% confidence on a population of this size. The population was deliberately not stratified by value. Stratification would have raised the chance of finding a high value failure, but it would have removed the ability to project one deviation rate over the whole population, and the control statement admits no value threshold, so value is not a risk factor this control recognises. That decision is worth re-reading after 06.10.2026, because RD-RULE-0031 does recognise a value threshold even though the control description does not.",
    testProcedure:
      "Five attributes per sampled override, tested against the override record in SYS-0014 RepairDesk, the instruction record in SYS-0011 and the attached object in SYS-0032. (a) A secondary review record exists. (b) The recorded reviewer is not the override creator, compared on identifier and not on name. (c) The review timestamp precedes the release timestamp, compared to the second. (d) An evidence reference is present and the object is retrievable on the day of testing, not merely referenced. (e) The override reason code is one of OVR-A to OVR-E and is consistent with the validation failure reason codes present on the instruction. Where an attribute could not be tested because the underlying evidence no longer existed, the item was recorded as unable to conclude / nicht abschliessend beurteilbar rather than forced into a pass or a deviation.",
    status: "disputed",
    exceptionCount: 4,
    preliminaryConclusion:
      "Control Effectiveness / Kontrollwirksamkeit: Partially Effective / Teilweise wirksam. 54 of 60 sampled items showed no deviation, 4 are exceptions and 2 could not be concluded. The deviation rate on the exceptions alone is 4 of 60, 6.67%, against a 5% tolerable rate; treating the two unable to conclude items as deviations gives 6 of 60, 10.00%. Both a design deficiency and an operating deficiency are present. The design deficiency is that RD-RULE-0031 in RepairDesk sets secondaryReviewRequired to false for a defined class of override, while the control statement of 14.01.2025 says review applies to all overrides without exception. The operating deficiency is three human deviations, on independence, on sequence and on evidence. Combined value of the exception and unable to conclude set is EUR 1,595,500.",
    assuranceConclusion: null,
    concludedByUserId: null,
    concludedOn: null,
    managementResponse:
      "First line does not accept Partially Effective and assesses the control as Fully Effective / Voll wirksam. Position recorded 29.09.2026. Grounds given: none of the four exceptions produced a financial loss and all four payments were subsequently confirmed correct by the client; two compensating controls operate, CTL-PAY-021 next business day sampling of overrides by the Duty Manager at a 10% sample and CTL-PAY-029 daily payment value reconciliation; the two unable to conclude items are both caused by supplier side design choices, a service account identity and a retention job, which the control owner cannot remediate alone; the reviewer position PR-SR-02 has been vacant since 31.07.2026 and is under active recruitment as MSN-2026-0166; and the RD-RULE-0031 item is a system configuration matter already captured as a documentation action, MSN-2026-0203. First line asks that the rating be held at Effective pending delivery of the RepairDesk role segregation change NOVA-CR-4412.",
    managementResponseBy: "P-008",
    includesEventPopulation: false,
  },
  {
    id: "TST-2026-0325",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0325",
    controlId: "CTL-REG-004",
    entityId: ENTITY_AT,
    title: "Recording of entity applicability decisions on regulatory change items",
    testType: "design",
    testerUserId: "P-004",
    periodFrom: "2026-05-01",
    periodTo: "2026-08-31",
    populationSize: 27,
    sampleSize: 27,
    samplingMethod: "Full population, no selection",
    samplingRationale:
      "27 regulatory change items reached an applicability decision in the period, so the population was tested in full and nothing is projected. The register is the only place these decisions exist, so a sample would have left the bank unable to say whether the items outside it had been decided at all.",
    testProcedure:
      "For each item: an applicability decision exists per legal entity; the decision names the person who made it; a written rationale is present; and where an item was assessed as not applicable to ARC-CH, the rationale distinguishes the Swiss framework from the EU framework rather than asserting non-applicability.",
    status: "concluded",
    exceptionCount: 0,
    preliminaryConclusion:
      "Effective / Wirksam. All 27 items carry a per entity applicability decision with a named decision maker and a written rationale, including 9 items where the ARC-CH position differs from the EU entities and the difference is argued rather than stated.",
    assuranceConclusion:
      "Effective / Wirksam. Scope limitation recorded on the face of the conclusion: the control tests whether a decision was recorded and reasoned, not whether the decision was right. A wrong decision recorded well passes this test.",
    concludedByUserId: "P-004",
    concludedOn: "2026-09-25",
    managementResponse:
      "Regulatory Change accepts the conclusion and asks that the scope limitation travel with it wherever the rating is quoted, because a control rated Effective is routinely read as an assurance that the underlying judgements are correct.",
    managementResponseBy: "P-006",
    includesEventPopulation: false,
  },
  {
    /*
     * First line offers CTL-PAY-021 as a compensating control for CTL-PAY-014,
     * which is why it is in the same quarter's plan. The selection deliberately
     * starts from the Duty Manager's own sampling records: if the 10% sample was
     * never drawn, testing the underlying overrides would find nothing wrong.
     */
    id: "TST-2026-0331",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0331",
    controlId: "CTL-PAY-021",
    entityId: ENTITY_DE,
    title: "Duty Manager next business day sampling of manual payment overrides",
    testType: "combined",
    testerUserId: "P-004",
    periodFrom: "2026-07-01",
    periodTo: "2026-09-30",
    populationSize: 1271,
    sampleSize: 40,
    samplingMethod: "Attribute sampling, statistical, random selection with a seeded generator over sampling days and sampled items",
    samplingRationale:
      "Two stage. 20 business days were drawn by seeded generator to test whether the Duty Manager drew a sample at all on that day and whether it reached 10% of the day's overrides; then 20 individual items were drawn from the sampling records actually produced, to test what the review looked at. Starting from the override population instead would have tested the payments and not the control, which is the mistake that lets a detective control look effective while it is not being operated.",
    testProcedure:
      "Stage one, per sampled day: a sampling record exists for the next business day; the sample reaches the 10% required by the control description; and the selection method is recorded. Stage two, per sampled item: the reviewer recorded what was checked; any issue found was raised; and the override reason code was compared against the failure reason codes.",
    status: "in-progress",
    exceptionCount: 0,
    preliminaryConclusion: "",
    assuranceConclusion: null,
    concludedByUserId: null,
    concludedOn: null,
    managementResponse: "",
    managementResponseBy: null,
    includesEventPopulation: false,
  },
  {
    id: "TST-2026-0340",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0340",
    controlId: "CTL-PAY-029",
    entityId: ENTITY_CH,
    title: "Design of the CHF and euroSIC payment value reconciliation",
    testType: "design",
    testerUserId: "P-004",
    periodFrom: "2026-07-01",
    periodTo: "2026-09-30",
    populationSize: 64,
    sampleSize: 20,
    samplingMethod: "Attribute sampling, statistical, random selection with a seeded generator over reconciliation days",
    samplingRationale:
      "Planned selection only, to be drawn once the period closes, from the 64 reconciliation days in the quarter with each month end forced into the selection for the same reason as in TST-2026-0281. Fieldwork is scheduled to open on 12.10.2026. The design question for ARC-CH is different from the ARC-DE question: the Swiss submission has a hard 16:00 CET same day cut-off, so a reconciliation that runs the next morning cannot detect a missed cut-off in time to do anything about it.",
    testProcedure:
      "Planned. Per sampled day: the reconciliation covers both SIC and euroSIC submissions; the run time is early enough to allow corrective action before the same day cut-off; and the break investigation threshold is set in CHF rather than inherited from the EUR threshold.",
    status: "planned",
    exceptionCount: 0,
    preliminaryConclusion: "",
    assuranceConclusion: null,
    concludedByUserId: null,
    concludedOn: null,
    managementResponse: "",
    managementResponseBy: null,
    includesEventPopulation: false,
  },
];

/* ==========================================================================
   The population of TST-2026-0318: bulk conforming items
   ========================================================================== */

/**
 * One conforming override, written as data.
 *
 * Fixed length tuple so the fields are readable one row per line and every
 * element is a literal in the file. No generator runs at seed time and nothing
 * is derived from a clock or a random source, so the seed is byte identical on
 * every run.
 */
type ConformingRow = readonly [
  date: string,
  time: string,
  overrideSeq: string,
  instructionSeq: string,
  entityId: string,
  amountMinor: number,
  reason: ReasonCode,
  repairedByUserId: string,
  reviewerUserId: string,
  evidenceSeq: number,
  reviewLagMinutes: number,
  inSample: boolean,
];

function conforming(row: ConformingRow): NewTestCase {
  const [
    date,
    time,
    overrideSeq,
    instructionSeq,
    entityId,
    amountMinor,
    reason,
    repairedByUserId,
    reviewerUserId,
    evidenceSeq,
    reviewLagMinutes,
    inSample,
  ] = row;
  const evidenceRef = evd(evidenceSeq);
  return {
    id: overrideId(entityId, date, overrideSeq),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(entityId, date, instructionSeq),
    occurredAt: occurred(date, time),
    entityId,
    amountMinor,
    currency: "EUR",
    repairReason: REASON_TEXT[reason],
    repairedByUserId,
    reviewerUserId,
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evidenceRef,
    inSample,
    outcome: "conforming",
    anomalyKind: null,
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evidenceRef],
    note: inSample
      ? `Sampled. Attributes (a) to (e) satisfied. Secondary review recorded ${reviewLagMinutes} minutes after the override was proposed and before release.`
      : `Not drawn in the sample. Population analytics show a complete review record, a reviewer who is not the creator and a retrievable evidence reference, with the review recorded ${reviewLagMinutes} minutes after the override was proposed.`,
  };
}

/*
 * 83 conforming overrides, in release order.
 *
 * Shape of the data, so a reader can tell signal from filler. Business days
 * only; 04.06.2026 is absent because it is a public holiday in Bavaria and the
 * Munich hub was closed. The intraday spread has two peaks, late morning and
 * the run to cut-off, and the last two business days of each month carry
 * roughly a fifth of the month's overrides. Month volumes rise across the
 * period, 30 in June to 37 in August, which is the same pressure the KRI picks
 * up in September. Reviewer identity is where the capacity story shows: P-018
 * disappears after 31.07.2026 and P-009's share of reviews goes 43% in June,
 * 58% in July, 72% in August, because there is nobody else left to sign.
 */
const conformingRows: ConformingRow[] = [
  ["2026-06-01", "09:41", "0008", "123149", ENTITY_DE, 184720, "R01", "P-008", "P-009", 40131, 4, false],
  ["2026-06-02", "11:18", "0009", "130262", ENTITY_DE, 3695000, "R02", "P-018", "P-009", 40134, 14, false],
  ["2026-06-03", "13:22", "0010", "138158", ENTITY_DE, 992500, "R04", "P-007", "P-018", 40137, 26, false],
  ["2026-06-05", "17:12", "0007", "153428", ENTITY_DE, 14875000, "R01", "P-018", "P-009", 40140, 9, true],
  ["2026-06-08", "11:47", "0004", "156903", ENTITY_AT, 2478000, "R03", "P-009", "P-018", 40143, 16, true],
  ["2026-06-09", "14:03", "0011", "165147", ENTITY_DE, 561240, "R01", "P-018", "P-009", 40146, 9, true],
  ["2026-06-11", "17:41", "0008", "180069", ENTITY_DE, 6825000, "R02", "P-009", "P-018", 40149, 5, true],
  ["2026-06-12", "08:44", "0009", "168796", ENTITY_DE, 1689000, "R04", "P-018", "P-009", 40152, 23, true],
  ["2026-06-12", "11:56", "0013", "174364", ENTITY_DE, 235000, "R01", "P-009", "P-018", 40155, 47, false],
  ["2026-06-15", "14:52", "0007", "192368", ENTITY_DE, 4218000, "R03", "P-008", "P-018", 40158, 6, false],
  ["2026-06-16", "16:34", "0008", "199626", ENTITY_DE, 1148000, "R01", "P-009", "P-018", 40161, 12, false],
  ["2026-06-17", "18:37", "0009", "207493", ENTITY_DE, 23680000, "R02", "P-008", "P-018", 40164, 41, true],
  ["2026-06-18", "09:27", "0010", "195843", ENTITY_DE, 2734050, "R05", "P-009", "P-018", 40167, 7, true],
  ["2026-06-19", "11:04", "0003", "202956", ENTITY_AT, 687500, "R01", "P-008", "P-018", 40170, 7, true],
  ["2026-06-22", "16:59", "0009", "226151", ENTITY_DE, 8490000, "R08", "P-009", "P-018", 40173, 22, true],
  ["2026-06-23", "07:31", "0010", "213979", ENTITY_DE, 1842580, "R01", "P-008", "P-009", 40176, 10, true],
  ["2026-06-24", "09:58", "0011", "222542", ENTITY_DE, 312875, "R05", "P-018", "P-007", 40179, 35, false],
  ["2026-06-25", "11:33", "0007", "229597", ENTITY_DE, 4860000, "R02", "P-008", "P-009", 40182, 28, false],
  ["2026-06-25", "15:43", "0011", "236847", ENTITY_DE, 1275035, "R02", "P-018", "P-008", 40185, 3, false],
  ["2026-06-26", "13:47", "0008", "237783", ENTITY_DE, 61245000, "R08", "P-008", "P-009", 40188, 17, true],
  ["2026-06-26", "17:12", "0012", "243728", ENTITY_DE, 3120000, "R01", "P-018", "P-008", 40191, 6, true],
  ["2026-06-29", "15:11", "0011", "253119", ENTITY_DE, 814060, "R03", "P-008", "P-009", 40194, 21, true],
  ["2026-06-29", "16:48", "0004", "255932", ENTITY_AT, 11230000, "R07", "P-018", "P-008", 40197, 19, true],
  ["2026-06-29", "18:37", "0015", "259093", ENTITY_DE, 2150000, "R02", "P-008", "P-009", 40200, 31, true],
  ["2026-06-30", "15:58", "0007", "258782", ENTITY_DE, 1420000, "R03", "P-018", "P-009", 40203, 11, false],
  ["2026-06-30", "16:21", "0011", "259449", ENTITY_DE, 429000, "R04", "P-018", "P-008", 40206, 15, false],
  ["2026-06-30", "17:54", "0015", "262146", ENTITY_DE, 5740000, "R01", "P-008", "P-009", 40209, 12, true],
  ["2026-07-01", "10:49", "0008", "125121", ENTITY_DE, 162000, "R01", "P-018", "P-009", 40312, 9, true],
  ["2026-07-02", "12:41", "0009", "132669", ENTITY_DE, 3345000, "R02", "P-008", "P-009", 40315, 5, true],
  ["2026-07-03", "15:11", "0002", "141319", ENTITY_AT, 721500, "R04", "P-009", "P-008", 40318, 23, true],
  ["2026-07-06", "09:41", "0008", "144649", ENTITY_DE, 9640000, "R01", "P-008", "P-009", 40321, 47, true],
  ["2026-07-07", "11:18", "0009", "151762", ENTITY_DE, 1798000, "R03", "P-009", "P-008", 40324, 6, false],
  ["2026-07-08", "13:22", "0010", "159658", ENTITY_DE, 208545, "R07", "P-018", "P-007", 40327, 12, false],
  ["2026-07-09", "15:43", "0011", "168047", ENTITY_DE, 3870000, "R02", "P-009", "P-018", 40330, 41, false],
  ["2026-07-10", "17:12", "0007", "174928", ENTITY_DE, 863000, "R08", "P-018", "P-009", 40333, 7, true],
  ["2026-07-13", "11:47", "0010", "178403", ENTITY_DE, 12890000, "R01", "P-009", "P-018", 40336, 7, true],
  ["2026-07-14", "14:03", "0004", "186647", ENTITY_AT, 1935000, "R03", "P-018", "P-009", 40339, 22, true],
  ["2026-07-15", "16:07", "0007", "194543", ENTITY_DE, 294000, "R05", "P-008", "P-018", 40342, 10, true],
  ["2026-07-16", "17:41", "0008", "201569", ENTITY_DE, 4490000, "R02", "P-018", "P-009", 40345, 35, true],
  ["2026-07-17", "08:44", "0009", "190296", ENTITY_DE, 948000, "R08", "P-008", "P-009", 40348, 28, false],
  ["2026-07-20", "14:52", "0007", "213868", ENTITY_DE, 18760000, "R01", "P-018", "P-009", 40351, 3, false],
  ["2026-07-21", "16:34", "0008", "221126", ENTITY_DE, 2240000, "R02", "P-008", "P-009", 40354, 17, false],
  ["2026-07-22", "18:37", "0009", "228993", ENTITY_DE, 377500, "R05", "P-007", "P-009", 40357, 6, true],
  ["2026-07-23", "09:27", "0010", "217343", ENTITY_DE, 5230000, "R01", "P-008", "P-009", 40360, 21, true],
  ["2026-07-24", "11:04", "0002", "224456", ENTITY_AT, 1075000, "R08", "P-009", "P-008", 40363, 19, true],
  ["2026-07-27", "16:59", "0009", "247651", ENTITY_DE, 34120000, "R01", "P-018", "P-007", 40366, 31, true],
  ["2026-07-28", "07:31", "0010", "235479", ENTITY_DE, 2615000, "R02", "P-009", "P-008", 40369, 15, true],
  ["2026-07-29", "09:58", "0011", "244042", ENTITY_DE, 486020, "R05", "P-018", "P-008", 40372, 12, false],
  ["2026-07-29", "13:22", "0015", "249958", ENTITY_DE, 6180000, "R01", "P-009", "P-018", 40375, 11, false],
  ["2026-07-30", "14:52", "0007", "256868", ENTITY_DE, 87430000, "R01", "P-009", "P-018", 40378, 13, false],
  ["2026-07-30", "16:34", "0011", "259826", ENTITY_DE, 2980000, "R02", "P-018", "P-009", 40381, 18, true],
  ["2026-07-30", "16:59", "0015", "260551", ENTITY_DE, 1322000, "R03", "P-018", "P-009", 40384, 8, true],
  ["2026-07-30", "18:08", "0002", "262552", ENTITY_AT, 534000, "R04", "P-008", "P-018", 40387, 4, true],
  ["2026-07-31", "16:07", "0008", "263343", ENTITY_DE, 1564000, "R03", "P-008", "P-009", 40390, 26, true],
  ["2026-07-31", "18:08", "0012", "266852", ENTITY_DE, 7350000, "R01", "P-018", "P-009", 40393, 14, true],
  ["2026-08-03", "16:21", "0010", "143349", ENTITY_DE, 142500, "R01", "P-008", "P-009", 40714, 12, false],
  ["2026-08-04", "10:37", "0011", "137673", ENTITY_DE, 412500, "R04", "P-009", "P-008", 40717, 7, false],
  ["2026-08-04", "18:08", "0015", "150752", ENTITY_DE, 2845000, "R02", "P-008", "P-009", 40720, 41, true],
  ["2026-08-05", "09:02", "0007", "139218", ENTITY_DE, 4630000, "R01", "P-008", "P-009", 40723, 7, true],
  ["2026-08-06", "10:49", "0008", "146621", ENTITY_DE, 916000, "R05", "P-007", "P-009", 40726, 22, true],
  ["2026-08-07", "12:41", "0003", "154169", ENTITY_AT, 10560000, "R02", "P-008", "P-009", 40729, 10, true],
  ["2026-08-10", "06:52", "0007", "156948", ENTITY_DE, 1510000, "R01", "P-008", "P-009", 40732, 35, true],
  ["2026-08-10", "11:04", "0011", "164256", ENTITY_DE, 104360000, "R03", "P-008", "P-009", 40735, 28, false],
  ["2026-08-11", "09:41", "0008", "166149", ENTITY_DE, 2590000, "R07", "P-008", "P-009", 40738, 3, false],
  ["2026-08-12", "11:18", "0009", "173262", ENTITY_DE, 341000, "R08", "P-009", "P-007", 40741, 17, false],
  ["2026-08-13", "13:22", "0010", "181158", ENTITY_DE, 4125000, "R02", "P-008", "P-009", 40744, 6, true],
  ["2026-08-14", "07:31", "0004", "175279", ENTITY_AT, 7940000, "R02", "P-008", "P-009", 40747, 19, true],
  ["2026-08-14", "15:43", "0011", "189547", ENTITY_DE, 784000, "R01", "P-007", "P-008", 40750, 21, true],
  ["2026-08-17", "10:06", "0009", "192674", ENTITY_DE, 1365000, "R04", "P-007", "P-009", 40753, 31, true],
  ["2026-08-18", "11:47", "0010", "199903", ENTITY_DE, 46870000, "R01", "P-008", "P-009", 40756, 15, true],
  ["2026-08-18", "15:58", "0014", "207182", ENTITY_DE, 2315000, "R02", "P-008", "P-009", 40759, 12, false],
  ["2026-08-20", "16:07", "0007", "216043", ENTITY_DE, 3780000, "R01", "P-008", "P-009", 40765, 8, false],
  ["2026-08-21", "17:41", "0008", "223069", ENTITY_DE, 639000, "R03", "P-009", "P-008", 40768, 13, true],
  ["2026-08-24", "12:14", "0011", "226486", ENTITY_DE, 6390000, "R07", "P-008", "P-009", 40771, 18, true],
  ["2026-08-24", "16:21", "0002", "233649", ENTITY_AT, 1192000, "R08", "P-007", "P-009", 40774, 4, true],
  ["2026-08-25", "14:52", "0007", "235368", ENTITY_DE, 21950000, "R02", "P-008", "P-009", 40777, 14, true],
  ["2026-08-26", "16:34", "0008", "242626", ENTITY_DE, 1980000, "R01", "P-008", "P-009", 40780, 26, true],
  ["2026-08-28", "14:52", "0010", "248268", ENTITY_DE, 5480000, "R02", "P-008", "P-009", 40786, 5, false],
  ["2026-08-28", "15:29", "0014", "249341", ENTITY_DE, 3270000, "R04", "P-008", "P-009", 40789, 16, false],
  ["2026-08-28", "16:34", "0003", "251226", ENTITY_AT, 1038000, "R07", "P-007", "P-009", 40792, 23, true],
  ["2026-08-28", "16:59", "0018", "251951", ENTITY_DE, 548000, "R01", "P-009", "P-008", 40795, 9, true],
  ["2026-08-31", "15:11", "0008", "261719", ENTITY_DE, 14230000, "R01", "P-008", "P-009", 40798, 47, true],
  ["2026-08-31", "16:48", "0012", "264532", ENTITY_DE, 1674000, "R08", "P-008", "P-009", 40801, 6, true],
];

/* ==========================================================================
   The population of TST-2026-0318: the four exceptions, bible 8.2
   ========================================================================== */

const exceptions: NewTestCase[] = [
  /*
   * The system wrote a clean audit trail for a self review. Nobody bypassed
   * anything and nobody hid anything: the account held both role assignments
   * and RepairDesk accepted both signatures from it. This is the exact failure
   * MSN-2026-0147 was raised to prevent in November 2025, and it happened 17
   * days before that action's revised due date, which is still open today. The
   * argument that this is an isolated lapse of discipline is available only to
   * someone who has not read the Massnahme.
   */
  {
    id: overrideId(ENTITY_DE, "2026-07-14", "0112"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-07-14", "182442"),
    occurredAt: "2026-07-14T11:38:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 8430000,
    currency: "EUR",
    repairReason: REASON_TEXT.R03,
    repairedByUserId: "P-009",
    reviewerUserId: "P-009",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40340),
    inSample: true,
    outcome: "exception",
    anomalyKind: "independence-failure",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40340)],
    note:
      "EXC-TST-2026-0318-01. Override under OVR-B, client confirmed beneficiary correction received out of band, EUR 84,300. A secondary review record exists and is complete, but secondaryReviewerId equals createdBy. The account holds both the Repair Analyst and the Secondary Reviewer role assignments in RepairDesk and the system permitted the same account to sign both sides. Attribute (b) fails, which is why the test compares identifiers and not names: the review record reads as normal and the names match because they are the same person. The payment itself was later confirmed correct by the client, which affects the loss position and not the control conclusion.",
  },
  /*
   * The highest value item in the set and the easiest one to wave through,
   * because every attribute except sequence passes and the review itself is
   * sound. The money left at 16:47:12 and the review was recorded at 16:58:31.
   * For those 11 minutes the payment was unreviewed and irrecoverable, and a
   * preventive control that operates after the event is not preventive. Worth
   * noting what is absent: RepairDesk does not block release while a required
   * review is outstanding, so the sequence rests entirely on one analyst's
   * discipline at cut-off.
   */
  {
    id: overrideId(ENTITY_DE, "2026-08-06", "0104"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-08-06", "157003"),
    occurredAt: "2026-08-06T16:47:12.000Z",
    entityId: ENTITY_DE,
    amountMinor: 121500000,
    currency: "EUR",
    repairReason: REASON_TEXT.R02,
    repairedByUserId: "P-009",
    reviewerUserId: "P-008",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40727),
    inSample: true,
    outcome: "exception",
    anomalyKind: "sequence-failure",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40727)],
    note:
      "EXC-TST-2026-0318-02. Override under OVR-D, cut-off driven release with post-release completion of the regulatory reporting data, EUR 1,215,000 and the highest value item in the deviation set. releasedAt is 16:47:12 and secondaryReviewAt is 16:58:31, so the review was recorded 11 minutes and 19 seconds after release. Attributes (a), (b), (d) and (e) all pass and the reviewer, who is the control owner, reached the right answer. Attribute (c) fails. The missing data item was completed the following business day as OVR-D requires.",
  },
  /*
   * An approval with no documented basis. The reviewer, interviewed on
   * 16.09.2026, said the rule defect was well known in the team and that no
   * document existed. A well known defect that has never been written down
   * cannot be re-performed by anyone, which is the whole point of attribute (d),
   * and the RepairDesk schema made this possible by leaving evidenceRef
   * nullable. The only ARC-AT item in the deviation set, reviewed from Munich,
   * which is where the AT queue is operated from.
   */
  {
    id: overrideId(ENTITY_AT, "2026-08-19", "0103"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_AT, "2026-08-19", "200868"),
    occurredAt: "2026-08-19T09:52:00.000Z",
    entityId: ENTITY_AT,
    amountMinor: 1240000,
    currency: "EUR",
    repairReason: REASON_TEXT.R01,
    repairedByUserId: "P-008",
    reviewerUserId: "P-009",
    secondaryReviewEvidenced: false,
    reviewEvidenceRef: null,
    inSample: true,
    outcome: "exception",
    anomalyKind: "evidence-failure",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [],
    note:
      "EXC-TST-2026-0318-03. Override under OVR-A, claimed validation rule false positive on an IBAN and BIC pair asserted to be correct, EUR 12,400. The reviewer is independent, the sequence is right and the reason code is coherent, but evidenceRef is null: a validation rule was suppressed and nothing on file shows the rule was defective. Interviewed on 16.09.2026, the reviewer stated that the rule defect was well known in the team and that no document existed. Attribute (d) fails on presence, not on retrievability.",
  },
  /*
   * The unexploded one. No review record exists and none was required, because
   * RD-RULE-0031 fired with reviewWaiverCode BCP-THROUGHPUT while
   * fallbackRouteMode was ACTIVE between 15:22 and 17:05 after a NOVA-GATE
   * latency incident. The rule removed the gate by design, from a Novalink
   * standard configuration template applied in release 8.3 on 11.11.2024, while
   * the control description of 14.01.2025 says review applies without
   * exception. Root cause was recorded in the test report as system
   * configuration, no Massnahme was raised against the rule itself, and 41 days
   * later the same rule fires 96 times in one afternoon. The ruleEvaluationTrace
   * on this single record is the whole design deficiency, and it was in the
   * working papers on 24.09.2026.
   */
  {
    id: overrideId(ENTITY_DE, "2026-08-27", "0119"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-08-27", "246027"),
    occurredAt: "2026-08-27T16:03:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 4690000,
    currency: "EUR",
    repairReason: REASON_TEXT.R04,
    repairedByUserId: "P-009",
    reviewerUserId: null,
    secondaryReviewEvidenced: false,
    reviewEvidenceRef: null,
    inSample: true,
    outcome: "exception",
    anomalyKind: "configuration-driven-omission",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40784), "EVD-2026-41908"],
    note:
      "EXC-TST-2026-0318-04. Override under OVR-C, route substitution, EUR 46,900. No secondary review record exists and secondaryReviewRequired is false. ruleEvaluationTrace shows RD-RULE-0031 fired and set reviewWaiverCode to BCP-THROUGHPUT: reason OVR-C, fallbackRouteMode ACTIVE, value below EUR 250,000, currency EUR, all four conditions met. fallbackRouteMode was ACTIVE for Q-REPAIR-DE between 15:22 and 17:05 on 27.08.2026 following a NOVA-GATE latency incident. Attribute (a) fails. Root cause was recorded in the test report as system configuration; no further investigation was performed and no Massnahme was raised against the rule. fromFallbackRoute is false on this row because it belongs to the tested period, not to the 14:05 event population.",
  },
];

/* ==========================================================================
   The population of TST-2026-0318: unable to conclude, bible 8.3
   ========================================================================== */

/*
 * Recorded separately from the exceptions because the tester could not
 * determine whether the control operated or failed. Unable to conclude is a
 * distinct category and collapsing it into either pass or fail destroys the
 * only honest statement available: we do not know. Both items carry
 * outcome "anomaly" with an unable-to-conclude anomalyKind and
 * secondaryReviewEvidenced false, so a filter on what Arcadia can actually
 * demonstrate returns them alongside the evidence failures.
 */
const unableToConclude: NewTestCase[] = [
  /*
   * The worst item in the test and the one with the lowest profile. A review
   * record exists, it is complete, and the reviewer is a Novalink service
   * account, so the bank cannot name the human who approved a EUR 233,800
   * release. Novalink advised on 18.09.2026 that the screen writes the service
   * account identity and holds the human in an application log with 30 day
   * retention; by the time the question was asked the log had expired. The
   * evidence is permanently gone, and it is gone for a bulk approval screen the
   * team uses routinely rather than exceptionally. Arcadia accepted this design
   * without asking what identity it writes.
   */
  {
    id: overrideId(ENTITY_DE, "2026-07-02", "0108"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-07-02", "140789"),
    occurredAt: "2026-07-02T17:21:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 23380000,
    currency: "EUR",
    repairReason: REASON_TEXT.R03,
    repairedByUserId: "P-008",
    reviewerUserId: SERVICE_ACCOUNT,
    secondaryReviewEvidenced: false,
    reviewEvidenceRef: evd(40316),
    inSample: true,
    outcome: "anomaly",
    anomalyKind: "unable-to-conclude-reviewer-identity",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40316)],
    note:
      "UTC-TST-2026-0318-01. Override under OVR-B, EUR 233,800. secondaryReviewerId is svc_repairbatch, a Novalink service account, so attribute (b) can be neither passed nor failed: Arcadia cannot determine which human, if any, performed the review. Novalink advised on 18.09.2026 that the service account identity is written whenever a review is submitted through the bulk approval screen and that the underlying human identity is held in an application log with 30 day retention, which had expired before the question was asked. Status as at 06.10.2026: unresolvable, the evidence is gone. An audit trail defect in a key control in the Internal Control System / Internes Kontrollsystem.",
  },
  /*
   * A named human reviewer, a real review record, and an evidence link that now
   * points at nothing because a supplier retention job moved the object on
   * 01.09.2026, after the review and before the test. Novalink acknowledged the
   * job on 22.09.2026 and has committed to restore from archive by 10.10.2026,
   * which is two business days of float before the committee papers are due.
   * Less serious than UTC-01 in substance and more likely to be closed, which
   * is precisely why it tends to get the attention that UTC-01 deserves.
   */
  {
    id: overrideId(ENTITY_DE, "2026-08-21", "0111"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-08-21", "216283"),
    occurredAt: "2026-08-21T13:47:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 310000,
    currency: "EUR",
    repairReason: REASON_TEXT.R08,
    repairedByUserId: "P-008",
    reviewerUserId: "P-009",
    secondaryReviewEvidenced: false,
    reviewEvidenceRef: evd(40769),
    inSample: true,
    outcome: "anomaly",
    anomalyKind: "unable-to-conclude-evidence-retrieval",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40769)],
    note:
      "UTC-TST-2026-0318-02. Override under OVR-E, technical suppression on supplier advice, EUR 3,100. A review record exists with a named human reviewer and an evidence reference, but the referenced object is a broken link in the Novalink evidence store: a retention job moved it on 01.09.2026, after the review and before fieldwork. Attribute (d) passes on presence and cannot be tested on retrievability, so the item is unable to conclude rather than an evidence failure. Novalink acknowledged the retention job on 22.09.2026 and has committed to restore from archive by 10.10.2026. Status as at 06.10.2026: open.",
  },
];

/* ==========================================================================
   The population of TST-2026-0318: anomalies
   ========================================================================== */

/*
 * Eleven items that are unusual and are not deviations. None was drawn into the
 * sample, so no attribute was ever tested against them; they are flagged by
 * population analytics over the whole 1,204 items and they are the reason the
 * product stores the population. Every one of them passes the test as written.
 * Whether any of them should change the conclusion is a judgement, and the
 * professional has to make it without the cover of a failed attribute.
 */
const anomalies: NewTestCase[] = [
  /*
   * Reciprocal review inside a pair. Both releases are individually compliant
   * and attribute (b) cannot see the pattern, because it only asks whether the
   * two identifiers on one record differ.
   */
  {
    id: overrideId(ENTITY_DE, "2026-06-10", "0102"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-06-10", "162806"),
    occurredAt: "2026-06-10T10:14:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 3695000,
    currency: "EUR",
    repairReason: REASON_TEXT.R05,
    repairedByUserId: "P-009",
    reviewerUserId: "P-018",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40148),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "reciprocal-review-pair",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40148)],
    note:
      "Not drawn in the sample. A duplicate suspicion released after analyst confirmation against the prior instruction, where the prior instruction PAY-DE-20260602-130262 was itself released under override OVR-DE-20260602-0009 on 02.06.2026 for the same amount, by the same two people in the opposite roles. Both releases pass every attribute. The pair reviews each other, which no attribute in this test can detect.",
  },
  /*
   * Evidence that is present, retrievable and does not show what it is supposed
   * to show. Attribute (d) tests presence and retrievability and is silent on
   * sufficiency, so this passes; that is a limitation of the test design rather
   * than a fault in the payment.
   */
  {
    id: overrideId(ENTITY_AT, "2026-06-18", "0104"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_AT, "2026-06-18", "206254"),
    occurredAt: "2026-06-18T15:26:00.000Z",
    entityId: ENTITY_AT,
    amountMinor: 1588000,
    currency: "EUR",
    repairReason: REASON_TEXT.R03,
    repairedByUserId: "P-008",
    reviewerUserId: "P-009",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40168),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "evidence-quality-generic",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40168)],
    note:
      "Not drawn in the sample. evidenceRef is present and the object is retrievable, so attribute (d) as written would pass. The object is a screenshot of a shared mailbox list, not the client's confirmation of the beneficiary account: it shows that a mail arrived, not what the client said. Sixteen further items in the extract carry the same class of object.",
  },
  /*
   * Month end, and 31 approvals in four minutes through the bulk screen under
   * the service account. Same defect as UTC-TST-2026-0318-01, three weeks
   * earlier, never sampled, never reported.
   */
  {
    id: overrideId(ENTITY_DE, "2026-06-30", "0127"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-06-30", "261682"),
    occurredAt: "2026-06-30T17:38:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 2765040,
    currency: "EUR",
    repairReason: REASON_TEXT.R02,
    repairedByUserId: "P-009",
    reviewerUserId: SERVICE_ACCOUNT,
    secondaryReviewEvidenced: false,
    reviewEvidenceRef: evd(40207),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "bulk-approval-burst",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40207)],
    note:
      "Not drawn in the sample. Approved through the RepairDesk bulk approval screen in a month end burst: the same submission carries 31 override approvals inside four minutes and this is one of them. The reviewer identifier written to the record is svc_repairbatch, so the population cannot say which human approved this payment. The Novalink application log that held the human identity had a 30 day retention and expired on 30.07.2026.",
  },
  /*
   * Forty seven seconds is enough to click approve and not enough to open the
   * client instruction, the static data record and the beneficiary history,
   * which is what the control description expects. Not a deviation and it
   * cannot be written up as one. A pattern of these would move the operating
   * effectiveness conclusion without touching the design conclusion.
   */
  {
    id: overrideId(ENTITY_DE, "2026-07-16", "0109"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-07-16", "188403"),
    occurredAt: "2026-07-16T10:07:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 78000000,
    currency: "EUR",
    repairReason: REASON_TEXT.R01,
    repairedByUserId: "P-008",
    reviewerUserId: "P-009",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40346),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "review-duration-implausible",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40346)],
    note:
      "Not drawn in the sample. The secondary review was recorded 47 seconds after the override was proposed, on a EUR 780,000 release and the second highest value item in the extract. Every attribute passes, including sequence, since 47 seconds is still before release. The reviewer signed 19 further overrides in the same hour.",
  },
  /*
   * OVR-E asserts that the supplier advised the suppression. The record does not
   * evidence that the supplier advised anything, and OVR-E is the only reason
   * code whose entire justification sits outside Arcadia.
   */
  {
    id: overrideId(ENTITY_DE, "2026-07-23", "0116"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-07-23", "226159"),
    occurredAt: "2026-07-23T14:31:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 845000,
    currency: "EUR",
    repairReason: REASON_TEXT.R08,
    repairedByUserId: "P-008",
    reviewerUserId: "P-009",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40361),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "supplier-advice-not-referenced",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40361)],
    note:
      "Not drawn in the sample. Released under OVR-E, technical suppression on supplier advice, with no Novalink service notification reference recorded anywhere on the override. The attached object is an internal mail from the team channel stating that Novalink had confirmed the rule was misfiring. Attribute (e) tests that the reason code is consistent with the failure reason codes and does not test whether the reason code's factual premise is evidenced.",
  },
  /*
   * P-018's last working day before the PR-SR-02 seat fell vacant, reviewed by
   * the analyst who then carried the seat alone. Independence holds and every
   * attribute passes. The row records the capacity position that KRI-PAY-011
   * reports as 75% of approved establishment: concentration here is not a
   * behaviour anybody chose.
   */
  {
    id: overrideId(ENTITY_DE, "2026-07-31", "0131"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-07-31", "265518"),
    occurredAt: "2026-07-31T17:22:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 4190000,
    currency: "EUR",
    repairReason: REASON_TEXT.R01,
    repairedByUserId: "P-018",
    reviewerUserId: "P-009",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40391),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "reviewer-concentration",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40391)],
    note:
      "Not drawn in the sample. Created by P-018 on 31.07.2026, his last working day, and reviewed by P-009, who signed 24 of the 26 overrides raised in the Munich queue that day. From 01.08.2026 the PR-SR-02 seat is vacant and P-009 is the only filled senior secondary reviewer position, which is visible in this extract as her share of reviews rising from 43% in June to 72% in August.",
  },
  /*
   * The control owner signing individual items inside the control she owns and
   * assesses as Fully Effective. Attribute (b) tests identity, not role, so this
   * passes. In August there is nobody else to sign when P-009 raises the
   * override, which makes it a structural question rather than a choice.
   */
  {
    id: overrideId(ENTITY_DE, "2026-08-12", "0107"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-08-12", "182629"),
    occurredAt: "2026-08-12T16:41:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 51200000,
    currency: "EUR",
    repairReason: REASON_TEXT.R07,
    repairedByUserId: "P-009",
    reviewerUserId: "P-008",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40742),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "control-owner-as-reviewer",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40742)],
    note:
      "Not drawn in the sample. A cut-off cover release of EUR 512,000 created by the only designated secondary reviewer in the team and therefore reviewed by the control owner herself. Independence on identifier passes and no attribute fails. P-008 reviewed 15 overrides in the extract, 11 of them in August, and separately holds the Fully Effective position on this control.",
  },
  /*
   * The threshold made visible. This release passed for a reason that has
   * nothing to do with the control operating: at EUR 268,400 it sat EUR 18,400
   * above the RD-RULE-0031 value condition, so the waiver did not fire and a
   * human had to sign. The ruleEvaluationTrace on this record demonstrates the
   * waiver is value driven, and it was in the population while the root cause of
   * EXC-TST-2026-0318-04 was being recorded as system configuration.
   */
  {
    id: overrideId(ENTITY_DE, "2026-08-25", "0113"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-08-25", "237601"),
    occurredAt: "2026-08-25T16:09:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 26840000,
    currency: "EUR",
    repairReason: REASON_TEXT.R04,
    repairedByUserId: "P-008",
    reviewerUserId: "P-009",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40778),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "waiver-threshold-near-miss",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40778), evd(40779)],
    note:
      "Not drawn in the sample. Route substitution under OVR-C while fallbackRouteMode was ACTIVE, so RD-RULE-0031 was evaluated and did not fire: three of its four conditions were met and the value condition was not, because EUR 268,400 sits EUR 18,400 above the EUR 250,000 limit. secondaryReviewRequired stayed true, a reviewer signed it and every attribute passes. The control held here because the payment was too large, not because the control works.",
  },
  /*
   * The same audit trail defect as UTC-TST-2026-0318-01, six weeks later, on an
   * item small enough that nobody would look twice. That is the point: the
   * defect is a property of the bulk approval screen and not of the payment.
   */
  {
    id: overrideId(ENTITY_DE, "2026-08-19", "0011"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-08-19", "208147"),
    occurredAt: "2026-08-19T14:03:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 267000,
    currency: "EUR",
    repairReason: REASON_TEXT.R05,
    repairedByUserId: "P-009",
    reviewerUserId: SERVICE_ACCOUNT,
    secondaryReviewEvidenced: false,
    reviewEvidenceRef: evd(40762),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "service-account-reviewer",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40762)],
    note:
      "Not drawn in the sample. Bulk approval screen, service account identity, EUR 2,670. Identical in kind to UTC-TST-2026-0318-01 of 02.07.2026, six weeks later and after Novalink had been asked about the identity behaviour. Four items in this extract carry svc_repairbatch as the reviewer and only one of them was sampled, which is the argument for MSN-2026-0220 extending the population.",
  },
  /*
   * Fallback mode had already been switched off at 17:05, so this release did
   * require a review and got one. The bank simply cannot name the person who
   * gave it, on the same day and in the same queue as the configuration
   * exception.
   */
  {
    id: overrideId(ENTITY_DE, "2026-08-27", "0009"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-08-27", "250493"),
    occurredAt: "2026-08-27T18:37:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 198000,
    currency: "EUR",
    repairReason: REASON_TEXT.R03,
    repairedByUserId: "P-009",
    reviewerUserId: SERVICE_ACCOUNT,
    secondaryReviewEvidenced: false,
    reviewEvidenceRef: evd(40783),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "service-account-reviewer",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40783)],
    note:
      "Not drawn in the sample. Released at 18:37 on 27.08.2026, the same day and the same queue as EXC-TST-2026-0318-04, but after fallbackRouteMode was set back to INACTIVE at 17:05, so RD-RULE-0031 did not fire and a review was required. A review record exists and carries svc_repairbatch. The control operated and cannot be shown to have operated.",
  },
  /*
   * 18:52 on the last business day of the month, eight minutes before the
   * process operating window closes, reviewed by the process owner because no
   * designated reviewer was still on shift. Sequence, independence and evidence
   * all pass. The review happened only because he was still at his desk.
   */
  {
    id: overrideId(ENTITY_DE, "2026-08-31", "0122"),
    runId: DEFAULT_RUN_ID,
    controlTestId: TEST_ID,
    transactionRef: paymentRef(ENTITY_DE, "2026-08-31", "268128"),
    occurredAt: "2026-08-31T18:52:00.000Z",
    entityId: ENTITY_DE,
    amountMinor: 9630000,
    currency: "EUR",
    repairReason: REASON_TEXT.R02,
    repairedByUserId: "P-009",
    reviewerUserId: "P-007",
    secondaryReviewEvidenced: true,
    reviewEvidenceRef: evd(40799),
    inSample: false,
    outcome: "anomaly",
    anomalyKind: "out-of-hours-release",
    exceptionClassification: null,
    exceptionScope: null,
    rootCause: null,
    classifiedByUserId: null,
    classifiedAt: null,
    fromFallbackRoute: false,
    evidenceDocumentIds: [evd(40799)],
    note:
      "Not drawn in the sample. Month end, 18:52, eight minutes before the 19:00 close of the process operating window, EUR 96,300. Reviewed by the Head of Payment Operations, who is the process owner and sits one level above the control owner, because no designated secondary reviewer was still on shift. Five items in the extract carry P-007 as reviewer and all five are after 16:00.",
  },
];

/* ==========================================================================
   The population of TST-2026-0318
   ========================================================================== */

/**
 * 100 rows: 83 conforming, 13 anomalies (11 analytics flags plus the 2 unable to
 * conclude items) and 4 exceptions. 60 rows carry inSample true, which is the
 * drawn sample, and that sample contains all four exceptions and both unable to
 * conclude items, because the tester found them by testing it.
 *
 * Ordered by release timestamp and then by override identifier, so the order is
 * total and identical on every run.
 */
export const testCases: NewTestCase[] = [
  ...conformingRows.map(conforming),
  ...exceptions,
  ...unableToConclude,
  ...anomalies,
].sort((a, b) => {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
});
