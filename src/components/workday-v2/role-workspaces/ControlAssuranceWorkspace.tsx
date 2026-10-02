"use client";

/**
 * The Control Assurance Specialist's workspace.
 *
 * The hero is the full population field, and the point of showing the whole
 * population rather than the sample is that a reader can see what the test did
 * not look at. The live work around it follows from that: which cases have
 * just entered, why a given case was selected, how far the classification has
 * got, and which control the exceptions are actually about.
 *
 * Two distinctions this workspace holds rather than smooths over. A case that
 * arrived through the fallback route is not the same as a case the test flagged,
 * so arrival and outcome are separate columns. And an exception is a finding
 * about the control, while an item that cannot be concluded is a finding about
 * the record, so the progress figures count them separately; adding the two
 * together would overstate the deviation rate, which is the number the whole
 * conclusion rests on.
 */

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { IconSparkles } from "@tabler/icons-react";
import {
  Chip,
  Data,
  Empty,
  Item,
  List,
  ObjectRef,
  SectionHead,
  SkeletonRows,
} from "../primitives";
import { useAskAi, useSelection } from "../SelectionProvider";
import { narrowView, roleHref, ws, WS_ASSURANCE, WS_SHARED } from "./labels";
import type { RoleWorkspaceProps } from "./index";

const PopulationField = dynamic(
  () => import("@/components/visualisations/PopulationField").then((m) => m.PopulationField),
  { ssr: false, loading: () => <SkeletonRows rows={5} large /> },
);

export function ControlAssuranceWorkspace(props: RoleWorkspaceProps) {
  const { language, currentMoment, compact = false } = props;
  const selectionState = useSelection();
  const contextAsk = useAskAi();
  const view = narrowView(props.view, "control-assurance");

  const selection = props.selection ?? selectionState.selection;
  const setSelection = props.onSelect ?? selectionState.setSelection;
  const ask = props.onAskAi ?? contextAsk;

  const onSelectCase = useCallback(
    (caseId: string) => {
      const entry = view?.selectable[caseId];
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

  if (!view || view.test === null) {
    return (
      <Empty
        title={ws(WS_SHARED.unavailable, language)}
        detail={ws(WS_SHARED.unavailableDetail, language)}
      />
    );
  }

  const changedIds = props.changedObjectIds ?? view.changedIds;
  /*
   * The marker is the intersection of "new in the population" and "changed
   * recently", unless nothing has been detected as changed, in which case the
   * new cases are the honest answer on their own. Marking every fallback case
   * regardless of recency would put a marker on a third of the field.
   */
  const markedCaseIds =
    changedIds.length > 0
      ? view.newCaseIds.filter((id) => changedIds.includes(id))
      : view.newCaseIds;

  const selectedCaseId = selection?.objectType === "test-case" ? selection.objectId : null;
  const selectedReason = view.selectionReasons.find((entry) => entry.caseId === selectedCaseId);
  const progress = view.classification;
  const classifiedShare =
    progress.exceptions === 0 ? 1 : progress.classified / progress.exceptions;

  return (
    <div className="app-stack-6">
      <header className="app-workspace-head">
        <span className="app-eyebrow">
          <Data>{currentMoment}</Data>
          <span className="app-faint">{ws(WS_ASSURANCE.population, language)}</span>
          <Chip count>{progress.total}</Chip>
        </span>
        <h2 className="app-object-title">{view.heading}</h2>
      </header>

      <PopulationField
        test={view.test}
        cases={view.cases}
        selectedCaseId={selectedCaseId}
        onSelectCase={onSelectCase}
        changedCaseIds={markedCaseIds}
        changedLabel={ws(WS_ASSURANCE.newCases, language)}
        heading={view.heading}
      />

      {/*
        * The comparison row.
        *
        * Five counted facts on one line, which is the comparison the brief asks
        * to be quick. They are data text rather than headline numerals, because
        * a row of 32px figures reads as a dashboard and this is a working
        * screen.
        */}
      <section className="app-section">
        <SectionHead title={ws(WS_ASSURANCE.classification, language)} />
        <List label={ws(WS_ASSURANCE.classification, language)}>
          <Item
            title={<span className="app-secondary">{ws(WS_ASSURANCE.inSample, language)}</span>}
            trailing={
              <Data size="sm">
                {progress.sampled} / {progress.total}
              </Data>
            }
          />
          <Item
            title={<span className="app-secondary">{ws(WS_ASSURANCE.classified, language)}</span>}
            trailing={
              <>
                <Data size="sm">
                  {progress.classified} / {progress.exceptions}
                </Data>
                <span className="app-track" aria-hidden="true" style={{ width: 96 }}>
                  <span className="app-track-line" />
                  <span
                    className="app-track-progress"
                    style={{ width: `${Math.round(classifiedShare * 100)}%` }}
                  />
                </span>
              </>
            }
          />
          <Item
            title={<span className="app-secondary">{ws(WS_ASSURANCE.unclassified, language)}</span>}
            trailing={
              <Chip tone={progress.unclassified > 0 ? "warning" : "success"} count>
                {progress.unclassified}
              </Chip>
            }
          />
          <Item
            title={
              <span className="app-secondary">{ws(WS_ASSURANCE.noReviewEvidence, language)}</span>
            }
            trailing={
              <Chip tone={progress.missingReviewEvidence > 0 ? "warning" : "success"} count>
                {progress.missingReviewEvidence}
              </Chip>
            }
          />
        </List>
      </section>

      {/* ---- Why this case ---- */}
      <section className="app-section">
        <SectionHead
          title={ws(WS_ASSURANCE.whySelected, language)}
          trailing={
            selection ? (
              <button
                type="button"
                className="app-btn app-btn-quiet app-btn-sm"
                onClick={() => ask(ws(WS_ASSURANCE.askPrompt, language), selection)}
              >
                <IconSparkles size={13} stroke={1.8} aria-hidden="true" />
                {ws(WS_SHARED.askAboutThis, language)}
              </button>
            ) : undefined
          }
        />
        {selectedReason === undefined ? (
          <Empty title={ws(WS_SHARED.nothingSelected, language)} />
        ) : (
          <List label={ws(WS_ASSURANCE.whySelected, language)}>
            <Item
              large
              changed={markedCaseIds.includes(selectedReason.caseId)}
              selected
              title={selectedReason.transactionRef}
              subtitle={<span className="app-faint">{selectedReason.reason}</span>}
              trailing={
                <>
                  <Chip tone={selectedReason.outcome === "exception" ? "danger" : "warning"}>
                    {selectedReason.outcome}
                  </Chip>
                  <Chip>
                    {selectedReason.inSample
                      ? ws(WS_ASSURANCE.inSample, language)
                      : ws(WS_ASSURANCE.notInSample, language)}
                  </Chip>
                  {selectedReason.fromFallbackRoute ? (
                    <Chip tone="info">{ws(WS_ASSURANCE.fallbackRoute, language)}</Chip>
                  ) : null}
                </>
              }
            />
          </List>
        )}
      </section>

      {/* ---- New in the population ---- */}
      <section className="app-section">
        <SectionHead title={ws(WS_ASSURANCE.newCases, language)} count={view.newCaseIds.length} />
        {view.newCaseIds.length === 0 ? (
          <Empty title={ws(WS_ASSURANCE.noNewCases, language)} />
        ) : (
          <List label={ws(WS_ASSURANCE.newCases, language)}>
            {view.selectionReasons
              .filter((entry) => entry.fromFallbackRoute)
              .slice(0, compact ? 3 : 8)
              .map((entry) => (
                <Item
                  key={entry.caseId}
                  changed={markedCaseIds.includes(entry.caseId)}
                  selected={selectedCaseId === entry.caseId}
                  title={entry.transactionRef}
                  subtitle={
                    <>
                      <ObjectRef id={entry.caseId} label="test-case" />
                      <span className="app-faint"> {entry.reason}</span>
                    </>
                  }
                  trailing={
                    <button
                      type="button"
                      className="app-btn app-btn-quiet app-btn-sm"
                      onClick={() => onSelectCase(entry.caseId)}
                    >
                      {ws(WS_ASSURANCE.compare, language)}
                    </button>
                  }
                />
              ))}
          </List>
        )}
      </section>

      {/*
        * The link back to the control.
        *
        * An exception in a population is only interesting because of the
        * control it is evidence about, and that control lives in another
        * professional's view of the same row. The link carries the selection
        * across, so the operational risk partner's graph opens with this
        * control already selected rather than with the reader hunting for it.
        */}
      {view.relatedControl !== null ? (
        <section className="app-section">
          <SectionHead title={ws(WS_ASSURANCE.relatedControl, language)} />
          <List label={ws(WS_ASSURANCE.relatedControl, language)}>
            <Item
              large
              href={roleHref("rcsa", "control", view.relatedControl.id)}
              changed={changedIds.includes(view.relatedControl.id)}
              title={`${view.relatedControl.reference} ${view.relatedControl.title}`}
              subtitle={
                <>
                  <ObjectRef id={view.relatedControl.id} label="control" />
                  <span className="app-faint"> {ws(WS_ASSURANCE.openInRcsa, language)}</span>
                </>
              }
              trailing={<Chip tone="warning">{view.relatedControl.effectiveness}</Chip>}
            />
          </List>
        </section>
      ) : null}

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
        </section>
      )}
    </div>
  );
}
