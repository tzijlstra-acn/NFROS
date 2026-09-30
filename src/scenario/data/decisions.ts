/**
 * Decisions, options, issues, actions, committee items, portfolio themes,
 * background actions and pre existing audit history.
 *
 * Authoritative source: docs/SCENARIO_BIBLE.md sections 8 to 16,
 * docs/NFR_ROLE_AND_WORK_ATLAS.md sections 3 to 8, and
 * docs/EXPERIENCE_MAP.md sections 2 to 12. Where this module and the bible
 * disagree, the bible wins and this module is fixed.
 *
 * Three structural rules govern this file and none of them is decorative.
 *
 *   1. Nothing is pre decided. Every decision row ships with status "open",
 *      a null chosen option, an empty rationale and no decider. The product's
 *      claim is that a named professional takes the judgment, so the seed
 *      must not have taken it for them.
 *
 *   2. Opposing evidence is populated on every decision and is genuinely
 *      opposing on the central ones. A prepared position that cites only
 *      supporting evidence is advocacy, not preparation.
 *
 *   3. Consequences are declared, not improvised. Every kind string in an
 *      option's consequences array is implemented in mapConsequence in
 *      src/scenario/engine/decide.ts. A kind that is not in that switch does
 *      not execute, and the receipt would silently lose a line.
 *
 * Synthetic institution and data. All persons are fictional. All figures are
 * scenario figures and none is a benchmark.
 */

import {
  DEFAULT_RUN_ID,
  ENTITY_AT,
  ENTITY_CH,
  ENTITY_DE,
  at,
  type NewAction,
  type NewAuditEvent,
  type NewBackgroundAction,
  type NewCommitteeItem,
  type NewDecision,
  type NewDecisionOption,
  type NewIssue,
  type NewPortfolioTheme,
} from "./contract";

/* ==========================================================================
   Referenced object identifiers

   Consequences mutate real seeded objects. The identifiers are collected here
   so that a rename in the domain, practice or work modules is a one line fix
   in this file rather than a hunt through a hundred consequence arrays.
   ========================================================================== */

/** The key control in the Internal Control System. Bible section 8. */
const CTL_FOUR_EYES = "CTL-PAY-014";
/** The two compensating controls the first line relies on. Bible section 8. */
const CTL_DUTY_SAMPLE = "CTL-PAY-021";
const CTL_VALUE_RECON = "CTL-PAY-029";
/** The quarterly assessment under challenge. Bible section 10. */
const RCSA_PAYOPS_Q4 = "RCSA-ARC-DE-PAYOPS-2026-Q4";
/** The contested line within that assessment. Bible section 10.1. */
const RCSA_LINE_RSK_0211 = "RCSA-ARC-DE-PAYOPS-2026-Q4-L01";
/** Payment repair and manual override. The off cycle reassessment subject. */
const PRC_REPAIR = "PRC-0041";
const RSK_UNAUTH_RELEASE = "RSK-0211";
const RSK_THIRD_PARTY_SERVICE = "RSK-0184";
/** Novalink Payment Services GmbH and its chain. Bible sections 7 and 7.2. */
const TP_NOVALINK = "TP-0042";
const TP_POLARIS = "TP-0042.3";
const TP_MERIDIAN = "TP-0042.4";
/** The combined design and operating effectiveness test. Bible section 8.1. */
const TST_FOUR_EYES = "TST-2026-0318";
/**
 * The test on the tested fallback arrangements control, CTL-RES-003. It is the
 * control test a resilience finding about an unexercised fallback route
 * attaches to, which the indicator identifier is not.
 */
const TST_FALLBACK_TESTED = "TST-2026-0302";
/**
 * The three test items the day argues about.
 *
 * Bible 8.2 and 8.3 name these items EXC-TST-2026-0318-01, -04 and
 * UTC-TST-2026-0318-01, and that is how a professional refers to them in a
 * report. Those are report labels, not row identifiers. The population rows
 * in `assurance.ts` are override records and carry the override identifier
 * convention of bible 6.6, which is what a consequence has to name, because
 * `classifyTestException` updates a `test_cases` row by its primary key.
 * The report label for each item is in the note on the row it points at.
 */
const EXC_SELF_REVIEW = "OVR-DE-20260714-0112";
const EXC_RULE_WAIVER = "OVR-DE-20260827-0119";
const UTC_SERVICE_ACCOUNT = "OVR-DE-20260702-0108";
/**
 * Runbook RB-PAY-007 as it exists in the Evidence Vault.
 *
 * The runbook is a document and not a register object, so there is no runbook
 * row to attach an action or a message to. The document is the object, and it
 * is the thing a reader needs to open when a finding says section 4 asserts
 * something untrue.
 */
const RB_FALLBACK_RUNBOOK = "EVD-2026-41705";
/** The 14:05 event. Bible section 15. */
const INC_EVENT = "INC-2026-0412";
/** The manual correspondent submission option for the Swiss tranche. */
const RCV_CH_CORRESPONDENT = "REC-0412-04";
/** Impact tolerances. Bible section 5.3. */
const ITOL_CH_CLEARING = "ITOL-0004-03";
const ITOL_ZERO_GATE = "ITOL-0004-04";
/** Indicators. Bible section 9. */
const KRI_OVERRIDE_RATE = "KRI-PAY-007";
const KRI_SUBPROCESSOR_RECORDS = "KRI-TPR-002";
const KRI_TESTED_FALLBACK = "KRI-RES-005";
/**
 * Obligations. Bible sections 13 and 18. The two lanes never merge.
 *
 * Each identifier below is a row seeded by `event.ts`, which extracts
 * eighteen candidate obligations from the six publications. The EU lane
 * candidates list ARC-DE and ARC-AT and the Swiss lane candidates list ARC-CH
 * alone, so a consequence that records an interpretation cannot silently
 * apply a determination to the wrong entity.
 *
 * OBL-2026-0031-001, section 2 paragraph 3: the register must reach the
 * entity that actually performs the service, which is the subcontracting
 * chain completeness question in the EU lane.
 *
 * OBL-2026-0088-002, margin number 11: where a subcontractor can access
 * client-identifying data from outside Switzerland, the data categories must
 * be known, documented and recorded in a dated assessment, which is the Swiss
 * inventory and data access question and is not the same requirement.
 *
 * OBL-2026-0117-001, article 3(2): the seven incident classification
 * criteria, each assessed and recorded including the ones not met.
 */
const OBL_EU_SUBCONTRACTING = "OBL-2026-0031-001";
const OBL_CH_INVENTORY_ACCESS = "OBL-2026-0088-002";
const OBL_TOLERANCE_DEFINITION = "OBL-2026-0104-003";
const OBL_INCIDENT_CLASSIFICATION = "OBL-2026-0117-001";
/** Cross function themes owned by this module. */
const THEME_OVERRIDE = "THEME-PAY-01";

/**
 * The shared decision thread.
 *
 * One event, six professional lenses, one decision thread. Sixteen decisions
 * across all six roles carry this identifier, because they are all judgments
 * about the same underlying matter: manual payment overrides released without
 * the secondary review that CTL-PAY-014 requires, and the supplier
 * configuration rule that waived it.
 */
const THREAD_OVERRIDE = "THREAD-PAYMENTS-OVERRIDE";

/* ==========================================================================
   Evidence

   Every EVD identifier cited in this module is a document seeded by
   src/scenario/data/evidence.ts. Nothing is cited that does not exist, which
   is the whole point of a citation: a decision brief whose evidence link
   resolves to nothing is a decision brief that has not been checked.

   Both directions are populated on every decision. The supporting set is the
   evidence the prepared position rests on. The opposing set is the evidence
   that cuts against it, and on the central decisions it is genuinely
   opposing rather than decorative: the loss register against the control
   test, the client confirmations against the exception schedule, the
   supplier's own notification against its own telemetry.
   ========================================================================== */

/**
 * Every decision ships open. This spread is applied to all thirty eight rows
 * so that a future edit cannot accidentally seed a decided decision.
 */
const OPEN = {
  status: "open",
  chosenOptionId: null,
  recordedRationale: "",
  decidedByUserId: null,
  decidedAtMoment: null,
  decidedAt: null,
} as const;

/* ==========================================================================
   Decisions

   Thirty eight rows. Eighteen are presented at 07:45, three per role, because
   the morning brief opens with three decision cards and that is a fixed story
   beat. Six are presented at 11:45, the human decision point, one per role.
   Fourteen are presented from 14:05 onwards and carry fromSharedEvent.

   A note on judgmentKind. The schema documents eleven categories. Two mappings
   are worth stating because they are not obvious. A prioritisation judgment
   ("which of these two matters gets my morning") is recorded as "agenda",
   because it is a judgment about what work gets heard. A systemic versus
   isolated judgment is recorded as "materiality", because deciding that a
   deviation is systemic is a judgment about the scope of what is wrong.
   ========================================================================== */

export const decisions: NewDecision[] = [
  /* ----------------------------------------------------------------------
     tprm, P-002 Stefan Brunner
     ---------------------------------------------------------------------- */

  {
    id: "DEC-2026-0741",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-D1",
    roleId: "tprm",
    entityId: ENTITY_DE,
    title: "RepairDesk recovery time gap, unescalated for 137 days",
    titleDe: "Luecke bei der Wiederherstellungszeit von RepairDesk, 137 Tage nicht eskaliert",
    question:
      "Novalink's own DR test report shows RepairDesk recovering in 3 hours 40 minutes against a contracted objective of 2 hours. It has been in our vault since 22.05.2026 and nobody escalated it. Is that a material assurance gap that changes the reassessment conclusion, or a service level point I handle in the monthly review?",
    judgmentKind: "materiality",
    presentedAtMoment: "07:45",
    priorityRank: 1,
    whyThisMatters:
      "A recovery objective that the supplier's own test does not meet is not a reporting nicety. It is the number your resilience colleague uses to size a tolerance, and it is wrong by 1 hour 40 minutes on the tool that repairs payments for three entities. The second finding is about Arcadia: the evidence was retrievable for 137 days and nobody read it, which is a different failure from not having the evidence at all.",
    preparedPosition:
      "Assessed as a material gap on two grounds. First, the delta is 1 hour 40 minutes on a service supporting an important business service, and there is no remediation plan and no supplier notification of the miss. Second, the report covers the Frankfurt and Amsterdam regions only, so the Swiss instance at TP-0042.1 has no recovery evidence at all, which means the gap on the Swiss side is not measured rather than merely large. TPRM-Q-2026-R07 should move from open to a raised finding, and TPRM-Q-2026-R04 should stay open with the Swiss scope named.",
    supportingEvidenceIds: ["EVD-2026-40118", "EVD-2026-41425", "EVD-2026-41445"],
    opposingEvidenceIds: ["EVD-2026-41435", "EVD-2026-41102"],
    uncertaintyNote:
      "The 22.05.2026 test was a supplier exercise under supplier-defined conditions. Arcadia did not observe it and has no basis to say whether the 3 hours 40 minutes was a realistic or a pessimistic run. The contracted objective of 2 hours in Appendix A1 does not define the test conditions it is measured under, which means the two figures may not be comparable, and that ambiguity is in Arcadia's contract rather than in the supplier's report.",
    confidence: 0.71,
    requiredAuthority:
      "Third-party risk materiality determination for a Tier 1 arrangement, Group Third-Party Risk Policy section 5.4, held by the relationship risk owner.",
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0742",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-D2",
    roleId: "tprm",
    entityId: ENTITY_DE,
    title: "Where the morning goes: the cycle date or the appendix divergence",
    titleDe: "Wohin der Morgen geht: Zyklustermin oder Anlagenabweichung",
    question:
      "The reassessment is 25 days from its target close with four unresolved resilience questions, and the binding subprocessor appendix does not match the supplier's own register. Both need me today. Which one gets the morning?",
    judgmentKind: "agenda",
    presentedAtMoment: "07:45",
    priorityRank: 2,
    whyThisMatters:
      "These two items fail in opposite directions. The reassessment has a date and can close on time with open items recorded, which is unsatisfying but survivable. The divergence has no date, and it cannot be resolved without a contractual route that takes weeks, which means every day it waits is a day removed from the only window that exists before the committee.",
    preparedPosition:
      "The divergence is the item with the shorter real fuse despite having no date on it. Closing the reassessment with four open resilience questions is a recorded, defensible outcome. Arriving at the 13.10.2026 committee with an unnotified subprocessor in a third country, an undisclosed hosting region and no contractual route started is not. The reassessment work that genuinely needs you, as opposed to needing chasing, is TPRM-Q-2026-R11, and that is a half day rather than a morning.",
    supportingEvidenceIds: ["EVD-2026-41415", "EVD-2026-41405", "EVD-2026-41410"],
    opposingEvidenceIds: ["EVD-2026-41445", "EVD-2026-40118"],
    uncertaintyNote:
      "This ranking assumes the reassessment can close on time with open items. That depends on whether the assessment committee accepts a conditional close, and there is no recorded precedent in this cycle for a Tier 1 sole provider closing with four unresolved resilience questions. If it will not accept one, the two items have the same deadline and the ranking is wrong.",
    confidence: 0.62,
    requiredAuthority:
      "Own work prioritisation within the third-party risk mandate. No approval required, and the choice is recorded because it is later reviewable.",
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0743",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-D3",
    roleId: "tprm",
    entityId: ENTITY_DE,
    title: "Whether Novalink's September behaviour changes the criticality position",
    titleDe: "Ob das Verhalten von Novalink im September die Kritikalitaetsbewertung aendert",
    question:
      "Five fallback activations in September, a service level miss the supplier has not reported, an unnotified subprocessor and an unescalated recovery gap. Does any of that change the Tier 1 criticality and concentration rating, or does it only change the evidence for a rating I already hold?",
    judgmentKind: "criticality",
    presentedAtMoment: "07:45",
    priorityRank: 3,
    whyThisMatters:
      "Criticality drives contractual protection, testing obligations and register content. Raising it has a real cost and a real signal value. The honest answer may be that nothing has changed except that you can now evidence what you already believed, and saying so is more useful to the committee than an unexplained rating movement.",
    preparedPosition:
      "The rating does not move and the basis does. Tier 1, sole provider, concentration flagged and substitutability asserted without a test were all already recorded. What September adds is four assertion-versus-observation pairs: a recovery objective of 2 hours against a tested 3 hours 40 minutes, a contracted monthly availability of 99.7 against a calculated 99.62 (scenario figures), a 30 minute notification commitment, and a 60 day subprocessor notice obligation with no notice on record. The pattern is a supplier whose disclosure discipline has degraded, which is an assurance finding rather than a criticality change.",
    supportingEvidenceIds: ["EVD-2026-41240", "EVD-2026-41810", "EVD-2026-41405"],
    opposingEvidenceIds: ["EVD-2026-41425", "EVD-2026-41445"],
    uncertaintyNote:
      "The September availability figure of 99.62 is calculated from Arcadia-side submission telemetry and not from a Novalink service report, which Novalink has not published (scenario figures). If Novalink's measurement excludes different maintenance windows, the figure differs and the service level conclusion may not hold. The 11.09.2026 maintenance overrun of 2 hours 5 minutes is the whole of the difference, and Appendix A1 does not define how an overrun is treated.",
    confidence: 0.66,
    requiredAuthority:
      "Third-party criticality determination, Group Third-Party Risk Policy section 3.1. Held by the relationship risk owner, notified to the business owner.",
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0759",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-D4",
    roleId: "tprm",
    entityId: ENTITY_DE,
    title: "Breach, material change or drafting gap on the subprocessor appendix",
    titleDe: "Vertragsverletzung, wesentliche Aenderung oder Regelungsluecke in der Anlage",
    question:
      "The same facts support three characterisations of the appendix divergence: a notice failure I can assert, a material change that needs a variation, or a drafting gap that breaches nothing. Which is it, and what does that commit us to?",
    judgmentKind: "materiality",
    presentedAtMoment: "11:45",
    priorityRank: 4,
    whyThisMatters:
      "The choice determines whether the next step is a legal notice, a variation request or a conversation, and it commits Arcadia's negotiating position. It is expensive in both directions: an unjustified breach notice hardens a Tier 1 supplier that Arcadia needs cooperative for a reassessment due in 25 days, and an unasserted breach forfeits a right. The relationship has 23 months left on its initial term with a 12 month notice period, and Novalink knows it.",
    preparedPosition:
      "The divergence is three separate matters and not one, and treating it as one is what has kept it unresolved since 21.09.2026. Meridian in Pune is absent from the appendix entirely, onboarded 01.05.2026, with no notice on record after a repository and mailbox search: a notice failure under Appendix A3 clause 3.4. The Amsterdam region is listed for Rheinstack with Frankfurt only: a material change to a listed subprocessor requiring a variation rather than a breach assertion. Fourth parties are not addressed by the appendix at all, so Aurora in Dublin holding payment metadata for 24 months is a drafting gap with no obligation breached. Group Legal has confirmed that v4.2 binds.",
    supportingEvidenceIds: ["EVD-2026-41901", "EVD-2026-41235", "EVD-2026-41410", "EVD-2026-41405"],
    opposingEvidenceIds: ["EVD-2026-41402", "EVD-2026-41415"],
    uncertaintyNote:
      "Novalink's position on whether publication on its client portal constitutes notice under clause 3.4 is not known and is the single fact that most affects the characterisation. It can be obtained by asking, and asking it in writing may itself be read as asserting a breach. The nil return on notice covers the contract repository, two shared mailboxes and the category lead's filed correspondence; it does not cover individual mailboxes or verbal notice.",
    confidence: 0.58,
    requiredAuthority:
      "Contractual characterisation for a Tier 1 arrangement, Group Third-Party Risk Policy section 6.2, with Group Legal concurrence required before any notice is issued.",
    relatedObjectKind: "contract",
    relatedObjectId: "CTR-2023-0117-A3",
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0779",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-D5",
    roleId: "tprm",
    entityId: ENTITY_DE,
    title: "RD-RULE-0031: supplier failure or shared accountability",
    titleDe: "RD-RULE-0031: Lieferantenversagen oder geteilte Verantwortung",
    question:
      "The tenant configuration confirms a Novalink standard template silently removed our four-eyes gate in release 8.3, and that our own change approval let it through on release notes that never named a control waiver. Do I record this as a supplier failure, or as shared accountability that names Arcadia twice?",
    judgmentKind: "materiality",
    presentedAtMoment: "15:00",
    priorityRank: 5,
    whyThisMatters:
      "This is the finding the committee will read most closely, and the framing decides what happens next. A supplier failure produces a supplier action and a cleaner argument for Arcadia. Shared accountability produces three actions, one of which is a change in how Arcadia reviews supplier releases, and it costs you the clean argument. The change record and the release notes are Arcadia's own documents, which means the second framing is the one that survives contact with Internal Audit.",
    preparedPosition:
      "Shared accountability, with three named components. Novalink applied the rule from template BCP-THROUGHPUT-v2 during release 8.3 on 11.11.2024 and its release notes referred to continuity throughput improvements without naming a control waiver, which is non-disclosure. Arcadia approved the release under CHG-2024-5512 with no control owner review, which is a change governance failure. Arcadia then left the CTL-PAY-014 description asserting that review applies to all overrides without exception, unchanged since 14.01.2025, which is a control documentation failure. The rule is client configurable, so Arcadia could have removed it at any point in 23 months.",
    supportingEvidenceIds: ["EVD-2026-41905", "EVD-2026-41907", "EVD-2026-41906", "EVD-2026-41908"],
    opposingEvidenceIds: ["EVD-2026-41871", "EVD-2026-41420"],
    uncertaintyNote:
      "The firing history of 118 since 11.11.2024 is from the supplier's own export. Arcadia's configuration audit log independently confirms seven prior fallback windows plus today, which is consistent but does not verify the count. The supplier's characterisation that the configuration sits in the client tenant was made by a named person with a commercial interest, and it is partly correct: it is correct about where the rule sits and silent about how it got there.",
    confidence: 0.79,
    requiredAuthority:
      "Supplier finding accountability determination, Group Third-Party Risk Policy section 6.2. Any external attribution of fault requires Group Legal concurrence.",
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0785",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-D6",
    roleId: "tprm",
    entityId: ENTITY_DE,
    title: "Novalink 2026 reassessment: conditional approval and its conditions",
    titleDe: "Novalink Neubewertung 2026: bedingte Genehmigung und ihre Bedingungen",
    question:
      "The reassessment closes on 31.10.2026 and today added three evidenced findings to four open resilience questions. Do I take this to conditional approval, and if so on what conditions, or do I restrict the arrangement?",
    judgmentKind: "conditional-approval",
    presentedAtMoment: "16:30",
    priorityRank: 6,
    whyThisMatters:
      "A conditional approval with conditions nobody tracks is worse than no approval, because it creates the appearance of assurance. Arcadia already holds one conditional Risikoakzeptanz on this supplier whose exit test condition is unmet and unplanned, which is the exact failure mode. Whatever conditions you set, someone has to own them, and the day has shown what happens to conditions nobody owns.",
    preparedPosition:
      "Conditional approval is supportable and restriction is not, because a restriction on a sole provider of payment validation, repair tooling and Swiss clearing has no executable form: there is no alternative route and the exit plan relies on a payment repair capability Arcadia does not hold. The conditions that follow from today's evidence are four: the rule change confirmed in the tenant for all three entities, recovery evidence for the Swiss instance, a change notification commitment that binds below Novalink, and an exit and substitutability test with a date. Enhanced monitoring should run for the remainder of the cycle regardless of which option is chosen.",
    supportingEvidenceIds: ["EVD-2026-41905", "EVD-2026-41911", "EVD-2026-40118", "EVD-2026-41440"],
    opposingEvidenceIds: ["EVD-2026-41445", "EVD-2026-41204", "EVD-2026-41435"],
    uncertaintyNote:
      "Three of today's five findings rest on supplier-provided evidence obtained under Appendix A4 clause 2.1. The supplier's written incident report, due 13.10.2026, may add to, qualify or contradict it. Two findings rest on Arcadia's own records and are not exposed to that risk. Setting conditions today means setting them before the supplier's account of the root cause exists.",
    confidence: 0.64,
    requiredAuthority:
      "Conditional approval of a Tier 1 arrangement, Group Third-Party Risk Policy section 8.1. Restriction of a critical arrangement additionally requires business owner and entity Chief Operating Officer acknowledgement.",
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  /* ----------------------------------------------------------------------
     rcsa, P-003 Marlene Aigner
     ---------------------------------------------------------------------- */

  {
    id: "DEC-2026-0771",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-D1",
    roleId: "rcsa",
    entityId: ENTITY_DE,
    title: "Three indicator explanations or one causal investigation",
    titleDe: "Drei Indikatorerklaerungen oder eine Ursachenuntersuchung",
    question:
      "Three payments indicators went Red with three different owners. Do I request three separate first line explanations, which is what the escalation rule says, or one causal investigation, which is what the data says?",
    judgmentKind: "escalation",
    presentedAtMoment: "07:45",
    priorityRank: 1,
    whyThisMatters:
      "Three explanation requests produce three documents that each explain one symptom and none of them explains the cause, and the process owner will reasonably write the same paragraph three times. One causal investigation is procedurally unusual and puts the second line's analysis on the record as the framing, which the first line may resist. The choice determines whether the committee sees one problem or three.",
    preparedPosition:
      "One causal investigation. The override rate breach, the repair rate breach and the reviewer capacity breach are one chain: the primary clearing route failed five times in September for a total of 8 hours 40 minutes against one hour in August, which drove route substitution overrides from 31 to 198; cut-off pressure drove cut-off overrides from 94 to 211; and the reviewer establishment is 3.0 filled of 4.0 approved. Three error indicators, the false positive, client confirmed and technical suppression codes, are broadly flat. Two pressure indicators moved and three error indicators did not, which is a different diagnosis from overrides went up.",
    supportingEvidenceIds: ["EVD-2026-41821", "EVD-2026-41810", "EVD-2026-41820", "EVD-2026-41822"],
    opposingEvidenceIds: ["EVD-2026-41250", "EVD-2026-41855"],
    uncertaintyNote:
      "The attribution of route substitution growth to fallback activation rests on temporal correlation across five September windows. The override records carry no field linking them to a specific activation, so the attribution is an inference. On current data 181 of 198 route substitution overrides fall inside the five windows and 17 do not, of which 11 fall on the afternoon of 23.09.2026 with no activation recorded. Either an activation occurred and was not logged, or those 11 have a different cause.",
    confidence: 0.74,
    requiredAuthority:
      "Second line analysis mandate and indicator breach escalation, Group Operational Risk Policy section 4.7. A single causal investigation replacing separate indicator explanations is recorded as a departure from the standard escalation route.",
    relatedObjectKind: "kri",
    relatedObjectId: KRI_OVERRIDE_RATE,
    fromSharedEvent: false,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0744",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-D2",
    roleId: "rcsa",
    entityId: ENTITY_DE,
    title: "What zero recorded losses over 24 months tells me about likelihood",
    titleDe: "Was null erfasste Verluste in 24 Monaten ueber die Eintrittswahrscheinlichkeit aussagen",
    question:
      "The first line's strongest argument for a residual of 9 is that this risk has produced no loss in 24 months. Is that evidence about likelihood, or evidence about detection?",
    judgmentKind: "residual-risk",
    presentedAtMoment: "07:45",
    priorityRank: 2,
    whyThisMatters:
      "This is the single most contested inferential step in the role and it decides the workshop. If the absence of losses is evidence about likelihood, the first line's residual of 9 is well founded and the second line is over-reading a control test. If it is evidence about detection, the argument is circular: the control that would detect an unauthorised release reconciles value rather than authorisation.",
    preparedPosition:
      "Zero recorded losses is a verified fact about the loss register and not an observation about the risk. Detection on this risk runs through the daily value reconciliation, which compares payment value between the payment hub and clearing confirmations. A correctly valued payment released to the wrong beneficiary passes that reconciliation. The next business day override sampling by the Duty Manager is detective, next day and drawn at one in ten, so it cannot prevent a release and would see about one in ten of them. On that control set, an unauthorised release that produced no client complaint would not appear in the loss register at all.",
    supportingEvidenceIds: ["EVD-2026-41250", "EVD-2026-41850", "EVD-2026-41200"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41202"],
    uncertaintyNote:
      "The characterisation of the value reconciliation as unable to detect a wrong beneficiary payment is derived from its control description, not from a test. If the reconciliation includes beneficiary identifiers, the characterisation is wrong, and the control description does not say either way. All four test exception payments were subsequently confirmed correct by the clients, which is genuine evidence that in those four cases nothing went wrong.",
    confidence: 0.68,
    requiredAuthority:
      "Second line inferential position on loss and near miss evidence, Group Operational Risk Policy section 4.3. The reasoning must be recorded in the assessment, not held by the facilitator.",
    relatedObjectKind: "risk",
    relatedObjectId: RSK_UNAUTH_RELEASE,
    fromSharedEvent: false,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0745",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-D3",
    roleId: "rcsa",
    entityId: ENTITY_DE,
    title: "Workshop sequencing: the contested risk first or third",
    titleDe: "Ablauf des Workshops: das umstrittene Risiko zuerst oder an dritter Stelle",
    question:
      "The workshop has 11 risks and 90 minutes, and one of them is contested. Do I open with the contested rating, place it third, or close with it?",
    judgmentKind: "agenda",
    presentedAtMoment: "07:45",
    priorityRank: 3,
    whyThisMatters:
      "A workshop that spends 90 minutes on one rating and nods through ten others has produced a worse assessment, not a better one. Facilitation is a professional instrument here: the order decides whether the room arrives at the contested item with momentum or with fatigue, and whether the control owner states her position before or after the evidence is on the table.",
    preparedPosition:
      "Place the contested risk third. Opening with it spends the room's goodwill before any shared ground exists and invites the first 25 minutes to be spent establishing what the control test found, which the pre read already settles. Two uncontested risks first establish that the assessment is being run rather than litigated. Third position leaves roughly 50 minutes for the contested item, which is enough to reach a position or a recorded disagreement but not enough to reopen the test.",
    supportingEvidenceIds: ["EVD-2026-41200", "EVD-2026-41850", "EVD-2026-41855"],
    opposingEvidenceIds: ["EVD-2026-41202", "EVD-2026-41821"],
    uncertaintyNote:
      "Placing the contested item third assumes the ten other risks move at roughly four minutes each. One of the ten has changed since the pre read, the third party service risk whose acceptance condition status was updated, and that item could take fifteen minutes on its own. If it does, the contested rating is reached with thirty five minutes rather than fifty.",
    confidence: 0.6,
    requiredAuthority:
      "Facilitation of the second line challenge under the RCSA procedure. No approval required; the sequence is recorded with the workshop record.",
    relatedObjectKind: "assessment",
    relatedObjectId: RCSA_PAYOPS_Q4,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0772",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-D4",
    roleId: "rcsa",
    entityId: ENTITY_DE,
    title: "CTL-PAY-014 control environment rating and the RSK-0211 residual position",
    titleDe: "Kontrollumfeldbewertung zu CTL-PAY-014 und die Restrisikoposition zu RSK-0211",
    question:
      "The workshop closes in fifteen minutes. The first line holds the control environment Effective and the residual at 9, within appetite. I hold Partially Effective and 12, outside appetite. What do I record?",
    judgmentKind: "control-effectiveness",
    presentedAtMoment: "11:45",
    priorityRank: 4,
    whyThisMatters:
      "The gap between 9 and 12 is not a numerical quibble. It is the difference between monitoring and the accountable executive either committing to dates or signing a Risikoakzeptanz. Recording a dissent has a cost: it escalates, it strains the relationship with the process owner and the control owner, and it commits you to defending the position at committee. Choosing to pay that cost is a professional judgment about whether the issue is worth the capital.",
    preparedPosition:
      "The control environment is Partially Effective and the residual is 12 of 25, outside appetite. The four eyes control is the only preventive control mapped to this risk and the control test concluded Partially Effective on a design and an operating deficiency. The two compensating controls mitigate different things: the Duty Manager sampling is detective, next business day and drawn at one in ten, and the value reconciliation reconciles value rather than authorisation. Two of the six flagged test items cannot be concluded at all, which means the true deviation rate is unknown rather than 4 in 60. The reviewer vacancy has no start date.",
    supportingEvidenceIds: ["EVD-2026-41850", "EVD-2026-41852", "EVD-2026-41250", "EVD-2026-41822", "EVD-2026-41821"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41202", "EVD-2026-41102"],
    uncertaintyNote:
      "Evidence that may change the basis of this disagreement has been formally demanded from the supplier under Appendix A4 clause 2.1 and is overdue against a four hour service level. It may arrive today. Deciding now means deciding without it. Deferring means the assessment cannot be signed by 16.10.2026. Separately, the first line's position rests on three assertions, of which two are currently supported by the loss register and the client confirmation records; only the third, that the configuration behaved as designed, is unresolved.",
    confidence: 0.55,
    requiredAuthority:
      "Second line control environment rating and residual risk challenge, Group Operational Risk Policy section 4.3. An off cycle reassessment additionally requires the assessment owner to be notified. A recorded dissent is available under the RCSA procedure dissent clause.",
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    fromSharedEvent: false,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0782",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-D5",
    roleId: "rcsa",
    entityId: ENTITY_DE,
    title: "Whether to revise the reasoning behind a position that was right",
    titleDe: "Ob die Begruendung einer zutreffenden Position zu ueberarbeiten ist",
    question:
      "My rating of 12 stands, and the reason I gave for it was wrong. I said capacity and discipline; the mechanism is a configured waiver that switches the control off when the fallback route is active. Do I revise my recorded reasoning before the committee paper, or leave it?",
    judgmentKind: "residual-risk",
    presentedAtMoment: "15:00",
    priorityRank: 5,
    whyThisMatters:
      "Defending a correct number with a wrong argument is how a second line loses credibility, and it loses it at the worst moment, under challenge, in front of the chair. A visible correction made before the paper is cheaper than a discovered one made after it. The uncomfortable part is that the component analysis you did this morning was itself the leading indicator: every September fallback activation silently waived the control for its duration, 22 times before today, and you read it as a capacity story.",
    preparedPosition:
      "Revise the reasoning and hold the score. The score of 12 is unchanged and is now agreed by both lines on a materially different basis. The pre read attributed the control weakness to reviewer capacity at 3.0 filled of 4.0 approved and to three human deviations in the test sample. The configuration export shows that the control requirement is waived by rule for route substitution overrides below EUR 250,000 while the fallback route is active, which is a design mechanism that predates every capacity argument. Both readings support a score of 12 and only one of them is correct.",
    supportingEvidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41924", "EVD-2026-41930"],
    opposingEvidenceIds: ["EVD-2026-41200", "EVD-2026-41822"],
    uncertaintyNote:
      "The post event validation confirms one erroneous release in a sample of 20 drawn from 96. The extrapolation to roughly five affected cases is an inference on an unstratified sample covering 20 of 96, and the single confirmed error occurred on the most error prone repair type, an account and bank identifier failure, which represents about a third of repair items. The verified fact is one error. The number of further errors is unknown until all 96 are examined.",
    confidence: 0.83,
    requiredAuthority:
      "Second line revision of a recorded assessment rationale, Group Operational Risk Policy section 4.3. The prior reasoning is retained; a revision supersedes and does not overwrite.",
    relatedObjectKind: "assessment",
    relatedObjectId: RCSA_PAYOPS_Q4,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  /* ----------------------------------------------------------------------
     control-assurance, P-004 Jakob Steinbacher
     ---------------------------------------------------------------------- */

  {
    id: "DEC-2026-0746",
    runId: DEFAULT_RUN_ID,
    reference: "CA-D1",
    roleId: "control-assurance",
    entityId: ENTITY_DE,
    title: "Self review exception: isolated lapse or systemic access design failure",
    titleDe: "Selbstpruefung als Feststellung: Einzelfall oder systemisches Versagen der Berechtigungsgestaltung",
    question:
      "One override in the sample was reviewed by the person who created it, because RepairDesk permitted one analyst to hold both role assignments. Is that an individual lapse, or a systemic access design failure I have to report as such?",
    judgmentKind: "materiality",
    presentedAtMoment: "07:45",
    priorityRank: 1,
    whyThisMatters:
      "One self review in a sample of 60 could be an individual lapse. This one cannot, because a remediation action was raised in November 2025 specifically to stop it, that action is 67 days past its revised due date, and the exception occurred on 14.07.2026, which is 17 days before that revised date. Classifying it as isolated would require ignoring the remediation history, and the remediation history is the reason it is systemic and known.",
    preparedPosition:
      "Systemic and known. The finding source is an internal audit report issued 28.11.2025, the remediation action is to enforce role segregation in RepairDesk so that an override creator cannot be recorded as the secondary reviewer, and the enabling condition is still present because the supplier change request sits in pre production with Arcadia acceptance testing unscheduled behind an infrastructure freeze. The exception is not a control being broken; it is a control that was never made capable of preventing this, on a defect that was identified, accepted and dated.",
    supportingEvidenceIds: ["EVD-2026-41105", "EVD-2026-41102", "EVD-2026-41205", "EVD-2026-41850"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41852"],
    uncertaintyNote:
      "One occurrence in a sample of 60 gives no usable estimate of how often self review happens across a population of 1,204 overrides. The sample was random but not stratified by reviewer or by role assignment, and Arcadia has not queried how many analysts currently hold both role assignments in RepairDesk. That query would settle the question and has not been run.",
    confidence: 0.8,
    requiredAuthority:
      "Control assurance classification of deviation scope, Group Internal Control System Standard section 3.2. A systemic classification carries a reporting obligation to the accountable executive.",
    relatedObjectKind: "test-case",
    relatedObjectId: EXC_SELF_REVIEW,
    fromSharedEvent: false,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0747",
    runId: DEFAULT_RUN_ID,
    reference: "CA-D2",
    roleId: "control-assurance",
    entityId: ENTITY_DE,
    title: "Demand the RepairDesk tenant configuration before the challenge meeting",
    titleDe: "Anforderung der Mandantenkonfiguration von RepairDesk vor dem Klaerungsgespraech",
    question:
      "One exception has a rule trace that says secondary review was waived under a continuity throughput provision. I recorded the root cause as system configuration on 24.09.2026 and did not pull the thread. Do I request the tenant configuration from Novalink now, before the control owner meeting, or after it?",
    judgmentKind: "escalation",
    presentedAtMoment: "07:45",
    priorityRank: 2,
    whyThisMatters:
      "The missing evidence is nameable, the contractual route to obtain it exists, and it carries a four hour service level for incident purposes under Appendix A4 clause 2.1. Requesting it now means the challenge meeting has a shared waiting position rather than an argument. Requesting it after means the meeting is about materiality, which is not the question, and the evidence arrives into a conclusion already issued.",
    preparedPosition:
      "Request it now. The rule trace contains a waiver code, which means a configured rule set the secondary review requirement to false rather than a human bypassing anything. The rule itself has not been examined: its conditions, its origin, whether it is Arcadia configurable and how often it has fired are all unknown. The control description states that review applies to all overrides without exception and has not been updated since 14.01.2025, which is two months after the release that the change record covers. Design testing that reads the description and tests the operation has not compared the documented control to the implemented configuration, which is the whole point of design testing.",
    supportingEvidenceIds: ["EVD-2026-41805", "EVD-2026-41908", "EVD-2026-41850"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41610"],
    uncertaintyNote:
      "The characterisation of the waiver as a design deficiency is probable and unproven until the configuration arrives. The four hour service level applies to incident purposes; whether a control test qualifies as an incident purpose is arguable, and the supplier may treat the request as routine and answer in days rather than hours. Asking also tells the supplier which defect Arcadia has found, before Arcadia has decided what to do about it.",
    confidence: 0.72,
    requiredAuthority:
      "Outbound supplier evidence request under an existing contractual right. Control assurance may issue it; escalation to a formal demand requires the third-party risk owner.",
    relatedObjectKind: "control-test",
    relatedObjectId: TST_FOUR_EYES,
    fromSharedEvent: false,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0748",
    runId: DEFAULT_RUN_ID,
    reference: "CA-D3",
    roleId: "control-assurance",
    entityId: ENTITY_DE,
    title: "How to report an item where the evidence is permanently gone",
    titleDe: "Berichterstattung zu einem Sachverhalt, dessen Nachweis unwiederbringlich fehlt",
    question:
      "For one sample item the recorded reviewer is a Novalink service account, and the human identity behind it sat in an application log with 30 day retention that expired before I asked. Do I report this as a scope limitation, escalate it as an audit trail defect, or extend the sample?",
    judgmentKind: "escalation",
    presentedAtMoment: "07:45",
    priorityRank: 3,
    whyThisMatters:
      "This is the item with the lowest profile and the highest consequence. The value is EUR 233,800, which is unremarkable, but the evidence is permanently unrecoverable and the mechanism is a bulk approval screen used routinely rather than exceptionally. Unable to conclude is a distinct category from exception and it is usually the one that gets absorbed into a footnote. A key control in the Internal Control System whose audit trail can evaporate on a supplier retention schedule is a finding about the system, not about the period.",
    preparedPosition:
      "Escalate it as an audit trail defect and report the period limitation alongside it. Extending the sample does not help: every bulk approval submission in the population carries the same service account identity, so a larger sample would produce more unresolvable items rather than more evidence. The defect has two parts, a service account identity written in place of a human identity and a 30 day retention on the log that resolves it, and both are supplier side design choices that Arcadia accepted. The control owner cannot fix either of them alone.",
    supportingEvidenceIds: ["EVD-2026-41852", "EVD-2026-41850", "EVD-2026-40233"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41425"],
    uncertaintyNote:
      "Whether a review actually occurred on this item is unknowable. The absence of a human identity is not evidence that no human reviewed it; it is evidence that Arcadia cannot tell. The bulk approval screen usage frequency across the test period is recorded as routine, which is an observation about the screen and not about this item. The second unable to conclude item is different in kind: the supplier has committed to restore the moved evidence object by 10.10.2026, so it is open rather than lost.",
    confidence: 0.76,
    requiredAuthority:
      "Control assurance treatment of an unresolvable item, Group Internal Control System Standard section 4.5. An audit trail defect escalation is reported to the assurance owner and to Internal Audit.",
    relatedObjectKind: "test-case",
    relatedObjectId: UTC_SERVICE_ACCOUNT,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0760",
    runId: DEFAULT_RUN_ID,
    reference: "CA-D4",
    roleId: "control-assurance",
    entityId: ENTITY_AT,
    title: "The assurance conclusion on TST-2026-0318",
    titleDe: "Die Pruefungsaussage zu TST-2026-0318",
    question:
      "I have four exceptions, two items I cannot conclude on, a control owner who disputes the result, and one exception whose classification depends on a configuration I have demanded and not received. Do I issue the conclusion now, and in what form?",
    judgmentKind: "assurance-conclusion",
    presentedAtMoment: "11:45",
    priorityRank: 4,
    whyThisMatters:
      "The conclusion is an opinion supported by method and it has to survive re-performance by a third line and an external auditor. Holding it open indefinitely pending supplier cooperation gives the supplier control over Arcadia's assurance timetable. Issuing it with a determination you cannot evidence gives the supplier's eventual evidence the power to falsify your conclusion rather than to sharpen it.",
    preparedPosition:
      "Issue it as Partially Effective on the three operating deviations alone, mark the fourth exception undetermined pending the configuration, and extend the limitation section to cover both the undetermined classification and the population's time bounding. This is a weaker sounding position than either alternative and it is the only one that cannot be falsified by the evidence already demanded. The three deviations that carry it are independent of any configuration: a self review, a review recorded 11 minutes and 19 seconds after release, and an approval with no documented basis.",
    supportingEvidenceIds: ["EVD-2026-41852", "EVD-2026-41805", "EVD-2026-41908", "EVD-2026-41850"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41250"],
    uncertaintyNote:
      "Two of the control owner's three assertions are currently correct. The loss register and the client confirmation records support the claims that no financial loss occurred and that all four payments were subsequently confirmed correct. Only the third, that the fourth exception was the system behaving as configured, is unresolved, and if it is correct then her characterisation of that exception as a design matter is right. The tested population was bounded by time and the waiver is bounded by system state, which means the population could not have detected the pattern.",
    confidence: 0.69,
    requiredAuthority:
      "Control assurance conclusion on a key control in the Internal Control System, Group Internal Control System Standard section 3.2. The conclusion is the assurance owner's and cannot be delegated or negotiated.",
    relatedObjectKind: "control-test",
    relatedObjectId: TST_FOUR_EYES,
    fromSharedEvent: false,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0764",
    runId: DEFAULT_RUN_ID,
    reference: "CA-D5",
    roleId: "control-assurance",
    entityId: ENTITY_DE,
    title: "Whether to record a prediction before the evidence arrives",
    titleDe: "Ob eine Vorhersage vor dem Eintreffen des Nachweises zu erfassen ist",
    question:
      "Fallback mode went active at 14:12 and 96 route substitution overrides are showing no reviewer, all of them below EUR 250,000. That is the shape of the rule I inferred this morning. Do I record the prediction now, before the configuration confirms or refutes it?",
    judgmentKind: "assurance-conclusion",
    presentedAtMoment: "14:05",
    priorityRank: 5,
    whyThisMatters:
      "A prediction recorded before its confirmation is worth more than a conclusion recorded after, because it demonstrates that the method saw the mechanism rather than the outcome. It is also professionally exposed: the record carries a timestamp you cannot retract, and if the inference is wrong the record of being wrong sits in the working papers where a third line will read it.",
    preparedPosition:
      "Record it, with the inferential basis and the falsification condition both stated. The reconciliation holds: 138 route substitution overrides created between 14:12:41 and 14:26:00, of which 96 carry no secondary review requirement and no reviewer, 29 were reviewed and released and 13 remain awaiting review. All 96 are below EUR 250,000 and all are route substitution overrides raised while fallback mode is active, which matches the three conditions visible in the August rule trace. If the configuration shows no value threshold, the inference is wrong and the record should say so.",
    supportingEvidenceIds: ["EVD-2026-41874", "EVD-2026-41878", "EVD-2026-41805", "EVD-2026-41875"],
    opposingEvidenceIds: ["EVD-2026-41908", "EVD-2026-41852"],
    uncertaintyNote:
      "The absence of a reviewer identity at query time is not proof that no review occurred. The control owner states on the bridge that RepairDesk backfills reviewer identities at the end of the batch cycle; the supplier's client service director states that the field is written synchronously at submission. Arcadia does not know which is correct. The one piece of Arcadia-side evidence bearing on it is weak in both directions: the service account item shows an identity written synchronously, on a different screen.",
    confidence: 0.61,
    requiredAuthority:
      "Control assurance working paper entry. No approval required for a recorded inference; the entry must state its basis and its falsification condition.",
    relatedObjectKind: "control-test",
    relatedObjectId: TST_FOUR_EYES,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0778",
    runId: DEFAULT_RUN_ID,
    reference: "CA-D6",
    roleId: "control-assurance",
    entityId: ENTITY_DE,
    title: "All 96 overrides or a sample",
    titleDe: "Alle 96 Ueberschreibungen oder eine Stichprobe",
    question:
      "Ninety six payments worth EUR 9,420,880 were released today without secondary review, and a 20 case sample has found one confirmed misroute. Do I commit the first line to checking all 96, or is a larger sample enough?",
    judgmentKind: "escalation",
    presentedAtMoment: "15:00",
    priorityRank: 6,
    whyThisMatters:
      "The recall window on a misrouted payment closes. A sample answers a question about rates; the bank's question is about specific payments, and each unexamined case is a client whose money may be in the wrong place. Committing the first line to 96 checks by 07.10.2026 at 12:00 is a real capacity demand on a team already at 3.0 filled reviewer FTE of 4.0 approved, and once it is committed to the committee it cannot be quietly reduced.",
    preparedPosition:
      "All 96, with a deadline of 07.10.2026 at 12:00 so the result exists before the committee papers close. The sample of 20 is 20 of 96 and is not stratified by value or by failure reason code. The single confirmed error occurred on an account and bank identifier failure, which is the most error prone repair type and about a third of repair items, so a stratified sample would very likely give a different rate. The honest position is one confirmed error, an unknown number of further errors, and a zero tolerance impact tolerance that counts releases with an unsatisfied mandatory gate.",
    supportingEvidenceIds: ["EVD-2026-41924", "EVD-2026-41930", "EVD-2026-41878", "EVD-2026-41905"],
    opposingEvidenceIds: ["EVD-2026-41822", "EVD-2026-41855"],
    uncertaintyNote:
      "A 20 case check found 19 correct and 1 incorrect. Extrapolating to roughly five affected cases across 96 carries a wide interval on a sample of that size and is not a usable planning number. The examination of all 96 has a capacity cost that falls on the same team whose reviewer establishment is the subject of a Red indicator, and a rushed examination of 96 cases is not obviously better evidence than a careful stratified sample of 40.",
    confidence: 0.77,
    requiredAuthority:
      "Control assurance mandate to require first line validation, Group Internal Control System Standard section 4.5. A commitment made to the committee is not reversible by the assurance owner alone.",
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0783",
    runId: DEFAULT_RUN_ID,
    reference: "CA-D7",
    roleId: "control-assurance",
    entityId: ENTITY_DE,
    title: "CTL-PAY-014 Kontrollwirksamkeit: the design and operating split",
    titleDe: "Kontrollwirksamkeit CTL-PAY-014: die Trennung von Konzeption und Wirksamkeit",
    question:
      "The control owner now accepts the configuration evidence and withdraws her mechanism claim, and maintains that the deficiency is design rather than her team's operation. She is right about the 96 cases and about the August exception. Do I concede that precisely, or hold the whole conclusion?",
    judgmentKind: "control-effectiveness",
    presentedAtMoment: "16:30",
    priorityRank: 7,
    whyThisMatters:
      "This distinction determines who owns the fix, whether the control can be relied upon in the interim, and whether the first line's position was reasonable. Conceding what is true is the professional instrument here, and it is the only route to a conclusion both lines will sign. A negotiated middle would be worse than either position, because it would blur the one line in the whole matter that is actually sharp.",
    preparedPosition:
      "Concede precisely and hold precisely. Partially Effective stands. The fourth August exception and the 96 event cases are a design deficiency with accountability shared with the supplier, because the rule waived the requirement before any human saw it and no member of the team bypassed anything. The other three exceptions are operating deficiencies and are independent of the rule: a self review, a review recorded after release, and an approval with no documented basis. That is a sharper statement than either opening position and it is documentable.",
    supportingEvidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41907", "EVD-2026-41852", "EVD-2026-41924"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41250"],
    uncertaintyNote:
      "The retained limitation is the population. The rule has fired 118 times since 11.11.2024, of which 96 today and one inside the tested period. That leaves 21 firings that have never been examined, and their override records exist but have not been retrieved. The supplier's firing count is from its own export and is consistent with, but not verified by, Arcadia's configuration audit log.",
    confidence: 0.86,
    requiredAuthority:
      "Joint control effectiveness conclusion. The assurance owner holds the conclusion; the control owner signs the deficiency characterisation. Noted by the second line facilitator and the portfolio lead.",
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  /* ----------------------------------------------------------------------
     incident-resilience, P-005 Nadia Lehmann

     Nine decisions, the most of any role, because this role owns the event.
     Two of them are deliberately kept as separate rows: the EU entity
     notification assessment and the Swiss entity notification assessment.
     Two entities, two frameworks, two records, two conclusions. They are
     never merged, and a single decision row covering all three entities
     would be the category error the product exists to prevent.
     ---------------------------------------------------------------------- */

  {
    id: "DEC-2026-0749",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D1",
    roleId: "incident-resilience",
    entityId: ENTITY_CH,
    title: "ARC-CH has no recovery evidence and no fallback route for Swiss clearing",
    titleDe: "ARC-CH verfuegt ueber keinen Wiederherstellungsnachweis und keine Ausweichroute",
    question:
      "The Swiss clearing adapter and the Swiss RepairDesk instance sit at a subprocessor with no recovery evidence, and ARC-CH has no fallback route at all. Is that a material resilience gap I escalate today, or an open reassessment item I leave with third-party risk?",
    judgmentKind: "materiality",
    presentedAtMoment: "07:45",
    priorityRank: 1,
    whyThisMatters:
      "My own entity has the weakest position in the group and I know it at 07:45. The recovery evidence question is open with third-party risk and is a quarter complete, which makes it easy to leave there. The difference is that for the EU entities a documented fallback exists and has been used five times, and for the Swiss entity the only option is manual submission through a correspondent with a 45 minute preparation lead time against a 16:00 same day cut-off (scenario figure).",
    preparedPosition:
      "Material, and it should be escalated as a resilience gap in my own name rather than carried as a supplier evidence item. The distinction matters: as a supplier evidence item it is a missing document, and as a resilience gap it is an important business service with no tested recovery path for one of the three entities it serves. The supplier's own recovery test report covers the Frankfurt and Amsterdam regions and does not cover the Swiss instance, so the Swiss position is unmeasured rather than weak. The latest start time for the manual route on any day is 15:15 (scenario figure).",
    supportingEvidenceIds: ["EVD-2026-40118", "EVD-2026-41710", "EVD-2026-41500"],
    opposingEvidenceIds: ["EVD-2026-41445", "EVD-2026-41425"],
    uncertaintyNote:
      "The 45 minute preparation lead time for the manual correspondent route comes from the runbook, last reviewed 14.01.2026, and there is no record of it ever having been rehearsed. It may be conservative or it may be optimistic; nothing in Arcadia's records distinguishes the two. The absence of recovery evidence for the Swiss instance is evidence of absence in the supplier's report, not proof that no recovery capability exists.",
    confidence: 0.73,
    requiredAuthority:
      "Resilience gap determination for a significant business process, Group Operational Resilience Policy section 2.4, with local entity resilience officer concurrence for ARC-CH.",
    relatedObjectKind: "service",
    relatedObjectId: "SVC-0042-05",
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0750",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D2",
    roleId: "incident-resilience",
    entityId: ENTITY_DE,
    title: "Whether five uses of a fallback route constitute a test",
    titleDe: "Ob fuenf Einsaetze einer Ausweichroute eine Pruefung darstellen",
    question:
      "The fallback route for corporate payments has been used five times in September for a total of 8 hours 40 minutes and has never been tested. Does use count as a test for the purposes of the tested fallback indicator?",
    judgmentKind: "assurance-conclusion",
    presentedAtMoment: "07:45",
    priorityRank: 2,
    whyThisMatters:
      "This is a method judgment with a governance consequence attached to it. If use counts as a test, the tested fallback indicator improves, the important business service moves out of the untested list, and nothing is learned. If use does not count, the indicator stays Red and a resourcing request has to be made for a test nobody has budgeted.",
    preparedPosition:
      "Use is not a test, because use produces no controlled observation. In the five September activations nobody recorded recovery time against an objective, nobody observed what happened to the control environment, and nobody measured queue behaviour against a threshold. The last severe but plausible exercise, on 18.11.2025, tested a total gateway outage rather than fallback mode operation, so the fallback path itself has never been exercised under observation. The honest indicator position is untested, and the honest additional finding is that the route has been relied upon five times without anyone establishing what it changes.",
    supportingEvidenceIds: ["EVD-2026-41810", "EVD-2026-41705", "EVD-2026-41700"],
    opposingEvidenceIds: ["EVD-2026-41821", "EVD-2026-41425"],
    uncertaintyNote:
      "Five real activations produce operational evidence that a designed test would not: the route carried live payment traffic and payments cleared. Arguing that this counts for nothing is defensible on method and weak on substance, and the counter argument from the first line will be that an exercise proves less than five real uses. What the activations cannot show is anything nobody was watching for, which is exactly the control effect the runbook asserts does not exist.",
    confidence: 0.78,
    requiredAuthority:
      "Resilience testing sufficiency determination, Group Operational Resilience Policy section 4.1. Indicator composition changes are notified to the portfolio lead.",
    relatedObjectKind: "kri",
    relatedObjectId: KRI_TESTED_FALLBACK,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0751",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D3",
    roleId: "incident-resilience",
    entityId: ENTITY_CH,
    title: "The two measure ambiguity in ITOL-0004-03: finding now or open question",
    titleDe: "Die Zweifachmessung in ITOL-0004-03: Feststellung jetzt oder offene Frage",
    question:
      "The Swiss clearing tolerance has two measures, an elapsed disruption limit and a cut-off completion requirement, and the record states no precedence. Do I raise that as a finding now, or carry it to the committee tolerance review as an open question?",
    judgmentKind: "agenda",
    presentedAtMoment: "07:45",
    priorityRank: 3,
    whyThisMatters:
      "A definitional gap with no observed divergence is a weak finding and a reasonable agenda item, and raising it as a finding invites the response that it is not a real problem. The consequence of being wrong is specific: if the two measures ever diverge, the Swiss entity will be unable to state whether it breached its own impact tolerance, and it will have to say so to its board.",
    preparedPosition:
      "Carry it to the committee tolerance review as an open question with the two measures set out separately, rather than as a finding. Neither the tolerance record nor the Swiss board risk committee minutes of 24.02.2026 state which measure governs on divergence, so the gap is real. No divergence has been observed, which means there is no case to attach to it, and a finding without a case is the weakest form of a correct argument. The committee item already exists and carries a decision on tolerance definition, so the question has a destination.",
    supportingEvidenceIds: ["EVD-2026-41500", "EVD-2026-41310"],
    opposingEvidenceIds: ["EVD-2026-41710", "EVD-2026-41810"],
    uncertaintyNote:
      "The ambiguity is currently theoretical. The two measures diverge only if a disruption both exceeds the elapsed limit and completes before the cut-off, or the reverse, and no recorded Swiss clearing disruption has produced either. Deferring is defensible precisely because the divergence has never happened, and that reasoning is only as good as the assumption that it will not happen today.",
    confidence: 0.64,
    requiredAuthority:
      "Resilience agenda judgment. The tolerance itself was set by the ARC-CH Board Risk Committee and only that body can resolve a precedence.",
    relatedObjectKind: "impact-tolerance",
    relatedObjectId: ITOL_CH_CLEARING,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0761",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D4",
    roleId: "incident-resilience",
    entityId: ENTITY_DE,
    title: "The runbook's control assertion: documentation error or resilience finding",
    titleDe: "Die Kontrollaussage im Handbuch: Dokumentationsfehler oder Resilienzfeststellung",
    question:
      "Section 4 of the clearing route substitution runbook states that the control environment is unchanged during fallback operation. Reconciliation against the control inventory says otherwise. Is that a documentation correction the process owner makes quietly, or a resilience finding with a remediation action?",
    judgmentKind: "materiality",
    presentedAtMoment: "11:45",
    priorityRank: 4,
    whyThisMatters:
      "A documentation correction closes in days, has no governance visibility and would not require anyone to establish what actually changes during fallback, which is the substantive question. A finding carries committee visibility and an implied criticism of a runbook the process owner owns, on a day when the second line is already challenging his control rating. The assertion is in writing, which is what makes it a finding rather than an omission.",
    preparedPosition:
      "A resilience finding, and it should be raised without waiting for the configuration. A runbook that makes an unverified control assertion is a finding whatever the configuration turns out to say, because the assertion had no basis when it was written. Reconciliation against the eleven controls mapped to payment repair identifies the four eyes control as conditional on system state, which contradicts the assertion directly. The remediation has two parts: remove the assertion now, and state the specific control effects of fallback activation once they are known.",
    supportingEvidenceIds: ["EVD-2026-41705", "EVD-2026-41700", "EVD-2026-41805"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41908"],
    uncertaintyNote:
      "The contradiction is between two Arcadia documents and not between a document and an observed fact. What actually changes during fallback operation is established by neither of them and requires the supplier configuration, which control assurance has demanded and which is overdue. A documentation correction made now would correct one document to match an assumption rather than a fact.",
    confidence: 0.75,
    requiredAuthority:
      "Resilience finding determination, Group Operational Resilience Policy section 5.3. The runbook amendment is owned by the process owner; the finding is owned by the resilience lead.",
    relatedObjectKind: "runbook",
    relatedObjectId: "RB-PAY-007",
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0765",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D5",
    roleId: "incident-resilience",
    entityId: ENTITY_CH,
    title: "Severity: upgrade on the ARC-CH position alone",
    titleDe: "Schweregrad: Heraufsetzung allein aufgrund der Lage bei ARC-CH",
    question:
      "For the two EU entities the tolerance position is wide: a four hour limit, a fallback already active, restoration expected. For the Swiss entity it is 38 minutes of remaining tolerance against a 45 minute manual lead time. Do I upgrade the severity on one entity's position?",
    judgmentKind: "severity",
    presentedAtMoment: "14:05",
    priorityRank: 5,
    whyThisMatters:
      "Severity sets who is woken, which frameworks are engaged and what the bank commits to. Most severity frameworks would average three entity positions and produce a middle answer, which would be wrong in both directions: too high for the EU entities and far too low for the entity with the deadline. Upgrading on one entity means defending a group severity to people whose own entity looks comfortable.",
    preparedPosition:
      "Upgrade on the Swiss position alone, and record the two grounds separately. Ground one is tolerance proximity: Swiss clearing has been queued since 13:47 with an elapsed limit of two hours, which leaves 38 minutes, and the only available route needs 45 minutes of them. Ground two is the zero tolerance control condition: 96 releases currently show an unsatisfied mandatory gate, which is a candidate breach of a tolerance whose threshold is zero. A group framework applied to a legal entity does not average; it takes the worst entity position and names it.",
    supportingEvidenceIds: ["EVD-2026-41882", "EVD-2026-41878", "EVD-2026-41874"],
    opposingEvidenceIds: ["EVD-2026-41871", "EVD-2026-41500"],
    uncertaintyNote:
      "The 96 candidate breaches rest on a telemetry inference. The absence of a reviewer identity at query time is not proof that no review occurred, and the mechanism is disputed between the control owner and the supplier. The disruption start of 13:38 is estimated from Arcadia-side latency telemetry and is not supplier confirmed; the Swiss queueing start of 13:47 is observed in the Swiss adapter and is firmer. If the true start is earlier, the remaining tolerance is smaller.",
    confidence: 0.7,
    requiredAuthority:
      "Incident severity classification, Group Incident Classification Standard. Severity at the highest level triggers notification to the Group Chief Risk Officer and the committee chair.",
    relatedObjectKind: "incident",
    relatedObjectId: INC_EVENT,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0776",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D6",
    roleId: "incident-resilience",
    entityId: ENTITY_CH,
    title: "Invoke the manual correspondent route, or wait for the recovery estimate",
    titleDe: "Manuelle Korrespondenzroute ausloesen oder die Wiederherstellungsschaetzung abwarten",
    question:
      "CHF 18,712,400 of same day value has a 16:00 cut-off, the manual route needs 45 minutes of preparation, and I have 38 minutes of tolerance left. Novalink says recovery by 16:00. Do I invoke the manual route now, accepting a manual process risk on a path that has never been rehearsed?",
    judgmentKind: "risk-acceptance",
    presentedAtMoment: "15:00",
    priorityRank: 6,
    whyThisMatters:
      "Once the tranche is submitted through the correspondent it cannot be unwound. The decision has to be taken before the cause is known and before the supplier's recovery estimate can be tested, because the lead time consumes more than the remaining runway. This is the sharpest decision in the day: the cost of waiting is 1,842 instructions missing a same day cut-off, and the cost of acting is a manual process on an unrehearsed path carrying a figure worth about a third of a normal Swiss corporate payment day.",
    preparedPosition:
      "Invoke the manual route now. The supplier's 16:00 recovery estimate is a stakeholder statement with no evidential basis: it was given verbally, the written portal update seven minutes later says the cause is under investigation, and the supplier's own monitoring pipeline is degraded, which means its estimate rests on instrumentation it has told us is broken. Waiting to test the estimate costs the option, because the latest start for the manual route is 15:15 and the estimate cannot be tested before 16:00. The manual process risk is real and it is bounded and reversible in its effects; a missed same day cut-off is neither.",
    supportingEvidenceIds: ["EVD-2026-41882", "EVD-2026-41710", "EVD-2026-41500"],
    opposingEvidenceIds: ["EVD-2026-41871", "EVD-2026-41810"],
    uncertaintyNote:
      "The 45 minute lead time comes from a runbook last reviewed 14.01.2026 with no record of any rehearsal. If it is optimistic the tranche misses the cut-off anyway and the manual process risk has been taken for nothing. The supplier's estimate may be correct; nothing in the evidence says it is wrong, only that it is unsupported. Whichever option is taken, the elapsed measure of the Swiss tolerance is likely to be exceeded while the cut-off measure may not be, and no precedence exists between them.",
    confidence: 0.59,
    requiredAuthority:
      "Local resilience authority for ARC-CH with the ARC-CH Chief Operating Officer. The group resilience lead recommends; the entity decides, because the manual process risk is the entity's to carry.",
    relatedObjectKind: "incident",
    relatedObjectId: INC_EVENT,
    fromSharedEvent: true,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0774",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D7",
    roleId: "incident-resilience",
    entityId: ENTITY_DE,
    title: "ARC-DE and ARC-AT: major incident threshold and notification recommendation",
    titleDe: "ARC-DE und ARC-AT: Schwelle fuer schwerwiegende Vorfaelle und Meldeempfehlung",
    question:
      "For the two EU entities, does this event meet the major incident threshold on the facts available, and do I recommend a supervisory notification? Illustrative regulatory context, not legal advice.",
    judgmentKind: "escalation",
    presentedAtMoment: "15:00",
    priorityRank: 7,
    whyThisMatters:
      "The recommendation commits the bank to a position with a supervisor on facts that are substantially unverified, and it commits it early. Recommending notification and later withdrawing costs credibility; not recommending and later being found to have met the threshold costs considerably more. The honest output is a provisional conclusion with an explicit reassessment trigger, which is harder to write than either a yes or a no.",
    preparedPosition:
      "Significant but below the major incident threshold on the facts available, assessed provisionally and to be re-run on receipt of the supplier report due 13.10.2026. The criteria assessed are clients affected, reputational impact, duration and service downtime, geographical spread, data losses, criticality of services affected and economic impact. Duration is inside the four hour tolerance for these entities, the service is restored, one erroneous release is confirmed and recallable, and no data loss is evidenced. The gaps in the assessment are named rather than assumed favourable: the supplier's account of root cause does not exist yet. Illustrative regulatory context, not legal advice. This assessment applies to the two EU entities only and is recorded separately from the Swiss assessment.",
    supportingEvidenceIds: ["EVD-2026-41921", "EVD-2026-41911", "EVD-2026-41924", "EVD-2026-41874"],
    opposingEvidenceIds: ["EVD-2026-41878", "EVD-2026-41930", "EVD-2026-41905"],
    uncertaintyNote:
      "Six of the first nine information arrivals were stakeholder statements, and the assessment is being taken at a point where the supplier's written root cause account does not exist. The 96 releases without secondary review are now a verified fact, and whether a control gate waived by configuration for 3 hours 56 minutes bears on the criticality of services affected criterion is a judgment rather than a measurement. Illustrative regulatory context, not legal advice.",
    confidence: 0.52,
    requiredAuthority:
      "Incident classification for the EU entities under the Group Incident Classification Standard, with the Regulatory Change Manager as framework owner. A notification recommendation is made to the entity Chief Operating Officer and the Group Chief Risk Officer, who decide. Illustrative regulatory context, not legal advice.",
    relatedObjectKind: "incident",
    relatedObjectId: INC_EVENT,
    fromSharedEvent: true,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0775",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D8",
    roleId: "incident-resilience",
    entityId: ENTITY_CH,
    title: "ARC-CH: whether a FINMA report is required on the facts available",
    titleDe: "ARC-CH: ob auf Basis der vorliegenden Fakten eine FINMA-Meldung erforderlich ist",
    question:
      "For the Swiss entity, assessed separately against FINMA operational risk and resilience reporting expectations, is this an incident of substantial importance? Illustrative regulatory context, not legal advice.",
    judgmentKind: "escalation",
    presentedAtMoment: "15:00",
    priorityRank: 8,
    whyThisMatters:
      "This is a separate assessment against a separate framework and it must stay a separate record. The pressure at the highest severity is always toward one answer covering the group, and one answer would either apply an EU framework to the Swiss entity, which is wrong, or hide the judgment, which is worse. The Swiss facts also differ materially: the Swiss entity had no fallback, queued for 2 hours 11 minutes, and made its cut-off by two minutes through a manual route.",
    preparedPosition:
      "No report required on the facts available, documented and to be re-run. The Swiss position rests on three facts: 1,840 of 1,842 instructions were accepted before the cut-off, the two rejected instructions worth CHF 14,200 rolled to the next value date and sit well inside the group value delay tolerance, and no client data was lost or disclosed. The elapsed disruption measure of the Swiss tolerance was exceeded by 11 minutes and the cut-off measure was met, and the entity cannot state which governs. Illustrative regulatory context, not legal advice. This assessment covers ARC-CH only and shares no fields with the EU assessment.",
    supportingEvidenceIds: ["EVD-2026-41918", "EVD-2026-41882", "EVD-2026-41921"],
    opposingEvidenceIds: ["EVD-2026-41500", "EVD-2026-41911", "EVD-2026-40118"],
    uncertaintyNote:
      "The Swiss entity cannot state whether its own impact tolerance was breached, because the tolerance has two measures and no precedence, and one measure says breached while the other says not breached. An assessment that no report is required while an impact tolerance question is unresolved is provisional in a specific way, and the reassessment trigger is the supplier report due 13.10.2026. Illustrative regulatory context, not legal advice.",
    confidence: 0.5,
    requiredAuthority:
      "ARC-CH local reporting assessment under the entity standard, taken by the local resilience officer with the group resilience lead and the Regulatory Change Manager. Illustrative regulatory context, not legal advice.",
    relatedObjectKind: "incident",
    relatedObjectId: INC_EVENT,
    fromSharedEvent: true,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0786",
    runId: DEFAULT_RUN_ID,
    reference: "IR-D9",
    roleId: "incident-resilience",
    entityId: ENTITY_CH,
    title: "Whether ITOL-0004-03 was breached",
    titleDe: "Ob ITOL-0004-03 ueberschritten wurde",
    question:
      "Submission completed at 15:58, two minutes before the cut-off, so measure one is satisfied. Elapsed disruption was 2 hours 11 minutes against a two hour limit, so measure two is exceeded. What do I write in the incident record?",
    judgmentKind: "materiality",
    presentedAtMoment: "16:30",
    priorityRank: 9,
    whyThisMatters:
      "This is the day's most valuable finding and the least dramatic, and the temptation is to pick the measure that gives the comfortable answer. That choice would be unremarkable, undetectable and the single worst act available to anyone in the product. The defect is in the tolerance definition rather than in the operation, and only the body that set the tolerance can resolve it.",
    preparedPosition:
      "Record that the entity cannot state whether the tolerance was breached, name the two measures and their opposite answers, name the owner and name the destination. Measure one, submission completion against the cut-off: completed 15:58 against 16:00, not breached. Measure two, elapsed disruption: queueing began 13:47 and submission completed 15:58, elapsed 2 hours 11 minutes against a two hour maximum, breached by 11 minutes. Neither the tolerance record nor the Swiss board risk committee minutes of 24.02.2026 state a precedence. A system that returned either answer would be asserting a precedence that no one has set.",
    supportingEvidenceIds: ["EVD-2026-41918", "EVD-2026-41882", "EVD-2026-41500"],
    opposingEvidenceIds: ["EVD-2026-41921", "EVD-2026-41310"],
    uncertaintyNote:
      "The elapsed measure depends on the disruption start. Queueing in the Swiss adapter began at 13:47 and is observed; the underlying technical start at the subprocessor was 13:31 and is now verified by the subprocessor's own account. Measured from 13:31 the elapsed figure is 2 hours 27 minutes rather than 2 hours 11 minutes, which makes the breach larger and does not resolve the precedence question. The tolerance record does not say which start time applies either.",
    confidence: 0.88,
    requiredAuthority:
      "Impact tolerance breach determination for ARC-CH. The resilience lead records the position; only the ARC-CH Board Risk Committee can set a precedence between the two measures.",
    relatedObjectKind: "impact-tolerance",
    relatedObjectId: ITOL_CH_CLEARING,
    fromSharedEvent: true,
    sharedThreadId: null,
    ...OPEN,
  },

  /* ----------------------------------------------------------------------
     regulatory-change, P-006 Tobias Reinhardt

     Every row in this block carries the illustrative context label, and the
     EU and Swiss lanes are never combined in one determination. The Swiss
     entity is assessed under FINMA context; the digital operational
     resilience framework and the European Banking Authority guidance apply
     to the German and Austrian entities only.
     ---------------------------------------------------------------------- */

  {
    id: "DEC-2026-0752",
    runId: DEFAULT_RUN_ID,
    reference: "REG-D1",
    roleId: "regulatory-change",
    entityId: ENTITY_CH,
    title: "Meridian in Pune: applicability in the Swiss lane, where the answer differs",
    titleDe: "Meridian in Pune: Anwendbarkeit im Schweizer Pfad, wo die Antwort abweicht",
    question:
      "A subprocessor in a third country holds read access to payment metadata at a significant outsourcing for ARC-CH, and is absent from the binding appendix and from the filed Swiss inventory. In the EU lane this is a subcontracting chain and register completeness question. In the Swiss lane it is an inventory and data access question. Are both applicable, and do they resolve differently? Illustrative regulatory context, not legal advice.",
    judgmentKind: "applicability",
    presentedAtMoment: "07:45",
    priorityRank: 1,
    whyThisMatters:
      "The consequence of getting this wrong is a category error with supervisory implications in either direction: applying an EU framework to the Swiss entity, or failing to apply a Swiss requirement because a group view absorbed it. The two obligations are not alternatives and satisfying one would not satisfy the other. The forum will ask whether this is a third-party risk issue or a compliance issue, which is the wrong question, because it is both, in two jurisdictions, differently. Illustrative regulatory context, not legal advice.",
    preparedPosition:
      "Both are applicable and they resolve differently, and the arrangement should be tracked as two obligations rather than one. In the EU lane the relevant entities are the German and Austrian entities and the question is completeness of the subcontracting chain in the register of information; the record is mapped and unevidenced. In the Swiss lane the relevant entity is ARC-CH and the questions are inventory content for a significant outsourcing and data access by a party in a third country; the filed inventory of 24.07.2026 does not contain the subprocessor, which was onboarded 01.05.2026. The data processing appendix names four transfer destinations and does not name India. Illustrative regulatory context, not legal advice.",
    supportingEvidenceIds: ["EVD-2026-41405", "EVD-2026-41305", "EVD-2026-41402", "EVD-2026-41300"],
    opposingEvidenceIds: ["EVD-2026-41410", "EVD-2026-41235"],
    uncertaintyNote:
      "The subprocessor's data access scope is as stated by the supplier in its own register and has not been verified by Arcadia, and there is no mechanism to verify it without a supplier audit under Appendix A4. Whether the access constitutes a disclosure requiring assessment in the Swiss lane depends on the actual data scope, which is unverified. Whether the Swiss inventory should contain a subprocessor of a significant outsourcing depends on the inventory's defined scope, which is ambiguous on subcontracting depth. Illustrative regulatory context, not legal advice.",
    confidence: 0.67,
    requiredAuthority:
      "Applicability determination per legal entity, Group Regulatory Change Standard section 2.1. Interpretation requires Group Legal input and is recorded in the interpretation register. Illustrative regulatory context, not legal advice.",
    relatedObjectKind: "subprocessor",
    relatedObjectId: TP_MERIDIAN,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0753",
    runId: DEFAULT_RUN_ID,
    reference: "REG-D2",
    roleId: "regulatory-change",
    entityId: ENTITY_DE,
    title: "Whether to comment on the tolerance standard now, without a case",
    titleDe: "Ob jetzt ohne konkreten Fall zum Toleranzstandard Stellung zu nehmen ist",
    question:
      "The draft internal impact tolerance standard is in consultation to 23.10.2026 and does not require a stated precedence where a tolerance has more than one measure. I wrote most of it and I did not notice. Do I comment now, without a concrete case, or wait?",
    judgmentKind: "escalation",
    presentedAtMoment: "07:45",
    priorityRank: 2,
    whyThisMatters:
      "A standard comment without a concrete case is weak and easy to defer, and the cost of deferring is that every tolerance written under the standard inherits the defect. One of the four tolerances on the group's most important payment service already has two measures and no precedence, which means the defect is not hypothetical, it is unremarked. The consultation window is the only cheap moment this will ever have.",
    preparedPosition:
      "Comment, but the honest case for commenting now is thin. The draft's tolerance definition clauses are silent on measure precedence, and reconciliation against the four tolerances on the corporate payments service returns exactly one with two measures. That is a single instance, and a consultation response resting on one instance with no observed divergence is a drafting suggestion rather than a defect finding. Holding the comment until a divergence occurs is professionally normal and costs nothing provided the window is still open when it happens, and the window closes 23.10.2026.",
    supportingEvidenceIds: ["EVD-2026-41310", "EVD-2026-41500"],
    opposingEvidenceIds: ["EVD-2026-41710", "EVD-2026-41425"],
    uncertaintyNote:
      "This is an observation about draft text and not a defect finding. Whether it matters depends on whether any tolerance actually has two measures, and one does. Whether that one will ever produce a divergence is unknown, and the consultation is unlikely to accept a structural change to the definition clauses on the strength of a single unrealised case. Illustrative regulatory context, not legal advice.",
    confidence: 0.57,
    requiredAuthority:
      "Consultation response on an internal group standard, Group Regulatory Change Standard section 2.1. The standard owner is the Regulatory Change Manager, which is why the comment is a judgment about his own draft.",
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_TOLERANCE_DEFINITION,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0754",
    runId: DEFAULT_RUN_ID,
    reference: "REG-D3",
    roleId: "regulatory-change",
    entityId: ENTITY_DE,
    title: "Whether SVC-0042-03 should be reclassified",
    titleDe: "Ob SVC-0042-03 neu klassifiziert werden sollte",
    question:
      "Payment file transformation and format library maintenance is classified as not supporting a critical or important function. If the format library failed, bulk file payments stop. Should the classification change? Illustrative regulatory context, not legal advice.",
    judgmentKind: "criticality",
    presentedAtMoment: "07:45",
    priorityRank: 3,
    whyThisMatters:
      "Reclassifying pulls in register content, contractual protection and testing obligations, and it has a cost that somebody has to carry. Leaving it means a service whose failure would stop a payment type is carried as non critical, and the basis has to survive a supervisor asking why. The third-party risk owner reaches the same question from the contractual direction, which is a good sign about both of them and a bad sign about the classification.",
    preparedPosition:
      "The classification should change, on substance over current label. The service maintains the format library for the bulk file payment type, which routes by underlying type and is in scope for all three entities. A format library failure would stop that payment type entirely, which is a service outcome indistinguishable from a gateway failure. The current classification appears to rest on the service being maintenance rather than runtime, which is a distinction about how the service is delivered rather than about what its failure would do. Illustrative regulatory context, not legal advice.",
    supportingEvidenceIds: ["EVD-2026-41300", "EVD-2026-41425"],
    opposingEvidenceIds: ["EVD-2026-41410", "EVD-2026-41445"],
    uncertaintyNote:
      "Nobody has tested what a format library failure would actually do, and the inference that bulk file payments would stop is drawn from the service description rather than from an outage. If the library is cached or versioned on the Arcadia side, a supplier side failure might have no immediate effect, and the service description does not say. Reclassification has a cost that would be borne by the business owner and the commercial relationship owner, neither of whom has been asked. Illustrative regulatory context, not legal advice.",
    confidence: 0.6,
    requiredAuthority:
      "Service classification determination per entity, Group Third-Party Risk Policy section 3.1 with the Regulatory Change Standard. Requires business owner and commercial relationship owner acknowledgement before it is recorded. Illustrative regulatory context, not legal advice.",
    relatedObjectKind: "service",
    relatedObjectId: "SVC-0042-03",
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0762",
    runId: DEFAULT_RUN_ID,
    reference: "REG-D4",
    roleId: "regulatory-change",
    entityId: ENTITY_CH,
    title: "The Swiss inventory gap: filing deficiency or scope definition question",
    titleDe: "Die Luecke im Schweizer Verzeichnis: Meldeversaeumnis oder Frage der Definitionsbreite",
    question:
      "The Swiss outsourcing inventory filed on 24.07.2026 does not contain a subprocessor onboarded on 01.05.2026. Is that a filing deficiency, which names a person and a date, or an inventory scope definition question, which names the standard? Illustrative regulatory context, not legal advice.",
    judgmentKind: "materiality",
    presentedAtMoment: "11:45",
    priorityRank: 4,
    whyThisMatters:
      "A filing deficiency is closed by adding one line, which would leave the scope ambiguity intact and the same gap would recur at the next filing. A scope definition question is slower and structural and puts the burden on Arcadia's own standard rather than on the person who filed it. Both characterisations are available on the same facts, which is exactly why a system must not choose. Illustrative regulatory context, not legal advice.",
    preparedPosition:
      "An inventory scope definition question. The standard's text on subcontracting depth has been read and is ambiguous: it does not state whether subprocessors of a significant outsourcing are in scope, and it does not distinguish by data access. The filing was made 84 days after the subprocessor was onboarded and the supplier's register was published on its client portal on 03.08.2026, which is after the filing date, so the filer had no Arcadia source naming the subprocessor at the time of filing. Characterising this as a filing deficiency would assert a failure by a person who could not reasonably have known. Illustrative regulatory context, not legal advice.",
    supportingEvidenceIds: ["EVD-2026-41305", "EVD-2026-41405", "EVD-2026-41300"],
    opposingEvidenceIds: ["EVD-2026-41410", "EVD-2026-41402"],
    uncertaintyNote:
      "The standard's text is ambiguous and resolving its ambiguity is an interpretation of Arcadia's own requirement, not a reading of an external one. The Group Legal question on whether the third country access falls within the data processing appendix is unanswered with no expected date. Both characterisations remain available until the standard is clarified, and clarifying it is a proposal about Arcadia's own governance rather than a compliance conclusion. Illustrative regulatory context, not legal advice.",
    confidence: 0.63,
    requiredAuthority:
      "Interpretation of an internal standard's scope, Group Regulatory Change Standard section 2.1, recorded in the interpretation register with Group Legal input. Illustrative regulatory context, not legal advice.",
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_CH_INVENTORY_ACCESS,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0787",
    runId: DEFAULT_RUN_ID,
    reference: "REG-D5",
    roleId: "regulatory-change",
    entityId: ENTITY_DE,
    title: "A key control waived by supplier configuration: which obligations did today touch",
    titleDe: "Eine Schluesselkontrolle durch Lieferantenkonfiguration ausgesetzt: welche Anforderungen beruehrt wurden",
    question:
      "A key control in the Internal Control System has been waived by supplier configuration since 11.11.2024. Which obligations did today touch, in which jurisdiction, and does anything we have already stated need to change? Illustrative regulatory context, not legal advice.",
    judgmentKind: "applicability",
    presentedAtMoment: "15:00",
    priorityRank: 5,
    whyThisMatters:
      "Incidents are events and obligations are continuous. An event that is closed operationally can leave a stated position wrong, and a wrong stated position does not resolve itself. If Arcadia has described its payment control environment in any supervisory or internal governance context, and a key control was waived by configuration for 3 hours 56 minutes today and on seven prior occasions, deciding whether that changes a stated position is a judgment with consequences. Illustrative regulatory context, not legal advice.",
    preparedPosition:
      "Four obligation states changed in the EU lane and three in the Swiss lane, and none crosses. The correct output on the stated position question is a precisely framed question routed to Group Legal and the Chief Compliance Officer with a named owner, not an answer from this function. The two incident classification assessments must remain two records against two frameworks with no shared fields, and both must carry an explicit reassessment trigger on receipt of the supplier report due 13.10.2026. The unnotified subprocessor change at 13:31 raises a subcontracting question in the EU lane and an inventory question in the Swiss lane, separately. The monitoring subprocessor is correctly recorded in both, so the detection failure raises a resilience obligation and not a register one, which is a negative finding worth stating. Illustrative regulatory context, not legal advice.",
    supportingEvidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41911", "EVD-2026-41907"],
    opposingEvidenceIds: ["EVD-2026-41908", "EVD-2026-41410"],
    uncertaintyNote:
      "Whether any position Arcadia has stated externally about its payment control environment now requires review is a question for Group Legal and the Chief Compliance Officer. This function has framed the question and identified the facts bearing on it and does not answer it. The firing history since 11.11.2024 is from the supplier's own export and is consistent with, but not verified by, Arcadia's own configuration audit log. Illustrative regulatory context, not legal advice.",
    confidence: 0.54,
    requiredAuthority:
      "Obligation impact determination per lane, Group Regulatory Change Standard section 2.1. Any conclusion about a previously stated external position requires Group Legal and the Group Chief Compliance Officer. Illustrative regulatory context, not legal advice.",
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_INCIDENT_CLASSIFICATION,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  /* ----------------------------------------------------------------------
     nfr-governance, P-001 Dr. Katharina Vogt
     ---------------------------------------------------------------------- */

  {
    id: "DEC-2026-0755",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-D1",
    roleId: "nfr-governance",
    entityId: ENTITY_DE,
    title: "Four Red indicators: four problems or one causal chain",
    titleDe: "Vier rote Indikatoren: vier Probleme oder eine Ursachenkette",
    question:
      "Four indicators are Red with four different owners in four functions. My reporting presents them as four rows. Do I report them to the committee as one causal chain, knowing that two of the six links are inferred?",
    judgmentKind: "materiality",
    presentedAtMoment: "07:45",
    priorityRank: 1,
    whyThisMatters:
      "Aggregation is interpretation, and deciding that four Red indicators are one issue is the single most valuable judgment in this role. Four separate rows is what the committee has seen every quarter and has acted on never. A chain is more useful and more contestable: a chair who rejects one inferred link can reject the whole, and the presentation choice decides whether that is a risk worth taking.",
    preparedPosition:
      "One chain with seven nodes and six links, presented as a hypothesis with the two inferred links marked. The chain runs from gateway availability in September, through route substitution override growth, to the override rate breach, alongside reviewer capacity at 3.0 filled of 4.0 approved, to the four eyes control assessed Partially Effective, to a remediation action 67 days past its revised due date, to a residual risk outside appetite. Four links are evidenced from records. Two are inferential: the link from fallback activation frequency to route substitution growth rests on temporal correlation across five windows with 181 of 198 overrides inside them, and the link from reviewer capacity to deviation frequency has no recorded evidence connecting the vacancy to any specific deviation.",
    supportingEvidenceIds: ["EVD-2026-41821", "EVD-2026-41820", "EVD-2026-41810", "EVD-2026-41850"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41250", "EVD-2026-41822"],
    uncertaintyNote:
      "The chain is a hypothesis with six links, four evidenced and two inferred, and presenting it as established would be the more persuasive and less defensible choice. The reviewer capacity link is the weaker of the two: nothing in the deviation records connects any specific deviation to the vacancy, and the three human deviations in the test sample each have a stated cause that does not mention capacity.",
    confidence: 0.65,
    requiredAuthority:
      "Group aggregate position determination, Group Non-Financial Risk Framework section 6.1. The portfolio lead owns the aggregate view; indicator owners retain their own positions.",
    relatedObjectKind: "kri",
    relatedObjectId: KRI_OVERRIDE_RATE,
    fromSharedEvent: false,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0756",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-D2",
    roleId: "nfr-governance",
    entityId: ENTITY_DE,
    title: "A live risk acceptance whose condition is unmet and unplanned",
    titleDe: "Eine gueltige Risikoakzeptanz mit unerfuellter und ungeplanter Bedingung",
    question:
      "The third party service risk is held outside appetite under a conditional Risikoakzeptanz valid to 31.12.2026, conditioned on completing the reassessment and performing an exit test. The exit test is not started and not planned. Do I recommend withdrawal, re-conditioning, or leaving it?",
    judgmentKind: "risk-acceptance",
    presentedAtMoment: "07:45",
    priorityRank: 2,
    whyThisMatters:
      "An acceptance operating on an unmet condition is a governance failure of my own machinery rather than of the risk owner's delivery. Withdrawing it leaves a Medium-High risk uncovered and forces an executive decision under time pressure. Leaving it in place preserves an acceptance whose condition has been defeated. Neither is safe and one must be chosen, which is the shape of most real governance decisions and almost none of the ones that get written down.",
    preparedPosition:
      "Re-condition rather than withdraw, and disclose that the condition was never tracked. The acceptance has two conditions: the 2026 reassessment, which is in progress and 25 days from its target close, and an exit and substitutability test, which is not started with a 31.12.2026 date and no plan. The second condition's purpose was to establish that the concentration position is exitable, and the exit plan relies on a payment repair capability Arcadia does not hold, so the condition has been defeated rather than merely delayed. Withdrawal forces an executive decision with 86 days to expiry and no alternative arrangement, which is a decision the committee cannot usefully take at short notice.",
    supportingEvidenceIds: ["EVD-2026-41204", "EVD-2026-41440", "EVD-2026-41435"],
    opposingEvidenceIds: ["EVD-2026-41445", "EVD-2026-41425"],
    uncertaintyNote:
      "Whether the exit test condition has been defeated or merely delayed depends on whether an exit test is executable at all, and that rests on the assessment that the exit plan assumes a capability Arcadia does not hold. That assessment is drawn from the capability register and the exit plan text; nobody has asked the business owner whether an interim manual capability could be stood up. Re-conditioning is also the third time this arrangement's assurance has been deferred, and the record does not show whether prior deferrals were met.",
    confidence: 0.61,
    requiredAuthority:
      "Recommendation on a live Risikoakzeptanz. The portfolio lead recommends; withdrawal or re-conditioning requires the entity Chief Operating Officer who approved it, noted by the Group NFR Committee.",
    relatedObjectKind: "risk",
    relatedObjectId: RSK_THIRD_PARTY_SERVICE,
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0757",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-D3",
    roleId: "nfr-governance",
    entityId: ENTITY_DE,
    title: "Pre-resolve the control divergence, or table it as a divergence",
    titleDe: "Die Kontrolldivergenz vorab klaeren oder als Divergenz vorlegen",
    question:
      "The first and second lines disagree in writing about a key control in the Internal Control System, and I have to draft the paper. Do I push for resolution before the paper closes, or table the divergence as a divergence and make the committee do the work?",
    judgmentKind: "agenda",
    presentedAtMoment: "07:45",
    priorityRank: 3,
    whyThisMatters:
      "Resolving it first is tidier and risks the resolution being dilution, which produces a rating nobody argued for and nobody will defend. Tabling it is more honest and makes the committee do work it may not want to do, and it exposes me to the question of why the second line could not settle a control rating. Both positions are held by people I need, and how I present a divergence is the part of this role that is easiest to get quietly wrong.",
    preparedPosition:
      "Table it as a divergence, with both positions in their owners' words and neither editorialised. The first line position is recorded 29.09.2026 with a three line rationale; the second line conclusion is in the control test report of 25.09.2026. Both are internally consistent and both rest on the same facts. The temptation to lead the committee toward the second line position is strong and professionally wrong. There is a reason to hold rather than force: the supplier configuration that would settle the disputed element has been demanded and may arrive today, and an agreement reached before it arrives would be an agreement about nothing.",
    supportingEvidenceIds: ["EVD-2026-41850", "EVD-2026-41855", "EVD-2026-41200"],
    opposingEvidenceIds: ["EVD-2026-41805", "EVD-2026-41852"],
    uncertaintyNote:
      "Holding a divergence open looks like inaction and is hard to distinguish from it in a status report. If the configuration does not arrive, the committee receives an unresolved rating on a key control with no prospect of resolution before the next quarter, and the honest answer to the chair's question of why is that the second line was waiting on a supplier.",
    confidence: 0.6,
    requiredAuthority:
      "Committee agenda design and paper framing, committee secretary mandate under the Group Non-Financial Risk Framework section 6.1.",
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    fromSharedEvent: false,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0763",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-D4",
    roleId: "nfr-governance",
    entityId: ENTITY_DE,
    title: "MSN-2026-0147 at 67 days: re-baseline or escalate to the entity board",
    titleDe: "MSN-2026-0147 nach 67 Tagen: Neuterminierung oder Eskalation an den Vorstand der Einheit",
    question:
      "A remediation action is 67 days past its revised due date, which triggers the escalation rule. The owner is a peer, the delay is a verifiable infrastructure freeze, and he has proposed 31.10.2026. Do I recommend re-baselining with a root cause, or escalation to the entity board?",
    judgmentKind: "escalation",
    presentedAtMoment: "11:45",
    priorityRank: 4,
    whyThisMatters:
      "This is a judgment about a peer's performance with a real relationship cost, and about whether the delay is dependency or neglect. The action is genuinely blocked by an infrastructure change freeze running to 14.10.2026, which makes re-baselining defensible and makes not saying so indefensible. It is also the third date on this action, and the group has granted four second extensions in eight quarters with no record of whether any of them were met.",
    preparedPosition:
      "Re-baseline to 31.10.2026, disclose the committee's own unmet condition in the same paper, and add a third element that neither option contains. The dependency chain is verified end to end: the supplier change was delivered to pre production on 18.09.2026, the Arcadia acceptance testing request of 22.09.2026 is unanswered, and the freeze runs to 14.10.2026, so the action cannot close before then whatever anyone commits to. The proposed date is achievable on that chain. The third element is a request that the committee require completion reporting on all prior extensions, because nobody knows whether extensions work.",
    supportingEvidenceIds: ["EVD-2026-41280", "EVD-2026-41102", "EVD-2026-41205", "EVD-2026-41105"],
    opposingEvidenceIds: ["EVD-2026-41850", "EVD-2026-41855"],
    uncertaintyNote:
      "The action is reported at 60 of 100 complete by its owner and no evidence supports or contradicts that figure. The verifiable facts are the delivery note, the unanswered testing request and the freeze end date. Whether 31.10.2026 will be met depends on acceptance testing scheduling behaviour, on which there is one data point: a request unanswered after 14 days. The 14.04.2026 extension was granted on a condition of monthly progress reporting to the committee and no report has been made since July, which is a failure of the committee's own follow up.",
    confidence: 0.72,
    requiredAuthority:
      "Overdue remediation escalation recommendation, Group Non-Financial Risk Framework section 6.1. Board escalation requires the Group NFR Committee to refer it; the portfolio lead recommends only.",
    relatedObjectKind: "action",
    relatedObjectId: "MSN-2026-0147",
    fromSharedEvent: false,
    sharedThreadId: null,
    ...OPEN,
  },

  {
    id: "DEC-2026-0781",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-D5",
    roleId: "nfr-governance",
    entityId: ENTITY_DE,
    title: "Committee agenda architecture against a fact arrival schedule",
    titleDe: "Aufbau der Gremienagenda gegen einen Zeitplan des Faktenzugangs",
    question:
      "Papers close 08.10.2026 at 12:00. The supplier's root cause report is due 13.10.2026, the morning of the meeting. Late papers cannot carry a decision. Do I ask the committee for a decision on incomplete facts, and if so, what question can it actually answer?",
    judgmentKind: "agenda",
    presentedAtMoment: "15:00",
    priorityRank: 5,
    whyThisMatters:
      "Agenda design is the only real power this role holds. Whether the event is a noting item or a decision item determines whether anything happens. Choosing decision commits me to framing a question the committee can answer by 13.10.2026, and asking for nothing loses a quarter. The constraint is exact and arithmetical: one day and a bit to write a decision paper on an event whose supplier account arrives after my deadline and before my meeting.",
    preparedPosition:
      "Write the papers on verified facts as at 08.10.2026, state every fact's class explicitly, and ask a question the supplier's report cannot invalidate whatever it says. Concretely, the committee is not asked what caused this, because the supplier's report will answer that. It is asked whether the group accepts that a supplier configurable rule can waive a key control in the Internal Control System without an Arcadia control owner review, and what change that requires. That question is answerable on 08.10.2026 facts and stays answerable whatever arrives on 13.10.2026. A tenth agenda item is added as a decision item.",
    supportingEvidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41921", "EVD-2026-41821"],
    opposingEvidenceIds: ["EVD-2026-41924", "EVD-2026-41871"],
    uncertaintyNote:
      "One fact material to the papers does not yet exist: the examination of all 96 overrides, due 07.10.2026 at 12:00, which will exist before papers close. The supplier's report will not. Two of the causal chain's links remain inferred and are marked as such in every paper. Adding an agenda item is cheap and removing one is not, so an item added on facts that later change has to be re-scoped in front of the chair.",
    confidence: 0.76,
    requiredAuthority:
      "Committee secretary mandate. Agenda composition and item type are the portfolio lead's; the decision quorum and the chair's discretion are not.",
    relatedObjectKind: "committee",
    relatedObjectId: "CMT-NFR-2026-10",
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },

  {
    id: "DEC-2026-0784",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-D6",
    roleId: "nfr-governance",
    entityId: ENTITY_DE,
    title: "Portfolio materiality of the payments override theme",
    titleDe: "Portfoliorelevanz des Themas manuelle Zahlungsueberschreibungen",
    question:
      "Six functions have contributed evidence to one matter today and each of them would report it separately. What is the group's portfolio materiality of this theme, and what does that materiality oblige?",
    judgmentKind: "materiality",
    presentedAtMoment: "16:30",
    priorityRank: 6,
    whyThisMatters:
      "Portfolio materiality is not a summary of six ratings. It is a statement about what the group is willing to live with, and it determines whether the theme gets a standing item, an executive owner and a risk appetite discussion, or a paragraph in a dashboard. Two things landed today that are about my own machinery rather than about payments: a zero tolerance statement with no monitoring capable of detecting a breach, and a documentation action on the exact rule that sat untouched for eleven days.",
    preparedPosition:
      "High, on three grounds that are structural rather than incidental. First, a supplier configurable rule waived a key control in the Internal Control System for 3 hours 56 minutes today and on seven prior occasions since 11.11.2024, and Arcadia's own change approval let it in. Second, the zero tolerance impact tolerance that this breaches had no detection capability: the 96 candidate breaches were found by an ad hoc query at 14:34, not by a control, which is a framework defect owned by this function. Third, one erroneous release is confirmed, which converts an assessed risk into a materialised one. The obligation that follows is a risk appetite discussion at the committee, not another remediation action.",
    supportingEvidenceIds: ["EVD-2026-41905", "EVD-2026-41878", "EVD-2026-41924", "EVD-2026-41930", "EVD-2026-41821"],
    opposingEvidenceIds: ["EVD-2026-41855", "EVD-2026-41250", "EVD-2026-41921"],
    uncertaintyNote:
      "One confirmed erroneous release in a sample of 20 drawn from 96 does not establish the scale of the consequence, and the examination of all 96 is not complete until 07.10.2026 at 12:00. If it finds no further errors, the materiality argument rests on the control failure rather than on its consequence, which is a weaker case to a committee that reads outcomes. The supplier's account of root cause does not exist yet.",
    confidence: 0.69,
    requiredAuthority:
      "Portfolio materiality determination, Group Non-Financial Risk Framework section 6.1. A High portfolio materiality obliges an item at the next committee and notification to the Group Chief Risk Officer.",
    relatedObjectKind: "portfolio-theme",
    relatedObjectId: THEME_OVERRIDE,
    fromSharedEvent: true,
    sharedThreadId: THREAD_OVERRIDE,
    ...OPEN,
  },
];

/* ==========================================================================
   Decision options

   Every option here is defensible. A professional who picks any of them can
   explain the choice to a chair, to a third line and to a supervisor. Option
   sets that contain one real answer and two obviously wrong ones are how
   decision support quietly becomes decision replacement, so there are none
   of those in this file.

   Twelve of the thirty eight decisions carry no recommended option. That is
   not an omission. On a genuinely balanced judgment the system states the
   positions and stops, because a recommendation on a balanced judgment is
   an instruction wearing a suggestion's clothes.

   Every consequence kind below is implemented in mapConsequence in
   src/scenario/engine/decide.ts. The payload shape each kind expects is
   fixed by that function: targetId is the object the tool mutates, value is
   the tool's principal argument, and note is the rationale, scope or body
   text. Options with material consequences all carry requiresApproval.
   ========================================================================== */

/** The declared consequence shape. Matches decisionOptions.consequences. */
interface Consequence {
  kind: string;
  targetId: string;
  value?: string;
  note?: string;
}

interface OptionSpec {
  label: string;
  labelDe: string;
  description: string;
  riskImplication: string;
  consequences: Consequence[];
  requiresApproval: boolean;
  isRecommended?: boolean;
  recommendationBasis?: string;
}

/**
 * Expands an option specification into rows.
 *
 * Deterministic by construction: identifiers are the decision identifier
 * plus the one based position, and sortOrder is the position. No random
 * values anywhere in this module, because the same seed must produce the
 * same day every time it is run.
 */
function options(decisionId: string, specs: OptionSpec[]): NewDecisionOption[] {
  return specs.map((spec, index) => ({
    id: `${decisionId}-O${index + 1}`,
    runId: DEFAULT_RUN_ID,
    decisionId,
    label: spec.label,
    labelDe: spec.labelDe,
    description: spec.description,
    isRecommended: spec.isRecommended ?? false,
    recommendationBasis: spec.recommendationBasis ?? "",
    riskImplication: spec.riskImplication,
    consequences: spec.consequences,
    requiresApproval: spec.requiresApproval,
    sortOrder: index + 1,
  }));
}

export const decisionOptions: NewDecisionOption[] = [
  /* ----------------------------------------------------------------------
     tprm
     ---------------------------------------------------------------------- */

  ...options("DEC-2026-0741", [
    {
      label: "Material gap: raise a reassessment finding and require a dated remediation plan",
      labelDe: "Wesentliche Luecke: Feststellung erheben und datierten Massnahmenplan verlangen",
      description:
        "Raise the recovery time delta as a finding against the reassessment, demand a remediation plan with committed dates, and demand recovery evidence for the Swiss instance, which the existing report does not cover. Enhanced monitoring runs until the plan is credible.",
      riskImplication:
        "Records that a service supporting an important business service has no demonstrated recovery capability at its contracted objective, and that one of the three entities it serves has no recovery evidence at all. The open item count on the reassessment rises rather than falls 25 days from its target close.",
      isRecommended: true,
      recommendationBasis:
        "The delta is 1 hour 40 minutes on the tool that repairs payments for three entities, there is no remediation plan and no supplier notification of the miss, and the report's scope excludes the Swiss instance. On those three facts a service level conversation is not a proportionate response.",
      consequences: [
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "RepairDesk recovery time objective is not demonstrated and the Swiss instance is unevidenced",
          note: "The supplier DR test report of 22.05.2026 shows recovery in 3 hours 40 minutes against a contracted objective of 2 hours, with no explanation, no remediation plan and no notification to Arcadia. The report covers the Frankfurt and Amsterdam regions only, so the Swiss instance hosted at TP-0042.1 has no recovery evidence.",
        },
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "Remediation plan with committed dates for the RepairDesk recovery objective, plus a recovery test report covering the Swiss instance used by ARC-CH",
        },
        {
          kind: "activate-monitoring",
          targetId: TP_NOVALINK,
          value: "supplier",
          note: "Weekly review of recovery evidence and service level reporting until a dated remediation plan is accepted.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Service level point: handle it in the monthly service review",
      labelDe: "Service-Level-Punkt: in der monatlichen Dienstleistungsueberpruefung behandeln",
      description:
        "Treat the delta as a service level matter for the monthly governance review, ask the supplier to confirm the test conditions behind both figures, and leave the reassessment question open pending that answer.",
      riskImplication:
        "Keeps the reassessment open item count where it is and keeps the relationship on a commercial footing. If the supplier's answer is that the two figures are measured under different conditions, nothing further is required; if it is not, the matter arrives at the next review with a month of delay and no finding on the record.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: TP_NOVALINK,
          value: "recovery objective measurement conditions",
          note: "Confirm the test conditions under which the 22.05.2026 recovery figure of 3 hours 40 minutes was measured, and the conditions the contracted 2 hour objective in Appendix A1 is measured under, so that Arcadia can establish whether the two figures are comparable.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Material, and raise Arcadia's own 137 day evidence handling failure alongside it",
      labelDe: "Wesentlich, und zugleich das eigene Versaeumnis bei der Nachweisbearbeitung erheben",
      description:
        "Raise the supplier finding and, separately, record that the evidence sat retrievable in the vault for 137 days without escalation. Put the second item to the committee, because it is a failure of Arcadia's assurance process rather than of the supplier's service.",
      riskImplication:
        "Places a finding about Arcadia's own evidence handling in front of the committee on the same day as five other items. It is the more uncomfortable disclosure and the one an auditor would ask about, because having the document and not reading it is a different failure from not having it.",
      consequences: [
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "RepairDesk recovery time objective is not demonstrated and the Swiss instance is unevidenced",
          note: "Recovery in 3 hours 40 minutes against a contracted objective of 2 hours, unreported by the supplier, with no coverage of the Swiss instance.",
        },
        {
          kind: "create-issue",
          targetId: "EVD-2026-40118",
          value: "Supplier assurance evidence held for 137 days without assessment or escalation",
          note: "The DR test report was received on 22.05.2026 and retrieved into the vault on 15.06.2026. The recovery gap on page 11 was not assessed until 06.10.2026. This is a defect in Arcadia's evidence triage rather than in the supplier's disclosure.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0741",
          value: "Supplier assurance evidence triage: a recovery gap held unassessed for 137 days",
          note: "For noting. The evidence was retrievable throughout. The question for the committee is whether inbound supplier assurance evidence needs an assessment service level rather than a filing destination.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Accept with limitation for this cycle and carry the objective into the 2027 plan",
      labelDe: "Fuer diesen Zyklus mit Einschraenkung annehmen und das Ziel in den Plan 2027 uebernehmen",
      description:
        "Record the artefact as accepted with the limitation stated, so the reassessment can close on time with the recovery objective named as an unresolved item, and carry the objective as a 2027 assurance priority with monitoring in the interim.",
      riskImplication:
        "Lets the cycle close on 31.10.2026 with the gap visible in the assessment rather than resolved. It is honest and it defers the substance by up to a year on a Tier 1 sole provider, which is defensible only if the monitoring is real.",
      consequences: [
        {
          kind: "record-supplier-assessment",
          targetId: TP_NOVALINK,
          value: "Accepted with limitation",
          note: "Recovery evidence accepted with the limitation that the tested outcome of 3 hours 40 minutes exceeds the contracted objective of 2 hours and that no evidence exists for the Swiss instance. The limitation is carried into the 2027 assurance plan as a priority item.",
        },
        {
          kind: "activate-monitoring",
          targetId: TP_NOVALINK,
          value: "supplier",
          note: "Weekly review of recovery and availability evidence for the remainder of the 2026 cycle.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0742", [
    {
      label: "The appendix divergence gets the morning",
      labelDe: "Die Anlagenabweichung erhaelt den Morgen",
      description:
        "Work the divergence first: establish which appendix version binds, search the repository for any notice, and put the three contractual routes in front of Legal and the commercial owner today. The reassessment gets the afternoon and the chasing runs in parallel.",
      riskImplication:
        "The contractual clock starts today rather than next week. The reassessment's four open resilience questions stay open into a cycle that closes in 25 days, which has to be disclosed to the assessment committee as a conditional close.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: "CTR-2023-0117-A3",
          value: "binding appendix version",
          note: "Confirm which version of Appendix A3 binds as at 06.10.2026, and whether any notice of a subprocessor addition or region change has been received through any channel, including commercially.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "The reassessment gets the morning",
      labelDe: "Die Neubewertung erhaelt den Morgen",
      description:
        "Work the four unresolved resilience questions first, because they carry the cycle date. Take the exit and substitutability question to the business owner, escalate the penetration test scope silence, and hold the divergence for the afternoon.",
      riskImplication:
        "Protects the cycle date and the assessment's credibility. The divergence waits, and since it cannot be resolved without a contractual route that takes weeks, a day lost is a day removed from the only window before the committee.",
      consequences: [
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "Exit and substitutability test evidence for the payment repair service, and a penetration test scope statement confirming whether the override interfaces were in scope",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Split the morning and accept that neither finishes",
      labelDe: "Den Morgen teilen und hinnehmen, dass keines fertig wird",
      description:
        "Take the divergence to the point where Legal and the commercial owner have what they need, then turn to the reassessment. Neither item completes and both move, which is what the supplier governance review at 10:30 needs anyway.",
      riskImplication:
        "Both matters advance and neither reaches a decision point today. The supplier review then covers both at a level of detail that invites deferral on each, which is the outcome the last three monthly reviews produced with three of five commitments unmet.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: TP_NOVALINK,
          value: "open commitments and notice history",
          note: "Confirm the status of the three unmet commitments from the September service review, and whether the subprocessor register publication of 03.08.2026 was intended as notice under Appendix A3 clause 3.4.",
        },
      ],
      requiresApproval: false,
    },
  ]),

  ...options("DEC-2026-0743", [
    {
      label: "Rating unchanged, basis restated with four assertion deltas on the record",
      labelDe: "Bewertung unveraendert, Grundlage mit vier Abweichungen dokumentiert",
      description:
        "Hold Tier 1 and the concentration flag, and write the four assertion against observation pairs into the supplier record: recovery objective, monthly availability, notification timeliness and subprocessor notice. The rating does not move and the evidence behind it becomes stateable.",
      riskImplication:
        "Nothing in the contractual or testing obligations changes. What changes is that the next reassessment, the next committee paper and any supervisory question can be answered with evidence rather than with a rating.",
      consequences: [
        {
          kind: "record-supplier-assessment",
          targetId: TP_NOVALINK,
          value: "Tier 1 confirmed, disclosure discipline deteriorating",
          note: "Criticality unchanged at Tier 1 with the concentration flag retained. Basis restated on four assertion against observation pairs: a 2 hour recovery objective against a tested 3 hours 40 minutes; a contracted monthly availability of 99.7 against a calculated 99.62 (scenario figures); a 30 minute notification commitment with six mandatory fields; and a 60 day subprocessor notice obligation with no notice on record.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Raise the concentration position and require an exit test date before the cycle closes",
      labelDe: "Konzentrationsposition heraufsetzen und Termin fuer Ausstiegstest vor Zyklusende verlangen",
      description:
        "Treat the September pattern as a change in the concentration position rather than in the criticality tier, and make an exit and substitutability test date a condition of closing the cycle. The test is already a condition of a live risk acceptance and is not started.",
      riskImplication:
        "Puts a dated demand on a business owner who has no budget line for it and forces the unmet acceptance condition into the open. It also makes the reassessment's close dependent on a test that takes months, which the assessment committee may refuse.",
      consequences: [
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "Concentration position untested: no exit or substitutability test exists for a Tier 1 sole provider",
          note: "Substitutability was last assessed 30.06.2025 as achievable within 12 to 18 months with material programme cost, and no test has been performed. The exit plan relies on an internal payment repair capability that Arcadia does not hold.",
        },
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "Exit and substitutability test plan with a committed date for the payment repair service",
        },
        {
          kind: "activate-monitoring",
          targetId: TP_NOVALINK,
          value: "supplier",
          note: "Weekly monitoring of availability, fallback activation frequency and notification timeliness for the remainder of the cycle.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Apply a restriction on new scope until the reassessment closes",
      labelDe: "Beschraenkung fuer neuen Leistungsumfang bis zum Abschluss der Neubewertung",
      description:
        "Leave the tier and the concentration flag where they are and restrict the arrangement so that no new service or scope is added to this supplier until the 2026 reassessment closes with the four resilience questions resolved.",
      riskImplication:
        "A restriction that bites on future scope rather than on current service is executable, unlike a restriction on a sole provider's live service. It signals to the supplier and to the business that assurance gaps have a commercial consequence, and it will be read by the commercial owner as an obstruction with a cost.",
      consequences: [
        {
          kind: "apply-supplier-restriction",
          targetId: TP_NOVALINK,
          value: "no-new-scope-pending-reassessment",
          note: "No additional service, entity accession or scope extension until the 2026 reassessment closes with the four unresolved resilience questions answered.",
        },
        {
          kind: "send-collaboration-message",
          targetId: TP_NOVALINK,
          value: "Restriction on new scope for TP-0042 pending reassessment close",
          note: "A restriction on new scope applies to Novalink until the 2026 reassessment closes. Existing services are unaffected. The reason is four unresolved resilience questions and a supplier disclosure pattern documented in the September service review.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0759", [
    {
      label: "Three characterisations, three routes, three owners",
      labelDe: "Drei Einordnungen, drei Wege, drei Verantwortliche",
      description:
        "Split the divergence rather than characterising it once. Meridian is a notice failure to be asserted formally under clause 3.4; the Amsterdam region is a material change requiring a contract variation; fourth parties are a drafting gap with no obligation breached. Each gets an owner and a date.",
      riskImplication:
        "Preserves the assertable right on the one item where the facts support it, keeps the negotiation open on the second, and avoids asserting a breach on the third where none exists. It is the characterisation most likely to survive a supplier's legal review and it takes three tracks rather than one to manage.",
      isRecommended: true,
      recommendationBasis:
        "The three items have materially different facts. One subprocessor is absent from the appendix with no notice on record, one listed subprocessor has an undisclosed region, and one party sits outside the appendix's drafted scope entirely. A single characterisation would be wrong on two of the three whichever one is chosen.",
      consequences: [
        {
          kind: "create-issue",
          targetId: "CTR-2023-0117-A3",
          value: "Subprocessor appendix divergence resolved into three separate matters",
          note: "TP-0042.4 Meridian: absent from the binding appendix, onboarded 01.05.2026, no notice on record after a repository and mailbox search. Notice failure under clause 3.4, to be asserted formally. TP-0042.2 Rheinstack: listed for the Frankfurt region only while operating an Amsterdam region. Material change requiring a variation. TP-0042.3-F1 Aurora: fourth party holding payment metadata for 24 months, outside the appendix as drafted. Drafting gap, no obligation breached.",
        },
        {
          kind: "create-action",
          targetId: TP_NOVALINK,
          value: "Issue a clause 3.4 notice on the unnotified subprocessor and open a variation on the undisclosed region",
          note: "Three sub items with three owners: the formal notice with Group Legal, the variation request with the commercial owner, and a fourth party clause to be drafted into Appendix A3.",
        },
        {
          kind: "request-factual-validation",
          targetId: TP_NOVALINK,
          value: "portal publication as notice",
          note: "Confirm whether Novalink considers publication of its subprocessor register on the client portal to constitute prior written notice under Appendix A3 clause 3.4, and identify any notice given through another channel.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Breach: assert clause 3.4 across the whole divergence",
      labelDe: "Vertragsverletzung: Klausel 3.4 fuer die gesamte Abweichung geltend machen",
      description:
        "Characterise the divergence as a single breach of the subprocessor notice obligation, issue a formal notice covering the unnotified subprocessor and the undisclosed region, and start the 30 day objection clock on both.",
      riskImplication:
        "Preserves every right Arcadia has and starts a clock the supplier must answer. It also asserts a breach on the region change, where the subprocessor was listed and the change may be argued as within an existing disclosure, and it hardens a supplier Arcadia needs cooperative for a reassessment due in 25 days.",
      consequences: [
        {
          kind: "create-issue",
          targetId: "CTR-2023-0117-A3",
          value: "Breach of Appendix A3 clause 3.4 asserted: undisclosed subprocessor and undisclosed region",
          note: "Formal notice to be issued asserting failure to give 60 days prior written notice of a subprocessor addition and of a material change to a listed subprocessor's operating regions. The 30 day objection window runs from the date of notice.",
        },
        {
          kind: "apply-supplier-restriction",
          targetId: TP_NOVALINK,
          value: "notice-served-objection-window-open",
          note: "No new subprocessor or region may be brought into scope for Arcadia services while the objection window is open.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Commercial dispute: put it to the monthly review and the variation route only",
      labelDe: "Kommerzielle Streitfrage: nur ueber die monatliche Ueberpruefung und den Aenderungsweg",
      description:
        "Treat the whole divergence as a disagreement about what the appendix requires, resolve it through a single contract variation that restates the subprocessor list and adds a fourth party provision, and assert no breach.",
      riskImplication:
        "Preserves the relationship and produces a contract that matches reality, on a timeline that prior variations took 41 and 58 days to complete. It forfeits the assertable notice right on the one item where the facts support it, and an unasserted right is difficult to revive later.",
      consequences: [
        {
          kind: "create-action",
          targetId: TP_NOVALINK,
          value: "Agree a contract variation restating the subprocessor list and adding a fourth party provision",
          note: "Single variation covering the unnotified subprocessor, the undisclosed region and a new fourth party notice obligation. No breach asserted. Owner is the commercial relationship owner with Group Legal.",
        },
        {
          kind: "send-collaboration-message",
          targetId: "CTR-2023-0117-A3",
          value: "Subprocessor appendix to be restated by variation",
          note: "Arcadia will pursue a single variation to Appendix A3 covering the subprocessor list, the operating regions and a fourth party notice obligation. No breach is asserted at this stage.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0779", [
    {
      label: "Shared accountability, with three named components",
      labelDe: "Geteilte Verantwortung mit drei benannten Bestandteilen",
      description:
        "Record the finding as shared accountability and name all three components: supplier non disclosure in the release notes, Arcadia's change approval without a control owner review, and Arcadia's control description left asserting no exceptions for 23 months.",
      riskImplication:
        "Costs the cleaner supplier argument at committee and produces three actions rather than one, including a change in how Arcadia reviews supplier release notes. It is the only reading that survives the change record and the release notes, which are Arcadia's own documents.",
      isRecommended: true,
      recommendationBasis:
        "The configuration export and the 2024 change record together show a supplier template applied during a supplier release with non disclosing release notes, approved by Arcadia with no control owner review, against a control description Arcadia then left unchanged. Attributing that to one party requires ignoring one of the two documents.",
      consequences: [
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "Supplier configuration template waived a key Arcadia control gate without disclosure",
          note: "Rule RD-RULE-0031 entered the arcadia-prod tenant with RepairDesk release 8.3 on 11.11.2024, applied from Novalink standard template BCP-THROUGHPUT-v2. Release notes referred to continuity throughput improvements for fallback routing and named no control waiver. Accountability is shared: supplier non disclosure, Arcadia change approval without control owner review, and Arcadia control description not updated since 14.01.2025.",
        },
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Require control owner review of supplier release notes for any change affecting a key control",
          note: "Arcadia side remediation. Supplier releases to systems hosting key controls in the Internal Control System must be reviewed by the named control owner before change approval, and the review must be recorded on the change record.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0779",
          value: "A supplier configurable rule waived a key control in the Internal Control System for 23 months",
          note: "For decision. Shared accountability with three components. The question for the committee is what change Arcadia requires in supplier release governance, not what the supplier should have said.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Supplier failure: non disclosure in a release affecting a client control",
      labelDe: "Lieferantenversagen: Nichtoffenlegung in einer Freigabe mit Auswirkung auf eine Kundenkontrolle",
      description:
        "Record the finding against the supplier alone. A standard configuration template removed a client control gate during a supplier release and the release notes did not say so, which is a disclosure failure regardless of what the client's change process did next.",
      riskImplication:
        "Produces the strongest supplier finding and the cleanest committee narrative, and it is the framing the business will prefer. It leaves Arcadia's change approval and control description failures unrecorded, which Internal Audit will find, and it invites the supplier to answer that the configuration sits in Arcadia's tenant.",
      consequences: [
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "Supplier release notes did not disclose that a client control gate would be waived",
          note: "Release 8.3 applied template BCP-THROUGHPUT-v2 to the arcadia-prod tenant on 11.11.2024. The release notes referred only to continuity throughput improvements. A change that sets secondaryReviewRequired to false on a class of payment overrides is a change to a client control and was not disclosed as one.",
        },
        {
          kind: "apply-supplier-restriction",
          targetId: TP_NOVALINK,
          value: "configuration-change-freeze-pending-review",
          note: "No standard configuration template may be applied to Arcadia tenants without itemised disclosure of control effects and Arcadia control owner acceptance.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Arcadia change governance failure, with the supplier disclosure point as a secondary finding",
      labelDe: "Versagen der eigenen Aenderungssteuerung, Offenlegungspunkt des Lieferanten als Nebenfeststellung",
      description:
        "Record the primary finding against Arcadia's own change approval. The rule is client configurable, it sat in Arcadia's tenant for 23 months, Arcadia approved the release that introduced it, and Arcadia could have removed it at any point. The supplier's non disclosure is recorded as a contributing factor.",
      riskImplication:
        "The most self critical framing and the hardest to dismiss. It weakens the contractual position against the supplier on this point, because Arcadia would be recording that the configuration was its own to manage, and that record would be read in any later commercial discussion.",
      consequences: [
        {
          kind: "create-issue",
          targetId: CTL_FOUR_EYES,
          value: "Arcadia change approval admitted a supplier configuration that waived a key control",
          note: "CHG-2024-5512 approved RepairDesk release 8.3 on the basis of supplier release notes with no control owner review. The rule is client configurable and remained in the tenant for 23 months. The control description continued to assert that review applies to all overrides without exception.",
        },
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Reconcile every key control description against its implemented system configuration",
          note: "Scope is all key controls in the Internal Control System whose enforcement depends on a system state or a configurable rule. The payments control is the first case; three further candidates were identified in the Q4 test plan screen.",
        },
        {
          kind: "send-collaboration-message",
          targetId: CTL_FOUR_EYES,
          value: "Control description and tenant configuration are inconsistent for CTL-PAY-014",
          note: "The control description states that independent secondary review applies to all manual overrides without exception. The RepairDesk tenant configuration waives it for route substitution overrides below EUR 250,000 while the fallback route is active. The description has not been updated since 14.01.2025.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0785", [
    {
      label: "Conditional approval on four conditions, with enhanced monitoring",
      labelDe: "Bedingte Genehmigung mit vier Bedingungen und verstaerkter Ueberwachung",
      description:
        "Take the arrangement to conditional approval with four conditions: the rule change confirmed in the tenant for all three entities, recovery evidence for the Swiss instance, a change notification commitment binding below the supplier, and an exit and substitutability test with a date. Enhanced monitoring runs to the cycle close.",
      riskImplication:
        "Keeps the service running, which is the only realistic operating assumption for a sole provider of payment validation, repair tooling and Swiss clearing. The risk is the one Arcadia has already demonstrated with the existing acceptance: conditions nobody tracks become assurance nobody has.",
      isRecommended: true,
      recommendationBasis:
        "Restriction has no executable form on this arrangement, and an unconditional approval is not supportable on the day's evidence. The four conditions are each derived from a specific finding made today or from an open reassessment question, so each has a named fact behind it rather than a general concern.",
      consequences: [
        {
          kind: "record-supplier-assessment",
          targetId: TP_NOVALINK,
          value: "Conditional approval, four conditions, review at cycle close",
          note: "Conditions: first, RD-RULE-0031 removed or re-scoped under change control and confirmed in the tenant for all three entities; second, recovery test evidence covering the Swiss RepairDesk instance; third, a change notification commitment that binds subprocessors for changes affecting availability of a critical service; fourth, an exit and substitutability test with a committed date. Each condition has a named owner and a date, and the approval lapses if any is unmet at cycle close.",
        },
        {
          kind: "set-supplier-criticality",
          targetId: TP_NOVALINK,
          value: "critical",
          note: "Tier 1 confirmed with the concentration flag retained.",
        },
        {
          kind: "activate-monitoring",
          targetId: TP_NOVALINK,
          value: "supplier",
          note: "Enhanced supplier monitoring, weekly, covering availability, fallback activation frequency, notification timeliness against the 30 minute commitment, and progress on each of the four conditions.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0785",
          value: "Novalink 2026 reassessment: conditional approval and its four conditions",
          note: "For decision. The committee is asked to note the conditions and to name the executive who owns the consequence if any condition is unmet at the 31.10.2026 cycle close.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Do not conclude: hold the reassessment open past its cycle date",
      labelDe: "Keine Schlussfolgerung: die Neubewertung ueber den Zyklustermin hinaus offen halten",
      description:
        "Decline to conclude the reassessment on 31.10.2026. Hold it open until the supplier's incident report arrives and the four resilience questions are answered, and report the overrun to the committee as the consequence of the evidence position.",
      riskImplication:
        "Refuses to convert an unfinished assessment into a recorded conclusion, which is the most defensible position on evidence and the worst on process discipline. An overdue Tier 1 reassessment is itself a reportable governance item and would sit alongside seven overdue remediation actions.",
      consequences: [
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "2026 reassessment cannot conclude on cycle: four resilience questions unresolved",
          note: "Four resilience questions remain unresolved and three of the day's five findings rest on supplier evidence that the supplier's own incident report may qualify. Concluding on 31.10.2026 would record a conclusion the evidence does not support.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0785",
          value: "Novalink reassessment will not conclude on cycle",
          note: "For noting. The cycle date of 31.10.2026 will not be met. The reason is the evidence position rather than assessor capacity, and the expected conclusion date follows the supplier incident report due 13.10.2026.",
        },
        {
          kind: "activate-monitoring",
          targetId: TP_NOVALINK,
          value: "supplier",
          note: "Weekly monitoring while the reassessment is held open.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Conditional approval on the rule change alone, with the rest carried as open items",
      labelDe: "Bedingte Genehmigung nur fuer die Regelaenderung, Rest als offene Punkte",
      description:
        "Grant conditional approval on one condition, the removal or re-scoping of the configuration rule, and carry the recovery evidence, the notification commitment and the exit test as open reassessment items into the 2027 cycle.",
      riskImplication:
        "Produces one condition that will actually be tracked rather than four that will not, and the one chosen is the one with a demonstrated consequence. It leaves the Swiss recovery gap and the untested exit unaddressed for another year, both of which were already open before today.",
      consequences: [
        {
          kind: "record-supplier-assessment",
          targetId: TP_NOVALINK,
          value: "Conditional approval, single condition on the configuration rule",
          note: "Single condition: RD-RULE-0031 removed or re-scoped under change control so that no override reason code waives secondary review, confirmed in the tenant for all three entities. The Swiss recovery evidence, the subprocessor change notification commitment and the exit test are carried as open items into the 2027 cycle.",
        },
        {
          kind: "activate-monitoring",
          targetId: TP_NOVALINK,
          value: "supplier",
          note: "Weekly monitoring of fallback activation frequency and of the tenant configuration state for all three entities.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Restrict the arrangement and start an exit readiness programme",
      labelDe: "Vereinbarung beschraenken und ein Ausstiegsbereitschaftsprogramm beginnen",
      description:
        "Restrict the arrangement to its current scope, decline any new service or entity accession, and commission an exit readiness programme with a funded internal payment repair capability as its first deliverable.",
      riskImplication:
        "The only option that addresses the structural position rather than its symptoms, and the only one with a material cost attached. Substitutability was assessed at 12 to 18 months with material programme cost and has never been tested, so the programme is long and the restriction bites on the business before the capability exists.",
      consequences: [
        {
          kind: "apply-supplier-restriction",
          targetId: TP_NOVALINK,
          value: "current-scope-only-exit-programme-commissioned",
          note: "No new service, entity accession or scope extension. An exit readiness programme is commissioned with a funded internal payment repair capability as its first deliverable, because the existing exit plan relies on a capability Arcadia does not hold.",
        },
        {
          kind: "create-action",
          targetId: TP_NOVALINK,
          value: "Commission an exit readiness programme for the payment repair service",
          note: "First deliverable is an assessment of what an internal payment repair capability would cost and take, because Appendix A6 assumes one exists. Second deliverable is an exit and substitutability test with a date.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0785",
          value: "Novalink concentration: restriction and an exit readiness programme",
          note: "For decision. The committee is asked to fund an exit readiness programme and to accept the commercial consequence of a scope restriction on a Tier 1 sole provider.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  /* ----------------------------------------------------------------------
     rcsa
     ---------------------------------------------------------------------- */

  ...options("DEC-2026-0771", [
    {
      label: "One causal investigation covering all three indicators",
      labelDe: "Eine Ursachenuntersuchung fuer alle drei Indikatoren",
      description:
        "Issue a single first line investigation request that asks four specific questions: the route substitution and cut-off component growth, the 17 overrides outside the known fallback windows, the cluster of 11 on 23.09.2026, and the interaction with reviewer capacity. One request, one owner, one due date.",
      riskImplication:
        "Produces one document that explains a cause rather than three that each explain a symptom, and puts the second line's causal framing on the record where the first line has to engage with it. It is a departure from the standard escalation route and the process owner may reasonably object to the framing.",
      isRecommended: true,
      recommendationBasis:
        "Two pressure components moved and three error components did not, and the three Red indicators share one mechanism. Three separate explanation requests would produce the same paragraph three times from the same owner, which is procedurally correct and analytically empty.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: KRI_OVERRIDE_RATE,
          value: "causal investigation of the September override growth",
          note: "Four questions. First, confirm that the five September fallback activation windows are complete and that the 17 route substitution overrides outside them have another cause. Second, explain the cut-off override growth from 94 to 211. Third, account for the 11 route substitution overrides on the afternoon of 23.09.2026 with no activation recorded. Fourth, state the effect of the reviewer establishment being 3.0 filled of 4.0 approved on override review throughput.",
        },
        {
          kind: "create-issue",
          targetId: KRI_OVERRIDE_RATE,
          value: "Override rate, repair rate and reviewer capacity breaches treated as one causal issue",
          note: "Three Red indicators with three owners are recorded as one issue with one investigation. The basis is that route unavailability drove route substitution overrides, cut-off pressure drove cut-off overrides, and reviewer capacity is at 3.0 filled of 4.0 approved, while the three error components are broadly flat.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Three separate first line explanations, as the escalation rule provides",
      labelDe: "Drei getrennte Erklaerungen der ersten Linie, wie in der Eskalationsregel vorgesehen",
      description:
        "Issue three explanation requests to the three indicator owners within the five business day rule, and hold the causal analysis as second line commentary for the committee paper rather than as the framing of the request.",
      riskImplication:
        "Procedurally exact and unarguable, and it preserves the first line's ownership of its own explanations. The committee then receives three explanations and a second line commentary that contradicts their separateness, which is a harder paper to write and an easier one to defend.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: KRI_OVERRIDE_RATE,
          value: "first line explanation of the override rate breach",
          note: "Written explanation of the September override rate reading against the Red threshold, required within five business days by 12.10.2026 under the indicator breach escalation rule.",
        },
        {
          kind: "create-issue",
          targetId: KRI_OVERRIDE_RATE,
          value: "Override rate breach, first red reading in 14 months",
          note: "Explanation requested from the indicator owner under the breach escalation rule. Second line causal analysis is recorded separately and does not form part of the request.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "One investigation, and additionally open the unlogged activation as a control issue",
      labelDe: "Eine Untersuchung, zusaetzlich die nicht protokollierte Aktivierung als Kontrollthema",
      description:
        "Issue the single causal investigation and, separately, open the 23.09.2026 activation as its own control issue, because a fallback route activated outside its runbook is a governance matter independent of the indicator.",
      riskImplication:
        "Opens a second front with the same first line team on the same day as a contested workshop. The unlogged activation is independently confirmed from the configuration audit log by the resilience lead, so the fact is not in dispute even though its cause is.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: KRI_OVERRIDE_RATE,
          value: "causal investigation of the September override growth",
          note: "Four questions covering component growth, the 17 outside-window overrides, the 23.09.2026 cluster and the reviewer capacity interaction.",
        },
        {
          kind: "create-issue",
          targetId: PRC_REPAIR,
          value: "Fallback route activation on 23.09.2026 does not appear in operations reporting",
          note: "The configuration audit log shows a fallbackRouteMode change on 23.09.2026 that the September payment operations report does not contain. Either the report is incomplete or the change was made without invoking the runbook. These have different implications and the log alone cannot distinguish them.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0744", [
    {
      label: "Evidence about detection, not about likelihood",
      labelDe: "Nachweis zur Erkennung, nicht zur Eintrittswahrscheinlichkeit",
      description:
        "Record the position that zero recorded losses over 24 months is a verified fact about the loss register and carries no weight on likelihood, because the detective control set could not detect an unauthorised release that produced no client complaint.",
      riskImplication:
        "Removes the first line's strongest argument for a residual of 9 and requires the residual to be derived from the control environment rating alone. It also commits the second line to defending an argument about the absence of evidence, which is the hardest kind of argument to win in a room.",
      consequences: [
        {
          kind: "set-residual-risk",
          targetId: RCSA_LINE_RSK_0211,
          value: "3,4",
          note: "Residual likelihood 3 and residual impact 4. The loss history is recorded as carrying no weight on likelihood, because the value reconciliation reconciles value rather than authorisation and the Duty Manager sampling is detective, next business day and drawn at one in ten.",
        },
        {
          kind: "create-issue",
          targetId: CTL_VALUE_RECON,
          value: "Detection capability on unauthorised payment release is unestablished",
          note: "Neither compensating control has been tested against a correctly valued payment released to an incorrect beneficiary. Until that test exists, the loss register cannot be read as evidence about the frequency of the risk event.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Evidence about likelihood, weighted down for detection limitations",
      labelDe: "Nachweis zur Eintrittswahrscheinlichkeit, abgeschwaecht wegen Erkennungsgrenzen",
      description:
        "Accept that 24 months without a loss carries some weight on likelihood, and weight it down explicitly because detection on this risk reconciles value rather than authorisation. Record the reasoning so the weighting is visible rather than implied.",
      riskImplication:
        "A defensible middle that neither side will love. It produces a residual likelihood of 3 rather than 2 without claiming that the loss history is meaningless, and it gives the first line something to hold, which makes an agreed rating more reachable.",
      consequences: [
        {
          kind: "set-residual-risk",
          targetId: RCSA_LINE_RSK_0211,
          value: "3,3",
          note: "Residual likelihood 3 and residual impact 3. The 24 month nil loss history is weighted down rather than disregarded, on the basis that the detective control set reconciles value rather than authorisation and samples at one in ten next business day.",
        },
        {
          kind: "request-factual-validation",
          targetId: CTL_VALUE_RECON,
          value: "reconciliation scope",
          note: "Confirm whether the daily payment value reconciliation compares beneficiary identifiers as well as payment value, because the control description does not say and the answer decides whether a wrong beneficiary release would be detected.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Resolve it by test rather than by argument: commission a detection test",
      labelDe: "Durch Test statt durch Argument klaeren: einen Erkennungstest beauftragen",
      description:
        "Decline to settle the inference in the workshop and commission a targeted test of whether the compensating controls would detect a correctly valued payment released to an incorrect beneficiary. Record the residual provisionally until the test reports.",
      riskImplication:
        "Converts a contested inference into a testable question, which is the strongest long term answer and the weakest short term one. The assessment cannot be signed on a provisional residual, and the sign-off date is 16.10.2026.",
      consequences: [
        {
          kind: "create-action",
          targetId: CTL_VALUE_RECON,
          value: "Test whether the compensating controls detect a wrong beneficiary release at correct value",
          note: "Targeted test of the daily value reconciliation and the next business day override sampling against a simulated correctly valued payment to an incorrect beneficiary. The result determines whether the loss register can be read as evidence about likelihood on this risk.",
        },
        {
          kind: "request-evidence",
          targetId: CTL_VALUE_RECON,
          value: "Control description and reconciliation specification for the daily payment value reconciliation, showing which fields are compared",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0745", [
    {
      label: "Place the contested risk third",
      labelDe: "Das umstrittene Risiko an dritter Stelle behandeln",
      description:
        "Open with two uncontested risks to establish that the assessment is being run rather than litigated, take the contested rating third with roughly 50 minutes available, and close with the remaining eight.",
      riskImplication:
        "Protects the other ten assessments from being crowded out and reaches the contested item with momentum. It leaves less time on the contested item than opening with it would, and if an early item overruns the contested rating gets 35 minutes.",
      isRecommended: true,
      recommendationBasis:
        "A workshop that spends 90 minutes on one rating and nods through ten others has produced a worse assessment. Third position is the only sequence that gives the contested item a usable block of time without spending the room's attention before any shared ground exists.",
      consequences: [
        {
          kind: "send-collaboration-message",
          targetId: RCSA_PAYOPS_Q4,
          value: "Q4 workshop sequence and pre read confirmation",
          note: "The workshop takes the eleven risks in a fixed order with the payment release risk third. The control test population, sample size, exception count and both deviation rates are loaded as established facts so the session does not re-establish them. The control owner's recorded position of 29.09.2026 is attached.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Open with the contested risk",
      labelDe: "Mit dem umstrittenen Risiko beginnen",
      description:
        "Take the contested rating first, while attention is highest and before anyone is tired, and accept that the other ten risks are assessed in the remaining time.",
      riskImplication:
        "Gives the contested item the best attention in the room and the full 90 minutes if it needs them. The predictable cost is that ten other risk assessments are compressed into the final stretch, which produces a worse overall assessment even if the contested rating is better argued.",
      consequences: [
        {
          kind: "send-collaboration-message",
          targetId: RCSA_PAYOPS_Q4,
          value: "Q4 workshop opens on the payment release risk",
          note: "The workshop opens on the contested payment release risk with both residual positions and the control test results loaded as established facts. The remaining ten risks follow.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Close with the contested risk and hold a separate session if it does not resolve",
      labelDe: "Mit dem umstrittenen Risiko abschliessen und bei Nichtklaerung eine eigene Sitzung ansetzen",
      description:
        "Assess the ten uncontested risks first and properly, take the contested rating last, and if it does not resolve, schedule a separate session for it rather than forcing a position at 12:00.",
      riskImplication:
        "Guarantees that ten assessments are done properly and risks the contested one being taken by a tired room against a hard stop. A separate session is the cleanest route to a considered rating and it pushes the assessment past its 16.10.2026 sign-off if it slips.",
      consequences: [
        {
          kind: "send-collaboration-message",
          targetId: RCSA_PAYOPS_Q4,
          value: "Q4 workshop sequence with a reserved follow up session",
          note: "The contested payment release risk is taken last. A follow up session is held in reserve for 08.10.2026 in case the rating does not resolve, so that no position is forced against the close of the workshop.",
        },
      ],
      requiresApproval: false,
    },
  ]),

  /*
   * The hero decision of the product.
   *
   * No option is recommended. The bible is explicit that the gap between
   * Medium and Medium-High is the difference between monitoring and an
   * executive either committing to dates or signing a Risikoakzeptanz, and
   * that this is why the workshop cannot be automated. A recommendation here
   * would be the system proposing the outcome of a negotiation before the
   * negotiation has happened.
   *
   * Option three carries the showcase consequence chain: the assessment is
   * versioned, the control rating is updated, an off cycle reassessment is
   * created, a remediation action is raised, a committee agenda item is
   * added, the first line is notified, and control surveillance is switched
   * on. Seven mutations, seven approvals, one receipt.
   */
  ...options("DEC-2026-0772", [
    {
      label: "Carry the first line position: control environment Effective, residual 9, within appetite",
      labelDe: "Position der ersten Linie uebernehmen: Kontrollumfeld wirksam, Restrisiko 9, innerhalb der Toleranz",
      description:
        "Accept the assessment owner's position. Four exceptions in a sample of 60 produced no financial loss, all four payments were confirmed correct by the clients, two compensating controls operate, and the reviewer vacancy is in recruitment. The consequence is monitoring.",
      riskImplication:
        "Places the risk within appetite and requires monitoring only. If the control environment is in fact weaker than Effective, the bank has recorded a within appetite position on a payment execution risk whose only preventive control has a design deficiency, and the record will be read that way later.",
      consequences: [
        {
          kind: "version-assessment",
          targetId: RCSA_PAYOPS_Q4,
          value: "medium",
          note: "Control environment rated Effective and residual score 9 of 25, within appetite. Basis: no financial loss over 24 months, all four exception payments subsequently confirmed correct by clients, two compensating controls operating, and recruitment approved for the vacant reviewer position. Consequence is monitoring.",
        },
        {
          /*
           * The first line label is "Fully Effective / Voll wirksam" and the
           * second line label for the same band is "Effective / Wirksam".
           * This option carries the first line position forward, so the value
           * recorded is the first line band, `fully-effective`. Writing the
           * second line word "effective" here would be outside the
           * CONTROL_EFFECTIVENESS vocabulary and the risk calculator would
           * index its reduction tables on a value that is not there.
           */
          kind: "set-control-effectiveness",
          targetId: CTL_FOUR_EYES,
          value: "fully-effective",
        },
        {
          kind: "activate-monitoring",
          targetId: KRI_OVERRIDE_RATE,
          value: "kri",
          note: "Monthly monitoring of the override rate indicator with the component decomposition attached, as the consequence of a within appetite residual position.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Record a formal second line dissent and escalate both positions to the committee",
      labelDe: "Formalen Dissens der zweiten Linie erfassen und beide Positionen an das Gremium eskalieren",
      description:
        "Leave the rating unagreed, record a formal dissent under the RCSA procedure with both positions stated in their owners' terms and no adjudication, and escalate to the Group NFR Committee. The assessment stays unsigned past 16.10.2026 unless it resolves.",
      riskImplication:
        "Neither position is imposed and the committee receives a real decision rather than a diluted number. The assessment misses its sign-off date, the relationship with the process owner and the control owner carries the cost, and the second line is committed to defending its position in front of the chair.",
      consequences: [
        {
          kind: "version-assessment",
          targetId: RCSA_PAYOPS_Q4,
          value: "unagreed",
          note: "Residual rating for the payment release risk recorded as unagreed with two attributed positions. First line: control environment Effective, residual 9, within appetite. Second line: control environment Partially Effective, residual 12, outside appetite. Formal second line dissent recorded under the RCSA procedure dissent clause. No adjudication.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0772",
          value: "Unresolved first and second line divergence on a key control and its residual rating",
          note: "For decision. Both positions are stated in their owners' words and neither is editorialised. The committee is asked to determine the control environment rating, because the appetite consequence differs on either side of a residual score of 10.",
        },
        {
          kind: "send-collaboration-message",
          targetId: RCSA_PAYOPS_Q4,
          value: "Second line dissent recorded on the payment release residual rating",
          note: "The residual rating for the payment release risk is recorded as unagreed. A formal second line dissent has been entered with both positions stated as their owners stated them, and the matter is escalated to the Group NFR Committee on 13.10.2026. The remaining ten risks in the assessment are agreed.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Partially Effective, residual Medium-High, and an off cycle reassessment",
      labelDe: "Teilweise wirksam, Restrisiko mittel bis hoch, und eine ausserplanmaessige Neubewertung",
      description:
        "Record the control environment as Partially Effective and the residual as 12 of 25, outside appetite, on the basis that the only preventive control has a design and an operating deficiency and that two of six flagged test items cannot be concluded. Commission an off cycle reassessment of the repair process, raise a remediation action, put it to the committee, tell the first line, and switch on control surveillance.",
      riskImplication:
        "Places the risk outside appetite, which obliges the accountable executive either to commit to dated remediation or to sign a Risikoakzeptanz. It is the position the control test supports and it imposes a second line conclusion on an assessment the first line owns, which will be contested at the committee.",
      consequences: [
        {
          kind: "version-assessment",
          targetId: RCSA_PAYOPS_Q4,
          value: "medium-high",
          note: "Control environment rated Partially Effective and residual score 12 of 25, outside appetite. Basis: the independent secondary review control is the only preventive control mapped to this risk and carries a design and an operating deficiency; the Duty Manager sampling is detective, next business day and drawn at one in ten, so it cannot prevent a release; the daily value reconciliation reconciles value rather than authorisation; two of six flagged test items cannot be concluded, so the deviation rate is unknown rather than 4 in 60; and the vacant reviewer position has no start date.",
        },
        {
          kind: "set-control-effectiveness",
          targetId: CTL_FOUR_EYES,
          value: "partially-effective",
        },
        {
          kind: "create-reassessment",
          targetId: PRC_REPAIR,
          note: "Off cycle reassessment of payment repair and manual override, scoped to the control environment for the payment release risk. Scope includes the conditional enforcement behaviour of the review requirement, the reviewer establishment position, and the sufficiency of the two compensating controls against an unauthorised release at correct value.",
        },
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Remediate the independent secondary review control to preventive effectiveness",
          note: "Dated remediation plan required because the residual position is outside appetite. Scope: enforce role segregation so an override creator cannot be the secondary reviewer, block release before review is recorded, make the evidence reference mandatory, and establish what the review requirement does under every system state.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0772",
          value: "Payment release residual risk outside appetite following a Partially Effective control rating",
          note: "For decision. The residual score of 12 on a payment execution risk is outside appetite and requires either an approved remediation plan with committed dates or a documented Risikoakzeptanz approved by the entity Chief Operating Officer and noted by this committee. The second line position and the first line position are both stated.",
        },
        {
          kind: "send-collaboration-message",
          targetId: RCSA_PAYOPS_Q4,
          value: "Payment release residual rating recorded outside appetite",
          note: "The control environment for the payment release risk is recorded as Partially Effective and the residual score as 12 of 25, outside appetite. An off cycle reassessment of the repair process has been commissioned and a remediation action raised. The appetite consequence is that the accountable executive must either approve a remediation plan with committed dates or sign a Risikoakzeptanz. The first line position is recorded alongside the second line conclusion.",
        },
        {
          kind: "activate-monitoring",
          targetId: CTL_FOUR_EYES,
          value: "control",
          note: "Control surveillance on the independent secondary review control: weekly review of every manual override released without a recorded secondary review, across all three entities, until the remediation plan is accepted.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Defer the rating until the tenant configuration arrives",
      labelDe: "Bewertung zurueckstellen, bis die Mandantenkonfiguration vorliegt",
      description:
        "Take no rating today. The supplier configuration that would settle the disputed element has been formally demanded and is overdue against a four hour service level. Request it again at incident priority and reconvene when it arrives.",
      riskImplication:
        "Avoids an agreement about nothing and avoids imposing a conclusion on incomplete evidence. It also means the assessment cannot be signed by 16.10.2026, and the committee paper due 08.10.2026 has to be written on an open rating with no expected resolution date.",
      consequences: [
        {
          kind: "request-evidence",
          targetId: CTL_FOUR_EYES,
          value: "RepairDesk tenant configuration export showing every rule that affects the secondary review requirement, with its origin, its conditions and its firing history",
        },
        {
          kind: "request-factual-validation",
          targetId: CTL_FOUR_EYES,
          value: "review record write behaviour",
          note: "Confirm whether RepairDesk writes the secondary reviewer identity synchronously at review submission or asynchronously at the end of a batch cycle, because the two accounts on the record contradict each other and the control environment rating depends on which is correct.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0782", [
    {
      label: "Revise the reasoning, hold the score, retain the prior reasoning in full",
      labelDe: "Begruendung ueberarbeiten, Bewertung halten, frueheres Begruendungsbild vollstaendig erhalten",
      description:
        "Rewrite the basis of the recorded position to name the configured waiver as the mechanism, keep the residual at 12, and retain the earlier reasoning as superseded rather than deleting it. State plainly that the conclusion was right and the argument was not.",
      riskImplication:
        "Exposes a second line reasoning error to the committee in writing, in exchange for a position that cannot be dismantled under challenge. The score is unchanged, so nothing in the appetite consequence moves.",
      isRecommended: true,
      recommendationBasis:
        "The configuration export establishes a mechanism that no capacity argument can explain, and the committee paper is written on this reasoning. A visible correction made before the paper closes is cheaper than a discovered one made in the meeting.",
      consequences: [
        {
          kind: "version-assessment",
          targetId: RCSA_PAYOPS_Q4,
          value: "medium-high",
          note: "Residual score unchanged at 12 of 25. Basis revised: the control weakness is a configured waiver of the secondary review requirement for route substitution overrides below EUR 250,000 while the fallback route is active, present since 11.11.2024 and fired 118 times. The earlier basis, reviewer capacity and human deviation discipline, is retained as superseded reasoning rather than removed.",
        },
        {
          kind: "send-collaboration-message",
          targetId: RCSA_PAYOPS_Q4,
          value: "Residual reasoning revised, score unchanged",
          note: "The second line residual reasoning for the payment release risk has been revised. The score remains 12 of 25. The mechanism is a configured waiver rather than reviewer capacity, which means the first line's position on its team's conduct was correct and the second line's stated basis was not. The prior reasoning is retained in the record.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Revise the reasoning and raise the residual impact on the confirmed error",
      labelDe: "Begruendung ueberarbeiten und Auswirkung wegen des bestaetigten Fehlers erhoehen",
      description:
        "Revise the basis and additionally move the residual upward, because the risk has now materialised once with a confirmed misrouted payment and a recall in progress rather than remaining an assessed possibility.",
      riskImplication:
        "Records a materialised risk rather than an assessed one, which is defensible and would be the first upward move on this risk in three quarters. One confirmed error in a sample of 20 drawn from 96 is a thin basis for an impact change, and the full examination does not report until 07.10.2026 at 12:00.",
      consequences: [
        {
          kind: "set-residual-risk",
          targetId: RCSA_LINE_RSK_0211,
          value: "4,4",
          note: "Residual likelihood 4 and residual impact 4 on the basis that the risk has materialised: one confirmed erroneous release of EUR 38,400 to an incorrect intermediary institution, recall initiated. The mechanism is a configured waiver present since 11.11.2024, which means the likelihood was always higher than assessed and had simply not been observed.",
        },
        {
          kind: "version-assessment",
          targetId: RCSA_PAYOPS_Q4,
          value: "high",
          note: "Residual moved upward on a materialised risk with a confirmed erroneous release. Basis revised to name the configured waiver as the mechanism. The full examination of all 96 releases reports 07.10.2026 at 12:00 and may change the impact assessment again.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Hold the record as it stands and disclose the mechanism as new evidence in the paper",
      labelDe: "Eintrag unveraendert lassen und den Mechanismus als neue Erkenntnis im Papier offenlegen",
      description:
        "Leave the recorded reasoning unchanged, because it was an accurate statement of the basis available at the time it was made, and present the configured waiver in the committee paper as evidence that arrived afterwards.",
      riskImplication:
        "Keeps the record chronologically honest: a position recorded at 11:45 on 11:45 evidence. It also means the committee paper argues from a basis the record does not contain, and the chair will ask why the record was not updated.",
      consequences: [
        {
          kind: "create-issue",
          targetId: RSK_UNAUTH_RELEASE,
          value: "Mechanism of the payment release control weakness identified after the assessment position was recorded",
          note: "The configured waiver was established at 15:38 on 06.10.2026, after the second line position was recorded. The position is unchanged and the mechanism is disclosed as subsequent evidence in the committee paper rather than by revising the assessment record.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  /* ----------------------------------------------------------------------
     control-assurance
     ---------------------------------------------------------------------- */

  ...options("DEC-2026-0746", [
    {
      label: "Systemic and known: classify it as an access design failure with a live remediation",
      labelDe: "Systemisch und bekannt: als Versagen der Berechtigungsgestaltung mit laufender Massnahme einordnen",
      description:
        "Classify the self review exception as systemic, on the basis that the enabling condition is a known access design defect with an open remediation action that is 67 days past its revised due date, and that the exception occurred 17 days before that date.",
      riskImplication:
        "A systemic classification carries a reporting obligation to the accountable executive and makes the overdue remediation action part of the control finding rather than a separate governance item. It also means the control cannot be relied upon for the period, which affects anyone using the control rating.",
      isRecommended: true,
      recommendationBasis:
        "The enabling condition is documented in an audit finding from 28.11.2025, the remediation was raised specifically to remove it, and the remediation is still open. An isolated classification would require treating a known unremediated defect as an individual lapse.",
      consequences: [
        {
          kind: "classify-test-exception",
          targetId: EXC_SELF_REVIEW,
          value: "access-design-failure",
          note: "systemic",
        },
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "Self review permitted by unremediated access design, with a remediation action 67 days overdue",
          note: "The override creator was recorded as the secondary reviewer because the analyst held both role assignments in RepairDesk and the system permitted self review. This is the failure that MSN-2026-0147 was raised in November 2025 to prevent. The exception occurred on 14.07.2026, 17 days before that action's revised due date of 31.07.2026, and the action remains open.",
        },
        {
          kind: "request-factual-validation",
          targetId: CTL_FOUR_EYES,
          value: "dual role assignment population",
          note: "Provide a count of analysts currently holding both the Repair Analyst and the Secondary Reviewer role assignments in RepairDesk, per entity, so the population exposed to self review can be stated rather than inferred from one sample item.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Isolated: one occurrence, no evidence of a pattern in the population",
      labelDe: "Einzelfall: ein Vorkommnis, kein Nachweis eines Musters in der Grundgesamtheit",
      description:
        "Classify it as an isolated deviation. One occurrence in a sample of 60 supports no estimate of frequency across 1,204 overrides, the reviewer was a qualified secondary reviewer, and the payment was subsequently confirmed correct by the client.",
      riskImplication:
        "Keeps the finding proportionate to the evidence actually obtained and avoids asserting a population characteristic from a single observation. If the dual role assignment is in fact widespread, an isolated classification understates a key control failure and the next test will find it again.",
      consequences: [
        {
          kind: "classify-test-exception",
          targetId: EXC_SELF_REVIEW,
          value: "independence-failure",
          note: "isolated",
        },
        {
          kind: "request-factual-validation",
          targetId: CTL_FOUR_EYES,
          value: "dual role assignment population",
          note: "Provide a count of analysts holding both role assignments in RepairDesk, per entity, so that the isolated classification can be confirmed or withdrawn at the next test.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Indeterminate pending the role assignment query, with the classification held open",
      labelDe: "Unbestimmt bis zur Abfrage der Rollenzuweisungen, Einordnung offen gehalten",
      description:
        "Hold the classification open, run the role assignment query that would settle it, and state in the working papers that the scope of the deviation is undetermined rather than choosing between systemic and isolated on one observation.",
      riskImplication:
        "The most evidentially honest position and the least useful to anyone reading the conclusion today. It leaves the second line unable to settle a control environment rating that depends on it, and the workshop is at 10:30.",
      consequences: [
        {
          kind: "classify-test-exception",
          targetId: EXC_SELF_REVIEW,
          value: "independence-failure",
          note: "indeterminate",
        },
        {
          kind: "request-evidence",
          targetId: CTL_FOUR_EYES,
          value: "RepairDesk role assignment extract per entity showing every user holding both the Repair Analyst and the Secondary Reviewer assignment",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0747", [
    {
      label: "Demand it now, under Appendix A4 clause 2.1, before the challenge meeting",
      labelDe: "Jetzt anfordern, gemaess Anlage A4 Ziffer 2.1, vor dem Klaerungsgespraech",
      description:
        "Issue the configuration request immediately, citing the contractual right and the four hour service level, so that the challenge meeting starts from a shared waiting position and the conclusion can be written around a named piece of missing evidence.",
      riskImplication:
        "Names the missing evidence, names the route to obtain it and starts a clock the supplier has to answer. It tells the supplier which defect Arcadia has found before Arcadia has decided what to do about it, and the request cannot be unasked.",
      isRecommended: true,
      recommendationBasis:
        "The rule trace already shows that a configured rule set the review requirement to false. The configuration is the only evidence that establishes what that rule is, it is obtainable under an existing right with a four hour service level, and every hour of delay is an hour the conclusion has to stay undetermined.",
      consequences: [
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "RepairDesk tenant configuration export for arcadia-prod, including every rule affecting the secondary review requirement, with rule conditions, origin, client configurability and firing history since introduction",
        },
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "Control description asserts no exceptions while the rule trace shows a configured waiver",
          note: "The control description states that independent secondary review applies to all manual overrides without exception and has not been updated since 14.01.2025. The rule evaluation trace on the August exception records a review waiver code. The description and the implemented behaviour contradict each other, which is a design testing finding independent of what the configuration turns out to contain.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Ask the control owner first, then decide whether to go to the supplier",
      labelDe: "Zuerst die Kontrollverantwortliche fragen, dann ueber den Lieferanten entscheiden",
      description:
        "Put the waiver code to the control owner at the challenge meeting and ask whether she knows what configures it. She runs the process daily and may know, and an internal answer costs nothing and provokes nothing.",
      riskImplication:
        "Preserves the relationship and keeps the matter internal while it is still uncertain. The control owner is the person with the most operational knowledge of the process and the least knowledge of the system's internal behaviour, so an internal answer is as likely to be wrong as right, and a day is lost either way.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: CTL_FOUR_EYES,
          value: "review waiver code",
          note: "The rule evaluation trace on the August exception records a review waiver code and a business continuity throughput audit note. Confirm whether any configured rule in RepairDesk can set the secondary review requirement to false, under what conditions, and who requested it.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Escalate straight to a formal demand through third-party risk",
      labelDe: "Direkt ueber das Drittparteienrisiko formell anfordern",
      description:
        "Route the request through the third-party risk owner as a formal demand under the contractual right, with the service level cited from the outset, rather than as a working level request that can be absorbed into a support queue.",
      riskImplication:
        "A formal demand is harder to deflect and is logged as a contractual exercise, which matters if the supplier does not answer. It also spends escalation currency before the incident bridge exists to explain why it matters, and a formal demand issued on a control test may be read as disproportionate.",
      consequences: [
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "Formal demand under Appendix A4 clause 2.1 for the arcadia-prod tenant configuration export covering all secondary review enforcement rules, citing the four hour service level",
        },
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "Configuration transparency: Arcadia cannot evidence what its own control gate does",
          note: "A key control in the Internal Control System depends on a supplier system rule whose conditions Arcadia cannot state. The contractual right to obtain the configuration exists under Appendix A4 clause 2.1 and had never been exercised before today.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0748", [
    {
      label: "Escalate as an audit trail defect and report the period limitation alongside it",
      labelDe: "Als Mangel des Pruefpfads eskalieren und die Einschraenkung fuer den Zeitraum mitberichten",
      description:
        "Raise the unresolvable item as a finding about the system rather than about the period: a key control in the Internal Control System whose reviewer identity can be a supplier service account, with the resolving log on a 30 day retention. Report the period limitation in the conclusion as well.",
      riskImplication:
        "Records that the audit trail on a key control can evaporate on a supplier retention schedule, which is a design finding affecting every future test of this control. It also states that Arcadia cannot evidence whether the control operated on a payment of EUR 233,800, which is an uncomfortable sentence to put in a report.",
      isRecommended: true,
      recommendationBasis:
        "The evidence is permanently gone and the mechanism is a bulk approval screen used routinely rather than exceptionally. That combination makes it a finding about the system's capability to be audited, which outlives this test period and cannot be fixed by the control owner.",
      consequences: [
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "Audit trail defect: reviewer identity recorded as a supplier service account with the resolving log expired",
          note: "For one sample item the secondary reviewer identity is a Novalink service account used by the bulk approval screen. The underlying human identity was held in a supplier application log with 30 day retention, which expired before the question was asked. The item is unresolvable and the defect affects a screen used routinely. Arcadia cannot determine whether the control operated.",
        },
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "Supplier service account identity and log retention defeat the audit trail on a key control",
          note: "Two supplier side design choices combine to make a key control in the Internal Control System unauditable through the bulk approval path: a service account identity written in place of a human identity, and a 30 day retention on the log that resolves it. The control owner cannot fix either.",
        },
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "Confirmation of whether the bulk approval screen can be configured to record the submitting human identity, and the current retention period on the application log that resolves service account activity",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Report it as a scope limitation on the conclusion",
      labelDe: "Als Einschraenkung des Pruefungsumfangs in der Aussage berichten",
      description:
        "Record the item in the conclusion's limitation section: two of sixty sample items could not be concluded, so the deviation rate is between 4 in 60 and 6 in 60 and the true figure is unknown. Do not raise a separate finding.",
      riskImplication:
        "Proportionate to what the test can actually say and keeps the report about the period tested. It leaves a permanent audit trail defect recorded only as a limitation in one report, where the next tester will meet it again with no finding history to build on.",
      consequences: [
        {
          kind: "record-test-conclusion",
          targetId: TST_FOUR_EYES,
          value: "Partially Effective, with a stated limitation that two of sixty sample items could not be concluded and the deviation rate therefore lies between 4 in 60 and 6 in 60",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Extend the sample to establish how often the bulk approval path is used",
      labelDe: "Stichprobe erweitern, um die Nutzungshaeufigkeit des Sammelfreigabewegs zu ermitteln",
      description:
        "Draw an additional sample restricted to overrides approved through the bulk approval screen, to establish how much of the population carries the same unresolvable identity, and report the proportion rather than the single item.",
      riskImplication:
        "Converts one anecdote into a measured exposure, which is the strongest evidential position available. Every item in that sample will carry the same service account identity, so the extension measures the size of the blind spot rather than resolving any part of it, and it costs testing capacity in a quarter with fourteen other controls.",
      consequences: [
        {
          kind: "request-evidence",
          targetId: CTL_FOUR_EYES,
          value: "Override population extract for the test period showing, per item, whether the secondary review was submitted through the bulk approval screen and whether the recorded reviewer identity is a service account",
        },
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Extend the control test with a sample restricted to bulk approval submissions",
          note: "Measures the proportion of the population whose reviewer identity is a supplier service account, so that the audit trail exposure can be stated as a figure rather than as a single unresolvable item.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0760", [
    {
      label: "Partially Effective, the fourth exception undetermined, two stated limitations",
      labelDe: "Teilweise wirksam, vierte Feststellung unbestimmt, zwei benannte Einschraenkungen",
      description:
        "Issue the conclusion on the three operating deviations alone, mark the fourth exception undetermined pending the configuration, and extend the limitation section to cover both the undetermined classification and the time bounding of the population.",
      riskImplication:
        "A weaker sounding conclusion than either alternative and the only one that the demanded evidence cannot falsify. It gives the second line a control rating it can work with today and it tells any reader precisely what the test does not cover.",
      isRecommended: true,
      recommendationBasis:
        "Two of the three available conclusions require a determination that cannot currently be evidenced. Only this one survives the configuration arriving and contradicting the tester, and the three deviations that carry it are independent of any configuration.",
      consequences: [
        {
          kind: "record-test-conclusion",
          targetId: TST_FOUR_EYES,
          value: "Partially Effective. Design and operating deficiency. The fourth exception is undetermined pending the supplier tenant configuration. Two limitations are stated: the undetermined classification, and a population bounded by time where the suspected enforcement condition is bounded by system state",
        },
        {
          kind: "classify-test-exception",
          targetId: EXC_RULE_WAIVER,
          value: "configuration-driven-omission",
          note: "indeterminate",
        },
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "Tested population bounded by time where the control's enforcement is bounded by system state",
          note: "The test period ran 01.06.2026 to 31.08.2026. The suspected enforcement condition depends on the fallback route being active, which is a system state rather than a date range. A population bounded by condition would cover every activation since the rule was introduced, and the current population could not detect the pattern.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Partially Effective with the fourth exception classified as a design deficiency",
      labelDe: "Teilweise wirksam mit der vierten Feststellung als Konzeptionsmangel",
      description:
        "Issue the conclusion and classify the fourth exception as a design deficiency now, on the basis that a rule trace recording a review waiver is sufficient evidence that the control was switched off by configuration rather than by a person.",
      riskImplication:
        "The strongest and most useful conclusion for the second line and the committee, and the first line is likely to accept it because it moves accountability away from the team. It rests on an inference from a trace field, and if the configuration shows something else, a design deficiency has been asserted without a basis.",
      consequences: [
        {
          kind: "record-test-conclusion",
          targetId: TST_FOUR_EYES,
          value: "Partially Effective. Design deficiency on the configured review waiver and operating deficiency on three human deviations",
        },
        {
          kind: "classify-test-exception",
          targetId: EXC_RULE_WAIVER,
          value: "design-deficiency",
          note: "systemic",
        },
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "A configured rule removes the secondary review requirement on a class of overrides",
          note: "The rule evaluation trace records a review waiver code and a business continuity throughput audit note against an override with no secondary review record. The control description states that review applies to all overrides without exception. The conclusion is that the control is defeated by design under an identifiable system condition.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Hold the conclusion until the configuration arrives",
      labelDe: "Aussage zurueckhalten, bis die Konfiguration vorliegt",
      description:
        "Do not issue. The configuration has been demanded under a contractual right with a four hour service level and is overdue. Escalate the service level breach and issue the conclusion once the evidence is in.",
      riskImplication:
        "Avoids issuing anything that later needs correcting. It also gives the supplier control over Arcadia's assurance timetable, leaves the second line unable to settle a control environment rating before its sign-off date, and leaves a key control with no current conclusion at all.",
      consequences: [
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "Escalated demand for the arcadia-prod tenant configuration export, citing the breach of the four hour service level under Appendix A4 clause 2.1",
        },
        {
          kind: "send-collaboration-message",
          targetId: TST_FOUR_EYES,
          value: "Control test conclusion held pending supplier configuration evidence",
          note: "The conclusion on the independent secondary review control is held pending a tenant configuration export demanded under Appendix A4 clause 2.1. The demand is past its four hour service level and has been escalated. The three operating deviations are not affected by the pending evidence.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0764", [
    {
      label: "Record the prediction with its basis and its falsification condition",
      labelDe: "Vorhersage mit Grundlage und Widerlegungsbedingung erfassen",
      description:
        "Write the prediction into the working papers at 14:16: if the inferred rule exists, the 96 unreviewed overrides are its consequence. State the three observed conditions and state what evidence would show the inference to be wrong.",
      riskImplication:
        "Creates a timestamped record that the method identified the mechanism before the evidence arrived, which is the strongest possible demonstration of test quality. It also creates a timestamped record of being wrong if the configuration differs, in a working paper a third line will read.",
      isRecommended: true,
      recommendationBasis:
        "The reconciliation is exact and the conditions match: 138 overrides, of which 96 with no review requirement, all route substitution, all below EUR 250,000, all raised while the fallback route was active. A prediction recorded before its confirmation is evidence about the method; a conclusion recorded after is not.",
      consequences: [
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "Prediction recorded at 14:16: the inferred configuration rule accounts for the 96 unreviewed overrides",
          note: "Basis. 138 route substitution overrides were created between 14:12:41 and 14:26:00; 96 carry no secondary review requirement and no reviewer identity, 29 were reviewed and released, and 13 remain awaiting review. All 96 are below EUR 250,000. These three conditions match the rule trace on the August exception. Falsification condition: if the tenant configuration shows no value threshold, or shows no dependency on fallback mode, the inference is wrong and this record stands as the evidence of that.",
        },
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "Re-issue of the tenant configuration demand at incident priority under Appendix A4 clause 2.1, citing the live incident and the 96 affected releases",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Hold the inference in the working notes and record nothing until the evidence lands",
      labelDe: "Schlussfolgerung in den Arbeitsnotizen halten und bis zum Nachweis nichts erfassen",
      description:
        "Keep the analysis out of the record until the configuration confirms or refutes it. Prepare the full examination scope so that it can be issued the moment the position is established, and say nothing on the bridge that implies a conclusion.",
      riskImplication:
        "Avoids a recorded inference that may be wrong while an incident is live and while a control owner is on a bridge disputing the mechanism. It also means that when the configuration arrives, the assurance function's contribution looks retrospective rather than anticipatory, and the timestamp evidence does not exist.",
      consequences: [
        {
          kind: "request-evidence",
          targetId: TP_NOVALINK,
          value: "Re-issue of the tenant configuration demand at incident priority under Appendix A4 clause 2.1",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Record the reconciliation as fact and keep the mechanism out of it",
      labelDe: "Abstimmung als Tatsache erfassen, den Mechanismus aussen vor lassen",
      description:
        "Record only what is measured: the override counts, their values, their entity split and their reconciliation, with no statement about why the review requirement was absent. The mechanism claim is disputed between two named people and is not the tester's to settle on telemetry.",
      riskImplication:
        "Puts defensible numbers on the record before anyone asks for them, which is the part of the work that will matter at the committee. It leaves the causal question open in a record that a reader will expect to answer it, and the reconciliation alone does not distinguish between a configured waiver and a logging delay.",
      consequences: [
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "Reconciled override counts for the fallback window of 06.10.2026",
          note: "138 route substitution overrides created between 14:12:41 and 14:26:00. 96 carry no secondary review requirement and no reviewer identity, combined value EUR 9,420,880, split 78 for ARC-DE at EUR 7,611,240 and 18 for ARC-AT at EUR 1,809,640. 29 were reviewed and released and 13 remain awaiting review. All 96 are individually below EUR 250,000. No statement is made about the cause of the absent review requirement, which is disputed.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0778", [
    {
      label: "Examine all 96, reporting by 07.10.2026 at 12:00",
      labelDe: "Alle 96 pruefen, Bericht bis 07.10.2026 12:00",
      description:
        "Require a full check of all 96 releases against the client static data master and the original instructions, owned by the control owner and assured by the assurance owner, reporting before the committee papers close.",
      riskImplication:
        "Every affected client payment is checked while recalls are still possible, and the committee paper carries a complete number rather than an extrapolation. It is a real capacity demand on a team whose reviewer establishment is the subject of a Red indicator, and once committed to the committee it cannot be quietly reduced.",
      isRecommended: true,
      recommendationBasis:
        "The bank's question is about specific payments rather than about a rate, and the recall window closes. A sample of 20 of 96, unstratified, with its single error on the most error prone repair type, cannot support a statement about the other 76.",
      consequences: [
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Check all 96 overrides released without secondary review against authoritative source data and report confirmed errors",
          note: "Full examination rather than a sample. Each release is checked against the client static data master and the original client instruction. Confirmed errors are reported with a recall assessment per item. Owner is the control owner, assured by the assurance owner, reporting 07.10.2026 at 12:00 so the result exists before the committee papers close.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0778",
          value: "Full examination of 96 payment releases made without secondary review",
          note: "For noting, with the result attached. 96 releases with a combined value of EUR 9,420,880 were made with an unsatisfied mandatory control gate, against an impact tolerance whose threshold is zero. One erroneous release is already confirmed and recalled.",
        },
        {
          kind: "send-collaboration-message",
          targetId: CTL_FOUR_EYES,
          value: "All 96 releases to be checked by 07.10.2026 at 12:00",
          note: "A full examination of the 96 overrides released without secondary review is required, not a sample. Each item is checked against the client static data master and the original instruction. The deadline is 07.10.2026 at 12:00 because the committee papers close on 08.10.2026 and a partial answer cannot be reported as a complete one.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Stratified sample of 40, with a full check only on the high risk repair types",
      labelDe: "Geschichtete Stichprobe von 40, Vollpruefung nur bei risikoreichen Reparaturarten",
      description:
        "Draw a stratified sample of 40 across value bands and failure reason codes, and check every item in the account and bank identifier stratum in full, since that is where the confirmed error occurred and it is the most error prone type.",
      riskImplication:
        "A better designed test than a rushed full check and a proportionate demand on a stretched team. It leaves some releases unexamined, which means the bank cannot say that every affected client payment has been verified, and that is the sentence the committee will want.",
      consequences: [
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Stratified examination of the 96 unreviewed releases with full coverage of the highest risk repair type",
          note: "Sample of 40 stratified by value band and failure reason code, with full coverage of the account and bank identifier stratum where the confirmed error occurred. Designed to produce a defensible error rate rather than a complete inventory, and the limitation is stated with the result.",
        },
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "Examination of the event population is sampled, not complete",
          note: "The stratified design produces a defensible estimate. It does not establish whether any individual unexamined release was erroneous, and the recall window on any such release will have closed by the time a later examination could find it.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Examine all 96 and extend the scope to the 21 never examined prior firings",
      labelDe: "Alle 96 pruefen und auf die 21 nie geprueften frueheren Auslosungen ausweiten",
      description:
        "Require the full check of today's 96 and additionally commission a condition bounded re-test covering every prior firing of the rule since 11.11.2024, of which 21 have never been examined by anyone.",
      riskImplication:
        "Addresses the whole exposure rather than today's slice, and produces the population the test should have had in the first place. It is a much larger commitment, it will not report before the committee, and it makes an assurance method failure part of the same package as an operational one.",
      consequences: [
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Check all 96 overrides released without secondary review against authoritative source data",
          note: "Full examination reporting 07.10.2026 at 12:00. Owner is the control owner, assured by the assurance owner.",
        },
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Re-run the control test with a condition bounded population covering all firings of the configuration rule since 11.11.2024",
          note: "Population bounded by system state rather than by date: every occurrence of the fallback route being active since the rule entered the tenant, covering all 118 firings. 96 are examined today and one was examined in the September test, which leaves 21 never examined.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0778",
          value: "Full examination of today's releases and a condition bounded re-test of all prior firings",
          note: "For decision. The condition bounded re-test addresses a population shape defect in the original test rather than an operational failure, and it will not report before this meeting.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0783", [
    {
      label: "Concede design on the rule cases, hold operating on the three human deviations",
      labelDe: "Konzeption bei den Regelfaellen einraeumen, Wirksamkeit bei den drei menschlichen Abweichungen halten",
      description:
        "Record Partially Effective with both deficiencies named and bounded. The August exception and the 96 event cases are a design deficiency with accountability shared with the supplier. The self review, the review after release and the approval with no evidence are operating deficiencies and are independent of the rule.",
      riskImplication:
        "Produces a conclusion both lines will sign and a statement sharper than either opening position. It concedes publicly that the assurance function had the rule in its hands on 24.09.2026 and classified it as a closed configuration matter, which is the cost of getting the boundary right.",
      isRecommended: true,
      recommendationBasis:
        "The configuration export settles the mechanism and the three remaining deviations are each evidenced as human execution failures with no dependency on the rule. Drawing that line precisely is the only route to a conclusion that survives re-performance, and conceding what is true is what makes the boundary credible.",
      consequences: [
        {
          kind: "set-control-effectiveness",
          targetId: CTL_FOUR_EYES,
          value: "partially-effective",
        },
        {
          kind: "record-test-conclusion",
          targetId: TST_FOUR_EYES,
          value: "Partially Effective. Design deficiency on the configured review waiver, accountability shared with the third party, plus 96 further design deficiency instances on 06.10.2026. Operating deficiency on three human deviations. One limitation retained: 21 of 118 rule firings have never been examined",
        },
        {
          kind: "classify-test-exception",
          targetId: EXC_RULE_WAIVER,
          value: "design-deficiency",
          note: "systemic",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0783",
          value: "Joint first and second line conclusion on CTL-PAY-014 Kontrollwirksamkeit",
          note: "For decision. Partially Effective, signed by both lines, with a design deficiency accountable jointly with the third party and an operating deficiency accountable to the control owner. The divergence recorded earlier in the day is resolved by evidence rather than by compromise, and both positions are retained in the record.",
        },
        {
          kind: "send-collaboration-message",
          targetId: CTL_FOUR_EYES,
          value: "Joint conclusion recorded on the secondary review control",
          note: "The conclusion is Partially Effective with two named deficiencies. The configured waiver and the 96 releases of 06.10.2026 are a design deficiency with accountability shared with the supplier; no member of the repair team bypassed a control. The self review, the review recorded after release and the approval with no documented basis remain operating deficiencies. Both lines sign this conclusion.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Design deficiency across the whole result",
      labelDe: "Konzeptionsmangel fuer das gesamte Ergebnis",
      description:
        "Accept the control owner's characterisation in full. The control's design permitted self review, permitted release before review, and permitted a null evidence reference, so all four exceptions are consequences of design rather than of execution.",
      riskImplication:
        "Consistent in principle and it moves the whole finding to system design and to the supplier. It also removes any first line accountability for three deviations that had human decisions in them, including a review recorded 11 minutes after release under cut-off pressure, and it makes the remediation entirely dependent on a supplier change.",
      consequences: [
        {
          kind: "set-control-effectiveness",
          targetId: CTL_FOUR_EYES,
          value: "partially-effective",
        },
        {
          kind: "record-test-conclusion",
          targetId: TST_FOUR_EYES,
          value: "Partially Effective. Design deficiency across all four exceptions and the 96 event cases, on the basis that the system permitted each failure mode",
        },
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Remediate the control design: segregation enforcement, release blocking and mandatory evidence reference",
          note: "All three enforcement gaps are addressed as system changes rather than as process discipline, because the conclusion characterises every deviation as design.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Hold the original operating characterisation on all four exceptions",
      labelDe: "Urspruengliche Einordnung als Wirksamkeitsmangel fuer alle vier Feststellungen halten",
      description:
        "Maintain that all four exceptions are operating deficiencies. A control that can be waived by a configuration the client can edit was still Arcadia's control to operate, and Arcadia operated it without knowing what it did.",
      riskImplication:
        "Preserves the original conclusion unchanged and keeps first line accountability intact. It is contradicted by the configuration evidence on one exception and on the 96 event cases, where no human saw a review requirement at all, and the control owner will not sign it.",
      consequences: [
        {
          kind: "set-control-effectiveness",
          targetId: CTL_FOUR_EYES,
          value: "partially-effective",
        },
        {
          kind: "record-test-conclusion",
          targetId: TST_FOUR_EYES,
          value: "Partially Effective. Operating deficiency on all four exceptions. The configured waiver is recorded as an operating failure because the rule was client configurable and Arcadia did not review it",
        },
        {
          kind: "record-finding",
          targetId: TST_FOUR_EYES,
          value: "Conclusion issued without the control owner's signature",
          note: "The control owner accepts the configuration evidence and rejects the operating characterisation for the 96 event cases and the August exception, on the basis that the rule waived the requirement before any human saw it. The divergence is retained in the record and escalated.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  /* ----------------------------------------------------------------------
     incident-resilience
     ---------------------------------------------------------------------- */

  ...options("DEC-2026-0749", [
    {
      label: "Material resilience gap, escalated in the resilience function's own name",
      labelDe: "Wesentliche Resilienzluecke, in eigenem Namen der Resilienzfunktion eskaliert",
      description:
        "Raise it as a resilience gap owned here rather than as a supplier evidence item owned elsewhere. An important business service has no tested recovery path for one of the three entities it serves, and the only Swiss option is a manual route that has never been rehearsed.",
      riskImplication:
        "Moves the item from a missing document to a named gap in the resilience framework, which obliges a committee item and a testing commitment. It also duplicates an item already open with third-party risk, and the business will ask which of the two functions owns it.",
      consequences: [
        {
          kind: "create-issue",
          targetId: "SVC-0042-05",
          value: "ARC-CH has no recovery evidence and no fallback route for Swiss clearing submission",
          note: "The Swiss clearing adapter and the Swiss RepairDesk instance are hosted at TP-0042.1 with no recovery test evidence. The supplier recovery report of 22.05.2026 covers the Frankfurt and Amsterdam regions only. ARC-CH has no direct clearing participant link, so its only fallback is manual submission through a correspondent with a 45 minute preparation lead time against a 16:00 same day cut-off (scenario figure). The manual route has no recorded rehearsal.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0749",
          value: "ARC-CH clearing resilience: no recovery evidence and no fallback route",
          note: "For decision. The entity with the tightest impact tolerance on this service has the weakest recovery position. The committee is asked to commission a rehearsal of the manual correspondent route and to require recovery evidence for the Swiss instance as a condition of the supplier reassessment.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Leave it as an open supplier evidence item and chase it there",
      labelDe: "Als offenen Nachweispunkt beim Lieferanten belassen und dort nachfassen",
      description:
        "Keep the item with third-party risk where it already sits, chase the recovery evidence for the Swiss instance through the reassessment, and revisit if the cycle closes without it.",
      riskImplication:
        "Avoids duplicating an open item and keeps one owner on one supplier question. It also leaves a resilience gap described as a document gap, which means it will be closed by a document arriving rather than by a recovery capability being demonstrated.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: "SVC-0042-05",
          value: "Swiss instance recovery evidence",
          note: "Confirm the current status of the open reassessment question on recovery evidence for the Swiss RepairDesk instance, the expected date, and whether the supplier has been asked specifically for the Swiss instance rather than for the service as a whole.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Rehearse the manual route first, then decide what the gap is",
      labelDe: "Zuerst die manuelle Route ueben, dann die Luecke bewerten",
      description:
        "Commission a rehearsal of the manual correspondent submission route before characterising the gap, on the grounds that the size of the gap depends on whether the 45 minute lead time is real and nobody has ever tested it.",
      riskImplication:
        "Produces the one fact that would let the gap be stated accurately, and a rehearsal is cheaper and faster than a supplier evidence negotiation. Until it reports, the entity is carrying an unquantified position on its most important business service.",
      consequences: [
        {
          kind: "create-action",
          targetId: "SVC-0042-05",
          value: "Rehearse the ARC-CH manual correspondent submission route against a same day cut-off",
          note: "Observed rehearsal of the manual route under time pressure, measuring actual preparation time against the 45 minute figure in the runbook, which was last reviewed 14.01.2026 and has no recorded rehearsal. Output is a measured lead time and a latest safe start time for any business day.",
        },
        {
          kind: "activate-monitoring",
          targetId: "SVC-0042-05",
          value: "service",
          note: "Weekly monitoring of Swiss clearing submission availability and queue depth until a rehearsed lead time exists.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0750", [
    {
      label: "Use is not a test: hold the indicator Red and request resourcing for an exercise",
      labelDe: "Einsatz ist keine Pruefung: Indikator rot halten und Mittel fuer eine Uebung beantragen",
      description:
        "Record that five activations produced no controlled observation and do not satisfy the testing standard. Hold the indicator at its current level and request resourcing for a severe but plausible exercise of the fallback path with control effect observation points.",
      riskImplication:
        "Keeps the indicator honest and keeps an important business service on the untested list, which is where it belongs. The resourcing request will compete with a quarter that already has fourteen control tests and two papers, and it may not be granted.",
      isRecommended: true,
      recommendationBasis:
        "In all five activations nobody recorded recovery time against an objective, nobody observed the control environment and nobody measured queue behaviour against a threshold. The last exercise tested a total gateway outage rather than fallback operation, so the path itself has never been exercised under observation.",
      consequences: [
        {
          /*
           * A finding is recorded against the control test that examined the
           * thing found. TST-2026-0302 tested the fallback arrangements of
           * all eleven important business services and reported two with no
           * test evidence at all, which is exactly this observation. The
           * indicator identifier names the measurement, not the test, and
           * `recordFinding` writes a control test reference.
           */
          kind: "record-finding",
          targetId: TST_FALLBACK_TESTED,
          value: "Fallback path for corporate payments relied upon five times and never tested",
          note: "Five activations in September totalling 8 hours 40 minutes, against one activation of one hour in August. No activation produced a controlled observation of recovery time, control effects or queue behaviour. The last severe but plausible exercise, on 18.11.2025, tested a total gateway outage rather than fallback mode operation.",
        },
        {
          kind: "create-action",
          targetId: KRI_TESTED_FALLBACK,
          value: "Design and resource a severe but plausible exercise of the payments fallback path",
          note: "Observation points: recovery time against objective, control effects during fallback operation, repair queue behaviour, and the Swiss correspondent path as a separate scenario because it has never been rehearsed.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Use counts as partial evidence: record the indicator as amber with the basis stated",
      labelDe: "Einsatz zaehlt als Teilnachweis: Indikator als gelb mit benannter Grundlage erfassen",
      description:
        "Accept that five real activations carrying live payment traffic are evidence of something, record the indicator position as partially evidenced with the limitation stated, and schedule an exercise for the next cycle rather than this one.",
      riskImplication:
        "Recognises operational reality and avoids an argument with the first line about whether an exercise proves more than five real uses. It also improves an indicator on evidence that cannot show anything nobody was watching for, which is exactly the control effect at issue.",
      consequences: [
        {
          kind: "record-finding",
          targetId: TST_FALLBACK_TESTED,
          value: "Fallback path evidenced by operational use, not by controlled test",
          note: "Five activations carried live payment traffic and payments cleared, which is operational evidence that the route functions. No activation recorded recovery time, control effects or queue behaviour against a threshold, so the evidence does not establish whether the arrangement holds within tolerance or what it changes while in use.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Reframe the activations as a dependency degradation signal rather than a testing question",
      labelDe: "Aktivierungen als Signal fuer Abhaengigkeitsverschlechterung statt als Pruefungsfrage einordnen",
      description:
        "Leave the testing question for the working group and raise the more important point: five activations in one month against one the month before is a supplier dependency deteriorating, and it reached this function as a payments operations statistic rather than as a warning.",
      riskImplication:
        "Redirects attention from an indicator definition argument to the underlying deterioration, which is the more valuable finding. It leaves the indicator overstated or understated depending on who reads it, and the testing gap unaddressed for another cycle.",
      consequences: [
        {
          kind: "create-issue",
          targetId: TP_NOVALINK,
          value: "Fallback activation frequency rose fivefold in one month and reached resilience as an operations statistic",
          note: "Five activations in September totalling 8 hours 40 minutes against one of one hour in August, each triggered by gateway latency, maintenance overrun or a network path failure. The pattern is a supplier service deteriorating and it was visible only in payment operations reporting. Nothing in the resilience framework escalated it.",
        },
        {
          kind: "activate-monitoring",
          targetId: TP_NOVALINK,
          value: "supplier",
          note: "Weekly monitoring of fallback activation frequency and duration as a supplier dependency signal, reported into resilience rather than only into payment operations.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0751", [
    {
      label: "Carry it to the committee tolerance review as an open question",
      labelDe: "Als offene Frage in die Toleranzueberpruefung des Gremiums geben",
      description:
        "Put the two measures in front of the committee separately, with the absence of a precedence stated and no recommendation, and let the body that set the tolerance resolve it. The agenda item already exists and carries a decision.",
      riskImplication:
        "Proportionate to a gap with no observed divergence, and it puts the question where the authority to answer it sits. If a divergence occurs before the committee meets, the entity will be answering it live with no precedence and an open agenda item.",
      consequences: [
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0751",
          value: "ITOL-0004-03 has two measures and no stated precedence",
          note: "For decision. The Swiss clearing tolerance sets a maximum tolerable disruption of two hours and requires submission to complete before the same day cut-off. Neither the tolerance record nor the ARC-CH Board Risk Committee minutes of 24.02.2026 state which measure governs if they diverge. No divergence has been observed.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Raise it now as a definitional finding with a remediation action",
      labelDe: "Jetzt als Definitionsfeststellung mit Massnahme erheben",
      description:
        "Record a finding that the tolerance cannot be evaluated on divergence, raise an action to resolve the precedence and to review all four tolerances on this service for the same defect, and take the finding to the committee with a recommendation.",
      riskImplication:
        "Fixes the defect before it can produce an unanswerable question, and a tolerance that cannot adjudicate its own outcome is a framework defect whether or not it has ever mattered. It invites the reasonable response that no divergence has ever occurred, which is the weakest ground on which to ask a board committee to reopen a tolerance.",
      consequences: [
        {
          /*
           * Raised as an issue against the tolerance and not as a control
           * test finding. The defect is in an approved tolerance record, no
           * control test examined it, and `recordFinding` would have written
           * a control test reference that does not exist. `createIssue`
           * attaches the finding to the object it is about.
           */
          kind: "create-issue",
          targetId: ITOL_CH_CLEARING,
          value: "Impact tolerance defined with two measures and no precedence cannot be evaluated on divergence",
          note: "The tolerance sets an elapsed disruption limit and a cut-off completion requirement. If a disruption exceeds the elapsed limit while submission still completes before the cut-off, or the reverse, the entity cannot state whether its tolerance was breached. The defect is definitional rather than operational.",
        },
        {
          kind: "create-action",
          targetId: ITOL_CH_CLEARING,
          value: "Resolve the two measure precedence and review all corporate payments tolerances for the same defect",
          note: "Recommendation to the ARC-CH Board Risk Committee on which measure governs, plus a check of the other three tolerances on this service for multiple measures without a precedence.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Resolve it internally first by proposing a precedence to the local resilience officer",
      labelDe: "Zuerst intern klaeren: dem lokalen Resilienzverantwortlichen eine Rangfolge vorschlagen",
      description:
        "Take a proposed precedence to the Swiss resilience officer bilaterally, agree a working position, and bring an agreed recommendation to the committee rather than an open question.",
      riskImplication:
        "Arrives at the committee with a position rather than a problem, which is more likely to be adopted. A precedence agreed between two officers is not a tolerance set by the body that owns it, and if it is relied upon before the committee ratifies it, the entity has been operating to a tolerance nobody approved.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: ITOL_CH_CLEARING,
          value: "tolerance measure precedence",
          note: "Confirm whether the ARC-CH Board Risk Committee intended the elapsed disruption limit or the cut-off completion requirement to govern where the two diverge, and whether any local guidance exists that the group tolerance record does not carry.",
        },
      ],
      requiresApproval: false,
    },
  ]),

  ...options("DEC-2026-0761", [
    {
      label: "Resilience finding with a two part remediation, raised now",
      labelDe: "Resilienzfeststellung mit zweiteiliger Massnahme, jetzt erhoben",
      description:
        "Raise the finding without waiting for the configuration and split the remediation: remove the unsupported assertion now, and state the specific control effects of fallback activation once they are established.",
      riskImplication:
        "Records that an operational runbook made a control assertion with no basis, which is a finding whatever the configuration turns out to say. It is procedurally awkward, it criticises a runbook the process owner owns on a day he is already under challenge, and the alternative leaves the assertion in force.",
      isRecommended: true,
      recommendationBasis:
        "The assertion had no basis when it was written, which makes it a finding independent of the configuration. A single action with a later date would leave the assertion standing for another three weeks while the fallback route remains available for use.",
      consequences: [
        {
          /*
           * An issue against the runbook document, not a finding against a
           * control test. No control test examined the runbook, and the
           * runbook is a document in the Evidence Vault rather than a
           * register object, so the document is what a reader opens.
           */
          kind: "create-issue",
          targetId: RB_FALLBACK_RUNBOOK,
          value: "Runbook asserts that the control environment is unchanged during fallback operation, without basis",
          note: "Section 4 of the clearing route substitution runbook states that the control environment is unchanged during fallback operation. Reconciliation against the eleven controls mapped to the payment repair process identifies the independent secondary review control as conditional on system state, which contradicts the assertion. The assertion is a documented control claim with no recorded verification, which makes it a finding rather than an omission.",
        },
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Amend the runbook in two parts: remove the unsupported control assertion, then state the actual control effects of fallback activation",
          note: "Part one removes the assertion in section 4 and can be done immediately. Part two states what actually changes in the control environment when the fallback route is activated, and depends on the tenant configuration that control assurance has formally demanded.",
        },
        {
          kind: "send-collaboration-message",
          targetId: RB_FALLBACK_RUNBOOK,
          value: "Runbook control assertion recorded as a resilience finding",
          note: "Section 4 of the clearing route substitution runbook asserts that the control environment is unchanged during fallback operation. The control inventory contradicts it. The assertion is being removed now and the correct replacement text, stating what actually changes, follows once the supplier configuration is available.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Documentation correction, owned by the process owner, closed in days",
      labelDe: "Dokumentationskorrektur, verantwortet vom Prozessverantwortlichen, in Tagen abgeschlossen",
      description:
        "Ask the process owner to correct section 4 as a documentation matter. It closes quickly, it does not consume committee attention, and it does not add a criticism to a day that already has one.",
      riskImplication:
        "Fast and low friction, and it does not require anyone to establish what actually changes during fallback operation, which is the substantive question. A correction made now would align one document to an assumption rather than to a fact.",
      consequences: [
        {
          kind: "create-action",
          targetId: RB_FALLBACK_RUNBOOK,
          value: "Correct the control environment statement in runbook section 4",
          note: "Documentation correction. The assertion that the control environment is unchanged during fallback operation is removed and replaced with a reference to the control inventory.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Hold until the configuration arrives, then raise a fully specified finding",
      labelDe: "Bis zum Vorliegen der Konfiguration warten und dann eine vollstaendige Feststellung erheben",
      description:
        "Wait for the supplier configuration so the finding can state exactly which controls change and how, rather than raising a finding that says the runbook is wrong without saying what is right.",
      riskImplication:
        "Produces a complete and unarguable finding when it lands. It also leaves an unsupported control assertion in force in a runbook that can be invoked at any time, and the evidence it waits on is already past its service level with no confirmed arrival time.",
      consequences: [
        {
          kind: "request-evidence",
          targetId: CTL_FOUR_EYES,
          value: "Tenant configuration evidence establishing what changes in the control environment when the fallback route is activated, so that the runbook amendment can be fully specified",
        },
      ],
      requiresApproval: false,
    },
  ]),

  ...options("DEC-2026-0765", [
    {
      label: "Upgrade on the Swiss position alone, with both grounds recorded separately",
      labelDe: "Allein aufgrund der Schweizer Lage heraufsetzen, beide Gruende getrennt erfasst",
      description:
        "Upgrade severity on the worst entity position rather than on an average, and record two independent grounds: an impact tolerance within 38 minutes of its limit, and 96 candidate breaches of a tolerance whose threshold is zero.",
      riskImplication:
        "Wakes the Group Chief Risk Officer and the committee chair on an entity position that two of the three entities do not share, and commits the group to a severity it will have to defend. Not upgrading leaves the entity with the deadline unserved by the group framework.",
      isRecommended: true,
      recommendationBasis:
        "A group framework applied to legal entities takes the worst entity position and names it rather than averaging three. Both grounds are independently sufficient, and one of them is a tolerance with a zero threshold.",
      consequences: [
        {
          kind: "classify-incident",
          targetId: INC_EVENT,
          value: "critical",
          note: "Two independent grounds. First, the Swiss clearing impact tolerance is within 38 minutes of its elapsed limit with the only available recovery route requiring 45 minutes of preparation. Second, 96 payment releases currently show an unsatisfied mandatory control gate against an impact tolerance whose threshold is zero. The EU entity positions remain wide and are recorded separately.",
        },
        {
          kind: "escalate-incident",
          targetId: INC_EVENT,
          value: "P-013",
        },
        {
          kind: "create-issue",
          targetId: ITOL_ZERO_GATE,
          value: "Zero tolerance control gate condition: 96 candidate breaches detected by ad hoc query",
          note: "The tolerance states that no corporate payment is released without the control gates defined for its release path, with a tolerance of zero. The 96 candidate breaches were found by an override audit log query at 14:34, not by any monitoring control. A zero tolerance statement with no detection capability is a framework defect.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Hold at the current severity and upgrade when the Swiss route is decided",
      labelDe: "Aktuellen Schweregrad halten und bei Entscheidung zur Schweizer Route heraufsetzen",
      description:
        "Keep the current severity while the Swiss decision is still open, on the basis that the tolerance position resolves one way or the other within the hour, and upgrade if the manual route is not invoked or does not complete.",
      riskImplication:
        "Avoids escalating to the highest level on a position that may resolve within 50 minutes, and keeps the executive channel for a confirmed rather than a projected breach. If the route is invoked and fails, the upgrade arrives after the tolerance has already gone.",
      consequences: [
        {
          kind: "classify-incident",
          targetId: INC_EVENT,
          value: "high",
          note: "Severity held pending the Swiss recovery decision. The Swiss clearing tolerance is inside its limit at the time of assessment and the EU entity positions are wide. Reassessment is triggered automatically on the outcome of the manual submission route or at the elapsed limit, whichever is first.",
        },
        {
          kind: "activate-monitoring",
          targetId: ITOL_CH_CLEARING,
          value: "impact-tolerance",
          note: "Live monitoring of both measures of the Swiss clearing tolerance, with an alert at the elapsed limit and at the latest safe start time for the manual route.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Upgrade on the control gate ground alone and keep the tolerance position separate",
      labelDe: "Allein aufgrund der Kontrollluecke heraufsetzen und die Toleranzlage getrennt halten",
      description:
        "Upgrade on the zero tolerance control condition, which is a group level fact affecting two entities, and record the Swiss tolerance proximity as a separate entity escalation to the Swiss executive rather than as a group severity driver.",
      riskImplication:
        "Rests the group severity on a group fact, which is cleaner to defend, and routes the entity specific runway to the executive who can act on it. It also relies on a telemetry inference that is currently disputed by the control owner, and if she is right the severity ground disappears.",
      consequences: [
        {
          kind: "classify-incident",
          targetId: INC_EVENT,
          value: "critical",
          note: "Upgraded on the zero tolerance control gate condition: 96 payment releases with an unsatisfied mandatory control gate across two entities. The Swiss clearing tolerance proximity is recorded as a separate entity level escalation with its own owner and its own decision.",
        },
        {
          kind: "escalate-incident",
          targetId: INC_EVENT,
          value: "P-013",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0776", [
    {
      label: "Invoke the manual correspondent route now",
      labelDe: "Manuelle Korrespondenzroute jetzt ausloesen",
      description:
        "Invoke the Swiss manual submission runbook immediately and submit the same day tranche through the correspondent, accepting a manual process risk on a route that has never been rehearsed, because the preparation lead time consumes more than the remaining runway.",
      riskImplication:
        "Accepts a manual process risk on an unrehearsed path in exchange for the same day cut-off being achievable at all. Once the tranche is submitted through the correspondent it cannot be unwound, and if the supplier recovers at 16:00 as stated, the risk will have been taken unnecessarily.",
      isRecommended: true,
      recommendationBasis:
        "The supplier's recovery estimate is a stakeholder statement with no evidential basis, contradicted seven minutes later by its own written update saying the cause is under investigation, and its monitoring pipeline is degraded. Waiting to test the estimate costs the option, because the latest safe start is 15:15 and the estimate cannot be tested before 16:00.",
      consequences: [
        {
          kind: "select-recovery-option",
          targetId: RCV_CH_CORRESPONDENT,
        },
        {
          kind: "create-issue",
          targetId: ITOL_CH_CLEARING,
          value: "Manual process risk accepted on an unrehearsed recovery route",
          note: "The Swiss same day tranche of CHF 18,712,400 is submitted manually through the correspondent under the local runbook. The 45 minute preparation lead time comes from a runbook last reviewed 14.01.2026 with no recorded rehearsal. The decision is taken before the cause is known and before the supplier recovery estimate can be tested, because the lead time exceeds the remaining tolerance.",
        },
        {
          kind: "send-collaboration-message",
          targetId: INC_EVENT,
          value: "ARC-CH manual submission route invoked for the same day tranche",
          note: "The Swiss same day tranche is being prepared for manual submission through the correspondent under the local runbook. Preparation takes 45 minutes against a 16:00 cut-off. The supplier's 16:00 recovery estimate is not being relied upon because it has no evidential basis and its own written update says the cause is under investigation. Once submitted the instruction set cannot be unwound.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Wait for the 16:00 recovery update and hold the queue",
      labelDe: "Auf die Wiederherstellungsmeldung um 16:00 warten und die Warteschlange halten",
      description:
        "Hold the queue and rely on the supplier's stated recovery by 16:00. If it holds, the instructions submit through the normal route with no manual process risk and no correspondent fees.",
      riskImplication:
        "Avoids taking a manual process risk on an unrehearsed route for a disruption that may be over within the hour. If the estimate is wrong, the same day cut-off is missed for 1,842 instructions and the option to act will have expired, because the manual route needs 45 of the remaining 51 minutes.",
      consequences: [
        {
          kind: "activate-monitoring",
          targetId: ITOL_CH_CLEARING,
          value: "impact-tolerance",
          note: "Live monitoring of the Swiss queue and of both tolerance measures, with an alert at the latest safe start time for the manual route and at the elapsed limit.",
        },
        {
          kind: "request-factual-validation",
          targetId: TP_NOVALINK,
          value: "recovery estimate basis",
          note: "State the evidential basis for the 16:00 recovery estimate, given that the written portal update says the cause is under investigation and that the monitoring and alerting pipeline is itself degraded. Confirm the estimate's confidence and the time of the next update.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Prepare the manual route without submitting, and decide at the latest safe moment",
      labelDe: "Manuelle Route vorbereiten ohne Einreichung und im letzten sicheren Moment entscheiden",
      description:
        "Start the 45 minutes of preparation now so the option stays open, and take the submission decision at the latest safe moment with whatever facts exist then. Preparation is reversible; submission is not.",
      riskImplication:
        "Buys the option without spending it, which is the classical answer and depends entirely on whether the preparation can actually be paused at the end. It commits treasury and correspondent resource to a submission that may not happen, and if the preparation overruns the decision point has already passed.",
      consequences: [
        {
          kind: "send-collaboration-message",
          targetId: INC_EVENT,
          value: "ARC-CH manual route prepared, submission decision held to the latest safe moment",
          note: "Preparation of the manual correspondent submission begins now so the option remains available. The submission decision is held to the latest safe moment. Preparation is reversible and submission is not. Confirm whether preparation can be halted at any point without consuming the correspondent window.",
        },
        {
          kind: "activate-monitoring",
          targetId: ITOL_CH_CLEARING,
          value: "impact-tolerance",
          note: "Live monitoring of both tolerance measures and of preparation progress against the latest safe submission time.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0774", [
    {
      label: "Significant but below the threshold, provisional, with a reassessment trigger",
      labelDe: "Erheblich, aber unterhalb der Schwelle, vorlaeufig, mit Neubewertungsausloeser",
      description:
        "Conclude that the event is significant and does not meet the major incident threshold on the facts available for the two EU entities, record the criteria assessed and the gaps named, and set an explicit reassessment trigger on receipt of the supplier report. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Records a considered position with its limitations visible, and commits the bank to re-running the assessment rather than to a final answer. If the supplier report shows a longer or wider disruption, the assessment changes and the record shows that it was always provisional. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "classify-incident",
          targetId: INC_EVENT,
          value: "critical",
          note: "EU entity assessment for ARC-DE and ARC-AT only: significant, below the major incident threshold on the facts available, provisional with a reassessment trigger on receipt of the supplier report due 13.10.2026. Criteria assessed: clients affected, reputational impact, duration and service downtime, geographical spread, data losses, criticality of services affected, economic impact. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "record-notification-recommendation",
          targetId: INC_EVENT,
          value: "false",
          note: "No supervisory notification recommended for ARC-DE and ARC-AT on the facts available. Duration is inside the four hour tolerance for these entities, service is restored, one erroneous release is confirmed and recallable, and no data loss is evidenced. The assessment is provisional and is re-run on receipt of the supplier report. This recommendation covers the two EU entities only. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Recommend notification now, on the control gate ground",
      labelDe: "Meldung jetzt empfehlen, aufgrund der Kontrolluecke im Freigabeweg",
      description:
        "Recommend a supervisory notification for the two EU entities on the ground that a key control in the Internal Control System was waived by configuration for 3 hours 56 minutes, producing 96 releases with an unsatisfied mandatory gate and one confirmed erroneous payment. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Takes the conservative position and cannot be criticised for under-reporting. It commits the bank to a notification on facts that are still moving, it consumes supervisory attention on an event whose service impact was inside tolerance, and withdrawing it later would itself be a disclosure. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "classify-incident",
          targetId: INC_EVENT,
          value: "critical",
          note: "EU entity assessment for ARC-DE and ARC-AT only: assessed as meeting the major incident threshold on the criticality of services affected criterion, on the basis that a key control in the Internal Control System was waived by configuration and 96 payment releases were made with an unsatisfied mandatory gate. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "record-notification-recommendation",
          targetId: INC_EVENT,
          value: "recommend",
          note: "Supervisory notification recommended for ARC-DE and ARC-AT. Grounds: a key control in the Internal Control System was waived by supplier configuration for 3 hours 56 minutes, 96 payment releases with a combined value of EUR 9,420,880 were made with an unsatisfied mandatory control gate, and one erroneous release of EUR 38,400 is confirmed with a recall initiated. This recommendation covers the two EU entities only and is not extended to ARC-CH, which is assessed separately. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "escalate-incident",
          targetId: INC_EVENT,
          value: "P-013",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Defer the EU assessment until the full examination reports on 07.10.2026",
      labelDe: "EU-Bewertung bis zum Bericht der Vollpruefung am 07.10.2026 zurueckstellen",
      description:
        "Take no classification today. The number of erroneous releases is the fact that most affects the economic impact and clients affected criteria, and it will exist at 12:00 on 07.10.2026. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Produces the assessment on the best facts that will exist before the committee papers close, and avoids two revisions in two days. It also means the bank holds no classification at all overnight on an event at its highest internal severity, which is difficult to explain if anyone asks in the interim. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: INC_EVENT,
          value: "affected release examination result",
          note: "Confirm the number of confirmed erroneous releases among the 96, with values and recall status per item, by 07.10.2026 at 12:00, so that the EU entity classification assessment can be completed on the clients affected and economic impact criteria. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0775", [
    {
      label: "No report required on the facts available, documented and to be re-run",
      labelDe: "Keine Meldung auf Basis der vorliegenden Fakten erforderlich, dokumentiert und erneut zu pruefen",
      description:
        "Conclude for ARC-CH, against FINMA context and separately from the EU assessment, that the event is not an incident of substantial importance on the facts available, and record the reasoning with a reassessment trigger. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "A documented provisional position on a separate framework with a separate record, which is what the two jurisdiction structure requires. The position rests on an outcome that succeeded by two minutes and on a tolerance question the entity cannot answer. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-notification-recommendation",
          targetId: INC_EVENT,
          value: "false",
          note: "ARC-CH assessment only, against FINMA operational risk and resilience reporting expectations for incidents of substantial importance. No report required on the facts available. Grounds: 1,840 of 1,842 instructions were accepted before the same day cut-off, the two rejected instructions worth CHF 14,200 rolled to the next value date and sit well inside the group value delay tolerance, and no client data was lost or disclosed. The elapsed disruption measure of the local tolerance was exceeded by 11 minutes while the cut-off measure was met, and no precedence exists between them. Provisional, with a reassessment trigger on receipt of the supplier report due 13.10.2026. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "create-issue",
          targetId: ITOL_CH_CLEARING,
          value: "ARC-CH cannot state whether its own impact tolerance was breached",
          note: "Two measures with opposite outcomes and no stated precedence. Recorded as an open question with a named owner and a committee destination. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Report as an incident of substantial importance, on the tolerance and control grounds",
      labelDe: "Als Vorfall von erheblicher Bedeutung melden, aufgrund von Toleranz und Kontrolle",
      description:
        "Conclude for ARC-CH that the event is of substantial importance: a significant business process was disrupted for 2 hours 11 minutes, the elapsed tolerance measure was exceeded, and the same day cut-off was met only by a manual route that has never been rehearsed. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "The conservative Swiss position and it is defensible on the elapsed measure alone. It reports on a measure the entity cannot show governs, and it reports an event where the client outcome was two rejected instructions worth CHF 14,200. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-notification-recommendation",
          targetId: INC_EVENT,
          value: "recommend",
          note: "ARC-CH assessment only. Report recommended as an incident of substantial importance. Grounds: a significant business process was disrupted from 13:47 to 15:58, the elapsed disruption measure of the local tolerance was exceeded by 11 minutes, no fallback route exists for the entity, and the same day cut-off was met only through a manual correspondent route with no recorded rehearsal. This assessment covers ARC-CH only and shares no fields with the EU entity assessment. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0775",
          value: "ARC-CH reporting position on the clearing disruption of 06.10.2026",
          note: "For noting. The Swiss assessment is made against FINMA context and separately from the EU entity assessment. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Consult the local compliance and legal position before concluding",
      labelDe: "Vor der Schlussfolgerung die lokale Compliance- und Rechtsposition einholen",
      description:
        "Record the facts, state that the reporting assessment turns on an unresolved tolerance definition, and put the question to local compliance and Group Legal before concluding either way. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Avoids a reporting conclusion resting on a measure the entity cannot show governs, and puts an interpretation question where interpretation authority sits. It leaves the Swiss entity with no recorded reporting assessment overnight on a significant business process disruption. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: ITOL_CH_CLEARING,
          value: "local reporting assessment on an unresolved tolerance",
          note: "The Swiss clearing tolerance has two measures giving opposite answers and no stated precedence. Confirm the local compliance and legal position on whether a reporting assessment can be concluded while the tolerance question is unresolved, and on which measure should be treated as governing in the interim. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: false,
    },
  ]),

  ...options("DEC-2026-0786", [
    {
      label: "Record that the entity cannot state whether the tolerance was breached",
      labelDe: "Erfassen, dass die Einheit nicht feststellen kann, ob die Toleranz ueberschritten wurde",
      description:
        "Write both measures with their opposite outcomes into the incident record, state that no precedence exists, name the owner and name the committee destination, and resolve nothing.",
      riskImplication:
        "The bank records that it cannot answer a question about its own impact tolerance, which is a harder sentence to write than either answer. It is also the only statement that does not assert a precedence nobody has set, and it converts an operational question into a framework finding the committee can actually fix.",
      isRecommended: true,
      recommendationBasis:
        "Measure one is satisfied and measure two is exceeded, and the tolerance record and the board committee minutes of 24.02.2026 are both silent on precedence. Choosing a measure would be asserting an authority the resilience function does not hold.",
      consequences: [
        {
          /*
           * The determination is recorded against the tolerance itself. It is
           * not a conclusion on a control test, so it is an issue on the
           * object rather than a finding on a test that never looked at it.
           */
          kind: "create-issue",
          targetId: ITOL_CH_CLEARING,
          value: "Impact tolerance outcome indeterminate: two measures, two answers, no precedence",
          note: "Measure one, submission completion against the cut-off: submission completed 15:58 against a 16:00 cut-off, not breached. Measure two, elapsed disruption: queueing began 13:47 and submission completed 15:58, elapsed 2 hours 11 minutes against a two hour maximum, breached by 11 minutes. Neither the tolerance record nor the ARC-CH Board Risk Committee minutes of 24.02.2026 state which governs. The defect is in the tolerance definition rather than in the operation. Owner is the group resilience lead; destination is the committee impact tolerance review.",
        },
        {
          kind: "create-action",
          targetId: ITOL_CH_CLEARING,
          value: "Resolve the two measure ambiguity and review all corporate payments tolerances for the same defect",
          note: "Recommendation on precedence to the ARC-CH Board Risk Committee, plus a check of the other three tolerances on this service. Of the four, three carry a single measure and one carries two, so the review is proportionate.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0786",
          value: "ARC-CH impact tolerance cannot adjudicate its own outcome",
          note: "For decision. The committee is asked to set a precedence between the two measures and to require that any tolerance with more than one measure state which governs on divergence. This is a definitional defect, not an operational failure.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Not breached: the cut-off measure is the operative one",
      labelDe: "Nicht ueberschritten: die Cut-off-Messung ist die massgebliche",
      description:
        "Record the tolerance as not breached, on the basis that the cut-off completion requirement is the measure that reflects the client outcome and the client outcome was that 1,840 of 1,842 instructions cleared on the same day.",
      riskImplication:
        "Reflects what actually happened to clients and is the outcome the business will read as correct. It asserts a precedence that nobody set, and it is the choice that makes the definitional defect invisible, so the same ambiguity persists into every future event.",
      consequences: [
        {
          kind: "create-issue",
          targetId: ITOL_CH_CLEARING,
          value: "Impact tolerance recorded as not breached on the cut-off completion measure",
          note: "Submission completed 15:58 against a 16:00 cut-off with 1,840 of 1,842 instructions accepted. The elapsed disruption measure was exceeded by 11 minutes and is recorded as a secondary observation. The precedence applied here is not stated in the tolerance record.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Breached: the elapsed measure is the operative one",
      labelDe: "Ueberschritten: die Zeitdauermessung ist die massgebliche",
      description:
        "Record the tolerance as breached by 11 minutes on the elapsed disruption measure, on the basis that a maximum tolerable disruption is a statement about time and the cut-off requirement is an additional condition rather than an alternative test.",
      riskImplication:
        "The conservative reading and it puts a breach on the record for the entity with the tightest tolerance. It asserts a precedence nobody set, in the direction that triggers reporting assessments and board attention, on a day when the client outcome was two delayed instructions worth CHF 14,200.",
      consequences: [
        {
          kind: "create-issue",
          targetId: ITOL_CH_CLEARING,
          value: "Impact tolerance recorded as breached by 11 minutes on the elapsed disruption measure",
          note: "Queueing began 13:47 and submission completed 15:58, elapsed 2 hours 11 minutes against a two hour maximum. The cut-off completion requirement was met. The precedence applied here is not stated in the tolerance record and is applied in the conservative direction.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0786",
          value: "ARC-CH impact tolerance breached on the elapsed disruption measure",
          note: "For decision. The breach is recorded on the elapsed measure while the cut-off measure was met. The committee is asked to confirm the precedence applied.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  /* ----------------------------------------------------------------------
     regulatory-change
     ---------------------------------------------------------------------- */

  ...options("DEC-2026-0752", [
    {
      label: "Both lanes applicable, tracked as two obligations with separate evidence",
      labelDe: "Beide Pfade anwendbar, als zwei Anforderungen mit getrennten Nachweisen gefuehrt",
      description:
        "Record the arrangement as creating two distinct obligations: a subcontracting chain completeness obligation for the German and Austrian entities, and an inventory and data access obligation for the Swiss entity. Separate evidence requirements, separate owners, no shared fields. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Prevents the category error of satisfying one obligation and recording both as met, which is the failure this role exists to prevent. It doubles the tracking on one supplier arrangement and the forum will read that as bureaucracy until it is shown that the evidence requirements genuinely differ. Illustrative regulatory context, not legal advice.",
      isRecommended: true,
      recommendationBasis:
        "Satisfying the EU register completeness obligation would not satisfy the Swiss inventory and data access obligation, and the converse also holds. The arrangement creates obligations in two jurisdictions and cannot be owned by one determination. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_EU_SUBCONTRACTING,
          value: "applicable",
          note: "Applicable to ARC-DE and ARC-AT. The subcontracting chain for a Tier 1 arrangement supporting an important business service is incomplete: one subprocessor onboarded 01.05.2026 is absent from the binding appendix and from the register record. The obligation is recorded as mapped and unevidenced. This determination does not extend to ARC-CH. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_CH_INVENTORY_ACCESS,
          value: "applicable",
          note: "Applicable to ARC-CH under FINMA context. Two questions: whether a subprocessor of a significant outsourcing belongs in the filed outsourcing inventory, and whether read access to payment metadata by a party in a third country requires assessment. The filed inventory of 24.07.2026 does not contain the subprocessor. The data processing appendix names four transfer destinations and does not name India. This determination is separate from and additional to the EU lane determination. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "request-evidence",
          targetId: TP_MERIDIAN,
          value: "Written confirmation of the data fields accessible to the service desk subprocessor, the jurisdictions from which access occurs, and the contractual basis on which the access was granted",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "EU lane only for now, with the Swiss question held pending Group Legal",
      labelDe: "Zunaechst nur EU-Pfad, Schweizer Frage bis zur Stellungnahme der Rechtsabteilung offen",
      description:
        "Record the EU lane obligation as applicable and hold the Swiss lane question open until Group Legal answers whether the third country access falls within the data processing appendix, because the Swiss determination depends on that answer. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Avoids recording a Swiss applicability determination on an unverified data scope, which would be an interpretation without a basis. It also means the entity with a significant outsourcing carries an unrecorded question while the EU entities carry a recorded one, and the asymmetry is exactly what group reporting tends to smooth over. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_EU_SUBCONTRACTING,
          value: "applicable",
          note: "Applicable to ARC-DE and ARC-AT. Subcontracting chain incomplete for a Tier 1 arrangement supporting an important business service. Recorded as mapped and unevidenced. The Swiss lane question is held open pending a Group Legal position on the transfer appendix scope and is not determined here. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "request-factual-validation",
          targetId: OBL_CH_INVENTORY_ACCESS,
          value: "transfer appendix scope",
          note: "Confirm whether read access to payment metadata from Pune falls within the scope of the data processing and transfers appendix, which names Switzerland, Germany, the Czech Republic and Ireland and does not name India. The Swiss lane applicability determination depends on the answer. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Treat it as a single supplier chain question owned by third-party risk",
      labelDe: "Als einzelne Lieferkettenfrage behandeln, verantwortet vom Drittparteienrisiko",
      description:
        "Record one obligation covering the chain question and assign it to the third-party risk function, on the basis that the underlying work is one contractual and evidential exercise and splitting it creates two requests to the same supplier. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Produces one owner, one request and one piece of evidence, which is efficient and is how the forum instinctively wants to handle it. It risks the two jurisdictions being answered by one determination, which is the specific error the two lane structure exists to prevent. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_EU_SUBCONTRACTING,
          value: "applicable",
          note: "Recorded as a single supplier chain obligation assigned to third-party risk, covering the appendix divergence, the register completeness question and the data access question. The Swiss lane requirement is noted as a dependency rather than as a separate determination. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0753", [
    {
      label: "Send the comment now, with the single instance as the case",
      labelDe: "Stellungnahme jetzt senden, mit dem Einzelfall als Beispiel",
      description:
        "File a consultation comment requiring that any tolerance with more than one measure state which governs on divergence, citing the one existing tolerance that has two measures and no precedence. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Fixes a defect before it is designed into every tolerance written under the standard, at the cost of a thin case. A comment resting on one unrealised instance is likely to be noted and not adopted, and a rejected comment is harder to revive later in the same consultation. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_TOLERANCE_DEFINITION,
          value: "applicable",
          note: "Consultation comment filed on the draft internal impact tolerance standard: any tolerance expressed with more than one measure must state which measure governs where the measures diverge. Case cited is the one existing group tolerance with two measures and no stated precedence. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Hold the comment as a prepared draft until a concrete case exists",
      labelDe: "Stellungnahme als vorbereiteten Entwurf halten, bis ein konkreter Fall vorliegt",
      description:
        "Keep the comment drafted and unsent. The consultation window runs to 23.10.2026, which leaves room to file it if a divergence occurs, and a comment with a real case is far more likely to be adopted. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Professionally normal and costs nothing provided the window is still open when a case appears. If no case appears, the standard is issued with the defect and every tolerance written under it inherits an ambiguity that cannot be adjudicated. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: OBL_TOLERANCE_DEFINITION,
          value: "multiple measure tolerances across the group",
          note: "Confirm whether any impact tolerance outside the corporate payments service is expressed with more than one measure, so that the consultation comment can cite the actual population rather than a single instance. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Raise it as a standard design issue outside the consultation",
      labelDe: "Als Gestaltungsthema des Standards ausserhalb der Konsultation erheben",
      description:
        "Leave the consultation alone and raise the precedence question directly with the standard's governance owner as a design issue, so it can be fixed in drafting rather than argued in a consultation response. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Faster and more likely to result in a change, because a drafting fix does not need consultation support. It bypasses the consultation record, which means the issue and its resolution are not visible to the other respondents, and the fix depends on one person agreeing. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "create-issue",
          targetId: OBL_TOLERANCE_DEFINITION,
          value: "Draft tolerance standard permits a tolerance that cannot be evaluated on divergence",
          note: "The draft internal impact tolerance standard does not require a stated precedence where a tolerance is expressed with more than one measure. One existing group tolerance has two measures and no precedence. Raised as a drafting issue with the standard owner rather than as a consultation response. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0754", [
    {
      label: "Reclassify as supporting a critical or important function",
      labelDe: "Als kritische oder wichtige Funktion unterstuetzend neu klassifizieren",
      description:
        "Change the classification on substance: a format library failure would stop the bulk file payment type entirely, which is a service outcome indistinguishable from a gateway failure. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Pulls the service into register content, contractual protection and testing obligations, with a cost the business owner and the commercial owner have to carry. It also means the basis survives a supervisor asking why a service whose failure stops a payment type was carried as non critical. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_EU_SUBCONTRACTING,
          value: "applicable",
          note: "Service reclassification recorded for ARC-DE and ARC-AT: payment file transformation and format library maintenance is assessed as supporting a critical or important function, because a format library failure would stop the bulk file payment type. Register content, contractual protection and testing obligations follow. The Swiss classification for this service is assessed separately. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0754",
          value: "Reclassification of the payment file transformation service",
          note: "For decision. The service is currently classified as not supporting a critical or important function. A format library failure would stop bulk file payments for all three entities. Reclassification carries register, contractual and testing consequences with a cost. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Test the dependency first, then classify",
      labelDe: "Zuerst die Abhaengigkeit pruefen, dann klassifizieren",
      description:
        "Establish what a format library failure would actually do before changing the classification. Nobody has tested it and the inference that bulk file payments stop is drawn from the service description rather than from an outage. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Produces a classification with a tested basis rather than an inferred one, which is the position that survives challenge. It defers a classification that may be wrong today, and the same reasoning would defer any reclassification indefinitely because nobody tests services that are classified as non critical. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "request-factual-validation",
          targetId: "SVC-0042-03",
          value: "format library failure impact",
          note: "Establish what happens to the bulk file payment type if the format library maintenance service is unavailable: whether the library is cached or versioned on the Arcadia side, how long existing versions remain usable, and whether any payment type stops immediately. The classification determination depends on the answer. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Leave the classification and record the question as an open inconsistency",
      labelDe: "Klassifizierung beibehalten und die Frage als offene Inkonsistenz erfassen",
      description:
        "Keep the current classification, record the inconsistency between the classification and the payment type dependency as an open question against the register item, and revisit at the next cycle. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Avoids a reclassification cost that nobody has agreed to fund, and keeps the question visible on the record rather than resolved out of it. It leaves a service whose failure would stop a payment type outside the contractual and testing protections that classification brings. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "create-issue",
          targetId: "SVC-0042-03",
          value: "Service classification is inconsistent with its payment type dependency",
          note: "Payment file transformation and format library maintenance is classified as not supporting a critical or important function. Bulk file payments route by underlying type and depend on the format library. The inconsistency is recorded as an open question against the register item and is carried to the next classification cycle. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0762", [
    {
      label: "Inventory scope definition question, with a proposed clarification to the standard",
      labelDe: "Frage der Definitionsbreite des Verzeichnisses, mit Klarstellungsvorschlag zum Standard",
      description:
        "Characterise the gap as a scope definition question in Arcadia's own standard, and propose a clarification requiring subprocessors of significant outsourcings to be recorded where they have access to client identifying data. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Puts the burden on Arcadia's standard rather than on the person who filed the inventory, and fixes the recurrence rather than the instance. It is slower, it is structural, and it means the current inventory stays incomplete while the standard is clarified. Illustrative regulatory context, not legal advice.",
      isRecommended: true,
      recommendationBasis:
        "The standard's text on subcontracting depth is ambiguous, and the supplier's register naming the subprocessor was published after the inventory was filed, so the filer had no Arcadia source at the time. A filing deficiency would assert a failure by a person who could not reasonably have known. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_CH_INVENTORY_ACCESS,
          value: "applicable-with-interpretation",
          note: "Applicable to ARC-CH. The absence of the subprocessor from the inventory filed 24.07.2026 is characterised as a scope definition question rather than a filing deficiency, because the standard is ambiguous on subcontracting depth and the supplier's register naming the subprocessor was published 03.08.2026, after the filing. A clarification to the standard is proposed: subprocessors of significant outsourcings are recorded where they have access to client identifying data. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "create-action",
          targetId: OBL_CH_INVENTORY_ACCESS,
          value: "Clarify the outsourcing inventory standard on subcontracting depth and data access",
          note: "Proposed clarification to Arcadia's own standard, with the inventory to be refiled once the scope is settled. Owner is the Regulatory Change Manager with the local resilience officer. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Filing deficiency, corrected by refiling the inventory",
      labelDe: "Meldeversaeumnis, behoben durch Neuvorlage des Verzeichnisses",
      description:
        "Characterise it as a filing deficiency, add the subprocessor and refile, and close the item. It is fast, it is unambiguous, and the inventory becomes correct today. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "The inventory is accurate immediately, which is worth something on its own. It leaves the scope ambiguity intact, so the same gap recurs at the next filing with the next unnotified subprocessor, and it records a failure against a person who had no Arcadia source naming the subprocessor. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_CH_INVENTORY_ACCESS,
          value: "applicable",
          note: "Applicable to ARC-CH. The inventory filed 24.07.2026 omits a subprocessor of a significant outsourcing and is refiled with the subprocessor added and its data access scope stated. The standard's ambiguity on subcontracting depth is noted and not addressed. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "create-action",
          targetId: OBL_CH_INVENTORY_ACCESS,
          value: "Refile the ARC-CH outsourcing inventory with the subprocessor added",
          note: "Corrective filing with the subprocessor, its location and its data access scope as stated by the supplier. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Both: refile now and clarify the standard separately",
      labelDe: "Beides: jetzt neu vorlegen und den Standard gesondert klarstellen",
      description:
        "Refile the inventory so it is accurate today, and separately open the scope clarification so the recurrence is addressed. Two items, two owners, no conflation of the instance with the cause. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Gets both the accurate inventory and the structural fix, which is the complete answer and the most work. Refiling before the scope is settled means the inventory may be refiled again once the standard changes, and the filer's position is recorded as corrected either way. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_CH_INVENTORY_ACCESS,
          value: "applicable-with-interpretation",
          note: "Applicable to ARC-CH. The inventory is refiled with the subprocessor added, and the standard's ambiguity on subcontracting depth is opened separately as a clarification. The instance and the cause are tracked as two items with two owners. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "create-action",
          targetId: OBL_CH_INVENTORY_ACCESS,
          value: "Refile the inventory and clarify the standard on subcontracting depth",
          note: "Two sub items. The refiling is immediate. The clarification is proposed to the standard owner with the inventory to be reviewed again once the scope is settled. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "request-evidence",
          targetId: TP_MERIDIAN,
          value: "Written statement of the data fields accessible to the service desk subprocessor and the jurisdictions from which access occurs, for the Swiss inventory entry",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0787", [
    {
      label: "Frame the stated position question and route it, answer nothing",
      labelDe: "Die Frage zur bereits abgegebenen Position praezise fassen und weiterleiten, nichts beantworten",
      description:
        "Record the seven obligation state changes per lane with none crossing, and route a precisely framed question to Group Legal and the Chief Compliance Officer on whether any position Arcadia has stated about its payment control environment now requires review. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Puts an interpretation question where interpretation authority sits, with the facts attached, rather than producing a compliance conclusion from a change function. It leaves an open question with no expected answer date, which is honest and unsatisfying. Illustrative regulatory context, not legal advice.",
      isRecommended: true,
      recommendationBasis:
        "Whether a previously stated position requires review is a legal and compliance judgment with consequences, and it is never a system or a change function output. The valuable contribution is a question framed so precisely that the right function can answer it without re-doing the fact gathering. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_INCIDENT_CLASSIFICATION,
          value: "applicable",
          note: "Four obligation state changes in the EU lane for ARC-DE and ARC-AT, three in the Swiss lane for ARC-CH, none crossing. Both incident classification assessments remain two separate records against two frameworks with no shared fields, and both carry an explicit reassessment trigger on receipt of the supplier report due 13.10.2026. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "request-factual-validation",
          targetId: CTL_FOUR_EYES,
          value: "stated position review",
          note: "A key control in the Internal Control System was waived by supplier configuration for route substitution overrides below EUR 250,000 while the fallback route was active, from 11.11.2024 to 06.10.2026, across 118 firings. Question for Group Legal and the Group Chief Compliance Officer: does any position Arcadia has stated, internally or externally, about its payment control environment require review in the light of that fact, and if so which. The facts are attached with their evidence references. This function does not answer this question. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "create-issue",
          targetId: TP_POLARIS,
          value: "Detection dependency raises a resilience obligation and not a register obligation",
          note: "The monitoring subprocessor is correctly recorded in the binding appendix and in the supplier register, so the 34 minute detection lag raises no register completeness question. It raises a resilience obligation about a single point of failure in the supplier's own incident detection. Stating the negative finding matters, because the register is the instinctive place to look and it is not the issue here. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Conclude that no stated position requires change and record the reasoning",
      labelDe: "Feststellen, dass keine abgegebene Position geaendert werden muss, und die Begruendung erfassen",
      description:
        "Record a determination that no stated position requires review, on the basis that the control existed, was tested and was concluded Partially Effective, and that nothing Arcadia stated asserted the control was effective in all system states. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Closes the question and lets the committee paper stand without a legal dependency. It is a compliance conclusion reached by the change function on a matter with supervisory consequences, which is outside this role's authority however well reasoned it is. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_INCIDENT_CLASSIFICATION,
          value: "applicable",
          note: "Seven obligation state changes recorded per lane with none crossing. Determination recorded that no previously stated position requires review, on the basis that the control was tested and concluded Partially Effective before the event. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Escalate it as a group compliance matter to the Chief Compliance Officer directly",
      labelDe: "Als Gruppen-Compliance-Thema direkt an den Compliance-Verantwortlichen eskalieren",
      description:
        "Take the whole matter to the Group Chief Compliance Officer as a standing item rather than as a framed question, on the basis that a key control waived by supplier configuration for 23 months is a compliance framework matter rather than an incident consequence. Illustrative regulatory context, not legal advice.",
      riskImplication:
        "Gets senior compliance attention on a structural finding rather than on an incident, which is where it belongs. It also escalates on the same day as an active incident, which puts a framework question into a room that is still handling an operational one. Illustrative regulatory context, not legal advice.",
      consequences: [
        {
          kind: "record-obligation-interpretation",
          targetId: OBL_INCIDENT_CLASSIFICATION,
          value: "applicable",
          note: "Seven obligation state changes recorded per lane with none crossing, and the control waiver escalated to the Group Chief Compliance Officer as a compliance framework matter. Illustrative regulatory context, not legal advice.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0787",
          value: "A key control in the Internal Control System waived by supplier configuration since 11.11.2024",
          note: "For decision. Raised as a compliance framework matter rather than as an incident consequence. The question is what assurance the group holds that other key controls dependent on supplier configuration behave as their descriptions state. Illustrative regulatory context, not legal advice.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  /* ----------------------------------------------------------------------
     nfr-governance
     ---------------------------------------------------------------------- */

  ...options("DEC-2026-0755", [
    {
      label: "One chain, presented as a hypothesis with the inferred links marked",
      labelDe: "Eine Kette, als Hypothese mit markierten abgeleiteten Verbindungen dargestellt",
      description:
        "Report the four Red indicators as one causal chain of seven nodes and six links, with the four evidenced links cited and the two inferred links marked as inferences, and state what evidence would confirm them.",
      riskImplication:
        "Gives the committee one problem to act on instead of four to note, which is the difference between a decision and a dashboard. Marking the inferences invites a chair to discount the whole chain, and the alternative presentation has produced no action in four quarters.",
      isRecommended: true,
      recommendationBasis:
        "The four indicators share one mechanism and four of the six links are evidenced from records. Presenting them separately is accurate and has demonstrably produced nothing; presenting the chain without marking the inferences would be more persuasive and less defensible.",
      consequences: [
        {
          kind: "set-portfolio-materiality",
          targetId: THEME_OVERRIDE,
          value: "high",
          note: "Four Red indicators across four functions recorded as one cross function theme with a seven node causal chain, four evidenced links and two inferred links marked as inferences.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0755",
          value: "Four Red indicators presented as one causal chain",
          note: "For decision. Gateway availability drove route substitution override growth, cut-off pressure drove cut-off override growth, reviewer establishment is 3.0 filled of 4.0 approved, the governing control is Partially Effective, the remediation that would have prevented one deviation is 67 days overdue, and the residual risk is outside appetite. Two of six links are inferred and are marked as such.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Four indicators, four owners, with a written commentary noting the connection",
      labelDe: "Vier Indikatoren, vier Verantwortliche, mit schriftlichem Hinweis auf den Zusammenhang",
      description:
        "Keep the existing reporting structure, route each indicator to its owner with the owner's own deadline, and add a portfolio commentary that states the connection without restructuring the report.",
      riskImplication:
        "Preserves indicator ownership and avoids a presentation argument with four owners at once. It also reproduces the reporting that has shown four Red rows every quarter without producing a single cross function action, and a commentary is read after the rows.",
      consequences: [
        {
          kind: "create-issue",
          targetId: KRI_OVERRIDE_RATE,
          value: "Portfolio commentary: four Red indicators share one mechanism",
          note: "Recorded as a portfolio observation against the indicator set rather than as a restructured report. Each indicator retains its owner and its own explanation deadline.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "One chain, and commission the evidence that would close the two inferred links",
      labelDe: "Eine Kette, und die Nachweise beschaffen, die die zwei abgeleiteten Verbindungen schliessen",
      description:
        "Present the chain and commission the two pieces of evidence that would close the inferences: a field linking override records to fallback activations, and an analysis of whether reviewer availability correlates with deviation dates.",
      riskImplication:
        "Converts a contestable presentation into an evidenced one within a quarter, which is the strongest long term position. The evidence does not exist before the papers close on 08.10.2026, so this quarter's committee still receives a marked hypothesis.",
      consequences: [
        {
          kind: "set-portfolio-materiality",
          targetId: THEME_OVERRIDE,
          value: "high",
          note: "Cross function theme recorded with a seven node causal chain and two inferred links, with evidence commissioned to close both.",
        },
        {
          kind: "create-action",
          targetId: KRI_OVERRIDE_RATE,
          value: "Commission the evidence that would close the two inferred links in the causal chain",
          note: "First, a field or a derived link connecting each override record to the fallback activation window in force when it was created, so the attribution stops being temporal correlation. Second, an analysis of reviewer availability against deviation dates, so the capacity link is either evidenced or withdrawn.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0755",
          value: "Four Red indicators as one causal chain, with two inferences to be closed",
          note: "For decision, with the two inferred links marked and the evidence to close them commissioned.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0756", [
    {
      label: "Re-condition the acceptance and disclose that the condition was never tracked",
      labelDe: "Akzeptanz neu bedingen und offenlegen, dass die Bedingung nie nachverfolgt wurde",
      description:
        "Recommend re-conditioning with dated, owned and tracked conditions, and disclose in the same paper that the original exit test condition was never tracked by the committee that imposed it.",
      riskImplication:
        "Keeps cover on the risk while making the condition real, and puts the governance failure on the record in the paper that reports it. It is the third deferral of assurance on this arrangement and the record does not show whether prior deferrals were met.",
      consequences: [
        {
          kind: "create-issue",
          targetId: RSK_THIRD_PARTY_SERVICE,
          value: "Risk acceptance operating on a condition that was never tracked",
          note: "The conditional Risikoakzeptanz of 19.01.2026 is conditioned on completing the 2026 reassessment and performing an exit test. The exit test is not started, has a 31.12.2026 date and no plan, and no committee follow up on the condition exists. The condition's purpose was to establish that the concentration position is exitable, and the exit plan relies on a capability Arcadia does not hold.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0756",
          value: "Re-condition the third party service risk acceptance with tracked conditions",
          note: "For decision. Recommendation is to re-condition rather than withdraw, with each condition dated, owned and reported monthly. The paper discloses that the original condition was never tracked by this committee.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Recommend withdrawal and force the executive decision now",
      labelDe: "Ruecknahme empfehlen und die Managemententscheidung jetzt erzwingen",
      description:
        "Recommend withdrawal on the basis that the condition has been defeated rather than delayed, which leaves the risk outside appetite with no cover and obliges the accountable executive to decide within the quarter.",
      riskImplication:
        "The only option that makes the unmet condition consequential. It also leaves a Medium-High risk uncovered on the group's most important payment service with no alternative arrangement available, and forces an executive decision the committee cannot usefully take at short notice.",
      consequences: [
        {
          kind: "create-issue",
          targetId: RSK_THIRD_PARTY_SERVICE,
          value: "Recommendation to withdraw a risk acceptance whose condition has been defeated",
          note: "The exit test condition cannot be met as drafted, because the exit plan relies on an internal payment repair capability Arcadia does not hold. A condition that cannot be met is defeated rather than delayed, and an acceptance resting on it provides no assurance.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0756",
          value: "Withdrawal of the third party service risk acceptance",
          note: "For decision. Withdrawal leaves the risk outside appetite with no cover and obliges a fresh executive decision before 31.12.2026. The alternative is an acceptance whose condition has been defeated.",
        },
        {
          kind: "send-collaboration-message",
          targetId: RSK_THIRD_PARTY_SERVICE,
          value: "Risk acceptance recommended for withdrawal",
          note: "The conditional Risikoakzeptanz on the third party payment service risk is recommended for withdrawal, because its exit test condition cannot be met as drafted. If withdrawn, the risk sits outside appetite with no cover and requires a fresh executive decision before 31.12.2026.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Leave it in force to expiry and rebuild the conditions for the 2027 acceptance",
      labelDe: "Bis zum Ablauf in Kraft lassen und die Bedingungen fuer 2027 neu aufbauen",
      description:
        "Leave the acceptance in force to its 31.12.2026 expiry, and put the effort into building a 2027 acceptance whose conditions are executable, tracked and reported, rather than into reopening one with 86 days to run.",
      riskImplication:
        "Avoids consuming committee attention on an instrument that expires in 86 days, and directs it at the successor. It also means the group operates for a quarter on an acceptance whose condition everyone now knows is defeated, which is the position that is hardest to explain afterwards.",
      consequences: [
        {
          kind: "create-action",
          targetId: RSK_THIRD_PARTY_SERVICE,
          value: "Build the 2027 risk acceptance conditions so that each is executable, owned and reported",
          note: "The 2026 acceptance expires 31.12.2026. The successor's conditions must be executable as drafted, which the exit test condition was not, and each must carry an owner, a date and a monthly report to the committee.",
        },
        {
          kind: "activate-monitoring",
          targetId: RSK_THIRD_PARTY_SERVICE,
          value: "risk",
          note: "Weekly monitoring of the risk position and of the two acceptance conditions until expiry, so the successor decision is taken on current facts.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0757", [
    {
      label: "Table the divergence, both positions in their owners' words",
      labelDe: "Die Divergenz vorlegen, beide Positionen in den Worten ihrer Vertreter",
      description:
        "Write the paper as a divergence paper, with the first line position as recorded on 29.09.2026 and the second line conclusion as issued, neither editorialised, and structure it so that new facts sharpen the question rather than invalidating it.",
      riskImplication:
        "Makes the committee do the work, which is what a committee is for, and preserves both positions intact. It exposes the portfolio lead to the question of why the second line could not settle a control rating, and it is indistinguishable from inaction in a status report.",
      isRecommended: true,
      recommendationBasis:
        "The supplier configuration that would settle the disputed element has been demanded and may arrive today, so an agreement reached before it arrives would be an agreement about nothing. Holding the divergence visible until the facts arrive is the correct governance act even though it looks like inaction.",
      consequences: [
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0757",
          value: "First and second line divergence on a key control in the Internal Control System",
          note: "For decision. Both positions are stated as their owners stated them. The paper is structured so that evidence arriving after it is written sharpens the question rather than invalidating it. The committee is asked to determine the control environment rating, because the appetite consequence differs on either side of a residual score of 10.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Push for resolution before the paper closes",
      labelDe: "Auf Klaerung vor Abschluss des Papiers draengen",
      description:
        "Convene the assurance owner and the control owner and press for a single agreed rating before 08.10.2026, so the committee receives a conclusion rather than a disagreement.",
      riskImplication:
        "Gives the committee something it can note and move past, which is what most committees prefer. A rating agreed under paper deadline pressure is likely to be a compromise nobody argued for, and a diluted control rating on a key control is worse than a visible disagreement.",
      consequences: [
        {
          kind: "send-collaboration-message",
          targetId: CTL_FOUR_EYES,
          value: "Resolution sought on the control rating before papers close",
          note: "The committee paper closes 08.10.2026 at 12:00 and currently carries an unresolved divergence on a key control in the Internal Control System. The assurance owner and the control owner are asked to reach an agreed position or to state precisely what evidence would settle it, by 07.10.2026.",
        },
      ],
      requiresApproval: false,
    },
    {
      label: "Table it and add the overdue remediation as the same item",
      labelDe: "Vorlegen und die ueberfaellige Massnahme als denselben Punkt aufnehmen",
      description:
        "Present the divergence and the overdue remediation action as one item, because the action would have prevented one of the exceptions the divergence is about, and separating them lets the committee treat each as smaller than it is.",
      riskImplication:
        "Makes the causal relationship unavoidable and gives the committee one decision instead of two notes. It also loads one agenda item with a control rating dispute and a peer's overdue delivery, which is a lot to ask a chair to hold in one discussion.",
      consequences: [
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0757",
          value: "Control rating divergence and the overdue remediation that bears on it",
          note: "For decision. The divergence concerns a key control with four exceptions. One of those exceptions is precisely the failure that a remediation action raised in November 2025 was intended to prevent, and that action is 67 days past its revised due date. The two are presented as one item because they are one matter.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0763", [
    {
      label: "Re-baseline to 31.10.2026, disclose the unmet condition, request prior extension reporting",
      labelDe: "Neuterminierung auf 31.10.2026, unerfuellte Bedingung offenlegen, Berichterstattung zu frueheren Verlaengerungen verlangen",
      description:
        "Recommend re-baselining to the proposed date, disclose in the same paper that the committee's own monthly reporting condition from April has been unmet since July, and add a request that the committee require completion reporting on all prior extensions.",
      riskImplication:
        "Defensible on the verified dependency chain and honest about the committee's own lapse. It is the third date on this action, and the third element will be read by some members as the secretary making work for the committee.",
      isRecommended: true,
      recommendationBasis:
        "The dependency chain is verified end to end and the action cannot close before the freeze ends on 14.10.2026 whatever anyone commits to. Reporting an owner's delay while concealing the committee's own lapsed condition would not be a governance paper, and the chair will find out.",
      consequences: [
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Re-baseline the role segregation remediation to 31.10.2026 with a root cause explanation",
          note: "Verified dependency chain: supplier change delivered to pre production 18.09.2026, Arcadia acceptance testing request of 22.09.2026 unanswered, infrastructure change freeze to 14.10.2026. The action cannot close before the freeze ends. The proposed date is achievable on that chain.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0763",
          value: "Overdue remediation at 67 days, re-baselining recommended, with two governance disclosures",
          note: "For decision. Re-baselining to 31.10.2026 on a verified dependency. First disclosure: the April extension was granted on a condition of monthly progress reporting to this committee, and no report has been made since July. Second request: that the committee require completion reporting on all prior extensions, because four second extensions have been granted in eight quarters and no record shows whether any was met.",
        },
        {
          kind: "send-collaboration-message",
          targetId: "MSN-2026-0147",
          value: "Re-baselining recommended to 31.10.2026 with the dependency stated",
          note: "The recommendation to the committee is re-baselining to 31.10.2026 rather than escalation to the entity board, on the basis that the delay is a verifiable infrastructure change freeze outside the owner's control. The paper also discloses that this committee's own monthly reporting condition has been unmet since July.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Escalate to the ARC-DE entity board",
      labelDe: "Eskalation an den Vorstand der Einheit ARC-DE",
      description:
        "Recommend escalation to the entity board as the escalation rule provides for an action more than 60 days past a revised due date, with a named accountable executive.",
      riskImplication:
        "Applies the rule as written and removes any suggestion that a peer relationship softened the recommendation. A board escalation on an action blocked by a verifiable infrastructure freeze will be read as procedural rather than substantive, which devalues the escalation route for the cases that need it.",
      consequences: [
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0763",
          value: "Escalation of an overdue remediation to the ARC-DE entity board",
          note: "For decision. The action is 67 days past its revised due date, which triggers the escalation rule. The accountable executive is named. The delay cause is a verifiable infrastructure change freeze to 14.10.2026, which the board should weigh.",
        },
        {
          kind: "create-issue",
          targetId: CTL_FOUR_EYES,
          value: "Role segregation remediation escalated at 67 days past its revised date",
          note: "Escalated under the rule covering actions more than 60 days past a revised due date. The enabling defect remains present and produced a test exception on 14.07.2026, 17 days before the revised due date.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Re-baseline and additionally require an interim compensating measure",
      labelDe: "Neuterminierung und zusaetzlich eine vorlaeufige Kompensationsmassnahme verlangen",
      description:
        "Recommend re-baselining and require an interim measure that reduces the exposure while the freeze runs: a manual check of role assignments in the supplier system, reported weekly until the system change is live.",
      riskImplication:
        "Addresses the exposure rather than the date, which is what the action was for. It adds a manual control to a team already at 3.0 filled reviewer FTE of 4.0 approved, and a manual compensating measure has a habit of outliving the system change it was meant to bridge.",
      consequences: [
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Re-baseline to 31.10.2026 with a weekly manual role assignment check as an interim measure",
          note: "Interim measure while the infrastructure freeze runs to 14.10.2026: a weekly check of RepairDesk role assignments per entity to identify any user holding both the Repair Analyst and the Secondary Reviewer assignment, reported to the control owner and the assurance owner.",
        },
        {
          kind: "activate-monitoring",
          targetId: CTL_FOUR_EYES,
          value: "control",
          note: "Weekly surveillance of dual role assignments in the supplier system until the segregation enforcement change is live in production.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0763",
          value: "Overdue remediation re-baselined with an interim compensating measure",
          note: "For decision. Re-baselining to 31.10.2026 with a weekly manual role assignment check in the interim, because the enabling defect remains present until the system change is live.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0781", [
    {
      label: "Write on verified facts and ask a question the supplier report cannot invalidate",
      labelDe: "Auf gesicherte Fakten schreiben und eine Frage stellen, die der Lieferantenbericht nicht entkraeften kann",
      description:
        "Write the papers on verified facts as at 08.10.2026, state every fact's class, and ask whether the group accepts that a supplier configurable rule can waive a key control in the Internal Control System without an Arcadia control owner review. Add a tenth agenda item as a decision item.",
      riskImplication:
        "Secures a decision this quarter on a question that stays answerable whatever the supplier report says. It asks the committee to decide on facts that are incomplete by design, and the chair may prefer to wait for the report and lose the quarter.",
      isRecommended: true,
      recommendationBasis:
        "The papers close 08.10.2026 and the supplier report arrives 13.10.2026, so any paper is written without the supplier's account of root cause. A question about what the group accepts, rather than about what caused the event, is answerable on the earlier facts and is not invalidated by the later ones.",
      consequences: [
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0781",
          value: "Supplier configurable control waivers: what the group accepts and what change it requires",
          note: "For decision, added 06.10.2026. The committee is not asked what caused the event, because the supplier report due 13.10.2026 will answer that. It is asked whether the group accepts that a supplier configurable rule can waive a key control in the Internal Control System without an Arcadia control owner review, and what change that requires in supplier release governance and control description maintenance. Every fact in the paper carries its class: verified fact, stakeholder statement or telemetry inference.",
        },
        {
          kind: "create-action",
          targetId: CTL_FOUR_EYES,
          value: "Write the committee papers on verified facts as at 08.10.2026 with every fact classed",
          note: "Papers close 08.10.2026 at 12:00. The last fact that will exist before then is the full examination of the 96 releases, due 07.10.2026 at 12:00. The supplier incident report due 13.10.2026 will not exist in time and the paper is structured so that its content cannot invalidate the decision requested.",
        },
        {
          kind: "send-collaboration-message",
          targetId: "CMT-NFR-2026-10",
          value: "Tenth agenda item added, papers written on verified facts",
          note: "A tenth agenda item is added as a decision item covering the event and the impact tolerance question. The papers are written on verified facts as at 08.10.2026 with every fact carrying its class. The supplier incident report is due on the morning of the meeting and the decision requested does not depend on it.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Table the event for information and seek the decision at the next meeting",
      labelDe: "Das Ereignis zur Information vorlegen und die Entscheidung in der naechsten Sitzung suchen",
      description:
        "Add the event as a noting item, present the verified facts, and bring the decision to the following meeting once the supplier report has been assessed.",
      riskImplication:
        "Avoids asking a committee to decide on incomplete facts and guarantees that the decision, when it comes, rests on the supplier's account. It loses a quarter on a matter with 96 affected payments and one confirmed erroneous release, and a noting item is where matters go to stop moving.",
      consequences: [
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0781",
          value: "Event of 06.10.2026 and the impact tolerance question, for information",
          note: "For noting. Verified facts as at 08.10.2026 with every fact carrying its class. The supplier incident report is due 13.10.2026 and a decision paper follows at the next meeting.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Seek an extraordinary meeting before the supplier report arrives",
      labelDe: "Eine ausserordentliche Sitzung vor dem Eintreffen des Lieferantenberichts anstreben",
      description:
        "Ask the chair for a short extraordinary session in the week of 19.10.2026, after the supplier report has been assessed, so the decision is taken on complete facts without losing a quarter.",
      riskImplication:
        "Gets both complete facts and a decision inside the quarter, if the chair and three members with an entity representative can be assembled. Extraordinary meetings are hard to quorate at short notice and asking for one signals that the scheduled meeting was not planned for.",
      consequences: [
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0781",
          value: "Event of 06.10.2026, for information, with an extraordinary session requested",
          note: "For noting at the scheduled meeting, with a request to the chair for a short extraordinary session in the week of 19.10.2026 to take the decision once the supplier incident report of 13.10.2026 has been assessed. Decision quorum requires the chair plus three members including an entity representative for any entity specific decision.",
        },
        {
          kind: "send-collaboration-message",
          targetId: "CMT-NFR-2026-10",
          value: "Extraordinary session requested for the week of 19.10.2026",
          note: "The event is tabled for information on 13.10.2026 and an extraordinary session is requested for the following week, so the decision can be taken once the supplier incident report has been assessed rather than on the morning it arrives.",
        },
      ],
      requiresApproval: true,
    },
  ]),

  ...options("DEC-2026-0784", [
    {
      label: "High, obliging a risk appetite discussion rather than another remediation action",
      labelDe: "Hoch, mit der Folge einer Risikoappetit-Diskussion statt einer weiteren Massnahme",
      description:
        "Record the theme's portfolio materiality as High on three structural grounds, and name the obligation that follows as a risk appetite discussion at the committee rather than an additional remediation action.",
      riskImplication:
        "Commits the committee to a discussion about what the group is willing to live with, on a day when it is already receiving eight new remediation actions. It also records a framework defect owned by this function, which is the part of the argument that cannot be delegated to payments.",
      consequences: [
        {
          kind: "set-portfolio-materiality",
          targetId: THEME_OVERRIDE,
          value: "high",
          note: "Three grounds. First, a supplier configurable rule waived a key control in the Internal Control System for 3 hours 56 minutes today and on seven prior occasions since 11.11.2024, admitted by Arcadia's own change approval. Second, the impact tolerance it breaches has a zero threshold and had no detection capability: the candidate breaches were found by an ad hoc query, not by a control. Third, one erroneous release is confirmed, which converts an assessed risk into a materialised one. The obligation is a risk appetite discussion, not another action.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0784",
          value: "Risk appetite discussion on supplier configurable controls and undetectable tolerance breaches",
          note: "For decision. The group holds a zero tolerance statement with no monitoring capable of detecting a breach of it, and a key control that a supplier configuration can switch off. The question is what the group is willing to live with, which is an appetite question rather than a remediation question.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "Medium, pending the full examination result",
      labelDe: "Mittel, bis zum Ergebnis der Vollpruefung",
      description:
        "Record the materiality as Medium until the examination of all 96 releases reports on 07.10.2026 at 12:00, on the basis that the scale of the consequence is the fact that most affects the portfolio position and it does not yet exist.",
      riskImplication:
        "Avoids a High materiality that may rest on a single confirmed error, and the figure will exist before the papers close. It also risks the committee receiving a Medium theme on a matter with a confirmed erroneous payment and a waived key control, which will be read as understated if the examination finds more.",
      consequences: [
        {
          kind: "set-portfolio-materiality",
          targetId: THEME_OVERRIDE,
          value: "medium",
          note: "Provisional pending the full examination of the 96 releases due 07.10.2026 at 12:00. The control failure is established and the scale of its consequence is not. The materiality is re-assessed on the examination result before the papers close on 08.10.2026.",
        },
        {
          kind: "activate-monitoring",
          targetId: THEME_OVERRIDE,
          value: "portfolio-theme",
          note: "Daily review of the theme until the examination result is available, so that the materiality can be finalised on the best facts that will exist before the papers close.",
        },
      ],
      requiresApproval: true,
    },
    {
      label: "High, with the framework defect carried as the portfolio lead's own action",
      labelDe: "Hoch, mit dem Rahmenwerksmangel als eigener Massnahme der Portfolioleitung",
      description:
        "Record High and take the framework defect as this function's own action rather than routing it to payments: a zero tolerance statement with no detection capability is a defect in the group's framework, not in the process the tolerance applies to.",
      riskImplication:
        "Puts the governance failure where it belongs and makes the portfolio lead accountable for fixing it, which is the least comfortable and most credible allocation. It also means the same function that records the theme's materiality owns one of the actions arising from it.",
      consequences: [
        {
          kind: "set-portfolio-materiality",
          targetId: THEME_OVERRIDE,
          value: "high",
          note: "High on the control failure, the undetectable tolerance breach and the confirmed erroneous release. The framework defect is owned by the portfolio function rather than by payment operations.",
        },
        {
          kind: "create-action",
          targetId: ITOL_ZERO_GATE,
          value: "Build detection capability for every zero tolerance impact tolerance in the group",
          note: "Owned by the portfolio function. The zero tolerance statement on control gates had no monitoring capable of detecting a breach, which is why 96 candidate breaches were found by an ad hoc query at 14:34 rather than by a control. Every zero tolerance statement in the group is reviewed for the same defect.",
        },
        {
          kind: "add-committee-item",
          targetId: "DEC-2026-0784",
          value: "A zero tolerance statement with no detection capability",
          note: "For decision. The group's framework carries a tolerance with a threshold of zero and no monitoring able to detect a breach. The defect is the portfolio function's own and the remedy is owned there.",
        },
      ],
      requiresApproval: true,
    },
  ]),
];

/* ==========================================================================
   Pre existing issues

   Issues that were open before 06.10.2026. Each carries the business
   reference of the object it came from, because an issue register entry is
   never the primary record: the test exception, the questionnaire item or
   the audit finding is.
   ========================================================================== */

export const issues: NewIssue[] = [
  {
    id: "ISS-2026-0311",
    runId: DEFAULT_RUN_ID,
    reference: "TST-2026-0318-CTL-GAP",
    title: "CTL-PAY-014 concluded Partially Effective with a disputed first line position",
    titleDe: "CTL-PAY-014 als teilweise wirksam beurteilt, Position der ersten Linie abweichend",
    description:
      "The combined design and operating effectiveness test on the independent secondary review control returned four exceptions and two items on which the tester could not conclude, against a tolerable deviation rate of 5 in 100. The second line conclusion is Partially Effective. The control owner recorded a Fully Effective position on 29.09.2026 with a three line rationale. The divergence blocks the Q4 assessment's control environment rating.",
    kind: "control-gap",
    raisedByUserId: "P-004",
    raisedOn: "2026-09-25",
    entityId: ENTITY_DE,
    severity: "high",
    status: "open",
    ownerUserId: "P-008",
    dueOn: "2026-10-16",
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    controlIds: [CTL_FOUR_EYES, CTL_DUTY_SAMPLE, CTL_VALUE_RECON],
    supplierIds: [TP_NOVALINK],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0312",
    runId: DEFAULT_RUN_ID,
    reference: "UTC-TST-2026-0318-01-AUDIT-TRAIL",
    title: "Audit trail on a key control is unrecoverable for bulk approvals",
    titleDe: "Pruefpfad einer Schluesselkontrolle bei Sammelfreigaben nicht wiederherstellbar",
    description:
      "For one test item the recorded secondary reviewer is a supplier service account used by the bulk approval screen. The underlying human identity was held in a supplier application log with 30 day retention, which expired before the question was asked. The item is unresolvable and the mechanism affects a screen used routinely rather than exceptionally.",
    kind: "control-gap",
    raisedByUserId: "P-004",
    raisedOn: "2026-09-25",
    entityId: ENTITY_DE,
    severity: "high",
    status: "open",
    ownerUserId: "P-002",
    dueOn: "2026-11-30",
    relatedObjectKind: "test-case",
    relatedObjectId: UTC_SERVICE_ACCOUNT,
    controlIds: [CTL_FOUR_EYES],
    supplierIds: [TP_NOVALINK],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0298",
    runId: DEFAULT_RUN_ID,
    reference: "CTR-2023-0117-A3-DIVERGENCE",
    title: "Binding subprocessor appendix does not match the supplier's current register",
    titleDe: "Verbindliche Anlage zu Unterauftragnehmern weicht vom aktuellen Register des Lieferanten ab",
    description:
      "The binding appendix lists three subprocessors with the primary hosting region only. The supplier's register of 03.08.2026 lists four, including a service desk provider in a third country holding read access to payment metadata, and a second hosting region for a listed subprocessor. Fourth parties are not addressed by the appendix at all. No notice is on record for either divergence.",
    kind: "supplier-gap",
    raisedByUserId: "P-002",
    raisedOn: "2026-09-21",
    entityId: ENTITY_DE,
    severity: "high",
    status: "in-remediation",
    ownerUserId: "P-002",
    dueOn: "2026-11-13",
    relatedObjectKind: "contract",
    relatedObjectId: "CTR-2023-0117-A3",
    controlIds: [],
    supplierIds: [TP_NOVALINK, TP_MERIDIAN],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0276",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026-R07-RTO",
    title: "Recovery time objective is not met by the supplier's own test",
    titleDe: "Wiederherstellungsziel wird durch den eigenen Test des Lieferanten nicht erreicht",
    description:
      "The service description states a recovery objective of 2 hours for the payment repair service. The supplier's own test report of 22.05.2026 shows recovery in 3 hours 40 minutes, with no explanation, no remediation plan and no notification to Arcadia. The report covers two hosting regions and does not cover the Swiss instance, so the Swiss position is unmeasured.",
    kind: "resilience-gap",
    raisedByUserId: "P-002",
    raisedOn: "2026-09-18",
    entityId: ENTITY_DE,
    severity: "high",
    status: "open",
    ownerUserId: "P-002",
    dueOn: "2026-10-31",
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    controlIds: [],
    supplierIds: [TP_NOVALINK],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0277",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026-R11-EXIT",
    title: "Exit plan relies on a capability Arcadia does not hold",
    titleDe: "Ausstiegsplan setzt eine Faehigkeit voraus, die Arcadia nicht besitzt",
    description:
      "The exit and transition appendix assumes Arcadia can operate a payment repair queue on an internal tool. The capability register shows no such tool. The plan is therefore unexecutable as written, on a Tier 1 sole provider with a 12 month notice period and a substitution horizon assessed at 12 to 18 months. No exit or substitutability test has ever been performed.",
    kind: "resilience-gap",
    raisedByUserId: "P-002",
    raisedOn: "2026-09-18",
    entityId: ENTITY_DE,
    severity: "high",
    status: "open",
    ownerUserId: "P-002",
    dueOn: "2026-12-31",
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    controlIds: [],
    supplierIds: [TP_NOVALINK],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0279",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026-R19-SCOPE",
    title: "Penetration test summary is silent on the override interfaces",
    titleDe: "Zusammenfassung des Penetrationstests schweigt zu den Ueberschreibungsschnittstellen",
    description:
      "A two page summary was provided in place of the full report, which is withheld on confidentiality grounds. The summary's scope statement does not confirm whether the override interfaces of the payment repair system were in scope. Arcadia therefore cannot tell whether the highest privilege function in the process was tested. The response has been rejected twice.",
    kind: "supplier-gap",
    raisedByUserId: "P-002",
    raisedOn: "2026-09-22",
    entityId: ENTITY_DE,
    severity: "medium",
    status: "open",
    ownerUserId: "P-002",
    dueOn: "2026-10-31",
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    controlIds: [CTL_FOUR_EYES],
    supplierIds: [TP_NOVALINK],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0285",
    runId: DEFAULT_RUN_ID,
    reference: "RB-PAY-007-S4-ASSERTION",
    title: "Runbook asserts an unchanged control environment during fallback operation",
    titleDe: "Handbuch behauptet ein unveraendertes Kontrollumfeld im Ausweichbetrieb",
    description:
      "Section 4 of the clearing route substitution runbook states that the control environment is unchanged during fallback operation. Reconciliation against the eleven controls mapped to the payment repair process identifies the secondary review control as conditional on system state, which contradicts the assertion. The assertion is a documented control claim with no recorded verification.",
    kind: "resilience-gap",
    raisedByUserId: "P-005",
    raisedOn: "2026-09-29",
    entityId: ENTITY_DE,
    severity: "medium",
    status: "open",
    ownerUserId: "P-007",
    dueOn: "2026-10-20",
    relatedObjectKind: "runbook",
    relatedObjectId: "RB-PAY-007",
    controlIds: [CTL_FOUR_EYES],
    supplierIds: [],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0288",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-RES-005-IBS-0004",
    title: "Corporate payments fallback arrangement has never been tested",
    titleDe: "Ausweichvorkehrung fuer Firmenkundenzahlungen wurde nie geprueft",
    description:
      "The fallback clearing route for corporate payments has been used five times in September for a total of 8 hours 40 minutes and has never been tested under observation. The last severe but plausible exercise, on 18.11.2025, tested a total gateway outage rather than fallback mode operation. The Swiss entity has no fallback route at all and its manual correspondent option has no recorded rehearsal.",
    kind: "resilience-gap",
    raisedByUserId: "P-005",
    raisedOn: "2026-10-01",
    entityId: ENTITY_DE,
    severity: "high",
    status: "open",
    ownerUserId: "P-005",
    dueOn: "2026-12-31",
    relatedObjectKind: "kri",
    relatedObjectId: KRI_TESTED_FALLBACK,
    controlIds: [],
    supplierIds: [TP_NOVALINK],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0292",
    runId: DEFAULT_RUN_ID,
    reference: "REG-2026-0031-CHAIN",
    title: "Register of information completeness gap sits in the subcontracting chain fields",
    titleDe: "Vollstaendigkeitsluecke im Informationsregister liegt in den Feldern zur Unterauftragskette",
    description:
      "Tier 1 completeness for the register of information is reported as a single percentage that conceals a structural gap: the incomplete records are the subcontracting chain fields on three Tier 1 arrangements, including the payment services provider. A completeness figure that barely moves while the structure improves is evidence that the figure is the wrong measure. Illustrative regulatory context, not legal advice. Applies to ARC-DE and ARC-AT.",
    kind: "obligation-gap",
    raisedByUserId: "P-006",
    raisedOn: "2026-09-14",
    entityId: ENTITY_DE,
    severity: "medium",
    status: "in-remediation",
    ownerUserId: "P-006",
    dueOn: "2026-11-28",
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_EU_SUBCONTRACTING,
    controlIds: [],
    supplierIds: [TP_NOVALINK, TP_MERIDIAN],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0294",
    runId: DEFAULT_RUN_ID,
    reference: "REG-2026-0088-INVENTORY",
    title: "Swiss outsourcing inventory omits a subprocessor with payment data access",
    titleDe: "Schweizer Auslagerungsverzeichnis enthaelt einen Unterauftragnehmer mit Zahlungsdatenzugang nicht",
    description:
      "The Swiss outsourcing inventory filed on 24.07.2026 does not contain the service desk subprocessor onboarded on 01.05.2026, which holds read access to payment metadata including beneficiary name and reference fields. The standard's text on subcontracting depth is ambiguous, so whether the inventory should contain it is an interpretation question rather than a filing failure. Illustrative regulatory context, not legal advice. Applies to ARC-CH only.",
    kind: "obligation-gap",
    raisedByUserId: "P-006",
    raisedOn: "2026-09-28",
    entityId: ENTITY_CH,
    severity: "medium",
    status: "open",
    ownerUserId: "P-006",
    dueOn: "2026-11-14",
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_CH_INVENTORY_ACCESS,
    controlIds: [],
    supplierIds: [TP_MERIDIAN],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0301",
    runId: DEFAULT_RUN_ID,
    reference: "RSK-0184-ACCEPTANCE-CONDITION",
    title: "Live risk acceptance is operating on an unmet condition",
    titleDe: "Gueltige Risikoakzeptanz beruht auf einer unerfuellten Bedingung",
    description:
      "The conditional Risikoakzeptanz of 19.01.2026 on the third party payment service risk is valid to 31.12.2026 and is conditioned on completing the 2026 reassessment and performing an exit test. The exit test is not started, has a 31.12.2026 date and no plan, and the committee that imposed the condition has no follow up record on it.",
    kind: "finding",
    raisedByUserId: "P-001",
    raisedOn: "2026-09-30",
    entityId: ENTITY_DE,
    severity: "high",
    status: "open",
    ownerUserId: "P-001",
    dueOn: "2026-12-31",
    relatedObjectKind: "risk",
    relatedObjectId: RSK_THIRD_PARTY_SERVICE,
    controlIds: [],
    supplierIds: [TP_NOVALINK],
    createdBySession: false,
  },
  {
    id: "ISS-2026-0305",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-011-ESTABLISHMENT",
    title: "Secondary reviewer establishment has been below threshold since 01.08.2026",
    titleDe: "Sollbesetzung der Zweitpruefer liegt seit 01.08.2026 unter dem Schwellenwert",
    description:
      "One of four approved secondary reviewer positions has been vacant since 31.07.2026. The establishment indicator has been Red since 01.08.2026. Recruitment was approved on 12.08.2026, two candidates were rejected and there is no start date. The consequence is a concentration of second reviews on a single senior analyst, which is visible in the control test population.",
    kind: "control-gap",
    raisedByUserId: "P-003",
    raisedOn: "2026-08-14",
    entityId: ENTITY_DE,
    severity: "medium",
    status: "open",
    ownerUserId: "P-007",
    dueOn: "2026-10-31",
    relatedObjectKind: "kri",
    relatedObjectId: "KRI-PAY-011",
    controlIds: [CTL_FOUR_EYES],
    supplierIds: [],
    createdBySession: false,
  },
];

/* ==========================================================================
   Pre existing actions

   Thirty four rows, all created before the scenario day, all with
   createdBySession false. The Massnahmen raised by the day's decisions are
   not seeded here: they are created by the consequence chains above, which
   is the point of the execution receipt.

   Two rows carry status "overdue" and are named in the scenario: the role
   segregation enforcement action at 67 days, and the reviewer recruitment
   action at 6 days. Five further overdue rows exist so that the group
   overdue count is genuinely seven, and they carry no invented detail,
   because the bible fixes them as a count only.

   Four rows carry isUnowned. Unowned actions are what the portfolio lead
   surfaces, and an unowned action is not a data quality defect in the seed:
   it is the finding.
   ========================================================================== */

export const actions: NewAction[] = [
  /*
   * The overdue action of the scenario. Bible section 11.1. The exception it
   * would have prevented occurred 17 days before its revised due date, which
   * is the fact that turns a delivery delay into a control finding.
   */
  {
    id: "MSN-2026-0147",
    runId: DEFAULT_RUN_ID,
    reference: "AUD-2025-09-F3",
    title:
      "Implement role segregation enforcement in RepairDesk so that an override creator cannot be recorded as the secondary reviewer",
    titleDe: "Durchsetzung der Funktionstrennung in RepairDesk",
    description:
      "Source is internal audit report AUD-2025-09 on Payment Operations, issued 28.11.2025, finding F3. The supplier change request was delivered to pre production on 18.09.2026. Arcadia acceptance testing is not scheduled because the payment testing environment refresh is blocked by an unrelated infrastructure change freeze in place to 14.10.2026. Original due date 31.03.2026; revised to 31.07.2026 with one extension approved by the committee on 14.04.2026.",
    kind: "remediation",
    issueId: "ISS-2026-0311",
    raisedByRoleId: "control-assurance",
    ownerUserId: "P-007",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2025-11-28",
    dueOn: "2026-07-31",
    completedOn: null,
    status: "overdue",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote:
      "Supplier change delivered to pre production 18.09.2026. Acceptance testing request of 22.09.2026 unanswered. Infrastructure change freeze to 14.10.2026 blocks the environment refresh. Owner reports 60 of 100 complete; the verifiable facts are the delivery note and the unanswered testing request.",
  },
  {
    id: "MSN-2026-0166",
    runId: DEFAULT_RUN_ID,
    reference: "PR-SR-02",
    title: "Recruit to secondary reviewer position PR-SR-02",
    titleDe: "Besetzung der Zweitprueferstelle PR-SR-02",
    description:
      "The position has been vacant since 31.07.2026. Recruitment was approved on 12.08.2026. Two candidates were rejected at second interview and there is no start date. The vacancy is the reason the establishment indicator is Red and the reason second reviews concentrate on one senior analyst.",
    kind: "remediation",
    issueId: "ISS-2026-0305",
    raisedByRoleId: "rcsa",
    ownerUserId: "P-007",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-08-12",
    dueOn: "2026-09-30",
    completedOn: null,
    status: "overdue",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "kri",
    relatedObjectId: "KRI-PAY-011",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Two candidate rejections at second interview. No offer outstanding and no start date.",
  },
  {
    id: "MSN-2026-0203",
    runId: DEFAULT_RUN_ID,
    reference: "EXC-TST-2026-0318-04",
    title:
      "Update the CTL-PAY-014 control description to document all system enforced review conditions, including any waiver rules configured in RepairDesk",
    titleDe: "Kontrollbeschreibung CTL-PAY-014 um alle systemseitig erzwungenen Pruefbedingungen ergaenzen",
    description:
      "Raised on 25.09.2026 as a low priority documentation item from the fourth test exception, whose root cause was recorded as system configuration and not pursued. The control description has asserted that review applies to all overrides without exception since 14.01.2025, which is two months after the release that introduced the waiver rule.",
    kind: "remediation",
    issueId: "ISS-2026-0311",
    raisedByRoleId: "control-assurance",
    ownerUserId: "P-008",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-25",
    dueOn: "2026-10-30",
    completedOn: null,
    status: "open",
    priority: "low",
    isUnowned: false,
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Not started. Open and untouched since 25.09.2026.",
  },
  {
    id: "MSN-2026-0188",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026-R04",
    title: "Obtain and assess disaster recovery evidence for the RepairDesk Swiss instance",
    titleDe: "Nachweise zur Notfallwiederherstellung der Schweizer RepairDesk-Instanz beschaffen und bewerten",
    description:
      "The supplier recovery test report of 22.05.2026 covers the Frankfurt and Amsterdam regions only. The Swiss instance is hosted at a separate subprocessor and has no recovery evidence, which means a significant outsourcing for the Swiss entity is unevidenced on recovery.",
    kind: "evidence-request",
    issueId: "ISS-2026-0276",
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "",
    entityId: ENTITY_CH,
    createdOn: "2026-09-18",
    dueOn: "2026-10-20",
    completedOn: null,
    status: "in-progress",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Request issued. Supplier has acknowledged and has not produced Swiss instance evidence.",
  },
  {
    id: "MSN-2026-0191",
    runId: DEFAULT_RUN_ID,
    reference: "CTR-2023-0117-A3",
    title:
      "Reconcile the binding subprocessor appendix against the supplier's current register and agree a contract variation",
    titleDe: "Verbindliche Anlage zu Unterauftragnehmern mit dem aktuellen Register abstimmen und Vertragsaenderung vereinbaren",
    description:
      "Four row divergence between the binding appendix of 14.02.2025 and the supplier register of 03.08.2026: one undisclosed subprocessor in a third country with payment metadata access, one undisclosed hosting region for a listed subprocessor, and fourth parties not addressed by the appendix as drafted.",
    kind: "remediation",
    issueId: "ISS-2026-0298",
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-21",
    dueOn: "2026-11-13",
    completedOn: null,
    status: "in-progress",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "contract",
    relatedObjectId: "CTR-2023-0117-A3",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote:
      "Divergence table drafted. Group Legal engaged on which appendix version binds. Commercial owner engaged on the variation route. No notice found in the contract repository or the two shared mailboxes.",
  },
  {
    id: "MSN-2026-0177",
    runId: DEFAULT_RUN_ID,
    reference: "RSK-0184-CONDITION",
    title: "Perform an exit and substitutability test for the RepairDesk payment repair service",
    titleDe: "Ausstiegs- und Substituierbarkeitstest fuer die Zahlungsreparaturdienstleistung durchfuehren",
    description:
      "Condition of the conditional Risikoakzeptanz of 19.01.2026 on the third party payment service risk. Not started. The exit appendix assumes Arcadia can operate a payment repair queue on an internal tool, and the capability register shows no such tool, so the test cannot be designed against the plan as written.",
    kind: "exercise-action",
    issueId: "ISS-2026-0277",
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-01-19",
    dueOn: "2026-12-31",
    completedOn: null,
    status: "open",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "risk",
    relatedObjectId: RSK_THIRD_PARTY_SERVICE,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Not started. No plan and no resourcing request on record.",
  },

  /*
   * Five further overdue Massnahmen. The group overdue count of seven is a
   * seeded fact that the governance role reports, so the rows have to exist.
   * The bible fixes these five as outside the scenario's scope and requires
   * that no detail be invented for them, so each carries only what the count
   * needs: an identifier, an owning function, an age and a status.
   */
  {
    id: "MSN-2026-0102",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-OVERDUE-03",
    title: "Overdue remediation action outside the payments scope of this scenario",
    titleDe: "Ueberfaellige Massnahme ausserhalb des Zahlungsverkehrsbereichs dieses Szenarios",
    description:
      "Counted in the group overdue total and not modelled further. The scenario fixes the group overdue count at seven, of which two relate to corporate payments. This row exists so the count is a query result rather than a written number, and it deliberately carries no invented detail.",
    kind: "remediation",
    issueId: null,
    raisedByRoleId: "nfr-governance",
    ownerUserId: null,
    ownerLabel: "Group Risk, function outside this scenario",
    entityId: ENTITY_DE,
    createdOn: "2026-02-10",
    dueOn: "2026-06-30",
    completedOn: null,
    status: "overdue",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Not modelled. Counted only.",
  },
  {
    id: "MSN-2026-0119",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-OVERDUE-04",
    title: "Overdue remediation action outside the payments scope of this scenario",
    titleDe: "Ueberfaellige Massnahme ausserhalb des Zahlungsverkehrsbereichs dieses Szenarios",
    description: "Counted in the group overdue total and not modelled further. No invented detail.",
    kind: "remediation",
    issueId: null,
    raisedByRoleId: "nfr-governance",
    ownerUserId: null,
    ownerLabel: "Group Risk, function outside this scenario",
    entityId: ENTITY_AT,
    createdOn: "2026-03-04",
    dueOn: "2026-07-15",
    completedOn: null,
    status: "overdue",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Not modelled. Counted only.",
  },
  {
    id: "MSN-2026-0131",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-OVERDUE-05",
    title: "Overdue remediation action outside the payments scope of this scenario",
    titleDe: "Ueberfaellige Massnahme ausserhalb des Zahlungsverkehrsbereichs dieses Szenarios",
    description: "Counted in the group overdue total and not modelled further. No invented detail.",
    kind: "remediation",
    issueId: null,
    raisedByRoleId: "nfr-governance",
    ownerUserId: null,
    ownerLabel: "Group Risk, function outside this scenario",
    entityId: ENTITY_CH,
    createdOn: "2026-03-27",
    dueOn: "2026-08-14",
    completedOn: null,
    status: "overdue",
    priority: "low",
    isUnowned: false,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Not modelled. Counted only.",
  },
  {
    id: "MSN-2026-0158",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-OVERDUE-06",
    title: "Overdue remediation action outside the payments scope of this scenario",
    titleDe: "Ueberfaellige Massnahme ausserhalb des Zahlungsverkehrsbereichs dieses Szenarios",
    description: "Counted in the group overdue total and not modelled further. No invented detail.",
    kind: "remediation",
    issueId: null,
    raisedByRoleId: "nfr-governance",
    ownerUserId: null,
    ownerLabel: "Group Risk, function outside this scenario",
    entityId: ENTITY_DE,
    createdOn: "2026-05-19",
    dueOn: "2026-08-31",
    completedOn: null,
    status: "overdue",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Not modelled. Counted only.",
  },
  {
    id: "MSN-2026-0172",
    runId: DEFAULT_RUN_ID,
    reference: "GOV-OVERDUE-07",
    title: "Overdue remediation action outside the payments scope of this scenario",
    titleDe: "Ueberfaellige Massnahme ausserhalb des Zahlungsverkehrsbereichs dieses Szenarios",
    description: "Counted in the group overdue total and not modelled further. No invented detail.",
    kind: "remediation",
    issueId: null,
    raisedByRoleId: "nfr-governance",
    ownerUserId: null,
    ownerLabel: "Group Risk, function outside this scenario",
    entityId: ENTITY_DE,
    createdOn: "2026-06-22",
    dueOn: "2026-09-15",
    completedOn: null,
    status: "overdue",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Not modelled. Counted only.",
  },

  /* Unowned actions. These are the rows the portfolio lead surfaces. */
  {
    id: "MSN-2026-0199",
    runId: DEFAULT_RUN_ID,
    reference: "PRC-0041-INVENTORY",
    title: "Map the payment repair control inventory to system state dependencies",
    titleDe: "Kontrollinventar der Zahlungsreparatur auf Systemzustandsabhaengigkeiten abbilden",
    description:
      "Raised from the 2025 control inventory review. Eleven controls are mapped to the payment repair process and none of them records whether its enforcement depends on a system state. The action was raised, agreed and never assigned, which is why nobody could answer the fallback control question when it was asked.",
    kind: "remediation",
    issueId: "ISS-2026-0285",
    raisedByRoleId: "control-assurance",
    ownerUserId: null,
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-04-16",
    dueOn: "2026-09-30",
    completedOn: null,
    status: "open",
    priority: "medium",
    isUnowned: true,
    relatedObjectKind: "process",
    relatedObjectId: PRC_REPAIR,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "No owner assigned since the action was raised on 16.04.2026.",
  },
  {
    id: "MSN-2026-0201",
    runId: DEFAULT_RUN_ID,
    reference: "IBS-0004-SBP-2026",
    title: "Schedule the 2026 severe but plausible exercise for corporate payments",
    titleDe: "Uebung schwerer aber plausibler Szenarien 2026 fuer Firmenkundenzahlungen ansetzen",
    description:
      "The last exercise on this important business service was 18.11.2025 and tested a total gateway outage. The 2026 exercise was placed in the annual plan and never scheduled or assigned. This is the reason the tested fallback indicator counts the service as untested.",
    kind: "exercise-action",
    issueId: "ISS-2026-0288",
    raisedByRoleId: "incident-resilience",
    ownerUserId: null,
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-01-30",
    dueOn: "2026-11-30",
    completedOn: null,
    status: "open",
    priority: "high",
    isUnowned: true,
    relatedObjectKind: "service",
    relatedObjectId: "SVC-0042-01",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "In the annual plan and not scheduled. No owner and no resourcing request.",
  },
  {
    id: "MSN-2026-0196",
    runId: DEFAULT_RUN_ID,
    reference: "RB-PAY-011-REHEARSAL",
    title: "Rehearse the Swiss manual correspondent submission route",
    titleDe: "Manuelle Korrespondenzroute der Schweiz ueben",
    description:
      "The Swiss manual submission runbook states a 45 minute preparation lead time. It was last reviewed 14.01.2026 and has no recorded rehearsal, so the lead time is asserted rather than measured. The action was raised at the resilience working group and left unassigned.",
    kind: "exercise-action",
    issueId: "ISS-2026-0288",
    raisedByRoleId: "incident-resilience",
    ownerUserId: null,
    ownerLabel: "",
    entityId: ENTITY_CH,
    createdOn: "2026-02-24",
    dueOn: "2026-10-31",
    completedOn: null,
    status: "open",
    priority: "high",
    isUnowned: true,
    relatedObjectKind: "runbook",
    relatedObjectId: "RB-PAY-011",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Raised 24.02.2026 at the resilience working group. No owner assigned.",
  },
  {
    id: "MSN-2026-0205",
    runId: DEFAULT_RUN_ID,
    reference: "AUD-2025-09-F1",
    title: "Close the documentation items from internal audit finding AUD-2025-09-F1",
    titleDe: "Dokumentationspunkte aus der Revisionsfeststellung AUD-2025-09-F1 abschliessen",
    description:
      "Documentation items from the 2025 Payment Operations audit that were agreed with management and never allocated. They sit alongside finding F3, which produced the role segregation action that is now 67 days overdue.",
    kind: "remediation",
    issueId: null,
    raisedByRoleId: "nfr-governance",
    ownerUserId: null,
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2025-11-28",
    dueOn: "2026-06-30",
    completedOn: null,
    status: "open",
    priority: "low",
    isUnowned: true,
    relatedObjectKind: "audit-report",
    relatedObjectId: "AUD-2025-09",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Agreed with management 28.11.2025. No owner assigned since.",
  },

  /* Open and in progress work across the six functions. */
  {
    id: "MSN-2026-0181",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-014-MONITORING",
    title: "Monthly monitoring review of manual override volumes and review completion",
    titleDe: "Monatliche Ueberwachungspruefung der Ueberschreibungsvolumina und Pruefungsabschluesse",
    description:
      "Standing monthly monitoring review attached to the secondary review control. The September review was completed on 02.10.2026 and did not decompose override volumes by reason code, which is why the component growth was not visible before the indicator breached.",
    kind: "monitoring",
    issueId: "ISS-2026-0311",
    raisedByRoleId: "rcsa",
    ownerUserId: "P-008",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-01-05",
    dueOn: "2026-11-02",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "September review completed 02.10.2026 without a reason code decomposition.",
  },
  {
    id: "MSN-2026-0184",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026-R19",
    title: "Obtain a penetration test scope statement confirming coverage of the override interfaces",
    titleDe: "Umfangserklaerung zum Penetrationstest mit Abdeckung der Ueberschreibungsschnittstellen beschaffen",
    description:
      "The two page summary provided does not state whether the override interfaces were in scope. The request has been rejected twice at working level and escalated to the supplier's client service director on 05.10.2026.",
    kind: "evidence-request",
    issueId: "ISS-2026-0279",
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "Novalink client service, M. Falk",
    entityId: ENTITY_DE,
    createdOn: "2026-09-22",
    dueOn: "2026-10-16",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Rejected twice at working level. Escalated 05.10.2026. Fourteen days old.",
  },
  {
    id: "MSN-2026-0186",
    runId: DEFAULT_RUN_ID,
    reference: "UTC-TST-2026-0318-02",
    title: "Restore the moved evidence object for the second unable to conclude item",
    titleDe: "Verschobenes Nachweisobjekt fuer den zweiten nicht beurteilbaren Sachverhalt wiederherstellen",
    description:
      "A review record exists with a named human reviewer and the attached evidence object is a broken link in the supplier evidence store, following a retention job on 01.09.2026. The supplier acknowledged the retention job on 22.09.2026 and has committed to restore from archive by 10.10.2026.",
    kind: "evidence-request",
    issueId: "ISS-2026-0312",
    raisedByRoleId: "control-assurance",
    ownerUserId: "P-004",
    ownerLabel: "Novalink service operations",
    entityId: ENTITY_DE,
    createdOn: "2026-09-16",
    dueOn: "2026-10-10",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "test-case",
    relatedObjectId: "UTC-TST-2026-0318-02",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Supplier acknowledged 22.09.2026 with a restore commitment of 10.10.2026. Two business days of float.",
  },
  {
    id: "MSN-2026-0193",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-011-START-DATE",
    title: "Confirm a start date for the vacant secondary reviewer position",
    titleDe: "Eintrittstermin fuer die offene Zweitprueferstelle bestaetigen",
    description:
      "The establishment indicator has been Red since 01.08.2026 and the recruitment action has no start date. A confirmed start date is required before the residual risk assessment can treat the capacity position as improving.",
    kind: "validation-request",
    issueId: "ISS-2026-0305",
    raisedByRoleId: "rcsa",
    ownerUserId: "P-007",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-08",
    dueOn: "2026-10-10",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "kri",
    relatedObjectId: "KRI-PAY-011",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Two candidate rejections reported. No offer outstanding.",
  },
  {
    id: "MSN-2026-0195",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-Q-2026",
    title: "Complete the 2026 annual reassessment of the payment services provider",
    titleDe: "Jaehrliche Neubewertung des Zahlungsdienstleisters 2026 abschliessen",
    description:
      "Kick off 15.09.2026, target completion 31.10.2026. As at 06.10.2026 at 07:00 the position is 198 of 214 questionnaire responses received, 33 of 41 evidence artefacts received and 26 accepted, with four unresolved resilience questions.",
    kind: "reassessment",
    issueId: null,
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-15",
    dueOn: "2026-10-31",
    completedOn: null,
    status: "in-progress",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Four unresolved resilience questions, eight missing artefacts and seven received but not accepted.",
  },
  {
    id: "MSN-2026-0197",
    runId: DEFAULT_RUN_ID,
    reference: "RCSA-PAYOPS-Q4-PREREAD",
    title: "Issue the Q4 second line pre read for the payment operations assessment",
    titleDe: "Vorlesebericht der zweiten Linie fuer die Q4-Bewertung des Zahlungsbetriebs versenden",
    description:
      "The second line pre read setting out the proposed control environment rating and the proposed residual position for each of the eleven risks in scope, issued 02.10.2026 ahead of the 06.10.2026 workshop.",
    kind: "communication",
    issueId: null,
    raisedByRoleId: "rcsa",
    ownerUserId: "P-003",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-28",
    dueOn: "2026-10-02",
    completedOn: "2026-10-02",
    status: "completed",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "assessment",
    relatedObjectId: RCSA_PAYOPS_Q4,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Issued 02.10.2026 to all workshop attendees.",
  },
  {
    id: "MSN-2026-0207",
    runId: DEFAULT_RUN_ID,
    reference: "TPRM-REGISTER-FEED",
    title: "Obtain the supplier subprocessor register in a machine readable form with change notifications",
    titleDe: "Unterauftragnehmerregister des Lieferanten maschinenlesbar mit Aenderungsmeldungen beziehen",
    description:
      "The supplier publishes its subprocessor register as a document on its client portal. Arcadia has no monitored feed, which is why a register version published 03.08.2026 sat unread for 64 days. A machine readable feed with change notification would make portal publication detectable whether or not it constitutes notice.",
    kind: "evidence-request",
    issueId: "ISS-2026-0298",
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-29",
    dueOn: "2026-11-30",
    completedOn: null,
    status: "open",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Raised with the commercial owner. Not yet put to the supplier.",
  },
  {
    id: "MSN-2026-0209",
    runId: DEFAULT_RUN_ID,
    reference: "SVC-0042-01-AVAILABILITY",
    title: "Calculate gateway availability monthly from Arcadia telemetry and compare to the supplier report",
    titleDe: "Verfuegbarkeit des Gateways monatlich aus eigener Telemetrie berechnen und mit dem Lieferantenbericht vergleichen",
    description:
      "The supplier had not published September availability as at 06.10.2026. Arcadia calculates the figure from its own submission telemetry, which is how the September service level miss was found. The calculation is monthly and manual.",
    kind: "monitoring",
    issueId: null,
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-07-03",
    dueOn: "2026-11-05",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "service",
    relatedObjectId: "SVC-0042-01",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote:
      "September calculated at 99.62 against a contracted 99.7 excluding planned maintenance (scenario figures). The whole difference is the treatment of one maintenance overrun.",
  },
  {
    id: "MSN-2026-0173",
    runId: DEFAULT_RUN_ID,
    reference: "REG-2026-0031-REMEDIATION",
    title: "Remediate the subcontracting chain fields on three Tier 1 register records",
    titleDe: "Felder zur Unterauftragskette in drei Tier-1-Registereintraegen nachbessern",
    description:
      "Field level remediation plan for the register of information, targeting the subcontracting chain fields on three Tier 1 arrangements rather than the headline completeness figure. Illustrative regulatory context, not legal advice. Applies to ARC-DE and ARC-AT.",
    kind: "remediation",
    issueId: "ISS-2026-0292",
    raisedByRoleId: "regulatory-change",
    ownerUserId: "P-006",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-14",
    dueOn: "2026-11-28",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_EU_SUBCONTRACTING,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Three records identified with their specific incomplete fields. Remediation plan drafted at field level.",
  },
  {
    id: "MSN-2026-0175",
    runId: DEFAULT_RUN_ID,
    reference: "REG-2026-0088-INVENTORY",
    title: "Review the Swiss outsourcing inventory against the current supplier service list",
    titleDe: "Schweizer Auslagerungsverzeichnis mit der aktuellen Dienstleistungsliste abgleichen",
    description:
      "Quarterly review of the Swiss outsourcing inventory. The filing of 24.07.2026 predates the supplier register publication of 03.08.2026 and does not contain the service desk subprocessor. Illustrative regulatory context, not legal advice. Applies to ARC-CH only.",
    kind: "validation-request",
    issueId: "ISS-2026-0294",
    raisedByRoleId: "regulatory-change",
    ownerUserId: "P-015",
    ownerLabel: "",
    entityId: ENTITY_CH,
    createdOn: "2026-09-28",
    dueOn: "2026-10-24",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_CH_INVENTORY_ACCESS,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Local review under way. The standard's scope on subcontracting depth is ambiguous and is the open question.",
  },
  {
    id: "MSN-2026-0179",
    runId: DEFAULT_RUN_ID,
    reference: "CTR-2023-0117-A3-BINDING",
    title: "Confirm which version of the subprocessor appendix binds as at 06.10.2026",
    titleDe: "Bestaetigen, welche Fassung der Anlage zu Unterauftragnehmern zum 06.10.2026 verbindlich ist",
    description:
      "A single binary question to Group Legal with both candidate versions attached. The contract repository marks version 4.2 as binding, so the answer is expected to confirm rather than to determine, and the characterisation of the divergence depends on it.",
    kind: "validation-request",
    issueId: "ISS-2026-0298",
    raisedByRoleId: "tprm",
    ownerUserId: "P-016",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-30",
    dueOn: "2026-10-07",
    completedOn: null,
    status: "in-progress",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "contract",
    relatedObjectId: "CTR-2023-0117-A3",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Question issued to Outsourcing Counsel with both candidate versions attached.",
  },
  {
    id: "MSN-2026-0183",
    runId: DEFAULT_RUN_ID,
    reference: "KRI-PAY-011-REPORT",
    title: "Report secondary reviewer establishment monthly until the position is filled",
    titleDe: "Sollbesetzung der Zweitpruefer monatlich berichten, bis die Stelle besetzt ist",
    description:
      "Monthly establishment report attached to the Red indicator, showing filled reviewer capacity against approved establishment and the second review distribution across named reviewers.",
    kind: "monitoring",
    issueId: "ISS-2026-0305",
    raisedByRoleId: "rcsa",
    ownerUserId: "P-007",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-08-14",
    dueOn: "2026-11-05",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "kri",
    relatedObjectId: "KRI-PAY-011",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "September report shows 3.0 filled of 4.0 approved and a concentration of second reviews on one analyst.",
  },
  {
    id: "MSN-2026-0189",
    runId: DEFAULT_RUN_ID,
    reference: "REG-2026-0117-REVIEW",
    title: "First annual review of the incident classification and reporting standard",
    titleDe: "Erste jaehrliche Ueberpruefung des Standards zur Vorfallklassifizierung und Meldung",
    description:
      "The standard is implemented with two separate lanes: the German and Austrian entities under EU references and the Swiss entity under FINMA references, assessed separately. The first annual review is due 30.11.2026 and must confirm that the two lanes have not been merged in practice. Illustrative regulatory context, not legal advice.",
    kind: "reassessment",
    issueId: null,
    raisedByRoleId: "regulatory-change",
    ownerUserId: "P-006",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2025-11-30",
    dueOn: "2026-11-30",
    completedOn: null,
    status: "open",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_INCIDENT_CLASSIFICATION,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Not started. Scheduled for November 2026.",
  },
  {
    id: "MSN-2026-0211",
    runId: DEFAULT_RUN_ID,
    reference: "AG-CMT-NFR-2026-10-03",
    title: "Draft the committee paper on the indicator breach and the control divergence",
    titleDe: "Gremienpapier zur Indikatorueberschreitung und zur Kontrolldivergenz erstellen",
    description:
      "Joint paper by the second line facilitator and the assurance owner, due with papers on 08.10.2026 at 12:00. The paper cannot be completed while the control conclusion and the residual rating are unsettled, which makes it dependent on two decisions taken on 06.10.2026.",
    kind: "communication",
    issueId: "ISS-2026-0311",
    raisedByRoleId: "rcsa",
    ownerUserId: "P-003",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-26",
    dueOn: "2026-10-08",
    completedOn: null,
    status: "in-progress",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "committee-item",
    relatedObjectId: "AG-CMT-NFR-2026-10-03",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Blocked on the assurance conclusion and on the residual rating.",
  },
  {
    id: "MSN-2026-0212",
    runId: DEFAULT_RUN_ID,
    reference: "AG-CMT-NFR-2026-10-04",
    title: "Draft the committee paper on the reassessment status and the appendix divergence",
    titleDe: "Gremienpapier zum Stand der Neubewertung und zur Anlagenabweichung erstellen",
    description:
      "Paper by the third party risk owner, due with papers on 08.10.2026 at 12:00. It has to carry a characterisation of the appendix divergence, which is one of the day's open decisions.",
    kind: "communication",
    issueId: "ISS-2026-0298",
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-26",
    dueOn: "2026-10-08",
    completedOn: null,
    status: "in-progress",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "committee-item",
    relatedObjectId: "AG-CMT-NFR-2026-10-04",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Structure prepared. Content depends on the divergence characterisation.",
  },
  {
    id: "MSN-2026-0213",
    runId: DEFAULT_RUN_ID,
    reference: "AG-CMT-NFR-2026-10-05",
    title: "Draft the committee paper on overdue remediation actions",
    titleDe: "Gremienpapier zu ueberfaelligen Massnahmen erstellen",
    description:
      "Paper by the portfolio lead covering seven overdue actions, of which two relate to corporate payments, including one at 67 days past a revised due date that triggers the escalation rule. The recommendation is one of the day's open decisions.",
    kind: "communication",
    issueId: null,
    raisedByRoleId: "nfr-governance",
    ownerUserId: "P-001",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-26",
    dueOn: "2026-10-08",
    completedOn: null,
    status: "in-progress",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "committee-item",
    relatedObjectId: "AG-CMT-NFR-2026-10-05",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Escalation note drafted with both options stated and no recommendation.",
  },
  {
    id: "MSN-2026-0204",
    runId: DEFAULT_RUN_ID,
    reference: "AG-CMT-NFR-2026-10-06",
    title: "Draft the noting paper on register of information readiness",
    titleDe: "Informationspapier zur Bereitschaft des Informationsregisters erstellen",
    description:
      "Noting paper for the German and Austrian entities, due 08.10.2026 at 12:00. The paper presents a four state decomposition rather than a single completeness figure, because a figure that conceals a structural gap is the failure mode this function exists to prevent. Illustrative regulatory context, not legal advice.",
    kind: "communication",
    issueId: "ISS-2026-0292",
    raisedByRoleId: "regulatory-change",
    ownerUserId: "P-006",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-26",
    dueOn: "2026-10-08",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "committee-item",
    relatedObjectId: "AG-CMT-NFR-2026-10-06",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Structure prepared with entity scope on every obligation node.",
  },
  {
    id: "MSN-2026-0206",
    runId: DEFAULT_RUN_ID,
    reference: "AG-CMT-NFR-2026-10-07",
    title: "Draft the noting paper on the Swiss outsourcing inventory and FINMA context",
    titleDe: "Informationspapier zum Schweizer Auslagerungsverzeichnis und FINMA-Kontext erstellen",
    description:
      "Noting paper for the Swiss entity, co-authored with the local resilience officer, due 08.10.2026 at 12:00. The paper must not imply that the EU framework covers the Swiss entity. Illustrative regulatory context, not legal advice.",
    kind: "communication",
    issueId: "ISS-2026-0294",
    raisedByRoleId: "regulatory-change",
    ownerUserId: "P-006",
    ownerLabel: "",
    entityId: ENTITY_CH,
    createdOn: "2026-09-26",
    dueOn: "2026-10-08",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "committee-item",
    relatedObjectId: "AG-CMT-NFR-2026-10-07",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Structure prepared with the lane separator enforced in the presented view.",
  },
  {
    id: "MSN-2026-0208",
    runId: DEFAULT_RUN_ID,
    reference: "AG-CMT-NFR-2026-10-08",
    title: "Draft the committee paper on the corporate payments impact tolerance review",
    titleDe: "Gremienpapier zur Ueberpruefung der Toleranzschwellen im Firmenkundenzahlungsverkehr erstellen",
    description:
      "Paper by the resilience lead covering all four tolerances on the important business service, with their measures enumerated. The two measure question on the Swiss clearing tolerance is carried as an open question rather than as a recommendation.",
    kind: "communication",
    issueId: "ISS-2026-0288",
    raisedByRoleId: "incident-resilience",
    ownerUserId: "P-005",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-09-26",
    dueOn: "2026-10-08",
    completedOn: null,
    status: "in-progress",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "committee-item",
    relatedObjectId: "AG-CMT-NFR-2026-10-08",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "All four tolerances enumerated with their measures. The two measure question is open.",
  },
  {
    id: "MSN-2026-0198",
    runId: DEFAULT_RUN_ID,
    reference: "IBS-0004-DEPENDENCY-MAP",
    title: "Extend the corporate payments dependency map to subprocessor depth",
    titleDe: "Abhaengigkeitskarte der Firmenkundenzahlungen auf Unterauftragnehmerebene erweitern",
    description:
      "The dependency map for the important business service terminates at the supplier. Subprocessor and fourth party nodes are held in the third party module and are not linked into the resilience map, so a failure at a subprocessor is not visible on it.",
    kind: "remediation",
    issueId: "ISS-2026-0288",
    raisedByRoleId: "incident-resilience",
    ownerUserId: "P-005",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-08-21",
    dueOn: "2026-11-21",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "service",
    relatedObjectId: "SVC-0042-01",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Extension request prepared for the third party risk owner. Two subprocessor nodes named.",
  },
  {
    id: "MSN-2026-0194",
    runId: DEFAULT_RUN_ID,
    reference: "CTL-PAY-029-SPECIFICATION",
    title: "Obtain the reconciliation specification for the daily payment value control",
    titleDe: "Abstimmungsspezifikation der taeglichen Zahlungswertkontrolle beschaffen",
    description:
      "The control description states that the control reconciles payment value between the payment hub and clearing confirmations. It does not state whether beneficiary identifiers are compared. The answer decides whether a correctly valued payment released to the wrong beneficiary would be detected, which is the central inferential question in the residual assessment.",
    kind: "evidence-request",
    issueId: "ISS-2026-0311",
    raisedByRoleId: "rcsa",
    ownerUserId: "P-008",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-10-02",
    dueOn: "2026-10-14",
    completedOn: null,
    status: "open",
    priority: "high",
    isUnowned: false,
    relatedObjectKind: "control",
    relatedObjectId: CTL_VALUE_RECON,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Requested with the Q4 pre read. Not yet answered.",
  },
  {
    id: "MSN-2026-0192",
    runId: DEFAULT_RUN_ID,
    reference: "Q4-TEST-PLAN-SCREEN",
    title: "Screen the Q4 control test plan for controls whose enforcement depends on a system state",
    titleDe: "Q4-Kontrollpruefplan auf Kontrollen mit systemzustandsabhaengiger Durchsetzung durchsuchen",
    description:
      "Three of the fourteen controls in the Q4 test plan have descriptions asserting unconditional enforcement of a system enforced gate. Whether their implemented configurations match their descriptions is unknown, because no configuration has been examined for any of them.",
    kind: "reassessment",
    issueId: null,
    raisedByRoleId: "control-assurance",
    ownerUserId: "P-004",
    ownerLabel: "",
    entityId: ENTITY_AT,
    createdOn: "2026-09-30",
    dueOn: "2026-12-12",
    completedOn: null,
    status: "in-progress",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "control-test",
    relatedObjectId: TST_FOUR_EYES,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Three candidates identified by description pattern. No configuration examined. Not a finding.",
  },
  {
    id: "MSN-2026-0187",
    runId: DEFAULT_RUN_ID,
    reference: "EVD-2026-40118-TRIAGE",
    title: "Introduce an assessment service level for inbound supplier assurance evidence",
    titleDe: "Bearbeitungsfrist fuer eingehende Nachweise zur Lieferantensicherung einfuehren",
    description:
      "A supplier recovery test report containing a material gap was retrievable in the evidence vault for 137 days before anyone assessed it. Inbound assurance evidence currently has a filing destination and no assessment deadline, so having a document and not reading it is indistinguishable in the records from not having it.",
    kind: "remediation",
    issueId: "ISS-2026-0276",
    raisedByRoleId: "tprm",
    ownerUserId: "P-002",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-10-01",
    dueOn: "2026-11-28",
    completedOn: null,
    status: "open",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Raised 01.10.2026. Not started.",
  },
  {
    id: "MSN-2026-0185",
    runId: DEFAULT_RUN_ID,
    reference: "CMT-NFR-2026-04-CONDITION",
    title: "Report monthly progress on the role segregation action to the committee",
    titleDe: "Monatlich ueber den Fortschritt der Funktionstrennungsmassnahme an das Gremium berichten",
    description:
      "Condition of the extension granted on 14.04.2026. Monthly progress reports were made in May, June and July and none has been made since. The unmet condition is a failure in the committee's own follow up rather than in the action owner's delivery.",
    kind: "communication",
    issueId: null,
    raisedByRoleId: "nfr-governance",
    ownerUserId: "P-007",
    ownerLabel: "",
    entityId: ENTITY_DE,
    createdOn: "2026-04-14",
    dueOn: "2026-10-05",
    completedOn: null,
    status: "open",
    priority: "medium",
    isUnowned: false,
    relatedObjectKind: "action",
    relatedObjectId: "MSN-2026-0147",
    sourceDecisionId: null,
    createdBySession: false,
    progressNote: "Reports made in May, June and July 2026. None since July.",
  },
];

/* ==========================================================================
   Committee items

   Two meetings. The group committee on 13.10.2026 carries the agenda from
   bible section 12.1, positions 1 to 9. The tenth item is not seeded: it is
   added at 16:20 by a session decision, which is the point of an agenda
   that a human composes rather than a template that ships full.

   The entity committee for ARC-DE meets on 20.10.2026 and receives the
   entity specific items. It exists because any entity specific decision at
   group level needs an entity representative in the quorum, and because the
   entity committees are the bodies that set two of the four impact
   tolerances on the corporate payments service.

   Four candidate items carry onAgenda false and a null position. Agenda
   design is the portfolio lead's only real power, so the product has to be
   able to show items waiting for it.
   ========================================================================== */

export const committeeItems: NewCommitteeItem[] = [
  {
    id: "AG-CMT-NFR-2026-10-01",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Minutes of the previous meeting and open actions",
    titleDe: "Protokoll der letzten Sitzung und offene Punkte",
    itemType: "noting",
    raisedByRoleId: "nfr-governance",
    summary:
      "Minutes of 14.07.2026 for approval and the open action log. Includes the monthly progress reporting condition attached to the extension granted on 14.04.2026, on which no report has been made since July 2026.",
    agendaPosition: 1,
    onAgenda: true,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: null,
  },
  {
    id: "AG-CMT-NFR-2026-10-02",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Group non-financial risk dashboard, Q3 2026",
    titleDe: "Gruppenuebersicht nichtfinanzielle Risiken, Q3 2026",
    itemType: "noting",
    raisedByRoleId: "nfr-governance",
    summary:
      "All six group indicators with their September readings. Four are Red with four different owners in four functions. The portfolio commentary presents them as one causal chain with two of six links marked as inferences.",
    agendaPosition: 2,
    onAgenda: true,
    relatedObjectKind: "kri",
    relatedObjectId: KRI_OVERRIDE_RATE,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
  {
    id: "AG-CMT-NFR-2026-10-03",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Override rate breach and the first and second line divergence on CTL-PAY-014",
    titleDe: "Ueberschreitung der Ueberschreibungsquote und Divergenz erster und zweiter Linie zu CTL-PAY-014",
    itemType: "decision",
    raisedByRoleId: "rcsa",
    summary:
      "Joint paper from the second line facilitator and the assurance owner. The override rate indicator breached Red for the first time in 14 months. The control test concluded Partially Effective and the control owner recorded a Fully Effective position. The committee is asked to determine the control environment rating, because the appetite consequence differs on either side of a residual score of 10. Both positions are stated in their owners' words.",
    agendaPosition: 3,
    onAgenda: true,
    relatedObjectKind: "control",
    relatedObjectId: CTL_FOUR_EYES,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
  {
    id: "AG-CMT-NFR-2026-10-04",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Payment services provider reassessment interim status and the subprocessor appendix divergence",
    titleDe: "Zwischenstand der Neubewertung des Zahlungsdienstleisters und Abweichung der Unterauftragnehmeranlage",
    itemType: "decision",
    raisedByRoleId: "tprm",
    summary:
      "Reassessment at 198 of 214 questionnaire responses with four unresolved resilience questions, 25 days from its target close. The binding subprocessor appendix diverges from the supplier's current register on four rows. The committee is asked to note the reassessment position and to approve the contractual route on the divergence.",
    agendaPosition: 4,
    onAgenda: true,
    relatedObjectKind: "supplier",
    relatedObjectId: TP_NOVALINK,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
  {
    id: "AG-CMT-NFR-2026-10-05",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Overdue remediation actions, including the role segregation action at 67 days",
    titleDe: "Ueberfaellige Massnahmen, einschliesslich der Funktionstrennungsmassnahme nach 67 Tagen",
    itemType: "decision",
    raisedByRoleId: "nfr-governance",
    summary:
      "Seven overdue actions across the group, of which two relate to corporate payments. One is 67 days past a revised due date, which triggers the escalation rule requiring a named accountable executive and a recommendation to re-baseline with a root cause or to escalate to the entity board. The paper also discloses that the committee's own monthly reporting condition from April has been unmet since July.",
    agendaPosition: 5,
    onAgenda: true,
    relatedObjectKind: "action",
    relatedObjectId: "MSN-2026-0147",
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
  {
    id: "AG-CMT-NFR-2026-10-06",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Register of information readiness for ARC-DE and ARC-AT",
    titleDe: "Bereitschaft des Informationsregisters fuer ARC-DE und ARC-AT",
    itemType: "noting",
    raisedByRoleId: "regulatory-change",
    summary:
      "Tier 1 register readiness presented as a four state decomposition rather than as a single completeness figure, because the incomplete records are the subcontracting chain fields on three Tier 1 arrangements. Applies to the German and Austrian entities only. Illustrative regulatory context, not legal advice.",
    agendaPosition: 6,
    onAgenda: true,
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_EU_SUBCONTRACTING,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: "THEME-CHAIN-02",
  },
  {
    id: "AG-CMT-NFR-2026-10-07",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_CH,
    title: "ARC-CH outsourcing inventory update and FINMA context",
    titleDe: "Aktualisierung des Auslagerungsverzeichnisses ARC-CH und FINMA-Kontext",
    itemType: "noting",
    raisedByRoleId: "regulatory-change",
    summary:
      "Swiss outsourcing inventory position, including a service desk subprocessor in a third country with read access to payment metadata that is absent from the inventory filed on 24.07.2026. Assessed under FINMA context. Applies to ARC-CH only and is not merged with the EU lane item. Illustrative regulatory context, not legal advice.",
    agendaPosition: 7,
    onAgenda: true,
    relatedObjectKind: "obligation",
    relatedObjectId: OBL_CH_INVENTORY_ACCESS,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: "THEME-CHAIN-02",
  },
  {
    id: "AG-CMT-NFR-2026-10-08",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Corporate payments impact tolerance review",
    titleDe: "Ueberpruefung der Toleranzschwellen im Firmenkundenzahlungsverkehr",
    itemType: "decision",
    raisedByRoleId: "incident-resilience",
    summary:
      "All four impact tolerances on the important business service, with their measures enumerated. One tolerance is expressed with two measures and no stated precedence, which means the entity concerned cannot state whether it was breached if the measures diverge. The committee is asked to set a precedence and to require that any tolerance with more than one measure state which governs.",
    agendaPosition: 8,
    onAgenda: true,
    relatedObjectKind: "impact-tolerance",
    relatedObjectId: ITOL_CH_CLEARING,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: "THEME-TOLERANCE-03",
  },
  {
    id: "AG-CMT-NFR-2026-10-09",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Any other business",
    titleDe: "Verschiedenes",
    itemType: "noting",
    raisedByRoleId: "nfr-governance",
    summary: "Held by the chair. Items raised under this heading carry no decision.",
    agendaPosition: 9,
    onAgenda: true,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: null,
  },

  /*
   * Candidate items. Raised by their functions and not yet prioritised onto
   * an agenda. The portfolio lead's agenda decision is only real if there is
   * something waiting to be prioritised and something that will not fit.
   */
  {
    id: "AG-CAND-2026-10-01",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Conditional risk acceptance on the third party payment service risk, condition unmet",
    titleDe: "Bedingte Risikoakzeptanz zum Drittparteienrisiko, Bedingung unerfuellt",
    itemType: "escalation",
    raisedByRoleId: "nfr-governance",
    summary:
      "The acceptance is valid to 31.12.2026 and is conditioned on completing the reassessment and performing an exit test. The exit test is not started and not planned, and no committee follow up on the condition exists. Candidate item awaiting prioritisation: the alternative is to take it with the reassessment item.",
    agendaPosition: null,
    onAgenda: false,
    relatedObjectKind: "risk",
    relatedObjectId: RSK_THIRD_PARTY_SERVICE,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
  {
    id: "AG-CAND-2026-10-02",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Audit trail defect on a key control in the Internal Control System",
    titleDe: "Mangel im Pruefpfad einer Schluesselkontrolle des internen Kontrollsystems",
    itemType: "escalation",
    raisedByRoleId: "control-assurance",
    summary:
      "For bulk approvals the reviewer identity is a supplier service account and the resolving log has a 30 day retention, so the audit trail on a key control can become unrecoverable. Candidate item awaiting prioritisation. It has the lowest profile and the longest reach of anything raised this quarter.",
    agendaPosition: null,
    onAgenda: false,
    relatedObjectKind: "test-case",
    relatedObjectId: UTC_SERVICE_ACCOUNT,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
  {
    id: "AG-CAND-2026-10-03",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Reclassification of the payment file transformation service",
    titleDe: "Neuklassifizierung der Dienstleistung zur Zahlungsdateitransformation",
    itemType: "decision",
    raisedByRoleId: "regulatory-change",
    summary:
      "The service is classified as not supporting a critical or important function. A format library failure would stop bulk file payments for all three entities. Reclassification carries register, contractual and testing consequences with a cost. Candidate item awaiting prioritisation. Illustrative regulatory context, not legal advice.",
    agendaPosition: null,
    onAgenda: false,
    relatedObjectKind: "service",
    relatedObjectId: "SVC-0042-03",
    sourceDecisionId: null,
    createdBySession: false,
    themeId: "THEME-CHAIN-02",
  },
  {
    id: "AG-CAND-2026-10-04",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFR-2026-10",
    committeeName: "Group Non-Financial Risk Committee",
    meetingDate: "2026-10-13",
    entityId: ENTITY_DE,
    title: "Proposal to replace independent indicator rows with causal chain presentation",
    titleDe: "Vorschlag, einzelne Indikatorzeilen durch eine Ursachenkettendarstellung zu ersetzen",
    itemType: "decision",
    raisedByRoleId: "nfr-governance",
    summary:
      "A permanent change to group reporting so that connected indicators are presented as one chain with link confidence rather than as separate rows. Candidate item awaiting prioritisation, and a judgment about how much change a governance body can absorb in one meeting.",
    agendaPosition: null,
    onAgenda: false,
    relatedObjectKind: "portfolio-theme",
    relatedObjectId: THEME_OVERRIDE,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },

  /* ARC-DE entity committee, 20.10.2026. */
  {
    id: "AG-CMT-NFRDE-2026-04-01",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFRDE-2026-04",
    committeeName: "ARC-DE Entity Non-Financial Risk Committee",
    meetingDate: "2026-10-20",
    entityId: ENTITY_DE,
    title: "Minutes and entity open actions",
    titleDe: "Protokoll und offene Punkte der Einheit",
    itemType: "noting",
    raisedByRoleId: "nfr-governance",
    summary: "Minutes of 21.07.2026 and the entity action log, including the two overdue corporate payments actions.",
    agendaPosition: 1,
    onAgenda: true,
    relatedObjectKind: null,
    relatedObjectId: null,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: null,
  },
  {
    id: "AG-CMT-NFRDE-2026-04-02",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFRDE-2026-04",
    committeeName: "ARC-DE Entity Non-Financial Risk Committee",
    meetingDate: "2026-10-20",
    entityId: ENTITY_DE,
    title: "Payment operations Q4 assessment sign-off",
    titleDe: "Freigabe der Q4-Bewertung des Zahlungsbetriebs",
    itemType: "decision",
    raisedByRoleId: "rcsa",
    summary:
      "Sign-off of the quarterly assessment for the payment operations unit, covering eleven risks. Sign-off is required by 16.10.2026, so an unresolved residual rating on the contested risk puts this item out of time.",
    agendaPosition: 2,
    onAgenda: true,
    relatedObjectKind: "assessment",
    relatedObjectId: RCSA_PAYOPS_Q4,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
  {
    id: "AG-CMT-NFRDE-2026-04-03",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFRDE-2026-04",
    committeeName: "ARC-DE Entity Non-Financial Risk Committee",
    meetingDate: "2026-10-20",
    entityId: ENTITY_DE,
    title: "Appetite consequence on the payment release risk",
    titleDe: "Folge fuer den Risikoappetit beim Zahlungsfreigaberisiko",
    itemType: "decision",
    raisedByRoleId: "rcsa",
    summary:
      "If the residual position is outside appetite, the entity Chief Operating Officer must either approve a remediation plan with committed dates or sign a Risikoakzeptanz noted by the group committee. This item exists because the appetite consequence is an entity decision and cannot be absorbed at group level.",
    agendaPosition: 3,
    onAgenda: true,
    relatedObjectKind: "risk",
    relatedObjectId: RSK_UNAUTH_RELEASE,
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
  {
    id: "AG-CMT-NFRDE-2026-04-04",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFRDE-2026-04",
    committeeName: "ARC-DE Entity Non-Financial Risk Committee",
    meetingDate: "2026-10-20",
    entityId: ENTITY_DE,
    title: "Entity impact tolerance review for same day payment submission",
    titleDe: "Ueberpruefung der Toleranzschwelle der Einheit fuer die Einreichung am selben Tag",
    itemType: "decision",
    raisedByRoleId: "incident-resilience",
    summary:
      "The four hour maximum tolerable disruption for same day payment submission was set by this committee and last reviewed 11.03.2026. The review covers whether a single measure remains appropriate and whether a control environment condition should be attached to it.",
    agendaPosition: 4,
    onAgenda: true,
    relatedObjectKind: "impact-tolerance",
    relatedObjectId: "ITOL-0004-01",
    sourceDecisionId: null,
    createdBySession: false,
    themeId: "THEME-TOLERANCE-03",
  },
  {
    id: "AG-CMT-NFRDE-2026-04-05",
    runId: DEFAULT_RUN_ID,
    committeeRef: "CMT-NFRDE-2026-04",
    committeeName: "ARC-DE Entity Non-Financial Risk Committee",
    meetingDate: "2026-10-20",
    entityId: ENTITY_DE,
    title: "Role segregation enforcement in the payment repair system",
    titleDe: "Durchsetzung der Funktionstrennung im Zahlungsreparatursystem",
    itemType: "escalation",
    raisedByRoleId: "control-assurance",
    summary:
      "The remediation raised from the 2025 audit finding is 67 days past its revised due date and the enabling access design defect remains present. The entity committee receives it because the escalation route from the group committee runs to the entity board through this body.",
    agendaPosition: 5,
    onAgenda: true,
    relatedObjectKind: "action",
    relatedObjectId: "MSN-2026-0147",
    sourceDecisionId: null,
    createdBySession: false,
    themeId: THEME_OVERRIDE,
  },
];

/* ==========================================================================
   Cross function portfolio themes

   The first theme is the hero view: one event, six professional lenses, one
   decision thread. Its materiality is null, because portfolio materiality is
   the portfolio lead's decision and the seed must not have taken it.

   duplicateReportCount is not decoration. It is the number of separate
   reports that would each carry the same underlying fact today, counted by
   naming them, and it is the figure that makes the duplication argument
   checkable rather than rhetorical.
   ========================================================================== */

export const portfolioThemes: NewPortfolioTheme[] = [
  {
    id: THEME_OVERRIDE,
    runId: DEFAULT_RUN_ID,
    title: "Manual payment overrides released without secondary review",
    titleDe: "Manuelle Zahlungsueberschreibungen ohne Zweitpruefung freigegeben",
    description:
      "One matter seen through six professional lenses. The primary clearing route failed repeatedly, which drove route substitution overrides; a supplier configuration rule waived the secondary review requirement whenever the fallback route was active; reviewer establishment was below threshold; the control test found four exceptions and two unresolvable items; the remediation that would have prevented one of them is 67 days overdue; and on 06.10.2026 the same rule released 96 payments with an unsatisfied mandatory control gate, one of which is a confirmed misroute. Six separate reports would carry this same fact today: the group indicator dashboard, the first line indicator breach explanation, the control test report, the quarterly assessment paper, the supplier reassessment report and the incident record. None of them would connect it.",
    contributingRoleIds: ["tprm", "rcsa", "control-assurance", "incident-resilience", "regulatory-change", "nfr-governance"],
    decisionIds: [
      "DEC-2026-0771",
      "DEC-2026-0744",
      "DEC-2026-0772",
      "DEC-2026-0782",
      "DEC-2026-0746",
      "DEC-2026-0747",
      "DEC-2026-0760",
      "DEC-2026-0764",
      "DEC-2026-0778",
      "DEC-2026-0783",
      "DEC-2026-0779",
      "DEC-2026-0785",
      "DEC-2026-0765",
      "DEC-2026-0787",
      "DEC-2026-0755",
      "DEC-2026-0757",
      "DEC-2026-0781",
      "DEC-2026-0784",
    ],
    duplicateReportCount: 6,
    materiality: null,
    materialityDecidedBy: null,
    confidence: 0.72,
    sortOrder: 1,
  },
  {
    id: "THEME-CHAIN-02",
    runId: DEFAULT_RUN_ID,
    title: "Supplier chain visibility below the first tier",
    titleDe: "Transparenz der Lieferkette unterhalb der ersten Ebene",
    description:
      "Arcadia's contractual, register and inventory views all terminate at the first tier supplier. A service desk provider in a third country holds read access to payment metadata and appears in no Arcadia record. A hosting subprocessor operates a second region that the binding appendix does not mention, and that region carried the traffic during the event. A fourth party holds payment metadata for 24 months and the contract has no fourth party provision at all. The same gap is counted three different ways: as a register completeness figure in the EU lane, as an inventory omission in the Swiss lane, and as a contractual notice question in the third party file.",
    contributingRoleIds: ["tprm", "regulatory-change", "incident-resilience", "nfr-governance"],
    decisionIds: ["DEC-2026-0759", "DEC-2026-0752", "DEC-2026-0762", "DEC-2026-0754", "DEC-2026-0779"],
    duplicateReportCount: 3,
    materiality: null,
    materialityDecidedBy: null,
    confidence: 0.78,
    sortOrder: 2,
  },
  {
    id: "THEME-TOLERANCE-03",
    runId: DEFAULT_RUN_ID,
    title: "Impact tolerances that cannot adjudicate their own outcomes",
    titleDe: "Toleranzschwellen, die ihr eigenes Ergebnis nicht beurteilen koennen",
    description:
      "Two framework defects in the group's own tolerance design, both found on 06.10.2026 and neither caused by it. One tolerance on the corporate payments service is expressed with two measures and no stated precedence, so when the measures diverge the entity cannot state whether it was breached. Another carries a threshold of zero with no monitoring capable of detecting a breach, which is why 96 candidate breaches were found by an ad hoc query rather than by a control. The draft internal standard in consultation until 23.10.2026 would permit both defects to be designed into every future tolerance.",
    contributingRoleIds: ["incident-resilience", "regulatory-change", "nfr-governance"],
    decisionIds: ["DEC-2026-0751", "DEC-2026-0786", "DEC-2026-0753", "DEC-2026-0784"],
    duplicateReportCount: 2,
    materiality: null,
    materialityDecidedBy: null,
    confidence: 0.81,
    sortOrder: 3,
  },
  {
    id: "THEME-ASSURANCE-04",
    runId: DEFAULT_RUN_ID,
    title: "Assurance evidence that exists and is not read",
    titleDe: "Vorhandene, aber nicht gelesene Nachweise",
    description:
      "Three instances of the same failure, in three functions, with the same shape: the evidence was retrievable and nobody assessed it. A supplier recovery test report containing a recovery gap sat in the vault for 137 days. A supplier register version published on the client portal sat unread for 64 days. A test exception whose rule trace named a control waiver was classified as a closed configuration matter 41 days before the same rule released 96 payments. Having a document and not reading it is indistinguishable in the records from not having it, which is why none of the three appears as a gap anywhere.",
    contributingRoleIds: ["tprm", "control-assurance", "nfr-governance"],
    decisionIds: ["DEC-2026-0741", "DEC-2026-0747", "DEC-2026-0746", "DEC-2026-0742"],
    duplicateReportCount: 3,
    materiality: null,
    materialityDecidedBy: null,
    confidence: 0.75,
    sortOrder: 4,
  },
  {
    id: "THEME-CAPACITY-05",
    runId: DEFAULT_RUN_ID,
    title: "Remediation capacity and the credibility of extensions",
    titleDe: "Kapazitaet fuer Massnahmen und Glaubwuerdigkeit von Verlaengerungen",
    description:
      "Seven overdue remediation actions across the group, of which two relate to corporate payments. Four are verifiably blocked by dependencies and three show no verifiable activity. Four second extensions have been granted in eight quarters and no record shows whether any of them was met. Four actions have been raised, agreed and never assigned an owner, including the exercise for the group's most important payment service and the rehearsal of the only recovery route the Swiss entity has. The theme is about the group's own machinery rather than about any one owner's delivery.",
    contributingRoleIds: ["nfr-governance", "control-assurance", "incident-resilience", "rcsa"],
    decisionIds: ["DEC-2026-0763", "DEC-2026-0756", "DEC-2026-0750", "DEC-2026-0749"],
    duplicateReportCount: 2,
    materiality: null,
    materialityDecidedBy: null,
    confidence: 0.69,
    sortOrder: 5,
  },
];

/* ==========================================================================
   Background actions

   The "What happened in the background?" reveal is a COUNT query over this
   array. If a number is shown to an executive, the rows behind it exist here
   and the reveal is expandable to each one. That is the single most important
   integrity rule in the product, because the reveal is the moment the
   product asks to be believed.

   Two counting rules matter.

     Systems checked counts DISTINCT targetId for kind "system-checked", so
     twelve systems checked means twelve distinct system identifiers, not
     twelve rows against the same system.

     Every other count is a row count. There are no aggregate rows, no
     "various" targets and no placeholder descriptions, because each count is
     drillable to the individual action.

   For the rcsa role at 07:45 the counts resolve to: 12 systems checked, 38
   records reconciled, 7 documents classified, 4 missing items requested, 3
   contradictions identified, 2 routine updates completed and 1 decision
   escalated to the human. That is the cell the executive reveal opens on.

   Four systems of record are named here that the process description in the
   bible does not list, because the narrative requires them to exist: the
   loss and event register (bible section 10.1 relies on a 24 month loss
   history), the establishment and position register (section 14 relies on a
   named vacant position), the indicator reporting service (section 9 relies
   on a monthly reporting run) and the contract repository (section 7.3
   relies on a searchable notice archive).
   ========================================================================== */

type BgKind =
  | "system-checked"
  | "record-reconciled"
  | "document-classified"
  | "item-requested"
  | "contradiction-identified"
  | "routine-update"
  | "escalated-to-human";

/**
 * Work lane per action kind. Lane 4, Decide, never appears: no background
 * action decides anything, and a non zero lane 4 count would be a false
 * claim rather than a rounding error.
 */
const BG_LANE = {
  "system-checked": "L2",
  "record-reconciled": "L2",
  "document-classified": "L2",
  "contradiction-identified": "L2",
  "item-requested": "L1",
  "routine-update": "L5",
  "escalated-to-human": "L1",
} as const;

/** Authority class per action kind, as carried by the tool that performed it. */
const BG_AUTHORITY = {
  "system-checked": "READ",
  "record-reconciled": "READ",
  "document-classified": "READ",
  "contradiction-identified": "READ",
  "item-requested": "DRAFT",
  "routine-update": "POLICY_BOUND_AUTONOMOUS",
  "escalated-to-human": "PROPOSE",
} as const;

/** Lane sequence counters. Deterministic: the array order fixes every id. */
const bgSequence: Record<"L1" | "L2" | "L5", number> = { L1: 0, L2: 0, L5: 0 };

/**
 * Expands one background action.
 *
 * Identifiers follow the seeded action convention: lane, year and a five
 * digit sequence within the lane. Nothing here is random, because the same
 * seed has to produce the same reveal every time it runs.
 */
function bg(
  roleId: NewBackgroundAction["roleId"],
  moment: string,
  kind: BgKind,
  targetKind: string,
  targetId: string,
  targetLabel: string,
  description: string,
  evidenceIds: string[] = [],
): NewBackgroundAction {
  const lane = BG_LANE[kind];
  const next = bgSequence[lane] + 1;
  bgSequence[lane] = next;
  return {
    id: `ACT-${lane}-2026-${String(next).padStart(5, "0")}`,
    runId: DEFAULT_RUN_ID,
    roleId,
    kind,
    targetKind,
    targetId,
    targetLabel,
    description,
    performedAtMoment: moment,
    performedAt: at(moment),
    authorityClass: BG_AUTHORITY[kind],
    autonomous: kind !== "escalated-to-human",
    evidenceIds,
  };
}

export const backgroundActions: NewBackgroundAction[] = [
  /* ----------------------------------------------------------------------
     rcsa at 07:45. Twelve distinct systems, thirty eight reconciliations,
     seven classifications, four requests, three contradictions, two routine
     updates and one escalation. Sixty seven rows.
     ---------------------------------------------------------------------- */

  bg("rcsa", "07:45", "system-checked", "system", "SYS-0011", "Arcadia Payment Hub", "Queried the instruction state machine of record for September and August released instruction counts for ARC-DE, to establish the denominator behind the override rate indicator independently of the reported figure."),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0012", "Novalink Gateway", "Queried gateway submission acknowledgement availability for September to establish how often the primary clearing route was unavailable, which is the suspected driver of route substitution overrides."),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0013", "Arcadia Direct Link", "Checked fallback clearing route usage records for September, confirming that the route carried submissions during five separate windows totalling 8 hours 40 minutes."),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0014", "Novalink RepairDesk", "Queried the override audit log for all 731 September overrides and all 412 August overrides for ARC-DE, with reason code, value, creator, reviewer and timestamps."),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0015", "euroSIC Adapter", "Checked Swiss override volumes for September to establish whether the ARC-DE pattern is entity specific, returning 49 against 38 in August, which is a materially different shape."),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0016", "Sanctions Screening Platform", "Confirmed that no screening holds are present in the September repair population, because screening holds are not repair items and would otherwise inflate the queue figures."),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0017", "Client Static Data Master", "Checked whether any September override was raised against a client record changed in the same period, which would be an alternative explanation for the growth. None was."),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0018", "Loss and Event Register", "Queried the loss and event register for entries mapped to the payment release risk over 24 months, returning nil, and captured the query scope so the nil return is auditable.", ["EVD-2026-41250"]),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0019", "Establishment and Position Register", "Checked the approved and filled secondary reviewer establishment for the Munich payment repair team, returning 3.0 filled of 4.0 approved with one position vacant since 31.07.2026.", ["EVD-2026-41822"]),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0020", "Indicator Reporting Service", "Retrieved the September indicator reporting run published 05.10.2026 at 06:00 and confirmed the three payments indicator readings against their thresholds.", ["EVD-2026-41820"]),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0031", "Arcadia RiskCore", "Queried the risk, control, test and assessment records for the payment operations unit, returning eleven risks in scope, the control test conclusion and the first line counter-position."),
  bg("rcsa", "07:45", "system-checked", "system", "SYS-0032", "Arcadia Evidence Vault", "Retrieved the six evidence artefacts cited in the Q4 pre read and confirmed each one's version, creation date and retrieval date, so a citation in the workshop resolves to a specific version."),

  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-A-2026-08", "Validation rule false positive overrides, August", "Reconciled 62 August overrides coded as validation rule false positives against the payment hub, matching exactly."),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-A-2026-09", "Validation rule false positive overrides, September", "Reconciled 68 September overrides coded as validation rule false positives against the payment hub, matching exactly. Broadly flat against August."),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-B-2026-08", "Client confirmed out of band overrides, August", "Reconciled 197 August overrides coded as client confirmed out of band against the payment hub, matching exactly."),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-B-2026-09", "Client confirmed out of band overrides, September", "Reconciled 214 September overrides coded as client confirmed out of band against the payment hub, matching exactly. Broadly flat against August."),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-C-2026-08", "Route substitution overrides, August", "Reconciled 31 August overrides coded as route substitution against the payment hub, matching exactly."),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-C-2026-09", "Route substitution overrides, September", "Reconciled 198 September overrides coded as route substitution against the payment hub. This component is the largest single movement in the indicator and the reason the breach is a pressure signal rather than an error signal.", ["EVD-2026-41821"]),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-D-2026-08", "Cut-off driven overrides, August", "Reconciled 94 August overrides coded as cut-off driven against the payment hub, matching exactly."),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-D-2026-09", "Cut-off driven overrides, September", "Reconciled 211 September overrides coded as cut-off driven against the payment hub. The second pressure component, more than doubled against August.", ["EVD-2026-41821"]),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-E-2026-08", "Technical suppression overrides, August", "Reconciled 28 August overrides coded as technical suppression against the payment hub, matching exactly."),
  bg("rcsa", "07:45", "record-reconciled", "kri-component", "OVR-E-2026-09", "Technical suppression overrides, September", "Reconciled 40 September overrides coded as technical suppression against the payment hub, matching exactly. Broadly flat against August."),
  bg("rcsa", "07:45", "record-reconciled", "activation-window", "FBK-2026-09-04", "Fallback activation, 04.09.2026", "Reconciled a fallback activation of 1 hour 10 minutes triggered by gateway latency against the configuration audit log, and counted the route substitution overrides created inside the window.", ["EVD-2026-41810"]),
  bg("rcsa", "07:45", "record-reconciled", "activation-window", "FBK-2026-09-11", "Fallback activation, 11.09.2026", "Reconciled a fallback activation of 2 hours 5 minutes triggered by a planned maintenance overrun against the configuration audit log, and counted the overrides created inside the window.", ["EVD-2026-41810"]),
  bg("rcsa", "07:45", "record-reconciled", "activation-window", "FBK-2026-09-18", "Fallback activation, 18.09.2026", "Reconciled a fallback activation of 40 minutes triggered by a network path failure against the configuration audit log, and counted the overrides created inside the window.", ["EVD-2026-41810"]),
  bg("rcsa", "07:45", "record-reconciled", "activation-window", "FBK-2026-09-25", "Fallback activation, 25.09.2026", "Reconciled a fallback activation of 3 hours 15 minutes triggered by gateway latency against the configuration audit log, the longest single window in the month.", ["EVD-2026-41810"]),
  bg("rcsa", "07:45", "record-reconciled", "activation-window", "FBK-2026-09-29", "Fallback activation, 29.09.2026", "Reconciled a fallback activation of 1 hour 30 minutes triggered by gateway latency against the configuration audit log, and counted the overrides created inside the window.", ["EVD-2026-41810"]),
  bg("rcsa", "07:45", "record-reconciled", "activation-window", "FBK-2026-08-19", "Fallback activation, August", "Reconciled the single August fallback activation of one hour, establishing the baseline the September figure is compared against.", ["EVD-2026-41810"]),
  bg("rcsa", "07:45", "record-reconciled", "activation-window", "FBK-2026-08-27", "Fallback activation, 27.08.2026", "Reconciled the fallback window of 15:22 to 17:05 on 27.08.2026 against the configuration audit log and confirmed that it contains the override behind the fourth test exception.", ["EVD-2026-41810", "EVD-2026-41805"]),
  bg("rcsa", "07:45", "record-reconciled", "activation-window", "FBK-2026-09-23", "Fallback activation, 23.09.2026", "Reconciled a fallback window on 23.09.2026 that appears in the configuration audit log and not in the September payment operations report, alongside 11 route substitution overrides created that afternoon.", ["EVD-2026-41810"]),
  bg("rcsa", "07:45", "record-reconciled", "assessment-line", "RCSA-ARC-DE-PAYOPS-2026-Q4-L01", "Erroneous or unauthorised payment release", "Reconciled the contested risk line across three recorded positions: the Q3 signed assessment, the first line Q4 proposal and the second line Q4 pre read proposal.", ["EVD-2026-41202", "EVD-2026-41200"]),
  bg("rcsa", "07:45", "record-reconciled", "assessment-line", "RCSA-ARC-DE-PAYOPS-2026-Q4-L02", "Delay to same-day submission beyond the value-date cut-off", "Reconciled the cut-off delay line against its Q3 position and noted that the cut-off override component growth from 94 to 211 bears directly on it.", ["EVD-2026-41821"]),
  bg("rcsa", "07:45", "record-reconciled", "assessment-line", "RCSA-ARC-DE-PAYOPS-2026-Q4-L03", "Insufficient qualified reviewer capacity in payment operations", "Reconciled the reviewer capacity line against the establishment position of 3.0 filled of 4.0 approved and against the overdue recruitment action.", ["EVD-2026-41822"]),
  bg("rcsa", "07:45", "record-reconciled", "assessment-line", "RCSA-ARC-DE-PAYOPS-2026-Q4-L04", "Loss or material degradation of a critical third-party payment service", "Reconciled the adjacent third party line and found the only change since the pre read: the acceptance condition status on the exit test.", ["EVD-2026-41204"]),
  bg("rcsa", "07:45", "record-reconciled", "assessment-line", "RCSA-ARC-DE-PAYOPS-2026-Q4-L05", "Duplicate release of a corporate payment instruction", "Reconciled the duplicate release line against its Q3 position, returning no change."),
  bg("rcsa", "07:45", "record-reconciled", "risk", "RSK-0213", "Missing or incorrect regulatory reporting data on cross-border payments", "Checked the cross-border reporting risk for material change since the pre read, returning none, so the workshop does not need to reopen it."),
  bg("rcsa", "07:45", "record-reconciled", "risk", "RSK-0215", "Inaccurate corporate mandate and beneficiary static data", "Checked the static data risk for material change and linked it to the repair population, because an incorrect beneficiary is the failure mode the contested control exists to prevent."),
  bg("rcsa", "07:45", "record-reconciled", "risk", "RSK-0216", "Swiss franc clearing submission misses the domestic same-day cut-off", "Checked the Swiss clearing risk for material change, returning none as at 07:45, and noted that the Swiss entity has no fallback route for this submission path."),
  bg("rcsa", "07:45", "record-reconciled", "risk", "RSK-0185", "Undisclosed or unapproved subprocessor processing Arcadia payment data", "Checked the undisclosed subprocessor risk against the third party function's open divergence, confirming that the two functions hold the same facts under two different risk statements."),
  bg("rcsa", "07:45", "record-reconciled", "risk", "RSK-0261", "Unreviewed supplier configuration change alters a payment control gate", "Checked the unreviewed configuration change risk, which is recorded and carries no test result and no indicator, so nothing in the assessment would have surfaced it."),
  bg("rcsa", "07:45", "record-reconciled", "risk", "RSK-0262", "Loss of the audit trail or evidence supporting a key control", "Checked the audit trail risk and linked it to the unresolvable test item where the reviewer identity is a supplier service account and the resolving log has expired."),
  bg("rcsa", "07:45", "record-reconciled", "assessment", "RCSA-ARC-DE-PAYOPS-2026-Q3", "Q3 signed residual position", "Reconciled the Q3 position signed 08.07.2026: control environment Effective, residual impact 3, residual likelihood 2, residual score 6 of 25, within appetite.", ["EVD-2026-41202"]),
  bg("rcsa", "07:45", "record-reconciled", "assessment", "RCSA-ARC-DE-PAYOPS-2026-Q4", "Q4 first line proposed position", "Reconciled the first line Q4 proposal: control environment Effective, residual impact 3, residual likelihood 3, residual score 9 of 25, within appetite, consequence monitoring."),
  bg("rcsa", "07:45", "record-reconciled", "assessment", "RCSA-ARC-DE-PAYOPS-2026-Q4", "Q4 second line proposed position", "Reconciled the second line pre read proposal of 02.10.2026: control environment Partially Effective, residual impact 4, residual likelihood 3, residual score 12 of 25, outside appetite.", ["EVD-2026-41200"]),
  bg("rcsa", "07:45", "record-reconciled", "position-record", "PR-SR-02", "Vacant secondary reviewer position", "Reconciled the vacant position record against the recruitment action, confirming a leaver date of 31.07.2026, recruitment approved 12.08.2026, two candidate rejections and no start date.", ["EVD-2026-41822"]),
  bg("rcsa", "07:45", "record-reconciled", "action", "MSN-2026-0166", "Reviewer recruitment action", "Reconciled the recruitment action against its due date of 30.09.2026, returning overdue by 6 days with no offer outstanding."),
  bg("rcsa", "07:45", "record-reconciled", "control-test", "TST-2026-0318", "Exception count against the test report", "Reconciled the four exceptions and the two unable to conclude items against the issued test report, confirming a population of 1,204, a sample of 60 and both stated deviation rates.", ["EVD-2026-41850", "EVD-2026-41852"]),
  bg("rcsa", "07:45", "record-reconciled", "control-test", "TST-2026-0318-UTC", "Unable to conclude items", "Reconciled the two unable to conclude items separately from the exceptions, because treating them as deviations changes the rate from 4 in 60 to 6 in 60 and the report states both.", ["EVD-2026-41850"]),
  bg("rcsa", "07:45", "record-reconciled", "loss-register", "RSK-0211-LOSS-24M", "Loss history over 24 months", "Reconciled the 24 month loss history for the payment release risk against the loss and event register, returning nil entries, and attached the detection effectiveness caveat to the result rather than reporting the figure alone.", ["EVD-2026-41250"]),
  bg("rcsa", "07:45", "record-reconciled", "kri", "KRI-PAY-003", "Payment repair rate", "Reconciled the repair rate readings for August and September against the payment hub queue records, confirming a third consecutive month outside Green, and noted that repair volume rose by roughly a fifth while overrides rose by more than three quarters.", ["EVD-2026-41820"]),

  bg("rcsa", "07:45", "document-classified", "evidence", "EVD-2026-41820", "September indicator reporting run", "Classified the 34 page indicator report and extracted the three payments readings with their thresholds, so the workshop does not open on a page reference."),
  bg("rcsa", "07:45", "document-classified", "evidence", "EVD-2026-41850", "Control test report of 25.09.2026", "Classified the control test report and extracted the conclusion, the population, the sample, the four exceptions and the two unable to conclude items as structured facts."),
  bg("rcsa", "07:45", "document-classified", "evidence", "EVD-2026-41855", "First line control owner position", "Classified the control owner's position record of 29.09.2026 and separated its three line rationale into three separate assertions, of which two are checkable today."),
  bg("rcsa", "07:45", "document-classified", "evidence", "EVD-2026-41202", "Q3 signed assessment", "Classified the Q3 assessment signed 08.07.2026 and extracted the inherent and residual scores and the control environment rating that produced them."),
  bg("rcsa", "07:45", "document-classified", "evidence", "EVD-2026-41200", "Q4 second line pre read", "Classified the second line pre read of 02.10.2026 and extracted the proposed rating for each of the eleven risks in scope."),
  bg("rcsa", "07:45", "document-classified", "evidence", "EVD-2026-41821", "First line override extract", "Classified the override extract supplied by the first line on 01.10.2026, reconciled it to the payment hub rather than trusting it, and identified four records with a blank reason code that are also blank at source."),
  bg("rcsa", "07:45", "document-classified", "control-description", "CTL-PAY-021", "Compensating control descriptions", "Classified the descriptions of the two compensating controls and characterised each one: the Duty Manager review is detective, next business day and drawn at one in ten; the value reconciliation compares payment value between the payment hub and clearing confirmations."),

  bg("rcsa", "07:45", "item-requested", "override-record", "OVR-2026-09-BLANK", "Four override records with a blank reason code", "Requested the reason codes for four September override records that are blank in the first line extract and blank at source, so the component decomposition rests on 727 records rather than 731."),
  bg("rcsa", "07:45", "item-requested", "activation-window", "FBK-2026-09-23", "Unlogged fallback activation of 23.09.2026", "Requested confirmation that the five reported September activation windows are complete and that the 17 route substitution overrides outside them have another cause, with the 11 records of 23.09.2026 listed by identifier."),
  bg("rcsa", "07:45", "item-requested", "position-record", "PR-SR-02", "Reviewer start date", "Requested a confirmed start date for the vacant secondary reviewer position, because the residual assessment cannot treat the capacity position as improving without one."),
  bg("rcsa", "07:45", "item-requested", "control", "CTL-PAY-029", "Reconciliation specification", "Requested the reconciliation specification for the daily payment value control, to establish whether beneficiary identifiers are compared. The control description does not say, and the answer decides whether a wrong beneficiary release would be detected."),

  bg("rcsa", "07:45", "contradiction-identified", "control", "CTL-PAY-014", "Two attributed control effectiveness positions", "Identified a direct conflict between the second line conclusion of Partially Effective in the test report of 25.09.2026 and the first line position of Fully Effective recorded 29.09.2026. Both are retained as attributed statements with their dates and neither is restated as the position.", ["EVD-2026-41850", "EVD-2026-41855"]),
  bg("rcsa", "07:45", "contradiction-identified", "risk", "RSK-0211", "Loss history against detection capability", "Identified that the first line argument from 24 months without a loss depends on detection being effective, while the detective control on this risk reconciles value rather than authorisation. The two cannot both be relied upon and the conflict is an inferential one rather than a factual one.", ["EVD-2026-41250"]),
  bg("rcsa", "07:45", "contradiction-identified", "activation-window", "FBK-2026-09-23", "Operations report against the configuration audit log", "Identified that the configuration audit log records a fallback activation on 23.09.2026 that the September payment operations report does not contain. Either the report is incomplete or the change was made outside the runbook, and the log alone cannot distinguish them.", ["EVD-2026-41810"]),

  bg("rcsa", "07:45", "routine-update", "meeting", "RCSA-ARC-DE-PAYOPS-2026-Q4", "Workshop attendance and distribution", "Refreshed the 10:30 workshop attendance from the current organisational records, applied one attendee change received overnight, and confirmed that all attendees hold the current pre read version."),
  bg("rcsa", "07:45", "routine-update", "kri", "KRI-PAY-007", "Indicator breach deadline", "Placed the first line written explanation deadline of 12.10.2026 on the work list with the escalation rule text attached, and linked the committee item that the breach rule also requires."),

  bg("rcsa", "07:45", "escalated-to-human", "kri", "KRI-PAY-007", "Escalation route for three Red indicators", "Escalated for a human decision: whether to request three separate first line explanations as the escalation rule provides, or one causal investigation covering all three indicators. The analysis supports one investigation and the procedural route supports three explanations, and choosing between a correct procedure and a useful answer is not a decision this system takes."),

  /* ----------------------------------------------------------------------
     tprm at 07:45. Twenty one rows.
     ---------------------------------------------------------------------- */

  bg("tprm", "07:45", "system-checked", "system", "SYS-0031", "Arcadia RiskCore", "Queried the third party module for the supplier record, the five services with their per entity classifications, the four subprocessors and the reassessment state."),
  bg("tprm", "07:45", "system-checked", "system", "SYS-0032", "Arcadia Evidence Vault", "Retrieved the 33 evidence artefacts received in the reassessment with their creation and retrieval dates, and identified which have been assessed and which have only been filed."),
  bg("tprm", "07:45", "system-checked", "system", "SYS-0033", "Arcadia Contract Repository", "Searched the contract repository for any subprocessor notice relating to the service desk provider or the second hosting region, returning nil, and recorded the search scope so the nil return is evidence of absence in Arcadia's records rather than proof that no notice was given.", ["EVD-2026-41235"]),
  bg("tprm", "07:45", "system-checked", "system", "SYS-0012", "Novalink Gateway", "Queried gateway submission telemetry for September and calculated monthly availability at 99.62 against a contracted 99.7 excluding planned maintenance (scenario figures), because the supplier has not published a September service report.", ["EVD-2026-41240"]),
  bg("tprm", "07:45", "system-checked", "external-system", "TP-0042-PORTAL", "Novalink client status portal", "Checked the supplier client portal publication history, returning a subprocessor register version published 03.08.2026 and the previous version published 11.09.2025, which establishes that the portal is used and that Arcadia has not monitored it."),

  bg("tprm", "07:45", "record-reconciled", "contract", "CTR-2023-0117-A3", "Binding appendix against the supplier register", "Reconciled the binding subprocessor appendix of 14.02.2025 against the supplier register of 03.08.2026 node by node, producing a four row divergence table with the evidence attached to each row.", ["EVD-2026-41410", "EVD-2026-41405", "EVD-2026-41415"]),
  bg("tprm", "07:45", "record-reconciled", "subprocessor", "TP-0042.4", "Service desk provider in Pune", "Reconciled the service desk subprocessor against the data processing appendix, which names Switzerland, Germany, the Czech Republic and Ireland and does not name India, and against the contract repository, which holds no notice.", ["EVD-2026-41402", "EVD-2026-41235"]),
  bg("tprm", "07:45", "record-reconciled", "subprocessor", "TP-0042.2", "Hosting subprocessor regions", "Reconciled the listed hosting subprocessor's regions, returning Frankfurt in the binding appendix and Frankfurt plus Amsterdam in the supplier register, with no region change notice on record.", ["EVD-2026-41410", "EVD-2026-41405"]),
  bg("tprm", "07:45", "record-reconciled", "subprocessor", "TP-0042.3-F1", "Fourth party log archive in Dublin", "Reconciled the fourth party holding telemetry and payment reference metadata for 24 months, confirming that it is outside the scope of the subprocessor appendix as drafted, which makes it a drafting gap rather than an omission."),
  bg("tprm", "07:45", "record-reconciled", "supplier", "TP-0042", "Reassessment state from source", "Reconciled the reassessment state from the source systems rather than from the tracking workbook, returning 198 of 214 responses received, 33 of 41 artefacts received and 26 accepted.", ["EVD-2026-41445"]),
  bg("tprm", "07:45", "record-reconciled", "kri", "KRI-TPR-002", "Tier 1 subprocessor record completeness", "Decomposed the subprocessor record completeness indicator and localised the shortfall to the subcontracting chain fields on three Tier 1 arrangements, which is the same problem as the appendix divergence counted differently."),

  bg("tprm", "07:45", "document-classified", "evidence", "EVD-2026-40118", "Supplier recovery test report", "Classified the supplier recovery test report of 22.05.2026, located the tested recovery of 3 hours 40 minutes against a contracted objective of 2 hours, confirmed that the report covers two hosting regions and not the Swiss instance, and computed that the artefact has been retrievable for 137 days without assessment."),
  bg("tprm", "07:45", "document-classified", "evidence", "EVD-2026-40233", "Penetration test summary", "Classified the two page penetration test summary and extracted its scope statement verbatim, which is silent on whether the override interfaces were in scope."),
  bg("tprm", "07:45", "document-classified", "evidence", "EVD-2026-41435", "Exit and transition appendix", "Classified the exit and transition appendix and reconciled its assumptions against the Arcadia capability register, returning a dependency on an internal payment repair tool that Arcadia does not hold.", ["EVD-2026-41440"]),
  bg("tprm", "07:45", "document-classified", "evidence", "EVD-2026-41405", "Supplier subprocessor register", "Classified the supplier subprocessor register of 03.08.2026 into four subprocessor nodes with locations, services and stated data access scope, and flagged the stated access scope as supplier asserted and unverified."),

  bg("tprm", "07:45", "item-requested", "supplier", "TP-0042", "Swiss instance recovery evidence", "Requested recovery test evidence covering the Swiss instance of the payment repair service, which the existing report does not cover, so that the Swiss position is measured rather than unmeasured."),
  bg("tprm", "07:45", "item-requested", "contract", "CTR-2023-0117-A3", "Binding version confirmation", "Requested a single binary confirmation from Group Legal on which appendix version binds as at 06.10.2026, with both candidate versions attached, so that the reply confirms rather than determines."),

  bg("tprm", "07:45", "contradiction-identified", "supplier", "TP-0042", "Recovery objective asserted against recovery observed", "Identified that the service description asserts a recovery objective of 2 hours while the supplier's own test shows 3 hours 40 minutes, with no explanation, no remediation plan and no notification. The assertion and the observation are both the supplier's own.", ["EVD-2026-41425", "EVD-2026-40118"]),
  bg("tprm", "07:45", "contradiction-identified", "service", "SVC-0042-01", "Availability contracted against availability calculated", "Identified that contracted monthly availability is 99.7 excluding planned maintenance while Arcadia's own telemetry gives 99.62 for September (scenario figures). The difference is entirely the treatment of one maintenance overrun, and the contract does not define how an overrun is treated.", ["EVD-2026-41240", "EVD-2026-41425"]),

  bg("tprm", "07:45", "routine-update", "committee-item", "AG-CMT-NFR-2026-10-04", "Paper deadline placed", "Placed the committee paper deadline of 08.10.2026 at 12:00 on the work list with two business days remaining, and aged the three open supplier chases against it."),

  bg("tprm", "07:45", "escalated-to-human", "supplier", "TP-0042", "Materiality of the recovery gap", "Escalated for a human decision: whether the unassessed recovery gap is a material assurance failure that changes the reassessment conclusion, or a service level point for the monthly review. The evidence supports either characterisation and the choice commits Arcadia's position with the supplier."),

  /* ----------------------------------------------------------------------
     control-assurance at 07:45. Twenty rows.
     ---------------------------------------------------------------------- */

  bg("control-assurance", "07:45", "system-checked", "system", "SYS-0014", "Novalink RepairDesk", "Queried the override audit log for each of the 60 sample items, retrieving the override record, the rule evaluation trace, the reviewer identity and the release and review timestamps."),
  bg("control-assurance", "07:45", "system-checked", "system", "SYS-0031", "Arcadia RiskCore", "Queried the control, test, exception and remediation records for the secondary review control, including the control owner's recorded counter-position and the open documentation action."),
  bg("control-assurance", "07:45", "system-checked", "system", "SYS-0032", "Arcadia Evidence Vault", "Retrieved the control description version 4.1 of 14.01.2025 and the working paper set for the test, and confirmed that the description has not been updated since."),
  bg("control-assurance", "07:45", "system-checked", "system", "SYS-0017", "Client Static Data Master", "Checked the client static data records behind the four exception payments, confirming that each payment was subsequently confirmed correct by the client, which supports two of the control owner's three assertions."),

  bg("control-assurance", "07:45", "record-reconciled", "control-test", "TST-2026-0318", "Attribute matrix reconstructed", "Reconstructed the attribute matrix from the working paper folders into 60 rows by 5 attributes, returning 296 pass, 4 fail and 2 unable to conclude, and computed both deviation rates against the tolerable rate of 5 in 100.", ["EVD-2026-41852"]),
  bg("control-assurance", "07:45", "record-reconciled", "test-case", "EXC-TST-2026-0318-01", "Self review exception", "Reconciled the self review exception against the open remediation action, confirming that the action was raised to prevent exactly this failure and that the exception occurred 17 days before the action's revised due date.", ["EVD-2026-41105", "EVD-2026-41102"]),
  bg("control-assurance", "07:45", "record-reconciled", "test-case", "EXC-TST-2026-0318-02", "Sequence failure exception", "Recomputed the sequence gap from the raw timestamps, returning a review recorded 11 minutes and 19 seconds after release on the highest value item in the exception set."),
  bg("control-assurance", "07:45", "record-reconciled", "test-case", "EXC-TST-2026-0318-03", "Evidence failure exception", "Reconciled the override record showing a reason code with a null evidence reference against the reviewer interview note of 16.09.2026, in which the reviewer stated that the defect was well known in the team and that no document existed."),
  bg("control-assurance", "07:45", "record-reconciled", "test-case", "EXC-TST-2026-0318-04", "Configuration driven omission", "Reconciled the rule evaluation trace against the fallback window of 27.08.2026, confirming that the override falls inside the window and that the trace records a review waiver rather than a missing review action.", ["EVD-2026-41805", "EVD-2026-41810"]),
  bg("control-assurance", "07:45", "record-reconciled", "test-case", "UTC-TST-2026-0318-01", "Service account item", "Reconciled the recorded reviewer identity against the supplier account register, confirming a service account used by the bulk approval screen, and confirmed from the supplier correspondence of 18.09.2026 that the resolving log had a 30 day retention which had already expired."),
  bg("control-assurance", "07:45", "record-reconciled", "test-case", "UTC-TST-2026-0318-02", "Broken evidence link item", "Reconciled the broken evidence link against the supplier retention job of 01.09.2026 and the supplier restore commitment of 10.10.2026, returning two business days of float."),

  bg("control-assurance", "07:45", "document-classified", "evidence", "EVD-2026-41908", "Control description version 4.1", "Classified the control description and extracted the sentence stating that review applies to all manual overrides without exception, verbatim, so it can be set against the observed behaviour rather than paraphrased."),
  bg("control-assurance", "07:45", "document-classified", "evidence", "EVD-2026-41805", "Rule evaluation trace extract", "Classified the rule evaluation trace from the August exception and named the waiver code as a configured waiver rather than leaving it as an unparsed string in a log column."),
  bg("control-assurance", "07:45", "document-classified", "evidence", "EVD-2026-41855", "Control owner position record", "Classified the control owner's position record and separated its rationale into three distinct assertions: that no financial loss occurred, that all four payments were confirmed correct, and that the fourth exception was the system behaving as configured."),
  bg("control-assurance", "07:45", "document-classified", "evidence", "EVD-2026-41610", "Q4 test plan screen", "Classified the fourteen control descriptions in the Q4 test plan and screened them for the same pattern, returning three that assert unconditional enforcement of a system enforced gate."),

  bg("control-assurance", "07:45", "item-requested", "supplier", "TP-0042", "Tenant configuration export", "Requested the tenant configuration export covering every rule that affects the secondary review requirement, with rule conditions, origin, client configurability and firing history, under the contractual right that carries a four hour service level."),
  bg("control-assurance", "07:45", "item-requested", "control", "CTL-PAY-014", "Dual role assignment population", "Requested a count of analysts holding both the repair analyst and the secondary reviewer role assignments in the supplier system, per entity, so the population exposed to self review can be stated rather than inferred from one sample item."),

  bg("control-assurance", "07:45", "contradiction-identified", "control", "CTL-PAY-014", "Control description against implemented behaviour", "Identified that the control description asserts review without exception while the rule evaluation trace records a configured waiver on an override with no review record. This is a design testing finding independent of what the configuration turns out to contain.", ["EVD-2026-41908", "EVD-2026-41805"]),
  bg("control-assurance", "07:45", "contradiction-identified", "control-test", "TST-2026-0318", "Population bounded by time against enforcement bounded by state", "Identified that the tested population is bounded by a date range while the suspected enforcement condition depends on a system state, which means the population could not detect the pattern whatever the sample size."),

  bg("control-assurance", "07:45", "routine-update", "meeting", "TST-2026-0318", "Control owner challenge meeting", "Created the 10:30 control owner challenge meeting record with the four exception records and the control owner's position attached, so the meeting opens on evidence rather than on positions."),

  bg("control-assurance", "07:45", "escalated-to-human", "control-test", "TST-2026-0318", "Scope of the self review deviation", "Escalated for a human decision: whether the self review exception is an isolated lapse or a systemic access design failure. The answer depends on whether the remediation history makes the enabling defect known, which is a reading of a remediation record as a claim rather than as metadata."),

  /* ----------------------------------------------------------------------
     incident-resilience at 07:45. Twenty rows.
     ---------------------------------------------------------------------- */

  bg("incident-resilience", "07:45", "system-checked", "system", "SYS-0014", "Novalink RepairDesk", "Queried the configuration audit log for every fallback route mode change on record, returning seven windows including one on 23.09.2026 that does not appear in payment operations reporting.", ["EVD-2026-41810"]),
  bg("incident-resilience", "07:45", "system-checked", "system", "SYS-0015", "euroSIC Adapter", "Checked the Swiss clearing submission path for any recorded fallback capability, returning none, and confirmed that the only recovery option is manual submission through a correspondent."),
  bg("incident-resilience", "07:45", "system-checked", "system", "SYS-0031", "Arcadia RiskCore", "Queried the eleven controls mapped to the payment repair process with their types and frequencies, and the four impact tolerances on the corporate payments service with their measures.", ["EVD-2026-41700"]),
  bg("incident-resilience", "07:45", "system-checked", "system", "SYS-0032", "Arcadia Evidence Vault", "Retrieved the two runbooks, the last exercise report of 18.11.2025 and the Swiss tolerance record with the board committee minutes of 24.02.2026."),
  bg("incident-resilience", "07:45", "system-checked", "system", "SYS-0013", "Arcadia Direct Link", "Checked the fallback clearing route's own capability records, confirming that it performs no payment data validation, which is the documented reason repair volume rises when it is in use."),

  bg("incident-resilience", "07:45", "record-reconciled", "runbook", "RB-PAY-007", "Runbook assertion against the control inventory", "Reconciled the runbook's assertion that the control environment is unchanged during fallback operation against all eleven controls mapped to the process, returning the secondary review control as conditional on system state, which contradicts it.", ["EVD-2026-41705", "EVD-2026-41700"]),
  bg("incident-resilience", "07:45", "record-reconciled", "impact-tolerance", "ITOL-0004-03", "Swiss clearing tolerance measures", "Reconciled the Swiss clearing tolerance against the board committee minutes of 24.02.2026 and confirmed that the record states two measures and no precedence between them.", ["EVD-2026-41500"]),
  bg("incident-resilience", "07:45", "record-reconciled", "runbook", "RB-PAY-011", "Manual correspondent route lead time", "Reconciled the Swiss manual submission runbook's 45 minute preparation lead time against its review date of 14.01.2026 and against any rehearsal record, returning none, and computed a latest safe start time of 15:15 for a 16:00 cut-off (scenario figures).", ["EVD-2026-41710"]),
  bg("incident-resilience", "07:45", "record-reconciled", "kri", "KRI-RES-005", "Tested fallback indicator composition", "Decomposed the tested fallback indicator to name the corporate payments service as one of the untested services, and reconciled the September activation total of 8 hours 40 minutes against one hour in August."),
  bg("incident-resilience", "07:45", "record-reconciled", "service", "SVC-0042-05", "Swiss dependency chain", "Reconciled the Swiss clearing dependency chain to its hosting subprocessor and attached the open reassessment question showing no recovery evidence for the Swiss instance."),

  bg("incident-resilience", "07:45", "document-classified", "evidence", "EVD-2026-41705", "Clearing route substitution runbook", "Classified the runbook and extracted section 4's control assertion verbatim, so the contradiction is between quoted text and a control record rather than between two summaries."),
  bg("incident-resilience", "07:45", "document-classified", "evidence", "EVD-2026-41500", "Swiss tolerance record and minutes", "Classified the tolerance record and the board committee minutes and displayed the two measures separately, because presenting them as one threshold is what made the ambiguity invisible."),
  bg("incident-resilience", "07:45", "document-classified", "evidence", "EVD-2026-40118", "Supplier recovery test report", "Classified the supplier recovery test report and confirmed that its scope covers two hosting regions and does not cover the Swiss instance, which is the entity with the tightest tolerance."),
  bg("incident-resilience", "07:45", "document-classified", "exercise-report", "SBP-2025-11-18", "Last severe but plausible exercise", "Classified the exercise report of 18.11.2025 and extracted its scope statement, confirming that it tested a total gateway outage rather than fallback mode operation."),

  bg("incident-resilience", "07:45", "item-requested", "supplier", "TP-0042", "Swiss instance recovery evidence", "Requested recovery evidence for the Swiss instance through the third party risk owner, with the dependency stated so the request is not duplicated at working level."),
  bg("incident-resilience", "07:45", "item-requested", "runbook", "RB-PAY-011", "Manual route lead time confirmation", "Requested confirmation from the local resilience officer that manual correspondent submission is the only Swiss recovery option and that the 45 minute lead time is current, framed so it can be answered in one action."),

  bg("incident-resilience", "07:45", "contradiction-identified", "runbook", "RB-PAY-007", "Control assertion against the control inventory", "Identified that an operational runbook asserts an unchanged control environment during fallback operation while the control inventory records a control conditional on system state. The contradiction is between two Arcadia documents, and neither establishes what actually changes.", ["EVD-2026-41705", "EVD-2026-41700"]),
  bg("incident-resilience", "07:45", "contradiction-identified", "activation-window", "FBK-2026-09-23", "Configuration log against operations reporting", "Identified a fallback activation in the configuration audit log on 23.09.2026 that the September operations report does not contain, which independently corroborates the same anomaly found from the override side.", ["EVD-2026-41810"]),

  bg("incident-resilience", "07:45", "routine-update", "meeting", "IBS-0004", "Resilience working group agenda", "Assembled the 10:30 working group agenda with the tolerance review placed before the status items, because it carries the committee paper deadline and the status items do not."),

  bg("incident-resilience", "07:45", "escalated-to-human", "impact-tolerance", "ITOL-0004-03", "Handling of the two measure ambiguity", "Escalated for a human decision: whether the two measure ambiguity is raised now as a definitional finding or carried to the committee tolerance review as an open question. No divergence has been observed, which makes both routes defensible and makes the choice a judgment about how much weight an unrealised defect should carry."),

  /* ----------------------------------------------------------------------
     regulatory-change at 07:45. Seventeen rows.
     ---------------------------------------------------------------------- */

  bg("regulatory-change", "07:45", "system-checked", "system", "SYS-0031", "Arcadia RiskCore", "Queried the regulatory change register for the four in scope items with their per entity scope, and the obligation set with its terminal states per lane."),
  bg("regulatory-change", "07:45", "system-checked", "system", "SYS-0032", "Arcadia Evidence Vault", "Retrieved the draft internal tolerance standard, the filed Swiss outsourcing inventory and the data processing appendix, with version and filing dates."),
  bg("regulatory-change", "07:45", "system-checked", "system", "SYS-0033", "Arcadia Contract Repository", "Searched the contract repository for the transfer destinations named in the data processing appendix, returning Switzerland, Germany, the Czech Republic and Ireland, and no reference to India.", ["EVD-2026-41402"]),

  bg("regulatory-change", "07:45", "record-reconciled", "obligation", OBL_EU_SUBCONTRACTING, "Register completeness decomposed by state", "Decomposed the Tier 1 register completeness figure into four terminal states and localised the shortfall to the subcontracting chain fields on three named Tier 1 records. Illustrative regulatory context, not legal advice.", ["EVD-2026-41300"]),
  bg("regulatory-change", "07:45", "record-reconciled", "obligation", OBL_CH_INVENTORY_ACCESS, "Swiss inventory against the current service list", "Reconciled the Swiss outsourcing inventory filed 24.07.2026 against the current supplier service list, returning two significant outsourcings correctly recorded and one subprocessor absent. Illustrative regulatory context, not legal advice.", ["EVD-2026-41305"]),
  bg("regulatory-change", "07:45", "record-reconciled", "subprocessor", "TP-0042.4", "Service desk provider against both lanes", "Reconciled the service desk subprocessor into both lanes separately: a subcontracting chain question for the German and Austrian entities, and an inventory and data access question for the Swiss entity. The two determinations share no fields. Illustrative regulatory context, not legal advice."),
  bg("regulatory-change", "07:45", "record-reconciled", "obligation", "OBL-2026-0104-003", "Draft standard against the four tolerances", "Reconciled the draft tolerance standard's definition clauses against all four impact tolerances on the corporate payments service, returning one tolerance with two measures and a draft that is silent on precedence. Illustrative regulatory context, not legal advice.", ["EVD-2026-41310"]),
  bg("regulatory-change", "07:45", "record-reconciled", "service", "SVC-0042-03", "Classification against the payment type dependency", "Reconciled the format library service's classification against the payment types that depend on it, returning a non critical classification on a service whose failure would stop bulk file payments for all three entities. Illustrative regulatory context, not legal advice."),

  bg("regulatory-change", "07:45", "document-classified", "evidence", "EVD-2026-41310", "Draft internal tolerance standard", "Classified the draft standard of 21.09.2026 and extracted its tolerance definition clauses, confirming that they do not require a stated precedence where a tolerance has more than one measure. Illustrative regulatory context, not legal advice."),
  bg("regulatory-change", "07:45", "document-classified", "evidence", "EVD-2026-41305", "Swiss outsourcing inventory as filed", "Classified the inventory as filed on 24.07.2026 and confirmed the entries it contains and the one it does not, against a subprocessor onboarding date of 01.05.2026. Illustrative regulatory context, not legal advice."),
  bg("regulatory-change", "07:45", "document-classified", "evidence", "EVD-2026-41402", "Data processing and transfers appendix", "Classified the data processing appendix and extracted its named transfer destinations, so the question about a third country can be stated against the text rather than against a recollection of it."),
  bg("regulatory-change", "07:45", "document-classified", "evidence", "EVD-2026-41405", "Supplier subprocessor register", "Classified the supplier register into the Swiss lane, surfacing the service desk provider as a data access question that is not yet mapped to any obligation. Illustrative regulatory context, not legal advice."),

  bg("regulatory-change", "07:45", "item-requested", "subprocessor", "TP-0042.4", "Data access scope", "Requested written confirmation of the data fields accessible to the service desk subprocessor and the jurisdictions from which access occurs, because the only current source is the supplier's own register. Illustrative regulatory context, not legal advice."),
  bg("regulatory-change", "07:45", "item-requested", "obligation", OBL_CH_INVENTORY_ACCESS, "Transfer appendix scope opinion", "Requested a Group Legal position on whether read access to payment metadata from a third country falls within the scope of the data processing appendix, routed to the named counsel rather than to a mailbox, with the appendix text and the register row attached. Illustrative regulatory context, not legal advice."),

  bg("regulatory-change", "07:45", "contradiction-identified", "service", "SVC-0042-03", "Classification against dependency", "Identified that a service classified as not supporting a critical or important function is the only source of the format library that a payment type depends on. The classification and the dependency cannot both be right. Illustrative regulatory context, not legal advice."),

  bg("regulatory-change", "07:45", "routine-update", "meeting", "REG-2026-0031", "Regulatory change forum, dual lane", "Assembled the 10:30 forum with the dual lane separator enforced in the presented view and the Swiss lane attendee confirmed, so that neither lane's items can be discussed as the other's. Illustrative regulatory context, not legal advice."),

  bg("regulatory-change", "07:45", "escalated-to-human", "obligation", OBL_CH_INVENTORY_ACCESS, "Applicability per entity", "Escalated for a human decision: whether the service desk arrangement creates obligations in both lanes and whether the two resolve differently. Applicability per legal entity is a named human judgment on the record and is never a system output. Illustrative regulatory context, not legal advice."),

  /* ----------------------------------------------------------------------
     nfr-governance at 07:45. Nineteen rows.
     ---------------------------------------------------------------------- */

  bg("nfr-governance", "07:45", "system-checked", "system", "SYS-0031", "Arcadia RiskCore", "Queried the group indicator set, the seven overdue remediation actions with their causes, the live risk acceptance records and the committee agenda with per item readiness."),
  bg("nfr-governance", "07:45", "system-checked", "system", "SYS-0032", "Arcadia Evidence Vault", "Retrieved the remediation action history including the extension approval of 14.04.2026, the supplier delivery note and the unanswered acceptance testing request."),
  bg("nfr-governance", "07:45", "system-checked", "system", "SYS-0020", "Indicator Reporting Service", "Retrieved the September reporting run and confirmed that four of six group indicators are Red, each with a different owner in a different function.", ["EVD-2026-41820"]),
  bg("nfr-governance", "07:45", "system-checked", "system", "SYS-0018", "Loss and Event Register", "Checked the loss and event register for any entry connected to the four Red indicators, returning nil, which is a fact about the register rather than about the risks."),

  bg("nfr-governance", "07:45", "record-reconciled", "portfolio-theme", "THEME-PAY-01", "Causal chain assembled across four functions", "Assembled the seven node causal chain linking gateway availability, route substitution override growth, the override rate breach, reviewer establishment, the control rating, the overdue remediation and the residual position, with four links evidenced from records and two marked as inferences.", ["EVD-2026-41821"]),
  bg("nfr-governance", "07:45", "record-reconciled", "action", "MSN-2026-0147", "Overdue action aged and dependency verified", "Aged the overdue remediation action at exactly 67 days past its revised due date, verified its dependency chain end to end, and confirmed the infrastructure freeze end date from the change record.", ["EVD-2026-41280", "EVD-2026-41102", "EVD-2026-41205"]),
  bg("nfr-governance", "07:45", "record-reconciled", "action", "MSN-2026-0185", "Extension condition status", "Reconciled the extension granted 14.04.2026 against its monthly reporting condition, returning reports in May, June and July 2026 and none since, which is a failure in the committee's own follow up."),
  bg("nfr-governance", "07:45", "record-reconciled", "risk", "RSK-0184", "Risk acceptance conditions parsed", "Parsed the conditional risk acceptance from free text into two structured conditions with status, returning the reassessment in progress and the exit test not started, and computed 86 days to expiry.", ["EVD-2026-41204"]),
  bg("nfr-governance", "07:45", "record-reconciled", "kri", "KRI-GOV-001", "Overdue action count and trend", "Reconciled the overdue remediation count at seven against the action register, split it into four verifiably dependency blocked and three with no verifiable activity, and positioned it against the Red threshold of nine."),
  bg("nfr-governance", "07:45", "record-reconciled", "committee", "CMT-NFR-2026-10", "Committee readiness per item", "Computed readiness per agenda item against the papers deadline of 08.10.2026 at 12:00, returning three of five decision items undrafted and two items whose underlying facts do not yet exist."),

  bg("nfr-governance", "07:45", "document-classified", "evidence", "EVD-2026-41821", "Causal chain analysis object", "Classified the assembled chain as a hypothesis with declared inferences rather than as an established finding, and attached to each link the evidence reference or the reason it is an inference."),
  bg("nfr-governance", "07:45", "document-classified", "evidence", "EVD-2026-41105", "Internal audit report of 28.11.2025", "Classified the audit report and extracted the finding that produced the overdue remediation action, with its original and revised due dates and the extension approval."),
  bg("nfr-governance", "07:45", "document-classified", "evidence", "EVD-2026-41204", "Conditional risk acceptance record", "Classified the acceptance record and extracted its two conditions, its approver and its expiry, moving the condition status out of a free text field into structured fields."),

  bg("nfr-governance", "07:45", "item-requested", "action", "MSN-2026-0147", "Re-baselining question to the action owner", "Requested a re-baselining position from the action owner built around verifiable facts rather than around performance, attaching the delivery date, the unanswered testing request and the freeze end date, so the reply is useful rather than defensive."),
  bg("nfr-governance", "07:45", "item-requested", "committee", "CMT-NFR-2026-10", "Joint position availability", "Requested confirmation of whether a joint control position will be available before papers close, replaced by a live readiness view showing both functions' states and the dependency between them."),

  bg("nfr-governance", "07:45", "contradiction-identified", "risk", "RSK-0184", "Valid acceptance against a defeated condition", "Identified that a risk acceptance is recorded as valid while one of its conditions is not merely unmet but unexecutable, because the exit plan it depends on assumes a capability the capability register shows Arcadia does not hold.", ["EVD-2026-41204", "EVD-2026-41440"]),
  bg("nfr-governance", "07:45", "contradiction-identified", "action", "MSN-2026-0147", "Reported progress against verifiable evidence", "Identified that the action is reported at 60 of 100 complete by its owner while the only verifiable facts are a supplier delivery on 18.09.2026 and an unanswered acceptance testing request from 22.09.2026. No evidence supports or contradicts the reported figure.", ["EVD-2026-41102", "EVD-2026-41205"]),

  bg("nfr-governance", "07:45", "routine-update", "committee", "CMT-NFR-2026-10", "Indicator routing with owner deadlines", "Routed each of the four Red indicators to its owner with that owner's own deadline attached, and recorded the blocking chain from the assurance conclusion through the residual rating to the assessment sign-off and the committee paper."),

  bg("nfr-governance", "07:45", "escalated-to-human", "portfolio-theme", "THEME-PAY-01", "Aggregate position on the four Red indicators", "Escalated for a human decision: whether the four Red indicators are reported as four problems or as one causal chain with two inferred links. Aggregation is interpretation, and a chain presented as established would be more persuasive and less defensible."),
];

/* ==========================================================================
   Pre existing audit history

   Exactly twenty rows, all before 06.10.2026, all with preExisting true.
   They exist so that the audit trail the product shows on the scenario day
   opens onto a history rather than onto an empty table, and so that the
   uncomfortable sequence is inspectable: a supplier release approved on
   release notes in November 2024, a control description published in
   January 2025 that the release had already contradicted, and an audit
   finding in November 2025 whose remediation is still open.

   The rows are in chronological order, which is the order an auditor reads
   them in.
   ========================================================================== */

export const preExistingAuditEvents: NewAuditEvent[] = [
  {
    id: "AUE-2024-0001",
    runId: DEFAULT_RUN_ID,
    atMoment: "18:40",
    recordedAt: "2024-11-11T18:40:00.000Z",
    category: "approval",
    action: "approveSupplierRelease",
    objectKind: "change",
    objectId: "CHG-2024-5512",
    actorUserId: null,
    actorKind: "system",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "RepairDesk release 8.3 approved for the arcadia-prod tenant on the basis of supplier release notes referring to continuity throughput improvements for fallback routing. No control owner review was recorded. The release applied a standard configuration template that set the secondary review requirement to false for route substitution overrides below EUR 250,000 while the fallback route is active.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { release: "8.3", template: "BCP-THROUGHPUT-v2", controlOwnerReview: false },
    preExisting: true,
  },
  {
    id: "AUE-2025-0002",
    runId: DEFAULT_RUN_ID,
    atMoment: "09:15",
    recordedAt: "2025-01-14T09:15:00.000Z",
    category: "mutation",
    action: "publishControlDescription",
    objectKind: "control",
    objectId: CTL_FOUR_EYES,
    actorUserId: "P-008",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Control description version 4.1 published, stating that an independent secondary reviewer records approval before release for each manual override and that this applies to all overrides without exception. This is two months after the release that introduced a configured waiver, and the description has not been updated since.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { version: "4.1", supersedes: "4.0" },
    preExisting: true,
  },
  {
    id: "AUE-2025-0003",
    runId: DEFAULT_RUN_ID,
    atMoment: "16:05",
    recordedAt: "2025-02-14T16:05:00.000Z",
    category: "mutation",
    action: "executeContractAppendix",
    objectKind: "contract",
    objectId: "CTR-2023-0117-A3",
    actorUserId: "P-016",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Subprocessor appendix version 4.2 executed, listing three subprocessors with one hosting region for the managed database provider. This is the version the contract repository marks as binding as at 06.10.2026.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { version: "4.2", subprocessorCount: 3 },
    preExisting: true,
  },
  {
    id: "AUE-2025-0004",
    runId: DEFAULT_RUN_ID,
    atMoment: "11:20",
    recordedAt: "2025-11-28T11:20:00.000Z",
    category: "mutation",
    action: "issueAuditReport",
    objectKind: "audit-report",
    objectId: "AUD-2025-09",
    actorUserId: "P-017",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Internal audit report on Payment Operations issued, including finding F3: the payment repair system permits an override creator to be recorded as the secondary reviewer, because one user can hold both role assignments.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { findings: 3, thirdLine: true },
    preExisting: true,
  },
  {
    id: "AUE-2025-0005",
    runId: DEFAULT_RUN_ID,
    atMoment: "11:35",
    recordedAt: "2025-11-28T11:35:00.000Z",
    category: "mutation",
    action: "createAction",
    objectKind: "action",
    objectId: "MSN-2026-0147",
    actorUserId: "P-017",
    actorKind: "human",
    roleId: "control-assurance",
    entityId: ENTITY_DE,
    summary:
      "Remediation action raised from audit finding F3 to implement role segregation enforcement in the payment repair system, accountable to the process owner with the control owner as delegate, originally due 31.03.2026.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { source: "AUD-2025-09-F3", originalDueOn: "2026-03-31" },
    preExisting: true,
  },
  {
    id: "AUE-2026-0006",
    runId: DEFAULT_RUN_ID,
    atMoment: "15:10",
    recordedAt: "2026-01-19T15:10:00.000Z",
    category: "approval",
    action: "approveRiskAcceptance",
    objectKind: "risk",
    objectId: RSK_THIRD_PARTY_SERVICE,
    actorUserId: "P-014",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Conditional Risikoakzeptanz approved for the third party payment service risk, valid to 31.12.2026, conditioned on completing the 2026 reassessment and performing an exit and substitutability test. No follow up mechanism was recorded for either condition.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { validTo: "2026-12-31", conditions: 2, trackingMechanism: "none recorded" },
    preExisting: true,
  },
  {
    id: "AUE-2026-0007",
    runId: DEFAULT_RUN_ID,
    atMoment: "14:45",
    recordedAt: "2026-02-24T14:45:00.000Z",
    category: "approval",
    action: "setImpactTolerance",
    objectKind: "impact-tolerance",
    objectId: ITOL_CH_CLEARING,
    actorUserId: "P-015",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_CH,
    summary:
      "ARC-CH Board Risk Committee set the Swiss clearing impact tolerance with two measures: a maximum tolerable disruption of two hours, and completion of submission before the same day cut-off. The minutes record both measures and do not state which governs if they diverge.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { measures: 2, precedenceStated: false },
    preExisting: true,
  },
  {
    id: "AUE-2026-0008",
    runId: DEFAULT_RUN_ID,
    atMoment: "15:30",
    recordedAt: "2026-03-11T15:30:00.000Z",
    category: "approval",
    action: "reviewImpactTolerances",
    objectKind: "service",
    objectId: "IBS-0004",
    actorUserId: "P-014",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Group NFR Committee reviewed the group level impact tolerances for the corporate payments service, including the zero tolerance statement that no payment is released without the control gates defined for its release path. No detection capability was specified for the zero tolerance statement.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { tolerancesReviewed: 3, detectionSpecified: false },
    preExisting: true,
  },
  {
    id: "AUE-2026-0009",
    runId: DEFAULT_RUN_ID,
    atMoment: "15:50",
    recordedAt: "2026-04-14T15:50:00.000Z",
    category: "approval",
    action: "approveActionExtension",
    objectKind: "action",
    objectId: "MSN-2026-0147",
    actorUserId: "P-014",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Group NFR Committee approved one extension of the role segregation remediation action from 31.03.2026 to 31.07.2026, on a condition of monthly progress reporting to the committee. Reports were made in May, June and July 2026 and none since.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { revisedDueOn: "2026-07-31", condition: "monthly progress reporting", conditionMet: false },
    preExisting: true,
  },
  {
    id: "AUE-2026-0010",
    runId: DEFAULT_RUN_ID,
    atMoment: "09:05",
    recordedAt: "2026-05-22T09:05:00.000Z",
    category: "system",
    action: "receiveSupplierEvidence",
    objectKind: "evidence",
    objectId: "EVD-2026-40118",
    actorUserId: null,
    actorKind: "external",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Supplier disaster recovery test report received for the payment repair service. The report shows recovery in 3 hours 40 minutes against a contracted objective of 2 hours and covers two hosting regions, not the Swiss instance. No notification of the objective miss accompanied it.",
    authorityClass: "READ",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { testedRecovery: "3h40m", contractedObjective: "2h", swissInstanceCovered: false },
    preExisting: true,
  },
  {
    id: "AUE-2026-0011",
    runId: DEFAULT_RUN_ID,
    atMoment: "10:20",
    recordedAt: "2026-06-15T10:20:00.000Z",
    category: "mutation",
    action: "retainEvidenceDocument",
    objectKind: "evidence",
    objectId: "EVD-2026-40118",
    actorUserId: "P-002",
    actorKind: "human",
    roleId: "tprm",
    entityId: ENTITY_DE,
    summary:
      "Recovery test report retained in the evidence vault with a retention class and a provenance record. No assessment was recorded against it. It remained retrievable and unassessed for 137 days.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { retentionClass: "TPRM-5Y", assessmentRecorded: false },
    preExisting: true,
  },
  {
    id: "AUE-2026-0012",
    runId: DEFAULT_RUN_ID,
    atMoment: "16:30",
    recordedAt: "2026-07-08T16:30:00.000Z",
    category: "decision",
    action: "signAssessment",
    objectKind: "assessment",
    objectId: "RCSA-ARC-DE-PAYOPS-2026-Q3",
    actorUserId: "P-007",
    actorKind: "human",
    roleId: "rcsa",
    entityId: ENTITY_DE,
    summary:
      "Q3 assessment signed for the payment operations unit. The payment release risk was rated with a control environment of Effective and a residual score of 6 of 25, within appetite, with no consequence required.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { residualScore: 6, controlEnvironment: "effective", appetitePosition: "within" },
    preExisting: true,
  },
  {
    id: "AUE-2026-0013",
    runId: DEFAULT_RUN_ID,
    atMoment: "17:00",
    recordedAt: "2026-07-31T17:00:00.000Z",
    category: "system",
    action: "recordPositionVacancy",
    objectKind: "position",
    objectId: "PR-SR-02",
    actorUserId: "P-018",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Secondary reviewer position vacated on the leaver's last working day. Filled reviewer capacity falls to 3.0 of 4.0 approved, which puts the establishment indicator into Red from 01.08.2026 and concentrates second reviews on one senior analyst.",
    authorityClass: "READ",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { filledFte: 3, approvedFte: 4 },
    preExisting: true,
  },
  {
    id: "AUE-2026-0014",
    runId: DEFAULT_RUN_ID,
    atMoment: "08:00",
    recordedAt: "2026-08-03T08:00:00.000Z",
    category: "system",
    action: "observeSupplierPublication",
    objectKind: "supplier",
    objectId: TP_NOVALINK,
    actorUserId: null,
    actorKind: "external",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Supplier published subprocessor register version 6.1 on its client portal, listing four subprocessors including a service desk provider in a third country onboarded 01.05.2026, and a second hosting region for a listed subprocessor. Arcadia received no separate notice and did not read the publication for 64 days.",
    authorityClass: "READ",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { version: "6.1", subprocessorCount: 4, separateNoticeReceived: false },
    preExisting: true,
  },
  {
    id: "AUE-2026-0015",
    runId: DEFAULT_RUN_ID,
    atMoment: "12:15",
    recordedAt: "2026-08-12T12:15:00.000Z",
    category: "approval",
    action: "approveRecruitment",
    objectKind: "position",
    objectId: "PR-SR-02",
    actorUserId: "P-007",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Recruitment approved for the vacant secondary reviewer position. Two candidates were subsequently rejected at second interview and no start date exists as at 06.10.2026.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { rejections: 2, startDate: null },
    preExisting: true,
  },
  {
    id: "AUE-2026-0016",
    runId: DEFAULT_RUN_ID,
    atMoment: "09:30",
    recordedAt: "2026-09-15T09:30:00.000Z",
    category: "mutation",
    action: "openSupplierReassessment",
    objectKind: "supplier",
    objectId: TP_NOVALINK,
    actorUserId: "P-002",
    actorKind: "human",
    roleId: "tprm",
    entityId: ENTITY_DE,
    summary:
      "Annual reassessment opened for the payment services provider with a questionnaire of 214 questions across 11 domains and 41 evidence artefacts requested, target completion 31.10.2026.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { questions: 214, artefactsRequested: 41, targetClose: "2026-10-31" },
    preExisting: true,
  },
  {
    id: "AUE-2026-0017",
    runId: DEFAULT_RUN_ID,
    atMoment: "14:10",
    recordedAt: "2026-09-21T14:10:00.000Z",
    category: "mutation",
    action: "createIssue",
    objectKind: "contract",
    objectId: "CTR-2023-0117-A3",
    actorUserId: "P-002",
    actorKind: "human",
    roleId: "tprm",
    entityId: ENTITY_DE,
    summary:
      "Divergence identified between the binding subprocessor appendix and the supplier's current register: one undisclosed subprocessor in a third country with payment metadata access, one undisclosed hosting region, and fourth parties not addressed by the appendix as drafted.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { divergenceRows: 4, noticeOnRecord: false },
    preExisting: true,
  },
  {
    id: "AUE-2026-0018",
    runId: DEFAULT_RUN_ID,
    atMoment: "17:20",
    recordedAt: "2026-09-25T17:20:00.000Z",
    category: "decision",
    action: "recordTestConclusion",
    objectKind: "control-test",
    objectId: TST_FOUR_EYES,
    actorUserId: "P-004",
    actorKind: "human",
    roleId: "control-assurance",
    entityId: ENTITY_DE,
    summary:
      "Control test report issued on the independent secondary review control: four exceptions and two items on which the tester could not conclude, from a sample of 60 against a population of 1,204. Conclusion Partially Effective, with a design and an operating deficiency. The root cause of the fourth exception was recorded as system configuration and was not pursued further.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { exceptions: 4, unableToConclude: 2, conclusion: "partially-effective" },
    preExisting: true,
  },
  {
    id: "AUE-2026-0019",
    runId: DEFAULT_RUN_ID,
    atMoment: "11:45",
    recordedAt: "2026-09-29T11:45:00.000Z",
    category: "decision",
    action: "recordControlOwnerPosition",
    objectKind: "control",
    objectId: CTL_FOUR_EYES,
    actorUserId: "P-008",
    actorKind: "human",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "Control owner recorded a Fully Effective position against the second line conclusion, on three grounds: no financial loss occurred, all four exception payments were subsequently confirmed correct by the clients, and the fourth exception was the system behaving as configured.",
    authorityClass: "APPROVAL_REQUIRED",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: true,
    detail: { position: "fully-effective", assertions: 3 },
    preExisting: true,
  },
  {
    id: "AUE-2026-0020",
    runId: DEFAULT_RUN_ID,
    atMoment: "06:00",
    recordedAt: "2026-10-05T06:00:00.000Z",
    category: "system",
    action: "publishIndicatorRun",
    objectKind: "kri",
    objectId: KRI_OVERRIDE_RATE,
    actorUserId: null,
    actorKind: "system",
    roleId: null,
    entityId: ENTITY_DE,
    summary:
      "September indicator reporting run published with data as at 30.09.2026. The manual override rate breached Red for the first time in 14 months, the payment repair rate breached Red for a third consecutive month outside Green, and the secondary reviewer establishment remained Red. Three payments indicators with three different owners.",
    authorityClass: "READ",
    decisionId: null,
    approvalId: null,
    blocked: false,
    blockedReason: null,
    reversible: false,
    detail: { breaches: 3, firstRedIn: "14 months" },
    preExisting: true,
  },
];
