/**
 * Derived evidence documents: the override record extracts behind the
 * TST-2026-0318 population, plus two authored artefacts the chronology needs.
 *
 * Why this file exists.
 *
 * `evidence.ts` is the authored corpus. It holds the seventy seven documents
 * that a professional reads end to end: the control descriptions, the test
 * report, the working papers, the contract appendices, the supplier answers
 * and the seven gaps. It is deliberately hand written, and it is complete.
 *
 * It does not hold one document per payment, and it should not. Every one of
 * the hundred overrides in the TST-2026-0318 population nevertheless has its
 * own override record in the RepairDesk override register, extracted to the
 * Evidence Vault by the daily feed, and every test case row in `assurance.ts`
 * already cites that record by identifier. Those records exist in the
 * scenario. They were simply never written down, so the citations pointed at
 * nothing.
 *
 * This module writes them, one per cited identifier, derived from the test
 * case row the record belongs to. Nothing is invented here that is not
 * already on the row: the override identifier, the payment instruction, the
 * date and time, the entity, the value, the validation failure reason, who
 * created the override, who reviewed it or that nobody did, whether the
 * review was evidenced, and how the test disposed of the item. The body is
 * assembled from those facts in the register of a RepairDesk override record
 * extract, which means the review paragraph of a self reviewed override reads
 * differently from the review paragraph of a waived one, because the records
 * themselves differ.
 *
 * Two further documents are authored by hand at the end of the file. They are
 * artefacts that no document in `evidence.ts` is, and remapping the citations
 * that name them would have pointed a reader at the wrong subject.
 *
 * Deterministic. No clock, no random source, no date arithmetic. The order of
 * the output follows the order of `testCases`, which is itself sorted by
 * release timestamp and then by override identifier.
 *
 * Synthetic institution and data.
 */

import { testCases } from "./assurance";
import { users } from "./institution";
import {
  DEFAULT_RUN_ID,
  ENTITY_AT,
  ENTITY_CH,
  ENTITY_DE,
  type NewEvidenceDocument,
  type NewTestCase,
} from "./contract";

/** The control test whose population these records belong to. */
const TEST_ID = "TST-2026-0318";

/** The control under test. Every record below is evidence of its operation. */
const CONTROL_ID = "CTL-PAY-014";

/**
 * The Novalink service account the bulk approval screen writes in place of a
 * human reviewer identity. Held as a literal here rather than imported,
 * because `assurance.ts` keeps it private and this module only needs to
 * recognise it.
 */
const SERVICE_ACCOUNT_ID = "svc_repairbatch";

/** Person name by user identifier, taken from the people register. */
const PERSON_NAME = new Map<string, string>(users.map((user) => [String(user.id), user.name]));

function personLabel(userId: string | null | undefined): string {
  if (!userId) return "no identity recorded";
  if (userId === SERVICE_ACCOUNT_ID) return `service account ${SERVICE_ACCOUNT_ID}`;
  const name = PERSON_NAME.get(userId);
  return name ? `${name} (${userId})` : userId;
}

function entityName(entityId: string): string {
  if (entityId === ENTITY_AT) return "Arcadia Bank Oesterreich AG";
  if (entityId === ENTITY_CH) return "Arcadia Bank Schweiz AG";
  return "Arcadia Bank AG";
}

function repairQueue(entityId: string): string {
  if (entityId === ENTITY_AT) return "Q-REPAIR-AT";
  if (entityId === ENTITY_CH) return "Q-REPAIR-CH";
  return "Q-REPAIR-DE";
}

/** "2026-06-01" becomes "01.06.2026", which is the convention the corpus uses. */
function germanDate(isoDate: string): string {
  const [year = "", month = "", day = ""] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Minor units to a readable amount. Cents are shown only when they are not
 * zero, because a payment file that reads EUR 84,300.00 everywhere hides the
 * handful of instructions that carry odd cents.
 */
function formatAmount(amountMinor: number, currency: string): string {
  const whole = Math.trunc(amountMinor / 100);
  const cents = amountMinor - whole * 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const centText = cents === 0 ? "" : `.${String(cents).padStart(2, "0")}`;
  return `${currency} ${grouped}${centText}`;
}

/**
 * What the repair actually did, by validation failure reason code. The codes
 * are bible 6.3 and the code text is already carried on the test case row, so
 * this map only supplies the repair action that the code implies.
 */
const REPAIR_ACTION: Record<string, string> = {
  R01:
    "the beneficiary IBAN and BIC pair was corrected against the client static data held in SYS-0017 and the validation block was released",
  R02:
    "the cross-border regulatory reporting data set required above EUR 12,500 was completed on the instruction",
  R03:
    "the beneficiary name was reconciled to the beneficiary account record and the mismatch block was released",
  R04:
    "the clearing route recorded on the instruction was substituted for an available route and the instruction was resubmitted",
  R05:
    "the instruction was compared against the prior release for the same debtor, amount and value date and confirmed not to be a duplicate",
  R07:
    "cover was confirmed with the funding desk at cut-off and the insufficient cover block was released",
  R08:
    "the missing corporate mandate static data was completed from the mandate file and the block was released",
};

function repairAction(repairReason: string): string {
  const code = repairReason.slice(0, 3);
  return (
    REPAIR_ACTION[code] ?? "the validation block was released after manual repair of the instruction"
  );
}

/**
 * The six shapes a review paragraph can take. The shape is read off the row
 * rather than asserted, so a record cannot claim a review the row does not
 * carry.
 */
type ReviewShape =
  | "independent"
  | "self-review"
  | "after-release"
  | "service-account"
  | "object-unresolvable"
  | "waived";

function reviewShape(testCase: NewTestCase): ReviewShape {
  if (!testCase.reviewerUserId) return "waived";
  if (testCase.reviewerUserId === SERVICE_ACCOUNT_ID) return "service-account";
  if (testCase.reviewerUserId === testCase.repairedByUserId) return "self-review";
  if (testCase.anomalyKind === "sequence-failure") return "after-release";
  if (testCase.reviewEvidenceRef && !testCase.secondaryReviewEvidenced) return "object-unresolvable";
  return "independent";
}

function reviewParagraph(testCase: NewTestCase): string {
  const reviewer = personLabel(testCase.reviewerUserId);
  const creator = personLabel(testCase.repairedByUserId);

  switch (reviewShape(testCase)) {
    case "waived":
      return (
        "Secondary review. No review record exists on this override. The field secondaryReviewRequired " +
        "was written false at the OVERRIDE_PROPOSED transition, secondaryReviewerId is null, and the " +
        "field reviewWaiverCode carries BCP-THROUGHPUT. The release proceeded without any review action " +
        "being presented to a human. The waiver was written by rule evaluation and not by a user."
      );
    case "service-account":
      return (
        `Secondary review. A review record exists and carries the decision APPROVED. The identity ` +
        `written to secondaryReviewerId is ${reviewer}, which is a Novalink service account and not a ` +
        `person. The review was submitted through the RepairDesk bulk approval screen, which writes the ` +
        `service account identity in place of the identity of the operator. This record therefore cannot ` +
        `state which human, if any, reviewed the override created by ${creator}.`
      );
    case "self-review":
      return (
        `Secondary review. A complete review record exists and carries the decision APPROVED. The ` +
        `identity written to secondaryReviewerId is ${reviewer}, which is the same identity written to ` +
        `createdBy. The account holds both the Repair Analyst and the Secondary Reviewer role assignment ` +
        `and the system accepted both signatures from it. Read on its own the record looks ordinary, ` +
        `because the two names on it match.`
      );
    case "after-release":
      return (
        `Secondary review. A complete review record exists, submitted by ${reviewer}, who did not create ` +
        `the override, and carrying the decision APPROVED. The review timestamp is later than the release ` +
        `timestamp on the same record. RepairDesk did not block release while the review was ` +
        `outstanding, so the two events are recorded in that order in one audit log and the order is not ` +
        `a clock difference between two systems.`
      );
    case "object-unresolvable":
      return (
        `Secondary review. A complete review record exists, submitted by ${reviewer}, who did not create ` +
        `the override, and carrying the decision APPROVED. The evidence object referenced on the review ` +
        `does not resolve: the link points into the Novalink evidence store and returns nothing. The ` +
        `review is present and the basis on which it was given cannot be retrieved.`
      );
    default:
      return (
        `Secondary review. Submitted by ${reviewer}, who is not the identity recorded in createdBy, with ` +
        `the decision APPROVED recorded before the instruction was released. The reviewer inspected the ` +
        `override reason, the referenced evidence object and the payment detail, which is the review ` +
        `action ${CONTROL_ID} requires.`
      );
  }
}

function evidenceReferenceParagraph(testCase: NewTestCase): string {
  if (!testCase.reviewEvidenceRef) {
    return (
      "Evidence reference. The field evidenceRef is null. No object is attached to this override and " +
      "nothing on the record shows the basis for the repair. The field is nullable in the RepairDesk " +
      "schema, so the record was accepted as complete."
    );
  }

  const shape = reviewShape(testCase);

  /*
   * The evidence object and the reviewer identity fail independently of each
   * other, so this paragraph is not allowed to borrow the review paragraph's
   * defect. On a service account review the object is intact and the person is
   * missing; on a broken link the person is named and the object is gone.
   */
  if (shape === "object-unresolvable") {
    return (
      `Evidence reference. The field evidenceRef carries ${testCase.reviewEvidenceRef}. The reference is ` +
      `present on the record and the object it names does not resolve, so the basis for the review can be ` +
      `tested on presence and cannot be tested on retrievability.`
    );
  }

  if (shape === "service-account") {
    return (
      `Evidence reference. The field evidenceRef carries ${testCase.reviewEvidenceRef} and the object ` +
      `retrieves from the Evidence Vault. The object is intact and the review it supports is complete. ` +
      `What this record cannot produce is the identity of the person who relied on it.`
    );
  }

  if (testCase.anomalyKind === "evidence-quality-generic") {
    return (
      `Evidence reference. The field evidenceRef carries ${testCase.reviewEvidenceRef} and the object ` +
      `retrieves. The object is a screenshot of a shared mailbox list. It shows that a message arrived ` +
      `and it does not show what the client said about the beneficiary account.`
    );
  }

  if (testCase.anomalyKind === "supplier-advice-not-referenced") {
    return (
      `Evidence reference. The field evidenceRef carries ${testCase.reviewEvidenceRef} and the object ` +
      `retrieves. The object is an internal message from the team channel stating that the supplier had ` +
      `confirmed the rule was misfiring. No Novalink service notification reference is recorded anywhere ` +
      `on the override.`
    );
  }

  if (!testCase.secondaryReviewEvidenced) {
    return (
      `Evidence reference. The field evidenceRef carries ${testCase.reviewEvidenceRef}. The reference is ` +
      `present on the record and retrieval of the object fails, so what the reviewer relied on cannot be ` +
      `re-performed from this record.`
    );
  }

  return (
    `Evidence reference. The field evidenceRef carries ${testCase.reviewEvidenceRef} and the object ` +
    `retrieves from the Evidence Vault. Content hash recorded at ingestion.`
  );
}

/**
 * How the control test disposed of this override, in the test's own terms.
 * Keyed on the anomaly kind carried by the row, so the record says what the
 * test found and nothing beyond it.
 */
const DISPOSITION: Record<string, string> = {
  "independence-failure":
    "recorded as an exception, failing attribute (b), which requires the reviewer not to be the override creator",
  "sequence-failure":
    "recorded as an exception, failing attribute (c), which requires the review timestamp to precede the release timestamp",
  "evidence-failure":
    "recorded as an exception, failing attribute (d), which requires an evidence reference to be present and retrievable",
  "configuration-driven-omission":
    "recorded as an exception, failing attribute (a), which requires a secondary review record to exist",
  "unable-to-conclude-reviewer-identity":
    "recorded as unable to conclude, because attribute (b) can be neither passed nor failed where the reviewer identity is a service account",
  "unable-to-conclude-evidence-retrieval":
    "recorded as unable to conclude, because attribute (d) passes on presence and cannot be tested on retrievability",
  "reciprocal-review-pair":
    "flagged by population analytics as one half of a reciprocal review pair, the two analysts having reviewed each other in the opposite roles, which no attribute in the test can detect",
  "evidence-quality-generic":
    "flagged by population analytics on evidence quality, attribute (d) testing presence and retrievability and being silent on sufficiency",
  "bulk-approval-burst":
    "flagged by population analytics as part of a month end burst of approvals submitted through the bulk approval screen in one submission",
  "review-duration-implausible":
    "flagged by population analytics because the interval between proposal and review is too short for the review action the control description describes",
  "supplier-advice-not-referenced":
    "flagged by population analytics because the override reason rests on supplier advice that is not referenced on the record",
  "reviewer-concentration":
    "flagged by population analytics on reviewer concentration, the reviewer carrying the great majority of the queue's reviews in the period",
  "control-owner-as-reviewer":
    "flagged by population analytics because the reviewer is the owner of the control, attribute (b) testing identity and not role",
  "waiver-threshold-near-miss":
    "flagged by population analytics because the release sat just above the value condition of RD-RULE-0031, so the waiver was evaluated and did not fire",
  "service-account-reviewer":
    "flagged by population analytics because the reviewer identity written to the record is a service account",
  "out-of-hours-release":
    "flagged by population analytics as a release close to the end of the process operating window, reviewed by a person outside the designated reviewer group",
};

function dispositionParagraph(testCase: NewTestCase): string {
  const sampleText = testCase.inSample
    ? `This override was drawn into the ${TEST_ID} statistical sample of 60 and all five attributes were tested against it.`
    : `This override was not drawn into the ${TEST_ID} sample, so no attribute was tested against it. It sits in the inspectable population only.`;

  if (testCase.outcome === "conforming") {
    return `${sampleText} No attribute deviation is recorded against the record.`;
  }

  const disposition = testCase.anomalyKind ? DISPOSITION[testCase.anomalyKind] : undefined;
  if (!disposition) return sampleText;
  return `${sampleText} In ${TEST_ID} the item is ${disposition}.`;
}

/**
 * One override record extract, derived from one test case row.
 *
 * `documentId` is passed in rather than read off the row because a row may
 * cite more than one object, and the first cited identifier is the override
 * record itself.
 */
function overrideRecordDocument(testCase: NewTestCase, documentId: string): NewEvidenceDocument {
  const date = testCase.occurredAt.slice(0, 10);
  const time = testCase.occurredAt.slice(11, 16);
  const amount = formatAmount(testCase.amountMinor, testCase.currency);
  const queue = repairQueue(testCase.entityId);
  const entity = entityName(testCase.entityId);
  const creator = personLabel(testCase.repairedByUserId);

  const body = [
    `OVERRIDE RECORD EXTRACT ${testCase.id}. Source SYS-0014 Novalink RepairDesk, override register, ` +
      `tenant arcadia-prod. Entity partition ${testCase.entityId}, ${entity}. Queue ${queue}. Written ` +
      `to SYS-0032 Arcadia Evidence Vault by the daily override register feed of ${germanDate(date)}. ` +
      `Contains payment detail and internal identifiers.`,

    `Instruction. Payment instruction ${testCase.transactionRef}, value ${amount}. The instruction ` +
      `failed payment validation with reason ${testCase.repairReason} and was routed to repair queue ` +
      `${queue} rather than released or rejected.`,

    `Override. Created at ${time} on ${germanDate(date)} by ${creator}. Repair applied: ` +
      `${repairAction(testCase.repairReason)}. The record carries the failure reason code, the repair ` +
      `applied, the value, the creating identity and the release path.`,

    reviewParagraph(testCase),

    evidenceReferenceParagraph(testCase),

    dispositionParagraph(testCase),

    `Extract integrity. Field set as extracted: overrideId, instructionId, entity, queue, ` +
      `overrideReasonCode, failureReasonCodes, valueAmount, valueCurrency, evidenceRef, createdBy, ` +
      `createdAt, fallbackRouteMode, secondaryReviewRequired, reviewWaiverCode, secondaryReviewerId, ` +
      `secondaryReviewAt, reviewDecision, releasedBy, releasedAt. Content hash recorded in SYS-0032.`,
  ].join("\n\n");

  const reviewSummary = ((): string => {
    switch (reviewShape(testCase)) {
      case "waived":
        return "no review record exists and the requirement was waived by rule evaluation";
      case "service-account":
        return "the review record names a Novalink service account rather than a person";
      case "self-review":
        return "the review was signed by the identity that created the override";
      case "after-release":
        return "the review was recorded after the instruction had been released";
      case "object-unresolvable":
        return "the review is present and the object it relied on does not resolve";
      default:
        return "the review was signed before release by an identity that did not create the override";
    }
  })();

  return {
    id: documentId,
    runId: DEFAULT_RUN_ID,
    reference: testCase.id,
    title: `Override record extract ${testCase.id}, ${entity}, ${germanDate(date)}, ${amount}`,
    titleDe: `Auszug aus dem Ueberschreibungsdatensatz ${testCase.id}, ${entity}, ${germanDate(date)}`,
    sourceType: "transaction-log",
    sourceSystem: "SYS-0014 Novalink RepairDesk",
    authorLabel: "Novalink RepairDesk override register, daily feed to the Arcadia Evidence Vault",
    authorUserId: null,
    documentDate: date,
    ingestedAt: `${date}T23:55:00.000Z`,
    entityIds: [testCase.entityId],
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body,
    summary:
      `The RepairDesk override record behind ${testCase.transactionRef}, ${amount} released on ` +
      `${germanDate(date)} under ${testCase.repairReason.slice(0, 3)}, in which ${reviewSummary}.`,
    relatedObjectIds: [
      testCase.id,
      CONTROL_ID,
      TEST_ID,
      testCase.transactionRef,
      "PRC-0041",
      "SYS-0014",
    ],
    pageCount: testCase.outcome === "conforming" ? 1 : 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  };
}

/**
 * The rule evaluation trace attached to an override alongside its record.
 *
 * One override in the population carries a second cited object, and it is not
 * a second copy of the record: it is the RD-RULE-0031 evaluation trace, which
 * is the artefact that shows the waiver was evaluated against the value of
 * this particular payment and did not fire. Generating a duplicate override
 * record under that identifier would have been a citation that resolves and
 * points at the wrong thing.
 */
function ruleTraceDocument(testCase: NewTestCase, documentId: string): NewEvidenceDocument {
  const date = testCase.occurredAt.slice(0, 10);
  const time = testCase.occurredAt.slice(11, 16);
  const amount = formatAmount(testCase.amountMinor, testCase.currency);
  const thresholdMinor = 25000000;
  const marginMinor = testCase.amountMinor - thresholdMinor;
  const margin = formatAmount(Math.abs(marginMinor), testCase.currency);
  const side = marginMinor >= 0 ? "above" : "below";
  const waived = marginMinor < 0;

  const body = [
    `RULE EVALUATION TRACE. Override ${testCase.id}. Source SYS-0014 Novalink RepairDesk rule ` +
      `evaluation log, tenant arcadia-prod. Transition OVERRIDE_PROPOSED at ${time} on ` +
      `${germanDate(date)}. Extracted with the override record for control test ${TEST_ID}.`,

    `Rules evaluated on the transition. Four rules were evaluated. The third, identified as ` +
      `RD-RULE-0031, governs whether the secondary review requirement is written to the override. Its ` +
      `four conditions are: the override reason code is route substitution; fallbackRouteMode on the ` +
      `queue is ACTIVE; the value of the instruction is below EUR 250,000; and the currency is EUR.`,

    `Condition results on this override. The reason code condition is met, the override being a route ` +
      `substitution. The fallback condition is met, fallbackRouteMode having been ACTIVE on ` +
      `${repairQueue(testCase.entityId)} at the moment of evaluation. The currency condition is met, ` +
      `the instruction being denominated in ${testCase.currency}. The value condition is not met: the ` +
      `instruction is ${amount}, which is ${margin} ${side} the EUR 250,000 limit the condition sets.`,

    waived
      ? `Result. Waived. The rule returned a result of waived, wrote reviewWaiverCode BCP-THROUGHPUT ` +
        `and set secondaryReviewRequired to false. No review action was presented to a human.`
      : `Result. Not waived. Three of the four conditions were met and the rule returned no waiver, so ` +
        `secondaryReviewRequired stayed true and a reviewer had to sign the override before release. ` +
        `The review requirement survived on the value of the payment and not on the operation of the ` +
        `control.`,

    `Why the trace matters on its own. The trace is the only record on the override that shows the ` +
      `review requirement to be derived at runtime rather than fixed. The ${CONTROL_ID} control ` +
      `description states that review applies to every override without exception and names no system ` +
      `condition, so a reader holding only the description and the override record cannot see that a ` +
      `rule was consulted at all.`,

    `Extract integrity. Delivered with the override register extract. Content hash recorded in ` +
      `SYS-0032.`,
  ].join("\n\n");

  return {
    id: documentId,
    runId: DEFAULT_RUN_ID,
    reference: `${testCase.id} TRACE`,
    title: `RD-RULE-0031 evaluation trace for override ${testCase.id}, ${germanDate(date)}`,
    titleDe: `Regelauswertungsspur RD-RULE-0031 zur Ueberschreibung ${testCase.id}, ${germanDate(date)}`,
    sourceType: "transaction-log",
    sourceSystem: "SYS-0014 Novalink RepairDesk",
    authorLabel: "Novalink RepairDesk rule evaluation log, extracted with the override register",
    authorUserId: null,
    documentDate: date,
    ingestedAt: `${date}T23:55:00.000Z`,
    entityIds: [testCase.entityId],
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body,
    summary:
      `The rule evaluation trace for ${testCase.id}. It records RD-RULE-0031 evaluated against a ` +
      `${amount} release with the value condition ${waived ? "met" : "not met"}, which is what shows ` +
      `the waiver to be value driven.`,
    relatedObjectIds: [testCase.id, CONTROL_ID, TEST_ID, "RD-RULE-0031", "SYS-0014"],
    pageCount: 1,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  };
}

/**
 * Identifiers already held by the authored corpus.
 *
 * A test case may cite an authored document alongside its own record, and
 * exception four does exactly that: it cites the CTL-PAY-014 control
 * description as well as its override record. That citation already resolves
 * and must not be written a second time under the same identifier.
 */
const AUTHORED_IDENTIFIERS = new Set<string>([
  "EVD-2026-40118", "EVD-2026-40233", "EVD-2026-41102", "EVD-2026-41105",
  "EVD-2026-41200", "EVD-2026-41202", "EVD-2026-41204", "EVD-2026-41205",
  "EVD-2026-41210", "EVD-2026-41215", "EVD-2026-41220", "EVD-2026-41225",
  "EVD-2026-41230", "EVD-2026-41235", "EVD-2026-41240", "EVD-2026-41250",
  "EVD-2026-41255", "EVD-2026-41260", "EVD-2026-41270", "EVD-2026-41275",
  "EVD-2026-41280", "EVD-2026-41285", "EVD-2026-41290", "EVD-2026-41300",
  "EVD-2026-41305", "EVD-2026-41310", "EVD-2026-41315", "EVD-2026-41320",
  "EVD-2026-41400", "EVD-2026-41402", "EVD-2026-41405", "EVD-2026-41410",
  "EVD-2026-41415", "EVD-2026-41420", "EVD-2026-41425", "EVD-2026-41430",
  "EVD-2026-41435", "EVD-2026-41440", "EVD-2026-41445", "EVD-2026-41500",
  "EVD-2026-41505", "EVD-2026-41600", "EVD-2026-41605", "EVD-2026-41610",
  "EVD-2026-41615", "EVD-2026-41700", "EVD-2026-41705", "EVD-2026-41710",
  "EVD-2026-41805", "EVD-2026-41810", "EVD-2026-41820", "EVD-2026-41821",
  "EVD-2026-41822", "EVD-2026-41850", "EVD-2026-41852", "EVD-2026-41855",
  "EVD-2026-41860", "EVD-2026-41865", "EVD-2026-41871", "EVD-2026-41872",
  "EVD-2026-41874", "EVD-2026-41875", "EVD-2026-41876", "EVD-2026-41878",
  "EVD-2026-41882", "EVD-2026-41901", "EVD-2026-41905", "EVD-2026-41906",
  "EVD-2026-41907", "EVD-2026-41908", "EVD-2026-41911", "EVD-2026-41915",
  "EVD-2026-41918", "EVD-2026-41921", "EVD-2026-41924", "EVD-2026-41930",
  "EVD-2026-41935",
]);

/**
 * The override records, one per cited identifier in the population.
 *
 * Ninety nine of the hundred test cases cite at least one record. The
 * hundredth cites nothing, and correctly so: it is the exception where the
 * evidence reference is null and no review record exists to point at, and a
 * generated document there would have manufactured the very thing the test
 * found missing.
 */
const overrideRecordDocuments: NewEvidenceDocument[] = testCases.flatMap((testCase) => {
  const pending = (testCase.evidenceDocumentIds ?? []).filter(
    (id) => !AUTHORED_IDENTIFIERS.has(id),
  );
  if (pending.length === 0) return [];

  const [primary, ...rest] = pending as string[];
  const documents = [overrideRecordDocument(testCase, primary as string)];
  for (const id of rest) documents.push(ruleTraceDocument(testCase, id));
  return documents;
});

/* ==========================================================================
   Authored artefacts

   Two documents that the challenge session preparation and the incident
   chronology cite, and that no document in the authored corpus is. They are
   written by hand rather than derived, because neither is a payment record.
   ========================================================================== */

const authoredDocuments: NewEvidenceDocument[] = [
  /*
   * The population and selection working paper. WP-07 signs itself off as
   * cross-referenced to the population extract of 07.09.2026, and the Control
   * Assurance challenge session is prepared from that extract, but the extract
   * itself was never written down. Without it the selection cannot be
   * re-performed, which is the one thing a reader is entitled to check about a
   * statistical sample.
   */
  {
    id: "EVD-2026-41304",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0318 WP-01",
    title:
      "Control test TST-2026-0318 working paper WP-01, override population extract and sample selection",
    titleDe:
      "Arbeitspapier WP-01 zum Kontrolltest TST-2026-0318, Grundgesamtheit der Ueberschreibungen und Stichprobenauswahl",
    sourceType: "control-test-report",
    sourceSystem: "SYS-0032 Arcadia Evidence Vault",
    authorLabel: "Jakob Steinbacher, Control Assurance Specialist",
    authorUserId: "P-004",
    documentDate: "2026-09-07",
    ingestedAt: "2026-09-07T17:48:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    dataClassification: "strictly-confidential",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "WORKING PAPER WP-01. Prepared 07.09.2026, the first day of fieldwork on TST-2026-0318. Supports section 1 and section 2 of the test report. Contains payment values and internal identifiers; classified strictly confidential.\n\n" +
      "Population. Every manual override record created in SYS-0014 Novalink RepairDesk between 01.06.2026 and 31.08.2026 across ARC-DE, ARC-AT and ARC-CH. Extracted 07.09.2026. Record count 1,204. The count reconciles to the SYS-0011 Arcadia Payment Hub override population for the same period, and the reconciliation is recorded on the face of this paper.\n\n" +
      "Population composition. By entity: ARC-DE 892, ARC-AT 187, ARC-CH 125. By month: June 381, July 402, August 421. The rise across the three months is not explained in this paper and is carried to the analytics section as an observation.\n\n" +
      "Sample. 60 items, drawn by attribute sampling, statistical, random selection over the full 1,204 using a seeded generator so that the selection is reproducible by anyone holding the seed and the population file. Tolerable deviation rate 5 percent. Expected deviation rate 0 percent. The seed, the generator and the ordered population file are held with this paper, which is what makes the selection re-performable rather than merely disclosed.\n\n" +
      "What the sample was not stratified by. The selection was not stratified by value, by override reason code, by reviewer identity, or by whether the queue was in fallback operation at the moment of the override. That is a consequence of a simple random selection and it is stated here rather than left to be inferred, because three of those four dimensions turned out to matter.\n\n" +
      "Population analytics performed over all 1,204 items, independently of the sample. Records with a null evidence reference. Records where the reviewer identity equals the creating identity. Records where the review timestamp is later than the release timestamp. Records where the reviewer identity is a service account. Records where secondaryReviewRequired is false. Records approved in bursts through the bulk approval screen. The analytics flag items for inspection and they do not test attributes, so a flagged item that was never sampled carries no attribute result and no deviation.\n\n" +
      "Extract retained. The 100 override records loaded into the inspectable extract for this test are the 60 drawn items and 40 unsampled neighbours selected by the analytics above, covering ARC-DE and ARC-AT. The ARC-CH overrides in the period are operated from Zurich and are represented in the population count only. Each of the 100 records is held in the Evidence Vault as an individual override record extract and is citable in its own right.\n\n" +
      "Tester sign-off. Population extracted, reconciled and sealed 07.09.2026. Selection performed 07.09.2026. Reviewed by the Head of Group Control Assurance on 08.09.2026.",
    summary:
      "The population and selection paper behind TST-2026-0318: 1,204 overrides extracted on 07.09.2026, a reproducible random sample of 60, and an explicit statement that the selection was not stratified by value, reason code, reviewer or fallback operation.",
    relatedObjectIds: [
      "TST-2026-0318",
      "CTL-PAY-014",
      "PRC-0041",
      "SYS-0014",
      "SYS-0011",
      "POL-IKS-3.2",
    ],
    pageCount: 5,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },

  /*
   * The 18.09.2026 rollback confirmation. The chronology of INC-2026-0379
   * turns on this document: the telemetry inference at 09:52 named the
   * supplier and this record names an Arcadia firewall change. It is the only
   * entry in the history where the conflict resolved against the person who
   * raised it, and nothing in the authored corpus records it. The September
   * availability analysis carries the same episode as a network path failure
   * precisely because the Arcadia edge measurement could not locate the fault.
   */
  {
    id: "EVD-2026-41104",
    runId: DEFAULT_RUN_ID,
    reference: "CHG-2026-7602 ROLLBACK",
    title:
      "Arcadia change record CHG-2026-7602 with rollback confirmation, firewall policy change on the NOVA-GATE submission path",
    titleDe:
      "Arcadia Aenderungsdatensatz CHG-2026-7602 mit Rueckabwicklungsbestaetigung, Firewall-Richtlinie im Einlieferungspfad zu NOVA-GATE",
    sourceType: "process-map",
    sourceSystem: "SYS-0031 Arcadia RiskCore",
    authorLabel: "ARC-DE Technology, Network Services, change owner",
    authorUserId: null,
    documentDate: "2026-09-18",
    ingestedAt: "2026-09-18T12:05:00.000Z",
    entityIds: [ENTITY_DE, ENTITY_AT],
    dataClassification: "internal",
    status: "current",
    requestedFromLabel: null,
    requestedOn: null,
    isStale: false,
    stalenessNote: "",
    provenance: "verified-fact",
    body:
      "CHANGE RECORD CHG-2026-7602. Raised 16.09.2026. Implemented 18.09.2026 at 09:31. Rolled back 18.09.2026 at 10:28. Closed 18.09.2026 with the outcome rolled back. Change owner: ARC-DE Technology, Network Services. Standard change, pre-approved category.\n\n" +
      "Change as implemented. A firewall policy tightening on the outbound submission path from SYS-0011 Arcadia Payment Hub to SYS-0012 NOVA-GATE, narrowing the permitted source address range. Implemented at 09:31 inside the standard change window.\n\n" +
      "Effect observed. From 09:39 the Arcadia Payment Hub recorded acknowledgement latency above threshold and submission timeouts on the NOVA-GATE path. At 09:52 the monitoring alert was raised and was read at the Arcadia edge as supplier-side degradation, consistent with the pattern of 04.09.2026 and 11.09.2026. The acting Duty Manager invoked runbook RB-PAY-007 and set fallbackRouteMode ACTIVE on the German and Austrian repair queues.\n\n" +
      "Cause established. Investigation by Network Services between 10:04 and 10:24 established that the narrowed source range excluded one of the two Payment Hub submission nodes. NOVA-GATE was operating normally throughout and no supplier-side fault existed. The change was rolled back at 10:28 and submission latency returned to normal immediately. Fallback route mode was set back to INACTIVE at 10:32.\n\n" +
      "Control consequence recorded on the change record. 19 route substitution overrides were created in the fallback interval. Two of those 19 were released without a secondary review because RD-RULE-0031 fired on them. Both were re-checked against SYS-0017 Client Static Data Master on 21.09.2026 and both were correctly repaired. No payment loss arose.\n\n" +
      "Lesson recorded on closure. The 09:52 inference named the supplier and was wrong, while the measurement behind it was correct: the metric is taken at the Arcadia edge and cannot locate the fault. The lesson recorded on closure was to add a supplier-side confirmation step to RB-PAY-007 before fallback activation. The lesson was recorded as a note on the change record and was not raised as a Massnahme, so it carried no owner and no due date, and it had not been actioned by 06.10.2026.\n\n" +
      "Cross-reference. The September 2026 availability analysis records this episode as a network path failure of 40 minutes rather than as supplier degradation, which is the same conclusion reached here and the reason the monthly availability figure excludes it.",
    summary:
      "The Arcadia change and rollback record for 18.09.2026. A firewall policy change on the submission path to NOVA-GATE, not the supplier, caused the latency that triggered a fallback activation, and the lesson recorded on closure was never given an owner or a due date.",
    relatedObjectIds: [
      "INC-2026-0379",
      "CHG-2026-7602",
      "RB-PAY-007",
      "CTL-PAY-014",
      "RD-RULE-0031",
      "SYS-0011",
      "SYS-0012",
      "SYS-0014",
    ],
    pageCount: 2,
    fromSharedEvent: false,
    revealedAtMoment: "07:45",
  },
];

/**
 * The derived corpus, concatenated with the authored corpus at seed time.
 *
 * Order is stable: the override records in population order, then the two
 * authored artefacts.
 */
export const generatedEvidenceDocuments: NewEvidenceDocument[] = [
  ...overrideRecordDocuments,
  ...authoredDocuments,
];
