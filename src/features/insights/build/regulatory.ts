/**
 * Which areas are affected by the latest policy change?
 *
 * Takes the regulatory publications of the last 90 days and follows each
 * extracted obligation to the policies, processes and controls it names, and
 * to its owner. Policies past their own review date and obligations with no
 * owner are called out, because those are where the change lands on nobody.
 * Applicability itself is a human interpretation and is not decided here.
 */

import type { InsightFinding, InsightRecommendation, InsightResponseInput, Tone } from "../schema";
import { daysBetween, formatDate, personName } from "../data";
import { createActionProposal, joinNames, plural, tx, workHref, type BuildContext } from "./common";

export function buildPolicyImpact(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const today = data.scope.today;
  const recent = data.publications
    .filter((publication) => daysBetween(publication.publishedOn, today) <= 90 && publication.publishedOn <= today)
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
  const latest = recent[0];
  const obligations = data.obligations.filter((obligation) => recent.some((publication) => publication.id === obligation.publicationId));
  const policiesNamed = new Set(obligations.flatMap((obligation) => obligation.policyIds ?? []));
  const processesNamed = new Set(obligations.flatMap((obligation) => obligation.processIds ?? []));
  const controlsNamed = new Set(obligations.flatMap((obligation) => obligation.controlIds ?? []));
  const unowned = obligations.filter((obligation) => obligation.isUnownedGap || !obligation.ownerUserId);
  const policyRows = data.policies.filter((policy) => policiesNamed.has(policy.id));
  const overdueReview = policyRows.filter((policy) => policy.nextReviewDue && policy.nextReviewDue < today);
  const soonest = [...recent].filter((publication) => publication.effectiveFrom).sort((a, b) => (a.effectiveFrom ?? "").localeCompare(b.effectiveFrom ?? ""))[0];
  const controlTouched = [...controlsNamed][0];
  const controlRecorded = data.controls.find((control) => control.id === controlTouched);
  const pubLabel = (id: string) => data.publications.find((publication) => publication.id === id)?.reference ?? id;
  const countFor = (publicationId: string) => obligations.filter((obligation) => obligation.publicationId === publicationId).length;
  const busiest = [...recent].sort((x, y) => countFor(y.id) - countFor(x.id))[0];
  const busiestCount = busiest ? countFor(busiest.id) : 0;

  const evidence = [
    ...recent.map((publication) => ({
      id: `pub-${publication.id}`,
      sourceType: L("Regulatory publication", "Regulatorische Veroeffentlichung"),
      sourceName: publication.title,
      recordId: publication.reference,
      field: "effective_from",
      observedAt: formatDate(publication.publishedOn),
      freshness: "current" as const,
      excerpt: L(
        `${publication.instrumentType}, ${publication.jurisdiction.toUpperCase()}, published ${formatDate(publication.publishedOn)}${publication.effectiveFrom ? `, effective ${formatDate(publication.effectiveFrom)}` : ", consultation"}.`,
        `${publication.instrumentType}, ${publication.jurisdiction.toUpperCase()}, veroeffentlicht ${formatDate(publication.publishedOn)}${publication.effectiveFrom ? `, wirksam ${formatDate(publication.effectiveFrom)}` : ", Konsultation"}.`,
      ),
      href: workHref(roleId, publication.id),
    })),
    ...overdueReview.map((policy) => ({
      id: `pol-${policy.id}`,
      sourceType: L("Policy register", "Richtlinienregister"),
      sourceName: `${policy.reference} ${lang === "de" && policy.titleDe ? policy.titleDe : policy.title}`.slice(0, 240),
      recordId: policy.id,
      field: "next_review_due",
      observedAt: formatDate(policy.effectiveFrom ?? today),
      freshness: "stale" as const,
      excerpt: L(`Version ${policy.version}; review was due ${formatDate(policy.nextReviewDue ?? today)}.`, `Version ${policy.version}; Pruefung war faellig am ${formatDate(policy.nextReviewDue ?? today)}.`),
      href: workHref(roleId, policy.id),
    })),
  ];

  const findings: InsightFinding[] = [];
  if (controlTouched && soonest?.effectiveFrom) {
    findings.push({
      id: "finding-control",
      severity: "critical",
      title: L(
        `${pubLabel(soonest.id)} takes effect in ${daysBetween(today, soonest.effectiveFrom)} days and names ${controlTouched}`,
        `${pubLabel(soonest.id)} wird in ${daysBetween(today, soonest.effectiveFrom)} Tagen wirksam und nennt ${controlTouched}`,
      ),
      detail: L(
        `${controlTouched} is the control whose 2026 tests show exceptions while it is recorded ${controlRecorded?.currentEffectiveness ?? ""}; the new obligations land on a control already in dispute.`,
        `${controlTouched} ist die Kontrolle, deren Tests 2026 Ausnahmen zeigen, waehrend sie als ${controlRecorded?.currentEffectiveness ?? ""} erfasst ist; die neuen Pflichten treffen eine bereits strittige Kontrolle.`,
      ),
      evidenceIds: [`pub-${soonest.id}`],
      href: workHref(roleId, controlTouched),
    });
  }
  if (overdueReview.length > 0) {
    findings.push({
      id: "finding-policies",
      severity: "warning",
      title: L(`${plural(overdueReview.length, "named policy is", "named policies are")} past their review date`, `${overdueReview.length} genannte Richtlinien haben ihr Pruefdatum ueberschritten`),
      detail: L(
        `${joinNames(overdueReview.map((policy) => policy.reference), lang)} are named by the new obligations and were due for review ${formatDate(overdueReview[0]?.nextReviewDue ?? today)}.`,
        `${joinNames(overdueReview.map((policy) => policy.reference), lang)} werden von den neuen Pflichten genannt und waren am ${formatDate(overdueReview[0]?.nextReviewDue ?? today)} zur Pruefung faellig.`,
      ),
      evidenceIds: overdueReview.map((policy) => `pol-${policy.id}`),
    });
  }
  if (unowned.length > 0) {
    findings.push({
      id: "finding-unowned",
      severity: "warning",
      title: L(`${plural(unowned.length, "obligation has", "obligations have")} no owner`, `${unowned.length} Pflichten ohne Verantwortung`),
      detail: unowned.map((obligation) => `${obligation.id} (${pubLabel(obligation.publicationId)})`).join(", "),
      evidenceIds: [...new Set(unowned.map((obligation) => `pub-${obligation.publicationId}`))],
    });
  }

  const recommendations: InsightRecommendation[] = [];
  if (unowned.length > 0) {
    recommendations.push({
      id: "rec-owners",
      title: L(`Assign owners to the ${unowned.length} unowned obligations`, `Verantwortliche fuer die ${unowned.length} Pflichten ohne Verantwortung benennen`),
      rationale: L("Implementation planning cannot start on an obligation nobody owns.", "Ohne Verantwortung kann die Umsetzung einer Pflicht nicht beginnen."),
      urgency: "this-week",
      proposedAction: createActionProposal(context, {
        id: "act-owners",
        title: L("Assign owners to unowned regulatory obligations", "Verantwortliche fuer Pflichten ohne Verantwortung benennen"),
        description: L(`Name an owner for ${unowned.map((obligation) => obligation.id).join(", ")}.`, `Verantwortliche fuer ${unowned.map((obligation) => obligation.id).join(", ")} benennen.`),
        ownerUserId: "P-006",
        dueInDays: 10,
        priority: "high",
        relatedKind: "publication",
        relatedId: latest?.id ?? "",
        relatedLabel: latest?.reference ?? "",
        rationale: L("Obligations without owners.", "Pflichten ohne Verantwortung."),
        evidenceIds: [...new Set(unowned.map((obligation) => `pub-${obligation.publicationId}`))],
      }),
    });
  }
  if (overdueReview.length > 0 && soonest) {
    recommendations.push({
      id: "rec-review",
      title: L(`Review ${joinNames(overdueReview.map((policy) => policy.reference), lang)} against ${pubLabel(soonest.id)}`, `${joinNames(overdueReview.map((policy) => policy.reference), lang)} gegen ${pubLabel(soonest.id)} pruefen`),
      rationale: L("The overdue review and the new circular can be one piece of work.", "Die ueberfaellige Pruefung und das neue Rundschreiben koennen eine Arbeit sein."),
      urgency: "this-month",
      proposedAction: createActionProposal(context, {
        id: "act-review",
        title: L(`Review overdue policies against ${pubLabel(soonest.id)}`, `Ueberfaellige Richtlinien gegen ${pubLabel(soonest.id)} pruefen`),
        description: L(
          `Combine the overdue reviews of ${overdueReview.map((policy) => policy.reference).join(", ")} with the gap analysis for ${pubLabel(soonest.id)}, effective ${formatDate(soonest.effectiveFrom ?? today)}.`,
          `Die ueberfaelligen Pruefungen von ${overdueReview.map((policy) => policy.reference).join(", ")} mit der Lueckenanalyse fuer ${pubLabel(soonest.id)} (wirksam ${formatDate(soonest.effectiveFrom ?? today)}) verbinden.`,
        ),
        ownerUserId: overdueReview[0]?.ownerUserId ?? "P-006",
        dueInDays: 30,
        priority: "medium",
        relatedKind: "policy",
        relatedId: overdueReview[0]?.id ?? "",
        relatedLabel: overdueReview[0]?.reference ?? "",
        rationale: L("Overdue policy review meets a new obligation.", "Ueberfaellige Richtlinienpruefung trifft neue Pflicht."),
        evidenceIds: overdueReview.map((policy) => `pol-${policy.id}`),
      }),
    });
  }

  const cellTone = (count: number, critical: boolean): Tone => (count === 0 ? "neutral" : critical ? "critical" : "watch");

  return {
    version: 1,
    intentId: "policy-change-impact",
    question: context.question,
    title: L("Impact of the latest regulatory change", "Auswirkung der neuesten regulatorischen Aenderung"),
    conclusion: L(
      `${recent.length} publications in the last 90 days bring ${obligations.length} obligations touching ${plural(policiesNamed.size, "policy", "policies")}, ${plural(processesNamed.size, "process", "processes")} and ${plural(controlsNamed.size, "control", "controls")}; ${unowned.length} have no owner.`,
      `${recent.length} Veroeffentlichungen der letzten 90 Tage bringen ${obligations.length} Pflichten mit Bezug zu ${policiesNamed.size} Richtlinien, ${processesNamed.size} Prozessen und ${controlsNamed.size} Kontrollen; ${unowned.length} ohne Verantwortung.`,
    ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L(`${data.publications.length} publications and ${data.obligations.length} extracted obligations`, `${data.publications.length} Veroeffentlichungen und ${data.obligations.length} extrahierte Pflichten`),
    plan: {
      using: [L("Regulatory publications", "Regulatorische Veroeffentlichungen"), L("Extracted obligations", "Extrahierte Pflichten"), L("Policy register", "Richtlinienregister"), L("Control inventory", "Kontrollinventar")],
      timeWindow: L(`Published since ${formatDate(recent.at(-1)?.publishedOn ?? today)}`, `Veroeffentlicht seit ${formatDate(recent.at(-1)?.publishedOn ?? today)}`),
      groupedBy: L("Obligation", "Pflicht"),
      output: L("Coverage matrix", "Abdeckungsmatrix"),
    },
    confidence: {
      level: "medium",
      explanation: L("The mapping is as extracted and recorded. Applicability per entity is a human interpretation still open for several obligations.", "Die Zuordnung ist wie extrahiert und erfasst. Die Anwendbarkeit je Einheit ist fuer mehrere Pflichten noch offen."),
    },
    metrics: [
      { id: "m-obligations", label: L("New obligations", "Neue Pflichten"), value: obligations.length, status: "neutral", deltaLabel: L(`from ${recent.length} publications`, `aus ${recent.length} Veroeffentlichungen`) },
      { id: "m-policies", label: L("Policies named", "Genannte Richtlinien"), value: policiesNamed.size, status: "watch" },
      { id: "m-controls", label: L("Controls named", "Genannte Kontrollen"), value: controlsNamed.size, status: controlsNamed.size ? "warning" : "neutral" },
      { id: "m-unowned", label: L("Without owner", "Ohne Verantwortung"), value: unowned.length, status: unowned.length ? "warning" : "good" },
      { id: "m-first", label: L("First effective in", "Zuerst wirksam in"), value: soonest?.effectiveFrom ? daysBetween(today, soonest.effectiveFrom) : 0, unit: L("days", "Tage"), status: "watch", deltaLabel: soonest ? pubLabel(soonest.id) : undefined },
    ],
    visualisations: [
      {
        id: "viz-matrix",
        type: "heatmap",
        title: L(
          `${unowned.length} of ${obligations.length} new obligations have no owner; ${controlsNamed.size ? `${[...controlsNamed].join(", ")} is the control they reach` : "none reaches a control yet"}`,
          `${unowned.length} von ${obligations.length} neuen Pflichten ohne Verantwortung; ${controlsNamed.size ? `${[...controlsNamed].join(", ")} ist die betroffene Kontrolle` : "keine betrifft bisher eine Kontrolle"}`,
        ),
        subtitle: L("What each new obligation touches, and who owns it", "Was jede neue Pflicht betrifft und wer verantwortlich ist"),
        explanation: L("One row per obligation. The numbers count the policies, processes and controls it names; red in the owner column means nobody owns it.", "Eine Zeile je Pflicht. Die Zahlen zaehlen die genannten Richtlinien, Prozesse und Kontrollen; Rot in der Spalte Verantwortung heisst: niemand."),
        columns: [L("Policies", "Richtlinien"), L("Processes", "Prozesse"), L("Controls", "Kontrollen"), L("Owner", "Verantwortung"), L("Effective", "Wirksam")],
        rows: obligations.map((obligation) => ({
          id: obligation.id,
          label: obligation.id.replace("OBL-2026-", ""),
          sublabel: `${pubLabel(obligation.publicationId)}, ${obligation.theme}`,
          href: workHref(roleId, obligation.id),
        })),
        cells: obligations.flatMap((obligation) => {
          const publication = data.publications.find((entry) => entry.id === obligation.publicationId);
          const owner = obligation.ownerUserId && !obligation.isUnownedGap ? personName(data, obligation.ownerUserId).split(" ").slice(-1)[0] ?? "" : "";
          return [
            { row: obligation.id, column: L("Policies", "Richtlinien"), tone: cellTone((obligation.policyIds ?? []).length, false), text: String((obligation.policyIds ?? []).length) },
            { row: obligation.id, column: L("Processes", "Prozesse"), tone: cellTone((obligation.processIds ?? []).length, false), text: String((obligation.processIds ?? []).length) },
            { row: obligation.id, column: L("Controls", "Kontrollen"), tone: cellTone((obligation.controlIds ?? []).length, true), text: String((obligation.controlIds ?? []).length) },
            { row: obligation.id, column: L("Owner", "Verantwortung"), tone: owner ? "good" : "critical", text: owner ? owner.slice(0, 14) : L("none", "keine") },
            { row: obligation.id, column: L("Effective", "Wirksam"), tone: publication?.effectiveFrom ? "neutral" : "accent", text: publication?.effectiveFrom ? formatDate(publication.effectiveFrom).slice(3) : L("consult", "Konsult.") },
          ];
        }),
        legend: [
          { tone: "watch", label: L("Named", "Genannt") },
          { tone: "critical", label: L("Control named, or no owner", "Kontrolle genannt oder ohne Verantwortung") },
          { tone: "good", label: L("Owner named", "Verantwortung benannt") },
          { tone: "accent", label: L("Consultation", "Konsultation") },
        ],
      },
      {
        id: "viz-publications",
        type: "stacked-bar",
        title: L(`${pubLabel(busiest?.id ?? "")} brings the most obligations, ${busiestCount}`, `${pubLabel(busiest?.id ?? "")} bringt die meisten Pflichten, ${busiestCount}`),
        subtitle: L("Obligations per publication, owned and unowned", "Pflichten je Veroeffentlichung, mit und ohne Verantwortung"),
        unit: L("obligations", "Pflichten"),
        series: [
          { id: "owned", label: L("Owner named", "Verantwortung benannt"), tone: "good" },
          { id: "unowned", label: L("No owner", "Ohne Verantwortung"), tone: "critical" },
        ],
        data: recent.map((publication) => {
          const list = obligations.filter((obligation) => obligation.publicationId === publication.id);
          const missing = list.filter((obligation) => obligation.isUnownedGap || !obligation.ownerUserId).length;
          return { id: publication.id, label: publication.reference, values: { owned: list.length - missing, unowned: missing } };
        }),
      },
    ],
    findings,
    evidence,
    recommendations,
    followUps: [
      { label: L("Failing controls", "Versagende Kontrollen"), question: L("Which controls are repeatedly failing?", "Welche Kontrollen versagen wiederholt?") },
      { label: L("Management summary", "Management-Zusammenfassung"), question: L("Create a one-page management summary of the top NFR concerns.", "Erstelle eine einseitige Management-Zusammenfassung der wichtigsten NFR-Themen.") },
    ],
  };
}
