/**
 * The decision list.
 *
 * Every open decision for the role at the current moment, each rendered as the
 * full decision flow rather than a summary that needs a further click. A risk
 * professional deciding four things in a morning should not have to navigate
 * four times to see the evidence.
 */

import { notFound } from "next/navigation";
import { isDatabaseReady } from "@/db/client";
import { ROLE_IDS, type RoleId } from "@/db/schema/core";
import {
  getDecisions,
  getExecutionReceipt,
  getRole,
  getUser,
} from "@/db/repositories/workday";
import { buildIntelligenceRail, citationsFor, uncertaintyFromEvidence } from "@/db/repositories/rail";
import { getScenarioState } from "@/scenario/engine/state";
import { NotSeeded, WorkdayShell } from "@/components/shell/WorkdayShell";
import { IntelligenceRail } from "@/components/shell/IntelligenceRail";
import { DecisionFlow } from "@/components/decisions/DecisionFlow";
import { toDecisionView } from "../v1";
import { Chip } from "@/components/evidence/primitives";
import type { Language } from "@/i18n/labels";

export const dynamic = "force-dynamic";

function parseRole(value: string): RoleId {
  if ((ROLE_IDS as readonly string[]).includes(value)) return value as RoleId;
  notFound();
}

export default async function DecisionsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = await params;
  const roleId = parseRole(roleParam);

  if (!isDatabaseReady()) return <NotSeeded />;
  const state = getScenarioState();
  if (!state) return <NotSeeded />;

  const language = state.language as Language;
  const role = getRole(roleId);
  if (!role) return <NotSeeded />;

  const holder = getUser(role.holderUserId);
  const entries = getDecisions(roleId, state.currentMoment);
  const open = entries.filter((entry) => entry.decision.status === "open");
  const decided = entries.filter((entry) => entry.decision.status !== "open");

  const allEvidenceIds = entries.flatMap((entry) => [
    ...entry.decision.supportingEvidenceIds,
    ...entry.decision.opposingEvidenceIds,
  ]);

  const rail = buildIntelligenceRail({
    roleId,
    atMoment: state.currentMoment,
    language,
    contextLabel: `${entries.length} decision(s) visible at ${state.currentMoment}, of which ${open.length} remain open.`,
    evidenceIds: Array.from(new Set(allEvidenceIds)),
    whyThisMatters: open.map((entry) => entry.decision.whyThisMatters),
    uncertainty: uncertaintyFromEvidence(Array.from(new Set(allEvidenceIds))),
  });

  return (
    <WorkdayShell
      roleId={roleId}
      activeNav="decisions"
      intelligenceRail={<IntelligenceRail {...rail} />}
    >
      <div className="stack stack-8">
        <header className="stack stack-3">
          <div className="row row-3 row-between row-wrap">
            <div className="stack stack-1">
              <span className="label">{state.currentMoment} &middot; Decisions</span>
              <h1 className="display" style={{ fontSize: "var(--text-2xl)" }}>
                The judgments that are yours to make
              </h1>
            </div>
            <div className="row row-2">
              <Chip tone="amber">{open.length} open</Chip>
              <Chip tone="green">{decided.length} recorded</Chip>
            </div>
          </div>
          <p className="lede">
            Each decision below shows what was prepared, the evidence on both sides, and what is not
            known. Nothing is pre-selected, and no rationale is written for you.
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="label">No decisions at this moment</span>
            <p>
              Move the timeline forward to reach a point where this role's judgment is required.
            </p>
          </div>
        ) : null}

        {open.length > 0 ? (
          <section className="stack stack-5" aria-label="Open decisions">
            {open.map((entry) => (
              <div key={entry.decision.id} id={entry.decision.id}>
                <DecisionFlow
                  decision={toDecisionView(entry.decision)}
                  options={entry.options.map((option) => ({
                    id: option.id,
                    label: option.label,
                    labelDe: option.labelDe,
                    description: option.description,
                    isRecommended: option.isRecommended,
                    recommendationBasis: option.recommendationBasis,
                    riskImplication: option.riskImplication,
                    requiresApproval: option.requiresApproval,
                    consequences: option.consequences,
                  }))}
                  supportingEvidence={citationsFor(entry.decision.supportingEvidenceIds)}
                  opposingEvidence={citationsFor(entry.decision.opposingEvidenceIds)}
                  receiptStatements={[]}
                  language={language}
                  actingUserName={holder?.name ?? role.holderUserId}
                />
              </div>
            ))}
          </section>
        ) : null}

        {decided.length > 0 ? (
          <section className="stack stack-5" aria-label="Recorded decisions">
            <h2 style={{ fontSize: "var(--text-lg)" }}>Recorded today</h2>
            {decided.map((entry) => (
              <div key={entry.decision.id} id={entry.decision.id}>
                <DecisionFlow
                  decision={toDecisionView(entry.decision)}
                  options={entry.options.map((option) => ({
                    id: option.id,
                    label: option.label,
                    labelDe: option.labelDe,
                    description: option.description,
                    isRecommended: option.isRecommended,
                    recommendationBasis: option.recommendationBasis,
                    riskImplication: option.riskImplication,
                    requiresApproval: option.requiresApproval,
                    consequences: option.consequences,
                  }))}
                  supportingEvidence={citationsFor(entry.decision.supportingEvidenceIds)}
                  opposingEvidence={citationsFor(entry.decision.opposingEvidenceIds)}
                  receiptStatements={getExecutionReceipt(entry.decision.id).map((line) => line.statement)}
                  language={language}
                  actingUserName={holder?.name ?? role.holderUserId}
                />
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </WorkdayShell>
  );
}
