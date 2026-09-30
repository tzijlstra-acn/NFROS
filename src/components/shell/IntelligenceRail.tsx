"use client";

/**
 * The right intelligence rail.
 *
 * Seven tabs, in a fixed order that follows how a risk professional actually
 * interrogates a position: what is the evidence, why does it matter, what do
 * we not know, what does policy require, what needs approval, what did the
 * agent do, and what is on the record.
 *
 * Uncertainty sits third rather than last. That ordering is a deliberate
 * choice: a rail that buries uncertainty behind five other tabs is telling the
 * user it is an afterthought.
 */

import { useState } from "react";
import {
  ContradictionCard,
  EvidenceList,
  ObjectId,
  ProvenanceBadge,
  RegulatoryNote,
  UncertaintyPanel,
  type ContradictionEntry,
  type EvidenceCitation,
  type UncertaintyEntry,
} from "@/components/evidence/primitives";
import { RAIL_TABS, t, type Language } from "@/i18n/labels";

export interface PolicySection {
  id: string;
  reference: string;
  section: string;
  sectionTitle: string;
  body: string;
  version: string;
  scope: string;
}

export interface ApprovalRecord {
  id: string;
  toolName: string;
  approvedByUserId: string;
  approvedAtMoment: string;
  rationale: string;
  rationaleConfirmed: boolean;
  consumed: boolean;
}

export interface AgentActivityRecord {
  id: string;
  agentName: string;
  task: string;
  model: string;
  fromCache: boolean;
  durationMs: number | null;
  status: string;
  outcome?: string;
  authorityClass?: string;
}

export interface AuditRecord {
  id: string;
  atMoment: string;
  category: string;
  action: string;
  summary: string;
  actorKind: string;
  blocked: boolean;
  blockedReason: string | null;
  reversible: boolean;
}

export interface IntelligenceRailProps {
  language: Language;
  /** Short statement of what the rail is currently describing. */
  contextLabel: string;
  evidence: EvidenceCitation[];
  whyThisMatters: string[];
  uncertainty: UncertaintyEntry[];
  contradictions: ContradictionEntry[];
  policies: PolicySection[];
  approvals: ApprovalRecord[];
  agentActivity: AgentActivityRecord[];
  auditTrail: AuditRecord[];
}

const TAB_KEYS = [
  "evidence",
  "whyThisMatters",
  "uncertainty",
  "applicablePolicy",
  "humanApprovals",
  "aiActivity",
  "auditTrail",
] as const;

type TabKey = (typeof TAB_KEYS)[number];

export function IntelligenceRail(props: IntelligenceRailProps) {
  const [active, setActive] = useState<TabKey>("evidence");
  const { language } = props;

  const counts: Record<TabKey, number> = {
    evidence: props.evidence.length,
    whyThisMatters: props.whyThisMatters.length,
    uncertainty: props.uncertainty.length + props.contradictions.length,
    applicablePolicy: props.policies.length,
    humanApprovals: props.approvals.length,
    aiActivity: props.agentActivity.length,
    auditTrail: props.auditTrail.length,
  };

  return (
    <div className="stack stack-4">
      <div className="stack stack-2">
        <span className="label">Intelligence</span>
        <span className="meta" style={{ lineHeight: 1.4 }}>
          {props.contextLabel}
        </span>
      </div>

      {/* Tab list. Wraps rather than scrolls, because a hidden tab is a tab
          nobody opens. */}
      <div role="tablist" aria-label="Intelligence rail" className="row row-wrap" style={{ gap: 4 }}>
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`rail-tab-${key}`}
            aria-selected={active === key}
            aria-controls={`rail-panel-${key}`}
            className="segmented-option"
            onClick={() => setActive(key)}
            style={{
              border: "1px solid",
              borderColor: active === key ? "var(--accent-edge)" : "var(--border-1)",
              background: active === key ? "var(--accent-tint)" : "var(--surface-1)",
              color: active === key ? "var(--accent)" : "var(--text-4)",
            }}
          >
            {t(RAIL_TABS, key, language)}
            {counts[key] > 0 ? (
              <span className="mono" style={{ marginLeft: 4, opacity: 0.8 }}>
                {counts[key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`rail-panel-${active}`}
        aria-labelledby={`rail-tab-${active}`}
        tabIndex={0}
      >
        {active === "evidence" ? (
          <EvidenceList
            citations={props.evidence}
            language={language}
            emptyMessage="No evidence has been assembled for this work object yet."
          />
        ) : null}

        {active === "whyThisMatters" ? (
          <div className="stack stack-3">
            {props.whyThisMatters.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No significance statement has been recorded for this work object.
              </p>
            ) : (
              props.whyThisMatters.map((statement, index) => (
                <div key={index} className="card card-edge" data-tone="cyan">
                  <p style={{ fontSize: "var(--text-sm)" }}>{statement}</p>
                </div>
              ))
            )}
          </div>
        ) : null}

        {active === "uncertainty" ? (
          <div className="stack stack-5">
            <UncertaintyPanel items={props.uncertainty} />
            {props.contradictions.length > 0 ? (
              <div className="stack stack-2">
                <span className="label" style={{ color: "var(--red)" }}>
                  Detected contradictions ({props.contradictions.length})
                </span>
                {props.contradictions.map((contradiction) => (
                  <ContradictionCard
                    key={contradiction.id}
                    contradiction={contradiction}
                    language={language}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {active === "applicablePolicy" ? (
          <div className="stack stack-3">
            {props.policies.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No policy section has been identified as applicable to this work object.
              </p>
            ) : (
              props.policies.map((policy) => (
                <details key={policy.id} className="card">
                  <summary className="stack stack-1" style={{ cursor: "pointer" }}>
                    <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                      {policy.reference} {policy.section}
                    </span>
                    <span className="meta">
                      {policy.sectionTitle} &middot; version {policy.version} &middot; {policy.scope}
                    </span>
                  </summary>
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      marginTop: "var(--space-3)",
                      paddingTop: "var(--space-3)",
                      borderTop: "1px solid var(--border-1)",
                      lineHeight: 1.6,
                    }}
                  >
                    {policy.body}
                  </p>
                </details>
              ))
            )}
            <RegulatoryNote language={language} />
          </div>
        ) : null}

        {active === "humanApprovals" ? (
          <div className="stack stack-3">
            {props.approvals.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No approval has been granted in this session. Material changes are held as proposals
                until a person approves them.
              </p>
            ) : (
              props.approvals.map((approval) => (
                <div key={approval.id} className="card card-edge" data-tone="green">
                  <div className="stack stack-2">
                    <div className="row row-2 row-between row-wrap">
                      <span className="mono" style={{ fontSize: "var(--text-xs)" }}>
                        {approval.toolName}
                      </span>
                      <span className="chip" data-tone={approval.consumed ? "neutral" : "green"}>
                        {approval.consumed ? "used" : "unused"}
                      </span>
                    </div>
                    <span className="meta">
                      {approval.approvedByUserId} at {approval.approvedAtMoment}
                      {approval.rationaleConfirmed ? ", rationale confirmed" : ", rationale NOT confirmed"}
                    </span>
                    <p style={{ fontSize: "var(--text-sm)" }}>{approval.rationale}</p>
                    <ObjectId id={approval.id} />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {active === "aiActivity" ? (
          <div className="stack stack-3">
            {props.agentActivity.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No agent activity has been recorded for this work object yet.
              </p>
            ) : (
              props.agentActivity.map((record) => (
                <div
                  key={record.id}
                  className="card card-edge"
                  data-tone={record.outcome === "blocked" ? "red" : record.fromCache ? "neutral" : "accent"}
                >
                  <div className="stack stack-2">
                    <div className="row row-2 row-between row-wrap">
                      <span className="strong-text" style={{ fontSize: "var(--text-sm)" }}>
                        {record.agentName}
                      </span>
                      <span className="chip" data-tone={record.fromCache ? "neutral" : "accent"}>
                        {record.fromCache ? "cached" : "live"}
                      </span>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)" }}>{record.task}</p>
                    <div className="row row-2 row-wrap meta">
                      <span>{record.model}</span>
                      {record.durationMs !== null ? <span>{record.durationMs} ms</span> : null}
                      <span>{record.outcome ?? record.status}</span>
                      {record.authorityClass ? <span>{record.authorityClass}</span> : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {active === "auditTrail" ? (
          <div className="stack stack-2">
            {props.auditTrail.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                No audit events have been recorded yet in this session.
              </p>
            ) : (
              props.auditTrail.map((record) => (
                <div
                  key={record.id}
                  className="card card-edge"
                  data-tone={
                    record.blocked
                      ? "red"
                      : record.category === "decision"
                        ? "amber"
                        : record.category === "mutation"
                          ? "green"
                          : "neutral"
                  }
                  style={{ padding: "var(--space-3)" }}
                >
                  <div className="stack stack-1">
                    <div className="row row-2 row-between row-wrap">
                      <span className="mono" style={{ fontSize: "var(--text-xs)" }}>
                        {record.atMoment} {record.action}
                      </span>
                      <span className="chip" data-tone={record.blocked ? "red" : "neutral"}>
                        {record.blocked ? "refused" : record.category}
                      </span>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)" }}>{record.summary}</p>
                    {record.blockedReason ? (
                      <span className="meta" style={{ color: "var(--red)" }}>
                        {record.blockedReason}
                      </span>
                    ) : null}
                    <span className="meta">
                      {record.actorKind}
                      {record.reversible ? ", reversible" : ", not reversible in this prototype"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Convenience: a provenance legend, used at the foot of several surfaces. */
export function ProvenanceLegend({ language }: { language: Language }) {
  return (
    <div className="row row-2 row-wrap" aria-label="Provenance legend">
      {(
        [
          "verified-fact",
          "approved-record",
          "stakeholder-statement",
          "model-inference",
          "conflicting-evidence",
        ] as const
      ).map((kind) => (
        <ProvenanceBadge key={kind} kind={kind} language={language} />
      ))}
    </div>
  );
}
