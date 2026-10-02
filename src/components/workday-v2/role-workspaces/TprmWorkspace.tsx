"use client";

/**
 * The Third-Party Risk Manager's workspace.
 *
 * The hero is the supplier and fourth party constellation, and the live work
 * around it answers the four questions this role actually asks of an
 * arrangement: what changed in the monitoring, which service or subprocessor
 * the change reaches, what evidence was checked against the contract, and
 * which conditions of the last approval are still unmet.
 *
 * Two things are deliberately kept apart. What the contract binds and what the
 * supplier currently says are separate facts, and the constellation draws that
 * divergence as a split node rather than as a colour; this workspace does not
 * re-state it as a single status, because collapsing the two is how a drafting
 * gap becomes a tick. Similarly, an obligation that is "not evidenced" is not
 * the same as one that is "breached", so the evidence list shows the recorded
 * status rather than a pass or fail of its own.
 *
 * A client component for the same reason as the RCSA workspace: selecting a
 * node has to be immediate. The data arrives as `view`.
 */

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { IconSparkles } from "@tabler/icons-react";
import {
  Card,
  Chip,
  Data,
  Empty,
  Item,
  List,
  Notice,
  ObjectRef,
  RegulatoryNote,
  SectionHead,
  SkeletonRows,
  SourceRow,
  type Tone,
} from "../primitives";
import { useAskAi, useSelection } from "../SelectionProvider";
import { narrowView, ws, WS_SHARED, WS_TPRM } from "./labels";
import type { RoleWorkspaceProps } from "./index";

const SupplierConstellation = dynamic(
  () =>
    import("@/components/visualisations/SupplierConstellation").then(
      (m) => m.SupplierConstellation,
    ),
  { ssr: false, loading: () => <SkeletonRows rows={5} large /> },
);

/** The recorded evidence status, toned by how bad it is rather than by category. */
const EVIDENCE_TONE: Record<string, Tone> = {
  breached: "danger",
  "not-evidenced": "warning",
  "partially-met": "warning",
  met: "success",
};

export function TprmWorkspace(props: RoleWorkspaceProps) {
  const { language, currentMoment, compact = false } = props;
  const selectionState = useSelection();
  const contextAsk = useAskAi();
  const view = narrowView(props.view, "tprm");

  const selection = props.selection ?? selectionState.selection;
  const setSelection = props.onSelect ?? selectionState.setSelection;
  const ask = props.onAskAi ?? contextAsk;

  const onSelectNode = useCallback(
    (nodeId: string) => {
      const entry = view?.selectable[nodeId];
      if (!entry) {
        setSelection(null);
        return;
      }
      setSelection({
        objectType: entry.objectType,
        objectId: entry.objectId,
        label: entry.label,
      });
    },
    [view, setSelection],
  );

  if (!view || view.supplier === null) {
    return (
      <Empty
        title={ws(WS_SHARED.unavailable, language)}
        detail={ws(WS_SHARED.unavailableDetail, language)}
      />
    );
  }

  const changedIds = props.changedObjectIds ?? view.changedIds;
  const suggestion = props.suggestion ?? null;
  const suggestionIsRelevant =
    suggestion !== null &&
    (selection === null ||
      suggestion.objectId === selection.objectId ||
      changedIds.includes(suggestion.objectId));

  const nodeLabel = (id: string): string => view.selectable[id]?.label ?? id;

  return (
    <div className="app-stack-6">
      <header className="app-workspace-head">
        <span className="app-eyebrow">
          <Data>{currentMoment}</Data>
          <span className="app-faint">{ws(WS_TPRM.constellation, language)}</span>
          <Chip tone={view.supplier.criticality === "critical" ? "danger" : "warning"}>
            {view.supplier.criticality}
          </Chip>
          {changedIds.length > 0 ? (
            <Chip tone="ai" count>
              {changedIds.length}
            </Chip>
          ) : null}
        </span>
        <h2 className="app-object-title">{view.supplier.name}</h2>
      </header>

      <SupplierConstellation
        supplier={view.supplier}
        nodes={view.nodes}
        edges={view.edges}
        obligationSummary={view.obligationSummary}
        eventMoment={view.eventMoment}
        selectedNodeId={selection?.objectId ?? null}
        onSelectNode={onSelectNode}
        changedNodeIds={changedIds}
        changedLabel={ws(WS_SHARED.changedRecently, language)}
        heading={`${view.supplier.id} ${view.supplier.name}`}
      />

      {/* ---- Monitoring changes ---- */}
      <section className="app-section">
        <SectionHead
          title={ws(WS_TPRM.monitoringChanges, language)}
          count={view.monitoring.length}
          trailing={
            <button
              type="button"
              className="app-btn app-btn-quiet app-btn-sm"
              onClick={() =>
                ask(
                  ws(WS_TPRM.askPrompt, language),
                  selection ?? {
                    objectType: "supplier",
                    objectId: view.supplier?.id ?? "",
                    label: view.supplier?.name ?? "",
                  },
                )
              }
            >
              <IconSparkles size={13} stroke={1.8} aria-hidden="true" />
              {ws(WS_SHARED.askAboutThis, language)}
            </button>
          }
        />
        {view.monitoring.length === 0 ? (
          <Empty title={ws(WS_TPRM.noMonitoring, language)} />
        ) : (
          <List label={ws(WS_TPRM.monitoringChanges, language)}>
            {view.monitoring.map((entry) => (
              <Item
                key={entry.id}
                large
                changed={changedIds.includes(entry.subjectId)}
                selected={selection?.objectId === entry.subjectId}
                title={entry.description}
                subtitle={
                  <>
                    <ObjectRef id={entry.subjectId} label="subject" />
                    <span className="app-faint">
                      {" "}
                      {ws(WS_TPRM.reviewEvery, language)} {entry.reviewFrequency}
                    </span>
                  </>
                }
                trailing={
                  <>
                    {entry.fromThisSession ? (
                      <Chip tone="ai">{ws(WS_TPRM.activatedThisSession, language)}</Chip>
                    ) : null}
                    <Data>{entry.activatedAtMoment}</Data>
                  </>
                }
              />
            ))}
          </List>
        )}
      </section>

      {/* ---- What the event reaches ---- */}
      {view.affectedNodeIds.length > 0 ? (
        <section className="app-section">
          <SectionHead
            title={ws(WS_TPRM.affectedNodes, language)}
            count={view.affectedNodeIds.length}
          />
          <List label={ws(WS_TPRM.affectedNodes, language)}>
            {view.affectedNodeIds.map((id) => (
              <Item
                key={id}
                changed={changedIds.includes(id)}
                selected={selection?.objectId === id}
                title={nodeLabel(id)}
                subtitle={<ObjectRef id={id} label="reached" />}
                trailing={
                  <button
                    type="button"
                    className="app-btn app-btn-quiet app-btn-sm"
                    onClick={() => onSelectNode(id)}
                  >
                    {ws(WS_SHARED.selection, language)}
                  </button>
                }
              />
            ))}
          </List>
        </section>
      ) : null}

      {/*
        * A card, for a new suggestion: one of the four permitted cases. Shown
        * only when it concerns the selected node, so a suggestion about a
        * subprocessor is never read as being about the supplier.
        */}
      {suggestionIsRelevant && suggestion ? (
        <Card accent="ai" label={ws(WS_SHARED.suggestion, language)}>
          <div className="app-stack-3">
            <span className="app-eyebrow">
              {ws(WS_SHARED.suggestion, language)}
              <ObjectRef id={suggestion.objectId} label={suggestion.objectType} />
            </span>
            <p className="app-suggestion-headline">{suggestion.headline}</p>
            <p className="app-suggestion-body">{suggestion.changeSummary}</p>
            {suggestion.recommendedAction !== null ? (
              <span className="app-meta">
                <span className="app-strong">{ws(WS_SHARED.recommended, language)}: </span>
                {suggestion.recommendedAction}
              </span>
            ) : null}
            {suggestion.sources.length > 0 ? (
              <SourceRow sources={suggestion.sources} language={language} showNecessity />
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* ---- What was checked against the contract ---- */}
      <section className="app-section">
        <SectionHead
          title={ws(WS_TPRM.evidenceChecked, language)}
          count={view.evidenceChecked.length}
        />
        {view.evidenceChecked.length === 0 ? (
          <Empty title={ws(WS_TPRM.allEvidenced, language)} />
        ) : (
          <List label={ws(WS_TPRM.evidenceChecked, language)}>
            {view.evidenceChecked.slice(0, compact ? 4 : view.evidenceChecked.length).map((check) => (
              <Item
                key={check.obligationId}
                large
                title={check.clauseReference}
                subtitle={
                  <span className="app-faint">
                    {check.note.length > 0 ? check.note : check.category}
                  </span>
                }
                trailing={
                  <>
                    <Chip tone={EVIDENCE_TONE[check.status] ?? "neutral"}>{check.status}</Chip>
                    {check.evidenceIds.length > 0 ? (
                      <Chip count>{check.evidenceIds.length}</Chip>
                    ) : null}
                  </>
                }
              />
            ))}
          </List>
        )}
      </section>

      {compact ? null : (
        <>
          {/* ---- Approval conditions still open ---- */}
          <section className="app-section">
            <SectionHead
              title={ws(WS_TPRM.approvalConditions, language)}
              count={view.approvalConditions.length}
            />
            {view.approvalConditions.length === 0 ? (
              <Empty title={ws(WS_TPRM.noConditions, language)} />
            ) : (
              <List label={ws(WS_TPRM.approvalConditions, language)}>
                {view.approvalConditions.map((condition) => (
                  <Item
                    key={condition.id}
                    large
                    title={condition.statement}
                    subtitle={
                      <>
                        <ObjectRef id={condition.id} label="action" />
                        <span className="app-faint">
                          {" "}
                          {condition.owner === "unowned"
                            ? ws(WS_TPRM.unowned, language)
                            : condition.owner}
                        </span>
                      </>
                    }
                    trailing={
                      <>
                        <Chip tone={condition.status === "overdue" ? "danger" : "neutral"}>
                          {condition.status}
                        </Chip>
                        {condition.dueOn !== null ? (
                          <Data>
                            {ws(WS_TPRM.due, language)} {condition.dueOn}
                          </Data>
                        ) : null}
                      </>
                    }
                  />
                ))}
              </List>
            )}
          </section>

          {/* ---- Contractual and operational context ---- */}
          <section className="app-section">
            <SectionHead title={ws(WS_SHARED.context, language)} />
            <List label={ws(WS_SHARED.context, language)}>
              {view.context.map((line) => (
                <Item
                  key={line.label}
                  title={<span className="app-secondary">{line.label}</span>}
                  trailing={<Data size="sm">{line.value}</Data>}
                />
              ))}
            </List>
            {/*
              * One disclosure for the whole block, because the regulated
              * outsourcing line is a regulatory characterisation and the
              * wording of the disclosure must not drift between screens.
              */}
            {view.context.some((line) => line.regulatory === true) ? (
              <RegulatoryNote language={language} />
            ) : null}
          </section>

          {view.supplier.concentrationNote.length > 0 ? (
            <Notice tone="info">{view.supplier.concentrationNote}</Notice>
          ) : null}
        </>
      )}
    </div>
  );
}
