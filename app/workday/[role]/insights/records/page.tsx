/**
 * Source records: the register and history behind the analyses, and the
 * audit log.
 *
 * Where a chart mark on a register object opens, and where a write-back
 * receipt's "View in audit log" lands. Read only. The selected record is
 * highlighted and scrolled into view.
 */

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents } from "@/db/schema/core";
import { requireScenarioState } from "@/scenario/engine/state";
import { loadAnalyticsData, formatDate, personName } from "@/features/insights/data";
import { insightsPageContext } from "@/features/insights/page-context";

export const dynamic = "force-dynamic";

const SOURCES = ["third-parties", "providers", "risk-acceptances", "resilience", "audit"] as const;
type Source = (typeof SOURCES)[number];

const COPY = {
  title: { en: "Source records", de: "Quelldatensaetze" },
  lede: { en: "Read only. The records every analysis is computed from, as of the current scenario moment.", de: "Nur lesend. Die Datensaetze, aus denen jede Analyse berechnet wird, zum aktuellen Szenariomoment." },
  back: { en: "Insights", de: "Insights" },
  sources: {
    "third-parties": { en: "Third parties", de: "Drittparteien" },
    providers: { en: "Underlying providers", de: "Zugrunde liegende Anbieter" },
    "risk-acceptances": { en: "Risk acceptances", de: "Risikoakzeptanzen" },
    resilience: { en: "Resilience tests", de: "Resilienztests" },
    audit: { en: "Audit log", de: "Pruefprotokoll" },
  },
} as const;

type Cell = string | number;

function pick(pair: { en: string; de: string }, language: "en" | "de"): string {
  return language === "de" ? pair.de : pair.en;
}

export default async function RecordsPage({ params, searchParams }: { params: Promise<{ role: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { role } = await params;
  const query = await searchParams;
  const page = await insightsPageContext(role);
  const { roleId, language } = page;
  const source: Source = (SOURCES as readonly string[]).includes(String(query["source"])) ? (query["source"] as Source) : "third-parties";
  /* An identifier only: the value reaches an inline script below, so nothing else is accepted. */
  const rawRecord = typeof query["record"] === "string" ? query["record"] : null;
  const selected = rawRecord && /^[A-Za-z0-9._-]{1,120}$/.test(rawRecord) ? rawRecord : null;
  const isSelected = (id: string) => selected !== null && (id === selected || id.startsWith(`${selected}-`));
  const state = requireScenarioState();
  const data = loadAnalyticsData({ runId: state.runId, roleId, atMoment: state.currentMoment, today: state.scenarioDate, language });

  let columns: string[] = [];
  let rows: Array<{ id: string; cells: Cell[] }> = [];
  const L = (en: string, de: string) => (language === "de" ? de : en);

  if (source === "third-parties") {
    columns = [L("Id", "Id"), L("Name", "Name"), L("Criticality", "Kritikalitaet"), L("Category", "Kategorie"), L("Risk score, Sep 2026", "Risikowert, Sep 2026"), L("Assurance", "Pruefnachweis"), L("In the day's case work", "In der Fallarbeit des Tages")];
    rows = data.thirdParties.map((party) => {
      const latest = data.metrics.find((row) => row.thirdPartyId === party.id && row.period === "2026-09");
      return { id: party.id, cells: [party.id, party.name, party.criticality, party.category, latest?.riskScore ?? "", latest?.assuranceStatus ?? "", party.operational ? L("yes", "ja") : L("register", "Register")] };
    });
  } else if (source === "providers") {
    columns = [L("Provider", "Anbieter"), L("Third party", "Drittpartei"), L("Service", "Service"), L("Critical function", "Kritische Funktion"), L("Declared", "Gemeldet"), L("Recorded in", "Erfasst in")];
    rows = data.dependencies.map((dep, index) => ({
      id: `${dep.providerKey}-${index}`,
      cells: [dep.providerName, data.thirdPartyById.get(dep.thirdPartyId)?.name ?? dep.thirdPartyId, dep.serviceId, dep.supportsCriticalFunction ? L("yes", "ja") : L("no", "nein"), dep.declared ? L("yes", "ja") : L("no", "nein"), dep.source],
    }));
  } else if (source === "risk-acceptances") {
    columns = [L("Acceptance", "Akzeptanz"), L("Risk", "Risiko"), L("Subject", "Gegenstand"), L("Granted", "Erteilt"), L("Expires", "Ablauf"), L("Conditions met", "Bedingungen erfuellt"), L("Owner", "Verantwortlich"), L("Status", "Status")];
    rows = data.acceptances.map((row) => ({
      id: row.id,
      cells: [row.reference, row.riskId, row.subjectLabel, formatDate(row.grantedOn), formatDate(row.expiresOn), row.conditionsMet ? L("yes", "ja") : L("no", "nein"), personName(data, row.ownerUserId), row.status],
    }));
  } else if (source === "resilience") {
    columns = [L("Service", "Service"), L("Entity", "Einheit"), L("Measured in", "Gemessen in"), L("Date", "Datum"), L("Tolerance, min", "Toleranz, Min."), L("Observed, min", "Beobachtet, Min."), L("Finding", "Ergebnis")];
    rows = data.resilience.map((row) => ({
      id: row.id,
      cells: [row.serviceId, row.entityId, row.reference, formatDate(row.testedOn), row.toleranceMinutes, row.observedMinutes, row.finding],
    }));
  } else {
    columns = [L("Event", "Ereignis"), L("Recorded", "Erfasst"), L("Scenario time", "Szenariozeit"), L("Category", "Kategorie"), L("Action", "Aktion"), L("Object", "Objekt"), L("Summary", "Zusammenfassung")];
    const events = getDb().select().from(auditEvents).where(eq(auditEvents.runId, state.runId)).orderBy(desc(auditEvents.recordedAt)).limit(80).all();
    const chosen = selected ? getDb().select().from(auditEvents).where(eq(auditEvents.id, selected)).get() : undefined;
    const list = chosen && !events.some((event) => event.id === chosen.id) ? [chosen, ...events] : events;
    rows = list.map((event) => ({
      id: event.id,
      cells: [event.id, event.recordedAt.slice(0, 16).replace("T", " "), event.atMoment, event.category, event.action, `${event.objectKind} ${event.objectId}`, event.summary],
    }));
  }

  return (
    <div className="ins-page" data-testid="records-page">
      <nav className="ins-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/workday/${roleId}/insights`}>{pick(COPY.back, language)}</Link>
        <span>/</span>
        <span>{pick(COPY.title, language)}</span>
      </nav>
      <h1 className="ins-conclusion" style={{ fontSize: 22 }}>{pick(COPY.title, language)}</h1>
      <p className="ins-question" style={{ margin: "6px 0 16px" }}>{pick(COPY.lede, language)}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }} role="tablist">
        {SOURCES.map((entry) => (
          <Link key={entry} role="tab" aria-selected={entry === source} href={`/workday/${roleId}/insights/records?source=${entry}`} className="ins-chip-btn" style={entry === source ? { borderColor: "var(--wd-accent)", color: "var(--wd-accent)", fontWeight: 600 } : undefined}>
            {pick(COPY.sources[entry], language)}
          </Link>
        ))}
      </div>
      <div className="ins-card">
        <div className="ins-table-wrap" style={{ margin: 0 }}>
          <table className="ins-table" data-testid={`records-${source}`}>
            <thead>
              <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} id={`record-${row.id}`} style={isSelected(row.id) ? { background: "var(--wd-surface-selected)", outline: "2px solid var(--wd-accent)" } : undefined} data-selected={isSelected(row.id) ? "true" : undefined}>
                  {row.cells.map((cell, index) => (
                    <td key={index} data-align={typeof cell === "number" ? "end" : undefined}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected ? <script dangerouslySetInnerHTML={{ __html: `document.querySelector("[data-selected=true]")?.scrollIntoView({block:"center"})` }} /> : null}
    </div>
  );
}
