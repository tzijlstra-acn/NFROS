/**
 * Case analyses: what changed in a review, and what to do next on a case.
 *
 * "What changed since last quarter" compares Q3 with Q2 2026 for the payment
 * service and its supplier, Novalink: the risk score, the incidents, the
 * indicators, the controls and the evidence. The change in the score is
 * attributed to the recorded drivers with fixed weights, and whatever those
 * weights do not explain is shown as its own step rather than hidden.
 *
 * "What should I do next" reads the role's highest-priority open decision at
 * the current moment and lays out its timeline, its evidence position and the
 * governed steps around it. The decision itself stays with the person.
 */

import type { InsightEvidence, InsightFinding, InsightRecommendation, InsightResponseInput, Tone } from "../schema";
import { daysBetween, formatDate, personName } from "../data";
import { controlProfiles } from "./controls";
import { partyTrends } from "./third-parties";
import {
  decisionsHref,
  documentEvidence,
  plural,
  recordHref,
  registerEvidence,
  requestEvidenceProposal,
  sum,
  tx,
  workHref,
  type BuildContext,
} from "./common";

const Q2 = ["2026-04", "2026-05", "2026-06"];
const Q3 = ["2026-07", "2026-08", "2026-09"];
const PAYMENT_KRIS = ["KRI-PAY-007", "KRI-PAY-003", "KRI-PAY-011", "KRI-PAY-016", "KRI-PAY-022", "KRI-RES-005", "KRI-TPR-002"];

/* Attribution weights, in score points per unit of each recorded driver. */
const WEIGHTS = { incident: 2, slaBreach: 1.5, redKri: 1.5, controlException: 1.5, staleAssurance: 4 };

export function buildPaymentReviewChange(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const supplierId = "TP-0042";
  const metrics = data.metrics.filter((row) => row.thirdPartyId === supplierId);
  const at = (period: string) => metrics.find((row) => row.period === period);
  const startScore = at("2026-06")?.riskScore ?? 0;
  const endScore = at("2026-09")?.riskScore ?? 0;
  const incidentsQ2 = sum(Q2.map((period) => at(period)?.incidents ?? 0));
  const incidentsQ3 = sum(Q3.map((period) => at(period)?.incidents ?? 0));
  const slaQ2 = sum(Q2.map((period) => at(period)?.slaBreaches ?? 0));
  const slaQ3 = sum(Q3.map((period) => at(period)?.slaBreaches ?? 0));

  const kriRows = PAYMENT_KRIS.map((id) => {
    const series = data.kriSeries.get(id) ?? [];
    const june = series.find((point) => point.period === "2026-06");
    const september = series.find((point) => point.period === "2026-09");
    const kri = data.kris.find((entry) => entry.id === id);
    return { id, name: lang === "de" && kri?.nameDe ? kri.nameDe : (kri?.name ?? id), unit: kri?.unit ?? "", june, september };
  });
  const redJune = kriRows.filter((row) => row.june?.status === "red").length;
  const redSeptember = kriRows.filter((row) => row.september?.status === "red").length;

  /* Only controls tested in both quarters: an untested Q3 has no exceptions yet, which is not an improvement. */
  const profiles = controlProfiles(context).filter(
    (profile) =>
      profile.id.startsWith("CTL-PAY") &&
      profile.results.get("2026-Q2")?.result !== "not-tested" &&
      profile.results.get("2026-Q3")?.result !== "not-tested",
  );
  const exceptionsQ2 = sum(profiles.map((profile) => profile.results.get("2026-Q2")?.exceptions ?? 0));
  const exceptionsQ3 = sum(profiles.map((profile) => profile.results.get("2026-Q3")?.exceptions ?? 0));
  const staleNow = at("2026-09")?.assuranceStatus === "stale";
  const staleThen = at("2026-06")?.assuranceStatus === "stale";

  const contributions = [
    { id: "incidents", label: L("Incidents", "Vorfaelle"), value: Math.round((incidentsQ3 - incidentsQ2) * WEIGHTS.incident) },
    { id: "sla", label: L("Service level breaches", "Service-Level-Verletzungen"), value: Math.round((slaQ3 - slaQ2) * WEIGHTS.slaBreach) },
    { id: "kris", label: L("Indicators turning red", "Indikatoren auf Rot"), value: Math.round((redSeptember - redJune) * WEIGHTS.redKri) },
    { id: "controls", label: L("Control exceptions", "Kontrollausnahmen"), value: Math.round((exceptionsQ3 - exceptionsQ2) * WEIGHTS.controlException * 0.5) },
    { id: "assurance", label: L("Assurance gone stale", "Pruefnachweis veraltet"), value: staleNow && !staleThen ? WEIGHTS.staleAssurance : 0 },
  ];
  const explained = sum(contributions.map((entry) => entry.value));
  const other = endScore - startScore - explained;
  const largest = [...contributions].sort((a, b) => b.value - a.value)[0];

  const issuesQ3 = data.issues.filter((issue) => issue.raisedOn >= "2026-07-01" && ((issue.supplierIds ?? []).includes(supplierId) || (issue.controlIds ?? []).some((id) => id.startsWith("CTL-PAY"))));
  const novalinkIncidents = data.incidents.filter((incident) => incident.supplierIds.includes(supplierId) && incident.detectedAt >= "2026-07-01");
  const acceptance = data.acceptances.find((row) => row.subjectId === supplierId && row.riskId === "RSK-0184");
  const staleDocs = data.evidence.filter((document) => document.isStale && (document.relatedObjectIds ?? []).some((id) => id === supplierId || id.startsWith("SVC-0042") || id === "IBS-0004"));

  const evidence: InsightEvidence[] = [
    registerEvidence("tpm-TP-0042", L("Monthly performance, Novalink", "Monatliche Leistung, Novalink"), "TPM-TP-0042-2026-09", "30.09.2026", L(`Risk score ${startScore} in June, ${endScore} in September; incidents ${incidentsQ2} in Q2, ${incidentsQ3} in Q3.`, `Risikowert ${startScore} im Juni, ${endScore} im September; Vorfaelle ${incidentsQ2} in Q2, ${incidentsQ3} in Q3.`), {
      sourceType: L("Third-party register", "Drittparteienregister"),
      href: workHref(roleId, supplierId),
    }),
    ...kriRows.filter((row) => row.september?.status === "red").map((row) =>
      registerEvidence(`kri-${row.id}`, row.name, row.id, "30.09.2026", L(`${row.june?.value ?? "n/a"} in June, ${row.september?.value ?? "n/a"} in September, ${row.unit}.`, `${row.june?.value ?? "n/a"} im Juni, ${row.september?.value ?? "n/a"} im September, ${row.unit}.`), {
        sourceType: L("Indicator readings", "Indikatorwerte"),
        href: workHref(roleId, row.id),
      }),
    ),
    ...novalinkIncidents.slice(0, 6).map((incident) =>
      registerEvidence(`inc-${incident.id}`, lang === "de" ? incident.titleDe : incident.title, incident.reference, formatDate(incident.detectedAt), incident.description, {
        sourceType: L("Incident record", "Vorfallsdatensatz"),
        href: workHref(roleId, incident.id),
      }),
    ),
    ...staleDocs.slice(0, 4).map((document) => documentEvidence(context, document.id)).filter((entry): entry is InsightEvidence => entry !== null),
  ];

  const findings: InsightFinding[] = [
    {
      id: "finding-score",
      severity: endScore - startScore >= 20 ? "critical" : "warning",
      title: L(`Novalink's risk score rose ${endScore - startScore} points in the quarter`, `Der Risikowert von Novalink stieg im Quartal um ${endScore - startScore} Punkte`),
      detail: L(
        `${incidentsQ3} incidents against ${incidentsQ2} in Q2, ${slaQ3} service level breaches against ${slaQ2}, and the recovery evidence went stale after the 22.05.2026 test.`,
        `${incidentsQ3} Vorfaelle gegen ${incidentsQ2} in Q2, ${slaQ3} Service-Level-Verletzungen gegen ${slaQ2}, und der Wiederherstellungsnachweis ist seit dem Test vom 22.05.2026 veraltet.`,
      ),
      evidenceIds: ["tpm-TP-0042"],
    },
    {
      id: "finding-kris",
      severity: "critical",
      title: L(`${redSeptember} payment indicators are red, against ${redJune} in June`, `${redSeptember} Zahlungsindikatoren sind rot, gegenueber ${redJune} im Juni`),
      detail: kriRows
        .filter((row) => row.september?.status === "red")
        .map((row) => `${row.id} ${row.june?.value ?? "n/a"} to ${row.september?.value ?? "n/a"}`)
        .join("; "),
      evidenceIds: kriRows.filter((row) => row.september?.status === "red").map((row) => `kri-${row.id}`),
    },
    {
      id: "finding-issues",
      severity: "warning",
      title: L(`${plural(issuesQ3.length, "issue was", "issues were")} raised since July`, `${issuesQ3.length} Feststellungen seit Juli erfasst`),
      detail: issuesQ3.slice(0, 6).map((issue) => `${issue.id} (${issue.severity})`).join(", "),
      evidenceIds: [],
    },
  ];
  if (acceptance) {
    findings.push({
      id: "finding-acceptance",
      severity: acceptance.conditionsMet ? "watch" : "critical",
      title: L(`The risk acceptance expires ${formatDate(acceptance.expiresOn)} on an unmet condition`, `Die Risikoakzeptanz laeuft am ${formatDate(acceptance.expiresOn)} bei unerfuellter Bedingung ab`),
      detail: `${acceptance.reference}: ${acceptance.conditions}`,
      evidenceIds: [],
      href: recordHref(roleId, "risk-acceptances", acceptance.id),
    });
  }

  const recommendations: InsightRecommendation[] = [
    {
      id: "rec-decision",
      title: L("Carry these changes into today's criticality decision", "Diese Aenderungen in die heutige Kritikalitaetsentscheidung einbringen"),
      rationale: L("The quarter's evidence bears directly on whether Novalink's criticality position holds. The decision is open and yours.", "Die Nachweise des Quartals betreffen direkt, ob die Kritikalitaetseinstufung von Novalink haelt. Die Entscheidung ist offen und liegt bei Ihnen."),
      urgency: "now",
      href: decisionsHref(roleId),
    },
    {
      id: "rec-pentest",
      title: L("Request the full penetration test report", "Den vollstaendigen Penetrationstestbericht anfordern"),
      rationale: L("Novalink released a two-page summary whose scope does not say whether the override interfaces were tested.", "Novalink gab eine zweiseitige Zusammenfassung heraus, deren Umfang offenlaesst, ob die Uebersteuerungsschnittstellen getestet wurden."),
      urgency: "this-week",
      proposedAction: requestEvidenceProposal(context, {
        id: "act-pentest",
        what: L("Full June 2026 penetration test report, including scope for the RepairDesk override and approval interfaces", "Vollstaendiger Penetrationstestbericht Juni 2026 einschliesslich Umfang fuer die RepairDesk-Uebersteuerungs- und Freigabeschnittstellen"),
        fromUserId: "P-011",
        fromLabel: `${personName(data, "P-011")}, Novalink`,
        dueInDays: 10,
        relatedKind: "supplier",
        relatedId: supplierId,
        relatedLabel: "Novalink Payment Services GmbH",
        rationale: L("The summary on file is silent on the interfaces the control depends on.", "Die vorliegende Zusammenfassung schweigt zu den Schnittstellen, von denen die Kontrolle abhaengt."),
        evidenceIds: staleDocs.slice(0, 2).map((document) => `doc-${document.id}`),
      }),
    },
  ];

  const timelineEvents = [
    ...novalinkIncidents.map((incident) => ({ id: incident.id, lane: "incidents", date: incident.detectedAt.slice(0, 10), label: incident.reference, tone: (incident.severity === "S2" || incident.proposedSeverity === "S1" ? "critical" : "warning") as Tone, href: workHref(roleId, incident.id) })),
    ...issuesQ3.map((issue) => ({ id: issue.id, lane: "issues", date: issue.raisedOn.slice(0, 10), label: issue.id.replace("ISS-2026-", "ISS "), tone: (issue.severity === "high" ? "warning" : "watch") as Tone, href: workHref(roleId, issue.id) })),
    ...staleDocs.slice(0, 4).map((document) => ({ id: document.id, lane: "evidence", date: document.documentDate.slice(0, 10), label: document.id.replace("EVD-2026-", "EVD "), tone: "watch" as Tone, href: workHref(roleId, document.id) })),
    ...(acceptance ? [{ id: acceptance.id, lane: "decisions", date: acceptance.expiresOn, label: L(`${acceptance.reference} expires`, `${acceptance.reference} Ablauf`), tone: "critical" as Tone, href: recordHref(roleId, "risk-acceptances", acceptance.id) }] : []),
  ];

  return {
    version: 1,
    intentId: "payment-review-change",
    question: context.question,
    title: L("Payment service review: what changed since Q2", "Review des Zahlungsservices: was sich seit Q2 geaendert hat"),
    conclusion: L(
      `Since Q2, Novalink's risk score rose from ${startScore} to ${endScore}, incidents went from ${incidentsQ2} to ${incidentsQ3}, and ${redSeptember} payment indicators are red against ${redJune}.`,
      `Seit Q2 stieg der Risikowert von Novalink von ${startScore} auf ${endScore}, die Vorfaelle von ${incidentsQ2} auf ${incidentsQ3}, und ${redSeptember} Zahlungsindikatoren sind rot gegenueber ${redJune}.`,
    ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L("Corporate Payments (IBS-0004) and its supplier Novalink (TP-0042)", "Corporate Payments (IBS-0004) und Dienstleister Novalink (TP-0042)"),
    plan: {
      using: [L("Third-party register", "Drittparteienregister"), L("Incident records", "Vorfallsdatensaetze"), L("Indicator readings", "Indikatorwerte"), L("Control test results", "Kontrolltestergebnisse"), L("Evidence documents", "Nachweisdokumente"), L("Risk acceptance register", "Register der Risikoakzeptanzen")],
      timeWindow: L("Q3 2026 against Q2 2026", "Q3 2026 gegen Q2 2026"),
      groupedBy: L("Driver of change", "Treiber der Veraenderung"),
      output: L("Attribution, timeline and indicator comparison", "Zuordnung, Zeitachse und Indikatorvergleich"),
    },
    confidence: {
      level: "medium",
      explanation: L(
        "The figures are exact. The attribution of the score change uses fixed weights per driver; what they do not explain is shown as its own step.",
        "Die Zahlen sind exakt. Die Zuordnung der Veraenderung nutzt feste Gewichte je Treiber; der unerklaerte Rest erscheint als eigener Schritt.",
      ),
    },
    metrics: [
      { id: "m-score", label: L("Risk score", "Risikowert"), value: endScore, delta: endScore - startScore, deltaLabel: L("since June", "seit Juni"), status: endScore >= 65 ? "critical" : "warning" },
      { id: "m-incidents", label: L("Incidents in Q3", "Vorfaelle in Q3"), value: incidentsQ3, delta: incidentsQ3 - incidentsQ2, deltaLabel: L("against Q2", "gegen Q2"), status: "critical" },
      { id: "m-kris", label: L("Indicators red", "Indikatoren rot"), value: redSeptember, delta: redSeptember - redJune, deltaLabel: L("since June", "seit Juni"), status: redSeptember ? "critical" : "good" },
      { id: "m-issues", label: L("Issues raised since July", "Feststellungen seit Juli"), value: issuesQ3.length, status: "warning" },
      { id: "m-stale", label: L("Stale evidence", "Veraltete Nachweise"), value: staleDocs.length, status: staleDocs.length ? "watch" : "good" },
    ],
    visualisations: [
      {
        id: "viz-waterfall",
        type: "waterfall",
        title: largest
          ? L(`${largest.label} account for the largest step, ${largest.value} of the ${endScore - startScore} points`, `${largest.label} sind der groesste Schritt, ${largest.value} der ${endScore - startScore} Punkte`)
          : L(`The score moved ${endScore - startScore} points`, `Der Wert bewegte sich um ${endScore - startScore} Punkte`),
        subtitle: L("Change in Novalink's risk score from June to September, by recorded driver", "Veraenderung des Risikowerts von Juni bis September, nach erfasstem Treiber"),
        explanation: L(
          "The first bar is June's score and the last September's. Each step between is one recorded driver, weighted; the step marked other is what the weights do not explain.",
          "Der erste Balken ist der Wert im Juni, der letzte im September. Jeder Schritt dazwischen ist ein erfasster Treiber, gewichtet; der Schritt Sonstiges ist der unerklaerte Rest.",
        ),
        unit: L("points", "Punkte"),
        steps: [
          { id: "start", label: L("June", "Juni"), value: startScore, kind: "start", tone: "neutral" },
          ...contributions.filter((entry) => entry.value !== 0).map((entry) => ({ id: entry.id, label: entry.label, value: entry.value, kind: "delta" as const, tone: (entry.value > 0 ? "warning" : "good") as Tone })),
          ...(other !== 0 ? [{ id: "other", label: L("Other", "Sonstiges"), value: other, kind: "delta" as const, tone: "neutral" as Tone }] : []),
          { id: "end", label: L("September", "September"), value: endScore, kind: "end", tone: endScore >= 65 ? "critical" : "warning" },
        ],
      },
      {
        id: "viz-timeline",
        type: "timeline",
        title: L(`${novalinkIncidents.length} incidents and ${issuesQ3.length} issues from July to today; the acceptance ends at year end`, `${novalinkIncidents.length} Vorfaelle und ${issuesQ3.length} Feststellungen von Juli bis heute; die Akzeptanz endet zum Jahresende`),
        subtitle: L("What happened on the case, by kind", "Was im Fall geschah, nach Art"),
        start: "2026-05-01",
        end: "2026-12-31",
        today: data.scope.today,
        lanes: [
          { id: "incidents", label: L("Incidents", "Vorfaelle") },
          { id: "issues", label: L("Issues", "Feststellungen") },
          { id: "evidence", label: L("Stale evidence", "Veraltete Nachweise") },
          { id: "decisions", label: L("Acceptance", "Akzeptanz") },
        ],
        events: timelineEvents.length > 0 ? timelineEvents : [{ id: "today", lane: "decisions", date: data.scope.today, label: L("Today", "Heute"), tone: "neutral" }],
      },
      {
        id: "viz-kris",
        type: "table",
        title: L(`${redSeptember} of ${kriRows.length} payment indicators are red now`, `${redSeptember} von ${kriRows.length} Zahlungsindikatoren sind jetzt rot`),
        columns: [
          { id: "kri", label: L("Indicator", "Indikator") },
          { id: "june", label: L("June", "Juni"), align: "end" },
          { id: "september", label: L("September", "September"), align: "end" },
          { id: "status", label: L("Status", "Status") },
        ],
        rows: kriRows.map((row) => ({
          id: row.id,
          cells: { kri: `${row.id} ${row.name}`.slice(0, 90), june: row.june?.value ?? null, september: row.september?.value ?? null, status: row.september?.status ?? "n/a" },
          tone: (row.september?.status === "red" ? "critical" : row.september?.status === "amber" ? "watch" : "good") as Tone,
          href: workHref(roleId, row.id),
        })),
      },
    ],
    findings,
    evidence: evidence.slice(0, 40),
    recommendations,
    followUps: [
      { label: L("Next action", "Naechster Schritt"), question: L("What action should I take on the current case?", "Welchen Schritt sollte ich im aktuellen Fall gehen?") },
      { label: L("Who else is deteriorating", "Wer verschlechtert sich noch"), question: L("Which critical third-party services are deteriorating, and why?", "Welche kritischen Drittparteien-Services verschlechtern sich, und warum?") },
      { label: L("Failing controls", "Versagende Kontrollen"), question: L("Which controls are repeatedly failing?", "Welche Kontrollen versagen wiederholt?") },
    ],
  };
}

/* ==========================================================================
   What action should I take on the current case?
   ========================================================================== */

export function buildCaseNextAction(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const open = data.decisions.filter((decision) => decision.status === "open");
  const chosen =
    (context.context?.kind === "decision" ? open.find((decision) => decision.id === context.context?.id) : undefined) ?? open[0];
  if (!chosen) {
    return emptyCase(context);
  }
  const supporting = (chosen.supportingEvidenceIds ?? []).map((id) => documentEvidence(context, id)).filter((entry): entry is InsightEvidence => entry !== null);
  const opposing = (chosen.opposingEvidenceIds ?? []).map((id) => documentEvidence(context, id)).filter((entry): entry is InsightEvidence => entry !== null);
  const stale = [...supporting, ...opposing].filter((entry) => entry.freshness === "stale");
  const subjectId = chosen.relatedObjectId ?? "";
  const remaining = open.length - 1;
  const title = lang === "de" && chosen.titleDe ? chosen.titleDe : chosen.title;
  const trend = partyTrends(context).find((entry) => entry.id === subjectId);
  const recovery = data.resilience.find((row) => row.serviceId === "IBS-0004" && row.entityId === "ARC-DE");
  const drTest = data.evidence.find((document) => document.id === "EVD-2026-40118");
  const unescalatedDays = drTest ? daysBetween(drTest.documentDate, data.scope.today) : null;

  const evidence: InsightEvidence[] = [...supporting, ...opposing];
  if (trend) {
    evidence.push(
      registerEvidence(`tpm-${trend.id}`, L(`Monthly performance, ${trend.name}`, `Monatliche Leistung, ${trend.name}`), `TPM-${trend.id}-2026-09`, "30.09.2026", L(`Risk score ${trend.prior} to ${trend.recent} over the last two quarters.`, `Risikowert ${trend.prior} auf ${trend.recent} in den letzten zwei Quartalen.`), {
        sourceType: L("Third-party register", "Drittparteienregister"),
        href: workHref(roleId, trend.id),
      }),
    );
  }

  const findings: InsightFinding[] = [
    {
      id: "finding-why",
      severity: "critical",
      title: L(`Why this case comes first: ${title}`, `Warum dieser Fall zuerst kommt: ${title}`),
      detail: chosen.whyThisMatters ?? "",
      evidenceIds: supporting.map((entry) => entry.id).slice(0, 10),
      href: decisionsHref(roleId),
    },
    {
      id: "finding-position",
      severity: "info",
      title: L("What the Workspace prepared", "Was der Workspace vorbereitet hat"),
      detail: (chosen.preparedPosition ?? "").slice(0, 1200),
      evidenceIds: supporting.map((entry) => entry.id).slice(0, 10),
    },
  ];
  if (chosen.uncertaintyNote) {
    findings.push({ id: "finding-uncertainty", severity: "watch", title: L("What is still uncertain", "Was noch unsicher ist"), detail: chosen.uncertaintyNote.slice(0, 1200), evidenceIds: [] });
  }
  if (stale.length > 0) {
    findings.push({
      id: "finding-stale",
      severity: "warning",
      title: L(`${plural(stale.length, "cited document is", "cited documents are")} stale`, `${stale.length} zitierte Dokumente sind veraltet`),
      detail: stale.map((entry) => `${entry.recordId} ${entry.sourceName}`).join("; ").slice(0, 1200),
      evidenceIds: stale.map((entry) => entry.id),
    });
  }

  const recommendations: InsightRecommendation[] = [
    {
      id: "rec-decide",
      title: L("Record the decision", "Die Entscheidung erfassen"),
      rationale: L(
        `It is the highest-priority open decision for this role; ${plural(remaining, "other waits", "others wait")} behind it. The options, the evidence and the approval path are prepared.`,
        `Es ist die Entscheidung mit hoechster Prioritaet fuer diese Rolle; ${remaining} weitere warten dahinter. Optionen, Nachweise und Genehmigungsweg sind vorbereitet.`,
      ),
      urgency: "now",
      href: decisionsHref(roleId),
    },
  ];
  if (subjectId === "TP-0042") {
    recommendations.push({
      id: "rec-retest",
      title: L("Request a re-run of the recovery test before the reassessment closes", "Vor Abschluss der Neubewertung eine Wiederholung des Wiederherstellungstests anfordern"),
      rationale: L(
        "The decision rests on one supplier test of 22.05.2026; whichever option is chosen, a current measurement is the condition that makes it hold.",
        "Die Entscheidung beruht auf einem Test des Dienstleisters vom 22.05.2026; welche Option auch gewaehlt wird, eine aktuelle Messung ist die Bedingung, damit sie traegt.",
      ),
      urgency: "now",
      proposedAction: requestEvidenceProposal(context, {
        id: "act-retest",
        what: L(
          "Re-run of the RepairDesk recovery test with measured recovery times, including the Swiss instance",
          "Wiederholung des RepairDesk-Wiederherstellungstests mit gemessenen Zeiten, einschliesslich der Schweizer Instanz",
        ),
        fromUserId: "P-012",
        fromLabel: `${personName(data, "P-012")}, Novalink`,
        dueInDays: 10,
        relatedKind: "decision",
        relatedId: chosen.id,
        relatedLabel: title,
        rationale: L("The only recovery evidence is a single supplier test.", "Der einzige Wiederherstellungsnachweis ist ein einzelner Test des Dienstleisters."),
        evidenceIds: supporting.map((entry) => entry.id).slice(0, 6),
      }),
    });
  }

  const visualisations: InsightResponseInput["visualisations"] = [];
  if (recovery && subjectId === "TP-0042") {
    visualisations.push({
      id: "viz-recovery",
      type: "bullet",
      title: L(`RepairDesk recovered in ${recovery.observedMinutes} minutes against a contracted 120`, `RepairDesk erholte sich in ${recovery.observedMinutes} Minuten gegen vertraglich 120`),
      subtitle: L("Supplier recovery test of 22.05.2026 against the contract and the service tolerance", "Wiederherstellungstest vom 22.05.2026 gegen Vertrag und Servicetoleranz"),
      explanation: L("The first bar measures recovery against the contracted objective, the second against the tolerance for the whole service.", "Der erste Balken misst gegen das vertragliche Ziel, der zweite gegen die Toleranz des gesamten Services."),
      unit: L("minutes", "Minuten"),
      data: [
        { id: "rto", label: L("Contracted recovery objective", "Vertragliches Wiederherstellungsziel"), sublabel: "CTR-2023-0117", target: 120, actual: recovery.observedMinutes, targetLabel: L("objective 120", "Ziel 120"), tone: "critical" },
        { id: "tolerance", label: L("Service impact tolerance", "Auswirkungstoleranz des Services"), sublabel: "ITOL-0004-01", target: recovery.toleranceMinutes, actual: recovery.observedMinutes, targetLabel: L(`tolerance ${recovery.toleranceMinutes}`, `Toleranz ${recovery.toleranceMinutes}`), tone: recovery.observedMinutes / recovery.toleranceMinutes >= 0.85 ? "warning" : "good" },
      ],
    });
  }
  const events = [...supporting, ...opposing]
    .map((entry) => {
      const document = data.evidence.find((doc) => `doc-${doc.id}` === entry.id);
      return document ? { id: document.id, lane: supporting.includes(entry) ? "supporting" : "opposing", date: document.documentDate.slice(0, 10), label: document.id.replace("EVD-2026-", "EVD "), tone: (document.isStale ? "warning" : "neutral") as Tone, href: workHref(roleId, document.id) } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  /* Six months is the window a decision is argued in; older documents are counted, not drawn. */
  const windowStart = (() => { const date = new Date(`${data.scope.today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - 180); return date.toISOString().slice(0, 10); })();
  const older = events.filter((event) => event.date < windowStart).length;
  const inWindow = events.filter((event) => event.date >= windowStart);
  events.length = 0;
  events.push(...inWindow);
  events.push({ id: "decision", lane: "decision", date: data.scope.today, label: L("Decision today", "Entscheidung heute"), tone: "accent", href: decisionsHref(roleId) });
  const earliest = windowStart;
  visualisations.push({
    id: "viz-case-timeline",
    type: "timeline",
    title: L(`${plural(supporting.length, "document supports", "documents support")} the prepared position and ${opposing.length} argue against it; ${stale.length} are stale`, `${supporting.length} Dokumente stuetzen die vorbereitete Position, ${opposing.length} sprechen dagegen; ${stale.length} sind veraltet`),
    subtitle: older
      ? L(`Cited documents of the last six months; ${older} older not drawn`, `Zitierte Dokumente der letzten sechs Monate; ${older} aeltere nicht gezeigt`)
      : L("Cited documents of the last six months", "Zitierte Dokumente der letzten sechs Monate"),
    start: earliest,
    end: data.scope.today,
    today: data.scope.today,
    lanes: [
      { id: "supporting", label: L("Supports the position", "Stuetzt die Position") },
      { id: "opposing", label: L("Argues against", "Spricht dagegen") },
      { id: "decision", label: L("Decision", "Entscheidung") },
    ],
    events,
  });

  return {
    version: 1,
    intentId: "case-next-action",
    question: context.question,
    title: L("Next action on the current case", "Naechster Schritt im aktuellen Fall"),
    conclusion: L(
      `Record the decision on "${title}" first, then request a current recovery test so the outcome rests on today's evidence, not on a test from ${drTest ? formatDate(drTest.documentDate) : "May"}.`,
      `Zuerst die Entscheidung zu "${title}" erfassen, dann einen aktuellen Wiederherstellungstest anfordern, damit das Ergebnis auf heutigen Nachweisen beruht und nicht auf einem Test vom ${drTest ? formatDate(drTest.documentDate) : "Mai"}.`,
    ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: `${chosen.reference}, ${subjectId}`,
    plan: {
      using: [L("Open decisions", "Offene Entscheidungen"), L("Evidence documents", "Nachweisdokumente"), L("Third-party register", "Drittparteienregister"), L("Resilience exercises", "Resilienzuebungen")],
      timeWindow: L("The case history to today", "Fallverlauf bis heute"),
      groupedBy: L("Evidence position", "Nachweislage"),
      output: L("Recommended next step", "Empfohlener naechster Schritt"),
    },
    confidence: {
      level: stale.length > 0 ? "medium" : "high",
      explanation:
        stale.length > 0
          ? L("The decision is ready, but part of the cited evidence is stale; the recommendation says how to close that.", "Die Entscheidung ist vorbereitet, aber ein Teil der Nachweise ist veraltet; die Empfehlung sagt, wie das zu schliessen ist.")
          : L("The decision and its evidence are current.", "Entscheidung und Nachweise sind aktuell."),
    },
    metrics: [
      ...(unescalatedDays && subjectId === "TP-0042" ? [{ id: "m-days", label: L("Unescalated for", "Nicht eskaliert seit"), value: unescalatedDays, unit: L("days", "Tage"), status: "critical" as const }] : []),
      { id: "m-supporting", label: L("Supporting documents", "Stuetzende Dokumente"), value: supporting.length, status: "neutral" },
      { id: "m-opposing", label: L("Opposing documents", "Widersprechende Dokumente"), value: opposing.length, status: "neutral" },
      { id: "m-stale", label: L("Stale", "Veraltet"), value: stale.length, status: stale.length ? "warning" : "good" },
      { id: "m-remaining", label: L("Decisions after this", "Weitere Entscheidungen"), value: remaining, status: "neutral" },
    ],
    visualisations,
    findings,
    evidence: evidence.slice(0, 40),
    recommendations,
    followUps: [
      { label: L("What changed", "Was sich geaendert hat"), question: L("What changed in the payment service review since last quarter?", "Was hat sich im Review des Zahlungsservices seit dem letzten Quartal geaendert?") },
      { label: L("Expiring acceptances", "Ablaufende Akzeptanzen"), question: L("Which risk acceptances expire in the next 90 days?", "Welche Risikoakzeptanzen laufen in den naechsten 90 Tagen ab?") },
    ],
  };
}

function emptyCase(context: BuildContext): InsightResponseInput {
  const L = (en: string, de: string) => tx(context.language, en, de);
  return {
    version: 1,
    intentId: "case-next-action",
    question: context.question,
    title: L("Next action on the current case", "Naechster Schritt im aktuellen Fall"),
    conclusion: L("No decision is open for this role at the current moment.", "Fuer diese Rolle ist im Moment keine Entscheidung offen."),
    language: context.language,
    roleId: context.roleId,
    dataAsOf: context.dataAsOf,
    scope: L("Open decisions of this role", "Offene Entscheidungen dieser Rolle"),
    plan: { using: [L("Open decisions", "Offene Entscheidungen")], timeWindow: L("Now", "Jetzt"), groupedBy: L("Decision", "Entscheidung"), output: L("Next step", "Naechster Schritt") },
    confidence: { level: "high", explanation: L("Read from the decision queue.", "Aus der Entscheidungsliste gelesen.") },
    metrics: [{ id: "m-open", label: L("Open decisions", "Offene Entscheidungen"), value: 0, status: "good" }],
    visualisations: [
      {
        id: "viz-empty",
        type: "table",
        title: L("Nothing is waiting for a decision", "Nichts wartet auf eine Entscheidung"),
        columns: [{ id: "state", label: L("State", "Stand") }],
        rows: [{ id: "none", cells: { state: L("No open decision", "Keine offene Entscheidung") } }],
      },
    ],
    findings: [],
    evidence: [],
    recommendations: [],
    followUps: [],
  };
}
