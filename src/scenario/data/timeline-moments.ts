/**
 * The sixty timeline cells: ten moments, six roles.
 *
 * Authoritative source: docs/EXPERIENCE_MAP.md sections 3 to 12. Each row is
 * one cell of that document. Where this module and the experience map
 * disagree, the map wins and this module is fixed.
 *
 * Two things every row has to do.
 *
 *   The today narrative has to be specific. Which system is opened, which
 *   spreadsheet, what is re-keyed, what is waited for. "Manual processes are
 *   inefficient" is not a narrative; "opens the reassessment tracker, an
 *   Excel workbook on a shared drive, and filters column H to see which of
 *   214 questions have responses" is.
 *
 *   The future narrative has to be completed work, not promised work. It
 *   describes what was already done before the professional arrived, which
 *   is why every row is written in the past tense and why nothing in the
 *   future narrative is a decision.
 *
 * Moment identifiers M01 to M10 match src/scenario/data/institution.ts.
 *
 * Synthetic institution and data. All persons are fictional. All figures are
 * scenario figures and none is a benchmark.
 */

import { DEFAULT_RUN_ID, type NewTimelineRoleMoment } from "./contract";

/** The fields that differ per cell. Identifiers are derived, not written. */
interface MomentSpec {
  workObjectKind: string;
  workObjectId: string | null;
  headline: string;
  todayNarrative: string;
  todaySignals: string[];
  futureNarrative: string;
  futureSignals: string[];
  evidenceIds: string[];
  decisionIds: string[];
  uncertaintyNote: string;
}

/** Expands one cell. The identifier is the moment and the role, so it is stable. */
function cell(
  timelineEventId: string,
  roleId: NewTimelineRoleMoment["roleId"],
  spec: MomentSpec,
): NewTimelineRoleMoment {
  return {
    id: `TRM-${timelineEventId}-${roleId}`,
    runId: DEFAULT_RUN_ID,
    timelineEventId,
    roleId,
    workObjectKind: spec.workObjectKind,
    workObjectId: spec.workObjectId,
    headline: spec.headline,
    todayNarrative: spec.todayNarrative,
    todaySignals: spec.todaySignals,
    futureNarrative: spec.futureNarrative,
    futureSignals: spec.futureSignals,
    evidenceIds: spec.evidenceIds,
    decisionIds: spec.decisionIds,
    uncertaintyNote: spec.uncertaintyNote,
  };
}

export const timelineRoleMoments: NewTimelineRoleMoment[] = [
  /* ======================================================================
     M01  07:45  Morning decision brief

     The most important moment in the product, and the 14:05 event is not.
     Everything in the morning situation is already true before anyone opens
     anything, and nothing in Arcadia's existing reporting connects any of
     it. Every cell is read only: a brief that writes to the system of
     record before the human has read it inverts the accountability.
     ====================================================================== */

  cell("M01", "tprm", {
    workObjectKind: "decision-brief",
    workObjectId: "TP-0042",
    headline: "A supplier whose disclosure discipline has degraded, in four assertion deltas",
    todayNarrative:
      "Opens Outlook to 61 unread messages. Opens Arcadia RiskCore to the third-party module and reads the Novalink record. Opens the reassessment tracker, an Excel workbook named TPRM-Q-2026-tracker-v14.xlsx on a shared drive, last edited by him at 18:42 on 02.10.2026, and filters column H to see which of 214 questions have responses. The workbook cannot tell him which of the 33 received artefacts he has actually read. Opens the contract repository in a second browser tab to check an appendix version, gets the document management search, and gives up after two attempts. Thirty five to fifty minutes to arrive at a list rather than a picture.",
    todaySignals: [
      "61 unread messages, 14 of them about one supplier",
      "TPRM-Q-2026-tracker-v14.xlsx on a shared drive, column H filtered by hand",
      "No way to distinguish an artefact received from an artefact assessed",
      "Two failed searches in the contract repository before he stops trying",
    ],
    futureNarrative:
      "The reassessment state was reconciled from source rather than from the workbook. The binding appendix was retrieved with its version date and reconciled node by node against the supplier's current register, producing a four row divergence table with evidence on each row. September gateway availability was calculated from Arcadia telemetry because the supplier has not published it. The recovery test report that has sat in the vault since 22.05.2026 was parsed and its recovery gap located, with the artefact's 137 unassessed days computed.",
    futureSignals: [
      "Reassessment state from source: 198 of 214 responses, 33 of 41 artefacts received, 26 accepted",
      "Four row divergence table between the binding appendix and the supplier register",
      "September availability calculated at 99.62 against a contracted 99.7 (scenario figures)",
      "Recovery objective of 2 hours against a tested 3 hours 40 minutes, unassessed for 137 days",
      "Subprocessor record completeness shortfall localised to the subcontracting chain fields",
    ],
    evidenceIds: ["EVD-2026-41410", "EVD-2026-41405", "EVD-2026-40118", "EVD-2026-40233", "EVD-2026-41445", "EVD-2026-41240"],
    decisionIds: ["DEC-2026-0741", "DEC-2026-0742", "DEC-2026-0743"],
    uncertaintyNote:
      "The availability figure is calculated from Arcadia-side submission telemetry, not from a supplier service report, and the supplier has not published September. If the supplier's measurement excludes different maintenance windows the figure differs and the service level conclusion may not hold. Separately, whether publication of the register on the supplier's client portal constitutes notice under the appendix is a contractual question and this system does not answer it.",
  }),

  cell("M01", "rcsa", {
    workObjectKind: "decision-brief",
    workObjectId: "RSK-0211",
    headline: "Two pressure components moved and three error components did not",
    todayNarrative:
      "Opens the indicator report, a 34 page PDF emailed at 06:04 on 05.10.2026, with three Red rows on page 11. Opens RiskCore to read the Q3 assessment for the payment release risk. Opens her own pre-read, RCSA-PAYOPS-Q4-preread-v3.docx, to check what she committed to on 02.10.2026. Opens the override extract the first line sent on 01.10.2026, an Excel file of 731 rows with no reason code summary, and builds a pivot table by hand. The pivot is where the finding is, and on a normal morning she does not have time to build it. The workshop is at 10:30.",
    todaySignals: [
      "A 34 page indicator PDF with the three Red rows on page 11",
      "A 731 row override extract with no reason code summary",
      "A pivot table built by hand, which is where the real finding lives",
      "Two hours forty five minutes to a workshop with a contested rating",
    ],
    futureNarrative:
      "The override rate indicator was decomposed by reason code across two months and the movement ranked: route substitution rose from 31 to 198, cut-off driven from 94 to 211, and the three error components are broadly flat. The route substitution growth was reconciled to five gateway fallback activations totalling 8 hours 40 minutes in September against one hour in August. The establishment indicator was linked to a named vacant position and its overdue recruitment action. The control test conclusion and the control owner's counter-position were retrieved as two attributed statements rather than one.",
    futureSignals: [
      "Route substitution overrides 31 to 198, cut-off driven 94 to 211, three error codes flat",
      "Five September fallback activations totalling 8 hours 40 minutes against one hour in August",
      "Reviewer establishment 3.0 filled of 4.0 approved, vacant since 31.07.2026",
      "Two attributed control positions, not one merged rating",
      "A residual worksheet prepared with the inherent scores carried forward and the residual cells empty",
    ],
    evidenceIds: ["EVD-2026-41820", "EVD-2026-41821", "EVD-2026-41810", "EVD-2026-41850", "EVD-2026-41855", "EVD-2026-41202", "EVD-2026-41200"],
    decisionIds: ["DEC-2026-0771", "DEC-2026-0744", "DEC-2026-0745"],
    uncertaintyNote:
      "The attribution of route substitution growth to fallback activation rests on temporal correlation across five September windows, because the override records carry no field linking them to an activation. On current data 181 of 198 fall inside the windows and 17 do not, of which 11 fall on one afternoon with no activation recorded. Separately, zero recorded losses over 24 months is a verified fact about the loss register and is not evidence about likelihood unless detection is known to be effective.",
  }),

  cell("M01", "control-assurance", {
    workObjectKind: "decision-brief",
    workObjectId: "TST-2026-0318",
    headline: "His own conclusion is blocking someone else's workshop",
    todayNarrative:
      "Opens his working papers, a shared drive folder with 60 sample sub-folders, an Excel attribute matrix and a Word report. Opens RiskCore to see whether the control owner has responded, and finds a Fully Effective position recorded 29.09.2026 with a three line rationale. Opens the two items he could not conclude on and re-reads his own notes. Opens the supplier correspondence thread to check whether the 10.10.2026 restore commitment has moved. Nothing in any of these tools tells him that his unsettled conclusion is blocking the 10:30 workshop.",
    todaySignals: [
      "60 sample sub-folders on a shared drive, one folder at a time",
      "An Excel attribute matrix and a Word report as the working papers",
      "A three line counter-position with no structured assertions",
      "No system anywhere shows him that he is blocking a colleague",
    ],
    futureNarrative:
      "The attribute matrix was reconstructed from the working papers into 60 rows by 5 attributes with 296 pass, 4 fail and 2 unable to conclude, and both deviation rates were computed against the tolerable rate. The unresolvable item was flagged as permanently lost with the log expiry date stated. The population's time bounding was surfaced as a scope property rather than left implicit. The rule evaluation trace on the fourth exception was retrieved verbatim, and his own root cause field, recorded as system configuration, was shown alongside the documentation action that has not started. His conclusion was flagged as blocking the workshop.",
    futureSignals: [
      "60 by 5 attribute matrix: 296 pass, 4 fail, 2 unable to conclude",
      "Deviation rates of 4 in 60 and 6 in 60 against a tolerable 5 in 100",
      "One item permanently unresolvable: a service account identity with an expired log",
      "His own conclusion flagged as blocking the 10:30 workshop, which is the most useful line in the brief",
      "A design against operating split prepared with the fourth exception marked undetermined rather than assigned",
    ],
    evidenceIds: ["EVD-2026-41852", "EVD-2026-41850", "EVD-2026-41908", "EVD-2026-41805", "EVD-2026-41855", "EVD-2026-41610"],
    decisionIds: ["DEC-2026-0746", "DEC-2026-0747", "DEC-2026-0748"],
    uncertaintyNote:
      "The sample was random but not stratified by value or by override reason code. The exception set contains one item above EUR 1.2m and three below EUR 85,000, which is a distribution the sampling method did not control for, and a value stratified sample would produce a different exception profile. The unresolvable item cannot be resolved at all: the human identity was held in a supplier log with 30 day retention that expired before the question was asked.",
  }),

  cell("M01", "incident-resilience", {
    workObjectKind: "decision-brief",
    workObjectId: "IBS-0004",
    headline: "A tolerance with two measures, eight hours before the ambiguity stops being theoretical",
    todayNarrative:
      "Opens the resilience dashboard in RiskCore, which shows the tested fallback indicator as a percentage and a list of services with a tested flag. Opens her own tracker, Resilience-testing-plan-2026.xlsx, to see when corporate payments was last tested. Opens the Swiss clearing tolerance record to prepare for the committee item, reads the threshold, and does not read it as a definition. Opens the supplier reassessment tracker to check the Swiss recovery evidence question and cannot tell whether it has been escalated, so she emails to ask. Her morning has no way of telling her that five fallback activations happened in her coverage area in September.",
    todaySignals: [
      "Resilience-testing-plan-2026.xlsx as the record of what has been tested",
      "A tolerance read as a threshold rather than as a definition",
      "An email sent to ask a question a tracker should answer",
      "Five September fallback activations invisible to her, because they reached payments reporting",
    ],
    futureNarrative:
      "The tested fallback indicator was decomposed to name corporate payments as one of the untested services. The five September activations were aggregated to 8 hours 40 minutes against one hour in August and presented as a dependency degradation signal rather than as a payments statistic, which is the reframing no existing report performs. The runbook's section 4 control assertion was extracted verbatim and reconciled against all eleven controls on the repair process, which contradicts it. The Swiss tolerance was retrieved with both measures displayed separately and no precedence found in the record.",
    futureSignals: [
      "Corporate payments named as an untested service rather than counted in a percentage",
      "Five activations, 8 hours 40 minutes, reframed as dependency degradation",
      "Runbook section 4 contradicted by the control inventory, quoted verbatim",
      "The Swiss tolerance shown as two measures with no precedence stated anywhere",
      "The Swiss instance recovery evidence question surfaced with its owner and its age",
    ],
    evidenceIds: ["EVD-2026-41705", "EVD-2026-41710", "EVD-2026-41500", "EVD-2026-41810", "EVD-2026-40118", "EVD-2026-41700"],
    decisionIds: ["DEC-2026-0749", "DEC-2026-0750", "DEC-2026-0751"],
    uncertaintyNote:
      "The runbook contradiction is between two Arcadia documents and not between a document and an observed fact. This system has not verified the actual system configuration and cannot state what changes during fallback operation. The Swiss tolerance contains two measures and the record does not state which governs if they diverge; no divergence has been observed, so the ambiguity is currently theoretical.",
  }),

  cell("M01", "regulatory-change", {
    workObjectKind: "obligation-lineage",
    workObjectId: "REG-2026-0031",
    headline: "A completeness figure that conceals a structural gap, in two jurisdictions",
    todayNarrative:
      "Opens the regulatory change tracker in RiskCore, which lists four in scope items with status colours. Opens the register completeness report, which gives a Tier 1 figure and cannot show which records or which fields, so he emails the third-party risk owner to ask. Opens the draft internal tolerance standard, 23 pages, in consultation to 23.10.2026, and skims it because he wrote most of it. Opens two noting paper templates. His real risk today is a jurisdictional category error in a noting item nobody will read carefully, and nothing in his morning flags that. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "Four in scope items shown as status colours with no field level detail",
      "Obligation-mapping-master-v22.xlsx, 1,840 rows, two tabs for two jurisdictions",
      "An email sent for a figure the tracker should decompose",
      "Two noting templates, which is where category errors get through",
    ],
    futureNarrative:
      "The register completeness figure was decomposed into four terminal states and the shortfall localised to the subcontracting chain fields on three named Tier 1 records. The Swiss inventory was checked against the current supplier service list, returning two significant outsourcings correctly recorded and one subprocessor absent. The supplier register was cross-read into the Swiss lane, surfacing a service desk provider in a third country as a data access question not yet mapped to any obligation. The draft tolerance standard's definition clauses were reconciled against all four tolerances on the payments service, returning exactly one tolerance with two measures.",
    futureSignals: [
      "Completeness decomposed into evidenced, unevidenced, stale and unmapped on three named records",
      "One subprocessor absent from the Swiss inventory filed 24.07.2026, onboarded 01.05.2026",
      "The same arrangement rendered twice, once per lane, with different evidence requirements",
      "The draft standard silent on measure precedence, against one tolerance that has two measures",
      "Both noting paper structures prepared with the entity scope field pre-populated and the lane separator enforced",
    ],
    evidenceIds: ["EVD-2026-41300", "EVD-2026-41305", "EVD-2026-41405", "EVD-2026-41402", "EVD-2026-41310"],
    decisionIds: ["DEC-2026-0752", "DEC-2026-0753", "DEC-2026-0754"],
    uncertaintyNote:
      "The subprocessor's data access scope is stated by the supplier in its own register and has not been verified by Arcadia. Whether the access requires assessment in the Swiss lane depends on the actual data scope, which is unverified. The observation about the draft standard is about draft text and is not a defect finding: whether it matters depends on whether any tolerance actually has two measures, and one does. Illustrative regulatory context, not legal advice.",
  }),

  cell("M01", "nfr-governance", {
    workObjectKind: "portfolio-thread",
    workObjectId: "THEME-PAY-01",
    headline: "Four Red rows owned by four people that are one causal chain",
    todayNarrative:
      "Opens the group dashboard, which shows six indicators with four in Red and an overdue action count of seven. The four Reds sit in four rows owned by four people. Opens the committee tracker, a spreadsheet, and counts three of five decision items undrafted against a deadline of 08.10.2026 at 12:00. Opens the overdue role segregation action, sees 60 of 100 complete with a revised due date of 31.07.2026, and has to calculate 67 days herself. Opens the risk acceptance record and sees a valid acceptance; the condition status is in a free text field she does not read.",
    todaySignals: [
      "Four Red indicator rows, four owners, four functions, no connection drawn anywhere",
      "A committee readiness spreadsheet counted by hand",
      "An overdue age of 67 days calculated mentally from a due date",
      "Acceptance condition status held in a free text field",
    ],
    futureNarrative:
      "The causal chain was assembled as one object with seven nodes and six evidenced or inferred links, running from gateway availability through route substitution growth and reviewer establishment to the control rating, the overdue remediation and the residual position. Committee readiness was computed per agenda item against the papers deadline. The overdue action was aged at exactly 67 days with the 60 day escalation rule shown as triggered on 29.09.2026. The risk acceptance was parsed from free text into two conditions with status and an expiry 86 days away.",
    futureSignals: [
      "A seven node causal chain with four evidenced links and two marked as inferences",
      "Three of five decision items undrafted with two business days to the papers deadline",
      "Overdue action aged at 67 days with the escalation rule shown as already triggered",
      "Seven overdue actions split into four dependency blocked and three with no verifiable activity",
      "The acceptance's exit test condition shown as not started, with 86 days to expiry",
    ],
    evidenceIds: ["EVD-2026-41821", "EVD-2026-41820", "EVD-2026-41280", "EVD-2026-41204", "EVD-2026-41105", "EVD-2026-41440"],
    decisionIds: ["DEC-2026-0755", "DEC-2026-0756", "DEC-2026-0757"],
    uncertaintyNote:
      "Two of the causal chain's six links are inferential rather than recorded: the link from fallback activation frequency to route substitution growth, which rests on temporal correlation across five windows, and the link from reviewer establishment to deviation frequency, for which no recorded evidence connects the vacancy to any specific deviation. The chain is a hypothesis with four evidenced links and two inferred, and it should be presented to the committee as one.",
  }),

  /* ======================================================================
     M02  08:10  Inbox converted into work

     The largest consumer of professional time in an NFR function today, and
     it produces no professional output at all. The design test for this
     moment: every item leaves with an object link, an owner, a deadline and
     a next action, or it leaves flagged as unlinkable, which is itself
     information.
     ====================================================================== */

  cell("M02", "tprm", {
    workObjectKind: "inbox-triage",
    workObjectId: "TP-0042",
    headline: "A portal notification that has been sitting unread for 64 days",
    todayNarrative:
      "Reads 61 messages one at a time and decides what each concerns, then replies, files, forwards or leaves it. Fourteen concern Novalink. Three are questionnaire responses with attachments he must save to the shared drive under a naming convention he half remembers. One is a portal notification about register version 6.1 from 03.08.2026 that he has seen before and not acted on. Two are chases from colleagues asking for things his own tracker could answer. Forty to fifty five minutes, and the output is an inbox with fewer bold items.",
    todaySignals: [
      "61 items read one at a time to establish what each concerns",
      "Three attachments filed by hand under a half remembered naming convention",
      "A portal notification seen before, not acted on, and not aged by anything",
      "Two chases answered that his own tracker already holds the answers to",
    ],
    futureNarrative:
      "All 61 items were classified and 14 linked to the supplier's objects. The three questionnaire responses were extracted, named to convention, written to the evidence vault with a retention class and linked to their question identifiers. The 03.08.2026 portal notification was linked to the appendix divergence and aged at 64 days with no action, which converts a stale notification into a finding. The two colleague chases were answered from the tracker with source linked replies held for his release, and four items were flagged unlinkable and grouped rather than hidden.",
    futureSignals: [
      "61 items classified, 14 linked to supplier objects, 4 flagged unlinkable and grouped",
      "Three artefacts written to the vault with retention class and hash, released by him",
      "The 03.08.2026 portal notification aged at 64 days with no action taken",
      "Response count moved from 198 to 201 of 214, with one response assessed as partial",
      "Two colleague chases answered from the tracker with the source attached",
    ],
    evidenceIds: ["EVD-2026-41405", "EVD-2026-40233", "EVD-2026-41445"],
    decisionIds: ["DEC-2026-0742"],
    uncertaintyNote:
      "The penetration test response is assessed as partial because the question asked whether the override interfaces were in scope and the response does not address scope. That is an assessment of what the response says and not of whether the interfaces were tested. It is possible they were tested and the response is merely badly written.",
  }),

  cell("M02", "rcsa", {
    workObjectKind: "inbox-triage",
    workObjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    headline: "A spreadsheet reconciled to source rather than trusted",
    todayNarrative:
      "Reads 38 messages. Eleven concern the workshop: two agenda queries, one attendee change, the control owner asking whether the exceptions will be discussed, and the process owner forwarding a spreadsheet. One is the indicator distribution list mail with the 34 page attachment. One is a query from an Austrian colleague asking whether her Q4 method applies to their payments unit, which is a real question she will not have time to answer properly. Thirty to forty minutes.",
    todaySignals: [
      "38 items, 11 of them about one workshop",
      "A forwarded spreadsheet taken at face value because there is no time to reconcile it",
      "A genuine method question from another entity that will not get a proper answer",
      "An attendee change applied to an invitation by hand",
    ],
    futureNarrative:
      "All 38 items were classified and 11 linked to the Q4 assessment. The attendee change was applied to the 10:30 invitation. The control owner's query was surfaced with her recorded position attached, so the answer is prepared with context rather than from memory. The forwarded spreadsheet was reconciled against the payment hub rather than trusted, returning 731 rows matching and four records with a blank reason code that are also blank at source. All eleven workshop risks were checked for change since the pre-read, returning exactly one change.",
    futureSignals: [
      "38 items classified, 11 linked to the assessment, 4 closed with a stated reason",
      "The forwarded extract reconciled to source: 731 rows match, 4 reason codes blank at source too",
      "The control owner's query answered with her 29.09.2026 position attached",
      "Eleven workshop risks checked for change, one change found",
      "The Austrian method query routed with the group method reference and a reply held",
    ],
    evidenceIds: ["EVD-2026-41821", "EVD-2026-41855", "EVD-2026-41200"],
    decisionIds: ["DEC-2026-0745"],
    uncertaintyNote:
      "Four of 731 override records in the first line extract have a blank reason code, and the same four are blank at source. This is a data quality observation rather than a control deviation, and it means the September reason code decomposition rests on 727 records rather than 731. The route substitution and cut-off conclusions are unaffected at that scale.",
  }),

  cell("M02", "control-assurance", {
    workObjectKind: "inbox-triage",
    workObjectId: "TST-2026-0318",
    headline: "Three other controls in the Q4 plan assert the same thing this one does",
    todayNarrative:
      "Reads 29 messages. Eight concern the control test. One is the supplier's reply on the broken evidence link, restating the 10.10.2026 commitment with no new information. One is the control owner asking to speak before the workshop, which is either a good sign or the start of a negotiation. Three are Q4 scheduling mails for other controls. He re-reads his own conclusion twice, which is the tell that he is uncomfortable with it.",
    todaySignals: [
      "29 items, 8 of them about one test",
      "A supplier reply that repeats a date and says nothing new",
      "A meeting request with no evidence attached to it",
      "His own conclusion re-read twice before 08:30",
    ],
    futureNarrative:
      "All 29 items were classified and 8 linked to the test. The control owner's meeting request was accepted into the 10:30 slot as a control owner challenge meeting with her recorded position and the four exception records attached to the invitation, so the meeting starts from evidence rather than from positions. The supplier's reply was compared against its 22.09.2026 acknowledgement, returning no new information and no revised date, with a chase scheduled. The fourteen controls in the Q4 test plan were screened for the same conditional enforcement pattern, returning three candidates.",
    futureSignals: [
      "29 items classified, 8 linked to the test, 5 closed with a stated reason",
      "The challenge meeting created with the four exception records in the invitation",
      "The supplier reply compared to its own acknowledgement: no new information, no revised date",
      "Three of fourteen Q4 controls assert unconditional enforcement of a system enforced gate",
      "Restore commitment now at two business days of float, with a chase scheduled for 09.10.2026",
    ],
    evidenceIds: ["EVD-2026-41610", "EVD-2026-41855", "EVD-2026-41852"],
    decisionIds: ["DEC-2026-0747"],
    uncertaintyNote:
      "Three Q4 controls have descriptions asserting unconditional enforcement of a system enforced gate. Whether their implemented configurations match those descriptions is unknown, because no configuration has been examined for any of them, including the control under test. This is a pattern match on control descriptions and not a finding. It is issued at 08:10 and it describes, in general terms, the exact failure that is confirmed in the specific case at 15:38.",
  }),

  cell("M02", "incident-resilience", {
    workObjectKind: "inbox-triage",
    workObjectId: "IBS-0004",
    headline: "An inbox that does not know about legal entities",
    todayNarrative:
      "Reads 44 messages across three entities in two languages. Nine concern resilience testing. Two are Swiss local items only she can action. One is a business continuity plan review reminder for an unrelated service. One is a supplier portal digest she does not read. She spends the first twenty minutes deciding which entity's problems come first, which is a question her inbox cannot answer because it does not know about legal entities.",
    todaySignals: [
      "44 items across three entities in two languages, unpartitioned",
      "Twenty minutes spent deciding which entity comes first",
      "A supplier portal digest left unread",
      "Two Swiss local items with no group substitute, indistinguishable from the rest",
    ],
    futureNarrative:
      "All 44 items were classified and partitioned by entity, which no mail client does, returning 26 for the two EU entities, 14 for the Swiss entity and 4 group items. The two Swiss local items were flagged as requiring local action with no group substitute available. The supplier portal digest was parsed and returned one item of substance: a scheduled maintenance note for 11.10.2026 on a hosted service, previously unread. That window was checked against the EU entities' month end processing, returning no conflict.",
    futureSignals: [
      "44 items partitioned by entity: 26 EU, 14 Swiss, 4 group",
      "Nine items linked to resilience testing objects",
      "One item of substance extracted from an unread supplier digest",
      "The 11.10.2026 maintenance window registered as a monitored event with an owner",
      "The Swiss recovery evidence dependency surfaced with its owner, removing the need to email",
    ],
    evidenceIds: ["EVD-2026-41425", "EVD-2026-41500", "EVD-2026-40118"],
    decisionIds: ["DEC-2026-0749"],
    uncertaintyNote:
      "The 11.10.2026 maintenance note is a supplier statement on a portal. The service level appendix requires ten business days notice of any change affecting the availability of a service supporting a critical or important function, and the note gives five calendar days. Whether the clause applies depends on whether the service is in scope for this change, which the note does not state.",
  }),

  cell("M02", "regulatory-change", {
    workObjectKind: "inbox-triage",
    workObjectId: "REG-2026-0031",
    headline: "Twenty eight screenings accepted, one pulled back",
    todayNarrative:
      "Reads 52 messages, of which roughly 30 are subscription digests, law firm newsletters and regulator alert feeds. He skims all 30 for anything that might matter, which is the least productive and least skippable part of his week. Two are internal queries on the tolerance standard consultation. One is a reply about register completeness, which answers a question the tracker should have answered. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "Around 30 digest items skimmed by eye for relevance",
      "No record of why an item was judged irrelevant",
      "A reply that answers a question the tracker already holds",
      "Two consultation queries with no link to the clauses they concern",
    ],
    futureNarrative:
      "All 52 items were classified and the 30 digest items screened against the four in scope items and the group obligation set, returning 2 relevant and 28 not, each with a one line reason so the screening is auditable. The two relevant items were assessed for applicability per entity, returning one EU lane item on subcontracting chain disclosure and one Swiss lane item on outsourcing data access, each mapped to an existing item rather than opened as new, with the lane assignment enforced so neither appears against the other lane.",
    futureSignals: [
      "52 items classified, 30 digest items screened with a stated reason each",
      "Two relevant items found, one per lane, neither crossing",
      "Both mapped to existing register items rather than opened as new",
      "Lane assignment enforced in the presented view",
      "The completeness reply marked as superseded by the field level data already surfaced",
    ],
    evidenceIds: ["EVD-2026-41300", "EVD-2026-41305", "EVD-2026-41402"],
    decisionIds: ["DEC-2026-0752"],
    uncertaintyNote:
      "Twenty eight digest items were screened as not relevant. Screening is performed against the group's current obligation set, which means an item creating an obligation Arcadia does not yet have could be screened out. Each screening decision carries its reason and is reviewable, and the false negative risk is not zero. Illustrative regulatory context, not legal advice.",
  }),

  cell("M02", "nfr-governance", {
    workObjectKind: "inbox-triage",
    workObjectId: "CMT-NFR-2026-10",
    headline: "Seventy three items, of which about six are governance events",
    todayNarrative:
      "Reads 73 messages, the highest volume of the six, because she is copied on everything. Nineteen are committee related. Eleven are papers, drafts or paper queries. Four are escalations that may or may not be escalations. She spends the morning deciding which of 73 items is actually a governance event, and the honest answer is about six.",
    todaySignals: [
      "73 items, the highest volume of the six roles",
      "Four possible escalations with no test to apply to them",
      "Eleven paper items reconciled against a readiness spreadsheet by hand",
      "Drafting state reported by owners rather than derived from anything",
    ],
    futureNarrative:
      "All 73 items were classified and 19 linked to committee agenda items. The four possible escalations were assessed against the escalation map, returning one genuine and three informational. The eleven paper items were reconciled against the readiness tracker so drafting state is derived rather than reported. Fourteen items were routed to the five role owners with each owner's own deadline attached. Each of the 19 committee items was checked for whether the facts it depends on exist yet, returning two that do not.",
    futureSignals: [
      "73 items classified, 19 linked to agenda items, 8 closed with a stated reason",
      "Four possible escalations assessed against the map: one genuine, three informational",
      "Drafting state derived from the papers rather than reported by their owners",
      "Two committee items flagged as depending on facts that do not yet exist",
      "An escalation note prepared with the age, the rule, the cause and two options, and no recommendation",
    ],
    evidenceIds: ["EVD-2026-41280", "EVD-2026-41102", "EVD-2026-41205", "EVD-2026-41105"],
    decisionIds: ["DEC-2026-0763"],
    uncertaintyNote:
      "The overdue action is reported at 60 of 100 complete by its owner. The independently verifiable facts are that the supplier change was delivered to pre production on 18.09.2026 and that the Arcadia acceptance testing request of 22.09.2026 is unanswered. No evidence supports or contradicts the reported figure. The delay cause is an infrastructure change freeze to 14.10.2026, which is verifiable and outside the owner's control.",
  }),

  /* ======================================================================
     M03  08:45  Evidence and workbench

     The first moment in the day where the professional does professional
     work. The design test: the workbench opens onto a formed picture, not a
     search box. A practitioner who has to ask the product for evidence at
     08:45 has been given a better filing cabinet, not a better job.
     ====================================================================== */

  cell("M03", "tprm", {
    workObjectKind: "supplier-dossier",
    workObjectId: "TP-0042",
    headline: "Two lists compared by eye on two monitors, or one divergence table",
    todayNarrative:
      "Opens the contract PDF, 84 pages, and scrolls to the subprocessor appendix. Opens the supplier register PDF in a second window. Compares two lists by eye, on two monitors, writing differences into a notepad. Opens the data transfer appendix to check whether it covers Pune, and cannot tell. Opens the recovery test report for the first time since June, finds the 3 hours 40 minutes on page 11 against the 2 hour contractual objective, and realises it has been in the vault for 137 days. Sixty to ninety minutes for a comparison a machine does in seconds, and the recovery finding is luck.",
    todaySignals: [
      "An 84 page contract PDF scrolled to an appendix",
      "Two subprocessor lists compared by eye across two monitors",
      "Differences written into a notepad with no evidence reference",
      "The recovery gap found by accident, on page 11, after 137 days",
    ],
    futureNarrative:
      "The workbench opened on the supplier with the divergence as the landing object. The appendix and the register were reconciled node by node into a four row divergence table with evidence on each row. The service desk provider's stated data access scope was checked against the data transfer appendix, which names four destinations and does not name India. The fourth party was identified from the monitoring subprocessor's sub-schedule and confirmed as outside the appendix as drafted. The exit appendix was parsed against Arcadia's capability register, returning a dependency on a payment repair tool Arcadia does not hold.",
    futureSignals: [
      "Four row divergence table written to the supplier record with evidence per row",
      "Data transfer appendix destinations extracted: four named, India not among them",
      "Fourth party identified from a sub-schedule and confirmed outside the appendix as drafted",
      "Exit plan parsed against the capability register: the tool it assumes does not exist",
      "Penetration test scope statement extracted verbatim and shown to be silent on the override interfaces",
    ],
    evidenceIds: ["EVD-2026-41410", "EVD-2026-41405", "EVD-2026-41402", "EVD-2026-41435", "EVD-2026-40118", "EVD-2026-40233", "EVD-2026-41415", "EVD-2026-41440"],
    decisionIds: ["DEC-2026-0741", "DEC-2026-0759"],
    uncertaintyNote:
      "No subprocessor notice exists in Arcadia's contract repository. That is evidence of absence in Arcadia's records rather than proof that no notice was given: notice could have been given commercially or through the client portal and not filed. The search covers the contract repository and two shared mailboxes and does not cover individual mailboxes. The subprocessor's data access scope is as stated by the supplier and Arcadia has no mechanism to verify it without a supplier audit.",
  }),

  cell("M03", "rcsa", {
    workObjectKind: "risk-control-graph",
    workObjectId: "RSK-0211",
    headline: "The compensating controls characterised, not counted",
    todayNarrative:
      "Builds the pivot table she did not have time for at 07:45, if she has time now, which she usually does not because the workshop is at 10:30 and she is reading the pre-read. Opens the control test report PDF and reads the four exceptions. Opens the two compensating control records to check what they actually do, which means reading two control descriptions carefully, which takes twenty minutes she had allocated to something else. Writes her residual reasoning into the pre-read by hand.",
    todaySignals: [
      "A pivot table built now if there is time, and usually there is not",
      "Two control descriptions read carefully in twenty borrowed minutes",
      "Residual reasoning typed into a Word pre-read by hand",
      "One hour forty five minutes to a workshop with a contested rating",
    ],
    futureNarrative:
      "The workbench opened on the contested risk with three positions side by side and the appetite boundary drawn. The Duty Manager sampling control was characterised as detective, next business day and drawn at one in ten, with the explicit statement that it cannot prevent a release. The value reconciliation control was characterised as reconciling value rather than authorisation, with the worked implication that a correctly valued payment to a wrong beneficiary would pass it. The secondary review control was characterised as the only preventive control mapped to the risk.",
    futureSignals: [
      "Three residual positions assembled with the appetite boundary and both consequence texts",
      "The sampling control characterised: detective, next business day, one in ten, cannot prevent",
      "The reconciliation control characterised: reconciles value, not authorisation",
      "The secondary review control identified as the only preventive control on this risk",
      "A workshop structure prepared that places the contested risk third rather than first",
    ],
    evidenceIds: ["EVD-2026-41908", "EVD-2026-41850", "EVD-2026-41250", "EVD-2026-41821", "EVD-2026-41810", "EVD-2026-41200"],
    decisionIds: ["DEC-2026-0744", "DEC-2026-0745"],
    uncertaintyNote:
      "The characterisation of the value reconciliation as unable to detect a wrong beneficiary payment is derived from its control description, which reconciles payment value between the payment hub and clearing confirmations. It has not been tested against that scenario. If the reconciliation includes beneficiary identifiers the characterisation is wrong, and the control description does not say either way.",
  }),

  cell("M03", "control-assurance", {
    workObjectKind: "population-field",
    workObjectId: "TST-2026-0318",
    headline: "A waiver code named as a waiver, seven hours before it matters",
    todayNarrative:
      "Opens the 60 sample sub-folders and re-checks the four exceptions and two unresolvable items, one folder at a time, because the working papers are files and not a structure. Opens the supplier system's audit log export for the fourth exception, a CSV, and looks at the rule evaluation trace column, which contains a string he does not fully understand and which mentions a continuity throughput code. He noted it on 24.09.2026 and moved on. He has 45 minutes before the challenge meeting.",
    todaySignals: [
      "Sixty sample folders re-checked one folder at a time",
      "A CSV export with a rule trace column read as an unparsed string",
      "A waiver code noted on 24.09.2026 and not pursued",
      "Forty five minutes to a meeting with the control owner",
    ],
    futureNarrative:
      "The full 60 by 5 attribute matrix was rendered with the two unresolvable items held in a distinct state rather than folded into the pass or fail counts. Each exception's evidence chain was assembled end to end: override record, rule trace, evidence object or its absence, reviewer identity and timestamps. The rule trace on the fourth exception was parsed and the waiver code named as a waiver rather than left as a string. The control description's sentence asserting no exceptions was extracted verbatim and set against it, producing an explicit description against behaviour contradiction. A configuration request was prepared and left unsent on his screen.",
    futureSignals: [
      "60 by 5 matrix with unable to conclude held as a distinct state",
      "Four evidence chains assembled end to end, not four folder listings",
      "The waiver code named as a configured waiver rather than left as a log string",
      "Description against behaviour contradiction written as a working paper finding",
      "A configuration request to the supplier prepared and unsent, with the clause and the four hour service level attached",
    ],
    evidenceIds: ["EVD-2026-41852", "EVD-2026-41805", "EVD-2026-41908", "EVD-2026-41810", "EVD-2026-41850", "EVD-2026-41610"],
    decisionIds: ["DEC-2026-0747", "DEC-2026-0746", "DEC-2026-0760"],
    uncertaintyNote:
      "The rule trace indicates that a configured rule set the review requirement to false. The rule itself has not been examined: its conditions, its origin, whether it is client configurable and how often it has fired are all unknown. The characterisation as a design deficiency is probable and unproven, and the configuration is obtainable under the audit and access appendix within four hours. That paragraph, issued at 08:45, names the missing evidence and the route to obtain it seven hours before the event makes it urgent.",
  }),

  cell("M03", "incident-resilience", {
    workObjectKind: "service-dependency-map",
    workObjectId: "IBS-0004",
    headline: "A dependency map that stops one level above the thing that fails",
    todayNarrative:
      "Opens the clearing route substitution runbook, a Word document at version 3.1, and reads section 4. Opens the control inventory in RiskCore and searches for controls on the repair process, getting a list of eleven. Reads three of them before running out of time. Opens the Swiss tolerance record and reads the threshold. Opens the last severe but plausible test report from 18.11.2025 and confirms that it tested a total gateway outage rather than fallback mode operation. Working group at 10:30.",
    todaySignals: [
      "A Word runbook at version 3.1 read section by section",
      "Eleven controls listed and three read before time runs out",
      "A test report confirming that the fallback path itself has never been exercised",
      "A dependency map that terminates at the first tier supplier",
    ],
    futureNarrative:
      "The runbook's section 4 assertion was reconciled against all eleven controls on the process, returning the secondary review control as conditional on system state and therefore contradicting it. The 18.11.2025 test scope was parsed and shown to have tested a total outage rather than fallback operation, so the fallback path has never been exercised under observation. The Swiss tolerance's two measures were separated and the absence of a precedence confirmed against both the tolerance record and the board committee minutes. The manual route's lead time was checked against the cut-off, producing a latest safe start time.",
    futureSignals: [
      "Runbook section 4 reconciled against eleven controls: one is conditional on system state",
      "The 18.11.2025 exercise scope shown to have tested a different failure mode",
      "Two tolerance measures separated, no precedence found in the record or the minutes",
      "A latest safe start time of 15:15 computed for a 16:00 cut-off (scenario figures)",
      "The dependency map's depth assessed: it terminates at the supplier and excludes subprocessors",
    ],
    evidenceIds: ["EVD-2026-41705", "EVD-2026-41710", "EVD-2026-41500", "EVD-2026-41700", "EVD-2026-40118", "EVD-2026-41810"],
    decisionIds: ["DEC-2026-0751", "DEC-2026-0761", "DEC-2026-0750"],
    uncertaintyNote:
      "The Swiss tolerance contains two measures and neither the tolerance record nor the board committee minutes of 24.02.2026 state which governs on divergence. This is a definitional gap and not a breach, and no divergence has been observed. Separately, the dependency map for this service terminates at the first tier supplier: subprocessor and fourth party nodes are held in the third party module and are not linked into the resilience map, so a failure at a subprocessor would not be visible on it. Both disclosures are issued at 08:45 and both are exactly what happens later in the day.",
  }),

  cell("M03", "regulatory-change", {
    workObjectKind: "obligation-lineage",
    workObjectId: "REG-2026-0088",
    headline: "One control serving obligations in two lanes, rendered once with two evidence requirements",
    todayNarrative:
      "Opens the traceability spreadsheet, Obligation-mapping-master-v22.xlsx, 1,840 rows, 14 columns, two tabs for two jurisdictions, maintained by him and one analyst. Filters for Tier 1 third party obligations. Opens the register extract in another window and compares by eye. Opens the data transfer appendix to see whether it names India. It does not. He writes a note. Forum at 10:30. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "1,840 rows across two tabs, which is how category errors happen",
      "Two windows compared by eye for Tier 1 obligations",
      "A note written in a spreadsheet cell as the record of an interpretation",
      "No way to render one control against two jurisdictions at once",
    ],
    futureNarrative:
      "The obligation set was rendered as a two lane map with the separator enforced and every obligation in one of four terminal states. The register shortfall was decomposed to name three Tier 1 records and the specific fields driving it, all subcontracting chain fields. The service desk provider was mapped into the Swiss lane as a data access obligation, moving it from unmapped to mapped and unevidenced. The data transfer appendix was parsed for named destinations, returning four and not India. The secondary review control was identified as serving obligations in both lanes and rendered once in a shared band with two separate evidence requirements.",
    futureSignals: [
      "Two lane map with the separator enforced and four terminal states per obligation",
      "Shortfall named to three Tier 1 records and their specific incomplete fields",
      "The service desk provider moved from unmapped to mapped and unevidenced in the Swiss lane",
      "Four transfer destinations named in the appendix; India is not one of them",
      "One control rendered once in a shared band with two separate evidence requirements",
    ],
    evidenceIds: ["EVD-2026-41300", "EVD-2026-41405", "EVD-2026-41402", "EVD-2026-41310", "EVD-2026-41500", "EVD-2026-41305"],
    decisionIds: ["DEC-2026-0752", "DEC-2026-0753", "DEC-2026-0754"],
    uncertaintyNote:
      "The data transfer appendix names four destinations and does not name India. The service desk provider is located in Pune and holds read access to payment metadata per the supplier's own register. Whether that constitutes a transfer outside the appendix's scope is a legal question requiring Group Legal input. Separately, the obligation set contains 1,840 rows maintained manually over three years and its own completeness has never been independently verified: a missing obligation would not appear as a gap, it would not appear at all. Illustrative regulatory context, not legal advice.",
  }),

  cell("M03", "nfr-governance", {
    workObjectKind: "portfolio-thread",
    workObjectId: "THEME-PAY-01",
    headline: "A paper structured so that new facts sharpen it rather than invalidate it",
    todayNarrative:
      "Opens PowerPoint and starts the control divergence paper from last quarter's template. Realises she needs the control conclusion, which the assurance owner has not settled, and the residual rating, which the second line will not have until after 12:00. Writes the sections she can. Opens the dashboard again and looks at four Red rows and has the feeling that they are connected, which is not a governance artefact. Opens the overdue action and decides to think about it later.",
    todaySignals: [
      "A committee paper started from last quarter's template",
      "Two of the paper's inputs will not exist until after midday",
      "A connection between four Red rows that exists only as a feeling",
      "An overdue action opened and deferred",
    ],
    futureNarrative:
      "The causal chain was re-rendered with each link's evidence and the two inferred links marked. Each of the five decision items was assessed for whether it asks one answerable question, returning three that do and two that ask for a discussion. The risk acceptance conditions were re-checked with the exit test confirmed not started and the expiry 86 days away. The seven overdue actions' causes were verified independently of owner status reports, returning four verifiably dependency blocked and three with no verifiable activity. The documentation action on the waiver rule was linked into the chain, connecting her committee paper to an unsent supplier request.",
    futureSignals: [
      "Causal chain re-rendered with per link evidence and two links marked as inferred",
      "Five decision items tested for answerability: three ask one question, two ask for a discussion",
      "Seven overdue actions split by verified cause rather than by reported status",
      "The documentation action on the waiver rule linked into the chain, not started since 25.09.2026",
      "A divergence paper prepared with both positions attributed and a blank recommendation",
    ],
    evidenceIds: ["EVD-2026-41821", "EVD-2026-41204", "EVD-2026-41280", "EVD-2026-41102", "EVD-2026-41205", "EVD-2026-41440"],
    decisionIds: ["DEC-2026-0755", "DEC-2026-0757", "DEC-2026-0756"],
    uncertaintyNote:
      "Two of the causal chain's six links are inferential. The chain is a hypothesis and must be presented to the committee as one, with the inferred links visibly marked; presenting it as established would be the more persuasive and less defensible choice. Separately, three of seven overdue actions show no verifiable activity, and absence of verifiable activity is not proof that no work occurred: it means no evidence of work exists in the systems of record, which is itself reportable.",
  }),

  /* ======================================================================
     M04  09:30  Asynchronous factual validation

     Where days disappear today: an email is sent, an answer arrives in two
     days, the question has moved on. The design test: every outbound
     question is answerable in one action by its recipient, carries the
     evidence the recipient needs, and is tracked with an age and an
     escalation. A question without those three things is a delay dressed as
     diligence.
     ====================================================================== */

  cell("M04", "tprm", {
    workObjectKind: "supplier-dossier",
    workObjectId: "CTR-2023-0117-A3",
    headline: "Four questions, each answerable in one action, each with an age",
    todayNarrative:
      "Writes four emails. One to the supplier's client service director about the unlisted subprocessor, rewritten twice because the tone matters and he does not want to assert a breach he has not confirmed. One to Group Legal asking which appendix version binds, a question with an obvious answer he cannot answer himself. One to the commercial owner asking whether any notice was received commercially. One to the process owner about the recovery gap. He will get two replies today and two next week, and the two he gets today will be the two he needed least.",
    todaySignals: [
      "Four emails written, one of them rewritten twice for tone",
      "A binary question sent as prose with no candidate answers attached",
      "No age, no target and no escalation path on any of the four",
      "Two useful replies expected next week",
    ],
    futureNarrative:
      "Four outbound questions were structured, each with the evidence the recipient needs attached and each answerable in one action. The Legal question was reduced to a single binary with both candidate versions attached, and pre-answered from the repository's own version control so the reply confirms rather than determines. The commercial question was framed as a records check with a date range and the clause reference. The supplier question was drafted as a records reconciliation rather than as an assertion. The repository, both shared mailboxes and the commercial owner's filed correspondence were searched for any notice, returning nil with the search scope stated.",
    futureSignals: [
      "Four questions structured, each answerable in one action, each with an age target",
      "The Legal question reduced to a binary with both candidate versions attached",
      "Nil return on notice recorded as evidence, with the search scope stated",
      "Register publication history retrieved: version 6.1 on 03.08.2026, the previous version 11.09.2025",
      "The supplier question held for release in a records reconciliation register rather than an assertion register",
    ],
    evidenceIds: ["EVD-2026-41235", "EVD-2026-41410", "EVD-2026-41405", "EVD-2026-40118", "EVD-2026-41425"],
    decisionIds: ["DEC-2026-0759", "DEC-2026-0741"],
    uncertaintyNote:
      "The nil return on notice covers the contract repository, two shared mailboxes and the commercial owner's filed correspondence. It does not cover individual mailboxes or verbal notice. The conclusion is that no notice is on record, which is not the same as no notice having been given, and the difference matters because one supports an assertion and the other does not.",
  }),

  cell("M04", "rcsa", {
    workObjectKind: "risk-control-graph",
    workObjectId: "KRI-PAY-007",
    headline: "An unanswerable question replaced by an answerable one",
    todayNarrative:
      "Calls the process owner to ask why route substitution overrides jumped, and gets a plausible answer about the gateway being flaky, which she cannot verify. Emails the assurance owner to ask whether the exceptions relate to the fallback periods, a question he cannot answer because his population is bounded by time. Messages the control owner to check she is attending at 10:30. Fifty minutes, three questions, no confirmed facts.",
    todaySignals: [
      "A telephone answer that cannot be verified and is not recorded",
      "A question sent to someone whose method cannot answer it",
      "A message sent to confirm attendance that a calendar already holds",
      "Fifty minutes spent and no confirmed facts obtained",
    ],
    futureNarrative:
      "Three outbound questions were structured and one was replaced. The process owner question was reframed from why the component jumped, which is unanswerable, to confirmation that five fallback windows are complete and that the 17 overrides outside them have another cause, with the window list and the 17 override identifiers attached. The assurance owner question was reduced to confirmation that his population excluded prior fallback windows, because the link between the fourth exception and its August window is already established. The five windows were cross-checked against all 198 route substitution overrides.",
    futureSignals: [
      "198 route substitution overrides mapped against the known windows: 181 inside, 17 outside",
      "Eleven of the 17 fall on one afternoon with no activation recorded, which is a new open question",
      "A sixth activation identified outside the September set, inside the test period",
      "Reviewer establishment checked against the deviation dates, returning no direct link and saying so",
      "Attendance confirmed without sending a message",
    ],
    evidenceIds: ["EVD-2026-41821", "EVD-2026-41810", "EVD-2026-41805", "EVD-2026-41822"],
    decisionIds: ["DEC-2026-0771", "DEC-2026-0744"],
    uncertaintyNote:
      "Eleven route substitution overrides occurred on the afternoon of 23.09.2026 with no fallback activation recorded. Either an activation occurred and was not logged, or those overrides have a different cause. This cannot be resolved from Arcadia data alone and requires the process owner's confirmation. It does not affect the component conclusion, which rests on 181 of 198, but an unlogged activation would be a separate control issue.",
  }),

  cell("M04", "control-assurance", {
    workObjectKind: "population-field",
    workObjectId: "TST-2026-0318",
    headline: "Two of the control owner's three assertions are currently correct",
    todayNarrative:
      "Has already sent the configuration request at 08:52, which on a normal day he would not have sent at all. Now emails supplier support about the broken evidence link to ask whether the 10.10.2026 restore is firm. Emails the control owner to confirm the 10:30 agenda. Re-reads the four exceptions a third time. Waits.",
    todaySignals: [
      "A request sent with no tracking against its service level",
      "An email to confirm an agenda that the meeting record already holds",
      "Four exceptions re-read a third time",
      "Waiting, with no visibility of when an answer is due",
    ],
    futureNarrative:
      "The 08:52 configuration request was tracked against the four hour service level in the audit and access appendix, with the service level shown as breached at 12:52 if unanswered and an escalation path prepared. Each exception's root cause was re-derived from its evidence chain rather than from his own notes, returning three operating and one probable design. The self review exception was checked against the overdue remediation's scope, confirming that the action would have prevented it and that the exception occurred 17 days before the revised due date. The control owner's three line rationale was parsed into three separate checkable assertions, of which two are checkable today.",
    futureSignals: [
      "The configuration request tracked against a 12:52 service level with an escalation prepared",
      "Four root causes re-derived from evidence rather than from notes",
      "The self review exception confirmed as within the overdue action's scope, 17 days early",
      "The sequence gap recomputed from raw timestamps at 11 minutes 19 seconds",
      "Three assertions parsed from a three line rationale, two of them confirmed correct today",
    ],
    evidenceIds: ["EVD-2026-41855", "EVD-2026-41250", "EVD-2026-41102", "EVD-2026-41105", "EVD-2026-41852", "EVD-2026-41805"],
    decisionIds: ["DEC-2026-0746", "DEC-2026-0748", "DEC-2026-0760"],
    uncertaintyNote:
      "The control owner's rationale contains three assertions: that the exceptions caused no financial loss, that all four payments were confirmed correct by clients, and that the fourth exception was the system behaving as configured. The first two are checkable and are supported by the loss register and the client confirmation records. The third is checkable only against the configuration, which has been requested and not received. Two of her three assertions are currently correct.",
  }),

  cell("M04", "incident-resilience", {
    workObjectKind: "service-dependency-map",
    workObjectId: "RB-PAY-007",
    headline: "A configuration audit log she did not know existed",
    todayNarrative:
      "Emails the third party risk owner about the Swiss recovery evidence, which is her third email on the subject. Emails the local resilience officer asking whether the Swiss entity has any fallback for euroSIC, a question she believes she knows the answer to and has never confirmed in writing. Emails the payment operations mailbox asking whether fallback activations are logged anywhere she can see. Working group in 60 minutes.",
    todaySignals: [
      "A third email on the same supplier evidence question",
      "A belief about her own entity's fallback position never confirmed in writing",
      "A question about where activations are logged, sent to a shared mailbox",
      "Sixty minutes to a working group she chairs",
    ],
    futureNarrative:
      "The supplier evidence question was replaced by a live dependency link, since the action's status, owner and underlying reassessment question are already on her screen. The local question was reframed from whether a fallback exists to confirmation that manual correspondent submission is the only option and that the 45 minute lead time is current. The payment operations question was answered from the configuration audit log, which records every fallback route mode change and which she did not know existed. That log returned the five September activations plus one in August, plus one on 23.09.2026 that is not in the September operations report.",
    futureSignals: [
      "Configuration audit log queried: seven fallback windows on record",
      "One window on 23.09.2026 absent from the September operations report",
      "The same anomaly independently corroborated from the override side by another function",
      "The manual route's lead time checked against its review date and against any rehearsal, returning none",
      "The configuration audit log registered as an authoritative source for activation events",
    ],
    evidenceIds: ["EVD-2026-41810", "EVD-2026-41710", "EVD-2026-41500", "EVD-2026-40118", "EVD-2026-41705"],
    decisionIds: ["DEC-2026-0749", "DEC-2026-0750", "DEC-2026-0761"],
    uncertaintyNote:
      "The configuration audit log shows a fallback activation window on 23.09.2026 that does not appear in the September payment operations report. Either the operations report is incomplete or the configuration change was made without invoking the runbook. These have different implications and the log alone cannot distinguish them.",
  }),

  cell("M04", "regulatory-change", {
    workObjectKind: "obligation-lineage",
    workObjectId: "OBL-2026-0088-002",
    headline: "An inventory filed 84 days after the subprocessor was onboarded",
    todayNarrative:
      "Emails Group Legal about whether Pune is within the data transfer appendix's scope, and knows he will not get an answer before the forum. Emails the local resilience officer to check whether the Swiss outsourcing inventory has been filed locally this quarter. Emails the third party risk owner asking for the subprocessor's data access scope, which that function does not have either. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "A legal question sent to a mailbox rather than to a named counsel",
      "A question asked about a filing the inventory record already answers",
      "A request for a scope only the supplier holds",
      "An answer expected after the meeting it is needed for",
    ],
    futureNarrative:
      "Three outbound questions were structured and one was removed. The Legal question was reduced to a single scope question with the appendix's destination list and the register row attached, and routed to the named counsel rather than to a mailbox. The local filing question was answered from the inventory record, which shows a filing on 24.07.2026. The third party risk question was reframed from what the access scope is to confirmation that the supplier's own register is the only source for it, which is answerable and is the real question. The filing date was set against the subprocessor's onboarding date of 01.05.2026.",
    futureSignals: [
      "The Legal question reduced to one scope question and routed to a named counsel",
      "The local filing question answered from the record, removing the need to ask",
      "Inventory filed 24.07.2026, subprocessor onboarded 01.05.2026, 84 days apart",
      "The subprocessor absent from the filed inventory, confirmed against the current service list",
      "The consultation window confirmed as open to 23.10.2026, 17 days remaining",
    ],
    evidenceIds: ["EVD-2026-41305", "EVD-2026-41405", "EVD-2026-41402", "EVD-2026-41310"],
    decisionIds: ["DEC-2026-0762", "DEC-2026-0752", "DEC-2026-0753"],
    uncertaintyNote:
      "The Swiss inventory filed on 24.07.2026 does not contain the subprocessor, which the supplier's register shows as onboarded on 01.05.2026. Whether the inventory should contain a subprocessor of a significant outsourcing depends on the inventory's defined scope, which this system has read and which is ambiguous on subcontracting depth. The observation is factual; its consequence is a matter for interpretation and for Group Legal. Illustrative regulatory context, not legal advice.",
  }),

  cell("M04", "nfr-governance", {
    workObjectKind: "portfolio-thread",
    workObjectId: "MSN-2026-0147",
    headline: "A question about a dependency rather than about a peer's performance",
    todayNarrative:
      "Emails the process owner about the overdue action, carefully, because he is a peer and the message will be read by others. Emails the assurance owner and the second line facilitator asking whether they can give her a joint position by Thursday. Emails the committee secretariat about agenda timing. Then starts the overdue actions paper.",
    todaySignals: [
      "A message to a peer drafted carefully because others will read it",
      "A question about a joint position that two people have to coordinate by email",
      "A secretariat question about timing the agenda record already holds",
      "A paper started without its two most important inputs",
    ],
    futureNarrative:
      "Three outbound questions were structured and one was replaced. The process owner question was built around verifiable facts, the delivery date, the unanswered testing request and the freeze end date, and framed as a re-baselining question rather than a performance question. The joint position question was replaced with a live readiness view showing both functions' states and the dependency between them. The action's dependency chain was verified end to end, with the freeze's end date confirmed from the change record and the implication stated that the action cannot close before then whatever anyone commits to.",
    futureSignals: [
      "The peer question framed as re-baselining, built on three verifiable facts",
      "The joint position question replaced by a live readiness view",
      "Dependency chain verified end to end with a 14.10.2026 constraint stated",
      "The April extension's monthly reporting condition found unmet since July 2026",
      "The unsent supplier configuration request registered as a fact arrival dependency with a 12:52 expectation",
    ],
    evidenceIds: ["EVD-2026-41280", "EVD-2026-41102", "EVD-2026-41205", "EVD-2026-41105"],
    decisionIds: ["DEC-2026-0763", "DEC-2026-0757"],
    uncertaintyNote:
      "The overdue action cannot close before 14.10.2026 because the testing environment is frozen until that date, so any commitment to an earlier date would be unachievable on current facts. That is a statement about the dependency and not about the owner's intent or capability. Separately, the April extension was granted on a condition of monthly progress reporting to the committee and no report has been made since July 2026, which is a governance failure in the committee's own follow up rather than only in the owner's delivery.",
  }),

  /* ======================================================================
     M05  10:30  Function-specific meeting or workshop

     Six different meetings, one time slot. The product's contribution is
     not a summary afterwards. It is that the meeting starts from a shared
     evidenced picture and that the disagreements in the room are about
     judgment rather than about facts. A meeting that spends its first
     twenty minutes establishing what is true has been failed by its
     preparation.
     ====================================================================== */

  cell("M05", "tprm", {
    workObjectKind: "meeting",
    workObjectId: "TP-0042",
    headline: "An availability dispute converted into a contract variation",
    todayNarrative:
      "Joins a call with a supplier who has prepared a deck. The supplier presents green service levels and reassessment progress. He has four open questions in a spreadsheet and raises three, gets two deferrals and one commitment to come back to him, and forgets the fourth. The minutes are written by the supplier.",
    todaySignals: [
      "A supplier deck as the agenda and the supplier as the minute taker",
      "Four open questions in a spreadsheet, three raised and one forgotten",
      "Two deferrals accepted with no date attached",
      "No record of last month's commitments and whether they were met",
    ],
    futureNarrative:
      "The meeting pack was assembled from live objects rather than from the supplier's deck: four open resilience questions with their evidence, the divergence table, the calculated availability figure and the escalated penetration test scope request, each with an ask and a required-by date so the meeting produces commitments. The previous month's commitments were retrieved with their status, returning three of five unmet and aged. The supplier's presented availability figure was reconciled against Arcadia's calculation and the whole difference localised to the treatment of one maintenance overrun.",
    futureSignals: [
      "Meeting pack built from live objects, not from the supplier's deck",
      "Four open questions each with an ask and a required-by date",
      "Three of five prior month commitments unmet, dated and aged",
      "The availability difference localised entirely to one maintenance overrun of 2 hours 5 minutes",
      "An Arcadia authored minute record opened, so the supplier does not own the record of the meeting",
    ],
    evidenceIds: ["EVD-2026-41240", "EVD-2026-41425", "EVD-2026-41415", "EVD-2026-40233", "EVD-2026-41810"],
    decisionIds: ["DEC-2026-0743", "DEC-2026-0759"],
    uncertaintyNote:
      "The difference between the supplier's availability figure and Arcadia's is fully explained by the treatment of a maintenance overrun of 2 hours 5 minutes on 11.09.2026. The supplier appears to treat the whole window as planned maintenance; Arcadia's calculation treats the overrun portion as unplanned. The service level appendix does not define the treatment of a maintenance overrun, so neither figure is wrong under the contract as drafted.",
  }),

  cell("M05", "rcsa", {
    workObjectKind: "meeting",
    workObjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    headline: "Twenty five minutes not spent establishing what the test found",
    todayNarrative:
      "Runs a 90 minute workshop from a PowerPoint deck and a spreadsheet. Spends the first 25 minutes establishing what the control test found, because the control owner and the process owner have read the report differently. Reaches the contested risk at 11:20 with 40 minutes left and a room that has already decided. Nods through the other ten risks in the last 15 minutes. Leaves without an agreed rating.",
    todaySignals: [
      "Twenty five minutes spent establishing facts the report already states",
      "The contested risk reached at 11:20 with 40 minutes left",
      "Ten other risk assessments compressed into the final 15 minutes",
      "A workshop that ends without an agreed rating and without a recorded disagreement",
    ],
    futureNarrative:
      "The workshop loaded with the accepted structure placing the contested risk third, and with four established facts loaded as facts so the first 25 minutes are not spent on them: the population, the sample, the exception count and both deviation rates against the tolerable rate. The control owner's three assertions were loaded with the finding that two of the three are currently correct. The three control characterisations were loaded, along with the appetite boundary and the exact consequence text for each side of it. The ten uncontested positions were recorded as agreed as the workshop passed them.",
    futureSignals: [
      "Population, sample, exception count and both deviation rates loaded as established facts",
      "The control owner's three assertions loaded, two confirmed correct",
      "The appetite boundary loaded with both consequence texts, not as a colour band",
      "Ten uncontested risk positions recorded as agreed during the session",
      "A dissent record structure prepared with both positions and no adjudication",
    ],
    evidenceIds: ["EVD-2026-41850", "EVD-2026-41852", "EVD-2026-41855", "EVD-2026-41250", "EVD-2026-41908", "EVD-2026-41810"],
    decisionIds: ["DEC-2026-0772", "DEC-2026-0744"],
    uncertaintyNote:
      "The residual rating gap between 9 and 12 turns on one question: whether two detective compensating controls can substitute for a Partially Effective preventive control. This system has characterised the three controls and cannot resolve the question, because it is a judgment about sufficiency. Both positions are internally consistent.",
  }),

  cell("M05", "control-assurance", {
    workObjectKind: "meeting",
    workObjectId: "TST-2026-0318",
    headline: "A forty minute argument about materiality reframed into a twenty minute narrowing",
    todayNarrative:
      "Meets the control owner and the process owner in a room with a printed report. The control owner restates her position. He restates his. They disagree for 40 minutes about whether four exceptions in 60 samples is material, which is not the question. He leaves with the disagreement unchanged and joins the assessment workshop as an observer at 11:15.",
    todaySignals: [
      "A printed report as the shared artefact",
      "Forty minutes spent on materiality, which is not the question in dispute",
      "Two positions restated rather than narrowed",
      "The disagreement unchanged at the end of the meeting",
    ],
    futureNarrative:
      "The meeting loaded with the exception records, the control owner's three assertions and his own prepared position separating what he will concede from what he will hold. Her first two assertions were confirmed correct from the loss register and the client confirmation records, so the meeting starts from agreement rather than from confrontation. The third was identified as unresolvable today pending the configuration. The design against operating distinction was loaded as the frame for the meeting, replacing materiality as the topic.",
    futureSignals: [
      "Two of three assertions confirmed correct before the meeting opens",
      "The third identified as pending evidence with an expected arrival time",
      "The design against operating distinction loaded as the meeting's frame",
      "The self review exception loaded with the overdue action's scope and the 17 day interval",
      "A joint position structure prepared with three fields: agreed, disagreed, pending evidence",
    ],
    evidenceIds: ["EVD-2026-41250", "EVD-2026-41855", "EVD-2026-41102", "EVD-2026-41852", "EVD-2026-41805"],
    decisionIds: ["DEC-2026-0760", "DEC-2026-0746"],
    uncertaintyNote:
      "The assertion that the fourth exception was the system behaving as configured cannot be resolved without the tenant configuration. The configuration has been requested under the audit and access appendix, which carries a four hour service level from 08:52. If the assertion is correct, the deficiency is design rather than operating, and the control owner's characterisation of that exception is right.",
  }),

  cell("M05", "incident-resilience", {
    workObjectKind: "meeting",
    workObjectId: "IBS-0004",
    headline: "An unlogged activation raised in a forum rather than handled bilaterally",
    todayNarrative:
      "Chairs a working group across three entities on a video call. Runs through a status deck. The tested fallback indicator is discussed as a percentage. The corporate payments testing gap is noted. Nobody raises the runbook's section 4 because nobody has read it against the control inventory. The 23.09.2026 unlogged activation is not in the deck because it is not in the operations report.",
    todaySignals: [
      "A status deck as the working group's agenda",
      "An indicator discussed as a percentage rather than by composition",
      "A runbook assertion nobody has reconciled against anything",
      "An unlogged activation absent from the deck because it is absent from the source report",
    ],
    futureNarrative:
      "The working group loaded with three findings, two from the workbench and one from the validation moment. The indicator was decomposed to name corporate payments rather than to report a figure. The agenda was structured so the tolerance review is taken before the status items, since it carries a paper deadline and they do not. The runbook contradiction was loaded with the control inventory reconciliation. The seven activation windows from the configuration audit log were loaded, including the unreported one, and the manual route's nil rehearsal status was loaded with the latest safe start computation.",
    futureSignals: [
      "Three findings loaded into the working group rather than reported afterwards",
      "Tolerance review placed before the status items because it carries the deadline",
      "Seven activation windows loaded from the configuration audit log, one unreported",
      "The manual route's nil rehearsal status loaded with a 15:15 latest safe start (scenario figures)",
      "The unlogged activation raised formally, with the first line representative acknowledging it",
    ],
    evidenceIds: ["EVD-2026-41810", "EVD-2026-41705", "EVD-2026-41710", "EVD-2026-41500", "EVD-2026-41700"],
    decisionIds: ["DEC-2026-0751", "DEC-2026-0761", "DEC-2026-0750"],
    uncertaintyNote:
      "The Swiss tolerance has two measures with no stated precedence and no divergence has been observed, so the working group is being asked to decide whether to recommend a precedence to the committee or to treat the question as theoretical. Separately, the 23.09.2026 activation appears in the configuration audit log and not in operations reporting; payment operations has acknowledged it in this meeting and states it was a brief technical test, and that statement is not verified.",
  }),

  cell("M05", "regulatory-change", {
    workObjectKind: "meeting",
    workObjectId: "REG-2026-0031",
    headline: "The same arrangement rendered twice, which prevents the forum's wrong question",
    todayNarrative:
      "Runs a forum where the two jurisdictional lanes are two tabs in one spreadsheet, which is how category errors happen. Discusses register completeness as a percentage. Raises the service desk subprocessor question and gets a discussion about whether it is a third party risk issue or a compliance issue, which is the wrong question because it is both, in two jurisdictions, differently. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "Two jurisdictional lanes presented as two tabs of one spreadsheet",
      "Completeness discussed as a percentage with no field level detail",
      "A forum debating which function owns a question that creates two obligations",
      "No mechanism in the view to render one arrangement against two lanes at once",
    ],
    futureNarrative:
      "The forum loaded with the dual lane map and the separator enforced in the presented view. The register shortfall was decomposed to three named Tier 1 records and their specific fields. The service desk question was rendered twice, once in each lane, with different obligations and different evidence requirements, which is the view that prevents the meeting's wrong question. The Swiss inventory scope ambiguity was loaded with the standard's own text. The secondary review control was rendered once in a shared band with two separate evidence requirements.",
    futureSignals: [
      "Dual lane map with the separator enforced in the presented view",
      "Shortfall decomposed to three named records and their specific fields",
      "The subprocessor question rendered twice, once per lane, with different evidence requirements",
      "The inventory standard's ambiguous text on subcontracting depth loaded verbatim",
      "The single question formally split into two tracked obligations, one per lane",
    ],
    evidenceIds: ["EVD-2026-41300", "EVD-2026-41305", "EVD-2026-41405", "EVD-2026-41402", "EVD-2026-41310"],
    decisionIds: ["DEC-2026-0752", "DEC-2026-0762", "DEC-2026-0754"],
    uncertaintyNote:
      "The arrangement creates obligations in both lanes. Satisfying the EU lane register obligation would not satisfy the Swiss lane inventory and data access obligation, and the converse also holds. Whether either obligation is currently unmet is a matter for interpretation with Group Legal and is not determined here. Illustrative regulatory context, not legal advice.",
  }),

  cell("M05", "nfr-governance", {
    workObjectKind: "meeting",
    workObjectId: "CMT-NFR-2026-10",
    headline: "The chief risk officer asks whether the four Reds are connected, and there is an answer",
    todayNarrative:
      "Meets the Group Chief Risk Officer for 45 minutes with three half-drafted papers. Talks through the four Red indicators as four items. He asks whether they are connected and she says she thinks so, which is not an evidenced answer. Leaves with a direction to sharpen the divergence paper and no more time than she had before.",
    todaySignals: [
      "Three half-drafted papers as the basis of a pre-review",
      "Four Red indicators presented as four items",
      "An unevidenced answer to the only question that matters",
      "A direction to sharpen a paper whose inputs do not exist yet",
    ],
    futureNarrative:
      "The pre-review loaded with readiness per agenda item and both fact arrival dependencies flagged, including the 12:52 configuration expectation. The causal chain loaded as a seven node object with four evidenced links and two inferred, so the chief risk officer's question has an answer with a stated confidence. The five decision items were separated into three that ask one answerable question and two that ask for a discussion. The risk acceptance loaded with its unmet exit test condition and 86 days to expiry.",
    futureSignals: [
      "A seven node causal chain with per link confidence available in the room",
      "Two fact arrival dependencies flagged, one with a 12:52 expectation",
      "Three decision items that ask one answerable question, two that ask for a discussion",
      "The risk acceptance loaded with its unmet condition and its expiry distance",
      "The causal chain's presentation status set to hypothesis with declared inferences",
    ],
    evidenceIds: ["EVD-2026-41821", "EVD-2026-41204", "EVD-2026-41280", "EVD-2026-41820"],
    decisionIds: ["DEC-2026-0755", "DEC-2026-0757", "DEC-2026-0756"],
    uncertaintyNote:
      "Two of the causal chain's six links are inferred. Presenting the chain to the committee as established would be more persuasive and less defensible. The recommended presentation marks both inferred links and states what evidence would confirm them.",
  }),

  /* ======================================================================
     M06  11:45  Human decision point

     The one moment with no execution and no drafting. Nothing is written
     and nothing is prepared. The product's entire contribution is that the
     person arrives fully briefed and decides unaided.

     The hard constraints for every cell here: no option is pre-selected,
     highlighted, ordered by preference or marked as recommended in the
     interface; options appear in a fixed neutral order; no rationale is
     drafted before the human has formed one; and the decision record is
     created after the decision, from what the human states.
     ====================================================================== */

  cell("M06", "tprm", {
    workObjectKind: "decision-brief",
    workObjectId: "CTR-2023-0117-A3",
    headline: "Three characterisations on the same facts, unordered and unranked",
    todayNarrative:
      "Sits with a notepad after the supplier call and tries to decide what the appendix divergence actually is. Has no structured way to compare the three characterisations. Asks a colleague. Decides on instinct, writes an email, and the reasoning exists only in his head and in the email's tone.",
    todaySignals: [
      "A notepad as the decision support tool",
      "No structured way to compare three characterisations of the same facts",
      "A colleague asked informally, with nothing recorded",
      "Reasoning that exists only in the tone of an email",
    ],
    futureNarrative:
      "The decision was surfaced as the day's open judgment with the objects it affects listed, and the reply state of the four outbound questions shown: Group Legal confirmed the binding version at 11:12 and the commercial owner confirmed nil notice at 10:58. The three characterisations were set out with the facts that support each, unordered and unranked. The consequence of each was modelled: a formal notice starts a 30 day objection clock and requires a named breach; a variation request starts a negotiation with no clock; a records reconciliation conversation preserves the relationship and creates no right.",
    futureSignals: [
      "Three characterisations set out with their supporting facts, unordered and unranked",
      "Consequences modelled per option without a score and without a preference",
      "Group Legal confirmation of the binding version received at 11:12",
      "Commercial owner confirmation of nil notice received at 10:58",
      "The one obtainable distinguishing fact named, and the two that are not obtainable named too",
    ],
    evidenceIds: ["EVD-2026-41901", "EVD-2026-41235", "EVD-2026-41410", "EVD-2026-41405"],
    decisionIds: ["DEC-2026-0759"],
    uncertaintyNote:
      "The supplier's position on whether portal publication constitutes notice is unknown. It is the single fact that most affects the characterisation and it can be obtained by asking. Asking it in writing, however, may itself be read as asserting a breach. This system cannot tell you whether that cost is worth paying.",
  }),

  cell("M06", "rcsa", {
    workObjectKind: "decision-brief",
    workObjectId: "RSK-0211",
    headline: "Force a rating or record a dissent, with seven people waiting",
    todayNarrative:
      "Standing at the front of a room at 11:55 with a decision she has to make in front of the people it affects: force a rating or record a dissent. No preparation, no consequence model, and seven people waiting.",
    todaySignals: [
      "A decision taken standing up, in front of the people it affects",
      "No consequence model for either option",
      "No record of how often the dissent instrument has been used before",
      "Five minutes to a hard stop",
    ],
    futureNarrative:
      "The dissent clause of the assessment procedure was surfaced with its text and its consequence. The three positions were shown with the appetite boundary and the exact consequence text for each side. Two options were modelled: an agreed rating closes the assessment and ends the challenge; a recorded dissent escalates to the committee with both positions and leaves the assessment unsigned past its date unless resolved. The precedent was checked, returning two recorded second line dissents in the group in the last eight quarters, so the instrument is real but rare. The pending configuration evidence was flagged as a fact that may arrive today.",
    futureSignals: [
      "The dissent clause surfaced with its text and its consequence, not as a rumour",
      "Three positions with the appetite boundary and both consequence texts",
      "Two options modelled with no score and no preference",
      "Two prior second line dissents in eight quarters: the instrument is real but rare",
      "The pending supplier evidence flagged as possibly arriving today and possibly changing the basis",
    ],
    evidenceIds: ["EVD-2026-41850", "EVD-2026-41855", "EVD-2026-41200", "EVD-2026-41202", "EVD-2026-41852"],
    decisionIds: ["DEC-2026-0772"],
    uncertaintyNote:
      "Evidence that may change the basis of this disagreement has been formally demanded from the supplier and is overdue against a four hour service level. It may arrive today. Deciding now means deciding without it; deferring means the assessment cannot be signed on schedule.",
  }),

  cell("M06", "control-assurance", {
    workObjectKind: "decision-brief",
    workObjectId: "TST-2026-0318",
    headline: "Only one of three conclusions survives the evidence he has demanded",
    todayNarrative:
      "Back at his desk after the challenge meeting and the workshop observation. The configuration request blows its four hour service level at 12:52, which he will notice at 13:10. He has to decide whether his conclusion holds without the configuration, and there is nothing on his screen to help him decide.",
    todaySignals: [
      "A service level breach he will notice 18 minutes after it happens",
      "Three possible conclusions with no way to compare their exposure",
      "No structured record of what each conclusion would commit him to",
      "A conclusion due before the evidence that bears on it",
    ],
    futureNarrative:
      "The service level was shown as 67 minutes from breach with the escalation path prepared and unsent. Three options were set out unranked: issue the conclusion with the fourth exception classified as operating, issue it with the fourth exception as design, or issue it with the fourth exception undetermined and the limitation extended. The consequence of each was modelled, including that the third is the only one that survives the configuration arriving and contradicting him. The re-performance standard was applied to each, asking whether an independent tester with the same evidence would reach the same conclusion.",
    futureSignals: [
      "Three options set out unranked with their consequences modelled",
      "The re-performance standard applied to each option explicitly",
      "The service level breach shown 67 minutes ahead with an escalation prepared",
      "The two conceded assertions confirmed as unaffected by any of the three options",
      "The population's time bounding restated as a separate limitation regardless of the choice",
    ],
    evidenceIds: ["EVD-2026-41852", "EVD-2026-41908", "EVD-2026-41805", "EVD-2026-41855"],
    decisionIds: ["DEC-2026-0760"],
    uncertaintyNote:
      "The classification of the fourth exception cannot be determined without the tenant configuration. Two of the three options require a determination that cannot be evidenced. The third does not, and is the only option whose conclusion cannot be falsified by the evidence that has already been requested.",
  }),

  cell("M06", "incident-resilience", {
    workObjectKind: "decision-brief",
    workObjectId: "RB-PAY-007",
    headline: "A documentation correction would align one document to an assumption",
    todayNarrative:
      "Decides whether the runbook's section 4 contradiction is a documentation correction or a resilience finding, on the basis of a working group discussion that reached no conclusion, with no record of what either option would mean.",
    todaySignals: [
      "A working group discussion that reached no conclusion and produced no record",
      "Two options with no modelled consequence for either",
      "A choice about whether to criticise a peer's runbook, taken without a frame",
      "No visibility of what the pending supplier evidence would change",
    ],
    futureNarrative:
      "The decision was surfaced with its affected objects and the working group's acknowledgement of the unlogged activation attached. Two options were set out unranked: a documentation correction owned by the process owner, closed in days, with no governance visibility; or a resilience finding with a remediation action, committee visibility and an implied criticism of a runbook he owns. The consequence of each was modelled, including that a documentation correction would not require anyone to establish what actually changes during fallback, which is the substantive question.",
    futureSignals: [
      "Two options set out unranked, with owners and timelines modelled per option",
      "The substantive question named: nobody has established what changes during fallback",
      "The control inventory reconciliation restated with the conditional control identified",
      "The pending configuration flagged as the only thing that would establish the answer",
      "The two measure tolerance question attached as a separate open item",
    ],
    evidenceIds: ["EVD-2026-41705", "EVD-2026-41700", "EVD-2026-41500", "EVD-2026-41810"],
    decisionIds: ["DEC-2026-0761", "DEC-2026-0751"],
    uncertaintyNote:
      "The contradiction is between two Arcadia documents. What actually changes during fallback operation is not established by either of them and requires the supplier configuration, which control assurance has demanded and which is overdue. A documentation correction made now would correct one document to match an assumption rather than a fact. That sentence would have changed the decision if it had been weighted, and two hours and twenty seven minutes later the fallback route is activated.",
  }),

  cell("M06", "regulatory-change", {
    workObjectKind: "decision-brief",
    workObjectId: "OBL-2026-0088-002",
    headline: "A filing deficiency names a person; a scope question names the standard",
    todayNarrative:
      "Decides how to characterise the Swiss inventory gap, and whether to treat the subprocessor arrangement as a live compliance question or as a third party risk dependency, on the basis of a forum discussion that produced a jurisdictional muddle. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "A forum discussion that produced a jurisdictional muddle rather than a determination",
      "Two characterisations available on the same facts with no comparison of them",
      "An unanswered legal question with no expected date",
      "A choice between naming a person and naming a standard, taken without a frame",
    ],
    futureNarrative:
      "The decision was surfaced with its affected objects and the two split obligations shown as separately tracked. Two options were set out unranked for the inventory gap: a filing deficiency, which names a person and a date and closes quickly; or an inventory scope definition question, which names the standard and is slower and structural. The consequence of each was modelled, including that a filing deficiency closed by adding one line would leave the scope ambiguity intact and the same gap would recur. The standard's text on subcontracting depth was retrieved verbatim and confirmed ambiguous.",
    futureSignals: [
      "Two characterisations set out unranked with their consequences modelled",
      "The standard's text on subcontracting depth retrieved verbatim and confirmed ambiguous",
      "The recurrence consequence of the quick fix stated explicitly",
      "The two split obligations shown as separately tracked, one per lane",
      "The unanswered Group Legal question shown with no expected time rather than an invented one",
    ],
    evidenceIds: ["EVD-2026-41305", "EVD-2026-41405", "EVD-2026-41402"],
    decisionIds: ["DEC-2026-0762", "DEC-2026-0752"],
    uncertaintyNote:
      "The standard's text on subcontracting depth is ambiguous. Both characterisations are available on the same facts. This system has read the standard and cannot resolve its ambiguity, because resolving it is an interpretation of Arcadia's own requirement. Illustrative regulatory context, not legal advice.",
  }),

  cell("M06", "nfr-governance", {
    workObjectKind: "decision-brief",
    workObjectId: "MSN-2026-0147",
    headline: "Four second extensions granted in eight quarters and no record of whether any was met",
    todayNarrative:
      "Decides, alone, whether the overdue action goes to the committee as a re-baselining or as a board escalation. The difference is a peer's standing. She has facts, a template and no structure for the judgment.",
    todaySignals: [
      "A judgment about a peer's standing taken alone with a template",
      "No precedent data on whether prior extensions were ever met",
      "No modelled consequence for either option",
      "Two business days to the papers deadline",
    ],
    futureNarrative:
      "The decision was surfaced with its affected objects and the process owner's 11:31 reply attached, confirming the freeze and proposing a revised date. Two options were set out unranked: re-baseline to a date after the freeze ends with a root cause explanation and the unmet reporting condition disclosed; or escalate to the entity board. The consequence of each was modelled, including that re-baselining is the third date on this action and that a board escalation on a dependency blocked action would be read as procedural rather than substantive. The group precedent was checked, returning four second extensions in eight quarters, all granted.",
    futureSignals: [
      "Two options set out unranked with their consequences modelled",
      "The owner's reply received at 11:31 with a proposed date, checked as achievable on the verified chain",
      "Four prior second extensions in eight quarters, all granted",
      "No record anywhere of whether any prior extension was met",
      "The committee's own unmet reporting condition restated as a failure of her machinery",
    ],
    evidenceIds: ["EVD-2026-41280", "EVD-2026-41102", "EVD-2026-41205", "EVD-2026-41105"],
    decisionIds: ["DEC-2026-0763"],
    uncertaintyNote:
      "The proposed date is achievable on the verified dependency chain. Whether it will be achieved depends on testing scheduling behaviour, on which there is one data point: the request of 22.09.2026 is unanswered after 14 days. The group has granted four second extensions in eight quarters and this system holds no record of whether any of them were met, which is itself the finding.",
  }),

  /* ======================================================================
     M07  13:30  Remediation, negotiation or execution design

     Decisions become instruments: a contractual notice, an explanation
     request, a test plan, a runbook amendment, a paper. Execution rises
     sharply for the first time. The design test: every instrument is
     executable by its recipient without a further conversation, and every
     write carries an accountable name, an evidence reference, an entity
     partition, a timestamp and a reversibility statement.

     One cross-cutting fact at this moment. The configuration request
     breached its four hour service level at 12:52. It is escalated at
     12:55, a formal demand is issued at 13:41 citing the breach, and the
     supplier acknowledges at 14:02, three minutes before the event
     notification arrives.
     ====================================================================== */

  cell("M07", "tprm", {
    workObjectKind: "execution-receipt",
    workObjectId: "MSN-2026-0221",
    headline: "The formal demand appears on his screen without anyone asking him to send it",
    todayNarrative:
      "Opens a Word template for a supplier notice and starts writing. Calls Group Legal to check the wording, calls the commercial owner to warn him it is coming, and by 15:00 has a draft nobody has agreed. The formal demand for the configuration does not get sent, because nobody has told him the service level was breached.",
    todaySignals: [
      "A Word template as the starting point for a contractual notice",
      "Two telephone calls to coordinate one document",
      "A draft at 15:00 that nobody has agreed",
      "The service level breach unnoticed, so the formal demand is never sent",
    ],
    futureNarrative:
      "The 12:55 escalation surfaced with the breached service level, the clause text and the elapsed time, so the formal demand was on his screen without anyone asking. The three route split was structured into three instruments with owners and dates. The notice clause's requirements were parsed into the elements a valid notice must contain, so the draft is complete rather than approximately right, and the 30 day objection clock was computed from a proposed issue date. The variation route's precedent was checked, returning two prior variations with elapsed times of 41 and 58 days.",
    futureSignals: [
      "The formal configuration demand issued at 13:41 citing the 12:52 breach",
      "Three instruments created with three owners and three dates",
      "The notice clause parsed into its required elements, so the draft is complete",
      "Two prior variation precedents with elapsed times of 41 and 58 days",
      "The notice held for Group Legal review and the demand issued alone, which is the urgent instrument",
    ],
    evidenceIds: ["EVD-2026-41901", "EVD-2026-41410", "EVD-2026-41405", "EVD-2026-41235", "EVD-2026-41415"],
    decisionIds: ["DEC-2026-0759", "DEC-2026-0741"],
    uncertaintyNote:
      "The notice draft asserts that no notice was given. The evidential basis is a nil return across the contract repository, two shared mailboxes and the commercial owner's filed correspondence. If the supplier produces evidence of notice the assertion will be withdrawn, and the notice is drafted so that withdrawal would not prejudice the variation route or the drafting gap route.",
  }),

  cell("M07", "rcsa", {
    workObjectKind: "execution-receipt",
    workObjectId: "KRI-PAY-007",
    headline: "An explanation request with four specific questions rather than one general one",
    todayNarrative:
      "Writes the first line explanation request and the dissent note for the committee, in two documents, from memory of a workshop that ended 90 minutes ago.",
    todaySignals: [
      "Two documents written from memory of a meeting 90 minutes past",
      "An explanation request framed as a general question",
      "Both positions in the dissent note paraphrased rather than quoted from source",
      "No structured record of the ten agreed positions",
    ],
    futureNarrative:
      "The dissent record loaded with both positions as recorded rather than as remembered. The explanation request was framed as one causal investigation with the four specific questions it must answer: the two component growths, the 17 overrides outside the known windows, the cluster of 11 on one afternoon, and the interaction with reviewer establishment. Both positions in the dissent note were checked for accurate representation against their source records. The remediation against acceptance paths were modelled with their approvers and timelines, and the ten agreed positions were reconciled against the assessment record.",
    futureSignals: [
      "One explanation request with four named questions, issued with a 12.10.2026 date",
      "Both positions written with attribution, checked against their source records",
      "Ten agreed risk positions confirmed to the assessment record",
      "The unlogged activation question assigned with the independent corroboration attached",
      "A remediation plan template and a risk acceptance template prepared with the dates and rationale blank",
    ],
    evidenceIds: ["EVD-2026-41821", "EVD-2026-41810", "EVD-2026-41850", "EVD-2026-41855", "EVD-2026-41200"],
    decisionIds: ["DEC-2026-0772", "DEC-2026-0771"],
    uncertaintyNote:
      "The risk acceptance template is prepared because it is one of two available paths. Preparing it does not indicate that it is appropriate. On current facts the entity Chief Operating Officer would be asked to accept a residual score of 12 on a payment execution risk with one Partially Effective preventive control and no confirmed loss. Whether that is signable is a judgment for the approver.",
  }),

  cell("M07", "control-assurance", {
    workObjectKind: "execution-receipt",
    workObjectId: "TST-2026-0318",
    headline: "A conclusion issued with two limitations rather than held hostage to a supplier",
    todayNarrative:
      "Notices at some point in the afternoon that the supplier has not replied about the configuration. Sends a chase. Writes his conclusion with the limitation, in Word, and starts his section of the joint paper.",
    todaySignals: [
      "A service level breach noticed by chance rather than by alert",
      "A chase sent with no citation of the breached clause",
      "A conclusion written in Word with the limitation as prose",
      "No record of what the extended population would need to be",
    ],
    futureNarrative:
      "The 12:52 breach surfaced at 12:53 with the escalation prepared, sent at 12:55 and acknowledged. The formal demand at 13:41 was shown with its acknowledgement expected. The conclusion was re-derived with the fourth exception undetermined and both limitations stated, and the re-performance standard applied, confirming that an independent tester with the same evidence would reach the same conclusion. The extended population was scoped by condition rather than by time, returning every fallback window since the rule entered the tenant as the correct population and seven known windows as the currently identifiable set.",
    futureSignals: [
      "Conclusion issued as Partially Effective with the fourth exception undetermined and two limitations",
      "The escalation to third party risk logged at 12:55 and acknowledged",
      "The extended population scoped by condition, with seven windows currently identifiable",
      "Three Q4 candidate controls added to the plan as configuration examination candidates",
      "The challenge meeting outcome written with two assertions recorded as agreed",
    ],
    evidenceIds: ["EVD-2026-41852", "EVD-2026-41805", "EVD-2026-41908", "EVD-2026-41810", "EVD-2026-41610"],
    decisionIds: ["DEC-2026-0760", "DEC-2026-0748"],
    uncertaintyNote:
      "The extended population is defined by condition rather than by time, which means its true size is unknown until the supplier confirms the complete set of fallback windows since the rule was introduced. Seven windows are identifiable from Arcadia's own configuration audit log, and whether that log is complete for the whole period has not been verified.",
  }),

  cell("M07", "incident-resilience", {
    workObjectKind: "execution-receipt",
    workObjectId: "RB-PAY-007",
    headline: "A remediation split in two, because only half of it can be specified",
    todayNarrative:
      "Writes the runbook finding and the tolerance review paper, and drafts a test plan for the fallback path that she will not get resourced this quarter.",
    todaySignals: [
      "A finding and a paper written in two separate documents",
      "A test plan drafted with no resourcing route attached to it",
      "A runbook amendment specified as one action with a later date",
      "The section 4 assertion left in force while the amendment waits",
    ],
    futureNarrative:
      "The runbook amendment was scoped to the specific text requiring change and split into two parts, because the replacement text cannot be written until the configuration arrives. The fallback path test was designed as a severe but plausible scenario with observation points: recovery time, control effects, queue behaviour and the Swiss correspondent path as a separate scenario because it has never been rehearsed. All four tolerances were re-enumerated with their measures for the committee paper, and the two measure question was carried as an open item with the latest safe start computation attached as an operational consequence.",
    futureSignals: [
      "The runbook amendment created in two parts with the second part dependent on evidence",
      "A fallback path test designed with four observation points including control effects",
      "A separate Swiss rehearsal written as its own item, because the route has never been rehearsed",
      "Four tolerances enumerated with their measures for the committee paper",
      "The latest safe start time attached to the tolerance question as an operational consequence",
    ],
    evidenceIds: ["EVD-2026-41705", "EVD-2026-41710", "EVD-2026-41500", "EVD-2026-41700", "EVD-2026-41810"],
    decisionIds: ["DEC-2026-0761", "DEC-2026-0751", "DEC-2026-0750"],
    uncertaintyNote:
      "The runbook amendment can only be partly specified. The assertion in section 4 can be removed now, because it had no basis when it was written. The correct replacement text, stating what actually changes during fallback operation, cannot be written until the supplier configuration is available, so the action is scoped in two parts with the second part dependent on evidence that control assurance has formally demanded.",
  }),

  cell("M07", "regulatory-change", {
    workObjectKind: "obligation-lineage",
    workObjectId: "REG-2026-0031",
    headline: "A remediation plan at field level rather than at percentage level",
    todayNarrative:
      "Writes two noting papers and the register remediation plan. Chases Group Legal about Pune. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "A remediation plan written against a completeness percentage",
      "Two noting papers written in parallel with no shared structure",
      "A legal chase with no age and no escalation path",
      "A held consultation comment that exists only in a drafts folder",
    ],
    futureNarrative:
      "The register remediation was scoped to three named Tier 1 records and their specific incomplete fields, so the plan is field level rather than percentage level. The inventory standard's subcontracting depth ambiguity was drafted into a proposed clarification. The subprocessor arrangement's dual lane tracking was confirmed with separate evidence requirements. The consultation window was shown at 17 days with the held precedence comment carried forward from the workbench moment, and the service classification question was scoped with its payment type dependency.",
    futureSignals: [
      "Register remediation written at field level against three named records",
      "An inventory standard clarification proposed against the Swiss lane obligation",
      "Both noting papers written with a four state decomposition replacing the percentage",
      "The legal question escalated with its age stated",
      "The precedence comment still held, still lacking a concrete case, still on his screen",
    ],
    evidenceIds: ["EVD-2026-41300", "EVD-2026-41305", "EVD-2026-41402", "EVD-2026-41310", "EVD-2026-41405"],
    decisionIds: ["DEC-2026-0762", "DEC-2026-0753", "DEC-2026-0754"],
    uncertaintyNote:
      "The proposed inventory standard clarification would require subcontractors of significant outsourcings to be recorded where they have access to client identifying data. This is a proposal about Arcadia's own standard. Whether it is required is a matter for interpretation with Group Legal. Illustrative regulatory context, not legal advice.",
  }),

  cell("M07", "nfr-governance", {
    workObjectKind: "execution-receipt",
    workObjectId: "AG-CMT-NFR-2026-10-03",
    headline: "A paper structured at 13:30 that makes a small adjustment possible at 16:20",
    todayNarrative:
      "Writes the overdue actions paper, revises the divergence paper, and has two papers left with one and a half days.",
    todaySignals: [
      "Two papers written in PowerPoint from last quarter's templates",
      "Readiness tracked in a spreadsheet updated by hand",
      "No test applied to whether each paper asks an answerable question",
      "One and a half business days to the papers deadline",
    ],
    futureNarrative:
      "The issued assurance conclusion and the recorded dissent were reconciled into one coherent narrative with both positions preserved and neither editorialised. The causal chain was re-rendered with the two inferred links marked and the confirmatory evidence named. The prior extension completion question was scoped into a specific committee request. The decision architecture for each of the five items was checked, confirming that each asks one answerable question, and the re-baselining proposal was checked against the verified dependency chain.",
    futureSignals: [
      "The overdue actions paper written with the recommendation, the disclosed unmet condition and the prior extension request",
      "The divergence paper revised with both positions and the chain marked as a hypothesis",
      "Five decision items each tested for whether they ask one answerable question",
      "Two handoff records created for the two papers she does not own",
      "The structural choice that lets a late fact sharpen the paper rather than invalidate it",
    ],
    evidenceIds: ["EVD-2026-41821", "EVD-2026-41280", "EVD-2026-41850", "EVD-2026-41855", "EVD-2026-41204"],
    decisionIds: ["DEC-2026-0763", "DEC-2026-0757", "DEC-2026-0755"],
    uncertaintyNote:
      "The divergence paper is written on a control conclusion that carries two stated limitations, one of which depends on supplier evidence formally demanded at 13:41 and not yet received. The paper is structured so that the arrival of that evidence would sharpen the question it asks rather than invalidate it. If the evidence contradicts the conclusion, the paper's question still stands.",
  }),

  /* ======================================================================
     M08  14:05  Shared supplier and payments event

     One event, six lenses. Facts arrive classified, incomplete and in
     conflict. This moment covers 14:05 to approximately 15:00 and the first
     nine information arrivals. The design test: no role sees a summary.
     Every role sees the same facts with the same classifications, filtered
     to its own objects, and a classification never changes silently.
     ====================================================================== */

  cell("M08", "tprm", {
    workObjectKind: "supplier-dossier",
    workObjectId: "TP-0042",
    headline: "Five of six mandatory notification fields absent, checked against the clause while it happens",
    todayNarrative:
      "Sees the 14:05 notification in a shared mailbox, possibly an hour later, possibly not at all, because supplier notifications go to payment operations and he is copied. Learns about the incident when someone mentions it. Has no way to check the notification against the contract while it is happening.",
    todaySignals: [
      "A supplier notification arriving in a shared mailbox he is copied on",
      "The incident learned about by word of mouth",
      "No way to check a notification against a clause in real time",
      "Bridge statements captured only in personal notes",
    ],
    futureNarrative:
      "The notification was routed to him at 14:05:14 with its text and the notification clause's six mandatory fields side by side, and reconciled field by field, returning five of six absent. The claim of no customer impact was held as an unverified supplier assertion and set against the Arcadia latency telemetry that contradicts it. When the supplier's continuity lead named a second hosting region at 14:55, that reference was reconciled against the binding appendix within forty seconds, returning the region as unlisted, which converts the morning's documentation finding into an operational one.",
    futureSignals: [
      "Notification reconciled against the clause: five of six mandatory fields absent",
      "The no customer impact claim held as a supplier assertion, not restated as fact",
      "The named hosting region reconciled against the binding appendix in forty seconds",
      "The monitoring pipeline disclosure mapped to a correctly listed subprocessor in Brno",
      "Two conflicts registered with both statements attributed and neither resolved",
    ],
    evidenceIds: ["EVD-2026-41871", "EVD-2026-41420", "EVD-2026-41410", "EVD-2026-41405", "EVD-2026-41872"],
    decisionIds: ["DEC-2026-0779", "DEC-2026-0759"],
    uncertaintyNote:
      "The supplier's verbal root cause statement and its written portal update seven minutes later conflict on whether the cause is known. A supplier's written communications policy may withhold an unconfirmed cause, in which case both statements are honest. This system registers the conflict and does not resolve it; resolution requires the subprocessor's own account.",
  }),

  cell("M08", "rcsa", {
    workObjectKind: "risk-control-graph",
    workObjectId: "RSK-0211",
    headline: "One afternoon producing as many route substitution overrides as the whole of September",
    todayNarrative:
      "Finds out about the event late and has no reason to connect it to her morning. If she hears about it, she hears that the gateway is slow, which is an operations matter. The 96 unreviewed overrides are invisible to her until someone in control assurance tells her, days later.",
    todaySignals: [
      "The event heard about as a gateway performance problem",
      "No routing rule that connects an operational event to a risk record",
      "The unreviewed overrides invisible for days",
      "A dissent recorded at 11:58 that will go to committee on its 11:58 basis",
    ],
    futureNarrative:
      "The event was routed to her at 14:13 because the fallback activation touches the repair process and the secondary review control, which is the routing rule that makes her presence at this moment possible at all. The activation was matched against the known windows, making today the eighth. The 138 route substitution overrides created in thirteen minutes were set against September's entire 198, making one afternoon comparable to a month. The 96 overrides with no reviewer were matched against her risk as a candidate materialisation and against her recorded dissent as evidence bearing on the disputed rating.",
    futureSignals: [
      "Event routed to her at 14:13 on an object match, not on a distribution list",
      "138 route substitution overrides in thirteen minutes against 198 for all of September",
      "The 96 unreviewed overrides linked to her risk as a candidate materialisation",
      "Both bridge statements registered as a conflict with the explicit note that her dissent's basis depends on which is correct",
      "The 23.09.2026 cluster re-examined and now consistent with the same mechanism",
    ],
    evidenceIds: ["EVD-2026-41874", "EVD-2026-41875", "EVD-2026-41878", "EVD-2026-41821", "EVD-2026-41810"],
    decisionIds: ["DEC-2026-0772", "DEC-2026-0782"],
    uncertaintyNote:
      "The 96 unreviewed overrides are a telemetry inference. The absence of a reviewer identity at query time is not proof that no review occurred, and the mechanism by which the supplier system writes that field is disputed between the control owner and the supplier. Her recorded dissent rests on a control environment rating that either account would change, in opposite directions. This must not be restated as a control failure until the conflict resolves.",
  }),

  cell("M08", "control-assurance", {
    workObjectKind: "population-field",
    workObjectId: "TST-2026-0318",
    headline: "His own test re-running itself at full coverage, in front of him",
    todayNarrative:
      "Nothing. He is in Vienna, he has issued his conclusion, and the event is a payment operations matter in Munich. He learns about the 96 overrides when someone runs a query, which on a normal day happens in the following week during an incident review, by which time the audit log query is harder to defend and the recall window on any misrouted payment has closed.",
    todaySignals: [
      "No involvement at all on the day it happens",
      "The query run a week later during an incident review",
      "The recall window on any misrouted payment closed before anyone looks",
      "His undetermined classification standing undetermined for weeks",
    ],
    futureNarrative:
      "The event was routed to him at 14:14 because the activation touches the control under test. The activation's mode was matched against the rule trace condition at 14:13, which is the moment the morning's undetermined classification becomes a live prediction. The override counts were reconciled exactly, 138 comprising 96 unreviewed, 29 reviewed and released and 13 awaiting review, and the 96 split by entity and checked to sum. All 96 were confirmed below the value threshold visible in the August rule trace, which makes the rule's shape inferable before the configuration arrives.",
    futureSignals: [
      "Event routed at 14:14 on the control under test, not on a distribution list",
      "Override counts reconciled exactly: 138 comprising 96, 29 and 13",
      "The 96 split by entity, 78 and 18, and checked to sum",
      "All 96 confirmed below the value threshold visible in the August trace",
      "A prediction recorded at 14:16 with its inferential basis and its falsification condition",
    ],
    evidenceIds: ["EVD-2026-41874", "EVD-2026-41878", "EVD-2026-41805", "EVD-2026-41876", "EVD-2026-41852"],
    decisionIds: ["DEC-2026-0764", "DEC-2026-0760"],
    uncertaintyNote:
      "The rule's shape is inferred from two observations: the August rule trace and the fact that all 96 overrides today fall below the same value threshold with the same reason code while fallback mode is active. The inference is consistent and unproven, and the value threshold could be a coincidence of the population. The configuration, demanded at 13:41 and acknowledged at 14:02, would settle it.",
  }),

  cell("M08", "incident-resilience", {
    workObjectKind: "incident-chronology",
    workObjectId: "INC-2026-0412",
    headline: "The Swiss entity surfaced as a separate lane at 14:15, with no fallback route",
    todayNarrative:
      "Gets a call from payment operations at some point after 14:30. Opens a bridge. Takes notes in a Word document. Asks what the impact is and gets three different answers. Raises the incident record at 14:29 from memory of the facts. Has no per entity view, so the Swiss position surfaces late, which is the worst possible failure in this scenario because the Swiss entity is the one with the deadline.",
    todaySignals: [
      "A Word document as the incident chronology",
      "Three different answers to one impact question",
      "An incident record raised from memory",
      "No per entity view, so the entity with the deadline surfaces last",
    ],
    futureNarrative:
      "The event was routed at 14:07 on the latency telemetry, 22 minutes before a human would have raised it. The incident record was created at 14:29 with every arrival to that point attached at its classification. The Swiss entity was surfaced at 14:15 as a separate lane with no fallback route, which no manual process achieves. The activation was timed precisely with both its documented and its undocumented consequences stated. The Swiss position was computed from the adapter's queue state, returning queueing since 13:47 with a consumed tolerance figure updating live and a latest safe start placed as a countdown.",
    futureSignals: [
      "Event routed at 14:07, 22 minutes before a human would have raised it",
      "The Swiss entity opened as a separate lane at 14:15 with no fallback route",
      "Both documented and undocumented consequences of the activation stated",
      "A latest safe start time placed as a live countdown with a named owner",
      "The zero tolerance control condition recorded with 96 candidate breaches",
    ],
    evidenceIds: ["EVD-2026-41871", "EVD-2026-41874", "EVD-2026-41875", "EVD-2026-41878", "EVD-2026-41500", "EVD-2026-41710"],
    decisionIds: ["DEC-2026-0765", "DEC-2026-0776"],
    uncertaintyNote:
      "The disruption start is estimated from Arcadia-side latency telemetry and is not supplier confirmed. The Swiss consumed tolerance figure is computed from a queueing start observed in the adapter, which is firmer. If the true start is earlier, the consumed tolerance is larger and the latest safe start moves earlier. Separately, the Swiss tolerance has two measures with no precedence, so whichever decision is taken this system will not be able to state whether the tolerance was breached.",
  }),

  cell("M08", "regulatory-change", {
    workObjectKind: "obligation-lineage",
    workObjectId: "OBL-2026-0117-001",
    headline: "Two classification structures opened with no shared fields, before either assessor asks",
    todayNarrative:
      "Not involved. Learns about the event the next morning, or at the incident review. By then the classification assessments have been done by someone else, possibly as one assessment covering three entities. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "No involvement on the day",
      "Classification assessments performed by someone else",
      "A material risk that one assessment covers three entities across two frameworks",
      "The framework owner reviewing after the fact rather than before it",
    ],
    futureNarrative:
      "The event was routed at 14:10 because the notification touches the supplier and the important business service, both of which carry obligations in both lanes. The classification criteria for both lanes were loaded as two separate assessment structures with no shared fields, which is the mechanism that prevents the merge. The EU lane criteria were enumerated with the available facts mapped to each and the gaps named, and the Swiss lane criteria were enumerated separately with their own fact mapping. The monitoring pipeline degradation was mapped to a subprocessor that is correctly recorded in both, so it raises no registry obligation, and that negative finding was stated rather than omitted.",
    futureSignals: [
      "Two classification structures opened with no shared fields, before either assessor asks",
      "EU lane criteria enumerated with available facts mapped and gaps named",
      "Swiss lane criteria enumerated separately with their own fact mapping",
      "The hosting region reference mapped into both lanes differently",
      "A negative finding stated: the monitoring subprocessor is correctly registered, so this is a resilience matter",
    ],
    evidenceIds: ["EVD-2026-41871", "EVD-2026-41420", "EVD-2026-41405", "EVD-2026-41410"],
    decisionIds: ["DEC-2026-0787", "DEC-2026-0752"],
    uncertaintyNote:
      "Both classification assessments are being opened on facts that are predominantly stakeholder statements: six of the first nine arrivals carry that classification. Any conclusion reached now is provisional and must carry an explicit reassessment trigger. Illustrative regulatory context, not legal advice.",
  }),

  cell("M08", "nfr-governance", {
    workObjectKind: "portfolio-thread",
    workObjectId: "THEME-PAY-01",
    headline: "A framework defect of her own: a zero tolerance with no detection",
    todayNarrative:
      "Hears about it at the severity notification, if the escalation map runs. Has no view of what it means for her papers until the next day.",
    todaySignals: [
      "A severity notification with no assessment of what it changes",
      "No view of the impact on five committee papers until the following morning",
      "A causal chain that cannot be extended because nothing links the event to it",
      "An agenda item that will be added, if at all, on incomplete facts",
    ],
    futureNarrative:
      "The event was routed at 14:15 because the activation touches the control that is the subject of her divergence paper. The five agenda items were re-checked for impact, returning two affected. The causal chain was extended with the event as a candidate eighth node, marked provisional. The 96 candidate breaches were assessed against the zero threshold and against the absence of any monitoring capable of detecting such a breach, which is a framework defect in her own machinery and was recorded as one. The divergence paper's structure was re-tested against the new facts, confirming that its question still stands whichever way the conflict resolves.",
    futureSignals: [
      "Event routed at 14:15 on the control that is the subject of her paper",
      "Two of five agenda items assessed as affected",
      "The causal chain extended to a candidate eighth node, marked provisional",
      "A framework defect recorded: a zero tolerance with no detection capability",
      "A tenth agenda item prepared and deliberately not added",
    ],
    evidenceIds: ["EVD-2026-41878", "EVD-2026-41876", "EVD-2026-41874", "EVD-2026-41204", "EVD-2026-41821"],
    decisionIds: ["DEC-2026-0781", "DEC-2026-0784", "DEC-2026-0755"],
    uncertaintyNote:
      "The causal chain extension is provisional. The override query result is a telemetry inference and the mechanism conflict is unresolved. If the control owner's account is correct the extension is wrong and the chain reverts to seven nodes. The extension is marked provisional in the record and must not be shown to the committee as established.",
  }),

  /* ======================================================================
     M09  15:00  Event response and stakeholder engagement

     The heaviest moment in the day. Conflicts resolve, an irreversible
     decision is taken under time pressure, and a confirmed error appears.
     This moment covers approximately 15:00 to 16:30 and arrivals ten to
     seventeen. The design test: reclassification is visible. When the
     override query moves from telemetry inference to verified fact at
     15:38, the history remains and the prior classification is retained.
     ====================================================================== */

  cell("M09", "tprm", {
    workObjectKind: "supplier-dossier",
    workObjectId: "TP-0042",
    headline: "The most serious finding of his day has nothing to do with the database",
    todayNarrative:
      "On a bridge for two hours taking notes. Asks the supplier for the configuration and is told it will be looked into. Does not get it today. The appendix divergence and the second region disclosure are in his notes and nowhere else.",
    todaySignals: [
      "Two hours of bridge notes in a Word document",
      "A configuration request answered with a promise to look into it",
      "Nothing in the system of record until the following day, written from recollection",
      "A detection dependency nobody identifies at all",
    ],
    futureNarrative:
      "The configuration demand was re-issued at 15:12 at incident priority, citing the earlier demand, the breached service level and the live severity. The binding version opinion was circulated to all roles at 15:23. The configuration export arrived at 15:38 and was parsed, confirming the rule, its introduction date, its template origin, its client configurability, its firing count and that reviewer identity is written synchronously. The 2024 change record was retrieved and its release notes parsed, confirming that no control waiver was named. The subprocessor's own incident account arrived at 15:51 and the detection lag was computed from the quorum loss to the notification and attributed to a static connection string.",
    futureSignals: [
      "Configuration demand re-issued at 15:12 at incident priority and delivered at 15:38",
      "The rule confirmed with its origin, its conditions, its configurability and its firing history",
      "The 2024 release notes confirmed to have named no control waiver",
      "A 34 minute detection lag computed and attributed to a subprocessor's static connection string",
      "Accountability derived as shared, with its three components named rather than asserted",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41907", "EVD-2026-41911", "EVD-2026-41901", "EVD-2026-41425"],
    decisionIds: ["DEC-2026-0779", "DEC-2026-0785", "DEC-2026-0759"],
    uncertaintyNote:
      "The firing count is from the supplier's own export. Arcadia's configuration audit log independently confirms seven prior fallback windows plus today, which is consistent but does not verify the count; complete independent verification would require the full override population since the rule was introduced. Separately, the supplier's assertion that portal publication constitutes notice is a contractual position and not a fact, and the appendix requires prior written notice without defining the medium.",
  }),

  cell("M09", "rcsa", {
    workObjectKind: "risk-control-graph",
    workObjectId: "RSK-0211",
    headline: "The same score of 12, on a materially different basis",
    todayNarrative:
      "Not on the bridge. Finds out the following week that 96 overrides went unreviewed and that a rule she had never heard of caused it, by which time her dissent has already gone to committee on a control environment argument that was half right.",
    todaySignals: [
      "Not on the bridge, so the mechanism arrives a week late",
      "A dissent already at committee on reasoning that is half right",
      "No mechanism to connect a configuration fact to an assessment rationale",
      "The compensating control argument never tested against an actual case",
    ],
    futureNarrative:
      "The configuration export was routed to her at 15:39 with its bearing on her recorded dissent stated. The override query's reclassification from inference to verified fact was shown as a reclassification event with its timestamp and its prior classification retained rather than overwritten. The rule's condition was set against the morning's component analysis, confirming that every September activation waived the control for its duration and quantifying the prior firings. The residual reasoning was re-derived, returning the same score on a materially different basis. The compensating control argument was re-tested against the confirmed error, returning that the value reconciliation reconciled value correctly and did not detect the wrong intermediary.",
    futureSignals: [
      "Reclassification shown as an event with a timestamp and the prior class retained",
      "Every September activation confirmed as having waived the control for its duration",
      "Residual reasoning re-derived: same score of 12, different basis",
      "Her workbench characterisation of the reconciliation control confirmed by an actual case",
      "The first line argument that no loss occurred no longer available, with the recall noted",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41924", "EVD-2026-41930", "EVD-2026-41878"],
    decisionIds: ["DEC-2026-0782", "DEC-2026-0772"],
    uncertaintyNote:
      "The post event validation confirms one erroneous release in a sample of 20 drawn from 96. The extrapolation is an inference on an unstratified sample and the single error occurred on the most error prone repair type. The verified fact is one error and the number of further errors is unknown. Separately, the score of 12 is unchanged and its basis has changed materially: both readings support a score of 12 and only one of them is correct.",
  }),

  cell("M09", "control-assurance", {
    workObjectKind: "population-field",
    workObjectId: "TST-2026-0318",
    headline: "A prediction recorded at 14:16, confirmed at 15:38",
    todayNarrative:
      "Not involved. His conclusion, issued at 13:52 with the fourth exception undetermined, stands undetermined for weeks.",
    todaySignals: [
      "No involvement in the event response",
      "An undetermined classification left undetermined for weeks",
      "The population shape defect never identified",
      "A concession to the control owner never made, because the evidence never arrives to him",
    ],
    futureNarrative:
      "The configuration export was routed to him at 15:38:40 with his 14:16 prediction shown alongside it, confirmed. The same evidence was routed to the control owner at the same moment, so neither learns it before the other, which matters for the joint conclusion. The fourth exception was reclassified from undetermined to design deficiency with accountability shared. The firing history was set against his time bounded population, confirming that a number of firings preceded his test period and were structurally invisible to it. The three remaining exceptions were re-tested against the rule and confirmed independent of it, which is the precise boundary of what he concedes.",
    futureSignals: [
      "His 14:16 prediction marked confirmed with its evidence attached",
      "The same evidence routed to both parties at the same moment",
      "The fourth exception reclassified to design with accountability shared",
      "The three remaining exceptions confirmed independent of the rule",
      "The extended population re-scoped to every firing since the rule was introduced",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41907", "EVD-2026-41876", "EVD-2026-41924", "EVD-2026-41852"],
    decisionIds: ["DEC-2026-0778", "DEC-2026-0783"],
    uncertaintyNote:
      "The prior firings are confirmed by the supplier's export and not independently verified. Their override records exist in the supplier system and have not been examined. The extended population is therefore every firing of the rule, of which 96 are examined today and one was examined in the original test, which leaves a number that have never been examined by anyone.",
  }),

  cell("M09", "incident-resilience", {
    workObjectKind: "incident-chronology",
    workObjectId: "INC-2026-0412",
    headline: "Two measures, two answers, and an entity that cannot state whether it breached",
    todayNarrative:
      "Runs a bridge, takes notes, upgrades severity on instinct, and tries to get a decision out of Zurich while three people talk over each other. The Swiss tolerance position is a number she recalculates in her head. Both classification assessments get done next week, possibly as one.",
    todaySignals: [
      "A tolerance position recalculated mentally during a call",
      "Severity upgraded on instinct with the criteria written afterwards",
      "Three people talking over each other about an entity decision",
      "Both classification assessments deferred, with a real risk of being merged",
    ],
    futureNarrative:
      "The Swiss position arrived at 15:09 with the remaining tolerance and the cut-off distance shown against the manual route's lead time, which renders the decision without a word. Severity was upgraded at 15:14 on two independently recorded criteria and the escalation map executed with delivery recorded. Both classification assessments were opened at 15:20 in the two separate records the framework owner created. The tolerance was tracked live on both measures. When the correspondent confirmation arrived at 16:04, both measures were evaluated: the cut-off measure satisfied and the elapsed measure exceeded, with the divergence registered as an unresolved conflict rather than adjudicated.",
    futureSignals: [
      "The Swiss decision rendered as a runway rather than described as a situation",
      "Severity upgraded at 15:14 on two independently recorded criteria",
      "Both classification assessments opened at 15:20 as two records with no shared fields",
      "The supplier's recovery estimate assessed as a statement with no evidential basis and explicitly not relied on",
      "Both tolerance measures evaluated and the divergence registered as unresolved with an owner and a destination",
    ],
    evidenceIds: ["EVD-2026-41882", "EVD-2026-41918", "EVD-2026-41905", "EVD-2026-41911", "EVD-2026-41921", "EVD-2026-41500"],
    decisionIds: ["DEC-2026-0776", "DEC-2026-0774", "DEC-2026-0775", "DEC-2026-0786"],
    uncertaintyNote:
      "The Swiss tolerance gives two answers. The cut-off completion measure is satisfied and the elapsed disruption measure is exceeded by 11 minutes. The tolerance record states no precedence. This system cannot determine whether the tolerance was breached and will not choose a measure; the question is registered as an open conflict with a named owner and a committee destination. Separately, the manual route worked on a 45 minute lead time that has never been rehearsed, and one data point does not validate a lead time.",
  }),

  cell("M09", "regulatory-change", {
    workObjectKind: "obligation-lineage",
    workObjectId: "OBL-2026-0104-003",
    headline: "A comment held since 08:45 routed to him with the case attached",
    todayNarrative:
      "Not involved. The consultation on the tolerance standard closes on 23.10.2026 with no precedence requirement, and every tolerance written under it inherits the defect. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "No involvement in the event",
      "A held consultation comment that never finds its case",
      "A standard issued with a defect that becomes the group norm",
      "Two classification assessments monitored by nobody as two records",
    ],
    futureNarrative:
      "Both classification assessments were monitored as two separate records with no field sharing. The configuration export was routed at 15:40 with its obligation implications per lane, and the subprocessor account at 15:52. At 16:05 the correspondent confirmation was routed with the held precedence comment attached, which is the routing decision that makes the day's cheapest high value act possible. The waived control question was framed precisely and routed to Group Legal and the Chief Compliance Officer rather than answered. The monitoring subprocessor's correct registry status was re-confirmed, so the detection failure raises a resilience obligation and not a registry one, stated as a distinction.",
    futureSignals: [
      "Both classification records monitored with no field sharing, both carrying reassessment triggers",
      "The tolerance divergence routed with the held comment from 08:45 attached to it",
      "The waived control question framed precisely and routed rather than answered",
      "Subprocessor change obligations updated separately per lane, none crossing",
      "The consultation comment sent with a concrete case, 17 days before the window closes",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41911", "EVD-2026-41918", "EVD-2026-41310", "EVD-2026-41500"],
    decisionIds: ["DEC-2026-0787", "DEC-2026-0753"],
    uncertaintyNote:
      "Whether any position Arcadia has stated externally about its payment control environment now requires review is a question for Group Legal and the Group Chief Compliance Officer. This function has framed the question and identified the facts bearing on it. It does not answer it and must not. Illustrative regulatory context, not legal advice.",
  }),

  cell("M09", "nfr-governance", {
    workObjectKind: "portfolio-thread",
    workObjectId: "CMT-NFR-2026-10",
    headline: "A question the supplier's report cannot invalidate, whatever it says",
    todayNarrative:
      "Receives a severity notification and a series of increasingly worrying messages. Has no idea what it means for her papers until the following morning, by which time the deadline is one day away.",
    todaySignals: [
      "A severity notification followed by messages of rising concern",
      "No assessment of the impact on six papers until the next morning",
      "A deadline one day away when the impact is finally understood",
      "An agenda item added, if at all, without a decision architecture",
    ],
    futureNarrative:
      "All arrivals were routed as they came with their classifications and reclassifications. The report commitment was computed against the papers deadline, returning a three business day gap with the supplier's account arriving on the meeting morning. The causal chain's provisional extension was confirmed at 15:38 and the chain finalised, with one previously inferred link now evidenced. The tenth item's decision architecture was designed around a question the supplier's report cannot invalidate. The documentation action on this exact rule was re-assessed as a governance discipline finding, having been open and untouched for eleven days. The eight new remediation actions across five roles were reconciled into one portfolio view.",
    futureSignals: [
      "A three business day gap computed between the papers deadline and the supplier report",
      "The causal chain finalised with one previously inferred link now evidenced",
      "A decision architecture built around a question that survives any supplier account",
      "The untouched documentation action re-assessed as a governance discipline finding",
      "Eight new remediation actions across five roles reconciled into one portfolio view with owners and dates",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41907", "EVD-2026-41911", "EVD-2026-41921", "EVD-2026-41821"],
    decisionIds: ["DEC-2026-0781", "DEC-2026-0784", "DEC-2026-0755"],
    uncertaintyNote:
      "The supplier's written incident report is due on the morning of the committee and the papers close two business days earlier. Any paper written now is written without the supplier's account of root cause. The tenth item's question is constructed so that the report's content cannot invalidate the decision requested, whatever it says, and that construction is the only thing making a decision possible at this meeting.",
  }),

  /* ======================================================================
     M10  16:30  End-of-day summary and overnight work

     The highest execution count of the day for every role. The day's work
     becomes state: records written, actions created, evidence retained,
     overnight work queued. The design test: nothing is summarised that is
     not also written, and nothing is written without a human release, an
     accountable name and an evidence reference.

     Two facts hold across all six cells. The joint control conclusion is
     recorded at 16:41, signed by both lines. And the tolerance question
     remains open. The day ends with one unresolved question, an owner and a
     destination, and the product does not apologise for it.
     ====================================================================== */

  cell("M10", "tprm", {
    workObjectKind: "end-of-day-summary",
    workObjectId: "TP-0042",
    headline: "Three findings genuinely new, two that are the morning's findings now evidenced",
    todayNarrative:
      "Leaves at 19:30 with bridge notes in a Word document and nothing in the system of record. Writes it up on 07.10.2026 from memory, by which time the minute is his recollection rather than a record.",
    todaySignals: [
      "A Word document of bridge notes as the only record",
      "The write-up done the next day from memory",
      "The supplier's minute as the authoritative account of the meeting",
      "No overnight queue and no sequenced first actions for tomorrow",
    ],
    futureNarrative:
      "The day's supplier findings were assembled into one consolidated position and cross-checked for double counting against the morning's items, returning three genuinely new findings and two that are the morning's findings now evidenced. The reassessment's open item count was recomputed, returning two questions materially advanced by the event's evidence and two unchanged. The concentration position was recomputed with the detection dependency added. The Arcadia authored minute was closed and circulated, which means the supplier does not own the record of the day. The overnight queue was registered with five items and owners.",
    futureSignals: [
      "Five findings cross-checked: three genuinely new, two now evidenced",
      "Reassessment open items recomputed: two advanced by the event, two unchanged",
      "Concentration position recomputed with the detection dependency added",
      "The Arcadia authored minute closed and circulated with a delivery record",
      "A decision date set for the contractual notice, before the papers close, so the committee sees a decision either way",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41907", "EVD-2026-41911", "EVD-2026-41415", "EVD-2026-41445"],
    decisionIds: ["DEC-2026-0785", "DEC-2026-0779", "DEC-2026-0759"],
    uncertaintyNote:
      "Three of today's five findings rest on supplier provided evidence obtained under the audit and access appendix, and the supplier's written incident report may add to, qualify or contradict it. Two findings rest on Arcadia's own records, the 2024 change record and the contract repository, and are not exposed to that risk.",
  }),

  cell("M10", "rcsa", {
    workObjectKind: "end-of-day-summary",
    workObjectId: "RCSA-ARC-DE-PAYOPS-2026-Q4",
    headline: "A dissent recorded as satisfied rather than as upheld",
    todayNarrative:
      "Writes up the workshop on 07.10.2026. The dissent goes to committee on its 11:58 reasoning, uncorrected, because she never learns what actually happened.",
    todaySignals: [
      "The workshop written up the following day",
      "A dissent that goes to committee on reasoning nobody corrected",
      "No connection between an event and an assessment rationale",
      "No record of whether the disagreement was satisfied or upheld",
    ],
    futureNarrative:
      "The joint conclusion was reconciled against her recorded dissent, confirming that the residual moves by agreement rather than by escalation and that her dissent is therefore satisfied rather than upheld, which is a distinction worth recording. The Q4 assessment was recomputed with the control environment now agreed, returning the residual and the appetite position. The appetite consequence was re-derived, returning that a risk acceptance is no longer realistically signable given one confirmed erroneous release and that the remediation path is the only live option. The other ten risk positions were confirmed unaffected.",
    futureSignals: [
      "The joint conclusion reconciled against her dissent, recorded as satisfied rather than upheld",
      "The Q4 residual written with the agreed control environment rating",
      "The appetite consequence re-derived: the remediation path is the only live option",
      "Her dissent's reasoning revised with the full prior reasoning retained",
      "The full examination result registered as a dependency for the committee paper",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41924", "EVD-2026-41930", "EVD-2026-41850"],
    decisionIds: ["DEC-2026-0782", "DEC-2026-0772"],
    uncertaintyNote:
      "The residual score is now agreed by both lines and it rests in part on a post event validation that confirms one erroneous release in a sample of 20 drawn from 96. The full examination of all 96 reports at 12:00 tomorrow. If it finds substantially more errors, impact may need to be reassessed upward; if it finds none beyond the one, the score is unaffected. The assessment is written to be stable under either outcome.",
  }),

  cell("M10", "control-assurance", {
    workObjectKind: "execution-receipt",
    workObjectId: "TST-2026-0318",
    headline: "Volunteering a linkage to Internal Audit that includes his own classification",
    todayNarrative:
      "Learns nothing. Reopens the file in November.",
    todaySignals: [
      "The file closed and reopened in November",
      "The conclusion's deficiency composition never revised",
      "The population shape defect never identified as a method finding",
      "The link between his own root cause classification and the event never volunteered",
    ],
    futureNarrative:
      "The joint conclusion was reconciled against his issued conclusion, confirming that the conclusion is unchanged at Partially Effective and that the deficiency composition has changed from three operating plus one undetermined to three operating plus one design plus 96 design instances. The first limitation was confirmed closed and the second retained and now quantified as the number of firings never examined. The unresolvable item was re-confirmed as permanently unresolvable, with the design characterisation now supported by the synchronous write fact. The re-performance standard was re-applied to the revised conclusion, and the working papers were versioned and closed for the period.",
    futureSignals: [
      "Revised conclusion written with the changed deficiency composition and one retained limitation",
      "The 96 instances recorded as design deficiency instances with their values",
      "The 14:16 prediction record confirmed as evidence of the inference's timing",
      "The three Q4 candidate controls added as priority with the configuration examination method now proven necessary",
      "A note prepared to Internal Audit on the overdue action linkage, which carries a personal cost and no professional upside",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41907", "EVD-2026-41876", "EVD-2026-41924", "EVD-2026-41852"],
    decisionIds: ["DEC-2026-0783", "DEC-2026-0778", "DEC-2026-0748"],
    uncertaintyNote:
      "The revised conclusion retains one limitation: the tested population was bounded by time and a number of the rule's firings have never been examined. The condition bounded re-test addresses this and is due in November. Until then the conclusion covers the original test period plus the 96 instances of today, and no other period.",
  }),

  cell("M10", "incident-resilience", {
    workObjectKind: "incident-chronology",
    workObjectId: "INC-2026-0412",
    headline: "Writing that the entity cannot determine whether its own tolerance was breached",
    todayNarrative:
      "Closes the bridge at 17:00 with a Word document of notes. Writes the incident record properly on 08.10.2026. Both classification assessments get documented retrospectively, and the two measure problem is never noticed, because whoever writes it up picks the measure that gives the comfortable answer.",
    todaySignals: [
      "A bridge closed with notes and no record",
      "The incident record written two days later",
      "Classification assessments documented retrospectively with a real risk of merging",
      "The comfortable measure chosen, undetectably",
    ],
    futureNarrative:
      "The incident timeline was assembled from all eighteen arrivals with their classifications and the one reclassification preserved. Both classification conclusions were confirmed as carrying reassessment triggers. The tolerance divergence was documented on both measures with the open question stated. The tolerance review's scope was extended to all four tolerances on the service after checking each for the same defect, returning three with a single measure and one with two, so the review is proportionate. The dependency map extension was scoped to subprocessor depth with two nodes named, and the fallback test design was updated with the control effect observation point that today proved necessary.",
    futureSignals: [
      "All eighteen arrivals written with their classifications and the reclassification preserved",
      "Both classification decisions confirmed provisional with triggers",
      "The tolerance question written as open with a named owner and a committee destination",
      "The tolerance review scoped to one affected tolerance of four, after checking each",
      "The detection lag written as a resilience finding against the supplier",
    ],
    evidenceIds: ["EVD-2026-41882", "EVD-2026-41905", "EVD-2026-41911", "EVD-2026-41918", "EVD-2026-41921", "EVD-2026-41924"],
    decisionIds: ["DEC-2026-0786", "DEC-2026-0774", "DEC-2026-0775", "DEC-2026-0761"],
    uncertaintyNote:
      "The Swiss entity cannot state whether its clearing tolerance was breached. The cut-off measure was satisfied and the elapsed measure was exceeded by 11 minutes, and no precedence exists. The question is recorded as open, owned by the resilience lead, and destined for the committee tolerance review. It will not be resolved by this system. Both classification conclusions are provisional and both carry a reassessment trigger on receipt of the supplier report. Illustrative regulatory context, not legal advice.",
  }),

  cell("M10", "regulatory-change", {
    workObjectKind: "end-of-day-summary",
    workObjectId: "REG-2026-0104",
    headline: "A percentage that barely moves while the picture improves materially",
    todayNarrative:
      "Goes home. Learns about the event at the incident review. The consultation on the tolerance standard closes with no precedence requirement, and every tolerance written under it inherits the defect. Illustrative regulatory context, not legal advice.",
    todaySignals: [
      "Home before the event's obligation effects are assessed",
      "A consultation closing with the defect intact",
      "Obligation state changes counted per lane by nobody",
      "A completeness figure reported as a figure",
    ],
    futureNarrative:
      "The day's obligation state changes were counted per lane, returning four in the EU lane and three in the Swiss lane, with none crossing. The register decomposition was recomputed after the event's evidence, returning one record moved from mapped and unevidenced to evidenced and one new unmapped obligation, so the headline figure barely moves while the structure improves materially. The Swiss lane inventory scope clarification was re-tested against the event's facts and returned as strengthened. The service classification question was re-assessed and returned as requiring a classification decision rather than further analysis.",
    futureSignals: [
      "Seven obligation state changes written per lane, none crossing",
      "One record newly evidenced and one new unmapped obligation identified",
      "The Swiss lane clarification strengthened by the event's facts",
      "The service classification question escalated as a decision request rather than as analysis",
      "The consultation comment record confirmed with its concrete case and its evidence",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41911", "EVD-2026-41310", "EVD-2026-41500", "EVD-2026-41300"],
    decisionIds: ["DEC-2026-0787", "DEC-2026-0753", "DEC-2026-0754", "DEC-2026-0762"],
    uncertaintyNote:
      "The register completeness figure barely moves while the underlying structure improves materially: one record newly evidenced, one new unmapped obligation identified. A figure that barely moves while the picture improves is evidence that the figure is the wrong measure, which is why the committee paper presents the four state decomposition instead. Illustrative regulatory context, not legal advice.",
  }),

  cell("M10", "nfr-governance", {
    workObjectKind: "end-of-day-summary",
    workObjectId: "THEME-PAY-01",
    headline: "One open question, an owner and a destination, and no apology for it",
    todayNarrative:
      "Works until 21:00 assembling papers from six people's emails. Two papers are late. The tenth item is not added because she does not know enough to add it. The committee notes an incident and takes no decision.",
    todaySignals: [
      "Papers assembled from six people's emails until 21:00",
      "Two papers late, which means they cannot carry a decision",
      "A tenth item not added for want of facts",
      "A committee that notes an incident and decides nothing",
    ],
    futureNarrative:
      "All six roles' day end states were assembled into one group position. The joint control conclusion was received and its effect on the divergence paper computed. The eight new remediation actions were reconciled into the portfolio with owners, dates and dependencies, and checked for owner capacity conflicts, returning two on one owner with overlapping dates. The finalised causal chain was re-tested against the day's verified facts. Each of the six decision items was re-tested for whether it asks one answerable question on the facts that will exist when papers close, returning six that do. The tenth item's question was re-tested against every plausible content of the supplier report, confirming that it survives all of them.",
    futureSignals: [
      "Six roles' day end states assembled into one group position",
      "Eight new remediation actions reconciled with two owner capacity conflicts flagged",
      "Six decision items each confirmed as asking one answerable question at the deadline",
      "The tenth item's question tested against every plausible supplier account and confirmed to survive",
      "One open conflict registered with an owner and a destination, and the day closed with it unresolved",
    ],
    evidenceIds: ["EVD-2026-41905", "EVD-2026-41906", "EVD-2026-41924", "EVD-2026-41918", "EVD-2026-41821", "EVD-2026-41204"],
    decisionIds: ["DEC-2026-0784", "DEC-2026-0781", "DEC-2026-0756", "DEC-2026-0763"],
    uncertaintyNote:
      "One fact material to the committee papers does not yet exist: the examination of all 96 releases, due at 12:00 tomorrow, which will exist before papers close. The supplier's report will not, and the tenth item is constructed so that its content cannot invalidate the decision requested. Two of the causal chain's links remain inferred and are marked as such in every paper.",
  }),
];
