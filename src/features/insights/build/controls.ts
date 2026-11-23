/**
 * Which controls are repeatedly failing?
 *
 * Reads eight quarters of test results per control (migration 0010) beside
 * the control's recorded effectiveness. A control fails repeatedly when it
 * failed in two of the last four quarters, or showed exceptions in three of
 * them. A recorded rating is out of step when the control is still recorded
 * fully or largely effective while its 2026 tests show exceptions twice.
 */

import type { InsightFinding, InsightRecommendation, InsightResponseInput, Tone } from "../schema";
import { personName } from "../data";
import { createActionProposal, createIssueProposal, holderOf, joinNames, plural, tx, workHref, type BuildContext } from "./common";

const LAST_FOUR = ["2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"];
const QUARTERS = ["2024-Q4", "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"];

function quarterLabel(quarter: string): string {
  return `${quarter.slice(5)} ${quarter.slice(2, 4)}`;
}

const RESULT_TONE: Record<string, Tone> = {
  effective: "good",
  "minor-exceptions": "watch",
  failed: "critical",
  "awaiting-conclusion": "accent",
  "not-tested": "neutral",
};

export interface ControlProfile {
  id: string;
  title: string;
  owner: string;
  ownerName: string;
  key: boolean;
  recorded: string;
  fails: number;
  exceptionQuarters: number;
  exceptions2026: number;
  neverTested: boolean;
  repeated: boolean;
  mismatch: boolean;
  results: Map<string, { result: string; exceptions: number }>;
}

export function controlProfiles(context: BuildContext): ControlProfile[] {
  const { data, language } = context;
  return data.controls.map((control) => {
    const rows = data.controlResults.filter((row) => row.controlId === control.id);
    const results = new Map(rows.map((row) => [row.period, { result: row.result, exceptions: row.exceptions }]));
    const recent = LAST_FOUR.map((quarter) => results.get(quarter));
    const fails = recent.filter((entry) => entry?.result === "failed").length;
    const exceptionQuarters = recent.filter((entry) => entry && entry.exceptions > 0).length;
    const exceptions2026 = ["2026-Q1", "2026-Q2", "2026-Q3"].filter((quarter) => (results.get(quarter)?.exceptions ?? 0) > 0).length;
    const neverTested = rows.length > 0 && rows.every((row) => row.result === "not-tested");
    const recorded = control.currentEffectiveness;
    return {
      id: control.id,
      title: language === "de" && control.titleDe ? control.titleDe : control.title,
      owner: control.ownerUserId ?? "",
      ownerName: personName(data, control.ownerUserId),
      key: Boolean(control.isKeyControl),
      recorded,
      fails,
      exceptionQuarters,
      exceptions2026,
      neverTested,
      repeated: fails >= 2 || exceptionQuarters >= 3,
      mismatch: (recorded === "fully-effective" || recorded === "largely-effective") && exceptions2026 >= 2,
      results,
    };
  });
}

function recordedLabel(value: string, language: "en" | "de"): string {
  const labels: Record<string, [string, string]> = {
    "fully-effective": ["fully effective", "voll wirksam"],
    "largely-effective": ["largely effective", "weitgehend wirksam"],
    "partially-effective": ["partially effective", "teilweise wirksam"],
    "not-effective": ["not effective", "nicht wirksam"],
  };
  const pair = labels[value] ?? [value, value];
  return language === "de" ? pair[1] : pair[0];
}

export function buildFailingControls(context: BuildContext): InsightResponseInput {
  const { language: lang, roleId, data } = context;
  const L = (en: string, de: string) => tx(lang, en, de);
  const profiles = controlProfiles(context);
  const repeated = profiles.filter((profile) => profile.repeated).sort((a, b) => b.fails - a.fails || b.exceptionQuarters - a.exceptionQuarters);
  const mismatched = profiles.filter((profile) => profile.mismatch);
  const never = profiles.filter((profile) => profile.neverTested && profile.key);
  const shown = [...new Map([...repeated, ...mismatched, ...never].map((profile) => [profile.id, profile])).values()];

  const owners = new Map<string, ControlProfile[]>();
  for (const profile of repeated) owners.set(profile.owner, [...(owners.get(profile.owner) ?? []), profile]);
  const ownerRanking = [...owners.entries()].sort((a, b) => b[1].length - a[1].length);
  const topTwo = ownerRanking.slice(0, 2);
  const topTwoCount = topTwo.reduce((total, [, list]) => total + list.length, 0);
  const payments = repeated.filter((profile) => profile.id.startsWith("CTL-PAY"));
  const failedRows = data.controlResults.filter((row) => row.result === "failed");
  const failsAll = failedRows.length;
  const fails2026 = failedRows.filter((row) => row.period.startsWith("2026")).length;
  const failsPayments = failedRows.filter((row) => row.period.startsWith("2026") && row.controlId.startsWith("CTL-PAY")).length;

  const evidence = shown.map((profile) => ({
    id: `ctr-${profile.id}`,
    sourceType: L("Control test results", "Kontrolltestergebnisse"),
    sourceName: `${profile.id} ${profile.title}`.slice(0, 240),
    recordId: `CTR-${profile.id}`,
    field: "result",
    observedAt: "30.09.2026",
    freshness: "current" as const,
    excerpt: QUARTERS.map((quarter) => `${quarterLabel(quarter)}: ${profile.results.get(quarter)?.result ?? "n/a"}`).join("; "),
    href: workHref(roleId, profile.id),
  }));

  const findings: InsightFinding[] = [];
  if (payments.length >= 3) {
    findings.push({
      id: "finding-cluster",
      severity: "critical",
      title: L(`${payments.length} payment controls fail repeatedly`, `${payments.length} Zahlungskontrollen versagen wiederholt`),
      detail: L(
        `${joinNames(payments.map((profile) => profile.id), lang)} sit in payment repair and clearing. ${topTwo.length === 2 ? `${topTwoCount} of the ${repeated.length} repeatedly failing controls belong to ${joinNames(topTwo.map(([owner]) => personName(data, owner)), lang)}.` : ""}`,
        `${joinNames(payments.map((profile) => profile.id), lang)} liegen in Zahlungsreparatur und Clearing. ${topTwo.length === 2 ? `${topTwoCount} der ${repeated.length} wiederholt versagenden Kontrollen gehoeren ${joinNames(topTwo.map(([owner]) => personName(data, owner)), lang)}.` : ""}`,
      ),
      evidenceIds: payments.map((profile) => `ctr-${profile.id}`).slice(0, 20),
    });
  }
  for (const profile of mismatched) {
    findings.push({
      id: `finding-mismatch-${profile.id}`,
      severity: "critical",
      title: L(`${profile.id} is still recorded ${recordedLabel(profile.recorded, lang)}`, `${profile.id} ist weiterhin als ${recordedLabel(profile.recorded, lang)} erfasst`),
      detail: L(
        `Its tests showed exceptions in ${profile.exceptions2026} of three 2026 quarters, and the Q3 test is disputed. The recorded rating, and any residual risk resting on it, has not followed the evidence.`,
        `Die Tests zeigten in ${profile.exceptions2026} von drei Quartalen 2026 Ausnahmen, der Q3-Test ist strittig. Die erfasste Bewertung und das darauf beruhende Restrisiko sind dem Nachweis nicht gefolgt.`,
      ),
      evidenceIds: [`ctr-${profile.id}`],
      href: workHref(roleId, profile.id),
    });
  }
  if (never.length > 0) {
    findings.push({
      id: "finding-never",
      severity: "warning",
      title: L(`${plural(never.length, "key control has", "key controls have")} no test on record`, `${never.length} Schluesselkontrollen ohne erfassten Test`),
      detail: L(
        `${joinNames(never.map((profile) => profile.id), lang)} carry a rating with no test behind it in eight quarters.`,
        `${joinNames(never.map((profile) => profile.id), lang)} haben eine Bewertung ohne einen Test in acht Quartalen.`,
      ),
      evidenceIds: never.map((profile) => `ctr-${profile.id}`),
    });
  }

  const holder = holderOf(context) || "P-002";
  const recommendations: InsightRecommendation[] = [
    {
      id: "rec-issue",
      title: L("Raise the payment control cluster as one issue", "Den Zahlungskontroll-Cluster als eine Feststellung erfassen"),
      rationale: L(
        "Seven separate test results describe one weakness in one process. One issue with one owner is how it gets fixed.",
        "Sieben einzelne Testergebnisse beschreiben eine Schwaeche in einem Prozess. Eine Feststellung mit einer Verantwortung bringt die Behebung.",
      ),
      urgency: "this-week",
      proposedAction: createIssueProposal(context, {
        id: "act-issue-cluster",
        title: L("Repeated test failures across payment repair and clearing controls", "Wiederholte Testfehler bei Kontrollen in Zahlungsreparatur und Clearing"),
        description: L(
          `${payments.map((profile) => profile.id).join(", ")} failed in two or more of the last four quarters. Root cause, owner capacity and the recorded ratings to be addressed together.`,
          `${payments.map((profile) => profile.id).join(", ")} versagten in zwei oder mehr der letzten vier Quartale. Ursache, Kapazitaet der Verantwortlichen und erfasste Bewertungen gemeinsam adressieren.`,
        ),
        severity: "high",
        ownerUserId: "P-007",
        dueInDays: 30,
        controlIds: payments.map((profile) => profile.id),
        relatedKind: "process",
        relatedId: "PRC-0041",
        relatedLabel: L("Payment repair and manual override", "Zahlungsreparatur und manuelle Uebersteuerung"),
        rationale: L("A failure cluster under two owners.", "Ein Fehlercluster unter zwei Verantwortlichen."),
        evidenceIds: payments.map((profile) => `ctr-${profile.id}`).slice(0, 20),
      }),
    },
    {
      id: "rec-retest",
      title: L("Schedule targeted re-tests this quarter", "Gezielte Nachtests in diesem Quartal planen"),
      rationale: L(
        "Three of the failing controls have no Q3 result. Without one, the Q4 RCSA rests on a Q2 test.",
        "Drei der versagenden Kontrollen haben kein Q3-Ergebnis. Ohne eines stuetzt sich die RCSA Q4 auf einen Q2-Test.",
      ),
      urgency: "this-month",
      proposedAction: createActionProposal(context, {
        id: "act-retest",
        title: L("Re-test the payment controls with no Q3 result", "Zahlungskontrollen ohne Q3-Ergebnis nachtesten"),
        description: L(
          `Targeted re-tests for ${repeated.filter((profile) => profile.results.get("2026-Q3")?.result === "not-tested").map((profile) => profile.id).join(", ")} before the Q4 RCSA workshop.`,
          `Gezielte Nachtests fuer ${repeated.filter((profile) => profile.results.get("2026-Q3")?.result === "not-tested").map((profile) => profile.id).join(", ")} vor dem RCSA-Workshop Q4.`,
        ),
        ownerUserId: "P-004",
        dueInDays: 45,
        priority: "medium",
        relatedKind: "process",
        relatedId: "PRC-0041",
        relatedLabel: L("Payment repair and manual override", "Zahlungsreparatur und manuelle Uebersteuerung"),
        rationale: L("Ratings without a current test.", "Bewertungen ohne aktuellen Test."),
        evidenceIds: repeated.map((profile) => `ctr-${profile.id}`).slice(0, 10),
      }),
    },
  ];
  const mismatch = mismatched[0];
  if (mismatch) {
    recommendations.unshift({
      id: "rec-rating",
      title: L(`Take the ${mismatch.id} rating through its decision`, `Die Bewertung von ${mismatch.id} ueber ihre Entscheidung fuehren`),
      rationale: L(
        "The rating is a human judgment with its own decision today. The Workspace prepared the evidence; it does not change the rating.",
        "Die Bewertung ist eine menschliche Entscheidung mit eigenem Entscheidungspunkt heute. Der Workspace hat den Nachweis vorbereitet; er aendert die Bewertung nicht.",
      ),
      urgency: "now",
      href: `/workday/${roleId}/decisions`,
    });
  }
  void holder;

  return {
    version: 1,
    intentId: "failing-controls",
    question: context.question,
    title: L("Controls failing repeatedly", "Wiederholt versagende Kontrollen"),
    conclusion: L(
      `${plural(repeated.length, "control fails", "controls fail")} repeatedly; ${payments.length} sit in payment repair and clearing${mismatch ? `, and ${mismatch.id} is still recorded ${recordedLabel(mismatch.recorded, lang)}` : ""}.`,
      `${repeated.length} Kontrollen versagen wiederholt; ${payments.length} liegen in Zahlungsreparatur und Clearing${mismatch ? `, und ${mismatch.id} ist weiterhin als ${recordedLabel(mismatch.recorded, lang)} erfasst` : ""}.`,
    ),
    language: lang,
    roleId,
    dataAsOf: context.dataAsOf,
    scope: L(`${profiles.length} controls in the group control inventory`, `${profiles.length} Kontrollen im Kontrollinventar der Gruppe`),
    plan: {
      using: [L("Control inventory", "Kontrollinventar"), L("Control test results", "Kontrolltestergebnisse"), L("Control tests of the day", "Kontrolltests des Tages")],
      timeWindow: L("Q4 2024 to Q3 2026, judged on the last four quarters", "Q4 2024 bis Q3 2026, bewertet ueber die letzten vier Quartale"),
      groupedBy: L("Control, then owner", "Kontrolle, dann Verantwortliche"),
      output: L("Heatmap and owner ranking", "Heatmap und Rangfolge der Verantwortlichen"),
    },
    confidence: {
      level: "high",
      explanation: L("Counted from recorded test outcomes. Repeated means two failures, or exceptions in three, of the last four quarters. A disputed test counts as open, not failed.", "Aus erfassten Testergebnissen. Wiederholt heisst zwei Fehler oder Ausnahmen in drei der letzten vier Quartale. Ein strittiger Test zaehlt als offen."),
    },
    metrics: [
      { id: "m-repeated", label: L("Failing repeatedly", "Wiederholt versagend"), value: repeated.length, status: "critical", deltaLabel: L(`of ${profiles.length} controls`, `von ${profiles.length} Kontrollen`) },
      { id: "m-payments", label: L("In payments", "Im Zahlungsverkehr"), value: payments.length, status: "warning" },
      { id: "m-owners", label: L("Under two owners", "Bei zwei Verantwortlichen"), value: `${topTwoCount} / ${repeated.length}`, status: "watch" },
      { id: "m-mismatch", label: L("Rating behind evidence", "Bewertung hinter Nachweis"), value: mismatched.length, status: mismatched.length ? "critical" : "good" },
      { id: "m-never", label: L("Key controls never tested", "Schluesselkontrollen nie getestet"), value: never.length, status: never.length ? "warning" : "good" },
    ],
    visualisations: [
      {
        id: "viz-heatmap",
        type: "heatmap",
        title: L(`${fails2026} of ${failsAll} failed tests fall in 2026, ${failsPayments} of them on payment controls`, `${fails2026} von ${failsAll} fehlgeschlagenen Tests liegen 2026, ${failsPayments} davon bei Zahlungskontrollen`),
        subtitle: L("Test outcome per quarter; the number is the exceptions found", "Testergebnis je Quartal; die Zahl ist die Anzahl Ausnahmen"),
        explanation: L(
          "Each row is a control and each column a quarter. Red cells are failed tests, amber cells tests with exceptions, purple a test awaiting its conclusion, grey no test.",
          "Jede Zeile ist eine Kontrolle, jede Spalte ein Quartal. Rot sind fehlgeschlagene Tests, gelb Tests mit Ausnahmen, lila ein offener Test, grau kein Test.",
        ),
        columns: QUARTERS.map(quarterLabel),
        rows: shown.map((profile) => ({
          id: profile.id,
          label: profile.id,
          sublabel: `${profile.ownerName}, ${L("recorded", "erfasst")} ${recordedLabel(profile.recorded, lang)}`,
          href: workHref(roleId, profile.id),
        })),
        cells: shown.flatMap((profile) =>
          QUARTERS.map((quarter) => {
            const entry = profile.results.get(quarter);
            const result = entry?.result ?? "not-tested";
            return {
              row: profile.id,
              column: quarterLabel(quarter),
              tone: RESULT_TONE[result] ?? "neutral",
              text: result === "effective" ? "ok" : result === "not-tested" ? "" : result === "awaiting-conclusion" ? `${entry?.exceptions ?? 0}?` : String(entry?.exceptions ?? 0),
            };
          }),
        ),
        legend: [
          { tone: "good", label: L("Effective", "Wirksam") },
          { tone: "watch", label: L("Exceptions", "Ausnahmen") },
          { tone: "critical", label: L("Failed", "Fehlgeschlagen") },
          { tone: "accent", label: L("Awaiting conclusion", "Abschluss offen") },
          { tone: "neutral", label: L("Not tested", "Nicht getestet") },
        ],
      },
      {
        id: "viz-owners",
        type: "bar",
        title: L(`${topTwo.length === 2 ? `${topTwoCount} of ${repeated.length}` : repeated.length} sit with ${topTwo.length === 2 ? "two owners" : "their owners"}`, `${topTwo.length === 2 ? `${topTwoCount} von ${repeated.length}` : repeated.length} liegen bei ${topTwo.length === 2 ? "zwei Verantwortlichen" : "ihren Verantwortlichen"}`),
        subtitle: L("Repeatedly failing controls per control owner", "Wiederholt versagende Kontrollen je Verantwortlichem"),
        unit: L("controls", "Kontrollen"),
        data: ownerRanking.map(([owner, list], index) => ({
          id: owner || `owner-${index}`,
          label: personName(data, owner) || L("No owner", "Ohne Verantwortung"),
          value: list.length,
          note: list.map((profile) => profile.id.replace("CTL-", "")).join(", ").slice(0, 80),
          tone: (index < 2 ? "warning" : "neutral") as Tone,
        })),
      },
    ],
    findings,
    evidence: evidence.slice(0, 40),
    recommendations: recommendations.slice(0, 4),
    followUps: [
      { label: L("Overdue issues", "Ueberfaellige Feststellungen"), question: L("Which high-severity issues are overdue?", "Welche Feststellungen mit hohem Schweregrad sind ueberfaellig?") },
      { label: L("Policy impact", "Auswirkung Richtlinien"), question: L("Which areas are affected by the latest policy change?", "Welche Bereiche sind von der neuesten Richtlinienaenderung betroffen?") },
      { label: L("Management summary", "Management-Zusammenfassung"), question: L("Create a one-page management summary of the top NFR concerns.", "Erstelle eine einseitige Management-Zusammenfassung der wichtigsten NFR-Themen.") },
    ],
  };
}
