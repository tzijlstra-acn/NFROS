/**
 * Insights: ask a question of the records, and find the analyses already made.
 *
 * The Ask panel leads. Below it, the role's saved analyses, its recent ones,
 * and the questions the Workspace answers today, each a link that prepares
 * that analysis. A `?q=` in the URL prepares the analysis on arrival, which
 * is how a follow-up question or a summary line opens its analysis.
 */

import Link from "next/link";
import { IconBookmark, IconChartDots3, IconClock } from "@tabler/icons-react";
import { AskPanel } from "@/components/insights/AskPanel";
import { INTENTS, suggestedIntents } from "@/features/insights/intents";
import { listInsights } from "@/features/insights/service";
import { insightsPageContext } from "@/features/insights/page-context";
import type { RouteQuery, RoleRouteParams } from "@/workday/dispatch";

const COPY = {
  title: { en: "Insights", de: "Insights" },
  lede: {
    en: "Ask a question of the records. Every answer is computed from the data, drawn as a visual and linked to its evidence, and can lead to a governed action.",
    de: "Stellen Sie den Datensaetzen eine Frage. Jede Antwort ist aus den Daten berechnet, als Visualisierung dargestellt, mit Nachweisen verknuepft und kann zu einer gesteuerten Massnahme fuehren.",
  },
  saved: { en: "Saved analyses", de: "Gespeicherte Analysen" },
  recent: { en: "Recent analyses", de: "Letzte Analysen" },
  answered: { en: "Questions the Workspace answers", de: "Fragen, die der Workspace beantwortet" },
  none: { en: "Nothing saved yet. Save an analysis from its page to keep it here.", de: "Noch nichts gespeichert. Speichern Sie eine Analyse auf ihrer Seite." },
  noneRecent: { en: "No analysis prepared yet today.", de: "Heute noch keine Analyse vorbereitet." },
  records: { en: "Source records", de: "Quelldatensaetze" },
  recordsLede: { en: "The register and history behind every analysis.", de: "Register und Historie hinter jeder Analyse." },
} as const;

function pick(pair: { en: string; de: string }, language: "en" | "de"): string {
  return language === "de" ? pair.de : pair.en;
}

export default async function InsightsHome({ params, searchParams }: { params: Promise<RoleRouteParams>; searchParams: RouteQuery }) {
  const { role } = await params;
  const page = await insightsPageContext(role);
  const { roleId, language } = page;
  const q = typeof searchParams["q"] === "string" ? searchParams["q"] : null;
  const saved = listInsights(roleId, { savedOnly: true, limit: 8 });
  const recent = listInsights(roleId, { limit: 8 });
  const suggestions = suggestedIntents(roleId, 5).map((intent) => ({ label: pick(intent.label, language), question: pick(intent.question, language) }));

  const row = (entry: (typeof recent)[number]) => (
    <li key={entry.id}>
      <Link href={`/workday/${roleId}/insights/${entry.id}`} className="ins-rec" style={{ display: "block", textDecoration: "none" }}>
        <span className="ins-rec-urgency">
          {entry.savedTitle ?? entry.response?.title ?? entry.question} · {entry.generatedAtMoment}
        </span>
        <p className="ins-rec-title">{entry.response?.conclusion ?? entry.question}</p>
      </Link>
    </li>
  );

  return (
    <div className="ins-page" data-testid="insights-home">
      <h1 className="ins-conclusion" style={{ fontSize: 24 }}>{pick(COPY.title, language)}</h1>
      <p className="ins-question" style={{ margin: "6px 0 20px", maxWidth: "70ch" }}>{pick(COPY.lede, language)}</p>

      <AskPanel roleId={roleId} language={language} suggestions={suggestions} autoQuestion={q} testId="insights-ask" />

      <div className="ins-grid" style={{ marginTop: 32 }}>
        <div className="ins-main">
          <section aria-labelledby="ins-answered">
            <h2 id="ins-answered" className="ins-section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <IconChartDots3 size={18} stroke={1.8} aria-hidden="true" />
              {pick(COPY.answered, language)}
            </h2>
            <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
              {INTENTS.map((intent) => (
                <li key={intent.id}>
                  <Link className="ins-rec" style={{ display: "block", height: "100%", textDecoration: "none" }} href={`/workday/${roleId}/insights?q=${encodeURIComponent(pick(intent.question, language))}`}>
                    <span className="ins-rec-urgency">{pick(intent.label, language)}</span>
                    <p className="ins-rec-title">{pick(intent.question, language)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="ins-side">
          <section aria-labelledby="ins-saved">
            <h2 id="ins-saved" className="ins-section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <IconBookmark size={16} stroke={1.8} aria-hidden="true" />
              {pick(COPY.saved, language)}
            </h2>
            {saved.length ? <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>{saved.map(row)}</ul> : <p className="ins-section-sub">{pick(COPY.none, language)}</p>}
          </section>
          <section aria-labelledby="ins-recent">
            <h2 id="ins-recent" className="ins-section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <IconClock size={16} stroke={1.8} aria-hidden="true" />
              {pick(COPY.recent, language)}
            </h2>
            {recent.length ? <ul style={{ display: "grid", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>{recent.slice(0, 6).map(row)}</ul> : <p className="ins-section-sub">{pick(COPY.noneRecent, language)}</p>}
          </section>
          <Link href={`/workday/${roleId}/insights/records`} className="ins-rec" style={{ display: "block", textDecoration: "none" }}>
            <span className="ins-rec-urgency">{pick(COPY.records, language)}</span>
            <p className="ins-rec-title">{pick(COPY.recordsLede, language)}</p>
          </Link>
        </aside>
      </div>
    </div>
  );
}
