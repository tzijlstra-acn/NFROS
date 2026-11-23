/**
 * Agents: the governed long tail of NFR work.
 *
 * Two kinds of personal agent, both reading only what the person's role
 * reads, through READ tools and the authority gate:
 *
 *   analysis agents  a saved analysis that runs again on demand or weekly,
 *                    built in four steps from an analysis (Save as agent);
 *   watch lists      a filtered list over the records (the skills engine),
 *                    drafted from a sentence.
 *
 * Neither holds access of its own, and neither changes a record: a change it
 * proposes still needs a person to approve it.
 */

import { IconArrowRight, IconShieldLock } from "@tabler/icons-react";
import { SkillsWorkspace } from "@/components/workday-v3/skills/SkillsWorkspace";
import { AskPanel } from "@/components/insights/AskPanel";
import { AgentBuilder, MyAgents, type BuilderModel } from "@/components/agents/AgentBuilder";
import { insightsPageContext } from "@/features/insights/page-context";
import { getInsight } from "@/features/insights/service";
import { suggestedIntents } from "@/features/insights/intents";
import { agentRuns, listAgents } from "@/features/agents/service";
import { ROLE_AUTHORITY_SCOPES } from "@/server/security/authority";
import type { RouteQuery, RoleRouteParams } from "@/workday/dispatch";

const COPY = {
  title: { en: "Agents", de: "Agenten" },
  lede: {
    en: "For the questions no standard process covers. An analysis you will need again becomes an agent; a list of records you keep checking becomes a watch list.",
    de: "Fuer Fragen, die kein Standardprozess abdeckt. Eine Analyse, die Sie wieder brauchen, wird ein Agent; eine Liste, die Sie immer wieder pruefen, eine Beobachtungsliste.",
  },
  principle: { en: "An agent inherits your access. It does not create new access.", de: "Ein Agent erbt Ihren Zugriff. Er schafft keinen neuen Zugriff." },
  principleDetail: {
    en: "It reads through the same READ tools and authority gate as you, scoped to your role and the current moment, and every run is audited. It can propose a change; only a person can approve one.",
    de: "Er liest ueber dieselben READ-Werkzeuge und dasselbe Befugnis-Gate wie Sie, begrenzt auf Ihre Rolle und den aktuellen Moment, und jeder Lauf wird protokolliert. Er kann eine Aenderung vorschlagen; genehmigen kann nur eine Person.",
  },
  path: [
    { en: "Ad hoc question", de: "Ad-hoc-Frage" },
    { en: "Saved personal agent", de: "Gespeicherter persoenlicher Agent" },
    { en: "Reviewed team template", de: "Gepruefte Teamvorlage" },
    { en: "Standard NFR app or automation", de: "Standard-NFR-App oder Automatisierung" },
  ],
  build: { en: "Build an agent", de: "Einen Agenten erstellen" },
  buildFrom: { en: "Build an agent from this analysis", de: "Einen Agenten aus dieser Analyse erstellen" },
  describe: {
    en: "Describe the outcome. The Workspace prepares the analysis from the records; save it as an agent from its page.",
    de: "Beschreiben Sie das Ergebnis. Der Workspace bereitet die Analyse aus den Datensaetzen vor; speichern Sie sie von ihrer Seite als Agent.",
  },
  watch: { en: "Watch lists", de: "Beobachtungslisten" },
} as const;

const TOOL_LABELS: Record<string, { en: string; de: string }> = {
  createAction: { en: "a remediation action", de: "eine Massnahme" },
  requestEvidenceDocument: { en: "an evidence request", de: "eine Nachweisanforderung" },
  createIssue: { en: "an issue", de: "eine Feststellung" },
  activateMonitoring: { en: "enhanced monitoring", de: "erweiterte Ueberwachung" },
};

function pick(pair: { en: string; de: string }, language: "en" | "de"): string {
  return language === "de" ? pair.de : pair.en;
}

export default async function AgentsPage({ params, searchParams }: { params: Promise<RoleRouteParams>; searchParams: RouteQuery }) {
  const { role } = await params;
  const page = await insightsPageContext(role);
  const { roleId, language } = page;
  const text = (key: string) => (typeof searchParams?.[key] === "string" ? (searchParams[key] as string) : undefined);
  const from = text("from");
  const source = from && /^INS-[A-Z0-9]{8}$/.test(from) ? getInsight(roleId, from) : null;
  const L = (en: string, de: string) => (language === "de" ? de : en);

  let model: BuilderModel | null = null;
  if (source?.response) {
    const response = source.response;
    const tools = [...new Set(response.recommendations.map((rec) => rec.proposedAction?.toolName).filter((name): name is string => Boolean(name)))];
    model = {
      question: response.question,
      intentId: response.intentId,
      defaultName: response.title,
      sourceInsightId: source.id,
      sources: response.plan.using,
      proposes: tools.map((tool) => pick(TOOL_LABELS[tool] ?? { en: tool, de: tool }, language)),
      plan: [
        L(`Read ${response.plan.using.join(", ")}, as of the moment it runs.`, `${response.plan.using.join(", ")} lesen, zum Zeitpunkt des Laufs.`),
        L(`Compute the figures over ${response.plan.timeWindow.toLowerCase()}, grouped by ${response.plan.groupedBy.toLowerCase()}.`, `Die Zahlen ueber ${response.plan.timeWindow} berechnen, gruppiert nach ${response.plan.groupedBy}.`),
        L(`Produce ${response.plan.output.toLowerCase()}, each finding linked to its evidence.`, `${response.plan.output} erstellen, jede Feststellung mit Nachweis verknuepft.`),
        L("Prepare the next steps as proposals; nothing is written until you approve.", "Die naechsten Schritte als Vorschlaege vorbereiten; nichts wird geschrieben, bevor Sie genehmigen."),
      ],
      dataAsOf: response.dataAsOf,
      roleLabel: page.roleLabel,
      holderName: page.holderName,
      scopeCount: ROLE_AUTHORITY_SCOPES[roleId]?.length ?? 0,
    };
  }

  const agents = listAgents(roleId).map((agent) => ({
    id: agent.id,
    name: agent.name,
    question: agent.question,
    schedule: agent.schedule,
    status: agent.status,
    runCount: agent.runCount,
    lastRunAt: agent.lastRunAt,
    lastRunInsightId: agent.lastRunInsightId,
    runs: agentRuns(roleId, agent.id, 3).map((run) => ({ id: run.id, moment: run.moment, conclusion: run.conclusion })),
  }));
  const suggestions = suggestedIntents(roleId, 4).map((intent) => ({ label: pick(intent.label, language), question: pick(intent.question, language) }));

  return (
    <div className="ins-page" data-testid="agents-page">
      <h1 className="ins-conclusion" style={{ fontSize: 24 }}>{pick(COPY.title, language)}</h1>
      <p className="ins-question" style={{ margin: "6px 0 16px", maxWidth: "72ch" }}>{pick(COPY.lede, language)}</p>

      <div className="ins-explain" style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
        <IconShieldLock size={18} stroke={1.8} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: "var(--wd-accent)" }} />
        <div>
          <strong>{pick(COPY.principle, language)}</strong>
          <div style={{ marginTop: 2, color: "var(--wd-text-secondary)" }}>{pick(COPY.principleDetail, language)}</div>
        </div>
      </div>

      <ol aria-label={L("Promotion path", "Weg zur Standardisierung")} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "0 0 24px", padding: 0, listStyle: "none" }}>
        {COPY.path.map((step, index) => (
          <li key={step.en} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="ins-chip-btn" style={{ cursor: "default" }}>{index + 1}. {pick(step, language)}</span>
            {index < COPY.path.length - 1 ? <IconArrowRight size={14} stroke={2} aria-hidden="true" style={{ color: "var(--wd-text-muted)" }} /> : null}
          </li>
        ))}
      </ol>

      <div className="ins-grid">
        <div className="ins-main">
          <section aria-labelledby="agent-build">
            <h2 id="agent-build" className="ins-section-title" style={{ marginBottom: 10 }}>{pick(model ? COPY.buildFrom : COPY.build, language)}</h2>
            {model ? (
              <AgentBuilder roleId={roleId} language={language} model={model} />
            ) : (
              <>
                <p className="ins-section-sub" style={{ marginBottom: 10 }}>{pick(COPY.describe, language)}</p>
                <AskPanel roleId={roleId} language={language} suggestions={suggestions} testId="agents-ask" />
              </>
            )}
          </section>
          <section aria-labelledby="agent-watch" style={{ marginTop: 12 }}>
            <h2 id="agent-watch" className="ins-section-title" style={{ marginBottom: 10 }}>{pick(COPY.watch, language)}</h2>
            <SkillsWorkspace
              roleId={roleId}
              language={language}
              query={{ ask: text("ask"), draft: text("draft"), via: text("via"), skill: text("skill"), notice: text("notice") }}
            />
          </section>
        </div>
        <aside className="ins-side">
          <MyAgents roleId={roleId} language={language} agents={agents} />
        </aside>
      </div>
    </div>
  );
}
