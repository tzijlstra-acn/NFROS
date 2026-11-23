/**
 * Agents: the governed long tail of NFR work.
 *
 * An agent is a person's own reusable piece of analysis: a watch list over
 * the records their role reads (the skills engine), or a saved analysis that
 * re-runs on a schedule. It inherits the person's access and creates none:
 * it reads through READ tools and the authority gate, and any change it
 * proposes still needs a person to approve it.
 */

import { IconArrowRight, IconShieldLock } from "@tabler/icons-react";
import { SkillsWorkspace } from "@/components/workday-v3/skills/SkillsWorkspace";
import { insightsPageContext } from "@/features/insights/page-context";
import type { RouteQuery, RoleRouteParams } from "@/workday/dispatch";

const COPY = {
  title: { en: "Agents", de: "Agenten" },
  lede: {
    en: "For the questions no standard process covers. Describe what to watch or analyse, check how it reads the records, and keep it.",
    de: "Fuer Fragen, die kein Standardprozess abdeckt. Beschreiben Sie, was beobachtet oder analysiert werden soll, pruefen Sie, wie es die Datensaetze liest, und behalten Sie es.",
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
} as const;

function pick(pair: { en: string; de: string }, language: "en" | "de"): string {
  return language === "de" ? pair.de : pair.en;
}

export default async function AgentsPage({ params, searchParams }: { params: Promise<RoleRouteParams>; searchParams: RouteQuery }) {
  const { role } = await params;
  const page = await insightsPageContext(role);
  const { roleId, language } = page;
  const text = (key: string) => (typeof searchParams?.[key] === "string" ? (searchParams[key] as string) : undefined);

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

      <ol aria-label={language === "de" ? "Weg zur Standardisierung" : "Promotion path"} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "0 0 24px", padding: 0, listStyle: "none" }}>
        {COPY.path.map((step, index) => (
          <li key={step.en} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="ins-chip-btn" style={{ cursor: "default" }}>{index + 1}. {pick(step, language)}</span>
            {index < COPY.path.length - 1 ? <IconArrowRight size={14} stroke={2} aria-hidden="true" style={{ color: "var(--wd-text-muted)" }} /> : null}
          </li>
        ))}
      </ol>

      <SkillsWorkspace
        roleId={roleId}
        language={language}
        query={{ ask: text("ask"), draft: text("draft"), via: text("via"), skill: text("skill"), notice: text("notice") }}
      />
    </div>
  );
}
