/**
 * Show operational resilience gaps by service.
 *
 * Compares the latest observed recovery per service and entity with its
 * impact tolerance, from exercises and live events (migration 0010), and
 * names the services with no recovery evidence at all. A dependency an
 * exercise found that the service map does not hold is a gap in its own
 * right, because the next disruption will not wait for the map.
 */

import type { InsightFinding, InsightRecommendation, InsightResponseInput, Tone } from "../schema";
import { formatDate } from "../data";
import { createActionProposal, createIssueProposal, plural, recordHref, requestEvidenceProposal, tx, workHref, type BuildContext } from "./common";

function toneFor(ratio: number): Tone {
  if (ratio > 1) return "critical";
  if (ratio >= 0.85) return "warning";
  return "good";
}

export function buildResilienceGaps(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const rows = [...data.resilience]
    .map((row) => ({ row, ratio: row.observedMinutes / row.toleranceMinutes, service: data.serviceById.get(row.serviceId) }))
    .sort((a, b) => b.ratio - a.ratio);
  const over = rows.filter((entry) => entry.ratio > 1);
  const near = rows.filter((entry) => entry.ratio >= 0.85 && entry.ratio <= 1);
  const unmapped = rows.filter((entry) => entry.row.unmappedDependency);
  const tested = new Set(rows.map((entry) => entry.row.serviceId));
  const untested = data.services.filter((service) => service.id.startsWith("IBS-") && !tested.has(service.id));
  const openActions = rows.reduce((total, entry) => total + entry.row.openActions, 0);
  const worst = over[0];
  const shortService = (name: string | undefined, id: string) => (name ?? id).split(" and ")[0]?.slice(0, 38) ?? id;

  const evidence = rows.map((entry) => ({
    id: `srt-${entry.row.id}`,
    sourceType: entry.row.source === "live-event" ? L("Incident record", "Vorfallsdatensatz") : L("Resilience exercise", "Resilienzuebung"),
    sourceName: entry.row.scenario,
    recordId: entry.row.reference,
    field: "observed_minutes",
    observedAt: formatDate(entry.row.testedOn),
    freshness: "current" as const,
    excerpt: L(
      `${entry.row.observedMinutes} minutes observed against a ${entry.row.toleranceMinutes} minute tolerance. ${entry.row.finding}`,
      `${entry.row.observedMinutes} Minuten beobachtet gegen eine Toleranz von ${entry.row.toleranceMinutes} Minuten. ${entry.row.finding}`,
    ),
    href: recordHref(roleId, "resilience", entry.row.id),
  }));

  const findings: InsightFinding[] = over.map((entry) => ({
    id: `finding-over-${entry.row.id}`,
    severity: "critical",
    title: L(
      `${shortService(entry.service?.name, entry.row.serviceId)} exceeded tolerance by ${entry.row.observedMinutes - entry.row.toleranceMinutes} minutes`,
      `${shortService(entry.service?.name, entry.row.serviceId)} ueberschritt die Toleranz um ${entry.row.observedMinutes - entry.row.toleranceMinutes} Minuten`,
    ),
    detail: `${entry.row.reference}, ${formatDate(entry.row.testedOn)}: ${entry.row.finding}`,
    evidenceIds: [`srt-${entry.row.id}`],
    href: recordHref(roleId, "resilience", entry.row.id),
  }));
  for (const entry of unmapped) {
    findings.push({
      id: `finding-unmapped-${entry.row.id}`,
      severity: "warning",
      title: L("An exercise found a dependency the service map does not hold", "Eine Uebung fand eine Abhaengigkeit, die nicht in der Servicelandkarte steht"),
      detail: L(`${entry.row.unmappedDependency}, in ${entry.row.reference}.`, `${entry.row.unmappedDependency}, in ${entry.row.reference}.`),
      evidenceIds: [`srt-${entry.row.id}`],
    });
  }
  if (untested.length > 0) {
    findings.push({
      id: "finding-untested",
      severity: "warning",
      title: L(`${plural(untested.length, "service has", "services have")} no recovery evidence`, `${untested.length} Services ohne Wiederherstellungsnachweis`),
      detail: untested.map((service) => `${service.id} ${service.name}`).join("; "),
      evidenceIds: [],
    });
  }
  const payments = rows.find((entry) => entry.row.serviceId === "IBS-0004" && entry.row.entityId === "ARC-DE");
  if (payments) {
    findings.push({
      id: "finding-payments",
      severity: "watch",
      title: L(
        `Corporate payments used ${Math.round(payments.ratio * 100)} percent of its tolerance`,
        `Corporate Payments nutzte ${Math.round(payments.ratio * 100)} Prozent der Toleranz`,
      ),
      detail: payments.row.finding,
      evidenceIds: [`srt-${payments.row.id}`],
      href: workHref(roleId, "IBS-0004"),
    });
  }

  const recommendations: InsightRecommendation[] = [];
  const mapGap = unmapped[0];
  if (mapGap) {
    recommendations.push({
      id: "rec-map",
      title: L("Add the missing dependency to the service map and re-test", "Fehlende Abhaengigkeit in die Servicelandkarte aufnehmen und erneut testen"),
      rationale: L("The exercise failed on a dependency nobody had mapped; until it is mapped, no tolerance statement for the service holds.", "Die Uebung scheiterte an einer nicht erfassten Abhaengigkeit; bis sie erfasst ist, gilt keine Toleranzaussage fuer den Service."),
      urgency: "now",
      proposedAction: createActionProposal(context, {
        id: "act-map",
        title: L(`Map and test the failover dependency of ${mapGap.row.serviceId}`, `Failover-Abhaengigkeit von ${mapGap.row.serviceId} erfassen und testen`),
        description: L(
          `Add ${mapGap.row.unmappedDependency} to the service map of ${mapGap.service?.name ?? mapGap.row.serviceId}, agree the failover design with the supplier and re-run ${mapGap.row.reference}.`,
          `${mapGap.row.unmappedDependency} in die Servicelandkarte von ${mapGap.service?.name ?? mapGap.row.serviceId} aufnehmen, Failover-Design mit dem Dienstleister vereinbaren und ${mapGap.row.reference} wiederholen.`,
        ),
        ownerUserId: "P-005",
        dueInDays: 30,
        priority: "high",
        relatedKind: "service",
        relatedId: mapGap.row.serviceId,
        relatedLabel: mapGap.service?.name ?? mapGap.row.serviceId,
        entityId: mapGap.row.entityId,
        rationale: L("Recovery exceeded tolerance on an unmapped dependency.", "Wiederherstellung ueberschritt Toleranz wegen unerfasster Abhaengigkeit."),
        evidenceIds: [`srt-${mapGap.row.id}`],
      }),
    });
    recommendations.push({
      id: "rec-declare",
      title: L("Ask the platform supplier for its failover design", "Den Plattformdienstleister um sein Failover-Design bitten"),
      rationale: L("The dependency sits inside the supplier; only the supplier can evidence how it fails over.", "Die Abhaengigkeit liegt beim Dienstleister; nur er kann das Failover nachweisen."),
      urgency: "this-week",
      proposedAction: requestEvidenceProposal(context, {
        id: "act-failover",
        what: L("Failover design and test evidence for the Basalt Cloud object storage the platform uses", "Failover-Design und Testnachweis fuer den Basalt-Cloud-Objektspeicher der Plattform"),
        fromUserId: null,
        fromLabel: L("Fernblick Digital Banking Platform GmbH, service manager", "Fernblick Digital Banking Platform GmbH, Service Management"),
        dueInDays: 14,
        relatedKind: "service",
        relatedId: mapGap.row.serviceId,
        relatedLabel: mapGap.service?.name ?? mapGap.row.serviceId,
        rationale: L("Undeclared supplier dependency.", "Nicht gemeldete Abhaengigkeit beim Dienstleister."),
        evidenceIds: [`srt-${mapGap.row.id}`],
      }),
    });
  }
  const unescalated = over.find((entry) => entry.row.finding.toLowerCase().includes("not escalated"));
  if (unescalated) {
    recommendations.push({
      id: "rec-escalate",
      title: L(`Raise the unescalated breach on ${unescalated.row.serviceId}`, `Die nicht eskalierte Ueberschreitung bei ${unescalated.row.serviceId} erfassen`),
      rationale: L("A recovery beyond tolerance that nobody escalated is the finding CTL-RES-003 exists to prevent.", "Eine nicht eskalierte Ueberschreitung ist genau das, was CTL-RES-003 verhindern soll."),
      urgency: "this-week",
      proposedAction: createIssueProposal(context, {
        id: "act-escalate",
        title: L(`Recovery beyond tolerance on ${unescalated.row.serviceId} was not escalated`, `Ueberschreitung der Toleranz bei ${unescalated.row.serviceId} wurde nicht eskaliert`),
        description: `${unescalated.row.reference}, ${formatDate(unescalated.row.testedOn)}: ${unescalated.row.finding}`,
        severity: "high",
        ownerUserId: "P-005",
        dueInDays: 21,
        controlIds: ["CTL-RES-003"],
        relatedKind: "service",
        relatedId: unescalated.row.serviceId,
        relatedLabel: unescalated.service?.name ?? unescalated.row.serviceId,
        rationale: L("Breach without escalation.", "Ueberschreitung ohne Eskalation."),
        evidenceIds: [`srt-${unescalated.row.id}`],
      }),
    });
  }

  return {
    version: 1,
    intentId: "resilience-gaps",
    question: context.question,
    title: L("Operational resilience gaps by service", "Luecken der operationellen Resilienz je Service"),
    conclusion: worst
      ? L(
          `${plural(over.length, "service recovered", "services recovered")} beyond tolerance, worst ${shortService(worst.service?.name, worst.row.serviceId)} at ${worst.row.observedMinutes} against ${worst.row.toleranceMinutes} minutes${unmapped.length ? ", on a dependency the service map does not hold" : ""}.`,
          `${over.length} Services erholten sich ausserhalb der Toleranz, am deutlichsten ${shortService(worst.service?.name, worst.row.serviceId)} mit ${worst.row.observedMinutes} gegen ${worst.row.toleranceMinutes} Minuten${unmapped.length ? ", wegen einer nicht erfassten Abhaengigkeit" : ""}.`,
        )
      : L("Every tested service recovered inside its tolerance.", "Alle getesteten Services erholten sich innerhalb der Toleranz."),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L(`${rows.length} recovery measurements across ${tested.size} services`, `${rows.length} Wiederherstellungsmessungen ueber ${tested.size} Services`),
    plan: {
      using: [L("Resilience exercises", "Resilienzuebungen"), L("Incident records", "Vorfallsdatensaetze"), L("Impact tolerances", "Auswirkungstoleranzen"), L("Service map", "Servicelandkarte")],
      timeWindow: L("Latest measurement per service and entity, 2026", "Letzte Messung je Service und Einheit, 2026"),
      groupedBy: L("Service and entity", "Service und Einheit"),
      output: L("Recovery against tolerance", "Wiederherstellung gegen Toleranz"),
    },
    confidence: {
      level: untested.length ? "medium" : "high",
      explanation: untested.length
        ? L("Exact for the services measured; the services without evidence cannot be placed at all.", "Exakt fuer die gemessenen Services; Services ohne Nachweis lassen sich nicht einordnen.")
        : L("Exact for every service measured.", "Exakt fuer alle gemessenen Services."),
    },
    metrics: [
      { id: "m-over", label: L("Beyond tolerance", "Ausserhalb der Toleranz"), value: over.length, status: over.length ? "critical" : "good" },
      { id: "m-near", label: L("Above 85 percent", "Ueber 85 Prozent"), value: near.length, status: near.length ? "warning" : "good" },
      { id: "m-unmapped", label: L("Unmapped dependencies", "Unerfasste Abhaengigkeiten"), value: unmapped.length, status: unmapped.length ? "warning" : "good" },
      { id: "m-untested", label: L("Services without evidence", "Services ohne Nachweis"), value: untested.length, status: untested.length ? "watch" : "good" },
      { id: "m-actions", label: L("Open exercise actions", "Offene Uebungsmassnahmen"), value: openActions, status: "neutral" },
    ],
    visualisations: [
      {
        id: "viz-bullet",
        type: "bullet",
        title: worst
          ? L(`${shortService(worst.service?.name, worst.row.serviceId)} took ${worst.row.observedMinutes - worst.row.toleranceMinutes} minutes longer than its tolerance`, `${shortService(worst.service?.name, worst.row.serviceId)} brauchte ${worst.row.observedMinutes - worst.row.toleranceMinutes} Minuten laenger als die Toleranz`)
          : L("Every service recovered inside tolerance", "Alle Services innerhalb der Toleranz"),
        subtitle: L("Observed recovery against impact tolerance, latest measurement", "Beobachtete Wiederherstellung gegen Toleranz, letzte Messung"),
        explanation: L("The bar is the observed recovery; the tick is the tolerance. A bar past its tick is a breach.", "Der Balken ist die beobachtete Wiederherstellung, die Markierung die Toleranz. Ein Balken ueber der Markierung ist eine Ueberschreitung."),
        unit: L("minutes", "Minuten"),
        data: rows.map((entry) => ({
          id: entry.row.id,
          label: shortService(entry.service?.name, entry.row.serviceId),
          sublabel: `${entry.row.serviceId}, ${entry.row.entityId}, ${entry.row.reference}`,
          target: entry.row.toleranceMinutes,
          actual: entry.row.observedMinutes,
          targetLabel: L(`tolerance ${entry.row.toleranceMinutes}`, `Toleranz ${entry.row.toleranceMinutes}`),
          tone: toneFor(entry.ratio),
          href: recordHref(roleId, "resilience", entry.row.id),
        })),
      },
      {
        id: "viz-exercises",
        type: "table",
        title: L("What each measurement found", "Was jede Messung ergab"),
        columns: [
          { id: "service", label: L("Service", "Service") },
          { id: "reference", label: L("Measured in", "Gemessen in") },
          { id: "date", label: L("Date", "Datum"), align: "end" },
          { id: "used", label: L("Tolerance used", "Toleranz genutzt"), align: "end" },
          { id: "finding", label: L("Finding", "Ergebnis") },
        ],
        rows: rows.map((entry) => ({
          id: entry.row.id,
          cells: {
            service: `${entry.row.serviceId} ${entry.row.entityId}`,
            reference: entry.row.reference,
            date: formatDate(entry.row.testedOn),
            used: `${Math.round(entry.ratio * 100)}%`,
            finding: entry.row.finding.slice(0, 160),
          },
          tone: toneFor(entry.ratio),
          href: recordHref(roleId, "resilience", entry.row.id),
        })),
      },
    ],
    findings,
    evidence,
    recommendations,
    followUps: [
      { label: L("Concentration", "Konzentration"), question: L("Where do we have provider concentration across critical services?", "Wo bestehen Anbieterkonzentrationen bei kritischen Services?") },
      { label: L("Expiring acceptances", "Ablaufende Akzeptanzen"), question: L("Which risk acceptances expire in the next 90 days?", "Welche Risikoakzeptanzen laufen in den naechsten 90 Tagen ab?") },
    ],
  };
}
