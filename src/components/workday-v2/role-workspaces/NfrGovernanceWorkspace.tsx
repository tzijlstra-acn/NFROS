"use client";

/**
 * The NFR Portfolio Lead's workspace.
 *
 * The hero is the portfolio thread, and the argument it makes is the reason
 * this role exists in the product: one matter, six professional lenses, one
 * decision thread, where today the same matter would produce six separate
 * reports. The visualisation draws that collapse geometrically; this workspace
 * supplies the live parts of it, which are the changes each function has
 * actually recorded and who owns each open decision on the thread.
 *
 * Nothing here is averaged either. Six positions stay six positions, and the
 * cross function change list names the function beside every entry, because a
 * consolidated view that loses track of whose finding something was is how
 * accountability disappears into a dashboard.
 *
 * Opening a lens selects, it does not navigate. That is what "open each
 * professional lens without losing state" means in practice: the thread stays
 * rendered, the selection moves, and the drawer and the partner follow it.
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
  Notice,
  ObjectRef,
  SectionHead,
  SkeletonRows,
} from "../primitives";
import { useAskAi, useSelection } from "../SelectionProvider";
import { narrowView, roleHref, ws, WS_GOVERNANCE, WS_SHARED } from "./labels";
import type { RoleWorkspaceProps } from "./index";

const PortfolioThread = dynamic(
  () => import("@/components/visualisations/PortfolioThread").then((m) => m.PortfolioThread),
  { ssr: false, loading: () => <SkeletonRows rows={5} large /> },
);

export function NfrGovernanceWorkspace(props: RoleWorkspaceProps) {
  const { language, currentMoment, compact = false } = props;
  const selectionState = useSelection();
  const contextAsk = useAskAi();
  const view = narrowView(props.view, "nfr-governance");

  const selection = props.selection ?? selectionState.selection;
  const setSelection = props.onSelect ?? selectionState.setSelection;
  const ask = props.onAskAi ?? contextAsk;

  /**
   * Opening a lens selects that function's first decision on the thread.
   *
   * A lens is not itself an object the rest of the product knows about, so
   * selecting the decision it owns is the honest mapping: the drawer and the
   * partner can both say something useful about a decision, and neither can
   * say anything about a role identifier.
   */
  const onSelectLens = useCallback(
    (roleId: string) => {
      const lens = view?.lenses.find((entry) => entry.roleId === roleId);
      const decisionId = lens?.decisionIds[0];
      if (decisionId === undefined) {
        setSelection(null);
        return;
      }
      const entry = view?.selectable[decisionId];
      setSelection({
        objectType: "decision",
        objectId: decisionId,
        label: entry?.label ?? decisionId,
      });
    },
    [view, setSelection],
  );

  if (!view || view.matter === null) {
    return (
      <Empty
        title={ws(WS_SHARED.unavailable, language)}
        detail={ws(WS_SHARED.unavailableDetail, language)}
      />
    );
  }

  const changedIds = props.changedObjectIds ?? view.changedIds;
  /*
   * The lens marker is per function, so it is the set of roles that moved.
   * Widened to string because the visualisation's lens identifier is a plain
   * string: it is drawn from the same six values, but the component does not
   * depend on the role union and must not be made to.
   */
  const changedLensRoleIds: string[] = [
    ...new Set<string>(view.crossFunctionChanges.map((entry) => entry.roleId)),
  ];
  const selectedRoleId =
    selection?.objectType === "decision"
      ? (view.lenses.find((lens) => lens.decisionIds.includes(selection.objectId))?.roleId ?? null)
      : null;

  return (
    <div className="app-stack-6">
      <header className="app-workspace-head">
        <span className="app-eyebrow">
          <Data>{currentMoment}</Data>
          <span className="app-faint">{ws(WS_GOVERNANCE.thread, language)}</span>
          <Chip count>{view.lenses.length}</Chip>
          {changedLensRoleIds.length > 0 ? (
            <Chip tone="ai" count>
              {changedLensRoleIds.length}
            </Chip>
          ) : null}
        </span>
        <h2 className="app-object-title">{view.matter.title}</h2>
      </header>

      <PortfolioThread
        matter={view.matter}
        lenses={view.lenses}
        threadDecisionIds={view.threadDecisionIds}
        selectedRoleId={selectedRoleId}
        onSelectLens={onSelectLens}
        changedLensRoleIds={changedLensRoleIds}
        changedLabel={ws(WS_SHARED.changedRecently, language)}
        heading={view.matter.title}
      />

      {/*
        * The consolidation statement, as one line of arithmetic rather than a
        * claim. The two numbers are both read from records: the duplicate
        * report count is on the theme, and the thread length is the number of
        * decisions visible at this moment.
        */}
      <Notice tone="info">
        {view.duplicateReportCount} {ws(WS_GOVERNANCE.duplicateReports, language)},{" "}
        {view.threadDecisionIds.length} {ws(WS_GOVERNANCE.oneThread, language)}.
      </Notice>

      {/* ---- What moved, across the functions ---- */}
      <section className="app-section">
        <SectionHead
          title={ws(WS_GOVERNANCE.crossFunction, language)}
          count={view.crossFunctionChanges.length}
          trailing={
            <button
              type="button"
              className="app-btn app-btn-quiet app-btn-sm"
              onClick={() =>
                ask(ws(WS_GOVERNANCE.askPrompt, language), selection ?? {
                  objectType: "theme",
                  objectId: view.objectId ?? "",
                  label: view.matter?.title ?? "",
                })
              }
            >
              <IconSparkles size={13} stroke={1.8} aria-hidden="true" />
              {ws(WS_SHARED.askAboutThis, language)}
            </button>
          }
        />
        {view.crossFunctionChanges.length === 0 ? (
          <Empty title={ws(WS_GOVERNANCE.noCrossFunction, language)} />
        ) : (
          <List label={ws(WS_GOVERNANCE.crossFunction, language)}>
            {view.crossFunctionChanges.map((entry) => (
              <Item
                key={`${entry.roleId}:${entry.objectId}`}
                large
                changed
                href={roleHref(entry.roleId, "decision", entry.objectId)}
                title={entry.label}
                subtitle={
                  <>
                    <ObjectRef id={entry.objectId} label={entry.roleId} />
                    <span className="app-faint"> {entry.roleTitle}</span>
                  </>
                }
                trailing={<Data>{entry.atMoment}</Data>}
              />
            ))}
          </List>
        )}
      </section>

      {/* ---- Decisions and owners ---- */}
      <section className="app-section">
        <SectionHead title={ws(WS_GOVERNANCE.owners, language)} count={view.owners.length} />
        {view.owners.length === 0 ? (
          <Empty title={ws(WS_GOVERNANCE.noOwners, language)} />
        ) : (
          <List label={ws(WS_GOVERNANCE.owners, language)}>
            {view.owners.slice(0, compact ? 4 : view.owners.length).map((owner) => (
              <Item
                key={owner.decisionId}
                changed={changedIds.includes(owner.decisionId)}
                selected={selection?.objectId === owner.decisionId}
                title={owner.reference}
                subtitle={
                  <>
                    <ObjectRef id={owner.decisionId} label="decision" />
                    <span className="app-faint"> {owner.owner}</span>
                  </>
                }
                trailing={
                  <Chip tone={owner.status === "open" ? "warning" : "success"}>{owner.status}</Chip>
                }
              />
            ))}
          </List>
        )}
      </section>

      {/* ---- The six lenses as rows, for a keyboard reader ---- */}
      {compact ? null : (
        <section className="app-section">
          <SectionHead title={ws(WS_GOVERNANCE.lens, language)} count={view.lenses.length} />
          <List label={ws(WS_GOVERNANCE.lens, language)}>
            {view.lenses.map((lens) => (
              <Item
                key={lens.roleId}
                large
                changed={changedLensRoleIds.includes(lens.roleId)}
                selected={selectedRoleId === lens.roleId}
                title={lens.roleTitle}
                subtitle={<span className="app-faint">{lens.question}</span>}
                trailing={
                  <>
                    {lens.producesSeparateReportToday ? (
                      <Chip tone="warning">{ws(WS_GOVERNANCE.duplicateReports, language)}</Chip>
                    ) : null}
                    {lens.decisionIds.length > 0 ? <Chip count>{lens.decisionIds.length}</Chip> : null}
                    <button
                      type="button"
                      className="app-btn app-btn-quiet app-btn-sm"
                      onClick={() => onSelectLens(lens.roleId)}
                    >
                      {ws(WS_GOVERNANCE.lens, language)}
                    </button>
                  </>
                }
              />
            ))}
          </List>
        </section>
      )}

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
