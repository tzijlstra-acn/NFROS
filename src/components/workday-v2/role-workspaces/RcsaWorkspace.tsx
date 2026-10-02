"use client";

/**
 * The Operational Risk Partner's workspace.
 *
 * The hero is the process, risk and control graph, and the live work is
 * arranged around it rather than inside it. A new signal marks the nodes it
 * reached, selecting a node states what that object affects upstream and
 * downstream, and the prepared suggestion for the selected object appears
 * beside it.
 *
 * The one thing this workspace must not do is average anything. The graph
 * already refuses to average a first line and a second line position, and the
 * divergence list here follows the same rule: two positions stay two
 * positions, ranked by how far apart they are, with the owner of each named.
 * A single blended effectiveness value would be the most damaging thing a
 * second line function could render, because the disagreement is the finding.
 *
 * A client component, because a graph node click has to change the selection
 * without a round trip to the server. The data arrives as `view`, built by
 * `buildRoleWorkspace` on the server, and the visualisation is loaded on
 * demand so the shell and the focus queue paint first.
 */

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { IconArrowUpRight, IconSparkles } from "@tabler/icons-react";
import type { WorkdaySelection } from "@/workday/contracts";
import {
  Card,
  Chip,
  Data,
  Empty,
  Item,
  List,
  Notice,
  ObjectRef,
  SectionHead,
  SkeletonRows,
  SourceRow,
} from "../primitives";
import { useAskAi, useSelection } from "../SelectionProvider";
import { narrowView, ws, WS_RCSA, WS_SHARED } from "./labels";
import type { RoleWorkspaceProps } from "./index";

/**
 * The graph, loaded on demand.
 *
 * `ssr: false` is deliberate. The layout pass measures and stacks three
 * columns, and running it on the server only to run it again on hydration
 * buys nothing: the shell, the Now panel and the queue are all server
 * rendered, so the page is readable before this arrives.
 */
const RiskControlGraph = dynamic(
  () => import("@/components/visualisations/RiskControlGraph").then((m) => m.RiskControlGraph),
  { ssr: false, loading: () => <SkeletonRows rows={5} large /> },
);

export function RcsaWorkspace(props: RoleWorkspaceProps) {
  const { language, currentMoment, compact = false } = props;
  const selectionState = useSelection();
  const contextAsk = useAskAi();
  const view = narrowView(props.view, "rcsa");

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

  if (!view) {
    return (
      <Empty
        title={ws(WS_SHARED.unavailable, language)}
        detail={ws(WS_SHARED.unavailableDetail, language)}
      />
    );
  }

  const changedIds = props.changedObjectIds ?? view.changedIds;
  const consequences = selection ? view.consequences[selection.objectId] : undefined;
  const suggestion = props.suggestion ?? null;
  const suggestionIsRelevant =
    suggestion !== null &&
    (selection === null ||
      suggestion.objectId === selection.objectId ||
      changedIds.includes(suggestion.objectId));

  return (
    <div className="app-stack-6">
      <header className="app-workspace-head">
        <span className="app-eyebrow">
          <Data>{currentMoment}</Data>
          <span className="app-faint">{ws(WS_RCSA.graph, language)}</span>
          {changedIds.length > 0 ? (
            <Chip tone="ai" count>
              {changedIds.length}
            </Chip>
          ) : null}
        </span>
        <h2 className="app-object-title">{view.heading}</h2>
      </header>

      <RiskControlGraph
        hideHeading
        processes={view.processes}
        risks={view.risks}
        controls={view.controls}
        indicators={view.indicators}
        selectedNodeId={selection?.objectId ?? null}
        onSelectNode={onSelectNode}
        changedNodeIds={changedIds}
        changedLabel={ws(WS_SHARED.changedRecently, language)}
        heading={view.heading}
      />

      {/*
        * The compact changed marker.
        *
        * Short rows carrying the same 2px edge the graph node carries, so the
        * list and the drawing are visibly the same claim. Capped upstream by
        * the detector, which is why there is no slice here.
        */}
      <section className="app-section">
        <SectionHead title={ws(WS_SHARED.whatChanged, language)} count={view.changed.length} />
        {view.changed.length === 0 ? (
          <Empty title={ws(WS_SHARED.nothingChanged, language)} />
        ) : (
          <List label={ws(WS_SHARED.whatChanged, language)}>
            {view.changed.map((entry) => {
              const selectable = view.selectable[entry.objectId];
              return (
                <Item
                  key={`${entry.objectType}:${entry.objectId}`}
                  changed
                  selected={selection?.objectId === entry.objectId}
                  title={entry.label}
                  subtitle={
                    <>
                      <ObjectRef id={entry.objectId} label={entry.objectType} />
                      <span className="app-faint"> {entry.reason}</span>
                    </>
                  }
                  trailing={
                    <>
                      {selectable ? (
                        <button
                          type="button"
                          className="app-btn app-btn-quiet app-btn-sm"
                          onClick={() => onSelectNode(entry.objectId)}
                        >
                          {ws(WS_RCSA.affected, language)}
                        </button>
                      ) : null}
                      <Data>{entry.atMoment}</Data>
                    </>
                  }
                />
              );
            })}
          </List>
        )}
      </section>

      {/* ---- The selection, and what it affects ---- */}
      <section className="app-section">
        <SectionHead
          title={ws(WS_RCSA.consequences, language)}
          trailing={
            selection ? (
              <span className="app-item-trail">
                <button
                  type="button"
                  className="app-btn app-btn-quiet app-btn-sm"
                  onClick={() => ask(ws(WS_RCSA.askPrompt, language), selection)}
                >
                  <IconSparkles size={13} stroke={1.8} aria-hidden="true" />
                  {ws(WS_SHARED.askAboutThis, language)}
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-quiet app-btn-sm"
                  onClick={() => setSelection(null)}
                >
                  {ws(WS_SHARED.clearSelection, language)}
                </button>
              </span>
            ) : undefined
          }
        />

        {selection === null ? (
          <Empty title={ws(WS_SHARED.nothingSelected, language)} />
        ) : (
          <div className="app-stack-3">
            <span className="app-meta">
              <ObjectRef id={selection.objectId} label={selection.objectType} /> {selection.label}
            </span>
            <div className="app-grid-2">
              <ConsequenceColumn
                title={ws(WS_SHARED.upstream, language)}
                links={consequences?.upstream ?? []}
                emptyLabel={ws(WS_SHARED.noConsequences, language)}
                onSelect={onSelectNode}
              />
              <ConsequenceColumn
                title={ws(WS_SHARED.downstream, language)}
                links={consequences?.downstream ?? []}
                emptyLabel={ws(WS_SHARED.noConsequences, language)}
                onSelect={onSelectNode}
              />
            </div>
          </div>
        )}
      </section>

      {/*
        * A card, and one of the four cases the primitive permits: a new
        * suggestion. It is rendered only when it concerns what the user is
        * looking at, because a suggestion about another object presented beside
        * this one would be read as being about this one.
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
            {suggestion.uncertainty.length > 0 ? (
              <Notice tone="warning">
                <span className="app-strong">{ws(WS_SHARED.uncertainty, language)}: </span>
                {suggestion.uncertainty[0]}
              </Notice>
            ) : null}
            {suggestion.sources.length > 0 ? (
              <SourceRow sources={suggestion.sources} language={language} />
            ) : null}
          </div>
        </Card>
      ) : null}

      {compact ? null : (
        <>
          {/* ---- Control effectiveness, two positions, never averaged ---- */}
          <section className="app-section">
            <SectionHead
              title={ws(WS_RCSA.effectiveness, language)}
              count={view.effectivenessChanges.length}
            />
            <List label={ws(WS_RCSA.effectiveness, language)}>
              {view.effectivenessChanges.map((change) => (
                <Item
                  key={change.controlId}
                  large
                  changed={changedIds.includes(change.controlId)}
                  selected={selection?.objectId === change.controlId}
                  title={`${change.reference} ${change.title}`}
                  subtitle={
                    <>
                      <span className="app-faint">
                        {ws(WS_RCSA.recorded, language)} {change.recorded}
                      </span>
                      <span className="app-faint">
                        {" "}
                        {ws(WS_RCSA.firstLine, language)} {change.firstLine}
                      </span>
                    </>
                  }
                  trailing={
                    <>
                      {change.isKeyControl ? (
                        <Chip tone="info">{ws(WS_RCSA.keyControl, language)}</Chip>
                      ) : null}
                      <Chip tone={change.bandsApart > 1 ? "danger" : "warning"}>
                        {change.bandsApart} {ws(WS_RCSA.bandsApart, language)}
                      </Chip>
                      <button
                        type="button"
                        className="app-btn app-btn-quiet app-btn-sm"
                        onClick={() => onSelectNode(change.controlId)}
                      >
                        <IconArrowUpRight size={13} stroke={1.8} aria-hidden="true" />
                      </button>
                    </>
                  }
                />
              ))}
            </List>
          </section>

          {/* ---- What moved since the previous assessment version ---- */}
          <section className="app-section">
            <SectionHead
              title={ws(WS_RCSA.assessmentChanges, language)}
              count={view.assessmentChanges.length}
            />
            {view.assessmentChanges.length === 0 ? (
              <Empty title={ws(WS_RCSA.noAssessmentChange, language)} />
            ) : (
              <List label={ws(WS_RCSA.assessmentChanges, language)}>
                {view.assessmentChanges.map((change) => (
                  <Item
                    key={change.riskId}
                    changed={changedIds.includes(change.riskId)}
                    selected={selection?.objectId === change.riskId}
                    title={change.riskLabel}
                    subtitle={
                      <>
                        <ObjectRef id={change.riskId} label="risk" />
                        <span className="app-faint"> {change.note}</span>
                      </>
                    }
                  />
                ))}
              </List>
            )}
          </section>

          {view.context.length > 0 ? (
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
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * One direction of consequence.
 *
 * Rows rather than a diagram, because the direction is already stated by the
 * column heading and a second diagram beside the graph would be the same
 * information drawn twice. Each row carries the recorded relationship name, so
 * the reader is never told two objects are merely "connected".
 */
function ConsequenceColumn({
  title,
  links,
  emptyLabel,
  onSelect,
}: {
  title: string;
  links: ReadonlyArray<{
    objectType: WorkdaySelection["objectType"];
    objectId: string;
    label: string;
    relation: string;
  }>;
  emptyLabel: string;
  onSelect: (objectId: string) => void;
}) {
  return (
    <div className="app-stack-1">
      <span className="app-eyebrow">{title}</span>
      {links.length === 0 ? (
        <Empty title={emptyLabel} />
      ) : (
        <List label={title}>
          {links.map((link) => (
            <Item
              key={`${link.relation}:${link.objectId}`}
              title={link.label}
              subtitle={<ObjectRef id={link.objectId} label={link.objectType} />}
              trailing={<Chip>{link.relation}</Chip>}
            >
              <button
                type="button"
                className="app-btn app-btn-quiet app-btn-sm"
                style={{ alignSelf: "flex-start" }}
                onClick={() => onSelect(link.objectId)}
              >
                {link.objectId}
              </button>
            </Item>
          ))}
        </List>
      )}
    </div>
  );
}
