/**
 * The shared 14:05 event, the incident history behind it, the recovery options
 * weighed during it, and the regulatory publications and candidate obligations
 * the Regulatory Change Manager works from.
 *
 * Authoritative source: docs/SCENARIO_BIBLE.md sections 5.3, 6.7, 6.8, 7, 13,
 * 15 (all subsections) and 16. Where this module and the bible disagree, the
 * bible wins and this module is fixed.
 *
 * Jurisdiction rule applied throughout. ARC-DE and ARC-AT sit in the EU lane
 * and may carry references to the Union digital operational resilience
 * regulation, to European Banking Authority outsourcing guidance and to
 * national supervision. ARC-CH sits in the Swiss lane and carries FINMA
 * operational risk, resilience and outsourcing context only. No row in this
 * file states or implies that the Union regulation applies to Arcadia Bank
 * Schweiz AG. The lanes are kept apart structurally: separate publications,
 * separate obligations with separate candidate entity lists, and separate
 * incident classification records that are never merged into one answer.
 * Nothing here asserts that Arcadia, or anyone else, is compliant with
 * anything. Every regulatory reference carries the mandatory label at the
 * point where it is displayed.
 *
 * Human decisions are left null on purpose. Incident severity, regulatory
 * classification, notification recommendation and obligation applicability are
 * the judgments the product exists to prepare completely and to decide never.
 * The specialist's proposal is recorded in a separate field so the
 * professional has something to accept or challenge.
 *
 * Synthetic institution and data. Illustrative regulatory context, not legal
 * advice.
 */

import {
  DEFAULT_RUN_ID,
  ENTITY_AT,
  ENTITY_CH,
  ENTITY_DE,
  MOMENTS,
  at,
  type NewIncident,
  type NewIncidentEvent,
  type NewObligation,
  type NewRecoveryOption,
  type NewRegulatoryPublication,
} from "./contract";

/**
 * A timestamp on a day other than the scenario day. Used only by the
 * historical records, which is why it is not in the shared contract: nothing
 * in the live day should need it.
 */
function onDay(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

/* ==========================================================================
   Incidents

   One shared event and eight historical records. The history is not padding.
   Six of the eight are prior activations of the same fallback route, which is
   what makes 06.10.2026 a repeat rather than a surprise, and two are near
   misses that name the exact capability the overdue Massnahme was raised to
   remove.
   ========================================================================== */

export const incidents: NewIncident[] = [
  /*
   * The 14:05 shared event. Five fields are deliberately null: severity,
   * severitySetByUserId, regulatoryClassification, notificationRecommended and
   * notificationRationale. Those are the Incident and Resilience Lead's
   * decisions inside the product. proposedSeverity carries what the specialist
   * would put in front of her, on the two S1 grounds in the severity scale: an
   * impact tolerance within 60 minutes of its limit, and a zero-tolerance
   * control condition with candidate breaches.
   *
   * No gross loss is booked. One misrouted payment of EUR 38,400 is confirmed
   * and recallable, with the recall initiated at 16:24. Writing a loss figure
   * now would pre-empt both the recall and the check of the remaining 76 cases.
   */
  {
    id: "INC-2026-0412",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0412",
    title:
      "Novalink regional service degradation affecting payment validation, repair and Swiss clearing",
    titleDe:
      "Regionale Stoerung bei Novalink mit Auswirkung auf Zahlungsvalidierung, Zahlungsreparatur und Schweizer Clearing",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    serviceIds: ["SVC-0042-01", "SVC-0042-02", "SVC-0042-05"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: at("14:07"),
    occurredAt: at("13:31"),
    closedAt: null,
    kind: "incident",
    severity: null,
    severitySetByUserId: null,
    proposedSeverity: "S1",
    status: "under-assessment",
    regulatoryClassification: null,
    notificationRecommended: null,
    notificationRationale: null,
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "Novalink notified degraded NOVA-GATE clearing submission performance in the DACH region at 14:05:12, with five of the six fields required by CTR-2023-0117-A5 clause 5.3 absent and with the assertion that no customer impact had been identified. Arcadia telemetry had already recorded submission acknowledgement latency rising from a seven-day median of 1.4 seconds to 42 seconds from 13:38, acknowledgement timeouts from 13:51, and 2,317 instructions held in SUBMITTED state. The technical start was established only at 15:51: a loss of database quorum at 13:31 in the Frankfurt region operated by subprocessor TP-0042.2 Rheinstack GmbH, following a storage firmware update applied in a maintenance window that was never notified to Arcadia. At 14:12:41 the acting Duty Manager, P-009 Elif Demir, invoked runbook RB-PAY-007 and set fallbackRouteMode = ACTIVE for Q-REPAIR-DE and Q-REPAIR-AT, switching clearing submission from SYS-0012 NOVA-GATE to SYS-0013 Arcadia Direct Link. The decision was correct under the runbook and within her authority. SYS-0013 performs no payment data validation, so instructions that NOVA-GATE would have enriched entered the repair queue with reason codes R01, R02, R04 or R08 and required OVR-C route-substitution overrides. Fallback activation also satisfied the second condition of RepairDesk rule RD-RULE-0031, which from 14:12:41 released every OVR-C override below EUR 250,000 without secondary review. Neither the runbook, nor the CTL-PAY-014 control description, nor the release notes that brought the rule into the tenant said so. Of 138 OVR-C overrides created between 14:12:41 and 14:26:00, 96 were released with secondaryReviewRequired = false and no reviewer identity, EUR 9,420,880 in combined value: 78 for ARC-DE at EUR 7,611,240 and 18 for ARC-AT at EUR 1,809,640. A 20-case post-event sample confirmed one misrepaired release, instruction PAY-DE-20261006-448127 at EUR 38,400, routed to the wrong intermediary institution and recalled at 16:24. ARC-CH had no fallback available. euroSIC and SIC submission through SVC-0042-05 queued from 13:47: 1,842 instructions at CHF 61,304,110, of which CHF 18,712,400 carried same-day value against a 16:00 CET cut-off (scenario figure). P-015 Sibylle Graf invoked RB-PAY-011 at 15:07 and submitted the same-day tranche manually through correspondent Helvetia Clearing Partner AG; 1,840 instructions were accepted at 15:58, two minutes inside the cut-off, and two instructions at CHF 14,200 rolled to value date 07.10.2026. NOVA-GATE latency returned to normal at 15:41 and full service was confirmed at 16:08. The record remains open pending Novalink's written incident report, due 13.10.2026, which arrives on the morning of CMT-NFR-2026-10 while committee papers are due 08.10.2026 at 12:00.",
    leadUserId: "P-005",
    isSharedEvent: true,
    lessonsLearned: "",
  },

  /*
   * 27.08.2026. The one that matters most in the history, and the one that was
   * closed as housekeeping. An OVR-C release made while this fallback was
   * active became EXC-TST-2026-0318-04 four weeks later, was classified as
   * "system configuration" and was closed with a documentation action that had
   * not been started by 06.10.2026.
   *
   * Duration is deliberately not stated as a total. Bible section 8.2 gives
   * the activation window precisely and section 9.1 gives the August aggregate
   * separately; the window is the load-bearing fact and is the one reproduced.
   */
  {
    id: "INC-2026-0361",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0361",
    title: "NOVA-GATE latency at the Munich payment hub with fallback route activation",
    titleDe: "NOVA-GATE Latenz im Zahlungsverkehrszentrum Muenchen mit Aktivierung der Ausweichroute",
    entityIds: [ENTITY_DE, ENTITY_AT],
    serviceIds: ["SVC-0042-01", "SVC-0042-02"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: onDay("2026-08-27", "15:14"),
    occurredAt: onDay("2026-08-27", "15:06"),
    closedAt: onDay("2026-09-03", "11:20"),
    kind: "incident",
    severity: "S3",
    severitySetByUserId: "P-005",
    proposedSeverity: "S3",
    status: "closed",
    regulatoryClassification:
      "Assessed for ARC-DE and ARC-AT against the EU major-incident classification criteria and not classified as a major incident. ARC-CH was not affected and no separate Swiss assessment was performed. Illustrative regulatory context, not legal advice.",
    notificationRecommended: false,
    notificationRationale:
      "No supervisory notification recommended. Service degradation was contained inside the ITOL-0004-01 window, no client funds were at risk and no impact tolerance was consumed beyond 45%. The assessment was recorded per entity rather than once for the group. Illustrative regulatory context, not legal advice.",
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "NOVA-GATE submission acknowledgement latency rose above the alerting threshold at the Munich hub. The Duty Manager invoked RB-PAY-007 and fallbackRouteMode was ACTIVE between 15:22 and 17:05. Repair queue volume rose as the runbook predicts and 24 OVR-C route-substitution overrides were created, against an ARC-DE total of 31 OVR-C overrides for the whole of August 2026 (scenario figure). One of the releases made while the fallback route was active, an OVR-C override of EUR 46,900, was drawn into the TST-2026-0318 sample four weeks later and reported as EXC-TST-2026-0318-04: no secondary review record existed, secondaryReviewRequired was false, and the rule evaluation trace showed RD-RULE-0031 firing with reviewWaiverCode = BCP-THROUGHPUT.",
    leadUserId: "P-005",
    isSharedEvent: false,
    lessonsLearned:
      "Recorded lesson at closure: fallback activation increases repair volume materially and RB-PAY-007 should quantify the effect. That lesson was about throughput. Nothing in the record connected the fallback route to the four-eyes gate, because nobody asked what RepairDesk does to secondary review when fallbackRouteMode is ACTIVE. The question was put to Novalink for the first time on 06.10.2026, 41 days after the exception date, and the answer took 23 minutes to obtain once asked. MSN-2026-0203 was raised in September as a low-priority documentation update against the exception and had not been started.",
  },

  /*
   * 04.09.2026. First of the five September activations in bible section 9.1.
   * The per-incident OVR-C counts across the five September records sum to 181
   * of the 198 ARC-DE OVR-C overrides recorded for the month; the remaining 17
   * arose from single-queue substitutions that did not need a full activation.
   */
  {
    id: "INC-2026-0368",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0368",
    title: "NOVA-GATE latency, fallback route active for one hour and ten minutes",
    titleDe: "NOVA-GATE Latenz, Ausweichroute fuer eine Stunde und zehn Minuten aktiv",
    entityIds: [ENTITY_DE, ENTITY_AT],
    serviceIds: ["SVC-0042-01", "SVC-0042-02"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: onDay("2026-09-04", "10:41"),
    occurredAt: onDay("2026-09-04", "10:33"),
    closedAt: onDay("2026-09-09", "16:05"),
    kind: "incident",
    severity: "S3",
    severitySetByUserId: "P-005",
    proposedSeverity: "S3",
    status: "closed",
    regulatoryClassification:
      "Assessed for ARC-DE and ARC-AT against the EU major-incident classification criteria and not classified as a major incident. ARC-CH was not affected. Illustrative regulatory context, not legal advice.",
    notificationRecommended: false,
    notificationRationale:
      "No supervisory notification recommended. Duration, geographical spread and economic impact were all below the thresholds applied in the group incident classification standard, and submission capability was never lost. Illustrative regulatory context, not legal advice.",
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "NOVA-GATE latency at the Munich hub. Fallback route active for 1 hour 10 minutes from 10:48. 27 OVR-C route-substitution overrides were created. Novalink attributed the latency to a capacity event at its Frankfurt hosting provider and closed its own record without a written root cause, which Appendix A5 does not require for a P3 notification.",
    leadUserId: "P-005",
    isSharedEvent: false,
    lessonsLearned:
      "Closed with no action. The record is useful now only as the first data point in a trend that nobody was plotting: five activations followed in the same month, and the pattern was visible in the incident log four weeks before KRI-PAY-007 turned red on the published figures.",
  },

  /*
   * 11.09.2026. The maintenance overrun. Kept because it is the cleanest
   * example of a supplier failure that cannot appear in the supplier's own
   * service report: the contracted availability measure excludes planned
   * maintenance, so a two-hour overrun costs the supplier nothing.
   */
  {
    id: "INC-2026-0374",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0374",
    title: "NOVA-GATE planned maintenance overrun with fallback route activation",
    titleDe: "Ueberschreitung des Wartungsfensters bei NOVA-GATE mit Aktivierung der Ausweichroute",
    entityIds: [ENTITY_DE, ENTITY_AT],
    serviceIds: ["SVC-0042-01", "SVC-0042-02"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: onDay("2026-09-11", "07:04"),
    occurredAt: onDay("2026-09-11", "06:55"),
    closedAt: onDay("2026-09-18", "09:40"),
    kind: "incident",
    severity: "S2",
    severitySetByUserId: "P-005",
    proposedSeverity: "S2",
    status: "closed",
    regulatoryClassification:
      "Assessed for ARC-DE and ARC-AT against the EU major-incident classification criteria and not classified as a major incident, on the basis that submission capability was maintained on the secondary route throughout. ARC-CH was not affected. Illustrative regulatory context, not legal advice.",
    notificationRecommended: false,
    notificationRationale:
      "No supervisory notification recommended. The assessment noted, and the committee was not told, that the duration criterion was satisfied for more than half of the ITOL-0004-01 window. Illustrative regulatory context, not legal advice.",
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "A Novalink planned maintenance window on NOVA-GATE was scheduled to close at 06:00 and did not complete until 09:00. The overrun was not notified. Fallback route active for 2 hours 5 minutes from 06:55, overlapping the morning submission peak, and 41 OVR-C route-substitution overrides were created. ITOL-0004-01 allows 4 hours of disruption to same-day EUR submission; this event consumed just over half of it.",
    leadUserId: "P-005",
    isSharedEvent: false,
    lessonsLearned:
      "Two lessons were recorded and neither was actioned. First, the contracted NOVA-GATE availability measure excludes planned maintenance, so a maintenance overrun does not consume the availability budget even though Arcadia operated on the unvalidated secondary route for two hours and five minutes; the lesson was to negotiate a separate measure for maintenance overruns at the next contract review. Second, CTR-2023-0117-A1 clause 7.2 requires 10 business days notice of a change affecting the availability of a service supporting a critical or important function, and an overrunning window is such a change once it overruns; no notice was given and no notice was demanded. The same clause was reached for again on 06.10.2026 over the unnotified subprocessor firmware update, which is the second time in four weeks that clause 7.2 was the right clause and nobody had used it the first time.",
  },

  /*
   * 18.09.2026. Near miss, and the most instructive record in the history: the
   * degradation was on Arcadia's side of the path and was diagnosed as the
   * supplier's. It is the concrete reason the 14:07 telemetry inference on
   * 06.10.2026 has to state openly that the edge metric cannot locate the
   * fault. Two RD-RULE-0031 firings sit here, both checked and both clean,
   * which is exactly how a control gap stays invisible.
   */
  {
    id: "INC-2026-0379",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0379",
    title: "Near miss: Arcadia network path change misdiagnosed as NOVA-GATE degradation",
    titleDe:
      "Beinahe-Vorfall: Aenderung des Arcadia Netzwerkpfads als NOVA-GATE Stoerung fehlinterpretiert",
    entityIds: [ENTITY_DE, ENTITY_AT],
    serviceIds: ["SVC-0042-01", "SVC-0042-02"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: onDay("2026-09-18", "09:47"),
    occurredAt: onDay("2026-09-18", "09:39"),
    closedAt: onDay("2026-09-23", "14:15"),
    kind: "near-miss",
    severity: "S4",
    severitySetByUserId: "P-005",
    proposedSeverity: "S3",
    status: "closed",
    regulatoryClassification:
      "Recorded as a near miss. No classification against the EU major-incident criteria was required because no service was disrupted beyond the fallback window and no client was affected. Illustrative regulatory context, not legal advice.",
    notificationRecommended: false,
    notificationRationale:
      "No supervisory notification recommended and none considered. The value of the record is internal. Illustrative regulatory context, not legal advice.",
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "A firewall policy change on the Arcadia side of the NOVA-GATE path, applied under CHG-2026-7602, produced a latency and timeout signature indistinguishable at the Arcadia edge from a Novalink service degradation. The Duty Manager activated the fallback route under RB-PAY-007 at 09:52 and reversed it at 10:32 once the path change was identified and rolled back. 19 OVR-C route-substitution overrides were created, of which two were released without secondary review because RD-RULE-0031 fired. Both were re-checked against SYS-0017 Client Static Data Master on 21.09.2026 and were correctly repaired, so no erroneous release occurred and no client was affected.",
    leadUserId: "P-005",
    isSharedEvent: false,
    lessonsLearned:
      "The lesson is the misdiagnosis, not the outage. The Arcadia-side latency metric cannot distinguish a supplier degradation from a path problem, and on this occasion the supplier was blamed for 40 minutes for an Arcadia change. Recorded lesson: add a supplier-side confirmation step to RB-PAY-007 before activation. Not actioned, and on 06.10.2026 the same activation decision had to be taken again without supplier-side confirmation, which is why the 14:07 inference had to carry its own counter-argument. A second observation was written into the record and read by nobody: two overrides released with no reviewer and both were correct, which is the most dangerous possible result, because a control gap that produces no error teaches the organisation that the gap does not matter.",
  },

  /*
   * 25.09.2026. The longest fallback operation before the event, and the only
   * prior occasion on which ARC-CH consumed material euroSIC tolerance. Both
   * measures of ITOL-0004-03 gave the same answer here, which is precisely why
   * the two-measure defect stayed invisible until they diverged on 06.10.2026.
   */
  {
    id: "INC-2026-0388",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0388",
    title: "NOVA-GATE latency with ARC-CH euroSIC queueing, fallback route active three hours",
    titleDe:
      "NOVA-GATE Latenz mit euroSIC Rueckstau bei ARC-CH, Ausweichroute drei Stunden aktiv",
    entityIds: [ENTITY_DE, ENTITY_AT, ENTITY_CH],
    serviceIds: ["SVC-0042-01", "SVC-0042-02", "SVC-0042-05"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: onDay("2026-09-25", "12:26"),
    occurredAt: onDay("2026-09-25", "12:18"),
    closedAt: onDay("2026-10-02", "10:30"),
    kind: "incident",
    severity: "S2",
    severitySetByUserId: "P-005",
    proposedSeverity: "S2",
    status: "closed",
    regulatoryClassification:
      "Two assessments, recorded separately and never merged. ARC-DE and ARC-AT were assessed against the EU major-incident classification criteria and the event was not classified as a major incident. ARC-CH was assessed separately against FINMA operational risk and resilience expectations for reporting incidents of substantial importance and was found not to be of substantial importance. Two entities, two frameworks, two conclusions. Illustrative regulatory context, not legal advice.",
    notificationRecommended: false,
    notificationRationale:
      "No supervisory notification recommended for any entity. The ARC-CH conclusion turned on the fact that submission completed inside the cut-off with 41 minutes of margin and no client-identifying data was exposed; the EU conclusion turned on duration and economic impact. The two rationales are different because the frameworks are different, and the record keeps them apart. Illustrative regulatory context, not legal advice.",
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "NOVA-GATE latency from 12:18 at the Munich hub. Fallback route active for 3 hours 15 minutes, the longest operation on the secondary route before 06.10.2026, and 63 OVR-C route-substitution overrides were created. The Swiss clearing connectivity adapter SVC-0042-05 was separately affected between 13:52 and 15:14; ARC-CH has no fallback route, so euroSIC and SIC submission queued for 1 hour 22 minutes. The primary Swiss path recovered at 15:14 and submission completed at 15:19, 41 minutes inside the 16:00 CET cut-off, with elapsed disruption of 1 hour 27 minutes against the 2-hour maximum in ITOL-0004-03. Both measures of that tolerance gave the same answer, the tolerance was recorded as not breached, and the definition was not examined.",
    leadUserId: "P-005",
    isSharedEvent: false,
    lessonsLearned:
      "ARC-CH depended entirely on the primary route recovering in time and had nothing to compare that dependency with. The record notes that no tested alternative submission route exists for ARC-CH and that KRI-RES-005, important business services with tested fallback arrangements, stood at 78% (scenario figure). Recorded lesson: obtain and test an alternative euroSIC submission route for ARC-CH. Not actioned. Eleven days later the same dependency was tested again by events, and P-015 Sibylle Graf had to decide with 38 minutes of tolerance remaining and a 45-minute manual preparation lead time. The eleven days in between produced no test of the manual route that the decision then depended on.",
  },

  /*
   * 29.09.2026. Fifth September activation. Kept for one reason: it is the
   * record that made P-002 add up the month himself and find a service level
   * miss that the supplier has still not reported.
   */
  {
    id: "INC-2026-0395",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0395",
    title: "NOVA-GATE latency, fifth fallback activation in September 2026",
    titleDe: "NOVA-GATE Latenz, fuenfte Aktivierung der Ausweichroute im September 2026",
    entityIds: [ENTITY_DE, ENTITY_AT],
    serviceIds: ["SVC-0042-01", "SVC-0042-02"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: onDay("2026-09-29", "13:58"),
    occurredAt: onDay("2026-09-29", "13:50"),
    closedAt: onDay("2026-10-05", "15:45"),
    kind: "incident",
    severity: "S3",
    severitySetByUserId: "P-005",
    proposedSeverity: "S3",
    status: "closed",
    regulatoryClassification:
      "Assessed for ARC-DE and ARC-AT against the EU major-incident classification criteria and not classified as a major incident. ARC-CH was not affected. Illustrative regulatory context, not legal advice.",
    notificationRecommended: false,
    notificationRationale:
      "No supervisory notification recommended on the facts of the single event. The assessment expressly did not consider the cumulative effect of five activations in one month, because the group incident classification standard assesses events individually and has no aggregation rule. Illustrative regulatory context, not legal advice.",
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "NOVA-GATE latency at the Munich hub. Fallback route active for 1 hour 30 minutes from 14:05, and 31 OVR-C route-substitution overrides were created. This was the fifth activation in September 2026 and the fourth attributed by Novalink to NOVA-GATE latency.",
    leadUserId: "P-005",
    isSharedEvent: false,
    lessonsLearned:
      "Closed as a supplier performance matter with no action. On 02.10.2026 P-002 Stefan Brunner calculated September 2026 NOVA-GATE availability from Arcadia incident records at 99.62% against a contracted 99.7% excluding planned maintenance (scenario figures), a service level miss that Novalink had not reported by 06.10.2026 and that Arcadia found by arithmetic rather than by notification. Recorded lesson: add a monthly availability reconciliation to the supplier performance review, owned by Group Procurement. Not started. The wider point sits in the incident log rather than in any report: five activations in one month is a supplier trend, and Arcadia's control environment absorbed it as override volume.",
  },

  /*
   * 01.10.2026. Near miss on the independence attribute. This is the live
   * recurrence of EXC-TST-2026-0318-01, five days before the event, and it
   * gives the overdue Massnahme something more persuasive than a date.
   */
  {
    id: "INC-2026-0401",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0401",
    title: "Near miss: self-review of a manual override intercepted before release",
    titleDe: "Beinahe-Vorfall: Selbstpruefung einer manuellen Ueberschreibung vor Freigabe gestoppt",
    entityIds: [ENTITY_DE],
    serviceIds: ["SVC-0042-02"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: onDay("2026-10-01", "11:34"),
    occurredAt: onDay("2026-10-01", "11:29"),
    closedAt: onDay("2026-10-02", "16:20"),
    kind: "near-miss",
    severity: "S4",
    severitySetByUserId: "P-005",
    proposedSeverity: "S4",
    status: "closed",
    regulatoryClassification:
      "Recorded as a near miss with no regulatory classification required, because no payment was released and no service was disrupted. Illustrative regulatory context, not legal advice.",
    notificationRecommended: false,
    notificationRationale:
      "No supervisory notification recommended. The record exists so that the system capability behind it is documented in an incident as well as in a control test. Illustrative regulatory context, not legal advice.",
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "A senior repair analyst at the Munich hub created an OVR-B client-confirmed override of EUR 61,200 and then opened the secondary review screen on the same item. RepairDesk permitted it: the analyst holds both the Repair Analyst and the Secondary Reviewer role assignments and the system does not prevent the creator of an override from reviewing it. The acting Duty Manager saw the item in the release list, stopped it before release, and a second reviewer approved it 12 minutes later. The payment was released correctly on its value date.",
    leadUserId: "P-005",
    isSharedEvent: false,
    lessonsLearned:
      "No payment was released without independent review, which is the only reason this is a near miss rather than an exception. The system capability that made it possible is the same capability behind EXC-TST-2026-0318-01 of 14.07.2026, and the remediation that removes it, MSN-2026-0147, was 62 days past its revised due date of 31.07.2026 on the day of this near miss and stood at 67 days on 06.10.2026. The delivery is not the blocker: NOVA-CR-4412 was delivered by Novalink on 18.09.2026 under EVD-2026-41102 and the Arcadia UAT scheduling request of 22.09.2026, EVD-2026-41205, was still unanswered. An overdue action whose supplier deliverable has already arrived is an Arcadia capacity problem, and it should be reported as one rather than as a supplier dependency.",
  },

  /*
   * 02.10.2026. Swiss lane only. Immaterial as an outage and valuable as a
   * record: it is the only incident in the period that touched the Swiss
   * RepairDesk instance, and it puts the missing disaster recovery evidence for
   * that instance into the incident log rather than leaving it in a
   * questionnaire nobody reads. FINMA outsourcing and resilience context only.
   */
  {
    id: "INC-2026-0407",
    runId: DEFAULT_RUN_ID,
    reference: "INC-2026-0407",
    title: "ARC-CH RepairDesk Swiss instance unavailable for 22 minutes during hosting maintenance",
    titleDe:
      "RepairDesk Instanz Schweiz fuer 22 Minuten nicht verfuegbar waehrend Wartung beim Hosting-Anbieter",
    entityIds: [ENTITY_CH],
    serviceIds: ["SVC-0042-02", "SVC-0042-05"],
    supplierIds: ["TP-0042"],
    processIds: ["PRC-0041"],
    detectedAt: onDay("2026-10-02", "05:41"),
    occurredAt: onDay("2026-10-02", "05:41"),
    closedAt: onDay("2026-10-05", "11:05"),
    kind: "incident",
    severity: "S4",
    severitySetByUserId: "P-015",
    proposedSeverity: "S4",
    status: "closed",
    regulatoryClassification:
      "Assessed for ARC-CH only, against FINMA operational risk and resilience expectations for reporting incidents of substantial importance, and found not to be of substantial importance. No EU assessment was performed because no EU entity was affected, and the Swiss assessment stands on the Swiss framework alone. Illustrative regulatory context, not legal advice.",
    notificationRecommended: false,
    notificationRationale:
      "No supervisory notification recommended. The outage fell wholly outside the ARC-CH submission window, no payment was delayed and no client-identifying data was affected. The assessment was documented rather than assumed, because a short outage in a significant outsourcing is still an outsourcing event. Illustrative regulatory context, not legal advice.",
    grossLossMinor: null,
    lossCurrency: null,
    description:
      "The RepairDesk Swiss instance, hosted by subprocessor TP-0042.1 Helvetia CloudWorks AG in Zurich, was unavailable for 22 minutes from 05:41 during a hosting maintenance window. The window fell outside the ARC-CH submission window and no payment instruction was affected. Novalink notified Arcadia at 06:14, 33 minutes after the start and after restoration, and asserted that there was no impact. On this occasion the assertion was correct.",
    leadUserId: "P-015",
    isSharedEvent: false,
    lessonsLearned:
      "The outage was immaterial; the record is not. Closing it required P-015 Sibylle Graf to state what recovery evidence exists for the Swiss instance, and the answer is none. EVD-2026-40118, the Novalink RepairDesk disaster recovery test report of 22.05.2026, covers the Frankfurt and Amsterdam regions only, and TPRM-Q-2026-R04 has been open on that point since 15.09.2026. ARC-CH therefore carries a significant outsourcing with no tested recovery evidence, which is an outsourcing and resilience question under the Swiss framework, owned by P-015 with P-002 Stefan Brunner. The report has been in the evidence vault since 22.05.2026 and its gap was not escalated for 137 days, which is a different finding from a missing document and should be reported as the different finding that it is. Illustrative regulatory context, not legal advice.",
  },
];

/* ==========================================================================
   Incident chronology

   Fact class mapping, applied without exception. The bible's VF becomes
   "verified-fact", SS becomes "stakeholder-statement", TI becomes "telemetry".
   The mapping is per arrival and it drives how the interface styles the
   statement, so it is never adjusted for convenience.

   Confidence is populated for telemetry entries only. Verified facts carry no
   confidence because a number would only weaken them. Stakeholder statements
   carry none either: attaching a probability to a named person's assertion
   models it as probably true, which is what the display rule for stakeholder
   statements forbids. The statement itself is the fact; its content stays
   attributed and unconverted, and the outcome goes in conflictResolution.

   revealedAtMoment is the arrival time for the shared event, because in the
   bible the arrival time is the moment the information reached Arcadia, and
   the point of the event is that the user sees each fact only when it lands.
   The historical entries are revealed at the first moment of the day: closed
   history is on the desk from 07:45.
   ========================================================================== */

export const incidentEvents: NewIncidentEvent[] = [
  /*
   * 14:05. The supplier notification. Five of six mandatory fields missing and
   * one assertion, no customer impact, that turns out to be wrong. It opens
   * Conflict C and is linked to the telemetry that contradicts it two minutes
   * later.
   */
  {
    id: "ARR-INC-2026-0412-01",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "14:05",
    sortOrder: 1,
    channel: "supplier-notification",
    sourceLabel:
      "Novalink service notification NSN-2026-0887, shared mailbox payments-supplier@arcadia.example, received 14:05:12, also published on the Novalink client status portal",
    sourceUserId: null,
    provenance: "stakeholder-statement",
    statement:
      'Novalink asserts, verbatim: "Degraded performance affecting NOVA-GATE clearing submission in the DACH region. Investigation ongoing. Severity P3. No customer impact identified at this time." The verified element is narrow: the notification exists and was received at 14:05:12. Everything the notification asserts, including the absence of customer impact, is unverified. Five of the six fields required by CTR-2023-0117-A5 clause 5.3 are absent: disruption start time, affected services, affected entities, initial impact assessment and next update time. Appendix A5 requires notification within 30 minutes of supplier detection with all six fields present.',
    conflictsWithId: "ARR-INC-2026-0412-02",
    conflictResolution:
      "Conflict C resolved at 16:19 by accumulated verified facts rather than by any single arrival. There was customer impact: 1,842 ARC-CH instructions queued, two instructions worth CHF 14,200 rolled to the next value date, and one confirmed misrouted payment of EUR 38,400. The supplier's first notification was wrong on the point that mattered most. This is a notification quality finding under CTR-2023-0117-A5 and is recorded as one. It is not a finding about the supplier's honesty, because at 14:05 Novalink's own monitoring was pinned to the failed region and it could not see the impact it was denying.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41871"],
    revealedAtMoment: "14:05",
  },

  /*
   * 14:07. Telemetry. The measurement is solid and the conclusion is not, and
   * the reason it might be wrong is not hypothetical: Arcadia made exactly
   * that mistake on 18.09.2026 under INC-2026-0379.
   */
  {
    id: "ARR-INC-2026-0412-02",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "14:07",
    sortOrder: 2,
    channel: "alert",
    sourceLabel: "SYS-0011 Arcadia Payment Hub monitoring, alert ALRT-2026-77412",
    sourceUserId: null,
    provenance: "telemetry",
    statement:
      "Measurement: NOVA-GATE submission acknowledgement latency rose from a seven-day median of 1.4 seconds to 42 seconds beginning at 13:38. Acknowledgement timeouts began at 13:51. 2,317 instructions are in SUBMITTED state awaiting acknowledgement. Inference: the degradation began approximately 27 minutes before the supplier notification, and the supplier's statement that no customer impact was identified is inconsistent with Arcadia-side measurement. Why the inference could be wrong: the latency metric is measured at the Arcadia edge. An Arcadia network path problem, a firewall change or a DNS issue would produce the same signature. Arcadia cannot distinguish supplier-side from path-side degradation from this metric alone, and on 18.09.2026 under INC-2026-0379 it read the same signature as a supplier failure when the cause was an Arcadia firewall policy change.",
    conflictsWithId: "ARR-INC-2026-0412-01",
    conflictResolution:
      "Conflict C resolved at 16:19. The Arcadia-side measurement was right that there was impact and could not, at 14:07, prove where the fault sat. The location was established at 15:51 by ARR-INC-2026-0412-14 from the subprocessor incident summary, not by this alert. The honest reading is that the telemetry was directionally correct and the inference it carried was not yet earned.",
    confidence: 0.55,
    evidenceDocumentIds: ["EVD-2026-41872"],
    revealedAtMoment: "14:07",
  },

  /*
   * 14:12. A correct decision with an undocumented second effect. The middle of
   * this statement is the whole scenario: activating the fallback route
   * satisfied the second condition of RD-RULE-0031 and switched off four-eyes
   * for the population the route itself creates.
   */
  {
    id: "ARR-INC-2026-0412-03",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "14:12",
    sortOrder: 3,
    channel: "system",
    sourceLabel: "SYS-0014 configuration audit log and Arcadia change record CHG-2026-7741",
    sourceUserId: "P-009",
    provenance: "verified-fact",
    statement:
      "P-009 Elif Demir, acting Duty Manager, invoked runbook RB-PAY-007 and set fallbackRouteMode = ACTIVE at 14:12:41 for Q-REPAIR-DE and Q-REPAIR-AT. Clearing submission switched from SYS-0012 NOVA-GATE to SYS-0013 Arcadia Direct Link. The decision was correct under the runbook and was taken within the Duty Manager's authority. Documented consequence: SYS-0013 performs no payment data validation, so instructions that NOVA-GATE would have enriched or corrected now fail with R01, R02, R04 or R08, enter the repair queue, and require OVR-C route-substitution overrides. Consequence documented nowhere: setting fallbackRouteMode = ACTIVE satisfies the second condition of RD-RULE-0031, so from 14:12:41 every OVR-C override below EUR 250,000 is released without secondary review, by design and silently. RB-PAY-007 section 4 states that the control environment is unchanged during fallback operation, which is factually wrong and is therefore a documented control assertion rather than an omission. ARC-CH: no fallback was activated for Q-REPAIR-CH because ARC-CH has no direct SIC participant link, so ARC-CH instructions simply queued.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41874", "EVD-2026-41875"],
    revealedAtMoment: "14:12",
  },

  /*
   * 14:26. Queue telemetry. The counter-argument is testable and untested: a
   * large bulk file at 14:10 would look the same, and nobody has opened the
   * file submission log.
   */
  {
    id: "ARR-INC-2026-0412-04",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "14:26",
    sortOrder: 4,
    channel: "telemetry",
    sourceLabel: "SYS-0014 RepairDesk queue telemetry, Q-REPAIR-DE and Q-REPAIR-AT",
    sourceUserId: null,
    provenance: "telemetry",
    statement:
      "Measurement, verified: Q-REPAIR-DE depth rose from 61 items at 14:12 to 494 items at 14:26. 138 OVR-C overrides were created between 14:12:41 and 14:26:00, against a normal full-day ARC-DE figure of approximately 33 overrides of all types (scenario figure). Q-REPAIR-AT depth rose from 14 to 97. Inference: the rise is caused by fallback activation removing NOVA-GATE enrichment, not by a change in client behaviour and not by a data quality event at a client. Why the inference could be wrong: a large corporate bulk file submitted at 14:10 would produce a similar queue spike, and the inference has not been tested against the file submission log. Testing it takes one query and has not been done.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: 0.7,
    evidenceDocumentIds: ["EVD-2026-41876"],
    revealedAtMoment: "14:26",
  },

  /*
   * 14:34. The spine of the event, and a telemetry inference at the moment it
   * arrives. It becomes a verified fact at 15:38 on the tenant configuration
   * export. The classification history is kept in conflictResolution rather
   * than overwritten, because "we saw it at 14:34" and "we could prove it at
   * 15:38" are different statements and a committee is entitled to both.
   */
  {
    id: "ARR-INC-2026-0412-05",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "14:34",
    sortOrder: 5,
    channel: "system",
    sourceLabel: "SYS-0014 override audit log, query QRY-2026-88104",
    sourceUserId: null,
    provenance: "telemetry",
    statement:
      "Measurement, verified: of the 138 OVR-C overrides created between 14:12:41 and 14:26:00, 96 have secondaryReviewRequired = false and secondaryReviewerId = null. Combined value EUR 9,420,880, every individual value below EUR 250,000. Split: ARC-DE 78 overrides at EUR 7,611,240; ARC-AT 18 overrides at EUR 1,809,640. The remaining 42 overrides have secondaryReviewRequired = true, of which 29 were reviewed and released and 13 remain in AWAITING_SECONDARY_REVIEW. Inference: 96 payments were released without the independent secondary review required by CTL-PAY-014, which is a candidate breach of the zero-tolerance ITOL-0004-04. Why the inference could be wrong at 14:34: the absence of a reviewer identity at query time is not proof that no review occurred. If RepairDesk populates reviewer identity asynchronously, or if a bulk approval writes the identity at the end of a cycle, the field would be empty now and populated later. Arcadia does not know how RepairDesk writes this field, which is itself a finding about a key control in the Internal Control System.",
    conflictsWithId: null,
    conflictResolution:
      "Reclassified from telemetry inference to verified fact at 15:38 on the tenant configuration export EVD-2026-41905, which confirms that reviewer identity is written synchronously at review submission and that there is no backfill. The entry was an inference until 15:38 and a verified fact after it, and both states are part of the record. 96 payments were released without secondary review.",
    confidence: 0.6,
    evidenceDocumentIds: ["EVD-2026-41878"],
    revealedAtMoment: "14:34",
  },

  /*
   * 14:41. Conflict A, statement 1. Two separable claims in one paragraph: a
   * mechanism claim that is false and a behaviour claim that is true.
   * Reporting only the false half would misrepresent the control owner, which
   * is how second line loses first line for a year.
   */
  {
    id: "ARR-INC-2026-0412-06",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "14:41",
    sortOrder: 6,
    channel: "call",
    sourceLabel:
      "P-008 Beatrix Hofmann, Payment Repair Team Lead and control owner for CTL-PAY-014, on the incident bridge, recorded",
    sourceUserId: "P-008",
    provenance: "stakeholder-statement",
    statement:
      'Verbatim: "Every override goes through four-eyes. The log is lagging. RepairDesk backfills reviewer identities at the end of the batch cycle. There is no bypass. My team does not release payments without review." The statement contains two separable claims: a mechanism claim about how RepairDesk writes reviewer identity, and a behaviour claim about what her team does. They must be held apart, because they resolve differently and because the speaker is the person with the most operational knowledge of the process and the least visibility of the system internals.',
    conflictsWithId: "ARR-INC-2026-0412-07",
    conflictResolution:
      "Conflict A resolved at 15:38 by the tenant configuration export EVD-2026-41905. The mechanism claim is false: there is no backfill and reviewer identity is written synchronously at review submission. The behaviour claim is true: no member of her team bypassed anything, because RD-RULE-0031 waived the requirement before any human saw the item. Both halves belong in the resolution. The control owner was wrong about the system she relies on and right about the people she manages.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41935"],
    revealedAtMoment: "14:41",
  },

  /*
   * 14:48. Conflict A, statement 2, and the opening of Conflict A2. The first
   * three sentences come from the party with authoritative knowledge. The
   * fourth is an accountability assertion by a party with a commercial
   * interest in where accountability lands, flagged as such without any
   * implication that it is untrue.
   */
  {
    id: "ARR-INC-2026-0412-07",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "14:48",
    sortOrder: 7,
    channel: "call",
    sourceLabel:
      "P-011 Miriam Falk, Client Service Director at Novalink Payment Services GmbH, on the incident bridge, recorded",
    sourceUserId: "P-011",
    provenance: "stakeholder-statement",
    statement:
      'Verbatim: "RepairDesk does not backfill reviewer identities. The field is written at the moment of review submission. If the field is empty, no review was submitted. I would add that the four-eyes requirement for route-substitution overrides is configured in the client tenant, not by Novalink." The first three sentences are a mechanism statement by the party with authoritative knowledge of the mechanism, and they directly contradict ARR-INC-2026-0412-06. The fourth sentence is a different kind of statement: an accountability assertion, unverified when it was made, by a party with a commercial interest in the answer. It is recorded as a statement made with an interest, which is not the same as a statement that is false.',
    conflictsWithId: "ARR-INC-2026-0412-06",
    conflictResolution:
      "Conflict A resolved at 15:38: correct on the mechanism. Conflict A2, the accountability assertion, is only partly resolved and remains contractually open beyond 06.10.2026. The configuration does sit in Arcadia's tenant, and it was placed there by Novalink standard configuration template BCP-THROUGHPUT-v2 during RepairDesk release 8.3, which Arcadia approved under CHG-2024-5512 on release notes that did not disclose that a client control gate would be waived. Accountability is shared three ways: Novalink for non-disclosure, Arcadia for approving a release without reviewing its control effects, and Arcadia again for not updating the CTL-PAY-014 description in the two months that followed. The commercial and contractual question is not settled on the day and the product does not pretend otherwise.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41935"],
    revealedAtMoment: "14:48",
  },

  /*
   * 14:55. Conflict B, statement 1, carrying a disclosure worth more than the
   * root cause: the supplier names a hosting region that the binding
   * subprocessor appendix does not list. The third-party finding arrives
   * inside an incident call, which is exactly how these things surface.
   */
  {
    id: "ARR-INC-2026-0412-08",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "14:55",
    sortOrder: 8,
    channel: "call",
    sourceLabel:
      "P-012 Ralf Ostermann, Head of Service Continuity at Novalink Payment Services GmbH, on the incident bridge, recorded",
    sourceUserId: "P-012",
    provenance: "stakeholder-statement",
    statement:
      'Verbatim: "Root cause is a failed database failover at our Frankfurt hosting provider. The Amsterdam region is unaffected and traffic has moved there. Recovery expected by 16:00." Secondary finding, immediate and independent of whether the root cause is correct: the statement names an Amsterdam region operated by a subprocessor. CTR-2023-0117-A3 version 4.2, the binding appendix, lists TP-0042.2 Rheinstack GmbH with the Frankfurt region only. The supplier has disclosed the appendix divergence while explaining the incident. P-002 Stefan Brunner notes it at 14:57 and raises it formally at 15:23 under MSN-2026-0191.',
    conflictsWithId: "ARR-INC-2026-0412-09",
    conflictResolution:
      "Conflict B resolved at 15:51 by the Rheinstack incident summary EVD-2026-41911. This statement was materially correct and incomplete. There was a failed failover at a hosting subprocessor and Amsterdam did take the traffic. He did not mention the monitoring and alerting pipeline, most probably because his own monitoring was the thing that was broken.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41935"],
    revealedAtMoment: "14:55",
  },

  /*
   * 15:02. Conflict B, statement 2. A written update that retreats from a
   * verbal root cause seven minutes old. Both statements can be honest, and
   * the product has to hold that open instead of picking a winner at 15:02.
   */
  {
    id: "ARR-INC-2026-0412-09",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "15:02",
    sortOrder: 9,
    channel: "supplier-notification",
    sourceLabel: "Novalink client status portal, update NSN-2026-0887-U1",
    sourceUserId: null,
    provenance: "stakeholder-statement",
    statement:
      'Verbatim: "Severity raised to P2. Cause under investigation. Monitoring and alerting pipeline also degraded. Next update by 16:00." Two observations. A named root cause was given verbally at 14:55 and the written update seven minutes later says the cause is under investigation. The written update also discloses a second affected component, the monitoring and alerting pipeline, which P-012 did not mention; that pipeline is operated by subprocessor TP-0042.3 Polaris Telemetrix in Brno. This is not necessarily a contradiction: a supplier communications policy commonly withholds an unconfirmed root cause while an engineer on a call will name the most likely one. The product presents the possibility that both statements are honest alongside the possibility that they are not, and does not resolve it at 15:02.',
    conflictsWithId: "ARR-INC-2026-0412-08",
    conflictResolution:
      "Conflict B resolved at 15:51. The written statement that the cause was under investigation was a communications policy default, not a contradiction. Both statements were honest and both were incomplete. The substantive finding is neither statement's content: Novalink's incident detection depends on a subprocessor whose monitoring was pinned to the failed region, which produced a 34-minute detection and notification lag and is the direct explanation of why CTR-2023-0117-A5 clause 5.3 could not be met.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41915"],
    revealedAtMoment: "15:02",
  },

  /*
   * 15:09. The only genuine deadline in the day. Two numbers decide it: 38
   * minutes of tolerance left and a 45-minute manual preparation lead time.
   * Note what is not here: no fallback route, because ARC-CH never had one.
   */
  {
    id: "ARR-INC-2026-0412-10",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "15:09",
    sortOrder: 10,
    channel: "call",
    sourceLabel:
      "P-015 Sibylle Graf, Resilience Officer, Arcadia Bank Schweiz AG, on the incident bridge with the ARC-CH payment queue export from SYS-0015",
    sourceUserId: "P-015",
    provenance: "verified-fact",
    statement:
      "euroSIC and SIC submission through SVC-0042-05 has been queued since 13:47. 1,842 instructions, CHF 61,304,110 in total, of which CHF 18,712,400 carry same-day value against a 16:00 CET cut-off (scenario figure). No fallback route exists for ARC-CH, which has no direct SIC participant link. The only option is manual submission through the correspondent bank under RB-PAY-011, which has a 45-minute preparation lead time. Tolerance position at 15:09: ITOL-0004-03 sets a 2-hour maximum tolerable disruption. Elapsed time from 13:47 is 1 hour 22 minutes, which leaves 38 minutes. The 16:00 cut-off is 51 minutes away and the manual route needs 45 of them. Whoever decides, decides now.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41882"],
    revealedAtMoment: "15:09",
  },

  /*
   * 15:14. Severity upgrade and, more importantly, two classification
   * assessments started in parallel and kept apart: the EU criteria for
   * ARC-DE and ARC-AT, the FINMA expectations for ARC-CH. Two entities, two
   * frameworks, two records, two conclusions. They are never merged, and the
   * product must not offer a single group answer.
   */
  {
    id: "ARR-INC-2026-0412-11",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "15:14",
    sortOrder: 11,
    channel: "system",
    sourceLabel: "P-005 Nadia Lehmann, incident manager, incident record INC-2026-0412",
    sourceUserId: "P-005",
    provenance: "verified-fact",
    statement:
      "Severity upgraded from S2 to S1 on two grounds: an impact tolerance for an important business service is within 40 minutes of its limit, and a zero-tolerance control condition, ITOL-0004-04, has 96 candidate breaches. S1 notification runs to P-013 Claudia Renner and P-014 Dr. Heinrich Adler and triggers the per-entity incident classification assessments, started at 15:20. For ARC-DE and ARC-AT the assessment runs against the EU major-incident classification criteria, covering clients affected, reputational impact, duration and service downtime, geographical spread, data losses, criticality of services affected and economic impact; the provisional conclusion at 15:47 is that the event is significant but does not meet the major-incident threshold on the facts available, to be re-run when the Novalink report arrives, recorded as DEC-2026-0774. For ARC-CH a separate assessment runs against FINMA operational risk and resilience reporting expectations for incidents of substantial importance; the provisional conclusion at 15:52 is that no report is required on the facts available, documented and to be re-run, recorded as DEC-2026-0775. The two assessments are never merged into one: two entities, two frameworks, two records, two conclusions. Both conclusions are explicitly provisional and neither asserts compliance with anything. Illustrative regulatory context, not legal advice.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41315", "EVD-2026-41500"],
    revealedAtMoment: "15:14",
  },

  /*
   * 15:38. The arrival that resolves Conflict A, reclassifies the 14:34
   * inference, and turns a supplier incident into a question about Arcadia's
   * own follow-up discipline. The last paragraph is the uncomfortable one: the
   * root cause was found on 27.08.2026, reported on 25.09.2026, classified as
   * system configuration and closed with an action nobody started.
   */
  {
    id: "ARR-INC-2026-0412-12",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "15:38",
    sortOrder: 12,
    channel: "mail",
    sourceLabel:
      "Novalink engineering, RepairDesk tenant configuration export and rule definition, provided at P-002's formal request under CTR-2023-0117-A4 clause 2.1",
    sourceUserId: null,
    provenance: "verified-fact",
    statement:
      'The export confirms that rule RD-RULE-0031 exists in tenant arcadia-prod with the condition recorded in the process documentation. Verified from the same export and from CHG-2024-5512: the rule entered the tenant with RepairDesk release 8.3 on 11.11.2024, applied from Novalink standard configuration template BCP-THROUGHPUT-v2; Arcadia approved release 8.3 under CHG-2024-5512 on the basis of release notes referring to "continuity throughput improvements for fallback routing", with no control waiver named and no Arcadia control owner review; the rule is client configurable and an Arcadia tenant administrator can edit or remove it; the rule has fired 118 times since 11.11.2024, of which 96 on 06.10.2026, and it fires only when fallbackRouteMode = ACTIVE, which had occurred on 7 prior occasions; reviewer identity is written synchronously at review submission and there is no backfill. Consequence for TST-2026-0318: EXC-TST-2026-0318-04 is this same rule. It was found on 27.08.2026, reported on 25.09.2026, classified in the test report as system configuration, and closed with a documentation action, MSN-2026-0203, which had not been started. The root cause was visible 41 days before the event, and the gap between the CTL-PAY-014 control statement, which says the review applies to all overrides without exception, and the rule, which creates an exception, has stood unaltered since 14.01.2025.',
    conflictsWithId: null,
    conflictResolution:
      "Resolves Conflict A and partly resolves Conflict A2. P-011 was correct on the mechanism. P-008 was correct on her team's behaviour. The rule waived the control before any human saw the item, so the 96 releases were not circumventions. Accountability is shared: Novalink for non-disclosure in the release notes, Arcadia for approving a release without reviewing its control effects, and Arcadia again for not updating the control description. The contractual question raised by Conflict A2 is not settled on 06.10.2026 and is routed to P-010 and P-016 rather than answered.",
    confidence: null,
    evidenceDocumentIds: [
      "EVD-2026-41905",
      "EVD-2026-41906",
      "EVD-2026-41907",
      "EVD-2026-41908",
    ],
    revealedAtMoment: "15:38",
  },

  /*
   * 15:47. The decision that could not wait. Taken at 15:07 with 38 minutes of
   * tolerance and a 45-minute lead time, which means it was taken 44 minutes
   * before the cause was known and without any way to test the supplier's
   * 16:00 recovery estimate. Irreversible once transmitted.
   */
  {
    id: "ARR-INC-2026-0412-13",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "15:47",
    sortOrder: 13,
    channel: "system",
    sourceLabel: "SYS-0015 and ARC-CH Treasury, reported by P-015 Sibylle Graf",
    sourceUserId: "P-015",
    provenance: "verified-fact",
    statement:
      "P-015 Sibylle Graf, with the ARC-CH Treasury desk and the authority of the ARC-CH Chief Operating Officer, invoked RB-PAY-011 at 15:07, recorded as DEC-2026-0776. Manual submission of the CHF 18,712,400 same-day tranche through correspondent Helvetia Clearing Partner AG has been prepared and transmitted. Preparation took 45 minutes, exactly as the runbook states. Sequencing note, which is the part worth reading: the decision at 15:07 was taken with 38 minutes of tolerance remaining against a 45-minute lead time, so it had to be taken before the cause was known and before Novalink's 16:00 recovery estimate could be tested. It is also not reversible. Once the instructions are with the correspondent they cannot be unwound, which means the decision had to be right on incomplete facts rather than merely defensible.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41918", "EVD-2026-41710"],
    revealedAtMoment: "15:47",
  },

  /*
   * 15:51. Resolves Conflict B, and the resolution is not the root cause. The
   * finding is that the supplier's incident detection runs through a
   * subprocessor whose monitoring was pinned to the region that failed, which
   * is why a 13:31 quorum loss reached Arcadia at 14:05.
   */
  {
    id: "ARR-INC-2026-0412-14",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "15:51",
    sortOrder: 14,
    channel: "mail",
    sourceLabel: "TP-0042.2 Rheinstack GmbH incident summary, forwarded by Novalink",
    sourceUserId: null,
    provenance: "verified-fact",
    statement:
      "The primary database cluster in the Frankfurt region lost quorum at 13:31 following a storage firmware update applied in a maintenance window that Novalink had not notified to Arcadia. Automatic failover to the Amsterdam region completed successfully at 13:44 for NOVA-GATE write traffic. The monitoring and alerting pipeline operated by TP-0042.3 Polaris Telemetrix remained pinned to the Frankfurt database endpoint until 14:57, because its connection string was statically configured rather than using the failover alias. Substantive finding: Novalink's incident detection depends on a subprocessor whose monitoring was pinned to the failed region, producing a 34-minute lag between quorum loss at 13:31 and notification at 14:05. That is a resilience finding against TP-0042, a concentration finding about TP-0042.3, and the direct explanation of why CTR-2023-0117-A5 clause 5.3 could not be met. Secondary finding: the 13:31 storage firmware update was a change at a subprocessor, applied during an Arcadia business day and unnotified, against CTR-2023-0117-A1 clause 7.2, which requires 10 business days notice of a change affecting the availability of a service supporting a critical or important function.",
    conflictsWithId: null,
    conflictResolution:
      "Resolves Conflict B. Both supplier statements were honest and both were incomplete. The finding is the detection dependency rather than either account of the cause, and it raises MSN-2026-0217 on the unnotified change and MSN-2026-0218 on whether Novalink's detection has a single point of failure.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41911"],
    revealedAtMoment: "15:51",
  },

  /*
   * 16:04. Conflict D. Two measures of one tolerance give opposite answers and
   * the tolerance states no precedence, so ARC-CH cannot say whether it
   * breached its own tolerance. conflictResolution is deliberately empty: the
   * question needs a committee decision on definition precedence and inventing
   * an answer here would destroy the most valuable finding of the day. The
   * link is to the 15:09 arrival, where the tolerance position was first
   * recorded while both measures still agreed.
   */
  {
    id: "ARR-INC-2026-0412-15",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "16:04",
    sortOrder: 15,
    channel: "mail",
    sourceLabel:
      "Correspondent confirmation CONF-2026-9931 from Helvetia Clearing Partner AG, reconciled against SYS-0015",
    sourceUserId: null,
    provenance: "verified-fact",
    statement:
      "1,840 of 1,842 instructions accepted, CHF 61,289,910. Submitted 15:52, accepted 15:58, two minutes before the 16:00 cut-off. Two instructions totalling CHF 14,200 were rejected on format grounds and rolled to value date 07.10.2026. The tolerance question, stated precisely: ITOL-0004-03 has two measures and they give different answers. Measure 1, submission completion against the cut-off: completed at 15:58, two minutes inside the 16:00 cut-off, not breached. Measure 2, elapsed disruption: queueing began at 13:47 and submission completed at 15:58, elapsed 2 hours 11 minutes against a 2-hour maximum, breached by 11 minutes. ARC-CH therefore cannot state whether its impact tolerance was breached, because the tolerance is defined with two measures and no stated precedence. This is a definitional defect in the tolerance itself, not an operational failure, and it is not resolved today. Owner: P-005 Nadia Lehmann. Destination: AG-CMT-NFR-2026-10-08, with MSN-2026-0219 raised to resolve the ambiguity and to review every IBS-0004 tolerance for the same defect. Separately, two payments worth CHF 14,200 were delayed, which is 0.023% of daily ARC-CH corporate payment value (scenario figure) and well inside ITOL-0004-02.",
    conflictsWithId: "ARR-INC-2026-0412-10",
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41918"],
    revealedAtMoment: "16:04",
  },

  /*
   * 16:12. Restoration, and a calendar problem. The supplier's report is due on
   * the morning of the committee and the papers are due five days earlier, so
   * the paper has to be written so that the report cannot invalidate it.
   */
  {
    id: "ARR-INC-2026-0412-16",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "16:12",
    sortOrder: 16,
    channel: "supplier-notification",
    sourceLabel: "Novalink client status portal, update NSN-2026-0887-U2",
    sourceUserId: null,
    provenance: "verified-fact",
    statement:
      "NOVA-GATE latency returned to normal at 15:41, full service was confirmed at 16:08, and the monitoring and alerting pipeline was restored at 14:57. Novalink commits to a written incident report within five business days, by 13.10.2026. Timing consequence: CMT-NFR-2026-10 papers are due 08.10.2026 at 12:00 and the supplier's root-cause report is due on the morning of the meeting. P-001 Dr. Katharina Vogt must write a decision paper on 07.10.2026 or 08.10.2026 that states plainly which facts are verified, which are supplier statements and which are inferences, says what the committee is asked to decide without the supplier's account, and is structured so that the arrival of the report on 13.10.2026 cannot invalidate the decision requested. Recorded as DEC-2026-0781, with agenda item AG-CMT-NFR-2026-10-10 added at 16:20.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41921"],
    revealedAtMoment: "16:12",
  },

  /*
   * 16:19. The bible classes this arrival as a telemetry inference with an
   * embedded verified fact, and the mapping rule sends it to "telemetry". The
   * embedded fact is not soft: one confirmed misrouted payment. What is soft
   * is the extrapolation from an unstratified 21% sample, and the confidence
   * on this row belongs to the extrapolation and not to the confirmed error.
   * This is the arrival that turns a documentation argument into a realised
   * risk, which is why the RCSA residual rating can no longer be defended on
   * the basis that no loss occurred.
   */
  {
    id: "ARR-INC-2026-0412-17",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "16:19",
    sortOrder: 17,
    channel: "system",
    sourceLabel:
      "Post-event validation by the ARC-DE Payment Repair team under P-008's direction at P-004's request, re-checked against SYS-0017 Client Static Data Master",
    sourceUserId: "P-008",
    provenance: "telemetry",
    statement:
      "A 20-case sample of the 96 unreviewed overrides was re-checked against SYS-0017 Client Static Data Master and the original client instructions. Verified fact: 19 of 20 were correctly repaired and 1 of 20 was not. Instruction PAY-DE-20261006-448127, value EUR 38,400, was released with an incorrect beneficiary intermediary BIC; the clearing system accepted it and routed it to the wrong intermediary institution. The payment is recallable and a recall was initiated at 16:24. The client is identified in the product only as CLI-DE-00412. Inference: a 1-in-20 observed error rate applied to 96 cases suggests approximately 5 affected cases in total, with a wide interval on a sample of 20. Why the inference could be wrong: 20 of 96 is a 21% sample (scenario figure), it was not stratified by value or by failure reason code, and the single error was on an R01 IBAN and BIC failure, which is the most error-prone repair type and represents 31% of repair items (scenario figure). A stratified sample would very likely give a different rate. The honest statement is one confirmed error, an unknown number of further errors, and a full check of all 96 cases required. Consequence: this is no longer a control documentation matter. There is at least one confirmed erroneous payment release, which is the realisation of RSK-0211, and the 1LoD residual rating of Medium is no longer arguable on the basis that no loss occurred. DEC-2026-0778 commits to checking all 96 cases rather than a sample, and MSN-2026-0214 carries it with a 07.10.2026 12:00 deadline.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: 0.35,
    evidenceDocumentIds: ["EVD-2026-41924", "EVD-2026-41930"],
    revealedAtMoment: "16:19",
  },

  /*
   * 16:27. Both lines put their revised positions in writing. The divergence
   * does not disappear, it becomes precise: design deficiency on the rule,
   * operating deficiency on the three human deviations. That is the correct
   * shape of an outcome and the product must not render it as one side losing.
   */
  {
    id: "ARR-INC-2026-0412-18",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    atMoment: "16:27",
    sortOrder: 18,
    channel: "mail",
    sourceLabel:
      "Written position statements from P-008 Beatrix Hofmann and P-004 Jakob Steinbacher, jointly recorded in DEC-2026-0783",
    sourceUserId: null,
    provenance: "stakeholder-statement",
    statement:
      "P-008 Beatrix Hofmann, revised position: accepts EVD-2026-41905, withdraws the backfill claim made at 14:41, and accepts that 96 payments were released without secondary review. She maintains that the control operated as the system was configured to operate, that her team followed the process correctly, and that the deficiency is therefore a design deficiency owned jointly with Novalink rather than an operating deficiency of her team. P-004 Jakob Steinbacher, revised position: accepts the design deficiency characterisation for EXC-TST-2026-0318-04 and for the 96 event cases, and maintains operating deficiency for EXC-TST-2026-0318-01 on self-review, EXC-TST-2026-0318-02 on review after release and EXC-TST-2026-0318-03 on missing evidence, which are independent of RD-RULE-0031 and are human execution failures. The divergence does not disappear. It becomes precise and documentable, which is the point.",
    conflictsWithId: null,
    conflictResolution:
      "Joint conclusion recorded at 16:41 in DEC-2026-0783: CTL-PAY-014 Control Effectiveness / Kontrollwirksamkeit is Partially Effective, with a design deficiency in RD-RULE-0031 whose accountability is shared with TP-0042, and an operating deficiency covering three human deviations in the test sample. Both lines sign. The RSK-0211 residual rating moves to Medium-High by agreement rather than by escalation, superseding DEC-2026-0772. P-008 was right about her team and wrong about the system; P-004 reached the right conclusion and had missed the root cause of EXC-TST-2026-0318-04 four weeks earlier. Neither line lost, and the terminology mismatch between the 1LoD scale label Fully Effective / Voll wirksam and the 2LoD scale label Effective / Wirksam is recorded as still unaligned.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41935"],
    revealedAtMoment: "16:27",
  },

  /* ------------------------------------------------------------------------
     Historical chronology. Revealed at 07:45, because a closed record is
     available from the start of the working day. These entries exist so that
     the Incident and Resilience role can open the 14:05 event and find that
     the same route, the same rule and the same Swiss dependency are already in
     the log with dates on them.
     ------------------------------------------------------------------------ */

  {
    id: "ARR-INC-2026-0361-01",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0361",
    atMoment: "15:22",
    sortOrder: 1,
    channel: "system",
    sourceLabel: "SYS-0014 configuration audit log extract, 27.08.2026",
    sourceUserId: null,
    provenance: "verified-fact",
    statement:
      "fallbackRouteMode set to ACTIVE for Q-REPAIR-DE and Q-REPAIR-AT at 15:22 under RB-PAY-007 following NOVA-GATE latency, and returned to INACTIVE at 17:05. Clearing submission ran on SYS-0013 Arcadia Direct Link for the duration.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41852"],
    revealedAtMoment: MOMENTS.M01,
  },

  /*
   * The entry that should have ended the story six weeks early. It records
   * what happened, in the right numbers, and draws no conclusion, because
   * nobody asked the one question that would have produced one.
   */
  {
    id: "ARR-INC-2026-0361-02",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0361",
    atMoment: "17:20",
    sortOrder: 2,
    channel: "system",
    sourceLabel: "SYS-0014 queue and override extract, 27.08.2026, attached to the incident record",
    sourceUserId: "P-007",
    provenance: "verified-fact",
    statement:
      "24 OVR-C route-substitution overrides were created while the fallback route was active, against an ARC-DE total of 31 OVR-C overrides for the whole of August 2026 (scenario figure). The extract shows the override records with their reason codes and values. It does not show, and nobody queried, how many of them carried secondaryReviewRequired = false. One of these releases, EUR 46,900, was selected into the TST-2026-0318 sample on 07.09.2026 and reported on 25.09.2026 as EXC-TST-2026-0318-04.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41906"],
    revealedAtMoment: MOMENTS.M01,
  },

  /*
   * The 18.09.2026 misdiagnosis, kept as a pair: a telemetry inference that
   * named the supplier, and the verified fact 36 minutes later that named
   * Arcadia. This is the only conflict in the history that resolved against
   * the person who raised it, and it is the precedent the 14:07 inference on
   * 06.10.2026 has to carry.
   */
  {
    id: "ARR-INC-2026-0379-01",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0379",
    atMoment: "09:52",
    sortOrder: 1,
    channel: "alert",
    sourceLabel: "SYS-0011 Arcadia Payment Hub monitoring, 18.09.2026",
    sourceUserId: null,
    provenance: "telemetry",
    statement:
      "Measurement: NOVA-GATE acknowledgement latency above threshold with timeouts from 09:39. Inference: NOVA-GATE degradation at the supplier, consistent with the pattern of 04.09.2026 and 11.09.2026. Why the inference could be wrong: the metric is measured at the Arcadia edge and cannot locate the fault. It was wrong.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: 0.5,
    evidenceDocumentIds: ["EVD-2026-41810"],
    revealedAtMoment: MOMENTS.M01,
  },

  {
    id: "ARR-INC-2026-0379-02",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0379",
    atMoment: "10:28",
    sortOrder: 2,
    channel: "system",
    sourceLabel: "ARC-DE Technology, change record CHG-2026-7602 rollback confirmation",
    sourceUserId: null,
    provenance: "verified-fact",
    statement:
      "A firewall policy change applied under CHG-2026-7602 at 09:31 was identified as the cause of the latency and was rolled back at 10:28. NOVA-GATE was operating normally throughout. The fallback route was deactivated at 10:32. Two of the 19 OVR-C overrides created in the interval had been released without secondary review because RD-RULE-0031 fired; both were re-checked against SYS-0017 on 21.09.2026 and were correctly repaired.",
    conflictsWithId: "ARR-INC-2026-0379-01",
    conflictResolution:
      "Resolved on the day. The 09:52 inference named the supplier and was wrong; the measurement behind it was correct. The record was closed with a lesson about adding supplier-side confirmation to RB-PAY-007 before activation, and the lesson was not actioned before 06.10.2026.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41104"],
    revealedAtMoment: MOMENTS.M01,
  },

  /*
   * 25.09.2026. Both measures of ITOL-0004-03 agreed, so the tolerance was
   * recorded as not breached and the definition was never examined. This entry
   * is why Conflict D is a definitional defect discovered on 06.10.2026 rather
   * than a defect that had been sitting in an open finding for months.
   */
  {
    id: "ARR-INC-2026-0388-01",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0388",
    atMoment: "15:19",
    sortOrder: 1,
    channel: "system",
    sourceLabel: "SYS-0015 ARC-CH submission confirmation, 25.09.2026, reported by P-015",
    sourceUserId: "P-015",
    provenance: "verified-fact",
    statement:
      "euroSIC and SIC submission completed at 15:19 after queueing from 13:52, with 41 minutes of margin against the 16:00 CET cut-off and elapsed disruption of 1 hour 27 minutes against the 2-hour maximum in ITOL-0004-03. Both measures of the tolerance gave the same answer, so the tolerance was recorded as not breached and no question was raised about which measure governs. No manual submission was prepared and RB-PAY-011 was not invoked.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41500"],
    revealedAtMoment: MOMENTS.M01,
  },

  {
    id: "ARR-INC-2026-0401-01",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0401",
    atMoment: "11:34",
    sortOrder: 1,
    channel: "system",
    sourceLabel: "SYS-0014 RepairDesk session log and Duty Manager intervention note, 01.10.2026",
    sourceUserId: "P-009",
    provenance: "verified-fact",
    statement:
      "The analyst who created OVR-B override PAY-DE-20261001-311904, value EUR 61,200, opened the secondary review screen on the same item at 11:29. RepairDesk permitted it: she holds both the Repair Analyst and the Secondary Reviewer role assignments and the system does not prevent the creator of an override from reviewing it. The acting Duty Manager intervened at 11:34 before release and an independent reviewer approved the item at 11:46. No payment was released without independent review.",
    conflictsWithId: null,
    conflictResolution: "",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41102", "EVD-2026-41205"],
    revealedAtMoment: MOMENTS.M01,
  },

  /*
   * The only Swiss lane supplier notification in the history, and the only one
   * where the supplier's claim of no impact was correct. Kept for contrast
   * with 14:05: a 33-minute notification lag is acceptable when nothing is in
   * the queue and is the whole finding when something is.
   */
  {
    id: "ARR-INC-2026-0407-01",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0407",
    atMoment: "06:14",
    sortOrder: 1,
    channel: "supplier-notification",
    sourceLabel: "Novalink service notification, 02.10.2026, received after restoration",
    sourceUserId: null,
    provenance: "stakeholder-statement",
    statement:
      "Novalink notified ARC-CH at 06:14 that the RepairDesk Swiss instance hosted by TP-0042.1 Helvetia CloudWorks AG had been unavailable for 22 minutes from 05:41 during a hosting maintenance window, and that there had been no impact. The notification arrived 33 minutes after the start of the outage and after restoration. On this occasion the assertion of no impact was correct, because the window fell wholly outside the ARC-CH submission window. Closing the record required P-015 to state what recovery evidence exists for the Swiss instance, and none does.",
    conflictsWithId: null,
    conflictResolution:
      "Not a conflict. Recorded here because the same supplier made the same class of assertion at 14:05 on 06.10.2026, when it was wrong, and a reader comparing the two should be able to see that the notification pattern is consistent and that only the facts underneath it changed.",
    confidence: null,
    evidenceDocumentIds: ["EVD-2026-41210"],
    revealedAtMoment: MOMENTS.M01,
  },
];

/* ==========================================================================
   Recovery options

   Five options for the shared event and two for the 25.09.2026 precedent. The
   trade-offs are written honestly, which means the fast options are the ones
   that weaken the four-eyes control and the option that leaves the control
   untouched is the one that misses the cut-off. There is no option that is
   fast, safe and available; if there were, this would not be a decision and
   it would not need a professional.

   selected is false on every option for INC-2026-0412. The choice is the
   human's and the product must not arrive with it already made.
   ========================================================================== */

export const recoveryOptions: NewRecoveryOption[] = [
  /*
   * The option the process is already in at 14:12:41, which becomes a choice
   * the moment anyone asks whether to continue. Presenting the status quo as
   * an option is the only way the control cost of continuing becomes visible.
   */
  {
    id: "REC-0412-01",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    name: "Continue on the fallback route with RD-RULE-0031 in place",
    description:
      "Leave fallbackRouteMode = ACTIVE for Q-REPAIR-DE and Q-REPAIR-AT and keep clearing submission on SYS-0013 Arcadia Direct Link until Novalink restores NOVA-GATE. Submission capability is already restored, so this option costs nothing operationally and is the default unless someone decides otherwise.",
    estimatedMinutesToRestore: 0,
    controlTradeOff:
      "CTL-PAY-014 does not operate for the largest part of the population it exists to cover. Every OVR-C override below EUR 250,000 releases without independent secondary review while the fallback route is active, because RD-RULE-0031 waives the requirement before a human sees the item. ITOL-0004-04 carries a zero tolerance for releases with an unsatisfied mandatory gate, so this option generates candidate breaches by the minute. The only mitigating feature is that the affected population is identifiable afterwards from the override audit log, which makes the weakening reviewable rather than invisible.",
    operationalRisk:
      "Erroneous or unauthorised payment release, RSK-0211, realised at least once during the event. Independently of the control question, Q-REPAIR-DE rose from 61 to 494 items in 14 minutes with secondary reviewer capacity at 75% of approved establishment, so the option also carries cut-off pressure risk and raises OVR-D volume as the afternoon runs on.",
    availability: "available",
    requiresApprovalFrom:
      "P-007 Andreas Kellner as process owner for continuation beyond the initial Duty Manager activation, with P-008 Beatrix Hofmann notified as control owner under Group Operational Resilience Policy section 5.3",
    selected: false,
    sortOrder: 1,
  },

  /*
   * The option that restores the control and is still wrong. It was rejected
   * at 15:44 as DEC-2026-0777, in favour of exiting fallback at 16:08 and
   * disabling the rule under normal change control before the next activation.
   * Worth keeping visible: the correct decision here was to accept a known
   * control weakness for 26 minutes rather than create an undefined state in
   * 13 live payment records.
   */
  {
    id: "REC-0412-02",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    name: "Disable RD-RULE-0031 mid-event and stay on the fallback route",
    description:
      "Keep the fallback route and remove the rule that waives secondary review, editing the RepairDesk tenant configuration under the change control emergency provision so that four-eyes applies to every override for the remainder of the event. Arcadia can do this without Novalink: the rule sits in the arcadia-prod tenant and a tenant administrator can edit it.",
    estimatedMinutesToRestore: 35,
    controlTradeOff:
      "There is no four-eyes trade-off. The control is restored in full and every subsequent release passes the gate. The cost sits elsewhere: 13 overrides are in AWAITING_SECONDARY_REVIEW at the moment the rule changes and their behaviour under the new configuration is undefined, so the option trades a control weakness for a data integrity risk on live payment records. It also changes a control-relevant configuration during an incident, without a test environment, which is precisely the kind of change CHG-2024-5512 should have caught in the other direction.",
    operationalRisk:
      "Undefined state for 13 in-flight overrides, and a repair queue of 494 items that will not clear before the value-date cut-off at 75% reviewer capacity. A configuration change to a supplier system during an active incident carries its own change risk and cannot be rolled back cleanly if the 13 records are left inconsistent.",
    availability: "requires-approval",
    requiresApprovalFrom:
      "P-007 Andreas Kellner with P-004 Jakob Steinbacher and P-002 Stefan Brunner, under the change control emergency provision",
    selected: false,
    sortOrder: 2,
  },

  /*
   * The only option with no control cost at all, which is why it has to be on
   * the table even though nobody will choose it. If the professional is never
   * shown the price of doing the safe thing, the trade-off is not a trade-off.
   */
  {
    id: "REC-0412-03",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    name: "Hold all repair queue releases until NOVA-GATE is restored",
    description:
      "Stop releasing from the repair queue and wait for the primary route, relying on Novalink's 16:00 recovery estimate. No route-substitution override is created, no control is weakened, and nothing is released that has not passed the full gate. Instructions accumulate and are submitted when NOVA-GATE returns.",
    estimatedMinutesToRestore: 115,
    controlTradeOff:
      "None. This is the only option that leaves CTL-PAY-014 operating exactly as its description says it operates, and it produces no candidate breach of ITOL-0004-04. Every other option on this list buys time by spending control effectiveness.",
    operationalRisk:
      "2,317 instructions already in SUBMITTED state, plus 494 in the repair queue, miss their value-date cut-off. ITOL-0004-01 allows 4 hours of disruption to same-day EUR submission measured from the confirmed start at 13:38, and the 16:00 restoration figure is a supplier statement that Arcadia has no way to test. ITOL-0004-02 limits delayed value to 0.5% of daily corporate payment value (scenario figure), and a hold of this length puts that measure in play for the first time in the scenario period. The risk is client impact accepted deliberately rather than suffered.",
    availability: "available",
    requiresApprovalFrom:
      "P-007 Andreas Kellner, with P-001 Dr. Katharina Vogt and P-014 Dr. Heinrich Adler informed, because the option accepts client impact by choice rather than by circumstance",
    selected: false,
    sortOrder: 3,
  },

  /*
   * The Swiss option, and the one actually taken at 15:07 as DEC-2026-0776.
   * Note the shape of it: 45 minutes of preparation against 38 minutes of
   * tolerance, irreversible on transmission, and decided before the cause was
   * known. The two CHF 14,200 format rejections are the trade-off showing up
   * in the outcome rather than in the paperwork.
   */
  {
    id: "REC-0412-04",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    name: "ARC-CH manual submission through the correspondent under RB-PAY-011",
    description:
      "Prepare and transmit the CHF 18,712,400 same-day tranche manually through correspondent Helvetia Clearing Partner AG under runbook RB-PAY-011, with a 45-minute preparation lead time. This is the only route available to ARC-CH, which has no direct SIC participant link and no access to SYS-0013. The remaining CHF 42,591,710 of queued value is not same-day and can wait for the primary route.",
    estimatedMinutesToRestore: 45,
    controlTradeOff:
      "The automated format validation and the release gates embedded in SYS-0015 are not in the path. The compensating arrangement is a two-person Treasury check on the submission file, which is a different control over a different population with a different evidence trail from CTL-PAY-014, and it has never been exercised at this value. Two instructions worth CHF 14,200 were in fact rejected on format grounds, which is the absent validation appearing in the result rather than in the risk assessment.",
    operationalRisk:
      "Manual file preparation and handling risk at CHF 18.7m, and irreversibility: once the instructions are with the correspondent they cannot be unwound. The decision also has to be taken 45 minutes before the cut-off, which means before the cause of the disruption is known and before the supplier's recovery estimate can be tested. Accepting a manual-process risk to meet a cut-off is a judgment about which risk the entity prefers, and it belongs to the entity rather than to the group function.",
    availability: "requires-approval",
    requiresApprovalFrom:
      "P-015 Sibylle Graf with the ARC-CH Chief Operating Officer, under local resilience authority. The group function cannot take this decision for the entity",
    selected: false,
    sortOrder: 4,
  },

  /*
   * Included because someone always suggests it at 15:20, and because the
   * product is more useful when it can show an option and say plainly why it
   * is not available. This is EXC-TST-2026-0318-01 offered as a recovery plan.
   */
  {
    id: "REC-0412-05",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0412",
    name: "Clear the 13 held overrides with the Duty Manager as sole reviewer",
    description:
      "Release the 13 overrides sitting in AWAITING_SECONDARY_REVIEW by having the acting Duty Manager approve them herself under the OVR-E technical suppression path, on the basis that she has the seniority and no other reviewer is free.",
    estimatedMinutesToRestore: 10,
    controlTradeOff:
      "The reviewer would be approving overrides created as a direct consequence of her own fallback activation decision, which fails CTL-PAY-014 attribute (b) on reviewer independence. It is the same independence failure already reported as EXC-TST-2026-0318-01 of 14.07.2026, and it relies on the same RepairDesk role-assignment capability that MSN-2026-0147 has been open to remove since November 2025 and that produced the near miss INC-2026-0401 five days ago.",
    operationalRisk:
      "A known reportable control failure created deliberately during an incident, on 13 identifiable items, with a documented decision trail that would have to be explained to the committee and to Internal Audit. The operational gain is 10 minutes.",
    availability: "not-available",
    requiresApprovalFrom:
      "Not available for approval. CTL-PAY-014 attribute (b) and Group Internal Control System Standard section 3.2 preclude it, and no authority in RB-PAY-007 or in the resilience policy can waive reviewer independence",
    selected: false,
    sortOrder: 5,
  },

  /*
   * The 25.09.2026 precedent, kept because it shows the same two options with
   * the margins reversed. selected is true here: this is closed history, not a
   * pending decision, and the record of what was chosen is the point of it.
   */
  {
    id: "REC-0388-01",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0388",
    name: "Wait for the primary Swiss route to recover",
    description:
      "Hold the ARC-CH euroSIC and SIC queue and wait for SVC-0042-05 to return, on the assessment that 41 minutes of margin against the 16:00 CET cut-off was sufficient. Chosen on 25.09.2026 and correct on the day.",
    estimatedMinutesToRestore: 87,
    controlTradeOff:
      "None on four-eyes. The trade-off was a deadline accepted without an alternative, because ARC-CH had no tested fallback route to compare the wait against. An option that is chosen because the other one has never been tested is not really a choice.",
    operationalRisk:
      "The full same-day euroSIC value exposed to the cut-off with no second route if the primary path had not returned. It did return, which validated nothing except the timing.",
    availability: "available",
    requiresApprovalFrom: "P-015 Sibylle Graf",
    selected: true,
    sortOrder: 1,
  },

  {
    id: "REC-0388-02",
    runId: DEFAULT_RUN_ID,
    incidentId: "INC-2026-0388",
    name: "Manual correspondent submission under RB-PAY-011",
    description:
      "Prepare and transmit the ARC-CH same-day tranche manually through the correspondent, with a 45-minute preparation lead time. Not taken on 25.09.2026 because the primary route recovered with 41 minutes of margin.",
    estimatedMinutesToRestore: 45,
    controlTradeOff:
      "The SYS-0015 format validation and release gates are not in the path, and the compensating two-person Treasury check has never been exercised at value. On 25.09.2026 that argument was used to justify waiting; on 06.10.2026 the same untested route had to be used anyway, with 38 minutes of tolerance remaining.",
    operationalRisk:
      "Manual preparation risk and irreversibility on transmission. The risk did not change between 25.09.2026 and 06.10.2026. What changed is that the eleven days in between produced no test of the route, so the second decision was taken on exactly the same information as the first.",
    availability: "requires-approval",
    requiresApprovalFrom: "P-015 Sibylle Graf with the ARC-CH Chief Operating Officer",
    selected: false,
    sortOrder: 2,
  },
];

/* ==========================================================================
   Regulatory publications

   Six synthetic instruments behind the four regulatory change items in scope.
   Identifiers are derived from the change item they drive, with a lane suffix
   where a change item has two lanes, because REG-2026-0104 and REG-2026-0117
   each carry an EU reference and a Swiss reference that are assessed
   separately and must never be answered once.

     REG-2026-0031-EU   EU     register of information, subcontracting chains
     REG-2026-0031-DE   DE     national outsourcing and IKS expectations
     REG-2026-0117-EU   EU     incident classification and reporting
     REG-2026-0104-EU   EU     impact tolerance definition and testing
     REG-2026-0088      CH     outsourcing inventory and data access abroad
     REG-2026-0104-CH   CH     operational risk, resilience, incident reporting

   The issuing bodies are synthetic. The fullText is written to be read: the
   Regulatory Change Manager is meant to open it, find the paragraph, and argue
   with it. Numbered paragraphs, articles and margin numbers exist so that
   every obligation can cite a real location in a real document.

   Jurisdiction discipline: the EU lane publications reference the Union
   framework and national supervision for ARC-DE and ARC-AT. The Swiss lane
   publications reference FINMA operational risk, resilience and outsourcing
   context and nothing else. No Swiss publication mentions the Union
   regulation as applicable, and the EU publications state their own limits.

   `evidenceDocumentId` is null on every row, and that is the honest value.
   The field names the Evidence Vault copy of the instrument, and the vault
   holds no copy of any of these six instruments: the text is carried on the
   row in `fullText`, which is what the interface reads. The vault does hold
   Arcadia's own documents about these change items, the two regulatory
   reference digests EVD-2026-41300 and EVD-2026-41320, the REG-2026-0088
   status note EVD-2026-41305, the draft internal tolerance standard
   EVD-2026-41310 and the group incident classification standard
   EVD-2026-41315, and not one of them is an instrument. A digest of which
   frameworks Arcadia refers to is not the framework, and citing it here
   would present an internal navigation aid as a supervisory text. Three of
   those documents also span all three entities, so attaching one to a single
   lane publication would breach the lane separation this block exists to
   enforce. They are cited from the obligations and decisions that use them,
   which is where they belong.
   ========================================================================== */

export const regulatoryPublications: NewRegulatoryPublication[] = [
  {
    id: "REG-2026-0031-EU",
    runId: DEFAULT_RUN_ID,
    reference: "EFSCB/GL/2026/04",
    title:
      "Guidelines on the register of information for ICT third-party arrangements and on the completeness of subcontracting chains",
    issuer: "European Financial Supervision Coordination Board (synthetic issuing body)",
    jurisdiction: "eu",
    publishedOn: "2026-06-18",
    effectiveFrom: "2027-01-01",
    consultationCloses: null,
    instrumentType: "guideline",
    summary:
      "Synthetic guidelines addressed to credit institutions established in the Union, setting expectations for the content and maintenance of the register of information on ICT third-party arrangements, with particular attention to subcontracting chains, the places from which services are performed, onward subcontracting, and what counts as notice of a subcontractor change. Issued in support of the Union digital operational resilience framework, Regulation (EU) 2022/2554, and to be read with the European Banking Authority guidelines on outsourcing arrangements. Relevant to ARC-DE and ARC-AT. Not addressed to entities established outside the Union, so it is not applied to ARC-CH; the corresponding Swiss subject matter is covered separately under REG-2026-0088. Illustrative regulatory context, not legal advice.",
    fullText: `Illustrative regulatory context, not legal advice. Synthetic issuing body and synthetic instrument, prepared for the Arcadia scenario.

Section 1. Purpose, addressees and scope

1. These guidelines set out the expectations of the Board on the content, structure and maintenance of the register of information that a financial entity keeps in respect of all contractual arrangements for the use of ICT services provided by ICT third-party service providers. They are issued in support of the Union digital operational resilience framework, Regulation (EU) 2022/2554, and are to be read together with the guidelines on outsourcing arrangements issued by the European Banking Authority.

2. These guidelines are addressed to credit institutions established in the Union and to the competent authorities that supervise them. They do not extend to an entity established outside the Union. Where a group contains such an entity, the corresponding requirement, if any, arises under the framework applicable to that entity and must be identified, mapped and evidenced separately. A determination made at group level does not discharge an obligation that sits at entity level, and an entity outside the Union is not brought within the scope of this instrument by consolidation.

Section 2. Completeness of the subcontracting chain

3. A financial entity shall record in the register every subcontractor that effectively underpins an ICT service supporting a critical or important function, and shall do so to the level of the subcontracting chain at which the service is actually performed. Recording the direct contractual counterparty alone does not satisfy this paragraph.

4. The Board observes that incomplete chains are most often found where the service is performed by an entity two or more steps removed from the financial entity, and where the intermediate provider treats the arrangement as its own supply chain rather than as part of the service it has contracted to deliver. The financial entity remains responsible for the completeness of its register irrespective of how the provider chooses to organise its supply chain.

5. For each subcontractor recorded under paragraph 3, the financial entity shall record the country from which the service is performed and the categories of data that the subcontractor is able to access in the course of performing it. Where access is technically possible but the provider asserts that it is not used, the access is recorded as access and the assertion is recorded separately as an assertion.

Section 3. Agreement between the register and the contractual documentation

6. The register is maintained from the contractual documentation and from information supplied by the provider. Where the two sources do not agree, the financial entity does not resolve the difference by selecting the more convenient source.

7. The financial entity shall satisfy itself that the provider's own register of subcontractors and the contractual documentation agree, and shall treat a divergence between them as a deficiency in the arrangement until it is resolved. The resolution shall establish which document is binding and record by whom that question was determined.

8. Publication of information on a provider's client portal does not of itself constitute notice to the financial entity unless the contractual arrangement provides that it does. Where a provider relies on portal publication and the arrangement does not provide for it, the financial entity records an unresolved notice question rather than a completed notification.

Section 4. Onward subcontracting

9. Arrangements in which a subcontractor itself engages a further provider fall within the subject matter of these guidelines to the extent that the further provider underpins an ICT service supporting a critical or important function, or retains data arising from that service.

10. The Board is aware that many contractual arrangements in the market address the first tier of subcontracting only and are silent on onward subcontracting. Silence in the contractual arrangement does not remove the arrangement from the register, and the absence of a contractual right to information is itself information that the register should carry.

11. Where a further provider engaged by a subcontractor retains data arising from an ICT service supporting a critical or important function, the financial entity shall record that provider, the data retained, the retention period, and the basis on which the financial entity is able to obtain information about it. Where no such basis exists, the absence shall be recorded as a gap in the arrangement and shall be reported through the entity's own governance.

Section 5. Maintenance and review

12. The register is updated when the financial entity becomes aware of a change and is reviewed in full at least annually. A register that is complete at the review date and stale thereafter does not satisfy Section 2. The review shall record the date on which each Tier 1 arrangement was last confirmed against the provider's own register.

Illustrative regulatory context, not legal advice. This instrument is synthetic. It states no view on the position of any institution and reaches no conclusion about compliance.`,
    evidenceDocumentId: null,
  },

  /*
   * The national lane behind the same change item. This is the publication
   * that matters most for the 14:05 event, because paragraph 7 is precisely
   * the thing Arcadia did not do with RD-RULE-0031: it never established how
   * the supplier's system enforces the control, or under what conditions it
   * stops enforcing it.
   */
  {
    id: "REG-2026-0031-DE",
    runId: DEFAULT_RUN_ID,
    reference: "FOFMS-RS-07/2026",
    title:
      "Circular 07/2026: outsourcing governance and the internal control system in payment operations",
    issuer: "Federal Office for Financial Market Supervision (synthetic issuing body)",
    jurisdiction: "de",
    publishedOn: "2026-08-05",
    effectiveFrom: "2026-12-01",
    consultationCloses: null,
    instrumentType: "circular",
    summary:
      "Synthetic national circular addressed to credit institutions supervised in Germany, setting expectations for the internal control system where controls are operated inside or enforced by a third-party system, and for the governance of changes to such systems. Consistent in subject matter with national minimum requirements for risk management and with national supervisory requirements for IT, and complementary to the Union digital operational resilience framework. Relevant to ARC-DE. Not addressed to ARC-AT, which is supervised in Austria, and not applied to ARC-CH. Illustrative regulatory context, not legal advice.",
    fullText: `Illustrative regulatory context, not legal advice. Synthetic issuing body and synthetic instrument, prepared for the Arcadia scenario.

Preamble

1. This circular addresses the internal control system, Internes Kontrollsystem (IKS), where a key control is operated inside a system provided by a third party, or where a third-party system enforces the control gate on which the institution relies. It is issued in the context of the national minimum requirements for risk management, in particular the internal control system and outsourcing provisions, and of the national supervisory requirements for information technology. It complements and does not displace the Union digital operational resilience framework.

2. The circular applies to institutions supervised in this jurisdiction. It does not address entities supervised elsewhere, including group entities established outside the Union, whose requirements arise under their own frameworks.

Section A. Controls operated in third-party systems

3. An institution may rely on a third-party system to enforce a control gate. Reliance of that kind does not transfer accountability for the control, and it does not reduce the institution's obligation to know how the gate behaves.

4. The control description held by the institution shall describe the control as it actually operates, including any system condition under which the control does not operate. A control description that states an unqualified requirement, while the system that enforces it contains a conditional exemption, is a deficient description and shall be treated as a design deficiency rather than as a documentation matter.

5. Where the institution becomes aware of a divergence between the control description and the behaviour of the system, the divergence shall be recorded as a finding with an owner and a date, and the control effectiveness conclusion for the period shall not be reached until the divergence is understood.

6. The Office notes that conditional exemptions in third-party systems are frequently introduced for continuity or throughput purposes, are frequently correct as engineering decisions, and are frequently invisible to the institution's control owner. The engineering merit of the exemption is not the question. The question is whether the institution knows it exists.

7. An institution shall not treat a control operated in a third-party system as effective unless it has established, and can evidence, how that system enforces the control, including the conditions under which the system does not enforce it. Evidence of the system's configuration obtained from the provider is sufficient for this purpose; a provider statement without the configuration is not.

Section B. Governance of changes to third-party systems

8. A change to a third-party system that supports a critical or important function is a change to the institution's control environment, whether or not the institution initiated it and whether or not the provider describes it as material.

9. The institution's change approval process shall obtain and retain the provider's description of the change, and shall record whether that description is sufficient to determine the change's effect on the institution's controls. Where the description is not sufficient, the approval record shall say so.

10. Release notes that describe a change in terms of performance, throughput or continuity, without stating its effect on control enforcement, are not a sufficient basis for approval of a change to a system that enforces a key control.

11. Where an institution approves a change to a third-party system that supports a critical or important function, the approval record shall state which controls were examined for the effect of the change, and the statement shall be made by the owner of each control examined. An approval record that names no control owner shall be treated as an approval of an unassessed change.

12. Where a change is applied by a subcontractor of the provider rather than by the provider itself, paragraphs 8 to 11 apply unchanged. The institution's contractual notice arrangements are the mechanism by which it learns of such changes, and a notice provision that is not exercised is not evidence of governance.

Illustrative regulatory context, not legal advice. This instrument is synthetic and reaches no conclusion about any institution's compliance.`,
    evidenceDocumentId: null,
  },

  {
    id: "REG-2026-0117-EU",
    runId: DEFAULT_RUN_ID,
    reference: "EFSCB/TS/2026/09",
    title:
      "Technical standards on the classification of ICT-related incidents, reporting thresholds and time limits",
    issuer: "European Financial Supervision Coordination Board (synthetic issuing body)",
    jurisdiction: "eu",
    publishedOn: "2026-05-22",
    effectiveFrom: "2026-09-01",
    consultationCloses: null,
    instrumentType: "regulation",
    summary:
      "Synthetic technical standards specifying the criteria for classifying an ICT-related incident as major, the thresholds applied to each criterion, the time limits for initial notification and subsequent reports, and the treatment of information that becomes available after the classification has been made. Addressed to financial entities established in the Union, so relevant to ARC-DE and ARC-AT. The Swiss lane of the same change item is assessed separately against FINMA reporting expectations under REG-2026-0104-CH and is not covered by this instrument. Illustrative regulatory context, not legal advice.",
    fullText: `Illustrative regulatory context, not legal advice. Synthetic issuing body and synthetic instrument, prepared for the Arcadia scenario.

Article 1. Subject matter

1. These technical standards specify the criteria for the classification of ICT-related incidents, the materiality thresholds applied to those criteria, the time limits and content of reports, and the treatment of classification decisions taken on incomplete information.

2. These standards apply to financial entities established in the Union. They do not apply to an entity established in a third country, and a group-level report does not substitute for an entity-level determination.

Article 2. Classification is a determination, not a calculation

1. The classification of an incident is a determination made by the financial entity on the information available to it, recorded with the reasoning that supported it and with the identity of the person who made it.

2. A classification produced automatically from monitoring data is an input to that determination and is not the determination. Where an entity uses automated support, the record shall distinguish the automated proposal from the conclusion reached by the responsible person.

Article 3. Classification criteria

1. A financial entity shall classify an ICT-related incident by reference to the criteria set out in paragraph 2, applying the thresholds published with these standards, and shall record the assessment against each criterion including the criteria that are not met.

2. The criteria are: the number of clients and financial counterparts affected and the relevance of those clients; the reputational impact; the duration of the incident and the service downtime; the geographical spread, including the number of Member States affected; the data losses, including losses of integrity, availability and confidentiality; the criticality of the services affected, including the entity's critical or important functions; and the economic impact, including direct and indirect costs and losses.

3. An incident that meets no criterion at the major threshold but affects a critical or important function is recorded as significant, with the assessment retained. The record of an incident that was assessed and not classified as major is as important as the record of one that was.

Article 4. Recurrence and aggregation

1. Where incidents that individually fall below the thresholds arise from the same root cause and recur within a period of six months, the financial entity shall assess them together and shall record whether the aggregate would have met any criterion at the major threshold.

2. The absence of an aggregation rule in an entity's internal standard does not relieve the entity of the assessment required by paragraph 1.

Article 5. Time limits

1. An initial notification shall be submitted to the competent authority as soon as the financial entity has classified the incident as major, and in any event within the time limit published with these standards, followed by an intermediate report when the status of the incident changes significantly and a final report when the root cause analysis is complete.

2. The time limit for the initial notification runs from classification, and the entity shall record the time of classification separately from the time of detection and from the time at which the incident began.

Article 6. Incidents originating at a third-party provider

1. Where an incident originates at an ICT third-party service provider, the financial entity classifies the incident by reference to its own services and clients, and not by reference to the severity assigned by the provider.

2. A delay by the provider in notifying the financial entity does not extend any time limit under Article 5, and the entity shall record the interval between the start of the incident at the provider and the entity's own detection.

Article 7. Information that becomes available later

1. A classification may be recorded as provisional where material information is not yet available, provided that the missing information is identified and the date on which it is expected is recorded.

2. A provisional classification is not a completed assessment and shall not be presented as one in internal or external reporting.

3. The financial entity shall identify, for each provisional classification, the person accountable for completing it.

4. Where information that was not available at the time of classification subsequently becomes available, the financial entity shall repeat the classification and shall record both the original and the repeated conclusion. Neither conclusion is deleted, and a change between them is itself a reportable fact.

Article 8. Records

1. The classification record shall retain the facts available at the time of the determination, the facts that were sought and not obtained, and the sources of each. A record that states only the conclusion does not satisfy this Article.

Illustrative regulatory context, not legal advice. This instrument is synthetic and reaches no conclusion about any entity's compliance.`,
    evidenceDocumentId: null,
  },

  /*
   * The consultation behind the internal impact tolerance standard. Paragraph
   * 6 is the one that names Conflict D before Conflict D happens: a tolerance
   * with two measures and no stated precedence cannot answer the question it
   * exists to answer. Consultation closes 23.10.2026, which is ten days after
   * the committee, so the ARC-CH position has to be formed before the
   * institution knows what the final standard will say.
   */
  {
    id: "REG-2026-0104-EU",
    runId: DEFAULT_RUN_ID,
    reference: "EFSCB/CP/2026/11",
    title:
      "Consultation paper on the definition, measurement and testing of impact tolerances for important business services",
    issuer: "European Financial Supervision Coordination Board (synthetic issuing body)",
    jurisdiction: "eu",
    publishedOn: "2026-09-21",
    effectiveFrom: null,
    consultationCloses: "2026-10-23",
    instrumentType: "consultation",
    summary:
      "Synthetic consultation paper proposing how an impact tolerance for an important business service should be expressed, from what point its consumption is measured, and how it should be tested, including substitution of a critical ICT provider in severe but plausible scenarios. Addressed to credit institutions established in the Union, so relevant to ARC-DE and ARC-AT. The Swiss lane of the same internal change item follows FINMA operational risk and resilience expectations and is covered separately under REG-2026-0104-CH, with a different definition of the protected object and a different testing expectation. Responses close 23.10.2026, ten days after CMT-NFR-2026-10. Illustrative regulatory context, not legal advice.",
    fullText: `Illustrative regulatory context, not legal advice. Synthetic issuing body and synthetic consultation, prepared for the Arcadia scenario.

Introduction

1. This paper consults on the expression, measurement and testing of impact tolerances for important business services. The Board has observed considerable variation in practice, and in particular a tendency for tolerances to be drafted so that they cannot be applied cleanly at the moment they are needed.

2. This paper is addressed to credit institutions established in the Union. Institutions with group entities established outside the Union are reminded that the resilience expectations applicable to those entities arise under their own frameworks, that the protected object may be defined differently there, and that a single group tolerance statement can obscure rather than reconcile the difference.

Chapter 1. Expression of a tolerance

3. An impact tolerance states the maximum disruption to an important business service that the institution is willing to tolerate, expressed in a unit that can be measured during a live disruption by the people responsible for managing it.

4. The Board's supervisory observation is that tolerances expressed in more than one unit are common and are often drafted by combining a time limit with an operational deadline, such as a market or clearing cut-off. Both are legitimate. The difficulty arises when they are combined without a rule for the case in which they disagree.

5. A tolerance that cannot be applied without a further judgment at the moment of disruption is not a tolerance but a starting point for a discussion, and the discussion will take place under time pressure and without the board that approved the tolerance in the room.

6. An impact tolerance shall be expressed by a single measure, or, where more than one measure is used, the instrument shall state which measure governs where the measures give different answers. An institution that cannot state which measure governs cannot conclude whether its tolerance was breached, and shall report that as a defect in the tolerance rather than as an inconclusive incident.

Chapter 2. Measurement

7. Consumption of a tolerance is measured from the point at which the service ceased to be delivered within its normal parameters. This point is established retrospectively from evidence and is frequently earlier than the point of detection.

8. Where the institution's knowledge of the start of a disruption depends on notification by a third party, the institution shall record the interval between the actual start and its own knowledge, and shall treat a material interval as a resilience finding against the arrangement rather than as an unavoidable feature of it.

9. Measurement of tolerance consumption shall not begin at the point of detection, and an institution shall not present a consumption figure measured from detection as a consumption figure measured from the start of the disruption. The two differ by the institution's own blindness and the difference is informative.

Chapter 3. Testing

10. An institution shall test its ability to remain within each impact tolerance in severe but plausible scenarios, and shall record what the test established as distinct from what it assumed.

11. The Board considers that a scenario that does not include the loss of a critical ICT third-party service provider is unlikely to be severe but plausible for a service that depends on one.

12. A recovery arrangement that has been documented but never exercised is recorded as untested, whatever its documented recovery time may be, and the institution shall not rely on an untested arrangement when concluding that it can remain within a tolerance.

13. Where an important business service depends on a provider for which no substitution has been tested, the institution shall test the substitution or shall record, with the accountable executive named, that it has accepted the dependency untested. An exit or substitution plan that assumes an internal capability the institution does not hold is not a plan, and the institution shall say so in terms.

14. Responses are invited on paragraphs 6, 9 and 13 in particular, and should be submitted by 23.10.2026.

Illustrative regulatory context, not legal advice. This instrument is synthetic and reaches no conclusion about any institution's position.`,
    evidenceDocumentId: null,
  },

  /*
   * Swiss lane. FINMA outsourcing context only. No reference to the Union
   * regulation as applicable to ARC-CH appears anywhere in this publication,
   * because it does not apply to ARC-CH and the product must not imply that it
   * does. Margin number 11 is the Meridian question: a subcontractor in Pune
   * with read access to beneficiary name and reference fields, unnotified, and
   * no Swiss record of what is reachable from outside Switzerland.
   */
  {
    id: "REG-2026-0088",
    runId: DEFAULT_RUN_ID,
    reference: "SFMOB-RS-2026/02",
    title:
      "Circular 2026/02: outsourcing by banks, inventory of significant outsourcings, subcontracting and access to client-identifying data from abroad",
    issuer: "Swiss Financial Market Oversight Board (synthetic issuing body)",
    jurisdiction: "ch",
    publishedOn: "2026-07-09",
    effectiveFrom: "2027-01-01",
    consultationCloses: null,
    instrumentType: "circular",
    summary:
      "Synthetic Swiss circular addressed to banks, setting expectations for the determination of significant outsourcing, the inventory a bank maintains of its significant outsourcings, the treatment of subcontractors, access to client-identifying data from outside Switzerland, and contractual supervisory and audit access. Consistent in subject matter with FINMA outsourcing expectations and with Swiss data protection requirements on cross-border disclosure. Relevant to ARC-CH only. This instrument is the Swiss counterpart in subject matter to the EU register of information expectations, and the two produce separate inventories with separate scopes; neither extends to the other's entities. Illustrative regulatory context, not legal advice.",
    fullText: `Illustrative regulatory context, not legal advice. Synthetic issuing body and synthetic instrument, prepared for the Arcadia scenario.

I. Subject matter and addressees

1. This circular concerns the outsourcing of functions by banks, Auslagerung, and in particular the determination of significant outsourcing, wesentliche Auslagerung, the inventory the bank maintains, the treatment of subcontractors, and access to client-identifying data from outside Switzerland. It reflects FINMA expectations on outsourcing and operational risk management and is to be read with the data protection requirements applicable to cross-border disclosure.

2. This circular is addressed to banks supervised in Switzerland. Where a bank forms part of a group with entities supervised abroad, the requirements applicable to those entities arise under their own frameworks. A group-wide inventory maintained for another purpose does not satisfy this circular unless it separately identifies the outsourcings of the Swiss bank on the basis set out here.

II. Determination of significance

3. An outsourcing is significant where the outsourced function is material to the bank's business activity or to its compliance with supervisory requirements, or where a disruption of the function would materially impair a critical business process.

4. The determination is made by the bank, is documented with its reasoning, and is reviewed when the service, the provider or the supply chain changes. A determination made by a group function is an input to the Swiss bank's determination and does not replace it.

5. Where a provider delivers several services to the bank, significance is determined for each service. The Board has observed that a service classified as not significant can become significant through a change in the way another service depends on it, and that such changes are rarely revisited.

III. Inventory

6. The bank shall maintain an inventory of its significant outsourcings which states, for each outsourcing, the function outsourced, the provider, the subcontractors engaged in performing it, the places from which the service is performed, and the bank's assessment of substitutability. The inventory shall be maintained at the level of the Swiss bank and shall be capable of being produced on request.

7. The inventory shall record the date on which each entry was last confirmed against the provider's own information, and shall distinguish information the bank has verified from information the provider has asserted.

IV. Subcontracting

8. The bank shall know which subcontractors participate in performing a significant outsourcing, and shall agree with the provider that it will be informed of intended changes before they take effect.

9. Where the provider maintains its own register of subcontractors, the bank shall reconcile that register against its contractual documentation. A divergence is recorded as an open issue with an owner, and the bank shall establish which document governs before concluding that the arrangement is in order.

10. Onward subcontracting by a subcontractor is within the subject matter of this circular where the further provider participates in performing the outsourced function or retains data arising from it.

V. Access to client-identifying data from abroad

11. Where a subcontractor is able to access client-identifying data from outside Switzerland, the bank shall satisfy itself that the access is necessary for the performance of the outsourced function, that the data categories accessible are known and documented, and that the disclosure is permissible under the applicable data protection requirements, and shall record the assessment together with the date on which it was made and the person who made it.

12. Technical ability to access data is treated as access. A provider statement that available access is not exercised is recorded as a statement and does not remove the access from the assessment required by margin number 11.

13. The bank shall be able to state, for each significant outsourcing, which client-identifying data is reachable from outside Switzerland and by whom. An inability to state this is a deficiency in the arrangement and is reported through the bank's own governance.

VI. Supervisory and audit access

14. The bank shall secure, contractually, its own right of audit and the right of access of the supervisory authority and of the bank's audit firm, in each case extending to the places from which the service is performed.

15. The rights secured under margin number 14 shall extend to subcontractors participating in the performance of a significant outsourcing, and the bank shall be able to demonstrate that the rights are exercisable in practice and not only in the text of the agreement. Where the agreement is silent on the subcontractors of subcontractors, the gap is recorded as such.

VII. Business continuity

16. The bank shall satisfy itself that the provider maintains business continuity and recovery arrangements for the significant outsourcing, and shall obtain evidence covering the instances and locations from which the bank's own service is delivered. Evidence relating to other instances of the same service does not discharge this margin number.

17. Where no recovery evidence is available for an instance from which the bank's service is delivered, the bank records the absence, assesses the resulting exposure, and reports it. The passage of time does not convert an absence of evidence into an acceptable position.

18. The bank shall document, for each significant outsourcing supporting a critical business process, the alternative arrangement available on failure of the provider and the time required to bring it into operation.

Illustrative regulatory context, not legal advice. This instrument is synthetic and reaches no conclusion about any bank's compliance.`,
    evidenceDocumentId: null,
  },

  /*
   * Swiss lane, resilience and reporting. Margin number 14 is the Swiss
   * counterpart to Article 7 of the EU technical standards: same subject
   * matter, different threshold, different addressee, different determination.
   * DEC-2026-0774 and DEC-2026-0775 exist as two records because of exactly
   * this separation, and merging them would be the single most damaging thing
   * the product could do.
   */
  {
    id: "REG-2026-0104-CH",
    runId: DEFAULT_RUN_ID,
    reference: "SFMOB-RS-2026/05",
    title:
      "Circular 2026/05: operational risks and resilience for banks, critical business processes, tolerance for disruption and reporting of incidents of substantial importance",
    issuer: "Swiss Financial Market Oversight Board (synthetic issuing body)",
    jurisdiction: "ch",
    publishedOn: "2026-08-28",
    effectiveFrom: "2027-07-01",
    consultationCloses: null,
    instrumentType: "circular",
    summary:
      "Synthetic Swiss circular addressed to banks, setting expectations for the identification of critical business processes, the determination of a tolerance for disruption for each, the demonstration of recovery capability including where a substitute route has never been exercised, and the reporting of incidents of substantial importance. Consistent in subject matter with FINMA operational risk and resilience expectations. Relevant to ARC-CH only. The incident reporting expectation in margin numbers 12 to 14 is the Swiss counterpart to the EU classification and reporting standard under REG-2026-0117-EU: a different threshold, a different addressee and a separate determination, which is why the two assessments for the same event are recorded separately and are never merged. Illustrative regulatory context, not legal advice.",
    fullText: `Illustrative regulatory context, not legal advice. Synthetic issuing body and synthetic instrument, prepared for the Arcadia scenario.

I. Subject matter and addressees

1. This circular concerns the management of operational risks and operational resilience at banks, including the identification of critical business processes, the determination of a tolerance for disruption, the demonstration of recovery capability, and the reporting of incidents of substantial importance. It reflects FINMA expectations on operational risks and resilience.

2. This circular is addressed to banks supervised in Switzerland. Requirements applicable to group entities supervised abroad arise under their own frameworks, are assessed by those entities, and are not satisfied by the assessments made under this circular. A group conclusion is not a Swiss conclusion.

II. Critical business processes and tolerance for disruption

3. The bank identifies its critical business processes, being those processes whose disruption would materially impair the bank's ability to meet its obligations, would materially damage its clients, or would affect the functioning of the financial market.

4. For each critical business process the bank determines a tolerance for disruption, approved at the level of the bank, expressed so that it can be applied while a disruption is in progress.

5. The bank identifies its critical business processes, determines a tolerance for disruption for each of them, and demonstrates its ability to restore the process within that tolerance. Demonstration is based on exercise or on evidenced experience, and not on the existence of documentation alone.

6. Where a tolerance is expressed with reference to an external deadline, such as a clearing or settlement cut-off, the bank records how that deadline interacts with any time-based element of the tolerance, so that the tolerance remains capable of application when the two do not coincide.

III. Dependencies and substitute routes

7. The bank documents the dependencies of each critical business process, including dependencies on services provided by third parties and by their subcontractors, and including the places from which those services are performed.

8. A dependency for which no alternative arrangement exists is documented as such, with the consequence for the tolerance for disruption stated plainly.

9. Where a critical business process depends on a service for which no substitute route has been tested, the bank shall document the dependency, the alternative arrangement if any, and the time required to invoke it, and shall keep that time under review. The bank shall not treat a documented alternative as available for the purpose of margin number 5 until the time required to invoke it has been established.

10. Manual alternatives are legitimate and are frequently the only realistic arrangement. Where a manual alternative is relied on, the bank records the controls that operate in the manual path, and in particular any control that operates in the automated path and does not operate in the manual one.

11. The bank reviews its dependency documentation after each disruption in which an alternative arrangement was invoked, and records what the invocation established about the documented time.

IV. Reporting of incidents of substantial importance

12. The bank assesses each incident affecting a critical business process against the question whether the incident is of substantial importance, and records the assessment whether or not the conclusion is that it is.

13. The assessment considers the effect on the bank's clients and on its critical business processes, the duration, the extent to which client-identifying data was affected, and whether the bank's ability to meet an external deadline was impaired.

14. The bank shall report incidents of substantial importance to the supervisory authority without delay, shall state the basis on which the determination was made, and shall repeat the assessment where further information subsequently becomes available. A determination taken on incomplete information is recorded as provisional and the missing information is identified.

15. The bank's internal standard shall name the person accountable for the determination under margin number 14 and the person accountable for repeating it. Where an incident originates at a provider and the provider's own report is outstanding, the outstanding report is identified together with the date on which it is expected.

V. Governance

16. The bank's governing body approves the identification of critical business processes and the tolerance for disruption for each, and receives reporting on disruptions in which a tolerance was consumed materially.

17. Reporting under margin number 16 distinguishes what the bank has verified from what a provider has asserted, and identifies any question the bank has been unable to answer.

Illustrative regulatory context, not legal advice. This instrument is synthetic and reaches no conclusion about any bank's compliance.`,
    evidenceDocumentId: null,
  },
];

/* ==========================================================================
   Candidate obligations

   Eighteen candidates extracted from the six publications. Every row carries a
   real paragraph reference, the quoted requirement, and a separately labelled
   extraction summary, so the professional can see what the document says and
   what a model made of it without the two being blended.

   applicabilityDecision, applicabilityRationale, decidedByUserId and decidedOn
   are null on every row. Applicability is determined per legal entity with a
   recorded rationale, and that determination is the Regulatory Change
   Manager's work. candidateEntityIds says where the question arises; it does
   not answer it. EU-lane candidates list ARC-DE and ARC-AT, or ARC-DE alone
   for the national circular. Swiss-lane candidates list ARC-CH alone. No row
   lists an EU instrument against ARC-CH.

   Five rows are marked as unowned gaps with no owner and a note saying what is
   missing. Those are the rows the role exists to find, and the largest of them
   is the fourth-party question, where the contract, the policy and the control
   set all stop one tier too early.
   ========================================================================== */

export const obligations: NewObligation[] = [
  {
    id: "OBL-2026-0031-001",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0031-EU",
    paragraphReference: "Section 2, paragraph 3",
    obligationText:
      "\"A financial entity shall record in the register every subcontractor that effectively underpins an ICT service supporting a critical or important function, and shall do so to the level of the subcontracting chain at which the service is actually performed. Recording the direct contractual counterparty alone does not satisfy this paragraph.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: the register must reach the entity that actually performs the service, not only the entity Arcadia contracts with. Against TP-0042 this bites twice. TP-0042.4 Meridian Operations Support Pvt Ltd performs level 1 service desk and out-of-hours monitoring for NOVA-GATE and RepairDesk from Pune and is absent from the binding appendix altogether, and TP-0042.2 Rheinstack GmbH is listed for the Frankfurt region only while the Amsterdam region carried NOVA-GATE write traffic during INC-2026-0412. KRI-TPR-002, Tier 1 third parties with a complete and current subprocessor record, stands at 94.6% against a 95% amber floor (scenario figures). The candidate obligation is clear; whether it applies, and to which entity, is a human determination.",
    extractionConfidence: 0.91,
    theme: "outsourcing",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-TPR-6.2"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-002",
    implementationPriority: "high",
    sortOrder: 1,
  },

  {
    id: "OBL-2026-0031-002",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0031-EU",
    paragraphReference: "Section 2, paragraph 5",
    obligationText:
      "\"For each subcontractor recorded under paragraph 3, the financial entity shall record the country from which the service is performed and the categories of data that the subcontractor is able to access in the course of performing it. Where access is technically possible but the provider asserts that it is not used, the access is recorded as access and the assertion is recorded separately as an assertion.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: country of performance and data categories must both be recorded, and a provider assurance that access is unused does not remove the access from the record. This is the discipline the product already applies to stakeholder statements, arriving from the other direction. TP-0042.4 holds read access to payment metadata including beneficiary name and reference fields, performed from Pune, and Arcadia's third-party module records neither the country nor the data categories because the subprocessor is not recorded at all. The second sentence is the useful one for the working file: it tells the Third-Party Risk Manager to keep the access and the assurance as two separate entries.",
    extractionConfidence: 0.88,
    theme: "outsourcing",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-TPR-6.2"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-002",
    implementationPriority: "high",
    sortOrder: 2,
  },

  {
    id: "OBL-2026-0031-003",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0031-EU",
    paragraphReference: "Section 3, paragraph 7",
    obligationText:
      "\"The financial entity shall satisfy itself that the provider's own register of subcontractors and the contractual documentation agree, and shall treat a divergence between them as a deficiency in the arrangement until it is resolved. The resolution shall establish which document is binding and record by whom that question was determined.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: a divergence between the provider register and the contract is itself the deficiency, and the fix is a determination of which document binds, made by a named person. CTR-2023-0117-A3 version 4.2 of 14.02.2025 lists three subprocessors; the Novalink register version 6.1 of 03.08.2026 lists four. P-016 Dr. Anja Weiss issued a Group Legal opinion on the binding version on 06.10.2026 at 15:23 under EVD-2026-41901, which is the determination this paragraph asks for. Novalink's position, given at 15:31, is that client portal publication constitutes notice; paragraph 8 of the same instrument says portal publication is not notice unless the arrangement says so, and CTR-2023-0117-A3 does not say so. This remains a live contractual dispute rather than a settled breach and must be presented as one.",
    extractionConfidence: 0.84,
    theme: "governance",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-TPR-6.2", "POL-TPR-5.4"],
    processIds: [],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-002",
    implementationPriority: "high",
    sortOrder: 3,
  },

  /*
   * Unowned gap, and the widest one in the file. The contract stops at the
   * first tier, the group policy stops at the first tier, and no control looks
   * further. TP-0042.3-F1 Aurora Object Storage Ltd holds payment reference
   * metadata in Dublin for 24 months under an arrangement Arcadia has no
   * contractual route to inspect. This is a drafting gap, not a breach, and
   * saying so is the whole professional point.
   */
  {
    id: "OBL-2026-0031-004",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0031-EU",
    paragraphReference: "Section 4, paragraph 11",
    obligationText:
      "\"Where a further provider engaged by a subcontractor retains data arising from an ICT service supporting a critical or important function, the financial entity shall record that provider, the data retained, the retention period, and the basis on which the financial entity is able to obtain information about it. Where no such basis exists, the absence shall be recorded as a gap in the arrangement and shall be reported through the entity's own governance.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: fourth parties, Viertparteien, are in scope where they retain data, and where no contractual route to information exists the absence is itself the reportable item. TP-0042.3-F1 Aurora Object Storage Ltd in Dublin holds long-term log and telemetry archives for TP-0042.3 Polaris Telemetrix with a 24-month retention, and those archives contain payment reference metadata. CTR-2023-0117-A3 clause 3.4 obliges notice of subprocessor changes and is silent on the subcontractors of subprocessors, so there is no contractual basis on which Arcadia could demand the information this paragraph asks it to record. The honest statement is that this is a drafting gap in a 2023 agreement rather than a breach by anyone, and that it needs a contract variation rather than an escalation.",
    extractionConfidence: 0.63,
    theme: "outsourcing",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-TPR-6.2"],
    processIds: [],
    controlIds: [],
    isUnownedGap: true,
    gapNote:
      "No owner and no control. The Group Third-Party Risk Policy addresses subprocessors of a provider and stops there, so fourth parties sit outside the policy as well as outside the contract, which means no existing owner can be assigned without first extending the policy. Nothing in the control inventory tests the fourth-party layer and nothing in the third-party module records it. MSN-2026-0221 opens the fourth-party drafting gap as a contract variation with P-002, P-016 and P-010, which addresses the contract; it does not create the ongoing ownership this obligation would need. Extraction confidence is low at 0.63 because the paragraph's application to an archive holder that processes no payment instruction, and merely retains metadata about one, is genuinely arguable and should be argued rather than assumed.",
    ownerUserId: null,
    implementationPriority: "high",
    sortOrder: 4,
  },

  /*
   * The obligation the 14:05 event was waiting for. Paragraph 7 of the
   * national circular says an institution may not treat a control operated in
   * a third-party system as effective unless it can evidence the conditions
   * under which the system stops enforcing it, and says a provider statement
   * without the configuration is not sufficient. Arcadia obtained the
   * configuration at 15:38, twenty-three months after the rule arrived.
   */
  {
    id: "OBL-2026-0031-005",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0031-DE",
    paragraphReference: "Section A, paragraph 7",
    obligationText:
      "\"An institution shall not treat a control operated in a third-party system as effective unless it has established, and can evidence, how that system enforces the control, including the conditions under which the system does not enforce it. Evidence of the system's configuration obtained from the provider is sufficient for this purpose; a provider statement without the configuration is not.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: effectiveness of a control enforced by a supplier system requires evidence of the system's configuration, including its exemptions, and a supplier assurance on its own is not evidence. CTL-PAY-014 is a key control in the Internal Control System, Internes Kontrollsystem, and its description of 14.01.2025 states that independent secondary review applies to all overrides without exception. RD-RULE-0031 has created an exception since 11.11.2024. The configuration that proves it, EVD-2026-41905, was obtained on 06.10.2026 at 15:38, forty-seven minutes after the control owner asserted a mechanism that does not exist and twenty-three months after the rule entered the tenant. The second sentence of the paragraph is the operative one for the day: at 14:41 Arcadia had a statement, and at 15:38 it had the configuration, and only the second was evidence.",
    extractionConfidence: 0.93,
    theme: "operational-risk",
    candidateEntityIds: [ENTITY_DE],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-IKS-3.2", "POL-ORP-4.3"],
    processIds: ["PRC-0041"],
    controlIds: ["CTL-PAY-014"],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-004",
    implementationPriority: "critical",
    sortOrder: 5,
  },

  /*
   * Unowned gap. CHG-2024-5512 is the proof: an Arcadia change approval for a
   * supplier release that altered a key control gate, approved on release
   * notes about throughput, with no control owner named anywhere in the
   * record. Nothing in the change process requires one, so there is no owner
   * to assign.
   */
  {
    id: "OBL-2026-0031-006",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0031-DE",
    paragraphReference: "Section B, paragraph 11",
    obligationText:
      "\"Where an institution approves a change to a third-party system that supports a critical or important function, the approval record shall state which controls were examined for the effect of the change, and the statement shall be made by the owner of each control examined. An approval record that names no control owner shall be treated as an approval of an unassessed change.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: a supplier release affecting a critical or important function needs a control owner's statement in the approval record, and an approval record without one counts as an unassessed change. CHG-2024-5512 approved RepairDesk release 8.3 on 11.11.2024 on the basis of release notes describing continuity throughput improvements for fallback routing. No control was named, no control owner signed, and the release brought RD-RULE-0031 into the arcadia-prod tenant from Novalink template BCP-THROUGHPUT-v2. The same instrument's paragraph 10 says such release notes are not a sufficient basis for approval. The uncomfortable reading is that this obligation would have caught the rule in November 2024, and the comfortable reading, that the supplier should have disclosed it, is only half the answer.",
    extractionConfidence: 0.89,
    theme: "governance",
    candidateEntityIds: [ENTITY_DE],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-IKS-4.5", "POL-ORP-4.3"],
    processIds: ["PRC-0041"],
    controlIds: ["CTL-PAY-014"],
    isUnownedGap: true,
    gapNote:
      "No owner, because the obligation falls between three functions and is held by none of them. Technology owns the change record, Control Assurance owns the control conclusion, and the control owner sits in the first line in Munich; the change approval workflow in SYS-0031 has no field for a control owner statement, so there is nothing to assign an owner to until the workflow changes. MSN-2026-0215 removes the specific rule and MSN-2026-0220 re-tests the control population, and neither of them prevents the next supplier release from doing the same thing. This is the gap that makes the event a repeat rather than a one-off, and it needs an owner before it needs a remediation plan.",
    ownerUserId: null,
    implementationPriority: "critical",
    sortOrder: 6,
  },

  {
    id: "OBL-2026-0117-001",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0117-EU",
    paragraphReference: "Article 3(2)",
    obligationText:
      "\"The criteria are: the number of clients and financial counterparts affected and the relevance of those clients; the reputational impact; the duration of the incident and the service downtime; the geographical spread, including the number of Member States affected; the data losses, including losses of integrity, availability and confidentiality; the criticality of the services affected, including the entity's critical or important functions; and the economic impact, including direct and indirect costs and losses.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: seven classification criteria, each to be assessed and recorded including the ones that are not met. For INC-2026-0412 the ARC-DE and ARC-AT assessment ran against exactly these criteria at 15:20 and concluded provisionally at 15:47 that the event is significant but below the major-incident threshold on the facts available, recorded as DEC-2026-0774. Two criteria are unresolved rather than unmet: economic impact depends on the recall of PAY-DE-20261006-448127 and on the outcome of the full check of all 96 unreviewed overrides under MSN-2026-0214, and duration depends on a start time of 13:31 that Arcadia did not know until 15:51. Applicability and the conclusion are both human decisions and are not recorded here.",
    extractionConfidence: 0.9,
    theme: "reporting",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-4.1", "POL-RES-7.2"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-006",
    implementationPriority: "high",
    sortOrder: 7,
  },

  {
    id: "OBL-2026-0117-002",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0117-EU",
    paragraphReference: "Article 5(1)",
    obligationText:
      "\"An initial notification shall be submitted to the competent authority as soon as the financial entity has classified the incident as major, and in any event within the time limit published with these standards, followed by an intermediate report when the status of the incident changes significantly and a final report when the root cause analysis is complete.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: three reports on a clock that starts at classification, not at detection. Two operational consequences for Arcadia. First, the time of classification has to be recorded as a distinct fact from the time of detection and the time the incident began, which for INC-2026-0412 means three separate timestamps: 13:31, 14:07 and the classification time. Second, the final report depends on root cause analysis that Arcadia does not own: the Novalink report is due 13.10.2026 and the group standard has no provision for a final report that depends on a supplier deliverable. Whether any notification is required at all is the decision the Incident and Resilience Lead takes with Regulatory Change and Group Legal, and it is not recorded here.",
    extractionConfidence: 0.87,
    theme: "reporting",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-7.2"],
    processIds: [],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-006",
    implementationPriority: "high",
    sortOrder: 8,
  },

  /*
   * Unowned gap, and the one most likely to bite next week. Both provisional
   * classifications say they will be re-run when the supplier report arrives on
   * 13.10.2026. Nothing owns the re-run, no diary entry exists for it, and the
   * report lands on the morning of the committee.
   */
  {
    id: "OBL-2026-0117-003",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0117-EU",
    paragraphReference: "Article 7(4)",
    obligationText:
      "\"Where information that was not available at the time of classification subsequently becomes available, the financial entity shall repeat the classification and shall record both the original and the repeated conclusion. Neither conclusion is deleted, and a change between them is itself a reportable fact.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: a provisional classification creates a second obligation, to repeat it, and the change between the two conclusions is itself reportable. DEC-2026-0774 for ARC-DE and ARC-AT is expressly provisional and states that it must be re-run on receipt of the Novalink report due 13.10.2026. Article 7(3) of the same instrument requires a named person accountable for completing each provisional classification. Arcadia's group incident classification standard has no re-assessment trigger, no diary mechanism and no accountable role for the second run, so the obligation to repeat currently depends on somebody remembering on the morning of the committee.",
    extractionConfidence: 0.82,
    theme: "reporting",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-7.2", "POL-RES-4.1"],
    processIds: [],
    controlIds: [],
    isUnownedGap: true,
    gapNote:
      "No owner for the second run. P-006 owns the regulatory change item and P-005 owns the incident, and neither owns the obligation to repeat a classification that has already been recorded, because the group incident classification standard treats classification as a single event. There is no control, no diary entry and no workflow state for a provisional classification awaiting completion, which means the two provisional records DEC-2026-0774 and DEC-2026-0775 currently depend on recall rather than on process. The exposure has a date on it: the Novalink report is due 13.10.2026, the same morning as CMT-NFR-2026-10, which is the least likely morning for anyone to notice that a classification needs re-running.",
    ownerUserId: null,
    implementationPriority: "critical",
    sortOrder: 9,
  },

  /*
   * Conflict D, written down by a regulator before it happened. Paragraph 6 of
   * the consultation says a tolerance with more than one measure must state
   * which measure governs. ITOL-0004-03 has two measures and states nothing,
   * and at 16:04 on 06.10.2026 they gave opposite answers. The consultation
   * closes 23.10.2026, ten days after the committee that has to decide.
   */
  {
    id: "OBL-2026-0104-001",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0104-EU",
    paragraphReference: "Chapter 1, paragraph 6",
    obligationText:
      "\"An impact tolerance shall be expressed by a single measure, or, where more than one measure is used, the instrument shall state which measure governs where the measures give different answers. An institution that cannot state which measure governs cannot conclude whether its tolerance was breached, and shall report that as a defect in the tolerance rather than as an inconclusive incident.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: multiple measures are permitted and silence on precedence is not. The second sentence tells the institution what to do when it is already too late, which is to report the defect rather than the ambiguity. ITOL-0004-03 for ARC-CH carries two measures, a 2-hour maximum tolerable disruption and completion of submission before the 16:00 CET cut-off, with no precedence stated. On 06.10.2026 measure 1 says not breached, at 15:58 against a 16:00 cut-off, and measure 2 says breached by 11 minutes, 2 hours 11 minutes against a 2-hour maximum. ITOL-0004-01, ITOL-0004-02 and ITOL-0004-04 should each be read against this paragraph for the same defect, which is what MSN-2026-0219 requires by 13.10.2026 for the recommendation. Note the lane: this is the EU-lane instrument, and the ARC-CH tolerance it happens to illuminate sits under the Swiss framework, so the candidate entities here are the EU entities and the Swiss position must be reached separately under REG-2026-0104-CH.",
    extractionConfidence: 0.86,
    theme: "resilience",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-2.4"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-005",
    implementationPriority: "critical",
    sortOrder: 10,
  },

  {
    id: "OBL-2026-0104-002",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0104-EU",
    paragraphReference: "Chapter 2, paragraph 9",
    obligationText:
      "\"Measurement of tolerance consumption shall not begin at the point of detection, and an institution shall not present a consumption figure measured from detection as a consumption figure measured from the start of the disruption. The two differ by the institution's own blindness and the difference is informative.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: consumption runs from the point at which the service stopped being delivered normally, and the gap between that point and detection is a finding in its own right. For INC-2026-0412 the difference is 36 minutes: the disruption began at 13:31 and Arcadia detected it at 14:07. Against ITOL-0004-01's 4-hour window for same-day EUR submission, measuring from detection would understate consumption by 15% of the tolerance (scenario figure). Paragraph 8 of the same chapter says that where knowledge of the start depends on third-party notification, the interval is a resilience finding against the arrangement, which is precisely the 34-minute detection lag caused by TP-0042.3 monitoring pinned to the failed region and is the subject of MSN-2026-0218.",
    extractionConfidence: 0.9,
    theme: "resilience",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-2.4"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-005",
    implementationPriority: "high",
    sortOrder: 11,
  },

  /*
   * Unowned gap. The exit plan assumes Arcadia can run a payment repair queue
   * on an internal tool, and Arcadia has no such tool, so Appendix A6 is
   * unexecutable as written. Nobody owns exit testing: TPRM owns the
   * assessment, the business owns the process, and the capability nobody owns
   * is the one the plan depends on.
   */
  {
    id: "OBL-2026-0104-003",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0104-EU",
    paragraphReference: "Chapter 3, paragraph 13",
    obligationText:
      "\"Where an important business service depends on a provider for which no substitution has been tested, the institution shall test the substitution or shall record, with the accountable executive named, that it has accepted the dependency untested. An exit or substitution plan that assumes an internal capability the institution does not hold is not a plan, and the institution shall say so in terms.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: either test the substitution or name the executive who accepted the dependency untested, and do not count a plan that relies on a capability the institution does not have. IBS-0004 Corporate Payments depends on TP-0042 for payment validation, payment repair tooling and Swiss clearing connectivity, with a concentration flag and a substitutability assessment of 30.06.2025 concluding 12 to 18 months with material programme cost and no test performed. CTR-2023-0117-A6 version 2.0 dates from 01.09.2023, has never been tested, and assumes Arcadia can operate a payment repair queue on an internal tool that does not exist, which is the open point in TPRM-Q-2026-R11. KRI-RES-005, important business services with tested fallback arrangements, stands at 78% against an 80% amber floor (scenario figures).",
    extractionConfidence: 0.79,
    theme: "resilience",
    candidateEntityIds: [ENTITY_DE, ENTITY_AT],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-2.4", "POL-TPR-3.1"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: true,
    gapNote:
      "No owner for exit and substitution testing anywhere in the operating model. P-002 owns the supplier assessment and records that no test has been performed, P-007 owns the process and has no budget line for building an internal repair capability, and P-005 owns resilience testing for services rather than for exit plans. The result is that TPRM-Q-2026-R11 has been open since 15.09.2026 with a correct answer and no addressee. The second limb of the paragraph is also unsatisfied: no executive has recorded acceptance of the dependency untested, so Arcadia has neither the test nor the named acceptance. This one is a governance design gap rather than a remediation item, and it belongs in front of the committee as such.",
    ownerUserId: null,
    implementationPriority: "high",
    sortOrder: 12,
  },

  /*
   * This is the row where the EU answer and the Swiss answer genuinely differ,
   * and it is why the product keeps two inventories instead of one. Same
   * subject matter as OBL-2026-0031-001: know your supply chain and record it.
   * Different instrument, different scope, different unit of account, different
   * addressee. The Swiss inventory is built per outsourced function at the
   * level of the Swiss bank and includes a substitutability assessment the EU
   * register does not ask for; the EU register reaches every ICT arrangement
   * and does not ask for substitutability. Neither extends to the other's
   * entities, and a single group answer would be wrong twice.
   */
  {
    id: "OBL-2026-0088-001",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0088",
    paragraphReference: "Margin number 6",
    obligationText:
      "\"The bank shall maintain an inventory of its significant outsourcings which states, for each outsourcing, the function outsourced, the provider, the subcontractors engaged in performing it, the places from which the service is performed, and the bank's assessment of substitutability. The inventory shall be maintained at the level of the Swiss bank and shall be capable of being produced on request.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: ARC-CH maintains its own inventory of significant outsourcings, at entity level, including substitutability. This is the obligation where the EU and Swiss answers diverge and the divergence is substantive rather than cosmetic. The EU register of information under REG-2026-0031-EU covers every ICT third-party arrangement for ARC-DE and ARC-AT, is organised by arrangement, and does not require a substitutability assessment. This Swiss inventory covers significant outsourcings of ARC-CH only, is organised by outsourced function, requires substitutability, and requires the places from which the service is performed. The two instruments therefore produce two inventories with different populations, different fields and different owners. ARC-CH has SVC-0042-02 for the Swiss RepairDesk instance and SVC-0042-05 for the SIC and euroSIC adapter classified as significant outsourcing, wesentliche Auslagerung, with TP-0042.1 Helvetia CloudWorks AG in Zurich as the hosting subcontractor. Neither instrument extends to the other's entities and a single group inventory maintained for one of them does not satisfy the other. REG-2026-0088 is in progress at entity level with P-006 and P-015.",
    extractionConfidence: 0.9,
    theme: "outsourcing",
    candidateEntityIds: [ENTITY_CH],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-TPR-6.2", "POL-TPR-3.1", "POL-REG-2.1"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-006",
    implementationPriority: "high",
    sortOrder: 13,
  },

  /*
   * Unowned gap, Swiss lane. Meridian holds read access to payment metadata
   * including beneficiary name and reference fields, from Pune, unnotified,
   * onboarded 01.05.2026. Nobody at ARC-CH can currently state what
   * client-identifying data is reachable from outside Switzerland, which
   * margin number 13 of the same circular says is itself the deficiency.
   */
  {
    id: "OBL-2026-0088-002",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0088",
    paragraphReference: "Margin number 11",
    obligationText:
      "\"Where a subcontractor is able to access client-identifying data from outside Switzerland, the bank shall satisfy itself that the access is necessary for the performance of the outsourced function, that the data categories accessible are known and documented, and that the disclosure is permissible under the applicable data protection requirements, and shall record the assessment together with the date on which it was made and the person who made it.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: three tests, necessity, documented data categories and permissibility of the cross-border disclosure, plus a dated assessment with a named author. TP-0042.4 Meridian Operations Support Pvt Ltd provides level 1 service desk and out-of-hours monitoring for NOVA-GATE and RepairDesk from Pune, holds read access to payment metadata including beneficiary name and reference fields, was onboarded by Novalink on 01.05.2026, is absent from the binding appendix CTR-2023-0117-A3 version 4.2, and has no notice on record. Margin number 12 adds that technical ability to access is treated as access and that a provider statement that the access is unexercised is recorded as a statement, not as a mitigation. Margin number 13 adds that an inability to state which client-identifying data is reachable from abroad is itself a deficiency. ARC-CH cannot currently make that statement.",
    extractionConfidence: 0.85,
    theme: "outsourcing",
    candidateEntityIds: [ENTITY_CH],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-TPR-6.2"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: true,
    gapNote:
      "No owner and no record. The Meridian access question was opened on 06.10.2026 under REG-2026-0088 and has no assigned owner at ARC-CH: P-002 owns the group third-party relationship and is an ARC-DE employee acting under an intragroup arrangement, P-015 owns Swiss resilience rather than Swiss data access, and no ARC-CH role currently holds accountability for cross-border data access by a provider's subcontractors. No control tests it and no inventory field records it, so the bank cannot produce the dated, authored assessment that margin number 11 requires, nor the statement that margin number 13 requires. MSN-2026-0221 escalates the notice failure under CTR-2023-0117-A3 clause 3.4, which is a contractual route and not an answer to this obligation. The Swiss position must be reached on the Swiss framework alone and must not be inferred from whatever the EU entities decide about the same subcontractor.",
    ownerUserId: null,
    implementationPriority: "critical",
    sortOrder: 14,
  },

  {
    id: "OBL-2026-0088-003",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0088",
    paragraphReference: "Margin number 15",
    obligationText:
      "\"The rights secured under margin number 14 shall extend to subcontractors participating in the performance of a significant outsourcing, and the bank shall be able to demonstrate that the rights are exercisable in practice and not only in the text of the agreement. Where the agreement is silent on the subcontractors of subcontractors, the gap is recorded as such.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: audit and supervisory access must reach the subcontractors and must be demonstrably exercisable, and silence on onward subcontracting is recorded as a gap rather than assumed away. CTR-2023-0117-A4 version 1.0 of 01.09.2023 carries audit and access rights including supervisory authority access for the EU entities and FINMA access for ARC-CH, and clause 2.1 gives Arcadia the right to configuration and audit-trail extracts within 4 hours for incident purposes. That right was exercised for the first time on 06.10.2026 and worked: EVD-2026-41905 arrived within the window, which is the demonstration this margin number asks for and is worth recording as a positive. What is not demonstrated is that the rights reach TP-0042.1 Helvetia CloudWorks AG, and Appendix A4 is silent on the subcontractors of subprocessors, which the second sentence requires to be recorded as a gap.",
    extractionConfidence: 0.88,
    theme: "governance",
    candidateEntityIds: [ENTITY_CH],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-TPR-6.2", "POL-TPR-8.1"],
    processIds: [],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-002",
    implementationPriority: "medium",
    sortOrder: 15,
  },

  {
    id: "OBL-2026-0104-004",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0104-CH",
    paragraphReference: "Margin number 5",
    obligationText:
      "\"The bank identifies its critical business processes, determines a tolerance for disruption for each of them, and demonstrates its ability to restore the process within that tolerance. Demonstration is based on exercise or on evidenced experience, and not on the existence of documentation alone.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: identification, a tolerance, and a demonstration that is based on exercise or on experience rather than on paperwork. The Swiss framing differs from the EU framing in the protected object: this instrument protects critical business processes at the bank, while the EU lane protects important business services, so ARC-CH designates IBS-0004 Corporate Payments as a significant business process under its own framework rather than inheriting the group designation. ITOL-0004-03 is the tolerance, set by the ARC-CH Board Risk Committee and last reviewed 24.02.2026. The demonstration limb is now satisfiable in an uncomfortable way: on 06.10.2026 ARC-CH restored submission through the manual correspondent route under RB-PAY-011, which is evidenced experience, and the same experience showed elapsed disruption of 2 hours 11 minutes against a 2-hour tolerance. Evidenced experience that demonstrates the tolerance cannot be met is still evidenced experience and should be reported as such.",
    extractionConfidence: 0.89,
    theme: "resilience",
    candidateEntityIds: [ENTITY_CH],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-2.4"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-005",
    implementationPriority: "high",
    sortOrder: 16,
  },

  {
    id: "OBL-2026-0104-005",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0104-CH",
    paragraphReference: "Margin number 9",
    obligationText:
      "\"Where a critical business process depends on a service for which no substitute route has been tested, the bank shall document the dependency, the alternative arrangement if any, and the time required to invoke it, and shall keep that time under review. The bank shall not treat a documented alternative as available for the purpose of margin number 5 until the time required to invoke it has been established.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: document the dependency, the alternative and the invocation time, and do not count an alternative as available until the time is established. ARC-CH is partly compliant in substance and the record is worth reading carefully. The dependency is documented, the alternative is RB-PAY-011 manual submission through a correspondent, and the invocation time of 45 minutes is documented in the runbook. What was never established, until 06.10.2026, was whether the documented 45 minutes was real. It was: preparation took exactly 45 minutes. Margin number 11 requires the dependency documentation to be reviewed after each invocation and the finding recorded, which now applies. Margin number 10 is the sharper one for this arrangement: it requires the bank to record the controls that operate in the automated path and not in the manual one, and the SYS-0015 format validation absent from the manual path produced the two CHF 14,200 rejections.",
    extractionConfidence: 0.83,
    theme: "resilience",
    candidateEntityIds: [ENTITY_CH],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-2.4", "POL-TPR-3.1"],
    processIds: ["PRC-0041"],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-015",
    implementationPriority: "high",
    sortOrder: 17,
  },

  /*
   * The Swiss counterpart to OBL-2026-0117-002 and -003. Same subject matter,
   * different threshold (substantial importance rather than major), different
   * addressee, separate determination. DEC-2026-0775 was reached under this
   * expectation at 15:52 and DEC-2026-0774 under the EU standard at 15:47,
   * five minutes apart and deliberately never merged.
   */
  {
    id: "OBL-2026-0104-006",
    runId: DEFAULT_RUN_ID,
    publicationId: "REG-2026-0104-CH",
    paragraphReference: "Margin number 14",
    obligationText:
      "\"The bank shall report incidents of substantial importance to the supervisory authority without delay, shall state the basis on which the determination was made, and shall repeat the assessment where further information subsequently becomes available. A determination taken on incomplete information is recorded as provisional and the missing information is identified.\" Illustrative regulatory context, not legal advice.",
    extractedSummary:
      "Extraction summary: the Swiss reporting test is substantial importance, the trigger is without delay rather than a published time limit running from classification, and the addressee and the determination are the bank's own. This is the same subject matter as the EU classification and reporting standard and it is not the same obligation, which is why INC-2026-0412 produced two records five minutes apart: DEC-2026-0774 for ARC-DE and ARC-AT against the EU criteria at 15:47, and DEC-2026-0775 for ARC-CH against this expectation at 15:52. Both are provisional, both identify the missing information as the Novalink report due 13.10.2026, and neither may be presented as a group conclusion. Margin number 15 requires a named person accountable for the determination and for repeating it, and requires the outstanding supplier report and its expected date to be identified; the ARC-CH local standard names P-015 with P-005 and P-006 for the determination and is silent on who repeats it.",
    extractionConfidence: 0.86,
    theme: "reporting",
    candidateEntityIds: [ENTITY_CH],
    applicabilityDecision: null,
    applicabilityRationale: null,
    decidedByUserId: null,
    decidedOn: null,
    policyIds: ["POL-RES-7.2", "POL-REG-2.1"],
    processIds: [],
    controlIds: [],
    isUnownedGap: false,
    gapNote: "",
    ownerUserId: "P-006",
    implementationPriority: "critical",
    sortOrder: 18,
  },
];
