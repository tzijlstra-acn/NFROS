/**
 * Which risk acceptances expire in the next 90 days?
 *
 * Reads the risk acceptance register (migration 0010). An acceptance whose
 * conditions are unmet at expiry cannot simply be renewed; it needs a
 * decision. Lapsed and renewal-requested acceptances are shown beside the
 * expiring ones, because a lapse is the outcome the register exists to
 * prevent.
 */

import type { InsightFinding, InsightRecommendation, InsightResponseInput, Tone } from "../schema";
import { daysBetween, formatDate, personName } from "../data";
import { createActionProposal, decisionsHref, dueIn, plural, recordHref, requestEvidenceProposal, tx, type BuildContext } from "./common";

export function buildExpiringAcceptances(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const today = data.scope.today;
  const horizon = dueIn(context, 90);
  const expiring = data.acceptances
    .filter((row) => row.status === "active" && row.expiresOn >= today && row.expiresOn <= horizon)
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  const unmet = expiring.filter((row) => !row.conditionsMet);
  const lapsed = data.acceptances.filter((row) => row.status === "expired" || row.status === "renewal-requested");
  const nearest = expiring[0];
  const subject = (row: (typeof expiring)[number]) => `${row.subjectLabel} (${row.subjectId})`;
  const riskTitle = (riskId: string) => data.risks.find((risk) => risk.id === riskId)?.title ?? riskId;

  const evidence = [...expiring, ...lapsed].map((row) => ({
    id: `ra-${row.id}`,
    sourceType: L("Risk acceptance register", "Register der Risikoakzeptanzen"),
    sourceName: row.title,
    recordId: row.reference,
    field: "expires_on",
    observedAt: formatDate(row.grantedOn),
    freshness: "current" as const,
    excerpt: L(
      `${row.riskId}, ${subject(row)}. Expires ${formatDate(row.expiresOn)}. Conditions: ${row.conditions} ${row.conditionsMet ? "Met." : "Not met."}`,
      `${row.riskId}, ${subject(row)}. Ablauf ${formatDate(row.expiresOn)}. Bedingungen: ${row.conditions} ${row.conditionsMet ? "Erfuellt." : "Nicht erfuellt."}`,
    ),
    href: recordHref(roleId, "risk-acceptances", row.id),
  }));
  const decisionOnRisk = (riskId: string) =>
    data.decisions.find((decision) => decision.judgmentKind === "risk-acceptance" && decision.relatedObjectId === riskId);

  const findings: InsightFinding[] = unmet.slice(0, 4).map((row) => {
    const decision = decisionOnRisk(row.riskId);
    return {
      id: `finding-${row.id}`,
      severity: daysBetween(today, row.expiresOn) <= 30 ? "critical" : "warning",
      title: L(
        `${row.reference} expires in ${daysBetween(today, row.expiresOn)} days on an unmet condition`,
        `${row.reference} laeuft in ${daysBetween(today, row.expiresOn)} Tagen bei unerfuellter Bedingung ab`,
      ),
      detail: L(
        `${row.title}. ${riskTitle(row.riskId)}. Condition: ${row.conditions}${row.issueId ? ` Open issue ${row.issueId}.` : ""}${decision ? ` A decision on it is open (${decision.reference}).` : ""}`,
        `${row.title}. ${riskTitle(row.riskId)}. Bedingung: ${row.conditions}${row.issueId ? ` Offene Feststellung ${row.issueId}.` : ""}${decision ? ` Eine Entscheidung dazu ist offen (${decision.reference}).` : ""}`,
      ),
      evidenceIds: [`ra-${row.id}`],
      href: recordHref(roleId, "risk-acceptances", row.id),
    };
  });
  if (lapsed.length > 0) {
    findings.push({
      id: "finding-lapsed",
      severity: "warning",
      title: L(`${plural(lapsed.length, "acceptance has", "acceptances have")} already lapsed or await renewal`, `${lapsed.length} Akzeptanzen sind bereits abgelaufen oder warten auf Verlaengerung`),
      detail: lapsed
        .map((row) => L(`${row.reference} (${row.status === "expired" ? "expired" : "renewal requested"} ${formatDate(row.expiresOn)})`, `${row.reference} (${row.status === "expired" ? "abgelaufen" : "Verlaengerung beantragt"} ${formatDate(row.expiresOn)})`))
        .join(", "),
      evidenceIds: lapsed.map((row) => `ra-${row.id}`),
    });
  }

  const recommendations: InsightRecommendation[] = [];
  const novalink = unmet.find((row) => row.riskId === "RSK-0184");
  if (novalink) {
    const decision = decisionOnRisk("RSK-0184");
    recommendations.push({
      id: "rec-condition-evidence",
      title: L(`Request the condition status for ${novalink.reference}`, `Bedingungsstatus fuer ${novalink.reference} anfordern`),
      rationale: L(
        "The acceptance behind the Novalink concentration rests on two conditions; neither is evidenced today.",
        "Die Akzeptanz zur Novalink-Konzentration beruht auf zwei Bedingungen; keine ist heute nachgewiesen.",
      ),
      urgency: "now",
      proposedAction: requestEvidenceProposal(context, {
        id: "act-condition-evidence",
        what: L(
          `Status and evidence for each condition of ${novalink.reference}: recovery objective evidence and the exit test plan`,
          `Status und Nachweis je Bedingung von ${novalink.reference}: Nachweis des Wiederherstellungsziels und Plan fuer den Exit-Test`,
        ),
        fromUserId: novalink.ownerUserId,
        fromLabel: personName(data, novalink.ownerUserId),
        dueInDays: 7,
        relatedKind: "risk",
        relatedId: novalink.riskId,
        relatedLabel: riskTitle(novalink.riskId),
        rationale: L("Conditions unmet ahead of expiry.", "Bedingungen vor Ablauf unerfuellt."),
        evidenceIds: [`ra-${novalink.id}`],
      }),
    });
    if (decision) {
      recommendations.push({
        id: "rec-decision",
        title: L(`Open decision ${decision.reference} holds the judgment`, `Offene Entscheidung ${decision.reference} haelt die Beurteilung`),
        rationale: L("Renewing, re-conditioning or closing the acceptance is a human decision with its own record.", "Verlaengerung, neue Bedingungen oder Schliessung sind eine menschliche Entscheidung mit eigenem Datensatz."),
        urgency: "this-week",
        href: decisionsHref(roleId),
      });
    }
  }
  if (nearest && !nearest.conditionsMet) {
    recommendations.push({
      id: "rec-nearest",
      title: L(`Prepare renewal or closure of ${nearest.reference} before ${formatDate(nearest.expiresOn)}`, `Verlaengerung oder Schliessung von ${nearest.reference} vor dem ${formatDate(nearest.expiresOn)} vorbereiten`),
      rationale: L(`${daysBetween(today, nearest.expiresOn)} days remain and the condition is unmet.`, `Es bleiben ${daysBetween(today, nearest.expiresOn)} Tage und die Bedingung ist unerfuellt.`),
      urgency: "this-week",
      proposedAction: createActionProposal(context, {
        id: "act-nearest",
        title: L(`Prepare renewal or closure of ${nearest.reference}`, `Verlaengerung oder Schliessung von ${nearest.reference} vorbereiten`),
        description: L(
          `${nearest.title}. Condition unmet: ${nearest.conditions} Prepare the renewal case or the closure for the approver, ${personName(data, nearest.approverUserId)}.`,
          `${nearest.title}. Bedingung unerfuellt: ${nearest.conditions} Verlaengerung oder Schliessung fuer die Genehmigung durch ${personName(data, nearest.approverUserId)} vorbereiten.`,
        ),
        ownerUserId: nearest.ownerUserId,
        dueInDays: Math.max(3, daysBetween(today, nearest.expiresOn) - 7),
        priority: "high",
        relatedKind: "risk",
        relatedId: nearest.riskId,
        relatedLabel: riskTitle(nearest.riskId),
        entityId: nearest.entityId,
        rationale: L("Nearest expiry with an unmet condition.", "Naechster Ablauf mit unerfuellter Bedingung."),
        evidenceIds: [`ra-${nearest.id}`],
      }),
    });
  }

  const start = (() => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 45);
    return date.toISOString().slice(0, 10);
  })();
  const lane = (row: (typeof data.acceptances)[number]) => (row.status !== "active" ? "lapsed" : row.conditionsMet ? "met" : "unmet");
  const laneTone: Record<string, Tone> = { met: "good", unmet: "critical", lapsed: "warning" };

  return {
    version: 1,
    intentId: "expiring-acceptances",
    question: context.question,
    title: L("Risk acceptances expiring in 90 days", "Risikoakzeptanzen mit Ablauf in 90 Tagen"),
    conclusion: L(
      `${plural(expiring.length, "risk acceptance expires", "risk acceptances expire")} within 90 days and ${unmet.length} of them rest on unmet conditions${nearest ? `; the first, ${nearest.reference}, in ${daysBetween(today, nearest.expiresOn)} days` : ""}.`,
      `${expiring.length} Risikoakzeptanzen laufen in 90 Tagen ab, ${unmet.length} davon bei unerfuellten Bedingungen${nearest ? `; die erste, ${nearest.reference}, in ${daysBetween(today, nearest.expiresOn)} Tagen` : ""}.`,
    ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L(`${data.acceptances.length} acceptances in the group register`, `${data.acceptances.length} Akzeptanzen im Gruppenregister`),
    plan: {
      using: [L("Risk acceptance register", "Register der Risikoakzeptanzen"), L("Risk register", "Risikoregister"), L("Issue register", "Feststellungsregister"), L("Open decisions", "Offene Entscheidungen")],
      timeWindow: L(`${formatDate(today)} to ${formatDate(horizon)}, with lapses in the last 45 days`, `${formatDate(today)} bis ${formatDate(horizon)}, mit Abgaengen der letzten 45 Tage`),
      groupedBy: L("Condition status", "Bedingungsstatus"),
      output: L("Expiry timeline and register extract", "Ablaufzeitachse und Registerauszug"),
    },
    confidence: { level: "high", explanation: L("Read from the register as recorded. Whether a condition is met is the owner's recorded statement.", "Aus dem Register gelesen. Ob eine Bedingung erfuellt ist, ist die erfasste Aussage der Verantwortlichen.") },
    metrics: [
      { id: "m-expiring", label: L("Expiring in 90 days", "Ablauf in 90 Tagen"), value: expiring.length, status: "warning" },
      { id: "m-unmet", label: L("Conditions unmet", "Bedingungen unerfuellt"), value: `${unmet.length} / ${expiring.length}`, status: unmet.length ? "critical" : "good" },
      { id: "m-nearest", label: L("Nearest expiry", "Naechster Ablauf"), value: nearest ? daysBetween(today, nearest.expiresOn) : 0, unit: L("days", "Tage"), status: "watch", deltaLabel: nearest?.reference },
      { id: "m-lapsed", label: L("Lapsed or awaiting renewal", "Abgelaufen oder in Verlaengerung"), value: lapsed.length, status: lapsed.length ? "warning" : "good" },
    ],
    visualisations: [
      {
        id: "viz-timeline",
        type: "timeline",
        title: L(`${unmet.length} of the ${expiring.length} expiries before January rest on unmet conditions`, `${unmet.length} der ${expiring.length} Ablaeufe vor Januar beruhen auf unerfuellten Bedingungen`),
        subtitle: L("Expiry date per acceptance, by condition status", "Ablaufdatum je Akzeptanz, nach Bedingungsstatus"),
        explanation: L("Each mark is an acceptance on the date it expires. The line is the scenario day.", "Jede Markierung ist eine Akzeptanz an ihrem Ablaufdatum. Die Linie ist der Szenariotag."),
        start,
        end: horizon,
        today,
        lanes: [
          { id: "unmet", label: L("Conditions not met", "Bedingungen nicht erfuellt") },
          { id: "met", label: L("Conditions met", "Bedingungen erfuellt") },
          { id: "lapsed", label: L("Lapsed or renewing", "Abgelaufen oder in Verlaengerung") },
        ],
        events: [...expiring, ...lapsed.filter((row) => row.expiresOn >= start)].map((row) => ({
          id: row.id,
          lane: lane(row),
          date: row.expiresOn,
          label: `${row.reference} ${row.subjectLabel.split(" ")[0]}`,
          tone: laneTone[lane(row)] ?? "neutral",
          href: recordHref(roleId, "risk-acceptances", row.id),
        })),
      },
      {
        id: "viz-register",
        type: "table",
        title: L("The register extract", "Der Registerauszug"),
        columns: [
          { id: "reference", label: L("Acceptance", "Akzeptanz") },
          { id: "subject", label: L("Subject", "Gegenstand") },
          { id: "expires", label: L("Expires", "Ablauf"), align: "end" },
          { id: "days", label: L("Days", "Tage"), align: "end" },
          { id: "conditions", label: L("Conditions", "Bedingungen") },
          { id: "owner", label: L("Owner", "Verantwortlich") },
        ],
        rows: [...expiring, ...lapsed].map((row) => ({
          id: row.id,
          cells: {
            reference: row.reference,
            subject: row.subjectLabel,
            expires: formatDate(row.expiresOn),
            days: daysBetween(today, row.expiresOn),
            conditions: row.status !== "active" ? (row.status === "expired" ? L("Lapsed", "Abgelaufen") : L("Renewal requested", "Verlaengerung beantragt")) : row.conditionsMet ? L("Met", "Erfuellt") : L("Not met", "Nicht erfuellt"),
            owner: personName(data, row.ownerUserId),
          },
          tone: laneTone[lane(row)] ?? "neutral",
          href: recordHref(roleId, "risk-acceptances", row.id),
        })),
      },
    ],
    findings,
    evidence,
    recommendations: recommendations.slice(0, 4),
    followUps: [
      { label: L("Who is deteriorating", "Wer verschlechtert sich"), question: L("Which critical third-party services are deteriorating, and why?", "Welche kritischen Drittparteien-Services verschlechtern sich, und warum?") },
      { label: L("Overdue issues", "Ueberfaellige Feststellungen"), question: L("Which high-severity issues are overdue?", "Welche Feststellungen mit hohem Schweregrad sind ueberfaellig?") },
    ],
  };
}
