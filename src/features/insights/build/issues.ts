/**
 * Which high-severity issues are overdue?
 *
 * An issue is overdue when it is open past its due date; a remediation action
 * is overdue when it is recorded overdue or is still open past its due date,
 * the way the Work Hub classifies it. The answer states plainly when no
 * high-severity issue is past due yet, and shows what is: the overdue
 * remediation behind those issues, and the issues falling due next.
 */

import type { InsightFinding, InsightRecommendation, InsightResponseInput, Tone } from "../schema";
import { daysBetween, formatDate, personName } from "../data";
import { createActionProposal, holderOf, plural, tx, workHref, type BuildContext } from "./common";

const BUCKETS = [
  { id: "b30", en: "1 to 30 days", de: "1 bis 30 Tage", max: 30 },
  { id: "b60", en: "31 to 60 days", de: "31 bis 60 Tage", max: 60 },
  { id: "b90", en: "61 to 90 days", de: "61 bis 90 Tage", max: 90 },
  { id: "b90p", en: "Over 90 days", de: "Ueber 90 Tage", max: Number.POSITIVE_INFINITY },
];

export function overdueActions(context: BuildContext) {
  const today = context.data.scope.today;
  return context.data.actions
    .filter((action) => action.status !== "completed" && action.dueOn && action.dueOn.slice(0, 10) < today)
    .map((action) => ({ action, days: daysBetween(action.dueOn ?? today, today) }))
    .sort((a, b) => b.days - a.days);
}

export function buildOverdueIssues(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const today = data.scope.today;
  const openIssues = data.issues.filter((issue) => issue.status !== "closed");
  const highIssues = openIssues.filter((issue) => issue.severity === "high");
  const highOverdue = highIssues.filter((issue) => issue.dueOn && issue.dueOn.slice(0, 10) < today);
  const dueSoon = highIssues
    .filter((issue) => issue.dueOn && issue.dueOn.slice(0, 10) >= today && daysBetween(today, issue.dueOn) <= 30)
    .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""));
  const overdue = overdueActions(context);
  const highPriority = overdue.filter((entry) => entry.action.priority === "high");
  const unowned = overdue.filter((entry) => !entry.action.ownerUserId);
  const linkedToHigh = overdue.filter((entry) => highIssues.some((issue) => issue.id === entry.action.issueId));
  const oldestHigh = highPriority[0];

  const evidence = [
    ...overdue.slice(0, 14).map((entry) => ({
      id: `act-${entry.action.id}`,
      sourceType: L("Remediation actions", "Massnahmen"),
      sourceName: lang === "de" && entry.action.titleDe ? entry.action.titleDe : entry.action.title,
      recordId: entry.action.id,
      field: "due_on",
      observedAt: formatDate(entry.action.dueOn ?? today),
      freshness: "current" as const,
      excerpt: L(
        `Due ${formatDate(entry.action.dueOn ?? today)}, ${entry.days} days overdue, ${entry.action.priority} priority, owner ${personName(data, entry.action.ownerUserId) || "not named"}.`,
        `Faellig ${formatDate(entry.action.dueOn ?? today)}, ${entry.days} Tage ueberfaellig, Prioritaet ${entry.action.priority}, verantwortlich ${personName(data, entry.action.ownerUserId) || "nicht benannt"}.`,
      ),
      href: workHref(roleId, entry.action.id),
    })),
    ...dueSoon.map((issue) => ({
      id: `iss-${issue.id}`,
      sourceType: L("Issue register", "Feststellungsregister"),
      sourceName: lang === "de" && issue.titleDe ? issue.titleDe : issue.title,
      recordId: issue.id,
      field: "due_on",
      observedAt: formatDate(issue.raisedOn),
      freshness: "current" as const,
      excerpt: L(`High severity, due ${formatDate(issue.dueOn ?? today)}.`, `Hoher Schweregrad, faellig ${formatDate(issue.dueOn ?? today)}.`),
      href: workHref(roleId, issue.id),
    })),
  ];

  const findings: InsightFinding[] = [];
  if (oldestHigh) {
    const issue = data.issues.find((entry) => entry.id === oldestHigh.action.issueId);
    findings.push({
      id: "finding-oldest",
      severity: "critical",
      title: L(`${oldestHigh.action.id} is ${oldestHigh.days} days overdue`, `${oldestHigh.action.id} ist ${oldestHigh.days} Tage ueberfaellig`),
      detail: L(
        `${oldestHigh.action.title}. Owner ${personName(data, oldestHigh.action.ownerUserId) || "not named"}${issue ? `; it remediates ${issue.id} (${issue.severity}).` : "."}`,
        `${oldestHigh.action.titleDe ?? oldestHigh.action.title}. Verantwortlich ${personName(data, oldestHigh.action.ownerUserId) || "nicht benannt"}${issue ? `; sie behebt ${issue.id} (${issue.severity}).` : "."}`,
      ),
      evidenceIds: [`act-${oldestHigh.action.id}`],
      href: workHref(roleId, oldestHigh.action.id),
    });
  }
  if (unowned.length > 0) {
    findings.push({
      id: "finding-unowned",
      severity: "warning",
      title: L(`${plural(unowned.length, "overdue action has", "overdue actions have")} no named owner`, `${unowned.length} ueberfaellige Massnahmen ohne benannte Verantwortung`),
      detail: L(
        "An action nobody owns is not late, it is unassigned. Naming an owner comes before any new date.",
        "Eine Massnahme ohne Verantwortung ist nicht verspaetet, sie ist nicht zugewiesen. Die Benennung kommt vor jedem neuen Termin.",
      ),
      evidenceIds: unowned.map((entry) => `act-${entry.action.id}`).slice(0, 10),
    });
  }
  findings.push({
    id: "finding-due-soon",
    severity: highOverdue.length > 0 ? "critical" : "watch",
    title:
      highOverdue.length > 0
        ? L(`${plural(highOverdue.length, "high-severity issue is", "high-severity issues are")} past due`, `${highOverdue.length} Feststellungen mit hohem Schweregrad ueberfaellig`)
        : L(`No high-severity issue is past due; ${dueSoon.length} fall due within 30 days`, `Keine hohe Feststellung ist ueberfaellig; ${dueSoon.length} werden in 30 Tagen faellig`),
    detail: dueSoon.length
      ? L(
          `Next: ${dueSoon.slice(0, 3).map((issue) => `${issue.id} on ${formatDate(issue.dueOn ?? today)}`).join(", ")}.`,
          `Als naechstes: ${dueSoon.slice(0, 3).map((issue) => `${issue.id} am ${formatDate(issue.dueOn ?? today)}`).join(", ")}.`,
        )
      : L("Nothing high falls due in the next 30 days.", "In den naechsten 30 Tagen wird nichts Hohes faellig."),
    evidenceIds: dueSoon.map((issue) => `iss-${issue.id}`),
  });

  const holder = holderOf(context) || "P-002";
  const recommendations: InsightRecommendation[] = [];
  if (unowned.length > 0) {
    recommendations.push({
      id: "rec-owners",
      title: L(`Name owners for the ${unowned.length} unowned overdue actions`, `Verantwortliche fuer die ${unowned.length} ueberfaelligen Massnahmen ohne Verantwortung benennen`),
      rationale: L("The remediation discipline KRI counts these as overdue, but nobody can close them.", "Der KRI zur Behebungsdisziplin zaehlt sie als ueberfaellig, aber niemand kann sie schliessen."),
      urgency: "this-week",
      proposedAction: createActionProposal(context, {
        id: "act-owners",
        title: L("Name accountable owners for unowned overdue remediation actions", "Verantwortliche fuer ueberfaellige Massnahmen ohne Verantwortung benennen"),
        description: L(
          `Assign an accountable owner to ${unowned.map((entry) => entry.action.id).join(", ")} and agree new dates with each.`,
          `Verantwortliche fuer ${unowned.map((entry) => entry.action.id).join(", ")} benennen und mit jedem neue Termine vereinbaren.`,
        ),
        ownerUserId: "P-001",
        dueInDays: 7,
        priority: "high",
        relatedKind: "kri",
        relatedId: "KRI-GOV-001",
        relatedLabel: L("Overdue remediation actions, group", "Ueberfaellige Massnahmen, Gruppe"),
        rationale: L("Unowned overdue actions cannot be closed.", "Ueberfaellige Massnahmen ohne Verantwortung koennen nicht geschlossen werden."),
        evidenceIds: unowned.map((entry) => `act-${entry.action.id}`).slice(0, 10),
      }),
    });
  }
  if (oldestHigh) {
    recommendations.push({
      id: "rec-oldest",
      title: L(`Decide on ${oldestHigh.action.id}: re-baseline or escalate`, `Ueber ${oldestHigh.action.id} entscheiden: neu planen oder eskalieren`),
      rationale: L("A decision on this action is already open for the portfolio lead; the Work Hub holds its history.", "Eine Entscheidung zu dieser Massnahme ist bereits fuer die Portfolioleitung offen; der Work Hub enthaelt ihren Verlauf."),
      urgency: "now",
      href: workHref(roleId, oldestHigh.action.id),
    });
  }
  void holder;

  const priorities: Array<{ id: string; tone: Tone; en: string; de: string }> = [
    { id: "high", tone: "critical", en: "High", de: "Hoch" },
    { id: "medium", tone: "watch", en: "Medium", de: "Mittel" },
    { id: "low", tone: "neutral", en: "Low", de: "Niedrig" },
  ];

  return {
    version: 1,
    intentId: "overdue-issues",
    question: context.question,
    title: L("Overdue issues and remediation", "Ueberfaellige Feststellungen und Massnahmen"),
    conclusion:
      highOverdue.length > 0
        ? L(`${plural(highOverdue.length, "high-severity issue is", "high-severity issues are")} past due, and ${overdue.length} remediation actions are overdue.`, `${highOverdue.length} Feststellungen mit hohem Schweregrad sind ueberfaellig, dazu ${overdue.length} Massnahmen.`)
        : L(
            `No high-severity issue is past due yet, but ${overdue.length} remediation actions are, ${unowned.length} of them with no owner${oldestHigh ? `; ${oldestHigh.action.id} is ${oldestHigh.days} days late` : ""}.`,
            `Noch keine hohe Feststellung ist ueberfaellig, aber ${overdue.length} Massnahmen sind es, ${unowned.length} davon ohne Verantwortung${oldestHigh ? `; ${oldestHigh.action.id} ist ${oldestHigh.days} Tage verspaetet` : ""}.`,
          ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L(`${openIssues.length} open issues and ${data.actions.filter((action) => action.status !== "completed").length} open actions`, `${openIssues.length} offene Feststellungen und ${data.actions.filter((action) => action.status !== "completed").length} offene Massnahmen`),
    plan: {
      using: [L("Issue register", "Feststellungsregister"), L("Remediation actions", "Massnahmen"), L("Work Hub classification", "Klassifizierung im Work Hub")],
      timeWindow: L(`Due dates up to ${formatDate(today)}; issues due within 30 days`, `Termine bis ${formatDate(today)}; Feststellungen mit Termin in 30 Tagen`),
      groupedBy: L("Days overdue and priority", "Tage ueberfaellig und Prioritaet"),
      output: L("Aging profile and overdue list", "Altersprofil und Liste"),
    },
    confidence: { level: "high", explanation: L("Read from the recorded due dates and statuses.", "Aus erfassten Terminen und Status gelesen.") },
    metrics: [
      { id: "m-high-overdue", label: L("High issues past due", "Hohe Feststellungen ueberfaellig"), value: highOverdue.length, status: highOverdue.length ? "critical" : "good" },
      { id: "m-overdue", label: L("Overdue actions", "Ueberfaellige Massnahmen"), value: overdue.length, status: "warning", deltaLabel: L(`${highPriority.length} high priority`, `${highPriority.length} hohe Prioritaet`) },
      { id: "m-unowned", label: L("With no owner", "Ohne Verantwortung"), value: unowned.length, status: unowned.length ? "warning" : "good" },
      { id: "m-oldest", label: L("Oldest high priority", "Aelteste hohe Prioritaet"), value: oldestHigh?.days ?? 0, unit: L("days", "Tage"), status: "critical", deltaLabel: oldestHigh?.action.id },
      { id: "m-due-soon", label: L("High issues due in 30 days", "Hohe Feststellungen in 30 Tagen"), value: dueSoon.length, status: dueSoon.length ? "watch" : "good" },
    ],
    visualisations: [
      {
        id: "viz-aging",
        type: "stacked-bar",
        title: L(`${overdue.filter((entry) => entry.days > 60).length} of ${overdue.length} overdue actions are more than two months late`, `${overdue.filter((entry) => entry.days > 60).length} von ${overdue.length} ueberfaelligen Massnahmen sind ueber zwei Monate verspaetet`),
        subtitle: L("Overdue remediation actions by days overdue and priority", "Ueberfaellige Massnahmen nach Tagen und Prioritaet"),
        unit: L("actions", "Massnahmen"),
        series: priorities.map((priority) => ({ id: priority.id, label: lang === "de" ? priority.de : priority.en, tone: priority.tone })),
        data: BUCKETS.map((bucket, index) => {
          const min = index === 0 ? 0 : (BUCKETS[index - 1]?.max ?? 0);
          const inBucket = overdue.filter((entry) => entry.days > min && entry.days <= bucket.max);
          return {
            id: bucket.id,
            label: lang === "de" ? bucket.de : bucket.en,
            values: Object.fromEntries(priorities.map((priority) => [priority.id, inBucket.filter((entry) => entry.action.priority === priority.id).length])),
          };
        }),
      },
      {
        id: "viz-list",
        type: "table",
        title: L("Every overdue action, oldest first", "Alle ueberfaelligen Massnahmen, aelteste zuerst"),
        columns: [
          { id: "action", label: L("Action", "Massnahme") },
          { id: "title", label: L("What", "Was") },
          { id: "owner", label: L("Owner", "Verantwortlich") },
          { id: "due", label: L("Due", "Faellig"), align: "end" },
          { id: "days", label: L("Days late", "Tage"), align: "end" },
        ],
        rows: overdue.map((entry) => ({
          id: entry.action.id,
          cells: {
            action: entry.action.id,
            title: (lang === "de" && entry.action.titleDe ? entry.action.titleDe : entry.action.title).slice(0, 90),
            owner: personName(data, entry.action.ownerUserId) || L("Not named", "Nicht benannt"),
            due: formatDate(entry.action.dueOn ?? today),
            days: entry.days,
          },
          tone: (entry.action.priority === "high" ? "critical" : entry.days > 60 ? "warning" : "neutral") as Tone,
          href: workHref(roleId, entry.action.id),
        })),
      },
    ],
    findings,
    evidence: evidence.slice(0, 40),
    recommendations,
    followUps: [
      { label: L("Failing controls", "Versagende Kontrollen"), question: L("Which controls are repeatedly failing?", "Welche Kontrollen versagen wiederholt?") },
      { label: L("Expiring acceptances", "Ablaufende Akzeptanzen"), question: L("Which risk acceptances expire in the next 90 days?", "Welche Risikoakzeptanzen laufen in den naechsten 90 Tagen ab?") },
      { label: L("Management summary", "Management-Zusammenfassung"), question: L("Create a one-page management summary of the top NFR concerns.", "Erstelle eine einseitige Management-Zusammenfassung der wichtigsten NFR-Themen.") },
    ],
  };
}
