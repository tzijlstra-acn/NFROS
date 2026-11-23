"use client";

/**
 * The insight canvas: one analysis, laid out the way a person reads it.
 *
 *   1. the question and the conclusion, one sentence;
 *   2. up to five key numbers;
 *   3. the primary visual, with its table and its explanation;
 *   4. the findings, each linked to the evidence it rests on;
 *   5. on the right, the recommended next step and the governed action
 *      behind it, then how the analysis was built (sources, window,
 *      grouping), then follow-up questions;
 *   6. supporting visuals behind a disclosure, the full evidence in a drawer.
 *
 * Progressive disclosure is the rule: the default view is the conclusion,
 * the numbers, one chart and one action.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBookmark,
  IconBookmarkFilled,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconFileText,
  IconInfoCircle,
  IconPrinter,
  IconRobot,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import type { InsightEvidence, InsightResponse } from "@/features/insights/schema";
import type { WritebackReceipt } from "@/features/insights/writeback";
import { VisualisationFrame } from "./VisualisationRenderer";
import { WritebackDialog, type ActionPermissionView } from "./WritebackDialog";
import { actionSaveInsight } from "../../../app/workday/[role]/insights/actions";

type Language = "en" | "de";

const COPY = {
  insights: { en: "Insights", de: "Insights" },
  asked: { en: "You asked", de: "Ihre Frage" },
  prepared: { en: "Prepared by Workspace", de: "Vom Workspace vorbereitet" },
  dataAsOf: { en: "Records as of", de: "Datensaetze mit Stand" },
  scope: { en: "Scope", de: "Umfang" },
  confidence: { en: "Confidence", de: "Verlaesslichkeit" },
  high: { en: "high", de: "hoch" },
  medium: { en: "medium", de: "mittel" },
  low: { en: "low", de: "niedrig" },
  using: { en: "Using", de: "Quellen" },
  window: { en: "Time window", de: "Zeitraum" },
  grouped: { en: "Grouped by", de: "Gruppiert nach" },
  output: { en: "Output", de: "Ergebnis" },
  findings: { en: "What the records show", de: "Was die Datensaetze zeigen" },
  evidence: { en: "Evidence", de: "Nachweise" },
  evidenceAll: { en: "All evidence ({count})", de: "Alle Nachweise ({count})" },
  sources: { en: "{count} sources", de: "{count} Quellen" },
  source: { en: "1 source", de: "1 Quelle" },
  recommended: { en: "Recommended next step", de: "Empfohlener naechster Schritt" },
  more: { en: "More actions", de: "Weitere Schritte" },
  review: { en: "Review and approve", de: "Pruefen und genehmigen" },
  open: { en: "Open", de: "Oeffnen" },
  done: { en: "Done: {id}", de: "Erledigt: {id}" },
  needsDecision: { en: "Needs your decision", de: "Erfordert Ihre Entscheidung" },
  approval: { en: "Human approval required", de: "Menschliche Genehmigung erforderlich" },
  routine: { en: "Routine, recorded in your name", de: "Routine, in Ihrem Namen erfasst" },
  locked: { en: "Needs {roles}", de: "Erfordert {roles}" },
  urgency: { now: { en: "Now", de: "Jetzt" }, "this-week": { en: "This week", de: "Diese Woche" }, "this-month": { en: "This month", de: "Diesen Monat" }, monitor: { en: "Monitor", de: "Beobachten" } },
  followUps: { en: "Ask next", de: "Als naechstes fragen" },
  howBuilt: { en: "How this was prepared", de: "Wie dies vorbereitet wurde" },
  moreViews: { en: "Supporting views ({count})", de: "Weitere Ansichten ({count})" },
  save: { en: "Save to Insights", de: "In Insights speichern" },
  saved: { en: "Saved", de: "Gespeichert" },
  print: { en: "Print briefing", de: "Briefing drucken" },
  agent: { en: "Save as agent", de: "Als Agent speichern" },
  close: { en: "Close", de: "Schliessen" },
  fresh: { current: { en: "current", de: "aktuell" }, aging: { en: "aging", de: "alternd" }, stale: { en: "stale", de: "veraltet" } },
  technical: { en: "How it works", de: "So funktioniert es" },
  technicalBody: {
    en: "Answered by the READ tool analyseQuestion through the authority gate, audited as {audit}. Every figure is computed from the records and the portfolio register; no model supplied a number. Actions run through the governed write path: a payload-bound approval in your name, then the tool, then the audit trail.",
    de: "Beantwortet vom READ-Werkzeug analyseQuestion ueber das Befugnis-Gate, protokolliert als {audit}. Jede Zahl ist aus Datensaetzen und Portfolioregister berechnet; kein Modell lieferte eine Zahl. Massnahmen laufen ueber den gesteuerten Schreibweg: eine an die Nutzlast gebundene Genehmigung in Ihrem Namen, dann das Werkzeug, dann das Pruefprotokoll.",
  },
} as const;

function pick(pair: { en: string; de: string }, language: Language): string {
  return language === "de" ? pair.de : pair.en;
}

export interface CanvasProps {
  roleId: string;
  insightId: string;
  response: InsightResponse;
  permissions: Record<string, ActionPermissionView>;
  savedTitle: string | null;
  auditEventId: string | null;
  actorLabel: string;
  agentHref: string;
}

export function InsightCanvas({ roleId, insightId, response, permissions, savedTitle, auditEventId, actorLabel, agentHref }: CanvasProps) {
  const language = response.language as Language;
  const router = useRouter();
  const [drawer, setDrawer] = useState<{ highlight: string[] } | null>(null);
  const [dialog, setDialog] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, WritebackReceipt>>({});
  const [saved, setSaved] = useState<string | null>(savedTitle);
  const [moreViews, setMoreViews] = useState(false);
  const [technical, setTechnical] = useState(false);

  const evidenceById = useMemo(() => new Map(response.evidence.map((item) => [item.id, item])), [response.evidence]);
  const evidenceNames = useMemo(() => Object.fromEntries(response.evidence.map((item) => [item.id, `${item.recordId} ${item.sourceName}`.slice(0, 120)])), [response.evidence]);
  const [primary, ...supporting] = response.visualisations;
  const [first, ...rest] = response.recommendations;
  const activeRec = response.recommendations.find((rec) => rec.id === dialog);

  const save = useCallback(async () => {
    const result = await actionSaveInsight({ roleId, id: insightId, title: response.title });
    if (result.ok) setSaved(result.title);
  }, [roleId, insightId, response.title]);

  const ask = useCallback(
    (question: string) => {
      router.push(`/workday/${roleId}/insights?q=${encodeURIComponent(question)}`);
    },
    [router, roleId],
  );

  const recCard = (rec: NonNullable<typeof first>, isPrimary: boolean) => {
    const permission = permissions[rec.id];
    const receipt = done[rec.id];
    const urgency = COPY.urgency[rec.urgency];
    return (
      <div key={rec.id} className="ins-rec" data-primary={isPrimary ? "true" : undefined} data-testid={`rec-${rec.id}`}>
        <span className="ins-rec-urgency">
          {pick(urgency, language)}
          {rec.proposedAction ? ` · ${pick(permission?.approvalRequired ? COPY.approval : COPY.routine, language)}` : ` · ${pick(COPY.needsDecision, language)}`}
        </span>
        <p className="ins-rec-title">{rec.title}</p>
        <p className="ins-rec-rationale">{rec.rationale}</p>
        {receipt ? (
          <p className="ins-question" style={{ color: "var(--wd-success)", margin: 0 }}>
            <IconCircleCheck size={16} stroke={2} aria-hidden="true" />
            {pick(COPY.done, language).replace("{id}", receipt.createdRecordId ?? receipt.auditEventId ?? "")}
          </p>
        ) : rec.proposedAction ? (
          <>
            <button type="button" className={`wd-btn ${isPrimary ? "wd-btn-primary" : "wd-btn-secondary"}`} onClick={() => setDialog(rec.id)} data-testid={`review-${rec.id}`}>
              {pick(COPY.review, language)}
              <IconArrowRight size={14} stroke={2} aria-hidden="true" />
            </button>
            {permission && !permission.allowed ? (
              <p className="ins-rec-permission">{pick(COPY.locked, language).replace("{roles}", permission.heldBy.join(", "))}</p>
            ) : null}
          </>
        ) : rec.href ? (
          <a className={`wd-btn ${isPrimary ? "wd-btn-primary" : "wd-btn-secondary"}`} href={rec.href}>
            {pick(COPY.open, language)}
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  };

  return (
    <div className="ins-page" data-testid="insight-canvas">
      <nav className="ins-breadcrumb ins-no-print" aria-label="Breadcrumb">
        <a href={`/workday/${roleId}/insights`}>{pick(COPY.insights, language)}</a>
        <IconChevronRight size={12} stroke={2} aria-hidden="true" />
        <span>{response.title}</span>
      </nav>

      <header className="ins-reveal">
        <p className="ins-question">
          <IconSparkles size={16} stroke={1.8} aria-hidden="true" style={{ color: "var(--wd-accent)" }} />
          {pick(COPY.asked, language)}: {response.question}
        </p>
        <h1 className="ins-conclusion" data-testid="insight-conclusion">{response.conclusion}</h1>
        <div className="ins-meta">
          <span>{pick(COPY.prepared, language)}</span>
          <span><strong>{pick(COPY.dataAsOf, language)}</strong> {response.dataAsOf}</span>
          <span><strong>{pick(COPY.scope, language)}</strong> {response.scope}</span>
          <span title={response.confidence.explanation}>
            <strong>{pick(COPY.confidence, language)}</strong> {pick(COPY[response.confidence.level], language)}
          </span>
          <span className="ins-no-print" style={{ display: "inline-flex", gap: 4 }}>
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={save} disabled={Boolean(saved)} data-testid="insight-save">
              {saved ? <IconBookmarkFilled size={14} aria-hidden="true" /> : <IconBookmark size={14} stroke={1.8} aria-hidden="true" />}
              {pick(saved ? COPY.saved : COPY.save, language)}
            </button>
            <a className="wd-btn wd-btn-quiet wd-btn-sm" href={agentHref}>
              <IconRobot size={14} stroke={1.8} aria-hidden="true" />
              {pick(COPY.agent, language)}
            </a>
            <button type="button" className="wd-btn wd-btn-quiet wd-btn-sm" onClick={() => window.print()}>
              <IconPrinter size={14} stroke={1.8} aria-hidden="true" />
              {pick(COPY.print, language)}
            </button>
          </span>
        </div>
      </header>

      {response.metrics.length ? (
        <div className="ins-metrics ins-reveal" style={{ animationDelay: "60ms" }} data-testid="insight-metrics">
          {response.metrics.map((metric) => (
            <div key={metric.id} className="ins-metric">
              <div className="ins-metric-label">
                <span className="ins-status-dot" data-tone={metric.status} aria-hidden="true" />
                {metric.label}
              </div>
              <div className="ins-metric-value">
                {typeof metric.value === "number" ? metric.value.toLocaleString(language === "de" ? "de-DE" : "en-US") : metric.value}
                {metric.unit ? <span className="ins-metric-unit">{metric.unit}</span> : null}
              </div>
              {metric.delta !== undefined || metric.deltaLabel ? (
                <div className="ins-metric-delta">
                  {metric.delta !== undefined ? `${metric.delta > 0 ? "+" : ""}${metric.delta} ` : ""}
                  {metric.deltaLabel ?? ""}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="ins-grid">
        <div className="ins-main">
          {primary ? <VisualisationFrame viz={primary} language={language} primary /> : null}

          {response.findings.length ? (
            <section className="ins-card" aria-labelledby="ins-findings">
              <div className="ins-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <h2 id="ins-findings" className="ins-section-title">{pick(COPY.findings, language)}</h2>
                <button type="button" className="wd-btn wd-btn-link wd-btn-sm ins-no-print" onClick={() => setDrawer({ highlight: [] })} data-testid="evidence-open">
                  <IconFileText size={14} stroke={1.8} aria-hidden="true" />
                  {pick(COPY.evidenceAll, language).replace("{count}", String(response.evidence.length))}
                </button>
              </div>
              <div className="ins-card-body">
                <ul className="ins-findings">
                  {response.findings.map((finding) => (
                    <li key={finding.id} className="ins-finding" data-severity={finding.severity}>
                      <span className="ins-finding-icon" aria-hidden="true">
                        {finding.severity === "info" ? <IconInfoCircle size={16} stroke={1.8} /> : <IconAlertTriangle size={16} stroke={1.8} />}
                      </span>
                      <div>
                        <p className="ins-finding-title">{finding.href ? <a href={finding.href}>{finding.title}</a> : finding.title}</p>
                        <p className="ins-finding-detail">{finding.detail}</p>
                        {finding.evidenceIds.length ? (
                          <button type="button" className="wd-btn wd-btn-link wd-btn-sm ins-finding-sources ins-no-print" onClick={() => setDrawer({ highlight: finding.evidenceIds })}>
                            {(() => {
                              const count = finding.evidenceIds.filter((id) => evidenceById.has(id)).length;
                              return count === 1 ? pick(COPY.source, language) : pick(COPY.sources, language).replace("{count}", String(count));
                            })()}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {supporting.length ? (
            <section aria-label={pick(COPY.moreViews, language).replace("{count}", String(supporting.length))}>
              <button type="button" className="wd-btn wd-btn-secondary ins-no-print" aria-expanded={moreViews} onClick={() => setMoreViews((open) => !open)} data-testid="more-views">
                {moreViews ? <IconChevronDown size={14} stroke={2} aria-hidden="true" /> : <IconChevronRight size={14} stroke={2} aria-hidden="true" />}
                {pick(COPY.moreViews, language).replace("{count}", String(supporting.length))}
              </button>
              {moreViews ? (
                <div style={{ display: "grid", gap: 20, marginTop: 16 }}>
                  {supporting.map((viz) => (
                    <VisualisationFrame key={viz.id} viz={viz} language={language} />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className="ins-side" aria-label={pick(COPY.recommended, language)}>
          {first ? (
            <div>
              <h2 className="ins-section-title" style={{ marginBottom: 8 }}>{pick(COPY.recommended, language)}</h2>
              {recCard(first, true)}
            </div>
          ) : null}
          {rest.length ? (
            <div>
              <p className="ins-section-sub" style={{ marginBottom: 8 }}>{pick(COPY.more, language)}</p>
              <div style={{ display: "grid", gap: 10 }}>{rest.map((rec) => recCard(rec, false))}</div>
            </div>
          ) : null}

          <div className="ins-card">
            <div className="ins-card-head">
              <h2 className="ins-section-title">{pick(COPY.howBuilt, language)}</h2>
            </div>
            <dl className="ins-card-body" style={{ display: "grid", gap: 10, margin: 0 }}>
              <div><dt className="ins-section-sub">{pick(COPY.using, language)}</dt><dd style={{ margin: "2px 0 0", fontSize: 13 }}>{response.plan.using.join(", ")}</dd></div>
              <div><dt className="ins-section-sub">{pick(COPY.window, language)}</dt><dd style={{ margin: "2px 0 0", fontSize: 13 }}>{response.plan.timeWindow}</dd></div>
              <div><dt className="ins-section-sub">{pick(COPY.grouped, language)}</dt><dd style={{ margin: "2px 0 0", fontSize: 13 }}>{response.plan.groupedBy}</dd></div>
              <div><dt className="ins-section-sub">{pick(COPY.output, language)}</dt><dd style={{ margin: "2px 0 0", fontSize: 13 }}>{response.plan.output}</dd></div>
              <div><dt className="ins-section-sub">{pick(COPY.confidence, language)}</dt><dd style={{ margin: "2px 0 0", fontSize: 13 }}>{response.confidence.explanation}</dd></div>
              <div className="ins-no-print">
                <button type="button" className="wd-btn wd-btn-link wd-btn-sm" aria-expanded={technical} onClick={() => setTechnical((open) => !open)}>
                  {pick(COPY.technical, language)}
                </button>
                {technical ? <p className="ins-explain">{pick(COPY.technicalBody, language).replace("{audit}", auditEventId ?? "n/a")}</p> : null}
              </div>
            </dl>
          </div>

          {response.followUps.length ? (
            <div className="ins-no-print">
              <p className="ins-section-sub" style={{ marginBottom: 8 }}>{pick(COPY.followUps, language)}</p>
              <div className="ins-followups">
                {response.followUps.map((follow) => (
                  <button key={follow.question} type="button" className="ins-chip-btn" onClick={() => ask(follow.question)} title={follow.question}>
                    {follow.label}
                    <IconArrowRight size={12} stroke={2} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {drawer ? (
        <EvidenceDrawer evidence={response.evidence} highlight={drawer.highlight} language={language} onClose={() => setDrawer(null)} />
      ) : null}

      {activeRec?.proposedAction ? (
        <WritebackDialog
          roleId={roleId}
          insightId={insightId}
          recommendationId={activeRec.id}
          proposal={activeRec.proposedAction}
          permission={permissions[activeRec.id] ?? { allowed: false, missingScopes: [], authorityClass: "", approvalRequired: true, heldBy: [] }}
          evidenceNames={evidenceNames}
          actorLabel={actorLabel}
          language={language}
          onClose={() => setDialog(null)}
          onCommitted={(receipt) => setDone((current) => ({ ...current, [activeRec.id]: receipt }))}
        />
      ) : null}
    </div>
  );
}

function EvidenceDrawer({ evidence, highlight, language, onClose }: { evidence: InsightEvidence[]; highlight: string[]; language: Language; onClose: () => void }) {
  const ordered = highlight.length ? [...evidence].sort((a, b) => Number(highlight.includes(b.id)) - Number(highlight.includes(a.id))) : evidence;
  return (
    <div className="ins-drawer-scrim" onClick={onClose}>
      <div
        className="ins-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ev-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        data-testid="evidence-drawer"
      >
        <div className="ins-drawer-head">
          <div>
            <h2 id="ev-title" className="ins-section-title">{pick(COPY.evidence, language)}</h2>
            <p className="ins-section-sub">{pick(COPY.sources, language).replace("{count}", String(evidence.length))}</p>
          </div>
          <button type="button" className="wd-icon-btn" aria-label={pick(COPY.close, language)} onClick={onClose} autoFocus>
            <IconX size={18} stroke={1.8} aria-hidden="true" />
          </button>
        </div>
        <div className="ins-drawer-body">
          <ul className="ins-evidence">
            {ordered.map((item) => (
              <li key={item.id} className="ins-evidence-item" data-highlight={highlight.includes(item.id) ? "true" : undefined}>
                <div className="ins-evidence-top">
                  <span>{item.sourceType} · {item.recordId}</span>
                  <span className="ins-fresh">
                    <span className="ins-status-dot" data-tone={item.freshness === "current" ? "good" : item.freshness === "aging" ? "watch" : "warning"} aria-hidden="true" />
                    {pick(COPY.fresh[item.freshness], language)} · {item.observedAt}
                  </span>
                </div>
                <p className="ins-evidence-name">{item.href ? <a href={item.href} style={{ color: "inherit" }}>{item.sourceName}</a> : item.sourceName}</p>
                {item.excerpt ? <p className="ins-evidence-excerpt">{item.excerpt}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
