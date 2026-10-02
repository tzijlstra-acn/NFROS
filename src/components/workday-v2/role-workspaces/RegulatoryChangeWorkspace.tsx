"use client";

/**
 * The Regulatory Change Manager's workspace.
 *
 * The hero is the source to obligation to control lineage, and the work around
 * it exists to hold one distinction that the rest of this product depends on:
 * what a machine read out of a paragraph is not what the institution has
 * decided the paragraph means.
 *
 * So extraction and interpretation are rendered as two separate panels, side
 * by side, with their own labels and their own accents. The left panel carries
 * the extracted summary and its confidence and says in so many words that it
 * is not a position. The right panel carries the applicability decision, the
 * rationale, the person who took it and the date, or it says the obligation has
 * not been interpreted yet. There is no single merged field anywhere on this
 * screen, because a merged field is how a model's reading of a regulation
 * quietly becomes the bank's position on it, and nobody would be able to point
 * at the moment that happened.
 *
 * Jurisdiction discipline. The two lanes are labelled geographically and no
 * supervisory framework is named in this component's own copy, because a
 * framework label is only true for some of the entities in this scenario and a
 * component cannot know which entity a reader has in mind. Framework wording
 * comes from the record, through the lineage view model, and every regulatory
 * reference on this screen carries the standing disclosure.
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
} from "../primitives";
import { useAskAi, useSelection } from "../SelectionProvider";
import { narrowView, ws, WS_REGULATORY, WS_SHARED } from "./labels";
import type { RoleWorkspaceProps } from "./index";

const ObligationLineage = dynamic(
  () => import("@/components/visualisations/ObligationLineage").then((m) => m.ObligationLineage),
  { ssr: false, loading: () => <SkeletonRows rows={5} large /> },
);

export function RegulatoryChangeWorkspace(props: RoleWorkspaceProps) {
  const { language, currentMoment, compact = false } = props;
  const selectionState = useSelection();
  const contextAsk = useAskAi();
  const view = narrowView(props.view, "regulatory-change");

  const selection = props.selection ?? selectionState.selection;
  const setSelection = props.onSelect ?? selectionState.setSelection;
  const ask = props.onAskAi ?? contextAsk;

  const onSelectObligation = useCallback(
    (obligationId: string) => {
      const entry = view?.selectable[obligationId];
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

  if (!view || view.publications.length === 0) {
    return (
      <Empty
        title={ws(WS_SHARED.unavailable, language)}
        detail={ws(WS_SHARED.unavailableDetail, language)}
      />
    );
  }

  const changedIds = props.changedObjectIds ?? view.changedIds;
  /*
   * The marker means "this extraction is new", which is a different claim from
   * the terminal state the ribbon already carries. It is therefore the
   * intersection of the detector's answer and the set of uninterpreted
   * obligations, and falls back to the uninterpreted set when nothing has been
   * detected as changed.
   */
  const markedIds =
    changedIds.length > 0
      ? view.newlyExtractedIds.filter((id) => changedIds.includes(id))
      : view.newlyExtractedIds;

  const selectedId = selection?.objectType === "obligation" ? selection.objectId : null;
  const selectedPair = view.interpretation.find((entry) => entry.obligationId === selectedId);
  const suggestion = props.suggestion ?? null;
  const suggestionIsRelevant =
    suggestion !== null && selectedId !== null && suggestion.objectId === selectedId;

  const obligationLabel = (id: string): string =>
    view.interpretation.find((entry) => entry.obligationId === id)?.paragraphReference ?? id;

  return (
    <div className="app-stack-6">
      <header className="app-workspace-head">
        <span className="app-eyebrow">
          <Data>{currentMoment}</Data>
          <span className="app-faint">{ws(WS_REGULATORY.lineage, language)}</span>
          <Chip count>{view.obligations.length}</Chip>
          {view.missingOwnerIds.length > 0 ? (
            <Chip tone="warning" count>
              {view.missingOwnerIds.length}
            </Chip>
          ) : null}
        </span>
        <h2 className="app-object-title">{view.heading}</h2>
      </header>

      <ObligationLineage
        publications={view.publications}
        obligations={view.obligations}
        laneLabels={{
          eu: ws(WS_REGULATORY.euLane, language),
          ch: ws(WS_REGULATORY.chLane, language),
        }}
        selectedObligationId={selectedId}
        onSelectObligation={onSelectObligation}
        changedObligationIds={markedIds}
        changedLabel={ws(WS_REGULATORY.newlyExtracted, language)}
        heading={view.heading}
      />
      <RegulatoryNote language={language} />

      {/*
        * The distinction, drawn.
        *
        * Two panels, never one. The left is machine reading, the right is a
        * named person's position, and the right panel says plainly when nobody
        * has taken one. An empty right panel is the finding this role exists to
        * produce, so it is rendered as a statement rather than as a blank.
        */}
      <section className="app-section">
        <SectionHead
          title={ws(WS_REGULATORY.extraction, language)}
          trailing={
            selection ? (
              <button
                type="button"
                className="app-btn app-btn-quiet app-btn-sm"
                onClick={() => ask(ws(WS_REGULATORY.askPrompt, language), selection)}
              >
                <IconSparkles size={13} stroke={1.8} aria-hidden="true" />
                {ws(WS_SHARED.askAboutThis, language)}
              </button>
            ) : undefined
          }
        />

        {selectedPair === undefined ? (
          <Empty title={ws(WS_SHARED.nothingSelected, language)} />
        ) : (
          <div className="app-grid-2">
            <Card accent="info" label={ws(WS_REGULATORY.extraction, language)}>
              <div className="app-stack-2">
                <span className="app-eyebrow">{ws(WS_REGULATORY.extraction, language)}</span>
                <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
                  {selectedPair.extractedSummary}
                </span>
                <span className="app-meta">{ws(WS_REGULATORY.extractionNote, language)}</span>
                <div className="app-row app-row-3 app-row-wrap">
                  <Chip tone={selectedPair.extractionConfidence < 0.7 ? "warning" : "info"}>
                    {Math.round(selectedPair.extractionConfidence * 100)}{" "}
                    {ws(WS_REGULATORY.confidence, language)}
                  </Chip>
                  <span className="app-meta">
                    {ws(WS_REGULATORY.candidateScope, language)}:{" "}
                    <Data>{selectedPair.candidateEntityLabel}</Data>
                  </span>
                </div>
              </div>
            </Card>

            <Card
              accent={selectedPair.applicabilityDecision === null ? "warning" : "success"}
              label={ws(WS_REGULATORY.interpretation, language)}
            >
              <div className="app-stack-2">
                <span className="app-eyebrow">{ws(WS_REGULATORY.interpretation, language)}</span>
                {selectedPair.applicabilityDecision === null ? (
                  <Notice tone="warning">{ws(WS_REGULATORY.notInterpreted, language)}</Notice>
                ) : (
                  <>
                    <span className="app-strong" style={{ fontSize: "var(--app-text-sm)" }}>
                      {selectedPair.applicabilityDecision}
                    </span>
                    {selectedPair.applicabilityRationale !== null ? (
                      <span className="app-meta">{selectedPair.applicabilityRationale}</span>
                    ) : null}
                    <span className="app-meta">
                      {ws(WS_REGULATORY.decidedBy, language)}{" "}
                      {selectedPair.decidedBy ?? "not recorded"}
                      {selectedPair.decidedOn !== null ? (
                        <>
                          {" "}
                          <Data>{selectedPair.decidedOn}</Data>
                        </>
                      ) : null}
                    </span>
                  </>
                )}
                <span className="app-meta">{ws(WS_REGULATORY.interpretationNote, language)}</span>
              </div>
            </Card>
          </div>
        )}
        <RegulatoryNote language={language} />
      </section>

      {suggestionIsRelevant && suggestion ? (
        <Card accent="ai" label={ws(WS_SHARED.suggestion, language)}>
          <div className="app-stack-3">
            <span className="app-eyebrow">
              {ws(WS_SHARED.suggestion, language)}
              <ObjectRef id={suggestion.objectId} label="obligation" />
            </span>
            <p className="app-suggestion-headline">{suggestion.headline}</p>
            <p className="app-suggestion-body">{suggestion.changeSummary}</p>
            {/*
              * A suggestion on this screen is a reading, never a position. The
              * label says so before the recommendation is read, not after.
              */}
            <Notice tone="info">{ws(WS_REGULATORY.extractionNote, language)}</Notice>
            {suggestion.sources.length > 0 ? (
              <SourceRow sources={suggestion.sources} language={language} />
            ) : null}
            <RegulatoryNote language={language} />
          </div>
        </Card>
      ) : null}

      {/* ---- Newly extracted, not yet interpreted ---- */}
      <section className="app-section">
        <SectionHead
          title={ws(WS_REGULATORY.newlyExtracted, language)}
          count={view.newlyExtractedIds.length}
        />
        {view.newlyExtractedIds.length === 0 ? (
          <Empty title={ws(WS_REGULATORY.noneNew, language)} />
        ) : (
          <List label={ws(WS_REGULATORY.newlyExtracted, language)}>
            {view.newlyExtractedIds.slice(0, compact ? 4 : 12).map((id) => {
              const pair = view.interpretation.find((entry) => entry.obligationId === id);
              return (
                <Item
                  key={id}
                  changed={markedIds.includes(id)}
                  selected={selectedId === id}
                  title={obligationLabel(id)}
                  subtitle={
                    <>
                      <ObjectRef id={id} label="obligation" />
                      <span className="app-faint"> {pair?.extractedSummary ?? ""}</span>
                    </>
                  }
                  trailing={
                    <>
                      <Chip tone="warning">{ws(WS_REGULATORY.notInterpreted, language)}</Chip>
                      <button
                        type="button"
                        className="app-btn app-btn-quiet app-btn-sm"
                        onClick={() => onSelectObligation(id)}
                      >
                        {ws(WS_SHARED.selection, language)}
                      </button>
                    </>
                  }
                />
              );
            })}
          </List>
        )}
      </section>

      {/* ---- No owner named ---- */}
      <section className="app-section">
        <SectionHead
          title={ws(WS_REGULATORY.missingOwners, language)}
          count={view.missingOwnerIds.length}
        />
        {view.missingOwnerIds.length === 0 ? (
          <Empty title={ws(WS_REGULATORY.allOwned, language)} />
        ) : (
          <List label={ws(WS_REGULATORY.missingOwners, language)}>
            {view.missingOwnerIds.slice(0, compact ? 4 : 12).map((id) => {
              const pair = view.interpretation.find((entry) => entry.obligationId === id);
              return (
                <Item
                  key={id}
                  changed={markedIds.includes(id)}
                  selected={selectedId === id}
                  title={obligationLabel(id)}
                  subtitle={
                    <>
                      <ObjectRef id={id} label="obligation" />
                      <span className="app-faint">
                        {" "}
                        {ws(WS_REGULATORY.candidateScope, language)}{" "}
                        {pair?.candidateEntityLabel ?? ""}
                      </span>
                    </>
                  }
                  trailing={
                    <button
                      type="button"
                      className="app-btn app-btn-quiet app-btn-sm"
                      onClick={() => onSelectObligation(id)}
                    >
                      {ws(WS_SHARED.selection, language)}
                    </button>
                  }
                />
              );
            })}
          </List>
        )}
        <RegulatoryNote language={language} />
      </section>

      {compact || view.context.length === 0 ? null : (
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
          <RegulatoryNote language={language} />
        </section>
      )}
    </div>
  );
}
