/**
 * Third-party analyses: deterioration and provider concentration.
 *
 * Deterioration compares each critical third party's average composite risk
 * score over the last three months with the three months before. A rise of
 * eight points or more is deterioration; the drivers named for it are rows
 * (incidents, assurance position, open issues, expiring acceptances, shared
 * providers), never adjectives.
 *
 * Concentration groups every dependency on an underlying provider, from the
 * operational subprocessor lists and the register, and ranks providers by the
 * critical third parties and services that rest on them.
 */

import type { InsightEvidence, InsightFinding, InsightRecommendation, InsightResponseInput, Tone } from "../schema";
import { formatDate, formatPeriod, personName } from "../data";
import {
  average,
  createActionProposal,
  createIssueProposal,
  documentEvidence,
  holderOf,
  joinNames,
  monitorProposal,
  plural,
  recordHref,
  registerEvidence,
  requestEvidenceProposal,
  shortName,
  sum,
  thirdPartyHref,
  toneForDelta,
  toneForScore,
  tx,
  type BuildContext,
} from "./common";

const RECENT = ["2026-07", "2026-08", "2026-09"];
const PRIOR = ["2026-04", "2026-05", "2026-06"];
const DETERIORATION_POINTS = 8;

interface PartyTrend {
  id: string;
  name: string;
  criticality: string;
  recent: number;
  prior: number;
  delta: number;
  latest: number;
  incidentsRecent: number;
  assurance: string;
  series: number[];
  providers: string[];
}

export function partyTrends(context: BuildContext): PartyTrend[] {
  const { data } = context;
  const months = [...new Set(data.metrics.map((row) => row.period))].sort();
  return data.thirdParties.map((party) => {
    const rows = data.metrics.filter((row) => row.thirdPartyId === party.id);
    const byPeriod = new Map(rows.map((row) => [row.period, row]));
    const score = (periods: string[]) => average(periods.map((period) => byPeriod.get(period)?.riskScore ?? 0));
    const recent = score(RECENT);
    const prior = score(PRIOR);
    return {
      id: party.id,
      name: party.name,
      criticality: party.criticality,
      recent: Math.round(recent),
      prior: Math.round(prior),
      delta: Math.round(recent - prior),
      latest: byPeriod.get("2026-09")?.riskScore ?? 0,
      incidentsRecent: sum(RECENT.map((period) => byPeriod.get(period)?.incidents ?? 0)),
      assurance: byPeriod.get("2026-09")?.assuranceStatus ?? "current",
      series: months.map((period) => byPeriod.get(period)?.riskScore ?? 0),
      providers: [...new Set(data.dependencies.filter((dep) => dep.thirdPartyId === party.id).map((dep) => dep.providerKey))],
    };
  });
}

function openHighIssues(context: BuildContext, thirdPartyId: string) {
  return context.data.issues.filter(
    (issue) => issue.status !== "closed" && issue.severity === "high" && (issue.supplierIds ?? []).includes(thirdPartyId),
  );
}

function expiringAcceptances(context: BuildContext, subjectId: string, days = 90) {
  const today = context.data.scope.today;
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const end = limit.toISOString().slice(0, 10);
  return context.data.acceptances.filter(
    (row) => row.subjectId === subjectId && row.status === "active" && row.expiresOn >= today && row.expiresOn <= end,
  );
}

/* ==========================================================================
   Which critical third-party services are deteriorating, and why?
   ========================================================================== */

export function buildDeterioration(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const trends = partyTrends(context).filter((trend) => trend.criticality === "critical");
  const ranked = [...trends].sort((a, b) => b.delta - a.delta);
  const worsening = ranked.filter((trend) => trend.delta >= DETERIORATION_POINTS);
  const onBasalt = worsening.filter((trend) => trend.providers.includes("basalt"));
  const incidents = sum(worsening.map((trend) => trend.incidentsRecent));
  const highIssues = worsening.flatMap((trend) => openHighIssues(context, trend.id));
  const acceptances = worsening.flatMap((trend) => expiringAcceptances(context, trend.id));
  const lead = worsening[0];

  const evidence: InsightEvidence[] = [];
  const findings: InsightFinding[] = [];
  for (const trend of worsening) {
    const metricEvidence = registerEvidence(
      `tpm-${trend.id}`,
      L(`Monthly performance, ${trend.name}`, `Monatliche Leistung, ${trend.name}`),
      `TPM-${trend.id}-2026-09`,
      "30.09.2026",
      L(
        `Composite risk score ${trend.prior} on average April to June, ${trend.recent} July to September; ${trend.incidentsRecent} incidents in the last three months.`,
        `Risikowert im Mittel ${trend.prior} April bis Juni, ${trend.recent} Juli bis September; ${trend.incidentsRecent} Vorfaelle in den letzten drei Monaten.`,
      ),
      { field: "risk_score", href: thirdPartyHref(context, trend.id), sourceType: L("Third-party register", "Drittparteienregister") },
    );
    evidence.push(metricEvidence);
    const ids = [metricEvidence.id];
    const drivers: string[] = [
      L(`risk score ${trend.prior} to ${trend.recent}`, `Risikowert ${trend.prior} auf ${trend.recent}`),
      L(plural(trend.incidentsRecent, "incident", "incidents") + " since July", `${trend.incidentsRecent} Vorfaelle seit Juli`),
    ];
    if (trend.assurance !== "current") {
      drivers.push(L(`assurance evidence ${trend.assurance}`, `Pruefnachweis ${trend.assurance === "stale" ? "veraltet" : "alternd"}`));
    }
    const issues = openHighIssues(context, trend.id);
    if (issues.length > 0) {
      drivers.push(L(plural(issues.length, "open high-severity issue", "open high-severity issues"), `${issues.length} offene Feststellungen mit hohem Schweregrad`));
      for (const issue of issues.slice(0, 3)) {
        const issueEvidence = registerEvidence(`iss-${issue.id}`, issue.title, issue.id, formatDate(issue.raisedOn), issue.description ?? issue.title, {
          sourceType: L("Issue register", "Feststellungsregister"),
          href: `/workday/${roleId}/work?view=actions&object=${encodeURIComponent(issue.id)}`,
        });
        evidence.push(issueEvidence);
        ids.push(issueEvidence.id);
      }
    }
    for (const acceptance of expiringAcceptances(context, trend.id)) {
      const raEvidence = registerEvidence(
        `ra-${acceptance.id}`,
        acceptance.title,
        acceptance.reference,
        formatDate(acceptance.grantedOn),
        L(
          `Expires ${formatDate(acceptance.expiresOn)}. Conditions ${acceptance.conditionsMet ? "met" : "not met"}: ${acceptance.conditions}`,
          `Laeuft am ${formatDate(acceptance.expiresOn)} ab. Bedingungen ${acceptance.conditionsMet ? "erfuellt" : "nicht erfuellt"}: ${acceptance.conditions}`,
        ),
        { sourceType: L("Risk acceptance register", "Register der Risikoakzeptanzen"), href: recordHref(roleId, "risk-acceptances", acceptance.id) },
      );
      evidence.push(raEvidence);
      ids.push(raEvidence.id);
    }
    if (trend.id === "TP-0042") {
      const document = documentEvidence(context, "EVD-2026-40118");
      if (document) {
        evidence.push(document);
        ids.push(document.id);
      }
      const recentIncidents = data.incidents.filter((incident) => incident.supplierIds.includes("TP-0042")).slice(0, 4);
      for (const incident of recentIncidents) {
        const incidentEvidence = registerEvidence(`inc-${incident.id}`, lang === "de" ? incident.titleDe : incident.title, incident.reference, formatDate(incident.detectedAt), incident.description, {
          sourceType: L("Incident record", "Vorfallsdatensatz"),
          href: `/workday/${roleId}/work?view=actions&object=${encodeURIComponent(incident.id)}`,
        });
        evidence.push(incidentEvidence);
        ids.push(incidentEvidence.id);
      }
    }
    if (trend.providers.includes("basalt")) drivers.push(L("runs on Basalt Cloud", "laeuft auf Basalt Cloud"));
    findings.push({
      id: `finding-${trend.id}`,
      severity: trend.delta >= 20 ? "critical" : "warning",
      title: L(`${trend.name}: risk score up ${trend.delta} points`, `${trend.name}: Risikowert plus ${trend.delta} Punkte`),
      detail: capitalise(drivers.join("; ")) + ".",
      evidenceIds: ids.slice(0, 20),
      href: thirdPartyHref(context, trend.id),
    });
  }
  if (onBasalt.length >= 2) {
    findings.push({
      id: "finding-basalt",
      severity: "warning",
      title: L(
        `${onBasalt.length} of the ${worsening.length} share Basalt Cloud`,
        `${onBasalt.length} der ${worsening.length} teilen Basalt Cloud`,
      ),
      detail: L(
        `${joinNames(onBasalt.map((trend) => shortName(trend.name)), lang)} both depend on Basalt Cloud Infrastructure B.V.; the Basalt outage of 19.08.2026 appears in each one's August incident count. The deterioration may have one shared cause.`,
        `${joinNames(onBasalt.map((trend) => shortName(trend.name)), lang)} haengen beide von Basalt Cloud Infrastructure B.V. ab; der Basalt-Ausfall vom 19.08.2026 erscheint in beiden Vorfallszahlen fuer August. Die Verschlechterung kann eine gemeinsame Ursache haben.`,
      ),
      evidenceIds: onBasalt.map((trend) => `tpm-${trend.id}`),
    });
  }

  const recommendations: InsightRecommendation[] = [];
  const holder = holderOf(context);
  if (worsening.some((trend) => trend.id === "TP-0042")) {
    recommendations.push({
      id: "rec-novalink-evidence",
      title: L("Request current recovery test evidence from Novalink", "Aktuellen Wiederherstellungstest von Novalink anfordern"),
      rationale: L(
        "The only recovery evidence on file is the 22.05.2026 test, which recorded 3 hours 40 minutes against a contracted 2 hours and is marked stale.",
        "Der einzige Wiederherstellungsnachweis ist der Test vom 22.05.2026 mit 3 Stunden 40 Minuten gegen vertraglich 2 Stunden; er ist als veraltet markiert.",
      ),
      urgency: "now",
      proposedAction: requestEvidenceProposal(context, {
        id: "act-novalink-evidence",
        what: L(
          "Re-run of the RepairDesk and NOVA-GATE recovery test, including the Swiss instance, with measured recovery times",
          "Wiederholung des RepairDesk- und NOVA-GATE-Wiederherstellungstests einschliesslich der Schweizer Instanz, mit gemessenen Zeiten",
        ),
        fromUserId: "P-012",
        fromLabel: `${personName(data, "P-012")}, Novalink`,
        dueInDays: 10,
        relatedKind: "supplier",
        relatedId: "TP-0042",
        relatedLabel: "Novalink Payment Services GmbH",
        rationale: L("Stale recovery evidence on a deteriorating critical supplier.", "Veralteter Wiederherstellungsnachweis bei einem kritischen Dienstleister, der sich verschlechtert."),
        evidenceIds: ["doc-EVD-2026-40118", "tpm-TP-0042"],
      }),
    });
  }
  if (onBasalt.length > 0) {
    recommendations.push({
      id: "rec-basalt-action",
      title: L("Assess the shared Basalt Cloud dependency", "Gemeinsame Abhaengigkeit von Basalt Cloud bewerten"),
      rationale: L(
        `${joinNames(onBasalt.map((trend) => shortName(trend.name)), lang)} worsened together after the August Basalt outage. One assessment covers both.`,
        `${joinNames(onBasalt.map((trend) => shortName(trend.name)), lang)} verschlechterten sich gemeinsam nach dem Basalt-Ausfall im August. Eine Bewertung deckt beide ab.`,
      ),
      urgency: "this-week",
      proposedAction: createActionProposal(context, {
        id: "act-basalt-assessment",
        title: L("Assess Basalt Cloud dependency of Lumenwerk and Vireo", "Basalt-Cloud-Abhaengigkeit von Lumenwerk und Vireo bewerten"),
        description: L(
          "Obtain each supplier's Basalt Cloud architecture, the August outage root cause and the failover arrangements; conclude whether the deterioration has a shared cause.",
          "Basalt-Cloud-Architektur je Dienstleister, Ursache des Ausfalls im August und Failover-Regelungen einholen; feststellen, ob die Verschlechterung eine gemeinsame Ursache hat.",
        ),
        ownerUserId: holder || "P-002",
        dueInDays: 14,
        priority: "high",
        relatedKind: "supplier",
        relatedId: onBasalt[0]?.id ?? "TP-0131",
        relatedLabel: onBasalt[0]?.name ?? "",
        rationale: L("Two critical suppliers on one provider worsened at the same time.", "Zwei kritische Dienstleister auf einem Anbieter verschlechterten sich gleichzeitig."),
        evidenceIds: onBasalt.map((trend) => `tpm-${trend.id}`),
      }),
    });
    const watch = onBasalt[0];
    if (watch) {
      recommendations.push({
        id: "rec-monitor",
        title: L(`Monitor ${shortName(watch.name)} weekly`, `${shortName(watch.name)} woechentlich ueberwachen`),
        rationale: L(
          `The risk score rose from ${watch.prior} to ${watch.recent}; weekly review catches a further step before the next monthly reading.`,
          `Der Risikowert stieg von ${watch.prior} auf ${watch.recent}; eine woechentliche Pruefung erkennt einen weiteren Schritt vor dem naechsten Monatswert.`,
        ),
        urgency: "monitor",
        proposedAction: monitorProposal(context, {
          id: "act-monitor",
          subjectKind: "supplier",
          subjectId: watch.id,
          subjectLabel: watch.name,
          description: L(`Enhanced monitoring of ${watch.name} after a ${watch.delta} point rise in risk score.`, `Erweiterte Ueberwachung von ${watch.name} nach einem Anstieg des Risikowerts um ${watch.delta} Punkte.`),
          rationale: L("Deteriorating critical supplier.", "Kritischer Dienstleister mit Verschlechterung."),
          evidenceIds: [`tpm-${watch.id}`],
        }),
      });
    }
  }

  const periods = [...new Set(data.metrics.map((row) => row.period))].sort();
  const others = trends.filter((trend) => !worsening.includes(trend));
  const median = periods.map((_, index) => {
    const values = others.map((trend) => trend.series[index] ?? 0).sort((a, b) => a - b);
    return values.length === 0 ? null : (values[Math.floor(values.length / 2)] ?? null);
  });
  const palette: Tone[] = ["critical", "warning", "watch"];
  const leadMarch = lead ? (lead.series[periods.indexOf("2026-03")] ?? lead.prior) : 0;

  return {
    version: 1,
    intentId: "third-party-deterioration",
    question: context.question,
    title: L("Critical third parties: deterioration", "Kritische Drittparteien: Verschlechterung"),
    conclusion:
      worsening.length === 0
        ? L("No critical third party has deteriorated over the last three months.", "Keine kritische Drittpartei hat sich in den letzten drei Monaten verschlechtert.")
        : L(
            `${plural(worsening.length, "critical third party is", "critical third parties are")} deteriorating, led by ${shortName(lead?.name ?? "")} (up ${lead?.delta} points)${onBasalt.length >= 2 ? `; ${onBasalt.length} of them share Basalt Cloud` : ""}.`,
            `${worsening.length} kritische Drittparteien verschlechtern sich, allen voran ${shortName(lead?.name ?? "")} (plus ${lead?.delta} Punkte)${onBasalt.length >= 2 ? `; ${onBasalt.length} davon teilen Basalt Cloud` : ""}.`,
          ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L(`${trends.length} critical third parties across Arcadia Banking Group`, `${trends.length} kritische Drittparteien in der Arcadia Banking Group`),
    plan: {
      using: [
        L("Third-party register", "Drittparteienregister"),
        L("Monthly performance history", "Monatliche Leistungshistorie"),
        L("Incident records", "Vorfallsdatensaetze"),
        L("Issue register", "Feststellungsregister"),
        L("Risk acceptance register", "Register der Risikoakzeptanzen"),
        L("Fourth-party dependencies", "Abhaengigkeiten von Viertparteien"),
      ],
      timeWindow: L("Oct 2024 to Sep 2026; change is Jul to Sep against Apr to Jun 2026", "Okt 2024 bis Sep 2026; Veraenderung Jul bis Sep gegen Apr bis Jun 2026"),
      groupedBy: L("Third party", "Drittpartei"),
      output: L("Ranking, trend and drivers", "Rangfolge, Verlauf und Treiber"),
    },
    confidence: {
      level: "high",
      explanation: L(
        "Every figure is computed from register metrics and records; nothing is estimated. The composite score weights incidents, service levels and assurance.",
        "Jede Zahl ist aus Registerwerten und Datensaetzen berechnet; nichts ist geschaetzt. Der Risikowert gewichtet Vorfaelle, Service Levels und Pruefnachweise.",
      ),
    },
    metrics: [
      { id: "m-worsening", label: L("Deteriorating", "Verschlechtert"), value: `${worsening.length} / ${trends.length}`, status: worsening.length > 0 ? "warning" : "good", deltaLabel: L("critical third parties", "kritische Drittparteien") },
      { id: "m-incidents", label: L("Incidents since July", "Vorfaelle seit Juli"), value: incidents, status: incidents > 5 ? "critical" : "watch", deltaLabel: L("across the deteriorating", "bei den verschlechterten") },
      { id: "m-basalt", label: L("Share one provider", "Teilen einen Anbieter"), value: `${onBasalt.length} / ${worsening.length}`, status: onBasalt.length >= 2 ? "warning" : "neutral", deltaLabel: "Basalt Cloud" },
      { id: "m-issues", label: L("Open high issues", "Offene hohe Feststellungen"), value: highIssues.length, status: highIssues.length > 0 ? "warning" : "good" },
      { id: "m-acceptances", label: L("Acceptances expiring", "Ablaufende Akzeptanzen"), value: acceptances.length, status: acceptances.length > 0 ? "watch" : "good", deltaLabel: L("within 90 days", "innerhalb von 90 Tagen") },
    ],
    visualisations: [
      {
        id: "viz-ranking",
        type: "bar",
        title: lead
          ? L(`${shortName(lead.name)} moved most: up ${lead.delta} points in three months`, `${shortName(lead.name)} bewegte sich am staerksten: plus ${lead.delta} Punkte in drei Monaten`)
          : L("No critical third party moved materially", "Keine kritische Drittpartei bewegte sich wesentlich"),
        subtitle: L("Change in composite risk score, Jul to Sep against Apr to Jun 2026", "Veraenderung des Risikowerts, Jul bis Sep gegen Apr bis Jun 2026"),
        explanation: L(
          "Each bar is the difference between a third party's average risk score over the last three months and the three months before. The line marks the 8 point deterioration threshold.",
          "Jeder Balken ist die Differenz des mittleren Risikowerts der letzten drei Monate zu den drei Monaten davor. Die Linie markiert die Schwelle von 8 Punkten.",
        ),
        unit: L("points", "Punkte"),
        data: ranked.map((trend) => ({
          id: trend.id,
          label: shortName(trend.name),
          value: trend.delta,
          note: L(`now ${trend.recent}`, `jetzt ${trend.recent}`),
          tone: toneForDelta(trend.delta),
          href: thirdPartyHref(context, trend.id),
        })),
        reference: { value: DETERIORATION_POINTS, label: L("Deterioration threshold", "Schwelle Verschlechterung") },
      },
      {
        id: "viz-trend",
        type: "line",
        title: lead
          ? L(`${shortName(lead.name)} rose from ${leadMarch} in March to ${lead.latest} in September`, `${shortName(lead.name)} stieg von ${leadMarch} im Maerz auf ${lead.latest} im September`)
          : L("Risk score per month", "Risikowert je Monat"),
        subtitle: L("Composite risk score per month, 24 months", "Risikowert je Monat, 24 Monate"),
        unit: L("score", "Wert"),
        periods: periods.map((period) => formatPeriod(period, lang)),
        series: [
          ...worsening.map((trend, index) => ({
            id: trend.id,
            label: shortName(trend.name),
            tone: palette[index] ?? "watch",
            emphasis: index === 0,
            values: trend.series,
          })),
          { id: "median", label: L("Other critical, median", "Andere kritische, Median"), tone: "neutral" as Tone, emphasis: false, values: median },
        ],
        thresholds: [{ value: 60, label: L("High risk", "Hohes Risiko"), tone: "critical" }],
        yMin: 0,
        yMax: 100,
      },
      {
        id: "viz-table",
        type: "table",
        title: L("The records behind the ranking", "Die Datensaetze hinter der Rangfolge"),
        columns: [
          { id: "party", label: L("Third party", "Drittpartei") },
          { id: "prior", label: L("Apr to Jun", "Apr bis Jun"), align: "end" },
          { id: "recent", label: L("Jul to Sep", "Jul bis Sep"), align: "end" },
          { id: "change", label: L("Change", "Veraenderung"), align: "end" },
          { id: "incidents", label: L("Incidents", "Vorfaelle"), align: "end" },
          { id: "assurance", label: L("Assurance", "Pruefnachweis") },
        ],
        rows: ranked.map((trend) => ({
          id: trend.id,
          cells: {
            party: trend.name,
            prior: trend.prior,
            recent: trend.recent,
            change: trend.delta > 0 ? `+${trend.delta}` : String(trend.delta),
            incidents: trend.incidentsRecent,
            assurance: trend.assurance,
          },
          tone: toneForDelta(trend.delta),
          href: thirdPartyHref(context, trend.id),
        })),
      },
    ],
    findings,
    evidence: evidence.slice(0, 40),
    recommendations,
    followUps: [
      { label: L("Concentration", "Konzentration"), question: L("Where do we have provider concentration across critical services?", "Wo bestehen Anbieterkonzentrationen bei kritischen Services?") },
      { label: L("Payment review", "Zahlungsreview"), question: L("What changed in the payment service review since last quarter?", "Was hat sich im Review des Zahlungsservices seit dem letzten Quartal geaendert?") },
      { label: L("Expiring acceptances", "Ablaufende Akzeptanzen"), question: L("Which risk acceptances expire in the next 90 days?", "Welche Risikoakzeptanzen laufen in den naechsten 90 Tagen ab?") },
    ],
  };
}

/* ==========================================================================
   Where do we have provider concentration across critical services?
   ========================================================================== */

export function buildConcentration(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const trends = new Map(partyTrends(context).map((trend) => [trend.id, trend]));

  const byProvider = new Map<string, { key: string; name: string; parties: Set<string>; services: Set<string>; undeclared: Set<string> }>();
  for (const dep of data.dependencies) {
    const entry = byProvider.get(dep.providerKey) ?? { key: dep.providerKey, name: dep.providerName, parties: new Set(), services: new Set(), undeclared: new Set() };
    entry.parties.add(dep.thirdPartyId);
    entry.services.add(dep.serviceId);
    if (!dep.declared) entry.undeclared.add(dep.thirdPartyId);
    byProvider.set(dep.providerKey, entry);
  }
  const critOf = (id: string) => data.thirdPartyById.get(id)?.criticality ?? "standard";
  const providers = [...byProvider.values()]
    .map((entry) => ({
      ...entry,
      critical: [...entry.parties].filter((id) => critOf(id) === "critical"),
      important: [...entry.parties].filter((id) => critOf(id) === "important"),
      standard: [...entry.parties].filter((id) => critOf(id) === "standard"),
    }))
    .sort((a, b) => b.critical.length - a.critical.length || b.services.size - a.services.size);
  const top = providers[0];
  const runnerUp = providers[1];
  if (!top) throw new Error("No provider dependencies are recorded.");
  const worseningOnTop = top.critical.filter((id) => (trends.get(id)?.delta ?? 0) >= DETERIORATION_POINTS);
  const ibsOnTop = [...top.services].filter((id) => data.serviceById.get(id)?.isImportantBusinessService);
  const undeclaredAll = providers.flatMap((provider) => [...provider.undeclared].map((id) => ({ provider, id })));

  /* Novalink's own stack: single points of failure and undeclared fourth parties, from the operational records. */
  const spofSubs = data.serviceDependencies.filter((edge) => edge.fromKind === "subprocessor" && edge.singlePointOfFailure);
  const undeclaredFourth = data.subprocessors.filter((sub) => sub.isDiscrepancy);

  const evidence: InsightEvidence[] = providers.slice(0, 5).map((provider) =>
    registerEvidence(
      `prov-${provider.key}`,
      provider.name,
      provider.key,
      context.dataAsOf.slice(0, 10),
      L(
        `${provider.parties.size} third parties depend on it (${provider.critical.length} critical), supporting ${provider.services.size} services.`,
        `${provider.parties.size} Drittparteien haengen davon ab (${provider.critical.length} kritisch), fuer ${provider.services.size} Services.`,
      ),
      { sourceType: L("Fourth-party dependencies", "Viertparteien-Abhaengigkeiten"), href: recordHref(roleId, "providers", provider.key) },
    ),
  );
  for (const sub of undeclaredFourth) {
    evidence.push(
      registerEvidence(`sub-${sub.id}`, sub.name, sub.id, context.dataAsOf.slice(0, 10), L(`Subprocessor of ${sub.supplierId}; the binding appendix and the current list disagree on it.`, `Subdienstleister von ${sub.supplierId}; Anhang und aktuelle Liste weichen ab.`), {
        sourceType: L("Subprocessor register", "Subdienstleisterregister"),
        freshness: "aging",
        href: thirdPartyHref(context, sub.supplierId),
      }),
    );
  }
  const exercise = data.resilience.find((row) => row.unmappedDependency);
  if (exercise) {
    evidence.push(
      registerEvidence(`srt-${exercise.id}`, exercise.scenario, exercise.reference, formatDate(exercise.testedOn), exercise.finding, {
        sourceType: L("Resilience exercise", "Resilienzuebung"),
        href: recordHref(roleId, "resilience", exercise.id),
      }),
    );
  }

  const findings: InsightFinding[] = [
    {
      id: "finding-top",
      severity: "critical",
      title: L(
        `${top.name.split(" ")[0]} Cloud carries ${top.critical.length} critical third parties`,
        `${top.name.split(" ")[0]} Cloud traegt ${top.critical.length} kritische Drittparteien`,
      ),
      detail: L(
        `${joinNames(top.critical.map((id) => shortName(data.thirdPartyById.get(id)?.name ?? id)), lang)} all run on ${top.name}, supporting ${plural(top.services.size, "service", "services")}${ibsOnTop.length ? `, ${ibsOnTop.length} of them important business services` : ""}. No other provider carries more than ${runnerUp?.critical.length ?? 0}.`,
        `${joinNames(top.critical.map((id) => shortName(data.thirdPartyById.get(id)?.name ?? id)), lang)} laufen alle auf ${top.name} und tragen ${top.services.size} Services${ibsOnTop.length ? `, davon ${ibsOnTop.length} wichtige Geschaeftsservices` : ""}. Kein anderer Anbieter traegt mehr als ${runnerUp?.critical.length ?? 0}.`,
      ),
      evidenceIds: [`prov-${top.key}`],
    },
  ];
  if (worseningOnTop.length > 0) {
    findings.push({
      id: "finding-worsening",
      severity: "warning",
      title: L(`${worseningOnTop.length} of them are deteriorating`, `${worseningOnTop.length} davon verschlechtern sich`),
      detail: L(
        `${joinNames(worseningOnTop.map((id) => shortName(data.thirdPartyById.get(id)?.name ?? id)), lang)} rose by ${worseningOnTop.map((id) => trends.get(id)?.delta ?? 0).join(" and ")} points since spring; both counted the Basalt outage of 19.08.2026.`,
        `${joinNames(worseningOnTop.map((id) => shortName(data.thirdPartyById.get(id)?.name ?? id)), lang)} stiegen seit dem Fruehjahr um ${worseningOnTop.map((id) => trends.get(id)?.delta ?? 0).join(" und ")} Punkte; beide zaehlten den Basalt-Ausfall vom 19.08.2026.`,
      ),
      evidenceIds: [`prov-${top.key}`],
    });
  }
  for (const item of undeclaredAll) {
    const party = data.thirdPartyById.get(item.id);
    findings.push({
      id: `finding-undeclared-${item.id}`,
      severity: "warning",
      title: L(`${shortName(party?.name ?? item.id)} did not declare its ${item.provider.name.split(" ")[0]} dependency`, `${shortName(party?.name ?? item.id)} hat die Abhaengigkeit von ${item.provider.name.split(" ")[0]} nicht gemeldet`),
      detail: exercise
        ? L(`Found in exercise ${exercise.reference} on ${formatDate(exercise.testedOn)}: ${exercise.finding}`, `Festgestellt in Uebung ${exercise.reference} am ${formatDate(exercise.testedOn)}: ${exercise.finding}`)
        : L("The dependency is recorded but was not in the supplier's register submission.", "Die Abhaengigkeit ist erfasst, war aber nicht in der Meldung des Dienstleisters."),
      evidenceIds: exercise ? [`srt-${exercise.id}`] : [],
    });
  }
  if (spofSubs.length > 0 || undeclaredFourth.length > 0) {
    findings.push({
      id: "finding-novalink-stack",
      severity: "warning",
      title: L("Novalink's own stack has single points of failure", "Der eigene Stack von Novalink hat einzelne Ausfallpunkte"),
      detail: L(
        `${plural(spofSubs.length, "subprocessor link is", "subprocessor links are")} marked single point of failure, and ${plural(undeclaredFourth.length, "subprocessor is", "subprocessors are")} contested between the appendix and the current list, including ${undeclaredFourth.map((sub) => sub.name).slice(0, 2).join(" and ")}.`,
        `${spofSubs.length} Subdienstleister-Verbindungen sind als einzelner Ausfallpunkt markiert, und ${undeclaredFourth.length} Subdienstleister sind zwischen Anhang und aktueller Liste strittig, darunter ${undeclaredFourth.map((sub) => sub.name).slice(0, 2).join(" und ")}.`,
      ),
      evidenceIds: undeclaredFourth.map((sub) => `sub-${sub.id}`).slice(0, 6),
      href: thirdPartyHref(context, "TP-0042"),
    });
  }

  /* The network: the top two providers, their third parties and the services those support. */
  const shown = providers.slice(0, 2);
  const partyIds = [...new Set(shown.flatMap((provider) => [...provider.parties]))];
  const serviceIds = [...new Set(data.dependencies.filter((dep) => shown.some((p) => p.key === dep.providerKey)).map((dep) => dep.serviceId))];
  const nodes = [
    ...shown.map((provider) => ({
      id: `p:${provider.key}`,
      label: provider.name.replace(" Infrastructure B.V.", "").replace(" AG", ""),
      layer: "providers",
      tone: (provider === top ? "critical" : "neutral") as Tone,
      note: L(`${provider.critical.length} critical`, `${provider.critical.length} kritisch`),
      href: recordHref(roleId, "providers", provider.key),
    })),
    ...partyIds.map((id) => {
      const trend = trends.get(id);
      const party = data.thirdPartyById.get(id);
      return {
        id: `t:${id}`,
        label: shortName(party?.name ?? id),
        layer: "parties",
        tone: ((trend?.delta ?? 0) >= DETERIORATION_POINTS ? "warning" : party?.criticality === "critical" ? "accent" : "neutral") as Tone,
        note: party?.criticality,
        href: thirdPartyHref(context, id),
      };
    }),
    ...serviceIds.map((id) => ({
      id: `s:${id}`,
      label: (data.serviceById.get(id)?.name ?? id).split(" and ")[0]?.slice(0, 34) ?? id,
      layer: "services",
      tone: (data.serviceById.get(id)?.isImportantBusinessService ? "accent" : "neutral") as Tone,
      note: id,
      href: workHrefSafe(roleId, id),
    })),
  ];
  const linkKeys = new Set<string>();
  const links: Array<{ source: string; target: string; tone: Tone; dashed: boolean }> = [];
  for (const dep of data.dependencies.filter((entry) => shown.some((p) => p.key === entry.providerKey))) {
    const a = `p:${dep.providerKey}>t:${dep.thirdPartyId}`;
    if (!linkKeys.has(a)) {
      linkKeys.add(a);
      links.push({ source: `p:${dep.providerKey}`, target: `t:${dep.thirdPartyId}`, tone: dep.providerKey === top.key ? "critical" : "neutral", dashed: !dep.declared });
    }
    const b = `t:${dep.thirdPartyId}>s:${dep.serviceId}`;
    if (!linkKeys.has(b)) {
      linkKeys.add(b);
      links.push({ source: `t:${dep.thirdPartyId}`, target: `s:${dep.serviceId}`, tone: "neutral", dashed: false });
    }
  }

  const holder = holderOf(context) || "P-002";
  const undeclaredFirst = undeclaredAll[0];
  const recommendations: InsightRecommendation[] = [
    {
      id: "rec-issue",
      title: L(`Raise the ${top.name.split(" ")[0]} concentration as an issue`, `${top.name.split(" ")[0]}-Konzentration als Feststellung erfassen`),
      rationale: L(
        "A concentration that spans four critical suppliers is not visible in any single supplier review. An issue gives it an owner and a date.",
        "Eine Konzentration ueber vier kritische Dienstleister ist in keinem einzelnen Review sichtbar. Eine Feststellung gibt ihr Verantwortung und Termin.",
      ),
      urgency: "this-week",
      proposedAction: createIssueProposal(context, {
        id: "act-issue-concentration",
        title: L(`Concentration on ${top.name} across critical services`, `Konzentration auf ${top.name} ueber kritische Services`),
        description: L(
          `${top.critical.length} critical third parties and ${top.services.size} services depend on ${top.name}. Assess exit and substitution at provider level.`,
          `${top.critical.length} kritische Drittparteien und ${top.services.size} Services haengen von ${top.name} ab. Exit und Ersatz auf Anbieterebene bewerten.`,
        ),
        severity: "high",
        ownerUserId: holder,
        dueInDays: 30,
        supplierIds: top.critical,
        relatedKind: "provider",
        relatedId: top.key,
        relatedLabel: top.name,
        rationale: L("Provider-level concentration with two deteriorating dependants.", "Konzentration auf Anbieterebene mit zwei sich verschlechternden Abhaengigen."),
        evidenceIds: [`prov-${top.key}`],
      }),
    },
  ];
  if (undeclaredFirst) {
    const party = data.thirdPartyById.get(undeclaredFirst.id);
    recommendations.push({
      id: "rec-declare",
      title: L(`Ask ${shortName(party?.name ?? "")} to declare the dependency`, `${shortName(party?.name ?? "")} um Meldung der Abhaengigkeit bitten`),
      rationale: L("An undeclared dependency on a critical service is a register gap and a resilience gap at once.", "Eine nicht gemeldete Abhaengigkeit bei einem kritischen Service ist zugleich Register- und Resilienzluecke."),
      urgency: "now",
      proposedAction: requestEvidenceProposal(context, {
        id: "act-declare",
        what: L(
          `Declaration of the ${undeclaredFirst.provider.name} dependency, its regions and its exit arrangements`,
          `Meldung der Abhaengigkeit von ${undeclaredFirst.provider.name}, ihrer Regionen und Exit-Regelungen`,
        ),
        fromUserId: null,
        fromLabel: `${party?.name ?? undeclaredFirst.id}, ${L("relationship manager", "Kundenbetreuung")}`,
        dueInDays: 10,
        relatedKind: "supplier",
        relatedId: undeclaredFirst.id,
        relatedLabel: party?.name ?? undeclaredFirst.id,
        rationale: L("Found in a resilience exercise, not in the register.", "In einer Resilienzuebung gefunden, nicht im Register."),
        evidenceIds: exercise ? [`srt-${exercise.id}`] : [],
      }),
    });
  }

  return {
    version: 1,
    intentId: "provider-concentration",
    question: context.question,
    title: L("Provider concentration across critical services", "Anbieterkonzentration bei kritischen Services"),
    conclusion: L(
      `${top.critical.length} critical third parties and ${top.services.size} services depend on ${top.name}${worseningOnTop.length ? `; ${worseningOnTop.length} of those suppliers are deteriorating` : ""}.`,
      `${top.critical.length} kritische Drittparteien und ${top.services.size} Services haengen von ${top.name} ab${worseningOnTop.length ? `; ${worseningOnTop.length} dieser Dienstleister verschlechtern sich` : ""}.`,
    ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L(`${data.thirdParties.length} third parties and ${providers.length} underlying providers`, `${data.thirdParties.length} Drittparteien und ${providers.length} zugrunde liegende Anbieter`),
    plan: {
      using: [
        L("Third-party register", "Drittparteienregister"),
        L("Subprocessor lists", "Subdienstleisterlisten"),
        L("Fourth-party dependencies", "Viertparteien-Abhaengigkeiten"),
        L("Service map", "Servicelandkarte"),
        L("Resilience exercises", "Resilienzuebungen"),
      ],
      timeWindow: L("As recorded today", "Stand heute"),
      groupedBy: L("Underlying provider", "Zugrunde liegender Anbieter"),
      output: L("Dependency map and provider ranking", "Abhaengigkeitskarte und Anbieterrangfolge"),
    },
    confidence: {
      level: undeclaredAll.length > 0 ? "medium" : "high",
      explanation:
        undeclaredAll.length > 0
          ? L("Counts are exact for what is recorded. At least one dependency was found outside the register, so the true concentration can be higher.", "Die Zahlen sind fuer das Erfasste exakt. Mindestens eine Abhaengigkeit wurde ausserhalb des Registers gefunden; die tatsaechliche Konzentration kann hoeher sein.")
          : L("Counts are exact for what is recorded.", "Die Zahlen sind fuer das Erfasste exakt."),
    },
    metrics: [
      { id: "m-critical", label: L(`Critical on ${top.name.split(" ")[0]}`, `Kritisch auf ${top.name.split(" ")[0]}`), value: top.critical.length, status: "critical", deltaLabel: L(`next provider ${runnerUp?.critical.length ?? 0}`, `naechster Anbieter ${runnerUp?.critical.length ?? 0}`) },
      { id: "m-services", label: L("Services exposed", "Betroffene Services"), value: top.services.size, status: "warning", deltaLabel: L(`${ibsOnTop.length} important business services`, `${ibsOnTop.length} wichtige Geschaeftsservices`) },
      { id: "m-worsening", label: L("Of those deteriorating", "Davon verschlechtert"), value: worseningOnTop.length, status: worseningOnTop.length > 0 ? "warning" : "good" },
      { id: "m-undeclared", label: L("Undeclared or contested", "Nicht gemeldet oder strittig"), value: undeclaredAll.length + undeclaredFourth.length, status: "watch" },
      { id: "m-providers", label: L("Providers mapped", "Erfasste Anbieter"), value: providers.length, status: "neutral" },
    ],
    visualisations: [
      {
        id: "viz-network",
        type: "network",
        title: L(
          `${top.name.split(" ")[0]} sits under ${top.critical.length} critical suppliers; ${runnerUp ? `${runnerUp.name.split(" ")[0]} under ${runnerUp.critical.length}` : "no other provider comes close"}`,
          `${top.name.split(" ")[0]} liegt unter ${top.critical.length} kritischen Dienstleistern; ${runnerUp ? `${runnerUp.name.split(" ")[0]} unter ${runnerUp.critical.length}` : "kein anderer Anbieter kommt nahe"}`,
        ),
        subtitle: L("Provider, third party and service. Dashed: not declared by the supplier", "Anbieter, Drittpartei und Service. Gestrichelt: vom Dienstleister nicht gemeldet"),
        explanation: L(
          "Read left to right: an underlying provider, the third parties that run on it, and the services those third parties support. Amber third parties are deteriorating.",
          "Von links nach rechts: ein zugrunde liegender Anbieter, die Drittparteien darauf und die Services, die diese unterstuetzen. Gelbe Drittparteien verschlechtern sich.",
        ),
        layers: [
          { id: "providers", label: L("Underlying provider", "Anbieter") },
          { id: "parties", label: L("Third party", "Drittpartei") },
          { id: "services", label: L("Service supported", "Unterstuetzter Service") },
        ],
        nodes,
        links,
      },
      {
        id: "viz-providers",
        type: "stacked-bar",
        title: L(`No other provider carries more than ${plural(runnerUp?.critical.length ?? 0, "critical third party", "critical third parties")}`, `Kein anderer Anbieter traegt mehr als ${runnerUp?.critical.length ?? 0} kritische Drittparteien`),
        subtitle: L("Third parties per underlying provider, by criticality", "Drittparteien je Anbieter, nach Kritikalitaet"),
        unit: L("third parties", "Drittparteien"),
        series: [
          { id: "critical", label: L("Critical", "Kritisch"), tone: "critical" },
          { id: "important", label: L("Important", "Wichtig"), tone: "watch" },
          { id: "standard", label: L("Standard", "Standard"), tone: "neutral" },
        ],
        data: providers.map((provider) => ({
          id: provider.key,
          label: provider.name.split(" ")[0] ?? provider.name,
          values: { critical: provider.critical.length, important: provider.important.length, standard: provider.standard.length },
          href: recordHref(roleId, "providers", provider.key),
        })),
      },
    ],
    findings,
    evidence,
    recommendations,
    followUps: [
      { label: L("Who is deteriorating", "Wer verschlechtert sich"), question: L("Which critical third-party services are deteriorating, and why?", "Welche kritischen Drittparteien-Services verschlechtern sich, und warum?") },
      { label: L("Resilience gaps", "Resilienzluecken"), question: L("Show operational resilience gaps by service.", "Zeige Luecken der operationellen Resilienz je Service.") },
      { label: L("Management summary", "Management-Zusammenfassung"), question: L("Create a one-page management summary of the top NFR concerns.", "Erstelle eine einseitige Management-Zusammenfassung der wichtigsten NFR-Themen.") },
    ],
  };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function workHrefSafe(roleId: string, serviceId: string): string {
  return `/workday/${roleId}/work?view=actions&object=${encodeURIComponent(serviceId)}`;
}
