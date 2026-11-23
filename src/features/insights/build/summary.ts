/**
 * Create a one-page management summary of the top NFR concerns.
 *
 * Runs the area analyses over the same dataset and ranks what they found.
 * The summary invents nothing of its own: each line is an area analysis's
 * conclusion, each number one of its metrics, each recommendation one of its
 * recommendations, so the page and the analyses behind it always agree.
 */

import type { InsightRecommendation, InsightResponseInput, Tone } from "../schema";
import { buildFailingControls } from "./controls";
import { buildOverdueIssues } from "./issues";
import { buildExpiringAcceptances } from "./acceptances";
import { buildResilienceGaps } from "./resilience";
import { buildPolicyImpact } from "./regulatory";
import { buildConcentration, buildDeterioration } from "./third-parties";
import { joinNames, tx, type BuildContext } from "./common";

interface Area {
  id: string;
  label: string;
  question: string;
  response: InsightResponseInput;
}

const SEVERITY_WEIGHT: Record<string, number> = { critical: 3, warning: 2, watch: 1, info: 0 };

export function buildManagementSummary(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const sub = (question: string) => ({ ...context, question });
  const areas: Area[] = [
    { id: "third-parties", label: L("Third parties", "Drittparteien"), question: L("Which critical third-party services are deteriorating, and why?", "Welche kritischen Drittparteien-Services verschlechtern sich, und warum?"), response: buildDeterioration(sub("deterioration")) },
    { id: "concentration", label: L("Concentration", "Konzentration"), question: L("Where do we have provider concentration across critical services?", "Wo bestehen Anbieterkonzentrationen bei kritischen Services?"), response: buildConcentration(sub("concentration")) },
    { id: "controls", label: L("Controls", "Kontrollen"), question: L("Which controls are repeatedly failing?", "Welche Kontrollen versagen wiederholt?"), response: buildFailingControls(sub("controls")) },
    { id: "resilience", label: L("Resilience", "Resilienz"), question: L("Show operational resilience gaps by service.", "Zeige Luecken der operationellen Resilienz je Service."), response: buildResilienceGaps(sub("resilience")) },
    { id: "acceptances", label: L("Risk acceptances", "Risikoakzeptanzen"), question: L("Which risk acceptances expire in the next 90 days?", "Welche Risikoakzeptanzen laufen in den naechsten 90 Tagen ab?"), response: buildExpiringAcceptances(sub("acceptances")) },
    { id: "remediation", label: L("Remediation", "Behebung"), question: L("Which high-severity issues are overdue?", "Welche Feststellungen mit hohem Schweregrad sind ueberfaellig?"), response: buildOverdueIssues(sub("remediation")) },
    { id: "regulatory", label: L("Regulatory change", "Regulatorische Aenderung"), question: L("Which areas are affected by the latest policy change?", "Welche Bereiche sind von der neuesten Richtlinienaenderung betroffen?"), response: buildPolicyImpact(sub("regulatory")) },
  ];
  const scored = areas
    .map((area) => {
      const findings = area.response.findings ?? [];
      const weight = findings.reduce((total, finding) => total + (SEVERITY_WEIGHT[finding.severity] ?? 0), 0);
      const critical = findings.filter((finding) => finding.severity === "critical").length;
      const warning = findings.filter((finding) => finding.severity === "warning").length;
      return { area, weight, critical, warning };
    })
    .sort((a, b) => b.weight - a.weight);
  const top = scored.slice(0, 3);
  const totalCritical = scored.reduce((total, entry) => total + entry.critical, 0);

  const headlineMetric = (area: Area) => area.response.metrics?.[0];
  const metrics = top.slice(0, 3).map((entry) => {
    const metric = headlineMetric(entry.area);
    return {
      id: `m-${entry.area.id}`,
      label: `${entry.area.label}: ${metric?.label ?? ""}`.slice(0, 240),
      value: metric?.value ?? entry.critical,
      unit: metric?.unit,
      status: (metric?.status ?? "warning") as Tone,
      deltaLabel: metric?.deltaLabel,
    };
  });
  metrics.push({ id: "m-critical", label: L("Critical findings", "Kritische Feststellungen"), value: totalCritical, unit: undefined, status: "critical", deltaLabel: L(`across ${areas.length} areas`, `ueber ${areas.length} Bereiche`) });

  const recommendations: InsightRecommendation[] = top
    .map((entry) => entry.area.response.recommendations?.find((rec) => rec.proposedAction) ?? entry.area.response.recommendations?.[0])
    .filter((rec): rec is NonNullable<typeof rec> => Boolean(rec))
    .map((rec, index) => ({ ...rec, id: `summary-${index}-${rec.id}` }) as InsightRecommendation);

  const evidence = top.flatMap((entry) => (entry.area.response.evidence ?? []).slice(0, 5));
  const findings = top.map((entry) => ({
    id: `finding-${entry.area.id}`,
    severity: (entry.critical > 0 ? "critical" : "warning") as "critical" | "warning",
    title: `${entry.area.label}: ${entry.area.response.title}`,
    detail: entry.area.response.conclusion,
    evidenceIds: (entry.area.response.evidence ?? []).slice(0, 5).map((item) => item.id),
    href: `/workday/${roleId}/insights?q=${encodeURIComponent(entry.area.question)}`,
  }));

  return {
    version: 1,
    intentId: "management-summary",
    question: context.question,
    title: L("Top NFR concerns, one page", "Wichtigste NFR-Themen, eine Seite"),
    conclusion: L(
      `${joinNames(top.map((entry, index) => (index === 0 ? entry.area.label : entry.area.label.toLowerCase())), lang)} carry the most material findings today; ${totalCritical} findings across the group are critical.`,
      `${joinNames(top.map((entry) => entry.area.label), lang)} tragen heute die wesentlichsten Feststellungen; ${totalCritical} Feststellungen in der Gruppe sind kritisch.`,
    ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L(`${areas.length} areas of the NFR portfolio, Arcadia Banking Group`, `${areas.length} Bereiche des NFR-Portfolios, Arcadia Banking Group`),
    plan: {
      using: [L("The seven area analyses", "Die sieben Bereichsanalysen"), L("Third-party register", "Drittparteienregister"), L("Control test results", "Kontrolltestergebnisse"), L("Risk acceptance register", "Register der Risikoakzeptanzen"), L("Regulatory publications", "Regulatorische Veroeffentlichungen")],
      timeWindow: L("As of today, with each area's own comparison period", "Stand heute, mit dem Vergleichszeitraum jedes Bereichs"),
      groupedBy: L("Area, ranked by severity of findings", "Bereich, nach Schwere der Feststellungen"),
      output: L("One-page briefing", "Einseitiges Briefing"),
    },
    confidence: { level: "high", explanation: L("Each line is taken from the area analysis behind it, which can be opened from the line.", "Jede Zeile stammt aus der Bereichsanalyse dahinter, die von der Zeile aus geoeffnet werden kann.") },
    metrics: metrics.slice(0, 5),
    visualisations: [
      {
        id: "viz-areas",
        type: "stacked-bar",
        title: L(`${top[0]?.area.label ?? ""} carries the most critical findings`, `${top[0]?.area.label ?? ""} traegt die meisten kritischen Feststellungen`),
        subtitle: L("Material findings per area, by severity", "Wesentliche Feststellungen je Bereich, nach Schwere"),
        unit: L("findings", "Feststellungen"),
        series: [
          { id: "critical", label: L("Critical", "Kritisch"), tone: "critical" },
          { id: "warning", label: L("Warning", "Warnung"), tone: "warning" },
        ],
        data: scored.map((entry) => ({
          id: entry.area.id,
          label: entry.area.label,
          values: { critical: entry.critical, warning: entry.warning },
          href: `/workday/${roleId}/insights?q=${encodeURIComponent(entry.area.question)}`,
        })),
      },
      {
        id: "viz-concerns",
        type: "table",
        title: L("Each concern, with the analysis behind it", "Jedes Thema mit der Analyse dahinter"),
        columns: [
          { id: "area", label: L("Area", "Bereich") },
          { id: "concern", label: L("What the records show", "Was die Datensaetze zeigen") },
          { id: "critical", label: L("Critical", "Kritisch"), align: "end" },
        ],
        rows: scored.map((entry) => ({
          id: entry.area.id,
          cells: { area: entry.area.label, concern: entry.area.response.conclusion.slice(0, 240), critical: entry.critical },
          tone: (entry.critical > 0 ? "critical" : entry.warning > 0 ? "warning" : "neutral") as Tone,
          href: `/workday/${roleId}/insights?q=${encodeURIComponent(entry.area.question)}`,
        })),
      },
    ],
    findings,
    evidence: evidence.slice(0, 40),
    recommendations: recommendations.slice(0, 3),
    followUps: top.map((entry) => ({ label: entry.area.label, question: entry.area.question })).slice(0, 3),
  };
}
