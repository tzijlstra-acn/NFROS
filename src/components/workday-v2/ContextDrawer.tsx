"use client";

/**
 * The context drawer, and the compact triggers that open it.
 *
 * This replaces the permanently wide intelligence rail. The information is
 * unchanged, and that is the point: evidence, why this matters, uncertainty,
 * applicable policy, approvals, AI activity and the audit trail are all still
 * here, and they are all still one click away. What changed is that they no
 * longer consume 372px of every screen at every moment, including the moments
 * when the user is reading a message or looking at a calendar.
 *
 * The existing evidence components are reused rather than reimplemented. They
 * are good, they encode the product's provenance discipline, and the token
 * bridge in `workday-v2-tokens.css` makes them render in the application
 * palette without being touched. Rewriting them against new token names would
 * have produced no new capability and would have forked them away from the V1
 * interface, which has to keep working during the transition.
 *
 * Tab order follows how a risk professional interrogates a position: what is
 * the evidence, what do we not know, what does policy require, what was
 * approved, what did the partner do, what is on the record. Uncertainty sits
 * second rather than last, because a surface that buries uncertainty behind
 * four other tabs is telling the user it is an afterthought.
 */

import {
  IconAlertTriangle,
  IconFileText,
  IconGavel,
  IconHistory,
  IconShieldCheck,
  IconSparkles,
} from "@tabler/icons-react";
import {
  ContradictionCard,
  EvidenceList,
  UncertaintyPanel,
} from "@/components/evidence/primitives";
import type { IntelligenceRailProps } from "@/components/shell/IntelligenceRail";
import { RAIL_TABS, t, type Language } from "@/i18n/labels";
import { Chip, Data, Empty, Item, List, ObjectRef, RegulatoryNote } from "./primitives";
import { Drawer, ExpandRow, Tabs, TabPanel } from "./interactive";
import { useShell } from "./ShellContext";
import type { DrawerTab } from "@/workday/context-counts";

/* ==========================================================================
   The triggers
   ========================================================================== */

const TRIGGER_ORDER: Array<{ tab: DrawerTab; labelKey: string; icon: typeof IconFileText }> = [
  { tab: "evidence", labelKey: "evidence", icon: IconFileText },
  { tab: "uncertainty", labelKey: "uncertainty", icon: IconAlertTriangle },
  { tab: "policy", labelKey: "applicablePolicy", icon: IconGavel },
  { tab: "approvals", labelKey: "humanApprovals", icon: IconShieldCheck },
  { tab: "activity", labelKey: "aiActivity", icon: IconSparkles },
  { tab: "audit", labelKey: "auditTrail", icon: IconHistory },
];

/**
 * The compact context triggers, for example "Evidence 7" and "Uncertainty 2".
 *
 * A trigger with a count of zero is still rendered for evidence and audit,
 * because their absence is itself informative and a user who cannot find the
 * evidence control concludes there is none rather than that there is nothing.
 * The others are hidden at zero to keep the row short.
 */
export function ContextTriggers({
  counts,
  language,
  compact = false,
}: {
  counts: Record<DrawerTab, number>;
  language: Language;
  compact?: boolean;
}) {
  const shell = useShell();
  const alwaysShown: DrawerTab[] = ["evidence", "audit"];

  return (
    <div className="app-row app-row-wrap" role="group" aria-label={language === "de" ? "Kontext" : "Context"}>
      {TRIGGER_ORDER.filter(
        (entry) => counts[entry.tab] > 0 || alwaysShown.includes(entry.tab),
      ).map((entry) => {
        const label = t(RAIL_TABS, entry.labelKey, language);
        const count = counts[entry.tab];
        const Glyph = entry.icon;
        return (
          <button
            key={entry.tab}
            type="button"
            className="app-btn app-btn-quiet app-btn-sm"
            onClick={(event) => shell.openDrawer(entry.tab, event.currentTarget)}
            aria-label={`${label}, ${count}`}
          >
            {compact ? null : <Glyph size={13} stroke={1.8} aria-hidden="true" />}
            <span>{label}</span>
            <Data>{count}</Data>
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   The drawer
   ========================================================================== */

export function ContextDrawer({
  rail,
  language,
  subtitle,
}: {
  rail: IntelligenceRailProps;
  language: Language;
  /** What the drawer is currently describing. */
  subtitle?: string;
}) {
  const shell = useShell();
  const active = shell.drawerTab;

  if (active === null) return null;

  const tabs: Array<{ id: DrawerTab; label: string; badge?: React.ReactNode }> = [
    { id: "evidence", label: t(RAIL_TABS, "evidence", language), badge: countBadge(rail.evidence.length) },
    {
      id: "uncertainty",
      label: t(RAIL_TABS, "uncertainty", language),
      badge: countBadge(rail.uncertainty.length + rail.contradictions.length),
    },
    { id: "policy", label: t(RAIL_TABS, "applicablePolicy", language), badge: countBadge(rail.policies.length) },
    {
      id: "approvals",
      label: t(RAIL_TABS, "humanApprovals", language),
      badge: countBadge(rail.approvals.length),
    },
    { id: "activity", label: t(RAIL_TABS, "aiActivity", language), badge: countBadge(rail.agentActivity.length) },
    { id: "audit", label: t(RAIL_TABS, "auditTrail", language), badge: countBadge(rail.auditTrail.length) },
  ];

  return (
    <Drawer
      open
      onClose={shell.closeDrawer}
      title={language === "de" ? "Kontext" : "Context"}
      subtitle={subtitle ?? rail.contextLabel}
    >
      <div style={{ marginBottom: "var(--app-4)" }}>
        <Tabs
          tabs={tabs}
          active={active}
          onChange={(id) => shell.openDrawer(id as DrawerTab)}
          label={language === "de" ? "Kontextbereiche" : "Context areas"}
        />
      </div>

      <TabPanel id="evidence" active={active === "evidence"}>
        {rail.evidence.length === 0 ? (
          <Empty
            title={language === "de" ? "Keine Nachweise verknuepft" : "No evidence is linked"}
            detail={
              language === "de"
                ? "Waehlen Sie ein Risiko, eine Kontrolle oder eine Entscheidung, um die zugehoerigen Nachweise zu sehen."
                : "Select a risk, a control or a decision to see the evidence behind it."
            }
          />
        ) : (
          <>
            <EvidenceList citations={rail.evidence} language={language} />
            {/*
              * Why this matters sits under the evidence rather than in its own
              * tab. In V1 it was tab two of seven, which put a one line
              * statement of materiality at the same level of prominence as the
              * entire audit trail. It belongs beside the evidence it rests on.
              */}
            {rail.whyThisMatters.length > 0 ? (
              <div className="app-stack-2" style={{ marginTop: "var(--app-5)" }}>
                <span className="app-meta">{t(RAIL_TABS, "whyThisMatters", language)}</span>
                <List label={t(RAIL_TABS, "whyThisMatters", language)}>
                  {rail.whyThisMatters.map((statement, index) => (
                    <Item key={index} title={statement} large />
                  ))}
                </List>
              </div>
            ) : null}
          </>
        )}
      </TabPanel>

      <TabPanel id="uncertainty" active={active === "uncertainty"}>
        <div className="app-stack-4">
          {rail.contradictions.length > 0 ? (
            <div className="app-stack-3">
              {rail.contradictions.map((entry) => (
                <ContradictionCard key={entry.id} contradiction={entry} language={language} />
              ))}
            </div>
          ) : null}

          {rail.uncertainty.length > 0 ? (
            <UncertaintyPanel items={rail.uncertainty} />
          ) : null}

          {rail.uncertainty.length === 0 && rail.contradictions.length === 0 ? (
            <Empty
              title={
                language === "de"
                  ? "Keine offenen Unsicherheiten erfasst"
                  : "No open uncertainty is recorded"
              }
              detail={
                language === "de"
                  ? "Das bedeutet nicht, dass keine besteht. Es bedeutet, dass an diesem Punkt keine erfasst wurde."
                  : "That does not mean there is none. It means none has been recorded at this point."
              }
            />
          ) : null}
        </div>
      </TabPanel>

      <TabPanel id="policy" active={active === "policy"}>
        {rail.policies.length === 0 ? (
          <Empty title={language === "de" ? "Keine Richtlinie zugeordnet" : "No policy is mapped"} />
        ) : (
          <div className="app-stack-3">
            {rail.policies.map((policy) => (
              <div key={policy.id} className="app-stack-1">
                <div className="app-row app-between">
                  <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
                    {policy.section} {policy.sectionTitle}
                  </span>
                  <ObjectRef id={policy.reference} label="policy" />
                </div>
                <p className="app-one-line">{policy.body}</p>
                <div className="app-row">
                  <span className="app-meta">
                    {language === "de" ? "Fassung" : "Version"} {policy.version}
                  </span>
                  <span className="app-meta">{policy.scope}</span>
                </div>
                {/*
                  * Policy text in this product routinely paraphrases a
                  * supervisory expectation, so the disclosure is attached
                  * here unconditionally rather than depending on whether a
                  * given section happens to name a regulator.
                  */}
                <RegulatoryNote language={language} />
              </div>
            ))}
          </div>
        )}
      </TabPanel>

      <TabPanel id="approvals" active={active === "approvals"}>
        {rail.approvals.length === 0 ? (
          <Empty
            title={
              language === "de" ? "Noch keine Genehmigung erteilt" : "No approval has been granted yet"
            }
          />
        ) : (
          <List label={t(RAIL_TABS, "humanApprovals", language)}>
            {rail.approvals.map((approval) => (
              <Item
                key={approval.id}
                large
                title={approval.toolName}
                subtitle={approval.rationale}
                leading={<Data>{approval.approvedAtMoment}</Data>}
                trailing={
                  <>
                    {approval.rationaleConfirmed ? (
                      <Chip tone="success">
                        {language === "de" ? "bestaetigt" : "confirmed"}
                      </Chip>
                    ) : (
                      <Chip tone="danger">
                        {language === "de" ? "nicht bestaetigt" : "not confirmed"}
                      </Chip>
                    )}
                    {approval.consumed ? (
                      <Chip>{language === "de" ? "verbraucht" : "used"}</Chip>
                    ) : null}
                  </>
                }
              />
            ))}
          </List>
        )}
      </TabPanel>

      <TabPanel id="activity" active={active === "activity"}>
        {rail.agentActivity.length === 0 ? (
          <Empty title={language === "de" ? "Keine Aktivitaet erfasst" : "No activity is recorded"} />
        ) : (
          <div className="app-activity">
            {rail.agentActivity.map((entry) => (
              <ExpandRow
                key={entry.id}
                label={entry.task}
                summary={
                  <>
                    <span className="app-activity-time">
                      {entry.durationMs === null ? "" : `${entry.durationMs} ms`}
                    </span>
                    <span aria-hidden="true" className="app-faint">
                      {entry.status === "blocked" ? "!" : entry.fromCache ? "=" : "+"}
                    </span>
                    <span className="app-activity-label app-truncate">{entry.task}</span>
                  </>
                }
              >
                <span>
                  {language === "de" ? "Komponente" : "Component"}: {entry.agentName}
                </span>
                <span>
                  {language === "de" ? "Status" : "Status"}: {entry.status}
                </span>
                {entry.outcome ? (
                  <span>
                    {language === "de" ? "Ergebnis" : "Outcome"}: {entry.outcome}
                  </span>
                ) : null}
                {entry.authorityClass ? (
                  <span>
                    {language === "de" ? "Befugnis" : "Authority"}: {entry.authorityClass}
                  </span>
                ) : null}
                <ObjectRef id={entry.id} label="run" />
              </ExpandRow>
            ))}
          </div>
        )}
      </TabPanel>

      <TabPanel id="audit" active={active === "audit"}>
        {rail.auditTrail.length === 0 ? (
          <Empty title={language === "de" ? "Noch kein Eintrag" : "No entry yet"} />
        ) : (
          <List label={t(RAIL_TABS, "auditTrail", language)}>
            {rail.auditTrail.map((record) => (
              <Item
                key={record.id}
                large
                leading={<Data>{record.atMoment}</Data>}
                title={record.summary}
                subtitle={`${record.category} ${record.action}`}
                trailing={
                  <>
                    {record.blocked ? (
                      <Chip tone="danger" title={record.blockedReason ?? undefined}>
                        {language === "de" ? "blockiert" : "blocked"}
                      </Chip>
                    ) : null}
                    <Chip>
                      {record.actorKind === "human"
                        ? language === "de"
                          ? "Mensch"
                          : "human"
                        : record.actorKind}
                    </Chip>
                  </>
                }
              />
            ))}
          </List>
        )}
      </TabPanel>
    </Drawer>
  );
}

function countBadge(count: number): React.ReactNode {
  if (count === 0) return null;
  return (
    <span className="app-chip app-chip-count" aria-hidden="true">
      {count}
    </span>
  );
}

/*
 * Re-exported rather than defined here.
 *
 * This module carries the client directive, and the counts must be derived on
 * the server, where the rail is assembled. Defining them here meant a server
 * component calling them failed at runtime with "Attempted to call
 * triggerCounts() from the server".
 */
export { triggerCounts, type ContextCounts } from "@/workday/context-counts";
